import { test, expect } from '@playwright/test';
import { createSettingsAPI, accounts } from './settings-api.js';
import { waitForIdentity } from '../helpers/personal-browser.js';

const prefix = '/mon-bprea/';
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-15T11:00:00Z') });
  await page.addInitScript(() => localStorage.setItem('bprea-demo-appearance-device-v1', JSON.stringify({ version: 1, season: 'autumn', brightness: 'light' })));
  // Previous visual captures intentionally neutralize motion. This regression
  // specifically needs real entry AND exit transitions, including quick reversals.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
});

async function sampleHover(page, target, duration = 420) {
  await target.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0); await page.waitForTimeout(180);
  const initial = await target.evaluate(node => ({ image: getComputedStyle(node).backgroundImage, color: getComputedStyle(node).backgroundColor }));
  await target.evaluate((node, duration) => {
    window.__hoverSamples = { done: false, frames: [] };
    let start;
    function frame(time) {
      start ??= time;
      const style = getComputedStyle(node);
      window.__hoverSamples.frames.push({ image: style.backgroundImage, color: style.backgroundColor, opacity: style.opacity });
      if (time - start < duration) requestAnimationFrame(frame);
      else window.__hoverSamples.done = true;
    }
    requestAnimationFrame(frame);
  }, duration);
  await target.hover(); await page.waitForTimeout(65);
  await page.mouse.move(0, 0); await page.waitForTimeout(45);
  await target.hover(); await page.waitForTimeout(75);
  await page.mouse.move(0, 0);
  await page.waitForFunction(() => window.__hoverSamples.done);
  return { initial, frames: await page.evaluate(() => window.__hoverSamples.frames) };
}

test('hover : gradients continus à l’entrée, à la sortie et lors des inversions rapides', async ({ page }, testInfo) => {
  test.setTimeout(60000);
  await page.goto(prefix); await page.evaluate(() => document.fonts.ready);
  const report = [];
  for (const season of ['spring', 'summer', 'autumn', 'winter']) for (const theme of ['light', 'dark']) {
    await page.evaluate(({ season, theme }) => { document.documentElement.dataset.season = season; document.documentElement.dataset.theme = theme; }, { season, theme });
    for (const selector of ['[data-revision-start]', '.home-all-courses .btn-primary', '.home-course-card']) {
      const result = await sampleHover(page, page.locator(selector).first());
      expect(result.initial.image, `${season}/${theme}/${selector}`).toContain('gradient');
      for (const frame of result.frames) {
        expect(frame.image, `${season}/${theme}/${selector}: disappearing gradient over ${frame.color}`).toBe(result.initial.image);
        expect(frame.opacity).toBe('1');
      }
      report.push({ season, theme, selector, sampledFrames: result.frames.length });
    }
  }
  for (const [file, selector] of [['mes-cours.html', '.hub-unit-card'], ['s-exercer.html', '.hub-link-card'], ['outils.html', '.hub-link-card']]) {
    await page.goto(prefix + file);
    const result = await sampleHover(page, page.locator(selector).first());
    for (const frame of result.frames) expect(frame.image, `${file}: changing gradient`).toBe(result.initial.image);
  }
  await testInfo.attach('hover-gradient-frames.json', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
});

test('hover : bords des quatre pilules stables sous de petits mouvements de souris', async ({ page }) => {
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 }); await page.goto(prefix);
    await expect(page.locator('.account-link')).toHaveText('Connexion');
    await page.evaluate(() => document.fonts.ready);
    for (const entry of await page.locator('.primary-nav__entry').all()) {
      await entry.scrollIntoViewIfNeeded(); await page.mouse.move(0, 0); await page.waitForTimeout(180);
      const before = await entry.boundingBox();
      for (let i = 0; i < 8; i++) {
        // Stay inside the painted edge despite device-pixel rounding, while
        // remaining inside the former one-pixel displacement that caused jitter.
        await page.mouse.move(before.x + before.width / 2 + (i % 2) * .05, before.y + before.height - .75);
        await page.waitForTimeout(35);
        expect(await entry.evaluate(node => node.matches(':hover')), `${width}px / ${await entry.innerText()} / move ${i}`).toBe(true);
        expect(await entry.boundingBox()).toEqual(before);
      }
    }
  }
});

test('hover : contrôles communs des pages, compte synthétique et préférences', async ({ page }) => {
  test.setTimeout(90000);
  for (const file of ['index.html', 'mes-cours.html', 's-exercer.html', 'outils.html', 'uc.html?id=uc3', 'cours.html?id=matiere-organique', 'exercices.html?id=matiere-organique', 'drill.html', 'itk.html', 'ressources.html', 'reconnaissance-plantes.html', 'tableau-de-bord.html', 'calendrier.html', 'connexion.html', 'mot-de-passe-oublie.html', 'authentification.html', 'contact.html', 'confidentialite.html', 'profil.html']) {
    if (file === 'profil.html') await createSettingsAPI().install(page.context(), 'A');
    await page.goto(prefix + file); await page.evaluate(() => document.fonts.ready);
    if (file === 'profil.html') await waitForIdentity(page, accounts.A.id);
    for (const selector of ['.btn-primary', '.btn-outline', '.btn-quiet', '.option', '.resource-filter', '.standalone-nav a']) {
      const target = page.locator(selector).first();
      if (!await target.isVisible()) continue;
      const result = await sampleHover(page, target, 250);
      const opaque = result.initial.color.startsWith('rgb(');
      for (const frame of result.frames) {
        if (result.initial.image !== 'none') expect(frame.image, `${file}/${selector}`).not.toBe('none');
        else if (opaque) expect(frame.color, `${file}/${selector}: transparent flash`).toMatch(/^rgb\(/);
      }
    }
  }
  await page.goto(prefix);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.locator('[data-revision-start]').evaluate(node => getComputedStyle(node).transitionDuration)).toBe('0s');
});
