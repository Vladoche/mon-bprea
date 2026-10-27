import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createSettingsAPI, settingsRow, accounts } from './settings-api.js';
import { itkPath, itkParameters, settingsAction, settingsSynced, settingsCacheReady, generateItk, expectItk, chooseAppearance, closeAppearance, settingsRecords } from '../helpers/settings-browser.js';
import { waitForIdentity, waitForPersistedOperation } from '../helpers/personal-browser.js';
const now = new Date('2026-10-25T10:00:00.000Z');
test.beforeEach(async ({ page }) => { await page.clock.install({ time: now }); });
async function captureMatrix(page, name) {
  await mkdir('.tmp/settings-visual', { recursive: true });
  const original = await page.evaluate(() => window.BpreaAppearance.getPreferences());
  const diagnostics = [];
  const visualState = () => page.evaluate(() => { const link = document.querySelector('.skip-link'); const rect = link.getBoundingClientRect(); return { active: document.activeElement?.id || document.activeElement?.tagName, scrollY, focused: link === document.activeElement, transform: getComputedStyle(link).transform, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } }; });
  for (const [width, device] of [[1280, 'desktop'], [390, 'mobile']]) {
    await page.setViewportSize({ width, height: 900 });
    for (const brightness of ['light', 'dark']) {
      await page.evaluate(value => window.BpreaAppearance.applyPreferences(value), { ...original, brightness });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const before = await visualState();
      await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
      const atTop = await visualState();
      await page.screenshot({ path: `.tmp/settings-visual/${name}-${device}-${brightness}.png`, fullPage: true, animations: 'disabled' });
      diagnostics.push({ device, brightness, before, atTop, after: await visualState() });
    }
  }
  await page.evaluate(value => window.BpreaAppearance.applyPreferences(value), original);
  await writeFile(`.tmp/settings-visual/${name}-diagnostics.json`, JSON.stringify(diagnostics, null, 2));
}

test('ITK personnel : paramètres sur deux appareils, saisie et focus préservés, exports inchangés', async ({ page, browser }) => {
  const api = createSettingsAPI(); await api.install(page.context());
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173/', timezoneId: 'Europe/Paris', locale: 'fr-FR' });
  await api.install(context); const second = await context.newPage(); await second.clock.install({ time: now });
  try {
    await page.goto(itkPath); await settingsSynced(page); await generateItk(page); await settingsSynced(page);
    await second.goto(itkPath); await settingsSynced(second); await expectItk(second, itkParameters); await expect(second.locator('#csv-export')).toHaveCount(0);
    await captureMatrix(page, 'personal');
    const originalResult = await page.locator('#itk-output').innerHTML();
    let release; const waiting = new Promise(resolve => { release = resolve; }); let reading = false;
    api.holdRead = async domain => { if (domain === 'itk') { reading = true; await waiting; } };
    await page.getByRole('button', { name: 'Actualiser les paramètres', exact: true }).click(); await expect.poll(() => reading).toBe(true);
    await page.locator('#area').fill('777'); await page.locator('#area').focus();
    api.rows.itk.set(accounts.A.id, settingsRow('itk', { ...itkParameters, crop: 'carotte', variety: 'Nantaise', area: '250' }, accounts.A.id, randomUUID(), 1));
    release(); api.holdRead = null; await settingsSynced(page);
    await expect(page.locator('#area')).toHaveValue('777'); await expect(page.locator('#area')).toBeFocused(); await expect(page.locator('#crop')).toHaveValue('tomate');
    expect(await page.locator('#itk-output').innerHTML()).toBe(originalResult);
    await expect(page.getByRole('button', { name: 'Restaurer les paramètres du compte', exact: true })).toBeVisible();
    await captureMatrix(page, 'dirty');
    const download = page.waitForEvent('download'); await page.locator('#csv-export').click(); const file = await download;
    expect(file.suggestedFilename()).toBe('itk-tomate.csv'); expect(await readFile(await file.path(), 'utf8')).toContain('Période');
    await page.evaluate(() => { window.print = () => { window.__settingsPrinted = true; }; }); await page.locator('#print-itk').click(); expect(await page.evaluate(() => window.__settingsPrinted)).toBe(true);
    await page.getByRole('button', { name: 'Restaurer les paramètres du compte', exact: true }).click();
    await expectItk(page, { ...itkParameters, crop: 'carotte', variety: 'Nantaise', area: '250' });
    expect(await page.locator('#itk-output').innerHTML()).toBe(originalResult);
  } finally { await context.close(); }
});

