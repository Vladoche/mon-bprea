import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createDrillStudent, configureDrillPage, signInDrill, DRILL_LOCAL_URL } from '../helpers/drill-local.js';
import { LOCAL_SITE } from '../helpers/auth-local.js';
import { bankQuestions } from '../fixtures/drill.js';
import { lessons } from '../../assets/content.js';
import { botanicalBank, botanicalPath, botanicalSynced, startBotanical, answerBotanical, finishBotanical, expectBotanicalHistory } from '../helpers/botanical-browser.js';
import { itkPath, itkParameters, settingsAction, settingsSynced, generateItk, expectItk, chooseAppearance, closeAppearance } from '../helpers/settings-browser.js';

const lesson = lessons.find(item => item.id === 'matiere-organique');
const coursePath = `${LOCAL_SITE}cours.html?id=${lesson.id}`, quizPath = `${LOCAL_SITE}exercices.html?id=${lesson.id}`;
const dashboardPath = `${LOCAL_SITE}tableau-de-bord.html?unit=uc3&period=4`;
const courseSynced = page => expect(page.locator('#course-quiz-sync-status')).toHaveText('Synchronisé');
const drillSynced = page => expect(page.locator('#drill-sync-status')).toHaveText('Synchronisé');
const tables = ['drill_series', 'drill_answers', 'drill_training_attempts', 'course_states', 'quiz_attempts', 'botanical_sessions', 'botanical_answers', 'itk_settings', 'appearance_preferences'];
async function rows(student, table) {
  await student.refresh(); const result = await student.client.from(table).select('*').eq('user_id', student.userId);
  expect(result.error).toBeNull(); return result.data;
}
async function drillAnswer(page, index = 0) {
  const start = page.getByRole('button', { name: 'Commencer cette série', exact: true }); if (await start.isVisible()) await start.click();
  const article = page.locator('.drill-question').nth(index), form = article.locator('form').first();
  const id = await form.getAttribute('data-question'), question = bankQuestions().find(item => item.id === id);
  await form.getByRole('radio', { name: question.options.find(item => item.id === question.answer).text, exact: true }).check();
  await form.getByRole('button', { name: 'Valider cette réponse', exact: true }).click(); await expect(article.locator('.drill-correction')).toBeVisible();
}
async function quiz(page, score) {
  for (const [index, item] of lesson.quiz.entries()) await page.locator(`input[name="q${index}"][value="${index < score ? item.answer : (item.answer + 1) % item.options.length}"]`).check();
  await page.locator('#check-quiz').click(); await expect(page.locator('#quiz-result')).toContainText(`${score} / 3`);
}
async function fillAllDomains(page, { index = 0, score = 2, area = '100', season = 'winter', brightness = 'dark', online = true } = {}) {
  await page.goto(DRILL_LOCAL_URL); if (online) await drillSynced(page); await drillAnswer(page, index); if (online) await drillSynced(page);
  await page.goto(quizPath); if (online) await courseSynced(page); await quiz(page, score); if (online) await courseSynced(page);
  await page.goto(coursePath); if (online) await courseSynced(page); await page.locator('#mark-done').check(); if (online) await courseSynced(page);
  await page.goto(botanicalPath); if (online) await botanicalSynced(page); await startBotanical(page); await answerBotanical(page); await finishBotanical(page); if (online) await botanicalSynced(page);
  await page.goto(itkPath); if (online) await settingsSynced(page); await generateItk(page, { ...itkParameters, area });
  await chooseAppearance(page, season, brightness); if (online) await settingsSynced(page); await closeAppearance(page);
}
async function verifyBrowser(page, { answers = 1, attempts = 1, botanical = 1, area = '100', done = true, season = 'winter', brightness = 'dark' } = {}) {
  await page.goto(DRILL_LOCAL_URL); await drillSynced(page); await expect(page.locator('.drill-correction')).toHaveCount(answers);
  await page.goto(dashboardPath); await expect(page.locator('#dashboard-sync-status')).toHaveText('Historique personnel synchronisé');
  await expect(page.getByRole('term').filter({ hasText: /^Exercices réalisés$/ }).locator('..').getByRole('definition')).toHaveText(String(answers));
  await page.goto(quizPath); await courseSynced(page); await expect(page.locator('#quiz-history li')).toHaveCount(attempts);
  await page.goto(coursePath); await courseSynced(page); if (done) await expect(page.locator('#mark-done')).toBeChecked(); else await expect(page.locator('#mark-done')).not.toBeChecked();
  await page.goto(botanicalPath); await botanicalSynced(page); await expectBotanicalHistory(page, { attempted: botanical, correct: botanical, incorrect: 0, rate: '100 %' });
  await page.goto(itkPath); await settingsSynced(page); await expectItk(page, { ...itkParameters, area });
  expect((await settingsAction(page, 'state')).view.appearance).toMatchObject({ season, brightness });
}
async function verifyDatabase(student, { answers = 1, attempts = 1, botanical = 1, area = '100', done = true, season = 'winter', brightness = 'dark' } = {}) {
  expect(await rows(student, 'drill_answers')).toHaveLength(answers); expect(await rows(student, 'quiz_attempts')).toHaveLength(attempts);
  expect(await rows(student, 'botanical_answers')).toHaveLength(botanical); expect((await rows(student, 'course_states'))[0].done).toBe(done);
  expect((await rows(student, 'itk_settings'))[0].parameters).toMatchObject({ ...itkParameters, area });
  expect((await rows(student, 'appearance_preferences'))[0]).toMatchObject({ season, brightness });
  await student.refresh(); const profile = await student.client.from('profiles').select('id').eq('id', student.userId); expect(profile.error).toBeNull(); expect(profile.data).toEqual([{ id: student.userId }]);
}
async function cleanup(students, contexts, failure) {
  for (const context of contexts) await context.close();
  for (const student of students.toReversed()) try { await student.cleanup(); } catch { failure = new Error('Nettoyage incomplet des seuls comptes fictifs de la recette transversale.'); }
  if (failure) throw failure;
}

