import { CACHES } from './export-sources.js';
import { readScopedSnapshot } from './personal-idb.js';
import { createExportTransport } from './export-transport.js';
import { subscribePrivacy, publishPrivacy } from './privacy-events.js';
import { readRestoreFile, authorizeRestore, canonical, validateServer, failRestore } from './restore-model.js';
import { planRestore, applyActions, summarize } from './restore-plan.js';
import { adapters, restoreRepository, rowKey, sameEntity } from './restore-adapters.js';

const lockName = 'mon-bprea-privacy-v1';
const defaultLock = callback => {
  if (!globalThis.navigator?.locks?.request) failRestore('lock');
  return navigator.locks.request(lockName, { mode: 'exclusive', ifAvailable: true }, lock => {
    if (!lock) failRestore('lock');
    return callback();
  });
};
const reason = error => ['volume', 'json', 'version', 'unattributed', 'ownership', 'environment', 'date', 'uuid', 'duplicate', 'archive', 'coverage', 'coherence', 'changed', 'unstable', 'lock', 'local_storage', 'local_erased'].includes(error?.code) ? error.code : 'unavailable';

export function createRestoreService({ auth, configuration, readLocal = readScopedSnapshot, readFactory = createExportTransport,
  repositoryFactory = restoreRepository, transportFactory = (domain, config, userId) => adapters[domain].transport(config.client, auth, userId),
  withLock = defaultLock, now = () => new Date().toISOString() }) {
  const config = { environment: configuration.environment, url: configuration.url, client: configuration.client };
  const subscribers = new Set();
  let epoch = 0, controller, ticket, prepared, disposed = false, privacyOwned = false, state = { status: 'idle' };
  const publish = (status, values = {}) => { state = { status, ...values }; for (const cb of subscribers) cb(state); };
  const active = t => !!t && !disposed && t.job === epoch && !controller?.signal.aborted && auth.getState().status === 'authenticated' &&
    auth.getState().user?.id === t.id && auth.getIdentityVersion() === t.version;
  const invalidate = (status = 'cancelled') => { ++epoch; controller?.abort(); prepared = null; ticket = null; publish(status); };
  const unsubscribe = auth.subscribe(() => { if (ticket && !active(ticket)) invalidate('identity'); });
  const unPrivacy = subscribePrivacy(() => { if (!privacyOwned) invalidate('interrupted'); });
  const ensure = t => { if (!active(t)) failRestore('identity'); };
  async function identity(t, file) {
    ensure(t); const verified = await auth.getExportIdentity(); ensure(t);
    if (verified.id !== t.id) failRestore('identity');
    return authorizeRestore(file, config, verified);
  }
  async function snapshot(t, scope) {
    const options = { signal: controller.signal, active: () => active(t) }, read = readFactory(config.client, auth, t.id);
    let previous;
    for (let pass = 0; pass < 3; pass++) {
      ensure(t);
      let server = null;
      try { server = await read(options); ensure(t); validateServer(server, t.id); }
      catch (error) { ensure(t); if (['identity', 'ownership', 'invalid_session', 'session_changed'].includes(error?.code)) throw error; server = null; }
      const local = {};
      for (const [domain, database] of Object.entries(CACHES)) {
        try { local[domain] = { status: 'available', ...await readLocal(database, scope, options) }; }
        catch { local[domain] = { status: 'unavailable', document: null, privacy: null }; }
        ensure(t);
      }
      const current = { server, local }, signature = canonical(current);
      if (signature === previous) return current;
      previous = signature;
    }
    failRestore('unstable');
  }
  const preview = plan => ({ summary: summarize(plan.items), coverage: plan.coverage,
    reasons: [...new Set(plan.items.filter(item => ['blocked', 'conflict', 'pending'].includes(item.state)).map(item => item.reason))] });
  const service = {
    getState: () => state,
    subscribe(cb) { subscribers.add(cb); cb(state); return () => subscribers.delete(cb); },
    cancel: () => invalidate(),
    async analyze(selected) {
      if (['reading', 'verifying', 'analyzing', 'applying'].includes(state.status)) return;
      invalidate('reading');
      const t = { job: epoch, id: auth.getState().user?.id, version: auth.getIdentityVersion() };
      ticket = t; controller = new AbortController();
      try {
        ensure(t); const file = await readRestoreFile(selected); ensure(t);
        publish('verifying'); const scope = await identity(t, file); ensure(t);
        publish('analyzing'); const current = await snapshot(t, scope); ensure(t);
        const plan = planRestore(file, current, { scope, userId: t.id, at: now() });
        await identity(t, file); ensure(t);
        prepared = { file, plan, size: selected.size };
        publish('ready', { ...preview(plan), generatedAt: file.generatedAt, size: selected.size, environment: file.sourceScope.environment,
          partialSources: file.status === 'partial' || current.server === null });
      } catch (error) {
        if (epoch !== t.job || disposed) return;
        prepared = null;
        publish(['identity', 'invalid_session', 'session_changed'].includes(error?.code) ? 'identity' : 'invalid', { reason: reason(error) });
      }
    },
    async apply({ confirmed = false } = {}) {
      const t = ticket, job = prepared;
      if (confirmed !== true || state.status !== 'ready' || !job || !active(t)) return false;
      const plan = job.plan;
      if (!plan.summary.total.recoverable) return false;
      publish('applying', preview(plan));
      try {
        await identity(t, job.file); ensure(t);
        await withLock(async () => {
          ensure(t); privacyOwned = true;
          publishPrivacy('suspend');
          try {
            const current = await snapshot(t, plan.scope); ensure(t);
            if (canonical(current) !== canonical(plan.current)) failRestore('changed');
            await identity(t, job.file); ensure(t);
            for (const [domain, target] of Object.entries(plan.domains)) {
              if (!target.actions.length) continue;
              ensure(t); let repo;
              try {
                repo = repositoryFactory(domain, plan.scope);
                let saved = await repo.change(document => {
                  ensure(t);
                  const expected = plan.current.local[domain].document ?? adapters[domain].empty(plan.scope);
                  if (canonical(document) !== canonical(expected)) failRestore('changed');
                  applyActions(document, target.actions, current.server, t.id, plan.at);
                  return structuredClone(document);
                }, () => active(t));
                ensure(t);
                for (const action of target.actions) action.item.state = action.type === 'queue' ? 'pending' : 'local';
                publish('applying', preview(plan));
                const queued = target.actions.filter(action => action.type === 'queue');
                if (queued.length) {
                  const connection = transportFactory(domain, config, t.id);
                  for (let i = 0; i < queued.length; i++) {
                    ensure(t);
                    const commit = await repo.change(document => {
                      if (canonical(document) !== canonical(saved)) failRestore('changed');
                      const operation = adapters[domain].prepare(document);
                      if (operation && !queued.some(action => action.id === operation.id)) failRestore('changed');
                      return { operation, saved: structuredClone(document) };
                    }, () => active(t));
                    saved = commit.saved;
                    if (!commit.operation) break;
                    const response = await connection.send(commit.operation, { signal: controller.signal, active: () => active(t) });
                    ensure(t);
                    saved = await repo.change(document => {
                      if (canonical(document) !== canonical(saved)) failRestore('changed');
                      adapters[domain].acknowledge(document, commit.operation.id, response, t.id);
                      return structuredClone(document);
                    }, () => active(t));
                    ensure(t);
                    const action = queued.find(value => value.id === commit.operation.id);
                    if (saved.operations.find(op => op.id === action.id)?.state === 'conflict' || response.status === 'conflict') {
                      action.item.state = 'conflict'; action.item.reason = 'server_conflict';
                    }
                  }
                  // A successful RPC alone does not claim verified restoration.
                  const checked = await snapshot(t, plan.scope); ensure(t);
                  for (const action of queued) {
                    if (action.item.state === 'conflict') continue;
                    const { name, row } = action.candidate;
                    const live = checked.server?.[name].find(value => rowKey(name, value) === rowKey(name, row));
                    if (live && sameEntity(name, live, row)) { action.item.state = 'server'; action.item.reason = 'confirmed'; }
                    else { action.item.state = 'pending'; action.item.reason = 'unverified'; }
                  }
                }
                // Re-read durable state after the transaction, not a UI cache.
                await repo.read(); ensure(t);
              } catch (error) {
                ensure(t);
                for (const action of target.actions) {
                  if (action.item.state === 'recoverable') { action.item.state = 'blocked'; action.item.reason = reason(error); }
                  else if (action.item.state === 'pending') action.item.reason = reason(error);
                }
              } finally { if (repo) await repo.close().catch(() => {}); }
              ensure(t); publish('applying', preview(plan));
            }
          } finally { publishPrivacy('settled'); privacyOwned = false; }
        });
        ensure(t); prepared = null;
        const summary = summarize(plan.items);
        publish(summary.total.pending || summary.total.conflict || summary.total.blocked ? 'partial' : 'confirmed', preview(plan));
        return true;
      } catch (error) {
        if (epoch !== t.job || disposed) return false;
        prepared = null;
        publish(error?.code === 'changed' ? 'changed' : ['identity', 'invalid_session', 'session_changed'].includes(error?.code) ? 'identity' : 'interrupted',
          { ...preview(plan), reason: reason(error) });
        return false;
      }
    },
    stop() { disposed = true; invalidate('interrupted'); unsubscribe(); unPrivacy(); subscribers.clear(); },
  };
  return service;
}
