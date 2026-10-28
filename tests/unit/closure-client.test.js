import { it, expect, vi } from 'vitest';
import { createClosureClient, closureAvailable } from '../../assets/closure-client.js';
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
const configuration = { environment: 'development', url: 'http://127.0.0.1:54321', publishableKey: 'sb_publishable_synthetic', localAccountClosure: true };
function fixture(fetcher) {
  let id = A, version = 0; const listeners = new Set();
  const auth = { getState: () => ({ status: 'authenticated', user: { id } }), getIdentityVersion: () => version,
    verifiedSession: vi.fn(async () => ({ userId: id, accessToken: 'student-token' })), signOut: vi.fn(async () => {}),
    subscribe(fn) { listeners.add(fn); fn(auth.getState()); return () => listeners.delete(fn); } };
  const client = createClosureClient({ auth, configuration, fetcher, available: true });
  return { auth, client, switch(next) { id = next; version++; listeners.forEach(fn => fn(auth.getState())); } };
}
const reply = body => new Response(JSON.stringify(body), { status: 200 });
it('seules configuration et origine de la stack éphémère peuvent proposer la clôture', () => {
  expect(closureAvailable(configuration, 'http://127.0.0.1:4173')).toBe(true);
  for (const change of [{ localAccountClosure: false }, { environment: 'production' }, { url: 'https://example.supabase.co' }]) expect(closureAvailable({ ...configuration, ...change }, 'http://127.0.0.1:4173')).toBe(false);
  expect(closureAvailable(configuration, 'https://vladoche.github.io')).toBe(false);
});
it('perte réseau ne déconnecte pas et le retry réutilise exactement la même cible liée et capacité', async () => {
  const bodies = []; let executions = 0;
  const fetcher = vi.fn(async (_, options) => { const body = JSON.parse(options.body); bodies.push(body);
    if (body.action === 'prepare') return reply({ status: 'identity_verified', receipt: 'opaque-proof' });
    if (++executions === 1) throw new TypeError('network'); return reply({ status: 'server_confirmed' }); });
  const f = fixture(fetcher); await f.client.prepare('password', 'SUPPRIMER');
  expect(f.auth.signOut).not.toHaveBeenCalled(); await expect(f.client.execute()).rejects.toThrow('n’est pas confirmée');
  expect(f.auth.signOut).not.toHaveBeenCalled(); expect(f.client.canRetry()).toBe(true);
  expect(await f.client.execute()).toEqual({ server: 'confirmed', local: 'not_cleaned', session: 'ended' });
  expect(bodies[1]).toEqual(bodies[2]); expect(bodies[1]).toEqual({ action: 'execute', receipt: 'opaque-proof', confirmation: 'SUPPRIMER' });
  expect(f.auth.signOut).toHaveBeenCalledTimes(1); expect(f.client.canRetry()).toBe(false); f.client.stop();
});
it('A→B→A invalide la preuve, double soumission et fin de session locale en échec restent distinctes', async () => {
  const f = fixture(vi.fn(async (_, options) => reply(JSON.parse(options.body).action === 'prepare' ? { status: 'identity_verified', receipt: 'proof' } : { status: 'server_confirmed' })));
  await f.client.prepare('password', 'SUPPRIMER'); f.switch(B); f.switch(A);
  await expect(f.client.execute()).rejects.toThrow(); expect(f.auth.signOut).not.toHaveBeenCalled();
  await f.client.prepare('password', 'SUPPRIMER'); f.auth.signOut.mockRejectedValue(new Error('local session failure'));
  const first = f.client.execute(); await expect(f.client.execute()).rejects.toThrow();
  expect(await first).toEqual({ server: 'confirmed', local: 'not_cleaned', session: 'incomplete' }); f.client.stop();
});
