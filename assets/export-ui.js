import { getAuthService } from './auth-service.js';
import { getSupabaseClient } from './supabase-client.js';
import { createExportService } from './export-service.js';
import { serializeExport } from './export-model.js';

const labels = { idle: 'La préparation n’a pas commencé.', verifying: 'Vérification du compte…', reading: 'Récupération des données…', validating: 'Validation de la copie et de l’identité…',
  ready: 'Copie prête : couverture et exclusions ci-dessous. Les données ont été relues ; elles peuvent évoluer pendant la préparation de la copie.', downloaded: 'Téléchargement déclenché. Protège la copie enregistrée sur cet appareil.',
  incomplete: 'Export incomplet : aucun fichier disponible. Une source n’a pas pu être lue ou stabilisée. Réessaie.', identity: 'Reconnexion nécessaire : la préparation personnelle a été invalidée.', cancelled: 'Préparation annulée. Aucun fichier personnel disponible.' };
const sourceLabels = { profiles: 'Profil', drill_series: 'Séries Drill', drill_answers: 'Premières réponses Drill', drill_training_attempts: 'Entraînements Drill', course_states: 'États de cours', quiz_attempts: 'Tentatives QCM', botanical_sessions: 'Sessions botaniques', botanical_answers: 'Réponses botaniques', itk_settings: 'Paramètres ITK', appearance_preferences: 'Choix d’apparence',
  'mon-bprea-drill-personal-v1': 'Cache Drill de ce compte', 'mon-bprea-course-quiz-personal-v1': 'Cache cours/QCM de ce compte', 'mon-bprea-botanical-personal-v1': 'Cache botanique de ce compte', 'mon-bprea-settings-personal-v1': 'Cache paramètres de ce compte', 'Auth API': 'Identité Auth accessible' };
const statusLabels = { included: 'inclus', absent: 'absent de cet appareil', limited: 'couverture limitée, archives brutes/champs exclus', unavailable: 'lecture indisponible', invalid: 'format illisible', future: 'version inconnue', ownership: 'attribution non vérifiable', blocked: 'stockage bloqué', volume: 'volume trop important' };

