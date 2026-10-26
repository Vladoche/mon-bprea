// Script classique synchrone avant CSS : choix de l’appareil, puis Auth asynchrone.
(function () {
  'use strict';
  const STORAGE_KEY = 'bprea-demo-appearance-v1';
  const LEGACY_KEY = 'bprea-demo-theme-v1';
  const seasons = ['auto', 'spring', 'summer', 'autumn', 'winter'];
  const brightnesses = ['auto', 'light', 'dark'];
  // Convention locale, remplaçable ultérieurement par un fournisseur solaire.
  const timePeriods = [
    { start: 6, end: 10, name: 'morning' },
    { start: 10, end: 18, name: 'day' },
    { start: 18, end: 22, name: 'twilight' }
  ];

  function readPreferences(fallback) {
    let raw = null;
    let legacy = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
      legacy = localStorage.getItem(LEGACY_KEY);
    } catch { if (fallback) return { ...fallback }; }
    let saved;
    try { saved = JSON.parse(raw); } catch {}
    const valid = saved && typeof saved === 'object' && !Array.isArray(saved) && saved.version === 1;
    const preferences = {
      ...(valid ? saved : {}),
      ...(!valid && raw !== null ? { unrecognizedPreferencesArchive: [raw] } : {}),
      version: 1,
      season: valid && seasons.includes(saved.season) ? saved.season : 'auto',
      brightness: valid && brightnesses.includes(saved.brightness)
        ? saved.brightness : brightnesses.includes(legacy) && legacy !== 'auto' ? legacy : 'auto'
    };
    // Ne jamais remplacer une valeur existante illisible ou d'une version future.
    // L'ancienne clé est conservée intégralement, y compris après migration.
    if (raw === null && (legacy === 'light' || legacy === 'dark')) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)); } catch {}
    }
    return preferences;
  }

  function getLocalTimePeriod(date) {
    const hour = date.getHours();
    return timePeriods.find(period => hour >= period.start && hour < period.end)?.name || 'night';
  }

  function resolve(preferences, date = new Date()) {
    const month = date.getMonth();
    const season = preferences.season === 'auto'
      ? ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'][month]
      : preferences.season;
    const time = preferences.brightness === 'auto'
      ? getLocalTimePeriod(date) : preferences.brightness === 'dark' ? 'night' : 'day';
    return { season, time, theme: time === 'night' ? 'dark' : 'light' };
  }

  let preferences = readPreferences();
  let unsaved = false;
  let source = 'device';
  let personalWriter = null;
  let provisional = null;
  let state;
  function refresh(date = new Date()) {
    const next = resolve(provisional || preferences, date);
    if (state && Object.keys(next).every(key => next[key] === state[key])) return;
    state = next;
    const root = document.documentElement;
    root.dataset.season = state.season;
    root.dataset.time = state.time;
    root.dataset.theme = state.theme;
    window.dispatchEvent(new CustomEvent('bprea:appearance-change', { detail: { ...state } }));
  }

  function updatePreferences(patch) {
    if (source !== 'device') {
      provisional = null;
      preferences = { version: 1,
        season: seasons.includes(patch.season) ? patch.season : preferences.season,
        brightness: brightnesses.includes(patch.brightness) ? patch.brightness : preferences.brightness,
        updatedAt: new Date().toISOString() };
      refresh();
      window.dispatchEvent(new CustomEvent('bprea:preferences-change', { detail: { saved: false, pending: !!personalWriter } }));
      if (personalWriter) personalWriter({ ...preferences });
      return false; // Only the asynchronous adapter can confirm a personal save.
    }
    // Relire la sauvegarde pour préserver les champs d'un autre onglet / futur compte.
    const stored = unsaved ? preferences : readPreferences(preferences);
    preferences = {
      ...stored,
      season: seasons.includes(patch.season) ? patch.season : stored.season,
      brightness: brightnesses.includes(patch.brightness) ? patch.brightness : stored.brightness,
      updatedAt: new Date().toISOString()
    };
    let saved = false;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)); saved = true; } catch {}
    unsaved = !saved;
    refresh();
    window.dispatchEvent(new CustomEvent('bprea:preferences-change', { detail: { saved } }));
    return saved;
  }

  window.BpreaAppearance = Object.freeze({
    storageKey: STORAGE_KEY,
    getPreferences: () => ({ ...preferences }),
    getState: () => ({ ...state }),
    resolve,
    refresh,
    updatePreferences,
    getSource: () => source,
    getDevicePreferences: () => readPreferences(),
    // Applying a verified/cache value never calls the writer and never touches
    // visitor storage. No identity is passed into the visual runtime.
    setSource(next, value, writer = null) {
      source = next === 'personal' ? 'personal' : next === 'blocked' ? 'blocked' : 'device';
      personalWriter = source === 'personal' ? writer : null;
      // An empty account has no verified preference yet. Keep only the device
      // rendering provisionally; the editable personal model remains auto/auto.
      provisional = source === 'personal' && !value ? readPreferences() : null;
      unsaved = false;
      preferences = source === 'device' ? readPreferences() : {
        version: 1, season: seasons.includes(value?.season) ? value.season : 'auto',
        brightness: brightnesses.includes(value?.brightness) ? value.brightness : 'auto',
        ...(value?.updatedAt ? { updatedAt: value.updatedAt } : {})
      };
      refresh();
      window.dispatchEvent(new CustomEvent('bprea:preferences-change'));
    },
    applyPreferences(value) {
      if (!value || !seasons.includes(value.season) || !brightnesses.includes(value.brightness)) return false;
      provisional = null;
      preferences = { version: 1, season: value.season, brightness: value.brightness,
        ...(value.updatedAt ? { updatedAt: value.updatedAt } : {}) };
      refresh();
      window.dispatchEvent(new CustomEvent('bprea:preferences-change'));
      return true;
    }
  });
  refresh();
  window.setInterval(() => refresh(), 60000);
  window.addEventListener('pageshow', () => refresh());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  window.addEventListener('storage', event => {
    if (source !== 'device') return;
    if (event.key !== STORAGE_KEY && event.key !== LEGACY_KEY && event.key !== null) return;
    preferences = readPreferences();
    unsaved = false;
    refresh();
    window.dispatchEvent(new CustomEvent('bprea:preferences-change'));
  });
})();
