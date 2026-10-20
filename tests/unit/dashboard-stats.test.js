import { describe, expect, it } from 'vitest';
import { createDashboardModel } from '../../assets/dashboard-stats.js';
import { getDrillUnitStats } from '../../assets/drill-engine.js';
import { answerFor, makeSeries } from '../fixtures/drill.js';

const now = new Date('2026-10-20T10:00:00Z');

describe('statistiques du Dashboard', () => {
  it('produit des zéros et des taux absents, avec les semaines sans données explicites', () => {
    const model = createDashboardModel({ series: {} }, { period: '4', now });
    expect(model.totals).toEqual({ completed: 0, correct: 0, incorrect: 0, successRate: null, activeWeeks: 0 });
    expect(model.weeks.map(week => week.id)).toEqual(['2026-W40', '2026-W41', '2026-W42', '2026-W43']);
    expect(model.weeks.every(week => week.completed === 0 && week.successRate === null)).toBe(true);
    expect(model.units.every(unit => unit.completed === 0 && unit.successRate === null)).toBe(true);
    expect(model.notions).toEqual([]);
    expect(model.chapters).toEqual([]);
  });

  it('reste cohérent avec le Drill malgré les doublons, brouillons et entraînements réussis', () => {
    const series = makeSeries();
    const [right, wrong, draft] = series.questions;
    series.answers[right.id] = answerFor(right);
    series.answers[wrong.id] = answerFor(wrong, { correct: false });
    series.answers[wrong.id].attempts.push({ ...answerFor(wrong).attempts[0], training: true });
    series.drafts[draft.id] = draft.answer;
    const state = { series: [series, structuredClone(series)] };
    const model = createDashboardModel(state, { now });
    const drill = getDrillUnitStats(state, 'uc3');

    expect(model.totals).toMatchObject({ completed: 2, correct: 1, incorrect: 1, successRate: 50, activeWeeks: 1 });
    for (const field of ['completed', 'correct', 'incorrect', 'successRate']) {
      expect(model.totals[field]).toBe(drill[field]);
    }
  });

  it('agrège par UC et conserve la même période de comparaison quand une UC est sélectionnée', () => {
    const uc3 = makeSeries();
    uc3.answers[uc3.questions[0].id] = answerFor(uc3.questions[0], { answeredAt: '2026-10-01T08:00:00Z' });
    uc3.answers[uc3.questions[1].id] = answerFor(uc3.questions[1], { correct: false, answeredAt: '2026-10-15T08:00:00Z' });
    const uc4 = makeSeries({ unit: 'uc4', week: '2026-W39' });
    uc4.answers[uc4.questions[0].id] = answerFor(uc4.questions[0], { answeredAt: '2026-09-25T08:00:00Z' });
    const state = { series: [uc3, uc4] };
    const all = createDashboardModel(state, { now });
    const selected = createDashboardModel(state, { unit: 'uc3', now });

    expect(all.totals).toMatchObject({ completed: 3, correct: 2, incorrect: 1 });
    expect(all.totals.successRate).toBeCloseTo(200 / 3);
    expect(selected.totals).toMatchObject({ completed: 2, correct: 1, incorrect: 1, successRate: 50 });
    expect(selected.units).toEqual(all.units);
    expect(selected.units.find(unit => unit.id === 'uc4')).toMatchObject({ completed: 1, successRate: 100 });
    expect(selected.periodStart).toBe('2026-09-21');
    expect(selected.periodStart).toBe(all.periodStart);
    const lastFour = createDashboardModel(state, { period: '4', now });
    expect(lastFour.totals.completed).toBe(2);
    expect(lastFour.units.find(unit => unit.id === 'uc4').completed).toBe(0);
  });

  it('classe les réponses par leur semaine d’activité à Paris, indépendamment de la semaine de série', () => {
    const series = makeSeries({ week: '2026-W38' });
    series.answers[series.questions[0].id] = answerFor(series.questions[0], { answeredAt: '2026-10-11T21:59:59Z' });
    series.answers[series.questions[1].id] = answerFor(series.questions[1], { correct: false, answeredAt: '2026-10-11T22:00:00Z' });

    const model = createDashboardModel({ series: [series] }, { period: '4', now });
    expect(model.weeks.map(week => [week.id, week.completed, week.successRate])).toEqual([
      ['2026-W40', 0, null], ['2026-W41', 1, 100], ['2026-W42', 1, 0], ['2026-W43', 0, null],
    ]);
    expect(model.totals.activeWeeks).toBe(2);
  });

  it('demande cinq réponses avant une appréciation et respecte les seuils pédagogiques existants', () => {
    const scenarios = [
      { completed: 4, correct: 4, expected: 'insufficient' },
      { completed: 5, correct: 4, expected: 'strong' },
      { completed: 5, correct: 3, expected: 'developing' },
      { completed: 5, correct: 2, expected: 'rework' },
    ];
    for (const { completed, correct, expected } of scenarios) {
      const series = makeSeries();
      series.questions.forEach(question => { question.chapter = 'Le sol vivant'; question.concept = 'Notion étudiée'; });
      for (const [index, question] of series.questions.slice(0, completed).entries()) {
        series.answers[question.id] = answerFor(question, { correct: index < correct });
      }
      const model = createDashboardModel({ series: [series] }, { now });
      expect(model.notions).toHaveLength(1);
      expect(model.notions[0]).toMatchObject({ completed, correct, mastery: expected });
      expect(model.chapters[0].completed).toBe(completed);
    }
  });

  it('écarte les réponses futures et les UC inconnues en conservant les avertissements utiles', () => {
    const series = makeSeries();
    series.answers[series.questions[0].id] = answerFor(series.questions[0]);
    series.answers[series.questions[1].id] = answerFor(series.questions[1], { answeredAt: '2026-10-21T08:00:00Z' });
    const unknown = makeSeries({ unit: 'uc-inconnue' });
    unknown.answers[unknown.questions[0].id] = answerFor(unknown.questions[0]);
    const model = createDashboardModel({
      series: [series, unknown], warnings: ['Archive conservée', 'Archive conservée'], error: 'Lecture partielle',
    }, { unit: 'invalide', period: 'invalide', now });

    expect(model.totals).toMatchObject({ completed: 1, correct: 1, incorrect: 0, successRate: 100 });
    expect(model.error).toBe('Lecture partielle');
    expect(model.warnings.filter(warning => warning === 'Archive conservée')).toHaveLength(1);
    expect(model.warnings.some(warning => warning.includes('futur'))).toBe(true);
    expect(model.warnings.some(warning => warning.includes('UC connue'))).toBe(true);
  });
});
