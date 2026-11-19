import { renderBreadcrumbs } from './breadcrumbs.js';
import { getCategoryAvailability, createSession, evaluateAnswer, normalizeAnswer, calculateStats, createQuestionTimer } from './botanical-engine.js';
import { getBotanicalService } from './botanical-sync-service.js';
import { initBotanicalSyncPanel } from './botanical-sync-ui.js';

const clean = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const link = (url, label) => /^https:\/\//.test(url || '') ? `<a href="${clean(url)}" target="_blank" rel="noopener noreferrer">${clean(label)}</a>` : clean(label);
const creditAddress = photo => photo.attribution?.match(/https:\/\/[^\s]+/)?.[0];
const rate = value => value === null ? 'Non calculable' : `${Math.round(value)} %`;
const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeZone: 'UTC' });
const secondsFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });
const day = value => dateFormat.format(new Date(`${value}T12:00:00Z`));
const action = 'btn btn-surface';
const primaryAction = `${action} btn-surface--accent`;
const controllers = new WeakMap();

function replaceStatistics(root, markup) {
  const active = document.activeElement;
  const focusedTable = root.contains(active) && active.matches('.bot-table-wrap') ? active : null;
  const scrollLeft = focusedTable?.scrollLeft;
  root.innerHTML = markup;
  if (focusedTable) {
    const label = CSS.escape(focusedTable.getAttribute('aria-label'));
    const table = root.querySelector(`.bot-table-wrap[aria-label="${label}"]`);
    if (table) {
      table.scrollLeft = scrollLeft;
      table.focus({ preventScroll: true });
    }
  }
}

function chronoDuration(history) {
  const seen = new Set();
  let elapsedMs = 0;
  for (const entry of history) {
    const answer = normalizeAnswer(entry);
    if (!answer || seen.has(answer.id)) continue;
    seen.add(answer.id);
    if (answer.status !== 'skipped_image') elapsedMs += answer.elapsedMs;
  }
  const minutes = Math.floor(elapsedMs / 60000);
  const seconds = secondsFormat.format((elapsedMs % 60000) / 1000);
  return `${minutes ? `${minutes} min ` : ''}${seconds} s`;
}

