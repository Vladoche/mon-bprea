import { test, expect } from '@playwright/test';

const now = new Date('2026-10-20T08:00:00.000Z');
const prefix = '/mon-bprea/';

// Site local réel, configuration versionnée désactivée : aucune réponse réseau
// simulée. Les comptes connectés sont vérifiés dans la suite Supabase opt-in.
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: now });
});

test('connexion sous préfixe Pages : service non configuré, aucune inscription libre et cours publics', async ({ page }) => {
  const response = await page.goto(`${prefix}connexion.html`);
  expect(response.status()).toBe(200);
  const main = page.locator('main');
  await expect(page.getByLabel('Adresse e-mail', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Mot de passe', { exact: true })).toHaveAttribute('type', 'password');
  await expect(page.getByRole('button', { name: 'Se connecter', exact: true })).toBeDisabled();
  await expect(main.getByRole('alert')).toContainText(/configuré|accessible/i);
  await expect(page.getByRole('button', { name: /créer.*compte|s’inscrire/i })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Mot de passe oublié', exact: true })).toHaveAttribute('href', 'mot-de-passe-oublie.html');
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  await expect(nav.getByRole('list').first().locator(':scope > li')).toHaveCount(3);
  await nav.getByRole('link', { name: 'Mes cours', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mes cours');
  await expect(page.locator('header').getByRole('link', { name: 'Connexion', exact: true })).toBeVisible();
});

test('profil sans service configuré : aucune donnée personnelle ni accès Supabase', async ({ page }) => {
  const privateRequests = [];
  page.on('request', request => {
    if (/\/(?:auth|rest)\/v1\//.test(new URL(request.url()).pathname)) privateRequests.push(request.url());
  });
  await page.goto(`${prefix}profil.html`);
  const main = page.locator('main');
  await expect(main.getByRole('heading', { name: 'Connexion indisponible', exact: true })).toBeVisible();
  await expect(main.getByRole('alert')).toContainText(/configuré|accessible/i);
  await expect(page.getByLabel('Pseudo (facultatif)', { exact: true })).toHaveCount(0);
  await expect(main.getByRole('term', { name: 'Adresse e-mail', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Déconnexion', exact: true })).toHaveCount(0);
  await main.getByRole('link', { name: 'Connexion', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Connexion');
  expect(privateRequests).toEqual([]);
});

test('récupération assistée : information accessible, aucune collecte ni requête recover et retour connexion', async ({ page }) => {
  const recoveryRequests = [];
  page.on('request', request => { if (new URL(request.url()).pathname === '/auth/v1/recover') recoveryRequests.push(true); });
  await page.goto(`${prefix}mot-de-passe-oublie.html`);
  await expect(page.getByRole('heading', { name: 'Récupérer ton compte avec assistance' })).toBeVisible();
  await expect(page.locator('main')).toContainText('par votre moyen de communication habituel');
  await expect(page.locator('main')).toContainText('sans service d’envoi automatique d’e-mails');
  await expect(page.locator('main form, main input')).toHaveCount(0);
  await page.getByRole('link', { name: 'Retour à la connexion', exact: true }).focus();
  await expect(page.getByRole('link', { name: 'Retour à la connexion', exact: true })).toBeFocused();
  expect(recoveryRequests).toEqual([]);
  await page.getByRole('link', { name: 'Retour à la connexion', exact: true }).click();
  await expect(page).toHaveURL(/\/mon-bprea\/connexion\.html$/);
});

test('callback : URL nettoyée, liens invalides refusés et vérification indisponible sans service', async ({ page }) => {
  const token = 'fixture-syntactic-link-not-real';
  for (const suffix of ['', `?token_hash=${token}&type=signup`, `?token_hash=${token}&type=invite&token_hash=${token}`, `?token_hash=${token}&type=invite&type=recovery`, `?token_hash=${token}&type=invite&next=https://example.invalid`, '#access_token=fixture-not-a-session']) {
    // Chaque lien doit charger un document ; ajouter un hash au document déjà
    // ouvert serait une navigation interne, sans exécution de son bootstrap.
    await page.goto(`${prefix}connexion.html`);
    await page.goto(`${prefix}authentification.html${suffix}`);
    await expect(page).toHaveURL(/\/mon-bprea\/authentification\.html$/);
    await expect(page.locator('main').getByRole('alert')).toContainText(/invalide|expiré|utilisé/i);
    await expect(page.getByLabel('Nouveau mot de passe', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Continuer l’activation|Continuer la réinitialisation/ })).toHaveCount(0);
  }
  for (const type of ['invite', 'recovery']) {
    await page.goto(`${prefix}authentification.html?token_hash=${token}&type=${type}`);
    await expect(page).toHaveURL(/\/mon-bprea\/authentification\.html$/);
    await expect(page.getByRole('button', { name: type === 'invite' ? 'Continuer l’activation' : 'Continuer la réinitialisation', exact: true })).toBeDisabled();
    await expect(page.locator('main').getByRole('alert')).toContainText(/configuré|accessible/i);
    await expect(page.getByLabel('Nouveau mot de passe', { exact: true })).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText(token);
  }
});

test('auth mobile sombre : préférences et historiques conservés, contenus publics utilisables', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const saved = {
    'bprea-demo-appearance-v1': '{"version":1,"season":"winter","brightness":"dark"}',
    'bprea-demo-progress-v1': '{"matiere-organique":{"done":true,"score":2}}',
    'bprea-demo-drill-v1': '{"version":1,"series":{}}',
    'monbprea.botanical.v1': '{"schemaVersion":1,"answers":[],"sessions":[]}',
  };
  await page.addInitScript(values => {
    if (sessionStorage.getItem('auth-pages-seeded')) return;
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
    sessionStorage.setItem('auth-pages-seeded', 'true');
  }, saved);
  for (const file of ['connexion.html', 'profil.html', 'mot-de-passe-oublie.html', 'authentification.html', 'mes-cours.html']) {
    await page.goto(`${prefix}${file}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-season', 'winter');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), file).toBe(true);
    const after = await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), Object.keys(saved));
    expect(after).toEqual(saved);
  }
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mes cours');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
