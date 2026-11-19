import { expect, test } from '@playwright/test';
import { busy, course, empty, exam, example } from '../fixtures/calendar-2027.js';

const source = '**/assets/calendar-events.json*';
const path = '/calendrier.html';
const month = page => page.locator('#calendar-month-title');
const agenda = page => page.getByRole('region', { name: /^Agenda du/ });
const days = page => page.locator('#calendar-days');
const day = (page, key) => days(page).locator('td').filter({ has: page.locator(`time[datetime="${key}"]`) });
const supply = (page, json = busy) => page.route(source, route => route.fulfill({ json }));

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-06-14T09:00:00+02:00'));
});

test('accès depuis S’exercer et le footer, y compris dans l’artefact Pages', async ({ page }) => {
  await supply(page);
  await page.goto('/mon-bprea/s-exercer.html');
  await page.getByRole('main').getByRole('link', { name: /Calendrier/i }).click();
  await expect(page).toHaveURL(/\/mon-bprea\/calendrier\.html$/);
  await expect(month(page)).toHaveText('juin 2027');
  await expect(agenda(page).getByText(course.title)).toBeVisible();
  await page.goto('/mon-bprea/index.html');
  await page.getByRole('contentinfo').getByRole('link', { name: 'Calendrier', exact: true }).click();
  await expect(page).toHaveURL(/\/mon-bprea\/calendrier\.html$/);
  await expect(page.getByRole('navigation', { name: 'Fil d’Ariane' }).getByText('Calendrier')).toHaveAttribute('aria-current', 'page');
});

test('commandes de mois, bornes et périodes inclusives entre deux années', async ({ page }) => {
  let requests = 0;
  await page.route(source, route => {
    requests++;
    return route.fulfill({ json: busy });
  });
  await page.goto(`${path}?month=2027-12`);
  await expect(month(page)).toHaveText('décembre 2027');
  await expect(day(page, '2027-12-30').getByRole('button', { name: /Période à cheval/ })).toBeVisible();
  await expect(day(page, '2028-01-01').getByRole('button')).toHaveCount(0);
  const next = page.getByRole('button', { name: 'Mois suivant' });
  await next.press('Enter');
  await expect(next).toBeFocused();
  await expect(month(page)).toHaveText('janvier 2028');
  await expect(day(page, '2028-01-03').getByRole('button', { name: /Période à cheval/ })).toBeVisible();
  await expect(day(page, '2028-01-04').getByRole('button')).toHaveCount(0);
  await page.getByRole('button', { name: 'Mois précédent' }).click();
  await expect(month(page)).toHaveText('décembre 2027');

  const input = page.getByLabel('Aller au mois');
  await input.fill('2027-02');
  await expect(days(page).locator('td:not(.calendar-outside)')).toHaveCount(28);
  await input.fill('2028-02');
  await expect(days(page).locator('td:not(.calendar-outside)')).toHaveCount(29);
  for (const [value, name] of [['0001-01', 'Mois précédent'], ['9999-12', 'Mois suivant']]) {
    await input.fill(value);
    await expect(input).toHaveValue(value);
    await expect(page.getByRole('button', { name })).toBeDisabled();
  }
  await page.getByRole('button', { name: 'Aujourd’hui', exact: true }).click();
  await expect(month(page)).toHaveText('juin 2027');
  await expect(day(page, '2027-06-14').locator('[aria-current=date]')).toHaveText('14');
  await expect(days(page).locator('[aria-current=date]')).toHaveCount(1);
  expect(requests).toBe(1);
});

test('surfaces du header, cibles tactiles et champ mois natif du calendrier', async ({ page }) => {
  await supply(page);
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto(path);
  const previous = page.getByRole('button', { name: 'Mois précédent' });
  const today = page.getByRole('button', { name: 'Aujourd’hui', exact: true });
  const next = page.getByRole('button', { name: 'Mois suivant' });
  const input = page.getByLabel('Aller au mois');
  const reference = page.locator('.primary-nav__item:not(.active) > .primary-nav__entry').first();
  for (const brightness of ['light', 'dark']) {
    await page.evaluate(value => window.BpreaAppearance.updatePreferences({ brightness: value }), brightness);
    const surface = await reference.evaluate(node => getComputedStyle(node).backgroundImage);
    expect(surface).toContain('linear-gradient');
    for (const control of [previous, today, next]) {
      await expect(control).toHaveCSS('background-image', surface);
      const { width, height } = await control.boundingBox();
      expect(width).toBeGreaterThanOrEqual(44);
      expect(height).toBeGreaterThanOrEqual(44);
    }
  }
  await expect(input).toHaveAttribute('type', 'month');
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await previous.press('Tab');
  await expect(today).toBeFocused();
  await expect(today).toHaveCSS('outline-width', '3px');
  await expect(today).toHaveCSS('transition-duration', '0s');
  await input.fill('0001-01');
  await expect(previous).toBeDisabled();
  await expect(previous).toHaveCSS('background-image', 'none');
});

