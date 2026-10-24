import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createAuthService } from '../../assets/auth-service.js';
import { createDrillSyncService } from '../../assets/drill-sync-service.js';
import { createPersonalRepository, personalScope } from '../../assets/drill-personal-store.js';
import { authUser, mockAuthClient } from '../helpers/auth-mock.js';
import { MemoryStorage } from '../helpers/memory-storage.js';
import { makeSeries } from '../fixtures/drill.js';

const userB = { ...authUser, id: '22222222-2222-4222-8222-222222222222', email: 'eleve-b@example.invalid' };
const remoteId = '33333333-3333-4333-8333-333333333333';
const series = makeSeries();
const at = '2026-10-20T10:00:00.000Z';
const configuration = { environment: 'development', url: 'https://fixture.invalid', siteUrl: 'http://127.0.0.1:4173/mon-bprea/' };
const services = [];
afterEach(() => { services.splice(0).forEach(service => service.stop()); vi.unstubAllGlobals(); });

async function fixture() {
  vi.stubGlobal('localStorage', new MemoryStorage());
  const indexedDB = new IDBFactory();
  const sdk = mockAuthClient();
  let session; let failure = null; let hold = null;
  function setUser(user) {
    session = { user, access_token: `synthetic.${btoa(JSON.stringify({ sub: user.id, session_id: '44444444-4444-4444-8444-444444444444' }))}.not-a-real-signature`, refresh_token: 'synthetic-unit-only' };
  }
  setUser(authUser);
  sdk.client.auth.getSession.mockImplementation(async () => ({ data: { session }, error: null }));
  sdk.client.auth.getUser.mockImplementation(async () => {
    if (failure === 'network') throw new TypeError('Auth unavailable in isolated test');
    if (failure === 'revoked') return { data: { user: null }, error: { status: 401, code: 'bad_jwt' } };
    return { data: { user: session.user }, error: null };
  });
  const auth = createAuthService(sdk.client, configuration); await auth.start();
  const histories = new Map([[authUser.id, { series: [{ id: remoteId, user_id: authUser.id, unit: series.unit, week: series.week,
    series_key: series.id, started_at: series.startedAt, questions: series.questions, schema_version: 1, created_at: at }], answers: [], training: [] }]]);
  const tasks = new Map(); let nextTask = 0; const requests = []; const reads = [];
  const sync = createDrillSyncService({ auth, configuration: { ...configuration, client: sdk.client }, broadcast: null,
    repositoryFactory: scope => createPersonalRepository(scope, { indexedDB }),
    now: () => Date.parse(at),
    schedule(fn, delay) { const id = ++nextTask; tasks.set(id, { fn, delay }); return id; },
    cancel(id) { tasks.delete(id); },
    transportFactory(client, authService, expectedId) {
      const history = histories.get(expectedId) || { series: [], answers: [], training: [] }; histories.set(expectedId, history);
      return {
        async readHistory(options) {
          const verified = await authService.verifiedSession(expectedId);
          if (!options.active()) throw new Error('Invalidated test read');
          reads.push(verified.userId); return structuredClone(history);
        },
        async send(operation, options) {
          const verified = await authService.verifiedSession(expectedId);
          if (!options.active()) throw new Error('Invalidated test send');
          requests.push({ userId: verified.userId, operation: structuredClone(operation) });
          const collection = operation.type === 'answer' ? history.answers : history.training;
          const existing = collection.find(row => row.operation_id === operation.id);
          const payload = operation.rpcPayload;
          const row = existing || { user_id: expectedId, operation_id: operation.id, series_id: payload.p_series_id,
            question_id: payload.p_question_id, answer: payload.p_answer, answered_at: payload.p_answered_at,
            correct: payload.p_answer === series.questions.find(question => question.id === payload.p_question_id).answer, created_at: at };
          if (!existing) collection.push(row);
          // Intentionally retain a committed HTTP response beyond abort so that
          // the service's generation guard, rather than this mock, rejects it.
          if (hold) { const pause = hold; hold = null; await pause; }
          return { status: existing ? 'replayed' : 'inserted', row: structuredClone(row) };
        },
      };
    },
  });
  services.push(sync);
  async function flush() {
    let turns = 0;
    while (tasks.size) {
      if (++turns > 10) throw new Error('Unexpected automatic synchronization loop');
      const [id, task] = tasks.entries().next().value; tasks.delete(id);
      expect(task.delay).toBe(0); task.fn(); await sync.synchronize();
    }
  }
  async function saved(userId = authUser.id) {
    const repository = createPersonalRepository(personalScope({ ...configuration, userId }), { indexedDB });
    try { return await repository.read(); } finally { await repository.close(); }
  }
  await sync.start(); await flush(); expect(sync.getState().sync.state).toBe('synced');
  return { auth, sync, sdk, tasks, requests, reads, histories, flush, saved,
    fail(value) { failure = value; },
    holdResponse() { let release; hold = new Promise(resolve => { release = resolve; }); return release; },
    switchTo(user) { setUser(user); sdk.emit('SIGNED_IN', session); },
    signedOut() { sdk.emit('SIGNED_OUT', null); },
  };
}

