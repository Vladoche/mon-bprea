// Same synthetic Drill history and civil clock on main and the candidate.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DRILL_STORAGE_KEY, readDrillDocument } from '../assets/drill-store.js';
import { DASHBOARD_NOW, dashboardHistory } from '../tests/fixtures/dashboard.js';

export async function seedDashboard(page, scenario = 'history', brightness = 'light') {
  await page.addInitScript(({ key, data, brightness, stamp }) => {
    // Keep Resource Timing and the other browser clocks real for the comparison.
    const NativeDate = Date;
    window.Date = new Proxy(NativeDate, {
      construct(target, args) { return Reflect.construct(target, args.length ? args : [stamp]); },
      apply() { return new NativeDate(stamp).toString(); },
      get(target, property) { return property === 'now' ? () => stamp : Reflect.get(target, property); },
    });
    localStorage.setItem(key, JSON.stringify(data));
    localStorage.setItem('bprea-demo-appearance-device-v1', JSON.stringify({ version: 1, season: 'autumn', brightness }));
  }, { key: DRILL_STORAGE_KEY, data: dashboardHistory(scenario), brightness, stamp: DASHBOARD_NOW.getTime() });
}

export function installDashboardObserver() {
  const lab = window.__dashboardLab = { readyMs: null, actions: {}, shifts: [] };
  const shifts = new PerformanceObserver(list => {
    for (const entry of list.getEntries()) lab.shifts.push({ time: entry.startTime, value: entry.value });
  });
  shifts.observe({ type: 'layout-shift', buffered: true });
  const stats = new MutationObserver(() => {
    if (!document.querySelector('.dashboard-metrics dd')) return;
    lab.readyMs = performance.now();
    stats.disconnect();
  });
  stats.observe(document, { childList: true, subtree: true });

  const startAction = name => {
    if (name in lab.actions) return;
    const start = performance.now(), scrollBefore = window.scrollY;
    lab.actions[name] = null;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      lab.actions[name] = { start, durationMs: performance.now() - start, scrollDelta: window.scrollY - scrollBefore };
    }));
  };
  document.addEventListener('change', event => {
    if (event.target.id === 'dashboard-unit') startAction('filter');
  }, true);
  document.addEventListener('click', event => {
    if (event.target.closest('[data-chart-page]')) startAction('page');
    if (event.target.closest('[data-dashboard-refresh]')) startAction('refresh');
  }, true);
  document.addEventListener('focusin', event => {
    if (event.target.closest('[data-chart-week]')) startAction('week');
  }, true);
}

export async function measureDashboard(page) {
  const previous = page.locator('[data-chart-page="previous"]');
  const before = await page.locator('.dashboard-chart-pager p').textContent();
  await page.locator('#dashboard-unit').selectOption('uc3');
  await page.waitForFunction(() => document.querySelector('.dashboard-metrics dd').textContent === '33');
  await previous.click();
  await page.waitForFunction(before => document.querySelector('.dashboard-chart-pager p').textContent !== before, before);
  await page.locator('[data-chart-output="volume-detail"]').nth(2).focus();
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
    { key: DRILL_STORAGE_KEY, data: dashboardHistory('refreshed') });
  await page.locator('[data-dashboard-refresh]').click();
  await page.waitForFunction(() => document.querySelector('.dashboard-metrics dd').textContent === '34');
  await page.waitForFunction(() => ['filter', 'page', 'week', 'refresh'].every(name => window.__dashboardLab.actions[name]));
  return page.evaluate(() => {
    const { readyMs, actions, shifts } = window.__dashboardLab;
    for (const action of Object.values(actions)) {
      action.layoutShift = shifts.filter(shift => shift.time >= action.start && shift.time <= action.start + action.durationMs)
        .reduce((total, shift) => total + shift.value, 0);
    }
    return { dashboardReadyMs: readyMs, dashboardActions: actions };
  });
}

