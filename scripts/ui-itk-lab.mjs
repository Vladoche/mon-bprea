import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rmdir, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { accounts, createSettingsAPI, settingsRow } from '../tests/e2e/settings-api.js';
import { itkScenarios } from '../tests/helpers/itk-result.js';
import { generateItk, settingsSynced } from '../tests/helpers/settings-browser.js';

const height = 1000;
const phases = ['before', 'after'];
const seasons = { spring: 'Printemps', summer: 'Été', autumn: 'Automne', winter: 'Hiver' };
const submit = '#itk-form [type="submit"]';
const nav = '.primary-nav__item';
const remembered = 'bprea-demo-itk-device-v1';
const source = JSON.stringify(itkScenarios.carotte);
const contextOptions = { locale: 'fr-FR', timezoneId: 'Europe/Paris', reducedMotion: 'reduce' };

export async function seedItkLab(context, siteUrl, { personal = false, season = 'autumn', brightness = 'light' } = {}) {
  await context.route('**/*', route => new URL(route.request().url()).origin === new URL(siteUrl).origin ? route.continue() : route.abort());
  await context.addInitScript(({ season, brightness }) => {
    localStorage.setItem('bprea-demo-appearance-device-v1', JSON.stringify({ version: 1, season, brightness }));
  }, { season, brightness });
  if (!personal) return null;
  const api = createSettingsAPI();
  await api.install(context, 'A', { [remembered]: source }, siteUrl);
  return api;
}

export function installItkObserver() {
  const events = window.itkLab = {};
  const afterPaint = callback => requestAnimationFrame(() => requestAnimationFrame(callback));
  let started;
  let opened;
  const mutations = new MutationObserver(() => {
    if (started !== undefined && document.querySelector('#itk-output .timeline-entry:last-child')) {
      const start = started;
      started = undefined;
      events.generationMs = performance.now() - start;
      afterPaint(() => { events.timelineMs = performance.now() - start; });
    }
    if (opened !== undefined && document.querySelector('.itk-import-dialog[open]')) {
      const start = opened;
      opened = undefined;
      afterPaint(() => { events.dialogMs = performance.now() - start; });
    }
  });
  mutations.observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });
  document.addEventListener('change', event => {
    if (!event.target.matches('#crop')) return;
    const start = performance.now();
    afterPaint(() => { events.parameterMs = performance.now() - start; });
  }, true);
  document.addEventListener('submit', event => {
    if (event.target.id === 'itk-form') started = performance.now();
  }, true);
  document.addEventListener('click', event => {
    if (event.target.closest('#itk-import')) opened = performance.now();
  }, true);
}

export async function measureItk(page) {
  await settingsSynced(page);
  const before = await page.evaluate(() => window.__uiMetrics.allShifts);
  await generateItk(page, itkScenarios.carotte);
  await settingsSynced(page);
  await page.locator('#itk-import').click();
  await page.waitForFunction(() => Object.keys(window.itkLab).length === 4);
  const measures = await page.evaluate(before => ({
    ...window.itkLab, interactionShift: window.__uiMetrics.allShifts - before,
  }), before);
  await page.keyboard.press('Escape');
  return measures;
}

const startAndResult = [390, 768, 1440].flatMap(width => [
  { id: 'formulaire', label: 'Formulaire initial', width },
  { id: 'resultat', label: 'Synthèse et indicateurs · Tomate Marmande', width, parameters: itkScenarios.marmande, anchor: '#itk-output' },
]);
const cases = [
  ...startAndResult,
  ...[320, 1024].map(width => ({ id: 'repli', label: 'Contrôle de largeur', width, anchor: '#itk-form' })),
  { id: 'vigilance', label: 'Carotte, surface maximale et avertissements', width: 390, parameters: itkScenarios.carotte, anchor: '.warning-block' },
  { id: 'jalons', label: 'Sept jalons et export', width: 1440, parameters: itkScenarios['tomate-plein-champ'], anchor: '.timeline' },
  { id: 'exports', label: 'Export et impression · Courgette Ronde de Nice', width: 390, parameters: itkScenarios.courgette, anchor: '.export-row' },
  { id: 'visiteur', label: 'Mémorisation dans le navigateur', width: 390, parameters: itkScenarios.marmande, anchor: '#itk-sync-panel' },
  { id: 'synchronise', label: 'Paramètres synchronisés', width: 1440, personal: true, parameters: itkScenarios.carotte, anchor: '#itk-sync-panel' },
  { id: 'attente', label: 'Enregistrement local, synchronisation en attente', width: 1440, personal: true, parameters: itkScenarios.laitue, anchor: '#itk-sync-panel' },
  { id: 'hors-ligne', label: 'API personnelle hors ligne', width: 390, personal: true, parameters: itkScenarios.marmande, anchor: '#itk-sync-panel' },
  { id: 'conflit', label: 'Conflit et choix de version', width: 390, personal: true, parameters: itkScenarios.laitue, anchor: '#itk-sync-panel' },
  { id: 'import', label: 'Aperçu de l’import personnel', width: 390, personal: true },
  { id: 'stockage', label: 'Quota bloqué, calendrier généré', width: 390, personal: true, parameters: itkScenarios.carotte, anchor: '#itk-sync-panel' },
  { id: 'sombre', label: 'Synthèse en mode sombre', width: 1440, parameters: itkScenarios.carotte, brightness: 'dark', anchor: '#itk-output' },
  { id: 'contraste', label: 'Contraste forcé', width: 390, parameters: itkScenarios.laitue, forcedColors: 'active', anchor: '#itk-output' },
];