describe('reprise Auth/Drill — vrais services et IndexedDB simulé, sans événement online', () => {
  it('reprend authenticated → offline → authenticated avec UUID/payload persistés et sans boucle', async () => {
    const f = await fixture();
    f.fail('network'); await expect(f.auth.retry()).rejects.toMatchObject({ code: 'network' });
    expect(f.auth.getState().status).toBe('offline');
    const question = series.questions[0];
    expect((await f.sync.submitAnswer(series.id, question.id, question.answer, { nowISO: at })).error).toBeNull();
    await f.flush(); // Verification fails again and cancels the queued retry.
    expect(f.sync.getState().sync.state).toBe('offline'); expect(f.tasks.size).toBe(0);
    const before = await f.saved(); const operation = before.operations[0];
    expect(operation.state).toBe('pending'); expect(operation.rpcPayload.p_operation_id).toBe(operation.id);
    expect(before.drill.series[series.id].answers[question.id].answer).toBe(question.answer);
    f.fail(null); await f.auth.retry(); await f.flush();
    expect(f.sync.getState().sync.state).toBe('synced');
    const after = await f.saved(); expect(after.operations[0]).toMatchObject({ id: operation.id, payload: operation.payload, rpcPayload: operation.rpcPayload, state: 'confirmed' });
    expect(f.requests).toHaveLength(1); expect(f.requests[0].operation.rpcPayload).toEqual(operation.rpcPayload);
    expect(f.histories.get(authUser.id).answers).toHaveLength(1); expect(f.histories.get(authUser.id).training).toEqual([]);
    const reads = f.reads.length;
    await f.auth.retry(); await f.auth.retry(); await f.flush();
    expect(f.reads).toHaveLength(reads); expect(f.requests).toHaveLength(1); expect(f.tasks.size).toBe(0);
  });

  it('conserve la file et masque le cache quand A devient anonymous', async () => {
    const f = await fixture(); const question = series.questions[0];
    await f.sync.submitAnswer(series.id, question.id, question.answer, { nowISO: at }); const before = await f.saved();
    f.signedOut(); await f.sync.start(); await f.flush();
    expect(f.sync.getState().mode).toBe('visitor'); expect(f.sync.getState().view.series).toEqual({});
    expect((await f.saved()).operations).toEqual(before.operations); expect(f.requests).toEqual([]);
  });

  it('relit aussi le compte quand une réponse hors ligne a déjà positionné la file à pending', async () => {
    const f = await fixture(); f.fail('network'); await expect(f.auth.retry()).rejects.toThrow();
    await f.sync.submitAnswer(series.id, series.questions[0].id, 'a', { nowISO: at });
    expect(f.sync.getState().sync.state).toBe('pending'); const reads = f.reads.length;
    f.fail(null); await f.auth.retry(); await f.flush();
    expect(f.reads).toHaveLength(reads + 1); expect(f.sync.getState().sync.state).toBe('synced'); expect(f.requests).toHaveLength(1);
  });

  it('conserve la file d’A sans envoi ni affichage chez B', async () => {
    const f = await fixture(); const question = series.questions[0];
    await f.sync.submitAnswer(series.id, question.id, question.answer, { nowISO: at }); const before = await f.saved();
    f.switchTo(userB); await vi.waitFor(() => expect(f.auth.getState()).toMatchObject({ status: 'authenticated', user: { id: userB.id } }));
    await f.sync.start(); await f.flush();
    expect(f.sync.getState().view.series).toEqual({}); expect(f.requests).toEqual([]);
    expect((await f.saved()).operations).toEqual(before.operations); expect((await f.saved(userB.id)).operations).toEqual([]);
  });

  it('masque offline A après rejet explicite et ne restaure pas son identité depuis le marqueur', async () => {
    const f = await fixture(); f.fail('network'); await expect(f.auth.retry()).rejects.toThrow();
    await f.sync.submitAnswer(series.id, series.questions[0].id, 'a', { nowISO: at }); await f.flush(); const before = await f.saved();
    f.fail('revoked'); await expect(f.auth.retry()).rejects.toMatchObject({ code: 'invalid_session' }); await f.sync.start(); await f.flush();
    expect(f.auth.getState()).toMatchObject({ status: 'anonymous', user: null }); expect(f.sync.getState().view.series).toEqual({});
    expect((await f.saved()).operations).toEqual(before.operations); expect(f.requests).toEqual([]);
    f.fail('network'); const restored = createAuthService(f.sdk.client, configuration); await restored.start();
    expect(restored.getState().user).toBeNull(); expect(restored.getState().status).not.toBe('offline');
  });

  it('ignore une réponse A tardive après passage à B et garde l’identité/UUID de l’envoi initial', async () => {
    const f = await fixture(); const release = f.holdResponse();
    try {
      await f.sync.submitAnswer(series.id, series.questions[0].id, 'a', { nowISO: at }); const running = f.flush();
      await vi.waitFor(() => expect(f.requests).toHaveLength(1)); const operation = f.requests[0].operation;
      f.switchTo(userB); await vi.waitFor(() => expect(f.auth.getState().user?.id).toBe(userB.id)); await f.sync.start();
      release(); await running; await f.flush();
      expect(f.sync.getState().view.series).toEqual({}); expect(f.requests[0].userId).toBe(authUser.id);
      expect((await f.saved()).operations[0]).toMatchObject({ id: operation.id, state: 'pending', rpcPayload: operation.rpcPayload });
      expect((await f.saved(userB.id)).operations).toEqual([]);
    } finally { release(); }
  });

  it('reprend A avant la fin de son ancien run sans acquitter deux fois ni écraser le nouvel état', async () => {
    const f = await fixture(); const release = f.holdResponse();
    try {
      await f.sync.submitAnswer(series.id, series.questions[0].id, 'a', { nowISO: at }); const oldRun = f.flush();
      await vi.waitFor(() => expect(f.requests).toHaveLength(1)); const operation = f.requests[0].operation;
      f.fail('network'); await expect(f.auth.retry()).rejects.toThrow();
      f.fail(null); await f.auth.retry(); await f.flush();
      expect(f.sync.getState().sync.state).toBe('synced'); const confirmed = await f.saved();
      expect(confirmed.operations[0]).toMatchObject({ id: operation.id, state: 'confirmed', rpcPayload: operation.rpcPayload });
      release(); await oldRun;
      expect(await f.saved()).toEqual(confirmed); expect(f.sync.getState().sync.state).toBe('synced');
      expect(f.requests).toHaveLength(1); expect(f.tasks.size).toBe(0);
    } finally { release(); }
  });
});
