import { test, expect } from '@playwright/test';
import { copyFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { capture, renderedTextContrasts } from '../helpers/ui-review.js';
import { createSettingsAPI, accounts } from './settings-api.js';
import { waitForIdentity } from '../helpers/personal-browser.js';

const prefix = '/mon-bprea/';
const nav = page => page.getByRole('navigation', { name: 'Navigation principale', exact: true });
const toggle = (page, id) => page.locator(`[data-navigation-toggle="${id}"]`);
const panel = (page, id) => page.locator(`.primary-nav__panel--${id}`);
const settle = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

async function scene(page) {
  await page.clock.install({ time: new Date('2026-11-15T11:00:00Z') });
  await page.addInitScript(() => localStorage.setItem('bprea-demo-appearance-device-v1', JSON.stringify({ version: 1, season: 'autumn', brightness: 'light' })));
  await page.emulateMedia({ reducedMotion: 'reduce' });
}
test.beforeEach(async ({ page }) => scene(page));

async function visitor(page, file = 'index.html') {
  await page.goto(prefix + file);
  await expect(nav(page).getByRole('link', { name: 'Connexion', exact: true })).toBeVisible();
}
async function signedIn(page) {
  await createSettingsAPI().install(page.context(), 'A');
  await page.goto(prefix + 'index.html'); await waitForIdentity(page, accounts.A.id);
}
async function noUnderline(page) {
  for (const link of await nav(page).locator('.primary-nav__top-link').all()) {
    expect(await link.evaluate(node => getComputedStyle(node).textDecorationLine)).not.toContain('underline');
  }
}

test('PR2c : destinations actives sans soulignement, aria-current exact et visiteur', async ({ page }) => {
  for (const [file, name] of [['index.html', 'Accueil'], ['mes-cours.html', 'Mes cours'], ['outils.html', 'Outils'], ['connexion.html', 'Connexion']]) {
    await visitor(page, file);
    const link = nav(page).getByRole('link', { name, exact: true });
    await expect(link).toHaveAttribute('aria-current', 'page');
    await expect(nav(page).locator('.primary-nav__top-link[aria-current]')).toHaveCount(1);
    await noUnderline(page); await link.hover(); await noUnderline(page); await link.focus(); await noUnderline(page);
  }
  await expect(toggle(page, 'profile')).toHaveCount(0);
  await expect(nav(page).locator('[data-navigation-toggle="home"]')).toHaveCount(0);
  await visitor(page, 'uc.html?id=uc5');
  await expect(nav(page).getByRole('link', { name: 'Mes cours', exact: true })).not.toHaveAttribute('aria-current');
  await toggle(page, 'courses').click();
  await expect(panel(page, 'courses').locator('[aria-current="page"]')).toHaveAttribute('href', 'uc.html?id=uc5');
});

test('PR2c : hover progressif, chevron et menu ouvert distinct de la page active', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await visitor(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const entry = toggle(page, 'tools').locator('..');
  expect(await entry.evaluate(node => +getComputedStyle(node, '::before').opacity)).toBeLessThan(.1);
  expect(await entry.evaluate(node => parseFloat(getComputedStyle(node, '::before').transitionDuration))).toBeGreaterThan(0);
  const neighbor = await nav(page).getByRole('link', { name: 'Mes cours', exact: true }).boundingBox();
  await entry.hover();
  await expect.poll(() => entry.evaluate(node => +getComputedStyle(node, '::before').opacity)).toBeGreaterThan(.6);
  expect(await nav(page).getByRole('link', { name: 'Mes cours', exact: true }).boundingBox()).toEqual(neighbor);
  await toggle(page, 'tools').click();
  await expect(entry).toHaveClass(/is-open/);
  await expect(nav(page).getByRole('link', { name: 'Accueil', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(nav(page).getByRole('link', { name: 'Outils', exact: true })).not.toHaveAttribute('aria-current');
  await expect.poll(() => toggle(page, 'tools').locator('svg').evaluate(node => getComputedStyle(node).transform)).toBe('matrix(-1, 0, 0, -1, 0, 0)');
  await page.keyboard.press('Escape');
  expect(await panel(page, 'tools').evaluate(node => node.hidden && node.inert)).toBe(true);
  await expect(nav(page).getByRole('link', { name: 'Générateur ITK', exact: true })).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await toggle(page, 'tools').locator('svg').evaluate(node => getComputedStyle(node).transitionDuration)).toBe('0s');
});

test('PR2c : clavier, fermeture, passage entre menus et liens distincts', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await signedIn(page);
  for (const id of ['courses', 'tools', 'profile']) {
    const button = toggle(page, id), menu = panel(page, id);
    await button.focus(); await page.keyboard.press('Enter');
    await expect(menu.locator('a,button').first()).toBeFocused();
    await page.keyboard.press('Shift+Tab'); await expect(button).toBeFocused();
    await page.keyboard.press('Tab'); await expect(menu.locator('a,button').first()).toBeFocused();
    await page.keyboard.press('Escape'); await expect(button).toBeFocused(); await expect(menu).toBeHidden();
    await page.keyboard.press('Space'); await expect(menu).toBeVisible();
    await button.click(); await expect(menu).toBeHidden();
    await menu.locator('a').first().evaluate(node => node.focus());
    await expect(menu.locator('a').first()).not.toBeFocused();
    // The newly anchored courses panel intentionally covers part of the h1.
    // Click the visible left edge of the hero to exercise a real outside click.
    await button.click(); await page.locator('.home-hero').click({ position: { x: 24, y: 24 } }); await expect(menu).toBeHidden();
  }
  await toggle(page, 'courses').click(); await toggle(page, 'tools').click();
  await expect(panel(page, 'courses')).toBeHidden(); await expect(panel(page, 'tools')).toBeVisible();
  await expect(panel(page, 'profile').getByRole('link', { includeHidden: true })).toHaveText(['Informations du compte', 'Paramètres']);
  await expect(panel(page, 'profile').getByRole('button', { includeHidden: true })).toHaveText(['Déconnexion']);
  await nav(page).getByRole('link', { name: 'Outils', exact: true }).click();
  await expect(page).toHaveURL(/\/mon-bprea\/outils.html$/);
  await toggle(page, 'tools').click();
  await panel(page, 'tools').getByRole('link', { name: 'Ressources documentaires', exact: true }).press('Enter');
  await expect(page).toHaveURL(/\/mon-bprea\/ressources.html$/);
  await page.goto(prefix + 'profil.html'); await waitForIdentity(page, accounts.A.id);
  await expect(nav(page).getByRole('link', { name: 'Mon profil', exact: true })).toHaveAttribute('aria-current', 'page');
  await noUnderline(page);
});

test('PR2c : ancrage, cinq largeurs, redimensionnement et texte à 200 %', async ({ page }) => {
  await signedIn(page);
  for (const enlarged of [false, true]) {
    if (enlarged) await page.addStyleTag({ content: 'html{font-size:200%!important}body{font-family:Verdana,sans-serif!important}' });
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 }); await settle(page);
      for (const id of ['courses', 'tools', 'profile']) {
        const before = await page.locator('header').boundingBox();
        await toggle(page, id).click(); await expect(panel(page, id)).toBeVisible();
        const geometry = await panel(page, id).evaluate(node => ({ rect: node.getBoundingClientRect().toJSON(), z: getComputedStyle(node).zIndex, atPoint: document.elementFromPoint(node.getBoundingClientRect().x + 24, node.getBoundingClientRect().y + 24)?.closest('.primary-nav__panel') === node }));
        expect(geometry.rect.x).toBeGreaterThanOrEqual(0); expect(geometry.rect.right).toBeLessThanOrEqual(width);
        expect(geometry.atPoint).toBe(true);
        if (width > 600) {
          expect((await page.locator('header').boundingBox()).height).toBe(before.height);
          const anchor = await toggle(page, id).locator('..').boundingBox();
          expect(geometry.rect.x).toBeLessThan(anchor.x + anchor.width);
          expect(geometry.rect.right).toBeGreaterThan(anchor.x);
          expect(Math.abs(geometry.rect.top - (anchor.y + anchor.height + 12))).toBeLessThan(2);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
        await page.keyboard.press('Escape');
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 }); await settle(page);
  await toggle(page, 'tools').click();
  await page.setViewportSize({ width: 1200, height: 1000 }); await settle(page);
  const bounds = await panel(page, 'tools').boundingBox(); expect(bounds.x + bounds.width).toBeLessThanOrEqual(1200);
  await page.evaluate(() => scrollBy(0, 80));
  const scrolledPanel = await panel(page, 'tools').boundingBox(), scrolledButton = await toggle(page, 'tools').locator('..').boundingBox();
  expect(Math.abs(scrolledPanel.y - (scrolledButton.y + scrolledButton.height + 12))).toBeLessThan(2);
  await page.evaluate(() => scrollTo(0, 0));
  await page.setViewportSize({ width: 1024, height: 1000 }); await settle(page);
  await expect(panel(page, 'tools')).toBeVisible();
  const wrappedPanel = await panel(page, 'tools').boundingBox(), wrappedEntry = await toggle(page, 'tools').locator('..').boundingBox();
  expect(Math.abs(wrappedPanel.y - wrappedEntry.y - wrappedEntry.height - 12)).toBeLessThan(2);
  await page.setViewportSize({ width: 390, height: 1000 });
  await expect(panel(page, 'tools')).toBeHidden(); await expect(toggle(page, 'tools')).toBeFocused();
});

test('PR2c : surfaces réelles, quatre saisons, clair/sombre et repli sans flou', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1200 }); await signedIn(page);
  const report = [];
  for (const season of ['spring', 'summer', 'autumn', 'winter']) for (const theme of ['light', 'dark']) {
    await page.evaluate(({ season, theme }) => { document.documentElement.dataset.season = season; document.documentElement.dataset.theme = theme; }, { season, theme });
    await noUnderline(page);
    const headerRatios = await renderedTextContrasts(page, '#app-header');
    for (const row of headerRatios) expect(row.ratio, `${season}/${theme}/header: ${row.text}`).toBeGreaterThanOrEqual(4.5);
    report.push({ season, theme, id: 'header', minimum: Math.min(...headerRatios.map(r => r.ratio)) });
    for (const id of ['courses', 'tools', 'profile']) {
      await toggle(page, id).click();
      const ratios = await renderedTextContrasts(page, `.primary-nav__panel--${id}`);
      expect(ratios.length).toBeGreaterThan(0);
      for (const row of ratios) expect(row.ratio, `${season}/${theme}/${id}: ${row.text}`).toBeGreaterThanOrEqual(4.5);
      report.push({ season, theme, id, minimum: Math.min(...ratios.map(r => r.ratio)) });
      await page.keyboard.press('Escape');
    }
  }
  await page.addStyleTag({ content: '*,*::before,*::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}' });
  await toggle(page, 'tools').click();
  for (const row of await renderedTextContrasts(page, '.primary-nav__panel--tools')) expect(row.ratio).toBeGreaterThanOrEqual(4.5);
  await page.keyboard.press('Escape');
  await page.emulateMedia({ forcedColors: 'active' });
  await toggle(page, 'courses').focus();
  expect(await toggle(page, 'courses').evaluate(node => getComputedStyle(node).outlineStyle)).not.toBe('none');
  await page.keyboard.press('Space'); await expect(panel(page, 'courses')).toBeVisible();
  await testInfo.attach('navigation-contrasts.json', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
});

