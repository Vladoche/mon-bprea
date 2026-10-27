import { expect } from '@playwright/test';
import { personalRecords } from './personal-browser.js';
import { readFileSync } from 'node:fs';

export const botanicalBank = JSON.parse(readFileSync(new URL('../../assets/botanical-bank.json', import.meta.url), 'utf8'));
export const botanicalStorageKey = 'monbprea.botanical.v1';
export const botanicalPath = '/mon-bprea/reconnaissance-plantes.html';
export const botanicalSynced = page => expect(page.locator('#botanical-sync-status')).toHaveText(/synchronisé$/i);
export async function refreshBotanical(page) {
  await page.getByRole('button', { name: 'Actualiser l’historique', exact: true }).click();
  await botanicalSynced(page);
}
export async function startBotanical(page, { mode = 'discovery', duration = '15', revision = false } = {}) {
  const categories = page.getByRole('group', { name: 'Catégories botaniques' });
  await expect(categories).toBeVisible();
  const buttons = categories.getByRole('button');
  for (const button of await buttons.all()) if (await button.isEnabled()) { await button.click(); break; }
  await page.getByRole('radio', { name: mode === 'chrono' ? /^Chrono/ : /^Découverte/ }).check();
  if (mode === 'chrono') await page.getByRole('combobox', { name: 'Durée par question' }).selectOption(duration);
  if (revision) await page.getByRole('checkbox', { name: /Revoir mes erreurs dans cette catégorie/ }).check();
  await page.getByRole('button', { name: 'Commencer la session' }).click();
}
export async function currentBotanicalPhoto(page) {
  const image = page.getByRole('img', { name: /^Photographie à identifier/ });
  await expect(image).toBeVisible();
  const photoId = await image.getAttribute('data-photo-id');
  const photo = botanicalBank.photos.find(item => item.id === photoId);
  expect(photo).toBeDefined();
  return { image, photo, plant: botanicalBank.species.find(item => item.id === photo.speciesId) };
}
export async function answerBotanical(page, correct = true) {
  const current = await currentBotanicalPhoto(page);
  const options = page.getByRole('group', { name: 'Quatre propositions' });
  const choice = correct ? options.getByRole('button', { name: current.plant.commonName, exact: true })
    : options.getByRole('button').filter({ hasNotText: current.plant.commonName }).first();
  await choice.click();
  await page.getByRole('button', { name: 'Valider ma réponse' }).click();
  await expect(page.locator('#bot-feedback')).toContainText(correct ? 'Réponse correcte' : 'Réponse incorrecte');
  return current;
}
export async function nextBotanical(page) { await page.getByRole('button', { name: /Question suivante|Voir les résultats/ }).click(); }
export async function finishBotanical(page) {
  await page.getByRole('button', { name: 'Terminer cette session', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Résultats de la session', exact: true })).toBeVisible();
}
export function botanicalMetric(root, label) {
  return root.getByRole('term').filter({ hasText: new RegExp(`^${label}$`) }).locator('..').getByRole('definition');
}
export async function expectBotanicalHistory(page, { attempted, correct, incorrect, timeouts, rate }) {
  const history = page.locator('#bot-history');
  if ((await history.locator('details').getAttribute('open')) === null) await history.locator('summary').click();
  if (attempted === 0) return expect(history).toContainText('Aucune question réalisée');
  for (const [label, value] of Object.entries({ 'Questions réalisées': attempted, 'Réponses correctes': correct, 'Réponses incorrectes': incorrect, 'Temps écoulés': timeouts, 'Taux de reconnaissance': rate })) {
    if (value !== undefined) await expect(botanicalMetric(history, label)).toHaveText(String(value));
  }
}
export async function botanicalRecords(page) {
  return personalRecords(page, 'mon-bprea-botanical-personal-v1');
}
