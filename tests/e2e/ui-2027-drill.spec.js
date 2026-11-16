import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { makeSeries, answerFor, bankQuestions } from '../fixtures/drill.js';
import { capture, textContrasts } from '../helpers/ui-review.js';
import { mountDrillState, personalDrill, emptyDrillView } from '../helpers/drill-ui-fixture.js';

const url = '/mon-bprea/drill.html?unit=uc3&week=2026-W47';
const key = 'bprea-demo-drill-v1';
const metric = (page, label) => page.locator('.drill-stats>div').filter({ has: page.locator('dt', { hasText: label }) }).locator('dd');
const open = async (page, target = url) => { await page.goto(target); await expect(page.locator('#drill-session-title')).toBeVisible(); await page.evaluate(() => document.fonts.ready); };
const start = async page => { await page.locator('[data-drill-start]').click(); await expect(page.locator('.drill-question')).toHaveCount(10); };
const saved = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
const seed = async (page, series) => page.addInitScript(({ key, series }) => { if (!sessionStorage.getItem('drill-seeded')) { localStorage.setItem(key, JSON.stringify({ version: 1, series: Object.fromEntries(series.map(item => [item.id, item])) })); sessionStorage.setItem('drill-seeded', 'yes'); } }, { key, series });
const emit = (page, snapshot) => page.evaluate(value => window.drillFixture.emit(value), snapshot);
async function choose(page, index, correct = true, training = false) {
  const article = page.locator('.drill-question').nth(index), form = article.locator(`form[data-training="${training}"]`);
  const id = await form.getAttribute('data-question');
  const q = bankQuestions().find(item => item.id === id);
  const value = correct ? q.answer : q.options.find(option => option.id !== q.answer).id;
  await form.locator(`input[value="${value}"]`).check(); return { article, form, q, value };
}
async function answer(page, index, correct = true, training = false) {
  const value = await choose(page, index, correct, training);
  await value.form.locator('button[type=submit]').click();
  await expect(value.article.locator('.drill-correction')).toBeFocused(); return value;
}
async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(page.viewportSize().width);
  const overflowing = await page.locator('.drill-cover,.drill-series-panel,.drill-question,.drill-training,.drill-stats>div,.drill-history-list a,.drill-unit-card').evaluateAll(nodes => nodes.filter(n => n.clientWidth && n.scrollWidth > n.clientWidth + 1).map(n => n.className));
  expect(overflowing).toEqual([]);
}
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-16T15:00:00Z') });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('bprea-demo-appearance-device-v1', JSON.stringify({ version: 1, season: 'autumn', brightness: 'light' })));
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.fallback() : route.abort());
});

