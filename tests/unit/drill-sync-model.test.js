import { describe, expect, it } from 'vitest';
import { emptyPersonalDocument, personalChange, personalScope } from '../../assets/drill-personal-store.js';
import { acknowledgeOperation, prepareNextOperation, reconcileHistory, resolveDrillConflict } from '../../assets/drill-sync-model.js';
import { readDrillDocument } from '../../assets/drill-store.js';
import { makeSeries } from '../fixtures/drill.js';

const userId = '11111111-1111-4111-8111-111111111111';
const seriesId = '22222222-2222-4222-8222-222222222222';
const otherOperation = '33333333-3333-4333-8333-333333333333';
const series = makeSeries(); const q = series.questions[0];
const at = '2026-10-20T10:00:00.000Z'; const created = '2026-10-24T12:00:00.000Z';
const row = { id: seriesId, user_id: userId, unit: series.unit, week: series.week, series_key: series.id, started_at: series.startedAt, questions: series.questions, schema_version: 1, created_at: created };
function local() {
  const saved = emptyPersonalDocument(personalScope({ environment: 'development', url: 'https://fixture.invalid', userId }));
  personalChange(saved, 'ensureSeries', [series.unit, series.week, series.questions, series.startedAt]); return saved;
}
function first(saved, question = q) { personalChange(saved, 'submitAnswer', [series.id, question.id, question.answer, { nowISO: at }]); return saved.operations.at(-1); }
function answerRow(operation, overrides = {}) { return { user_id: userId, series_id: seriesId, operation_id: operation.id,
  question_id: operation.payload.p_question_id, answer: operation.payload.p_answer, correct: operation.payload.p_answer === series.questions.find(item => item.id === operation.payload.p_question_id).answer,
  answered_at: operation.payload.p_answered_at, created_at: created, ...overrides }; }
const history = (answers = [], training = []) => ({ series: [row], answers, training });
function confirmSeries(saved) { const operation = prepareNextOperation(saved); acknowledgeOperation(saved, operation.id, { status: 'inserted', row }, userId); }

