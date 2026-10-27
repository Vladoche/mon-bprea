import { personalScope } from './drill-personal-store.js';
import { readScopedRecord } from './personal-idb.js';
import { CACHES, TABLES, VISITOR_SOURCES, MAX_BYTES, fail } from './export-sources.js';
import { envelope, projectLocal, projectVisitor, serializeExport } from './export-model.js';
import { createExportTransport } from './export-transport.js';

const fingerprint = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const codeOf = error => ['future', 'ownership', 'invalid', 'volume', 'blocked'].includes(error?.code) ? error.code : 'unavailable';
export function createExportService({ auth, configuration, readLocal = readScopedRecord, transportFactory = createExportTransport, storage = globalThis.localStorage, now = () => new Date().toISOString() }) {
  // Copy these values once; a caller cannot redirect a running export.
  const config = { environment: configuration.environment, url: configuration.url, client: configuration.client };
  const subscribers = new Set(); let epoch = 0, controller, prepared = null, state = { status: 'idle', coverage: [] }, disposed = false;
  let expected = null;
  const publish = (status, values = {}) => { state = { status, coverage: [], ...values }; for (const cb of subscribers) cb(state); };
  const invalidate = (status = 'cancelled') => { ++epoch; controller?.abort(); controller = null; prepared = null; expected = null; publish(status); };
  const active = (job, id, version) => !disposed && epoch === job && auth.getState().status === 'authenticated' && auth.getState().user?.id === id && auth.getIdentityVersion() === version;
  const unsubscribe = auth.subscribe(() => {
    if (expected && !active(expected.job, expected.id, expected.version)) invalidate('identity');
  });
  async function local(scope, signal) {
    const data = {}, coverage = [];
    for (const [domain, database] of Object.entries(CACHES)) {
      try {
        const record = await readLocal(database, scope, { signal });
        if (signal.aborted) fail('cancelled');
        if (record === null) { coverage.push({ source: database, status: 'absent' }); continue; }
        if (new TextEncoder().encode(JSON.stringify(record)).length > MAX_BYTES) fail('volume');
        const projected = projectLocal(domain, record, scope);
        data[domain] = projected.data;
        coverage.push({ source: database, status: projected.omitted ? 'limited' : 'included', excludedFields: projected.omitted,
          reason: projected.omitted ? 'Archives brutes ou champs hors contrat exclus, sans réécriture de la source.' : null });
      } catch (error) {
        if (signal.aborted) fail('cancelled');
        coverage.push({ source: database, status: codeOf(error) });
      }
    }
    return { data, coverage };
  }
  return {
    subscribe(cb) { subscribers.add(cb); cb(state); return () => subscribers.delete(cb); },
    getState: () => state,
    cancel: () => invalidate(),
    async prepareAccount() {
      invalidate('verifying');
      const job = epoch, id = auth.getState().user?.id, version = auth.getIdentityVersion();
      controller = new AbortController(); const signal = controller.signal;
      expected = { job, id, version };
      try {
        if (!active(job, id, version)) fail('identity');
        const identity = await auth.getExportIdentity();
        if (!active(job, id, version) || identity.id !== id) fail('identity');
        const scope = personalScope({ ...config, userId: id });
        const read = transportFactory(config.client, auth, id);
        let previous, settled;
        for (let pass = 0; pass < 3; pass++) {
          if (!active(job, id, version)) fail('identity');
          publish('reading', { pass: pass + 1 });
          const server = await read({ signal, active: () => active(job, id, version), progress: (source, count) => {
            if (active(job, id, version)) publish('reading', { pass: pass + 1, source, count });
          } });
          const browser = await local(scope, signal);
          if (!active(job, id, version)) fail('identity');
          const candidate = { server, browser };
          const signature = fingerprint(candidate);
          if (signature === previous) { settled = candidate; break; }
          previous = signature;
        }
        if (!settled) fail('unstable');
        publish('validating');
        const finalIdentity = await auth.getExportIdentity();
        if (!active(job, id, version) || finalIdentity.id !== id) fail('identity');
        const coverage = Object.entries(TABLES).map(([name, spec]) => ({ source: name, inventory: spec.inventory, status: 'included', count: settled.server[name].length }));
        coverage.push(...settled.browser.coverage, { source: 'Auth API', inventory: 'A01', status: 'limited', reason: 'Champs identité autorisés seulement. Métadonnées arbitraires, sessions/secrets, journaux et sauvegardes exclus ; procédure de confiance à définir.' });
        prepared = envelope({ kind: 'account', environment: config.environment, supabaseOrigin: new URL(config.url).origin, userId: id },
          { identity: finalIdentity, server: settled.server, personalLocal: settled.browser.data }, coverage, now());
        if (!active(job, id, version)) fail('identity');
        publish('ready', { coverage, exportStatus: prepared.status });
      } catch (error) {
        if (epoch !== job || disposed) return;
        prepared = null;
        publish(['identity', 'invalid_session', 'session_changed'].includes(error?.code) ? 'identity' : signal.aborted ? 'cancelled' : 'incomplete', { reason: ['volume', 'unstable', 'pagination', 'ownership', 'api'].includes(error?.code) ? error.code : 'unavailable' });
      }
    },
    async downloadAccount(deliver) {
      const ticket = expected, file = prepared;
      if (!ticket || !file || !active(ticket.job, ticket.id, ticket.version)) { invalidate('identity'); return false; }
      publish('validating');
      try {
        const verified = await auth.getExportIdentity();
        if (!active(ticket.job, ticket.id, ticket.version) || verified.id !== ticket.id || prepared !== file) fail('identity');
        const json = serializeExport(file);
        // No await between the final generation check and the explicit click.
        if (!active(ticket.job, ticket.id, ticket.version)) fail('identity');
        deliver(json, 'mon-bprea-compte-copie-partielle.json');
        prepared = null; publish('downloaded'); return true;
      } catch {
        if (epoch === ticket.job) invalidate('identity');
        return false;
      }
    },
    inspectDevice() {
      return Object.entries(VISITOR_SOURCES).map(([domain, source]) => {
        try { return { domain, ...source, status: storage.getItem(source.key) === null ? 'absent' : 'present' }; }
        catch { return { domain, ...source, status: 'unavailable' }; }
      });
    },
    prepareDevice(selected) {
      const data = {}, coverage = [];
      for (const domain of new Set(selected)) {
        const source = VISITOR_SOURCES[domain]; if (!source) fail('invalid');
        try {
          const raw = storage.getItem(source.key);
          if (raw === null) { coverage.push({ source: source.key, inventory: source.inventory, status: 'absent' }); continue; }
          if (new TextEncoder().encode(raw).length > MAX_BYTES) fail('volume');
          const value = ['legacyTheme', 'dismissed', 'courseProvenance', 'botanicalProvenance'].includes(domain) ? raw : JSON.parse(raw);
          const result = projectVisitor(domain, value); data[domain] = result.data;
          coverage.push({ source: source.key, inventory: source.inventory, status: result.omitted ? 'limited' : 'included', excludedFields: result.omitted });
        } catch (error) { coverage.push({ source: source.key, inventory: source.inventory, status: codeOf(error) }); }
      }
      return envelope({ kind: 'device', ownership: 'unverified' }, data, coverage, now());
    },
    stop() { disposed = true; unsubscribe(); invalidate(); subscribers.clear(); },
  };
}
