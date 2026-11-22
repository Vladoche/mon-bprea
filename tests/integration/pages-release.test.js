import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

function python(code) {
  return spawnSync(process.env.PYTHON || 'python', ['-c', `import sys; sys.path.insert(0, 'scripts')\n${code}`], { encoding: 'utf8' });
}

describe('release Pages : préflight en lecture seule et absence de publication implicite', () => {
  it('accepte une réécriture substantielle synchronisée et calcule son empreinte sans accord documentaire', () => {
    const directory = mkdtempSync(join(tmpdir(), 'bprea-notice-release-'));
    try {
      const notice = 'docs/rgpd/POLITIQUE-CONFIDENTIALITE-PROJET.md';
      for (const path of ['scripts/build-privacy-notice.mjs', 'scripts/preopening/notice-preview.mjs',
        'scripts/preopening/notice-checks.mjs', 'scripts/preopening/policy.json',
        'tools/mon-bprea-admin/Core/AdminContract.cs', 'docs/rgpd/REGISTRE-TRAITEMENTS.md',
        'docs/rgpd/CONSERVATION-PROJET.json', notice, 'confidentialite.html', 'contact.html', 'index.html',
        'mes-cours.html', 'outils.html', 'connexion.html', 'ressources.html', 'calendrier.html', 'profil.html',
        'assets/footer.js', 'assets/favicon.svg', 'assets/theme-init.js', 'assets/style.css',
        'assets/navigation.css', 'assets/contact.css']) {
        const destination = join(directory, path);
        mkdirSync(dirname(destination), { recursive: true });
        copyFileSync(path, destination);
      }
      const run = (...args) => spawnSync(process.execPath, ['scripts/build-privacy-notice.mjs', ...args],
        { cwd: directory, encoding: 'utf8', env: { NODE_PATH: '' } });
      const noticePath = join(directory, notice);
      const original = readFileSync(noticePath, 'utf8').replaceAll('\r\n', '\n');
      const revised = original.replace(/^Version .+$/m, 'Version 12.0 · 23 novembre 2026')
        .replace(/^- \*\*R03 .+$/m, '- **R03 — Révision privée.** Vos historiques et choix pédagogiques restent disponibles pour vos révisions.')
        .replace(/^(## Évolutions de la notice\n\n)[\s\S]+$/m, '$1La date identifie la version. Les personnes concernées sont informées avant toute évolution importante des usages.\n');
      const initial = run('--check');
      expect(initial.status).toBe(0);
      writeFileSync(noticePath, revised.replaceAll('\n', '\r\n'));
      const stale = run('--check');
      expect(stale.status).toBe(1);
      expect(stale.stderr).toContain('Notice publique périmée');
      const built = run();
      expect(built.stderr).toBe('');
      expect(built.status).toBe(0);
      expect(built.stdout).toContain(createHash('sha256').update(revised).digest('hex'));
      expect(built.stdout).not.toBe(initial.stdout);
      expect(readFileSync(join(directory, 'confidentialite.html'), 'utf8')).toContain('Version 12.0');
      expect(run('--check')).toMatchObject({ status: 0, stdout: built.stdout });
      for (const [invalid, diagnostic] of [
        [revised.replace('## Vos droits et la clôture', '## Autre'), 'rubrique manquante'],
        [revised.replace('10 adultes au total', '11 adultes au total'), 'capacité'],
        [revised.replace('30 juin 2027', '29 juin 2027'), 'date de fermeture'],
        [revised.replace('https://www.cnil.fr/', 'http://www.cnil.fr/'), 'lien Markdown non rendu'],
      ]) {
        writeFileSync(noticePath, invalid);
        expect(run()).toMatchObject({ status: 1, stderr: expect.stringContaining(diagnostic) });
      }
      writeFileSync(noticePath, revised);
      rmSync(join(directory, 'ressources.html'));
      expect(run('--check')).toMatchObject({ status: 1, stderr: expect.stringContaining('cible locale introuvable') });
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it('vérifie la clé sur la seule cible fixe et refuse les réglages incomplets, ouverts ou indisponibles', () => {
    const result = python(`
import json
from pages_release import check_production_settings, PROD_API, PROD_SITE, NoRedirect
config = dict(enabled=True, environment='production', url=PROD_API, publishableKey='sb_publishable_fixture_production_only', siteUrl=PROD_SITE)
valid = dict(disable_signup=True, mailer_autoconfirm=False, external=dict(email=True, anonymous_users=False, google=False))
class Reply:
    status = 200
    def __init__(self, settings): self.settings = settings
    def __enter__(self): return self
    def __exit__(self, *args): pass
    def read(self, limit): return json.dumps(self.settings).encode()
class Transport:
    def __init__(self, settings): self.settings = settings
    def open(self, request, timeout):
        assert request.full_url == PROD_API + '/auth/v1/settings'
        assert request.method == 'GET' and request.get_header('Apikey') == config['publishableKey']
        assert request.data is None and timeout <= 15
        if self.settings == 'failure': raise RuntimeError('secret-must-not-be-logged')
        return Reply(self.settings)
check_production_settings(config, Transport(valid))
for settings in [{}, {**valid, 'disable_signup':False}, {**valid, 'mailer_autoconfirm':True},
        {**valid, 'external':{'email':True}}, {**valid, 'external':{'email':True,'anonymous_users':True}},
        {**valid, 'external':{**valid['external'],'google':True}},
        {**valid, 'anonymous_users_enabled':True}, 'failure']:
    try: check_production_settings(config, Transport(settings))
    except ValueError as error:
        assert 'secret-must-not-be-logged' not in str(error)
    else: raise AssertionError('unsafe Auth configuration accepted')
assert NoRedirect().redirect_request(None,None,302,'',{},'https://unrelated.invalid/') is None
print('read-only preflight passed')
`);
    expect(result.stderr).toBe(''); expect(result.status).toBe(0);
  });

  it('refuse les secrets modernes, SQL, service_role legacy et liens Auth dans les fichiers publics', () => {
    const result = python(`
import base64, json, runpy
check = runpy.run_path('scripts/prepare-pages.py')['check_public_content']
payload = base64.urlsafe_b64encode(json.dumps({'role':'service_role'}).encode()).decode().rstrip('=')
for content in ['sb_secret_private_fixture_only', 'postgresql://user:private-fixture@host/db', 'eyJhbGciOiJIUzI1NiJ9.'+payload+'.signature',
        'https://example.invalid/authentification.html?token_hash=synthetic-private-fixture-not-to-publish&type=invite']:
    try: check(content)
    except ValueError as error: assert content not in str(error)
    else: raise AssertionError('secret accepted')
check('sb_publishable_fixture_production_only')
check('const role = "service_role";')
check('let access_token=provider_response.access_token;')
`);
    expect(result.stderr).toBe(''); expect(result.status).toBe(0);
  });

  it('refuse sans créer de configuration ni imprimer des paramètres privés', () => {
    const output = 'must-not-be-created.json';
    const result = spawnSync(process.env.PYTHON || 'python', ['scripts/pages_release.py', '--output', output],
      { encoding: 'utf8', env: { ...process.env,
        PAGES_SUPABASE_PROD_URL: 'private-fixture-not-for-logs', PAGES_SUPABASE_PROD_PUBLISHABLE_KEY: 'sb_secret_private_fixture_only' } });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('cinq paramètres publics PROD exacts requis');
    expect(result.stderr).not.toMatch(/private-fixture|sb_secret/);
    expect(existsSync(output)).toBe(false);
  });

  it('seul le lancement manuel autorisé sur main peut publier après le contrôle de notice et d’Auth', () => {
    const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8');
    expect(workflow).not.toMatch(/^\s+(?:push|pull_request|workflow_run):/m);
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('test "$GITHUB_EVENT_NAME" = workflow_dispatch');
    expect(workflow).toContain('test "$GITHUB_REF" = refs/heads/main');
    expect(workflow).toContain('test "$PUBLICATION_APPROVED" = true');
    expect(workflow).toContain('default: false');
    expect(workflow).toContain('vars.PAGES_SUPABASE_PROD_PUBLISHABLE_KEY');
    expect(workflow).not.toMatch(/secrets\./);
    expect(workflow).toContain('--production');
    expect(workflow.match(/^ {6}(\w+):$/gm)).toEqual(['      publish_auth_production:']);
    const steps = ['test "$PUBLICATION_APPROVED" = true', 'node scripts/build-privacy-notice.mjs --check',
      'python3 scripts/pages_release.py', 'python3 scripts/prepare-pages.py --production', 'actions/deploy-pages@'];
    const positions = steps.map(step => workflow.indexOf(step));
    expect(positions).not.toContain(-1);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});
