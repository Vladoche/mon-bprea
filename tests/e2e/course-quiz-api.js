// Synthetic HTTP server for the actual SDK, Auth/service, IndexedDB and UI.
// This fixture does not execute PostgreSQL or establish any RLS proof.
export const apiOrigin = 'https://course-quiz.invalid';
export const accounts = {
  A: { id: '63200000-0000-4000-8000-000000000001', email: 'course-a@example.invalid' },
  B: { id: '63200000-0000-4000-8000-000000000002', email: 'course-b@example.invalid' },
};
const instant = '2026-10-25T10:00:00.000Z';
const json = value => JSON.stringify(value);
const token = user => `${Buffer.from(json({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(json({ sub: user.id, session_id: `63200000-0000-4000-8000-00000000000${user === accounts.A ? '3' : '4'}`, aud: 'authenticated', role: 'authenticated', exp: 2000000000 })).toString('base64url')}.synthetic-signature`;
const userFor = account => ({ ...account, aud: 'authenticated', role: 'authenticated', created_at: instant, app_metadata: { provider: 'email' }, user_metadata: {}, identities: [] });
export function sessionFor(name) {
  const account = accounts[name];
  return { access_token: token(account), refresh_token: `synthetic-refresh-${name}`, token_type: 'bearer', expires_in: 3600, expires_at: 2000000000, user: userFor(account) };
}
const owner = request => {
  try { return JSON.parse(Buffer.from(request.headers().authorization.split('.')[1], 'base64url').toString()).sub; }
  catch { return null; }
};
const same = (a,b) => Object.entries(a).every(([key,value]) => b[key] === value);
export function createCourseQuizAPI() {
  const courses = new Map(), attempts = new Map(), sent = [];
  const fixture = { courses, attempts, sent, restOffline: false, authOffline: false, loseQuizAck: false };
  fixture.install = async (context, account = 'A', visitorRaw = null) => {
    await context.addInitScript(({ session, key, visitorRaw }) => {
      if (localStorage.getItem('course-quiz-fixture-seeded')) return;
      localStorage.setItem('course-quiz-fixture-seeded', 'yes');
      if (session) localStorage.setItem(key, JSON.stringify(session));
      if (visitorRaw !== null) localStorage.setItem('bprea-demo-progress-v1', visitorRaw);
    }, { session: account ? sessionFor(account) : null, key: 'bprea-auth-course-quiz.invalid-/', visitorRaw });
    await context.route('**/assets/auth-config.json*', route => route.fulfill({ json: { enabled: true, environment: 'development', url: apiOrigin, publishableKey: 'sb_publishable_syntheticCourseQuiz', siteUrl: 'http://127.0.0.1:4173/' } }));
    await context.route(`${apiOrigin}/**`, async route => {
      const request = route.request(), url = new URL(request.url()), uid = owner(request);
      const respond = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: json(value), headers: { 'access-control-allow-origin': '*' } });
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      if (url.pathname.startsWith('/auth/')) {
        if (fixture.authOffline) return route.abort('failed');
        if (url.pathname.endsWith('/user')) {
          const account = Object.values(accounts).find(item => item.id === uid);
          return respond(account ? userFor(account) : { code: 'bad_jwt', message: 'Synthetic invalid JWT' }, account ? 200 : 401);
        }
        if (url.pathname.endsWith('/token')) {
          const body = request.postDataJSON();
          const name = body.email?.includes('course-b') || body.refresh_token?.endsWith('-B') ? 'B' : 'A';
          return respond(sessionFor(name));
        }
        if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
      }
      if (fixture.restOffline) return route.abort('failed');
      if (!uid) return respond({ code: 'PGRST303', message: 'Synthetic missing JWT' }, 401);
      if (request.method() === 'GET') {
        const table = url.pathname.split('/').at(-1);
        if (['course_states', 'quiz_attempts'].includes(table) && url.searchParams.get('user_id') !== `eq.${uid}`) throw new Error('A personal read must filter the current owner');
        if (table === 'course_states') {
          let rows = [...courses.values()].filter(row => row.user_id === uid).sort((a,b) => a.lesson_id.localeCompare(b.lesson_id));
          const cursor = url.searchParams.get('lesson_id')?.replace(/^gt\./, '');
          if (cursor) rows = rows.filter(row => row.lesson_id > cursor);
          return respond(rows.slice(0, Number(url.searchParams.get('limit')) || 100));
        }
        if (table === 'quiz_attempts') {
          let rows = [...attempts.values()].filter(row => row.user_id === uid).sort((a,b) => a.created_at.localeCompare(b.created_at) || a.attempt_id.localeCompare(b.attempt_id));
          const filter = url.searchParams.get('or');
          const cursor = filter?.match(/attempt_id\.gt\.([0-9a-f-]+)/)?.[1];
          if (cursor) rows = rows.filter(row => row.attempt_id > cursor);
          return respond(rows.slice(0, Number(url.searchParams.get('limit')) || 100));
        }
        if (table === 'profiles') return respond({ id: uid, pseudo: null, created_at: instant, updated_at: instant });
        return respond([]);
      }
      const body = request.postDataJSON(); sent.push({ uid, url: url.pathname, body });
      if (url.pathname.endsWith('/personal_save_course')) {
        const key = `${uid}:${body.p_lesson_id}`, previous = courses.get(key);
        const payload = { lesson_id: body.p_lesson_id, done: body.p_done, best_score: body.p_best_score, legacy_score: body.p_legacy_score, legacy_total: body.p_legacy_total };
        if (previous?.operation_id === body.p_operation_id) return respond({ status: same(payload,previous) && previous.base_revision === body.p_expected_revision ? 'replayed' : 'conflict', row: previous });
        if ((previous?.revision || 0) !== body.p_expected_revision) return respond({ status: 'conflict', row: previous || null });
        const row = { ...payload, user_id: uid, operation_id: body.p_operation_id, revision: (previous?.revision || 0) + 1, base_revision: body.p_expected_revision, schema_version: 1, created_at: previous?.created_at || instant, updated_at: instant };
        courses.set(key,row); return respond({ status: previous ? 'updated' : 'inserted', row });
      }
      if (url.pathname.endsWith('/personal_record_quiz')) {
        const key = `${uid}:${body.p_attempt_id}`, previous = attempts.get(key);
        const payload = { attempt_id: body.p_attempt_id, lesson_id: body.p_lesson_id, score: body.p_score, total: body.p_total, completed_at: body.p_completed_at };
        if (previous) return respond({ status: same(payload,previous) ? 'replayed' : 'conflict', row: previous });
        const row = { ...payload, user_id: uid, schema_version: 1, created_at: instant };
        attempts.set(key,row);
        if (fixture.loseQuizAck) { fixture.loseQuizAck = false; return route.abort('failed'); }
        return respond({ status: 'inserted', row });
      }
      return respond({ code: 'PGRST202', message: 'Synthetic unsupported endpoint' }, 404);
    });
  };
  return fixture;
}
