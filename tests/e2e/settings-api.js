// HTTP simulation only: these tests exercise Chromium and IndexedDB, not RLS.
import { accounts, sessionFor } from './course-quiz-api.js';
export { accounts };
export const settingsOrigin = 'https://settings.invalid';
const instant = '2026-10-25T10:00:00.000Z';
const owner = request => { try { return JSON.parse(Buffer.from(request.headers().authorization.split('.')[1], 'base64url')).sub; } catch { return null; } };
export function settingsRow(domain, value, userId, operationId, base = 0) {
  return { user_id: userId, ...(domain === 'itk' ? { parameters: value } : { season: value.season, brightness: value.brightness, client_updated_at: value.updatedAt ?? null }), operation_id: operationId, base_revision: base, revision: base + 1, schema_version: 1, created_at: instant, updated_at: instant };
}
export function createSettingsAPI() {
  const rows = { itk: new Map(), appearance: new Map() }, sent = [];
  const api = { rows, sent, restOffline: false, authOffline: false, loseAck: null, holdRead: null };
  api.install = async (context, account = 'A', sources = {}) => {
    await context.addInitScript(({ session, sources }) => {
      if (localStorage.getItem('settings-fixture-seeded')) return;
      localStorage.setItem('settings-fixture-seeded', 'yes');
      if (session) localStorage.setItem('bprea-auth-settings.invalid-/mon-bprea/', JSON.stringify(session));
      for (const [key, value] of Object.entries(sources)) localStorage.setItem(key, value);
    }, { session: account ? sessionFor(account) : null, sources });
    await context.route('**/assets/auth-config.json*', route => route.fulfill({ json: { enabled: true, environment: 'development', url: settingsOrigin, publishableKey: 'sb_publishable_syntheticSettings', siteUrl: 'http://127.0.0.1:4173/mon-bprea/' } }));
    await context.route(`${settingsOrigin}/**`, async route => {
      const request = route.request(), url = new URL(request.url()), uid = owner(request);
      const respond = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data), headers: { 'access-control-allow-origin': '*' } });
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      if (url.pathname.startsWith('/auth/')) {
        if (api.authOffline) return route.abort('failed');
        if (url.pathname.endsWith('/user')) return respond(Object.values(accounts).some(item => item.id === uid) ? sessionFor(uid === accounts.A.id ? 'A' : 'B').user : { code: 'bad_jwt' }, uid ? 200 : 401);
        if (url.pathname.endsWith('/token')) { const body = request.postDataJSON(); return respond(sessionFor(body.email?.includes('course-b') || body.refresh_token?.endsWith('-B') ? 'B' : 'A')); }
        if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204 });
      }
      if (api.restOffline) return route.abort('failed');
      if (!uid) return respond({ code: 'PGRST303' }, 401);
      if (request.method() === 'GET') {
        const table = url.pathname.split('/').at(-1);
        if (table === 'profiles') return respond({ id: uid, pseudo: null, created_at: instant, updated_at: instant });
        const domain = table === 'itk_settings' ? 'itk' : table === 'appearance_preferences' ? 'appearance' : null;
        if (!domain) return respond([]);
        if (url.searchParams.get('user_id') !== `eq.${uid}`) throw new Error('Singleton reads require the verified owner');
        if (api.holdRead) await api.holdRead(domain);
        const row = rows[domain].get(uid); return respond(row ? [row] : []);
      }
      const domain = url.pathname.endsWith('/personal_save_itk') ? 'itk' : url.pathname.endsWith('/personal_save_appearance') ? 'appearance' : null;
      if (!domain) return respond({ code: 'PGRST202' }, 404);
      const body = request.postDataJSON(); sent.push({ domain, uid, body });
      const value = body[domain === 'itk' ? 'p_parameters' : 'p_preferences'];
      const previous = rows[domain].get(uid), candidate = settingsRow(domain, value, uid, body.p_operation_id, body.p_expected_revision);
      const equal = domain === 'itk' ? JSON.stringify(previous?.parameters) === JSON.stringify(value) : previous?.season === value.season && previous?.brightness === value.brightness && previous?.client_updated_at === (value.updatedAt ?? null);
      if (previous?.operation_id === body.p_operation_id) return respond({ status: equal && previous.base_revision === body.p_expected_revision ? 'replayed' : 'conflict', row: previous });
      if ((previous?.revision || 0) !== body.p_expected_revision) return respond({ status: 'conflict', row: previous || null });
      rows[domain].set(uid, candidate);
      if (api.loseAck === domain) { api.loseAck = null; return route.abort('failed'); }
      return respond({ status: previous ? 'updated' : 'inserted', row: candidate });
    });
  };
  return api;
}
