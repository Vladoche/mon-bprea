import { test, expect } from '@playwright/test';
import { createDrillStudent, configureDrillPage, personalRecord, signInDrill } from '../helpers/drill-local.js';
import { authIdentity } from '../helpers/personal-browser.js';

const verifyAuth = page => authIdentity(page, { retry: true });

test('Drill réel : reprise du même compte après panne Auth sans événement online', async ({ page }) => {
  test.setTimeout(90000);
  let student; let stage = 'compte fictif local'; let failure;
  const requests = [];
  try {
    student = await createDrillStudent(); await configureDrillPage(page, student.environment); await signInDrill(page, student);
    await page.getByRole('button', { name: 'Commencer cette série' }).click();
    await expect(page.locator('.drill-question')).toHaveCount(10);
    await expect(page.locator('#drill-sync-status')).toHaveText('Synchronisé');
    await page.evaluate(() => { window.drillAuthReviewOnline = 0; window.addEventListener('online', () => { window.drillAuthReviewOnline++; }); });
    page.on('request', request => { if (request.url().endsWith('/rest/v1/rpc/drill_record_answer')) requests.push(JSON.parse(request.postData())); });

    stage = 'interruption réelle du transport Auth et identité locale reconnue';
    let blocked = true;
    await page.route(`${student.environment.url}/auth/v1/user*`, route => blocked ? route.abort('failed') : route.continue());
    expect(await verifyAuth(page)).toEqual({ status: 'offline', userId: student.userId });
    await expect(page.locator('header').getByRole('link', { name: 'Mon profil', exact: true })).toHaveCount(0);

    stage = 'réponse locale persistée et tentative de vérification Auth interrompue';
    const question = page.locator('.drill-question').first();
    await question.getByRole('radio').first().check();
    await question.getByRole('button', { name: 'Valider cette réponse', exact: true }).click();
    await expect(question.locator('.drill-correction')).toBeVisible();
    await expect.poll(async () => (await personalRecord(page)).operations.some(operation => operation.type === 'answer' && operation.state === 'pending' && operation.rpcPayload !== null)).toBe(true);
    await expect(page.locator('#drill-sync-status')).toContainText('En attente de connexion');
    const before = await personalRecord(page); const operation = before.operations.find(item => item.type === 'answer');
    expect(requests).toEqual([]);

    stage = 'identité revérifiée, reprise automatique sans online ni retry Drill';
    blocked = false;
    expect(await verifyAuth(page)).toEqual({ status: 'authenticated', userId: student.userId });
    await expect(page.locator('#drill-sync-status')).toHaveText('Synchronisé');
    const after = await personalRecord(page); const confirmed = after.operations.find(item => item.id === operation.id);
    expect(confirmed).toMatchObject({ state: 'confirmed', payload: operation.payload, rpcPayload: operation.rpcPayload });
    expect(requests).toEqual([operation.rpcPayload]);
    expect(await page.evaluate(() => window.drillAuthReviewOnline)).toBe(0);
    await expect(question.locator('.drill-correction')).toBeVisible();

    stage = 'unicité PostgreSQL et absence de conversion en entraînement';
    await student.refresh();
    const answers = await student.client.from('drill_answers').select('operation_id,answer').eq('user_id', student.userId);
    const training = await student.client.from('drill_training_attempts').select('operation_id').eq('user_id', student.userId);
    expect(answers.error).toBeNull(); expect(answers.data).toEqual([{ operation_id: operation.id, answer: operation.payload.p_answer }]);
    expect(training.error).toBeNull(); expect(training.data).toEqual([]);
  } catch { failure = new Error(`Reprise Auth/Drill locale non validée : ${stage}. Aucun jeton ni identifiant sensible n’est journalisé.`); }
  finally { if (student) try { await student.cleanup(); } catch { failure = new Error('Nettoyage du seul compte fictif de reprise Auth incomplet.'); } }
  if (failure) throw failure;
});
