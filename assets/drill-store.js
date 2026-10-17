import { validateDrillQuestion } from './drill-bank.js';
import { parseWeek } from './drill-engine.js';

/** Separate from every legacy course/QCM key. Never reset or migrate those keys. */
export const DRILL_STORAGE_KEY = 'bprea-demo-drill-v1';
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const isId = value => typeof value === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(value);

function isTimestamp(value) {
  if (typeof value !== 'string') return false;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/);
  if (!match) return false;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1] &&
    hour <= 23 && minute <= 59 && second <= 59 && Number.isFinite(Date.parse(value));
}

const isWeek = value => parseWeek(value) !== null;

function validQuestions(questions, unit) {
  if (!Array.isArray(questions) || questions.length !== 10) return false;
  const ids = new Set();
  return questions.every(question => {
    if (!validateDrillQuestion(question) || question.unit !== unit || ids.has(question.id)) return false;
    ids.add(question.id);
    return true;
  });
}

function validSnapshot(series, id) {
  return isRecord(series) && series.id === id && isId(series.unit) && isWeek(series.week) &&
    id === `${series.unit}__${series.week}` && isTimestamp(series.startedAt) &&
    validQuestions(series.questions, series.unit);
}

function validResponse(response, question) {
  return isRecord(response) && question.options.some(option => option.id === response.answer) &&
    response.correct === (response.answer === question.answer) && isTimestamp(response.answeredAt);
}

/**
 * Expose only reliable results to renderers and statistics. The original JSON, including
 * unknown fields or invalid entries, remains untouched in storage and in transactions.
 */
function readableSeries(series, warnings) {
  // Question identifiers such as "constructor" must never resolve inherited keys.
  const answers = Object.create(null);
  const drafts = Object.create(null);
  const trainingDrafts = Object.create(null);
  const questionMap = new Map(series.questions.map(question => [question.id, question]));
  let incomplete = false;
  if (!isRecord(series.answers) || !isRecord(series.drafts)) incomplete = true;
  for (const [id, response] of Object.entries(isRecord(series.answers) ? series.answers : {})) {
    const question = questionMap.get(id);
    if (!question || !validResponse(response, question)) { incomplete = true; continue; }
    const attempts = [];
    if (!Array.isArray(response.attempts)) incomplete = true;
    for (const attempt of Array.isArray(response.attempts) ? response.attempts : []) {
      if (!validResponse(attempt, question) ||
        (hasOwn(attempt, 'training') && typeof attempt.training !== 'boolean')) {
        incomplete = true;
        continue;
      }
      attempts.push(attempt);
    }
    answers[id] = { ...response, attempts };
  }
  for (const [id, optionId] of Object.entries(isRecord(series.drafts) ? series.drafts : {})) {
    const question = questionMap.get(id);
    if (!question || !question.options.some(option => option.id === optionId)) { incomplete = true; continue; }
    drafts[id] = optionId;
  }
  if (hasOwn(series, 'trainingDrafts') && !isRecord(series.trainingDrafts)) incomplete = true;
  for (const [id, optionId] of Object.entries(isRecord(series.trainingDrafts) ? series.trainingDrafts : {})) {
    const question = questionMap.get(id);
    // null explicitly records a consumed draft after a completed training attempt.
    if (!question || (optionId !== null && !question.options.some(option => option.id === optionId))) {
      incomplete = true;
      continue;
    }
    trainingDrafts[id] = optionId;
  }
  if (incomplete) warnings.push(`La série ${series.id} contient des données illisibles, conservées mais exclues des statistiques.`);
  return { ...series, answers, drafts, trainingDrafts };
}

function loadDocument() {
  let raw;
  try {
    raw = globalThis.localStorage.getItem(DRILL_STORAGE_KEY);
  } catch {
    return { document: null, raw: null, error: 'Le stockage local est inaccessible. La progression Drill ne peut pas être lue ni enregistrée.' };
  }
  if (raw === null) return { document: { version: 1, series: {} }, raw, error: null };
  let document;
  try { document = JSON.parse(raw); } catch {
    return { document: null, raw, error: 'Les données locales du mode Drill sont illisibles. Elles sont conservées sans modification.' };
  }
  if (!isRecord(document) || document.version !== 1 || !isRecord(document.series)) {
    return { document: null, raw, error: 'Le format des données locales du mode Drill n’est pas reconnu. Elles sont conservées sans modification.' };
  }
  return { document, raw, error: null };
}

