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
  return `<details class="course-quiz-conflict" data-conflict="${clean(conflict.id)}"><summary>Conflit à résoudre · ${clean(titleFor(lessonId || 'QCM'))}</summary><p>${mutable ? `Une autre modification du cours a été enregistrée sur le compte. Ton intention et les opérations dépendantes restent conservées. ${typeof local === 'boolean' ? `Choix local : <strong>${local ? 'terminé' : 'non terminé'}</strong>.` : ''} ${typeof remote === 'boolean' ? `Version du compte : <strong>${remote ? 'terminé' : 'non terminé'}</strong>.` : ''}` : 'Un identifiant de tentative correspond à un autre contenu. Les données restent sur cet appareil. Contacte l’assistance pour examiner le conflit.'}</p>${!conflict.resolved && mutable ? `<div class="course-quiz-actions"><button class="btn btn-surface" type="button" data-course-resolve="${clean(conflict.id)}" data-choice="remote">Garder la version du compte</button><button class="btn btn-surface" type="button" data-course-resolve="${clean(conflict.id)}" data-choice="local">Conserver mon choix</button></div><p>Conserver mon choix crée une nouvelle intention à partir de la révision actuelle. L’ancienne reste archivée.</p>` : ''}</details>`;
}


/** Attention and recovery remain on the pages where the data is used. */
export function initCourseQuizNotice(root, service) {
  root.innerHTML = `<p id="course-quiz-sync-status" role="status" aria-atomic="true"></p>
    <p data-course-quiz-notice-detail hidden></p>
    <div data-course-quiz-conflicts></div>
    <button type="button" class="btn btn-surface" data-course-quiz-retry hidden>Réessayer la sauvegarde</button>
    <a class="ui-link" href="contact.html" hidden>Contact et assistance</a>
    <p data-course-quiz-feedback role="status"></p>`;
  const status = root.querySelector('[role="status"]');
  const detail = root.querySelector('[data-course-quiz-notice-detail]');
  const conflicts = root.querySelector('[data-course-quiz-conflicts]');
  const feedback = root.querySelector('[data-course-quiz-feedback]');
  const retry = root.querySelector('[data-course-quiz-retry]');
  const support = root.querySelector('a');
  const controller = new AbortController();
  const { signal } = controller;
  const errors = ['offline', 'session', 'error', 'storage-error'];
  let scope, generation = 0, markup = '';
  const unsubscribe = service.subscribe(state => {
    const sync = state.sync;
    const nextScope = `${state.mode}:${state.scope}:${sync.state === 'session'}`;
    if (scope !== nextScope) { scope = nextScope; generation++; feedback.textContent = ''; }
    const active = (sync.conflicts || []).filter(conflict => !conflict.resolved);
    const attention = errors.includes(sync.state) || sync.state === 'pending' || sync.state === 'conflict' ||
      sync.pending > 0 || active.length > 0 || sync.operations?.length > 0 || !!state.view.error && sync.state !== 'loading';
    const label = state.view.error && !['session', 'storage-error', 'error'].includes(sync.state)
      ? 'Progression indisponible · données conservées' : labels[sync.state] || labels.session;
    const text = `${label}${sync.pending ? ` · ${sync.pending} opération${sync.pending > 1 ? 's' : ''} en attente` : ''}`;
    if (status.textContent !== text) status.textContent = text;
    detail.textContent = state.view.error || sync.error || '';
    detail.hidden = !detail.textContent;
    const next = active.map(conflictMarkup).join('');
    if (markup !== next) {
      const opened = [...conflicts.querySelectorAll('details[open]')].map(item => item.dataset.conflict);
      conflicts.innerHTML = markup = next;
      conflicts.querySelectorAll('details').forEach(item => { item.open = opened.includes(item.dataset.conflict); });
    }
    retry.hidden = !errors.includes(sync.state);
    support.hidden = !['error', 'storage-error', 'conflict'].includes(sync.state) && !active.length && !sync.operations?.length;
    root.hidden = !attention;
  });
  retry.addEventListener('click', async () => {
    const current = generation;
    const wasFocused = document.activeElement === retry;
    retry.disabled = true;
    feedback.textContent = '';
    try { await service.retry(); }
    catch { if (!signal.aborted && current === generation) feedback.textContent = 'La sauvegarde est indisponible. Les données enregistrées sont conservées.'; }
    finally {
      retry.disabled = false;
      if (wasFocused && (retry.hidden || root.hidden) && document.activeElement === document.body)
        document.getElementById('app-main').focus({ preventScroll: true });
    }
  }, { signal });
  conflicts.addEventListener('click', async event => {
    const button = event.target.closest('[data-course-resolve]');
    if (!button) return;
    const current = generation;
    button.disabled = true;
    try {
      const result = await service.resolveConflict(button.dataset.courseResolve, button.dataset.choice);
      if (signal.aborted || current !== generation) return;
      feedback.textContent = result?.error || '';
      if (!button.isConnected && document.activeElement === document.body)
        (conflicts.querySelector('summary') || document.getElementById('app-main')).focus({ preventScroll: true });
    } catch { if (!signal.aborted && current === generation) feedback.textContent = 'La résolution est indisponible. Réessaie dans un instant.'; }
    finally { if (button.isConnected) button.disabled = false; }
  }, { signal });
  return () => { controller.abort(); unsubscribe(); };
}
