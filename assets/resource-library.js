import { units, lessons } from './content.js';
import { RESOURCE_TYPES, loadResourceCatalog, filterResources } from './resources.js';

const clean = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });
const controllers = new WeakMap();
const fileChecks = new Map();
const fileStatuses = new Map();
const emptyFilters = () => ({ query: '', unit: '', theme: '', type: '', lesson: '', chapter: '', organization: '', sort: 'title-asc' });
const dateLabel = value => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
const libraryUrl = filters => {
  const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
  return `ressources.html${params.size ? `?${params}` : ''}`;
};
const paths = {
  website: '<path d="M3 8h18M3 16h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/><circle cx="12" cy="12" r="9"/>',
  pdf: '<path d="M13 2H5v20h14V8l-6-6Zm0 0v6h6M8 13h8M8 17h6"/>',
  'technical-sheet': '<path d="M8 4H5v18h14V4h-3M8 3h8v4H8V3Zm0 10h8m-8 4h5"/>',
  video: '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="m10 9 5 3-5 3V9Z"/>',
  tool: '<path d="m14 5 5 5M4 20l5-1L21 7l-4-4L5 15l-1 5ZM9 7 7 9M3 5l2-2 4 4-2 2-4-4Z"/>',
};
const icon = type => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[type] || paths.website}</svg>`;
const externalAttributes = 'target="_blank" rel="noopener noreferrer"';

async function inspectLocalPdf(resource) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);
  const url = new URL(resource.href, document.baseURI);
  try {
    const response = await fetch(url, { method: 'HEAD', cache: 'no-cache', signal: controller.signal });
    if (response.status === 404 || response.status === 410) return { status: 'missing', message: 'Ce PDF est introuvable à l’adresse enregistrée.' };
    if (!response.ok && ![405, 501].includes(response.status)) return { status: 'unverified', message: 'Le document ne peut pas être vérifié pour le moment.' };
    const mime = (response.headers.get('content-type') || '').toLowerCase();
    if (response.ok && mime.includes('application/pdf')) return { status: 'available' };
    if (response.ok && mime.includes('text/html')) return { status: 'missing', message: 'Cette adresse renvoie une page web au lieu du PDF attendu.' };
    // A static host may not implement HEAD or may return an ambiguous MIME type.
    // Read only the beginning of its response, even when it ignores Range.
    const sample = await fetch(url, { headers: { Range: 'bytes=0-1023' }, cache: 'no-cache', signal: controller.signal });
    if (sample.status === 404 || sample.status === 410) return { status: 'missing', message: 'Ce PDF est introuvable à l’adresse enregistrée.' };
    if (!sample.ok || !sample.body) return { status: 'unverified', message: 'Le document ne peut pas être vérifié pour le moment.' };
    const reader = sample.body.getReader();
    let prefix = '';
    try {
      while (prefix.length < 1024 && !prefix.includes('%PDF-')) {
        const { done, value } = await reader.read();
        if (done) break;
        prefix += new TextDecoder().decode(value.subarray(0, 1024 - prefix.length));
      }
    } finally { await reader.cancel().catch(() => {}); }
    return prefix.includes('%PDF-') ? { status: 'available' } : { status: 'missing', message: 'Le fichier reçu ne correspond pas à un document PDF.' };
  } catch {
    return { status: 'unverified', message: 'Vérification impossible. Vérifie ta connexion ou réessaie plus tard.' };
  } finally { window.clearTimeout(timeout); }
}

function checkFile(resource, reload = false) {
  if (!fileChecks.has(resource.href) || reload) {
    fileStatuses.delete(resource.href);
    const check = inspectLocalPdf(resource).then(status => {
      if (fileChecks.get(resource.href) === check) fileStatuses.set(resource.href, status);
      return status;
    });
    fileChecks.set(resource.href, check);
  }
  return fileChecks.get(resource.href);
}

function resourceActions(resource) {
  if (!resource.href) return `<p class="library-file-state">${clean(resource.issue || 'Le lien de cette ressource n’est pas disponible.')}</p>`;
  if (!resource.isLocal) {
    const label = { website: 'Ouvrir le site', pdf: 'Consulter le PDF', 'technical-sheet': 'Consulter la fiche', video: 'Voir la vidéo', tool: 'Ouvrir l’outil' }[resource.type];
    return `<a class="library-open" href="${clean(resource.href)}" ${externalAttributes}>${label || 'Consulter la ressource'} <span aria-hidden="true">↗</span><span class="sr-only"> (nouvel onglet)</span></a>`;
  }
  const state = fileStatuses.get(resource.href) || { status: 'checking' };
  if (state.status === 'checking') return '<p class="library-file-state" role="status">Vérification du document…</p>';
  const retry = `<button class="library-retry" type="button" data-library-check="${clean(resource.id)}">Réessayer la vérification<span class="sr-only"> de ${clean(resource.title)}</span></button>`;
  if (state.status === 'missing') return `<p class="library-file-state library-file-warning" role="status">${clean(state.message)}</p>${retry}`;
  const filename = decodeURIComponent(resource.href.split('/').at(-1));
  return `${state.status === 'unverified' ? `<p class="library-file-state library-file-warning" role="status">${clean(state.message)}</p>` : ''}<div class="library-action-links"><a class="library-open" href="${clean(resource.href)}" ${externalAttributes}>${state.status === 'unverified' ? 'Essayer de consulter le PDF' : 'Consulter le PDF'} <span aria-hidden="true">↗</span><span class="sr-only"> (nouvel onglet)</span></a><a class="library-open library-download" href="${clean(resource.href)}" download="${clean(filename)}">Télécharger <span aria-hidden="true">↓</span><span class="sr-only"> le PDF ${clean(resource.title)}</span></a></div>${state.status === 'unverified' ? retry : ''}`;
}

function hydrateFiles(root, resources, reload = false) {
  for (const resource of resources.filter(item => item.isLocal && item.href)) {
    checkFile(resource, reload).then(() => {
      if (!root.isConnected) return;
      root.querySelectorAll('[data-library-target]').forEach(target => {
        if (target.dataset.libraryTarget === resource.id) target.innerHTML = resourceActions(resource);
      });
    });
  }
}

function metadata(resource, catalog) {
  const chapterNames = resource.chapters.map(id => catalog.chapters.find(chapter => chapter.id === id)?.title).filter(Boolean);
  const source = resource.source ? `<div><dt>Source</dt><dd>${resource.source.url ? `<a href="${clean(resource.source.url)}" ${externalAttributes}>${clean(resource.source.title)}<span class="sr-only"> (nouvel onglet)</span> ↗</a>` : clean(resource.source.title)}</dd></div>` : '';
  return `<details class="library-record"><summary>Informations documentaires</summary><dl>${chapterNames.length ? `<div><dt>Chapitre${chapterNames.length > 1 ? 's' : ''}</dt><dd>${chapterNames.map(clean).join(' · ')}</dd></div>` : ''}${resource.keywords.length ? `<div><dt>Mots-clés</dt><dd>${resource.keywords.map(clean).join(', ')}</dd></div>` : ''}${resource.publishedAt ? `<div><dt>Publication</dt><dd><time datetime="${resource.publishedAt}">${dateLabel(resource.publishedAt)}</time></dd></div>` : ''}${resource.addedAt ? `<div><dt>Ajout à la bibliothèque</dt><dd><time datetime="${resource.addedAt}">${dateLabel(resource.addedAt)}</time></dd></div>` : ''}${source}${resource.license ? `<div><dt>Réutilisation</dt><dd>${clean(resource.license)}</dd></div>` : '<div><dt>Réutilisation</dt><dd>Conditions non renseignées. Consulter la source avant toute réutilisation.</dd></div>'}</dl></details>`;
}

function resourceCard(resource, catalog, { compact = false } = {}) {
  const relatedLessons = resource.lessons.map(id => lessons.find(lesson => lesson.id === id)).filter(Boolean);
  return `<article class="library-card ${compact ? 'library-card-compact' : ''}" id="library-resource-${clean(resource.id)}"><div class="library-card-heading"><span class="library-type-icon library-type-${clean(resource.type)}">${icon(resource.type)}</span><div><span class="library-type-label">${clean(RESOURCE_TYPES[resource.type])}</span>${!compact ? `<span class="library-organization">${clean(resource.organization || 'Organisme non renseigné')}</span>` : ''}</div></div><h3>${clean(resource.title)}</h3><p class="library-description">${clean(resource.description)}</p>${!compact ? `<div class="library-themes">${resource.themes.map(theme => `<a href="${clean(libraryUrl({ theme }))}">${clean(theme)}</a>`).join('')}</div><div class="library-units">${resource.units.length ? resource.units.map(id => { const unit = units.find(item => item.id === id); return `<a href="uc.html?id=${encodeURIComponent(id)}">${clean(unit.code)}</a>`; }).join('') : '<span>Ressource transversale · sans UC associée</span>'}</div>` : ''}<div class="library-actions" data-library-target="${clean(resource.id)}">${resourceActions(resource)}</div>${!compact && relatedLessons.length ? `<div class="library-related"><span>Cours associé${relatedLessons.length > 1 ? 's' : ''}</span><ul>${relatedLessons.map(lesson => `<li><a href="cours.html?id=${encodeURIComponent(lesson.id)}">${clean(lesson.title)} <span aria-hidden="true">→</span></a></li>`).join('')}</ul></div>` : ''}${!compact ? metadata(resource, catalog) : ''}</article>`;
}

function bindFileRetry(root, resources, signal) {
  root.addEventListener('click', event => {
    const button = event.target.closest('[data-library-check]');
    if (!button) return;
    const resource = resources.find(item => item.id === button.dataset.libraryCheck);
    if (!resource?.isLocal || !resource.href) return;
    const target = button.closest('[data-library-target]');
    target.innerHTML = '<p class="library-file-state" role="status">Nouvelle vérification du document…</p>';
    checkFile(resource, true).then(() => {
      if (!target.isConnected) return;
      target.innerHTML = resourceActions(resource);
      const nextFocus = target.querySelector('a,button');
      nextFocus?.focus({ preventScroll: true });
    });
  }, { signal });
}

function controllerFor(root) {
  controllers.get(root)?.abort();
  const controller = new AbortController();
  controllers.set(root, controller);
  return controller;
}

const options = (items, label) => `<option value="">${clean(label)}</option>${items.map(item => `<option value="${clean(item.value)}">${clean(item.label)}</option>`).join('')}`;
const distinct = values => [...new Set(values)].sort(collator.compare).map(value => ({ value, label: value }));

export async function initResources(root, { reload = false } = {}) {
  const { signal } = controllerFor(root);
  root.innerHTML = '<section class="page-top wrap"><h1>Ressources documentaires</h1><p role="status">Chargement de la bibliothèque…</p></section>';
  const catalog = await loadResourceCatalog({ reload });
  if (signal.aborted) return;
  if (catalog.error) {
    root.innerHTML = `<section class="page-top wrap"><h1>Ressources documentaires</h1><div class="library-notice" role="alert"><h2>La bibliothèque ne peut pas être chargée</h2><p>${clean(catalog.error)}</p><button class="btn btn-outline" type="button">Réessayer le chargement</button></div></section>`;
    root.querySelector('button').addEventListener('click', () => initResources(root, { reload: true }), { signal });
    return;
  }
  const themes = distinct(catalog.resources.flatMap(resource => resource.themes));
  const organizations = distinct(catalog.resources.map(resource => resource.organization).filter(Boolean));
  const controls = [
    ['unit', 'Unité capitalisable', options(units.map(unit => ({ value: unit.id, label: `${unit.code} · ${unit.title}` })), 'Toutes les UC')],
    ['theme', 'Thématique', options(themes, 'Toutes les thématiques')],
    ['type', 'Type de ressource', options(Object.entries(RESOURCE_TYPES).map(([value, label]) => ({ value, label })), 'Tous les types')],
    ['lesson', 'Cours associé', options(lessons.map(lesson => ({ value: lesson.id, label: lesson.title })), 'Tous les cours')],
    ['chapter', 'Chapitre', options(catalog.chapters.map(chapter => ({ value: chapter.id, label: `${units.find(unit => unit.id === chapter.unit)?.code || ''} · ${chapter.title}` })), 'Tous les chapitres')],
    ['organization', 'Organisme ou auteur', options(organizations, 'Tous les organismes')],
  ];
  const selectMarkup = ([key, label, choices]) => `<label for="resource-${key}">${label}<select id="resource-${key}" data-resource-filter="${key}">${choices}</select></label>`;
  root.innerHTML = `<section class="page-top wrap library-intro"><div class="crumbs"><a href="index.html">Accueil</a><span>/</span><span>Ressources documentaires</span></div><div class="page-eyebrow">DES SOURCES POUR COMPRENDRE ET PRATIQUER</div><h1>Ressources documentaires</h1><p>Des références à explorer, des documents à garder sous la main et des liens directs avec tes cours de BPREA.</p></section><section class="wrap library-layout" aria-label="Bibliothèque pédagogique"><form class="library-filters" aria-label="Rechercher et filtrer les ressources"><div class="library-search-row"><label class="library-search" for="resource-search"><span class="sr-only">Rechercher par titre, description, mot-clé ou organisme</span>${icon('website')}<input type="search" id="resource-search" placeholder="Titre, mot-clé, organisme…" autocomplete="off" /></label><button type="reset" class="btn btn-outline library-reset">Réinitialiser les filtres</button></div><div class="library-filter-grid">${controls.slice(0, 3).map(selectMarkup).join('')}</div><details class="library-more-filters"><summary>Préciser par cours, chapitre ou organisme</summary><div class="library-filter-grid">${controls.slice(3).map(selectMarkup).join('')}</div></details><p class="library-search-help">La recherche porte sur les fiches descriptives, sans explorer le contenu des PDF.</p></form><p class="library-query-notice" id="resource-query-notice" role="status" hidden></p><div class="library-results-bar"><p id="resource-count" role="status" aria-live="polite" aria-atomic="true"></p><label for="resource-sort">Trier par<select id="resource-sort"><option value="title-asc">Titre · A à Z</option><option value="title-desc">Titre · Z à A</option><option value="added-desc">Date d’ajout · plus récents</option></select></label></div><p id="resource-context" class="library-context" hidden></p><p id="resource-date-notice" class="library-search-help" hidden>Les fiches sans date d’ajout connue sont placées à la fin, par ordre alphabétique.</p>${catalog.warnings.length ? `<details class="library-notice library-catalog-warnings"><summary>Certaines fiches nécessitent une mise à jour (${catalog.warnings.length})</summary><ul>${catalog.warnings.map(warning => `<li>${clean(warning)}</li>`).join('')}</ul></details>` : ''}<h2 class="sr-only">Documents et liens disponibles</h2><div class="library-grid" id="resource-grid"></div><div class="library-empty" id="resource-empty" hidden><span class="eyebrow">ÉLARGIR TA RECHERCHE</span><h2>Aucune ressource ne correspond</h2><p>Essaie un autre mot-clé ou retire un filtre pour élargir la sélection.</p><button class="btn btn-outline" type="button" data-resource-reset>Réinitialiser les filtres</button></div><aside class="library-note"><h2>De la documentation au cours</h2><p>Les UC, chapitres et cours sont associés explicitement aux ressources. Ouvre un cours depuis sa fiche, ou retrouve sa sélection documentaire dans la section « Pour approfondir ».</p><p>Les liens externes s’ouvrent dans un nouvel onglet. Les dates et les conditions de réutilisation sont indiquées lorsqu’elles sont connues.</p></aside></section>`;
  const grid = root.querySelector('#resource-grid');
  const form = root.querySelector('form');
  let filters = emptyFilters();

  function readQuery() {
    const params = new URLSearchParams(location.search);
    filters = emptyFilters();
    filters.query = (params.get('q') || '').slice(0, 300);
    let discarded = false;
    for (const key of ['unit', 'theme', 'type', 'lesson', 'chapter', 'organization', 'sort']) {
      const value = params.get(key);
      if (!value) continue;
      const select = root.querySelector(`#resource-${key}`);
      if ([...select.options].some(option => option.value === value)) filters[key] = value;
      else discarded = true;
    }
    const notice = root.querySelector('#resource-query-notice');
    notice.hidden = !discarded;
    notice.textContent = discarded ? 'Certains filtres ne sont plus disponibles et ont été retirés. Les autres critères restent appliqués.' : '';
  }

  function writeQuery(replace = false) {
    const url = new URL(location.href);
    for (const [key, value] of Object.entries(filters)) {
      const param = key === 'query' ? 'q' : key;
      if (value && !(key === 'sort' && value === 'title-asc')) url.searchParams.set(param, value);
      else url.searchParams.delete(param);
    }
    url.hash = '';
    history[replace ? 'replaceState' : 'pushState'](null, '', url);
    root.querySelector('#resource-query-notice').hidden = true;
  }

  function refresh() {
    const results = filterResources(catalog.resources, filters);
    root.querySelector('#resource-search').value = filters.query;
    for (const key of ['unit', 'theme', 'type', 'lesson', 'chapter', 'organization', 'sort']) root.querySelector(`#resource-${key}`).value = filters[key];
    if (filters.lesson || filters.chapter || filters.organization) root.querySelector('.library-more-filters').open = true;
    grid.innerHTML = results.map(resource => resourceCard(resource, catalog)).join('');
    root.querySelector('#resource-count').textContent = `${results.length} ressource${results.length > 1 ? 's' : ''} sur ${catalog.resources.length}`;
    const empty = root.querySelector('#resource-empty');
    empty.hidden = results.length !== 0;
    if (!catalog.resources.length) {
      empty.querySelector('.eyebrow').textContent = 'LA BIBLIOTHÈQUE SE CONSTRUIT';
      empty.querySelector('h2').textContent = 'Aucune ressource disponible pour le moment';
      empty.querySelector('p').textContent = 'Les documents et liens apparaîtront ici lorsqu’ils auront été ajoutés à la bibliothèque.';
      empty.querySelector('button').hidden = true;
    }
    root.querySelector('#resource-date-notice').hidden = filters.sort !== 'added-desc' || !results.some(resource => !resource.addedAt);
    const context = root.querySelector('#resource-context');
    const selectedLesson = lessons.find(lesson => lesson.id === filters.lesson);
    context.hidden = !selectedLesson;
    context.innerHTML = selectedLesson ? `Sélection liée au cours <a href="cours.html?id=${encodeURIComponent(selectedLesson.id)}">${clean(selectedLesson.title)} →</a>` : '';
    hydrateFiles(root, results, reload);
    reload = false;
  }

  function reset() {
    filters = emptyFilters();
    writeQuery();
    refresh();
    root.querySelector('#resource-search').focus({ preventScroll: true });
  }
  form.addEventListener('submit', event => event.preventDefault(), { signal });
  form.addEventListener('reset', event => { event.preventDefault(); reset(); }, { signal });
  root.querySelector('[data-resource-reset]').addEventListener('click', reset, { signal });
  root.querySelector('#resource-search').addEventListener('input', event => { filters.query = event.target.value; writeQuery(true); refresh(); }, { signal });
  root.querySelectorAll('[data-resource-filter],#resource-sort').forEach(select => select.addEventListener('change', () => {
    const key = select.dataset.resourceFilter || 'sort';
    filters[key] = select.value;
    writeQuery();
    refresh();
  }, { signal }));
  bindFileRetry(root, catalog.resources, signal);
  window.addEventListener('popstate', () => { readQuery(); refresh(); }, { signal });
  readQuery();
  refresh();
}

