import { it, expect, afterAll, vi } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, rmSync, unlinkSync, realpathSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { createPrivate, readPrivate, artifactHash, reserveSlot } from '../../scripts/dev-recipe/private-files.mjs';
import { HISTORY_RUN, HISTORY_SHA, continuationPlan, reserveContinuation, validateContinuation,
  startContinuation, campaignBudget, campaignCounts } from '../../scripts/dev-recipe/continuation.mjs';
import { DEV_PROJECT, DEV_API, DEV_SITE, DEV_CALLBACK, TABLES, RPCS, syntheticEmail, browserGate } from '../../scripts/dev-recipe/contract.mjs';
import { generateTestLink } from '../../scripts/dev-recipe/generate-test-links.mjs';

const base = resolve('.tmp'); mkdirSync(base, { recursive: true });
const root = mkdtempSync(join(base, 'continuation-test-'));
const run = 'r654b-20261030-aabbcc112233', sha = 'c'.repeat(40);
const A = '10000000-0000-4000-8000-000000000001', B = '10000000-0000-4000-8000-000000000002';
let sequence = 0;
afterAll(() => {
  const actual = realpathSync(root);
  if (actual.startsWith(`${realpathSync(base)}${sep}continuation-test-`)) rmSync(actual, { recursive: true });
});
function fixture() {
  const folder = join(root, String(++sequence)), parentDir = join(folder, HISTORY_RUN), dir = join(folder, run);
  for (const d of [parentDir, dir]) mkdirSync(join(d, 'frontend', 'mon-bprea'), { recursive: true });
  const put = (name, value) => createPrivate(parentDir, name, value);
  const change = (d, name, update) => writeFileSync(join(d, name), JSON.stringify({ ...readPrivate(d, name), ...update }));
  put('plan.json', { version: 1, run: HISTORY_RUN, sha: HISTORY_SHA, project: DEV_PROJECT, api: DEV_API,
    site: DEV_SITE, callback: DEV_CALLBACK, maxAccounts: 2, slots: ['invite-A', 'invite-B', 'recovery-A'],
    maxMutations: 140, maxRows: 150, maxAuthRequests: 60, tables: TABLES, rpcs: RPCS });
  writeFileSync(join(parentDir, 'frontend', 'mon-bprea', 'index.html'), 'historical synthetic frontend');
  put('artifact.json', { sha: HISTORY_SHA, hash: artifactHash(parentDir) });
  put('fixtures.json', { originalOperations: ['10000000-0000-4000-8000-000000000003'] });
  put('targets.json', { project: DEV_PROJECT, run: HISTORY_RUN, sha: HISTORY_SHA, syntheticOnly: true,
    targets: { A: syntheticEmail(HISTORY_RUN, 'A'), B: syntheticEmail(HISTORY_RUN, 'B') } });
  put('invite-A.attempt.json', { status: 'presented', id: A, run: HISTORY_RUN, sha: HISTORY_SHA });
  put('execution-closeout.json', { project: DEV_PROJECT, run: HISTORY_RUN, originalSha: HISTORY_SHA,
    status: 'partial-stopped', operatorSessionStopped: true, adminSlots: 1, authBrowserMutations: 2,
    pedagogicalMutations: 0, authorizationC: false, authorizationD: false, hostedCleanup: false });
  for (const name of ['session-started.json', 'auth-request-001.json', 'auth-request-002.json', 'partial-execution-proof.json',
    'authorization-A-received.json', 'authorization-B-received.json', 'bootstrap-resume-authorized.json', 'bootstrap-resume-started.json']) put(name, { synthetic: true });
  function prepare() {
    const lineage = reserveContinuation(parentDir, run, sha);
    createPrivate(dir, 'plan.json', continuationPlan(run, sha));
    createPrivate(dir, 'lineage.json', lineage);
    createPrivate(dir, 'fixtures.json', readPrivate(parentDir, 'fixtures.json'));
    writeFileSync(join(dir, 'frontend', 'mon-bprea', 'index.html'), 'corrected synthetic frontend');
    createPrivate(dir, 'artifact.json', { sha, hash: artifactHash(dir) });
    return { dir, parentDir, run, sha };
  }
  return { folder, parentDir, dir, change, prepare };
}

