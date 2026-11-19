import { units } from './content.js';
import { renderBreadcrumbs } from './breadcrumbs.js';
import { DRILL_STORAGE_KEY } from './drill-store.js';
import { readDashboardData } from './dashboard-data.js';
import { getDrillSyncService } from './drill-sync-service.js';
import { createDashboardModel, DASHBOARD_THRESHOLDS } from './dashboard-stats.js';

const clean = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const number = new Intl.NumberFormat('fr-FR').format;
const rate = value => value === null ? 'Aucune donnée' : `${Math.round(value)} %`;
const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const dateLabel = value => dateFormat.format(new Date(`${value}T12:00:00Z`));
const rangeLabel = (start, end) => `du ${dateLabel(start)} au ${dateLabel(end)}`;
const drillUrl = unit => `drill.html${unit === 'all' ? '' : `?unit=${encodeURIComponent(unit)}`}`;
const PAGE_SIZE = 12;
const periods = ['4', '8', '12', 'all'];
const unitCodes = new Map(units.map(unit => [unit.id, unit.code]));
const chartTitles = { volume: 'Volume hebdomadaire', rate: 'Taux de réussite' };
const observations = {
  rework: ['À retravailler', 'Aucune notion sous le seuil de révision.'],
  developing: ['À consolider', 'Aucune notion dans cette catégorie.'],
  strong: ['Points forts observés', 'Aucun point fort observé sur cette sélection.'],
  insufficient: ['Données insuffisantes', 'Aucune notion avec trop peu de réponses.'],
};

function table(headers, rows, caption) {
  return `
    <div class="dashboard-table-scroll" tabindex="0" role="region" aria-label="${clean(caption)}">
      <table class="dashboard-table">
        <caption>${clean(caption)}</caption>
        <thead><tr>${headers.map(header => `<th scope="col">${clean(header)}</th>`).join('')}</tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    </div>`;
}

function weeklyTable(weeks) {
  return `<details class="dashboard-data-table" data-dashboard-details="weekly">
    <summary>Données hebdomadaires en tableau · ${number(weeks.length)} semaine${weeks.length > 1 ? 's' : ''}</summary>
    ${table(
      ['Semaine ISO', 'Correctes', 'Incorrectes', 'Total réalisé', 'Taux de réussite'],
      weeks.map(week => `<tr><th scope="row">${week.id}<small>${rangeLabel(week.start, week.end)}</small></th>
        <td>${number(week.correct)}</td><td>${number(week.incorrect)}</td><td>${number(week.completed)}</td><td>${rate(week.successRate)}</td></tr>`),
      'Toutes les semaines de la période · Europe/Paris',
    )}
  </details>`;
}

function countLabel(count, noun, plural = `${noun}s`) {
  return `${number(count)} ${count > 1 ? plural : noun}`;
}

function chartDescription(week) {
  const values = week.completed
    ? `${countLabel(week.correct, 'réussi')}, ${countLabel(week.incorrect, 'raté')}, ${countLabel(week.completed, 'réalisé')}, réussite ${rate(week.successRate)}`
    : 'aucune réponse, taux non calculable';
  return `${week.id}, ${rangeLabel(week.start, week.end)}. ${values}.`;
}

function weekDetail(week, kind) {
  let description = 'Aucune réponse validée.';
  if (week.completed) {
    description = kind === 'volume'
      ? `${countLabel(week.completed, 'exercice réalisé', 'exercices réalisés')} · ${countLabel(week.correct, 'correcte')} · ${countLabel(week.incorrect, 'incorrecte')}`
      : `${rate(week.successRate)} · ${countLabel(week.correct, 'réponse correcte', 'réponses correctes')} sur ${number(week.completed)}`;
  } else if (kind === 'rate') description = 'Taux non calculable · aucune réponse validée.';
  return `<p class="dashboard-week-date"><strong>${week.id}</strong> · ${rangeLabel(week.start, week.end)}</p><p>${description}</p>`;
}

function chartFigure(kind) {
  const legend = kind === 'volume'
    ? `<li><i class="legend-success"></i>Correctes</li><li><i class="legend-error"></i>Incorrectes</li><li>Total au-dessus</li>`
    : `<li><i class="legend-line"></i>Réussite</li><li><i class="legend-missing"></i>Aucune réponse</li>`;
  return `<figure class="dashboard-figure">
    <figcaption><h3>${chartTitles[kind]}</h3></figcaption>
    <ul class="dashboard-legend" role="list" aria-label="Légende">${legend}</ul>
    <div data-dashboard-region="${kind}-plot"></div>
    <div class="dashboard-chart-detail" id="${kind}-detail" data-dashboard-region="${kind}-detail"></div>
  </figure>`;
}

