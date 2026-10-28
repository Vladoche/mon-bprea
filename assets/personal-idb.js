/** Stable transaction primitive shared by the personal domains. No Auth or
 * pedagogy belongs here: validation and initial documents remain domain owned. */
export function createScopedRepository(scope, { indexedDB = globalThis.indexedDB, databaseName,
  empty, validate, ErrorType = Error, onCommit = () => {} }) {
  let opening;
  function open() {
    if (!opening) opening = new Promise((resolve, reject) => {
      if (!indexedDB) { reject(new ErrorType()); return; }
      let request; let rejected = false;
      try { request = indexedDB.open(databaseName, 2); } catch { reject(new ErrorType()); return; }
      request.onupgradeneeded = () => {
        if (rejected) { request.transaction.abort(); return; }
        if (!request.result.objectStoreNames.contains('accounts')) request.result.createObjectStore('accounts');
        if (!request.result.objectStoreNames.contains('privacy')) request.result.createObjectStore('privacy');
      };
      request.onerror = () => { opening = null; reject(new ErrorType()); };
      request.onblocked = () => { rejected = true; opening = null; reject(new ErrorType('Le cache personnel est ouvert dans un ancien onglet. Ferme cet onglet puis recharge.')); };
      request.onsuccess = () => {
        const db = request.result;
        if (rejected) { db.close(); return; }
        db.onversionchange = () => { db.close(); opening = null; };
        resolve(db);
      };
    });
    return opening;
  }
  let epoch;
  async function transaction(change, active = () => true) {
    const db = await open();
    if (!active()) throw new ErrorType('Le compte a changé. Aucune action n’a été enregistrée.');
    return new Promise((resolve, reject) => {
      let tx; let value; let failure; let changed = false;
      try { tx = db.transaction(['accounts', 'privacy'], change ? 'readwrite' : 'readonly'); }
      catch { reject(new ErrorType()); return; }
      tx.onabort = () => reject(failure || new ErrorType());
      tx.onerror = () => {};
      tx.oncomplete = () => {
        if (changed) try { onCommit(); } catch { /* Optional notification after durable commit. */ }
        resolve(value);
      };
      const store = tx.objectStore('accounts');
      const guard = tx.objectStore('privacy').get(scope);
      guard.onsuccess = () => {
        const marker = guard.result;
        const nextEpoch = marker?.epoch ?? null;
        if ((marker && (marker.version !== 1 || typeof marker.epoch !== 'string' || typeof marker.blocked !== 'boolean')) || marker?.blocked || (epoch !== undefined && epoch !== nextEpoch)) {
          failure = Object.assign(new ErrorType('Ce cache a été retiré sur cet appareil. Reprends-le explicitement depuis le profil pour le reconstruire.'), { code: 'local_erased' });
          tx.abort(); return;
        }
        epoch = nextEpoch;
        const request = store.get(scope);
        request.onsuccess = () => {
          try {
            if (!active()) throw new ErrorType('Le compte a changé. Aucune action n’a été enregistrée.');
            const document = validate(request.result === undefined ? empty(scope) : request.result, scope);
            if (change) {
              const original = JSON.stringify(document);
              value = change(document);
              if (value?.then) throw new ErrorType('Une transaction locale ne peut pas attendre le réseau.');
              validate(document, scope);
              changed = JSON.stringify(document) !== original;
              if (changed) store.put(document, scope);
            } else value = document;
          } catch (error) {
            failure = error instanceof Error && typeof error.code === 'string' ? error : new ErrorType();
            tx.abort();
          }
        };
      };
    });
  }
  return { scope, read: () => transaction(), change: transaction,
    async close() { (await open()).close(); opening = null; } };
}

/** Read-only export path. Never creates/migrates a database, validates by
 * rewriting, enumerates accounts, or emits a synchronization notification. */
export async function readScopedRecord(databaseName, scope, { indexedDB = globalThis.indexedDB, signal, timeoutMs = 5000 } = {}) {
  if (!indexedDB) throw Object.assign(new Error(), { code: 'unavailable' });
  if (signal?.aborted) throw Object.assign(new Error(), { code: 'cancelled' });
  return new Promise((resolve, reject) => {
    let request, db, value, settled = false, absent = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true; clearTimeout(timer); signal?.removeEventListener('abort', cancelled); db?.close();
      error ? reject(Object.assign(new Error(), { code: error })) : resolve(result);
    };
    const cancelled = () => finish('cancelled');
    const timer = setTimeout(() => finish('blocked'), timeoutMs);
    signal?.addEventListener('abort', cancelled, { once: true });
    try { request = indexedDB.open(databaseName); } catch { finish('unavailable'); return; }
    request.onupgradeneeded = () => { absent = true; request.transaction.abort(); };
    request.onblocked = () => finish('blocked');
    request.onerror = () => absent ? finish(null, null) : finish('unavailable');
    request.onsuccess = () => {
      db = request.result;
      if (settled) { db.close(); return; }
      if (![1, 2].includes(db.version) || !db.objectStoreNames.contains('accounts')) { finish('future'); return; }
      try {
        const tx = db.transaction('accounts', 'readonly');
        const read = tx.objectStore('accounts').get(scope);
        read.onsuccess = () => { value = read.result ?? null; };
        tx.oncomplete = () => finish(null, value);
        tx.onabort = tx.onerror = () => finish('unavailable');
      } catch { finish('unavailable'); }
    };
  });
}
