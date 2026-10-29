import { it, expect, vi } from 'vitest';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { createRestoreService } from '../../assets/restore-service.js';
import { restoreRepository } from '../../assets/restore-adapters.js';
import { readScopedSnapshot } from '../../assets/personal-idb.js';
import { CACHES } from '../../assets/export-sources.js';
import { publishPrivacy } from '../../assets/privacy-events.js';
import { archive, selectedFile, config, scope, A, B, stamp, uuid, emptyServer, restoreRows } from '../fixtures/restore.js';

function fixture(options = {}) {
  const indexedDB = new IDBFactory(), listeners = new Set(); let user = A, status = 'authenticated', version = 1;
  const auth = { getState: () => ({ status, user: user ? { id: user } : null }), getIdentityVersion: () => version,
    getExportIdentity: vi.fn(async () => ({ id: user })), subscribe(fn) { listeners.add(fn); fn(auth.getState()); return () => listeners.delete(fn); } };
  const current = options.server || emptyServer(), read = vi.fn(async () => structuredClone(current));
  const send = vi.fn(async operation => {
    const p = operation.rpcPayload;
    const row = { user_id: A, attempt_id: p.p_attempt_id, lesson_id: p.p_lesson_id, score: p.p_score, total: p.p_total,
      completed_at: p.p_completed_at, schema_version: 1, created_at: stamp };
    current.quiz_attempts.push(row); return { status: 'inserted', row };
  });
  const commits = vi.fn();
  const repository = (domain, key) => restoreRepository(domain, key, { indexedDB, onCommit: commits });
  const service = createRestoreService({ auth, configuration: config,
    readLocal: (db, key, opts) => readScopedSnapshot(db, key, { ...opts, indexedDB }), readFactory: () => read,
    repositoryFactory: repository, transportFactory: () => ({ send }), withLock: fn => fn(), now: () => stamp, ...options.service });
  return { service, auth, indexedDB, read, send, commits, current, repository,
    switch(id, next = 'authenticated') { user = id; status = next; version++; for (const fn of listeners) fn(auth.getState()); },
    get: domain => readScopedSnapshot(CACHES[domain], scope, { indexedDB }),
  };
}
const quizArchive = () => { const rows = emptyServer(); rows.quiz_attempts = restoreRows().quiz_attempts; return archive(rows); };

