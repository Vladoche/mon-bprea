import { test, expect } from '@playwright/test';

const KEY = 'bprea-demo-appearance-v1';
const LEGACY = 'bprea-demo-theme-v1';
const now = new Date('2026-10-20T08:00:00.000Z');
const openAppearance = page => page.getByRole('button', { name: 'Paramètres d’apparence', exact: true });
const dialogFor = page => page.getByRole('dialog', { name: 'Ton apparence', exact: true });

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: now });
});

async function seed(page, values) {
  await page.addInitScript(entries => {
    if (sessionStorage.getItem('appearance-preferences-seeded')) return;
    for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
    sessionStorage.setItem('appearance-preferences-seeded', 'true');
  }, values);
}

test('thème visiteur disponible avant les CSS et avant toute vérification réseau', async ({ page }) => {
  await seed(page, { [KEY]: JSON.stringify({ version: 1, season: 'winter', brightness: 'dark' }) });
  let releaseStyles;
  const stylesGate = new Promise(resolve => { releaseStyles = resolve; });
  await page.route(/\/assets\/[^/]+\.css(?:\?.*)?$/, async route => {
    await stylesGate;
    await route.continue();
  });
  const privateRequests = [];
  page.on('request', request => {
    if (/\/(?:auth|rest)\/v1\//.test(new URL(request.url()).pathname)) privateRequests.push(request.url());
  });
  try {
    await page.goto('/mon-bprea/itk.html', { waitUntil: 'commit' });
    // Poll from the test process: requestAnimationFrame waits for blocked CSS.
    await expect.poll(() => page.evaluate(() => !!window.BpreaAppearance)).toBe(true);
    const early = await page.evaluate(() => ({
      season: document.documentElement.dataset.season,
      theme: document.documentElement.dataset.theme,
      source: window.BpreaAppearance.getSource(),
      loadedStyleSheets: document.styleSheets.length,
    }));
    expect(early).toEqual({ season: 'winter', theme: 'dark', source: 'device', loadedStyleSheets: 0 });
    expect(privateRequests).toEqual([]);
  } finally { releaseStyles(); }
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Construire un itinéraire technique.');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const configuration = await (await page.request.get('/mon-bprea/assets/auth-config.json')).json();
  expect(configuration.enabled).toBe(false);
  expect(privateRequests).toEqual([]);
});

test('dialogue clavier, archives visiteur intactes et variantes desktop/mobile', async ({ page }, testInfo) => {
  const unknown = JSON.stringify({ version: 9, season: 'ocean', future: { preserve: true } });
  const histories = {
    [LEGACY]: 'dark',
    'bprea-demo-itk-v1': '{"crop":"tomate","variety":"Marmande","cover":"serre","area":"120","month":"5","year":"2028","soil":"limoneux","water":"standard"}',
    'bprea-demo-progress-v1': '{"matiere-organique":{"done":true,"score":2}}',
    'bprea-demo-drill-v1': '{"version":1,"series":{}}',
    'monbprea.botanical.v1': '{"schemaVersion":1,"answers":[],"sessions":[]}',
  };
  await seed(page, { ...histories, [KEY]: unknown });
  await page.goto('/mon-bprea/itk.html');
  await expect(page.locator('html')).toHaveAttribute('data-appearance-ready', 'true');
  await expect(page.locator('#appearance-save')).toContainText('visiteur');
  expect(await page.evaluate(key => localStorage.getItem(key), KEY)).toBe(unknown);
  await openAppearance(page).focus();
  await page.keyboard.press('Enter');
  const dialog = dialogFor(page);
  const close = dialog.getByRole('button', { name: 'Fermer les paramètres d’apparence', exact: true });
  const season = dialog.getByRole('combobox', { name: 'Saison', exact: true });
  const brightness = dialog.getByRole('combobox', { name: 'Luminosité', exact: true });
  await expect(close).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(season).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(brightness).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(season).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(season).toBeFocused();
  await page.keyboard.press('End');
  await expect(season).toHaveValue('winter');
  await page.keyboard.press('Tab');
  await expect(brightness).toBeFocused();
  await page.keyboard.press('End');
  await expect(brightness).toHaveValue('dark');
  await expect(page.locator('#appearance-save')).toContainText('enregistrées sur cet appareil');
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['light', 'dark']) {
      await brightness.selectOption(theme);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`appearance-visitor-${width}-${theme}.png`), fullPage: false, animations: 'disabled' });
    }
  }
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(openAppearance(page)).toBeFocused();
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
  expect(saved).toMatchObject({ version: 1, season: 'winter', brightness: 'dark', unrecognizedPreferencesArchive: [unknown] });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-season', 'winter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), Object.keys(histories))).toEqual(histories);
});

