import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rmdir, unlink, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { chromium } from '@playwright/test';
import { createCourseQuizAPI } from '../tests/e2e/course-quiz-api.js';
import { busy, course } from '../tests/fixtures/calendar-2027.js';
import { currentBotanicalPhoto } from '../tests/helpers/botanical-browser.js';
import { generateItk } from '../tests/helpers/settings-browser.js';
import { captureButtonStates } from './ui-botanical-review.mjs';
import { seedBotanicalLab } from './ui-botanical-lab.mjs';
import { seedDashboard } from './ui-dashboard-lab.mjs';
import { seedProfileLab } from './ui-profile-lab.mjs';

const [baselinePath, baselineRef, outputPath, mode] = process.argv.slice(2);
if (!baselinePath || !/^[a-f0-9]{40}$/.test(baselineRef) || !outputPath) {
  throw new Error('Usage: node scripts/ui-harmonisation-lab.mjs <baseline> <git SHA> <output> [--audit-only]');
}
const output = resolve(outputPath);
const roots = { before: resolve(baselinePath), after: process.cwd() };
const phases = Object.keys(roots);
const widths = [320, 390, 601, 768, 1024, 1101, 1440];
const screenshotWidths = new Set([390, 768, 1440]);
const seasons = ['spring', 'summer', 'autumn', 'winter'];
const options = { viewport: { width: 1440, height: 1000 }, timezoneId: 'Europe/Paris', locale: 'fr-FR', reducedMotion: 'reduce' };
const pages = [
  ['index', 'Accueil', '#home-heading'],
  ['mes-cours', 'Mes cours', '.hub-intro h1'],
  ['s-exercer', 'S’exercer', '.hub-intro h1'],
  ['outils', 'Outils', '.hub-intro h1'],
  ['uc?id=uc3', 'Unité UC 03', '.learning-intro h1'],
  ['cours?id=matiere-organique', 'Lecture d’un cours', '.learning-intro h1'],
  ['exercices?id=matiere-organique', 'QCM de cours', '#check-quiz'],
  ['drill?unit=uc3&week=2026-W47', 'Drill hebdomadaire', '.drill-intro h1'],
  ['tableau-de-bord?period=all', 'Tableau de bord', '.dashboard-hero h1'],
  ['calendrier?month=2027-06', 'Calendrier', '.calendar-month-empty'],
  ['itk', 'Générateur ITK', '#itk-form'],
  ['ressources', 'Bibliothèque', '.library-card'],
  ['reconnaissance-plantes', 'Reconnaissance botanique', '[data-start]:enabled'],
  ['connexion', 'Connexion', '.auth-panel h2'],
  ['mot-de-passe-oublie', 'Mot de passe oublié', '.auth-panel h2'],
  ['authentification', 'Activation et récupération', '.auth-panel h2'],
  ['profil', 'Mon profil', '#appearance-open:enabled'],
  ['contact', 'Contact et assistance', 'main h1'],
  ['confidentialite', 'Confidentialité', 'main h1'],
].map(([route, name, ready]) => {
  const [id, query] = route.split('?');
  return { id, name, url: id + '.html' + (query ? '?' + query : ''), ready };
});

const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webp': 'image/webp', '.jpg': 'image/jpeg',
  '.png': 'image/png', '.pdf': 'application/pdf',
};
const server = createServer(async (request, response) => {
  try {
    const [phase, ...parts] = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).split('/').slice(1);
    const root = roots[phase];
    const target = root && resolve(root, ...parts);
    const validPath = parts.length === 1 ? parts[0].endsWith('.html') : ['assets', 'documents'].includes(parts[0]);
    if (!root || !validPath || !target.startsWith(root + sep) ||
        parts.some(part => part.startsWith('.') || part.includes('\\') || part.endsWith('.local.json'))) {
      return response.writeHead(404).end();
    }
    const file = await readFile(target);
    response.writeHead(200, { 'content-type': mime[extname(target)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(file);
  } catch {
    response.writeHead(404).end();
  }
});

await readFile(resolve(roots.before, 'index.html'));
await mkdir(output, { recursive: true });
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;

const rows = [];
const themes = [];
const controls = [];
const outputs = {};
const gallery = new Map();
const takePictures = mode !== '--audit-only';
const date = new Date('2026-11-19T12:00:00+01:00');

async function prepare(context, brightness = 'light') {
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === origin ? route.continue() : route.abort();
  });
  await context.addInitScript(value => {
    localStorage.setItem('bprea-demo-appearance-device-v1', JSON.stringify({ version: 1, season: 'autumn', brightness: value }));
  }, brightness);
  const page = context.pages()[0] || await context.newPage();
  await page.clock.setFixedTime(date);
  return page;
}