test('Drill 2027 : UC, banque honnête, semaines, liens directs et retour navigateur', async ({ page }, info) => {
  await open(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Exercices hebdomadaires');
  await expect(page.locator('#drill-current-week')).toContainText('2026-W47');
  await expect(page.locator('#drill-current-week')).toContainText('16 au 22 novembre 2026');
  await expect(page.locator('#drill-current-week')).toContainText('Europe/Paris');
  await expect(metric(page, 'Taux de réussite')).toHaveText('Aucune donnée');
  await expect(page.locator('#drill-week-select option')).toHaveCount(9);
  await page.locator('.drill-unit-picker>summary').press('Enter');
  await expect(page.locator('.drill-unit-card')).toHaveCount(7);
  await expect(page.locator('.drill-unit-selected')).toContainText('UC 03');
  await expect(page.locator('.drill-unit-selected')).toContainText('12 questions disponibles');
  await capture(page.locator('.drill-overview'), 'drill-units-desktop.png', info);
  await page.locator('.drill-unit-card').first().click();
  await expect(page).toHaveURL(/unit=uc1&week=2026-W47/);
  await expect(page.locator('.drill-incomplete')).toContainText('BANQUE INCOMPLÈTE');
  await expect(page.locator('[data-drill-start]')).toHaveCount(0);
  await capture(page.locator('.drill-workspace'), 'drill-unavailable-desktop.png', info);
  await page.goBack(); await expect(page.locator('#drill-session-title')).toContainText('Conduire');
  await page.locator('#drill-week-select').selectOption('2026-W46');
  await expect(page).toHaveURL(/week=2026-W46/);
  await expect(page.locator('.drill-session-top')).toContainText('SEMAINE PRÉCÉDENTE');
  await start(page); const original = (await saved(page)).series['uc3__2026-W46'];
  await page.getByRole('link', { name: 'Ouvrir la semaine actuelle' }).click(); await start(page);
  await page.locator('#drill-week-select').selectOption('2026-W46');
  await expect(page).toHaveURL(/week=2026-W46/); await expect(page.locator('.drill-question')).toHaveCount(10);
  expect((await saved(page)).series['uc3__2026-W46']).toEqual(original);
  await open(page, url.replace('2026-W47', '2027-W01'));
  await expect(page.locator('#drill-week-select')).toHaveValue('2026-W47');
  await expect(page.locator('#drill-week-select option[value="2027-W01"]')).toHaveCount(0);
});

test('Drill 2027 : snapshot, brouillons, correction et score 3/4 sans compter les entraînements', async ({ page }, info) => {
  await open(page); await capture(page.locator('.drill-preview'), 'drill-preparation.png', info); await start(page);
  const initial = (await saved(page)).series['uc3__2026-W47'];
  expect(initial.questions).toHaveLength(10); expect(new Set(initial.questions.map(q => q.id)).size).toBe(10);
  await expect(page.locator('.drill-question h3').first()).toBeFocused();
  await expect(page.locator('.drill-question').first().getByRole('button', { name: 'Valider cette réponse' })).toBeDisabled();
  const first = await choose(page, 0);
  await expect(page.locator('#drill-save-status')).toContainText('Choix enregistré');
  await expect(metric(page, 'Exercices réalisés')).toHaveText('0 / 10');
  await expect(page.locator('.drill-correction')).toHaveCount(0);
  expect(Object.keys((await saved(page)).series[initial.id].answers)).toHaveLength(0);
  await capture(first.article, 'drill-selected.png', info);
  await page.reload(); await expect(page.locator('.drill-question').first().locator(`input[value="${first.value}"]`)).toBeChecked();
  await page.locator('.drill-question').first().getByRole('button', { name: 'Valider cette réponse', exact: true }).click();
  await expect(page.locator('.drill-correction').first()).toBeFocused();
  await expect(page.locator('.drill-correction').first()).toContainText(first.q.explanation);
  await expect(page.locator('.drill-correction').first().getByRole('link')).toHaveAttribute('href', first.q.reference.url);
  await expect(page.locator('.drill-question').first().getByRole('radio')).toHaveCount(0);
  await capture(page.locator('.drill-question').first(), 'drill-correct.png', info);
  await answer(page, 1); await answer(page, 2); const fourth = await answer(page, 3, false);
  await expect(fourth.article.locator('.drill-correction')).toContainText('Réponse attendue');
  await expect(fourth.article.locator('.drill-correction')).toContainText(fourth.q.options.find(o => o.id === fourth.q.answer).text);
  await capture(fourth.article, 'drill-incorrect.png', info);
  const counted = (await saved(page)).series[initial.id].answers[first.q.id];
  await page.locator('.drill-question').first().getByRole('button', { name: 'Revoir cette question' }).click();
  await expect(page.locator('.drill-training')).toContainText('Cet entraînement ne change pas ton résultat initial.');
  await choose(page, 0, false, true); await expect(page.locator('#drill-save-status')).toContainText('Choix enregistré');
  await capture(page.locator('.drill-question').first(), 'drill-training.png', info);
  await page.reload(); await expect(page.locator('form[data-training="true"] input:checked')).toHaveCount(1);
  await answer(page, 0, false, true);
  await page.clock.runFor(1000);
  await page.locator('.drill-question').first().getByRole('button', { name: 'Revoir cette question' }).click(); await answer(page, 0, true, true);
  const result = (await saved(page)).series[initial.id];
  expect(result.questions).toEqual(initial.questions);
  expect({ ...result.answers[first.q.id], attempts: counted.attempts }).toEqual(counted);
  expect(result.answers[first.q.id].attempts.filter(a => a.training)).toHaveLength(2);
  await expect(metric(page, 'Exercices réalisés')).toHaveText('4 / 10');
  await expect(metric(page, 'Bonnes réponses')).toHaveText('3'); await expect(metric(page, 'Mauvaises réponses')).toHaveText('1');
  await expect(metric(page, 'Taux de réussite')).toHaveText('75 %'); await expect(page.locator('#drill-progress')).toHaveAttribute('value', '4');
  await expect(page.locator('.drill-progress')).toContainText('2 entraînements supplémentaires');
  await expect(page.locator('.drill-training-last')).toContainText('bonne réponse');
  await page.route('**/assets/drill-bank.json*', route => route.fulfill({ json: { version: 1, questions: bankQuestions().map(q => ({ ...q, version: 2, prompt: 'Banque modifiée pour le test' })) } }));
  await page.reload(); await expect(page.locator('.drill-question').first().locator('h3')).toHaveText(initial.questions[0].prompt);
  expect((await saved(page)).series[initial.id].questions).toEqual(initial.questions);
});

test('Drill 2027 : historique intégral, série terminée, nouvelle semaine sans blocage', async ({ page }, info) => {
  const old = makeSeries({ week: '2025-W02', startedAt: '2025-01-07T08:00:00Z' });
  for (const q of old.questions) old.answers[q.id] = answerFor(q, { answeredAt: '2025-01-07T09:00:00Z' });
  const incomplete = makeSeries({ week: '2026-W46' }); incomplete.answers[incomplete.questions[0].id] = answerFor(incomplete.questions[0]);
  await seed(page, [old, incomplete]); await open(page);
  await expect(page.locator('#drill-week-select option[value="2025-W02"]')).toHaveCount(1);
  await expect(page.locator('.drill-history-list li')).toHaveCount(2);
  await capture(page.locator('.drill-history'), 'drill-history-desktop.png', info);
  await page.getByRole('link', { name: /2025-W02.*Consulter les corrections/ }).click();
  await expect(page.locator('.drill-correction')).toHaveCount(10); await expect(metric(page, 'Taux de réussite')).toHaveText('100 %');
  await page.locator('#drill-week-select').selectOption('2026-W47'); await start(page);
  expect((await saved(page)).series[old.id]).toEqual(old); expect((await saved(page)).series[incomplete.id]).toEqual(incomplete);
});

test('Drill 2027 : lundi Paris indépendant du fuseau de l’appareil', async ({ browser }) => {
  const context = await browser.newContext({ timezoneId: 'America/Los_Angeles' });
  try {
    const page = await context.newPage(); await page.clock.install({ time: new Date('2026-11-15T22:59:59Z') });
    await open(page, url.replace('2026-W47', '2026-W46')); await start(page);
    const before = await saved(page); await page.clock.runFor(1200);
    await expect(page.locator('#drill-current-week')).toContainText('2026-W47');
    await expect(page.locator('#drill-week-select')).toHaveValue('2026-W46');
    await expect(page.locator('#drill-week-notice')).toContainText('semaine précédente');
    expect(await saved(page)).toEqual(before);
  } finally { await context.close(); }
});

test('Drill 2027 : banque indisponible, reprise et snapshot utilisable sans banque', async ({ page }, info) => {
  let unavailable = true;
  await page.route('**/assets/drill-bank.json*', route => unavailable ? route.fulfill({ status: 503, body: 'Unavailable' }) : route.fallback());
  await open(page); await expect(page.locator('.drill-incomplete')).toContainText('BANQUE INDISPONIBLE');
  await page.getByRole('button', { name: 'Réessayer le chargement' }).click();
  await expect(page.getByRole('button', { name: 'Réessayer le chargement' })).toBeEnabled();
  await page.locator('.drill-unit-picker>summary').click(); await expect(page.locator('.drill-unit-card').first()).toContainText('Banque indisponible');
  unavailable = false; await page.getByRole('button', { name: 'Réessayer le chargement' }).click(); await start(page);
  const snapshot = (await saved(page)).series['uc3__2026-W47'].questions;
  unavailable = true; await page.reload(); await expect(page.locator('.drill-question')).toHaveCount(10);
  await expect(page.locator('#drill-notices')).toContainText('questions sauvegardées');
  expect((await saved(page)).series['uc3__2026-W47'].questions).toEqual(snapshot);
  await capture(page.locator('.drill-series-panel'), 'drill-bank-error.png', info);
});

test('Drill 2027 : erreurs de stockage, choix conservé et retry sans faux succès', async ({ page }, info) => {
  await open(page);
  await page.evaluate(() => { const original = Storage.prototype.setItem; window.failDrillWrite = true; Storage.prototype.setItem = function(k, v) { if (k === 'bprea-demo-drill-v1' && window.failDrillWrite) throw new DOMException('Full', 'QuotaExceededError'); return original.call(this, k, v); }; });
  await page.locator('[data-drill-start]').click();
  await expect(page.locator('#drill-save-error')).not.toBeEmpty(); await expect(page.locator('.drill-question')).toHaveCount(0);
  expect(await saved(page)).toBeNull(); await expect(page.locator('#drill-save-status')).toBeEmpty();
  await page.evaluate(() => window.failDrillWrite = false); await start(page);
  await choose(page, 0); await expect(page.locator('#drill-save-status')).toContainText('Choix enregistré');
  await page.evaluate(() => window.failDrillWrite = true);
  const first = await choose(page, 0, false); await expect(page.locator('#drill-save-error')).not.toBeEmpty();
  await first.form.locator('button[type=submit]').click(); await expect(page.locator('#drill-save-error')).not.toBeEmpty();
  await expect(first.article.locator('.drill-answer-error')).toBeVisible();
  await expect(first.form.locator(`input[value="${first.value}"]`)).toBeChecked(); await expect(page.locator('.drill-correction')).toHaveCount(0);
  await capture(page.locator('.drill-series-panel'), 'drill-save-error.png', info);
  await page.evaluate(() => window.failDrillWrite = false); await first.form.locator('button[type=submit]').click();
  await expect(first.article.locator('.drill-correction')).toBeFocused();
  expect(Object.keys((await saved(page)).series['uc3__2026-W47'].answers)).toHaveLength(1);
});

test('Drill 2027 : progression illisible ne devient ni zéro ni historique vide', async ({ page }) => {
  await page.addInitScript(key => localStorage.setItem(key, '{invalid'), key); await open(page);
  await expect(page.locator('#drill-summary')).toContainText('Données de progression indisponibles');
  await expect(page.locator('.drill-stats')).toHaveCount(0); await expect(page.locator('[data-drill-start]')).toBeDisabled();
  await expect(page.locator('#drill-history-content')).toContainText('Historique indisponible');
  await page.locator('.drill-unit-picker>summary').click();
  await expect(page.locator('.drill-unit-selected')).toContainText('Données de progression indisponibles');
  await expect(page.locator('.drill-unit-selected')).not.toContainText('0 / 10 réalisés');
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe('{invalid');
});

test('Drill 2027 : DOM, focus et lecture stables pendant brouillon, sync et validation retardée', async ({ page }) => {
  const series = makeSeries({ week: '2026-W47' }); await mountDrillState(page, personalDrill([series], { state: 'pending' })); await open(page);
  await page.evaluate(() => window.drillFixture.hold = 'saveDraft');
  const selected = await choose(page, 4); const button = selected.form.locator('button'); await button.focus();
  await page.evaluate(() => { window.originalRadio = document.activeElement.closest('form').querySelector('input:checked'); window.originalQuestion = document.querySelector('#drill-question-4'); });
  const position = await page.evaluate(() => scrollY);
  await page.evaluate(() => { window.drillFixture.hold = null; window.drillFixture.release(); });
  await expect(page.locator('#drill-save-status')).toContainText('Choix enregistré'); await expect(button).toBeFocused();
  expect(await page.evaluate(() => window.originalRadio.isConnected && window.originalQuestion === document.querySelector('#drill-question-4'))).toBe(true);
  expect(Math.abs(await page.evaluate(() => scrollY) - position)).toBeLessThanOrEqual(2);
  const readingTop = await selected.article.evaluate(node => node.getBoundingClientRect().top);
  await page.evaluate(() => window.drillFixture.emit({ ...window.drillFixture.state, sync: { ...window.drillFixture.state.sync, state: 'syncing' } })); await expect(button).toBeFocused();
  // Native scroll anchoring may adjust scrollY when an offscreen retry disappears.
  // The question's viewport position must stay fixed; no scripted scroll compensation.
  expect(Math.abs(await selected.article.evaluate(node => node.getBoundingClientRect().top) - readingTop)).toBeLessThanOrEqual(2);
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
  // Re-select after the synthetic external view, then hold the real presentation action.
  await choose(page, 4); await page.evaluate(() => window.drillFixture.hold = 'submitAnswer');
  await selected.form.locator('button').press('Enter');
  await expect(selected.form).toHaveAttribute('aria-busy', 'true');
  await expect(selected.form.locator('button')).toBeDisabled();
  await selected.form.evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(await page.evaluate(() => window.drillFixture.calls.filter(c => c.action === 'submitAnswer').length)).toBe(1);
  const before = await page.evaluate(() => scrollY);
  await page.evaluate(() => { window.drillFixture.hold = null; window.drillFixture.release(); });
  await expect(selected.article.locator('.drill-correction')).toBeFocused();
  expect(Math.abs(await page.evaluate(() => scrollY) - before)).toBeLessThanOrEqual(2);
  await page.locator('.drill-unit-picker>summary').click();
  const unitLink = page.locator('.drill-unit-card').nth(1); await unitLink.focus();
  await page.evaluate(() => {
    const snapshot = structuredClone(window.drillFixture.state), series = Object.values(snapshot.view.series)[0];
    const question = series.questions[0], response = { answer: question.answer, correct: true, answeredAt: '2026-11-16T15:00:00Z' };
    series.answers[question.id] = { ...response, attempts: [{ ...response, training: false }] }; window.drillFixture.emit(snapshot);
  });
  await expect(unitLink).toBeFocused(); await expect(page.locator('.drill-unit-picker')).toHaveAttribute('open', '');
});

test('Drill 2027 : sync honnête, conflits volontaires et archives ouvertes conservées', async ({ page }, info) => {
  const series = makeSeries({ week: '2026-W47' }); series.answers[series.questions[0].id] = answerFor(series.questions[0]);
  await mountDrillState(page, personalDrill([series], { state: 'pending' })); await open(page);
  await expect(page.locator('#drill-sync-status')).toContainText('synchronisation en attente');
  await expect(page.locator('#drill-sync-status')).not.toHaveText('Synchronisé');
  await capture(page.locator('.drill-series-panel'), 'drill-sync-pending.png', info);
  for (const state of ['loading', 'local', 'syncing', 'offline', 'error', 'synced']) { await emit(page, personalDrill([series], { state })); await expect(metric(page, 'Exercices réalisés')).toHaveText('1 / 10'); }
  await emit(page, personalDrill([series], { state: 'error' })); await page.evaluate(() => window.drillFixture.fail = 'retry');
  await page.locator('[data-drill-sync-retry]').click(); await expect(page.locator('#drill-save-error')).toContainText('conservées');
  await page.evaluate(() => window.drillFixture.fail = null); await page.locator('[data-drill-sync-retry]').click();
  const conflicts = [{ id: 'snapshot-test', kind: 'snapshot', seriesKey: series.id, local: series, remoteSeries: { ...series, questions: series.questions.map(q => ({ ...q, prompt: 'Snapshot du compte' })) }, resolved: false },
    { id: 'answer-test', kind: 'answer', seriesKey: series.id, localChoice: 'Choix local', remoteChoice: 'Choix du compte', local: { answer: 'a' }, resolved: false },
    { id: 'identity-test', kind: 'identity', seriesKey: series.id, resolved: false }];
  conflicts.push({ ...conflicts[0], id: 'snapshot-previous', seriesKey: 'uc3__2026-W46', resolved: true });
  await emit(page, personalDrill([series], { state: 'conflict', conflicts }));
  const first = page.locator('.drill-sync-conflict').first(); await first.locator('>summary').click();
  await first.getByText('Série conservée sur cet appareil', { exact: true }).click();
  await emit(page, personalDrill([series], { state: 'conflict', conflicts, error: 'Nouvelle vérification simulée' }));
  await expect(first).toHaveAttribute('open', ''); await expect(first.locator('details').first()).toHaveAttribute('open', '');
  await expect(first.locator('details').first().locator('>summary')).toBeFocused();
  const previous = page.locator('.drill-sync-conflict').nth(3); await previous.locator('>summary').click();
  await emit(page, personalDrill([series], { state: 'conflict', conflicts }));
  await expect(previous.locator('details').first()).not.toHaveAttribute('open', '');
  await capture(page.locator('.drill-sync-panel'), 'drill-conflict.png', info);
  await first.getByRole('button', { name: 'Reprendre la série du compte' }).click();
  await expect(first).toContainText('Conflit conservé en archive'); await expect(first).toHaveAttribute('open', '');
  const second = page.locator('.drill-sync-conflict').nth(1); await second.locator('>summary').click();
  await expect(second).toContainText('Choix local'); await expect(second).toContainText('Choix du compte');
  await second.getByRole('button', { name: 'Continuer avec la réponse du compte' }).click();
  await expect(second).toContainText('Conflit conservé en archive');
  await expect(page.locator('.drill-sync-conflict').nth(2).locator('button')).toHaveCount(0);
  expect(await page.evaluate(() => window.drillFixture.calls.filter(c => c.action === 'resolve').map(c => c.id))).toEqual(['snapshot-test', 'answer-test']);
  const winner = makeSeries({ week: '2026-W47', questions: series.questions.map(q => ({ ...q, id: `revision-${q.id}`, version: 2, prompt: `Version du compte : ${q.prompt}` })) });
  await emit(page, personalDrill([winner]));
  await expect(page.locator('.drill-question')).toHaveCount(10);
  await expect(page.locator(`[data-drill-question-id="${series.questions[0].id}"]`)).toHaveCount(0);
  await expect(page.locator('.drill-question h3').first()).toContainText('Version du compte');
});

test('Drill 2027 : A, déconnexion, B et retour tardif ne réaffichent aucune donnée de A', async ({ page }) => {
  const a = makeSeries({ week: '2026-W47' }); a.questions[0].prompt = 'ÉNONCÉ PRIVÉ DE A';
  const b = makeSeries({ week: '2026-W47' }); b.questions[0].prompt = 'ÉNONCÉ PRIVÉ DE B';
  await mountDrillState(page, personalDrill([a])); await open(page);
  await page.evaluate(() => window.drillFixture.hold = 'submitAnswer');
  await aRadio(page); await page.locator('.drill-question').first().locator('button[type=submit]').click();
  await emit(page, { mode: 'visitor', scope: null, view: emptyDrillView(), sync: { state: 'visitor', pending: 0, error: null, conflicts: [], operations: [] } });
  await expect(page.locator('main')).not.toContainText('ÉNONCÉ PRIVÉ DE A'); await expect(page.locator('main')).toContainText('Mode visiteur');
  await emit(page, personalDrill([b], { account: 'B', state: 'offline' }));
  await expect(page.locator('main')).toContainText('ÉNONCÉ PRIVÉ DE B');
  await page.evaluate(() => { window.drillFixture.hold = null; window.drillFixture.release(); });
  await expect(page.locator('main')).not.toContainText('ÉNONCÉ PRIVÉ DE A'); await expect(page.locator('.drill-correction')).toHaveCount(0);
  await expect(page.locator('#drill-save-status')).toBeEmpty();
  await emit(page, personalDrill([b], { account: 'B', state: 'session' }));
  await expect(page.locator('main')).not.toContainText('ÉNONCÉ PRIVÉ DE B'); await expect(page.locator('#drill-summary')).toContainText('indisponibles');
  await emit(page, personalDrill([b], { account: 'B' })); await expect(page.locator('main')).toContainText('ÉNONCÉ PRIVÉ DE B');
  // Same UUID returning after an intermediate identity still invalidates the old UI epoch.
  await page.evaluate(() => window.drillFixture.hold = 'saveDraft'); await aRadio(page);
  await emit(page, personalDrill([], { account: 'A' })); await emit(page, personalDrill([b], { account: 'B' }));
  await page.evaluate(() => { window.drillFixture.hold = null; window.drillFixture.release(); });
  await expect(page.locator('#drill-save-status')).toBeEmpty();
});
async function aRadio(page) { await page.locator('.drill-question').first().getByRole('radio').first().check(); }

test('Drill 2027 : cache personnel inaccessible et échecs locaux ne créent aucun faux résultat', async ({ page }, info) => {
  const snapshot = personalDrill([], { state: 'storage-error', error: 'Cache personnel inaccessible' }); snapshot.view.error = 'Cache personnel inaccessible';
  await mountDrillState(page, snapshot); await open(page);
  await expect(page.locator('#drill-summary')).toContainText('indisponibles'); await expect(page.locator('.drill-stats')).toHaveCount(0);
  await expect(page.locator('[data-drill-start]')).toBeDisabled(); await expect(page.locator('#drill-sync-status')).toHaveText('Cache personnel inaccessible');
  await capture(page.locator('.drill-series-panel'), 'drill-cache-error.png', info);
  await emit(page, personalDrill([])); await page.evaluate(() => window.drillFixture.fail = 'ensureSeries');
  await page.locator('[data-drill-start]').click(); await expect(page.locator('#drill-save-error')).toContainText('Échec');
  await expect(page.locator('.drill-question')).toHaveCount(0);
  await page.evaluate(() => window.drillFixture.fail = null); await start(page);
  await page.evaluate(() => window.drillFixture.fail = 'saveDraft'); await aRadio(page);
  await expect(page.locator('.drill-question').first().locator('.drill-answer-error')).toBeVisible();
  await expect(page.locator('.drill-question').first().getByRole('radio').first()).toBeChecked();
  await expect(metric(page, 'Exercices réalisés')).toHaveText('0 / 10');
  expect(await page.evaluate(() => window.drillFixture.calls.some(call => call.action === 'submitAnswer'))).toBe(false);
});

test('Drill 2027 : un démarrage tardif de A ne confirme pas une série chez B', async ({ page }) => {
  await mountDrillState(page, personalDrill([])); await open(page);
  await page.evaluate(() => window.drillFixture.hold = 'ensureSeries'); await page.locator('[data-drill-start]').click();
  await expect(page.locator('[data-drill-start]')).toBeDisabled();
  await emit(page, personalDrill([], { account: 'B' }));
  await page.evaluate(() => { window.drillFixture.hold = null; window.drillFixture.release(); });
  await expect(page.locator('.drill-question')).toHaveCount(0); await expect(page.locator('#drill-save-status')).toBeEmpty();
  await expect(page.locator('[data-drill-start]')).toBeEnabled();
});

test('Drill 2027 : clavier, contrastes, thèmes et adaptations de préférences', async ({ page, browser }, info) => {
  await open(page); await start(page); const report = [];
  const first = page.locator('.drill-question').first(); await first.getByRole('radio').first().focus(); await page.keyboard.press('ArrowDown');
  await expect(first.getByRole('radio').nth(1)).toBeChecked();
  await expect(first.locator('fieldset')).toHaveAccessibleName(/Choisis une seule réponse/);
  expect(await first.locator('.option').nth(1).evaluate(n => getComputedStyle(n).outlineStyle)).toBe('solid');
  await page.keyboard.press('Tab'); await expect(first.locator('button[type=submit]')).toBeFocused();
  for (const season of ['spring','summer','autumn','winter']) for (const theme of ['light','dark']) {
    await page.evaluate(({ season, theme }) => { document.documentElement.dataset.season = season; document.documentElement.dataset.theme = theme; }, { season, theme });
    const rows = await textContrasts(page.locator('.drill-cover :is(h1,h2,p),.drill-session-top :is(h2,p,label),.drill-stats :is(dt,dd),.drill-question :is(h3,legend,.option-copy,.option-letter,.drill-question-note,.btn)'));
    for (const row of rows) expect(row.ratio, `${season}/${theme}: ${row.text}`).toBeGreaterThanOrEqual(4.5);
    await first.locator('.option').evaluateAll(nodes => nodes.forEach(node => {
      const style = getComputedStyle(node);
      for (const [kind, color] of [['border', style.borderTopColor], ['focus', style.getPropertyValue('--color-focus')]]) {
        const probe = document.createElement('span'); probe.dataset.drillContrast = kind; probe.textContent = kind;
        probe.style.cssText = `position:absolute;width:1px;height:1px;color:${color}`; node.append(probe);
      }
    }));
    const controls = await textContrasts(first.locator('[data-drill-contrast]'));
    for (const control of controls) expect(control.ratio, `${season}/${theme}/${control.text}`).toBeGreaterThanOrEqual(3);
    await first.locator('[data-drill-contrast]').evaluateAll(nodes => nodes.forEach(node => node.remove()));
    report.push({ season, theme, minimum: Math.min(...rows.map(row => row.ratio)), controls });
  }
  await answer(page, 0); await answer(page, 1, false);
  for (const season of ['spring','summer','autumn','winter']) for (const theme of ['light','dark']) {
    await page.evaluate(({ season, theme }) => { document.documentElement.dataset.season = season; document.documentElement.dataset.theme = theme; }, { season, theme });
    const rows = await textContrasts(page.locator('.drill-correction :is(h4,p,a,strong)'));
    for (const row of rows) expect(row.ratio, `correction ${season}/${theme}: ${row.text}`).toBeGreaterThanOrEqual(4.5);
    report.push({ season, theme, correctionMinimum: Math.min(...rows.map(row => row.ratio)) });
  }
  const unanswered = page.locator('.drill-question').nth(2);
  await page.emulateMedia({ forcedColors: 'active' }); await unanswered.getByRole('radio').first().check(); await capture(unanswered, 'drill-forced-colors.png', info);
  await page.emulateMedia({ forcedColors: 'none' }); await page.addStyleTag({ content: '*,*::before,*::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}' });
  expect(await unanswered.locator('.option').first().evaluate(n => getComputedStyle(n).transitionDuration)).toBe('0s');
  const target = info.outputPath('drill-contrasts.json'); await writeFile(target, JSON.stringify(report, null, 2)); await info.attach('drill-contrasts', { path: target, contentType: 'application/json' });
  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, timezoneId: 'Europe/Paris', locale: 'fr-FR' });
  try {
    const phone = await touchContext.newPage(); await phone.clock.install({ time: new Date('2026-11-16T15:00:00Z') });
    await touchContext.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    await open(phone); await phone.locator('.drill-unit-picker>summary').tap(); await phone.locator('.drill-unit-selected').tap();
    await phone.locator('[data-drill-start]').tap(); await expect(phone.locator('.drill-question')).toHaveCount(10);
    const question = phone.locator('.drill-question').first();
    await question.locator('.option').last().tap({ position: { x: 5, y: 10 } }); await expect(question.getByRole('radio').last()).toBeChecked();
    await question.locator('button[type=submit]').tap(); await expect(question.locator('.drill-correction')).toBeFocused();
    await noOverflow(phone); await capture(question, 'drill-touch.png', info);
  } finally { await touchContext.close(); }
});

