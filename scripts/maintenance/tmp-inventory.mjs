import * as fs from 'node:fs';
import { resolve, join, relative, dirname, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { BUILD_NAME, MARKER, KNOWN_GROUPS, TMP_LIMIT_BYTES, digest, publicDigest, publicPath, gitCatalog } from './tmp-policy.mjs';

export class MaintenanceError extends Error {
  constructor(code) { super(code); this.code = code; }
}
export function fail(code) { throw new MaintenanceError(code); }
const samePath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
const ACTIVE_TASK = String.raw`(?:test-server\.mjs|playwright[\\/](?:test[\\/])?(?:cli|lib)|vitest|prepare-pages\.py|rehearsal-local\.mjs|exercise-local\.mjs|dev-recipe[\\/]serve\.mjs|http\.server)`;
export const activeTask = command => new RegExp(ACTIVE_TASK).test(command);

// Check every ancestor, including Windows junctions (lstat.isSymbolicLink()).
export function checkedPath(repository, target, { absent = false } = {}) {
  const root = resolve(repository), tmp = join(root, '.tmp'), file = resolve(target);
  if (file !== tmp && !file.startsWith(tmp + sep)) fail('external-path');
  const chain = [];
  for (let part = file; ; part = dirname(part)) {
    chain.unshift(part);
    if (part === dirname(part)) break;
  }
  for (const part of chain) {
    let stat;
    try { stat = fs.lstatSync(part); }
    catch (error) { if (error.code === 'ENOENT' && absent) return file; throw error; }
    if (stat.isSymbolicLink() || !samePath(fs.realpathSync.native(part), part)) fail('reparse-point');
  }
  return file;
}

export function checkWindowsAttributes(repository, target) {
  checkedPath(repository, target);
  if (process.platform !== 'win32') return;
  // Check every reparse attribute, including tags other than symlinks/junctions.
  // Enumerate only ordinary directories: never recurse through a reparse point.
  const script = `$ErrorActionPreference='Stop'; $root=$env:MON_BPREA_TMP_CHECK;
    for($p=$root; $p; $p=[IO.Path]::GetDirectoryName($p)) {
      if(([IO.File]::GetAttributes($p) -band [IO.FileAttributes]::ReparsePoint) -ne 0){'unsafe'; exit}
    }
    $pending=New-Object 'System.Collections.Generic.Stack[string]'; $pending.Push($root);
    while($pending.Count){ foreach($entry in [IO.Directory]::EnumerateFileSystemEntries($pending.Pop())) {
      $a=[IO.File]::GetAttributes($entry);
      if(($a -band [IO.FileAttributes]::ReparsePoint) -ne 0){'unsafe'; exit}
      if(($a -band [IO.FileAttributes]::Directory) -ne 0){$pending.Push($entry)}
    }}; 'safe'`;
  let result;
  try { result = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script],
    { env: { ...process.env, MON_BPREA_TMP_CHECK: target }, encoding: 'utf8', windowsHide: true,
      timeout: 15000, stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
  catch { fail('attribute-check-unavailable'); }
  if (result !== 'safe') fail('reparse-point');
}

export function scanTree(repository, directory) {
  checkedPath(repository, directory);
  const files = [], directories = [], links = [], errors = [];
  function walk(folder) {
    for (const name of fs.readdirSync(folder).sort()) {
      const file = join(folder, name), rel = relative(directory, file).split(sep).join('/');
      try {
        const stat = fs.lstatSync(file);
        if (stat.isSymbolicLink() || !samePath(fs.realpathSync.native(file), file)) { links.push(rel); continue; }
        if (stat.isDirectory()) { directories.push(rel); walk(file); }
        else if (stat.isFile()) files.push({ name: rel, bytes: stat.size, mtimeMs: stat.mtimeMs });
        else errors.push('special-file');
      } catch { errors.push('unreadable'); }
    }
  }
  walk(directory);
  return { files, directories, links, errors, bytes: files.reduce((sum, file) => sum + file.bytes, 0) };
}

export function processSnapshot() {
  try {
    if (process.platform === 'win32') {
      // Return only a boolean, never command lines, environment or private names.
      const script = String.raw`$ErrorActionPreference='Stop'; $p=@(Get-CimInstance Win32_Process | Where-Object {
        $_.Name -match '^(node|python|python3)\.exe$' -and
        $_.CommandLine -match '${ACTIVE_TASK}'
      }); if($p.Count){'busy'}else{'idle'}`;
      const result = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script],
        { encoding: 'utf8', windowsHide: true, timeout: 15000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
      return { available: result === 'busy' || result === 'idle', busy: result === 'busy' };
    }
    const output = execFileSync('ps', ['-eo', 'args='], { encoding: 'utf8', timeout: 10000 });
    return { available: true, busy: output.split('\n').some(line =>
      /(?:node|python\d?)(?:\s|\/)/.test(line) && activeTask(line)) };
  } catch { return { available: false, busy: true }; }
}

export function pidAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid < 1) return true;
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code !== 'ESRCH'; }
}

