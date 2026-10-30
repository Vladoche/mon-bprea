// Exécution MANUELLE réservée aux points A/B/C, ou R/B/C en continuation. Aucun DELETE.
import { chromium } from '@playwright/test';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { execFileSync } from 'node:child_process';
import { existsSync, openSync, closeSync, writeFileSync, fsyncSync } from 'node:fs';
import { join } from 'node:path';
import { DEV_API, DEV_SITE, DEV_PROJECT, MAX_MUTATIONS, UUID, validateEnvironment, validateRun, browserGate,
  operationSlot, syntheticEmail, publicProcessEnvironment, safeMessage, fail } from './contract.mjs';
import { ROOT, runDirectory, readPrivate, createPrivate, reserveSlot, artifactHash } from './private-files.mjs';
import { generateTestLink } from './generate-test-links.mjs';
import { createRecipeServer } from './serve.mjs';
import { HISTORY_RUN, HISTORY_SHA, startContinuation, campaignBudget, campaignCounts } from './continuation.mjs';

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
  if (![1, 2].includes(plan.version) || plan.run !== run || plan.sha !== sha || plan.project !== DEV_PROJECT) fail('artifact');
  const artifact = readPrivate(dir, 'artifact.json');
  if (artifact.sha !== sha || artifact.hash !== artifactHash(dir)) fail('artifact');
  if (execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: ROOT, env: childEnv, encoding: 'utf8' }).trim()) fail('artifact');
  const continuation = plan.version === 2;
  const journalDir = continuation ? runDirectory(HISTORY_RUN, HISTORY_SHA) : dir;
  const inherited = continuation ? startContinuation({ dir, parentDir: journalDir, run, sha })
    : { identityRun: run, owned: new Map(), counts: campaignCounts(dir) };
  // Une seule session opérateur par run/campagne, même après crash.
  if (!continuation) createPrivate(dir, 'session-started.json', { sha, startedAt: new Date().toISOString() });
  terminal = createInterface({ input: stdin, output: stdout });
  stdout.write(`DEV ${DEV_PROJECT}\nRun ${run}\nSHA ${sha}\nRelire le point A du runbook : 2 comptes, 3 liens, ${MAX_MUTATIONS} mutations max, aucun nettoyage.\n`);
  const phase = continuation ? 'R' : 'A';
  if (continuation) stdout.write(`Continuation de ${HISTORY_RUN} : A existant, invite A interdite ; 1/3 liens, 2/60 Auth hérités. B puis recovery A seulement après accord R. C/D distincts.\n`);
  const aText = `AUTORISER ${phase} ${run} ${sha}`;
  if (await terminal.question(`Après accord explicite, saisir ${aText} : `) !== aText) fail('approval');
  createPrivate(dir, `authorization-${phase}.json`, { run, sha, at: new Date().toISOString(),
    scope: continuation ? 'runbook-6.5.4.C-point-R' : 'runbook-6.5.4.B-point-A' });
  const key = readPrivate(dir, 'auth-config.json').publishableKey;
  server = createRecipeServer(dir, key);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(4173, '127.0.0.1', resolve); });
  browser = await chromium.launch({ headless: false, env: childEnv, args: ['--disable-logging'] });
  const owned = inherited.owned, verifications = new Set(), contexts = {}, pages = {};
  const budget = campaignBudget(journalDir, inherited.counts), requestReservations = new WeakMap();
  let writeEnabled = false, evidenceFailed = false;
  const allow = browserGate({ getIds: () => [...owned.values()], getEmails: () => [...owned.keys()].map(actor => syntheticEmail(inherited.identityRun, actor)),
    mayWrite: () => writeEnabled, publicKey: key,
    mayVerify: ({ type, token_hash: token }) => ['invite', 'recovery'].includes(type)
      && (verifications.has(`${type}:${token}`) || token === `invalid-token-${run}`),
    consumeAuth: () => !evidenceFailed && budget.consume('auth'),
    consumeMutation: () => !evidenceFailed && budget.consume('mutations') });
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
        if (!evidenceFailed && allow({ url: request.url(), method: request.method(), headers: await request.allHeaders(), body: request.postData() || '' })) {
          const url = new URL(request.url());
          if (url.origin === DEV_API && request.method() !== 'GET') {
            const kind = url.pathname.startsWith('/auth/v1/') ? 'auth' : 'mutations';
            requestReservations.set(request, { kind, index: budget.counts[kind] });
          }
          await route.continue();
        } else await route.abort('blockedbyclient');
      } catch { evidenceFailed = true; await route.abort('blockedbyclient').catch(() => {}); }
    });
    context.on('response', response => {
      const request = response.request(), reservation = requestReservations.get(request);
      if (!reservation) return;
      try {
        // Métadonnées seulement. Ni URL complète, headers, corps, JWT ou mot de passe.
        createPrivate(dir, `response-${reservation.kind}-${String(reservation.index).padStart(3, '0')}.json`,
          { at: new Date().toISOString(), context: label, method: request.method(),
            path: new URL(response.url()).pathname, status: response.status() });
      } catch { evidenceFailed = true; }
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
      if (existsSync(join(journalDir, `${name}.attempt.json`))) previous[name] = readPrivate(journalDir, `${name}.attempt.json`);
    }
    const proof = readPrivate(dir, 'preflight.json');
    await generateTestLink({ env: process.env, run, sha, proof, type, actor, previous, identityRun: inherited.identityRun,
      confirmA: async () => true, // A ou R explicite obtenu au début de CETTE session.
      confirmB: async () => {
        const text = `AUTORISER B ${type} ${actor} ${run}`;
        return await terminal.question(`Un seul generateLink ${type}/${actor}, création Auth possible, remise en mémoire au contexte isolé ; saisir ${text} : `) === text;
      },
      reserve: async name => {
        if (evidenceFailed || campaignCounts(journalDir).admin >= 3) fail('spent');
        reserveSlot(journalDir, name);
      },
      record: async (name, value) => {
        if (name !== slot || !UUID.test(value.id) || (actor === 'B' && value.id === owned.get('A'))
            || (owned.has(actor) && owned.get(actor) !== value.id)) fail('uncertain');
        owned.set(actor, value.id);
        const fd = openSync(join(journalDir, `${name}.attempt.json`), 'r+');
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
