import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { createCourseQuizRepository, personalScope, PERSONAL_COURSE_QUIZ_DB } from '../../assets/course-quiz-store.js';
import { mutateCourse, recordPersonalQuiz, projectProgress, reconcileHistory, validatePersonalDocument } from '../../assets/course-quiz-model.js';
import { previewLegacyImport, applyLegacyImport } from '../../assets/course-quiz-import.js';
import { MemoryStorage } from '../helpers/memory-storage.js';

const userId = '11111111-1111-4111-8111-111111111111';
const identity = { environment: 'development', url: 'https://fixture.invalid', userId };
const scope = personalScope(identity);
const when = '2026-10-25T12:00:00.000Z';
const uuid = n => `63200000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ids = () => { let n = 1; return () => uuid(n++); };
const catalogue = [{ id: 'lecon', unit: 'uc3', quiz: [1, 2, 3] }];
const source = () => JSON.stringify({ lecon: { done: false, score: 3, legacyQuizScore: { score: 2, total: 3 },
  quizAttempts: [{ score: 3, total: 3, completedAt: when }, { score: 3, total: 3, completedAt: when }, { mystery: true }],
  quizAttemptsArchive: ['archaïque'], quizScoreArchive: [-1], progressArchive: ['brut'], future: { preserve: true } },
  progressArchive: ['chaîne racine'] });
let indexedDB;
beforeEach(() => { indexedDB = new IDBFactory(); });

describe('cours/QCM — cache personnel atomique et import volontaire', () => {
  it('isole les comptes, projets et environnements et laisse le visiteur intact', async () => {
    const storage = new MemoryStorage(); const raw = source(); storage.setItem('bprea-demo-progress-v1', raw); vi.stubGlobal('localStorage', storage);
    const a = createCourseQuizRepository(scope, { indexedDB });
    await a.change(doc => recordPersonalQuiz(doc, 'lecon', { score: 2, total: 3, completedAt: when }, ids()));
    for (const other of [{ ...identity, userId: uuid(90) }, { ...identity, url: 'https://other.invalid' }, { ...identity, environment: 'production' }]) {
      const repo = createCourseQuizRepository(personalScope(other), { indexedDB });
      expect(projectProgress(await repo.read())).toEqual({}); expect((await repo.read()).imports).toEqual([]);
    }
    expect(projectProgress(await a.read()).lecon.quizAttempts).toHaveLength(1); expect(storage.getItem('bprea-demo-progress-v1')).toBe(raw);
  });
  it('fermeture/rechargement conserve tentative, UUID, payload et outbox ensemble', async () => {
    const repo = createCourseQuizRepository(scope, { indexedDB });
    await repo.change(doc => recordPersonalQuiz(doc, 'lecon', { score: 3, total: 3, completedAt: when }, ids()));
    const before = await repo.read(); await repo.close();
    const after = await createCourseQuizRepository(scope, { indexedDB }).read();
    expect(after).toEqual(before); expect(after.operations).toHaveLength(2);
    expect(after.operations[0].id).toBe(Object.keys(after.attempts)[0]); expect(after.operations[1].type).toBe('course');
  });
  it('un put plein annule le QCM ET son opération sans annoncer de sauvegarde', async () => {
    const repo = createCourseQuizRepository(scope, { indexedDB }); const onCommit = vi.fn();
    const notify = createCourseQuizRepository(scope, { indexedDB, onCommit }); const before = await repo.read();
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => { throw new DOMException('plein', 'QuotaExceededError'); });
    await expect(notify.change(doc => recordPersonalQuiz(doc, 'lecon', { score: 3, total: 3, completedAt: when }, ids()))).rejects.toMatchObject({ code: 'local_storage' });
    put.mockRestore(); expect(await repo.read()).toEqual(before); expect(onCommit).not.toHaveBeenCalled();
  });
  it('sérialise deux onglets sans perdre deux vrais QCM identiques', async () => {
    const a = createCourseQuizRepository(scope, { indexedDB }); const b = createCourseQuizRepository(scope, { indexedDB }); const random = ids();
    await Promise.all([a, b].map(repo => repo.change(doc => recordPersonalQuiz(doc, 'lecon', { score: 1, total: 3, completedAt: when }, random))));
    const doc = await a.read(); expect(projectProgress(doc).lecon.quizAttempts).toHaveLength(2);
    expect(doc.operations.filter(item => item.type === 'quiz')).toHaveLength(2);
  });
  it('refuse stockage absent ou identité invalidée avant la transaction', async () => {
    await expect(createCourseQuizRepository(scope, { indexedDB: null }).read()).rejects.toMatchObject({ code: 'local_storage' });
    const repo = createCourseQuizRepository(scope, { indexedDB }); const before = await repo.read();
    await expect(repo.change(doc => mutateCourse(doc, 'lecon', true, ids()), () => false)).rejects.toThrow(/compte/);
    expect(await repo.read()).toEqual(before);
  });
  it('ne lance jamais un import pendant la simple lecture du compte', async () => {
    const storage = new MemoryStorage(); storage.setItem('bprea-demo-progress-v1', source()); vi.stubGlobal('localStorage', storage);
    const repo = createCourseQuizRepository(scope, { indexedDB }); const doc = await repo.read();
    expect(doc.imports).toEqual([]); expect(doc.operations).toEqual([]); expect(projectProgress(doc)).toEqual({});
    const preview = previewLegacyImport(source(), catalogue);
    expect(preview.summary).toEqual({ courses: 0, attempts: 2, legacyScores: 1 }); expect(preview.warnings).toHaveLength(2);
    expect((await repo.read()).imports).toEqual([]);
  });
  it('importe deux entrées identiques par leurs positions et conserve toutes les archives brutes', async () => {
    const repo = createCourseQuizRepository(scope, { indexedDB }); const raw = source();
    await repo.change(doc => applyLegacyImport(doc, { raw, provenance: uuid(50), catalogue }, ids()));
    const doc = await repo.read(); const manifest = doc.imports[0];
    expect(manifest.raw).toBe(raw); expect(JSON.parse(manifest.raw)).toMatchObject({ progressArchive: ['chaîne racine'], lecon: { future: { preserve: true } } });
    const positions = Object.keys(manifest.attemptIds); expect(positions).toEqual(['["lecon","quizAttempts",0]', '["lecon","quizAttempts",1]']);
    expect(new Set(Object.values(manifest.attemptIds)).size).toBe(2);
    expect(projectProgress(doc).lecon).toMatchObject({ done: false, score: 3, legacyQuizScore: { score: 2, total: 3 } });
    expect(projectProgress(doc).lecon.quizAttempts).toHaveLength(2);
    expect(doc.operations.every(item => !JSON.stringify(item.payload).includes('archaïque'))).toBe(true);
  });
  it('reprend un import interrompu après rechargement avec exactement le même manifeste et les mêmes UUID', async () => {
    const repo = createCourseQuizRepository(scope, { indexedDB }); const input = { raw: source(), provenance: uuid(50), catalogue };
    await repo.change(doc => applyLegacyImport(doc, input, ids())); const before = await repo.read(); await repo.close();
    const reopened = createCourseQuizRepository(scope, { indexedDB });
    const result = await reopened.change(doc => applyLegacyImport(doc, input, () => { throw new Error('aucun UUID nouveau'); }));
    expect(result.replayed).toBe(true); expect(await reopened.read()).toEqual(before);
  });
  it('un échec de stockage annule aussi le manifeste et toutes les correspondances UUID', async () => {
    const repo = createCourseQuizRepository(scope, { indexedDB }); const before = await repo.read();
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => { throw new DOMException('plein', 'QuotaExceededError'); });
    await expect(repo.change(doc => applyLegacyImport(doc, { raw: source(), provenance: uuid(50), catalogue }, ids()))).rejects.toMatchObject({ code: 'local_storage' });
    put.mockRestore(); expect(await repo.read()).toEqual(before);
  });
  it('refuse une copie sans provenance commune ou un instantané modifié sans aucune fusion', async () => {
    const repo = createCourseQuizRepository(scope, { indexedDB }); const input = { raw: source(), provenance: uuid(50), catalogue };
    await repo.change(doc => applyLegacyImport(doc, input, ids())); const before = await repo.read();
    for (const changed of [{ ...input, provenance: uuid(51) }, { ...input, raw: input.raw + ' ' }])
      await expect(repo.change(doc => applyLegacyImport(doc, changed, ids()))).rejects.toMatchObject({ code: 'import_ambiguous' });
    expect(await repo.read()).toEqual(before);
  });
  it('refuse une correspondance de manifeste pointant une mauvaise position ou un autre UUID', async () => {
    const repo = createCourseQuizRepository(scope, { indexedDB });
    await repo.change(doc => applyLegacyImport(doc, { raw: source(), provenance: uuid(50), catalogue }, ids()));
    const saved = await repo.read(); const manifest = saved.imports[0]; const positions = Object.keys(manifest.attemptIds);
    manifest.attemptIds[positions[1]] = manifest.attemptIds[positions[0]];
    expect(() => validatePersonalDocument(saved, scope)).toThrow(/illisible/);
    const changed = await repo.read(); const first = changed.imports[0];
    first.attemptIds['["lecon","quizAttempts",99]'] = first.attemptIds[positions[0]]; delete first.attemptIds[positions[0]];
    expect(() => validatePersonalDocument(changed, scope)).toThrow(/illisible/);
  });
  it('refuse un document illisible sans modifier sa chaîne d’origine', async () => {
    for (const raw of ['{invalide', 'null', '[]', '{"lecon":{"score":"trois","quizAttempts":"ancien"}}']) {
      const preview = previewLegacyImport(raw, catalogue); expect(preview.available).toBe(false); expect(preview.error).toBeTruthy();
      expect(preview.raw).toBe(raw);
    }
  });
  it('refuse sur un nouvel appareil une copie historique lorsque le compte a déjà des tentatives sans manifeste local', async () => {
    const repo = createCourseQuizRepository(scope, { indexedDB });
    const remote = { user_id: userId, attempt_id: uuid(60), lesson_id: 'lecon', score: 3, total: 3,
      completed_at: when, schema_version: 1, created_at: when };
    await repo.change(doc => reconcileHistory(doc, { courses: [], attempts: [remote] }, userId, when));
    const before = await repo.read();
    await expect(repo.change(doc => applyLegacyImport(doc, { raw: source(), provenance: uuid(50), catalogue }, ids())))
      .rejects.toMatchObject({ code: 'import_ambiguous' });
    expect(await repo.read()).toEqual(before);
  });
  it('n’invente ni tentative ni date depuis un score ancien seul', async () => {
    const repo = createCourseQuizRepository(scope, { indexedDB });
    await repo.change(doc => applyLegacyImport(doc, { raw: '{"lecon":{"score":2}}', provenance: uuid(50), catalogue }, ids()));
    const doc = await repo.read(); expect(Object.keys(doc.attempts)).toHaveLength(0);
    expect(doc.remote.attempts).toHaveLength(0); expect(doc.operations).toHaveLength(1);
    expect(doc.operations[0].payload).toMatchObject({ p_best_score: 2, p_legacy_score: null, p_legacy_total: null });
  });
  it('un score actuel issu des tentatives n’est pas présenté comme score ancien sans date', () => {
    const preview = previewLegacyImport(JSON.stringify({ lecon: { score: 3, quizAttempts: [{ score: 3, total: 3, completedAt: when }] } }), catalogue);
    expect(preview.summary).toEqual({ courses: 0, attempts: 1, legacyScores: 0 });
  });
  it('archive sans arrondir une ancienne date plus précise que les microsecondes et importe seulement l’entrée exploitable', async () => {
    const raw = JSON.stringify({ lecon: { done: false, quizAttempts: [
      { score: 2, total: 3, completedAt: '2026-10-25T12:00:00.1234567Z' },
      { score: 1, total: 3, completedAt: when },
    ] } });
    const preview = previewLegacyImport(raw, catalogue);
    expect(preview.summary.attempts).toBe(1); expect(preview.warnings.join(' ')).toMatch(/plus de six décimales/);
    const repo = createCourseQuizRepository(scope, { indexedDB });
    await repo.change(doc => applyLegacyImport(doc, { raw, provenance: uuid(50), catalogue }, ids()));
    const doc = await repo.read(); expect(doc.imports[0].raw).toBe(raw);
    expect(Object.keys(doc.imports[0].attemptIds)).toEqual(['["lecon","quizAttempts",1]']);
    expect(Object.values(doc.attempts)).toHaveLength(1); expect(Object.values(doc.attempts)[0].completedAt).toBe(when);
  });
  it('un ancien done:true importé ne réactive pas silencieusement un cours décoché du compte', async () => {
    const repo = createCourseQuizRepository(scope, { indexedDB });
    const remote = { user_id: userId, lesson_id: 'lecon', done: false, best_score: 3, legacy_score: null, legacy_total: null,
      operation_id: uuid(60), base_revision: 0, revision: 1, schema_version: 1, created_at: when, updated_at: when };
    await repo.change(doc => reconcileHistory(doc, { courses: [remote], attempts: [] }, userId, when));
    await repo.change(doc => applyLegacyImport(doc, { raw: '{"lecon":{"done":true,"score":3}}', provenance: uuid(50), catalogue }, ids()));
    const doc = await repo.read(); expect(projectProgress(doc).lecon.done).toBe(false);
    expect(doc.conflicts[0]).toMatchObject({ local: { done: true }, remote: { done: false }, resolved: false });
    expect(doc.operations[0].state).toBe('conflict');
  });
  it('un cache corrompu reste intact et bloque lecture et écriture', async () => {
    const repo = createCourseQuizRepository(scope, { indexedDB }); await repo.read();
    const request = indexedDB.open(PERSONAL_COURSE_QUIZ_DB, 1);
    const db = await new Promise(resolve => { request.onsuccess = () => resolve(request.result); });
    const corrupt = { version: 999, scope, preserve: ['aucune perte'] };
    await new Promise(resolve => { const tx = db.transaction('accounts', 'readwrite'); tx.objectStore('accounts').put(corrupt, scope); tx.oncomplete = resolve; });
    await expect(repo.read()).rejects.toThrow(/illisible/); await expect(repo.change(doc => mutateCourse(doc, 'lecon', true, ids()))).rejects.toThrow();
    const unchanged = await new Promise(resolve => { const get = db.transaction('accounts').objectStore('accounts').get(scope); get.onsuccess = () => resolve(get.result); });
    expect(unchanged).toEqual(corrupt); db.close();
  });
  it('refuse les dépendances cycliques ou désordonnées avant tout parcours de file', async () => {
    const repo = createCourseQuizRepository(scope, { indexedDB }); const random = ids();
    await repo.change(doc => { mutateCourse(doc, 'lecon', true, random); mutateCourse(doc, 'lecon', false, random); });
    const doc = await repo.read();
    doc.operations[0].dependsOn = doc.operations[1].id;
    expect(() => validatePersonalDocument(doc, scope)).toThrow(/illisible/);
    doc.operations[0].dependsOn = doc.operations[0].id;
    expect(() => validatePersonalDocument(doc, scope)).toThrow(/illisible/);
  });
});
