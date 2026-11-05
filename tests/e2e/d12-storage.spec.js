import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { accounts, createSettingsAPI, settingsOrigin } from './settings-api.js';
import { chooseAppearance, closeAppearance, expectItk, generateItk, itkParameters, settingsCacheReady, settingsRecords } from '../helpers/settings-browser.js';
import { waitForPersistedOperation } from '../helpers/personal-browser.js';
import { CACHES } from '../../assets/export-sources.js';

const prefix = '/mon-bprea/';
const siteOrigin = 'http://127.0.0.1:4173';
const instant = new Date('2026-11-05T12:00:00Z');
const progress = 'bprea-demo-progress-v1';
const appearance = 'bprea-demo-appearance-v1';
const rememberedAppearance = 'bprea-demo-appearance-device-v1';
const legacyTheme = 'bprea-demo-theme-v1';
const dismissed = 'bprea-demo-daily-fact-dismissed-v1';
const itk = 'bprea-demo-itk-v1';
const rememberedItk = 'bprea-demo-itk-device-v1';
const localKeys = page => page.evaluate(() => Object.keys(localStorage).sort());
const accesses = (page, keys) => page.evaluate(keys => window.d12Accesses.filter(([, key]) => keys.includes(key)), keys);

test.beforeEach(async ({ page }) => { await page.clock.install({ time: instant }); });

async function observeStorage(page) {
  await page.addInitScript(() => {
    const accesses = [];
    window.d12Accesses = accesses;
    for (const method of ['getItem', 'setItem', 'removeItem']) {
      const native = Storage.prototype[method];
      Storage.prototype[method] = function (key, ...args) {
        if (this === localStorage) accesses.push([method, String(key)]);
        return Reflect.apply(native, this, [key, ...args]);
      };
    }
  });
}

test('D12 visiteur neuf : accès limités, révision normale et anecdote masquée en mémoire de page', async ({ page, context }) => {
  const unexpected = [];
  await context.route('**/*', route => {
    const origin = new URL(route.request().url()).origin;
    if (origin === siteOrigin) return route.continue();
    unexpected.push(origin);
    return route.abort();
  });
  await observeStorage(page);
  await page.goto(prefix);
  const fact = page.getByRole('region', { name: 'Tu savais que… ?' });
  await expect(fact).toBeVisible();
  await expect.poll(() => accesses(page, [progress, 'bprea-demo-drill-v1'])).toEqual(expect.arrayContaining([
    ['getItem', progress], ['getItem', 'bprea-demo-drill-v1'],
  ]));
  const optional = [appearance, legacyTheme, dismissed, itk, rememberedItk];
  expect(await accesses(page, optional)).toEqual([]);
  expect(await accesses(page, [rememberedAppearance])).toEqual([['getItem', rememberedAppearance]]);
  expect(await localKeys(page)).toEqual([]);

  await page.evaluate(key => localStorage.setItem(key, '2026-11-05'), dismissed);
  await page.reload();
  await expect(fact).toBeVisible();
  const closeFact = page.getByRole('button', { name: 'Masquer l’anecdote sur cette page' });
  await closeFact.press('Enter');
  await expect(fact).toBeHidden();
  await expect(page.locator('#app-main')).toBeFocused();
  expect(await accesses(page, optional)).toEqual([]);
  await page.reload();
  await expect(fact).toBeVisible();
  await closeFact.click();
  await expect(fact).toBeHidden();
  await page.clock.setSystemTime(new Date('2026-11-05T22:59:30Z'));
  await page.clock.fastForward(60000);
  await expect(fact).toBeVisible();
  await expect(fact).toHaveAttribute('data-fact-date', '2026-11-06');
  expect(await accesses(page, optional)).toEqual([]);
  await closeFact.click();
  await page.goto(prefix + 'cours.html?id=matiere-organique');
  await expect(fact).toBeVisible();
  await page.getByRole('checkbox', { name: 'Marquer ce cours comme terminé' }).check();
  await expect.poll(() => localKeys(page)).toEqual([dismissed, progress].sort());
  await page.goto(prefix + 'itk.html');
  await generateItk(page);
  await expect(page.getByRole('button', { name: 'Mémoriser les paramètres du dernier calcul' })).toBeEnabled();
  expect(await localKeys(page)).toEqual([dismissed, progress].sort());
  expect(await accesses(page, optional)).toEqual([]);
  expect(await page.evaluate(key => localStorage.getItem(key), dismissed)).toBe('2026-11-05');
  expect(await page.evaluate(async () => [sessionStorage.length, (await indexedDB.databases()).length])).toEqual([0, 0]);
  expect(await context.cookies()).toEqual([]);
  expect(unexpected).toEqual([]);
});

