import { getSettingsService } from './settings-service.js';

const seasonLabels = { spring: 'Printemps', summer: 'Été', autumn: 'Automne', winter: 'Hiver' };
const timeLabels = { morning: 'matin', day: 'journée', twilight: 'crépuscule', night: 'nuit' };
const clean = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const describe = value => `${value?.season === 'auto' ? 'Saison automatique' : seasonLabels[value?.season] || 'Saison inconnue'} · ${value?.brightness === 'auto' ? 'Luminosité automatique' : value?.brightness === 'dark' ? 'Sombre' : 'Clair'}`;
const keyOf = value => JSON.stringify([value?.season, value?.brightness]);

export function initAppearance() {
  const appearance = window.BpreaAppearance;
  const toggle = document.getElementById('theme-toggle');
  const open = document.getElementById('appearance-open');
  if (!appearance || !toggle || !open) return;
  // Keep the initial visual choice while the asynchronous identity is unknown.
  // A click in this interval applies temporarily without writing visitor data.
  appearance.setSource('blocked', appearance.getPreferences());

  const dialog = document.createElement('dialog');
  dialog.id = 'appearance-dialog';
  dialog.className = 'appearance-dialog';
  dialog.setAttribute('aria-labelledby', 'appearance-title');
  dialog.setAttribute('aria-describedby', 'appearance-description');
  dialog.innerHTML = `
    <form method="dialog" class="appearance-heading">
      <h2 id="appearance-title">Ton apparence</h2>
      <button class="appearance-close" type="submit" aria-label="Fermer les paramètres d’apparence" autofocus>×</button>
    </form>
    <p id="appearance-description">Choisis la saison et la luminosité qui te conviennent. Ces deux réglages sont indépendants.</p>
    <div class="appearance-fields">
      <label for="appearance-season">Saison
        <select id="appearance-season" aria-describedby="appearance-season-help">
          <option value="auto">Automatique</option>
          <option value="spring">Printemps</option>
          <option value="summer">Été</option>
          <option value="autumn">Automne</option>
          <option value="winter">Hiver</option>
        </select>
      </label>
      <p id="appearance-season-help">En automatique : saisons du calendrier de l’hémisphère nord, à partir des 1er mars, juin, septembre et décembre.</p>
      <label for="appearance-brightness">Luminosité
        <select id="appearance-brightness" aria-describedby="appearance-time-help">
          <option value="auto">Automatique selon l’heure</option>
          <option value="light">Mode clair</option>
          <option value="dark">Mode sombre</option>
        </select>
      </label>
      <p id="appearance-time-help">Heure locale : matin de 6 h à 10 h, journée de 10 h à 18 h, crépuscule de 18 h à 22 h, nuit de 22 h à 6 h. Ce sont des plages conventionnelles.</p>
    </div>
    <p class="appearance-current" id="appearance-current" role="status"></p>
    <p class="appearance-save" id="appearance-save" role="status">Choix de cet appareil · vérification du mode de sauvegarde…</p>
    <div class="appearance-sync-actions"><button type="button" class="btn btn-outline" id="appearance-sync-refresh" hidden>Actualiser l’apparence</button><button type="button" class="btn btn-outline" id="appearance-restore" hidden>Utiliser la version du compte</button><button type="button" class="btn btn-outline" id="appearance-import" hidden>Examiner les choix locaux</button></div><div id="appearance-conflicts"></div><p id="appearance-action-message" role="status"></p>
    <section id="appearance-import-preview" hidden aria-labelledby="appearance-import-title"><h3 id="appearance-import-title">Importer les choix d’apparence</h3><p>Ces choix viennent du mode visiteur de cet appareil. Confirme seulement s’ils t’appartiennent. La source et ses archives restent conservées.</p><p id="appearance-import-values"></p><p id="appearance-import-message" role="status"></p><button type="button" class="btn btn-primary" id="appearance-import-confirm">Confirmer l’import d’apparence</button><button type="button" class="btn btn-outline" id="appearance-import-cancel">Annuler l’import</button></section>`;
  document.body.append(dialog);
  const season = dialog.querySelector('#appearance-season');
  const brightness = dialog.querySelector('#appearance-brightness');
  const save = dialog.querySelector('#appearance-save');
  const find = id => dialog.querySelector(`#${id}`);
  let service, snapshot, source = null, epoch = 0, inFlight = 0, protectedDialog = false, latest = null, preview = null, markup = '';
  const announce = message => { find('appearance-action-message').textContent = message || ''; };
  function available() { find('appearance-restore').hidden = !latest || keyOf(latest) === keyOf(appearance.getPreferences()); }
  function update() {
    const preferences = appearance.getPreferences();
    const state = appearance.getState();
    const dark = state.theme === 'dark';
    if (!dialog.open || !protectedDialog) { season.value = preferences.season; brightness.value = preferences.brightness; }
    toggle.querySelector('.theme-icon').innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${dark ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>' : '<path d="M20.4 15.3A8.5 8.5 0 0 1 8.7 3.6 8.5 8.5 0 1 0 20.4 15.3Z"/>'}</svg>`;
    toggle.querySelector('.theme-label').textContent = dark ? 'Mode clair' : 'Mode sombre';
    toggle.setAttribute('aria-label', dark ? 'Activer le mode clair' : 'Activer le mode sombre');
    dialog.querySelector('#appearance-current').textContent = `${seasonLabels[state.season]} · ${timeLabels[state.time]} · mode ${dark ? 'sombre' : 'clair'}`;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  }
  function change(patch) {
    protectedDialog = dialog.open;
    const saved = appearance.updatePreferences(patch);
    if (appearance.getSource() === 'device') save.textContent = saved ? 'Préférences enregistrées sur cet appareil.' : 'Le stockage local est indisponible. Ce choix reste actif pour cette page seulement.';
    else if (appearance.getSource() === 'blocked') save.textContent = 'Choix temporaire appliqué. Identité à vérifier ; choix non enregistré.';
    available();
  }
  open.addEventListener('click', () => { protectedDialog = false; update(); dialog.showModal(); });
  dialog.addEventListener('close', () => { protectedDialog = false; preview = null; find('appearance-import-preview').hidden = true; if (latest && !inFlight) appearance.applyPreferences(latest); open.focus(); });
  season.addEventListener('change', () => change({ season: season.value }));
  brightness.addEventListener('change', () => change({ brightness: brightness.value }));
  for (const control of [season, brightness]) {
    control.addEventListener('focus', () => { if (dialog.open) protectedDialog = true; });
    control.addEventListener('input', () => { if (dialog.open) protectedDialog = true; });
  }
  toggle.addEventListener('click', () => change({ brightness: appearance.getState().theme === 'dark' ? 'light' : 'dark' }));
  window.addEventListener('bprea:appearance-change', update);
  window.addEventListener('bprea:preferences-change', update);
  async function persist(value) {
    const current = epoch; inFlight++;
    save.textContent = 'Choix temporaire appliqué · enregistrement sur cet appareil…';
    try {
      const result = await service.save('appearance', value);
      if (current !== epoch) return;
      if (result?.error) { save.textContent = `Erreur de stockage : choix temporaire appliqué, non enregistré. ${result.error}`; announce(result.error); }
      else { announce(''); renderStatus(snapshot); }
    } catch { if (current === epoch) save.textContent = 'Erreur de stockage : choix temporaire appliqué, non enregistré.'; }
    finally { if (current === epoch) { inFlight = Math.max(0, inFlight - 1); available(); } }
  }
  function renderStatus(state) {
    if (!state) return;
    const domain = state.sync.domains?.appearance || state.sync;
    const labels = { loading: 'Chargement des choix personnels…', saving: 'Enregistrement sur cet appareil…', local: 'Choix enregistrés sur cet appareil.', pending: 'Choix enregistrés sur cet appareil · synchronisation en attente.', syncing: 'Synchronisation des choix en cours…', synced: 'Choix synchronisés.', offline: 'Hors ligne · choix enregistrés sur cet appareil, synchronisation en attente.', conflict: 'Conflit d’apparence à résoudre.', error: 'Erreur de synchronisation. Choix conservés sur cet appareil.', 'storage-error': 'Erreur de stockage. Le choix temporaire n’est pas enregistré.', session: 'Identité à vérifier. Les choix personnels sont masqués.' };
    save.textContent = state.mode === 'visitor' ? 'Choix du mode visiteur conservés sur cet appareil.'
      : state.mode === 'personal' && domain.state === 'synced' && !state.view.appearance ? 'Aucun choix d’apparence enregistré sur le compte. Rendu provisoire de cet appareil.' : labels[domain.state] || labels.session;
  }
  find('appearance-sync-refresh').addEventListener('click', async () => { try { await service.retry(); } catch { announce('Actualisation indisponible. Les choix enregistrés restent conservés.'); } });
  find('appearance-restore').addEventListener('click', () => { if (latest) { protectedDialog = false; appearance.applyPreferences(latest); available(); } });
  find('appearance-import').addEventListener('click', async () => {
    const current = epoch;
    try {
      const value = await service.previewImport('appearance');
      if (epoch !== current) return;
      preview = value;
      find('appearance-import-values').textContent = value.value ? describe(value.value) : 'Aucun choix local valide.';
      find('appearance-import-message').textContent = value.error || (value.divergent ? 'Le compte possède des choix différents. Confirmer les remplacera volontairement.' : 'Aucun envoi avant confirmation.');
      find('appearance-import-confirm').disabled = !!value.error || value.available === false;
      find('appearance-import-preview').hidden = false;
      find('appearance-import-cancel').focus({ preventScroll: true });
    } catch { if (current === epoch) announce('Impossible de lire les choix locaux. La source reste conservée.'); }
  });
  find('appearance-import-cancel').addEventListener('click', () => { preview = null; find('appearance-import-preview').hidden = true; find('appearance-import').focus(); });
  find('appearance-import-confirm').addEventListener('click', async () => {
    if (!preview) return;
    const current = epoch; find('appearance-import-confirm').disabled = true;
    try {
      const result = await service.confirmImport(preview);
      if (epoch !== current) return;
      if (result?.error) { find('appearance-import-message').textContent = result.error; return; }
      preview = null; find('appearance-import-preview').hidden = true;
      announce(result?.replayed ? 'Cet import était déjà accepté. Aucune nouvelle opération.' : 'Import enregistré. La source visiteur et ses archives restent conservées.');
      find('appearance-import').focus();
    } catch { if (epoch === current) find('appearance-import-message').textContent = 'Import non enregistré. Réexamine les choix locaux pour réessayer.'; }
  });
  dialog.addEventListener('click', async event => {
    const button = event.target.closest('[data-appearance-resolve]');
    if (!button) return;
    const current = epoch; button.disabled = true;
    try {
      const result = await service.resolve(button.dataset.appearanceResolve, button.dataset.choice);
      if (current === epoch) { announce(result?.error || 'Résolution enregistrée ; ancienne intention archivée.'); if (!result?.error) find('appearance-sync-refresh').focus({ preventScroll: true }); }
    } finally { if (button.isConnected) button.disabled = false; }
  });
  getSettingsService().then(value => {
    service = value;
    const unsubscribe = service.subscribe(state => {
      snapshot = state;
      const usable = state.mode === 'personal' && state.sync.state !== 'session';
      const nextSource = `${state.mode}:${state.scope}:${state.sync.state === 'session'}`;
      if (source !== nextSource) {
        const changed = source !== null;
        source = nextSource; epoch++; inFlight = 0; protectedDialog = false; latest = null; preview = null;
        find('appearance-import-preview').hidden = true; announce('');
        if (changed && dialog.open) dialog.close();
        const personalReady = usable && !state.view.error;
        appearance.setSource(personalReady ? 'personal' : state.mode === 'visitor' ? 'device' : 'blocked',
          personalReady ? state.view.appearance : appearance.getDevicePreferences(), personalReady ? persist : null);
      }
      if (usable && !state.view.error && appearance.getSource() !== 'personal') appearance.setSource('personal', state.view.appearance, persist);
      latest = usable ? state.view.appearance : null;
      if (latest && !inFlight && !(dialog.open && protectedDialog) && keyOf(latest) !== keyOf(appearance.getPreferences())) appearance.applyPreferences(latest);
      renderStatus(state); available();
      find('appearance-sync-refresh').hidden = state.mode === 'visitor';
      find('appearance-import').hidden = !usable;
      const nextMarkup = (state.sync.conflicts || []).filter(item => item.domain === 'appearance').map(item => `<details data-appearance-conflict="${clean(item.id)}"><summary>${item.resolved ? 'Conflit d’apparence archivé' : 'Conflit d’apparence à résoudre'}</summary><p>Choix de cet appareil : ${clean(describe(item.local?.value || item.local))}</p><p>Version du compte : ${clean(describe(item.remote?.value || item.remote))}</p>${item.resolved ? '' : `<button type="button" class="btn btn-outline" data-appearance-resolve="${clean(item.id)}" data-choice="remote">Garder la version du compte</button><button type="button" class="btn btn-outline" data-appearance-resolve="${clean(item.id)}" data-choice="local">Utiliser mon choix enregistré sur cet appareil</button>`}</details>`).join('');
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
    });
    window.addEventListener('pagehide', unsubscribe, { once: true });
  }).catch(() => { appearance.setSource('blocked', appearance.getDevicePreferences()); save.textContent = 'Choix temporaire : le service de sauvegarde est indisponible.'; });
  update();
  document.documentElement.dataset.appearanceReady = 'true';
}