it('analyse et annulation sans aucune écriture/base créée ; confirmation obligatoire', async () => {
  const f = fixture(); await f.service.analyze(selectedFile(quizArchive()));
  expect(f.service.getState().status).toBe('ready'); expect(await f.indexedDB.databases()).toEqual([]);
  expect(f.commits).not.toHaveBeenCalled(); expect(f.send).not.toHaveBeenCalled();
  expect(await f.service.apply()).toBe(false); f.service.cancel(); expect(await f.service.apply({ confirmed: true })).toBe(false);
  expect(await f.indexedDB.databases()).toEqual([]); f.service.stop();
});
it('deux tentatives égales confirmées, relecture persistante et deuxième import sans doublon', async () => {
  const f = fixture(), selected = selectedFile(quizArchive()); await f.service.analyze(selected); await f.service.apply({ confirmed: true });
  expect(f.service.getState()).toMatchObject({ status: 'confirmed', summary: { total: { server: 2, pending: 0 } } });
  expect(Object.keys((await f.get('courses')).document.attempts)).toHaveLength(2); expect(f.current.quiz_attempts).toHaveLength(2);
  await f.service.analyze(selected); expect(f.service.getState().summary.total.present).toBe(2); expect(f.service.getState().summary.total.recoverable).toBe(0);
  expect(f.send).toHaveBeenCalledTimes(2); expect(Object.keys((await f.get('courses')).document.attempts)).toHaveLength(2); f.service.stop();
});
it('nouvel appareil : reconstitue les quatre caches, serveur inchangé, aucune RPC', async () => {
  const f = fixture({ server: restoreRows() }), before = structuredClone(f.current);
  await f.service.analyze(selectedFile(archive())); await f.service.apply({ confirmed: true });
  expect(f.current).toEqual(before); expect(f.send).not.toHaveBeenCalled();
  expect((await f.get('courses')).document.courses['matiere-organique'].done).toBe(false);
  expect((await f.get('drill')).document.drill.series['uc3__2026-W43'].questions).toHaveLength(10);
  expect((await f.get('botanical')).document.answers['question-1'].status).toBe('skipped_image');
  expect((await f.get('settings')).document.values.appearance).toEqual({ version: 1, season: 'auto', brightness: 'auto' });
  expect(f.service.getState().summary.total.local).toBe(10); expect(f.service.getState().summary.total.server).toBe(0); f.service.stop();
});
it('refus A sous B, visiteur et compte Auth supprimé sans créer un record', async () => {
  for (const mode of ['B', 'visitor', 'deleted']) {
    const f = fixture(); if (mode === 'B') f.switch(B); if (mode === 'visitor') f.switch(null, 'anonymous');
    if (mode === 'deleted') f.auth.getExportIdentity.mockRejectedValue(Object.assign(new Error(), { code: 'invalid_session' }));
    await f.service.analyze(selectedFile(archive())); expect(['invalid', 'identity']).toContain(f.service.getState().status);
    expect(await f.indexedDB.databases()).toEqual([]); expect(f.send).not.toHaveBeenCalled(); f.service.stop();
  }
});
it('A→B→A pendant lecture différée et pendant un aperçu invalide définitivement la génération', async () => {
  const f = fixture(); let release, entered; const wait = new Promise(resolve => { release = resolve; }), reached = new Promise(resolve => { entered = resolve; });
  f.read.mockImplementation(async () => { entered(); await wait; return emptyServer(); });
  const running = f.service.analyze(selectedFile(quizArchive())); await reached; f.switch(B); f.switch(A); release(); await running;
  expect(f.service.getState().status).toBe('identity'); expect(await f.service.apply({ confirmed: true })).toBe(false); expect(f.send).not.toHaveBeenCalled();
  f.read.mockImplementation(async () => emptyServer()); await f.service.analyze(selectedFile(quizArchive())); f.switch(B); f.switch(A);
  expect(await f.service.apply({ confirmed: true })).toBe(false); expect(await f.indexedDB.databases()).toEqual([]); f.service.stop();
});
it('aperçu périmé par changement distant ou local : impose une nouvelle analyse', async () => {
  const f = fixture(); await f.service.analyze(selectedFile(quizArchive())); f.current.quiz_attempts.push(restoreRows().quiz_attempts[0]);
  await f.service.apply({ confirmed: true }); expect(f.service.getState().status).toBe('changed'); expect(f.send).not.toHaveBeenCalled(); expect(await f.indexedDB.databases()).toEqual([]); f.service.stop();
});
it('perte réseau après commit garde les UUID en attente, puis réconciliation sans renvoi', async () => {
  const f = fixture(), realSend = f.send.getMockImplementation();
  f.send.mockImplementationOnce(async op => { await realSend(op); throw new Error('lost acknowledgement'); });
  await f.service.analyze(selectedFile(quizArchive())); await f.service.apply({ confirmed: true });
  expect(f.service.getState()).toMatchObject({ status: 'partial', summary: { total: { pending: 2 } } });
  const saved = (await f.get('courses')).document; expect(saved.operations.map(op => op.id)).toEqual([uuid(100), uuid(101)]);
  expect(f.current.quiz_attempts).toHaveLength(1);
  f.service.stop();
  // Ordinary synchronizer will reconcile the uncertain receipt; do not revive
  // the whole archived queue via another import. The active queue is preserved.
  expect(saved.operations[0].payload.p_attempt_id).toBe(uuid(100)); expect(saved.operations[0].state).toBe('pending');
});
it('quota ou échec local annule la transaction : aucune RPC et aucune réussite annoncée', async () => {
  const f = fixture({ service: { repositoryFactory: () => ({ change: async () => { throw Object.assign(new Error(), { code: 'local_storage' }); }, close: async () => {} }) } });
  await f.service.analyze(selectedFile(quizArchive())); await f.service.apply({ confirmed: true });
  expect(f.service.getState()).toMatchObject({ status: 'partial', summary: { total: { blocked: 2, server: 0 } } }); expect(f.send).not.toHaveBeenCalled(); expect(await f.indexedDB.databases()).toEqual([]); f.service.stop();
});
it('changement pendant envoi : le retour tardif ne peut pas acquitter une nouvelle identité', async () => {
  const f = fixture(); let release, entered; const wait = new Promise(resolve => { release = resolve; }), reached = new Promise(resolve => { entered = resolve; });
  f.send.mockImplementation(async () => { entered(); await wait; return { status: 'inserted', row: restoreRows().quiz_attempts[0] }; });
  await f.service.analyze(selectedFile(quizArchive())); const applying = f.service.apply({ confirmed: true }); await reached;
  f.switch(B); f.switch(A); release(); await applying;
  expect(f.service.getState().status).toBe('identity'); expect((await f.get('courses')).document.operations.every(op => op.state === 'pending')).toBe(true); f.service.stop();
});
it('barrière privacy lue sans mutation, préservée et bloquante même après reprise explicite', async () => {
  const f = fixture({ server: restoreRows() }), req = f.indexedDB.open(CACHES.courses, 2);
  req.onupgradeneeded = () => { req.result.createObjectStore('accounts'); req.result.createObjectStore('privacy'); };
  const db = await new Promise(resolve => { req.onsuccess = () => resolve(req.result); }); const marker = { version: 1, epoch: uuid(990), blocked: false };
  await new Promise(resolve => { const tx = db.transaction('privacy', 'readwrite'); tx.objectStore('privacy').put(marker, scope); tx.oncomplete = resolve; }); db.close();
  await f.service.analyze(selectedFile(quizArchive())); expect(f.service.getState().summary.total.recoverable).toBe(0);
  expect(await f.get('courses')).toEqual({ document: null, privacy: marker }); f.service.stop();
});
it('source serveur indisponible, annulation inter-onglets et fichier hostile : aucune mutation', async () => {
  const f = fixture(); f.read.mockRejectedValue(new Error()); await f.service.analyze(selectedFile(quizArchive()));
  expect(f.service.getState().reasons).toContain('server_unavailable'); expect(await f.service.apply({ confirmed: true })).toBe(false);
  publishPrivacy('suspend'); expect(f.service.getState().status).toBe('interrupted');
  await f.service.analyze(selectedFile('{bad')); expect(f.service.getState().status).toBe('invalid'); expect(f.send).not.toHaveBeenCalled(); expect(await f.indexedDB.databases()).toEqual([]); f.service.stop();
});