test('D12 ancien thème seul : Contact ignore la clé, reprise volontaire en mémoire et retrait sans retour automatique', async ({ page, context }) => {
  await observeStorage(page);
  await page.goto(prefix + 'contact.html');
  expect(await localKeys(page)).toEqual([]);
  await page.evaluate(key => localStorage.setItem(key, 'dark'), legacyTheme);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await accesses(page, [appearance, legacyTheme, rememberedAppearance])).toEqual([['getItem', rememberedAppearance]]);
  await page.goto(prefix);
  await page.getByRole('button', { name: 'Paramètres d’apparence' }).click();
  const remember = page.getByRole('button', { name: 'Mémoriser mon apparence sur cet appareil' });
  await expect(remember).toBeDisabled();
  await page.getByRole('button', { name: 'Reprendre une ancienne apparence' }).press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('combobox', { name: 'Luminosité' })).toHaveValue('dark');
  expect(await localKeys(page)).toEqual([legacyTheme]);
  await remember.press('Enter');
  const second = await context.newPage();
  try {
    await second.clock.install({ time: instant });
    await second.goto(prefix + 'contact.html');
    await expect(second.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('button', { name: 'Retirer l’apparence mémorisée' }).press('Enter');
    await expect(remember).toBeFocused();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(second.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(await accesses(page, [appearance, legacyTheme])).toEqual([]);
    expect(await localKeys(page)).toEqual([legacyTheme]);
  } finally { await second.close(); }
});

