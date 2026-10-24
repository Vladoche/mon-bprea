import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createDrillSyncService } from '../../assets/drill-sync-service.js';
import { createPersonalRepository, personalScope } from '../../assets/drill-personal-store.js';
import { MemoryStorage } from '../helpers/memory-storage.js';
import { makeSeries } from '../fixtures/drill.js';

const userA = '11111111-1111-4111-8111-111111111111'; const userB = '22222222-2222-4222-8222-222222222222';
const remoteId = '33333333-3333-4333-8333-333333333333';
const configuration = { client: {}, environment: 'development', url: 'https://fixture.invalid' };
const series = makeSeries(); const at = '2026-10-20T10:00:00.000Z';
let indexedDB; const services = [];
beforeEach(() => { indexedDB = new IDBFactory(); vi.stubGlobal('localStorage', new MemoryStorage()); });
afterEach(() => { services.splice(0).forEach(service => service.stop()); });

function authFixture(userId = userA) {
  let state = { status: userId ? 'authenticated' : 'anonymous', user: userId ? { id: userId } : null };
  const subscribers = new Set();
  return { getState: () => state, subscribe(fn) { subscribers.add(fn); fn(state); return () => subscribers.delete(fn); },
    emit(status, id = null) { state = { status, user: id ? { id } : null }; subscribers.forEach(fn => fn(state)); }, retry: vi.fn() };
}
function fixture({ auth = authFixture(), transport = null } = {}) {
  const histories = new Map(); const sent = [];
  const defaultTransport = (client, service, userId) => {
    if (!histories.has(userId)) histories.set(userId, { series: [], answers: [], training: [] });
    const history = histories.get(userId);
    return {
      readHistory: vi.fn(async () => structuredClone(history)),
      send: vi.fn(async operation => {
        sent.push(structuredClone(operation)); const payload = operation.rpcPayload;
        const collection = operation.type === 'series' ? history.series : operation.type === 'answer' ? history.answers : history.training;
        const existing = operation.type === 'series' ? collection.find(row => row.unit === payload.p_unit && row.week === payload.p_week) : collection.find(row => row.operation_id === operation.id);
        if (existing) return { status: 'replayed', row: structuredClone(existing) };
        const row = operation.type === 'series' ? { user_id: userId, id: remoteId, series_key: operation.seriesKey, unit: payload.p_unit, week: payload.p_week,
          started_at: payload.p_started_at, questions: payload.p_questions, schema_version: 1, created_at: at }
          : { user_id: userId, operation_id: operation.id, series_id: payload.p_series_id, question_id: payload.p_question_id, answer: payload.p_answer,
            answered_at: payload.p_answered_at, correct: payload.p_answer === series.questions.find(q => q.id === payload.p_question_id).answer, created_at: at };
        collection.push(row); return { status: 'inserted', row: structuredClone(row) };
      }),
    };
  };
  const connections = new Map(); const callbacks = [];
  const service = createDrillSyncService({ auth, configuration, broadcast: null,
    repositoryFactory: scope => createPersonalRepository(scope, { indexedDB }),
    transportFactory: (client, service, userId) => { const value = transport || defaultTransport(client, service, userId); connections.set(userId, value); return value; },
    now: () => Date.parse(at), schedule: fn => { callbacks.push(fn); return callbacks.length; }, cancel: vi.fn() });
  services.push(service);
  return { service, auth, sent, histories, connections, callbacks, repo: id => createPersonalRepository(personalScope({ ...configuration, userId: id }), { indexedDB }) };
}
async function startSeries(service) { await service.start(); return service.ensureSeries(series.unit, series.week, series.questions, series.startedAt); }

