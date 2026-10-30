import { test, expect } from '@playwright/test';
import { sessionFor } from './course-quiz-api.js';
import { authIdentity } from '../helpers/personal-browser.js';
import { browserGate, DEV_API } from '../../scripts/dev-recipe/contract.mjs';

// HTTP synthétique : exerce le vrai SDK/callback/service/UI, jamais une preuve RLS.
test.use({ trace: 'off', screenshot: 'off', video: 'off' });
const origin = 'https://auth-manual.invalid';
const site = 'http://127.0.0.1:4173/mon-bprea/';
const token = 'synthetic_manual_callback_not_a_real_token';
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

async function install(page, { guarded = false } = {}) {
  const fixture = { verify: [], passwords: 0, recover: 0, error: null, hold: null, authMutations: 0, blocked: [] };
  const gate = browserGate({ getIds: () => [sessionFor('A').user.id], getEmails: () => [sessionFor('A').user.email],
    publicKey: 'sb_publishable_syntheticManualAuth', mayVerify: body => body.type === 'invite' && body.token_hash === token,
    mayWrite: () => false, consumeMutation: () => false, consumeAuth: () => ++fixture.authMutations <= 60 });
  await page.clock.install({ time: new Date('2026-10-28T12:00:00Z') });
  await page.route('**/assets/auth-config.json*', route => route.fulfill({ json: {
    enabled: true, environment: 'development', url: origin,
    publishableKey: 'sb_publishable_syntheticManualAuth', siteUrl: site,
  } }));
  await page.route(`${origin}/**`, async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    // Normalisation uniquement pour cette fixture HTTP, jamais de requête vers DEV.
    if (guarded && !gate({ url: `${DEV_API}${path}${new URL(request.url()).search}`, method: request.method(),
      headers: await request.allHeaders(), body: request.postData() || '' })) {
      fixture.blocked.push({ path, method: request.method() }); return route.abort();
    }
    const respond = (json, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(json) });
    if (path.endsWith('/verify')) {
      fixture.verify.push(request.postDataJSON());
      if (fixture.hold) await fixture.hold;
      if (fixture.error === 'network') return route.abort('failed');
      if (fixture.error) return respond({ code: 'otp_expired', message: 'synthetic provider detail' }, 403);
      return respond(sessionFor('A'));
    }
    if (path.endsWith('/recover')) { fixture.recover++; return respond({}); }
    if (path.endsWith('/user')) {
      if (request.method() === 'PUT') fixture.passwords++;
      return respond(sessionFor('A').user);
    }
    if (path.endsWith('/logout')) return route.fulfill({ status: 204 });
    if (path.includes('/rest/v1/')) return respond([]);
    return respond({ code: 'unsupported_synthetic_endpoint' }, 400);
  });
  return fixture;
}

