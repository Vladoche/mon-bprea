import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { mkdtempSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { createDrillStudent, configureDrillPage, signInDrill } from '../helpers/drill-local.js';
import { seedPersonalTables, readPersonalTables } from '../helpers/personal-data-local.js';
import { LOCAL_SITE } from '../helpers/auth-local.js';
import { authIdentity, personalRecords } from '../helpers/personal-browser.js';
import { personalScope } from '../../assets/drill-personal-store.js';
import { TABLES } from '../../assets/export-sources.js';
import { questions, stamp, parameters } from '../fixtures/export.js';
import { botanicalSession, botanicalAnswer } from '../fixtures/personal-data.js';
import { closurePreflight, POLICY } from '../../scripts/preopening/preflight.mjs';
import { run } from '../../scripts/preopening/operator.mjs';
import { protectDirectory, createPrivate } from '../../scripts/dev-recipe/private-files.mjs';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });
async function invoke(student, token, body, method = 'POST') {
  return fetch(`${student.environment.url}/functions/v1/close-account`, { method,
    headers: { Origin: 'http://127.0.0.1:4173', Authorization: token ? `Bearer ${token}` : '', apikey: student.environment.publishableKey, 'Content-Type': 'application/json' },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
}
async function cachedCourse(page, action) {
  return page.evaluate(async action => {
    const app = new URL(document.querySelector('script[type="module"][src]').src), url = new URL('./course-quiz-service.js', app); url.search = app.search;
    const service = await (await import(url)).getCourseQuizService();
    if (action === 'write') return service.setCourseDone('matiere-organique', true);
    if (action === 'retry') await service.retry();
    return { mode: service.getState().mode, error: service.getState().view.error };
  }, action);
}
test('Recette C — Clôture réelle après copie : dix cascades, B intact, JWT résiduel/outbox hors ligne et reprise', async ({ page, browser }) => {
  test.setTimeout(150000); const students = []; let secondContext, stage = 'comptes fictifs', failure, closureHttp;
  page.on('response', response => { if (response.url().endsWith('/functions/v1/close-account')) closureHttp = response.status(); });
  try {
    const a = await createDrillStudent(); students.push(a); const b = await createDrillStudent(); students.push(b);
    stage = 'dix tables sous JWT étudiants'; await seedPersonalTables(a, 3); await seedPersonalTables(b, 2);
    const beforeA = await readPersonalTables(a), beforeB = await readPersonalTables(b);
    expect(Object.values(beforeA).every(rows => rows.length > 0)).toBe(true);
    const session = (await a.client.auth.getSession()).data.session;
    const token = session.access_token;
    const forged = token.split('.'); forged[1] = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(forged[1], 'base64url')), sub: b.userId })).toString('base64url');
    stage = 'attaques croisées sans suppression';
    for (const [body, bearer, method] of [
      [{ action: 'prepare', password: a.password, confirmation: 'SUPPRIMER', userId: b.userId }, token, 'POST'],
      [{ action: 'prepare', password: a.password, confirmation: 'SUPPRIMER' }, '', 'POST'],
      [{ action: 'prepare', password: a.password, confirmation: 'SUPPRIMER' }, 'invalid-jwt-synthetic', 'POST'],
      [{ action: 'prepare', password: a.password, confirmation: 'SUPPRIMER' }, forged.join('.'), 'POST'],
      [null, token, 'GET'],
    ]) expect((await invoke(a, bearer, body, method)).status >= 400).toBe(true);
    expect(JSON.stringify(await readPersonalTables(b))).toBe(JSON.stringify(beforeB));
    stage = 'second appareil hors ligne et outbox persistée';
    secondContext = await browser.newContext(); const second = await secondContext.newPage();
    await configureDrillPage(second, a.environment); await signInDrill(second, a);
    await second.goto(`${LOCAL_SITE}cours.html?id=matiere-organique`);
    await expect.poll(() => cachedCourse(second, 'state')).toEqual({ mode: 'personal', error: null });
    await secondContext.setOffline(true);
    expect((await cachedCourse(second, 'write')).savedLocally).toBe(true);
    const scope = personalScope({ environment: 'development', url: a.environment.url, userId: a.userId });
    await expect.poll(async () => (await personalRecords(second, 'mon-bprea-course-quiz-personal-v1')).find(record => record.scope === scope)?.operations.some(op => op.state === 'pending')).toBe(true);
    stage = 'réauthentification native et confirmation dans le profil';
    await configureDrillPage(page, a.environment);
    await page.route('**/assets/auth-config.json*', route => route.fulfill({ json: { enabled: true, environment: 'development', url: a.environment.url,
      publishableKey: a.environment.publishableKey, siteUrl: LOCAL_SITE, accountClosureLocalTest: true } }));
    await signInDrill(page, a); await page.goto(`${LOCAL_SITE}profil.html`);
    stage = 'copie sauvegardée avant clôture';
    await page.locator('[data-export-prepare]').click(); await expect(page.locator('[data-export-status]')).toContainText('Copie prête');
    const downloading = page.waitForEvent('download'); await page.locator('[data-export-download]').click();
    const copyPath = await (await downloading).path(), copyText = await readFile(copyPath, 'utf8'), copy = JSON.parse(copyText);
    expect(copy.sourceScope.userId === a.userId && Object.keys(copy.data.server).length === 10).toBe(true);
    // SQL snapshot orders by identity; export uses creation time + identity for
    // some histories. Compare the same rows, retaining every field and value.
    for (const [name, spec] of Object.entries(TABLES)) {
      stage = `copie sauvegardée : valeurs de ${name}`;
      const byIdentity = rows => [...rows].sort((a, b) => a[spec.key] < b[spec.key] ? -1 : a[spec.key] > b[spec.key] ? 1 : 0);
      expect(isDeepStrictEqual(byIdentity(copy.data.server[name]), byIdentity(beforeA[name]))).toBe(true);
    }
    stage = 'copie sauvegardée : exclusions et limites affichées';
    expect(copyText.includes(b.userId) || copyText.includes('access_token') || copyText.includes('refresh_token')).toBe(false);
    await expect(page.locator('.data-erasure')).toContainText('Un fichier déjà téléchargé ne peut pas être rappelé');
    await expect(page.locator('.data-erasure')).toContainText('Les appareils éteints ou hors ligne peuvent garder des caches');
    stage = 'formulaire local de clôture visible';
    await page.getByLabel('Mot de passe actuel', { exact: true }).fill(a.password);
    await page.getByLabel('Écris SUPPRIMER pour confirmer', { exact: true }).fill('SUPPRIMER');
    await page.getByRole('button', { name: 'Vérifier mon identité pour clôturer', exact: true }).click();
    stage = 'réponse de réauthentification native locale';
    await expect(page.locator('[data-closure-execute]')).toBeVisible();
    stage = 'commit réel puis perte du premier acquittement';
    let lost = false;
    await page.route(`${a.environment.url}/functions/v1/close-account`, async route => {
      if (route.request().method() !== 'POST' || route.request().postDataJSON().action !== 'execute' || lost) return route.continue();
      lost = true;
      const [response, duplicate] = await Promise.all([route.fetch(), invoke(a, route.request().headers().authorization.slice(7), route.request().postDataJSON())]);
      if (!response.ok() || !duplicate.ok) throw new Error('La double suppression locale réelle n’est pas confirmée côté service.');
      await route.abort('failed');
    });
    await page.locator('[data-closure-execute]').click();
    await expect(page.locator('[data-closure-status]')).toContainText('n’est pas confirmée');
    await page.locator('[data-closure-retry]').click(); await expect(page.locator('[data-closure-status]')).toContainText('Suppression serveur confirmée');
    await expect(page.locator('[data-closure-status]')).toContainText('Nettoyage local non effectué');
    stage = 'absence Auth et des dix tables vérifiée avec ancien JWT';
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url'));
    expect(claims.exp * 1000 > Date.now()).toBe(true);
    const old = createClient(a.environment.url, a.environment.publishableKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
    for (const [name, spec] of Object.entries(TABLES)) {
      const result = await old.from(name).select(spec.owner).eq(spec.owner, a.userId); expect(result.error === null && result.data.length === 0).toBe(true);
    }
    expect(Boolean((await a.client.auth.getUser(token)).error)).toBe(true);
    expect(Boolean((await a.client.auth.signInWithPassword({ email: a.email, password: a.password })).error)).toBe(true);
    stage = 'anti-résurrection sur toutes les racines et dépendances';
    const botanical = botanicalSession(`closure-${randomUUID()}`);
    const series = beforeA.drill_series[0];
    const forbidden = [
      ['drill_create_series', { p_unit: 'uc3', p_week: '2026-W44', p_started_at: stamp, p_questions: questions }],
      ['drill_record_answer', { p_series_id: series.id, p_question_id: questions[1].id, p_answer: questions[1].answer, p_answered_at: stamp, p_operation_id: randomUUID() }],
      ['drill_record_training', { p_series_id: series.id, p_question_id: questions[0].id, p_answer: questions[0].answer, p_answered_at: stamp, p_operation_id: randomUUID() }],
      ['personal_save_course', { p_lesson_id: 'matiere-organique', p_done: true, p_best_score: null, p_legacy_score: null, p_legacy_total: null, p_operation_id: randomUUID(), p_expected_revision: 0 }],
      ['personal_record_quiz', { p_attempt_id: randomUUID(), p_lesson_id: 'matiere-organique', p_score: 1, p_total: 1, p_completed_at: stamp }],
      ['personal_save_botanical_session', { p_session: botanical, p_operation_id: randomUUID(), p_expected_revision: 0 }],
      ['personal_record_botanical_answer', { p_answer: botanicalAnswer(botanical) }],
      ['personal_save_itk', { p_parameters: parameters, p_operation_id: randomUUID(), p_expected_revision: 0 }],
      ['personal_save_appearance', { p_preferences: { version: 1, season: 'auto', brightness: 'auto' }, p_operation_id: randomUUID(), p_expected_revision: 0 }],
    ];
    for (const [name, body] of forbidden) {
      const result = await old.rpc(name, body);
      // A gateway refusal or expired JWT would not prove the FK protection.
      expect([400, 403, 409].includes(result.status)).toBe(true);
      expect(['23503', '23514', '42501'].includes(result.error?.code)).toBe(true);
      if (['drill_create_series', 'personal_record_quiz', 'personal_save_itk', 'personal_save_appearance', 'personal_save_course', 'personal_save_botanical_session'].includes(name)) expect(result.error?.code === '23503').toBe(true);
    }
    const profileInsert = await old.from('profiles').insert({ id: a.userId });
    expect(profileInsert.error?.code === '42501').toBe(true);
    expect(claims.exp * 1000 > Date.now()).toBe(true);
    stage = 'retour réseau de l’ancien appareil sans transfert ou réécriture';
    await secondContext.setOffline(false); await authIdentity(second, { retry: true }); await cachedCourse(second, 'retry');
    await expect.poll(async () => (await authIdentity(second)).userId).toBeNull();
    stage = 'outbox restante du seul UUID supprimé';
    const local = (await personalRecords(second, 'mon-bprea-course-quiz-personal-v1')).find(record => record.scope === scope);
    expect(local.operations.some(op => op.state === 'pending')).toBe(true);
    stage = 'vue privée retirée après refus de l’identité';
    expect((await cachedCourse(second, 'state')).mode).toBe('visitor');
    await expect(second.locator('#course-quiz-sync-status')).toContainText('visiteur');
    await expect(second.locator('#mark-done')).not.toBeChecked();
    stage = 'dix tables toujours absentes et B inchangé après retour réseau';
    for (const [name, spec] of Object.entries(TABLES)) {
      const result = await old.from(name).select(spec.owner).eq(spec.owner, a.userId); expect(result.error === null && result.data.length === 0).toBe(true);
    }
    expect(JSON.stringify(await readPersonalTables(b))).toBe(JSON.stringify(beforeB));
    expect(await readFile(copyPath, 'utf8') === copyText).toBe(true);
  } catch { failure = new Error(`Clôture Supabase éphémère non validée : ${stage} (HTTP ${closureHttp || 'non reçu'}). Aucune session, clé ou donnée journalisée.`); }
  finally {
    await secondContext?.close(); await page.close();
    for (const student of students.toReversed()) try { await student.cleanup(); } catch { failure = new Error('Nettoyage ciblé des seuls comptes fictifs de clôture incomplet.'); }
    if (failure) throw failure;
  }
});

