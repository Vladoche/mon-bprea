import { units, lessons } from './content.js';

/** Editorial data lives only in resources.json; this module reads and queries it. */
export const RESOURCE_TYPES = Object.freeze({
  website: 'Site web',
  pdf: 'Document PDF',
  'technical-sheet': 'Fiche technique',
  video: 'Vidéo',
  tool: 'Outil externe',
});

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isId = value => typeof value === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(value);
const text = value => typeof value === 'string' ? value.trim() : '';
const unitIds = new Set(units.map(unit => unit.id));
const lessonsById = new Map(lessons.map(lesson => [lesson.id, lesson]));
const titleOrder = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });
let catalogPromise;

function externalHref(value) {
  const address = text(value);
  if (!/^https?:\/\//i.test(address) || /[\\\u0000-\u001f\u007f]/.test(address)) return null;
  try {
    const url = new URL(address);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

function localPdfHref(value) {
  if (typeof value !== 'string') return null;
  let path;
  try { path = decodeURIComponent(value.trim()); } catch { return null; }
  // Inspect decoded paths too: encoded traversal and separators must not bypass
  // the checks. Reject remaining percent escapes to prevent double encoding.
  if (!path.startsWith('documents/') || /[\\%?#:\u0000-\u001f\u007f]/.test(path) || !/\.pdf$/i.test(path)) return null;
  const segments = path.split('/');
  if (segments.some(segment => !segment || /^\.+$/.test(segment) || segment.trim() !== segment)) return null;
  // Preserve the relative base path, safely supporting file names with spaces.
  try {
    return segments.map(segment => encodeURIComponent(segment).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)).join('/');
  } catch {
    return null;
  }
}

function strings(value, label, warnings) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    warnings.push(`${label} : une liste est attendue ; les valeurs illisibles ont été ignorées.`);
    return [];
  }
  const result = [];
  for (const item of value) {
    const clean = text(item);
    if (!clean) { warnings.push(`${label} : une valeur vide ou illisible a été ignorée.`); continue; }
    if (!result.includes(clean)) result.push(clean);
  }
  return result;
}

function relations(value, known, label, warnings) {
  return strings(value, label, warnings).filter(id => {
    if (known.has(id)) return true;
    warnings.push(`${label} : la référence « ${id} » est inconnue et a été ignorée.`);
    return false;
  });
}

function optionalDate(value, label, warnings) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(0);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCFullYear(year, month - 1, day);
    if (year >= 1 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) return value;
  }
  warnings.push(`${label} : la date invalide a été ignorée (format attendu : AAAA-MM-JJ).`);
  return null;
}

function normalizeSource(value, resourceId, warnings) {
  if (value === undefined || value === null) return null;
  if (!isRecord(value) || !text(value.title)) {
    warnings.push(`Ressource ${resourceId} : la source illisible a été ignorée.`);
    return null;
  }
  const url = value.url === undefined || value.url === null || value.url === '' ? null : externalHref(value.url);
  if (value.url && !url) warnings.push(`Ressource ${resourceId} : l’adresse de la source est invalide ; son intitulé est conservé.`);
  return { title: text(value.title), url };
}

/**
 * Normalize the versioned document without changing its input. Unknown stable
 * relations are removed independently: deleting a course never hides a resource.
 * A missing or unsafe destination preserves the card with href=null and issue.
 */
