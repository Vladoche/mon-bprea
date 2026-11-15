// Local laboratory comparison only. No field INP, hosted accounts or external traffic.
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { resolve, extname, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const baseline = resolve(option('--baseline', '.tmp/ui-2027-foundations/baseline'));
const output = resolve(option('--output', '.tmp/ui-2027-foundations/performance.json'));
const runs = Number(option('--runs', '5'));
if (!Number.isInteger(runs) || runs < 1 || runs > 10) throw new Error('Runs must be an integer from 1 to 10.');
const roots = { before: baseline, after: repository };
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = createServer(async (request, response) => {
  try {
    const parts = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).split('/').filter(Boolean);
    const root = roots[parts.shift()];
    if (!root || parts.some(part => part.startsWith('.') || part.includes('\\')) || !(parts.length === 1 && parts[0].endsWith('.html') || parts[0] === 'assets')) return response.writeHead(404).end();
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
const results = { methodology: { browser: browser.version(), runs, viewport: '1440x1000', cpuSlowdown: 4, latencyMs: 20, throughputBytesPerSecond: 1250000, cache: 'cold browser context per run; no-store server', appearance: 'autumn/light', settleMs: 1000, useful: 'h1 and primary navigation visible', interaction: 'trusted click to second animation frame, laboratory presentation latency; not field INP' }, before: [], after: [] };
try {
  // Alternate the two sources to reduce warm-up and machine-load bias.
  for (let run = 0; run < runs; run++) for (const phase of ['before', 'after']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Europe/Paris', locale: 'fr-FR', reducedMotion: 'reduce' });
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage();
    const client = await context.newCDPSession(page);
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await client.send('Network.enable');
    await client.send('Network.emulateNetworkConditions', { offline: false, latency: 20, downloadThroughput: 1250000, uploadThroughput: 1250000 });
    await page.addInitScript(() => {
      localStorage.setItem('bprea-demo-appearance-device-v1', JSON.stringify({ version: 1, season: 'autumn', brightness: 'light' }));
      window.__uiMetrics = { lcp: 0, cls: 0, shifts: [], interactions: [] };
      new PerformanceObserver(list => { for (const entry of list.getEntries()) window.__uiMetrics.lcp = entry.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) {
        window.__uiMetrics.cls += entry.value;
        window.__uiMetrics.shifts.push({ time: entry.startTime, value: entry.value, sources: entry.sources.map(source => ({ node: source.node?.id || source.node?.className || source.node?.tagName || 'detached', previous: source.previousRect.toJSON(), current: source.currentRect.toJSON() })) });
      } }).observe({ type: 'layout-shift', buffered: true });
      document.addEventListener('click', event => {
        if (!event.target.closest('#theme-toggle, [data-navigation-toggle="courses"]')) return;
        const start = performance.now();
        requestAnimationFrame(() => requestAnimationFrame(() => window.__uiMetrics.interactions.push(performance.now() - start)));
      }, true);
    });
    const errors = [], failedResponses = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) failedResponses.push(response.url()); });
    await page.goto(`${origin}/${phase}/index.html`);
    await page.locator('h1').waitFor();
    await page.locator('.primary-nav__top-link').first().waitFor();
    const usefulMs = await page.evaluate(() => performance.now());
    await page.waitForTimeout(1000);
    const metrics = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource');
      const bytes = extension => resources.filter(item => new URL(item.name).pathname.endsWith(extension)).reduce((sum, item) => sum + item.decodedBodySize, 0);
      return { ...window.__uiMetrics, cssBytes: bytes('.css'), jsBytes: bytes('.js'), requests: resources.length + 1, loadMs: performance.getEntriesByType('navigation')[0].loadEventEnd };
    });
    await page.locator('#theme-toggle').click();
    await page.locator('[data-navigation-toggle="courses"]').click();
    await page.waitForFunction(() => window.__uiMetrics.interactions.length === 2);
    metrics.interactions = await page.evaluate(() => window.__uiMetrics.interactions);
    results[phase].push({ run: run + 1, ...metrics, usefulMs, errors, failedResponses });
    await context.close();
  }
  const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  results.medians = Object.fromEntries(['before', 'after'].map(phase => [phase, Object.fromEntries(['cssBytes', 'jsBytes', 'requests', 'lcp', 'cls', 'loadMs', 'usefulMs'].map(key => [key, median(results[phase].map(run => run[key]))]).concat([['interactionMs', median(results[phase].flatMap(run => run.interactions))]]))]));
  const before = results.medians.before, after = results.medians.after;
  // Broad diagnostic budgets account for ordinary local-laboratory variability.
  // They flag a targeted investigation, without grading the site with a global score.
  results.budgets = { cssAdditionalBytes: 16384, jsAdditionalBytes: 16384, additionalRequests: 2, lcpAdditionalMs: Math.max(500, before.lcp * .5), clsMaximum: .1, interactionMaximumMs: 200 };
  results.flags = [
    after.cssBytes > before.cssBytes + results.budgets.cssAdditionalBytes && 'CSS budget',
    after.jsBytes > before.jsBytes + results.budgets.jsAdditionalBytes && 'JavaScript budget',
    after.requests > before.requests + results.budgets.additionalRequests && 'request budget',
    after.lcp > before.lcp + results.budgets.lcpAdditionalMs && 'LCP regression',
    after.cls > .1 && 'CLS budget', after.interactionMs > 200 && 'laboratory interaction budget',
    results.after.some(run => run.errors.length || run.failedResponses.length) && 'runtime/network errors',
  ].filter(Boolean);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify({ output, medians: results.medians, flags: results.flags }, null, 2));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
