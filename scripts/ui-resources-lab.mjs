import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rmdir, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { libraryCatalog, libraryPdf, librarySheet } from '../tests/fixtures/resource-library.js';
import { itkScenarios } from '../tests/helpers/itk-result.js';
import { generateItk } from '../tests/helpers/settings-browser.js';

const phases = ['before', 'after'];
const height = 1000;
const cssWidths = [320, 390, 768, 1024, 1440];
const documentCard = `#library-resource-${libraryPdf.id}`;
const fixture = libraryCatalog([
  libraryPdf,
  librarySheet,
  {
    id: 'site-de-recette', title: 'Atelier des couverts végétaux', description: 'Une référence fictive avec un lien de consultation externe.',
    organization: 'Association de démonstration', type: 'website', url: 'https://example.test/atelier',
    themes: ['Semences'], units: ['uc2', 'uc3'],
  },
]);

export function largeResourceCatalog() {
  const copies = Array.from({ length: 299 }, (_, index) => ({
    ...libraryPdf, id: `pdf-${index}`, title: `Notice ${index} du sol vivant`,
  })).concat(Array.from({ length: 298 }, (_, index) => ({
    ...librarySheet, id: `fiche-${index}`, title: `Fiche ${index} de compostage`,
    organization: index % 2 ? 'Atelier fictif' : 'Institut documentaire de démonstration',
  })));
  return libraryCatalog([...fixture.resources, ...copies]);
}

export function installResourceObserver() {
  const entries = window.resourceLab = {};
  new MutationObserver(() => {
    if (entries.firstCardMs === undefined && document.querySelector('#resource-grid article')) {
      entries.firstCardMs = performance.now();
    }
    if (entries.pdfMs === undefined && document.querySelector('.library-download')) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        entries.pdfMs ??= performance.now();
      }));
    }
  }).observe(document, { childList: true, subtree: true });
  for (const [eventType, selector, metric] of [
    ['input', '#resource-search', 'filterMs'],
    ['change', '#resource-sort', 'sortMs'],
    ['reset', '.library-filters', 'resetMs'],
  ]) {
    document.addEventListener(eventType, event => {
      if (!event.target.matches(selector)) return;
      const start = performance.now();
      requestAnimationFrame(() => requestAnimationFrame(() => {
        entries[metric] = performance.now() - start;
      }));
    }, true);
  }
}

export async function measureResources(page, large) {
  await page.waitForFunction(() => Number.isFinite(window.resourceLab.pdfMs));
  const before = await page.evaluate(() => ({ shifts: window.__uiMetrics.allShifts, scrollY }));
  await page.locator('#resource-search').fill(large ? 'fiche' : 'sol');
  await page.locator('#resource-sort').selectOption('added-desc');
  await page.locator('.library-reset').click();
  await page.waitForFunction(() => Number.isFinite(window.resourceLab.resetMs));
  return page.evaluate(({ shifts, scrollY: beforeScroll }) => ({
    ...window.resourceLab,
    actionShift: window.__uiMetrics.allShifts - shifts,
    scrollDelta: scrollY - beforeScroll,
  }), before);
}

const reviewCases = [
  ...cssWidths.map(width => ({ name: `initial-${width}`, width })),
  { name: 'recherche', query: '?q=compost', at: '.library-filters' },
  { name: 'avances', open: true, at: '.library-filters' },
  { name: 'combinaison', query: '?unit=uc3&type=pdf&theme=Sol+et+fertilit%C3%A9&lesson=matiere-organique&chapter=uc3-sol-vivant', at: '.library-filters' },
  { name: 'tri-date', query: '?sort=added-desc', at: '.library-results-bar' },
  { name: 'sans-resultat', query: '?q=aucunmot', at: '#resource-empty' },
  { name: 'vide', catalog: [], at: '#resource-empty' },
  { name: 'chargement', catalog: 'pending', at: 'main .page-top' },
  { name: 'erreur', catalog: 'error', at: '.library-notice' },
  { name: 'site', query: '?type=website', at: '#library-resource-site-de-recette' },
  { name: 'fiche-technique', query: '?type=technical-sheet', at: '#library-resource-fiche-technique' },
  { name: 'pdf', query: '?type=pdf', at: documentCard },
  { name: 'pdf-introuvable', query: '?type=pdf', pdf: 404, at: documentCard },
  { name: 'pdf-non-verifiable', query: '?type=pdf', pdf: 503, at: documentCard },
  { name: 'metadonnees', query: '?type=pdf', metadata: true, at: documentCard, width: 390 },
  { name: 'cours', file: 'cours.html?id=matiere-organique', at: '#course-resources' },
  { name: 'uc', file: 'uc.html?id=uc3', at: '#unit-resources' },
  { name: 'sombre', brightness: 'dark', query: '?type=pdf', at: '.library-filters' },
  ...['spring', 'summer', 'autumn', 'winter'].map(season => ({ name: season, season, width: 768 })),
  { name: 'contraste-force', forcedColors: 'active', query: '?type=pdf', at: '.library-filters' },
];