function weeklyChart(weeks, kind) {
  const isRate = kind === 'rate';
  const width = Math.max(320, weeks.length * 40 + 54);
  const left = 42, right = width - 12, top = 26, bottom = 161;
  const step = (right - left) / weeks.length;
  const xAt = index => left + step * (index + 0.5);
  const maximum = isRate ? 100 : Math.max(1, ...weeks.map(week => week.completed));
  const ticks = isRate ? [0, 25, 50, 75, 100] : [...new Set([0, Math.floor(maximum / 2), maximum])];
  const yAt = value => bottom - value / maximum * (bottom - top);
  const grid = ticks.map(tick => `
    <path d="M${left} ${yAt(tick)}H${right}" class="chart-grid"/>
    <text x="${left - 7}" y="${yAt(tick) + 4}" text-anchor="end" class="chart-axis">${number(tick)}${isRate ? ' %' : ''}</text>`).join('');
  // A new subpath after a missing week keeps the line interrupted.
  const line = isRate ? weeks.map((week, index) => week.successRate === null ? '' :
    `${weeks[index - 1]?.successRate != null ? 'L' : 'M'}${xAt(index)} ${yAt(week.successRate)}`).join(' ') : '';
  const barWidth = Math.min(34, step - 12);
  const points = weeks.map((week, index) => {
    const x = xAt(index), barLeft = x - barWidth / 2;
    let marks = `<path d="M${x - 8} ${bottom + 7}h16" class="chart-missing"/>`;
    if (week.completed && isRate) {
      marks = `<circle cx="${x}" cy="${yAt(week.successRate)}" r="4.5" class="chart-rate-dot"/>`;
    } else if (week.completed) {
      const stack = yAt(week.correct);
      const total = yAt(week.completed);
      marks = `${week.correct ? `<rect x="${barLeft}" y="${stack}" width="${barWidth}" height="${bottom - stack}" class="chart-success-fill"/>` : ''}
        ${week.incorrect ? `<rect x="${barLeft}" y="${total}" width="${barWidth}" height="${stack - total}" fill="url(#dashboard-errors)"/>` : ''}
        <text x="${x}" y="${total - 6}" text-anchor="middle" class="chart-total">${number(week.completed)}</text>`;
    }
    return `<g tabindex="-1" role="img" aria-label="${clean(chartDescription(week))}" data-chart-week="${week.id}"
      data-chart-output="${kind}-detail" class="chart-point">
      <rect x="${x - step / 2 + 2}" y="7" width="${step - 4}" height="199" class="chart-hit" rx="5"/>
      ${marks}
      <text x="${x}" y="186" text-anchor="middle" class="chart-axis">S${week.id.slice(6)}</text>
      <text x="${x}" y="200" text-anchor="middle" class="chart-year">${week.id.slice(0, 4)}</text>
    </g>`;
  }).join('');
  return `<div class="dashboard-chart-scroll" tabindex="0" role="region" aria-label="${chartTitles[kind]} · graphique défilant">
    <svg class="dashboard-svg" width="${width}" height="212" viewBox="0 0 ${width} 212" style="--plot-width:${width}px"
      role="group" aria-labelledby="${kind}-svg-title" aria-describedby="dashboard-chart-help">
      <title id="${kind}-svg-title">${isRate ? 'Taux hebdomadaire, avec une coupure aux semaines sans réponse' : 'Réponses correctes, incorrectes et total par semaine'}</title>
      ${isRate ? '' : `<defs><pattern id="dashboard-errors" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="6" height="6" class="chart-error-fill"/><path d="M0 0V6" class="chart-error-stripe" stroke-width="2"/>
      </pattern></defs>`}
      ${grid}${isRate ? `<path d="${line}" class="chart-rate-line"/>` : ''}${points}
    </svg>
  </div>`;
}

function chartPager(weeks, start, end, total) {
  return total <= PAGE_SIZE ? '' : `<div class="dashboard-chart-pager">
    <button type="button" class="btn btn-surface" data-chart-page="previous" ${start === 0 ? 'disabled' : ''} aria-label="Afficher les semaines précédentes">← Précédentes</button>
    <p><strong>${weeks[0].id} → ${weeks.at(-1).id}</strong><small>Semaines ${start + 1} à ${end} sur ${number(total)}</small></p>
    <button type="button" class="btn btn-surface" data-chart-page="next" ${end === total ? 'disabled' : ''} aria-label="Afficher les semaines suivantes">Suivantes →</button>
  </div>`;
}