describe('réconciliation et outbox Drill', () => {
  it('respecte série → première réponse → entraînement et fige le payload RPC', () => {
    const saved = local(); const answer = first(saved);
    personalChange(saved, 'submitAnswer', [series.id, q.id, q.answer, { training: true, nowISO: at }]);
    expect(prepareNextOperation(saved).type).toBe('series'); expect(answer.rpcPayload).toBeNull();
    confirmSeries(saved); const next = prepareNextOperation(saved);
    expect(next.type).toBe('answer'); expect(next.rpcPayload.p_series_id).toBe(seriesId);
    const payload = structuredClone(next.rpcPayload);
    expect(prepareNextOperation(saved).rpcPayload).toEqual(payload);
    acknowledgeOperation(saved, next.id, { status: 'inserted', row: answerRow(next) }, userId);
    expect(prepareNextOperation(saved).type).toBe('training');
  });

  it('confirme inserted puis replayed sans modifier la première réponse', () => {
    const saved = local(); confirmSeries(saved); first(saved); const operation = prepareNextOperation(saved);
    const response = answerRow(operation);
    acknowledgeOperation(saved, operation.id, { status: 'replayed', row: response }, userId);
    expect(saved.operations.at(-1).state).toBe('confirmed'); expect(saved.remote.answers).toEqual([response]);
    expect(saved.drill.series[series.id].answers[q.id].answer).toBe(q.answer);
  });

  it('préserve la première réponse locale en conflit et affiche la gagnante serveur', () => {
    const saved = local(); confirmSeries(saved); const operation = first(saved); prepareNextOperation(saved);
    personalChange(saved, 'submitAnswer', [series.id, q.id, q.answer, { training: true, nowISO: at }]);
    const different = q.options.find(item => item.id !== q.answer).id;
    acknowledgeOperation(saved, operation.id, { status: 'conflict', row: answerRow(operation, { operation_id: otherOperation, answer: different, correct: false }) }, userId);
    expect(saved.conflicts[0].local.answer).toBe(q.answer); expect(saved.drill.series[series.id].answers[q.id].answer).toBe(different);
    expect(saved.operations.at(-1).state).toBe('blocked'); expect(prepareNextOperation(saved)).toBeNull();
    resolveDrillConflict(saved, saved.conflicts[0].id);
    expect(saved.conflicts[0].resolved).toBe(true); expect(saved.operations.at(-1).state).toBe('blocked');
  });

  it('archive le snapshot incompatible et suspend toutes les opérations dépendantes', () => {
    const saved = local(); first(saved);
    const changed = structuredClone(row); changed.questions[0].prompt = 'Version distante différente';
    const operation = prepareNextOperation(saved);
    acknowledgeOperation(saved, operation.id, { status: 'conflict', row: changed }, userId);
    expect(saved.drill.series[series.id].questions[0].prompt).toBe(q.prompt); expect(saved.conflicts[0].local.answers[q.id]).toBeTruthy();
    expect(saved.operations[1].state).toBe('blocked'); expect(prepareNextOperation(saved)).toBeNull();
    resolveDrillConflict(saved, saved.conflicts[0].id);
    expect(saved.drill.series[series.id].questions[0].prompt).toBe(changed.questions[0].prompt);
    expect(saved.conflicts[0].local.questions[0].prompt).toBe(q.prompt); expect(saved.operations[1].state).toBe('blocked');
  });

  it('ne range jamais une collision d’UUID sous la mauvaise question', () => {
    const saved = local(); confirmSeries(saved); const operation = first(saved); prepareNextOperation(saved);
    const other = series.questions[1];
    const collision = answerRow(operation, { question_id: other.id, answer: other.answer, correct: true });
    acknowledgeOperation(saved, operation.id, { status: 'conflict', row: collision }, userId);
    expect(saved.conflicts[0].kind).toBe('identity'); expect(saved.remote.answers).toEqual([]);
    expect(saved.drill.series[series.id].answers[other.id]).toBeUndefined();
    expect(() => resolveDrillConflict(saved, saved.conflicts[0].id)).toThrow();
  });

  it('refuse une fausse confirmation, un autre propriétaire ou une correction falsifiée', () => {
    for (const change of [{ user_id: otherOperation }, { operation_id: otherOperation }, { answer: 'inconnue' }, { correct: false }]) {
      const saved = local(); confirmSeries(saved); first(saved); const operation = prepareNextOperation(saved);
      expect(() => acknowledgeOperation(saved, operation.id, { status: 'inserted', row: answerRow(operation, change) }, userId)).toThrow();
    }
  });

  it('réconcilie une insertion non acquittée et une ancienne réponse arrivée tardivement', () => {
    const saved = local(); confirmSeries(saved); const operation = first(saved); prepareNextOperation(saved);
    const response = answerRow(operation);
    reconcileHistory(saved, history([response]), userId);
    expect(saved.operations.at(-1).state).toBe('confirmed');
    const question = series.questions[1]; const old = { ...response, operation_id: otherOperation, question_id: question.id, answer: question.answer, correct: true, answered_at: '2020-01-01T00:00:00Z' };
    reconcileHistory(saved, history([response, old]), userId);
    expect(saved.drill.series[series.id].answers[question.id].answeredAt).toBe(old.answered_at);
  });

  it('fusionne les entraînements par UUID et préserve les brouillons locaux', () => {
    const saved = local(); confirmSeries(saved); const operation = first(saved); prepareNextOperation(saved);
    const answer = answerRow(operation); acknowledgeOperation(saved, operation.id, { status: 'inserted', row: answer }, userId);
    personalChange(saved, 'saveDraft', [series.id, series.questions[1].id, 'a']);
    personalChange(saved, 'saveDraft', [series.id, q.id, 'b', { training: true }]);
    const t1 = { ...answer, operation_id: otherOperation }; const t2 = { ...t1, operation_id: '44444444-4444-4444-8444-444444444444' };
    reconcileHistory(saved, history([answer], [t1, t2]), userId); reconcileHistory(saved, history([answer], [t1, t2]), userId);
    const current = saved.drill.series[series.id]; expect(current.answers[q.id].attempts).toHaveLength(3);
    expect(current.drafts[series.questions[1].id]).toBe('a'); expect(current.trainingDrafts[q.id]).toBe('b');
    expect(readDrillDocument(saved.drill).warnings).toEqual([]);
  });

  it('reconstitue un autre appareil avec les dix snapshots sans banque courante', () => {
    const saved = local(); confirmSeries(saved); const operation = first(saved); prepareNextOperation(saved);
    const newDevice = emptyPersonalDocument(saved.scope);
    reconcileHistory(newDevice, history([answerRow(operation)]), userId);
    expect(newDevice.drill.series[series.id].questions).toEqual(series.questions);
    expect(newDevice.drill.series[series.id].answers[q.id].answer).toBe(q.answer); expect(newDevice.operations).toEqual([]);
  });
});
