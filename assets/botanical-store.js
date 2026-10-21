import { normalizeAnswer } from './botanical-engine.js';

/** Independent namespace: no existing Drill, QCM, dashboard or theme key is read or written. */
export const BOTANICAL_STORAGE_KEY = 'monbprea.botanical.v1';
export const BOTANICAL_SCHEMA_VERSION = 1;
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isId = value => typeof value === 'string' && value.length > 0 && value.length <= 200;
const empty = () => ({ schemaVersion: BOTANICAL_SCHEMA_VERSION, answers: [], sessions: [] });
const isTimestamp = value => typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) && Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 19) === value.slice(0, 19);

function sessionMetadata(value) {
  if (!isRecord(value) || !isId(value.id) || !isId(value.categoryId) ||
    !['discovery', 'chrono'].includes(value.mode) || typeof value.revision !== 'boolean' ||
    !isTimestamp(value.startedAt) || !Number.isFinite(value.durationSeconds) ||
    value.durationSeconds < 1 || value.durationSeconds > 300 ||
    (value.completedAt !== undefined && value.completedAt !== null &&
      (!isTimestamp(value.completedAt) || Date.parse(value.completedAt) < Date.parse(value.startedAt)))) return null;
  const totalQuestions = Array.isArray(value.questions) ? value.questions.length : value.totalQuestions;
  if (!Number.isInteger(totalQuestions) || totalQuestions < 1 || totalQuestions > 10) return null;
  return {
    id: value.id, categoryId: value.categoryId, mode: value.mode, durationSeconds: value.durationSeconds,
    revision: value.revision, startedAt: value.startedAt, totalQuestions, completedAt: value.completedAt ?? null,
  };
}

/**
 * Reads tolerate missing/invalid rows. Transactions preserve unknown fields and rows.
 * A corrupt document or newer schema stays untouched and read-only. Sessions only
 * store metadata; a new visit starts a new session while saved answers stay intact.
 */
export function createBotanicalStore(storage) {
  let currentStatus = { state: 'ready', writable: true, message: '' };
  const fail = (state, message, writable = false) => {
    currentStatus = { state, writable, message };
    return null;
  };
  const read = () => {
    let raw;
    try { raw = (storage ?? globalThis.localStorage).getItem(BOTANICAL_STORAGE_KEY); }
    catch { return fail('unavailable', 'Le stockage local est inaccessible. Les résultats de cette session ne peuvent pas être conservés.'); }
    if (raw === null) {
      currentStatus = { state: 'ready', writable: true, message: '' };
      return { raw, document: empty() };
    }
    let document;
    try { document = JSON.parse(raw); }
    catch { return fail('corrupt', 'Les données botaniques locales sont illisibles. Elles sont conservées sans modification.'); }
    if (isRecord(document) && Number.isInteger(document.schemaVersion) && document.schemaVersion > BOTANICAL_SCHEMA_VERSION) {
      return fail('future', 'Ces données botaniques proviennent d’une version plus récente. Elles sont conservées sans modification.');
    }
    if (!isRecord(document) || document.schemaVersion !== BOTANICAL_SCHEMA_VERSION ||
      !Array.isArray(document.answers) || !Array.isArray(document.sessions)) {
      return fail('corrupt', 'Le format des données botaniques locales est invalide. Elles sont conservées sans modification.');
    }
    currentStatus = { state: 'ready', writable: true, message: '' };
    return { raw, document };
  };
  const transact = change => {
    // Merge the current document at each write, including answers from another tab.
    for (let retry = 0; retry < 3; retry += 1) {
      const loaded = read();
      if (!loaded) return false;
      const outcome = change(loaded.document);
      if (outcome === false) return false;
      if (outcome === null) return true;
      try {
        const target = storage ?? globalThis.localStorage;
        if (target.getItem(BOTANICAL_STORAGE_KEY) !== loaded.raw) continue;
        target.setItem(BOTANICAL_STORAGE_KEY, JSON.stringify(loaded.document));
        return true;
      } catch { fail('unavailable', 'Le navigateur n’a pas pu enregistrer les résultats botaniques. Les données existantes sont conservées.'); return false; }
    }
    fail('unavailable', 'Les données ont changé dans un autre onglet. Cet enregistrement n’a pas pu être effectué.');
    return false;
  };
  return {
    get status() { return { ...currentStatus }; },
    load() {
      const loaded = read();
      if (!loaded) return empty();
      const seenAnswers = new Set();
      const seenSessions = new Set();
      const answers = loaded.document.answers.map(normalizeAnswer).filter(answer => {
        if (!answer || seenAnswers.has(answer.id)) return false;
        seenAnswers.add(answer.id);
        return true;
      });
      const sessions = loaded.document.sessions.map(sessionMetadata).filter(session => {
        if (!session || seenSessions.has(session.id)) return false;
        seenSessions.add(session.id);
        return true;
      });
      if (answers.length !== loaded.document.answers.length || sessions.length !== loaded.document.sessions.length) {
        currentStatus.message = 'Certaines données botaniques illisibles sont conservées et exclues des statistiques.';
      }
      return { schemaVersion: BOTANICAL_SCHEMA_VERSION, answers, sessions };
    },
    recordAnswer(value) {
      const answer = normalizeAnswer(value);
      if (!answer) { fail('invalid', 'Réponse botanique invalide : aucun enregistrement effectué.', true); return false; }
      return transact(document => {
        const previous = document.answers.find(item => isRecord(item) && item.id === answer.id);
        if (previous) {
          const comparable = normalizeAnswer(previous);
          if (comparable && ['sessionId', 'questionId', 'categoryId', 'speciesId', 'photoId', 'mode', 'revision', 'status', 'selectedSpeciesId', 'correct', 'elapsedMs', 'answeredAt'].every(key => comparable[key] === answer[key])) return null;
          fail('invalid', 'Cette question possède déjà un résultat. Le résultat initial est conservé.', true);
          return false;
        }
        document.answers.push(answer);
        return true;
      });
    },
    recordSession(value) {
      const session = sessionMetadata(value);
      if (!session) { fail('invalid', 'Session botanique invalide : aucun enregistrement effectué.', true); return false; }
      return transact(document => {
        const index = document.sessions.findIndex(item => isRecord(item) && item.id === session.id);
        if (index < 0) document.sessions.push(session);
        else {
          const previous = document.sessions[index];
          const previousMetadata = sessionMetadata(previous);
          if (!previousMetadata || ['categoryId', 'mode', 'durationSeconds', 'revision', 'startedAt', 'totalQuestions'].some(key => previousMetadata[key] !== session[key])) {
            fail('invalid', 'Cet identifiant de session existe déjà. Les données initiales sont conservées.', true);
            return false;
          }
          document.sessions[index] = { ...previous, completedAt: previous.completedAt ?? session.completedAt };
        }
        return true;
      });
    },
  };
}