test('paramètres : panne API, changements successifs, reload et retry strict sans doublon', async ({ page }) => {
  const api = createSettingsAPI(); await api.install(page.context()); await page.goto(itkPath); await settingsSynced(page);
  await generateItk(page); await settingsSynced(page); api.restOffline = true;
  await generateItk(page, { ...itkParameters, area: '222' }); await chooseAppearance(page, 'summer', 'dark'); await chooseAppearance(page, 'winter', 'dark'); await chooseAppearance(page, 'auto', 'auto'); await closeAppearance(page);
  await expect(page.locator('#itk-sync-status')).toContainText(/ligne|attente/i); await captureMatrix(page, 'offline');
  const before = (await settingsRecords(page))[0]; await page.reload(); await expectItk(page, { ...itkParameters, area: '222' });
  expect((await settingsRecords(page))[0].operations.map(op => op.id)).toEqual(before.operations.map(op => op.id));
  api.restOffline = false; api.loseAck = 'itk'; await settingsAction(page, 'retry');
  // Observe the lost acknowledgment's persisted failure before the deliberate
  // retry. Do not race an automatic retry deadline against a 5-second poll.
  await waitForPersistedOperation(page, 'mon-bprea-settings-personal-v1', accounts.A.id, { domain: 'itk', state: 'pending', error: 'network' });
  await settingsAction(page, 'retry'); await settingsSynced(page);
  const sent = api.sent.filter(item => item.domain === 'itk'); expect(sent.at(-1).body).toEqual(sent.at(-2).body);
  expect(api.rows.itk.size).toBe(1); expect(api.rows.itk.get(accounts.A.id).parameters.area).toBe('222');
  expect(api.rows.appearance.get(accounts.A.id)).toMatchObject({ season: 'auto', brightness: 'auto' });
});

test('apparence : préférences auto conservées, clavier et rendu local jour/nuit', async ({ page, browser }) => {
  const api = createSettingsAPI(); await api.install(page.context());
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173/', timezoneId: 'Europe/Paris', locale: 'fr-FR' }); await api.install(context);
  const second = await context.newPage(); await second.clock.install({ time: new Date('2026-10-25T23:00:00.000Z') });
  try {
    await page.goto(itkPath); await settingsSynced(page); await chooseAppearance(page, 'winter', 'dark'); await settingsSynced(page);
    await page.locator('#appearance-season').focus(); await page.locator('#appearance-season').press('Home'); await page.locator('#appearance-season').press('Enter');
    await page.locator('#appearance-season').selectOption('auto'); await page.locator('#appearance-brightness').focus(); await page.locator('#appearance-brightness').selectOption('auto'); await settingsSynced(page);
    await expect(page.locator('#appearance-brightness')).toBeFocused(); await closeAppearance(page);
    await second.goto(itkPath); await settingsSynced(second);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light'); await expect(second.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(api.rows.appearance.get(accounts.A.id)).toMatchObject({ season: 'auto', brightness: 'auto' });
    await page.locator('#appearance-open').click(); await captureMatrix(page, 'appearance'); await closeAppearance(page);
  } finally { await context.close(); }
});

