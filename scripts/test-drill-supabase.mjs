// Lot 6.2.1 : PostgreSQL/PostgREST et Supabase Auth REELS, stack locale dédiée.
// Le helper refuse les endpoints hébergés et garde l'administration dans les
// seules invitations et suppressions des comptes fictifs créés par ce run.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createLocalAuthFixture, getLocalSupabaseEnvironment } from '../tests/helpers/auth-local.js';
import { DRILL_STORAGE_KEY, readDrillState } from '../assets/drill-store.js';
import { readDashboardData } from '../assets/dashboard-data.js';
import { createDashboardModel } from '../assets/dashboard-stats.js';

const fixtures = [];
const students = [];
const tables = ['drill_series', 'drill_answers', 'drill_training_attempts'];
const timestamp = '2026-10-14T10:00:00.000Z';
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
  console.log(`OK Drill ${passed} — ${label}`);
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

function questions(unit = 'uc3') {
  return Array.from({ length: 10 }, (_, index) => ({
    id: `drill-test-${index + 1}`, version: 1, unit, chapter: 'Chapitre synthétique',
    concept: 'Notion synthétique', type: 'single-choice', prompt: `Question synthétique ${index + 1} ?`,
    options: [{ id: 'a', text: 'Choix exact' }, { id: 'b', text: 'Autre choix' }],
    answer: 'a', explanation: 'Correction synthétique de test.', difficulty: 'facile',
  }));
}

function seriesPayload(unit = 'uc3', week = '2026-W42') {
  return { p_unit: unit, p_week: week, p_started_at: timestamp, p_questions: questions(unit) };
}

function answerPayload(series, question = 1, answer = 'a', operation = randomUUID(), at = timestamp) {
  return { p_series_id: series.id, p_question_id: `drill-test-${question}`,
    p_answer: answer, p_answered_at: at, p_operation_id: operation };
}

