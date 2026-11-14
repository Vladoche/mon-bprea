// Stockage opérateur uniquement, hors dépôt. Aucun jeton dans le journal.
import { lstatSync, readdirSync, realpathSync, openSync, writeFileSync, readFileSync, closeSync, fsyncSync, unlinkSync, renameSync } from 'node:fs';
import { resolve, relative, isAbsolute, dirname, join, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fail, ProdAuthLinkError, PROD_PROJECT, validateProdCallback } from './environment.mjs';

import { inspectRecoveryJournal, parseRecoveryJson } from './recovery-journal.mjs';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const inside = (parent, child) => { const path = relative(parent, child); return path === '' || (!path.startsWith('..') && !isAbsolute(path)); };
const keyFor = email => createHash('sha256').update(`${PROD_PROJECT}\0${email}`).digest('hex');
const identifier = /^[a-f0-9-]{36}$/;

function privateFailure(reason) {
  const error = new ProdAuthLinkError('private');
  // Fixed diagnostic codes only: never a path, SID, subprocess output or content.
  error.privateReason = reason;
  throw error;
}

function verifyWindowsAcl(path, newEmptyFile = false) {
  // Environment carries only the checked path, never a key or link. Use the
  // same .NET ACL APIs as C#: no cmdlet/module discovery on a cold runner.
  const readAcl = "$sections=[System.Security.AccessControl.AccessControlSections]::Owner -bor [System.Security.AccessControl.AccessControlSections]::Access; if([System.IO.Directory]::Exists($p)){$acl=[System.IO.Directory]::GetAccessControl($p,$sections)}else{$acl=[System.IO.File]::GetAccessControl($p,$sections)}; ";
  let script = "$ErrorActionPreference='Stop'; $p=$env:MON_BPREA_PRIVATE_CHECK; $sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User; " + readAcl;
  if (newEmptyFile) {
    // An elevated token can assign Administrators as the default owner. Change
    // only our new empty file, before content, preserving the existing DACL.
    script += "$file=[System.IO.FileInfo]::new($p); if($file.Length -ne 0 -or ($file.Attributes -band [System.IO.FileAttributes]::ReparsePoint)){exit 4}; $owner=$acl.GetOwner([System.Security.Principal.SecurityIdentifier]).Value; if($owner -ne $sid.Value){if($owner -ne 'S-1-5-32-544'){exit 5}; $security=[System.Security.AccessControl.FileSecurity]::new(); $security.SetOwner($sid); [System.IO.File]::SetAccessControl($p,$security)}; " + readAcl;
  }
  script += "$owner=$acl.GetOwner([System.Security.Principal.SecurityIdentifier]).Value; if($owner -ne $sid.Value){exit 2}; foreach($rule in $acl.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier])){if($rule.AccessControlType -eq 'Allow' -and $rule.IdentityReference.Value -notin @($sid.Value,'S-1-5-18')){exit 3}}; [Console]::WriteLine('PRIVATE_OK')";
  const systemRoot = process.env.SystemRoot || process.env.SYSTEMROOT;
  if (!systemRoot) privateFailure('system_root');
  let answer;
  try {
    answer = execFileSync(join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
      ['-NoProfile', '-NonInteractive', '-Command', "try { " + script + " } catch { [Console]::WriteLine('PRIVATE_FAILURE_' + $_.Exception.GetType().Name); exit 1 }"],
      { encoding: 'utf8', windowsHide: true, timeout: 45_000, stdio: ['ignore', 'pipe', 'pipe'],
        env: { SystemRoot: systemRoot, MON_BPREA_PRIVATE_CHECK: path } });
  } catch (error) {
    const classification = String(error?.stdout || '').match(/PRIVATE_FAILURE_([A-Za-z]{1,64})/);
    privateFailure(classification ? 'acl_' + classification[1].toLowerCase()
      : Number.isInteger(error?.status) ? 'acl_exit_' + error.status : error?.code === 'ETIMEDOUT' ? 'acl_timeout' : 'acl_start');
  }
  if (answer.trim() !== 'PRIVATE_OK') privateFailure('acl_output');
}

export function verifyPrivateDirectory(value) {
  try {
    if (!isAbsolute(value) || /[\x00-\x1f\x7f]/.test(value) || /^(?:\\\\|\/\/)/.test(value)) privateFailure('absolute_path');
    const directory = resolve(value);
    if (inside(repository, directory) || inside(directory, repository) || directory === parse(directory).root) privateFailure('repository_path');
    // Refuse liens/jonctions à chaque niveau avant de choisir un chemin de sortie.
    for (let path = directory; ; path = dirname(path)) {
      const stat = lstatSync(path);
      if (stat.isSymbolicLink() || !stat.isDirectory()) privateFailure('directory_ancestor');
      if (dirname(path) === path) break;
    }
    if (resolve(realpathSync(directory)).toLowerCase() !== directory.toLowerCase()) privateFailure('canonical_path');
    if (process.platform === 'win32') {
      verifyWindowsAcl(directory);
    } else {
      const stat = lstatSync(directory);
      if (stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0) fail('private');
    }
    return directory;
  } catch (error) { if (error instanceof ProdAuthLinkError && error.privateReason) throw error; privateFailure('directory_stat'); }
}

function privateFile(path, newEmptyFile = false) {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1
      || (process.platform !== 'win32' && (stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0))) fail('private');
  if (newEmptyFile && stat.size !== 0) fail('private');
  if (process.platform === 'win32') verifyWindowsAcl(path, newEmptyFile);
}