function metrics(totals) {
  return `<section aria-labelledby="dashboard-summary-title">
    <div class="dashboard-section-head">
      <h2 id="dashboard-summary-title">Bilan de la période</h2>
      <p>Réussite sur les premières réponses validées</p>
    </div>
    <dl class="dashboard-metrics">
      <div class="dashboard-metric-primary"><dt>Exercices réalisés</dt><dd>${number(totals.completed)}</dd></div>
      <div><dt>Réponses correctes</dt><dd>${number(totals.correct)}</dd></div>
      <div><dt>Réponses incorrectes</dt><dd>${number(totals.incorrect)}</dd></div>
      <div class="dashboard-metric-rate"><dt>Taux de réussite</dt><dd class="${totals.successRate === null ? 'dashboard-no-rate' : ''}">${rate(totals.successRate)}</dd></div>
      <div><dt>Semaines actives</dt><dd>${number(totals.activeWeeks)}</dd></div>
    </dl>
  </section>`;
}

function comparison(model, selectedUnit) {
  return `<section aria-labelledby="dashboard-comparison-title">
    <div class="dashboard-section-head">
      <h2 id="dashboard-comparison-title">Comparer les UC</h2>
      <p>Toutes les UC sur la période sélectionnée</p>
    </div>
    <p class="dashboard-section-copy">Sélectionne une UC pour voir ses résultats détaillés.</p>
    <div class="dashboard-comparison">
      ${model.units.map(unit => {
        const selected = unit.id === selectedUnit;
        return `<button type="button" class="dashboard-uc-row" data-dashboard-unit="${clean(unit.id)}" aria-pressed="${selected}">
          <span class="dashboard-uc-name"><strong>${clean(unit.code)}</strong><span>${clean(unit.title)}</span></span>
          <span class="dashboard-uc-value"><strong>${rate(unit.successRate)}</strong>
            ${unit.successRate === null ? '' : `<span class="dashboard-uc-track" aria-hidden="true"><span style="width:${unit.successRate}%"></span></span>`}
          </span>
          <span class="dashboard-uc-counts"><strong>${countLabel(unit.completed, 'exercice', 'exercices')}</strong>
            <span>${countLabel(unit.correct, 'correcte')} · ${countLabel(unit.incorrect, 'incorrecte')}</span>
          </span>
          ${selected ? '<span class="dashboard-uc-selected">Sélectionnée</span>' : '<span class="dashboard-uc-arrow" aria-hidden="true">→</span>'}
        </button>`;
      }).join('')}
    </div>
    <details class="dashboard-data-table" data-dashboard-details="comparison">
      <summary>Comparaison des UC en tableau</summary>
      ${table(
        ['UC', 'Réalisés', 'Correctes', 'Incorrectes', 'Taux de réussite'],
        model.units.map(unit => `<tr><th scope="row">${clean(unit.code)}<small>${clean(unit.title)}</small></th>
          <td>${number(unit.completed)}</td><td>${number(unit.correct)}</td><td>${number(unit.incorrect)}</td><td>${rate(unit.successRate)}</td></tr>`),
        'Comparaison de toutes les UC sur la période sélectionnée',
      )}
    </details>
  </section>`;
}

function notionCard(notion) {
  const resources = [...notion.resources, { title: 'Exercices de cette UC', url: drillUrl(notion.unit) }];
  return `<li class="dashboard-notion">
    <div>
      <h3>${clean(notion.concept)}</h3>
      <p>${clean(unitCodes.get(notion.unit) || notion.unit)} · ${clean(notion.chapter)}</p>
    </div>
    <div class="dashboard-notion-results">
      <p><strong>${rate(notion.successRate)}</strong> · ${countLabel(notion.completed, 'exercice réalisé', 'exercices réalisés')}</p>
      <p>${countLabel(notion.correct, 'correcte')} · ${countLabel(notion.incorrect, 'incorrecte')}</p>
    </div>
    <div class="dashboard-notion-links">
      ${resources.map(resource => {
        const external = /^https?:/i.test(resource.url);
        const key = JSON.stringify([notion.unit, notion.chapter, notion.concept, resource.url]);
        return `<a class="ui-link dashboard-course-link" href="${clean(resource.url)}" data-dashboard-focus="${clean(key)}"
          ${external ? 'target="_blank" rel="noopener noreferrer"' : ''}>${clean(resource.title)}${external ? ' (nouvel onglet)' : ''}</a>`;
      }).join('')}
    </div>
  </li>`;
}

function unitObservations(model, selectedUnit) {
  const { minimumResponses, strongRate, reworkRate } = DASHBOARD_THRESHOLDS;
  const enough = model.units.filter(unit => (selectedUnit === 'all' || unit.id === selectedUnit) && unit.completed >= minimumResponses);
  const describe = list => `<ul>${list.map(unit => `<li><strong>${clean(unit.code)}</strong> · ${rate(unit.successRate)} sur ${number(unit.completed)} exercices
    <a class="ui-link" href="${drillUrl(unit.id)}">Reprendre les exercices</a></li>`).join('')}</ul>`;
  const strong = enough.filter(unit => unit.successRate >= strongRate);
  const rework = enough.filter(unit => unit.successRate < reworkRate);
  return `<details class="dashboard-data-table" data-dashboard-details="unit-observations">
    <summary>Observations par UC dans la sélection</summary>
    <div class="dashboard-unit-observations">
      <div><h3>Points forts observés</h3>${strong.length ? describe(strong) : '<p>Aucun point fort observé par UC.</p>'}</div>
      <div><h3>À retravailler</h3>${rework.length ? describe(rework) : '<p>Aucune UC sous le seuil de révision.</p>'}</div>
    </div>
  </details>`;
}

