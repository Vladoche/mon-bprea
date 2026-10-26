/** Personal botanical history. The existing engine remains the only evaluator
 * and statistics implementation; this module validates persistence contracts. */
export const clone = value => structuredClone(value);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => Object.hasOwn(value, key);
const put = (target, key, value) => Object.defineProperty(target, key, { value, enumerable: true, configurable: true, writable: true });
const safe = value => Number.isSafeInteger(value) && value >= 0;
export const validId = value => typeof value === 'string' && [...value].length > 0 && [...value].length <= 200 &&
  value.replace(/^[\t\n\v\f\r \u00a0]+|[\t\n\v\f\r \u00a0]+$/g, '').length > 0 &&
  !/\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(value);
export const validUUID = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) && value !== '00000000-0000-0000-0000-000000000000';
export class BotanicalSyncError extends Error {
  constructor(code = 'protocol', message = 'La synchronisation botanique est incohérente. Les données sont conservées.') { super(message); this.code = code; }
}
export class LocalBotanicalError extends Error {
  constructor(message = 'Les résultats botaniques n’ont pas été enregistrés : le stockage personnel est inaccessible ou plein. Les données existantes sont conservées.') { super(message); this.code = 'local_storage'; }
}
const protocol = condition => { if (!condition) throw new BotanicalSyncError(); };
const local = condition => { if (!condition) throw new LocalBotanicalError('Le cache botanique est illisible ou d’une version inconnue. Il est conservé sans modification.'); };
const canonical = value => JSON.stringify(value, (_, item) => record(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
export const equal = (a, b) => canonical(a) === canonical(b);

/** Keep PostgreSQL microseconds rather than rounding a source or receipt. */
export function normalizeTimestamp(value, remote = false) {
  const pattern = remote ? /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/ : /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?Z$/;
  if (typeof value !== 'string' || !pattern.test(value) || Number(value.slice(0, 4)) < 1) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time) || time < Date.parse('0001-01-01T00:00:00Z') || time > Date.parse('9999-12-31T23:59:59.999Z')) return null;
  // Validate civil components before parsing, since Date.parse normalizes e.g. February 30.
  const civil = new Date(`${value.slice(0, 19)}Z`);
  if (!Number.isFinite(civil.getTime()) || civil.toISOString().slice(0, 19) !== value.slice(0, 19)) return null;
  const fraction = value.match(/\.(\d+)/)?.[1] || '';
  const iso = new Date(time).toISOString();
  return `${iso.slice(0, 19)}.${fraction.padEnd(6, '0')}Z`;
}
export function timestampValue(value) {
  const normalized = normalizeTimestamp(value, true);
  if (!normalized) throw new BotanicalSyncError('validation', 'Date botanique invalide.');
  return BigInt(Date.parse(normalized)) * 1000n + BigInt(normalized.slice(23, 26));
}
const sameTime = (a, b) => a === null || b === null ? a === b : timestampValue(a) === timestampValue(b);
const sessionFields = ['id', 'categoryId', 'mode', 'durationSeconds', 'revision', 'startedAt', 'totalQuestions', 'completedAt'];
const answerFields = ['id', 'sessionId', 'questionId', 'categoryId', 'speciesId', 'photoId', 'mode', 'revision', 'status', 'selectedSpeciesId', 'correct', 'elapsedMs', 'answeredAt'];
export function normalizeSession(value, { remote = false } = {}) {
  if (!record(value) || !validId(value.id) || !validId(value.categoryId) || !['discovery', 'chrono'].includes(value.mode) ||
    typeof value.revision !== 'boolean' || !Number.isFinite(value.durationSeconds) || value.durationSeconds < 1 || value.durationSeconds > 300) return null;
  const totalQuestions = Array.isArray(value.questions) ? value.questions.length : value.totalQuestions;
  const startedAt = normalizeTimestamp(value.startedAt, remote);
  const completedAt = value.completedAt == null ? null : normalizeTimestamp(value.completedAt, remote);
  if (!Number.isInteger(totalQuestions) || totalQuestions < 1 || totalQuestions > 10 || !startedAt ||
    value.completedAt != null && !completedAt || completedAt && timestampValue(completedAt) < timestampValue(startedAt)) return null;
  return { id: value.id, categoryId: value.categoryId, mode: value.mode, durationSeconds: value.durationSeconds, revision: value.revision,
    startedAt: value.startedAt, totalQuestions, completedAt: value.completedAt ?? null };
}
export function normalizePersonalAnswer(value, { remote = false } = {}) {
  if (!record(value) || !['id', 'sessionId', 'questionId', 'categoryId', 'speciesId', 'photoId'].every(key => validId(value[key])) ||
    value.id !== value.questionId || !['discovery', 'chrono'].includes(value.mode) || typeof value.revision !== 'boolean' ||
    !['correct', 'incorrect', 'timeout', 'skipped_image'].includes(value.status) || value.correct !== (value.status === 'correct') ||
    !safe(value.elapsedMs) || !normalizeTimestamp(value.answeredAt, remote)) return null;
  if (value.status === 'correct' && value.selectedSpeciesId !== value.speciesId ||
    value.status === 'incorrect' && (!validId(value.selectedSpeciesId) || value.selectedSpeciesId === value.speciesId) ||
    ['timeout', 'skipped_image'].includes(value.status) && value.selectedSpeciesId !== null || value.status === 'timeout' && value.mode !== 'chrono') return null;
  return Object.fromEntries(answerFields.map(key => [key, value[key]]));
}
export const sameSession = (a, b, completion = true) => sessionFields.filter(key => completion || key !== 'completedAt').every(key =>
  ['startedAt', 'completedAt'].includes(key) ? sameTime(a[key], b[key]) : a[key] === b[key]);
