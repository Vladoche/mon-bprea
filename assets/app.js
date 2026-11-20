import { units, lessons } from './content.js';
import { initResources, initCourseResources, initUnitResources } from './resource-library.js';
import { initCalendar } from './calendar.js';
import { getCourseQuizService } from './course-quiz-service.js';
import { initCourseQuizNotice } from './course-quiz-ui.js';
import { renderQuizPage, renderQuizResult, quizSaveStatus } from './course-quiz-page.js';
import { validAttempt } from './course-quiz-model.js';
import { initDrill } from './drill.js';
import { initDashboard } from './dashboard.js';
import { initNavigation } from './navigation.js';
import { renderBreadcrumbs } from './breadcrumbs.js';
import { renderUnit, renderCourse, initCourseReading } from './learning-pages.js';
import { learningOverview } from './learning-overview.js';
import { initHome, initCourseHub, initPracticeHub, initToolsHub, updateLearningOverview } from './section-hubs.js';
import { initAppearance } from './appearance.js';
import { initBotanical } from './botanical.js';
import { initFooter } from './footer.js';
import { initAuthPage } from './auth-pages.js';

const params = new URLSearchParams(location.search);
const $ = (selector, root=document) => root.querySelector(selector);
const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
const BASE = './';
let progress = {};
let courseQuizService;
let progressState = { mode: 'blocked', scope: null, view: { progress: {}, error: 'Vérification de la source des cours et QCM…' }, sync: { state: 'loading' } };
let progressEpoch = 0;
let refreshProgressUI = () => {};
const progressAvailable = () => progressState.mode !== 'blocked' && !progressState.view.error && progressState.sync.state !== 'session';
const progressSource = () => progressState.mode === 'personal' ? 'Historique personnel du compte' : 'Historique local de cet appareil';
const clean = value => String(value).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
const unitUrl = id => `uc.html?id=${encodeURIComponent(id)}`;
const lessonUrl = id => `cours.html?id=${encodeURIComponent(id)}`;
const quizUrl = id => `exercices.html?id=${encodeURIComponent(id)}`;
const isDone = id => !!progress[id]?.done;
const pct = (a,b) => b ? Math.round(a/b*100) : 0;

