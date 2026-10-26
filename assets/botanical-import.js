import { clone, validUUID, normalizeSession, normalizePersonalAnswer, answerFitsSession, BotanicalSyncError,
  recordPersonalSession, recordPersonalAnswer, completePersonalSession } from './botanical-sync-model.js';

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const sessionFields = new Set(['id', 'categoryId', 'mode', 'durationSeconds', 'revision', 'startedAt', 'totalQuestions', 'completedAt']);
const answerFields = new Set(['id', 'sessionId', 'questionId', 'categoryId', 'speciesId', 'photoId', 'mode', 'revision', 'status', 'selectedSpeciesId', 'correct', 'elapsedMs', 'answeredAt']);
function duplicateIds(values) {
  const seen = new Set(); const duplicates = new Set();
  for (const value of values) if (typeof value?.id === 'string') { if (seen.has(value.id)) duplicates.add(value.id); seen.add(value.id); }
  return duplicates;
}
/** Preview never writes or repairs the visitor document. Orphans, unknown
 * versions, invalid dates and colliding identities remain in the frozen source. */
export function previewLegacyImport(raw) {
  const result = { raw, available: false, summary: { sessions: 0, answers: 0, refused: 0 }, warnings: [], error: null, entries: [] };
  if (raw == null || raw === '') return result;
  let source;
  try { source = JSON.parse(raw); } catch { result.error = 'La sauvegarde botanique est illisible. Elle reste conservée sans modification.'; return result; }
  if (!record(source) || source.schemaVersion !== 1 || !Array.isArray(source.sessions) || !Array.isArray(source.answers)) {
    result.error = Number.isInteger(source?.schemaVersion) && source.schemaVersion > 1 ? 'Cette sauvegarde provient d’une version plus récente. Aucun import n’est possible ; elle reste intacte.' : 'Le format de la sauvegarde botanique est inconnu. La source reste intacte.';
    return result;
  }
  const duplicateSessions = duplicateIds(source.sessions); const duplicateAnswers = duplicateIds(source.answers);
  let unknown = Object.keys(source).filter(key => !['schemaVersion', 'sessions', 'answers'].includes(key)).length;
  let orphans = 0; let incompatible = 0;
  const eligible = new Map();
  source.sessions.forEach((value, index) => {
    const session = normalizeSession(value);
    if (!session || duplicateSessions.has(value.id)) { result.summary.refused++; return; }
    unknown += Object.keys(value).filter(key => !sessionFields.has(key)).length;
    eligible.set(session.id, { index, session, answers: [] });
  });
  source.answers.forEach((value, index) => {
    const answer = normalizePersonalAnswer(value);
    const entry = eligible.get(value?.sessionId);
    if (!entry) { result.summary.refused++; orphans++; return; }
    if (!answer || duplicateAnswers.has(value.id) || !answerFitsSession(answer, entry.session)) { result.summary.refused++; incompatible++; return; }
    unknown += Object.keys(value).filter(key => !answerFields.has(key)).length;
    entry.answers.push({ index, answer });
  });
  for (const entry of eligible.values()) {
    if (entry.answers.length > entry.session.totalQuestions) { result.summary.refused += entry.answers.length + 1; incompatible++; continue; }
    result.entries.push(entry); result.summary.sessions++; result.summary.answers += entry.answers.length;
  }
  if (result.summary.refused) result.warnings.push(`${result.summary.refused} session(s) ou réponse(s) non transférée(s) restent dans la sauvegarde d’origine et l’instantané de l’import.`);
  if (orphans) result.warnings.push(`${orphans} réponse(s) sans session exploitable ne seront pas transférées. Aucune session n’est inventée.`);
  if (duplicateSessions.size || duplicateAnswers.size) result.warnings.push('Des identifiants apparaissent plusieurs fois : toutes leurs occurrences ambiguës sont conservées sans transfert.');
  if (incompatible) result.warnings.push('Des dates, métadonnées ou nombres de réponses incompatibles sont conservés sans correction automatique.');
  if (unknown) result.warnings.push(`${unknown} champ(s) historique(s) inconnu(s) restent dans l’instantané source, sans envoi au serveur.`);
  result.available = result.entries.length > 0;
  if (!result.available) result.error = 'Aucune session botanique exploitable dans cette sauvegarde. Les données originales restent intactes.';
  return result;
}

