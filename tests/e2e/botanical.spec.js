import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const now = new Date('2026-10-20T08:00:00.000Z');
const bank = JSON.parse(readFileSync(new URL('../../assets/botanical-bank.json', import.meta.url), 'utf8'));
const storageKey = 'monbprea.botanical.v1';
const prefix = '/mon-bprea/';

test.beforeEach(async ({ page }) => {
  // Horloge arrêtée avant navigation : les avancées sont explicites, sans attente réelle.
  await page.clock.install({ time: new Date(now.getTime() - 1000) });
  await page.clock.pauseAt(now);
  // Les images et données nécessaires doivent venir de l’artefact local.
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:4173(?:\/|$))/, route => route.abort());
});

function metric(root, label) {
  return root.getByRole('term').filter({ hasText: new RegExp(`^${label}$`) })
    .locator('..').getByRole('definition');
}

async function selectPlayableCategory(page) {
  const categories = page.getByRole('group', { name: 'Catégories botaniques' });
  await expect(categories).toBeVisible();
  for (const button of await categories.getByRole('button').all()) {
    if (await button.isEnabled()) {
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByText(/questions? disponibles? pour cette session/)).toBeVisible();
      return;
    }
  }
  throw new Error('Le catalogue local doit proposer au moins une catégorie jouable.');
}

async function startSession(page, { mode = 'discovery', duration = '15' } = {}) {
  await selectPlayableCategory(page);
  if (mode === 'chrono') {
    await page.getByRole('radio', { name: /^Chrono/ }).check();
    await page.getByRole('combobox', { name: 'Durée par question' }).selectOption(duration);
  } else await page.getByRole('radio', { name: /^Découverte/ }).check();
  await page.getByRole('button', { name: 'Commencer la session' }).click();
  return questionPhoto(page);
}

