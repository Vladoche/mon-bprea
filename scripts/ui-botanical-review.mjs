import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rmdir, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { accounts, answerRow, createBotanicalAPI } from '../tests/e2e/botanical-api.js';
import { botanicalAnswer, botanicalSession } from '../tests/fixtures/personal-data.js';
import { answerBotanical, botanicalBank, botanicalRecords, botanicalSynced, currentBotanicalPhoto, finishBotanical, nextBotanical } from '../tests/helpers/botanical-browser.js';
import { generateItk } from '../tests/helpers/settings-browser.js';
import { seedBotanicalLab } from './ui-botanical-lab.mjs';

const phases = ['before', 'after'];
const reviewWidths = [390, 768, 1440];
const base = (origin, phase) => `${origin}/${phase}/`;
const botanical = 'reconnaissance-plantes.html';
const start = page => page.locator('[data-start]').click();
const setCategory = (page, value) => page.locator(`[data-category="${value}"]`).click();
const setMode = (page, value) => page.locator(`[name="bot-mode"][value="${value}"]`).check();
const newSession = page => page.locator('[data-new]').click();
const session = botanicalSession('botanical-review', { mode: 'discovery', completedAt: '2026-10-21T12:01:00.000Z' });
const visitorRaw = JSON.stringify({ schemaVersion: 1, sessions: [session], answers: [botanicalAnswer(session), botanicalAnswer(botanicalSession('orphan-review'))] });
const importButton = page => page.locator('#botanical-sync-import');

async function prepare(context, origin, { phase, brightness, personal = false } = {}) {
  await seedBotanicalLab(context, { brightness });
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  if (personal) {
    const api = createBotanicalAPI();
    await api.install(context, 'A', visitorRaw, base(origin, phase));
    return api;
  }
}

async function checkLayout(page, phase, state, all) {
  const info = await page.evaluate(() => {
    const image = document.querySelector('.bot-photo-frame img');
    const imageStyle = image && getComputedStyle(image);
    const mount = image?.closest('.bot-photo-mount');
    const mountStyle = mount && getComputedStyle(mount);
    const imageRect = image?.getBoundingClientRect();
    const forcedColors = matchMedia('(forced-colors: active)').matches;
    const dialog = document.querySelector('dialog[open].bot-import-dialog');
    const rect = dialog?.getBoundingClientRect();
    return {
      width: innerWidth, scrollWidth: document.documentElement.scrollWidth, dpr: devicePixelRatio,
      image: image && { id: image.dataset.photoId, width: image.naturalWidth, height: image.naturalHeight, fit: imageStyle.objectFit, filter: imageStyle.filter, transform: imageStyle.transform },
      mount: mountStyle && { padding: parseFloat(mountStyle.paddingTop), radius: parseFloat(mountStyle.borderTopLeftRadius), shadow: mountStyle.boxShadow,
        referenceShadow: getComputedStyle(mount.closest('.bot-panel')).boxShadow, forcedColors, width: imageRect.width, height: imageRect.height },
      choices: [...document.querySelectorAll('[data-choice]')].map(node => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })),
      dialog: rect && { safe: rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight && dialog.scrollWidth <= dialog.clientWidth + 1 },
      tables: [...document.querySelectorAll('.bot-table-wrap')].filter(node => node.getClientRects().length).map(node => ({ clientWidth: node.clientWidth, scrollWidth: node.scrollWidth })),
    };
  });
  if (phase === 'after') {
    assert.ok(info.scrollWidth <= info.width, `Débordement ${state} à ${info.width} px (${info.scrollWidth})`);
    assert.ok(info.choices.every(choice => choice.height >= 44 && choice.width >= 44));
    if (info.dialog) assert.ok(info.dialog.safe, `Dialogue ${state} à ${info.width} px hors écran`);
  }
  if (info.image) {
    const photo = botanicalBank.photos.find(row => row.id === info.image.id);
    assert.deepEqual(info.image, { id: photo.id, width: photo.width, height: photo.height, fit: 'contain', filter: 'none', transform: 'none' });
    if (phase === 'after') {
      const { padding, width, height, radius, forcedColors, shadow, referenceShadow } = info.mount;
      assert.ok(padding >= 8 && radius >= 12, 'Le cadre arrondi dégage les coins de la photographie');
      assert.ok(Math.abs(width - height * photo.width / photo.height) < 1, 'Le cadre conserve le ratio de la photo');
      if (!forcedColors) assert.ok(shadow !== 'none' && shadow === referenceShadow, 'Le cadre utilise l’ombre du design system');
    }
  }
  all.push({ phase, state, ...info });
}

