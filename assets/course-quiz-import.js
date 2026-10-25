import { clone, validId, validUUID, validScore, validAttempt, CourseQuizSyncError,
  enqueueImportedCourse, enqueueImportedQuiz, projectProgress } from './course-quiz-model.js';

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const safe = value => Number.isSafeInteger(value) && value >= 0;
const own = (value, key) => Object.hasOwn(value, key);

/** Read only. The raw snapshot is the source, including fields we cannot
 * interpret. A score without a date is never turned into an attempt. */
export function previewLegacyImport(raw, catalogue = []) {
  const result = { raw, available: false, summary: { courses: 0, attempts: 0, legacyScores: 0 }, warnings: [], error: null, entries: [] };
  if (raw === null || raw === undefined || raw === '') return result;
  let source;
  try { source = JSON.parse(raw); } catch { result.error = 'La sauvegarde locale est illisible. Elle reste conservée intégralement ; aucun import n’est possible.'; return result; }
  if (!record(source)) { result.error = 'Le format de la sauvegarde locale est inconnu. Aucun import automatique n’est possible.'; return result; }
  const known = new Set(catalogue.map(item => typeof item === 'string' ? item : item.id));
  let unreadable = 0; let archived = 0; let unsupportedPrecision = 0;
  for (const [lessonId, saved] of Object.entries(source)) {
    if (!known.has(lessonId) || !validId(lessonId) || !record(saved)) { archived++; continue; }
    const entry = { lessonId, attempts: [], state: {} };
    if (typeof saved.done === 'boolean') { entry.state.done = saved.done; if (saved.done) result.summary.courses++; }
    else if (own(saved, 'done')) unreadable++;
    if (safe(saved.score)) entry.state.score = saved.score;
    else if (own(saved, 'score')) unreadable++;
    if (validScore(saved.legacyQuizScore?.score, saved.legacyQuizScore?.total)) {
      entry.state.legacyQuizScore = clone(saved.legacyQuizScore);
    } else if (own(saved, 'legacyQuizScore')) unreadable++;
    if (Array.isArray(saved.quizAttempts)) {
      saved.quizAttempts.forEach((attempt, index) => {
        if (validAttempt(attempt)) { entry.attempts.push({ index, score: attempt.score, total: attempt.total, completedAt: attempt.completedAt }); result.summary.attempts++; }
        else {
          unreadable++;
          if (typeof attempt?.completedAt === 'string' && /\.\d{7,}(?:Z|[+-]\d{2}:\d{2})$/.test(attempt.completedAt)) unsupportedPrecision++;
        }
      });
    } else if (own(saved, 'quizAttempts')) unreadable++;
    if (entry.state.legacyQuizScore || safe(saved.score) && !entry.attempts.length) result.summary.legacyScores++;
    const fields = new Set(['done', 'score', 'legacyQuizScore', 'quizAttempts']);
    archived += Object.keys(saved).filter(key => !fields.has(key)).length;
    if (entry.attempts.length || Object.keys(entry.state).length) result.entries.push(entry);
  }
  result.available = result.entries.length > 0;
  if (unreadable) result.warnings.push(`${unreadable} valeur(s) illisible(s) ou non importable(s) restent dans la sauvegarde d’origine et l’archive locale de l’import.`);
  if (unsupportedPrecision) result.warnings.push(`${unsupportedPrecision} date(s) de tentative comportent plus de six décimales de seconde : leur précision d’origine est conservée dans la source, sans arrondi ni envoi au serveur.`);
  if (archived) result.warnings.push(`${archived} archive(s), cours inconnu(s) ou champ(s) inconnu(s) sont conservés dans l’instantané source, sans envoi au serveur.`);
  if (!result.available) result.error = 'Aucune donnée cours ou QCM exploitable dans cette sauvegarde. La source reste intacte.';
  return result;
}

/** Called INSIDE the same IndexedDB transaction as the manifest and outbox.
 * Identity = provenance + exact frozen snapshot + lesson + array position.
 * Never infer identity from score/date, nor merge unrelated copies. */
export function applyLegacyImport(document, { raw, provenance, catalogue = [] }, randomUUID = () => globalThis.crypto.randomUUID()) {
  if (!validUUID(provenance)) throw new CourseQuizSyncError('import_ambiguous', 'La provenance de cette sauvegarde est inconnue. Aucun import n’a été effectué.');
  const previous = document.imports.find(item => item.provenance === provenance && item.raw === raw);
  if (previous) return { manifestId: previous.id, replayed: true, summary: clone(previous.summary), warnings: clone(previous.warnings) };
  if (document.imports.length) throw new CourseQuizSyncError('import_ambiguous',
    'Cette sauvegarde diffère d’un historique déjà importé ou sa provenance est différente. Une résolution explicite est nécessaire pour éviter les doublons. Aucune donnée n’a été supprimée ou fusionnée.');
  const preview = previewLegacyImport(raw, catalogue);
  if (!preview.available || preview.error) throw new CourseQuizSyncError('import_invalid', preview.error || 'Sauvegarde indisponible.');
  if (preview.summary.attempts && (Object.keys(document.attempts).length || document.remote.attempts.length))
    throw new CourseQuizSyncError('import_ambiguous',
      'Ce compte possède déjà des tentatives QCM, sans manifeste local établissant la provenance commune de cette sauvegarde. Une résolution explicite est nécessaire pour éviter de réimporter une copie. La source est conservée sans fusion.');
  const id = randomUUID(); if (!validUUID(id)) throw new CourseQuizSyncError('import_invalid');
  const manifest = { id, provenance, raw, summary: clone(preview.summary), warnings: clone(preview.warnings), attemptIds: {}, operationIds: [] };
  // Store the frozen source FIRST in the in-transaction document. The caller
  // commits manifest, mapped UUIDs, attempts and all operations in one put.
  document.imports.push(manifest);
  for (const entry of preview.entries) {
    const view = projectProgress(document);
    const before = own(view, entry.lessonId) ? view[entry.lessonId] : { done: false };
    const state = { done: entry.state.done ?? before.done };
    if (safe(before.score) || safe(entry.state.score)) state.score = Math.max(before.score ?? 0, entry.state.score ?? 0);
    if (before.legacyQuizScore) state.legacyQuizScore = clone(before.legacyQuizScore);
    else if (entry.state.legacyQuizScore) state.legacyQuizScore = clone(entry.state.legacyQuizScore);
    if (before.legacyQuizScore && entry.state.legacyQuizScore &&
      (before.legacyQuizScore.score !== entry.state.legacyQuizScore.score || before.legacyQuizScore.total !== entry.state.legacyQuizScore.total))
      manifest.warnings.push(`Le score ancien de ${entry.lessonId} diffère de celui du compte : la base du compte est conservée, la source reste archivée.`);
    if (Object.keys(entry.state).length) manifest.operationIds.push(enqueueImportedCourse(document, entry.lessonId, state, randomUUID));
    for (const attempt of entry.attempts) {
      const attemptId = randomUUID();
      const position = JSON.stringify([entry.lessonId, 'quizAttempts', attempt.index]);
      manifest.attemptIds[position] = attemptId;
      enqueueImportedQuiz(document, entry.lessonId, attempt, attemptId);
      manifest.operationIds.push(attemptId);
    }
  }
  return { manifestId: id, replayed: false, summary: clone(manifest.summary), warnings: clone(manifest.warnings) };
}
export const importLegacyProgress = applyLegacyImport;
