import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  LOCAL_API, LOCAL_CALLBACK, LOCAL_PROJECT, LOCAL_SITE, buildManualLink, generateManualAuthLink,
  localAdminFetch, maskedTarget, parseOperation, safeAdminMessage, validateCallbackLink, validateLocalEnvironment, validateTarget,
} from '../../scripts/auth-link-local.mjs';

// Toutes les valeurs ci-dessous sont synthétiques, aucune clé utilisable.
const email = 'eleve-synthetique@example.test';
const key = 'sb_secret_synthetic_fixture_never_a_real_key';
const token = 'synthetic_token_without_any_auth_capability';
const env = { SUPABASE_TEST_CONFIRM_LOCAL: LOCAL_PROJECT, SUPABASE_TEST_URL: LOCAL_API, SUPABASE_TEST_ADMIN_KEY: key };
const user = { id: '11111111-1111-4111-8111-111111111111', email };
const response = (type = 'invite') => {
  const action = new URL(`${LOCAL_API}/auth/v1/verify`);
  action.searchParams.set('token', token); action.searchParams.set('type', type); action.searchParams.set('redirect_to', LOCAL_CALLBACK);
  return { properties: { hashed_token: token, verification_type: type, redirect_to: LOCAL_CALLBACK, action_link: action.href }, user: { ...user } };
};
function operation(type = 'invite', existing = []) {
  const admin = { listUsers: vi.fn().mockResolvedValue({ data: { users: existing }, error: null }),
    generateLink: vi.fn().mockResolvedValue({ data: response(type), error: null }) };
  const options = { env, type, email, confirm: vi.fn().mockResolvedValue(true), present: vi.fn(), makeAdmin: vi.fn(() => admin) };
  return { admin, options, run: () => generateManualAuthLink(options) };
}

