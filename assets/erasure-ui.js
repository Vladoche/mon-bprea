import { getSupabaseClient } from './supabase-client.js';
import { createErasureService, PERSONAL_ERASURE } from './erasure-service.js';
import { VISITOR_SOURCES } from './export-sources.js';
import { closureAvailable, createClosureClient } from './closure-client.js';
const issues = { identity: 'L’identité doit être vérifiée à nouveau. Aucune nouvelle suppression autorisée.',
  confirmation: 'La confirmation n’est plus disponible. Examine à nouveau la sélection avant de confirmer. Aucune nouvelle suppression effectuée.',
  changed: 'La sauvegarde a changé depuis l’aperçu. Relis la sélection avant de confirmer à nouveau.',
  unknown: 'Une sauvegarde est illisible, future ou ne permet pas d’attribuer ses archives. Elle est conservée.',
  future: 'Version de stockage inconnue : aucune suppression de cette source.',
  locking: 'La coordination est indisponible ou une autre action est en cours. Ferme les anciens onglets et réessaie.',
  blocked: 'Stockage bloqué par un autre onglet. Ferme cet onglet puis réessaie.',
  unavailable: 'Le stockage est inaccessible. L’effacement n’est pas confirmé.' };
export async function initErasureUI(root, { auth, configuration } = {}) {
  configuration ||= await getSupabaseClient().catch(() => ({}));
  root.innerHTML = `<section class="data-erasure wrap" aria-labelledby="erasure-heading"><span class="page-eyebrow">CHOISIR CE QUE TU RETIRES</span><h2 id="erasure-heading">Effacement et clôture</h2><p><a href="#export-heading">Préparer une copie avant d’effacer</a>. Un export préalable reste facultatif. Un fichier déjà téléchargé ne peut pas être rappelé.</p><div class="data-erasure-grid"><section aria-labelledby="erasure-local-heading"><h3 id="erasure-local-heading">Effacer sur cet appareil</h3><p>Seules les catégories choisies seront retirées de ce navigateur. Le compte et les résultats du serveur restent disponibles.</p><p id="erasure-local-warning">Les opérations non synchronisées, brouillons, conflits et archives sélectionnés seront perdus. Ferme les anciens onglets du site avant de continuer. Une action future en visiteur peut créer une nouvelle sauvegarde.</p><fieldset data-erase-personal><legend>Caches personnels du compte vérifié</legend></fieldset><fieldset data-erase-visitor><legend>Sauvegardes visiteur indépendantes</legend></fieldset><p>Appareil partagé : les sauvegardes visiteur peuvent appartenir à quelqu’un d’autre. Ne choisis que celles que tu es autorisé à retirer. Les marqueurs de provenance sont distincts ; les retirer change la reconnaissance d’un futur import.</p><div class="data-export-actions"><button type="button" class="btn btn-outline" data-erase-preview disabled>Examiner l’effacement local</button><button type="button" class="btn btn-outline" data-erase-resume disabled>Reprendre les caches depuis le compte</button></div><p class="auth-help">Après effacement personnel, les caches restent suspendus sur cet appareil. Les reprendre autorise leur reconstruction depuis le serveur et les activités suivantes ; cela ne récupère pas les opérations uniquement locales effacées. Les caches des autres appareils restent indépendants.</p><p data-erase-status class="auth-message" role="status" tabindex="-1" aria-live="polite">Aucune catégorie sélectionnée par défaut.</p><ul data-erase-results></ul></section><section aria-labelledby="closure-heading"><h3 id="closure-heading">Clôturer le compte</h3><p>La clôture retire l’accès au compte et ses résultats personnels actifs lorsque le serveur confirme la suppression. Elle est distincte d’une déconnexion et de l’effacement local.</p><p>Les appareils éteints ou hors ligne peuvent garder des caches. Le serveur ne retire pas les JSON, CSV, PDF, impressions et historiques déjà enregistrés. Les délais des sauvegardes et journaux du prestataire ainsi que les éventuelles obligations de conservation restent à valider.</p><p data-closure-availability>Clôture en préparation : le service de confiance et les décisions opérationnelles nécessaires ne sont pas validés pour l’ouverture publique. Cette opération n’est pas disponible ici. Le canal officiel de demande de droits reste à valider.</p><div data-closure-local hidden><p>Essai local éphémère uniquement. Tu peux d’abord retirer les caches personnels avec le parcours de gauche. La clôture ne retire automatiquement aucune sauvegarde visiteur ni aucun cache d’un autre appareil.</p><form data-closure-form><label>Mot de passe actuel<input name="password" type="password" autocomplete="current-password" maxlength="1024" required></label><label>Écris SUPPRIMER pour confirmer<input name="confirmation" autocomplete="off" pattern="SUPPRIMER" required></label><button type="submit" class="btn btn-outline">Vérifier mon identité pour clôturer</button></form><button type="button" class="btn btn-outline" data-closure-execute hidden>Confirmer la clôture irréversible</button><button type="button" class="btn btn-outline" data-closure-retry hidden>Vérifier à nouveau la même clôture</button></div><p data-closure-status class="auth-message" role="status" aria-live="polite" tabindex="-1"></p></section></div><dialog data-erase-dialog aria-labelledby="erase-dialog-title" aria-describedby="erase-dialog-warning"><h3 id="erase-dialog-title">Confirmer l’effacement local</h3><p id="erase-dialog-warning">Cette action est irréversible pour les données uniquement locales. Elle peut retirer une file non synchronisée. Le compte et les données du serveur restent conservés.</p><ul data-erase-summary></ul><p>Tu confirmes être autorisé à retirer chacune des sauvegardes choisies sur cet appareil.</p><div class="data-export-actions"><button type="button" class="btn btn-outline" data-erase-cancel autofocus>Annuler</button><button type="button" class="btn btn-outline" data-erase-confirm>Effacer la sélection confirmée</button></div></dialog></section>`;
  const find = name => root.querySelector(`[data-${name}]`), controller = new AbortController();
  const service = createErasureService({ auth, configuration });
  const closure = createClosureClient({ auth, configuration });
  const listen = (node, event, fn) => node.addEventListener(event, fn, { signal: controller.signal });
  let busy = false, disposed = false;
  function checkboxes(field, entries, kind) {
    for (const [key, label] of entries) {
      const row = document.createElement('label'), input = document.createElement('input');
      input.type = 'checkbox'; input.value = key; input.dataset.eraseKind = kind;
      row.append(input, document.createTextNode(` ${label}`)); field.append(row);
      listen(input, 'change', () => { service.cancel(); controls(); });
    }
  }
  checkboxes(find('erase-personal'), Object.entries(PERSONAL_ERASURE), 'personal');
  const markerInfo = document.createElement('p'); markerInfo.className = 'auth-help';
  markerInfo.textContent = 'Le retrait d’un cache personnel conserve un marqueur technique de suspension sur cet appareil pour empêcher sa réécriture. Il ne contient aucun résultat pédagogique.';
  find('erase-personal').after(markerInfo);
  checkboxes(find('erase-visitor'), Object.entries(VISITOR_SOURCES).map(([key, source]) => [key, source.label]), 'visitor');
  function controls() {
    const personal = auth.getState().status === 'authenticated';
    find('erase-personal').disabled = busy || !personal;
    find('erase-visitor').disabled = busy;
    find('erase-resume').disabled = busy || !personal;
    find('erase-preview').disabled = busy || !root.querySelector('input[data-erase-kind]:checked:not(:disabled)') ||
      ![...root.querySelectorAll('input[data-erase-kind]:checked')].some(input => input.dataset.eraseKind === 'visitor' || personal);
  }
  let authSignature;
  const unsubscribe = auth.subscribe(() => { if (!disposed) {
    const next = `${auth.getState().status}:${auth.getState().user?.id || ''}:${auth.getIdentityVersion()}`;
    if (authSignature === next) { controls(); return; }
    authSignature = next;
    find('erase-dialog').close(); service.cancel(); controls();
    if (auth.getState().status !== 'authenticated') {
      for (const input of find('erase-personal').querySelectorAll('input')) input.checked = false;
      find('closure-form').elements.password.value = '';
    }
  } });
  function status(text, bad = false) { find('erase-status').textContent = text; find('erase-status').setAttribute('role', bad ? 'alert' : 'status'); }
  const selection = kind => [...root.querySelectorAll(`input[data-erase-kind="${kind}"]:checked`)].map(input => input.value);
  listen(find('erase-preview'), 'click', async () => {
    busy = true; controls(); status('Vérification de la portée et des opérations en attente…');
    try {
      const summary = await service.prepare({ personal: selection('personal'), visitor: selection('visitor') });
      if (disposed) return;
      find('erase-summary').replaceChildren(...summary.map(item => { const li = document.createElement('li');
        li.textContent = `${item.source} : ${item.present ? 'présent' : 'absent'}${item.pending !== null ? ` ; ${item.pending} opération(s) non confirmée(s)` : ' ; nombre d’opérations non déterminé'}. ${item.details}`; return li; }));
      find('erase-dialog').showModal(); find('erase-cancel').focus();
    } catch (issue) { status(issues[issue.code] || issues.unavailable, true); }
    finally { busy = false; controls(); }
  });
  const cancel = () => { service.cancel(); find('erase-dialog').close(); status('Effacement annulé. Aucune sauvegarde retirée.'); find('erase-preview').focus(); };
  listen(find('erase-cancel'), 'click', cancel);
  listen(find('erase-dialog'), 'cancel', event => { event.preventDefault(); cancel(); });
  listen(find('erase-confirm'), 'click', async () => {
    if (busy) return; busy = true; controls(); find('erase-confirm').disabled = true;
    status('Effacement en cours. Attente des transactions de stockage…');
    try {
      const result = await service.execute({ confirmed: true });
      if (disposed) return;
      find('erase-results').replaceChildren(...result.results.map(item => { const li = document.createElement('li');
        const label = item.source.split(' / ').map(key => PERSONAL_ERASURE[key] || VISITOR_SOURCES[key]?.label || key).join(' / ');
        li.textContent = `${item.kind === 'visitor' ? 'Visiteur' : 'Cache personnel'} : ${label} — ${item.status === 'failed' ? issues[item.reason] || issues.unavailable : item.status === 'absent' ? 'déjà absent' : 'effacement local confirmé'}`; return li; }));
      status(result.status === 'complete' ? 'Effacement local confirmé pour la sélection. Les données du serveur restent conservées.' : result.status === 'partial' ? 'Effacement local partiel. Certaines catégories n’ont pas pu être retirées ; consulte le détail.' : 'Effacement local non confirmé. Consulte le détail avant de réessayer.', result.status !== 'complete');
      for (const input of root.querySelectorAll('input[data-erase-kind]')) input.checked = false;
    } catch (issue) { status(issues[issue.code] || issues.unavailable, true); }
    finally { busy = false; find('erase-dialog').close(); find('erase-confirm').disabled = false; controls(); find('erase-status').focus(); }
  });
  listen(find('erase-resume'), 'click', async () => {
    busy = true; controls();
    try { status(await service.resume() ? 'Reprise autorisée. Les caches peuvent être reconstruits depuis le compte ; les données uniquement locales effacées restent perdues.' : 'Reprise partielle : un stockage reste inaccessible.', false); }
    catch (issue) { status(issues[issue.code] || issues.unavailable, true); }
    finally { busy = false; controls(); }
  });
  if (closureAvailable(configuration)) {
    find('closure-local').hidden = false; find('closure-availability').textContent = 'Prototype activé uniquement pour cette stack locale éphémère. Aucune disponibilité publique.';
    listen(find('closure-form'), 'submit', async event => {
      event.preventDefault(); const form = event.currentTarget;
      find('closure-execute').hidden = true; find('closure-retry').hidden = true;
      for (const field of form.elements) field.disabled = true;
      try { await closure.prepare(form.elements.password.value, form.elements.confirmation.value);
        find('closure-status').textContent = 'Identité vérifiée par une nouvelle connexion native. Confirme maintenant la clôture irréversible. Les caches locaux peuvent rester.'; find('closure-execute').hidden = false; find('closure-execute').focus(); }
      catch (issue) { find('closure-status').textContent = issue.message; }
      finally { form.elements.password.value = ''; for (const field of form.elements) field.disabled = false; }
    });
    const execute = async () => {
      find('closure-execute').disabled = true; find('closure-retry').disabled = true;
      find('closure-status').textContent = 'Clôture en cours. Une déconnexion seule ne prouve pas la suppression.';
      try { const result = await closure.execute(); find('closure-status').textContent = `Suppression serveur confirmée pour les données actives du compte. Nettoyage local non effectué : des caches peuvent rester sur cet appareil et les appareils absents.${result.session === 'incomplete' ? ' La fin de session locale n’est pas confirmée.' : ''}`;
        find('closure-local').hidden = true; }
      catch (issue) { find('closure-status').textContent = issue.message; find('closure-retry').hidden = !closure.canRetry(); }
      finally { find('closure-execute').hidden = true; find('closure-execute').disabled = false; find('closure-retry').disabled = false; find('closure-status').focus(); }
    };
    listen(find('closure-execute'), 'click', execute); listen(find('closure-retry'), 'click', execute);
  }
  return () => { disposed = true; controller.abort(); unsubscribe(); service.stop(); closure.stop(); find('erase-dialog').close(); };
}
