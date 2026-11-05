// Vérifie uniquement des fichiers locaux. Aucune connexion ni purge.
import { readFileSync, readdirSync, lstatSync, realpathSync, openSync, readSync, closeSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { POLICY, requireThat, instant, digest } from './preflight.mjs';

export function currentSchemaHash() {
  const directory = new URL('../../supabase/migrations/', import.meta.url);
  return digest(readdirSync(directory).filter(name => name.endsWith('.sql')).sort()
    .map(name => [name, readFileSync(new URL(name, directory), 'utf8').replaceAll('\r\n', '\n')]));
}
export function insideRepository(directory) {
  const normalize = value => process.platform === 'win32' ? value.toLowerCase() : value;
  const repository = normalize(realpathSync(fileURLToPath(new URL('../../', import.meta.url))));
  const candidate = normalize(realpathSync(directory));
  return candidate === repository || candidate.startsWith(repository + sep);
}

export function regularFile(directory, name) {
  requireThat(typeof name === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(name), 'file_name');
  const file = join(directory, name), stat = lstatSync(file);
  requireThat(!stat.isSymbolicLink() && stat.isFile() && stat.size > 0 && stat.nlink === 1
    && realpathSync(file).startsWith(realpathSync(directory) + sep), 'file_boundary');
  return file;
}
export function fingerprint(file) {
  const fd = openSync(file, 'r'), hash = createHash('sha256'), buffer = Buffer.alloc(64 * 1024);
  try { let count; while ((count = readSync(fd, buffer)) > 0) hash.update(buffer.subarray(0, count)); }
  finally { closeSync(fd); }
  return { bytes: lstatSync(file).size, sha256: hash.digest('hex') };
}
export function verifyBackup(directory, manifest, evidence, { now, projectRef, schemaHash, ledgerHash, protectionChecked = false } = {}) {
  const reasons = [], reject = code => reasons.push(code);
  let point = null;
  try {
    checkDirectory(directory);
    requireThat(manifest?.version === 1 && manifest.projectRef === projectRef && typeof projectRef === 'string', 'project');
    requireThat(['synthetic', 'authorized-hosted'].includes(manifest.sourceKind)
      && (manifest.sourceKind === 'synthetic' ? projectRef.startsWith('synthetic-') : ['wcckbyhrtroittbfophv', 'oqoqrxwfbkhtpksqimgd'].includes(projectRef)), 'source_kind');
    requireThat(manifest.sourceKind === 'synthetic' || !insideRepository(directory), 'backup_must_be_outside_repository');
    requireThat(/^[a-f0-9]{64}$/.test(schemaHash) && manifest.schemaHash === schemaHash, 'schema_current');
    requireThat(protectionChecked === true, 'private_storage_not_checked');
    point = instant(manifest.snapshotStartedAt);
    requireThat(point <= instant(manifest.completedAt) && instant(manifest.completedAt) <= instant(now), 'date_order');
    requireThat(manifest.method === 'pg_dump-custom-single-snapshot' && manifest.authIncluded === false
      && manifest.tables?.slice().sort().join() === [...POLICY.tables].sort().join()
      && manifest.exclusions?.slice().sort().join() === [...POLICY.excludedBackupScopes].sort().join(), 'coverage');
    requireThat(Object.keys(manifest.files || {}).sort().join() === 'application.dump,archive-toc.txt', 'files');
    for (const [name, spec] of Object.entries(manifest.files)) {
      const actual = fingerprint(regularFile(directory, name));
      requireThat(actual.bytes === spec.bytes && actual.sha256 === spec.sha256, 'integrity');
    }
    const toc = readFileSync(regularFile(directory, 'archive-toc.txt'), 'utf8');
    const tables = [...toc.matchAll(/^\d+; \d+ \d+ TABLE public ([a-z_]+) /gm)].map(m => m[1]).sort();
    const data = [...toc.matchAll(/^\d+; \d+ \d+ TABLE DATA public ([a-z_]+) /gm)].map(m => m[1]).sort();
    const tableSchemas = [...toc.matchAll(/^\d+; \d+ \d+ TABLE(?: DATA)? ([a-z_]+) /gm)].map(m => m[1]);
    requireThat(tables.join() === [...POLICY.tables].sort().join() && data.join() === tables.join()
      && tableSchemas.every(schema => schema === 'public')
      && !/^\d+; \d+ \d+ .*\b(auth|storage|vault)\b/m.test(toc), 'toc_coverage');
    requireThat(evidence?.version === 1 && evidence.manifestHash === digest(manifest)
      && evidence.archiveHash === manifest.files['application.dump'].sha256
      && evidence.projectRef === projectRef && evidence.schemaHash === schemaHash, 'restore_not_bound');
    requireThat(instant(evidence.testedAt) >= instant(manifest.completedAt) && instant(evidence.testedAt) <= instant(now), 'restore_date');
    requireThat(evidence.isolated === true && evidence.restoreSucceeded === true
      && evidence.dataCompared === true && evidence.schemaAndPrivilegesCompared === true
      && evidence.dependenciesCompatible === true, 'restore_not_proven');
    requireThat(/^[a-f0-9]{64}$/.test(ledgerHash) && evidence.deletionLedgerHash === ledgerHash
      && evidence.deletionsReconciled === true, 'deletions_not_reconciled');
  } catch (error) { reject(/^[a-z_]+$/.test(error.message) ? error.message : 'invalid_or_missing_files'); }
  const ageHours = point === null ? null : (instant(now) - point) / 3600_000;
  if (ageHours !== null && ageHours > POLICY.backup.maximumAgeHours) reject('older_than_seven_days');
  const satisfied = reasons.length === 0;
  return { status: satisfied ? 'OBJECTIF RPO APPLICATIF SATISFAIT À CET INSTANT' : 'OBJECTIF RPO NON SATISFAIT',
    reasons, ageHours, warning: satisfied && ageHours >= POLICY.backup.warningAgeHours ? 'ÉCHÉANCE PROCHE — COPIE ET RESTAURATION À RENOUVELER' : null,
    nextDeadline: point === null ? null : new Date(point + POLICY.backup.maximumAgeHours * 3600_000).toISOString(),
    completeAuthRecovery: 'NON DÉMONTRÉE', scope: 'application-only', syntheticOnly: manifest?.sourceKind === 'synthetic', guaranteed: false };
}
export function makeManifest(directory, details, toc) {
  const files = Object.fromEntries(['application.dump', 'archive-toc.txt'].map(name => [name, fingerprint(regularFile(directory, name))]));
  requireThat(toc === readFileSync(regularFile(directory, 'archive-toc.txt'), 'utf8'), 'toc');
  return { version: 1, ...details, method: 'pg_dump-custom-single-snapshot', tables: POLICY.tables,
    exclusions: POLICY.excludedBackupScopes, authIncluded: false, files };
}
export function localPgTarget({ host, port, database }) {
  requireThat(host === '127.0.0.1' && Number.isSafeInteger(port) && port >= 49152 && port <= 65535
    && /^bprea655b_[a-f0-9]{12}_(source|restore)$/.test(database), 'local_postgres_only');
  return ['--host=127.0.0.1', `--port=${port}`, '--username=postgres', `--dbname=${database}`, '--no-password'];
}
export function checkDirectory(directory) {
  const absolute = resolve(directory);
  let current = absolute;
  while (true) { requireThat(!lstatSync(current).isSymbolicLink(), 'directory_link'); const parent = resolve(current, '..'); if (parent === current) break; current = parent; }
  requireThat(lstatSync(absolute).isDirectory(), 'directory');
  return absolute;
}
