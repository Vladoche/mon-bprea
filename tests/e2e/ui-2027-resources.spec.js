import { test, expect } from '@playwright/test';
import { libraryCatalog, libraryPdf, librarySheet } from '../fixtures/resource-library.js';
import { textContrasts } from '../helpers/ui-review.js';

const site = '/mon-bprea/';
const path = `${site}ressources.html`;
const pdfName = 'fiche-demo-matiere-organique.pdf';
const pdfPattern = `**/documents/${pdfName}`;
const catalogPattern = '**/assets/resources.json*';
const search = page => page.locator('#resource-search');
const filter = (page, key) => page.locator(`#resource-${key}`);
const card = (page, id = libraryPdf.id) => page.locator(`#library-resource-${id}`);
const count = page => page.locator('#resource-count');
const retryPdf = page => card(page).getByRole('button', { name: /Réessayer la vérification/ });
const setCatalog = (page, resources) => page.route(catalogPattern, route => route.fulfill({ json: libraryCatalog(resources) }));

test('de l’accueil à une ressource filtrée, puis consultation, téléchargement et retour au cours', async ({ page, baseURL }) => {
  const external = [];
  const mutations = [];
  const origin = new URL(baseURL).origin;
  page.context().on('request', request => {
    if (new URL(request.url()).origin !== origin) external.push(request.url());
    if (!['GET', 'HEAD'].includes(request.method())) mutations.push(request.method());
  });
  await page.addInitScript(() => {
    window.writes = [];
    for (const [prototype, methods] of [
      [Storage.prototype, ['setItem', 'removeItem', 'clear']],
      [IDBObjectStore.prototype, ['put', 'add', 'delete', 'clear']],
    ]) {
      for (const method of methods) {
        const original = prototype[method];
        prototype[method] = function (...args) {
          window.writes.push(String(args[0] ?? method));
          return original.apply(this, args);
        };
      }
    }
  });
  await setCatalog(page, [libraryPdf, librarySheet]);
  await page.goto(site);
  await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Outils', exact: true }).click();
  await page.getByRole('main').getByRole('link', { name: /Explorer la bibliothèque/ }).click();
  await expect(page).toHaveURL(/\/mon-bprea\/ressources\.html$/);
  await expect(page.getByRole('heading', { name: 'Ressources documentaires', exact: true })).toBeVisible();
  await expect(count(page)).toHaveText('2 ressources sur 2');

  await search(page).fill('pedofaune');
  await expect(count(page)).toHaveText('1 ressource sur 2');
  await expect(search(page)).toBeFocused();
  await filter(page, 'unit').selectOption('uc3');
  await filter(page, 'theme').selectOption('Sol et fertilité');
  await filter(page, 'type').selectOption('pdf');
  const summary = page.locator('.library-more-filters summary');
  await summary.focus();
  await page.keyboard.press('Space');
  await filter(page, 'lesson').selectOption('matiere-organique');
  await filter(page, 'chapter').selectOption('uc3-sol-vivant');
  await filter(page, 'organization').selectOption('Atelier fictif');
  await filter(page, 'sort').selectOption('added-desc');
  await expect(count(page)).toHaveText('1 ressource sur 2');
  await expect(page.locator('#resource-context a')).toHaveAttribute('href', 'cours.html?id=matiere-organique');
  await summary.press('Enter');
  await expect(summary).toContainText('3 filtres actifs');
  await expect(filter(page, 'organization')).toBeHidden();

  await page.locator('.library-reset').click();
  await expect(search(page)).toBeFocused();
  await expect(search(page)).toHaveValue('');
  await expect(count(page)).toHaveText('2 ressources sur 2');
  await expect(filter(page, 'sort')).toHaveValue('title-asc');
  await expect(page).toHaveURL(/ressources\.html$/);
  await page.goBack();
  await expect(filter(page, 'lesson')).toHaveValue('matiere-organique');
  await expect(filter(page, 'organization')).toBeVisible();
  await expect(filter(page, 'sort')).toHaveValue('added-desc');
  await page.goForward();
  await expect(count(page)).toHaveText('2 ressources sur 2');

  await card(page).locator('summary').press('Enter');
  await expect(card(page).getByText('Donnée synthétique de recette.')).toBeVisible();
  await expect(card(page).locator('time')).toHaveCount(2);
  await expect(card(page).getByRole('link', { name: /Atelier fictif.*nouvel onglet/ })).toHaveAttribute('rel', 'noopener noreferrer');
  const open = card(page).getByRole('link', { name: 'Consulter le PDF (nouvel onglet)' });
  await expect(open).toHaveAttribute('target', '_blank');
  const [popup, document] = await Promise.all([
    page.waitForEvent('popup'),
    page.context().waitForEvent('response', response => response.request().method() === 'GET' && new URL(response.url()).pathname === site + libraryPdf.file),
    open.click(),
  ]);
  expect(document.ok()).toBe(true);
  expect(document.headers()['content-type']).toBe('application/pdf');
  await popup.close();
  const [download] = await Promise.all([page.waitForEvent('download'), card(page).getByRole('link', { name: /^Télécharger/ }).click()]);
  expect(download.suggestedFilename()).toBe(pdfName);
  expect(await download.failure()).toBeNull();
  expect(await page.evaluate(() => window.writes)).toEqual([]);
  expect(external).toEqual([]);
  expect(mutations).toEqual([]);

  await card(page).getByRole('link', { name: /Le cycle de la matière organique/i }).click();
  await expect(page.getByRole('heading', { name: 'Pour approfondir' })).toBeVisible();
  await expect(card(page).locator('.library-open').first()).toHaveAttribute('href', libraryPdf.file);
  await page.locator('#course-resources').getByRole('link', { name: /Voir les fiches de ce cours/ }).click();
  await expect(page).toHaveURL(/ressources\.html\?lesson=matiere-organique$/);
  await expect(card(page)).toBeVisible();
});

