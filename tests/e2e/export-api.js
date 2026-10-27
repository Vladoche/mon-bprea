import { accounts, sessionFor } from './course-quiz-api.js';
import { serverRows } from '../fixtures/export.js';
export { accounts };
export const exportOrigin = 'https://export.invalid';
export function createExportAPI() {
  const rows = Object.fromEntries(Object.values(accounts).map(account => [account.id, serverRows(account.id, 205)]));
  const api = { rows, reads: [], writes: [], hold: null, failLast: false, authOffline: false };
  api.install = async (context, account = 'A', sources = {}) => {
    await context.addInitScript(({ session, sources }) => {
      if (localStorage.getItem('export-fixture')) return;
      localStorage.setItem('export-fixture', 'yes');
      if (session) localStorage.setItem('bprea-auth-export.invalid-/mon-bprea/', JSON.stringify(session));
      for (const [key, value] of Object.entries(sources)) localStorage.setItem(key, value);
    }, { session: account ? sessionFor(account) : null, sources });
    await context.route('**/assets/auth-config.json*', route => route.fulfill({ json: { enabled: true, environment: 'development', url: exportOrigin, publishableKey: 'sb_publishable_syntheticExport', siteUrl: 'http://127.0.0.1:4173/mon-bprea/' } }));
    await context.route(`${exportOrigin}/**`, async route => {
      const request = route.request(), url = new URL(request.url());
      let uid; try { uid = JSON.parse(Buffer.from(request.headers().authorization.split('.')[1], 'base64url')).sub; } catch { /* Anonymous. */ }
      const send = (data, status = 200) => route.fulfill({ status, json: data, headers: { 'access-control-allow-origin': '*' } });
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      if (url.pathname.startsWith('/auth/')) {
        if (api.authOffline) return send({ code: 'bad_jwt' }, 401);
        if (url.pathname.endsWith('/user')) return uid ? send({ ...sessionFor(uid === accounts.A.id ? 'A' : 'B').user, user_metadata: { password: 'MUST_NEVER_EXPORT' } }) : send({ code: 'bad_jwt' }, 401);
        if (url.pathname.endsWith('/token')) return send(sessionFor(request.postDataJSON().email?.includes('course-b') ? 'B' : 'A'));
        if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204 });
      }
      const table = url.pathname.split('/').at(-1);
      if (table === 'profiles' && request.method() === 'PATCH' && rows[uid]) {
        rows[uid].profiles[0].pseudo = request.postDataJSON().pseudo;
        return send(rows[uid].profiles[0]);
      }
      if (request.method() !== 'GET') { api.writes.push(table); return send({ code: 'PGRST202' }, 404); }
      if (!rows[uid]?.[table]) return send({ code: '42501' }, 403);
      api.reads.push({ table, uid, query: url.search });
      if (api.hold) await api.hold(table);
      if (api.failLast && table === 'quiz_attempts' && url.searchParams.get('or')?.includes('000000000299')) return send({ code: 'unavailable' }, 503);
      let values = rows[uid][table];
      for (const [key, value] of url.searchParams) if (value.startsWith('gt.')) values = values.filter(row => row[key] > value.slice(3));
      const match = url.searchParams.get('or')?.match(/(attempt_id|answer_id)\.gt\."([^"]+)"/);
      if (match) values = values.filter(row => row[match[1]] > match[2]);
      values = values.slice(0, Number(url.searchParams.get('limit')) || 1000);
      return send(request.headers().accept?.includes('object') ? values[0] : values);
    });
  };
  return api;
}
