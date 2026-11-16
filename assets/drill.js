import { units } from './content.js';
import { loadDrillBank } from './drill-bank.js';
import { getParisWeek, parseWeek, shiftWeek, nextParisWeekAt, selectWeeklyQuestions, getSeriesStats } from './drill-engine.js';
import { getDrillSyncService } from './drill-sync-service.js';
import { syncPanelMarkup } from './drill-sync-ui.js';
import { clean, pageUrl, drillShell, weekMarkup, unitCard, sessionHeading, statsMarkup, historyMarkup, questionMarkup, previewMarkup, storageMarkup } from './drill-page.js';

const seriesId = (unit, week) => `${unit}__${week}`;

export async function initDrill(root) {
  root.innerHTML = '<section class="page-top wrap"><h1>Exercices hebdomadaires</h1><p role="status">Chargement des exercices de la semaine…</p></section>';
  const [loadedBank, store] = await Promise.all([loadDrillBank(), getDrillSyncService()]);
  let bank = loadedBank;
  let state = store.getState().view;
  let currentWeek = getParisWeek();
  const query = new URLSearchParams(location.search);
  const selectedUnit = units.find(unit => unit.id === query.get('unit')) || units.find(unit => bank.questions.filter(question => question.unit === unit.id).length >= 10) || units[2];
  const requestedWeek = parseWeek(query.get('week'));
  const selectedWeek = requestedWeek && requestedWeek.ordinal <= currentWeek.ordinal ? requestedWeek : currentWeek;
  const activeTraining = new Set();
  // Temporary on-screen choices survive failed writes; they never count as saved answers.
  const localChoices = new Map();
  const regionMarkup = new Map();
  const questionSignatures = new Map();
  let pending = null, timer, epoch = 0, choiceVersion = 0, disposed = false;
  let latestMessage = '', errorMessage = '';
  const storedSeries = () => state.series[seriesId(selectedUnit.id, selectedWeek.id)];
  const choiceKey = (id, training) => `${training}:${id}`;
  const stillCurrent = operation => !disposed && epoch === operation.epoch && operation.scope === store.getState().scope;
  const operationContext = () => ({ epoch, scope: store.getState().scope });
  const detailKey = item => item.dataset.drillDetail || `${item.parentElement.closest('details[data-drill-detail]')?.dataset.drillDetail || ''}:${item.querySelector('summary')?.textContent}`;

  function resetShell() {
    regionMarkup.clear(); questionSignatures.clear(); root.innerHTML = drillShell();
    root.querySelector('#drill-unit-selection').textContent = `· ${selectedUnit.code} sélectionnée`;
    root.querySelector('#drill-history-title').textContent = `Tes séries · ${selectedUnit.code}`;
  }

  // Replace changed regions only. Details retain their voluntary open/closed state.
  function patch(id, markup) {
    const node = root.querySelector(`#${id}`);
    if (!node || regionMarkup.get(id) === markup) return;
    const details = new Map([...node.querySelectorAll('details')].map(item => [detailKey(item), item.open]));
    node.innerHTML = markup;
    for (const item of node.querySelectorAll('details')) {
      if (details.has(detailKey(item))) item.open = details.get(detailKey(item));
    }
    regionMarkup.set(id, markup);
  }

  function updateForm(article, question, series) {
    const form = article.querySelector('form');
    if (!form) return;
    const training = form.dataset.training === 'true';
    const selected = localChoices.get(choiceKey(question.id, training))?.value || (training ? series.trainingDrafts : series.drafts)?.[question.id];
    for (const input of form.querySelectorAll('input[type="radio"]')) input.checked = input.value === selected;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = !selected || !!pending || !!state.error;
    const saving = pending?.question === question.id && pending.training === training;
    form.setAttribute('aria-busy', String(saving));
    button.textContent = saving ? 'Enregistrement…' : training ? 'Vérifier pour s’entraîner' : 'Valider cette réponse';
    if (!training) article.querySelector('.drill-question-state').textContent = selected ? 'Brouillon · à valider' : 'À compléter';
  }

  function sessionMarkup(series, questions, snapshot) {
    const container = root.querySelector('#drill-session');
    if (questions.length !== 10) {
      const count = bank.questions.filter(question => question.unit === selectedUnit.id).length;
      patch('drill-session', `<div class="drill-incomplete"><span class="eyebrow">${bank.error ? 'BANQUE INDISPONIBLE' : 'BANQUE INCOMPLÈTE'}</span><h3>${bank.error ? 'Les exercices sont momentanément indisponibles.' : 'Les questions prennent encore racine.'}</h3><p>${bank.error ? 'Réessaie le chargement pour retrouver les questions disponibles.' : `${count} question${count > 1 ? 's' : ''} exploitable${count > 1 ? 's' : ''} pour cette UC. Il en faut au moins 10 différentes pour composer une série.`}</p><p>Aucune question n’est dupliquée. Tes séries déjà commencées restent accessibles dans l’historique.</p></div>`);
      questionSignatures.clear(); return;
    }
    if (!series) {
      patch('drill-session', previewMarkup(selectedUnit, selectedWeek, questions, snapshot.mode, !!state.error || !!pending));
      questionSignatures.clear(); return;
    }
    if (!container.querySelector('.drill-question-list')) {
      container.innerHTML = '<div class="drill-question-list"></div>';
      regionMarkup.delete('drill-session'); questionSignatures.clear();
    }
    const list = container.querySelector('.drill-question-list');
    const expectedIds = new Set(series.questions.map(question => question.id));
    for (const article of [...list.children]) if (!expectedIds.has(article.dataset.drillQuestionId)) article.remove();
    series.questions.forEach((question, index) => {
      const answer = Object.hasOwn(series.answers, question.id) ? series.answers[question.id] : null;
      const draft = localChoices.get(choiceKey(question.id, false))?.value || series.drafts[question.id];
      const trainingDraft = localChoices.get(choiceKey(question.id, true))?.value || series.trainingDrafts?.[question.id];
      const trainingOpen = activeTraining.has(question.id) || !!trainingDraft;
      let article = list.querySelector(`[data-drill-question-id="${CSS.escape(question.id)}"]`);
      if (!article) {
        article = document.createElement('article'); article.className = 'drill-question';
        article.dataset.drillQuestionId = question.id; article.id = `drill-question-${index}`;
        list.append(article); questionSignatures.delete(question.id);
      }
      // Draft changes update native controls in place: focused inputs/buttons survive.
      const signature = JSON.stringify([question, answer, trainingOpen]);
      if (questionSignatures.get(question.id) !== signature) {
        article.innerHTML = questionMarkup(question, index, answer, draft, trainingDraft, trainingOpen);
        questionSignatures.set(question.id, signature);
      }
      if (list.children[index] !== article) list.insertBefore(article, list.children[index]);
      updateForm(article, question, series);
    });
  }

  function render() {
    if (disposed) return;
    const focused = root.contains(document.activeElement) ? document.activeElement : null;
    const focusId = focused?.id;
    const form = focused?.closest('.drill-answer-form');
    const focusQuestion = form ? { ...form.dataset } : null;
    const focusValue = focused?.type === 'radio' ? focused.value : null;
    const focusSubmit = focused?.matches('button[type="submit"]');
    const focusLink = focused?.matches('a[href]') ? { href: focused.getAttribute('href'), container: focused.parentElement.closest('[id]')?.id } : null;
    const focusedDetail = focused?.matches('summary') ? detailKey(focused.parentElement) : null;
    const control = ['data-drill-sync-retry', 'data-drill-resolve', 'data-drill-train'].find(attribute => focused?.hasAttribute(attribute));
    const snapshot = store.getState();
    state = snapshot.mode === 'blocked' || snapshot.mode === 'personal' && snapshot.sync.state === 'session'
      ? { series: {}, warnings: [], error: 'Session à vérifier. Reconnecte-toi au bon compte pour retrouver tes séries personnelles.' } : snapshot.view;
    const series = storedSeries();
    const questions = series?.questions || selectWeeklyQuestions(bank.questions, selectedUnit.id, selectedWeek.id);
    const stats = series ? getSeriesStats(series) : { planned: 10, completed: 0, correct: 0, incorrect: 0, successRate: null, trainingAttempts: 0 };
    const known = !state.error && (!!series || !state.warnings.length);
    const choices = new Map([[currentWeek.id, currentWeek]]);
    for (let offset = 1; offset <= 8; offset++) { const week = shiftWeek(currentWeek.id, -offset); choices.set(week.id, week); }
    Object.values(state.series).filter(item => item.unit === selectedUnit.id).forEach(item => { const week = parseWeek(item.week); if (week && week.ordinal <= currentWeek.ordinal) choices.set(week.id, week); });
    choices.set(selectedWeek.id, selectedWeek);
    patch('drill-current-week', weekMarkup(currentWeek));
    patch('drill-unit-grid', units.map(unit => unitCard(unit, selectedUnit, currentWeek, bank, state)).join(''));
    patch('drill-session-heading', sessionHeading(selectedUnit, selectedWeek, currentWeek, [...choices.values()].sort((a, b) => b.ordinal - a.ordinal)));
    patch('drill-week-notice', selectedWeek.id !== currentWeek.id ? `<p class="drill-notice">Tu consultes une semaine précédente. <a class="text-link" href="${pageUrl(selectedUnit.id, currentWeek.id)}">Ouvrir la semaine actuelle →</a></p>` : '');
    patch('drill-notices', `${state.error ? `<p class="drill-notice drill-notice-error" role="alert">${clean(state.error)} Les anciennes données restent conservées.</p>` : ''}${bank.error ? `<div class="drill-notice drill-notice-error" role="alert"><p>${clean(bank.error)} ${series ? 'Ta série commencée reste accessible grâce aux questions sauvegardées.' : ''}</p><button class="btn btn-outline" type="button" data-drill-retry>Réessayer le chargement</button></div>` : ''}${bank.warnings.length || state.warnings.length ? `<details class="drill-notice" data-drill-detail="warnings"><summary>Certaines données ne peuvent pas être utilisées (${bank.warnings.length + state.warnings.length})</summary><ul>${[...bank.warnings, ...state.warnings].map(warning => `<li>${clean(warning)}</li>`).join('')}</ul></details>` : ''}`);
    patch('drill-summary', questions.length === 10 || !known ? statsMarkup(stats, known) : '');
    patch('drill-sync-panel', syncPanelMarkup(snapshot));
    sessionMarkup(series, questions, snapshot);
    patch('drill-history-content', historyMarkup(state, selectedUnit));
    patch('drill-storage-content', storageMarkup(snapshot.mode));
    showMessage(errorMessage || latestMessage, !!errorMessage);
    if (focused && !focused.isConnected) {
      let replacement;
      if (focusQuestion) {
        const nextForm = root.querySelector(`form[data-question="${CSS.escape(focusQuestion.question)}"][data-training="${focusQuestion.training}"]`);
        replacement = focusValue ? nextForm?.querySelector(`input[value="${CSS.escape(focusValue)}"]`) : focusSubmit ? nextForm?.querySelector('button[type="submit"]') : null;
      } else if (focusId) replacement = root.querySelector(`#${CSS.escape(focusId)}`);
      else if (focusLink) {
        const container = focusLink.container && focusLink.container !== root.id ? root.querySelector(`#${CSS.escape(focusLink.container)}`) : root;
        replacement = [...container?.querySelectorAll('a[href]') || []].find(link => link.getAttribute('href') === focusLink.href);
      }
      else if (focusedDetail) replacement = [...root.querySelectorAll('details')].find(item => detailKey(item) === focusedDetail)?.querySelector('summary');
      else if (control) replacement = root.querySelector(`[${control}="${CSS.escape(focused.getAttribute(control))}"]`);
      if (replacement?.id === 'drill-sync-status') replacement.setAttribute('tabindex', '-1');
      replacement?.focus({ preventScroll: true });
    }
  }

  function showMessage(message, error = false, announce = false) {
    latestMessage = error ? '' : message; errorMessage = error ? message : '';
    const status = root.querySelector('#drill-save-status'), alert = root.querySelector('#drill-save-error');
    if (status && status.textContent !== latestMessage) status.textContent = latestMessage;
    if (alert && alert.textContent !== errorMessage) alert.textContent = errorMessage;
    // Radio selections get a quiet visual receipt; submissions are announced once.
    if (announce && !error) root.querySelector('#drill-announcement').textContent = message;
  }

  function showQuestionError(question, training, message = '') {
    const form = root.querySelector(`form[data-question="${CSS.escape(question)}"][data-training="${training}"]`);
    const note = form?.closest('.drill-question').querySelector('.drill-answer-error');
    if (note) { note.textContent = message; note.hidden = !message; }
    const button = form?.querySelector('button[type="submit"]');
    if (message && button) button.setAttribute('aria-describedby', note.id);
    else button?.removeAttribute('aria-describedby');
  }

  root.addEventListener('change', async event => {
    if (event.target.id === 'drill-week-select') { location.href = pageUrl(selectedUnit.id, event.target.value); return; }
    const form = event.target.closest('.drill-answer-form');
    if (!form || event.target.type !== 'radio') return;
    const question = form.dataset.question, training = form.dataset.training === 'true';
    const key = choiceKey(question, training), version = ++choiceVersion, operation = operationContext();
    localChoices.set(key, { value: event.target.value, version });
    form.querySelector('button[type="submit"]').disabled = !!pending;
    if (!training) form.closest('.drill-question').querySelector('.drill-question-state').textContent = 'Brouillon · à valider';
    let result;
    try { result = await store.saveDraft(seriesId(selectedUnit.id, selectedWeek.id), question, event.target.value, { training }); }
    catch { result = { error: 'Le choix n’a pas pu être enregistré. Il reste sélectionné à l’écran ; réessaie avant de quitter la page.' }; }
    if (!stillCurrent(operation) || localChoices.get(key)?.version !== version) return;
    if (!result.error) localChoices.delete(key);
    showQuestionError(question, training, result.error || '');
    showMessage(result.error || 'Choix enregistré sur cet appareil. Valide ta réponse pour consulter la correction.', !!result.error); render();
  });

  root.addEventListener('submit', async event => {
    const form = event.target.closest('.drill-answer-form');
    if (!form) return;
    event.preventDefault(); if (pending) return;
    const value = new FormData(form).get('answer'); if (!value) return;
    const question = form.dataset.question, training = form.dataset.training === 'true';
    const operation = { ...operationContext(), question, training }; pending = operation; render();
    let result;
    try { result = await store.submitAnswer(seriesId(selectedUnit.id, selectedWeek.id), question, value, { training, nowISO: new Date().toISOString() }); }
    catch { result = { error: 'La réponse n’a pas pu être enregistrée. Ton choix est conservé à l’écran ; réessaie.' }; }
    if (pending === operation) pending = null;
    if (!stillCurrent(operation)) return;
    if (result.error) {
      showMessage(result.error, true); render(); showQuestionError(question, training, result.error);
      root.querySelector(`form[data-question="${CSS.escape(question)}"][data-training="${training}"] button[type="submit"]`)?.focus({ preventScroll: true }); return;
    }
    localChoices.delete(choiceKey(question, training)); activeTraining.delete(question);
    showMessage(training ? 'Entraînement enregistré séparément. Le résultat de la série reste inchangé.' : 'Réponse et correction enregistrées sur cet appareil. Tu peux reprendre plus tard.', false, true);
    render(); root.querySelector(`#drill-correction-${CSS.escape(question)}`)?.focus({ preventScroll: true });
  });

  root.addEventListener('click', async event => {
    const retry = event.target.closest('[data-drill-sync-retry]');
    if (retry) {
      const operation = operationContext(); retry.disabled = true;
      try { await store.retry(); }
      catch { if (stillCurrent(operation)) showMessage('La synchronisation reste indisponible. Les données locales sont conservées.', true); }
      if (stillCurrent(operation)) {
        retry.disabled = false; render();
        if (!retry.isConnected && document.activeElement === document.body) {
          const status = root.querySelector('#drill-sync-status'); status?.setAttribute('tabindex', '-1'); status?.focus({ preventScroll: true });
        }
      } return;
    }
    const resolve = event.target.closest('[data-drill-resolve]');
    if (resolve) {
      const operation = operationContext(); resolve.disabled = true;
      try { await store.resolveConflict(resolve.dataset.drillResolve); }
      catch { if (stillCurrent(operation)) showMessage('Le conflit n’a pas pu être résolu. Ses données restent conservées.', true); }
      if (stillCurrent(operation)) {
        resolve.disabled = false; render();
        if (!resolve.isConnected && document.activeElement === document.body)
          root.querySelector(`[data-drill-detail="${CSS.escape(`conflict-${resolve.dataset.drillResolve}`)}"]>summary`)?.focus({ preventScroll: true });
      } return;
    }
    const start = event.target.closest('[data-drill-start]');
    if (start) {
      if (pending) return;
      const operation = operationContext(); pending = operation;
      start.disabled = true; start.textContent = 'Enregistrement de la série…';
      const selected = selectWeeklyQuestions(bank.questions, selectedUnit.id, selectedWeek.id);
      let result;
      try { result = await store.ensureSeries(selectedUnit.id, selectedWeek.id, selected, new Date().toISOString()); }
      catch { result = { error: 'La série n’a pas pu être enregistrée. Réessaie son démarrage.' }; }
      if (pending === operation) pending = null;
      if (!stillCurrent(operation)) return;
      if (result.error) { showMessage(result.error, true); start.disabled = false; start.textContent = 'Commencer cette série →'; return; }
      showMessage('Série enregistrée sur cet appareil. Tes choix sont sauvegardés à chaque sélection réussie.', false, true);
      render(); root.querySelector('.drill-question h3')?.focus({ preventScroll: true }); return;
    }
    const training = event.target.closest('[data-drill-train]');
    if (training) {
      activeTraining.add(training.dataset.drillTrain); render();
      root.querySelector(`.drill-answer-form[data-question="${CSS.escape(training.dataset.drillTrain)}"][data-training="true"] input`)?.focus({ preventScroll: true });
    }
    const bankRetry = event.target.closest('[data-drill-retry]');
    if (bankRetry) {
      const operation = operationContext(); bankRetry.disabled = true;
      bank = await loadDrillBank(); bankRetry.disabled = false; render();
      if (stillCurrent(operation) && document.activeElement === document.body)
        root.querySelector('[data-drill-retry], [data-drill-start]')?.focus({ preventScroll: true });
    }
  });

  function checkWeek() {
    if (disposed) return;
    const next = getParisWeek();
    if (next.id !== currentWeek.id) { currentWeek = next; showMessage('Une nouvelle série est disponible. Tu peux continuer la précédente ou ouvrir la semaine actuelle.', false, true); render(); }
    clearTimeout(timer); timer = setTimeout(checkWeek, Math.max(1000, nextParisWeekAt().getTime() - Date.now() + 50));
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkWeek(); render(); } });
  window.addEventListener('pageshow', event => { if (event.persisted) { location.reload(); return; } checkWeek(); render(); });
  window.addEventListener('pagehide', () => { disposed = true; epoch++; store.stop(); clearTimeout(timer); if (store.getState().mode !== 'visitor') root.replaceChildren(); });
  window.addEventListener('storage', event => {
    if (store.getState().mode === 'visitor' && (event.key === 'bprea-demo-drill-v1' || event.key === null)) { showMessage('Historique actualisé depuis un autre onglet.'); render(); }
  });
  resetShell(); render();
  let displayedScope = store.getState().scope;
  store.subscribe(next => {
    if (disposed) return;
    if (next.scope !== displayedScope) {
      displayedScope = next.scope; epoch++; pending = null; activeTraining.clear(); localChoices.clear(); latestMessage = ''; errorMessage = '';
      resetShell(); render(); return;
    }
    if (!pending) render(); else patch('drill-sync-panel', syncPanelMarkup(next));
  });
  checkWeek();
}
