// Script classique synchrone avant CSS. La continuité visuelle n'autorise aucun accès.
(function () {
  'use strict';
  const STORAGE_KEY = 'bprea-demo-appearance-device-v1';
  const AUTH_KEY = 'bprea-auth-';
  const IDENTITY_KEY = 'bprea-auth-local-identity-v1:';
  const seasons = ['auto', 'spring', 'summer', 'autumn', 'winter'];
  const brightnesses = ['auto', 'light', 'dark'];
  const automatic = { version: 1, season: 'auto', brightness: 'auto' };
  const neutral = { ...automatic, brightness: 'dark' };
  const validHex = value => typeof value === 'string' && /^#[0-9a-f]{6}$/.test(value);
  const validColor = value => (value.colorMode === 'seasonal' && value.customColor === null) ||
    (['seasonal', 'custom'].includes(value.colorMode) && validHex(value.customColor));
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
    if (value?.version !== 1 || !seasons.includes(value.season) || !brightnesses.includes(value.brightness)) return null;
    const keys = Object.keys(value);
    if (keys.length === 3) return value;
    return keys.length === 5 && validColor(value) ? value : null;
  }
  function readRemembered() {
    try { return decodeRemembered(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
  }

  function storedSession() {
    if (!window.location) return null;
    try {
      const mount = new URL('.', window.location.href).pathname;
      const suffix = '-' + mount;
      const sessions = [];
      const markers = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(IDENTITY_KEY)) markers.push(key);
        else if (key?.startsWith(AUTH_KEY) && key.endsWith(suffix)) sessions.push(key);
      }
      if (!sessions.length) {
        // Some browsers expose length but deny reads.
        localStorage.getItem(STORAGE_KEY);
        return null;
      }
      if (sessions.length !== 1) return {};
      const key = sessions[0];
      const session = parse(localStorage.getItem(key));
      const encoded = session.access_token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/');
      const claims = parse(atob(encoded));
      if (!claims?.sub || session.user?.id !== claims.sub || !/^[0-9a-f-]{36}$/i.test(claims.session_id || '')) return {};
      const matching = markers.filter(marker => {
        const scope = parse(marker.slice(IDENTITY_KEY.length));
        if (!Array.isArray(scope) || scope.length !== 3 || scope[2] !== mount) return false;
        try { return key === AUTH_KEY + new URL(scope[1]).hostname + suffix; }
        catch { return false; }
      });
      const saved = matching.length === 1 ? parse(localStorage.getItem(matching[0])) : null;
      const brightness = saved?.version === 1 && saved.userId === claims.sub && saved.sessionId === claims.session_id &&
        brightnesses.includes(saved.brightness) ? saved.brightness : null;
      return { key, sessionId: claims.session_id, brightness };
    } catch { return {}; }
  }

  function bootPreferences(session = storedSession()) {
    if (!session) return remembered || automatic;
    // The early render never reads the account's season, colors or IndexedDB.
    return session.brightness ? { ...automatic, brightness: session.brightness } : neutral;
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
    return { season, time, theme: time === 'night' ? 'dark' : 'light',
      ...(preferences.colorMode === 'custom' ? { color: preferences.customColor } : {}) };
  }

  let remembered = readRemembered();
  let devicePreferences = remembered || automatic;
  let preferences = automatic;
  let source = 'blocked';
  let personalWriter = null;
  let provisional = bootPreferences();
  let booting = true;
  let boundSession = null;
  if (provisional === devicePreferences) { source = 'device'; preferences = devicePreferences; provisional = null; }
  let previewColor = null;
  let state;

  // Convert the chosen sRGB color to an OKLCH hue. Lightness and chroma are
  // constrained by each CSS role, independently of the swatch's contrast.
  function setColor(root, color) {
    if (!color || !root.style) {
      root.style?.removeProperty('--appearance-hue');
      root.style?.removeProperty('--appearance-chroma');
      return;
    }
    const [r, g, b] = color.slice(1).match(/../g).map(pair => {
      const n = parseInt(pair, 16) / 255;
      return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
    });
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    const axis = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    root.style.setProperty('--appearance-hue', `${(Math.atan2(axis, a) * 180 / Math.PI).toFixed(2)}deg`);
    root.style.setProperty('--appearance-chroma', Math.min(0.145, Math.hypot(a, axis) * 1.15).toFixed(3));
  }

  function refresh(date = new Date()) {
    const value = provisional || preferences;
    const next = resolve(previewColor && value.colorMode === 'custom' ? { ...value, customColor: previewColor } : value, date);
    if (state && next.color === state.color && next.season === state.season && next.time === state.time && next.theme === state.theme) return;
    state = next;
    const root = document.documentElement;
    root.dataset.season = state.season;
    root.dataset.time = state.time;
    root.dataset.theme = state.theme;
    if (state.color) root.dataset.colorMode = 'custom';
    else delete root.dataset.colorMode;
    setColor(root, state.color);
    window.dispatchEvent(new CustomEvent('bprea:appearance-change', { detail: { ...state } }));
  }

  function updatePreferences(patch) {
    provisional = null;
    booting = false;
    const chromatic = { ...preferences };
    if (['seasonal', 'custom'].includes(patch.colorMode)) chromatic.colorMode = patch.colorMode;
    if (validHex(patch.customColor) || patch.customColor === null) chromatic.customColor = patch.customColor;
    preferences = {
      version: 1,
      season: seasons.includes(patch.season) ? patch.season : preferences.season,
      brightness: brightnesses.includes(patch.brightness) ? patch.brightness : preferences.brightness,
      ...(validColor(chromatic) ? { colorMode: chromatic.colorMode, customColor: chromatic.customColor } : {}),
      ...(personalWriter ? { updatedAt: new Date().toISOString() } : {})
    };
    if (source === 'device') devicePreferences = preferences;
    preferencesChanged();
    if (personalWriter) personalWriter({ ...preferences });
    return false;
  }

  function preferencesChanged() {
    previewColor = null;
    refresh();
    window.dispatchEvent(new CustomEvent('bprea:preferences-change'));
  }
  function reloadDevicePreferences() {
    const previous = remembered;
    remembered = readRemembered();
    if (devicePreferences === (previous || automatic)) devicePreferences = remembered || automatic;
    if (source === 'device') preferences = devicePreferences;
    if (provisional && booting) provisional = bootPreferences();
    else if (provisional && source === 'personal') {
      const { season, brightness } = remembered || automatic;
      provisional = { ...automatic, season, brightness };
    }
    preferencesChanged();
  }

  window.BpreaAppearance = Object.freeze({
    storageKey: STORAGE_KEY,
    getPreferences: () => ({ ...preferences }),
    getState: () => ({ ...state }),
    resolve,
    refresh,
    previewColor(value) { previewColor = validHex(value) ? value : null; refresh(); },
    updatePreferences,
    getSource: () => source,
    isProvisional: () => provisional !== null,
    getDevicePreferences: () => ({ ...devicePreferences }),
    getRemembered: () => remembered && { ...remembered },
    renderEmptyAccount() {
      if (!personalWriter) return;
      const { season, brightness } = remembered || automatic;
      provisional = { ...automatic, season, brightness };
      booting = false;
      preferencesChanged();
    },
    reloadDevicePreferences,
    remember() {
      if (source !== 'device') return 'Indisponible pendant la vérification du compte.';
      const { updatedAt, ...next } = preferences;
      try {
        const previous = localStorage.getItem(STORAGE_KEY);
        if (previous !== null && !decodeRemembered(previous)) return 'Le choix mémorisé est illisible ou d’une autre version. Il est conservé.';
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
    // Applying a verified/cache value never calls the writer and never touches
    // visitor storage. No identity is passed into the visual runtime.
    setSource(next, value, writer = null) {
      source = next === 'personal' ? 'personal' : next === 'blocked' ? 'blocked' : 'device';
      personalWriter = source === 'personal' ? writer : null;
      const session = source !== 'device' ? storedSession() : null;
      boundSession = source === 'personal' && session?.sessionId ? session : null;
      booting = source !== 'device' && !value;
      provisional = booting ? bootPreferences(session) : null;
      preferences = source === 'device' ? devicePreferences : {
        version: 1, season: seasons.includes(value?.season) ? value.season : 'auto',
        brightness: brightnesses.includes(value?.brightness) ? value.brightness : 'auto',
        ...(value && validColor(value) ? { colorMode: value.colorMode, customColor: value.customColor } : {}),
        ...(value?.updatedAt ? { updatedAt: value.updatedAt } : {})
      };
      preferencesChanged();
    },
    applyPreferences(value) {
      if (!value || !seasons.includes(value.season) || !brightnesses.includes(value.brightness)) return false;
      provisional = null;
      booting = false;
      preferences = { version: 1, season: value.season, brightness: value.brightness,
        ...(validColor(value) ? { colorMode: value.colorMode, customColor: value.customColor } : {}),
        ...(value.updatedAt ? { updatedAt: value.updatedAt } : {}) };
      if (source === 'device') devicePreferences = preferences;
      preferencesChanged();
      return true;
    }
  });
  refresh();
  window.setInterval(() => refresh(), 60000);
  function resume() {
    if (boundSession || provisional && booting) {
      const session = storedSession();
      if (boundSession && (session?.sessionId !== boundSession.sessionId || session?.key !== boundSession.key)) {
        window.BpreaAppearance.setSource('blocked');
        window.dispatchEvent(new CustomEvent('bprea:appearance-session-change'));
        return;
      }
      if (provisional && booting) provisional = bootPreferences(session);
    }
    refresh();
  }
  window.addEventListener('pageshow', resume);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) resume(); });
  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEY || event.key === null) reloadDevicePreferences();
    if (event.key === null || event.key.startsWith(AUTH_KEY)) resume();
  });
})();
