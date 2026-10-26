import { describe, expect, it } from 'vitest';
import { calculateStats, getRevisionSpeciesIds } from '../../assets/botanical-engine.js';
import { botanicalSession, botanicalAnswer, PERSONAL_DATA_TIME as when } from '../fixtures/personal-data.js';
import { personalScope } from '../../assets/botanical-personal-store.js';
import { emptyPersonalDocument, recordPersonalSession, recordPersonalAnswer, completePersonalSession, projectHistory,
  prepareNextOperation, acknowledgeOperation, reconcileHistory, resolveConflict, validatePersonalDocument,
  normalizeTimestamp, rejectOperation, clone } from '../../assets/botanical-sync-model.js';

const userId = '11111111-1111-4111-8111-111111111111';
const scope = personalScope({ environment: 'development', url: 'https://fixture.invalid', userId });
const uuid = n => `63300000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ids = () => { let n = 1; return () => uuid(n++); };
const end = '2026-10-21T12:01:00.000Z';
function sessionRow(operation, overrides = {}) {
  const session = operation.payload.p_session;
  return { user_id: userId, session_id: session.id, category_id: session.categoryId, mode: session.mode, duration_seconds: session.durationSeconds,
    is_revision: session.revision, started_at: session.startedAt, total_questions: session.totalQuestions, completed_at: session.completedAt,
    operation_id: operation.id, base_revision: operation.expectedRevision, revision: operation.expectedRevision + 1,
    schema_version: 1, created_at: when, updated_at: when, ...overrides };
}
function answerRow(operation, overrides = {}) {
  const answer = operation.payload.p_answer;
  return { user_id: userId, answer_id: answer.id, session_id: answer.sessionId, question_id: answer.questionId, category_id: answer.categoryId,
    species_id: answer.speciesId, photo_id: answer.photoId, mode: answer.mode, is_revision: answer.revision, status: answer.status,
    selected_species_id: answer.selectedSpeciesId, correct: answer.correct, elapsed_ms: answer.elapsedMs, answered_at: answer.answeredAt,
    schema_version: 1, created_at: when, ...overrides };
}
function acknowledge(doc, operation) {
  acknowledgeOperation(doc, operation.id, { status: operation.type === 'completion' ? 'updated' : 'inserted',
    row: operation.type === 'answer' ? answerRow(operation) : sessionRow(operation) }, userId);
}

describe('botanique personnelle — identités, dépendances et réconciliation', () => {
  it('envoie création puis réponses puis fin réelle même entièrement hors ligne', () => {
    const doc = emptyPersonalDocument(scope); const random = ids(); const session = botanicalSession();
    recordPersonalSession(doc, session, random);
    recordPersonalAnswer(doc, botanicalAnswer(session, 1), random);
    recordPersonalAnswer(doc, botanicalAnswer(session, 2, { status: 'incorrect', correct: false, selectedSpeciesId: 'groseillier' }), random);
    completePersonalSession(doc, session.id, end, random);
    expect(doc.operations.map(op => op.type)).toEqual(['session', 'answer', 'answer', 'completion']);
    expect(doc.operations[3].dependsOn).toEqual(doc.operations.slice(0, 3).map(op => op.id));
    expect(doc.operations[3].expectedRevision).toBe(1); expect(doc.operations[3].payload.p_session.revision).toBe(false);
    for (const expected of ['session', 'answer', 'answer', 'completion']) {
      const next = prepareNextOperation(doc); expect(next.type).toBe(expected); acknowledge(doc, next); validatePersonalDocument(doc, scope);
    }
    expect(prepareNextOperation(doc)).toBe(null);
    expect(doc.remote.sessions[0]).toMatchObject({ revision: 2, is_revision: false, completed_at: end });
    expect(projectHistory(doc).answers).toHaveLength(2);
  });
  it('ne complète pas une session partielle ou sans réponse à la place du joueur', () => {
    for (const answered of [0, 1]) {
      const doc = emptyPersonalDocument(scope); const random = ids(); const session = botanicalSession();
      recordPersonalSession(doc, session, random); if (answered) recordPersonalAnswer(doc, botanicalAnswer(session), random);
      let operation; while ((operation = prepareNextOperation(doc))) acknowledge(doc, operation);
      expect(doc.remote.sessions[0].completed_at).toBe(null);
      expect(doc.operations.some(op => op.type === 'completion')).toBe(false);
      completePersonalSession(doc, session.id, end, random); acknowledge(doc, prepareNextOperation(doc));
      expect(doc.remote.sessions[0].completed_at).toBe(end);
    }
  });
  it('perte HTTP après commit retrouve une seule réponse par sa question et garde UUID/payload de retry', () => {
    const doc = emptyPersonalDocument(scope); const random = ids(); const session = botanicalSession();
    recordPersonalSession(doc, session, random); acknowledge(doc, prepareNextOperation(doc));
    recordPersonalAnswer(doc, botanicalAnswer(session), random); const sent = prepareNextOperation(doc);
    expect(prepareNextOperation(doc)).toEqual(sent);
    reconcileHistory(doc, { sessions: [], answers: [answerRow(sent)] }, userId, end);
    expect(doc.operations[1].state).toBe('confirmed'); expect(doc.operations[1].rpcPayload).toEqual(sent.rpcPayload);
    expect(projectHistory(doc).answers).toHaveLength(1);
    expect(calculateStats(projectHistory(doc).answers).attempted).toBe(1);
  });
  it('quatre statuts, vraies tentatives distinctes et révision conservent taux et erreurs', () => {
    const doc = emptyPersonalDocument(scope); const random = ids(); const session = botanicalSession();
    recordPersonalSession(doc, session, random);
    for (const [i, status] of ['correct', 'incorrect', 'timeout', 'skipped_image'].entries()) recordPersonalAnswer(doc, botanicalAnswer(session, i + 1,
      { status, correct: status === 'correct', selectedSpeciesId: status === 'correct' ? 'fraisier' : status === 'incorrect' ? 'groseillier' : null }), random);
    const revision = botanicalSession('revision', { revision: true }); recordPersonalSession(doc, revision, random);
    recordPersonalAnswer(doc, botanicalAnswer(revision), random);
    const stats = calculateStats(projectHistory(doc).answers);
    expect(stats).toMatchObject({ correct: 2, incorrect: 1, timeouts: 1, skipped: 1, attempted: 4, recognitionRate: 50 });
    expect(getRevisionSpeciesIds(projectHistory(doc).answers)).toEqual(['fraisier']);
    expect(projectHistory(doc).answers).toHaveLength(5);
  });
  it('un retry exact ne recrée aucune opération et une réponse divergente est archivée sans double comptage', () => {
    const doc = emptyPersonalDocument(scope); const random = ids(); const session = botanicalSession(); const answer = botanicalAnswer(session);
    recordPersonalSession(doc, session, random); recordPersonalAnswer(doc, answer, random);
    expect(recordPersonalAnswer(doc, answer, random).replayed).toBe(true); expect(doc.operations).toHaveLength(2);
    const divergent = { ...answer, status: 'incorrect', correct: false, selectedSpeciesId: 'groseillier' };
    expect(recordPersonalAnswer(doc, divergent, random).conflict).toBe(true);
    expect(doc.conflicts[0].local).toMatchObject(divergent); expect(projectHistory(doc).answers).toHaveLength(1);
    expect(projectHistory(doc).answers[0].status).toBe('correct'); validatePersonalDocument(doc, scope);
  });
  it('réessayer une intention conflictuelle de réponse, session ou fin conserve son UUID et archive', () => {
    const doc = emptyPersonalDocument(scope); const random = ids(); const session = botanicalSession(); const answer = botanicalAnswer(session);
    recordPersonalSession(doc, session, random); recordPersonalAnswer(doc, answer, random);
    const intents = [() => recordPersonalAnswer(doc, { ...answer, status: 'incorrect', correct: false, selectedSpeciesId: 'groseillier' }, random),
      () => recordPersonalSession(doc, { ...session, categoryId: 'autre-categorie' }, random),
      () => completePersonalSession(doc, session.id, '2026-10-21T11:59:59Z', random)];
    for (const apply of intents) {
      expect(apply().conflict).toBe(true); const before = clone(doc); const retry = apply();
      expect(retry).toMatchObject({ conflict: true, replayed: true, operationId: before.operations.at(-1).id }); expect(doc).toEqual(before);
    }
    validatePersonalDocument(doc, scope);
  });
  it('même ID serveur divergent conserve la version distante et une décision explicite sans réidentification', () => {
    const doc = emptyPersonalDocument(scope); const random = ids(); const session = botanicalSession();
    recordPersonalSession(doc, session, random); acknowledge(doc, prepareNextOperation(doc));
    recordPersonalAnswer(doc, botanicalAnswer(session), random); const op = prepareNextOperation(doc);
    const remote = answerRow(op, { status: 'incorrect', correct: false, selected_species_id: 'groseillier' });
    acknowledgeOperation(doc, op.id, { status: 'conflict', row: remote }, userId);
    expect(projectHistory(doc).answers[0].status).toBe('incorrect'); expect(doc.conflicts).toHaveLength(1);
    expect(doc.conflicts[0].local.status).toBe('correct');
    resolveConflict(doc, doc.conflicts[0].id, 'remote'); expect(doc.conflicts[0].resolved).toBe(true);
    expect(doc.operations).toHaveLength(2); expect(prepareNextOperation(doc)).toBe(null); validatePersonalDocument(doc, scope);
  });
  it('une nouvelle fin après décision distante ne dépend plus des intentions archivées', () => {
    const doc = emptyPersonalDocument(scope); const random = ids(); const session = botanicalSession();
    recordPersonalSession(doc, session, random); acknowledge(doc, prepareNextOperation(doc));
    recordPersonalAnswer(doc, botanicalAnswer(session), random); const answer = prepareNextOperation(doc);
    // This first completion is blocked when the answer collision becomes known.
    completePersonalSession(doc, session.id, end, random);
    const originalCompletion = clone(doc.operations[2]);
    acknowledgeOperation(doc, answer.id, { status: 'conflict', row: answerRow(answer, { status: 'incorrect', correct: false, selected_species_id: 'groseillier' }) }, userId);
    const archivedCompletion = clone(doc.operations[2]);
    expect(archivedCompletion).toMatchObject({ state: 'blocked', rpcPayload: originalCompletion.rpcPayload, dependsOn: originalCompletion.dependsOn });
    expect(prepareNextOperation(doc)).toBe(null);
    resolveConflict(doc, doc.conflicts.find(item => item.kind === 'answer').id, 'remote');
    expect(doc.operations[1].state).toBe('conflict'); expect(doc.operations[2]).toEqual(archivedCompletion);
    const result = completePersonalSession(doc, session.id, '2026-10-21T12:02:00.000Z', random);
    const completion = prepareNextOperation(doc);
    expect(completion).toMatchObject({ id: result.operationId, type: 'completion', dependsOn: [], expectedRevision: 1 });
    validatePersonalDocument(doc, scope); acknowledge(doc, completion); validatePersonalDocument(doc, scope);
    expect(doc.remote.sessions[0]).toMatchObject({ revision: 2, completed_at: '2026-10-21T12:02:00.000Z' });
    expect(doc.operations[1].state).toBe('conflict'); expect(doc.operations[2]).toEqual(archivedCompletion);
    expect(projectHistory(doc).answers).toHaveLength(1); expect(projectHistory(doc).answers[0].status).toBe('incorrect');
    expect(prepareNextOperation(doc)).toBe(null);
  });
  it('conflit de session bloque et archive les réponses et la complétion dépendantes', () => {
    const doc = emptyPersonalDocument(scope); const random = ids(); const session = botanicalSession();
    recordPersonalSession(doc, session, random); recordPersonalAnswer(doc, botanicalAnswer(session), random); completePersonalSession(doc, session.id, end, random);
    const creation = prepareNextOperation(doc);
    acknowledgeOperation(doc, creation.id, { status: 'conflict', row: sessionRow(creation, { category_id: 'autre-categorie', operation_id: uuid(99) }) }, userId);
    expect(doc.operations.map(op => op.state)).toEqual(['conflict', 'blocked', 'blocked']); expect(doc.conflicts).toHaveLength(3);
    expect(projectHistory(doc).answers).toEqual([]); expect(projectHistory(doc).sessions[0].categoryId).toBe('autre-categorie');
    expect(prepareNextOperation(doc)).toBe(null); resolveConflict(doc, doc.conflicts[0].id, 'remote');
    expect(doc.conflicts.every(conflict => conflict.resolved)).toBe(true); validatePersonalDocument(doc, scope);
  });
  it('une ancienne complétion supplantée reste conflictuelle et ne réapplique jamais sa fin', () => {
    const doc = emptyPersonalDocument(scope); const random = ids(); const session = botanicalSession();
    recordPersonalSession(doc, session, random); acknowledge(doc, prepareNextOperation(doc)); completePersonalSession(doc, session.id, end, random);
    const completion = prepareNextOperation(doc); const later = sessionRow(completion, { operation_id: uuid(88), completed_at: '2026-10-21T12:02:00Z' });
    acknowledgeOperation(doc, completion.id, { status: 'conflict', row: later }, userId);
    expect(doc.operations[1].rpcPayload).toEqual(completion.rpcPayload); expect(doc.operations[1].state).toBe('conflict');
    expect(projectHistory(doc).sessions[0].completedAt).toBe('2026-10-21T12:02:00.000000Z');
    expect(prepareNextOperation(doc)).toBe(null); validatePersonalDocument(doc, scope);
  });
  it('date de fin antérieure à une réponse devient conflit durable sans modifier les dates', () => {
    const doc = emptyPersonalDocument(scope); const random = ids(); const session = botanicalSession();
    recordPersonalSession(doc, session, random); recordPersonalAnswer(doc, botanicalAnswer(session, 1, { answeredAt: end }), random);
    const result = completePersonalSession(doc, session.id, when, random);
    expect(result.conflict).toBe(true); expect(doc.operations[2].state).toBe('conflict');
    expect(doc.conflicts[0].local.completedAt).toBe(when); expect(projectHistory(doc).sessions[0].completedAt).toBe(null);
    validatePersonalDocument(doc, scope);
  });
  it('fin avant le début reste une archive lisible et ne bloque pas la sauvegarde initiale', () => {
    const doc = emptyPersonalDocument(scope); const random = ids(); const session = botanicalSession(); recordPersonalSession(doc, session, random);
    expect(completePersonalSession(doc, session.id, '2026-10-21T11:59:59Z', random).conflict).toBe(true);
    validatePersonalDocument(doc, scope); expect(prepareNextOperation(doc).type).toBe('session'); expect(doc.conflicts[0].local.completedAt).toBe('2026-10-21T11:59:59Z');
  });
  it('un parent complété ailleurs invalide explicitement une réponse locale tardive', () => {
    const doc = emptyPersonalDocument(scope); const random = ids(); const session = botanicalSession(); recordPersonalSession(doc, session, random);
    const creation = prepareNextOperation(doc); acknowledge(doc, creation); recordPersonalAnswer(doc, botanicalAnswer(session, 1, { answeredAt: end }), random);
    reconcileHistory(doc, { sessions: [sessionRow(creation, { operation_id: uuid(99), base_revision: 1, revision: 2, completed_at: when })], answers: [] }, userId, end);
    expect(doc.operations[1].state).toBe('conflict'); expect(doc.conflicts[0].local.answeredAt).toBe(end); expect(projectHistory(doc).answers).toEqual([]); validatePersonalDocument(doc, scope);
  });
  it('orphelin et rejet permanent restent archivés sans inventer de parent', () => {
    const doc = emptyPersonalDocument(scope); const random = ids(); const session = botanicalSession();
    expect(recordPersonalAnswer(doc, botanicalAnswer(session), random).conflict).toBe(true);
    expect(doc.conflicts[0].reason).toBe('missing_session'); expect(projectHistory(doc)).toMatchObject({ answers: [], sessions: [] });
    recordPersonalSession(doc, session, random); const op = prepareNextOperation(doc); rejectOperation(doc, op.id, { code: '23503' });
    expect(doc.conflicts[1].reason).toBe('23503'); expect(prepareNextOperation(doc)).toBe(null); validatePersonalDocument(doc, scope);
  });
  it('réconciliation complète retrouve les insertions tardives sans remplacer le cache par un vide', () => {
    const source = emptyPersonalDocument(scope); const random = ids(); const session = botanicalSession();
    recordPersonalSession(source, session, random); acknowledge(source, prepareNextOperation(source));
    recordPersonalAnswer(source, botanicalAnswer(session, 1), random); const first = prepareNextOperation(source); acknowledge(source, first);
    recordPersonalAnswer(source, botanicalAnswer(session, 2), random); const second = prepareNextOperation(source);
    const target = emptyPersonalDocument(scope);
    reconcileHistory(target, clone(source.remote), userId, when); expect(projectHistory(target).answers).toHaveLength(1);
    reconcileHistory(target, { sessions: [], answers: [answerRow(second)] }, userId, end); expect(projectHistory(target).answers).toHaveLength(2);
    reconcileHistory(target, { sessions: [], answers: [] }, userId, end); expect(projectHistory(target).answers).toHaveLength(2);
  });
  it('refuse faux propriétaire, session, identité, contenu, timestamp et acquittement non correspondant', () => {
    const base = emptyPersonalDocument(scope); const random = ids(); const session = botanicalSession();
    recordPersonalSession(base, session, random); acknowledge(base, prepareNextOperation(base)); recordPersonalAnswer(base, botanicalAnswer(session), random);
    const op = prepareNextOperation(base);
    for (const patch of [{ user_id: uuid(99) }, { session_id: 'étranger' }, { answer_id: 'autre' }, { question_id: 'autre' }, { elapsed_ms: 999 }, { answered_at: end }]) {
      const doc = clone(base); expect(() => acknowledgeOperation(doc, op.id, { status: 'inserted', row: answerRow(op, patch) }, userId)).toThrow();
    }
    expect(() => acknowledgeOperation(clone(base), op.id, { status: 'updated', row: answerRow(op) }, userId)).toThrow();
  });
  it('préserve les microsecondes et refuse dates impossibles ou précision non représentable', () => {
    expect(normalizeTimestamp('2026-10-21T12:00:00.123456Z')).toBe('2026-10-21T12:00:00.123456Z');
    expect(normalizeTimestamp('2026-10-21T14:00:00.123456+02:00', true)).toBe('2026-10-21T12:00:00.123456Z');
    for (const invalid of ['2026-02-30T12:00:00Z', '2026-10-21T12:00:00.1234567Z', '0000-01-01T00:00:00Z']) expect(normalizeTimestamp(invalid)).toBe(null);
  });
  it('refuse dépendances cycliques, payload de retry altéré et projection sans opération', () => {
    const base = emptyPersonalDocument(scope); recordPersonalSession(base, botanicalSession(), ids());
    for (const alter of [doc => doc.operations[0].dependsOn.push(doc.operations[0].id),
      doc => doc.operations[0].rpcPayload.p_session.categoryId = 'différent', doc => doc.sessions.extra = botanicalSession('extra')]) {
      const doc = clone(base); alter(doc); expect(() => validatePersonalDocument(doc, scope)).toThrow(/illisible/);
    }
  });
  it('une file corrompue ne peut pas retirer la dépendance des réponses ou de la fin', () => {
    const doc = emptyPersonalDocument(scope); const random = ids(); const session = botanicalSession(); recordPersonalSession(doc, session, random);
    recordPersonalAnswer(doc, botanicalAnswer(session), random); completePersonalSession(doc, session.id, end, random);
    for (const index of [1, 2]) { const altered = clone(doc); altered.operations[index].dependsOn = []; expect(() => validatePersonalDocument(altered, scope)).toThrow(/illisible/); }
  });
});