async function openPage(page, phase, view) {
  const response = await page.goto(`${origin}/${phase}/${view.url}`);
  assert.equal(response.status(), 200, view.url);
  await page.locator(view.ready).first().waitFor({ state: 'visible' });
  await page.locator('header nav, nav.standalone-nav').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
}

async function layout(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const head = document.querySelector('header');
    const title = document.querySelector('main h1');
    const trail = document.querySelector('main .crumbs');
    const dialog = document.querySelector('dialog[open]');
    const bounds = dialog?.getBoundingClientRect();
    return {
      width: root.clientWidth,
      scrollWidth: root.scrollWidth,
      overflow: [...document.querySelectorAll('main *')].filter(element => {
        const box = element.getBoundingClientRect();
        if (!box.width || box.right <= root.clientWidth + 1) return false;
        return !element.parentElement.closest('.sr-only') && !element.closest('[class*="landscape"]');
      }).slice(0, 8).map(element => element.id || String(element.className) || element.localName),
      header: head?.offsetHeight,
      title: title?.textContent.trim(),
      h1Size: title && getComputedStyle(title).fontSize,
      breadcrumb: trail?.querySelector('[aria-current="page"]')?.textContent,
      mainButtons: [...document.querySelectorAll('main .btn')].filter(el => el.getClientRects().length).map(el => el.className),
      dialogFits: !bounds || (bounds.left >= 0 && bounds.right <= root.clientWidth && bounds.top >= 0 &&
        bounds.bottom <= innerHeight && dialog.scrollWidth <= dialog.clientWidth + 1),
    };
  });
}

async function inspect(page, phase, route) {
  const state = await layout(page);
  rows.push({ phase, route, ...state });
  if (phase === 'after') {
    assert.ok(state.scrollWidth <= state.width, `${route}: débordement horizontal à ${state.width} px (${state.overflow.join(', ')})`);
    assert.ok(state.dialogFits, `${route}: dialogue hors écran à ${state.width} px`);
  }
}

async function palette(page, season, brightness) {
  await page.evaluate(prefs => window.BpreaAppearance.updatePreferences(prefs), { season, brightness });
  return page.evaluate(() => {
    const root = document.documentElement;
    const probe = document.createElement('span');
    probe.hidden = true;
    document.body.append(probe);
    const luminance = (token) => {
      probe.style.color = `var(--${token})`;
      const rgb = getComputedStyle(probe).color.match(/\d+(?:\.\d+)?/g).slice(0, 3);
      return rgb.map(n => Number(n) / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4)
        .reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
    };
    const contrast = (text, surface) => {
      const pair = [luminance(text), luminance(surface)];
      return (Math.max(...pair) + .05) / (Math.min(...pair) + .05);
    };
    const ratios = {
      text: contrast('color-text', 'color-surface'),
      muted: contrast('color-muted', 'color-surface-soft'),
      link: contrast('color-accent', 'color-surface-soft'),
      terracotta: Math.min(contrast('color-on-terracotta', 'color-terracotta'), contrast('color-on-terracotta', 'color-terracotta-hover')),
      success: contrast('color-success', 'color-success-bg'),
      warning: contrast('color-warning', 'color-warning-bg'),
      error: contrast('color-error', 'color-error-bg'),
      controlBorder: contrast('color-control-border', 'color-surface'),
      focus: contrast('color-focus', 'color-surface'),
    };
    probe.remove();
    return { season: root.dataset.season, brightness: root.dataset.theme, ratios };
  });
}

function picture(phase, id, label, file) {
  const pair = gallery.get(id) || { label };
  pair[phase] = file;
  gallery.set(id, pair);
}

