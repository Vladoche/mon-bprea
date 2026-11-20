// Génération séparée des contrôles d’environnement et du stockage privé.
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { PROD_API, PROD_PROJECT, PROD_CALLBACK, MAX_ACCOUNTS, INVENTORY_PAGE_SIZE, UUID, TOKEN, fail,
  validateProdEnvironment, validateProdTarget, validateProdCallback, prodAdminFetch } from './environment.mjs';

export function createProdLinkAdmin(env, { type, email, runtime } = {}) {
  const configuration = validateProdEnvironment(env, runtime);
  const fetcher = prodAdminFetch({ type, email });
  const admin = createClient(configuration.url, configuration.adminKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, debug: false },
    global: { fetch: fetcher },
  }).auth.admin;
  const headers = { apikey: configuration.adminKey, Authorization: `Bearer ${configuration.adminKey}` };
  return {
    async listUsers({ page, perPage }) {
      // Read the REST count directly. The SDK can default it to zero when Link is absent.
      const response = await fetcher(`${PROD_API}/auth/v1/admin/users?page=${page}&per_page=${perPage}`, { headers });
      if (!response.ok) fail('lookup');
      const total = response.headers.get('x-total-count');
      return { data: await response.json(), total: /^\d+$/.test(total ?? '') ? Number(total) : null,
        hasNextPage: /rel\s*=\s*"?next/i.test(response.headers.get('link') ?? '') };
    },
    generateLink: parameters => admin.generateLink(parameters),
    async getSettings() {
      const response = await fetcher(`${PROD_API}/auth/v1/settings`, { headers });
      if (!response.ok) fail('configuration');
      return response.json();
    },
  };
}

export async function inspectProdAuthSettings(admin) {
  try {
    const settings = await admin.getSettings(), external = settings?.external;
    if (settings?.disable_signup !== true || settings.mailer_autoconfirm !== false
        || !external || typeof external !== 'object' || Array.isArray(external)
        || external.email !== true || external.anonymous_users !== false
        || Object.entries(external).some(([provider, enabled]) => provider !== 'email' && enabled !== false)
        || (Object.hasOwn(settings, 'anonymous_users_enabled') && settings.anonymous_users_enabled !== false)) fail('configuration');
    return { signupDisabled: true, anonymousDisabled: true, emailEnabled: true, emailConfirmationRequired: true };
  } catch { fail('configuration'); }
}

export async function inspectProdAccounts(admin, email) {
  let result;
  try { result = await admin.listUsers({ page: 1, perPage: INVENTORY_PAGE_SIZE }); } catch { fail('lookup'); }
  const data = result?.data;
  const users = data?.users;
  if (result?.error || !Array.isArray(users)) fail('lookup');
  if (users.length > MAX_ACCOUNTS) fail('capacity_exceeded');
  if (result.total !== users.length || result.hasNextPage
      || ['total', 'total_count'].some(name => Object.hasOwn(data, name) && data[name] !== users.length)
      || (data.next_page != null && data.next_page !== 0)
      || (Object.hasOwn(data, 'last_page') && ![0, 1].includes(data.last_page))
      || (Object.hasOwn(data, 'has_more') && data.has_more !== false) || data.next_cursor != null) fail('lookup');
  const ids = new Set(), emails = new Set();
  for (const user of users) {
    let target;
    try { target = validateProdTarget('invite', user?.email); } catch { fail('lookup'); }
    if (!UUID.test(user?.id || '') || target !== user.email.toLowerCase() || ids.has(user.id.toLowerCase()) || emails.has(target)) fail('lookup');
    ids.add(user.id.toLowerCase()); emails.add(target);
  }
  return { count: users.length, existing: users.find(user => user.email.toLowerCase() === email) || null,
    emails: [...emails], snapshot: createHash('sha256').update(JSON.stringify(users.map(user =>
      [user.id, user.email.toLowerCase(), user.email_confirmed_at || null]).sort((a, b) => a[0].localeCompare(b[0])))).digest('hex') };
}

