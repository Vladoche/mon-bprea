// Drill extension of the existing cold-load laboratory; never accesses hosted data.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const bank = JSON.parse(await readFile(new URL('../assets/drill-bank.json', import.meta.url), 'utf8')).questions;

export function installDrillObserver() {
  // Freeze calendar Date only: Playwright's Clock also replaces Performance APIs.
  const NativeDate = Date, stamp = NativeDate.parse('2026-11-16T15:00:00Z');
  window.Date = new Proxy(NativeDate, {
    construct(target, args) { return Reflect.construct(target, args.length ? args : [stamp]); },
    apply() { return new NativeDate(stamp).toString(); },
    get(target, property) { return property === 'now' ? () => stamp : Reflect.get(target, property); },
  });
  window.__uiMetrics ||= { allShifts: 0 };
  const lab = window.__drillLab = { selection: [], validation: [], stats: [], history: [], start: [], action: null };
  const frames = callback => requestAnimationFrame(() => requestAnimationFrame(callback));
  const signature = selector => document.querySelector(selector)?.textContent || '';
  document.addEventListener('change', event => {
    if (!event.target.matches('.drill-answer-form input[type=radio]')) return;
    const began = performance.now(); frames(() => lab.selection.push(performance.now() - began));
  }, true);
  const begin = type => { lab.action = { type, began: performance.now(), correction: signature('.drill-question-list'), stats: signature('.drill-stats'), history: signature('.drill-history-list') }; };
  document.addEventListener('click', event => { if (event.target.closest('[data-drill-start]')) begin('start'); }, true);
  document.addEventListener('submit', event => { if (event.target.matches('.drill-answer-form')) begin('validation'); }, true);
  new MutationObserver(() => {
    const action = lab.action; if (!action) return;
    const elapsed = target => frames(() => lab[target].push(performance.now() - action.began));
    if (!action.statsDone && signature('.drill-stats') !== action.stats) { action.statsDone = true; elapsed('stats'); }
    if (!action.historyDone && signature('.drill-history-list') !== action.history) { action.historyDone = true; elapsed('history'); }
    if (action.type === 'start' && document.querySelectorAll('.drill-question').length === 10) { lab.action = null; elapsed('start'); }
    if (action.type === 'validation' && signature('.drill-question-list') !== action.correction && document.querySelector('.drill-correction') && /enregistr[éée]/i.test(signature('#drill-save-status'))) {
      const formBusy = document.querySelector('form[aria-busy="true"]');
      if (!formBusy) { lab.action = null; elapsed('validation'); }
    }
  }).observe(document, { childList: true, subtree: true, characterData: true });
}

