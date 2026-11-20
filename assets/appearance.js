import { getSettingsService } from './settings-service.js';
import { getAuthService } from './auth-service.js';
import { initAppearanceColor, defaultColor } from './appearance-color.js';
import { valueFromRow } from './settings-model.js';
import { subscribePrivacy } from './privacy-events.js';

const seasonLabels = { spring: 'Printemps', summer: 'Été', autumn: 'Automne', winter: 'Hiver' };
const clean = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const automatic = { version: 1, season: 'auto', brightness: 'auto' };
const describe = value => [
  value?.colorMode === 'custom' ? value.customColor : value?.season === 'auto' ? 'Saison automatique' : seasonLabels[value?.season] || 'Saison inconnue',
  value?.brightness === 'auto' ? 'Luminosité automatique' : value?.brightness === 'dark' ? 'Sombre' : 'Clair',
].join(' · ');
const keyOf = value => JSON.stringify([value?.season, value?.brightness, value?.colorMode ?? 'seasonal', value?.customColor ?? null]);
const statusLabels = {
  pending: 'Synchronisation en attente.',
  offline: 'Hors ligne. Synchronisation en attente.',
  conflict: 'Conflit d’apparence à résoudre.',
  error: 'Synchronisation indisponible. Choix conservés sur cet appareil.',
  'storage-error': 'Erreur de stockage. Choix non enregistré.',
  session: 'Identité à vérifier. Choix non enregistré.',
};

