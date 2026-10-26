import { createScopedRepository } from './personal-idb.js';
import { emptySettingsDocument, validateSettingsDocument, LocalSettingsError } from './settings-model.js';
export { personalScope } from './drill-personal-store.js';
export const PERSONAL_SETTINGS_DB = 'mon-bprea-settings-personal-v1';
export function createSettingsRepository(scope, { indexedDB = globalThis.indexedDB, databaseName = PERSONAL_SETTINGS_DB, onCommit = () => {} } = {}) {
  return createScopedRepository(scope, { indexedDB, databaseName, onCommit, empty: emptySettingsDocument, validate: validateSettingsDocument, ErrorType: LocalSettingsError });
}
