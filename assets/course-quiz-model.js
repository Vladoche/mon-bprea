import { recordQuizAttempt } from './exam-stats.js';

export const clone = value => structuredClone(value);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => Object.hasOwn(value, key);
const get = (value, key) => own(value, key) ? value[key] : undefined;
const put = (value, key, entry) => { Object.defineProperty(value, key, { value: entry, enumerable: true, configurable: true, writable: true }); return entry; };
// Match the SQL text identity without normalizing its contents. PostgreSQL's
// char_length counts Unicode code points; its explicit btrim list is narrower
// than JavaScript trim(). Unknown valid lesson IDs must remain readable.
export const validId = value => typeof value === 'string' && [...value].length > 0 && [...value].length <= 200 &&
  value.replace(/^[\t\n\v\f\r \u00a0]+|[\t\n\v\f\r \u00a0]+$/g, '').length > 0 &&
  !/\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(value);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const validUUID = value => typeof value === 'string' && uuidPattern.test(value) && value !== '00000000-0000-0000-0000-000000000000';
const safe = value => Number.isSafeInteger(value) && value >= 0;
export const validScore = (score, total) => safe(score) && Number.isSafeInteger(total) && total > 0 && score <= total;
export const validAttempt = value => {
  if (!record(value) || typeof value.completedAt !== 'string' || !/^[0-9]{4}-/.test(value.completedAt) || Number(value.completedAt.slice(0, 4)) < 1) return false;
  // PostgreSQL retains microseconds. Do not silently round a more precise
  // legacy source without an established representation/rounding contract.
  if (/\.\d{7,}(?:Z|[+-]\d{2}:\d{2})$/.test(value.completedAt)) return false;
  try {
    recordQuizAttempt(null, value);
    const time = Date.parse(value.completedAt);
    return time >= Date.parse('0001-01-01T00:00:00Z') && time <= Date.parse('9999-12-31T23:59:59.999Z');
  } catch { return false; }
};
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const canonical = value => JSON.stringify(value, (_, item) => record(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const equal = (a, b) => canonical(a) === canonical(b);
const instant = value => `${Date.parse(value)}:${String(value).match(/\.(\d+)/)?.[1].padEnd(6, '0').slice(3, 6) || '000'}`;
const sameTime = (a, b) => timestamp(a) && timestamp(b) && instant(a) === instant(b);

export class CourseQuizSyncError extends Error {
  constructor(code = 'protocol', message = 'La réponse de synchronisation est incohérente. Les données sont conservées.') { super(message); this.code = code; }
}
export class LocalCourseQuizError extends Error {
  constructor(message = 'La progression n’a pas été enregistrée : le stockage personnel est inaccessible ou plein. Les données existantes sont conservées.') { super(message); this.code = 'local_storage'; }
}
function protocol(condition) { if (!condition) throw new CourseQuizSyncError(); }
function local(condition) { if (!condition) throw new LocalCourseQuizError('Le cache cours et QCM est illisible ou d’une version inconnue. Il est conservé sans modification.'); }
function freshUUID(randomUUID) { const id = randomUUID(); if (!validUUID(id)) throw new LocalCourseQuizError('Impossible de créer un identifiant durable.'); return id; }

export function emptyPersonalDocument(scope) {
  return { version: 1, scope, courses: {}, attempts: {}, operations: [], remote: { courses: [], attempts: [] },
    conflicts: [], imports: [], lastReconciledAt: null };
}
function validCoursePayload(payload, id) {
  return record(payload) && Object.keys(payload).length === 7 && validId(payload.p_lesson_id) && typeof payload.p_done === 'boolean' &&
    (payload.p_best_score === null || safe(payload.p_best_score)) &&
    (payload.p_legacy_score === null && payload.p_legacy_total === null || validScore(payload.p_legacy_score, payload.p_legacy_total)) &&
    payload.p_operation_id === id && safe(payload.p_expected_revision) && payload.p_expected_revision < Number.MAX_SAFE_INTEGER;
}
function validQuizPayload(payload, id) {
  return record(payload) && Object.keys(payload).length === 5 && payload.p_attempt_id === id && validId(payload.p_lesson_id) &&
    validAttempt({ score: payload.p_score, total: payload.p_total, completedAt: payload.p_completed_at });
}
export function validatePersonalDocument(document, scope) {
  local(record(document) && document.version === 1 && document.scope === scope && record(document.courses) && record(document.attempts) &&
    Array.isArray(document.operations) && Array.isArray(document.conflicts) && Array.isArray(document.imports) &&
    Array.isArray(document.remote?.courses) && Array.isArray(document.remote?.attempts) &&
    (document.lastReconciledAt === null || timestamp(document.lastReconciledAt)));
  for (const [key, value] of Object.entries(document.courses)) local(validId(key) && record(value) && typeof value.done === 'boolean' &&
    (!own(value, 'score') || safe(value.score)) && (!own(value, 'legacyQuizScore') || validScore(value.legacyQuizScore?.score, value.legacyQuizScore?.total)));
  for (const [id, attempt] of Object.entries(document.attempts)) local(validUUID(id) && attempt.attemptId === id && validId(attempt.lessonId) && validAttempt(attempt));
  const ids = new Set();
  for (const operation of document.operations) {
    local(record(operation) && validUUID(operation.id) && !ids.has(operation.id) && ['course', 'quiz'].includes(operation.type) &&
      ['pending', 'confirmed', 'conflict', 'blocked', 'error'].includes(operation.state) && safe(operation.failures) &&
      Number.isFinite(operation.retryAt) && (operation.dependsOn === null || validUUID(operation.dependsOn)) &&
      operation.lessonId === operation.payload?.p_lesson_id && equal(operation.payload, operation.rpcPayload));
    local(operation.type === 'course' ? validCoursePayload(operation.payload, operation.id) && operation.expectedRevision === operation.payload.p_expected_revision
      : validQuizPayload(operation.payload, operation.id) && operation.expectedRevision === null && operation.dependsOn === null && own(document.attempts, operation.id));
    if (operation.type === 'quiz' && operation.state !== 'conflict') {
      const attempt = document.attempts[operation.id]; const p = operation.payload;
      local(attempt.lessonId === operation.lessonId && attempt.score === p.p_score && attempt.total === p.p_total && sameTime(attempt.completedAt, p.p_completed_at));
    }
    // A dependency must be a preceding course intent in the same chain. This
    // rejects self references/cycles before traversal or a single request.
    const predecessor = operation.dependsOn && document.operations.find(item => item.id === operation.dependsOn);
    local(operation.dependsOn === null || ids.has(operation.dependsOn) && predecessor?.type === 'course' &&
      predecessor.lessonId === operation.lessonId && operation.expectedRevision === predecessor.expectedRevision + 1);
    ids.add(operation.id);
  }
  for (const conflict of document.conflicts) local(record(conflict) && typeof conflict.id === 'string' &&
    ['course', 'quiz'].includes(conflict.kind) && validId(conflict.lessonId) && typeof conflict.resolved === 'boolean' &&
    record(conflict.operation) && ids.has(conflict.operation.id) && (conflict.remote === null || record(conflict.remote)));
  for (const manifest of document.imports) {
    local(record(manifest) && validUUID(manifest.id) && validUUID(manifest.provenance) &&
      typeof manifest.raw === 'string' && record(manifest.attemptIds) && Object.values(manifest.attemptIds).every(validUUID) &&
      new Set(Object.values(manifest.attemptIds)).size === Object.keys(manifest.attemptIds).length &&
      Array.isArray(manifest.operationIds) && manifest.operationIds.every(id => validUUID(id) && ids.has(id)) &&
      new Set(manifest.operationIds).size === manifest.operationIds.length &&
      record(manifest.summary) && ['courses', 'attempts', 'legacyScores'].every(key => safe(manifest.summary[key])) &&
      manifest.summary.attempts === Object.keys(manifest.attemptIds).length && Array.isArray(manifest.warnings));
    let source;
    try { source = JSON.parse(manifest.raw); } catch { local(false); }
    local(record(source));
    for (const [position, id] of Object.entries(manifest.attemptIds)) {
      let coordinates;
      try { coordinates = JSON.parse(position); } catch { local(false); }
      local(Array.isArray(coordinates) && coordinates.length === 3 && validId(coordinates[0]) && coordinates[1] === 'quizAttempts' && safe(coordinates[2]));
      const [lessonId, , index] = coordinates;
      const saved = get(source, lessonId);
      local(Array.isArray(saved?.quizAttempts) && validAttempt(saved.quizAttempts[index]) && manifest.operationIds.includes(id));
      const attempt = saved.quizAttempts[index];
      const operation = document.operations.find(item => item.id === id);
      local(operation?.type === 'quiz' && operation.lessonId === lessonId && operation.payload.p_score === attempt.score &&
        operation.payload.p_total === attempt.total && operation.payload.p_completed_at === attempt.completedAt);
    }
  }
  // Validate cached SQL rows too. A corrupted queue or owner must never be sent.
  let userId; try { userId = JSON.parse(scope)[2]; } catch { local(false); }
  try { validateRemote(document.remote, userId); } catch { local(false); }
  for (const row of document.remote.attempts) {
    const attempt = document.attempts[row.attempt_id];
    local(attempt && attempt.lessonId === row.lesson_id && attempt.score === row.score && attempt.total === row.total && sameTime(attempt.completedAt, row.completed_at));
  }
  for (const id of Object.keys(document.attempts)) local(document.operations.some(operation => operation.type === 'quiz' && operation.id === id) ||
    document.remote.attempts.some(row => row.attempt_id === id));
  return document;
}

function courseRow(row, userId) {
  protocol(record(row) && row.user_id === userId && row.schema_version === 1 && validId(row.lesson_id) &&
    typeof row.done === 'boolean' && (row.best_score === null || safe(row.best_score)) &&
    (row.legacy_score === null && row.legacy_total === null || validScore(row.legacy_score, row.legacy_total)) &&
    validUUID(row.operation_id) && safe(row.base_revision) && safe(row.revision) && row.revision > 0 &&
    row.revision === row.base_revision + 1 && timestamp(row.created_at) && timestamp(row.updated_at));
}
function attemptRow(row, userId) {
  protocol(record(row) && row.user_id === userId && row.schema_version === 1 && validUUID(row.attempt_id) && validId(row.lesson_id) &&
    validAttempt({ score: row.score, total: row.total, completedAt: row.completed_at }) && timestamp(row.created_at));
}
export function validateRemote(history, userId) {
  protocol(Array.isArray(history?.courses) && Array.isArray(history?.attempts));
  const keys = new Set(); const ids = new Set();
  for (const row of history.courses) { courseRow(row, userId); protocol(!keys.has(row.lesson_id)); keys.add(row.lesson_id); }
  for (const row of history.attempts) { attemptRow(row, userId); protocol(!ids.has(row.attempt_id)); ids.add(row.attempt_id); }
  return history;
}
function fromCourse(row) {
  const result = { done: row.done };
  if (row.best_score !== null) result.score = row.best_score;
  if (row.legacy_score !== null) result.legacyQuizScore = { score: row.legacy_score, total: row.legacy_total };
  return result;
}
const fromAttempt = row => ({ attemptId: row.attempt_id, lessonId: row.lesson_id, score: row.score, total: row.total, completedAt: row.completed_at });
function rowMatches(operation, row) {
  const p = operation.rpcPayload;
  return operation.type === 'course' ? row.lesson_id === p.p_lesson_id && row.operation_id === operation.id &&
    row.base_revision === p.p_expected_revision && row.revision === p.p_expected_revision + 1 && row.done === p.p_done &&
    row.best_score === p.p_best_score && row.legacy_score === p.p_legacy_score && row.legacy_total === p.p_legacy_total
    : row.attempt_id === operation.id && row.lesson_id === p.p_lesson_id && row.score === p.p_score && row.total === p.p_total && sameTime(row.completed_at, p.p_completed_at);
}
function newOperation(document, type, lessonId, payload, id, dependsOn = null) {
  if (document.operations.some(item => item.id === id) || own(document.attempts, id)) throw new CourseQuizSyncError('identity', 'Cet UUID est déjà utilisé. Aucune tentative n’a été remplacée.');
  const operation = { id, type, lessonId, payload: clone(payload), rpcPayload: clone(payload), dependsOn,
    expectedRevision: type === 'course' ? payload.p_expected_revision : null, state: 'pending', failures: 0, retryAt: 0, error: null };
  document.operations.push(operation); return operation;
}
function currentCourse(document, lessonId) { return clone(get(document.courses, lessonId) || { done: false }); }
function queueCourse(document, lessonId, state, randomUUID, { allowConflict = false } = {}) {
  if (!allowConflict && document.conflicts.some(item => !item.resolved && item.lessonId === lessonId && item.kind === 'course'))
    throw new CourseQuizSyncError('conflict', 'Résous le conflit du cours avant de modifier son état. Les QCM restent disponibles.');
  const previous = document.operations.findLast(item => item.type === 'course' && item.lessonId === lessonId && ['pending', 'error'].includes(item.state));
  const base = previous ? previous.expectedRevision + 1 : document.remote.courses.find(row => row.lesson_id === lessonId)?.revision || 0;
  if (!safe(base) || base === Number.MAX_SAFE_INTEGER) throw new LocalCourseQuizError('La révision du cours est indisponible.');
  const id = freshUUID(randomUUID);
  const payload = { p_lesson_id: lessonId, p_done: state.done, p_best_score: state.score ?? null,
    p_legacy_score: state.legacyQuizScore?.score ?? null, p_legacy_total: state.legacyQuizScore?.total ?? null,
    p_operation_id: id, p_expected_revision: base };
  newOperation(document, 'course', lessonId, payload, id, previous?.id || null);
  put(document.courses, lessonId, clone(state)); return id;
}
export function mutateCourse(document, lessonId, done, randomUUID = () => globalThis.crypto.randomUUID()) {
  if (!validId(lessonId) || typeof done !== 'boolean') throw new CourseQuizSyncError('validation', 'État du cours invalide.');
  const state = currentCourse(document, lessonId);
  // Include a best score learned from immutable attempts without inferring done.
  const projected = get(projectProgress(document), lessonId);
  if (safe(projected?.score)) state.score = projected.score;
  state.done = done;
  const operationId = queueCourse(document, lessonId, state, randomUUID);
  return { operationId, progress: projectProgress(document) };
}
export function recordPersonalQuiz(document, lessonId, attempt, randomUUID = () => globalThis.crypto.randomUUID()) {
  if (!validId(lessonId) || !validAttempt(attempt)) throw new CourseQuizSyncError('validation', 'Score ou date du QCM invalide.');
  const id = freshUUID(randomUUID);
  enqueueImportedQuiz(document, lessonId, attempt, id);
  const before = currentCourse(document, lessonId);
  const knownBest = get(projectProgress(document), lessonId)?.score ?? 0;
  const state = clone(before); state.score = Math.max(before.score ?? 0, knownBest, attempt.score);
  if (attempt.score === attempt.total) state.done = true;
  if (!equal(before, state)) {
    const conflict = document.conflicts.some(item => !item.resolved && item.kind === 'course' && item.lessonId === lessonId);
    if (!conflict) queueCourse(document, lessonId, state, randomUUID);
    else {
      // Preserve the new perfect-score intention as another conflict. The
      // immutable quiz is still sent independently, never lost to course CAS.
      const opId = queueCourse(document, lessonId, state, randomUUID, { allowConflict: true });
      archiveConflict(document, document.operations.find(item => item.id === opId), document.remote.courses.find(row => row.lesson_id === lessonId) || null);
      rebuildCourses(document);
    }
  }
  return { attempt: clone(document.attempts[id]), progress: projectProgress(document) };
}
/** Import reuses the identity/payload rules, with no historical done inference. */
export function enqueueImportedQuiz(document, lessonId, attempt, id) {
  if (!validUUID(id) || !validId(lessonId) || !validAttempt(attempt)) throw new CourseQuizSyncError('validation');
  const payload = { p_attempt_id: id, p_lesson_id: lessonId, p_score: attempt.score, p_total: attempt.total, p_completed_at: attempt.completedAt };
  newOperation(document, 'quiz', lessonId, payload, id);
  document.attempts[id] = { attemptId: id, lessonId, score: attempt.score, total: attempt.total, completedAt: attempt.completedAt };
  return id;
}
export function enqueueImportedCourse(document, lessonId, state, randomUUID) {
  const row = document.remote.courses.find(item => item.lesson_id === lessonId);
  const id = queueCourse(document, lessonId, state, randomUUID);
  // An imported historical done flag has no reliable modification date. A
  // global import confirmation must not silently reverse a known server flag.
  if (row && row.done !== state.done) {
    archiveConflict(document, document.operations.find(item => item.id === id), row);
    rebuildCourses(document);
  }
  return id;
}
function archiveConflict(document, operation, remote) {
  const id = `${operation.type}:${operation.id}`;
  if (!document.conflicts.some(item => item.id === id)) document.conflicts.push({ id, kind: operation.type, lessonId: operation.lessonId,
    operation: clone(operation), local: currentCourse(document, operation.lessonId), remote: clone(remote), resolved: false });
  operation.state = 'conflict'; operation.error = 'conflict';
  for (const dependent of document.operations) if (dependent.dependsOn === operation.id && dependent.state !== 'confirmed') {
    dependent.state = 'blocked'; dependent.error = 'dependency_conflict'; blockChildren(document, dependent.id);
  }
}
function blockChildren(document, id) {
  for (const operation of document.operations) if (operation.dependsOn === id && operation.state !== 'confirmed') {
    operation.state = 'blocked'; operation.error = 'dependency_conflict'; blockChildren(document, operation.id);
  }
}
function mergeCourse(document, row) {
  const previous = document.remote.courses.find(item => item.lesson_id === row.lesson_id);
  if (previous && previous.revision > row.revision) return;
  if (previous?.revision === row.revision) protocol(equal(previous, row));
  document.remote.courses = [...document.remote.courses.filter(item => item.lesson_id !== row.lesson_id), clone(row)];
}
function mergeAttempt(document, row) {
  const previous = document.remote.attempts.find(item => item.attempt_id === row.attempt_id);
  if (previous) protocol(equal(previous, row));
  document.remote.attempts = [...document.remote.attempts.filter(item => item.attempt_id !== row.attempt_id), clone(row)];
}
function rebuildCourses(document) {
  const courses = {};
  for (const row of document.remote.courses) put(courses, row.lesson_id, fromCourse(row));
  // Pending intents are applied in their durable creation order. Conflicts
  // show the server's state while their local intent remains in the archive.
  for (const operation of document.operations) if (operation.type === 'course' && ['pending', 'error'].includes(operation.state)) {
    const p = operation.payload;
    put(courses, operation.lessonId, fromCourse({ done: p.p_done, best_score: p.p_best_score, legacy_score: p.p_legacy_score, legacy_total: p.p_legacy_total }));
  }
  document.courses = courses;
}
export function reconcileHistory(document, history, userId, nowISO = new Date().toISOString()) {
  validateRemote(history, userId);
  // Merge complete scans; a later-visible insertion or a temporary omission
  // must not delete an immutable result already committed in the cache.
  for (const row of history.courses) mergeCourse(document, row);
  for (const row of history.attempts) mergeAttempt(document, row);
  for (const operation of document.operations) {
    if (!['pending', 'error'].includes(operation.state)) continue;
    const row = operation.type === 'course' ? document.remote.courses.find(item => item.lesson_id === operation.lessonId)
      : document.remote.attempts.find(item => item.attempt_id === operation.id);
    if (!row) continue;
    if (rowMatches(operation, row)) operation.state = 'confirmed';
    else if (operation.type === 'quiz') archiveConflict(document, operation, row);
    else {
      const dependency = operation.dependsOn && document.operations.find(item => item.id === operation.dependsOn);
      // A predecessor may not yet have run. Its expected successor revision is
      // not concurrent with the current server base until the predecessor ends.
      if (dependency && ['pending', 'error'].includes(dependency.state)) continue;
      if (row.revision > operation.expectedRevision || row.operation_id === operation.id) archiveConflict(document, operation, row);
    }
  }
  for (const row of document.remote.attempts) {
    const operation = document.operations.find(item => item.type === 'quiz' && item.id === row.attempt_id);
    if (operation?.state === 'conflict') delete document.attempts[row.attempt_id];
    document.attempts[row.attempt_id] = fromAttempt(row);
  }
  rebuildCourses(document); document.lastReconciledAt = nowISO; return document;
}
export function prepareNextOperation(document, now = Date.now()) {
  for (const operation of document.operations) {
    if (operation.state !== 'pending' || operation.retryAt > now) continue;
    if (operation.dependsOn) {
      const dependency = document.operations.find(item => item.id === operation.dependsOn);
      if (dependency?.state !== 'confirmed') continue;
      const row = document.remote.courses.find(item => item.lesson_id === operation.lessonId);
      if (!row || row.revision !== operation.expectedRevision) { archiveConflict(document, operation, row || null); rebuildCourses(document); continue; }
    }
    return clone(operation);
  }
  return null;
}
export function acknowledgeOperation(document, operationId, result, userId) {
  const operation = document.operations.find(item => item.id === operationId);
  if (!operation || operation.state !== 'pending') return;
  protocol(result && ['inserted', 'updated', 'replayed', 'conflict'].includes(result.status));
  if (operation.type === 'quiz') protocol(result.status !== 'updated');
  const row = result.row;
  if (row !== null) {
    if (operation.type === 'course') courseRow(row, userId); else attemptRow(row, userId);
    protocol(operation.type === 'course' ? row.lesson_id === operation.lessonId : row.attempt_id === operation.id);
  }
  if (result.status === 'conflict') {
    archiveConflict(document, operation, row);
    if (row) { if (operation.type === 'course') mergeCourse(document, row); else mergeAttempt(document, row); }
  } else {
    protocol(row && rowMatches(operation, row));
    if (operation.type === 'course') protocol(result.status === 'replayed' ||
      (operation.expectedRevision === 0 ? result.status === 'inserted' : result.status === 'updated'));
    operation.state = 'confirmed'; operation.error = null;
    if (operation.type === 'course') mergeCourse(document, row); else mergeAttempt(document, row);
  }
  reconcileHistory(document, { courses: [], attempts: [] }, userId, document.lastReconciledAt || new Date().toISOString());
}
export function resolveConflict(document, id, choice = 'remote', randomUUID = () => globalThis.crypto.randomUUID()) {
  const conflict = document.conflicts.find(item => item.id === id && !item.resolved);
  if (!conflict || conflict.kind !== 'course' || !['remote', 'local'].includes(choice))
    throw new CourseQuizSyncError('conflict', 'Ce conflit d’identité exige une intervention. Les données sont conservées.');
  const row = document.remote.courses.find(item => item.lesson_id === conflict.lessonId);
  // A null conflict does not grant permission to recreate a missing row.
  if (!row) throw new CourseQuizSyncError('conflict', 'Actualise le compte avant de résoudre ce conflit.');
  const localIntent = clone(conflict.local);
  for (const item of document.conflicts) if (item.lessonId === conflict.lessonId && item.kind === 'course' && !item.resolved) {
    item.resolved = true; item.resolution = choice;
  }
  rebuildCourses(document);
  if (choice === 'local') {
    const state = fromCourse(row); state.done = localIntent.done;
    const score = Math.max(state.score ?? 0, localIntent.score ?? 0, get(projectProgress(document), conflict.lessonId)?.score ?? 0);
    if (own(state, 'score') || own(localIntent, 'score') || score > 0) state.score = score;
    if (!state.legacyQuizScore && localIntent.legacyQuizScore) state.legacyQuizScore = clone(localIntent.legacyQuizScore);
    queueCourse(document, conflict.lessonId, state, randomUUID);
  }
  return { progress: projectProgress(document) };
}
/** Adapter for the unchanged exam-stats engine. No done inference from score. */
export function projectProgress(document) {
  const result = clone(document.courses);
  for (const attempt of Object.values(document.attempts)) {
    const item = get(result, attempt.lessonId) || put(result, attempt.lessonId, { done: false });
    item.score = Math.max(item.score ?? 0, attempt.score);
    (item.quizAttempts ||= []).push({ attemptId: attempt.attemptId, score: attempt.score, total: attempt.total, completedAt: attempt.completedAt });
  }
  for (const item of Object.values(result)) if (item.quizAttempts) item.quizAttempts.sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt) || a.attemptId.localeCompare(b.attemptId));
  return result;
}
