// Thin adapters over the existing models, transactions and transports. No SQL,
// alternate synchronizer, arbitrary ID allocation or raw outbox assignment.
import * as drill from './drill-sync-model.js';
import * as drillStore from './drill-personal-store.js';
import * as courses from './course-quiz-model.js';
import * as botanical from './botanical-sync-model.js';
import * as settings from './settings-model.js';
import { createDrillTransport } from './drill-sync-transport.js';
import { createCourseQuizTransport } from './course-quiz-transport.js';
import { createBotanicalTransport } from './botanical-sync-transport.js';
import { createSettingsTransport } from './settings-transport.js';
import { createScopedRepository } from './personal-idb.js';
import { CACHES } from './export-sources.js';
import { canonical, failRestore } from './restore-model.js';

export const adapters = {
  drill: { empty: drillStore.emptyPersonalDocument, validate: drillStore.validatePersonalDocument, prepare: drill.prepareNextOperation, acknowledge: drill.acknowledgeOperation, transport: createDrillTransport },
  courses: { empty: courses.emptyPersonalDocument, validate: courses.validatePersonalDocument, prepare: courses.prepareNextOperation, acknowledge: courses.acknowledgeOperation, transport: createCourseQuizTransport },
  botanical: { empty: botanical.emptyPersonalDocument, validate: botanical.validatePersonalDocument, prepare: botanical.prepareNextOperation, acknowledge: botanical.acknowledgeOperation, transport: createBotanicalTransport },
  settings: { empty: settings.emptySettingsDocument, validate: settings.validateSettingsDocument, prepare: settings.prepareSettingsOperation, acknowledge: settings.acknowledgeSettings, transport: createSettingsTransport },
};
export function restoreRepository(domain, scope, options = {}) {
  return createScopedRepository(scope, { ...options, databaseName: CACHES[domain], empty: adapters[domain].empty,
    validate: adapters[domain].validate, privacyPolicy: marker => marker == null, ErrorType: RestoreStorageError });
}
class RestoreStorageError extends Error {
  constructor() { super('local_storage'); this.code = 'local_storage'; }
}
export const tableDomain = name => name.startsWith('drill_') ? 'drill' : ['course_states', 'quiz_attempts'].includes(name) ? 'courses'
  : name.startsWith('botanical_') ? 'botanical' : ['itk_settings', 'appearance_preferences'].includes(name) ? 'settings' : null;
export const tableGroup = name => ({ course_states: 'courses', quiz_attempts: 'quiz', itk_settings: 'itk', appearance_preferences: 'appearance', profiles: 'profile' }[name] || tableDomain(name));
export const rowKey = (name, row) => row[({ profiles: 'id', drill_series: 'series_key', drill_answers: 'operation_id', drill_training_attempts: 'operation_id', course_states: 'lesson_id', quiz_attempts: 'attempt_id', botanical_sessions: 'session_id', botanical_answers: 'answer_id', itk_settings: 'user_id', appearance_preferences: 'user_id' })[name]];
const own = (value, key) => value && Object.hasOwn(value, key) ? value[key] : undefined;
const sameTime = (a, b) => a == null || b == null ? a === b : botanical.normalizeTimestamp(a, true) === botanical.normalizeTimestamp(b, true);
export function business(name, row) {
  const excluded = new Set(['created_at', 'updated_at', 'operation_id', 'revision', 'base_revision', 'schema_version', 'user_id']);
  if (name.startsWith('drill_')) excluded.delete('operation_id');
  if (name === 'quiz_attempts') excluded.delete('attempt_id');
  return Object.fromEntries(Object.entries(row).filter(([key]) => !excluded.has(key)).map(([key, value]) =>
    [key, /_at$/.test(key) && value !== null ? botanical.normalizeTimestamp(value, true) : value]));
}
export const sameEntity = (name, a, b) => canonical(business(name, a)) === canonical(business(name, b));

