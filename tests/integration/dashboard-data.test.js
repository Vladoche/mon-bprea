import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { readDashboardData } from '../../assets/dashboard-data.js';
import { createDashboardModel } from '../../assets/dashboard-stats.js';
import { createDrillSyncService } from '../../assets/drill-sync-service.js';
import { createPersonalRepository, personalScope } from '../../assets/drill-personal-store.js';
import { readDrillDocument } from '../../assets/drill-store.js';
import { MemoryStorage } from '../helpers/memory-storage.js';
import { answerFor, makeSeries } from '../fixtures/drill.js';

const userA = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';
const remoteId = '33333333-3333-4333-8333-333333333333';
const configuration = { client: {}, environment: 'development', url: 'https://fixture.invalid' };
const at = '2026-10-20T10:00:00.000Z';
const now = new Date(at);
const services = [];
let indexedDB;

beforeEach(() => {
  indexedDB = new IDBFactory();
  vi.stubGlobal('localStorage', new MemoryStorage());
});
afterEach(() => { services.splice(0).forEach(service => service.stop()); });

const totals = source => createDashboardModel(readDashboardData(source), { now }).totals;
function viewOf(series) { return readDrillDocument({ version: 1, series: { [series.id]: series } }); }
function personal(view, state = 'synced', extra = {}) {
  return { mode: 'personal', scope: personalScope({ ...configuration, userId: userA }), view,
    sync: { state, error: null, pending: 0, conflicts: [], ...extra } };
}
function visitorSeries() {
  const series = makeSeries({ unit: 'uc4' });
  series.answers[series.questions[0].id] = answerFor(series.questions[0], { correct: false });
  localStorage.setItem('bprea-demo-drill-v1', JSON.stringify({ version: 1, series: { [series.id]: series } }));
  return series;
}

