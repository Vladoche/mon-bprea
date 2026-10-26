import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createBotanicalService, VISITOR_PROGRESS_KEY } from '../../assets/botanical-sync-service.js';
import { createBotanicalRepository, personalScope } from '../../assets/botanical-personal-store.js';
import { calculateStats } from '../../assets/botanical-engine.js';
import { botanicalSession, botanicalAnswer, PERSONAL_DATA_TIME as at } from '../fixtures/personal-data.js';
import { MemoryStorage } from '../helpers/memory-storage.js';

const userA = '11111111-1111-4111-8111-111111111111'; const userB = '22222222-2222-4222-8222-222222222222';
const configuration = { client: {}, environment: 'development', url: 'https://fixture.invalid' };
const finishedAt = '2026-10-21T12:01:00.000Z';
let indexedDB; let storage; const services = [];
beforeEach(() => { indexedDB = new IDBFactory(); storage = new MemoryStorage(); });
afterEach(() => services.splice(0).forEach(service => service.stop()));
function authFixture(userId = userA, status = userId ? 'authenticated' : 'anonymous') {
  let state = { status, user: userId ? { id: userId } : null }; const listeners = new Set();
  return { getState: () => state, subscribe(fn) { listeners.add(fn); fn(state); return () => listeners.delete(fn); },
    emit(status, id = null) { state = { status, user: id ? { id } : null }; listeners.forEach(fn => fn(state)); }, retry: vi.fn() };
}
function backend() {
  const histories = new Map(); const sent = []; const connections = new Map();
  const factory = (client, auth, userId) => {
    if (!histories.has(userId)) histories.set(userId, { sessions: [], answers: [] });
    const history = histories.get(userId);
    const connection = {
      readHistory: vi.fn(async () => structuredClone(history)),
      send: vi.fn(async operation => {
        sent.push(structuredClone({ userId, ...operation })); const p = operation.rpcPayload;
        if (operation.type === 'answer') {
          const a = p.p_answer;
          const previous = history.answers.find(row => row.answer_id === a.id);
          if (previous) return { status: 'replayed', row: structuredClone(previous) };
          if (!history.sessions.some(row => row.session_id === a.sessionId)) throw { code: '23503' };
          const row = { user_id: userId, answer_id: a.id, session_id: a.sessionId, question_id: a.questionId, category_id: a.categoryId,
            species_id: a.speciesId, photo_id: a.photoId, mode: a.mode, is_revision: a.revision, status: a.status,
            selected_species_id: a.selectedSpeciesId, correct: a.correct, elapsed_ms: a.elapsedMs, answered_at: a.answeredAt, schema_version: 1, created_at: at };
          history.answers.push(row); return { status: 'inserted', row: structuredClone(row) };
        }
        const s = p.p_session; const previous = history.sessions.find(row => row.session_id === s.id);
        if (previous?.operation_id === p.p_operation_id) return { status: 'replayed', row: structuredClone(previous) };
        if ((previous?.revision || 0) !== p.p_expected_revision) return { status: 'conflict', row: structuredClone(previous || null) };
        const row = { user_id: userId, session_id: s.id, category_id: s.categoryId, mode: s.mode, duration_seconds: s.durationSeconds,
          is_revision: s.revision, started_at: s.startedAt, total_questions: s.totalQuestions, completed_at: s.completedAt,
          operation_id: p.p_operation_id, base_revision: p.p_expected_revision, revision: p.p_expected_revision + 1, schema_version: 1,
          created_at: previous?.created_at || at, updated_at: at };
        history.sessions = [...history.sessions.filter(item => item.session_id !== row.session_id), row];
        return { status: previous ? 'updated' : 'inserted', row: structuredClone(row) };
      }),
    }; connections.set(userId, connection); return connection;
  };
  return { histories, sent, connections, factory };
}
function fixture({ auth = authFixture(), remote = backend(), idb = indexedDB, repositoryFactory } = {}) {
  const callbacks = [];
  const repo = id => createBotanicalRepository(personalScope({ ...configuration, userId: id }), { indexedDB: idb });
  const service = createBotanicalService({ auth, configuration, storage, broadcast: null,
    repositoryFactory: repositoryFactory || (scope => createBotanicalRepository(scope, { indexedDB: idb })),
    transportFactory: remote.factory, now: () => Date.parse(at), schedule: (fn, delay) => { callbacks.push({ fn, delay }); return callbacks.length; }, cancel: vi.fn() });
  services.push(service); return { service, auth, remote, repo, callbacks };
}
async function initialized(options) { const f = fixture(options); await f.service.start(); await f.service.synchronize(); return f; }
async function play(service, session = botanicalSession()) {
  expect((await service.createSession(session)).error).toBeNull();
  expect((await service.recordAnswer(botanicalAnswer(session))).error).toBeNull();
  expect((await service.completeSession(session.id, finishedAt)).error).toBeNull();
}

