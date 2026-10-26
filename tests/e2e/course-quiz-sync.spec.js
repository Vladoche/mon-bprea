// HTTP simulation of the real browser client. Auth/RLS proof remains in the
// separately guarded e2e-supabase suite using PostgreSQL.
import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { lessons } from '../../assets/content.js';
import { accounts, createCourseQuizAPI } from './course-quiz-api.js';
import { makeSeries, answerFor } from '../fixtures/drill.js';

const lesson = lessons[0];
const course = `/cours.html?id=${lesson.id}`;
const quiz = `/exercices.html?id=${lesson.id}`;
const now = new Date('2026-10-25T10:00:00.000Z');
const synced = page => expect(page.locator('#course-quiz-sync-status')).toHaveText('Synchronisé');
const refresh = async page => { await page.getByRole('button', { name: 'Actualiser la progression', exact: true }).click(); await synced(page); };
async function answer(page, score) {
  for (const [i, question] of lesson.quiz.entries()) await page.locator(`input[name="q${i}"][value="${i < score ? question.answer : (question.answer + 1) % question.options.length}"]`).check();
  await page.locator('#check-quiz').click();
  await expect(page.locator('#quiz-result')).toContainText('Progression enregistrée sur cet appareil.');
}
async function capture(page, name) {
  await mkdir('.tmp/course-quiz-visual', { recursive: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `.tmp/course-quiz-visual/${name}.png`, fullPage: true, animations: 'disabled' });
}
async function setTheme(page, value) {
  if (await page.locator('html').getAttribute('data-theme') !== value) await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', value);
}
test.beforeEach(async ({ page }) => { await page.clock.install({ time: now }); });

test('deux appareils partagent cours réversibles et tentatives distinctes, avec meilleur score conservé', async ({ page, browser }) => {
  const api = createCourseQuizAPI(); await api.install(page.context());
  const secondContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4173/', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  await api.install(secondContext); const second = await secondContext.newPage(); await second.clock.install({ time: now });
  try {
    await page.goto(course); await synced(page);
    await page.locator('#mark-done').check(); await synced(page);
    await second.goto(course); await synced(second); await expect(second.locator('#mark-done')).toBeChecked();
    await second.locator('#mark-done').uncheck(); await synced(second);
    await refresh(page); await expect(page.locator('#mark-done')).not.toBeChecked();
    await page.goto(quiz); await synced(page); await answer(page,3); await synced(page);
    await page.getByRole('button', { name: 'Recommencer', exact: true }).click(); await answer(page,1); await synced(page);
    await expect(page.locator('#quiz-best-score')).toHaveText('3'); await expect(page.locator('#quiz-history li')).toHaveCount(2);
    await second.goto(quiz); await synced(second);
    await expect(second.locator('#quiz-best-score')).toHaveText('3'); await expect(second.locator('#quiz-history li')).toHaveCount(2);
    expect(api.attempts.size).toBe(2);
    const choice = second.locator('input[name="q0"]').first();
    await choice.check(); await choice.focus();
    await second.evaluate(async () => { const service = await (await import('/assets/course-quiz-service.js')).getCourseQuizService(); await service.retry(); });
    await synced(second); await expect(choice).toBeFocused(); await expect(choice).toBeChecked();
    await capture(second,'personal-desktop-light');
    await setTheme(second,'dark');
    await capture(second,'personal-desktop-dark');
    await second.setViewportSize({ width: 390, height: 844 });
    await setTheme(second,'light');
    await capture(second,'personal-mobile-light');
  } finally { await secondContext.close(); }
});

test('une perte d’acquittement et un rechargement hors réseau gardent une seule tentative durable', async ({ page }) => {
  const api = createCourseQuizAPI(); await api.install(page.context());
  await page.goto(quiz); await synced(page);
  api.loseQuizAck = true;
  await answer(page,2);
  await expect(page.locator('#course-quiz-sync-status')).toContainText('Connexion indisponible');
  api.restOffline = true;
  await page.reload();
  await expect(page.locator('#quiz-history li')).toHaveCount(1);
  await expect(page.locator('#quiz-best-score')).toHaveText('2');
  await expect(page.locator('#course-quiz-sync-status')).toContainText('Connexion indisponible');
  await page.setViewportSize({ width: 1280, height: 900 }); await setTheme(page,'light');
  await capture(page,'personal-offline-desktop');
  await setTheme(page,'dark');
  await expect(page.locator('#course-quiz-sync-status')).toContainText('Connexion indisponible');
  await capture(page,'personal-offline-desktop-dark');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#course-quiz-sync-status')).toContainText('Connexion indisponible');
  await capture(page,'personal-offline-mobile-dark');
  await setTheme(page,'light');
  await expect(page.locator('#course-quiz-sync-status')).toContainText('Connexion indisponible');
  await capture(page,'personal-offline-mobile-light');
  api.restOffline = false; await refresh(page);
  await expect(page.locator('#quiz-history li')).toHaveCount(1); expect(api.attempts.size).toBe(1);
  const calls = api.sent.filter(item => item.url.endsWith('/personal_record_quiz'));
  expect(new Set(calls.map(item => item.body.p_attempt_id)).size).toBe(1);
});