test('grille, tri, chevauchement, avertissements et débordement vers l’agenda', async ({ page }) => {
  await supply(page);
  await page.goto(`${path}?date=2027-06-14`);
  await expect(page.getByRole('columnheader')).toHaveCount(7);
  await expect(page.getByRole('columnheader').first()).toHaveAccessibleName('Lundi');
  await expect(day(page, '2027-06-11').getByRole('button', { name: /^Stage/ })).toBeVisible();
  await expect(day(page, '2027-06-17').getByRole('button', { name: /^Stage/ })).toBeVisible();
  await expect(day(page, '2027-06-18').getByRole('button')).toHaveCount(0);
  await expect(agenda(page).locator('h3')).toHaveText([
    /Observation en entreprise/, new RegExp(course.title), new RegExp(example.title), new RegExp(exam.title), /Pause de formation/,
  ]);
  await expect(agenda(page).getByText('Sur plusieurs mois')).toBeVisible();
  await expect(agenda(page).getByText('Date impossible de test')).toHaveCount(0);
  const warnings = page.getByText('Certaines informations sont incomplètes (2)');
  await warnings.press('Enter');
  await expect(page.getByText(/l’UC indiquée est inconnue/)).toBeVisible();
  await expect(page.getByText(/date de début invalide/)).toBeVisible();

  await day(page, '2027-06-14').getByRole('button', { name: /Voir 4 événements/ }).click();
  await expect(page.getByRole('heading', { name: /Agenda du lundi 14 juin/ })).toBeFocused();
  await expect(agenda(page).locator('.calendar-agenda-list > li')).toHaveCount(4);
  await expect(agenda(page).getByText('Examen · Exemple fictif')).toBeVisible();
  await expect(agenda(page).locator('.calendar-agenda-list > li').filter({ hasText: example.title }).getByRole('link')).toHaveCount(0);
  await agenda(page).getByRole('button', { name: 'Voir tout le mois' }).press('Enter');
  await expect(page.getByRole('heading', { name: 'Agenda du mois' })).toBeFocused();
  await expect(agenda(page).locator('.calendar-agenda-list > li')).toHaveCount(5);

  await page.getByRole('button', { name: 'Mois suivant' }).click();
  await expect(day(page, '2027-06-30').getByRole('button')).toHaveCount(0);
  await expect(day(page, '2027-07-05').getByRole('button', { name: /^Vacances/ })).toBeVisible();
  await expect(day(page, '2027-07-06').getByRole('button')).toHaveCount(0);
});