test('paramètres : conflit ITK isolé, apparence synchronisée et résolution explicite', async ({ page }) => {
  const api = createSettingsAPI(); await api.install(page.context()); await page.goto(itkPath); await settingsSynced(page); await generateItk(page); await settingsSynced(page);
  api.rows.itk.set(accounts.A.id, settingsRow('itk', { ...itkParameters, crop: 'carotte', variety: 'Nantaise', area: '300' }, accounts.A.id, randomUUID(), 1));
  await generateItk(page, { ...itkParameters, area: '250' });
  await expect(page.locator('#itk-sync-status')).toContainText('Conflit');
  expect(api.rows.itk.get(accounts.A.id).parameters.crop).toBe('carotte');
  await chooseAppearance(page, 'winter', 'dark');
  await expect.poll(() => api.rows.appearance.size).toBe(1);
  await expect.poll(async () => (await settingsAction(page, 'state')).sync.domains.appearance.state).toBe('synced'); await closeAppearance(page);
  await page.locator('#itk-conflicts summary').last().click(); await captureMatrix(page, 'conflict');
  const originalId = (await settingsAction(page, 'state')).sync.conflicts.find(item => item.domain === 'itk').id;
  await page.locator('#itk-conflicts').getByRole('button', { name: 'Utiliser mon choix enregistré sur cet appareil', exact: true }).click(); await settingsSynced(page);
  expect(api.rows.itk.get(accounts.A.id)).toMatchObject({ revision: 3, base_revision: 2, parameters: { ...itkParameters, area: '250' } });
  expect(api.rows.itk.get(accounts.A.id).operation_id).not.toBe(originalId);
});

test('imports : examen volontaire distinct par domaine, source changée et ancien ITK invalide refusés', async ({ page }) => {
  const raw = JSON.stringify({ ...itkParameters, area: '321' }), appearanceRaw = '{"version":1,"season":"summer","brightness":"dark","historical":"keep"}';
  const api = createSettingsAPI(); await api.install(page.context(), 'A', { 'bprea-demo-itk-v1': raw, 'bprea-demo-appearance-v1': appearanceRaw });
  await page.goto(itkPath); await settingsSynced(page); expect(api.rows.itk.size).toBe(0); expect(api.rows.appearance.size).toBe(0);
  await page.getByRole('button', { name: 'Examiner les paramètres locaux', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Importer les paramètres ITK' })).toContainText('321'); await captureMatrix(page, 'import');
  await page.getByRole('button', { name: 'Annuler', exact: true }).click(); expect(api.rows.itk.size).toBe(0);
  await page.getByRole('button', { name: 'Examiner les paramètres locaux', exact: true }).click(); await page.getByRole('button', { name: 'Confirmer l’import ITK', exact: true }).click(); await settingsSynced(page);
  expect(api.rows.itk.get(accounts.A.id).parameters.area).toBe('321'); expect(api.rows.appearance.size).toBe(0);
  const preview = await settingsAction(page, 'previewImport', 'itk'); await settingsAction(page, 'confirmImport', preview); await settingsSynced(page); expect(api.rows.itk.get(accounts.A.id).revision).toBe(1);
  await page.evaluate(value => localStorage.setItem('bprea-demo-itk-v1', value), JSON.stringify({ ...itkParameters, area: '999' }));
  expect((await settingsAction(page, 'confirmImport', preview)).error).toBeTruthy();
  await page.evaluate(() => localStorage.setItem('bprea-demo-itk-v1', '{"crop":"tomate","variety":"Nantaise","cover":"serre","area":"10","month":"5","year":"2028","soil":"limoneux","water":"standard"}'));
  const refused = await settingsAction(page, 'previewImport', 'itk'); expect(refused.error).toBeTruthy(); expect(refused.available).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem('bprea-demo-appearance-v1'))).toBe(appearanceRaw);
});

test('comptes : réponse ITK tardive de A ignorée sous B et caches récupérés au retour A', async ({ page }) => {
  const api = createSettingsAPI(); await api.install(page.context()); await page.goto(itkPath); await settingsSynced(page); await generateItk(page); await settingsSynced(page);
  let release, reading = false; const wait = new Promise(resolve => { release = resolve; }); api.holdRead = async domain => { if (domain === 'itk') { reading = true; await wait; } };
  await page.getByRole('button', { name: 'Actualiser les paramètres', exact: true }).click(); await expect.poll(() => reading).toBe(true);
  await page.evaluate(async email => { const app = new URL(document.querySelector('script[type="module"][src]').src); const url = new URL('./auth-service.js', app); url.search = app.search; const auth = await (await import(url.href)).getAuthService(); await auth.signOut(); await auth.signIn(email, 'synthetic-password'); }, accounts.B.email);
  await waitForIdentity(page, accounts.B.id);
  release(); api.holdRead = null; await settingsSynced(page); await settingsCacheReady(page, accounts.B.id);
  const b = await settingsAction(page, 'state'); expect(b.view.itk).toBeNull(); expect(b.view.appearance).toBeNull(); await expect(page.locator('#csv-export')).toHaveCount(0);
  expect(api.sent.filter(item => item.uid === accounts.B.id)).toHaveLength(0);
  await page.evaluate(async email => { const app = new URL(document.querySelector('script[type="module"][src]').src); const url = new URL('./auth-service.js', app); url.search = app.search; const auth = await (await import(url.href)).getAuthService(); await auth.signOut(); await auth.signIn(email, 'synthetic-password'); }, accounts.A.email);
  await waitForIdentity(page, accounts.A.id); await settingsSynced(page); await settingsCacheReady(page, accounts.A.id);
  await expectItk(page, itkParameters); expect(await settingsRecords(page)).toHaveLength(2);
});

