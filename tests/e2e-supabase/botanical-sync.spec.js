import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { createDrillStudent, configureDrillPage, signInDrill } from '../helpers/drill-local.js';
import { botanicalSession, botanicalAnswer } from '../fixtures/personal-data.js';
import {
  botanicalBank, botanicalStorageKey, botanicalPath, botanicalSynced, refreshBotanical,
  startBotanical, answerBotanical, nextBotanical, finishBotanical, expectBotanicalHistory, botanicalRecords, botanicalMetric,
} from '../helpers/botanical-browser.js';

// Only the guarded ephemeral local fixture creates accounts. All pedagogical
// writes and assertions below use actual JWTs, PostgREST and PostgreSQL.
async function signIn(page, student) {
  await signInDrill(page, student); await page.goto(botanicalPath); await botanicalSynced(page);
}
async function signOut(page) {
  await page.locator('header').getByRole('button', { name: 'Déconnexion', exact: true }).click();
  await expect(page.locator('#botanical-sync-status')).toContainText('visiteur');
}
async function rows(student, table) {
  await student.refresh();
  const result = await student.client.from(table).select('*').eq('user_id', student.userId);
  expect(result.error).toBeNull(); return result.data;
}
async function diagnostic(page) {
  try { return await page.locator('#botanical-sync-status').textContent(); } catch { return 'page indisponible'; }
}
async function cleanup(students, contexts, failure) {
  for (const context of contexts) await context.close();
  for (const student of students.toReversed()) try { await student.cleanup(); }
  catch { failure = new Error('Nettoyage incomplet des seuls comptes fictifs botaniques locaux.'); }
  if (failure) throw failure;
}
function importSource() {
  const plant = botanicalBank.species.find(item => item.categoryIds.includes('petits-fruits'));
  const otherPlant = botanicalBank.species.find(item => item.id !== plant.id && item.categoryIds.includes('petits-fruits'));
  const photo = botanicalBank.photos.find(item => item.speciesId === plant.id);
  const s1 = botanicalSession('botanical-import-one', { mode: 'discovery', completedAt: '2026-10-21T12:05:00.000Z' });
  const s2 = botanicalSession('botanical-import-two', { mode: 'discovery', completedAt: '2026-10-21T12:05:00.000Z' });
  return JSON.stringify({ schemaVersion: 1, sessions: [s1, s2], answers: [
    botanicalAnswer(s1, 1, { speciesId: plant.id, photoId: photo.id, selectedSpeciesId: plant.id }),
    botanicalAnswer(s2, 1, { speciesId: plant.id, photoId: photo.id, status: 'incorrect', selectedSpeciesId: otherPlant.id, correct: false }),
    botanicalAnswer(botanicalSession('absent-parent'), 1, { speciesId: plant.id, photoId: photo.id, selectedSpeciesId: plant.id }),
  ], historicalField: { preserved: true } });
}

