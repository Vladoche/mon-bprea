import { describe, expect, it, vi } from 'vitest';
import { createBotanicalTransport, classifyBotanicalError } from '../../assets/botanical-sync-transport.js';

const userId = '11111111-1111-4111-8111-111111111111';
function fixture({ failPage = false, duplicate = false, sessions = [] } = {}) {
  const calls = []; let answerPage = 0; let sessionPage = 0;
  const ids = ['s-q1', 's-q2', 'special,"id)'];
  const times = ['2026-10-20T10:00:00.000001+00:00', '2026-10-20T10:00:00.000001+00:00', '2026-10-20T10:00:00.000002+00:00'];
  const client = { from: vi.fn(table => {
    const call = { table, headers: {}, orders: [] }; calls.push(call);
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn((key, value) => { call.filter = [key, value]; return query; }),
      order: vi.fn((column, options) => { call.orders.push([column, options]); return query; }), limit: vi.fn().mockReturnThis(),
      gt: vi.fn((key, value) => { call.cursor = [key, value]; return query; }), or: vi.fn(value => { call.cursor = value; return query; }),
      retry: vi.fn().mockReturnThis(), setHeader: vi.fn((key, value) => { call.headers[key] = value; return query; }), abortSignal: vi.fn().mockReturnThis(),
      then(resolve) {
        if (table === 'botanical_sessions') return Promise.resolve({ data: sessionPage < sessions.length ? [{ user_id: userId, session_id: sessions[sessionPage++] }] : [], error: null }).then(resolve);
        const index = answerPage++;
        if (failPage && index === 1) return Promise.resolve({ error: { code: 'network' } }).then(resolve);
        const data = index < ids.length ? [{ user_id: userId, answer_id: duplicate && index === 1 ? ids[0] : ids[index], created_at: times[index] }] : [];
        return Promise.resolve({ data, error: null }).then(resolve);
      },
    }; return query;
  }) };
  const auth = { verifiedSession: vi.fn().mockResolvedValue({ userId, accessToken: 'synthetic-token-A' }) };
  return { transport: createBotanicalTransport(client, auth, userId), auth, client, calls };
}

describe('transport botanique — réseau simulé, pas une preuve RLS', () => {
  it('pagine les deux tables jusqu’à la page vide avec propriétaire, ordre stable et précision microseconde', async () => {
    const f = fixture({ sessions: ['one', 'two'] }); const history = await f.transport.readHistory({ active: () => true });
    expect(history.sessions.map(row => row.session_id)).toEqual(['one', 'two']);
    expect(history.answers.map(row => row.answer_id)).toEqual(['s-q1', 's-q2', 'special,"id)']);
    const calls = f.calls.filter(call => call.table === 'botanical_answers');
    expect(calls).toHaveLength(4);
    expect(calls[1].cursor).toBe('created_at.gt."2026-10-20T10:00:00.000001+00:00",and(created_at.eq."2026-10-20T10:00:00.000001+00:00",answer_id.gt."s-q1")');
    expect(calls[3].cursor).toContain('answer_id.gt."special,\\"id)"');
    expect(calls[0].orders).toEqual([['created_at', { ascending: true }], ['answer_id', { ascending: true }]]);
    expect(f.calls.filter(call => call.table === 'botanical_sessions')[1].cursor).toEqual(['session_id', 'one']);
    expect(f.calls.every(call => call.filter[0] === 'user_id' && call.filter[1] === userId && call.headers.Authorization === 'Bearer synthetic-token-A')).toBe(true);
  });
  it('rejette tout le scan à la moindre page manquante ou identité répétée', async () => {
    await expect(fixture({ failPage: true }).transport.readHistory()).rejects.toMatchObject({ code: 'network' });
    await expect(fixture({ duplicate: true }).transport.readHistory()).rejects.toMatchObject({ code: 'protocol' });
    await expect(fixture({ sessions: ['same', 'same'] }).transport.readHistory()).rejects.toMatchObject({ code: 'protocol' });
  });
  it('respecte le classement SQL des identités texte et interdit une identité Auth différente avant réseau', async () => {
    const unicode = await fixture({ sessions: ['\uE000', '🌱'] }).transport.readHistory();
    expect(unicode.sessions.map(row => row.session_id)).toEqual(['\uE000', '🌱']);
    const f = fixture(); f.auth.verifiedSession.mockResolvedValue({ userId: 'other', accessToken: 'synthetic-token-B' });
    await expect(f.transport.readHistory()).rejects.toMatchObject({ code: 'session_changed' });
    expect(f.client.from).not.toHaveBeenCalled();
  });
  it('fixe le JWT A et refuse une réponse HTTP tardive quand B a pris la main', async () => {
    let release; let active = true; const response = new Promise(resolve => { release = resolve; });
    const query = { retry: vi.fn().mockReturnThis(), setHeader: vi.fn().mockReturnThis(), abortSignal: vi.fn().mockReturnThis(), then: resolve => response.then(resolve) };
    const client = { rpc: vi.fn().mockReturnValue(query) };
    const auth = { verifiedSession: vi.fn().mockResolvedValue({ userId, accessToken: 'synthetic-token-A' }) };
    const transport = createBotanicalTransport(client, auth, userId); const payload = { p_answer: { id: 'stable' } };
    const sending = transport.send({ type: 'answer', rpcPayload: payload }, { active: () => active });
    await vi.waitFor(() => expect(query.setHeader).toHaveBeenCalledWith('Authorization', 'Bearer synthetic-token-A'));
    active = false; release({ data: { status: 'inserted', row: {} }, error: null });
    await expect(sending).rejects.toMatchObject({ code: 'session_changed' });
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith('personal_record_botanical_answer', payload);
    expect(query.setHeader).toHaveBeenCalledTimes(1);
  });
  it('envoie création et complétion à la RPC existante avec tous ses arguments', async () => {
    const query = { retry() { return this; }, setHeader() { return this; }, abortSignal() { return this; }, then(resolve) { return Promise.resolve({ data: { status: 'replayed', row: {} }, error: null }).then(resolve); } };
    const rpc = vi.fn().mockReturnValue(query); const auth = { verifiedSession: async () => ({ userId, accessToken: 'synthetic' }) };
    const transport = createBotanicalTransport({ rpc }, auth, userId);
    const p = { p_session: { id: 'stable' }, p_operation_id: 'durable', p_expected_revision: 1 };
    await transport.send({ type: 'completion', rpcPayload: p });
    expect(rpc).toHaveBeenCalledExactlyOnceWith('personal_save_botanical_session', p);
  });
  it('distingue sessions rejetées, backend absent, invalidités et panne transitoire', () => {
    for (const code of ['42501', 'invalid_session', 'PGRST303']) expect(classifyBotanicalError({ code }).kind).toBe('session');
    expect(classifyBotanicalError({ status: 403 }).kind).toBe('session');
    for (const code of ['23503', '23514', '22007', '22008', 'protocol', 'PGRST205']) expect(classifyBotanicalError({ code }).kind).toBe('permanent');
    expect(classifyBotanicalError({ code: '40001' }).kind).toBe('transient');
  });
});
