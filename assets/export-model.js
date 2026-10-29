import { TABLES, MAX_BYTES, fail } from './export-sources.js';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fields = names => Object.fromEntries(names.split(',').map(key => [key, true]));
const map = schema => ({ $map: schema });
const itk = fields('crop,variety,cover,area,month,year,soil,water');
const appearance = fields('version,season,brightness,updatedAt');
const question = { ...fields('id,version,unit,chapter,concept,type,prompt,answer,explanation,difficulty,sourceLesson,sourceQuestionIndex'), options: [fields('id,text')], reference: fields('title,url') };
const answer = fields('answer,correct,answeredAt,training');
const series = { ...fields('id,unit,week,startedAt'), questions: [question], answers: map({ ...answer, attempts: [answer] }), drafts: map(true), trainingDrafts: map(true) };
const drill = { version: true, series: map(series) };
const course = { ...fields('done,score'), legacyQuizScore: fields('score,total'), quizAttempts: [fields('attemptId,score,total,completedAt')] };
const botanicalSession = fields('id,categoryId,mode,durationSeconds,revision,startedAt,totalQuestions,completedAt');
const botanicalAnswer = fields('id,sessionId,questionId,categoryId,speciesId,photoId,mode,revision,status,selectedSpeciesId,correct,elapsedMs,answeredAt');
const sqlSchema = name => ({ ...fields(TABLES[name].fields.join(',')),
  ...(name === 'drill_series' ? { questions: [question] } : name === 'itk_settings' ? { parameters: itk } : {}) });
const payload = { ...fields('p_unit,p_week,p_started_at,p_series_id,p_question_id,p_answer,p_answered_at,p_operation_id,p_lesson_id,p_done,p_best_score,p_legacy_score,p_legacy_total,p_expected_revision,p_attempt_id,p_score,p_total,p_completed_at'),
  p_questions: [question], p_parameters: itk, p_preferences: appearance, p_session: botanicalSession };
// p_answer is a scalar in Drill and an object in botanique; selected per domain.
const op = domain => ({ ...fields('id,type,domain,seriesKey,lessonId,sessionId,questionId,state,expectedRevision,failures,retryAt,attempts,confirmedDependency'),
  dependsOn: domain === 'botanical' ? [true] : true,
  confirmedDependency: fields('id,revision'), payload: domain === 'botanical' ? { ...payload, p_answer: botanicalAnswer } : payload,
  rpcPayload: domain === 'botanical' ? { ...payload, p_answer: botanicalAnswer } : payload });
const conflict = domain => ({ ...fields('id,kind,domain,seriesKey,lessonId,sessionId,questionId,resolved,resolution'), operation: op(domain),
  // local/remote are polymorphic; a dedicated projector chooses their schema.
  local: true, remote: true, remoteSeries: series });

/** Strict projection at every depth. Unknown fields/raw text are never copied.
 * Exclusions are counts/codes, never excerpts or attacker-controlled key names. */
