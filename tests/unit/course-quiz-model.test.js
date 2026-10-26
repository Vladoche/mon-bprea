import { describe, expect, it } from 'vitest';
import { emptyPersonalDocument, mutateCourse, recordPersonalQuiz, prepareNextOperation, acknowledgeOperation, validId, validAttempt,
  reconcileHistory, resolveConflict, projectProgress, validatePersonalDocument } from '../../assets/course-quiz-model.js';
import { getUnitExamStats, recordQuizAttempt } from '../../assets/exam-stats.js';

const userId = '11111111-1111-4111-8111-111111111111';
const scope = JSON.stringify(['development', 'https://fixture.invalid', userId]);
const when = '2026-10-25T12:00:00.000Z';
const uuid = n => `63200000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ids = () => { let n = 1; return () => uuid(n++); };
const fresh = () => emptyPersonalDocument(scope);
const course = (operation, overrides = {}) => ({ user_id: userId, lesson_id: operation.lessonId, done: operation.payload.p_done,
  best_score: operation.payload.p_best_score, legacy_score: operation.payload.p_legacy_score, legacy_total: operation.payload.p_legacy_total,
  operation_id: operation.id, base_revision: operation.expectedRevision, revision: operation.expectedRevision + 1,
  schema_version: 1, created_at: when, updated_at: when, ...overrides });
const quiz = operation => ({ user_id: userId, attempt_id: operation.id, lesson_id: operation.lessonId,
  score: operation.payload.p_score, total: operation.payload.p_total, completed_at: operation.payload.p_completed_at,
  schema_version: 1, created_at: when });
const accept = (doc, op = prepareNextOperation(doc, 0)) => acknowledgeOperation(doc, op.id,
  { status: op.type === 'course' && op.expectedRevision ? 'updated' : 'inserted', row: op.type === 'course' ? course(op) : quiz(op) }, userId);

describe('cours/QCM — intentions, CAS et statistiques', () => {
  it('crée un cours sur la base zéro avec tous les paramètres facultatifs null', () => {
    const doc = fresh(); mutateCourse(doc, 'lecon', true, ids()); const op = prepareNextOperation(doc, 0);
    expect(op.payload).toEqual({ p_lesson_id: 'lecon', p_done: true, p_best_score: null, p_legacy_score: null,
      p_legacy_total: null, p_operation_id: uuid(1), p_expected_revision: 0 });
    accept(doc, op); expect(doc.operations[0].state).toBe('confirmed'); expect(projectProgress(doc).lecon.done).toBe(true);
  });
  it('préserve done:false d’un deuxième appareil malgré un ancien QCM parfait', () => {
    const doc = fresh(); const random = ids(); recordPersonalQuiz(doc, 'lecon', { score: 3, total: 3, completedAt: when }, random);
    accept(doc); accept(doc);
    const remote = course(doc.operations[1], { done: false, operation_id: uuid(40), base_revision: 1, revision: 2 });
    reconcileHistory(doc, { courses: [remote], attempts: [] }, userId, when);
    expect(projectProgress(doc).lecon).toMatchObject({ done: false, score: 3 });
    expect(projectProgress(doc).lecon.quizAttempts).toHaveLength(1);
  });
  it('sérialise trois changements hors ligne avec trois bases et des dépendances stables', () => {
    const doc = fresh(); const random = ids();
    for (const done of [true, false, true]) mutateCourse(doc, 'lecon', done, random);
    const frozen = structuredClone(doc.operations.map(op => op.payload));
    expect(doc.operations.map(op => op.expectedRevision)).toEqual([0, 1, 2]);
    expect(doc.operations.map(op => op.dependsOn)).toEqual([null, uuid(1), uuid(2)]);
    expect(prepareNextOperation(doc, 0).id).toBe(uuid(1));
    accept(doc); expect(prepareNextOperation(doc, 0).id).toBe(uuid(2)); accept(doc); accept(doc);
    expect(doc.remote.courses[0]).toMatchObject({ revision: 3, done: true });
    expect(doc.operations.map(op => op.payload)).toEqual(frozen);
  });
  it('archive la concurrence et bloque ses intentions dépendantes sans bloquer les QCM', () => {
    const doc = fresh(); const random = ids();
    mutateCourse(doc, 'lecon', true, random); mutateCourse(doc, 'lecon', false, random);
    const first = prepareNextOperation(doc, 0);
    acknowledgeOperation(doc, first.id, { status: 'conflict', row: course(first, { operation_id: uuid(50), done: false }) }, userId);
    expect(doc.operations.map(op => op.state)).toEqual(['conflict', 'blocked']);
    expect(doc.conflicts[0]).toMatchObject({ local: { done: false }, remote: { done: false }, resolved: false });
    recordPersonalQuiz(doc, 'lecon', { score: 1, total: 3, completedAt: when }, random);
    expect(prepareNextOperation(doc, 0).type).toBe('quiz');
    expect(projectProgress(doc).lecon.done).toBe(false);
  });
  it('la résolution volontaire crée un nouvel UUID et une base actualisée, garde les archives', () => {
    const doc = fresh(); const random = ids(); mutateCourse(doc, 'lecon', true, random);
    const old = structuredClone(doc.operations[0]);
    acknowledgeOperation(doc, old.id, { status: 'conflict', row: course(old, { operation_id: uuid(40), done: false }) }, userId);
    resolveConflict(doc, doc.conflicts[0].id, 'local', random);
    const op = prepareNextOperation(doc, 0);
    expect(op).toMatchObject({ id: uuid(2), expectedRevision: 1, payload: { p_done: true } });
    expect(doc.operations[0].payload).toEqual(old.payload); expect(doc.conflicts[0].resolved).toBe(true);
    accept(doc); expect(projectProgress(doc).lecon.done).toBe(true);
  });
  it('garder la version du compte ne réémet aucune ancienne intention', () => {
    const doc = fresh(); mutateCourse(doc, 'lecon', true, ids()); const op = doc.operations[0];
    acknowledgeOperation(doc, op.id, { status: 'conflict', row: course(op, { operation_id: uuid(40), done: false }) }, userId);
    resolveConflict(doc, doc.conflicts[0].id, 'remote');
    expect(prepareNextOperation(doc, 0)).toBe(null); expect(projectProgress(doc).lecon.done).toBe(false);
  });
  it('une perte d’acquittement conserve UUID/payload puis une lecture confirme sans doublon', () => {
    const doc = fresh(); recordPersonalQuiz(doc, 'lecon', { score: 2, total: 3, completedAt: when }, ids());
    const op = prepareNextOperation(doc, 0); const before = structuredClone(op);
    expect(prepareNextOperation(doc, 0)).toEqual(before);
    reconcileHistory(doc, { courses: [], attempts: [quiz(op)] }, userId, when);
    expect(doc.operations[0].state).toBe('confirmed'); expect(projectProgress(doc).lecon.quizAttempts).toHaveLength(1);
    reconcileHistory(doc, { courses: [], attempts: [quiz(op)] }, userId, when);
    expect(projectProgress(doc).lecon.quizAttempts).toHaveLength(1);
  });
  it('deux vrais QCM identiques restent distincts et le meilleur score ne diminue pas', () => {
    const doc = fresh(); const random = ids();
    recordPersonalQuiz(doc, 'lecon', { score: 3, total: 3, completedAt: when }, random);
    recordPersonalQuiz(doc, 'lecon', { score: 3, total: 3, completedAt: when }, random);
    recordPersonalQuiz(doc, 'lecon', { score: 1, total: 3, completedAt: when }, random);
    const view = projectProgress(doc).lecon;
    expect(view.score).toBe(3); expect(view.quizAttempts).toHaveLength(3);
    expect(new Set(view.quizAttempts.map(item => item.attemptId)).size).toBe(3);
  });
  it('refuse un UUID réutilisé pour un payload différent sans écraser la tentative', () => {
    const doc = fresh(); const random = ids(); recordPersonalQuiz(doc, 'lecon', { score: 2, total: 3, completedAt: when }, random);
    const before = structuredClone(doc);
    expect(() => recordPersonalQuiz(doc, 'lecon', { score: 1, total: 3, completedAt: when }, () => uuid(1))).toThrow(/UUID/);
    expect(doc).toEqual(before);
  });
  it('un QCM inférieur conserve aussi dans la commande de cours le meilleur score appris des tentatives seules', () => {
    const doc = fresh(); const remote = { user_id: userId, attempt_id: uuid(90), lesson_id: 'lecon', score: 3, total: 3,
      completed_at: when, schema_version: 1, created_at: when };
    reconcileHistory(doc, { courses: [], attempts: [remote] }, userId, when);
    recordPersonalQuiz(doc, 'lecon', { score: 1, total: 3, completedAt: when }, ids());
    const course = doc.operations.find(item => item.type === 'course');
    expect(course.payload).toMatchObject({ p_best_score: 3, p_done: false });
    expect(projectProgress(doc).lecon.score).toBe(3);
  });
  it('refuse un résultat local altéré qui ne correspond plus au payload immuable de son opération', () => {
    const doc = fresh(); recordPersonalQuiz(doc, 'lecon', { score: 1, total: 3, completedAt: when }, ids());
    doc.attempts[uuid(1)].score = 2;
    expect(() => validatePersonalDocument(doc, scope)).toThrow(/illisible/);
  });
  it('un acquittement de tentative ne confirme jamais le changement d’état', () => {
    const doc = fresh(); recordPersonalQuiz(doc, 'lecon', { score: 3, total: 3, completedAt: when }, ids());
    accept(doc);
    expect(doc.operations.map(item => item.state)).toEqual(['confirmed', 'pending']);
    const op = prepareNextOperation(doc, 0);
    acknowledgeOperation(doc, op.id, { status: 'conflict', row: course(op, { operation_id: uuid(40), done: false }) }, userId);
    expect(projectProgress(doc).lecon).toMatchObject({ done: false, score: 3 });
    expect(projectProgress(doc).lecon.quizAttempts).toHaveLength(1);
  });
  it('refuse une réponse incohérente ou étrangère avant de confirmer', () => {
    const doc = fresh(); mutateCourse(doc, 'lecon', true, ids()); const op = prepareNextOperation(doc, 0);
    expect(() => acknowledgeOperation(doc, op.id, { status: 'inserted', row: course(op, { done: false }) }, userId)).toThrow();
    expect(() => acknowledgeOperation(doc, op.id, { status: 'updated', row: course(op) }, userId)).toThrow();
    expect(() => reconcileHistory(doc, { courses: [course(op, { user_id: uuid(99) })], attempts: [] }, userId)).toThrow();
    expect(doc.operations[0].state).toBe('pending');
  });
  it('une ancienne réponse CAS n’écrase jamais une révision déjà plus récente', () => {
    const doc = fresh(); mutateCourse(doc, 'lecon', true, ids()); const op = doc.operations[0];
    accept(doc);
    reconcileHistory(doc, { courses: [course(op, { operation_id: uuid(40), done: false, base_revision: 1, revision: 2 })], attempts: [] }, userId, when);
    reconcileHistory(doc, { courses: [course(op)], attempts: [] }, userId, when);
    expect(doc.remote.courses[0].revision).toBe(2); expect(projectProgress(doc).lecon.done).toBe(false);
  });
  it('un conflit sans ligne n’autorise pas la recréation automatique', () => {
    const doc = fresh(); mutateCourse(doc, 'lecon', true, ids());
    acknowledgeOperation(doc, doc.operations[0].id, { status: 'conflict', row: null }, userId);
    expect(prepareNextOperation(doc, 0)).toBe(null);
    expect(() => resolveConflict(doc, doc.conflicts[0].id, 'local')).toThrow(/Actualise/);
  });
  it('conserve un résultat distant tardif et n’efface rien sur un scan vide', () => {
    const doc = fresh(); recordPersonalQuiz(doc, 'lecon', { score: 2, total: 3, completedAt: when }, ids());
    const op = doc.operations[0]; accept(doc, op);
    reconcileHistory(doc, { courses: [], attempts: [] }, userId, when);
    const late = { ...quiz(op), attempt_id: uuid(99), score: 1, completed_at: '2020-01-01T12:00:00Z' };
    reconcileHistory(doc, { courses: [], attempts: [late] }, userId, when);
    expect(projectProgress(doc).lecon.quizAttempts).toHaveLength(2);
  });
  it('les statistiques personnelles utilisent les mêmes formules que le visiteur', () => {
    const doc = fresh(); const random = ids(); const catalogue = [{ id: 'lecon', unit: 'uc3', quiz: [1, 2, 3] }];
    let visitor;
    for (const score of [3, 1]) { const attempt = { score, total: 3, completedAt: when };
      recordPersonalQuiz(doc, 'lecon', attempt, random); visitor = recordQuizAttempt(visitor, attempt); }
    expect(getUnitExamStats('uc3', catalogue, projectProgress(doc))).toEqual(getUnitExamStats('uc3', catalogue, { lecon: visitor }));
    expect(getUnitExamStats('uc3', catalogue, projectProgress(doc))).toMatchObject({ attemptCount: 2, answeredQuestions: 6, correctAnswers: 4 });
  });
  it('refuse un payload durable altéré et une date civile invalide', () => {
    const doc = fresh(); mutateCourse(doc, 'lecon', true, ids()); doc.operations[0].rpcPayload.p_done = false;
    expect(() => validatePersonalDocument(doc, scope)).toThrow(/illisible/);
    expect(() => recordPersonalQuiz(fresh(), 'lecon', { score: 1, total: 3, completedAt: '2026-02-30T12:00:00Z' }, ids())).toThrow();
  });
  it('préserve les identifiants serveur valides __proto__/constructor sans modifier les prototypes', () => {
    const doc = fresh(); const random = ids();
    for (const lessonId of ['__proto__', 'constructor', 'toString']) {
      mutateCourse(doc, lessonId, true, random);
      accept(doc);
      recordPersonalQuiz(doc, lessonId, { score: 1, total: 3, completedAt: when }, random);
    }
    const progress = projectProgress(doc);
    expect(Object.getPrototypeOf(progress)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(doc.courses)).toBe(Object.prototype);
    expect(Object.keys(progress).sort()).toEqual(['__proto__', 'constructor', 'toString'].sort());
    for (const lessonId of Object.keys(progress)) {
      expect(Object.hasOwn(progress, lessonId)).toBe(true);
      expect(progress[lessonId]).toMatchObject({ done: true, score: 1 });
      expect(progress[lessonId].quizAttempts).toHaveLength(1);
    }
    expect(() => validatePersonalDocument(doc, scope)).not.toThrow();
  });
  it('conserve les identités texte selon les bornes Unicode SQL et refuse les dates hors de la plage distante', () => {
    expect(validId('🌱'.repeat(200))).toBe(true); expect(validId('🌱'.repeat(201))).toBe(false);
    expect(validId(' ancien identifiant ')).toBe(true); expect(validId('\t\n\u00a0')).toBe(false);
    expect(validId('nul\u0000')).toBe(false); expect(validId('\ud800')).toBe(false);
    expect(validAttempt({ score: 1, total: 3, completedAt: '0001-01-01T00:00:00+14:00' })).toBe(false);
    expect(validAttempt({ score: 1, total: 3, completedAt: '9999-12-31T23:59:59-14:00' })).toBe(false);
    expect(validAttempt({ score: 1, total: 3, completedAt: '0001-01-01T00:00:00Z' })).toBe(true);
  });
});
