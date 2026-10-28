import { getAuthService } from './auth-service.js';
import { getSupabaseClient } from './supabase-client.js';
import { createBotanicalRepository, personalScope, clone, LocalBotanicalError } from './botanical-personal-store.js';
import { recordPersonalSession, recordPersonalAnswer, completePersonalSession, prepareNextOperation, acknowledgeOperation, reconcileHistory, projectHistory, resolveConflict, rejectOperation } from './botanical-sync-model.js';
import { createBotanicalStore } from './botanical-store.js';
import { previewLegacyImport, applyLegacyImport } from './botanical-import.js';
import { createBotanicalTransport, classifyBotanicalError } from './botanical-sync-transport.js';
import { delayFor } from './sync-runtime.js';
import { subscribePrivacy } from './privacy-events.js';

export const VISITOR_PROGRESS_KEY = 'monbprea.botanical.v1';
export const VISITOR_BOTANICAL_KEY = VISITOR_PROGRESS_KEY;
export const IMPORT_PROVENANCE_KEY = 'monbprea.botanical.provenance.v1';
const channelName = 'mon-bprea-botanical-personal-v1';
const emptyHistory = () => ({ schemaVersion: 1, sessions: [], answers: [] });
const unavailable = error => ({ history: emptyHistory(), error, warnings: [] });
const isRecord = value => value && typeof value === 'object' && !Array.isArray(value);
function openBroadcast() { try { return globalThis.BroadcastChannel ? new BroadcastChannel(channelName) : null; } catch { return null; } }

export function readVisitorHistory(storage = globalThis.localStorage) {
  const store = createBotanicalStore(storage);
  const history = store.load(); const status = store.status;
  return { history, error: status.writable ? null : status.message,
    warnings: status.writable && status.message ? [status.message] : [] };
}

