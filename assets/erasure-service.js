import { personalScope, validatePersonalDocument } from './drill-personal-store.js';
import { validatePersonalDocument as validateCourses } from './course-quiz-model.js';
import { validatePersonalDocument as validateBotanical } from './botanical-sync-model.js';
import { validateSettingsDocument } from './settings-model.js';
import { readScopedRecord } from './personal-idb.js';
import { changeErasureScope } from './erasure-store.js';
import { CACHES, VISITOR_SOURCES } from './export-sources.js';
import { publishPrivacy } from './privacy-events.js';

export const PERSONAL_ERASURE = Object.freeze({ drill: 'Exercices Drill', courses: 'Cours et QCM', botanical: 'Botanique', itk: 'Paramètres ITK', appearance: 'Apparence' });
const error = code => Object.assign(new Error(code), { code });
const validators = { drill: validatePersonalDocument, courses: validateCourses, botanical: validateBotanical, settings: validateSettingsDocument };
const settingsKeys = 'version,scope,values,remote,operations,conflicts,imports,archives,archivedCount,lastReconciledAt'.split(',');
export async function privacyLock(run) {
  if (!globalThis.navigator?.locks) throw error('locking');
  return navigator.locks.request('mon-bprea-privacy-v1', { ifAvailable: true }, lock => { if (!lock) throw error('locking'); return run(); });
}
function settingsSubset(document, selected) {
  if (!document) return null;
  if (Object.keys(document).some(key => !settingsKeys.includes(key)) || document.archivedCount > 0 ||
    [document.values, document.remote].some(value => Object.keys(value).some(key => !['itk', 'appearance'].includes(key)))) throw error('unknown');
  const next = structuredClone(document);
  for (const domain of selected) { next.values[domain] = null; next.remote[domain] = null; }
  for (const field of ['operations', 'conflicts', 'imports', 'archives']) next[field] = next[field].filter(item => {
    const domain = item.domain ?? item.operation?.domain ?? item.conflict?.domain;
    if (!['itk', 'appearance'].includes(domain)) throw error('unknown');
    return !selected.includes(domain);
  });
  // The shared reconciliation timestamp is invalid after a selective removal.
  next.lastReconciledAt = null;
  validateSettingsDocument(next, next.scope);
  return next;
}
export function createErasureService({ auth, configuration, storage = globalThis.localStorage,
  indexedDB = globalThis.indexedDB, readLocal = readScopedRecord, changeLocal = changeErasureScope,
  exclusive = privacyLock } = {}) {
  const config = { environment: configuration.environment, url: configuration.url };
  let plan, generation = 0, stopped = false;
  const current = (id, version) => !stopped && auth.getState().status === 'authenticated' && auth.getState().user?.id === id && auth.getIdentityVersion() === version;
  const unsubscribe = auth.subscribe(() => { if (plan?.id && !current(plan.id, plan.version)) { generation++; plan = null; } });
  async function identity(id, version) {
    try {
      if (!current(id, version) || (await auth.getExportIdentity()).id !== id || !current(id, version)) throw error('identity');
    } catch { throw error('identity'); }
  }
  const service = {
    cancel() { generation++; plan = null; },
    async prepare({ personal = [], visitor = [] } = {}) {
      service.cancel(); const job = generation;
      const domains = [...new Set(personal)], device = [...new Set(visitor)];
      if (!domains.length && !device.length || domains.some(key => !Object.hasOwn(PERSONAL_ERASURE, key)) || device.some(key => !Object.hasOwn(VISITOR_SOURCES, key))) throw error('selection');
      const id = domains.length ? auth.getState().user?.id : null, version = auth.getIdentityVersion();
      if (id) await identity(id, version); else if (domains.length) throw error('identity');
      const scope = id ? personalScope({ ...config, userId: id }) : null;
      const groups = new Map(), summary = [];
      for (const domain of domains) {
        const group = ['itk', 'appearance'].includes(domain) ? 'settings' : domain;
        if (!groups.has(group)) groups.set(group, { group, domains: [], database: CACHES[group] });
        groups.get(group).domains.push(domain);
      }
      for (const group of groups.values()) {
        const record = await readLocal(group.database, scope, { indexedDB });
        if (record) { try { validators[group.group](record, scope); } catch { throw error('unknown'); } }
        group.expected = JSON.stringify(record);
        if (group.group === 'settings' && group.domains.length === 1) settingsSubset(record, group.domains);
        const operations = record?.operations ?? [];
        const selectedOps = group.group === 'settings' ? operations.filter(op => group.domains.includes(op.domain)) : operations;
        summary.push({ source: group.domains.map(key => PERSONAL_ERASURE[key]).join(' / '),
          present: record !== null, pending: selectedOps.filter(op => op.state !== 'confirmed').length,
          details: 'Brouillons, conflits, archives, imports et copies distantes du cache sélectionné seront retirés. Les données uniquement locales ne sont pas récupérables sur le serveur.' +
            (group.group === 'settings' && group.domains.length === 1 ? ' Le cache partagé des paramètres sera suspendu, y compris l’autre domaine, qui reste conservé.' : '') });
      }
      const visitorRecords = device.map(domain => {
        const source = VISITOR_SOURCES[domain], raw = storage.getItem(source.key);
        summary.push({ source: `Visiteur : ${source.label}`, present: raw !== null, pending: null,
          details: domain.includes('Provenance') ? 'Retirer ce marqueur change la reconnaissance d’un futur import ; les copies déjà importées restent dans leur compte.' : 'Sauvegarde sans propriétaire vérifié. Les copies déjà importées et les autres appareils restent distincts.' });
        return { domain, key: source.key, raw };
      });
      if (job !== generation || id && !current(id, version)) throw error('identity');
      plan = { id, version, scope, groups: [...groups.values()], visitorRecords, job };
      return summary;
    },
    async execute({ confirmed = false } = {}) {
      const ticket = plan;
      if (!confirmed || !ticket || ticket.job !== generation) throw error('confirmation');
      return exclusive(async () => {
        if (ticket.id) await identity(ticket.id, ticket.version);
        if (plan !== ticket) throw error('identity');
        publishPrivacy('suspend');
        const results = [];
        try {
          for (const group of ticket.groups) {
            try {
              const result = await changeLocal(group.database, ticket.scope, { indexedDB,
                active: () => plan === ticket && current(ticket.id, ticket.version), expected: group.expected,
                transform: group.group === 'settings' && group.domains.length === 1 ? record => settingsSubset(record, group.domains) : undefined });
              results.push({ source: group.domains.join(' / '), kind: 'personal', ...result });
            } catch (issue) { results.push({ source: group.domains.join(' / '), kind: 'personal', status: 'failed', reason: issue.code || 'unavailable' }); }
          }
          for (const source of ticket.visitorRecords) {
            try {
              if (plan !== ticket || ticket.id && !current(ticket.id, ticket.version)) throw error('identity');
              if (storage.getItem(source.key) !== source.raw) throw error('changed');
              storage.removeItem(source.key);
              if (storage.getItem(source.key) !== null) throw error('unavailable');
              results.push({ source: source.domain, kind: 'visitor', status: source.raw === null ? 'absent' : 'erased' });
            } catch (issue) { results.push({ source: source.domain, kind: 'visitor', status: 'failed', reason: issue.code || 'unavailable' }); }
          }
        } finally { plan = null; generation++; publishPrivacy('settled'); }
        const failed = results.filter(item => item.status === 'failed').length;
        return { status: failed === 0 ? 'complete' : failed === results.length ? 'failed' : 'partial', results };
      });
    },
    async resume() {
      const id = auth.getState().user?.id, version = auth.getIdentityVersion(); await identity(id, version);
      const scope = personalScope({ ...config, userId: id });
      return exclusive(async () => {
        publishPrivacy('suspend'); const results = [];
        try {
          for (const database of Object.values(CACHES)) {
            try { results.push(await changeLocal(database, scope, { indexedDB, resume: true, active: () => current(id, version) })); }
            catch (issue) { results.push({ status: 'failed', reason: issue.code || 'unavailable' }); }
          }
          return results.every(item => item.status !== 'failed');
        } finally { publishPrivacy('settled'); }
      });
    },
    stop() { stopped = true; unsubscribe(); service.cancel(); },
  };
  return service;
}