test('Clôture assistée native — préflight unitaire, dix cascades, refresh refusé et autre participant préservé', async () => {
  test.setTimeout(120000);
  const students = []; let a, attempted = false, confirmedAbsent = false, stage = 'fixtures isolées', failure;
  try {
    const dossier = mkdtempSync(resolve('.tmp/preopening-closure-'));
    protectDirectory(dossier);
    const receivedAt = new Date().toISOString();
    createPrivate(dossier, 'request.json', { syntheticOnly: true, reference: 'P0-13-SYNTHETIC-A', receivedAt,
      right: 'erasure-and-closure', identity: 'simulated-known-channel', decision: 'approved-local-only',
      acknowledgement: 'fictitious-no-message-sent', exportRequested: true });
    a = await createDrillStudent(); students.push(a);
    const b = await createDrillStudent(); students.push(b);
    // Le helper vérifie mon-bprea-lot6-1-local et 127.0.0.1:54321 AVANT la création.
    // Aucun A/B DEV historique, aucun titulaire ou e-mail réel.
    await seedPersonalTables(a, 1); await seedPersonalTables(b, 1);
    const beforeA = await readPersonalTables(a), beforeB = await readPersonalTables(b);
    expect(Object.values(beforeA).every(rows => rows.length > 0)).toBe(true);
    const session = (await a.client.auth.getSession()).data.session;
    const claims = JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url'));
    const admin = createClient(a.environment.url, a.environment.adminKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }).auth.admin;
    stage = 'inventaire Auth éphémère complet et borné';
    const accounts = []; let complete = false;
    for (let page = 1; page <= 100; page++) {
      const listed = await admin.listUsers({ page, perPage: 100 });
      expect(listed.error === null && Array.isArray(listed.data.users)).toBe(true);
      accounts.push(...listed.data.users.map(user => ({ id: user.id, email: user.email,
        kind: [a.userId, b.userId].includes(user.id) ? 'participant' : 'fixture',
        state: user.email_confirmed_at ? 'active' : 'pending', privileged: user.role !== 'authenticated' })));
      if (listed.data.users.length < 100) { complete = true; break; }
    }
    expect(complete).toBe(true);
    const now = new Date().toISOString();
    const plan = {
      target: { environment: 'local', projectRef: 'mon-bprea-lot6-1-local', siteUrl: LOCAL_SITE, callback: `${LOCAL_SITE}authentification.html` },
      inventory: { projectRef: 'mon-bprea-lot6-1-local', observedAt: now, complete: true, publicSignup: false, anonymousSignIn: false,
        // Participants synthétiques représentant la procédure future ; distincts des fictifs DEV réservés à D.
        accounts,
        dependenciesChecked: true, cascadeCount: 11, storageObjectsForTarget: 0,
        targetRows: Object.fromEntries(POLICY.tables.map(name => [name, beforeA[name].length])) },
      userId: a.userId, confirmUserId: a.userId, identityChecked: true, requestConfirmed: true, exportOffered: true, previousResult: 'none',
      sessionsPlan: 'native-delete-refresh-expiry-check', cachesPlan: 'assisted-per-device', backupsPlan: 'reconcile-before-restore', failurePlan: 'stop-read-state-no-blind-retry',
    };
    stage = 'préflight de la seule cible';
    expect(closurePreflight(plan, now).tablesChecked).toBe(10);
    createPrivate(dossier, 'closure.json', plan);
    expect(run(['closure', basename(dossier)], now).tablesChecked).toBe(10);
    // Export fictif préparé en mémoire ; aucun contenu pédagogique conservé comme preuve.
    const exportCopy = structuredClone(beforeA);
    expect(isDeepStrictEqual(exportCopy, beforeA)).toBe(true);
    expect(Boolean((await a.client.auth.getUser()).data.user?.id === a.userId)).toBe(true);
    stage = 'suppression administrative native unique'; attempted = true;
    const deletion = await admin.deleteUser(a.userId, false);
    expect(deletion.error === null).toBe(true);
    // Injection opérateur : considérer la réponse perdue. Aucune seconde mutation.
    expect(() => closurePreflight({ ...plan, previousResult: 'uncertain' }, new Date().toISOString()))
      .toThrow('uncertain_read_before_retry');
    stage = 'postcontrôle Auth avant toute confirmation';
    const lookup = await admin.getUserById(a.userId);
    confirmedAbsent = lookup.error?.status === 404 && lookup.error?.code === 'user_not_found';
    expect(confirmedAbsent).toBe(true);
    const old = createClient(a.environment.url, a.environment.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${session.access_token}` } },
    });
    stage = 'dix tables et autre participant';
    for (const [name, spec] of Object.entries(TABLES)) {
      const result = await old.from(name).select(spec.owner).eq(spec.owner, a.userId);
      expect(result.error === null && result.data.length === 0).toBe(true);
    }
    expect(isDeepStrictEqual(await readPersonalTables(b), beforeB)).toBe(true);
    createPrivate(dossier, 'deletions.json', [{ syntheticOnly: true, reference: 'P0-13-SYNTHETIC-A',
      projectRef: plan.target.projectRef, userId: a.userId, decidedAt: receivedAt, verifiedAt: new Date().toISOString(),
      scope: 'auth-and-ten-tables', auth: 'absent', tables: Object.fromEntries(POLICY.tables.map(t => [t, 0])),
      residuals: ['absent-device-cache', 'download-held-by-holder'], affectedCopies: [],
      nextAction: 'assisted-device-review', reviewDueAt: new Date(Date.now() + 86400000).toISOString() }]);
    createPrivate(dossier, 'response.json', { syntheticOnly: true, reference: 'P0-13-SYNTHETIC-A',
      serverVerified: true, witnessPreserved: true, sent: false,
      text: 'Clôture serveur vérifiée. Appareils absents et copies téléchargées à suivre séparément.',
      dossierStatus: 'server-closed-residual-followup-open' });
    stage = 'ancien refresh et reconnexion refusés';
    const detached = createClient(a.environment.url, a.environment.publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    expect(Boolean((await detached.auth.refreshSession({ refresh_token: session.refresh_token })).error)).toBe(true);
    expect(Boolean((await detached.auth.signInWithPassword({ email: a.email, password: a.password })).error)).toBe(true);
    stage = 'JWT encore non expiré et écriture empêchée par la dépendance réelle';
    expect(claims.exp * 1000 > Date.now()).toBe(true);
    const write = await old.rpc('personal_record_quiz', { p_attempt_id: randomUUID(), p_lesson_id: 'matiere-organique', p_score: 1, p_total: 1, p_completed_at: stamp });
    expect(write.error?.code === '23503').toBe(true);
    expect(claims.exp * 1000 > Date.now()).toBe(true);
    expect(isDeepStrictEqual(await readPersonalTables(b), beforeB)).toBe(true);
  } catch { failure = new Error(`Clôture native locale non validée : ${stage}. Aucun identifiant, secret ou résultat journalisé.`); }
  finally {
    for (const student of students.toReversed()) {
      // Une suppression tentée n'est jamais répétée aveuglément ; en cas d'incertitude,
      // échec explicite puis retrait de la seule stack éphémère par le workflow existant.
      if (student === a && attempted) {
        if (!confirmedAbsent && !failure) failure = new Error('Clôture native locale incertaine : postcontrôle requis, aucune répétition.');
        continue;
      }
      try { await student.cleanup(); } catch { failure = new Error('Nettoyage ciblé des seules fixtures de clôture native incomplet.'); }
    }
    if (failure) throw failure;
  }
});
