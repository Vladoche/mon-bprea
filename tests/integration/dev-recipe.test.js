import { it, expect, afterAll } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, existsSync, realpathSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { reserveSlot, artifactHash } from '../../scripts/dev-recipe/private-files.mjs';
import { publicConfiguration } from '../../scripts/dev-recipe/contract.mjs';
import { createRecipeServer } from '../../scripts/dev-recipe/serve.mjs';

const base = resolve('.tmp'); mkdirSync(base, { recursive: true });
const dir = mkdtempSync(join(base, 'dev-recipe-test-'));
const key = 'sb_publishable_synthetic_fixture_only';
afterAll(() => {
  const actual = realpathSync(dir), root = realpathSync(base);
  if (actual.startsWith(`${root}${sep}dev-recipe-test-`)) rmSync(actual, { recursive: true });
});
it('la réservation résiste à une seconde instance et reste incertaine après relecture', () => {
  reserveSlot(dir, 'invite-A');
  expect(() => reserveSlot(dir, 'invite-A')).toThrow();
  expect(JSON.parse(readFileSync(join(dir, 'invite-A.attempt.json'), 'utf8')).status).toBe('uncertain');
});
it('le vrai artefact est servi sous /mon-bprea/ ; aucun script privé ni traversée de chemin accessible', async () => {
  const config = join(dir, 'auth-config.json'); writeFileSync(config, JSON.stringify(publicConfiguration(key)));
  const build = spawnSync(process.env.PYTHON || 'python', ['scripts/prepare-pages.py', '--version', 'recipe-test', '--auth-config', config,
    '--output', join(dir, 'frontend', 'mon-bprea')], { encoding: 'utf8' });
  expect(build.status).toBe(0);
  const fingerprint = artifactHash(dir);
  const server = createRecipeServer(dir, key);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  try {
    const url = `http://127.0.0.1:${server.address().port}`;
    const page = await fetch(`${url}/mon-bprea/authentification.html?token_hash=synthetic-not-real&type=invite`);
    expect(page.status).toBe(200); expect(page.headers.get('referrer-policy')).toBe('no-referrer');
    expect(await page.text()).toContain('history.replaceState');
    for (const path of ['/scripts/dev-recipe/session.mjs', '/mon-bprea/.env', '/mon-bprea/%2e%2e/plan.json', '/plan.json'])
      expect((await fetch(url + path)).status).toBe(404);
    expect((await fetch(`${url}/mon-bprea/`, { method: 'POST' })).status).toBe(405);
    expect(JSON.parse(await (await fetch(`${url}/mon-bprea/assets/auth-config.json`)).text()).publishableKey).toBe(key);
  } finally { await new Promise(resolve => server.close(resolve)); }
  const page = join(dir, 'frontend', 'mon-bprea', 'connexion.html');
  writeFileSync(page, `${readFileSync(page, 'utf8')}\n<!-- synthetic changed artifact -->`);
  expect(artifactHash(dir)).not.toBe(fingerprint);
  expect(JSON.parse(readFileSync('assets/auth-config.json', 'utf8')).enabled).toBe(false);
});
it('la CLI refuse CI/pipes/arguments libres avant tout navigateur, serveur, clé ou accès réseau', () => {
  for (const args of [[], ['--force'], ['--project', 'other']]) {
    const result = spawnSync(process.execPath, ['scripts/dev-recipe/session.mjs', ...args], { encoding: 'utf8', env: { ...process.env, CI: 'true' } });
    expect(result.status).not.toBe(0); expect(result.stderr).not.toContain('sb_secret');
  }
  expect(existsSync(join(dir, 'authorization-A.json'))).toBe(false);
});
