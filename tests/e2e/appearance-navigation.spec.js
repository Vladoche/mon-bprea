import { test, expect } from '@playwright/test';
import { createSettingsAPI, accounts } from './settings-api.js';

const prefix = '/mon-bprea/';
const key = 'bprea-demo-appearance-device-v1';
const now = new Date('2026-11-16T11:00:00Z');
const nav = page => page.getByRole('navigation', { name: 'Navigation principale', exact: true });
const source = (page, value) => expect.poll(() => page.evaluate(() => window.BpreaAppearance?.getSource())).toBe(value);

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: now });
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

for (const width of [1440, 390]) test(`apparence : lune/soleil conservé entre pages et après reload à ${width} px`, async ({ page, context }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto(prefix + 'index.html'); await source(page, 'device');
  await page.getByRole('button', { name: 'Activer le mode sombre', exact: true }).press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await nav(page).getByRole('link', { name: 'Outils', exact: true }).click();
  await source(page, 'device');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: testInfo.outputPath('tools-after-toggle.png'), animations: 'disabled' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload(); await source(page, 'device');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)).toEqual({ version: 1, season: 'auto', brightness: 'dark' });

  // A new tab, including a page without the asynchronous appearance adapter,
  // must use the same pre-CSS device choice.
  const second = await context.newPage();
  try {
    await second.clock.install({ time: now });
    await second.goto(prefix + 'contact.html');
    await expect(second.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('button', { name: 'Activer le mode clair', exact: true }).click();
    await expect(second.locator('html')).toHaveAttribute('data-theme', 'light');
    await nav(page).getByRole('link', { name: 'Mes cours', exact: true }).click();
    await source(page, 'device');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)).toEqual({ version: 1, season: 'auto', brightness: 'light' });
    await page.goto(prefix + 'profil.html#parametres'); await source(page, 'device');
    await page.getByRole('button', { name: 'Régler l’apparence', exact: true }).click();
    await page.getByRole('button', { name: 'Retirer l’apparence mémorisée', exact: true }).click();
    expect(await page.evaluate(key => localStorage.getItem(key), key)).toBeNull();
  } finally { await second.close(); }
});

test('apparence : le bouton connecté conserve le choix personnel sans écrire les préférences visiteur', async ({ page }) => {
  const original = JSON.stringify({ version: 1, season: 'spring', brightness: 'light' });
  const api = createSettingsAPI(); await api.install(page.context(), 'A', { [key]: original });
  await page.goto(prefix + 'index.html'); await source(page, 'personal');
  await page.locator('#theme-toggle').click();
  await expect.poll(() => api.rows.appearance.get(accounts.A.id)?.brightness).toBe('dark');
  await nav(page).getByRole('link', { name: 'Outils', exact: true }).click();
  await source(page, 'personal');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(original);
});

test('apparence : une identité à vérifier interdit la mémorisation visiteur du bouton', async ({ page }) => {
  await page.goto(prefix + 'index.html'); await source(page, 'device');
  await page.evaluate(() => window.BpreaAppearance.setSource('blocked', window.BpreaAppearance.getPreferences()));
  await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#theme-toggle-feedback')).toContainText('non enregistré');
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBeNull();
});

for (const failure of ['quota', 'unknown']) test(`apparence : mémorisation ${failure} refusée sans perte ni faux succès`, async ({ page }) => {
  const original = '{"version":9,"future":"preserve"}';
  await page.addInitScript(({ key, failure, original }) => {
    if (failure === 'unknown' && localStorage.getItem(key) === null) localStorage.setItem(key, original);
    if (failure === 'quota') {
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function(name, value) {
        if (this === localStorage && name === key) throw new DOMException('Quota synthétique', 'QuotaExceededError');
        return set.call(this, name, value);
      };
    }
  }, { key, failure, original });
  await page.goto(prefix + 'index.html'); await source(page, 'device');
  await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#theme-toggle-feedback')).toContainText(failure === 'quota' ? 'stockage local est indisponible' : 'conservé');
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(failure === 'quota' ? null : original);
  await nav(page).getByRole('link', { name: 'Outils', exact: true }).click(); await source(page, 'device');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
