import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rmdir, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { accounts, apiOrigin, createCourseQuizAPI } from '../tests/e2e/course-quiz-api.js';
import { settingsRow } from '../tests/e2e/settings-api.js';
import { captureButtonStates } from './ui-botanical-review.mjs';

const phases = ['before', 'after'];
const widths = [390, 768, 1440];
const base = (origin, phase) => `${origin}/${phase}/`;
const options = { locale: 'fr-FR', timezoneId: 'Europe/Paris', reducedMotion: 'reduce' };
const sync = page => page.locator('#course-quiz-sync-status');
const pseudo = page => page.locator('#auth-pseudo');
const save = page => page.getByRole('button', { name: 'Enregistrer le pseudo', exact: true });
const openAppearance = page => page.locator('#appearance-open');
const feedback = page => page.locator('#informations-compte [data-auth-message]');

export async function seedProfileLab(context, siteUrl, { account = 'A', brightness = 'light', nickname = null } = {}) {
  const origin = new URL(siteUrl).origin;
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await context.addInitScript(brightness => {
    localStorage.setItem('bprea-demo-appearance-device-v1', JSON.stringify({ version: 1, season: 'autumn', brightness }));
  }, brightness);
  const api = createCourseQuizAPI();
  api.profiles.set(accounts.A.id, nickname);
  await api.install(context, account, JSON.stringify({ 'matiere-organique': { done: true } }), siteUrl);
  await context.route(`${apiOrigin}/rest/v1/rpc/personal_save_appearance`, route => {
    if (route.request().method() === 'OPTIONS') return route.fallback();
    const value = route.request().postDataJSON();
    const row = settingsRow('appearance', value.p_preferences, accounts[account].id, value.p_operation_id, value.p_expected_revision);
    return route.fulfill({ json: { status: 'inserted', row }, headers: { 'access-control-allow-origin': '*' } });
  });
  return api;
}

export function installProfileObserver() {
  const metrics = window.profileLab = {};
  const pending = new Set();
  let opened, submitted;
  function painted(key, start = 0) {
    if (Object.hasOwn(metrics, key) || pending.has(key)) return;
    pending.add(key);
    requestAnimationFrame(() => requestAnimationFrame(() => { metrics[key] = performance.now() - start; }));
  }
  const observer = new MutationObserver(() => {
    if (document.querySelector('#auth-pseudo')) painted('profileMs');
    if (document.querySelector('#appearance-save')?.textContent.includes('Aucun choix d’apparence enregistré sur le compte')) painted('preferencesMs');
    if (opened !== undefined && document.querySelector('#appearance-dialog[open]')) painted('appearanceDialogMs', opened);
    if (submitted !== undefined && document.querySelector('#informations-compte [data-auth-message]')?.textContent === 'Ton pseudo a été enregistré.')
      painted('pseudoConfirmedMs', submitted);
  });
  observer.observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] });
  document.addEventListener('click', event => { if (event.target.closest('#appearance-open')) opened = performance.now(); }, true);
  document.addEventListener('input', event => { if (event.target.id === 'auth-pseudo') painted('pseudoInputMs', performance.now()); }, true);
  document.addEventListener('submit', event => { if (event.target.elements.pseudo) submitted = performance.now(); }, true);
}

export const profileMetricKeys = ['profileMs', 'preferencesMs', 'appearanceDialogMs', 'pseudoInputMs', 'pseudoConfirmedMs'];

