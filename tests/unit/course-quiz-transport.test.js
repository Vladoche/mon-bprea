import { describe, expect, it, vi } from 'vitest';
import { createCourseQuizTransport, classifyCourseQuizError } from '../../assets/course-quiz-transport.js';

const userId = '11111111-1111-4111-8111-111111111111';
const ids = [1, 2, 3].map(value => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`);
function fixture({ failPage = false, backwards = false, courseIds = [] } = {}) {
  const calls = []; let quizPage = 0; let coursePage = 0;
  const times = ['2026-10-20T10:00:00.000001+00:00', '2026-10-20T10:00:00.000001+00:00', '2026-10-20T10:00:00.000002+00:00'];
  const client = { from: vi.fn(table => {
    const call = { table, headers: {}, orders: [], cursor: null }; calls.push(call);
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn((key, value) => { call.filter = [key, value]; return query; }),
      order: vi.fn((column, options) => { call.orders.push([column, options]); return query; }), limit: vi.fn().mockReturnThis(),
      gt: vi.fn((key, value) => { call.cursor = [key, value]; return query; }), or: vi.fn(value => { call.cursor = value; return query; }),
      retry: vi.fn().mockReturnThis(), setHeader: vi.fn((key, value) => { call.headers[key] = value; return query; }), abortSignal: vi.fn().mockReturnThis(),
      then(resolve) {
        if (table === 'course_states') return Promise.resolve({ data: coursePage < courseIds.length ? [{ user_id: userId, lesson_id: courseIds[coursePage++] }] : [], error: null }).then(resolve);
        const index = quizPage++;
        if (failPage && index === 1) return Promise.resolve({ error: { code: 'network' } }).then(resolve);
        const data = index < ids.length ? [{ user_id: userId, attempt_id: backwards && index === 1 ? ids[0] : ids[index], created_at: times[index] }] : [];
        return Promise.resolve({ data, error: null }).then(resolve);
      },
    }; return query;
  }) };
  const auth = { verifiedSession: vi.fn().mockResolvedValue({ userId, accessToken: 'synthetic-token-A' }) };
  return { transport: createCourseQuizTransport(client, auth, userId), auth, client, calls };
}

describe('transport cours/QCM — pagination simulée, pas une preuve RLS', () => {
  it('lit jusqu’à une page vide avec filtre propriétaire et curseur créé/UUID, même sous plafond serveur', async () => {
    const f = fixture(); const result = await f.transport.readHistory({ active: () => true });
    expect(result.attempts.map(row => row.attempt_id)).toEqual(ids);
    const calls = f.calls.filter(call => call.table === 'quiz_attempts'); expect(calls).toHaveLength(4);
    expect(calls[1].cursor).toBe(`created_at.gt."2026-10-20T10:00:00.000001+00:00",and(created_at.eq."2026-10-20T10:00:00.000001+00:00",attempt_id.gt.${ids[0]})`);
    expect(calls[2].orders).toEqual([['created_at', { ascending: true }], ['attempt_id', { ascending: true }]]);
    expect(f.calls.every(call => call.filter[0] === 'user_id' && call.filter[1] === userId && call.headers.Authorization === 'Bearer synthetic-token-A')).toBe(true);
    expect(f.auth.verifiedSession).toHaveBeenCalledTimes(5);
  });
  it('rejette le scan entier si la deuxième page échoue ou répète une identité', async () => {
    await expect(fixture({ failPage: true }).transport.readHistory({ active: () => true })).rejects.toMatchObject({ code: 'network' });
    await expect(fixture({ backwards: true }).transport.readHistory({ active: () => true })).rejects.toMatchObject({ code: 'protocol' });
  });
  it('pagine également les cours par identité, respecte le tri SQL et refuse une répétition', async () => {
    const f = fixture({ courseIds: ['alpha', 'beta'] });
    const history = await f.transport.readHistory({ active: () => true });
    expect(history.courses.map(row => row.lesson_id)).toEqual(['alpha', 'beta']);
    expect(f.calls.filter(call => call.table === 'course_states')[1].cursor).toEqual(['lesson_id', 'alpha']);
    const unicode = await fixture({ courseIds: ['\uE000', '🌱'] }).transport.readHistory({ active: () => true });
    expect(unicode.courses.map(row => row.lesson_id)).toEqual(['\uE000', '🌱']);
    await expect(fixture({ courseIds: ['beta', 'beta'] }).transport.readHistory({ active: () => true })).rejects.toMatchObject({ code: 'protocol' });
  });
  it('refuse une autre identité avant toute requête', async () => {
    const f = fixture(); f.auth.verifiedSession.mockResolvedValue({ userId: ids[0], accessToken: 'synthetic-token-B' });
    await expect(f.transport.readHistory({ active: () => true })).rejects.toMatchObject({ code: 'session_changed' });
    expect(f.client.from).not.toHaveBeenCalled();
  });
  it('garde le JWT A sur un envoi puis refuse son acquittement tardif après passage à B', async () => {
    let release; let active = true;
    const response = new Promise(resolve => { release = resolve; });
    const query = { retry: vi.fn().mockReturnThis(), setHeader: vi.fn().mockReturnThis(), abortSignal: vi.fn().mockReturnThis(), then: resolve => response.then(resolve) };
    const client = { rpc: vi.fn().mockReturnValue(query) };
    const auth = { verifiedSession: vi.fn().mockResolvedValue({ userId, accessToken: 'synthetic-token-A' }) };
    const transport = createCourseQuizTransport(client, auth, userId);
    const payload = { p_attempt_id: ids[0], p_lesson_id: 'matiere-organique', p_score: 2, p_total: 3, p_completed_at: '2026-10-20T10:00:00.000Z' };
    const sending = transport.send({ type: 'quiz', rpcPayload: payload }, { active: () => active });
    await vi.waitFor(() => expect(query.setHeader).toHaveBeenCalledWith('Authorization', 'Bearer synthetic-token-A'));
    active = false; auth.verifiedSession.mockResolvedValue({ userId: ids[1], accessToken: 'synthetic-token-B' });
    release({ data: { status: 'inserted', row: {} }, error: null });
    await expect(sending).rejects.toMatchObject({ code: 'session_changed' });
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith('personal_record_quiz', payload); expect(query.setHeader).toHaveBeenCalledTimes(1);
  });
  it('suspend Auth sur refus de droits et réserve les retries aux erreurs transitoires', () => {
    for (const code of ['PGRST303', '42501', 'invalid_session']) expect(classifyCourseQuizError({ code }).kind).toBe('session');
    expect(classifyCourseQuizError({ status: 403 }).kind).toBe('session');
    for (const code of ['23514', '22007', '22008', 'protocol']) expect(classifyCourseQuizError({ code }).kind).toBe('permanent');
    for (const code of ['PGRST202', 'PGRST205', '42P01', '42883']) {
      expect(classifyCourseQuizError({ code })).toMatchObject({ kind: 'permanent', code, message: expect.stringContaining('Le stockage du compte') });
    }
    expect(classifyCourseQuizError({ code: '40001' }).kind).toBe('transient');
  });
});