/** Read saved snapshots even when the current question bank cannot be loaded. */
export function readDrillState() {
  const loaded = loadDocument();
  const result = { series: {}, error: loaded.error, warnings: [] };
  if (!loaded.document) return result;
  for (const [id, series] of Object.entries(loaded.document.series)) {
    if (!validSnapshot(series, id)) {
      result.warnings.push(`Une série enregistrée (${id}) est illisible. Ses données sont conservées sans modification.`);
      continue;
    }
    result.series[id] = readableSeries(series, result.warnings);
  }
  return result;
}

export function listSavedSeries() {
  return Object.values(readDrillState().series);
}

function failure(error, warnings = []) {
  return { series: null, error, warnings };
}

function transact(change) {
  // No cached document: every action merges into the latest value from other tabs.
  for (let retry = 0; retry < 3; retry += 1) {
    const loaded = loadDocument();
    if (loaded.error) return failure(loaded.error);
    const result = change(loaded.document);
    if (result.error) return failure(result.error);
    const warnings = [];
    if (!result.changed) return { series: readableSeries(result.series, warnings), error: null, warnings };
    try {
      if (globalThis.localStorage.getItem(DRILL_STORAGE_KEY) !== loaded.raw) continue;
      globalThis.localStorage.setItem(DRILL_STORAGE_KEY, JSON.stringify(loaded.document));
    } catch {
      return failure('La progression n’a pas été enregistrée : le stockage local est bloqué ou plein. Les données déjà enregistrées sont conservées.');
    }
    return { series: readableSeries(result.series, warnings), error: null, warnings };
  }
  return failure('La progression a changé dans un autre onglet. Recharge la série avant de réessayer.');
}

async function mutate(change) {
  // Web Locks serializes read/modify/write between tabs when the browser supports it.
  // The fallback re-reads immediately; truly simultaneous writes remain a localStorage limit.
  if (globalThis.navigator?.locks?.request) {
    try {
      return await globalThis.navigator.locks.request(DRILL_STORAGE_KEY, { mode: 'exclusive' }, () => transact(change));
    } catch {
      return failure('L’enregistrement local n’a pas pu être verrouillé. Réessaie pour conserver ta progression.');
    }
  }
  return transact(change);
}

/** Starting a series saves its complete versioned questions before the first answer. */
export async function ensureSeries(unitId, weekId, questions, nowISO = new Date().toISOString()) {
  if (!isId(unitId) || !isWeek(weekId)) return failure('L’UC ou la semaine de cette série est invalide.');
  const id = `${unitId}__${weekId}`;
  return mutate(document => {
    if (hasOwn(document.series, id)) {
      const series = document.series[id];
      return validSnapshot(series, id)
        ? { series, changed: false }
        : { error: 'Cette série contient des données illisibles. Elles sont conservées et ne peuvent pas être remplacées.' };
    }
    if (!isTimestamp(nowISO) || !validQuestions(questions, unitId)) {
      return { error: 'Une série exige 10 exercices valides et distincts pour cette UC, ainsi qu’une date valide.' };
    }
    // JSON cloning freezes the historical content against later in-memory bank edits.
    let snapshot;
    try { snapshot = JSON.parse(JSON.stringify(questions)); } catch {
      return { error: 'Le contenu de cette série ne peut pas être enregistré.' };
    }
    const series = { id, unit: unitId, week: weekId, startedAt: nowISO, questions: snapshot, answers: {}, drafts: {}, trainingDrafts: {} };
    document.series[id] = series;
    return { series, changed: true };
  });
}