test('visiteur : génération et apparence conservées, erreurs de stockage annoncées sans supprimer la source', async ({ page }) => {
  await page.goto(itkPath); await generateItk(page); await expect(page.locator('#itk-sync-status')).toContainText('visiteur');
  await chooseAppearance(page, 'spring', 'light'); await closeAppearance(page); await captureMatrix(page, 'visitor');
  const before = await page.evaluate(() => localStorage.getItem('bprea-demo-itk-v1'));
  await page.evaluate(() => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === 'bprea-demo-itk-v1' || key === 'bprea-demo-appearance-v1') throw new DOMException('Synthetic quota', 'QuotaExceededError'); return original.call(this, key, value); }; });
  await generateItk(page, { ...itkParameters, area: '888' }); await expect(page.locator('#itk-action-message')).toContainText(/pas enregistr|pas sauvegard/i); await expect(page.locator('#csv-export')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('bprea-demo-itk-v1'))).toBe(before); await captureMatrix(page, 'storage-error');
});

test('compte vide : rendu sombre de l’appareil conservé après récupération sans préférence personnelle inventée', async ({ page }) => {
  const source = '{"version":1,"season":"winter","brightness":"dark"}';
  const api = createSettingsAPI(); await api.install(page.context(), 'A', { 'bprea-demo-appearance-v1': source });
  await page.goto(itkPath); await settingsSynced(page);
  await settingsAction(page, 'save', 'appearance', { version: 1, season: 'summer', brightness: 'light' }); await settingsSynced(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.evaluate(async email => {
    const app = new URL(document.querySelector('script[type="module"][src]').src);
    const url = new URL('./auth-service.js', app); url.search = app.search;
    const auth = await (await import(url.href)).getAuthService();
    await auth.signOut(); await auth.signIn(email, 'synthetic-password');
  }, accounts.B.email);
  await settingsSynced(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect((await settingsAction(page, 'state')).view.appearance).toBeNull();
  await settingsAction(page, 'retry'); await settingsSynced(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => window.BpreaAppearance.getPreferences())).toMatchObject({ season: 'auto', brightness: 'auto' });
  await page.reload(); await settingsSynced(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(api.rows.appearance.has(accounts.B.id)).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem('bprea-demo-appearance-v1'))).toBe(source);
});

test('apparence personnelle : stockage refusé, choix temporaire honnête et source visiteur préservée', async ({ page }) => {
  const source = '{"version":1,"season":"spring","brightness":"light"}';
  const api = createSettingsAPI(); await api.install(page.context(), 'A', { 'bprea-demo-appearance-v1': source });
  await page.addInitScript(() => {
    const open = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function (name, ...args) {
      if (name === 'mon-bprea-settings-personal-v1') throw new DOMException('Synthetic quota', 'QuotaExceededError');
      return open.call(this, name, ...args);
    };
  });
  await page.goto(itkPath);
  await expect.poll(async () => (await settingsAction(page, 'state')).sync.state).toBe('storage-error');
  await chooseAppearance(page, 'winter', 'dark');
  await expect(page.locator('#appearance-save')).toContainText('Erreur de stockage');
  await expect(page.locator('#appearance-save')).toContainText('non enregistré');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await captureMatrix(page, 'personal-storage-error');
  expect(api.sent).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('bprea-demo-appearance-v1'))).toBe(source);
});
