import { it, expect, vi } from 'vitest';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { createErasureService } from '../../assets/erasure-service.js';
import { changeErasureScope } from '../../assets/erasure-store.js';
import { readScopedRecord } from '../../assets/personal-idb.js';
import { createPersonalRepository, personalScope } from '../../assets/drill-personal-store.js';
import { createCourseQuizRepository } from '../../assets/course-quiz-store.js';
import { createBotanicalRepository } from '../../assets/botanical-personal-store.js';
import { createSettingsRepository } from '../../assets/settings-store.js';
import { mutateCourse } from '../../assets/course-quiz-model.js';
import { queueSettings } from '../../assets/settings-model.js';
import { createCourseQuizService } from '../../assets/course-quiz-service.js';
import { createExportService } from '../../assets/export-service.js';
import { CACHES } from '../../assets/export-sources.js';
import { MemoryStorage } from '../helpers/memory-storage.js';
import { A, B, parameters, serverRows } from '../fixtures/export.js';
const config = { environment: 'development', url: 'https://fixture.invalid', client: {} };
const scope = id => personalScope({ ...config, userId: id });
function authFixture() {
  let id = A, version = 0, status = 'authenticated'; const listeners = new Set();
  const auth = { getState: () => ({ status, user: id ? { id } : null }), getIdentityVersion: () => version,
    getExportIdentity: vi.fn(async () => ({ id })),
    subscribe(fn) { listeners.add(fn); fn(auth.getState()); return () => listeners.delete(fn); } };
  return { auth, switch(next, state = 'authenticated') { id = next; status = state; version++; listeners.forEach(fn => fn(auth.getState())); } };
}
function fixture(options = {}) {
  const f = authFixture(), indexedDB = new IDBFactory(), storage = new MemoryStorage();
  const service = createErasureService({ ...f, configuration: config, indexedDB, storage, exclusive: run => run(), ...options });
  return { ...f, indexedDB, storage, service };
}
const factories = { drill: createPersonalRepository, courses: createCourseQuizRepository, botanical: createBotanicalRepository, settings: createSettingsRepository };
it('cache initialement absent : crée seulement la barrière, aucune recréation implicite au chargement suivant', async () => {
  const f = fixture(); await f.service.prepare({ personal: ['drill'] });
  expect((await f.service.execute({ confirmed: true })).status).toBe('complete');
  expect(await readScopedRecord(CACHES.drill, scope(A), f)).toBeNull();
  const later = createPersonalRepository(scope(A), f);
  await expect(later.read()).rejects.toMatchObject({ code: 'local_erased' });
  await later.close(); f.service.stop();
});
async function fill(f, domain, key = scope(A)) {
  const repo = factories[domain](key, { indexedDB: f.indexedDB });
  await repo.change(saved => {
    if (domain === 'courses') mutateCourse(saved, 'uc1-sol', false);
    if (domain === 'settings') { queueSettings(saved, 'itk', parameters); queueSettings(saved, 'appearance', { version: 1, season: 'auto', brightness: 'dark' }); }
    saved.lastReconciledAt = '2026-10-27T12:00:00Z';
  });
  return repo;
}
it('efface A dans les quatre caches, conserve B, autre environnement/projet et toutes les clés visiteur/Auth', async () => {
  const f = fixture(); const originals = [];
  f.storage.setItem('bprea-demo-drill-v1', 'visiteur'); f.storage.setItem('bprea-auth-sdk', 'session');
  for (const domain of Object.keys(CACHES)) for (const key of [scope(A), scope(B), scope(A).replace('development', 'production'), scope(A).replace('fixture.invalid', 'other.invalid')]) {
    const repo = await fill(f, domain, key); originals.push({ domain, key, document: await repo.read(), repo });
  }
  const summary = await f.service.prepare({ personal: ['drill', 'courses', 'botanical', 'itk', 'appearance'] });
  expect(summary.find(item => item.source === 'Cours et QCM').pending).toBe(1);
  expect((await f.service.execute({ confirmed: true })).status).toBe('complete');
  for (const item of originals) {
    expect(await readScopedRecord(CACHES[item.domain], item.key, f)).toEqual(item.key === scope(A) ? null : item.document);
    if (item.key === scope(A)) await expect(item.repo.change(saved => { saved.lastReconciledAt = null; })).rejects.toMatchObject({ code: 'local_erased' });
    await item.repo.close();
  }
  expect(f.storage.getItem('bprea-demo-drill-v1')).toBe('visiteur'); expect(f.storage.getItem('bprea-auth-sdk')).toBe('session'); f.service.stop();
});
it('sélection ITK seule préserve exactement apparence, intentions et archives de ce domaine ; reprise explicite', async () => {
  const f = fixture(), repo = await fill(f, 'settings'), before = await repo.read();
  await f.service.prepare({ personal: ['itk'] }); await f.service.execute({ confirmed: true });
  const after = await readScopedRecord(CACHES.settings, scope(A), f);
  expect(after.values.itk).toBeNull(); expect(after.remote.itk).toBeNull(); expect(after.values.appearance).toEqual(before.values.appearance);
  expect(after.operations).toEqual(before.operations.filter(item => item.domain === 'appearance'));
  await expect(repo.read()).rejects.toMatchObject({ code: 'local_erased' });
  expect(await f.service.resume()).toBe(true);
  await expect(repo.read()).rejects.toMatchObject({ code: 'local_erased' });
  const fresh = createSettingsRepository(scope(A), f); expect((await fresh.read()).operations).toEqual(after.operations);
  await repo.close(); await fresh.close(); f.service.stop();
});
it('annulation, absence de confirmation, identité hors ligne et changement A/B n’effacent rien', async () => {
  const f = fixture(), repo = await fill(f, 'courses'), before = await repo.read();
  await f.service.prepare({ personal: ['courses'] }); f.service.cancel(); await expect(f.service.execute({ confirmed: true })).rejects.toMatchObject({ code: 'confirmation' });
  await f.service.prepare({ personal: ['courses'] }); await expect(f.service.execute()).rejects.toMatchObject({ code: 'confirmation' });
  f.switch(B); await expect(f.service.execute({ confirmed: true })).rejects.toBeTruthy();
  f.switch(A, 'offline'); await expect(f.service.prepare({ personal: ['courses'] })).rejects.toMatchObject({ code: 'identity' });
  expect(await repo.read()).toEqual(before); await repo.close(); f.service.stop();
});
it('modification après aperçu est refusée sans perdre une nouvelle opération', async () => {
  const f = fixture(), repo = await fill(f, 'courses'); await f.service.prepare({ personal: ['courses'] });
  await repo.change(saved => mutateCourse(saved, 'uc2-eau', true)); const before = await repo.read();
  expect(await f.service.execute({ confirmed: true })).toMatchObject({ status: 'failed', results: [{ reason: 'changed' }] });
  expect(await repo.read()).toEqual(before); await repo.close(); f.service.stop();
});
it('erreur transactionnelle de suppression annule aussi la barrière ; erreur visiteur donne un résultat partiel', async () => {
  const f = fixture(), repo = await fill(f, 'courses'), before = await repo.read();
  await f.service.prepare({ personal: ['courses'] });
  const remove = vi.spyOn(IDBObjectStore.prototype, 'delete').mockImplementationOnce(() => { throw new Error('quota'); });
  try { expect((await f.service.execute({ confirmed: true })).status).toBe('failed'); } finally { remove.mockRestore(); }
  expect(await repo.read()).toEqual(before);
  f.storage.setItem('bprea-demo-progress-v1', 'source');
  await f.service.prepare({ personal: ['courses'], visitor: ['courses'] });
  const failure = vi.spyOn(f.storage, 'removeItem').mockImplementation(() => { throw new Error(); });
  expect((await f.service.execute({ confirmed: true })).status).toBe('partial'); failure.mockRestore();
  expect(await readScopedRecord(CACHES.courses, scope(A), f)).toBeNull(); expect(f.storage.getItem('bprea-demo-progress-v1')).toBe('source');
  await repo.close(); f.service.stop();
});
it('visiteur et provenance sont retirés seulement sur sélection explicite, sans nettoyage global', async () => {
  const f = fixture(); f.switch(null, 'anonymous');
  for (const [key, value] of [['bprea-demo-progress-v1', 'cours'], ['bprea-demo-progress-provenance-v1', 'origine'], ['bprea-demo-drill-v1', 'drill']]) f.storage.setItem(key, value);
  await f.service.prepare({ visitor: ['courses'] }); await f.service.execute({ confirmed: true });
  expect(f.storage.getItem('bprea-demo-progress-v1')).toBeNull(); expect(f.storage.getItem('bprea-demo-progress-provenance-v1')).toBe('origine');
  await f.service.prepare({ visitor: ['courseProvenance'] }); await f.service.execute({ confirmed: true });
  expect(f.storage.getItem('bprea-demo-progress-provenance-v1')).toBeNull(); expect(f.storage.getItem('bprea-demo-drill-v1')).toBe('drill'); f.service.stop();
});
it('record futur, archives non attribuables et stockage inaccessible restent intacts', async () => {
  const f = fixture(), repo = await fill(f, 'settings'); await repo.change(saved => { saved.archives.push({ unknown: 'conservé' }); });
  await expect(f.service.prepare({ personal: ['itk'] })).rejects.toMatchObject({ code: 'unknown' });
  const blocked = fixture({ readLocal: async () => { throw Object.assign(new Error(), { code: 'blocked' }); } });
  await expect(blocked.service.prepare({ personal: ['courses'] })).rejects.toMatchObject({ code: 'blocked' }); blocked.service.stop();
  const future = fixture({ readLocal: async () => ({ version: 999, scope: scope(A) }) });
  await expect(future.service.prepare({ personal: ['drill'] })).rejects.toMatchObject({ code: 'unknown' }); future.service.stop();
  expect((await repo.read()).archives[0].unknown).toBe('conservé'); await repo.close(); f.service.stop();
});
it('un ancien onglet v1 peut bloquer l’upgrade : aucune réussite, ni suppression tardive', async () => {
  const indexedDB = new IDBFactory(); const req = indexedDB.open(CACHES.drill, 1); req.onupgradeneeded = () => req.result.createObjectStore('accounts');
  const db = await new Promise(resolve => { req.onsuccess = () => resolve(req.result); });
  const document = { version: 1, scope: scope(A), preserved: 'fixture' };
  await new Promise(resolve => { const tx = db.transaction('accounts', 'readwrite'); tx.objectStore('accounts').put(document, scope(A)); tx.oncomplete = resolve; });
  await expect(changeErasureScope(CACHES.drill, scope(A), { indexedDB, expected: JSON.stringify(document), timeoutMs: 100 })).rejects.toMatchObject({ code: 'blocked' });
  db.close(); await new Promise(resolve => setTimeout(resolve, 0));
  expect(await readScopedRecord(CACHES.drill, scope(A), { indexedDB })).toEqual(document);
});
it('échec du put de barrière après DELETE : transaction interrompue et record intégralement restauré', async () => {
  const f = fixture(), repo = await fill(f, 'courses'), before = await repo.read();
  await f.service.prepare({ personal: ['courses'] });
  const original = IDBObjectStore.prototype.put;
  const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (...args) {
    if (this.name === 'privacy') throw new DOMException('fixture', 'UnknownError'); return original.apply(this, args);
  });
  try { expect((await f.service.execute({ confirmed: true })).status).toBe('failed'); } finally { put.mockRestore(); }
  expect(await readScopedRecord(CACHES.courses, scope(A), f)).toEqual(before); expect(await repo.read()).toEqual(before);
  await repo.close(); f.service.stop();
});
it('ancien client v1 refusé après upgrade et réponse réseau tardive incapable de recréer le cache effacé', async () => {
  const f = fixture(), repo = await fill(f, 'courses');
  let release; const gate = new Promise(resolve => { release = resolve; });
  const sync = createCourseQuizService({ auth: f.auth, configuration: config, broadcast: null, schedule: () => 0,
    repositoryFactory: (key, options) => createCourseQuizRepository(key, { ...options, indexedDB: f.indexedDB }),
    transportFactory: () => ({ readHistory: () => gate }) });
  await sync.start(); const pending = sync.synchronize();
  const exporter = createExportService({ auth: f.auth, configuration: config, storage: f.storage, readLocal: async () => null, transportFactory: () => async () => serverRows(A) });
  await exporter.prepareAccount(); expect(exporter.getState().status).toBe('ready');
  await f.service.prepare({ personal: ['courses'] }); await f.service.execute({ confirmed: true });
  release({ courses: [], attempts: [] }); await pending;
  expect(await readScopedRecord(CACHES.courses, scope(A), f)).toBeNull(); expect(sync.getState().view.progress).toEqual({});
  expect(await exporter.downloadAccount(() => { throw new Error('fichier privé interdit'); })).toBe(false);
  const legacy = f.indexedDB.open(CACHES.courses, 1); await expect(new Promise((resolve, reject) => { legacy.onsuccess = resolve; legacy.onerror = () => reject(legacy.error); })).rejects.toMatchObject({ name: 'VersionError' });
  sync.stop(); exporter.stop(); f.service.stop(); await repo.close();
});
it('export en attente ignorant l’annulation : effacement transactionnel puis réponse tardive ne livrent aucun fichier', async () => {
  const f = fixture(), repo = await fill(f, 'courses'), b = await fill(f, 'courses', scope(B)), beforeB = await b.read();
  let release, entered;
  const gate = new Promise(resolve => { release = resolve; }), reached = new Promise(resolve => { entered = resolve; });
  const exporter = createExportService({ auth: f.auth, configuration: config, storage: f.storage,
    readLocal: (database, key) => readScopedRecord(database, key, f),
    transportFactory: () => async () => { entered(); await gate; return serverRows(A); } });
  const pending = exporter.prepareAccount(); await reached;
  await f.service.prepare({ personal: ['courses'] });
  expect((await f.service.execute({ confirmed: true })).status).toBe('complete');
  release(); await pending;
  const deliver = vi.fn(); expect(await exporter.downloadAccount(deliver)).toBe(false); expect(deliver).not.toHaveBeenCalled();
  expect(await readScopedRecord(CACHES.courses, scope(A), f)).toBeNull(); expect(await b.read()).toEqual(beforeB);
  exporter.stop(); f.service.stop(); await repo.close(); await b.close();
});
it('aperçu en attente puis A→B→A : réponse locale tardive refusée, aucun plan réutilisable', async () => {
  let release, entered;
  const gate = new Promise(resolve => { release = resolve; }), reached = new Promise(resolve => { entered = resolve; });
  const f = fixture({ readLocal: async () => { entered(); await gate; return null; } });
  const pending = f.service.prepare({ personal: ['courses'] });
  const rejected = expect(pending).rejects.toMatchObject({ code: 'identity' }); await reached;
  f.switch(B); f.switch(A); release(); await rejected;
  await expect(f.service.execute({ confirmed: true })).rejects.toMatchObject({ code: 'confirmation' });
  expect(await f.indexedDB.databases()).toEqual([]); f.service.stop();
});
