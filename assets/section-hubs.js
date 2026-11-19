import { units, lessons } from './content.js';
import { renderBreadcrumbs } from './breadcrumbs.js';
import { readDashboardData } from './dashboard-data.js';
import { createDashboardModel } from './dashboard-stats.js';
import { getParisWeek } from './drill-engine.js';
import { DRILL_STORAGE_KEY } from './drill-store.js';
import { getDrillSyncService } from './drill-sync-service.js';
import { learningOverview } from './learning-overview.js';

const clean = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const number = value => new Intl.NumberFormat('fr-FR').format(value);
const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const dateLabel = value => dateFormat.format(new Date(`${value}T12:00:00Z`));
const practiceControllers = new WeakMap();

const paths = {
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15 9-2 4-4 2 2-4 4-2Z"/>',
  chart: '<path d="M4 19h16M6 16V9m6 7V5m6 11v-5"/>',
  leaf: '<path d="M20 4c-6 0-13 3-14 10-1 4 2 6 5 6 7 0 10-7 9-16Z"/><path d="M4 21c2-6 6-10 12-13"/>',
  calculator: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2m4 0h2M8 16h2m4 0h2"/>',
  store: '<path d="M4 10h16l-2-6H6l-2 6Zm2 0v10h12V10M9 20v-6h6v6"/>',
  puzzle: '<path d="M4 4h6c-1 3 3 4 4 1a3 3 0 0 0-.1-1H20v6c-3-1-4 3-1 4h1v6h-6c1-3-3-4-4-1v1H4v-6c3 1 4-3 1-4H4V4Z"/>',
  book: '<path d="M3 5.5c3-1 6-1 9 1 3-2 6-2 9-1v14c-3-1-6-1-9 1-3-2-6-2-9-1v-14ZM12 6.5v14"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
  flask: '<path d="M9 2h6m-5 0v7L4 19a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3L14 9V2m-7 13h10"/>',
  exercise: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v4H9V3ZM8 12l2 2 5-5M8 18h8"/>',
};
const icon = name => `<svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.book}</svg>`;

function intro(page, title, description, kicker) {
  return `<section class="page-top wrap hub-intro">${renderBreadcrumbs(page)}<div class="page-eyebrow">${kicker}</div><h1>${title}</h1><p>${description}</p></section>`;
}

function linkCard({ href, title, description, symbol, action, primary = false, kicker = '' }) {
  return `<a class="hub-link-card${primary ? ' hub-link-card-primary' : ''}" href="${clean(href)}"><span class="hub-card-icon">${icon(symbol)}</span><div class="hub-card-copy">${kicker ? `<span class="eyebrow">${clean(kicker)}</span>` : ''}<h2>${clean(title)}</h2><p>${clean(description)}</p><span class="hub-card-action">${clean(action)} <span aria-hidden="true">→</span></span></div></a>`;
}

export function initCourseHub(root) {
  const first = lessons[0];
  root.innerHTML = `${intro('courses', 'Mes cours', 'Comprendre une notion, retrouver un cours, puis mettre tes connaissances en pratique. Avance à ton rythme.', 'TON CARNET DE FORMATION')}
    ${first ? `<section class="wrap hub-resume" aria-labelledby="hub-resume-heading"><div><span class="eyebrow" data-resume-kicker>POUR COMMENCER</span><h2 id="hub-resume-heading" data-resume-title>${clean(first.title)}</h2><p data-resume-note>Un premier cours pour découvrir le sol vivant.</p></div><a class="btn btn-surface" data-course-resume href="cours.html?id=${encodeURIComponent(first.id)}"><span data-course-resume-label>Découvrir ce cours</span><span aria-hidden="true">→</span></a></section>` : ''}
    <section class="wrap hub-unit-section" aria-labelledby="hub-units-heading"><div class="hub-section-heading"><div><span class="eyebrow">LES UNITÉS DE TA FORMATION</span><h2 id="hub-units-heading">Cours par UC</h2><p>Cinq UC nationales et deux UCARE. Les cours disponibles sont regroupés dans l’UC 03.</p></div><span class="hub-count">${units.length} unités</span></div><p class="learning-source" data-learning-source>Vérification de la progression…</p><div class="hub-unit-grid">${units.map(unitCard).join('')}</div></section>
    <section class="daily-fact wrap" id="course-daily-fact" hidden></section>
    <section class="wrap hub-next-panel" aria-labelledby="hub-practice-heading"><div><span class="eyebrow">À TOI DE JOUER</span><h2 id="hub-practice-heading">Passe de la lecture à la pratique</h2><p>Exercices hebdomadaires, résultats et calendrier : retrouve tes repères pour réviser.</p></div><a class="btn btn-surface btn-surface--accent" href="s-exercer.html">Accéder à S’exercer <span aria-hidden="true">→</span></a></section>`;
}

