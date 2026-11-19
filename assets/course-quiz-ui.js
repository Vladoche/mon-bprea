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

/** Contextual feedback only. Services and identity guards keep running even
 * when this notice is hidden; management controls live in profile settings. */
export function initCourseQuizNotice(root, service) {
  root.innerHTML = '<p id="course-quiz-sync-status" role="status" aria-atomic="true"></p><p data-course-quiz-notice-detail></p><a class="ui-link" href="profil.html#donnees-synchronisation">Données et synchronisation des cours et QCM <span aria-hidden="true">→</span></a>';
  const status = root.querySelector('[role="status"]');
  const detail = root.querySelector('[data-course-quiz-notice-detail]');
  return service.subscribe(state => {
    const sync = state.sync;
    const attention = ['pending', 'offline', 'session', 'conflict', 'error', 'storage-error'].includes(sync.state) ||
      sync.pending > 0 || sync.conflicts?.some(conflict => !conflict.resolved) || sync.operations?.length > 0 ||
      !!state.view.error && sync.state !== 'loading';
    const label = state.view.error && !['session', 'storage-error', 'error'].includes(sync.state)
      ? 'Progression indisponible · données conservées' : labels[sync.state] || labels.session;
    status.textContent = `${label}${sync.pending ? ` · ${sync.pending} opération${sync.pending > 1 ? 's' : ''} en attente` : ''}`;
    detail.textContent = state.view.error || sync.error || '';
    detail.hidden = !detail.textContent;
    root.hidden = !attention;
  });
}

function conflictMarkup(conflict) {
  const operation = conflict.operation || conflict.local?.operation;
  const lessonId = conflict.lessonId || operation?.lessonId || operation?.payload?.p_lesson_id;
  const local = conflict.local?.done ?? conflict.local?.payload?.p_done ?? operation?.payload?.p_done;
  const remote = conflict.remote?.done;
  const mutable = conflict.kind !== 'identity' && conflict.kind !== 'quiz' && (lessonId || conflict.kind === 'course');
  return `<details class="course-quiz-conflict" data-conflict="${clean(conflict.id)}"><summary>${conflict.resolved ? 'Conflit conservé en archive' : 'Conflit à résoudre'} · ${clean(titleFor(lessonId || 'QCM'))}</summary><p>${mutable ? `Une autre modification du cours a été enregistrée sur le compte. Ton intention et les opérations dépendantes restent conservées. ${typeof local === 'boolean' ? `Choix local : <strong>${local ? 'terminé' : 'non terminé'}</strong>.` : ''} ${typeof remote === 'boolean' ? `Version du compte : <strong>${remote ? 'terminé' : 'non terminé'}</strong>.` : ''}` : 'Un identifiant de tentative correspond à un autre contenu. Les données restent sur cet appareil. Contacte l’assistance pour examiner le conflit.'}</p>${!conflict.resolved && mutable ? `<div class="course-quiz-actions"><button class="btn btn-surface" type="button" data-course-resolve="${clean(conflict.id)}" data-choice="remote">Garder la version du compte</button><button class="btn btn-surface" type="button" data-course-resolve="${clean(conflict.id)}" data-choice="local">Conserver mon choix</button></div><p>Conserver mon choix crée une nouvelle intention à partir de la révision actuelle. L’ancienne reste archivée.</p>` : ''}</details>`;
}

/** Stable controls and a separate dialog keep focus and an import preview intact
 * while the account service publishes background progress. */
