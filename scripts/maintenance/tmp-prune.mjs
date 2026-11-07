import * as fs from 'node:fs';
import { resolve, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkedPath, checkWindowsAttributes, scanTree, buildFingerprint, fail, inventoryTmp, processSnapshot, publicReport, qualifyBuild } from './tmp-inventory.mjs';
import { MARKER, BUILD_NAME, digest } from './tmp-policy.mjs';

export const REPOSITORY = fileURLToPath(new URL('../../', import.meta.url));

export function applyPrune(inventory, { repository, processes = processSnapshot, unlink = fs.unlinkSync } = {}) {
  if (inventory.absent) return { removedFiles: 0, removedBytes: 0, removedDirectories: 0, failures: [], afterBytes: 0, afterFiles: 0, afterDirectories: 0, remainingGroups: [] };
  const tmp = checkedPath(repository, join(repository, '.tmp'));
  if (tmp !== inventory.tmp) fail('external-path');
  const lock = join(tmp, '.maintenance.lock');
  let fd;
  try { fd = fs.openSync(lock, 'wx', 0o600); }
  catch { fail('maintenance-locked'); }
  let removedFiles = 0, removedBytes = 0, removedDirectories = 0;
  const failures = [];
  try {
    fs.writeFileSync(fd, `${process.pid}\n`); fs.fsyncSync(fd);
    // Refuse to apply a stale plan while tests or an unknown process check are active.
    for (const item of inventory.candidates) {
      const current = processes();
      if (!current.available || current.busy) { failures.push({ label: item.name, code: 'processes-active-or-unknown' }); break; }
      try {
        if (!BUILD_NAME.test(item.name) || item.target !== join(tmp, item.name)) fail('external-path');
        checkedPath(repository, item.target);
        checkWindowsAttributes(repository, item.target);
        const tree = scanTree(repository, item.target);
        if (tree.links.length || tree.errors.length) fail('unsafe-tree');
        const fingerprint = buildFingerprint(repository, item.target, tree);
        if (fingerprint.hash !== item.fingerprint.hash || JSON.stringify(tree) !== JSON.stringify(item.tree)) fail('changed-since-inventory');
        // Requalify markers, content and live PID immediately before the group.
        const fresh = qualifyBuild(repository, item.target, tree, inventory.catalog);
        if (!fresh.fingerprint || JSON.stringify(fresh.filesToRemove) !== JSON.stringify(item.filesToRemove)) fail('changed-since-inventory');
        // No recursive rm/glob: unlink each checked file, then rmdir empty directories.
        // Windows sharing violations are reported without ACL changes or forced retries.
        const ordered = tree.files.filter(file => item.filesToRemove.includes(file.name))
          .sort((a, b) => Number(a.name === MARKER) - Number(b.name === MARKER));
        for (const file of ordered) {
          const target = checkedPath(repository, join(item.target, file.name));
          if (!fs.lstatSync(target).isFile()) fail('changed-since-inventory');
          const expected = fingerprint.entries.find(entry => entry.name === file.name);
          if (expected && digest(fs.readFileSync(target)) !== expected.sha256) fail('changed-since-inventory');
          unlink(target);
          removedFiles++; removedBytes += file.bytes;
        }
        for (const directory of [...tree.directories].sort((a, b) => b.split('/').length - a.split('/').length)) {
          try { fs.rmdirSync(checkedPath(repository, join(item.target, directory))); }
          catch (error) { if (!item.partial || error.code !== 'ENOTEMPTY') throw error; }
        }
        try { fs.rmdirSync(checkedPath(repository, item.target)); removedDirectories++; }
        catch (error) { if (!item.partial || error.code !== 'ENOTEMPTY') throw error; }
      } catch (error) {
        failures.push({ label: item.name, code: ['EACCES', 'EPERM', 'EBUSY'].includes(error.code)
          ? 'locked-or-denied' : ['external-path', 'reparse-point', 'unsafe-tree', 'changed-since-inventory', 'attribute-check-unavailable'].includes(error.code)
            ? error.code : 'group-incomplete' });
      }
    }
  } finally { fs.closeSync(fd); fs.unlinkSync(checkedPath(repository, lock)); }
  const after = inventoryTmp({ repository, catalog: inventory.catalog, processes: processes() });
  return { removedFiles, removedBytes, removedDirectories, failures,
    afterBytes: after.bytes, afterFiles: after.files, afterDirectories: after.directories, remainingGroups: after.groups };
}

export const volume = bytes => `${(bytes / 1e6).toFixed(2)} Mo / ${(bytes / 1e9).toFixed(3)} Go`;

export function main(args = process.argv.slice(2), {
  repository = REPOSITORY, catalog, processes = processSnapshot, write = line => console.log(line),
} = {}) {
  if (args.some(arg => !['--apply', '--delivery', '--json'].includes(arg)) || new Set(args).size !== args.length
      || args.includes('--apply') && args.includes('--delivery')) fail('invalid-arguments');
  const apply = args.includes('--apply') || args.includes('--delivery');
  const inventory = inventoryTmp({ repository, catalog, processes: processes() });
  const result = apply ? applyPrune(inventory, { repository, processes }) : null;
  const report = publicReport(inventory, result);
  if (args.includes('--json')) write(JSON.stringify(report, null, 2));
  else {
    write(`.tmp — ${report.mode} : ${volume(report.beforeBytes)}, ${report.beforeFiles} fichiers, ${report.directories} dossiers.`);
    write(`Candidats : ${report.candidateDirectories} dossiers, ${volume(report.expectedBytes)}. Processus : ${report.processCheck}.`);
    for (const candidate of report.candidateDetails) write(`${candidate.directory} | ${candidate.mode} | ${candidate.files.length} fichiers | ${volume(candidate.bytes)}`);
    const protectedGroups = report.groups.filter(group => !report.candidateDetails.some(candidate => candidate.directory === group.label));
    const reasons = Object.entries(Object.groupBy(protectedGroups, group => group.reason)).map(([reason, items]) => `${reason}=${items.length}`);
    write(`Conservés : ${protectedGroups.length} éléments (${reasons.join(', ')}). Détail minimisé : --json.`);
    if (result) write(`Nettoyés : ${result.removedFiles} fichiers, ${volume(result.removedBytes)}. Restants : ${volume(result.afterBytes)}. Échecs : ${result.failures.length}.`);
    write(`Plafond 500 Mo : ${report.capacity.exceeded ? `DÉPASSÉ de ${volume(report.capacity.overBytes)}` : 'respecté'}.`);
    if (report.capacity.exceeded) {
      write('Plus gros éléments conservés (aucune suppression supplémentaire pour atteindre le plafond) :');
      for (const group of report.capacity.largestRetained) write(`${group.label} | ${group.category} | ${group.reason} | ${volume(group.bytes)}`);
    }
  }
  if (result?.failures.length) process.exitCode = 1;
  if (apply && !inventory.absent && (!inventory.processes.available || inventory.processes.busy)) process.exitCode = 1;
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); }
  catch (error) {
    const codes = ['external-path', 'reparse-point', 'invalid-arguments', 'maintenance-locked', 'invalid-root'];
    console.error(`Maintenance refusée : ${codes.includes(error.code) ? error.code : 'local-check-failed'}.`);
    process.exitCode = 1;
  }
}
