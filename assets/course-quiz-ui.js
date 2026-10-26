import { lessons } from './content.js';

const clean = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const labels = {
  loading: 'Chargement de la progression personnelle…', saving: 'Enregistrement sur cet appareil…', local: 'Progression enregistrée sur cet appareil',
  pending: 'Progression enregistrée sur cet appareil · synchronisation en attente', syncing: 'Synchronisation en cours',
  synced: 'Synchronisé', offline: 'Connexion indisponible · progression conservée sur cet appareil',
  session: 'Connexion au compte à vérifier', conflict: 'Conflit de cours à résoudre', error: 'Erreur de synchronisation',
  'storage-error': 'Erreur de sauvegarde sur cet appareil', visitor: 'Mode visiteur · progression enregistrée sur cet appareil uniquement',
};
const titleFor = id => lessons.find(lesson => lesson.id === id)?.title || id;

function conflictMarkup(conflict) {
  const operation = conflict.operation || conflict.local?.operation;
  const lessonId = conflict.lessonId || operation?.lessonId || operation?.payload?.p_lesson_id;
  const local = conflict.local?.done ?? conflict.local?.payload?.p_done ?? operation?.payload?.p_done;
  const remote = conflict.remote?.done;
  const mutable = conflict.kind !== 'identity' && conflict.kind !== 'quiz' && (lessonId || conflict.kind === 'course');
  return `<details class="course-quiz-conflict" data-conflict="${clean(conflict.id)}"><summary>${conflict.resolved ? 'Conflit conservé en archive' : 'Conflit à résoudre'} · ${clean(titleFor(lessonId || 'QCM'))}</summary><p>${mutable ? `Une autre modification du cours a été enregistrée sur le compte. Ton intention et les opérations dépendantes restent conservées. ${typeof local === 'boolean' ? `Choix local : <strong>${local ? 'terminé' : 'non terminé'}</strong>.` : ''} ${typeof remote === 'boolean' ? `Version du compte : <strong>${remote ? 'terminé' : 'non terminé'}</strong>.` : ''}` : 'Un identifiant de tentative correspond à un autre contenu. Les données sont conservées sans nouvel envoi ; une intervention est nécessaire.'}</p>${!conflict.resolved && mutable ? `<div class="course-quiz-actions"><button class="btn btn-outline" type="button" data-course-resolve="${clean(conflict.id)}" data-choice="remote">Garder la version du compte</button><button class="btn btn-outline" type="button" data-course-resolve="${clean(conflict.id)}" data-choice="local">Conserver mon choix</button></div><p>Conserver mon choix crée une nouvelle intention à partir de la révision actuelle. L’ancienne reste archivée.</p>` : ''}</details>`;
}

/** Stable controls and a separate dialog keep focus and an import preview intact
 * while the account service publishes background progress. */
