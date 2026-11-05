import { afterAll, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync, realpathSync, linkSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { POLICY, emptyPrivateConfiguration, contactCheck, invitationPreflight, closurePreflight, digest } from '../../scripts/preopening/preflight.mjs';
import { makeManifest, verifyBackup, localPgTarget } from '../../scripts/preopening/backup.mjs';
import { noticeHtml } from '../../scripts/preopening/notice-preview.mjs';
import { run } from '../../scripts/preopening/operator.mjs';

const now = '2026-11-05T12:00:00.000Z', observedAt = '2026-11-05T11:59:00.000Z';
const account = n => ({ id: `655b0000-0000-4000-8000-${String(n).padStart(12, '0')}`, email: `synthetic-${n}@example.invalid`, kind: n === 1 ? 'operator' : 'participant', state: 'active', privileged: false });
function config() {
  const result = emptyPrivateConfiguration();
  result.operatorIdentity = 'Exploitant synthétique'; result.capacityConfirmed = true;
  result.contact = { email: 'synthetic-contact@example.invalid', publicationApproved: true, owned: true, protected: true, recoveryChecked: true, withoutAccountChecked: true, receivedAt: observedAt, repliedAt: now };
  result.approvals = Object.fromEntries(Object.keys(result.approvals).map(key => [key, true]));
  return result;
}
function input(count = 6) {
  return { target: { environment: 'production', projectRef: 'oqoqrxwfbkhtpksqimgd', siteUrl: 'https://vladoche.github.io/mon-bprea/', callback: 'https://vladoche.github.io/mon-bprea/authentification.html' },
    inventory: { projectRef: 'oqoqrxwfbkhtpksqimgd', observedAt, complete: true, publicSignup: false, anonymousSignIn: false, accounts: Array.from({ length: count }, (_, i) => account(i + 1)) },
    type: 'invite', requestedRole: 'participant', recipient: 'synthetic-7@example.invalid', noticeProvidedBeforeEmail: true,
    directRequest: true, emailConfirmed: true, noticeVersion: 'synthetic-v1', identityChecked: true, previousResult: 'none' };
}
describe('préouverture : capacité administrative, jamais quota Supabase', () => {
  it('permet le septième compte dans le plan hors ligne et refuse le huitième', () => {
    const result = invitationPreflight(input(), config(), now);
    expect(result).toMatchObject({ capacity: 7, occupiedIncludingOperator: 6, enforcement: 'administrative', targetChecked: true });
    const eighth = input(7); eighth.recipient = 'synthetic-8@example.invalid';
    expect(() => invitationPreflight(eighth, config(), now)).toThrow('capacity_full');
  });
  it('réserve la place de l’exploitant absent et exige la confirmation du décompte', () => {
    const value = input(); value.inventory.accounts = value.inventory.accounts.filter(a => a.kind !== 'operator');
    expect(invitationPreflight(value, config(), now).occupiedIncludingOperator).toBe(6);
    value.inventory.accounts.push(account(8));
    expect(() => invitationPreflight(value, config(), now)).toThrow('capacity_full');
    expect(() => invitationPreflight(input(), { ...config(), capacityConfirmed: false }, now)).toThrow('capacity_unconfirmed');
  });
  it('compte les invitations en attente, bloque l’incertain et distingue les comptes fictifs', () => {
    const value = input(); value.inventory.accounts[2].state = 'pending';
    expect(invitationPreflight(value, config(), now).occupiedIncludingOperator).toBe(6);
    value.inventory.accounts[2].state = 'uncertain';
    expect(() => invitationPreflight(value, config(), now)).toThrow('uncertain_no_retry');
    value.inventory.accounts[2].kind = 'fixture';
    expect(() => invitationPreflight(value, config(), now)).toThrow('fixtures_require_separate_D');
  });
  it('refuse réinvitation, récupération inconnue et tentative d’élévation de privilèges', () => {
    const value = input(); value.recipient = value.inventory.accounts[1].email;
    expect(() => invitationPreflight(value, config(), now)).toThrow('account_state');
    value.type = 'recovery'; expect(invitationPreflight(value, config(), now).type).toBe('recovery');
    value.recipient = 'absent@example.invalid'; expect(() => invitationPreflight(value, config(), now)).toThrow('account_state');
    value.requestedRole = 'admin'; expect(() => invitationPreflight(value, config(), now)).toThrow('operation');
  });
  it.each(['publicSignup', 'anonymousSignIn'])('refuse une configuration ouverte : %s', key => {
    const value = input(); value.inventory[key] = true;
    expect(() => invitationPreflight(value, config(), now)).toThrow('signup_not_closed');
  });
  it('refuse inventaire périmé/partiel, projet ou callback incohérent et identité dupliquée', () => {
    for (const mutate of [v => { v.inventory.observedAt = '2026-11-05T11:00:00.000Z'; }, v => { v.inventory.complete = false; },
      v => { v.inventory.projectRef = 'wrong'; }, v => { v.target.callback += '?next=https://example.invalid'; },
      v => { v.inventory.accounts.push(v.inventory.accounts[0]); }]) {
      const value = input(); mutate(value); expect(() => invitationPreflight(value, config(), now)).toThrow();
    }
  });
  it('ne révèle ni destinataire ni adresses ou résultats des autres comptes dans son bilan', () => {
    const value = input(); value.inventory.accounts[0].results = 'NEVER-PRINT-RESULT';
    const output = JSON.stringify(invitationPreflight(value, config(), now));
    expect(output).not.toContain('@'); expect(output).not.toContain('NEVER-PRINT-RESULT');
  });
});
describe('contact et clôture préparés sans identité ou opération inventée', () => {
  it('la configuration initiale bloque le canal absent ; chaque preuve est nécessaire', () => {
    expect(contactCheck(emptyPrivateConfiguration(), now).missing).toContain('real_email');
    for (const key of ['publicationApproved', 'owned', 'protected', 'recoveryChecked', 'withoutAccountChecked']) {
      const value = config(); value.contact[key] = false; expect(contactCheck(value, now).missing).toContain(`contact_${key}`);
    }
    expect(contactCheck(config(), now).missing).toEqual([]);
  });
  const closure = () => {
    const value = input(2);
    return { ...value, userId: account(2).id, confirmUserId: account(2).id, identityChecked: true, requestConfirmed: true, exportOffered: true,
      sessionsPlan: 'native-delete-refresh-expiry-check', cachesPlan: 'assisted-per-device', backupsPlan: 'reconcile-before-restore', failurePlan: 'stop-read-state-no-blind-retry',
      inventory: { ...value.inventory, dependenciesChecked: true, cascadeCount: 11, storageObjectsForTarget: 0, targetRows: Object.fromEntries(POLICY.tables.map(t => [t, 1])) } };
  };
  it('prépare une seule cible UUID et bloque les erreurs d’identité, dépendances et reprise incertaine', () => {
    expect(closurePreflight(closure(), now).tablesChecked).toBe(10);
    for (const mutate of [v => { v.confirmUserId = account(1).id; }, v => { v.identityChecked = false; },
      v => { delete v.inventory.targetRows.profiles; }, v => { v.inventory.storageObjectsForTarget = 1; },
      v => { v.inventory.cascadeCount = 10; }, v => { v.previousResult = 'uncertain'; },
      v => { v.inventory.accounts[1].state = 'uncertain'; },
      v => { v.inventory.accounts[1].kind = 'fixture'; }]) {
      const value = closure(); mutate(value); expect(() => closurePreflight(value, now)).toThrow();
    }
  });
  it('masque toute entrée invalide de la CLI et ne propose aucune mutation', () => {
    const result = spawnSync(process.execPath, ['scripts/preopening/operator.mjs', 'delete-all', 'SECRET-do-not-print@example.invalid'], { encoding: 'utf8' });
    expect(result.status).toBe(2); expect(result.stderr).not.toContain('SECRET'); expect(result.stdout).toBe('');
  });
  it('génère un aperçu sans script, sans requête et avec mode sombre et texte échappé', () => {
    const html = noticeHtml('# Notice\n\n<script>alert(1)</script>\n\n[CNIL](https://www.cnil.fr/)');
    expect(html).not.toContain('<script>'); expect(html).toContain('&lt;script&gt;'); expect(html).toContain('color-scheme:light dark');
    expect(html).toContain('href="https://www.cnil.fr/"');
  });
});

mkdirSync(resolve('.tmp'), { recursive: true });
const directory = mkdtempSync(resolve('.tmp/preopening-test-'));
afterAll(() => { if (realpathSync(directory).startsWith(realpathSync('.tmp') + sep + 'preopening-test-')) rmSync(directory, { recursive: true }); });
function backup() {
  writeFileSync(join(directory, 'application.dump'), 'SYNTHETIC-ARCHIVE-NOT-POSTGRES');
  const toc = POLICY.tables.map((t, i) => `${i + 1}; 1259 123 TABLE public ${t} postgres\n${i + 20}; 0 123 TABLE DATA public ${t} postgres`).join('\n');
  writeFileSync(join(directory, 'archive-toc.txt'), toc);
  const context = { now, projectRef: 'synthetic-only', schemaHash: digest('synthetic-schema'), ledgerHash: digest([]), protectionChecked: true };
  const manifest = makeManifest(directory, { projectRef: context.projectRef, sourceKind: 'synthetic', schemaHash: context.schemaHash, snapshotStartedAt: '2026-10-29T12:00:00.000Z', completedAt: '2026-10-29T12:05:00.000Z' }, toc);
  const evidence = { version: 1, manifestHash: digest(manifest), archiveHash: manifest.files['application.dump'].sha256, projectRef: manifest.projectRef, schemaHash: manifest.schemaHash,
    testedAt: '2026-10-29T13:00:00.000Z', isolated: true, restoreSucceeded: true, dataCompared: true, schemaAndPrivilegesCompared: true,
    dependenciesCompatible: true, deletionLedgerHash: context.ledgerHash, deletionsReconciled: true };
  return { manifest, evidence, context };
}
describe('RPO mesuré depuis un snapshot restauré, jamais depuis le dernier déclenchement', () => {
  it('168 heures incluses, puis objectif non satisfait ; alerte dès six jours', () => {
    const { manifest, evidence, context } = backup();
    const result = verifyBackup(directory, manifest, evidence, context);
    expect(result.reasons).toEqual([]); expect(result.warning).toBeTruthy(); expect(result.guaranteed).toBe(false); expect(result.completeAuthRecovery).toBe('NON DÉMONTRÉE');
    expect(verifyBackup(directory, manifest, evidence, { ...context, now: '2026-11-05T12:00:00.001Z' }).status).toBe('OBJECTIF RPO NON SATISFAIT');
  });
  it('échec réseau, PC absent ou copie manquée ne rajeunissent jamais la dernière copie valide', () => {
    const { manifest, evidence, context } = backup();
    for (const reason of ['network', 'pc_off', 'missed']) {
      const result = verifyBackup(directory, { ...manifest, lastAttempt: { status: 'failed', reason, at: now } }, evidence, { ...context, now: '2026-11-06T12:00:00.000Z' });
      expect(result.status).toBe('OBJECTIF RPO NON SATISFAIT'); expect(result.ageHours).toBe(192);
    }
  });
  it('refuse archive corrompue, couverture partielle, restauration non liée et preuve future', () => {
    for (const mutate of [v => writeFileSync(join(directory, 'application.dump'), 'CORRUPTED'),
      v => { v.manifest.tables = ['profiles']; }, v => { v.evidence.manifestHash = digest('another'); },
      v => { v.evidence.testedAt = '2026-11-06T12:00:00.000Z'; }, v => { v.context.protectionChecked = false; },
      v => { v.context.schemaHash = digest('new-schema'); }, v => { v.evidence.dependenciesCompatible = false; }]) {
      const value = backup(); mutate(value);
      expect(verifyBackup(directory, value.manifest, value.evidence, value.context).status).toBe('OBJECTIF RPO NON SATISFAIT');
    }
  });
  it('refuse la résurrection : journal d’effacements changé, non réconcilié ou sans preuve', () => {
    const { manifest, evidence, context } = backup();
    expect(verifyBackup(directory, manifest, evidence, { ...context, ledgerHash: digest(['new-deletion']) }).reasons).toContain('deletions_not_reconciled');
    expect(verifyBackup(directory, manifest, { ...evidence, deletionsReconciled: false }, context).status).toBe('OBJECTIF RPO NON SATISFAIT');
    expect(verifyBackup(directory, manifest, null, context).status).toBe('OBJECTIF RPO NON SATISFAIT');
  });
  it('scelle un snapshot synthétique une seule fois, sans succès RPO ni écrasement implicite', () => {
    const { context } = backup(), name = directory.split(/[\\/]/).at(-1);
    writeFileSync(join(directory, 'backup-context.json'), JSON.stringify({ projectRef: context.projectRef, backupDirectory: null, protectionChecked: true, ledgerReviewedAt: now }));
    writeFileSync(join(directory, 'snapshot-details.json'), JSON.stringify({ projectRef: context.projectRef, sourceKind: 'synthetic', sourceCommit: '1'.repeat(40), toolVersion: 'pg_dump (PostgreSQL) 17.11', snapshotStartedAt: now, completedAt: now }));
    expect(run(['seal', name], now).status).toContain('RESTAURATION NON ENCORE VALIDÉE');
    const sealed = readFileSync(join(directory, 'manifest.json'), 'utf8');
    expect(() => run(['seal', name], now)).toThrow();
    expect(readFileSync(join(directory, 'manifest.json'), 'utf8')).toBe(sealed);
    expect(run(['backup', name], now).status).toBe('OBJECTIF RPO NON SATISFAIT');
  });
  it('refuse de déclarer une sauvegarde hébergée valide si elle est stockée dans le dépôt', () => {
    const { manifest, evidence, context } = backup();
    const projectRef = 'oqoqrxwfbkhtpksqimgd'; // chaîne seulement, aucune connexion
    expect(verifyBackup(directory, { ...manifest, sourceKind: 'authorized-hosted', projectRef }, evidence, { ...context, projectRef }).reasons)
      .toContain('backup_must_be_outside_repository');
  });
  it('refuse traversée, liens et cibles PostgreSQL distantes ou bases arbitraires', () => {
    const { manifest, evidence, context } = backup();
    const origin = join(directory, 'application.dump'), copy = join(directory, 'linked.dump');
    linkSync(origin, copy);
    expect(verifyBackup(directory, manifest, evidence, context).reasons).toContain('file_boundary');
    rmSync(copy);
    for (const host of ['db.oqoqrxwfbkhtpksqimgd.supabase.co', 'localhost', '127.1'])
      expect(() => localPgTarget({ host, port: 54322, database: 'postgres' })).toThrow('local_postgres_only');
    expect(() => localPgTarget({ host: '127.0.0.1', port: 54322, database: 'postgres' })).toThrow();
    expect(localPgTarget({ host: '127.0.0.1', port: 65432, database: 'bprea655b_123456abcdef_source' })).toContain('--host=127.0.0.1');
  });
});
