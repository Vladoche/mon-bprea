import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { createExportAPI, accounts } from './export-api.js';
import { CACHES } from '../../assets/export-sources.js';
import { emptyPersonalDocument as courseDocument, mutateCourse } from '../../assets/course-quiz-model.js';
import { emptySettingsDocument, queueSettings } from '../../assets/settings-model.js';
import { parameters } from '../fixtures/export.js';
import { stopOrdinarySync } from '../helpers/export-browser.js';
const path = '/mon-bprea/profil.html';
test.use({ trace: 'off', screenshot: 'off', video: 'off' });
test.beforeEach(async ({ page }) => { await page.clock.install({ time: new Date('2026-10-27T12:00:00Z') }); });
const scope = (id, origin = 'https://export.invalid') => JSON.stringify(['development', origin, id]);
async function seed(page, origin = 'https://export.invalid') {
  const a = courseDocument(scope(accounts.A.id, origin)), b = courseDocument(scope(accounts.B.id, origin));
  mutateCourse(a, 'non-synchronise', false); mutateCourse(b, 'historique-b', true);
  const settings = emptySettingsDocument(scope(accounts.A.id, origin)); queueSettings(settings, 'itk', parameters);
  queueSettings(settings, 'appearance', { version: 1, season: 'auto', brightness: 'dark' });
  await page.evaluate(async records => {
    for (const [name, document] of records) await new Promise((resolve, reject) => {
      const req = indexedDB.open(name, 2); req.onupgradeneeded = () => {
        for (const store of ['accounts', 'privacy']) if (!req.result.objectStoreNames.contains(store)) req.result.createObjectStore(store);
      };
      req.onerror = reject; req.onsuccess = () => { const db = req.result; db.onversionchange = () => db.close();
        const tx = db.transaction('accounts', 'readwrite'); tx.objectStore('accounts').put(document, document.scope);
        tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = reject; };
    });
  }, [[CACHES.courses, a], [CACHES.courses, b], [CACHES.settings, settings]]);
  return { a, b, settings };
}
async function read(page, database, key) {
  return page.evaluate(async ({ database, key }) => {
    const req = indexedDB.open(database); const db = await new Promise(resolve => { req.onsuccess = () => resolve(req.result); });
    return new Promise((resolve, reject) => { const tx = db.transaction('accounts'); const get = tx.objectStore('accounts').get(key);
      tx.oncomplete = () => { db.close(); resolve(get.result ?? null); }; tx.onabort = reject; });
  }, { database, key });
}
async function preview(page, label = 'Cours et QCM') {
  await page.locator('[data-erase-personal]').getByLabel(label, { exact: true }).check();
  await page.getByRole('button', { name: 'Examiner l’effacement local', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}
async function captures(page, name, dialog = false) {
  await mkdir('.tmp/erasure-visual', { recursive: true });
  for (const width of [1280, 390]) for (const brightness of ['light', 'dark']) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(brightness => window.BpreaAppearance.applyPreferences({ version: 1, season: 'auto', brightness }), brightness);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (dialog) await page.getByRole('dialog').screenshot({ path: `.tmp/erasure-visual/${name}-${width}-${brightness}.png`, animations: 'disabled' });
    else await page.locator('.data-erasure').screenshot({ path: `.tmp/erasure-visual/${name}-${width}-${brightness}.png`, animations: 'disabled' });
  }
}
test('sélection, outbox signalée, focus/annulation puis retrait A conservant B et visiteur', async ({ page }) => {
  const api = createExportAPI(); await api.install(page.context(), 'A', { 'bprea-demo-progress-v1': '{"visiteur":{"done":true}}' });
  await page.goto(path); await stopOrdinarySync(page); const original = await seed(page);
  expect(await page.locator('[data-erase-visitor] input:checked').count()).toBe(0);
  await preview(page); await expect(page.getByRole('dialog')).toContainText('1 opération(s) non confirmée(s)');
  await expect(page.locator('[data-erase-cancel]')).toBeFocused(); await captures(page, 'confirmation', true);
  await page.keyboard.press('Escape'); await expect(page.locator('[data-erase-preview]')).toBeFocused();
  expect(await read(page, CACHES.courses, scope(accounts.A.id))).toEqual(original.a);
  await page.locator('[data-erase-preview]').click(); await page.locator('[data-erase-confirm]').click();
  await expect(page.locator('[data-erase-status]')).toContainText('Effacement local confirmé');
  expect(await read(page, CACHES.courses, scope(accounts.A.id))).toBeNull();
  expect(await read(page, CACHES.courses, scope(accounts.B.id))).toEqual(original.b);
  expect(await page.evaluate(() => localStorage.getItem('bprea-demo-progress-v1'))).toBe('{"visiteur":{"done":true}}');
  expect(api.writes).toEqual([]); await captures(page, 'termine');
  await expect(page.locator('[data-closure-availability]')).toContainText('Clôture en préparation');
  await expect(page.locator('[data-closure-local]')).toBeHidden();
});
test('sélection ITK préserve apparence et visiteur, modification depuis aperçu donne un échec précis', async ({ page }) => {
  const api = createExportAPI(); await api.install(page.context()); await page.goto(path); await stopOrdinarySync(page); const original = await seed(page);
  await preview(page, 'Paramètres ITK'); await page.locator('[data-erase-confirm]').click();
  await expect(page.locator('[data-erase-status]')).toContainText('Effacement local confirmé');
  const saved = await read(page, CACHES.settings, scope(accounts.A.id));
  expect(saved.values.itk).toBeNull(); expect(saved.values.appearance).toEqual(original.settings.values.appearance);
  await preview(page);
  await page.evaluate(async ({ key, name }) => {
    const req = indexedDB.open(name); const db = await new Promise(resolve => { req.onsuccess = () => resolve(req.result); });
    await new Promise(resolve => { const tx = db.transaction('accounts', 'readwrite'), store = tx.objectStore('accounts'), get = store.get(key);
      get.onsuccess = () => { const next = get.result; next.lastReconciledAt = '2026-10-27T15:00:00Z'; store.put(next, key); };
      tx.oncomplete = resolve; }); db.close();
  }, { key: scope(accounts.A.id), name: CACHES.courses });
  await page.locator('[data-erase-confirm]').click(); await expect(page.locator('[data-erase-status]')).toContainText('non confirmé');
  await expect(page.locator('[data-erase-results]')).toContainText('changé depuis');
  expect((await read(page, CACHES.courses, scope(accounts.A.id))).lastReconciledAt).toBe('2026-10-27T15:00:00Z');
  await captures(page, 'erreur');
});
test('mode visiteur : choix séparé de provenance, export facultatif puis retrait ciblé', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('bprea-demo-progress-v1', '{"test":{"done":false}}'); localStorage.setItem('bprea-demo-progress-provenance-v1', 'origine-fictive'); });
  await page.goto(path); await expect(page.locator('[data-erase-personal] input').first()).toBeDisabled();
  await page.locator('[data-export-sources] input[value="courses"]').check(); await page.locator('[data-export-confirm]').check();
  await page.getByRole('button', { name: 'Consulter la sélection locale', exact: true }).click();
  await expect(page.getByLabel('Contenu normalisé de la sélection locale', { exact: true })).toBeVisible();
  const download = page.waitForEvent('download'); await page.locator('[data-export-device]').click(); await download;
  await page.locator('[data-erase-visitor]').getByLabel('Cours et QCM', { exact: true }).check();
  await page.locator('[data-erase-preview]').click(); await page.locator('[data-erase-confirm]').click();
  await expect(page.locator('[data-erase-status]')).toContainText('Effacement local confirmé');
  expect(await page.evaluate(() => localStorage.getItem('bprea-demo-progress-v1'))).toBeNull();
  await expect(page.getByLabel('Contenu normalisé de la sélection locale', { exact: true })).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('bprea-demo-progress-provenance-v1'))).toBe('origine-fictive'); await captures(page, 'visiteur');
});
test('deux onglets : barrière persistée, export invalidé et retour réseau tardif sans résurrection locale', async ({ page, context }) => {
  const api = createExportAPI(); await api.install(context); await page.goto(path); await stopOrdinarySync(page); await seed(page);
  const second = await context.newPage(); await second.clock.install({ time: new Date('2026-10-27T12:00:00Z') });
  let entered, release; const reached = new Promise(resolve => { entered = resolve; }), gate = new Promise(resolve => { release = resolve; });
  api.hold = async name => { if (name === 'course_states') { entered(); await gate; } };
  await second.goto(path);
  await second.evaluate(async () => {
    const app = new URL(document.querySelector('script[type="module"][src]').src), url = new URL('./course-quiz-service.js', app); url.search = app.search;
    const service = await (await import(url)).getCourseQuizService(); window.erasurePendingSync = service.synchronize();
  });
  await reached;
  await page.locator('[data-export-prepare]').click(); // In-flight export must also be invalidated.
  await preview(page); await page.locator('[data-erase-confirm]').click();
  await expect(page.locator('[data-erase-status]')).toContainText('Effacement local confirmé');
  api.hold = null; release();
  await second.evaluate(() => window.erasurePendingSync);
  await expect(page.locator('[data-export-download]')).toBeDisabled();
  await expect.poll(() => read(second, CACHES.courses, scope(accounts.A.id))).toBeNull();
  await second.reload(); await expect(second.locator('[data-erase-personal] input').first()).toBeEnabled();
  expect(await read(second, CACHES.courses, scope(accounts.A.id))).toBeNull(); await second.close();
});
test('prototype de clôture HTTP simulé : réauthentification, confirmation, perte réseau et retry sans faux succès', async ({ page, context }) => {
  const origin = 'http://127.0.0.1:54321', api = createExportAPI({ origin, localClosure: true }); await api.install(context);
  let executions = 0;
  await context.route(`${origin}/functions/v1/close-account`, route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
    const body = route.request().postDataJSON();
    if (body.action === 'execute' && ++executions === 1) return route.abort('failed');
    return route.fulfill({ json: body.action === 'prepare' ? { status: 'identity_verified', receipt: 'opaque-synthetic-proof' } : { status: 'server_confirmed' }, headers: { 'access-control-allow-origin': '*' } });
  });
  await page.goto(path); await expect(page.locator('[data-closure-local]')).toBeVisible();
  await page.getByLabel('Mot de passe actuel', { exact: true }).fill('synthetic-password');
  await page.getByLabel('Écris SUPPRIMER pour confirmer', { exact: true }).fill('SUPPRIMER');
  await page.getByRole('button', { name: 'Vérifier mon identité pour clôturer', exact: true }).click();
  await expect(page.locator('[data-closure-execute]')).toBeFocused();
  await expect(page.getByLabel('Mot de passe actuel', { exact: true })).toHaveValue('');
  await page.locator('[data-closure-execute]').click(); await expect(page.locator('[data-closure-status]')).toContainText('n’est pas confirmée');
  await page.locator('[data-closure-retry]').click(); await expect(page.locator('[data-closure-status]')).toContainText('Suppression serveur confirmée');
  await expect(page.locator('[data-closure-status]')).toContainText('Nettoyage local non effectué'); expect(executions).toBe(2);
});
test('échec de stockage après une sélection mixte : résultat partiel et records personnels conservés', async ({ page }) => {
  const api = createExportAPI(); await api.install(page.context(), 'A', { 'bprea-demo-progress-v1': '{"visiteur":{"done":true}}' });
  await page.goto(path); await stopOrdinarySync(page); const original = await seed(page);
  await page.evaluate(() => { const original = IDBObjectStore.prototype.delete;
    IDBObjectStore.prototype.delete = function (key) { if (this.transaction.db.name === 'mon-bprea-course-quiz-personal-v1') throw new DOMException('fixture', 'UnknownError'); return original.call(this, key); }; });
  await page.locator('[data-erase-visitor]').getByLabel('Cours et QCM', { exact: true }).check();
  await preview(page); await page.locator('[data-erase-confirm]').click();
  await expect(page.locator('[data-erase-status]')).toContainText('Effacement local partiel');
  expect(await read(page, CACHES.courses, scope(accounts.A.id))).toEqual(original.a);
  expect(await read(page, CACHES.courses, scope(accounts.B.id))).toEqual(original.b);
  expect(await page.evaluate(() => localStorage.getItem('bprea-demo-progress-v1'))).toBeNull(); await captures(page, 'partiel');
});
test('session refusée après aperçu : cache intact et aucun fichier personnel remis', async ({ page }) => {
  const api = createExportAPI(); await api.install(page.context()); await page.goto(path); await stopOrdinarySync(page); const original = await seed(page);
  await preview(page); api.authOffline = true; await page.locator('[data-erase-confirm]').click();
  await expect(page.locator('[data-erase-status]')).toContainText('L’identité doit être vérifiée');
  expect(await read(page, CACHES.courses, scope(accounts.A.id))).toEqual(original.a);
  await expect(page.locator('[data-export-download]')).toBeDisabled();
});
