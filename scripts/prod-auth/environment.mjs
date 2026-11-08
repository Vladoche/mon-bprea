// Node opérateur exclusivement. Ce module ne configure ni le frontend ni Supabase.
export const PROD_PROJECT = 'oqoqrxwfbkhtpksqimgd';
export const PROD_API = `https://${PROD_PROJECT}.supabase.co`;
export const PROD_SITE = 'https://vladoche.github.io/mon-bprea/';
export const PROD_CALLBACK = `${PROD_SITE}authentification.html`;
export const MAX_ACCOUNTS = 7; // Limite administrative, pas une contrainte serveur.
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const TOKEN = /^[A-Za-z0-9_-]{20,512}$/;

const messages = {
  environment: 'Cible refusée : seul Mon BPREA PROD et son callback HTTPS exact sont autorisés.',
  key: 'Clé administrative moderne absente ou invalide. Les clés publiques et legacy sont refusées ; aucun secret en argument.',
  interactive: 'Node.js 24 et terminal privé interactif requis. Navigateur, CI, instrumentation et redirections sont refusés.',
  input: 'Saisir une seule adresse e-mail confirmée et le type invite ou recovery.',
  arguments: 'Usage : npm run admin:auth-link:prod -- check (ou invite, recovery). Aucun autre argument, batch ou confirmation automatique.',
  lookup: 'Inventaire Auth non confirmé. Aucune génération ; vérifier cible et habilitations en lecture seule.',
  configuration: 'Réglages Auth absents ou divergents : inscription fermée, anonymat refusé et fournisseur e-mail avec confirmation requis. Aucune génération.',
  capacity: 'Capacité administrative de sept comptes atteinte ou dépassée, invitations en attente comprises. Aucune invitation.',
  exists: 'Compte déjà présent, même en attente. Invitation refusée ; ne pas supprimer ou recréer ce compte.',
  missing: 'La récupération exige un compte existant dont l’adresse est confirmée. Aucune création.',
  pending: 'Une opération antérieure reste non acquittée pour cette cible. Arrêter ; diagnostic privé requis avant toute nouvelle décision.',
  confirmation: 'Confirmation individuelle exacte absente. Aucun lien généré.',
  private: 'Dossier privé existant, protégé et hors dépôt requis. Aucun lien ni réponse fournisseur affiché.',
  busy: 'Une opération opérateur est déjà verrouillée ou interrompue. Ne pas retirer le verrou sans diagnostic.',
  transport: 'Transport administratif refusé ou indisponible. Aucun détail sensible affiché.',
  uncertain: 'Résultat non confirmé : compte ou lien possiblement créé. Ne pas relancer, réinviter ou supprimer ; conserver la réservation et diagnostiquer.',
};
export class ProdAuthLinkError extends Error {
  constructor(code) { super(messages[code] || messages.uncertain); this.name = 'ProdAuthLinkError'; this.code = code; }
}
export const fail = code => { throw new ProdAuthLinkError(code); };
export const safeProdMessage = error => error instanceof ProdAuthLinkError ? messages[error.code] || messages.uncertain : messages.uncertain;

export function parseOperation(args) {
  if (args.length !== 1 || !['check', 'invite', 'recovery'].includes(args[0])) fail('arguments');
  return args[0];
}

export function defaultRuntime() {
  return { isNode: typeof process !== 'undefined' && !!process.versions?.node,
    nodeMajor: typeof process !== 'undefined' ? Number(process.versions?.node?.split('.')[0]) : 0,
    stdinTTY: typeof process !== 'undefined' && process.stdin?.isTTY === true,
    stdoutTTY: typeof process !== 'undefined' && process.stdout?.isTTY === true,
    hasBrowser: typeof window !== 'undefined' || typeof document !== 'undefined' };
}

