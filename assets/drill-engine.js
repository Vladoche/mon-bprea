/**
 * Moteur pur du Drill : semaines Europe/Paris, sélection et statistiques.
 * Aucune lecture de DOM, de stockage local ou de fichier dans ce module.
 */
const DAY_MS = 86400000;
const WEEK_MS = 7 * DAY_MS;
const EPOCH_MONDAY = Date.UTC(1970, 0, 5);
const SERIES_SIZE = 10;
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

const parisDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
});
const parisClock = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

function civilDate(year, month, day) {
  // Date.UTC traite spécialement les années 0 à 99 ; setUTCFullYear les préserve.
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date;
}

function dateKey(date) {
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function weekFromCivil(date) {
  const monday = new Date(date.getTime());
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  const thursday = new Date(monday.getTime() + 3 * DAY_MS);
  const year = thursday.getUTCFullYear();
  const january4 = civilDate(year, 1, 4);
  const firstMonday = january4.getTime() - (january4.getUTCDay() + 6) % 7 * DAY_MS;
  const week = Math.round((monday.getTime() - firstMonday) / WEEK_MS) + 1;
  return {
    id: `${String(year).padStart(4, '0')}-W${String(week).padStart(2, '0')}`,
    year, week,
    start: dateKey(monday),
    end: dateKey(new Date(monday.getTime() + 6 * DAY_MS)),
    ordinal: Math.round((monday.getTime() - EPOCH_MONDAY) / WEEK_MS),
  };
}

/**
 * Semaine ISO du jour civil à Paris, indépendamment du fuseau de l'appareil.
 * Le lundi à 00 h Paris marque la nouvelle semaine, heure d'été comprise.
 * Les calculs de journées civiles en UTC évitent les semaines de 167/169 h.
 */
export function getParisWeek(now = new Date()) {
  const instant = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(instant.getTime())) throw new RangeError('La date du Drill est invalide.');
  const parts = Object.fromEntries(parisDate.formatToParts(instant).map(part => [part.type, part.value]));
  return weekFromCivil(civilDate(Number(parts.year), Number(parts.month), Number(parts.day)));
}

/** Accepte seulement les semaines ISO existantes, par exemple 2020-W53. */
export function parseWeek(id) {
  if (typeof id !== 'string' || !/^\d{4}-W\d{2}$/.test(id)) return null;
  const year = Number(id.slice(0, 4));
  const week = Number(id.slice(6));
  if (year < 1 || week < 1 || week > 53) return null;
  const january4 = civilDate(year, 1, 4);
  const firstMonday = january4.getTime() - (january4.getUTCDay() + 6) % 7 * DAY_MS;
  const result = weekFromCivil(new Date(firstMonday + (week - 1) * WEEK_MS));
  return result.id === id ? result : null;
}

/** Décale une semaine ISO ; renvoie null si l'entrée est invalide. */
export function shiftWeek(id, delta) {
  const current = parseWeek(id);
  if (!current || !Number.isSafeInteger(delta)) return null;
  const date = new Date(EPOCH_MONDAY + (current.ordinal + delta) * WEEK_MS);
  if (!Number.isFinite(date.getTime())) return null;
  const result = weekFromCivil(date);
  return result.year >= 1 && result.year <= 9999 ? result : null;
}

/** Instant du prochain lundi à 00 h Paris, pour programmer le renouvellement. */
export function nextParisWeekAt(now = new Date()) {
  const next = shiftWeek(getParisWeek(now).id, 1);
  if (!next) throw new RangeError('La prochaine semaine du Drill est hors limites.');
  const [year, month, day] = next.start.split('-').map(Number);
  const target = civilDate(year, month, day).getTime();
  let candidate = target;
  // Détermine le décalage à la date visée, pas celui d'aujourd'hui : le dimanche
  // de changement d'heure peut séparer maintenant du prochain lundi.
  for (let step = 0; step < 3; step += 1) {
    const parts = Object.fromEntries(parisClock.formatToParts(new Date(candidate)).map(part => [part.type, part.value]));
    const wallClock = civilDate(Number(parts.year), Number(parts.month), Number(parts.day));
    wallClock.setUTCHours(Number(parts.hour), Number(parts.minute), Number(parts.second), 0);
    const adjusted = target - (wallClock.getTime() - candidate);
    if (adjusted === candidate) break;
    candidate = adjusted;
  }
  return new Date(candidate);
}

function hash(value) {
  let seed = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    seed ^= value.charCodeAt(index);
    seed = Math.imul(seed, 16777619);
  }
  return seed >>> 0;
}

