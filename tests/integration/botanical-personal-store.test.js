import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { createBotanicalRepository, personalScope, PERSONAL_BOTANICAL_DB } from '../../assets/botanical-personal-store.js';
import { recordPersonalSession, recordPersonalAnswer, completePersonalSession, projectHistory, reconcileHistory, validatePersonalDocument } from '../../assets/botanical-sync-model.js';
import { previewLegacyImport, applyLegacyImport } from '../../assets/botanical-import.js';
import { botanicalSession, botanicalAnswer, PERSONAL_DATA_TIME as when } from '../fixtures/personal-data.js';
import { MemoryStorage } from '../helpers/memory-storage.js';

const userId = '11111111-1111-4111-8111-111111111111';
const identity = { environment: 'development', url: 'https://fixture.invalid', userId }; const scope = personalScope(identity);
const uuid = n => `63300000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ids = () => { let n = 1; return () => uuid(n++); };
const end = '2026-10-21T12:01:00.000Z';
const source = () => {
  const a = botanicalSession('source-a', { completedAt: end }); const b = botanicalSession('source-b');
  return JSON.stringify({ schemaVersion: 1, sessions: [a, b], answers: [botanicalAnswer(a), botanicalAnswer(b), botanicalAnswer(botanicalSession('orpheline'))], historicalField: { preserve: true } });
};
let indexedDB;
beforeEach(() => { indexedDB = new IDBFactory(); });
async function verified(repo) { await repo.change(doc => reconcileHistory(doc, { sessions: [], answers: [] }, userId, when)); }

describe('cache botanique personnel et import atomique', () => {
  it('isole UUID, projet, environnement et source visiteur sans import automatique', async () => {
    const storage = new MemoryStorage(); const raw = source(); storage.setItem('monbprea.botanical.v1', raw); vi.stubGlobal('localStorage', storage);
    const repo = createBotanicalRepository(scope, { indexedDB }); await repo.change(doc => recordPersonalSession(doc, botanicalSession(), ids()));
    for (const other of [{ ...identity, userId: uuid(90) }, { ...identity, environment: 'production' }, { ...identity, url: 'https://other.invalid' }]) {
      const saved = await createBotanicalRepository(personalScope(other), { indexedDB }).read();
      expect(projectHistory(saved)).toMatchObject({ sessions: [], answers: [] }); expect(saved.imports).toEqual([]);
    }
    expect(storage.getItem('monbprea.botanical.v1')).toBe(raw); expect((await repo.read()).imports).toEqual([]);
  });
  it('fermer/recharger garde création, réponses et complétion avec mêmes UUID et dépendances', async () => {
    const repo = createBotanicalRepository(scope, { indexedDB }); const random = ids(); const session = botanicalSession();
    await repo.change(doc => recordPersonalSession(doc, session, random));
    await repo.change(doc => recordPersonalAnswer(doc, botanicalAnswer(session), random));
    await repo.change(doc => completePersonalSession(doc, session.id, end, random));
    const before = await repo.read(); await repo.close(); const after = await createBotanicalRepository(scope, { indexedDB }).read();
    expect(after).toEqual(before); expect(after.operations).toHaveLength(3); expect(projectHistory(after).answers).toHaveLength(1);
    expect(after.operations[2].dependsOn).toEqual(after.operations.slice(0, 2).map(op => op.id));
  });
  it('une transaction échouée annule réponse ET outbox avant toute annonce de sauvegarde', async () => {
    const onCommit = vi.fn(); const repo = createBotanicalRepository(scope, { indexedDB, onCommit }); const random = ids(); const session = botanicalSession();
    await repo.change(doc => recordPersonalSession(doc, session, random)); const before = await repo.read(); onCommit.mockClear();
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => { throw new DOMException('plein', 'QuotaExceededError'); });
    await expect(repo.change(doc => recordPersonalAnswer(doc, botanicalAnswer(session), random))).rejects.toMatchObject({ code: 'local_storage' });
    put.mockRestore(); expect(await repo.read()).toEqual(before); expect(onCommit).not.toHaveBeenCalled();
  });
  it('sérialise deux onglets sans perdre deux questions distinctes de la même plante', async () => {
    const a = createBotanicalRepository(scope, { indexedDB }); const b = createBotanicalRepository(scope, { indexedDB }); const random = ids(); const session = botanicalSession();
    await a.change(doc => recordPersonalSession(doc, session, random));
    await Promise.all([a.change(doc => recordPersonalAnswer(doc, botanicalAnswer(session, 1), random)), b.change(doc => recordPersonalAnswer(doc, botanicalAnswer(session, 2), random))]);
    const saved = await a.read(); expect(projectHistory(saved).answers).toHaveLength(2); expect(saved.operations).toHaveLength(3);
  });
  it('prévisualiser ou annuler ne crée ni manifeste ni opération personnelle', async () => {
    const repo = createBotanicalRepository(scope, { indexedDB }); const before = await repo.read(); const preview = previewLegacyImport(source());
    expect(preview.summary).toEqual({ sessions: 2, answers: 2, refused: 1 }); expect(preview.warnings.join(' ')).toMatch(/sans session/);
    expect(await repo.read()).toEqual(before);
  });
  it('importe volontairement les données compatibles et conserve provenance, champs inconnus et orphelin brut', async () => {
    const repo = createBotanicalRepository(scope, { indexedDB }); await verified(repo); const raw = source();
    await repo.change(doc => applyLegacyImport(doc, { raw, provenance: uuid(50) }, ids()));
    const saved = await repo.read(); const manifest = saved.imports[0];
    expect(manifest.raw).toBe(raw); expect(JSON.parse(manifest.raw).historicalField).toEqual({ preserve: true });
    expect(manifest.sessionIds).toEqual({ 0: 'source-a', 1: 'source-b' }); expect(Object.values(manifest.questionIds)).toEqual(['source-a-q1', 'source-b-q1']);
    expect(projectHistory(saved).answers).toHaveLength(2); expect(projectHistory(saved).sessions).toHaveLength(2);
    expect(saved.operations.map(op => op.type)).toEqual(['session', 'answer', 'completion', 'session', 'answer']);
    expect(saved.operations.some(op => op.sessionId === 'orpheline')).toBe(false);
  });
  it('reprend le même import interrompu avec le manifeste et toutes les opérations inchangés', async () => {
    const repo = createBotanicalRepository(scope, { indexedDB }); await verified(repo); const input = { raw: source(), provenance: uuid(50) };
    await repo.change(doc => applyLegacyImport(doc, input, ids())); const before = await repo.read(); await repo.close();
    const reopened = createBotanicalRepository(scope, { indexedDB });
    const result = await reopened.change(doc => applyLegacyImport(doc, input, () => { throw new Error('pas de nouvel UUID'); }));
    expect(result.replayed).toBe(true); expect(await reopened.read()).toEqual(before);
  });
  it('annule manifeste et opérations ensemble si stockage plein', async () => {
    const repo = createBotanicalRepository(scope, { indexedDB }); await verified(repo); const before = await repo.read();
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => { throw new DOMException('plein', 'QuotaExceededError'); });
    await expect(repo.change(doc => applyLegacyImport(doc, { raw: source(), provenance: uuid(50) }, ids()))).rejects.toMatchObject({ code: 'local_storage' });
    put.mockRestore(); expect(await repo.read()).toEqual(before);
  });
  it('refuse import sans lecture distante, autre provenance, instantané modifié ou collision métier', async () => {
    const repo = createBotanicalRepository(scope, { indexedDB }); const input = { raw: source(), provenance: uuid(50) };
    await expect(repo.change(doc => applyLegacyImport(doc, input, ids()))).rejects.toMatchObject({ code: 'import_unverified' });
    await verified(repo); await repo.change(doc => applyLegacyImport(doc, input, ids())); const before = await repo.read();
    let n = 100; const archiveUUID = () => uuid(n++);
    for (const altered of [{ ...input, raw: input.raw + ' ' }, { ...input, provenance: uuid(51) }]) expect(await repo.change(doc => applyLegacyImport(doc, altered, archiveUUID))).toMatchObject({ errorCode: 'import_ambiguous', rejected: true, archived: true });
    const archived = await repo.read(); expect(archived.operations).toEqual(before.operations); expect(archived.imports).toEqual(before.imports);
    expect(archived.importArchives).toHaveLength(2); expect(archived.importArchives[0].raw).toBe(input.raw + ' ');
    const retry = await repo.change(doc => applyLegacyImport(doc, { ...input, raw: input.raw + ' ' }, () => { throw new Error('aucun nouvel UUID'); }));
    expect(retry.archiveId).toBe(archived.importArchives[0].id); expect((await repo.read()).importArchives).toEqual(archived.importArchives);
    const other = createBotanicalRepository(scope, { indexedDB: new IDBFactory() }); await verified(other);
    await other.change(doc => recordPersonalSession(doc, botanicalSession('source-a'), ids()));
    expect(await other.change(doc => applyLegacyImport(doc, input, archiveUUID))).toMatchObject({ errorCode: 'import_ambiguous', rejected: true });
    expect((await other.read()).importArchives).toHaveLength(1);
  });
  it('format futur, JSON corrompu et documents invalides restent intacts et non importables', () => {
    for (const raw of ['{invalide', 'null', '[]', '{"schemaVersion":999,"sessions":[],"answers":[]}']) {
      const preview = previewLegacyImport(raw); expect(preview.raw).toBe(raw); expect(preview.available).toBe(false); expect(preview.error).toBeTruthy();
    }
  });
  it('refuse toutes occurrences d’identités ambiguës et dates incompatibles sans inventer de session', () => {
    const session = botanicalSession(); const answer = botanicalAnswer(session);
    const duplicate = previewLegacyImport(JSON.stringify({ schemaVersion: 1, sessions: [session], answers: [answer, answer] }));
    expect(duplicate.summary).toEqual({ sessions: 1, answers: 0, refused: 2 });
    const wrong = previewLegacyImport(JSON.stringify({ schemaVersion: 1, sessions: [{ ...session, completedAt: when }], answers: [{ ...answer, answeredAt: end }] }));
    expect(wrong.summary).toEqual({ sessions: 1, answers: 0, refused: 1 });
  });
  it('un manifeste dont la position source a été altérée bloque le cache', async () => {
    const repo = createBotanicalRepository(scope, { indexedDB }); await verified(repo); await repo.change(doc => applyLegacyImport(doc, { raw: source(), provenance: uuid(50) }, ids()));
    const saved = await repo.read(); saved.imports[0].questionIds['99'] = 'source-a-q1';
    expect(() => validatePersonalDocument(saved, scope)).toThrow(/illisible/);
    const changed = await repo.read(); const raw = JSON.parse(changed.imports[0].raw); raw.sessions[0].durationSeconds = 50; changed.imports[0].raw = JSON.stringify(raw);
    expect(() => validatePersonalDocument(changed, scope)).toThrow(/illisible/);
  });
  it('cache futur reste physiquement inchangé et identité invalidée ne peut pas écrire', async () => {
    const repo = createBotanicalRepository(scope, { indexedDB }); await repo.read();
    await expect(repo.change(doc => recordPersonalSession(doc, botanicalSession(), ids()), () => false)).rejects.toThrow(/compte/);
    const request = indexedDB.open(PERSONAL_BOTANICAL_DB); const db = await new Promise(resolve => { request.onsuccess = () => resolve(request.result); });
    const future = { version: 999, scope, preserve: ['ne pas effacer'] };
    await new Promise(resolve => { const tx = db.transaction('accounts', 'readwrite'); tx.objectStore('accounts').put(future, scope); tx.oncomplete = resolve; });
    await expect(repo.read()).rejects.toThrow(/illisible/); await expect(repo.change(doc => recordPersonalSession(doc, botanicalSession(), ids()))).rejects.toThrow();
    const raw = await new Promise(resolve => { const get = db.transaction('accounts').objectStore('accounts').get(scope); get.onsuccess = () => resolve(get.result); });
    expect(raw).toEqual(future); db.close();
  });
});