async function captureScenario(browser, siteUrl, directory, phase, scenario) {
  const { id, width, parameters, anchor, forcedColors = 'none' } = scenario;
  const context = await browser.newContext({ ...contextOptions, viewport: { width, height }, forcedColors });
  try {
    const api = await seedItkLab(context, siteUrl, scenario);
    const page = await context.newPage();
    const fixedTime = new Date('2026-11-18T12:00:00+01:00');
    if (id === 'attente') await page.clock.install({ time: fixedTime });
    if (id === 'stockage') await page.addInitScript(() => {
      const open = IDBFactory.prototype.open;
      IDBFactory.prototype.open = function (name, ...args) {
        if (name === 'mon-bprea-settings-personal-v1') throw new DOMException('Quota de test', 'QuotaExceededError');
        return open.call(this, name, ...args);
      };
    });
    await openItk(page, siteUrl);
    const status = page.locator('#itk-sync-status');
    if (scenario.personal && id !== 'stockage') await settingsSynced(page);
    if (!scenario.personal) await expect(status).toContainText('Mode visiteur');
    if (id === 'stockage') await expect(status).toContainText('Erreur de sauvegarde');
    if (id === 'attente') await page.clock.pauseAt(new Date(+fixedTime + 60000));
    if (id === 'hors-ligne') api.restOffline = true;
    if (id === 'conflit') {
      await generateItk(page);
      await settingsSynced(page);
      api.rows.itk.set(accounts.A.id, settingsRow('itk', itkScenarios.carotte, accounts.A.id, randomUUID(), 1));
    }
    if (parameters) await generateItk(page, parameters);
    if (id === 'attente') await expect(status).toContainText('synchronisation en attente');
    if (id === 'hors-ligne') await expect(status).toContainText('Hors ligne');
    if (id === 'stockage') await expect(page.locator('#itk-action-message')).toContainText('paramètres non sauvegardés');
    if (id === 'synchronise') await expect(status).toHaveText('Paramètres synchronisés.');
    if (id === 'conflit') {
      await expect(status).toContainText('Conflit');
      await page.locator('#itk-conflicts summary').click();
    }
    if (id === 'import') {
      await page.locator('#itk-import').click();
      await expect(page.locator('.itk-import-dialog')).toBeVisible();
    } else await anchorPage(page, anchor);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: resolve(directory, `${phase}-${id}-${width}.png`) });
  } finally { await context.close(); }
}

async function openItk(page, siteUrl) {
  const url = new URL('itk.html', siteUrl).href;
  try {
    await page.goto(url);
  } catch (error) {
    // Chromium on Windows may temporarily run out of socket buffers during capture.
    if (!error.message.includes('net::ERR_NO_BUFFER_SPACE')) throw error;
    await page.goto(url);
  }
}

async function anchorPage(page, anchor) {
  if (anchor) await page.locator(anchor).evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
  else await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
}

