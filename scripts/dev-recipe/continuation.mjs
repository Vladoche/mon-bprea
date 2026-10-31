// Filiation privée de la campagne interrompue. Aucun transport HTTP ni secret importé.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, lstatSync, existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { DEV_PROJECT, DEV_API, DEV_SITE, DEV_CALLBACK, MAX_AUTH_REQUESTS, MAX_MUTATIONS,
  TABLES, RPCS, UUID, fail, validateRun } from './contract.mjs';
import { readPrivate, createPrivate, artifactHash } from './private-files.mjs';

export const HISTORY_RUN = 'r654b-20261030-302521a0f692';
export const HISTORY_SHA = '18b0478daf2879c80b5fbb75b2e5bb67993ea112';
const slots = ['invite-A', 'invite-B', 'recovery-A'];
const sources = ['plan.json', 'artifact.json', 'fixtures.json', 'targets.json', 'session-started.json',
  'invite-A.attempt.json', 'auth-request-001.json', 'auth-request-002.json', 'execution-closeout.json',
  'partial-execution-proof.json', 'authorization-A-received.json', 'authorization-B-received.json',
  'bootstrap-resume-authorized.json', 'bootstrap-resume-started.json'];
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const digest = value => createHash('sha256').update(value).digest('hex');
function hashFile(dir, name) {
  const path = join(dir, name), stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 100_000) fail('artifact');
  return digest(readFileSync(path));
}

export function continuationPlan(run, sha) {
  validateRun(run, sha);
  if (run === HISTORY_RUN || sha === HISTORY_SHA) fail('artifact');
  return { version: 2, run, sha, identityRun: HISTORY_RUN, parentSha: HISTORY_SHA,
    project: DEV_PROJECT, api: DEV_API, site: DEV_SITE, callback: DEV_CALLBACK, maxAccounts: 2,
    slots, maxMutations: MAX_MUTATIONS, maxRows: 150, maxAuthRequests: MAX_AUTH_REQUESTS,
    tables: TABLES, rpcs: RPCS, hostedStatus: 'EN ATTENTE D’AUTORISATION R' };
}

export function campaignCounts(dir) {
  const names = readdirSync(dir);
  function count(prefix, max) {
    const selected = names.filter(name => name.startsWith(prefix) && name.endsWith('.json')).sort();
    if (selected.length > max || selected.some((name, i) => name !== `${prefix}${String(i + 1).padStart(3, '0')}.json`)) fail('spent');
    for (const name of selected) readPrivate(dir, name); // Refuse aussi jonction, JSON illisible et fichier anormal.
    return selected.length;
  }
  const attempts = names.filter(name => name.endsWith('.attempt.json'));
  if (attempts.some(name => !slots.includes(name.slice(0, -'.attempt.json'.length)))) fail('spent');
  for (const name of attempts) readPrivate(dir, name);
  return { admin: attempts.length, auth: count('auth-request-', MAX_AUTH_REQUESTS), mutations: count('mutation-', MAX_MUTATIONS) };
}

export function historicalSnapshot(parentDir) {
  const plan = readPrivate(parentDir, 'plan.json'), artifact = readPrivate(parentDir, 'artifact.json');
  const receipt = readPrivate(parentDir, 'invite-A.attempt.json');
  const closeout = readPrivate(parentDir, 'execution-closeout.json');
  const targets = readPrivate(parentDir, 'targets.json');
  if (basename(parentDir) !== HISTORY_RUN || plan.run !== HISTORY_RUN || plan.sha !== HISTORY_SHA
      || plan.version !== 1 || plan.project !== DEV_PROJECT || plan.api !== DEV_API || plan.site !== DEV_SITE
      || plan.callback !== DEV_CALLBACK || plan.maxAccounts !== 2 || plan.maxAuthRequests !== MAX_AUTH_REQUESTS
      || plan.maxMutations !== MAX_MUTATIONS || plan.maxRows !== 150 || !equal(plan.slots, slots)
      || !equal(plan.tables, TABLES) || !equal(plan.rpcs, RPCS)
      || artifact.sha !== HISTORY_SHA || artifact.hash !== artifactHash(parentDir)
      || receipt.status !== 'presented' || !UUID.test(receipt.id || '') || receipt.run !== HISTORY_RUN || receipt.sha !== HISTORY_SHA
      || targets.run !== HISTORY_RUN || targets.sha !== HISTORY_SHA || targets.project !== DEV_PROJECT || targets.syntheticOnly !== true
      || !equal(targets.targets, { A: `mon-bprea-${HISTORY_RUN}-a@example.invalid`, B: `mon-bprea-${HISTORY_RUN}-b@example.invalid` })
      || closeout.project !== DEV_PROJECT || closeout.run !== HISTORY_RUN || closeout.originalSha !== HISTORY_SHA
      || closeout.status !== 'partial-stopped' || closeout.operatorSessionStopped !== true
      || closeout.adminSlots !== 1 || closeout.authBrowserMutations !== 2 || closeout.pedagogicalMutations !== 0
      || closeout.authorizationC !== false || closeout.authorizationD !== false || closeout.hostedCleanup !== false) fail('artifact');
  return { parentRun: HISTORY_RUN, parentSha: HISTORY_SHA,
    inherited: { admin: 1, auth: 2, mutations: 0 },
    sources: Object.fromEntries(sources.map(name => [name, hashFile(parentDir, name)])) };
}

