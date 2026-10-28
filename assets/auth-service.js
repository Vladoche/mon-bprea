import { getSupabaseClient } from './supabase-client.js';
import { validateCredentials, validatePassword, validatePseudo } from './auth-validation.js';
import { createLocalIdentityMarker } from './auth-local-identity.js';

const unavailable = 'L’espace compte n’est pas encore configuré. Les cours et outils restent accessibles.';
const network = 'Le service est injoignable. Vérifie ta connexion puis réessaie.';
export class AuthError extends Error {
  constructor(message, code = 'auth_error') { super(message); this.name = 'AuthError'; this.code = code; }
}
function safeError(error, operation) {
  if (error instanceof AuthError) return error;
  if (error?.status === 429 || error?.code === 'over_request_rate_limit') return new AuthError('Trop de tentatives. Patiente avant de réessayer.', 'rate_limit');
  if (operation === 'session' && (error?.status === 401 || error?.status === 403 || ['session_not_found', 'user_not_found', 'refresh_token_not_found', 'refresh_token_already_used', 'bad_jwt'].includes(error?.code)))
    return new AuthError('Ta session a expiré. Connecte-toi à nouveau.', 'invalid_session');
  if (error instanceof TypeError || error?.name === 'AuthRetryableFetchError' || error?.name === 'TimeoutError' || (!error?.status && !error?.code))
    return new AuthError(network, 'network');
  if (operation === 'link') return new AuthError('Ce lien est invalide, expiré ou déjà utilisé. Demande un nouveau lien.', 'invalid_link');
  if (operation === 'login') return new AuthError('Connexion impossible. Vérifie tes identifiants et réessaie.', 'invalid_credentials');
  if (error.status === 401 || error.status === 403) return new AuthError('Ta session a expiré. Connecte-toi à nouveau.', 'invalid_session');
  if (operation === 'profile') return new AuthError('Le profil est indisponible. Réessaie ou contacte la personne qui gère les invitations.', 'profile_unavailable');
  if (operation === 'password') return new AuthError('Le mot de passe n’a pas pu être modifié. Essaie un autre mot de passe ou demande un nouveau lien.', 'password_failed');
  return new AuthError('L’opération a échoué. Réessaie dans quelques instants.');
}
const publicUser = user => user?.id ? Object.freeze({ id: user.id, email: user.email || '', created_at: user.created_at || null }) : null;

