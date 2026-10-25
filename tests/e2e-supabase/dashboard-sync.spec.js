import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import {
  createDrillStudent, configureDrillPage, DRILL_LOCAL_URL, personalRecord, signInDrill,
} from '../helpers/drill-local.js';
import { LOCAL_SITE } from '../helpers/auth-local.js';
import { answerFor, bankQuestions, makeSeries } from '../fixtures/drill.js';

const dashboardUrl = `${LOCAL_SITE}tableau-de-bord.html?unit=uc3&period=4`;
const drillSynced = page => expect(page.locator('#drill-sync-status')).toHaveText('Synchronisé');
const dashboardSynced = page => expect(page.locator('#dashboard-sync-status')).toHaveText('Historique personnel synchronisé');
const metric = (page, label) => page.getByRole('term').filter({ hasText: new RegExp(`^${label}$`) })
  .locator('..').getByRole('definition');

async function verifyTotals(page, completed, correct, successRate) {
  await expect(metric(page, 'Exercices réalisés')).toHaveText(String(completed));
  await expect(metric(page, 'Réponses correctes')).toHaveText(String(correct));
  await expect(metric(page, 'Réponses incorrectes')).toHaveText(String(completed - correct));
  await expect(metric(page, 'Taux de réussite')).toHaveText(successRate === null ? 'Aucune donnée' : `${successRate} %`);
}

async function respond(page, index, { correct = true, training = false } = {}) {
  const article = page.locator('.drill-question').nth(index);
  if (training) await article.getByRole('button', { name: 'Revoir cette question', exact: true }).click();
  const form = article.locator('form');
  const questionId = await form.getAttribute('data-question');
  const question = bankQuestions().find(item => item.id === questionId);
  const option = question.options.find(item => correct ? item.id === question.answer : item.id !== question.answer);
  await form.getByRole('radio', { name: option.text, exact: true }).check();
  await form.getByRole('button', { name: training ? 'Vérifier pour s’entraîner' : 'Valider cette réponse', exact: true }).click();
  await expect(article.locator('.drill-correction')).toBeVisible();
  // La première correction reste visible pendant un entraînement : attendre
  // aussi la fermeture du formulaire avant de commencer la tentative suivante.
  if (training) await expect(article.getByRole('button', { name: 'Revoir cette question', exact: true })).toBeVisible();
}

async function signOut(page) {
  await page.locator('header').getByRole('button', { name: 'Déconnexion', exact: true }).click();
  await expect(page.locator('#dashboard-sync-status')).toContainText('Mode visiteur');
}

