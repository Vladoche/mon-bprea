import { units, lessons } from './content.js';
import { validAttempt } from './course-quiz-model.js';

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Read-only presentation of the service's verified view. Never inspect another
 * cache, infer completion from a score, or write a new tracking key. */
export function learningOverview(snapshot, now = Date.now()) {
  const available = ['visitor', 'personal'].includes(snapshot?.mode) &&
    record(snapshot.view?.progress) && !snapshot.view.error &&
    !snapshot.view.warnings?.length && snapshot.sync?.state !== 'session';
  const progress = available ? snapshot.view.progress : {};
  const courses = lessons.map(lesson => {
    const saved = Object.hasOwn(progress, lesson.id) ? progress[lesson.id] : undefined;
    const known = available && (saved === undefined || record(saved) &&
      (!Object.hasOwn(saved, 'done') || typeof saved.done === 'boolean'));
    return { lesson, known, done: known ? saved?.done === true : null };
  });
  const byUnit = units.map(unit => {
    const list = courses.filter(course => course.lesson.unit === unit.id);
    const known = list.length > 0 && list.every(course => course.known);
    const done = known ? list.filter(course => course.done).length : null;
    return { unit, count: list.length, done, percent: known ? Math.round(done / list.length * 100) : null };
  });
  // Only dated, valid QCM attempts establish a past activity in this view.
  // Course completion and legacy best scores contain no reliable activity date.
  let resume = null;
  for (const { lesson, known } of courses) {
    if (!known) continue;
    const attempts = progress[lesson.id]?.quizAttempts;
    if (!Array.isArray(attempts)) continue;
    for (const attempt of attempts) {
      if (!validAttempt(attempt) || attempt.total !== lesson.quiz.length) continue;
      const time = Date.parse(attempt.completedAt);
      if (time > now || resume && time <= resume.time) continue;
      resume = { lesson, time };
    }
  }
  return { courses, units: byUnit, resume, source: !available ? 'Progression indisponible · données conservées'
    : snapshot.mode === 'personal' ? 'Progression de ton compte' : 'Progression locale sur cet appareil' };
}
