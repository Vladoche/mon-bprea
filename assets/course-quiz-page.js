import { renderBreadcrumbs } from './breadcrumbs.js';

const clean = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const courseUrl = id => `cours.html?id=${encodeURIComponent(id)}`;

// Presentation only: answers, grading and persistence stay in app.js/the service.
export function renderQuizPage(lesson, icon) {
  return `<section class="page-top wrap quiz-intro">${renderBreadcrumbs('quiz', { lesson })}
    <div class="quiz-cover"><div><span class="page-eyebrow">RÉVISION · ${lesson.quiz.length} QUESTIONS</span><h1>QCM du cours</h1><p class="quiz-course-title">${clean(lesson.title)}</p><p>Prends le temps de choisir, puis découvre les explications du corrigé.</p></div><a class="quiz-course-link" href="${courseUrl(lesson.id)}">${icon('book', 19)} Revoir le cours</a></div></section>
    <section class="wrap quiz-layout" aria-label="Questions et résultats du QCM"><div class="quiz-main">
      <div class="quiz-entry-progress"><div><span class="eyebrow">TES RÉPONSES</span><p id="quiz-answer-count">0 réponses sur ${lesson.quiz.length} renseignées</p></div><progress id="quiz-answer-progress" value="0" max="${lesson.quiz.length}" aria-labelledby="quiz-answer-count"></progress></div>
      <div id="quiz-questions">${lesson.quiz.map((q, i) => `<fieldset class="question" data-question="${i}"><legend><span>QUESTION ${String(i + 1).padStart(2, '0')}</span>${clean(q.q)}</legend><div class="quiz-options">${q.options.map((option, j) => `<label class="option"><input type="radio" name="q${i}" value="${j}"/><span class="option-letter" aria-hidden="true">${String.fromCharCode(65 + j)}</span><span class="option-copy">${clean(option)}<span class="option-verdict" hidden></span></span></label>`).join('')}</div><div class="explanation" id="explain-${i}" hidden></div></fieldset>`).join('')}</div>
      <div class="quiz-action-panel"><p id="quiz-check-hint">Réponds aux questions pour accéder au corrigé.</p><div class="quiz-controls"><button id="check-quiz" class="btn btn-surface btn-surface--accent" type="button" aria-describedby="quiz-check-hint" disabled>Corriger mes réponses ${icon('arrow', 18)}</button><button id="retry-quiz" class="btn btn-surface" type="button" hidden>Recommencer</button></div></div>
      <div id="quiz-result" tabindex="-1" aria-labelledby="quiz-result-title"></div>
      <section class="quiz-history-panel" aria-labelledby="quiz-history-title"><span class="eyebrow">TON PARCOURS</span><h2 id="quiz-history-title">Mes tentatives QCM</h2><p id="quiz-history-source"></p><div id="quiz-history"></div></section>
      <a class="quiz-course-link quiz-return" href="${courseUrl(lesson.id)}">${icon('book', 19)} Retour au cours</a></div>
    <aside class="quiz-aside" aria-label="Repères de révision"><section class="quiz-best-card"><span class="eyebrow">MEILLEUR SCORE CONNU</span><h2>Ton repère personnel</h2><div class="big-ratio"><span id="quiz-best-score">—</span><span> / ${lesson.quiz.length}</span></div><p id="quiz-best-detail"></p><p data-progress-source></p></section><section class="quiz-advice"><span class="quiz-advice-icon" aria-hidden="true">${icon('leaf', 23)}</span><h2>Comprendre avant de retenir.</h2><p>Essaie de justifier ton choix avant de lire la correction. Relis ensuite les explications, même si ta réponse est juste.</p><p class="quiz-disclaimer">Un repère pour réviser, sans évaluation officielle.</p></section></aside></section>`;
}

export function renderQuizResult(attempt) {
  return `<section class="quiz-result-box" aria-labelledby="quiz-result-title"><span class="eyebrow">RÉSULTAT CALCULÉ</span><h2 id="quiz-result-title">${attempt.score} / ${attempt.total} bonnes réponses</h2><p class="quiz-result-counts">${attempt.total - attempt.score} réponse${attempt.total - attempt.score > 1 ? 's' : ''} incorrecte${attempt.total - attempt.score > 1 ? 's' : ''}</p><p>${attempt.score === attempt.total ? 'Toutes tes réponses sont justes. Relis les explications pour consolider tes acquis.' : 'Appuie-toi sur les corrections pour repérer ce que tu peux retravailler.'}</p><div class="quiz-save"><p id="quiz-save-status" role="status" aria-atomic="true"></p><p id="quiz-save-error" role="alert" hidden></p><button class="btn btn-surface" type="button" id="retry-quiz-save" hidden>Réessayer l’enregistrement</button></div><p class="quiz-disclaimer">Résultat pédagogique indicatif. Tu peux recommencer avec le bouton au-dessus.</p></section>`;
}

// A local commit proves no remote write. Only the service can confirm sync.
export function quizSaveStatus(state) {
  if (state.mode === 'visitor') return 'Mode visiteur : sauvegarde locale uniquement.';
  if (state.mode !== 'personal' || state.view.error || state.sync.state === 'session') return 'La vérification du compte est indisponible. Le résultat enregistré sur cet appareil est conservé.';
  if (state.sync.state === 'synced' && !state.sync.pending) return 'Synchronisation vers le compte confirmée.';
  if (state.sync.state === 'syncing') return 'Synchronisation vers le compte en cours. Le résultat est conservé sur cet appareil.';
  if (['error', 'conflict', 'storage-error'].includes(state.sync.state)) return 'Synchronisation vers le compte non confirmée. Consulte le suivi dans Mon profil ; le résultat local est conservé.';
  return 'Synchronisation vers le compte en attente. Le résultat est conservé sur cet appareil.';
}
