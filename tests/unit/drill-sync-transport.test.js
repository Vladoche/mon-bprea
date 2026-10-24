import { describe, expect, it, vi } from 'vitest';
import { createDrillTransport, classifySyncError } from '../../assets/drill-sync-transport.js';

const userId = '11111111-1111-4111-8111-111111111111';
const ids = [1, 2, 3].map(value => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`);
function fixture() {
  const calls = [];
  const from = vi.fn(table => {
    const call = { table, cursor: null, headers: {} }; calls.push(call);
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
      gt: vi.fn((column, cursor) => { call.cursor = cursor; return query; }), setHeader: vi.fn((key, value) => { call.headers[key] = value; return query; }),
      abortSignal: vi.fn().mockReturnThis(),
      then(resolve) { const next = table === 'drill_series' ? ids.filter(id => !call.cursor || id > call.cursor).slice(0, 1).map(id => ({ id, user_id: userId })) : [];
        return Promise.resolve({ data: next, error: null }).then(resolve); },
    }; return query;
  });
  const auth = { verifiedSession: vi.fn().mockResolvedValue({ userId, accessToken: 'synthetic-unit-only' }) };
  return { transport: createDrillTransport({ from }, auth, userId), calls, auth };
}
describe('transport partagé, pagination et JWT fixé par requête', () => {
  it('lit toutes les pages jusqu’à une page vide même si le serveur plafonne à une ligne', async () => {
    const f = fixture(); const history = await f.transport.readHistory({ signal: new AbortController().signal, active: () => true });
    expect(history.series.map(row => row.id)).toEqual(ids); expect(f.calls.filter(call => call.table === 'drill_series')).toHaveLength(4);
    expect(f.calls.every(call => call.headers.Authorization === 'Bearer synthetic-unit-only')).toBe(true);
  });
  it('refuse une identité différente avant de construire la requête', async () => {
    const f = fixture(); f.auth.verifiedSession.mockResolvedValue({ userId: ids[0], accessToken: 'synthetic-other' });
    await expect(f.transport.readHistory({ active: () => true })).rejects.toMatchObject({ code: 'session_changed' }); expect(f.calls).toEqual([]);
  });
  it('abandonne une réponse tardive après invalidation de génération', async () => {
    const f = fixture(); let active = true;
    f.auth.verifiedSession.mockImplementation(async () => { active = false; return { userId, accessToken: 'synthetic-unit-only' }; });
    await expect(f.transport.readHistory({ active: () => active })).rejects.toThrow(); expect(f.calls).toEqual([]);
  });
  it('distingue contraintes permanentes, expiration et erreurs transitoires', () => {
    for (const code of ['42501', '23514', '23503', '23505', 'protocol']) expect(classifySyncError({ code }).kind).toBe('permanent');
    expect(classifySyncError({ code: '40001' }).kind).toBe('transient'); expect(classifySyncError({ code: 'PGRST303' }).kind).toBe('session');
  });
});