test('auto reste auto pendant les seuils horaires, saisons et changements d’heure locaux', async ({ page }) => {
  const original = JSON.stringify({ version: 1, season: 'auto', brightness: 'auto' });
  await seed(page, { [KEY]: original });
  await page.goto('/mon-bprea/itk.html');
  await expect(page.locator('html')).toHaveAttribute('data-appearance-ready', 'true');
  await expect(page.locator('#appearance-save')).toContainText('visiteur');
  for (const [instant, season, time, theme] of [
    ['2026-02-28T22:59:00.000Z', 'winter', 'night', 'dark'],
    ['2026-03-01T05:00:00.000Z', 'spring', 'morning', 'light'],
    ['2026-03-29T00:59:00.000Z', 'spring', 'night', 'dark'],
    ['2026-03-29T01:01:00.000Z', 'spring', 'night', 'dark'],
    ['2026-05-31T22:00:00.000Z', 'summer', 'night', 'dark'],
    ['2026-06-01T08:00:00.000Z', 'summer', 'day', 'light'],
    ['2026-10-25T00:59:00.000Z', 'autumn', 'night', 'dark'],
    ['2026-10-25T01:01:00.000Z', 'autumn', 'night', 'dark'],
    ['2026-11-30T23:00:00.000Z', 'winter', 'night', 'dark'],
  ]) {
    await page.clock.setSystemTime(new Date(instant));
    await page.evaluate(() => window.BpreaAppearance.refresh());
    await expect(page.locator('html'), instant).toHaveAttribute('data-season', season);
    await expect(page.locator('html'), instant).toHaveAttribute('data-time', time);
    await expect(page.locator('html'), instant).toHaveAttribute('data-theme', theme);
    expect(await page.evaluate(() => window.BpreaAppearance.getPreferences())).toMatchObject({ season: 'auto', brightness: 'auto' });
  }
  await page.clock.setSystemTime(new Date('2026-12-01T20:59:30.000Z'));
  await page.evaluate(() => window.BpreaAppearance.refresh());
  await expect(page.locator('html')).toHaveAttribute('data-time', 'twilight');
  await page.clock.fastForward(60000);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(key => localStorage.getItem(key), KEY)).toBe(original);
});

test('erreur de stockage : choix temporaire visible, sauvegarde et anciennes clés préservées', async ({ page }) => {
  const original = JSON.stringify({ version: 1, season: 'spring', brightness: 'light' });
  await page.addInitScript(({ key, legacy, original }) => {
    localStorage.setItem(key, original);
    localStorage.setItem(legacy, 'light');
    const nativeSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (this === localStorage && name === key) throw new DOMException('Quota de test', 'QuotaExceededError');
      return nativeSet.call(this, name, value);
    };
  }, { key: KEY, legacy: LEGACY, original });
  await page.goto('/mon-bprea/itk.html');
  await expect(page.locator('#appearance-save')).toContainText('visiteur');
  await openAppearance(page).click();
  await dialogFor(page).getByRole('combobox', { name: 'Luminosité', exact: true }).selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#appearance-save')).toContainText('stockage local est indisponible');
  await expect(page.locator('#appearance-save')).toContainText('page seulement');
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(key => localStorage.getItem(key), KEY)).toBe(original);
  expect(await page.evaluate(key => localStorage.getItem(key), LEGACY)).toBe('light');
});