describe('générateur Node privé — frontières locales et remise contrôlée', () => {
  it('identifie le contrat local versionné et refuse un projet/configuration non identifié', () => {
    expect(validateLocalEnvironment(env)).toEqual({ url: LOCAL_API, siteUrl: LOCAL_SITE, adminKey: key });
    const config = readFileSync('supabase/config.toml', 'utf8');
    for (const invalid of [{ ...env, SUPABASE_TEST_CONFIRM_LOCAL: undefined }, { ...env, SUPABASE_TEST_CONFIRM_LOCAL: 'development' },
      { ...env, SUPABASE_TEST_CONFIRM_LOCAL: 'wcckbyhrtroittbfophv' }, { ...env, SUPABASE_TEST_CONFIRM_LOCAL: 'oqoqrxwfbkhtpksqimgd' }])
      expect(() => validateLocalEnvironment(invalid)).toThrow();
    for (const replacement of [config.replace(LOCAL_PROJECT, 'unknown-project'), config.replace('port = 54321', 'port = 54325'),
      config.replace('enable_signup = false', 'enable_signup = true'), config.replace('enable_anonymous_sign_ins = false', 'enable_anonymous_sign_ins = true')])
      expect(() => validateLocalEnvironment(env, replacement)).toThrow();
  });

  it.each([
    'https://wcckbyhrtroittbfophv.supabase.co', 'https://oqoqrxwfbkhtpksqimgd.supabase.co', 'https://arbitrary.supabase.co',
    'https://127.0.0.1:54321', 'ftp://127.0.0.1:54321', 'http://example.test:54321', 'http://localhost:54321',
    'http://[::1]:54321', 'http://192.168.1.1:54321', 'http://127.0.0.1:54322', 'http://127.0.0.1',
    'http://127.1:54321', 'http://2130706433:54321', 'http://@127.0.0.1:54321', 'http://user:password@127.0.0.1:54321',
    `${LOCAL_API}/auth`, `${LOCAL_API}/../`, `${LOCAL_API}?`, `${LOCAL_API}#`, `${LOCAL_API}/?redirect_to=https://example.test`,
  ])('refuse avant tout accès la cible %s', async url => {
    const fixture = operation(); fixture.options.env = { ...env, SUPABASE_TEST_URL: url };
    await expect(fixture.run()).rejects.toMatchObject({ code: 'environment' });
    expect(fixture.options.makeAdmin).not.toHaveBeenCalled(); expect(fixture.options.confirm).not.toHaveBeenCalled();
  });

  it('refuse clé absente/legacy/publishable et site hors origine, port ou préfixe exacts', () => {
    for (const adminKey of [undefined, '', 'sb_secret_short', 'sb_publishable_fixture', 'eyJ.synthetic.jwt', `${key}\n`])
      expect(() => validateLocalEnvironment({ ...env, SUPABASE_TEST_ADMIN_KEY: adminKey })).toThrow();
    for (const siteUrl of ['https://example.test/mon-bprea/', 'http://127.0.0.1:4173/', 'http://localhost:4173/mon-bprea/',
      'http://127.0.0.1:4174/mon-bprea/', `${LOCAL_SITE}?`, `${LOCAL_SITE}#`, `${LOCAL_SITE}../mon-bprea/`])
      expect(() => validateLocalEnvironment({ ...env, SUPABASE_TEST_SITE_URL: siteUrl })).toThrow();
  });

  it('normalise une adresse unique, minimise la cible et interdit listes, contrôles et types supplémentaires', () => {
    expect(validateTarget('invite', ` ${email.toUpperCase()} `)).toBe(email);
    expect(maskedTarget(email)).toBe('e…@example.test');
    for (const address of ['', 'invalide', 'x@@example.test', '.x@example.test', 'x..y@example.test', 'x@-example.test',
      'x@localhost', 'x@example..test', 'x@example.test,y@example.test', 'Nom <x@example.test>', 'x\n@example.test', 'x\x1b@example.test', `${'x'.repeat(65)}@example.test`])
      expect(() => validateTarget('invite', address)).toThrow();
    for (const type of ['signup', 'magiclink', 'email_change_new', 'delete', undefined]) expect(() => validateTarget(type, email)).toThrow();
    expect(parseOperation(['invite'])).toBe('invite'); expect(parseOperation(['recovery'])).toBe('recovery');
    for (const args of [[], ['signup'], ['invite', 'recovery'], ['invite', email], ['invite', '--force'], ['--allow-remote'], ['invite', key]])
      expect(() => parseOperation(args)).toThrow();
  });

  it.each(['invite', 'recovery'])('construit seulement le callback %s depuis hashed_token, sans action_link ni session', type => {
    const link = new URL(buildManualLink(response(type), { type, email }));
    expect(link.origin + link.pathname).toBe(LOCAL_CALLBACK);
    expect([...link.searchParams]).toEqual([['token_hash', token], ['type', type]]);
    expect(link.hash).toBe(''); expect(link.href).not.toContain('/auth/v1/verify'); expect(link.href).not.toContain(key);
    for (const suffix of ['&next=https://example.test', '&access_token=synthetic', '&type=invite', `&token_hash=${token}`, '#fragment', '#'])
      expect(() => validateCallbackLink(link.href + suffix, type)).toThrow();
  });

  it('refuse réponses partielles, type/jeton/redirection/utilisateur incohérents sans publier le secret', () => {
    const bad = [null, {}, { user }, { ...response(), user: null }];
    for (const [field, value] of [['hashed_token', 'bad token'], ['hashed_token', 'short'], ['hashed_token', 'x'.repeat(513)],
      ['verification_type', 'recovery'], ['redirect_to', LOCAL_SITE], ['action_link', 'https://example.test/?token=synthetic']]) {
      const data = response(); data.properties[field] = value; bad.push(data);
    }
    for (const change of [data => { data.user.email = 'other@example.test'; }, data => { data.user.id = 'invalid'; },
      data => { data.properties.action_link += '&next=https://example.test'; }]) { const data = response(); change(data); bad.push(data); }
    for (const data of bad) {
      const error = (() => { try { buildManualLink(data, { type: 'invite', email }); } catch (error) { return error; } })();
      expect(error).toBeInstanceOf(Error);
      expect(safeAdminMessage(error)).not.toContain(token); expect(safeAdminMessage(error)).not.toContain(key);
    }
  });

  it('exige true explicite avant la création du client, les lectures et la génération', async () => {
    for (const approval of [false, undefined, 'oui', 'true', 1]) {
      const fixture = operation(); fixture.options.confirm.mockResolvedValue(approval);
      await expect(fixture.run()).rejects.toMatchObject({ code: 'confirmation' });
      expect(fixture.options.makeAdmin).not.toHaveBeenCalled(); expect(fixture.admin.generateLink).not.toHaveBeenCalled();
    }
  });

  it.each(['invite', 'recovery'])('génère %s une fois sans mot de passe/métadonnées, remet une fois et ne retourne pas le secret', async type => {
    const fixture = operation(type, type === 'recovery' ? [user] : []);
    expect(await fixture.run()).toEqual({ type, status: 'presented' });
    expect(fixture.options.confirm).toHaveBeenCalledWith({ type, target: 'e…@example.test', project: LOCAL_PROJECT });
    expect(fixture.admin.generateLink).toHaveBeenCalledExactlyOnceWith({ type, email, options: { redirectTo: LOCAL_CALLBACK } });
    expect(fixture.options.present).toHaveBeenCalledExactlyOnceWith(buildManualLink(response(type), { type, email }));
  });

  it('refuse un compte déjà créé, y compris en attente et sur une page suivante ; recovery inconnu ne crée rien', async () => {
    const existing = operation('invite', [{ ...user, email_confirmed_at: null }]);
    await expect(existing.run()).rejects.toMatchObject({ code: 'exists' });
    expect(existing.admin.generateLink).not.toHaveBeenCalled();
    const paged = operation();
    paged.admin.listUsers.mockResolvedValueOnce({ data: { users: Array.from({ length: 100 }, () => ({ email: 'other@example.test' })) } })
      .mockResolvedValueOnce({ data: { users: [user] } });
    await expect(paged.run()).rejects.toMatchObject({ code: 'exists' });
    expect(paged.admin.listUsers).toHaveBeenLastCalledWith({ page: 2, perPage: 100 });
    const missing = operation('recovery');
    await expect(missing.run()).rejects.toMatchObject({ code: 'missing' }); expect(missing.admin.generateLink).not.toHaveBeenCalled();
  });

  it('n’affiche aucun succès ni détail fournisseur, ne relance jamais après perte de résultat ou remise échouée', async () => {
    for (const phase of ['lookup', 'network', 'partial', 'display', 'provider']) {
      const fixture = operation();
      const raw = new Error(`${key} ${token} password-synthetic-do-not-print`);
      if (phase === 'lookup') fixture.admin.listUsers.mockRejectedValue(raw);
      if (phase === 'network') fixture.admin.generateLink.mockRejectedValue(raw);
      if (phase === 'partial') fixture.admin.generateLink.mockResolvedValue({ data: { user }, error: null });
      if (phase === 'provider') fixture.admin.generateLink.mockResolvedValue({ error: { message: raw.message } });
      if (phase === 'display') fixture.options.present.mockRejectedValue(raw);
      const error = await fixture.run().catch(error => error);
      expect(error).toBeInstanceOf(Error);
      const text = safeAdminMessage(error); expect(text).not.toContain(key); expect(text).not.toContain(token); expect(text).not.toContain('password-synthetic');
      expect(fixture.admin.generateLink.mock.calls.length).toBe(phase === 'lookup' ? 0 : 1);
      expect(fixture.options.present.mock.calls.length).toBe(phase === 'display' ? 1 : 0);
      if (phase === 'network' || phase === 'partial' || phase === 'display') expect(text).toContain('Ne pas relancer');
    }
  });

  it('verrouille aussi le transport et refuse de suivre une redirection, sans exposer d’erreur brute', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}'));
    const request = localAdminFetch(fetcher);
    for (const target of ['https://wcckbyhrtroittbfophv.supabase.co/auth/v1/admin/generate_link',
      'https://oqoqrxwfbkhtpksqimgd.supabase.co/auth/v1/admin/generate_link', `${LOCAL_API}/rest/v1/profiles`, `${LOCAL_API}/auth/v1/admin/users/uuid`])
      await expect(request(target, { method: 'POST' })).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
    await request(`${LOCAL_API}/auth/v1/admin/generate_link`, { method: 'POST' });
    expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: 'error', signal: expect.any(AbortSignal) });
    fetcher.mockRejectedValue(new Error(`${key} ${token}`));
    const error = await request(`${LOCAL_API}/auth/v1/admin/users`).catch(error => error);
    expect(safeAdminMessage(error)).not.toContain(key); expect(safeAdminMessage(error)).not.toContain(token);
  });

  it('CLI non interactive/arguments secrets interdits : échec sans sérialiser les arguments ni la clé', () => {
    const result = spawnSync(process.execPath, ['scripts/admin-generate-auth-link.mjs', 'invite', key, token], { encoding: 'utf8', env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot } });
    expect(result.status).not.toBe(0); expect(result.stdout).toBe(''); expect(result.stderr).not.toContain(key); expect(result.stderr).not.toContain(token);
    const noninteractive = spawnSync(process.execPath, ['scripts/admin-generate-auth-link.mjs', 'invite'], { encoding: 'utf8', env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot } });
    expect(noninteractive.status).not.toBe(0); expect(noninteractive.stderr).toContain('interactif'); expect(noninteractive.stdout).toBe('');
  });
});