const galleryPage = (title, description, body) => `<!doctype html><html lang="fr"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{margin:2rem auto;padding:0 1rem;max-width:100rem;background:#f8f3eb;color:#342f28;font:1rem/1.55 system-ui}h2{margin-top:2rem}a{color:#815233}.pair,.controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}figure{margin:0;padding:.5rem;background:#fff;border:1px solid #d6c8b8;border-radius:.65rem}figure img{display:block;width:100%;height:auto;max-height:58rem;object-fit:contain;object-position:top}figcaption{font-size:.875rem;margin-bottom:.35rem}.controls img{width:auto;max-width:100%}@media(max-width:700px){.pair,.controls{grid-template-columns:1fr}}</style>
<h1>${title}</h1><p>${description}</p>${body}</html>`;
const figure = (file, label) => `<figure><figcaption>${label}</figcaption><a href="${file}"><img loading="lazy" src="${file}" alt="${label}"></a></figure>`;

async function captureVisitor(page, origin, phase, capture) {
  const frozen = new Date('2026-11-19T12:00:00Z');
  await page.clock.install({ time: new Date(frozen.getTime() - 1000) });
  await page.clock.pauseAt(frozen);
  await page.goto(base(origin, phase) + botanical);
  await expect(page.locator('[data-start]')).toBeEnabled();
  await capture('accueil', 'Accueil · Découverte · catégorie indisponible');
  await page.locator('#bot-history summary').click();
  await capture('historique-vide', 'Historique vide');
  await page.locator('#bot-history summary').click();
  await setCategory(page, 'legumes');
  await setMode(page, 'chrono');
  await page.locator('#bot-duration').selectOption('15');
  await capture('reglages-chrono', 'Catégorie maraîchère sélectionnée · réglages Chrono');
  await start(page);
  const portrait = await currentBotanicalPhoto(page);
  assert.ok(portrait.photo.height > portrait.photo.width);
  await capture('portrait', 'Chrono · photographie verticale');
  await page.locator('[data-pause]').click();
  await capture('pause', 'Chrono en pause');
  await page.locator('[data-pause]').click();
  await page.clock.fastForward(15000);
  await expect(page.locator('.bot-outcome')).toContainText('Temps écoulé');
  await capture('expiration', 'Correction après expiration');
  await finishBotanical(page);

  await newSession(page);
  await setCategory(page, 'petits-fruits');
  await setMode(page, 'discovery');
  await start(page);
  const landscape = await currentBotanicalPhoto(page);
  assert.ok(landscape.photo.width > landscape.photo.height);
  await capture('paysage', 'Découverte · photographie horizontale');
  const choice = page.locator(`[data-choice="${landscape.plant.id}"]`);
  await choice.press('Enter');
  await expect(choice).toHaveAttribute('aria-pressed', 'true');
  await capture('choix', 'Proposition sélectionnée au clavier');
  await page.locator('[data-validate]').click();
  await expect(page.locator('.bot-outcome')).toHaveText('Réponse correcte');
  await capture('correcte', 'Correction d’une réponse correcte');
  await nextBotanical(page);
  const wrong = await answerBotanical(page, false);
  assert.equal(wrong.plant.id, 'groseillier-rouge');
  await page.getByText('Crédit complet', { exact: true }).click();
  await expect(page.getByText(/Luc Viatour \/ https:\/\/Lucnix.be — Wikimedia Commons/)).toBeVisible();
  await page.getByText('Caractères botaniques de l’espèce', { exact: true }).click();
  await capture('correction-longue', 'Réponse incorrecte · critères généraux et crédit complet dépliés');
  await finishBotanical(page);
  await capture('resultats', 'Résultats de la session partielle');
  await page.locator('#bot-history summary').click();
  await capture('historique', 'Historique · espèces, thématiques, dates UTC et confusions');
  await page.locator('#bot-history summary').click();
  await newSession(page);
  await page.locator('#bot-revision').check();
  await expect(page.locator('#bot-revision-count')).toHaveText('1');
  await capture('revision', 'Révision des erreurs de la catégorie');
  await page.locator('#bot-revision').uncheck();
  await setCategory(page, 'fleurs');
  await page.route('**/botanical-photos/**', route => route.abort(), { times: 2 });
  await start(page);
  await page.locator('[data-retry-image]').click();
  await expect(page.locator('[data-retry-image]')).toBeVisible();
  await capture('image-indisponible', 'Photo indisponible · réessayer ou passer');
  await page.locator('[data-skip-image]').click();
  await finishBotanical(page);
}

