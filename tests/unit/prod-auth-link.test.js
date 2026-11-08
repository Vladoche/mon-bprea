import { describe, expect, it, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  PROD_API, PROD_CALLBACK, PROD_PROJECT, PROD_SITE, parseOperation, prodAdminFetch,
  safeProdMessage, validateProdCallback, validateProdEnvironment, validateProdTarget,
} from '../../scripts/prod-auth/environment.mjs';
import {
  buildProdManualLink, checkProdConfiguration, createProdLinkAdmin, generateProdAuthLink, inspectProdAccounts,
} from '../../scripts/prod-auth/generator.mjs';

// Valeurs entièrement fictives : les transports de ces tests ne touchent aucun projet.
const email = 'titulaire-synthetique@example.test';
const key = 'sb_secret_synthetic_fixture_not_a_real_administrative_key';
const token = 'synthetic_token_without_any_auth_capability';
const runtime = { isNode: true, nodeMajor: 24, stdinTTY: true, stdoutTTY: true, hasBrowser: false };
const env = { SUPABASE_PROD_PROJECT_REF: PROD_PROJECT, SUPABASE_PROD_URL: PROD_API,
  SUPABASE_PROD_SITE_URL: PROD_SITE, SUPABASE_PROD_ADMIN_KEY: key, SUPABASE_PROD_PRIVATE_DIR: '/synthetic-private-operator',
  SUPABASE_PROD_OPERATOR_EMAIL: 'operator@example.test' };
const user = { id: '11111111-1111-4111-8111-111111111111', email, email_confirmed_at: '2026-11-01T10:00:00Z' };
const settings = { disable_signup: true, mailer_autoconfirm: false, external: { email: true, anonymous_users: false, phone: false } };
const response = (type = 'invite') => {
  const action = new URL(`${PROD_API}/auth/v1/verify`);
  action.searchParams.set('token', token); action.searchParams.set('type', type); action.searchParams.set('redirect_to', PROD_CALLBACK);
  return { user: { ...user }, properties: { verification_type: type, hashed_token: token,
    redirect_to: PROD_CALLBACK, action_link: action.href } };
};
function fixture(type = 'invite', users = []) {
  const admin = { getSettings: vi.fn().mockResolvedValue(settings), listUsers: vi.fn().mockResolvedValue({ data: { users }, error: null }),
    generateLink: vi.fn().mockResolvedValue({ data: response(type), error: null }) };
  let unresolved = false;
  const store = { withLock: vi.fn(action => action()), read: vi.fn(async () => unresolved),
    reserve: vi.fn(async () => { unresolved = true; return 'synthetic-operation'; }),
    markDelivered: vi.fn(async () => { unresolved = false; }) };
  const options = { env, runtime, type, email, store, makeAdmin: vi.fn(() => admin),
    confirm: vi.fn(async () => `CONFIRMER PROD ${type} ${email}`), deliver: vi.fn() };
  return { options, admin, store, run: () => generateProdAuthLink(options) };
}
const otherUsers = count => Array.from({ length: count }, (_, index) => ({
  id: `11111111-1111-4111-8111-${String(index + 2).padStart(12, '0')}`,
  email: index === 0 ? 'operator@example.test' : `pending-${index}@example.test`, email_confirmed_at: null,
}));

