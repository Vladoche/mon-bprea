// Outils opérateur Node uniquement. Aucun import frontend, aucune cible configurable.
export const DEV_PROJECT = 'wcckbyhrtroittbfophv';
export const DEV_API = `https://${DEV_PROJECT}.supabase.co`;
export const DEV_SITE = 'http://127.0.0.1:4173/mon-bprea/';
export const DEV_CALLBACK = `${DEV_SITE}authentification.html`;
export const TABLES = Object.freeze(['profiles', 'drill_series', 'drill_answers', 'drill_training_attempts',
  'course_states', 'quiz_attempts', 'botanical_sessions', 'botanical_answers', 'itk_settings', 'appearance_preferences']);
export const RPCS = Object.freeze(['drill_create_series', 'drill_record_answer', 'drill_record_training',
  'personal_save_course', 'personal_record_quiz', 'personal_save_botanical_session', 'personal_record_botanical_answer',
  'personal_save_itk', 'personal_save_appearance']);
export const MAX_MUTATIONS = 140; // Requêtes pédagogiques, retries et refus compris ; <= 150 lignes applicatives.
export const MAX_AUTH_REQUESTS = 60; // verify, connexions, refresh, mots de passe et déconnexions navigateur.
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const runPattern = /^r654b-\d{8}-[a-f0-9]{12}$/;
const shaPattern = /^[a-f0-9]{40}$/;
const messages = {
  target: 'Cible refusée : seul le DEV wcckbyhrtroittbfophv et son callback local exact sont admis. PROD et toute autre cible sont bloqués.',
  input: 'Run, SHA, acteur ou opération hors contrat. Seulement invite A, invite B et recovery A.',
  approval: 'Autorisation ou préflight frais absent. Aucun appel administratif effectué.',
  key: 'Clé administrative moderne absente ou invalide ; environnement du processus uniquement.',
  transport: 'Transport administratif refusé. Aucun détail fournisseur affiché.',
  uncertain: 'Résultat incertain : arrêter et relire uniquement la cible du run. Ne pas relancer, régénérer ou supprimer.',
  spent: 'Créneau déjà réservé ou résultat non confirmé. Aucun retry automatique ou manuel par cet outil.',
  private: 'Terminal privé interactif requis ; CI, logs de diagnostic et redirections refusés.',
  artifact: 'Artefact local absent, divergent ou chemin non admis. Aucun serveur démarré.',
};
export class RecipeError extends Error {
  constructor(code) { super(messages[code] || messages.uncertain); this.name = 'RecipeError'; this.code = code; }
}
export const fail = code => { throw new RecipeError(code); };
export const safeMessage = error => error instanceof RecipeError ? error.message : messages.uncertain;

// Les processus non Node (Git/Python/Chromium) ne doivent pas hériter de la clé
// administrative ni des jetons/diagnostics privés du terminal opérateur.
export function publicProcessEnvironment(env) {
  const allowed = new Set(['PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'TEMP', 'TMP', 'TMPDIR',
    'HOME', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA', 'PROGRAMDATA', 'PROGRAMFILES', 'PROGRAMFILES(X86)',
    'HOMEDRIVE', 'HOMEPATH', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TZ', 'DISPLAY', 'WAYLAND_DISPLAY',
    'XDG_RUNTIME_DIR', 'DBUS_SESSION_BUS_ADDRESS', 'LD_LIBRARY_PATH', 'NUMBER_OF_PROCESSORS', 'OS']);
  return Object.fromEntries(Object.entries(env).filter(([name]) => allowed.has(name.toUpperCase())));
}

export function validateRun(run, sha) {
  if (!runPattern.test(run || '') || !shaPattern.test(sha || '')) fail('input');
}
export function syntheticEmail(run, actor) {
  if (!runPattern.test(run || '') || !['A', 'B'].includes(actor)) fail('input');
  return `mon-bprea-${run}-${actor.toLowerCase()}@example.invalid`;
}
export function operationSlot(type, actor) {
  if (!((type === 'invite' && ['A', 'B'].includes(actor)) || (type === 'recovery' && actor === 'A'))) fail('input');
  return `${type}-${actor}`;
}
export function validateEnvironment(env) {
  // Comparaisons brutes AVANT URL : aucun alias, port explicite, @, fragment vide ou encodage normalisé.
  if (env.MON_BPREA_DEV_PROJECT !== DEV_PROJECT || env.MON_BPREA_DEV_URL !== DEV_API
      || env.MON_BPREA_DEV_SITE !== DEV_SITE) fail('target');
  const url = new URL(env.MON_BPREA_DEV_URL);
  if (url.hostname !== `${DEV_PROJECT}.supabase.co` || url.protocol !== 'https:' || url.username || url.password) fail('target');
  return { url: DEV_API, siteUrl: DEV_SITE };
}
export function publicConfiguration(key) {
  if (!/^sb_publishable_[A-Za-z0-9_-]{16,256}$/.test(key || '')) fail('key');
  return { enabled: true, environment: 'development', url: DEV_API, publishableKey: key, siteUrl: DEV_SITE };
}