async function capturePersonal(page, origin, phase, api, capture) {
  await page.goto(base(origin, phase) + botanical);
  await botanicalSynced(page);
  await importButton(page).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await capture('import', 'Import volontaire · aperçu et données hors transfert');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await start(page);
  await botanicalSynced(page);
  const delayed = Promise.withResolvers();
  api.answerGate = delayed.promise;
  try {
    await answerBotanical(page);
    await expect(page.locator('#botanical-sync-status')).toContainText('en attente');
    await capture('attente', 'Réponse enregistrée sur l’appareil · envoi en attente');
    api.restOffline = true;
  } finally { api.answerGate = null; delayed.resolve(); }
  await expect(page.locator('#botanical-sync-status')).toContainText(/hors ligne/i);
  await capture('hors-ligne', 'Historique personnel en mode hors ligne');
  const document = (await botanicalRecords(page))[0];
  const answer = document.operations.find(op => op.type === 'answer').payload.p_answer;
  const other = botanicalBank.species.find(row => row.id !== answer.speciesId && row.categoryIds.includes(answer.categoryId));
  api.answers.set(`${accounts.A.id}:${answer.id}`, answerRow({ ...answer, status: 'incorrect', correct: false, selectedSpeciesId: other.id }, accounts.A.id));
  api.restOffline = false;
  await page.locator('#botanical-sync-refresh').click();
  await expect(page.locator('#botanical-sync-status')).toContainText('Conflit');
  await page.locator('.botanical-conflict summary').click();
  await capture('conflit', 'Conflit · version du compte et résolution volontaire');
}

