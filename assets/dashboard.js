import { units } from './content.js';
import { renderBreadcrumbs } from './breadcrumbs.js';
import { DRILL_STORAGE_KEY } from './drill-store.js';
import { readDashboardData } from './dashboard-data.js';
import { getDrillSyncService } from './drill-sync-service.js';
import { createDashboardModel, DASHBOARD_THRESHOLDS } from './dashboard-stats.js';

const clean = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const number = value => new Intl.NumberFormat('fr-FR').format(value);
const rate = value => value === null ? 'Aucune donnée' : `${Math.round(value)} %`;
const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const dateLabel = value => dateFormat.format(new Date(`${value}T12:00:00Z`));
const drillUrl = unit => `drill.html${unit === 'all' ? '' : `?unit=${encodeURIComponent(unit)}`}`;
const PAGE_SIZE = 12;
const masteryLabel = {
  insufficient: 'Données insuffisantes', strong: 'Réussite régulière observée',
  developing: 'À consolider', rework: 'À retravailler',
};

function table(headers, rows, caption) {
  return `<div class="dashboard-table-scroll" tabindex="0" role="region" aria-label="${clean(caption)}"><table class="dashboard-table"><caption>${clean(caption)}</caption><thead><tr>${headers.map(header => `<th scope="col">${clean(header)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}

function weeklyTable(weeks) {
  return `<details class="dashboard-data-table" data-dashboard-details="weekly"><summary>Afficher les données hebdomadaires en tableau (${weeks.length} semaines)</summary>${table(
    ['Semaine ISO · dates', 'Réussis', 'Ratés', 'Total réalisé', 'Taux de réussite'],
    weeks.map(week => `<tr><th scope="row">${week.id}<small>${dateLabel(week.start)} au ${dateLabel(week.end)}</small></th><td>${number(week.correct)}</td><td>${number(week.incorrect)}</td><td>${number(week.completed)}</td><td>${rate(week.successRate)}</td></tr>`),
    'Volume et réussite par semaine de validation · Europe/Paris',
  )}</details>`;
}

function chartDescription(week) {
  return `${week.id}, du ${dateLabel(week.start)} au ${dateLabel(week.end)} : ${week.completed ? `${number(week.correct)} réussi${week.correct > 1 ? 's' : ''}, ${number(week.incorrect)} raté${week.incorrect > 1 ? 's' : ''}, ${number(week.completed)} réalisé${week.completed > 1 ? 's' : ''} ; réussite ${rate(week.successRate)}` : 'aucune réponse, taux non calculable'}.`;
}

function volumeChart(weeks) {
  const width = Math.max(540, weeks.length * 64 + 60);
  const left = 44, top = 22, plotHeight = 170, bottom = top + plotHeight;
  const step = (width - left - 12) / Math.max(1, weeks.length);
  const maximum = Math.max(1, ...weeks.map(week => week.completed));
  const ticks = [...new Set([0, Math.ceil(maximum / 2), maximum])];
  return `<div class="dashboard-chart-scroll" tabindex="0" role="region" aria-label="Graphique du volume hebdomadaire, défilement horizontal si nécessaire"><svg class="dashboard-svg" width="${width}" height="248" viewBox="0 0 ${width} 248" role="group" aria-labelledby="volume-svg-title" aria-describedby="dashboard-chart-help"><title id="volume-svg-title">Exercices réussis et ratés par semaine de validation</title><defs><pattern id="dashboard-errors" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" class="chart-error-fill"/><path d="M0 0V6" class="chart-error-stripe" stroke-width="2"/></pattern></defs>${ticks.map(tick => {
    const y = bottom - tick / maximum * plotHeight;
    return `<path d="M${left} ${y}H${width - 12}" class="chart-grid"/><text x="${left - 9}" y="${y + 4}" text-anchor="end" class="chart-axis">${number(tick)}</text>`;
  }).join('')}${weeks.map((week, index) => {
    const x = left + step * (index + 0.5), barWidth = Math.min(30, step - 16);
    const correctHeight = week.correct / maximum * plotHeight;
    const incorrectHeight = week.incorrect / maximum * plotHeight;
    return `<g tabindex="0" role="img" aria-label="${clean(chartDescription(week))}" data-chart-detail="${clean(chartDescription(week))}" data-chart-output="volume-detail" data-chart-week="${week.id}" class="chart-point"><title>${clean(chartDescription(week))}</title><rect x="${x - step / 2 + 2}" y="8" width="${step - 4}" height="200" class="chart-hit" rx="5"/>${week.completed ? `<rect x="${x - barWidth / 2}" y="${bottom - correctHeight}" width="${barWidth}" height="${correctHeight}" class="chart-success-fill"/><rect x="${x - barWidth / 2}" y="${bottom - correctHeight - incorrectHeight}" width="${barWidth}" height="${incorrectHeight}" fill="url(#dashboard-errors)"/><text x="${x}" y="${bottom - correctHeight - incorrectHeight - 6}" text-anchor="middle" class="chart-total">${number(week.completed)}</text>` : `<rect x="${x - barWidth / 2}" y="${bottom - 4}" width="${barWidth}" height="4" class="chart-no-data"/>`}<text x="${x}" y="222" text-anchor="middle" class="chart-axis">S${week.id.slice(6)}</text><text x="${x}" y="238" text-anchor="middle" class="chart-year">${week.id.slice(0, 4)}</text></g>`;
  }).join('')}</svg></div>`;
}

function rateChart(weeks) {
  const width = Math.max(540, weeks.length * 64 + 60);
  const left = 44, top = 22, plotHeight = 170, bottom = top + plotHeight;
  const step = (width - left - 12) / Math.max(1, weeks.length);
  const xAt = index => left + step * (index + 0.5);
  const yAt = value => bottom - value / 100 * plotHeight;
  // Starting a new subpath after each missing week prevents interpolation over gaps.
  let drawing = false;
  const path = weeks.map((week, index) => {
    if (week.successRate === null) { drawing = false; return ''; }
    const command = drawing ? 'L' : 'M';
    drawing = true;
    return `${command}${xAt(index)} ${yAt(week.successRate)}`;
  }).join(' ');
  return `<div class="dashboard-chart-scroll" tabindex="0" role="region" aria-label="Graphique du taux de réussite, défilement horizontal si nécessaire"><svg class="dashboard-svg" width="${width}" height="248" viewBox="0 0 ${width} 248" role="group" aria-labelledby="rate-svg-title" aria-describedby="dashboard-chart-help"><title id="rate-svg-title">Taux de réussite par semaine, interrompu en l’absence de réponses</title>${[0, 25, 50, 75, 100].map(tick => `<path d="M${left} ${yAt(tick)}H${width - 12}" class="chart-grid"/><text x="${left - 9}" y="${yAt(tick) + 4}" text-anchor="end" class="chart-axis">${tick} %</text>`).join('')}<path d="${path}" class="chart-rate-line"/>${weeks.map((week, index) => {
    const x = xAt(index);
    return `<g tabindex="0" role="img" aria-label="${clean(chartDescription(week))}" data-chart-detail="${clean(chartDescription(week))}" data-chart-output="rate-detail" data-chart-week="${week.id}" class="chart-point"><title>${clean(chartDescription(week))}</title><rect x="${x - step / 2 + 2}" y="8" width="${step - 4}" height="200" class="chart-hit" rx="5"/>${week.successRate === null ? `<path d="M${x - 7} ${bottom + 4}h14" class="chart-missing"/>` : `<circle cx="${x}" cy="${yAt(week.successRate)}" r="5" class="chart-rate-dot"/>`}<text x="${x}" y="222" text-anchor="middle" class="chart-axis">S${week.id.slice(6)}</text><text x="${x}" y="238" text-anchor="middle" class="chart-year">${week.id.slice(0, 4)}</text></g>`;
  }).join('')}</svg></div>`;
}

function comparison(model, selectedUnit) {
  return `<section class="dashboard-panel" aria-labelledby="dashboard-comparison-title"><div class="dashboard-section-head"><div><span class="eyebrow">REPÈRES PAR UNITÉ</span><h2 id="dashboard-comparison-title">Comparer les UC</h2></div><span class="dashboard-scope">Toutes les UC · période sélectionnée</span></div><p>Lis toujours le taux avec son nombre d’exercices. Sélectionne une ligne pour explorer cette UC.</p><div class="dashboard-comparison">${model.units.map(unit => `<button type="button" class="dashboard-uc-row ${unit.id === selectedUnit ? 'is-selected' : ''}" data-dashboard-unit="${clean(unit.id)}" aria-pressed="${unit.id === selectedUnit}" aria-label="${clean(`${unit.code} · ${unit.title} : ${rate(unit.successRate)}, ${number(unit.completed)} exercices réalisés. Voir les statistiques.`)}"><span class="dashboard-uc-name"><strong>${clean(unit.code)}</strong><span>${clean(unit.title)}</span></span><span class="dashboard-uc-track" aria-hidden="true">${unit.completed ? `<span style="width:${unit.successRate}%"></span>` : ''}</span><span class="dashboard-uc-value"><strong>${rate(unit.successRate)}</strong><span>${number(unit.completed)} réalisé${unit.completed > 1 ? 's' : ''} · ${unit.correct} réussi${unit.correct > 1 ? 's' : ''} / ${unit.incorrect} raté${unit.incorrect > 1 ? 's' : ''}</span></span><span class="dashboard-uc-arrow" aria-hidden="true">→</span></button>`).join('')}</div><details class="dashboard-data-table" data-dashboard-details="comparison"><summary>Afficher la comparaison en tableau</summary>${table(
    ['UC', 'Réalisés', 'Réussis', 'Ratés', 'Taux de réussite'],
    model.units.map(unit => `<tr><th scope="row">${clean(unit.code)}<small>${clean(unit.title)}</small></th><td>${number(unit.completed)}</td><td>${number(unit.correct)}</td><td>${number(unit.incorrect)}</td><td>${rate(unit.successRate)}</td></tr>`), 'Comparaison de toutes les UC sur la période sélectionnée',
  )}</details></section>`;
}

function observations(model, selectedUnit) {
  const unitList = model.units.filter(unit => selectedUnit === 'all' || unit.id === selectedUnit);
  const strong = unitList.filter(unit => unit.completed >= DASHBOARD_THRESHOLDS.minimumResponses && unit.successRate >= DASHBOARD_THRESHOLDS.strongRate);
  const rework = unitList.filter(unit => unit.completed >= DASHBOARD_THRESHOLDS.minimumResponses && unit.successRate < DASHBOARD_THRESHOLDS.reworkRate);
  const unitListMarkup = list => `<ul>${list.map(unit => `<li><strong>${clean(unit.code)}</strong> · ${rate(unit.successRate)} sur ${number(unit.completed)} exercices <a class="text-link" href="${drillUrl(unit.id)}">Reprendre les exercices →</a></li>`).join('')}</ul>`;
  return `<section class="dashboard-panel" aria-labelledby="dashboard-observations-title"><span class="eyebrow">ORIENTER TES RÉVISIONS</span><h2 id="dashboard-observations-title">Mes points forts / À retravailler</h2><p>Des observations sur tes réponses enregistrées, à mettre en regard des cours et de la pratique. Il faut au moins ${DASHBOARD_THRESHOLDS.minimumResponses} réponses dans un groupe pour le qualifier.</p><div class="dashboard-observation-grid"><div class="dashboard-observation"><h3>Points forts observés</h3>${strong.length ? unitListMarkup(strong) : '<p>Aucune UC avec assez de réponses et un taux suffisamment régulier pour le moment.</p>'}</div><div class="dashboard-observation dashboard-observation-review"><h3>À retravailler en priorité</h3>${rework.length ? unitListMarkup(rework) : '<p>Aucune UC ne présente actuellement un taux inférieur au seuil avec assez de réponses.</p>'}</div></div><h3 class="dashboard-notions-heading">Le détail par notion</h3><p class="dashboard-small">Chaque ligne regroupe une UC, un chapitre et un intitulé de notion identiques dans les questions sauvegardées. Un changement d’intitulé peut séparer une même notion ; aucune compétence non documentée n’est déduite.</p>${model.notions.length ? table(
    ['Notion · UC et chapitre', 'Réalisés', 'Réussis / ratés', 'Réussite', 'Observation', 'Revoir'],
    model.notions.map(notion => `<tr><th scope="row">${clean(notion.concept)}<small>${clean(units.find(unit => unit.id === notion.unit)?.code || notion.unit)} · ${clean(notion.chapter)}</small></th><td>${number(notion.completed)}</td><td>${number(notion.correct)} / ${number(notion.incorrect)}</td><td>${rate(notion.successRate)}</td><td><span class="dashboard-mastery dashboard-mastery-${clean(notion.mastery)}">${clean(masteryLabel[notion.mastery] || masteryLabel.insufficient)}</span></td><td>${notion.resources.map(resource => `<a class="text-link dashboard-course-link" href="${clean(resource.url)}" ${/^https?:/i.test(resource.url) ? 'target="_blank" rel="noopener noreferrer"' : ''}>${clean(resource.title)}${/^https?:/i.test(resource.url) ? ' (nouvel onglet)' : ''} →</a>`).join('')}<a class="text-link dashboard-course-link" href="${drillUrl(notion.unit)}">Exercices de cette UC →</a></td></tr>`), 'Résultats par notion · UC et période sélectionnées',
  ) : '<p class="dashboard-empty-inline">Aucune notion analysable sur cette sélection. Les notions apparaîtront après une première réponse validée et exploitable.</p>'}<details class="dashboard-method" data-dashboard-details="thresholds"><summary>Comprendre les seuils d’observation</summary><p>Moins de ${DASHBOARD_THRESHOLDS.minimumResponses} réponses : « Données insuffisantes ». À partir de ${DASHBOARD_THRESHOLDS.minimumResponses} réponses : moins de ${DASHBOARD_THRESHOLDS.reworkRate} % = « À retravailler » ; de ${DASHBOARD_THRESHOLDS.reworkRate} % à moins de ${DASHBOARD_THRESHOLDS.strongRate} % = « À consolider » ; à partir de ${DASHBOARD_THRESHOLDS.strongRate} % = « Réussite régulière observée ».</p><p>Ces seuils descriptifs sont de simples repères de révision. Ils ne sont pas une évaluation scientifique de ton niveau ni une probabilité de réussite à l’examen. Un taux élevé sur peu de questions, ou sur des questions répétées, ne couvre pas toute l’UC.</p></details>${model.chapters.length ? `<details class="dashboard-data-table" data-dashboard-details="chapters"><summary>Consulter la répartition par chapitre</summary>${table(
    ['UC · chapitre', 'Réalisés', 'Réussis', 'Ratés', 'Réussite'],
    model.chapters.map(chapter => `<tr><th scope="row">${clean(units.find(unit => unit.id === chapter.unit)?.code || chapter.unit)} · ${clean(chapter.chapter)}</th><td>${number(chapter.completed)}</td><td>${number(chapter.correct)}</td><td>${number(chapter.incorrect)}</td><td>${rate(chapter.successRate)}</td></tr>`), 'Résultats par chapitre · UC et période sélectionnées',
  )}</details>` : ''}</section>`;
}


function sourceDescription(source) {
  if (source.mode === 'visitor') return {
    label: 'Historique local de cet appareil', status: 'Mode visiteur · historique local de cet appareil',
    detail: 'Les résultats restent sur cet appareil. Aucune donnée pédagogique n’est envoyée à un compte.',
  };
  if (source.mode === 'blocked') return {
    label: 'Historique personnel masqué',
    status: source.loading ? 'Chargement de la session…' : 'Connexion au compte à vérifier',
    detail: source.loading ? 'Les résultats seront affichés une fois leur source vérifiée.' : 'Aucune donnée d’un compte précédent n’est affichée. Vérifie ta connexion pour retrouver ton historique personnel.',
  };
  const statuses = {
    loading: 'Chargement du cache personnel…', local: 'Historique personnel enregistré sur cet appareil',
    pending: 'Synchronisation en attente', syncing: 'Synchronisation en cours',
    synced: 'Historique personnel synchronisé', offline: 'Données personnelles hors ligne · synchronisation en attente',
    conflict: 'Conflit à résoudre', error: 'Synchronisation partielle · une intervention peut être nécessaire',
    'storage-error': 'Cache personnel inaccessible',
  };
  const detail = source.state === 'synced'
    ? 'Les données disponibles ont été confirmées lors de la dernière synchronisation. Actualise pour rechercher les réponses d’un autre appareil.'
    : source.loading ? 'Chargement des données de ce compte, séparées de l’historique visiteur.'
      : 'Ces résultats proviennent des données personnelles disponibles sur cet appareil. L’historique peut être incomplet ; leur disponibilité sur les autres appareils n’est pas encore garantie.';
  return { label: source.state === 'synced' ? 'Historique personnel synchronisé' : 'Historique personnel sur cet appareil',
    status: statuses[source.state] || 'Historique personnel à vérifier', detail };
}

export async function initDashboard(root) {
  let selectedUnit = 'all', selectedPeriod = '8', chartEnd = null;
  let chartAnchor = null, chartAtLatest = true;
  let service = null, unsubscribe = () => {}, stopped = false, starting = false;
  let snapshot = { mode: 'blocked', scope: null, view: { series: {}, warnings: [], error: null }, sync: { state: 'loading' } };
  let identity = null, identityVersion = 0, retryBusy = false, retryError = null;
  let renderedData = null, lastMarkup = null;
  const readQuery = () => {
    const params = new URLSearchParams(location.search);
    selectedUnit = units.some(unit => unit.id === params.get('unit')) ? params.get('unit') : 'all';
    selectedPeriod = ['4', '8', '12', 'all'].includes(params.get('period')) ? params.get('period') : '8';
  };
  readQuery();
  root.innerHTML = `<section class="page-top wrap dashboard-intro">${renderBreadcrumbs('dashboard')}<div class="dashboard-intro-row"><div><div class="page-eyebrow">TON ENTRAÎNEMENT, EN PERSPECTIVE</div><h1>Tableau de bord</h1><p>Retrouve ta progression dans les exercices hebdomadaires, les notions qui se précisent et celles à reprendre, à ton rythme.</p></div><a id="dashboard-drill-link" class="btn btn-primary" href="${drillUrl(selectedUnit)}">Reprendre les exercices hebdomadaires →</a></div></section><section class="wrap dashboard-layout" aria-label="Suivi pédagogique des exercices hebdomadaires"><form class="dashboard-filters" aria-label="Filtrer les statistiques"><label for="dashboard-unit">Unité capitalisable<select id="dashboard-unit"><option value="all">Toutes les UC</option>${units.map(unit => `<option value="${clean(unit.id)}">${clean(unit.code)} · ${clean(unit.title)}</option>`).join('')}</select></label><label for="dashboard-period">Période de validation<select id="dashboard-period"><option value="4">4 dernières semaines</option><option value="8">8 dernières semaines</option><option value="12">12 dernières semaines</option><option value="all">Historique complet</option></select></label><div class="dashboard-local-note"><span class="dashboard-local-dot" aria-hidden="true"></span>Exercices hebdomadaires uniquement<small id="dashboard-source">Vérification du compte…</small></div></form><section class="dashboard-sync" aria-label="Source et synchronisation des résultats"><div><p id="dashboard-sync-status" role="status" aria-live="polite" aria-atomic="true"></p><p id="dashboard-sync-detail"></p><p id="dashboard-conflict-note" hidden>Des choix concurrents restent conservés. Ils ne sont pas additionnés aux réponses retenues. <a class="text-link" href="drill.html">Résoudre dans les exercices hebdomadaires →</a></p></div><button type="button" class="btn btn-outline" data-dashboard-refresh>Actualiser les données</button><a id="dashboard-login" class="text-link" href="connexion.html" hidden>Vérifier ma connexion →</a></section><p id="dashboard-selection" class="dashboard-selection" role="status" aria-live="polite" aria-atomic="true"></p><div id="dashboard-content"></div><aside class="dashboard-method dashboard-method-footer"><h2>Ce que ces chiffres racontent</h2><p>Une première réponse validée compte une fois par question et par série. Le taux est calculé sur les exercices réalisés : les brouillons et questions laissées de côté ne sont jamais des erreurs. Les entraînements supplémentaires et les QCM de cours restent séparés.</p><p>Les semaines correspondent à la date réelle de validation, en Europe/Paris. Une ancienne série reprise aujourd’hui alimente donc la semaine actuelle. Les corrections et notions proviennent des copies sauvegardées au démarrage de chaque série ; une modification de la banque ne réécrit pas tes résultats.</p><p id="dashboard-source-method">Le tableau de bord vérifie la source disponible avant d’afficher des résultats. Il consulte l’historique sans modifier les réponses ni résoudre les conflits.</p></aside></section>`;

  const content = root.querySelector('#dashboard-content');
  const unitSelect = root.querySelector('#dashboard-unit');
  const periodSelect = root.querySelector('#dashboard-period');
  const sourceLabel = root.querySelector('#dashboard-source');
  const syncStatus = root.querySelector('#dashboard-sync-status');
  const syncDetail = root.querySelector('#dashboard-sync-detail');
  const refreshButton = root.querySelector('[data-dashboard-refresh]');
  const loginLink = root.querySelector('#dashboard-login');
  root.querySelector('form').addEventListener('submit', event => event.preventDefault());
  function setText(element, value) { if (element.textContent !== value) element.textContent = value; }

  // Restore only interactions within the same identity. A status-only change
  // never replaces the charts; a data change keeps table/keyboard/scroll state.
  function focusSelector(element) {
    if (!element || !content.contains(element)) return null;
    if (element.id) return `#${CSS.escape(element.id)}`;
    for (const attribute of ['data-dashboard-unit', 'data-chart-page']) {
      if (element.hasAttribute(attribute)) return `[${attribute}="${CSS.escape(element.getAttribute(attribute))}"]`;
    }
    if (element.matches('[data-chart-week]')) return `[data-chart-week="${CSS.escape(element.dataset.chartWeek)}"][data-chart-output="${element.dataset.chartOutput}"]`;
    if (element.matches('summary') && element.parentElement.dataset.dashboardDetails)
      return `[data-dashboard-details="${element.parentElement.dataset.dashboardDetails}"] > summary`;
    if (element.hasAttribute('aria-label')) return `[aria-label="${CSS.escape(element.getAttribute('aria-label'))}"]`;
    if (element.matches('a[href]')) return `a[href="${CSS.escape(element.getAttribute('href'))}"]`;
    return null;
  }
  function replaceContent(markup, preserve = true) {
    if (lastMarkup === markup) return;
    const focus = preserve ? focusSelector(document.activeElement) : null;
    const opened = preserve ? [...content.querySelectorAll('details[data-dashboard-details][open]')].map(el => el.dataset.dashboardDetails) : [];
    const scrolls = preserve ? [...content.querySelectorAll('.dashboard-chart-scroll,.dashboard-table-scroll')].map(el => [el.getAttribute('aria-label'), el.scrollLeft]) : [];
    content.innerHTML = markup; lastMarkup = markup;
    for (const key of opened) { const element = content.querySelector(`[data-dashboard-details="${key}"]`); if (element) element.open = true; }
    for (const [label, left] of scrolls) content.querySelectorAll('[aria-label]').forEach(el => { if (el.getAttribute('aria-label') === label) el.scrollLeft = left; });
    if (focus) content.querySelector(focus)?.focus({ preventScroll: true });
  }
  function render({ keepWindow = true } = {}) {
    if (stopped) return;
    const data = readDashboardData(snapshot);
    const source = data.source;
    const nextIdentity = JSON.stringify([source.mode, source.scope, source.blocked]);
    if (identity !== nextIdentity) {
      identity = nextIdentity; identityVersion++; retryBusy = false; retryError = null;
      chartAnchor = null; chartEnd = null; chartAtLatest = true;
      // Clear private DOM synchronously before any new model is computed.
      content.replaceChildren(); lastMarkup = null; renderedData = null;
    }
    const description = sourceDescription(source);
    setText(sourceLabel, description.label);
    setText(syncStatus, description.status);
    const extra = source.pending ? ` ${number(source.pending)} élément${source.pending > 1 ? 's' : ''} en attente de synchronisation.` : '';
    setText(syncDetail, `${description.detail}${extra}${source.message ? ` ${source.message}` : ''}${retryError ? ` ${retryError}` : ''}`);
    root.querySelector('#dashboard-conflict-note').hidden = !source.conflicts;
    loginLink.hidden = !source.blocked || source.loading;
    // Keep the initiating keyboard focus during a network retry. The retry
    // guard prevents duplicate requests while aria-disabled conveys the wait.
    refreshButton.disabled = starting || source.loading;
    refreshButton.setAttribute('aria-disabled', String(refreshButton.disabled || retryBusy));
    refreshButton.setAttribute('aria-busy', String(retryBusy));
    setText(root.querySelector('#dashboard-source-method'), source.mode === 'visitor'
      ? 'Le mode visiteur lit seulement l’historique local de cet appareil, sans envoi ni import dans un compte.'
      : 'Les résultats personnels utilisent uniquement l’historique de l’identité courante. Les données en attente restent visibles lorsqu’elles sont lisibles ; la synchronisation est nécessaire pour les retrouver ailleurs. Les conflits se résolvent dans les exercices hebdomadaires.');
    if (unitSelect.value !== selectedUnit) unitSelect.value = selectedUnit;
    if (periodSelect.value !== selectedPeriod) periodSelect.value = selectedPeriod;
    root.querySelector('#dashboard-drill-link').href = drillUrl(selectedUnit);
    const scope = selectedUnit === 'all' ? 'Toutes les UC' : units.find(unit => unit.id === selectedUnit).code;
    const selection = root.querySelector('#dashboard-selection');
    if (!source.available) {
      setText(selection, `${scope} · ${source.loading ? 'Chargement des données' : 'Données indisponibles'}`);
      const title = source.loading ? source.mode === 'personal' ? 'Chargement de ton historique personnel' : 'Vérification du compte en cours' : 'Ton historique ne peut pas être lu';
      const explanation = source.loading ? 'La source de tes résultats est en cours de vérification. Les données enregistrées sont conservées.' : data.error || source.message || 'Vérifie ta connexion ou réessaie la lecture. Les données enregistrées sont conservées.';
      replaceContent(`<div class="dashboard-empty"${source.loading ? ' aria-busy="true"' : ' role="alert"'}><h2>${title}</h2><p>${clean(explanation)}</p></div>`, false);
      renderedData = null; return;
    }
    const incompleteEmpty = source.mode === 'personal' && source.state !== 'synced' && Object.keys(data.series).length === 0;
    const key = JSON.stringify([identity, incompleteEmpty, data.series, data.error, data.warnings, selectedUnit, selectedPeriod, Math.floor(Date.now() / 60000), chartEnd]);
    if (renderedData === key) return;
    const model = createDashboardModel(data, { unit: selectedUnit, period: selectedPeriod });
    const rangeLabel = `${dateLabel(model.periodStart)} au ${dateLabel(model.periodEnd)}`;
    setText(selection, `${scope} · ${selectedPeriod === 'all' ? 'Historique complet' : `${selectedPeriod} dernières semaines, semaine actuelle incluse`} · ${rangeLabel} · ${model.error ? 'Données indisponibles' : `${number(model.totals.completed)} exercices réalisés dans les données disponibles`}`);
    if (model.error) {
      replaceContent(`<div class="dashboard-empty" role="alert"><h2>Ton historique ne peut pas être lu</h2><p>${clean(model.error)}</p><p>Les données sont conservées. Les statistiques ne peuvent pas être calculées pour le moment.</p></div>`);
      renderedData = key; return;
    }
    if (incompleteEmpty) {
      setText(selection, `${scope} · Historique personnel à récupérer`);
      replaceContent('<div class="dashboard-empty"><h2>Historique personnel encore incomplet</h2><p>Aucun résultat n’est disponible dans le cache de ce compte sur cet appareil. L’historique distant reste à vérifier ; cela ne signifie pas qu’il est vide.</p><p>Actualise les données ou retrouve ta connexion. Les opérations déjà enregistrées sont conservées.</p></div>');
      renderedData = null; return;
    }
    const totalWeeks = model.weeks.length;
    if (keepWindow && chartAnchor) {
      const anchor = model.weeks.findIndex(week => week.id === chartAnchor);
      if (chartAtLatest) chartEnd = totalWeeks;
      else if (anchor >= 0) chartEnd = anchor + 1;
    }
    chartEnd = Math.max(1, Math.min(chartEnd ?? totalWeeks, totalWeeks));
    const chartStart = Math.max(0, chartEnd - PAGE_SIZE);
    const visibleWeeks = model.weeks.slice(chartStart, chartEnd);
    const totals = model.totals;
    const warnings = model.warnings.length ? `<details class="dashboard-warning" data-dashboard-details="warnings"><summary>Bilan partiel : certaines données sont exclues (${model.warnings.length})</summary><ul>${model.warnings.map(warning => `<li>${clean(warning)}</li>`).join('')}</ul><p>Les données sources sont conservées sans modification.</p></details>` : '';
    chartAnchor = visibleWeeks.at(-1).id;
    chartAtLatest = chartEnd === totalWeeks;
    replaceContent(`${warnings}${!totals.completed ? `<div class="dashboard-empty"><span class="eyebrow">UN POINT DE DÉPART</span><h2>Aucun exercice réalisé sur cette sélection</h2><p>Valide une première réponse dans les exercices hebdomadaires pour faire apparaître tes résultats. Une série peut rester incomplète ; chaque réponse réalisée compte.</p><div class="dashboard-empty-actions"><a class="btn btn-primary" href="${drillUrl(selectedUnit)}">Ouvrir les exercices hebdomadaires →</a>${selectedPeriod !== 'all' ? '<button type="button" class="btn btn-outline" data-dashboard-all>Consulter tout l’historique</button>' : ''}</div></div>` : ''}<dl class="dashboard-metrics"><div><dt>Exercices réalisés</dt><dd>${number(totals.completed)}</dd><span>Premières réponses validées</span></div><div><dt>Réponses correctes</dt><dd>${number(totals.correct)}</dd><span>Sur les exercices réalisés</span></div><div><dt>Réponses incorrectes</dt><dd>${number(totals.incorrect)}</dd><span>Questions non faites exclues</span></div><div><dt>Taux de réussite</dt><dd class="${totals.successRate === null ? 'dashboard-no-rate' : ''}">${rate(totals.successRate)}</dd><span>Bonnes réponses ÷ réalisées</span></div><div><dt>Semaines actives</dt><dd>${number(totals.activeWeeks)}</dd><span>Au moins une réponse validée</span></div></dl><section class="dashboard-panel" aria-labelledby="dashboard-weekly-title"><div class="dashboard-section-head"><div><span class="eyebrow">AU FIL DU TEMPS</span><h2 id="dashboard-weekly-title">Ton entraînement hebdomadaire</h2></div><span class="dashboard-scope">${clean(scope)} · semaines ISO</span></div><p id="dashboard-chart-help">Survole, touche ou sélectionne au clavier une semaine pour lire ses résultats. Fais défiler les graphiques horizontalement si nécessaire. Les semaines sans réponse sont des périodes sans données.</p>${totalWeeks > PAGE_SIZE ? `<div class="dashboard-chart-pager"><button type="button" class="btn btn-outline" data-chart-page="previous" ${chartStart === 0 ? 'disabled' : ''} aria-label="Afficher les semaines précédentes">← Précédentes</button><p>Semaines ${visibleWeeks[0].id} à ${visibleWeeks.at(-1).id}<small>${chartStart + 1}–${chartEnd} sur ${totalWeeks} semaines · les totaux portent sur toute la période</small></p><button type="button" class="btn btn-outline" data-chart-page="next" ${chartEnd === totalWeeks ? 'disabled' : ''} aria-label="Afficher les semaines suivantes">Suivantes →</button></div>` : ''}<div class="dashboard-chart-grid"><figure class="dashboard-figure"><figcaption><h3>Volume hebdomadaire</h3><span>Nombre d’exercices réalisés</span></figcaption><div class="dashboard-legend"><span><i class="legend-success" aria-hidden="true"></i>Réussis</span><span><i class="legend-error" aria-hidden="true"></i>Ratés</span><span>Total indiqué au-dessus</span></div>${volumeChart(visibleWeeks)}<p id="volume-detail" class="dashboard-chart-detail" aria-live="polite" aria-atomic="true">${clean(chartDescription(visibleWeeks.at(-1)))}</p></figure><figure class="dashboard-figure"><figcaption><h3>Évolution du taux de réussite</h3><span>Bonnes réponses parmi les exercices réalisés</span></figcaption><div class="dashboard-legend"><span><i class="legend-line" aria-hidden="true"></i>Réussite</span><span><i class="legend-missing" aria-hidden="true"></i>Aucune réponse : courbe interrompue</span></div>${rateChart(visibleWeeks)}<p id="rate-detail" class="dashboard-chart-detail" aria-live="polite" aria-atomic="true">${clean(chartDescription(visibleWeeks.at(-1)))}</p></figure></div>${weeklyTable(model.weeks)}</section>${comparison(model, selectedUnit)}${observations(model, selectedUnit)}`);

    renderedData = JSON.stringify([identity, incompleteEmpty, data.series, data.error, data.warnings, selectedUnit, selectedPeriod, Math.floor(Date.now() / 60000), chartEnd]);
  }
  function filterChanged() {
    chartEnd = null; chartAnchor = null; renderedData = null;
    const url = new URL(location.href);
    if (selectedUnit === 'all') url.searchParams.delete('unit'); else url.searchParams.set('unit', selectedUnit);
    url.searchParams.set('period', selectedPeriod);
    history.pushState(null, '', url);
    render({ keepWindow: false });
  }
  unitSelect.addEventListener('change', () => { selectedUnit = unitSelect.value; filterChanged(); });
  periodSelect.addEventListener('change', () => { selectedPeriod = periodSelect.value; filterChanged(); });
  async function connect() {
    if (starting || service || stopped) return;
    starting = true; render();
    try {
      const created = await getDrillSyncService();
      if (stopped) { created.stop(); return; }
      service = created;
      unsubscribe = service.subscribe(next => { snapshot = next; render(); });
    } catch {
      snapshot = { mode: 'blocked', scope: null, view: { series: {}, warnings: [], error: 'La source des résultats est indisponible. Réessaie sans effacer les données de cet appareil.' }, sync: { state: 'session' } };
    } finally { starting = false; render(); }
  }
  async function retry() {
    if (retryBusy || starting || stopped) return;
    if (!service) { await connect(); return; }
    const version = identityVersion;
    retryBusy = true; retryError = null; render();
    try { await service.retry(); }
    catch { if (version === identityVersion) retryError = 'L’actualisation reste indisponible. Les données personnelles déjà enregistrées sont conservées.'; }
    finally {
      if (version === identityVersion) { retryBusy = false; renderedData = null; render(); }
    }
  }
  root.addEventListener('click', event => {
    const unitButton = event.target.closest('[data-dashboard-unit]');
    if (unitButton) {
      selectedUnit = unitButton.dataset.dashboardUnit; filterChanged();
      root.querySelector(`[data-dashboard-unit="${selectedUnit}"]`)?.focus({ preventScroll: true });
    }
    if (event.target.closest('[data-dashboard-all]')) { selectedPeriod = 'all'; filterChanged(); periodSelect.focus({ preventScroll: true }); }
    if (event.target.closest('[data-dashboard-refresh]')) { void retry(); return; }
    const pageButton = event.target.closest('[data-chart-page]');
    if (pageButton) {
      const direction = pageButton.dataset.chartPage;
      chartEnd = direction === 'previous' ? Math.max(1, chartEnd - PAGE_SIZE) : chartEnd + PAGE_SIZE;
      renderedData = null; render({ keepWindow: false });
      (root.querySelector(`[data-chart-page="${direction}"]:not(:disabled)`) || root.querySelector('[data-chart-page]:not(:disabled)'))?.focus({ preventScroll: true });
    }
  });
  const showChartDetail = event => {
    const point = event.target.closest('[data-chart-detail]');
    if (point) setText(root.querySelector(`#${point.dataset.chartOutput}`), point.dataset.chartDetail);
  };
  root.addEventListener('pointerover', showChartDetail);
  root.addEventListener('focusin', showChartDetail);
  const onPopstate = () => { readQuery(); chartEnd = null; chartAnchor = null; renderedData = null; render({ keepWindow: false }); };
  const onStorage = event => { if (snapshot.mode === 'visitor' && (event.key === DRILL_STORAGE_KEY || event.key === null)) render(); };
  const onVisible = () => { if (!document.hidden) render(); };
  const onPageshow = event => { if (event.persisted) location.reload(); else render(); };
  const timer = window.setInterval(() => render(), 60000);
  window.addEventListener('popstate', onPopstate);
  window.addEventListener('storage', onStorage);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('pageshow', onPageshow);
  window.addEventListener('pagehide', () => {
    stopped = true; unsubscribe(); service?.stop(); clearInterval(timer);
    window.removeEventListener('popstate', onPopstate); window.removeEventListener('storage', onStorage);
    document.removeEventListener('visibilitychange', onVisible);
    if (snapshot.mode !== 'visitor') root.replaceChildren();
  }, { once: true });
  render();
  await connect();
}