test('dialogue clavier et souris, contenu littéral et retour au déclencheur', async ({ page }) => {
  await supply(page);
  await page.goto(path);
  const cellButton = day(page, '2027-06-14').getByRole('button', { name: /^Cours/ });
  await cellButton.press('Enter');
  const dialog = page.getByRole('dialog', { name: course.title });
  await expect(dialog.getByRole('heading')).toBeFocused();
  await expect(dialog.getByRole('link')).toHaveAttribute('href', 'uc.html?id=uc3');
  await expect(dialog.getByText(course.location)).toBeVisible();
  expect(await dialog.locator('.calendar-description').textContent()).toBe(course.description);
  await expect(dialog.locator('.calendar-description strong')).toHaveCount(0);
  await page.locator('[data-month-step="1"]').evaluate(button => button.focus());
  await expect(dialog.getByRole('heading')).toBeFocused();
  for (const key of ['Tab', 'Tab', 'Tab', 'Shift+Tab', 'Tab']) {
    await page.keyboard.press(key);
    expect(await page.evaluate(() => document.activeElement === document.body || Boolean(document.activeElement.closest('dialog[open]')))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(cellButton).toBeFocused();

  const trigger = agenda(page).getByRole('button', { name: new RegExp(exam.title) });
  await trigger.click();
  const detail = page.getByRole('dialog', { name: exam.title });
  await expect(detail.getByText(exam.location)).toBeVisible();
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await detail.getByRole('button', { name: 'Fermer le détail' }).click();
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
});

test('liens directs valides, inconnus ou malformés', async ({ page }) => {
  await supply(page);
  await page.goto(`${path}?event=${example.id}`);
  const detail = page.getByRole('dialog', { name: example.title });
  await expect(detail.getByText('Examen · Exemple fictif')).toBeVisible();
  await expect(detail.getByText(/ne correspond à aucune date réelle/)).toBeVisible();
  await expect(detail.getByRole('link')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(month(page)).toBeFocused();

  await page.goto(`${path}?event=stage-transition-annee`);
  await expect(month(page)).toHaveText('décembre 2027');
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.goto(`${path}?date=2027-02-30&month=2027-13&event=%3Cunknown%3E&autre=2027-01`);
  await expect(month(page)).toHaveText('juin 2027');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(agenda(page).locator('.calendar-agenda-list > li')).toHaveCount(5);
});

test('chargement, erreur et nouvel essai sans réinitialiser le mois', async ({ page }) => {
  let answer;
  let requests = 0;
  const loaded = new Promise(resolve => { answer = resolve; });
  await page.route(source, async route => {
    requests++;
    if (requests === 1) {
      await loaded;
      await route.abort();
    } else {
      await route.fulfill({ json: empty });
    }
  });
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  const loading = page.getByRole('status').filter({ hasText: 'Chargement des événements de formation' });
  await expect(loading).toBeVisible();
  await expect(agenda(page).getByText('Aucun événement prévu dans ce mois.')).toHaveCount(0);
  answer();
  await expect(page.getByRole('alert').getByText('Calendrier indisponible')).toBeVisible();
  await page.getByRole('button', { name: 'Mois suivant' }).click();
  const retry = page.getByRole('button', { name: 'Réessayer' });
  await retry.press('Enter');
  await expect(agenda(page).getByText('Aucun événement prévu dans ce mois.')).toBeVisible();
  await expect(agenda(page).getByText('Aucune date de formation n’a encore été renseignée.')).toBeVisible();
  await expect(month(page)).toHaveText('juillet 2027');
  await expect(month(page)).toBeFocused();
  expect(requests).toBe(2);
});

test('mois vide dans une source renseignée', async ({ page }) => {
  await supply(page);
  await page.goto(`${path}?month=2027-08`);
  await expect(agenda(page).getByText('Aucun événement prévu dans ce mois.')).toBeVisible();
  await expect(agenda(page).getByText(/en parcourant les autres mois/)).toBeVisible();
});

test.describe('Écran tactile', () => {
  test.use({ hasTouch: true });

  test('agenda mobile, détail long, thèmes et reflow de 320 à 1440 px', async ({ page }) => {
    const long = { ...course, title: course.title.repeat(4), description: `${course.description}\n`.repeat(40), location: course.location.repeat(4) };
    await supply(page, { version: 1, events: [long, example] });
    await page.setViewportSize({ width: 320, height: 780 });
    await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
    await page.goto(path);
    const button = day(page, '2027-06-14').getByRole('button', { name: /Voir 2 événements.*exemple fictif/ });
    await expect(button).toHaveText('2*');
    expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await button.tap();
    await expect(agenda(page).locator('.calendar-agenda-list > li')).toHaveCount(2);
    await agenda(page).getByRole('button', { name: new RegExp(course.title) }).click();
    const dialog = page.getByRole('dialog', { name: long.title });
    await expect(dialog.getByRole('heading')).toHaveText(long.title);
    const close = dialog.getByRole('button', { name: 'Fermer le détail' });
    expect(await dialog.locator('.calendar-dialog-content').evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
    await expect(close).toBeInViewport();
    await close.tap();
    await page.emulateMedia({ forcedColors: 'none' });
    await page.evaluate(() => window.BpreaAppearance.updatePreferences({ brightness: 'dark', season: 'winter' }));
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    }
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.addStyleTag({ content: 'html { font-size: 200%; }' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    const toolbar = await page.locator('.calendar-toolbar').boundingBox();
    const field = await page.getByLabel('Aller au mois').boundingBox();
    expect(field.x).toBeGreaterThanOrEqual(toolbar.x);
    expect(field.x + field.width).toBeLessThanOrEqual(toolbar.x + toolbar.width);
    await expect(button).toBeVisible();
  });
});

test('consultation en lecture seule des données pédagogiques', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('bprea-demo-progress-v1', '{"matiere-organique":{"done":true,"score":2}}');
    localStorage.setItem('bprea-demo-drill-v1', '{"existing":"fixture pédagogique"}');
    window.calendarWrites = [];
    for (const [prototype, names] of [
      [Storage.prototype, ['setItem', 'removeItem', 'clear']],
      [IDBObjectStore.prototype, ['put', 'add', 'delete', 'clear']],
    ]) {
      for (const name of names) {
        const method = prototype[name];
        prototype[name] = function (...args) {
          window.calendarWrites.push([name, this.name || args[0] || '']);
          return method.apply(this, args);
        };
      }
    }
  });
  const unexpected = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.hostname !== '127.0.0.1' || /\/(auth|rest|functions)\/v1\//.test(url.pathname) || request.method() !== 'GET') unexpected.push(url.pathname);
  });
  await supply(page);
  await page.goto(path);
  await agenda(page).getByRole('button', { name: new RegExp(course.title) }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Mois suivant' }).click();
  await expect(month(page)).toHaveText('juillet 2027');
  expect(await page.evaluate(() => window.calendarWrites)).toEqual([]);
  expect(unexpected).toEqual([]);
});
