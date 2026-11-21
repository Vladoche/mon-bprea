import { test, expect } from '@playwright/test';

test.use({ channel: 'chromium', launchOptions: { ignoreDefaultArgs: ['--disable-back-forward-cache'] } });

test('S’exercer relit les réponses Drill validées avant le retour arrière', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-16T11:00:00Z') });
  await page.route('**/s-exercer.html', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'cache-control': 'private, max-age=60' } });
  });
  await page.goto('/mon-bprea/s-exercer.html');
  const completed = page.locator('.hub-weekly-metrics dd').first();
  await expect(completed).toHaveText('0');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => addEventListener('pageshow', event => {
    if (event.persisted) sessionStorage.setItem('practice-restored', 'yes');
  }));
  await page.locator('.hub-practice-start a').click();
  await page.getByRole('button', { name: 'Commencer cette série' }).click();
  const question = page.locator('form[data-question][data-training="false"]').first();
  await question.getByRole('radio').first().check();
  await question.getByRole('button', { name: 'Valider cette réponse' }).click();
  await expect(page.locator('.drill-correction')).toBeVisible();

  try { await page.goBack({ waitUntil: 'commit' }); }
  catch (error) { if (!error.message.includes('net::ERR_ABORTED')) throw error; }
  await expect(completed).toHaveText('1');
  expect(await page.evaluate(() => sessionStorage.getItem('practice-restored'))).toBe('yes');
});
