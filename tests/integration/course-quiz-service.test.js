import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createCourseQuizService, VISITOR_PROGRESS_KEY } from '../../assets/course-quiz-service.js';
import { createCourseQuizRepository, personalScope } from '../../assets/course-quiz-store.js';
import { getUnitExamStats } from '../../assets/exam-stats.js';
import { reconcileHistory } from '../../assets/course-quiz-model.js';
import { MemoryStorage } from '../helpers/memory-storage.js';

const userA = '11111111-1111-4111-8111-111111111111'; const userB = '22222222-2222-4222-8222-222222222222';
const at = '2026-10-20T10:00:00.000Z'; const lessonId = 'matiere-organique';
const configuration = { client: {}, environment: 'development', url: 'https://fixture.invalid' };
const catalogue = [{ id: lessonId, unit: 'uc3', quiz: [{}, {}, {}] }];
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
    if (!histories.has(userId)) histories.set(userId, { courses: [], attempts: [] });
    const history = histories.get(userId);
    const connection = {
      readHistory: vi.fn(async () => structuredClone(history)),
      send: vi.fn(async operation => {
        sent.push(structuredClone({ userId, ...operation })); const p = operation.rpcPayload;
        if (operation.type === 'quiz') {
          const previous = history.attempts.find(row => row.attempt_id === p.p_attempt_id);
          if (previous) return { status: 'replayed', row: structuredClone(previous) };
          const row = { user_id: userId, attempt_id: p.p_attempt_id, lesson_id: p.p_lesson_id, score: p.p_score, total: p.p_total,
            completed_at: p.p_completed_at, schema_version: 1, created_at: at };
          history.attempts.push(row); return { status: 'inserted', row: structuredClone(row) };
        }
        const previous = history.courses.find(row => row.lesson_id === p.p_lesson_id);
        if (previous?.operation_id === p.p_operation_id) return { status: 'replayed', row: structuredClone(previous) };
        if ((previous?.revision || 0) !== p.p_expected_revision) return { status: 'conflict', row: structuredClone(previous || null) };
        const row = { user_id: userId, lesson_id: p.p_lesson_id, done: p.p_done, best_score: p.p_best_score,
          legacy_score: p.p_legacy_score, legacy_total: p.p_legacy_total, operation_id: p.p_operation_id,
          base_revision: p.p_expected_revision, revision: p.p_expected_revision + 1, schema_version: 1, created_at: previous?.created_at || at, updated_at: at };
        history.courses = [...history.courses.filter(item => item.lesson_id !== row.lesson_id), row];
        return { status: previous ? 'updated' : 'inserted', row: structuredClone(row) };
      }),
    }; connections.set(userId, connection); return connection;
  };
  return { histories, sent, connections, factory };
}
function fixture({ auth = authFixture(), remote = backend(), idb = indexedDB, repositoryFactory } = {}) {
  const callbacks = [];
  const repo = id => createCourseQuizRepository(personalScope({ ...configuration, userId: id }), { indexedDB: idb });
  const service = createCourseQuizService({ auth, configuration, storage, catalogue, broadcast: null,
    repositoryFactory: repositoryFactory || (scope => createCourseQuizRepository(scope, { indexedDB: idb })),
    transportFactory: remote.factory, now: () => Date.parse(at), schedule: (fn, delay) => { callbacks.push({ fn, delay }); return callbacks.length; }, cancel: vi.fn() });
  services.push(service); return { service, auth, remote, repo, callbacks };
}
async function initialized(options) { const f = fixture(options); await f.service.start(); await f.service.synchronize(); return f; }

