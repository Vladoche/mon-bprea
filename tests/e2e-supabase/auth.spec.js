import { test, expect } from '@playwright/test';
import {
  configureLocalAuthPage, createLocalAuthFixture, getLocalSupabaseEnvironment,
  LOCAL_SITE, openCapturedLink,
} from '../helpers/auth-local.js';

test('Supabase local réel : invitation, activation, profil, session, déconnexion et récupération', async ({ page }) => {
  const environment = getLocalSupabaseEnvironment();
  const fixture = createLocalAuthFixture(environment);
  let stage = 'configuration locale';
  let failure = null;
  const history = {
    'bprea-demo-appearance-v1': '{"version":1,"season":"winter","brightness":"dark"}',
    'bprea-demo-progress-v1': '{"matiere-organique":{"done":true,"score":2}}',
    'bprea-demo-drill-v1': '{"version":1,"series":{}}',
    'monbprea.botanical.v1': '{"schemaVersion":1,"answers":[],"sessions":[]}',
  };
  const main = page.locator('main');
  const header = page.locator('header');
  async function signIn(password) {
    await page.goto(`${LOCAL_SITE}connexion.html`);
    await page.getByLabel('Adresse e-mail', { exact: true }).fill(fixture.email);
    await page.getByLabel('Mot de passe', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  }
  async function setPassword(password) {
    await page.getByLabel('Nouveau mot de passe', { exact: true }).fill(password);
    await page.getByLabel('Confirmer le mot de passe', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Définir le mot de passe', exact: true }).click();
    await expect(main.getByRole('status')).toContainText('Ton nouveau mot de passe est enregistré.');
  }
  async function signOut() {
    await header.getByRole('button', { name: 'Déconnexion', exact: true }).click();
    await expect(header.getByRole('link', { name: 'Connexion', exact: true })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Mon profil', exact: true })).toHaveCount(0);
  }
  try {
    await configureLocalAuthPage(page, environment);
    await page.addInitScript(values => {
      if (sessionStorage.getItem('lot61-live-seeded')) return;
      for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
      sessionStorage.setItem('lot61-live-seeded', 'true');
    }, history);
    // Horloge explicite alignée sur le serveur réel ; les expirations Auth ne
    // sont pas simulées et aucun délai arbitraire ne déclenche une réussite.
    const health = await fetch(`${environment.url}/auth/v1/health`, {
      headers: { apikey: environment.publishableKey }, signal: AbortSignal.timeout(5000),
    });
    if (!health.ok) throw new Error();
    const dateHeader = health.headers.get('date');
    if (!dateHeader) throw new Error();
    const serverTime = new Date(dateHeader);
    if (!Number.isFinite(serverTime.getTime())) throw new Error();
    await page.clock.install({ time: serverTime });

    stage = 'visiteur sans session et contenus publics';
    await page.goto(`${LOCAL_SITE}profil.html`);
    await expect(main.getByRole('heading', { name: 'Connexion nécessaire', exact: true })).toBeVisible();
    await expect(main.getByLabel('Pseudo (facultatif)', { exact: true })).toHaveCount(0);
    await page.goto(`${LOCAL_SITE}mes-cours.html`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mes cours');

    stage = 'invitation native et e-mail capturé localement';
    const invitationLink = await fixture.invite();
    // L’invitation est émise dans Node ; le navigateur n’a aucune session Auth,
    // aucun vérificateur PKCE de l’émetteur et aucune clé administrative.
    stage = 'activation depuis un navigateur distinct de l’émetteur';
    await openCapturedLink(page, invitationLink);
    expect(await page.evaluate(() => location.search === '' && location.hash === '')).toBe(true);
    await expect(page.getByLabel('Nouveau mot de passe', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Continuer l’activation', exact: true }).click();
    await setPassword(fixture.password);
    await expect(main.getByRole('heading', { name: 'Ton compte est activé', exact: true })).toBeVisible();

    stage = 'profil réel créé automatiquement et modification du pseudo';
    await main.getByRole('link', { name: 'Mon profil', exact: true }).click();
    await expect(main).toContainText(fixture.email);
    await expect(page.getByLabel('Pseudo (facultatif)', { exact: true })).toHaveValue('');
    await page.getByLabel('Pseudo (facultatif)', { exact: true }).fill('Élève navigateur local');
    await page.getByRole('button', { name: 'Enregistrer le pseudo', exact: true }).click();
    await expect(main.getByRole('region', { name: 'Compte personnel', exact: true }).getByRole('status')).toHaveText('Ton pseudo a été enregistré.');

    stage = 'restauration de la session et du profil après rechargement';
    await page.reload();
    await expect(page.getByLabel('Pseudo (facultatif)', { exact: true })).toHaveValue('Élève navigateur local');
    await expect(header.getByRole('link', { name: 'Mon profil', exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-season', 'winter');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    stage = 'déconnexion réelle et conservation des données locales';
    await signOut();
    await expect(main.getByRole('heading', { name: 'Connexion nécessaire', exact: true })).toBeVisible();
    const preserved = await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), Object.keys(history));
    expect(preserved).toEqual(history);

    stage = 'connexion erronée puis connexion avec le mot de passe activé';
    await signIn('Mot-de-passe-incorrect-fixture!');
    await expect(main.getByRole('alert')).toContainText(/connexion|identifiants/i);
    await signIn(fixture.password);
    await expect(page.getByLabel('Pseudo (facultatif)', { exact: true })).toHaveValue('Élève navigateur local');

    stage = 'demande réelle de récupération et e-mail local';
    await main.getByRole('link', { name: 'Changer mon mot de passe', exact: true }).click();
    await page.getByLabel('Adresse e-mail', { exact: true }).fill(fixture.email);
    await page.getByRole('button', { name: 'Envoyer le lien de réinitialisation', exact: true }).click();
    await expect(main.getByRole('status')).toContainText('Si cette adresse correspond à un compte');
    const recoveryLink = await fixture.recoveryLink();

    stage = 'vérification réelle du lien de récupération et nouveau mot de passe';
    await openCapturedLink(page, recoveryLink);
    expect(await page.evaluate(() => location.search === '' && location.hash === '')).toBe(true);
    await page.getByRole('button', { name: 'Continuer la réinitialisation', exact: true }).click();
    await setPassword(fixture.replacement);
    await expect(main.getByRole('heading', { name: 'Ton mot de passe est modifié', exact: true })).toBeVisible();
    await signOut();

    stage = 'ancien mot de passe refusé, nouveau mot de passe et profil conservé';
    await signIn(fixture.password);
    await expect(main.getByRole('alert')).toContainText(/connexion|identifiants/i);
    await signIn(fixture.replacement);
    await expect(page.getByLabel('Pseudo (facultatif)', { exact: true })).toHaveValue('Élève navigateur local');
    await signOut();
  } catch {
    // Aucun objet SDK, lien à usage unique ou erreur Playwright contenant une
    // valeur saisie ne doit être sérialisé dans le rapport de cette suite.
    failure = new Error(`Parcours Supabase local non validé : ${stage}. Aucun jeton ni identifiant sensible n’est journalisé.`);
  } finally {
    try { await fixture.cleanup(); }
    catch { failure = new Error('Nettoyage local incomplet du seul compte fictif créé par le parcours navigateur.'); }
  }
  if (failure) throw failure;
});