test('Botanique réelle A : deux appareils, historique réconcilié et nouvelle révision des erreurs', async ({ page, browser }) => {
  test.setTimeout(120000);
  const students = [], contexts = []; let stage = 'compte local', failure;
  try {
    const a = await createDrillStudent(); students.push(a);
    await configureDrillPage(page, a.environment); await signIn(page, a);
    stage = 'session Découverte'; await startBotanical(page); await answerBotanical(page);
    await nextBotanical(page); const wrong = await answerBotanical(page, false); await finishBotanical(page); await botanicalSynced(page);
    await expectBotanicalHistory(page, { attempted: 2, correct: 1, incorrect: 1, timeouts: 0, rate: '50 %' });
    const firstRows = await rows(a, 'botanical_answers'); expect(firstRows).toHaveLength(2);
    const sessions = await rows(a, 'botanical_sessions'); expect(sessions).toHaveLength(1);
    expect(sessions[0].revision).toBe(2); expect(sessions[0].completed_at).not.toBeNull();
    expect(sessions[0].total_questions).toBe(4);
    expect(Date.parse(sessions[0].completed_at)).toBeGreaterThanOrEqual(Math.max(...firstRows.map(row => Date.parse(row.answered_at))));
    stage = 'deuxième appareil';
    const context = await browser.newContext({ timezoneId: 'Europe/Paris', locale: 'fr-FR' }); contexts.push(context);
    const second = await context.newPage(); await configureDrillPage(second, a.environment); await signIn(second, a);
    await expectBotanicalHistory(second, { attempted: 2, correct: 1, incorrect: 1, rate: '50 %' });
    await expect(second.locator('.bot-revision')).toContainText('1 espèce à retravailler');
    stage = 'révision sur le deuxième appareil'; await startBotanical(second, { revision: true });
    const revised = await answerBotanical(second); expect(revised.plant.id).toBe(wrong.plant.id);
    await nextBotanical(second); await botanicalSynced(second);
    await refreshBotanical(page);
    await expectBotanicalHistory(page, { attempted: 3, correct: 2, incorrect: 1, timeouts: 0, rate: '67 %' });
    const final = await rows(a, 'botanical_answers'); expect(final).toHaveLength(3);
    expect(new Set(final.map(row => row.answer_id)).size).toBe(3);
    expect(final.find(row => row.status === 'incorrect').species_id).toBe(wrong.plant.id);
    expect(final.filter(row => row.is_revision)).toHaveLength(1);
    await page.getByRole('button', { name: 'Choisir une nouvelle session', exact: true }).click();
    await expect(page.locator('.bot-revision')).toContainText('1 espèce à retravailler');
  } catch { failure = new Error(`Botanique locale multi-appareils non validée : ${stage}. État : ${await diagnostic(page)}.`); }
  finally { await cleanup(students, contexts, failure); }
});

test('Botanique réelle B : session entièrement hors ligne, rechargement, dépendances et perte HTTP après commit', async ({ page, browser }) => {
  test.setTimeout(120000);
  const students = [], contexts = []; let stage = 'compte local', failure;
  try {
    const a = await createDrillStudent(); students.push(a);
    await configureDrillPage(page, a.environment); await signIn(page, a);
    const outagePattern = `${a.environment.url}/rest/v1/**`, outage = route => route.abort('failed');
    await page.route(outagePattern, outage);
    stage = 'jeu intégralement hors réseau'; await startBotanical(page); await answerBotanical(page);
    await nextBotanical(page); await answerBotanical(page, false); await finishBotanical(page);
    await expectBotanicalHistory(page, { attempted: 2, correct: 1, incorrect: 1, rate: '50 %' });
    expect(await rows(a, 'botanical_sessions')).toHaveLength(0);
    const before = (await botanicalRecords(page))[0]; expect(before.operations.filter(op => op.state === 'pending').length).toBeGreaterThanOrEqual(4);
    await page.reload(); await expectBotanicalHistory(page, { attempted: 2, correct: 1, incorrect: 1, rate: '50 %' });
    const reloaded = (await botanicalRecords(page))[0]; expect(reloaded.operations.map(op => op.id)).toEqual(before.operations.map(op => op.id));
    stage = 'reprise et acquittement perdu après commit réel'; await page.unroute(outagePattern, outage);
    const sent = [], rpc = '**/rest/v1/rpc/personal_record_botanical_answer';
    const lose = async route => {
      sent.push(JSON.parse(route.request().postData())); const response = await route.fetch();
      if (sent.length === 1) await route.abort('failed'); else await route.fulfill({ response });
    };
    await page.route(rpc, lose); await page.getByRole('button', { name: 'Actualiser l’historique', exact: true }).click();
    await expect.poll(() => sent.length).toBeGreaterThanOrEqual(3); await botanicalSynced(page);
    expect(sent[0]).toEqual(sent[1]); await page.unroute(rpc, lose);
    const sessions = await rows(a, 'botanical_sessions'), answers = await rows(a, 'botanical_answers');
    expect(sessions).toHaveLength(1); expect(answers).toHaveLength(2); expect(sessions[0].revision).toBe(2);
    expect(sessions[0].completed_at).not.toBeNull(); expect(new Set(answers.map(row => row.question_id)).size).toBe(2);
    await refreshBotanical(page); expect(await rows(a, 'botanical_answers')).toHaveLength(2);
    stage = 'nouvel appareil après reprise';
    const context = await browser.newContext({ timezoneId: 'Europe/Paris', locale: 'fr-FR' }); contexts.push(context);
    const second = await context.newPage(); await configureDrillPage(second, a.environment); await signIn(second, a);
    await expectBotanicalHistory(second, { attempted: 2, correct: 1, incorrect: 1, rate: '50 %' });
  } catch { failure = new Error(`Reprise botanique Supabase locale non validée : ${stage}. État : ${await diagnostic(page)}.`); }
  finally { await cleanup(students, contexts, failure); }
});