export function reserveContinuation(parentDir, run, sha) {
  continuationPlan(run, sha);
  const snapshot = historicalSnapshot(parentDir);
  if (!equal(campaignCounts(parentDir), snapshot.inherited)) fail('spent');
  // Unique pour toute la campagne, avant construction. Jamais supprimé après panne.
  createPrivate(parentDir, 'continuation-reserved.json', { run, sha, snapshotHash: digest(JSON.stringify(snapshot)) });
  return snapshot;
}

export function validateContinuation({ dir, parentDir, run, sha }) {
  const expected = continuationPlan(run, sha), plan = readPrivate(dir, 'plan.json');
  const lineage = readPrivate(dir, 'lineage.json'), reservation = readPrivate(parentDir, 'continuation-reserved.json');
  const snapshot = historicalSnapshot(parentDir);
  const artifact = readPrivate(dir, 'artifact.json');
  if (!equal(plan, expected) || !equal(lineage, snapshot) || reservation.run !== run || reservation.sha !== sha
      || reservation.snapshotHash !== digest(JSON.stringify(lineage)) || artifact.sha !== sha
      || artifact.hash !== artifactHash(dir) || hashFile(dir, 'fixtures.json') !== snapshot.sources['fixtures.json']) fail('artifact');
  const counts = campaignCounts(parentDir);
  if (counts.admin < 1 || counts.auth < 2 || counts.mutations < 0) fail('spent');
  const owned = new Map([['A', readPrivate(parentDir, 'invite-A.attempt.json').id]]);
  if (existsSync(join(parentDir, 'invite-B.attempt.json'))) {
    const b = readPrivate(parentDir, 'invite-B.attempt.json');
    if (b.status !== 'presented' || !UUID.test(b.id || '') || b.id === owned.get('A') || b.run !== run || b.sha !== sha) fail('uncertain');
    owned.set('B', b.id);
  }
  return { identityRun: HISTORY_RUN, counts, owned };
}

export function startContinuation(options) {
  const state = validateContinuation(options);
  const value = { run: options.run, sha: options.sha, at: new Date().toISOString() };
  // Même après interruption, une seconde instance ne peut pas obtenir ce verrou durable.
  createPrivate(options.parentDir, 'continuation-started.json', value);
  createPrivate(options.dir, 'session-started.json', value);
  return state;
}

export function campaignBudget(parentDir, initial) {
  let counts = { ...initial };
  return {
    get counts() { return { ...counts }; },
    consume(kind) {
      if (!['auth', 'mutations'].includes(kind)) fail('input');
      const actual = campaignCounts(parentDir), max = kind === 'auth' ? MAX_AUTH_REQUESTS : MAX_MUTATIONS;
      if (actual.auth !== counts.auth || actual.mutations !== counts.mutations || actual.admin < counts.admin) fail('spent');
      if (actual[kind] >= max) return false;
      const prefix = kind === 'auth' ? 'auth-request-' : 'mutation-';
      createPrivate(parentDir, `${prefix}${String(actual[kind] + 1).padStart(3, '0')}.json`, { at: new Date().toISOString() });
      counts = { ...actual, [kind]: actual[kind] + 1 };
      return true;
    },
  };
}
