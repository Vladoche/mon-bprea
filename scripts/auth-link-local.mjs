// Node exclusivement : jamais importé par assets/ ni copié dans Pages.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

export const LOCAL_PROJECT = 'mon-bprea-lot6-1-local';
export const LOCAL_API = 'http://127.0.0.1:54321';
export const LOCAL_SITE = 'http://127.0.0.1:4173/mon-bprea/';
export const LOCAL_CALLBACK = new URL('authentification.html', LOCAL_SITE).href;
const tokenPattern = /^[A-Za-z0-9_-]{20,512}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const messages = {
  environment: 'Cible refusée : seule la stack mon-bprea-lot6-1-local, API 127.0.0.1:54321 et site local /mon-bprea/, est autorisée. DEV et PROD sont bloqués.',
  key: 'Clé administrative locale absente ou de format invalide. Aucun secret ne doit être passé en argument.',
  input: 'Saisir une seule adresse e-mail valide et le type invite ou recovery.',
  arguments: 'Usage : npm run admin:auth-link -- invite (ou recovery). Aucun autre argument ni traitement en masse.',
  confirmation: 'Opération annulée : confirmation explicite absente. Aucun lien généré.',
  interactive: 'Un terminal privé interactif est requis. Pipes, CI et redirections de sortie sont refusés ; aucun appel administratif.',
  lookup: 'Impossible de confirmer le compte local. Aucune génération effectuée ; vérifier la stack et les habilitations.',
  exists: 'Compte déjà existant, même si non activé. Aucun lien régénéré. Examiner la cible et le lien déjà transmis avant une reprise contrôlée.',
  missing: 'Aucun compte correspondant. Récupération refusée sans création de compte.',
  uncertain: 'Résultat administratif non confirmé. Un compte ou un lien peut avoir été créé. Ne pas relancer ni supprimer le compte ; suivre la procédure de diagnostic ciblé.',
  transport: 'Requête refusée ou service local indisponible. Aucun détail sensible affiché.',
};
export class LocalAuthLinkError extends Error {
  constructor(code) { super(messages[code] || messages.uncertain); this.name = 'LocalAuthLinkError'; this.code = code; }
}
export const safeAdminMessage = error => error instanceof LocalAuthLinkError ? messages[error.code] || messages.uncertain : messages.uncertain;

export function parseOperation(args) {
  if (args.length !== 1 || !['invite', 'recovery'].includes(args[0])) throw new LocalAuthLinkError('arguments');
  return args[0];
}

export function validateTarget(type, email) {
  // Une seule boîte ASCII, sans nom affiché, séparateur, contrôle ou commande terminal.
  if (!['invite', 'recovery'].includes(type) || typeof email !== 'string') throw new LocalAuthLinkError('input');
  const value = email.trim().toLowerCase();
  const [local = '', domain = ''] = value.split('@');
  if (value.length > 254 || local.length > 64 || !/^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+@[a-z0-9.-]+$/.test(value)
      || local.startsWith('.') || local.endsWith('.') || local.includes('..') || !domain.includes('.')
      || domain.split('.').some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)))
    throw new LocalAuthLinkError('input');
  return value;
}

export function maskedTarget(email) {
  const value = validateTarget('invite', email);
  const [local, domain] = value.split('@');
  return `${local[0]}…@${domain}`;
}

export function validateLocalEnvironment(env, config = readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8')) {
  // Comparaison AVANT normalisation URL : refuse aussi @ vide, chemins normalisés,
  // IPv4 abrégées, encodages, fragments vides, noms DNS et ports implicites.
  const url = env.SUPABASE_TEST_URL || LOCAL_API;
  const site = env.SUPABASE_TEST_SITE_URL || LOCAL_SITE;
  if (env.SUPABASE_TEST_CONFIRM_LOCAL !== LOCAL_PROJECT || ![LOCAL_API, `${LOCAL_API}/`].includes(url) || site !== LOCAL_SITE)
    throw new LocalAuthLinkError('environment');
  const section = name => config.match(new RegExp(`^\\[${name}\\]\\s*$([\\s\\S]*?)(?=^\\[|$(?![\\s\\S]))`, 'm'))?.[1] || '';
  if (!/^project_id\s*=\s*"mon-bprea-lot6-1-local"\s*$/m.test(config)
      || !/^port\s*=\s*54321\s*$/m.test(section('api'))
      || !/^site_url\s*=\s*"http:\/\/127\.0\.0\.1:4173\/mon-bprea\/"\s*$/m.test(section('auth'))
      || !/^enable_signup\s*=\s*false\s*$/m.test(section('auth'))
      || !/^enable_anonymous_sign_ins\s*=\s*false\s*$/m.test(section('auth')))
    throw new LocalAuthLinkError('environment');
  if (!/^sb_secret_[A-Za-z0-9_-]{16,256}$/.test(env.SUPABASE_TEST_ADMIN_KEY || '')) throw new LocalAuthLinkError('key');
  return Object.freeze({ url: LOCAL_API, siteUrl: LOCAL_SITE, adminKey: env.SUPABASE_TEST_ADMIN_KEY });
}