it('conflit CAS après aperçu : conserve la gagnante et archive le payload original sans changer sa base', async () => {
  const f = fixture(), rows = emptyServer(); rows.course_states = [restoreRows().course_states[0]];
  const winner = { ...rows.course_states[0], done: true, operation_id: uuid(999) };
  f.send.mockImplementation(async () => { f.current.course_states.push(winner); return { status: 'conflict', row: winner }; });
  await f.service.analyze(selectedFile(archive(rows))); await f.service.apply({ confirmed: true });
  expect(f.service.getState()).toMatchObject({ status: 'partial', summary: { total: { conflict: 1, server: 0 } } });
  const saved = (await f.get('courses')).document;
  expect(saved.courses['matiere-organique'].done).toBe(true); expect(saved.conflicts[0].local.done).toBe(false);
  expect(saved.operations[0].payload.p_expected_revision).toBe(0); expect(saved.operations[0].id).toBe(rows.course_states[0].operation_id);
  f.service.stop();
});

it('vrai rollback IndexedDB sur quota : record A et témoin B intacts, aucune RPC', async () => {
  const f = fixture(), a = f.repository('courses', scope), bScope = scope.replace(A, B), b = f.repository('courses', bScope);
  await a.change(doc => { doc.preserved = 'A fixture'; }); await b.change(doc => { doc.preserved = 'B fixture'; }); await a.close(); await b.close();
  const before = await f.get('courses'); await f.service.analyze(selectedFile(quizArchive()));
  const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => { throw new DOMException('synthetic quota', 'QuotaExceededError'); });
  try { await f.service.apply({ confirmed: true }); } finally { put.mockRestore(); }
  expect(await f.get('courses')).toEqual(before); expect((await readScopedSnapshot(CACHES.courses, bScope, { indexedDB: f.indexedDB })).document.preserved).toBe('B fixture');
  expect(f.send).not.toHaveBeenCalled(); expect(f.service.getState().summary.total.server).toBe(0); f.service.stop();
});

it('une valeur locale indépendante et ses champs inconnus ne peuvent pas disparaître pendant un rebuild', async () => {
  const f = fixture(), repo = f.repository('courses', scope);
  await repo.change(doc => { Object.defineProperty(doc.courses, 'cours-local-independant', { value: { done: false, futureField: 'preserve' }, enumerable: true }); }); await repo.close();
  const before = await f.get('courses'); await f.service.analyze(selectedFile(quizArchive()));
  // Confirmation rebuilds the course projection too. An unrelated value must
  // survive that future transition before an operation can be queued.
  const file = archive(emptyServer()); file.data.server.course_states = [restoreRows().course_states[0]];
  file.coverage.find(item => item.source === 'course_states').count = 1;
  await f.service.analyze(selectedFile(file)); expect(f.service.getState().summary.total.recoverable).toBe(0);
  expect(await f.get('courses')).toEqual(before); expect(f.send).not.toHaveBeenCalled(); f.service.stop();
});