function luminance(color) {
  const channels = color.match(/[\d.]+/g).slice(0, 3).map(value => Number(value) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}

function ratio(first, second) {
  const [dark, light] = [luminance(first), luminance(second)].sort((a, b) => a - b);
  return Number(((light + .05) / (dark + .05)).toFixed(2));
}

async function buttonStyles(page) {
  return page.evaluate(selectors => {
    const read = (element, pseudo) => {
      const style = getComputedStyle(element, pseudo);
      return Object.fromEntries(['backgroundImage', 'borderColor', 'borderRadius', 'boxShadow', 'color', 'minHeight',
        'fontSize', 'fontWeight', 'lineHeight', 'outlineColor', 'outlineWidth', 'transitionDuration'].map(key => [key, style[key]]));
    };
    return Object.fromEntries(Object.entries(selectors).filter(([, selector]) => document.querySelector(selector)).map(([key, selector]) => {
      const button = document.querySelector(selector);
      return [key, { ...read(button), reflection: read(button, '::before').backgroundImage }];
    }));
  }, {
    nav: `${nav}:not(.active) .primary-nav__entry`,
    navAccent: `${nav}.active .primary-nav__entry`,
    navText: `${nav}:not(.active) .primary-nav__top-link`,
    navAccentText: `${nav}.active .primary-nav__top-link`,
    generate: submit, export: '#csv-export', refresh: '#itk-refresh', confirm: '#itk-import-confirm', cancel: '#itk-import-cancel',
    warning: '.warning-block',
  });
}

async function captureButtons(browser, { origin, directory }) {
  const plates = [];
  const contrasts = [];
  const painted = ({ backgroundImage, borderColor, borderRadius, boxShadow, minHeight, reflection }) =>
    ({ backgroundImage, borderColor, borderRadius, boxShadow, minHeight, reflection });
  const lettering = ({ color, fontSize, fontWeight, lineHeight }) => ({ color, fontSize, fontWeight, lineHeight });
  async function capture(phase, scenario, options = {}) {
    const { id, season = 'autumn', brightness = 'light', forcedColors = 'none', state = 'normal' } = scenario;
    const siteUrl = `${origin}/${phase}/`;
    const context = await browser.newContext({ ...contextOptions, viewport: { width: 1440, height }, forcedColors });
    try {
      await seedItkLab(context, siteUrl, { season, brightness, personal: state !== 'disabled' });
      const page = await context.newPage();
      await openItk(page, siteUrl);
      await page.evaluate(() => document.fonts.ready);
      const focusGenerate = async () => {
        await page.locator('#itk-form :is(select, input)').last().focus();
        await page.keyboard.press('Tab');
        await expect(page.locator(submit)).toBeFocused();
      };
      const shot = async (selector, name) => {
        const file = `${phase}-boutons-${id}-${name}.png`;
        await page.locator(selector).screenshot({ path: resolve(directory, file), timeout: 10000 });
        return file;
      };
      async function generateShot() {
        const button = page.locator(submit);
        const file = `${phase}-boutons-${id}-action.png`;
        const { x, y, width, height } = await button.boundingBox();
        const padding = 8;
        const clipX = Math.max(0, x - padding), clipY = Math.max(0, y - padding);
        const clip = { x: clipX, y: clipY, width: width + padding + x - clipX, height: height + padding + y - clipY };
        await page.screenshot({ path: resolve(directory, file), clip });
        return file;
      }
      if (state === 'disabled') {
        await expect(page.locator('#itk-remember')).toBeDisabled();
        return { images: [await shot('#itk-remember', 'indisponible')] };
      }
      await settingsSynced(page);
      await generateItk(page);
      await settingsSynced(page);
      await page.mouse.move(0, 0);
      const styles = await buttonStyles(page);
      if (phase === 'after' && forcedColors === 'none') {
        assert.deepEqual(painted(styles.generate), painted(styles.navAccent), id);
        assert.deepEqual(painted(styles.export), painted(styles.nav), id);
        assert.deepEqual(lettering(styles.generate), lettering(styles.navAccentText), id);
        assert.deepEqual(lettering(styles.export), lettering(styles.navText), id);
        if (options.before.generate.backgroundImage === 'none') {
          const header = ({ nav, navAccent, navText, navAccentText }) => ({ nav, navAccent, navText, navAccentText });
          assert.deepEqual(header(styles), header(options.before), id);
        }
        if (state === 'normal') {
          const gradientColors = style => style.backgroundImage.match(/rgba?\([^)]*\)/g);
          const warningBackground = await page.locator('.warning-block').evaluate(element => getComputedStyle(element).backgroundColor);
          await focusGenerate();
          const focus = await page.locator(submit).evaluate(element => ({
            foreground: getComputedStyle(element).outlineColor,
            background: getComputedStyle(element.closest('section')).backgroundColor,
          }));
          await page.locator(submit).blur();
          const row = { season, brightness,
            primary: Math.min(...gradientColors(styles.generate).map(color => ratio(styles.generate.color, color))),
            secondary: Math.min(...gradientColors(styles.export).map(color => ratio(styles.export.color, color))),
            warning: ratio(styles.warning.color, warningBackground),
            focus: ratio(focus.foreground, focus.background),
          };
          assert.ok(Math.min(row.primary, row.secondary, row.warning) >= 4.5 && row.focus >= 3, JSON.stringify(row));
          contrasts.push(row);
        }
      }
      if (state === 'hover') {
        await page.locator(`${nav}.active .primary-nav__top-link`).hover();
      }
      if (state === 'focus') {
        await page.locator('#app-header .brand').focus();
        await page.keyboard.press('Tab');
      }
      const images = [await shot(state === 'focus' ? '#app-header' : '.primary-nav__list', 'header')];
      if (state === 'hover') await page.locator(submit).hover();
      if (state === 'focus') await focusGenerate();
      if (state === 'pressed') {
        await page.locator(submit).hover();
        await page.mouse.down();
      }
      await page.locator(submit).scrollIntoViewIfNeeded();
      images.push(await generateShot());
      if (state === 'pressed') await page.mouse.up();
      if (state === 'normal') {
        images.push(await shot('.export-row', 'exports'), await shot('#itk-sync-panel', 'sauvegarde'));
        await page.locator('#itk-import').click();
        images.push(await shot('.itk-import-dialog', 'dialogue'));
      }
      return { styles, images };
    } finally { await context.close(); }
  }
  const variants = [
    ...Object.entries(seasons).flatMap(([season, label]) => ['light', 'dark'].map(brightness => ({
      id: `${season}-${brightness}`, label: `${label} · ${brightness === 'light' ? 'clair' : 'sombre'}`, season, brightness,
    }))),
    { id: 'survol', label: 'Survol · mouvement réduit', state: 'hover' },
    { id: 'focus', label: 'Focus clavier', state: 'focus' },
    { id: 'actif', label: 'Bouton pressé', state: 'pressed' },
    { id: 'indisponible', label: 'Mémorisation indisponible avant calcul', state: 'disabled' },
    { id: 'force', label: 'Contraste forcé', forcedColors: 'active' },
  ];
  for (const scenario of variants) {
    const before = await capture('before', scenario);
    const after = await capture('after', scenario, { before: before.styles });
    plates.push({ ...scenario, before: before.images, after: after.images });
  }
  await writeFile(resolve(directory, 'contrastes.json'), JSON.stringify(contrasts, null, 2));
  return plates;
}

