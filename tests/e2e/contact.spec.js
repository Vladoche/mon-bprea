import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const policy = JSON.parse(readFileSync('scripts/preopening/policy.json', 'utf8'));
const prefix = '/mon-bprea/';
const time = new Date('2026-11-05T12:00:00.000Z');

for (const width of [320, 390, 1280]) {
  for (const colorScheme of ['light', 'dark']) {
    test(`contact sans JavaScript ni compte, ${width}px ${colorScheme}`, async ({ browser }) => {
      const context = await browser.newContext({ javaScriptEnabled: false, colorScheme, viewport: { width, height: 900 } });
      try {
        const page = await context.newPage(), requests = [];
        page.on('request', request => requests.push(new URL(request.url())));
        const response = await page.goto(`http://127.0.0.1:4173${prefix}contact.html`);
        expect(response.status()).toBe(200);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Contact et assistance');
        await expect(page.locator('main')).toContainText('sept comptes au total : l’exploitant et six autres participants adultes');
        await expect(page.locator('main')).toContainText('Son ouverture privée n’est pas encore autorisée');
        const email = page.getByRole('link', { name: policy.contact.email, exact: true });
        await expect(email).toHaveAttribute('href', `mailto:${policy.contact.email}`);
        await expect(page.locator('form, input, iframe')).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect(await page.locator('body').evaluate(node => getComputedStyle(node).backgroundColor)).toBe(colorScheme === 'dark' ? 'rgb(18, 27, 21)' : 'rgb(247, 249, 242)');
        await page.keyboard.press('Tab');
        await expect(page.getByRole('link', { name: 'Aller au contenu', exact: true })).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(page.locator('main')).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(email).toBeFocused();
        expect(await email.evaluate(node => getComputedStyle(node).outlineStyle)).toBe('solid');
        const selected = await email.evaluate(node => {
          const range = document.createRange(); range.selectNodeContents(node);
          const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
          return selection.toString();
        });
        expect(selected).toBe(policy.contact.email);
        expect(requests.every(url => url.origin === 'http://127.0.0.1:4173' && url.pathname.startsWith(prefix))).toBe(true);
        expect(requests.some(url => /\/(?:auth|rest)\/v1\//.test(url.pathname))).toBe(false);
      } finally { await context.close(); }
    });
  }
}

test('contact autonome : préférences saisonnières et clair/sombre conservées, aucun appel Auth', async ({ page }) => {
  await page.clock.install({ time });
  const saved = { version: 1, season: 'winter', brightness: 'dark' };
  await page.addInitScript(value => localStorage.setItem('bprea-demo-appearance-device-v1', JSON.stringify(value)), saved);
  const requests = [];
  page.on('request', request => requests.push(new URL(request.url())));
  await page.goto(`${prefix}contact.html`);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-season', 'winter');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('bprea-demo-appearance-device-v1')))).toEqual(saved);
  expect(requests.every(url => url.origin === 'http://127.0.0.1:4173')).toBe(true);
  expect(requests.some(url => /auth-config|supabase|app\.js/.test(url.pathname))).toBe(false);
});

for (const javaScriptEnabled of [true, false]) {
  test(`points d’entrée publics vers le contact, JavaScript ${javaScriptEnabled}`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled });
    try {
      const page = await context.newPage();
      await page.clock.install({ time });
      for (const file of ['index', 'connexion', 'mot-de-passe-oublie', 'profil', 'authentification']) {
        await page.goto(`http://127.0.0.1:4173${prefix}${file}.html`);
        const contact = page.locator('footer').getByRole('link', { name: 'Contact et assistance', exact: true });
        await expect(contact).toHaveAttribute('href', 'contact.html');
        await contact.click();
        await expect(page).toHaveURL(`http://127.0.0.1:4173${prefix}contact.html`);
        await expect(page.getByRole('link', { name: policy.contact.email, exact: true })).toBeVisible();
      }
      const config = await context.request.get(`http://127.0.0.1:4173${prefix}assets/auth-config.json`);
      expect((await config.json()).enabled).toBe(false);
      expect((await context.request.get(`http://127.0.0.1:4173${prefix}confidentialite.html`)).status()).toBe(404);
    } finally { await context.close(); }
  });
}
