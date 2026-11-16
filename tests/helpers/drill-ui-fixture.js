// Presentation fixture only. Real Auth/RLS stays in e2e-supabase/drill-*.spec.js.
import { readDrillDocument } from '../../assets/drill-store.js';

export const emptyDrillView = () => ({ series: {}, error: null, warnings: [] });
export function personalDrill(series = [], { account = 'A', state = 'synced', error = null, conflicts = [], operations = [] } = {}) {
  return { mode: 'personal', scope: `synthetic-${account}`, view: readDrillDocument({ version: 1, series: Object.fromEntries(series.map(item => [item.id, item])) }),
    sync: { state, error, pending: state === 'pending' ? 2 : 0, conflicts, operations } };
}

export async function mountDrillState(page, snapshot) {
  await page.route('**/assets/drill-sync-service.js*', route => route.fulfill({ contentType: 'text/javascript', body: `
    import { readDrillDocument, applySeries, applyDraft, applyAnswer } from './drill-store.js';
    const listeners = new Set(); let state = ${JSON.stringify(snapshot)}, generation = 0;
    const fixture = window.drillFixture = { calls: [], hold: null, fail: null, release: null,
      emit(next) { if (next.scope !== state.scope) generation++; state = next; for (const fn of listeners) fn(state); },
      get state() { return state; }
    };
    async function mutate(action, args) {
      fixture.calls.push({ action, args }); const original = state, epoch = generation;
      if (fixture.hold === action) await new Promise(resolve => fixture.release = resolve);
      if (fixture.fail === action) return { error: 'Échec de sauvegarde simulé : données conservées.' };
      const document = { version: 1, series: structuredClone(original.view.series) };
      const result = ({ ensureSeries: applySeries, saveDraft: applyDraft, submitAnswer: applyAnswer })[action](document, ...args);
      if (epoch === generation && !result.error) fixture.emit({ ...state, view: readDrillDocument(document) });
      return result;
    }
    export async function getDrillSyncService() { return {
      getState: () => state,
      subscribe(fn) { listeners.add(fn); fn(state); return () => listeners.delete(fn); },
      ensureSeries: (...args) => mutate('ensureSeries', args), saveDraft: (...args) => mutate('saveDraft', args), submitAnswer: (...args) => mutate('submitAnswer', args),
      async retry() { fixture.calls.push({ action: 'retry' }); if (fixture.hold === 'retry') await new Promise(resolve => fixture.release = resolve); if (fixture.fail === 'retry') throw Error('Synthetic retry failure'); },
      async resolveConflict(id) { fixture.calls.push({ action: 'resolve', id }); fixture.emit({ ...state, sync: { ...state.sync, state: 'synced', conflicts: state.sync.conflicts.map(item => item.id === id ? { ...item, resolved: true } : item) } }); },
      stop() { listeners.clear(); }
    }; }
  ` }));
}