test('le changement A vers B masque résultats et réponses en cours puis restitue le cache de A', async ({ page }) => {
  const api = createCourseQuizAPI(); await api.install(page.context());
  await page.goto(quiz); await synced(page); await answer(page,3); await synced(page);
  await page.getByRole('button', { name: 'Recommencer', exact: true }).click();
  await page.locator('input[name="q0"]').first().check();
  await page.locator('header').getByRole('button', { name: 'Déconnexion', exact: true }).click();
  await expect(page.locator('#course-quiz-sync-status')).toContainText('visiteur');
  await expect(page.locator('#quiz-history li')).toHaveCount(0); await expect(page.locator('#quiz-result')).toBeEmpty();
  await expect(page.locator('#quiz-questions input:checked')).toHaveCount(0);
  await page.evaluate(async email => { const auth = await (await import('/assets/auth-service.js')).getAuthService(); await auth.signIn(email,'synthetic-password'); }, accounts.B.email);
  await synced(page); await expect(page.locator('#quiz-best-score')).toHaveText('—');
  await answer(page,1); await synced(page); await expect(page.locator('#quiz-history li')).toHaveCount(1);
  await page.evaluate(async email => { const auth = await (await import('/assets/auth-service.js')).getAuthService(); await auth.signOut(); await auth.signIn(email,'synthetic-password'); }, accounts.A.email);
  await synced(page); await expect(page.locator('#quiz-best-score')).toHaveText('3'); await expect(page.locator('#quiz-history li')).toHaveCount(1);
  expect(new Set([...api.attempts.values()].map(item => item.user_id)).size).toBe(2);
});

test('import volontaire : prévisualisation, annulation et manifeste réutilisé sans toucher la source', async ({ page }) => {
  const oldAttempt = { score: 2, total: 3, completedAt: '2026-10-20T10:00:00.000Z' };
  const raw = JSON.stringify({ [lesson.id]: { done: false, score: 3, legacyQuizScore: { score: 3, total: 3 }, quizAttempts: [oldAttempt,oldAttempt], unknown: 'conservé', quizScoreArchive: ['illlisible'] }, progressArchive: ['ancienne source'] });
  const api = createCourseQuizAPI(); await api.install(page.context(),'A',raw);
  await page.goto(quiz); await synced(page); await expect(page.locator('#quiz-history li')).toHaveCount(0); expect(api.attempts.size).toBe(0);
  const open = () => page.getByRole('button', { name: 'Importer l’historique de cet appareil', exact: true }).click();
  await open(); const dialog = page.getByRole('dialog', { name: 'Importer les cours et QCM locaux' });
  await expect(dialog).toContainText('pas nécessairement liée au compte');
  await expect(dialog).toContainText('Tentatives QCM exploitables');
  await page.getByRole('button', { name: 'Annuler', exact: true }).click(); expect(api.attempts.size).toBe(0);
  await open(); await capture(page,'import-desktop-light');
  await page.setViewportSize({ width: 390, height: 844 }); await capture(page,'import-mobile-light');
  await page.getByRole('button', { name: 'Annuler', exact: true }).click(); await setTheme(page,'dark'); await open(); await capture(page,'import-mobile-dark');
  await page.setViewportSize({ width: 1280, height: 900 }); await capture(page,'import-desktop-dark');
  await page.getByRole('button', { name: 'Confirmer l’import', exact: true }).click(); await synced(page);
  await expect(page.locator('#quiz-history li')).toHaveCount(2); expect(api.attempts.size).toBe(2);
  const ids = await page.locator('#quiz-history li').evaluateAll(rows => rows.map(row => row.dataset.attemptId)); expect(new Set(ids).size).toBe(2);
  await page.reload(); await synced(page); await open(); await page.getByRole('button', { name: 'Confirmer l’import', exact: true }).click();
  await expect(page.locator('#course-quiz-action-message')).toContainText('déjà enregistré');
  await expect(page.locator('#quiz-history li')).toHaveCount(2); expect(api.attempts.size).toBe(2);
  expect(await page.evaluate(() => localStorage.getItem('bprea-demo-progress-v1'))).toBe(raw);
});

