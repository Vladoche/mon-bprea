import { test, expect } from '@playwright/test';
import { setTimeout as delay } from 'node:timers/promises';
import { createManualAuthFixture, countManualFixtureMail } from '../helpers/auth-manual-local.js';
import { configureLocalAuthPage, getLocalSupabaseEnvironment, LOCAL_SITE, openCapturedLink } from '../helpers/auth-local.js';

// Aucune trace, URL d'assertion, session, saisie ou erreur brute ne sort du test.
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

async function setPassword(page, password) {
  await page.getByLabel('Nouveau mot de passe', { exact: true }).fill(password);
  await page.getByLabel('Confirmer le mot de passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Définir le mot de passe', exact: true }).click();
  await expect(page.locator('main').getByRole('status')).toContainText('Ton nouveau mot de passe est enregistré.');
}
async function confirm(page, type) {
  await page.getByRole('button', { name: type === 'invite' ? 'Continuer l’activation' : 'Continuer la réinitialisation', exact: true })
    .evaluate(node => { node.click(); node.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
}
async function newPage(browser, environment) {
  const context = await browser.newContext({ locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const page = await context.newPage();
  await configureLocalAuthPage(page, environment);
  return { context, page };
}

test('Liens manuels réels : prévisualisation sans consommation, activation, récupération, isolation A/B et aucun SMTP', async ({ browser }) => {
  const environment = getLocalSupabaseEnvironment();
  const a = createManualAuthFixture(environment), b = createManualAuthFixture(environment);
  const contexts = [];
  let failure, stage = 'préparation';
  try {
    expect(await countManualFixtureMail(environment, a.email)).toBe(0);
    stage = 'generateLink invite et trigger profil avant activation';
    const invitation = await a.generate('invite');
    expect(await a.accountExists()).toBe(true); expect(await a.profileExists()).toBe(true);
    expect(await countManualFixtureMail(environment, a.email)).toBe(0);

    stage = 'prévisualisation et annulation dans un contexte vierge';
    const preview = await newPage(browser, environment); contexts.push(preview.context);
    let verifyCount = 0, recoverCount = 0, privilegedLeak = false;
    const observe = page => page.on('request', request => {
      if (new URL(request.url()).pathname === '/auth/v1/verify') verifyCount++;
      if (new URL(request.url()).pathname === '/auth/v1/recover') recoverCount++;
      const content = request.url() + JSON.stringify(request.headers()) + (request.postData() || '');
      if (content.includes(environment.adminKey) || content.includes('sb_secret_')) privilegedLeak = true;
    });
    observe(preview.page);
    await openCapturedLink(preview.page, invitation);
    await expect(preview.page.getByRole('button', { name: 'Continuer l’activation', exact: true })).toBeEnabled();
    expect(await preview.page.evaluate(() => !location.search && !location.hash)).toBe(true);
    expect(verifyCount).toBe(0);
    await preview.page.getByRole('link', { name: 'Annuler', exact: true }).click();
    expect(verifyCount).toBe(0);

    stage = 'activation volontaire et mot de passe dans un autre contexte vierge';
    const activation = await newPage(browser, environment); contexts.push(activation.context); observe(activation.page);
    await openCapturedLink(activation.page, invitation);
    await expect(activation.page.getByRole('button', { name: 'Continuer l’activation', exact: true })).toBeEnabled();
    expect(verifyCount).toBe(0);
    // Vraie vérification Auth commise, acquittement seulement retenu ; aucun
    // succès HTTP inventé. La double soumission reste une seule requête.
    let release, committed;
    const held = new Promise(done => { release = done; });
    const serverDone = new Promise(done => { committed = done; });
    await activation.page.route(`${environment.url}/auth/v1/verify`, async route => {
      const response = await route.fetch(); committed(); await held; await route.fulfill({ response });
    });
    await confirm(activation.page, 'invite');
    await serverDone;
    await expect(activation.page.getByLabel('Nouveau mot de passe', { exact: true })).toHaveCount(0);
    expect(verifyCount).toBe(1);
    release();
    await setPassword(activation.page, a.password); expect(verifyCount).toBe(1);
    await activation.page.locator('main').getByRole('link', { name: 'Mon profil', exact: true }).click();
    await expect(activation.page.getByLabel('Pseudo (facultatif)', { exact: true })).toBeVisible();
    await activation.page.reload();
    await expect(activation.page.getByLabel('Pseudo (facultatif)', { exact: true })).toBeVisible();

    stage = 'compte existant : aucun remplacement silencieux';
    await expect(a.generate('invite')).rejects.toMatchObject({ code: 'exists' });
    const bLink = await b.generate('invite');
    const clientB = b.publicClient();
    const verifiedB = await clientB.auth.verifyOtp({ token_hash: new URL(bLink).searchParams.get('token_hash'), type: 'invite' });
    expect(!verifiedB.error && verifiedB.data.user.id === b.id).toBe(true);
    expect(!(await clientB.auth.updateUser({ password: b.password })).error).toBe(true);
    const clientA = a.publicClient();
    expect(!(await clientA.auth.signInWithPassword({ email: a.email, password: a.password })).error).toBe(true);
    for (const [client, other] of [[clientA, b], [clientB, a]]) {
      const read = await client.from('profiles').select('id').eq('id', other.id);
      expect(!read.error && read.data.length === 0).toBe(true);
      const write = await client.from('profiles').update({ pseudo: 'Intrusion synthétique' }).eq('id', other.id).select('id');
      expect(!write.error && write.data.length === 0).toBe(true);
    }

    stage = 'génération recovery sans SMTP et procédure publique assistée';
    await activation.page.getByRole('link', { name: 'Récupération assistée du mot de passe', exact: true }).click();
    await expect(activation.page.locator('main form')).toHaveCount(0);
    const recovery = await a.generate('recovery');
    expect(await countManualFixtureMail(environment, a.email)).toBe(0);
    const recover = await newPage(browser, environment); contexts.push(recover.context); observe(recover.page);
    await openCapturedLink(recover.page, recovery);
    await expect(recover.page.getByRole('button', { name: 'Continuer la réinitialisation', exact: true })).toBeEnabled();
    expect(verifyCount).toBe(1);
    await confirm(recover.page, 'recovery'); await setPassword(recover.page, a.replacement);
    expect(verifyCount).toBe(2);
    expect(Boolean((await a.publicClient().auth.signInWithPassword({ email: a.email, password: a.password })).error)).toBe(true);

    stage = 'connexion normale avec le nouveau mot de passe';
    const login = await newPage(browser, environment); contexts.push(login.context); observe(login.page);
    await login.page.goto(`${LOCAL_SITE}connexion.html`);
    await login.page.getByLabel('Adresse e-mail', { exact: true }).fill(a.email);
    await login.page.getByLabel('Mot de passe', { exact: true }).fill(a.replacement);
    await login.page.getByRole('button', { name: 'Se connecter', exact: true }).click();
    await expect(login.page.getByLabel('Pseudo (facultatif)', { exact: true })).toBeVisible();

    stage = 'liens consommés refusés dans de nouveaux contextes';
    for (const [link, type] of [[invitation, 'invite'], [recovery, 'recovery']]) {
      const reused = await newPage(browser, environment); contexts.push(reused.context); observe(reused.page);
      await openCapturedLink(reused.page, link); await confirm(reused.page, type);
      await expect(reused.page.locator('main').getByRole('alert')).toBeVisible();
      await expect(reused.page.getByLabel('Nouveau mot de passe', { exact: true })).toHaveCount(0);
    }
    expect(recoverCount).toBe(0); expect(privilegedLeak).toBe(false);
    expect(await countManualFixtureMail(environment, a.email)).toBe(0);
    expect(await countManualFixtureMail(environment, b.email)).toBe(0);
  } catch { failure = new Error(`Liens manuels locaux non validés : ${stage}. Détails sensibles masqués.`); }
  finally {
    for (const context of contexts) await context.close();
    for (const fixture of [a, b]) try { await fixture.cleanup(); } catch { failure = new Error('Nettoyage Auth/profil synthétiques non confirmé.'); }
  }
  if (failure) throw failure;
});

test('Liens manuels réels : mauvais type, jeton altéré et expiration Auth réellement attendue', async ({ browser }) => {
  test.setTimeout(120_000);
  const environment = getLocalSupabaseEnvironment();
  const invitation = createManualAuthFixture(environment), recovery = createManualAuthFixture(environment);
  const contexts = [];
  let failure, stage = 'préparation des liens';
  try {
    const inviteLink = await invitation.generate('invite');
    const activateLink = await recovery.generate('invite');
    const client = recovery.publicClient();
    expect(!(await client.auth.verifyOtp({ token_hash: new URL(activateLink).searchParams.get('token_hash'), type: 'invite' })).error).toBe(true);
    expect(!(await client.auth.updateUser({ password: recovery.password })).error).toBe(true);
    const recoveryLink = await recovery.generate('recovery');
    const expiresAfter = Date.now() + 62_000; // auth.email.otp_expiry=60, temps serveur réel.
    stage = 'mauvais type et jeton altéré';
    const wrong = new URL(inviteLink); wrong.searchParams.set('type', 'recovery');
    const altered = new URL(recoveryLink); altered.searchParams.set('token_hash', '0'.repeat(64));
    for (const link of [wrong.href, altered.href]) {
      const view = await newPage(browser, environment); contexts.push(view.context);
      await openCapturedLink(view.page, link); await confirm(view.page, 'recovery');
      await expect(view.page.locator('main').getByRole('alert')).toBeVisible();
      await expect(view.page.getByLabel('Nouveau mot de passe', { exact: true })).toHaveCount(0);
    }
    stage = 'attente réelle de l’expiration locale';
    while (Date.now() < expiresAfter) {
      await delay(Math.min(30_000, expiresAfter - Date.now()));
      console.log('Expiration réelle des liens manuels locaux : contrôle en cours, aucun secret journalisé.');
    }
    stage = 'refus navigateur des deux liens réellement expirés';
    for (const [link, type] of [[inviteLink, 'invite'], [recoveryLink, 'recovery']]) {
      const view = await newPage(browser, environment); contexts.push(view.context);
      await openCapturedLink(view.page, link); await confirm(view.page, type);
      await expect(view.page.locator('main').getByRole('alert')).toBeVisible();
      await expect(view.page.getByLabel('Nouveau mot de passe', { exact: true })).toHaveCount(0);
    }
    expect(await countManualFixtureMail(environment, invitation.email)).toBe(0);
    expect(await countManualFixtureMail(environment, recovery.email)).toBe(0);
  } catch { failure = new Error(`Erreurs/expiration manuelles locales non validées : ${stage}. Détails sensibles masqués.`); }
  finally {
    for (const context of contexts) await context.close();
    for (const fixture of [invitation, recovery]) try { await fixture.cleanup(); } catch { failure = new Error('Nettoyage synthétique d’expiration non confirmé.'); }
  }
  if (failure) throw failure;
});

test('Liens manuels réels : récupération inconnue, perte d’acquittement, réponse partielle et reprise sans nouvelle invitation', async () => {
  const environment = getLocalSupabaseEnvironment();
  const missing = createManualAuthFixture(environment), lost = createManualAuthFixture(environment), partial = createManualAuthFixture(environment);
  let failure, stage = 'récupération inconnue';
  try {
    await missing.missingRecovery();
    await expect(missing.generate('recovery')).rejects.toMatchObject({ code: 'missing' });
    for (const [fixture, options] of [[lost, { loseAck: true }], [partial, { partial: true }]]) {
      stage = options.loseAck ? 'acquittement perdu après commit réel' : 'réponse incomplète après commit réel';
      await expect(fixture.generate('invite', options)).rejects.toMatchObject({ code: 'uncertain' });
      expect(await fixture.accountExists()).toBe(true); expect(await fixture.profileExists()).toBe(true);
      stage = 'réexécution refuse de remplacer le lien du compte déjà créé';
      await expect(fixture.generate('invite')).rejects.toMatchObject({ code: 'exists' });
      expect(await countManualFixtureMail(environment, fixture.email)).toBe(0);
    }
  } catch { failure = new Error(`Reprise locale non validée : ${stage}. Détails sensibles masqués.`); }
  finally { for (const fixture of [missing, lost, partial]) try { await fixture.cleanup(); } catch { failure = new Error('Nettoyage synthétique de reprise non confirmé.'); } }
  if (failure) throw failure;
});