export async function initExportUI(root, { auth, configuration } = {}) {
  root.innerHTML = `<section class="data-export wrap" aria-labelledby="export-heading"><div class="data-export-intro"><span class="page-eyebrow">COPIE DE TES INFORMATIONS</span><h2 id="export-heading">Mes données personnelles</h2><p>Deux copies distinctes : les données de ton compte vérifié, et les sauvegardes locales choisies sur cet appareil. Le fichier JSON contient des informations personnelles : protège-le, surtout sur un ordinateur partagé.</p></div><div class="data-export-grid"><section aria-labelledby="export-account-heading"><h3 id="export-account-heading">Données du compte</h3><p>Profil, Drill, cours et QCM, botanique, derniers paramètres ITK et choix d’apparence. Les compléments locaux du même compte sont séparés des lignes serveur.</p><p>Les journaux, sauvegardes et données Auth internes ne sont pas accessibles ici. Les archives brutes sans attribution sûre restent exclues. Cette copie peut donc être partielle ; elle n’est pas une réponse juridique complète à une demande d’accès ou de portabilité.</p><p class="auth-message" data-export-status role="status" aria-live="polite"></p><p data-export-detail class="auth-help"></p><div class="data-export-actions"><button type="button" class="btn btn-primary" data-export-prepare>Préparer les données du compte</button><button type="button" class="btn btn-outline" data-export-cancel disabled>Annuler la préparation</button><button type="button" class="btn btn-outline" data-export-download disabled>Télécharger la copie partielle du compte (JSON)</button></div><ul data-export-coverage aria-label="Couverture de la copie du compte"></ul></section><section aria-labelledby="export-device-heading"><h3 id="export-device-heading">Données locales de cet appareil</h3><p id="export-device-warning">Ces sauvegardes visiteur n’ont pas de propriétaire vérifié. Sur un appareil partagé, elles peuvent concerner quelqu’un d’autre. Elles ne sont jamais fusionnées avec la copie du compte. Choisis uniquement les sources que tu es autorisé à consulter.</p><fieldset data-export-sources aria-describedby="export-device-warning"><legend>Sauvegardes locales disponibles</legend></fieldset><label class="data-export-consent"><input type="checkbox" data-export-confirm> Je suis autorisé à récupérer les sauvegardes locales sélectionnées.</label><div class="data-export-actions"><button type="button" class="btn btn-outline" data-export-inspect>Actualiser les sources locales</button><button type="button" class="btn btn-primary" data-export-device disabled>Télécharger la sélection locale (JSON)</button></div><p class="auth-message" data-export-device-status role="status" aria-live="polite">Aucun téléchargement sans action explicite. Les champs inconnus, corrompus et archives brutes ne sont pas diffusés ; ils restent dans leur source.</p><ul data-export-device-coverage aria-label="Couverture de la copie locale"></ul></section></div><p class="auth-help">Pour les autres données et demandes RGPD, le contact et la procédure auprès du responsable du traitement restent à valider. Aucun canal de demande officiel n’est encore annoncé ici. Les droits d’accès et de portabilité ont des conditions distinctes ; ce téléchargement ne vaut pas décision sur ces droits. Aucune suppression de données n’est effectuée.</p></section>`;
  auth ||= await getAuthService(); configuration ||= await getSupabaseClient().catch(() => ({}));
  const service = createExportService({ auth, configuration });
  const find = name => root.querySelector(`[data-export-${name}]`);
  const preview = document.createElement('pre'); preview.hidden = true; preview.tabIndex = 0; preview.setAttribute('aria-label', 'Contenu normalisé de la sélection locale');
  const previewButton = document.createElement('button'); previewButton.type = 'button'; previewButton.className = 'btn btn-outline'; previewButton.textContent = 'Consulter la sélection locale'; previewButton.disabled = true;
  find('device').parentElement.prepend(previewButton); find('device-coverage').after(preview);
  const abort = new AbortController(), options = { signal: abort.signal };
  const listen = (element, name, cb) => element.addEventListener(name, cb, options);
  const urls = new Set(), timers = new Set();
  const clearFiles = () => { for (const url of urls) URL.revokeObjectURL(url); urls.clear(); for (const timer of timers) clearTimeout(timer); timers.clear(); };
  function deliver(json, name) {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json;charset=utf-8' })); urls.add(url);
    const link = document.createElement('a'); link.href = url; link.download = name; link.hidden = true;
    root.append(link); link.click(); link.remove();
    const timer = setTimeout(() => { URL.revokeObjectURL(url); urls.delete(url); timers.delete(timer); }, 1000); timers.add(timer);
  }
  function coverage(list, values) {
    list.replaceChildren(...values.map(item => {
      const li = document.createElement('li');
      li.textContent = `${sourceLabels[item.source] || item.source} : ${statusLabels[item.status] || 'exclu'}${Number.isSafeInteger(item.count) ? ` (${item.count})` : ''}${item.reason ? `. ${item.reason}` : ''}`;
      return li;
    }));
  }
  let current;
  const unsubscribe = service.subscribe(state => {
    current = state;
    find('status').textContent = labels[state.status] || labels.incomplete;
    find('status').setAttribute('role', ['incomplete', 'identity'].includes(state.status) ? 'alert' : 'status');
    find('detail').textContent = state.source ? `${sourceLabels[state.source] || state.source} : ${state.count} lignes lues, passe ${state.pass}.` : state.reason === 'volume' ? 'Limite de cette version : 100 000 lignes par passe et fichier de 20 Mio. Aucun fichier tronqué n’est produit.' : state.reason === 'unstable' ? 'Les données ont continué de changer pendant les trois passes. Relance lorsque tes activités sont terminées.' : '';
    const busy = ['verifying', 'reading', 'validating'].includes(state.status);
    find('prepare').disabled = busy || auth.getState().status !== 'authenticated';
    find('cancel').disabled = !busy && state.status !== 'ready';
    find('download').disabled = state.status !== 'ready';
    coverage(find('coverage'), state.coverage);
    if (['identity', 'cancelled'].includes(state.status)) clearFiles();
  });
  const authUnsubscribe = auth.subscribe(state => {
    find('prepare').disabled = state.status !== 'authenticated' || ['verifying', 'reading', 'validating'].includes(current?.status);
    if (current?.status === 'idle') find('status').textContent = state.status === 'authenticated' ? labels.idle : 'Connexion serveur vérifiée nécessaire. La copie du compte est indisponible en visiteur ou hors ligne ; la sélection locale reste distincte.';
    if (state.status !== 'authenticated') { preview.textContent = ''; preview.hidden = true; find('confirm').checked = false; updateDeviceButton(); }
  });
  listen(find('prepare'), 'click', () => service.prepareAccount());
  listen(find('cancel'), 'click', () => { service.cancel(); find('prepare').focus(); });
  listen(find('download'), 'click', () => service.downloadAccount(deliver));
  function updateDeviceButton() {
    find('device').disabled = !find('confirm').checked || !find('sources').querySelector('input:checked');
    previewButton.disabled = find('device').disabled;
    preview.textContent = ''; preview.hidden = true;
  }
  function inspect() {
    find('confirm').checked = false;
    const fieldset = find('sources'); fieldset.querySelectorAll('label').forEach(node => node.remove());
    for (const source of service.inspectDevice()) {
      const label = document.createElement('label'), input = document.createElement('input');
      input.type = 'checkbox'; input.value = source.domain; input.disabled = source.status !== 'present';
      label.append(input, document.createTextNode(` ${source.label} — ${source.status === 'present' ? 'présent' : source.status === 'absent' ? 'absent' : 'indisponible'}`));
      fieldset.append(label);
    }
    updateDeviceButton();
  }
  listen(find('inspect'), 'click', inspect); listen(find('sources'), 'change', updateDeviceButton); listen(find('confirm'), 'change', updateDeviceButton);
  listen(previewButton, 'click', () => {
    if (!find('confirm').checked) return;
    try {
      const result = service.prepareDevice([...find('sources').querySelectorAll('input:checked:not(:disabled)')].map(input => input.value));
      coverage(find('device-coverage'), result.coverage);
      const text = JSON.stringify(result.data, null, 2);
      preview.textContent = text.length <= 100000 ? text : 'Sélection trop volumineuse pour l’aperçu. Consulte le fichier JSON si tu es autorisé à le récupérer.';
      preview.hidden = false; preview.focus();
    } catch { find('device-status').textContent = 'La sélection ne peut pas être consultée. Les sources restent intactes.'; }
  });
  listen(find('device'), 'click', () => {
    if (!find('confirm').checked) return;
    try {
      const selected = [...find('sources').querySelectorAll('input:checked:not(:disabled)')].map(input => input.value);
      const result = service.prepareDevice(selected); coverage(find('device-coverage'), result.coverage);
      if (!Object.keys(result.data).length) { find('device-status').textContent = 'Aucune source sélectionnée ne peut être restituée. Les originaux restent intacts.'; return; }
      deliver(serializeExport(result), `mon-bprea-appareil-${result.status === 'partial' ? 'partiel' : 'selection'}.json`);
      find('device-status').textContent = 'Téléchargement local déclenché, propriété non vérifiée. Consulte la couverture et les exclusions dans le fichier.';
    } catch { find('device-status').textContent = 'Copie locale indisponible ou trop volumineuse. Aucun fichier tronqué n’a été créé.'; }
  });
  inspect();
  const dispose = () => { service.stop(); unsubscribe(); authUnsubscribe(); clearFiles(); abort.abort(); root.replaceChildren(); };
  window.addEventListener('pagehide', dispose, { once: true, ...options });
  return dispose;
}
