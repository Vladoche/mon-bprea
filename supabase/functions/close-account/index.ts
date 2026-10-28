import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { createClosureHandler, CLOSURE_TABLES } from '../_shared/closure-handler.js';

const url = Deno.env.get('SUPABASE_URL') || '';
const publicKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
const secretKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const origin = Deno.env.get('BPREA_CLOSURE_ORIGIN') || '';
// Hard local-only guard. A hosted deployment cannot activate this prototype.
const localEndpoint = /^http:\/\/(?:127\.0\.0\.1:54321|localhost:54321|kong:8000)$/.test(url);
const enabled = Deno.env.get('BPREA_CLOSURE_MODE') === 'ephemeral-local' && localEndpoint && origin === 'http://127.0.0.1:4173';
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) } };
const admin = createClient(url || 'http://127.0.0.1:54321', secretKey || 'disabled', options);
const api = {
  async getUser(token: string) {
    const result = await admin.auth.getUser(token); return result.error ? null : result.data.user;
  },
  async reauthenticate(email: string, password: string) {
    const client = createClient(url, publicKey, options);
    const result = await client.auth.signInWithPassword({ email, password });
    if (result.error || !result.data.session || !result.data.user) throw new Error('identity');
    try { return { id: result.data.user.id }; }
    finally { await client.auth.signOut({ scope: 'local' }); }
  },
  async deleteUser(id: string) {
    const result = await admin.auth.admin.deleteUser(id, false); if (result.error) throw new Error('delete');
  },
  async inspect(id: string, token: string) {
    const user = await admin.auth.admin.getUserById(id);
    if (user.error && !(user.error.status === 404 && user.error.code === 'user_not_found')) throw new Error('inspection');
    const scoped = createClient(url, publicKey, { ...options, global: { ...options.global, headers: { Authorization: `Bearer ${token}` } } });
    const pairs = await Promise.all(CLOSURE_TABLES.map(async name => {
      const owner = name === 'profiles' ? 'id' : 'user_id';
      const result = await scoped.from(name).select(owner, { count: 'exact', head: true }).eq(owner, id);
      if (result.error || !Number.isSafeInteger(result.count)) throw new Error('inspection');
      return [name, result.count];
    }));
    return { auth: user.data?.user ? 'present' : 'absent', counts: Object.fromEntries(pairs) };
  },
};
Deno.serve(createClosureHandler({ api, origin, enabled, receiptKey: Deno.env.get('BPREA_CLOSURE_RECEIPT_KEY') }));
