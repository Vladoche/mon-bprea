import { getAuthService } from './auth-service.js';
import { getSupabaseClient } from './supabase-client.js';
import { createSettingsRepository, personalScope } from './settings-store.js';
import { clone, domains, equal, validateValue, validateAppearance, queueSettings, prepareSettingsOperation, acknowledgeSettings, reconcileSettings, resolveSettingsConflict, LocalSettingsError, SettingsSyncError, valueFromRow } from './settings-model.js';
import { createSettingsTransport, classifySettingsError } from './settings-transport.js';
import { delayFor } from './sync-runtime.js';
export const VISITOR_ITK_KEY = 'bprea-demo-itk-v1';
export const VISITOR_APPEARANCE_KEY = 'bprea-demo-appearance-v1';
export const LEGACY_THEME_KEY = 'bprea-demo-theme-v1';
const sourceKey = domain => domain === 'itk' ? VISITOR_ITK_KEY : VISITOR_APPEARANCE_KEY;
const unavailable = error => ({ itk: null, appearance: null, error });
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function broadcastChannel() { try { return globalThis.BroadcastChannel ? new BroadcastChannel('mon-bprea-settings-personal-v1') : null; } catch { return null; } }
export function readSettingsSource(domain, storage = globalThis.localStorage) {
  let raw; let source = sourceKey(domain);
  try {
    raw = storage.getItem(source);
    if (domain === 'appearance' && raw === null) {
      source = LEGACY_THEME_KEY; raw = storage.getItem(source);
      if (['light', 'dark'].includes(raw)) return { raw, source, value: { version: 1, season: 'auto', brightness: raw }, error: null };
    }
    if (raw === null) return { raw, source, value: null, error: 'Aucun choix local à importer.' };
    let parsed; try { parsed = JSON.parse(raw); } catch { return { raw, source, value: null, error: 'Le document local est illisible. Il est conservé sans modification.' }; }
    let value = parsed;
    if (domain === 'appearance' && record(parsed)) {
      value = { version: parsed.version, season: parsed.season, brightness: parsed.brightness, ...(Object.hasOwn(parsed, 'updatedAt') ? { updatedAt: parsed.updatedAt } : {}) };
    }
    if (!validateValue(domain, value)) return { raw, source, value: null, error: domain === 'itk' ? 'Les paramètres locaux sont invalides pour le catalogue et les années 2026 à 2033. La source reste intacte.' : 'Les préférences locales sont inconnues ou invalides. Le document et ses archives restent intacts.' };
    return { raw, source, value, error: null };
  } catch { return { raw: null, source, value: null, error: 'Le stockage local est inaccessible.' }; }
}
export function createSettingsService({ auth, configuration, repositoryFactory = createSettingsRepository, transportFactory = createSettingsTransport,
  storage = globalThis.localStorage, now = () => Date.now(), randomUUID = () => globalThis.crypto.randomUUID(), schedule = setTimeout, cancel = clearTimeout, broadcast = broadcastChannel() } = {}) {
  let mode = 'blocked'; let scope = null; let document = null; let repository = null; let transport = null;
  let view = unavailable('Vérification du compte…'); let state = 'loading'; let error = null; let generation = 0; let stopped = false;
  let ready; let running = null; let controller; let timer; let writes = 0; let lastStatus; let pullVersion = 1; let pulledVersion = 0; let lastPull = 0; let failures = 0; let localVersion = 0;
  const subscribers = new Set(); const listeners = [];
  const active = current => !stopped && current === generation && mode === 'personal';
  const pending = domain => document?.operations.filter(op => op.state === 'pending' && (!domain || op.domain === domain)).length || 0;
  const reliable = saved => !!saved && (!!saved.lastReconciledAt || saved.operations.length > 0 || domains.some(domain => saved.values[domain] !== null));
  function domainState(domain) {
    if (mode !== 'personal' || view.error) return state;
    if (document.conflicts.some(item => item.domain === domain && !item.resolved)) return 'conflict';
    if (document.operations.some(op => op.domain === domain && op.state === 'error')) return 'error';
    if (['offline', 'storage-error', 'session'].includes(state)) return state;
    if (pending(domain)) return state === 'syncing' ? 'syncing' : 'pending';
    return document.lastReconciledAt ? 'synced' : 'local';
  }
  function snapshot() {
    const visible = mode === 'personal' && !view.error;
    return { mode, scope, view: clone(view), sync: { state: writes ? 'saving' : state, error, pending: visible ? pending() : 0,
      conflicts: visible ? clone(document.conflicts) : [], domains: Object.fromEntries(domains.map(domain => [domain, { state: writes ? 'saving' : domainState(domain), pending: visible ? pending(domain) : 0, revision: visible ? document.remote[domain]?.revision || 0 : null }])),
      imports: visible ? document.imports.map(proof => ({ id: proof.id, domain: proof.domain })) : [] } };
  }
  const notify = () => { const value = snapshot(); subscribers.forEach(fn => fn(value)); };
  function update(saved) {
    document = saved;
    view = reliable(saved) ? { ...clone(saved.values), error: null } : unavailable(state === 'offline' ? 'Aucun cache personnel fiable disponible hors ligne.' : error || 'Chargement des paramètres personnels…');
    if (state === 'session') view = unavailable('L’identité doit être vérifiée à nouveau. Les paramètres privés sont masqués.');
  }
  async function refresh(current = generation, repo = repository) { const version = localVersion; const saved = await repo.read(); if (active(current) && version === localVersion) { update(saved); notify(); } }
  function invalidate() { generation++; writes = 0; controller?.abort(); cancel(timer); timer = null; running = null; }
  function visitorView() { return { itk: readSettingsSource('itk', storage).value, appearance: readSettingsSource('appearance', storage).value, error: null }; }
  async function identity(authState) {
    const previous = lastStatus; lastStatus = authState.status;
    const userId = ['authenticated', 'offline'].includes(authState.status) ? authState.user?.id : null;
    const next = userId && configuration.client ? personalScope({ ...configuration, userId }) : null;
    if (next && scope === next && mode === 'personal') {
      if (authState.status === 'offline') { invalidate(); state = 'offline'; if (document) update(document); notify(); }
      else if (previous === 'offline' || state === 'session') { state = 'pending'; if (document) update(document); notify(); requestSync(true); }
      return;
    }
    invalidate(); scope = next; document = null; repository = null; transport = null; error = null; failures = 0; lastPull = 0; pullVersion = 1; pulledVersion = 0;
    if (!userId || !next) {
      const visitor = authState.status === 'anonymous' || authState.status === 'unavailable' && configuration.configurationError !== 'network';
      mode = visitor ? 'visitor' : 'blocked'; state = visitor ? 'visitor' : 'session'; view = visitor ? visitorView() : unavailable(authState.error || 'Identité indisponible. Aucune donnée privée affichée.'); notify(); return;
    }
    mode = 'personal'; state = authState.status === 'offline' ? 'offline' : 'loading'; view = unavailable('Chargement du cache personnel…'); notify();
    const current = generation; repository = repositoryFactory(scope, { onCommit: () => broadcast?.postMessage(next) }); transport = transportFactory(configuration.client, auth, userId);
    try { await refresh(current, repository); if (!active(current)) return; state = authState.status === 'offline' ? 'offline' : pending() ? 'pending' : 'local'; update(document); notify(); if (authState.status === 'authenticated') requestSync(true); }
    catch (issue) { if (active(current)) { state = 'storage-error'; error = issue.message; view = unavailable(error); notify(); } }
  }
  function requestSync(pull = false) {
    if (pull) pullVersion++;
    if (stopped || mode !== 'personal' || ['session', 'storage-error'].includes(state) || auth.getState().status !== 'authenticated') return;
    cancel(timer); timer = schedule(() => { timer = null; synchronize(); }, 0);
  }
  function finish() { state = document.conflicts.some(item => !item.resolved) ? 'conflict' : document.operations.some(op => op.state === 'error') ? 'error' : pending() ? 'pending' : 'synced'; update(document); }
  async function synchronize() {
    if (running) return running.promise;
    if (stopped || mode !== 'personal' || ['session', 'storage-error'].includes(state) || auth.getState().status !== 'authenticated') return;
    const current = generation; const repo = repository; const connection = transport; const userId = auth.getState().user?.id;
    if (!repo || !userId) return;
    controller = new AbortController(); const options = { signal: controller.signal, active: () => active(current) };
    const run = { promise: null }; running = run; state = 'syncing'; error = null; notify();
    run.promise = (async () => {
      let operation = null;
      try {
        if (pullVersion > pulledVersion || now() - lastPull >= 60000) {
          const requested = pullVersion; const remote = await connection.readSettings(options);
          if (!active(current)) return;
          await repo.change(saved => reconcileSettings(saved, remote, userId, new Date(now()).toISOString()), options.active);
          if (!active(current)) return; pulledVersion = requested; lastPull = now();
        }
        for (;;) {
          operation = await repo.change(saved => prepareSettingsOperation(saved, now()), options.active);
          if (!active(current) || !operation) break;
          try {
            const response = await connection.send(operation, options);
            if (!active(current)) return;
            await repo.change(saved => acknowledgeSettings(saved, operation.id, response, userId), options.active);
          } catch (issue) {
            if (!active(current)) return;
            const classified = classifySettingsError(issue);
            if (issue.code === 'local_storage' || classified.kind !== 'permanent') throw issue;
            // One invalid domain does not stop another domain's durable outbox.
            error = classified.message;
            await repo.change(saved => { const op = saved.operations.find(item => item.id === operation.id && item.state === 'pending'); if (op) { op.state = 'error'; op.error = classified.code; op.failures++; } }, options.active);
          }
        }
        if (!active(current)) return;
        await refresh(current, repo); if (!active(current)) return; failures = 0; finish();
      } catch (issue) {
        if (!active(current)) return;
        const classified = classifySettingsError(issue);
        state = issue.code === 'local_storage' ? 'storage-error' : classified.kind === 'session' ? 'session' : classified.kind === 'permanent' ? 'error' : 'offline';
        error = issue.code === 'local_storage' ? issue.message : classified.message;
        if (operation && issue.code !== 'local_storage') try {
          await repo.change(saved => { const op = saved.operations.find(item => item.id === operation.id && item.state === 'pending'); if (op) { op.failures++; op.retryAt = now() + delayFor(op.failures); op.error = classified.code; if (classified.kind === 'permanent') op.state = 'error'; } }, options.active);
        } catch (storageIssue) { state = 'storage-error'; error = storageIssue.message; }
        failures++; try { await refresh(current, repo); } catch (storageIssue) { state = 'storage-error'; error = storageIssue.message; }
      } finally {
        if (active(current)) {
          if (running === run) running = null; notify();
          if (!timer && !['session', 'storage-error'].includes(state)) {
            const due = document?.operations.filter(op => op.state === 'pending' && op.retryAt > now()).map(op => op.retryAt) || [];
            const next = document ? prepareSettingsOperation(clone(document), now()) : null;
            const delay = state === 'offline' ? delayFor(failures) : pullVersion > pulledVersion || next ? 0 : due.length ? Math.max(1, Math.min(...due) - now()) : 60000;
            timer = schedule(() => { timer = null; synchronize(); }, delay);
          }
        }
      }
    })(); return run.promise;
  }
  function committed(commit, current) {
    if (mode === 'personal' && scope === commit.saved.scope) localVersion++;
    if (active(current)) { update(commit.saved); state = auth.getState().status === 'offline' ? 'offline' : 'pending'; error = null; notify(); requestSync(); }
    else if (mode === 'personal' && scope === commit.saved.scope) { const resumed = generation; refresh(resumed, repository).then(() => { if (active(resumed)) requestSync(); }).catch(issue => { if (active(resumed)) { state = 'storage-error'; error = issue.message; notify(); } }); }
    return mode === 'personal' && scope === commit.saved.scope ? { ...commit.result, error: null, savedLocally: true } : { error: null, savedLocally: true, accountChanged: true };
  }
  async function localChange(change) {
    const intended = generation; const intendedScope = scope; await ready;
    if (intended !== generation || intendedScope !== scope) return { error: 'Le compte a changé. Aucune action enregistrée dans le nouveau compte.' };
    if (mode !== 'personal' || view.error || state === 'storage-error') return { error: view.error || error || 'Le stockage personnel est indisponible.' };
    const current = generation; const repo = repository; const before = state; writes++; notify();
    try { const commit = await repo.change(saved => ({ result: change(saved), saved: clone(saved) }), () => active(current)); return committed(commit, current); }
    catch (issue) { if (active(current)) { state = issue.code === 'local_storage' ? 'storage-error' : before; error = issue.message; notify(); } return { error: issue.message }; }
    finally { if (active(current)) { writes = Math.max(0, writes - 1); notify(); } }
  }
  async function freshPull(current) {
    if (auth.getState().status !== 'authenticated') throw new SettingsSyncError('offline', 'Une connexion est nécessaire pour vérifier la version du compte.');
    const requested = ++pullVersion; await synchronize();
    if (active(current) && pulledVersion < requested && !['offline', 'session', 'storage-error'].includes(state)) await synchronize();
    if (!active(current)) throw new SettingsSyncError('session_changed', 'Le compte a changé. Examine à nouveau les paramètres.');
    if (pulledVersion < requested) throw new SettingsSyncError('offline', 'La version du compte n’a pas pu être vérifiée. Aucun import nouveau n’a été créé.');
  }
  const service = {
    async start() { await ready; return snapshot(); }, getState: snapshot,
    subscribe(fn) { subscribers.add(fn); fn(snapshot()); return () => subscribers.delete(fn); },
    async save(domain, value) {
      if (!domains.includes(domain) || !validateValue(domain, value)) return { error: 'Les paramètres sont invalides. La sauvegarde source reste intacte.' };
      const intended = generation; await ready; if (intended !== generation) return { error: 'Le compte a changé pendant le chargement.' };
      if (mode !== 'visitor') return localChange(saved => queueSettings(saved, domain, value, randomUUID));
      try {
        let next = value;
        if (domain === 'appearance') {
          const raw = storage.getItem(VISITOR_APPEARANCE_KEY); let previous; try { previous = JSON.parse(raw); } catch { /* Archive below. */ }
          next = validateAppearance(previous) ? { ...previous, ...value } : { ...value, ...(raw !== null ? { unrecognizedPreferencesArchive: [...(Array.isArray(previous?.unrecognizedPreferencesArchive) ? previous.unrecognizedPreferencesArchive : []), raw] } : {}) };
        }
        storage.setItem(sourceKey(domain), JSON.stringify(next)); view = visitorView(); notify(); return { value: clone(value), error: null, savedLocally: true };
      } catch { return { error: 'Les paramètres ne sont pas enregistrés : le stockage local est inaccessible ou plein.' }; }
    },
    async previewImport(domain) {
      const intended = generation; const intendedScope = scope; await ready;
      if (intended !== generation || intendedScope !== scope || mode !== 'personal' || !domains.includes(domain)) return { available: false, error: 'Un compte vérifié est nécessaire. Examine à nouveau les paramètres pour ce compte.' };
      const source = readSettingsSource(domain, storage);
      if (source.error) return { ...source, domain, available: false };
      try { await freshPull(intended); return { ...source, domain, available: true, scope, remote: clone(document.remote[domain]), divergent: !!document.remote[domain] && !equal(source.value, valueFromRow(domain, document.remote[domain])) }; }
      catch (issue) { return { ...source, domain, available: false, error: issue.message }; }
    },
    async confirmImport(preview) {
      const intended = generation; const intendedScope = scope; await ready;
      if (intended !== generation || intendedScope !== scope || mode !== 'personal' || !preview?.available || preview.error || preview.scope !== scope || !validateValue(preview.domain, preview.value)) return { error: 'L’import doit être examiné et confirmé pour ce compte.' };
      try {
        const source = readSettingsSource(preview.domain, storage);
        if (source.raw !== preview.raw || source.source !== preview.source || !equal(source.value, preview.value)) return { error: 'La source locale a changé. Examine à nouveau les paramètres avant de confirmer.' };
        const proof = document.imports.find(item => item.domain === preview.domain && item.raw === preview.raw && item.source === preview.source);
        if (proof) return { error: null, replayed: true, operationId: proof.operationId, savedLocally: true };
        await freshPull(intended);
        if (!equal(preview.remote, document.remote[preview.domain])) return { error: 'La version du compte a changé depuis l’aperçu. Examine à nouveau les deux versions avant de confirmer.' };
        return localChange(saved => {
          const checkedSource = readSettingsSource(preview.domain, storage);
          if (checkedSource.raw !== preview.raw || checkedSource.source !== preview.source || !equal(checkedSource.value, preview.value)) throw new SettingsSyncError('import', 'La source locale a changé. Examine à nouveau les paramètres avant de confirmer.');
          if (!equal(saved.remote[preview.domain], preview.remote)) throw new SettingsSyncError('import', 'La version du compte a changé. Examine à nouveau les deux versions avant de confirmer.');
          const replay = saved.imports.find(item => item.domain === preview.domain && item.raw === preview.raw && item.source === preview.source);
          if (replay) return { replayed: true, operationId: replay.operationId };
          const result = queueSettings(saved, preview.domain, preview.value, randomUUID);
          saved.imports = saved.imports.filter(item => item.domain !== preview.domain);
          saved.imports.push({ id: randomUUID(), domain: preview.domain, source: preview.source, raw: preview.raw, value: clone(preview.value), operationId: result.operationId });
          return result;
        });
      } catch (issue) { return { error: issue.message }; }
    },
    async resolve(id, choice) {
      const intended = generation; const intendedScope = scope; await ready;
      if (intended !== generation || intendedScope !== scope || mode !== 'personal') return { error: 'Le compte a changé. Aucune résolution enregistrée.' };
      try { await freshPull(intended); return localChange(saved => resolveSettingsConflict(saved, id, choice, randomUUID)); }
      catch (issue) { return { error: issue.message }; }
    },
    async retry() {
      const intendedScope = scope; const intendedUser = auth.getState().user?.id; await ready;
      if (['session', 'offline'].includes(state) || mode !== 'personal') { try { await auth.retry(); await ready; } catch { return snapshot(); } }
      if (intendedScope && intendedScope !== scope || intendedUser && intendedUser !== auth.getState().user?.id || mode !== 'personal') return snapshot();
      const current = generation;
      try {
        // A preceding failure must finish persisting its retry deadline before
        // this deliberate retry clears it. Never race the old catch/finally.
        const previousRun = running?.promise;
        if (previousRun) await previousRun;
        if (!active(current) || intendedScope && intendedScope !== scope || intendedUser && intendedUser !== auth.getState().user?.id) return snapshot();
        cancel(timer); timer = null; await refresh(current, repository); if (!active(current)) return snapshot();
        if (auth.getState().status !== 'authenticated') { state = 'offline'; update(document); notify(); return snapshot(); }
        state = 'local'; update(document);
        await repository.change(saved => { for (const op of saved.operations) if (op.state === 'pending') op.retryAt = 0; }, () => active(current));
        pullVersion++; await synchronize();
      } catch (issue) { if (active(current)) { state = 'storage-error'; error = issue.message; notify(); } }
      return snapshot();
    },
    synchronize, syncNow: synchronize,
    stop() { stopped = true; invalidate(); unsubscribe(); broadcast?.close(); listeners.forEach(fn => fn()); document = null; scope = null; mode = 'blocked'; view = unavailable('Recharge la page pour vérifier le compte.'); notify(); },
  };
  const unsubscribe = auth.subscribe(authState => { ready = identity(authState).catch(() => { invalidate(); mode = 'blocked'; scope = null; document = null; state = 'session'; view = unavailable('L’identité personnelle est indisponible.'); notify(); }); });
  if (broadcast) broadcast.onmessage = event => { if (mode === 'personal' && event.data === scope) { const current = generation; refresh(current, repository).then(() => { if (active(current)) requestSync(); }).catch(issue => { if (active(current)) { state = 'storage-error'; error = issue.message; view = unavailable(error); notify(); } }); } };
  const listen = (target, event, fn) => { if (target?.addEventListener) { target.addEventListener(event, fn); listeners.push(() => target.removeEventListener(event, fn)); } };
  listen(globalThis.window, 'online', () => service.retry());
  listen(globalThis.window, 'storage', event => { if (mode === 'visitor' && [VISITOR_ITK_KEY, VISITOR_APPEARANCE_KEY, LEGACY_THEME_KEY].includes(event.key)) { view = visitorView(); notify(); } });
  listen(globalThis.document, 'visibilitychange', () => { if (!globalThis.document.hidden) requestSync(now() - lastPull >= 60000); });
  return service;
}
let servicePromise;
export function getSettingsService() {
  if (!servicePromise) servicePromise = (async () => {
    const [auth, configuration] = await Promise.all([getAuthService(), getSupabaseClient().catch(() => ({ client: null, configurationError: 'network' }))]);
    const service = createSettingsService({ auth, configuration }); await service.start();
    if (configuration.client) {
      globalThis.window?.addEventListener('pagehide', () => service.stop(), { once: true });
      globalThis.window?.addEventListener('pageshow', event => { if (event.persisted) globalThis.window.location.reload(); });
    }
    return service;
  })();
  return servicePromise;
}
