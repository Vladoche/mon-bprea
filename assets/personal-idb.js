/** Stable transaction primitive shared by the personal domains. No Auth or
 * pedagogy belongs here: validation and initial documents remain domain owned. */
export function createScopedRepository(scope, { indexedDB = globalThis.indexedDB, databaseName,
  empty, validate, ErrorType = Error, onCommit = () => {} }) {
  let opening;
  function open() {
    if (!opening) opening = new Promise((resolve, reject) => {
      if (!indexedDB) { reject(new ErrorType()); return; }
      let request;
      try { request = indexedDB.open(databaseName, 1); } catch { reject(new ErrorType()); return; }
      request.onupgradeneeded = () => request.result.createObjectStore('accounts');
      request.onerror = () => { opening = null; reject(new ErrorType()); };
      request.onblocked = () => reject(new ErrorType('Le cache personnel est ouvert dans un ancien onglet. Ferme cet onglet puis recharge.'));
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
    if (!active()) throw new ErrorType('Le compte a changé. Aucune action n’a été enregistrée.');
    return new Promise((resolve, reject) => {
      let tx; let value; let failure; let changed = false;
      try { tx = db.transaction('accounts', change ? 'readwrite' : 'readonly'); }
      catch { reject(new ErrorType()); return; }
      tx.onabort = () => reject(failure || new ErrorType());
      tx.onerror = () => {};
      tx.oncomplete = () => {
        if (changed) try { onCommit(); } catch { /* Optional notification after durable commit. */ }
        resolve(value);
      };
      const store = tx.objectStore('accounts');
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
    });
  }
  return { scope, read: () => transaction(), change: transaction,
    async close() { (await open()).close(); opening = null; } };
}
