import { expect } from '@playwright/test';

// Read only the public application state, never SDK sessions or tokens. Match
// the page's module query so that this is the SAME singleton as the interface.
export async function authIdentity(page, { retry = false } = {}) {
  return page.evaluate(async retry => {
    const app = new URL(document.querySelector('script[type="module"][src]').src);
    const url = new URL('./auth-service.js', app); url.search = app.search;
    const auth = await (await import(url.href)).getAuthService();
    if (retry) try { await auth.retry(); } catch { /* Assert the resulting real state. */ }
    const state = auth.getState();
    return { status: state.status, userId: state.user?.id || null };
  }, retry);
}

export async function waitForIdentity(page, userId, { status = 'authenticated', retry = false } = {}) {
  if (retry) await authIdentity(page, { retry: true });
  await expect.poll(() => authIdentity(page), {
    timeout: 35000,
    message: 'Attendre l’identité applicative du compte attendu après restauration ou changement de compte.',
  }).toEqual({ status, userId });
}

// A request's onsuccess precedes transaction completion. Resolve only after
// oncomplete, using a new readonly transaction ordered after prior writes.
export async function personalRecords(page, name) {
  return page.evaluate(async name => {
    const request = indexedDB.open(name);
    request.onupgradeneeded = () => request.transaction.abort();
    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Cache personnel indisponible.'));
    });
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('accounts', 'readonly');
        const read = tx.objectStore('accounts').getAll();
        tx.oncomplete = () => resolve(read.result);
        tx.onabort = tx.onerror = () => reject(new Error('Lecture du cache personnel non terminée.'));
      });
    } finally { db.close(); }
  }, name);
}

export async function waitForPersistedOperation(page, database, userId, expected) {
  let operation;
  await expect.poll(async () => {
    const records = await personalRecords(page, database);
    const record = records.find(item => JSON.parse(item.scope)[2] === userId);
    operation = record?.operations.find(item => Object.entries(expected).every(([key, value]) => item[key] === value));
    return Boolean(operation);
  }, { message: 'Attendre l’opération persistée dans le cache du propriétaire attendu.' }).toBe(true);
  return operation;
}