test('la recherche conserve les mêmes critères et résultats après rechargement', async ({ page }) => {
  await setCatalog(page, [libraryPdf]);
  await page.goto(path);
  const visibleQuery = ' '.repeat(300);
  await search(page).fill(`${visibleQuery}introuvable`);
  await expect(search(page)).toHaveValue(visibleQuery);
  await expect(count(page)).toHaveText('1 ressource sur 1');
  expect(new URL(page.url()).searchParams.get('q')).toBe(visibleQuery);
  await page.reload();
  await expect(search(page)).toHaveValue(visibleQuery);
  await expect(count(page)).toHaveText('1 ressource sur 1');
});

test('retour au tri précédent : le document consulté reste ouvert et ciblé au clavier', async ({ page }) => {
  await setCatalog(page, [libraryPdf, librarySheet]);
  await page.goto(path);
  await filter(page, 'sort').selectOption('title-desc');
  const summary = card(page).locator('summary');
  await summary.press('Enter');
  await expect(summary).toBeFocused();
  await page.goBack();
  await expect(filter(page, 'sort')).toHaveValue('title-asc');
  await expect(card(page).locator('details')).toHaveJSProperty('open', true);
  await expect(summary).toBeFocused();
});

test('liens de thème et d’UC, aperçus réels et absence d’association', async ({ page }) => {
  await page.goto(path);
  const official = card(page, 'fiche-demo');
  await official.getByRole('link', { name: 'Sol et fertilité', exact: true }).click();
  await expect(count(page)).toHaveText('1 ressource sur 8');
  await official.getByRole('link', { name: 'UC 03', exact: true }).click();
  const unit = page.locator('#unit-resources');
  await expect(unit.locator('.library-card')).toHaveCount(3);
  await expect(unit).toContainText('7 ressources associées');
  await expect(card(page, 'annuaire-fournisseurs-semences').getByRole('link', { name: 'Consulter le PDF (nouvel onglet)' }))
    .toHaveAttribute('href', 'documents/Annuaire_fournisseurs-semences-couverts_vegetaux.pdf');
  await unit.getByRole('link', { name: /Toutes les ressources de UC 03/ }).click();
  await expect(count(page)).toHaveText('7 ressources sur 8');
  await page.goto(`${site}uc.html?id=ucare1`);
  await expect(unit).toContainText('Aucune ressource n’est associée à cette UC');
  await page.goto(`${site}cours.html?id=rapport-cn`);
  await expect(page.locator('#course-resources')).toContainText('Aucune ressource n’est directement associée à ce cours');

  for (const privatePath of ['.git/config', 'auth-config.local.json', 'tests/fixtures/resource-library.js']) {
    expect((await page.request.get(site + privatePath)).status()).toBe(404);
  }
});

