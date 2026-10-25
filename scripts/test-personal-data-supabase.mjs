// Lot 6.3.1 : uniquement la stack Supabase LOCALE dédiée et de vrais JWT.
// Aucune requête administrative n'effectue une assertion métier/RLS.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createLocalAuthFixture, getLocalSupabaseEnvironment } from '../tests/helpers/auth-local.js';
import {
  PERSONAL_DATA_TIME as timestamp, learningDocument, botanicalSession,
  botanicalAnswer, itkParameters, appearancePreferences,
} from '../tests/fixtures/personal-data.js';

const fixtures = [];
const students = [];
let environment;
let passed = 0;

function accepted(result, label) {
  assert.equal(result.error, null, `${label} : la requête réelle devait être acceptée.`);
  return result.data;
}

function rejected(result, label, codes = null) {
  assert.ok(result.error, `${label} : la requête réelle devait être refusée.`);
  if (codes) assert.ok(codes.includes(result.error.code), `${label} : code de refus inattendu (${result.error.code}).`);
  return result.error;
}

async function check(label, action) {
  await action();
  passed += 1;
  console.log(`OK Données personnelles ${passed} — ${label}`);
}

function client() {
  return createClient(environment.url, environment.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, flowType: 'pkce' },
  });
}

async function activateStudent() {
  const fixture = createLocalAuthFixture(environment);
  fixtures.push(fixture);
  const callback = new URL(await fixture.invite());
  const userClient = client();
  const data = accepted(await userClient.auth.verifyOtp({
    type: 'invite', token_hash: callback.searchParams.get('token_hash'),
  }), 'Activation de l’invité fictif local');
  assert.ok(data.user?.id && data.session?.access_token, 'Une vraie session Auth est requise.');
  const student = { client: userClient, id: data.user.id, token: data.session.access_token };
  students.push(student);
  return student;
}

async function rpc(student, name, input, status = null) {
  const data = accepted(await student.client.rpc(name, input), name);
  assert.ok(data && typeof data === 'object' && data.row, `${name} : résultat contractuel absent.`);
  if (status) assert.equal(data.status, status, `${name} : statut métier inattendu.`);
  assert.equal(data.row.user_id, student.id, `${name} : seul le propriétaire authentifié peut être retourné.`);
  return data;
}

async function rows(student, table, filters = {}) {
  let query = student.client.from(table).select('*');
  for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
  return accepted(await query, `Lecture ${table}`);
}