export function project(value, schema, context = { omitted: 0 }, depth = 0) {
  if (depth > 30) fail('volume');
  if (value === null) return null;
  if (schema === true) {
    if (!['string', 'number', 'boolean'].includes(typeof value) || typeof value === 'number' && !Number.isFinite(value)) fail('invalid');
    return value;
  }
  if (Array.isArray(schema)) {
    if (!Array.isArray(value)) fail('invalid');
    return value.map(item => project(item, schema[0], context, depth + 1));
  }
  if (!object(value)) fail('invalid');
  if (context.userId && (Object.hasOwn(value, 'user_id') && value.user_id !== context.userId || Object.hasOwn(value, 'userId') && value.userId !== context.userId)) fail('ownership');
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (schema.$map) {
      if (!context.allowMapKeys && ['__proto__', 'prototype', 'constructor'].includes(key)) { context.omitted++; continue; }
      Object.defineProperty(result, key, { value: project(item, schema.$map, context, depth + 1), enumerable: true });
    } else if (Object.hasOwn(schema, key)) result[key] = project(item, schema[key], context, depth + 1);
    else context.omitted++;
  }
  return result;
}
export function projectRow(name, row, userId) {
  const spec = TABLES[name];
  if (!object(row) || row[spec.owner] !== userId) fail('ownership');
  if (!spec.fields.every(key => Object.hasOwn(row, key))) fail('invalid');
  const nullable = { profiles: ['pseudo'], course_states: ['best_score', 'legacy_score', 'legacy_total'], botanical_sessions: ['completed_at'], botanical_answers: ['selected_species_id'], appearance_preferences: ['client_updated_at'] }[name] || [];
  if (spec.fields.some(key => row[key] === null && !nullable.includes(key))) fail('invalid');
  return project(row, sqlSchema(name), { omitted: 0, userId });
}
export function projectLocal(domain, document, scope, { allowMapKeys = false } = {}) {
  if (!object(document) || document.scope !== scope) fail('ownership');
  if (document.version !== 1) fail('future');
  if (!Array.isArray(document.operations) || !Array.isArray(document.conflicts)) fail('invalid');
  if (domain === 'drill' && (!object(document.drill) || document.drill.version !== 1 || !object(document.drill.series)) ||
      domain === 'courses' && (!object(document.courses) || !object(document.attempts)) ||
      domain === 'botanical' && (!object(document.sessions) || !object(document.answers)) ||
      domain === 'settings' && !object(document.values)) fail('invalid');
  const context = { omitted: 0, userId: JSON.parse(scope)[2], allowMapKeys };
  const result = {};
  const schema = domain === 'drill' ? { drill } : domain === 'courses' ? { courses: map(course), attempts: map(fields('attemptId,lessonId,score,total,completedAt')) }
    : domain === 'botanical' ? { sessions: map(botanicalSession), answers: map(botanicalAnswer) } : { values: { itk, appearance } };
  const base = Object.fromEntries(Object.entries(document).filter(([key]) => !['remote', 'conflicts', 'archives', 'importArchives'].includes(key)));
  Object.assign(result, project(base, { version: true, scope: true, lastReconciledAt: true, ...schema,
    operations: [op(domain)], imports: [{ ...fields('id,domain,source,provenance,operationId,state'),
      attemptIds: map(true), sessionIds: map(true), questionIds: map(true), operationIds: [true] }], archivedCount: true }, context));
  const remote = domain === 'drill' ? { series: 'drill_series', answers: 'drill_answers', training: 'drill_training_attempts' }
    : domain === 'courses' ? { courses: 'course_states', attempts: 'quiz_attempts' } : domain === 'botanical' ? { sessions: 'botanical_sessions', answers: 'botanical_answers' } : { itk: 'itk_settings', appearance: 'appearance_preferences' };
  result.remote = {};
  for (const [kind, name] of Object.entries(remote)) {
    const value = document.remote?.[kind];
    result.remote[kind] = domain === 'settings' ? value == null ? null : projectRow(name, value, context.userId)
      : Array.isArray(value) ? value.map(row => projectRow(name, row, context.userId)) : fail('invalid');
  }
  const projectConflict = item => {
    const projected = project(Object.fromEntries(Object.entries(item).filter(([key]) => !['local', 'remote'].includes(key))), conflict(domain), context);
    if (Object.hasOwn(item, 'local')) {
      const shape = domain === 'drill' ? item.kind === 'answer' ? { ...answer, attempts: [answer] } : series
        : domain === 'botanical' ? item.kind === 'answer' ? botanicalAnswer : botanicalSession
          : domain === 'settings' ? item.domain === 'itk' ? itk : appearance : course;
      projected.local = project(item.local, shape, context);
    }
    if (Object.hasOwn(item, 'remote')) {
      const name = domain === 'drill' ? 'drill_answers' : domain === 'courses' ? 'course_states' : domain === 'botanical' ? item.kind === 'answer' ? 'botanical_answers' : 'botanical_sessions' : item.domain === 'itk' ? 'itk_settings' : 'appearance_preferences';
      projected.remote = item.remote == null ? null : projectRow(name, item.remote, context.userId);
    }
    return projected;
  };
  result.conflicts = (document.conflicts || []).map(projectConflict);
  result.archives = (document.archives || []).map(item => {
    const projected = project(Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'conflict')),
      { kind: true, operation: op(domain), resolution: true }, context);
    if (item.conflict) projected.conflict = projectConflict(item.conflict);
    return projected;
  });
  // Raw sources and import-refusal archives can contain another person's data.
  result.excludedArchives = (document.importArchives || []).map(item => project(item, fields('id,provenance'), context));
  return { data: result, omitted: context.omitted };
}
export function projectVisitor(domain, value) {
  const context = { omitted: 0 };
  if (domain === 'legacyTheme' && !['light', 'dark'].includes(value) || domain === 'dismissed' && !/^\d{4}-\d\d-\d\d$/.test(value)) fail('invalid');
  if (['courseProvenance', 'botanicalProvenance'].includes(domain)) {
    if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) fail('invalid');
    return { data: value, omitted: 0 };
  }
  if (domain === 'drill' && value?.version !== 1 || domain === 'botanical' && value?.schemaVersion !== 1 || domain === 'appearance' && value?.version !== 1) fail('future');
  const schema = { drill, courses: map(course), botanical: { schemaVersion: true, sessions: [botanicalSession], answers: [botanicalAnswer] }, itk, appearance, legacyTheme: true, dismissed: true }[domain];
  if (domain === 'courses') {
    if (!object(value)) fail('invalid');
    const data = {};
    for (const [key, entry] of Object.entries(value)) {
      if (['progressArchive', '__proto__', 'constructor', 'prototype'].includes(key)) { context.omitted++; continue; }
      try { Object.defineProperty(data, key, { value: project(entry, course, context), enumerable: true }); }
      catch { context.omitted++; }
    }
    return { data, omitted: context.omitted };
  }
  return { data: project(value, schema, context), omitted: context.omitted };
}
export const DICTIONARY = Object.freeze({
  server: 'Lignes SQL, noms de colonnes conservés ; user_id/id identifie le compte. Dates source et null inchangés.',
  drill_answers: 'Premières réponses ; drill_training_attempts contient les entraînements distincts, liés par série/question.',
  quiz_attempts: 'QCM classiques : scores et totaux, sans choix individuels conservés ; legacy_score/total peuvent être partiels.',
  botanical: 'is_revision : révision pédagogique ; revision : compteur SQL. skipped_image est une image indisponible, pas un échec.',
  settings: 'Huit paramètres ITK, aucun document complet ; auto est un choix persistant, pas le rendu de la saison/heure.',
  local: 'Copies à relier par identifiants métier/UUID d’opération : ne pas additionner remote et projections comme des tentatives distinctes. operations.state distingue pending/confirmed/conflict/blocked/error ; conflicts.resolved et archives gardent les versions divergentes.',
});
export function envelope(sourceScope, data, coverage, generatedAt) {
  const result = { exportFormatVersion: 1, generatedAt, application: 'Mon BPREA', sourceScope,
    status: coverage.some(item => !['included', 'absent'].includes(item.status)) ? 'partial' : 'complete_accessible',
    coverage, warnings: ['Copie technique des sources indiquées, sans instantané transactionnel global. Les autres appareils, journaux et sauvegardes ne sont pas couverts. Ce fichier ne vaut pas traitement complet d’une demande RGPD ni décision sur la portabilité.'], dictionary: DICTIONARY, data };
  serializeExport(result);
  return result;
}
export function serializeExport(value) {
  if (value.exportFormatVersion !== 1 || !['account', 'device'].includes(value.sourceScope?.kind) || !value.coverage?.length || !value.data) fail('invalid');
  const text = JSON.stringify(value, null, 2);
  if (new TextEncoder().encode(text).length > MAX_BYTES) fail('volume');
  return text;
}
