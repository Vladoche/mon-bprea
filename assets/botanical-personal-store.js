import { createScopedRepository } from './personal-idb.js';
import { emptyPersonalDocument, validatePersonalDocument, LocalBotanicalError } from './botanical-sync-model.js';
export { personalScope } from './drill-personal-store.js';
export { LocalBotanicalError, clone } from './botanical-sync-model.js';
export const PERSONAL_BOTANICAL_DB = 'mon-bprea-botanical-personal-v1';
export function createBotanicalRepository(scope, { indexedDB = globalThis.indexedDB, databaseName = PERSONAL_BOTANICAL_DB, onCommit = () => {} } = {}) {
  return createScopedRepository(scope, { indexedDB, databaseName, onCommit, empty: emptyPersonalDocument, validate: validatePersonalDocument, ErrorType: LocalBotanicalError });
}
