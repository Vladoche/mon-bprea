import { crops } from './content.js';
import { validUUID } from './course-quiz-model.js';
export const clone = value => structuredClone(value);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const safe = value => Number.isSafeInteger(value) && value >= 0;
export const domains = ['itk', 'appearance'];
const canonical = value => JSON.stringify(value, (_, item) => record(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
export const equal = (a, b) => canonical(a) === canonical(b);
const keys = (value, allowed, required = allowed) => record(value) && required.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => allowed.includes(key));
const validText = value => typeof value === 'string' && !/\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(value);
const timestamp = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(value) || Number(value.slice(0, 4)) < 1 || !Number.isFinite(Date.parse(value))) return false;
  const date = new Date(0);
  date.setUTCFullYear(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)));
  date.setUTCHours(Number(value.slice(11, 13)), Number(value.slice(14, 16)), Number(value.slice(17, 19)), 0);
  return date.toISOString().slice(0, 19) === value.slice(0, 19);
};
function utc(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?Z$/.test(value) || Number(value.slice(0, 4)) < 1) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 19) === value.slice(0, 19);
}
function sameTime(a, b) {
  if (a == null || b == null) return a == null && b == null;
  if (!timestamp(a) || !timestamp(b)) return false;
  const micros = value => `${Date.parse(value)}:${String(value).match(/\.(\d+)/)?.[1].padEnd(6, '0').slice(3, 6) || '000'}`;
  return micros(a) === micros(b);
}
function validArea(text) {
  if (typeof text !== 'string' || text.length > 100) return false;
  const m = /^([+-]?)(\d+(?:\.\d*)?|\.\d+)(?:[eE]([+-]?\d+))?$/.exec(text);
  if (!m || m[1] === '-') return false;
  const [whole, fraction = ''] = m[2].split('.');
  let digits = (whole + fraction).replace(/^0+/, '');
  if (!digits) return false;
  let exponent = Number(m[3] || 0) - fraction.length;
  if (!Number.isSafeInteger(exponent) || exponent > 100 || exponent < -1000) return false;
  while (exponent < 0 && digits.endsWith('0')) { digits = digits.slice(0, -1); exponent++; }
  if (exponent < 0 || digits.length + exponent > 6) return false;
  const integer = digits + '0'.repeat(exponent);
  return integer.length < 6 || integer <= '100000';
}
export function validateItk(value) {
  if (!keys(value, ['crop', 'variety', 'cover', 'area', 'month', 'year', 'soil', 'water']) || !Object.values(value).every(validText)) return false;
  return Object.hasOwn(crops, value.crop) && crops[value.crop].varieties.includes(value.variety) &&
    ['serre', 'plein'].includes(value.cover) && ['leger', 'limoneux', 'lourd'].includes(value.soil) && ['standard', 'limitee'].includes(value.water) &&
    validArea(value.area) && /^([1-9]|1[0-2])$/.test(value.month) && /^(202[6-9]|203[0-3])$/.test(value.year);
}
export function validateAppearance(value) {
  return keys(value, ['version', 'season', 'brightness', 'updatedAt'], ['version', 'season', 'brightness']) && value.version === 1 &&
    ['auto', 'spring', 'summer', 'autumn', 'winter'].includes(value.season) && ['auto', 'light', 'dark'].includes(value.brightness) &&
    (!Object.hasOwn(value, 'updatedAt') || value.updatedAt === null || utc(value.updatedAt));
}
export const validateValue = (domain, value) => domain === 'itk' ? validateItk(value) : domain === 'appearance' && validateAppearance(value);
export class SettingsSyncError extends Error {
  constructor(code = 'protocol', message = 'La réponse de synchronisation est incohérente. Les paramètres et opérations sont conservés.') { super(message); this.code = code; }
}
export class LocalSettingsError extends Error {
  constructor(message = 'Les paramètres ne sont pas enregistrés : le stockage personnel est inaccessible ou plein. Les données existantes sont conservées.') { super(message); this.code = 'local_storage'; }
}
const protocol = condition => { if (!condition) throw new SettingsSyncError(); };
const local = condition => { if (!condition) throw new LocalSettingsError('Le cache des paramètres est illisible ou d’une version inconnue. Il est conservé sans modification.'); };
export const valueField = domain => domain === 'itk' ? 'p_parameters' : 'p_preferences';
export function valueFromRow(domain, row) {
  if (!row) return null;
  if (domain === 'itk') return clone(row.parameters);
  protocol(row.client_updated_at === null || typeof row.client_updated_at === 'string');
    if (row.client_updated_at === null) return { version: 1, season: row.season, brightness: row.brightness };
  protocol(timestamp(row.client_updated_at));
  const utcValue = new Date(row.client_updated_at).toISOString().slice(0, 19);
  const fraction = row.client_updated_at.match(/\.(\d+)/)?.[1];
  return { version: 1, season: row.season, brightness: row.brightness, updatedAt: `${utcValue}${fraction ? '.' + fraction : ''}Z` };
}
export function validateRow(domain, row, userId) {
  protocol(domains.includes(domain) && record(row) && row.user_id === userId && row.schema_version === 1 && validUUID(row.operation_id) &&
    safe(row.base_revision) && safe(row.revision) && row.revision === row.base_revision + 1 && row.revision > 0 &&
    timestamp(row.created_at) && timestamp(row.updated_at) && validateValue(domain, valueFromRow(domain, row)));
  return row;
}
export function emptySettingsDocument(scope) {
  return { version: 1, scope, values: { itk: null, appearance: null }, remote: { itk: null, appearance: null }, operations: [], conflicts: [], imports: [], archives: [], archivedCount: 0, lastReconciledAt: null };
}
export function validateSettingsDocument(document, scope) {
  local(record(document) && document.version === 1 && document.scope === scope && record(document.values) && record(document.remote) &&
    ['operations', 'conflicts', 'imports', 'archives'].every(key => Array.isArray(document[key])) && safe(document.archivedCount) &&
    (document.lastReconciledAt === null || timestamp(document.lastReconciledAt)));
  let userId; try { userId = JSON.parse(scope)[2]; } catch { local(false); }
  local(validUUID(userId));
  for (const domain of domains) {
    local(document.values[domain] === null || validateValue(domain, document.values[domain]));
    if (document.remote[domain] !== null) try { validateRow(domain, document.remote[domain], userId); } catch { local(false); }
  }
  const seen = new Set();
  for (const op of document.operations) {
    local(record(op) && validUUID(op.id) && !seen.has(op.id) && domains.includes(op.domain) && op.type === op.domain &&
      ['pending', 'confirmed', 'conflict', 'blocked', 'error'].includes(op.state) && safe(op.failures) && safe(op.attempts) && Number.isFinite(op.retryAt) &&
      safe(op.expectedRevision) && op.expectedRevision < Number.MAX_SAFE_INTEGER && equal(op.payload, op.rpcPayload) &&
      keys(op.payload, [valueField(op.domain), 'p_operation_id', 'p_expected_revision']) && op.payload.p_operation_id === op.id &&
      op.payload.p_expected_revision === op.expectedRevision && validateValue(op.domain, op.payload[valueField(op.domain)]));
    const previous = op.dependsOn === null ? null : document.operations.find(item => item.id === op.dependsOn);
    local(op.dependsOn === null || seen.has(op.dependsOn) && previous?.domain === op.domain && op.expectedRevision === previous.expectedRevision + 1);
    seen.add(op.id);
  }
  for (const conflict of document.conflicts) {
    local(record(conflict) && typeof conflict.id === 'string' && domains.includes(conflict.domain) && typeof conflict.resolved === 'boolean' && record(conflict.operation) && validUUID(conflict.operation.id) && validateValue(conflict.domain, conflict.local));
    if (conflict.remote !== null) try { validateRow(conflict.domain, conflict.remote, userId); } catch { local(false); }
  }
  local(document.imports.length <= 2 && new Set(document.imports.map(item => item.domain)).size === document.imports.length);
  for (const proof of document.imports) local(domains.includes(proof.domain) && validUUID(proof.id) && typeof proof.raw === 'string' && typeof proof.source === 'string' && validateValue(proof.domain, proof.value) && validUUID(proof.operationId));
  local(document.archives.length <= 20);
  const projected = clone(document); rebuild(projected); local(equal(projected.values, document.values));
  return document;
}
function archive(document, value) {
  document.archives.push(clone(value));
  while (document.archives.length > 20) { document.archives.shift(); document.archivedCount++; }
}
function rebuild(document) {
  for (const domain of domains) {
    document.values[domain] = valueFromRow(domain, document.remote[domain]);
    for (const op of document.operations) if (op.domain === domain && ['pending', 'error'].includes(op.state)) document.values[domain] = clone(op.payload[valueField(domain)]);
  }
}
function prune(document) {
  // Resolved chains have no remaining delivery obligation. Keep bounded receipts,
  // not an artificial history of every preference change.
  for (const op of document.operations) if (op.dependsOn && op.state === 'confirmed') { op.confirmedDependency = { id: op.dependsOn, revision: op.expectedRevision }; op.dependsOn = null; }
  const removable = document.operations.filter(op => op.state === 'confirmed' && !document.operations.some(child => child.dependsOn === op.id));
  for (const op of removable.slice(0, Math.max(0, removable.length - 8))) {
    archive(document, { kind: 'confirmed', operation: op }); document.operations.splice(document.operations.indexOf(op), 1);
  }
  const resolvedDomains = domains.filter(domain => !document.conflicts.some(item => item.domain === domain && !item.resolved));
  for (const op of [...document.operations]) if (op.state === 'conflict' && resolvedDomains.includes(op.domain) && !document.operations.some(child => child.dependsOn === op.id && ['pending', 'error', 'blocked'].includes(child.state))) {
    archive(document, { kind: 'resolved-operation', operation: op }); document.operations.splice(document.operations.indexOf(op), 1);
  }
  const closed = document.conflicts.filter(item => item.resolved);
  for (const item of closed.slice(0, Math.max(0, closed.length - 8))) { archive(document, { kind: 'resolved-conflict', conflict: item }); document.conflicts.splice(document.conflicts.indexOf(item), 1); }
}
export function queueSettings(document, domain, value, randomUUID = () => globalThis.crypto.randomUUID()) {
  if (!validateValue(domain, value)) throw new SettingsSyncError('validation', domain === 'itk' ? 'Ces paramètres ITK ne sont pas valides pour le catalogue et le contrat actuels. La source est conservée.' : 'Ces préférences d’apparence ne sont pas reconnues. La source est conservée.');
  if (document.conflicts.some(item => !item.resolved && item.domain === domain)) throw new SettingsSyncError('conflict', 'Résous le conflit de ces paramètres avant un nouvel enregistrement.');
  const previous = document.operations.findLast(op => op.domain === domain && ['pending', 'error'].includes(op.state));
  let expectedRevision; let dependsOn;
  if (previous && previous.attempts === 0 && previous.state === 'pending') {
    expectedRevision = previous.expectedRevision; dependsOn = previous.dependsOn;
    archive(document, { kind: 'superseded-unsent', operation: previous }); document.operations.splice(document.operations.indexOf(previous), 1);
  } else { expectedRevision = previous ? previous.expectedRevision + 1 : document.remote[domain]?.revision || 0; dependsOn = previous?.id || null; }
  if (!safe(expectedRevision) || expectedRevision >= Number.MAX_SAFE_INTEGER) throw new LocalSettingsError('La révision des paramètres est indisponible.');
  const id = randomUUID();
  if (!validUUID(id) || document.operations.some(op => op.id === id)) throw new LocalSettingsError('Impossible de créer un identifiant durable distinct.');
  const payload = { [valueField(domain)]: clone(value), p_operation_id: id, p_expected_revision: expectedRevision };
  document.operations.push({ id, domain, type: domain, payload, rpcPayload: clone(payload), expectedRevision, dependsOn, state: 'pending', attempts: 0, failures: 0, retryAt: 0, error: null });
  rebuild(document); prune(document); return { operationId: id, value: clone(value) };
}
function matches(op, row) {
  const value = op.payload[valueField(op.domain)];
  return row.operation_id === op.id && row.base_revision === op.expectedRevision && row.revision === op.expectedRevision + 1 &&
    (op.domain === 'itk' ? equal(value, row.parameters) : row.season === value.season && row.brightness === value.brightness && sameTime(row.client_updated_at, value.updatedAt));
}
function conflict(document, op, row) {
  if (!document.conflicts.some(item => item.id === op.id)) document.conflicts.push({ id: op.id, domain: op.domain, operation: clone(op), local: clone(op.payload[valueField(op.domain)]), remote: clone(row), resolved: false });
  op.state = 'conflict'; op.error = 'conflict';
  for (const child of document.operations) if (child.domain === op.domain && ['pending', 'error'].includes(child.state) && child.expectedRevision > op.expectedRevision) { child.state = 'blocked'; child.error = 'dependency_conflict'; }
  const final = document.operations.findLast(child => child.domain === op.domain && child.state === 'blocked');
  if (final) document.conflicts.find(item => item.id === op.id).local = clone(final.payload[valueField(op.domain)]);
}
function merge(document, domain, row) {
  const previous = document.remote[domain];
  if (previous && previous.revision > row.revision) return;
  if (previous?.revision === row.revision) protocol(equal(previous, row));
  document.remote[domain] = clone(row);
}
export function reconcileSettings(document, remote, userId, at) {
  protocol(record(remote) && domains.every(domain => Object.hasOwn(remote, domain)));
  for (const domain of domains) if (remote[domain] !== null) { validateRow(domain, remote[domain], userId); merge(document, domain, remote[domain]); }
  for (const op of document.operations) {
    if (!['pending', 'error'].includes(op.state)) continue;
    const row = document.remote[op.domain]; if (!row) continue;
    if (matches(op, row)) { if (op.attempts === 0) { op.state = 'confirmed'; op.error = null; } } // An uncertain delivery still replays its exact RPC receipt.
    else {
      const dependency = op.dependsOn && document.operations.find(item => item.id === op.dependsOn);
      if (dependency && ['pending', 'error'].includes(dependency.state)) continue;
      if (row.revision > op.expectedRevision || row.operation_id === op.id) conflict(document, op, row);
    }
  }
  rebuild(document); document.lastReconciledAt = at; prune(document); return document;
}
export function prepareSettingsOperation(document, now = Date.now()) {
  for (const op of document.operations) {
    if (op.state !== 'pending' || op.retryAt > now) continue;
    if (op.dependsOn) {
      const predecessor = document.operations.find(item => item.id === op.dependsOn);
      if (predecessor?.state !== 'confirmed') continue;
      if (document.remote[op.domain]?.revision !== op.expectedRevision) { conflict(document, op, document.remote[op.domain]); rebuild(document); continue; }
    }
    op.attempts++; return clone(op);
  }
  return null;
}
export function acknowledgeSettings(document, id, response, userId) {
  const op = document.operations.find(item => item.id === id && item.state === 'pending'); if (!op) return;
  protocol(record(response) && ['inserted', 'updated', 'replayed', 'conflict'].includes(response.status) && Object.hasOwn(response, 'row'));
  if (response.row !== null) validateRow(op.domain, response.row, userId);
  if (response.status === 'conflict') { conflict(document, op, response.row); if (response.row) merge(document, op.domain, response.row); }
  else {
    protocol(response.row && matches(op, response.row) && (response.status === 'replayed' || response.status === (op.expectedRevision === 0 ? 'inserted' : 'updated')));
    op.state = 'confirmed'; op.error = null; merge(document, op.domain, response.row);
  }
  rebuild(document); prune(document);
}
export function resolveSettingsConflict(document, id, choice, randomUUID) {
  const item = document.conflicts.find(conflict => conflict.id === id && !conflict.resolved);
  if (!item || !['remote', 'local'].includes(choice) || !document.remote[item.domain]) throw new SettingsSyncError('conflict', 'Actualise le compte avant de résoudre ce conflit.');
  const blocked = document.operations.filter(op => op.domain === item.domain && op.state === 'blocked');
  const value = clone(item.local);
  for (const conflict of document.conflicts) if (conflict.domain === item.domain && !conflict.resolved) { conflict.resolved = true; conflict.resolution = choice; }
  for (const op of blocked) { archive(document, { kind: 'resolved-dependent', operation: op, resolution: choice }); op.state = 'conflict'; }
  rebuild(document);
  return choice === 'local' ? queueSettings(document, item.domain, value, randomUUID) : { value: clone(document.values[item.domain]) };
}
