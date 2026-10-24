import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createDrillStudent, configureDrillPage, DRILL_LOCAL_URL, personalRecord, signInDrill } from '../helpers/drill-local.js';
import { makeSeries } from '../fixtures/drill.js';

const synced = page => expect(page.locator('#drill-sync-status')).toHaveText('Synchronisé');
async function respond(page, index = 0, training = false) {
  const question = page.locator('.drill-question').nth(index);
  if (training) await question.getByRole('button', { name: 'Revoir cette question', exact: true }).click();
  await question.getByRole('radio').first().check();
  await question.getByRole('button', { name: training ? 'Vérifier pour s’entraîner' : 'Valider cette réponse', exact: true }).click();
  await expect(question.locator('.drill-correction')).toBeVisible();
}
async function signOut(page) {
  await page.locator('header').getByRole('button', { name: 'Déconnexion', exact: true }).click();
  await expect(page.locator('main')).toContainText('Mode visiteur');
}

test('Drill réel : multi-appareils, insertion non acquittée, hors ligne persistant et comptes isolés', async ({ page, browser }) => {
  test.setTimeout(180000);
  const students = []; const contexts = []; let stage = 'comptes fictifs locaux'; let failure;
  try {
    const a = await createDrillStudent(); students.push(a); const b = await createDrillStudent(); students.push(b);
    await configureDrillPage(page, a.environment);
    const visitor = JSON.stringify({ version: 1, series: { 'uc3__2026-W41': makeSeries({ week: '2026-W41' }) }, future: 'préserver' });
    await page.addInitScript(raw => { if (!sessionStorage.getItem('drill-visitor-seeded')) { localStorage.setItem('bprea-demo-drill-v1', raw); sessionStorage.setItem('drill-visitor-seeded', 'yes'); }
      localStorage.setItem('bprea-demo-appearance-v1', '{"version":1,"season":"winter","brightness":"dark"}'); }, visitor);
    stage = 'connexion A et création de série'; await signInDrill(page, a);
    await page.getByRole('button', { name: 'Commencer cette série' }).click(); await synced(page);
    stage = 'première réponse, entraînement et rechargement'; await respond(page); await synced(page);
    await expect(page.locator('.drill-correction').first()).toBeFocused();
    await respond(page, 0, true); await synced(page);
    await expect(page.locator('.drill-correction').first()).toBeFocused();
    await page.reload(); await expect(page.locator('.drill-correction')).toHaveCount(1); await synced(page);

    stage = 'deuxième contexte avec le même compte';
    const context = await browser.newContext({ timezoneId: 'Europe/Paris', locale: 'fr-FR' }); contexts.push(context);
    const second = await context.newPage(); await configureDrillPage(second, a.environment); await signInDrill(second, a);
    await expect(second.locator('.drill-correction')).toHaveCount(1); await expect(second.locator('.drill-training-last')).toHaveCount(1); await synced(second);

    stage = 'réponse réseau perdue APRÈS insertion PostgreSQL';
    const lost = [];
    const pattern = '**/rest/v1/rpc/drill_record_answer';
    const intercept = async route => {
      lost.push(JSON.parse(route.request().postData()));
      const response = await route.fetch(); // The REAL PostgreSQL request completes first.
      if (lost.length === 1) await route.abort('failed'); else await route.fulfill({ response });
    };
    await page.route(pattern, intercept); await respond(page, 1);
    await expect.poll(() => lost.length).toBeGreaterThanOrEqual(2); await synced(page);
    expect(lost[0]).toEqual(lost[1]); await page.unroute(pattern, intercept);
    await a.refresh();
    const answers = await a.client.from('drill_answers').select('operation_id').eq('user_id', a.userId);
    expect(answers.error).toBeNull(); expect(answers.data).toHaveLength(2);

    stage = 'enregistrement hors ligne puis rechargement avec cache personnel';
    let blocked = true;
    const offline = route => blocked ? route.abort('failed') : route.continue();
    await page.route(`${a.environment.url}/**`, offline);
    await respond(page, 2); await expect(page.locator('#drill-sync-status')).toContainText(/attente|appareil/i);
    const beforeReload = await personalRecord(page); expect(beforeReload.operations.some(operation => operation.type === 'answer' && operation.state === 'pending')).toBe(true);
    await page.reload(); await expect(page.locator('.drill-correction')).toHaveCount(3);
    await expect(page.locator('#drill-sync-status')).toContainText(/attente|appareil/i);
    stage = 'retour réseau et reprise automatique'; blocked = false; await page.evaluate(() => window.dispatchEvent(new Event('online'))); await synced(page);
    await page.unroute(`${a.environment.url}/**`, offline);
    await a.refresh(); expect((await a.client.from('drill_answers').select('operation_id').eq('user_id', a.userId)).data).toHaveLength(3);

    stage = 'A déconnecté et B sans données A ou visiteur';
    await signOut(page); await signInDrill(page, b); await expect(page.locator('.drill-correction')).toHaveCount(0);
    await expect(page.locator('.drill-history')).not.toContainText('2026-W41');
    stage = 'mobile sombre et clavier'; await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Commencer cette série' }).click(); await synced(page);
    const radio = page.locator('.drill-question').first().getByRole('radio').first(); await radio.focus(); await radio.press('Space'); await expect(radio).toBeChecked();
    await page.locator('.drill-question').first().getByRole('button', { name: 'Valider cette réponse', exact: true }).press('Enter');
    await expect(page.locator('.drill-correction')).toHaveCount(1); await synced(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    stage = 'visiteur et historique préexistant conservés'; await signOut(page);
    expect(await page.evaluate(() => localStorage.getItem('bprea-demo-drill-v1'))).toBe(visitor);
    await expect(page.locator('.drill-history')).toContainText('2026-W41'); await expect(page.locator('.drill-correction')).toHaveCount(0);
    await b.refresh(); expect((await b.client.from('drill_answers').select('operation_id').eq('user_id', a.userId)).data).toEqual([]);
  } catch { failure = new Error(`Drill Supabase local non validé : ${stage}. Aucun identifiant, mot de passe ou jeton n’est journalisé.`); }
  finally {
    for (const context of contexts) await context.close();
    for (const student of students.toReversed()) try { await student.cleanup(); } catch { failure = new Error('Nettoyage des seuls comptes fictifs Drill incomplet.'); }
  }
  if (failure) throw failure;
});

test('Drill réel : conflits de première réponse et de snapshots sans écrasement local', async ({ page }) => {
  test.setTimeout(120000);
  let student; let release = () => {}; let failure; let stage = 'compte fictif local';
  try {
    student = await createDrillStudent(); await configureDrillPage(page, student.environment); await signInDrill(page, student);
    await page.getByRole('button', { name: 'Commencer cette série' }).click(); await synced(page);
    stage = 'première réponse concurrente acceptée avant la réponse locale';
    const pending = new Promise(resolve => { release = resolve; }); let waiting = false;
    const hold = async route => { waiting = true; await pending; await route.continue(); };
    await page.route('**/rest/v1/rpc/drill_record_answer', hold); await respond(page);
    await expect.poll(() => waiting).toBe(true);
    const saved = await personalRecord(page); const operation = saved.operations.find(item => item.type === 'answer');
    const question = saved.drill.series['uc3__2026-W42'].questions.find(item => item.id === operation.payload.p_question_id);
    const otherChoice = question.options.find(item => item.id !== operation.payload.p_answer).id;
    await student.refresh();
    const winner = await student.client.rpc('drill_record_answer', { ...operation.rpcPayload, p_operation_id: randomUUID(), p_answer: otherChoice });
    expect(winner.error).toBeNull(); expect(winner.data.status).toBe('inserted'); release();
    await expect(page.locator('#drill-sync-status')).toContainText('Conflit');
    const conflicted = await personalRecord(page); expect(conflicted.conflicts.find(item => item.kind === 'answer').local.answer).toBe(operation.payload.p_answer);
    expect(conflicted.drill.series['uc3__2026-W42'].answers[question.id].answer).toBe(otherChoice);
    await page.unroute('**/rest/v1/rpc/drill_record_answer', hold);
    await page.locator('.drill-sync-conflict').first().locator('summary').first().click();
    await page.getByRole('button', { name: 'Continuer avec la réponse du compte', exact: true }).click(); await synced(page);

    stage = 'deux snapshots pour une même UC et semaine';
    await page.goto(DRILL_LOCAL_URL.replace('2026-W42', '2026-W41'));
    let waitingSeries = false; const pause = new Promise(resolve => { release = resolve; });
    const holdSeries = async route => { waitingSeries = true; await pause; await route.continue(); };
    await page.route('**/rest/v1/rpc/drill_create_series', holdSeries);
    await page.getByRole('button', { name: 'Commencer cette série' }).click(); await expect.poll(() => waitingSeries).toBe(true);
    const local = await personalRecord(page); const creation = local.operations.find(item => item.type === 'series' && item.seriesKey === 'uc3__2026-W41');
    const different = structuredClone(creation.payload); different.p_questions[0].prompt = 'Snapshot distant réel conservé';
    await student.refresh(); const remote = await student.client.rpc('drill_create_series', different);
    expect(remote.error).toBeNull(); expect(remote.data.status).toBe('inserted'); release();
    await expect(page.locator('#drill-sync-status')).toContainText('Conflit');
    await page.locator('.drill-sync-conflict').filter({ hasText: '2026-W41' }).locator('summary').first().click();
    await page.getByRole('button', { name: 'Reprendre la série du compte', exact: true }).click();
    await expect(page.locator('.drill-question').first()).toContainText('Snapshot distant réel conservé'); await synced(page);
    const after = await personalRecord(page); const conflict = after.conflicts.find(item => item.kind === 'snapshot');
    expect(conflict.resolved).toBe(true); expect(conflict.local.questions[0].prompt).toBe(creation.payload.p_questions[0].prompt);
    await page.unroute('**/rest/v1/rpc/drill_create_series', holdSeries);
  } catch { failure = new Error(`Conflits Drill Supabase local non validés : ${stage}. Aucune réponse Auth brute n’est journalisée.`); }
  finally { release(); if (student) try { await student.cleanup(); } catch { failure = new Error('Nettoyage du seul compte fictif de conflit incomplet.'); } }
  if (failure) throw failure;
});
