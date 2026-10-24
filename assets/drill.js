import { units } from './content.js';
import { renderBreadcrumbs } from './breadcrumbs.js';
import { loadDrillBank } from './drill-bank.js';
import { getParisWeek, parseWeek, shiftWeek, nextParisWeekAt, selectWeeklyQuestions, getSeriesStats, getDrillUnitStats } from './drill-engine.js';
import { getDrillSyncService } from './drill-sync-service.js';
import { syncPanelMarkup } from './drill-sync-ui.js';

const clean = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const dateLabel = key => dateFormat.format(new Date(`${key}T12:00:00Z`));
const rate = value => value === null ? 'Aucune donnée' : `${Math.round(value)} %`;
const seriesId = (unit, week) => `${unit}__${week}`;
const pageUrl = (unit, week) => `drill.html?unit=${encodeURIComponent(unit)}&week=${encodeURIComponent(week)}`;
const periodLabel = week => `Du ${dateLabel(week.start)} au ${dateLabel(week.end)}`;

function statsMarkup(stats, className = '') {
  return `<dl class="drill-stats ${className}"><div><dt>Exercices réalisés</dt><dd>${stats.completed} <span>/ ${stats.planned}</span></dd></div><div><dt>Bonnes réponses</dt><dd>${stats.correct}</dd></div><div><dt>Mauvaises réponses</dt><dd>${stats.incorrect}</dd></div><div><dt>Taux de réussite</dt><dd>${rate(stats.successRate)}</dd></div></dl>`;
}

