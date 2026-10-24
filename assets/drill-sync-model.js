import { readDrillDocument } from './drill-store.js';
import { clone, uuidPattern } from './drill-personal-store.js';

export class DrillSyncError extends Error {
  constructor(code, message = 'La réponse du service de synchronisation est incohérente. Les données locales sont conservées.') { super(message); this.code = code; }
}
const canonical = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
export const sameJSON = (a, b) => canonical(a) === canonical(b);
const instant = value => `${Date.parse(value)}:${String(value).match(/\.(\d+)/)?.[1].padEnd(6, '0').slice(3, 6) || '000'}`;
const sameTime = (a, b) => Number.isFinite(Date.parse(a)) && instant(a) === instant(b);
const keyOf = row => `${row.unit}__${row.week}`;
const responseOf = row => ({ answer: row.answer, correct: row.correct, answeredAt: row.answered_at, operationId: row.operation_id });
const operationMatches = (operation, row) => operation.rpcPayload && row.operation_id === operation.id &&
  row.series_id === operation.rpcPayload.p_series_id && row.question_id === operation.payload.p_question_id &&
  row.answer === operation.payload.p_answer && sameTime(row.answered_at, operation.payload.p_answered_at);
export const snapshotMatches = (series, row) => series.unit === row.unit && series.week === row.week &&
  sameTime(series.startedAt, row.started_at) && sameJSON(series.questions, row.questions);

function assertOwner(row, userId) {
  if (!row || row.user_id !== userId || !Number.isFinite(Date.parse(row.created_at))) throw new DrillSyncError('protocol');
}

/** Validate complete remote data before touching the persistent document. */
export function remoteDocument(history, userId) {
  const document = { version: 1, series: {} };
  const byId = new Map();
  for (const row of history.series) {
    assertOwner(row, userId);
    const key = keyOf(row);
    if (!uuidPattern.test(row.id) || row.schema_version !== 1 || row.series_key !== key || byId.has(row.id) || Object.hasOwn(document.series, key)) throw new DrillSyncError('protocol');
    const series = { id: key, unit: row.unit, week: row.week, startedAt: row.started_at, questions: clone(row.questions), answers: {}, drafts: {}, trainingDrafts: {} };
    document.series[key] = series; byId.set(row.id, series);
  }
  const answerIds = new Set(); const trainingIds = new Set();
  for (const row of history.answers) {
    assertOwner(row, userId);
    const series = byId.get(row.series_id);
    if (!series) throw new DrillSyncError('40001'); // History changed between pages: retry a complete scan.
    if (!uuidPattern.test(row.operation_id) || answerIds.has(row.operation_id) || Object.hasOwn(series.answers, row.question_id)) throw new DrillSyncError('protocol');
    const response = responseOf(row);
    series.answers[row.question_id] = { ...response, attempts: [{ ...response, training: false }] };
    answerIds.add(row.operation_id);
  }
  const trainings = [...history.training].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.operation_id.localeCompare(b.operation_id));
  for (const row of trainings) {
    assertOwner(row, userId);
    const series = byId.get(row.series_id);
    if (!series || !Object.hasOwn(series.answers, row.question_id)) throw new DrillSyncError('40001');
    if (!uuidPattern.test(row.operation_id) || trainingIds.has(row.operation_id)) throw new DrillSyncError('protocol');
    series.answers[row.question_id].attempts.push({ ...responseOf(row), training: true });
    trainingIds.add(row.operation_id);
  }
  const view = readDrillDocument(document);
  if (view.error || view.warnings.length || Object.keys(view.series).length !== history.series.length) throw new DrillSyncError('protocol');
  return document;
}

function archiveConflict(document, conflict) {
  if (!document.conflicts.some(saved => saved.id === conflict.id)) document.conflicts.push({ ...clone(conflict), resolved: false });
}

function blockDependents(document, seriesKey, questionId = null) {
  for (const operation of document.operations) if (operation.seriesKey === seriesKey && operation.state !== 'confirmed' &&
    (questionId === null || operation.type === 'training' && operation.payload.p_question_id === questionId)) operation.state = 'blocked';
}

function snapshotConflict(document, key, remoteSeries) {
  archiveConflict(document, { id: `snapshot:${key}`, kind: 'snapshot', seriesKey: key,
    local: document.drill.series[key], remoteSeries });
  blockDependents(document, key);
  for (const operation of document.operations) if (operation.seriesKey === key && operation.type === 'series' && operation.state !== 'confirmed') operation.state = 'conflict';
}

function answerConflict(document, operation, row) {
  const local = document.drill.series[operation.seriesKey].answers[operation.payload.p_question_id];
  archiveConflict(document, { id: `answer:${operation.id}`, kind: 'answer', seriesKey: operation.seriesKey,
    questionId: operation.payload.p_question_id, local, operation, remote: row });
  blockDependents(document, operation.seriesKey, operation.payload.p_question_id);
  operation.state = 'conflict';
}

function identityConflict(document, operation, row) {
  archiveConflict(document, { id: `identity:${operation.id}`, kind: 'identity', seriesKey: operation.seriesKey,
    questionId: operation.payload.p_question_id, local: document.drill.series[operation.seriesKey], operation, remote: row });
  blockDependents(document, operation.seriesKey, operation.payload.p_question_id || null);
  operation.state = 'conflict';
}

