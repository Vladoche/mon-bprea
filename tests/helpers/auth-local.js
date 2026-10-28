// Préparation de comptes fictifs sur la stack LOCALE dédiée. Aucun mock Auth/DB.
// Les clés administratives restent dans le processus Node et ne sont jamais
// transmises à la page, aux assertions ou aux journaux.
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createClient } from '@supabase/supabase-js';

const project = 'mon-bprea-lot6-1-local';
export const LOCAL_SITE = 'http://127.0.0.1:4173/mon-bprea/';
export const LOCAL_CALLBACK = `${LOCAL_SITE}authentification.html`;

function localEndpoint(value, port) {
  try {
    const endpoint = new URL(value);
    if (endpoint.origin !== `http://127.0.0.1:${port}` || endpoint.pathname !== '/'
        || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error();
    return endpoint.origin;
  } catch { throw new Error('E2E Supabase non exécutés : seul un endpoint de la stack locale dédiée est autorisé.'); }
}

export function getLocalSupabaseEnvironment() {
  const envFile = fileURLToPath(new URL('../../.env.supabase-test.local', import.meta.url));
  if (existsSync(envFile)) {
    try { process.loadEnvFile(envFile); }
    catch { throw new Error('E2E Supabase non exécutés : fichier de configuration locale illisible.'); }
  }
  if (process.env.SUPABASE_TEST_CONFIRM_LOCAL !== project)
    throw new Error(`E2E Supabase non exécutés : définir SUPABASE_TEST_CONFIRM_LOCAL=${project} pour la stack locale dédiée.`);
  const url = localEndpoint(process.env.SUPABASE_TEST_URL || 'http://127.0.0.1:54321', 54321);
  const mailUrl = localEndpoint(process.env.SUPABASE_TEST_MAIL_URL || 'http://127.0.0.1:54324', 54324);
  const publishableKey = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
  const adminKey = process.env.SUPABASE_TEST_ADMIN_KEY;
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey || '') || !/^sb_secret_[A-Za-z0-9_-]+$/.test(adminKey || ''))
    throw new Error('E2E Supabase non exécutés : clés modernes publishable et secret LOCALES manquantes ; consulter supabase status.');
  const config = readFileSync(new URL('../../supabase/config.toml', import.meta.url), 'utf8');
  if (!/project_id\s*=\s*"mon-bprea-lot6-1-local"/.test(config)
      || !/site_url\s*=\s*"http:\/\/127\.0\.0\.1:4173\/mon-bprea\/"/.test(config)
      || !/enable_signup\s*=\s*false/.test(config))
    throw new Error('E2E Supabase non exécutés : configuration de la stack locale dédiée incorrecte.');
  return { url, mailUrl, publishableKey, adminKey };
}

async function localJson(target) {
  try {
    const response = await fetch(target, { signal: AbortSignal.timeout(3000) });
    let data;
    try { data = await response.json(); } catch { data = null; }
    return { response, data };
  } catch { throw new Error('Le service de capture SMTP local est indisponible.'); }
}

function callbackFrom(content, type) {
  const links = content.replaceAll('&amp;', '&').match(/https?:\/\/[^\s<>"']+/g) || [];
  for (const link of links) {
    let parsed;
    try { parsed = new URL(link); } catch { continue; }
    if (parsed.searchParams.get('type') !== type) continue;
    if (parsed.origin + parsed.pathname !== LOCAL_CALLBACK || parsed.hash
        || [...parsed.searchParams.keys()].sort().join(',') !== 'token_hash,type')
      throw new Error('Le modèle d’e-mail ne vise pas exclusivement le callback local attendu.');
    const token = parsed.searchParams.get('token_hash');
    if (!/^[A-Za-z0-9_-]{20,512}$/.test(token || ''))
      throw new Error('Le modèle d’e-mail ne fournit pas le token_hash attendu.');
    return parsed.href;
  }
  return null;
}

// La lecture est bornée et ne supprime aucun message. Seule l’adresse fictive
// de CE run est consultée ; aucun service SMTP externe n’est utilisé.
async function capturedCallback(mailUrl, email, type) {
  const deadline = Date.now() + 15_000;
  const mailbox = encodeURIComponent(email.split('@')[0]);
  while (Date.now() < deadline) {
    const bucket = await localJson(`${mailUrl}/api/v1/mailbox/${mailbox}`);
    if (bucket.response.ok && Array.isArray(bucket.data)) {
      for (const item of bucket.data.toReversed()) {
        const message = await localJson(`${mailUrl}/api/v1/mailbox/${mailbox}/${encodeURIComponent(item.id)}`);
        const link = callbackFrom(`${message.data?.body?.html || ''}\n${message.data?.body?.text || ''}`, type);
        if (link) return link;
      }
    }
    const pit = await localJson(`${mailUrl}/api/v1/messages`);
    if (pit.response.ok && Array.isArray(pit.data?.messages)) {
      for (const item of pit.data.messages) {
        if (!item.To?.some(recipient => recipient.Address === email)) continue;
        const message = await localJson(`${mailUrl}/api/v1/message/${encodeURIComponent(item.ID)}`);
        const link = callbackFrom(`${message.data?.HTML || ''}\n${message.data?.Text || ''}`, type);
        if (link) return link;
      }
    }
    await delay(150);
  }
  throw new Error('Aucun e-mail local correspondant reçu : vérifier les modèles et la capture SMTP locale.');
}

export function createLocalAuthFixture(environment) {
  const run = `lot61-ui-${randomUUID()}`;
  const email = `${run}@example.test`;
  const password = `Invitation!${randomUUID()}`;
  const replacement = `Recuperation!${randomUUID()}`;
  let userId = null;
  const admin = createClient(environment.url, environment.adminKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, flowType: 'pkce' },
  });
  return {
    email, password, replacement,
    async invite() {
      let result;
      try { result = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: LOCAL_CALLBACK }); }
      catch { throw new Error('L’invitation administrative locale n’a pas pu être envoyée.'); }
      userId = result?.data?.user?.id || null;
      if (result.error || !userId) throw new Error('L’invitation administrative locale a été refusée.');
      return capturedCallback(environment.mailUrl, email, 'invite');
    },
    recoveryLink() { return capturedCallback(environment.mailUrl, email, 'recovery'); },
    async cleanup() {
      if (!userId) return;
      if (email !== `${run}@example.test` || !/^[0-9a-f-]{36}$/i.test(userId))
        throw new Error('Le nettoyage ne peut viser que le compte fictif créé par ce run.');
      let result;
      try { result = await admin.auth.admin.deleteUser(userId); }
      catch { throw new Error('Nettoyage local incomplet du seul compte fictif créé par ce run.'); }
      if (result.error && !(result.error.status === 404 && result.error.code === 'user_not_found')) throw new Error('Nettoyage local incomplet du seul compte fictif créé par ce run.');
      userId = null;
    },
  };
}

export async function configureLocalAuthPage(page, environment) {
  // Configuration de transport uniquement : toutes les requêtes Auth et
  // PostgREST sont réellement servies par la stack locale Supabase.
  await page.route('**/assets/auth-config.json*', route => route.fulfill({ json: {
    enabled: true, environment: 'development', url: environment.url,
    publishableKey: environment.publishableKey, siteUrl: LOCAL_SITE,
  } }));
}

export async function openCapturedLink(page, link) {
  // Un échec de goto ne doit pas inclure son URL à usage unique dans le rapport.
  try { await page.goto(link); }
  catch { throw new Error('La page de retour locale n’a pas pu être chargée (lien masqué).'); }
}
