import { afterEach, describe, expect, it, vi } from 'vitest';
import { dateKey, daysBetween, loadCalendar, parseDate, selectUpcomingExams, todayKey } from '../../assets/calendar-data.js';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function exam(id, start, end = start, extra = {}) {
  return { id, title: id, type: 'examen', start, end, ...extra };
}

describe('Journées civiles et examens', () => {
  it('valide les dates réelles, y compris le 29 février, sans normaliser les dates invalides', () => {
    expect(dateKey(parseDate('2024-02-29'))).toBe('2024-02-29');
    for (const value of ['2026-02-29', '2026-04-31', '2026-13-01', '0000-01-01', '20/10/2026', '', null]) {
      expect(parseDate(value)).toBeNull();
    }
    expect(Number.isNaN(daysBetween('invalide', '2026-10-20'))).toBe(true);
  });

  it('calcule les jours restants à travers les mois, les années et les deux changements d’heure Paris', () => {
    for (const [start, end, expected] of [
      ['2026-01-31', '2026-02-01', 1],
      ['2026-12-31', '2027-01-02', 2],
      ['2026-03-28', '2026-03-30', 2],
      ['2026-10-24', '2026-10-26', 2],
      ['2026-10-20', '2026-10-20', 0],
      ['2026-10-21', '2026-10-20', -1],
    ]) expect(daysBetween(start, end)).toBe(expected);
    // Les journées de ces week-ends ne durent réellement que 47 et 49 heures.
    expect((parseDate('2026-03-30') - parseDate('2026-03-28')) / 3600000).toBe(47);
    expect((parseDate('2026-10-26') - parseDate('2026-10-24')) / 3600000).toBe(49);
  });

  it('résout le jour courant avec une horloge contrôlée à minuit en Europe/Paris', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-12-31T23:30:00Z'));
    expect(todayKey()).toBe('2027-01-01');
    const events = [exam('nouvel-an', '2027-01-01'), exam('veille', '2026-12-31')];
    expect(selectUpcomingExams(events).map(item => item.id)).toEqual(['nouvel-an']);
  });

  it('sélectionne la période en cours puis les examens à venir, avec un tri stable sans mutation', () => {
    const events = [
      exam('b', '2026-11-01'), exam('a', '2026-11-01'),
      exam('encours', '2026-10-19', '2026-10-21'),
      exam('termine', '2026-10-18'), exam('exemple', '2026-10-20', undefined, { example: true }),
      exam('cours', '2026-10-20', undefined, { type: 'cours' }),
    ];
    const before = structuredClone(events);
    expect(selectUpcomingExams(events, '2026-10-20').map(item => item.id)).toEqual(['encours', 'a', 'b']);
    expect(daysBetween('2026-10-20', selectUpcomingExams(events, '2026-10-20')[0].start)).toBe(-1);
    expect(events).toEqual(before);
  });

  it('ne crée pas de prochain examen en l’absence de période réelle à venir', () => {
    expect(selectUpcomingExams([], '2026-10-20')).toEqual([]);
    expect(selectUpcomingExams([exam('passe', '2026-01-01'), exam('exemple', '2026-11-01', undefined, { example: true })], '2026-10-20')).toEqual([]);
  });

  it('écarte les événements aux dates invalides avant de sélectionner le prochain examen', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ events: [
        exam('sans-date', undefined), exam('impossible', '2026-02-30'),
        exam('inverse', '2026-10-25', '2026-10-24'),
        exam('valide', '2026-10-26', undefined),
      ] }),
    }));
    const data = await loadCalendar();
    expect(data.error).toBeNull();
    expect(data.warnings).toHaveLength(3);
    expect(selectUpcomingExams(data.events, '2026-10-20').map(item => item.id)).toEqual(['valide']);
    expect(data.events[0].end).toBe('2026-10-26');
  });
});