// Seule frontière applicative avec Auth et profiles. Aucun résultat pédagogique.
export function createAuthService(client, { configurationError, siteUrl, environment, url } = {}) {
  const marker = createLocalIdentityMarker({ environment, url, siteUrl });
  let localSession = null;
  const unavailableMessage = configurationError === 'network' ? 'Le service de compte est injoignable. Vérifie ta connexion puis recharge la page.' : unavailable;
  let state = Object.freeze({ status: client ? 'loading' : 'unavailable', user: null, error: client ? null : unavailableMessage });
  let started;
  let revision = 0;
  let passwordLinkUser = null;
  let linkPending = false;
  let linkAttempt = null;
  const subscribers = new Set();
  function publish(status, user = null, error = null) {
    state = Object.freeze({ status, user: publicUser(user), error });
    for (const listener of subscribers) listener(state);
  }
  function sessionFailure(error, session) {
    if (error.code === 'invalid_session') { marker.clear(); publish('anonymous'); return; }
    const identity = error.code === 'network' && marker.restore(session);
    if (identity) publish('offline', identity, 'Identité locale reconnue. La connexion au compte doit être vérifiée avant toute synchronisation.');
    else publish('error', null, error.message);
  }
  const assertClient = () => { if (!client || configurationError) throw new AuthError(unavailableMessage, 'unavailable'); };
  async function run(operation, callback) {
    assertClient();
    try {
      const result = await callback();
      if (result?.error) throw result.error;
      return result?.data;
    } catch (error) { throw safeError(error, operation); }
  }
  async function verifyIdentity(expectedRevision) {
    const data = await run('session', () => client.auth.getUser());
    if (!data?.user?.id) throw new AuthError('Connecte-toi pour accéder à ton profil.', 'invalid_session');
    if (revision !== expectedRevision) throw new AuthError('La session a changé. Réessaie.', 'session_changed');
    if (state.user && state.user.id !== data.user.id) {
      revision++;
      marker.clear();
      passwordLinkUser = null;
    }
    publish('authenticated', data.user);
    marker.remember(localSession, data.user.id);
    return data.user;
  }
  async function requireUser() {
    assertClient();
    if (state.status !== 'authenticated') throw new AuthError('Connecte-toi pour accéder à ton profil.', 'invalid_session');
    const expectedUserId = state.user?.id;
    try {
      const user = await verifyIdentity(revision);
      if (user.id !== expectedUserId) throw new AuthError('La session a changé. Réessaie.', 'session_changed');
      return user;
    }
    catch (error) {
      if (error.code === 'invalid_session') { revision++; passwordLinkUser = null; marker.clear(); publish('anonymous'); }
      throw error;
    }
  }
  function profileFrom(data, userId) {
    if (!data || data.id !== userId || (data.pseudo !== null && validatePseudo(data.pseudo)))
      throw new AuthError('Le profil est incomplet ou indisponible. Réessaie ou contacte la personne qui gère les invitations.', 'profile_unavailable');
    return { id: data.id, pseudo: data.pseudo, created_at: data.created_at, updated_at: data.updated_at };
  }
  const service = {
    getState: () => state,
    // Non-secret identity generation. Changes on sign-out/sign-in, including A→B→A.
    getIdentityVersion: () => revision,
    async getExportIdentity() {
      const user = await requireUser();
      return Object.fromEntries(['id', 'email', 'created_at', 'updated_at', 'email_confirmed_at', 'last_sign_in_at']
        .filter(key => Object.hasOwn(user, key) && (user[key] === null || typeof user[key] === 'string'))
        .map(key => [key, user[key]]));
    },
    subscribe(listener) { subscribers.add(listener); listener(state); return () => subscribers.delete(listener); },
    start() {
      if (started) return started;
      started = (async () => {
        if (!client) return state;
        client.auth.onAuthStateChange((event, session) => {
          // Callback synchrone : aucune attente d'appel Auth dans son verrou.
          if (event === 'INITIAL_SESSION') return;
          if (linkAttempt) {
            if (event === 'SIGNED_OUT' || !session?.user || linkAttempt.event) linkAttempt.interrupted = true;
            else linkAttempt.event = { type: event, userId: session.user.id, token: session.access_token };
          }
          if (event === 'SIGNED_OUT' || !session?.user) { revision++; passwordLinkUser = null; localSession = null; marker.clear(); publish('anonymous'); return; }
          localSession = session;
          if (passwordLinkUser && passwordLinkUser !== session.user.id) passwordLinkUser = null;
          // Un renouvellement pour le même UUID ne change pas le propriétaire
          // d'une requête en cours, y compris s'il est déclenché par getUser().
          const current = state.user?.id === session.user.id ? revision : ++revision;
          if (state.user?.id !== session.user.id) publish('loading');
          setTimeout(() => {
            verifyIdentity(current).catch(error => {
              if (current === revision) sessionFailure(error, session);
            });
          }, 0);
        });
        const current = revision;
        try {
          const data = await run('session', () => client.auth.getSession());
          if (current !== revision) return state;
          localSession = data?.session;
          if (data?.session) await verifyIdentity(current);
          else { marker.clear(); publish('anonymous'); }
        } catch (error) {
          if (current === revision) sessionFailure(error, localSession);
        }
        return state;
      })();
      return started;
    },
    async retry() {
      assertClient(); const current = revision;
      try {
        const data = await run('session', () => client.auth.getSession());
        if (current !== revision) throw new AuthError('La session a changé. Réessaie.', 'session_changed');
        localSession = data?.session;
        if (data?.session) await verifyIdentity(current); else { marker.clear(); publish('anonymous'); }
      } catch (error) {
        if (current === revision && error.code !== 'session_changed') { if (error.code === 'invalid_session') revision++; sessionFailure(error, localSession); }
        throw error;
      }
    },
    async verifiedSession(expectedUserId) {
      if (state.status === 'offline') await service.retry();
      const user = await requireUser();
      const current = revision;
      const data = await run('session', () => client.auth.getSession());
      if (current !== revision || state.status !== 'authenticated' || user.id !== expectedUserId || data?.session?.user?.id !== user.id || !data.session.access_token)
        throw new AuthError('La session a changé. Réessaie.', 'session_changed');
      return { userId: user.id, accessToken: data.session.access_token };
    },
    async signIn(email, password) {
      const problem = validateCredentials(email, password);
      if (problem) throw new AuthError(problem, 'validation');
      const data = await run('login', () => client.auth.signInWithPassword({ email: email.trim(), password }));
      if (!data?.user?.id || !data?.session) throw new AuthError('Connexion impossible. Réessaie.', 'invalid_credentials');
      revision++; passwordLinkUser = null; localSession = data.session; marker.remember(localSession, data.user.id); publish('authenticated', data.user);
      return state.user;
    },
    async signOut() {
      revision++; passwordLinkUser = null; localSession = null; marker.clear(); publish('loading');
      try { await run('logout', () => client.auth.signOut({ scope: 'local' })); publish('anonymous'); }
      catch (error) { publish('error', null, error.message); throw error; }
    },
    async completeLink({ token_hash, type } = {}) {
      if (!['invite', 'recovery'].includes(type) || !/^[A-Za-z0-9_-]{20,512}$/.test(token_hash || ''))
        throw new AuthError('Ce lien est invalide, expiré ou déjà utilisé. Demande un nouveau lien.', 'invalid_link');
      if (linkPending) throw new AuthError('Une vérification est déjà en cours.', 'link_pending');
      linkPending = true;
      const current = revision;
      const attempt = linkAttempt = { event: null, interrupted: false };
      try {
        const data = await run('link', () => client.auth.verifyOtp({ token_hash, type }));
        if (!data?.session?.access_token || !data?.user?.id || data.session.user?.id !== data.user.id)
          throw new AuthError('Ce lien est invalide ou expiré.', 'invalid_link');
        // verifyOtp émet lui-même SIGNED_IN/PASSWORD_RECOVERY avant sa réponse.
        // Une seule transition vers SA session est attendue ; sortie/A→B→A
        // pendant le réseau invalide la réponse et tout droit de mot de passe.
        const event = attempt.event;
        if (attempt.interrupted || (event && (!['SIGNED_IN', 'PASSWORD_RECOVERY'].includes(event.type)
            || event.userId !== data.user.id || event.token !== data.session.access_token))
            || (revision !== current && !(revision === current + 1 && localSession?.access_token === data.session.access_token
              && localSession?.user?.id === data.user.id))) {
          revision++; passwordLinkUser = null; marker.clear(); publish('anonymous');
          throw new AuthError('La session a changé. Ouvre un nouveau lien personnel.', 'session_changed');
        }
        revision++; passwordLinkUser = data.user.id; localSession = data.session; marker.remember(localSession, data.user.id); publish('authenticated', data.user);
        return state.user;
      } finally { linkPending = false; linkAttempt = null; }
    },
    async updatePassword(password) {
      const problem = validatePassword(password, password);
      if (problem) throw new AuthError(problem, 'validation');
      if (!passwordLinkUser) throw new AuthError('Ouvre un nouveau lien d’invitation ou de réinitialisation.', 'invalid_link');
      const user = await requireUser();
      if (passwordLinkUser !== user.id) throw new AuthError('Ouvre un nouveau lien d’invitation ou de réinitialisation.', 'invalid_link');
      const current = revision;
      await run('password', () => client.auth.updateUser({ password }));
      if (current !== revision) throw new AuthError('La session a changé. Réessaie.', 'session_changed');
      passwordLinkUser = null;
    },
    async getProfile() {
      const user = await requireUser();
      const current = revision;
      const data = await run('profile', () => client.from('profiles').select('id,pseudo,created_at,updated_at').eq('id', user.id).single());
      if (current !== revision) throw new AuthError('La session a changé. Réessaie.', 'session_changed');
      return profileFrom(data, user.id);
    },
    async updateProfile(pseudo) {
      const problem = validatePseudo(pseudo);
      if (problem) throw new AuthError(problem, 'validation');
      const user = await requireUser();
      const current = revision;
      const data = await run('profile', () => client.from('profiles').update({ pseudo: pseudo?.trim() || null }).eq('id', user.id).select('id,pseudo,created_at,updated_at').single());
      if (current !== revision) throw new AuthError('La session a changé. Réessaie.', 'session_changed');
      return profileFrom(data, user.id);
    },
  };
  return service;
}

let servicePromise;
export function getAuthService() {
  if (!servicePromise) servicePromise = (async () => {
    let configuration;
    try { configuration = await getSupabaseClient(); }
    catch { configuration = { client: null, configurationError: 'network' }; }
    const service = createAuthService(configuration.client, configuration);
    await service.start();
    return service;
  })();
  return servicePromise;
}