test('Botanique réelle C : quatre statuts, taux exact, arrêt partiel et erreur conservée après réussite', async ({ page }) => {
  test.setTimeout(120000);
  const students = []; let stage = 'compte local', failure;
  try {
    const a = await createDrillStudent(); students.push(a);
    await configureDrillPage(page, a.environment); await signIn(page, a);
    await startBotanical(page, { mode: 'chrono' }); await answerBotanical(page);
    await nextBotanical(page); await answerBotanical(page, false);
    stage = 'expiration Chrono'; await nextBotanical(page);
    await expect(page.getByRole('img', { name: /^Photographie à identifier/ })).toBeVisible();
    await page.clock.fastForward(15000); await expect(page.locator('#bot-feedback')).toContainText('Temps écoulé');
    stage = 'image indisponible'; const images = '**/assets/botanical-photos/**', unavailable = route => route.abort();
    await page.route(images, unavailable); await nextBotanical(page);
    await page.getByRole('button', { name: 'Passer sans compter', exact: true }).click();
    await page.unroute(images, unavailable); await finishBotanical(page); await botanicalSynced(page);
    await expectBotanicalHistory(page, { attempted: 3, correct: 1, incorrect: 1, timeouts: 1, rate: '33 %' });
    const answers = await rows(a, 'botanical_answers'); expect(answers).toHaveLength(4);
    expect(answers.map(row => row.status).sort()).toEqual(['correct', 'incorrect', 'skipped_image', 'timeout']);
    stage = 'révision partielle'; await page.getByRole('button', { name: 'Choisir une nouvelle session', exact: true }).click();
    await startBotanical(page, { revision: true }); await answerBotanical(page); await finishBotanical(page); await botanicalSynced(page);
    await expectBotanicalHistory(page, { attempted: 4, correct: 2, incorrect: 1, timeouts: 1, rate: '50 %' });
    const after = await rows(a, 'botanical_answers'); expect(after).toHaveLength(5);
    expect(after.filter(row => row.status === 'incorrect')).toHaveLength(1); expect(after.filter(row => row.status === 'timeout')).toHaveLength(1);
    stage = 'session sans réponse'; await page.getByRole('button', { name: 'Choisir une nouvelle session', exact: true }).click();
    await startBotanical(page); await finishBotanical(page); await botanicalSynced(page);
    expect(await rows(a, 'botanical_answers')).toHaveLength(5); expect(await rows(a, 'botanical_sessions')).toHaveLength(3);
    await expectBotanicalHistory(page, { attempted: 4, correct: 2, incorrect: 1, timeouts: 1, rate: '50 %' });
  } catch { failure = new Error(`Statistiques botaniques Supabase locales non validées : ${stage}. État : ${await diagnostic(page)}.`); }
  finally { await cleanup(students, [], failure); }
});

