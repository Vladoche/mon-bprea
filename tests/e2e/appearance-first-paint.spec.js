import { test, expect } from '@playwright/test';
import { createSettingsAPI, accounts, settingsRow } from './settings-api.js';
import { settingsSynced } from '../helpers/settings-browser.js';

const prefix = '/mon-bprea/';
const midday = new Date('2026-11-16T11:00:00Z');
const devicesKey = 'bprea-demo-appearance-device-v1';

test.use({ channel: 'chromium', launchOptions: { ignoreDefaultArgs: ['--disable-back-forward-cache'] } });

async function prepare(page) {
  await page.setViewportSize({ width: 900, height: 580 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(time => {
    // Freeze calendar time only. Paint and CDP timestamps need the real clock.
    const BrowserDate = Date;
    function FixedDate(...args) {
      if (!new.target) return new BrowserDate(time).toString();
      return Reflect.construct(BrowserDate, args.length ? args : [time], new.target);
    }
    Object.setPrototypeOf(FixedDate, BrowserDate);
    FixedDate.prototype = BrowserDate.prototype;
    FixedDate.now = () => time;
    window.Date = FixedDate;
    new PerformanceObserver(list => {
      const paint = list.getEntries().find(item => item.name === 'first-paint');
      if (paint) window.firstPaintEpoch = (performance.timeOrigin + paint.startTime) / 1000;
    }).observe({ type: 'paint', buffered: true });
  }, +midday);
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await client.send('Network.enable');
  await client.send('Network.emulateNetworkConditions', { offline: false, latency: 60, downloadThroughput: 600000, uploadThroughput: 240000 });
  return client;
}

async function pixels(page, images) {
  return page.evaluate(async images => {
    const canvas = new OffscreenCanvas(1, 1);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    return Promise.all(images.map(async data => {
      const bitmap = await createImageBitmap(new Blob([Uint8Array.fromBase64(data)]));
      // The outer margin at (4,85) is the page background in this viewport.
      ctx.drawImage(bitmap, 4, 85, 1, 1, 0, 0, 1, 1);
      bitmap.close();
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return [r, g, b];
    }));
  }, images);
}

function expectBrightness(rgb, mode, label) {
  const description = label + ' rgb(' + rgb.join(', ') + ')';
  if (mode === 'dark') expect(Math.max(...rgb), description).toBeLessThan(85);
  else expect(Math.min(...rgb), description).toBeGreaterThan(185);
}

async function recordNavigation(page, client, testInfo, { name, mode, navigate, whileVisible, bfcache = false }) {
  const frames = [];
  const listener = ({ data, metadata, sessionId }) => {
    frames.push({ data, time: metadata.timestamp });
    void client.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  };
  client.on('Page.screencastFrame', listener);
  await client.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 });
  let firstPaint;
  let visible;
  try {
    const start = Date.now() / 1000;
    await navigate();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    if (bfcache) firstPaint = start;
    else {
      await expect.poll(() => page.evaluate(() => window.firstPaintEpoch)).toBeGreaterThan(start);
      firstPaint = await page.evaluate(() => window.firstPaintEpoch);
    }
    visible = (await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true })).data;
    await whileVisible?.();
  } finally {
    await client.send('Page.stopScreencast');
    client.off('Page.screencastFrame', listener);
  }
  const afterPaint = frames.filter(frame => frame.time >= firstPaint);
  expect(afterPaint.length, 'images du compositeur après première peinture · ' + name).toBeGreaterThan(0);
  const samples = await pixels(page, [visible, ...afterPaint.map(frame => frame.data)]);
  for (const [index, rgb] of samples.entries()) expectBrightness(rgb, mode, name + ' / image ' + index);
  await testInfo.attach(name + '-premiere-frame', { body: Buffer.from(afterPaint[0].data, 'base64'), contentType: 'image/png' });
  await testInfo.attach(name + '-pixels', { body: JSON.stringify(samples), contentType: 'application/json' });
}

function seed(api) {
  for (const [account, brightness, customColor] of [['A', 'dark', '#02ce95'], ['B', 'light', '#5858db']]) {
    api.rows.appearance.set(accounts[account].id, settingsRow('appearance', {
      season: 'winter', brightness, colorMode: 'custom', customColor,
    }, accounts[account].id, '55300000-0000-4000-8000-000000000001'));
  }
}