test('PR2c : identité tardive et ancrage conservé sans perdre le focus du menu', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await createSettingsAPI().install(page.context(), 'A');
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/assets/auth-config.json*', async route => { await gate; await route.fallback(); });
  await page.goto(prefix + 'index.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('header').getByRole('status')).toContainText('Vérification');
  await toggle(page, 'courses').click();
  release(); await waitForIdentity(page, accounts.A.id);
  await expect(panel(page, 'courses')).toBeVisible();
  await expect(panel(page, 'courses').locator('a').first()).toBeFocused();
  await expect.poll(async () => {
    const menu = await panel(page, 'courses').boundingBox(), entry = await toggle(page, 'courses').locator('..').boundingBox();
    return Math.abs(menu.x + menu.width / 2 - entry.x - entry.width / 2);
  }).toBeLessThan(1);
});

test('PR2c : vrai toucher émulé, profil et destinations des menus', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  try {
    await createSettingsAPI().install(context, 'A');
    const page = await context.newPage(); await scene(page);
    await page.goto(`http://127.0.0.1:4173${prefix}index.html`); await waitForIdentity(page, accounts.A.id);
    await toggle(page, 'profile').tap(); await expect(panel(page, 'profile')).toBeVisible();
    await toggle(page, 'profile').tap(); await expect(panel(page, 'profile')).toBeHidden();
    await toggle(page, 'courses').tap();
    await toggle(page, 'tools').tap(); await expect(panel(page, 'courses')).toBeHidden();
    await toggle(page, 'courses').tap(); await expect(panel(page, 'tools')).toBeHidden();
    await panel(page, 'courses').getByRole('link', { name: 'UC 05 Valoriser les produits ou services', exact: true }).tap();
    await expect(page).toHaveURL(/uc.html\?id=uc5$/);
    await toggle(page, 'tools').tap(); await panel(page, 'tools').getByRole('link', { name: 'Reconnaissance des plantes', exact: true }).tap();
    await expect(page).toHaveURL(/reconnaissance-plantes.html$/);
  } finally { await context.close(); }
});

