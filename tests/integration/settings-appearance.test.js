import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { appearanceRuntime, appearanceStorage } from '../helpers/appearance-runtime.js';

const KEY = 'bprea-demo-appearance-v1';
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-20T10:00:00+02:00')); });
afterEach(() => vi.useRealTimers());

describe('Passage du thème synchrone aux préférences personnelles', () => {
  it('garde le script classique avant la première feuille CSS sur chaque page', () => {
    const root = new URL('../../', import.meta.url);
    for (const name of readdirSync(root).filter(name => name.endsWith('.html'))) {
      const html = readFileSync(new URL(name, root), 'utf8');
      const tag = html.match(/<script\b[^>]*src="assets\/theme-init\.js[^>]*>/)?.[0];
      expect(tag, name).toBeTruthy();
      expect(tag, name).not.toMatch(/\b(?:async|defer|type="module")\b/);
      expect(html.indexOf(tag), name).toBeLessThan(html.search(/<link\b[^>]*rel="stylesheet"/));
    }
  });

  it('applique un cache personnel sans écrire la clé visiteur ni relancer une opération', () => {
    const source = JSON.stringify({ version: 1, season: 'spring', brightness: 'light', future: 'préserver' });
    const storage = appearanceStorage({ [KEY]: source, 'bprea-demo-theme-v1': 'dark' });
    const { api, window } = appearanceRuntime(storage);
    const writer = vi.fn();
    api.setSource('personal', { version: 1, season: 'winter', brightness: 'dark' }, writer);
    expect(api.getState()).toEqual({ season: 'winter', time: 'night', theme: 'dark' });
    api.applyPreferences({ version: 1, season: 'auto', brightness: 'auto' });
    api.refresh(new Date('2026-06-01T23:00:00+02:00'));
    window.dispatchEvent({ type: 'storage', key: KEY });
    expect(writer).not.toHaveBeenCalled();
    expect(api.getPreferences()).toMatchObject({ season: 'auto', brightness: 'auto' });
    expect(storage.getItem(KEY)).toBe(source);
    expect(storage.getItem('bprea-demo-theme-v1')).toBe('dark');
  });

  it('sauvegarde le choix auto au lieu de son rendu et ne prétend pas un succès synchrone', () => {
    const { api, storage } = appearanceRuntime();
    const writer = vi.fn();
    api.setSource('personal', { version: 1, season: 'winter', brightness: 'dark' }, writer);
    expect(api.updatePreferences({ season: 'auto', brightness: 'auto' })).toBe(false);
    expect(writer).toHaveBeenCalledExactlyOnceWith({ version: 1, season: 'auto', brightness: 'auto', updatedAt: '2026-10-20T08:00:00.000Z' });
    api.refresh(new Date('2026-12-20T23:00:00+01:00'));
    expect(api.getState().theme).toBe('dark');
    api.refresh(new Date('2026-06-20T12:00:00+02:00'));
    expect(api.getState()).toEqual({ season: 'summer', time: 'day', theme: 'light' });
    expect(writer).toHaveBeenCalledTimes(1);
    expect(storage.getItem(KEY)).toBeNull();
  });

  it('retire A au rejet ou au changement de compte et retrouve le visiteur sans effacer A', () => {
    const storage = appearanceStorage({ [KEY]: JSON.stringify({ version: 1, season: 'spring', brightness: 'light' }) });
    const { api } = appearanceRuntime(storage);
    const writerA = vi.fn(), writerB = vi.fn();
    api.setSource('personal', { version: 1, season: 'winter', brightness: 'dark' }, writerA);
    api.setSource('blocked');
    expect(api.getPreferences()).toEqual({ version: 1, season: 'auto', brightness: 'auto' });
    api.updatePreferences({ season: 'summer' });
    expect(writerA).not.toHaveBeenCalled();
    api.setSource('personal', null, writerB);
    expect(api.getPreferences().season).toBe('auto');
    api.updatePreferences({ brightness: 'dark' });
    expect(writerA).not.toHaveBeenCalled();
    expect(writerB).toHaveBeenCalledTimes(1);
    api.setSource('device');
    expect(api.getPreferences()).toMatchObject({ season: 'spring', brightness: 'light' });
  });

  it('un compte vide garde le rendu provisoire de l’appareil sans importer ses choix dans le modèle personnel', () => {
    const raw = JSON.stringify({ version: 1, season: 'winter', brightness: 'dark' });
    const { api, storage } = appearanceRuntime(appearanceStorage({ [KEY]: raw }));
    const writer = vi.fn();
    api.setSource('personal', null, writer);
    expect(api.getState()).toEqual({ season: 'winter', time: 'night', theme: 'dark' });
    expect(api.getPreferences()).toEqual({ version: 1, season: 'auto', brightness: 'auto' });
    expect(writer).not.toHaveBeenCalled();
    api.updatePreferences({ brightness: 'light' });
    expect(writer.mock.calls[0][0]).toMatchObject({ season: 'auto', brightness: 'light' });
    expect(storage.getItem(KEY)).toBe(raw);
  });

  it('recalcule aux retours de page, aux seuils et passages de saison sans modifier les choix', () => {
    const { api, window, document } = appearanceRuntime();
    api.setSource('personal', { version: 1, season: 'auto', brightness: 'auto' }, vi.fn());
    vi.setSystemTime(new Date(2026, 10, 30, 23, 59));
    window.dispatchEvent({ type: 'pageshow' });
    expect(api.getState()).toEqual({ season: 'autumn', time: 'night', theme: 'dark' });
    vi.setSystemTime(new Date(2026, 11, 1, 6));
    document.dispatchEvent({ type: 'visibilitychange' });
    expect(api.getState()).toEqual({ season: 'winter', time: 'morning', theme: 'light' });
    expect(api.getPreferences()).toEqual({ version: 1, season: 'auto', brightness: 'auto' });
  });

  it('suit l’heure locale après les deux changements d’heure sans changer les préférences', () => {
    const { api } = appearanceRuntime();
    api.setSource('personal', { version: 1, season: 'auto', brightness: 'auto' }, vi.fn());
    for (const [date, season] of [['2026-03-29T04:00:00Z', 'spring'], ['2026-10-25T05:00:00Z', 'autumn']]) {
      api.refresh(new Date(date));
      expect(api.getState()).toEqual({ season, time: 'morning', theme: 'light' });
      expect(api.getPreferences()).toEqual({ version: 1, season: 'auto', brightness: 'auto' });
    }
  });
});
