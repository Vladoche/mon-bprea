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
  await expect(page.locator('#bot-feedback')).toHaveAttribute('aria-live', 'polite');
  await expect(options.getByRole('button').first()).toBeDisabled();
  await expect(page.getByRole('link', { name: 'Source de la photographie', exact: true })).toHaveAttribute('href', photo.sourceUrl);
  await expect(page.getByRole('link', { name: photo.license, exact: true }).first()).toHaveAttribute('href', photo.licenseUrl);
  expect(photo.sourceTitle, 'Le crédit conserve le titre original de la photographie').toBeTruthy();
  await page.getByText('Crédit complet', { exact: true }).click();
  await expect(page.getByText(`Titre de la photographie : « ${photo.sourceTitle} ».`, { exact: true })).toBeVisible();
  return { photo, plant };
}

async function savedState(page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
}

test('Découverte depuis Outils : session complète, corrections, historique et révision conservés', async ({ page }) => {
  await page.goto(`${prefix}outils.html`);
  const existing = { 'bprea-demo-drill-v1': '{"version":1,"series":{}}', 'bprea-demo-progress-v1': '{"cours-test":{"done":true,"score":2}}' };
  await page.evaluate(values => Object.entries(values).forEach(([key, value]) => localStorage.setItem(key, value)), existing);
  await page.getByRole('main').getByRole('link', { name: /Reconnaissance des plantes/ }).click();
  await expect(page).toHaveURL(/\/mon-bprea\/reconnaissance-plantes\.html$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Reconnaissance des plantes' })).toBeVisible();
  const breadcrumbs = page.getByRole('navigation', { name: /Fil d’Ariane/ });
  await expect(breadcrumbs.getByRole('link', { name: 'Outils', exact: true })).toHaveAttribute('href', 'outils.html');
  await startSession(page);
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
  await expect(metric(results, 'Temps écoulés')).toHaveText('0');
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

test('Chrono : durée configurable, pause manuelle et expiration sans compter une mauvaise réponse', async ({ page }) => {
  await page.goto(`${prefix}reconnaissance-plantes.html`);
  await startSession(page, { mode: 'chrono', duration: '15' });
  const output = page.getByRole('status', { name: 'Temps restant' });
  await expect(output).toHaveText('15 s');
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
  await expect(metric(results, 'Temps écoulés')).toHaveText('1');
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
  await page.route('**/assets/botanical-photos/**', route => route.abort());
  await page.goto(`${prefix}reconnaissance-plantes.html`);
  await selectPlayableCategory(page);
  await page.getByRole('radio', { name: /^Chrono/ }).check();
  await page.getByRole('button', { name: 'Commencer la session' }).click();
  await expect(page.getByRole('heading', { name: 'Photographie indisponible' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Valider ma réponse' })).toBeDisabled();
  await page.clock.fastForward(60000);
  expect((await savedState(page)).answers).toHaveLength(0);
  await page.getByRole('button', { name: 'Passer sans compter' }).click();
  await expect(page.getByText('Photographie passée · hors calcul', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Terminer cette session', exact: true }).click();
  const results = page.locator('#bot-content');
  await expect(metric(results, 'Questions réalisées')).toHaveText('0');
  await expect(metric(results, 'Réponses incorrectes')).toHaveText('0');
  await expect(metric(results, 'Temps écoulés')).toHaveText('0');
  await expect(metric(results, 'Taux de reconnaissance')).toHaveText('Aucune donnée');
  await expect(results.getByText('1 photographie indisponible, exclue du calcul.', { exact: true })).toBeVisible();
  expect((await savedState(page)).answers[0]).toMatchObject({ status: 'skipped_image', selectedSpeciesId: null });
});

test('mobile : accès au menu Outils, thèmes conservés et choix utilisable au clavier', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${prefix}outils.html`);
  await page.getByRole('button', { name: 'Paramètres d’apparence' }).click();
  await page.getByRole('combobox', { name: 'Saison', exact: true }).selectOption('winter');
  await page.getByRole('combobox', { name: 'Luminosité', exact: true }).selectOption('dark');
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
  await page.getByRole('button', { name: 'Paramètres d’apparence' }).click();
  await page.getByRole('combobox', { name: 'Luminosité', exact: true }).selectOption('light');
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-season', 'winter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByText(/^Mon historique botanique · 1 question$/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