test('callback invitation : le garde de recette accepte la requête native de mot de passe du SDK', async ({ page }) => {
  const fixture = await install(page, { guarded: true });
  await page.goto(`${site}authentification.html?token_hash=${token}&type=invite`);
  await page.getByRole('button', { name: 'Continuer l’activation', exact: true }).click();
  await page.getByLabel('Nouveau mot de passe', { exact: true }).fill('SyntheticOnlyPassword654b!');
  await page.getByLabel('Confirmer le mot de passe', { exact: true }).fill('SyntheticOnlyPassword654b!');
  await page.getByRole('button', { name: 'Définir le mot de passe', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ton compte est activé', exact: true })).toBeVisible();
  expect(fixture.passwords).toBe(1); expect(fixture.authMutations).toBe(2); expect(fixture.blocked).toEqual([]);
});

for (const type of ['invite', 'recovery']) {
  test(`callback ${type} : aucune vérification avant clic, double clic unique et réponse tardive contrôlée`, async ({ page }) => {
    const fixture = await install(page), gate = deferred(); fixture.hold = gate.promise;
    const loaded = await page.goto(`${site}authentification.html?token_hash=${token}&type=${type}`);
    expect(loaded.status()).toBe(200);
    const button = page.getByRole('button', { name: type === 'invite' ? 'Continuer l’activation' : 'Continuer la réinitialisation', exact: true });
    await expect(button).toBeEnabled();
    expect(await page.evaluate(() => location.search + location.hash)).toBe('');
    expect(fixture.verify).toEqual([]);
    expect(await page.evaluate(() => Object.hasOwn(window, '__bpreaAuthLink'))).toBe(false);
    await button.evaluate(node => { node.click(); node.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await expect.poll(() => fixture.verify.length).toBe(1);
    await expect(button).toBeDisabled();
    await expect(page.getByLabel('Nouveau mot de passe', { exact: true })).toHaveCount(0);
    expect(fixture.verify[0]).toMatchObject({ token_hash: token, type });
    gate.resolve();
    await page.getByLabel('Nouveau mot de passe', { exact: true }).fill('MotDePasse!Synthétique123');
    await page.getByLabel('Confirmer le mot de passe', { exact: true }).fill('MotDePasse!Synthétique123');
    await page.getByRole('button', { name: 'Définir le mot de passe', exact: true }).click();
    await expect(page.locator('main').getByRole('status')).toContainText('Ton nouveau mot de passe est enregistré.');
    expect(fixture.passwords).toBe(1); expect(fixture.recover).toBe(0);
  });
}

test('callback : refus réseau ou Auth sans session ni formulaire de mot de passe', async ({ page }) => {
  const fixture = await install(page);
  for (const error of ['network', 'expired-or-used-or-invalid']) {
    fixture.error = error;
    await page.goto(`${site}authentification.html?token_hash=${token}&type=recovery`);
    await page.getByRole('button', { name: 'Continuer la réinitialisation', exact: true }).click();
    await expect(page.locator('main').getByRole('alert')).toBeVisible();
    expect((await authIdentity(page)).status).not.toBe('authenticated');
    await expect(page.getByLabel('Nouveau mot de passe', { exact: true })).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('synthetic provider detail');
  }
  expect(fixture.passwords).toBe(0);
});

test('callback : sortie de session pendant verifyOtp invalide sa réponse tardive', async ({ page }) => {
  const fixture = await install(page), gate = deferred(); fixture.hold = gate.promise;
  await page.goto(`${site}authentification.html?token_hash=${token}&type=invite`);
  await page.getByRole('button', { name: 'Continuer l’activation', exact: true }).click();
  await expect.poll(() => fixture.verify.length).toBe(1);
  await page.evaluate(async () => {
    const app = new URL(document.querySelector('script[type="module"][src]').src);
    const module = new URL('./auth-service.js', app); module.search = app.search;
    const auth = await (await import(module.href)).getAuthService();
    await auth.signOut();
  });
  gate.resolve();
  await expect(page.locator('main').getByRole('alert')).toBeVisible();
  expect((await authIdentity(page)).status).not.toBe('authenticated');
  await expect(page.getByLabel('Nouveau mot de passe', { exact: true })).toHaveCount(0);
  expect(fixture.passwords).toBe(0);
});

test('callback : annulation et rechargement sans clic ne consomment aucun lien', async ({ page }) => {
  const fixture = await install(page);
  await page.goto(`${site}authentification.html?token_hash=${token}&type=invite`);
  await expect(page.getByRole('button', { name: 'Continuer l’activation', exact: true })).toBeEnabled();
  await page.getByRole('link', { name: 'Annuler', exact: true }).click();
  expect(fixture.verify).toEqual([]);
  await page.goto(`${site}authentification.html?token_hash=${token}&type=invite`);
  await expect(page.getByRole('button', { name: 'Continuer l’activation', exact: true })).toBeEnabled();
  await page.reload();
  await expect(page.locator('main').getByRole('alert')).toBeVisible();
  expect(fixture.verify).toEqual([]);
});

test('récupération assistée avec Auth configurée et sans JavaScript : aucune requête recover', async ({ page, browser }) => {
  const fixture = await install(page);
  await page.goto(`${site}mot-de-passe-oublie.html`);
  await expect(page.locator('main')).toContainText('Après vérification de ton identité');
  await expect(page.locator('main input, main form')).toHaveCount(0);
  await page.reload(); expect(fixture.recover).toBe(0);
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const plain = await context.newPage(); let requests = 0;
    plain.on('request', request => { if (new URL(request.url()).pathname === '/auth/v1/recover') requests++; });
    await plain.goto(`${site}mot-de-passe-oublie.html`);
    await expect(plain.getByRole('heading', { name: 'Mot de passe oublié', exact: true })).toBeVisible();
    await expect(plain.locator('main noscript p')).toContainText('par votre moyen habituel');
    await expect(plain.getByRole('link', { name: 'Retour à la connexion', exact: true })).toBeVisible();
    expect(requests).toBe(0);
  } finally { await context.close(); }
});
