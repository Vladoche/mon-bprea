import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appearanceRuntime, appearanceStorage } from '../helpers/appearance-runtime.js';

const KEY = 'bprea-demo-appearance-v1';
const auto = { season: 'auto', brightness: 'auto' };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-20T10:00:00+02:00'));
});
afterEach(() => vi.useRealTimers());

describe('Résolution de l’apparence', () => {
  it('sélectionne les quatre saisons aux transitions mensuelles prévues', () => {
    const { api } = appearanceRuntime();
    const expectations = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'];
    for (let month = 0; month < 12; month++) {
      expect(api.resolve(auto, new Date(2026, month, 1, 12)).season).toBe(expectations[month]);
    }
  });

  it('respecte chaque seuil horaire local de la nuit au crépuscule', () => {
    const { api } = appearanceRuntime();
    for (const [hour, minute, time, theme] of [
      [0, 0, 'night', 'dark'], [5, 59, 'night', 'dark'],
      [6, 0, 'morning', 'light'], [9, 59, 'morning', 'light'],
      [10, 0, 'day', 'light'], [17, 59, 'day', 'light'],
      [18, 0, 'twilight', 'light'], [21, 59, 'twilight', 'light'],
      [22, 0, 'night', 'dark'], [23, 59, 'night', 'dark'],
    ]) expect(api.resolve(auto, new Date(2026, 9, 20, hour, minute))).toMatchObject({ time, theme });
  });

  it('donne priorité aux choix manuels indépendants sur la saison et l’heure', () => {
    const { api } = appearanceRuntime();
    const night = new Date('2026-12-20T23:00:00+01:00');
    expect(api.resolve({ season: 'summer', brightness: 'light' }, night)).toEqual({ season: 'summer', time: 'day', theme: 'light' });
    expect(api.resolve({ season: 'spring', brightness: 'auto' }, night)).toEqual({ season: 'spring', time: 'night', theme: 'dark' });
    expect(api.resolve({ season: 'auto', brightness: 'dark' }, new Date(2026, 6, 20, 12))).toEqual({ season: 'summer', time: 'night', theme: 'dark' });
  });

  it('revient aux choix automatiques pour les valeurs enregistrées invalides et refuse un correctif invalide', () => {
    const storage = appearanceStorage({ [KEY]: JSON.stringify({ version: 1, season: 'typhon', brightness: 'sepia', futureField: 'conserver' }) });
    const { api } = appearanceRuntime(storage);
    expect(api.getPreferences()).toMatchObject({ version: 1, season: 'auto', brightness: 'auto', futureField: 'conserver' });
    api.updatePreferences({ season: 'summer', brightness: 'dark' });
    api.updatePreferences({ season: 'invalide', brightness: 'invalide' });
    expect(api.getState()).toEqual({ season: 'summer', time: 'night', theme: 'dark' });
    expect(JSON.parse(storage.getItem(KEY)).futureField).toBe('conserver');
  });

  it('préserve les préférences illisibles et de version future, puis les archive lors d’un choix explicite', () => {
    for (const raw of ['{illisible', JSON.stringify({ version: 9, season: 'ocean', custom: 'ne pas perdre' })]) {
      const storage = appearanceStorage({ [KEY]: raw, 'bprea-demo-progress-v1': 'historique' });
      const { api } = appearanceRuntime(storage);
      expect(api.getPreferences()).toMatchObject({ season: 'auto', brightness: 'auto', unrecognizedPreferencesArchive: [raw] });
      expect(storage.getItem(KEY)).toBe(raw);
      api.updatePreferences({ brightness: 'dark' });
      expect(JSON.parse(storage.getItem(KEY)).unrecognizedPreferencesArchive).toEqual([raw]);
      expect(storage.getItem('bprea-demo-progress-v1')).toBe('historique');
    }
  });
});
