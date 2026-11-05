import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { noticeHtml } from '../../scripts/preopening/notice-preview.mjs';

const path = '/mon-bprea/confidentialite.html';
const source = readFileSync(new URL('../../docs/rgpd/POLITIQUE-CONFIDENTIALITE-PROJET.md', import.meta.url), 'utf8');

test.use({ javaScriptEnabled: false });

for (const width of [320, 390, 1280]) {
  for (const colorScheme of ['light', 'dark']) {
    test(`aperçu V1.0 sans JavaScript, ${width}px ${colorScheme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      await page.route('**/*', route => route.abort());
      await page.route(`**${path}`, route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: noticeHtml(source) }));
      const requests = [];
      page.on('request', request => requests.push(new URL(request.url()).pathname));
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Notice de confidentialité de Mon BPREA');
      await expect(page.getByRole('note')).toContainText('La publication attend les vérifications finales');
      await expect(page.locator('main')).toContainText('Version 1.0 · 5 novembre 2026');
      await expect(page.locator('main')).toContainText('Vladimir Fouillade');
      await expect(page.locator('script, iframe, form')).toHaveCount(0);
      await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', 'noindex,nofollow');
      await expect(page.getByRole('link', { name: 'vladimir.fouillade@hotmail.fr' }))
        .toHaveAttribute('href', 'mailto:vladimir.fouillade@hotmail.fr');
      await expect(page.getByRole('link', { name: 'adresser une réclamation à la CNIL' }))
        .toHaveAttribute('href', 'https://www.cnil.fr/fr/adresser-une-plainte');

      const toc = page.getByRole('navigation', { name: 'Sommaire' });
      const links = await toc.getByRole('link').evaluateAll(nodes => nodes.map(node => new URL(node.href).hash));
      const ids = await page.getByRole('heading', { level: 2 }).evaluateAll(nodes => nodes.map(node => '#' + node.id));
      expect(links).toEqual(ids);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).toEqual(expect.arrayContaining(['#compte-et-invitation', '#stockage-sur-votre-appareil', '#vos-droits-et-la-cloture']));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.locator('body')).toHaveCSS('background-color', colorScheme === 'dark' ? 'rgb(18, 27, 21)' : 'rgb(247, 249, 242)');

      await page.keyboard.press('Tab');
      await expect(page.getByRole('link', { name: 'Aller au contenu' })).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.locator('main')).toBeFocused();
      await page.keyboard.press('Tab');
      const firstLink = toc.getByRole('link', { name: 'Responsable et contact' });
      await expect(firstLink).toBeFocused();
      await expect(firstLink).toHaveCSS('outline-style', 'solid');
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(path + '#responsable-et-contact');
      await expect(page.getByRole('heading', { name: 'Responsable et contact' })).toBeFocused();

      const contrast = await page.evaluate(() => {
        function luminance(color) {
          const linear = color.match(/\d+/g).slice(0, 3).map(value => {
            const channel = Number(value) / 255;
            return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
        }
        const body = getComputedStyle(document.body);
        const link = getComputedStyle(document.querySelector('nav a'));
        const nav = getComputedStyle(document.querySelector('nav'));
        return [[body.color, body.backgroundColor], [link.color, nav.backgroundColor]].map(pair => {
          const [dark, light] = pair.map(luminance).sort((a, b) => a - b);
          return (light + 0.05) / (dark + 0.05);
        });
      });
      expect(Math.min(...contrast)).toBeGreaterThanOrEqual(4.5);
      expect(requests).toEqual([path]);
    });
  }
}