test('Espace personnel réel : recette transversale multi-appareils et conservation des historiques', async ({ page, browser }) => {
  test.setTimeout(180000); const students = [], contexts = []; let stage = 'compte local', failure;
  try {
    const a = await createDrillStudent(); students.push(a); await configureDrillPage(page, a.environment); await signInDrill(page, a);
    stage = 'premier parcours dans tous les domaines'; await fillAllDomains(page); await verifyDatabase(a);
    const context = await browser.newContext({ timezoneId: 'Europe/Paris', locale: 'fr-FR' }); contexts.push(context);
    const second = await context.newPage(); await configureDrillPage(second, a.environment); await signInDrill(second, a);
    stage = 'récupération du compte sur deuxième appareil'; await verifyBrowser(second);
    stage = 'nouvelles intentions sur deuxième appareil'; await fillAllDomains(second, { index: 1, score: 1, area: '240', season: 'summer', brightness: 'light' });
    await second.goto(coursePath); await courseSynced(second); await second.locator('#mark-done').uncheck(); await courseSynced(second);
    stage = 'réconciliation et historiques sur premier appareil'; await verifyBrowser(page, { answers: 2, attempts: 2, botanical: 2, area: '240', done: false, season: 'summer', brightness: 'light' });
    await verifyDatabase(a, { answers: 2, attempts: 2, botanical: 2, area: '240', done: false, season: 'summer', brightness: 'light' });
    expect(await rows(a, 'botanical_sessions')).toHaveLength(2);
    expect(new Set((await rows(a, 'quiz_attempts')).map(item => item.attempt_id)).size).toBe(2);
  } catch { failure = new Error(`Recette transversale PostgreSQL non validée : ${stage}. Aucune donnée Auth sensible publiée.`); }
  finally { await cleanup(students, contexts, failure); }
});

test('Espace personnel réel : A vers B puis A, aucun historique ni outbox échangé entre comptes', async ({ page }) => {
  test.setTimeout(180000); const students = []; let stage = 'comptes locaux', failure;
  try {
    const a = await createDrillStudent(), b = await createDrillStudent(); students.push(a, b);
    await configureDrillPage(page, a.environment); await signInDrill(page, a); await fillAllDomains(page); await verifyDatabase(a);
    stage = 'intention A conservée sans réseau';
    const outage = route => route.abort('failed'), pattern = `${a.environment.url}/rest/v1/**`; await page.route(pattern, outage);
    await generateItk(page, { ...itkParameters, area: '789' }); await expect(page.locator('#itk-sync-status')).toContainText(/ligne|attente/i);
    await page.locator('header').getByRole('button', { name: 'Déconnexion', exact: true }).click(); await page.unroute(pattern, outage);
    stage = 'B vide dans tous les domaines'; await signInDrill(page, b); await drillSynced(page); await expect(page.locator('.drill-correction')).toHaveCount(0);
    await page.goto(dashboardPath); await expect(page.locator('#dashboard-sync-status')).toHaveText('Historique personnel synchronisé');
    await expect(page.getByRole('term').filter({ hasText: /^Exercices réalisés$/ }).locator('..').getByRole('definition')).toHaveText('0');
    await page.goto(quizPath); await courseSynced(page); await expect(page.locator('#quiz-history li')).toHaveCount(0);
    await page.goto(coursePath); await courseSynced(page); await expect(page.locator('#mark-done')).not.toBeChecked();
    await page.goto(botanicalPath); await botanicalSynced(page); await expectBotanicalHistory(page, { attempted: 0 });
    await page.goto(itkPath); await settingsSynced(page); const state = await settingsAction(page, 'state'); expect(state.view.itk).toBeNull(); expect(state.view.appearance).toBeNull();
    for (const table of tables) {
      expect(await rows(b, table)).toEqual([]);
      const foreign = await b.client.from(table).select('*').eq('user_id', a.userId); expect(foreign.error).toBeNull(); expect(foreign.data).toEqual([]);
    }
    stage = 'retour A et reprise de sa seule intention'; await page.locator('header').getByRole('button', { name: 'Déconnexion', exact: true }).click(); await signInDrill(page, a);
    await verifyBrowser(page, { area: '789' }); await verifyDatabase(a, { area: '789' });
    expect(await rows(b, 'itk_settings')).toEqual([]);
  } catch { failure = new Error(`Séparation transversale A/B non validée : ${stage}.`); }
  finally { await cleanup(students, [], failure); }
});