export function initCourseQuizPanel(root, service) {
  root.innerHTML = `
    <div class="course-quiz-panel">
      <p class="course-quiz-state" id="course-quiz-sync-status" role="status" aria-atomic="true"></p>
      <p id="course-quiz-sync-detail" hidden></p>
      <div class="course-quiz-actions">
        <button class="btn btn-surface" id="course-quiz-refresh" type="button">Actualiser la progression</button>
        <button class="btn btn-surface" id="course-quiz-import" type="button" aria-haspopup="dialog">Importer l’historique de cet appareil</button>
      </div>
      <div id="course-quiz-sync-archives"></div>
      <p id="course-quiz-action-message" role="status"></p>
      <details id="course-quiz-cache-info">
        <summary>Données conservées sur cet appareil</summary>
        <p>Les données de ce compte restent sur cet appareil après déconnexion pour permettre une reprise. Le cache n’est pas chiffré. Utilise un profil de navigateur privé sur un appareil partagé.</p>
      </details>
    </div>
    <dialog class="course-quiz-import-dialog" aria-labelledby="course-quiz-import-title">
      <h2 id="course-quiz-import-title">Importer les cours et QCM locaux</h2>
      <p>Cette sauvegarde vient du mode visiteur de cet appareil. Elle peut appartenir à quelqu’un d’autre. Confirme uniquement si cet historique est le tien.</p>
      <div id="course-quiz-import-preview"></div>
      <p id="course-quiz-import-message" role="status"></p>
      <div class="course-quiz-actions">
        <button class="btn btn-surface btn-surface--accent" id="course-quiz-import-confirm" type="button">Confirmer l’import</button>
        <button class="btn btn-surface" id="course-quiz-import-cancel" type="button" autofocus>Annuler</button>
      </div>
      <p>La sauvegarde visiteur d’origine et ses archives restent conservées.</p>
    </dialog>`;
  const select = id => root.querySelector(`#${id}`);
  const dialog = root.querySelector('dialog');
  const refresh = select('course-quiz-refresh'), startImport = select('course-quiz-import');
  const status = select('course-quiz-sync-status'), detail = select('course-quiz-sync-detail');
  const confirm = select('course-quiz-import-confirm');
  const controller = new AbortController();
  const { signal } = controller;
  let snapshot = service.getState(), preview = null, archivesMarkup = '', refreshing = false;
  const activeSource = () => `${snapshot.mode}:${snapshot.scope}:${snapshot.sync.state === 'session'}`;
  let source = activeSource(), generation = 0;
  const active = current => !signal.aborted && current === generation;
  const announce = message => select('course-quiz-action-message').textContent = message || '';
  const unsubscribe = service.subscribe(state => {
    snapshot = state;
    if (source !== activeSource()) {
      source = activeSource(); generation++; preview = null;
      refreshing = false; startImport.disabled = false;
      if (dialog.open) dialog.close();
      announce('');
    }
    const visitor = state.mode === 'visitor';
    const usable = state.mode === 'personal' && state.sync.state !== 'session';
    const pending = state.sync.pending || 0;
    const label = `${visitor ? labels.visitor : labels[state.sync.state] || labels.session}${pending ? ` · ${pending} opération${pending > 1 ? 's' : ''} en attente` : ''}`;
    status.dataset.state = visitor ? 'visitor' : state.sync.state;
    if (status.textContent !== label) status.textContent = label;
    detail.textContent = state.view.error || state.sync.error || '';
    detail.hidden = !detail.textContent;
    refresh.hidden = visitor; startImport.hidden = !usable; refresh.disabled = refreshing;
    select('course-quiz-cache-info').hidden = !usable;
    const markup = `${(state.sync.conflicts || []).map(conflictMarkup).join('')}${state.sync.operations?.length ? `<details><summary>Opérations refusées conservées sur cet appareil (${state.sync.operations.length})</summary><p>Ces opérations ne sont pas réessayées automatiquement. Leurs données et leur diagnostic restent conservés.</p></details>` : ''}${state.sync.imports?.length ? '<p class="course-quiz-import-state">Import local conservé. Les opérations encore en attente sont incluses dans le suivi de synchronisation ci-dessus.</p>' : ''}`;
    if (markup !== archivesMarkup) {
      const container = select('course-quiz-sync-archives');
      const opened = new Set([...container.querySelectorAll('details[open][data-conflict]')].map(item => item.dataset.conflict));
      const focused = container.contains(document.activeElement) ? document.activeElement : null;
      const focusId = focused?.dataset.courseResolve, focusChoice = focused?.dataset.choice;
      const summaryId = focused?.closest('summary')?.parentElement.dataset.conflict;
      container.innerHTML = markup; archivesMarkup = markup;
      container.querySelectorAll('details[data-conflict]').forEach(item => item.open = opened.has(item.dataset.conflict));
      if (focusId) container.querySelector(`[data-course-resolve="${CSS.escape(focusId)}"][data-choice="${CSS.escape(focusChoice)}"]`)?.focus({ preventScroll: true });
      else if (summaryId) container.querySelector(`[data-conflict="${CSS.escape(summaryId)}"] summary`)?.focus({ preventScroll: true });
    }
  });
  refresh.addEventListener('click', async () => {
    const current = generation; refreshing = true; refresh.disabled = true; announce('Actualisation en cours…');
    try { await service.retry(); if (active(current)) announce(''); }
    catch { if (active(current)) announce('L’actualisation reste indisponible. Les données enregistrées sont conservées.'); }
    finally { if (active(current)) { refreshing = false; refresh.disabled = false; } }
  }, { signal });
  startImport.addEventListener('click', async () => {
    if (snapshot.mode !== 'personal' || snapshot.sync.state === 'session') return;
    const current = generation; startImport.disabled = true;
    try {
      const value = await service.previewImport();
      if (!active(current)) return;
      preview = value; const summary = value.summary || {};
      select('course-quiz-import-preview').innerHTML = `<dl class="course-quiz-import-summary"><div><dt>Cours terminés</dt><dd>${summary.courses || 0}</dd></div><div><dt>Tentatives QCM exploitables</dt><dd>${summary.attempts || 0}</dd></div><div><dt>Scores anciens sans tentative datée</dt><dd>${summary.legacyScores || 0}</dd></div></dl>${value.warnings?.length ? `<p>Données partielles ou non importables :</p><ul>${value.warnings.map(item => `<li>${clean(typeof item === 'string' ? item : item.message || JSON.stringify(item))}</li>`).join('')}</ul>` : ''}`;
      select('course-quiz-import-message').textContent = value.error || (!value.available ? 'Aucun historique exploitable n’est disponible pour cet import.' : 'Aucun envoi n’a lieu avant ta confirmation.');
      confirm.disabled = !!value.error || !value.available;
      dialog.showModal();
    } catch { if (active(current)) announce('Impossible de lire l’historique local. La sauvegarde d’origine reste conservée.'); }
    finally { if (active(current)) startImport.disabled = false; }
  }, { signal });
  select('course-quiz-import-cancel').addEventListener('click', () => dialog.close(), { signal });
  dialog.addEventListener('close', () => {
    preview = null;
    if (!startImport.hidden) startImport.focus({ preventScroll: true });
  }, { signal });
  confirm.addEventListener('click', async () => {
    if (!preview) return;
    const requested = preview; confirm.disabled = true;
    try {
      const result = await service.confirmImport(requested);
      if (signal.aborted || requested !== preview || !dialog.open) return;
      if (result.error) { select('course-quiz-import-message').textContent = result.error; return; }
      dialog.close();
      announce(result.replayed ? 'Cet import était déjà enregistré. Aucun nouvel historique n’a été créé.' : 'Import enregistré sur cet appareil. Le suivi indique les opérations restant à synchroniser.');
    } catch {
      if (!signal.aborted && requested === preview && dialog.open)
        select('course-quiz-import-message').textContent = 'Import indisponible. Rouvre l’aperçu pour réessayer.';
    }
  }, { signal });
  root.addEventListener('click', async event => {
    const button = event.target.closest('[data-course-resolve]');
    if (!button) return;
    const wasFocused = document.activeElement === button;
    const current = generation; button.disabled = true;
    try {
      const result = await service.resolveConflict(button.dataset.courseResolve, button.dataset.choice);
      if (active(current)) {
        announce(result?.error || 'Résolution enregistrée. Les intentions précédentes restent archivées.');
        if (!result?.error && (root.contains(document.activeElement) || wasFocused && document.activeElement === document.body))
          refresh.focus({ preventScroll: true });
      }
    } catch {
      if (active(current)) announce('Résolution indisponible. Réessaie dans un instant.');
    } finally { if (button.isConnected) button.disabled = false; }
  }, { signal });
  return () => {
    controller.abort();
    unsubscribe();
    if (dialog.open) dialog.close();
  };
}
