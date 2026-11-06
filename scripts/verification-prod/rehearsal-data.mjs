// Requêtes SQL exécutées avec des rôles réels et des claims purement synthétiques.
import assert from 'node:assert/strict';
import { A, B, questions, stamp, uuid } from '../../tests/fixtures/export.js';
import { appearancePreferences, botanicalAnswer, botanicalSession, itkParameters } from '../../tests/fixtures/personal-data.js';

export function sqlLiteral(value) {
  if (value === null) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return "'" + text.replaceAll("'", "''") + "'";
}

const asRole = (role, query, claims = {}) => `begin; set local role ${role};
  set local request.jwt.claims = ${sqlLiteral(claims)};
  ${query}
  commit;`;
export const student = (id, query, metadata = {}) => asRole('authenticated', query,
  { sub: id, role: 'authenticated', user_metadata: metadata });
const call = (name, ...args) => `select public.${name}(${args.map(sqlLiteral).join(',')});`;
const ownerColumn = table => table === 'profiles' ? 'id' : 'user_id';
const mutable = {
  profiles: "pseudo='Intrusion'",
  course_states: 'done=false',
  botanical_sessions: 'completed_at=null',
  itk_settings: "parameters='{}'::jsonb",
  appearance_preferences: "brightness='auto'",
};

function checkDefinitions(metadata) {
  assert.equal(metadata.tables.length, 10);
  assert.ok(metadata.tables.every(table => table.rls && table.owner === 'postgres'));
  assert.ok(metadata.constraints.every(constraint => constraint.validated));
  const foreignKeys = metadata.constraints.filter(constraint => constraint.kind === 'f');
  assert.equal(foreignKeys.length, 11);
  assert.ok(foreignKeys.every(constraint => constraint.definition.endsWith('ON DELETE CASCADE')));
  assert.match(foreignKeys.find(constraint => constraint.name === 'drill_answers_series_fkey').definition,
    /FOREIGN KEY \(user_id, series_id\) REFERENCES (public\.)?drill_series\(user_id, id\)/i);
  assert.ok(metadata.indexes.every(index => index.valid && index.ready));
  assert.ok(metadata.indexes.some(index => index.name === 'drill_series_business_key' && /unique.*\(user_id, unit, week\)/i.test(index.definition)));
  assert.ok(metadata.triggers.every(trigger => trigger.enabled === 'O'));
  assert.ok(metadata.triggers.some(trigger => trigger.schema === 'auth' && trigger.table === 'users'
    && /after insert.*create_profile_for_auth_user/i.test(trigger.definition)));
  const seriesKey = metadata.columns.find(column => column.table === 'drill_series' && column.name === 'series_key');
  assert.equal(seriesKey.generated, 's');
  assert.match(seriesKey.default, /unit.*__.*week/);
  assert.ok(metadata.columns.some(column => column.name === 'user_id' && column.default === 'auth.uid()'));
  assert.equal(metadata.functions.filter(fn => fn.schema === 'public').length, 9);
  for (const fn of metadata.functions) {
    assert.equal(fn.definer, fn.name === 'create_profile_for_auth_user');
    assert.deepEqual(fn.config, ['search_path=""']);
    assert.equal(fn.owner, 'postgres');
  }

  // Vérifier chaque prédicat, sa commande, son rôle et le côté USING/CHECK.
  for (const table of metadata.tables.map(item => item.name)) {
    const policies = metadata.policies.filter(policy => policy.tablename === table);
    const commands = ['SELECT'];
    if (table !== 'profiles') commands.push('INSERT');
    if (Object.hasOwn(mutable, table)) commands.push('UPDATE');
    assert.deepEqual(policies.map(policy => policy.cmd).sort(), commands.sort(), table);
    const predicate = new RegExp(`^selectauth\\.uid(?:asuid)?=${ownerColumn(table)}$`);
    for (const policy of policies) {
      assert.deepEqual(policy.roles, ['authenticated']);
      assert.equal(policy.permissive, 'PERMISSIVE');
      if (policy.cmd === 'INSERT') assert.equal(policy.qual, null);
      else assert.match(policy.qual.replace(/[()\s]/g, '').toLowerCase(), predicate);
      if (policy.cmd === 'SELECT') assert.equal(policy.with_check, null);
      else assert.match(policy.with_check.replace(/[()\s]/g, '').toLowerCase(), predicate);
    }
  }
}