test('Espace personnel réel : panne API transversale, rechargements et reprise sans doublon', async ({ page }) => {
  test.setTimeout(180000); const students = []; let stage = 'compte local', failure;
  try {
    const a = await createDrillStudent(); students.push(a); await configureDrillPage(page, a.environment); await signInDrill(page, a);
    await fillAllDomains(page); await verifyDatabase(a);
    // Static pages/modules remain served: this is an API outage, not a claim
    // that an uncached site works offline without a service worker.
    const pattern = `${a.environment.url}/**`, outage = route => route.abort('failed'); await page.route(pattern, outage);
    stage = 'nouvelles intentions dans les six domaines hors API';
    await fillAllDomains(page, { index: 1, score: 1, area: '444', season: 'auto', brightness: 'auto', online: false });
    await page.reload(); await expectItk(page, { ...itkParameters, area: '444' });
    expect((await settingsAction(page, 'state')).view.appearance).toMatchObject({ season: 'auto', brightness: 'auto' });
    await page.goto(DRILL_LOCAL_URL); await expect(page.locator('.drill-correction')).toHaveCount(2);
    await page.goto(quizPath); await expect(page.locator('#quiz-history li')).toHaveCount(2);
    await page.goto(botanicalPath); await expectBotanicalHistory(page, { attempted: 2, correct: 2, rate: '100 %' });
    stage = 'retour Auth/API et réconciliation de tous les domaines'; await page.unroute(pattern, outage);
    await page.evaluate(async () => { const app = new URL(document.querySelector('script[type="module"][src]').src); const url = new URL('./auth-service.js', app); url.search = app.search; await (await (await import(url.href)).getAuthService()).retry(); window.dispatchEvent(new Event('online')); });
    await verifyBrowser(page, { answers: 2, attempts: 2, botanical: 2, area: '444', season: 'auto', brightness: 'auto' });
    await verifyDatabase(a, { answers: 2, attempts: 2, botanical: 2, area: '444', season: 'auto', brightness: 'auto' });
    stage = 'second passage sans nouvelle intention'; await verifyBrowser(page, { answers: 2, attempts: 2, botanical: 2, area: '444', season: 'auto', brightness: 'auto' });
    await verifyDatabase(a, { answers: 2, attempts: 2, botanical: 2, area: '444', season: 'auto', brightness: 'auto' });
  } catch { failure = new Error(`Reprise transversale PostgreSQL non validée : ${stage}.`); }
  finally { await cleanup(students, [], failure); }
});


