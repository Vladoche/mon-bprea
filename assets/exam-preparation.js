import { units, lessons } from './content.js';
import { loadCalendar, parseDate, todayKey, daysBetween } from './calendar-data.js';
import { getUnitExamStats } from './exam-stats.js';

const clean = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const percent = value => `${Math.round(value)} %`;
const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const formatDate = key => dateFormat.format(parseDate(key));

function metrics(unit, progress) {
  if (!unit) return '<p class="exam-data-note">L’UC de cet examen n’est pas renseignée : les statistiques ne peuvent pas être associées.</p>';
  const stats = getUnitExamStats(unit.id, lessons, progress);
  const completion = stats.completionPercent === null ? '—' : percent(stats.completionPercent);
  const success = stats.successRate === null ? '—' : percent(stats.successRate);
  const preparation = stats.preparationIndex === null ? '—' : `${Math.round(stats.preparationIndex)} / 100`;
  const historyNotes = [];
  if (stats.legacyScores.length) historyNotes.push('Historique partiel : les anciens meilleurs scores restent conservés et comptent pour les exercices terminés. Le taux de réussite utilise uniquement les tentatives historisées depuis cette mise à jour.');
  if (stats.hasInvalidHistory) historyNotes.push('Certaines données enregistrées sont inexploitables : elles restent conservées et sont exclues du calcul.');
  return `<div class="exam-metrics">
    <div class="exam-metric"><span>Exercices terminés</span><strong>${completion}</strong><small>${stats.availableQuestions ? `${stats.completedQuestions} / ${stats.availableQuestions} questions, dans les QCM corrigés` : 'Aucun exercice disponible pour cette UC'}</small>${stats.completionPercent === null ? '' : `<progress max="100" value="${stats.completionPercent}" aria-label="Exercices terminés pour ${clean(unit.code)}">${completion}</progress>`}</div>
    <div class="exam-metric"><span>Taux de réussite</span><strong>${success}</strong><small>${stats.answeredQuestions ? `${stats.correctAnswers} / ${stats.answeredQuestions} réponses correctes · ${stats.attemptCount} tentative${stats.attemptCount > 1 ? 's' : ''} historisée${stats.attemptCount > 1 ? 's' : ''}` : 'Aucune tentative historisée pour cette UC'}</small></div>
    <div class="exam-metric"><span>Indice indicatif de préparation</span><strong>${preparation}</strong><small>${stats.preparationIndex === null ? 'Données insuffisantes pour calculer un indice' : 'Part des exercices terminés × taux de réussite observé'}</small></div>
  </div><p class="exam-method">Cet indice est un repère de révision, jamais une probabilité de réussir l’examen. Il porte uniquement sur les QCM disponibles, sans évaluer la pratique ni l’oral.</p>
  ${historyNotes.length ? `<p class="exam-data-note">${historyNotes.join(' ')}</p>` : ''}`;
}

export async function initExamPreparation(root, getProgress) {
  root.innerHTML = '<p class="exam-loading" role="status">Chargement de la prochaine période d’examen…</p>';
  let data;
  let displayedDay;
  function render() {
    displayedDay = todayKey();
    if (data.error) {
      root.innerHTML = `<div class="exam-empty"><div><span class="eyebrow">PRÉPARATION AUX EXAMENS</span><h2 id="exam-heading">Calendrier indisponible</h2><p>Impossible de consulter les dates d’examen pour le moment. Tes résultats restent conservés sur cet appareil.</p></div><button class="btn btn-outline" type="button" id="retry-exam-calendar">Réessayer</button></div>`;
      root.querySelector('#retry-exam-calendar').addEventListener('click', async () => {
        root.innerHTML = '<p class="exam-loading" role="status">Chargement des dates…</p>';
        data = await loadCalendar();
        render();
      });
      return;
    }
    const exams = data.events.filter(event => event.type === 'examen' && !event.example && event.end >= displayedDay)
      .sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
    const exam = exams[0];
    const warning = data.warnings.length ? '<p class="exam-data-note">Certaines entrées du calendrier sont incomplètes ou invalides. Les informations affichées peuvent être partielles.</p>' : '';
    if (!exam) {
      root.innerHTML = `<div class="exam-empty"><div><span class="eyebrow">PRÉPARATION AUX EXAMENS</span><h2 id="exam-heading">Chaque étape se prépare à ton rythme.</h2><p>Aucune période d’examen en cours ou à venir n’est enregistrée. Le suivi de préparation apparaîtra lorsqu’une date sera renseignée.</p></div><a class="btn btn-outline" href="calendrier.html">Consulter le calendrier <span aria-hidden="true">→</span></a></div>${warning}`;
      return;
    }
    const unit = units.find(item => item.id === exam.unit);
    const remaining = daysBetween(displayedDay, exam.start);
    const countdown = remaining < 0 ? 'En cours' : remaining === 0 ? 'Début aujourd’hui' : `J − ${remaining}`;
    const period = exam.start === exam.end ? `Le ${formatDate(exam.start)}` : `Du ${formatDate(exam.start)} au ${formatDate(exam.end)}`;
    const concurrent = exams.filter(item => item.id !== exam.id && (remaining <= 0 ? item.start <= displayedDay : item.start === exam.start)).length;
    root.innerHTML = `<div class="exam-banner-top"><div class="exam-intro"><span class="eyebrow">${remaining < 0 ? 'PÉRIODE D’EXAMEN EN COURS' : 'PROCHAINE PÉRIODE D’EXAMEN'}</span><h2 id="exam-heading">${clean(exam.title)}</h2><p>${unit ? `<a class="text-link" href="uc.html?id=${encodeURIComponent(unit.id)}">${clean(unit.code)}</a> · ` : 'UC non renseignée · '}${period}</p></div><div class="exam-countdown"><strong>${countdown}</strong><span>${remaining > 0 ? `jour${remaining > 1 ? 's' : ''} avant le début` : 'Période enregistrée au calendrier'}</span></div><a class="text-link exam-calendar-link" href="calendrier.html?month=${exam.start.slice(0, 7)}">Voir le calendrier <span aria-hidden="true">→</span></a></div>
      ${metrics(unit, getProgress())}${concurrent ? `<p class="exam-data-note">${concurrent} autre${concurrent > 1 ? 's' : ''} période${concurrent > 1 ? 's' : ''} d’examen ${remaining <= 0 ? 'en cours' : 'prévue' + (concurrent > 1 ? 's' : '') + ' à la même date'} : consulte le calendrier pour toutes les UC.</p>` : ''}${warning}`;
  }
  data = await loadCalendar();
  render();
  // Relire les résultats au retour sur l’accueil, y compris depuis un autre onglet.
  window.addEventListener('storage', event => {
    if (event.key === 'bprea-demo-progress-v1' || event.key === null) render();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  window.addEventListener('pageshow', render);
  window.setInterval(() => { if (!document.hidden && displayedDay !== todayKey()) render(); }, 60000);
}