export function normalizeResourceCatalog(document) {
  const warnings = [];
  if (!isRecord(document) || document.version !== 1 || !Array.isArray(document.resources)) {
    return { resources: [], chapters: [], warnings, error: 'Le format du catalogue documentaire n’est pas reconnu. Les ressources ne peuvent pas être affichées.' };
  }
  const chapters = [];
  const chapterIds = new Set();
  if (document.chapters !== undefined && !Array.isArray(document.chapters)) {
    warnings.push('La liste des chapitres est illisible. Les ressources restent disponibles sans ces associations.');
  }
  for (const chapter of Array.isArray(document.chapters) ? document.chapters : []) {
    if (!isRecord(chapter) || !isId(chapter.id) || !unitIds.has(chapter.unit) || !text(chapter.title)) {
      warnings.push('Un chapitre incomplet ou associé à une UC inconnue a été ignoré.');
      continue;
    }
    if (chapterIds.has(chapter.id)) { warnings.push(`Le chapitre « ${chapter.id} » est présent plusieurs fois ; son doublon a été ignoré.`); continue; }
    chapterIds.add(chapter.id);
    const chapterLessons = relations(chapter.lessons, lessonsById, `Chapitre ${chapter.id}, cours`, warnings).filter(id => {
      if (lessonsById.get(id).unit === chapter.unit) return true;
      warnings.push(`Chapitre ${chapter.id} : le cours « ${id} » appartient à une autre UC et a été ignoré.`);
      return false;
    });
    chapters.push({ id: chapter.id, unit: chapter.unit, title: text(chapter.title), lessons: chapterLessons });
  }

  const resources = [];
  const resourceIds = new Set();
  for (const resource of document.resources) {
    if (!isRecord(resource) || !isId(resource.id) || !text(resource.title)) {
      warnings.push('Une ressource sans identifiant stable ou sans titre a été ignorée.');
      continue;
    }
    if (resourceIds.has(resource.id)) { warnings.push(`La ressource « ${resource.id} » est présente plusieurs fois ; son doublon a été ignoré.`); continue; }
    resourceIds.add(resource.id);
    const label = `Ressource ${resource.id}`;
    const hasFile = resource.file !== undefined && resource.file !== null && resource.file !== '';
    const hasUrl = resource.url !== undefined && resource.url !== null && resource.url !== '';
    const isLocal = hasFile || (!hasUrl && resource.type === 'pdf');
    let issue = null;
    let href = null;
    if (hasFile && hasUrl) {
      issue = 'Cette ressource doit définir une seule destination : un fichier local ou une adresse externe.';
    } else if (hasFile) {
      href = localPdfHref(resource.file);
      if (!href) issue = 'Le chemin du PDF est invalide. Un fichier .pdf relatif au dossier documents/ est attendu.';
    } else if (hasUrl) {
      href = externalHref(resource.url);
      if (!href) issue = 'L’adresse de cette ressource est invalide. Une URL HTTP ou HTTPS sans identifiants est attendue.';
    } else {
      issue = 'Aucune adresse ni aucun fichier n’est renseigné pour cette ressource.';
    }
    if (issue) warnings.push(`${label} : ${issue}`);
    const type = typeof resource.type === 'string' && Object.hasOwn(RESOURCE_TYPES, resource.type) ? resource.type : isLocal ? 'pdf' : 'website';
    if (type !== resource.type) warnings.push(`${label} : le type de ressource inconnu a été remplacé par « ${RESOURCE_TYPES[type]} ».`);
    resources.push({
      id: resource.id,
      title: text(resource.title),
      description: text(resource.description),
      type,
      organization: text(resource.organization),
      units: relations(resource.units, unitIds, `${label}, UC`, warnings),
      chapters: relations(resource.chapters, chapterIds, `${label}, chapitres`, warnings),
      lessons: relations(resource.lessons, lessonsById, `${label}, cours`, warnings),
      themes: strings(resource.themes, `${label}, thématiques`, warnings),
      keywords: strings(resource.keywords, `${label}, mots-clés`, warnings),
      publishedAt: optionalDate(resource.publishedAt, `${label}, publication`, warnings),
      addedAt: optionalDate(resource.addedAt, `${label}, ajout`, warnings),
      source: normalizeSource(resource.source, resource.id, warnings),
      license: text(resource.license) || null,
      href,
      isLocal,
      issue,
    });
  }
  return { resources, chapters, warnings: [...new Set(warnings)], error: null };
}

async function fetchCatalog() {
  try {
    const response = await fetch(new URL('./resources.json', import.meta.url), { cache: 'no-cache' });
    if (!response.ok) throw new Error('catalog-unavailable');
    return normalizeResourceCatalog(await response.json());
  } catch {
    return { resources: [], chapters: [], warnings: [], error: 'Le catalogue documentaire est indisponible. Réessaie après avoir vérifié ta connexion.' };
  }
}

/** One shared read per page; reload=true explicitly requests a fresh document. */
export async function loadResourceCatalog({ reload = false } = {}) {
  if (reload || !catalogPromise) catalogPromise = fetchCatalog();
  return catalogPromise;
}

function searchable(value) {
  return text(value).normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('fr').replace(/œ/g, 'oe').replace(/æ/g, 'ae');
}

function compareTitles(left, right) {
  return titleOrder.compare(left.title, right.title) || titleOrder.compare(left.id, right.id);
}

/** Search only editorial metadata, never PDF contents. Filters combine with AND. */
export function filterResources(resources, { query = '', unit = '', theme = '', type = '', lesson = '', chapter = '', organization = '', sort = 'title-asc' } = {}) {
  const tokens = searchable(query).match(/[\p{L}\p{N}]+/gu) ?? [];
  const selectedTheme = searchable(theme);
  const selectedOrganization = searchable(organization);
  const result = (Array.isArray(resources) ? resources : []).filter(resource => {
    if (unit && !resource.units.includes(unit)) return false;
    if (lesson && !resource.lessons.includes(lesson)) return false;
    if (chapter && !resource.chapters.includes(chapter)) return false;
    if (type && resource.type !== type) return false;
    if (selectedTheme && !resource.themes.some(value => searchable(value) === selectedTheme)) return false;
    if (selectedOrganization && searchable(resource.organization) !== selectedOrganization) return false;
    const haystack = searchable([resource.title, resource.description, resource.organization, ...resource.keywords, ...resource.themes].join(' '));
    return tokens.every(token => haystack.includes(token));
  });
  result.sort((left, right) => {
    if (sort === 'added-desc') {
      if (left.addedAt && !right.addedAt) return -1;
      if (!left.addedAt && right.addedAt) return 1;
      const dates = (right.addedAt ?? '').localeCompare(left.addedAt ?? '');
      if (dates) return dates;
    }
    return sort === 'title-desc' ? -compareTitles(left, right) : compareTitles(left, right);
  });
  return result;
}
