import { mkdirSync, lstatSync, realpathSync, readFileSync, writeFileSync, openSync, closeSync, fsyncSync, writeSync, chmodSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fail, validateRun } from './contract.mjs';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export function protectDirectory(dir) {
  if (process.platform !== 'win32') { chmodSync(dir, 0o700); return; }
  // Mode 0600 ne pose pas d'ACL Windows. Retirer l'héritage sur CE nouveau dossier seulement.
  const script = `$ErrorActionPreference = 'Stop'
$recipePath = $env:MON_BPREA_DEV_PRIVATE_DIR
$recipeAcl = New-Object System.Security.AccessControl.DirectorySecurity
$recipeAcl.SetAccessRuleProtection($true, $false)
$recipeOwner = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
$recipeAcl.SetOwner($recipeOwner)
foreach ($recipeSid in @($recipeOwner.Value, 'S-1-5-18', 'S-1-5-32-544')) {
  $recipeRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
    (New-Object System.Security.Principal.SecurityIdentifier($recipeSid)), 'FullControl',
    'ContainerInherit,ObjectInherit', 'None', 'Allow')
  $recipeAcl.AddAccessRule($recipeRule)
}
Set-Acl -LiteralPath $recipePath -AclObject $recipeAcl
if (-not (Get-Acl -LiteralPath $recipePath).AreAccessRulesProtected) { throw 'ACL' }`;
  try { execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script],
    { env: { ...process.env, MON_BPREA_DEV_PRIVATE_DIR: dir }, stdio: 'pipe' }); }
  catch { fail('private'); }
}
export function runDirectory(run, sha, { create = false } = {}) {
  validateRun(run, sha);
  const base = resolve(ROOT, '.tmp', 'dev-recipe'), dir = join(base, run);
  // Refus des liens/jonctions dans toute la chaîne ; aucune sortie au travers d'une racine détournée.
  for (const part of [resolve(ROOT, '.tmp'), base, dir]) {
    try { if (lstatSync(part).isSymbolicLink()) fail('private'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; if (!create) fail('private'); mkdirSync(part); }
  }
  if (!realpathSync(dir).startsWith(realpathSync(base) + sep)) fail('private');
  return dir;
}
export function readPrivate(dir, name) {
  const path = join(dir, name);
  if (lstatSync(path).isSymbolicLink() || lstatSync(path).size > 100_000) fail('private');
  return JSON.parse(readFileSync(path, 'utf8'));
}
export function createPrivate(dir, name, value) {
  writeFileSync(join(dir, name), `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
}
export function reserveSlot(dir, slot) {
  // Le fichier ne sera JAMAIS supprimé par l'outil, même en cas d'échec.
  const fd = openSync(join(dir, `${slot}.attempt.json`), 'wx', 0o600);
  try { writeSync(fd, JSON.stringify({ status: 'uncertain', startedAt: new Date().toISOString() })); fsyncSync(fd); }
  finally { closeSync(fd); }
}
export function artifactHash(dir) {
  const hash = createHash('sha256');
  function scan(folder, prefix = '') {
    if (lstatSync(folder).isSymbolicLink()) fail('artifact');
    for (const name of readdirSync(folder).sort()) {
      const path = join(folder, name), stat = lstatSync(path), relative = `${prefix}${name}`;
      if (stat.isSymbolicLink()) fail('artifact');
      if (stat.isDirectory()) scan(path, `${relative}/`);
      else if (stat.isFile()) hash.update(`${relative}\0`).update(readFileSync(path)).update('\0');
      else fail('artifact');
    }
  }
  scan(join(dir, 'frontend', 'mon-bprea'));
  return hash.digest('hex');
}