async function questionPhoto(page) {
  const image = page.getByRole('img', { name: /^Photographie à identifier/ });
  await expect(image).toBeVisible();
  const choices = page.getByRole('group', { name: 'Quatre propositions' }).getByRole('button');
  await expect(choices).toHaveCount(4);
  await expect(choices.first()).toBeEnabled();
  const labels = await choices.allTextContents();
  expect(new Set(labels).size).toBe(4);
  const photoId = await image.getAttribute('data-photo-id');
  const photo = bank.photos.find(item => item.id === photoId);
  expect(photo, 'La photographie affichée appartient au catalogue réel').toBeDefined();
  expect(new URL(await image.getAttribute('src')).pathname).toMatch(/^\/mon-bprea\/assets\/botanical-photos\//);
  return photo;
}

async function answerQuestion(page, { correct = true } = {}) {
  const photo = await questionPhoto(page);
  const plant = bank.species.find(item => item.id === photo.speciesId);
  const options = page.getByRole('group', { name: 'Quatre propositions' });
  const choice = correct ? options.getByRole('button', { name: plant.commonName, exact: true })
    : options.getByRole('button').filter({ hasNotText: plant.commonName }).first();
  await choice.click();
  await expect(options.getByRole('button', { pressed: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Valider ma réponse' }).click();
  const correction = page.getByRole('region', { name: plant.commonName, exact: true });
  await expect(correction.getByRole('heading', { level: 2, name: plant.commonName })).toBeFocused();
  await expect(correction.getByText(correct ? 'Réponse correcte' : 'Réponse incorrecte', { exact: true })).toBeVisible();
  await expect(correction.getByText(`${plant.scientificName} · ${plant.family}`, { exact: true })).toBeVisible();
  await expect(correction.getByText(photo.identification, { exact: true })).toBeVisible();
  await expect(page.locator('#bot-correction-announcement')).toHaveAttribute('aria-live', 'polite');
  await expect(options.getByRole('button').first()).toBeDisabled();
  const caption = page.locator('.bot-photo figcaption');
  if (photo.id === 'groseillier-rouge-01') {
    await expect(caption).toHaveText('Luc Viatour / https://Lucnix.be');
  } else await expect(caption).toHaveCount(0);
  return { photo, plant };
}

async function savedState(page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
}

test('Découverte depuis Outils : session complète, corrections, historique et révision conservés', async ({ page }) => {
  await page.goto(`${prefix}index.html`);
  await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Outils', exact: true }).click();
  const existing = { 'bprea-demo-drill-v1': '{"version":1,"series":{}}', 'bprea-demo-progress-v1': '{"cours-test":{"done":true,"score":2}}' };
  await page.evaluate(values => Object.entries(values).forEach(([key, value]) => localStorage.setItem(key, value)), existing);
  await page.getByRole('main').getByRole('link', { name: /Reconnaissance des plantes/ }).click();
  await expect(page).toHaveURL(/\/mon-bprea\/reconnaissance-plantes\.html$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Reconnaissance des plantes' })).toBeVisible();
  const breadcrumbs = page.getByRole('navigation', { name: /Fil d’Ariane/ });
  await expect(breadcrumbs.getByRole('link', { name: 'Outils', exact: true })).toHaveAttribute('href', 'outils.html');
  await startSession(page);
  await expect(page.locator('#bot-storage')).toBeHidden();
  await expect(page.locator('#bot-content').getByRole('link', { name: 'Source de la photographie' })).toHaveCount(0);
  await expect(page.getByRole('status', { name: 'Temps restant' })).toHaveCount(0);
  const heading = await page.getByRole('heading', { name: /^Question 1 sur \d+$/ }).textContent();
  const count = Number(heading.match(/sur (\d+)/)[1]);
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThanOrEqual(10);
  const seen = new Set();
  let firstError;
  for (let index = 0; index < count; index += 1) {
    await expect(page.getByRole('heading', { name: `Question ${index + 1} sur ${count}`, exact: true })).toBeVisible();
    const result = await answerQuestion(page, { correct: index !== 0 });
    expect(seen.has(result.plant.id), 'Une espèce ne se répète pas dans la session').toBe(false);
    seen.add(result.plant.id);
    if (index === 0) firstError = result;
    await page.getByRole('button', { name: index + 1 === count ? 'Voir les résultats' : 'Question suivante' }).click();
  }
  const results = page.locator('#bot-content');
  await expect(results.getByRole('heading', { name: 'Résultats de la session' })).toBeFocused();
  await expect(metric(results, 'Questions réalisées')).toHaveText(String(count));
  await expect(metric(results, 'Réponses correctes')).toHaveText(String(count - 1));
  await expect(metric(results, 'Réponses incorrectes')).toHaveText('1');
  await expect(metric(results, 'Expirations du chrono')).toHaveText('0');
  await expect(metric(results, 'Durée chronométrée')).toHaveCount(0);
  await expect(metric(results, 'Taux de reconnaissance')).toHaveText(`${Math.round((count - 1) / count * 100)} %`);
  const saved = await savedState(page);
  expect(saved.answers).toHaveLength(count);
  expect(saved.sessions[0].completedAt).toBeTruthy();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Quel regard veux-tu entraîner ?' })).toBeVisible();
  await page.getByText(/^Mon historique botanique/).click();
  const history = page.locator('#bot-history');
  await expect(metric(history, 'Questions réalisées')).toHaveText(String(count));
  await expect(history.getByRole('table', { name: 'Résultats par espèce', exact: true })).toBeVisible();
  await expect(history.getByRole('table', { name: 'Résultats par thématique', exact: true })).toBeVisible();
  expect(await savedState(page)).toEqual(saved);
  await page.getByRole('checkbox', { name: /Revoir mes erreurs dans cette catégorie/ }).check();
  await page.getByRole('button', { name: 'Commencer la session' }).click();
  await expect(page.getByRole('heading', { name: 'Question 1 sur 1', exact: true })).toBeVisible();
  const revised = await answerQuestion(page);
  expect(revised.plant.id).toBe(firstError.plant.id);
  if (bank.photos.filter(photo => photo.speciesId === revised.plant.id).length > 1) expect(revised.photo.id).not.toBe(firstError.photo.id);
  await page.getByRole('button', { name: 'Voir les résultats' }).click();
  const afterRevision = await savedState(page);
  expect(afterRevision.answers.slice(0, count)).toEqual(saved.answers);
  expect(afterRevision.answers.at(-1)).toMatchObject({ revision: true, status: 'correct', speciesId: firstError.plant.id });
  for (const [key, value] of Object.entries(existing)) expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(value);
});

test('les crédits photographiques sont consultables dans le volet replié sous le jeu', async ({ page }) => {
  await page.goto(`${prefix}reconnaissance-plantes.html`);
  await startSession(page);
  const credits = page.locator('#bot-photo-credits');
  const disclosure = credits.getByText('Sources et licences des photographies', { exact: true });
  await expect(credits.locator('ul')).toBeHidden();
  await disclosure.press('Enter');
  await expect(credits.getByRole('listitem')).toHaveCount(bank.photos.length);
  for (const photo of bank.photos) {
    const entry = credits.locator(`[data-photo-credit="${photo.id}"]`);
    await expect(entry.getByText(photo.sourceTitle, { exact: true })).toBeVisible();
    await expect(entry.getByRole('link', { name: 'Source de la photographie', exact: true })).toHaveAttribute('href', photo.sourceUrl);
    await expect(entry.getByRole('link', { name: photo.license, exact: true })).toHaveAttribute('href', photo.licenseUrl);
  }
  const special = credits.locator('[data-photo-credit="groseillier-rouge-01"]');
  await expect(special.getByRole('link', { name: 'https://Lucnix.be', exact: true })).toHaveAttribute('href', 'https://Lucnix.be');
  await expect(special).toContainText('Luc Viatour / https://Lucnix.be');
});

test('Chrono : le compte rendu cumule le temps mesuré même sans expiration', async ({ page }) => {
  await page.goto(`${prefix}reconnaissance-plantes.html`);
  await startSession(page, { mode: 'chrono' });
  await page.clock.fastForward(4250);
  await page.getByRole('button', { name: 'Mettre en pause', exact: true }).click();
  await page.clock.fastForward(20000);
  await page.getByRole('button', { name: 'Reprendre', exact: true }).click();
  await answerQuestion(page);
  await page.getByRole('button', { name: 'Question suivante' }).click();
  await questionPhoto(page);
  await page.clock.fastForward(7380);
  await answerQuestion(page);
  await page.getByRole('button', { name: 'Terminer cette session', exact: true }).click();
  const results = page.locator('#bot-content');
  await expect(metric(results, 'Durée chronométrée')).toHaveText('11,63 s');
  await expect(metric(results, 'Expirations du chrono')).toHaveText('0');
  expect((await savedState(page)).answers.map(answer => answer.elapsedMs)).toEqual([4250, 7380]);
});

test('Chrono : durée configurable, pause manuelle et expiration sans compter une mauvaise réponse', async ({ page }) => {
  await page.goto(`${prefix}reconnaissance-plantes.html`);
  await startSession(page, { mode: 'chrono', duration: '15' });
  const output = page.getByRole('status', { name: 'Temps restant' });
  await expect(output).toHaveText('15 s');
  await expect(output).toHaveAttribute('aria-live', 'off');
  await page.clock.fastForward(5000);
  await expect(output).toHaveText('10 s');
  await page.getByRole('button', { name: 'Mettre en pause', exact: true }).click();
  await expect(page.getByText('Chronomètre en pause.', { exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Quatre propositions' }).getByRole('button').first()).toBeDisabled();
  await page.clock.fastForward(60000);
  await expect(output).toHaveText('10 s');
  expect((await savedState(page)).answers).toHaveLength(0);
  await page.getByRole('button', { name: 'Reprendre', exact: true }).click();
  await page.clock.fastForward(9000);
  await expect(output).toHaveText('1 s');
  await page.clock.fastForward(1000);
  await expect(page.getByText('Temps écoulé · aucune réponse fournie dans le temps imparti', { exact: true })).toBeVisible();
  expect((await savedState(page)).answers[0]).toMatchObject({ status: 'timeout', selectedSpeciesId: null, elapsedMs: 15000 });
  await page.clock.fastForward(120000);
  expect((await savedState(page)).answers).toHaveLength(1);
  await page.getByRole('button', { name: 'Terminer cette session', exact: true }).click();
  const results = page.locator('#bot-content');
  await expect(metric(results, 'Questions réalisées')).toHaveText('1');
  await expect(metric(results, 'Réponses incorrectes')).toHaveText('0');
  await expect(metric(results, 'Expirations du chrono')).toHaveText('1');
  await expect(metric(results, 'Durée chronométrée')).toHaveText('15 s');
  await expect(metric(results, 'Taux de reconnaissance')).toHaveText('0 %');
});

test('Chrono : un onglet masqué suspend le temps puis reprend au retour', async ({ page }) => {
  await page.goto(`${prefix}reconnaissance-plantes.html`);
  await startSession(page, { mode: 'chrono', duration: '30' });
  const output = page.getByRole('status', { name: 'Temps restant' });
  await page.clock.fastForward(8000);
  await expect(output).toHaveText('22 s');
  // Événement isolé dans ce contexte de test, sans dépendre du focus de l’OS.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByText('Chronomètre en pause.', { exact: true })).toBeVisible();
  await page.clock.fastForward(60000);
  await expect(output).toHaveText('22 s');
  expect((await savedState(page)).answers).toHaveLength(0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.fastForward(21000);
  await expect(output).toHaveText('1 s');
  await answerQuestion(page);
  const saved = await savedState(page);
  expect(saved.answers[0]).toMatchObject({ status: 'correct', elapsedMs: 29000 });
  await page.clock.fastForward(60000);
  expect((await savedState(page)).answers).toEqual(saved.answers);
});

test('Chrono : retour de page conservée en mémoire, reprise du décompte et expiration automatique', async ({ page }) => {
  await page.goto(`${prefix}reconnaissance-plantes.html`);
  await startSession(page, { mode: 'chrono', duration: '30' });
  const output = page.getByRole('status', { name: 'Temps restant' });
  await page.clock.fastForward(8000);
  await expect(output).toHaveText('22 s');
  // Reproduire les événements de restauration, sans dépendre du cache du navigateur.
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  await page.clock.fastForward(60000);
  await expect(output).toHaveText('22 s');
  expect((await savedState(page)).answers).toHaveLength(0);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await expect(output).toHaveText('22 s');
  await page.clock.fastForward(21000);
  await expect(output).toHaveText('1 s');
  await page.clock.fastForward(1000);
  await expect(page.getByText('Temps écoulé · aucune réponse fournie dans le temps imparti', { exact: true })).toBeVisible();
  expect((await savedState(page)).answers).toHaveLength(1);
  expect((await savedState(page)).answers[0]).toMatchObject({ status: 'timeout', elapsedMs: 30000 });
});

test('photographie indisponible : passage hors calcul et aucune erreur imputée au joueur', async ({ page }) => {
  let attempts = 0;
  await page.route('**/assets/botanical-photos/**', route => { attempts++; return route.abort(); });
  await page.goto(`${prefix}reconnaissance-plantes.html`);
  await selectPlayableCategory(page);
  await page.getByRole('radio', { name: /^Chrono/ }).check();
  await page.getByRole('button', { name: 'Commencer la session' }).click();
  await expect(page.getByRole('heading', { name: 'Photographie indisponible' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Valider ma réponse' })).toBeDisabled();
  await page.clock.fastForward(60000);
  expect((await savedState(page)).answers).toHaveLength(0);
  const retry = page.getByRole('button', { name: 'Réessayer l’image' });
  await retry.press('Enter');
  await expect(retry).toBeFocused();
  expect(attempts).toBe(2);
  await page.getByRole('button', { name: 'Passer sans compter' }).click();
  await expect(page.locator('.bot-outcome')).toHaveText('Photographie passée, hors calcul');
  await page.getByRole('button', { name: 'Terminer cette session', exact: true }).click();
  const results = page.locator('#bot-content');
  await expect(metric(results, 'Questions réalisées')).toHaveText('0');
  await expect(metric(results, 'Réponses incorrectes')).toHaveText('0');
  await expect(metric(results, 'Expirations du chrono')).toHaveText('0');
  await expect(metric(results, 'Durée chronométrée')).toHaveText('Non mesurée');
  await expect(metric(results, 'Taux de reconnaissance')).toHaveText('Non calculable');
  await expect(metric(results, 'Photographies passées')).toHaveText('1');
  expect((await savedState(page)).answers[0]).toMatchObject({ status: 'skipped_image', selectedSpeciesId: null });
});

test('mobile : accès au menu Outils, thèmes conservés et choix utilisable au clavier', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${prefix}outils.html`);
  await page.locator('footer').getByRole('link', { name: 'Paramètres', exact: true }).click();
  await page.getByRole('button', { name: 'Paramètres d’apparence' }).click();
  await page.getByRole('combobox', { name: 'Saison', exact: true }).selectOption('winter');
  await page.getByRole('combobox', { name: 'Luminosité', exact: true }).selectOption('dark');
  await page.getByRole('button', { name: 'Mémoriser mon apparence sur cet appareil' }).click();
  await page.keyboard.press('Escape');
  const navigation = page.getByRole('navigation', { name: 'Navigation principale' });
  await navigation.getByRole('button', { name: 'Afficher les sous-rubriques de Outils' }).click();
  await navigation.getByRole('link', { name: 'Reconnaissance des plantes', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-season', 'winter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await startSession(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const choice = page.getByRole('group', { name: 'Quatre propositions' }).getByRole('button').first();
  await choice.focus();
  await page.keyboard.press('Enter');
  await expect(choice).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Valider ma réponse' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#bot-feedback').getByRole('heading', { level: 2 })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('footer').getByRole('link', { name: 'Paramètres', exact: true }).click();
  await page.getByRole('button', { name: 'Paramètres d’apparence' }).click();
  await page.getByRole('combobox', { name: 'Luminosité', exact: true }).selectOption('light');
  await page.getByRole('button', { name: 'Mémoriser mon apparence sur cet appareil' }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.goto(`${prefix}reconnaissance-plantes.html`);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-season', 'winter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const summary = page.getByText(/^Mon historique botanique · 1 question$/);
  await page.getByRole('link', { name: 'Consulter mon historique' }).press('Enter');
  await expect(summary).toBeFocused();
  await page.keyboard.press('Tab');
  const table = page.getByRole('region', { name: 'Détail par espèce' });
  await expect(table).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => table.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
