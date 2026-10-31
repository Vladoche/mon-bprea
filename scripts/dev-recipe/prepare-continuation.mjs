import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { publicConfiguration, publicProcessEnvironment, safeMessage, fail, DEV_PROJECT, DEV_CALLBACK } from './contract.mjs';
import { ROOT, runDirectory, createPrivate, readPrivate, protectDirectory, artifactHash } from './private-files.mjs';
import { HISTORY_RUN, HISTORY_SHA, reserveContinuation, continuationPlan, validateContinuation } from './continuation.mjs';
import { targetPreflightSql } from './fixtures.mjs';

try {
  if (process.argv.length !== 2 || process.env.MON_BPREA_DEV_ADMIN_KEY) fail('input');
  const childEnv = publicProcessEnvironment(process.env);
  const git = args => execFileSync('git', args, { cwd: ROOT, env: childEnv, encoding: 'utf8', windowsHide: true }).trim();
  if (git(['status', '--porcelain', '--untracked-files=normal'])) fail('artifact');
  const sha = git(['rev-parse', 'HEAD']);
  const run = `r654b-${new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).replaceAll('-', '')}-${randomBytes(6).toString('hex')}`;
  const plan = continuationPlan(run, sha), parentDir = runDirectory(HISTORY_RUN, HISTORY_SHA);
  // Uniquement la configuration PUBLIQUE existante ; jamais les anciennes sessions/liens.
  const config = publicConfiguration(process.env.MON_BPREA_DEV_PUBLISHABLE_KEY || readPrivate(parentDir, 'auth-config.json').publishableKey);
  const dir = runDirectory(run, sha, { create: true });
  protectDirectory(dir);
  const lineage = reserveContinuation(parentDir, run, sha);
  createPrivate(dir, 'plan.json', plan);
  createPrivate(dir, 'lineage.json', lineage);
  createPrivate(dir, 'fixtures.json', JSON.parse(readFileSync(join(parentDir, 'fixtures.json'), 'utf8')));
  createPrivate(dir, 'auth-config.json', config);
  createPrivate(dir, 'preflight.example.json', { project: DEV_PROJECT, run, sha, name: 'Mon BPREA DEV', region: 'eu-west-1',
    plan: 'free', status: 'ACTIVE_HEALTHY', callback: DEV_CALLBACK, checkedAt: null, schemaAndPrivilegesReviewed: false,
    authAndDataApiReviewed: false, protectionAccepted: false, absent: { A: false, B: false }, present: { A: false } });
  // La requête cible les identités HISTORIQUES, jamais deux nouvelles adresses.
  createPrivate(dir, 'preflight-query.json', { sql: targetPreflightSql(HISTORY_RUN) });
  execFileSync(process.env.PYTHON || 'python', ['scripts/prepare-pages.py', '--version', sha,
    '--auth-config', join(dir, 'auth-config.json'), '--output', join(dir, 'frontend', 'mon-bprea')],
  { cwd: ROOT, env: childEnv, windowsHide: true, stdio: 'pipe' });
  createPrivate(dir, 'artifact.json', { sha, hash: artifactHash(dir) });
  validateContinuation({ dir, parentDir, run, sha });
  console.log(`Continuation locale préparée : ${run}\nSHA : ${sha}\nParent inchangé : ${HISTORY_RUN}\nHéritage : 1/3 liens, 2/60 Auth, 0/140 pédagogiques. Aucun appel hébergé. Accord R absent.`);
} catch (error) { console.error(safeMessage(error)); process.exitCode = 1; }