// Reconciliation normally rebuilds projections. Restoration additionally refuses
// any rebuild that would remove an unrelated local value or unknown property.
// Arrays are multisets here: equal-looking historical attempts keep their count.
function contains(before, after) {
  if (before === null) return after === null;
  if (typeof before !== 'object') return before === after || typeof before === 'string' && typeof after === 'string' &&
    botanical.normalizeTimestamp(before, true) !== null && sameTime(before, after);
  if (Array.isArray(before)) {
    if (!Array.isArray(after)) return false;
    const remaining = [...after];
    return before.every(item => { const index = remaining.findIndex(value => contains(item, value)); if (index < 0) return false; remaining.splice(index, 1); return true; });
  }
  return after !== null && typeof after === 'object' && !Array.isArray(after) && Object.keys(before).every(key => Object.hasOwn(after, key) && contains(before[key], after[key]));
}
export function ensurePreserved(before, after, domain) {
  if (domain === 'courses') {
    // Quiz confirmation also rebuilds courses. Check that future transition
    // before persisting an outbox that an ordinary synchronizer could replay.
    const projected = structuredClone(after);
    courses.reconcileHistory(projected, { courses: [], attempts: [] }, JSON.parse(after.scope)[2], after.lastReconciledAt || '2026-01-01T00:00:00Z');
    after = projected;
  }
  const fields = { drill: ['drill'], courses: ['courses', 'attempts'], botanical: ['sessions', 'answers'], settings: ['values'] }[domain];
  for (const key of [...fields, 'imports', 'conflicts', 'archives', 'importArchives']) {
    if (!Object.hasOwn(before, key)) continue;
    if (key === 'values') { for (const name of ['itk', 'appearance']) if (before.values[name] !== null && !contains(before.values[name], after.values[name])) failRestore('current_local'); }
    else if (!contains(before[key], after[key])) failRestore('current_local');
  }
  const operations = new Map(after.operations.map(value => [value.id, value]));
  for (const operation of before.operations) if (canonical(operation) !== canonical(operations.get(operation.id))) failRestore('current_local');
}
function remoteRows(document, name) {
  return ({ drill_series: document.remote.series, drill_answers: document.remote.answers, drill_training_attempts: document.remote.training,
    course_states: document.remote.courses, quiz_attempts: document.remote.attempts, botanical_sessions: document.remote.sessions, botanical_answers: document.remote.answers,
    itk_settings: document.remote.itk ? [document.remote.itk] : [], appearance_preferences: document.remote.appearance ? [document.remote.appearance] : [] })[name] || [];
}
export const cachedRow = (document, name, row) => remoteRows(document, name).find(item => rowKey(name, item) === rowKey(name, row));

// Projection comparisons do not infer an operation identity from score/date.
export function projection(document, name, row) {
  if (name === 'drill_series') {
    const value = own(document.drill.series, row.series_key);
    return value === undefined ? 'absent' : drill.snapshotMatches(value, row) ? 'same' : 'conflict';
  }
  if (name === 'drill_answers') {
    const parent = document.remote.series.find(item => item.id === row.series_id);
    const value = own(own(document.drill.series, parent?.series_key)?.answers, row.question_id);
    return value === undefined ? 'absent' : value.answer === row.answer && value.correct === row.correct && sameTime(value.answeredAt, row.answered_at) ? 'same' : 'conflict';
  }
  if (name === 'drill_training_attempts') {
    const operation = document.operations.find(item => item.id === row.operation_id);
    return !operation ? 'absent' : operation.payload.p_answer === row.answer && sameTime(operation.payload.p_answered_at, row.answered_at) ? 'same' : 'conflict';
  }
  if (name === 'course_states') {
    const value = own(document.courses, row.lesson_id);
    return value === undefined ? 'absent' : value.done === row.done && (value.score ?? null) === row.best_score &&
      (value.legacyQuizScore?.score ?? null) === row.legacy_score && (value.legacyQuizScore?.total ?? null) === row.legacy_total ? 'same' : 'conflict';
  }
  if (name === 'quiz_attempts') {
    const value = own(document.attempts, row.attempt_id);
    return value === undefined ? 'absent' : value.lessonId === row.lesson_id && value.score === row.score && value.total === row.total && sameTime(value.completedAt, row.completed_at) ? 'same' : 'conflict';
  }
  if (name === 'botanical_sessions') {
    const value = own(document.sessions, row.session_id);
    return value === undefined ? 'absent' : botanical.sameSession(value, botanical.fromSessionRow(row)) ? 'same' : 'conflict';
  }
  if (name === 'botanical_answers') {
    const value = own(document.answers, row.answer_id);
    return value === undefined ? 'absent' : botanical.sameAnswer(value, botanical.fromAnswerRow(row)) ? 'same' : 'conflict';
  }
  const domain = name === 'itk_settings' ? 'itk' : 'appearance';
  const value = document.values[domain];
  return value == null ? 'absent' : canonical(value) === canonical(settings.valueFromRow(domain, row)) ? 'same' : 'conflict';
}