test('D12 ITK : ancien formulaire préservé, rappel manuel et retrait, résultat et CSV identiques', async ({ page }, testInfo) => {
  await observeStorage(page);
  await page.goto(prefix + 'contact.html');
  const archived = { ...itkParameters, area: '321' };
  const oldRaw = JSON.stringify(archived);
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [itk, oldRaw]);
  await page.goto(prefix + 'itk.html');
  await expect(page.getByRole('button', { name: 'Charger les paramètres mémorisés' })).toBeVisible();
  await expect(page.locator('#area')).toHaveValue('100');
  expect(await accesses(page, [itk, rememberedItk])).toEqual([]);
  await page.getByText('Anciens paramètres sur cet appareil', { exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Charger les anciens paramètres' }).press('Enter');
  await expectItk(page, archived);
  expect(await accesses(page, [itk, rememberedItk])).toEqual([['getItem', itk]]);
  const csv = async () => {
    const pending = page.waitForEvent('download');
    await page.locator('#csv-export').click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe('itk-tomate.csv');
    return readFile(await download.path(), 'utf8');
  };
  await generateItk(page, archived);
  const original = await page.locator('#itk-output').innerText();
  const originalCSV = await csv();
  const remember = page.getByRole('button', { name: 'Mémoriser les paramètres du dernier calcul' });
  await expect(remember).toBeEnabled();
  expect(await localKeys(page)).toEqual([itk]);
  await remember.press('Enter');
  await expect(page.locator('#itk-action-message')).toContainText('mémorisés');
  await page.reload();
  await expect(page.locator('#area')).toHaveValue('100');
  await expect(remember).toBeDisabled();
  expect(await accesses(page, [itk, rememberedItk])).toEqual([]);
  const recall = page.getByRole('button', { name: 'Charger les paramètres mémorisés' });
  await recall.press('Enter');
  await expectItk(page, archived);
  await expect(page.locator('#csv-export')).toHaveCount(0);
  await generateItk(page, archived);
  expect(await page.locator('#itk-output').innerText()).toBe(original);
  expect(await csv()).toBe(originalCSV);

  await page.getByRole('button', { name: 'Retirer les paramètres mémorisés' }).press('Enter');
  await expect(page.locator('#itk-action-message')).toContainText('Mémorisation retirée');
  await expectItk(page, archived);
  expect(await page.locator('#itk-output').innerText()).toBe(original);
  expect(await localKeys(page)).toEqual([itk]);
  await page.reload();
  await recall.press('Enter');
  await expect(page.locator('#itk-action-message')).toContainText('Aucun paramètre mémorisé');
  await expect(page.locator('#area')).toHaveValue('100');
  expect(await accesses(page, [itk])).toEqual([]);
  expect(await page.evaluate(key => localStorage.getItem(key), itk)).toBe(oldRaw);

  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const brightness of ['light', 'dark']) {
      await page.evaluate(brightness => window.BpreaAppearance.updatePreferences({ brightness }), brightness);
      await recall.focus();
      await expect(recall).toBeFocused();
      expect(await recall.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.locator('#itk-sync-panel').screenshot({ path: testInfo.outputPath(`itk-${width}-${brightness}.png`), animations: 'disabled' });
    }
  }
});

test('D12 stockage bloqué : thème, anecdote et calcul restent disponibles', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() { throw new DOMException('Stockage bloqué par le navigateur de test', 'SecurityError'); },
    });
  });
  await page.goto(prefix + 'itk.html');
  await generateItk(page);
  await page.getByRole('button', { name: 'Mémoriser les paramètres du dernier calcul' }).click();
  await expect(page.locator('#itk-action-message')).toContainText('stockage local est inaccessible');
  await expect(page.locator('#csv-export')).toBeVisible();
  await chooseAppearance(page, 'winter', 'dark');
  await page.getByRole('button', { name: 'Mémoriser mon apparence sur cet appareil' }).click();
  await expect(page.locator('#appearance-action-message')).toContainText('stockage local est indisponible');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await closeAppearance(page);
  await page.getByRole('button', { name: 'Masquer l’anecdote sur cette page' }).click();
  await expect(page.getByRole('region', { name: 'Tu savais que… ?' })).toBeHidden();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Tu savais que… ?' })).toBeVisible();
});

test('D12 profil : inventaire à la demande, export et retrait ciblé des nouvelles mémorisations', async ({ page }) => {
  await observeStorage(page);
  await page.goto(prefix + 'contact.html');
  const theme = { version: 1, season: 'winter', brightness: 'dark' };
  const history = {
    [appearance]: JSON.stringify({ version: 1, season: 'spring', brightness: 'dark' }),
    [itk]: JSON.stringify({ ...itkParameters, area: '111' }),
    [dismissed]: '2026-11-04',
  };
  await page.evaluate(values => {
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
  }, { ...history, [rememberedAppearance]: JSON.stringify(theme), [rememberedItk]: JSON.stringify(itkParameters) });
  await page.goto(prefix + 'profil.html');
  const inspect = page.getByRole('button', { name: 'Rechercher les sauvegardes locales' });
  await expect(inspect).toBeVisible();
  const keys = [appearance, legacyTheme, dismissed, itk, rememberedItk];
  expect(await accesses(page, keys)).toEqual([]);
  await inspect.press('Enter');
  expect(await accesses(page, keys)).toEqual(expect.arrayContaining(keys.map(key => ['getItem', key])));
  for (const value of ['rememberedItk', 'rememberedAppearance']) await page.locator(`[data-export-sources] input[value="${value}"]`).check();
  await page.locator('[data-export-confirm]').check();
  const pending = page.waitForEvent('download');
  await page.locator('[data-export-device]').click();
  const download = await pending;
  const copy = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(copy.data).toEqual({ rememberedAppearance: theme, rememberedItk: itkParameters });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const erase = page.locator('[data-erase-visitor]');
  await erase.getByLabel('Apparence mémorisée', { exact: true }).check();
  await erase.getByLabel('Paramètres ITK mémorisés', { exact: true }).check();
  await page.locator('[data-erase-preview]').click();
  await page.locator('[data-erase-confirm]').click();
  await expect(page.locator('[data-erase-status]')).toContainText('Effacement local confirmé');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await localKeys(page)).toEqual(Object.keys(history).sort());
  expect(await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), Object.keys(history))).toEqual(history);
});

