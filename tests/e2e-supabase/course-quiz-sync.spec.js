import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createDrillStudent, configureDrillPage, signInDrill } from '../helpers/drill-local.js';
import { LOCAL_SITE } from '../helpers/auth-local.js';
import { lessons } from '../../assets/content.js';
import { learningDocument } from '../fixtures/personal-data.js';
import { personalRecords } from '../helpers/personal-browser.js';

// All identity and SQL assertions use the existing guarded, ephemeral local
// fixture. No fabricated Auth response or privileged pedagogical assertion.
const lesson = lessons.find(item => item.id === 'matiere-organique');
const courseUrl = `${LOCAL_SITE}cours.html?id=${lesson.id}`;
const quizUrl = `${LOCAL_SITE}exercices.html?id=${lesson.id}`;
const synced = page => expect(page.locator('#course-quiz-sync-status')).toHaveText('Synchronisé');
const refresh = async page => { await page.getByRole('button', { name: 'Actualiser la progression', exact: true }).click(); await synced(page); };

async function signIn(page, student, url = courseUrl) {
  await signInDrill(page, student); await page.goto(url); await synced(page);
}
async function signOut(page) {
  await page.locator('header').getByRole('button', { name: 'Déconnexion', exact: true }).click();
  await expect(page.locator('#course-quiz-sync-status')).toContainText('visiteur');
}
async function answerQuiz(page, score) {
  for (const [index, question] of lesson.quiz.entries()) {
    const choice = index < score ? question.answer : (question.answer + 1) % question.options.length;
    await page.locator(`input[name="q${index}"][value="${choice}"]`).check();
  }
  await page.locator('#check-quiz').click();
  await expect(page.locator('#quiz-result')).toContainText(`${score} / ${lesson.quiz.length}`);
}
async function records(page) {
  return personalRecords(page, 'mon-bprea-course-quiz-personal-v1');
}
async function sqlRows(student, table) {
  await student.refresh();
  const result = await student.client.from(table).select('*').eq('user_id', student.userId);
  expect(result.error).toBeNull(); return result.data;
}
async function diagnostics(page) {
  try { return await page.locator('#course-quiz-sync-status').textContent(); }
  catch { return 'page indisponible'; }
}