function unitCard(unit) {
  const count = lessons.filter(lesson => lesson.unit === unit.id).length;
  return `<a class="hub-unit-card${count ? ' hub-unit-card-ready' : ''}" href="uc.html?id=${encodeURIComponent(unit.id)}" data-learning-unit="${unit.id}"><div class="hub-unit-top"><span class="unit-icon tone-${clean(unit.tone)}">${icon(unit.icon)}</span><span class="hub-availability">${count ? 'Cours disponibles' : 'À venir'}</span></div><span class="eyebrow">${clean(unit.code)}</span><h3>${clean(unit.title)}</h3><p>${clean(unit.short)}</p><div class="hub-unit-bottom"><span>${count} cours disponible${count > 1 ? 's' : ''}</span><span class="hub-unit-arrow" aria-hidden="true">→</span></div>${count ? `<div class="learning-progress"><span data-unit-progress-label="${unit.id}">Progression indisponible</span><progress data-unit-progress="${unit.id}" max="100" aria-label="Cours terminés · ${clean(unit.code)}" hidden></progress></div>` : '<span class="learning-future">Les cours de cette unité seront ajoutés ici.</span>'}</a>`;
}

export function initHome(root) {
  const selection = lessons.slice(0, 3);
  const unit = units.find(unit => unit.id === selection[0]?.unit);
  root.innerHTML = `<section class="wrap home-hero" aria-labelledby="home-heading"><div class="home-hero-copy"><span class="eyebrow home-welcome">${icon('leaf')} BIENVENUE SUR BPREA</span><h1 id="home-heading">Ton espace de révision<br> pour le <em>BPREA</em></h1><p>Des cours clairs, des outils efficaces et des ressources concrètes pour t’accompagner vers la réussite de ta formation.</p><div class="home-actions"><a class="btn btn-surface btn-surface--accent" data-revision-start href="s-exercer.html"><span data-revision-start-label>Commencer à réviser</span><span aria-hidden="true">→</span></a><a class="btn btn-surface" href="mes-cours.html">${icon('book')} Explorer les cours</a></div><p class="home-resume-note" data-revision-hint>Choisis une série d’exercices pour te lancer, à ton rythme.</p></div><div class="home-garden" aria-hidden="true"><img src="assets/revision-landscape-1600.webp" srcset="assets/revision-landscape-960.webp 960w, assets/revision-landscape-1600.webp 1600w" sizes="(max-width: 760px) 100vw, 1360px" width="1600" height="533" alt="" decoding="async" fetchpriority="high"></div></section>
    <section class="wrap home-modules" aria-labelledby="home-modules-heading"><div class="home-modules-intro"><div class="hub-section-heading"><div><span class="eyebrow">${icon('book')} TES CARNETS DE RÉVISION</span><h2 id="home-modules-heading">Des modules complets pour progresser</h2><p>Commence par le sol vivant : ${lessons.length} cours disponibles, accompagnés de leurs QCM.</p></div></div>${unit ? `<div class="home-unit-summary"><a class="ui-link" href="uc.html?id=${encodeURIComponent(unit.id)}">${clean(unit.code)} · ${clean(unit.title)} <span aria-hidden="true">↗</span></a><span data-unit-percent="${unit.id}">Progression indisponible</span></div><progress class="home-unit-progress" data-unit-progress="${unit.id}" max="100" aria-label="Cours terminés · ${clean(unit.code)}" hidden></progress>` : ''}<p class="learning-source" data-learning-source>Vérification de la progression…</p></div><div class="home-course-grid">${selection.map(lesson => `<a class="home-course-card" href="cours.html?id=${encodeURIComponent(lesson.id)}"><div class="home-course-top"><span class="hub-card-icon">${icon('leaf')}</span><span class="home-course-state" data-course-card-state="${lesson.id}">Progression indisponible</span></div><span class="eyebrow">${clean(lesson.chapter)}</span><h3>${clean(lesson.title)}</h3><p>${clean(lesson.summary)}</p><div class="home-course-meta"><span>${lesson.minutes} min · QCM de ${lesson.quiz.length} questions</span><span class="hub-unit-arrow" aria-hidden="true">→</span></div></a>`).join('')}</div></section>
    <section class="wrap home-support" aria-labelledby="home-support-heading"><div class="home-support-heading"><span class="home-leaf-divider" aria-hidden="true">${icon('leaf')}</span><h2 id="home-support-heading">Pourquoi utiliser BPREA ?</h2><p>Un espace pour réviser, s’entraîner et consolider les compétences du BPREA.</p></div><ul><li><span class="home-benefit-icon">${icon('book')}</span><strong>Des cours structurés</strong><p>Les notions essentielles, des sources pour approfondir.</p></li><li><span class="home-benefit-icon">${icon('exercise')}</span><strong>Des exercices variés</strong><p>Dix exercices par UC et par semaine, sans limite de reprise.</p></li><li><span class="home-benefit-icon">${icon('flask')}</span><strong>Des outils pratiques</strong><p>Itinéraires techniques, botanique et ressources.</p></li><li><span class="home-benefit-icon">${icon('chart')}</span><strong>Un suivi de progression</strong><p>Retrouve tes acquis et tes résultats enregistrés.</p></li></ul></section>
    <section class="wrap home-all-courses" aria-labelledby="home-all-heading"><span class="home-final-leaf" aria-hidden="true">${icon('leaf')}</span><div><h2 id="home-all-heading">Prêt·e à avancer dans tes révisions ?</h2><p>Retrouve les sept UC et UCARE, les cours disponibles et ceux à venir.</p></div><a class="btn btn-surface btn-surface--accent" href="mes-cours.html">Voir toutes les unités <span aria-hidden="true">→</span></a></section>`;
}

