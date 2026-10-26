import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { createBotanicalAPI, accounts, answerRow } from './botanical-api.js';
import { botanicalSession, botanicalAnswer } from '../fixtures/personal-data.js';
import {
  botanicalPath, botanicalBank, botanicalStorageKey, botanicalSynced, refreshBotanical, startBotanical, botanicalMetric,
  answerBotanical, currentBotanicalPhoto, nextBotanical, finishBotanical, expectBotanicalHistory, botanicalRecords,
} from '../helpers/botanical-browser.js';

const now = new Date('2026-10-25T10:00:00.000Z');
const importButton = page => page.getByRole('button', { name: 'Importer l’historique de cet appareil', exact: true });
async function capture(page, name) {
  await mkdir('.tmp/botanical-visual', { recursive: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `.tmp/botanical-visual/${name}.png`, fullPage: true, animations: 'disabled' });
}
async function theme(page, value) {
  if (await page.locator('html').getAttribute('data-theme') !== value) {
    // Exercise the appearance handler while retaining an already open modal
    // for the visual matrix; the modal deliberately blocks pointer access.
    if (await page.getByRole('dialog').isVisible()) await page.locator('#theme-toggle').evaluate(button => button.click());
    else await page.locator('#theme-toggle').click();
  }
  await expect(page.locator('html')).toHaveAttribute('data-theme', value);
}
async function captureMatrix(page, name) {
  for (const [width, device] of [[1280, 'desktop'], [390, 'mobile']]) {
    await page.setViewportSize({ width, height: 900 });
    for (const value of ['light', 'dark']) { await theme(page, value); await capture(page, `${name}-${device}-${value}`); }
  }
}
test.beforeEach(async ({ page }) => { await page.clock.install({ time: now }); });

test('botanique personnelle : deux appareils, erreurs révisables et chrono stable pendant la synchronisation', async ({ page, browser }) => {
  const api = createBotanicalAPI(); await api.install(page.context());
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173/', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  await api.install(context); const second = await context.newPage(); await second.clock.install({ time: now });
  try {
    await page.goto(botanicalPath); await botanicalSynced(page);
    await startBotanical(page); await answerBotanical(page); await nextBotanical(page); const wrong = await answerBotanical(page, false);
    await finishBotanical(page); await botanicalSynced(page);
    await second.goto(botanicalPath); await botanicalSynced(second);
    await expectBotanicalHistory(second, { attempted: 2, correct: 1, incorrect: 1, timeouts: 0, rate: '50 %' });
    await expect(second.locator('.bot-revision')).toContainText('1 espèce à retravailler');
    await startBotanical(second, { revision: true }); const revised = await answerBotanical(second);
    expect(revised.plant.id).toBe(wrong.plant.id); await nextBotanical(second); await botanicalSynced(second);
    await refreshBotanical(page); await expectBotanicalHistory(page, { attempted: 3, correct: 2, incorrect: 1, rate: '67 %' });
    expect(api.answers.size).toBe(3); expect(api.sessions.size).toBe(2);
    await captureMatrix(page, 'personal');
    await page.getByRole('button', { name: 'Choisir une nouvelle session', exact: true }).click();
    await startBotanical(page, { mode: 'chrono', duration: '30' });
    const { image } = await currentBotanicalPhoto(page); const photo = await image.getAttribute('src');
    const choice = page.getByRole('group', { name: 'Quatre propositions' }).getByRole('button').first();
    await choice.click(); await choice.focus(); await page.clock.fastForward(5000);
    const remaining = await page.locator('#bot-time').textContent();
    await page.evaluate(async () => {
      const app = new URL(document.querySelector('script[type="module"][src]').src);
      const url = new URL('./botanical-sync-service.js', app); url.search = app.search;
      const service = await (await import(url.href)).getBotanicalService(); await service.retry();
    });
    await botanicalSynced(page); await expect(choice).toHaveAttribute('aria-pressed', 'true'); await expect(choice).toBeFocused();
    await expect(image).toHaveAttribute('src', photo); await expect(page.locator('#bot-time')).toHaveText(remaining);
    await page.getByRole('button', { name: 'Mettre en pause', exact: true }).click();
    await captureMatrix(page, 'chrono');
  } finally { await context.close(); }
});