it('préserve les preuves octet pour octet, reprend A et les budgets dans un autre artefact sans nouvelle identité', () => {
  const f = fixture(), before = readFileSync(join(f.parentDir, 'artifact.json'));
  const args = f.prepare(), state = startContinuation(args);
  expect(state.identityRun).toBe(HISTORY_RUN); expect([...state.owned]).toEqual([['A', A]]);
  expect(state.counts).toEqual({ admin: 1, auth: 2, mutations: 0 });
  expect(readFileSync(join(f.parentDir, 'artifact.json'))).toEqual(before);
  expect(readPrivate(f.dir, 'plan.json').identityRun).toBe(HISTORY_RUN);
  expect(readPrivate(f.dir, 'lineage.json').sources['invite-A.attempt.json']).toMatch(/^[a-f0-9]{64}$/);
});
it('refuse une seconde préparation ou session concurrente, y compris après interruption', () => {
  const f = fixture(), args = f.prepare();
  expect(() => reserveContinuation(f.parentDir, 'r654b-20261030-112233aabbcc', sha)).toThrow();
  startContinuation(args);
  expect(() => startContinuation(args)).toThrow();
  expect(readPrivate(f.parentDir, 'continuation-started.json').run).toBe(run);
});
it('refuse les SHA incohérents et tout changement d’identité, plafond, provenance ou fixture', () => {
  for (const [name, update] of [['plan.json', { sha: 'd'.repeat(40) }], ['plan.json', { identityRun: run }],
    ['plan.json', { maxAccounts: 3 }], ['lineage.json', { inherited: { admin: 0, auth: 0, mutations: 0 } }],
    ['lineage.json', { callback: `${DEV_CALLBACK}?token_hash=old-sensitive-url` }], ['fixtures.json', { originalOperations: [] }]]) {
    const f = fixture(), args = f.prepare(); f.change(f.dir, name, update);
    expect(() => validateContinuation(args)).toThrow();
  }
  expect(() => continuationPlan(run, HISTORY_SHA)).toThrow();
});
it('refuse un ancien artefact réétiqueté, un frontend altéré ou un reçu parent remplacé', () => {
  for (const mode of ['frontend', 'old-sha', 'parent-id']) {
    const f = fixture(), args = f.prepare();
    if (mode === 'frontend') writeFileSync(join(f.dir, 'frontend', 'mon-bprea', 'index.html'), 'altered');
    if (mode === 'old-sha') f.change(f.dir, 'artifact.json', { sha: HISTORY_SHA });
    if (mode === 'parent-id') f.change(f.parentDir, 'invite-A.attempt.json', { id: B });
    expect(() => validateContinuation(args)).toThrow();
  }
});
it('réserve dans le journal parent dès 003 ; une suppression, un trou ou une remise à zéro bloque l’envoi', () => {
  const f = fixture(), args = f.prepare(), state = startContinuation(args);
  const budget = campaignBudget(f.parentDir, state.counts);
  expect(budget.consume('auth')).toBe(true);
  expect(readPrivate(f.parentDir, 'auth-request-003.json').at).toBeTruthy();
  expect(budget.consume('mutations')).toBe(true);
  unlinkSync(join(f.parentDir, 'auth-request-003.json'));
  expect(() => budget.consume('auth')).toThrow();
  expect(() => startContinuation(args)).toThrow(); // Un crash ne réinitialise pas le budget en mémoire.
  unlinkSync(join(f.parentDir, 'auth-request-001.json'));
  expect(() => validateContinuation(args)).toThrow();
});
it('les consommations héritées réduisent les plafonds globaux et survivent à la relecture', () => {
  const f = fixture(), args = f.prepare();
  // Journal synthétique déjà proche des bornes : vérifier les frontières sans 200 scans identiques.
  for (const [prefix, first, last] of [['auth-request-', 3, 59], ['mutation-', 1, 139]])
    for (let i = first; i <= last; i++) writeFileSync(join(f.parentDir, `${prefix}${String(i).padStart(3, '0')}.json`), '{}');
  const state = startContinuation(args), budget = campaignBudget(f.parentDir, state.counts);
  expect(budget.consume('auth')).toBe(true);
  expect(budget.consume('auth')).toBe(false);
  expect(budget.consume('mutations')).toBe(true);
  expect(budget.consume('mutations')).toBe(false);
  expect(campaignCounts(f.parentDir)).toEqual({ admin: 1, auth: 60, mutations: 140 });
});
it('bloque une troisième identité/créneau et toute réinvitation A avant le transport', async () => {
  const f = fixture(); f.prepare();
  const args = linkArgs(f, 'invite', 'A'), admin = args.makeAdmin;
  await expect(generateTestLink(args)).rejects.toThrow(); expect(admin).not.toHaveBeenCalled();
  await expect(generateTestLink({ ...args, actor: 'C' })).rejects.toThrow();
  reserveSlot(f.parentDir, 'invite-C');
  expect(() => campaignCounts(f.parentDir)).toThrow();
});
function linkArgs(f, type = 'invite', actor = 'B') {
  const now = Date.parse('2026-10-30T12:00:00Z');
  const email = syntheticEmail(HISTORY_RUN, actor), id = actor === 'A' ? A : B;
  const token = 'synthetic-new-token-654c-only';
  const response = { data: { user: { id, email }, properties: { verification_type: type, redirect_to: DEV_CALLBACK,
    hashed_token: token, action_link: `${DEV_API}/auth/v1/verify?redirect_to=${encodeURIComponent(DEV_CALLBACK)}&token=${token}&type=${type}` } } };
  return { env: { MON_BPREA_DEV_PROJECT: DEV_PROJECT, MON_BPREA_DEV_URL: DEV_API, MON_BPREA_DEV_SITE: DEV_SITE,
    MON_BPREA_DEV_ADMIN_KEY: 'sb_secret_synthetic_fixture_only' }, run, sha, identityRun: HISTORY_RUN, type, actor,
    now: () => now, proof: { project: DEV_PROJECT, run, sha, name: 'Mon BPREA DEV', region: 'eu-west-1', plan: 'free',
      status: 'ACTIVE_HEALTHY', callback: DEV_CALLBACK, checkedAt: new Date(now).toISOString(),
      schemaAndPrivilegesReviewed: true, authAndDataApiReviewed: true, protectionAccepted: true, absent: { A: true, B: true }, present: { A: true } },
    previous: { 'invite-A': readPrivate(f.parentDir, 'invite-A.attempt.json') },
    confirmA: async () => true, confirmB: async () => true, reserve: name => reserveSlot(f.parentDir, name),
    record: vi.fn(), present: vi.fn(), makeAdmin: vi.fn(() => ({ generateLink: vi.fn(async () => response),
      getUserById: vi.fn(async () => ({ data: { user: { id: A, email, email_confirmed_at: new Date(now).toISOString() } } })) })) };
}
it('invite B et recovery A conservent les seules identités historiques ; une perte de remise consomme le créneau', async () => {
  const f = fixture(); f.prepare();
  const b = linkArgs(f); b.present.mockRejectedValue(new Error('synthetic interruption'));
  await expect(generateTestLink(b)).rejects.toThrow();
  expect(campaignCounts(f.parentDir).admin).toBe(2);
  await expect(generateTestLink(b)).rejects.toThrow(); // Même avec une lecture previous périmée : réservation exclusive.
  const a = linkArgs(f, 'recovery', 'A'); await generateTestLink(a);
  expect(a.record.mock.calls[0][1].id).toBe(A);
  expect(campaignCounts(f.parentDir).admin).toBe(3);
  expect(readPrivate(f.parentDir, 'invite-A.attempt.json').sha).toBe(HISTORY_SHA);
});
it('une continuation vierge n’autorise aucun ancien token, compte tiers ou champ Auth supplémentaire', () => {
  const gate = browserGate({ getIds: () => [A], getEmails: () => [syntheticEmail(HISTORY_RUN, 'A')],
    mayVerify: () => false, mayWrite: () => false, consumeAuth: vi.fn(), consumeMutation: vi.fn(), publicKey: 'sb_publishable_synthetic_fixture_only' });
  expect(gate({ url: `${DEV_API}/auth/v1/verify`, method: 'POST', headers: { apikey: 'sb_publishable_synthetic_fixture_only' },
    body: JSON.stringify({ type: 'invite', token_hash: 'old-sensitive-url-token' }) })).toBe(false);
});
