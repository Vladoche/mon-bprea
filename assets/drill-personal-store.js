import { applySeries, applyDraft, applyAnswer, readDrillDocument } from './drill-store.js';

export const PERSONAL_DRILL_DB = 'mon-bprea-drill-personal-v1';
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const clone = value => structuredClone(value);
export class LocalDrillError extends Error {
  constructor(message = 'La progression personnelle n’a pas été enregistrée : le stockage est inaccessible ou plein. Les données existantes sont conservées.') {
    super(message); this.code = 'local_storage';
  }
}

export function personalScope({ environment, url, userId }) {
  const endpoint = new URL(url);
  if (!['development', 'production'].includes(environment) || !uuidPattern.test(userId) || endpoint.username || endpoint.password) throw new LocalDrillError('L’identité du cache personnel est indisponible.');
  return JSON.stringify([environment, endpoint.origin, userId]);
}

export function emptyPersonalDocument(scope) {
  return { version: 1, scope, drill: { version: 1, series: {} }, operations: [],
    remote: { series: [], answers: [], training: [] }, conflicts: [], lastReconciledAt: null };
}

export function validatePersonalDocument(document, scope) {
  const view = readDrillDocument(document?.drill);
  if (!document || document.version !== 1 || document.scope !== scope || view.error || view.warnings.length ||
      !Array.isArray(document.operations) || !Array.isArray(document.conflicts) ||
      !['series', 'answers', 'training'].every(key => Array.isArray(document.remote?.[key]))) throw new LocalDrillError('Le cache personnel est illisible ou d’une version inconnue. Il est conservé sans modification.');
  const ids = new Set();
  for (const operation of document.operations) {
    if (!operation || !uuidPattern.test(operation.id) || ids.has(operation.id) ||
        !['series', 'answer', 'training'].includes(operation.type) ||
        !['pending', 'confirmed', 'conflict', 'blocked', 'error'].includes(operation.state) ||
        !Object.hasOwn(document.drill.series, operation.seriesKey) || !operation.payload ||
        !Number.isSafeInteger(operation.failures) || operation.failures < 0 || !Number.isFinite(operation.retryAt)) throw new LocalDrillError('La file de synchronisation est illisible. Elle est conservée sans envoi.');
    ids.add(operation.id);
    const payload = operation.payload;
    if (operation.type === 'series') {
      const series = { id: operation.seriesKey, unit: payload.p_unit, week: payload.p_week, startedAt: payload.p_started_at,
        questions: payload.p_questions, answers: {}, drafts: {}, trainingDrafts: {} };
      const source = readDrillDocument({ version: 1, series: { [operation.seriesKey]: series } });
      if (source.error || source.warnings.length || !source.series[operation.seriesKey]) throw new LocalDrillError('Le snapshot d’une opération est illisible. La file est conservée sans envoi.');
    } else if (payload.p_operation_id !== operation.id || typeof payload.p_question_id !== 'string' || typeof payload.p_answer !== 'string' ||
        typeof payload.p_answered_at !== 'string' || !Number.isFinite(Date.parse(payload.p_answered_at))) throw new LocalDrillError('Le contenu d’une opération est illisible. La file est conservée sans envoi.');
    if (operation.rpcPayload !== null) {
      const { p_series_id, ...rest } = operation.rpcPayload;
      if (operation.type === 'series' ? JSON.stringify(operation.rpcPayload) !== JSON.stringify(payload)
        : !uuidPattern.test(p_series_id) || JSON.stringify(rest) !== JSON.stringify(payload)) throw new LocalDrillError('Le payload de retry ne correspond plus à l’opération conservée. Aucun envoi n’est effectué.');
    }
  }
  return document;
}

