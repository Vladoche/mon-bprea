import { it, expect, vi } from 'vitest';
import { createClosureHandler, CLOSURE_TABLES } from '../../supabase/functions/_shared/closure-handler.js';
import { TABLES } from '../../assets/export-sources.js';
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
function fixture() {
  let time = Date.parse('2026-10-27T12:00:00Z');
  const token = `fixture.${Buffer.from(JSON.stringify({ sub: A, exp: time / 1000 + 120 })).toString('base64url')}.signature`;
  const users = new Map([A, B].map(id => [id, Object.fromEntries(CLOSURE_TABLES.map(name => [name, 1]))]));
  const api = {
    getUser: vi.fn(async value => value === token && users.has(A) && time < Date.parse('2026-10-27T12:02:00Z') ? { id: A, email: 'a@example.invalid' } : null),
    reauthenticate: vi.fn(async (email, password) => password === 'correct-password' && email === 'a@example.invalid' ? { id: A } : null),
    inspect: vi.fn(async id => ({ auth: users.has(id) ? 'present' : 'absent', counts: users.get(id) || Object.fromEntries(CLOSURE_TABLES.map(name => [name, 0])) })),
    deleteUser: vi.fn(async id => { users.delete(id); }),
  };
  const handler = createClosureHandler({ api, receiptKey: 'ab'.repeat(32), origin: 'http://127.0.0.1:4173', enabled: true, now: () => time });
  const request = (body, options = {}) => handler(new Request('http://127.0.0.1:54321/functions/v1/close-account', {
    method: options.method || 'POST', headers: { Origin: 'http://127.0.0.1:4173', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
    ...((options.method || 'POST') === 'POST' ? { body: JSON.stringify(body) } : {}),
  }));
  const prepare = async () => (await (await request({ action: 'prepare', password: 'correct-password', confirmation: 'SUPPRIMER' })).json()).receipt;
  return { api, users, request, prepare, time: value => { time += value; } };
}
it('contrat de dix tables, réauthentification puis retrait A seulement et retry idempotent sans deuxième suppression', async () => {
  expect(CLOSURE_TABLES).toEqual(Object.keys(TABLES));
  const f = fixture(), beforeB = structuredClone(f.users.get(B)), receipt = await f.prepare();
  expect(f.users.has(A)).toBe(true); expect(f.api.deleteUser).not.toHaveBeenCalled();
  const body = { action: 'execute', receipt, confirmation: 'SUPPRIMER' };
  expect(await (await f.request(body)).json()).toEqual({ status: 'server_confirmed' });
  expect(f.users.has(A)).toBe(false); expect(f.users.get(B)).toEqual(beforeB);
  expect(await (await f.request(body)).json()).toEqual({ status: 'server_confirmed' }); expect(f.api.deleteUser).toHaveBeenCalledTimes(1);
});
it('anonyme, JWT invalide, session expirée, GET, origine étrangère et UUID B injecté ne suppriment rien', async () => {
  const f = fixture(), body = { action: 'prepare', password: 'correct-password', confirmation: 'SUPPRIMER' };
  for (const options of [{ headers: { Authorization: '' } }, { headers: { Authorization: 'Bearer invalid-token-long-enough' } }, { method: 'GET' }, { headers: { Origin: 'https://attacker.invalid' } }]) expect((await f.request(body, options)).status).toBeGreaterThanOrEqual(400);
  expect((await f.request({ ...body, userId: B })).status).toBe(400);
  f.time(121000); expect((await f.request(body)).status).toBe(401); expect(f.users.size).toBe(2); expect(f.api.deleteUser).not.toHaveBeenCalled();
});
it('mot de passe erroné, MFA non pris en charge, identité divergente et simple case ne prouvent pas l’identité', async () => {
  const f = fixture(), body = { action: 'prepare', password: 'wrong', confirmation: 'SUPPRIMER' };
  expect((await f.request(body)).status).toBe(401);
  f.api.reauthenticate.mockResolvedValue({ id: B }); expect((await f.request({ ...body, password: 'correct-password' })).status).toBe(401);
  f.api.getUser.mockResolvedValue({ id: A, email: 'a@example.invalid', factors: [{ status: 'verified' }] }); expect((await f.request(body)).status).toBe(401);
  expect((await f.request({ action: 'execute', confirmation: 'SUPPRIMER', receipt: 'case-cochee' })).status).toBe(401); expect(f.api.deleteUser).not.toHaveBeenCalled();
});
it('preuve liée au jeton exact, non modifiable, expirée et corps libre refusés', async () => {
  const f = fixture(), receipt = await f.prepare(), body = { action: 'execute', receipt, confirmation: 'SUPPRIMER' };
  expect((await f.request(body, { headers: { Authorization: 'Bearer other-token-long-enough' } })).status).toBe(401);
  expect((await f.request({ ...body, receipt: receipt.slice(0, -5) + 'wrong' })).status).toBe(401);
  expect((await f.request({ ...body, userId: B })).status).toBe(400);
  expect((await f.request({ ...body, confirmation: true })).status).toBe(400);
  f.time(121000); expect((await f.request(body)).status).toBe(401); expect(f.users.size).toBe(2);
});
it('échec avant ou pendant Auth laisse un état non confirmé et reprise limitée à A', async () => {
  const f = fixture(), receipt = await f.prepare(), body = { action: 'execute', receipt, confirmation: 'SUPPRIMER' };
  f.api.inspect.mockRejectedValueOnce(new Error('network'));
  expect((await f.request(body)).status).toBe(409); expect(f.api.deleteUser).not.toHaveBeenCalled();
  f.api.deleteUser.mockRejectedValueOnce(new Error('network'));
  expect(await (await f.request(body)).json()).toMatchObject({ status: 'server_unconfirmed' }); expect(f.users.has(A)).toBe(true);
  expect((await f.request(body)).status).toBe(200); expect(f.users.has(A)).toBe(false); expect(f.users.has(B)).toBe(true);
});
it('perte de vérification après commit n’annonce pas le succès ; le retry inspecte sans supprimer à nouveau', async () => {
  const f = fixture(), receipt = await f.prepare(), body = { action: 'execute', receipt, confirmation: 'SUPPRIMER' };
  const original = f.api.inspect.getMockImplementation();
  f.api.inspect.mockImplementation(async id => { if (!f.users.has(A)) throw new Error('verification'); return original(id); });
  expect((await f.request(body)).status).toBe(409); expect(f.users.has(A)).toBe(false);
  f.api.inspect.mockImplementation(original);
  expect(await (await f.request(body)).json()).toEqual({ status: 'server_confirmed' }); expect(f.api.deleteUser).toHaveBeenCalledTimes(1);
});
it('données résiduelles, compte présent ou contrôle incomplet empêchent toute confirmation ; double soumission reste bornée', async () => {
  const f = fixture(), receipt = await f.prepare(), body = { action: 'execute', receipt, confirmation: 'SUPPRIMER' };
  f.api.inspect.mockResolvedValue({ auth: 'absent', counts: { profiles: 0 } }); expect((await f.request(body)).status).toBe(409); expect(f.api.deleteUser).not.toHaveBeenCalled();
  f.api.inspect.mockResolvedValue({ auth: 'absent', counts: { ...Object.fromEntries(CLOSURE_TABLES.map(key => [key, 0])), quiz_attempts: 1 } }); expect((await f.request(body)).status).toBe(409);
  const g = fixture(), proof = await g.prepare();
  const results = await Promise.all([g.request({ ...body, receipt: proof }), g.request({ ...body, receipt: proof })]);
  expect(results.every(result => [200, 401].includes(result.status))).toBe(true); expect(g.users.has(A)).toBe(false); expect(g.users.has(B)).toBe(true);
});
it('prototype désactivé sans configuration de confiance, aucune fuite du mot de passe dans les réponses', async () => {
  const handler = createClosureHandler({ enabled: false });
  expect((await handler(new Request('http://127.0.0.1:54321/'))).status).toBe(503);
  const f = fixture(), result = await f.request({ action: 'prepare', password: 'private-password-test', confirmation: 'SUPPRIMER' });
  expect(await result.text()).not.toContain('private-password-test');
});