describe('service cours/QCM — réseau simulé, aucune preuve Auth/RLS distante', () => {
  it('garde le visiteur local et ses archives, sans transport ni import implicite dans A', async () => {
    const raw = JSON.stringify({ [lessonId]: { done: true, unknown: { keep: 1 } }, progressArchive: ['old'] });
    storage.setItem(VISITOR_PROGRESS_KEY, raw);
    const visitor = await initialized({ auth: authFixture(null) });
    expect(visitor.remote.connections.size).toBe(0); expect(visitor.service.getState().view.progress[lessonId].done).toBe(true);
    await visitor.service.recordQuiz(lessonId, { score: 2, total: 3, completedAt: at });
    expect(visitor.service.getState().view.progress[lessonId].unknown).toEqual({ keep: 1 });
    expect(visitor.service.getState().view.progress.progressArchive).toEqual(['old']);
    const personal = await initialized();
    expect(personal.service.getState().view.progress).toEqual({}); expect(personal.remote.sent).toEqual([]);
  });
  it('ne présente pas une absence de cache hors ligne comme une progression vide fiable', async () => {
    const f = fixture({ auth: authFixture(userA, 'offline') }); await f.service.start();
    expect(f.service.getState().view.error).toMatch(/aucun cache personnel fiable/);
    expect((await f.service.setCourseDone(lessonId, true)).error).toBeTruthy();
    expect(f.remote.connections.get(userA).readHistory).not.toHaveBeenCalled();
  });
  it('affiche le backend indisponible, sans chargement infini ni faux résultat vide, si la migration personnelle manque', async () => {
    const f = fixture(); await f.service.start();
    f.remote.connections.get(userA).readHistory.mockRejectedValue({ code: 'PGRST205' });
    await f.service.synchronize();
    const state = f.service.getState(); expect(state.sync.state).toBe('error');
    expect(state.view.error).toContain('Le stockage du compte pour les cours et QCM n’est pas disponible');
    expect(state.view.error).not.toContain('Chargement'); expect(state.view.progress).toEqual({});
    expect(state.sync.pending).toBe(0); expect(f.remote.sent).toEqual([]);
  });
  it('persiste réponse et opérations avant les envois puis reprend l’outbox après rechargement', async () => {
    const remote = backend(); const f = await initialized({ remote });
    expect((await f.service.recordQuiz(lessonId, { score: 3, total: 3, completedAt: at })).error).toBeNull();
    expect(remote.sent).toEqual([]); const before = await f.repo(userA).read();
    expect(before.operations.map(op => op.type)).toEqual(['quiz', 'course']); expect(Object.keys(before.attempts)).toHaveLength(1);
    f.service.stop(); const reload = fixture({ remote }); await reload.service.start();
    expect(reload.service.getState().view.progress[lessonId].quizAttempts).toHaveLength(1);
    await reload.service.synchronize();
    expect(remote.histories.get(userA).attempts).toHaveLength(1); expect(reload.service.getState().sync.state).toBe('synced');
    expect((await reload.repo(userA).read()).operations.map(op => op.id)).toEqual(before.operations.map(op => op.id));
  });
  it('rejoue un acquittement perdu avec le même UUID et payload sans créer une tentative supplémentaire', async () => {
    const f = await initialized(); const connection = f.remote.connections.get(userA);
    const send = connection.send.getMockImplementation(); let lost = true;
    connection.send.mockImplementation(async operation => { const result = await send(operation); if (operation.type === 'quiz' && lost) { lost = false; throw new TypeError('lost after commit'); } return result; });
    await f.service.recordQuiz(lessonId, { score: 2, total: 3, completedAt: at }); await f.service.synchronize();
    expect(f.service.getState().sync.state).toBe('offline');
    await f.repo(userA).change(saved => { saved.operations.filter(op => op.state === 'pending').forEach(op => { op.retryAt = 0; }); });
    await f.service.synchronize();
    const sends = f.remote.sent.filter(op => op.type === 'quiz'); expect(sends).toHaveLength(2);
    expect(sends[1].id).toBe(sends[0].id); expect(sends[1].rpcPayload).toEqual(sends[0].rpcPayload);
    expect(f.remote.histories.get(userA).attempts).toHaveLength(1);
  });
  it('propage le décochage entre deux caches sans le réactiver depuis un ancien QCM parfait', async () => {
    const remote = backend(); const first = await initialized({ remote });
    await first.service.recordQuiz(lessonId, { score: 3, total: 3, completedAt: at }); await first.service.synchronize();
    const second = await initialized({ remote, idb: new IDBFactory() });
    expect(second.service.getState().view.progress[lessonId].done).toBe(true);
    await second.service.setCourseDone(lessonId, false); await second.service.synchronize();
    await first.service.retry(); expect(first.service.getState().view.progress[lessonId].done).toBe(false);
    await second.service.recordQuiz(lessonId, { score: 1, total: 3, completedAt: at }); await second.service.synchronize();
    await first.service.retry(); const progress = first.service.getState().view.progress;
    expect(progress[lessonId].done).toBe(false); expect(progress[lessonId].score).toBe(3); expect(progress[lessonId].quizAttempts).toHaveLength(2);
    expect(getUnitExamStats('uc3', catalogue, progress)).toMatchObject({ attemptCount: 2, correctAnswers: 4, answeredQuestions: 6 });
  });
  it('archive une concurrence CAS puis résout par une nouvelle intention sur la base actuelle', async () => {
    const remote = backend(); const first = await initialized({ remote });
    await first.service.setCourseDone(lessonId, true); await first.service.synchronize();
    const second = await initialized({ remote, idb: new IDBFactory() });
    await first.service.setCourseDone(lessonId, false); await second.service.setCourseDone(lessonId, true);
    await first.service.synchronize(); await second.service.synchronize();
    expect(second.service.getState().sync.state).toBe('conflict'); expect(second.service.getState().view.progress[lessonId].done).toBe(false);
    const conflict = second.service.getState().sync.conflicts.find(item => !item.resolved);
    const oldId = conflict.operation.id; expect((await second.service.resolveConflict(conflict.id, 'local')).error).toBeNull();
    await second.service.synchronize();
    const row = remote.histories.get(userA).courses[0]; expect(row.done).toBe(true); expect(row.operation_id).not.toBe(oldId); expect(row.revision).toBe(3);
    expect(second.service.getState().sync.conflicts[0].resolved).toBeTruthy();
  });
  it('conserve A à la déconnexion, isole B et restitue A sans toucher aux historiques visiteur', async () => {
    const raw = JSON.stringify({ [lessonId]: { done: false, score: 1 } }); storage.setItem(VISITOR_PROGRESS_KEY, raw);
    const f = await initialized(); await f.service.recordQuiz(lessonId, { score: 3, total: 3, completedAt: at }); await f.service.synchronize();
    f.auth.emit('loading'); expect(f.service.getState().view.progress).toEqual({});
    f.auth.emit('anonymous'); await f.service.start(); expect(f.service.getState().mode).toBe('visitor');
    f.auth.emit('authenticated', userB); await f.service.start(); await f.service.synchronize();
    expect(f.service.getState().view.progress).toEqual({});
    await f.service.recordQuiz(lessonId, { score: 1, total: 3, completedAt: at }); await f.service.synchronize();
    f.auth.emit('authenticated', userA); await f.service.start(); await f.service.synchronize();
    expect(f.service.getState().view.progress[lessonId].score).toBe(3); expect(f.service.getState().view.progress[lessonId].quizAttempts).toHaveLength(1);
    expect(storage.getItem(VISITOR_PROGRESS_KEY)).toBe(raw);
  });
  it('ignore l’ancienne réponse A reçue pendant la connexion B et garde l’opération chez A', async () => {
    const f = await initialized(); const connection = f.remote.connections.get(userA); let release;
    connection.send.mockImplementation(() => new Promise(resolve => { release = resolve; }));
    await f.service.setCourseDone(lessonId, true); const running = f.service.synchronize();
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    f.auth.emit('authenticated', userB); await f.service.start(); await f.service.synchronize();
    release({ status: 'inserted', row: {} }); await running;
    expect(f.service.getState().view.progress).toEqual({});
    expect((await f.repo(userA).read()).operations[0].state).toBe('pending');
    expect((await f.repo(userB).read()).operations).toEqual([]);
  });
  it('une action déclenchée pendant le chargement A ne peut reprendre dans le cache B', async () => {
    const bScope = personalScope({ ...configuration, userId: userB });
    const bRepo = createCourseQuizRepository(bScope, { indexedDB });
    await bRepo.change(saved => reconcileHistory(saved, { courses: [], attempts: [] }, userB, at));
    let release; const deferred = new Promise(resolve => { release = resolve; });
    const f = fixture({ repositoryFactory: scope => {
      const repo = createCourseQuizRepository(scope, { indexedDB });
      return scope === bScope ? repo : { ...repo, read: async () => { await deferred; return repo.read(); } };
    } });
    const courseAction = f.service.setCourseDone(lessonId, true);
    const quizAction = f.service.recordQuiz(lessonId, { score: 2, total: 3, completedAt: at });
    const retryAction = f.service.retry();
    f.auth.emit('authenticated', userB); await f.service.start();
    expect(f.service.getState().scope).toBe(bScope); release();
    expect((await courseAction).error).toMatch(/compte a changé/);
    expect((await quizAction).error).toMatch(/compte a changé/); await retryAction;
    expect((await f.repo(userA).read()).operations).toEqual([]); expect((await f.repo(userB).read()).operations).toEqual([]);
    expect(f.remote.sent).toEqual([]); expect(f.service.getState().view.progress).toEqual({});
  });
  it('reprend offline → authenticated sans événement online et masque les identités incertaines', async () => {
    const f = await initialized(); f.auth.emit('offline', userA); await f.service.start();
    await f.service.setCourseDone(lessonId, true); await f.service.synchronize(); expect(f.remote.sent).toEqual([]);
    f.auth.emit('authenticated', userA); await f.service.start(); await f.service.synchronize();
    expect(f.remote.sent).toHaveLength(1); expect(f.service.getState().sync.state).toBe('synced');
    f.auth.emit('error'); await f.service.start(); expect(f.service.getState().mode).toBe('blocked'); expect(f.service.getState().view.progress).toEqual({});
  });
  it('sépare session expirée et erreur permanente, sans renvoyer les opérations refusées en boucle', async () => {
    for (const [code, state] of [['23514', 'error'], ['PGRST303', 'session']]) {
      const f = await initialized({ idb: new IDBFactory() }); const connection = f.remote.connections.get(userA);
      connection.send.mockRejectedValue({ code }); await f.service.setCourseDone(lessonId, true); await f.service.synchronize();
      expect(f.service.getState().sync.state).toBe(state);
      if (state === 'session') expect(f.service.getState().view.progress).toEqual({});
      await f.service.synchronize(); expect(connection.send).toHaveBeenCalledTimes(1);
      if (state === 'session') {
        connection.send.mockImplementation(async operation => { const p = operation.rpcPayload; return { status: 'inserted', row: { user_id: userA,
          lesson_id: p.p_lesson_id, done: p.p_done, best_score: p.p_best_score, legacy_score: p.p_legacy_score, legacy_total: p.p_legacy_total,
          operation_id: p.p_operation_id, base_revision: p.p_expected_revision, revision: p.p_expected_revision + 1, schema_version: 1, created_at: at, updated_at: at } }; });
        f.auth.emit('offline', userA); f.auth.emit('authenticated', userA); await f.service.start(); await f.service.retry();
        expect(f.service.getState().sync.state).toBe('synced');
      }
    }
  });
  it('garde le cache fiable lorsqu’un scan complet échoue et retrouve une insertion visible tardivement', async () => {
    const f = await initialized(); await f.service.recordQuiz(lessonId, { score: 1, total: 3, completedAt: at }); await f.service.synchronize();
    const before = f.service.getState().view;
    const connection = f.remote.connections.get(userA); connection.readHistory.mockRejectedValueOnce(new TypeError('page two failed'));
    await f.service.retry(); expect(f.service.getState().view).toEqual(before);
    const row = { user_id: userA, attempt_id: '99999999-9999-4999-8999-999999999999', lesson_id: lessonId, score: 2, total: 3, completed_at: at, created_at: at, schema_version: 1 };
    const history = structuredClone(f.remote.histories.get(userA));
    connection.readHistory.mockResolvedValueOnce({ ...history, attempts: [...history.attempts, row] }).mockResolvedValue(history);
    await f.service.retry(); expect(f.service.getState().view.progress[lessonId].quizAttempts).toHaveLength(2);
  });
  it('importe volontairement avec manifeste durable, reprend sans doublon et refuse la source modifiée', async () => {
    const raw = JSON.stringify({ [lessonId]: { done: true, score: 2, quizAttempts: [{ score: 2, total: 3, completedAt: at }, { score: 2, total: 3, completedAt: at }], future: ['keep'] }, progressArchive: ['old'] });
    storage.setItem(VISITOR_PROGRESS_KEY, raw); const f = await initialized();
    expect(f.remote.sent).toEqual([]); const preview = await f.service.previewImport(); expect(preview.summary).toMatchObject({ courses: 1, attempts: 2 });
    expect((await f.service.confirmImport(preview)).error).toBeNull();
    const manifest = (await f.repo(userA).read()).imports[0]; expect(manifest.raw).toBe(raw); expect(Object.keys(manifest.attemptIds)).toHaveLength(2);
    f.service.stop(); const reload = fixture({ remote: f.remote }); await reload.service.start();
    expect((await reload.service.confirmImport(await reload.service.previewImport())).replayed).toBe(true);
    await reload.service.synchronize(); expect(f.remote.histories.get(userA).attempts).toHaveLength(2);
    expect(storage.getItem(VISITOR_PROGRESS_KEY)).toBe(raw);
    storage.setItem(VISITOR_PROGRESS_KEY, raw.replace('"done":true', '"done":false'));
    expect((await reload.service.confirmImport(await reload.service.previewImport())).error).toBeTruthy();
    expect((await reload.repo(userA).read()).imports).toHaveLength(1);
  });
  it('ne confirme pas un enregistrement si la transaction de stockage échoue', async () => {
    let fail = false;
    const f = await initialized({ repositoryFactory: scope => {
      const repo = createCourseQuizRepository(scope, { indexedDB }); const change = repo.change;
      return { ...repo, change: (...args) => fail ? Promise.reject(Object.assign(new Error('stockage plein'), { code: 'local_storage' })) : change(...args) };
    } });
    fail = true; expect((await f.service.recordQuiz(lessonId, { score: 2, total: 3, completedAt: at })).error).toBe('stockage plein');
    expect(f.service.getState().sync.state).toBe('storage-error'); expect(f.remote.sent).toEqual([]);
    expect((await f.repo(userA).read()).attempts).toEqual({});
  });
  it('annonce saving avant le commit et un cycle réseau ne peut annoncer synced tant que l’écriture attend', async () => {
    let hold = false; let release;
    const f = await initialized({ repositoryFactory: scope => {
      const repo = createCourseQuizRepository(scope, { indexedDB });
      return { ...repo, change: (...args) => {
        if (!hold) return repo.change(...args);
        hold = false; return new Promise(resolve => { release = () => resolve(repo.change(...args)); });
      } };
    } });
    hold = true; const action = f.service.setCourseDone(lessonId, true);
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    expect(f.service.getState().sync.state).toBe('saving');
    await f.service.synchronize(); expect(f.service.getState().sync.state).toBe('saving');
    expect((await f.repo(userA).read()).operations).toEqual([]);
    release(); expect((await action).error).toBeNull(); expect(f.service.getState().sync.state).toBe('pending');
    expect((await f.repo(userA).read()).operations).toHaveLength(1);
  });
  it('un QCM déjà commis reste un succès local même si la relecture suivante échoue, sans seconde tentative', async () => {
    let failRead = false;
    const f = await initialized({ repositoryFactory: scope => {
      const repo = createCourseQuizRepository(scope, { indexedDB });
      return { ...repo, read: () => failRead ? Promise.reject(Object.assign(new Error('relecture inaccessible'), { code: 'local_storage' })) : repo.read() };
    } });
    failRead = true;
    const saved = await f.service.recordQuiz(lessonId, { score: 2, total: 3, completedAt: at });
    expect(saved).toMatchObject({ error: null, savedLocally: true });
    expect(f.service.getState().view.progress[lessonId].quizAttempts).toHaveLength(1);
    await f.service.retry(); expect(f.service.getState().sync.state).toBe('storage-error');
    expect(f.service.getState().sync.error).toMatch(/déjà enregistrées sont conservées/);
    failRead = false; await f.service.retry();
    expect(f.remote.histories.get(userA).attempts).toHaveLength(1); expect(Object.keys((await f.repo(userA).read()).attempts)).toHaveLength(1);
  });
  it('une transition Auth après le commit ne transforme pas une sauvegarde réelle en demande de nouvel enregistrement', async () => {
    for (const nextStatus of ['offline', 'authenticated']) {
      const auth = authFixture(); const idb = new IDBFactory(); let transition = false;
      const f = await initialized({ auth, idb, repositoryFactory: scope => {
        const repo = createCourseQuizRepository(scope, { indexedDB: idb });
        return { ...repo, change: async (...args) => {
          const value = await repo.change(...args);
          if (transition) { transition = false; auth.emit(nextStatus, nextStatus === 'offline' ? userA : userB); }
          return value;
        } };
      } });
      transition = true;
      const result = await f.service.recordQuiz(lessonId, { score: 2, total: 3, completedAt: at });
      expect(result).toMatchObject({ error: null, savedLocally: true });
      expect(Object.keys((await f.repo(userA).read()).attempts)).toHaveLength(1);
      if (nextStatus === 'offline') {
        await vi.waitFor(() => expect(f.service.getState().view.progress[lessonId].quizAttempts).toHaveLength(1));
        expect(f.service.getState().sync.state).toBe('offline');
      } else {
        await f.service.start(); expect(result.accountChanged).toBe(true); expect(result.progress).toBeUndefined();
        expect(f.service.getState().view.progress).toEqual({}); expect((await f.repo(userB).read()).operations).toEqual([]);
      }
    }
  });
});
