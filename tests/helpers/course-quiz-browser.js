import { expect } from '@playwright/test';

export async function openCourseQuizSettings(page) {
  const target = new URL('profil.html#donnees-synchronisation', page.url());
  if (new URL(page.url()).pathname !== target.pathname) await page.goto(target.href);
  await expect(page.locator('#donnees-synchronisation .course-quiz-panel')).toBeVisible();
}

/** Exercise the public management path, then return to the pedagogical page. */
export async function refreshCourseQuiz(page) {
  const previous = page.url();
  await openCourseQuizSettings(page);
  await page.getByRole('button', { name: 'Actualiser la progression', exact: true }).click();
  await expect(page.locator('#course-quiz-sync-status')).toHaveText('Synchronisé');
  if (page.url() !== previous) {
    await page.goto(previous);
    await expect(page.locator('#course-quiz-sync-status')).toHaveText('Synchronisé');
  }
}
