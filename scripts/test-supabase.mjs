// Vérifications réelles Auth + PostgREST + RLS. Aucun mock et aucun accès distant.
// Les clés locales doivent venir de `supabase status` et ne sont jamais affichées.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { createClient } from '@supabase/supabase-js';

const expectedProject = 'mon-bprea-lot6-1-local';
const callback = 'http://127.0.0.1:4173/mon-bprea/authentification.html';
const run = `lot61-${randomUUID()}`;
const usersCreated = [];
let passed = 0;

function localEndpoint(value, port) {
  const parsed = new URL(value);
  assert.equal(parsed.origin, `http://127.0.0.1:${port}`, 'Seul le service local dédié est autorisé.');
  assert.equal(parsed.pathname, '/', 'Aucun chemin de proxy distant n’est autorisé.');
  assert.equal(parsed.search + parsed.hash + parsed.username + parsed.password, '', 'URL locale invalide.');
  return parsed.origin;
}

function publicClient() {
  return createClient(url, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, flowType: 'pkce' },
  });
}

function hasLegacyRole(key, role) {
  try { return JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8')).role === role; }
  catch { return false; }
}

function accepted(result, label) {
  assert.equal(result.error, null, `${label} : réponse Supabase refusée.`);
  return result.data;
}

function rejected(result, label) {
  assert.ok(result.error, `${label} : la requête devait être refusée.`);
}

async function check(label, action) {
  await action();
  passed += 1;
  console.log(`OK ${passed} — ${label}`);
}

async function jsonFetch(target, options) {
  const response = await fetch(target, { ...options, signal: AbortSignal.timeout(10_000) });
  let data;
  try { data = await response.json(); } catch { data = null; }
  return { response, data };
}

function extractCallback(content, type) {
  const decoded = content.replaceAll('&amp;', '&');
  const links = decoded.match(/https?:\/\/[^\s<>"']+/g) || [];
  for (const link of links) {
    const candidate = new URL(link);
    if (candidate.searchParams.get('type') !== type) continue;
    assert.equal(candidate.origin + candidate.pathname, callback, 'Le mail doit viser le callback sous /mon-bprea/.');
    const token = candidate.searchParams.get('token_hash');
    assert.ok(token && token.length > 20, 'Le modèle doit transporter un token_hash.');
    assert.deepEqual([...candidate.searchParams.keys()].sort(), ['token_hash', 'type']);
    return token;
  }
  return null;
}

// Supabase CLI utilise Inbucket ou Mailpit selon sa version. Les deux APIs
// sont consultées sans supprimer la boîte ; seules les adresses de ce run sont lues.
async function emailToken(email, type) {
  const until = Date.now() + 15_000;
  const mailbox = email.split('@')[0];
  while (Date.now() < until) {
    const bucket = await jsonFetch(`${mailUrl}/api/v1/mailbox/${encodeURIComponent(mailbox)}`);
    if (bucket.response.ok && Array.isArray(bucket.data)) {
      for (const item of bucket.data.toReversed()) {
        const message = await jsonFetch(`${mailUrl}/api/v1/mailbox/${encodeURIComponent(mailbox)}/${encodeURIComponent(item.id)}`);
        const token = extractCallback(`${message.data?.body?.html || ''}\n${message.data?.body?.text || ''}`, type);
        if (token) return token;
      }
    }
    const pit = await jsonFetch(`${mailUrl}/api/v1/messages`);
    if (pit.response.ok && Array.isArray(pit.data?.messages)) {
      for (const item of pit.data.messages) {
        if (!item.To?.some(recipient => recipient.Address === email)) continue;
        const message = await jsonFetch(`${mailUrl}/api/v1/message/${encodeURIComponent(item.ID)}`);
        const token = extractCallback(`${message.data?.HTML || ''}\n${message.data?.Text || ''}`, type);
        if (token) return token;
      }
    }
    await delay(150);
  }
  assert.fail('Aucun e-mail local correspondant : vérifier la capture SMTP et les modèles.');
}

async function invite(label) {
  const email = `${run}-${label}@example.test`;
  const data = accepted(await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: callback,
    // Les métadonnées libres ne doivent ni bloquer le trigger ni donner de rôle.
    data: { pseudo: 'x'.repeat(1000), role: 'admin' },
  }), 'Invitation native');
  assert.ok(data.user?.id, 'Une invitation doit créer un compte Auth.');
  usersCreated.push({ id: data.user.id, email });
  return { id: data.user.id, email, token: await emailToken(email, 'invite'), sentAt: Date.now() };
}

async function activate(invitation) {
  // Nouveau client sans session, sans vérificateur PKCE ni stockage du navigateur
  // initial : même contexte qu’une invitation ouverte sur un autre navigateur.
  const client = publicClient();
  const data = accepted(await client.auth.verifyOtp({ token_hash: invitation.token, type: 'invite' }), 'Vérification invitation');
  assert.equal(data.user?.id, invitation.id);
  assert.ok(data.session?.access_token);
  const password = `Lot61!${randomUUID()}`;
  accepted(await client.auth.updateUser({ password }), 'Définition du mot de passe');
  return { ...invitation, client, password };
}

async function rawProfiles(accessToken) {
  return jsonFetch(`${url}/rest/v1/profiles?select=id`, {
    headers: { apikey: publicKey, Authorization: `Bearer ${accessToken}` },
  });
}

let url;
let mailUrl;
let publicKey;
let admin;

try {
  assert.equal(process.env.SUPABASE_TEST_CONFIRM_LOCAL, expectedProject,
    `Tests non exécutés : définir SUPABASE_TEST_CONFIRM_LOCAL=${expectedProject} après démarrage de la stack locale dédiée.`);
  url = localEndpoint(process.env.SUPABASE_TEST_URL || 'http://127.0.0.1:54321', 54321);
  mailUrl = localEndpoint(process.env.SUPABASE_TEST_MAIL_URL || 'http://127.0.0.1:54324', 54324);
  publicKey = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
  const adminKey = process.env.SUPABASE_TEST_ADMIN_KEY;
  assert.ok(publicKey && adminKey, 'Tests non exécutés : clés LOCALES manquantes ; consulter supabase status sans les publier.');
  assert.ok(publicKey.startsWith('sb_publishable_') || hasLegacyRole(publicKey, 'anon'),
    'La clé du client étudiant doit être publishable ou anon, jamais administrative.');
  assert.ok(adminKey.startsWith('sb_secret_') || hasLegacyRole(adminKey, 'service_role'),
    'La préparation locale nécessite la clé administrative de la CLI.');

  const config = await readFile(new URL('../supabase/config.toml', import.meta.url), 'utf8');
  assert.match(config, /project_id\s*=\s*"mon-bprea-lot6-1-local"/);
  assert.match(config, /jwt_expiry\s*=\s*120\b/, 'L’expiration réelle requiert la configuration locale dédiée.');
  assert.match(config, /otp_expiry\s*=\s*60\b/);

  admin = createClient(url, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  await check('API directe : inscription publique et connexion anonyme refusées', async () => {
    const visitor = publicClient();
    const signup = await visitor.auth.signUp({ email: `${run}-noninvite@example.test`, password: `Test!${randomUUID()}` });
    rejected(signup, 'Inscription non invitée');
    assert.equal(signup.error.code, 'signup_disabled', 'Le refus doit provenir du réglage des inscriptions.');
    rejected(await visitor.auth.signInAnonymously(), 'Connexion anonyme');
  });

  let a;
  let b;
  await check('Deux invitations natives, e-mails locaux et activation dans un contexte neuf', async () => {
    a = await activate(await invite('a'));
    b = await activate(await invite('b'));
    assert.notEqual(a.id, b.id);
  });

  await check('Lien invitation réutilisé, invalide et compte déjà activé refusés', async () => {
    rejected(await publicClient().auth.verifyOtp({ token_hash: a.token, type: 'invite' }), 'Réutilisation invitation');
    rejected(await publicClient().auth.verifyOtp({ token_hash: '0'.repeat(64), type: 'invite' }), 'Invitation invalide');
    rejected(await admin.auth.admin.inviteUserByEmail(a.email, { redirectTo: callback }), 'Compte existant');
  });

  await check('Connexion valide, connexion erronée et restauration officielle de session', async () => {
    const login = publicClient();
    rejected(await login.auth.signInWithPassword({ email: a.email, password: 'MotDePasseIncorrect!123' }), 'Connexion incorrecte');
    const session = accepted(await login.auth.signInWithPassword({ email: a.email, password: a.password }), 'Connexion correcte').session;
    const restored = publicClient();
    accepted(await restored.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token }), 'Restauration session');
    assert.equal(accepted(await restored.auth.getUser(), 'Validation serveur session restaurée').user.id, a.id);
  });

  await check('RLS : chaque étudiant lit seulement son profil, même avec un UUID arbitraire', async () => {
    for (const [self, other] of [[a, b], [b, a]]) {
      const rows = accepted(await self.client.from('profiles').select('*'), 'Lecture profils');
      assert.equal(rows.length, 1);
      assert.equal(rows[0].id, self.id);
      assert.equal(rows[0].pseudo, null, 'Le trigger ignore les métadonnées utilisateur.');
      assert.equal(typeof rows[0].created_at, 'string');
      assert.equal(typeof rows[0].updated_at, 'string');
      const otherRows = accepted(await self.client.from('profiles').select('*').eq('id', other.id), 'UUID autre étudiant');
      assert.deepEqual(otherRows, []);
      assert.deepEqual(accepted(await self.client.from('profiles').select('*').eq('id', randomUUID()), 'UUID arbitraire'), []);
    }
    rejected(await publicClient().from('profiles').select('*'), 'Lecture anonyme');
  });

  await check('RLS : pseudo propre modifiable, profil voisin et champs techniques protégés', async () => {
    for (const [self, other] of [[a, b], [b, a]]) {
      const before = accepted(await self.client.from('profiles').select('*').single(), 'Profil avant modification');
      const row = accepted(await self.client.from('profiles').update({ pseudo: 'Élève test' }).eq('id', self.id).select('*').single(), 'Pseudo propre');
      assert.equal(row.pseudo, 'Élève test');
      assert.equal(row.created_at, before.created_at);
      assert.notEqual(row.updated_at, before.updated_at, 'Le serveur doit dater la modification.');
      assert.ok(Date.parse(row.updated_at) >= Date.parse(before.updated_at));
      const stolen = accepted(await self.client.from('profiles').update({ pseudo: 'Intrusion' }).eq('id', other.id).select('*'), 'Modification autre profil');
      assert.deepEqual(stolen, []);
      rejected(await self.client.from('profiles').update({ id: other.id }).eq('id', self.id), 'Changement propriétaire');
      rejected(await self.client.from('profiles').update({ created_at: '2000-01-01T00:00:00Z' }).eq('id', self.id), 'Falsification création');
      rejected(await self.client.from('profiles').update({ updated_at: '2000-01-01T00:00:00Z' }).eq('id', self.id), 'Falsification date');
      rejected(await self.client.from('profiles').update({ role: 'admin' }).eq('id', self.id), 'Ajout privilèges');
      rejected(await self.client.from('profiles').insert({ id: self.id, pseudo: 'Intrusion' }), 'Insertion étudiante');
      rejected(await self.client.from('profiles').delete().eq('id', self.id), 'Suppression étudiante');
      assert.equal(accepted(await other.client.from('profiles').select('pseudo').single(), 'Profil voisin préservé').pseudo,
        other === a ? 'Élève test' : null);
    }
  });

  await check('Contraintes SQL réelles : pseudo facultatif, 2–40 caractères et contrôles refusés', async () => {
    for (const pseudo of ['', 'x', 'x'.repeat(41), ' bord', 'bord ', 'a\nb', 'a\u0085b']) {
      rejected(await a.client.from('profiles').update({ pseudo }).eq('id', a.id), 'Pseudo invalide');
    }
    const empty = accepted(await a.client.from('profiles').update({ pseudo: null }).eq('id', a.id).select('pseudo').single(), 'Pseudo facultatif');
    assert.equal(empty.pseudo, null);
    accepted(await a.client.from('profiles').update({ pseudo: '🌱'.repeat(40) }).eq('id', a.id), '40 caractères Unicode');
  });

  await check('Métadonnées navigateur et signature JWT falsifiées ne contournent pas RLS', async () => {
    accepted(await a.client.auth.updateUser({ data: { role: 'admin', is_admin: true, id: b.id } }), 'Métadonnées non fiables');
    assert.deepEqual(accepted(await a.client.from('profiles').select('*').eq('id', b.id), 'RLS après falsification métadonnées'), []);
    const session = accepted(await a.client.auth.getSession(), 'Session locale').session;
    const parts = session.access_token.split('.');
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    parts[1] = Buffer.from(JSON.stringify({ ...claims, sub: b.id, role: 'service_role' })).toString('base64url');
    const forged = await rawProfiles(parts.join('.'));
    assert.ok(!forged.response.ok, 'PostgREST doit vérifier la signature, pas seulement le contenu JWT.');
    assert.ok(!(await rawProfiles('session-invalide')).response.ok);
  });

  await check('Récupération : vrai e-mail local, changement, lien à usage unique et ancien mot de passe refusé', async () => {
    const request = publicClient();
    accepted(await request.auth.resetPasswordForEmail(a.email, { redirectTo: callback }), 'Demande récupération');
    const token = await emailToken(a.email, 'recovery');
    const recovery = publicClient();
    accepted(await recovery.auth.verifyOtp({ token_hash: token, type: 'recovery' }), 'Lien récupération');
    const replacement = `Nouveau!${randomUUID()}`;
    accepted(await recovery.auth.updateUser({ password: replacement }), 'Nouveau mot de passe');
    rejected(await publicClient().auth.verifyOtp({ token_hash: token, type: 'recovery' }), 'Lien récupération réutilisé');
    rejected(await publicClient().auth.signInWithPassword({ email: a.email, password: a.password }), 'Ancien mot de passe');
    accepted(await publicClient().auth.signInWithPassword({ email: a.email, password: replacement }), 'Nouveau mot de passe actif');
    a.password = replacement;
    accepted(await publicClient().auth.resetPasswordForEmail(`${run}-inconnu@example.test`, { redirectTo: callback }), 'Adresse inconnue : réponse générique');
  });

  await check('Déconnexion serveur : refresh token invalidé', async () => {
    const client = publicClient();
    const session = accepted(await client.auth.signInWithPassword({ email: b.email, password: b.password }), 'Connexion avant déconnexion').session;
    accepted(await client.auth.signOut({ scope: 'local' }), 'Déconnexion');
    assert.equal(accepted(await client.auth.getSession(), 'Session après déconnexion').session, null);
    rejected(await publicClient().auth.refreshSession({ refresh_token: session.refresh_token }), 'Refresh après déconnexion');
    // Un access token déjà émis reste valide jusqu’à son exp ; le test suivant
    // vérifie l’expiration réelle, sans prétendre une révocation JWT immédiate.
  });

  await check('Expiration réelle : invitation, récupération et JWT authentique périmés refusés', async () => {
    const expiredInvite = await invite('expire');
    accepted(await publicClient().auth.resetPasswordForEmail(b.email, { redirectTo: callback }), 'Demande récupération à expirer');
    const recovery = await emailToken(b.email, 'recovery');
    const session = accepted(await publicClient().auth.signInWithPassword({ email: a.email, password: a.password }), 'JWT à expirer').session;
    const claims = JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url').toString('utf8'));
    // PostgREST v16.4 (CLI 2.121.0) tolère 30 secondes de dérive d’horloge.
    // Tester après exp + cette tolérance + 2 s, avec le JWT original signé.
    // https://docs.postgrest.org/en/v14/references/auth.html#jwt-claims-validation
    // https://github.com/PostgREST/postgrest/blob/v16.4/src/library/PostgREST/Auth/Jwt.hs
    const clockSkewMs = 30_000;
    const untilExpiry = Math.max(claims.exp * 1000 + clockSkewMs, expiredInvite.sentAt + 60_000, Date.now() + 60_000) + 2_000;
    assert.ok(untilExpiry - Date.now() < 180_000, 'La stack active doit appliquer jwt_expiry=120.');
    console.log('Attente de l’expiration locale réelle (environ 152 secondes, tolérance PostgREST incluse, sans modifier auth.users)…');
    let nextProgress = Date.now() + 30_000;
    while (Date.now() < untilExpiry) {
      await delay(Math.min(1000, untilExpiry - Date.now()));
      if (Date.now() >= nextProgress) {
        console.log('Expiration locale : vérification toujours en cours…');
        nextProgress = Date.now() + 30_000;
      }
    }
    rejected(await publicClient().auth.verifyOtp({ token_hash: expiredInvite.token, type: 'invite' }), 'Invitation expirée');
    rejected(await publicClient().auth.verifyOtp({ token_hash: recovery, type: 'recovery' }), 'Récupération expirée');
    const expired = await rawProfiles(session.access_token);
    assert.equal(expired.response.status, 401, 'Un JWT authentique périmé au-delà de la tolérance doit être refusé avec HTTP 401.');
    assert.equal(expired.data?.code, 'PGRST303', 'Le refus doit provenir de la validation des claims JWT par PostgREST.');
    const closure = await fetch(`${url}/functions/v1/close-account`, { method: 'POST',
      headers: { Origin: 'http://127.0.0.1:4173', apikey: publicKey, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'prepare', password: a.password, confirmation: 'SUPPRIMER' }), signal: AbortSignal.timeout(15000) });
    assert.equal(closure.status, 401, 'Le prototype de clôture doit aussi refuser ce JWT réellement expiré.');
  });

  console.log(`${passed} groupes de vérifications Supabase réellement exécutés et réussis.`);
} catch (error) {
  // Les réponses SDK peuvent contenir des sessions : ne jamais sérialiser error.
  const message = error instanceof assert.AssertionError ? error.message.split('\n')[0] : 'Service local indisponible ou erreur réseau.';
  console.error(`ÉCHEC / NON VALIDÉ — ${message}`);
  process.exitCode = 1;
} finally {
  let cleanupFailed = false;
  if (admin) {
    for (const fixture of usersCreated) {
      // Exclusivement les UUID créés par CE run, jamais une liste de comptes.
      assert.ok(fixture.email.startsWith(`${run}-`) && fixture.email.endsWith('@example.test'));
      try {
        const result = await admin.auth.admin.deleteUser(fixture.id);
        if (result.error) cleanupFailed = true;
      } catch { cleanupFailed = true; }
    }
  }
  if (cleanupFailed) {
    console.error('Nettoyage incomplet des seuls comptes fictifs de ce run ; consulter le projet local dédié.');
    process.exitCode = 1;
  }
}
