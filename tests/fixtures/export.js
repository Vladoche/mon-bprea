import { readFileSync } from 'node:fs';
export const questions = JSON.parse(readFileSync(new URL('../../assets/drill-bank.json', import.meta.url))).questions.filter(q => q.unit === 'uc3').slice(0, 10);
export const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
export const stamp = '2026-10-20T09:00:00.123456Z';
export const uuid = n => `64020000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const parameters = { crop: 'tomate', variety: 'Marmande', cover: 'serre', area: '100', month: '4', year: '2027', soil: 'limoneux', water: 'standard' };
export function serverRows(userId = A, attempts = 1) {
  const tech = { schema_version: 1, created_at: stamp, updated_at: stamp, operation_id: uuid(1), base_revision: 0, revision: 1 };
  const result = {
    profiles: [{ id: userId, pseudo: userId === A ? 'Compte A fictif' : 'Compte B fictif', created_at: stamp, updated_at: stamp }],
    drill_series: [{ id: uuid(2), user_id: userId, unit: 'uc3', week: '2026-W43', series_key: 'uc3__2026-W43', started_at: stamp, questions, schema_version: 1, created_at: stamp }],
    drill_answers: [{ user_id: userId, operation_id: uuid(3), series_id: uuid(2), question_id: questions[0].id, answer: questions[0].answer, correct: true, answered_at: stamp, created_at: stamp }],
    drill_training_attempts: [{ user_id: userId, operation_id: uuid(4), series_id: uuid(2), question_id: questions[0].id, answer: 'a', correct: false, answered_at: stamp, created_at: stamp }],
    course_states: [{ user_id: userId, lesson_id: 'matiere-organique', done: false, best_score: 1, legacy_score: 0, legacy_total: 3, ...tech }],
    quiz_attempts: Array.from({ length: attempts }, (_, i) => ({ user_id: userId, attempt_id: uuid(i + 100), lesson_id: 'matiere-organique', score: 0, total: 3, completed_at: stamp, schema_version: 1, created_at: stamp })),
    botanical_sessions: [{ user_id: userId, session_id: 'session-1', category_id: 'petits-fruits', mode: 'discovery', duration_seconds: 30, is_revision: true, started_at: stamp, total_questions: 1, completed_at: null, ...tech }],
    botanical_answers: [{ user_id: userId, answer_id: 'question-1', session_id: 'session-1', question_id: 'question-1', category_id: 'petits-fruits', species_id: 'fraisier', photo_id: 'photo-1', mode: 'discovery', is_revision: true, status: 'skipped_image', selected_species_id: null, correct: false, elapsed_ms: 0, answered_at: stamp, schema_version: 1, created_at: stamp }],
    itk_settings: [{ user_id: userId, parameters, ...tech }],
    appearance_preferences: [{ user_id: userId, season: 'auto', brightness: 'auto', client_updated_at: null, ...tech }],
  };
  return result;
}
