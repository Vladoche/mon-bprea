import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getCountedDrillResponses, getDrillUnitStats, getParisWeek, getSeriesStats,
  nextParisWeekAt, parseWeek, selectWeeklyQuestions, shiftWeek,
} from '../../assets/drill-engine.js';
import { answerFor, bankQuestions, makeSeries } from '../fixtures/drill.js';

afterEach(() => vi.useRealTimers());

describe('semaines du Drill en Europe/Paris', () => {
  it('renouvelle la semaine le lundi à minuit Paris, avec une horloge contrôlée', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-18T21:59:59.999Z'));
    expect(getParisWeek()).toMatchObject({ id: '2026-W42', start: '2026-10-12', end: '2026-10-18' });

    vi.setSystemTime(new Date('2026-10-18T22:00:00.000Z'));
    expect(getParisWeek()).toMatchObject({ id: '2026-W43', start: '2026-10-19', end: '2026-10-25' });
  });

  it('respecte les années ISO, leurs semaines 53 et les décalages de fin d’année', () => {
    expect(getParisWeek('2021-01-03T22:59:59Z').id).toBe('2020-W53');
    expect(getParisWeek('2021-01-03T23:00:00Z').id).toBe('2021-W01');
    expect(getParisWeek('2025-12-28T23:00:00Z').id).toBe('2026-W01');
    expect(parseWeek('2020-W53')).toMatchObject({ start: '2020-12-28', end: '2021-01-03' });
    expect(shiftWeek('2020-W53', 1)?.id).toBe('2021-W01');
    expect(shiftWeek('2021-W01', -1)?.id).toBe('2020-W53');
    for (const invalid of ['2021-W53', '2026-W00', '2026-W54', '2026-W1', 'invalid']) {
      expect(parseWeek(invalid)).toBeNull();
    }
    expect(() => getParisWeek('invalid')).toThrow(RangeError);
  });

  it('programme le prochain lundi à la bonne heure après les deux changements d’heure', () => {
    const transitions = [
      ['2026-03-22T23:00:00Z', '2026-03-29T22:00:00.000Z', '2026-W14', 167],
      ['2026-10-18T22:00:00Z', '2026-10-25T23:00:00.000Z', '2026-W44', 169],
    ];
    for (const [now, expected, nextWeek, hours] of transitions) {
      const next = nextParisWeekAt(new Date(now));
      expect(next.toISOString()).toBe(expected);
      expect((next.getTime() - Date.parse(now)) / 3600000).toBe(hours);
      expect(getParisWeek(next).id).toBe(nextWeek);
      expect(getParisWeek(new Date(next.getTime() - 1)).id).not.toBe(nextWeek);
    }
  });
});

describe('sélection hebdomadaire et résultats du Drill', () => {
  it('reproduit les dix mêmes identifiants malgré l’ordre du JSON ou une correction de version', () => {
    const questions = bankQuestions();
    const initial = structuredClone(questions);
    const ids = selection => selection.map(question => question.id);
    const selected = selectWeeklyQuestions(questions, 'uc3', '2026-W43');
    const revised = questions.toReversed().map(question => ({ ...question, version: question.version + 1 }));

    expect(selected).toHaveLength(10);
    expect(new Set(ids(selected)).size).toBe(10);
    expect(ids(selectWeeklyQuestions(revised, 'uc3', '2026-W43'))).toEqual(ids(selected));
    expect(ids(selectWeeklyQuestions(questions, 'uc3', '2026-W43'))).toEqual(ids(selected));
    expect(questions).toEqual(initial);
  });

  it('refuse une banque insuffisante et ignore les doublons et les autres UC', () => {
    const questions = bankQuestions();
    const incomplete = [...questions.slice(0, 9), questions[0], ...bankQuestions('uc4')];
    expect(selectWeeklyQuestions(incomplete, 'uc3', '2026-W43')).toEqual([]);
    const complete = selectWeeklyQuestions([...questions, questions[0], ...bankQuestions('uc4')], 'uc3', '2026-W43');
    expect(complete).toHaveLength(10);
    expect(new Set(complete.map(question => question.id)).size).toBe(10);
    expect(complete.every(question => question.unit === 'uc3')).toBe(true);
    expect(selectWeeklyQuestions(questions, 'uc3', '2021-W53')).toEqual([]);
  });

  it('calcule le taux sur les réponses lisibles, sans pénaliser les exercices non réalisés', () => {
    const series = makeSeries();
    const [right, wrong, unreadable] = series.questions;
    series.questions.push(structuredClone(right));
    series.answers = {
      [right.id]: answerFor(right),
      [wrong.id]: answerFor(wrong, { correct: false }),
      [unreadable.id]: { ...answerFor(unreadable), answeredAt: '2026-02-30T08:00:00Z' },
      'question-hors-serie': answerFor(right),
    };
    series.drafts[series.questions[3].id] = series.questions[3].answer;

    expect(getSeriesStats(series)).toEqual({
      planned: 10, completed: 2, correct: 1, incorrect: 1, successRate: 50, trainingAttempts: 0,
    });
    expect(getSeriesStats(makeSeries())).toMatchObject({ completed: 0, successRate: null });
  });

  it('conserve la première réponse et compte les entraînements séparément, y compris leur ancien format', () => {
    const series = makeSeries();
    const [current, legacy] = series.questions;
    const failed = answerFor(current, { correct: false });
    failed.attempts.push({ ...answerFor(current).attempts[0], training: true });
    const oldFailed = answerFor(legacy, { correct: false });
    oldFailed.attempts = [oldFailed.attempts[0], answerFor(legacy).attempts[0], answerFor(legacy).attempts[0]]
      .map(({ training, ...response }) => response);
    series.answers = { [current.id]: failed, [legacy.id]: oldFailed };

    expect(getSeriesStats(series)).toMatchObject({
      completed: 2, correct: 0, incorrect: 2, successRate: 0, trainingAttempts: 3,
    });
    expect(getCountedDrillResponses([series])).toHaveLength(2);
  });

  it('dédoublonne les séries tout en conservant le résultat de chaque semaine historique', () => {
    const current = makeSeries();
    const question = current.questions[0];
    current.answers[question.id] = answerFor(question);
    const previous = makeSeries({ week: '2026-W42', questions: current.questions });
    previous.answers[question.id] = answerFor(question, { correct: false, answeredAt: '2026-10-18T08:00:00Z' });
    const otherUnit = makeSeries({ unit: 'uc4' });
    otherUnit.answers[otherUnit.questions[0].id] = answerFor(otherUnit.questions[0]);
    const collection = { series: [current, structuredClone(current), previous, otherUnit] };

    expect(getDrillUnitStats(collection, 'uc3')).toMatchObject({
      planned: 20, completed: 2, correct: 1, incorrect: 1, successRate: 50,
    });
    expect(getCountedDrillResponses(collection, 'uc3')).toHaveLength(2);
    expect(getCountedDrillResponses(collection)).toHaveLength(3);
  });
});
