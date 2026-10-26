import { expect } from '@playwright/test';
import { bankQuestions } from '../fixtures/drill.js';

/** Wait for the rendered preview OR an existing series before choosing a path.
 * The preview's accessible label includes an arrow; its stable data attribute
 * avoids mistaking that label difference for a resumed series. */
export async function answerDrillQuestion(page, index = 0) {
  const start = page.locator('[data-drill-start]');
  const article = page.locator('.drill-question').nth(index);
  const form = article.locator('form[data-training="false"]');
  const startReady = () => start.and(page.locator(':enabled')).isVisible();
  await expect.poll(async () => await form.isVisible() || await startReady(), {
    timeout: 10000, message: 'Drill : attendre le démarrage proposé ou le formulaire de la série existante.',
  }).toBe(true);
  if (!await form.isVisible() && await startReady()) await start.click({ timeout: 10000 });
  await expect(form, 'Drill : formulaire de première réponse après démarrage/reprise.').toBeVisible({ timeout: 10000 });
  const id = await form.getAttribute('data-question', { timeout: 10000 });
  const question = bankQuestions().find(item => item.id === id);
  expect(question, 'Drill : la question affichée appartient à la banque publique.').toBeDefined();
  const option = question.options.find(item => item.id === question.answer);
  await form.getByRole('radio', { name: option.text, exact: true }).check({ timeout: 10000 });
  await form.getByRole('button', { name: 'Valider cette réponse', exact: true }).click({ timeout: 10000 });
  await expect(article.locator('.drill-correction')).toBeVisible({ timeout: 10000 });
}
