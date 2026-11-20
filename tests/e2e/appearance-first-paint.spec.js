import { test, expect } from '@playwright/test';
import { createSettingsAPI, accounts, settingsOrigin, settingsRow } from './settings-api.js';
import { sessionFor } from './course-quiz-api.js';
import { settingsSynced } from '../helpers/settings-browser.js';
import { backgroundPixel, preparePaintCapture, recordNavigation } from '../helpers/appearance-paint.js';

const prefix = '/mon-bprea/';
const midday = new Date('2026-11-16T11:00:00Z');
const devicesKey = 'bprea-demo-appearance-device-v1';

test.use({ channel: 'chromium', launchOptions: { ignoreDefaultArgs: ['--disable-back-forward-cache'] } });

const prepare = page => preparePaintCapture(page, { date: midday });

function seed(api) {
  const preferences = {
    A: { season: 'winter', brightness: 'dark', colorMode: 'custom', customColor: '#b000ff' },
    B: { season: 'winter', brightness: 'light' },
  };
  for (const [account, value] of Object.entries(preferences))
    api.rows.appearance.set(accounts[account].id, settingsRow('appearance', value, accounts[account].id,
      '55300000-0000-4000-8000-000000000001'));
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
        await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'neutral');
        auth.resolve();
        await expect.poll(() => page.evaluate(() => window.BpreaAppearance.getSource())).toBe('blocked');
        await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'neutral');
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
  const expectedPixel = await backgroundPixel(page, client);
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
          name, mode: 'dark', expectedPixel, navigate, whileVisible: async () => {
            await expect(target.locator('html')).toHaveAttribute('data-color-mode', 'custom');
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
    expect(await backgroundPixel(page, client)).toEqual(expectedPixel);
  } finally { await second.close(); }
  expect(api.sent).toEqual([]);
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
    await expect.poll(() => page.evaluate(() => window.BpreaAppearance.getState().color ?? null)).toBe(to === 'A' ? '#b000ff' : null);
  }

  await switchFrom('A', 'B');
  const expectedPixel = await backgroundPixel(page, client);
  const auth = Promise.withResolvers();
  api.holdUser = () => auth.promise;
  try {
    await recordNavigation(page, client, info, {
      name: 'navigation-claire-b', mode: 'light', expectedPixel,
      navigate: () => page.goto(prefix + 'outils.html', { waitUntil: 'domcontentloaded' }),
      whileVisible: async () => {
        await expect(page.locator('html')).not.toHaveAttribute('data-color-mode', 'custom');
        await expect(page.locator('html')).toHaveAttribute('data-season', 'winter');
        auth.resolve();
        await settingsSynced(page);
      },
    });
  } finally { auth.resolve(); api.holdUser = null; }
  await page.goto(prefix + 'profil.html');
  await switchFrom('B', 'A');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await recordNavigation(page, client, info, {
    name: 'navigation-apres-retour-compte-a', mode: 'dark', expectedPixel: await backgroundPixel(page, client),
    navigate: () => page.goto(prefix + 'outils.html', { waitUntil: 'domcontentloaded' }),
  });
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
    name: 'retour-bfcache', mode: 'dark', bfcache: true, expectedPixel: await backgroundPixel(page, client),
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
        await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'neutral');
        config.resolve();
      },
    });
  } finally { config.resolve(); }
});

for (const invalid of ['autre compte', 'couleur corrompue', 'ancien format']) {
  test(`premier rendu neutre avec un repère ${invalid}`, async ({ page }, info) => {
    const api = createSettingsAPI();
    seed(api);
    const account = invalid === 'autre compte' ? 'B' : 'A';
    const jwt = sessionFor('A').access_token.split('.')[1];
    const { session_id: sessionId } = JSON.parse(Buffer.from(jwt, 'base64url'));
    const marker = { version: 1, userId: accounts.A.id, sessionId, brightness: 'light' };
    if (invalid !== 'ancien format') marker.appearance = {
      brightness: 'light', colorMode: 'custom', customColor: invalid === 'autre compte' ? '#b000ff' : 'illisible',
    };
    await api.install(page.context(), account, {
      ['bprea-auth-local-identity-v1:' + JSON.stringify(['development', settingsOrigin, prefix])]: JSON.stringify(marker),
      [devicesKey]: JSON.stringify({ version: 1, season: 'spring', brightness: 'light', colorMode: 'custom', customColor: '#cc0000' }),
    });
    const client = await preparePaintCapture(page, { throttle: false });
    const auth = Promise.withResolvers();
    api.holdUser = () => auth.promise;
    try {
      await recordNavigation(page, client, info, {
        name: 'repli-neutre', mode: account === 'B' ? 'dark' : 'light',
        navigate: () => page.goto(prefix + 'outils.html', { waitUntil: 'domcontentloaded' }),
        whileVisible: async () => {
          await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'neutral');
          const pixel = await backgroundPixel(page, client);
          expect(Math.max(...pixel) - Math.min(...pixel)).toBeLessThanOrEqual(1);
        },
      });
    } finally { auth.resolve(); }
    await settingsSynced(page);
    if (account === 'A') await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'custom');
    else await expect(page.locator('html')).toHaveAttribute('data-season', 'winter');
  });
}