test('Drill 2027 : reflow 320–1440, texte 200 %, propositions longues et corrections', async ({ page }, info) => {
  const series = makeSeries({ week: '2026-W47' });
  series.questions[0].prompt = 'Un énoncé de contrôle particulièrement long pour vérifier la lecture dans toutes les tailles de fenêtre. '.repeat(3);
  series.questions[0].options[0].text = 'Une proposition longue avec un identifiant sans espace ' + 'Agronomie'.repeat(20);
  series.answers[series.questions[1].id] = answerFor(series.questions[1], { correct: false });
  await seed(page, [series]); await open(page);
  for (const zoom of [100, 200]) {
    await page.addStyleTag({ content: `html{font-size:${zoom}%!important}` });
    for (const width of [320,390,768,1024,1440]) {
      await page.addStyleTag({ content: `html{font-size:${zoom}%!important}` });
      await page.setViewportSize({ width, height: 1000 }); await noOverflow(page);
      await page.locator('.drill-unit-picker>summary').click(); await noOverflow(page); await page.locator('.drill-unit-picker>summary').click();
      await page.locator('.drill-question').nth(1).getByRole('button', { name: 'Revoir cette question' }).click(); await noOverflow(page);
      expect(await page.locator('.drill-question .option').first().evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
      const narrowOptions = await page.locator('.drill-question .option-copy').evaluateAll(nodes => nodes.filter(node => node.getBoundingClientRect().width < 120).map(node => node.textContent));
      expect(narrowOptions, 'Les choix gardent une colonne de lecture à 200 %, même dans l’entraînement.').toEqual([]);
      if (width === 1024 && zoom === 200) for (const font of ['system-ui','Arial','sans-serif','Tahoma']) { await page.addStyleTag({ content: `body{font-family:${font}!important}` }); await noOverflow(page); }
      if (width === 320 && zoom === 200) await capture(page.locator('.drill-question').nth(1), 'drill-reflow-200.png', info);
      await page.reload(); await expect(page.locator('.drill-question')).toHaveCount(10);
    }
  }
});

test('Drill 2027 : galerie desktop/mobile, correction, entraînement et historique', async ({ page }, info) => {
  const names = [];
  const shot = async (name, target = page) => { await capture(target, name, info); names.push(name); };
  for (const width of [1440,390]) {
    if (width === 390) await page.evaluate(key => localStorage.removeItem(key), key);
    await page.setViewportSize({ width, height: 1000 }); await open(page);
    if (await page.locator('[data-drill-start]').count()) { await shot(`drill-blank-${width}.png`); await start(page); }
    await shot(`drill-started-${width}.png`);
    await page.locator('.drill-unit-picker>summary').click(); await shot(`drill-uc-${width}.png`, page.locator('.drill-overview')); await page.locator('.drill-unit-picker>summary').click();
    await answer(page, 0); await answer(page, 1, false);
    await shot(`drill-question-${width}.png`, page.locator('.drill-question').nth(2));
    await shot(`drill-correction-${width}.png`, page.locator('.drill-question').first());
    await page.locator('.drill-question').first().getByRole('button', { name: 'Revoir cette question' }).click();
    await shot(`drill-training-${width}.png`, page.locator('.drill-question').first());
    await shot(`drill-history-${width}.png`, page.locator('.drill-history'));
    await page.locator('#theme-toggle').click(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark'); await shot(`drill-dark-${width}.png`);
    await page.evaluate(() => document.documentElement.dataset.season = 'winter'); await shot(`drill-winter-${width}.png`);
  }
  const path = info.outputPath('revue-drill.html');
  await writeFile(path, `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Drill 2027 · revue</title><style>body{font:16px/1.7 system-ui;background:#faf7f0;margin:24px}img{max-width:100%;height:auto}figure{margin:24px 0}a{color:#753d2c}</style><h1>Drill 2027 · états à valider</h1><p>Captures déterministes, données synthétiques, aucune référence approuvée automatiquement.</p>${names.map(name => `<figure><figcaption>${name}</figcaption><a href="${name}"><img loading="lazy" src="${name}" alt="${name}"></a></figure>`).join('')}</html>`);
  await info.attach('revue-drill', { path, contentType: 'text/html' });
});