test('botanique hors ligne : identités durables, ordre session réponses complétion et retry sans doublon', async ({ page }) => {
  const api = createBotanicalAPI(); await api.install(page.context());
  await page.goto(botanicalPath); await botanicalSynced(page); api.restOffline = true;
  await startBotanical(page); await answerBotanical(page); await nextBotanical(page); await answerBotanical(page, false); await finishBotanical(page);
  await expectBotanicalHistory(page, { attempted: 2, correct: 1, incorrect: 1, rate: '50 %' });
  await expect(page.locator('#botanical-sync-status')).toContainText(/hors ligne|connexion|attente/i);
  const before = (await botanicalRecords(page))[0]; expect(before.operations.filter(op => op.state === 'pending').length).toBeGreaterThanOrEqual(4);
  await captureMatrix(page, 'offline');
  await page.reload(); await expectBotanicalHistory(page, { attempted: 2, correct: 1, incorrect: 1, rate: '50 %' });
  expect((await botanicalRecords(page))[0].operations.map(op => op.id)).toEqual(before.operations.map(op => op.id));
  api.restOffline = false; api.loseAnswerAck = true; await refreshBotanical(page);
  expect(api.answers.size).toBe(2); expect(api.sessions.size).toBe(1);
  const calls = api.sent.filter(item => /personal_.*botanical/.test(item.url));
  expect(calls[0].body.p_session.completedAt).toBeNull(); expect(calls.at(-1).body.p_session.completedAt).not.toBeNull();
  expect(calls.at(-1).body.p_expected_revision).toBe(1);
  const answerCalls = calls.filter(item => item.body.p_answer); expect(answerCalls[0].body).toEqual(answerCalls[1].body);
  await refreshBotanical(page); expect(api.answers.size).toBe(2);
});

test('botanique : A vers visiteur puis B suspend la question privée et restitue seulement l’historique du compte', async ({ page }) => {
  const api = createBotanicalAPI(); await api.install(page.context()); await page.goto(botanicalPath); await botanicalSynced(page);
  await startBotanical(page); await answerBotanical(page); await finishBotanical(page); await botanicalSynced(page);
  await page.getByRole('button', { name: 'Choisir une nouvelle session', exact: true }).click(); await startBotanical(page);
  await page.getByRole('group', { name: 'Quatre propositions' }).getByRole('button').first().click();
  await page.locator('header').getByRole('button', { name: 'Déconnexion', exact: true }).click();
  await expect(page.locator('#botanical-sync-status')).toContainText('visiteur');
  await expect(page.getByRole('group', { name: 'Quatre propositions' })).toHaveCount(0); await expectBotanicalHistory(page, { attempted: 0 });
  await page.evaluate(async email => { const auth = await (await import('/mon-bprea/assets/auth-service.js')).getAuthService(); await auth.signIn(email, 'synthetic-password'); }, accounts.B.email);
  await botanicalSynced(page); await expectBotanicalHistory(page, { attempted: 0 });
  await startBotanical(page); await answerBotanical(page, false); await finishBotanical(page); await botanicalSynced(page);
  await page.evaluate(async email => { const auth = await (await import('/mon-bprea/assets/auth-service.js')).getAuthService(); await auth.signOut(); await auth.signIn(email, 'synthetic-password'); }, accounts.A.email);
  await botanicalSynced(page); await expectBotanicalHistory(page, { attempted: 1, correct: 1, incorrect: 0, rate: '100 %' });
  expect(new Set([...api.answers.values()].map(item => item.user_id)).size).toBe(2);
  expect(await botanicalRecords(page)).toHaveLength(2);
});

