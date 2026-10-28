import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAuthService } from '../../assets/auth-service.js';
import { authSession, authUser, mockAuthClient, ownProfile } from '../helpers/auth-mock.js';
import { MemoryStorage } from '../helpers/memory-storage.js';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('service auth — logique applicative avec SDK simulé, sans preuve RLS', () => {
  it('fournit une identité fraîche explicitement limitée pour la copie, sans session ni métadonnées arbitraires', async () => {
    const { client } = mockAuthClient({ session: authSession });
    client.auth.getUser.mockResolvedValue({ data: { user: { ...authUser, user_metadata: { password: 'NEVER_COPY' }, app_metadata: { secret: 'NEVER_COPY' }, identities: ['NEVER_COPY'] } }, error: null });
    const service = createAuthService(client); await service.start();
    const before = client.auth.getUser.mock.calls.length, version = service.getIdentityVersion();
    expect(await service.getExportIdentity()).toEqual(authUser);
    expect(client.auth.getUser.mock.calls.length).toBe(before + 1);
    await service.signOut(); expect(service.getIdentityVersion()).toBeGreaterThan(version);
    await expect(service.getExportIdentity()).rejects.toMatchObject({ code: 'invalid_session' });
  });
  it('part en chargement puis affiche un visiteur et ne multiplie pas les abonnements', async () => {
    const { client } = mockAuthClient();
    const service = createAuthService(client);
    const states = [];
    service.subscribe(state => states.push(state));
    expect(service.getState()).toMatchObject({ status: 'loading', user: null });
    await service.start();
    await service.start();
    expect(service.getState()).toMatchObject({ status: 'anonymous', user: null, error: null });
    expect(client.auth.onAuthStateChange).toHaveBeenCalledTimes(1);
    expect(states.at(-1)).toMatchObject({ status: 'anonymous', user: null });
    expect(client.auth.getUser).not.toHaveBeenCalled();
  });

  it('restaure une session seulement après confirmation du compte par Auth', async () => {
    const { client } = mockAuthClient({ session: authSession });
    const service = createAuthService(client);
    await service.start();
    expect(client.auth.getUser).toHaveBeenCalledTimes(1);
    expect(service.getState()).toMatchObject({ status: 'authenticated', user: authUser, error: null });
    expect(JSON.stringify(service.getState())).not.toContain(authSession.access_token);
    expect(JSON.stringify(service.getState())).not.toContain(authSession.refresh_token);
  });

  it('ne traite pas une session locale rejetée par Auth comme un utilisateur connecté', async () => {
    const { client } = mockAuthClient({ session: authSession });
    client.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid JWT fixture-unit-access', status: 401 } });
    const service = createAuthService(client);
    await service.start();
    expect(service.getState().status).not.toBe('authenticated');
    expect(service.getState().user).toBeNull();
    expect(JSON.stringify(service.getState())).not.toContain('fixture-unit-access');
  });

  it('signale un réseau indisponible avec un état sûr, sans détails bruts du serveur', async () => {
    const { client } = mockAuthClient();
    client.auth.getSession.mockRejectedValue(new TypeError('Failed to fetch https://example.invalid/?access_token=private-fixture'));
    const service = createAuthService(client);
    await service.start();
    expect(service.getState().status).not.toBe('authenticated');
    expect(service.getState().user).toBeNull();
    expect(service.getState().error).toEqual(expect.any(String));
    expect(JSON.stringify(service.getState())).not.toContain('private-fixture');
  });

  it('reste indisponible sans client configuré et refuse les opérations privées', async () => {
    const service = createAuthService(null, { configurationError: 'Configuration absente.' });
    await service.start();
    expect(service.getState()).toMatchObject({ status: 'unavailable', user: null });
    await expect(service.signIn(authUser.email, 'Mot-de-passe-fixture!')).rejects.toThrow();
    await expect(service.getProfile()).rejects.toThrow();
  });

  it('valide avant appel SDK et normalise uniquement l’adresse de connexion', async () => {
    const { client } = mockAuthClient();
    const service = createAuthService(client);
    await service.start();
    await expect(service.signIn('invalide', 'mot-de-passe')).rejects.toThrow();
    expect(client.auth.signInWithPassword).not.toHaveBeenCalled();
    const password = ' Mot-de-passe-fixture! ';
    await service.signIn(` ${authUser.email} `, password);
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({ email: authUser.email, password });
    expect(service.getState()).toMatchObject({ status: 'authenticated', user: authUser });
  });

  it('remplace les erreurs d’identifiants par un message sans jeton ni réponse brute', async () => {
    const { client } = mockAuthClient();
    client.auth.signInWithPassword.mockResolvedValue({ data: { user: null, session: null }, error: { code: 'invalid_credentials', status: 400, message: 'raw-secret-fixture' } });
    const service = createAuthService(client);
    await service.start();
    const error = await service.signIn(authUser.email, 'Mot-de-passe-fixture!').catch(error => error);
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('invalid_credentials');
    expect(error.message).not.toContain('raw-secret-fixture');
    expect(service.getState().user).toBeNull();
  });

  it('ne crée pas de connexion ni d’activation sur une réponse Auth incomplète', async () => {
    const { client } = mockAuthClient();
    client.auth.signInWithPassword.mockResolvedValue({ data: { user: authUser, session: null }, error: null });
    client.auth.verifyOtp.mockResolvedValue({ data: { user: authUser, session: null }, error: null });
    const service = createAuthService(client);
    await service.start();
    await expect(service.signIn(authUser.email, 'Mot-de-passe-fixture!')).rejects.toThrow();
    await expect(service.completeLink({ token_hash: 'fixture-link-not-real', type: 'invite' })).rejects.toThrow();
    expect(service.getState()).toMatchObject({ status: 'anonymous', user: null });
  });

  it('ne restaure pas un état périmé lorsqu’une déconnexion arrive pendant le chargement', async () => {
    const { client, emit } = mockAuthClient();
    let release;
    client.auth.getSession.mockReturnValue(new Promise(resolve => { release = resolve; }));
    const service = createAuthService(client);
    const starting = service.start();
    emit('SIGNED_OUT', null);
    release({ data: { session: authSession }, error: null });
    await starting;
    expect(service.getState()).toMatchObject({ status: 'anonymous', user: null });
    expect(client.auth.getUser).not.toHaveBeenCalled();
  });

  it('actualise la session lors du renouvellement puis de son expiration', async () => {
    vi.useFakeTimers();
    const { client, emit } = mockAuthClient({ session: authSession });
    const service = createAuthService(client);
    const states = [];
    service.subscribe(state => states.push(state));
    await service.start();
    await emit('TOKEN_REFRESHED', { ...authSession, access_token: 'fixture-refreshed' });
    await vi.runAllTimersAsync();
    expect(service.getState()).toMatchObject({ status: 'authenticated', user: authUser });
    await emit('SIGNED_OUT', null);
    expect(service.getState()).toMatchObject({ status: 'anonymous', user: null });
    expect(states.at(-1)).toMatchObject({ status: 'anonymous', user: null });
    expect(JSON.stringify(states)).not.toContain('fixture-refreshed');
  });

  it('termine la lecture du profil si getUser renouvelle le jeton du même compte', async () => {
    vi.useFakeTimers();
    const { client, emit } = mockAuthClient({ session: authSession });
    const service = createAuthService(client);
    await service.start();
    client.auth.getUser.mockImplementationOnce(async () => {
      emit('TOKEN_REFRESHED', { ...authSession, access_token: 'fixture-refreshed-during-read' });
      return { data: { user: authUser }, error: null };
    });

    await expect(service.getProfile()).resolves.toEqual(ownProfile);
    await vi.runAllTimersAsync();
    expect(service.getState()).toMatchObject({ status: 'authenticated', user: authUser });
    expect(JSON.stringify(service.getState())).not.toContain('fixture-refreshed-during-read');
  });

  it('efface l’autorisation de changement du mot de passe lorsque le compte change', async () => {
    vi.useFakeTimers();
    const { client, emit } = mockAuthClient({ session: authSession });
    const service = createAuthService(client);
    await service.start();
    await service.completeLink({ token_hash: 'fixture-recovery-link-not-real', type: 'recovery' });
    const otherUser = { ...authUser, id: '22222222-2222-4222-8222-222222222222', email: 'eleve-b@example.invalid' };
    client.auth.getUser.mockResolvedValue({ data: { user: otherUser }, error: null });
    emit('SIGNED_IN', { ...authSession, user: otherUser });
    await vi.runAllTimersAsync();
    expect(service.getState()).toMatchObject({ status: 'authenticated', user: otherUser });
    await expect(service.updatePassword('Mot-de-passe-fixture-nouveau!')).rejects.toMatchObject({ code: 'invalid_link' });

    // Revenir au premier compte ne restaure pas une autorisation consommée
    // ou effacée : il doit ouvrir un nouveau lien personnel.
    client.auth.getUser.mockResolvedValue({ data: { user: authUser }, error: null });
    emit('SIGNED_IN', authSession);
    await vi.runAllTimersAsync();
    await expect(service.updatePassword('Mot-de-passe-fixture-nouveau!')).rejects.toMatchObject({ code: 'invalid_link' });
    expect(client.auth.updateUser).not.toHaveBeenCalled();
  });

  it('déconnecte via le SDK et conserve toutes les données pédagogiques et préférences', async () => {
    const storage = new MemoryStorage();
    const saved = {
      'bprea-demo-appearance-v1': '{"version":1,"season":"winter","brightness":"dark"}',
      'bprea-demo-progress-v1': '{"chapitre":{"done":true}}',
      'bprea-demo-drill-v1': '{"version":1,"series":{}}',
      'monbprea.botanical.v1': '{"schemaVersion":1,"answers":[],"sessions":[]}',
      'unknown-future-key': 'conserver',
    };
    Object.entries(saved).forEach(([key, value]) => storage.setItem(key, value));
    vi.stubGlobal('localStorage', storage);
    const { client } = mockAuthClient({ session: authSession });
    const service = createAuthService(client);
    await service.start();
    await service.signOut();
    expect(client.auth.signOut).toHaveBeenCalledTimes(1);
    expect(service.getState()).toMatchObject({ status: 'anonymous', user: null });
    for (const [key, value] of Object.entries(saved)) expect(storage.getItem(key)).toBe(value);
  });

  it('ne masque pas une déconnexion refusée par le serveur', async () => {
    const { client } = mockAuthClient({ session: authSession });
    client.auth.signOut.mockResolvedValue({ error: { message: 'server-fixture-detail' } });
    const service = createAuthService(client);
    await service.start();
    await expect(service.signOut()).rejects.toThrow();
    expect(service.getState().error ?? '').not.toContain('server-fixture-detail');
  });

  it('ne propose plus de demande automatique de récupération dans le service applicatif', async () => {
    const { client } = mockAuthClient();
    const service = createAuthService(client, { siteUrl: 'http://127.0.0.1:4173/mon-bprea/' });
    await service.start();
    expect(service.requestPasswordReset).toBeUndefined();
    expect(client.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('vérifie uniquement les liens invitation/récupération et ne consomme pas un type arbitraire', async () => {
    const { client } = mockAuthClient();
    const service = createAuthService(client);
    await service.start();
    await expect(service.completeLink({ token_hash: 'fixture-link-not-real', type: 'signup' })).rejects.toThrow();
    expect(client.auth.verifyOtp).not.toHaveBeenCalled();
    await service.completeLink({ token_hash: 'fixture-link-not-real', type: 'invite' });
    expect(client.auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'fixture-link-not-real', type: 'invite' });
    expect(service.getState()).toMatchObject({ status: 'authenticated', user: authUser });
  });

  it('refuse un lien expiré et la définition d’un mot de passe sans session', async () => {
    const { client } = mockAuthClient();
    client.auth.verifyOtp.mockResolvedValue({ data: { user: null, session: null }, error: { code: 'otp_expired', message: 'expired-token-fixture' } });
    const service = createAuthService(client);
    await service.start();
    await expect(service.completeLink({ token_hash: 'expired-token-fixture', type: 'recovery' })).rejects.toThrow();
    expect(service.getState().user).toBeNull();
    await expect(service.updatePassword('Mot-de-passe-fixture!')).rejects.toThrow();
    expect(client.auth.updateUser).not.toHaveBeenCalled();
    expect(JSON.stringify(service.getState())).not.toContain('expired-token-fixture');
  });

  it('refuse une deuxième vérification en vol et accepte l’événement Auth du seul lien confirmé', async () => {
    vi.useFakeTimers();
    const { client, emit } = mockAuthClient();
    let resolve;
    client.auth.verifyOtp.mockReturnValue(new Promise(done => { resolve = done; }));
    client.auth.getUser.mockResolvedValue({ data: { user: authUser }, error: null });
    const service = createAuthService(client); await service.start();
    const first = service.completeLink({ token_hash: 'fixture-link-not-real', type: 'invite' });
    await expect(service.completeLink({ token_hash: 'fixture-link-not-real', type: 'invite' })).rejects.toMatchObject({ code: 'link_pending' });
    emit('SIGNED_IN', authSession);
    resolve({ data: { user: authUser, session: authSession }, error: null });
    await first; await vi.runAllTimersAsync();
    expect(client.auth.verifyOtp).toHaveBeenCalledTimes(1);
    expect(service.getState().user.id).toBe(authUser.id);
  });

  it.each(['sortie', 'autre compte', 'A→B→A'])('rejette le résultat tardif du lien après %s sans autoriser de mot de passe', async change => {
    vi.useFakeTimers();
    const { client, emit } = mockAuthClient({ session: authSession });
    let resolve;
    client.auth.verifyOtp.mockReturnValue(new Promise(done => { resolve = done; }));
    const service = createAuthService(client); await service.start();
    const first = service.completeLink({ token_hash: 'fixture-recovery-link-not-real', type: 'recovery' });
    if (change === 'sortie') emit('SIGNED_OUT', null);
    else emit('SIGNED_IN', { ...authSession, access_token: 'fixture-B', user: { ...authUser, id: '22222222-2222-4222-8222-222222222222' } });
    if (change === 'A→B→A' || change === 'sortie') emit('PASSWORD_RECOVERY', authSession);
    resolve({ data: { user: authUser, session: authSession }, error: null });
    await expect(first).rejects.toMatchObject({ code: 'session_changed' });
    await vi.runAllTimersAsync();
    expect(service.getState().status).not.toBe('authenticated');
    await expect(service.updatePassword('Mot-de-passe-fixture-nouveau!')).rejects.toMatchObject({ code: 'invalid_link' });
    expect(client.auth.updateUser).not.toHaveBeenCalled();
  });

  it('exige un lien vérifié pour changer le mot de passe et ne réutilise pas cette autorisation', async () => {
    const { client } = mockAuthClient({ session: authSession });
    const service = createAuthService(client);
    await service.start();
    const password = 'Nouveau-mot-de-passe-fixture!';
    await expect(service.updatePassword(password)).rejects.toMatchObject({ code: 'invalid_link' });
    expect(client.auth.updateUser).not.toHaveBeenCalled();
    await service.completeLink({ token_hash: 'fixture-recovery-link-not-real', type: 'recovery' });
    await service.updatePassword(password);
    expect(client.auth.updateUser).toHaveBeenCalledWith({ password });
    await expect(service.updatePassword(password)).rejects.toMatchObject({ code: 'invalid_link' });
    expect(client.auth.updateUser).toHaveBeenCalledTimes(1);
  });

  it('lit et modifie uniquement le pseudo du profil personnel', async () => {
    const { client, query } = mockAuthClient({ session: authSession });
    const service = createAuthService(client);
    await service.start();
    expect(await service.getProfile()).toEqual(ownProfile);
    expect(client.from).toHaveBeenCalledWith('profiles');
    expect(query.eq).toHaveBeenCalledWith('id', authUser.id);
    await service.updateProfile(' Nouveau pseudo ');
    expect(query.update).toHaveBeenCalledWith({ pseudo: 'Nouveau pseudo' });
    await expect(service.updateProfile('x'.repeat(1000))).rejects.toThrow();
    expect(query.update).toHaveBeenCalledTimes(1);
  });

  it('refuse une modification démarrée sur A si la vérification découvre B avant son événement Auth', async () => {
    const { client, query } = mockAuthClient({ session: authSession });
    const service = createAuthService(client);
    await service.start();
    const otherUser = { ...authUser, id: '22222222-2222-4222-8222-222222222222', email: 'eleve-b@example.invalid' };
    client.auth.getUser.mockResolvedValue({ data: { user: otherUser }, error: null });

    await expect(service.updateProfile('Pseudo saisi sur A')).rejects.toMatchObject({ code: 'session_changed' });

    expect(client.from).not.toHaveBeenCalled();
    expect(query.update).not.toHaveBeenCalled();
    expect(service.getState()).toMatchObject({ status: 'authenticated', user: otherUser });
  });

  it('ne transforme pas une erreur de lecture de profil en profil fictif', async () => {
    const { client, query } = mockAuthClient({ session: authSession });
    query.single.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'profile-server-fixture' } });
    const service = createAuthService(client);
    await service.start();
    await expect(service.getProfile()).rejects.toMatchObject({ code: 'profile_unavailable' });
    expect(service.getState().error ?? '').not.toContain('profile-server-fixture');
  });

  it('rejette une réponse de profil d’un autre UUID et une réponse reçue après déconnexion', async () => {
    const { client, query } = mockAuthClient({ session: authSession });
    const service = createAuthService(client);
    await service.start();
    query.single.mockResolvedValueOnce({ data: { ...ownProfile, id: '22222222-2222-4222-8222-222222222222' }, error: null });
    await expect(service.getProfile()).rejects.toThrow();
    let release;
    query.single.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const reading = service.getProfile();
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    await service.signOut();
    release({ data: ownProfile, error: null });
    await expect(reading).rejects.toThrow();
    expect(service.getState()).toMatchObject({ status: 'anonymous', user: null });
  });

  it('refuse la lecture et la modification du profil d’un visiteur', async () => {
    const { client } = mockAuthClient();
    const service = createAuthService(client);
    await service.start();
    await expect(service.getProfile()).rejects.toThrow();
    await expect(service.updateProfile('Camille')).rejects.toThrow();
    expect(client.from).not.toHaveBeenCalled();
  });
});
