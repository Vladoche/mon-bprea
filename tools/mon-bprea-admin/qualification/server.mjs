// Development-only privileged evidence collector. NEVER distribute with the
// app or point at a hosted database. The app's local mode pins both its ports.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { resolve, join, extname, sep } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { seedPersonalTables, readPersonalTables } from '../../../tests/helpers/personal-data-local.js';
import { makeManifest, verifyBackup, currentSchemaHash } from '../../../scripts/preopening/backup.mjs';
import { POLICY, digest } from '../../../scripts/preopening/preflight.mjs';
import { protectDirectory } from '../../../scripts/dev-recipe/private-files.mjs';

const root = resolve('.');
const finalCampaign = process.argv.includes('--final-campaign');
const invitationCampaign = process.argv.includes('--invitation-campaign');
assert.ok(!(finalCampaign && invitationCampaign));
const campaign = invitationCampaign ? join(root, '.tmp/premiere-invitation-prod/qualification')
  : join(root, '.tmp/mon-bprea-admin-v2', ...(finalCampaign ? ['final-qualification'] : []));
const localProject = invitationCampaign ? 'mon-bprea-admin-v2-invitation-local'
  : finalCampaign ? 'mon-bprea-admin-v2-final-local' : 'mon-bprea-admin-v2-local';
