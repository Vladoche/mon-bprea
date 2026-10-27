import { expect } from '@playwright/test';
import { personalRecords } from './personal-browser.js';

export const itkPath = '/mon-bprea/itk.html';
export const itkParameters = Object.freeze({ crop: 'tomate', variety: 'Marmande', cover: 'serre', area: '100', month: '5', year: '2028', soil: 'limoneux', water: 'standard' });
export async function settingsAction(page, action, ...args) {
  return page.evaluate(async ({ action, args }) => {
    const app = new URL(document.querySelector('script[type="module"][src]').src);
    const url = new URL('./settings-service.js', app); url.search = app.search;
    const service = await (await import(url.href)).getSettingsService();
    return action === 'state' ? service.getState() : service[action](...args);
  }, { action, args });
}
export const settingsSynced = page => expect.poll(async () => (await settingsAction(page, 'state')).sync.state).toBe('synced');
export const settingsCacheReady = (page, userId) => expect.poll(async () => {
  const state = await settingsAction(page, 'state');
  return { mode: state.mode, error: state.view.error, owner: state.scope ? JSON.parse(state.scope)[2] : null };
}).toEqual({ mode: 'personal', error: null, owner: userId });
export async function generateItk(page, values = itkParameters) {
  await page.locator('#crop').selectOption(values.crop);
  for (const key of ['variety', 'cover', 'month', 'year', 'soil', 'water']) await page.locator(`#${key}`).selectOption(values[key]);
  await page.locator('#area').fill(values.area);
  await page.getByRole('button', { name: /Générer mon itinéraire/ }).click();
  await expect(page.locator('#csv-export')).toBeVisible();
}
export async function expectItk(page, values) {
  for (const [key, value] of Object.entries(values)) await expect(page.locator(`#${key}`)).toHaveValue(value);
}
export async function chooseAppearance(page, season, brightness) {
  if (!await page.locator('#appearance-dialog').isVisible()) await page.locator('#appearance-open').click();
  await page.locator('#appearance-season').selectOption(season);
  await page.locator('#appearance-brightness').selectOption(brightness);
}
export async function closeAppearance(page) {
  await page.locator('#appearance-dialog').press('Escape');
  await expect(page.locator('#appearance-open')).toBeFocused();
}
export async function settingsRecords(page) {
  return personalRecords(page, 'mon-bprea-settings-personal-v1');
}