describe('administration PROD : refus avant toute écriture et confirmation individuelle', () => {
  it('exige Node 24, terminal privé, sans navigateur, CI ni instrumentation', async () => {
    for (const invalidRuntime of [{ ...runtime, isNode: false }, { ...runtime, nodeMajor: 22 },
      { ...runtime, stdinTTY: false }, { ...runtime, stdoutTTY: false }, { ...runtime, hasBrowser: true }]) {
      const f = fixture(); f.options.runtime = invalidRuntime;
      await expect(f.run()).rejects.toMatchObject({ code: 'interactive' });
      expect(f.options.makeAdmin).not.toHaveBeenCalled(); expect(f.store.withLock).not.toHaveBeenCalled();
    }
    for (const name of ['CI', 'GITHUB_ACTIONS', 'GITLAB_CI', 'TF_BUILD', 'DEBUG', 'NODE_DEBUG', 'NODE_OPTIONS',
      'NODE_V8_COVERAGE', 'NODE_EXTRA_CA_CERTS', 'NODE_TLS_REJECT_UNAUTHORIZED', 'NODE_USE_ENV_PROXY', 'HTTP_PROXY', 'https_proxy', 'ALL_PROXY']) {
      expect(() => validateProdEnvironment({ ...env, [name]: 'synthetic' }, runtime)).toThrow();
    }
  });

  it('refuse une cible autre que le projet PROD et les URL HTTPS exactes', async () => {
    for (const invalid of [{ SUPABASE_PROD_PROJECT_REF: 'wcckbyhrtroittbfophv' },
      { SUPABASE_PROD_PROJECT_REF: '' }, { SUPABASE_PROD_URL: 'http://127.0.0.1:54321' },
      { SUPABASE_PROD_URL: 'https://wcckbyhrtroittbfophv.supabase.co' }, { SUPABASE_PROD_URL: `${PROD_API}/` },
      { SUPABASE_PROD_URL: `${PROD_API}:443` }, { SUPABASE_PROD_URL: `${PROD_API}/../` },
      { SUPABASE_PROD_URL: `${PROD_API}?` }, { SUPABASE_PROD_URL: `${PROD_API}#` },
      { SUPABASE_PROD_SITE_URL: 'http://localhost:4173/mon-bprea/' }, { SUPABASE_PROD_SITE_URL: `${PROD_SITE}?` }]) {
      const f = fixture(); f.options.env = { ...env, ...invalid };
      await expect(f.run()).rejects.toMatchObject({ code: 'environment' });
      expect(f.options.makeAdmin).not.toHaveBeenCalled(); expect(f.admin.generateLink).not.toHaveBeenCalled();
    }
  });

  it('refuse clés publiques, legacy et absentes, sans les sérialiser', () => {
    for (const value of ['', undefined, 'sb_publishable_synthetic_public_key', 'eyJ.synthetic.jwt', 'sb_secret_short', `${key}\n`]) {
      expect(() => validateProdEnvironment({ ...env, SUPABASE_PROD_ADMIN_KEY: value }, runtime)).toThrow();
    }
    expect(validateProdEnvironment(env, runtime)).toMatchObject({ url: PROD_API, siteUrl: PROD_SITE });
    expect(() => validateProdEnvironment({ ...env, SUPABASE_PROD_PRIVATE_DIR: '' }, runtime)).toThrow();
    expect(safeProdMessage(new Error(`${key} ${token}`))).not.toMatch(/sb_secret_|synthetic_token/);
  });

  it('autorise seulement check, invite ou recovery, sans batch, --yes ni arguments secrets', () => {
    for (const type of ['check', 'invite', 'recovery']) expect(parseOperation([type])).toBe(type);
    for (const args of [[], ['signup'], ['invite', '--yes'], ['--yes'], ['invite', email], ['invite', key, token], ['invite', 'recovery']])
      expect(() => parseOperation(args)).toThrow();
    for (const address of ['a@example.test,b@example.test', 'Nom <a@example.test>', 'a\n@example.test', 'a\x1b@example.test', '', 'a@localhost', 'a..b@example.test'])
      expect(() => validateProdTarget('invite', address)).toThrow();
    expect(validateProdTarget('invite', ` ${email.toUpperCase()} `)).toBe(email);
    expect(() => validateProdTarget('magiclink', email)).toThrow();
  });

  it('le contrôle de configuration reste en lecture seule et ne retourne aucune donnée personnelle', async () => {
    const f = fixture('invite', otherUsers(2));
    expect(await checkProdConfiguration(f.options)).toEqual({ project: PROD_PROJECT, status: 'checked-read-only',
      accounts: 2, capacity: 7, callback: PROD_CALLBACK, operatorPlaceReserved: false, authSettingsChecked: true });
    expect(f.admin.generateLink).not.toHaveBeenCalled(); expect(f.store.reserve).not.toHaveBeenCalled();
    expect(f.options.deliver).not.toHaveBeenCalled();
  });

  it('compte les invitations en attente et refuse une huitième invitation', async () => {
    const full = fixture('invite', otherUsers(7));
    await expect(full.run()).rejects.toMatchObject({ code: 'capacity' });
    expect(full.options.confirm).not.toHaveBeenCalled(); expect(full.admin.generateLink).not.toHaveBeenCalled();
    const last = fixture('invite', otherUsers(6));
    expect(await last.run()).toMatchObject({ accountsBefore: 6, status: 'delivered-private' });
    const exceeded = fixture('recovery', [user, ...otherUsers(7)]);
    await expect(exceeded.run()).rejects.toMatchObject({ code: 'capacity' });
    expect(exceeded.admin.generateLink).not.toHaveBeenCalled();
  });

  it('un compte existant, même en attente, ne reçoit aucune nouvelle invitation', async () => {
    for (const account of [user, { ...user, email_confirmed_at: null }]) {
      const f = fixture('invite', [account]);
      await expect(f.run()).rejects.toMatchObject({ code: 'exists' });
      expect(f.admin.generateLink).not.toHaveBeenCalled(); expect(f.store.reserve).not.toHaveBeenCalled();
    }
  });

  it('réserve la septième place à l’exploitant quand six autres comptes sont déjà présents', async () => {
    const f = fixture('invite', otherUsers(6).map((account, index) => ({ ...account, email: `other-${index}@example.test` })));
    await expect(f.run()).rejects.toMatchObject({ code: 'capacity' });
    expect(f.admin.generateLink).not.toHaveBeenCalled();
    f.options.env = { ...env, SUPABASE_PROD_OPERATOR_EMAIL: email };
    expect(await f.run()).toMatchObject({ accountsBefore: 6, status: 'delivered-private' });
  });

  it('une modification de l’inventaire pendant la confirmation bloque toute génération', async () => {
    const f = fixture();
    f.admin.listUsers.mockResolvedValueOnce({ data: { users: [] } })
      .mockResolvedValueOnce({ data: { users: otherUsers(1) } });
    await expect(f.run()).rejects.toMatchObject({ code: 'lookup' });
    expect(f.store.reserve).not.toHaveBeenCalled(); expect(f.admin.generateLink).not.toHaveBeenCalled();
  });

  it('refuse de générer si les inscriptions ou un fournisseur autonome sont actifs', async () => {
    for (const actual of [null, {}, { ...settings, disable_signup: false }, { ...settings, mailer_autoconfirm: true },
      { ...settings, external: { email: false, anonymous_users: false } },
      { ...settings, external: { email: true, anonymous_users: true } },
      { ...settings, external: { email: true, anonymous_users: false, github: true } }]) {
      const f = fixture(); f.admin.getSettings.mockResolvedValue(actual);
      await expect(f.run()).rejects.toMatchObject({ code: 'configuration' });
      expect(f.admin.generateLink).not.toHaveBeenCalled(); expect(f.store.reserve).not.toHaveBeenCalled();
    }
  });

  it('revérifie la fermeture des inscriptions après la confirmation humaine', async () => {
    const f = fixture();
    f.admin.getSettings.mockResolvedValueOnce(settings).mockResolvedValueOnce({ ...settings, disable_signup: false });
    await expect(f.run()).rejects.toMatchObject({ code: 'configuration' });
    expect(f.options.confirm).toHaveBeenCalledOnce(); expect(f.admin.generateLink).not.toHaveBeenCalled();
  });

  it('la récupération exige un compte confirmé et reste possible à sept comptes', async () => {
    for (const users of [[], [{ ...user, email_confirmed_at: null }], [{ ...user, email_confirmed_at: 'invalid' }]]) {
      const f = fixture('recovery', users);
      await expect(f.run()).rejects.toMatchObject({ code: 'missing' }); expect(f.admin.generateLink).not.toHaveBeenCalled();
    }
    const f = fixture('recovery', [user, ...otherUsers(6)]);
    expect(await f.run()).toMatchObject({ type: 'recovery', accountsBefore: 7 });
  });

  it('un inventaire incomplet, ambigu ou indisponible bloque la génération', async () => {
    for (const users of [null, [{ id: 'invalid', email }], [user, { ...user }],
      [user, { ...otherUsers(1)[0], email: email.toUpperCase() }], [{ ...user, email: 'malformed' }]]) {
      const f = fixture(); f.admin.listUsers.mockResolvedValue({ data: { users }, error: null });
      await expect(f.run()).rejects.toMatchObject({ code: 'lookup' }); expect(f.admin.generateLink).not.toHaveBeenCalled();
    }
    const f = fixture(); f.admin.listUsers.mockRejectedValue(new Error(`${key} ${token}`));
    await expect(f.run()).rejects.toMatchObject({ code: 'lookup' }); expect(f.options.deliver).not.toHaveBeenCalled();
    await expect(inspectProdAccounts({ listUsers: async () => ({ error: new Error('synthetic') }) })).rejects.toMatchObject({ code: 'lookup' });
  });

  it('exige la confirmation exacte de cette opération et de cette adresse avant réserve ou génération', async () => {
    for (const confirmation of [true, false, 'CONFIRMER PROD invite', `CONFIRMER PROD recovery ${email}`,
      'CONFIRMER PROD invite autre@example.test', `CONFIRMER PROD invite ${email}\n`]) {
      const f = fixture(); f.options.confirm.mockResolvedValue(confirmation);
      await expect(f.run()).rejects.toMatchObject({ code: 'confirmation' });
      expect(f.admin.generateLink).not.toHaveBeenCalled(); expect(f.store.reserve).not.toHaveBeenCalled();
    }
  });

  it.each(['invite', 'recovery'])('génère %s une seule fois, sans rôle ni mot de passe et livre seulement en privé', async type => {
    const f = fixture(type, type === 'recovery' ? [user] : []);
    const events = [];
    f.store.reserve.mockImplementation(async () => { events.push('reserved'); return 'synthetic-operation'; });
    f.admin.generateLink.mockImplementation(async () => { events.push('generated'); return { data: response(type) }; });
    f.options.deliver.mockImplementation(async () => { events.push('delivered'); });
    const result = await f.run();
    expect(events).toEqual(['reserved', 'generated', 'delivered']);
    expect(f.admin.generateLink).toHaveBeenCalledExactlyOnceWith({ type, email, options: { redirectTo: PROD_CALLBACK } });
    expect(f.options.deliver).toHaveBeenCalledExactlyOnceWith(buildProdManualLink(response(type), { type, email }),
      { operationId: 'synthetic-operation', type });
    expect(JSON.stringify(result)).not.toContain(token); expect(JSON.stringify(result)).not.toContain(email);
    expect(f.store.markDelivered).toHaveBeenCalledExactlyOnceWith(email, 'synthetic-operation');
  });

  it('une réservation non acquittée bloque aussi une nouvelle invocation de récupération', async () => {
    const f = fixture('recovery', [user]);
    f.admin.generateLink.mockRejectedValue(new Error(`${key} ${token}`));
    await expect(f.run()).rejects.toMatchObject({ code: 'uncertain' });
    await expect(f.run()).rejects.toMatchObject({ code: 'pending' });
    expect(f.admin.generateLink).toHaveBeenCalledTimes(1); expect(f.store.markDelivered).not.toHaveBeenCalled();
  });

  it('réponse partielle, erreur fournisseur ou échec de remise restent incertains, sans retry ni fuite', async () => {
    for (const phase of ['partial', 'provider', 'delivery', 'acknowledgement']) {
      const f = fixture();
      if (phase === 'partial') f.admin.generateLink.mockResolvedValue({ data: { user } });
      if (phase === 'provider') f.admin.generateLink.mockResolvedValue({ error: new Error(`${key} ${token}`) });
      if (phase === 'delivery') f.options.deliver.mockRejectedValue(new Error(`${key} ${token}`));
      if (phase === 'acknowledgement') f.store.markDelivered.mockRejectedValue(new Error(`${key} ${token}`));
      const error = await f.run().catch(error => error);
      expect(error).toMatchObject({ code: 'uncertain' }); expect(f.admin.generateLink).toHaveBeenCalledTimes(1);
      expect(safeProdMessage(error)).not.toContain(key); expect(safeProdMessage(error)).not.toContain(token);
      expect(safeProdMessage(error)).toContain('Ne pas relancer');
    }
  });
});