describe('service botanique — réseau simulé, aucune preuve Auth/RLS distante', () => {
  it('conserve le store visiteur et ses champs inconnus sans import implicite dans le compte', async () => {
    const session = botanicalSession('visitor');
    const raw = JSON.stringify({ schemaVersion: 1, sessions: [session], answers: [botanicalAnswer(session)], unknown: { keep: true } });
    storage.setItem(VISITOR_PROGRESS_KEY, raw);
    const visitor = await initialized({ auth: authFixture(null) });
    expect(visitor.remote.connections.size).toBe(0); expect(visitor.service.getState().view.history.answers).toHaveLength(1);
    expect((await visitor.service.recordAnswer(botanicalAnswer(session, 2))).error).toBeNull();
    expect(JSON.parse(storage.getItem(VISITOR_PROGRESS_KEY)).unknown).toEqual({ keep: true });
    const personal = await initialized(); expect(personal.service.getState().view.history.answers).toEqual([]);
    expect(personal.remote.sent).toEqual([]);
  });
  it('expose les sauvegardes visiteur refusées sans fausse confirmation ni destruction', async () => {
    storage.setItem(VISITOR_PROGRESS_KEY, '{corrupt'); const f = await initialized({ auth: authFixture(null) });
    const result = await f.service.createSession(botanicalSession());
    expect(result.error).toBeTruthy(); expect(result.savedLocally).not.toBe(true); expect(storage.getItem(VISITOR_PROGRESS_KEY)).toBe('{corrupt');
  });
  it('bloque le cache hors ligne inconnu et présente un backend absent sans faux historique vide fiable', async () => {
    const offline = fixture({ auth: authFixture(userA, 'offline') }); await offline.service.start();
    expect(offline.service.getState().view.error).toMatch(/aucun cache personnel fiable/);
    expect((await offline.service.createSession(botanicalSession())).error).toBeTruthy();
    const absent = fixture({ idb: new IDBFactory() }); await absent.service.start();
    absent.remote.connections.get(userA).readHistory.mockRejectedValue({ code: 'PGRST205' }); await absent.service.synchronize();
    expect(absent.service.getState().sync.state).toBe('error'); expect(absent.service.getState().view.error).toMatch(/stockage du compte pour la botanique/);
  });
  it('persiste une partie hors ligne entière puis envoie création → réponses → complétion CAS après rechargement', async () => {
    const remote = backend(); const f = await initialized({ remote }); f.auth.emit('offline', userA); await f.service.start();
    await play(f.service); const before = await f.repo(userA).read();
    expect(before.operations.map(op => op.type)).toEqual(['session', 'answer', 'completion']);
    expect(remote.sent).toEqual([]); expect(f.service.getState().sync.state).toBe('offline');
    f.service.stop(); const reload = fixture({ remote }); await reload.service.start();
    expect(reload.service.getState().view.history.answers).toHaveLength(1); await reload.service.synchronize();
    expect(remote.sent.map(op => op.type)).toEqual(['session', 'answer', 'completion']);
    expect(remote.sent[2].rpcPayload.p_expected_revision).toBe(1);
    expect(remote.histories.get(userA).sessions[0].completed_at).toBe(finishedAt);
    expect(reload.service.getState().sync.state).toBe('synced');
    expect((await reload.repo(userA).read()).operations.map(op => op.id)).toEqual(before.operations.map(op => op.id));
  });
  it('retarde la complétion tant qu’une réponse n’est pas acquittée et rejoue la même identité après perte HTTP', async () => {
    const f = await initialized(); const connection = f.remote.connections.get(userA); const send = connection.send.getMockImplementation(); let lost = true;
    connection.send.mockImplementation(async operation => { const result = await send(operation); if (operation.type === 'answer' && lost) { lost = false; throw new TypeError('lost after commit'); } return result; });
    await play(f.service); await f.service.synchronize();
    expect(f.remote.sent.map(op => op.type)).toEqual(['session', 'answer']);
    expect(f.remote.histories.get(userA).sessions[0].completed_at).toBeNull();
    await f.repo(userA).change(saved => { saved.operations.filter(op => op.state === 'pending').forEach(op => { op.retryAt = 0; }); });
    await f.service.synchronize(); const sends = f.remote.sent.filter(op => op.type === 'answer');
    expect(sends).toHaveLength(2); expect(sends[1].id).toBe(sends[0].id); expect(sends[1].rpcPayload).toEqual(sends[0].rpcPayload);
    expect(f.remote.histories.get(userA).answers).toHaveLength(1); expect(f.remote.sent.at(-1).type).toBe('completion');
  });
  it('réconcilie deux appareils sans doublon et conserve l’erreur après une réussite de révision', async () => {
    const remote = backend(); const first = await initialized({ remote }); const s = botanicalSession();
    await first.service.createSession(s);
    await first.service.recordAnswer(botanicalAnswer(s, 1, { status: 'incorrect', selectedSpeciesId: 'framboisier', correct: false }));
    await first.service.recordAnswer(botanicalAnswer(s, 2)); await first.service.completeSession(s.id, finishedAt); await first.service.synchronize();
    const second = await initialized({ remote, idb: new IDBFactory() });
    expect(second.service.getState().view.history.answers).toHaveLength(2);
    const revision = botanicalSession('revision', { revision: true }); await play(second.service, revision); await second.service.synchronize();
    await first.service.retry(); const answers = first.service.getState().view.history.answers;
    expect(answers).toHaveLength(3); expect(answers.filter(answer => answer.status === 'incorrect')).toHaveLength(1);
    expect(calculateStats(answers)).toMatchObject({ correct: 2, incorrect: 1, attempted: 3 });
  });
  it('isole visiteur/A/B et conserve les opérations à la déconnexion', async () => {
    const raw = JSON.stringify({ schemaVersion: 1, sessions: [], answers: [] }); storage.setItem(VISITOR_PROGRESS_KEY, raw);
    const f = await initialized(); await play(f.service); await f.service.synchronize();
    f.auth.emit('loading'); expect(f.service.getState().view.history.answers).toEqual([]);
    f.auth.emit('anonymous'); await f.service.start(); expect(f.service.getState().mode).toBe('visitor');
    f.auth.emit('authenticated', userB); await f.service.start(); await f.service.synchronize();
    expect(f.service.getState().view.history.answers).toEqual([]); await play(f.service, botanicalSession('B')); await f.service.synchronize();
    f.auth.emit('authenticated', userA); await f.service.start(); await f.service.synchronize();
    expect(f.service.getState().view.history.sessions.map(session => session.id)).toEqual(['botanical-backend-test']);
    expect(storage.getItem(VISITOR_PROGRESS_KEY)).toBe(raw);
  });
  it('ignore une réponse tardive A et conserve son opération uniquement dans A', async () => {
    const f = await initialized(); const connection = f.remote.connections.get(userA); let release;
    connection.send.mockImplementation(() => new Promise(resolve => { release = resolve; }));
    await f.service.createSession(botanicalSession()); const running = f.service.synchronize();
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    f.auth.emit('authenticated', userB); await f.service.start(); await f.service.synchronize();
    release({ status: 'inserted', row: {} }); await running;
    expect(f.service.getState().view.history.sessions).toEqual([]);
    expect((await f.repo(userA).read()).operations[0].state).toBe('pending'); expect((await f.repo(userB).read()).operations).toEqual([]);
  });
  it('refuse une action A restée en attente du chargement quand B se connecte', async () => {
    const scopeB = personalScope({ ...configuration, userId: userB }); let release;
    const deferred = new Promise(resolve => { release = resolve; });
    const f = fixture({ repositoryFactory: scope => {
      const repo = createBotanicalRepository(scope, { indexedDB });
      return scope === scopeB ? repo : { ...repo, read: async () => { await deferred; return repo.read(); } };
    } });
    const creation = f.service.createSession(botanicalSession()); const answer = f.service.recordAnswer(botanicalAnswer());
    const retry = f.service.retry(); f.auth.emit('authenticated', userB); await f.service.start(); release();
    expect((await creation).error).toMatch(/compte a changé/); expect((await answer).error).toMatch(/compte a changé/); await retry;
    expect((await f.repo(userA).read()).operations).toEqual([]); expect((await f.repo(userB).read()).operations).toEqual([]);
    expect(f.remote.sent).toEqual([]);
  });
  it('reprend offline → authenticated sans événement online et masque une session explicitement rejetée', async () => {
    const f = await initialized(); f.auth.emit('offline', userA); await f.service.start(); await play(f.service);
    f.auth.emit('authenticated', userA); await f.service.start(); await f.service.synchronize();
    expect(f.service.getState().sync.state).toBe('synced');
    f.auth.emit('error'); await f.service.start(); expect(f.service.getState().mode).toBe('blocked'); expect(f.service.getState().view.history.answers).toEqual([]);
  });
  it('masque aussi le cache après refus HTTP Auth et ne renvoie pas en boucle une validation définitive', async () => {
    for (const [code, state] of [['23514', 'error'], ['PGRST303', 'session']]) {
      const f = await initialized({ idb: new IDBFactory() }); const connection = f.remote.connections.get(userA);
      connection.send.mockRejectedValue({ code }); await f.service.createSession(botanicalSession()); await f.service.synchronize();
      expect(f.service.getState().sync.state).toBe(state);
      if (state === 'session') expect(f.service.getState().view.history.sessions).toEqual([]);
      await f.service.synchronize(); expect(connection.send).toHaveBeenCalledTimes(1);
    }
  });
  it('conserve le cache fiable si une page complète ultérieure échoue', async () => {
    const f = await initialized(); await play(f.service); await f.service.synchronize();
    f.remote.connections.get(userA).readHistory.mockRejectedValue({ code: 'network' }); await f.service.retry();
    expect(f.service.getState().view.history.answers).toHaveLength(1); expect(f.service.getState().sync.state).toBe('offline');
  });
  it('complète la session après résolution explicite d’une réponse divergente sans rester en attente ni recompter', async () => {
    const f = await initialized(); const s = botanicalSession('resolved-answer');
    await f.service.createSession(s); await f.service.synchronize();
    const connection = f.remote.connections.get(userA); const send = connection.send.getMockImplementation();
    connection.send.mockImplementation(async operation => {
      const result = await send(operation);
      if (operation.type !== 'answer') return result;
      const row = { ...result.row, status: 'incorrect', correct: false, selected_species_id: 'framboisier' };
      f.remote.histories.get(userA).answers = [row]; return { status: 'conflict', row };
    });
    await f.service.recordAnswer(botanicalAnswer(s)); await f.service.synchronize();
    expect(f.service.getState().sync.state).toBe('conflict');
    const conflict = f.service.getState().sync.conflicts.find(item => !item.resolved);
    expect((await f.service.resolveConflict(conflict.id, 'remote')).error).toBeNull();
    expect((await f.service.completeSession(s.id, finishedAt)).error).toBeNull(); await f.service.synchronize();
    const state = f.service.getState(); expect(state.sync).toMatchObject({ state: 'synced', pending: 0 });
    expect(state.view.history.answers).toHaveLength(1); expect(state.view.history.answers[0].status).toBe('incorrect');
    expect(f.remote.histories.get(userA).sessions[0].completed_at).toBe(finishedAt);
    expect(f.remote.sent.filter(operation => operation.type === 'answer')).toHaveLength(1);
    expect(f.remote.sent.filter(operation => operation.type === 'completion')).toHaveLength(1);
  });
  it('relit des scans complets pour récupérer une insertion devenue visible derrière un ancien curseur', async () => {
    const remote = backend(); const source = await initialized({ remote }); await play(source.service); await source.service.synchronize();
    const f = fixture({ remote, idb: new IDBFactory() }); await f.service.start(); const connection = remote.connections.get(userA);
    const full = structuredClone(remote.histories.get(userA)); connection.readHistory.mockResolvedValueOnce({ sessions: full.sessions, answers: [] }).mockResolvedValue(full);
    await f.service.synchronize(); expect(connection.readHistory).toHaveBeenCalledTimes(3);
    expect(f.service.getState().view.history.answers).toHaveLength(1);
  });
  it('ne confirme pas un échec de transaction IndexedDB et ne crée aucune opération réseau', async () => {
    let rejectWrites = false;
    const f = await initialized({ repositoryFactory: scope => {
      const repo = createBotanicalRepository(scope, { indexedDB });
      return { ...repo, change: (...args) => rejectWrites ? Promise.reject(Object.assign(new Error('Stockage plein'), { code: 'local_storage' })) : repo.change(...args) };
    } }); rejectWrites = true;
    const result = await f.service.createSession(botanicalSession()); expect(result.error).toBe('Stockage plein');
    expect(result.savedLocally).not.toBe(true); expect(f.service.getState().sync.state).toBe('storage-error');
    expect((await f.repo(userA).read()).operations).toEqual([]); expect(f.remote.sent).toEqual([]);
    rejectWrites = false;
    expect((await f.service.createSession(botanicalSession())).savedLocally).toBe(true);
    expect((await f.repo(userA).read()).operations).toHaveLength(1);
  });
  it('conserve les quatre statuts et exclut image indisponible et questions non réalisées du taux', async () => {
    const f = await initialized(); const s = botanicalSession('statuses', { totalQuestions: 5 });
    await f.service.createSession(s);
    await f.service.recordAnswer(botanicalAnswer(s, 1));
    await f.service.recordAnswer(botanicalAnswer(s, 2, { status: 'incorrect', correct: false, selectedSpeciesId: 'framboisier' }));
    await f.service.recordAnswer(botanicalAnswer(s, 3, { status: 'timeout', correct: false, selectedSpeciesId: null }));
    await f.service.recordAnswer(botanicalAnswer(s, 4, { status: 'skipped_image', correct: false, selectedSpeciesId: null }));
    await f.service.completeSession(s.id, finishedAt); await f.service.synchronize();
    const second = await initialized({ remote: f.remote, idb: new IDBFactory() }); const answers = second.service.getState().view.history.answers;
    expect(answers).toHaveLength(4); expect(calculateStats(answers)).toMatchObject({ correct: 1, incorrect: 1, attempted: 3 });
    expect(second.service.getState().view.history.sessions[0].totalQuestions).toBe(5);
    expect(calculateStats(answers)).toEqual(calculateStats(f.service.getState().view.history.answers));
  });
  it('importe seulement sur confirmation, conserve la source et reprend le même manifeste après rechargement', async () => {
    const s = botanicalSession('legacy', { completedAt: finishedAt });
    const orphan = botanicalAnswer(botanicalSession('orphan'));
    const raw = JSON.stringify({ schemaVersion: 1, sessions: [s], answers: [botanicalAnswer(s), orphan] }); storage.setItem(VISITOR_PROGRESS_KEY, raw);
    const f = await initialized(); const preview = await f.service.previewImport();
    expect(preview.available).toBe(true); expect((await f.repo(userA).read()).operations).toEqual([]);
    expect((await f.service.confirmImport(preview)).error).toBeNull(); const before = await f.repo(userA).read();
    expect(before.imports).toHaveLength(1); expect(before.imports[0].raw).toBe(raw); await f.service.synchronize();
    f.service.stop(); const reload = fixture({ remote: f.remote }); await reload.service.start(); await reload.service.synchronize();
    expect((await reload.service.confirmImport(await reload.service.previewImport())).error).toBeNull();
    expect((await reload.repo(userA).read()).operations.map(op => op.id)).toEqual(before.operations.map(op => op.id));
    expect(f.remote.histories.get(userA).answers).toHaveLength(1); expect(storage.getItem(VISITOR_PROGRESS_KEY)).toBe(raw);
  });
  it('refuse un premier import si le scan frais échoue et si la source a changé après prévisualisation', async () => {
    const s = botanicalSession('legacy'); const raw = JSON.stringify({ schemaVersion: 1, sessions: [s], answers: [botanicalAnswer(s)] });
    storage.setItem(VISITOR_PROGRESS_KEY, raw); const f = await initialized(); const preview = await f.service.previewImport();
    const connection = f.remote.connections.get(userA); connection.readHistory.mockRejectedValue({ code: 'network' });
    expect((await f.service.confirmImport(preview)).error).toMatch(/distant/); expect((await f.repo(userA).read()).operations).toEqual([]);
    connection.readHistory.mockResolvedValue({ sessions: [], answers: [] });
    storage.setItem(VISITOR_PROGRESS_KEY, raw + ' ');
    expect((await f.service.confirmImport(preview)).error).toMatch(/changé/); expect((await f.repo(userA).read()).operations).toEqual([]);
    expect(storage.getItem(VISITOR_PROGRESS_KEY)).toBe(raw + ' ');
  });
  it('expose seulement un résumé de refus d’import et cache les archives lors du passage à B', async () => {
    const f = await initialized(); const s = botanicalSession('collision'); await play(f.service, s); await f.service.synchronize();
    const raw = JSON.stringify({ schemaVersion: 1, sessions: [s], answers: [botanicalAnswer(s)], privateUnknownField: 'synthetic-private-source' });
    storage.setItem(VISITOR_PROGRESS_KEY, raw);
    const result = await f.service.confirmImport(await f.service.previewImport());
    expect(result.error).toMatch(/identifiant/); expect(result.savedLocally).toBe(false);
    const saved = await f.repo(userA).read(); expect(saved.importArchives).toHaveLength(1); expect(saved.importArchives[0].raw).toBe(raw);
    const state = f.service.getState(); expect(state.sync.importArchives).toHaveLength(1);
    expect(Object.keys(state.sync.importArchives[0]).sort()).toEqual(['id', 'message', 'reason']);
    expect(JSON.stringify(state)).not.toContain('synthetic-private-source');
    f.auth.emit('authenticated', userB); await f.service.start(); await f.service.synchronize();
    expect(f.service.getState().sync.importArchives).toEqual([]); expect((await f.repo(userA).read()).importArchives[0].raw).toBe(raw);
  });
});
