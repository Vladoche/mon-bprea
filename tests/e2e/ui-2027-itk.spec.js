import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { downloadItkCsv, itkScenarios, readItkResult } from '../helpers/itk-result.js';
import { expectItk, generateItk, itkPath } from '../helpers/settings-browser.js';

const { results } = JSON.parse(await readFile(new URL('../fixtures/itk-reference.json', import.meta.url), 'utf8'));
const submit = page => page.getByRole('button', { name: 'Générer mon itinéraire' });
const resultTitle = page => page.locator('#itk-result-title');
const noOverflow = page => expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);

for (const [scenario, inputs] of Object.entries(itkScenarios)) {
  test(`ITK ${scenario} : synthèse, calcul, avertissements, jalons et CSV identiques à main`, async ({ page }) => {
    await page.goto(itkPath);
    await generateItk(page, inputs);
    await expectItk(page, inputs);
    await expect(page.locator('#itk-output')).toContainText('Scénario pédagogique');
    const { bytes, ...csv } = await downloadItkCsv(page);
    expect({ ...await readItkResult(page), csv }).toEqual(results[scenario]);
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(bytes.toString('utf8').split('\r\n')[0]).toBe('\uFEFF"Période";"Opération";"Description"');
    expect(bytes.toString('utf8').split('\r\n')).toHaveLength(results[scenario].timeline.length + 1);
  });
}

test('de l’accueil au résultat, reprise clavier, validation native, recalcul et impression', async ({ page }) => {
  await page.goto('/mon-bprea/');
  await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Outils', exact: true }).click();
  await page.getByRole('link', { name: /Générateur ITK/ }).last().click();
  await expect(page).toHaveURL(/\/mon-bprea\/itk\.html/);
  await expect(page.getByRole('heading', { name: 'Ton itinéraire technique' })).toBeVisible();
  await expect(page.locator('#csv-export')).toHaveCount(0);
  await expect(page.locator('#month option')).toHaveCount(12);
  expect(await page.locator('#year option').allTextContents()).toEqual(['2026', '2027', '2028', '2029', '2030', '2031', '2032', '2033']);

  await page.locator('#crop').focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('#variety')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#crop')).toBeFocused();
  for (const value of ['0', '100001', '1.5', '']) {
    await page.locator('#area').fill(value);
    await page.locator('#area').press('Enter');
    await expect(page.locator('#area')).toBeFocused();
    await expect(page.locator('#area')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#area')).toHaveAccessibleDescription(/Saisis une surface entière/);
    await expect(page.locator('#itk-area-error')).toBeVisible();
    await expect(page.locator('#csv-export')).toHaveCount(0);
  }
  await page.locator('#crop').selectOption('courgette');
  await expect(page.locator('#variety')).toHaveValue('Black Beauty');
  await page.locator('#variety').selectOption('Ronde de Nice');
  await page.locator('#area').fill('375');
  await expect(page.locator('#itk-area-error')).toBeHidden();
  await expect(page.locator('#area')).toHaveAccessibleDescription('Hors allées et espaces techniques.');
  await page.locator('#area').press('Enter');
  await expect(resultTitle(page)).toHaveText('Courgette · Ronde de Nice');
  await expect(resultTitle(page)).toBeFocused();
  await page.getByRole('link', { name: 'Modifier les paramètres' }).press('Enter');
  await expect(page.locator('#crop')).toBeFocused();
  await page.locator('#crop').selectOption('carotte');
  await expect(page.locator('#variety')).toHaveValue('Nantaise');
  await expect(resultTitle(page)).toHaveText('Courgette · Ronde de Nice');
  await submit(page).press('Enter');
  await expect(resultTitle(page)).toHaveText('Carotte · Nantaise');
  await page.getByRole('link', { name: 'Aller aux exports' }).press('Enter');
  await expect(page.locator('#csv-export')).toBeFocused();

  await page.evaluate(() => { window.print = () => { window.printRequested = true; }; });
  await page.locator('#print-itk').press('Enter');
  await expect.poll(() => page.evaluate(() => window.printRequested)).toBe(true);
  await page.emulateMedia({ media: 'print' });
  for (const selector of ['#app-header', '#app-footer', '#itk-form', '#itk-sync-panel', '#csv-export', '#print-itk', '.itk-result-links']) {
    await expect(page.locator(selector)).toBeHidden();
  }
  for (const selector of ['.itk-culture-summary', '.metric-grid', '.warning-block', '.timeline', '.result-disclaimer']) {
    await expect(page.locator(selector)).toBeVisible();
  }
  const pdf = await page.pdf({ format: 'A4' });
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
});

test('repli à cinq largeurs, contraste forcé et focus sans mouvement', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await page.goto(itkPath);
  await expect(page.locator('#itk-remember')).toBeDisabled();
  await generateItk(page, itkScenarios.carotte);
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await noOverflow(page);
    await expect(page.locator('.timeline-entry')).toHaveCount(6);
    const form = await page.locator('.itk-form-panel').boundingBox();
    const result = await page.locator('.itk-result-panel').boundingBox();
    if (width <= 768) expect(result.y).toBeGreaterThan(form.y + form.height);
    else expect(result.y).toBe(form.y);
  }
  await page.locator('#year').focus();
  await page.keyboard.press('Tab');
  await expect(submit(page)).toBeFocused();
  await expect(submit(page)).toHaveCSS('outline-style', 'solid');
  await expect(submit(page)).toHaveCSS('outline-width', '3px');
  await expect(submit(page)).toHaveCSS('transition-duration', '0s');
});

test.describe('ITK tactile', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  test('générer, revenir à la culture et ouvrir l’export sur smartphone', async ({ page }) => {
    await page.goto(itkPath);
    await page.locator('#crop').selectOption('laitue');
    await page.locator('#variety').selectOption('Feuille de chêne');
    await submit(page).tap();
    await expect(resultTitle(page)).toHaveText('Laitue · Feuille de chêne');
    const downloaded = page.waitForEvent('download');
    await page.locator('#csv-export').tap();
    expect((await downloaded).suggestedFilename()).toBe('itk-laitue.csv');
    await page.getByRole('link', { name: 'Modifier les paramètres' }).tap();
    await expect(page.locator('#crop')).toBeFocused();
    await noOverflow(page);
  });
});
