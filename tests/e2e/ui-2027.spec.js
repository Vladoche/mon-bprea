import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { createSettingsAPI, accounts } from './settings-api.js';
import { waitForIdentity } from '../helpers/personal-browser.js';

const prefix = '/mon-bprea/';
const instant = new Date('2026-11-15T11:00:00.000Z');
const nav = page => page.getByRole('navigation', { name: 'Navigation principale', exact: true });
const disclosure = (page, name) => nav(page).getByRole('button', { name: new RegExp(`^(?:Afficher|Masquer) les sous-rubriques de ${name}$`) });

async function appearance(page, brightness = 'light') {
  await page.clock.install({ time: instant });
  await page.addInitScript(value => localStorage.setItem('bprea-demo-appearance-device-v1', JSON.stringify({ version: 1, season: 'autumn', brightness: value })), brightness);
  await page.emulateMedia({ reducedMotion: 'reduce' });
}

async function capture(target, name, testInfo, extra = {}) {
  const options = { animations: 'disabled', caret: 'hide', ...extra };
  if (typeof target.goto === 'function' && !extra.clip) options.fullPage = true;
  // New images are review artifacts. Only a separately approved, committed
  // reference enables pixel regression assertions; this run approves nothing.
  if (existsSync(testInfo.snapshotPath(name))) await expect(target).toHaveScreenshot(name, options);
  const path = testInfo.outputPath(name);
  await target.screenshot({ ...options, path });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

async function captureMenu(page, name, testInfo) {
  const clip = await page.evaluate(() => {
    const boxes = [document.querySelector('header'), document.querySelector('.primary-nav__panel:not([hidden])')].map(node => node.getBoundingClientRect());
    const x = Math.max(0, Math.floor(Math.min(...boxes.map(box => box.left)) + scrollX - 8));
    const y = Math.max(0, Math.floor(Math.min(...boxes.map(box => box.top)) + scrollY - 8));
    return { x, y, width: Math.min(document.documentElement.scrollWidth - x, Math.ceil(Math.max(...boxes.map(box => box.right)) + scrollX + 8 - x)), height: Math.ceil(Math.max(...boxes.map(box => box.bottom)) + scrollY + 8 - y) };
  });
  await capture(page, name, testInfo, { clip });
}

async function textContrasts(target) {
  return target.evaluateAll(nodes => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const rgba = value => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data].map((value, index) => index === 3 ? value / 255 : value); };
    const blend = (front, back) => [...front.slice(0, 3).map((channel, index) => channel * front[3] + back[index] * (1 - front[3])), 1];
    const light = value => value.slice(0, 3).map(channel => { const x = channel / 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }).reduce((sum, x, index) => sum + x * [.2126, .7152, .0722][index], 0);
    return nodes.map(node => {
      const ancestors = []; for (let parent = node; parent; parent = parent.parentElement) ancestors.push(parent);
      let backgrounds = [[255, 255, 255, 1]];
      for (const parent of ancestors.reverse()) {
        const style = getComputedStyle(parent);
        backgrounds = backgrounds.map(background => blend(rgba(style.backgroundColor), background));
        const stops = style.backgroundImage.match(/rgba?\([^)]*\)/g);
        if (stops) backgrounds = backgrounds.flatMap(background => stops.map(stop => blend(rgba(stop), background)));
      }
      const ratios = backgrounds.map(background => {
        const text = blend(rgba(getComputedStyle(node).color), background);
        const values = [light(text), light(background)].sort((a, b) => b - a);
        return (values[0] + .05) / (values[1] + .05);
      });
      return { text: node.textContent.trim(), ratio: Math.min(...ratios), color: getComputedStyle(node).color, composedBackgrounds: backgrounds.map(value => value.slice(0, 3)) };
    });
  });
}