describe('sélection des données du Dashboard en lecture seule', () => {
  it('garde la lecture visiteur, même si une ancienne vue personnelle figure dans le snapshot', () => {
    const visitor = visitorSeries();
    const original = localStorage.getItem('bprea-demo-drill-v1');
    const stale = makeSeries();
    stale.answers[stale.questions[0].id] = answerFor(stale.questions[0]);
    const snapshot = { ...personal(viewOf(stale)), mode: 'visitor' };
    for (const source of [undefined, snapshot]) {
      const data = readDashboardData(source);
      expect(data.source).toMatchObject({ mode: 'visitor', scope: null, available: true, loading: false });
      expect(Object.keys(data.series)).toEqual([visitor.id]);
      expect(totals(source)).toMatchObject({ completed: 1, correct: 0, successRate: 0 });
    }
    expect(localStorage.getItem('bprea-demo-drill-v1')).toBe(original);
  });

  it('utilise exclusivement la vue personnelle et compte les premières réponses sans les entraînements', () => {
    visitorSeries();
    const series = makeSeries();
    const [correct, incorrect, draft] = series.questions;
    series.answers[correct.id] = answerFor(correct);
    series.answers[incorrect.id] = answerFor(incorrect, { correct: false });
    series.answers[incorrect.id].attempts.push(
      ...Array.from({ length: 5 }, () => ({ ...answerFor(incorrect).attempts[0], training: true })),
    );
    series.drafts[draft.id] = draft.answer;
    const snapshot = personal(viewOf(series), 'pending', { pending: 4,
      conflicts: [{ id: 'old', resolved: true }, { id: 'answer', resolved: false }] });
    const original = structuredClone(snapshot);
    const data = readDashboardData(snapshot);
    expect(data.source).toMatchObject({ mode: 'personal', scope: snapshot.scope, state: 'pending',
      pending: 4, conflicts: 1, available: true, loading: false });
    expect(Object.keys(data.series)).toEqual([series.id]);
    expect(totals(snapshot)).toMatchObject({ completed: 2, correct: 1, incorrect: 1, successRate: 50 });
    expect(series.answers[incorrect.id].attempts).toHaveLength(6);
    expect(snapshot).toEqual(original);
  });

  it('masque une ancienne vue personnelle quand l’identité est bloquée, absente ou rejetée', () => {
    visitorSeries();
    const series = makeSeries();
    series.answers[series.questions[0].id] = answerFor(series.questions[0]);
    const stale = personal(viewOf(series));
    for (const snapshot of [null, { ...stale, mode: 'blocked' }, { ...stale, scope: null },
      { ...stale, sync: { ...stale.sync, state: 'session' } }]) {
      const data = readDashboardData(snapshot);
      expect(data.source).toMatchObject({ mode: 'blocked', scope: null, available: false, blocked: true });
      expect(data.series).toEqual({});
      expect(data.warnings).toEqual([]);
      expect(data.error).toBeTruthy();
    }
  });

  it('distingue le chargement et le stockage illisible d’un historique personnel réellement vide', () => {
    const view = { series: {}, error: null, warnings: [] };
    const loading = readDashboardData({ mode: 'blocked', scope: null, view, sync: { state: 'loading' } });
    expect(loading.source).toMatchObject({ available: false, loading: true });
    const cacheLoading = readDashboardData(personal({ ...view, error: 'Chargement de ton cache personnel…' }, 'offline'));
    expect(cacheLoading.source).toMatchObject({ available: false, loading: true });
    const broken = readDashboardData(personal({ ...view, error: 'Le cache personnel est illisible.' }, 'storage-error'));
    expect(broken.source).toMatchObject({ available: false, loading: false });
    expect(broken.error).toContain('illisible');
    const empty = readDashboardData(personal(view));
    expect(empty.source).toMatchObject({ available: true, loading: false });
    expect(empty.error).toBeNull();
    expect(totals(personal(view))).toMatchObject({ completed: 0, successRate: null });
  });

  it('conserve un cache fiable pendant le réseau, l’attente et les conflits sans prétendre une confirmation distante', () => {
    const series = makeSeries();
    series.answers[series.questions[0].id] = answerFor(series.questions[0]);
    for (const state of ['local', 'pending', 'syncing', 'synced', 'offline', 'error', 'conflict']) {
      const snapshot = personal(viewOf(series), state, { error: state === 'offline' ? 'Réseau indisponible.' : null });
      const data = readDashboardData(snapshot);
      expect(data.source).toMatchObject({ mode: 'personal', available: true, loading: false, state });
      expect(totals(snapshot)).toMatchObject({ completed: 1, correct: 1, successRate: 100 });
      expect(data.error).toBeNull();
      if (state === 'offline') expect(data.source.message).toContain('Réseau');
    }
  });
});

// The real service/repository/model are exercised together. Only Auth events
// and the remote HTTP boundary are synthetic; these scenarios do not prove RLS.
function remoteHistory(userId, series = makeSeries(), responses = []) {
  return {
    series: [{ user_id: userId, id: remoteId, series_key: series.id, unit: series.unit,
      week: series.week, started_at: series.startedAt, questions: series.questions, schema_version: 1, created_at: at }],
    answers: responses.map((correct, index) => ({ user_id: userId,
      operation_id: `44444444-4444-4444-8444-${String(index + 1).padStart(12, '0')}`,
      series_id: remoteId, question_id: series.questions[index].id,
      answer: answerFor(series.questions[index], { correct }).answer, correct, answered_at: at, created_at: at })),
    training: [],
  };
}

