import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appearanceRuntime, appearanceStorage } from '../helpers/appearance-runtime.js';

const KEY = 'bprea-demo-appearance-device-v1';
const LEGACY = 'bprea-demo-theme-v1';
const history = { 'bprea-demo-progress-v1': '{"lesson":{"done":true}}', 'bprea-demo-drill-v1': '{"series":{"historique":true}}' };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-20T10:00:00+02:00'));
});
afterEach(() => vi.useRealTimers());

describe('Préférences et chargement synchrone du thème', () => {
  it('applique les choix enregistrés dès l’initialisation et les retrouve après rechargement simulé', () => {
    const storage = appearanceStorage({ ...history, [KEY]: JSON.stringify({ version: 1, season: 'winter', brightness: 'light' }) });
    const first = appearanceRuntime(storage);
    expect(first.document.documentElement.dataset).toEqual({ season: 'winter', time: 'day', theme: 'light' });
    first.api.updatePreferences({ season: 'summer', brightness: 'dark' });
    expect(appearanceRuntime(storage).api.getPreferences()).toMatchObject({ season: 'winter', brightness: 'light' });
    expect(first.api.remember()).toBeNull();
    const reloaded = appearanceRuntime(storage);
    expect(reloaded.document.documentElement.dataset).toEqual({ season: 'summer', time: 'night', theme: 'dark' });
    expect(reloaded.api.getPreferences()).toEqual({ version: 1, season: 'summer', brightness: 'dark' });
    expect(storage.snapshot()).toMatchObject(history);
  });

  it('reprend les anciens modes clair et sombre en mémoire et conserve les originaux après retrait', () => {
    for (const brightness of ['light', 'dark']) {
      const storage = appearanceStorage({ ...history, [LEGACY]: brightness });
      const { api, document } = appearanceRuntime(storage);
      expect(api.getPreferences().brightness).toBe('auto');
      expect(api.recallArchived()).toBeNull();
      expect(api.getPreferences()).toMatchObject({ version: 1, season: 'auto', brightness });
      expect(document.documentElement.dataset.theme).toBe(brightness);
      expect(storage.getItem(KEY)).toBeNull();
      expect(api.remember()).toBeNull();
      expect(JSON.parse(storage.getItem(KEY))).toMatchObject({ version: 1, brightness });
      expect(appearanceRuntime(storage).api.getState().theme).toBe(brightness);
      expect(api.forget()).toBeNull();
      expect(storage.snapshot()).toEqual({ ...history, [LEGACY]: brightness });
      expect(appearanceRuntime(storage).api.getPreferences().brightness).toBe('auto');
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
    expect(api.remember()).toMatch(/indisponible/);
    expect(api.getState()).toEqual({ season: 'winter', time: 'day', theme: 'light' });
    expect(storage.snapshot()).toMatchObject(history);
  });
});
