// Recette du rendu client avec service synthétique, sans preuve Auth/RLS.
import { test, expect } from '@playwright/test';
import { makeSeries, answerFor } from '../fixtures/drill.js';
import { readDrillDocument } from '../../assets/drill-store.js';

const now = new Date('2026-10-24T10:00:00Z');
const emptyView = { series: {}, warnings: [], error: null };
function personal(state = 'synced', { count = 2, account = 'A', history = false } = {}) {
  const series = makeSeries();
  for (const [index, question] of series.questions.slice(0, count).entries())
    series.answers[question.id] = answerFor(question, { correct: index % 2 === 0 });
  const items = { [series.id]: series };
  if (history) {
    const old = makeSeries({ week: '2026-W10', startedAt: '2026-03-03T08:00:00Z' });
    old.answers[old.questions[0].id] = answerFor(old.questions[0], { answeredAt: '2026-03-03T09:00:00Z' });
    items[old.id] = old;
  }
  return { mode: 'personal', scope: `synthetic-${account}`, view: readDrillDocument({ version: 1, series: items }),
    sync: { state, pending: state === 'pending' ? 2 : 0,
      conflicts: state === 'conflict' ? [{ resolved: false }] : [], error: null } };
}
async function installDrillFixture(page, snapshot) {
  await page.clock.install({ time: now });
  await page.route('**/assets/drill-sync-service.js*', route => route.fulfill({ contentType: 'text/javascript', body: `
    const listeners = new Set(); let state = ${JSON.stringify(snapshot)};
    window.dashboardFixture = { retries: 0, next: null, fail: false, deferred: false,
      emit(next) { state = next; for (const fn of listeners) fn(state); },
      finish: null };
    export async function getDrillSyncService() { return {
      getState: () => state,
      subscribe(fn) { listeners.add(fn); fn(state); return () => listeners.delete(fn); },
      async retry() {
        const fixture = window.dashboardFixture; fixture.retries++;
        if (fixture.deferred) await new Promise(resolve => fixture.finish = resolve);
        if (fixture.fail) throw Error('Synthetic network failure');
        if (fixture.next) fixture.emit(fixture.next);
      },
      stop() { listeners.clear(); }
    }; }
  ` }));
}
async function mount(page, snapshot, query = '') {
  await installDrillFixture(page, snapshot);
  await page.goto(`/tableau-de-bord.html${query}`);
  await expect(page.locator('#dashboard-sync-status')).not.toContainText('Chargement de la session');
}
const completed = page => page.locator('.dashboard-metrics > div').filter({ has: page.locator('dt', { hasText: 'Exercices réalisés' }) }).locator('dd');
const emit = (page, snapshot) => page.evaluate(value => window.dashboardFixture.emit(value), snapshot);

test('S’exercer relance la lecture personnelle après une panne de stockage', async ({ page }) => {
  const unavailable = personal('storage-error');
  unavailable.view = { ...emptyView, error: 'Erreur de stockage synthétique' };
  await installDrillFixture(page, unavailable);
  await page.goto('/s-exercer.html');
  await expect(page.locator('#hub-weekly-content')).toContainText('Erreur de stockage synthétique');
  await page.evaluate(next => { window.dashboardFixture.next = next; }, personal());
  await page.getByRole('button', { name: 'Réessayer la lecture' }).press('Enter');
  await expect(page.locator('.hub-weekly-metrics dd').first()).toHaveText('2');
  await expect(page.getByRole('heading', { name: 'Cette semaine' })).toBeFocused();
  expect(await page.evaluate(() => window.dashboardFixture.retries)).toBe(1);
});

test('cache personnel, attente et conflits restent comptés ; un réessai récupère les nouvelles réponses', async ({ page }) => {
  await mount(page, personal('pending'));
  await expect(completed(page)).toHaveText('2');
  await expect(page.locator('footer')).toContainText('Source des résultats précisée dans le Tableau de bord');
  await expect(page.locator('#dashboard-sync-detail')).toContainText('2 éléments en attente');
  for (const state of ['offline', 'error', 'conflict']) {
    await emit(page, personal(state));
    await expect(completed(page)).toHaveText('2');
  }
  await expect(page.getByRole('link', { name: /Résoudre dans les exercices/ })).toBeVisible();
  await page.evaluate(() => window.dashboardFixture.fail = true);
  await page.getByRole('button', { name: 'Actualiser les données' }).click();
  await expect(page.locator('#dashboard-sync-detail')).toContainText('actualisation reste indisponible');
  await expect(completed(page)).toHaveText('2');
  await page.evaluate(next => Object.assign(window.dashboardFixture, { fail: false, deferred: true, next }), personal('synced', { count: 3 }));
  await page.getByRole('button', { name: 'Actualiser les données' }).click();
  await page.evaluate(() => window.dashboardFixture.finish());
  await expect(completed(page)).toHaveText('3');
  await expect(page.locator('#dashboard-sync-status')).toHaveText('Historique personnel synchronisé');
  await expect(page.getByRole('button', { name: 'Actualiser les données' })).toBeFocused();
  await expect(page.getByRole('link', { name: /Résoudre dans les exercices/ })).toBeHidden();
  expect(await page.evaluate(() => window.dashboardFixture.retries)).toBe(2);
});

