import { test, expect } from '@playwright/test';
import { courseQuizAction } from '../helpers/course-quiz-browser.js';
import { accounts, apiOrigin, createCourseQuizAPI, sessionFor } from './course-quiz-api.js';

test.use({ channel: 'chromium', launchOptions: { ignoreDefaultArgs: ['--disable-back-forward-cache'] } });

const prefix = '/mon-bprea/';
const profile = `${prefix}profil.html`;
const account = page => page.locator('#informations-compte');
const input = page => account(page).getByLabel('Pseudo (facultatif)', { exact: true });
const submit = page => account(page).getByRole('button', { name: 'Enregistrer le pseudo' });
const saveMessage = page => account(page).locator('#profile-pseudo-message');
const currentPseudo = page => account(page).locator('[data-current-pseudo]');
const removed = '.data-export, .data-restore, .data-erasure, [data-export-prepare], [data-export-download], [data-export-device], [data-restore-file], [data-restore-preview], [data-restore-confirm], [data-erase-dialog], [data-erase-resume], #closure-heading, [data-closure-form], #donnees-synchronisation, [data-course-quiz-settings]';

async function expectNoMaintenance(page) {
  await expect(page.locator(removed)).toHaveCount(0);
  await expect(page.locator('main input[type="file"]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Administration|Exporter|Restaurer une sauvegarde|Effacer ses données/ })).toHaveCount(0);
  const missingFragments = await page.locator('main a[href^="#"]').evaluateAll(links => links.filter(link => !document.getElementById(link.hash.slice(1))).map(link => link.hash));
  expect(missingFragments).toEqual([]);
}

async function switchAccount(page, email) {
  await page.evaluate(async nextEmail => {
    const app = new URL(document.querySelector('script[src*="assets/app.js"]').src);
    const url = new URL('./auth-service.js', app);
    url.search = app.search;
    const service = await (await import(url.href)).getAuthService();
    await service.signOut();
    await service.signIn(nextEmail, 'synthetic-password');
  }, email);
}

test('Profil confirmé, sauvegarde et aide. Les anciens outils ne sont jamais montés', async ({ page, context }) => {
  const api = createCourseQuizAPI();
  await api.install(context, 'A', null, prefix);
  const loadedAssets = new Set();
  page.on('request', request => loadedAssets.add(new URL(request.url()).pathname));

  await page.goto(profile);
  await expect(page.getByRole('navigation', { name: 'Fil d’Ariane' })).toContainText('Mon profil');
  await expect(account(page).locator('[data-email]')).toHaveText(accounts.A.email);
  await expect(account(page).locator('[data-created]')).toHaveText('25 octobre 2026');
  await expect(currentPseudo(page)).toHaveText('Aucun pseudo');
  await expect.poll(async () => (await courseQuizAction(page, 'getState')).sync.state).toBe('synced');
  expect(api.sent).toEqual([]);
  expect(api.profileRequests.every(request => request.method === 'GET')).toBe(true);
  await expectNoMaintenance(page);
  expect([...loadedAssets].filter(path => /\/(?:export|restore|erasure)(?:-ui|-service|-model)?\.(?:css|js)$/.test(path))).toEqual([]);

  const links = page.locator('.profile-help');
  await expect(links.getByRole('link', { name: 'Confidentialité' })).toHaveAttribute('href', 'confidentialite.html');
  await expect(links.getByRole('link', { name: 'Contact et assistance' })).toHaveAttribute('href', 'contact.html');
  await expect(account(page).getByRole('link', { name: 'Récupération assistée du mot de passe' })).toHaveAttribute('href', 'mot-de-passe-oublie.html');

  for (const fragment of ['export-heading', 'restore-heading', 'erase-heading', 'closure-heading', 'fixture-maintenance']) {
    await page.goto(`${profile}#${fragment}`);
    await expectNoMaintenance(page);
  }
  await page.reload();
  await expect(input(page)).toBeVisible();
  await expectNoMaintenance(page);
  await account(page).getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(account(page)).toContainText('Connexion nécessaire');
  await expect(account(page)).not.toContainText(accounts.A.email);
  await expect(input(page)).toHaveCount(0);
  await expectNoMaintenance(page);
  await account(page).getByRole('link', { name: 'Connexion' }).click();
  await page.getByLabel('Adresse e-mail').fill(accounts.B.email);
  await page.getByLabel('Mot de passe', { exact: true }).fill('synthetic-password');
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(account(page).locator('[data-email]')).toHaveText(accounts.B.email);
  await expectNoMaintenance(page);
});

test('Visiteur : apparence et cours publics, accès direct aux anciens fragments sans outil', async ({ page, context }) => {
  const api = createCourseQuizAPI();
  await api.install(context, null, null, prefix);
  await page.goto(`${profile}#export-heading`);
  await expect(account(page)).toContainText('Connexion nécessaire');
  await expect(account(page).locator('[data-email], #auth-pseudo')).toHaveCount(0);
  const opener = page.getByRole('button', { name: 'Régler l’apparence' });
  await opener.click();
  await expect(page.getByRole('dialog', { name: 'Ton apparence' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Saison', exact: true }).selectOption('spring');
  await page.getByRole('button', { name: 'Mémoriser mon apparence sur cet appareil' }).click();
  await expect(page.locator('#appearance-action-message')).toContainText('mémorisée pour les prochaines pages');
  await page.keyboard.press('Escape');
  await expect(opener).toBeFocused();
  await expectNoMaintenance(page);
  await page.goto(`${prefix}mes-cours.html`);
  await expect(page.getByRole('heading', { name: 'Mes cours', exact: true, level: 1 })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-season', 'spring');
  expect(api.profileRequests).toEqual([]);
  expect(api.sent).toEqual([]);
});

test('Vérification serveur, profil indisponible, relecture puis identité locale hors ligne', async ({ page, context }) => {
  const api = createCourseQuizAPI();
  await api.install(context, 'A', null, prefix);
  const auth = Promise.withResolvers();
  api.holdUser = () => auth.promise;
  api.profileFailure = 'GET';
  await page.goto(`${profile}#informations-compte`);
  await expect(account(page).getByRole('status')).toHaveText('Vérification de la session…');
  await expect(account(page)).not.toContainText(accounts.A.email);
  await expect(input(page)).toHaveCount(0);
  auth.resolve();
  await expect(account(page).getByRole('heading', { name: 'Profil indisponible' })).toBeVisible();
  await expect(account(page).getByRole('alert')).toContainText('Le profil est indisponible');
  api.profileFailure = null;
  await account(page).getByRole('button', { name: 'Réessayer' }).click();
  await expect(account(page).locator('[data-email]')).toHaveText(accounts.A.email);

  api.authOffline = true;
  await page.reload();
  await expect(account(page)).toContainText('Session à vérifier');
  await expect(account(page)).toContainText('Identité locale reconnue');
  await expect(account(page)).not.toContainText(accounts.A.email);
  await expect(input(page)).toHaveCount(0);
  api.authOffline = false;
  await account(page).getByRole('button', { name: 'Vérifier la session' }).click();
  await expect(account(page).locator('[data-email]')).toHaveText(accounts.A.email);
});

test('Validation du pseudo, écriture unique, confirmation distante, erreur et valeur nulle', async ({ page, context }) => {
  const api = createCourseQuizAPI();
  await api.install(context, 'A', null, prefix);
  await page.goto(profile);
  await expect(input(page)).toBeEditable();
  for (const invalid of ['À', 'a'.repeat(41)]) {
    await input(page).fill(invalid);
    await submit(page).click();
    await expect(input(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(saveMessage(page)).toContainText('de 2 à 40 caractères');
  }
  const sent = () => api.profileRequests.filter(request => request.method === 'PATCH');
  expect(sent()).toEqual([]);

  const ack = Promise.withResolvers();
  api.holdProfile = ({ method }) => method === 'PATCH' ? ack.promise : undefined;
  await input(page).fill('  Éloïse 🌱 <BPREA>  ');
  await input(page).press('Enter');
  await expect(submit(page)).toBeDisabled();
  await expect(currentPseudo(page)).toHaveText('Aucun pseudo');
  await expect(saveMessage(page)).toHaveText('Enregistrement du pseudo…');
  await input(page).evaluate(node => node.form.dispatchEvent(new SubmitEvent('submit', { cancelable: true, bubbles: true })));
  await expect.poll(() => sent().length).toBe(1);
  ack.resolve();
  await expect(saveMessage(page)).toHaveText('Ton pseudo a été enregistré.');
  await expect(currentPseudo(page)).toHaveText('Éloïse 🌱 <BPREA>');
  await expect(input(page)).toHaveValue('Éloïse 🌱 <BPREA>');
  expect(sent()[0]).toMatchObject({ uid: accounts.A.id, patch: { pseudo: 'Éloïse 🌱 <BPREA>' } });

  api.profileFailure = 'PATCH';
  await input(page).fill('Saisie à conserver');
  await submit(page).click();
  await expect(saveMessage(page)).toHaveAttribute('data-kind', 'error');
  await expect(input(page)).toBeEditable();
  await expect(input(page)).toHaveValue('Saisie à conserver');
  await expect(currentPseudo(page)).toHaveText('Éloïse 🌱 <BPREA>');
  api.profileFailure = null;
  await input(page).fill('   ');
  await submit(page).click();
  await expect(saveMessage(page)).toHaveText('Ton pseudo a été enregistré.');
  await expect(currentPseudo(page)).toHaveText('Aucun pseudo');
  expect(sent().at(-1).patch).toEqual({ pseudo: null });
});

test('Déconnexion en échec. Les informations restent masquées jusqu’à relecture', async ({ page, context }) => {
  const api = createCourseQuizAPI();
  await api.install(context, 'A', null, prefix);
  api.logoutFailure = true;
  await page.goto(profile);
  await account(page).getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(account(page).getByRole('alert')).toContainText('La déconnexion a échoué.');
  await expect(input(page)).toHaveCount(0);
  await expect(account(page)).not.toContainText(accounts.A.email);
  await account(page).getByRole('button', { name: 'Vérifier la session' }).click();
  await expect(account(page)).toContainText('Connexion nécessaire');
  await expect(input(page)).toHaveCount(0);
  api.logoutFailure = false;
  await account(page).getByRole('link', { name: 'Connexion' }).click();
  await page.getByLabel('Adresse e-mail').fill(accounts.A.email);
  await page.getByLabel('Mot de passe', { exact: true }).fill('synthetic-password');
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await account(page).getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(account(page)).toContainText('Connexion nécessaire');
});

test('La lecture et la sauvegarde tardives d’A ne peuvent pas repeindre B', async ({ page, context }) => {
  const api = createCourseQuizAPI();
  api.profiles.set(accounts.A.id, 'Pseudo A privé');
  api.profiles.set(accounts.B.id, 'Pseudo B privé');
  await api.install(context, 'A', null, prefix);
  const read = Promise.withResolvers();
  api.holdProfile = ({ uid, method }) => uid === accounts.A.id && method === 'GET' ? read.promise : undefined;
  await page.goto(profile);
  await expect.poll(() => api.profileRequests.some(request => request.uid === accounts.A.id)).toBe(true);
  await switchAccount(page, accounts.B.email);
  await expect(currentPseudo(page)).toHaveText('Pseudo B privé');
  const lateRead = page.waitForResponse(response => response.url().includes(`profiles?`) && response.url().includes(accounts.A.id));
  read.resolve();
  await lateRead;
  await expect(account(page)).not.toContainText('Pseudo A privé');
  await expect(currentPseudo(page)).toHaveText('Pseudo B privé');

  await switchAccount(page, accounts.A.email);
  await expect(input(page)).toHaveValue('Pseudo A privé');
  const write = Promise.withResolvers();
  api.holdProfile = ({ uid, method }) => uid === accounts.A.id && method === 'PATCH' ? write.promise : undefined;
  await input(page).fill('Changement de A');
  await submit(page).click();
  await expect.poll(() => api.profileRequests.some(request => request.uid === accounts.A.id && request.method === 'PATCH')).toBe(true);
  await switchAccount(page, accounts.B.email);
  await expect(input(page)).toHaveValue('Pseudo B privé');
  await input(page).fill('Changement de B');
  await submit(page).click();
  await expect(currentPseudo(page)).toHaveText('Changement de B');
  const lateWrite = page.waitForResponse(response => response.request().method() === 'PATCH' && response.url().includes(accounts.A.id));
  write.resolve();
  await (await lateWrite).finished();
  expect(api.profiles.get(accounts.A.id)).toBe('Changement de A');
  await expect(currentPseudo(page)).toHaveText('Changement de B');
  await expect(input(page)).toHaveValue('Changement de B');
});

test('Les deux ancres restent accessibles au clavier pendant le rendu', async ({ page, context }) => {
  const api = createCourseQuizAPI();
  await api.install(context, 'A', null, prefix);
  await page.setViewportSize({ width: 390, height: 680 });
  for (const [id, heading] of [
    ['informations-compte', 'Informations du compte'],
    ['parametres', 'Paramètres'],
  ]) {
    await page.goto(`${profile}#${id}`);
    await expect(page.locator(`#${id}`)).toBeFocused();
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeInViewport();
    await expect(input(page)).toBeVisible();
  }
  await page.keyboard.press('Tab');
  await expect(page.locator('#appearance-open')).toBeFocused();
});

test('Une opération d’un autre onglet se synchronise sans déplacer le focus du pseudo', async ({ page, context }) => {
  const api = createCourseQuizAPI();
  await api.install(context, 'A', null, prefix);
  await page.goto(profile);
  const sync = async () => (await courseQuizAction(page, 'getState')).sync;
  await expect.poll(async () => (await sync()).state).toBe('synced');
  const course = await context.newPage();
  await course.goto(`${prefix}cours.html?id=matiere-organique`);
  await expect(course.locator('#course-quiz-sync-status')).toHaveText('Synchronisé');
  await input(page).fill('Saisie en cours');
  await input(page).focus();

  api.restOffline = true;
  await course.locator('#mark-done').check();
  await expect.poll(async () => (await sync()).pending).toBe(1);
  await expect(input(page)).toHaveValue('Saisie en cours');
  await expect(input(page)).toBeFocused();
  api.restOffline = false;
  await page.evaluate(() => dispatchEvent(new Event('online')));
  await expect.poll(async () => (await sync()).state).toBe('synced');
  expect(api.courses.get(`${accounts.A.id}:matiere-organique`)?.done).toBe(true);
  await expect(input(page)).toHaveValue('Saisie en cours');
});

test('Retour BFCache natif : efface A à la sortie, revérifie B et recrée les paramètres', async ({ page, context }) => {
  const api = createCourseQuizAPI();
  await api.install(context, 'A', null, prefix);
  // Allow the static test document into the cache; every profile read still uses the SDK.
  await page.route('**/profil.html', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'cache-control': 'private, max-age=60' } });
  });
  await page.goto(profile);
  await expect(account(page).locator('[data-email]')).toHaveText(accounts.A.email);
  await expect.poll(async () => (await courseQuizAction(page, 'getState')).sync.state).toBe('synced');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => {
    addEventListener('pagehide', event => {
      sessionStorage.setItem('test-profile-cleared', String(event.persisted && !document.querySelector('[data-email], #auth-pseudo')));
    }, { once: true });
    addEventListener('pageshow', event => {
      if (event.persisted) sessionStorage.setItem('test-profile-restored', 'true');
    });
  });
  await page.goto(`${prefix}contact.html`);
  // Change the synthetic session without enabling another live Auth client on the contact page.
  const key = `bprea-auth-${new URL(apiOrigin).hostname}-${prefix}`;
  await page.evaluate(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), { key, session: sessionFor('B') });
  try { await page.goBack({ waitUntil: 'commit' }); }
  catch (error) {
    // The pageshow handler can replace the restored document before goBack resolves.
    if (!error.message.includes('net::ERR_ABORTED')) throw error;
  }
  await expect(account(page).locator('[data-email]')).toHaveText(accounts.B.email);
  expect(await page.evaluate(() => sessionStorage.getItem('test-profile-cleared'))).toBe('true');
  expect(await page.evaluate(() => sessionStorage.getItem('test-profile-restored'))).toBe('true');
  await page.getByRole('button', { name: 'Régler l’apparence' }).click();
  await expect(page.getByRole('dialog', { name: 'Ton apparence' })).toBeVisible();
  await expect(page.locator('#appearance-save')).toBeEmpty();
});
