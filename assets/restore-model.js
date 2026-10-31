import { TABLES, CACHES, MAX_BYTES, MAX_ROWS } from './export-sources.js';
import { projectLocal, projectRow, DICTIONARY } from './export-model.js';
import { personalScope, validatePersonalDocument as validateDrill } from './drill-personal-store.js';
import { remoteDocument } from './drill-sync-model.js';
import { validateRemote as validateCourses, validatePersonalDocument as validateCourseCache, validUUID } from './course-quiz-model.js';
import { validateRemote as validateBotanical, validatePersonalDocument as validateBotanicalCache, normalizeTimestamp, reconcileHistory as reconcileBotanical, emptyPersonalDocument as emptyBotanical } from './botanical-sync-model.js';
import { validateRow, validateSettingsDocument } from './settings-model.js';

export class RestoreError extends Error {
  constructor(code = 'invalid') { super(code); this.code = code; }
}
export const failRestore = code => { throw new RestoreError(code); };
export const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const canonical = value => JSON.stringify(value, (_, item) => record(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const check = (condition, code = 'invalid') => { if (!condition) failRestore(code); };
const keys = (value, allowed, required = allowed) => check(record(value) && required.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => allowed.includes(key)));
const safe = value => Number.isSafeInteger(value) && value >= 0;
const operationStates = ['pending', 'confirmed', 'conflict', 'blocked', 'error'];
function sameConflictOperation(left, right) {
  if (!record(left) || !record(right) || !validUUID(left.id)) return false;
  const { state: leftState, ...leftContent } = left;
  const { state: rightState, ...rightContent } = right;
  // A conflict keeps the snapshot taken before the live operation changes state.
  // Its identity, payload and delivery metadata must still match exactly.
  return operationStates.includes(leftState) && operationStates.includes(rightState) &&
    canonical(leftContent) === canonical(rightContent);
}
const dateKeys = new Set(['generatedAt', 'created_at', 'updated_at', 'started_at', 'answered_at', 'completed_at', 'client_updated_at', 'email_confirmed_at', 'last_sign_in_at', 'startedAt', 'answeredAt', 'completedAt', 'updatedAt', 'lastReconciledAt']);

// JSON.parse keeps only the last duplicate member. Detect those before parsing
// so an ambiguous identity/operation/map entry cannot disappear during decoding.
function uniqueMembers(text) {
  const stack = [];
  for (let i = 0; i < text.length; i++) {
    const char = text[i], frame = stack.at(-1);
    if (char === '"') {
      const start = i++;
      for (; i < text.length && text[i] !== '"'; i++) if (text[i] === '\\') i++;
      if (frame?.keys && frame.expectKey) {
        let key; try { key = JSON.parse(text.slice(start, i + 1)); } catch { failRestore('json'); }
        check(!frame.keys.has(key), 'duplicate'); frame.keys.add(key); frame.expectKey = false;
      }
    } else if (char === '{' || char === '[') { stack.push(char === '{' ? { keys: new Set(), expectKey: true } : {}); check(stack.length <= 31, 'volume'); }
    else if (char === '}' || char === ']') stack.pop();
    else if (char === ',' && frame?.keys) frame.expectKey = true;
  }
}

// Bounded traversal before domain validators, with no merge or dynamic access.
function bounds(value, depth = 0, state = { nodes: 0 }) {
  check(depth <= 30 && ++state.nodes <= 1500000, 'volume');
  if (typeof value === 'string') check(value.length <= MAX_BYTES, 'volume');
  if (Array.isArray(value)) { check(value.length <= MAX_ROWS, 'volume'); for (const item of value) bounds(item, depth + 1, state); }
  else if (record(value)) for (const [key, item] of Object.entries(value)) {
    // Structural dangerous keys are rejected by the explicit projections below;
    // legitimate map identities (including constructor) remain own data keys.
    check(key.length <= 1000, 'volume');
    if (dateKeys.has(key) && item !== null && !record(item) && !Array.isArray(item)) check(Boolean(normalizeTimestamp(item, true)), 'date');
    bounds(item, depth + 1, state);
  }
}

export function validateServer(server, userId) {
  keys(server, Object.keys(TABLES), []);
  let count = 0;
  for (const [name, rows] of Object.entries(server)) {
    check(Array.isArray(rows)); count += rows.length; check(count <= MAX_ROWS, 'volume');
    const spec = TABLES[name], ids = new Set();
    for (const row of rows) {
      check(record(row) && row[spec.owner] === userId, 'ownership');
      check(canonical(projectRow(name, row, userId)) === canonical(row));
      check(!ids.has(row[spec.key]), 'duplicate'); ids.add(row[spec.key]);
      for (const field of ['id', 'operation_id', 'series_id', 'attempt_id']) if (Object.hasOwn(row, field)) check(validUUID(row[field]), 'uuid');
      if (name === 'profiles') check(row.pseudo === null || typeof row.pseudo === 'string' && [...row.pseudo].length <= 40);
    }
    if (['profiles', 'itk_settings', 'appearance_preferences'].includes(name)) check(rows.length <= 1, 'duplicate');
  }
  const drill = { series: server.drill_series || [], answers: server.drill_answers || [], training: server.drill_training_attempts || [] };
  remoteDocument(drill, userId);
  validateCourses({ courses: server.course_states || [], attempts: server.quiz_attempts || [] }, userId);
  const botanical = { sessions: server.botanical_sessions || [], answers: server.botanical_answers || [] };
  validateBotanical(botanical, userId);
  reconcileBotanical(emptyBotanical('validation'), botanical, userId, '2026-01-01T00:00:00Z');
  for (const domain of ['itk', 'appearance']) for (const row of server[domain === 'itk' ? 'itk_settings' : 'appearance_preferences'] || []) validateRow(domain, row, userId);
  return server;
}

function localDocument(domain, source, scope) {
  check(record(source) && source.scope === scope, 'ownership');
  check(source.version === 1, 'version');
  const { excludedArchives, ...rest } = source;
  const projected = projectLocal(domain, { ...rest, importArchives: excludedArchives || [] }, scope, { allowMapKeys: true });
  check(projected.omitted === 0 && canonical(projected.data) === canonical(source));
  for (const item of source.excludedArchives || []) check(validUUID(item.id) && validUUID(item.provenance), 'archive');
  for (const item of source.imports || []) {
    check(validUUID(item.id) && (item.provenance === undefined || validUUID(item.provenance)), 'archive');
    for (const name of ['operationIds', 'attemptIds', 'sessionIds', 'questionIds']) if (item[name] !== undefined) {
      const values = name === 'operationIds' ? item[name] : Object.values(item[name]);
      check(Array.isArray(values) && new Set(values).size === values.length, 'duplicate');
    }
  }
  for (const archive of source.archives || []) check(['confirmed', 'resolved-operation', 'resolved-conflict', 'resolved-dependent', 'superseded-unsent'].includes(archive.kind), 'archive');
  for (const conflict of source.conflicts) {
    check(typeof conflict.id === 'string' && typeof conflict.resolved === 'boolean', 'archive');
    if (conflict.operation) {
      const candidates = [...source.operations, ...(conflict.resolved ? (source.archives || [])
        .filter(item => item.kind === 'resolved-operation').map(item => item.operation) : [])];
      check(candidates.some(op => op?.id === conflict.operation.id && sameConflictOperation(op, conflict.operation)), 'archive');
    }
  }
  // v1 deliberately excluded raw sources and manifest summaries. Validate the
  // executable part with its original domain validator, NEVER turn descriptors
  // into operational imports or restore incomplete manifests.
  const executable = { ...source, imports: [], importArchives: [], conflicts: [], archives: [] };
  if (domain === 'drill') { validateDrill(executable, scope); remoteDocument(source.remote, JSON.parse(scope)[2]); }
  if (domain === 'courses') validateCourseCache(executable, scope);
  if (domain === 'botanical') validateBotanicalCache(executable, scope);
  if (domain === 'settings') validateSettingsDocument(executable, scope);
  for (const op of source.operations) {
    check(validUUID(op.id), 'uuid');
    check(operationStates.includes(op.state));
    check(op.dependsOn === undefined || op.dependsOn === null || typeof op.dependsOn === 'string' || Array.isArray(op.dependsOn));
    if (domain === 'drill') {
      keys(op.payload, op.type === 'series' ? ['p_unit', 'p_week', 'p_started_at', 'p_questions'] : ['p_question_id', 'p_answer', 'p_answered_at', 'p_operation_id']);
      const series = source.drill.series[op.seriesKey];
      if (['pending', 'confirmed'].includes(op.state) && op.type !== 'series') {
        const question = series.questions.find(item => item.id === op.payload.p_question_id);
        check(question?.options.some(item => item.id === op.payload.p_answer));
        const first = Object.hasOwn(series.answers, op.payload.p_question_id) ? series.answers[op.payload.p_question_id] : null;
        check(first && (op.type === 'training' ? first.attempts : [first]).some(item => item.answer === op.payload.p_answer &&
          normalizeTimestamp(item.answeredAt, true) === normalizeTimestamp(op.payload.p_answered_at, true)), 'coherence');
      }
    }
  }
  return source;
}

/** JSON v1 only, read in memory. A status:partial archive remains valid. */
export function parseRestore(text) {
  try {
    check(typeof text === 'string'); check(new TextEncoder().encode(text).length <= MAX_BYTES, 'volume');
    uniqueMembers(text);
    let file; try { file = JSON.parse(text); } catch { failRestore('json'); }
    bounds(file);
    keys(file, ['exportFormatVersion', 'generatedAt', 'application', 'sourceScope', 'status', 'coverage', 'warnings', 'dictionary', 'data']);
    check(file.exportFormatVersion === 1, 'version'); check(file.application === 'Mon BPREA');
    check(Boolean(normalizeTimestamp(file.generatedAt, true)), 'date');
    check(file.sourceScope?.kind === 'account', 'unattributed');
    keys(file.sourceScope, ['kind', 'environment', 'supabaseOrigin', 'userId']);
    const s = file.sourceScope;
    check(validUUID(s.userId), 'uuid');
    check(['development', 'production'].includes(s.environment), 'environment');
    const endpoint = new URL(s.supabaseOrigin);
    check(endpoint.origin === s.supabaseOrigin && ['https:', 'http:'].includes(endpoint.protocol) && !endpoint.username && !endpoint.password, 'environment');
    const scope = personalScope({ environment: s.environment, url: s.supabaseOrigin, userId: s.userId });
    check(['partial', 'complete_accessible'].includes(file.status));
    check(Array.isArray(file.warnings) && file.warnings.every(item => typeof item === 'string' && item.length <= 10000));
    keys(file.dictionary, Object.keys(DICTIONARY), []); check(Object.values(file.dictionary).every(item => typeof item === 'string' && item.length <= 10000));
    keys(file.data, ['identity', 'server', 'personalLocal']);
    keys(file.data.identity, ['id', 'email', 'created_at', 'updated_at', 'email_confirmed_at', 'last_sign_in_at'], ['id']);
    check(file.data.identity.id === s.userId, 'ownership');
    check(Object.values(file.data.identity).every(item => item === null || typeof item === 'string'));
    validateServer(file.data.server, s.userId);
    keys(file.data.personalLocal, Object.keys(CACHES), []);
    for (const [domain, source] of Object.entries(file.data.personalLocal)) localDocument(domain, source, scope);
    check(Array.isArray(file.coverage) && file.coverage.length > 0 && file.coverage.length <= 15);
    const seen = new Set(), known = [...Object.keys(TABLES), ...Object.values(CACHES), 'Auth API'];
    for (const item of file.coverage) {
      keys(item, ['source', 'inventory', 'status', 'count', 'excludedFields', 'reason'], ['source', 'status']);
      check(known.includes(item.source) && !seen.has(item.source), 'coverage'); seen.add(item.source);
      check(['included', 'limited', 'absent', 'unavailable', 'invalid', 'future', 'ownership', 'blocked', 'volume', 'excluded'].includes(item.status), 'coverage');
      check(item.count === undefined || safe(item.count)); check(item.excludedFields === undefined || safe(item.excludedFields));
      check(item.inventory === undefined || typeof item.inventory === 'string'); check(item.reason == null || typeof item.reason === 'string');
      const domain = Object.keys(CACHES).find(key => CACHES[key] === item.source);
      const value = domain ? file.data.personalLocal[domain] : file.data.server[item.source];
      if (item.source !== 'Auth API') {
        check(['included', 'limited'].includes(item.status) ? value !== undefined : value === undefined || Array.isArray(value) && value.length === 0, 'coverage');
        if (Object.hasOwn(TABLES, item.source) && ['included', 'limited'].includes(item.status)) check(item.count === value.length, 'coverage');
      }
    }
    for (const name of Object.keys(file.data.server)) check(seen.has(name), 'coverage');
    for (const domain of Object.keys(file.data.personalLocal)) check(seen.has(CACHES[domain]), 'coverage');
    check(file.status === 'partial' || file.coverage.every(item => ['included', 'absent'].includes(item.status)), 'coverage');
    return file;
  } catch (error) { throw error instanceof RestoreError ? error : new RestoreError('invalid'); }
}

export function authorizeRestore(file, configuration, identity) {
  check(validUUID(identity?.id) && identity.id === file.sourceScope.userId, 'ownership');
  check(configuration.environment === file.sourceScope.environment && new URL(configuration.url).origin === file.sourceScope.supabaseOrigin, 'environment');
  return personalScope({ ...configuration, userId: identity.id });
}

export async function readRestoreFile(file) {
  check(file && Number.isSafeInteger(file.size) && file.size >= 0 && file.size <= MAX_BYTES, 'volume');
  // MIME and filename are intentionally not trusted. No URL, import(), HTML,
  // script, session or configuration is read from the selected content.
  return parseRestore(await file.text());
}
