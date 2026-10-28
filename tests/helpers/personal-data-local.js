import { randomUUID } from 'node:crypto';
import { questions, stamp } from '../fixtures/export.js';
import { botanicalSession, botanicalAnswer, itkParameters } from '../fixtures/personal-data.js';
import { TABLES } from '../../assets/export-sources.js';

async function rpc(student, name, body) {
  const result = await student.client.rpc(name, body);
  if (result.error || !result.data?.row) throw new Error('Fixture locale RPC refusée.');
  return result.data.row;
}
export async function seedPersonalTables(student, quizCount) {
  await student.refresh();
  const series = await rpc(student, 'drill_create_series', { p_unit: 'uc3', p_week: '2026-W43', p_started_at: stamp, p_questions: questions });
  const answer = { p_series_id: series.id, p_question_id: questions[0].id, p_answer: questions[0].answer, p_answered_at: stamp, p_operation_id: randomUUID() };
  await rpc(student, 'drill_record_answer', answer); await rpc(student, 'drill_record_training', { ...answer, p_operation_id: randomUUID() });
  await rpc(student, 'personal_save_course', { p_lesson_id: 'matiere-organique', p_done: false, p_best_score: 1, p_legacy_score: 0, p_legacy_total: 3, p_operation_id: randomUUID(), p_expected_revision: 0 });
  const inserted = await student.client.from('quiz_attempts').insert(Array.from({ length: quizCount }, () => ({ attempt_id: randomUUID(), lesson_id: 'matiere-organique', score: 0, total: 3, completed_at: stamp })));
  if (inserted.error) throw new Error('Fixture locale QCM refusée.');
  const session = botanicalSession(`export-${randomUUID()}`);
  await rpc(student, 'personal_save_botanical_session', { p_session: session, p_operation_id: randomUUID(), p_expected_revision: 0 });
  await rpc(student, 'personal_record_botanical_answer', { p_answer: botanicalAnswer(session) });
  await rpc(student, 'personal_save_itk', { p_parameters: itkParameters, p_operation_id: randomUUID(), p_expected_revision: 0 });
  await rpc(student, 'personal_save_appearance', { p_preferences: { version: 1, season: 'auto', brightness: 'auto' }, p_operation_id: randomUUID(), p_expected_revision: 0 });
}
export async function readPersonalTables(student) {
  await student.refresh(); const data = {};
  for (const [name, spec] of Object.entries(TABLES)) {
    const result = await student.client.from(name).select(spec.fields.join(',')).eq(spec.owner, student.userId).order(spec.key);
    if (result.error) throw new Error('Relecture personnelle locale refusée.'); data[name] = result.data;
  }
  return data;
}
