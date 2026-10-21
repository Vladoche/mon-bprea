/** Pure botanical selection, answers, statistics and elapsed-time timer. */
const MODES = new Set(['discovery', 'chrono']);
const OUTCOMES = new Set(['correct', 'incorrect', 'timeout', 'skipped_image']);
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isId = value => typeof value === 'string' && value.length > 0 && value.length <= 200;
const asArray = value => Array.isArray(value) ? value : [];
const labelKey = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const hasText = value => typeof value === 'string' && value.trim().length > 0;
const hasTextList = value => Array.isArray(value) && value.length > 0 && value.every(hasText);

function isHttpsUrl(value) {
  if (!hasText(value) || value.trim() !== value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch { return false; }
}

function isPhotoPath(value) {
  if (isHttpsUrl(value)) return true;
  if (!hasText(value) || value.trim() !== value) return false;
  let path;
  try { path = decodeURIComponent(value); } catch { return false; }
  // Local photographs stay within the static site, including its Pages prefix.
  if (/[\u0000-\u001f\u007f\\:?#]/.test(path) || path.startsWith('/') ||
    path.split('/').some(part => !part || part === '.' || part === '..')) return false;
  return /\.(?:jpe?g|webp|png|avif)$/i.test(path);
}

function timestamp(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new RangeError('Date botanique invalide.');
  return date.toISOString();
}

function shuffled(values, rng) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const draw = rng();
    const j = Math.floor((Number.isFinite(draw) ? Math.min(Math.max(draw, 0), 0.9999999999999999) : 0) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function catalogue(bank) {
  const species = new Map();
  for (const plant of asArray(bank?.species)) {
    if (!isRecord(plant) || !isId(plant.id) || species.has(plant.id) ||
      !['commonName', 'scientificName', 'family', 'description'].every(key => hasText(plant[key])) ||
      !Array.isArray(plant.categoryIds) || !plant.categoryIds.length || !plant.categoryIds.every(isId) ||
      !hasTextList(plant.criteria) || !Array.isArray(plant.sources) || !plant.sources.length ||
      !plant.sources.every(source => isRecord(source) && hasText(source.title) && isHttpsUrl(source.url))) continue;
    species.set(plant.id, plant);
  }
  const photos = new Map();
  const photoIds = new Set();
  for (const photo of asArray(bank?.photos)) {
    if (!isRecord(photo) || !isId(photo.id) || photoIds.has(photo.id) || !species.has(photo.speciesId) ||
      !isPhotoPath(photo.path) || !['stage', 'organ', 'author', 'license', 'identification'].every(key => hasText(photo[key])) ||
      !isHttpsUrl(photo.sourceUrl) || !isHttpsUrl(photo.licenseUrl) || !hasTextList(photo.visibleCriteria)) continue;
    photoIds.add(photo.id);
    if (!photos.has(photo.speciesId)) photos.set(photo.speciesId, []);
    photos.get(photo.speciesId).push(photo);
  }
  return { species, photos };
}

function categoryPool(index, categoryId) {
  return [...index.species.values()].filter(plant => plant.categoryIds.includes(categoryId));
}

function distractorsFor(plant, pool) {
  const usedLabels = new Set([labelKey(plant.commonName)]);
  const usedTaxa = new Set([labelKey(plant.scientificName)]);
  return pool.filter(other => {
    const label = labelKey(other.commonName);
    const taxon = labelKey(other.scientificName);
    if (other.id === plant.id || usedLabels.has(label) || usedTaxa.has(taxon)) return false;
    usedLabels.add(label);
    usedTaxa.add(taxon);
    return true;
  });
}

/** Readable species are distinguished from genuinely playable photographed questions. */
export function getCategoryAvailability(bank, history = []) {
  const index = catalogue(bank);
  const revisionIds = new Set(getRevisionSpeciesIds(history));
  const categoryIds = new Set();
  return asArray(bank?.categories).filter(category => {
    if (!isRecord(category) || !isId(category.id) || categoryIds.has(category.id)) return false;
    categoryIds.add(category.id);
    return true;
  }).map(category => {
    const pool = categoryPool(index, category.id);
    const playable = pool.filter(plant => index.photos.has(plant.id) && distractorsFor(plant, pool).length >= 3);
    return {
      ...category, speciesCount: pool.length, playableCount: playable.length,
      revisionCount: playable.filter(plant => revisionIds.has(plant.id)).length,
      playable: playable.length > 0,
    };
  });
}

/** Historical errors remain revisable after later successes; history is never erased. */
export function getRevisionSpeciesIds(history, categoryId = null) {
  const ids = new Set();
  for (const raw of asArray(history)) {
    const answer = normalizeAnswer(raw);
    if (answer && ['incorrect', 'timeout'].includes(answer.status) &&
      (categoryId === null || answer.categoryId === categoryId)) ids.add(answer.speciesId);
  }
  return [...ids];
}

/** The catalogue determines session length; a species appears at most once. */
export function createSession(bank, {
  categoryId, mode = 'discovery', durationSeconds = 30, revision = false,
  history = [], limit = 10, rng = Math.random, now = new Date(), id,
} = {}) {
  if (!MODES.has(mode)) throw new RangeError('Mode botanique inconnu.');
  if (!Number.isFinite(durationSeconds) || durationSeconds < 1 || durationSeconds > 300) {
    throw new RangeError('La durée doit être comprise entre 1 et 300 secondes.');
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new RangeError('Une session contient de 1 à 10 questions.');
  if (typeof rng !== 'function') throw new TypeError('Générateur aléatoire invalide.');
  if (!getCategoryAvailability(bank, history).some(category => category.id === categoryId && category.playable)) {
    throw new RangeError('Cette catégorie ne dispose pas de quatre propositions distinctes et de photographies jouables.');
  }
  const index = catalogue(bank);
  const pool = categoryPool(index, categoryId);
  const revisionIds = new Set(getRevisionSpeciesIds(history));
  const playable = pool.filter(plant => index.photos.has(plant.id) && distractorsFor(plant, pool).length >= 3 &&
    (!revision || revisionIds.has(plant.id)));
  if (!playable.length) throw new RangeError('Aucune espèce à réviser dans cette catégorie.');
  const sessionId = id ?? `botanical-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  if (!isId(sessionId) || sessionId.length > 190) throw new RangeError('Identifiant de session invalide.');
  const questions = shuffled(playable, rng).slice(0, limit).map((plant, position) => {
    const candidates = shuffled(distractorsFor(plant, pool), rng);
    const confusedIds = new Set(asArray(bank?.confusions).flatMap(relation => {
      if (relation?.speciesId === plant.id) return [relation.otherSpeciesId];
      if (relation?.otherSpeciesId === plant.id) return [relation.speciesId];
      return [];
    }));
    const ordered = [...candidates.filter(other => confusedIds.has(other.id)), ...candidates.filter(other => !confusedIds.has(other.id))];
    const previous = revision ? asArray(history).map(normalizeAnswer).filter(answer => answer &&
      answer.speciesId === plant.id && ['incorrect', 'timeout'].includes(answer.status)).sort((a, b) => b.answeredAt.localeCompare(a.answeredAt))[0] : null;
    const allPhotos = index.photos.get(plant.id);
    const alternatives = previous ? allPhotos.filter(photo => photo.id !== previous.photoId) : allPhotos;
    const photo = shuffled(alternatives.length ? alternatives : allPhotos, rng)[0];
    return {
      id: `${sessionId}-q${position + 1}`, speciesId: plant.id, photoId: photo.id,
      choices: shuffled([plant.id, ...ordered.slice(0, 3).map(other => other.id)], rng),
    };
  });
  return { id: sessionId, categoryId, mode, durationSeconds, revision: Boolean(revision), startedAt: timestamp(now), questions };
}

/** One terminal outcome per question; image failures are explicitly unscored. */
export function evaluateAnswer(session, question, {
  selectedSpeciesId = null, status, elapsedMs = 0, now = new Date(),
} = {}) {
  if (!isRecord(session) || !asArray(session.questions).some(item => item.id === question?.id && item === question) ||
    !Array.isArray(question.choices) || question.choices.length !== 4 || new Set(question.choices).size !== 4 ||
    !question.choices.includes(question.speciesId)) throw new RangeError('Question botanique invalide.');
  let outcome = status;
  if (outcome === undefined) {
    if (!question.choices.includes(selectedSpeciesId)) throw new RangeError('Choisir une des quatre propositions.');
    outcome = selectedSpeciesId === question.speciesId ? 'correct' : 'incorrect';
  } else if (!['timeout', 'skipped_image'].includes(outcome)) throw new RangeError('Résultat automatique invalide.');
  if (outcome === 'timeout' && session.mode !== 'chrono') throw new RangeError('Le mode Découverte ne comporte pas de limite de temps.');
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) throw new RangeError('Durée écoulée invalide.');
  return {
    id: question.id, sessionId: session.id, questionId: question.id,
    categoryId: session.categoryId, speciesId: question.speciesId, photoId: question.photoId,
    mode: session.mode, revision: Boolean(session.revision), status: outcome,
    selectedSpeciesId: ['timeout', 'skipped_image'].includes(outcome) ? null : selectedSpeciesId,
    correct: outcome === 'correct', elapsedMs: Math.min(Math.round(elapsedMs), Number.MAX_SAFE_INTEGER), answeredAt: timestamp(now),
  };
}

/** Keep invalid persisted rows out of statistics without mutating their original JSON. */
export function normalizeAnswer(value) {
  if (!isRecord(value) || !OUTCOMES.has(value.status) || !MODES.has(value.mode) ||
    !['id', 'sessionId', 'questionId', 'categoryId', 'speciesId', 'photoId'].every(key => isId(value[key])) ||
    value.id !== value.questionId || !Number.isFinite(value.elapsedMs) || value.elapsedMs < 0 ||
    value.elapsedMs > Number.MAX_SAFE_INTEGER || typeof value.answeredAt !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value.answeredAt) ||
    !Number.isFinite(Date.parse(value.answeredAt)) ||
    new Date(value.answeredAt).toISOString().slice(0, 19) !== value.answeredAt.slice(0, 19) || typeof value.revision !== 'boolean' ||
    value.correct !== (value.status === 'correct')) return null;
  if (value.status === 'correct' && value.selectedSpeciesId !== value.speciesId) return null;
  if (value.status === 'incorrect' && (!isId(value.selectedSpeciesId) || value.selectedSpeciesId === value.speciesId)) return null;
  if (['timeout', 'skipped_image'].includes(value.status) && value.selectedSpeciesId !== null) return null;
  if (value.status === 'timeout' && value.mode !== 'chrono') return null;
  return { ...value, elapsedMs: Math.round(value.elapsedMs), answeredAt: new Date(value.answeredAt).toISOString() };
}

function emptyTotals() {
  return { attempted: 0, correct: 0, incorrect: 0, timeouts: 0, skipped: 0, recognitionRate: null };
}

function addResult(totals, answer) {
  if (answer.status === 'skipped_image') totals.skipped += 1;
  else {
    totals.attempted += 1;
    totals[answer.status === 'timeout' ? 'timeouts' : answer.status] += 1;
  }
  totals.recognitionRate = totals.attempted ? totals.correct / totals.attempted * 100 : null;
}

/** Descriptive, weighted recognition rate; no estimate of mastery. Dates are UTC. */
export function calculateStats(history) {
  const totals = emptyTotals();
  const species = new Map();
  const categories = new Map();
  const dates = new Map();
  const seen = new Set();
  for (const raw of asArray(history)) {
    const answer = normalizeAnswer(raw);
    if (!answer || seen.has(answer.id)) continue;
    seen.add(answer.id);
    addResult(totals, answer);
    for (const [groups, id] of [[species, answer.speciesId], [categories, answer.categoryId], [dates, answer.answeredAt.slice(0, 10)]]) {
      if (!groups.has(id)) groups.set(id, { id, ...emptyTotals() });
      addResult(groups.get(id), answer);
    }
  }
  return {
    ...totals, bySpecies: [...species.values()], byCategory: [...categories.values()],
    timeline: [...dates.values()].sort((a, b) => a.id.localeCompare(b.id)).map(({ id, ...day }) => ({ date: id, ...day })),
  };
}

/** No intervals: elapsed time is sampled from a monotonic, injectable clock. */
export function createQuestionTimer({ durationMs = 30000, now = () => performance.now() } = {}) {
  if (!Number.isFinite(durationMs) || durationMs <= 0 || typeof now !== 'function') throw new RangeError('Chronomètre invalide.');
  let accumulated = 0;
  let startedAt = null;
  const sample = () => {
    const value = now();
    if (!Number.isFinite(value)) throw new RangeError('Horloge invalide.');
    return value;
  };
  const elapsedMs = () => Math.min(durationMs, accumulated + (startedAt === null ? 0 : Math.max(0, sample() - startedAt)));
  const pause = () => {
    accumulated = elapsedMs();
    startedAt = null;
    return accumulated;
  };
  const resume = () => {
    if (startedAt === null && accumulated < durationMs) startedAt = sample();
    return Math.max(0, durationMs - elapsedMs());
  };
  return {
    start() { accumulated = 0; startedAt = sample(); return durationMs; },
    pause, resume, elapsedMs,
    remainingMs: () => Math.max(0, durationMs - elapsedMs()),
    isExpired: () => elapsedMs() >= durationMs,
    isPaused: () => startedAt === null,
  };
}