function union(a, b, key) {
  const result = new Map(a.map(row => [row[key], row]));
  for (const row of b) {
    const old = result.get(row[key]);
    if (old && canonical(old) !== canonical(row)) failRestore('changed');
    result.set(row[key], row);
  }
  return [...result.values()];
}
export function hydrate(document, name, row, server, userId, at) {
  if (name.startsWith('drill_')) {
    const history = structuredClone(document.remote);
    const parent = name === 'drill_series' ? row : server.drill_series.find(item => item.id === row.series_id);
    if (!parent || projection(document, 'drill_series', parent) === 'conflict') failRestore('parent');
    history.series = union(history.series, [parent], 'id');
    if (name !== 'drill_series') {
      if (name === 'drill_training_attempts') {
        const first = server.drill_answers.find(item => item.series_id === row.series_id && item.question_id === row.question_id);
        if (!first || projection(document, 'drill_answers', first) === 'conflict') failRestore('parent');
        history.answers = union(history.answers, [first], 'operation_id');
        history.training = union(history.training, [row], 'operation_id');
      } else history.answers = union(history.answers, [row], 'operation_id');
    }
    drill.reconcileHistory(document, history, userId, at);
  } else if (name === 'course_states' || name === 'quiz_attempts') courses.reconcileHistory(document,
    { courses: name === 'course_states' ? [row] : [], attempts: name === 'quiz_attempts' ? [row] : [] }, userId, at);
  else if (name.startsWith('botanical_')) {
    const parent = name === 'botanical_sessions' ? row : server.botanical_sessions.find(item => item.session_id === row.session_id);
    if (!parent || projection(document, 'botanical_sessions', parent) === 'conflict') failRestore('parent');
    botanical.reconcileHistory(document, { sessions: [parent], answers: name === 'botanical_answers' ? [row] : [] }, userId, at);
  } else settings.reconcileSettings(document, { itk: name === 'itk_settings' ? row : null, appearance: name === 'appearance_preferences' ? row : null }, userId, at);
}

