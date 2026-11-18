import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { busy, course, empty, exam, example, sparse } from '../tests/fixtures/calendar-2027.js';

const source = '**/assets/calendar-events.json';
const firstItem = '.calendar-agenda-list > li';
const URL_PATH = 'calendrier.html?month=2027-06';
const height = 1000;
const date = new Date('2027-06-14T09:00:00+02:00');

export async function seedCalendar(page, { json = busy, brightness = 'light', unavailable = false, delayed = null } = {}) {
  await page.addInitScript(({ brightness, stamp }) => {
    const NativeDate = Date;
    window.Date = new Proxy(NativeDate, {
      construct(target, args) { return Reflect.construct(target, args.length ? args : [stamp]); },
      apply() { return new NativeDate(stamp).toString(); },
      get(target, property) { return property === 'now' ? () => stamp : Reflect.get(target, property); },
    });
    localStorage.setItem('bprea-demo-appearance-device-v1', JSON.stringify({ version: 1, season: 'autumn', brightness }));
  }, { brightness, stamp: date.getTime() });
  await page.route(source, async route => {
    if (delayed) await delayed;
    return unavailable ? route.fulfill({ status: 503 }) : route.fulfill({ json });
  });
}

export function installCalendarObserver() {
  window.calendarLab = { shifts: 0, actionMs: {} };
  new PerformanceObserver(list => {
    window.calendarLab.shifts += list.getEntries().reduce((sum, entry) => sum + entry.value, 0);
  }).observe({ type: 'layout-shift', buffered: true });

  const afterPaint = callback => requestAnimationFrame(() => requestAnimationFrame(callback));
  const observer = new MutationObserver(() => {
    if (!document.querySelector('.calendar-agenda-list > li')) return;
    observer.disconnect();
    afterPaint(() => { window.calendarLab.monthReadyMs = performance.now(); });
  });
  observer.observe(document, { childList: true, subtree: true });
  document.addEventListener('click', event => {
    const action = event.target.closest('[data-month-step]') ? 'monthChangeMs'
      : event.target.closest('[data-calendar-event]') ? 'detailOpenMs' : null;
    if (!action) return;
    const start = performance.now();
    afterPaint(() => { window.calendarLab.actionMs[action] = performance.now() - start; });
  }, true);
}

export async function measureCalendar(page) {
  const before = await page.evaluate(() => ({ shifts: window.calendarLab.shifts, scroll: scrollY }));
  await page.getByRole('button', { name: 'Mois suivant' }).click();
  await page.waitForFunction(() => window.calendarLab.actionMs.monthChangeMs !== undefined);
  const after = await page.evaluate(() => ({ shifts: window.calendarLab.shifts, scroll: scrollY }));

  await page.locator('.calendar-grid [data-calendar-event="vacances-transition"]').first().click();
  await page.waitForFunction(() => window.calendarLab.actionMs.detailOpenMs !== undefined);
  return page.evaluate(({ before, after }) => ({
    monthReadyMs: window.calendarLab.monthReadyMs,
    ...window.calendarLab.actionMs,
    monthChangeShift: after.shifts - before.shifts,
    monthChangeScroll: after.scroll - before.scroll,
    interactionShift: window.calendarLab.shifts - before.shifts,
    calendarRequests: performance.getEntriesByType('resource').filter(entry => entry.name.endsWith('/calendar-events.json')).length,
  }), { before, after });
}

const scenarios = [
  { id: 'source-vide', label: 'Source vide · grille et agenda', json: empty },
  { id: 'mois-rempli', label: 'Quelques événements', json: sparse },
  { id: 'jour-charge', label: 'Mois chargé et plusieurs événements le même jour' },
  { id: 'periode', label: 'Période à cheval sur juin et juillet', month: '2027-07' },
  { id: 'agenda', label: 'Agenda rempli', anchor: '#calendar-agenda-title' },
  { id: 'agenda-vide', label: 'Mois sans événement dans une source renseignée', month: '2027-08', anchor: '#calendar-agenda-title' },
  { id: 'cours', label: 'Fiche d’un cours et description multiligne', event: course.id },
  { id: 'examen', label: 'Fiche d’un examen', event: exam.id },
  { id: 'exemple', label: 'Fiche d’un exemple fictif', event: example.id },
  { id: 'erreur', label: 'Erreur de chargement', unavailable: true, anchor: '.calendar-notice:has([data-calendar-retry])' },
  { id: 'avertissements', label: 'Avertissements dépliés', warnings: true, anchor: 'details.calendar-notice' },
  { id: 'sombre', label: 'Mode sombre', brightness: 'dark' },
  { id: 'contraste', label: 'Contraste forcé et repère du jour courant', forcedColors: 'active' },
  { id: 'texte-200', label: 'Grille et commandes avec le texte à 200 %', enlarged: true, anchor: '.calendar-board' },
  { id: 'chargement', label: 'Attente de la source', waitForSource: true },
];

const cases = [
  ...[390, 768, 1440].flatMap(width => scenarios.filter(scenario => width !== 768 ||
    ['source-vide', 'mois-rempli', 'jour-charge', 'agenda', 'cours', 'sombre'].includes(scenario.id)).map(scenario => ({ ...scenario, width }))),
  ...[320, 1024].map(width => ({ ...scenarios[2], width })),
];

