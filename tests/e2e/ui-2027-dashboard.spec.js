import { test, expect } from '@playwright/test';
import { DRILL_STORAGE_KEY } from '../../assets/drill-store.js';
import { VISITOR_PROGRESS_KEY } from '../../assets/course-quiz-service.js';
import { DASHBOARD_NOW, dashboardHistory } from '../fixtures/dashboard.js';

const dashboard = '/tableau-de-bord.html';
const metrics = page => page.locator('.dashboard-metrics dd');
const points = (page, kind) => page.locator(`[data-chart-output="${kind}-detail"]`);
const details = (page, key) => page.locator(`[data-dashboard-details="${key}"]`);

async function seed(page, scenario, brightness = 'light') {
  await page.clock.setFixedTime(DASHBOARD_NOW);
  await page.addInitScript(({ drillKey, history, progressKey, brightness }) => {
    if (!sessionStorage.getItem('dashboard-fixture-seeded')) {
      localStorage.setItem(drillKey, JSON.stringify(history));
      localStorage.setItem(progressKey, JSON.stringify({ 'matiere-organique': { done: true, quizScore: 100 } }));
      localStorage.setItem('bprea-demo-appearance-device-v1', JSON.stringify({ version: 1, season: 'autumn', brightness }));
      sessionStorage.setItem('dashboard-fixture-seeded', 'yes');
    }
    const setItem = Storage.prototype.setItem;
    window.dashboardWrites = [];
    Storage.prototype.setItem = function (key, value) {
      if (this === localStorage && [drillKey, progressKey].includes(key)) window.dashboardWrites.push(key);
      return setItem.call(this, key, value);
    };
  }, { drillKey: DRILL_STORAGE_KEY, history: dashboardHistory(scenario), progressKey: VISITOR_PROGRESS_KEY, brightness });
}

test('de S’exercer aux révisions, les filtres et les ressources conservent les données locales', async ({ page }) => {
  await seed(page, 'history');
  await page.goto('/');
  await page.locator('main a[href="s-exercer.html"]').first().click();
  await page.locator('main a[href="tableau-de-bord.html"]').click();
  await expect(page.getByRole('heading', { name: 'Tableau de bord', exact: true })).toBeVisible();
  const unit = page.getByLabel('Unité capitalisable');
  const period = page.getByLabel('Période de validation');

  await expect(metrics(page)).toHaveText(['18', '9', '9', '50 %', '5']);
  const initial = await page.evaluate(keys => keys.map(key => localStorage.getItem(key)), [DRILL_STORAGE_KEY, VISITOR_PROGRESS_KEY]);
  for (const [value, total, firstDay] of [['4', '12', '26 oct.'], ['12', '29', '31 août'], ['all', '35', '5 janv.']]) {
    await period.selectOption(value);
    await expect(metrics(page).first()).toHaveText(total);
    await expect(page.locator('#dashboard-selection')).toContainText(firstDay);
  }
  await expect(metrics(page)).toHaveText(['35', '21', '14', '60 %', '10']);
  await expect(page).toHaveURL(/period=all/);
  await expect(details(page, 'notions-rework')).toHaveAttribute('open', '');
  await expect(details(page, 'notions-developing')).toContainText('1 notion');
  await expect(details(page, 'notions-strong')).toContainText('1 notion');
  const weakData = details(page, 'notions-insufficient');
  await weakData.locator('summary').click();
  const homonym = weakData.locator('.dashboard-notion').filter({ has: page.getByRole('heading', { name: 'Coefficient K2', exact: true }) });
  await expect(homonym).toHaveCount(1);
  await expect(homonym).toContainText('UC 04');
  await expect(homonym.getByRole('link')).toHaveAttribute('href', 'drill.html?unit=uc4');

  const row = page.getByRole('button', { name: /^UC 03/ });
  await row.focus();
  await row.press('Enter');
  await expect(row).toBeFocused();
  await expect(row).toHaveAttribute('aria-pressed', 'true');
  await expect(row).toContainText('Sélectionnée');
  await expect(unit).toHaveValue('uc3');
  await expect(page.locator('#dashboard-selection')).toContainText('Conduire le processus de production');
  await expect(page).toHaveURL(/period=all&unit=uc3/);
  await expect(metrics(page).first()).toHaveText('33');
  const noData = page.getByRole('button', { name: /^UC 01/ });
  await expect(noData).toContainText('Aucune donnée');
  await expect(noData.locator('.dashboard-uc-track')).toHaveCount(0);
  await page.getByRole('button', { name: 'Actualiser les données' }).click();
  await expect(metrics(page).first()).toHaveText('33');
  expect(await page.evaluate(() => window.dashboardWrites)).toEqual([]);
  expect(await page.evaluate(keys => keys.map(key => localStorage.getItem(key)), [DRILL_STORAGE_KEY, VISITOR_PROGRESS_KEY])).toEqual(initial);

  const course = details(page, 'notions-rework').locator('a[href="cours.html?id=matiere-organique"]').first();
  await expect(course).toHaveAttribute('href', 'cours.html?id=matiere-organique');
  await course.click();
  await expect(page).toHaveURL(/cours\.html\?id=matiere-organique/);
  await page.goBack();
  await expect(unit).toHaveValue('uc3');
  await expect(period).toHaveValue('all');
  await page.locator('#dashboard-drill-link').click();
  await expect(page).toHaveURL(/drill\.html\?unit=uc3/);
});