export function validateProdEnvironment(env, runtime = defaultRuntime()) {
  if (!runtime?.isNode || runtime.nodeMajor !== 24 || !runtime.stdinTTY || !runtime.stdoutTTY || runtime.hasBrowser
      || ['CI', 'GITHUB_ACTIONS', 'GITLAB_CI', 'TF_BUILD', 'DEBUG', 'NODE_DEBUG', 'NODE_OPTIONS', 'NODE_V8_COVERAGE',
        'NODE_EXTRA_CA_CERTS', 'NODE_TLS_REJECT_UNAUTHORIZED', 'NODE_USE_ENV_PROXY', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY'].some(name =>
        Object.entries(env).some(([key, value]) => key.toUpperCase() === name && !!value))) fail('interactive');
  // Comparaison brute : refuse @, ports, slash ajouté, encodage et normalisation d’URL.
  if (env.SUPABASE_PROD_PROJECT_REF !== PROD_PROJECT || env.SUPABASE_PROD_URL !== PROD_API
      || env.SUPABASE_PROD_SITE_URL !== PROD_SITE) fail('environment');
  if (!/^sb_secret_[A-Za-z0-9_-]{16,256}$/.test(env.SUPABASE_PROD_ADMIN_KEY || '')) fail('key');
  if (typeof env.SUPABASE_PROD_PRIVATE_DIR !== 'string' || !env.SUPABASE_PROD_PRIVATE_DIR.trim()) fail('private');
  const operatorEmail = validateProdTarget('invite', env.SUPABASE_PROD_OPERATOR_EMAIL);
  return Object.freeze({ url: PROD_API, siteUrl: PROD_SITE, adminKey: env.SUPABASE_PROD_ADMIN_KEY,
    privateDirectory: env.SUPABASE_PROD_PRIVATE_DIR, operatorEmail });
}

export function validateProdTarget(type, email) {
  if (!['invite', 'recovery'].includes(type) || typeof email !== 'string') fail('input');
  const value = email.trim().toLowerCase(), [local = '', domain = ''] = value.split('@');
  if (value.length > 254 || local.length > 64 || !/^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+@[a-z0-9.-]+$/.test(value)
      || local.startsWith('.') || local.endsWith('.') || local.includes('..') || !domain.includes('.')
      || domain.split('.').some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) fail('input');
  return value;
}

export function validateProdCallback(value, expectedType) {
  try {
    if (typeof value !== 'string' || value.includes('#')) throw new Error();
    const url = new URL(value);
    if (value !== url.href || url.origin + url.pathname !== PROD_CALLBACK || url.username || url.password || url.hash
        || !['invite', 'recovery'].includes(expectedType)
        || [...url.searchParams.keys()].sort().join(',') !== 'token_hash,type'
        || url.searchParams.get('type') !== expectedType || !TOKEN.test(url.searchParams.get('token_hash') || '')) throw new Error();
    return url.href;
  } catch { fail('uncertain'); }
}

// Une instance par opération. Aucun autre endpoint, redirection, répétition de POST,
// mot de passe, métadonnée, suppression ou modification de rôle n’est autorisé.
export function prodAdminFetch({ type, email, fetcher = globalThis.fetch } = {}) {
  let generated = false;
  return async (input, options = {}) => {
    try {
      const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const url = new URL(raw), method = (options.method || 'GET').toUpperCase();
      if (raw !== url.href || url.origin !== PROD_API || url.username || url.password || url.hash || raw.includes('#')) fail('transport');
      if (method === 'GET' && raw === `${PROD_API}/auth/v1/settings`) {
        // Réglages publics du service, relus sans création ni génération de jeton.
      } else if (method === 'GET' && url.pathname === '/auth/v1/admin/users') {
        if ([...url.searchParams.keys()].sort().join(',') !== 'page,per_page'
            || url.searchParams.get('page') !== '1' || url.searchParams.get('per_page') !== '8') fail('transport');
      } else if (method === 'POST' && url.pathname === '/auth/v1/admin/generate_link' && !generated) {
        const body = JSON.parse(options.body);
        if (!['invite', 'recovery'].includes(type) || validateProdTarget(type, email) !== email
            || [...url.searchParams.keys()].join(',') !== 'redirect_to' || url.searchParams.get('redirect_to') !== PROD_CALLBACK
            || Object.keys(body).sort().join(',') !== 'email,redirectTo,type'
            || body.type !== type || body.email !== email || body.redirectTo !== PROD_CALLBACK) fail('transport');
        generated = true; // Dépense avant envoi ; aucune reprise après réponse incertaine.
      } else fail('transport');
      return await fetcher(raw, { ...options, redirect: 'error', signal: AbortSignal.timeout(10_000) });
    } catch { fail('transport'); }
  };
}