test('D12 compte : session et cache après connexion, déconnexion sans retrait de la progression', async ({ page, context }) => {
  const unexpected = [], calls = [];
  await context.route('**/*', route => {
    const origin = new URL(route.request().url()).origin;
    if (origin === siteOrigin) return route.continue();
    unexpected.push(origin);
    return route.abort();
  });
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.origin === settingsOrigin) calls.push(url.pathname);
  });
  const api = createSettingsAPI();
  await api.install(context, null);
  const login = async account => {
    await page.goto(prefix + 'connexion.html');
    await page.getByLabel('Adresse e-mail', { exact: true }).fill(account.email);
    await page.getByLabel('Mot de passe', { exact: true }).fill('synthetic-password');
    await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
    await expect(page.locator('[data-email]')).toHaveText(account.email);
    await settingsCacheReady(page, account.id);
  };
  const logout = async () => {
    await page.locator('[data-sign-out]').click();
    await expect(page.getByRole('heading', { name: 'Connexion nécessaire' })).toBeVisible();
  };

  await page.goto(prefix + 'cours.html?id=matiere-organique');
  await page.getByRole('checkbox', { name: 'Marquer ce cours comme terminé' }).check();
  await expect.poll(() => localKeys(page)).toEqual([progress]);
  const visitor = await page.evaluate(key => localStorage.getItem(key), progress);
  expect(calls).toEqual([]);
  expect(await page.evaluate(() => indexedDB.databases())).toEqual([]);

  await login(accounts.A);
  const scope = JSON.stringify(['development', settingsOrigin, accounts.A.id]);
  const sessionKey = 'bprea-auth-settings.invalid-/mon-bprea/';
  const continuityKey = 'bprea-auth-local-identity-v1:' + JSON.stringify(['development', settingsOrigin, prefix]);
  expect(await localKeys(page)).toEqual([progress, sessionKey, continuityKey].sort());
  expect(calls).toEqual(expect.arrayContaining(['/auth/v1/token', '/auth/v1/user']));
  api.restOffline = true;
  await chooseAppearance(page, 'auto', 'dark');
  await closeAppearance(page);
  const operation = await waitForPersistedOperation(page, CACHES.settings, accounts.A.id, { domain: 'appearance', state: 'pending' });
  expect((await settingsRecords(page)).map(record => record.scope)).toEqual([scope]);
  await logout();
  expect(await localKeys(page)).toEqual([progress]);
  expect((await settingsRecords(page))[0].operations.map(item => item.id)).toContain(operation.id);
  expect(await page.evaluate(key => localStorage.getItem(key), progress)).toBe(visitor);

  api.restOffline = false;
  await login(accounts.B);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect((await settingsRecords(page)).find(record => record.scope === scope)?.values.appearance.brightness).toBe('dark');
  expect(await page.evaluate(key => localStorage.getItem(key), progress)).toBe(visitor);
  expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
  expect(await context.cookies()).toEqual([]);
  expect(unexpected).toEqual([]);
});