function revisionGuide(model, selectedUnit) {
  const { minimumResponses, strongRate, reworkRate } = DASHBOARD_THRESHOLDS;
  const groups = Object.entries(observations).map(([key, [label, empty]]) => {
    const notions = model.notions.filter(notion => notion.mastery === key);
    return `<details class="dashboard-notion-group" data-dashboard-details="notions-${key}" ${key === 'rework' && notions.length ? 'open' : ''}>
      <summary><span>${label}</span><span class="dashboard-notion-count">${countLabel(notions.length, 'notion')}</span></summary>
      ${notions.length ? `<ul class="dashboard-notions" role="list">${notions.map(notionCard).join('')}</ul>` : `<p class="dashboard-group-empty">${empty}</p>`}
    </details>`;
  }).join('');
  return `<section aria-labelledby="dashboard-observations-title">
    <div class="dashboard-section-head"><h2 id="dashboard-observations-title">Orienter tes révisions</h2></div>
    <p class="dashboard-section-copy">Les observations portent sur les notions rencontrées. Il faut au moins ${minimumResponses} réponses par notion pour dégager un repère.</p>
    ${model.notions.length ? `<div class="dashboard-notion-groups">${groups}</div>` : '<p class="dashboard-empty-inline">Tes premières réponses validées feront apparaître ici les notions travaillées.</p>'}
    ${unitObservations(model, selectedUnit)}
    ${model.chapters.length ? `<details class="dashboard-data-table" data-dashboard-details="chapters">
      <summary>Répartition par chapitre</summary>
      ${table(
        ['UC · chapitre', 'Réalisés', 'Correctes', 'Incorrectes', 'Taux de réussite'],
        model.chapters.map(chapter => `<tr><th scope="row">${clean(unitCodes.get(chapter.unit) || chapter.unit)} · ${clean(chapter.chapter)}</th>
          <td>${number(chapter.completed)}</td><td>${number(chapter.correct)}</td><td>${number(chapter.incorrect)}</td><td>${rate(chapter.successRate)}</td></tr>`),
        'Résultats par chapitre · UC et période sélectionnées',
      )}
    </details>` : ''}
    <details class="dashboard-data-table" data-dashboard-details="thresholds">
      <summary>Seuils d’observation</summary>
      <p>Avec moins de ${minimumResponses} réponses, les données sont insuffisantes. À partir de ${minimumResponses} réponses,
        un taux sous ${reworkRate} % correspond à « À retravailler », de ${reworkRate} % à moins de ${strongRate} % à
        « À consolider » et à partir de ${strongRate} % à « Points forts observés ».</p>
      <p>Ces repères décrivent les réponses de la sélection. Leur portée dépend du nombre de questions distinctes et des notions couvertes.</p>
    </details>
  </section>`;
}

