import { test, expect } from '@playwright/test';
import { accounts, createSettingsAPI, settingsOrigin } from './settings-api.js';
import { chooseAppearance, closeAppearance, generateItk, settingsCacheReady, settingsRecords } from '../helpers/settings-browser.js';
import { waitForPersistedOperation } from '../helpers/personal-browser.js';
import { CACHES } from '../../assets/export-sources.js';

const prefix = '/mon-bprea/';
const siteOrigin = 'http://127.0.0.1:4173';
const instant = new Date('2026-11-05T12:00:00Z');
const progress = 'bprea-demo-progress-v1';
const appearance = 'bprea-demo-appearance-v1';
const legacyTheme = 'bprea-demo-theme-v1';
const dismissed = 'bprea-demo-daily-fact-dismissed-v1';
const itk = 'bprea-demo-itk-v1';
const localKeys = page => page.evaluate(() => Object.keys(localStorage).sort());

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

test('D12 visiteur : lecture avant interaction, écritures déclenchées par les actions, date d’anecdote sans purge', async ({ page, context }) => {
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
  const reads = await page.evaluate(() => window.d12Accesses.filter(([method]) => method === 'getItem').map(([, key]) => key));
  expect(reads).toEqual(expect.arrayContaining([appearance, legacyTheme, dismissed, progress, 'bprea-demo-drill-v1']));
  expect(await localKeys(page)).toEqual([]);
  await page.getByRole('button', { name: 'Masquer l’anecdote pour aujourd’hui' }).click();
  await expect(fact).toBeHidden();
  expect(await localKeys(page)).toEqual([dismissed]);
  await page.reload();
  await expect.poll(() => page.evaluate(key => window.d12Accesses.some(([method, name]) => method === 'getItem' && name === key), dismissed)).toBe(true);
  await expect(fact).toBeHidden();
  await page.clock.setSystemTime(new Date('2026-11-06T12:00:00Z'));
  await page.reload();
  await expect(fact).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), dismissed)).toBe('2026-11-05');

  await chooseAppearance(page, 'winter', 'dark');
  await closeAppearance(page);
  expect(await localKeys(page)).toEqual([appearance, dismissed].sort());
  await page.goto(prefix + 'cours.html?id=matiere-organique');
  await page.getByRole('checkbox', { name: 'Marquer ce cours comme terminé' }).check();
  await expect.poll(() => localKeys(page)).toEqual([appearance, dismissed, progress].sort());
  await page.goto(prefix + 'itk.html');
  expect(await localKeys(page)).not.toContain(itk);
  await generateItk(page);
  await expect.poll(() => localKeys(page)).toEqual([appearance, dismissed, progress, itk].sort());
  expect(await page.evaluate(async () => [sessionStorage.length, (await indexedDB.databases()).length])).toEqual([0, 0]);
  expect(await context.cookies()).toEqual([]);
  expect(unexpected).toEqual([]);
});

test('D12 ancien thème : Contact migre le choix hérité au chargement et conserve les deux clés', async ({ page }) => {
  await observeStorage(page);
  await page.goto(prefix + 'contact.html');
  expect(await localKeys(page)).toEqual([]);
  await page.evaluate(key => localStorage.setItem(key, 'dark'), legacyTheme);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await localKeys(page)).toEqual([appearance, legacyTheme].sort());
  expect(await page.evaluate(() => window.d12Accesses.filter(([method]) => method === 'setItem')))
    .toEqual([['setItem', appearance]]);
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