test('URL historique et critères obsolètes, catalogue vide et recherche sans résultat', async ({ page }) => {
  await setCatalog(page, [libraryPdf, librarySheet]);
  await page.goto(`${path}?unit=ancienne&theme=Sol+et+fertilit%C3%A9&suppl%C3%A9ment=garder&q=${'x'.repeat(360)}`);
  await expect(search(page)).toHaveValue('x'.repeat(300));
  await expect(filter(page, 'theme')).toHaveValue('Sol et fertilité');
  await expect(page.locator('#resource-query-notice')).toContainText('Certains filtres');
  await expect(page.getByText('Aucune ressource ne correspond à ta recherche.')).toBeVisible();
  await page.locator('[data-resource-reset]').click();
  await expect(search(page)).toBeFocused();
  expect(new URL(page.url()).searchParams.get('supplément')).toBe('garder');
  await expect(card(page, librarySheet.id)).toContainText('Ressource transversale');
  await expect(card(page, librarySheet.id).getByRole('link', { name: /Consulter la fiche.*nouvel onglet/ })).toHaveAttribute('href', librarySheet.url);
  await page.unroute(catalogPattern);
  await setCatalog(page, []);
  await page.reload();
  await expect(count(page)).toHaveText('0 ressource sur 0');
  await expect(page.getByText('Aucune ressource disponible pour le moment')).toBeVisible();
});

test('chargement, panne du catalogue et nouvelle tentative avec focus', async ({ page }) => {
  let release;
  const delayed = new Promise(resolve => { release = resolve; });
  let hits = 0;
  await page.route(catalogPattern, async route => {
    if (hits++ === 0) {
      await delayed;
      await route.fulfill({ status: 503 });
    } else {
      await route.fulfill({ json: libraryCatalog([librarySheet]) });
    }
  });
  await page.goto(path);
  try {
    await expect(page.getByText('Chargement de la bibliothèque…')).toBeVisible();
  } finally {
    release();
  }
  await expect(page.getByRole('main').getByRole('alert')).toContainText('La bibliothèque ne peut pas être chargée');
  await page.getByRole('button', { name: 'Réessayer le chargement' }).press('Enter');
  await expect(search(page)).toBeFocused();
  await expect(count(page)).toHaveText('1 ressource sur 1');
  expect(hits).toBe(2);
});

