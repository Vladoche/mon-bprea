const fail = code => Object.assign(new Error(code), { code });

/** Upgrade v1 without deleting any account. Older v1 clients then fail closed.
 * The scoped removal and its write barrier commit in ONE transaction. */
export function changeErasureScope(databaseName, scope, { indexedDB = globalThis.indexedDB,
  active = () => true, expected, transform, resume = false, timeoutMs = 5000 } = {}) {
  return new Promise((resolve, reject) => {
    let db, tx, request, settled = false, result, failure;
    const finish = (error, value) => {
      if (settled) return;
      settled = true; clearTimeout(timer); db?.close();
      error ? reject(fail(error)) : resolve(value);
    };
    const timer = setTimeout(() => { try { tx?.abort(); } catch { /* Already committed. */ } finish('blocked'); }, timeoutMs);
    try { request = indexedDB.open(databaseName, 2); } catch { finish('unavailable'); return; }
    request.onupgradeneeded = event => {
      if (settled || !active()) { request.transaction.abort(); return; }
      if (event.oldVersion === 0) request.result.createObjectStore('accounts');
      if (!request.result.objectStoreNames.contains('accounts')) { request.transaction.abort(); return; }
      request.result.createObjectStore('privacy');
    };
    // A blocked upgrade is NOT a successful erasure. The late open is closed.
    request.onblocked = () => finish('blocked');
    request.onerror = () => finish('unavailable');
    request.onsuccess = () => {
      db = request.result;
      if (settled) { db.close(); return; }
      if (!active()) { finish('identity'); return; }
      try { tx = db.transaction(['accounts', 'privacy'], 'readwrite'); } catch { finish('future'); return; }
      tx.onerror = () => {};
      tx.onabort = () => finish(failure || 'unavailable');
      tx.oncomplete = () => finish(null, result);
      const accounts = tx.objectStore('accounts'), guards = tx.objectStore('privacy');
      const read = accounts.get(scope);
      const guard = guards.get(scope);
      guard.onsuccess = () => {
        try {
          const marker = guard.result;
          if (marker && (marker.version !== 1 || typeof marker.epoch !== 'string' || typeof marker.blocked !== 'boolean')) throw fail('future');
          if (!active()) throw fail('identity');
          if (!resume && JSON.stringify(read.result ?? null) !== expected) throw fail('changed');
          if (!resume && read.result && (read.result.version !== 1 || read.result.scope !== scope)) throw fail('future');
          if (resume) result = { status: 'resumed' };
          else {
            const next = transform ? transform(read.result ?? null) : null;
            next === null ? accounts.delete(scope) : accounts.put(next, scope);
            result = { status: read.result ? 'erased' : 'absent' };
          }
          guards.put({ version: 1, epoch: globalThis.crypto.randomUUID(), blocked: !resume }, scope);
        } catch (error) { failure = error.code || 'invalid'; tx.abort(); }
      };
    };
  });
}
