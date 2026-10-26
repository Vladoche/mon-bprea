import { describe, expect, it, vi } from 'vitest';
import { createSettingsTransport, classifySettingsError } from '../../assets/settings-transport.js';
const userId = '11111111-1111-4111-8111-111111111111';
function fixture() {
  const calls = []; const query = () => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), retry: vi.fn().mockReturnThis(), setHeader: vi.fn().mockReturnThis(), abortSignal: vi.fn().mockReturnThis(), then: resolve => Promise.resolve({ data: [], error: null }).then(resolve) });
  const client = { from: vi.fn(table => { const q = query(); calls.push({ table, q }); return q; }), rpc: vi.fn((name, payload) => { const q = query(); calls.push({ name, payload, q }); return q; }) };
  const auth = { verifiedSession: vi.fn().mockResolvedValue({ userId, accessToken: 'synthetic-token-A' }), getState: () => ({ status: 'authenticated', user: { id: userId } }) };
  return { client, auth, calls, transport: createSettingsTransport(client, auth, userId) };
}
describe('transport singletons — simulations HTTP, sans preuve RLS', () => {
  it('deux SELECT avec filtre propriétaire et JWT vérifié fixé à chaque requête', async () => {
    const f = fixture(); expect(await f.transport.readSettings()).toEqual({ itk: null, appearance: null }); expect(f.calls.map(call => call.table)).toEqual(['itk_settings', 'appearance_preferences']);
    for (const call of f.calls) { expect(call.q.eq).toHaveBeenCalledWith('user_id', userId); expect(call.q.setHeader).toHaveBeenCalledWith('Authorization', 'Bearer synthetic-token-A'); expect(call.q.retry).toHaveBeenCalledWith(false); }
    expect(f.auth.verifiedSession).toHaveBeenCalledTimes(2);
  });
  it('envoie seulement le payload durable de la RPC prévue', async () => {
    const f = fixture(); const payload = { p_parameters: {}, p_operation_id: 'synthetic', p_expected_revision: 2 }; await f.transport.send({ domain: 'itk', rpcPayload: payload }); expect(f.client.rpc).toHaveBeenCalledExactlyOnceWith('personal_save_itk', payload);
    expect(() => f.transport.send({ domain: 'unknown', rpcPayload: payload })).toThrow(/inconnue/);
  });
  it('interdit une autre identité avant accès et refuse réponse tardive', async () => {
    const f = fixture(); f.auth.verifiedSession.mockResolvedValue({ userId: 'other', accessToken: 'synthetic-token-B' }); await expect(f.transport.readSettings()).rejects.toMatchObject({ code: 'session_changed' }); expect(f.client.from).not.toHaveBeenCalled();
    const late = fixture(); let release; const response = new Promise(resolve => { release = resolve; }); const q = { retry: vi.fn().mockReturnThis(), setHeader: vi.fn().mockReturnThis(), abortSignal: vi.fn().mockReturnThis(), then: resolve => response.then(resolve) }; late.client.rpc.mockReturnValue(q);
    let active = true; const sending = late.transport.send({ domain: 'appearance', rpcPayload: {} }, { active: () => active }); await vi.waitFor(() => expect(q.setHeader).toHaveBeenCalled()); active = false; release({ data: {}, error: null }); await expect(sending).rejects.toMatchObject({ code: 'session_changed' });
  });
  it('classe sessions, backend absent et erreurs permanentes sans masquer réseau', () => {
    expect(classifySettingsError({ code: '42501' }).kind).toBe('session'); expect(classifySettingsError({ code: 'PGRST205' }).kind).toBe('permanent'); expect(classifySettingsError({ code: 'protocol' }).kind).toBe('permanent'); expect(classifySettingsError(new TypeError('network')).kind).toBe('transient');
  });
});
