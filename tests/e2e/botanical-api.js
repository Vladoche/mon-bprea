// HTTP simulation only. PostgreSQL/RLS evidence belongs to e2e-supabase.
import { accounts, sessionFor } from './course-quiz-api.js';
export { accounts };
export const botanicalAPIOrigin = 'https://botanical.invalid';
const instant = '2026-10-25T10:00:00.000Z';
const fieldEqual = (key, a, b) => a === b || key.endsWith('_at') && a !== null && b !== null && Date.parse(a) === Date.parse(b);
const same = (a, b) => Object.entries(a).every(([key, value]) => fieldEqual(key, value, b[key]));
const owner = request => {
  try { return JSON.parse(Buffer.from(request.headers().authorization.split('.')[1], 'base64url').toString()).sub; } catch { return null; }
};
export const sessionRow = (value, uid, operationId, base = 0) => ({
  user_id: uid, session_id: value.id, category_id: value.categoryId, mode: value.mode,
  duration_seconds: value.durationSeconds, is_revision: value.revision, started_at: value.startedAt,
  total_questions: value.totalQuestions, completed_at: value.completedAt ?? null, operation_id: operationId,
  base_revision: base, revision: base + 1, schema_version: 1, created_at: instant, updated_at: instant,
});
export const answerRow = (value, uid) => ({
  user_id: uid, answer_id: value.id, session_id: value.sessionId, question_id: value.questionId,
  category_id: value.categoryId, species_id: value.speciesId, photo_id: value.photoId, mode: value.mode,
  is_revision: value.revision, status: value.status, selected_species_id: value.selectedSpeciesId,
  correct: value.correct, elapsed_ms: value.elapsedMs, answered_at: value.answeredAt,
  schema_version: 1, created_at: instant,
});
export function createBotanicalAPI() {
  const sessions = new Map(), answers = new Map(), sent = [];
  const fixture = { sessions, answers, sent, restOffline: false, authOffline: false, loseAnswerAck: false, loseSessionAck: false };
  fixture.install = async (context, account = 'A', visitorRaw = null) => {
    await context.addInitScript(({ session, visitorRaw }) => {
      if (localStorage.getItem('botanical-fixture-seeded')) return;
      localStorage.setItem('botanical-fixture-seeded', 'yes');
      if (session) localStorage.setItem('bprea-auth-botanical.invalid-/mon-bprea/', JSON.stringify(session));
      if (visitorRaw !== null) localStorage.setItem('monbprea.botanical.v1', visitorRaw);
    }, { session: account ? sessionFor(account) : null, visitorRaw });
    await context.route('**/assets/auth-config.json*', route => route.fulfill({ json: {
      enabled: true, environment: 'development', url: botanicalAPIOrigin,
      publishableKey: 'sb_publishable_syntheticBotanical', siteUrl: 'http://127.0.0.1:4173/mon-bprea/',
    } }));
    await context.route(`${botanicalAPIOrigin}/**`, async route => {
      const request = route.request(), url = new URL(request.url()), uid = owner(request);
      const respond = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value), headers: { 'access-control-allow-origin': '*' } });
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      if (url.pathname.startsWith('/auth/')) {
        if (fixture.authOffline) return route.abort('failed');
        if (url.pathname.endsWith('/user')) {
          const account = Object.values(accounts).find(item => item.id === uid);
          return respond(account ? sessionFor(account === accounts.A ? 'A' : 'B').user : { code: 'bad_jwt', message: 'Synthetic invalid JWT' }, account ? 200 : 401);
        }
        if (url.pathname.endsWith('/token')) { const body = request.postDataJSON(); return respond(sessionFor(body.email?.includes('course-b') || body.refresh_token?.endsWith('-B') ? 'B' : 'A')); }
        if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
      }
      if (fixture.restOffline) return route.abort('failed');
      if (!uid) return respond({ code: 'PGRST303', message: 'Synthetic missing JWT' }, 401);
      if (request.method() === 'GET') {
        const table = url.pathname.split('/').at(-1);
        if (['botanical_sessions', 'botanical_answers'].includes(table) && url.searchParams.get('user_id') !== `eq.${uid}`) throw new Error('Personal reads require owner filter');
        if (table === 'profiles') return respond({ id: uid, pseudo: null, created_at: instant, updated_at: instant });
        const values = table === 'botanical_sessions' ? sessions : table === 'botanical_answers' ? answers : new Map();
        const id = table === 'botanical_sessions' ? 'session_id' : 'answer_id';
        let rows = [...values.values()].filter(row => row.user_id === uid).sort((a, b) => table === 'botanical_sessions' ? a[id].localeCompare(b[id]) : a.created_at.localeCompare(b.created_at) || a[id].localeCompare(b[id]));
        const cursor = url.searchParams.get(id)?.replace(/^gt\./, '') || url.searchParams.get('or')?.match(/answer_id\.gt\."?([^"),]+)/)?.[1];
        if (cursor) rows = rows.filter(row => row[id] > cursor);
        return respond(rows.slice(0, Number(url.searchParams.get('limit')) || 100));
      }
      const body = request.postDataJSON(); sent.push({ uid, url: url.pathname, body });
      if (url.pathname.endsWith('/personal_save_botanical_session')) {
        const key = `${uid}:${body.p_session.id}`, previous = sessions.get(key), payload = sessionRow(body.p_session, uid, body.p_operation_id, body.p_expected_revision);
        const fields = ['session_id', 'category_id', 'mode', 'duration_seconds', 'is_revision', 'started_at', 'total_questions', 'completed_at'];
        const equal = fields.every(key => fieldEqual(key, payload[key], previous?.[key]));
        if (previous?.operation_id === body.p_operation_id) return respond({ status: equal && previous.base_revision === body.p_expected_revision ? 'replayed' : 'conflict', row: previous });
        if ((previous?.revision || 0) !== body.p_expected_revision || previous && fields.slice(0, -1).some(key => !fieldEqual(key, payload[key], previous[key])) || previous?.completed_at !== null && previous?.completed_at !== undefined && !fieldEqual('completed_at', previous.completed_at, payload.completed_at)) return respond({ status: 'conflict', row: previous || null });
        if ([...answers.values()].some(row => row.user_id === uid && row.session_id === payload.session_id && payload.completed_at && Date.parse(row.answered_at) > Date.parse(payload.completed_at))) return respond({ code: '23514', message: 'Synthetic end precedes answer' }, 400);
        const row = { ...payload, created_at: previous?.created_at || instant }; sessions.set(key, row);
        if (fixture.loseSessionAck) { fixture.loseSessionAck = false; return route.abort('failed'); }
        return respond({ status: previous ? 'updated' : 'inserted', row });
      }
      if (url.pathname.endsWith('/personal_record_botanical_answer')) {
        const key = `${uid}:${body.p_answer.id}`, previous = answers.get(key), payload = answerRow(body.p_answer, uid);
        if (previous) return respond({ status: same(payload, previous) ? 'replayed' : 'conflict', row: previous });
        const parent = sessions.get(`${uid}:${payload.session_id}`);
        if (!parent) return respond({ code: '23503', message: 'Synthetic missing parent' }, 400);
        answers.set(key, payload);
        if (fixture.loseAnswerAck) { fixture.loseAnswerAck = false; return route.abort('failed'); }
        return respond({ status: 'inserted', row: payload });
      }
      return respond({ code: 'PGRST202', message: 'Synthetic unsupported endpoint' }, 404);
    });
  };
  return fixture;
}