function dashboardShell(selectedUnit) {
  return `<div class="page-top wrap dashboard-intro">
    ${renderBreadcrumbs('dashboard')}
    <div class="dashboard-hero">
      <div><h1>Tableau de bord</h1><p>Comprends ta progression et repère les notions à revoir.</p></div>
      <a id="dashboard-drill-link" class="btn btn-surface" href="${drillUrl(selectedUnit)}">Exercices hebdomadaires <span aria-hidden="true">→</span></a>
    </div>
  </div>
  <div class="wrap dashboard-layout">
    <form class="dashboard-filters" aria-label="Filtrer les statistiques">
      <label for="dashboard-unit">Unité capitalisable
        <select id="dashboard-unit"><option value="all">Toutes les UC</option>${units.map(unit => `
          <option value="${clean(unit.id)}">${clean(unit.code)} · ${clean(unit.title)}</option>`).join('')}</select>
      </label>
      <label for="dashboard-period">Période de validation
        <select id="dashboard-period">${periods.map(period => `
          <option value="${period}">${period === 'all' ? 'Historique complet' : `${period} dernières semaines`}</option>`).join('')}</select>
      </label>
      <p id="dashboard-selection" class="dashboard-selection" role="status"></p>
    </form>
    <section class="dashboard-sync" aria-label="Source et synchronisation des résultats">
      <div>
        <p id="dashboard-sync-status" role="status"></p>
        <p id="dashboard-sync-detail"></p>
        <p id="dashboard-conflict-note" hidden>Un conflit doit être résolu pour choisir la réponse à retenir.
          <a class="ui-link" href="drill.html">Résoudre dans les exercices hebdomadaires →</a></p>
      </div>
      <button type="button" class="btn btn-surface" data-dashboard-refresh>Actualiser les données</button>
      <a id="dashboard-login" class="ui-link" href="connexion.html" hidden>Vérifier ma connexion →</a>
    </section>
    <div id="dashboard-content">
      <div data-dashboard-region="notice"></div>
      <div id="dashboard-results" hidden>
        <div data-dashboard-region="metrics"></div>
        <section aria-labelledby="dashboard-weekly-title">
          <div class="dashboard-section-head">
            <h2 id="dashboard-weekly-title">Évolution hebdomadaire</h2>
            <p>Semaines ISO · Europe/Paris</p>
          </div>
          <p id="dashboard-chart-help" class="dashboard-section-copy">Survole ou touche une semaine pour lire ses résultats.
            Au clavier, utilise les flèches dans le graphique. Fais défiler le graphique horizontalement si nécessaire.</p>
          <div data-dashboard-region="pager"></div>
          <div class="dashboard-chart-grid">${chartFigure('volume')}${chartFigure('rate')}</div>
          <div data-dashboard-region="weekly-table"></div>
        </section>
        <div data-dashboard-region="comparison"></div>
        <div data-dashboard-region="revisions"></div>
      </div>
    </div>
    <details class="dashboard-method">
      <summary><h2>Méthode et limites</h2></summary>
      <div>
        <p>Une première réponse validée compte une fois par question et par série, y compris dans une série incomplète.
          Les brouillons, les questions sans réponse, les entraînements supplémentaires, les QCM de cours et les cours terminés sont exclus.</p>
        <p>La semaine est celle de la validation, du lundi au dimanche en Europe/Paris. Les filtres 4, 8 et 12 semaines
          incluent la semaine en cours. L’historique complet commence à la première activité fiable.
          Les tableaux et les totaux couvrent toute la période sélectionnée.</p>
        <p>Le taux rapporte les bonnes réponses au nombre d’exercices réalisés. Une semaine sans réponse laisse une coupure dans la courbe.
          Les résultats décrivent les exercices effectués. Les corrections et les notions proviennent des questions sauvegardées avec chaque série.
          Un bilan partiel en tête de résultats signale les données incohérentes écartées du calcul.</p>
        <p><strong id="dashboard-source">Vérification du compte…</strong></p>
        <p id="dashboard-source-method"></p>
      </div>
    </details>
  </div>`;
}


function sourceDescription(source) {
  if (source.mode === 'visitor') return {
    label: 'Historique local de cet appareil', status: 'Mode visiteur · historique local de cet appareil', detail: '',
  };
  if (source.mode === 'blocked') return {
    label: 'Historique personnel masqué',
    status: source.loading ? 'Chargement de la session…' : 'Connexion au compte à vérifier',
    detail: source.loading ? '' : 'Vérifie ta connexion pour retrouver ton historique personnel.',
  };
  const statuses = {
    loading: 'Chargement du cache personnel…', local: 'Historique personnel enregistré sur cet appareil',
    pending: 'Synchronisation en attente', syncing: 'Synchronisation en cours',
    synced: 'Historique personnel synchronisé', offline: 'Données personnelles hors ligne · synchronisation en attente',
    conflict: 'Conflit à résoudre', error: 'Synchronisation partielle · une intervention peut être nécessaire',
    'storage-error': 'Cache personnel inaccessible',
  };
  const detail = source.loading || source.state === 'synced' || !source.available
    ? '' : 'Les résultats disponibles sur cet appareil peuvent être incomplets.';
  return {
    label: source.state === 'synced' ? 'Historique personnel synchronisé' : 'Historique personnel sur cet appareil',
    status: source.loading ? statuses.loading : statuses[source.state] || 'Historique personnel à vérifier',
    detail,
  };
}

function notice(title, explanation, state, actions = '') {
  return `<section class="dashboard-empty" data-notice-state="${state}"${state === 'loading' ? ' aria-busy="true"' : state === 'error' ? ' role="alert"' : ''}>
    <h2>${title}</h2><p>${clean(explanation)}</p>${actions}
  </section>`;
}

function focusSelector(element) {
  if (element.id) return `#${CSS.escape(element.id)}`;
  for (const attribute of ['data-dashboard-unit', 'data-chart-page', 'data-dashboard-focus']) {
    if (element.hasAttribute(attribute)) return `[${attribute}="${CSS.escape(element.getAttribute(attribute))}"]`;
  }
  if (element.matches('[data-chart-week]')) return `[data-chart-week="${CSS.escape(element.dataset.chartWeek)}"]`;
  if (element.matches('summary') && element.parentElement.dataset.dashboardDetails) {
    return `[data-dashboard-details="${element.parentElement.dataset.dashboardDetails}"] > summary`;
  }
  if (element.hasAttribute('aria-label')) return `[aria-label="${CSS.escape(element.getAttribute('aria-label'))}"]`;
  if (element.matches('a[href]')) return `a[href="${CSS.escape(element.getAttribute('href'))}"]`;
  return null;
}

