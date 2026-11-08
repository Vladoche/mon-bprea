import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function python(code) {
  return spawnSync(process.env.PYTHON || 'python', ['-c', `import sys; sys.path.insert(0, 'scripts')\n${code}`], { encoding: 'utf8' });
}

describe('release Pages : préflight en lecture seule et absence de publication implicite', () => {
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

  it('lie l’accord à la notice exacte et bloque toute approbation absente ou périmée', () => {
    const result = python(`
from pages_release import notice_sha256, validate_notice_approval
validate_notice_approval(notice_sha256())
for approval in ['', 'approved', '0'*64, notice_sha256().upper()]:
    try: validate_notice_approval(approval)
    except ValueError: pass
    else: raise AssertionError('unapproved notice accepted')
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
    const result = spawnSync(process.env.PYTHON || 'python', ['scripts/pages_release.py', '--output', 'must-not-be-created.json',
      '--approved-notice-sha256', 'unapproved'], { encoding: 'utf8', env: { ...process.env,
        PAGES_SUPABASE_PROD_URL: 'private-fixture-not-for-logs', PAGES_SUPABASE_PROD_PUBLISHABLE_KEY: 'sb_secret_private_fixture_only' } });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).not.toMatch(/private-fixture|sb_secret/);
  });

  it('la fusion et les push ne déclenchent plus Pages ; le déclenchement exige main et deux décisions', () => {
    const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8');
    expect(workflow).not.toMatch(/^\s+(?:push|pull_request|workflow_run):/m);
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('test "$GITHUB_REF" = refs/heads/main');
    expect(workflow).toContain('test "$PUBLICATION_APPROVED" = true');
    expect(workflow).toContain('default: false');
    expect(workflow).toContain('vars.PAGES_SUPABASE_PROD_PUBLISHABLE_KEY');
    expect(workflow).not.toMatch(/secrets\./);
    expect(workflow).toContain('--production');
    expect(workflow).toContain('--approved-notice-sha256');
  });
});