export function buildFingerprint(repository, directory, tree) {
  const entries = [];
  for (const file of tree.files.filter(file => file.name !== MARKER)) {
    const target = checkedPath(repository, join(directory, file.name));
    entries.push({ name: file.name, bytes: file.bytes, sha256: digest(fs.readFileSync(target)) });
  }
  return { entries, hash: digest(JSON.stringify(entries)) };
}

export function qualifyBuild(repository, directory, tree, catalog, isAlive = pidAlive) {
  if (tree.links.length || tree.errors.length) return { reason: 'unsafe-tree' };
  if (tree.directories.some(name => name !== 'public' && (!name.startsWith('public/')
    || ![...catalog.paths].some(file => file.startsWith(name.slice(7) + '/'))))) return { reason: 'unknown-file' };
  const payload = tree.files.filter(file => file.name !== MARKER);
  if (!payload.some(file => file.name === 'public/index.html')) return { reason: 'unknown-file' };
  const publicMedia = [];
  let unproven = false;
  for (const file of payload) {
    if (!file.name.startsWith('public/')) return { reason: 'unknown-file' };
    const name = file.name.slice(7);
    if (name === '.nojekyll' && file.bytes === 0) continue;
    if (!publicPath(name) || !catalog.paths.has(name)) return { reason: 'unknown-file' };
    const bytes = fs.readFileSync(checkedPath(repository, join(directory, file.name)));
    const hash = publicDigest(name, bytes, { cacheVersion: 'e2e-lot5-1' });
    if (name === 'assets/auth-config.json' && !hash) return { reason: 'protected-auth-config' };
    if (!hash || !catalog.hashes.has(hash)) unproven = true;
    else if (/\.(?:pdf|jpe?g|png|svg|webp|avif|gif|ico|woff2?|ttf|otf)$/.test(name)
      && catalog.rawHashes.has(digest(bytes))) publicMedia.push(file.name);
  }
  const fingerprint = buildFingerprint(repository, directory, tree);
  const marker = tree.files.find(file => file.name === MARKER);
  // Preserve uncommitted code snapshots. Only exact, committed media duplicates
  // can be trimmed from unmarked legacy test copies, never from a sealed run.
  if (unproven) return !marker && publicMedia.length
    ? { reason: 'public-media-duplicates', fingerprint, filesToRemove: publicMedia, partial: true }
    : { reason: 'unproven-content' };
  if (marker) {
    try {
      if (marker.bytes > 2048) return { reason: 'manifest-invalid' };
      const value = JSON.parse(fs.readFileSync(join(directory, MARKER), 'utf8'));
      if (Object.keys(value).sort().join(',') !== 'kind,pid,state,treeHash,version'
          || value.version !== 1 || value.kind !== 'e2e-public-build'
          || !['ready', 'complete'].includes(value.state)
          || !Number.isSafeInteger(value.pid) || value.pid < 1 || value.treeHash !== fingerprint.hash) {
        return { reason: 'manifest-invalid' };
      }
      if (isAlive(value.pid)) return { reason: 'active-run' };
    } catch { return { reason: 'manifest-invalid' }; }
  }
  return { reason: 'committed-public-build', fingerprint, filesToRemove: tree.files.map(file => file.name), partial: false };
}

