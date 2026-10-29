import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createDrillStudent, configureDrillPage, signInDrill } from '../helpers/drill-local.js';
import { LOCAL_SITE } from '../helpers/auth-local.js';
import { seedPersonalTables, readPersonalTables } from '../helpers/personal-data-local.js';
import { stopOrdinarySync } from '../helpers/export-browser.js';
import { personalRecords } from '../helpers/personal-browser.js';
import { CACHES } from '../../assets/export-sources.js';
import { personalScope } from '../../assets/drill-personal-store.js';
import { stamp, questions } from '../fixtures/export.js';
import { botanicalSession, botanicalAnswer, itkParameters } from '../fixtures/personal-data.js';

async function exportFile(page) {
  await page.locator('[data-export-prepare]').click(); await expect(page.locator('[data-export-status]')).toContainText('Copie prête');
  const download = page.waitForEvent('download'); await page.locator('[data-export-download]').click();
  return JSON.parse(await readFile(await (await download).path(), 'utf8'));
}
async function preview(page, file) {
  await page.locator('[data-restore-file]').setInputFiles({ name: 'synthetic-local-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  await page.locator('[data-restore-analyze]').click();
}
async function confirm(page) {
  await expect(page.locator('[data-restore-status]')).toContainText('Aperçu prêt');
  await page.locator('[data-restore-confirm]').check(); await page.locator('[data-restore-apply]').click();
}
async function newDevice(browser, student) {
  const context = await browser.newContext(), page = await context.newPage(); await configureDrillPage(page, student.environment);
  // Prevent ordinary synchronization from hydrating the new device first.
  // Auth/profile remain real; no PostgreSQL write or deletion is simulated.
  const routePattern = `${student.environment.url}/rest/v1/**`;
  await page.route(routePattern, route => route.request().url().includes('/profiles') ? route.continue() : route.abort('failed'));
  await signInDrill(page, student); await page.goto(`${LOCAL_SITE}profil.html`); await stopOrdinarySync(page);
  await page.unroute(routePattern); return { context, page };
}
async function addIntentions(page, scope, ids, { firstSettings = false, botanicalHistory = null } = {}) {
  await page.evaluate(async ({ scope, ids, stamp, questions, parameters, session, firstSettings, botanicalHistory }) => {
    const app = new URL(document.querySelector('script[type=module][src]').src);
    async function module(file) { const url = new URL(`./${file}`, app); url.search = app.search; return import(url.href); }
    const courseModel = await module('course-quiz-model.js'), { createCourseQuizRepository } = await module('course-quiz-store.js');
    const repo = createCourseQuizRepository(scope);
    await repo.change(doc => {
      courseModel.enqueueImportedQuiz(doc, 'restore-pending-quiz', { score: 0, total: 3, completedAt: stamp }, ids.quiz);
      courseModel.mutateCourse(doc, 'restore-pending-course', false, () => ids.course);
    }); await repo.close();
    if (firstSettings) {
      const { createSettingsRepository } = await module('settings-store.js'), { queueSettings } = await module('settings-model.js');
      const settings = createSettingsRepository(scope);
      await settings.change(doc => { queueSettings(doc, 'itk', parameters, () => ids.itk); queueSettings(doc, 'appearance', { version: 1, season: 'auto', brightness: 'auto' }, () => ids.appearance); }); await settings.close();
      const { createBotanicalRepository } = await module('botanical-personal-store.js'), { recordPersonalSession } = await module('botanical-sync-model.js');
      const botanical = createBotanicalRepository(scope); await botanical.change(doc => recordPersonalSession(doc, session, () => ids.session)); await botanical.close();
    } else {
      const { createPersonalRepository, personalChange } = await module('drill-personal-store.js');
      const drill = createPersonalRepository(scope);
      await drill.change(doc => {
        personalChange(doc, 'submitAnswer', ['uc3__2026-W43', questions[1].id, questions[1].answer, { nowISO: stamp }], () => ids.answer);
        personalChange(doc, 'submitAnswer', ['uc3__2026-W43', questions[0].id, questions[0].answer, { nowISO: stamp, training: true }], () => ids.training);
      }); await drill.close();
      const { createBotanicalRepository } = await module('botanical-personal-store.js');
      const { reconcileHistory, recordPersonalAnswer } = await module('botanical-sync-model.js');
      const botanical = createBotanicalRepository(scope);
      await botanical.change(doc => {
        reconcileHistory(doc, { sessions: botanicalHistory.sessions, answers: botanicalHistory.answers }, JSON.parse(scope)[2], stamp);
        recordPersonalAnswer(doc, botanicalHistory.answer, () => ids.botanical);
      }); await botanical.close();
    }
  }, { scope, ids, stamp, questions, parameters: itkParameters, session: botanicalSession('restore-open-session'), firstSettings, botanicalHistory });
}

test('JSON réel : nouvel appareil A, historiques et intentions manquantes, conflits, relecture JWT et refus A/B/visiteur', async ({ page, browser }) => {
  test.setTimeout(180000); const students = [], contexts = []; let stage = 'comptes éphémères', failure;
  try {
    const a = await createDrillStudent(); students.push(a); const b = await createDrillStudent(); students.push(b);
    stage = 'dix tables par JWT et témoins B'; await seedPersonalTables(a, 2); await seedPersonalTables(b, 2);
    const beforeB = await readPersonalTables(b), seededA = await readPersonalTables(a), scope = personalScope({ environment: 'development', url: a.environment.url, userId: a.userId });
    await configureDrillPage(page, a.environment); await signInDrill(page, a);
    await expect.poll(async () => (await personalRecords(page, CACHES.drill).catch(() => [])).some(doc => doc.remote.series.length === 1)).toBe(true);
    await page.goto(`${LOCAL_SITE}profil.html`); await stopOrdinarySync(page);
    await page.route(`${a.environment.url}/rest/v1/rpc/**`, route => route.abort('failed'));
    const ids = Object.fromEntries(['quiz', 'course', 'answer', 'training', 'botanical'].map(key => [key, randomUUID()]));
    const parent = seededA.botanical_sessions[0];
    const botanicalHistory = { sessions: seededA.botanical_sessions, answers: seededA.botanical_answers,
      answer: botanicalAnswer(botanicalSession(parent.session_id, { revision: parent.is_revision, startedAt: parent.started_at }), 2) };
    stage = 'intentions locales, export JSON réel'; await addIntentions(page, scope, ids, { botanicalHistory }); const file = await exportFile(page);
    const beforeA = await readPersonalTables(a); expect(beforeA.quiz_attempts.some(row => row.attempt_id === ids.quiz)).toBe(false);
    stage = 'concurrence serveur conservée';
    const old = beforeA.course_states[0];
    const changed = await a.client.rpc('personal_save_course', { p_lesson_id: old.lesson_id, p_done: true, p_best_score: old.best_score,
      p_legacy_score: old.legacy_score, p_legacy_total: old.legacy_total, p_operation_id: randomUUID(), p_expected_revision: old.revision });
    expect(changed.error === null && changed.data?.status === 'updated').toBe(true);
    stage = 'nouvel appareil sans effacement'; const fresh = await newDevice(browser, a); contexts.push(fresh.context);
    await preview(fresh.page, file); await expect(fresh.page.locator('[data-restore-status]')).toContainText('Aperçu prêt');
    const noWrites = await readPersonalTables(a); expect(noWrites.quiz_attempts.some(row => row.attempt_id === ids.quiz)).toBe(false);
    await confirm(fresh.page); await expect(fresh.page.locator('[data-restore-status]')).toContainText('Restauration partielle');
    stage = 'vérification serveur sous JWT A, cache et B';
    const after = await readPersonalTables(a);
    expect(after.quiz_attempts.filter(row => row.attempt_id === ids.quiz).length).toBe(1); expect(after.quiz_attempts.length).toBe(3);
    expect(after.course_states.find(row => row.lesson_id === old.lesson_id).done).toBe(true);
    expect(after.course_states.find(row => row.lesson_id === 'restore-pending-course').done).toBe(false);
    expect(after.drill_answers.filter(row => row.operation_id === ids.answer).length).toBe(1);
    expect(after.drill_training_attempts.filter(row => row.operation_id === ids.training).length).toBe(1);
    expect(after.drill_training_attempts.length).toBe(2);
    expect(after.botanical_answers.filter(row => row.answer_id === botanicalHistory.answer.id).length).toBe(1);
    expect(after.drill_series[0].id === beforeA.drill_series[0].id).toBe(true);
    const cached = (await personalRecords(fresh.page, CACHES.courses)).find(doc => doc.scope === scope);
    expect(cached.attempts[ids.quiz].score).toBe(0);
    for (const database of Object.values(CACHES)) expect((await personalRecords(fresh.page, database)).some(doc => doc.scope === scope)).toBe(true);
    expect(JSON.stringify(await readPersonalTables(b)) === JSON.stringify(beforeB)).toBe(true);
    stage = 'reload et seconde importation sans doublon';
    await fresh.page.reload(); await stopOrdinarySync(fresh.page); await preview(fresh.page, file);
    await expect(fresh.page.locator('[data-restore-status]')).toContainText('Aperçu prêt'); await expect(fresh.page.locator('[data-restore-apply]')).toBeDisabled();
    expect(JSON.stringify(await readPersonalTables(a)) === JSON.stringify(after)).toBe(true);
    stage = 'fichier A sous B et visiteur';
    const foreign = await newDevice(browser, b); contexts.push(foreign.context); await preview(foreign.page, file);
    await expect(foreign.page.locator('[data-restore-detail]')).toContainText('autre compte');
    const visitorContext = await browser.newContext(); contexts.push(visitorContext); const visitor = await visitorContext.newPage();
    await configureDrillPage(visitor, a.environment); await visitor.goto(`${LOCAL_SITE}profil.html`); await expect(visitor.locator('[data-restore-file]')).toBeDisabled();
    expect(JSON.stringify(await readPersonalTables(b)) === JSON.stringify(beforeB)).toBe(true);
    stage = 'changement d’identité pendant une lecture distante réelle';
    let release, entered; const held = new Promise(resolve => { release = resolve; }), reached = new Promise(resolve => { entered = resolve; });
    await fresh.page.route(`${a.environment.url}/rest/v1/quiz_attempts*`, async route => { entered(); await held; try { await route.continue(); } catch { /* cancelled */ } });
    await preview(fresh.page, file); await reached;
    await fresh.page.locator('header').getByRole('button', { name: 'Déconnexion', exact: true }).click(); release();
    await expect(fresh.page.locator('[data-restore-preview]')).toBeHidden(); await expect(fresh.page.locator('[data-restore-apply]')).toBeDisabled();
    expect(JSON.stringify(await readPersonalTables(a)) === JSON.stringify(after)).toBe(true);
  } catch { failure = new Error(`Restauration Supabase locale non validée : ${stage}. Aucun contenu, compte ou jeton journalisé.`); }
  finally {
    await page.close(); for (const context of contexts) await context.close();
    for (const student of students.toReversed()) try { await student.cleanup(); } catch { failure = new Error('Nettoyage ciblé des seules fixtures de restauration incomplet.'); }
    if (failure) throw failure;
  }
});

test('JSON réel : créations initiales compatibles par RPC normales, identités/base zéro conservées', async ({ page, browser }) => {
  test.setTimeout(150000); const students = [], contexts = []; let stage = 'compte synthétique', failure;
  try {
    const a = await createDrillStudent(); students.push(a);
    const scope = personalScope({ environment: 'development', url: a.environment.url, userId: a.userId });
    const first = await newDevice(browser, a); contexts.push(first.context);
    const ids = Object.fromEntries(['quiz', 'course', 'itk', 'appearance', 'session'].map(key => [key, randomUUID()]));
    stage = 'outboxes initiales jamais envoyées'; await addIntentions(first.page, scope, ids, { firstSettings: true });
    const file = await exportFile(first.page), before = await readPersonalTables(a);
    expect(before.quiz_attempts.length + before.course_states.length + before.itk_settings.length + before.appearance_preferences.length + before.botanical_sessions.length).toBe(0);
    stage = 'restauration depuis un second appareil'; const second = await newDevice(browser, a); contexts.push(second.context);
    await preview(second.page, file); await confirm(second.page);
    await expect(second.page.locator('[data-restore-status]')).toContainText('données compatibles confirmée');
    stage = 'vrais reçus, relecture PostgreSQL et idempotence'; const after = await readPersonalTables(a);
    for (const [name, key] of [['course_states', 'course'], ['itk_settings', 'itk'], ['appearance_preferences', 'appearance'], ['botanical_sessions', 'session']]) {
      expect(after[name].length).toBe(1); expect(after[name][0].operation_id === ids[key] && after[name][0].revision === 1 && after[name][0].base_revision === 0).toBe(true);
    }
    expect(after.quiz_attempts[0].attempt_id === ids.quiz).toBe(true); expect(after.appearance_preferences[0].season).toBe('auto');
    expect(after.botanical_sessions[0].completed_at).toBeNull(); expect(after.botanical_answers.length).toBe(0);
    await preview(second.page, file); await expect(second.page.locator('[data-restore-status]')).toContainText('Aperçu prêt');
    await expect(second.page.locator('[data-restore-apply]')).toBeDisabled(); expect(JSON.stringify(await readPersonalTables(a)) === JSON.stringify(after)).toBe(true);
  } catch { failure = new Error(`Créations de restauration locales non validées : ${stage}. Aucun contenu ni jeton journalisé.`); }
  finally {
    await page.close(); for (const context of contexts) await context.close();
    for (const student of students.toReversed()) try { await student.cleanup(); } catch { failure = new Error('Nettoyage ciblé des créations de restauration incomplet.'); }
    if (failure) throw failure;
  }
});