/** Patch only changing text and values: links keep keyboard focus during sync. */
export function updateLearningOverview(root, snapshot) {
  const model = learningOverview(snapshot);
  for (const { unit, count, done, percent } of model.units) {
    root.querySelectorAll(`[data-unit-percent="${unit.id}"]`).forEach(node => { node.textContent = percent === null ? 'Progression indisponible' : `${percent} % des cours terminés`; });
    root.querySelectorAll(`[data-unit-progress-label="${unit.id}"]`).forEach(node => { node.textContent = percent === null ? 'Progression indisponible · données conservées' : `${done} / ${count} cours terminés · ${percent} %`; });
    root.querySelectorAll(`[data-unit-progress="${unit.id}"]`).forEach(node => { node.hidden = percent === null; if (percent !== null) node.value = percent; else node.removeAttribute('value'); });
  }
  for (const { lesson, known, done } of model.courses) root.querySelectorAll(`[data-course-card-state="${lesson.id}"]`).forEach(node => {
    node.textContent = !known ? 'Progression indisponible' : done ? 'Terminé' : 'À découvrir';
    node.dataset.state = !known ? 'unknown' : done ? 'done' : 'new';
  });
  root.querySelectorAll('[data-learning-source]').forEach(node => { node.textContent = model.source; });
  const resume = model.resume?.lesson;
  const start = root.querySelector('[data-revision-start]');
  if (start) {
    start.setAttribute('href', resume ? `cours.html?id=${encodeURIComponent(resume.id)}` : 's-exercer.html');
    root.querySelector('[data-revision-start-label]').textContent = resume ? 'Reprendre mes révisions' : 'Commencer à réviser';
    root.querySelector('[data-revision-hint]').textContent = resume ? `Dernier QCM daté : ${resume.title}.` : 'Choisis une série d’exercices pour te lancer, à ton rythme.';
  }
  const course = root.querySelector('[data-course-resume]');
  if (course) {
    const lesson = resume || lessons[0];
    course.setAttribute('href', `cours.html?id=${encodeURIComponent(lesson.id)}`);
    root.querySelector('[data-resume-kicker]').textContent = resume ? 'REPRENDRE UN COURS' : 'POUR COMMENCER';
    root.querySelector('[data-resume-title]').textContent = lesson.title;
    root.querySelector('[data-resume-note]').textContent = resume ? 'Retrouve le cours associé au dernier QCM daté de cet espace.' : 'Un premier cours pour découvrir le sol vivant.';
    root.querySelector('[data-course-resume-label]').textContent = resume ? 'Reprendre ce cours' : 'Découvrir ce cours';
  }
}

