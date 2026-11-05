import { afterEach, describe, expect, test } from 'vitest';
import * as fs from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { referenceCatalog, MARKER } from '../../scripts/maintenance/tmp-policy.mjs';
import { inventoryTmp, publicReport, checkedPath, scanTree, buildFingerprint } from '../../scripts/maintenance/tmp-inventory.mjs';
import { applyPrune } from '../../scripts/maintenance/tmp-prune.mjs';
import { ownTestBuild } from '../../scripts/maintenance/tmp-build.mjs';

// Only synthetic public bytes and private tokens. No real recipe journal is read.
const index = Buffer.from('<html><link href="assets/style.css"></html>\n');
const style = Buffer.from('body { color: green; }\n');
const catalog = referenceCatalog([{ name: 'index.html', bytes: index }, { name: 'assets/style.css', bytes: style }]);
const idle = { available: true, busy: false };
const roots = [];
function fixture({ absent = false } = {}) {
  fs.mkdirSync(resolve('.tmp'), { recursive: true });
  const repo = fs.mkdtempSync(resolve('.tmp/maintenance-tests-'));
  roots.push(repo);
  if (!absent) fs.mkdirSync(join(repo, '.tmp'));
  return repo;
}
function build(repo, { marker = false, pid = 2147483647 } = {}) {
  const dir = join(repo, '.tmp', 'e2e-Ab1234');
  fs.mkdirSync(join(dir, 'public', 'assets'), { recursive: true });
  fs.writeFileSync(join(dir, 'public', 'index.html'), index.toString().replace('style.css', 'style.css?v=e2e-lot5-1'));
  fs.writeFileSync(join(dir, 'public', 'assets', 'style.css'), style);
  fs.writeFileSync(join(dir, 'public', '.nojekyll'), '');
  if (marker) {
    const treeHash = buildFingerprint(repo, dir, scanTree(repo, dir)).hash;
    fs.writeFileSync(join(dir, MARKER), JSON.stringify({ version: 1, kind: 'e2e-public-build', pid, state: 'ready', treeHash }));
  }
  return dir;
}
const inspect = repo => inventoryTmp({ repository: repo, catalog, processes: idle });
const apply = (repo, inventory = inspect(repo), overrides = {}) => applyPrune(inventory, { repository: repo, processes: () => idle, ...overrides });
afterEach(() => {
  for (const repo of roots.splice(0)) {
    // These are fresh synthetic fixture roots; never the real .tmp itself.
    expect(repo.startsWith(resolve('.tmp') + '\\') || repo.startsWith(resolve('.tmp') + '/')).toBe(true);
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

describe('maintenance locale de .tmp', () => {
  test('simulation entièrement en lecture seule et volume exact', () => {
    const repo = fixture(), dir = build(repo);
    const before = scanTree(repo, join(repo, '.tmp'));
    const report = publicReport(inspect(repo));
    expect(report.mode).toBe('simulation');
    expect(report.expectedBytes).toBe(before.bytes);
    expect(report.candidateDirectories).toBe(1);
    expect(scanTree(repo, join(repo, '.tmp'))).toEqual(before);
    const other = fixture(), otherDir = build(other);
    fs.mkdirSync(join(otherDir, 'public', 'unknown-reservation'));
    expect(apply(other).removedFiles).toBe(0);
    expect(fs.existsSync(join(dir, 'public', 'index.html'))).toBe(true);
  });

  test('suppression ciblée, comptage réellement supprimé et idempotence', () => {
    const repo = fixture(), dir = build(repo);
    const size = scanTree(repo, dir).bytes;
    const result = apply(repo);
    expect(result).toMatchObject({ removedBytes: size, removedFiles: 3, removedDirectories: 1, afterBytes: 0, afterFiles: 0, failures: [] });
    expect(fs.existsSync(dir)).toBe(false);
    expect(apply(repo)).toMatchObject({ removedBytes: 0, removedFiles: 0, failures: [] });
  });

  test('refuse une destination externe, la racine et les arguments libres de CLI', () => {
    const repo = fixture(), outside = join(repo, 'reference');
    fs.mkdirSync(outside); fs.writeFileSync(join(outside, 'keep'), 'reference');
    expect(() => checkedPath(repo, outside)).toThrow('external-path');
    expect(() => checkedPath(repo, repo)).toThrow('external-path');
    const plan = inspect(repo);
    plan.candidates.push({ name: '../reference', target: outside });
    expect(apply(repo, plan).failures).toEqual([{ label: '../reference', code: 'external-path' }]);
    const command = spawnSync(process.execPath, ['scripts/maintenance/tmp-prune.mjs', '--root', outside], { encoding: 'utf8' });
    expect(command.status).toBe(1);
    expect(command.stderr).toContain('invalid-arguments');
    expect(fs.readFileSync(join(outside, 'keep'), 'utf8')).toBe('reference');
  });

  for (const type of ['dir', 'junction']) test(`ne traverse pas de lien ${type}`, (context) => {
    const repo = fixture(), outside = join(repo, 'reference');
    fs.mkdirSync(outside); fs.writeFileSync(join(outside, 'keep'), 'reference');
    const link = join(repo, '.tmp', 'e2e-Ab1234');
    try { fs.symlinkSync(outside, link, type); }
    catch (error) { if (error.code === 'EPERM') { context.skip(); return; } throw error; }
    expect(() => checkedPath(repo, link)).toThrow('reparse-point');
    expect(inspect(repo).candidates).toHaveLength(0);
    expect(apply(repo).removedFiles).toBe(0);
    expect(fs.readFileSync(join(outside, 'keep'), 'utf8')).toBe('reference');
  });

  test('refuse une racine .tmp redirigée par jonction', () => {
    const repo = fixture({ absent: true }), target = join(repo, 'reference');
    fs.mkdirSync(target); fs.symlinkSync(target, join(repo, '.tmp'), process.platform === 'win32' ? 'junction' : 'dir');
    expect(() => inspect(repo)).toThrow('reparse-point');
  });

  test('préserve preuves, réservations, sauvegardes et fichiers inconnus', () => {
    const repo = fixture(), dir = build(repo);
    fs.writeFileSync(join(dir, 'invite-A.attempt.json'), '{"status":"uncertain"}');
    for (const name of ['dev-recipe', 'unknown', 'backup']) {
      fs.mkdirSync(join(repo, '.tmp', name)); fs.writeFileSync(join(repo, '.tmp', name, 'evidence.json'), '{"synthetic":true}');
    }
    const before = scanTree(repo, join(repo, '.tmp'));
    expect(apply(repo).removedFiles).toBe(0);
    expect(scanTree(repo, join(repo, '.tmp'))).toEqual(before);
  });

  test('préserve un run actif et les builds pendant les tests', () => {
    const repo = fixture(); build(repo, { marker: true, pid: process.pid });
    expect(inspect(repo).groups[0].reason).toBe('active-run');
    expect(apply(repo).removedFiles).toBe(0);
    const other = fixture(); build(other);
    for (const processes of [{ available: true, busy: true }, { available: false, busy: true }]) {
      expect(inventoryTmp({ repository: other, catalog, processes }).candidates).toHaveLength(0);
    }
    expect(apply(other, inspect(other), { processes: () => ({ available: false, busy: true }) }).removedFiles).toBe(0);
  });

  test('dossier absent : aucune création, même en application', () => {
    const repo = fixture({ absent: true });
    expect(publicReport(inspect(repo))).toMatchObject({ absent: true, beforeBytes: 0 });
    expect(apply(repo).removedFiles).toBe(0);
    expect(fs.readdirSync(repo)).toEqual([]);
  });

  test('manifeste valide orphelin puis refus du manifeste altéré sans suivre de cible', () => {
    const repo = fixture(), dir = build(repo, { marker: true });
    expect(inspect(repo).candidates).toHaveLength(1);
    const marker = JSON.parse(fs.readFileSync(join(dir, MARKER), 'utf8'));
    marker.target = '../../reference';
    fs.writeFileSync(join(dir, MARKER), JSON.stringify(marker));
    expect(inspect(repo).groups[0].reason).toBe('manifest-invalid');
    expect(apply(repo).removedFiles).toBe(0);
    delete marker.target; marker.treeHash = '0'.repeat(64);
    fs.writeFileSync(join(dir, MARKER), JSON.stringify(marker));
    expect(inspect(repo).groups[0].reason).toBe('manifest-invalid');
  });

  test('refuse contenu modifié, lien intérieur et plan devenu périmé', () => {
    const repo = fixture(), dir = build(repo), plan = inspect(repo);
    fs.writeFileSync(join(dir, 'public', 'index.html'), 'private payload');
    expect(inspect(repo).groups[0].reason).toBe('unproven-content');
    expect(apply(repo, plan).removedFiles).toBe(0);
    const other = fixture(), otherDir = build(other);
    fs.symlinkSync(join(otherDir, 'public'), join(otherDir, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    expect(inspect(other).candidates).toHaveLength(0);
  });

  test('copie de test inconnue : retire seulement les médias publics dupliqués', () => {
    const repo = fixture(), dir = build(repo), pdf = Buffer.from('%PDF-synthetic-public');
    fs.mkdirSync(join(dir, 'public', 'documents'));
    fs.writeFileSync(join(dir, 'public', 'documents', 'guide.pdf'), pdf);
    fs.writeFileSync(join(dir, 'public', 'index.html'), 'unknown private snapshot');
    const refs = referenceCatalog([{ name: 'index.html', bytes: index }, { name: 'assets/style.css', bytes: style }, { name: 'documents/guide.pdf', bytes: pdf }]);
    const plan = inventoryTmp({ repository: repo, catalog: refs, processes: idle });
    expect(plan.groups[0].reason).toBe('public-media-duplicates');
    expect(publicReport(plan).expectedBytes).toBe(pdf.length);
    expect(apply(repo, plan)).toMatchObject({ removedBytes: pdf.length, removedFiles: 1, removedDirectories: 0, failures: [] });
    expect(fs.readFileSync(join(dir, 'public', 'index.html'), 'utf8')).toBe('unknown private snapshot');
    expect(inventoryTmp({ repository: repo, catalog: refs, processes: idle }).candidates).toHaveLength(0);
  });

  test('exclusion mutuelle et refus sans modification des ACL', () => {
    const repo = fixture(); build(repo);
    fs.writeFileSync(join(repo, '.tmp', '.maintenance.lock'), 'synthetic-lock');
    expect(() => apply(repo)).toThrow('maintenance-locked');
    expect(fs.readFileSync(join(repo, '.tmp', '.maintenance.lock'), 'utf8')).toBe('synthetic-lock');
  });

  test('échec de suppression : volume exact, erreur minimisée et marqueur préservé', () => {
    const repo = fixture(), dir = build(repo, { marker: true });
    const result = apply(repo, inspect(repo), { unlink() { throw Object.assign(new Error('sb_secret_synthetic'), { code: 'EPERM' }); } });
    expect(result).toMatchObject({ removedFiles: 0, removedBytes: 0, failures: [{ code: 'locked-or-denied' }] });
    expect(fs.existsSync(join(dir, MARKER))).toBe(true);
    expect(JSON.stringify(result)).not.toContain('sb_secret_synthetic');
  });

  test.skipIf(process.platform !== 'win32')('fichier réellement verrouillé sous Windows', async () => {
    const repo = fixture(), dir = build(repo), file = join(dir, 'public', 'assets', 'style.css');
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      "$f=[IO.File]::Open($env:TMP_LOCK_FIXTURE,'Open','ReadWrite','None'); try { [Console]::WriteLine('locked'); [Console]::Out.Flush(); Start-Sleep -Seconds 20 } finally { $f.Dispose() }"],
    { env: { ...process.env, TMP_LOCK_FIXTURE: file }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    try {
      await Promise.race([once(child.stdout, 'data'), once(child, 'exit').then(() => { throw new Error('lock-helper-failed'); })]);
      expect(inspect(repo).candidates).toHaveLength(0);
      expect(apply(repo).removedFiles).toBe(0);
      expect(fs.existsSync(file)).toBe(true);
    } finally { child.kill(); await once(child, 'exit'); }
  }, 15000);

  test('rapports sans chemins privés, identités, contenu ni secrets', () => {
    const repo = fixture(), privateName = 'private-person@example.invalid';
    fs.writeFileSync(join(repo, '.tmp', privateName), 'sb_secret_synthetic');
    const text = JSON.stringify(publicReport(inspect(repo)));
    expect(text).not.toContain(repo);
    expect(text).not.toContain(privateName);
    expect(text).not.toContain('sb_secret_synthetic');
    expect(text).toContain('unknown-preserved');
  });

  test('le serveur nettoie son propre build et conserve toute addition inconnue', () => {
    const repo = fixture(), dir = build(repo), cleanup = ownTestBuild(repo, dir);
    expect(inspect(repo).groups[0].reason).toBe('active-run');
    cleanup(); cleanup();
    expect(fs.existsSync(dir)).toBe(false);
    const other = fixture(), otherDir = build(other), otherCleanup = ownTestBuild(other, otherDir);
    fs.writeFileSync(join(otherDir, 'new-proof.json'), '{"synthetic":true}');
    expect(() => otherCleanup()).toThrow('changed-since-inventory');
    expect(fs.existsSync(join(otherDir, 'public', 'index.html'))).toBe(true);
    const third = fixture(), thirdDir = build(third), thirdCleanup = ownTestBuild(third, thirdDir);
    fs.mkdirSync(join(thirdDir, 'public', 'unknown-reservation'));
    expect(() => thirdCleanup()).toThrow('changed-since-inventory');
    expect(fs.existsSync(join(thirdDir, 'public', 'index.html'))).toBe(true);
  });

  test('ne normalise pas un contenu inconnu dans un paramètre de version', () => {
    const repo = fixture(), dir = build(repo);
    fs.writeFileSync(join(dir, 'public', 'index.html'), index.toString().replace('style.css', 'style.css?v=sb_secret_synthetic'));
    expect(inspect(repo).candidates).toHaveLength(0);
    expect(apply(repo).removedFiles).toBe(0);
  });
});