function synchronizedFixture({ userId = userA, histories = new Map() } = {}) {
  let authState = { status: userId ? 'authenticated' : 'anonymous', user: userId ? { id: userId } : null };
  const listeners = new Set();
  const auth = {
    getState: () => authState,
    subscribe(listener) { listeners.add(listener); listener(authState); return () => listeners.delete(listener); },
    emit(status, id = null) {
      authState = { status, user: id ? { id } : null };
      listeners.forEach(listener => listener(authState));
    },
    retry: vi.fn(),
  };
  const connections = new Map(), tasks = new Map();
  let taskId = 0, operationId = 0;
  const service = createDrillSyncService({ auth, configuration, broadcast: null,
    repositoryFactory: scope => createPersonalRepository(scope, { indexedDB }),
    now: () => Date.parse(at),
    randomUUID: () => `77777777-7777-4777-8777-${String(++operationId).padStart(12, '0')}`,
    schedule(fn, delay) { const id = ++taskId; tasks.set(id, { fn, delay }); return id; },
    cancel(id) { tasks.delete(id); },
    transportFactory(client, authService, owner) {
      const history = histories.get(owner) || { series: [], answers: [], training: [] };
      histories.set(owner, history);
      const connection = {
        readHistory: vi.fn(async () => structuredClone(history)),
        send: vi.fn(async operation => {
          const payload = operation.rpcPayload;
          const collection = operation.type === 'answer' ? history.answers : history.training;
          const existing = collection.find(row => row.operation_id === operation.id);
          if (existing) return { status: 'replayed', row: structuredClone(existing) };
          const question = history.series.find(row => row.id === payload.p_series_id).questions.find(item => item.id === payload.p_question_id);
          const row = { user_id: owner, operation_id: operation.id, series_id: payload.p_series_id,
            question_id: payload.p_question_id, answer: payload.p_answer, correct: payload.p_answer === question.answer,
            answered_at: payload.p_answered_at, created_at: at };
          collection.push(row);
          return { status: 'inserted', row: structuredClone(row) };
        }),
      };
      connections.set(owner, connection);
      return connection;
    },
  });
  services.push(service);
  return { service, auth, connections, histories,
    async scheduled() {
      for (const [id, task] of [...tasks]) {
        if (task.delay !== 0) continue;
        tasks.delete(id); task.fn(); await service.synchronize();
      }
    },
    repo(id) { return createPersonalRepository(personalScope({ ...configuration, userId: id }), { indexedDB }); },
    data: () => readDashboardData(service.getState()),
    totals: () => totals(service.getState()),
  };
}

