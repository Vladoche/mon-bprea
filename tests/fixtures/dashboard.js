import { getParisWeek, shiftWeek } from '../../assets/drill-engine.js';
import { answerFor, bankQuestions, makeSeries } from './drill.js';

export const DASHBOARD_NOW = new Date('2026-11-18T12:00:00Z');
const currentWeek = getParisWeek(DASHBOARD_NOW).id;

function answeredWeek(offset, outcomes, unit = 'uc3') {
  const week = shiftWeek(currentWeek, offset);
  const questions = bankQuestions(unit).slice(0, 10);
  if (unit !== 'uc3') {
    // A historical snapshot in another UC may have a homonym and no known lesson.
    for (const question of questions) {
      delete question.reference;
      delete question.sourceLesson;
    }
  }
  const series = makeSeries({ unit, week: week.id, startedAt: `${week.start}T08:00:00Z`, questions });
  for (const [i, correct] of outcomes.entries()) {
    const question = series.questions[i];
    series.answers[question.id] = answerFor(question, { correct, answeredAt: `${week.start}T09:00:00Z` });
  }
  return series;
}

export function dashboardHistory(scenario = 'history') {
  const recent = answeredWeek(0, scenario === 'refreshed' ? [true, false] : [true]);
  let series;
  if (scenario === 'empty') series = [];
  else if (scenario === 'few') series = [recent];
  else {
    series = [
      answeredWeek(-45, [false, true]),
      answeredWeek(-25, [true]),
      answeredWeek(-15, [false, true, true]),
      answeredWeek(-11, [false, true, true, true, true, true]),
      answeredWeek(-10, [false, true, false, true, true]),
      answeredWeek(-7, [false, true, true]),
      answeredWeek(-5, [false, true, true]),
      answeredWeek(-3, [false, true, true, false, true, true]),
      answeredWeek(-2, [false, false, false]),
      answeredWeek(-2, [false, false], 'uc4'),
      recent,
    ];
    if (scenario === 'exclusions') {
      const question = recent.questions[1];
      recent.answers[question.id] = answerFor(question, { answeredAt: '2026-11-19T09:00:00Z' });
    }
  }
  return { version: 1, series: Object.fromEntries(series.map(item => [item.id, item])) };
}