export function reconcileHistory(document, history, userId, nowISO = new Date().toISOString()) {
  const remote = remoteDocument(history, userId);
  document.remote = clone(history);
  for (const row of history.series) {
    const key = row.series_key;
    const serverSeries = remote.series[key];
    const local = document.drill.series[key];
    if (!local) { document.drill.series[key] = clone(serverSeries); continue; }
    if (!snapshotMatches(local, row)) { snapshotConflict(document, key, serverSeries); continue; }
    const creation = document.operations.find(operation => operation.type === 'series' && operation.seriesKey === key);
    if (creation?.state === 'pending' && sameJSON(creation.payload.p_questions, row.questions) && sameTime(creation.payload.p_started_at, row.started_at)) creation.state = 'confirmed';
    for (const answerRow of history.answers.filter(item => item.series_id === row.id)) {
      const questionId = answerRow.question_id;
      const first = document.operations.find(operation => operation.type === 'answer' && operation.seriesKey === key && operation.payload.p_question_id === questionId && operation.state !== 'blocked');
      if (first && ['pending', 'error'].includes(first.state)) {
        // A pull can acknowledge a response lost after commit, even before a retry.
        if (first.id === answerRow.operation_id && first.payload.p_answer === answerRow.answer && sameTime(first.payload.p_answered_at, answerRow.answered_at)) {
          first.rpcPayload ||= { ...clone(first.payload), p_series_id: row.id };
          if (operationMatches(first, answerRow)) first.state = 'confirmed';
          else identityConflict(document, first, answerRow);
        } else answerConflict(document, first, answerRow);
      }
      const response = clone(serverSeries.answers[questionId]);
      // Pending attempts are identified by operation UUID, never by choice/date.
      for (const operation of document.operations.filter(item => item.type === 'training' && item.seriesKey === key && item.payload.p_question_id === questionId)) {
        const saved = history.training.find(item => item.operation_id === operation.id);
        if (saved && ['pending', 'error'].includes(operation.state)) {
          operation.rpcPayload ||= { ...clone(operation.payload), p_series_id: row.id };
          if (operationMatches(operation, saved)) operation.state = 'confirmed';
          else identityConflict(document, operation, saved);
        }
        if (operation.state === 'pending' || operation.state === 'error') response.attempts.push({ answer: operation.payload.p_answer,
          correct: operation.payload.p_answer === local.questions.find(question => question.id === questionId).answer,
          answeredAt: operation.payload.p_answered_at, training: true, operationId: operation.id });
      }
      local.answers[questionId] = response;
    }
    // Remote reads never replace local drafts or unrelated pending first answers.
  }
  document.lastReconciledAt = nowISO;
  return document;
}

export function prepareNextOperation(document, now = Date.now()) {
  for (const operation of document.operations) {
    if (operation.state !== 'pending' || operation.retryAt > now) continue;
    if (document.conflicts.some(conflict => !conflict.resolved && conflict.seriesKey === operation.seriesKey &&
        (conflict.kind === 'snapshot' || conflict.questionId === operation.payload.p_question_id))) continue;
    if (operation.type === 'series') operation.rpcPayload ||= clone(operation.payload);
    else {
      const series = document.remote.series.find(row => row.series_key === operation.seriesKey);
      if (!series || !snapshotMatches(document.drill.series[operation.seriesKey], series)) continue;
      const first = document.remote.answers.find(row => row.series_id === series.id && row.question_id === operation.payload.p_question_id);
      if (operation.type === 'training' && !first) continue;
      operation.rpcPayload ||= { ...clone(operation.payload), p_series_id: series.id };
      if (operation.rpcPayload.p_series_id !== series.id) { identityConflict(document, operation, null); continue; }
    }
    return clone(operation);
  }
  return null;
}

export function acknowledgeOperation(document, operationId, result, userId) {
  const operation = document.operations.find(item => item.id === operationId);
  if (!operation || operation.state !== 'pending') return;
  if (!result || !['inserted', 'replayed', 'conflict'].includes(result.status)) throw new DrillSyncError('protocol');
  const row = result.row;
  assertOwner(row, userId);
  if (operation.type === 'series') {
    remoteDocument({ series: [row], answers: [], training: [] }, userId);
    if (row.series_key !== operation.seriesKey) throw new DrillSyncError('protocol');
    const equal = sameJSON(operation.payload.p_questions, row.questions) && sameTime(operation.payload.p_started_at, row.started_at);
    if (result.status !== 'conflict' && !equal) throw new DrillSyncError('protocol');
    document.remote.series = [...document.remote.series.filter(item => item.id !== row.id && item.series_key !== row.series_key), clone(row)];
    if (result.status === 'conflict') snapshotConflict(document, operation.seriesKey, remoteDocument({ series: [row], answers: [], training: [] }, userId).series[row.series_key]);
    else operation.state = 'confirmed';
  } else {
    if (!uuidPattern.test(row.operation_id) || !uuidPattern.test(row.series_id)) throw new DrillSyncError('protocol');
    const matches = operationMatches(operation, row);
    if (result.status !== 'conflict' && !matches) throw new DrillSyncError('protocol');
    if (result.status === 'conflict' && (row.series_id !== operation.rpcPayload.p_series_id || row.question_id !== operation.payload.p_question_id || operation.type === 'training')) {
      identityConflict(document, operation, row); return;
    }
    const key = operation.type === 'answer' ? 'answers' : 'training';
    if (result.status === 'conflict') answerConflict(document, operation, row);
    else operation.state = 'confirmed';
    document.remote[key] = [...document.remote[key].filter(item => item.operation_id !== row.operation_id), clone(row)];
  }
  reconcileHistory(document, document.remote, userId);
}

export function resolveDrillConflict(document, id) {
  const conflict = document.conflicts.find(item => item.id === id && !item.resolved);
  if (!conflict || conflict.kind === 'identity') throw new DrillSyncError('conflict', 'Ce conflit d’identité exige une intervention. Les données et l’opération restent conservées.');
  if (conflict.kind === 'snapshot') document.drill.series[conflict.seriesKey] = clone(conflict.remoteSeries);
  conflict.resolved = true;
  // Conflicting/blocked operations stay archived. Never turn them into training.
}
