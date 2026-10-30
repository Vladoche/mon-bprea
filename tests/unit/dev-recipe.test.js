import { it, expect, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { DEV_PROJECT, DEV_API, DEV_SITE, DEV_CALLBACK, MAX_MUTATIONS, validateEnvironment, validatePreflight,
  syntheticEmail, operationSlot, publicConfiguration, boundedAdminFetch, browserGate, safeMessage } from '../../scripts/dev-recipe/contract.mjs';
import { generateTestLink } from '../../scripts/dev-recipe/generate-test-links.mjs';

const run = 'r654b-20261029-012345abcdef', sha = 'a'.repeat(40), at = Date.parse('2026-10-29T20:00:00Z');
const A = '10000000-0000-4000-8000-000000000001', B = '10000000-0000-4000-8000-000000000002';
const email = syntheticEmail(run, 'A'), key = 'sb_publishable_synthetic_fixture_only';
const environment = () => ({ MON_BPREA_DEV_PROJECT: DEV_PROJECT, MON_BPREA_DEV_URL: DEV_API,
  MON_BPREA_DEV_SITE: DEV_SITE, MON_BPREA_DEV_ADMIN_KEY: 'sb_secret_synthetic_fixture_only' });
const proof = () => ({ project: DEV_PROJECT, run, sha, name: 'Mon BPREA DEV', region: 'eu-west-1', plan: 'free',
  status: 'ACTIVE_HEALTHY', callback: DEV_CALLBACK, checkedAt: new Date(at).toISOString(),
  schemaAndPrivilegesReviewed: true, authAndDataApiReviewed: true, protectionAccepted: true, absent: { A: true, B: true }, present: { A: true } });
function response(type = 'invite') {
  const token = 'synthetic-not-a-real-token-000000000';
  const action = new URL(`${DEV_API}/auth/v1/verify`);
  action.searchParams.set('type', type); action.searchParams.set('token', token); action.searchParams.set('redirect_to', DEV_CALLBACK);
  return { data: { user: { id: A, email }, properties: { verification_type: type, redirect_to: DEV_CALLBACK,
    hashed_token: token, action_link: action.href } }, error: null };
}
function fixture() {
  const generated = vi.fn(async () => response()), lookup = vi.fn(async () => ({ data: { user: { id: A, email, email_confirmed_at: new Date(at).toISOString() } } }));
  const args = { env: environment(), run, sha, proof: proof(), type: 'invite', actor: 'A', now: () => at,
    confirmA: vi.fn(async () => true), confirmB: vi.fn(async () => true), reserve: vi.fn(async () => {}),
    record: vi.fn(async () => {}), present: vi.fn(async () => {}), makeAdmin: vi.fn(() => ({ generateLink: generated, getUserById: lookup })) };
  return { args, generated, lookup };
}

it('refuse PROD, toute autre cible, les normalisations URL et les arguments hors slots', () => {
  for (const url of ['https://oqoqrxwfbkhtpksqimgd.supabase.co', 'https://other.supabase.co', `${DEV_API}/`,
    `${DEV_API}:443`, `${DEV_API}#`, `${DEV_API}?`, DEV_API.replace('https://', 'https://@'), `${DEV_API}.evil.invalid`]) {
    expect(() => validateEnvironment({ ...environment(), MON_BPREA_DEV_URL: url })).toThrow();
  }
  expect(() => validateEnvironment({ ...environment(), MON_BPREA_DEV_PROJECT: 'other' })).toThrow();
  expect(() => validateEnvironment({ ...environment(), MON_BPREA_DEV_SITE: DEV_SITE.replace('127.0.0.1', 'localhost') })).toThrow();
  for (const pair of [['signup', 'A'], ['invite', 'C'], ['recovery', 'B'], ['--force', 'A']]) expect(() => operationSlot(...pair)).toThrow();
  expect(syntheticEmail(run, 'B')).not.toBe(email);
  expect(() => syntheticEmail('historical-user', 'A')).toThrow();
});
it('la configuration frontend ne contient que les cinq champs publics et une clé publishable', () => {
  expect(Object.keys(publicConfiguration(key)).sort()).toEqual(['enabled', 'environment', 'publishableKey', 'siteUrl', 'url']);
  expect(() => publicConfiguration(environment().MON_BPREA_DEV_ADMIN_KEY)).toThrow();
});
it('préflight expiré, incomplet, futur ou relatif à une autre tête ne permet aucun appel', async () => {
  for (const change of [{ checkedAt: new Date(at - 300_001).toISOString() }, { checkedAt: new Date(at + 1).toISOString() },
    { sha: 'b'.repeat(40) }, { protectionAccepted: false }, { absent: { A: false, B: true } }, { callback: 'https://other.invalid' }]) {
    const f = fixture(); Object.assign(f.args.proof, change);
    await expect(generateTestLink(f.args)).rejects.toThrow(); expect(f.args.makeAdmin).not.toHaveBeenCalled(); expect(f.args.reserve).not.toHaveBeenCalled();
  }
  expect(() => validatePreflight(proof(), run, sha, at)).not.toThrow();
});
it('A et B sont indépendants, sans secret ni appel administratif avant les deux accords', async () => {
  for (const phase of ['confirmA', 'confirmB']) {
    const f = fixture(); f.args[phase] = async () => false;
    await expect(generateTestLink(f.args)).rejects.toThrow(); expect(f.args.makeAdmin).not.toHaveBeenCalled(); expect(f.args.reserve).not.toHaveBeenCalled();
  }
});
it('un préflight expirant pendant la confirmation est refusé avant réservation/appel', async () => {
  const f = fixture(); let now = at; f.args.now = () => now; f.args.confirmB = async () => { now += 300_001; return true; };
  await expect(generateTestLink(f.args)).rejects.toThrow(); expect(f.args.makeAdmin).not.toHaveBeenCalled();
});
it('réserve durablement avant generateLink ; remet le seul callback en mémoire, sans secret retourné ou enregistré', async () => {
  const f = fixture(); const order = [];
  f.args.reserve = async () => order.push('reserve'); f.generated.mockImplementation(async () => { order.push('generate'); return response(); });
  const result = await generateTestLink(f.args);
  expect(order).toEqual(['reserve', 'generate']); expect(result).toEqual({ status: 'presented', actor: 'A', type: 'invite' });
  expect(f.generated).toHaveBeenCalledExactlyOnceWith({ type: 'invite', email, options: { redirectTo: DEV_CALLBACK } });
  expect(f.args.present.mock.calls[0][0]).toContain(`${DEV_CALLBACK}?token_hash=`);
  expect(JSON.stringify(f.args.record.mock.calls)).not.toMatch(/hashed_token|token_hash|action_link|synthetic-not/);
  expect(f.lookup).not.toHaveBeenCalled();
});
it('un créneau déjà réservé et une panne de réservation bloquent toute nouvelle génération', async () => {
  for (const mode of ['spent', 'reservation']) {
    const f = fixture();
    if (mode === 'spent') f.args.previous = { 'invite-A': { status: 'uncertain' } };
    else f.args.reserve = async () => { throw new Error('synthetic disk failure'); };
    await expect(generateTestLink(f.args)).rejects.toThrow(); expect(f.generated).not.toHaveBeenCalled();
  }
});
it('une perte d’acquittement ou de remise reste incertaine et ne répète jamais generateLink', async () => {
  for (const mode of ['network', 'delivery', 'partial', 'wrong-user', 'redirect']) {
    const f = fixture();
    if (mode === 'network') f.generated.mockRejectedValue(new Error('private-body-secret'));
    if (mode === 'delivery') f.args.present = async () => { throw new Error('private-token-secret'); };
    if (mode === 'partial') f.generated.mockResolvedValue({ data: { user: { id: A, email } } });
    if (mode === 'wrong-user') { const value = response(); value.data.user.email = 'wrong@example.invalid'; f.generated.mockResolvedValue(value); }
    if (mode === 'redirect') { const value = response(); value.data.properties.action_link += '&redirect_to=https://other.invalid'; f.generated.mockResolvedValue(value); }
    const error = await generateTestLink(f.args).catch(e => e);
    expect(error.code).toBe('uncertain'); expect(safeMessage(error)).not.toMatch(/private-body|private-token|synthetic-not/);
    expect(f.generated).toHaveBeenCalledTimes(1);
  }
});
it('recovery exige le seul UUID A effectivement reçu et une confirmation Auth ciblée', async () => {
  const f = fixture(); Object.assign(f.args, { type: 'recovery', previous: { 'invite-A': { status: 'presented', id: A } } });
  f.generated.mockResolvedValue(response('recovery')); await generateTestLink(f.args);
  expect(f.lookup).toHaveBeenCalledExactlyOnceWith(A);
  const bad = fixture(); Object.assign(bad.args, { type: 'recovery', previous: { 'invite-A': { status: 'generated', id: A } } });
  await expect(generateTestLink(bad.args)).rejects.toThrow(); expect(bad.generated).not.toHaveBeenCalled();
});
it('le vrai SDK installé traverse le transport strict : query redirect_to, corps redirectTo et réponse native', async () => {
  const value = response(), sent = [];
  const fetcher = vi.fn(async (url, options) => {
    sent.push({ url, body: JSON.parse(options.body), redirect: options.redirect });
    return new Response(JSON.stringify({ ...value.data.user, ...value.data.properties }), { headers: { 'content-type': 'application/json' } });
  });
  const admin = createClient(DEV_API, environment().MON_BPREA_DEV_ADMIN_KEY, { auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: boundedAdminFetch({ type: 'invite', email, fetcher }) } }).auth.admin;
  const result = await admin.generateLink({ type: 'invite', email, options: { redirectTo: DEV_CALLBACK } });
  expect(result.error).toBeNull(); expect(result.data.user.id).toBe(A);
  expect(sent[0].body).toEqual({ type: 'invite', email, redirectTo: DEV_CALLBACK }); expect(sent[0].redirect).toBe('error');
  expect((await admin.generateLink({ type: 'invite', email, options: { redirectTo: DEV_CALLBACK } })).error).toBeTruthy();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('aucune liste utilisateur, suppression, redirection ou opération administrative libre dans le transport', async () => {
  for (const [url, method, body] of [[`${DEV_API}/auth/v1/admin/users`, 'GET'], [`${DEV_API}/auth/v1/admin/users/${A}`, 'DELETE'],
    ['https://oqoqrxwfbkhtpksqimgd.supabase.co/auth/v1/admin/generate_link', 'POST', '{}'],
    [`${DEV_API}/auth/v1/admin/generate_link`, 'POST', JSON.stringify({ type: 'invite', email, password: 'fixture' })]]) {
    const fetcher = vi.fn(); await expect(boundedAdminFetch({ type: 'invite', email, fetcher })(url, { method, body })).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  }
});
it('le navigateur bloque les écritures sans C, les comptes historiques, les cibles externes et le dépassement du budget', () => {
  let write = false, count = 0;
  const gate = browserGate({ getIds: () => [A, B], getEmails: () => [email], mayWrite: () => write, publicKey: key,
    mayVerify: () => false,
    consumeAuth: () => true,
    consumeMutation: () => count < MAX_MUTATIONS && ++count <= MAX_MUTATIONS });
  const jwt = `eyJheader.${Buffer.from(JSON.stringify({ sub: A, role: 'authenticated' })).toString('base64url')}.synthetic`;
  const request = { url: `${DEV_API}/rest/v1/rpc/personal_record_quiz`, method: 'POST', body: '{}', headers: { apikey: key, authorization: `Bearer ${jwt}` } };
  expect(gate(request)).toBe(false); write = true;
  for (let i = 0; i < MAX_MUTATIONS; i++) expect(gate(request)).toBe(true);
  expect(gate(request)).toBe(false); expect(count).toBe(MAX_MUTATIONS);
  expect(gate({ ...request, method: 'DELETE' })).toBe(false);
  expect(gate({ ...request, method: 'GET', url: 'https://other.invalid/data' })).toBe(false);
  expect(gate({ ...request, method: 'GET', url: `${DEV_API}/rest/v1/profiles`, headers: { apikey: key, authorization: 'Bearer sb_secret_fixture' } })).toBe(false);
  expect(gate({ ...request, url: `${DEV_API}/auth/v1/signup` })).toBe(false);
  expect(gate({ ...request, url: `${DEV_API}/auth/v1/token?grant_type=password`, body: '{"email":"historical@example.invalid"}' })).toBe(false);
});
it('V atteint PostgREST, et les jetons de liens étrangers restent bloqués avant verifyOtp', () => {
  let authCalls = 0;
  const gate = browserGate({ getIds: () => [A], getEmails: () => [email], mayWrite: () => false, publicKey: key,
    mayVerify: ({ token_hash }) => token_hash === 'synthetic-run-token', consumeAuth: () => ++authCalls <= 2, consumeMutation: () => false });
  const request = { method: 'GET', url: `${DEV_API}/rest/v1/profiles`, headers: { apikey: key } };
  expect(gate(request)).toBe(true); // Le refus anon devra être celui de Supabase.
  const verify = token => gate({ ...request, method: 'POST', url: `${DEV_API}/auth/v1/verify`, body: JSON.stringify({ type: 'invite', token_hash: token }) });
  expect(verify('foreign-token')).toBe(false); expect(authCalls).toBe(0);
  expect(verify('synthetic-run-token')).toBe(true); expect(verify('synthetic-run-token')).toBe(true);
  expect(verify('synthetic-run-token')).toBe(false);
});
