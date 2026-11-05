// Script classique synchrone avant CSS : choix de l’appareil, puis Auth asynchrone.
(function () {
  'use strict';
  const STORAGE_KEY = 'bprea-demo-appearance-device-v1';
  const ARCHIVED_KEY = 'bprea-demo-appearance-v1';
  const LEGACY_KEY = 'bprea-demo-theme-v1';
  const seasons = ['auto', 'spring', 'summer', 'autumn', 'winter'];
  const brightnesses = ['auto', 'light', 'dark'];
  const automatic = { version: 1, season: 'auto', brightness: 'auto' };
  // Convention locale, remplaçable ultérieurement par un fournisseur solaire.
  const timePeriods = [
    { start: 6, end: 10, name: 'morning' },
    { start: 10, end: 18, name: 'day' },
    { start: 18, end: 22, name: 'twilight' }
  ];

  function parse(raw) {
    try { return JSON.parse(raw); } catch { return null; }
  }
  function decodeRemembered(raw) {
    const value = parse(raw);
    return value?.version === 1 && seasons.includes(value.season) && brightnesses.includes(value.brightness) &&
      Object.keys(value).length === 3 ? value : null;
  }
  function readRemembered() {
    try { return decodeRemembered(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
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

  let remembered = readRemembered();
  let devicePreferences = remembered || automatic;
  let preferences = devicePreferences;
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
    provisional = null;
    preferences = {
      version: 1,
      season: seasons.includes(patch.season) ? patch.season : preferences.season,
      brightness: brightnesses.includes(patch.brightness) ? patch.brightness : preferences.brightness,
      ...(personalWriter ? { updatedAt: new Date().toISOString() } : {})
    };
    if (source === 'device') devicePreferences = preferences;
    preferencesChanged();
    if (personalWriter) personalWriter({ ...preferences });
    return false;
  }

  function preferencesChanged() {
    refresh();
    window.dispatchEvent(new CustomEvent('bprea:preferences-change'));
  }
  function reloadDevicePreferences() {
    const previous = remembered;
    remembered = readRemembered();
    if (devicePreferences === (previous || automatic)) devicePreferences = remembered || automatic;
    if (source === 'device') preferences = devicePreferences;
    if (provisional) provisional = remembered || automatic;
    preferencesChanged();
  }

  window.BpreaAppearance = Object.freeze({
    storageKey: STORAGE_KEY,
    getPreferences: () => ({ ...preferences }),
    getState: () => ({ ...state }),
    resolve,
    refresh,
    updatePreferences,
    getSource: () => source,
    getDevicePreferences: () => ({ ...devicePreferences }),
    getRemembered: () => remembered && { ...remembered },
    reloadDevicePreferences,
    remember() {
      if (source !== 'device') return 'Indisponible pendant la vérification du compte.';
      const { season, brightness } = preferences;
      if (season === 'auto' && brightness === 'auto') return 'L’apparence automatique est disponible sur toutes les pages.';
      try {
        const previous = localStorage.getItem(STORAGE_KEY);
        if (previous !== null && !decodeRemembered(previous)) return 'Le choix mémorisé est illisible ou d’une autre version. Il est conservé.';
        const next = { version: 1, season, brightness };
        const raw = JSON.stringify(next);
        if (raw !== previous) localStorage.setItem(STORAGE_KEY, raw);
        remembered = devicePreferences = preferences = next;
        preferencesChanged();
        return null;
      } catch { return 'Le stockage local est indisponible. Ce choix reste actif sur cette page.'; }
    },
    forget() {
      if (source !== 'device') return 'Indisponible pendant la vérification du compte.';
      try {
        localStorage.removeItem(STORAGE_KEY);
        remembered = null;
        preferencesChanged();
        return null;
      } catch { return 'Le stockage local est indisponible. Le retrait n’a pas abouti.'; }
    },
    recallArchived() {
      if (source !== 'device') return 'Indisponible pendant la vérification du compte.';
      try {
        const saved = parse(localStorage.getItem(ARCHIVED_KEY));
        const season = saved?.version === 1 && seasons.includes(saved.season) ? saved.season : null;
        const brightness = saved?.version === 1 && brightnesses.includes(saved.brightness) ? saved.brightness : null;
        const legacy = brightness === null ? localStorage.getItem(LEGACY_KEY) : null;
        if (!season && !brightness && !['light', 'dark'].includes(legacy)) return 'Aucune ancienne apparence lisible.';
        updatePreferences({ season: season || 'auto', brightness: brightness || (['light', 'dark'].includes(legacy) ? legacy : 'auto') });
        return null;
      } catch { return 'Le stockage local est indisponible. Les anciens choix sont conservés.'; }
    },
    // Applying a verified/cache value never calls the writer and never touches
    // visitor storage. No identity is passed into the visual runtime.
    setSource(next, value, writer = null) {
      source = next === 'personal' ? 'personal' : next === 'blocked' ? 'blocked' : 'device';
      personalWriter = source === 'personal' ? writer : null;
      // An empty account has no verified preference yet. Keep only the device
      // rendering provisionally; the editable personal model remains auto/auto.
      provisional = source === 'personal' && !value ? remembered || automatic : null;
      preferences = source === 'device' ? devicePreferences : {
        version: 1, season: seasons.includes(value?.season) ? value.season : 'auto',
        brightness: brightnesses.includes(value?.brightness) ? value.brightness : 'auto',
        ...(value?.updatedAt ? { updatedAt: value.updatedAt } : {})
      };
      preferencesChanged();
    },
    applyPreferences(value) {
      if (!value || !seasons.includes(value.season) || !brightnesses.includes(value.brightness)) return false;
      provisional = null;
      preferences = { version: 1, season: value.season, brightness: value.brightness,
        ...(value.updatedAt ? { updatedAt: value.updatedAt } : {}) };
      if (source === 'device') devicePreferences = preferences;
      preferencesChanged();
      return true;
    }
  });
  refresh();
  window.setInterval(() => refresh(), 60000);
  window.addEventListener('pageshow', () => refresh());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEY || event.key === null) reloadDevicePreferences();
  });
})();