export function queueCandidate(document, candidate, server) {
  const { name, row, operation } = candidate;
  const fixed = () => row.operation_id;
  if (name === 'quiz_attempts') return courses.enqueueImportedQuiz(document, row.lesson_id, { score: row.score, total: row.total, completedAt: row.completed_at }, row.attempt_id);
  if (name === 'course_states') return courses.enqueueImportedCourse(document, row.lesson_id, { done: row.done,
    ...(row.best_score === null ? {} : { score: row.best_score }), ...(row.legacy_score === null ? {} : { legacyQuizScore: { score: row.legacy_score, total: row.legacy_total } }) }, fixed);
  if (name === 'itk_settings' || name === 'appearance_preferences') {
    const domain = name === 'itk_settings' ? 'itk' : 'appearance';
    return settings.queueSettings(document, domain, operation ? operation.payload[settings.valueField(domain)] : settings.valueFromRow(domain, row), fixed).operationId;
  }
  if (name === 'botanical_sessions') return botanical.recordPersonalSession(document, operation ? operation.payload.p_session : botanical.fromSessionRow(row), fixed).operationId;
  if (name === 'botanical_answers') {
    if (!operation) failRestore('missing_operation');
    const result = botanical.recordPersonalAnswer(document, operation.payload.p_answer, () => operation.id);
    if (result.conflict || !result.operationId) failRestore('parent');
    const queued = document.operations.find(item => item.id === result.operationId);
    if (canonical(queued.dependsOn) !== canonical(operation.dependsOn)) failRestore('dependency');
    return result.operationId;
  }
  if (name === 'drill_answers' || name === 'drill_training_attempts') {
    const parent = server.drill_series.find(item => item.id === row.series_id);
    if (!parent || projection(document, 'drill_series', parent) !== 'same') failRestore('parent');
    const before = document.operations.length;
    drillStore.personalChange(document, 'submitAnswer', [parent.series_key, row.question_id, row.answer,
      { training: name === 'drill_training_attempts', nowISO: row.answered_at }], fixed);
    if (document.operations.length !== before + 1) failRestore('conflict');
    return row.operation_id;
  }
  failRestore('backend');
}

export function rowFromOperation(domain, op, file) {
  const p = op.payload, user_id = file.sourceScope.userId;
  if (domain === 'courses') return op.type === 'quiz' ? { name: 'quiz_attempts', row: { user_id, attempt_id: op.id, lesson_id: p.p_lesson_id, score: p.p_score, total: p.p_total, completed_at: p.p_completed_at } }
    : { name: 'course_states', row: { user_id, lesson_id: p.p_lesson_id, done: p.p_done, best_score: p.p_best_score, legacy_score: p.p_legacy_score, legacy_total: p.p_legacy_total, operation_id: op.id, base_revision: p.p_expected_revision, revision: p.p_expected_revision + 1 } };
  if (domain === 'settings') return { name: op.domain === 'itk' ? 'itk_settings' : 'appearance_preferences', row: { user_id, operation_id: op.id,
    base_revision: op.expectedRevision, revision: op.expectedRevision + 1, ...(op.domain === 'itk' ? { parameters: p.p_parameters }
      : { season: p.p_preferences.season, brightness: p.p_preferences.brightness, client_updated_at: p.p_preferences.updatedAt ?? null }) } };
  if (domain === 'botanical') {
    const v = op.type === 'answer' ? p.p_answer : p.p_session;
    return op.type === 'answer' ? { name: 'botanical_answers', row: { user_id, answer_id: v.id, session_id: v.sessionId, question_id: v.questionId, category_id: v.categoryId,
      species_id: v.speciesId, photo_id: v.photoId, mode: v.mode, is_revision: v.revision, status: v.status, selected_species_id: v.selectedSpeciesId, correct: v.correct, elapsed_ms: v.elapsedMs, answered_at: v.answeredAt } }
      : { name: 'botanical_sessions', row: { user_id, session_id: v.id, category_id: v.categoryId, mode: v.mode, duration_seconds: v.durationSeconds, is_revision: v.revision,
        started_at: v.startedAt, total_questions: v.totalQuestions, completed_at: v.completedAt, operation_id: op.id, base_revision: op.expectedRevision, revision: op.expectedRevision + 1 } };
  }
  if (op.type === 'series') return null; // Cannot restore an exported technical UUID.
  const parent = [...(file.data.server.drill_series || []), ...(file.data.personalLocal.drill?.remote.series || [])].find(row => row.series_key === op.seriesKey);
  const series = file.data.personalLocal.drill?.drill.series[op.seriesKey];
  const question = series?.questions.find(item => item.id === p.p_question_id);
  return { name: op.type === 'answer' ? 'drill_answers' : 'drill_training_attempts', row: { user_id, operation_id: op.id,
    series_id: op.rpcPayload?.p_series_id || parent?.id, question_id: p.p_question_id, answer: p.p_answer, correct: p.p_answer === question?.answer, answered_at: p.p_answered_at } };
}
