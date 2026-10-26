const clean = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const labels = {
  visitor: 'Historique visiteur local', loading: 'Chargement de l’historique du compte…', saving: 'Enregistrement sur cet appareil…',
  local: 'Historique du compte · enregistré sur cet appareil', pending: 'Enregistré sur cet appareil · synchronisation en attente',
  syncing: 'Synchronisation en cours', synced: 'Historique du compte · synchronisé', offline: 'Mode hors ligne · historique du compte conservé sur cet appareil',
  session: 'Connexion au compte à vérifier', conflict: 'Conflit botanique à examiner', error: 'Erreur de synchronisation',
  'storage-error': 'Erreur de sauvegarde sur cet appareil',
};

/** Status updates stay outside the game and the modal: no question, timer or
 * selected choice is recreated by an ordinary background notification. */
export function initBotanicalSyncPanel(root, service, { signal } = {}) {
  root.innerHTML = `<div class="bot-sync-panel"><p id="botanical-sync-status" role="status" aria-live="polite" aria-atomic="true"></p><p id="botanical-sync-detail"></p><div class="bot-actions"><button class="btn btn-outline" id="botanical-sync-refresh" type="button">Actualiser l’historique</button><button class="btn btn-outline" id="botanical-sync-import" type="button">Importer l’historique de cet appareil</button></div><div id="botanical-sync-archives"></div><p id="botanical-sync-message" role="status" aria-live="polite"></p><details id="botanical-cache-info"><summary>À propos de ce cache personnel</summary><p>Le cache de ce compte est conservé après déconnexion et n’est pas chiffré. Sur un appareil partagé, utilise un profil de navigateur privé. La synchronisation ne reprend pas une partie en cours.</p></details></div><dialog class="bot-import-dialog" aria-labelledby="botanical-import-title"><h2 id="botanical-import-title">Importer l’historique botanique local</h2><p>Les données de cet appareil peuvent appartenir à une autre personne. Confirme uniquement si cet historique est le tien.</p><div id="botanical-import-preview"></div><p id="botanical-import-message" role="status" aria-live="polite"></p><div class="bot-actions"><button class="btn btn-primary" id="botanical-import-confirm" type="button">Confirmer l’import</button><button class="btn btn-outline" id="botanical-import-cancel" type="button">Annuler</button></div><p>La sauvegarde visiteur originale et les données non transférables restent intactes.</p></dialog>`;
  const select = id => root.querySelector(`#${id}`);
  const dialog = root.querySelector('dialog');
  const refresh = select('botanical-sync-refresh'), startImport = select('botanical-sync-import'), confirm = select('botanical-import-confirm');
  let snapshot = service.getState(), preview = null, markup = '', refreshing = false;
  let source = `${snapshot.mode}:${snapshot.scope}`;
  const currentSource = () => `${snapshot.mode}:${snapshot.scope}`;
  const announce = message => { select('botanical-sync-message').textContent = message || ''; };
  const unsubscribe = service.subscribe(state => {
    snapshot = state;
    if (source !== currentSource() || state.mode !== 'personal' || state.sync.state === 'session') {
      source = currentSource(); preview = null;
      if (dialog.open) dialog.close();
      announce('');
    }
    const visitor = state.mode === 'visitor', usable = state.mode === 'personal' && !state.view.error && state.sync.state !== 'session';
    const count = state.sync.pending || 0;
    select('botanical-sync-status').textContent = `${labels[visitor ? 'visitor' : state.sync.state] || labels.session}${count ? ` · ${count} opération${count > 1 ? 's' : ''} en attente` : ''}`;
    select('botanical-sync-detail').textContent = state.view.error || state.sync.error || (visitor ? 'Résultats conservés dans ce navigateur. Aucun transfert automatique vers un compte.' : 'Une sauvegarde locale peut attendre son envoi. Seule la mention « synchronisé » confirme la sauvegarde distante.');
    refresh.hidden = visitor; refresh.disabled = refreshing;
    startImport.hidden = !usable; select('botanical-cache-info').hidden = !usable;
    const nextMarkup = (state.sync.conflicts || []).map(conflict => `<details class="botanical-conflict" data-conflict="${clean(conflict.id)}"><summary>${conflict.resolved ? 'Conflit conservé en archive' : 'Résultat botanique en conflit'}</summary><p>Deux versions de cette session ou de cette réponse sont incompatibles. La version du compte est conservée dans l’historique ; l’intention locale reste archivée sans créer une nouvelle tentative.</p>${conflict.resolved ? '' : `<button class="btn btn-outline" type="button" data-botanical-resolve="${clean(conflict.id)}">Garder la version du compte</button>`}</details>`).join('') + (state.sync.operations?.length ? '<p>Des enregistrements refusés restent conservés sur cet appareil. Examine les conflits ou contacte la personne qui gère le site.</p>' : '') + (state.sync.imports?.length ? '<p>Import volontaire conservé. Les envois restants figurent dans le suivi ci-dessus.</p>' : '');
    const archiveMarkup = (state.sync.importArchives || []).map(item => `<details class="botanical-import-archive"><summary>Sauvegarde locale non transférée</summary><p>${clean(item.message)}</p><p>La copie d’origine et son instantané restent conservés sur cet appareil.</p></details>`).join('');
    const fullMarkup = nextMarkup + archiveMarkup;
    if (markup !== fullMarkup) {
      const archives = select('botanical-sync-archives');
      const opened = new Set([...archives.querySelectorAll('details[open]')].map(item => item.dataset.conflict));
      const focusedId = archives.contains(document.activeElement) ? document.activeElement.dataset.botanicalResolve : null;
      archives.innerHTML = fullMarkup; markup = fullMarkup;
      archives.querySelectorAll('details').forEach(item => { item.open = opened.has(item.dataset.conflict); });
      if (focusedId) archives.querySelector(`[data-botanical-resolve="${CSS.escape(focusedId)}"]`)?.focus({ preventScroll: true });
    }
  });
  refresh.addEventListener('click', async () => {
    const current = currentSource(); refreshing = true; refresh.disabled = true; announce('Actualisation en cours…');
    try { await service.retry(); if (current === currentSource()) announce(''); }
    catch { if (current === currentSource()) announce('L’actualisation reste indisponible. Les résultats enregistrés sont conservés.'); }
    finally { refreshing = false; refresh.disabled = false; }
  }, { signal });
  startImport.addEventListener('click', async () => {
    const current = currentSource(); startImport.disabled = true;
    try {
      const value = await service.previewImport();
      if (current !== currentSource() || snapshot.mode !== 'personal') return;
      preview = value; const summary = value.summary || {};
      select('botanical-import-preview').innerHTML = `<dl class="bot-import-summary"><div><dt>Sessions exploitables</dt><dd>${summary.sessions || 0}</dd></div><div><dt>Réponses exploitables</dt><dd>${summary.answers || 0}</dd></div></dl>${value.warnings?.length ? `<p>Données conservées hors transfert :</p><ul>${value.warnings.map(item => `<li>${clean(typeof item === 'string' ? item : item.message || item.reason || 'Donnée non transférable')}</li>`).join('')}</ul>` : ''}`;
      select('botanical-import-message').textContent = value.error || (value.available ? 'Aucune opération personnelle n’est créée avant ta confirmation.' : 'Aucun historique exploitable n’est disponible.');
      confirm.disabled = !!value.error || !value.available;
      dialog.showModal();
    } catch { announce('L’historique local ne peut pas être lu. Sa sauvegarde reste intacte.'); }
    finally { startImport.disabled = false; }
  }, { signal });
  const close = () => { dialog.close(); preview = null; startImport.focus({ preventScroll: true }); };
  select('botanical-import-cancel').addEventListener('click', close, { signal });
  dialog.addEventListener('cancel', () => { preview = null; }, { signal });
  confirm.addEventListener('click', async () => {
    if (!preview) return;
    const current = currentSource(); confirm.disabled = true;
    try {
      const result = await service.confirmImport(preview);
      if (current !== currentSource()) return;
      if (result.error) { select('botanical-import-message').textContent = result.error; confirm.disabled = false; return; }
      close(); announce(result.replayed ? 'Cet import est déjà conservé, sans nouvelle tentative.' : 'Import enregistré sur cet appareil. La sauvegarde visiteur reste intacte ; le suivi indique les envois restants.');
    } catch { if (current === currentSource()) { select('botanical-import-message').textContent = 'L’import n’a pas pu être enregistré. La source reste intacte.'; confirm.disabled = false; } }
  }, { signal });
  root.addEventListener('click', async event => {
    const button = event.target.closest('[data-botanical-resolve]');
    if (!button) return;
    const current = currentSource(); button.disabled = true;
    try {
      const result = await service.resolveConflict(button.dataset.botanicalResolve, 'remote');
      if (current === currentSource()) { announce(result?.error || 'La version du compte est conservée. L’intention précédente reste archivée.'); if (!result?.error) refresh.focus({ preventScroll: true }); }
    } finally { if (button.isConnected) button.disabled = false; }
  }, { signal });
  signal?.addEventListener('abort', () => { unsubscribe(); if (dialog.open) dialog.close(); }, { once: true });
  return unsubscribe;
}