export function createBotanicalService({ auth, configuration, repositoryFactory = createBotanicalRepository,
  transportFactory = createBotanicalTransport, storage = globalThis.localStorage,
  now = () => Date.now(), randomUUID = () => globalThis.crypto.randomUUID(),
  schedule = setTimeout, cancel = clearTimeout, broadcast = openBroadcast() } = {}) {
  let mode = 'blocked'; let scope = null; let document = null; let repository = null; let transport = null;
  let view = unavailable('Vérification du compte…'); let syncState = 'loading'; let syncError = null;
  let generation = 0; let stopped = false; let ready; let currentRun = null; let controller; let timer;
  let lastAuthStatus = null; let pullVersion = 1; let pulledVersion = 0; let lastPull = 0; let failures = 0; let localWrites = 0;
  const subscribers = new Set(); const listeners = [];
  const pending = () => document?.operations.filter(op => op.state === 'pending').length || 0;
  const active = current => !stopped && generation === current && mode === 'personal';
  const reliable = saved => !!saved && (!!saved.lastReconciledAt || saved.operations.length > 0 ||
    Object.keys(saved.sessions).length > 0 || Object.keys(saved.answers).length > 0 || saved.imports.length > 0);
  function snapshot() {
    const visible = !view.error && mode === 'personal';
    return { mode, scope, view: clone(view), sync: { state: localWrites && syncState !== 'session' ? 'saving' : syncState, error: syncError, pending: visible ? pending() : 0,
      conflicts: visible ? clone(document?.conflicts || []) : [], operations: visible ? clone(document?.operations.filter(op => ['error', 'blocked'].includes(op.state)) || []) : [],
      importArchives: (visible ? document?.importArchives || [] : []).map(item => ({ id: item.id, reason: item.reason, message: item.message })),
      imports: (visible ? document?.imports || [] : []).map(manifest => ({ id: manifest.id, summary: clone(manifest.summary), warnings: clone(manifest.warnings || []) })) } };
  }
  function notify() { const state = snapshot(); subscribers.forEach(fn => fn(state)); }
  function update(saved) {
    document = saved;
    view = reliable(saved) ? { history: projectHistory(saved), error: null, warnings: [] }
      : unavailable(syncState === 'offline' ? 'La connexion est indisponible et aucun cache personnel fiable n’est disponible sur cet appareil.'
        : ['error', 'storage-error'].includes(syncState) ? syncError || 'La progression du compte est indisponible et aucun cache personnel fiable n’est disponible sur cet appareil.'
          : 'Chargement de la progression personnelle…');
    if (syncState === 'session') view = unavailable('L’identité doit être vérifiée à nouveau. Reconnecte-toi au même compte pour retrouver la progression conservée.');
  }
  async function refresh(current = generation, repo = repository) {
    const saved = await repo.read();
    if (active(current)) { update(saved); notify(); }
  }
  function invalidate() { generation++; localWrites = 0; controller?.abort(); cancel(timer); timer = null; currentRun = null; }
  function writing() { localWrites++; syncState = 'saving'; syncError = null; notify(); }
  function wrote(current) {
    if (!active(current)) return;
    localWrites = Math.max(0, localWrites - 1);
    if (!localWrites && syncState === 'saving') syncState = auth.getState().status === 'offline' ? 'offline' : pending() ? 'pending' : 'local';
    notify();
  }
  async function identity(state) {
    const previous = lastAuthStatus; lastAuthStatus = state.status;
    const userId = ['authenticated', 'offline'].includes(state.status) ? state.user?.id : null;
    const nextScope = userId && configuration.client ? personalScope({ ...configuration, userId }) : null;
    if (nextScope && nextScope === scope && mode === 'personal') {
      if (state.status === 'offline') { invalidate(); syncState = 'offline'; if (document) update(document); notify(); }
      else if (previous === 'offline' || syncState === 'session') {
        syncState = 'pending'; if (document) update(document); notify(); requestSync(true);
      }
      return;
    }
    invalidate(); document = null; scope = nextScope; repository = null; transport = null;
    syncError = null; failures = 0; lastPull = 0; pullVersion = 1; pulledVersion = 0;
    if (!userId || !nextScope) {
      const visitor = state.status === 'anonymous' || state.status === 'unavailable' && configuration.configurationError !== 'network';
      mode = visitor ? 'visitor' : 'blocked'; syncState = visitor ? 'visitor' : 'session';
      view = visitor ? readVisitorHistory(storage) : unavailable(state.error || 'Identité indisponible. Aucune progression personnelle n’est affichée.');
      notify(); return;
    }
    mode = 'personal'; syncState = state.status === 'offline' ? 'offline' : 'loading';
    view = unavailable('Chargement du cache personnel…'); notify();
    const current = generation;
    const repo = repositoryFactory(scope, { onCommit: () => broadcast?.postMessage(nextScope) });
    repository = repo; transport = transportFactory(configuration.client, auth, userId);
    try {
      await refresh(current, repo);
      if (!active(current)) return;
      syncState = state.status === 'offline' ? 'offline' : pending() ? 'pending' : 'local';
      update(document); notify();
      if (state.status === 'authenticated') requestSync(true);
    } catch (error) {
      if (active(current)) { syncState = 'storage-error'; syncError = error.message; view = unavailable(error.message); notify(); }
    }
  }

  function requestSync(pull = false) {
    if (pull) pullVersion++;
    if (stopped || mode !== 'personal' || ['storage-error', 'session'].includes(syncState) || auth.getState().status !== 'authenticated') return;
    cancel(timer); timer = schedule(() => { timer = null; synchronize(); }, 0);
  }
  async function scan(connection, options) {
    // Re-read a complete scan to recover rows that became visible behind a
    // previous cursor. Bounded passes, then periodic complete scans converge.
    let history; let previous = null;
    const sessions = new Map(); const answers = new Map();
    const canonical = value => JSON.stringify(value, (_, item) => isRecord(item)
      ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
    const inconsistent = () => { throw Object.assign(new Error('Les lectures distantes divergent. Le cache précédent est conservé.'), { code: 'protocol' }); };
    for (let pass = 0; pass < 3; pass++) {
      history = await connection.readHistory(options);
      if (!Array.isArray(history?.sessions) || !Array.isArray(history?.answers)) inconsistent();
      for (const row of history.sessions) {
        const prior = sessions.get(row.session_id);
        if (prior?.revision === row.revision && canonical(prior) !== canonical(row)) inconsistent();
        if (!prior || prior.revision < row.revision) sessions.set(row.session_id, row);
      }
      for (const row of history.answers) {
        const prior = answers.get(row.answer_id);
        if (prior && canonical(prior) !== canonical(row)) inconsistent();
        answers.set(row.answer_id, row);
      }
      const key = JSON.stringify(history);
      if (key === previous) break;
      previous = key;
    }
    return { sessions: [...sessions.values()], answers: [...answers.values()] };
  }
  function finishState() {
    syncState = document.conflicts.some(item => !item.resolved) ? 'conflict'
      : document.operations.some(op => op.state === 'error') ? 'error' : pending() ? 'pending' : 'synced';
    syncError = null; update(document);
  }
  async function synchronize() {
    if (currentRun) return currentRun.promise;
    if (stopped || mode !== 'personal' || ['storage-error', 'session'].includes(syncState) || auth.getState().status !== 'authenticated') return;
    const current = generation; const repo = repository; const connection = transport;
    const userId = auth.getState().user?.id;
    if (!repo || !userId) return;
    const abort = new AbortController(); controller = abort;
    const options = { signal: abort.signal, active: () => active(current) };
    const record = { promise: null }; currentRun = record;
    syncState = 'syncing'; syncError = null; notify();
    record.promise = (async () => {
      let operation = null;
      try {
        if (pullVersion > pulledVersion || now() - lastPull >= 60000) {
          const requested = pullVersion;
          const history = await scan(connection, options);
          if (!active(current)) return;
          await repo.change(saved => reconcileHistory(saved, history, userId, new Date(now()).toISOString()), options.active);
          if (!active(current)) return;
          lastPull = now(); pulledVersion = requested;
        }
        for (;;) {
          if (!active(current)) return;
          operation = await repo.change(saved => prepareNextOperation(saved, now()), options.active);
          if (!operation) break;
          const response = await connection.send(operation, options);
          if (!active(current)) return;
          await repo.change(saved => acknowledgeOperation(saved, operation.id, response, userId), options.active);
        }
        if (!active(current)) return;
        await refresh(current, repo);
        if (!active(current)) return;
        failures = 0; finishState();
      } catch (error) {
        if (!active(current)) return;
        const issue = classifyBotanicalError(error);
        syncState = error.code === 'local_storage' ? 'storage-error' : issue.kind === 'session' ? 'session' : issue.kind === 'permanent' ? 'error' : 'offline';
        syncError = error.code === 'local_storage' ? error.message : issue.message;
        if (operation && error.code !== 'local_storage') {
          try {
            await repo.change(saved => {
              const op = saved.operations.find(item => item.id === operation.id && item.state === 'pending');
              if (op) {
                op.failures++; op.retryAt = now() + delayFor(op.failures); op.error = issue.code;
                if (issue.kind === 'permanent') rejectOperation(saved, op.id, issue);
              }
            }, options.active);
          } catch (storageError) { syncState = 'storage-error'; syncError = storageError.message; }
        }
        failures++;
        try { await refresh(current, repo); } catch { /* Keep the last committed view. */ }
        if (active(current) && !['storage-error', 'session', 'error'].includes(syncState)) {
          timer = schedule(() => { timer = null; synchronize(); }, delayFor(failures));
        }
      } finally {
        if (active(current)) {
          if (currentRun === record) currentRun = null;
          notify();
          if (!timer && document && !['storage-error', 'session', 'error', 'offline'].includes(syncState)) {
            const next = prepareNextOperation(clone(document), now());
            const retries = document.operations.filter(op => op.state === 'pending' && op.retryAt > now()).map(op => op.retryAt);
            const delay = pullVersion > pulledVersion || next ? 0 : retries.length ? Math.max(1, Math.min(...retries) - now()) : 60000;
            timer = schedule(() => { timer = null; synchronize(); }, delay);
          }
        }
      }
    })();
    return record.promise;
  }

  function visitorChange(action, value, completedAt) {
    const store = createBotanicalStore(storage);
    let success;
    if (action === 'answer') success = store.recordAnswer(value);
    else if (action === 'session') success = store.recordSession(value);
    else {
      const session = store.load().sessions.find(item => item.id === value);
      if (!session) return { error: 'Cette session n’est pas disponible. Aucun résultat n’a été modifié.' };
      success = store.recordSession({ ...session, completedAt });
    }
    if (!success) return { error: store.status.message || 'Le résultat botanique n’a pas été enregistré.' };
    view = readVisitorHistory(storage); syncState = 'visitor'; syncError = null; notify();
    return { history: clone(view.history), error: null, savedLocally: true };
  }
  function committed(commit, current, pull = false) {
    if (active(current)) {
      // This snapshot is returned by the SAME committed IDB transaction as the
      // result. A second read cannot turn a durable save into a retryable save
      // failure that would obscure the outcome of a durable transaction.
      update(commit.saved); syncState = auth.getState().status === 'offline' ? 'offline' : 'pending';
      syncError = null; notify(); requestSync(pull);
    } else if (!stopped && mode === 'personal' && scope === commit.saved.scope) {
      // An offline transition may invalidate the generation after the commit.
      // Re-read the current same-account cache without revoking that success.
      const resumed = generation; const repo = repository;
      refresh(resumed, repo).then(() => {
        if (active(resumed)) { syncState = auth.getState().status === 'offline' ? 'offline' : 'pending'; notify(); requestSync(pull); }
      }).catch(() => {
        if (active(resumed)) { syncState = 'storage-error'; syncError = 'La progression est enregistrée sur cet appareil, mais sa relecture est indisponible. Actualise pour la retrouver.'; notify(); }
      });
    }
    return mode === 'personal' && scope === commit.saved.scope
      ? { ...commit.result, error: commit.result?.error || null, savedLocally: !commit.result?.error }
      : { error: null, savedLocally: true, accountChanged: true };
  }
  async function change(action, value, completedAt) {
    const intendedGeneration = generation; const intendedScope = scope;
    await ready;
    if (intendedGeneration !== generation || intendedScope !== scope) return { error: 'Le compte a changé pendant le chargement. Aucune action n’a été enregistrée dans le nouveau compte.' };
    if (mode === 'visitor') {
      try { return visitorChange(action, value, completedAt); } catch (error) { return { error: error.message }; }
    }
    if (mode !== 'personal' || view.error) return { error: view.error || syncError || 'La progression personnelle est indisponible.' };
    const current = generation; const repo = repository;
    const beforeSave = syncState; writing();
    try {
      const commit = await repo.change(saved => {
        const result = action === 'session' ? recordPersonalSession(saved, value, randomUUID)
          : action === 'answer' ? recordPersonalAnswer(saved, value, randomUUID)
            : completePersonalSession(saved, value, completedAt, randomUUID);
        return { result, saved: clone(saved) };
      }, () => active(current));
      return committed(commit, current);
    } catch (error) {
      if (active(current)) { syncError = error.message; syncState = error.code === 'local_storage' ? 'storage-error' : beforeSave; notify(); }
      return { error: error.message };
    } finally { wrote(current); }
  }

  function provenance() {
    let id = storage.getItem(IMPORT_PROVENANCE_KEY);
    if (id === null) { id = randomUUID(); storage.setItem(IMPORT_PROVENANCE_KEY, id); }
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new LocalBotanicalError('La provenance de la sauvegarde locale est illisible. Aucun import n’est lancé.');
    return id;
  }
  const service = {
    async start() { await ready; return snapshot(); },
    getState: snapshot,
    subscribe(fn) { subscribers.add(fn); fn(snapshot()); return () => subscribers.delete(fn); },
    createSession: session => change('session', session),
    recordAnswer: answer => change('answer', answer),
    completeSession: (sessionId, completedAt) => change('completion', sessionId, completedAt),
    async previewImport() {
      const intendedGeneration = generation; const intendedScope = scope;
      await ready;
      if (intendedGeneration !== generation || intendedScope !== scope) return { available: false, error: 'Le compte a changé. Prévisualise à nouveau l’import pour ce compte.' };
      if (mode !== 'personal' || view.error) return { available: false, error: view.error || 'Un compte vérifié est nécessaire pour importer.' };
      try {
        const raw = storage.getItem(VISITOR_PROGRESS_KEY);
        return { ...previewLegacyImport(raw), scope, provenance: raw === null ? null : provenance() };
      } catch (error) { return { available: false, error: error.message || 'La sauvegarde locale est inaccessible.' }; }
    },
    async confirmImport(preview) {
      const intendedGeneration = generation; const intendedScope = scope;
      await ready;
      if (intendedGeneration !== generation || intendedScope !== scope) return { error: 'Le compte a changé. Aucun import n’a été créé dans le nouveau compte.' };
      const current = generation; const repo = repository;
      let saving = false;
      if (mode !== 'personal' || view.error || !preview?.available || preview.error || preview.scope !== scope) return { error: 'L’import doit être prévisualisé et confirmé pour ce compte.' };
      try {
        const replay = document.imports.some(manifest => manifest.raw === preview.raw && manifest.provenance === preview.provenance);
        if (!replay) {
          if (auth.getState().status !== 'authenticated') return { error: 'Une connexion est nécessaire pour vérifier l’historique du compte avant un premier import. La sauvegarde locale reste intacte.' };
          const requested = ++pullVersion;
          await synchronize();
          // A run already in progress may have captured an older request.
          if (active(current) && pulledVersion < requested && !['offline', 'session', 'storage-error', 'error'].includes(syncState)) await synchronize();
          if (!active(current)) return { error: 'Le compte a changé. Prévisualise à nouveau la sauvegarde pour ce compte.' };
          if (pulledVersion < requested) return { error: 'L’historique distant n’a pas pu être vérifié. Aucun import nouveau n’est créé ; réessaie après le retour de la connexion.' };
        }
        if (storage.getItem(VISITOR_PROGRESS_KEY) !== preview.raw || provenance() !== preview.provenance) return { error: 'La sauvegarde locale a changé depuis la prévisualisation. Annule puis examine à nouveau son contenu.' };
        writing(); saving = true;
        const commit = await repo.change(saved => {
          const result = applyLegacyImport(saved, { raw: preview.raw, provenance: preview.provenance }, randomUUID);
          return { result, saved: clone(saved) };
        }, () => active(current));
        return committed(commit, current);
      } catch (error) {
        if (active(current)) { syncError = error.message; syncState = error.code === 'local_storage' ? 'storage-error' : document?.conflicts.some(item => !item.resolved) ? 'conflict' : pending() ? 'pending' : 'local'; notify(); }
        return { error: error.message };
      } finally { if (saving) wrote(current); }
    },
    async resolveConflict(id, choice) {
      const intendedGeneration = generation; const intendedScope = scope;
      await ready;
      if (intendedGeneration !== generation || intendedScope !== scope) return { error: 'Le compte a changé. Aucune résolution n’a été créée dans le nouveau compte.' };
      if (mode !== 'personal' || view.error) return { error: 'La progression personnelle doit être disponible pour résoudre un conflit.' };
      const current = generation; const repo = repository;
      const beforeSave = syncState; writing();
      try {
        const commit = await repo.change(saved => {
          const result = resolveConflict(saved, id, choice, randomUUID);
          return { result, saved: clone(saved) };
        }, () => active(current));
        return committed(commit, current, true);
      } catch (error) {
        if (active(current)) { syncState = error.code === 'local_storage' ? 'storage-error' : beforeSave; syncError = error.message; }
        return { error: error.message };
      } finally { wrote(current); }
    },
    async retry() {
      const intendedGeneration = generation; const intendedScope = scope; const intendedUser = auth.getState().user?.id;
      await ready;
      if (intendedGeneration !== generation || intendedScope !== scope) return snapshot();
      if (mode !== 'personal' || ['session', 'offline'].includes(syncState) || auth.getState().status === 'offline') {
        try { await auth.retry(); await ready; } catch { return snapshot(); }
      }
      if (intendedScope && intendedScope !== scope || intendedUser && intendedUser !== auth.getState().user?.id) return snapshot();
      if (mode !== 'personal') return snapshot();
      const current = generation; const repo = repository;
      try {
        cancel(timer); timer = null;
        await refresh(current, repo);
        if (!active(current)) return snapshot();
        syncState = 'local'; update(document);
        await repo.change(saved => { for (const op of saved.operations) if (op.state === 'pending') op.retryAt = 0; }, () => active(current));
        if (!active(current)) return snapshot();
        pullVersion++; await synchronize();
      } catch (error) { if (active(current)) { syncState = 'storage-error'; syncError = 'Le cache personnel ne peut pas être relu. Les données déjà enregistrées sont conservées ; actualise pour réessayer.'; notify(); } }
      return snapshot();
    },
    synchronize,
    stop() { stopped = true; invalidate(); unsubscribe(); unPrivacy(); broadcast?.close(); listeners.forEach(remove => remove()); document = null; scope = null; mode = 'blocked'; view = unavailable('Recharge la page pour vérifier le compte.'); notify(); },
  };
  let privacyPaused = false;
  const unPrivacy = subscribePrivacy(phase => {
    privacyPaused = phase === 'suspend'; invalidate(); document = null; mode = 'blocked';
    view = unavailable('Vérification des caches après une action de confidentialité…'); syncState = 'storage-error'; notify();
    if (!privacyPaused) ready = identity(auth.getState());
  });
  const unsubscribe = auth.subscribe(state => {
    if (privacyPaused) return;
    ready = identity(state).catch(() => {
      invalidate(); mode = 'blocked'; scope = null; document = null; syncState = 'session';
      view = unavailable('L’identité personnelle est indisponible. Aucune donnée privée n’est affichée.'); notify();
    });
  });
  if (broadcast) broadcast.onmessage = event => {
    if (mode !== 'personal' || event.data !== scope) return;
    const current = generation; const repo = repository;
    refresh(current, repo).then(() => { if (active(current)) requestSync(); }).catch(error => {
      if (active(current)) { syncState = 'storage-error'; syncError = error.message; view = unavailable(error.message); notify(); }
    });
  };
  function listen(target, event, fn) { if (target?.addEventListener) { target.addEventListener(event, fn); listeners.push(() => target.removeEventListener(event, fn)); } }
  listen(globalThis.window, 'online', () => service.retry());
  listen(globalThis.window, 'storage', event => { if (mode === 'visitor' && event.key === VISITOR_PROGRESS_KEY) { view = readVisitorHistory(storage); notify(); } });
  listen(globalThis.document, 'visibilitychange', () => { if (!globalThis.document.hidden) requestSync(now() - lastPull >= 60000); });
  return service;
}

let servicePromise;
export function getBotanicalService() {
  if (!servicePromise) servicePromise = (async () => {
    const [auth, configuration] = await Promise.all([getAuthService(), getSupabaseClient().catch(() => ({ client: null, configurationError: 'network' }))]);
    const service = createBotanicalService({ auth, configuration }); await service.start(); return service;
  })();
  return servicePromise;
}

export const getBotanicalSyncService = getBotanicalService;