async function raw(student, path, method = 'GET', body = undefined, token = student?.token) {
  const headers = { apikey: environment.publishableKey, Prefer: 'return=representation' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${environment.url}/rest/v1/${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  let data;
  try { data = await response.json(); } catch { data = null; }
  return { status: response.status, ok: response.ok, data };
}

function deniedRaw(result, label, code = null) {
  assert.equal(result.ok, false, `${label} : PostgREST devait refuser l’écriture directe.`);
  if (code) assert.equal(result.data?.code, code, `${label} : code PostgreSQL inattendu.`);
}

const tables = ['course_states', 'quiz_attempts', 'botanical_sessions', 'botanical_answers', 'itk_settings', 'appearance_preferences'];
const mutableTables = ['course_states', 'botanical_sessions', 'itk_settings', 'appearance_preferences'];
const courseInput = (patch = {}) => ({
  p_lesson_id: 'matiere-organique', p_done: true, p_best_score: 3,
  p_legacy_score: 2, p_legacy_total: 3,
  p_operation_id: randomUUID(), p_expected_revision: 0, ...patch,
});
const quizInput = (patch = {}) => ({
  p_attempt_id: randomUUID(), p_lesson_id: 'matiere-organique',
  p_score: 3, p_total: 3, p_completed_at: timestamp, ...patch,
});
const sessionInput = (session, patch = {}) => ({
  p_session: session, p_operation_id: randomUUID(), p_expected_revision: 0, ...patch,
});
const itkInput = (patch = {}) => ({
  p_parameters: itkParameters, p_operation_id: randomUUID(), p_expected_revision: 0, ...patch,
});
const appearanceInput = (patch = {}) => ({
  p_preferences: appearancePreferences, p_operation_id: randomUUID(), p_expected_revision: 0, ...patch,
});

async function one(student, table, filters = {}) {
  const found = await rows(student, table, filters);
  assert.equal(found.length, 1, `Une ligne personnelle attendue dans ${table}.`);
  return found[0];
}

async function race(student, name, first, second) {
  const results = await Promise.all([rpc(student, name, first), rpc(student, name, second)]);
  assert.deepEqual(results.map(result => result.status).sort(), ['conflict', 'updated'], `${name} : un seul gagnant CAS.`);
  const winner = results.find(result => result.status === 'updated');
  assert.deepEqual(results.find(result => result.status === 'conflict').row, winner.row, `${name} : conflit retourne la version gagnante.`);
  return winner.row;
}

async function createRace(student, name, input) {
  const results = await Promise.all([rpc(student, name, input), rpc(student, name, input)]);
  assert.deepEqual(results.map(result => result.status).sort(), ['inserted', 'replayed'], `${name} : création concurrente unique.`);
  assert.deepEqual(results[0].row, results[1].row, `${name} : les deux accusés désignent la même ligne.`);
  return results[0].row;
}

try {
  // Cette garde précède toute création de client, invitation ou nettoyage.
  environment = getLocalSupabaseEnvironment();
  let a;
  let b;
  await check('Deux invitations locales activées et deux vrais JWT étudiants', async () => {
    a = await activateStudent();
    b = await activateStudent();
    assert.notEqual(a.id, b.id);
    for (const student of [a, b]) {
      assert.equal(accepted(await student.client.auth.getUser(), 'Validation Auth serveur').user.id, student.id);
      const claims = JSON.parse(Buffer.from(student.token.split('.')[1], 'base64url').toString('utf8'));
      assert.equal(claims.role, 'authenticated');
      assert.equal(claims.sub, student.id);
    }
  });

  const own = {};
  const other = {};
  const initialCourse = courseInput();
  const session = botanicalSession();
  const initialSession = sessionInput(session);
  const initialItk = itkInput();
  const initialAppearance = appearanceInput();
  let quiz;
  let answer;

  await check('Cours : création idempotente, score ancien sans date pédagogique inventée', async () => {
    own.course_states = await createRace(a, 'personal_save_course', initialCourse);
    assert.equal(own.course_states.done, true);
    assert.equal(own.course_states.best_score, learningDocument['matiere-organique'].score);
    assert.equal(own.course_states.legacy_score, 2);
    assert.equal(own.course_states.legacy_total, 3);
    assert.equal(own.course_states.revision, 1);
    assert.equal(own.course_states.base_revision, 0);
    assert.deepEqual((await rpc(a, 'personal_save_course', initialCourse, 'replayed')).row, own.course_states);
    assert.equal((await rows(a, 'course_states')).length, 1);
    assert.deepEqual(await rows(a, 'quiz_attempts'), [], 'Le score ancien ne crée aucune tentative datée.');
  });

  await check('Cours décoché explicitement, retry divergent et révision obsolète sans écrasement', async () => {
    const uncheck = courseInput({ p_done: false, p_expected_revision: 1 });
    own.course_states = (await rpc(a, 'personal_save_course', uncheck, 'updated')).row;
    assert.equal(own.course_states.done, false);
    assert.equal(own.course_states.best_score, 3);
    assert.equal(own.course_states.revision, 2);
    assert.deepEqual((await rpc(a, 'personal_save_course', uncheck, 'replayed')).row, own.course_states);
    assert.deepEqual((await rpc(a, 'personal_save_course', { ...uncheck, p_done: true }, 'conflict')).row, own.course_states);
    assert.deepEqual((await rpc(a, 'personal_save_course', initialCourse, 'conflict')).row, own.course_states);
    assert.equal((await one(a, 'course_states')).done, false);
  });

  await check('Cours : deux versions concurrentes, un seul gagnant et retry supersédé en conflit', async () => {
    own.course_states = await race(a, 'personal_save_course',
      courseInput({ p_done: true, p_expected_revision: 2 }),
      courseInput({ p_done: false, p_expected_revision: 2 }));
    assert.equal(own.course_states.revision, 3);
    assert.deepEqual(await one(a, 'course_states'), own.course_states);
    assert.deepEqual((await rpc(a, 'personal_save_course', initialCourse, 'conflict')).row, own.course_states);
    rejected(await a.client.rpc('personal_save_course', courseInput({ p_best_score: 2, p_expected_revision: 3 })), 'Meilleur score historique ne peut diminuer');
    rejected(await a.client.rpc('personal_save_course', courseInput({ p_legacy_score: null, p_legacy_total: null, p_expected_revision: 3 })), 'Score ancien ne peut disparaître');
    assert.deepEqual(await one(a, 'course_states'), own.course_states);
  });

  await check('QCM : deux tentatives réellement identiques restent distinctes, retry sans doublon', async () => {
    const input = quizInput();
    quiz = (await rpc(a, 'personal_record_quiz', input, 'inserted')).row;
    assert.deepEqual((await rpc(a, 'personal_record_quiz', input, 'replayed')).row, quiz);
    await rpc(a, 'personal_record_quiz', { ...input, p_attempt_id: randomUUID() }, 'inserted');
    assert.equal((await rows(a, 'quiz_attempts')).length, 2);
    assert.equal(Date.parse(quiz.completed_at), Date.parse(timestamp));
    assert.ok(Number.isFinite(Date.parse(quiz.created_at)));
    assert.deepEqual((await rpc(a, 'personal_record_quiz', { ...input, p_score: 1 }, 'conflict')).row, quiz);
    assert.deepEqual(await one(a, 'course_states'), own.course_states, 'Un append QCM ne réactive pas un cours décoché.');
  });

  await check('QCM : insertion simultanée avec même identité et vrai historique paginé', async () => {
    const input = quizInput();
    const results = await Promise.all([rpc(a, 'personal_record_quiz', input), rpc(a, 'personal_record_quiz', input)]);
    assert.deepEqual(results.map(result => result.status).sort(), ['inserted', 'replayed']);
    assert.deepEqual(results[0].row, results[1].row);
    const all = accepted(await a.client.from('quiz_attempts').select('*').order('created_at').order('attempt_id'), 'Historique QCM complet');
    const first = accepted(await a.client.from('quiz_attempts').select('*').order('created_at').order('attempt_id').range(0, 1), 'Première page QCM');
    const next = accepted(await a.client.from('quiz_attempts').select('*').order('created_at').order('attempt_id').range(2, 3), 'Seconde page QCM');
    assert.equal(all.length, 3);
    assert.deepEqual([...first, ...next], all);
  });

  await check('QCM/cours : identifiants, nombres, dates, versions et révisions invalides refusés', async () => {
    for (const patch of [
      { p_score: -1 }, { p_score: 4 }, { p_total: 0 }, { p_score: 1.5 },
      { p_score: null }, { p_completed_at: null }, { p_completed_at: 'infinity' },
      { p_completed_at: '2026-02-30T12:00:00Z' }, { p_completed_at: '10000-01-01T00:00:00Z' },
      { p_attempt_id: null }, { p_attempt_id: '00000000-0000-0000-0000-000000000000' },
      { p_lesson_id: '' }, { p_lesson_id: ' '.repeat(2) }, { p_lesson_id: 'x'.repeat(201) },
    ]) rejected(await a.client.rpc('personal_record_quiz', quizInput(patch)), 'QCM invalide');
    for (const patch of [
      { p_lesson_id: '' }, { p_done: null }, { p_best_score: -1 },
      { p_legacy_score: 4, p_legacy_total: 3 }, { p_legacy_score: 2, p_legacy_total: null },
      { p_expected_revision: -1 }, { p_expected_revision: null }, { p_operation_id: null },
    ]) rejected(await a.client.rpc('personal_save_course', courseInput({ p_lesson_id: 'invalid-course', ...patch })), 'Cours invalide');
    assert.equal((await rows(a, 'quiz_attempts')).length, 3);
    assert.equal((await rows(a, 'course_states')).length, 1);
  });

  await check('Botanique : session avec identifiant local stable et métadonnées seulement', async () => {
    own.botanical_sessions = await createRace(a, 'personal_save_botanical_session', initialSession);
    assert.equal(own.botanical_sessions.session_id, session.id);
    assert.equal(own.botanical_sessions.completed_at, null);
    assert.equal(own.botanical_sessions.total_questions, 4);
    assert.equal(own.botanical_sessions.is_revision, false);
    assert.deepEqual((await rpc(a, 'personal_save_botanical_session', initialSession, 'replayed')).row, own.botanical_sessions);
    assert.equal((await rows(a, 'botanical_sessions')).length, 1);
  });

  await check('Botanique : correct, incorrect, timeout et image indisponible conservés séparément', async () => {
    const outcomes = [
      {},
      { status: 'incorrect', correct: false, selectedSpeciesId: 'framboisier' },
      { status: 'timeout', correct: false, selectedSpeciesId: null, elapsedMs: 30000 },
      { status: 'skipped_image', correct: false, selectedSpeciesId: null, elapsedMs: 0 },
    ];
    for (const [index, patch] of outcomes.entries()) {
      const input = botanicalAnswer(session, index + 1, patch);
      const saved = (await rpc(a, 'personal_record_botanical_answer', { p_answer: input }, 'inserted')).row;
      assert.equal(saved.answer_id, input.id);
      assert.equal(saved.question_id, input.questionId);
      assert.equal(saved.status, input.status);
      assert.equal(saved.correct, input.correct);
      assert.equal(Date.parse(saved.answered_at), Date.parse(input.answeredAt));
      if (index === 0) { answer = saved; own.botanical_answers = saved; }
    }
    assert.equal((await rows(a, 'botanical_answers')).length, 4);
  });

  await check('Botanique : retry exact, divergence et seconde identité technique sous même question', async () => {
    const input = botanicalAnswer(session);
    assert.deepEqual((await rpc(a, 'personal_record_botanical_answer', { p_answer: input }, 'replayed')).row, answer);
    assert.deepEqual((await rpc(a, 'personal_record_botanical_answer', { p_answer: {
      ...input, status: 'incorrect', correct: false, selectedSpeciesId: 'framboisier',
    } }, 'conflict')).row, answer);
    rejected(await a.client.rpc('personal_record_botanical_answer', { p_answer: { ...input, id: 'new-technical-id' } }), 'Identité réponse différente de question');
    assert.equal((await rows(a, 'botanical_answers')).length, 4);
    assert.deepEqual(await one(a, 'botanical_answers', { answer_id: answer.answer_id }), answer);
  });

  await check('Botanique : création puis complétion volontaire, aucun effacement ou réécriture des métadonnées', async () => {
    const completed = sessionInput({ ...session, completedAt: '2026-10-21T12:05:00.000Z' }, { p_expected_revision: 1 });
    own.botanical_sessions = (await rpc(a, 'personal_save_botanical_session', completed, 'updated')).row;
    assert.equal(own.botanical_sessions.revision, 2);
    assert.equal(Date.parse(own.botanical_sessions.completed_at), Date.parse(completed.p_session.completedAt));
    assert.deepEqual((await rpc(a, 'personal_save_botanical_session', completed, 'replayed')).row, own.botanical_sessions);
    assert.deepEqual((await rpc(a, 'personal_save_botanical_session', initialSession, 'conflict')).row, own.botanical_sessions);
    for (const patch of [{ mode: 'discovery' }, { totalQuestions: 5 }, { completedAt: null }, { completedAt: '2026-10-21T12:06:00.000Z' }]) {
      const result = await a.client.rpc('personal_save_botanical_session', sessionInput({ ...completed.p_session, ...patch }, { p_expected_revision: 2 }));
      if (!result.error) assert.equal(result.data.status, 'conflict', 'Les métadonnées/complétion validées ne peuvent être remplacées.');
      assert.deepEqual(await one(a, 'botanical_sessions'), own.botanical_sessions);
    }
  });

  await check('Botanique : vraie concurrence de complétion, réponses distinctes et retries concurrents', async () => {
    const concurrent = botanicalSession('botanical-concurrent');
    await rpc(a, 'personal_save_botanical_session', sessionInput(concurrent), 'inserted');
    const oneInput = sessionInput({ ...concurrent, completedAt: '2026-10-21T12:05:00.000Z' }, { p_expected_revision: 1 });
    const twoInput = sessionInput({ ...concurrent, completedAt: '2026-10-21T12:06:00.000Z' }, { p_expected_revision: 1 });
    await race(a, 'personal_save_botanical_session', oneInput, twoInput);
    const first = { p_answer: botanicalAnswer(concurrent) };
    const results = await Promise.all([rpc(a, 'personal_record_botanical_answer', first), rpc(a, 'personal_record_botanical_answer', first)]);
    assert.deepEqual(results.map(result => result.status).sort(), ['inserted', 'replayed']);
    await rpc(a, 'personal_record_botanical_answer', { p_answer: botanicalAnswer(concurrent, 2) }, 'inserted');
    assert.equal((await rows(a, 'botanical_answers', { session_id: concurrent.id })).length, 2);
  });

  await check('Botanique : formats, statuts, cohérence des sessions et données invalides refusés', async () => {
    const invalid = [
      null, [], { ...session, unknown: true }, { ...session, schemaVersion: 2 },
      { ...session, id: '' }, { ...session, startedAt: '2026-02-30T12:00:00Z' },
      { ...session, durationSeconds: 0 }, { ...session, totalQuestions: 11 },
      { ...session, revision: 'false' }, { ...session, mode: 'unknown' },
      { ...session, completedAt: '2026-10-20T12:00:00Z' },
    ];
    for (const [index, value] of invalid.entries()) {
      const input = value && !Array.isArray(value) && value.id === session.id ? { ...value, id: `invalid-session-${index}` } : value;
      rejected(await a.client.rpc('personal_save_botanical_session', sessionInput(input)), 'Session botanique invalide');
    }
    const valid = botanicalAnswer(session);
    for (const patch of [
      { unknown: true }, { status: 'unknown' }, { correct: false },
      { selectedSpeciesId: null }, { elapsedMs: -1 }, { elapsedMs: 'NaN' },
      { answeredAt: 'infinity' }, { answeredAt: '2026-02-30T12:00:00Z' },
      { questionId: '' }, { revision: 'false' },
      { categoryId: 'different-category' }, { mode: 'discovery' },
    ]) rejected(await a.client.rpc('personal_record_botanical_answer', { p_answer: { ...valid, ...patch } }), 'Réponse botanique invalide');
    rejected(await a.client.rpc('personal_record_botanical_answer', { p_answer: botanicalAnswer(botanicalSession('orphan-session')) }), 'Réponse sans session');
    const discovery = botanicalSession('botanical-discovery', { mode: 'discovery' });
    await rpc(a, 'personal_save_botanical_session', sessionInput(discovery), 'inserted');
    rejected(await a.client.rpc('personal_record_botanical_answer', { p_answer: botanicalAnswer(discovery, 1, { status: 'timeout', correct: false, selectedSpeciesId: null }) }), 'Timeout en découverte');
  });

  await check('Botanique : complétion partielle/à zéro réponse, bornes temporelles et capacité sérialisées', async () => {
    const partial = botanicalSession('botanical-empty-complete', { totalQuestions: 1 });
    const created = await rpc(a, 'personal_save_botanical_session', sessionInput(partial), 'inserted');
    assert.equal(created.row.completed_at, null);
    await rpc(a, 'personal_save_botanical_session', sessionInput({ ...partial, completedAt: '2026-10-21T12:05:00.000Z' }, { p_expected_revision: 1 }), 'updated');
    rejected(await a.client.rpc('personal_record_botanical_answer', { p_answer: botanicalAnswer(partial, 1, { answeredAt: '2026-10-21T11:59:59.000Z' }) }), 'Réponse antérieure au début');
    rejected(await a.client.rpc('personal_record_botanical_answer', { p_answer: botanicalAnswer(partial, 1, { answeredAt: '2026-10-21T12:05:01.000Z' }) }), 'Réponse postérieure à la complétion');
    const competing = await Promise.all([1, 2].map(number => a.client.rpc('personal_record_botanical_answer', { p_answer: botanicalAnswer(partial, number) })));
    assert.equal(competing.filter(result => !result.error).length, 1, 'La capacité ne peut être dépassée par deux réponses concurrentes.');
    assert.equal(competing.filter(result => result.error).length, 1);
    assert.equal((await rows(a, 'botanical_answers', { session_id: partial.id })).length, 1);
    const unfinished = botanicalSession('botanical-completion-bound');
    await rpc(a, 'personal_save_botanical_session', sessionInput(unfinished), 'inserted');
    await rpc(a, 'personal_record_botanical_answer', { p_answer: botanicalAnswer(unfinished, 1, { answeredAt: '2026-10-21T12:05:00.000Z' }) }, 'inserted');
    rejected(await a.client.rpc('personal_save_botanical_session', sessionInput({ ...unfinished, completedAt: '2026-10-21T12:04:00.000Z' }, { p_expected_revision: 1 })), 'Complétion avant réponse historique');
    assert.equal((await one(a, 'botanical_sessions', { session_id: unfinished.id })).completed_at, null);
  });

  await check('ITK : singleton dernier paramétrage, remplacement volontaire et retry exact', async () => {
    own.itk_settings = await createRace(a, 'personal_save_itk', initialItk);
    assert.deepEqual(own.itk_settings.parameters, itkParameters);
    assert.deepEqual((await rpc(a, 'personal_save_itk', initialItk, 'replayed')).row, own.itk_settings);
    const replace = itkInput({ p_parameters: { ...itkParameters, crop: 'carotte', variety: 'Nantaise', cover: 'plein' }, p_expected_revision: 1 });
    own.itk_settings = (await rpc(a, 'personal_save_itk', replace, 'updated')).row;
    assert.equal(own.itk_settings.parameters.crop, 'carotte');
    assert.deepEqual((await rpc(a, 'personal_save_itk', replace, 'replayed')).row, own.itk_settings);
    assert.deepEqual((await rpc(a, 'personal_save_itk', { ...replace, p_parameters: itkParameters }, 'conflict')).row, own.itk_settings);
    assert.equal((await rows(a, 'itk_settings')).length, 1);
  });

  await check('ITK : deux appareils sur même révision, aucune mise à jour perdue silencieusement', async () => {
    own.itk_settings = await race(a, 'personal_save_itk',
      itkInput({ p_parameters: { ...itkParameters, area: '100' }, p_expected_revision: 2 }),
      itkInput({ p_parameters: { ...itkParameters, area: '200' }, p_expected_revision: 2 }));
    assert.equal(own.itk_settings.revision, 3);
    assert.deepEqual((await rpc(a, 'personal_save_itk', initialItk, 'conflict')).row, own.itk_settings);
    assert.deepEqual(await one(a, 'itk_settings'), own.itk_settings);
  });

  await check('ITK : types chaînes, plages et association culture/variété validés par PostgreSQL', async () => {
    for (const patch of [
      { crop: 'inconnue' }, { variety: 'Nantaise' }, { area: 120 }, { area: 'NaN' },
      { area: '0' }, { area: '100001' }, { month: '13' }, { year: '2034' },
      { cover: 'unknown' }, { soil: 'unknown' }, { water: 'unknown' }, { extra: true },
      { variety: 'x'.repeat(5000) },
    ]) rejected(await a.client.rpc('personal_save_itk', itkInput({ p_parameters: { ...itkParameters, ...patch }, p_expected_revision: own.itk_settings.revision })), 'Paramètres ITK invalides');
    const missing = { ...itkParameters }; delete missing.variety;
    rejected(await a.client.rpc('personal_save_itk', itkInput({ p_parameters: missing, p_expected_revision: own.itk_settings.revision })), 'Champ ITK absent');
    assert.deepEqual(await one(a, 'itk_settings'), own.itk_settings);
  });

  await check('Apparence : choix auto persistants, date client facultative et remplacement volontaire', async () => {
    own.appearance_preferences = await createRace(a, 'personal_save_appearance', initialAppearance);
    assert.equal(own.appearance_preferences.season, 'auto');
    assert.equal(own.appearance_preferences.brightness, 'auto');
    assert.equal(own.appearance_preferences.client_updated_at, null);
    assert.deepEqual((await rpc(a, 'personal_save_appearance', initialAppearance, 'replayed')).row, own.appearance_preferences);
    const replace = appearanceInput({ p_preferences: { version: 1, season: 'winter', brightness: 'dark', updatedAt: timestamp }, p_expected_revision: 1 });
    own.appearance_preferences = (await rpc(a, 'personal_save_appearance', replace, 'updated')).row;
    assert.equal(own.appearance_preferences.season, 'winter');
    assert.equal(Date.parse(own.appearance_preferences.client_updated_at), Date.parse(timestamp));
    assert.deepEqual((await rpc(a, 'personal_save_appearance', replace, 'replayed')).row, own.appearance_preferences);
  });

  await check('Apparence : concurrence contrôlée et ancienne opération sans rétablissement automatique', async () => {
    own.appearance_preferences = await race(a, 'personal_save_appearance',
      appearanceInput({ p_preferences: { version: 1, season: 'auto', brightness: 'light' }, p_expected_revision: 2 }),
      appearanceInput({ p_preferences: { version: 1, season: 'summer', brightness: 'auto' }, p_expected_revision: 2 }));
    assert.equal(own.appearance_preferences.revision, 3);
    assert.deepEqual((await rpc(a, 'personal_save_appearance', initialAppearance, 'conflict')).row, own.appearance_preferences);
    assert.deepEqual(await one(a, 'appearance_preferences'), own.appearance_preferences);
  });

  await check('Apparence : versions, valeurs, date invalide et rendu calculé non admis comme préférences', async () => {
    for (const patch of [
      { version: 2 }, { version: '1' }, { season: 'unknown' }, { brightness: 'night' },
      { updatedAt: 'infinity' }, { updatedAt: '2026-02-30T12:00:00Z' },
      { theme: 'dark' }, { time: 'night' }, { unrecognizedPreferencesArchive: ['preserved-locally'] },
      { season: 'x'.repeat(5000) },
    ]) rejected(await a.client.rpc('personal_save_appearance', appearanceInput({ p_preferences: { ...appearancePreferences, ...patch }, p_expected_revision: own.appearance_preferences.revision })), 'Préférence invalide');
    assert.deepEqual(await one(a, 'appearance_preferences'), own.appearance_preferences);
  });

  await check('Isolation symétrique A/B : mêmes identifiants métier possibles, toutes lectures personnelles', async () => {
    other.course_states = (await rpc(b, 'personal_save_course', initialCourse, 'inserted')).row;
    other.quiz_attempts = (await rpc(b, 'personal_record_quiz', quizInput({ p_attempt_id: quiz.attempt_id }), 'inserted')).row;
    other.botanical_sessions = (await rpc(b, 'personal_save_botanical_session', initialSession, 'inserted')).row;
    other.botanical_answers = (await rpc(b, 'personal_record_botanical_answer', { p_answer: botanicalAnswer(session) }, 'inserted')).row;
    other.itk_settings = (await rpc(b, 'personal_save_itk', initialItk, 'inserted')).row;
    other.appearance_preferences = (await rpc(b, 'personal_save_appearance', initialAppearance, 'inserted')).row;
    for (const [self, neighbor] of [[a, b], [b, a]]) for (const table of tables) {
      assert.deepEqual(await rows(self, table, { user_id: neighbor.id }), []);
      assert.ok((await rows(self, table)).every(row => row.user_id === self.id));
    }
  });

  await check('Relations botaniques intercomptes interdites avec JWT et PostgREST réels', async () => {
    const privateSession = botanicalSession('only-account-b');
    await rpc(b, 'personal_save_botanical_session', sessionInput(privateSession), 'inserted');
    rejected(await a.client.rpc('personal_record_botanical_answer', { p_answer: botanicalAnswer(privateSession) }), 'Réponse A vers session B');
    const response = botanicalAnswer(privateSession);
    deniedRaw(await raw(a, 'botanical_answers', 'POST', {
      answer_id: response.id, session_id: response.sessionId, question_id: response.questionId,
      category_id: response.categoryId, species_id: response.speciesId, photo_id: response.photoId,
      mode: response.mode, is_revision: response.revision, status: response.status,
      selected_species_id: response.selectedSpeciesId, correct: response.correct,
      elapsed_ms: response.elapsedMs, answered_at: response.answeredAt,
    }), 'FK directe A vers session B');
    assert.deepEqual(await rows(a, 'botanical_answers', { session_id: privateSession.id }), []);
  });

  await check('B ne peut modifier/supprimer A, les historiques restent immuables', async () => {
    const patches = {
      course_states: { done: false, base_revision: 1, operation_id: randomUUID() },
      botanical_sessions: { completed_at: '2026-10-21T12:05:00Z', base_revision: 1, operation_id: randomUUID() },
      itk_settings: { parameters: itkParameters, base_revision: 1, operation_id: randomUUID() },
      appearance_preferences: { season: 'winter', base_revision: 1, operation_id: randomUUID() },
      quiz_attempts: { score: 0 }, botanical_answers: { correct: false },
    };
    for (const [self, neighbor] of [[a, b], [b, a]]) for (const table of tables) {
      const before = await rows(neighbor, table);
      const response = await raw(self, `${table}?user_id=eq.${neighbor.id}`, 'PATCH', patches[table]);
      if (mutableTables.includes(table)) { assert.equal(response.status, 200); assert.deepEqual(response.data, []); }
      else deniedRaw(response, 'Historique voisin immuable', '42501');
      deniedRaw(await raw(self, `${table}?user_id=eq.${neighbor.id}`, 'DELETE'), 'Suppression voisine interdite', '42501');
      assert.deepEqual(await rows(neighbor, table), before);
    }
    deniedRaw(await raw(a, 'quiz_attempts', 'PATCH', { score: 0 }), 'QCM propre immuable', '42501');
    deniedRaw(await raw(a, 'botanical_answers', 'PATCH', { correct: false }), 'Réponse botanique propre immuable', '42501');
  });

  await check('Propriétaire, dates serveur, version et révision interdits sur les écritures directes', async () => {
    for (const table of tables) {
      const before = await rows(a, table);
      for (const field of [{ user_id: b.id }, { created_at: timestamp }]) {
        deniedRaw(await raw(a, table, 'POST', field), 'Insertion technique interdite', '42501');
        deniedRaw(await raw(a, table, 'PATCH', field), 'Modification technique interdite', '42501');
      }
      if (mutableTables.includes(table)) for (const field of [{ revision: 50 }, { updated_at: timestamp }, { schema_version: 2 }]) {
        deniedRaw(await raw(a, table, 'POST', field), 'Insertion technique état interdite', '42501');
        deniedRaw(await raw(a, table, 'PATCH', field), 'Modification technique état interdite', '42501');
      }
      assert.deepEqual(await rows(a, table), before);
    }
  });

  await check('Écritures directes : le trigger impose CAS, aucune protection réservée aux RPC', async () => {
    const before = await one(a, 'itk_settings');
    deniedRaw(await raw(a, 'itk_settings', 'PATCH', { parameters: { ...itkParameters, area: '444' } }), 'PATCH sans révision/opération');
    deniedRaw(await raw(a, 'itk_settings', 'PATCH', { parameters: { ...itkParameters, area: '444' }, base_revision: before.revision - 1, operation_id: randomUUID() }), 'PATCH révision obsolète');
    assert.deepEqual(await one(a, 'itk_settings'), before);
    const valid = await raw(a, 'itk_settings', 'PATCH', { parameters: { ...itkParameters, area: '444' }, base_revision: before.revision, operation_id: randomUUID() });
    assert.equal(valid.status, 200);
    assert.equal(valid.data.length, 1);
    assert.equal(valid.data[0].revision, before.revision + 1);
    assert.equal(valid.data[0].user_id, a.id);
    assert.equal(valid.data[0].parameters.area, '444');
    own.itk_settings = valid.data[0];
  });

  await check('Visiteur et faux JWT refusés sur chaque table et chaque RPC', async () => {
    const calls = [
      ['personal_save_course', initialCourse], ['personal_record_quiz', quizInput()],
      ['personal_save_botanical_session', initialSession], ['personal_record_botanical_answer', { p_answer: botanicalAnswer(session) }],
      ['personal_save_itk', initialItk], ['personal_save_appearance', initialAppearance],
    ];
    const parts = a.token.split('.');
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    parts[1] = Buffer.from(JSON.stringify({ ...claims, sub: b.id, role: 'service_role' })).toString('base64url');
    const forged = parts.join('.');
    for (const table of tables) {
      const visitor = await raw(null, `${table}?select=*`);
      deniedRaw(visitor, 'Lecture visiteur'); assert.ok([401, 403].includes(visitor.status));
      for (const method of ['POST', 'PATCH', 'DELETE']) deniedRaw(await raw(null, table, method, method === 'DELETE' ? undefined : {}), 'Écriture visiteur');
      assert.equal((await raw(a, `${table}?select=*`, 'GET', undefined, forged)).status, 401);
    }
    for (const [name, input] of calls) {
      rejected(await client().rpc(name, input), 'RPC visiteur');
      assert.equal((await raw(a, `rpc/${name}`, 'POST', input, forged)).status, 401);
    }
    accepted(await a.client.auth.updateUser({ data: { user_id: b.id, role: 'service_role' } }), 'Métadonnées Auth modifiables');
    for (const table of tables) assert.deepEqual(await rows(a, table, { user_id: b.id }), [], 'user_metadata ne donne aucun accès voisin.');
  });

  console.log(`${passed} groupes données personnelles PostgreSQL/Auth/API réellement exécutés et réussis.`);
} catch (error) {
  const message = error instanceof assert.AssertionError ? error.message.split('\n')[0]
    : 'Configuration locale, Auth ou service PostgreSQL indisponible ; aucun résultat validé.';
  console.error(`ÉCHEC / NON VALIDÉ — Données personnelles : ${message}`);
  process.exitCode = 1;
} finally {
  let cleanupFailed = false;
  for (const student of students) {
    try { if ((await student.client.auth.signOut({ scope: 'local' })).error) cleanupFailed = true; }
    catch { cleanupFailed = true; }
  }
  for (const fixture of fixtures.toReversed()) {
    try { await fixture.cleanup(); }
    catch { cleanupFailed = true; }
  }
  if (cleanupFailed) {
    console.error('Nettoyage incomplet des seuls comptes fictifs personnels de ce run dans la stack locale dédiée.');
    process.exitCode = 1;
  }
}