async function seed(context, origin, { season = 'autumn', brightness = 'light', catalog, pdf } = {}) {
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await context.addInitScript(({ season, brightness }) => {
    localStorage.setItem('bprea-demo-appearance-device-v1', JSON.stringify({ version: 1, season, brightness }));
  }, { season, brightness });
  if (catalog !== undefined) {
    await context.route('**/assets/resources.json*', route => {
      if (catalog === 'pending') return;
      if (catalog === 'error') return route.fulfill({ status: 503 });
      return route.fulfill({ json: libraryCatalog(catalog) });
    });
  }
  if (pdf) await context.route('**/documents/fiche-demo-matiere-organique.pdf', route => route.fulfill({ status: pdf }));
}

async function openLibrary(page, origin, phase, scenario = {}) {
  const file = scenario.file || 'ressources.html';
  await page.goto(`${origin}/${phase}/${file}${scenario.query || ''}`);
  await page.locator('.primary-nav__top-link').first().waitFor();
  if (file === 'ressources.html' && !['pending', 'error'].includes(scenario.catalog)) await page.locator('#resource-count').waitFor();
  if (scenario.open) await page.locator('.library-more-filters > summary').click();
  if (scenario.metadata) await page.locator(`${documentCard} .library-record > summary`).click();
  await page.evaluate(() => document.fonts.ready);
  if (scenario.at) {
    await page.locator(scenario.at).evaluate(node => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
  }
}

async function viewportCheck(page) {
  return page.evaluate(() => ({
    cssWidth: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    dpr: devicePixelRatio,
    overflow: [...document.querySelectorAll('.library-filters, .library-card, .library-action-links, .library-record')].filter(node => {
      const { left, right, width } = node.getBoundingClientRect();
      return width > 0 && (left < -1 || right > innerWidth + 1 || node.scrollWidth > node.clientWidth + 2);
    }).map(node => node.className),
  }));
}

async function shot(page, directory, name) {
  await page.screenshot({ path: resolve(directory, `${name}.png`), animations: 'disabled' });
}

async function captureScenario(browser, origin, directory, phase, scenario) {
  const context = await browser.newContext({
    viewport: { width: scenario.width || 1440, height }, locale: 'fr-FR', timezoneId: 'Europe/Paris',
    reducedMotion: 'reduce', forcedColors: scenario.forcedColors,
  });
  try {
    const fixtureCatalog = scenario.catalog ?? (scenario.name.startsWith('initial-') ? undefined : fixture.resources);
    await seed(context, origin, { ...scenario, catalog: fixtureCatalog });
    const page = await context.newPage();
    await openLibrary(page, origin, phase, scenario);
    if (scenario.at === documentCard) {
      await page.locator(`${documentCard} .library-actions :is(a,button)`).first().waitFor();
    }
    const info = await viewportCheck(page);
    if (phase === 'after') {
      assert.ok(info.scrollWidth <= info.cssWidth && !info.overflow.length, `${scenario.name}: ${JSON.stringify(info)}`);
    }
    await shot(page, directory, `${phase}-${scenario.name}`);
    return { phase, state: scenario.name, ...info };
  } finally {
    await context.close();
  }
}

async function captureNativeZoom(origin, directory) {
  const extension = await mkdtemp(resolve(directory, 'zoom-'));
  const manifest = resolve(extension, 'manifest.json');
  const workerScript = resolve(extension, 'worker.js');
  await writeFile(manifest, JSON.stringify({
    manifest_version: 3, name: 'Zoom de recette locale', version: '1', permissions: ['tabs'], background: { service_worker: 'worker.js' },
  }));
  await writeFile(workerScript, 'chrome.runtime.onInstalled.addListener(() => {});');
  const measures = [];
  try {
    for (const phase of phases) {
      const context = await chromium.launchPersistentContext('', {
        channel: 'chromium', viewport: { width: 780, height }, reducedMotion: 'reduce',
        args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
      });
      try {
        await seed(context, origin, { catalog: fixture.resources });
        const page = context.pages()[0];
        const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
        await openLibrary(page, origin, phase, { query: '?type=pdf' });
        const zoom = await worker.evaluate(async url => {
          const tab = (await chrome.tabs.query({})).find(item => item.url === url);
          await chrome.tabs.setZoom(tab.id, 2);
          return chrome.tabs.getZoom(tab.id);
        }, page.url());
        assert.equal(zoom, 2);
        await page.waitForFunction(() => innerWidth === 390);
        await page.locator(`${documentCard} .library-record > summary`).press('Enter');
        await expect(page.locator(`${documentCard} dl`)).toBeVisible();
        const info = await viewportCheck(page);
        if (phase === 'after') assert.ok(info.dpr === 2 && info.scrollWidth <= info.cssWidth && !info.overflow.length);
        const client = await context.newCDPSession(page);
        const { data } = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
        await writeFile(resolve(directory, `${phase}-zoom.png`), Buffer.from(data, 'base64'));
        measures.push({ phase, zoom, ...info });
      } finally {
        await context.close();
      }
    }
  } finally {
    await unlink(manifest);
    await unlink(workerScript);
    await rmdir(extension);
  }
  return measures;
}

const buttonCases = [
  { name: 'Header', cases: { rubrique: '.primary-nav__item.active > .primary-nav__entry', neutre: '.primary-nav__item:not(.active) > .primary-nav__entry' } },
  { name: 'ITK', file: 'itk.html', cases: { generer: '#itk-form [type="submit"]', exporter: '#csv-export' } },
  { name: 'Bibliothèque', query: '?type=pdf', cases: { reset: '.library-reset', consulter: '#resource-grid .library-open:not([download])', telecharger: '.library-download' } },
  { name: 'Vérification PDF', pdf: 404, cases: { verifier: '[data-library-check]' } },
  { name: 'Récupération', catalog: 'error', cases: { recharger: 'main .library-notice button' } },
];

async function inspectButton(target) {
  return target.evaluate(node => {
    const style = getComputedStyle(node), reflection = getComputedStyle(node, '::before');
    return Object.fromEntries([
      ['height', style.height], ['radius', style.borderRadius], ['border', style.borderColor],
      ['surface', style.backgroundImage], ['text', style.color], ['shadow', style.boxShadow],
      ['reflection', reflection.backgroundImage], ['highlight', reflection.opacity],
      ['outline', style.outline], ['outlineOffset', style.outlineOffset], ['transition', style.transitionDuration],
    ]);
  });
}

async function captureButtons(browser, origin, directory) {
  const result = [];
  for (const brightness of ['light', 'dark']) for (const scenario of buttonCases) {
    const context = await browser.newContext({ viewport: { width: 1440, height }, locale: 'fr-FR', reducedMotion: 'reduce' });
    try {
      await seed(context, origin, { ...scenario, brightness, catalog: scenario.catalog ?? fixture.resources });
      const page = await context.newPage();
      await openLibrary(page, origin, 'after', scenario);
      if (scenario.file === 'itk.html') await generateItk(page, itkScenarios.carotte);
      for (const [name, selector] of Object.entries(scenario.cases)) {
        const target = page.locator(selector).first();
        await target.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
        await page.mouse.move(0, 0);
        const states = {};
        for (const state of ['repos', 'survol', 'focus']) {
          if (state === 'survol') await target.hover();
          if (state === 'focus') {
            await page.mouse.move(0, 0);
            await page.keyboard.press('Tab');
            const control = scenario.name === 'Header' ? target.locator('.primary-nav__top-link') : target;
            await control.focus();
            assert.ok(await control.evaluate(node => node.matches(':focus-visible')));
            states.focusControl = await inspectButton(control);
          }
          states[state] = await inspectButton(target);
          const bounds = await target.boundingBox();
          const x = Math.max(0, Math.floor(bounds.x) - 8);
          const y = Math.max(0, Math.floor(bounds.y) - 8);
          const clip = { x, y, width: Math.ceil(bounds.width) + 16, height: Math.ceil(bounds.height) + 16 };
          await page.screenshot({ path: resolve(directory, `${brightness}-${name}-${state}.png`), clip });
        }
        await target.evaluate(node => node.contains(document.activeElement) && document.activeElement.blur());
        result.push({ brightness, group: scenario.name, name, states });
      }
    } finally {
      await context.close();
    }
  }
  for (const brightness of ['light', 'dark']) {
    const controls = Object.fromEntries(result.filter(row => row.brightness === brightness).map(row => [row.name, row.states]));
    for (const [reference, names] of [
      ['rubrique', ['generer', 'consulter']],
      ['neutre', ['exporter', 'reset', 'telecharger', 'verifier', 'recharger']],
    ]) {
      for (const name of names) {
        for (const key of ['radius', 'surface', 'border', 'shadow', 'reflection']) {
          assert.equal(controls[name].repos[key], controls[reference].repos[key], `${brightness}/${name}/${key}`);
        }
        assert.equal(controls[name].survol.highlight, controls[reference].survol.highlight);
        assert.equal(controls[name].focusControl.outline, controls[reference].focusControl.outline);
      }
    }
  }
  return result;
}

const figure = (name, label) => `<figure><figcaption>${label}</figcaption><a href="${name}.png"><img loading="lazy" src="${name}.png" alt="${label}"></a></figure>`;
const gallery = (title, ref, body) => `<!doctype html><html lang="fr"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>
<style>body{font:16px/1.55 system-ui;margin:24px auto;width:min(1320px,calc(100% - 32px));color:#302a25;background:#faf6ef}
section{margin-block:28px}.pair,.compare{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.compare{grid-template-columns:repeat(3,minmax(0,1fr))}figure{margin:0;min-width:0}figcaption{margin-bottom:6px}
img{display:block;max-width:100%;height:auto;border:1px solid #a69a8b;border-radius:8px}
@media(max-width:650px){.pair,.compare{grid-template-columns:1fr}}</style>
<h1>${title}</h1><p>Base ${ref.replace(/[^a-zA-Z0-9_. -]/g, '')}. Les scénarios isolés utilisent des données de recette.</p>${body}</html>`;

export async function writeResourcesReview(browser, { origin, baselineRef, directory }) {
  await mkdir(directory, { recursive: true });
  const viewport = [];
  for (const scenario of reviewCases) for (const phase of phases) {
    viewport.push(await captureScenario(browser, origin, directory, phase, scenario));
  }
  const zoom = await captureNativeZoom(origin, directory);
  const buttons = await captureButtons(browser, origin, directory);
  const pairs = [...reviewCases.map(row => row.name), 'zoom'].map(name =>
    `<section><h2>${name}</h2><div class="pair">${figure(`before-${name}`, 'Avant')}${figure(`after-${name}`, 'Après')}</div></section>`).join('');
  await writeFile(resolve(directory, 'index.html'), gallery('Ressources documentaires · Avant et après', baselineRef,
    `<p><a href="boutons.html">Comparaison des commandes</a></p>${pairs}`));
  const comparison = buttons.map(({ brightness, group, name }) => `<section><h2>${group} · ${name} · ${brightness === 'light' ? 'Clair' : 'Sombre'}</h2>
    <div class="compare">${['repos', 'survol', 'focus'].map(state => figure(`${brightness}-${name}-${state}`, state)).join('')}</div></section>`).join('');
  await writeFile(resolve(directory, 'boutons.html'), gallery('Header, ITK et bibliothèque · Commandes', baselineRef,
    `<p><a href="index.html">Galerie avant et après</a></p>${comparison}`));
  await writeFile(resolve(directory, 'controles.json'), JSON.stringify({ viewport, zoom, buttons }, null, 2));
}
