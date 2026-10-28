// Fixtures exclusivement synthétiques de la stack éphémère, jamais côté page.
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createLocalLinkAdmin, generateManualAuthLink, LOCAL_PROJECT, validateLocalEnvironment } from '../../scripts/auth-link-local.mjs';

export function createManualAuthFixture(environment) {
  const env = { SUPABASE_TEST_CONFIRM_LOCAL: process.env.SUPABASE_TEST_CONFIRM_LOCAL,
    SUPABASE_TEST_URL: environment.url, SUPABASE_TEST_ADMIN_KEY: environment.adminKey };
  validateLocalEnvironment(env);
  const run = `lot653a-${randomUUID()}`;
  const email = `${run}@example.test`;
  const owned = new Map();
  const linkAdmin = createLocalLinkAdmin(env);
  const adminClient = createClient(environment.url, environment.adminKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (url, options = {}) => {
      if (new URL(url).origin !== 'http://127.0.0.1:54321') throw new Error('Cible locale refusée.');
      return fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(10_000) });
    } },
  });
  const fixture = {
    email, password: `Titulaire!${randomUUID()}`, replacement: `Remplacement!${randomUUID()}`,
    get id() { return [...owned.keys()][0] || null; },
    publicClient() {
      return createClient(environment.url, environment.publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
    },
    async generate(type, { loseAck = false, partial = false } = {}) {
      let link;
      await generateManualAuthLink({ env, type, email, confirm: async () => true,
        // La génération, ses gardes et la construction du lien sont celles de
        // l'outil livré. Seule la remise est capturée en mémoire privée de test.
        makeAdmin: () => ({
          listUsers: args => linkAdmin.listUsers(args),
          generateLink: async args => {
            const result = await linkAdmin.generateLink(args);
            if (type === 'invite' && !result.error && result.data?.user?.id) owned.set(result.data.user.id, email);
            // Perte d'acquittement APRÈS le vrai commit local, jamais faux succès.
            if (loseAck) throw new TypeError('Acquittement local perdu.');
            return partial ? { data: { user: result.data?.user }, error: null } : result;
          },
        }),
        present: value => { link = value; },
      });
      return link;
    },
    async accountExists() {
      const result = await adminClient.auth.admin.getUserById(fixture.id);
      return !result.error && result.data?.user?.id === fixture.id && result.data.user.email === email;
    },
    async profileExists() {
      const result = await adminClient.from('profiles').select('id').eq('id', fixture.id);
      return !result.error && result.data?.length === 1 && result.data[0].id === fixture.id;
    },
    async missingRecovery() {
      // Vérifie le comportement du fournisseur lui-même, sans préflight outil.
      const result = await adminClient.auth.admin.generateLink({ type: 'recovery', email });
      if (result.data?.user?.id && result.data.user.email === email) owned.set(result.data.user.id, email);
      if (!result.error || result.data?.user) throw new Error('Une récupération inconnue ne doit pas créer de compte.');
      const users = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const unexpected = users.data?.users?.find(user => user.email === email);
      if (unexpected) owned.set(unexpected.id, email);
      if (users.error || unexpected) throw new Error('Compte inattendu après récupération inconnue.');
    },
    async cleanup() {
      validateLocalEnvironment(env);
      if (env.SUPABASE_TEST_CONFIRM_LOCAL !== LOCAL_PROJECT) throw new Error('Nettoyage local refusé.');
      for (const [id, target] of owned) {
        if (target !== `${run}@example.test` || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Nettoyage hors run refusé.');
        const deleted = await adminClient.auth.admin.deleteUser(id);
        if (deleted.error) throw new Error('Suppression du seul compte synthétique non confirmée.');
        const absent = await adminClient.auth.admin.getUserById(id);
        const profiles = await adminClient.from('profiles').select('id').eq('id', id);
        if (absent.error?.code !== 'user_not_found' || profiles.error || profiles.data.length !== 0)
          throw new Error('Absence Auth/profil après nettoyage non confirmée.');
        owned.delete(id);
      }
    },
  };
  return fixture;
}

// Compte les seuls messages de CETTE adresse synthétique, sans log du contenu
// ni purge de capture. Les suites historiques peuvent utiliser d'autres boîtes.
export async function countManualFixtureMail(environment, email) {
  if (environment.mailUrl !== 'http://127.0.0.1:54324' || !/^lot653a-[a-f0-9-]+@example\.test$/.test(email))
    throw new Error('Comptage SMTP hors fixture locale refusé.');
  async function json(path) {
    const response = await fetch(`${environment.mailUrl}${path}`, { redirect: 'error', signal: AbortSignal.timeout(3000) });
    try { return response.ok ? await response.json() : null; } catch { return null; }
  }
  const bucket = await json(`/api/v1/mailbox/${encodeURIComponent(email.split('@')[0])}`);
  if (Array.isArray(bucket)) return bucket.length;
  const pit = await json('/api/v1/messages?limit=1000');
  if (!Array.isArray(pit?.messages)) throw new Error('Capture SMTP locale non vérifiable.');
  return pit.messages.filter(item => item.To?.some(recipient => recipient.Address === email)).length;
}
