import { renderBreadcrumbs } from './breadcrumbs.js';
import { getCategoryAvailability, createSession, evaluateAnswer, calculateStats, createQuestionTimer } from './botanical-engine.js';
import { createBotanicalStore } from './botanical-store.js';

const clean = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const link = (url, label) => /^https:\/\//.test(url || '') ? `<a href="${clean(url)}" target="_blank" rel="noopener noreferrer">${clean(label)}</a>` : clean(label);
const rate = value => value === null ? 'Aucune donnée' : `${Math.round(value)} %`;
const day = value => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
const controllers = new WeakMap();

export async function initBotanical(root) {
  controllers.get(root)?.abort();
  const controller = new AbortController();
  controllers.set(root, controller);
  const { signal } = controller;
  root.innerHTML = `<section class="page-top wrap bot-intro">${renderBreadcrumbs('botanical')}<div class="page-eyebrow">OBSERVER · RECONNAÎTRE · COMPRENDRE</div><h1>Reconnaissance des plantes</h1><p>Entraîne ton regard, une photographie à la fois. Choisis une thématique, puis prends le temps de comprendre les caractères qui font la différence.</p></section><div class="wrap bot-layout"><div id="bot-storage" role="status"></div><div id="bot-content"><p role="status">Chargement de la photothèque…</p></div><div id="bot-history"></div><p class="bot-help">Un entraînement botanique indépendant des exercices hebdomadaires. Les résultats restent sur ce navigateur.</p></div>`;
  const content = root.querySelector('#bot-content');
  const historyRoot = root.querySelector('#bot-history');
  const storageRoot = root.querySelector('#bot-storage');
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
  const store = createBotanicalStore();
  let answers = store.load().answers;
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
  let sessionAnswers = [];
  const species = id => bank.species.find(item => item.id === id);
  const category = id => bank.categories.find(item => item.id === id);
  const focus = selector => content.querySelector(selector)?.focus();

  function storageNotice() {
    storageRoot.innerHTML = store.status.message ? `<p class="bot-notice">${clean(store.status.message)}${store.status.writable ? '' : ' Les résultats de cette visite restent visibles, mais ne pourront pas être conservés. Les données déjà présentes restent intactes.'}</p>` : '';
  }
  function saveAnswer(answer) {
    store.recordAnswer(answer);
    // Keep this visit useful even when browser storage is unavailable or read-only.
    if (!answers.some(item => item.id === answer.id)) answers.push(answer);
    storageNotice();
  }
  function metrics(stats) {
    return `<dl class="bot-metrics"><div><dt>Questions réalisées</dt><dd>${stats.attempted}</dd></div><div><dt>Réponses correctes</dt><dd>${stats.correct}</dd></div><div><dt>Réponses incorrectes</dt><dd>${stats.incorrect}</dd></div><div><dt>Temps écoulés</dt><dd>${stats.timeouts}</dd></div><div><dt>Taux de reconnaissance</dt><dd>${rate(stats.recognitionRate)}</dd></div></dl>`;
  }
  function breakdown(stats) {
    return `<div class="bot-table-wrap"><table class="bot-table"><caption>Résultats par espèce</caption><thead><tr><th scope="col">Espèce</th><th scope="col">Réalisées</th><th scope="col">Correctes</th><th scope="col">Incorrectes</th><th scope="col">Temps écoulés</th><th scope="col">Reconnaissance</th></tr></thead><tbody>${stats.bySpecies.map(item => `<tr><th scope="row">${clean(species(item.id)?.commonName || item.id)}</th><td>${item.attempted}</td><td>${item.correct}</td><td>${item.incorrect}</td><td>${item.timeouts}</td><td>${rate(item.recognitionRate)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function renderHistory() {
    const stats = calculateStats(answers);
    historyRoot.innerHTML = `<details class="bot-panel bot-history"><summary>Mon historique botanique${stats.attempted ? ` · ${stats.attempted} question${stats.attempted > 1 ? 's' : ''}` : ''}</summary>${stats.attempted ? `${metrics(stats)}${breakdown(stats)}<div class="bot-history-details"><div class="bot-table-wrap"><table class="bot-table"><caption>Résultats par thématique</caption><thead><tr><th scope="col">Thématique</th><th scope="col">Réalisées</th><th scope="col">Reconnaissance</th></tr></thead><tbody>${stats.byCategory.map(item => `<tr><th scope="row">${clean(category(item.id)?.name || item.id)}</th><td>${item.attempted}</td><td>${rate(item.recognitionRate)}</td></tr>`).join('')}</tbody></table></div><div class="bot-table-wrap"><table class="bot-table"><caption>Évolution quotidienne (UTC)</caption><thead><tr><th scope="col">Date</th><th scope="col">Réalisées</th><th scope="col">Reconnaissance</th></tr></thead><tbody>${stats.timeline.map(item => `<tr><th scope="row">${day(item.date)}</th><td>${item.attempted}</td><td>${rate(item.recognitionRate)}</td></tr>`).join('')}</tbody></table></div></div><h3>Confusions observées</h3><ul class="bot-help">${confusionsObserved()}</ul><p class="bot-help">Le taux porte sur les réponses validées et les temps écoulés. Les photographies indisponibles sont exclues. Chaque tentative reste dans l’historique, y compris après une révision réussie.</p>` : '<p class="bot-empty">Aucune question réalisée pour le moment. Ton historique se construira à partir de tes réponses.</p>'}</details>`;
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
  function renderSelection(shouldFocus = false) {
    stopTicker();
    session = null;
    const available = getCategoryAvailability(bank, answers);
    const current = available.find(item => item.id === categoryId);
    const count = Math.min(10, revision ? current?.revisionCount || 0 : current?.playableCount || 0);
    content.innerHTML = `<section class="bot-panel"><div class="bot-topline"><div><h2 class="bot-heading" tabindex="-1">Quel regard veux-tu entraîner ?</h2><p>Choisis une catégorie pour commencer.</p></div><span class="bot-tag">Photothèque initiale · niveau facile</span></div><div class="bot-categories" role="group" aria-label="Catégories botaniques">${available.map(item => `<button type="button" class="bot-category" data-category="${clean(item.id)}" aria-pressed="${item.id === categoryId}" ${item.playable ? '' : 'disabled'}><span class="bot-symbol" aria-hidden="true">${clean(item.icon || '🌿')}</span><strong>${clean(item.name)}</strong><span>${clean(item.description)}</span><span>${item.speciesCount} espèce${item.speciesCount > 1 ? 's' : ''} · ${item.playableCount} question${item.playableCount > 1 ? 's' : ''} jouable${item.playableCount > 1 ? 's' : ''}</span><small>${item.playable ? item.id === categoryId ? '✓ Catégorie sélectionnée' : 'Choisir cette catégorie' : 'Photothèque à compléter'}</small></button>`).join('')}</div><div class="bot-settings"><fieldset><legend>Ton mode d’entraînement</legend><label class="bot-mode"><input type="radio" name="bot-mode" value="discovery" ${mode === 'discovery' ? 'checked' : ''}><span><strong>Découverte</strong><small>Sans limite de temps. Observe, réponds et lis la correction à ton rythme.</small></span></label><label class="bot-mode"><input type="radio" name="bot-mode" value="chrono" ${mode === 'chrono' ? 'checked' : ''}><span><strong>Chrono</strong><small>Un temps par photographie, puis une correction sans chronomètre.</small></span></label></fieldset><div><div class="bot-duration" ${mode === 'chrono' ? '' : 'hidden'}><label for="bot-duration">Durée par question</label><select id="bot-duration">${[15, 30, 45, 60].map(value => `<option value="${value}" ${value === durationSeconds ? 'selected' : ''}>${value} secondes</option>`).join('')}</select><p class="bot-help">Le chrono démarre après le chargement de l’image. Il se met en pause quand l’onglet est masqué, et reprend à ton retour. Tu peux aussi le mettre en pause.</p></div><label class="bot-revision"><input type="checkbox" id="bot-revision" ${revision ? 'checked' : ''}><span>Revoir mes erreurs dans cette catégorie<br><span class="soft-text">${current?.revisionCount || 0} espèce${current?.revisionCount > 1 ? 's' : ''} à retravailler · erreurs et temps écoulés</span></span></label><p class="bot-help">Les espèces restent dans cette révision après une réussite : l’historique des tentatives est conservé.</p></div></div><div class="bot-start"><p id="bot-session-info">${count ? `${count} question${count > 1 ? 's' : ''} disponible${count > 1 ? 's' : ''} pour cette session${count < 10 ? ' courte (sur un maximum de 10)' : ''}. Une espèce n’apparaît qu’une fois.` : revision ? 'Aucune erreur à revoir dans cette catégorie. Choisis une autre catégorie ou désactive la révision.' : 'Cette catégorie ne dispose pas encore de quatre espèces identifiables pour proposer une session.'}</p><button type="button" class="btn btn-primary" data-start ${count ? '' : 'disabled'} aria-describedby="bot-session-info">Commencer la session <span aria-hidden="true">→</span></button></div></section><p class="bot-help">Le catalogue est volontairement limité. Les catégories signalées « à compléter » nécessitent des photographies identifiées, autorisées et accompagnées de critères vérifiés.</p>`;
    if (shouldFocus) focus('.bot-heading');
    renderHistory();
    storageNotice();
  }
  function updateTimer() {
    if (!timer || !session || outcome) return;
    const output = content.querySelector('#bot-time');
    if (output) output.textContent = `${Math.ceil(timer.remainingMs() / 1000)} s`;
    const paused = manuallyPaused || document.hidden;
    const pauseButton = content.querySelector('[data-pause]');
    if (pauseButton) pauseButton.textContent = manuallyPaused ? 'Reprendre' : 'Mettre en pause';
    const pausedText = content.querySelector('#bot-paused');
    if (pausedText) pausedText.textContent = paused ? 'Chronomètre en pause.' : '';
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
  function loadPhoto() {
    const photo = bank.photos.find(item => item.id === session.questions[index].photoId);
    const frame = content.querySelector('.bot-photo-frame');
    const attempt = ++imageAttempt;
    frame.innerHTML = '<span class="bot-loading" role="status">Chargement de la photographie…</span>';
    imageReady = false;
    const img = new Image();
    img.alt = `Photographie à identifier : ${photo.alt || `${photo.organ}, stade ${photo.stage}.`}`;
    img.dataset.photoId = photo.id;
    img.addEventListener('load', () => {
      if (attempt !== imageAttempt || !session || signal.aborted) return;
      imageReady = true;
      frame.replaceChildren(img);
      resumeTimer();
      updateChoices();
    }, { once: true });
    img.addEventListener('error', () => {
      if (attempt !== imageAttempt || !session || signal.aborted) return;
      timer?.pause();
      frame.innerHTML = '<div class="bot-image-error" role="status"><h3>Photographie indisponible</h3><p>Cette question ne comptera pas comme une erreur.</p><div class="bot-actions"><button type="button" class="btn btn-outline" data-retry-image>Réessayer l’image</button><button type="button" class="btn btn-primary" data-skip-image>Passer sans compter</button></div></div>';
    }, { once: true });
    // Catalogue paths are site-root relative (without leading slash), preserving Pages prefixes.
    img.src = new URL(photo.path, document.baseURI).href;
  }
  function renderQuestion() {
    stopTicker();
    selected = null;
    outcome = null;
    imageReady = false;
    timerStarted = false;
    manuallyPaused = false;
    const question = session.questions[index];
    const photo = bank.photos.find(item => item.id === question.photoId);
    timer = createQuestionTimer({ durationMs: session.mode === 'chrono' ? session.durationSeconds * 1000 : Number.MAX_SAFE_INTEGER });
    content.innerHTML = `<section class="bot-panel"><div class="bot-topline"><span class="bot-tag">${clean(category(session.categoryId)?.name)} · ${session.mode === 'chrono' ? 'Chrono' : 'Découverte'}${session.revision ? ' · Révision' : ''}</span><button class="btn btn-outline" type="button" data-stop>Terminer cette session</button></div><progress class="bot-progress" value="${index}" max="${session.questions.length}" aria-label="Progression de la session"></progress><div class="bot-topline"><h2 id="bot-question-heading" class="bot-heading" tabindex="-1">Question ${index + 1} sur ${session.questions.length}</h2>${session.mode === 'chrono' ? `<div class="bot-timer"><span>Temps restant</span><output id="bot-time" aria-label="Temps restant">${session.durationSeconds} s</output><button class="btn btn-outline" type="button" data-pause>Mettre en pause</button></div>` : '<span class="bot-help">Prends le temps d’observer.</span>'}</div><p id="bot-paused" class="bot-help" role="status"></p><div class="bot-question"><figure class="bot-photo"><div class="bot-photo-frame"></div><figcaption>${clean(photo.author)} · ${link(photo.licenseUrl, photo.license)} · ${link(photo.sourceUrl, 'Source de la photographie')}${photo.attribution ? `<br>${clean(photo.attribution)}` : ''}${photo.sourceTitle ? `<details><summary>Crédit complet</summary><span>Titre de la photographie : « ${clean(photo.sourceTitle)} ».</span></details>` : ''}</figcaption></figure><div><h3>Quelle plante observes-tu ?</h3><p class="bot-help">Une seule réponse est correcte. Sélectionne un nom, puis valide.</p><div class="bot-choices" role="group" aria-label="Quatre propositions">${question.choices.map((id, position) => `<button class="bot-choice" type="button" data-choice="${clean(id)}" aria-pressed="false" disabled><span class="bot-choice-letter" aria-hidden="true">${String.fromCharCode(65 + position)}</span><span>${clean(species(id)?.commonName)}</span><span class="bot-choice-state"></span></button>`).join('')}</div><button class="btn btn-primary" type="button" data-validate disabled>Valider ma réponse</button></div></div><div id="bot-feedback" aria-live="polite" aria-atomic="true"></div></section>`;
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
    if (outcome || !session) return;
    if (!status && (!selected || !imageReady || manuallyPaused || document.hidden)) return;
    // A click arriving after the deadline is a timeout, regardless of interval scheduling.
    if (session.mode === 'chrono' && status !== 'skipped_image' && timer.isExpired()) status = 'timeout';
    stopTicker();
    const question = session.questions[index];
    outcome = evaluateAnswer(session, question, { selectedSpeciesId: status ? null : selected, status, elapsedMs: timer.elapsedMs() });
    saveAnswer(outcome);
    sessionAnswers.push(outcome);
    const plant = species(question.speciesId);
    const photo = bank.photos.find(item => item.id === question.photoId);
    for (const button of content.querySelectorAll('[data-choice]')) {
      button.disabled = true;
      if (button.dataset.choice === question.speciesId) { button.classList.add('correct'); button.querySelector('.bot-choice-state').textContent = '✓ Réponse correcte'; }
      else if (button.dataset.choice === selected && outcome.status === 'incorrect') { button.classList.add('incorrect'); button.querySelector('.bot-choice-state').textContent = '✗ Ta réponse'; }
    }
    content.querySelector('[data-validate]').hidden = true;
    const pause = content.querySelector('[data-pause]');
    if (pause) pause.disabled = true;
    const title = { correct: 'Réponse correcte', incorrect: 'Réponse incorrecte', timeout: 'Temps écoulé', skipped_image: 'Photographie passée · hors calcul' }[outcome.status];
    const confusions = (bank.confusions || []).filter(item => item.speciesId === plant.id);
    content.querySelector('#bot-feedback').innerHTML = `<section class="bot-correction" aria-labelledby="bot-correction-title"><p class="bot-outcome">${clean(title)}${outcome.status === 'timeout' ? ' · aucune réponse fournie dans le temps imparti' : ''}</p><h2 id="bot-correction-title" tabindex="-1">${clean(plant.commonName)}</h2><p><i>${clean(plant.scientificName)}</i> · ${clean(plant.family)}</p><p>${clean(plant.description)}</p><h3>Ce que montre cette photographie</h3><p>${clean(photo.identification)}</p><ul>${(photo.visibleCriteria || []).map(item => `<li>${clean(item)}</li>`).join('')}</ul><p><strong>Stade :</strong> ${clean(photo.stage)} · <strong>Organe :</strong> ${clean(photo.organ)}</p><details><summary>Caractères botaniques de l’espèce</summary><ul>${(plant.criteria || []).map(item => `<li>${clean(item)}</li>`).join('')}</ul><p class="bot-help">Ces caractères généraux ne sont pas tous nécessairement visibles sur cette photographie.</p></details>${confusions.length ? `<h3>Confusions documentées</h3><ul>${confusions.map(item => `<li>${clean(species(item.otherSpeciesId)?.commonName)} : ${clean(item.explanation)}</li>`).join('')}</ul>` : '<p class="bot-help">Aucune relation de confusion documentée pour cette fiche dans le prototype.</p>'}<p class="bot-credits">Sources botaniques : ${(plant.sources || []).map(source => link(source.url, source.title)).join(' · ')}.</p><div class="bot-actions"><button class="btn btn-primary" type="button" data-next>${index + 1 === session.questions.length ? 'Voir les résultats' : 'Question suivante'} <span aria-hidden="true">→</span></button></div></section>`;
    focus('#bot-correction-title');
    renderHistory();
  }
  function renderResults() {
    stopTicker();
    ++imageAttempt;
    store.recordSession({ ...session, completedAt: new Date().toISOString() });
    storageNotice();
    const stats = calculateStats(sessionAnswers);
    content.innerHTML = `<section class="bot-panel"><div class="page-eyebrow">${clean(category(session.categoryId)?.name)} · ${session.mode === 'chrono' ? 'CHRONO' : 'DÉCOUVERTE'}</div><h2 class="bot-heading" tabindex="-1">Résultats de la session</h2><p>${stats.attempted} question${stats.attempted > 1 ? 's' : ''} réalisée${stats.attempted > 1 ? 's' : ''} sur ${session.questions.length} proposée${session.questions.length > 1 ? 's' : ''}. Chaque tentative contribue à ton historique botanique.</p>${metrics(stats)}${stats.skipped ? `<p class="bot-notice">${stats.skipped} photographie${stats.skipped > 1 ? 's' : ''} indisponible${stats.skipped > 1 ? 's' : ''}, exclue${stats.skipped > 1 ? 's' : ''} du calcul.</p>` : ''}${stats.bySpecies.length ? breakdown(stats) : ''}<p class="bot-help">Thématique : ${clean(category(session.categoryId)?.name)}. Le taux de reconnaissance est le nombre de réponses correctes divisé par les questions réalisées. Les temps écoulés comptent comme non réussis ; les questions laissées de côté restent hors calcul.</p><div class="bot-actions"><button class="btn btn-primary" type="button" data-new>Choisir une nouvelle session</button></div></section>`;
    focus('.bot-heading');
    renderHistory();
    session = null;
    timer = null;
  }
  content.addEventListener('change', event => {
    if (event.target.name === 'bot-mode') { mode = event.target.value; content.querySelector('.bot-duration').hidden = mode !== 'chrono'; }
    if (event.target.id === 'bot-duration') durationSeconds = Number(event.target.value);
    if (event.target.id === 'bot-revision') { revision = event.target.checked; renderSelection(); focus('#bot-revision'); }
  }, { signal });
  content.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.dataset.category) { categoryId = button.dataset.category; renderSelection(); focus(`[data-category="${categoryId}"]`); }
    else if (button.hasAttribute('data-start')) {
      try {
        session = createSession(bank, { categoryId, mode, durationSeconds, revision, history: answers });
        index = 0;
        sessionAnswers = [];
        store.recordSession(session);
        storageNotice();
        renderQuestion();
      } catch { content.querySelector('#bot-session-info').textContent = 'Cette catégorie ne permet pas de lancer une session. Choisis une autre catégorie.'; }
    } else if (button.dataset.choice) { selected = button.dataset.choice; updateChoices(); }
    else if (button.hasAttribute('data-validate')) complete();
    else if (button.hasAttribute('data-next')) { if (++index < session.questions.length) renderQuestion(); else renderResults(); }
    else if (button.hasAttribute('data-stop')) renderResults();
    else if (button.hasAttribute('data-new')) renderSelection(true);
    else if (button.hasAttribute('data-retry-image')) loadPhoto();
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
  renderSelection();
}
