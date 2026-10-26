import { units, lessons } from './content.js';
import { loadCalendar, parseDate, todayKey, daysBetween, selectUpcomingExams } from './calendar-data.js';
import { getUnitExamStats } from './exam-stats.js';
import { getDrillSyncService } from './drill-sync-service.js';
import { readDashboardData } from './dashboard-data.js';
import { getParisWeek, getSeriesStats, getDrillUnitStats } from './drill-engine.js';

const clean = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const percent = value => `${Math.round(value)} %`;
const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const formatDate = key => dateFormat.format(parseDate(key));

function metrics(unit, courseSnapshot, drillSnapshot) {
  if (!unit) return '<p class="exam-data-note">L’UC de cet examen n’est pas renseignée : les statistiques ne peuvent pas être associées.</p>';
  const available = courseSnapshot && ['visitor','personal'].includes(courseSnapshot.mode) && !courseSnapshot.view.error && courseSnapshot.sync.state !== 'session';
  if (!available) return `<p class="exam-data-note">Statistiques QCM indisponibles : ${clean(courseSnapshot?.view?.error || 'la source personnelle doit être vérifiée.')}</p>${drillMetrics(unit, drillSnapshot, courseSnapshot)}`;
  const stats = getUnitExamStats(unit.id, lessons, courseSnapshot.view.progress);
  const completion = stats.completionPercent === null ? '—' : percent(stats.completionPercent);
  const success = stats.successRate === null ? '—' : percent(stats.successRate);
  const preparation = stats.preparationIndex === null ? '—' : `${Math.round(stats.preparationIndex)} / 100`;
  const historyNotes = [];
  if (stats.legacyScores.length) historyNotes.push('Historique partiel : les anciens meilleurs scores restent conservés et comptent pour les exercices terminés. Le taux de réussite utilise uniquement les tentatives historisées depuis cette mise à jour.');
  if (stats.hasInvalidHistory) historyNotes.push('Certaines données enregistrées sont inexploitables : elles restent conservées et sont exclues du calcul.');
  return `<div class="exam-metrics">
    <div class="exam-metric"><span>QCM de cours terminés</span><strong>${completion}</strong><small>${stats.availableQuestions ? `${stats.completedQuestions} / ${stats.availableQuestions} questions, dans les QCM corrigés` : 'Aucun exercice disponible pour cette UC'}</small>${stats.completionPercent === null ? '' : `<progress max="100" value="${stats.completionPercent}" aria-label="Exercices terminés pour ${clean(unit.code)}">${completion}</progress>`}</div>
    <div class="exam-metric"><span>Réussite aux QCM de cours</span><strong>${success}</strong><small>${stats.answeredQuestions ? `${stats.correctAnswers} / ${stats.answeredQuestions} réponses correctes · ${stats.attemptCount} tentative${stats.attemptCount > 1 ? 's' : ''} historisée${stats.attemptCount > 1 ? 's' : ''}` : 'Aucune tentative historisée pour cette UC'}</small></div>
    <div class="exam-metric"><span>Indice indicatif de préparation</span><strong>${preparation}</strong><small>${stats.preparationIndex === null ? 'Données insuffisantes pour calculer un indice' : 'Part des exercices terminés × taux de réussite observé'}</small></div>
  </div><p class="exam-method">Cet indice est un repère de révision, jamais une probabilité de réussir l’examen. Il porte uniquement sur les QCM disponibles, sans évaluer la pratique ni l’oral.</p>
  ${historyNotes.length ? `<p class="exam-data-note">${historyNotes.join(' ')}</p>` : ''}${drillMetrics(unit, drillSnapshot, courseSnapshot)}`;
}

