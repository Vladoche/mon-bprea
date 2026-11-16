// Présentation uniquement : calendrier, sélection, calculs et sauvegardes restent partagés.
import { units } from './content.js';
import { renderBreadcrumbs } from './breadcrumbs.js';
import { getSeriesStats, getDrillUnitStats } from './drill-engine.js';

export const clean = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
export const pageUrl = (unit, week) => `drill.html?unit=${encodeURIComponent(unit)}&week=${encodeURIComponent(week)}`;
export const periodLabel = week => {
  const start = new Date(`${week.start}T12:00:00Z`), end = new Date(`${week.end}T12:00:00Z`);
  const from = week.start.slice(0, 7) === week.end.slice(0, 7) ? start.getUTCDate() : dateFormat.format(start);
  return `Du ${from} au ${dateFormat.format(end)}`;
};
const rate = value => value === null ? 'Aucune donnée' : `${Math.round(value)} %`;
const symbol = name => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${{
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  warning: '<path d="m12 3 10 18H2L12 3Zm0 7v4m0 4h.01"/>',
}[name]}</svg>`;

export function drillShell() {
  return `<section class="page-top wrap drill-intro">${renderBreadcrumbs('drill')}
    <div class="drill-cover"><div><span class="page-eyebrow">LA PRATIQUE AU FIL DES SEMAINES</span><h1>Exercices hebdomadaires</h1><p>Dix questions par UC, des corrections pour comprendre. Avance à ton rythme et reprends quand tu veux.</p></div><div id="drill-current-week" class="drill-week-strip"></div></div></section>
    <section class="wrap drill-overview" aria-label="Choix de l’unité"><details class="drill-unit-picker" data-drill-detail="units"><summary>Choisir une UC <span id="drill-unit-selection"></span></summary><div class="drill-unit-grid" aria-label="Unités capitalisables" id="drill-unit-grid"></div></details></section>
    <section class="wrap drill-workspace" aria-labelledby="drill-session-title"><div class="drill-series-panel">
      <div id="drill-session-heading"></div><div id="drill-week-notice"></div><div id="drill-notices"></div><div id="drill-summary"></div>
      <div id="drill-sync-panel"></div><div class="drill-save-feedback"><p class="drill-save-status" id="drill-save-status"></p><p id="drill-save-error" role="alert"></p></div></div>
      <div id="drill-session"></div><p class="sr-only" id="drill-announcement" role="status" aria-atomic="true"></p></section>
    <section class="wrap drill-history" aria-labelledby="drill-history-title"><div class="drill-history-heading"><div><span class="eyebrow">CONSERVER LE FIL</span><h2 id="drill-history-title"></h2></div><p>Les semaines passées restent ouvertes.</p></div><div id="drill-history-content"></div></section>
    <aside class="wrap drill-storage-note"><details data-drill-detail="storage"><summary>Comprendre la progression et l’enregistrement</summary><div id="drill-storage-content"></div></details></aside>`;
}

export function weekMarkup(week) {
  return `${symbol('calendar')}<div><span class="eyebrow">SEMAINE EN COURS</span><h2 id="drill-current-title">${week.id}</h2><p>${periodLabel(week)}</p><p>Lundi à 00 h · Europe/Paris</p></div>`;
}

export function unitCard(unit, selectedUnit, currentWeek, bank, state) {
  const count = bank.questions.filter(question => question.unit === unit.id).length;
  const saved = state.series[`${unit.id}__${currentWeek.id}`];
  const known = !state.error && (saved || !state.warnings.length);
  const stats = saved ? getSeriesStats(saved) : null;
  const selected = unit.id === selectedUnit.id;
  const seriesState = !known ? 'Données de progression indisponibles' : !saved ? 'Série non commencée' : stats.completed === stats.planned ? 'Série entièrement réalisée' : stats.completed ? 'Série en cours' : 'Série commencée';
  return `<a class="drill-unit-card ${selected ? 'drill-unit-selected' : ''}" href="${pageUrl(unit.id, currentWeek.id)}" ${selected ? 'aria-current="true"' : ''}><span class="drill-unit-code">${clean(unit.code)}${selected ? '<span>Sélectionnée</span>' : ''}</span><h3>${clean(unit.title)}</h3>
    <span class="drill-bank-state">${bank.error ? 'Banque indisponible' : count < 10 ? 'Banque incomplète' : `${count} questions disponibles`}</span><span class="drill-unit-state">${seriesState}</span>
    ${known && (saved || count >= 10) ? `<span class="drill-unit-results">${stats?.completed || 0} / ${stats?.planned || 10} réalisés${stats ? `<br>${stats.correct} bonnes · ${stats.incorrect} mauvaises${stats.successRate === null ? '' : ` · ${rate(stats.successRate)} de réussite`}` : ''}</span>` : !bank.error && count < 10 ? `<span class="drill-unit-results">${count} / 10 questions distinctes nécessaires</span>` : ''}</a>`;
}

export function sessionHeading(unit, selectedWeek, currentWeek, choices) {
  return `<div class="drill-session-top"><div><span class="eyebrow">${clean(unit.code)} · ${selectedWeek.id === currentWeek.id ? 'SEMAINE ACTUELLE' : 'SEMAINE PRÉCÉDENTE'}</span><h2 id="drill-session-title">${clean(unit.title)}</h2><p>${periodLabel(selectedWeek)} · ${selectedWeek.id}</p></div><label class="drill-week-select">Choisir une semaine<select id="drill-week-select">${choices.map(week => `<option value="${week.id}" ${week.id === selectedWeek.id ? 'selected' : ''}>${week.id}${week.id === currentWeek.id ? ' · actuelle' : ''}</option>`).join('')}</select></label></div>`;
}

export function statsMarkup(stats, known) {
  if (!known) return '<p class="drill-unavailable">Données de progression indisponibles. Aucun résultat n’est supposé.</p>';
  return `<dl class="drill-stats"><div><dt>Exercices réalisés</dt><dd>${stats.completed} <span>/ ${stats.planned}</span></dd></div><div><dt>Bonnes réponses</dt><dd>${stats.correct}</dd></div><div><dt>Mauvaises réponses</dt><dd>${stats.incorrect}</dd></div><div><dt>Taux de réussite</dt><dd class="${stats.successRate === null ? 'drill-no-rate' : ''}">${rate(stats.successRate)}</dd></div></dl>
    <div class="drill-progress"><label for="drill-progress">Exercices réalisés : ${stats.completed} / ${stats.planned}</label><progress id="drill-progress" value="${stats.completed}" max="${stats.planned}"></progress><p>Premières réponses validées uniquement.${stats.trainingAttempts ? ` <span>${stats.trainingAttempts} entraînement${stats.trainingAttempts > 1 ? 's' : ''} supplémentaire${stats.trainingAttempts > 1 ? 's' : ''}, séparément.</span>` : ''}</p></div>`;
}

export function historyMarkup(state, unit) {
  if (state.error) return '<p class="drill-unavailable">Historique indisponible pour le moment. Les données enregistrées restent conservées.</p>';
  const saved = Object.values(state.series).filter(series => series.unit === unit.id).sort((a, b) => b.week.localeCompare(a.week));
  const warning = state.warnings.length ? '<p class="drill-unavailable">Historique partiel : certaines données ne peuvent pas être lues. Elles restent conservées.</p>' : '';
  if (!saved.length) return warning || '<p class="drill-empty-copy">Aucune série commencée pour cette UC. Retrouve ici tes séries dès leur démarrage, même inachevées.</p>';
  const total = getDrillUnitStats(saved, unit.id);
  return `${warning}<p class="drill-history-volume">${total.completed} réponses comptabilisées · ${total.trainingAttempts} tentative${total.trainingAttempts > 1 ? 's' : ''} d’entraînement supplémentaire${total.trainingAttempts > 1 ? 's' : ''}. Les questions laissées de côté ne sont pas des échecs.</p><ul class="drill-history-list">${saved.map(series => {
    const stats = getSeriesStats(series);
    const complete = stats.completed === stats.planned;
    return `<li><a href="${pageUrl(unit.id, series.week)}"><span class="drill-history-week"><strong>${clean(series.week)}</strong><span>${complete ? 'Série terminée' : 'Série incomplète'}</span></span><span class="drill-history-results">${stats.completed} / ${stats.planned} réalisés<br>${stats.correct} bonnes · ${stats.incorrect} mauvaises</span><span>Réussite : ${rate(stats.successRate)}</span><span class="text-link">${complete ? 'Consulter les corrections' : 'Reprendre la série'} →</span></a></li>`;
  }).join('')}</ul>`;
}

function correctionMarkup(question, result) {
  const correctOption = question.options.find(option => option.id === question.answer);
  const givenOption = question.options.find(option => option.id === result.answer);
  const lastTraining = (result.attempts || []).filter(attempt => attempt.training === true).at(-1);
  return `<div class="drill-correction ${result.correct ? 'drill-correct' : 'drill-incorrect'}" id="drill-correction-${clean(question.id)}" tabindex="-1" role="group" aria-labelledby="drill-verdict-${clean(question.id)}"><h4 id="drill-verdict-${clean(question.id)}">${symbol(result.correct ? 'check' : 'warning')}${result.correct ? 'Bonne réponse' : 'À revoir'} <span>· résultat comptabilisé</span></h4>
    <div class="drill-correction-answers"><p>Ta réponse initiale : <strong>${clean(givenOption?.text || result.answer)}</strong></p>${result.correct ? '' : `<p>Réponse attendue : <strong>${clean(correctOption.text)}</strong></p>`}</div><p class="drill-explanation"><strong>Pour comprendre</strong>${clean(question.explanation)}</p>
    ${question.reference ? `<a class="text-link drill-reference" href="${clean(question.reference.url)}" ${/^https?:/.test(question.reference.url) ? 'target="_blank" rel="noopener noreferrer"' : ''}>Revoir : ${clean(question.reference.title)}${/^https?:/.test(question.reference.url) ? ' (nouvel onglet)' : ''} →</a>` : ''}
    ${lastTraining ? `<p class="drill-training-last">Dernier entraînement : <strong>${lastTraining.correct ? 'bonne réponse' : 'réponse à revoir'}</strong>. Le résultat initial reste inchangé.</p>` : ''}</div>`;
}

function answerForm(question, selectedAnswer, training = false) {
  return `<form class="drill-answer-form" data-question="${clean(question.id)}" data-training="${training}"><fieldset><legend><span class="sr-only">${clean(question.prompt)} — </span>${training ? 'Nouvelle tentative d’entraînement' : 'Choisis une seule réponse'}</legend><div class="drill-options">${question.options.map((option, index) => `<label class="option"><input type="radio" name="answer" value="${clean(option.id)}" ${selectedAnswer === option.id ? 'checked' : ''}><span class="option-letter" aria-hidden="true">${String.fromCharCode(65 + index)}</span><span class="option-copy">${clean(option.text)}</span></label>`).join('')}</div></fieldset><div class="drill-answer-actions"><button class="btn ${training ? 'btn-outline' : 'btn-primary'}" type="submit" ${selectedAnswer ? '' : 'disabled'}>${training ? 'Vérifier pour s’entraîner' : 'Valider cette réponse'}</button><p class="drill-question-note">${training ? 'Cet entraînement ne change pas ton résultat initial.' : 'Ton premier choix validé sera comptabilisé.'}</p></div></form>`;
}

export function questionMarkup(question, index, answer, draft, trainingDraft, trainingOpen) {
  return `<div class="drill-question-meta"><span class="eyebrow">QUESTION ${String(index + 1).padStart(2, '0')} / 10</span><span class="drill-question-state">${answer ? 'Résultat comptabilisé' : draft ? 'Brouillon · à valider' : 'À compléter'}</span></div><h3 tabindex="-1">${clean(question.prompt)}</h3><p class="drill-concept"><span>${clean(question.chapter)}</span><span>${clean(question.difficulty)}</span><span>Notion : ${clean(question.concept)}</span></p>
    ${answer ? `${correctionMarkup(question, answer)}${trainingOpen ? `<section class="drill-training" aria-labelledby="drill-training-title-${clean(question.id)}"><h4 id="drill-training-title-${clean(question.id)}">Entraînement supplémentaire</h4>${answerForm(question, trainingDraft, true)}</section>` : `<button class="btn btn-outline drill-train-button" type="button" data-drill-train="${clean(question.id)}">Revoir cette question</button>`}` : answerForm(question, draft)}<p class="drill-answer-error" id="drill-answer-error-${clean(question.id)}" hidden></p>`;
}

export function previewMarkup(unit, week, questions, mode, disabled) {
  return `<div class="drill-preview"><div class="drill-preview-heading"><span class="drill-preparation-icon">${symbol('calendar')}</span><div><span class="eyebrow">À TON RYTHME</span><h3>10 questions pour cette semaine</h3><p>${clean(unit.code)} · ${week.id}</p></div></div><p>Tu peux faire une pause à tout moment. La série garde ses questions et tu retrouves tes choix en revenant ici.</p><p class="drill-question-note">${mode === 'personal' ? 'Enregistrement d’abord sur cet appareil ; la synchronisation vers ton compte est indiquée au-dessus.' : 'En mode visiteur, tes réponses restent dans ce navigateur, sur cet appareil.'}</p><button class="btn btn-primary" type="button" data-drill-start ${disabled ? 'disabled' : ''}>Commencer cette série →</button><details class="drill-preview-details" data-drill-detail="preview" open><summary>Aperçu des 10 questions</summary><ol class="drill-preview-list">${questions.map(question => `<li><strong>${clean(question.prompt)}</strong><span>${clean(question.concept)} · ${clean(question.chapter)}</span></li>`).join('')}</ol></details></div>`;
}

export function storageMarkup(mode) {
  return `<p>Réussite = bonnes premières réponses comptabilisées ÷ exercices réalisés. Sans réponse validée : aucune donnée. Les brouillons et entraînements supplémentaires ne comptent pas dans cette progression. Ce taux ne prédit pas la réussite à l’examen.</p><p>${mode === 'personal' ? 'Réponses sauvegardées d’abord sur cet appareil, puis sur ton compte quand la synchronisation est confirmée. Le cache personnel n’est pas chiffré : sur un appareil partagé, la déconnexion masque les données mais conserve les réponses en attente. Une personne ayant accès au navigateur peut lire ce cache. Hors connexion, seules les séries déjà enregistrées ici restent disponibles.' : 'Réponses et historique conservés dans ce navigateur, sur cet appareil. Effacer les données du navigateur peut les supprimer.'}</p><p>Les séries commencées gardent leur version des questions. Tu peux aussi commencer une série des huit semaines précédentes sans avoir terminé les autres. Les questions actuelles reprennent les cours de démonstration ; elles ne remplacent pas les supports de ton centre de formation.</p>`;
}
