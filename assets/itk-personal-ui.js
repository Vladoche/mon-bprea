import { getSettingsService } from './settings-service.js';
import { crops } from './content.js';

const defaults = { crop: 'tomate', variety: 'Marmande', cover: 'serre', area: '100', month: '5', year: '2028', soil: 'limoneux', water: 'standard' };
const fields = Object.keys(defaults);
const fingerprint = value => JSON.stringify(fields.map(key => value?.[key]));
const clean = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export function itkDisplayParameters(saved = {}) {
  const source = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  const crop = Object.hasOwn(crops, source.crop) ? source.crop : defaults.crop;
  return { crop, variety: crops[crop].varieties.includes(source.variety) ? source.variety : crops[crop].varieties[0],
    cover: ['serre', 'plein'].includes(source.cover) ? source.cover : defaults.cover,
    area: typeof source.area === 'string' && Number.isFinite(Number(source.area)) && Number(source.area) >= 1 && Number(source.area) <= 100000 ? source.area : defaults.area,
    month: /^([1-9]|1[0-2])$/.test(source.month) ? String(source.month) : defaults.month,
    year: /^(202[6-9]|203[0-3])$/.test(source.year) ? String(source.year) : defaults.year,
    soil: ['leger', 'limoneux', 'lourd'].includes(source.soil) ? source.soil : defaults.soil,
    water: ['standard', 'limitee'].includes(source.water) ? source.water : defaults.water };
}
const labels = {
  visitor: 'Mode visiteur · paramètres enregistrés sur cet appareil uniquement.', loading: 'Chargement des paramètres personnels…',
  saving: 'Enregistrement des paramètres sur cet appareil…', local: 'Paramètres enregistrés sur cet appareil.',
  pending: 'Paramètres enregistrés sur cet appareil · synchronisation en attente.', syncing: 'Synchronisation des paramètres en cours…',
  synced: 'Paramètres synchronisés.', offline: 'Hors ligne · paramètres conservés sur cet appareil.',
  conflict: 'Conflit de paramètres ITK à résoudre.', error: 'Erreur de synchronisation des paramètres.',
  'storage-error': 'Erreur de sauvegarde : les paramètres ne sont pas enregistrés.', session: 'Connexion au compte à vérifier.'
};

export function describeItk(value) {
  if (!value) return 'Aucun paramètre enregistré.';
  return `${crops[value.crop]?.name || value.crop} · ${value.variety} · ${value.cover === 'serre' ? 'Sous abri' : 'Plein champ'} · ${value.area} m² · ${value.month}/${value.year} · ${({ leger: 'Sol léger', limoneux: 'Sol limoneux', lourd: 'Sol lourd' })[value.soil]} · ${value.water === 'limitee' ? 'Eau limitée' : 'Irrigation à dimensionner'}`;
}

