// Local laboratory comparison only. No field INP, hosted accounts or external traffic.
import { lessons } from '../assets/content.js';
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { resolve, extname, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installDrillObserver, measureDrill, writeDrillReview } from './ui-drill-lab.mjs';
import { installDashboardObserver, measureDashboard, seedDashboard, writeDashboardReview } from './ui-dashboard-lab.mjs';
import { installCalendarObserver, measureCalendar, seedCalendar, writeCalendarReview } from './ui-calendar-lab.mjs';
import { installItkObserver, measureItk, seedItkLab, writeItkReview } from './ui-itk-lab.mjs';
import { installResourceObserver, largeResourceCatalog, measureResources, writeResourcesReview } from './ui-resources-lab.mjs';
import { installBotanicalObserver, measureBotanical, seedBotanicalLab, writeBotanicalParity } from './ui-botanical-lab.mjs';
import { writeBotanicalReview } from './ui-botanical-review.mjs';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const baseline = resolve(option('--baseline', '.tmp/ui-2027-foundations/baseline'));
const output = resolve(option('--output', '.tmp/ui-2027-foundations/performance.json'));
const baselineRef = option('--baseline-ref', 'baseline directory supplied by caller');
const pageFile = option('--page', 'index.html');
const allowedPages = ['index.html', 'mes-cours.html', 's-exercer.html', 'outils.html', 'uc.html?id=uc3', 'uc.html?id=uc1', 'cours.html?id=matiere-organique', 'cours.html?id=rapport-cn', 'exercices.html?id=matiere-organique', 'drill.html?unit=uc3&week=2026-W47', 'tableau-de-bord.html?period=all', 'calendrier.html?month=2027-06', 'itk.html', 'ressources.html', 'reconnaissance-plantes.html'];
if (!allowedPages.includes(pageFile)) throw new Error('Unsupported UI laboratory page.');
const quizPage = pageFile.startsWith('exercices.html');
const drillPage = pageFile.startsWith('drill.html');
const dashboardPage = pageFile.startsWith('tableau-de-bord.html');
const calendarPage = pageFile.startsWith('calendrier.html');
const itkPage = pageFile === 'itk.html';
const resourcesPage = pageFile === 'ressources.html';
const botanicalPage = pageFile === 'reconnaissance-plantes.html';
const largeCatalog = resourcesPage && args.includes('--large-catalog');
const drillReviewDirectory = resolve(dirname(output), 'drill-review');
const reviewDirectory = resolve(dirname(output), 'quiz-review');
async function quizShot(page, phase, state, width) {
  await mkdir(reviewDirectory, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  const name = `${phase}-${state}-${width}.png`;
  await page.screenshot({ path: resolve(reviewDirectory, name), fullPage: true, animations: 'disabled' });
}
const readingPage = pageFile.startsWith('cours.html');
const runs = Number(option('--runs', '5'));
if (!Number.isInteger(runs) || runs < 1 || runs > 10) throw new Error('Runs must be an integer from 1 to 10.');
const roots = { before: baseline, after: repository };
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.pdf': 'application/pdf' };
const server = createServer(async (request, response) => {
  try {
    const parts = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).split('/').filter(Boolean);
    const root = roots[parts.shift()];
    if (!root || parts.some(part => part.startsWith('.') || part.includes('\\')) || !(parts.length === 1 && parts[0].endsWith('.html') || ['assets', 'documents'].includes(parts[0]))) return response.writeHead(404).end();
    const target = resolve(root, ...parts);
    if (!target.startsWith(root + sep)) return response.writeHead(404).end();
    const file = await readFile(target);
    response.writeHead(200, { 'content-type': mime[extname(target)] || 'application/octet-stream', 'content-length': file.length, 'cache-control': 'no-store' }).end(file);
  } catch { response.writeHead(404).end(); }
});
await stat(resolve(baseline, 'index.html'));
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const results = { methodology: { page: pageFile, browser: browser.version(), runs, viewport: '1440x1000', cpuSlowdown: 4, latencyMs: 20, throughputBytesPerSecond: 1250000, cache: 'cold browser context per run; no-store server', appearance: 'autumn/light', settleMs: 1000, useful: 'h1 and primary navigation visible', cards: 'first course, unit or activity card visible', bytes: 'Resource Timing; decoded bodies and transferred bytes, document included in totals; local server without compression', interaction: 'trusted click to second animation frame, laboratory presentation latency; not field INP' }, before: [], after: [] };
try {
  // Alternate the two sources to reduce warm-up and machine-load bias.
  for (let run = 0; run < runs; run++) for (const phase of ['before', 'after']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Europe/Paris', locale: 'fr-FR', reducedMotion: 'reduce' });
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage();
    if (botanicalPage) {
      await seedBotanicalLab(context);
      await page.addInitScript(installBotanicalObserver);
    }
    if (resourcesPage) {
      if (largeCatalog) await page.route('**/assets/resources.json*', route => route.fulfill({ json: largeResourceCatalog() }));
      await page.addInitScript(installResourceObserver);
    }
    if (drillPage) await page.addInitScript(installDrillObserver);
    if (dashboardPage) {
      await seedDashboard(page);
      await page.addInitScript(installDashboardObserver);
    }
    if (calendarPage) {
      await seedCalendar(page);
      await page.addInitScript(installCalendarObserver);
    }
    if (itkPage) {
      await seedItkLab(context, `${origin}/${phase}/`, { personal: true });
      await page.addInitScript(installItkObserver);
    }
    const client = await context.newCDPSession(page);
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await client.send('Network.enable');
    await client.send('Network.emulateNetworkConditions', { offline: false, latency: 20, downloadThroughput: 1250000, uploadThroughput: 1250000 });
    await page.addInitScript(() => {
      localStorage.setItem('bprea-demo-appearance-device-v1', JSON.stringify({ version: 1, season: 'autumn', brightness: 'light' }));
      window.__uiMetrics = { lcp: 0, cls: 0, shifts: [], interactions: [], readingInteractions: [], quizSelections: [], quizCorrections: [], quizHistory: [], allShifts: 0 };
      new PerformanceObserver(list => { for (const entry of list.getEntries()) window.__uiMetrics.allShifts += entry.value; }).observe({ type: 'layout-shift', buffered: true });
      const innerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
      Object.defineProperty(Element.prototype, 'innerHTML', { ...innerHTML, set(value) {
        if (this.id !== 'quiz-history') return innerHTML.set.call(this, value);
        const start = performance.now(); innerHTML.set.call(this, value);
        const domMs = performance.now() - start;
        requestAnimationFrame(() => requestAnimationFrame(() => window.__uiMetrics.quizHistory.push({ domMs, presentationMs: performance.now() - start })));
      } });
      document.addEventListener('change', event => {
        if (!event.target.matches('#quiz-questions input[type=radio]')) return;
        const start = performance.now();
        requestAnimationFrame(() => requestAnimationFrame(() => window.__uiMetrics.quizSelections.push(performance.now() - start)));
      }, true);
      new PerformanceObserver(list => { for (const entry of list.getEntries()) window.__uiMetrics.lcp = entry.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) {
        window.__uiMetrics.cls += entry.value;
        window.__uiMetrics.shifts.push({ time: entry.startTime, value: entry.value, sources: entry.sources.map(source => ({ node: source.node?.id || source.node?.className || source.node?.tagName || 'detached', previous: source.previousRect.toJSON(), current: source.currentRect.toJSON() })) });
      } }).observe({ type: 'layout-shift', buffered: true });
      document.addEventListener('click', event => {
        if (event.target.closest('#check-quiz')) {
          const start = performance.now();
          requestAnimationFrame(() => requestAnimationFrame(() => window.__uiMetrics.quizCorrections.push(performance.now() - start)));
        }
        const reading = event.target.closest('.reading-toc a, #mark-done');
        if (reading) {
          const start = performance.now();
          if (reading.id === 'mark-done') window.__uiMetrics.completionStart = start;
          requestAnimationFrame(() => requestAnimationFrame(() => window.__uiMetrics.readingInteractions.push({ control: reading.id || 'toc', presentationMs: performance.now() - start })));
        }
        if (!event.target.closest('#theme-toggle, [data-navigation-toggle="courses"]')) return;
        const start = performance.now();
        requestAnimationFrame(() => requestAnimationFrame(() => window.__uiMetrics.interactions.push(performance.now() - start)));
      }, true);
    });
    const errors = [], failedResponses = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) failedResponses.push(response.url()); });
    await page.goto(`${origin}/${phase}/${pageFile}`);
    await page.locator('h1').waitFor();
    await page.locator('.primary-nav__top-link').first().waitFor();
    const usefulMs = await page.evaluate(() => performance.now());
    await page.locator('.home-course-card, .unit-card, .hub-unit-card, .hub-link-card, .lesson-row, .unit-empty, .empty-state, .course-article, #quiz-questions, .drill-preview, .dashboard-metrics, .calendar-agenda-list > li, #itk-form, #resource-grid article, #bot-content [data-start]').first().waitFor();
    const cardsReadyMs = await page.evaluate(() => performance.now());
    await page.waitForTimeout(1000);
    const metrics = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource');
      const navigation = performance.getEntriesByType('navigation')[0];
      const bytes = extension => resources.filter(item => new URL(item.name).pathname.endsWith(extension)).reduce((sum, item) => sum + item.decodedBodySize, 0);
      return { ...window.__uiMetrics, tocInitMs: performance.getEntriesByName('course-reading-init')[0]?.duration ?? null, cssBytes: bytes('.css'), jsBytes: bytes('.js'), imageBytes: resources.filter(item => /\.(svg|avif|webp|png|jpe?g)$/.test(new URL(item.name).pathname)).reduce((sum, item) => sum + item.decodedBodySize, 0), decodedBytes: navigation.decodedBodySize + resources.reduce((sum, item) => sum + item.decodedBodySize, 0), transferBytes: navigation.transferSize + resources.reduce((sum, item) => sum + item.transferSize, 0), requests: resources.length + 1, loadMs: navigation.loadEventEnd };
    });
    if (drillPage) Object.assign(metrics, await measureDrill(page, { phase, width: 1440, directory: drillReviewDirectory, screenshots: run === 0 }));
    if (dashboardPage) Object.assign(metrics, await measureDashboard(page));
    if (itkPage) Object.assign(metrics, await measureItk(page));
    if (resourcesPage) Object.assign(metrics, await measureResources(page, largeCatalog));
    if (botanicalPage) metrics.botanical = await measureBotanical(page);
    if (calendarPage) {
      Object.assign(metrics, await measureCalendar(page));
      await page.keyboard.press('Escape');
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    }
    if (quizPage) {
      const initialShifts = await page.evaluate(() => window.__uiMetrics.allShifts);
      if (run === 0) await quizShot(page, phase, 'blank', 1440);
      for (const [i, question] of lessons[0].quiz.entries()) {
        await page.locator(`input[name="q${i}"][value="${i < 2 ? question.answer : (question.answer + 1) % question.options.length}"]`).check();
        if (run === 0 && i === 0) await quizShot(page, phase, 'selected', 1440);
      }
      await page.waitForFunction(() => window.__uiMetrics.quizSelections.length === 3);
      if (run === 0) await quizShot(page, phase, 'ready', 1440);
      await page.locator('#check-quiz').click();
      await page.waitForFunction(() => document.querySelector('#quiz-result').textContent.includes('Progression enregistrée sur cet appareil.'));
      await page.waitForFunction(() => window.__uiMetrics.quizCorrections.length === 1 && window.__uiMetrics.quizHistory.length >= 2);
      metrics.quizSelections = await page.evaluate(() => window.__uiMetrics.quizSelections);
      metrics.quizCorrections = await page.evaluate(() => window.__uiMetrics.quizCorrections);
      metrics.quizHistory = await page.evaluate(() => window.__uiMetrics.quizHistory);
      metrics.correctionLayoutShift = await page.evaluate(before => window.__uiMetrics.allShifts - before, initialShifts);
      if (run === 0) await quizShot(page, phase, 'corrected', 1440);
    }
    await page.locator('#theme-toggle').click();
    await page.locator('[data-navigation-toggle="courses"]').click();
    await page.waitForFunction(() => window.__uiMetrics.interactions.length === 2);
    metrics.interactions = await page.evaluate(() => window.__uiMetrics.interactions);
    await page.keyboard.press('Escape');
    if (readingPage) {
      if (await page.locator('.reading-toc a').count()) {
        await page.locator('.reading-toc a').first().click();
        await page.waitForFunction(() => window.__uiMetrics.readingInteractions.some(row => row.control === 'toc'));
      }
      await page.locator('#mark-done').click();
      await page.waitForFunction(() => document.querySelector('#done-state').textContent === 'Terminé ✓');
      metrics.completionSavedMs = await page.evaluate(() => performance.now() - window.__uiMetrics.completionStart);
      await page.waitForFunction(() => window.__uiMetrics.readingInteractions.some(row => row.control === 'mark-done'));
      metrics.readingInteractions = await page.evaluate(() => window.__uiMetrics.readingInteractions);
    }
    results[phase].push({ run: run + 1, ...metrics, usefulMs, cardsReadyMs, errors, failedResponses });
    await context.close();
  }
  const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  results.medians = Object.fromEntries(['before', 'after'].map(phase => [phase, Object.fromEntries(['cssBytes', 'jsBytes', 'imageBytes', 'decodedBytes', 'transferBytes', 'requests', 'lcp', 'cls', 'loadMs', 'usefulMs', 'cardsReadyMs', 'tocInitMs', 'completionSavedMs', 'correctionLayoutShift'].map(key => [key, median(results[phase].map(run => run[key] ?? null))]).concat([['interactionMs', median(results[phase].flatMap(run => run.interactions))]]))]));
  if (quizPage) {
    for (const phase of ['before', 'after']) {
      results.medians[phase].quizSelectionMs = median(results[phase].flatMap(r => r.quizSelections));
      results.medians[phase].quizCorrectionMs = median(results[phase].flatMap(r => r.quizCorrections));
      results.medians[phase].quizHistoryDOMMs = median(results[phase].flatMap(r => r.quizHistory.slice(1).map(h => h.domMs)));
      results.medians[phase].quizHistoryPresentationMs = median(results[phase].flatMap(r => r.quizHistory.slice(1).map(h => h.presentationMs)));
      const context = await browser.newContext({ viewport: { width: 390, height: 1000 }, timezoneId: 'Europe/Paris', locale: 'fr-FR', reducedMotion: 'reduce' });
      await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      const page = await context.newPage();
      await page.clock.install({ time: new Date('2026-11-16T15:00:00Z') });
      await page.addInitScript(() => localStorage.setItem('bprea-demo-appearance-device-v1', JSON.stringify({ version: 1, season: 'autumn', brightness: 'light' })));
      await page.goto(`${origin}/${phase}/${pageFile}`); await page.locator('#quiz-questions').waitFor(); await page.evaluate(() => document.fonts.ready);
      await quizShot(page, phase, 'blank', 390);
      for (const [i, question] of lessons[0].quiz.entries()) {
        await page.locator(`input[name="q${i}"][value="${i < 2 ? question.answer : (question.answer + 1) % question.options.length}"]`).check();
        if (i === 0) await quizShot(page, phase, 'selected', 390);
      }
      await quizShot(page, phase, 'ready', 390); await page.locator('#check-quiz').click();
      await page.waitForFunction(() => document.querySelector('#quiz-result').textContent.includes('Progression enregistrée sur cet appareil.'));
      await quizShot(page, phase, 'corrected', 390); await context.close();
    }
    const pairs = [1440,390].flatMap(width => ['blank','selected','ready','corrected'].map(state => `<h2>${state} · ${width} px</h2><div class="pair">${['before','after'].map(phase => { const name = `${phase}-${state}-${width}.png`; return `<figure><figcaption>${phase}</figcaption><a href="${name}"><img src="${name}" alt="${phase} ${state} ${width}" loading="lazy"></a></figure>`; }).join('')}</div>`)).join('');
    await writeFile(resolve(reviewDirectory, 'comparaison-qcm.html'), `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QCM · avant/après</title><style>body{font:16px/1.6 system-ui;margin:24px;background:#faf7f0;color:#342f28}.pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}figure{margin:0}img{width:100%;height:auto}@media(max-width:700px){.pair{grid-template-columns:1fr}}</style><h1>QCM classiques · main → PR3 lot 2</h1><p>Gauche : main intégrant #64 (base locale 456e844 ; en CI base effective de la PR). Droite : branche QCM. Viewports et données identiques ; automne clair, visiteur isolé, polices chargées, mouvement réduit. Pièces de revue humaine, aucune référence approuvée automatiquement.</p>${pairs}</html>`);
    results.methodology.baselineRef = baselineRef;
    results.methodology.quiz = 'selection/correction: event to second animation frame; history: innerHTML setter duration and second-frame presentation, excluding initial empty history; correction shifts include recent-input shifts during selection and expansion of corrections, diagnostic only';
  }
  const before = results.medians.before, after = results.medians.after;
  if (itkPage) {
    const keys = ['parameterMs', 'generationMs', 'timelineMs', 'dialogMs', 'interactionShift'];
    for (const phase of ['before', 'after']) for (const key of keys) {
      results.medians[phase][key] = median(results[phase].map(run => run[key]));
    }
    results.methodology.baselineRef = baselineRef;
    results.methodology.itk = 'Same synthetic personal account and HTTP fixtures. Form first displayed, crop change to second frame, submit to timeline DOM and second frame, import click to second frame after dialog opens. Interaction shifts include recent input.';
    await writeItkReview(browser, { origin, baselineRef, directory: resolve(dirname(output), 'itk-review') });
  }
  if (resourcesPage) {
    const keys = ['firstCardMs', 'pdfMs', 'filterMs', 'sortMs', 'resetMs', 'actionShift', 'scrollDelta'];
    for (const phase of ['before', 'after']) for (const key of keys) {
      results.medians[phase][key] = median(results[phase].map(run => run[key]));
    }
    results.methodology.baselineRef = baselineRef;
    results.methodology.resources = `${largeCatalog ? 600 : 'Versioned'} records. First card DOM and first PDF action paint from navigation. Filter, sort and reset from browser event to second frame. Action shifts include recent input.`;
    if (!largeCatalog) await writeResourcesReview(browser, { origin, baselineRef, directory: resolve(dirname(output), 'review') });
  }
  if (botanicalPage) {
    const keys = ['startMs', 'imageMs', 'choiceMs', 'correctionMs', 'nextMs', 'nextImageMs', 'resultsMs', 'photoRequests', 'photoBytes'];
    for (const phase of ['before', 'after']) for (const key of keys) {
      results.medians[phase][key] = median(results[phase].map(run => run.botanical[key]));
    }
    results.methodology.baselineRef = baselineRef;
    results.methodology.botanical = 'Same catalogue, deterministic question order. Trusted actions to second frame after expected DOM state, including image load where indicated. Clock read on first image; fixed-time replay verifies actual elapsed time separately.';
    await writeBotanicalParity(browser, { origin, baselineRef, directory: dirname(output) });
    await writeBotanicalReview(browser, { origin, baselineRef, directory: resolve(dirname(output), 'botanical-review') });
  }
  if (drillPage) {
    for (const phase of ['before','after']) for (const [key, source] of Object.entries({ drillSelectionMs: 'selection', drillValidationMs: 'validation', drillStatsMs: 'stats', drillHistoryMs: 'history', drillStartMs: 'start' }))
      results.medians[phase][key] = median(results[phase].flatMap(run => run.drillLab[source]));
    results.methodology.baselineRef = baselineRef;
    results.methodology.drill = 'Fixed Date only; real performance clock. Trusted events to second frame after DOM updates. Per-action scroll delta, focused element and layout shifts including recent input are separate diagnostics, not load CLS or field INP. Stats/history latency is measured when their text changes.';
    await writeDrillReview(browser, { origin, pageFile, baselineRef, directory: drillReviewDirectory });
  }
  if (dashboardPage) {
    for (const phase of ['before', 'after']) {
      results.medians[phase].dashboardReadyMs = median(results[phase].map(run => run.dashboardReadyMs));
      results.medians[phase].dashboardActions = Object.fromEntries(['filter', 'page', 'week', 'refresh'].map(name =>
        [name, Object.fromEntries(['durationMs', 'scrollDelta', 'layoutShift'].map(key =>
          [key, median(results[phase].map(run => run.dashboardActions[name][key]))]))]));
    }
    results.methodology.baselineRef = baselineRef;
    results.methodology.dashboard = 'Fixed civil date and local synthetic data, real performance clock. First metric DOM; actions measured from change, click or focus to the second animation frame. Post-interaction layout shifts include recent input. Refresh reads a newly updated visitor history.';
    results.dashboardParity = await writeDashboardReview(browser, {
      origin, baselineRef, directory: resolve(dirname(output), 'dashboard-review'),
    });
  }
  if (calendarPage) {
    const keys = ['monthReadyMs', 'monthChangeMs', 'monthChangeShift', 'monthChangeScroll', 'detailOpenMs', 'interactionShift', 'calendarRequests'];
    for (const phase of ['before', 'after']) for (const key of keys) {
      results.medians[phase][key] = median(results[phase].map(run => run[key]));
    }
    results.methodology.baselineRef = baselineRef;
    results.methodology.calendar = 'Fixed civil date and identical synthetic source. Month ready after first agenda row; interactions from trusted click to second frame. Shifts include recent input and are separate from load CLS.';
    results.calendarContrast = await writeCalendarReview(browser, {
      origin, baselineRef, directory: resolve(dirname(output), 'calendar-review'),
    });
  }
  // Broad diagnostic budgets account for ordinary local-laboratory variability.
  // They flag a targeted investigation, without grading the site with a global score.
  results.budgets = { cssAdditionalBytes: 16384, jsAdditionalBytes: 16384, additionalRequests: 2, lcpAdditionalMs: Math.max(500, before.lcp * .5), clsMaximum: .1, interactionMaximumMs: 200 };
  results.flags = [
    after.cssBytes > before.cssBytes + results.budgets.cssAdditionalBytes && 'CSS budget',
    after.jsBytes > before.jsBytes + results.budgets.jsAdditionalBytes && 'JavaScript budget',
    after.requests > before.requests + results.budgets.additionalRequests && 'request budget',
    after.lcp > before.lcp + results.budgets.lcpAdditionalMs && 'LCP regression',
    after.cls > .1 && 'CLS budget', after.interactionMs > 200 && 'laboratory interaction budget',
    quizPage && (after.quizSelectionMs > 200 || after.quizCorrectionMs > 200 || after.quizHistoryPresentationMs > 200) && 'quiz laboratory interaction budget',
    drillPage && (after.drillSelectionMs > 200 || after.drillValidationMs > 200 || after.drillHistoryMs > 200) && 'drill laboratory interaction budget',
    dashboardPage && Object.values(after.dashboardActions).some(action => action.durationMs > 200) && 'dashboard laboratory interaction budget',
    calendarPage && (after.monthChangeMs > 200 || after.detailOpenMs > 200 || after.calendarRequests !== 1) && 'calendar laboratory interaction budget',
    itkPage && Math.max(after.parameterMs, after.timelineMs, after.dialogMs) > 200 && 'ITK laboratory interaction budget',
    botanicalPage && Math.max(after.choiceMs, after.correctionMs, after.nextMs, after.resultsMs) > 200 && 'botanical laboratory interaction budget',
    calendarPage && results.calendarContrast.some(({ season, brightness, focus, ...text }) =>
      focus < 3 || Object.values(text).some(ratio => ratio < 4.5)) && 'calendar contrast budget',
    results.after.some(run => run.errors.length || run.failedResponses.length) && 'runtime/network errors',
  ].filter(Boolean);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify({ output, medians: results.medians, flags: results.flags }, null, 2));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
