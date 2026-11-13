import { afterEach, describe, expect, it } from 'vitest';
import { chmodSync, existsSync, lstatSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createPrivateStore, verifyPrivateDirectory } from '../../scripts/prod-auth/private-store.mjs';
import { PROD_CALLBACK } from '../../scripts/prod-auth/environment.mjs';

const temporaryDirectories = [];
const email = 'synthetic-holder@example.test';
const token = 'synthetic_token_without_any_auth_capability';
const key = 'sb_secret_synthetic_fixture_not_a_real_key';
function powershell(script, path) {
  execFileSync(join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    ['-NoProfile', '-NonInteractive', '-Command', script], { stdio: 'pipe', timeout: 15_000, windowsHide: true,
      env: { SystemRoot: process.env.SystemRoot, MON_BPREA_TEST_PATH: path } });
}
function directory() {
  const path = mkdtempSync(join(tmpdir(), 'bprea-prod-auth-unit-'));
  temporaryDirectories.push(path);
  if (process.platform === 'win32') {
    powershell("$ErrorActionPreference='Stop'; $p=$env:MON_BPREA_TEST_PATH; $sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User; $acl=New-Object System.Security.AccessControl.DirectorySecurity; $acl.SetOwner($sid); $acl.SetAccessRuleProtection($true,$false); foreach($principal in @($sid,(New-Object System.Security.Principal.SecurityIdentifier('S-1-5-18')))){$rule=New-Object System.Security.AccessControl.FileSystemAccessRule($principal,'FullControl','ContainerInherit,ObjectInherit','None','Allow'); $acl.AddAccessRule($rule)}; Set-Acl -LiteralPath $p -AclObject $acl", path);
  } else chmodSync(path, 0o700);
  return path;
}
function makePublic(path) {
  if (process.platform === 'win32') {
    // Modification de DACL uniquement ; Set-Acl peut tenter de réécrire la SACL.
    execFileSync(join(process.env.SystemRoot, 'System32', 'icacls.exe'), [path, '/grant', '*S-1-1-0:(R)'],
      { stdio: 'pipe', timeout: 10_000, windowsHide: true, env: { SystemRoot: process.env.SystemRoot } });
  } else chmodSync(path, 0o744);
}
afterEach(() => {
  for (const path of temporaryDirectories.splice(0)) {
    // Supprime uniquement un répertoire créé par cette suite, jamais un lien ou une autre campagne.
    if (dirname(path) !== resolve(tmpdir()) || !path.includes('bprea-prod-auth-unit-') || lstatSync(path).isSymbolicLink()
        || resolve(realpathSync(path)).toLowerCase() !== resolve(path).toLowerCase()) throw new Error('Fixture privée hors périmètre.');
    rmSync(path, { recursive: true });
  }
});

describe('stockage privé PROD : secrets hors dépôt et réservations durables', { timeout: 30_000 }, () => {
  it('refuse le dépôt, les chemins relatifs et les droits publics avant tout jeton', () => {
    for (const path of ['relative', process.cwd(), join(process.cwd(), '.tmp'), '\\\\server\\share'])
      expect(() => verifyPrivateDirectory(path)).toThrow();
    const path = directory();
    expect(verifyPrivateDirectory(path).toLowerCase()).toBe(resolve(path).toLowerCase());
    makePublic(path);
    expect(() => createPrivateStore(path)).toThrow();
    expect(readdirSync(path)).toHaveLength(0);
  });

  it('refuse une jonction ou un lien même vers un dossier privé', () => {
    const parent = directory(), target = directory(), link = join(parent, 'alias');
    symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
    try { expect(() => verifyPrivateDirectory(link)).toThrow(); }
    finally { unlinkSync(link); }
  });

  it('une réservation survit à une nouvelle instance, sans adresse ni secret dans le journal', async () => {
    const path = directory(), store = createPrivateStore(path);
    expect(await store.read(email)).toBe(false);
    const id = await store.withLock(() => store.reserve(email, 'recovery'));
    const replacement = createPrivateStore(path);
    expect(await replacement.read(email)).toBe(true);
    await expect(replacement.reserve(email, 'recovery')).rejects.toMatchObject({ code: 'pending' });
    const files = readdirSync(path);
    expect(files.some(name => name.includes(email) || name.includes(token))).toBe(false);
    const journal = readFileSync(join(path, files.find(name => name.startsWith('reservation-'))), 'utf8');
    expect(journal.includes(email) || journal.includes(token) || journal.includes(key)).toBe(false);
    await replacement.withLock(() => replacement.markDelivered(email, id));
    expect(await createPrivateStore(path).read(email)).toBe(false);
  });

  it('conserve les octets de l’ancienne réservation Node lors d’une nouvelle demande achevée', async () => {
    const path = directory(), store = createPrivateStore(path);
    const first = await store.withLock(() => store.reserve(email, 'invite'));
    await store.withLock(() => store.markDelivered(email, first));
    const journal = join(path, readdirSync(path).find(name => name.startsWith('reservation-')));
    const previous = readFileSync(journal, 'utf8');
    const second = await store.withLock(() => store.reserve(email, 'recovery'));
    expect(second).not.toBe(first);
    expect(readFileSync(join(path, `history-reservation-${first}.json`), 'utf8')).toBe(previous);
    expect(JSON.parse(readFileSync(journal, 'utf8')).status).toBe('reserved');
  });

  it('un verrou concurrent ou interrompu bloque une autre opération', async () => {
    const path = directory(), store = createPrivateStore(path);
    await store.withLock(async () => {
      await expect(createPrivateStore(path).withLock(async () => {})).rejects.toMatchObject({ code: 'busy' });
    });
    expect(existsSync(join(path, 'operation.lock'))).toBe(false);
    writeFileSync(join(path, 'operation.lock'), 'synthetic-interrupted-operation', { mode: 0o600 });
    await expect(createPrivateStore(path).withLock(async () => {})).rejects.toMatchObject({ code: 'busy' });
    expect(existsSync(join(path, 'operation.lock'))).toBe(true);
  });

  it('le fichier individuel est privé, exclusif et distinct du journal sans jeton', async () => {
    const path = directory(), store = createPrivateStore(path);
    const id = await store.withLock(() => store.reserve(email, 'invite'));
    const callback = new URL(PROD_CALLBACK); callback.searchParams.set('token_hash', token); callback.searchParams.set('type', 'invite');
    const file = await store.deliver(callback.href, { operationId: id, type: 'invite' });
    expect(readFileSync(file, 'utf8').trim() === callback.href).toBe(true);
    await expect(store.deliver(callback.href, { operationId: id, type: 'invite' })).rejects.toThrow();
    const journalFile = readdirSync(path).find(name => name.startsWith('reservation-'));
    expect(readFileSync(join(path, journalFile), 'utf8').includes(token)).toBe(false);
    await expect(store.deliver('https://example.test/?token_hash=synthetic', { operationId: id, type: 'invite' })).rejects.toThrow();
  });

  it('refuse un journal corrompu ou devenu lisible par un autre compte', async () => {
    const path = directory(), store = createPrivateStore(path);
    await store.withLock(() => store.reserve(email, 'invite'));
    const journal = join(path, readdirSync(path).find(name => name.startsWith('reservation-')));
    const original = readFileSync(journal, 'utf8');
    writeFileSync(journal, '{}');
    await expect(store.read(email)).rejects.toMatchObject({ code: 'private' });
    writeFileSync(journal, original);
    makePublic(journal);
    await expect(createPrivateStore(path).read(email)).rejects.toMatchObject({ code: 'private' });
  });
});
