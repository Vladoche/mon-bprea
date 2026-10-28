import { test, expect } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import { createExportAPI, accounts } from './export-api.js';
import { CACHES } from '../../assets/export-sources.js';
import { emptyPersonalDocument as drillDocument, personalChange } from '../../assets/drill-personal-store.js';
import { emptyPersonalDocument as courseDocument, mutateCourse } from '../../assets/course-quiz-model.js';
import { emptyPersonalDocument as botanicalDocument, recordPersonalSession } from '../../assets/botanical-sync-model.js';
import { emptySettingsDocument, queueSettings } from '../../assets/settings-model.js';
import { questions, stamp, uuid, parameters } from '../fixtures/export.js';
import { botanicalSession } from '../fixtures/personal-data.js';
import { stopOrdinarySync } from '../helpers/export-browser.js';

// Synthetic HTTP only: these scenarios prove browser coordination, never RLS.
test.use({ trace: 'off', screenshot: 'off', video: 'off' });
const profile = '/mon-bprea/profil.html';
const scope = name => JSON.stringify(['development', 'https://export.invalid', accounts[name].id]);
test.beforeEach(async ({ page }) => { await page.clock.install({ time: new Date('2026-10-28T12:00:00Z') }); });

async function seed(page) {
  const records = {};
  let counter = 7000; const next = () => uuid(++counter);
  for (const name of ['A', 'B']) {
    const key = scope(name);
    const docs = { drill: drillDocument(key), courses: courseDocument(key), botanical: botanicalDocument(key), settings: emptySettingsDocument(key) };
    personalChange(docs.drill, 'ensureSeries', ['uc3', '2026-W43', questions, stamp], next);
    personalChange(docs.drill, 'saveDraft', ['uc3__2026-W43', questions[0].id, 'a']);
    mutateCourse(docs.courses, `attente-${name}`, false, next);
    docs.courses.imports.push({ id: next(), provenance: next(), raw: JSON.stringify({ unknown: 'ARCHIVE_PRIVEE_EXCLUE' }),
      attemptIds: {}, operationIds: [], summary: { courses: 0, attempts: 0, legacyScores: 0 }, warnings: [] });
    recordPersonalSession(docs.botanical, botanicalSession(`recette-${name}`), next);
    queueSettings(docs.settings, 'itk', parameters, next);
    queueSettings(docs.settings, 'appearance', { version: 1, season: 'auto', brightness: 'dark' }, next);
    records[name] = docs;
  }
  await page.evaluate(async ({ records, caches }) => {
    for (const [domain, name] of Object.entries(caches)) await new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 2);
      request.onupgradeneeded = () => {
        for (const store of ['accounts', 'privacy']) if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store);
      };
      request.onerror = reject;
      request.onsuccess = () => {
        const db = request.result; db.onversionchange = () => db.close();
        const tx = db.transaction('accounts', 'readwrite');
        for (const docs of Object.values(records)) tx.objectStore('accounts').put(docs[domain], docs[domain].scope);
        tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = reject;
      };
    });
  }, { records, caches: CACHES });
  return records;
}
async function read(page, domain, account, store = 'accounts') {
  return page.evaluate(async ({ database, key, store }) => new Promise((resolve, reject) => {
    const request = indexedDB.open(database);
    request.onerror = reject;
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction(store), get = tx.objectStore(store).get(key);
      tx.oncomplete = () => { db.close(); resolve(get.result ?? null); }; tx.onabort = reject;
    };
  }), { database: CACHES[domain], key: scope(account), store });
}
async function preview(page) {
  await page.locator('[data-erase-personal]').getByLabel('Cours et QCM', { exact: true }).check();
  await page.locator('[data-erase-preview]').click();
  await expect(page.getByRole('dialog')).toBeVisible();
}
async function switchAccount(page, name) {
  await page.evaluate(async account => {
    const app = new URL(document.querySelector('script[type="module"][src]').src);
    const url = new URL('./auth-service.js', app); url.search = app.search;
    const auth = await (await import(url)).getAuthService();
    await auth.signOut(); await auth.signIn(account.email, 'synthetic-test-password');
    if (auth.getState().user?.id !== account.id) throw new Error('Compte fictif non vérifié.');
  }, accounts[name]);
}