export function inventoryTmp({ repository, catalog, processes = processSnapshot(), isAlive = pidAlive } = {}) {
  const tmp = checkedPath(repository, join(repository, '.tmp'), { absent: true });
  if (!fs.existsSync(tmp)) return { tmp, absent: true, bytes: 0, files: 0, directories: 0, groups: [], candidates: [], processes };
  if (!fs.lstatSync(tmp).isDirectory()) fail('invalid-root');
  const groups = [], candidates = [];
  let bytes = 0, files = 0, directories = 0, unknown = 0;
  for (const name of fs.readdirSync(tmp).sort()) {
    if (name === '.maintenance.lock') continue;
    const target = join(tmp, name), stat = fs.lstatSync(target);
    const label = BUILD_NAME.test(name) || KNOWN_GROUPS.has(name) ? name : `preserved-${++unknown}`;
    const base = { label, bytes: 0, files: 0, directories: 0, category: 'C', reason: 'unknown-preserved' };
    if (stat.isSymbolicLink() || !samePath(fs.realpathSync.native(target), target)) {
      groups.push({ ...base, reason: 'reparse-point' }); continue;
    }
    if (!stat.isDirectory()) {
      bytes += stat.size; files++;
      groups.push({ ...base, bytes: stat.size, files: 1 }); continue;
    }
    const tree = scanTree(repository, target);
    bytes += tree.bytes; files += tree.files.length; directories += tree.directories.length + 1;
    Object.assign(base, { bytes: tree.bytes, files: tree.files.length, directories: tree.directories.length + 1 });
    if (name === 'dev-recipe') Object.assign(base, { category: 'B/C', reason: 'recipe-evidence' });
    else if (KNOWN_GROUPS.has(name)) Object.assign(base, { category: 'C', reason: 'protected-local-artifact' });
    else if (/^(?:lot660[de](?:-|$)|lotd-pages-|preopening-operator(?:-|$))/.test(name)) {
      Object.assign(base, { category: 'B/C', reason: 'release-evidence' });
    }
    else if (BUILD_NAME.test(name)) {
      try {
        catalog ||= gitCatalog(repository);
        const result = qualifyBuild(repository, target, tree, catalog, isAlive);
        base.reason = result.reason;
        if (result.reason === 'active-run') base.category = 'B';
        if (result.fingerprint) {
          base.category = result.partial ? 'A/C' : 'A';
          if (!processes.available || processes.busy) {
            base.category = 'B';
            base.reason = processes.available ? 'processes-active' : 'process-check-unavailable';
          }
          else candidates.push({ target, name, tree, fingerprint: result.fingerprint, filesToRemove: result.filesToRemove, partial: result.partial });
        }
      } catch { base.reason = 'reference-unavailable'; }
    }
    groups.push(base);
  }
  return { tmp, absent: false, bytes, files, directories, groups, candidates, processes, catalog };
}

export function publicReport(inventory, applied = null) {
  const measuredBytes = applied?.afterBytes ?? inventory.bytes;
  const remaining = applied?.remainingGroups ?? inventory.groups;
  return {
    mode: applied ? 'apply' : 'simulation', absent: inventory.absent,
    beforeBytes: inventory.bytes, beforeFiles: inventory.files, directories: inventory.directories,
    candidateDirectories: inventory.candidates.length,
    candidateDetails: inventory.candidates.map(item => ({ directory: item.name,
      mode: item.partial ? 'public-media-only' : 'whole-public-build', files: item.filesToRemove,
      bytes: item.tree.files.filter(file => item.filesToRemove.includes(file.name)).reduce((sum, file) => sum + file.bytes, 0) })),
    expectedBytes: inventory.candidates.reduce((sum, item) => sum + item.tree.files.filter(file => item.filesToRemove.includes(file.name)).reduce((bytes, file) => bytes + file.bytes, 0), 0),
    processCheck: inventory.processes.available ? (inventory.processes.busy ? 'busy' : 'idle') : 'unavailable',
    rule: 'Inactive e2e public builds matching committed sources; only exact public media duplicates in unmarked legacy builds with uncommitted code. All other artifacts are preserved.',
    groups: inventory.groups, ...(applied || {}),
    capacity: {
      limitBytes: TMP_LIMIT_BYTES, measuredBytes,
      exceeded: measuredBytes > TMP_LIMIT_BYTES,
      overBytes: Math.max(0, measuredBytes - TMP_LIMIT_BYTES),
      largestRetained: [...remaining].sort((a, b) => b.bytes - a.bytes).slice(0, 10)
        .map(({ label, bytes, category, reason }) => ({ label, bytes, category, reason })),
    },
  };
}