async function shot(target, phase, id, label, options = {}) {
  if (!takePictures) return;
  const file = `${id}-${phase}.jpg`;
  await target.screenshot({ path: resolve(output, file), type: 'jpeg', quality: 86, animations: 'disabled', ...options });
  picture(phase, id, label, file);
}

function html(title, contents) {
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>body{font:1rem/1.5 system-ui;margin:2rem auto;padding:0 1rem;max-width:92rem;color:#222;background:#f7f7f7}.pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}figure{margin:0}img{display:block;max-width:100%;height:auto}figcaption{margin-bottom:.25rem}details{margin:1rem 0;padding:.75rem;background:white;border:1px solid #ddd}summary{cursor:pointer;font-weight:650}@media(max-width:620px){.pair{grid-template-columns:1fr}}</style>
<h1>${title}</h1><p>Référence avant ${baselineRef}. Les captures présentent des données publiques ou synthétiques. Ouvrir une image pour l’afficher à sa taille réelle.</p>${contents}</html>`;
}

function pairs(entries) {
  return entries.map(({ label, before, after }) => `<details><summary>${label}</summary><div class="pair">${[
    ['Avant', before], ['Après', after],
  ].map(([phase, file]) => `<figure><figcaption>${phase}</figcaption><a href="${file}"><img loading="lazy" src="${file}" alt="${label} · ${phase}"></a></figure>`).join('')}</div></details>`).join('');
}

async function menu(page) {
  const toggle = page.locator('[data-navigation-toggle="courses"]');
  const panel = page.locator('#' + await toggle.getAttribute('aria-controls'));
  await toggle.press('Enter');
  await panel.waitFor();
  const focused = await panel.evaluate(node => {
    const bounds = node.getBoundingClientRect();
    return bounds.left >= 0 && bounds.right <= document.documentElement.clientWidth &&
      node.contains(document.activeElement) && document.activeElement.matches(':focus-visible');
  });
  assert.ok(focused, 'Menu des cours et premier lien visibles au clavier');
  return { toggle, panel };
}

async function states(browser, phase) {
  const context = await browser.newContext(options);
  try {
    const base = `${origin}/${phase}/`;
    const page = await prepare(context);
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.goto(base + 's-exercer.html');
    const { toggle, panel } = await menu(page);
    await shot(page, phase, 'menu-ouvert', 'Navigation mobile · menu ouvert et focus clavier');
    await page.keyboard.press('Escape');
    assert.ok(await panel.isHidden() && await toggle.evaluate(el => el === document.activeElement));

    const failure = Promise.withResolvers();
    await page.route('**/assets/calendar-events.json', async route => {
      await failure.promise;
      await route.fulfill({ status: 503 });
    }, { times: 1 });
    try {
      await page.goto(base + 'calendrier.html?date=2027-06-14', { waitUntil: 'domcontentloaded' });
      await page.locator('.calendar-loading').waitFor();
      await shot(page, phase, 'calendar-loading', 'Calendrier · chargement des événements');
    } finally { failure.resolve(); }
    const retry = page.locator('[data-calendar-retry]');
    await retry.waitFor();
    await shot(page, phase, 'calendar-error', 'Calendrier · indisponible et commande Réessayer');
    await page.route('**/assets/calendar-events.json', route => route.fulfill({ json: busy }));
    await retry.press('Enter');
    const counter = page.locator('.calendar-mobile-count').filter({ hasText: '4' }).first();
    await counter.press('Enter');
    await shot(page, phase, 'calendar-agenda', 'Calendrier · agenda d’un jour avec exemples fictifs', { fullPage: true });
    const agenda = page.locator('.calendar-agenda-list h3');
    outputs[phase] = { agenda: await agenda.allTextContents() };
    await page.getByRole('button', { name: 'Voir tout le mois' }).press('Enter');
    outputs[phase].month = await agenda.allTextContents();
    await page.getByRole('button', { name: new RegExp(course.title) }).press('Enter');
    const detail = page.getByRole('dialog', { name: course.title });
    await detail.waitFor();
    outputs[phase].detail = await detail.locator('.calendar-dialog-content').innerText();
    await page.emulateMedia({ forcedColors: 'active' });
    await page.keyboard.press('Tab');
    await shot(page, phase, 'calendar-forced', 'Calendrier · dialogue en contraste forcé, mouvement réduit');
    await inspect(page, phase, 'calendar-forced');
    await page.keyboard.press('Escape');
    await page.emulateMedia({ forcedColors: 'none' });

    await seedDashboard(page);
    await page.goto(base + 'tableau-de-bord.html?period=all');
    await page.locator('.chart-point').first().waitFor();
    await shot(page, phase, 'dashboard-history', 'Tableau de bord · graphique et historique fictif', { fullPage: true });

    await page.goto(base + 'itk.html');
    await generateItk(page);
    await shot(page, phase, 'itk-results', 'ITK · chronologie et export', { fullPage: true });

    await seedBotanicalLab(context, { deterministic: true });
    await page.goto(base + 'reconnaissance-plantes.html');
    await page.locator('[data-start]').click();
    const observation = await currentBotanicalPhoto(page);
    await page.locator(`[data-choice="${observation.plant.id}"]`).press('Enter');
    await shot(page, phase, 'botanical-choice', 'Botanique · photographie et proposition sélectionnée', { fullPage: true });
    await page.locator('[data-validate]').press('Enter');
    await shot(page, phase, 'botanical-correction', 'Botanique · correction avec mouvement réduit', { fullPage: true });
    const animation = await page.locator('.bot-outcome').evaluate(node => getComputedStyle(node).animationName);
    assert.equal(animation, 'none');

    const accountContext = await browser.newContext(options);
    try {
      const account = await prepare(accountContext);
      await seedProfileLab(accountContext, base, { nickname: 'Élève démo' });
      await account.goto(base + 'profil.html');
      await account.locator('#auth-pseudo').waitFor();
      await shot(account, phase, 'profile-account', 'Profil · compte fictif et formulaire de pseudo', { fullPage: true });
      await account.locator('#appearance-open').press('Enter');
      await shot(account, phase, 'profile-dialog', 'Profil · dialogue des préférences');
    } finally { await accountContext.close(); }

    await createCourseQuizAPI().install(context, null, null, base);
    await page.goto(base + 'connexion.html');
    await page.locator('.auth-form').waitFor();
    await shot(page, phase, 'login-form', 'Connexion · formulaire avec configuration de test', { fullPage: true });
  } finally { await context.close(); }
}

async function buttonBoard(browser, phase, brightness) {
  const context = await browser.newContext(options);
  try {
    const page = await prepare(context, brightness);
    const base = `${origin}/${phase}/`;
    const examples = [
      ['index.html', 'header-neutral', 'Header · entrée neutre', '.primary-nav__item:not(.active) > .primary-nav__entry', { header: true }],
      ['index.html', 'header-active', 'Header · entrée active', '.primary-nav__item.active > .primary-nav__entry', { header: true }],
      ['index.html', 'home', 'Accueil · Commencer à réviser', '[data-revision-start]'],
      ['uc.html?id=uc1', 'uc', 'UC · Retour à Mes cours', '.learning-actions .btn'],
      ['cours.html?id=matiere-organique', 'course', 'Cours · Faire le QCM', '.course-finish .btn'],
      ['exercices.html?id=matiere-organique', 'quiz-disabled', 'QCM · corrigé indisponible', '#check-quiz', { disabled: true }],
      ['drill.html?unit=uc3&week=2026-W47', 'drill', 'Drill · Commencer cette série', '[data-drill-start]'],
      ['tableau-de-bord.html?period=all', 'dashboard', 'Tableau de bord · Exercices hebdomadaires', '#dashboard-drill-link'],
      ['calendrier.html?month=2027-06', 'calendar-today', 'Calendrier · Aujourd’hui', '[data-calendar-today]'],
      ['calendrier.html?month=2027-06', 'calendar-previous', 'Calendrier · Mois précédent', '[data-month-step="-1"]'],
      ['calendrier.html?month=0001-01', 'calendar-bound', 'Calendrier · borne minimale', '[data-month-step="-1"]', { disabled: true }],
      ['itk.html', 'itk', 'ITK · Générer', '#itk-form [type="submit"]'],
      ['ressources.html?type=pdf', 'resources', 'Ressources · Consulter', '#resource-grid .library-open:not([download])'],
      ['reconnaissance-plantes.html', 'botanical', 'Botanique · Commencer', '[data-start]'],
      ['profil.html', 'profile', 'Profil · Régler l’apparence', '#appearance-open'],
      ['contact.html', 'contact', 'Contact · Navigation autonome', '.standalone-nav a'],
    ];
    let previous;
    const swatches = [];
    for (const [path, name, title, selector, state] of examples) {
      if (path !== previous) {
        await page.goto(base + path);
        previous = path;
      }
      const target = page.locator(selector).first();
      await target.waitFor();
      assert.equal(await page.locator('html').getAttribute('data-theme'), brightness, path);
      if (state?.disabled) assert.ok(await target.isDisabled(), title);
      await captureButtonStates(page, output, swatches, brightness, `${phase}-${name}`, title, target, state);
      if (name === 'quiz-disabled') {
        for (const question of await page.locator('#quiz-questions .question').all()) await question.locator('label').first().click();
        assert.ok(await target.isEnabled());
        await captureButtonStates(page, output, swatches, brightness, `${phase}-quiz`, 'QCM · Voir le corrigé', target);
      }
    }
    if (phase === 'after') {
      const byName = new Map(swatches.map(row => [row.name.replace('after-', ''), row]));
      for (const [reference, names] of [
        ['header-neutral', ['uc', 'dashboard', 'calendar-today', 'calendar-previous', 'profile', 'contact']],
        ['header-active', ['home', 'course', 'quiz', 'drill', 'itk', 'resources', 'botanical']],
      ]) for (const name of names) {
        const control = byName.get(name);
        const header = byName.get(reference);
        for (const key of ['surface', 'radius', 'shadow', 'reflection']) {
          assert.equal(control.states.repos[key], header.states.repos[key], `${brightness}/${name}/${key}`);
        }
        assert.ok(control.states.repos.contrast >= 4.5, `${brightness}/${name}/contraste`);
        assert.match(control.states.focus.outline, /solid 3px/);
        assert.equal(control.states.repos.height, control.states.actif.height, `${name}: hauteur à l’appui`);
      }
    }
    controls.push(...swatches.map(row => ({ phase, ...row })));
  } finally { await context.close(); }
}

async function nativeZoom() {
  const extension = await mkdtemp(resolve(output, 'zoom-'));
  const manifest = resolve(extension, 'manifest.json');
  const workerFile = resolve(extension, 'worker.js');
  await writeFile(manifest, JSON.stringify({ manifest_version: 3, name: 'Zoom Mon BPREA', version: '1', permissions: ['tabs'], background: { service_worker: 'worker.js' } }));
  await writeFile(workerFile, 'chrome.runtime.onInstalled.addListener(() => {});');
  try {
    for (const phase of phases) {
      const context = await chromium.launchPersistentContext('', {
        ...options, viewport: { width: 1280, height: 1000 }, channel: 'chromium',
        args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
      });
      try {
        const page = await prepare(context);
        const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
        const client = await context.newCDPSession(page);
        const base = `${origin}/${phase}/`;
        await page.route('**/assets/calendar-events.json', route => route.fulfill({ json: busy }));
        for (const factor of [2, 4]) {
          await page.goto(base + 'cours.html?id=matiere-organique');
          const zoom = await worker.evaluate(async ({ url, factor }) => {
            const tab = (await chrome.tabs.query({})).find(item => item.url === url);
            await chrome.tabs.setZoom(tab.id, factor);
            return chrome.tabs.getZoom(tab.id);
          }, { url: page.url(), factor });
          assert.ok(Math.abs(zoom - factor) < .001, `Zoom natif ${factor * 100} %`);
          await page.waitForFunction(value => innerWidth === 1280 / value && Math.abs(devicePixelRatio - value) < .001, factor);
          for (const [id, path, title] of [
            ['course', 'cours.html?id=matiere-organique', 'Cours'],
            ['calendar', `calendrier.html?event=${course.id}`, 'Calendrier · détail'],
            ['profile', 'profil.html', 'Profil · apparence'],
          ]) {
            await page.goto(base + path);
            await page.locator('main h1').waitFor();
            if (id === 'calendar') await page.getByRole('dialog', { name: course.title }).waitFor();
            if (id === 'profile') await page.locator('#appearance-open').press('Enter');
            if (id === 'course') await menu(page);
            await inspect(page, phase, `${id}-zoom-${factor * 100}`);
            const { data } = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
            const file = `${id}-zoom-${factor * 100}-${phase}.png`;
            await writeFile(resolve(output, file), Buffer.from(data, 'base64'));
            picture(phase, `${id}-zoom-${factor * 100}`, `${title} · zoom natif ${factor * 100} %`, file);
            await page.keyboard.press('Escape');
            assert.equal(await page.locator('dialog[open], .primary-nav__panel:not([hidden])').count(), 0);
          }
        }
      } finally { await context.close(); }
    }
  } finally {
    await unlink(manifest);
    await unlink(workerFile);
    await rmdir(extension);
  }
}

const browser = await chromium.launch();
const chromiumVersion = browser.version();
try {
  if (takePictures) await nativeZoom();
  for (const phase of phases) {
    const context = await browser.newContext(options);
    try {
      const page = await prepare(context);
      for (const view of pages) {
        await page.setViewportSize({ width: 1440, height: 1000 });
        await openPage(page, phase, view);
        for (const width of widths) {
          await page.setViewportSize({ width, height: 1000 });
          await inspect(page, phase, view.url);
          if (screenshotWidths.has(width)) await shot(page, phase, `${view.id}-${width}`, `${view.name} · ${width} × 1000`, { fullPage: true });
        }
        for (const season of seasons) for (const brightness of ['light', 'dark']) {
          const theme = await palette(page, season, brightness);
          assert.equal(theme.season, season, view.url);
          assert.equal(theme.brightness, brightness, view.url);
          themes.push({ phase, route: view.url, ...theme });
          await page.setViewportSize({ width: 390, height: 1000 });
          await inspect(page, phase, `${view.url} [${season}/${brightness}]`);
          if (brightness === 'dark' && season === 'autumn') {
            await shot(page, phase, `${view.id}-dark`, `${view.name} · sombre à 390 px`, { fullPage: true });
          }
          if (['calendrier', 'tableau-de-bord', 'itk', 'ressources', 'reconnaissance-plantes', 'profil'].includes(view.id)) {
            await shot(page, phase, `${view.id}-${season}-${brightness}`, `${view.name} · ${season} · ${brightness}`);
          }
        }
      }
    } finally {
      await context.close();
    }
    if (takePictures) {
      await states(browser, phase);
      for (const brightness of ['light', 'dark']) await buttonBoard(browser, phase, brightness);
    }
    console.log(`${phase}: ${pages.length} pages, ${widths.length} largeurs, ${seasons.length * 2} palettes`);
  }
  if (takePictures) assert.deepEqual(outputs.after, outputs.before, 'Parité des dates, de l’ordre et des détails du calendrier');
} finally {
  await browser.close();
  server.close();
}
await writeFile(resolve(output, 'controles.json'), JSON.stringify({ baselineRef, chromium: chromiumVersion, rows, themes, controls, outputs }, null, 2));
if (takePictures) {
  await writeFile(resolve(output, 'index.html'), html('Galerie comparative Mon BPREA 2027',
    `<p><a href="boutons.html">Planche globale des boutons</a> · <a href="controles.json">Mesures et parité du calendrier</a></p>${pairs([...gallery.values()])}`));
  const board = ['light', 'dark'].map(brightness => `<h2>${brightness === 'light' ? 'Clair' : 'Sombre'}</h2>` +
    controls.filter(row => row.phase === 'before' && row.brightness === brightness).map(row => {
      const after = controls.find(item => item.brightness === brightness && item.name === row.name.replace('before-', 'after-'));
      return `<details><summary>${row.title}</summary><div class="pair"><section><h3>Avant</h3>${row.figures.join('')}</section><section><h3>Après</h3>${after.figures.join('')}</section></div></details>`;
    }).join('')).join('');
  await writeFile(resolve(output, 'boutons.html'), html('Commandes de Mon BPREA 2027', `<p><a href="index.html">Galerie des pages</a></p>${board}`));
}