function drillMetrics(unit, snapshot, courseSnapshot) {
  const compatible = courseSnapshot?.mode === 'visitor' ? snapshot?.mode === 'visitor' : courseSnapshot?.mode === 'personal' && snapshot?.mode === 'personal' && snapshot.scope === courseSnapshot.scope;
  const state = readDashboardData(compatible ? snapshot : { mode: 'blocked', sync: { state: 'session' } });
  if (!compatible || state.error || state.source.state === 'session') return '<div class="exam-drill"><p>Exercices hebdomadaires indisponibles : leur source doit être vérifiée pour le même espace que les QCM. Aucun résultat d’un autre espace n’est affiché.</p><a class="text-link" href="drill.html">Ouvrir les exercices hebdomadaires →</a></div>';
  const week = getParisWeek();
  const series = state.series[`${unit.id}__${week.id}`];
  const total = getDrillUnitStats(state.series, unit.id);
  const stats = series ? getSeriesStats(series) : null;
  const text = state.error ? 'Le suivi des exercices hebdomadaires ne peut pas être lu pour le moment. Les données restent conservées.'
    : stats ? `${stats.completed} / ${stats.planned} exercices réalisés · ${stats.correct} bonne${stats.correct > 1 ? 's' : ''} réponse${stats.correct > 1 ? 's' : ''} · ${stats.incorrect} mauvaise${stats.incorrect > 1 ? 's' : ''} réponse${stats.incorrect > 1 ? 's' : ''} · Réussite : ${stats.successRate === null ? 'Aucune donnée' : percent(stats.successRate)}.`
      : state.warnings.length ? 'Le suivi des exercices hebdomadaires est partiel : certaines séries enregistrées ne peuvent pas être interprétées.'
      : 'Aucune série d’exercices hebdomadaires commencée cette semaine pour cette UC. Réussite : Aucune donnée.';
  return `<div class="exam-drill"><div><h3>Exercices hebdomadaires · ${week.id}</h3><p>${text}</p>${total.completed ? `<p class="exam-drill-total">Historique des exercices hebdomadaires : ${total.completed} réponses comptabilisées, ${total.trainingAttempts} entraînement${total.trainingAttempts > 1 ? 's' : ''} supplémentaire${total.trainingAttempts > 1 ? 's' : ''}.</p>` : ''}${state.warnings.length ? '<p class="exam-method">Certaines données des exercices hebdomadaires sont inexploitables ; elles sont conservées et exclues du bilan. La page des exercices hebdomadaires détaille ces informations.</p>' : ''}<p class="exam-method">Les exercices hebdomadaires sont suivis séparément des QCM de cours et de l’indice ci-dessus, pour éviter de compter deux fois les mêmes questions.</p></div><a class="text-link" href="drill.html?unit=${encodeURIComponent(unit.id)}">${series ? 'Reprendre les exercices hebdomadaires' : 'Ouvrir les exercices hebdomadaires'} →</a></div>`;
}

