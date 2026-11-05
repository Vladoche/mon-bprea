import { afterAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';

const temporary = resolve('.tmp');
mkdirSync(temporary, { recursive: true });
const directory = mkdtempSync(join(temporary, 'auth-artifact-'));
let attempt = 0;
function prepare(config) {
  const output = join(directory, `public-${++attempt}`);
  const args = ['scripts/prepare-pages.py', '--version', 'auth-test', '--output', output];
  if (config) {
    const file = join(directory, `config-${attempt}.json`);
    writeFileSync(file, JSON.stringify(config));
    args.push('--auth-config', file);
  }
  return { ...spawnSync(process.env.PYTHON || 'python', args, { encoding: 'utf8' }), output };
}
afterAll(() => {
  // Seulement les fichiers synthétiques créés par ce test dans le workspace.
  if (realpathSync(directory).startsWith(realpathSync(temporary) + sep + 'auth-artifact-')) rmSync(directory, { recursive: true });
});

describe('artefact Pages et frontière de configuration publique Auth, sans mocks', () => {
  it('publie la configuration désactivée, les pages réelles et les imports versionnés sans outils ni secrets', () => {
    const result = prepare();
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(JSON.parse(readFileSync(join(result.output, 'assets/auth-config.json'), 'utf8')))
      .toMatchObject({ enabled: false, url: '', publishableKey: '' });
    for (const page of ['connexion', 'authentification', 'mot-de-passe-oublie', 'profil', 'contact'])
      expect(existsSync(join(result.output, `${page}.html`))).toBe(true);
    expect(readFileSync(join(result.output, 'assets/supabase-client.js'), 'utf8')).toContain('./vendor/supabase.js?v=auth-test');
    for (const privateFile of ['supabase/config.toml', 'scripts/test-supabase.mjs', 'scripts/admin-generate-auth-link.mjs', 'scripts/auth-link-local.mjs', '.env.supabase-test.local',
      'scripts/dev-recipe/session.mjs', 'scripts/dev-recipe/generate-test-links.mjs', 'scripts/dev-recipe/contract.mjs',
      'scripts/dev-recipe/prepare-continuation.mjs', 'scripts/dev-recipe/continuation.mjs', '.tmp/dev-recipe/lineage.json', '.tmp/dev-recipe/plan.json',
      'scripts/maintenance/tmp-prune.mjs', 'scripts/maintenance/tmp-policy.mjs', 'scripts/maintenance/tmp-inventory.mjs',
      '.tmp/maintenance-local/inventory-before.json', '.tmp/.maintenance.lock',
      'scripts/preopening/operator.mjs', 'scripts/preopening/backup.mjs', 'scripts/preopening/policy.json',
      'scripts/preopening/exercise-local.mjs', 'scripts/preopening/notice-preview.mjs', '.tmp/preopening-operator-655b/operator.json',
      '.tmp/preopening-operator/operator.json', 'docs', '.tmp', '.github', 'confidentialite.html',
      'node_modules/@supabase/supabase-js/package.json', 'auth-config.local.json', 'tests/helpers/auth-http.js'])
      expect(existsSync(join(result.output, privateFile)), privateFile).toBe(false);
    for (const page of readdirSync(result.output).filter(name => name.endsWith('.html'))) {
      expect(readFileSync(join(result.output, page), 'utf8'), page).not.toMatch(/href=["'][^"']*confidentialite\.html/i);
    }
    const contact = readFileSync(join(result.output, 'contact.html'), 'utf8');
    const policy = JSON.parse(readFileSync('scripts/preopening/policy.json', 'utf8'));
    expect(contact).toContain(`href="mailto:${policy.contact.email}"`);
    expect(contact).toContain('sept comptes au total');
    expect(contact).not.toContain('assets/app.js');
    expect(readFileSync(join(result.output, 'assets/auth-pages.js'), 'utf8')).toContain('sans service d’envoi automatique d’e-mails');
    expect(readFileSync(join(result.output, 'assets/auth-pages.js'), 'utf8')).not.toContain('requestPasswordReset');
  });

  it('applique une configuration publique seulement à la copie sans modifier les sources', () => {
    const sourceBefore = readFileSync('assets/auth-config.json', 'utf8');
    const config = { enabled: true, environment: 'development', url: 'http://127.0.0.1:54321',
      publishableKey: 'sb_publishable_fixture_only', siteUrl: 'http://127.0.0.1:4173/mon-bprea/' };
    const result = prepare(config);
    expect(result.status).toBe(0);
    expect(JSON.parse(readFileSync(join(result.output, 'assets/auth-config.json'), 'utf8'))).toEqual(config);
    expect(readFileSync('assets/auth-config.json', 'utf8')).toBe(sourceBefore);
  });

  it('refuse toute clé administrative, clé legacy et champ supplémentaire avant de créer la sortie', () => {
    const base = { enabled: false, environment: 'development', url: '', publishableKey: '', siteUrl: '' };
    for (const config of [{ ...base, publishableKey: 'sb_secret_fixture_only' },
      { ...base, publishableKey: 'eyJ.legacy.fixture' }, { ...base, smtpPassword: 'private-fixture-only' }]) {
      const result = prepare(config);
      expect(result.status).not.toBe(0);
      expect(existsSync(result.output)).toBe(false);
      expect(result.stderr).not.toContain('private-fixture-only');
      expect(result.stderr).not.toContain('sb_secret_fixture_only');
    }
  });
});