describe('orchestration personnelle — réseau simulé, aucune preuve RLS', () => {
  it('enregistre localement avant tout envoi et reprend la file sur un nouveau service', async () => {
    const f = fixture(); await startSeries(f.service);
    const q = series.questions[0]; await f.service.submitAnswer(series.id, q.id, q.answer, { nowISO: at });
    expect(f.sent).toEqual([]); expect((await f.repo(userA).read()).operations).toHaveLength(2);
    f.service.stop(); const next = fixture(); await next.service.start(); await next.service.synchronize();
    expect(next.sent.map(item => item.type)).toEqual(['series', 'answer']);
    expect(next.service.getState().sync.state).toBe('synced');
  });

  it('rejoue le même UUID/payload après une réponse perdue après insertion', async () => {
    const f = fixture(); await startSeries(f.service); await f.service.synchronize();
    const connection = f.connections.get(userA); const send = connection.send.getMockImplementation(); let lost = true;
    connection.send.mockImplementation(async operation => { const response = await send(operation); if (operation.type === 'answer' && lost) { lost = false; throw new TypeError('network fixture'); } return response; });
    const q = series.questions[0]; await f.service.submitAnswer(series.id, q.id, q.answer, { nowISO: at }); await f.service.synchronize();
    expect(f.service.getState().sync.state).toBe('offline'); const saved = (await f.repo(userA).read()).operations.at(-1);
    await f.repo(userA).change(doc => { doc.operations.at(-1).retryAt = 0; }); await f.service.synchronize();
    const sends = f.sent.filter(item => item.type === 'answer'); expect(sends).toHaveLength(2);
    expect(sends[0].rpcPayload).toEqual(sends[1].rpcPayload); expect(sends[1].id).toBe(saved.id);
    expect(f.histories.get(userA).answers).toHaveLength(1); expect(f.service.getState().sync.state).toBe('synced');
  });

  it('conserve le cache complet quand une lecture paginée échoue', async () => {
    const f = fixture(); await startSeries(f.service); await f.service.synchronize();
    const before = f.service.getState().view;
    f.connections.get(userA).readHistory.mockRejectedValue(new TypeError('page two unavailable'));
    await f.service.retry(); expect(f.service.getState().view).toEqual(before); expect(f.service.getState().sync.state).toBe('offline');
  });

  it('invalide A immédiatement à la déconnexion et ignore sa réponse réseau tardive', async () => {
    let release; const connection = { readHistory: vi.fn().mockResolvedValue({ series: [], answers: [], training: [] }), send: vi.fn(() => new Promise(resolve => { release = resolve; })) };
    const f = fixture({ transport: connection }); await startSeries(f.service); const running = f.service.synchronize();
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    f.auth.emit('loading'); expect(f.service.getState().view.series).toEqual({});
    f.auth.emit('anonymous'); await f.service.start(); release({ status: 'inserted', row: {} }); await running;
    expect(f.service.getState().mode).toBe('visitor'); expect(f.service.getState().view.series).toEqual({});
    expect((await f.repo(userA).read()).operations[0].state).toBe('pending');
  });

  it('ne mélange pas les files ou résultats lors du changement A → B', async () => {
    const f = fixture(); await startSeries(f.service);
    f.auth.emit('authenticated', userB); await f.service.start(); await f.service.synchronize();
    expect(f.service.getState().view.series).toEqual({}); expect(f.sent).toEqual([]);
    expect((await f.repo(userA).read()).operations).toHaveLength(1); expect((await f.repo(userB).read()).operations).toEqual([]);
    f.auth.emit('authenticated', userA); await f.service.start(); await f.service.synchronize(); expect(f.sent).toHaveLength(1);
  });

  it('continue avec le cache identifié hors réseau et bloque les identités incertaines', async () => {
    const f = fixture(); await startSeries(f.service); f.auth.emit('offline', userA); await f.service.start();
    expect(f.service.getState().mode).toBe('personal');
    const q = series.questions[0]; expect((await f.service.submitAnswer(series.id, q.id, q.answer, { nowISO: at })).error).toBeNull();
    f.auth.emit('error'); await f.service.start(); expect(f.service.getState().mode).toBe('blocked'); expect(f.service.getState().view.series).toEqual({});
  });

  it('garde une opération refusée sans boucle de retry et sépare la session expirée', async () => {
    for (const [code, expected] of [['23514', 'error'], ['PGRST303', 'session'], ['40001', 'offline']]) {
      const f = fixture(); await startSeries(f.service); const connection = f.connections.get(userA);
      connection.send.mockRejectedValue({ code }); await f.service.synchronize();
      expect(f.service.getState().sync.state).toBe(expected);
      const saved = (await f.repo(userA).read()).operations[0]; expect(saved.state).toBe(code === '23514' ? 'error' : 'pending');
      if (code === '23514') { await f.service.synchronize(); expect(connection.send).toHaveBeenCalledTimes(1); }
      f.service.stop();
      // Fresh identity scope for the next scenario.
      indexedDB = new IDBFactory();
    }
  });

  it('ne contacte pas les tables Drill pour un visiteur et préserve les anciennes séries', async () => {
    localStorage.setItem('bprea-demo-drill-v1', JSON.stringify({ version: 1, series: { [series.id]: series }, future: true }));
    const f = fixture({ auth: authFixture(null) }); await f.service.start(); await f.service.synchronize();
    expect(f.connections.size).toBe(0); expect(f.service.getState().view.series[series.id].questions).toEqual(series.questions);
    expect(JSON.parse(localStorage.getItem('bprea-demo-drill-v1')).future).toBe(true);
  });
});
