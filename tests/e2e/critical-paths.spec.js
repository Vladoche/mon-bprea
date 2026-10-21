import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { makeSeries, answerFor, bankQuestions } from '../fixtures/drill.js';

const now = new Date('2026-10-20T08:00:00.000Z');
const calendar = JSON.parse(readFileSync(new URL('../fixtures/calendar.json', import.meta.url), 'utf8'));
const drillKey = 'bprea-demo-drill-v1';
const appearanceKey = 'bprea-demo-appearance-v1';

test.beforeEach(async ({ page }) => {
  // Chaque scénario reçoit un contexte neuf sans stockage préexistant.
  await page.clock.install({ time: now });
});

function metric(page, label) {
  // Contrat HTML sémantique dt/dd, indépendant des couleurs et de la mise en page.
  return page.getByRole('term').filter({ hasText: new RegExp(`^${label}$`) }).locator('..').getByRole('definition');
}

test('navigation à trois rubriques et artefact versionné sous préfixe Pages', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Faire pousser');
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  await expect(nav.getByRole('list').first().locator(':scope > li')).toHaveCount(3);
  await nav.getByRole('link', { name: 'Mes cours', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mes cours');
  await nav.getByRole('button', { name: 'Afficher les sous-rubriques de Mes cours' }).click();
  await nav.getByRole('link', { name: /UC 03/ }).click();
  await expect(page).toHaveURL(/uc\.html\?id=uc3$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Conduire le processus de production');
  await nav.getByRole('button', { name: 'Afficher les sous-rubriques de Mes cours' }).click();
  await nav.getByRole('link', { name: 'S’exercer', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('S’exercer');
  await nav.getByRole('link', { name: 'Outils', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Outils');
  await nav.getByRole('button', { name: 'Afficher les sous-rubriques de Outils' }).click();
  await nav.getByRole('link', { name: 'Générateur ITK', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Construire un itinéraire technique.');

  // A dedicated page keeps late responses from the source-navigation checks out
  // of the prepared-artifact audit, without filtering away prefix regressions.
  const publishedPage = await page.context().newPage();
  await publishedPage.clock.install({ time: now });
  const resources = [];
  publishedPage.on('response', response => {
    if (/\.(?:css|js|json)(?:\?|$)/.test(response.url())) resources.push(response);
  });
  for (const file of ['index.html', 'mes-cours.html', 's-exercer.html', 'outils.html', 'uc.html?id=uc3',
    'cours.html?id=matiere-organique', 'exercices.html?id=matiere-organique', 'drill.html?unit=uc3',
    'tableau-de-bord.html', 'calendrier.html', 'itk.html', 'ressources.html', 'reconnaissance-plantes.html']) {
    const response = await publishedPage.goto(`/mon-bprea/${file}`);
    expect(response.status(), file).toBe(200);
    await expect(publishedPage.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(publishedPage.getByRole('region', { name: 'Tu savais que… ?' })).toBeVisible();
    if (file === 'reconnaissance-plantes.html') await expect(publishedPage.getByRole('group', { name: 'Catégories botaniques' })).toBeVisible();
  }
  expect(resources.length).toBeGreaterThan(0);
  for (const response of resources) {
    const url = new URL(response.url());
    expect(response.status(), url.href).toBe(200);
    expect(url.pathname).toMatch(/^\/mon-bprea\/assets\//);
    expect(url.searchParams.get('v'), url.href).toBe('e2e-lot5-1');
  }
  const jsonFiles = new Set(resources.filter(r => new URL(r.url()).pathname.endsWith('.json'))
    .map(r => new URL(r.url()).pathname.split('/').at(-1)));
  expect([...jsonFiles].sort()).toEqual(['botanical-bank.json', 'calendar-events.json', 'daily-facts.json', 'drill-bank.json', 'navigation.json', 'resources.json']);
  // Le périmètre public exclut les nouveaux outils, fixtures et rapports.
  for (const file of ['package.json', 'tests/fixtures/calendar.json', 'node_modules/vitest/package.json', 'docs/TESTS.md']) {
    expect((await request.get(`/mon-bprea/${file}`)).status()).toBe(404);
  }
});

test('Drill : première réponse, correction, reprise et historique après rechargement', async ({ page }) => {
  await page.goto('/mon-bprea/drill.html?unit=uc3');
  await page.getByRole('button', { name: 'Commencer cette série' }).click();
  const forms = page.locator('form[data-question][data-training="false"]');
  await expect(forms).toHaveCount(10);
  const form = forms.first();
  const id = await form.getAttribute('data-question');
  const question = bankQuestions().find(question => question.id === id);
  await form.getByRole('radio', { name: question.options.find(option => option.id === question.answer).text }).check();
  await form.getByRole('button', { name: 'Valider cette réponse' }).click();
  await expect(page.getByRole('heading', { name: /Bonne réponse.*résultat comptabilisé/ })).toBeVisible();
  await expect(metric(page, 'Exercices réalisés')).toHaveText('1 / 10');
  await expect(metric(page, 'Taux de réussite')).toHaveText('100 %');
  const saved = await page.evaluate(key => localStorage.getItem(key), drillKey);
  await page.reload();
  await expect(page.getByRole('heading', { name: /Bonne réponse.*résultat comptabilisé/ })).toBeVisible();
  await expect(metric(page, 'Exercices réalisés')).toHaveText('1 / 10');
  expect(await page.evaluate(key => localStorage.getItem(key), drillKey)).toBe(saved);
  await page.goto('/mon-bprea/tableau-de-bord.html');
  await expect(metric(page, 'Exercices réalisés')).toHaveText('1');
  await expect(metric(page, 'Taux de réussite')).toHaveText('100 %');
});

test('Dashboard : état vide puis deux premières réponses réelles, sans gonfler le taux', async ({ page }) => {
  await page.goto('/tableau-de-bord.html');
  await expect(metric(page, 'Exercices réalisés')).toHaveText('0');
  await expect(metric(page, 'Taux de réussite')).toHaveText('Aucune donnée');
  const series = makeSeries();
  series.answers[series.questions[0].id] = answerFor(series.questions[0]);
  series.answers[series.questions[1].id] = answerFor(series.questions[1], { correct: false });
  const raw = JSON.stringify({ version: 1, series: { [series.id]: series } });
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: drillKey, raw });
  await page.reload();
  await expect(metric(page, 'Exercices réalisés')).toHaveText('2');
  await expect(metric(page, 'Réponses correctes')).toHaveText('1');
  await expect(metric(page, 'Réponses incorrectes')).toHaveText('1');
  await expect(metric(page, 'Taux de réussite')).toHaveText('50 %');
  await expect(page.getByRole('img', { name: /2 réalisés.*réussite 50 %/ }).first()).toBeAttached();
  expect(await page.evaluate(key => localStorage.getItem(key), drillKey)).toBe(raw);
});

test('calendrier : événements, examen, changement de mois et accès depuis l’accueil', async ({ page }) => {
  await page.route('**/assets/calendar-events.json*', route => route.fulfill({ json: calendar }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Examen UC 03 du jeu de tests' })).toBeVisible();
  await expect(page.getByText('J − 3', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Voir le calendrier' }).click();
  await expect(page).toHaveURL(/calendrier\.html\?month=2026-10$/);
  await expect(page.getByRole('heading', { name: 'octobre 2026', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Examen : Examen UC 03 du jeu de tests/ }).first().click();
  const detail = page.getByRole('dialog', { name: 'Examen UC 03 du jeu de tests' });
  await expect(detail).toBeVisible();
  await expect(detail.getByText('Lieu de test')).toBeVisible();
  await detail.getByRole('button', { name: 'Fermer le détail' }).click();
  await page.getByRole('button', { name: 'Mois suivant' }).click();
  await expect(page.getByRole('heading', { name: 'novembre 2026', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Cours : Cours de novembre du jeu de tests/ })).toBeVisible();
  await page.getByRole('button', { name: 'Mois précédent' }).click();
  await expect(page.getByRole('heading', { name: 'octobre 2026', exact: true })).toBeVisible();
});

test('outils sous préfixe : génération ITK, export CSV et téléchargement PDF', async ({ page }) => {
  await page.goto('/mon-bprea/outils.html');
  await page.getByRole('link', { name: /Générateur ITK/ }).last().click();
  await expect(page).toHaveURL(/\/mon-bprea\/itk\.html$/);
  await page.getByLabel('Surface cultivée (m²)').fill('100');
  await page.getByRole('button', { name: 'Générer mon itinéraire' }).click();
  await expect(page.getByRole('heading', { name: 'Tomate · Marmande', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Calendrier indicatif des interventions' })).toBeVisible();
  const csvPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter le calendrier CSV' }).click();
  const csv = await csvPromise;
  expect(csv.suggestedFilename()).toBe('itk-tomate.csv');
  expect(await csv.failure()).toBeNull();
  await page.goto('/mon-bprea/ressources.html');
  await page.getByRole('combobox', { name: 'Type de ressource', exact: true }).selectOption('pdf');
  const downloadLink = page.getByRole('link', { name: /Télécharger.*Fiche mémo/ });
  await expect(downloadLink).toBeVisible();
  const pdfPromise = page.waitForEvent('download');
  await downloadLink.click();
  const pdf = await pdfPromise;
  expect(pdf.suggestedFilename()).toBe('fiche-demo-matiere-organique.pdf');
  expect(await pdf.failure()).toBeNull();
  const response = await page.request.get('/mon-bprea/documents/fiche-demo-matiere-organique.pdf');
  expect(response.headers()['content-type']).toBe('application/pdf');
  expect((await response.body()).subarray(0, 5).toString()).toBe('%PDF-');
});

test('apparence mobile : préférences conservées, données intactes et anecdote renouvelée', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const anecdote = page.getByRole('region', { name: 'Tu savais que… ?' });
  await expect(anecdote).toBeVisible();
  const firstId = await anecdote.getAttribute('data-fact-id');
  const progress = '{"matiere-organique":{"done":true,"score":2}}';
  await page.evaluate(raw => localStorage.setItem('bprea-demo-progress-v1', raw), progress);
  await page.getByRole('button', { name: 'Paramètres d’apparence' }).click();
  await page.getByRole('combobox', { name: 'Saison', exact: true }).selectOption('winter');
  await page.getByRole('combobox', { name: 'Luminosité', exact: true }).selectOption('dark');
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).toHaveAttribute('data-season', 'winter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(anecdote).toBeVisible();
  await expect(anecdote).toHaveAttribute('data-fact-id', firstId);
  await expect(page.locator('html')).toHaveAttribute('data-season', 'winter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const preferences = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), appearanceKey);
  expect(preferences).toMatchObject({ season: 'winter', brightness: 'dark' });
  for (const file of ['cours.html?id=matiere-organique', 'exercices.html?id=matiere-organique', 'tableau-de-bord.html', 'calendrier.html']) {
    await page.goto(`/${file}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), file).toBe(true);
  }
  await page.getByRole('button', { name: 'Masquer l’anecdote pour aujourd’hui' }).click();
  await expect(anecdote).toBeHidden();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(anecdote).toBeHidden();
  await page.clock.setSystemTime(new Date('2026-10-20T21:59:30Z'));
  await page.clock.fastForward(60000);
  await expect(anecdote).toBeVisible();
  await expect(anecdote).toHaveAttribute('data-fact-date', '2026-10-21');
  await expect(anecdote).not.toHaveAttribute('data-fact-id', firstId);
  expect(await page.evaluate(() => localStorage.getItem('bprea-demo-progress-v1'))).toBe(progress);
});