function findQuestion(document, seriesId, questionId, optionId) {
  if (typeof seriesId !== 'string' || !hasOwn(document.series, seriesId) || !validSnapshot(document.series[seriesId], seriesId)) {
    return { error: 'La série est absente ou illisible. Commence ou recharge une série avant de répondre.' };
  }
  const series = document.series[seriesId];
  const question = series.questions.find(item => item.id === questionId);
  if (!question || !question.options.some(option => option.id === optionId)) {
    return { error: 'La question ou la réponse choisie n’appartient pas à cette série enregistrée.' };
  }
  return { series, question };
}

export async function saveDraft(seriesId, questionId, optionId, { training = false } = {}) {
  if (typeof training !== 'boolean') return failure('Le mode du brouillon est invalide.');
  return mutate(document => {
    const found = findQuestion(document, seriesId, questionId, optionId);
    if (found.error) return found;
    const { series, question } = found;
    const key = training ? 'trainingDrafts' : 'drafts';
    // trainingDrafts was not present in the first storage format; add it lazily.
    if (training && !hasOwn(series, key)) series[key] = {};
    if (!isRecord(series[key])) return { error: 'Les brouillons de cette série sont illisibles. Ils sont conservés sans modification.' };
    const drafts = series[key];
    const exists = hasOwn(drafts, questionId);
    if (exists && !(training && drafts[questionId] === null) && !question.options.some(option => option.id === drafts[questionId])) {
      return { error: 'Le brouillon existant est illisible. Il est conservé sans modification.' };
    }
    if (exists && drafts[questionId] === optionId) return { series, changed: false };
    drafts[questionId] = optionId;
    return { series, changed: true };
  });
}

/**
 * The first validated response is the immutable series result. Later optional training
 * attempts document practice volume without changing completion or the series success rate.
 */
export async function submitAnswer(seriesId, questionId, optionId, { training = false, nowISO = new Date().toISOString() } = {}) {
  if (typeof training !== 'boolean' || !isTimestamp(nowISO)) return failure('La tentative exige un mode et une date valides.');
  return mutate(document => {
    const found = findQuestion(document, seriesId, questionId, optionId);
    if (found.error) return found;
    const { series, question } = found;
    if (!isRecord(series.answers)) return { error: 'Les réponses de cette série sont illisibles. Elles sont conservées sans modification.' };
    const exists = hasOwn(series.answers, questionId);
    const previous = series.answers[questionId];
    if (exists && !validResponse(previous, question)) {
      return { error: 'La réponse enregistrée est illisible. Elle est conservée sans modification.' };
    }
    if (exists && !training) return { series, changed: false };
    if (!exists && training) return { error: 'Valide d’abord une première réponse avant de recommencer en entraînement.' };
    const response = { answer: optionId, correct: optionId === question.answer, answeredAt: nowISO };
    if (training) {
      if (!Array.isArray(previous.attempts)) return { error: 'L’historique de cette réponse est illisible. Il est conservé sans modification.' };
      if (hasOwn(series, 'trainingDrafts') && !isRecord(series.trainingDrafts)) {
        return { error: 'Les brouillons d’entraînement sont illisibles. Ils sont conservés sans modification.' };
      }
      if (isRecord(series.trainingDrafts) && hasOwn(series.trainingDrafts, questionId) &&
        series.trainingDrafts[questionId] !== null && !question.options.some(option => option.id === series.trainingDrafts[questionId])) {
        return { error: 'Le brouillon d’entraînement existant est illisible. Il est conservé sans modification.' };
      }
      // A duplicate event with the same timestamp is idempotent, including between tabs.
      const duplicate = previous.attempts.some(attempt => isRecord(attempt) && attempt.training === true &&
        attempt.answer === optionId && attempt.answeredAt === nowISO);
      if (duplicate) return { series, changed: false };
      previous.attempts.push({ ...response, training: true });
      if (!hasOwn(series, 'trainingDrafts')) series.trainingDrafts = {};
      series.trainingDrafts[questionId] = null;
    } else {
      series.answers[questionId] = { ...response, attempts: [{ ...response, training: false }] };
    }
    return { series, changed: true };
  });
}
