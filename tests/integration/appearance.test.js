import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appearanceRuntime, appearanceStorage } from '../helpers/appearance-runtime.js';

const KEY = 'bprea-demo-appearance-v1';
const LEGACY = 'bprea-demo-theme-v1';
const history = { 'bprea-demo-progress-v1': '{"lesson":{"done":true}}', 'bprea-demo-drill-v1': '{"series":{"historique":true}}' };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-20T10:00:00+02:00'));
});
afterEach(() => vi.useRealTimers());

describe('Préférences et chargement synchrone du thème', () => {
  it('applique les choix enregistrés dès l’initialisation et les retrouve après rechargement simulé', () => {
    const storage = appearanceStorage({ ...history, [KEY]: JSON.stringify({ version: 1, season: 'winter', brightness: 'light', accountField: 'conserver' }) });
    const first = appearanceRuntime(storage);
    expect(first.document.documentElement.dataset).toEqual({ season: 'winter', time: 'day', theme: 'light' });
    expect(first.api.updatePreferences({ season: 'summer', brightness: 'dark' })).toBe(true);
    const reloaded = appearanceRuntime(storage);
    expect(reloaded.document.documentElement.dataset).toEqual({ season: 'summer', time: 'night', theme: 'dark' });
    expect(reloaded.api.getPreferences()).toMatchObject({ accountField: 'conserver', updatedAt: '2026-10-20T08:00:00.000Z' });
    expect(storage.snapshot()).toMatchObject(history);
  });

  it('migre les anciens modes clair et sombre sans supprimer l’ancienne clé ni les sauvegardes pédagogiques', () => {
    for (const brightness of ['light', 'dark']) {
      const storage = appearanceStorage({ ...history, [LEGACY]: brightness });
      const { api, document } = appearanceRuntime(storage);
      expect(api.getPreferences()).toMatchObject({ version: 1, season: 'auto', brightness });
      expect(document.documentElement.dataset.theme).toBe(brightness);
      expect(JSON.parse(storage.getItem(KEY))).toMatchObject({ version: 1, brightness });
      expect(storage.snapshot()).toMatchObject({ ...history, [LEGACY]: brightness });
      expect(appearanceRuntime(storage).api.getState().theme).toBe(brightness);
    }
  });

  it('adopte les préférences d’un autre onglet et maintient un choix en mémoire si le stockage refuse l’écriture', () => {
    const storage = appearanceStorage(history);
    const { api, window, document } = appearanceRuntime(storage);
    storage.setItem(KEY, JSON.stringify({ version: 1, season: 'spring', brightness: 'dark' }));
    window.dispatchEvent({ type: 'storage', key: KEY });
    expect(document.documentElement.dataset).toEqual({ season: 'spring', time: 'night', theme: 'dark' });
    storage.setItem = () => { throw new Error('quota dépassé'); };
    expect(api.updatePreferences({ brightness: 'light' })).toBe(false);
    expect(api.getState()).toEqual({ season: 'spring', time: 'day', theme: 'light' });
    expect(api.updatePreferences({ season: 'winter' })).toBe(false);
    expect(api.getState()).toEqual({ season: 'winter', time: 'day', theme: 'light' });
    expect(storage.snapshot()).toMatchObject(history);
  });
});