test('Dashboard réel : deux appareils, entraînements exclus, cache hors ligne et comptes isolés', async ({ page, browser }) => {
  test.setTimeout(90000);
  const students = []; const contexts = [];
  let stage = 'comptes fictifs locaux'; let failure;
  try {
    const a = await createDrillStudent(); students.push(a);
    const b = await createDrillStudent(); students.push(b);
    await configureDrillPage(page, a.environment);
    const visitorSeries = makeSeries();
    const answeredAt = new Date(await page.evaluate(() => Date.now()) - 60000).toISOString();
    visitorSeries.answers[visitorSeries.questions[0].id] = answerFor(visitorSeries.questions[0], { correct: false, answeredAt });
    const visitor = JSON.stringify({ version: 1, series: { [visitorSeries.id]: visitorSeries }, future: 'préserver' });
    await page.addInitScript(raw => {
      if (!sessionStorage.getItem('dashboard-visitor-seeded')) {
        localStorage.setItem('bprea-demo-drill-v1', raw);
        sessionStorage.setItem('dashboard-visitor-seeded', 'yes');
      }
    }, visitor);
    stage = 'visiteur puis A sans import de son historique';
    await page.goto(dashboardUrl); await expect(page.locator('#dashboard-sync-status')).toContainText('Mode visiteur');
    await verifyTotals(page, 1, 0, 0);
    await signInDrill(page, a);
    await page.goto(dashboardUrl); await dashboardSynced(page); await verifyTotals(page, 0, 0, null);

    stage = 'première réponse et cinq entraînements enregistrés séparément';
    await page.goto(DRILL_LOCAL_URL);
    await page.getByRole('button', { name: 'Commencer cette série', exact: true }).click(); await drillSynced(page);
    await respond(page, 0); await drillSynced(page);
    for (let attempt = 0; attempt < 5; attempt++) { await respond(page, 0, { training: true }); await drillSynced(page); }

    stage = 'deuxième appareil et statistiques personnelles distantes';
    const context = await browser.newContext({ timezoneId: 'Europe/Paris', locale: 'fr-FR' }); contexts.push(context);
    const second = await context.newPage(); await configureDrillPage(second, a.environment); await signInDrill(second, a);
    await second.goto(dashboardUrl); await dashboardSynced(second); await verifyTotals(second, 1, 1, 100);
    await expect(second.locator('#dashboard-source')).toHaveText('Historique personnel synchronisé');

    stage = 'nouvelle réponse sur le premier appareil et actualisation du second';
    await respond(page, 1, { correct: false }); await drillSynced(page);
    await second.getByRole('button', { name: 'Actualiser les données', exact: true }).click();
    await dashboardSynced(second); await verifyTotals(second, 2, 1, 50);
    await expect(second.locator('#dashboard-unit')).toHaveValue('uc3');
    await expect(second.locator('#dashboard-period')).toHaveValue('4');
    await expect(second.getByRole('button', { name: 'Actualiser les données', exact: true })).toBeFocused();

    stage = 'réponse locale non confirmée, panne API puis cache relu au Dashboard';
    const outage = route => route.abort('failed');
    await page.route(`${a.environment.url}/**`, outage);
    await respond(page, 2); await expect(page.locator('#drill-sync-status')).toContainText(/attente|appareil/i);
    await page.goto(dashboardUrl);
    await expect(page.locator('#dashboard-sync-status')).toContainText(/hors ligne|attente/i);
    await verifyTotals(page, 3, 2, 67);
    await expect(page.locator('#dashboard-sync-detail')).toContainText('en attente');
    await page.reload(); await verifyTotals(page, 3, 2, 67);
    await second.getByRole('button', { name: 'Actualiser les données', exact: true }).click();
    await dashboardSynced(second); await verifyTotals(second, 2, 1, 50);

    stage = 'retour réseau, synchronisation et totaux cohérents sur les deux appareils';
    await page.unroute(`${a.environment.url}/**`, outage);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await dashboardSynced(page); await verifyTotals(page, 3, 2, 67);
    await second.getByRole('button', { name: 'Actualiser les données', exact: true }).click();
    await dashboardSynced(second); await verifyTotals(second, 3, 2, 67);
    await a.refresh();
    const answers = await a.client.from('drill_answers').select('operation_id').eq('user_id', a.userId);
    const training = await a.client.from('drill_training_attempts').select('operation_id').eq('user_id', a.userId);
    expect(answers.error).toBeNull(); expect(answers.data).toHaveLength(3);
    expect(training.error).toBeNull(); expect(training.data).toHaveLength(5);

    stage = 'A déconnecté, B vide, retour A et historique visiteur préservé';
    await signOut(page); await verifyTotals(page, 1, 0, 0);
    await signInDrill(page, b); await page.goto(dashboardUrl); await dashboardSynced(page); await verifyTotals(page, 0, 0, null);
    await signOut(page); await verifyTotals(page, 1, 0, 0);
    await signInDrill(page, a); await page.goto(dashboardUrl); await dashboardSynced(page); await verifyTotals(page, 3, 2, 67);
    expect(await page.evaluate(() => localStorage.getItem('bprea-demo-drill-v1'))).toBe(visitor);
    await b.refresh();
    const inaccessible = await b.client.from('drill_answers').select('operation_id').eq('user_id', a.userId);
    expect(inaccessible.error).toBeNull(); expect(inaccessible.data).toEqual([]);
  } catch { failure = new Error(`Dashboard Supabase local non validé : ${stage}. Aucun identifiant, mot de passe ou jeton n’est journalisé.`); }
  finally {
    for (const context of contexts) await context.close();
    for (const student of students.toReversed()) try { await student.cleanup(); } catch { failure = new Error('Nettoyage des seuls comptes fictifs Dashboard incomplet.'); }
  }
  if (failure) throw failure;
});