async function rpc(student, name, input, status = null) {
  const data = accepted(await student.client.rpc(name, input), name);
  assert.ok(data && typeof data === 'object' && data.row, `${name} : résultat contractuel absent.`);
  assert.ok(['inserted', 'replayed', 'conflict'].includes(data.status), `${name} : statut inconnu.`);
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

function directAnswer(payload) {
  return { series_id: payload.p_series_id, question_id: payload.p_question_id,
    operation_id: payload.p_operation_id, answer: payload.p_answer, answered_at: payload.p_answered_at };
}

try {
  // La validation est effectuée AVANT la création d’un client ou d’un compte.
  environment = getLocalSupabaseEnvironment();
  let a;
  let b;
  let seriesA;
  let seriesB;
  let first;
  let training;

  await check('Deux invitations locales activées, deux vrais JWT sans privilèges administratifs', async () => {
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

  await check('Création, relecture et retry de série : une seule ligne et snapshot conservé', async () => {
    const payload = seriesPayload();
    seriesA = (await rpc(a, 'drill_create_series', payload, 'inserted')).row;
    assert.equal(seriesA.series_key, 'uc3__2026-W42');
    assert.equal(seriesA.schema_version, 1);
    assert.deepEqual(seriesA.questions, payload.p_questions);
    assert.equal(Date.parse(seriesA.started_at), Date.parse(timestamp));
    assert.ok(Number.isFinite(Date.parse(seriesA.created_at)));
    assert.deepEqual((await rpc(a, 'drill_create_series', payload, 'replayed')).row, seriesA);
    assert.deepEqual(await rows(a, 'drill_series', { id: seriesA.id }), [seriesA]);
  });

  await check('Même UC/semaine avec un autre snapshot ou début : conflit explicite et gagnante inchangée', async () => {
    const changed = seriesPayload();
    changed.p_questions[0].answer = 'b';
    assert.deepEqual((await rpc(a, 'drill_create_series', changed, 'conflict')).row, seriesA);
    assert.deepEqual((await rpc(a, 'drill_create_series', {
      ...seriesPayload(), p_started_at: '2026-10-15T10:00:00Z',
    }, 'conflict')).row, seriesA);
    assert.deepEqual((await rows(a, 'drill_series', { id: seriesA.id }))[0].questions, questions());
  });

  await check('Intégrité série : UC, semaine ISO réelle, snapshot, versions et dates invalides refusés', async () => {
    const invalid = [
      { ...seriesPayload(), p_unit: 'uc-inconnue' },
      { ...seriesPayload(), p_week: '2026-W00' },
      { ...seriesPayload(), p_week: '2025-W53' },
      { ...seriesPayload(), p_week: '2026-W54' },
      { ...seriesPayload(), p_week: '2026-W1' },
      { ...seriesPayload(), p_started_at: 'infinity' },
      { ...seriesPayload(), p_started_at: '-infinity' },
      { ...seriesPayload(), p_started_at: null },
      { ...seriesPayload(), p_started_at: '10000-01-01T00:00:00Z' },
      { ...seriesPayload(), p_questions: questions().slice(1) },
      { ...seriesPayload(), p_questions: {} },
    ];
    for (const mutate of [
      q => { q[1].id = q[0].id; }, q => { q[0].version = 0; },
      q => { q[0].version = 1.5; }, q => { q[0].unit = 'uc4'; },
      q => { q[0].answer = 'absente'; }, q => { q[0].options[1].id = 'a'; },
      q => { q[0].type = 'inconnu'; }, q => { q[0].prompt = ' '; },
      q => { q[0].prompt = '\t\n'; }, q => { q[0].concept = '\u00a0'; },
      q => { q[0].options[0].text = '\t'; },
      q => { q[0].reference = { title: '\n', url: 'https://example.test/drill' }; },
      q => { q[0].reference = { title: 'Test', url: 'javascript:alert(1)' }; },
    ]) {
      const payload = seriesPayload();
      mutate(payload.p_questions);
      invalid.push(payload);
    }
    for (const payload of invalid) rejected(await a.client.rpc('drill_create_series', payload), 'Série invalide');
    assert.equal((await rows(a, 'drill_series')).length, 1, 'Aucune série invalide ne doit être enregistrée.');
  });

  await check('RLS symétrique : même série métier possible par étudiant, lectures privées', async () => {
    seriesB = (await rpc(b, 'drill_create_series', seriesPayload(), 'inserted')).row;
    assert.notEqual(seriesA.id, seriesB.id);
    for (const [self, otherSeries] of [[a, seriesB], [b, seriesA]]) {
      assert.deepEqual(await rows(self, 'drill_series', { id: otherSeries.id }), []);
      assert.equal((await rows(self, 'drill_series')).length, 1);
      rejected(await self.client.rpc('drill_record_answer', answerPayload(otherSeries)), 'Réponse intercompte', ['42501']);
    }
  });

  await check('Séries immuables et colonnes techniques protégées par PostgREST direct', async () => {
    for (const [self, own, other] of [[a, seriesA, seriesB], [b, seriesB, seriesA]]) {
      for (const patch of [{ user_id: other.user_id }, { questions: questions('uc4') },
        { week: '2026-W43' }, { id: randomUUID() }, { schema_version: 2 }, { created_at: timestamp }]) {
        deniedRaw(await raw(self, `drill_series?id=eq.${own.id}`, 'PATCH', patch), 'Modification série', '42501');
      }
      deniedRaw(await raw(self, `drill_series?id=eq.${own.id}`, 'DELETE'), 'Suppression série', '42501');
      for (const protectedField of [{ user_id: other.user_id }, { id: randomUUID() },
        { created_at: timestamp }, { schema_version: 2 }, { series_key: 'uc3__2026-W43' }]) {
        deniedRaw(await raw(self, 'drill_series', 'POST', {
          unit: 'uc3', week: '2026-W43', started_at: timestamp, questions: questions(), ...protectedField,
        }), 'Insertion champ technique série', 'series_key' in protectedField ? null : '42501');
      }
    }
  });

  await check('Première réponse : correction calculée depuis le snapshot, dates client et serveur distinctes', async () => {
    const payload = answerPayload(seriesA, 1, 'b');
    first = (await rpc(a, 'drill_record_answer', payload, 'inserted')).row;
    assert.equal(first.answer, 'b');
    assert.equal(first.correct, false);
    assert.equal(Date.parse(first.answered_at), Date.parse(timestamp));
    assert.ok(Number.isFinite(Date.parse(first.created_at)));
    assert.notEqual(Date.parse(first.created_at), Date.parse(first.answered_at));
    assert.deepEqual(await rows(a, 'drill_answers', { series_id: seriesA.id, question_id: payload.p_question_id }), [first]);
    assert.deepEqual((await rpc(a, 'drill_record_answer', payload, 'replayed')).row, first);
  });

  await check('Conflits de première réponse : opération réutilisée, autre opération et date antérieure', async () => {
    const original = answerPayload(seriesA, 1, 'b', first.operation_id);
    for (const input of [
      { ...original, p_answer: 'a' },
      { ...original, p_answered_at: '2020-01-01T00:00:00Z' },
      { ...original, p_question_id: 'drill-test-2' },
      { ...original, p_operation_id: randomUUID() },
      { ...original, p_operation_id: randomUUID(), p_answer: 'a', p_answered_at: '2020-01-01T00:00:00Z' },
    ]) assert.deepEqual((await rpc(a, 'drill_record_answer', input, 'conflict')).row, first);
    assert.deepEqual(await rows(a, 'drill_answers'), [first]);
  });

  await check('Premières réponses : UPDATE, DELETE, propriétaire, correction et dates protégés', async () => {
    for (const patch of [{ answer: 'a' }, { correct: true }, { user_id: b.id },
      { operation_id: randomUUID() }, { series_id: seriesB.id },
      { question_id: 'drill-test-2' }, { answered_at: timestamp }, { created_at: timestamp }]) {
      deniedRaw(await raw(a, `drill_answers?operation_id=eq.${first.operation_id}`, 'PATCH', patch), 'Modification première réponse', '42501');
    }
    deniedRaw(await raw(a, `drill_answers?operation_id=eq.${first.operation_id}`, 'DELETE'), 'Suppression première réponse', '42501');
    const direct = directAnswer(answerPayload(seriesA, 2));
    for (const protectedField of [{ correct: true }, { user_id: b.id }, { created_at: timestamp }]) {
      deniedRaw(await raw(a, 'drill_answers', 'POST', { ...direct, ...protectedField }), 'Insertion champ technique réponse', '42501');
    }
    assert.deepEqual(await rows(a, 'drill_answers'), [first]);
  });

  await check('Question, option, série absente, UUID et dates invalides : refus côté serveur', async () => {
    for (const input of [
      { ...answerPayload(seriesA, 2), p_question_id: 'inconnue' },
      { ...answerPayload(seriesA, 2), p_question_id: null },
      { ...answerPayload(seriesA, 2), p_answer: 'inconnue' },
      { ...answerPayload(seriesA, 2), p_series_id: randomUUID() },
      { ...answerPayload(seriesA, 2), p_operation_id: 'non-uuid' },
      { ...answerPayload(seriesA, 2), p_operation_id: null },
      { ...answerPayload(seriesA, 2), p_operation_id: '00000000-0000-0000-0000-000000000000' },
      { ...answerPayload(seriesA, 2), p_answered_at: 'infinity' },
      { ...answerPayload(seriesA, 2), p_answered_at: '10000-01-01T00:00:00Z' },
    ]) rejected(await a.client.rpc('drill_record_answer', input), 'Réponse invalide');
    deniedRaw(await raw(a, 'drill_answers', 'POST', directAnswer(answerPayload(seriesA, 2, 'inconnue'))), 'Option directe invalide');
    deniedRaw(await raw(a, 'drill_answers', 'POST', directAnswer(answerPayload(seriesB, 2))), 'Référence directe intercompte');
    assert.deepEqual(await rows(a, 'drill_answers'), [first]);
  });

  await check('Entraînement lié à une première réponse existante : pas de tentative orpheline', async () => {
    rejected(await a.client.rpc('drill_record_training', answerPayload(seriesA, 2)), 'Entraînement sans première réponse');
    rejected(await b.client.rpc('drill_record_training', answerPayload(seriesA, 1)), 'Entraînement intercompte', ['42501']);
    rejected(await a.client.rpc('drill_record_training', answerPayload(seriesA, 1, 'inconnue')), 'Option entraînement invalide');
    deniedRaw(await raw(a, 'drill_training_attempts', 'POST', directAnswer(answerPayload(seriesB, 1))), 'Entraînement direct intercompte');
    assert.deepEqual(await rows(a, 'drill_training_attempts'), []);
  });

  await check('Entraînements : opérations distinctes identiques conservées, retry exact dédupliqué', async () => {
    const payload = answerPayload(seriesA, 1, 'a');
    training = (await rpc(a, 'drill_record_training', payload, 'inserted')).row;
    assert.equal(training.correct, true);
    assert.deepEqual((await rpc(a, 'drill_record_training', payload, 'replayed')).row, training);
    await rpc(a, 'drill_record_training', { ...payload, p_operation_id: randomUUID() }, 'inserted');
    assert.equal((await rows(a, 'drill_training_attempts')).length, 2);
    assert.deepEqual((await rpc(a, 'drill_record_training', { ...payload, p_answer: 'b' }, 'conflict')).row, training);
    assert.deepEqual((await rpc(a, 'drill_record_training', {
      ...payload, p_answered_at: '2020-01-01T00:00:00Z',
    }, 'conflict')).row, training);
    assert.deepEqual(await rows(a, 'drill_answers'), [first], 'Aucun entraînement ne remplace la première réponse.');
  });

  await check('RLS réponses et entraînements, symétrie A/B et refus des écritures voisines', async () => {
    // Le même UUID d'opération chez deux comptes ne doit ni dédupliquer leurs
    // données entre elles ni révéler la ligne de l'autre propriétaire.
    await rpc(b, 'drill_record_answer', answerPayload(seriesB, 1, 'a', first.operation_id), 'inserted');
    await rpc(b, 'drill_record_training', answerPayload(seriesB, 1, 'a', training.operation_id), 'inserted');
    for (const [self, other] of [[a, b], [b, a]]) {
      for (const table of tables) {
        assert.deepEqual(await rows(self, table, { user_id: other.id }), []);
        assert.ok((await rows(self, table)).every(row => row.user_id === self.id));
      }
      for (const table of ['drill_answers', 'drill_training_attempts']) {
        deniedRaw(await raw(self, `${table}?user_id=eq.${other.id}`, 'PATCH', { answer: 'b' }), 'Écriture voisine', '42501');
        deniedRaw(await raw(self, `${table}?user_id=eq.${other.id}`, 'DELETE'), 'Suppression voisine', '42501');
      }
    }
    for (const patch of [{ answer: 'b' }, { correct: false }, { user_id: b.id },
      { series_id: seriesB.id }, { operation_id: randomUUID() }, { answered_at: timestamp }, { created_at: timestamp }]) {
      deniedRaw(await raw(a, `drill_training_attempts?operation_id=eq.${training.operation_id}`, 'PATCH', patch), 'Modification entraînement', '42501');
    }
    deniedRaw(await raw(a, `drill_training_attempts?operation_id=eq.${training.operation_id}`, 'DELETE'), 'Suppression entraînement', '42501');
    for (const protectedField of [{ correct: true }, { user_id: b.id }, { created_at: timestamp }]) {
      deniedRaw(await raw(a, 'drill_training_attempts', 'POST', {
        ...directAnswer(answerPayload(seriesA, 1)), ...protectedField,
      }), 'Insertion champ technique entraînement', '42501');
    }
  });

  await check('Visiteur, JWT falsifié et métadonnées modifiables : aucune donnée privée accessible', async () => {
    for (const table of tables) {
      const visitor = await raw(null, `${table}?select=*`);
      deniedRaw(visitor, 'Lecture visiteur');
      assert.ok([401, 403].includes(visitor.status));
    }
    rejected(await client().rpc('drill_create_series', seriesPayload()), 'RPC visiteur');
    rejected(await client().rpc('drill_record_answer', answerPayload(seriesA)), 'RPC réponse visiteur');
    rejected(await client().rpc('drill_record_training', answerPayload(seriesA)), 'RPC entraînement visiteur');
    const parts = a.token.split('.');
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    parts[1] = Buffer.from(JSON.stringify({ ...claims, sub: b.id, role: 'service_role' })).toString('base64url');
    for (const table of tables) {
      assert.equal((await raw(a, `${table}?select=*`, 'GET', undefined, parts.join('.'))).status, 401,
        'Une signature falsifiée doit être refusée avant RLS.');
    }
    accepted(await a.client.auth.updateUser({ data: { id: b.id, user_id: b.id, role: 'service_role' } }), 'Métadonnées non fiables');
    for (const table of tables) assert.deepEqual(await rows(a, table, { user_id: b.id }), []);
  });

  let concurrentSeries;
  await check('Concurrence réelle : deux créations de série identiques, une seule ligne gagnante', async () => {
    const payload = seriesPayload('uc4', '2026-W43');
    const results = await Promise.all([rpc(a, 'drill_create_series', payload), rpc(a, 'drill_create_series', payload)]);
    assert.deepEqual(results.map(result => result.status).sort(), ['inserted', 'replayed']);
    assert.equal(results[0].row.id, results[1].row.id);
    concurrentSeries = results[0].row;
    assert.deepEqual(await rows(a, 'drill_series', { unit: 'uc4', week: '2026-W43' }), [concurrentSeries]);
  });

  await check('Concurrence réelle : séries de même clé et contenus différents, conflit sans écrasement', async () => {
    const firstPayload = seriesPayload('uc5', '2026-W43');
    const otherPayload = structuredClone(firstPayload);
    otherPayload.p_questions[0].prompt = 'Autre snapshot hors ligne';
    const results = await Promise.all([rpc(a, 'drill_create_series', firstPayload), rpc(a, 'drill_create_series', otherPayload)]);
    assert.deepEqual(results.map(result => result.status).sort(), ['conflict', 'inserted']);
    const winner = results.find(result => result.status === 'inserted').row;
    assert.deepEqual(results.find(result => result.status === 'conflict').row, winner);
    assert.deepEqual(await rows(a, 'drill_series', { unit: 'uc5', week: '2026-W43' }), [winner]);
  });

  let concurrentFirst;
  await check('Concurrence réelle : deux premières réponses différentes, une gagnante définitive', async () => {
    const inputs = [answerPayload(concurrentSeries, 1, 'a', randomUUID(), '2026-10-20T10:00:00Z'),
      answerPayload(concurrentSeries, 1, 'b', randomUUID(), '2020-01-01T00:00:00Z')];
    const results = await Promise.all(inputs.map(input => rpc(a, 'drill_record_answer', input)));
    assert.deepEqual(results.map(result => result.status).sort(), ['conflict', 'inserted']);
    concurrentFirst = results.find(result => result.status === 'inserted').row;
    assert.deepEqual(results.find(result => result.status === 'conflict').row, concurrentFirst);
    assert.equal(concurrentFirst.correct, concurrentFirst.answer === 'a');
    assert.deepEqual(await rows(a, 'drill_answers', { series_id: concurrentSeries.id, question_id: 'drill-test-1' }), [concurrentFirst]);
    const losingInput = inputs.find(input => input.p_operation_id !== concurrentFirst.operation_id);
    assert.deepEqual((await rpc(a, 'drill_record_answer', losingInput, 'conflict')).row, concurrentFirst);
  });

  await check('Concurrence réelle : deux retries de la même première réponse, une seule opération', async () => {
    const payload = answerPayload(concurrentSeries, 2);
    const results = await Promise.all([rpc(a, 'drill_record_answer', payload), rpc(a, 'drill_record_answer', payload)]);
    assert.deepEqual(results.map(result => result.status).sort(), ['inserted', 'replayed']);
    assert.deepEqual(results[0].row, results[1].row);
    assert.equal((await rows(a, 'drill_answers', { operation_id: payload.p_operation_id })).length, 1);
  });

  await check('Concurrence réelle : deux retries d’entraînement dédupliqués sans toucher la première réponse', async () => {
    const payload = answerPayload(concurrentSeries, 1);
    const results = await Promise.all([rpc(a, 'drill_record_training', payload), rpc(a, 'drill_record_training', payload)]);
    assert.deepEqual(results.map(result => result.status).sort(), ['inserted', 'replayed']);
    assert.deepEqual(results[0].row, results[1].row);
    assert.equal((await rows(a, 'drill_training_attempts', { operation_id: payload.p_operation_id })).length, 1);
    assert.deepEqual(await rows(a, 'drill_answers', { series_id: concurrentSeries.id, question_id: 'drill-test-1' }), [concurrentFirst]);
  });

  await check('Concurrence réelle : deux entraînements identiques mais opérations distinctes restent deux lignes', async () => {
    const firstPayload = answerPayload(concurrentSeries, 1, 'b');
    const secondPayload = { ...firstPayload, p_operation_id: randomUUID() };
    const before = await rows(a, 'drill_training_attempts', { series_id: concurrentSeries.id });
    const results = await Promise.all([rpc(a, 'drill_record_training', firstPayload, 'inserted'),
      rpc(a, 'drill_record_training', secondPayload, 'inserted')]);
    assert.notEqual(results[0].row.operation_id, results[1].row.operation_id);
    assert.equal((await rows(a, 'drill_training_attempts', { series_id: concurrentSeries.id })).length, before.length + 2);
    assert.deepEqual(await rows(a, 'drill_answers', { series_id: concurrentSeries.id, question_id: 'drill-test-1' }), [concurrentFirst]);
  });

  await check('INSERT direct valide : mêmes validations, correction serveur et unicité PostgreSQL', async () => {
    const payload = directAnswer(answerPayload(seriesA, 3, 'b'));
    const result = await raw(a, 'drill_answers', 'POST', payload);
    assert.equal(result.status, 201);
    assert.equal(result.data[0].correct, false);
    assert.equal(result.data[0].user_id, a.id);
    const duplicate = await raw(a, 'drill_answers', 'POST', payload);
    deniedRaw(duplicate, 'Duplication directe', '23505');
    assert.equal((await rows(a, 'drill_answers', { operation_id: payload.operation_id })).length, 1);
  });

  await check('Restitution réelle : données SQL compatibles avec le lecteur Drill et les calculs Dashboard existants', async () => {
    const savedSeries = await rows(a, 'drill_series');
    const savedAnswers = await rows(a, 'drill_answers');
    const savedTraining = await rows(a, 'drill_training_attempts');
    const document = { version: 1, series: {} };
    for (const saved of savedSeries) {
      const series = { id: saved.series_key, unit: saved.unit, week: saved.week,
        startedAt: saved.started_at, questions: saved.questions, answers: {}, drafts: {}, trainingDrafts: {} };
      for (const answer of savedAnswers.filter(item => item.series_id === saved.id)) {
        const response = { answer: answer.answer, correct: answer.correct, answeredAt: answer.answered_at };
        const trainingAttempts = savedTraining
          .filter(item => item.series_id === saved.id && item.question_id === answer.question_id)
          .sort((left, right) => left.created_at.localeCompare(right.created_at) || left.operation_id.localeCompare(right.operation_id))
          .map(item => ({ answer: item.answer, correct: item.correct, answeredAt: item.answered_at, training: true }));
        series.answers[answer.question_id] = { ...response,
          attempts: [{ ...response, training: false }, ...trainingAttempts] };
      }
      document.series[series.id] = series;
    }
    // Adaptation de fixture en mémoire uniquement : aucun module de synchronisation
    // livré, aucun stockage du navigateur de l'utilisateur et aucune donnée réelle.
    const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem(key) { return key === DRILL_STORAGE_KEY ? JSON.stringify(document) : null; },
    } });
    try {
      const state = readDrillState();
      assert.equal(state.error, null);
      assert.deepEqual(state.warnings, []);
      assert.equal(Object.keys(state.series).length, savedSeries.length);
      const model = createDashboardModel(readDashboardData(), { now: new Date('2026-10-25T12:00:00Z'), period: 'all' });
      assert.equal(model.error, null);
      assert.deepEqual(model.warnings, []);
      assert.equal(model.totals.completed, savedAnswers.length, 'Les entraînements ne gonflent pas le volume principal.');
      assert.equal(model.totals.correct, savedAnswers.filter(item => item.correct).length);
      assert.equal(model.totals.successRate, model.totals.correct / savedAnswers.length * 100);
      const restoredFirst = state.series[seriesA.series_key].answers[first.question_id];
      assert.equal(restoredFirst.answer, first.answer);
      assert.equal(restoredFirst.correct, false);
      assert.ok(restoredFirst.attempts.some(attempt => attempt.training && attempt.correct));
    } finally {
      if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
      else delete globalThis.localStorage;
    }
  });

  console.log(`${passed} groupes Drill PostgreSQL/Auth/API réellement exécutés et réussis.`);
} catch (error) {
  // Ne jamais sérialiser une réponse SDK ou une session dans les logs CI.
  const message = error instanceof assert.AssertionError ? error.message.split('\n')[0]
    : 'Configuration locale, Auth ou service PostgreSQL indisponible ; aucun résultat validé.';
  console.error(`ÉCHEC / NON VALIDÉ — Drill : ${message}`);
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
    console.error('Nettoyage incomplet des seuls comptes fictifs Drill de ce run dans la stack locale dédiée.');
    process.exitCode = 1;
  }
}