export async function checkProdConfiguration({ env, makeAdmin = createProdLinkAdmin, runtime }) {
  const configuration = validateProdEnvironment(env, runtime);
  const admin = makeAdmin(env, { runtime });
  await inspectProdAuthSettings(admin);
  const { count, emails } = await inspectProdAccounts(admin);
  return { project: PROD_PROJECT, status: 'checked-read-only', accounts: count, capacity: MAX_ACCOUNTS,
    callback: PROD_CALLBACK, operatorPlaceReserved: !emails.includes(configuration.operatorEmail), authSettingsChecked: true };
}

export function buildProdManualLink(data, { type, email, expectedId }) {
  const target = validateProdTarget(type, email);
  try {
    const properties = data?.properties, user = data?.user;
    if (!UUID.test(user?.id || '') || user.email?.toLowerCase() !== target || (expectedId && user.id !== expectedId)
        || properties?.verification_type !== type || properties.redirect_to !== PROD_CALLBACK
        || !TOKEN.test(properties.hashed_token || '') || typeof properties.action_link !== 'string'
        || properties.action_link.includes('#')) throw new Error();
    const action = new URL(properties.action_link);
    if (properties.action_link !== action.href || action.origin !== PROD_API || action.pathname !== '/auth/v1/verify' || action.username || action.password || action.hash
        || [...action.searchParams.keys()].sort().join(',') !== 'redirect_to,token,type'
        || action.searchParams.get('token') !== properties.hashed_token || action.searchParams.get('type') !== type
        || action.searchParams.get('redirect_to') !== PROD_CALLBACK) throw new Error();
    const link = new URL(PROD_CALLBACK);
    link.searchParams.set('token_hash', properties.hashed_token); link.searchParams.set('type', type);
    return validateProdCallback(link.href, type);
  } catch { fail('uncertain'); }
}

export async function generateProdAuthLink({ env, type, email, confirm, deliver, makeAdmin = createProdLinkAdmin,
  store, runtime }) {
  const configuration = validateProdEnvironment(env, runtime);
  const target = validateProdTarget(type, email);
  if (!store || typeof confirm !== 'function' || typeof deliver !== 'function') fail('private');
  return store.withLock(async () => {
    if (await store.read(target)) fail('pending');
    const admin = makeAdmin(env, { type, email: target, runtime });
    await inspectProdAuthSettings(admin);
    const inventory = await inspectProdAccounts(admin, target);
    const { count, existing, emails } = inventory;
    if (type === 'invite' && existing) fail('exists');
    const operatorPlaceReserved = !emails.includes(configuration.operatorEmail) && target !== configuration.operatorEmail;
    if (type === 'invite' && count + Number(operatorPlaceReserved) >= MAX_ACCOUNTS) fail('capacity');
    if (type === 'recovery' && (!existing || !Number.isFinite(Date.parse(existing.email_confirmed_at)))) fail('missing');
    const confirmation = await confirm({ project: PROD_PROJECT, type, email: target, count,
      existingConfirmed: !!existing?.email_confirmed_at, operatorPlaceReserved });
    if (confirmation !== `CONFIRMER PROD ${type} ${target}`) fail('confirmation');
    // Une décision humaine peut prendre du temps : l’inventaire doit rester identique.
    await inspectProdAuthSettings(admin);
    if ((await inspectProdAccounts(admin, target)).snapshot !== inventory.snapshot) fail('lookup');
    // Réservation durable AVANT la seule opération possiblement créatrice de compte.
    const operationId = await store.reserve(target, type);
    try {
      const result = await admin.generateLink({ type, email: target, options: { redirectTo: PROD_CALLBACK } });
      if (result?.error) fail('uncertain');
      const link = buildProdManualLink(result?.data, { type, email: target, expectedId: existing?.id });
      // Pas de lien retourné ni journalisé ; le destinataire reçoit un fichier privé.
      await deliver(link, { operationId, type });
      await store.markDelivered(target, operationId);
      return { type, status: 'delivered-private', accountsBefore: count };
    } catch { fail('uncertain'); }
  });
}
