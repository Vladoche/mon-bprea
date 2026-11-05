// CLI hors ligne ; entrées/sorties privées sous .tmp, jamais dans Pages.
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { resolve, join, sep, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { protectDirectory, createPrivate } from '../dev-recipe/private-files.mjs';
import { emptyPrivateConfiguration, withConfirmedDecisions, contactCheck, invitationPreflight, closurePreflight, requireThat, fresh, digest, instant } from './preflight.mjs';
import { checkDirectory, regularFile, verifyBackup, currentSchemaHash, makeManifest, insideRepository } from './backup.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
function privateDirectory(name, create = false) {
  requireThat(typeof name === 'string' && /^preopening-[a-zA-Z0-9-]{1,48}$/.test(name), 'private_directory_name');
  const temporary = join(root, '.tmp');
  if (!existsSync(temporary)) mkdirSync(temporary);
  checkDirectory(temporary);
  const directory = join(temporary, name);
  if (create) { mkdirSync(directory); protectDirectory(directory); }
  checkDirectory(directory);
  requireThat(directory.startsWith(resolve(temporary) + sep), 'private_directory');
  return directory;
}
function json(directory, name) {
  const file = regularFile(directory, name);
  requireThat(readFileSync(file).length < 1_000_000, 'input_too_large');
  return JSON.parse(readFileSync(file, 'utf8'));
}
export function run(args, now = new Date().toISOString()) {
  const [command, name] = args;
  requireThat(args.length === 2 && ['init', 'contact', 'invitation', 'closure', 'seal', 'backup'].includes(command), 'usage');
  const directory = privateDirectory(name, command === 'init');
  if (command === 'init') {
    createPrivate(directory, 'operator.json', withConfirmedDecisions(emptyPrivateConfiguration()));
    createPrivate(directory, 'backup-context.json', { projectRef: null, backupDirectory: null, ledgerReviewedAt: null, protectionChecked: false });
    createPrivate(directory, 'deletions.json', []);
    return { status: 'DOSSIER PRIVÉ CRÉÉ — DÉCISIONS INTÉGRÉES, VÉRIFICATIONS OPÉRATIONNELLES REQUISES, AUCUNE CONNEXION', files: ['operator.json', 'backup-context.json', 'deletions.json'] };
  }
  if (command === 'contact') return contactCheck(json(directory, 'operator.json'), now);
  if (command === 'invitation') return invitationPreflight(json(directory, 'invitation.json'), json(directory, 'operator.json'), now);
  if (command === 'closure') return closurePreflight(json(directory, 'closure.json'), now);
  if (command === 'seal') {
    const context = json(directory, 'backup-context.json');
    const details = json(directory, 'snapshot-details.json');
    requireThat(Object.keys(details).sort().join() === 'completedAt,projectRef,snapshotStartedAt,sourceCommit,sourceKind,toolVersion', 'snapshot_details');
    requireThat(details.projectRef === context.projectRef && context.protectionChecked === true
      && /^[a-f0-9]{40}$/.test(details.sourceCommit) && /^pg_dump \(PostgreSQL\) 17\.\d+(?:\.\d+)?$/.test(details.toolVersion), 'snapshot_details');
    requireThat(['synthetic', 'authorized-hosted'].includes(details.sourceKind)
      && (details.sourceKind === 'synthetic' ? details.projectRef.startsWith('synthetic-') : ['wcckbyhrtroittbfophv', 'oqoqrxwfbkhtpksqimgd'].includes(details.projectRef)), 'source_kind');
    requireThat(instant(details.snapshotStartedAt) <= instant(details.completedAt) && instant(details.completedAt) <= instant(now), 'date_order');
    requireThat(context.backupDirectory == null || isAbsolute(context.backupDirectory), 'backup_directory_absolute');
    const source = context.backupDirectory ? checkDirectory(context.backupDirectory) : directory;
    requireThat(details.sourceKind === 'synthetic' || !insideRepository(source), 'backup_must_be_outside_repository');
    const manifest = makeManifest(source, { ...details, schemaHash: currentSchemaHash() }, readFileSync(regularFile(source, 'archive-toc.txt'), 'utf8'));
    createPrivate(source, 'manifest.json', manifest); // wx + fsync : jamais remplacer une génération existante.
    return { status: 'ARCHIVE SCELLÉE — RESTAURATION NON ENCORE VALIDÉE', guaranteed: false };
  }
  try {
    const context = json(directory, 'backup-context.json');
    fresh(context.ledgerReviewedAt, now, 86400_000);
    requireThat(context.backupDirectory == null || isAbsolute(context.backupDirectory), 'backup_directory_absolute');
    const source = context.backupDirectory ? checkDirectory(context.backupDirectory) : directory;
    return verifyBackup(source, json(source, 'manifest.json'), json(source, 'restore-evidence.json'),
      { ...context, schemaHash: currentSchemaHash(), ledgerHash: digest(json(directory, 'deletions.json')), now });
  }
  catch { return { status: 'OBJECTIF RPO NON SATISFAIT', reasons: ['missing_or_invalid_local_evidence'], completeAuthRecovery: 'NON DÉMONTRÉE', guaranteed: false }; }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = run(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.missing?.length || result.reasons?.length) process.exitCode = 2;
  } catch (error) {
    // Les erreurs système/JSON peuvent contenir un chemin nominatif ou l'entrée : ne pas les afficher.
    const code = /^[a-z_]{1,64}$/.test(error.message) ? error.message : 'invalid_private_input';
    process.stderr.write(`PRÉPARATION REFUSÉE (${code}) : vérifier en privé la cible, les préconditions et les fichiers. Aucun appel hébergé effectué.\n`);
    process.exitCode = 2;
  }
}
