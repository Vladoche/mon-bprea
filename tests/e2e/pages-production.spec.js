// An isolated browser serves a LOCAL artifact under the expected HTTPS origin.
// Every request is intercepted. No request reaches Pages or Supabase PROD.
import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

const site = 'https://vladoche.github.io/mon-bprea/';
const config = { enabled: true, environment: 'production', url: 'https://oqoqrxwfbkhtpksqimgd.supabase.co',
  publishableKey: 'sb_publishable_fixture_production_only', siteUrl: site };
let directory, artifact;
test.beforeAll(() => {
  mkdirSync('.tmp', { recursive: true });
  directory = mkdtempSync(resolve('.tmp/pages-production-test-'));
  artifact = join(directory, 'public');
  const file = join(directory, 'config.json');
  writeFileSync(file, JSON.stringify(config));
  const built = spawnSync(process.env.PYTHON || 'python', ['scripts/prepare-pages.py', '--production', '--auth-config', file,
    '--version', 'production-artifact-test', '--output', artifact], { encoding: 'utf8' });
  expect(built.stderr).toBe(''); expect(built.status).toBe(0);
});
test.afterAll(() => {
  if (directory && realpathSync(directory).startsWith(realpathSync('.tmp') + sep + 'pages-production-test-')) rmSync(directory, { recursive: true });
});

for (const width of [390, 1280]) {
  for (const brightness of ['light', 'dark']) {
    test(`artefact PROD isolé : connexion, profil et callback sans session, ${width}px ${brightness}`, async ({ context, page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.clock.install({ time: new Date('2026-11-08T12:00:00Z') });
      await page.addInitScript(value => localStorage.setItem('bprea-demo-appearance-device-v1', JSON.stringify({ version: 1, season: 'winter', brightness: value })), brightness);
      const external = [], errors = [], failed = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => { if (response.status() >= 400) failed.push(new URL(response.url()).pathname); });
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (!url.href.startsWith(site) || route.request().method() !== 'GET') {
          external.push(url.origin + url.pathname); return route.abort();
        }
        const relative = decodeURIComponent(url.pathname.slice('/mon-bprea/'.length)) || 'index.html';
        const file = resolve(artifact, relative);
        if (!file.startsWith(artifact + sep) || !existsSync(file)) { failed.push(relative); return route.abort(); }
        return route.fulfill({ path: file });
      });
      await page.goto(site + 'connexion.html');
      await expect(page.getByLabel('Adresse e-mail', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Se connecter', exact: true })).toBeEnabled();
      await expect(page.locator('main').getByRole('alert')).toHaveCount(0);
      await expect(page.getByRole('button', { name: /créer.*compte|s’inscrire/i })).toHaveCount(0);
      const received = await page.evaluate(async () => (await fetch('assets/auth-config.json')).json());
      expect(received).toEqual(config);
      await expect(page.locator('html')).toHaveAttribute('data-theme', brightness);
      await expect(page.locator('html')).toHaveAttribute('data-season', 'winter');
      await page.getByLabel('Adresse e-mail', { exact: true }).focus();
      await page.keyboard.press('Tab');
      await expect(page.getByLabel('Mot de passe', { exact: true })).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath('connexion.png'), fullPage: true });

      await page.goto(site + 'profil.html');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mon profil');
      await expect(page.getByRole('button', { name: 'Déconnexion', exact: true })).toHaveCount(0);
      await expect(page.locator('main').getByRole('link', { name: 'Connexion', exact: true })).toBeVisible();
      await page.goto(site + 'authentification.html');
      await expect(page.locator('main').getByRole('alert')).toContainText(/invalide|expiré|utilisé/i);
      await expect(page.locator('main a[href="confidentialite.html#compte-et-invitation"]')).toBeVisible();
      for (const type of ['invite', 'recovery']) {
        await page.goto(site + `authentification.html?token_hash=synthetic-callback-never-a-real-token&type=${type}`);
        await expect(page).toHaveURL(site + 'authentification.html');
        await expect(page.getByRole('button', { name: type === 'invite' ? 'Continuer l’activation' : 'Continuer la réinitialisation', exact: true })).toBeEnabled();
        await expect(page.locator('body')).not.toContainText('synthetic-callback-never-a-real-token');
        // No click: verifyOtp and account activation require a separate authorization.
      }

      await page.goto(site + 'mes-cours.html');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mes cours');
      await page.locator('footer').getByRole('link', { name: 'Confidentialité', exact: true }).click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Notice de confidentialité de Mon BPREA');
      await expect(page.locator('main')).toContainText('Version 1.1 · 8 novembre 2026');
      await expect(page.locator('main')).not.toContainText('en préparation');
      await expect(page.locator('html')).toHaveAttribute('data-theme', brightness);
      await expect(page.locator('html')).toHaveAttribute('data-season', 'winter');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath('notice.png'), fullPage: true });
      expect(external).toEqual([]); expect(errors).toEqual([]); expect(failed).toEqual([]);
    });
  }
}

for (const colorScheme of ['light', 'dark']) {
  test(`notice publique sans JavaScript : liens, clavier et mobile ${colorScheme}`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, colorScheme, viewport: { width: 320, height: 900 } });
    try {
      const page = await context.newPage();
      await page.goto('http://127.0.0.1:4173/mon-bprea/confidentialite.html');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Notice de confidentialité de Mon BPREA');
      await expect(page.locator('main')).toContainText('Francfort, Allemagne, eu-central-1');
      await expect(page.locator('form, iframe')).toHaveCount(0);
      await page.keyboard.press('Tab');
      await expect(page.getByRole('link', { name: 'Aller au contenu', exact: true })).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.locator('main')).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.getByRole('navigation', { name: 'Sommaire' }).getByRole('link').first()).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      for (const file of ['index', 'contact', 'connexion', 'authentification', 'mot-de-passe-oublie', 'profil']) {
        await page.goto(`http://127.0.0.1:4173/mon-bprea/${file}.html`);
        await page.locator('footer').getByRole('link', { name: 'Confidentialité', exact: true }).click();
        await expect(page).toHaveURL(/\/mon-bprea\/confidentialite\.html$/);
      }
    } finally { await context.close(); }
  });
}