test('les mises à jour préservent filtres, fenêtre graphique, tableaux ouverts et focus clavier', async ({ page }) => {
  await mount(page, personal('synced', { history: true }), '?unit=uc3&period=all');
  await page.getByRole('button', { name: 'Afficher les semaines précédentes' }).click();
  const range = await page.locator('.dashboard-chart-pager p').textContent();
  const details = page.locator('[data-dashboard-details="weekly"]');
  await details.locator('summary').click();
  const point = page.locator('[data-chart-output="volume-detail"]').first();
  await point.focus();
  const week = await point.getAttribute('data-chart-week');
  await emit(page, personal('synced', { count: 3, history: true }));
  await expect(completed(page)).toHaveText('4');
  await expect(page.locator('.dashboard-chart-pager p')).toHaveText(range);
  await expect(details).toHaveAttribute('open', '');
  await expect(page.locator(`[data-chart-week="${week}"][data-chart-output="volume-detail"]`)).toBeFocused();
  await expect(page.locator('#dashboard-unit')).toHaveValue('uc3');
  await expect(page.locator('#dashboard-period')).toHaveValue('all');
  await expect(page).toHaveURL(/unit=uc3&period=all/);
  await page.locator('#dashboard-unit').selectOption('uc4');
  await expect(completed(page)).toHaveText('0');
  await expect(page.locator('.dashboard-metrics')).toContainText('Aucune donnée');
});

test('une identité bloquée masque immédiatement les chiffres et une erreur tardive de A ne revient pas chez B', async ({ page }) => {
  await mount(page, personal());
  await expect(completed(page)).toHaveText('2');
  await page.evaluate(() => Object.assign(window.dashboardFixture, { deferred: true, fail: true }));
  await page.getByRole('button', { name: 'Actualiser les données' }).click();
  await emit(page, personal('synced', { account: 'B', count: 1 }));
  await expect(completed(page)).toHaveText('1');
  await page.evaluate(() => window.dashboardFixture.finish());
  await expect(page.locator('#dashboard-sync-detail')).not.toContainText('actualisation reste indisponible');
  await emit(page, personal('session'));
  await expect(page.locator('.dashboard-metrics')).toHaveCount(0);
  await expect(page.locator('#dashboard-login')).toBeVisible();
  await emit(page, { mode: 'visitor', scope: null, view: emptyView, sync: { state: 'visitor' } });
  await expect(completed(page)).toHaveText('0');
  await expect(page.locator('#dashboard-source')).toContainText('local de cet appareil');
});

test('un cache vide hors ligne et un cache inaccessible ne sont pas présentés comme un compte sans activité', async ({ page }) => {
  const snapshot = personal('offline', { count: 0 });
  snapshot.view = emptyView;
  await mount(page, snapshot);
  await expect(page.getByRole('heading', { name: 'Historique personnel encore incomplet' })).toBeVisible();
  await expect(page.locator('.dashboard-metrics')).toHaveCount(0);
  await emit(page, { ...snapshot, sync: { state: 'storage-error' }, view: { ...emptyView, error: 'Cache illisible.' } });
  await expect(page.locator('main').getByRole('alert')).toContainText('Cache illisible.');
  await expect(page.locator('.dashboard-metrics')).toHaveCount(0);
  await emit(page, { ...snapshot, sync: { state: 'synced' } });
  await expect(completed(page)).toHaveText('0');
  await expect(page.locator('.dashboard-metrics')).toContainText('Aucune donnée');
});

test('un statut seul garde les graphiques en place, une réponse conserve la semaine et le défilement', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mount(page, personal('synced', { history: true }), '?unit=uc3&period=all');
  const weekly = page.locator('[data-dashboard-details="weekly"]');
  await weekly.locator('summary').click();
  const plot = page.locator('.dashboard-chart-scroll').first();
  const table = weekly.locator('.dashboard-table-scroll');
  const currentWeek = plot.locator('[data-chart-week="2026-W43"]');
  await currentWeek.evaluate(element => element.focus({ preventScroll: true }));
  await plot.evaluate(element => { element.scrollLeft = 95; window.originalDashboardPlot = element; });
  await table.evaluate(element => { element.scrollLeft = 60; element.scrollTop = 120; });
  const positions = async () => [
    await plot.evaluate(el => el.scrollLeft),
    ...await table.evaluate(el => [el.scrollLeft, el.scrollTop]),
  ];
  const original = await positions();
  expect(original.every(value => value > 0)).toBe(true);

  await emit(page, personal('offline', { history: true }));
  expect(await plot.evaluate(el => el === window.originalDashboardPlot)).toBe(true);
  expect(await positions()).toEqual(original);
  await expect(currentWeek).toBeFocused();
  await expect(page.locator('#volume-detail')).toContainText('2 exercices réalisés');
  await emit(page, personal('synced', { count: 3, history: true }));
  expect(await plot.evaluate(el => el === window.originalDashboardPlot)).toBe(false);
  await expect(weekly).toHaveAttribute('open', '');
  await expect(currentWeek).toBeFocused();
  await expect(page.locator('#volume-detail')).toContainText('3 exercices réalisés');
  expect(await positions()).toEqual(original);
});