test('Espace personnel réel : conflits cours, ITK, apparence et botanique isolés, QCM et Drill restent synchronisables', async ({ page }) => {
  test.setTimeout(180000); const students = []; let release = () => {}, stage = 'compte local', failure;
  try {
    const a = await createDrillStudent(); students.push(a); await configureDrillPage(page, a.environment); await signInDrill(page, a); await fillAllDomains(page);
    async function compete(rpcName, act, replace, waitConflict) {
      let held; const gate = new Promise(resolve => { release = resolve; }); const pattern = `**/rest/v1/rpc/${rpcName}`;
      const hold = async route => { held = JSON.parse(route.request().postData()); await gate; await route.continue(); };
      await page.route(pattern, hold); await act(); await expect.poll(() => !!held).toBe(true);
      await a.refresh(); const winner = await a.client.rpc(rpcName, replace(held)); expect(winner.error).toBeNull();
      release(); await waitConflict(); await page.unroute(pattern, hold);
    }
    stage = 'cours concurrent'; await page.goto(coursePath); await courseSynced(page);
    await compete('personal_save_course', () => page.locator('#mark-done').uncheck(), held => ({ ...held, p_done: true, p_operation_id: randomUUID() }), () => expect(page.locator('#course-quiz-sync-status')).toContainText('Conflit'));
    stage = 'ITK concurrent, conflit cours toujours conservé'; await page.goto(itkPath); await settingsSynced(page);
    await compete('personal_save_itk', () => generateItk(page, { ...itkParameters, area: '250' }), held => ({ ...held, p_parameters: { ...itkParameters, crop: 'carotte', variety: 'Nantaise', area: '300' }, p_operation_id: randomUUID() }), () => expect(page.locator('#itk-sync-status')).toContainText('Conflit'));
    stage = 'apparence concurrente, deux conflits actifs';
    await compete('personal_save_appearance', () => chooseAppearance(page, 'summer', 'dark'), held => ({ ...held, p_preferences: { version: 1, season: 'spring', brightness: 'dark' }, p_operation_id: randomUUID() }), () => expect(page.locator('#appearance-save')).toContainText('Conflit'));
    await closeAppearance(page); expect((await settingsAction(page, 'state')).sync.conflicts.filter(item => !item.resolved)).toHaveLength(2);
    stage = 'réponse botanique concurrente'; await page.goto(botanicalPath); await botanicalSynced(page); await startBotanical(page); await botanicalSynced(page);
    await compete('personal_record_botanical_answer', () => answerBotanical(page), held => {
      const other = botanicalBank.species.find(item => item.id !== held.p_answer.speciesId && item.categoryIds.includes(held.p_answer.categoryId));
      return { p_answer: { ...held.p_answer, status: 'incorrect', correct: false, selectedSpeciesId: other.id } };
    }, () => expect(page.locator('#botanical-sync-status')).toContainText('Conflit'));
    expect((await rows(a, 'botanical_answers')).filter(item => item.status === 'incorrect')).toHaveLength(1);
    stage = 'QCM distinct malgré quatre conflits non résolus'; await page.goto(quizPath); await expect(page.locator('#course-quiz-sync-status')).toContainText('Conflit'); await quiz(page, 1);
    await expect.poll(async () => (await rows(a, 'quiz_attempts')).length).toBe(2);
    stage = 'nouvelle réponse Drill indépendante'; await page.goto(DRILL_LOCAL_URL); await drillSynced(page); await drillAnswer(page, 1); await drillSynced(page);
    expect(await rows(a, 'drill_answers')).toHaveLength(2); expect(await rows(a, 'quiz_attempts')).toHaveLength(2);
    expect((await rows(a, 'course_states'))[0].done).toBe(true);
    expect((await rows(a, 'itk_settings'))[0].parameters.crop).toBe('carotte'); expect((await rows(a, 'appearance_preferences'))[0].season).toBe('spring');
    stage = 'conflits conservés au rechargement et résolutions explicites'; await page.goto(itkPath);
    await expect(page.locator('#itk-sync-status')).toContainText('Conflit'); await page.locator('#itk-conflicts summary').last().click();
    await page.locator('#itk-conflicts').getByRole('button', { name: 'Garder la version du compte', exact: true }).click();
    await page.locator('#appearance-open').click(); await page.locator('#appearance-conflicts summary').last().click();
    await page.locator('#appearance-conflicts').getByRole('button', { name: 'Garder la version du compte', exact: true }).click(); await closeAppearance(page); await settingsSynced(page);
    await page.goto(coursePath); await expect(page.locator('#course-quiz-sync-status')).toContainText('Conflit'); await page.locator('.course-quiz-conflict summary').last().click();
    await page.locator('.course-quiz-conflict').getByRole('button', { name: 'Garder la version du compte', exact: true }).click(); await courseSynced(page);
    await page.goto(botanicalPath); await expect(page.locator('#botanical-sync-status')).toContainText('Conflit'); await page.locator('.botanical-conflict summary').last().click();
    await page.locator('.botanical-conflict').getByRole('button', { name: 'Garder la version du compte', exact: true }).click(); await botanicalSynced(page);
    expect(await rows(a, 'botanical_answers')).toHaveLength(2); expect(await rows(a, 'quiz_attempts')).toHaveLength(2); expect(await rows(a, 'drill_answers')).toHaveLength(2);
  } catch { failure = new Error(`Isolation transversale des conflits PostgreSQL non validée : ${stage}.`); }
  finally { release(); await cleanup(students, [], failure); }
});