async function readNumbers(page) {
  return page.evaluate(() => {
    const rows = region => [...document.querySelectorAll(`[data-dashboard-details="${region}"] tbody tr`)]
      .map(row => [...row.querySelectorAll('td')].map(cell => cell.textContent));
    return {
      totals: [...document.querySelectorAll('.dashboard-metrics dd')].map(cell => cell.textContent),
      weeks: rows('weekly'), uc: rows('comparison'), chapters: rows('chapters'),
    };
  });
}

const gallery = {
  empty: 'Historique visiteur vide',
  'empty-detail': 'Message et actions de l’état vide',
  few: 'Une réponse validée',
  history: 'Historique complet · toutes les UC',
  summary: 'Cinq indicateurs du bilan',
  unit: 'UC 03 sélectionnée',
  plots: 'Volume, taux réel à zéro et semaines sans réponse',
  comparison: 'Comparaison des UC',
  revisions: 'Notions à retravailler et volumes insuffisants',
  excluded: 'Données exclues du calcul',
  loading: 'Chargement du cache personnel',
  offline: 'Compte hors ligne',
  conflict: 'Conflit de synchronisation',
  session: 'Identité à vérifier',
  dark: 'Mode sombre',
  'dark-plots': 'Graphiques en mode sombre',
  contrast: 'Contraste forcé',
};

const dashboardPath = 'tableau-de-bord.html';
const captureWidths = [1440, 390];
const scopeRegion = title => `section[aria-labelledby="dashboard-${title}-title"]`;

async function installPersonalState(page, state) {
  const view = readDrillDocument(dashboardHistory(state === 'loading' ? 'empty' : 'history'));
  const snapshot = { mode: 'personal', scope: 'dashboard-review-synthetic', view, sync: { state,
    pending: state === 'offline' ? 2 : 0, conflicts: state === 'conflict' ? [{ resolved: false }] : [],
  } };
  await page.route('**/assets/drill-sync-service.js*', route => route.fulfill({ contentType: 'text/javascript', body: `
    export async function getDrillSyncService() { return {
      subscribe(listener) { listener(${JSON.stringify(snapshot)}); return () => {}; },
      async retry() {}, stop() {},
    }; }
  ` }));
}

