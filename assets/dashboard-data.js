import { readDrillState } from './drill-store.js';

const personalStates = new Set(['loading', 'local', 'pending', 'syncing', 'synced', 'offline', 'error', 'conflict', 'storage-error']);
const identityError = 'L’identité du compte doit être vérifiée. Aucune donnée personnelle précédente n’est affichée.';

function descriptor(mode, state, values = {}) {
  return { mode, scope: null, state, pending: 0, conflicts: 0, available: false,
    loading: false, blocked: mode === 'blocked', message: null, ...values };
}

/** Read-only source selection. Personal data is already normalized by the
 * Drill service: no second database reader, validation or reconciliation here.
 * Omitting the snapshot keeps the visitor contract used by section hubs. An
 * explicitly inaccessible source must never fall back to visitor statistics.
 */
export function readDashboardData(snapshot) {
  if (snapshot === undefined || snapshot?.mode === 'visitor') {
    const view = readDrillState();
    return { ...view, source: descriptor('visitor', 'visitor', {
      available: !view.error, message: view.error,
    }) };
  }
  const state = snapshot?.sync?.state || 'session';
  if (snapshot?.mode !== 'personal' || typeof snapshot.scope !== 'string' || !snapshot.scope ||
      state === 'session' || snapshot.sync?.requiresVerification || !personalStates.has(state)) {
    const loading = state === 'loading';
    const error = loading ? 'Vérification du compte…' : identityError;
    return { series: {}, warnings: [], error,
      source: descriptor('blocked', state, { loading, message: error }) };
  }
  const view = snapshot.view;
  const validView = view && typeof view === 'object' && view.series && typeof view.series === 'object';
  // At an offline identity transition the service reads the cache before it can
  // replace its loading view. This is a wait state, not a failed or empty read.
  const loading = state === 'loading' || view?.error === 'Chargement de ton cache personnel…';
  const error = loading ? 'Chargement de ton cache personnel…' :
    !validView ? 'L’historique personnel ne peut pas être lu. Les données sont conservées.' :
      view.error || (state === 'storage-error' ? 'Le cache personnel est inaccessible. Les données sont conservées.' : null);
  const source = descriptor('personal', state, {
    scope: snapshot.scope, loading, available: !error,
    pending: Number.isSafeInteger(snapshot.sync.pending) && snapshot.sync.pending > 0 ? snapshot.sync.pending : 0,
    conflicts: Array.isArray(snapshot.sync.conflicts) ? snapshot.sync.conflicts.filter(item => item && !item.resolved).length : 0,
    message: error || (typeof snapshot.sync.error === 'string' ? snapshot.sync.error : null),
  });
  if (error) return { series: {}, warnings: [], error, source };
  return { series: view.series, warnings: Array.isArray(view.warnings) ? view.warnings : [], error: null, source };
}