test('Cours/QCM réels : deux appareils, décochage, scores et isolation A/B', async ({ page, browser }) => {
  test.setTimeout(120000);
  const students = []; const contexts = []; let stage = 'comptes locaux'; let failure;
  try {
    const a = await createDrillStudent(); students.push(a); const b = await createDrillStudent(); students.push(b);
    await configureDrillPage(page, a.environment); await signIn(page, a);
    stage = 'première création de cours'; await page.locator('#mark-done').check(); await synced(page);
    const context = await browser.newContext({ timezoneId: 'Europe/Paris', locale: 'fr-FR' }); contexts.push(context);
    const second = await context.newPage(); await configureDrillPage(second, a.environment); await signIn(second, a);
    await expect(second.locator('#mark-done')).toBeChecked();
    stage = 'décochage sur le deuxième appareil'; await second.locator('#mark-done').uncheck(); await synced(second);
    await refresh(page); await expect(page.locator('#mark-done')).not.toBeChecked();
    expect((await sqlRows(a, 'course_states'))[0].done).toBe(false);

    stage = 'deux QCM distincts et meilleur score'; await page.goto(quizUrl); await synced(page);
    await answerQuiz(page, 3); await synced(page); await page.locator('#retry-quiz').click();
    await answerQuiz(page, 1); await synced(page);
    await expect(page.locator('#quiz-history li')).toHaveCount(2);
    await expect(page.locator('#quiz-best-score')).toContainText('3');
    await second.goto(quizUrl); await synced(second);
    await expect(second.locator('#quiz-history li')).toHaveCount(2);
    await expect(second.locator('#quiz-best-score')).toContainText('3');
    expect(await sqlRows(a, 'quiz_attempts')).toHaveLength(2);
    // A perfect historical score must never resurrect an explicitly unchecked course.
    await second.goto(courseUrl); await synced(second); await second.locator('#mark-done').uncheck(); await synced(second);
    await page.goto(courseUrl); await synced(page); await expect(page.locator('#mark-done')).not.toBeChecked();

    stage = 'B sur le navigateur de A'; await signOut(page); await signIn(page, b, quizUrl);
    await expect(page.locator('#quiz-history li')).toHaveCount(0);
    await answerQuiz(page, 2); await synced(page); expect(await sqlRows(b, 'quiz_attempts')).toHaveLength(1);
    await signOut(page); await signIn(page, a, quizUrl); await expect(page.locator('#quiz-history li')).toHaveCount(2);
    const local = await records(page); expect(local).toHaveLength(2);
    stage = 'RLS B vers A et append-only'; await b.refresh();
    for (const table of ['course_states', 'quiz_attempts']) {
      const foreign = await b.client.from(table).select('*').eq('user_id', a.userId);
      expect(foreign.error).toBeNull(); expect(foreign.data).toEqual([]);
    }
    await a.refresh();
    const mutation = await a.client.from('quiz_attempts').update({ score: 0 }).eq('user_id', a.userId);
    expect(mutation.error).not.toBeNull(); expect(await sqlRows(a, 'quiz_attempts')).toHaveLength(2);
    const anonymous = createClient(a.environment.url, a.environment.publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    expect((await anonymous.from('quiz_attempts').select('*')).error).not.toBeNull();
    expect((await anonymous.rpc('personal_record_quiz', { p_attempt_id: randomUUID(), p_lesson_id: lesson.id, p_score: 1, p_total: 3, p_completed_at: '2026-10-21T12:00:00.000Z' })).error).not.toBeNull();
  } catch { failure = new Error(`Cours/QCM Supabase local non validés : ${stage}. État : ${await diagnostics(page)}. Aucune réponse Auth brute n’est publiée.`); }
  finally {
    for (const context of contexts) await context.close();
    for (const student of students.toReversed()) try { await student.cleanup(); } catch { failure = new Error('Nettoyage des seuls comptes fictifs cours/QCM incomplet.'); }
  }
  if (failure) throw failure;
});

test('QCM réels : perte HTTP après commit, outbox persistante puis reprise', async ({ page }) => {
  test.setTimeout(90000);
  let student; let stage = 'compte local'; let failure;
  try {
    student = await createDrillStudent(); await configureDrillPage(page, student.environment); await signIn(page, student, quizUrl);
    const sent = []; const pattern = '**/rest/v1/rpc/personal_record_quiz';
    const lost = async route => {
      sent.push(JSON.parse(route.request().postData()));
      const response = await route.fetch();
      if (sent.length === 1) await route.abort('failed'); else await route.fulfill({ response });
    };
    await page.route(pattern, lost); stage = 'acquittement perdu après PostgreSQL'; await answerQuiz(page, 2);
    await expect.poll(() => sent.length).toBeGreaterThanOrEqual(2); await synced(page);
    expect(sent[0]).toEqual(sent[1]); expect(await sqlRows(student, 'quiz_attempts')).toHaveLength(1);
    await page.unroute(pattern, lost);
    stage = 'panne réseau pendant un nouveau QCM'; await page.locator('#retry-quiz').click();
    const outage = route => route.abort('failed'); await page.route(`${student.environment.url}/**`, outage);
    await answerQuiz(page, 1); await expect(page.locator('#quiz-history li')).toHaveCount(2);
    await page.reload(); await expect(page.locator('#quiz-history li')).toHaveCount(2);
    await expect(page.locator('#course-quiz-sync-status')).toContainText(/attente|indisponible|appareil|hors ligne/i);
    stage = 'retour réseau après rechargement'; await page.unroute(`${student.environment.url}/**`, outage);
    await page.getByRole('button', { name: 'Actualiser la progression', exact: true }).click(); await synced(page);
    expect(await sqlRows(student, 'quiz_attempts')).toHaveLength(2);
    await page.reload(); await synced(page); await expect(page.locator('#quiz-history li')).toHaveCount(2);
  } catch { failure = new Error(`Reprise QCM Supabase locale non validée : ${stage}. État : ${await diagnostics(page)}.`); }
  finally { if (student) try { await student.cleanup(); } catch { failure = new Error('Nettoyage du compte fictif QCM incomplet.'); } }
  if (failure) throw failure;
});

test('Cours réel : conflit CAS et tentative parfaite conservée indépendamment', async ({ page }) => {
  test.setTimeout(90000);
  let student; let release = () => {}; let stage = 'compte local'; let failure;
  try {
    student = await createDrillStudent(); await configureDrillPage(page, student.environment); await signIn(page, student, quizUrl);
    let held = null; const waiting = new Promise(resolve => { release = resolve; });
    const hold = async route => { held = JSON.parse(route.request().postData()); await waiting; await route.continue(); };
    await page.route('**/rest/v1/rpc/personal_save_course', hold);
    stage = 'cours concurrent réellement créé'; await answerQuiz(page, 3); await expect.poll(() => held !== null).toBe(true);
    await student.refresh();
    const winner = await student.client.rpc('personal_save_course', { ...held, p_done: false, p_operation_id: randomUUID() });
    expect(winner.error).toBeNull(); expect(winner.data.status).toBe('inserted'); release();
    await expect(page.locator('#course-quiz-sync-status')).toContainText('Conflit');
    await page.unroute('**/rest/v1/rpc/personal_save_course', hold);
    stage = 'tentative acceptée malgré le conflit du cours';
    await expect(page.locator('#quiz-history li')).toHaveCount(1);
    expect(await sqlRows(student, 'quiz_attempts')).toHaveLength(1);
    expect((await sqlRows(student, 'course_states'))[0].done).toBe(false);
    const document = (await records(page))[0]; expect(document.conflicts.some(item => !item.resolved)).toBe(true);
    stage = 'résolution volontaire sur nouvelle révision';
    await page.locator('.course-quiz-conflict').first().locator('summary').click();
    await page.getByRole('button', { name: 'Conserver mon choix', exact: true }).click(); await synced(page);
    const final = (await sqlRows(student, 'course_states'))[0]; expect(final.done).toBe(true); expect(final.revision).toBe(2);
    expect(final.operation_id).not.toBe(held.p_operation_id);
    expect(await sqlRows(student, 'quiz_attempts')).toHaveLength(1);
  } catch { failure = new Error(`Conflit cours Supabase local non validé : ${stage}. État : ${await diagnostics(page)}.`); }
  finally { release(); if (student) try { await student.cleanup(); } catch { failure = new Error('Nettoyage du compte fictif CAS incomplet.'); } }
  if (failure) throw failure;
});

test('Import réel volontaire : manifeste de positions, doublons légitimes et source intacte', async ({ page }) => {
  test.setTimeout(90000);
  let student; let stage = 'historique synthétique local'; let failure;
  const raw = JSON.stringify(learningDocument);
  try {
    student = await createDrillStudent(); await configureDrillPage(page, student.environment);
    await page.addInitScript(source => {
      if (!sessionStorage.getItem('course-import-seeded')) {
        localStorage.setItem('bprea-demo-progress-v1', source); sessionStorage.setItem('course-import-seeded', 'yes');
      }
    }, raw);
    await signIn(page, student, quizUrl); await expect(page.locator('#quiz-history li')).toHaveCount(0);
    expect(await sqlRows(student, 'quiz_attempts')).toHaveLength(0);
    stage = 'prévisualisation puis annulation';
    await page.getByRole('button', { name: 'Importer l’historique de cet appareil', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('appareil');
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    expect(await sqlRows(student, 'quiz_attempts')).toHaveLength(0);
    stage = 'confirmation explicite'; await page.getByRole('button', { name: 'Importer l’historique de cet appareil', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmer l’import', exact: true }).click(); await synced(page);
    await expect(page.locator('#quiz-history li')).toHaveCount(2);
    const attempts = await sqlRows(student, 'quiz_attempts'); expect(attempts).toHaveLength(2);
    expect(new Set(attempts.map(item => item.attempt_id)).size).toBe(2);
    expect(attempts.map(item => [item.score, item.total, Date.parse(item.completed_at)])).toEqual([
      [3, 3, Date.parse('2026-10-21T12:00:00.000Z')], [3, 3, Date.parse('2026-10-21T12:00:00.000Z')],
    ]);
    const before = (await records(page))[0]; expect(before.imports).toHaveLength(1);
    stage = 'rechargement et nouvel essai de la même source'; await page.reload(); await synced(page);
    await page.getByRole('button', { name: 'Importer l’historique de cet appareil', exact: true }).click();
    const confirm = page.getByRole('button', { name: 'Confirmer l’import', exact: true });
    if (await confirm.isEnabled()) await confirm.click(); else await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    await refresh(page); expect(await sqlRows(student, 'quiz_attempts')).toHaveLength(2);
    const after = (await records(page))[0]; expect(after.imports).toEqual(before.imports);
    expect(await page.evaluate(() => localStorage.getItem('bprea-demo-progress-v1'))).toBe(raw);
  } catch { failure = new Error(`Import cours/QCM Supabase local non validé : ${stage}. État : ${await diagnostics(page)}.`); }
  finally { if (student) try { await student.cleanup(); } catch { failure = new Error('Nettoyage du compte fictif import incomplet.'); } }
  if (failure) throw failure;
});