async function captureDashboard(browser, { origin, phase, width, directory, parity }) {
  const context = await browser.newContext({ viewport: { width, height: 950 }, timezoneId: 'Europe/Paris', locale: 'fr-FR', reducedMotion: 'reduce' });
  try {
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const base = `${origin}/${phase}/${dashboardPath}`;
    async function open(query = '', { scenario = 'history', brightness = 'light', state, forcedColors } = {}) {
      const page = await context.newPage();
      await seedDashboard(page, scenario, brightness);
      if (state) await installPersonalState(page, state);
      if (forcedColors) await page.emulateMedia({ forcedColors });
      await page.goto(base + query);
      const unavailable = ['loading', 'session'].includes(state);
      await page.locator(unavailable ? '.dashboard-empty h2' : '.dashboard-metrics').first().waitFor();
      if (state === 'loading') await page.getByRole('heading', { name: 'Chargement de ton historique personnel' }).waitFor();
      if (state === 'session') await page.locator('#dashboard-login').waitFor();
      await page.evaluate(() => document.fonts.ready);
      return page;
    }
    async function shot(page, key, selector, close = true) {
      const options = { path: resolve(directory, `${phase}-${key}-${width}.png`), animations: 'disabled' };
      if (selector) await page.locator(selector).first().screenshot(options);
      else await page.screenshot(options);
      if (close) await page.close();
    }
    if (width === 768) {
      await shot(await open('?period=all'), 'history');
      return;
    }
    const empty = await open('?period=4', { scenario: 'empty' });
    if (parity) parity.empty = await readNumbers(empty);
    await shot(empty, 'empty', null, false);
    await shot(empty, 'empty-detail', '.dashboard-empty');
    const few = await open('?period=4', { scenario: 'few' });
    if (parity) parity.few = await readNumbers(few);
    await shot(few, 'few');
    const history = await open('?period=all');
    if (parity) {
      parity.all = await readNumbers(history);
      for (const period of ['4', '8', '12']) {
        await history.locator('#dashboard-period').selectOption(period);
        parity[period] = await readNumbers(history);
      }
      await history.locator('#dashboard-period').selectOption('all');
    }
    await shot(history, 'history', null, false);
    await shot(history, 'summary', '.dashboard-metrics', false);
    await shot(history, 'plots', '.dashboard-chart-grid', false);
    await shot(history, 'comparison', scopeRegion('comparison'), false);
    if (phase === 'after') {
      await history.locator('[data-dashboard-details="notions-insufficient"] > summary').click();
    }
    await shot(history, 'revisions', scopeRegion('observations'));
    const unit = await open('?unit=uc3&period=all');
    if (parity) parity.unit = await readNumbers(unit);
    await shot(unit, 'unit', null, false);
    await unit.emulateMedia({ forcedColors: 'active' });
    await shot(unit, 'contrast', '.dashboard-chart-grid');
    const excluded = await open('?period=8', { scenario: 'exclusions' });
    if (parity) parity.excluded = await readNumbers(excluded);
    await excluded.locator('[data-dashboard-details="warnings"] > summary').click();
    await shot(excluded, 'excluded', '[data-dashboard-details="warnings"]');
    const dark = await open('?period=4', { brightness: 'dark' });
    await shot(dark, 'dark', null, false);
    await shot(dark, 'dark-plots', '.dashboard-chart-grid');
    for (const state of ['loading', 'offline', 'conflict', 'session']) {
      const page = await open('?period=4', { state });
      if (parity) parity[state] = await readNumbers(page);
      await shot(page, state);
    }
  } finally { await context.close(); }
}

export async function writeDashboardReview(browser, { origin, baselineRef, directory }) {
  await mkdir(directory, { recursive: true });
  const parity = { before: {}, after: {} };
  for (const phase of ['before', 'after']) {
    for (const width of [...captureWidths, 768]) {
      await captureDashboard(browser, { origin, phase, width, directory, parity: width === 1440 ? parity[phase] : null });
    }
  }
  assert.deepEqual(parity.after, parity.before, 'Écart numérique entre la référence et le nouveau rendu');
  const pairedCapture = (key, width) => `<h2>${gallery[key]} · ${width} px</h2><div class="pair">${['before', 'after'].map(phase => {
    const file = `${phase}-${key}-${width}.png`;
    const label = phase === 'before' ? 'main' : 'PR3 lot 4';
    return `<figure><figcaption>${label}</figcaption><a href="${file}"><img loading="lazy" src="${file}" alt="${gallery[key]} · ${label} · ${width} px"></a></figure>`;
  }).join('')}</div>`;
  const pairs = captureWidths.flatMap(width => Object.keys(gallery).map(key => pairedCapture(key, width)));
  pairs.push(pairedCapture('history', 768));
  const safeRef = baselineRef.replace(/[&<>]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char]));
  await writeFile(resolve(directory, 'comparaison-dashboard.html'), `<!doctype html><html lang="fr"><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1"><title>Tableau de bord · avant et après</title>
    <style>body{font:16px/1.6 system-ui;color:#342f28;background:#faf7f0;margin:24px}.pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}figure{margin:0;max-width:950px}img{width:100%;height:auto;border:1px solid #ded8cb}@media(max-width:700px){.pair{grid-template-columns:1fr}}</style>
    <h1>Tableau de bord · comparaison visuelle</h1><p>Référence ${safeRef} · 18 novembre 2026 · historiques de test exclusivement.
    Chaque capture ouvre le PNG original.</p>${pairs.join('')}</html>`);
  return Object.keys(parity.before);
}
