import { createRestoreService } from './restore-service.js';

const labels = {
  idle: 'Aucune sauvegarde sélectionnée.', reading: 'Lecture du fichier local…', verifying: 'Vérification du compte auprès du serveur…', analyzing: 'Analyse sans modification des données…',
  ready: 'Aperçu prêt. Vérifie les données récupérables et les limites avant de confirmer.',
  invalid: 'La sauvegarde est refusée. Aucune donnée pédagogique n’a été modifiée.', identity: 'Connexion serveur vérifiée nécessaire. Le processus a été invalidé.',
  applying: 'Restauration en cours. Les confirmations locales et serveur sont vérifiées séparément…',
  partial: 'Restauration partielle : consulte les données récupérées, en attente, en conflit ou non restaurables.',
  confirmed: 'Restauration des données compatibles confirmée. Les sources exclues du fichier restent exclues.',
  changed: 'Les données ont changé depuis l’aperçu. Analyse à nouveau le fichier avant toute restauration.',
  interrupted: 'Restauration interrompue. Les données déjà enregistrées sont conservées ; analyse à nouveau le fichier pour vérifier ce qui reste à traiter.',
  cancelled: 'Opération annulée. Une analyse ou son annulation ne modifie aucune donnée pédagogique.',
};
const reasons = {
  volume: 'Le fichier dépasse la limite de 20 Mio, 100 000 lignes ou la profondeur autorisée.', json: 'Le contenu n’est pas un JSON lisible.',
  version: 'Cette version de sauvegarde n’est pas prise en charge.', unattributed: 'Une copie visiteur sans propriétaire vérifié ne peut pas restaurer un compte.',
  ownership: 'Cette sauvegarde appartient à un autre compte.', environment: 'L’environnement ou le projet Supabase ne correspond pas au compte actif.',
  date: 'Une date du fichier est invalide.', uuid: 'Un identifiant d’opération est invalide.', duplicate: 'Des identifiants sont dupliqués.',
  archive: 'Une archive ou ses relations ne sont pas reconnues.', coverage: 'La couverture déclarée ne correspond pas aux sources du fichier.',
  coherence: 'Des copies de la même donnée sont incompatibles dans le fichier.',
  unstable: 'Les données continuent de changer. Réessaie lorsque tes activités sont terminées.',
  lock: 'Une autre action de confidentialité est en cours, ou le verrou du navigateur est indisponible.',
  privacy: 'Une trace d’effacement sur cet appareil bloque le domaine concerné. Une ancienne sauvegarde ne peut pas rouvrir cette portée.',
  local_erased: 'Ce cache a été retiré. La restauration ne l’a pas rouvert.',
  local_storage: 'Le stockage local est inaccessible ou plein. Les données existantes sont conservées.',
  local_unavailable: 'Un cache local n’a pas pu être lu : il n’est pas considéré comme vide.', local_invalid: 'Un cache actuel est illisible ; il est conservé.',
  server_unavailable: 'Le serveur est indisponible. Son contenu ne peut pas être considéré comme vide ; aucune restauration n’est proposée.',
  divergent: 'Les versions diffèrent. La version actuelle est conservée, sans résolution automatique.',
  series_uuid: 'Une série Drill absente ne peut pas retrouver son UUID technique avec les RPC actuelles.',
  revision: 'Une ancienne révision ou une session terminée absente nécessite un contrat de restauration distinct.',
  parent: 'Une série, une première réponse ou une session parente n’a pas pu être rapprochée de façon sûre.',
  dependency: 'Les dépendances historiques ne peuvent pas être reprises sans les modifier.',
  descriptor: 'Les manifestes, conflits et archives exportés sont consultables dans le fichier mais ne sont pas réactivés.',
  suspended_operation: 'Une opération déjà suspendue dans la copie reste hors reprise automatique.',
  missing_operation: 'Une projection ne possède pas l’identité d’opération nécessaire à sa réintégration.',
  missing_series_identity: 'Une série locale ne possède pas de correspondance serveur démontrée.',
  current_intents: 'Ce domaine possède déjà des intentions ou conflits locaux. Termine leur réconciliation avant de restaurer.',
  current_local: 'Cette opération ne permet pas de conserver à l’identique une donnée locale existante. La donnée actuelle reste en place ; aucune réinsertion automatique.',
  incompatible: 'Le contrat actuel ne permet pas cette réintégration.', backend: 'Cette source ne peut pas être restaurée avec le contrat actuel.',
  server_conflict: 'Le serveur a conservé une version concurrente. L’intention est archivée par le service existant.',
  unverified: 'Une opération est enregistrée localement ; sa présence serveur n’a pas pu être revérifiée.',
  unavailable: 'Le fichier ou une opération ne peut pas être vérifié. Les données existantes sont conservées.',
};
const groups = { drill: 'Drill', courses: 'Cours', quiz: 'QCM', botanical: 'Botanique', itk: 'Paramètres ITK', appearance: 'Apparence', local: 'Compléments locaux', profile: 'Identité (consultation)' };
const sources = { profiles: 'Profil', drill_series: 'Séries Drill', drill_answers: 'Premières réponses', drill_training_attempts: 'Entraînements', course_states: 'États de cours', quiz_attempts: 'Tentatives QCM', botanical_sessions: 'Sessions botaniques', botanical_answers: 'Réponses botaniques', itk_settings: 'ITK', appearance_preferences: 'Apparence', 'mon-bprea-drill-personal-v1': 'Cache Drill', 'mon-bprea-course-quiz-personal-v1': 'Cache cours/QCM', 'mon-bprea-botanical-personal-v1': 'Cache botanique', 'mon-bprea-settings-personal-v1': 'Cache paramètres', 'Auth API': 'Identité Auth limitée' };
const coverageLabels = { included: 'présente', limited: 'présente avec exclusions', absent: 'absente', excluded: 'exclue', unavailable: 'illisible ou indisponible', invalid: 'illisible', future: 'version inconnue', ownership: 'attribution impossible', blocked: 'bloquée', volume: 'volume exclu' };
const columns = { recoverable: 'Récupérables', present: 'Déjà présentes', local: 'Récupérées dans le cache', server: 'Confirmées serveur', pending: 'En attente', conflict: 'Conflits', ignored: 'Ignorées', blocked: 'Non restaurables' };

