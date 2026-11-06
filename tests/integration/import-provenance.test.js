import { describe, expect, it, vi } from 'vitest';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import * as courses from '../../assets/course-quiz-service.js';
import * as botanical from '../../assets/botanical-sync-service.js';
import { createCourseQuizRepository } from '../../assets/course-quiz-store.js';
import { createBotanicalRepository } from '../../assets/botanical-personal-store.js';
import { changeErasureScope } from '../../assets/erasure-store.js';
import { readScopedSnapshot } from '../../assets/personal-idb.js';
import { CACHES } from '../../assets/export-sources.js';
import { botanicalSession, PERSONAL_DATA_TIME } from '../fixtures/personal-data.js';
import { MemoryStorage } from '../helpers/memory-storage.js';
import { A, B } from '../fixtures/export.js';

const configuration = { client: {}, environment: 'development', url: 'https://provenance.invalid' };
const scope = id => JSON.stringify([configuration.environment, configuration.url, id]);
const marker = '11000000-0000-4000-8000-000000000009';
const cases = [
  { name: 'cours/QCM', api: courses, create: courses.createCourseQuizService, repository: createCourseQuizRepository,
    database: CACHES.courses, emptyHistory: { courses: [], attempts: [] },
    raw: JSON.stringify({ 'matiere-organique': { done: true, quizAttempts: [{ score: 1, total: 2, completedAt: PERSONAL_DATA_TIME }] } }) },
  { name: 'botanique', api: botanical, create: botanical.createBotanicalService, repository: createBotanicalRepository,
    database: CACHES.botanical, emptyHistory: { sessions: [], answers: [] },
    raw: JSON.stringify({ schemaVersion: 1, sessions: [botanicalSession('provenance-f')], answers: [] }) },
];

function setup(domain) {
  const storage = new MemoryStorage(), indexedDB = new IDBFactory();
  const sourceKey = domain.api.VISITOR_PROGRESS_KEY, provenanceKey = domain.api.IMPORT_PROVENANCE_KEY;
  storage.setItem(sourceKey, domain.raw);
  const read = vi.fn(async () => structuredClone(domain.emptyHistory));
  const send = vi.fn(() => { throw new Error('envoi inattendu'); });
  const services = [];
  function open() {
    let state = { status: 'authenticated', user: { id: A } }; const listeners = new Set();
    const auth = { getState: () => state, subscribe(fn) { listeners.add(fn); fn(state); return () => listeners.delete(fn); } };
    const service = domain.create({ auth, configuration, storage, broadcast: null, schedule: () => 0, cancel() {},
      repositoryFactory: (key, options) => domain.repository(key, { ...options, indexedDB }),
      transportFactory: (_client, _auth, id) => ({ readHistory: () => read(id), send }), now: () => Date.parse(PERSONAL_DATA_TIME) });
    services.push(service);
    return { service, async identity(id, status = 'authenticated') {
      state = { status, user: { id } }; listeners.forEach(fn => fn(state)); await service.start();
    } };
  }
  const persisted = id => readScopedSnapshot(domain.database, scope(id), { indexedDB });
  return { storage, indexedDB, sourceKey, provenanceKey, read, send, open, persisted, stop: () => services.forEach(service => service.stop()) };
}