async function capture(browser, { origin, phase, directory, scenario }) {
  const { width, id, enlarged, forcedColors = 'none', anchor, event, warnings, waitForSource, month = '2027-06' } = scenario;
  const context = await browser.newContext({ viewport: { width, height }, timezoneId: 'Europe/Paris', locale: 'fr-FR', reducedMotion: 'reduce', forcedColors });
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const page = await context.newPage();
  const pending = waitForSource ? Promise.withResolvers() : null;
  try {
    await seedCalendar(page, { ...scenario, delayed: pending?.promise });
    await page.goto(`${origin}/${phase}/calendrier.html?month=${month}${event ? `&event=${event}` : ''}`, { waitUntil: 'domcontentloaded' });
    await page.locator(waitForSource ? '.calendar-notice[role="status"], .calendar-loading' :
      event ? 'dialog[open]' : scenario.unavailable ? '[data-calendar-retry]' : '#calendar-event-count').waitFor();
    if (enlarged) await page.addStyleTag({ content: 'html { font-size: 200%; }' });
    if (warnings) await page.locator('details.calendar-notice').evaluate(element => { element.open = true; });
    if (anchor) await page.locator(anchor).evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: resolve(directory, `${phase}-${id}-${width}.png`), animations: 'disabled' });
  } finally {
    pending?.resolve();
    await context.close();
  }
}

async function measureContrasts(browser, origin) {
  const context = await browser.newContext({ viewport: { width: 1440, height }, timezoneId: 'Europe/Paris', locale: 'fr-FR', reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await seedCalendar(page);
    await page.goto(`${origin}/after/${URL_PATH}`);
    await page.locator(firstItem).first().waitFor();
    return await page.evaluate(() => {
      const luminance = color => {
        const rgb = color.startsWith('#')
          ? color.slice(1).match(/../g).map(channel => Number.parseInt(channel, 16))
          : color.match(/[\d.]+/g).slice(0, 3).map(Number);
        return rgb.map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
          .reduce((sum, component, channel) => sum + component * [.2126, .7152, .0722][channel], 0);
      };
      const ratio = (first, second) => {
        const [low, high] = [luminance(first), luminance(second)].sort((a, b) => a - b);
        return Number(((high + .05) / (low + .05)).toFixed(2));
      };
      const styles = selector => getComputedStyle(document.querySelector(selector));
      const results = [];
      for (const season of ['spring', 'summer', 'autumn', 'winter']) for (const brightness of ['light', 'dark']) {
        window.BpreaAppearance.updatePreferences({ season, brightness });
        const contrasts = { season, brightness };
        for (const type of ['cours', 'stage', 'vacances', 'examen']) {
          const category = styles(`.calendar-legend .calendar-type-${type}`);
          contrasts[type] = ratio(category.color, category.backgroundColor);
          const event = styles(`.calendar-event.calendar-type-${type}`);
          contrasts[`${type}Title`] = ratio(styles(`.calendar-type-${type} .calendar-event-title`).color, event.backgroundColor);
        }
        const today = styles('.calendar-today .calendar-day-number');
        const root = getComputedStyle(document.documentElement);
        contrasts.today = ratio(today.color, today.backgroundColor);
        contrasts.focus = ratio(root.getPropertyValue('--color-focus').trim(), styles('.calendar-board').backgroundColor);
        results.push(contrasts);
      }
      return results;
    });
  } finally {
    await context.close();
  }
}

export async function writeCalendarReview(browser, { origin, baselineRef, directory }) {
  await mkdir(directory, { recursive: true });
  for (const scenario of cases) for (const phase of ['before', 'after']) {
    await capture(browser, { origin, phase, directory, scenario });
  }
  const contrast = await measureContrasts(browser, origin);
  await writeFile(resolve(directory, 'contrastes.json'), JSON.stringify(contrast, null, 2));

  const figures = cases.map(({ id, label, width }) => `<section><h2>${label} · ${width} × ${height}</h2><div class="pair">
    ${[['before', 'Référence'], ['after', 'Refonte']].map(([phase, title]) => `<figure><figcaption>${title}</figcaption>
      <a href="${phase}-${id}-${width}.png"><img loading="lazy" width="${width}" height="${height}"
        src="${phase}-${id}-${width}.png" alt="${title} · ${label}, ${width} pixels de large"></a></figure>`).join('')}
    </div></section>`).join('');
  await writeFile(resolve(directory, 'index.html'), `<!doctype html><html lang="fr"><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Mon BPREA · Comparaison du calendrier</title>
    <style>body{margin:2rem auto;padding:0 1rem;max-width:94rem;background:#faf7f0;color:#342f28;font:1rem/1.5 system-ui}
    code{overflow-wrap:anywhere}h2{margin:1.75rem 0 .5rem;font-size:1.125rem}.pair{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,18rem),1fr));gap:1rem}
    figure{margin:0}figcaption{font-weight:700;margin-bottom:.35rem}img{max-width:100%;height:auto;display:block;border:1px solid #c9c2b5}
    a:focus-visible{outline:3px solid #3158b3;outline-offset:3px}</style>
    <h1>Calendrier de formation · Comparaison avant/après</h1>
    <p>Référence <code>${baselineRef}</code>. Les captures utilisent des données synthétiques. Chaque image ouvre la capture originale.</p>
    <p><a href="contrastes.json">Résultats des mesures de contraste</a></p>
    ${figures}</html>`);
  return contrast;
}