export function initCourseQuizPanel(root, service) {
  root.innerHTML = `<div class="course-quiz-panel"><p id="course-quiz-sync-status" role="status" aria-live="polite" aria-atomic="true"></p><p id="course-quiz-sync-detail"></p><div class="course-quiz-actions"><button class="btn btn-outline" id="course-quiz-refresh" type="button">Actualiser la progression</button><button class="btn btn-outline" id="course-quiz-import" type="button">Importer l’historique de cet appareil</button></div><div id="course-quiz-sync-archives"></div><p id="course-quiz-action-message" role="status" aria-live="polite"></p><details id="course-quiz-cache-info"><summary>À propos de ce cache personnel</summary><p>Les données de ce compte restent sur cet appareil après déconnexion pour permettre une reprise. Le cache n’est pas chiffré : utilise un profil de navigateur privé sur un appareil partagé.</p></details></div><dialog class="course-quiz-import-dialog" aria-labelledby="course-quiz-import-title"><h2 id="course-quiz-import-title">Importer les cours et QCM locaux</h2><p>Cette sauvegarde appartient à cet appareil. Elle n’est pas nécessairement liée au compte connecté. Confirme uniquement si cet historique est le tien.</p><div id="course-quiz-import-preview"></div><p id="course-quiz-import-message" role="status" aria-live="polite"></p><div class="course-quiz-actions"><button class="btn btn-primary" id="course-quiz-import-confirm" type="button">Confirmer l’import</button><button class="btn btn-outline" id="course-quiz-import-cancel" type="button">Annuler</button></div><p>La sauvegarde visiteur d’origine et ses archives restent intégralement conservées.</p></dialog>`;
  const select = id => root.querySelector(`#${id}`);
  const dialog = root.querySelector('dialog');
  const refresh = select('course-quiz-refresh'), startImport = select('course-quiz-import');
  const confirm = select('course-quiz-import-confirm');
  let snapshot = service.getState(), preview = null, archivesMarkup = '', refreshing = false;
  let source = `${snapshot.mode}:${snapshot.scope}`;
  const activeSource = () => `${snapshot.mode}:${snapshot.scope}`;
  const announce = message => select('course-quiz-action-message').textContent = message || '';
  const unsubscribe = service.subscribe(state => {
    snapshot = state;
    if (source !== activeSource() || state.mode !== 'personal' || state.sync.state === 'session') {
      source = activeSource(); preview = null;
      if (dialog.open) dialog.close();
      announce('');
    }
    const visitor = state.mode === 'visitor';
    const usable = state.mode === 'personal' && state.sync.state !== 'session';
    const pending = state.sync.pending || 0;
    select('course-quiz-sync-status').textContent = `${visitor ? labels.visitor : labels[state.sync.state] || labels.session}${pending ? ` · ${pending} opération${pending > 1 ? 's' : ''} en attente` : ''}`;
    select('course-quiz-sync-detail').textContent = state.view.error || state.sync.error || (state.mode === 'personal' ? 'Les QCM enregistrés localement restent disponibles pendant une panne. La mention « synchronisés » confirme leur sauvegarde distante.' : '');
    refresh.hidden = visitor; startImport.hidden = !usable; refresh.disabled = refreshing;
    select('course-quiz-cache-info').hidden = !usable;
    const markup = `${(state.sync.conflicts || []).map(conflictMarkup).join('')}${state.sync.operations?.length ? `<details><summary>Opérations refusées conservées sur cet appareil (${state.sync.operations.length})</summary><p>Ces opérations ne sont pas réessayées automatiquement. Leurs données et leur diagnostic restent conservés.</p></details>` : ''}${state.sync.imports?.length ? '<p class="course-quiz-import-state">Import local conservé. Les opérations encore en attente sont incluses dans le suivi de synchronisation ci-dessus.</p>' : ''}`;
    if (markup !== archivesMarkup) {
      const container = select('course-quiz-sync-archives');
      const opened = new Set([...container.querySelectorAll('details[open][data-conflict]')].map(item => item.dataset.conflict));
      const focused = container.contains(document.activeElement) ? document.activeElement : null;
      const focusId = focused?.dataset.courseResolve, focusChoice = focused?.dataset.choice;
      container.innerHTML = markup; archivesMarkup = markup;
      container.querySelectorAll('details[data-conflict]').forEach(item => item.open = opened.has(item.dataset.conflict));
      if (focusId) container.querySelector(`[data-course-resolve="${CSS.escape(focusId)}"][data-choice="${CSS.escape(focusChoice)}"]`)?.focus({ preventScroll: true });
    }
  });
  refresh.addEventListener('click', async () => {
    const current = activeSource(); refreshing = true; refresh.disabled = true; announce('Actualisation en cours…');
    try { await service.retry(); if (current === activeSource()) announce(''); }
    catch { if (current === activeSource()) announce('L’actualisation reste indisponible. Les données enregistrées sont conservées.'); }
    finally { refreshing = false; refresh.disabled = false; }
  });
  startImport.addEventListener('click', async () => {
    const current = activeSource(); startImport.disabled = true;
    try {
      const value = await service.previewImport();
      if (current !== activeSource() || snapshot.mode !== 'personal') return;
      preview = value; const summary = value.summary || {};
      select('course-quiz-import-preview').innerHTML = `<dl class="course-quiz-import-summary"><div><dt>Cours terminés</dt><dd>${summary.courses || 0}</dd></div><div><dt>Tentatives QCM exploitables</dt><dd>${summary.attempts || 0}</dd></div><div><dt>Scores anciens sans tentative datée</dt><dd>${summary.legacyScores || 0}</dd></div></dl>${value.warnings?.length ? `<p>Données partielles ou non importables :</p><ul>${value.warnings.map(item => `<li>${clean(typeof item === 'string' ? item : item.message || JSON.stringify(item))}</li>`).join('')}</ul>` : ''}`;
      select('course-quiz-import-message').textContent = value.error || (!value.available ? 'Aucun historique exploitable n’est disponible pour cet import.' : 'Aucun envoi n’a lieu avant ta confirmation.');
      confirm.disabled = !!value.error || !value.available;
      dialog.showModal();
    } catch { announce('Impossible de lire l’historique local. La sauvegarde d’origine reste conservée.'); }
    finally { startImport.disabled = false; }
  });
  const close = () => { dialog.close(); preview = null; startImport.focus({ preventScroll: true }); };
  select('course-quiz-import-cancel').addEventListener('click', close);
  dialog.addEventListener('cancel', () => { preview = null; });
  confirm.addEventListener('click', async () => {
    if (!preview) return;
    const current = activeSource(); confirm.disabled = true;
    const result = await service.confirmImport(preview);
    if (current !== activeSource()) return;
    if (result.error) { select('course-quiz-import-message').textContent = result.error; return; }
    close();
    announce(result.replayed ? 'Cet import était déjà enregistré. Aucun nouvel historique n’a été créé.' : 'Import enregistré sur cet appareil. Le suivi indique les opérations restant à synchroniser ; la source d’origine est conservée.');
  });
  root.addEventListener('click', async event => {
    const button = event.target.closest('[data-course-resolve]');
    if (!button) return;
    const current = activeSource(); button.disabled = true;
    try {
      const result = await service.resolveConflict(button.dataset.courseResolve, button.dataset.choice);
      if (current === activeSource()) {
        announce(result?.error || 'Résolution enregistrée. Les intentions précédentes restent archivées.');
        if (!result?.error) refresh.focus({ preventScroll: true });
      }
    } finally { if (button.isConnected) button.disabled = false; }
  });
  window.addEventListener('pagehide', unsubscribe, { once: true });
  return unsubscribe;
}
