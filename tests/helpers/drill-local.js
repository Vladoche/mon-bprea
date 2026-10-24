import { createClient } from '@supabase/supabase-js';
import { configureLocalAuthPage, createLocalAuthFixture, getLocalSupabaseEnvironment, LOCAL_SITE } from './auth-local.js';

export const DRILL_LOCAL_URL = `${LOCAL_SITE}drill.html?unit=uc3&week=2026-W42`;

export async function createDrillStudent() {
  const environment = getLocalSupabaseEnvironment();
  const fixture = createLocalAuthFixture(environment);
  const client = createClient(environment.url, environment.publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  try {
    const link = new URL(await fixture.invite());
    const result = await client.auth.verifyOtp({ token_hash: link.searchParams.get('token_hash'), type: 'invite' });
    if (result.error || !result.data.user?.id) throw new Error();
    if ((await client.auth.updateUser({ password: fixture.password })).error) throw new Error();
    return { ...fixture, environment, userId: result.data.user.id, client,
      async refresh() { if ((await client.auth.signInWithPassword({ email: fixture.email, password: fixture.password })).error) throw new Error('Session fictive locale indisponible.'); },
      async cleanup() { try { await client.auth.signOut({ scope: 'global' }); } finally { await fixture.cleanup(); } },
    };
  } catch { await fixture.cleanup(); throw new Error('Activation du seul compte fictif local Drill impossible.'); }
}

export async function configureDrillPage(page, environment) {
  await configureLocalAuthPage(page, environment);
  const health = await fetch(`${environment.url}/auth/v1/health`, { headers: { apikey: environment.publishableKey }, signal: AbortSignal.timeout(5000) });
  const date = new Date(health.headers.get('date'));
  if (!health.ok || !Number.isFinite(date.getTime())) throw new Error('Horloge du serveur Auth local indisponible.');
  await page.clock.install({ time: date });
}

export async function signInDrill(page, student) {
  await page.goto(`${LOCAL_SITE}connexion.html`);
  await page.getByLabel('Adresse e-mail', { exact: true }).fill(student.email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(student.password);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await page.locator('header').getByRole('link', { name: 'Mon profil', exact: true }).waitFor();
  await page.goto(DRILL_LOCAL_URL);
}

export async function personalRecord(page, scope = null) {
  return page.evaluate(async requestedScope => {
    const request = indexedDB.open('mon-bprea-drill-personal-v1', 1);
    const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = reject; });
    try {
      const all = db.transaction('accounts').objectStore('accounts').getAll();
      const records = await new Promise((resolve, reject) => { all.onsuccess = () => resolve(all.result); all.onerror = reject; });
      return requestedScope ? records.find(record => record.scope === requestedScope) : records[0];
    } finally { db.close(); }
  }, scope);
}