export const sameAnswer = (a, b) => answerFields.every(key => key === 'answeredAt' ? sameTime(a[key], b[key]) : a[key] === b[key]);
export function answerFitsSession(answer, session) {
  return answer.sessionId === session.id && ['categoryId', 'mode', 'revision'].every(key => answer[key] === session[key]) &&
    timestampValue(answer.answeredAt) >= timestampValue(session.startedAt) &&
    (session.completedAt === null || timestampValue(answer.answeredAt) <= timestampValue(session.completedAt));
}
export function fromSessionRow(row) {
  return { id: row.session_id, categoryId: row.category_id, mode: row.mode, durationSeconds: row.duration_seconds, revision: row.is_revision,
    startedAt: normalizeTimestamp(row.started_at, true), totalQuestions: row.total_questions,
    completedAt: row.completed_at === null ? null : normalizeTimestamp(row.completed_at, true) };
}
export function fromAnswerRow(row) {
  return { id: row.answer_id, sessionId: row.session_id, questionId: row.question_id, categoryId: row.category_id, speciesId: row.species_id,
    photoId: row.photo_id, mode: row.mode, revision: row.is_revision, status: row.status, selectedSpeciesId: row.selected_species_id,
    correct: row.correct, elapsedMs: row.elapsed_ms, answeredAt: normalizeTimestamp(row.answered_at, true) };
}
function sessionRow(row, userId) {
  protocol(record(row) && row.user_id === userId && row.schema_version === 1 && normalizeSession(fromSessionRow(row)) &&
    validUUID(row.operation_id) && safe(row.base_revision) && row.base_revision < Number.MAX_SAFE_INTEGER && row.revision === row.base_revision + 1 &&
    normalizeTimestamp(row.created_at, true) && normalizeTimestamp(row.updated_at, true));
}
function answerRow(row, userId) {
  protocol(record(row) && row.user_id === userId && row.schema_version === 1 && normalizePersonalAnswer(fromAnswerRow(row)) && normalizeTimestamp(row.created_at, true));
}
export function validateRemote(history, userId) {
  protocol(validUUID(userId) && Array.isArray(history?.sessions) && Array.isArray(history?.answers));
  const sessions = new Set(); const answers = new Set();
  for (const row of history.sessions) { sessionRow(row, userId); protocol(!sessions.has(row.session_id)); sessions.add(row.session_id); }
  for (const row of history.answers) { answerRow(row, userId); protocol(!answers.has(row.answer_id)); answers.add(row.answer_id); }
  return history;
}
export function emptyPersonalDocument(scope) {
  return { version: 1, scope, sessions: {}, answers: {}, operations: [], remote: { sessions: [], answers: [] }, conflicts: [], imports: [], importArchives: [], lastReconciledAt: null };
}
function freshUUID(document, randomUUID) {
  const id = randomUUID();
  if (!validUUID(id) || document.operations.some(item => item.id === id) || document.imports.some(item => item.id === id) || document.importArchives.some(item => item.id === id)) throw new LocalBotanicalError('Impossible de créer un identifiant d’opération durable et unique.');
  return id;
}
function queue(document, type, value, randomUUID, dependsOn = [], expectedRevision = null) {
  const id = freshUUID(document, randomUUID);
  const payload = type === 'answer' ? { p_answer: clone(value) } : { p_session: clone(value), p_operation_id: id, p_expected_revision: expectedRevision };
  const operation = { id, type, sessionId: type === 'answer' ? value.sessionId : value.id, questionId: type === 'answer' ? value.questionId : null,
    payload: clone(payload), rpcPayload: clone(payload), expectedRevision, dependsOn: [...dependsOn], state: 'pending', failures: 0, retryAt: 0, error: null };
  document.operations.push(operation); return operation;
}
// A human decision to retain the account version closes an archived intention;
// it does not acknowledge that the rejected local payload reached the server.
// Future actions can depend on the retained history without waiting forever on
// these old intentions. Existing payloads and dependency lists stay immutable.
const resolvedArchive = (document, operation) => ['conflict', 'blocked'].includes(operation.state) &&
  document.conflicts.some(item => item.operation.id === operation.id && item.resolved && item.resolution === 'remote');