test('conflit explicite, focus stable et choix conservé avec nouvel UUID sur mobile sombre', async ({ page }) => {
  const api = createCourseQuizAPI(); await api.install(page.context());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('bprea-demo-appearance-v1', JSON.stringify({ version: 1, season: 'winter', brightness: 'dark' })));
  await page.goto(course); await synced(page);
  await page.locator('#mark-done').check(); await synced(page);
  api.restOffline = true;
  await page.locator('#mark-done').uncheck(); await expect(page.locator('#course-quiz-sync-status')).toContainText('Connexion indisponible');
  const key = `${accounts.A.id}:${lesson.id}`, row = api.courses.get(key);
  api.courses.set(key, { ...row, operation_id: '63200000-0000-4000-8000-000000000099', base_revision: row.revision, revision: row.revision + 1 });
  api.restOffline = false;
  await page.getByRole('button', { name: 'Actualiser la progression', exact: true }).click();
  await expect(page.locator('#course-quiz-sync-status')).toContainText('Conflit');
  const details = page.locator('.course-quiz-conflict'); await details.locator('summary').click();
  await capture(page,'conflict-mobile-dark');
  await setTheme(page,'light'); await capture(page,'conflict-mobile-light');
  await page.setViewportSize({ width: 1280, height: 900 }); await capture(page,'conflict-desktop-light');
  await setTheme(page,'dark'); await capture(page,'conflict-desktop-dark');
  await page.setViewportSize({ width: 390, height: 844 });
  const choice = page.getByRole('button', { name: 'Conserver mon choix', exact: true }); await choice.focus();
  await choice.click(); await synced(page); await expect(page.locator('#mark-done')).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Actualiser la progression', exact: true })).toBeFocused();
  const updates = api.sent.filter(item => item.url.endsWith('/personal_save_course'));
  expect(updates.at(-1).body.p_operation_id).not.toBe(updates.at(-2).body.p_operation_id);
  await capture(page,'personal-mobile-dark');
});

test('mode visiteur local et bandeau examen personnel sans mélange avec le Drill visiteur', async ({ page }) => {
  await page.goto(quiz);
  await expect(page.locator('#course-quiz-sync-status')).toContainText('visiteur');
  await answer(page,2); await expect(page.locator('#quiz-history li')).toHaveCount(1);
  await page.reload(); await expect(page.locator('#quiz-history li')).toHaveCount(1);
  await capture(page,'visitor-desktop-light');
  await setTheme(page,'dark'); await capture(page,'visitor-desktop-dark');
  await page.setViewportSize({ width: 390, height: 844 }); await capture(page,'visitor-mobile-dark');
  await setTheme(page,'light'); await capture(page,'visitor-mobile-light');
  const series = makeSeries();
  series.answers[series.questions[0].id] = answerFor(series.questions[0]);
  await page.evaluate(value => localStorage.setItem('bprea-demo-drill-v1', JSON.stringify(value)), { version: 1, series: { [series.id]: series } });
  await page.route('**/assets/calendar-events.json*', route => route.fulfill({ json: { version: 1, events: [{ id: 'exam-synthetic', type: 'examen', unit: 'uc3', title: 'Examen de la recette cours', start: '2026-10-26' }] } }));
  const api = createCourseQuizAPI(); await api.install(page.context());
  // The earlier navigation already seeded no fixture; this first API-enabled
  // page now receives account A, whose empty course history remains separate.
  await page.goto('/'); await synced(page);
  await expect(page.locator('[data-progress-total-done]')).toHaveText('0');
  await expect(page.locator('.exam-metric').nth(1)).toContainText('Aucune tentative historisée');
  await expect(page.locator('.exam-drill')).toContainText('Aucune série d’exercices hebdomadaires commencée');
  await expect(page.locator('.exam-drill')).not.toContainText('1 réponses comptabilisées');
  expect(api.attempts.size).toBe(0);
});

test('un échec IndexedDB refuse le succès de sauvegarde puis permet une reprise explicite', async ({ page }) => {
  const api = createCourseQuizAPI(); await api.install(page.context());
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(...args) {
      if (window.courseQuizStorageFull && this.transaction.db.name === 'mon-bprea-course-quiz-personal-v1') throw new DOMException('Synthetic full storage','QuotaExceededError');
      return put.apply(this,args);
    };
  });
  await page.goto(quiz); await synced(page);
  await page.evaluate(() => window.courseQuizStorageFull = true);
  for (const [i,question] of lesson.quiz.entries()) await page.locator(`input[name="q${i}"][value="${question.answer}"]`).check();
  await page.locator('#check-quiz').click();
  await expect(page.locator('#quiz-result')).toContainText('Erreur de sauvegarde');
  await expect(page.locator('#quiz-result')).not.toContainText('intention de terminer');
  await expect(page.locator('#quiz-history li')).toHaveCount(0); expect(api.attempts.size).toBe(0);
  await expect(page.locator('#quiz-result')).toBeFocused();
  await page.evaluate(() => window.courseQuizStorageFull = false);
  await page.getByRole('button', { name: 'Réessayer l’enregistrement', exact: true }).click();
  await expect(page.locator('#quiz-result')).toContainText('Progression enregistrée sur cet appareil.'); await synced(page);
  await expect(page.locator('#quiz-history li')).toHaveCount(1); expect(api.attempts.size).toBe(1);
});
