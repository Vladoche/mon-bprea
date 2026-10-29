import { TABLES, CACHES } from '../../assets/export-sources.js';
import { envelope, projectLocal } from '../../assets/export-model.js';
import { A, serverRows, stamp, uuid } from './export.js';
export { A, B, stamp, uuid, questions } from './export.js';
export const config = { environment: 'development', url: 'https://export.invalid', client: {} };
export const scope = JSON.stringify([config.environment, config.url, A]);
export const emptyServer = () => Object.fromEntries(Object.keys(TABLES).map(name => [name, []]));
export function restoreRows() {
  const rows = serverRows(A, 2);
  rows.botanical_sessions[0].operation_id = uuid(5); rows.itk_settings[0].operation_id = uuid(6); rows.appearance_preferences[0].operation_id = uuid(7);
  return rows;
}
export function archive(server = restoreRows(), documents = {}) {
  const local = Object.fromEntries(Object.entries(documents).map(([domain, doc]) => [domain, projectLocal(domain, doc, scope).data]));
  return envelope({ kind: 'account', environment: config.environment, supabaseOrigin: config.url, userId: A },
    { identity: { id: A, email: 'synthetic@example.invalid', created_at: stamp }, server, personalLocal: local },
    [...Object.keys(server).map(name => ({ source: name, status: 'included', count: server[name].length })),
      ...Object.entries(CACHES).map(([domain, source]) => ({ source, status: local[domain] ? 'included' : 'absent' })),
      { source: 'Auth API', status: 'limited' }], stamp);
}
export const selectedFile = file => { const text = typeof file === 'string' ? file : JSON.stringify(file); return { size: new TextEncoder().encode(text).length, text: async () => text }; };
export const emptyCurrent = (server = emptyServer()) => ({ server, local: Object.fromEntries(Object.keys(CACHES).map(domain => [domain, { status: 'available', document: null, privacy: null }])) });
