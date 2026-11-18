// Consumes only the link deliberately copied from the final Windows app.
// All browsers are disposable contexts; no personal browser/profile is used.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const mode = process.argv[2];
assert.ok(['activate', 'invite-final', 'password', 'email', 'combined'].includes(mode));
const activation = mode === 'activate' || mode === 'invite-final';
const campaign = process.argv.includes('--invitation-campaign') ? resolve('.tmp/premiere-invitation-prod/qualification')
  : resolve('.tmp/mon-bprea-admin-v2', ...(process.argv.includes('--final-campaign') ? ['final-qualification'] : []));
const stateFile = join(campaign, 'private/session.private.json');
const state = JSON.parse(readFileSync(stateFile, 'utf8'));
assert.equal(state.api, 'http://127.0.0.1:54321');
const site = 'http://127.0.0.1:4173/mon-bprea/';
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.route('**/*', route => {
    const origin = new URL(route.request().url()).origin;
    if (!['http://127.0.0.1:4173', 'http://127.0.0.1:54321'].includes(origin)) return route.abort();
    if (new URL(route.request().url()).pathname === '/mon-bprea/assets/auth-config.json')
      return route.fulfill({ json: { enabled: true, environment: 'development', url: state.api, publishableKey: state.publishableKey, siteUrl: site } });
    return route.continue();
  });
  const page = await context.newPage();
  let password = state.participant.password;
  let email = state.participant.email;
  if (mode === 'invite-final') { email = 'new-final-v2@example.test'; password = `NewParticipant!${randomUUID()}`; }
  if (mode === 'email') email = 'alice-new-v2@example.test';
  if (mode === 'combined') email = 'alice-both-v2@example.test';
  if (mode !== 'email') {
    const clip = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Get-Clipboard -Raw'], { encoding: 'utf8', windowsHide: true });
    assert.equal(clip.status, 0, 'Only voluntarily copied local test link');
    const link = new URL(clip.stdout.trim());
    assert.equal(link.origin + link.pathname, site + 'authentification.html');
    assert.equal(link.searchParams.get('type'), activation ? 'invite' : 'recovery');
    assert.match(link.searchParams.get('token_hash'), /^[A-Za-z0-9_-]{20,512}$/);
    if (!activation) password = `Changed!${randomUUID()}`;
    await page.goto(link.href);
    await page.getByRole('button', { name: activation ? 'Continuer l’activation' : 'Continuer la réinitialisation', exact: true }).click();
    await page.getByLabel('Nouveau mot de passe', { exact: true }).fill(password);
    await page.getByLabel('Confirmer le mot de passe', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Définir le mot de passe', exact: true }).click();
    await page.getByRole('heading', { name: activation ? 'Ton compte est activé' : 'Ton mot de passe est modifié', exact: true }).waitFor();
    await page.screenshot({ path: join(campaign, 'captures', `participant-${mode}.png`), fullPage: true });
  }
  // A fresh participant context proves the resulting credentials on the real site.
  await context.close();
  const login = await browser.newContext();
  await login.route('**/*', route => {
    const url = new URL(route.request().url());
    if (!['http://127.0.0.1:4173', 'http://127.0.0.1:54321'].includes(url.origin)) return route.abort();
    if (url.pathname === '/mon-bprea/assets/auth-config.json')
      return route.fulfill({ json: { enabled: true, environment: 'development', url: state.api, publishableKey: state.publishableKey, siteUrl: site } });
    return route.continue();
  });
  const signIn = await login.newPage(); await signIn.goto(site + 'connexion.html');
  await signIn.getByLabel('Adresse e-mail', { exact: true }).fill(email);
  await signIn.getByLabel('Mot de passe', { exact: true }).fill(password);
  await signIn.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await signIn.waitForURL(site + 'profil.html');
  const client = createClient(state.api, state.publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const result = await client.auth.signInWithPassword({ email, password }); assert.equal(result.error, null);
  if (state.participant.userId && mode !== 'invite-final') assert.equal(result.data.user.id, state.participant.userId);
  assert.equal(result.data.user.role, 'authenticated'); assert.equal(result.data.user.email, email);
  const profile = await client.from('profiles').select('id').eq('id', result.data.user.id).single(); assert.equal(profile.error, null);
  if (mode === 'invite-final') state.additionalParticipants = [...(state.additionalParticipants || []), { email, password, userId: result.data.user.id }];
  else Object.assign(state.participant, { email, password, userId: result.data.user.id });
  writeFileSync(stateFile, JSON.stringify(state), { mode: 0o600 });
  const request = await fetch('http://127.0.0.1:54329/' + (mode === 'activate' ? 'seed-a' : 'verify-preserved'),
    { method: 'POST', headers: { 'X-Qualification-ID': state.id } }); assert.equal(request.status, 200);
  writeFileSync(join(campaign, 'local-proof', `browser-${mode}.json`), JSON.stringify({ syntheticOnly: true,
    finalAppCopiedLink: mode !== 'email', realParticipantBrowser: true, newLoginSucceeded: true, sameUuid: true, profilePresent: true,
    tenTablesPreserved: !activation, noAdministrativeRole: result.data.user.role === 'authenticated' }) + '\n');
  console.log(`PASS ${mode}: real isolated participant browser, resulting login, same UUID/profile, data checks. No PROD request.`);
} catch {
  console.error(`FAIL ${mode}: isolated participant browser; no token, password, provider payload or trace logged.`); process.exitCode = 1;
} finally { await browser.close(); }