test('Recette A : copie téléchargée puis effacement ciblé, B/autres domaines/serveur/fichier préservés', async ({ page }) => {
  const api = createExportAPI(); await api.install(page.context());
  await page.goto(profile); await stopOrdinarySync(page); const before = await seed(page), server = structuredClone(api.rows);
  await page.locator('[data-export-prepare]').click(); await expect(page.locator('[data-export-status]')).toContainText('Copie prête');
  const pending = page.waitForEvent('download'); await page.locator('[data-export-download]').click();
  const download = await pending, filePath = await download.path(), fileText = await readFile(filePath, 'utf8'), file = JSON.parse(fileText);
  expect(Object.keys(file.data.server)).toHaveLength(10); expect(Object.keys(file.data.personalLocal)).toHaveLength(4);
  expect(file.status).toBe('partial'); expect(file.data.personalLocal.courses.operations).toHaveLength(1);
  expect(file.coverage.find(item => item.source === CACHES.courses).status).toBe('limited');
  for (const excluded of [accounts.B.id, 'ARCHIVE_PRIVEE_EXCLUE', 'access_token', 'refresh_token']) expect(fileText).not.toContain(excluded);
  await preview(page); await expect(page.getByRole('dialog')).toContainText('1 opération(s) non confirmée(s)');
  await page.locator('[data-erase-confirm]').click();
  await expect(page.locator('[data-erase-status]')).toContainText('Effacement local confirmé');
  await expect(page.locator('[data-erase-status]')).toBeFocused();
  expect(await read(page, 'courses', 'A')).toBeNull();
  const barrier = await read(page, 'courses', 'A', 'privacy');
  expect(barrier).toEqual({ version: 1, epoch: expect.any(String), blocked: true });
  for (const domain of Object.keys(CACHES)) {
    expect(await read(page, domain, 'B')).toEqual(before.B[domain]);
    if (domain !== 'courses') expect(await read(page, domain, 'A')).toEqual(before.A[domain]);
  }
  expect(api.rows).toEqual(server); expect(api.writes).toEqual([]);
  expect(await readFile(filePath, 'utf8')).toBe(fileText);
  await expect(page.locator('.data-erasure')).toContainText('Un fichier déjà téléchargé ne peut pas être rappelé');
  // A fresh copy reflects the erased local category, while retaining SQL data.
  await page.locator('[data-export-prepare]').click(); await expect(page.locator('[data-export-status]')).toContainText('Copie prête');
  await expect(page.locator('[data-export-coverage]')).toContainText('absent');
});

test('Recette B : effacement pendant la réponse serveur retenue, aucun fichier périmé après libération', async ({ page }) => {
  const api = createExportAPI(); await api.install(page.context()); await page.goto(profile); await stopOrdinarySync(page);
  const before = await seed(page); let release, entered;
  const gate = new Promise(resolve => { release = resolve; }), reached = new Promise(resolve => { entered = resolve; });
  api.hold = async table => { if (table === 'drill_series') { entered(); await gate; } };
  let downloads = 0; page.on('download', () => downloads++);
  await page.locator('[data-export-prepare]').click(); await reached;
  const aborted = page.waitForEvent('requestfailed', request => new URL(request.url()).pathname === '/rest/v1/drill_series');
  await preview(page); await page.locator('[data-erase-confirm]').click();
  await expect(page.locator('[data-erase-status]')).toContainText('Effacement local confirmé');
  await aborted; api.hold = null; release();
  await expect(page.locator('[data-export-download]')).toBeDisabled();
  expect(downloads).toBe(0); expect(await read(page, 'courses', 'A')).toBeNull();
  expect(await read(page, 'courses', 'B')).toEqual(before.B.courses); expect(api.writes).toEqual([]);
});

test('Recette D : aperçu A, connexion B, ancienne confirmation refusée puis retour cohérent à A', async ({ page }) => {
  const api = createExportAPI(); await api.install(page.context()); await page.goto(profile); await stopOrdinarySync(page);
  const before = await seed(page);
  await page.locator('[data-export-prepare]').click(); await expect(page.locator('[data-export-status]')).toContainText('Copie prête');
  await preview(page); await switchAccount(page, 'B');
  await expect(page.getByRole('dialog')).toBeHidden(); await expect(page.locator('[data-export-download]')).toBeDisabled();
  // Simulate a stale callback, even though the original button is now hidden.
  await page.locator('[data-erase-confirm]').dispatchEvent('click');
  await expect(page.locator('[data-erase-status]')).toContainText('La confirmation n’est plus disponible');
  await mkdir('.tmp/privacy-recipe', { recursive: true });
  for (const width of [1280, 390]) for (const brightness of ['light', 'dark']) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(brightness => window.BpreaAppearance.applyPreferences({ version: 1, season: 'auto', brightness }), brightness);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('.data-erasure').screenshot({ path: `.tmp/privacy-recipe/confirmation-perimee-${width}-${brightness}.png`, animations: 'disabled' });
  }
  for (const account of ['A', 'B']) expect(await read(page, 'courses', account)).toEqual(before[account].courses);
  await switchAccount(page, 'A');
  await expect(page.locator('[data-export-download]')).toBeDisabled();
  await preview(page); await page.locator('[data-erase-cancel]').click();
  expect(await read(page, 'courses', 'A')).toEqual(before.A.courses); expect(api.writes).toEqual([]);
});

test('Recette E : timeout HTTP natif puis réponse libérée, aucun fichier incomplet annoncé réussi', async ({ page }) => {
  const api = createExportAPI(); await api.install(page.context()); await page.goto(profile); await stopOrdinarySync(page);
  const before = await seed(page); let release, entered;
  const gate = new Promise(resolve => { release = resolve; }), reached = new Promise(resolve => { entered = resolve; });
  api.hold = async table => { if (table === 'drill_series') { entered(); await gate; } };
  let downloads = 0; page.on('download', () => downloads++);
  try {
    await page.locator('[data-export-prepare]').click(); await reached;
    // Network deadline is real; the pedagogical/date clock remains controlled.
    await expect(page.locator('[data-export-status]')).toContainText('Export incomplet', { timeout: 20000 });
    await expect(page.locator('[data-export-download]')).toBeDisabled();
    expect(await read(page, 'courses', 'A')).toEqual(before.A.courses);
  } finally { api.hold = null; release(); }
  await expect(page.locator('[data-export-download]')).toBeDisabled(); expect(downloads).toBe(0);
  await page.locator('[data-export-prepare]').click(); await expect(page.locator('[data-export-status]')).toContainText('Copie prête');
  expect(api.writes).toEqual([]); expect(downloads).toBe(0);
});