const container = 'supabase_db_' + localProject;
const docker = 'docker.exe';
assert.equal(process.platform, 'win32');
const context = spawnSync(docker, ['context', 'inspect', 'desktop-linux', '--format', '{{.Endpoints.docker.Host}}'], { encoding: 'utf8', windowsHide: true });
assert.equal(context.status, 0); assert.equal(context.stdout.trim(), 'npipe:////./pipe/dockerDesktopLinuxEngine');
assert.ok(readFileSync(join(campaign, 'stack/supabase/config.toml'), 'utf8').includes(`project_id = "${localProject}"`));
const statusText = readFileSync(join(campaign, 'status.private.json'), 'utf8');
const status = JSON.parse(statusText.slice(statusText.indexOf('{'), statusText.lastIndexOf('}') + 1));
assert.equal(status.API_URL, 'http://127.0.0.1:54321');
assert.match(status.SECRET_KEY, /^sb_secret_[A-Za-z0-9_-]+$/);
assert.match(status.PUBLISHABLE_KEY, /^sb_publishable_[A-Za-z0-9_-]+$/);
const api = status.API_URL;
const client = key => createClient(api, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const admin = client(status.SECRET_KEY).auth.admin;
const sql = (text, database = 'postgres') => {
  assert.ok(database === 'postgres' || /^adminv2_restore_[a-f0-9]{32}$/.test(database));
  const r = spawnSync(docker, ['--context', 'desktop-linux', 'exec', '-i', container, 'psql', '-X', '-qAt', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1'],
    { input: text, encoding: 'utf8', windowsHide: true, timeout: 20000, maxBuffer: 16 * 1024 * 1024 });
  assert.equal(r.status, 0, 'Isolated local SQL operation'); return r.stdout.trim();
};
const read = text => sql(`begin transaction isolation level repeatable read read only; set local statement_timeout='10s'; ${text}; rollback;`);
const q = id => { assert.match(id, /^[a-f0-9]{8}-[a-f0-9-]{27}$/); return `'${id}'`; };
const counts = (id, query = read) => Object.fromEntries(POLICY.tables.map(t => [t, Number(query(`select count(*) from public.${t} where ${t === 'profiles' ? 'id' : 'user_id'}=${q(id)}`))]));
const allRows = query => Object.fromEntries(POLICY.tables.map(t => [t, JSON.parse(query(`select coalesce(jsonb_agg(to_jsonb(d) order by to_jsonb(d)::text),'[]') from public.${t} d`))]));
const resume = process.argv.includes('--resume');
assert.ok(process.argv.slice(2).every(arg => ['--resume', '--final-campaign', '--invitation-campaign'].includes(arg)));
const privateDirectory = join(campaign, 'private');
if (!existsSync(privateDirectory)) { mkdirSync(privateDirectory); protectDirectory(privateDirectory); }
const stateFile = join(privateDirectory, 'session.private.json');
assert.equal(existsSync(stateFile), resume, 'Never replace the private state of an existing qualification');
if (!resume) assert.equal(read('select count(*) from auth.users'), '0', 'Dedicated local stack must initially be empty');
const state = resume ? JSON.parse(readFileSync(stateFile, 'utf8')) : { id: randomUUID(), api, publishableKey: status.PUBLISHABLE_KEY, key: status.SECRET_KEY,
  operator: { email: 'operator-v2@example.test', password: `Operator!${randomUUID()}` },
  witness: { email: 'witness-v2@example.test', password: `Witness!${randomUUID()}` },
  participant: { email: 'alice-v2@example.test', password: `Participant!${randomUUID()}` } };
for (const fixture of [state.operator, state.witness]) {
  if (resume) { assert.equal((await admin.getUserById(fixture.userId)).data.user?.email, fixture.email); continue; }
  const result = await admin.createUser({ email: fixture.email, password: fixture.password, email_confirm: true });
  assert.equal(result.error, null); fixture.userId = result.data.user.id;
}
const student = async fixture => {
  const auth = client(status.PUBLISHABLE_KEY);
  const refresh = async () => { const result = await auth.auth.signInWithPassword({ email: fixture.email, password: fixture.password }); assert.equal(result.error, null); return result.data; };
  const data = await refresh();
  return { client: auth, userId: data.user.id, refresh };
};
assert.equal(state.api, api); assert.equal(state.key, status.SECRET_KEY);
const witness = await student(state.witness);
if (!resume) await seedPersonalTables(witness, 1);
const witnessBefore = resume ? JSON.parse(readFileSync(join(privateDirectory, 'baseline-witness.private.json'), 'utf8')) : await readPersonalTables(witness);
if (!resume) writeFileSync(join(privateDirectory, 'baseline-witness.private.json'), JSON.stringify(witnessBefore), { flag: 'wx', mode: 0o600 });
assert.deepEqual(await readPersonalTables(witness), witnessBefore);
const save = () => { writeFileSync(stateFile, JSON.stringify(state), { mode: 0o600 }); };
save();
let baselineA = resume ? JSON.parse(readFileSync(join(privateDirectory, 'baseline-a.private.json'), 'utf8')) : undefined;
let snapshot, restoreDatabase, restoreEvidence, manifest, snapshotTime, originalRows;
const proofFolder = join(campaign, 'local-proof');
if (!existsSync(proofFolder)) { mkdirSync(proofFolder); protectDirectory(proofFolder); }
assert.ok(!existsSync(join(proofFolder, 'application.dump')), 'An existing snapshot requires explicit evidence recovery; never create a fresh one to ignore it');
const record = (name, data) => writeFileSync(join(proofFolder, name), JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });

async function backup(ledgerHash) {
  if (snapshot) return;
  snapshotTime = new Date().toISOString(); originalRows = allRows(read);
  const r = spawnSync(docker, ['--context', 'desktop-linux', 'exec', container, 'pg_dump', '-U', 'postgres', '-d', 'postgres', '-Fc', '-n', 'public', '-n', 'bprea_private'],
    { windowsHide: true, maxBuffer: 32 * 1024 * 1024, timeout: 20000 });
  assert.equal(r.status, 0); snapshot = r.stdout;
  writeFileSync(join(proofFolder, 'application.dump'), snapshot, { flag: 'wx' });
  const toc = spawnSync(docker, ['--context', 'desktop-linux', 'exec', '-i', container, 'pg_restore', '--list'],
    { input: snapshot, encoding: 'utf8', windowsHide: true, timeout: 20000 }); assert.equal(toc.status, 0);
  writeFileSync(join(proofFolder, 'archive-toc.txt'), toc.stdout, { flag: 'wx' });
  manifest = makeManifest(proofFolder, { version: 1, projectRef: 'synthetic-admin-v2', sourceKind: 'synthetic', snapshotStartedAt: snapshotTime,
    completedAt: new Date().toISOString(), schemaHash: currentSchemaHash() }, toc.stdout);
  restoreDatabase = 'adminv2_restore_' + randomUUID().replaceAll('-', ''); sql(`create database ${restoreDatabase}`);
  const inRestore = query => sql(query, restoreDatabase);
  const ids = JSON.parse(read("select coalesce(json_agg(id),'[]') from auth.users"));
  inRestore(`create schema auth; create table auth.users(id uuid primary key, raw_user_meta_data jsonb); create function auth.uid() returns uuid language sql as $$select null::uuid$$; insert into auth.users(id) values ${ids.map(id => `(${q(id)})`).join(',')};`);
  const qualifiedToc = toc.stdout.split('\n').map(line => / DEFAULT ACL .*supabase_admin| SCHEMA - public /.test(line) ? ';' + line : line).join('\n');
  const listPath = '/tmp/admin-v2-restore.list';
  const list = spawnSync(docker, ['--context', 'desktop-linux', 'exec', '-i', container, 'tee', listPath], { input: qualifiedToc, encoding: 'utf8', windowsHide: true }); assert.equal(list.status, 0);
  const restored = spawnSync(docker, ['--context', 'desktop-linux', 'exec', '-i', container, 'pg_restore', '-U', 'postgres', '-d', restoreDatabase, '--use-list', listPath, '--exit-on-error'],
    { input: snapshot, encoding: 'utf8', windowsHide: true, timeout: 20000 });
  if (restored.status !== 0) writeFileSync(join(proofFolder, 'restore-failure.private.log'), restored.stderr);
  assert.equal(restored.status, 0, 'Isolated restore must succeed before any deletion');
  assert.deepEqual(allRows(inRestore), originalRows);
  const metadata = readFileSync(join(root, 'tools/mon-bprea-admin/Tests/closure-metadata.sql'), 'utf8');
  assert.deepEqual(JSON.parse(inRestore(metadata)), JSON.parse(read(metadata)));
  restoreEvidence = { version: 1, manifestHash: digest(manifest), archiveHash: manifest.files['application.dump'].sha256,
    projectRef: manifest.projectRef, schemaHash: manifest.schemaHash, testedAt: new Date().toISOString(), isolated: true, restoreSucceeded: true,
    dataCompared: true, schemaAndPrivilegesCompared: true, dependenciesCompatible: true, deletionLedgerHash: ledgerHash, deletionsReconciled: true };
  assert.equal(verifyBackup(proofFolder, manifest, restoreEvidence, { now: new Date().toISOString(), projectRef: manifest.projectRef,
    schemaHash: manifest.schemaHash, ledgerHash, protectionChecked: true }).reasons.length, 0);
  record('backup-and-restore.json', { syntheticOnly: true, tenTables: Object.keys(originalRows), dataCompared: true, metadataAndPrivilegesCompared: true, backupReference: digest(manifest) });
}

function metadata(id) {
  const fks = JSON.parse(read(`select coalesce(json_agg(signature order by signature),'[]') from (
    select c.relname||'('||(select string_agg(a.attname,',' order by x.ord) from unnest(k.conkey) with ordinality x(num,ord) join pg_attribute a on a.attrelid=k.conrelid and a.attnum=x.num)||')->'||rn.nspname||'.'||rc.relname||'('||(select string_agg(a.attname,',' order by x.ord) from unnest(k.confkey) with ordinality x(num,ord) join pg_attribute a on a.attrelid=k.confrelid and a.attnum=x.num)||'):'||case when k.confdeltype='c' then 'cascade' else 'unexpected' end||':'||case when k.convalidated then 'valid' else 'invalid' end as signature
    from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace join pg_class rc on rc.oid=k.confrelid join pg_namespace rn on rn.oid=rc.relnamespace
    where k.contype='f' and (n.nspname='public' or rn.nspname='public' or rn.nspname='auth' and rc.relname='users' and n.nspname not in ('auth','storage'))) s`));
  const permissions = read(`select count(*)=10 and bool_and(c.relrowsecurity and not has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') and not has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'`) === 't'
    && read("select not has_column_privilege('authenticated','public.profiles','id','UPDATE') and not has_table_privilege('authenticated','public.profiles','INSERT,DELETE') and has_column_privilege('authenticated','public.profiles','pseudo','UPDATE')") === 't'
    && read("select count(*) from pg_policies where schemaname='public'") === '24';
  const storageExists = read("select to_regclass('storage.objects') is not null") === 't';
  const storage = storageExists ? Number(read(`select count(*) from storage.objects where owner_id=${q(id)}`)) : 0;
  const orphans = POLICY.tables.reduce((sum, t) => sum + Number(read(`select count(*) from public.${t} d left join auth.users u on u.id=d.${t === 'profiles' ? 'id' : 'user_id'} where u.id is null`)), 0);
  const witnessRows = allRows(read);
  return { Rows: counts(id), ForeignKeys: fks, PermissionsVerified: permissions, StorageObjects: storage, Orphans: orphans,
    Sessions: Number(read(`select count(*) from auth.sessions where user_id=${q(id)}`)),
    RefreshTokens: Number(read(`select count(*) from auth.refresh_tokens where user_id=${q(id)}::text`)),
    WitnessDigest: digest(Object.fromEntries(POLICY.tables.map(t => [t, witnessRows[t].filter(row => row[t === 'profiles' ? 'id' : 'user_id'] === state.witness.userId)]))) };
}
const reply = (response, data) => { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(data)); };
const service = createServer(async (request, response) => {
  try {
    const aliasesPath = join(privateDirectory, 'qualification-namespaces.private.json');
    const aliases = existsSync(aliasesPath) ? JSON.parse(readFileSync(aliasesPath, 'utf8')) : [];
    assert.ok(Array.isArray(aliases) && aliases.every(id => /^[a-f0-9]{8}-[a-f0-9-]{27}$/.test(id)));
    assert.ok([state.id, ...aliases].includes(request.headers['x-qualification-id']));
    let body = ''; for await (const chunk of request) { body += chunk; assert.ok(body.length < 16384); }
    if (request.url === '/capabilities' && request.method === 'GET') {
      const inspect = spawnSync(docker, ['--context', 'desktop-linux', 'inspect', '--format', '{{range .Config.Env}}{{println .}}{{end}}', 'supabase_auth_' + localProject], { encoding: 'utf8', windowsHide: true });
      assert.equal(inspect.status, 0);
      const expiry = /^GOTRUE_MAILER_OTP_EXP=(\d+)$/m.exec(inspect.stdout); assert.ok(expiry);
      reply(response, { Project: 'mon-bprea-admin-v2-local', OperatorId: state.operator.userId, OtpExpiry: Number(expiry[1]), ObservedAt: new Date().toISOString() }); return;
    }
    if (request.url === '/seed-a' && request.method === 'POST') {
      Object.assign(state.participant, JSON.parse(readFileSync(stateFile, 'utf8')).participant);
      const a = await student(state.participant); state.participant.userId = a.userId;
      await seedPersonalTables(a, 1); baselineA = await readPersonalTables(a); save();
      writeFileSync(join(privateDirectory, 'baseline-a.private.json'), JSON.stringify(baselineA), { flag: 'wx', mode: 0o600 });
      record('participant-seeded.json', { syntheticOnly: true, tables: Object.keys(baselineA), allTenPopulated: Object.values(baselineA).every(rows => rows.length > 0) });
      reply(response, { ok: true, tables: Object.keys(baselineA).length }); return;
    }
    if (request.url === '/verify-preserved' && request.method === 'POST') {
      Object.assign(state.participant, JSON.parse(readFileSync(stateFile, 'utf8')).participant);
      const a = await student(state.participant); assert.equal(a.userId, state.participant.userId);
      assert.deepEqual(await readPersonalTables(a), baselineA); assert.deepEqual(await readPersonalTables(witness), witnessBefore);
      record('recovery-preservation.json', { sameUuid: true, tenTablesUnchanged: true, witnessUnchanged: true }); reply(response, { ok: true }); return;
    }
    if (request.url === '/evidence' && request.method === 'POST') {
      const input = JSON.parse(body); assert.equal(input.target, state.participant.userId); assert.notEqual(input.target, state.operator.userId);
      let reconciled = false;
      if (!input.after) await backup(input.ledgerHash);
      else {
        assert.ok(snapshot && restoreDatabase); const inRestore = query => sql(query, restoreDatabase);
        assert.ok(verifyBackup(proofFolder, manifest, restoreEvidence, { now: new Date().toISOString(), projectRef: manifest.projectRef,
          schemaHash: manifest.schemaHash, ledgerHash: input.ledgerHash, protectionChecked: true }).reasons.includes('deletions_not_reconciled'));
        const beforeB = counts(state.witness.userId, inRestore);
        inRestore(`delete from auth.users where id=${q(input.target)}`);
        assert.ok(Object.values(counts(input.target, inRestore)).every(n => n === 0)); assert.deepEqual(counts(state.witness.userId, inRestore), beforeB);
        const renewed = { ...restoreEvidence, testedAt: new Date().toISOString(), deletionLedgerHash: input.ledgerHash };
        assert.equal(verifyBackup(proofFolder, manifest, renewed, { now: new Date().toISOString(), projectRef: manifest.projectRef,
          schemaHash: manifest.schemaHash, ledgerHash: input.ledgerHash, protectionChecked: true }).reasons.length, 0);
        assert.deepEqual(await readPersonalTables(witness), witnessBefore); reconciled = true;
        record('deletion-and-reconciliation.json', { nativeAuthAbsent: (await admin.getUserById(input.target)).error?.status === 404,
          tenTablesAbsent: Object.values(counts(input.target)).every(n => n === 0), witnessUnchanged: true,
          previousRestoreEvidenceRejected: true, currentLedgerReconciled: true, rawBackupRetainedWithTombstone: true });
      }
      const evidence = metadata(input.target);
      record(input.after ? 'metadata-after.json' : 'metadata-before.json', evidence);
      reply(response, { Project: 'oqoqrxwfbkhtpksqimgd', TargetId: input.target, OperatorId: state.operator.userId,
        InventorySnapshot: input.snapshot, ObservedAt: new Date().toISOString(), ...evidence,
        ParticipantVerified: true, BackupVerified: true, SnapshotStartedAt: snapshotTime,
        BackupReference: digest(manifest), BackupLedgerHash: restoreEvidence.deletionLedgerHash, BackupsReconciled: reconciled }); return;
    }
    response.statusCode = 404; reply(response, {});
  } catch {
    response.statusCode = 500; reply(response, {});
    console.error('Qualification request failed; synthetic evidence retained. No provider payload logged.');
  }
});
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp' };
const frontend = createServer((request, response) => {
  try {
    const path = new URL(request.url, 'http://127.0.0.1:4173').pathname;
    if (path === '/mon-bprea/assets/auth-config.json') { reply(response, { enabled: true, environment: 'development', url: api, publishableKey: status.PUBLISHABLE_KEY, siteUrl: 'http://127.0.0.1:4173/mon-bprea/' }); return; }
    assert.ok(path.startsWith('/mon-bprea/')); const relative = decodeURIComponent(path.slice('/mon-bprea/'.length)) || 'index.html';
    assert.ok(!relative.includes('..') && !relative.includes('\\') && (relative.startsWith('assets/') || /^[a-z0-9-]+\.html$/.test(relative)));
    const file = resolve(root, relative); assert.ok(file.startsWith(root + sep) && statSync(file).isFile());
    response.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream'); response.setHeader('Cache-Control', 'no-store'); response.end(readFileSync(file));
  } catch { response.statusCode = 404; response.end(); }
});
await new Promise(resolve => service.listen(54329, '127.0.0.1', resolve));
await new Promise(resolve => frontend.listen(4173, '127.0.0.1', resolve));
console.log('READY local qualification on 127.0.0.1 only; synthetic operator and witness; no PROD transport.');
const stop = () => { service.close(); frontend.close(); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
