import { test, expect } from '@playwright/test';
import { readdir, mkdir, writeFile } from 'node:fs/promises';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });
const base = 'http://127.0.0.1:4173/mon-bprea/';
const instant = new Date('2026-10-28T12:00:00Z');
async function terminalInventory(page) {
  return page.evaluate(async () => ({
    localStorage: Object.keys(localStorage).sort(),
    sessionStorage: Object.keys(sessionStorage).sort(),
    indexedDB: (await indexedDB.databases()).map(({ name, version }) => ({ name, version })),
    cacheAPI: await caches.keys(),
    serviceWorkers: (await navigator.serviceWorker.getRegistrations()).map(worker => worker.scope),
    externalLinks: [...new Set([...document.querySelectorAll('a[href]')].map(link => new URL(link.href))
      .filter(url => /^https?:$/.test(url.protocol) && url.origin !== location.origin)
      .map(url => url.origin + url.pathname))].sort(),
  }));
}

test('Artefact Pages : 17 documents en contextes vierges, réseau et stockages terminaux inventoriés', async ({ browser }) => {
  test.setTimeout(90000);
  const files = (await readdir(new URL('../../', import.meta.url))).filter(file => file.endsWith('.html')).sort();
  expect(files).toContain('index.html');
  expect(files).not.toContain('confidentialite.html');
  const queries = { 'uc.html': '?id=uc3', 'cours.html': '?id=matiere-organique', 'exercices.html': '?id=matiere-organique', 'drill.html': '?unit=uc3&week=2026-W43' };
  const results = [];
  for (const file of files) {
    const context = await browser.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris' });
    try {
      const page = await context.newPage(); await page.clock.install({ time: instant });
      const external = [], errors = [], cookiesFromResponses = [];
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin !== new URL(base).origin) { external.push(url.origin + url.pathname); return route.abort(); }
        return route.continue();
      });
      page.on('pageerror', () => errors.push('pageerror'));
      page.on('response', response => { if (response.headers()['set-cookie']) cookiesFromResponses.push(new URL(response.url()).pathname); });
      const response = await page.goto(base + file + (queries[file] || ''));
      expect(response.status(), file).toBe(200);
      await expect(page.locator('header').getByRole('link', { name: 'Connexion', exact: true })).toBeVisible();
      await page.waitForLoadState('networkidle');
      const inventory = await terminalInventory(page), cookies = (await context.cookies()).map(cookie => cookie.name);
      expect(external, file).toEqual([]); expect(errors, file).toEqual([]);
      expect(cookies, file).toEqual([]); expect(cookiesFromResponses, file).toEqual([]);
      expect(inventory.indexedDB, file).toEqual([]); expect(inventory.cacheAPI, file).toEqual([]); expect(inventory.serviceWorkers, file).toEqual([]);
      expect(inventory.localStorage.some(key => key.startsWith('bprea-auth')), file).toBe(false);
      results.push({ file, external, cookies, cookiesFromResponses, ...inventory });
    } finally { await context.close(); }
  }
  await mkdir('.tmp/privacy-recipe', { recursive: true });
  // Names/categories only: no storage values, query tokens, or personal export.
  await writeFile('.tmp/privacy-recipe/artifact-network.json', JSON.stringify({ scope: 'local Pages artifact, Auth disabled', instant, results }, null, 2));
});

test('URLs synthétiques : query sensible reçue initialement puis retirée avant sous-requêtes, recherche distincte', async ({ browser }) => {
  for (const type of ['invite', 'recovery']) {
    const context = await browser.newContext();
    try {
      const page = await context.newPage(); await page.clock.install({ time: instant });
      const secret = 'synthetic-privacy-link-never-a-real-token', requests = [], referrers = [];
      page.on('request', request => { requests.push(request.url()); referrers.push(request.headers().referer || ''); });
      await page.goto(`${base}authentification.html?token_hash=${secret}&type=${type}`);
      await expect(page).toHaveURL(base + 'authentification.html'); await page.waitForLoadState('networkidle');
      expect(requests[0]).toContain(`token_hash=${secret}`);
      expect(requests.slice(1).some(url => url.includes(secret))).toBe(false);
      expect(referrers.some(url => url.includes(secret))).toBe(false);
      await expect(page.locator('body')).not.toContainText(secret);
      expect((await terminalInventory(page)).localStorage).toEqual([]);
    } finally { await context.close(); }
  }
  const context = await browser.newContext();
  try {
    const page = await context.newPage(); await page.clock.install({ time: instant });
    await page.goto(base + 'index.html?q=recherche-fictive');
    expect(new URL(page.url()).searchParams.get('q')).toBe('recherche-fictive');
    // The application does not claim to erase ordinary URL/history/host logs.
    expect((await terminalInventory(page)).externalLinks.every(url => !url.includes('recherche-fictive'))).toBe(true);
  } finally { await context.close(); }
});