test('botanique : import explicite, annulation, provenance et orpheline sans mutation de la sauvegarde', async ({ page }) => {
  const session = botanicalSession('botanical-ui-import', { mode: 'discovery', completedAt: '2026-10-21T12:01:00.000Z' });
  const raw = JSON.stringify({ schemaVersion: 1, sessions: [session], answers: [botanicalAnswer(session), botanicalAnswer(botanicalSession('orphan-session'))], sourceArchive: ['à conserver'] });
  const api = createBotanicalAPI(); await api.install(page.context(), 'A', raw); await page.goto(botanicalPath); await botanicalSynced(page);
  await expectBotanicalHistory(page, { attempted: 0 }); expect(api.answers.size).toBe(0);
  await importButton(page).click(); const dialog = page.getByRole('dialog', { name: 'Importer l’historique botanique local' });
  await expect(dialog).toContainText('autre personne'); await expect(dialog).toContainText(/orpheline|sans session/i);
  await page.getByRole('button', { name: 'Annuler', exact: true }).click(); expect(api.answers.size).toBe(0);
  await importButton(page).click(); await captureMatrix(page, 'import');
  await page.getByRole('button', { name: 'Confirmer l’import', exact: true }).click(); await botanicalSynced(page);
  await expectBotanicalHistory(page, { attempted: 1, correct: 1, incorrect: 0, rate: '100 %' }); expect(api.answers.size).toBe(1);
  const document = (await botanicalRecords(page))[0]; expect(document.imports).toHaveLength(1); expect(JSON.stringify(document.imports)).toContain('orphan-session');
  await page.reload(); await botanicalSynced(page); await importButton(page).click();
  await page.getByRole('button', { name: 'Confirmer l’import', exact: true }).click(); await botanicalSynced(page);
  expect(api.answers.size).toBe(1); expect((await botanicalRecords(page))[0].imports).toHaveLength(1);
  expect(await page.evaluate(key => localStorage.getItem(key), botanicalStorageKey)).toBe(raw);
});

test('botanique : divergence de réponse archivée, version du compte et résolution explicite sans double comptage', async ({ page }) => {
  const api = createBotanicalAPI(); await api.install(page.context()); await page.goto(botanicalPath); await botanicalSynced(page);
  await startBotanical(page); await botanicalSynced(page); api.restOffline = true;
  await answerBotanical(page); await expect(page.locator('#botanical-sync-status')).toContainText(/ligne|connexion|attente/i);
  const document = (await botanicalRecords(page))[0], op = document.operations.find(item => item.type === 'answer');
  const wrongSpecies = botanicalBank.species.find(item => item.id !== op.payload.p_answer.speciesId && item.categoryIds.includes(op.payload.p_answer.categoryId));
  const divergent = { ...op.payload.p_answer, status: 'incorrect', correct: false, selectedSpeciesId: wrongSpecies.id };
  api.answers.set(`${accounts.A.id}:${divergent.id}`, answerRow(divergent, accounts.A.id)); api.restOffline = false;
  await page.getByRole('button', { name: 'Actualiser l’historique', exact: true }).click();
  await expect(page.locator('#botanical-sync-status')).toContainText('Conflit');
  await expectBotanicalHistory(page, { attempted: 1, correct: 0, incorrect: 1, rate: '0 %' });
  await page.locator('.botanical-conflict').first().locator('summary').click(); await captureMatrix(page, 'conflict');
  await page.getByRole('button', { name: 'Garder la version du compte', exact: true }).click(); await botanicalSynced(page);
  expect(api.answers.size).toBe(1); expect((await botanicalRecords(page))[0].conflicts.every(item => item.resolved)).toBe(true);
  await expect(page.getByRole('button', { name: 'Actualiser l’historique', exact: true })).toBeFocused();
  await finishBotanical(page); await botanicalSynced(page);
  await expect(botanicalMetric(page.locator('#bot-content'), 'Questions réalisées')).toHaveText('1');
  await expect(botanicalMetric(page.locator('#bot-content'), 'Réponses correctes')).toHaveText('0');
  await expect(botanicalMetric(page.locator('#bot-content'), 'Réponses incorrectes')).toHaveText('1');
});

test('botanique : transaction IndexedDB refusée, correction conservée et nouvel essai explicite du même résultat', async ({ page }) => {
  const api = createBotanicalAPI(); await api.install(page.context());
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(...args) {
      if (window.botanicalStorageFull && this.transaction.db.name === 'mon-bprea-botanical-personal-v1') throw new DOMException('Synthetic full storage', 'QuotaExceededError');
      return put.apply(this, args);
    };
  });
  await page.goto(botanicalPath); await botanicalSynced(page); await startBotanical(page); await botanicalSynced(page);
  await page.evaluate(() => window.botanicalStorageFull = true); const current = await answerBotanical(page);
  await expect(page.locator('#bot-save-message')).not.toContainText('Réponse enregistrée');
  await expect(page.getByRole('button', { name: 'Réessayer l’enregistrement', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Question suivante|Voir les résultats/ })).toBeDisabled();
  await expectBotanicalHistory(page, { attempted: 0 }); expect(api.answers.size).toBe(0);
  await captureMatrix(page, 'storage-error');
  await page.evaluate(() => window.botanicalStorageFull = false);
  await page.getByRole('button', { name: 'Réessayer l’enregistrement', exact: true }).click();
  await expect(page.locator('#bot-save-message')).toContainText('Réponse enregistrée sur cet appareil'); await botanicalSynced(page);
  await expect(page.locator('#bot-feedback')).toContainText(current.plant.commonName); expect(api.answers.size).toBe(1);
  await expectBotanicalHistory(page, { attempted: 1, correct: 1, incorrect: 0, rate: '100 %' });
});