export async function initBotanical(root) {
  controllers.get(root)?.abort();
  const controller = new AbortController();
  controllers.set(root, controller);
  const { signal } = controller;
  root.querySelector('#bot-breadcrumbs').innerHTML = renderBreadcrumbs('botanical');
  const content = root.querySelector('#bot-content');
  const historyRoot = root.querySelector('#bot-history');
  const storageRoot = root.querySelector('#bot-storage');
  const credits = root.querySelector('#bot-photo-credits');
  const creditsList = credits.querySelector('ul');
  credits.hidden = true;
  credits.open = false;
  creditsList.replaceChildren();
  root.dataset.botScreen = 'selection';
  content.innerHTML = '<p class="bot-panel" role="status">Chargement de la photothèque…</p>';
  historyRoot.replaceChildren();
  storageRoot.replaceChildren();
  let bank;
  try {
    const response = await fetch(new URL('./botanical-bank.json', import.meta.url), { signal });
    if (!response.ok) throw new Error('catalogue');
    bank = await response.json();
    if (bank.version !== 1 || !Array.isArray(bank.categories) || !Array.isArray(bank.species) || !Array.isArray(bank.photos)) throw new Error('catalogue');
  } catch {
    if (!signal.aborted) content.innerHTML = '<div class="bot-panel"><h2>Photothèque indisponible</h2><p>Le catalogue ne peut pas être chargé. Recharge la page pour réessayer. Aucun résultat n’a été compté.</p></div>';
    return;
  }
  if (signal.aborted) return;
  credits.hidden = false;
  credits.addEventListener('toggle', () => {
    if (!credits.open || creditsList.childElementCount) return;
    creditsList.innerHTML = bank.photos.map(photo => {
      const address = creditAddress(photo);
      return `<li data-photo-credit="${clean(photo.id)}">
        <strong>${clean(photo.sourceTitle || photo.author)}</strong>
        <div class="bot-photo-links"><span>${clean(photo.author)}${address ? ` / ${link(address, address)}` : ''}</span>${link(photo.licenseUrl, photo.license)}${link(photo.sourceUrl, 'Source de la photographie')}</div>
        ${photo.attribution ? `<p>${clean(photo.attribution)}</p>` : ''}
      </li>`;
    }).join('');
  }, { signal });
  const service = await getBotanicalService();
  if (signal.aborted) return;
  let state = service.getState();
  let answers = state.view.history.answers;
  let source = `${state.mode}:${state.scope}`;
  let identityEpoch = 0;
  let screen = 'selection';
  let saving = false;
  let savedOutcome = false;
  let sessionSaved = false;
  let completionAt = null;
  let resultSession = null;
  let actionError = '';
  let visitorMemory = false;
  let volatileAnswers = [];
  let categoryId = getCategoryAvailability(bank, answers).find(item => item.playable)?.id || '';
  let mode = 'discovery';
  let durationSeconds = 30;
  let revision = false;
  let session = null;
  let index = 0;
  let selected = null;
  let outcome = null;
  let timer = null;
  let ticker = null;
  let imageReady = false;
  let timerStarted = false;
  let manuallyPaused = false;
  let imageAttempt = 0;
  let historyMarkup = '';
  const species = id => bank.species.find(item => item.id === id);
  const category = id => bank.categories.find(item => item.id === id);
  const focus = selector => content.querySelector(selector)?.focus();

  initBotanicalSyncPanel(storageRoot, service, { signal });
  const activeSource = current => !signal.aborted && current === identityEpoch;
  function actionNotice(message, retry = '') {
    actionError = message || '';
    const target = content.querySelector('#bot-save-message') || content.querySelector('#bot-session-info');
    const actions = content.querySelector('[data-save-actions]');
    if (target) target.textContent = message;
    if (actions) actions.innerHTML = retry ? `<button class="${action}" type="button" data-retry-save="${retry}">Réessayer l’enregistrement</button>` : '';
  }
  function saveOption(label, attribute) {
    content.querySelector('[data-save-actions]')?.insertAdjacentHTML('beforeend', `<button class="${action}" type="button" ${attribute}>${label}</button>`);
  }
  async function saveAnswer() {
    if (!outcome || saving || savedOutcome || !session) return;
    if (visitorMemory && state.mode === 'visitor') { continueVisitor(); return; }
    const current = identityEpoch; saving = true; actionNotice('Enregistrement de la réponse sur cet appareil…');
    let result;
    try { result = await service.recordAnswer(outcome); }
    catch { result = { error: 'Le navigateur n’a pas pu enregistrer cette réponse.' }; }
    if (!activeSource(current)) return;
    saving = false;
    if (result.error || result.accountChanged) {
      actionNotice(result.error || 'Le compte a changé. Cette réponse n’a pas été enregistrée dans le nouveau compte.', result.conflict ? '' : 'answer');
      if (result.conflict) saveOption('Quitter cette session en conservant le conflit', 'data-abandon');
      if (state.mode === 'visitor') saveOption('Continuer sans sauvegarder', 'data-visitor-continue');
    } else {
      savedOutcome = true;
      actionNotice('Réponse enregistrée sur cet appareil.');
      renderHistory();
    }
    const next = content.querySelector('[data-next]'); if (next) next.disabled = !savedOutcome;
    const stop = content.querySelector('[data-stop]'); if (stop) stop.disabled = !savedOutcome;
  }
  function continueVisitor() {
    if (state.mode !== 'visitor' || !outcome) return;
    visitorMemory = true; savedOutcome = true;
    if (!volatileAnswers.some(item => item.id === outcome.id)) volatileAnswers.push(outcome);
    if (!answers.some(item => item.id === outcome.id)) answers.push(outcome);
    actionNotice('Réponse visible pour cette visite uniquement. Elle n’est pas sauvegardée.');
    const next = content.querySelector('[data-next]'); if (next) next.disabled = false;
    const stop = content.querySelector('[data-stop]'); if (stop) stop.disabled = false;
    renderHistory();
  }
  function metrics(stats) {
    return `<dl class="bot-metrics">
      <div class="bot-metric-rate"><dt>Taux de reconnaissance</dt><dd>${rate(stats.recognitionRate)}</dd></div>
      <div><dt>Questions réalisées</dt><dd>${stats.attempted}</dd></div>
      <div><dt>Réponses correctes</dt><dd>${stats.correct}</dd></div>
      <div><dt>Réponses incorrectes</dt><dd>${stats.incorrect}</dd></div>
      <div><dt>Expirations du chrono</dt><dd>${stats.timeouts}</dd></div>
      <div><dt>Photographies passées</dt><dd>${stats.skipped}</dd></div>
    </dl>`;
  }
  function breakdown(stats) {
    return `<div class="bot-table-wrap" role="region" aria-label="Détail par espèce" tabindex="0">
      <table class="bot-table"><caption>Résultats par espèce</caption>
        <thead><tr><th scope="col">Espèce</th><th scope="col">Réalisées</th><th scope="col">Correctes</th><th scope="col">Incorrectes</th><th scope="col">Expirations</th><th scope="col">Reconnaissance</th></tr></thead>
        <tbody>${stats.bySpecies.map(item => `<tr><th scope="row">${clean(species(item.id)?.commonName || item.id)}</th><td>${item.attempted}</td><td>${item.correct}</td><td>${item.incorrect}</td><td>${item.timeouts}</td><td>${rate(item.recognitionRate)}</td></tr>`).join('')}</tbody>
      </table>
    </div>`;
  }
  function renderHistory() {
    const stats = calculateStats(answers);
    if (!historyRoot.firstElementChild) {
      historyRoot.innerHTML = `<details class="bot-panel bot-history">
        <summary id="bot-history-summary">Mon historique botanique<span class="bot-history-count"></span></summary>
        <div class="bot-history-body"></div>
      </details>`;
      historyMarkup = '';
    }
    const count = historyRoot.querySelector('.bot-history-count');
    const countLabel = stats.attempted ? ` · ${stats.attempted} question${stats.attempted > 1 ? 's' : ''}` : '';
    if (count.textContent !== countLabel) count.textContent = countLabel;
    const markup = stats.attempted || stats.skipped ? `
      ${metrics(stats)}
      ${breakdown(stats)}
      <div class="bot-history-details">
        <div class="bot-table-wrap" role="region" aria-label="Détail par thématique" tabindex="0">
          <table class="bot-table"><caption>Résultats par thématique</caption>
            <thead><tr><th scope="col">Thématique</th><th scope="col">Réalisées</th><th scope="col">Reconnaissance</th></tr></thead>
            <tbody>${stats.byCategory.map(item => `<tr><th scope="row">${clean(category(item.id)?.name || item.id)}</th><td>${item.attempted}</td><td>${rate(item.recognitionRate)}</td></tr>`).join('')}</tbody>
          </table>
        </div>
        <div class="bot-table-wrap" role="region" aria-label="Détail quotidien" tabindex="0">
          <table class="bot-table"><caption>Évolution quotidienne (UTC)</caption>
            <thead><tr><th scope="col">Date</th><th scope="col">Réalisées</th><th scope="col">Reconnaissance</th></tr></thead>
            <tbody>${stats.timeline.map(item => `<tr><th scope="row">${day(item.date)}</th><td>${item.attempted}</td><td>${rate(item.recognitionRate)}</td></tr>`).join('')}</tbody>
          </table>
        </div>
      </div>
      <h3>Confusions observées</h3>
      <ul class="bot-confusions">${confusionsObserved()}</ul>
      <p class="bot-help">Les tentatives restent dans ton historique, y compris après une révision réussie.</p>`
      : '<p class="bot-empty">Aucune question réalisée pour le moment. Tes réponses apparaîtront ici.</p>';
    if (historyMarkup !== markup) {
      replaceStatistics(historyRoot.querySelector('.bot-history-body'), markup);
      historyMarkup = markup;
    }
  }
  function confusionsObserved() {
    const pairs = new Map();
    for (const answer of answers.filter(item => item.status === 'incorrect' && item.selectedSpeciesId)) {
      const key = `${answer.speciesId}|${answer.selectedSpeciesId}`;
      pairs.set(key, (pairs.get(key) || 0) + 1);
    }
    return pairs.size ? [...pairs].sort((a, b) => b[1] - a[1]).map(([key, count]) => {
      const [expected, given] = key.split('|');
      return `<li>${clean(species(expected)?.commonName || expected)} → réponse choisie : ${clean(species(given)?.commonName || given)} (${count} tentative${count > 1 ? 's' : ''}).</li>`;
    }).join('') : '<li>Aucune confusion entre deux espèces enregistrée.</li>';
  }
  function stopTicker() {
    if (ticker !== null) window.clearInterval(ticker);
    ticker = null;
    timer?.pause();
  }
  function updateSelectionCounts() {
    const current = getCategoryAvailability(bank, answers).find(item => item.id === categoryId);
    const count = Math.min(10, revision ? current?.revisionCount || 0 : current?.playableCount || 0);
    const output = content.querySelector('#bot-revision-count');
    const revisionCount = current?.revisionCount || 0;
    if (output) {
      const label = revisionCount > 1 ? 'espèces à retravailler' : 'espèce à retravailler';
      if (output.textContent !== String(revisionCount)) output.textContent = revisionCount;
      const revisionLabel = content.querySelector('#bot-revision-label');
      if (revisionLabel.textContent !== label) revisionLabel.textContent = label;
    }
    const start = content.querySelector('[data-start]');
    if (start) start.disabled = !count || saving;
    if (!actionError) {
      const info = content.querySelector('#bot-session-info');
      if (info) {
        const message = count ? `${count} question${count > 1 ? 's' : ''} disponible${count > 1 ? 's' : ''} pour cette session.`
          : revision ? 'Aucune erreur à revoir dans cette catégorie. Choisis une autre catégorie ou désactive la révision.'
            : 'La photothèque doit contenir au moins quatre espèces identifiables pour lancer une session.';
        if (info.textContent !== message) info.textContent = message;
      }
    }
  }
  async function saveSession() {
    if (!session || saving) return;
    const current = identityEpoch; saving = true; actionNotice('Enregistrement de la session sur cet appareil…');
    const start = content.querySelector('[data-start]'); if (start) start.disabled = true;
    const settings = [...content.querySelectorAll('.bot-settings input, .bot-settings select')];
    settings.forEach(input => { input.disabled = true; });
    let result;
    try { result = await service.createSession(session); }
    catch { result = { error: 'Le navigateur n’a pas pu enregistrer cette session.' }; }
    if (!activeSource(current)) return;
    saving = false;
    if (result.error || result.accountChanged) {
      settings.forEach(input => { input.disabled = false; });
      actionNotice(result.error || 'Le compte a changé. Aucune session créée dans le nouveau compte.', 'session');
      if (state.mode === 'visitor') saveOption('Jouer sans sauvegarder', 'data-visitor-play');
      if (start) start.disabled = true;
      return;
    }
    sessionSaved = true; completionAt = null;
    renderQuestion();
  }
  async function finishSession() {
    if (!session || !sessionSaved || saving) return;
    stopTicker();
    if (visitorMemory && state.mode === 'visitor') {
      renderResults(); actionNotice('Résultats visibles pour cette visite uniquement. Ils ne sont pas sauvegardés.'); session = null; return;
    }
    const current = identityEpoch; saving = true;
    // Keep the actual first finish time through storage failures and retries.
    completionAt ??= new Date().toISOString();
    let result;
    try { result = await service.completeSession(session.id, completionAt); }
    catch { result = { error: 'Le navigateur n’a pas pu enregistrer la fin de cette session.' }; }
    if (!activeSource(current)) return;
    saving = false;
    renderResults();
    if (result.error || result.accountChanged) {
      actionNotice(result.error || 'Le compte a changé. La fin n’a pas été enregistrée dans le nouveau compte.', 'completion');
      content.querySelector('[data-new]').disabled = !result.conflict;
    } else {
      actionNotice('Fin de session enregistrée sur cet appareil.');
      session = null;
    }
  }
  function renderSelection(shouldFocus = false) {
    stopTicker();
    screen = 'selection';
    root.dataset.botScreen = screen;
    resultSession = null;
    completionAt = null;
    actionError = '';
    session = null;
    const available = getCategoryAvailability(bank, answers);
    const cards = available.map(item => {
      const pressed = item.id === categoryId;
      return `<button type="button" class="${action} bot-category" data-category="${clean(item.id)}" aria-pressed="${pressed}" ${item.playable ? '' : 'disabled'}>
        <strong>${clean(item.name)}</strong>
        <span class="bot-category-description">${clean(item.description)}</span>
        <span class="bot-category-count">${item.speciesCount} espèce${item.speciesCount > 1 ? 's' : ''} · ${item.playableCount} question${item.playableCount > 1 ? 's' : ''} jouable${item.playableCount > 1 ? 's' : ''}</span>
        ${item.playable ? '<span class="bot-category-selected" aria-hidden="true">✓ Sélectionnée</span>' : '<span class="bot-category-unavailable">Photothèque à compléter</span>'}
      </button>`;
    }).join('');
    content.innerHTML = `<section class="bot-panel bot-setup">
      <div class="bot-topline">
        <h2 class="bot-heading" tabindex="-1">Quel regard veux-tu entraîner ?</h2>
        <a class="${action}" href="#bot-history-summary">Consulter mon historique</a>
      </div>
      <div class="bot-categories" role="group" aria-label="Catégories botaniques">${cards}</div>
      <div class="bot-settings">
        <fieldset>
          <legend>Mode d’entraînement</legend>
          <div class="bot-modes">
            <label class="bot-mode"><input type="radio" name="bot-mode" value="discovery" ${mode === 'discovery' ? 'checked' : ''}>
              <span><strong>Découverte</strong><small>Observe à ton rythme, sans limite de temps.</small></span>
            </label>
            <label class="bot-mode"><input type="radio" name="bot-mode" value="chrono" ${mode === 'chrono' ? 'checked' : ''}>
              <span><strong>Chrono</strong><small>Un temps par photographie. La correction reste en lecture libre.</small></span>
            </label>
          </div>
          <div class="bot-duration" ${mode === 'chrono' ? '' : 'hidden'}>
            <label for="bot-duration">Durée par question</label>
            <select id="bot-duration" aria-describedby="bot-duration-help">${[15, 30, 45, 60].map(value => `<option value="${value}" ${value === durationSeconds ? 'selected' : ''}>${value} secondes</option>`).join('')}</select>
            <p id="bot-duration-help" class="bot-help">Le décompte part quand la photo est chargée. Tu peux le mettre en pause. Il se suspend aussi quand tu changes d’onglet.</p>
          </div>
        </fieldset>
        <div class="bot-revision-setting">
          <h3>Révision</h3>
          <label class="bot-revision"><input type="checkbox" id="bot-revision" ${revision ? 'checked' : ''} aria-describedby="bot-revision-help">
            <span><strong>Revoir mes erreurs dans cette catégorie</strong><small><span id="bot-revision-count"></span> <span id="bot-revision-label"></span></small></span>
          </label>
          <p id="bot-revision-help" class="bot-help">Les erreurs et les temps écoulés restent à réviser après une réussite.</p>
        </div>
      </div>
      <div class="bot-start">
        <p id="bot-session-info" role="status"></p>
        <button type="button" class="${primaryAction}" data-start disabled aria-describedby="bot-session-info">Commencer la session <span aria-hidden="true">→</span></button>
      </div>
      <div class="bot-actions" data-save-actions></div>
    </section>`;
    updateSelectionCounts();
    if (shouldFocus) focus('.bot-heading');
    renderHistory();
  }
  function updateTimer() {
    if (!timer || !session || outcome) return;
    const output = content.querySelector('#bot-time');
    const remaining = `${Math.ceil(timer.remainingMs() / 1000)} s`;
    if (output && output.textContent !== remaining) output.textContent = remaining;
    const paused = manuallyPaused || document.hidden;
    const pauseButton = content.querySelector('[data-pause]');
    const pauseLabel = manuallyPaused ? 'Reprendre' : 'Mettre en pause';
    if (pauseButton && pauseButton.textContent !== pauseLabel) pauseButton.textContent = pauseLabel;
    const pausedText = content.querySelector('#bot-paused');
    const pauseMessage = paused ? 'Chronomètre en pause.' : '';
    if (pausedText && pausedText.textContent !== pauseMessage) pausedText.textContent = pauseMessage;
    for (const button of content.querySelectorAll('[data-choice]')) button.disabled = !imageReady || paused;
    const validate = content.querySelector('[data-validate]');
    if (validate) validate.disabled = !selected || !imageReady || paused;
    if (imageReady && timer.isExpired()) complete('timeout');
  }
  function resumeTimer() {
    if (!timer || !imageReady || outcome || manuallyPaused || document.hidden) return;
    if (timerStarted) timer.resume();
    else { timer.start(); timerStarted = true; }
    updateTimer();
  }
  function loadPhoto(restoreFocus = false) {
    const photo = bank.photos.find(item => item.id === session.questions[index].photoId);
    const frame = content.querySelector('.bot-photo-frame');
    const attempt = ++imageAttempt;
    if (restoreFocus) focus('#bot-question-heading');
    frame.innerHTML = '<span class="bot-loading" role="status">Chargement de la photographie…</span>';
    imageReady = false;
    const img = new Image();
    img.alt = `Photographie à identifier : ${photo.alt || `${photo.organ}, stade ${photo.stage}.`}`;
    img.dataset.photoId = photo.id;
    img.addEventListener('load', () => {
      if (attempt !== imageAttempt || !session || signal.aborted) return;
      imageReady = true;
      const mount = document.createElement('div');
      mount.className = 'bot-photo-mount';
      mount.append(img);
      frame.replaceChildren(mount);
      if (photo.id === 'groseillier-rouge-01') {
        const address = creditAddress(photo);
        frame.insertAdjacentHTML('afterend', `<figcaption class="bot-required-credit">${clean(photo.author)} / ${link(address, address)}</figcaption>`);
      }
      resumeTimer();
      updateChoices();
    }, { once: true });
    img.addEventListener('error', () => {
      if (attempt !== imageAttempt || !session || signal.aborted) return;
      timer?.pause();
      frame.innerHTML = `<div class="bot-image-error">
        <h3>Photographie indisponible</h3>
        <p role="status">Tu peux réessayer ou passer cette question hors calcul.</p>
        <div class="bot-actions">
          <button type="button" class="${action}" data-retry-image>Réessayer l’image</button>
          <button type="button" class="${primaryAction}" data-skip-image>Passer sans compter</button>
        </div>
      </div>`;
      if (restoreFocus && document.activeElement?.id === 'bot-question-heading') focus('[data-retry-image]');
    }, { once: true });
    // Catalogue paths are site-root relative (without leading slash), preserving Pages prefixes.
    img.src = new URL(photo.path, document.baseURI).href;
  }
  function renderQuestion() {
    stopTicker();
    screen = 'question';
    root.dataset.botScreen = screen;
    selected = null;
    outcome = null;
    savedOutcome = false;
    actionError = '';
    imageReady = false;
    timerStarted = false;
    manuallyPaused = false;
    const question = session.questions[index];
    timer = createQuestionTimer({ durationMs: session.mode === 'chrono' ? session.durationSeconds * 1000 : Number.MAX_SAFE_INTEGER });
    const questionLabel = `Question ${index + 1} sur ${session.questions.length}`;
    const choiceButtons = question.choices.map((id, position) => `
      <button class="${action} bot-choice" type="button" data-choice="${clean(id)}" aria-pressed="false" disabled>
        <span class="bot-choice-letter" aria-hidden="true">${String.fromCharCode(65 + position)}</span>
        <span>${clean(species(id)?.commonName)}<small class="bot-choice-state" aria-hidden="true"></small></span>
      </button>`).join('');
    content.innerHTML = `<section class="bot-panel bot-observation">
      <div class="bot-session-header">
        <div class="bot-session-track">
          <p class="bot-context">${clean(category(session.categoryId)?.name)} · ${session.mode === 'chrono' ? 'Chrono' : 'Découverte'}${session.revision ? ' · Révision' : ''}</p>
          <h2 id="bot-question-heading" class="bot-heading" tabindex="-1">${questionLabel}</h2>
          <progress class="bot-progress" value="${index + 1}" max="${session.questions.length}" aria-label="Progression de la session" aria-valuetext="${questionLabel}"></progress>
        </div>
        ${session.mode === 'chrono' ? `<div class="bot-timer">
          <div><span>Temps restant</span><output id="bot-time" aria-label="Temps restant" aria-live="off">${session.durationSeconds} s</output></div>
          <button class="${action}" type="button" data-pause>Mettre en pause</button>
          <p id="bot-paused" role="status"></p>
        </div>` : ''}
      </div>
      <div class="bot-question">
        <figure class="bot-photo">
          <div class="bot-photo-frame"></div>
        </figure>
        <div class="bot-answering">
          <h3>Quelle plante observes-tu ?</h3>
          <div class="bot-choices" role="group" aria-label="Quatre propositions">${choiceButtons}</div>
          <div class="bot-actions">
            <button class="${primaryAction}" type="button" data-validate disabled>Valider ma réponse</button>
            <button class="${action}" type="button" data-stop>Terminer cette session</button>
          </div>
        </div>
      </div>
      <div id="bot-feedback">
        <span id="bot-correction-announcement" class="sr-only" role="status" aria-live="polite"></span>
        <div id="bot-correction-content"></div>
      </div>
    </section>`;
    loadPhoto();
    focus('#bot-question-heading');
    if (session.mode === 'chrono') ticker = window.setInterval(updateTimer, 200);
  }
  function updateChoices() {
    for (const button of content.querySelectorAll('[data-choice]')) {
      button.setAttribute('aria-pressed', String(button.dataset.choice === selected));
      button.disabled = !imageReady || manuallyPaused || document.hidden || Boolean(outcome);
      button.querySelector('.bot-choice-state').textContent = button.dataset.choice === selected ? 'Sélectionnée' : '';
    }
    const validate = content.querySelector('[data-validate]');
    if (validate) validate.disabled = !imageReady || !selected || manuallyPaused || document.hidden || Boolean(outcome);
  }
  function complete(status) {
    if (outcome || !session || saving) return;
    if (!status && (!selected || !imageReady || manuallyPaused || document.hidden)) return;
    // A click arriving after the deadline is a timeout, regardless of interval scheduling.
    if (session.mode === 'chrono' && status !== 'skipped_image' && timer.isExpired()) status = 'timeout';
    stopTicker();
    const question = session.questions[index];
    outcome = evaluateAnswer(session, question, { selectedSpeciesId: status ? null : selected, status, elapsedMs: timer.elapsedMs() });
    savedOutcome = false;
    const plant = species(question.speciesId);
    const photo = bank.photos.find(item => item.id === question.photoId);
    for (const button of content.querySelectorAll('[data-choice]')) {
      button.disabled = true;
      const label = button.querySelector('.bot-choice-state');
      if (button.dataset.choice === question.speciesId) {
        button.classList.add('correct');
        label.textContent = '✓ Réponse correcte';
      } else if (button.dataset.choice === selected && outcome.status === 'incorrect') {
        button.classList.add('incorrect');
        label.textContent = '✗ Ta réponse';
      } else label.textContent = '';
      label.removeAttribute('aria-hidden');
    }
    content.querySelector('[data-validate]').hidden = true;
    const pause = content.querySelector('[data-pause]');
    if (pause) pause.disabled = true;
    const title = { correct: 'Réponse correcte', incorrect: 'Réponse incorrecte', timeout: 'Temps écoulé', skipped_image: 'Photographie passée, hors calcul' }[outcome.status];
    const confusions = (bank.confusions || []).filter(item => item.speciesId === plant.id);
    content.querySelector('#bot-correction-content').innerHTML = `<section class="bot-correction" aria-labelledby="bot-correction-title">
      <div class="bot-correction-header">
        <p class="bot-outcome" data-status="${outcome.status}">${title}${outcome.status === 'timeout' ? ' · aucune réponse fournie dans le temps imparti' : ''}</p>
        <h2 id="bot-correction-title" tabindex="-1">${clean(plant.commonName)}</h2>
        <p class="bot-taxonomy"><i>${clean(plant.scientificName)}</i> · ${clean(plant.family)}</p>
        ${outcome.status === 'incorrect' ? `<p>Ta réponse <strong>${clean(species(outcome.selectedSpeciesId)?.commonName)}</strong></p>` : ''}
        <p>${clean(plant.description)}</p>
      </div>
      <div class="bot-correction-body">
        <section class="bot-observed">
          <h3>Ce que montre cette photographie</h3><p>${clean(photo.identification)}</p>
          <ul>${(photo.visibleCriteria || []).map(item => `<li>${clean(item)}</li>`).join('')}</ul>
          <dl class="bot-photo-facts"><div><dt>Stade</dt><dd>${clean(photo.stage)}</dd></div><div><dt>Organe</dt><dd>${clean(photo.organ)}</dd></div></dl>
        </section>
        <div class="bot-background">
          <details><summary>Caractères botaniques de l’espèce</summary>
            <ul>${(plant.criteria || []).map(item => `<li>${clean(item)}</li>`).join('')}</ul>
            <p class="bot-help">Ces caractères généraux ne sont pas tous visibles sur la photographie.</p>
          </details>
          ${confusions.length ? `<h3>Confusions documentées</h3><ul>${confusions.map(item => `<li>${clean(species(item.otherSpeciesId)?.commonName)} : ${clean(item.explanation)}</li>`).join('')}</ul>` : ''}
          <h3>Sources botaniques</h3>
          <ul class="bot-sources">${(plant.sources || []).map(source => `<li>${link(source.url, source.title)}</li>`).join('')}</ul>
        </div>
      </div>
      <div class="bot-correction-footer">
        <p id="bot-save-message" class="bot-notice" role="status"></p>
        <div class="bot-actions" data-save-actions></div>
        <div class="bot-actions bot-correction-actions"><button class="${primaryAction}" type="button" data-next disabled>${index + 1 === session.questions.length ? 'Voir les résultats' : 'Question suivante'} <span aria-hidden="true">→</span></button></div>
      </div>
    </section>`;
    const stop = content.querySelector('[data-stop]');
    stop.disabled = true;
    content.querySelector('.bot-correction-actions').append(stop);
    content.querySelector('#bot-correction-announcement').textContent = title;
    focus('#bot-correction-title');
    saveAnswer();
  }
  function resultData(stats, sessionAnswers) {
    const duration = resultSession.mode === 'chrono' ? `<div class="bot-result-time">
      <dl><div><dt>Durée chronométrée</dt><dd>${stats.attempted ? chronoDuration(sessionAnswers) : 'Non mesurée'}</dd></div></dl>
      <p class="bot-help">Temps cumulé des questions comptées, pauses exclues.</p>
    </div>` : '';
    return `${duration}${metrics(stats)}${stats.bySpecies.length ? breakdown(stats) : ''}`;
  }
  function resultCount(stats) {
    return `${stats.attempted} question${stats.attempted > 1 ? 's' : ''} réalisée${stats.attempted > 1 ? 's' : ''} sur ${resultSession.questions.length} proposée${resultSession.questions.length > 1 ? 's' : ''}.`;
  }
  function refreshResults() {
    if (!resultSession) return;
    const sessionAnswers = answers.filter(item => item.sessionId === resultSession.id);
    const stats = calculateStats(sessionAnswers);
    const count = content.querySelector('#bot-result-count');
    if (count) count.textContent = resultCount(stats);
    const data = content.querySelector('#bot-result-data');
    if (data) replaceStatistics(data, resultData(stats, sessionAnswers));
  }
  function renderResults() {
    stopTicker();
    ++imageAttempt;
    screen = 'results';
    root.dataset.botScreen = screen;
    resultSession = session;
    const sessionAnswers = answers.filter(item => item.sessionId === session.id);
    const stats = calculateStats(sessionAnswers);
    content.innerHTML = `<section class="bot-panel bot-results">
      <p class="bot-context">${clean(category(session.categoryId)?.name)} · ${session.mode === 'chrono' ? 'Chrono' : 'Découverte'}${session.revision ? ' · Révision' : ''}</p>
      <h2 class="bot-heading" tabindex="-1">Résultats de la session</h2>
      <p id="bot-result-count">${resultCount(stats)}</p>
      <div id="bot-result-data">${resultData(stats, sessionAnswers)}</div>
      <p class="bot-help">Le taux est calculé sur les réponses correctes, les réponses incorrectes et les expirations du chrono. Les photographies passées et les questions sans réponse restent hors calcul.</p>
      <p id="bot-save-message" class="bot-notice" role="status"></p>
      <div class="bot-actions" data-save-actions></div>
      <div class="bot-actions"><button class="${primaryAction}" type="button" data-new>Choisir une nouvelle session</button></div>
    </section>`;
    focus('.bot-heading');
    renderHistory();
    timer = null;
  }
  content.addEventListener('change', event => {
    if (saving) return;
    if (event.target.name === 'bot-mode') { mode = event.target.value; content.querySelector('.bot-duration').hidden = mode !== 'chrono'; }
    if (event.target.id === 'bot-duration') durationSeconds = Number(event.target.value);
    if (event.target.id === 'bot-revision') { revision = event.target.checked; renderSelection(); focus('#bot-revision'); }
  }, { signal });
  content.addEventListener('click', async event => {
    const historyLink = event.target.closest('a[href="#bot-history-summary"]');
    if (historyLink) {
      const summary = historyRoot.querySelector('summary');
      if (summary) {
        event.preventDefault();
        summary.parentElement.open = true;
        summary.focus();
        summary.scrollIntoView({ block: 'nearest' });
      }
      return;
    }
    const button = event.target.closest('button');
    if (!button || button.disabled || saving) return;
    if (button.dataset.category) { categoryId = button.dataset.category; renderSelection(); focus(`[data-category="${categoryId}"]`); }
    else if (button.hasAttribute('data-start')) {
      try {
        session = createSession(bank, { categoryId, mode, durationSeconds, revision, history: answers });
        visitorMemory = false;
        index = 0;
        await saveSession();
      } catch { content.querySelector('#bot-session-info').textContent = 'Cette catégorie ne permet pas de lancer une session. Choisis une autre catégorie.'; }
    } else if (button.dataset.choice) { selected = button.dataset.choice; updateChoices(); }
    else if (button.hasAttribute('data-validate')) complete();
    else if (button.hasAttribute('data-next')) { if (!savedOutcome) return; if (++index < session.questions.length) renderQuestion(); else await finishSession(); }
    else if (button.hasAttribute('data-stop')) { if (outcome && !savedOutcome) return; await finishSession(); }
    else if (button.hasAttribute('data-new')) renderSelection(true);
    else if (button.dataset.retrySave) {
      const operation = button.dataset.retrySave;
      const wasFocused = button === document.activeElement;
      if (operation === 'answer') await saveAnswer();
      if (operation === 'session') await saveSession();
      if (operation === 'completion') await finishSession();
      if (wasFocused && document.activeElement === document.body) {
        const target = content.querySelector('[data-retry-save], [data-next]:enabled, [data-new]:enabled');
        target?.focus({ preventScroll: true });
      }
    }
    else if (button.hasAttribute('data-visitor-continue')) continueVisitor();
    else if (button.hasAttribute('data-visitor-play') && state.mode === 'visitor') { visitorMemory = true; sessionSaved = true; renderQuestion(); }
    else if (button.hasAttribute('data-abandon')) renderSelection(true);
    else if (button.hasAttribute('data-retry-image')) loadPhoto(button === document.activeElement);
    else if (button.hasAttribute('data-skip-image')) complete('skipped_image');
    else if (button.hasAttribute('data-pause')) {
      manuallyPaused = !manuallyPaused;
      if (manuallyPaused) timer.pause(); else resumeTimer();
      updateTimer();
    }
  }, { signal });
  document.addEventListener('visibilitychange', () => {
    if (!session || outcome || session.mode !== 'chrono') return;
    if (document.hidden) timer?.pause(); else resumeTimer();
    updateTimer();
  }, { signal });
  signal.addEventListener('abort', () => { stopTicker(); ++imageAttempt; }, { once: true });
  window.addEventListener('pagehide', stopTicker, { signal });
  window.addEventListener('pageshow', () => {
    if (!session || outcome || session.mode !== 'chrono') return;
    if (ticker === null) ticker = window.setInterval(updateTimer, 200);
    resumeTimer();
    updateTimer();
  }, { signal });
  const unsubscribe = service.subscribe(next => {
    const nextSource = `${next.mode}:${next.scope}`;
    const changed = source !== nextSource || next.sync.state === 'session' && state.sync.state !== 'session';
    const previousAnswers = JSON.stringify(answers);
    state = next; source = nextSource;
    if (changed) {
      identityEpoch++;
      stopTicker(); ++imageAttempt; session = null; outcome = null;
      resultSession = null;
      saving = false; completionAt = null; sessionSaved = false; savedOutcome = false;
      screen = 'selection';
      visitorMemory = false; volatileAnswers = [];
    }
    answers = next.mode === 'visitor' ? [...next.view.history.answers, ...volatileAnswers.filter(item => !next.view.history.answers.some(saved => saved.id === item.id))] : next.view.history.answers;
    if (next.view.error && next.mode !== 'visitor') {
      if (screen !== 'blocked') identityEpoch++;
      saving = false; outcome = null; resultSession = null; sessionSaved = false; savedOutcome = false;
      stopTicker(); ++imageAttempt; session = null; screen = 'blocked';
      root.dataset.botScreen = screen;
      content.innerHTML = `<section class="bot-panel"><h2>Historique personnel indisponible</h2><p>${clean(next.view.error)}</p><p>Vérifie la connexion au compte puis actualise l’historique. Les résultats déjà enregistrés restent conservés.</p></section>`;
      historyRoot.innerHTML = ''; return;
    }
    if (changed || screen === 'blocked') renderSelection();
    else if (screen === 'selection') updateSelectionCounts();
    if (previousAnswers !== JSON.stringify(answers) || changed) { renderHistory(); if (screen === 'results') refreshResults(); }
  });
  signal.addEventListener('abort', unsubscribe, { once: true });
  if (screen !== 'blocked') renderSelection();
}
