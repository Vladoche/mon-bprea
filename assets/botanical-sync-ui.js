const clean = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const action = 'btn btn-surface';
const labels = {
  visitor: 'Historique visiteur local', loading: 'Chargement de l’historique du compte…', saving: 'Enregistrement sur cet appareil…',
  local: 'Historique du compte · enregistré sur cet appareil', pending: 'Enregistré sur cet appareil · synchronisation en attente',
  syncing: 'Synchronisation en cours', synced: 'Historique du compte · synchronisé', offline: 'Mode hors ligne · historique du compte conservé sur cet appareil',
  session: 'Connexion au compte à vérifier', conflict: 'Conflit botanique à examiner', error: 'Erreur de synchronisation',
  'storage-error': 'Erreur de sauvegarde sur cet appareil',
};
const notableStates = new Set(['offline', 'session', 'conflict', 'error', 'storage-error']);

/** Status updates stay outside the game and the modal: no question, timer or
 * selected choice is recreated by an ordinary background notification. */
export function initBotanicalSyncPanel(root, service, { signal } = {}) {
  root.innerHTML = `<section class="bot-panel bot-sync-panel" aria-labelledby="bot-storage-title">
    <h2 id="bot-storage-title">Sauvegarde et synchronisation</h2>
    <p id="botanical-sync-status"></p>
    <span id="botanical-sync-alert" class="sr-only" role="status"></span>
    <p id="botanical-sync-detail"></p>
    <div class="bot-actions" id="botanical-sync-actions">
      <button class="${action}" id="botanical-sync-refresh" type="button">Actualiser l’historique</button>
      <button class="${action}" id="botanical-sync-import" type="button">Importer l’historique de cet appareil</button>
    </div>
    <div id="botanical-sync-archives"></div>
    <p id="botanical-sync-message" role="status"></p>
    <details id="botanical-cache-info">
      <summary>À propos de ce cache personnel</summary>
      <p>Le cache de ce compte est conservé après déconnexion et n’est pas chiffré. Sur un appareil partagé, utilise un profil de navigateur privé. La synchronisation ne reprend pas une partie en cours.</p>
    </details>
  </section>
  <dialog class="bot-import-dialog" aria-labelledby="botanical-import-title" aria-describedby="botanical-import-warning">
    <div class="bot-import-body" role="region" aria-label="Aperçu de l’historique" tabindex="0">
      <h2 id="botanical-import-title">Importer l’historique botanique local</h2>
      <p id="botanical-import-warning">Les données de cet appareil peuvent appartenir à une autre personne. Confirme uniquement si cet historique est le tien.</p>
      <div id="botanical-import-preview"></div>
      <p id="botanical-import-message" role="status"></p>
      <p>La sauvegarde visiteur originale et les données non transférables restent intactes.</p>
    </div>
    <div class="bot-import-actions"><div class="bot-actions">
      <button class="${action}" id="botanical-import-cancel" type="button" autofocus>Annuler</button>
      <button class="${action} btn-surface--accent" id="botanical-import-confirm" type="button">Confirmer l’import</button>
    </div></div>
  </dialog>`;
  const select = id => root.querySelector(`#${id}`);
  const panel = root.querySelector('.bot-sync-panel');
  const dialog = root.querySelector('dialog');
  const refresh = select('botanical-sync-refresh'), startImport = select('botanical-sync-import'), confirm = select('botanical-import-confirm');
  let snapshot = service.getState(), preview = null, markup = '', refreshing = false;
  let source = `${snapshot.mode}:${snapshot.scope}`;
  let identityVersion = 0;
  const currentSource = () => `${snapshot.mode}:${snapshot.scope}`;
  const writeText = (id, message) => {
    const node = select(id);
    if (node.textContent !== message) node.textContent = message;
  };
  const announce = message => writeText('botanical-sync-message', message || '');
  const unsubscribe = service.subscribe(state => {
    snapshot = state;
    const visitor = state.mode === 'visitor', usable = state.mode === 'personal' && !state.view.error && state.sync.state !== 'session';
    if (source !== currentSource() || !usable) {
      source = currentSource(); preview = null;
      identityVersion++;
      if (dialog.open) dialog.close();
      select('botanical-import-preview').replaceChildren();
      writeText('botanical-import-message', '');
      startImport.disabled = false;
      announce('');
    }
    const count = state.sync.pending || 0;
    const syncState = visitor ? 'visitor' : state.sync.state;
    const status = labels[syncState] || labels.session;
    panel.dataset.syncState = syncState;
    writeText('botanical-sync-status', `${status}${count ? ` · ${count} opération${count > 1 ? 's' : ''} en attente` : ''}`);
    writeText('botanical-sync-alert', notableStates.has(syncState) ? status : '');
    writeText('botanical-sync-detail', state.view.error || state.sync.error || (visitor ? 'Résultats conservés dans ce navigateur. L’import vers un compte demande ta confirmation.' : 'La mention « synchronisé » confirme la sauvegarde distante.'));
    refresh.hidden = visitor; refresh.disabled = refreshing;
    startImport.hidden = !usable; select('botanical-cache-info').hidden = !usable;
    select('botanical-sync-actions').hidden = visitor;
    const nextMarkup = (state.sync.conflicts || []).map(conflict => `<details class="botanical-conflict" data-conflict="${clean(conflict.id)}"><summary>${conflict.resolved ? 'Conflit conservé en archive' : 'Résultat botanique en conflit'}</summary><p>Deux versions de cette session ou de cette réponse sont incompatibles. La version du compte figure dans l’historique. L’intention locale est conservée en archive.</p>${conflict.resolved ? '' : `<button class="${action}" type="button" data-botanical-resolve="${clean(conflict.id)}">Garder la version du compte</button>`}</details>`).join('') + (state.sync.operations?.length ? '<p>Des enregistrements refusés restent conservés sur cet appareil. Examine les conflits ou contacte la personne qui gère le site.</p>' : '') + (state.sync.imports?.length ? '<p>Import volontaire conservé. Les envois restants figurent dans le suivi ci-dessus.</p>' : '');
    const archiveMarkup = (state.sync.importArchives || []).map(item => `<details class="botanical-import-archive"><summary>Sauvegarde locale non transférée</summary><p>${clean(item.message)}</p><p>Ce refus reste enregistré dans le cache local du compte.</p></details>`).join('');
    const fullMarkup = nextMarkup + archiveMarkup;
    if (markup !== fullMarkup) {
      const archives = select('botanical-sync-archives');
      const opened = new Set([...archives.querySelectorAll('details[open]')].map(item => item.dataset.conflict));
      const focusedId = archives.contains(document.activeElement) ? document.activeElement.dataset.botanicalResolve : null;
      const focusedSummary = document.activeElement?.tagName === 'SUMMARY' && archives.contains(document.activeElement) ? document.activeElement.closest('[data-conflict]')?.dataset.conflict : null;
      archives.innerHTML = fullMarkup; markup = fullMarkup;
      archives.querySelectorAll('details').forEach(item => { item.open = opened.has(item.dataset.conflict); });
      if (focusedId) archives.querySelector(`[data-botanical-resolve="${CSS.escape(focusedId)}"]`)?.focus({ preventScroll: true });
      else if (focusedSummary) archives.querySelector(`[data-conflict="${CSS.escape(focusedSummary)}"] > summary`)?.focus({ preventScroll: true });
    }
  });
  refresh.addEventListener('click', async () => {
    const current = identityVersion; refreshing = true; refresh.disabled = true; announce('Actualisation en cours…');
    try { await service.retry(); if (current === identityVersion) announce(''); }
    catch { if (current === identityVersion) announce('L’actualisation reste indisponible. Les résultats enregistrés sont conservés.'); }
    finally { refreshing = false; refresh.disabled = false; }
  }, { signal });
  startImport.addEventListener('click', async () => {
    const current = identityVersion; startImport.disabled = true;
    try {
      const value = await service.previewImport();
      if (current !== identityVersion || signal?.aborted) return;
      preview = value; const summary = value.summary || {};
      select('botanical-import-preview').innerHTML = `<dl class="bot-import-summary">
        <div><dt>Sessions exploitables</dt><dd>${summary.sessions || 0}</dd></div>
        <div><dt>Réponses exploitables</dt><dd>${summary.answers || 0}</dd></div>
      </dl>${value.warnings?.length ? `<h3>Données conservées hors transfert</h3><ul>${value.warnings.map(item => `<li>${clean(typeof item === 'string' ? item : item.message || item.reason || 'Donnée non transférable')}</li>`).join('')}</ul>` : ''}`;
      writeText('botanical-import-message', value.error || (value.available ? '' : 'Aucun historique exploitable n’est disponible.'));
      confirm.disabled = !!value.error || !value.available;
      dialog.showModal();
    } catch { if (current === identityVersion) announce('L’historique local ne peut pas être lu. Sa sauvegarde reste intacte.'); }
    finally { if (current === identityVersion) startImport.disabled = false; }
  }, { signal });
  const close = () => { dialog.close(); preview = null; startImport.focus({ preventScroll: true }); };
  select('botanical-import-cancel').addEventListener('click', close, { signal });
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); }, { signal });
  confirm.addEventListener('click', async () => {
    if (!preview) return;
    const requested = preview; confirm.disabled = true;
    try {
      const result = await service.confirmImport(requested);
      if (requested !== preview) return;
      if (result.error) { select('botanical-import-message').textContent = result.error; confirm.disabled = false; return; }
      close(); announce(result.replayed ? 'Cet import est déjà conservé, sans nouvelle tentative.' : 'Import enregistré sur cet appareil. La sauvegarde visiteur reste intacte ; le suivi indique les envois restants.');
    } catch { if (requested === preview) { select('botanical-import-message').textContent = 'L’import n’a pas pu être enregistré. La source reste intacte.'; confirm.disabled = false; } }
  }, { signal });
  root.addEventListener('click', async event => {
    const button = event.target.closest('[data-botanical-resolve]');
    if (!button) return;
    const current = identityVersion; button.disabled = true;
    try {
      const result = await service.resolveConflict(button.dataset.botanicalResolve, 'remote');
      if (current === identityVersion) { announce(result?.error || 'La version du compte est conservée. L’intention précédente reste archivée.'); if (!result?.error) refresh.focus({ preventScroll: true }); }
    } finally { if (button.isConnected) button.disabled = false; }
  }, { signal });
  signal?.addEventListener('abort', () => { unsubscribe(); if (dialog.open) dialog.close(); }, { once: true });
  return unsubscribe;
}
