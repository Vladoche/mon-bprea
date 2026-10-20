import { afterEach, describe, expect, it, vi } from 'vitest';
import { getParisDay, selectDailyFact } from '../../assets/daily-fact.js';

const facts = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
afterEach(() => vi.useRealTimers());

describe('Anecdote du jour Europe/Paris', () => {
  it('reste identique le même jour et change à minuit à Paris avec une horloge contrôlée', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:01:00+01:00'));
    expect(getParisDay()).toBe('2026-01-01');
    expect(selectDailyFact(facts)).toBe(facts[0]);
    vi.setSystemTime(new Date('2026-01-01T23:59:59+01:00'));
    expect(selectDailyFact(facts)).toBe(facts[0]);
    vi.advanceTimersByTime(1000);
    expect(getParisDay()).toBe('2026-01-02');
    expect(selectDailyFact(facts)).toBe(facts[1]);
  });

  it('fait tourner la collection sans mutation, y compris avant l’époque de référence', () => {
    const before = structuredClone(facts);
    expect(['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04'].map(day => selectDailyFact(facts, day).id)).toEqual(['a', 'b', 'c', 'a']);
    expect(selectDailyFact(facts, '2025-12-31')).toBe(facts[2]);
    expect(facts).toEqual(before);
  });

  it('suit les journées civiles et conserve la rotation aux deux changements d’heure de Paris', () => {
    for (const [first, second, day] of [
      ['2026-03-29T00:30:00Z', '2026-03-29T01:30:00Z', '2026-03-29'],
      ['2026-10-25T00:30:00Z', '2026-10-25T01:30:00Z', '2026-10-25'],
    ]) {
      expect(getParisDay(new Date(first))).toBe(day);
      expect(getParisDay(new Date(second))).toBe(day);
      expect(selectDailyFact(facts, getParisDay(new Date(first)))).toBe(selectDailyFact(facts, getParisDay(new Date(second))));
    }
    // Une journée de 23 ou 25 h avance toujours d’un seul élément.
    for (const [start, next] of [['2026-03-29', '2026-03-30'], ['2026-10-25', '2026-10-26']]) {
      const index = facts.indexOf(selectDailyFact(facts, start));
      expect(selectDailyFact(facts, next)).toBe(facts[(index + 1) % facts.length]);
    }
  });

  it('retourne une absence pour une collection vide ou une date invalide', () => {
    expect(selectDailyFact([], '2026-01-01')).toBeNull();
    expect(selectDailyFact(null, '2026-01-01')).toBeNull();
    for (const day of ['2026-02-30', '2026-1-1', 'invalide', null]) expect(selectDailyFact(facts, day)).toBeNull();
  });
});