/** Caller confirms after a fresh complete remote scan, then commits this
 * manifest and every generated operation in the SAME IndexedDB transaction. */
export function applyLegacyImport(document, { raw, provenance }, randomUUID = () => globalThis.crypto.randomUUID()) {
  if (!validUUID(provenance)) throw new BotanicalSyncError('import_ambiguous', 'La provenance de cette sauvegarde est inconnue. Aucun import n’est créé.');
  const previous = document.imports.find(item => item.provenance === provenance && item.raw === raw);
  if (previous) return { manifestId: previous.id, replayed: true, summary: clone(previous.summary), warnings: clone(previous.warnings) };
  const refuse = message => {
    let archive = document.importArchives.find(item => item.raw === raw && item.provenance === provenance && item.reason === 'import_ambiguous');
    if (!archive) {
      const id = randomUUID();
      if (!validUUID(id) || document.operations.some(item => item.id === id) || document.imports.some(item => item.id === id) || document.importArchives.some(item => item.id === id)) throw new BotanicalSyncError('import_invalid', 'Identifiant d’archive indisponible.');
      archive = { id, provenance, raw, reason: 'import_ambiguous', message }; document.importArchives.push(archive);
    }
    return { error: message, errorCode: 'import_ambiguous', rejected: true, archived: true, archiveId: archive.id };
  };
  if (document.imports.length) return refuse('Cette copie ou sa provenance diffère de l’historique déjà importé. Une intervention est nécessaire ; aucune donnée n’est fusionnée ou supprimée.');
  const preview = previewLegacyImport(raw);
  if (!preview.available || preview.error) throw new BotanicalSyncError('import_invalid', preview.error || 'Sauvegarde indisponible.');
  if (!document.lastReconciledAt) throw new BotanicalSyncError('import_unverified', 'Une récupération complète de l’historique du compte est nécessaire avant le premier import.');
  // Stable business IDs do not authorize treating an independently copied
  // backup as common provenance, even when its payload happens to be equal.
  const collision = preview.entries.some(entry => Object.hasOwn(document.sessions, entry.session.id) ||
    entry.answers.some(({ answer }) => Object.hasOwn(document.answers, answer.id)));
  if (collision) return refuse('Un identifiant de cette sauvegarde existe déjà dans le compte sans manifeste établissant sa provenance commune. Aucune fusion automatique n’est effectuée ; la source reste intacte.');
  const id = randomUUID();
  if (!validUUID(id) || document.operations.some(item => item.id === id)) throw new BotanicalSyncError('import_invalid', 'Identifiant du manifeste indisponible.');
  const manifest = { id, provenance, raw, summary: clone(preview.summary), warnings: clone(preview.warnings), sessionIds: {}, questionIds: {}, operationIds: [], state: 'queued' };
  document.imports.push(manifest);
  for (const entry of preview.entries) {
    const before = document.operations.length;
    recordPersonalSession(document, { ...entry.session, completedAt: null }, randomUUID);
    manifest.sessionIds[entry.index] = entry.session.id;
    for (const { index, answer } of entry.answers) {
      recordPersonalAnswer(document, answer, randomUUID); manifest.questionIds[index] = answer.questionId;
    }
    if (entry.session.completedAt !== null) completePersonalSession(document, entry.session.id, entry.session.completedAt, randomUUID);
    manifest.operationIds.push(...document.operations.slice(before).map(operation => operation.id));
  }
  return { manifestId: id, replayed: false, summary: clone(manifest.summary), warnings: clone(manifest.warnings) };
}