test('botanique : les réglages restent verrouillés pendant une création locale retardée', async ({ page }) => {
  const api = createBotanicalAPI(); await api.install(page.context());
  await page.goto(botanicalPath); await botanicalSynced(page);
  await page.evaluate(async () => {
    // Import the exact versioned module already used by the Pages artifact.
    const app = new URL(document.querySelector('script[type="module"][src]').src);
    const url = new URL('./botanical-sync-service.js', app); url.search = app.search;
    const service = await (await import(url.href)).getBotanicalService();
    const create = service.createSession;
    service.createSession = async value => {
      window.delayedBotanicalSession = structuredClone(value);
      await new Promise(resolve => { window.releaseBotanicalSession = resolve; });
      return create(value);
    };
  });
  await startBotanical(page, { mode: 'chrono', duration: '30' });
  await page.waitForFunction(() => typeof window.releaseBotanicalSession === 'function');
  const requested = await page.evaluate(() => window.delayedBotanicalSession);
  await expect(page.getByRole('radio', { name: /^Chrono/ })).toBeDisabled();
  await expect(page.getByRole('radio', { name: /^Découverte/ })).toBeDisabled();
  await expect(page.getByRole('combobox', { name: 'Durée par question' })).toBeDisabled();
  await expect(page.getByRole('checkbox', { name: /Revoir mes erreurs/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Commencer la session' })).toBeDisabled();
  expect(api.sessions.size).toBe(0);
  // A queued settings event must not rebuild selection while storage awaits.
  await page.locator('#bot-revision').evaluate(input => { input.checked = true; input.dispatchEvent(new Event('change', { bubbles: true })); });
  await expect(page.locator('#bot-session-info')).toContainText('Enregistrement de la session');
  const otherCategory = page.locator('[data-category]:not([disabled])');
  for (const button of await otherCategory.all()) {
    if (await button.getAttribute('data-category') !== requested.categoryId) { await button.click(); break; }
  }
  await expect(page.locator(`[data-category="${requested.categoryId}"]`)).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => window.releaseBotanicalSession());
  await expect(page.getByRole('heading', { name: 'Question 1 sur 4', exact: true })).toBeVisible();
  await botanicalSynced(page);
  const saved = [...api.sessions.values()]; expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ session_id: requested.id, category_id: requested.categoryId, mode: 'chrono', duration_seconds: 30, is_revision: false });
  await answerBotanical(page); await finishBotanical(page); await botanicalSynced(page);
  expect(api.sessions.size).toBe(1); expect(api.answers.size).toBe(1);

});