test('Botanique réelle D : A, B et visiteur séparés sur le même navigateur, RLS et historique immuable', async ({ page }) => {
  test.setTimeout(120000);
  const students = []; let stage = 'comptes locaux', failure;
  const raw = importSource();
  try {
    const a = await createDrillStudent(), b = await createDrillStudent(); students.push(a, b);
    await configureDrillPage(page, a.environment);
    await page.addInitScript(source => { if (!sessionStorage.getItem('botanical-account-seeded')) { localStorage.setItem('monbprea.botanical.v1', source); sessionStorage.setItem('botanical-account-seeded', 'yes'); } }, raw);
    await signIn(page, a); await expectBotanicalHistory(page, { attempted: 0 });
    await startBotanical(page); await answerBotanical(page); await nextBotanical(page); await answerBotanical(page, false); await finishBotanical(page); await botanicalSynced(page);
    stage = 'A vers B pendant une session'; await page.getByRole('button', { name: 'Choisir une nouvelle session', exact: true }).click();
    await startBotanical(page); await page.getByRole('group', { name: 'Quatre propositions' }).getByRole('button').first().click();
    await signOut(page); await expect(page.getByRole('group', { name: 'Quatre propositions' })).toHaveCount(0);
    await expectBotanicalHistory(page, { attempted: 3, correct: 2, incorrect: 1, rate: '67 %' });
    await signIn(page, b); await expectBotanicalHistory(page, { attempted: 0 });
    await startBotanical(page); await answerBotanical(page, false); await finishBotanical(page); await botanicalSynced(page);
    await signOut(page); await signIn(page, a); await expectBotanicalHistory(page, { attempted: 2, correct: 1, incorrect: 1, rate: '50 %' });
    expect(await rows(a, 'botanical_answers')).toHaveLength(2); expect(await rows(b, 'botanical_answers')).toHaveLength(1);
    expect(await botanicalRecords(page)).toHaveLength(2);
    stage = 'contrôles PostgreSQL des propriétaires'; await b.refresh();
    for (const table of ['botanical_sessions', 'botanical_answers']) {
      const foreign = await b.client.from(table).select('*').eq('user_id', a.userId);
      expect(foreign.error).toBeNull(); expect(foreign.data).toEqual([]);
    }
    await a.refresh(); expect((await a.client.from('botanical_answers').update({ correct: false }).eq('user_id', a.userId)).error).not.toBeNull();
    const anonymous = createClient(a.environment.url, a.environment.publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    expect((await anonymous.from('botanical_answers').select('*')).error).not.toBeNull();
    expect(await page.evaluate(key => localStorage.getItem(key), botanicalStorageKey)).toBe(raw);
  } catch { failure = new Error(`Isolation botanique Supabase locale non validée : ${stage}. État : ${await diagnostic(page)}.`); }
  finally { await cleanup(students, [], failure); }
});

test('Botanique réelle E : import volontaire, orpheline conservée, reprise et second appareil sans doublons', async ({ page, browser }) => {
  test.setTimeout(120000);
  const students = [], contexts = []; let stage = 'compte local', failure;
  const raw = importSource();
  try {
    const a = await createDrillStudent(); students.push(a); await configureDrillPage(page, a.environment);
    await page.addInitScript(source => { if (!sessionStorage.getItem('botanical-import-seeded')) { localStorage.setItem('monbprea.botanical.v1', source); sessionStorage.setItem('botanical-import-seeded', 'yes'); } }, raw);
    await signIn(page, a); await expectBotanicalHistory(page, { attempted: 0 }); expect(await rows(a, 'botanical_answers')).toHaveLength(0);
    const open = () => page.getByRole('button', { name: 'Importer l’historique de cet appareil', exact: true }).click();
    stage = 'prévisualisation puis annulation'; await open();
    await expect(page.getByRole('dialog')).toContainText(/autre personne|pas nécessairement liée|autre utilisateur/i);
    await expect(page.getByRole('dialog')).toContainText(/orpheline|non transfér|sans session/i);
    await page.getByRole('button', { name: 'Annuler', exact: true }).click(); expect(await rows(a, 'botanical_answers')).toHaveLength(0);
    stage = 'confirmation et interruption réseau'; await open();
    const pattern = `${a.environment.url}/rest/v1/rpc/**`, outage = route => route.abort('failed'); await page.route(pattern, outage);
    await page.getByRole('button', { name: 'Confirmer l’import', exact: true }).click();
    await expectBotanicalHistory(page, { attempted: 2, correct: 1, incorrect: 1, rate: '50 %' });
    const document = (await botanicalRecords(page))[0]; expect(document.imports).toHaveLength(1);
    expect(JSON.stringify(document.imports)).toContain('absent-parent');
    await page.reload(); await expectBotanicalHistory(page, { attempted: 2, correct: 1, incorrect: 1, rate: '50 %' });
    await page.unroute(pattern, outage); await refreshBotanical(page);
    expect(await rows(a, 'botanical_sessions')).toHaveLength(2); expect(await rows(a, 'botanical_answers')).toHaveLength(2);
    stage = 'réimport des mêmes identités'; await open();
    const confirm = page.getByRole('button', { name: 'Confirmer l’import', exact: true });
    if (await confirm.isEnabled()) await confirm.click(); else await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    await refreshBotanical(page); expect(await rows(a, 'botanical_answers')).toHaveLength(2);
    expect((await botanicalRecords(page))[0].imports).toHaveLength(1);
    expect(await page.evaluate(key => localStorage.getItem(key), botanicalStorageKey)).toBe(raw);
    stage = 'historique importé sur un autre navigateur';
    const context = await browser.newContext({ timezoneId: 'Europe/Paris', locale: 'fr-FR' }); contexts.push(context);
    const second = await context.newPage(); await configureDrillPage(second, a.environment); await signIn(second, a);
    await expectBotanicalHistory(second, { attempted: 2, correct: 1, incorrect: 1, rate: '50 %' });
  } catch { failure = new Error(`Import botanique Supabase local non validé : ${stage}. État : ${await diagnostic(page)}.`); }
  finally { await cleanup(students, contexts, failure); }
});

test('Botanique réelle F : résultat divergent conservé en conflit, version serveur et résolution explicite', async ({ page }) => {
  test.setTimeout(90000);
  const students = []; let release = () => {}, stage = 'compte local', failure;
  try {
    const a = await createDrillStudent(); students.push(a); await configureDrillPage(page, a.environment); await signIn(page, a);
    await startBotanical(page); await botanicalSynced(page);
    let held; const waiting = new Promise(resolve => { release = resolve; });
    const pattern = '**/rest/v1/rpc/personal_record_botanical_answer';
    const hold = async route => { held = JSON.parse(route.request().postData()); await waiting; await route.continue(); };
    await page.route(pattern, hold); await answerBotanical(page); await expect.poll(() => Boolean(held)).toBe(true);
    stage = 'deuxième réponse réellement inscrite sous la même identité'; await a.refresh();
    const otherPlant = botanicalBank.species.find(item => item.id !== held.p_answer.speciesId && item.categoryIds.includes(held.p_answer.categoryId));
    const divergent = { ...held.p_answer, status: 'incorrect', selectedSpeciesId: otherPlant.id, correct: false };
    const winner = await a.client.rpc('personal_record_botanical_answer', { p_answer: divergent });
    expect(winner.error).toBeNull(); expect(winner.data.status).toBe('inserted'); release();
    await expect(page.locator('#botanical-sync-status')).toContainText('Conflit'); await page.unroute(pattern, hold);
    const document = (await botanicalRecords(page))[0]; expect(document.conflicts.some(item => !item.resolved)).toBe(true);
    expect(await rows(a, 'botanical_answers')).toHaveLength(1);
    expect((await rows(a, 'botanical_answers'))[0].status).toBe('incorrect');
    await expectBotanicalHistory(page, { attempted: 1, correct: 0, incorrect: 1, rate: '0 %' });
    stage = 'résolution explicite sans nouvelle réponse';
    await page.locator('.botanical-conflict').first().locator('summary').click();
    await page.getByRole('button', { name: 'Garder la version du compte', exact: true }).click(); await botanicalSynced(page);
    const resolved = (await botanicalRecords(page))[0]; expect(resolved.conflicts.every(item => item.resolved)).toBe(true);
    expect(await rows(a, 'botanical_answers')).toHaveLength(1);
    await finishBotanical(page); await botanicalSynced(page); expect(await rows(a, 'botanical_sessions')).toHaveLength(1);
    await expect(botanicalMetric(page.locator('#bot-content'), 'Questions réalisées')).toHaveText('1');
    await expect(botanicalMetric(page.locator('#bot-content'), 'Réponses correctes')).toHaveText('0');
    await expect(botanicalMetric(page.locator('#bot-content'), 'Réponses incorrectes')).toHaveText('1');
  } catch { failure = new Error(`Conflit botanique Supabase local non validé : ${stage}. État : ${await diagnostic(page)}.`); }
  finally { release(); await cleanup(students, [], failure); }
});