test('contraste des commandes et du texte dans les quatre saisons et les deux modes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setCatalog(page, [libraryPdf, librarySheet]);
  await page.route(pdfPattern, route => route.fulfill({ status: 503 }));
  await page.goto(path);
  await expect(card(page).locator('.library-file-unverified')).toBeVisible();
  const controls = page.locator(`.library-reset, .library-more-filters > summary, .library-search-help:visible,
    .library-filter-grid select:visible, .library-file-warning, .library-actions .btn, .library-description,
    .library-themes a, .library-units a, .library-record summary`);
  for (const season of ['spring', 'summer', 'autumn', 'winter']) {
    for (const brightness of ['light', 'dark']) {
      await page.evaluate(preferences => window.BpreaAppearance.applyPreferences(preferences), { season, brightness });
      await expect(page.locator('html')).toHaveAttribute('data-season', season);
      await expect(page.locator('html')).toHaveAttribute('data-theme', brightness);
      for (const sample of await textContrasts(controls)) {
        expect(sample.ratio, `${season}/${brightness}: ${sample.text}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  }
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await page.keyboard.press('Tab');
  const link = card(page).getByRole('link', { name: /^Essayer de consulter le PDF/ });
  await link.focus();
  await expect(link).toBeFocused();
  await expect(link).toHaveCSS('outline-style', 'solid');
  await expect(link).toHaveCSS('transition-duration', '0s');
});

for (const scenario of [
  { head: 200, mime: 'application/pdf', state: 'available' },
  { head: 404, state: 'missing' },
  { head: 410, state: 'missing' },
  { head: 200, mime: 'text/html', state: 'missing' },
  { head: 405, get: 206, sample: '%PDF-1.7', state: 'available' },
  { head: 501, get: 200, sample: '%PDF-1.7', state: 'available' },
  { head: 200, mime: 'application/octet-stream', get: 206, sample: '%PDF-1.7', state: 'available' },
  { head: 200, mime: 'application/octet-stream', get: 200, sample: '<html></html>', state: 'missing' },
  { head: 501, get: 410, sample: '', state: 'missing' },
  { head: 'offline', state: 'unverified' },
]) {
  test(`PDF — HEAD ${scenario.head} ${scenario.mime || ''}, GET ${scenario.get || '—'} → ${scenario.state}`, async ({ page }) => {
    await setCatalog(page, [libraryPdf]);
    const requests = [];
    await page.route(pdfPattern, route => {
      const request = route.request();
      requests.push({ method: request.method(), range: request.headers().range });
      if (scenario.head === 'offline') return route.abort('internetdisconnected');
      if (request.method() === 'HEAD') return route.fulfill({ status: scenario.head, contentType: scenario.mime || 'text/plain' });
      const headers = scenario.get === 206 ? { 'content-range': `bytes 0-${scenario.sample.length - 1}/2000` } : {};
      return route.fulfill({ status: scenario.get, headers, body: scenario.sample });
    });
    await page.goto(path);
    const links = card(page).locator('.library-actions a');
    await expect(links).toHaveCount(scenario.state === 'missing' ? 0 : 2);
    if (scenario.state === 'available') {
      await expect(card(page).getByRole('link', { name: /^Consulter le PDF/ })).toBeVisible();
      await expect(retryPdf(page)).toHaveCount(0);
    } else {
      await expect(card(page).locator(`.library-file-${scenario.state}`)).toBeVisible();
      await expect(retryPdf(page)).toBeVisible();
    }
    expect(requests).toEqual([{ method: 'HEAD', range: undefined }, ...(scenario.get ? [{ method: 'GET', range: 'bytes=0-1023' }] : [])]);
  });
}

test('PDF — délai de dix secondes, reprise et focus sans défilement', async ({ page }) => {
  await setCatalog(page, [libraryPdf]);
  await page.clock.install();
  let unblock;
  const pending = new Promise(resolve => { unblock = resolve; });
  let hits = 0;
  await page.route(pdfPattern, async route => {
    if (hits++ === 0) {
      await pending;
      return route.abort().catch(() => {});
    }
    await route.fulfill({ contentType: 'application/pdf' });
  });
  await page.goto(path);
  try {
    await expect.poll(() => hits).toBe(1);
    await page.clock.runFor(9600);
    await expect(card(page)).toContainText('Vérification du document…');
    await page.clock.runFor(400);
    await expect(card(page).locator('.library-file-unverified')).toBeVisible();
  } finally {
    unblock();
  }
  await retryPdf(page).scrollIntoViewIfNeeded();
  await retryPdf(page).focus();
  const position = await page.evaluate(() => scrollY);
  await page.keyboard.press('Enter');
  await expect(card(page).getByRole('link', { name: 'Consulter le PDF (nouvel onglet)' })).toBeFocused();
  expect(Math.abs(await page.evaluate(() => scrollY) - position)).toBeLessThan(3);
  expect(hits).toBe(2);
});

test('PDF — une réponse tardive ne repeuple pas la grille et reste en cache', async ({ page }) => {
  await setCatalog(page, [libraryPdf, librarySheet]);
  let unblock;
  const pending = new Promise(resolve => { unblock = resolve; });
  let hits = 0;
  await page.route(pdfPattern, async route => {
    hits++;
    await pending;
    await route.fulfill({ contentType: 'application/pdf' });
  });
  await page.goto(path);
  try {
    await expect(card(page)).toContainText('Vérification du document…');
    await filter(page, 'type').focus();
    await filter(page, 'type').selectOption('technical-sheet');
  } finally {
    unblock();
  }
  await expect(card(page)).toHaveCount(0);
  await expect(count(page)).toHaveText('1 ressource sur 2');
  await expect(filter(page, 'type')).toBeFocused();
  await filter(page, 'type').selectOption('pdf');
  await expect(card(page).getByRole('link', { name: /^Consulter le PDF/ })).toBeVisible();
  await filter(page, 'type').selectOption('');
  await expect(card(page).getByRole('link', { name: /^Consulter le PDF/ })).toBeVisible();
  expect(hits).toBe(1);
});

for (const inside of [true, false]) {
  test(`PDF — signature ${inside ? 'à cheval sur deux blocs' : 'au-delà de 1 024 octets'}`, async ({ page }) => {
    await setCatalog(page, [libraryPdf]);
    await page.addInitScript(({ pdfName, inside }) => {
      const fetchNormally = window.fetch;
      window.fetch = (url, options) => {
        if (!String(url).endsWith(pdfName)) return fetchNormally(url, options);
        if (options.method === 'HEAD') return Promise.resolve(new Response(null, { status: 405 }));
        const encoder = new TextEncoder();
        const chunks = inside ? ['%P', 'DF-'] : ['é'.repeat(512), '%PDF-'];
        return Promise.resolve(new Response(new ReadableStream({
          pull(controller) { controller.enqueue(encoder.encode(chunks.shift() ?? '!')); },
          cancel() { window.sampleCancelled = true; },
        }), { status: 206 }));
      };
    }, { pdfName, inside });
    await page.goto(path);
    if (inside) await expect(card(page).getByRole('link', { name: /^Consulter le PDF/ })).toBeVisible();
    else await expect(card(page).locator('.library-file-missing')).toBeVisible();
    expect(await page.evaluate(() => window.sampleCancelled)).toBe(true);
  });
}
