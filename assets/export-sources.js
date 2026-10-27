// Explicit contracts: never SELECT *, enumerate accounts, or serialize SDK state.
export const MAX_BYTES = 20 * 1024 * 1024;
export const MAX_ROWS = 100000;
const table = (fields, key, inventory, owner = 'user_id', time = null) => ({ fields: fields.split(','), key, owner, time, inventory });
export const TABLES = Object.freeze({
  profiles: table('id,pseudo,created_at,updated_at', 'id', 'A05', 'id'),
  drill_series: table('id,user_id,unit,week,series_key,started_at,questions,schema_version,created_at', 'id', 'D04'),
  drill_answers: table('user_id,operation_id,series_id,question_id,answer,correct,answered_at,created_at', 'operation_id', 'D05'),
  drill_training_attempts: table('user_id,operation_id,series_id,question_id,answer,correct,answered_at,created_at', 'operation_id', 'D06'),
  course_states: table('user_id,lesson_id,done,best_score,legacy_score,legacy_total,operation_id,base_revision,revision,schema_version,created_at,updated_at', 'lesson_id', 'Q04'),
  quiz_attempts: table('user_id,attempt_id,lesson_id,score,total,completed_at,schema_version,created_at', 'attempt_id', 'Q05', 'user_id', 'created_at'),
  botanical_sessions: table('user_id,session_id,category_id,mode,duration_seconds,is_revision,started_at,total_questions,completed_at,operation_id,base_revision,revision,schema_version,created_at,updated_at', 'session_id', 'B04'),
  botanical_answers: table('user_id,answer_id,session_id,question_id,category_id,species_id,photo_id,mode,is_revision,status,selected_species_id,correct,elapsed_ms,answered_at,schema_version,created_at', 'answer_id', 'B05', 'user_id', 'created_at'),
  itk_settings: table('user_id,parameters,operation_id,base_revision,revision,schema_version,created_at,updated_at', 'user_id', 'I02'),
  appearance_preferences: table('user_id,season,brightness,client_updated_at,operation_id,base_revision,revision,schema_version,created_at,updated_at', 'user_id', 'P03'),
});
export const CACHES = Object.freeze({
  drill: 'mon-bprea-drill-personal-v1', courses: 'mon-bprea-course-quiz-personal-v1',
  botanical: 'mon-bprea-botanical-personal-v1', settings: 'mon-bprea-settings-personal-v1',
});
export const VISITOR_SOURCES = Object.freeze({
  drill: { key: 'bprea-demo-drill-v1', label: 'Exercices Drill', inventory: 'D01' },
  courses: { key: 'bprea-demo-progress-v1', label: 'Cours et QCM', inventory: 'Q01' },
  botanical: { key: 'monbprea.botanical.v1', label: 'Reconnaissance des plantes', inventory: 'B01' },
  itk: { key: 'bprea-demo-itk-v1', label: 'Derniers paramètres ITK', inventory: 'I01' },
  appearance: { key: 'bprea-demo-appearance-v1', label: 'Apparence', inventory: 'P01' },
  legacyTheme: { key: 'bprea-demo-theme-v1', label: 'Ancien thème', inventory: 'P02' },
  dismissed: { key: 'bprea-demo-daily-fact-dismissed-v1', label: 'Anecdote masquée', inventory: 'X01' },
  courseProvenance: { key: 'bprea-demo-progress-provenance-v1', label: 'Provenance de la sauvegarde cours/QCM', inventory: 'Q03' },
  botanicalProvenance: { key: 'monbprea.botanical.provenance.v1', label: 'Provenance de la sauvegarde botanique', inventory: 'B03' },
});
export class ExportError extends Error {
  constructor(code = 'unavailable') { super(code); this.code = code; }
}
export const fail = code => { throw new ExportError(code); };