/** One record per identity. Read/change/queue/put share ONE IndexedDB transaction. */
export function createPersonalRepository(scope, { indexedDB = globalThis.indexedDB, databaseName = PERSONAL_DRILL_DB, onCommit = () => {} } = {}) {
  let opening;
  function open() {
    if (!opening) opening = new Promise((resolve, reject) => {
      if (!indexedDB) { reject(new LocalDrillError()); return; }
      let request;
      try { request = indexedDB.open(databaseName, 1); } catch { reject(new LocalDrillError()); return; }
      request.onupgradeneeded = () => request.result.createObjectStore('accounts');
      request.onerror = () => reject(new LocalDrillError());
      request.onblocked = () => reject(new LocalDrillError('Le cache personnel est ouvert dans un ancien onglet. Ferme cet onglet puis recharge.'));
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); opening = null; };
        resolve(db);
      };
    });
    return opening;
  }
  async function transaction(change, active = () => true) {
    const db = await open();
    if (!active()) throw new LocalDrillError('Le compte a changé. Aucune action n’a été enregistrée.');
    return new Promise((resolve, reject) => {
      let tx; let value; let failure; let changed = false;
      try { tx = db.transaction('accounts', change ? 'readwrite' : 'readonly'); }
      catch { reject(new LocalDrillError()); return; }
      tx.onabort = () => reject(failure || new LocalDrillError());
      tx.onerror = () => {}; // onabort is the only failure completion.
      tx.oncomplete = () => { if (changed) try { onCommit(); } catch { /* The write is already committed; notification is optional. */ } resolve(value); };
      const store = tx.objectStore('accounts');
      const request = store.get(scope);
      request.onsuccess = () => {
        try {
          if (!active()) throw new LocalDrillError('Le compte a changé. Aucune action n’a été enregistrée.');
          const document = validatePersonalDocument(request.result === undefined ? emptyPersonalDocument(scope) : request.result, scope);
          if (change) {
            const original = JSON.stringify(document);
            value = change(document);
            if (value?.then) throw new LocalDrillError('Une transaction locale ne peut pas attendre le réseau.');
            validatePersonalDocument(document, scope);
            changed = JSON.stringify(document) !== original;
            if (changed) store.put(document, scope);
          } else value = document;
        } catch (error) {
          // Keep reconciliation/protocol errors distinct from an actual IDB
          // failure (notably 40001 when paginated history changed mid-scan).
          failure = error instanceof Error && typeof error.code === 'string' ? error : new LocalDrillError();
          tx.abort();
        }
      };
    });
  }
  return { scope, read: () => transaction(), change: transaction, async close() { (await open()).close(); opening = null; } };
}

export function newOperation(type, seriesKey, payload, id = globalThis.crypto.randomUUID()) {
  if (!uuidPattern.test(id) || /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(id)) throw new LocalDrillError('L’identifiant de synchronisation n’a pas pu être créé.');
  return { id, type, seriesKey, payload: clone(payload), rpcPayload: null, state: 'pending', failures: 0, retryAt: 0, error: null };
}

export function personalChange(document, action, args, randomUUID = () => globalThis.crypto.randomUUID()) {
  const seriesKey = action === 'ensureSeries' ? `${args[0]}__${args[1]}` : args[0];
  const questionId = args[1];
  if (document.conflicts.some(conflict => !conflict.resolved && conflict.seriesKey === seriesKey &&
      (conflict.kind === 'snapshot' || conflict.questionId === questionId))) throw new LocalDrillError('Un conflit est à résoudre avant de continuer cette série ou cette question.');
  let result;
  if (action === 'ensureSeries') result = applySeries(document.drill, ...args);
  else if (action === 'saveDraft') result = applyDraft(document.drill, ...args);
  else result = applyAnswer(document.drill, args[0], args[1], args[2], { ...args[3], deduplicate: false });
  if (result.error) throw new LocalDrillError(result.error);
  if (result.changed && action !== 'saveDraft') {
    const series = result.series;
    const payload = action === 'ensureSeries'
      ? { p_unit: series.unit, p_week: series.week, p_started_at: series.startedAt, p_questions: series.questions }
      : { p_question_id: args[1], p_answer: args[2], p_answered_at: args[3]?.nowISO || series.answers[args[1]].answeredAt };
    const type = action === 'ensureSeries' ? 'series' : args[3]?.training ? 'training' : 'answer';
    const operation = newOperation(type, seriesKey, payload, randomUUID());
    if (type !== 'series') operation.payload.p_operation_id = operation.id;
    if (type === 'training') operation.payload.p_answered_at = result.series.answers[args[1]].attempts.at(-1).answeredAt;
    document.operations.push(operation);
  }
  return { series: clone(result.series), error: null, warnings: [] };
}