export function validatePreflight(proof, run, sha, now = Date.now(), type = 'invite', actor = 'A') {
  validateRun(run, sha);
  // Attestation opérateur issue de lectures réelles, pas une preuve cryptographique.
  if (proof?.project !== DEV_PROJECT || proof.run !== run || proof.sha !== sha || proof.name !== 'Mon BPREA DEV'
      || proof.region !== 'eu-west-1' || proof.plan !== 'free' || proof.status !== 'ACTIVE_HEALTHY'
      || proof.callback !== DEV_CALLBACK || proof.schemaAndPrivilegesReviewed !== true
      || proof.authAndDataApiReviewed !== true || proof.protectionAccepted !== true
      || (type === 'invite' ? proof.absent?.[actor] !== true : proof.present?.A !== true)
      || !Number.isFinite(Date.parse(proof.checkedAt)) || now < Date.parse(proof.checkedAt)
      || now - Date.parse(proof.checkedAt) > 5 * 60_000) fail('approval');
}

export function buildDevLink(data, type, email, expectedId) {
  try {
    const p = data?.properties, user = data?.user;
    if (!UUID.test(user?.id || '') || user.email !== email || (expectedId && user.id !== expectedId)
        || p?.verification_type !== type || p.redirect_to !== DEV_CALLBACK
        || !/^[A-Za-z0-9_-]{20,512}$/.test(p.hashed_token || '')) fail('uncertain');
    const action = new URL(p.action_link);
    if (action.origin + action.pathname !== `${DEV_API}/auth/v1/verify` || action.username || action.password
        || action.hash || p.action_link.includes('#')
        || [...action.searchParams.keys()].sort().join(',') !== 'redirect_to,token,type'
        || action.searchParams.get('redirect_to') !== DEV_CALLBACK || action.searchParams.get('type') !== type
        || action.searchParams.get('token') !== p.hashed_token) fail('uncertain');
    const callback = new URL(DEV_CALLBACK);
    callback.searchParams.set('token_hash', p.hashed_token);
    callback.searchParams.set('type', type);
    return callback.href;
  } catch { fail('uncertain'); }
}

export function boundedAdminFetch({ type, email, userId, fetcher = globalThis.fetch }) {
  let generated = false, read = false;
  return async (input, options = {}) => {
    try {
      const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = (options.method || 'GET').toUpperCase();
      const endpoint = new URL(`${DEV_API}/auth/v1/admin/generate_link`);
      endpoint.searchParams.set('redirect_to', DEV_CALLBACK);
      if (method === 'POST' && raw === endpoint.href && !generated) {
        const body = JSON.parse(options.body);
        if (Object.keys(body).sort().join(',') !== 'email,redirectTo,type' || body.email !== email
            || body.type !== type || body.redirectTo !== DEV_CALLBACK) fail('transport');
        generated = true; // Dépense AVANT envoi : aucun retry après panne/réponse HTTP.
      } else if (method === 'GET' && UUID.test(userId || '') && !read && raw === `${DEV_API}/auth/v1/admin/users/${userId}`) {
        read = true;
      } else fail('transport');
      return await fetcher(raw, { ...options, redirect: 'error', signal: AbortSignal.timeout(10_000) });
    } catch { fail('transport'); }
  };
}

export function browserGate({ getIds, getEmails, mayVerify, mayWrite, consumeMutation, consumeAuth, publicKey }) {
  return ({ url: raw, method, headers = {}, body = '' }) => {
    try {
      const url = new URL(raw);
      if (url.username || url.password || url.hash) return false;
      if (url.origin === new URL(DEV_SITE).origin)
        return method === 'GET' && url.pathname.startsWith('/mon-bprea/');
      if (url.origin !== DEV_API || headers.apikey !== publicKey) return false;
      const auth = headers.authorization || '';
      if (auth.includes('sb_secret_') || auth.includes('service_role')) return false;
      const payload = auth.startsWith('Bearer ey') ? JSON.parse(Buffer.from(auth.slice(7).split('.')[1], 'base64url')) : null;
      if (payload && (payload.role !== 'authenticated' || !getIds().includes(payload.sub))) return false;
      if (url.pathname.startsWith('/auth/v1/')) {
        if (method === 'GET') return url.pathname === '/auth/v1/user' && !!payload;
        let allowed = false;
        if (method === 'POST' && url.pathname === '/auth/v1/token')
          allowed = url.searchParams.get('grant_type') === 'refresh_token'
            || (url.searchParams.get('grant_type') === 'password' && getEmails().includes(JSON.parse(body).email));
        if (method === 'POST' && url.pathname === '/auth/v1/verify')
          allowed = mayVerify(JSON.parse(body));
        if (method === 'POST' && url.pathname === '/auth/v1/logout') allowed = !!payload;
        if (method === 'PUT' && url.pathname === '/auth/v1/user' && !!payload)
          allowed = Object.keys(JSON.parse(body)).join(',') === 'password';
        return allowed && consumeAuth();
      }
      if (!url.pathname.startsWith('/rest/v1/')) return false;
      const table = url.pathname.slice('/rest/v1/'.length);
      // V doit atteindre réellement PostgREST : un refus de ce garde ne prouve pas le refus serveur.
      if (method === 'GET') return TABLES.includes(table);
      if (!mayWrite() || body.length > 200_000) return false;
      const value = JSON.parse(body);
      if (!value || Array.isArray(value) || typeof value !== 'object') return false;
      if (value.user_id && !getIds().includes(value.user_id)) return false;
      if (value.id && table === 'profiles' && !getIds().includes(value.id)) return false;
      if (!((method === 'POST' && (TABLES.includes(table) || RPCS.includes(table.replace(/^rpc\//, ''))))
          || (method === 'PATCH' && TABLES.includes(table)))) return false;
      return consumeMutation();
    } catch { return false; }
  };
}
