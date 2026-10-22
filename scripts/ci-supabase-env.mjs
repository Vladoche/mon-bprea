// Exclusivement le runner GitHub Actions éphémère. Ne publie aucun statut brut.
import assert from 'node:assert/strict';
import { readFile, appendFile } from 'node:fs/promises';
import { join } from 'node:path';

try {
  assert.equal(process.env.GITHUB_ACTIONS, 'true');
  assert.ok(process.env.RUNNER_TEMP && process.env.GITHUB_ENV);
  const values = JSON.parse(await readFile(join(process.env.RUNNER_TEMP, 'supabase-status.json'), 'utf8'));
  // Noms par défaut officiels de la CLI 2.121.0, sans --override-name.
  // Le navigateur de l’application exige les nouvelles clés publiques.
  const publicKey = values.PUBLISHABLE_KEY;
  const adminKey = values.SECRET_KEY;
  assert.match(publicKey || '', /^sb_publishable_[A-Za-z0-9_-]+$/);
  assert.match(adminKey || '', /^sb_secret_[A-Za-z0-9_-]+$/);
  assert.equal(new URL(values.API_URL).origin, 'http://127.0.0.1:54321');
  const mailUrl = values.MAILPIT_URL || values.INBUCKET_URL;
  assert.equal(new URL(mailUrl).origin, 'http://127.0.0.1:54324');
  for (const value of Object.values(values)) {
    if (typeof value !== 'string' || !value) continue;
    assert.ok(!/[\r\n]/.test(value));
    // Les workflow commands add-mask sont interprétées par le runner et leur
    // charge utile n’est pas affichée dans les journaux utilisateur.
    console.log(`::add-mask::${value.replaceAll('%', '%25')}`);
  }
  const environment = {
    SUPABASE_TEST_CONFIRM_LOCAL: 'mon-bprea-lot6-1-local',
    SUPABASE_TEST_URL: values.API_URL,
    SUPABASE_TEST_MAIL_URL: mailUrl,
    SUPABASE_TEST_PUBLISHABLE_KEY: publicKey,
    SUPABASE_TEST_ADMIN_KEY: adminKey,
  };
  const serialized = Object.entries(environment).map(([name, value]) => {
    assert.equal(typeof value, 'string');
    assert.ok(!/[\r\n]/.test(value));
    return `${name}=${value}\n`;
  }).join('');
  await appendFile(process.env.GITHUB_ENV, serialized);
  console.log('Configuration locale de test chargée ; aucune clé distante utilisée.');
} catch {
  console.error('Impossible de charger la configuration CI locale Supabase ; aucune valeur sensible publiée.');
  process.exitCode = 1;
}