function weeklySummary(now, snapshot) {
  const currentWeek = getParisWeek(now);
  // Reuse Dashboard accounting and activity dates; do not aggregate a second time.
  // Four weeks is the shortest supported model window; only the current one is shown.
  const model = createDashboardModel(readDashboardData(snapshot), { period: '4', now });
  const week = model.weeks.find(item => item.id === currentWeek.id);
  const heading = `<div class="hub-section-heading"><div><span class="eyebrow">TON ACTIVITÉ DE RÉVISION</span><h2 id="hub-weekly-heading">Cette semaine</h2><p>Du ${dateLabel(currentWeek.start)} au ${dateLabel(currentWeek.end)} · ${clean(currentWeek.id)} · Europe/Paris</p></div></div>`;
  if (model.error) {
    return `${heading}<div class="hub-status hub-status-warning"><h3>La synthèse n’est pas disponible</h3><p>${clean(model.error)}</p><button class="btn btn-surface" type="button" data-refresh-week>Réessayer la lecture</button></div>`;
  }
  const warnings = model.warnings.length ? `<details class="hub-partial"><summary>Bilan partiel : certaines données sont exclues</summary><ul>${model.warnings.map(warning => `<li>${clean(warning)}</li>`).join('')}</ul><p>Les données enregistrées restent conservées.</p></details>` : '';
  return `${heading}${warnings}<dl class="hub-weekly-metrics"><div><dt>Exercices réalisés</dt><dd>${number(week.completed)}</dd></div><div><dt>Bonnes réponses</dt><dd>${number(week.correct)}</dd></div><div><dt>Taux de réussite</dt><dd class="${week.successRate === null ? 'hub-empty-rate' : ''}">${week.successRate === null ? 'Aucune donnée' : `${Math.round(week.successRate)} %`}</dd></div></dl>${week.completed ? '' : '<div class="hub-status"><h3>Aucune réponse validée cette semaine</h3><p>Commence ou reprends une série d’exercices hebdomadaires pour voir ta synthèse. Les questions laissées de côté ne sont pas des erreurs.</p></div>'}<p class="hub-weekly-note">Premières réponses validées cette semaine, y compris dans une ancienne série. Les entraînements supplémentaires et les QCM de cours restent séparés.</p>`;
}

