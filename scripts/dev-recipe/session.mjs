// Exécution MANUELLE réservée aux points A/B/C. Aucune commande de suppression.
import { chromium } from '@playwright/test';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { execFileSync } from 'node:child_process';
import { existsSync, openSync, closeSync, writeFileSync, fsyncSync } from 'node:fs';
import { join } from 'node:path';
import { DEV_SITE, DEV_PROJECT, MAX_MUTATIONS, MAX_AUTH_REQUESTS, UUID, validateEnvironment, validateRun, browserGate,
  operationSlot, syntheticEmail, publicProcessEnvironment, safeMessage, fail } from './contract.mjs';
import { ROOT, runDirectory, readPrivate, createPrivate, reserveSlot, artifactHash } from './private-files.mjs';
import { generateTestLink } from './generate-test-links.mjs';
import { createRecipeServer } from './serve.mjs';

let browser, server, terminal;
try {
  if (process.argv.length !== 2) fail('input');
  if (!stdin.isTTY || !stdout.isTTY || process.env.CI || process.env.DEBUG || process.env.PWDEBUG
      || process.env.NODE_DEBUG || process.env.NODE_OPTIONS) fail('private');
  validateEnvironment(process.env);
  const childEnv = publicProcessEnvironment(process.env);
  const run = process.env.MON_BPREA_DEV_RUN;
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, env: childEnv, encoding: 'utf8' }).trim();
  validateRun(run, sha);
  const dir = runDirectory(run, sha), plan = readPrivate(dir, 'plan.json');
  if (plan.run !== run || plan.sha !== sha || plan.project !== DEV_PROJECT) fail('artifact');
  const artifact = readPrivate(dir, 'artifact.json');
  if (artifact.sha !== sha || artifact.hash !== artifactHash(dir)) fail('artifact');
  if (execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: ROOT, env: childEnv, encoding: 'utf8' }).trim()) fail('artifact');
  // Une seule session opérateur par run, même après crash. Pas de reprise aveugle.
  createPrivate(dir, 'session-started.json', { sha, startedAt: new Date().toISOString() });
  terminal = createInterface({ input: stdin, output: stdout });
  stdout.write(`DEV ${DEV_PROJECT}\nRun ${run}\nSHA ${sha}\nRelire le point A du runbook : 2 comptes, 3 liens, ${MAX_MUTATIONS} mutations max, aucun nettoyage.\n`);
  const aText = `AUTORISER A ${run} ${sha}`;
  if (await terminal.question(`Après accord explicite, saisir ${aText} : `) !== aText) fail('approval');
  createPrivate(dir, 'authorization-A.json', { run, sha, at: new Date().toISOString(), scope: 'runbook-6.5.4.B-point-A' });
  const key = readPrivate(dir, 'auth-config.json').publishableKey;
  server = createRecipeServer(dir, key);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(4173, '127.0.0.1', resolve); });
  browser = await chromium.launch({ headless: false, env: childEnv, args: ['--disable-logging'] });
  const owned = new Map(), verifications = new Set(), contexts = {}, pages = {};
  let writeEnabled = false, mutationCount = 0, authCount = 0;
  const allow = browserGate({ getIds: () => [...owned.values()], getEmails: () => [...owned.keys()].map(actor => syntheticEmail(run, actor)),
    mayWrite: () => writeEnabled, publicKey: key,
    mayVerify: ({ type, token_hash: token }) => ['invite', 'recovery'].includes(type)
      && (verifications.has(`${type}:${token}`) || token === `invalid-token-${run}`),
    consumeAuth: () => {
      if (authCount >= MAX_AUTH_REQUESTS) return false;
      createPrivate(dir, `auth-request-${String(++authCount).padStart(3, '0')}.json`, { at: new Date().toISOString() });
      return true;
    },
    consumeMutation: () => {
      if (mutationCount >= MAX_MUTATIONS) return false;
      // Chaque tentative réservée durablement avant l'envoi, même refusée ou interrompue.
      createPrivate(dir, `mutation-${String(++mutationCount).padStart(3, '0')}.json`, { at: new Date().toISOString() });
      return true;
    } });
  async function fresh(label) {
    // A2 est aussi le contexte neuf pour recovery A ; aucun profil personnel chargé.
    // Une ancienne instance reste ouverte jusqu'à la fermeture volontaire de la session.
    const context = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
    await context.addInitScript(label => {
      document.addEventListener('DOMContentLoaded', () => { document.title = `${label} · ${document.title}`; }, { once: true });
    }, label);
    await context.route('**/*', async route => {
      try {
        const request = route.request();
        if (allow({ url: request.url(), method: request.method(), headers: await request.allHeaders(), body: request.postData() || '' }))
          await route.continue();
        else await route.abort('blockedbyclient');
      } catch { await route.abort('blockedbyclient').catch(() => {}); }
    });
    contexts[label] = context; pages[label] = await context.newPage();
    await pages[label].goto(`${DEV_SITE}connexion.html`, { waitUntil: 'domcontentloaded' });
    return pages[label];
  }
  for (const label of ['A1', 'A2', 'B1', 'V']) await fresh(label);
  stdout.write('Quatre contextes vides : A1, A2, B1 et V. Aucun mot de passe saisi par le programme.\n');
  stdout.write('Commandes : invite A | invite B | recovery A | ecritures | hors-ligne A1 | en-ligne A1 | stop\n');
  for (;;) {
    const command = await terminal.question('Recette privée > ');
    if (command === 'stop') break;
    if (command === 'ecritures') {
      if (writeEnabled || owned.size !== 2) fail('approval');
      const text = `AUTORISER C ${run} ${MAX_MUTATIONS}`;
      if (await terminal.question(`Confirmer les scénarios T03–T12 et la borne ${MAX_MUTATIONS} : saisir ${text} : `) !== text) fail('approval');
      createPrivate(dir, 'authorization-C.json', { run, sha, at: new Date().toISOString(), maxMutations: MAX_MUTATIONS });
      writeEnabled = true;
      continue;
    }
    if (['hors-ligne A1', 'en-ligne A1'].includes(command)) {
      await contexts.A1.setOffline(command === 'hors-ligne A1');
      stdout.write('Réseau du seul contexte A1 modifié ; pages déjà chargées nécessaires hors ligne.\n');
      continue;
    }
    const [type, actor, extra] = command.split(' ');
    if (extra) fail('input');
    const slot = operationSlot(type, actor), previous = {};
    for (const name of ['invite-A', 'invite-B', 'recovery-A']) {
      if (existsSync(join(dir, `${name}.attempt.json`))) previous[name] = readPrivate(dir, `${name}.attempt.json`);
    }
    const proof = readPrivate(dir, 'preflight.json');
    await generateTestLink({ env: process.env, run, sha, proof, type, actor, previous,
      confirmA: async () => true, // Point A explicite obtenu au début de CETTE session.
      confirmB: async () => {
        const text = `AUTORISER B ${type} ${actor} ${run}`;
        return await terminal.question(`Un seul generateLink ${type}/${actor}, création Auth possible, remise en mémoire au contexte isolé ; saisir ${text} : `) === text;
      },
      reserve: async name => reserveSlot(dir, name),
      record: async (name, value) => {
        if (name !== slot || !UUID.test(value.id)) fail('uncertain');
        owned.set(actor, value.id);
        const fd = openSync(join(dir, `${name}.attempt.json`), 'r+');
        try { writeFileSync(fd, JSON.stringify({ ...value, run, sha, at: new Date().toISOString() })); fsyncSync(fd); }
        finally { closeSync(fd); }
      },
      present: async link => {
        const callback = new URL(link);
        verifications.add(`${type}:${callback.searchParams.get('token_hash')}`);
        const page = type === 'recovery' ? await fresh('A2') : pages[actor === 'A' ? 'A1' : 'B1'];
        // Le serveur silencieux ne conserve pas cette query. Aucune trace/capture/log Playwright.
        await page.goto(link, { waitUntil: 'domcontentloaded' });
        await page.bringToFront();
      },
    });
    stdout.write(`${slot} : remis au navigateur isolé ; activation/choix du mot de passe par le titulaire.\n`);
  }
  stdout.write('Fin de session : aucun compte ni donnée hébergée supprimés. JWT résiduels et fichiers privés à traiter séparément au point D.\n');
} catch (error) { console.error(safeMessage(error)); process.exitCode = 1; }
finally {
  terminal?.close();
  await browser?.close().catch(() => {});
  if (server) await new Promise(resolve => server.close(resolve));
}