/** Keep the form and calculated output independent from background reconciliation. */
export function bindItkPersonal(form, root, { servicePromise = getSettingsService(), applyValues, clearResult } = {}) {
  root.innerHTML = `<p id="itk-sync-status" role="status" aria-live="polite"></p><p id="itk-sync-detail"></p><div class="itk-sync-actions"><button type="button" class="btn btn-outline" id="itk-refresh">Actualiser les paramètres</button><button type="button" class="btn btn-outline" id="itk-restore" hidden>Restaurer les paramètres du compte</button><button type="button" class="btn btn-outline" id="itk-import" hidden>Examiner les paramètres locaux</button></div><div id="itk-conflicts"></div><p id="itk-action-message" role="status"></p><dialog class="itk-import-dialog" aria-labelledby="itk-import-title"><h2 id="itk-import-title">Importer les paramètres ITK</h2><p>Ces paramètres proviennent du mode visiteur de cet appareil. Vérifie qu’ils t’appartiennent. La confirmation remplace volontairement les derniers paramètres du compte après vérification de sa version.</p><p id="itk-import-preview"></p><p id="itk-import-message" role="status"></p><button type="button" class="btn btn-primary" id="itk-import-confirm">Confirmer l’import ITK</button><button type="button" class="btn btn-outline" id="itk-import-cancel">Annuler</button></dialog>`;
  const find = id => root.querySelector(`#${id}`);
  const dialog = root.querySelector('dialog');
  let service, snapshot, source = null, epoch = 0, dirty = false, latest = null, loaded = '', preview = null, conflictMarkup = '', writing = 0;
  const raw = () => Object.fromEntries(new FormData(form));
  const announce = message => { find('itk-action-message').textContent = message || ''; };
  const apply = value => { applyValues(value || defaults); loaded = fingerprint(raw()); dirty = false; find('itk-restore').hidden = true; };
  function showAvailable() {
    find('itk-restore').hidden = snapshot?.mode !== 'personal' || !dirty || !latest || fingerprint(latest) === fingerprint(raw());
    if (dirty) find('itk-sync-detail').textContent = `${latest && fingerprint(latest) !== loaded ? 'Version du compte disponible. ' : ''}Formulaire modifié, non enregistré. La synchronisation préserve ta saisie et le calendrier déjà affiché.`;
  }
  form.addEventListener('input', () => { dirty = fingerprint(raw()) !== loaded; showAvailable(); });
  form.addEventListener('change', () => { dirty = fingerprint(raw()) !== loaded; showAvailable(); });
  find('itk-restore').addEventListener('click', () => { if (latest) { apply(latest); announce('Paramètres du compte chargés. Génère l’itinéraire pour recalculer les résultats.'); } });
  const close = () => { if (dialog.open) dialog.close(); preview = null; find('itk-import').focus({ preventScroll: true }); };
  find('itk-import-cancel').addEventListener('click', close);
  dialog.addEventListener('cancel', () => { preview = null; });
  find('itk-refresh').addEventListener('click', async () => {
    const current = epoch;
    try { await service?.retry(); } catch { if (epoch === current) announce('Actualisation indisponible. Les paramètres enregistrés sont conservés.'); }
  });
  find('itk-import').addEventListener('click', async () => {
    const current = epoch;
    try {
      const value = await service.previewImport('itk');
      if (epoch !== current) return;
      preview = value;
      find('itk-import-preview').textContent = value.value ? describeItk(value.value) : value.parameters ? describeItk(value.parameters) : 'Aucun paramètre local valide.';
      find('itk-import-message').textContent = value.error || (value.divergent ? 'Le compte possède des paramètres différents. Confirme uniquement si tu souhaites les remplacer.' : 'Aucun envoi avant confirmation. La source visiteur reste conservée.');
      find('itk-import-confirm').disabled = !!value.error || value.available === false;
      dialog.showModal();
    } catch { if (epoch === current) announce('Impossible d’examiner les paramètres locaux. Leur source est conservée.'); }
  });
  find('itk-import-confirm').addEventListener('click', async () => {
    if (!preview) return;
    const current = epoch;
    find('itk-import-confirm').disabled = true;
    try {
      const result = await service.confirmImport(preview);
      if (epoch !== current) return;
      if (result?.error) { find('itk-import-message').textContent = result.error; return; }
      close(); announce(result?.replayed ? 'Cet import était déjà accepté. Aucune nouvelle opération.' : 'Import enregistré sur cet appareil. La source visiteur est conservée.');
    } catch { if (epoch === current) find('itk-import-message').textContent = 'Import non enregistré. Réexamine la source pour réessayer.'; }
  });
  root.addEventListener('click', async event => {
    const button = event.target.closest('[data-itk-resolve]');
    if (!button) return;
    const current = epoch; button.disabled = true;
    try {
      const result = await service.resolve(button.dataset.itkResolve, button.dataset.choice);
      if (epoch === current) { announce(result?.error || 'Résolution enregistrée ; l’ancienne intention reste archivée.'); if (!result?.error) find('itk-refresh').focus({ preventScroll: true }); }
    } finally { if (button.isConnected) button.disabled = false; }
  });
  const ready = servicePromise.then(value => {
    service = value;
    const unsubscribe = service.subscribe(state => {
      snapshot = state;
      const next = `${state.mode}:${state.scope}:${state.sync.state === 'session'}`;
      if (source !== next) {
        if (source !== null) { epoch++; apply(defaults); clearResult(); announce(''); }
        source = next; latest = null; preview = null; conflictMarkup = '';
        if (dialog.open) dialog.close();
      }
      const usable = state.mode !== 'blocked' && state.sync.state !== 'session';
      latest = usable ? state.view.itk : null;
      if (state.mode === 'visitor' && !latest) {
        try { latest = itkDisplayParameters(JSON.parse(localStorage.getItem('bprea-demo-itk-v1'))); }
        catch { latest = itkDisplayParameters(); }
      }
      if (!dirty && !writing && latest && fingerprint(latest) !== loaded) apply(latest);
      const domain = state.sync.domains?.itk || state.sync;
      find('itk-sync-status').textContent = state.mode === 'personal' && domain.state === 'synced' && !latest
        ? 'Aucun paramètre ITK enregistré sur le compte.' : labels[state.mode === 'visitor' ? 'visitor' : domain.state] || labels.session;
      find('itk-sync-detail').textContent = state.view.error || domain.error || state.sync.error || (state.mode === 'personal' ? 'Seuls les huit paramètres sont sauvegardés. Le calendrier et les exports sont recalculés ici. Le cache personnel reste sur cet appareil après déconnexion et n’est pas chiffré.' : 'Le calendrier et les exports sont calculés sur cet appareil.');
      find('itk-refresh').hidden = state.mode === 'visitor';
      find('itk-import').hidden = !usable || state.mode !== 'personal';
      const conflicts = (state.sync.conflicts || []).filter(item => item.domain === 'itk');
      const markup = conflicts.map(item => `<details data-itk-conflict="${clean(item.id)}"><summary>${item.resolved ? 'Conflit ITK archivé' : 'Conflit ITK à résoudre'}</summary><p>Choix de cet appareil : ${clean(describeItk(item.local?.value || item.local))}</p><p>Version du compte : ${clean(describeItk(item.remote?.parameters || item.remote?.value || item.remote))}</p>${item.resolved ? '' : `<button type="button" class="btn btn-outline" data-itk-resolve="${clean(item.id)}" data-choice="remote">Garder la version du compte</button><button type="button" class="btn btn-outline" data-itk-resolve="${clean(item.id)}" data-choice="local">Utiliser mon choix enregistré sur cet appareil</button>`}</details>`).join('');
      if (markup !== conflictMarkup) {
        const container = find('itk-conflicts');
        const opened = [...container.querySelectorAll('details[open]')].map(node => node.dataset.itkConflict);
        const focused = container.contains(document.activeElement) ? document.activeElement : null;
        const id = focused?.dataset.itkResolve, choice = focused?.dataset.choice;
        const summaryId = focused?.tagName === 'SUMMARY' ? focused.closest('details')?.dataset.itkConflict : null;
        container.innerHTML = markup; conflictMarkup = markup;
        container.querySelectorAll('details').forEach(node => { node.open = opened.includes(node.dataset.itkConflict); });
        if (id) container.querySelector(`[data-itk-resolve="${CSS.escape(id)}"][data-choice="${CSS.escape(choice)}"]`)?.focus({ preventScroll: true });
        else if (summaryId) container.querySelector(`[data-itk-conflict="${CSS.escape(summaryId)}"] summary`)?.focus({ preventScroll: true });
      }
      showAvailable();
    });
    window.addEventListener('pagehide', unsubscribe, { once: true });
    return service;
  }).catch(() => { find('itk-sync-status').textContent = labels['storage-error']; announce('La source des paramètres est indisponible. Le générateur reste utilisable sans sauvegarde.'); return null; });
  return {
    async save(parameters) {
      const current = epoch; writing++;
      announce('');
      try {
        const activeService = await ready;
        if (!activeService || current !== epoch) return;
        const result = await activeService.save('itk', parameters);
        if (current !== epoch) return;
        if (result?.error) { announce(`Calendrier généré, paramètres non sauvegardés : ${result.error}`); return; }
        loaded = fingerprint(parameters); dirty = fingerprint(raw()) !== loaded;
        announce('Paramètres enregistrés sur cet appareil. Le suivi confirme séparément leur synchronisation.');
        showAvailable();
      } catch { if (current === epoch) announce('Calendrier généré, mais les paramètres ne sont pas sauvegardés. Réessaie la génération pour les enregistrer.'); }
      finally { writing--; }
    }
  };
}
