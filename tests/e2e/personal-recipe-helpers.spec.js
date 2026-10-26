import { test, expect } from '@playwright/test';
import { answerDrillQuestion } from '../helpers/drill-browser.js';

test('recette transversale : démarrer la série Drill puis reprendre une question après rechargement', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T10:00:00.000Z') });
  await page.goto('/mon-bprea/drill.html?unit=uc3&week=2026-W42');
  await expect(page.locator('[data-drill-start]')).toContainText('Commencer cette série →');
  await answerDrillQuestion(page, 0);
  await expect(page.locator('.drill-correction')).toHaveCount(1);
  await page.reload();
  await answerDrillQuestion(page, 1);
  await expect(page.locator('.drill-correction')).toHaveCount(2);
  const document = await page.evaluate(() => JSON.parse(localStorage.getItem('bprea-demo-drill-v1')));
  expect(Object.keys(document.series['uc3__2026-W42'].answers)).toHaveLength(2);
});
