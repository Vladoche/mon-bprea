import { test, expect } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import { createExportAPI, accounts } from './export-api.js';
import { CACHES } from '../../assets/export-sources.js';
import { emptyPersonalDocument as drillDocument, personalChange } from '../../assets/drill-personal-store.js';
import { emptyPersonalDocument as courseDocument, mutateCourse } from '../../assets/course-quiz-model.js';
import { emptyPersonalDocument as plantDocument, recordPersonalSession, recordPersonalAnswer } from '../../assets/botanical-sync-model.js';
import { emptySettingsDocument, queueSettings } from '../../assets/settings-model.js';
import { questions, stamp, uuid, parameters } from '../fixtures/export.js';
import { botanicalSession, botanicalAnswer } from '../fixtures/personal-data.js';
import { stopOrdinarySync } from '../helpers/export-browser.js';
const path = '/mon-bprea/profil.html';
test.use({ trace: 'off', screenshot: 'off', video: 'off' });
test.beforeEach(async ({ page }) => { await page.clock.install({ time: new Date('2026-10-27T12:00:00Z') }); });
async function parseDownload(download) { return JSON.parse(await readFile(await download.path(), 'utf8')); }
async function captures(page, name) {
  await mkdir('.tmp/export-visual', { recursive: true });
  await page.evaluate(() => document.activeElement?.blur());
  for (const width of [1280, 390]) for (const brightness of ['light', 'dark']) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(value => window.BpreaAppearance.applyPreferences({ version: 1, season: 'auto', brightness: value }), brightness);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('.data-export').screenshot({ path: `.tmp/export-visual/${name}-${width}-${brightness}.png`, animations: 'disabled' });
  }
}
async function prepare(page) { await page.getByRole('button', { name: 'Préparer les données du compte', exact: true }).click(); }
async function download(page) {
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Télécharger la copie partielle du compte (JSON)', exact: true }).click();
  return parseDownload(await pending);
}
async function switchAccount(page, name) {
  await page.evaluate(async ({ id, email }) => {
    const app = new URL(document.querySelector('script[type="module"][src]').src), url = new URL('./auth-service.js', app); url.search = app.search;
    const auth = await (await import(url)).getAuthService(); await auth.signOut(); await auth.signIn(email, 'synthetic-test-password');
    if (auth.getState().user?.id !== id) throw new Error('Identité fictive incorrecte');
  }, accounts[name]);
}
test('copie réelle JSON téléchargée : dix tables, 205 tentatives, secrets exclus et clavier/mobile', async ({ page }) => {
  const api = createExportAPI(); await api.install(page.context()); await page.goto(path);
  await prepare(page); await expect(page.locator('[data-export-status]')).toContainText('Copie prête');
  await captures(page, 'pret');
  const file = await download(page);
  expect(Object.keys(file.data.server)).toHaveLength(10); expect(file.data.server.quiz_attempts).toHaveLength(205);
  expect(file.data.server.course_states[0].done).toBe(false); expect(file.data.server.botanical_answers[0].selected_species_id).toBeNull();
  expect(file.data.server.appearance_preferences[0].season).toBe('auto'); expect(file.data.identity.id).toBe(accounts.A.id);
  const text = JSON.stringify(file); for (const forbidden of ['MUST_NEVER_EXPORT', 'access_token', 'refresh_token', accounts.B.id]) expect(text.includes(forbidden)).toBe(false);
  expect(api.writes).toEqual([]);
});
test('réponse A tardive, bascule B puis retour A : aucun ancien téléchargement autorisé', async ({ page }) => {
  const api = createExportAPI(); await api.install(page.context()); await page.goto(path);
  let release, entered; const waiting = new Promise(resolve => { release = resolve; }), reached = new Promise(resolve => { entered = resolve; });
  api.hold = async table => { if (table === 'drill_series') { entered(); await waiting; } };
  await prepare(page); await reached; await captures(page, 'preparation'); await switchAccount(page, 'B'); release(); api.hold = null;
  await expect(page.locator('[data-export-download]')).toBeDisabled(); await prepare(page);
  await expect(page.locator('[data-export-status]')).toContainText('Copie prête');
  const file = await download(page); expect(file.sourceScope.userId).toBe(accounts.B.id); expect(JSON.stringify(file).includes(accounts.A.id)).toBe(false);
  await switchAccount(page, 'A'); await prepare(page); await expect(page.locator('[data-export-status]')).toContainText('Copie prête');
  expect((await download(page)).sourceScope.userId).toBe(accounts.A.id);
});
test('erreur de page tardive, nouvelle tentative, annulation et refus Auth au téléchargement', async ({ page }) => {
  const api = createExportAPI(); await api.install(page.context()); await page.goto(path); api.failLast = true;
  await prepare(page); await expect(page.locator('[data-export-status]')).toContainText('Export incomplet'); await expect(page.locator('[data-export-download]')).toBeDisabled();
  await captures(page, 'incomplet');
  api.failLast = false; await prepare(page); await expect(page.locator('[data-export-status]')).toContainText('Copie prête');
  await page.locator('[data-export-cancel]').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('[data-export-prepare]')).toBeFocused(); await expect(page.locator('[data-export-download]')).toBeDisabled();
  await captures(page, 'annule');
  await prepare(page); await expect(page.locator('[data-export-status]')).toContainText('Copie prête'); api.authOffline = true;
  await page.locator('[data-export-download]').click(); await expect(page.locator('[data-export-status]')).toContainText('Reconnexion nécessaire');
  await captures(page, 'session');
});
test('visiteur : sélection locale explicite, raw étranger exclu et sauvegarde intacte', async ({ page }) => {
  const raw = JSON.stringify({ lesson: { done: false, score: 0, quizScoreArchive: ['FOREIGN_PRIVATE'] } });
  const api = createExportAPI(); await api.install(page.context(), null, { 'bprea-demo-progress-v1': raw }); await page.goto(path);
  await expect(page.locator('[data-export-prepare]')).toBeDisabled(); await expect(page.locator('[data-export-device]')).toBeDisabled();
  await page.locator('[data-export-sources] input[value=courses]').check(); await page.locator('[data-export-confirm]').check();
  await page.getByRole('button', { name: 'Consulter la sélection locale', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Données locales de cet appareil' }).locator('pre')).toContainText('"done": false');
  await captures(page, 'visiteur');
  const pending = page.waitForEvent('download'); await page.locator('[data-export-device]').click(); const file = await parseDownload(await pending);
  expect(file.sourceScope).toEqual({ kind: 'device', ownership: 'unverified' }); expect(file.status).toBe('partial');
  expect(file.data.courses.lesson.done).toBe(false); expect(JSON.stringify(file)).not.toContain('FOREIGN_PRIVATE');
  expect(await page.evaluate(() => localStorage.getItem('bprea-demo-progress-v1'))).toBe(raw);
});
test('quatre caches personnels, opérations et archives : couverture limitée honnête, sources A/B intactes', async ({ page }) => {
  const api = createExportAPI(); await api.install(page.context()); await page.goto(path);
  await expect(page.locator('[data-export-prepare]')).toBeEnabled();
  await stopOrdinarySync(page);
  const scope = JSON.stringify(['development', 'https://export.invalid', accounts.A.id]);
  const docs = { drill: drillDocument(scope), courses: courseDocument(scope), botanical: plantDocument(scope), settings: emptySettingsDocument(scope) };
  let id = 3000; const next = () => uuid(++id);
  personalChange(docs.drill, 'ensureSeries', ['uc3', '2026-W43', questions, stamp], next);
  personalChange(docs.drill, 'saveDraft', ['uc3__2026-W43', questions[0].id, 'a']);
  mutateCourse(docs.courses, 'cache-local', false, next);
  docs.courses.imports.push({ id: next(), provenance: next(), raw: JSON.stringify({ user_id: accounts.B.id, password: 'FOREIGN_ARCHIVE' }), attemptIds: {}, operationIds: [] });
  const session = botanicalSession('cache-session'); recordPersonalSession(docs.botanical, session, next); recordPersonalAnswer(docs.botanical, botanicalAnswer(session), next);
  queueSettings(docs.settings, 'itk', parameters, next);
  const before = await page.evaluate(async ({ docs, caches, scope, foreign }) => {
    const names = Object.entries(caches);
    for (const [domain, name] of names) await new Promise((resolve, reject) => {
      const req = indexedDB.open(name); req.onupgradeneeded = () => req.result.createObjectStore('accounts');
      req.onsuccess = () => { const db = req.result, tx = db.transaction('accounts', 'readwrite'); tx.objectStore('accounts').put(docs[domain], scope); tx.objectStore('accounts').put({ scope: foreign, private: 'B_ONLY' }, foreign); tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = reject; };
    });
    return JSON.stringify(docs);
  }, { docs, caches: CACHES, scope, foreign: scope.replace(accounts.A.id, accounts.B.id) });
  await prepare(page); await expect(page.locator('[data-export-status]')).toContainText('Copie prête'); const file = await download(page);
  expect(Object.keys(file.data.personalLocal)).toHaveLength(4);
  expect(file.data.personalLocal.drill.drill.series['uc3__2026-W43'].drafts[questions[0].id]).toBe('a');
  expect(file.data.personalLocal.botanical.operations).toHaveLength(2);
  expect(file.data.personalLocal.settings.operations[0].payload.p_parameters.area).toBe('100');
  expect(file.coverage.some(item => item.source === CACHES.courses && item.status === 'limited')).toBe(true);
  for (const marker of ['FOREIGN_ARCHIVE', 'B_ONLY', accounts.B.id]) expect(JSON.stringify(file).includes(marker)).toBe(false);
  const after = await page.evaluate(async ({ caches, scope }) => {
    const data = {};
    for (const [domain, name] of Object.entries(caches)) data[domain] = await new Promise(resolve => { const req = indexedDB.open(name); req.onsuccess = () => { const db = req.result, tx = db.transaction('accounts', 'readonly'), read = tx.objectStore('accounts').get(scope); tx.oncomplete = () => { db.close(); resolve(read.result); }; }; });
    return JSON.stringify(data);
  }, { caches: CACHES, scope });
  expect(after === before).toBe(true);
});
test('le message du pseudo reste indépendant des nouveaux statuts de copie', async ({ page }) => {
  const api = createExportAPI(); await api.install(page.context()); await page.goto(path);
  await page.getByLabel('Pseudo (facultatif)', { exact: true }).fill('Pseudo fictif modifié');
  await page.getByRole('button', { name: 'Enregistrer le pseudo', exact: true }).click();
  const account = page.getByRole('region', { name: 'Compte personnel', exact: true });
  await expect(account.getByRole('status')).toHaveText('Ton pseudo a été enregistré.');
  await expect(page.locator('[data-export-status]')).toHaveText('La préparation n’a pas commencé.');
  await expect(page.getByLabel('Pseudo (facultatif)', { exact: true })).toHaveValue('Pseudo fictif modifié');
});