test('PR2c : captures des états, menus et galerie comparative', async ({ page }, testInfo) => {
  const names = [];
  async function shot(name, menu = false) {
    if (menu) {
      const bottom = await page.locator('.primary-nav__panel:not([hidden])').evaluate(node => node.getBoundingClientRect().bottom);
      await capture(page, name, testInfo, { clip: { x: 0, y: 0, width: page.viewportSize().width, height: Math.ceil(Math.min(page.viewportSize().height, bottom + 16)) } });
    } else await capture(page.locator('header'), name, testInfo);
    names.push(name);
  }
  await page.setViewportSize({ width: 1440, height: 1100 }); await visitor(page, 'outils.html');
  await page.mouse.move(0, 0); await shot('pr2c-header-desktop-repos.png');
  await visitor(page); await page.mouse.move(0, 0); await shot('pr2c-header-desktop-accueil-actif.png');
  await nav(page).getByRole('link', { name: 'Mes cours', exact: true }).hover(); await shot('pr2c-header-desktop-hover.png');
  await page.mouse.move(0, 0);
  for (const id of ['courses', 'tools']) { await toggle(page, id).click(); await shot(`pr2c-menu-${id}-desktop.png`, true); await page.keyboard.press('Escape'); }
  await toggle(page, 'courses').focus(); await shot('pr2c-focus-clavier.png');
  await signedIn(page); await toggle(page, 'profile').click(); await shot('pr2c-menu-profile-desktop.png', true); await page.keyboard.press('Escape');
  await page.locator('#theme-toggle').click(); await page.mouse.move(0, 0); await shot('pr2c-header-desktop-dark.png');
  await toggle(page, 'tools').click(); await shot('pr2c-menu-tools-dark.png', true); await page.keyboard.press('Escape');
  await page.locator('#theme-toggle').click();
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 1100 }); await settle(page);
    await page.mouse.move(0, 0); await shot(`pr2c-header-${width}.png`);
    if (width === 390) for (const id of ['courses', 'profile']) { await toggle(page, id).click(); await shot(`pr2c-menu-${id}-mobile.png`, true); await page.keyboard.press('Escape'); }
  }
  await page.addStyleTag({ content: 'html{font-size:200%!important}' }); await page.setViewportSize({ width: 390, height: 1400 }); await settle(page);
  await shot('pr2c-header-texte-200.png');
  await toggle(page, 'courses').click(); await shot('pr2c-menu-courses-texte-200.png', true);
  const references = ['pr1-header.png', 'pr2b-header.png', 'pr1-courses.png', 'pr2b-courses.png'];
  for (const name of references) await copyFile(fileURLToPath(new URL(`../fixtures/ui-2027-pr2c/${name}`, import.meta.url)), testInfo.outputPath(name));
  const figure = (file, title = file) => `<figure><figcaption>${title}</figcaption><a href="${file}"><img src="${file}" alt="${title}" loading="lazy"></a><a href="${file}" download>Télécharger</a></figure>`;
  const html = `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Navigation PR2c</title><style>body{font:16px/1.6 system-ui;margin:24px;background:#f5f1eb;color:#292c26}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}figure{margin:0;padding:12px;background:white;border-radius:16px}img{width:100%;height:auto}figcaption{font-weight:bold}a{color:#684028}@media(max-width:800px){.grid{grid-template-columns:1fr}}</style><h1>Navigation : PR1/PR2 → PR2b → PR2c</h1><p>Même viewport 1440 px pour les trois versions desktop, colonnes à largeur identique, proportions natives. Date, saison, polices chargées et animations neutralisées. Les images PR1 et PR2b sont des preuves antérieures, pas de nouveaux snapshots approuvés.</p><div class="grid">${figure('pr1-header.png','Header PR1/PR2')}${figure('pr2b-header.png','PR2b avant ce lot')}${figure('pr2c-header-desktop-accueil-actif.png','PR2b avec navigation PR2c')}${figure('pr1-courses.png','Menu PR1/PR2')}${figure('pr2b-courses.png','Menu avant ce lot')}${figure('pr2c-menu-courses-desktop.png','Menu ancré et modernisé')}</div><h2>États et adaptations</h2><p>Accueil actif reste distinct du menu ouvert. Les panneaux desktop flottent sans déplacer le hero ; sur mobile, ils occupent le flux et défilent intérieurement. Le texte à 200 % peut augmenter fortement leur hauteur : tous les liens sont conservés. Fermeture immédiatement inerte et cachée aux technologies d’assistance ; transition visuelle discrète dans les moteurs compatibles. Aucune capture approuvée automatiquement.</p><div class="grid">${names.filter(n=>!['pr2c-header-desktop-accueil-actif.png','pr2c-menu-courses-desktop.png'].includes(n)).map(n=>figure(n)).join('')}</div><p>Les captures globales PR2b et leur galerie restent dans le même artefact Playwright.</p></html>`;
  const path = testInfo.outputPath('revue-navigation.html'); await writeFile(path, html); await testInfo.attach('revue-navigation.html', { path, contentType: 'text/html' });
});