describe.each(cases)('provenance après panne — $name', domain => {
  it('annule un refus de setItem et un commit avorté après dépôt, puis revalide la source au rechargement', async () => {
    const f = setup(domain);
    try {
      const first = f.open().service;
      await first.start(); await first.synchronize();
      const before = await f.persisted(A);
      const preview = await first.previewImport(); expect(preview.provenance).toBeNull();
      const set = vi.spyOn(f.storage, 'setItem').mockImplementationOnce(() => { throw new DOMException('fixture', 'QuotaExceededError'); });
      const denied = await first.confirmImport(preview); set.mockRestore();
      expect(denied.error).toBeTruthy(); expect(denied.savedLocally).not.toBe(true);
      expect(f.storage.getItem(f.provenanceKey)).toBeNull(); expect(await f.persisted(A)).toEqual(before);

      // Reload the service after the storage error, then abort a real readwrite
      // transaction once the accounts put has been queued with its manifest.
      first.stop(); const second = f.open().service; await second.start();
      const originalPut = IDBObjectStore.prototype.put;
      let staged;
      const abort = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (record, key) {
        const request = originalPut.call(this, record, key);
        if (this.name === 'accounts' && record.imports.length) {
          staged = { marker: f.storage.getItem(f.provenanceKey), provenance: record.imports[0].provenance };
          this.transaction.abort();
        }
        return request;
      });
      let aborted;
      try { aborted = await second.confirmImport(await second.previewImport()); }
      finally { abort.mockRestore(); }
      expect(aborted.error).toBeTruthy(); expect(aborted.savedLocally).not.toBe(true);
      const orphan = f.storage.getItem(f.provenanceKey);
      expect(orphan).toMatch(/^[0-9a-f-]{36}$/); expect(await f.persisted(A)).toEqual(before);
      expect(staged).toEqual({ marker: orphan, provenance: orphan });
      expect(f.storage.getItem(f.sourceKey)).toBe(domain.raw); expect(f.send).not.toHaveBeenCalled();

      second.stop(); const reloaded = f.open().service; await reloaded.start();
      const stale = await reloaded.previewImport(); expect(stale.provenance).toBe(orphan);
      f.read.mockImplementationOnce(async () => {
        f.storage.setItem(f.sourceKey, domain.raw + ' ');
        return structuredClone(domain.emptyHistory);
      });
      expect((await reloaded.confirmImport(stale)).error).toMatch(/changé/);
      expect(await f.persisted(A)).toEqual(before);
      const current = await reloaded.previewImport(); expect(current.raw).toBe(domain.raw + ' ');
      expect(await reloaded.confirmImport(current)).toMatchObject({ error: null, replayed: false, savedLocally: true });
      const imported = await f.persisted(A);
      expect(imported.document.imports).toHaveLength(1);
      expect(imported.document.imports[0]).toMatchObject({ provenance: orphan, raw: current.raw });
      expect(imported.document.operations.length).toBeGreaterThan(0);
      expect(await reloaded.confirmImport(current)).toMatchObject({ error: null, replayed: true, savedLocally: true });
      expect(await f.persisted(A)).toEqual(imported); expect(await f.persisted(B)).toEqual({ document: null, privacy: null });
    } finally { f.stop(); }
  });

  it('un ancien instantané en mémoire n’autorise aucun nouvel import hors ligne si le manifeste durable manque', async () => {
    const f = setup(domain);
    try {
      const { service, identity } = f.open(); await service.start(); await service.synchronize();
      const before = (await f.persisted(A)).document;
      expect(await service.confirmImport(await service.previewImport())).toMatchObject({ error: null, replayed: false });
      await identity(A, 'offline');
      const preview = await service.previewImport();
      const repo = domain.repository(scope(A), { indexedDB: f.indexedDB });
      // Simulate an external change of this synthetic record while the service
      // still holds the previously committed manifest in memory.
      await repo.change(saved => Object.assign(saved, before)); await repo.close();
      const result = await service.confirmImport(preview);
      expect(result.error).toMatch(/vérifi|manifeste/); expect(result.savedLocally).not.toBe(true);
      expect((await f.persisted(A)).document).toEqual(before); expect(f.send).not.toHaveBeenCalled();
    } finally { f.stop(); }
  });

  it('un UUID seul n’autorise rien hors ligne et une lecture tardive de A échoue après A–B–A', async () => {
    const f = setup(domain); f.storage.setItem(f.provenanceKey, marker);
    let release;
    try {
      const { service, identity } = f.open(); await service.start(); await service.synchronize();
      const forA = await service.previewImport();
      f.read.mockImplementationOnce(() => new Promise(resolve => { release = () => resolve(structuredClone(domain.emptyHistory)); }));
      const first = service.confirmImport(forA);
      await vi.waitFor(() => expect(release).toBeTypeOf('function'));
      await identity(B); await service.synchronize(); await identity(B, 'offline');
      expect((await service.confirmImport(forA)).error).toMatch(/pour ce compte/);
      const forB = await service.previewImport(); expect(forB.provenance).toBe(marker);
      f.read.mockClear();
      expect((await service.confirmImport(forB)).error).toMatch(/connexion/);
      expect(f.read).not.toHaveBeenCalled();
      await identity(A); release();
      expect((await first).error).toMatch(/compte a changé/);
      expect((await service.confirmImport(forA)).error).toMatch(/pour ce compte/);
      for (const id of [A, B]) expect((await f.persisted(id)).document).toMatchObject({ imports: [], operations: [] });

      await identity(B);
      expect(await service.confirmImport(await service.previewImport())).toMatchObject({ error: null, replayed: false });
      expect(f.read).toHaveBeenCalledWith(B);
      const savedB = await f.persisted(B);
      expect(savedB.document.imports[0].provenance).toBe(marker);
      await identity(B, 'offline'); f.read.mockClear();
      expect(await service.confirmImport(await service.previewImport())).toMatchObject({ error: null, replayed: true });
      expect(f.read).not.toHaveBeenCalled();
      await identity(A);
      expect((await f.persisted(A)).document).toMatchObject({ imports: [], operations: [] });
      expect(await f.persisted(B)).toEqual(savedB);
      expect(f.send).not.toHaveBeenCalled();
    } finally { release?.(); f.stop(); }
  });

  it('la barrière du compte interdit à une confirmation en vol de recréer son cache', async () => {
    const f = setup(domain); f.storage.setItem(f.provenanceKey, marker);
    let release;
    try {
      const service = f.open().service; await service.start(); await service.synchronize();
      const preview = await service.previewImport();
      f.read.mockImplementationOnce(() => new Promise(resolve => { release = () => resolve(structuredClone(domain.emptyHistory)); }));
      const pending = service.confirmImport(preview);
      await vi.waitFor(() => expect(release).toBeTypeOf('function'));
      const { document } = await f.persisted(A);
      await changeErasureScope(domain.database, scope(A), { indexedDB: f.indexedDB, expected: JSON.stringify(document) });
      release(); expect((await pending).error).toBeTruthy();
      expect(await f.persisted(A)).toMatchObject({ document: null, privacy: { blocked: true } });
      expect(f.storage.getItem(f.provenanceKey)).toBe(marker); expect(f.send).not.toHaveBeenCalled();
    } finally { release?.(); f.stop(); }
  });
});