function archivedIntent(document, type, value) {
  const operation = document.operations.find(item => item.type === type && ['conflict', 'blocked'].includes(item.state) &&
    (type === 'answer' ? sameAnswer(item.payload.p_answer, value) : sameSession(item.payload.p_session, value)));
  return operation ? { operationId: operation.id, replayed: true, conflict: true,
    error: 'Cette intention possède déjà un conflit conservé. Examine l’historique du compte ; aucune autre opération n’a été créée.' } : null;
}
function rebuildHistory(document) {
  const sessions = {}; const answers = {};
  for (const row of document.remote.sessions) put(sessions, row.session_id, fromSessionRow(row));
  for (const row of document.remote.answers) put(answers, row.answer_id, fromAnswerRow(row));
  for (const operation of document.operations) if (['pending', 'error'].includes(operation.state)) {
    if (operation.type === 'answer') { if (!own(answers, operation.questionId)) put(answers, operation.questionId, clone(operation.payload.p_answer)); }
    else put(sessions, operation.sessionId, clone(operation.payload.p_session));
  }
  document.sessions = sessions; document.answers = answers;
}
export function archiveConflict(document, operation, remote = null, reason = 'conflict') {
  const conflictId = `${operation.type}:${operation.id}`;
  if (!document.conflicts.some(item => item.id === conflictId)) document.conflicts.push({ id: conflictId, kind: operation.type, sessionId: operation.sessionId,
    questionId: operation.questionId, operation: clone(operation), local: clone(operation.type === 'answer' ? operation.payload.p_answer : operation.payload.p_session),
    remote: clone(remote), reason, resolved: false });
  operation.state = 'conflict'; operation.error = reason;
  // Dependants remain archived, never rebound to a different session version.
  for (const child of document.operations) if (child.dependsOn.includes(operation.id) && !['confirmed', 'conflict', 'blocked'].includes(child.state)) {
    archiveConflict(document, child, null, 'dependency_conflict'); child.state = 'blocked';
  }
  rebuildHistory(document);
}
export function rejectOperation(document, operationId, error) {
  const operation = document.operations.find(item => item.id === operationId);
  if (!operation || operation.state !== 'pending') return;
  archiveConflict(document, operation, null, typeof error?.code === 'string' ? error.code : 'rejected');
}
export function recordPersonalSession(document, value, randomUUID = () => globalThis.crypto.randomUUID()) {
  const session = normalizeSession(value);
  if (!session) throw new BotanicalSyncError('validation', 'Métadonnées de session botaniques invalides.');
  const archived = archivedIntent(document, 'session', { ...session, completedAt: null });
  if (archived) return archived;
  const previous = own(document.sessions, session.id) ? document.sessions[session.id] : null;
  if (previous) {
    if (!sameSession(previous, session, false)) {
      const op = queue(document, 'session', { ...session, completedAt: null }, randomUUID, [], 0);
      archiveConflict(document, op, document.remote.sessions.find(row => row.session_id === session.id) || null, 'session_identity');
      return { operationId: op.id, conflict: true, error: 'Cet identifiant de session possède d’autres métadonnées. Les deux versions sont conservées.' };
    }
    if (session.completedAt !== null) return completePersonalSession(document, session.id, session.completedAt, randomUUID);
    return { replayed: true, history: projectHistory(document) };
  }
  const op = queue(document, 'session', { ...session, completedAt: null }, randomUUID, [], 0);
  rebuildHistory(document);
  if (session.completedAt !== null) completePersonalSession(document, session.id, session.completedAt, randomUUID);
  return { operationId: op.id, history: projectHistory(document) };
}
export function recordPersonalAnswer(document, value, randomUUID = () => globalThis.crypto.randomUUID()) {
  const answer = normalizePersonalAnswer(value);
  if (!answer) throw new BotanicalSyncError('validation', 'Réponse botanique invalide.');
  const archived = archivedIntent(document, 'answer', answer);
  if (archived) return archived;
  const previous = own(document.answers, answer.id) ? document.answers[answer.id] : null;
  if (previous && sameAnswer(previous, answer)) return { replayed: true, answer: clone(previous), history: projectHistory(document) };
  const creation = document.operations.find(item => item.type === 'session' && item.sessionId === answer.sessionId && item.state !== 'conflict');
  const op = queue(document, 'answer', answer, randomUUID, creation ? [creation.id] : []);
  const session = own(document.sessions, answer.sessionId) ? document.sessions[answer.sessionId] : null;
  let reason = previous ? 'answer_identity' : !session ? 'missing_session' : !answerFitsSession(answer, session) ? 'answer_metadata_or_dates' :
    Object.values(document.answers).filter(item => item.sessionId === answer.sessionId).length >= session.totalQuestions ? 'session_capacity' : null;
  if (document.operations.some(item => item.type === 'completion' && item.sessionId === answer.sessionId && item.state === 'pending')) reason ||= 'session_already_completed';
  if (reason) {
    archiveConflict(document, op, previous ? document.remote.answers.find(row => row.answer_id === answer.id) || null : null, reason);
    return { operationId: op.id, conflict: true, error: 'Cette réponse ne peut pas être ajoutée à l’historique. Sa version locale est conservée dans les conflits.' };
  }
  rebuildHistory(document); return { operationId: op.id, answer: clone(answer), history: projectHistory(document) };
}
export function completePersonalSession(document, sessionId, completedAt, randomUUID = () => globalThis.crypto.randomUUID()) {
  const previous = own(document.sessions, sessionId) ? document.sessions[sessionId] : null;
  if (!previous || !normalizeTimestamp(completedAt)) throw new BotanicalSyncError('validation', 'Session ou date de fin botanique invalide.');
  const archived = archivedIntent(document, 'completion', { ...previous, completedAt });
  if (archived) return archived;
  if (previous.completedAt !== null && sameTime(previous.completedAt, completedAt)) return { replayed: true, history: projectHistory(document) };
  const creation = document.operations.find(item => item.type === 'session' && item.sessionId === sessionId && ['pending', 'confirmed', 'error'].includes(item.state));
  const remote = document.remote.sessions.find(row => row.session_id === sessionId);
  const dependsOn = document.operations.filter(item => item.sessionId === sessionId && item.type !== 'completion' &&
    item.state !== 'confirmed' && !resolvedArchive(document, item)).map(item => item.id);
  const expectedRevision = remote?.revision ?? (creation ? creation.expectedRevision + 1 : 0);
  const session = { ...previous, completedAt };
  const op = queue(document, 'completion', session, randomUUID, dependsOn, expectedRevision);
  const invalidDate = timestampValue(completedAt) < timestampValue(previous.startedAt) ||
    Object.values(document.answers).some(answer => answer.sessionId === sessionId && timestampValue(answer.answeredAt) > timestampValue(completedAt));
  if (previous.completedAt !== null || invalidDate || !creation && !remote) {
    archiveConflict(document, op, remote || null, invalidDate ? 'completion_before_answer' : 'completion_conflict');
    return { operationId: op.id, conflict: true, error: invalidDate ? 'La fin de session précède une réponse ou son début. Les dates sont conservées ; aucune correction automatique n’est appliquée.' : 'Cette session possède déjà une autre fin. Les versions sont conservées.' };
  }
  rebuildHistory(document); return { operationId: op.id, history: projectHistory(document) };
}
function mergeSession(document, row) {
  const previous = document.remote.sessions.find(item => item.session_id === row.session_id);
  if (previous && previous.revision > row.revision) return;
  if (previous?.revision === row.revision) protocol(equal(previous, row));
  document.remote.sessions = [...document.remote.sessions.filter(item => item.session_id !== row.session_id), clone(row)];
}
function mergeAnswer(document, row) {
  const previous = document.remote.answers.find(item => item.answer_id === row.answer_id);
  if (previous) protocol(equal(previous, row));
  document.remote.answers = [...document.remote.answers.filter(item => item.answer_id !== row.answer_id), clone(row)];
}
function matches(operation, row) {
  return operation.type === 'answer' ? row.answer_id === operation.questionId && sameAnswer(operation.rpcPayload.p_answer, fromAnswerRow(row)) :
    row.session_id === operation.sessionId && row.operation_id === operation.id && row.base_revision === operation.expectedRevision &&
    row.revision === operation.expectedRevision + 1 && sameSession(operation.rpcPayload.p_session, fromSessionRow(row));
}
export function reconcileHistory(document, history, userId, nowISO = new Date().toISOString()) {
  validateRemote(history, userId);
  for (const row of history.sessions) mergeSession(document, row);
  for (const row of history.answers) mergeAnswer(document, row);
  // No remote answer is projected without a valid parent. A partial/malformed
  // scan fails atomically rather than making an orphan look like a new result.
  const all = document.remote;
  for (const row of all.answers) {
    const parent = all.sessions.find(item => item.session_id === row.session_id);
    protocol(parent && answerFitsSession(fromAnswerRow(row), fromSessionRow(parent)));
  }
  for (const parent of all.sessions) protocol(all.answers.filter(row => row.session_id === parent.session_id).length <= parent.total_questions);
  for (const operation of document.operations) {
    if (!['pending', 'error'].includes(operation.state)) continue;
    const row = operation.type === 'answer' ? all.answers.find(item => item.answer_id === operation.questionId) : all.sessions.find(item => item.session_id === operation.sessionId);
    if (!row) {
      if (operation.type === 'answer') {
        const parent = all.sessions.find(item => item.session_id === operation.sessionId);
        if (parent && !answerFitsSession(operation.payload.p_answer, fromSessionRow(parent))) archiveConflict(document, operation, null, 'answer_metadata_or_dates');
      }
      continue;
    }
    if (matches(operation, row)) { operation.state = 'confirmed'; operation.error = null; continue; }
    if (operation.type === 'answer') archiveConflict(document, operation, row, 'answer_identity');
    else {
      if (operation.dependsOn.some(id => ['pending', 'error'].includes(document.operations.find(item => item.id === id)?.state))) continue;
      if (row.revision > operation.expectedRevision || row.operation_id === operation.id || !sameSession(operation.payload.p_session, fromSessionRow(row), false))
        archiveConflict(document, operation, row, 'session_revision');
    }
  }
  for (const manifest of document.imports) {
    const states = manifest.operationIds.map(id => document.operations.find(operation => operation.id === id)?.state);
    manifest.state = states.some(state => ['conflict', 'blocked', 'error'].includes(state)) ? 'conflict' : states.every(state => state === 'confirmed') ? 'complete' : 'queued';
  }
  rebuildHistory(document); document.lastReconciledAt = nowISO; return document;
}
export function prepareNextOperation(document, now = Date.now()) {
  for (const operation of document.operations) {
    if (operation.state !== 'pending' || operation.retryAt > now || operation.dependsOn.some(id => document.operations.find(item => item.id === id)?.state !== 'confirmed')) continue;
    if (operation.type !== 'session') {
      const row = document.remote.sessions.find(item => item.session_id === operation.sessionId);
      if (!row) { archiveConflict(document, operation, null, 'missing_session'); continue; }
      const session = fromSessionRow(row);
      if (operation.type === 'answer' ? !answerFitsSession(operation.payload.p_answer, session) : row.revision !== operation.expectedRevision || !sameSession(operation.payload.p_session, session, false)) {
        archiveConflict(document, operation, row, 'session_revision_or_dates'); continue;
      }
    }
    return clone(operation);
  }
  return null;
}
export function acknowledgeOperation(document, operationId, result, userId) {
  const operation = document.operations.find(item => item.id === operationId);
  if (!operation || operation.state !== 'pending') return;
  protocol(record(result) && ['inserted', 'updated', 'replayed', 'conflict'].includes(result.status));
  const row = result.row;
  if (row !== null) {
    if (operation.type === 'answer') { answerRow(row, userId); protocol(row.answer_id === operation.questionId && row.question_id === operation.questionId); }
    else { sessionRow(row, userId); protocol(row.session_id === operation.sessionId); }
  }
  if (result.status === 'conflict') archiveConflict(document, operation, row);
  else {
    protocol(row && matches(operation, row));
    protocol(result.status === 'replayed' || result.status === (operation.type === 'completion' ? 'updated' : 'inserted'));
    operation.state = 'confirmed'; operation.error = null;
  }
  if (row) {
    if (operation.type === 'answer') {
      const parent = document.remote.sessions.find(item => item.session_id === row.session_id);
      // A conflicting result can belong to another valid historical parent.
      // Keep that complete row in the archive while waiting for a full scan;
      // never project an orphan or fabricate the missing session.
      if (parent && answerFitsSession(fromAnswerRow(row), fromSessionRow(parent))) mergeAnswer(document, row);
      else protocol(result.status === 'conflict');
    } else mergeSession(document, row);
  }
  reconcileHistory(document, { sessions: [], answers: [] }, userId, document.lastReconciledAt || new Date().toISOString());
}
export function resolveConflict(document, id, choice = 'remote') {
  const conflict = document.conflicts.find(item => item.id === id && !item.resolved);
  if (!conflict || choice !== 'remote') throw new BotanicalSyncError('conflict', 'Les résultats historiques sont immuables. Examine les versions puis conserve l’historique du compte ; la version locale reste archivée.');
  conflict.resolved = true; conflict.resolution = 'remote';
  // A parent decision also explicitly archives its dependant intents. They are
  // retained in place, without creating an alternative question identity.
  const ids = new Set([conflict.operation.id]);
  for (const operation of document.operations) if (operation.dependsOn.some(id => ids.has(id))) ids.add(operation.id);
  for (const item of document.conflicts) if (ids.has(item.operation.id)) { item.resolved = true; item.resolution = 'remote'; }
  rebuildHistory(document); return { history: projectHistory(document) };
}
export function projectHistory(document) {
  return { schemaVersion: 1, sessions: clone(Object.values(document.sessions)), answers: clone(Object.values(document.answers)) };
}
export function validatePersonalDocument(document, scope) {
  local(record(document) && document.version === 1 && document.scope === scope && record(document.sessions) && record(document.answers) &&
    Array.isArray(document.operations) && Array.isArray(document.conflicts) && Array.isArray(document.imports) && Array.isArray(document.importArchives) &&
    (document.lastReconciledAt === null || normalizeTimestamp(document.lastReconciledAt, true)));
  let userId; try { userId = JSON.parse(scope)[2]; validateRemote(document.remote, userId); } catch { local(false); }
  const ids = new Set();
  const questionIds = new Set();
  for (const operation of document.operations) {
    local(record(operation) && validUUID(operation.id) && !ids.has(operation.id) && ['session', 'answer', 'completion'].includes(operation.type) &&
      validId(operation.sessionId) && ['pending', 'confirmed', 'conflict', 'blocked', 'error'].includes(operation.state) && safe(operation.failures) &&
      Number.isFinite(operation.retryAt) && Array.isArray(operation.dependsOn) && new Set(operation.dependsOn).size === operation.dependsOn.length &&
      operation.dependsOn.every(id => ids.has(id) && document.operations.find(item => item.id === id)?.sessionId === operation.sessionId) && equal(operation.payload, operation.rpcPayload));
    if (operation.type === 'answer') {
      local(operation.expectedRevision === null && operation.questionId === operation.payload.p_answer?.questionId &&
        normalizePersonalAnswer(operation.payload.p_answer) && operation.sessionId === operation.payload.p_answer.sessionId && Object.keys(operation.payload).length === 1 &&
        Object.keys(operation.payload.p_answer).length === answerFields.length && operation.dependsOn.every(id => document.operations.find(item => item.id === id)?.type === 'session'));
      if (!['conflict', 'blocked'].includes(operation.state)) {
        local(!questionIds.has(operation.questionId)); questionIds.add(operation.questionId);
        const creation = document.operations.find(item => ids.has(item.id) && item.type === 'session' && item.sessionId === operation.sessionId && item.state !== 'conflict');
        local(!creation || operation.dependsOn.includes(creation.id));
      }
    }
    else {
      const payload = operation.payload; const session = payload.p_session;
      // Invalid temporal completions are durable conflicts, never sendable.
      const valid = normalizeSession(session) || operation.state === 'conflict' && operation.error === 'completion_before_answer' && normalizeSession({ ...session, completedAt: null }) && normalizeTimestamp(session.completedAt);
      local(valid && operation.questionId === null && session.id === operation.sessionId && safe(operation.expectedRevision) && operation.expectedRevision < Number.MAX_SAFE_INTEGER &&
        payload.p_expected_revision === operation.expectedRevision && payload.p_operation_id === operation.id && Object.keys(payload).length === 3 && Object.keys(session).length === sessionFields.length &&
        (operation.type === 'session' ? operation.expectedRevision === 0 && session.completedAt === null && operation.dependsOn.length === 0 :
          operation.expectedRevision > 0 && session.completedAt !== null && operation.dependsOn.every(id => ['session', 'answer'].includes(document.operations.find(item => item.id === id)?.type))));
      if (operation.type === 'completion' && ['pending', 'error'].includes(operation.state)) {
        local(document.operations.filter(item => ids.has(item.id) && item.sessionId === operation.sessionId && ['session', 'answer'].includes(item.type) &&
          item.state !== 'confirmed' && !resolvedArchive(document, item))
          .every(item => operation.dependsOn.includes(item.id)));
      }
    }
    ids.add(operation.id);
  }
  for (const conflict of document.conflicts) local(record(conflict) && typeof conflict.id === 'string' && ['session', 'answer', 'completion'].includes(conflict.kind) &&
    validId(conflict.sessionId) && typeof conflict.resolved === 'boolean' && record(conflict.operation) && ids.has(conflict.operation.id) &&
    typeof conflict.reason === 'string' && (conflict.remote === null || record(conflict.remote)));
  for (const manifest of document.imports) {
    local(record(manifest) && validUUID(manifest.id) && !ids.has(manifest.id) && validUUID(manifest.provenance) && typeof manifest.raw === 'string' &&
      Array.isArray(manifest.operationIds) && new Set(manifest.operationIds).size === manifest.operationIds.length && manifest.operationIds.every(id => ids.has(id)) &&
      record(manifest.sessionIds) && record(manifest.questionIds) && Object.values(manifest.sessionIds).every(validId) && Object.values(manifest.questionIds).every(validId) &&
      new Set(Object.values(manifest.sessionIds)).size === Object.keys(manifest.sessionIds).length && new Set(Object.values(manifest.questionIds)).size === Object.keys(manifest.questionIds).length &&
      record(manifest.summary) && ['sessions', 'answers', 'refused'].every(key => safe(manifest.summary[key])) && Array.isArray(manifest.warnings) && ['queued', 'complete', 'conflict'].includes(manifest.state));
    let source; try { source = JSON.parse(manifest.raw); } catch { local(false); }
    local(source?.schemaVersion === 1 && Array.isArray(source.sessions) && Array.isArray(source.answers));
    local(manifest.summary.sessions === Object.keys(manifest.sessionIds).length && manifest.summary.answers === Object.keys(manifest.questionIds).length);
    for (const [index, id] of Object.entries(manifest.sessionIds)) {
      const session = normalizeSession(source.sessions[Number(index)]);
      local(/^\d+$/.test(index) && session?.id === id && manifest.operationIds.some(opId => {
        const op = document.operations.find(item => item.id === opId); return op?.type === 'session' && op.sessionId === id && sameSession(op.payload.p_session, session, false);
      }));
      if (session.completedAt !== null) local(manifest.operationIds.some(opId => {
        const op = document.operations.find(item => item.id === opId); return op?.type === 'completion' && op.sessionId === id && sameSession(op.payload.p_session, session);
      }));
    }
    for (const [index, id] of Object.entries(manifest.questionIds)) {
      const answer = normalizePersonalAnswer(source.answers[Number(index)]);
      local(/^\d+$/.test(index) && answer?.id === id && manifest.operationIds.some(opId => {
        const op = document.operations.find(item => item.id === opId); return op?.type === 'answer' && op.questionId === id && sameAnswer(op.payload.p_answer, answer);
      }));
    }
  }
  const archiveIds = new Set();
  for (const archive of document.importArchives) {
    local(record(archive) && validUUID(archive.id) && !ids.has(archive.id) && !archiveIds.has(archive.id) && validUUID(archive.provenance) &&
      typeof archive.raw === 'string' && typeof archive.reason === 'string' && typeof archive.message === 'string');
    archiveIds.add(archive.id);
  }
  for (const [id, session] of Object.entries(document.sessions)) local(id === session.id && normalizeSession(session));
  for (const [id, answer] of Object.entries(document.answers)) local(id === answer.id && normalizePersonalAnswer(answer) && own(document.sessions, answer.sessionId) && answerFitsSession(answer, document.sessions[answer.sessionId]));
  for (const row of document.remote.answers) {
    const parent = document.remote.sessions.find(item => item.session_id === row.session_id);
    local(parent && answerFitsSession(fromAnswerRow(row), fromSessionRow(parent)));
  }
  for (const parent of document.remote.sessions) local(document.remote.answers.filter(row => row.session_id === parent.session_id).length <= parent.total_questions);
  const rebuilt = clone(document); rebuildHistory(rebuilt);
  local(equal(rebuilt.sessions, document.sessions) && equal(rebuilt.answers, document.answers));
  return document;
}
