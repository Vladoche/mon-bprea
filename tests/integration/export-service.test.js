import { it, expect, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { readScopedRecord } from '../../assets/personal-idb.js';
import { createExportService } from '../../assets/export-service.js';
import { emptyPersonalDocument } from '../../assets/course-quiz-model.js';
import { A, B, serverRows, stamp } from '../fixtures/export.js';
function fixture({ read = async () => serverRows(A), local = async () => null, storage } = {}) {
  let user = A, version = 1, status = 'authenticated'; const listeners = new Set();
  const auth = { getState: () => ({ status, user: user ? { id: user } : null }), getIdentityVersion: () => version,
    getExportIdentity: vi.fn(async () => ({ id: user, email: `${user === A ? 'a' : 'b'}@example.invalid`, created_at: stamp })),
    subscribe(cb) { listeners.add(cb); cb(auth.getState()); return () => listeners.delete(cb); } };
  const service = createExportService({ auth, configuration: { environment: 'development', url: 'https://export.invalid', client: {} }, readLocal: local,
    transportFactory: () => read, storage, now: () => stamp });
  return { service, auth, switch(id, next = 'authenticated') { user = id; status = next; version++; for (const cb of listeners) cb(auth.getState()); } };
}
it('deux passes concordantes, aucune écriture, vérification avant chaque téléchargement et mémoire libérée', async () => {
  const read = vi.fn(async () => serverRows(A)), f = fixture({ read }); let file;
  await f.service.prepareAccount(); expect(f.service.getState().status).toBe('ready'); expect(read).toHaveBeenCalledTimes(2);
  await f.service.downloadAccount(text => { file = JSON.parse(text); });
  expect(file.data.identity.id).toBe(A); expect(Object.keys(file.data.server)).toHaveLength(10);
  expect(f.auth.getExportIdentity).toHaveBeenCalledTimes(3);
  expect(await f.service.downloadAccount(() => { throw new Error('second download'); })).toBe(false); f.service.stop();
});
it('recommence un scan modifié puis stabilise, borne à trois passes si mutations continues', async () => {
  let calls = 0;
  const f = fixture({ read: async () => serverRows(A, ++calls === 1 ? 1 : 2) });
  await f.service.prepareAccount(); expect(calls).toBe(3); expect(f.service.getState().status).toBe('ready'); f.service.stop();
  calls = 0; const g = fixture({ read: async () => serverRows(A, ++calls) });
  await g.service.prepareAccount(); expect(g.service.getState()).toMatchObject({ status: 'incomplete', reason: 'unstable' }); g.service.stop();
});
it('échec API et hors ligne ne produisent aucun fichier, compléments indisponibles sont déclarés partiels', async () => {
  const f = fixture({ read: async () => { throw new Error(); } }); await f.service.prepareAccount();
  const deliver = vi.fn(); await f.service.downloadAccount(deliver); expect(deliver).not.toHaveBeenCalled(); f.service.stop();
  const g = fixture({ local: async () => { throw Object.assign(new Error(), { code: 'blocked' }); } });
  await g.service.prepareAccount(); expect(g.service.getState()).toMatchObject({ status: 'ready', exportStatus: 'partial' });
  expect(g.service.getState().coverage.filter(c => c.status === 'blocked')).toHaveLength(4); g.service.stop();
  const h = fixture(); h.switch(A, 'offline'); await h.service.prepareAccount(); expect(h.service.getState().status).toBe('identity'); h.service.stop();
});
it('A→B→A, annulation, refus Auth final et réponses tardives invalident les données préparées', async () => {
  let release; const waiting = new Promise(resolve => { release = resolve; });
  const f = fixture({ read: async () => { await waiting; return serverRows(A); } });
  const pending = f.service.prepareAccount(); await Promise.resolve(); f.switch(B); f.switch(A); release(); await pending;
  const deliver = vi.fn(); expect(await f.service.downloadAccount(deliver)).toBe(false); expect(deliver).not.toHaveBeenCalled();
  f.service.stop();
  const g = fixture(); await g.service.prepareAccount(); g.service.cancel(); await g.service.downloadAccount(deliver); expect(deliver).not.toHaveBeenCalled();
  await g.service.prepareAccount(); g.auth.getExportIdentity.mockRejectedValue(new Error()); await g.service.downloadAccount(deliver);
  expect(deliver).not.toHaveBeenCalled(); g.service.stop();
});
it('copie locale séparée sélectionnée, exclusions explicites, originaux intacts et sans session', () => {
  const raw = JSON.stringify({ lesson: { done: false, quizScoreArchive: ['OTHER_PERSON'] } });
  const storage = { getItem: key => key === 'bprea-demo-progress-v1' ? raw : null, setItem: vi.fn(), removeItem: vi.fn() };
  const f = fixture({ storage }); f.switch(null, 'anonymous');
  const result = f.service.prepareDevice(['courses']);
  expect(result.sourceScope).toEqual({ kind: 'device', ownership: 'unverified' }); expect(result.status).toBe('partial');
  expect(result.data.courses.lesson.done).toBe(false); expect(JSON.stringify(result)).not.toContain('OTHER_PERSON');
  expect(storage.setItem).not.toHaveBeenCalled(); expect(storage.removeItem).not.toHaveBeenCalled(); f.service.stop();
});
it('IndexedDB : lit seulement get(scope), conserve A/B et n’installe pas de base absente', async () => {
  const indexedDB = new IDBFactory(), scope = JSON.stringify(['development', 'https://export.invalid', A]);
  expect(await readScopedRecord('absent', scope, { indexedDB })).toBeNull(); expect(await indexedDB.databases()).toEqual([]);
  const req = indexedDB.open('fixture', 1); req.onupgradeneeded = () => req.result.createObjectStore('accounts');
  const db = await new Promise(resolve => { req.onsuccess = () => resolve(req.result); });
  const doc = emptyPersonalDocument(scope), b = emptyPersonalDocument(scope.replace(A, B));
  await new Promise(resolve => { const tx = db.transaction('accounts', 'readwrite'); tx.objectStore('accounts').put(doc, scope); tx.objectStore('accounts').put(b, b.scope); tx.oncomplete = resolve; });
  expect(await readScopedRecord('fixture', scope, { indexedDB })).toEqual(doc);
  expect(await readScopedRecord('fixture', b.scope, { indexedDB })).toEqual(b);
  const controller = new AbortController(); controller.abort(); await expect(readScopedRecord('fixture', scope, { indexedDB, signal: controller.signal })).rejects.toMatchObject({ code: 'cancelled' });
  db.close();
});
it('signale version de base future, stockage refusé/bloqué et volume sans réinitialisation ni fichier tronqué', async () => {
  const indexedDB = new IDBFactory(), request = indexedDB.open('future', 2);
  const db = await new Promise(resolve => { request.onsuccess = () => resolve(request.result); }); db.close();
  await expect(readScopedRecord('future', 'scope', { indexedDB })).rejects.toMatchObject({ code: 'future' });
  expect((await indexedDB.databases())[0].version).toBe(2);
  await expect(readScopedRecord('x', 'scope', { indexedDB: { open() { throw new Error(); } } })).rejects.toMatchObject({ code: 'unavailable' });
  vi.useFakeTimers();
  const pending = readScopedRecord('x', 'scope', { indexedDB: { open: () => ({}) }, timeoutMs: 5000 });
  const checked = expect(pending).rejects.toMatchObject({ code: 'blocked' }); await vi.advanceTimersByTimeAsync(5000); await checked; vi.useRealTimers();
  const raw = 'x'.repeat(20 * 1024 * 1024 + 1), f = fixture({ storage: { getItem: () => raw } });
  const result = f.service.prepareDevice(['legacyTheme']); expect(result.coverage[0].status).toBe('volume'); expect(result.data).toEqual({}); f.service.stop();
});