describe('Dashboard projeté depuis le vrai service Drill — réseau simulé, aucune preuve RLS', () => {
  it('sépare visiteur → A → B → A → déconnexion et conserve intégralement l’ancienne clé visiteur', async () => {
    visitorSeries();
    const original = localStorage.getItem('bprea-demo-drill-v1');
    const histories = new Map([[userA, remoteHistory(userA, makeSeries(), [true, true])],
      [userB, remoteHistory(userB, makeSeries(), [false])]]);
    const f = synchronizedFixture({ userId: null, histories });
    await f.service.start();
    expect(f.totals()).toMatchObject({ completed: 1, correct: 0, successRate: 0 });
    for (const [id, completed, correct] of [[userA, 2, 2], [userB, 1, 0], [userA, 2, 2]]) {
      f.auth.emit('authenticated', id);
      expect(f.data().series).toEqual({}); // No previous identity during the cache read.
      await f.service.start(); await f.service.synchronize();
      expect(f.data().source.scope).toBe(personalScope({ ...configuration, userId: id }));
      expect(f.totals()).toMatchObject({ completed, correct, successRate: correct ? 100 : 0 });
      expect((await f.repo(id).read()).operations).toEqual([]); // No visitor import.
    }
    const saved = await f.repo(userA).read();
    f.auth.emit('anonymous'); await f.service.start();
    expect(f.data().source.mode).toBe('visitor');
    expect(f.totals()).toMatchObject({ completed: 1, correct: 0, successRate: 0 });
    expect(await f.repo(userA).read()).toEqual(saved);
    expect(localStorage.getItem('bprea-demo-drill-v1')).toBe(original);
  });

  it('masque les totaux personnels après expiration API ou rejet de l’identité sans supprimer le cache', async () => {
    const f = synchronizedFixture({ histories: new Map([[userA, remoteHistory(userA, makeSeries(), [true, true])]]) });
    await f.service.start(); await f.service.synchronize();
    const saved = await f.repo(userA).read();
    expect(f.totals().completed).toBe(2);
    f.connections.get(userA).readHistory.mockRejectedValue({ code: 'PGRST303', status: 401 });
    await f.service.retry();
    expect(f.data()).toMatchObject({ series: {}, source: { mode: 'blocked', available: false } });
    expect(f.totals()).toMatchObject({ completed: 0, successRate: null });
    f.auth.emit('error'); await f.service.start();
    expect(f.data()).toMatchObject({ series: {}, source: { mode: 'blocked', available: false } });
    expect(await f.repo(userA).read()).toEqual(saved);
  });

  it('ignore une lecture réseau A tardive après passage à B, puis retrouve A dans son propre cache', async () => {
    const historyA = remoteHistory(userA, makeSeries(), [true, true]);
    const f = synchronizedFixture({ histories: new Map([[userA, historyA], [userB, remoteHistory(userB, makeSeries(), [false])]]) });
    await f.service.start(); await f.service.synchronize();
    let release;
    f.connections.get(userA).readHistory.mockImplementationOnce(() => new Promise(resolve => { release = () => resolve(structuredClone(historyA)); }));
    const late = f.service.retry();
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    try {
      f.auth.emit('authenticated', userB); await f.service.start(); await f.service.synchronize();
      expect(f.totals()).toMatchObject({ completed: 1, correct: 0, successRate: 0 });
      release(); await late;
      expect(f.totals()).toMatchObject({ completed: 1, correct: 0, successRate: 0 });
      expect(f.data().source.scope).toBe(personalScope({ ...configuration, userId: userB }));
      f.auth.emit('offline', userA); await f.service.start();
      expect(f.totals()).toMatchObject({ completed: 2, correct: 2, successRate: 100 });
    } finally { release(); }
  });

  it('compte une réponse locale et cinq entraînements une seule fois, puis reprend sans doublon après échec réseau', async () => {
    const series = makeSeries(), history = remoteHistory(userA, series);
    const f = synchronizedFixture({ histories: new Map([[userA, history]]) });
    await f.service.start(); await f.service.synchronize();
    f.auth.emit('offline', userA); await f.service.start();
    const question = series.questions[0];
    expect((await f.service.submitAnswer(series.id, question.id, question.answer, { nowISO: at })).error).toBeNull();
    for (let index = 0; index < 5; index++)
      expect((await f.service.submitAnswer(series.id, question.id, question.answer, { nowISO: at, training: true })).error).toBeNull();
    expect(f.data().source).toMatchObject({ pending: 6, available: true });
    expect(f.totals()).toMatchObject({ completed: 1, correct: 1, successRate: 100 });
    const connection = f.connections.get(userA);
    connection.readHistory.mockRejectedValueOnce(new TypeError('isolated HTTP outage'));
    await f.service.retry();
    expect(f.data().source).toMatchObject({ state: 'offline', pending: 6, available: true });
    expect(f.totals()).toMatchObject({ completed: 1, correct: 1, successRate: 100 });
    // The Auth transition itself must queue recovery; no window.online event.
    f.auth.emit('authenticated', userA); await f.service.start(); await f.scheduled();
    expect(f.data().source).toMatchObject({ state: 'synced', pending: 0, available: true });
    expect(f.totals()).toMatchObject({ completed: 1, correct: 1, successRate: 100 });
    expect(history.answers).toHaveLength(1); expect(history.training).toHaveLength(5);
    await f.service.retry();
    expect(history.answers).toHaveLength(1); expect(history.training).toHaveLength(5);
    expect(f.totals().completed).toBe(1);
  });

  it('ne cumule pas le premier choix local et la réponse distante concurrente conservée en conflit', async () => {
    const series = makeSeries(), history = remoteHistory(userA, series);
    const f = synchronizedFixture({ histories: new Map([[userA, history]]) });
    await f.service.start(); await f.service.synchronize();
    const question = series.questions[0];
    await f.service.submitAnswer(series.id, question.id, question.answer, { nowISO: at });
    expect(f.totals()).toMatchObject({ completed: 1, correct: 1 });
    history.answers.push(...remoteHistory(userA, series, [false]).answers);
    await f.service.retry();
    expect(f.data().source).toMatchObject({ state: 'conflict', conflicts: 1, available: true });
    expect(f.totals()).toMatchObject({ completed: 1, correct: 0, incorrect: 1, successRate: 0 });
    const saved = await f.repo(userA).read();
    expect(saved.operations[0].state).toBe('conflict');
    expect(saved.conflicts[0].local.correct).toBe(true);
    expect(saved.conflicts[0].remote.correct).toBe(false);
    expect(f.connections.get(userA).send).not.toHaveBeenCalled();
    await f.service.retry();
    expect(f.totals().completed).toBe(1);
    expect(f.data().source.conflicts).toBe(1);
  });
});