test('fondations : captures clair/sombre, menus, footer et page pédagogique', async ({ page }, testInfo) => {
  await appearance(page);
  for (const [width, device] of [[1440, 'desktop'], [390, 'mobile']]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${prefix}index.html`);
    await expect(nav(page).getByRole('link', { name: 'Connexion', exact: true })).toBeVisible();
    for (const brightness of ['light', 'dark']) {
      if (await page.locator('html').getAttribute('data-theme') !== brightness) await page.locator('#theme-toggle').click();
      await capture(page, `home-${device}-${brightness}.png`, testInfo);
    }
    await capture(page.locator('footer'), `footer-${device}.png`, testInfo);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('#theme-toggle').click();
  for (const name of ['Mes cours', 'Outils']) {
    await disclosure(page, name).click();
    await captureMenu(page, `header-${name === 'Outils' ? 'tools' : 'courses'}.png`, testInfo);
    await page.keyboard.press('Escape');
  }
  await page.goto(`${prefix}cours.html?id=matiere-organique`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await capture(page, 'course-desktop.png', testInfo);
});

test('navigation : cinq largeurs, clavier, resize, texte agrandi et contraste forcé', async ({ page }) => {
  await appearance(page);
  await page.goto(`${prefix}index.html`);
  await expect(nav(page).locator('.primary-nav__list > li')).toHaveCount(4);
  await expect(page.locator('header .brand')).toHaveAttribute('href', 'index.html');
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const name of ['Mes cours', 'Outils']) {
      const button = disclosure(page, name);
      await button.focus();
      await page.keyboard.press('Enter');
      const panel = page.locator(`#${await button.getAttribute('aria-controls')}`);
      await expect(panel).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px`).toBe(true);
      await expect(panel.getByRole('link').first()).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(button).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(panel.getByRole('link').first()).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(panel).toBeHidden();
      await expect(button).toBeFocused();
    }
    await disclosure(page, 'Outils').click();
    await page.locator('h1').click();
    await expect(disclosure(page, 'Outils')).toHaveAttribute('aria-expanded', 'false');
  }
  await disclosure(page, 'Mes cours').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(disclosure(page, 'Mes cours')).toHaveAttribute('aria-expanded', 'false');
  // 200% text enlargement complements the 320px reflow check.
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  const button = disclosure(page, 'Outils');
  await page.keyboard.press('Tab');
  await button.focus();
  expect(await button.evaluate(node => getComputedStyle(node).outlineStyle)).not.toBe('none');
  await button.press('Enter');
  await expect(page.locator(`#${await button.getAttribute('aria-controls')}`)).toBeVisible();
});

test('navigation tactile : ouverture explicite et destination réelle sur smartphone', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  try {
    const page = await context.newPage();
    await appearance(page);
    await page.goto(`http://127.0.0.1:4173${prefix}index.html`);
    await disclosure(page, 'Outils').tap();
    await nav(page).getByRole('link', { name: 'Générateur ITK', exact: true }).tap();
    await expect(page).toHaveURL(/\/mon-bprea\/itk\.html$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Construire un itinéraire technique.');
  } finally { await context.close(); }
});

test('compte : trois destinations, paramètres, captures et déconnexion sans perte locale', async ({ page }, testInfo) => {
  const saved = '{"matiere-organique":{"done":true,"score":2}}';
  const api = createSettingsAPI();
  await api.install(page.context(), 'A', { 'bprea-demo-progress-v1': saved });
  await appearance(page);
  await page.goto(`${prefix}index.html`);
  await waitForIdentity(page, accounts.A.id);
  for (const [width, device] of [[1440, 'desktop'], [390, 'mobile']]) {
    await page.setViewportSize({ width, height: 1000 });
    await disclosure(page, 'Mon profil').click();
    const panel = page.locator('.primary-nav__panel--profile');
    await expect(panel.getByRole('link')).toHaveText(['Informations du compte', 'Paramètres']);
    await expect(panel.getByRole('button')).toHaveText(['Déconnexion']);
    await expect(panel.getByRole('heading')).toHaveCount(0);
    await expect(page.locator('header #appearance-open')).toHaveCount(0);
    await expect(page.locator('header').getByRole('button', { name: 'Déconnexion', exact: true })).toHaveCount(1);
    await captureMenu(page, `profile-${device}.png`, testInfo);
    await page.keyboard.press('Escape');
    await expect(disclosure(page, 'Mon profil')).toBeFocused();
  }
  await disclosure(page, 'Mon profil').click();
  await page.getByRole('link', { name: 'Informations du compte', exact: true }).click();
  await expect(page).toHaveURL(/profil\.html#informations-compte$/);
  await expect(page.locator('#informations-compte')).toBeVisible();
  await disclosure(page, 'Mon profil').click();
  await nav(page).getByRole('link', { name: 'Paramètres', exact: true }).click();
  await expect(page).toHaveURL(/profil\.html#parametres$/);
  await page.locator('#appearance-open').click();
  await expect(page.getByRole('dialog', { name: 'Ton apparence', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#appearance-open')).toBeFocused();
  await disclosure(page, 'Mon profil').click();
  await page.locator('header').getByRole('button', { name: 'Déconnexion', exact: true }).click();
  await expect(nav(page).getByRole('link', { name: 'Connexion', exact: true })).toBeVisible();
  await expect(page.locator('header').getByRole('button', { name: 'Déconnexion', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('bprea-demo-progress-v1'))).toBe(saved);
  await expect(page.locator('header')).not.toContainText(accounts.A.email);
});

test('compte : vérification discrète et identité hors ligne conservée', async ({ page }) => {
  const api = createSettingsAPI();
  await api.install(page.context());
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/assets/auth-config.json*', async route => { await gate; await route.fallback(); });
  await appearance(page);
  await page.goto(`${prefix}index.html`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('header').getByRole('status')).toContainText(/Vérification/);
  await expect(nav(page).getByRole('link', { name: 'Mon profil', exact: true })).toHaveCount(0);
  await expect(nav(page).getByRole('link', { name: 'Mes cours', exact: true })).toBeVisible();
  release();
  await waitForIdentity(page, accounts.A.id);
  api.authOffline = true;
  await waitForIdentity(page, accounts.A.id, { status: 'offline', retry: true });
  await expect(nav(page).getByRole('link', { name: 'Mon profil', exact: true })).toBeVisible();
  await disclosure(page, 'Mon profil').click();
  await expect(page.locator('.primary-nav__panel--profile')).toBeVisible();
});

test('compte : échec de déconnexion annoncé, navigation et données préservées', async ({ page }) => {
  const saved = '{"matiere-organique":{"done":true,"score":2}}';
  const api = createSettingsAPI();
  await api.install(page.context(), 'A', { 'bprea-demo-progress-v1': saved });
  await page.route('**/auth/v1/logout*', route => route.fulfill({ status: 400, json: { code: 'synthetic_logout_failure', message: 'Synthetic provider detail' } }));
  await appearance(page);
  await page.goto(`${prefix}index.html`);
  await waitForIdentity(page, accounts.A.id);
  await disclosure(page, 'Mon profil').click();
  await page.locator('header').getByRole('button', { name: 'Déconnexion', exact: true }).click();
  await expect(page.locator('header').getByRole('alert')).toContainText(/échoué/);
  await expect(nav(page).getByRole('link', { name: 'Connexion', exact: true })).toBeVisible();
  await expect(nav(page).getByRole('link', { name: 'Mes cours', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('bprea-demo-progress-v1'))).toBe(saved);
  await expect(page.locator('header')).not.toContainText('Synthetic provider detail');
});

test('visiteur : icône de luminosité et paramètres avancés par le footer', async ({ page }) => {
  await appearance(page);
  await page.goto(`${prefix}index.html`);
  const toggle = page.locator('#theme-toggle');
  await expect(toggle).toHaveAccessibleName('Activer le mode sombre');
  await expect(toggle.locator('svg')).toHaveCount(1);
  expect(await toggle.innerText()).toBe('');
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(toggle).toHaveAccessibleName('Activer le mode clair');
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const links = page.locator('footer a[href]');
  for (const link of await links.all()) {
    const href = await link.getAttribute('href');
    expect(href).toMatch(/^[a-z-]+\.html(?:#[a-z-]+)?$/);
    expect((await page.request.get(prefix + href.split('#')[0])).status(), href).toBe(200);
  }
  await page.locator('footer a[href="profil.html#parametres"]').click();
  await expect(page.locator('#parametres')).toBeVisible();
  await page.locator('#appearance-open').press('Enter');
  await expect(page.getByRole('dialog', { name: 'Ton apparence', exact: true })).toBeVisible();
});

test('accessibilité partagée : noms, focus, cibles et contrastes des surfaces composées', async ({ page }, testInfo) => {
  await appearance(page);
  await page.goto(`${prefix}index.html`);
  const report = [];
  for (const brightness of ['light', 'dark']) {
    if (await page.locator('html').getAttribute('data-theme') !== brightness) await page.locator('#theme-toggle').click();
    await page.keyboard.press('Tab');
    for (const control of await page.locator('header button, header .primary-nav__top-link, header .account-link').all()) {
      await expect(control).toHaveAccessibleName(/\S/);
      const box = await control.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(24);
      await control.focus();
      expect(await control.evaluate(node => getComputedStyle(node).outlineStyle)).not.toBe('none');
    }
    // Resolve CSS colors through the browser, including color-mix and alpha.
    // Shared surfaces have solid layers and simple gradients. Compare all
    // gradient stops as well as alpha-composited solid layers, not photographs.
    const contrasts = await textContrasts(page.locator('header .primary-nav__top-link, header .account-link, footer a, footer h2'));
    for (const contrast of contrasts) expect(contrast.ratio, `${brightness} ${contrast.text}`).toBeGreaterThanOrEqual(4.5);
    report.push({ brightness, contrasts });
  }
  await testInfo.attach('shared-accessibility.json', { body: JSON.stringify({ scope: 'shared names, keyboard focus, target sizes and composed text contrast including simple gradient stops; not a full WCAG audit', report }, null, 2), contentType: 'application/json' });
});

for (const file of ['contact', 'confidentialite']) test(`page autonome ${file} : sans JavaScript, liens réels et capture`, async ({ browser }, testInfo) => {
  for (const colorScheme of ['light', 'dark']) {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 1000 }, colorScheme, locale: 'fr-FR' });
    try {
      const page = await context.newPage(), requests = [];
      page.on('request', request => requests.push(request.url()));
      await page.goto(`http://127.0.0.1:4173${prefix}${file}.html`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator('footer')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(requests.some(url => /auth-config|app\.js|supabase/.test(url))).toBe(false);
      const contrasts = await textContrasts(page.locator('footer a, footer h2'));
      for (const contrast of contrasts) expect(contrast.ratio, `${file} ${colorScheme} ${contrast.text}`).toBeGreaterThanOrEqual(4.5);
      await capture(page, `${file}-nojs${colorScheme === 'dark' ? '-dark' : ''}.png`, testInfo);
    } finally { await context.close(); }
  }
});