export function validateCallbackLink(value, expectedType) {
  try {
    if (typeof value !== 'string' || value.includes('#')) throw new Error();
    const link = new URL(value);
    if (link.origin + link.pathname !== LOCAL_CALLBACK || link.username || link.password || link.hash
        || [...link.searchParams.keys()].sort().join(',') !== 'token_hash,type'
        || !['invite', 'recovery'].includes(expectedType) || link.searchParams.get('type') !== expectedType
        || !tokenPattern.test(link.searchParams.get('token_hash') || '')) throw new Error();
    return link.href;
  } catch { throw new LocalAuthLinkError('uncertain'); }
}

export function buildManualLink(data, { type, email }) {
  const target = validateTarget(type, email);
  try {
    const properties = data?.properties;
    if (!uuidPattern.test(data?.user?.id || '') || data.user.email?.toLowerCase() !== target
        || !properties || properties.verification_type !== type || properties.redirect_to !== LOCAL_CALLBACK
        || !tokenPattern.test(properties.hashed_token || '')) throw new Error();
    // action_link est analysé mais jamais ouvert, transmis ou affiché : /verify
    // consommerait le secret à l'ouverture. Seul hashed_token est réutilisé.
    if (typeof properties.action_link !== 'string' || properties.action_link.includes('#')) throw new Error();
    const action = new URL(properties.action_link);
    if (action.origin !== LOCAL_API || action.pathname !== '/auth/v1/verify' || action.username || action.password || action.hash
        || [...action.searchParams.keys()].sort().join(',') !== 'redirect_to,token,type'
        || action.searchParams.get('token') !== properties.hashed_token || action.searchParams.get('type') !== type
        || action.searchParams.get('redirect_to') !== LOCAL_CALLBACK) throw new Error();
    const link = new URL(LOCAL_CALLBACK);
    link.searchParams.set('token_hash', properties.hashed_token);
    link.searchParams.set('type', type);
    return validateCallbackLink(link.href, type);
  } catch { throw new LocalAuthLinkError('uncertain'); }
}

export function localAdminFetch(fetcher = globalThis.fetch) {
  return async (input, options = {}) => {
    try {
      const target = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
      const method = (options.method || 'GET').toUpperCase();
      if (target.origin !== LOCAL_API || target.username || target.password || target.hash
          || !((method === 'POST' && target.pathname === '/auth/v1/admin/generate_link')
            || (method === 'GET' && target.pathname === '/auth/v1/admin/users'))) throw new Error();
      return await fetcher(target.href, { ...options, redirect: 'error', signal: AbortSignal.timeout(10_000) });
    } catch { throw new LocalAuthLinkError('transport'); }
  };
}

export function createLocalLinkAdmin(env) {
  const configuration = validateLocalEnvironment(env);
  return createClient(configuration.url, configuration.adminKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: localAdminFetch() },
  }).auth.admin;
}

// Lecture bornée, exclusivement locale. Un compte en attente bloque aussi invite :
// generateLink pourrait autrement remplacer silencieusement un lien déjà remis.
async function findTarget(admin, email) {
  for (let page = 1; page <= 100; page++) {
    let result;
    try { result = await admin.listUsers({ page, perPage: 100 }); } catch { throw new LocalAuthLinkError('lookup'); }
    if (result?.error || !Array.isArray(result?.data?.users)) throw new LocalAuthLinkError('lookup');
    const found = result.data.users.find(user => user.email?.toLowerCase() === email);
    if (found) return found;
    if (result.data.users.length < 100) return null;
  }
  throw new LocalAuthLinkError('lookup');
}

export async function generateManualAuthLink({ env, type, email, confirm, present, makeAdmin = createLocalLinkAdmin }) {
  validateLocalEnvironment(env);
  const target = validateTarget(type, email);
  // Aucune requête administrative, même de lecture, avant confirmation.
  if (await confirm({ type, target: maskedTarget(target), project: LOCAL_PROJECT }) !== true) throw new LocalAuthLinkError('confirmation');
  const admin = makeAdmin(env);
  const existing = await findTarget(admin, target);
  if (type === 'invite' && existing) throw new LocalAuthLinkError('exists');
  if (type === 'recovery' && !existing) throw new LocalAuthLinkError('missing');
  try {
    // Une seule tentative ; ni mot de passe ni métadonnée de permission.
    const result = await admin.generateLink({ type, email: target, options: { redirectTo: LOCAL_CALLBACK } });
    if (result?.error) {
      if (result.error.code === 'email_exists') throw new LocalAuthLinkError('exists');
      if (result.error.code === 'user_not_found') throw new LocalAuthLinkError('missing');
      throw new LocalAuthLinkError('uncertain');
    }
    const link = buildManualLink(result?.data, { type, email: target });
    if (existing && result.data.user.id !== existing.id) throw new LocalAuthLinkError('uncertain');
    await present(link); // Remise unique, pas de retour contenant le secret.
    return { type, status: 'presented' };
  } catch (error) {
    if (error instanceof LocalAuthLinkError && ['exists', 'missing'].includes(error.code)) throw error;
    throw new LocalAuthLinkError('uncertain');
  }
}