async function initAssociatedResources(root, entity, scope, reload = false) {
  if (!root) return;
  const { signal } = controllerFor(root);
  root.className = 'library-associated';
  root.setAttribute('aria-label', scope === 'lesson' ? 'Ressources associées au cours' : 'Ressources associées à l’UC');
  root.innerHTML = '<p class="library-loading" role="status">Chargement des ressources associées…</p>';
  const catalog = await loadResourceCatalog({ reload });
  if (signal.aborted) return;
  const heading = scope === 'lesson' ? 'Pour approfondir' : 'Ressources de cette UC';
  const unitId = scope === 'lesson' ? entity.unit : entity.id;
  const unit = units.find(item => item.id === unitId);
  if (catalog.error) {
    root.innerHTML = `<h2>${heading}</h2><div class="library-notice"><p>Les ressources associées ne peuvent pas être chargées pour le moment.</p><button type="button" class="library-retry">Réessayer le chargement</button></div><a class="text-link" href="${libraryUrl({ unit: unitId })}">Ouvrir la bibliothèque de ${clean(unit?.code || 'cette UC')} →</a>`;
    root.querySelector('button').addEventListener('click', () => initAssociatedResources(root, entity, scope, true), { signal });
    return;
  }
  // Only an explicitly recorded lesson relation links a resource to this course.
  const related = filterResources(catalog.resources, scope === 'lesson' ? { lesson: entity.id } : { unit: entity.id });
  const visible = scope === 'unit' ? related.slice(0, 3) : related;
  root.innerHTML = `<span class="eyebrow">DES REPÈRES POUR ALLER PLUS LOIN</span><h2>${heading}</h2>${visible.length ? `<p class="library-associated-intro">${scope === 'lesson' ? 'Une sélection directement associée à ce cours.' : `${related.length} ressource${related.length > 1 ? 's' : ''} associée${related.length > 1 ? 's' : ''} à cette UC${related.length > visible.length ? ' · aperçu de trois fiches' : ''}.`}</p><div class="library-compact-grid">${visible.map(resource => resourceCard(resource, catalog, { compact: true })).join('')}</div>` : '<p class="library-associated-empty">Aucune ressource n’est directement associée à ce cours pour le moment.</p>'}<div class="library-associated-links">${scope === 'lesson' && related.length ? `<a class="text-link" href="${libraryUrl({ lesson: entity.id })}">Voir les fiches de ce cours dans la bibliothèque →</a>` : ''}<a class="text-link" href="${libraryUrl({ unit: unitId })}">Toutes les ressources de ${clean(unit?.code || 'cette UC')} →</a></div>`;
  if (!visible.length && scope === 'unit') root.querySelector('.library-associated-empty').textContent = 'Aucune ressource n’est associée à cette UC pour le moment.';
  bindFileRetry(root, visible, signal);
  hydrateFiles(root, visible, reload);
}

export const initCourseResources = (root, lesson) => initAssociatedResources(root, lesson, 'lesson');
export const initUnitResources = (root, unit) => initAssociatedResources(root, unit, 'unit');
