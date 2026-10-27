import { it, expect } from 'vitest';
import { createExportTransport } from '../../assets/export-transport.js';
import { A, B, serverRows, uuid } from '../fixtures/export.js';

function fixture(size, alter = () => {}) {
  const rows = serverRows(A, size), reads = [], controller = new AbortController();
  const auth = { verifiedSession: async () => ({ userId: A, accessToken: 'test-only-pinned-A' }) };
  const client = { from(table) {
    const query = { table, limit: 100, headers: {}, eq: null, gt: null, or: null };
    const builder = { select(value) { query.columns = value; return this; }, eq(key, value) { query.eq = [key, value]; return this; },
      order() { return this; }, limit(value) { query.limit = value; return this; }, gt(key, value) { query.gt = [key, value]; return this; }, or(value) { query.or = value; return this; },
      retry() { return this; }, setHeader(key, value) { query.headers[key] = value; return this; }, abortSignal() { return this; },
      then(resolve) {
        reads.push(query); let values = rows[table];
        if (query.gt) values = values.filter(row => row[query.gt[0]] > query.gt[1]);
        if (query.or) { const match = query.or.match(/(attempt_id|answer_id).gt\."([^"]+)"/); values = values.filter(row => row[match[1]] > match[2]); }
        const result = { data: structuredClone(values.slice(0, query.limit)), error: null }; alter(result, query, reads, rows);
        return Promise.resolve(result).then(resolve);
      } };
    return builder;
  } };
  return { rows, reads, controller, run: () => createExportTransport(client, auth, A)({ signal: controller.signal, active: () => !controller.signal.aborted }) };
}
it.each([0, 1, 100, 101, 251])('lit %i tentatives et une dernière page vide sans perdre les microsecondes', async size => {
  const f = fixture(size), result = await f.run();
  expect(result.quiz_attempts).toHaveLength(size);
  expect(Object.keys(result)).toHaveLength(10);
  expect(f.reads.filter(q => q.table === 'quiz_attempts')).toHaveLength(Math.ceil(size / 100) + 1);
  expect(f.reads.every(q => q.headers.Authorization === 'Bearer test-only-pinned-A' && q.eq[1] === A && !q.columns.includes('*'))).toBe(true);
});
it('refuse dernière page en erreur, doublon de page et ligne étrangère sans rendre un historique partiel', async () => {
  const late = fixture(201, (result, q) => { if (q.table === 'quiz_attempts' && q.or?.includes(uuid(299))) result.error = { status: 500 }; });
  await expect(late.run()).rejects.toThrow('api');
  const duplicate = fixture(101, (result, q) => { if (q.table === 'quiz_attempts' && q.or) result.data = [serverRows(A).quiz_attempts[0]]; });
  await expect(duplicate.run()).rejects.toThrow('pagination');
  const foreign = fixture(1, (result, q) => { if (q.table === 'quiz_attempts') result.data[0].user_id = B; });
  await expect(foreign.run()).rejects.toThrow('ownership');
});
it('refuse 401/403 et annulation en cours de pagination', async () => {
  for (const status of [401, 403]) {
    const f = fixture(1, result => { result.error = { status }; }); await expect(f.run()).rejects.toThrow('identity');
  }
  let f; f = fixture(201, (_, q) => { if (q.table === 'quiz_attempts' && q.or) f.controller.abort(); });
  await expect(f.run()).rejects.toThrow('cancelled');
});
it('ne prend pas une page plafonnée par le serveur pour la fin de l’historique', async () => {
  const f = fixture(251, result => { result.data = result.data.slice(0, 7); });
  expect((await f.run()).quiz_attempts).toHaveLength(251);
});