export async function checkStudentPaths({ sql, sqlAsync, snapshot, structure }) {
  checkDefinitions(structure);
  const question = questions[0];
  const wrong = question.options.find(option => option.id !== question.answer).id;
  const series = call('drill_create_series', 'uc3', '2026-W43', stamp, questions);
  const answer = (seriesId, choice, op) => call('drill_record_answer', seriesId, question.id, choice, stamp, uuid(op));
  const course = (done, op, revision) => call('personal_save_course', 'matiere-organique', done, 3, 2, 3, uuid(op), revision);
  const quiz = call('personal_record_quiz', uuid(20), 'matiere-organique', 3, 3, stamp);
  const itk = (parameters, op, revision) => call('personal_save_itk', parameters, uuid(op), revision);
  const appearance = (preferences, op, revision) => call('personal_save_appearance', preferences, uuid(op), revision);
  const session = (data, op, revision) => call('personal_save_botanical_session', data, uuid(op), revision);
  const botanical = data => call('personal_record_botanical_answer', botanicalAnswer(data));
  function rpc(id, request, expected) {
    const response = JSON.parse(sql(student(id, request)));
    assert.equal(response.status, expected);
    if (response.row) assert.equal(response.row.user_id, id);
    return response.row;
  }
  const ids = {};
  const sessions = {};
  for (const [id, label] of [[A, 'a'], [B, 'b']]) {
    const row = rpc(id, series, 'inserted');
    ids[id] = row.id;
    assert.equal(row.series_key, 'uc3__2026-W43');
    assert.deepEqual(rpc(id, series, 'replayed'), row);
    const first = rpc(id, answer(row.id, question.answer, 11), 'inserted');
    assert.equal(first.correct, true);
    assert.deepEqual(rpc(id, answer(row.id, question.answer, 11), 'replayed'), first);
    assert.deepEqual(rpc(id, answer(row.id, wrong, 12), 'conflict'), first);
    const training = call('drill_record_training', row.id, question.id, wrong, stamp, uuid(13));
    const attempt = rpc(id, training, 'inserted');
    assert.equal(attempt.correct, false);
    assert.deepEqual(rpc(id, training, 'replayed'), attempt);
    rpc(id, course(true, 21, 0), 'inserted');
    rpc(id, quiz, 'inserted');
    rpc(id, quiz, 'replayed');
    const botanicalSessionData = botanicalSession(`lot660c-${label}`);
    sessions[id] = botanicalSessionData;
    rpc(id, session(botanicalSessionData, 22, 0), 'inserted');
    rpc(id, botanical(botanicalSessionData), 'inserted');
    rpc(id, botanical(botanicalSessionData), 'replayed');
    rpc(id, itk(itkParameters, 23, 0), 'inserted');
    rpc(id, appearance(appearancePreferences, 24, 0), 'inserted');
  }
  assert.notEqual(ids[A], ids[B]);
  assert.equal(rpc(A, course(false, 25, 1), 'updated').done, false);
  assert.equal(rpc(A, course(false, 25, 1), 'replayed').revision, 2);
  const completedSession = { ...sessions[A], completedAt: '2026-10-21T12:02:00.000Z' };
  assert.ok(rpc(A, session(completedSession, 26, 1), 'updated').completed_at);
  assert.equal(rpc(A, appearance({ ...appearancePreferences, season: 'autumn' }, 27, 1), 'updated').season, 'autumn');
  const race = await Promise.all([100, 200].map((area, index) => sqlAsync(student(A,
    itk({ ...itkParameters, area: String(area) }, 28 + index, 1)))));
  const competitors = race.map(value => JSON.parse(value));
  assert.deepEqual(competitors.map(result => result.status).sort(), ['conflict', 'updated']);
  assert.equal(competitors[0].row.revision, 2);
  assert.deepEqual(competitors[0].row, competitors[1].row);

  const before = snapshot();
  const forbidden = { error: /42501/ };
  const metadata = { role: 'service_role', sub: B, user_id: B, id: B };
  for (const [table, entries] of Object.entries(before)) {
    assert.equal(entries.length, 2);
    const owner = ownerColumn(table);
    for (const [id, other] of [[A, B], [B, A]]) {
      assert.equal(sql(student(id, `select ${owner} from public.${table};`, metadata)), id);
      assert.equal(sql(student(id, `select count(*) from public.${table} where ${owner}='${other}';`)), '0');
      if (Object.hasOwn(mutable, table)) {
        const mutate = `update public.${table} set ${mutable[table]} where ${owner}='${other}' returning ${owner};`;
        assert.equal(sql(student(id, mutate)), '');
      }
    }
    assert.equal(sql(asRole('authenticated', `select count(*) from public.${table};`)), '0');
    sql(student(A, `delete from public.${table};`), forbidden);
    sql(student(A, `update public.${table} set ${owner}='${B}';`), forbidden);
    sql(student(A, `update public.${table} set created_at='2026-01-01T00:00:00Z';`), forbidden);
    sql(student(A, `insert into public.${table}(${owner}) values ('${B}');`), forbidden);
    for (const role of ['anon', 'service_role']) {
      sql(asRole(role, `select * from public.${table};`), forbidden);
    }
  }
  sql(student(A, answer(ids[B], question.answer, 99)), { error: /42501.*drill_series_unavailable/ });
  sql(student(A, botanical(sessions[B])), { error: /42501.*personal_session_unavailable/ });
  sql(student(A, "update public.drill_answers set answer='a';"), forbidden);
  sql(student(A, 'update public.quiz_attempts set score=1;'), forbidden);
  sql(student(A, 'update public.botanical_answers set elapsed_ms=1;'), forbidden);
  sql(student(A, "update public.profiles set pseudo='x';"), { error: /23514.*profiles_pseudo_valid/ });
  const rpcProbes = [
    series, answer(ids[A], question.answer, 11),
    call('drill_record_training', ids[A], question.id, wrong, stamp, uuid(13)),
    course(true, 21, 0), quiz, session(sessions[A], 22, 0), botanical(sessions[A]),
    itk(itkParameters, 23, 0), appearance(appearancePreferences, 24, 0),
  ];
  for (const role of ['anon', 'service_role']) {
    for (const request of rpcProbes) sql(asRole(role, request), forbidden);
  }
  for (const role of ['anon', 'authenticated', 'service_role']) {
    for (const { name } of structure.functions.filter(fn => fn.schema === 'bprea_private')) {
      sql(asRole(role, `select bprea_private.${name}();`), forbidden);
    }
  }
  assert.deepEqual(snapshot(), before);
  return { tables: 10, policies: 24, rpc: 9, syntheticRoles: 4, rowsPreserved: 20 };
}