function syncDirectory(directory) {
  // POSIX exige aussi le flush du répertoire après création/rename. Windows ne
  // fournit pas ce descripteur via Node ; chaque fichier est flushé avant usage.
  if (process.platform === 'win32') return;
  const descriptor = openSync(directory, 'r');
  try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
}

function writeExclusive(path, text) {
  let descriptor;
  try {
    descriptor = openSync(path, 'wx', 0o600);
    // Contrôler le fichier encore vide, avant d’y écrire un secret.
    privateFile(path, true);
    writeFileSync(descriptor, text, 'utf8'); fsyncSync(descriptor);
  } finally { if (descriptor !== undefined) closeSync(descriptor); }
  privateFile(path);
  syncDirectory(dirname(path));
}

export function createPrivateStore(value) {
  const directory = verifyPrivateDirectory(value);
  // Éprouve les droits hérités d’un fichier neuf AVANT tout appel créateur de jeton.
  const probe = join(directory, `private-probe-${randomUUID()}.tmp`);
  writeExclusive(probe, ''); unlinkSync(probe);
  const journalPath = email => join(directory, `reservation-${keyFor(email)}.json`);
  const readReservation = email => {
    const path = journalPath(email);
    try {
      privateFile(path);
      const record = JSON.parse(readFileSync(path, 'utf8'));
      if (record.version !== 1 || record.project !== PROD_PROJECT || record.targetHash !== keyFor(email)
          || !identifier.test(record.operationId || '') || !['invite', 'recovery'].includes(record.type)
          || !['reserved', 'delivered-private'].includes(record.status)) fail('private');
      return record;
    } catch (error) { if (error?.code === 'ENOENT') return null; fail('private'); }
  };
  const recoveryBlocked = email => {
    try {
      // V1.2 keeps all closure intentions blocking until separate residual and
      // backup reconciliation review. Missing/ambiguous results never retry.
      if (readdirSync(directory).some(name => name.startsWith('closure-') && name.endsWith('.json') && !name.startsWith('closure-request-'))) return true;
      const ledger = join(directory, 'deletions.json');
      if (readdirSync(directory).includes('deletions.json')) {
        privateFile(ledger);
        if (lstatSync(ledger).size > 1_000_000) fail('private');
        const entries = parseRecoveryJson(readFileSync(ledger, 'utf8'));
        if (!Array.isArray(entries) || entries.some(r => !r || typeof r !== 'object' || Array.isArray(r))) fail('private');
        if (entries.some(r => r.version === 3 && r.type === 'closure')) return true;
      }
      const entries = readdirSync(directory).filter(name => name.startsWith('recovery-') && name.endsWith('.json')).map(name => {
        const path = join(directory, name); privateFile(path);
        if (lstatSync(path).size > 65536) fail('private');
        return { name, record: parseRecoveryJson(readFileSync(path, 'utf8')) };
      });
      return inspectRecoveryJournal(entries, operationId => {
        const path = join(directory, `auth-link-${operationId}.txt`); privateFile(path);
        if (lstatSync(path).size > 4096) fail('private');
        return readFileSync(path, 'utf8');
      }).some(r => r.status === 'reserved' || r.targetHash === keyFor(email) && r.status !== 'handed-over');
    } catch { fail('private'); }
  };
  return {
    directory,
    async withLock(operation) {
      verifyPrivateDirectory(directory);
      const path = join(directory, 'operation.lock');
      try { writeExclusive(path, `${randomUUID()}\n`); } catch { fail('busy'); }
      try { return await operation(); }
      finally { unlinkSync(path); }
    },
    async read(email) { return recoveryBlocked(email) || readReservation(email)?.status === 'reserved'; },
    async reserve(email, type) {
      if (recoveryBlocked(email)) fail('pending');
      const previous = readReservation(email);
      if (previous?.status === 'reserved') fail('pending');
      const operationId = randomUUID();
      const record = { version: 1, project: PROD_PROJECT, operationId, targetHash: keyFor(email), type,
        reservedAt: new Date().toISOString(), status: 'reserved' };
      const path = journalPath(email);
      // Remplacement atomique seulement d’une réservation acquittée, sous verrou.
      if (previous) {
        const history = join(directory, `history-reservation-${previous.operationId}.json`);
        const text = readFileSync(path, 'utf8');
        try { privateFile(history); if (readFileSync(history, 'utf8') !== text) fail('private'); }
        catch (error) { if (error?.code !== 'ENOENT') throw error; writeExclusive(history, text); }
        const temporary = join(directory, `reservation-${operationId}.new`);
        writeExclusive(temporary, JSON.stringify(record)); renameSync(temporary, path); syncDirectory(directory);
      } else writeExclusive(path, JSON.stringify(record));
      return operationId;
    },
    async markDelivered(email, operationId) {
      const record = readReservation(email);
      if (!record || record.operationId !== operationId || record.status !== 'reserved') fail('private');
      const temporary = join(directory, `receipt-${operationId}.new`);
      writeExclusive(temporary, JSON.stringify({ ...record, status: 'delivered-private', deliveredAt: new Date().toISOString() }));
      renameSync(temporary, journalPath(email)); syncDirectory(directory);
    },
    async deliver(link, { operationId, type }) {
      verifyPrivateDirectory(directory);
      if (!identifier.test(operationId || '')) fail('private');
      const validated = validateProdCallback(link, type);
      const path = join(directory, `auth-link-${operationId}.txt`);
      writeExclusive(path, `${validated}\n`);
      return path;
    },
  };
}