export async function initExamPreparation(root, courseService) {
  root.innerHTML = '<p class="exam-loading" role="status">Chargement de la prochaine période d’examen…</p>';
  let data;
  let displayedDay;
  let drillService;
  let drillSnapshot;
  let courseSnapshot = courseService?.getState();
  let lastMarkup = '';
  const disposals = [];
  function replaceMarkup(markup) {
    if (markup === lastMarkup) return;
    const focused = root.contains(document.activeElement) ? document.activeElement : null;
    const focusId = focused?.id, focusHref = focused?.getAttribute('href');
    root.innerHTML = markup; lastMarkup = markup;
    if (focusId) root.querySelector(`#${CSS.escape(focusId)}`)?.focus({ preventScroll: true });
    else if (focusHref) root.querySelector(`a[href="${CSS.escape(focusHref)}"]`)?.focus({ preventScroll: true });
  }
  function render() {
    if (!data || !root.isConnected) return;
    displayedDay = todayKey();
    if (data.error) {
      replaceMarkup(`<div class="exam-empty"><div><span class="eyebrow">PRÉPARATION AUX EXAMENS</span><h2 id="exam-heading">Calendrier indisponible</h2><p>Impossible de consulter les dates d’examen pour le moment. Tes résultats restent conservés sur cet appareil.</p></div><button class="btn btn-outline" type="button" id="retry-exam-calendar">Réessayer</button></div>`);
      root.querySelector('#retry-exam-calendar').onclick = async () => {
        root.innerHTML = '<p class="exam-loading" role="status">Chargement des dates…</p>';
        lastMarkup = '';
        data = await loadCalendar();
        render();
      };
      return;
    }
    const exams = selectUpcomingExams(data.events, displayedDay);
    const exam = exams[0];
    const warning = data.warnings.length ? '<p class="exam-data-note">Certaines entrées du calendrier sont incomplètes ou invalides. Les informations affichées peuvent être partielles.</p>' : '';
    if (!exam) {
      replaceMarkup(`<div class="exam-empty"><div><span class="eyebrow">PRÉPARATION AUX EXAMENS</span><h2 id="exam-heading">Chaque étape se prépare à ton rythme.</h2><p>Aucune période d’examen en cours ou à venir n’est enregistrée. Le suivi de préparation apparaîtra lorsqu’une date sera renseignée.</p></div><a class="btn btn-outline" href="calendrier.html">Consulter le calendrier <span aria-hidden="true">→</span></a></div>${warning}`);
      return;
    }
    const unit = units.find(item => item.id === exam.unit);
    const remaining = daysBetween(displayedDay, exam.start);
    const countdown = remaining < 0 ? 'En cours' : remaining === 0 ? 'Début aujourd’hui' : `J − ${remaining}`;
    const period = exam.start === exam.end ? `Le ${formatDate(exam.start)}` : `Du ${formatDate(exam.start)} au ${formatDate(exam.end)}`;
    const concurrent = exams.filter(item => item.id !== exam.id && (remaining <= 0 ? item.start <= displayedDay : item.start === exam.start)).length;
    replaceMarkup(`<div class="exam-banner-top"><div class="exam-intro"><span class="eyebrow">${remaining < 0 ? 'PÉRIODE D’EXAMEN EN COURS' : 'PROCHAINE PÉRIODE D’EXAMEN'}</span><h2 id="exam-heading">${clean(exam.title)}</h2><p>${unit ? `<a class="text-link" href="uc.html?id=${encodeURIComponent(unit.id)}">${clean(unit.code)}</a> · ` : 'UC non renseignée · '}${period}</p></div><div class="exam-countdown"><strong>${countdown}</strong><span>${remaining > 0 ? `jour${remaining > 1 ? 's' : ''} avant le début` : 'Période enregistrée au calendrier'}</span></div><a class="text-link exam-calendar-link" href="calendrier.html?month=${exam.start.slice(0, 7)}">Voir le calendrier <span aria-hidden="true">→</span></a></div>
      ${metrics(unit, courseSnapshot, drillSnapshot)}${concurrent ? `<p class="exam-data-note">${concurrent} autre${concurrent > 1 ? 's' : ''} période${concurrent > 1 ? 's' : ''} d’examen ${remaining <= 0 ? 'en cours' : 'prévue' + (concurrent > 1 ? 's' : '') + ' à la même date'} : consulte le calendrier pour toutes les UC.</p>` : ''}${warning}`);
  }
  if (courseService) disposals.push(courseService.subscribe(snapshot => { courseSnapshot = snapshot; render(); }));
  getDrillSyncService().then(service => {
    if (!root.isConnected) { service.stop(); return; }
    drillService = service;
    disposals.push(service.subscribe(snapshot => { drillSnapshot = snapshot; render(); }));
  }).catch(() => { drillSnapshot = null; render(); });
  window.addEventListener('pagehide', () => { disposals.forEach(dispose => dispose()); drillService?.stop(); }, { once: true });
  data = await loadCalendar();
  render();
  // Relire les résultats au retour sur l’accueil, y compris depuis un autre onglet.
  window.addEventListener('storage', event => {
    if (event.key === 'bprea-demo-progress-v1' || event.key === 'bprea-demo-drill-v1' || event.key === null) render();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  window.addEventListener('pageshow', render);
  let displayedWeek = getParisWeek().id;
  window.setInterval(() => { const week = getParisWeek().id; if (!document.hidden && (displayedDay !== todayKey() || week !== displayedWeek)) { displayedWeek = week; render(); } }, 60000);
}
