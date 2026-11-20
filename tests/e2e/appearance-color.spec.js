import { test, expect } from '@playwright/test';

const mount = '/mon-bprea/';
const day = new Date('2026-11-20T11:00:00Z');
const saved = 'bprea-demo-appearance-device-v1';
const active = page => page.evaluate(() => window.BpreaAppearance.getState().color);
const dialog = page => page.getByRole('dialog', { name: 'Ton apparence' });

async function openPicker(page) {
  await page.goto(mount + 'profil.html#parametres');
  await expect.poll(() => page.evaluate(() => window.BpreaAppearance.getSource())).toBe('device');
  await page.getByRole('button', { name: 'Régler l’apparence' }).click();
  return dialog(page);
}

test('roue tactile, réglages clavier, aperçu hexadécimal et retour réversible aux saisons', async ({ browser }, info) => {
  const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Paris', reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(day);
    const panel = await openPicker(page);
    const wheel = panel.locator('.appearance-wheel');
    const mode = panel.getByRole('combobox', { name: 'Couleurs' });
    const hex = panel.getByRole('textbox', { name: 'Code hexadécimal' });
    await expect(wheel).toBeHidden();
    await mode.selectOption('custom');
    await expect(wheel).toBeVisible();
    await wheel.tap({ position: { x: 120, y: 39 } });
    await expect.poll(() => active(page)).not.toBe('#286640');
    const hue = panel.getByRole('slider', { name: 'Teinte', exact: true });
    const saturation = panel.getByRole('slider', { name: 'Saturation', exact: true });
    const value = panel.getByRole('slider', { name: 'Luminosité de la couleur' });
    await hue.press('Home');
    await saturation.press('End');
    await value.press('End');
    await expect(hex).toHaveValue('#ff0000');
    await hex.fill('#FF00F0');
    await expect.poll(() => active(page)).toBe('#ff00f0');
    expect(await page.evaluate(key => localStorage.getItem(key), saved)).toBeNull();
    await hex.press('Enter');
    await hex.fill('invalid');
    await hex.press('Enter');
    await expect(hex).toHaveAttribute('aria-invalid', 'true');
    await expect.poll(() => active(page)).toBe('#ff00f0');
    await hex.fill('#ff00f0');
    await hex.press('Enter');

    const season = panel.getByRole('combobox', { name: 'Saison' });
    const brightness = panel.getByRole('combobox', { name: 'Luminosité', exact: true });
    for (const choice of ['spring', 'summer', 'autumn', 'winter']) {
      await season.selectOption(choice);
      await expect(page.locator('html')).toHaveAttribute('data-season', choice);
      await expect.poll(() => active(page)).toBe('#ff00f0');
    }
    await brightness.selectOption('dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await panel.screenshot({ path: info.outputPath('roue-mobile-sombre.png') });
    await mode.selectOption('seasonal');
    await expect(wheel).toBeHidden();
    await expect(page.locator('html')).not.toHaveAttribute('data-color-mode', 'custom');
    await mode.selectOption('custom');
    await expect(hex).toHaveValue('#ff00f0');
    await panel.getByRole('button', { name: 'Mémoriser mon apparence sur cet appareil' }).click();
    await page.reload();
    await expect.poll(() => active(page)).toBe('#ff00f0');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-season', 'winter');
  } finally { await context.close(); }
});