test('Dashboard réel : conflit de première réponse conservé sans double comptage', async ({ page }) => {
  test.setTimeout(90000);
  let student; let release = () => {}; let failure; let stage = 'compte fictif local';
  try {
    student = await createDrillStudent(); await configureDrillPage(page, student.environment); await signInDrill(page, student);
    await page.getByRole('button', { name: 'Commencer cette série', exact: true }).click(); await drillSynced(page);
    stage = 'réponse concurrente réellement acceptée par PostgreSQL';
    const pending = new Promise(resolve => { release = resolve; }); let waiting = false;
    const hold = async route => { waiting = true; await pending; await route.continue(); };
    await page.route('**/rest/v1/rpc/drill_record_answer', hold);
    await respond(page, 0); await expect.poll(() => waiting).toBe(true);
    const saved = await personalRecord(page); const operation = saved.operations.find(item => item.type === 'answer');
    const question = saved.drill.series['uc3__2026-W42'].questions.find(item => item.id === operation.payload.p_question_id);
    const otherChoice = question.options.find(item => item.id !== question.answer).id;
    await student.refresh();
    const winner = await student.client.rpc('drill_record_answer', { ...operation.rpcPayload, p_operation_id: randomUUID(), p_answer: otherChoice });
    expect(winner.error).toBeNull(); expect(winner.data.status).toBe('inserted'); release();
    await expect(page.locator('#drill-sync-status')).toContainText('Conflit');
    await page.unroute('**/rest/v1/rpc/drill_record_answer', hold);

    stage = 'Dashboard en conflit : seule la première réponse du compte est comptée';
    await page.goto(dashboardUrl);
    await expect(page.locator('#dashboard-sync-status')).toHaveText('Conflit à résoudre');
    await expect(page.locator('#dashboard-conflict-note')).toBeVisible();
    await verifyTotals(page, 1, 0, 0);
    await page.getByRole('button', { name: 'Actualiser les données', exact: true }).click();
    await expect(page.locator('#dashboard-sync-status')).toHaveText('Conflit à résoudre');
    await verifyTotals(page, 1, 0, 0);
    const conflicted = await personalRecord(page); const conflict = conflicted.conflicts.find(item => item.kind === 'answer' && !item.resolved);
    expect(conflict.local.answer).toBe(operation.payload.p_answer);
    expect(conflicted.drill.series['uc3__2026-W42'].answers[question.id].answer).toBe(otherChoice);
    await student.refresh();
    const answers = await student.client.from('drill_answers').select('operation_id').eq('user_id', student.userId);
    expect(answers.error).toBeNull(); expect(answers.data).toHaveLength(1);

    stage = 'résolution explicite dans le Drill sans modification des totaux';
    await page.goto(DRILL_LOCAL_URL);
    await page.locator('.drill-sync-conflict').first().locator('summary').first().click();
    await page.getByRole('button', { name: 'Continuer avec la réponse du compte', exact: true }).click(); await drillSynced(page);
    await page.goto(dashboardUrl); await dashboardSynced(page); await verifyTotals(page, 1, 0, 0);
    const archived = await personalRecord(page);
    expect(archived.conflicts.find(item => item.id === conflict.id)).toMatchObject({ resolved: true, local: conflict.local });
  } catch { failure = new Error(`Conflit Dashboard Supabase local non validé : ${stage}. Aucune réponse Auth brute n’est journalisée.`); }
  finally { release(); if (student) try { await student.cleanup(); } catch { failure = new Error('Nettoyage du seul compte fictif de conflit Dashboard incomplet.'); } }
  if (failure) throw failure;
});
