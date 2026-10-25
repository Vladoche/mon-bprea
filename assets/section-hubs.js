import { units, lessons } from './content.js';
import { renderBreadcrumbs } from './breadcrumbs.js';
import { readDashboardData } from './dashboard-data.js';
import { createDashboardModel } from './dashboard-stats.js';
import { getParisWeek } from './drill-engine.js';
import { DRILL_STORAGE_KEY } from './drill-store.js';
import { getDrillSyncService } from './drill-sync-service.js';

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
  root.innerHTML = `${intro('courses', 'Mes cours', 'Retrouve les cours de ta formation par unité capitalisable, puis passe aux activités de révision à ton rythme.', 'COMPRENDRE, PUIS METTRE EN PRATIQUE')}<section class="wrap hub-unit-section" aria-labelledby="hub-units-heading"><div class="hub-section-heading"><div><h2 id="hub-units-heading">Cours par UC</h2><p>Choisis une unité pour accéder à ses chapitres et à ses leçons.</p></div><span class="hub-count">${units.length} unités</span></div><div class="hub-unit-grid">${units.map(unit => {
    const count = lessons.filter(lesson => lesson.unit === unit.id).length;
    return `<a class="hub-unit-card" href="uc.html?id=${encodeURIComponent(unit.id)}"><span class="unit-icon tone-${clean(unit.tone)}">${icon(unit.icon)}</span><span class="eyebrow">${clean(unit.code)}</span><h3>${clean(unit.title)}</h3><p>${clean(unit.short)}</p><div class="hub-unit-bottom"><span>${count ? `${count} cours disponible${count > 1 ? 's' : ''} · <span data-unit-done="${unit.id}">—</span> terminé(s)` : 'Cours à venir'}</span><span class="hub-unit-arrow" aria-hidden="true">→</span></div></a>`;
  }).join('')}</div></section><section class="wrap hub-next-panel" aria-labelledby="hub-practice-heading"><div><span class="eyebrow">DANS MES COURS</span><h2 id="hub-practice-heading">S’exercer</h2><p>Retrouve les exercices hebdomadaires, tes résultats et ton calendrier de révision.</p></div><a class="btn btn-primary" href="s-exercer.html">Accéder à S’exercer <span aria-hidden="true">→</span></a></section>`;
}

function weeklySummary(now, snapshot) {
  const currentWeek = getParisWeek(now);
  // Reuse Dashboard accounting and activity dates; do not aggregate a second time.
  // Four weeks is the shortest supported model window; only the current one is shown.
  const model = createDashboardModel(readDashboardData(snapshot), { period: '4', now });
  const week = model.weeks.find(item => item.id === currentWeek.id);
  const heading = `<div class="hub-section-heading"><div><span class="eyebrow">TON ACTIVITÉ DE RÉVISION</span><h2 id="hub-weekly-heading">Cette semaine</h2><p>Du ${dateLabel(currentWeek.start)} au ${dateLabel(currentWeek.end)} · ${clean(currentWeek.id)} · Europe/Paris</p></div></div>`;
  if (model.error) {
    return `${heading}<div class="hub-status hub-status-warning"><h3>La synthèse n’est pas disponible</h3><p>${clean(model.error)}</p><button class="btn btn-outline" type="button" data-refresh-week>Réessayer la lecture</button></div>`;
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
  root.innerHTML = `${intro('practice', 'S’exercer', 'Retrouve tes exercices, tes résultats et ton calendrier de révision.', 'DANS MES COURS')}<section class="wrap hub-weekly" aria-labelledby="hub-weekly-heading"><div id="hub-weekly-content" aria-live="polite" aria-atomic="false"></div></section><section class="wrap hub-practice-grid" aria-label="Activités de révision">${linkCard({ href: 'drill.html', title: 'Exercices hebdomadaires', description: 'Retrouve les séries de dix exercices par UC, renouvelées chaque semaine, et reprends celles déjà commencées à ton rythme.', symbol: 'exercise', action: 'Ouvrir les exercices', primary: true, kicker: 'POUR METTRE EN PRATIQUE' })}${linkCard({ href: 'tableau-de-bord.html', title: 'Tableau de bord', description: 'Consulte ton activité, tes résultats et les notions à retravailler à partir de tes réponses enregistrées.', symbol: 'chart', action: 'Consulter mes résultats' })}${linkCard({ href: 'calendrier.html', title: 'Calendrier', description: 'Retrouve ton emploi du temps annuel et les périodes d’examen pour organiser tes révisions.', symbol: 'calendar', action: 'Ouvrir le calendrier' })}</section>`;
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
  root.innerHTML = `${intro('tools', 'Outils', 'Des ressources pour approfondir tes connaissances et préparer tes cultures.', 'DES APPUIS POUR ALLER PLUS LOIN')}<section class="wrap hub-tools-grid" aria-label="Outils disponibles">${linkCard({ href: 'itk.html', title: 'Générateur ITK', description: 'Prépare un itinéraire technique indicatif selon ta culture et tes contraintes, puis consulte ou exporte ses étapes.', symbol: 'flask', action: 'Créer un itinéraire technique' })}${linkCard({ href: 'ressources.html', title: 'Ressources documentaires', description: 'Consulte les liens utiles, PDF, fiches techniques et ressources classées par UC et associées aux cours.', symbol: 'book', action: 'Explorer la bibliothèque' })}${linkCard({ href: 'reconnaissance-plantes.html', title: 'Reconnaissance des plantes', description: 'Entraîne ton regard avec des photographies sourcées, découvre les caractères botaniques et retrouve ton historique local.', symbol: 'leaf', action: 'Observer et reconnaître' })}</section>`;
}