export async function initDashboard(root) {
  let selectedUnit, selectedPeriod, chartAnchor = null;
  let service = null, unsubscribe = () => {}, stopped = false, starting = false;
  let snapshot = { mode: 'blocked', scope: null, view: {}, sync: { state: 'loading' } };
  let identity = null, identityVersion = 0, retryBusy = false, retryError = null;
  let model = null, modelKey = null, windowKey = null, visibleWeeks = [];
  const inspectedWeek = { volume: null, rate: null };

  function readQuery() {
    const params = new URLSearchParams(location.search);
    selectedUnit = unitCodes.has(params.get('unit')) ? params.get('unit') : 'all';
    selectedPeriod = periods.includes(params.get('period')) ? params.get('period') : '8';
  }
  readQuery();
  root.innerHTML = dashboardShell(selectedUnit);

  const results = root.querySelector('#dashboard-results');
  const unitSelect = root.querySelector('#dashboard-unit');
  const periodSelect = root.querySelector('#dashboard-period');
  const selection = root.querySelector('#dashboard-selection');
  const drillLink = root.querySelector('#dashboard-drill-link');
  const sourceLabel = root.querySelector('#dashboard-source');
  const sourceMethod = root.querySelector('#dashboard-source-method');
  const syncPanel = root.querySelector('.dashboard-sync');
  const syncStatus = root.querySelector('#dashboard-sync-status');
  const syncDetail = root.querySelector('#dashboard-sync-detail');
  const conflictNote = root.querySelector('#dashboard-conflict-note');
  const refreshButton = root.querySelector('[data-dashboard-refresh]');
  const loginLink = root.querySelector('#dashboard-login');
  const regions = Object.fromEntries([...root.querySelectorAll('[data-dashboard-region]')]
    .map(element => [element.dataset.dashboardRegion, element]));
  const rendered = new Map();
  const setText = (element, value) => { if (element.textContent !== value) element.textContent = value; };
  root.querySelector('form').addEventListener('submit', event => event.preventDefault());

  function updateRegion(name, markup) {
    if (rendered.get(name) === markup) return;
    const region = regions[name];
    const active = document.activeElement;
    const focus = region.contains(active) ? focusSelector(active) : null;
    const open = [...region.querySelectorAll('details[data-dashboard-details]')].map(el => [el.dataset.dashboardDetails, el.open]);
    const scrolls = [...region.querySelectorAll('.dashboard-chart-scroll,.dashboard-table-scroll')]
      .map(el => [focusSelector(el), el.scrollLeft, el.scrollTop]);
    region.innerHTML = markup;
    rendered.set(name, markup);
    for (const [key, expanded] of open) {
      const details = region.querySelector(`[data-dashboard-details="${key}"]`);
      if (details) details.open = expanded;
    }
    for (const [selector, left, top] of scrolls) {
      const scroll = region.querySelector(selector);
      if (scroll) { scroll.scrollLeft = left; scroll.scrollTop = top; }
    }
    if (focus) region.querySelector(focus)?.focus({ preventScroll: true });
  }

  function clearResults() {
    // Remove every private region before rendering an unavailable or new source.
    for (const name of rendered.keys()) regions[name].replaceChildren();
    rendered.clear();
    results.hidden = true;
    model = null;
    modelKey = null;
    windowKey = null;
    visibleWeeks = [];
  }

  function inspectWeek(kind, week) {
    if (!week) return;
    inspectedWeek[kind] = week.id;
    for (const point of regions[`${kind}-plot`].querySelectorAll('[data-chart-week]')) {
      const current = point.dataset.chartWeek === week.id;
      point.classList.toggle('is-inspected', current);
      point.setAttribute('tabindex', current ? '0' : '-1');
    }
    updateRegion(`${kind}-detail`, weekDetail(week, kind));
  }

  function render() {
    if (stopped) return;
    const data = readDashboardData(snapshot);
    const source = data.source;
    const nextIdentity = JSON.stringify([source.mode, source.scope, source.blocked]);
    if (identity !== nextIdentity) {
      identity = nextIdentity;
      identityVersion++;
      retryBusy = false;
      retryError = null;
      chartAnchor = null;
      inspectedWeek.volume = inspectedWeek.rate = null;
      setText(selection, '');
      clearResults();
    }
    const description = sourceDescription(source);
    const pending = source.pending ? `${countLabel(source.pending, 'élément')} en attente de synchronisation.` : '';
    setText(sourceLabel, description.label);
    setText(syncStatus, description.status);
    setText(syncDetail, [description.detail, pending, source.available && source.message, retryError].filter(Boolean).join(' '));
    syncPanel.dataset.sourceState = source.state;
    conflictNote.hidden = !source.conflicts;
    loginLink.hidden = !source.blocked || source.loading;
    refreshButton.setAttribute('aria-disabled', String(starting || source.loading || retryBusy));
    refreshButton.setAttribute('aria-busy', String(retryBusy));
    setText(sourceMethod, source.mode === 'visitor'
      ? 'Le mode visiteur consulte l’historique local de cet appareil. Les réponses restent dans ce navigateur.'
      : 'L’historique personnel est propre au compte courant. La synchronisation permet de retrouver ses réponses sur d’autres appareils. Les conflits se résolvent dans les exercices hebdomadaires.');
    unitSelect.value = selectedUnit;
    periodSelect.value = selectedPeriod;
    drillLink.href = drillUrl(selectedUnit);
    const unit = units.find(item => item.id === selectedUnit);
    const scope = unit ? `${unit.code} · ${unit.title}` : 'Toutes les UC';

    if (!source.available) {
      if (!results.hidden) clearResults();
      setText(selection, `${scope} · ${source.loading ? 'Chargement des données' : 'Données indisponibles'}`);
      const title = source.mode === 'personal' ? 'Chargement de ton historique personnel' : 'Vérification du compte en cours';
      updateRegion('notice', source.loading
        ? notice(title, 'Les résultats seront affichés une fois leur source vérifiée.', 'loading')
        : notice('Ton historique ne peut pas être lu', data.error || 'Vérifie ta connexion ou réessaie la lecture. Les données enregistrées sont conservées.', 'error'));
      return;
    }
    if (source.mode === 'personal' && source.state !== 'synced' && Object.keys(data.series).length === 0) {
      if (!results.hidden) clearResults();
      setText(selection, `${scope} · Historique personnel à récupérer`);
      updateRegion('notice', notice('Historique personnel encore incomplet',
        'Le cache de ce compte ne contient aucun résultat disponible. Retrouve ta connexion ou actualise les données pour consulter l’historique distant.', 'partial'));
      return;
    }
    const now = new Date();
    const nextKey = JSON.stringify([data.series, data.error, data.warnings, selectedUnit, selectedPeriod, Math.floor(now.getTime() / 60000)]);
    const modelChanged = nextKey !== modelKey;
    if (modelChanged) {
      model = createDashboardModel(data, { unit: selectedUnit, period: selectedPeriod, now });
      modelKey = nextKey;
      setText(selection, `${scope} · ${rangeLabel(model.periodStart, model.periodEnd)}`);
      const warnings = model.warnings.length ? `<details class="dashboard-warning" data-dashboard-details="warnings">
        <summary>Bilan partiel · données exclues (${number(model.warnings.length)})</summary>
        <ul>${model.warnings.map(warning => `<li>${clean(warning)}</li>`).join('')}</ul>
        <p>Les données sources sont conservées.</p></details>` : '';
      const empty = model.totals.completed ? '' : notice('Aucun exercice réalisé sur cette sélection',
        'Chaque première réponse validée apparaîtra ici, même si la série est encore en cours.', 'empty',
        `<div class="dashboard-empty-actions"><a class="btn btn-surface btn-surface--accent" href="${drillUrl(selectedUnit)}">Ouvrir les exercices hebdomadaires →</a>
          ${selectedPeriod !== 'all' ? '<button type="button" class="btn btn-surface" data-dashboard-all>Consulter tout l’historique</button>' : ''}</div>`);
      updateRegion('notice', warnings + empty);
      results.hidden = false;
      updateRegion('metrics', metrics(model.totals));
      updateRegion('weekly-table', weeklyTable(model.weeks));
      updateRegion('comparison', comparison(model, selectedUnit));
      updateRegion('revisions', revisionGuide(model, selectedUnit));
    }

    const anchor = chartAnchor ? model.weeks.findIndex(week => week.id === chartAnchor) : -1;
    const end = anchor < 0 ? model.weeks.length : anchor + 1;
    const start = Math.max(0, end - PAGE_SIZE);
    const nextWindow = `${model.weeks[start].id}:${model.weeks[end - 1].id}`;
    if (!modelChanged && nextWindow === windowKey) return;
    windowKey = nextWindow;
    visibleWeeks = model.weeks.slice(start, end);
    updateRegion('pager', chartPager(visibleWeeks, start, end, model.weeks.length));
    for (const kind of Object.keys(chartTitles)) {
      const inspected = visibleWeeks.find(week => week.id === inspectedWeek[kind]) || visibleWeeks[0];
      updateRegion(`${kind}-plot`, weeklyChart(visibleWeeks, kind));
      inspectWeek(kind, inspected);
    }
  }


  function filterChanged(periodChanged = false) {
    if (periodChanged) chartAnchor = null;
    const url = new URL(location.href);
    if (selectedUnit === 'all') url.searchParams.delete('unit'); else url.searchParams.set('unit', selectedUnit);
    url.searchParams.set('period', selectedPeriod);
    history.pushState(null, '', url);
    render();
  }
  unitSelect.addEventListener('change', () => { selectedUnit = unitSelect.value; filterChanged(); });
  periodSelect.addEventListener('change', () => { selectedPeriod = periodSelect.value; filterChanged(true); });

  async function connect() {
    if (starting || service || stopped) return;
    starting = true;
    render();
    try {
      const created = await getDrillSyncService();
      if (stopped) { created.stop(); return; }
      service = created;
      unsubscribe = service.subscribe(next => { snapshot = next; render(); });
    } catch {
      snapshot = { mode: 'blocked', scope: null, view: {}, sync: { state: 'session' } };
    } finally {
      starting = false;
      render();
    }
  }

  async function retry() {
    if (refreshButton.getAttribute('aria-disabled') === 'true' || stopped) return;
    if (!service) { await connect(); return; }
    const version = identityVersion;
    retryBusy = true;
    retryError = null;
    render();
    try { await service.retry(); }
    catch { if (version === identityVersion) retryError = 'L’actualisation reste indisponible. Les données personnelles déjà enregistrées sont conservées.'; }
    finally {
      if (version === identityVersion) { retryBusy = false; render(); }
    }
  }

  function showChartDetail(event) {
    const point = event.target.closest('[data-chart-week]');
    if (!point) return;
    const kind = point.dataset.chartOutput.split('-')[0];
    const week = visibleWeeks.find(item => item.id === point.dataset.chartWeek);
    if (week && week.id !== inspectedWeek[kind]) inspectWeek(kind, week);
  }

  root.addEventListener('pointerover', showChartDetail);
  root.addEventListener('focusin', showChartDetail);
  root.addEventListener('keydown', event => {
    const point = event.target.closest('[data-chart-week]');
    if (!point || event.altKey || event.ctrlKey || event.metaKey || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const points = [...point.parentElement.querySelectorAll('[data-chart-week]')];
    const index = points.indexOf(point);
    const target = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: points.length - 1 }[event.key];
    points[target]?.focus();
  });
  root.addEventListener('click', event => {
    showChartDetail(event);
    const unitButton = event.target.closest('[data-dashboard-unit]');
    if (unitButton && selectedUnit !== unitButton.dataset.dashboardUnit) {
      selectedUnit = unitButton.dataset.dashboardUnit;
      filterChanged();
    }
    if (event.target.closest('[data-dashboard-all]')) {
      selectedPeriod = 'all';
      filterChanged(true);
      periodSelect.focus({ preventScroll: true });
    }
    if (event.target.closest('[data-dashboard-refresh]')) { void retry(); return; }
    const pageButton = event.target.closest('[data-chart-page]');
    if (pageButton) {
      const direction = pageButton.dataset.chartPage;
      const end = model.weeks.indexOf(visibleWeeks.at(-1)) + 1;
      const nextEnd = direction === 'previous' ? Math.max(1, end - PAGE_SIZE) : Math.min(model.weeks.length, end + PAGE_SIZE);
      chartAnchor = nextEnd === model.weeks.length ? null : model.weeks[nextEnd - 1].id;
      render();
      for (const scroll of root.querySelectorAll('.dashboard-chart-scroll')) scroll.scrollLeft = 0;
      (root.querySelector(`[data-chart-page="${direction}"]:not(:disabled)`) || root.querySelector('[data-chart-page]:not(:disabled)'))?.focus({ preventScroll: true });
    }
  });

  const onPopstate = () => {
    const oldPeriod = selectedPeriod;
    readQuery();
    if (selectedPeriod !== oldPeriod) chartAnchor = null;
    render();
  };
  const onStorage = event => { if (snapshot.mode === 'visitor' && (event.key === DRILL_STORAGE_KEY || event.key === null)) render(); };
  const onVisible = () => { if (!document.hidden) render(); };
  const onPageshow = event => { if (event.persisted) location.reload(); else render(); };
  const timer = window.setInterval(render, 60000);
  window.addEventListener('popstate', onPopstate);
  window.addEventListener('storage', onStorage);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('pageshow', onPageshow);
  window.addEventListener('pagehide', () => {
    stopped = true;
    unsubscribe();
    service?.stop();
    clearInterval(timer);
    window.removeEventListener('popstate', onPopstate);
    window.removeEventListener('storage', onStorage);
    document.removeEventListener('visibilitychange', onVisible);
    if (snapshot.mode !== 'visitor') root.replaceChildren();
  }, { once: true });
  render();
  await connect();
}
