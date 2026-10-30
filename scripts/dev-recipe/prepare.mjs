import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { DEV_API, DEV_PROJECT, DEV_SITE, DEV_CALLBACK, MAX_MUTATIONS, MAX_AUTH_REQUESTS, TABLES, RPCS,
  publicConfiguration, safeMessage, fail } from './contract.mjs';
import { ROOT, runDirectory, createPrivate, protectDirectory, artifactHash } from './private-files.mjs';
import { fixturePlan, targetPreflightSql } from './fixtures.mjs';
import { writeFileSync } from 'node:fs';

try {
  if (process.argv.length !== 2) fail('input');
  if (execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: ROOT, encoding: 'utf8' }).trim()) fail('artifact');
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const run = `r654b-${new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).replaceAll('-', '')}-${randomBytes(6).toString('hex')}`;
  const dir = runDirectory(run, sha, { create: true });
  protectDirectory(dir);
  const config = publicConfiguration(process.env.MON_BPREA_DEV_PUBLISHABLE_KEY);
  createPrivate(dir, 'plan.json', { version: 1, run, sha, project: DEV_PROJECT, api: DEV_API, site: DEV_SITE,
    callback: DEV_CALLBACK, maxAccounts: 2, slots: ['invite-A', 'invite-B', 'recovery-A'], maxMutations: MAX_MUTATIONS,
    maxRows: 150, maxAuthRequests: MAX_AUTH_REQUESTS, tables: TABLES, rpcs: RPCS, hostedStatus: 'EN ATTENTE D’AUTORISATION' });
  createPrivate(dir, 'auth-config.json', config);
  createPrivate(dir, 'fixtures.json', fixturePlan(run));
  writeFileSync(join(dir, 'preflight-targets.sql'), targetPreflightSql(run), { flag: 'wx', mode: 0o600 });
  createPrivate(dir, 'preflight.example.json', { project: DEV_PROJECT, run, sha, name: 'Mon BPREA DEV',
    region: 'eu-west-1', plan: 'free', status: 'ACTIVE_HEALTHY', callback: DEV_CALLBACK,
    checkedAt: null, schemaAndPrivilegesReviewed: false, authAndDataApiReviewed: false,
    protectionAccepted: false, absent: { A: false, B: false } });
  execFileSync(process.env.PYTHON || 'python', ['scripts/prepare-pages.py', '--version', sha,
    '--auth-config', join(dir, 'auth-config.json'), '--output', join(dir, 'frontend', 'mon-bprea')],
  { cwd: ROOT, stdio: 'pipe' });
  createPrivate(dir, 'artifact.json', { sha, hash: artifactHash(dir) });
  console.log(`Préparation locale seule : ${run}\nSHA : ${sha}\nArtefact ignoré : .tmp/dev-recipe/${run}/frontend/mon-bprea\nAucun appel Supabase. Aucun accord A/B/C/D enregistré.`);
} catch (error) { console.error(safeMessage(error)); process.exitCode = 1; }