async function captureNativeZoom(origin, directory) {
  const extension = await mkdtemp(resolve(directory, 'zoom-extension-'));
  const manifest = resolve(extension, 'manifest.json');
  const workerFile = resolve(extension, 'worker.js');
  await writeFile(manifest, JSON.stringify({ manifest_version: 3, name: 'Mesure locale du zoom', version: '1', permissions: ['tabs'], background: { service_worker: 'worker.js' } }));
  await writeFile(workerFile, 'chrome.runtime.onInstalled.addListener(() => {});');
  const measures = [];
  try {
    for (const phase of phases) {
      const siteUrl = `${origin}/${phase}/`;
      const context = await chromium.launchPersistentContext('', { ...contextOptions, channel: 'chromium',
        args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`], viewport: { width: 1440, height } });
      try {
        const page = context.pages()[0];
        const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
        const cdp = await context.newCDPSession(page);
        await seedItkLab(context, siteUrl, { personal: true });
        for (const width of [1440, 780]) {
          await page.setViewportSize({ width, height });
          await openItk(page, siteUrl);
          const level = await worker.evaluate(async url => {
            const [tab] = (await chrome.tabs.query({})).filter(item => item.url === url);
            await chrome.tabs.setZoom(tab.id, 2);
            return chrome.tabs.getZoom(tab.id);
          }, page.url());
          assert.equal(level, 2);
          await page.waitForFunction(cssWidth => innerWidth === cssWidth, width / 2);
          await generateItk(page, itkScenarios.carotte);
          await settingsSynced(page);
          await anchorPage(page, '#itk-output');
          const info = await page.evaluate(() => ({ cssWidth: innerWidth, dpr: devicePixelRatio, scrollWidth: document.documentElement.scrollWidth }));
          if (phase === 'after') assert.ok(info.scrollWidth <= info.cssWidth && info.dpr === 2);
          await expect(page.locator('#itk-output h2')).toBeInViewport();
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          // Capture the viewport as painted by Chromium. Playwright's clip
          // uses unzoomed coordinates and can return a blank image after scrolling.
          const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
          await writeFile(resolve(directory, `${phase}-zoom-${width}.png`), Buffer.from(data, 'base64'));
          const trigger = page.locator('#itk-import');
          await trigger.click();
          await expect(page.locator('.itk-import-dialog')).toBeVisible();
          await page.keyboard.press('Escape');
          await expect(trigger).toBeFocused();
          measures.push({ phase, width, ...info });
        }
      } finally { await context.close(); }
    }
  } finally {
    await unlink(manifest);
    await unlink(workerFile);
    await rmdir(extension);
  }
  await writeFile(resolve(directory, 'zoom.json'), JSON.stringify(measures, null, 2));
}

const figure = (file, title) => `<figure><figcaption>${title}</figcaption><a href="${file}"><img loading="lazy" src="${file}" alt="${title}"></a></figure>`;
const gallery = (title, baselineRef, body) => `<!doctype html><html lang="fr"><meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>body{margin:2rem auto;padding:0 1rem;max-width:94rem;background:#faf7f0;color:#342f28;font:1rem/1.5 system-ui}
    code{overflow-wrap:anywhere}h2{margin:1.75rem 0 .5rem;font-size:1.125rem}h3{margin-top:0}
    .pair{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr));gap:1rem}
    .samples{display:flex;flex-wrap:wrap;align-items:start;gap:.5rem}figure{margin:0}figcaption{font-weight:650;margin-bottom:.3rem}
    img{display:block;max-width:100%;height:auto;border:1px solid #c9c2b5}a:focus-visible{outline:3px solid #3158b3;outline-offset:3px}</style>
  <h1>${title}</h1><p>Référence <code>${baselineRef}</code>. Captures Chromium, données fictives. Ouvre chaque image à sa taille d’origine.</p>${body}</html>`;

export async function writeItkReview(browser, { origin, baselineRef, directory }) {
  await mkdir(directory, { recursive: true });
  for (const scenario of cases) for (const phase of phases) {
    await captureScenario(browser, `${origin}/${phase}/`, directory, phase, scenario);
  }
  const plates = await captureButtons(browser, { origin, directory });
  await captureNativeZoom(origin, directory);
  for (const phase of phases) {
    const context = await browser.newContext({ ...contextOptions, viewport: { width: 1440, height } });
    try {
      const siteUrl = `${origin}/${phase}/`;
      await seedItkLab(context, siteUrl, { brightness: 'dark' });
      const page = await context.newPage();
      await openItk(page, siteUrl);
      await generateItk(page, itkScenarios.carotte);
      await page.pdf({ path: resolve(directory, `${phase}-impression.pdf`), format: 'A4', margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' } });
    } finally { await context.close(); }
  }
  const rows = [
    ...cases.map(({ id, label, width }) => ({ label: `${label} · ${width} × ${height}`, image: phase => `${phase}-${id}-${width}.png` })),
    ...[1440, 780].map(width => ({ label: `Zoom navigateur 200 % · ${width} pixels physiques`, image: phase => `${phase}-zoom-${width}.png` })),
  ];
  const navLinks = '<p><a href="boutons.html">Planche des boutons et du header</a> · <a href="before-impression.pdf">Impression de référence</a> · <a href="after-impression.pdf">Impression refondue</a></p>';
  await writeFile(resolve(directory, 'index.html'), gallery('Générateur ITK · Avant et après', baselineRef, navLinks +
    rows.map(({ label, image }) => `<section><h2>${label}</h2><div class="pair">${figure(image('before'), 'Référence')}${figure(image('after'), 'Refonte')}</div></section>`).join('')));
  await writeFile(resolve(directory, 'boutons.html'), gallery('Générateur ITK · Boutons et header', baselineRef,
    '<p><a href="index.html">Galerie principale</a> · <a href="contrastes.json">Mesures de contraste</a></p>' +
    plates.map(plate => `<section><h2>${plate.label}</h2><div class="pair">${phases.map(phase => `<div><h3>${phase === 'before' ? 'Référence' : 'Refonte'}</h3><div class="samples">
      ${plate[phase].map(file => figure(file, file.split('-').at(-1).replace('.png', ''))).join('')}</div></div>`).join('')}</div></section>`).join('')));
}
