import { readFileSync } from 'node:fs';
import { selectWeeklyQuestions } from '../../assets/drill-engine.js';

const bank = JSON.parse(readFileSync(new URL('../../assets/drill-bank.json', import.meta.url), 'utf8'));

/** Copies of actual teaching questions, so no scenario can mutate the shared bank. */
export function bankQuestions(unit = 'uc3') {
  const questions = structuredClone(bank.questions.filter(question => question.unit === 'uc3'));
  // The current bank contains UC 3 only. Reuse its valid content to exercise
  // statistics across known UC without inventing a second pedagogical bank.
  return unit === 'uc3' ? questions : questions.map(question => ({
    ...question, id: `${unit}-${question.id}`, unit,
  }));
}

export function makeSeries({
  unit = 'uc3', week = '2026-W43', startedAt = '2026-10-19T08:00:00.000Z',
  questions = selectWeeklyQuestions(bankQuestions(unit), unit, week),
  answers = {}, drafts = {}, trainingDrafts = {},
} = {}) {
  return {
    id: `${unit}__${week}`, unit, week, startedAt,
    questions: structuredClone(questions), answers, drafts, trainingDrafts,
  };
}

export function answerFor(question, {
  correct = true, answeredAt = '2026-10-20T08:00:00.000Z',
} = {}) {
  const answer = correct ? question.answer : question.options.find(option => option.id !== question.answer).id;
  const response = { answer, correct, answeredAt };
  return { ...response, attempts: [{ ...response, training: false }] };
}