export function initPracticeHub(root) {
  practiceControllers.get(root)?.abort();
  const controller = new AbortController();
  practiceControllers.set(root, controller);
  const { signal } = controller;
  let service;
  let snapshot = { mode: 'blocked', sync: { state: 'loading' } };
  root.innerHTML = `${intro('practice', 'S’exercer', 'Une série pour aujourd’hui, des repères pour la suite. Entraîne-toi à ton rythme.', 'METTRE SES CONNAISSANCES EN PRATIQUE')}<section class="wrap hub-practice-start" aria-label="Commencer ou reprendre une série">${linkCard({ href: 'drill.html', title: 'Exercices hebdomadaires', description: 'Dix exercices par UC chaque semaine. Commence une série ou retrouve celles déjà entamées : les semaines précédentes restent accessibles.', symbol: 'exercise', action: 'Ouvrir les exercices', primary: true, kicker: 'PRÊT POUR UNE SÉRIE ?' })}</section><section class="wrap hub-weekly" aria-labelledby="hub-weekly-heading"><div id="hub-weekly-content" aria-live="polite" aria-atomic="false"></div></section><section class="wrap hub-practice-grid" aria-label="Résultats et organisation">${linkCard({ href: 'tableau-de-bord.html', title: 'Tableau de bord', description: 'Retrouve tes résultats et les notions à retravailler à partir de tes réponses enregistrées.', symbol: 'chart', action: 'Consulter mes résultats' })}${linkCard({ href: 'calendrier.html', title: 'Calendrier', description: 'Organise tes révisions avec ton emploi du temps et les périodes d’examen.', symbol: 'calendar', action: 'Ouvrir le calendrier' })}</section>`;
  const summary = root.querySelector('#hub-weekly-content');
  let lastMarkup = '';
  function refresh() {
    if (!root.isConnected) return;
    const markup = weeklySummary(new Date(), snapshot);
    if (markup !== lastMarkup) {
      summary.innerHTML = markup;
      lastMarkup = markup;
    }
  }
  root.addEventListener('click', event => {
    if (event.target.closest('[data-refresh-week]')) refresh();
  }, { signal });
  window.addEventListener('storage', event => {
    if (event.key === DRILL_STORAGE_KEY || event.key === null) refresh();
  }, { signal });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
  }, { signal });
  const timer = window.setInterval(() => { if (!document.hidden) refresh(); }, 60000);
  signal.addEventListener('abort', () => window.clearInterval(timer), { once: true });
  getDrillSyncService().then(value => {
    if (signal.aborted) { value.stop(); return; }
    service = value;
    const unsubscribe = service.subscribe(state => { snapshot = state; refresh(); });
    signal.addEventListener('abort', () => { unsubscribe(); service.stop(); }, { once: true });
  }).catch(() => { snapshot = { mode: 'blocked', sync: { state: 'session' } }; refresh(); });
  window.addEventListener('pagehide', () => controller.abort(), { once: true });
  window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); }, { signal });
  refresh();
}

export function initToolsHub(root) {
  root.innerHTML = `${intro('tools', 'Outils', 'Préparer une culture, approfondir une notion ou reconnaître une plante : choisis ton point de départ.', 'DES APPUIS POUR LE TERRAIN')}<section class="wrap hub-tools-grid" aria-label="Outils disponibles">${linkCard({ href: 'itk.html', title: 'Générateur ITK', description: 'Prépare un itinéraire technique indicatif adapté à ta culture, puis exporte ses étapes.', symbol: 'flask', action: 'Créer un itinéraire technique' })}${linkCard({ href: 'ressources.html', title: 'Ressources documentaires', description: 'Approfondis tes cours avec des sources, fiches techniques et PDF classés par UC.', symbol: 'book', action: 'Explorer la bibliothèque' })}${linkCard({ href: 'reconnaissance-plantes.html', title: 'Reconnaissance des plantes', description: 'Observe les caractères botaniques et entraîne ton regard avec des photographies sourcées.', symbol: 'leaf', action: 'Observer et reconnaître' })}</section>`;
}