test('première peinture sombre, palette privée différée pendant Auth et le chargement des préférences', async ({ page }, info) => {
  const api = createSettingsAPI();
  seed(api);
  await api.install(page.context(), 'A', {
    [devicesKey]: JSON.stringify({ version: 1, season: 'spring', brightness: 'light' }),
  });
  const client = await prepare(page);
  const auth = Promise.withResolvers(), settings = Promise.withResolvers();
  api.holdUser = () => auth.promise;
  api.holdRead = domain => domain === 'appearance' ? settings.promise : null;
  try {
    await recordNavigation(page, client, info, {
      name: 'froid-identite-a-verifier', mode: 'dark',
      navigate: () => page.goto(prefix + 'outils.html', { waitUntil: 'domcontentloaded' }),
      whileVisible: async () => {
        await expect(page.locator('html')).not.toHaveAttribute('data-color-mode', 'custom');
        auth.resolve();
        await expect.poll(() => page.evaluate(() => window.BpreaAppearance.getSource())).toBe('blocked');
        await expect(page.locator('html')).not.toHaveAttribute('data-color-mode', 'custom');
        settings.resolve();
        await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'custom');
      },
    });
  } finally { auth.resolve(); settings.resolve(); }
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('session sombre vérifiée : navigation chaude, rechargements, onglet neuf et reprise', async ({ page, context }, info) => {
  test.setTimeout(65000);
  const api = createSettingsAPI();
  seed(api);
  await api.install(context);
  const client = await prepare(page);
  await page.goto(prefix + 'outils.html');
  await settingsSynced(page);
  await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'custom');
  const second = await context.newPage();
  try {
    const secondClient = await prepare(second);
    const navigation = [
      ['chaude', page, client, () => page.goto(prefix + 's-exercer.html', { waitUntil: 'domcontentloaded' })],
      ['rechargement', page, client, () => page.reload({ waitUntil: 'domcontentloaded' })],
      ['rechargement-force', page, client, async () => {
        const committed = page.waitForNavigation({ waitUntil: 'domcontentloaded' });
        await client.send('Page.reload', { ignoreCache: true });
        await committed;
      }],
      ['nouvel-onglet', second, secondClient, () => second.goto(prefix + 'outils.html', { waitUntil: 'domcontentloaded' })],
    ];
    for (const [name, target, session, navigate] of navigation) {
      const auth = Promise.withResolvers();
      api.holdUser = () => auth.promise;
      try {
        await recordNavigation(target, session, info, {
          name, mode: 'dark', navigate, whileVisible: async () => {
            await expect(target.locator('html')).not.toHaveAttribute('data-color-mode', 'custom');
            auth.resolve();
            await expect(target.locator('html')).toHaveAttribute('data-color-mode', 'custom');
          },
        });
      } finally { auth.resolve(); api.holdUser = null; }
    }

    await page.bringToFront();
    await client.send('Page.setWebLifecycleState', { state: 'frozen' });
    await second.bringToFront();
    await client.send('Page.setWebLifecycleState', { state: 'active' });
    await page.bringToFront();
    const { data } = await client.send('Page.captureScreenshot', { format: 'png' });
    expectBrightness((await pixels(page, [data]))[0], 'dark', 'onglet réactivé');
  } finally { await second.close(); }
});

test('cloisonnement A sombre, B clair, puis A et stabilité du premier rendu clair vérifié', async ({ page }, info) => {
  test.setTimeout(50000);
  const api = createSettingsAPI();
  seed(api);
  await api.install(page.context());
  const client = await prepare(page);
  await page.goto(prefix + 'profil.html');
  await settingsSynced(page);
  await expect(page.getByText(accounts.A.email, { exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  async function switchFrom(from, to) {
    await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
    await expect(page.getByText(accounts[from].email, { exact: true })).toHaveCount(0);
    await expect(page.locator('html')).not.toHaveAttribute('data-color-mode', 'custom');
    await page.locator('#informations-compte').getByRole('link', { name: 'Connexion' }).click();
    await page.getByLabel('Adresse e-mail').fill(accounts[to].email);
    await page.getByLabel('Mot de passe', { exact: true }).fill('synthetic-password');
    await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
    await expect(page.getByText(accounts[to].email, { exact: true })).toBeVisible();
    await settingsSynced(page);
    await expect.poll(() => page.evaluate(() => window.BpreaAppearance.getState().color)).toBe(to === 'A' ? '#02ce95' : '#5858db');
  }

  await switchFrom('A', 'B');
  const auth = Promise.withResolvers();
  api.holdUser = () => auth.promise;
  try {
    await recordNavigation(page, client, info, {
      name: 'navigation-claire-b', mode: 'light',
      navigate: () => page.goto(prefix + 'outils.html', { waitUntil: 'domcontentloaded' }),
      whileVisible: async () => {
        await expect(page.locator('html')).not.toHaveAttribute('data-color-mode', 'custom');
        auth.resolve();
        await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'custom');
      },
    });
  } finally { auth.resolve(); api.holdUser = null; }
  await page.goto(prefix + 'profil.html');
  await switchFrom('B', 'A');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('retour arrière BFCache puis revérification sans peindre une page claire', async ({ page }, info) => {
  const api = createSettingsAPI();
  seed(api);
  await api.install(page.context());
  const client = await prepare(page);
  await page.route('**/outils.html', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'cache-control': 'private, max-age=60' } });
  });
  await page.goto(prefix + 'outils.html');
  await settingsSynced(page);
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => addEventListener('pageshow', event => {
    if (event.persisted) sessionStorage.setItem('appearance-native-bfcache', 'true');
  }));
  await page.goto(prefix + 'contact.html');
  // Each document involved was already dark. Include restoration frames
  // even if the existing privacy guard reloads the restored document.
  await recordNavigation(page, client, info, {
    name: 'retour-bfcache', mode: 'dark', bfcache: true,
    navigate: async () => {
      try { await page.goBack({ waitUntil: 'commit' }); }
      catch (error) { if (!error.message.includes('net::ERR_ABORTED')) throw error; }
      await expect(page).toHaveURL(/outils\.html$/);
    },
    whileVisible: () => expect.poll(() => page.evaluate(() => sessionStorage.getItem('appearance-native-bfcache'))).toBe('true'),
  });
});

test('stockage inaccessible et Auth indisponible : page sombre utilisable pendant la vérification', async ({ page }, info) => {
  const client = await prepare(page);
  const config = Promise.withResolvers();
  await page.route('**/assets/auth-config.json*', async route => { await config.promise; await route.abort(); });
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Synthétique', 'SecurityError'); } });
  });
  try {
    await recordNavigation(page, client, info, {
      name: 'stockage-inaccessible', mode: 'dark',
      navigate: () => page.goto(prefix + 'outils.html', { waitUntil: 'domcontentloaded' }),
      whileVisible: async () => {
        await expect(page.getByRole('link', { name: /Créer un itinéraire technique/ })).toBeVisible();
        config.resolve();
      },
    });
  } finally { config.resolve(); }
});
