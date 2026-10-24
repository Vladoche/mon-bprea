import * as visitor from './drill-store.js';
import { getAuthService } from './auth-service.js';
import { getSupabaseClient } from './supabase-client.js';
import { createPersonalRepository, personalChange, personalScope, clone } from './drill-personal-store.js';
import { acknowledgeOperation, prepareNextOperation, reconcileHistory, resolveDrillConflict } from './drill-sync-model.js';
import { createDrillTransport, classifySyncError } from './drill-sync-transport.js';

const emptyView = error => ({ series: {}, error, warnings: [] });
const delayFor = count => Math.min(60000, 1000 * 2 ** Math.min(count - 1, 6));
function openBroadcast() { try { return globalThis.BroadcastChannel ? new BroadcastChannel('mon-bprea-drill-personal-v1') : null; } catch { return null; } }

export function createDrillSyncService({ auth, configuration, repositoryFactory = createPersonalRepository,
  transportFactory = createDrillTransport, now = () => Date.now(), schedule = setTimeout, cancel = clearTimeout,
  randomUUID = () => globalThis.crypto.randomUUID(), broadcast = openBroadcast() } = {}) {
  let generation = 0; let scope = null; let repository = null; let transport = null;
  let mode = 'blocked'; let view = emptyView('Vérification du compte…'); let document = null;
  let ready; let run = null; let abort; let timer; let syncState = 'loading'; let syncError = null;
  let lastAuthStatus = null;
  let stopped = false; let lastPull = 0; let pullRequired = true; let runFailures = 0;
  const subscribers = new Set();
  const listeners = [];
  const pendingCount = () => document?.operations.filter(item => item.state === 'pending').length || 0;
  function snapshot() {
    return { mode, scope, view, sync: { state: syncState, error: syncError, pending: pendingCount(),
      conflicts: clone(document?.conflicts || []), operations: clone(document?.operations.filter(item => item.state === 'error') || []) } };
  }
  function notify() { const value = snapshot(); for (const listener of subscribers) listener(value); }
  function active(current) { return !stopped && generation === current && mode === 'personal'; }
  function updateView(saved) { document = saved; view = visitor.readDrillDocument(saved.drill); }
  async function refresh(current = generation) {
    const saved = await repository.read();
    if (active(current)) { updateView(saved); notify(); }
  }
  function invalidate() { generation++; abort?.abort(); cancel(timer); timer = null; run = null; }
  async function changeIdentity(state) {
    const previousAuthStatus = lastAuthStatus;
    lastAuthStatus = state.status;
    const userId = ['authenticated', 'offline'].includes(state.status) ? state.user?.id : null;
    const next = userId && configuration.client ? personalScope({ ...configuration, userId }) : null;
    if (next && next === scope && mode === 'personal') {
      if (state.status === 'offline') { invalidate(); syncState = 'offline'; notify(); return; }
      if (state.status === 'authenticated' && (previousAuthStatus === 'offline' || syncState === 'session')) { syncState = 'pending'; requestSync(true); }
      return;
    }
    invalidate(); scope = next; document = null; syncError = null; lastPull = 0; pullRequired = true;
    if (!userId) {
      repository = null; transport = null;
      const visitorMode = state.status === 'anonymous' || state.status === 'unavailable' && configuration.configurationError !== 'network';
      mode = visitorMode ? 'visitor' : 'blocked';
      view = visitorMode ? visitor.readDrillState() : emptyView(state.error || 'Identité du compte indisponible. Reconnecte-toi pour accéder au cache personnel.');
      syncState = visitorMode ? 'visitor' : 'session'; notify(); return;
    }
    mode = 'personal'; syncState = state.status === 'offline' ? 'offline' : 'loading';
    view = emptyView('Chargement de ton cache personnel…'); notify();
    const current = generation;
    repository = repositoryFactory(next, { onCommit: () => broadcast?.postMessage(next) });
    transport = transportFactory(configuration.client, auth, userId);
    try {
      await refresh(current);
      if (!active(current)) return;
      syncState = state.status === 'offline' ? 'offline' : pendingCount() ? 'pending' : 'local'; notify();
      if (state.status === 'authenticated') requestSync(true);
    } catch (error) {
      if (active(current)) { view = emptyView(error.message); syncState = 'storage-error'; syncError = error.message; notify(); }
    }
  }

  function requestSync(pull = false) {
    pullRequired ||= pull;
    if (stopped || mode !== 'personal' || syncState === 'storage-error') return;
    cancel(timer);
    timer = schedule(() => { timer = null; synchronize(); }, 0);
  }
  async function synchronize() {
    if (run) return run;
    if (mode !== 'personal' || stopped || syncState === 'storage-error') return;
    const current = generation; const repo = repository; const connection = transport;
    const userId = auth.getState().user?.id;
    if (!userId) return;
    const controller = new AbortController(); abort = controller;
    const options = { signal: controller.signal, active: () => active(current) };
    syncState = 'syncing'; syncError = null; notify();
    run = (async () => {
      let operation = null;
      try {
        if (pullRequired || now() - lastPull >= 60000) {
          const history = await connection.readHistory(options);
          if (!active(current)) return;
          await repo.change(saved => reconcileHistory(saved, history, userId, new Date(now()).toISOString()), options.active);
          lastPull = now(); pullRequired = false;
        }
        for (;;) {
          if (!active(current)) return;
          operation = await repo.change(saved => prepareNextOperation(saved, now()), options.active);
          if (!operation) break;
          const result = await connection.send(operation, options);
          if (!active(current)) return;
          await repo.change(saved => acknowledgeOperation(saved, operation.id, result, userId), options.active);
        }
        if (!active(current)) return;
        await refresh(current); runFailures = 0;
        const unresolved = document.conflicts.some(item => !item.resolved);
        syncState = unresolved ? 'conflict' : document.operations.some(item => item.state === 'error') ? 'error' : pendingCount() ? 'pending' : 'synced';
        syncError = null;
      } catch (error) {
        if (!active(current)) return;
        const issue = classifySyncError(error);
        syncState = error?.code === 'local_storage' ? 'storage-error' : issue.kind === 'session' ? 'session' : issue.kind === 'permanent' ? 'error' : 'offline';
        syncError = error?.code === 'local_storage' ? error.message : issue.message;
        if (operation && error?.code !== 'local_storage') {
          try {
            await repo.change(saved => {
              const item = saved.operations.find(item => item.id === operation.id && item.state === 'pending');
              if (item) { item.failures++; item.retryAt = now() + delayFor(item.failures); item.error = issue.code;
                if (issue.kind === 'permanent') item.state = 'error'; }
            }, options.active);
          } catch (storageError) { syncState = 'storage-error'; syncError = storageError.message; }
        }
        runFailures++;
        if (issue.kind === 'transient' && syncState !== 'storage-error') timer = schedule(() => { timer = null; synchronize(); }, delayFor(runFailures));
        try { await refresh(current); } catch { /* Keep the last committed view. */ }
      } finally {
        if (active(current)) {
          run = null; notify();
          if (!timer && document && !['session', 'error', 'storage-error'].includes(syncState)) {
            const pending = document.operations.filter(item => item.state === 'pending');
            const eligible = prepareNextOperation(clone(document), now());
            const nextRetry = pending.filter(item => item.retryAt > now()).map(item => item.retryAt);
            if (eligible || nextRetry.length) timer = schedule(() => { timer = null; synchronize(); }, eligible ? 0 : Math.max(1, Math.min(...nextRetry) - now()));
          }
        }
      }
    })();
    return run;
  }
  async function mutate(action, args) {
    await ready;
    const current = generation;
    if (mode === 'visitor') { const result = await visitor[action](...args); view = visitor.readDrillState(); notify(); return result; }
    if (mode !== 'personal' || view.error) return { series: null, error: view.error || 'Le compte doit être vérifié avant de répondre.', warnings: [] };
    const repo = repository;
    try {
      const result = await repo.change(saved => personalChange(saved, action, args, randomUUID), () => active(current));
      if (!active(current)) return { series: null, error: 'Le compte a changé. Recharge la série.', warnings: [] };
      await refresh(current);
      if (!active(current)) return { series: null, error: 'Le compte a changé. Recharge la série.', warnings: [] };
      if (action !== 'saveDraft') { syncState = 'pending'; notify(); requestSync(); }
      return result;
    } catch (error) { if (active(current)) { syncError = error.message; notify(); } return { series: null, error: error.message, warnings: [] }; }
  }
  const unsubscribe = auth.subscribe(state => { ready = changeIdentity(state).catch(() => {
    invalidate(); mode = 'blocked'; scope = null; document = null; view = emptyView('L’identité personnelle est indisponible. Aucune donnée privée n’est affichée.'); notify();
  }); });
  if (broadcast) broadcast.onmessage = event => { if (mode === 'personal' && event.data === scope) refresh().then(() => requestSync()).catch(() => {}); };
  function listen(target, type, action) { if (target?.addEventListener) { target.addEventListener(type, action); listeners.push(() => target.removeEventListener(type, action)); } }
  listen(globalThis.window, 'online', () => requestSync(true));
  listen(globalThis.document, 'visibilitychange', () => { if (!globalThis.document.hidden) requestSync(now() - lastPull >= 60000); });
  return {
    async start() { await ready; return snapshot(); },
    getState: snapshot,
    subscribe(listener) { subscribers.add(listener); listener(snapshot()); return () => subscribers.delete(listener); },
    ensureSeries: (...args) => mutate('ensureSeries', args), saveDraft: (...args) => mutate('saveDraft', args), submitAnswer: (...args) => mutate('submitAnswer', args),
    async retry() { if (mode !== 'personal') { await auth.retry(); return; } if (syncState === 'storage-error') { await refresh(); syncState = 'local'; }
      await repository.change(saved => { for (const item of saved.operations) if (item.state === 'pending') item.retryAt = 0; });
      pullRequired = true; return synchronize(); },
    async resolveConflict(id) { const current = generation; await repository.change(saved => resolveDrillConflict(saved, id), () => active(current)); await refresh(current); requestSync(true); },
    synchronize,
    stop() { stopped = true; invalidate(); unsubscribe(); broadcast?.close(); listeners.forEach(remove => remove()); document = null; view = emptyView('La page doit être rechargée pour vérifier le compte.'); notify(); },
  };
}

export async function getDrillSyncService() {
  const [auth, configuration] = await Promise.all([getAuthService(), getSupabaseClient().catch(() => ({ client: null, configurationError: 'network' }))]);
  const service = createDrillSyncService({ auth, configuration });
  await service.start(); return service;
}