async function captureNativeZoom(origin, directory, layouts) {
  const extension = await mkdtemp(resolve(directory, 'zoom-'));
  const manifest = resolve(extension, 'manifest.json');
  const workerScript = resolve(extension, 'worker.js');
  await writeFile(manifest, JSON.stringify({ manifest_version: 3, name: 'Zoom de recette', version: '1', permissions: ['tabs'], background: { service_worker: 'worker.js' } }));
  await writeFile(workerScript, 'chrome.runtime.onInstalled.addListener(() => {});');
  try {
    for (const phase of phases) {
      const context = await chromium.launchPersistentContext('', { channel: 'chromium', viewport: { width: 780, height: 1000 }, reducedMotion: 'reduce', args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
      try {
        await prepare(context, origin, { phase, personal: true });
        const page = context.pages()[0];
        const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
        await page.goto(base(origin, phase) + botanical);
        await botanicalSynced(page);
        const zoom = await worker.evaluate(async url => {
          const tab = (await chrome.tabs.query({})).find(item => item.url === url);
          await chrome.tabs.setZoom(tab.id, 2);
          return chrome.tabs.getZoom(tab.id);
        }, page.url());
        assert.equal(zoom, 2);
        await page.waitForFunction(() => innerWidth === 390 && devicePixelRatio === 2);
        const client = await context.newCDPSession(page);
        const zoomShot = async state => {
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          const { data } = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
          await writeFile(resolve(directory, `${phase}-${state}.png`), Buffer.from(data, 'base64'));
        };
        await importButton(page).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await checkLayout(page, phase, 'zoom-import', layouts);
        await zoomShot('zoom-import');
        if (phase === 'after') {
          const body = page.getByRole('region', { name: 'Aperçu de l’historique' });
          await page.keyboard.press('Shift+Tab');
          await expect(body).toBeFocused();
          await page.keyboard.press('PageDown');
          await expect.poll(() => body.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
        }
        await page.keyboard.press('Escape');
        await start(page);
        await currentBotanicalPhoto(page);
        await checkLayout(page, phase, 'zoom-question', layouts);
        await page.locator('.bot-photo-frame').evaluate(node => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
        await zoomShot('zoom-question');
        await page.getByRole('group', { name: 'Quatre propositions' }).evaluate(node => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
        await zoomShot('zoom-choices');
      } finally { await context.close(); }
    }
  } finally {
    await unlink(manifest);
    await unlink(workerScript);
    await rmdir(extension);
  }
}

async function styles(control) {
  return control.evaluate(node => {
    const style = getComputedStyle(node), reflection = getComputedStyle(node, '::before');
    const colors = value => [...value.matchAll(/rgb\((\d+), (\d+), (\d+)\)/g)].map(([, r, g, b]) => [r, g, b].map(Number));
    const luminance = color => color.map(channel => channel / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
      .reduce((total, value, index) => total + value * [.2126, .7152, .0722][index], 0);
    const fg = luminance(colors(style.color)[0] || [0, 0, 0]);
    const bg = colors(style.backgroundImage === 'none' ? style.backgroundColor : style.backgroundImage);
    return { minHeight: style.minHeight, height: style.height, radius: style.borderRadius, surface: style.backgroundImage,
      fill: style.backgroundColor, border: style.borderColor, color: style.color, shadow: style.boxShadow, opacity: style.opacity,
      reflection: reflection.backgroundImage, highlight: reflection.opacity, outline: style.outline, offset: style.outlineOffset,
      contrast: bg.length ? Math.min(...bg.map(luminance).map(value => (Math.max(fg, value) + .05) / (Math.min(fg, value) + .05))) : null };
  });
}

async function captureButtonStates(page, directory, controls, brightness, name, title, target, { header = false, disabled = false } = {}) {
  await target.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.mouse.move(0, 0);
  await target.evaluate(node => { if (node.contains(document.activeElement)) document.activeElement.blur(); });
  const row = { brightness, name, title, states: {}, figures: [] };
  const states = disabled ? ['désactivé'] : ['repos', 'survol', 'focus', 'actif'];
  for (const state of states) {
    const control = header ? target.locator('.primary-nav__top-link') : target;
    if (state === 'survol' || state === 'actif') await control.hover();
    if (state === 'focus') {
      await page.mouse.move(0, 0);
      await page.keyboard.press('Tab');
      await control.focus();
      assert.ok(await control.evaluate(node => node.matches(':focus-visible')), `${title}, focus visible`);
    }
    if (state === 'actif') await page.mouse.down();
    const { x, y, width, height } = await target.boundingBox();
    const vp = page.viewportSize();
    const left = Math.max(0, Math.floor(x) - 8), top = Math.max(0, Math.floor(y) - 8);
    const clip = { x: left, y: top, width: Math.min(vp.width - left, Math.ceil(x + width) + 8 - left), height: Math.min(vp.height - top, Math.ceil(y + height) + 8 - top) };
    const file = `${brightness}-${name}-${row.figures.length + 1}.png`;
    await page.screenshot({ path: resolve(directory, file), clip, animations: 'disabled' });
    row.figures.push(figure(file, state));
    row.states[state] = await styles(target);
    if (header && state === 'focus') row.focus = await styles(control);
    if (state === 'actif') { await page.mouse.move(0, 0); await page.mouse.up(); }
  }
  controls.push(row);
}

async function captureButtons(browser, origin, directory) {
  const controls = [];
  for (const brightness of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'fr-FR', reducedMotion: 'reduce' });
    try {
      await prepare(context, origin, { phase: 'after', brightness, personal: true });
      const page = await context.newPage();
      const button = (name, title, selector, options) => captureButtonStates(page, directory, controls, brightness, name, title, page.locator(selector).first(), options);
      await page.goto(base(origin, 'after') + 'itk.html');
      await button('header-actif', 'Header · rubrique active', '.primary-nav__item.active > .primary-nav__entry', { header: true });
      await button('header-neutre', 'Header · rubrique voisine', '.primary-nav__item:not(.active) > .primary-nav__entry', { header: true });
      await generateItk(page);
      await button('itk-generer', 'ITK · Générer', '#itk-form [type="submit"]');
      await button('itk-exporter', 'ITK · Exporter', '#csv-export');
      await page.goto(base(origin, 'after') + 'ressources.html?type=pdf');
      await button('bibliotheque-consulter', 'Bibliothèque · Consulter', '#resource-grid .library-open:not([download])');
      await button('bibliotheque-filtres', 'Bibliothèque · Réinitialiser les filtres', '.library-reset');
      await page.goto(base(origin, 'after') + botanical);
      await botanicalSynced(page);
      await button('demarrer', 'Botanique · Commencer la session', '[data-start]');
      await button('synchro', 'Botanique · Actualiser l’historique', '#botanical-sync-refresh');
      await importButton(page).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await button('importer', 'Import · Confirmer', '#botanical-import-confirm');
      await button('annuler', 'Import · Annuler', '#botanical-import-cancel');
      await page.keyboard.press('Escape');
      await start(page);
      await currentBotanicalPhoto(page);
      await button('arreter', 'Botanique · Terminer la session', '[data-stop]');
      await button('valider-inactif', 'Botanique · Validation désactivée', '[data-validate]', { disabled: true });
      await button('reponse', 'Botanique · Proposition au repos', '[data-choice]');
      await page.locator('[data-choice]').first().click();
      await button('selection', 'Botanique · Proposition sélectionnée', '[data-choice][aria-pressed="true"]');
      await button('valider', 'Botanique · Valider ma réponse', '[data-validate]');
      const byName = Object.fromEntries(controls.filter(row => row.brightness === brightness).map(row => [row.name, row]));
      for (const [reference, names] of [
        ['header-actif', ['itk-generer', 'bibliotheque-consulter', 'demarrer', 'importer', 'valider']],
        ['header-neutre', ['itk-exporter', 'bibliotheque-filtres', 'synchro', 'annuler', 'arreter']],
      ]) for (const name of names) {
        for (const key of ['radius', 'surface', 'border', 'shadow', 'reflection']) {
          assert.equal(byName[name].states.repos[key], byName[reference].states.repos[key], `${brightness}/${name}/${key}`);
        }
        assert.equal(byName[name].states.survol.highlight, byName[reference].states.survol.highlight, `${brightness}/${name}/reflet`);
        assert.equal(byName[name].states.focus.outline, byName[reference].focus.outline, `${brightness}/${name}/focus`);
        assert.ok(byName[name].states.repos.contrast >= 4.5, `${brightness}/${name}/contraste`);
      }
      for (const key of ['surface', 'shadow', 'reflection']) {
        assert.equal(byName.reponse.states.repos[key], byName['header-neutre'].states.repos[key], `${brightness}/réponse/${key}`);
      }
    } finally { await context.close(); }
  }
  return controls;
}

export async function writeBotanicalReview(browser, { origin, baselineRef, directory }) {
  await mkdir(directory, { recursive: true });
  const layouts = [], entries = new Map();
  const snapshot = (page, phase, width, suffix = '') => async (name, title) => {
    const key = `${name}-${width}${suffix}`;
    entries.set(key, `${title} · ${width} px`);
    await checkLayout(page, phase, key, layouts);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: resolve(directory, `${phase}-${key}.png`), fullPage: name !== 'import', animations: 'disabled' });
  };
  for (const phase of phases) for (const width of reviewWidths) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, locale: 'fr-FR', timezoneId: 'Europe/Paris', reducedMotion: 'reduce' });
    try {
      await prepare(context, origin);
      const page = await context.newPage();
      await captureVisitor(page, origin, phase, snapshot(page, phase, width));
      if (width !== 768) {
        await newSession(page);
        await setCategory(page, 'petits-fruits');
        await page.evaluate(() => BpreaAppearance.updatePreferences({ brightness: 'dark', season: 'winter' }));
        await snapshot(page, phase, width)('sombre', 'Accueil en hiver sombre');
        await start(page);
        await currentBotanicalPhoto(page);
        await snapshot(page, phase, width)('sombre-question', 'Photographie en hiver sombre');
        if (width === 390) {
          await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
          await page.locator('[data-choice]').first().press('Enter');
          await snapshot(page, phase, width)('contraste-force', 'Contraste forcé · proposition sélectionnée au clavier');
        }
      } else for (const season of ['spring', 'summer', 'autumn', 'winter']) {
        await newSession(page);
        await page.evaluate(season => BpreaAppearance.updatePreferences({ brightness: 'light', season }), season);
        await snapshot(page, phase, width)(`saison-${season}`, `Palette ${season}`);
        await start(page);
        await finishBotanical(page);
      }
    } finally { await context.close(); }
    if (width === 768) continue;
    const personal = await browser.newContext({ viewport: { width, height: 1000 }, locale: 'fr-FR', timezoneId: 'Europe/Paris', reducedMotion: 'reduce' });
    try {
      const api = await prepare(personal, origin, { phase, personal: true, brightness: width === 390 ? 'dark' : 'light' });
      const page = await personal.newPage();
      await capturePersonal(page, origin, phase, api, snapshot(page, phase, width));
    } finally { await personal.close(); }
  }
  for (const width of [320, 1024]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    try {
      await prepare(context, origin, { phase: 'after', personal: true });
      const page = await context.newPage();
      await page.goto(base(origin, 'after') + botanical);
      await botanicalSynced(page);
      await checkLayout(page, 'after', 'accueil', layouts);
      await importButton(page).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await checkLayout(page, 'after', 'import', layouts);
      await page.keyboard.press('Escape');
      await start(page);
      await answerBotanical(page, false);
      await checkLayout(page, 'after', 'correction', layouts);
      await finishBotanical(page);
      await page.locator('#bot-history summary').click();
      await checkLayout(page, 'after', 'historique et résultats', layouts);
    } finally { await context.close(); }
  }
  await captureNativeZoom(origin, directory, layouts);
  entries.set('zoom-import', 'Import au zoom natif 200 %');
  entries.set('zoom-question', 'Photographie au zoom natif 200 %');
  entries.set('zoom-choices', 'Propositions au zoom natif 200 %');
  const pair = (key, title) => `<h2>${title}</h2><div class="pair">${figure(`before-${key}.png`, 'Avant')}${figure(`after-${key}.png`, 'Après')}</div>`;
  await writeFile(resolve(directory, 'index.html'), galleryPage('Reconnaissance botanique 2027', `Commit de référence ${baselineRef}. <a href="boutons.html">Planche des commandes</a>. Les écrans personnels utilisent une simulation HTTP fictive. <a href="https://github.com/Vladoche/mon-bprea/blob/main/docs/architecture/BOTANICAL-SOURCES.md">Crédits et licences des photographies</a>.`, [...entries].map(([key, title]) => pair(key, title)).join('')));
  const controls = await captureButtons(browser, origin, directory);
  await writeFile(resolve(directory, 'boutons.html'), galleryPage('Commandes botaniques et navigation 2027', 'Commandes rendues par les pages à 1 440 px. Les commandes actives, sélectionnées et désactivées restent repérables au clavier et par leur libellé.', ['light', 'dark'].map(brightness => `<h2>${brightness === 'light' ? 'Mode clair' : 'Mode sombre'}</h2>${controls.filter(row => row.brightness === brightness).map(row => `<h3>${row.title}</h3><div class="controls">${row.figures.join('')}</div>`).join('')}`).join('')));
  await writeFile(resolve(directory, 'controles.json'), JSON.stringify({ layouts, controls: controls.map(({ figures, ...row }) => row) }, null, 2));
}