test('la courbe distingue 0 %, 100 % et les semaines vides avec clavier, souris et tableau', async ({ page }) => {
  await seed(page, 'history');
  await page.goto(`${dashboard}?period=4`);
  await expect(points(page, 'rate')).toHaveCount(4);
  const [correct, zero, missing, perfect] = await points(page, 'rate').all();
  await correct.focus();
  await page.keyboard.press('ArrowRight');
  await expect(zero).toBeFocused();
  await expect(zero.locator('circle')).toHaveCount(1);
  await expect(page.locator('#rate-detail')).toContainText('0 %');
  await page.keyboard.press('ArrowRight');
  await expect(missing).toBeFocused();
  await expect(missing.locator('circle')).toHaveCount(0);
  await expect(page.locator('#rate-detail')).toContainText('Taux non calculable');
  await page.keyboard.press('End');
  await expect(perfect).toBeFocused();
  await expect(page.locator('#rate-detail')).toContainText('100 %');
  await expect(page.locator('#rate-detail')).not.toHaveAttribute('aria-live');
  const path = await page.locator('.chart-rate-line').getAttribute('d');
  expect(path.match(/M/g)).toHaveLength(2);
  await points(page, 'volume').nth(1).hover();
  await expect(page.locator('#volume-detail')).toContainText('5 exercices réalisés');
  const weekly = details(page, 'weekly');
  await weekly.locator('summary').click();
  const table = weekly.getByRole('table');
  await expect(table.getByRole('row', { name: /^2026-W45/ }).getByRole('cell').last()).toHaveText('0 %');
  await expect(table.getByRole('row', { name: /^2026-W46/ }).getByRole('cell').last()).toHaveText('Aucune donnée');
});

test('historique long et données exclues restent consultables indépendamment des fenêtres', async ({ page }) => {
  await seed(page, 'exclusions');
  await page.goto(`${dashboard}?period=all`);
  await expect(metrics(page).first()).toHaveText('35');
  const warning = details(page, 'warnings');
  await warning.locator('summary').click();
  await expect(warning).toContainText('datée dans le futur');
  const period = page.locator('#dashboard-selection');
  await expect(period).toContainText('5 janv.');
  const latest = await points(page, 'volume').last().getAttribute('data-chart-week');
  const latestWindow = page.locator('.dashboard-chart-pager p');
  await expect(latestWindow).toContainText('2026-W36 → 2026-W47');
  const previous = page.getByRole('button', { name: 'Afficher les semaines précédentes' });
  while (await previous.isEnabled()) {
    await previous.click();
    expect(await points(page, 'volume').count()).toBeLessThanOrEqual(12);
  }
  await expect(points(page, 'volume').first()).toHaveAttribute('data-chart-week', '2026-W02');
  const next = page.getByRole('button', { name: 'Afficher les semaines suivantes' });
  await expect(next).toBeFocused();
  await expect(latestWindow).toContainText('sur 46');
  const weekly = details(page, 'weekly');
  await weekly.locator('summary').click();
  await expect(weekly.locator('tbody tr')).toHaveCount(46);
  await expect(weekly.locator('tbody tr').last()).toContainText(latest);
  await expect(metrics(page).first()).toHaveText('35');
});

test.describe('Dashboard tactile', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('le tap donne le détail d’une semaine et le mode sombre reste lisible', async ({ page }) => {
    await seed(page, 'history', 'dark');
    await page.goto(`${dashboard}?period=4`);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const zero = points(page, 'rate').nth(1);
    await zero.tap();
    await expect(page.locator('#rate-detail')).toContainText('0 %');
    await points(page, 'rate').nth(2).tap();
    await expect(page.locator('#rate-detail')).toContainText('Taux non calculable');
    await expect(page.getByLabel('Période de validation')).toBeVisible();
  });
});

test('les cartes restent dans la page à toutes les largeurs, avec zoom et contraste forcé', async ({ page }) => {
  await seed(page, 'history');
  await page.goto(`${dashboard}?period=all&unit=uc3`);
  await expect(metrics(page)).toHaveCount(5);
  const weekly = details(page, 'weekly');
  await weekly.locator('summary').click();
  for (const width of [320, 390, 640, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    const dimensions = await page.evaluate(() => ({
      pageWidth: document.documentElement.scrollWidth,
      regions: [...document.querySelectorAll('.dashboard-chart-scroll,.dashboard-table-scroll')].filter(el => el.offsetWidth)
        .map(el => [el.clientWidth, el.scrollWidth]),
    }));
    expect(dimensions.pageWidth, `largeur globale à ${width}px`).toBeLessThanOrEqual(width);
    if (width <= 390) expect(dimensions.regions.every(([available, content]) => available < content)).toBe(true);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await page.locator('html').evaluate(el => el.style.fontSize = '200%');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const selected = page.getByRole('button', { name: /^UC 03/ });
  await page.locator('[data-dashboard-unit="uc2"]').focus();
  await page.keyboard.press('Tab');
  await expect(selected).toBeFocused();
  await expect(selected).toHaveCSS('outline-width', '3px');
  await expect(selected).toHaveCSS('transition-duration', '0s');
  await expect(points(page, 'volume').locator('rect[fill="url(#dashboard-errors)"]').first()).toBeAttached();
});