export function initAppearance() {
  const appearance = window.BpreaAppearance;
  const toggle = document.getElementById('theme-toggle');
  if (!appearance || !toggle) return;
  const toggleFeedback = document.createElement('span');
  toggleFeedback.id = 'theme-toggle-feedback';
  toggleFeedback.className = 'sr-only';
  toggleFeedback.setAttribute('aria-live', 'polite');
  toggleFeedback.setAttribute('aria-atomic', 'true');
  toggle.after(toggleFeedback);
  toggle.setAttribute('aria-describedby', toggleFeedback.id);
  // Keep the initial visual choice while the asynchronous identity is unknown.
  // A click in this interval applies temporarily without writing visitor data.
  appearance.setSource('blocked');

  const dialog = document.createElement('dialog');
  dialog.id = 'appearance-dialog';
  dialog.className = 'appearance-dialog';
  dialog.setAttribute('aria-labelledby', 'appearance-title');
  dialog.innerHTML = `
    <form method="dialog" class="appearance-heading">
      <h2 id="appearance-title">Ton apparence</h2>
      <button class="btn btn-surface appearance-close" type="submit" aria-label="Fermer les paramètres d’apparence" autofocus>×</button>
    </form>
    <div class="appearance-fields">
      <label for="appearance-color-mode">Palette de couleurs
        <select id="appearance-color-mode">
          <option value="seasonal">Saisonnière</option>
          <option value="custom">Personnalisée</option>
        </select>
      </label>
      <label for="appearance-season" id="appearance-season-field">Saison
        <select id="appearance-season">
          <option value="auto">Automatique</option>
          <option value="spring">Printemps</option>
          <option value="summer">Été</option>
          <option value="autumn">Automne</option>
          <option value="winter">Hiver</option>
        </select>
      </label>
      <label for="appearance-brightness">Luminosité
        <select id="appearance-brightness">
          <option value="auto">Automatique</option>
          <option value="light">Mode clair</option>
          <option value="dark">Mode sombre</option>
        </select>
      </label>
    </div>
    <fieldset id="appearance-color-picker" class="appearance-picker" hidden>
      <legend>Roue chromatique</legend>
      <div class="appearance-wheel" aria-hidden="true"><span class="appearance-wheel-cursor"></span></div>
      <div class="appearance-channels">
        <label for="appearance-hue">Teinte</label>
        <input type="range" id="appearance-hue" min="0" max="359" step="1">
        <label for="appearance-saturation">Saturation</label>
        <input type="range" id="appearance-saturation" min="0" max="100" step="1">
        <label for="appearance-value">Luminosité de la couleur</label>
        <input type="range" id="appearance-value" min="0" max="100" step="1">
        <label for="appearance-hex">Code hexadécimal</label>
        <div class="appearance-hex-row">
          <input type="text" id="appearance-hex" maxlength="7" spellcheck="false" autocomplete="off"
            autocapitalize="off" aria-describedby="appearance-hex-error">
          <span class="appearance-swatch" aria-hidden="true"></span>
        </div>
        <p id="appearance-hex-error" role="status"></p>
      </div>
    </fieldset>
    <p class="appearance-save" id="appearance-save" role="status"></p>
    <div id="appearance-device" hidden>
      <div class="appearance-sync-actions">
        <button type="button" class="btn btn-surface" id="appearance-remember">Mémoriser mon apparence sur cet appareil</button>
        <button type="button" class="btn btn-surface" id="appearance-forget" hidden>Retirer l’apparence mémorisée</button>
      </div>
    </div>
    <div class="appearance-sync-actions">
      <button type="button" class="btn btn-surface" id="appearance-sync-refresh" hidden>Réessayer la synchronisation</button>
      <button type="button" class="btn btn-surface" id="appearance-restore" hidden>Utiliser la version du compte</button>
    </div>
    <div id="appearance-conflicts"></div>
    <p id="appearance-action-message" role="status"></p>`;
  document.body.append(dialog);
  const season = dialog.querySelector('#appearance-season');
  const brightness = dialog.querySelector('#appearance-brightness');
  const save = dialog.querySelector('#appearance-save');
  const find = id => dialog.querySelector(`#${id}`);
  const mode = find('appearance-color-mode');
  const seasonField = find('appearance-season-field');
  let service, snapshot, scope = null, source = null, epoch = 0, inFlight = 0, protectedDialog = false, latest = null, markup = '', opener = null;
  const picker = initAppearanceColor(dialog, {
    preview: color => appearance.previewColor(color),
    commit: color => {
      if (appearance.getPreferences().customColor === color) appearance.previewColor(null);
      else change({ customColor: color });
    },
  });
  const announce = message => { find('appearance-action-message').textContent = message || ''; };
  function available() {
    find('appearance-restore').hidden = !dialog.open || !protectedDialog || !latest || inFlight > 0 || keyOf(latest) === keyOf(appearance.getPreferences());
  }
  function renderFields(preferences, reset = false) {
    season.value = preferences.season;
    brightness.value = preferences.brightness;
    mode.value = preferences.colorMode ?? 'seasonal';
    seasonField.hidden = season.disabled = mode.value === 'custom';
    picker.sync(preferences, { reset });
  }
  function deviceStatus() {
    const remembered = appearance.getRemembered();
    const preferences = appearance.getPreferences();
    save.textContent = keyOf(preferences) !== keyOf(remembered || automatic) ? 'Choix non mémorisé sur cet appareil.' : '';
    find('appearance-remember').disabled = keyOf(preferences) === keyOf(remembered || automatic);
    find('appearance-forget').hidden = !remembered;
  }
  function update() {
    const preferences = appearance.getPreferences();
    const state = appearance.getState();
    const dark = state.theme === 'dark';
    const device = appearance.getSource() === 'device';
    find('appearance-device').hidden = !device;
    if (device) deviceStatus();
    if (!dialog.open || !protectedDialog) renderFields(preferences);
    toggle.querySelector('.theme-icon').innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${dark ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>' : '<path d="M20.4 15.3A8.5 8.5 0 0 1 8.7 3.6 8.5 8.5 0 1 0 20.4 15.3Z"/>'}</svg>`;
    toggle.setAttribute('aria-label', dark ? 'Activer le mode clair' : 'Activer le mode sombre');
    toggle.title = `${dark ? 'Activer le mode clair' : 'Activer le mode sombre'}${device ? ' · mémoriser sur cet appareil' : ''}`;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  }
  function change(patch) {
    protectedDialog = dialog.open;
    announce('');
    appearance.updatePreferences(patch);
    renderFields(appearance.getPreferences());
    if (appearance.getSource() === 'blocked') save.textContent = snapshot?.sync.state === 'storage-error'
      ? 'Erreur de stockage : choix temporaire appliqué, non enregistré.'
      : 'Choix temporaire appliqué. Identité à vérifier ; choix non enregistré.';
    available();
  }
  // The profile page renders asynchronously. Delegation keeps the single
  // existing preferences service available without a redundant header control.
  document.addEventListener('click', event => {
    const open = event.target.closest('#appearance-open');
    if (!open) return;
    opener = open;
    protectedDialog = false;
    announce('');
    renderFields(appearance.getPreferences(), true);
    dialog.showModal();
  });
  dialog.addEventListener('close', () => {
    protectedDialog = false;
    appearance.previewColor(null);
    if (latest && !inFlight) appearance.applyPreferences(latest);
    if (opener?.isConnected) opener.focus();
  });
  season.addEventListener('change', () => change({ season: season.value }));
  brightness.addEventListener('change', () => change({ brightness: brightness.value }));
  mode.addEventListener('change', () => change({
    colorMode: mode.value,
    customColor: appearance.getPreferences().customColor || (mode.value === 'custom' ? defaultColor : null),
  }));
  dialog.addEventListener('input', () => { if (dialog.open) protectedDialog = true; }, true);
  dialog.addEventListener('pointerdown', event => { if (event.target.closest('.appearance-wheel')) protectedDialog = true; }, true);
  dialog.addEventListener('focusin', event => {
    if (event.target.matches('input, select') && dialog.open) protectedDialog = true;
  });
  toggle.addEventListener('click', () => {
    change({ brightness: appearance.getState().theme === 'dark' ? 'light' : 'dark' });
    // This explicit quick choice must survive navigation. Reuse the existing
    // voluntary device store; verified accounts keep their personal writer.
    if (appearance.getSource() === 'device') {
      const error = appearance.remember();
      toggleFeedback.textContent = error || `Mode ${appearance.getState().theme === 'dark' ? 'sombre' : 'clair'} mémorisé sur cet appareil.`;
      if (error) toggle.title += ` · ${error}`;
      announce(toggleFeedback.textContent);
    } else toggleFeedback.textContent = appearance.getSource() === 'personal' ? 'Choix appliqué au compte.' : save.textContent;
  });
  window.addEventListener('bprea:appearance-change', update);
  window.addEventListener('bprea:preferences-change', update);
  find('appearance-remember').addEventListener('click', () => announce(appearance.remember() || 'Apparence mémorisée pour les prochaines pages.'));
  find('appearance-forget').addEventListener('click', () => {
    const error = appearance.forget();
    if (!error) {
      const remember = find('appearance-remember');
      (remember.disabled ? brightness : remember).focus();
    }
    announce(error || 'Apparence mémorisée retirée. Le rendu actuel reste sur cette page.');
  });
  const unsubscribePrivacy = subscribePrivacy(phase => {
    if (phase === 'settled') appearance.reloadDevicePreferences();
  });
  window.addEventListener('pagehide', event => { if (!event.persisted) unsubscribePrivacy(); });
  async function persist(value) {
    const current = epoch; inFlight++;
    try {
      const result = await service.save('appearance', value);
      if (current !== epoch) return;
      if (result?.error) announce('Choix non enregistré. ' + result.error);
      else { announce(''); renderStatus(snapshot); }
    } catch { if (current === epoch) save.textContent = 'Erreur de stockage : choix temporaire appliqué, non enregistré.'; }
    finally { if (current === epoch) { inFlight = Math.max(0, inFlight - 1); available(); } }
  }
  function renderStatus(state) {
    if (!state || state.mode === 'visitor') return;
    const domain = state.sync.domains?.appearance || state.sync;
    save.textContent = statusLabels[domain.state] || '';
    find('appearance-sync-refresh').hidden = !['offline', 'error', 'storage-error', 'session'].includes(domain.state);
  }
  find('appearance-sync-refresh').addEventListener('click', async () => {
    const current = epoch;
    try { await service.retry(); }
    catch { if (current === epoch) announce('Actualisation indisponible. Les choix enregistrés restent conservés.'); }
  });
  find('appearance-restore').addEventListener('click', () => {
    if (!latest) return;
    protectedDialog = false;
    appearance.applyPreferences(latest);
    available();
    brightness.focus();
  });
  dialog.addEventListener('click', async event => {
    const button = event.target.closest('[data-appearance-resolve]');
    if (!button) return;
    const current = epoch; button.disabled = true;
    try {
      const result = await service.resolve(button.dataset.appearanceResolve, button.dataset.choice);
      if (current === epoch) { announce(result?.error || ''); if (!result?.error) mode.focus({ preventScroll: true }); }
    } catch { if (current === epoch) announce('Choix indisponible. Réessaie dans un instant.'); }
    finally { if (button.isConnected) button.disabled = false; }
  });
  Promise.all([getSettingsService(), getAuthService()]).then(([settings, auth]) => {
    service = settings;
    let checkingIdentity = false;
    const renderSnapshot = state => {
      snapshot = state;
      const domain = state.sync.domains?.appearance || state.sync;
      const usable = !checkingIdentity && state.mode === 'personal' && state.sync.state !== 'session' && !state.view.error;
      const nextSource = usable ? 'personal' : state.mode === 'visitor' ? 'device' : 'blocked';
      const confirmed = usable ? state.view.appearance : null;
      if (source !== nextSource || scope !== state.scope) {
        const changedIdentity = scope !== null && scope !== state.scope || source !== null && source !== 'blocked' && source !== nextSource;
        source = nextSource; scope = state.scope; epoch++; inFlight = 0; protectedDialog = false; latest = null;
        announce('');
        if (changedIdentity && dialog.open) dialog.close();
        appearance.setSource(nextSource, confirmed, usable ? persist : null);
        renderFields(appearance.getPreferences(), true);
      }
      latest = confirmed;
      const canApply = !inFlight && !(dialog.open && protectedDialog);
      if (latest && canApply && (appearance.isProvisional() || keyOf(latest) !== keyOf(appearance.getPreferences()))) appearance.applyPreferences(latest);
      const empty = usable && !latest && domain.state === 'synced';
      const fallback = appearance.getRemembered() || automatic;
      const renderHint = latest ?? (empty ? { season: fallback.season, brightness: fallback.brightness } : null);
      if (empty && canApply) appearance.renderEmptyAccount();
      if (renderHint) auth.rememberAppearance(JSON.parse(state.scope)[2], renderHint);
      renderStatus(state);
      if (state.mode === 'visitor') find('appearance-sync-refresh').hidden = true;
      available();
      const nextMarkup = (usable ? state.sync.conflicts || [] : []).filter(item => item.domain === 'appearance' && !item.resolved)
        .map(item => `<details data-appearance-conflict="${clean(item.id)}"><summary>Conflit d’apparence à résoudre</summary>
        <p>Choix de cet appareil : ${clean(describe(item.local?.value || item.local))}</p>
        <p>Version du compte : ${clean(describe(item.remote?.value || valueFromRow('appearance', item.remote)))}</p>
        <div class="appearance-sync-actions"><button type="button" class="btn btn-surface" data-appearance-resolve="${clean(item.id)}" data-choice="remote">Garder la version du compte</button>
        <button type="button" class="btn btn-surface" data-appearance-resolve="${clean(item.id)}" data-choice="local">Utiliser mon choix enregistré sur cet appareil</button></div></details>`).join('');
      if (markup !== nextMarkup) {
        const container = find('appearance-conflicts'); const opened = [...container.querySelectorAll('details[open]')].map(node => node.dataset.appearanceConflict);
        const focused = container.contains(document.activeElement) ? document.activeElement : null;
        const focusId = focused?.dataset.appearanceResolve, focusChoice = focused?.dataset.choice;
        const summaryId = focused?.tagName === 'SUMMARY' ? focused.closest('details')?.dataset.appearanceConflict : null;
        container.innerHTML = nextMarkup; markup = nextMarkup;
        container.querySelectorAll('details').forEach(node => { node.open = opened.includes(node.dataset.appearanceConflict); });
        if (focusId) container.querySelector(`[data-appearance-resolve="${CSS.escape(focusId)}"][data-choice="${CSS.escape(focusChoice)}"]`)?.focus({ preventScroll: true });
        else if (summaryId) container.querySelector(`[data-appearance-conflict="${CSS.escape(summaryId)}"] summary`)?.focus({ preventScroll: true });
      }
    };
    const unsubscribe = service.subscribe(renderSnapshot);
    const lifecycle = new AbortController();
    window.addEventListener('bprea:appearance-session-change', async () => {
      checkingIdentity = true;
      renderSnapshot(service.getState());
      try { await auth.retry(); } catch { /* The Auth service publishes the outcome. */ }
      finally {
        checkingIdentity = false;
        if (!lifecycle.signal.aborted) renderSnapshot(service.getState());
      }
    }, { signal: lifecycle.signal });
    window.addEventListener('pagehide', event => {
      if (!event.persisted) { unsubscribe(); lifecycle.abort(); }
    }, { signal: lifecycle.signal });
  }).catch(() => { appearance.setSource('blocked'); save.textContent = 'Choix temporaire : le service de sauvegarde est indisponible.'; });
  update();
}