test('gamme des couleurs, contrastes AA, reflow et couleurs forcées', async ({ page }, info) => {
  await page.clock.setFixedTime(day);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const panel = await openPicker(page);
  await panel.getByRole('combobox', { name: 'Couleurs' }).selectOption('custom');
  const checks = await page.evaluate(() => {
    const appearance = window.BpreaAppearance;
    const sample = document.createElement('span');
    document.body.append(sample);
    const canvas = new OffscreenCanvas(1, 1);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const luminance = token => {
      sample.style.color = 'var(' + token + ')';
      ctx.fillStyle = getComputedStyle(sample).color;
      ctx.fillRect(0, 0, 1, 1);
      const rgb = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map(n => n / 255)
        .map(n => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4);
      return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    };
    const pairs = [
      ['--color-text', '--color-bg', 4.5], ['--color-text', '--color-surface', 4.5],
      ['--color-muted', '--color-surface-soft', 4.5], ['--color-accent', '--color-accent-soft', 4.5],
      ['--color-on-accent', '--color-accent-fill', 4.5], ['--color-on-accent', '--color-accent-fill-hover', 4.5],
      ['--color-control-border', '--color-surface-soft', 3], ['--color-focus', '--color-surface-soft', 3],
      ['--color-accent-fill', '--color-surface-soft', 3],
      ['--color-error', '--color-error-bg', 4.5], ['--color-success', '--color-success-bg', 4.5],
      ['--color-warning', '--color-warning-bg', 4.5],
    ];
    const minima = Object.fromEntries(pairs.map(([fg, bg]) => [fg + '/' + bg, Infinity]));
    const failures = [];
    for (const brightness of ['light', 'dark']) {
      appearance.updatePreferences({ brightness });
      for (const color of ['#ffffff', '#000000', '#eeee20', '#aaaaaa', '#ff0000', '#ff8000', '#ffff00', '#80ff00', '#00ff00', '#00ff80', '#00ffff', '#0080ff', '#0000ff', '#8000ff', '#ff00ff', '#ff0080', '#001200', '#321212']) {
        appearance.previewColor(color);
        for (const [fg, bg, threshold] of pairs) {
          const l = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
          const ratio = (l[0] + .05) / (l[1] + .05);
          const key = fg + '/' + bg;
          minima[key] = Math.min(minima[key], ratio);
          if (ratio < threshold) failures.push({ brightness, color, fg, bg, ratio });
        }
      }
    }
    appearance.previewColor(null);
    sample.remove();
    return { minima, failures };
  });
  expect(checks.failures).toEqual([]);
  await info.attach('contrastes', { body: JSON.stringify(checks.minima, null, 2), contentType: 'application/json' });

  const code = panel.getByRole('textbox', { name: 'Code hexadécimal' });
  await code.fill('#5d36ff'); await code.press('Enter');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const boxes = await panel.evaluate(node => [document.documentElement.scrollWidth, innerWidth, node.scrollWidth, node.clientWidth]);
    expect(boxes[0], 'page ' + width).toBeLessThanOrEqual(boxes[1]);
    expect(boxes[2], 'dialogue ' + width).toBeLessThanOrEqual(boxes[3]);
  }
  await panel.screenshot({ path: info.outputPath('roue-bureau.png') });
  await page.setViewportSize({ width: 320, height: 680 });
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await expect(panel.getByRole('slider', { name: 'Teinte', exact: true })).toBeVisible();
  await expect(code).toHaveAccessibleName('Code hexadécimal');
  await expect(code).toHaveCSS('transition-duration', '0s');
  await panel.screenshot({ path: info.outputPath('roue-couleurs-forcees.png') });
});

test('les pages principales héritent de la palette choisie et gardent leur largeur', async ({ page }, info) => {
  test.setTimeout(60000);
  await page.clock.setFixedTime(day);
  await page.addInitScript(key => localStorage.setItem(key, JSON.stringify({
    version: 1, season: 'auto', brightness: 'dark', colorMode: 'custom', customColor: '#644ef1',
  })), saved);
  for (const route of ['index.html', 'mes-cours.html', 'cours.html?id=matiere-organique', 'exercices.html?id=matiere-organique',
    'drill.html', 'tableau-de-bord.html', 'calendrier.html', 'itk.html', 'ressources.html', 'reconnaissance-plantes.html', 'profil.html']) {
    await page.goto(mount + route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect.poll(() => active(page)).toBe('#644ef1');
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth), route + ' ' + width).toBeLessThanOrEqual(width + 1);
    }
    if (['index.html', 'itk.html', 'tableau-de-bord.html', 'profil.html'].includes(route))
      await page.screenshot({ path: info.outputPath(route.replace('.html', '') + '-personnalise.png'), animations: 'disabled' });
  }
});