test('botanique : les résultats déjà affichés se réconcilient sans déplacer le focus', async ({ page }) => {
  const api = createBotanicalAPI(); await api.install(page.context());
  await page.goto(botanicalPath); await botanicalSynced(page); await startBotanical(page); await botanicalSynced(page);
  api.restOffline = true; await answerBotanical(page); await finishBotanical(page);
  await expect(botanicalMetric(page.locator('#bot-result-data'), 'Réponses correctes')).toHaveText('1');
  await expect(botanicalMetric(page.locator('#bot-result-data'), 'Réponses incorrectes')).toHaveText('0');
  const document = (await botanicalRecords(page))[0], operation = document.operations.find(item => item.type === 'answer');
  const original = operation.payload.p_answer;
  const wrongSpecies = botanicalBank.species.find(item => item.id !== original.speciesId && item.categoryIds.includes(original.categoryId));
  api.answers.set(`${accounts.A.id}:${original.id}`, answerRow({ ...original, status: 'incorrect', selectedSpeciesId: wrongSpecies.id, correct: false }, accounts.A.id));
  const nextSession = page.getByRole('button', { name: 'Choisir une nouvelle session', exact: true }); await nextSession.focus();
  api.restOffline = false;
  await page.evaluate(async () => {
    const app = new URL(document.querySelector('script[type="module"][src]').src);
    const url = new URL('./botanical-sync-service.js', app); url.search = app.search;
    await (await (await import(url.href)).getBotanicalService()).retry();
  });
  await expect(page.locator('#botanical-sync-status')).toContainText('Conflit');
  await expect(botanicalMetric(page.locator('#bot-result-data'), 'Réponses correctes')).toHaveText('0');
  await expect(botanicalMetric(page.locator('#bot-result-data'), 'Réponses incorrectes')).toHaveText('1');
  await expect(botanicalMetric(page.locator('#bot-result-data'), 'Taux de reconnaissance')).toHaveText('0 %');
  await expect(page.locator('#bot-result-count')).toContainText('1 question réalisée sur 4 proposées');
  await expect(nextSession).toBeFocused();
  await expectBotanicalHistory(page, { attempted: 1, correct: 0, incorrect: 1, rate: '0 %' });
  expect(api.sessions.size).toBe(1); expect(api.answers.size).toBe(1);
  const historySummary = page.locator('#bot-history summary'); await historySummary.focus();
  const anotherId = `${original.sessionId}-another-question`;
  api.answers.set(`${accounts.A.id}:${anotherId}`, answerRow({ ...original, id: anotherId, questionId: anotherId }, accounts.A.id));
  await page.evaluate(async () => {
    const app = new URL(document.querySelector('script[type="module"][src]').src);
    const url = new URL('./botanical-sync-service.js', app); url.search = app.search;
    await (await (await import(url.href)).getBotanicalService()).retry();
  });
  await expectBotanicalHistory(page, { attempted: 2, correct: 1, incorrect: 1, rate: '50 %' });
  await expect(historySummary).toBeFocused();
});

test('botanique visiteur sans Supabase : historique indépendant et rendu clair/sombre sur deux écrans', async ({ page }) => {
  await page.goto(botanicalPath); await expect(page.locator('#botanical-sync-status')).toContainText('visiteur');
  await startBotanical(page); await answerBotanical(page, false); await finishBotanical(page);
  await expectBotanicalHistory(page, { attempted: 1, correct: 0, incorrect: 1, rate: '0 %' });
  const raw = await page.evaluate(key => localStorage.getItem(key), botanicalStorageKey); expect(raw).not.toBeNull();
  await captureMatrix(page, 'visitor');
  await page.reload(); await expectBotanicalHistory(page, { attempted: 1, correct: 0, incorrect: 1, rate: '0 %' });
  expect(await page.evaluate(key => localStorage.getItem(key), botanicalStorageKey)).toBe(raw);
});

for (const [name, raw] of [['corrompu', '{ancienne-sauvegarde-incomplete'], ['futur', JSON.stringify({ schemaVersion: 99, answers: [], sessions: [], preserved: true })]]) {
  test(`botanique visiteur : stockage ${name} conservé et jeu en mémoire après choix explicite`, async ({ page }) => {
    await page.addInitScript(source => localStorage.setItem('monbprea.botanical.v1', source), raw);
    await page.goto(botanicalPath); await expect(page.locator('#botanical-sync-status')).toContainText('visiteur');
    await startBotanical(page);
    await expect(page.getByRole('img', { name: /^Photographie à identifier/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Jouer sans sauvegarder', exact: true }).click();
    await answerBotanical(page, false);
    await expect(page.locator('#bot-save-message')).toContainText('Elle n’est pas sauvegardée');
    await expect(page.locator('#bot-save-message')).not.toContainText('Réponse enregistrée');
    await finishBotanical(page); await expectBotanicalHistory(page, { attempted: 1, correct: 0, incorrect: 1, rate: '0 %' });
    expect(await page.evaluate(key => localStorage.getItem(key), botanicalStorageKey)).toBe(raw);
    await page.reload(); await expectBotanicalHistory(page, { attempted: 0 });
    expect(await page.evaluate(key => localStorage.getItem(key), botanicalStorageKey)).toBe(raw);
  });
}