const icons = {
  leaf:'<path d="M20 4c-6 0-13 3-14 10-1 4 2 6 5 6 7 0 10-7 9-16Z"/><path d="M4 21c2-6 6-10 12-13"/>',
  compass:'<circle cx="12" cy="12" r="9"/><path d="m15 9-2 4-4 2 2-4 4-2Z"/>',
  chart:'<path d="M4 19h16M6 16V9m6 7V5m6 11v-5"/>',
  calculator:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2m4 0h2M8 16h2m4 0h2"/>',
  store:'<path d="M4 10h16l-2-6H6l-2 6Zm2 0v10h12V10M9 20v-6h6v6"/>',
  puzzle:'<path d="M4 4h6c-1 3 3 4 4 1a3 3 0 0 0-.1-1H20v6c-3-1-4 3-1 4h1v6h-6c1-3-3-4-4-1v1H4v-6c3 1 4-3 1-4H4V4Z"/>',
  book:'<path d="M3 5.5c3-1 6-1 9 1 3-2 6-2 9-1v14c-3-1-6-1-9 1-3-2-6-2-9-1v-14ZM12 6.5v14"/>',
  arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  check:'<path d="m4 12 5 5L20 6"/>',
  trophy:'<path d="M7 4h10v7c0 4-3 6-5 6s-5-2-5-6V4ZM7 6H4v3c0 3 3 4 4 4m9-7h3v3c0 3-3 4-4 4M12 17v4m-4 0h8"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>',
  warning:'<path d="m12 3 10 18H2L12 3Zm0 7v4m0 4h.01"/>',
  flask:'<path d="M9 2h6m-5 0v7L4 19a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3L14 9V2m-7 13h10"/>',
  moon:'<path d="M20.4 15.3A8.5 8.5 0 0 1 8.7 3.6 8.5 8.5 0 1 0 20.4 15.3Z"/>',
  file:'<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M13 2v7h7M8 14h8m-8 4h6"/>',
  external:'<path d="M14 4h6v6m0-6-9 9"/><path d="M20 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6"/>',
  download:'<path d="M12 3v12m-4-4 4 4 4-4M4 18v3h16v-3"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
};
const icon = (name, size=20) => `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.book}</svg>`;
function header() {
  const page = document.body.dataset.page;
  const title = document.title;
  $('#app-header').innerHTML = `<a class="skip-link" href="#app-main">Aller au contenu</a><div class="header-in wrap"><a class="brand" href="index.html" aria-label="Revenir à l'accueil"><span class="brand-symbol">${icon('leaf', 20)}</span><span class="brand-copy"><b>BPREA<span class="brand-dot">.</span></b><small>Mon espace de révision</small></span></a><nav class="primary-nav" id="primary-navigation" aria-label="Navigation principale"></nav><div class="header-actions"><button class="theme-toggle" id="theme-toggle" type="button" aria-label="Activer le mode sombre"><span class="theme-icon" aria-hidden="true"></span></button></div></div>`;
  initAppearance();
  initNavigation($('#primary-navigation'), page);
  document.title = `${title} · Mon BPREA`;
}
function home() { initHome($('#app-main')); }
function unit() {
  const u = units.find(item => item.id === params.get('id')) || units[2];
  $('#app-main').innerHTML = renderUnit(u, lessons, icon);
  initUnitResources($('#unit-resources'), u);
}
function course() {
  const l = lessons.find(item => item.id === params.get('id')) || lessons[0];
  const u = units.find(item => item.id === l.unit);
  $('#app-main').innerHTML = renderCourse(l, u, lessons, icon);
  initCourseReading($('#app-main'));
  initCourseResources($('#course-resources'), l);
  const checkbox = $('#mark-done');
  let savingCourse = false, requestedDone = null, savingEpoch = null;
  refreshProgressUI = () => {
    const saved = learningOverview(progressState).courses.find(item => item.lesson.id === l.id);
    const available = progressAvailable() && saved.known;
    const saving = savingCourse && savingEpoch === progressEpoch && available;
    checkbox.checked = saving ? requestedDone : available && saved.done;
    checkbox.disabled = saving || !available;
    $('#done-state').textContent = !available ? 'Progression indisponible' : saved.done ? 'Terminé ✓' : 'Pas encore terminé';
    if (saving) $('#done-state').textContent = 'Enregistrement sur cet appareil…';
  };
  refreshProgressUI();
  checkbox.addEventListener('change', async event => {
    const epoch = progressEpoch;
    const restoreFocus = document.activeElement === checkbox;
    savingCourse = true; requestedDone = event.target.checked; savingEpoch = epoch;
    checkbox.disabled = true;
    $('#done-state').textContent = 'Enregistrement sur cet appareil…';
    const result = await courseQuizService.setCourseDone(l.id, requestedDone);
    savingCourse = false;
    if (epoch !== progressEpoch) return;
    refreshProgressUI();
    if (result.error) $('#done-state').textContent = `Erreur de sauvegarde : ${result.error}`;
    if (restoreFocus && [document.body,checkbox].includes(document.activeElement)) checkbox.focus({ preventScroll: true });
  });
}
function quizzes() {
  const l = lessons.find(x => x.id === params.get('id')) || lessons[0];
  let answers = {}, submitted = false, saving = false, attempt = null, savedLocally = false;
  let source = `${progressState.mode}:${progressState.scope}`;
  $('#app-main').innerHTML = renderQuizPage(l, icon);
  const form = $('#quiz-questions'), check = $('#check-quiz'), retry = $('#retry-quiz');
  const date = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
  let historyMarkup;
  function reset() {
    answers = {}; submitted = false; saving = false; attempt = null; savedLocally = false;
    $$('input',form).forEach(x => { x.checked = false; x.disabled = !progressAvailable(); });
    $$('.option',form).forEach(x => x.classList.remove('correct','incorrect'));
    $$('.explanation,.option-verdict',form).forEach(x => x.hidden = true);
    updateEntryProgress();
    check.hidden = false; check.disabled = true; retry.hidden = true; $('#quiz-result').replaceChildren();
  }
  function updateEntryProgress() {
    const count = Object.keys(answers).length, remaining = l.quiz.length - count;
    $('#quiz-answer-count').textContent = `${count} réponse${count > 1 ? 's' : ''} sur ${l.quiz.length} renseignée${count > 1 ? 's' : ''}`;
    $('#quiz-answer-progress').value = count;
    $('#quiz-check-hint').textContent = submitted ? 'Corrigé disponible sous chaque question.' : !progressAvailable() ? 'Progression indisponible : vérifie la source avant de répondre.' : remaining ? `Réponds encore à ${remaining === 1 ? 'une question' : `${remaining} questions`} pour accéder au corrigé.` : 'Tout est renseigné. Tu peux découvrir le corrigé.';
  }
  function updateSaveStatus() {
    if (!savedLocally) return;
    const message = `Progression enregistrée sur cet appareil. ${quizSaveStatus(progressState)}`;
    const status = $('#quiz-save-status');
    if (status && status.textContent !== message) status.textContent = message;
  }
  refreshProgressUI = () => {
    const nextSource = `${progressState.mode}:${progressState.scope}`;
    if (source !== nextSource || !progressAvailable() && progressState.sync.state === 'session') { source = nextSource; reset(); }
    const available = progressAvailable();
    $$('input',form).forEach(input => input.disabled = submitted || !available);
    check.disabled = submitted || !available || Object.keys(answers).length !== l.quiz.length;
    updateEntryProgress();
    retry.disabled = saving || !available;
    updateSaveStatus();
    const saved = progress[l.id];
    $('#quiz-best-detail').textContent = !available ? 'Meilleur score indisponible pour le moment.' : saved?.score !== undefined ? 'Ton meilleur résultat enregistré pour ce cours.' : 'Aucun score enregistré pour ce cours.';
    $('#quiz-best-score').textContent = available && saved?.score !== undefined ? saved.score : '—';
    $('#quiz-history-source').textContent = available ? progressSource() : progressState.view.error || 'La progression doit être vérifiée.';
    const rows = available && Array.isArray(saved?.quizAttempts) ? saved.quizAttempts : [];
    const valid = rows.filter(validAttempt);
    const markup = !available ? '<p>Historique indisponible pour le moment. Les données enregistrées sont conservées.</p>' : valid.length ? `<ol class="quiz-attempt-list">${valid.map(row => `<li ${row.attemptId || row.id ? `data-attempt-id="${clean(row.attemptId || row.id)}"` : ''}><strong>${row.score} / ${row.total}</strong><time datetime="${clean(row.completedAt)}">${clean(date.format(new Date(row.completedAt)))}</time></li>`).join('')}</ol>` : '<p>Aucune tentative QCM historisée pour ce cours.</p>';
    if (markup !== historyMarkup) { $('#quiz-history').innerHTML = markup; historyMarkup = markup; }
  };
  refreshProgressUI();
  form.addEventListener('change', event => {
    if (submitted || !progressAvailable()) return;
    const match = event.target.name?.match(/^q(\d+)$/);
    if (match) answers[Number(match[1])] = Number(event.target.value);
    check.disabled = Object.keys(answers).length !== l.quiz.length;
    updateEntryProgress();
  });
  async function saveAttempt() {
    if (saving || !attempt) return;
    saving = true;
    const epoch = progressEpoch;
    const pending = attempt;
    const resultRoot = $('#quiz-result');
    if (!resultRoot.firstElementChild) {
      resultRoot.innerHTML = renderQuizResult(pending);
      $('#retry-quiz-save').addEventListener('click', saveAttempt);
    }
    $('#quiz-save-error').hidden = true;
    $('#retry-quiz-save').hidden = true;
    $('#quiz-save-status').textContent = 'Enregistrement sur cet appareil…';
    retry.disabled = true;
    resultRoot.focus({ preventScroll: true });
    if (courseQuizService.getState().sync.state === 'storage-error') await courseQuizService.retry();
    if (epoch !== progressEpoch) return;
    const result = await courseQuizService.recordQuiz(l.id, pending);
    if (epoch !== progressEpoch) return;
    saving = false;
    savedLocally = !result.error;
    if (result.error) {
      $('#quiz-save-status').textContent = '';
      $('#quiz-save-error').textContent = `Erreur de sauvegarde : ${result.error} Le résultat reste affiché ; cette tentative n’est pas annoncée comme enregistrée.`;
      $('#quiz-save-error').hidden = false;
      $('#retry-quiz-save').hidden = false;
    }

    refreshProgressUI();
  }
  check.addEventListener('click', async () => {
    if (submitted || !progressAvailable() || Object.keys(answers).length !== l.quiz.length) return;
    submitted = true;
    let score = 0;
    l.quiz.forEach((q,i) => {
      const ok = answers[i] === q.answer;
      if (ok) score++;
      const fs = $(`[data-question="${i}"]`);
      $$('.option',fs).forEach((el,j) => {
        if (j === q.answer) el.classList.add('correct');
        if (j === answers[i] && !ok) el.classList.add('incorrect');
        const verdict = $('.option-verdict', el);
        verdict.textContent = j === q.answer ? (ok ? 'Ta réponse · Bonne réponse' : 'Bonne réponse') : j === answers[i] ? 'Ta réponse · Incorrecte' : '';
        verdict.hidden = !verdict.textContent;
      });
      const explanation = $(`#explain-${i}`); explanation.hidden = false;
      explanation.innerHTML = `<strong>${icon(ok ? 'check' : 'warning', 18)} ${ok ? 'Bonne réponse' : 'Ta réponse est incorrecte'}</strong><p>Bonne réponse : ${clean(q.options[q.answer])}</p><p>${clean(q.why)}</p>`;
    });
    $$('input',form).forEach(x => x.disabled = true);
    check.hidden = true; retry.hidden = false; updateEntryProgress();
    attempt = { score, total: l.quiz.length, completedAt: new Date().toISOString() };
    await saveAttempt();
  });
  retry.addEventListener('click', () => { if (!saving) { reset(); refreshProgressUI(); $('input',form)?.focus({ preventScroll: true }); } });
}
function dashboard(){
  const root=$('#app-main');
  return initDashboard(root).catch(()=>{
    const panel=document.createElement('section');
    panel.className='wrap dashboard-empty';
    panel.setAttribute('role','alert');
    const title=document.createElement('h1');title.textContent='Tableau de bord indisponible';
    const message=document.createElement('p');message.textContent='La source des résultats ne peut pas être vérifiée. Recharge la page pour réessayer. Les données enregistrées sont conservées.';
    panel.append(title,message);root.replaceChildren(panel);
  });
}
function updateProgressElements() {
  const available = progressAvailable();
  for (const u of units) {
    const list = lessons.filter(lesson => lesson.unit === u.id);
    const done = list.filter(lesson => isDone(lesson.id)).length;
    $$(`[data-unit-done="${u.id}"]`).forEach(node => node.textContent = available ? done : '—');
    $$(`[data-unit-track="${u.id}"]`).forEach(node => node.style.width = `${available ? pct(done,list.length) : 0}%`);
  }
  $$('[data-lesson-completed]').forEach(node => node.hidden = !available || !isDone(node.dataset.lessonCompleted));
  $$('[data-progress-source]').forEach(node => node.textContent = available ? progressSource() : 'Progression indisponible : les données doivent être vérifiées.');
  const footer = $('#footer-progress-source');
  if (footer) footer.textContent = `Contenus de démonstration non officiels · ${available ? progressSource() : 'Source des cours et QCM à vérifier'}`;
  updateLearningOverview($('#app-main'), progressState);
  refreshProgressUI();
}
async function init(){
  header();
  const page=document.body.dataset.page;
  const usesProgress = ['home', 'courses', 'uc', 'course', 'quiz'].includes(page);
  if (usesProgress) {
    $('#app-main').innerHTML = '<section class="page-top wrap"><h1>Chargement des cours et QCM</h1><p role="status">Vérification de la source de progression…</p></section>';
    try { courseQuizService = await getCourseQuizService(); progressState = courseQuizService.getState(); }
    catch { progressState.view.error = 'La source de progression est indisponible. Les données enregistrées sont conservées.'; }
    progress = progressAvailable() ? progressState.view.progress : {};
  } else if (page === 'profile') {
    // Continue draining the learning outbox when visiting the account page.
    const learning = getCourseQuizService().catch(() => null);
    window.addEventListener('pagehide', () => { learning.then(service => service?.stop()); }, { once: true });
  }
  ({home,courses:()=>initCourseHub($('#app-main')),practice:()=>initPracticeHub($('#app-main')),tools:()=>initToolsHub($('#app-main')),uc:unit,course,quiz:quizzes,itk:()=>import('./itk.js').then(({ initItk }) => initItk($('#app-main'), icon)),resources:()=>initResources($('#app-main')),calendar:()=>initCalendar($('#app-main')),drill:()=>initDrill($('#app-main')),dashboard,botanical:()=>initBotanical($('#app-main')),'auth-login':()=>initAuthPage(),'auth-reset':()=>initAuthPage(),'auth-callback':()=>initAuthPage(),profile:()=>initAuthPage()}[page]||home)();
  // Render the expanded footer after the initial page content. Hydrating it
  // before the course source resolves briefly filled the viewport with footer
  // links, then displaced the whole surface when the page became available.
  initFooter($('#app-footer'), { page });
  if (usesProgress) {
    const notice = document.createElement('section');
    notice.className = 'wrap course-quiz-notice';
    notice.setAttribute('aria-label', 'État de sauvegarde des cours et QCM');
    notice.hidden = true;
    $('#app-main > section')?.after(notice);
    if (courseQuizService) {
      const disposeNotice = initCourseQuizNotice(notice, courseQuizService);
      // The QCM result owns save announcements; keep the shared notice readable
      // without announcing the same transition twice.
      if (page === 'quiz') { $('#course-quiz-sync-status').removeAttribute('role'); }
      const unsubscribe = courseQuizService.subscribe(state => {
        if (`${state.mode}:${state.scope}` !== `${progressState.mode}:${progressState.scope}` || state.sync.state === 'session' && progressState.sync.state !== 'session') progressEpoch++;
        progressState = state;
        progress = progressAvailable() ? state.view.progress : {};
        updateProgressElements();
      });
      window.addEventListener('pagehide', () => { disposeNotice(); unsubscribe(); courseQuizService.stop(); }, { once: true });
      window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
    } else {
      notice.textContent = progressState.view.error;
      notice.setAttribute('role', 'status');
      notice.hidden = false;
    }
    updateProgressElements();
  }
  if (page === 'courses') {
    const fact = $('#course-daily-fact');
    // No fact module, bank or optional resource catalog on other pages.
    import('./daily-fact.js').then(({ initDailyFact }) => initDailyFact(fact)).then(dispose => {
      window.addEventListener('pagehide', dispose, { once: true });
    }).catch(() => { /* An optional reading aid never blocks the courses. */ });
  }
}
init();