export async function measureDrill(page, { phase, width, directory, screenshots = false }) {
  await mkdir(directory, { recursive: true });
  const drillInitialScrollY = await page.evaluate(() => scrollY);
  const shot = async (state, target = page) => {
    if (!screenshots) return;
    await page.evaluate(() => document.fonts.ready);
    // Comparison images always use the SAME viewport dimensions, including card states.
    if (target === page) await page.evaluate(() => scrollTo(0, 0));
    else await target.evaluate(node => scrollTo(0, Math.max(0, scrollY + node.getBoundingClientRect().top - 20)));
    await page.screenshot({ path: resolve(directory, `${phase}-${state}-${width}.png`), animations: 'disabled', fullPage: false });
  };
  const shifts = () => page.evaluate(() => window.__uiMetrics.allShifts);
  const actions = [];
  const action = async (name, control, run, ready) => {
    await control.scrollIntoViewIfNeeded(); const beforeY = await page.evaluate(() => scrollY), beforeShift = await shifts();
    const questionId = await control.evaluate(node => node.closest('.drill-question')?.id || null);
    const questionTop = () => page.evaluate(id => document.getElementById(id)?.getBoundingClientRect().top ?? null, questionId);
    const beforeTop = await questionTop();
    await run(); await ready(); await page.waitForTimeout(75);
    actions.push({ name, scrollDelta: await page.evaluate(() => scrollY) - beforeY, questionTopDelta: beforeTop === null ? null : await questionTop() - beforeTop, layoutShiftIncludingInput: await shifts() - beforeShift, focused: await page.evaluate(() => document.activeElement?.className || document.activeElement?.tagName) });
  };
  await shot('blank'); await shot('preparation', page.locator('.drill-preview'));
  await page.locator('.drill-unit-picker>summary').click(); await shot('units', page.locator('.drill-overview')); await page.locator('.drill-unit-picker>summary').click();
  await shot('week', page.locator('.drill-session-top'));
  await page.locator('[data-drill-start]').click(); await page.locator('.drill-question').first().waitFor();
  await shot('started'); await shot('question', page.locator('.drill-question').first());
  for (const [index, correct] of [true, false].entries()) {
    const article = page.locator('.drill-question').nth(index), form = article.locator('form');
    const id = await form.getAttribute('data-question'), question = bank.find(q => q.id === id);
    const value = correct ? question.answer : question.options.find(option => option.id !== question.answer).id;
    const radio = form.locator(`input[value="${value}"]`);
    await action(`selection-${index}`, radio, () => radio.check(), () => page.waitForFunction(() => document.querySelector('#drill-save-status').textContent.includes('Choix enregistré')));
    if (!index) await shot('selected', article);
    const button = form.locator('button[type=submit]');
    await action(`validation-${index}`, button, () => button.click(), () => article.locator('.drill-correction').waitFor());
    await shot(correct ? 'correct' : 'incorrect', article);
  }
  const first = page.locator('.drill-question').first(), train = first.locator('[data-drill-train]');
  await action('training-open', train, () => train.click(), () => first.locator('form[data-training="true"]').waitFor());
  await shot('training', first);
  const training = first.locator('form[data-training="true"]');
  const trainingId = await training.getAttribute('data-question');
  await training.locator('input').first().check();
  await page.waitForFunction(id => Object.values(JSON.parse(localStorage.getItem('bprea-demo-drill-v1')).series).some(series => series.trainingDrafts?.[id]), trainingId);
  const trainButton = training.locator('button');
  await action('training-validation', trainButton, () => trainButton.click(), () => first.locator('.drill-training-last').waitFor());
  await shot('history', page.locator('.drill-history'));
  await page.evaluate(() => document.documentElement.dataset.theme = 'dark'); await shot('dark', first);
  await page.evaluate(() => document.documentElement.dataset.season = 'winter'); await shot('winter', first);
  await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; document.documentElement.dataset.season = 'autumn'; });
  const lab = await page.evaluate(() => window.__drillLab);
  if (screenshots) {
    const target = new URL(page.url()); target.searchParams.set('unit', 'uc1');
    await page.goto(target.href); await page.locator('.drill-incomplete').waitFor(); await shot('unavailable', page.locator('.drill-workspace'));
  }
  return { drillLab: lab, drillActions: actions, drillInitialScrollY };
}

export async function writeDrillReview(browser, { origin, pageFile, baselineRef, directory }) {
  for (const phase of ['before', 'after']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 1000 }, timezoneId: 'Europe/Paris', locale: 'fr-FR', reducedMotion: 'reduce' });
    try {
      await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      const page = await context.newPage();
      await page.addInitScript(installDrillObserver);
      await page.addInitScript(() => localStorage.setItem('bprea-demo-appearance-device-v1', JSON.stringify({ version: 1, season: 'autumn', brightness: 'light' })));
      await page.goto(`${origin}/${phase}/${pageFile}`); await page.locator('[data-drill-start]').waitFor();
      await measureDrill(page, { phase, width: 390, directory, screenshots: true });
    } finally { await context.close(); }
  }
  const pairs = [1440,390].flatMap(width => ['blank','units','week','preparation','started','question','selected','correct','incorrect','training','history','unavailable','dark','winter'].map(state => `<h2>${state} · ${width} px</h2><div class="pair">${['before','after'].map(phase => `<figure><figcaption>${phase}</figcaption><a href="${phase}-${state}-${width}.png"><img loading="lazy" src="${phase}-${state}-${width}.png" alt="${phase} ${state} ${width}"></a></figure>`).join('')}</div>`)).join('');
  await writeFile(resolve(directory, 'comparaison-drill.html'), `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Drill · avant/après</title><style>body{font:16px/1.7 system-ui;margin:24px;background:#faf7f0;color:#342f28}.pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}figure{margin:0}img{width:100%;height:auto}@media(max-width:700px){.pair{grid-template-columns:1fr}}</style><h1>Drill hebdomadaire · main → PR3 lot 3</h1><p>Base effective : ${baselineRef}. Même semaine 2026-W47, mêmes questions, viewports 1440×1000 et 390×1000, visiteur isolé, automne clair, polices chargées, mouvement réduit. Les captures sombre et hiver utilisent les mêmes préférences des deux côtés. Revue humaine requise ; aucune référence approuvée automatiquement.</p>${pairs}</html>`);
}
