// Stockage opérateur uniquement, hors dépôt. Aucun jeton dans le journal.
import { lstatSync, realpathSync, openSync, writeFileSync, readFileSync, closeSync, fsyncSync, unlinkSync, renameSync } from 'node:fs';
import { resolve, relative, isAbsolute, dirname, join, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fail, PROD_PROJECT, validateProdCallback } from './environment.mjs';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const inside = (parent, child) => { const path = relative(parent, child); return path === '' || (!path.startsWith('..') && !isAbsolute(path)); };
const keyFor = email => createHash('sha256').update(`${PROD_PROJECT}\0${email}`).digest('hex');
const identifier = /^[a-f0-9-]{36}$/;

function verifyWindowsAcl(path) {
  // Chemin par environnement, jamais interpolé dans une commande. Aucun secret hérité.
  const script = "$ErrorActionPreference='Stop'; $p=$env:MON_BPREA_PRIVATE_CHECK; $sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value; $acl=Get-Acl -LiteralPath $p; $owner=$acl.GetOwner([System.Security.Principal.SecurityIdentifier]).Value; if($owner -ne $sid){exit 2}; foreach($rule in $acl.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier])){if($rule.AccessControlType -eq 'Allow' -and $rule.IdentityReference.Value -notin @($sid,'S-1-5-18')){exit 3}}; Write-Output 'PRIVATE_OK'";
  const systemRoot = process.env.SystemRoot || process.env.SYSTEMROOT;
  if (!systemRoot) fail('private');
  const answer = execFileSync(join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', windowsHide: true, timeout: 10_000,
      stdio: ['ignore', 'pipe', 'pipe'], env: { SystemRoot: systemRoot, MON_BPREA_PRIVATE_CHECK: path } });
  if (answer.trim() !== 'PRIVATE_OK') fail('private');
}

export function verifyPrivateDirectory(value) {
  try {
    if (!isAbsolute(value) || /[\x00-\x1f\x7f]/.test(value) || /^(?:\\\\|\/\/)/.test(value)) fail('private');
    const directory = resolve(value);
    if (inside(repository, directory) || inside(directory, repository) || directory === parse(directory).root) fail('private');
    // Refuse liens/jonctions à chaque niveau avant de choisir un chemin de sortie.
    for (let path = directory; ; path = dirname(path)) {
      const stat = lstatSync(path);
      if (stat.isSymbolicLink() || !stat.isDirectory()) fail('private');
      if (dirname(path) === path) break;
    }
    if (resolve(realpathSync(directory)).toLowerCase() !== directory.toLowerCase()) fail('private');
    if (process.platform === 'win32') {
      verifyWindowsAcl(directory);
    } else {
      const stat = lstatSync(directory);
      if (stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0) fail('private');
    }
    return directory;
  } catch { fail('private'); }
}

function privateFile(path) {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1
      || (process.platform !== 'win32' && (stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0))) fail('private');
  if (process.platform === 'win32') verifyWindowsAcl(path);
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
    privateFile(path);
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
  return {
    directory,
    async withLock(operation) {
      verifyPrivateDirectory(directory);
      const path = join(directory, 'operation.lock');
      try { writeExclusive(path, `${randomUUID()}\n`); } catch { fail('busy'); }
      try { return await operation(); }
      finally { unlinkSync(path); }
    },
    async read(email) { return readReservation(email)?.status === 'reserved'; },
    async reserve(email, type) {
      const previous = readReservation(email);
      if (previous?.status === 'reserved') fail('pending');
      const operationId = randomUUID();
      const record = { version: 1, project: PROD_PROJECT, operationId, targetHash: keyFor(email), type,
        reservedAt: new Date().toISOString(), status: 'reserved' };
      const path = journalPath(email);
      // Remplacement atomique seulement d’une réservation acquittée, sous verrou.
      if (previous) {
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