function shuffled(items, seedText) {
  const result = [...items];
  let seed = hash(seedText);
  const random = () => {
    seed = (seed + 0x6D2B79F5) >>> 0;
    let value = seed;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function uniqueQuestions(questions) {
  if (!Array.isArray(questions)) return [];
  const seen = new Set();
  return questions.filter(question => {
    if (!isRecord(question) || typeof question.id !== 'string' || !question.id.trim() || seen.has(question.id)) return false;
    seen.add(question.id);
    return true;
  });
}

/**
 * Dix identifiants différents ou aucun si la banque est insuffisante.
 * L'ordre du JSON et une correction de version ne changent pas la sélection.
 * Un même paquet stable avance de dix places par semaine. Le chevauchement de
 * deux semaines voisines est ainsi minimal : max(0, 20 - taille de banque).
 * Avec 12 questions seulement, 8 réapparitions sont donc inévitables.
 * L'appelant enregistre des snapshots dès le début d'une série : l'ajout ou le
 * retrait de questions change le paquet des séries pas encore commencées.
 */
export function selectWeeklyQuestions(questions, unitId, weekId) {
  const week = parseWeek(weekId);
  if (!week || typeof unitId !== 'string' || !unitId) return [];
  const eligible = uniqueQuestions(Array.isArray(questions) ? questions.filter(question => question?.unit === unitId) : [])
    .sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
  if (eligible.length < SERIES_SIZE) return [];
  // JSON.stringify évite toute ambiguïté entre des listes d'identifiants.
  const deck = shuffled(eligible, JSON.stringify([unitId, eligible.map(question => question.id)]));
  const start = ((week.ordinal * SERIES_SIZE) % deck.length + deck.length) % deck.length;
  const selected = Array.from({ length: SERIES_SIZE }, (_, index) => deck[(start + index) % deck.length]);
  return shuffled(selected, JSON.stringify([unitId, week.id]));
}

function isTimestamp(value) {
  if (typeof value !== 'string') return false;
  const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/);
  if (!parts) return false;
  const [year, month, day, hour, minute, second] = parts.slice(1).map(Number);
  const civil = civilDate(year, month, day);
  return year >= 1 && civil.getUTCFullYear() === year && civil.getUTCMonth() === month - 1 &&
    civil.getUTCDate() === day && hour <= 23 && minute <= 59 && second <= 59 && Number.isFinite(Date.parse(value));
}

function isAnswer(value) {
  return isRecord(value) && typeof value.answer === 'string' && Boolean(value.answer.trim()) &&
    typeof value.correct === 'boolean' && isTimestamp(value.answeredAt);
}

function countedAnswer(series, question) {
  if (!isRecord(series.answers) || !hasOwn(series.answers, question.id)) return null;
  const answer = series.answers[question.id];
  return isAnswer(answer) ? answer : null;
}

function uniqueSeries(collection, unitId) {
  const source = isRecord(collection) && hasOwn(collection, 'series') ? collection.series : collection;
  const seriesList = Array.isArray(source) ? source : isRecord(source) ? Object.values(source) : [];
  const seen = new Set();
  return seriesList.filter(series => {
    if (!isRecord(series) || (unitId !== undefined && series.unit !== unitId)) return false;
    const key = typeof series.id === 'string' && series.id ? series.id :
      typeof series.week === 'string' ? `${series.unit}__${series.week}` : series;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Réponses racines comptabilisées, avec leur question historique et leur série.
 * À utiliser sur la vue normalisée du stockage : les brouillons et tentatives
 * d'entraînement ne sont jamais des réponses supplémentaires. Les règles de
 * validation et de dédoublonnage sont les mêmes que les statistiques du Drill.
 */
export function getCountedDrillResponses(collection, unitId) {
  const responses = [];
  for (const series of uniqueSeries(collection, unitId)) {
    for (const question of uniqueQuestions(series.questions)) {
      const answer = countedAnswer(series, question);
      if (answer) responses.push({ series, question, answer });
    }
  }
  return responses;
}

function emptyStats() {
  return { planned: 0, completed: 0, correct: 0, incorrect: 0, successRate: null, trainingAttempts: 0 };
}

function addQuestion(stats, answer) {
  stats.planned += 1;
  if (!answer) return;
  stats.completed += 1;
  if (answer.correct) stats.correct += 1;
  else stats.incorrect += 1;
  if (Array.isArray(answer.attempts)) {
    const attempts = answer.attempts.filter(attempt => isAnswer(attempt) &&
      (!hasOwn(attempt, 'training') || typeof attempt.training === 'boolean'));
    // Le marqueur explicite reste exact si une première entrée illisible a été
    // écartée de la vue : la réponse racine comptabilisée n'est pas un entraînement.
    // Une ancienne liste sans aucun marqueur comprenait la première réponse.
    stats.trainingAttempts += attempts.some(attempt => hasOwn(attempt, 'training'))
      ? attempts.filter(attempt => attempt.training === true).length
      : Math.max(0, attempts.length - 1);
  }
}

function finishStats(stats) {
  stats.successRate = stats.completed ? stats.correct / stats.completed * 100 : null;
  return stats;
}

/**
 * Seule la réponse racine figée est comptabilisée, jamais sa meilleure tentative.
 * Les questions sans réponse ne sont pas des échecs. Aucune donnée = null.
 * Les doublons d'identifiant ou réponses illisibles ne créent pas de résultats.
 */
export function getSeriesStats(series) {
  const stats = emptyStats();
  if (!isRecord(series)) return stats;
  for (const question of uniqueQuestions(series.questions)) addQuestion(stats, countedAnswer(series, question));
  return finishStats(stats);
}

/**
 * Agrège les séries d'une UC sans les mélanger aux QCM des cours.
 * collection : tableau, map {id: série}, ou document {series: tableau/map}.
 * Une question réapparue une autre semaine est un nouvel exercice planifié.
 * Les snapshots conservent notions, difficultés, versions et dates pour le futur
 * Dashboard ; aucune courbe ni donnée d'examen n'est créée ici.
 */
export function getDrillUnitStats(collection, unitId) {
  if (typeof unitId !== 'string' || !unitId) return { ...emptyStats(), notions: [] };
  const stats = emptyStats();
  const notions = new Map();
  for (const series of uniqueSeries(collection, unitId)) {
    for (const question of uniqueQuestions(series.questions)) {
      const answer = countedAnswer(series, question);
      addQuestion(stats, answer);
      const concept = typeof question.concept === 'string' && question.concept.trim() ? question.concept.trim() : 'Notion non renseignée';
      if (!notions.has(concept)) notions.set(concept, { concept, ...emptyStats() });
      addQuestion(notions.get(concept), answer);
    }
  }
  return { ...finishStats(stats), notions: [...notions.values()].map(finishStats) };
}