describe('administration PROD : validation du lien et verrou du transport', () => {
  it.each(['invite', 'recovery'])('le SDK verrouillé respecte le transport pour %s sans réseau distant', async type => {
    const fetcher = vi.fn(async target => {
      const url = new URL(target);
      if (url.pathname === '/auth/v1/settings') return new Response(JSON.stringify(settings),
        { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url.pathname === '/auth/v1/admin/users') return new Response(JSON.stringify({ users: [], aud: 'authenticated' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } });
      const data = response(type);
      return new Response(JSON.stringify({ ...data.user, ...data.properties }),
        { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetcher);
    const admin = createProdLinkAdmin(env, { type, email, runtime });
    expect((await admin.getSettings()).disable_signup).toBe(true);
    expect((await admin.listUsers({ page: 1, perPage: 8 })).error).toBeNull();
    const result = await admin.generateLink({ type, email, options: { redirectTo: PROD_CALLBACK } });
    expect(result.error).toBeNull();
    expect(() => buildProdManualLink(result.data, { type, email })).not.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[2][1]).toMatchObject({ redirect: 'error', signal: expect.any(AbortSignal) });
    const body = JSON.parse(fetcher.mock.calls[2][1].body);
    expect(Object.keys(body).sort()).toEqual(['email', 'redirectTo', 'type']);
  });

  it.each(['invite', 'recovery'])('construit %s seulement sur le callback HTTPS exact', type => {
    const link = buildProdManualLink(response(type), { type, email, expectedId: user.id });
    expect(new URL(link).origin + new URL(link).pathname).toBe(PROD_CALLBACK);
    expect([...new URL(link).searchParams]).toEqual([['token_hash', token], ['type', type]]);
    for (const suffix of ['#', '#fragment', '&type=invite', `&token_hash=${token}`, '&next=https://example.test'])
      expect(() => validateProdCallback(link + suffix, type)).toThrow();
  });

  it('refuse utilisateurs, jetons, types ou redirections incohérents', () => {
    const mutations = [data => { data.user.email = 'autre@example.test'; }, data => { data.user.id = 'invalid'; },
      data => { data.properties.verification_type = 'recovery'; }, data => { data.properties.hashed_token = 'short'; },
      data => { data.properties.redirect_to = 'http://localhost:4173/mon-bprea/authentification.html'; },
      data => { data.properties.action_link = 'https://example.test/auth/v1/verify'; },
      data => { data.properties.action_link += '&type=invite'; }, data => { data.properties.action_link += '#'; }];
    for (const mutate of mutations) {
      const data = response(); mutate(data);
      expect(() => buildProdManualLink(data, { type: 'invite', email })).toThrow();
    }
    expect(() => buildProdManualLink(response(), { type: 'invite', email, expectedId: otherUsers(1)[0].id })).toThrow();
  });

  it('bloque tout endpoint administratif hors inventaire et génération prévue', async () => {
    const fetcher = vi.fn(async () => new Response('{}'));
    const request = prodAdminFetch({ type: 'invite', email, fetcher });
    for (const target of ['http://127.0.0.1:54321/auth/v1/admin/generate_link',
      'https://wcckbyhrtroittbfophv.supabase.co/auth/v1/admin/generate_link', `${PROD_API}/rest/v1/profiles`,
      `${PROD_API}/auth/v1/admin/users/${user.id}`, `${PROD_API}/auth/v1/admin/users?page=2&per_page=8`])
      await expect(request(target, { method: 'GET' })).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
    await request(`${PROD_API}/auth/v1/admin/users?page=1&per_page=8`);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: 'error', signal: expect.any(AbortSignal) });
  });

  it('un seul POST exact, même après perte d’acquittement ; aucune métadonnée ou répétition', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error(`${key} ${token}`));
    const request = prodAdminFetch({ type: 'invite', email, fetcher });
    const target = `${PROD_API}/auth/v1/admin/generate_link?redirect_to=${encodeURIComponent(PROD_CALLBACK)}`;
    const body = { type: 'invite', email, redirectTo: PROD_CALLBACK };
    for (const change of [{ ...body, password: 'synthetic' }, { ...body, data: { role: 'admin' } },
      { ...body, type: 'recovery' }, { ...body, email: 'other@example.test' }])
      await expect(request(target, { method: 'POST', body: JSON.stringify(change) })).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
    await expect(request(target, { method: 'POST', body: JSON.stringify(body) })).rejects.toThrow();
    await expect(request(target, { method: 'POST', body: JSON.stringify(body) })).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('la CLI refuse pipes, CI et arguments secrets sans publier leurs valeurs', () => {
    for (const args of [['invite'], ['check'], ['invite', '--yes', key, token]]) {
      const result = spawnSync(process.execPath, ['scripts/admin-generate-prod-auth-link.mjs', ...args], {
        encoding: 'utf8', env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, CI: 'true' },
      });
      expect(result.status).not.toBe(0);
      expect(result.stdout).not.toContain(key); expect(result.stderr).not.toContain(key);
      expect(result.stdout).not.toContain(token); expect(result.stderr).not.toContain(token);
      expect(result.stderr).not.toContain('at file:');
    }
  });
});