export function initRestoreUI(root, { auth, configuration, service = createRestoreService({ auth, configuration }) }) {
  root.innerHTML = `<section class="data-restore" aria-labelledby="restore-heading"><h3 id="restore-heading">Restaurer une sauvegarde</h3><p>Tu peux sélectionner une sauvegarde JSON de ton compte Mon BPREA pour retrouver des données qui ne sont plus présentes. Avant toute modification, l’application vérifiera le fichier et te montrera les informations récupérables. Tes données actuelles ne seront jamais effacées automatiquement.</p><p id="restore-file-help" class="auth-help">Fichier local JSON v1, 20 Mio maximum. Le fichier est analysé sur cet appareil. Les données compatibles seront réintégrées uniquement après ta confirmation.</p><label for="restore-file">Sauvegarde JSON du compte</label><input id="restore-file" data-restore-file type="file" accept=".json,application/json" aria-describedby="restore-file-help"><div class="data-export-actions"><button type="button" class="btn btn-outline" data-restore-analyze>Analyser la sauvegarde</button><button type="button" class="btn btn-outline" data-restore-cancel disabled>Annuler</button></div><p class="auth-message" data-restore-status role="status" aria-live="polite"></p><p class="auth-help" data-restore-detail></p><div data-restore-preview hidden><p data-restore-file-summary></p><p>Le fichier valide n’est pas une garantie de récupération totale. Les historiques, le cache local et leurs copies ne sont pas comptés comme des tentatives distinctes. Auth, les sources absentes et les données exclues ne sont pas restaurés.</p><div class="data-restore-table" role="region" aria-label="Bilan par domaine" tabindex="0"><table><caption>Données de la sauvegarde et résultat vérifié</caption><thead><tr><th scope="col">Domaine</th></tr></thead><tbody></tbody></table></div><ul data-restore-warnings aria-label="Limites de restauration"></ul><details><summary>Sources présentes et exclues du fichier</summary><ul data-restore-coverage></ul></details><label class="data-export-consent"><input type="checkbox" data-restore-confirm> J’ai vérifié cet aperçu et je souhaite restaurer uniquement les données compatibles.</label><button type="button" class="btn btn-primary" data-restore-apply disabled>Restaurer les données compatibles</button></div></section>`;
  const find = name => root.querySelector(`[data-restore-${name}]`);
  const scrollHelp = document.createElement('p'); scrollHelp.className = 'data-restore-scroll-help auth-help';
  scrollHelp.textContent = 'Fais défiler le tableau horizontalement pour consulter toutes les colonnes.';
  root.querySelector('.data-restore-table').before(scrollHelp);
  const header = root.querySelector('thead tr');
  for (const label of Object.values(columns)) { const th = document.createElement('th'); th.scope = 'col'; th.textContent = label; header.append(th); }
  let selected = null, choosing = false, current = service.getState();
  const abort = new AbortController();
  function controls() {
    const busy = ['reading', 'verifying', 'analyzing', 'applying'].includes(current.status), connected = auth.getState().status === 'authenticated';
    find('file').disabled = busy || !connected;
    find('analyze').disabled = busy || !selected || !connected;
    find('cancel').disabled = current.status === 'idle' || current.status === 'cancelled';
    find('confirm').disabled = current.status !== 'ready' || !current.summary?.total.recoverable;
    find('apply').disabled = current.status !== 'ready' || !connected || !find('confirm').checked || !current.summary?.total.recoverable;
  }
  const unsubscribe = service.subscribe(value => {
    current = value;
    find('status').textContent = labels[value.status] || labels.invalid;
    find('status').setAttribute('role', ['invalid', 'identity', 'changed', 'interrupted'].includes(value.status) ? 'alert' : 'status');
    find('detail').textContent = reasons[value.reason] || '';
    find('preview').hidden = !value.summary;
    find('confirm').checked = false;
    if (value.generatedAt) find('file-summary').textContent = `Créée le ${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Paris' }).format(new Date(value.generatedAt))} · ${(value.size / 1024).toFixed(1)} Kio. Compte, projet et environnement ${value.environment === 'production' ? 'production' : 'développement'} vérifiés.`;
    if (!value.summary) find('file-summary').textContent = '';
    root.querySelector('tbody').replaceChildren(...Object.entries(value.summary?.groups || {}).map(([group, counts]) => {
      const tr = document.createElement('tr'), th = document.createElement('th'); th.scope = 'row'; th.textContent = groups[group]; tr.append(th);
      for (const key of Object.keys(columns)) { const td = document.createElement('td'); td.textContent = String(counts[key]); tr.append(td); }
      return tr;
    }));
    find('warnings').replaceChildren(...(value.reasons || []).map(code => { const li = document.createElement('li'); li.textContent = reasons[code] || reasons.incompatible; return li; }));
    find('coverage').replaceChildren(...(value.coverage || []).map(item => { const li = document.createElement('li'); li.textContent = `${sources[item.source] || 'Source connue'} : ${coverageLabels[item.status] || 'exclue'}.`; return li; }));
    if (!choosing && ['identity', 'cancelled', 'interrupted'].includes(value.status)) { selected = null; find('file').value = ''; }
    controls();
  });
  const unAuth = auth.subscribe(state => {
    if (state.status !== 'authenticated') { selected = null; find('file').value = ''; find('confirm').checked = false; if (current.status === 'idle') find('status').textContent = labels.identity; }
    controls();
  });
  const listen = (name, event, fn) => find(name).addEventListener(event, fn, { signal: abort.signal });
  listen('file', 'change', () => { const file = find('file').files[0]; choosing = true; service.cancel(); choosing = false; selected = file || null; controls(); find('status').textContent = selected ? 'Fichier sélectionné. Lance l’analyse sans modification.' : labels.idle; });
  listen('analyze', 'click', () => { if (selected) service.analyze(selected); });
  listen('confirm', 'change', controls);
  listen('apply', 'click', () => service.apply({ confirmed: find('confirm').checked }));
  listen('cancel', 'click', () => { service.cancel(); find('file').focus(); });
  return () => { abort.abort(); unsubscribe(); unAuth(); service.stop(); root.replaceChildren(); };
}