export async function initDrill(root) {
  root.innerHTML = `<section class="page-top wrap">${renderBreadcrumbs('drill')}<h1>Exercices hebdomadaires</h1><p role="status">Chargement des exercices de la semaine…</p></section>`;
  const [loadedBank, store] = await Promise.all([loadDrillBank(), getDrillSyncService()]);
  let bank = loadedBank;
  let state = store.getState().view;
  let renderedData = '';
  let currentWeek = getParisWeek();
  const query = new URLSearchParams(location.search);
  const selectedUnit = units.find(unit => unit.id === query.get('unit')) || units.find(unit => bank.questions.filter(question => question.unit === unit.id).length >= 10) || units[2];
  const requestedWeek = parseWeek(query.get('week'));
  let selectedWeek = requestedWeek && requestedWeek.ordinal <= currentWeek.ordinal ? requestedWeek : currentWeek;
  const activeTraining = new Set();
  let pending = false;
  let timer;
  let latestMessage = '';
  let errorMessage = '';
  let unitPickerOpen = false;
  const storedSeries = () => state.series[seriesId(selectedUnit.id, selectedWeek.id)];

  function unitCard(unit) {
    const count = bank.questions.filter(question => question.unit === unit.id).length;
    const saved = state.series[seriesId(unit.id, currentWeek.id)];
    const stats = saved ? getSeriesStats(saved) : { planned: 10, completed: 0, correct: 0, incorrect: 0, successRate: null };
    const available = saved || count >= 10;
    return `<a class="drill-unit-card ${unit.id === selectedUnit.id ? 'drill-unit-selected' : ''}" href="${pageUrl(unit.id, currentWeek.id)}" ${unit.id === selectedUnit.id ? 'aria-current="true"' : ''}><span class="eyebrow">${clean(unit.code)}</span><h2>${clean(unit.title)}</h2>${available ? `<span class="drill-unit-state">Série de la semaine · ${stats.completed} / 10 réalisés</span><span class="drill-unit-results">${stats.correct} bonne${stats.correct > 1 ? 's' : ''} · ${stats.incorrect} mauvaise${stats.incorrect > 1 ? 's' : ''} · Réussite : ${rate(stats.successRate)}</span>` : `<span class="drill-unit-state">${bank.error ? 'Banque indisponible' : 'Banque incomplète'}</span><span class="drill-unit-results">${count} / 10 questions exploitables au minimum</span>`}</a>`;
  }

  function historyMarkup() {
    const saved = Object.values(state.series).filter(series => series.unit === selectedUnit.id).sort((a, b) => b.week.localeCompare(a.week));
    if (!saved.length) return '<p class="drill-empty-copy">Aucune série commencée pour cette UC. Les séries commencées resteront accessibles ici, même inachevées.</p>';
    const total = getDrillUnitStats(saved, selectedUnit.id);
    return `<p class="drill-history-volume">${total.completed} réponses comptabilisées · ${total.trainingAttempts} tentative${total.trainingAttempts > 1 ? 's' : ''} d’entraînement supplémentaire${total.trainingAttempts > 1 ? 's' : ''}. Aucune question laissée de côté n’est comptée comme un échec.</p><ul class="drill-history-list">${saved.map(series => {
      const stats = getSeriesStats(series);
      return `<li><a href="${pageUrl(selectedUnit.id, series.week)}"><strong>${clean(series.week)}</strong><span>${stats.completed} / ${stats.planned} réalisés · ${stats.correct} bonnes · ${stats.incorrect} mauvaises</span><span>Réussite : ${rate(stats.successRate)}</span><span class="text-link">${stats.completed === stats.planned ? 'Consulter les corrections' : 'Reprendre la série'} →</span></a></li>`;
    }).join('')}</ul>`;
  }

  function correctionMarkup(question, result) {
    const correctOption = question.options.find(option => option.id === question.answer);
    const givenOption = question.options.find(option => option.id === result.answer);
    const trainings = (result.attempts || []).filter(attempt => attempt.training === true);
    const lastTraining = trainings[trainings.length - 1];
    return `<div class="drill-correction ${result.correct ? 'drill-correct' : 'drill-incorrect'}" id="drill-correction-${clean(question.id)}" tabindex="-1"><h4>${result.correct ? 'Bonne réponse' : 'À revoir'} <span>· résultat comptabilisé</span></h4><p>Ta réponse : <strong>${clean(givenOption?.text || result.answer)}</strong></p>${result.correct ? '' : `<p>Réponse attendue : <strong>${clean(correctOption.text)}</strong></p>`}<p>${clean(question.explanation)}</p>${question.reference ? `<a class="text-link" href="${clean(question.reference.url)}" ${/^https?:/.test(question.reference.url) ? 'target="_blank" rel="noopener noreferrer"' : ''}>Revoir : ${clean(question.reference.title)}${/^https?:/.test(question.reference.url) ? ' (nouvel onglet)' : ''} →</a>` : ''}${lastTraining ? `<p class="drill-training-last">Dernier entraînement : ${lastTraining.correct ? 'bonne réponse' : 'réponse à revoir'}. Le résultat de la série reste inchangé.</p>` : ''}</div>`;
  }

  function answerForm(question, selectedAnswer, training = false) {
    return `<form class="drill-answer-form" data-question="${clean(question.id)}" data-training="${training}"><fieldset><legend><span class="sr-only">${clean(question.prompt)} — </span>${training ? 'Nouvelle tentative d’entraînement' : 'Choisis une seule réponse'}</legend>${question.options.map((option, index) => `<label class="option"><input type="radio" name="answer" value="${clean(option.id)}" ${selectedAnswer === option.id ? 'checked' : ''} /><span class="option-letter" aria-hidden="true">${String.fromCharCode(65 + index)}</span><span>${clean(option.text)}</span></label>`).join('')}</fieldset><button class="btn ${training ? 'btn-outline' : 'btn-primary'}" type="submit" ${selectedAnswer ? '' : 'disabled'}>${training ? 'Vérifier pour s’entraîner' : 'Valider cette réponse'}</button>${training ? '<p class="drill-question-note">Cette tentative s’ajoute au volume d’entraînement. Elle ne change pas le résultat comptabilisé.</p>' : '<p class="drill-question-note">La première réponse validée compte pour cette série. Tu pourras ensuite t’entraîner à nouveau.</p>'}</form>`;
  }

  function sessionMarkup(series, questions) {
    if (!series) return `<div class="drill-preview"><p>Voici les 10 questions prévues. Tu peux faire une pause à tout moment : la série et tes choix seront enregistrés sur cet appareil dès le démarrage.</p><button class="btn btn-primary" type="button" data-drill-start ${state.error ? 'disabled' : ''}>Commencer cette série →</button><ol class="drill-preview-list">${questions.map(question => `<li><strong>${clean(question.prompt)}</strong><span>${clean(question.concept)} · ${clean(question.chapter)}</span></li>`).join('')}</ol></div>`;
    return `<div class="drill-question-list">${series.questions.map((question, index) => {
      const answer = Object.hasOwn(series.answers, question.id) ? series.answers[question.id] : null;
      const trainingDraft = Object.hasOwn(series.trainingDrafts || {}, question.id) ? series.trainingDrafts[question.id] : null;
      return `<article class="drill-question" id="drill-question-${index}"><div class="drill-question-meta"><span class="eyebrow">QUESTION ${String(index + 1).padStart(2, '0')} / 10</span><span>${clean(question.chapter)} · ${clean(question.difficulty)}</span></div><h3>${clean(question.prompt)}</h3><p class="drill-concept">Notion : ${clean(question.concept)}</p>${answer ? `${correctionMarkup(question, answer)}${activeTraining.has(question.id) || trainingDraft ? answerForm(question, trainingDraft, true) : `<button class="btn btn-outline" type="button" data-drill-train="${clean(question.id)}">Revoir cette question</button>`}` : answerForm(question, Object.hasOwn(series.drafts, question.id) ? series.drafts[question.id] : null)}</article>`;
    }).join('')}</div>`;
  }

  function render() {
    const focused = root.contains(document.activeElement) ? document.activeElement : null;
    const focusQuestion = focused?.closest('.drill-answer-form')?.dataset;
    const focusValue = focused?.type === 'radio' ? focused.value : null;
    state = store.getState().view;
    renderedData = JSON.stringify(state);
    const series = storedSeries();
    const questions = series?.questions || selectWeeklyQuestions(bank.questions, selectedUnit.id, selectedWeek.id);
    const stats = series ? getSeriesStats(series) : { planned: 10, completed: 0, correct: 0, incorrect: 0, successRate: null };
    const choices = new Map([[currentWeek.id, currentWeek]]);
    for (let offset = 1; offset <= 8; offset++) { const week = shiftWeek(currentWeek.id, -offset); choices.set(week.id, week); }
    Object.values(state.series).filter(item => item.unit === selectedUnit.id).forEach(item => { const week = parseWeek(item.week); if (week) choices.set(week.id, week); });
    choices.set(selectedWeek.id, selectedWeek);
    const bankCount = bank.questions.filter(question => question.unit === selectedUnit.id).length;
    root.innerHTML = `<section class="page-top wrap drill-intro">${renderBreadcrumbs('drill')}<div class="page-eyebrow">LA PRATIQUE AU FIL DES SEMAINES</div><h1>Exercices hebdomadaires</h1><p>Dix exercices par UC, une correction pour comprendre et toute la liberté de reprendre plus tard. Une nouvelle série est disponible chaque lundi à 00 h, heure de Paris.</p></section>
    <section class="wrap drill-overview" aria-labelledby="drill-current-title"><div class="drill-week-strip"><div><span class="eyebrow">SEMAINE EN COURS · EUROPE/PARIS</span><h2 id="drill-current-title">${currentWeek.id}</h2><p>${periodLabel(currentWeek)}</p></div><p>Les séries précédentes restent ouvertes.<br>Les questions non réalisées ne sont jamais des erreurs.</p></div><details class="drill-unit-picker" ${unitPickerOpen ? 'open' : ''}><summary>Choisir une UC <span>· ${clean(selectedUnit.code)} sélectionnée</span></summary><div class="drill-unit-grid" aria-label="Unités capitalisables">${units.map(unitCard).join('')}</div></details></section>
    <section class="wrap drill-workspace" aria-labelledby="drill-session-title"><div class="drill-session-top"><div><span class="eyebrow">${clean(selectedUnit.code)} · ${selectedWeek.id === currentWeek.id ? 'SÉRIE ACTUELLE' : 'SÉRIE PRÉCÉDENTE'}</span><h2 id="drill-session-title">${clean(selectedUnit.title)}</h2><p>${periodLabel(selectedWeek)} · ${selectedWeek.id}</p></div><label class="drill-week-select">Choisir une semaine<select id="drill-week-select">${[...choices.values()].sort((a, b) => b.ordinal - a.ordinal).map(week => `<option value="${week.id}" ${week.id === selectedWeek.id ? 'selected' : ''}>${week.id}${week.id === currentWeek.id ? ' · actuelle' : ''}</option>`).join('')}</select></label></div>
    <div id="drill-week-notice" role="status">${selectedWeek.id !== currentWeek.id ? `<p class="drill-notice">Tu consultes une série précédente. <a class="text-link" href="${pageUrl(selectedUnit.id, currentWeek.id)}">Ouvrir la semaine actuelle →</a></p>` : ''}</div>
    ${state.error ? `<p class="drill-notice drill-notice-error" role="alert">${clean(state.error)} Les anciennes données restent conservées.</p>` : ''}${bank.error ? `<div class="drill-notice drill-notice-error"><p>${clean(bank.error)} ${series ? 'Ta série commencée reste accessible grâce aux questions sauvegardées.' : ''}</p><button class="btn btn-outline" type="button" data-drill-retry>Réessayer le chargement</button></div>` : ''}${bank.warnings.length || state.warnings.length ? `<details class="drill-notice"><summary>Certaines données ne peuvent pas être utilisées (${bank.warnings.length + state.warnings.length})</summary><ul>${[...bank.warnings, ...state.warnings].map(warning => `<li>${clean(warning)}</li>`).join('')}</ul></details>` : ''}
    <div id="drill-sync-panel">${syncPanelMarkup(store.getState())}</div>
    <p class="drill-save-status ${errorMessage ? 'drill-notice-error' : ''}" id="drill-save-status" role="status" aria-live="polite">${clean(errorMessage || latestMessage)}</p>
    ${questions.length === 10 ? `${statsMarkup(stats)}<p class="drill-score-method">Réussite = bonnes réponses comptabilisées ÷ exercices réalisés. Les entraînements suivants restent séparés. Ce taux ne prédit pas la réussite à l’examen.</p>${sessionMarkup(series, questions)}` : `<div class="drill-incomplete"><span class="eyebrow">${bank.error ? 'BANQUE INDISPONIBLE' : 'BANQUE INCOMPLÈTE'}</span><h3>${bank.error ? 'Les exercices ne sont pas accessibles pour le moment.' : 'Les questions prennent encore racine.'}</h3><p>${bank.error ? 'Réessaie le chargement pour retrouver les questions disponibles.' : `${bankCount} question${bankCount > 1 ? 's' : ''} exploitable${bankCount > 1 ? 's' : ''} pour cette UC. Il en faut au moins 10 différentes pour composer une série.`}</p><p>Aucune question n’est dupliquée pour compléter artificiellement une série. Les séries déjà commencées restent accessibles dans ton historique.</p></div>`}
    </section><section class="wrap drill-history" aria-labelledby="drill-history-title"><span class="eyebrow">CONSERVER LE FIL</span><h2 id="drill-history-title">Tes séries · ${clean(selectedUnit.code)}</h2>${historyMarkup()}</section><aside class="wrap drill-storage-note"><p>${store.getState().mode === 'personal' ? 'Réponses sauvegardées d’abord sur cet appareil, puis sur ton compte quand la synchronisation est confirmée. Le cache personnel n’est pas chiffré : sur un appareil partagé, la déconnexion masque les données mais conserve les réponses en attente. Une personne ayant accès au navigateur peut lire ce cache. Hors connexion, seules les séries déjà enregistrées ici restent disponibles.' : 'Réponses et historique conservés dans ce navigateur, sur cet appareil.'} Les séries commencées gardent leur version des questions. Tu peux aussi commencer une série des huit semaines précédentes, même sans avoir terminé les autres.</p><p>Les questions actuelles reprennent les cours de démonstration. Elles ne remplacent pas les supports de ton centre de formation.</p></aside>`;
    if (focusQuestion && focusValue) root.querySelector(`form[data-question="${CSS.escape(focusQuestion.question)}"][data-training="${focusQuestion.training}"] input[value="${CSS.escape(focusValue)}"]`)?.focus({ preventScroll: true });
  }

  function showMessage(message, error = false) {
    latestMessage = error ? '' : message;
    errorMessage = error ? message : '';
    const status = root.querySelector('#drill-save-status');
    if (status) { status.textContent = message; status.classList.toggle('drill-notice-error', error); }
  }

  root.addEventListener('toggle', event => {
    if (event.target.matches('.drill-unit-picker')) unitPickerOpen = event.target.open;
  }, true);

  root.addEventListener('change', async event => {
    if (event.target.id === 'drill-week-select') { location.href = pageUrl(selectedUnit.id, event.target.value); return; }
    const form = event.target.closest('.drill-answer-form');
    if (!form || event.target.type !== 'radio') return;
    form.querySelector('button[type="submit"]').disabled = false;
    const currentScope = store.getState().scope;
    const result = await store.saveDraft(seriesId(selectedUnit.id, selectedWeek.id), form.dataset.question, event.target.value, { training: form.dataset.training === 'true' });
    if (currentScope !== store.getState().scope) return;
    showMessage(result.error || 'Choix enregistré sur cet appareil. Valide ta réponse pour consulter la correction.', !!result.error);
  });

  root.addEventListener('submit', async event => {
    const form = event.target.closest('.drill-answer-form');
    if (!form) return;
    event.preventDefault();
    if (pending) return;
    const value = new FormData(form).get('answer');
    if (!value) return;
    pending = true;
    form.querySelector('button[type="submit"]').disabled = true;
    const currentScope = store.getState().scope;
    const result = await store.submitAnswer(seriesId(selectedUnit.id, selectedWeek.id), form.dataset.question, value, { training: form.dataset.training === 'true', nowISO: new Date().toISOString() });
    pending = false;
    if (currentScope !== store.getState().scope) { activeTraining.clear(); render(); return; }
    if (result.error) { showMessage(result.error, true); form.querySelector('button[type="submit"]').disabled = false; return; }
    const questionId = form.dataset.question;
    activeTraining.delete(questionId);
    latestMessage = form.dataset.training === 'true' ? 'Entraînement enregistré séparément. Le résultat de la série reste inchangé.' : 'Réponse et correction enregistrées. Tu peux interrompre la série et reprendre plus tard.';
    errorMessage = '';
    render();
    document.getElementById(`drill-correction-${questionId}`)?.focus({ preventScroll: true });
  });

  root.addEventListener('click', async event => {
    if (event.target.closest('[data-drill-sync-retry]')) {
      event.target.closest('button').disabled = true;
      try { await store.retry(); } catch { showMessage('La synchronisation reste indisponible. Les données locales sont conservées.', true); }
      return;
    }
    const resolve = event.target.closest('[data-drill-resolve]');
    if (resolve) {
      resolve.disabled = true;
      try { await store.resolveConflict(resolve.dataset.drillResolve); render(); }
      catch { showMessage('Le conflit n’a pas pu être résolu. Ses données restent conservées.', true); resolve.disabled = false; }
      return;
    }
    if (event.target.closest('[data-drill-start]')) {
      if (pending) return;
      pending = true;
      const button = event.target.closest('[data-drill-start]');
      button.disabled = true;
      const selected = selectWeeklyQuestions(bank.questions, selectedUnit.id, selectedWeek.id);
      const currentScope = store.getState().scope;
      const result = await store.ensureSeries(selectedUnit.id, selectedWeek.id, selected, new Date().toISOString());
      pending = false;
      if (currentScope !== store.getState().scope) { activeTraining.clear(); render(); return; }
      if (result.error) { showMessage(result.error, true); button.disabled = false; return; }
      latestMessage = 'Série enregistrée. Tes choix sont sauvegardés à chaque sélection.';
      errorMessage = '';
      render();
      root.querySelector('.drill-question h3')?.setAttribute('tabindex', '-1');
      root.querySelector('.drill-question h3')?.focus();
    }
    const training = event.target.closest('[data-drill-train]');
    if (training) { activeTraining.add(training.dataset.drillTrain); render(); root.querySelector(`.drill-answer-form[data-question="${CSS.escape(training.dataset.drillTrain)}"] input`)?.focus({ preventScroll: true }); }
    if (event.target.closest('[data-drill-retry]')) { bank = await loadDrillBank(); render(); }
  });

  function checkWeek() {
    const next = getParisWeek();
    if (next.id !== currentWeek.id) { currentWeek = next; latestMessage = 'Une nouvelle série est disponible. Tu peux continuer la précédente ou ouvrir la semaine actuelle.'; render(); }
    clearTimeout(timer);
    timer = setTimeout(checkWeek, Math.max(1000, nextParisWeekAt().getTime() - Date.now() + 50));
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkWeek(); render(); } });
  window.addEventListener('pageshow', event => { if (event.persisted) { location.reload(); return; } checkWeek(); render(); });
  window.addEventListener('pagehide', () => { store.stop(); clearTimeout(timer); if (store.getState().mode !== 'visitor') root.replaceChildren(); });
  window.addEventListener('storage', event => {
    if (store.getState().mode === 'visitor' && (event.key === 'bprea-demo-drill-v1' || event.key === null)) { latestMessage = 'Historique actualisé depuis un autre onglet.'; render(); }
  });
  render();
  let displayedScope = store.getState().scope;
  store.subscribe(next => {
    if (next.scope !== displayedScope) { displayedScope = next.scope; activeTraining.clear(); latestMessage = ''; errorMessage = ''; render(); return; }
    if (!pending && JSON.stringify(next.view) !== renderedData) render();
    else {
      const panel = root.querySelector('#drill-sync-panel');
      const markup = syncPanelMarkup(next);
      if (panel && panel.innerHTML !== markup) panel.innerHTML = markup;
    }
  });
  checkWeek();
}