export async function measureProfile(page) {
  await expect(sync(page)).toHaveText('Synchronisé');
  await openAppearance(page).click();
  await expect(page.locator('#appearance-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(openAppearance(page)).toBeFocused();
  await pseudo(page).press('End');
  await pseudo(page).press('b');
  await save(page).click();
  await page.waitForFunction(keys => keys.every(key => Number.isFinite(window.profileLab[key])), profileMetricKeys);
  return page.evaluate(() => window.profileLab);
}

function documentMarkup(title, body) {
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
    <style>body{font:16px/1.55 system-ui;margin:24px auto;padding:0 16px;max-width:1440px;background:#faf7f0;color:#342f28}.pair,.controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;margin-bottom:30px}.controls{grid-template-columns:repeat(auto-fit,minmax(190px,1fr))}img{max-width:100%;height:auto}figure{margin:0}figcaption{padding-bottom:5px}@media(max-width:640px){.pair{grid-template-columns:1fr}}</style>
    <h1>${title}</h1>${body}</html>`;
}

const figure = (file, label) => `<figure><figcaption>${label}</figcaption><a href="${file}"><img src="${file}" alt="${label}" loading="lazy"></a></figure>`;

async function checkedLayout(page, phase, state, layouts) {
  const result = await page.evaluate(() => {
    const dialog = document.querySelector('dialog[open]');
    const bounds = dialog?.getBoundingClientRect();
    return {
      width: innerWidth, scrollWidth: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight,
      dpr: devicePixelRatio, forcedColors: matchMedia('(forced-colors: active)').matches,
      dialogFits: !dialog || bounds.left >= 0 && bounds.right <= innerWidth && bounds.top >= 0 &&
        bounds.bottom <= innerHeight && dialog.scrollWidth <= dialog.clientWidth + 1,
    };
  });
  if (phase === 'after') {
    assert.ok(result.scrollWidth <= result.width, `Débordement du profil : ${state} à ${result.width} px`);
    assert.ok(result.dialogFits, `Dialogue hors fenêtre : ${state} à ${result.width} px`);
  }
  layouts.push({ phase, state, ...result });
}

async function browserZoom(origin, directory, layouts) {
  const extension = await mkdtemp(resolve(directory, 'zoom-'));
  const manifest = resolve(extension, 'manifest.json'), workerFile = resolve(extension, 'worker.js');
  await writeFile(manifest, JSON.stringify({ manifest_version: 3, name: 'Zoom de recette', version: '1', permissions: ['tabs'], background: { service_worker: 'worker.js' } }));
  await writeFile(workerFile, 'chrome.runtime.onInstalled.addListener(() => {});');
  try {
    for (const phase of phases) {
      const site = base(origin, phase);
      const context = await chromium.launchPersistentContext('', { ...options, channel: 'chromium', viewport: { width: 780, height: 1000 }, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
      try {
        await seedProfileLab(context, site, { nickname: 'Élève démo' });
        const page = context.pages()[0];
        const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
        await page.goto(site + 'profil.html');
        await expect(pseudo(page)).toBeVisible();
        const zoom = await worker.evaluate(async url => {
          const tab = (await chrome.tabs.query({})).find(item => item.url === url);
          await chrome.tabs.setZoom(tab.id, 2);
          return chrome.tabs.getZoom(tab.id);
        }, page.url());
        assert.equal(zoom, 2);
        await page.waitForFunction(() => innerWidth === 390 && devicePixelRatio === 2);
        const client = await context.newCDPSession(page);
        for (const state of ['zoom', 'zoom-dialogue']) {
          if (state === 'zoom-dialogue') await openAppearance(page).click();
          await checkedLayout(page, phase, state, layouts);
          const { data } = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
          await writeFile(resolve(directory, `${phase}-${state}.png`), Buffer.from(data, 'base64'));
        }
        await page.keyboard.press('Escape');
        await expect(openAppearance(page)).toBeFocused();
      } finally { await context.close(); }
    }
  } finally {
    await unlink(manifest);
    await unlink(workerFile);
    await rmdir(extension);
  }
}

async function compareButtons(browser, origin, directory) {
  const rows = [], site = base(origin, 'after');
  for (const brightness of ['light', 'dark']) {
    const context = await browser.newContext({ ...options, viewport: { width: 1440, height: 1000 } });
    try {
      const api = await seedProfileLab(context, site, { brightness, nickname: 'Élève démo' });
      const page = await context.newPage();
      const capture = (name, label, target, opts) => captureButtonStates(page, directory, rows, brightness, name, label, target, opts);
      await page.goto(site + 'profil.html');
      await expect(pseudo(page)).toBeVisible();
      await capture('header-actif', 'Header · Profil', page.locator('.primary-nav__item.active > .primary-nav__entry'), { header: true });
      await capture('header-neutre', 'Header · Rubrique voisine', page.locator('.primary-nav__item:not(.active) > .primary-nav__entry').first(), { header: true });
      await capture('profil-enregistrer', 'Profil · Enregistrer le pseudo', save(page));
      await capture('profil-deconnexion', 'Profil · Se déconnecter', page.locator('[data-sign-out]'));
      await capture('parametres', 'Paramètres · Régler l’apparence', openAppearance(page));
      const ack = Promise.withResolvers();
      try {
        api.holdProfile = ({ method }) => method === 'PATCH' ? ack.promise : undefined;
        await pseudo(page).fill('Élève démo modifié');
        await save(page).click();
        await expect(save(page)).toBeDisabled();
        await capture('profil-enregistrement', 'Profil · Enregistrement en cours', save(page), { disabled: true });
      } finally { ack.resolve(); }
      await expect(feedback(page)).toHaveText('Ton pseudo a été enregistré.');
      await page.goto(site + 'itk.html');
      await capture('itk', 'ITK · Générer', page.locator('#itk-form [type="submit"]'));
      await page.goto(site + 'ressources.html?type=pdf');
      await capture('bibliotheque', 'Bibliothèque · Consulter', page.locator('#resource-grid .library-open:not([download])').first());
      await page.goto(site + 'reconnaissance-plantes.html');
      await capture('botanique', 'Botanique · Commencer', page.locator('[data-start]'));
      const controls = Object.fromEntries(rows.filter(row => row.brightness === brightness).map(row => [row.name, row]));
      for (const [reference, names] of [
        ['header-actif', ['profil-enregistrer', 'itk', 'bibliotheque', 'botanique']],
        ['header-neutre', ['profil-deconnexion', 'parametres']],
      ]) for (const name of names) {
        for (const key of ['radius', 'surface', 'border', 'shadow', 'reflection']) {
          assert.equal(controls[name].states.repos[key], controls[reference].states.repos[key], `${brightness}/${name}/${key}`);
        }
        assert.equal(controls[name].states.survol.highlight, controls[reference].states.survol.highlight);
        assert.equal(controls[name].states.focus.outline, controls[reference].focus.outline);
        assert.ok(controls[name].states.repos.contrast >= 4.5, `${brightness}/${name}/contraste`);
      }
    } finally { await context.close(); }
  }
  const body = ['light', 'dark'].map(brightness => `<h2>${brightness === 'light' ? 'Mode clair' : 'Mode sombre'}</h2>${rows.filter(row => row.brightness === brightness).map(row =>
    `<h3>${row.title}</h3><div class="controls">${row.figures.join('')}</div>`).join('')}`).join('');
  await writeFile(resolve(directory, 'boutons.html'), documentMarkup('Commandes Mon BPREA 2027', body));
  return rows.map(({ figures, ...row }) => row);
}

export async function writeProfileReview(browser, { origin, baselineRef, directory }) {
  await mkdir(directory, { recursive: true });
  const layouts = [], pairs = new Map();
  const shot = async (page, phase, state, label, fullPage = false) => {
    await checkedLayout(page, phase, state, layouts);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: resolve(directory, `${phase}-${state}.png`), fullPage, animations: 'disabled' });
    pairs.set(state, label);
  };
  for (const phase of phases) {
    const site = base(origin, phase);
    const context = await browser.newContext({ ...options, viewport: { width: 390, height: 1000 } });
    try {
      const api = await seedProfileLab(context, site);
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date('2026-11-19T13:30:00Z'));
      await page.goto(site + 'profil.html');
      await expect(pseudo(page)).toBeVisible();
      await expect(sync(page)).toHaveText('Synchronisé');
      for (const width of [320, ...widths, 1024]) {
        await page.setViewportSize({ width, height: 1000 });
        if (widths.includes(width)) await shot(page, phase, `profil-${width}`, `Profil sans pseudo · ${width} × 1 000`);
        else await checkedLayout(page, phase, `profil-${width}`, layouts);
      }
      await page.setViewportSize({ width: 390, height: 1000 });
      await shot(page, phase, 'profil-complet', 'Page complète · 390 px', true);
      await pseudo(page).fill('Élève démo');
      const ack = Promise.withResolvers();
      try {
        api.holdProfile = ({ method }) => method === 'PATCH' ? ack.promise : undefined;
        await save(page).click();
        await expect(save(page)).toBeDisabled();
        await shot(page, phase, 'enregistrement', 'Enregistrement du pseudo');
        api.profileFailure = 'PATCH';
      } finally { ack.resolve(); }
      await expect(feedback(page)).toHaveAttribute('data-kind', 'error');
      await shot(page, phase, 'erreur', 'Erreur de sauvegarde, saisie conservée');
      api.profileFailure = null;
      await save(page).click();
      await expect(feedback(page)).toHaveText('Ton pseudo a été enregistré.');
      await shot(page, phase, 'pseudo-confirme', 'Pseudo enregistré');
      await page.locator('#parametres').evaluate(node => node.scrollIntoView({ block: 'start' }));
      await shot(page, phase, 'parametres', 'Paramètres et synchronisation confirmée');
      await page.locator('#course-quiz-import').click();
      await expect(page.locator('.course-quiz-import-dialog')).toBeVisible();
      await shot(page, phase, 'import', 'Import volontaire des cours et QCM');
      await page.keyboard.press('Escape');

      const lesson = 'matiere-organique';
      await page.goto(site + `cours.html?id=${lesson}`);
      await expect(sync(page)).toHaveText('Synchronisé');
      await page.locator('#mark-done').check();
      await expect(sync(page)).toHaveText('Synchronisé');
      api.restOffline = true;
      await page.locator('#mark-done').uncheck();
      await expect(sync(page)).toContainText('Connexion indisponible');
      await page.goto(site + 'profil.html#donnees-synchronisation');
      await expect(sync(page)).toContainText('1 opération en attente');
      await shot(page, phase, 'hors-ligne', 'Hors ligne avec une opération en attente');
      const key = `${accounts.A.id}:${lesson}`, row = api.courses.get(key);
      api.courses.set(key, { ...row, operation_id: '63200000-0000-4000-8000-000000000099', base_revision: row.revision, revision: row.revision + 1 });
      api.restOffline = false;
      await page.locator('#course-quiz-refresh').click();
      await expect(sync(page)).toContainText('Conflit');
      await page.locator('.course-quiz-conflict summary').click();
      await shot(page, phase, 'conflit', 'Conflit de cours et résolution');

      await page.emulateMedia({ forcedColors: 'active' });
      await openAppearance(page).click();
      await expect(page.locator('#appearance-dialog')).toBeVisible();
      await shot(page, phase, 'contraste', 'Dialogue en contraste forcé');
    } finally { await context.close(); }

    const visitor = await browser.newContext({ ...options, viewport: { width: 390, height: 1000 } });
    try {
      await seedProfileLab(visitor, site, { account: null, brightness: 'dark' });
      const page = await visitor.newPage();
      await page.goto(site + 'profil.html');
      await expect(page.getByRole('heading', { name: 'Connexion nécessaire' })).toBeVisible();
      await shot(page, phase, 'visiteur', 'Visiteur · profil sans session');
      await openAppearance(page).click();
      await expect(page.locator('#appearance-device')).toBeVisible();
      await page.locator('#appearance-brightness').selectOption('dark');
      for (const [value, label] of [['spring', 'Printemps'], ['summer', 'Été'], ['autumn', 'Automne'], ['winter', 'Hiver']]) {
        await page.locator('#appearance-season').selectOption(value);
        await expect(page.locator('html')).toHaveAttribute('data-season', value);
        await shot(page, phase, `apparence-${value}`, `Apparence visiteur · ${label}, sombre`);
      }
    } finally { await visitor.close(); }
  }
  await browserZoom(origin, directory, layouts);
  pairs.set('zoom', 'Zoom natif Chromium à 200 %');
  pairs.set('zoom-dialogue', 'Dialogue à 200 %');
  const sections = [...pairs].map(([key, label]) => `<h2>${label}</h2><div class="pair">${figure(`before-${key}.png`, 'Avant')}${figure(`after-${key}.png`, 'Après')}</div>`).join('');
  const buttons = await compareButtons(browser, origin, directory);
  await writeFile(resolve(directory, 'index.html'), documentMarkup('Mon profil 2027 · comparaisons', `<p>Référence Git ${baselineRef}. Les adresses et données de compte sont fictives. <a href="boutons.html">Comparer les boutons</a>.</p>${sections}`));
  await writeFile(resolve(directory, 'controles.json'), JSON.stringify({ layouts, buttons }, null, 2) + '\n');
}
