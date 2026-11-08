// PostgreSQL natif synthétique uniquement, sans Supabase/Auth réel ni connexion hébergée.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { publicProcessEnvironment } from '../dev-recipe/contract.mjs';
import { protectDirectory, createPrivate } from '../dev-recipe/private-files.mjs';
import { POLICY, digest, requireThat } from './preflight.mjs';
import { localPgTarget, makeManifest, verifyBackup, checkDirectory, currentSchemaHash } from './backup.mjs';
import { serverRows, A, B } from '../../tests/fixtures/export.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const extension = process.platform === 'win32' ? '.exe' : '';
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
async function freePort() {
  const server = createServer();
  await new Promise((done, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', done); });
  const port = server.address().port;
  await new Promise(done => server.close(done));
  // Le port est réservé de nouveau par PostgreSQL ; un conflit provoque un arrêt, jamais un autre hôte.
  if (port < 49152) return freePort();
  return port;
}
export async function exercise(pgBin) {
  checkDirectory(pgBin);
  const temporary = join(root, '.tmp'); checkDirectory(temporary);
  const directory = mkdtempSync(join(temporary, 'preopening-native-')); protectDirectory(directory);
  const cluster = join(directory, 'cluster'), id = randomBytes(6).toString('hex');
  const port = await freePort(), source = `bprea655b_${id}_source`, restore = `bprea655b_${id}_restore`;
  const env = { ...publicProcessEnvironment(process.env), PGCONNECT_TIMEOUT: '5', PGAPPNAME: 'mon-bprea-655b-synthetic' };
  // Empêche aussi un .pgpass/.psqlrc personnel d'influencer cet exercice.
  env.PGPASSFILE = join(directory, 'absent-pgpass'); env.PGSERVICEFILE = join(directory, 'absent-pgservice');
  function tool(name, args, input) {
    try { return execFileSync(join(pgBin, `${name}${extension}`), args, { env, input, encoding: 'utf8', windowsHide: true,
      stdio: name === 'pg_ctl' ? 'ignore' : ['pipe', 'pipe', 'pipe'], timeout: 60_000, maxBuffer: 8 * 1024 * 1024 }) || ''; }
    catch (error) {
      if (!/password/i.test(input || '')) writeFileSync(join(directory, `failure-${name}-${Date.now()}.txt`), String(error.stderr || error.code || 'native failure'), { flag: 'wx', mode: 0o600 });
      throw new Error(`native_${name}_failed`);
    }
  }
  const sql = (database, input) => tool('psql', [...localPgTarget({ host: '127.0.0.1', port, database }), '-X', '--set=ON_ERROR_STOP=1', '--tuples-only', '--no-align', '--quiet'], input).trim();
  const bootstrap = `create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`;
  let started = false, stopped = false;
  try {
    tool('initdb', ['--pgdata', cluster, '--username=postgres', '--auth=trust', '--encoding=UTF8', '--no-locale']);
    writeFileSync(join(cluster, 'postgresql.conf'), `\nlisten_addresses='127.0.0.1'\nport=${port}\nlogging_collector=off\nlog_statement='none'\nlog_min_error_statement=panic\n`, { flag: 'a' });
    // pg_ctl avec logfile ferme les handles hérités ; aucun service Windows.
    started = true;
    tool('pg_ctl', ['--pgdata', cluster, '--log', join(directory, 'postgres.log'), '--wait', 'start']);
    // Phase trust limitée au cluster fictif neuf, puis SCRAM avant toute fixture/sauvegarde.
    const password = randomBytes(32).toString('base64url');
    tool('psql', ['--host=127.0.0.1', `--port=${port}`, '--username=postgres', '--dbname=postgres', '--no-password', '-X', '--set=ON_ERROR_STOP=1'],
      `set password_encryption='scram-sha-256'; alter role postgres password ${quote(password)};`);
    writeFileSync(join(cluster, 'pg_hba.conf'), 'host all all 127.0.0.1/32 scram-sha-256\n');
    tool('pg_ctl', ['--pgdata', cluster, 'reload']); env.PGPASSWORD = password;
    tool('psql', ['--host=127.0.0.1', `--port=${port}`, '--username=postgres', '--dbname=postgres', '--no-password', '-X', '--set=ON_ERROR_STOP=1'],
      `create role anon nologin; create role authenticated nologin; create role service_role nologin; create role supabase_admin nologin; create database ${source}; create database ${restore};`);
    sql(source, bootstrap);
    const migrations = readdirSync(join(root, 'supabase/migrations')).filter(n => n.endsWith('.sql')).sort();
    const schemaHash = currentSchemaHash();
    for (const name of migrations) sql(source, readFileSync(join(root, 'supabase/migrations', name), 'utf8'));
    for (const [index, user] of [A, B].entries()) {
      sql(source, `insert into auth.users(id) values (${quote(user)});`);
      const rows = serverRows(user), seriesId = `655b000${index}-0000-4000-8000-000000000001`;
      rows.drill_series[0].id = seriesId; delete rows.drill_series[0].series_key;
      rows.drill_answers[0].series_id = seriesId; rows.drill_training_attempts[0].series_id = seriesId;
      for (const [table, values] of Object.entries(rows)) {
        if (table === 'profiles') continue; // créé par le vrai trigger de migration
        for (const row of values) {
          const columns = Object.keys(row);
          sql(source, `select set_config('request.jwt.claim.sub',${quote(user)},false);
            insert into public.${table} (${columns.join(',')}) select ${columns.join(',')} from json_populate_record(null::public.${table},${quote(JSON.stringify(row))}::json);`);
        }
      }
    }
    const readRows = (database, user = null) => Object.fromEntries(POLICY.tables.map(table => [table,
      JSON.parse(sql(database, `select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from public.${table} t${user ? ` where ${table === 'profiles' ? 'id' : 'user_id'}=${quote(user)}` : ''};`))]));
    const before = readRows(source);
    assert.ok(Object.values(before).every(rows => rows.length === 2));
    const structuralSql = `select jsonb_build_object(
      'tables',(select jsonb_agg(jsonb_build_array(c.relname,c.relrowsecurity,c.relacl) order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'),
      'columns',(select jsonb_agg(jsonb_build_array(table_name,column_name,privilege_type,grantee) order by table_name,column_name,privilege_type,grantee) from information_schema.column_privileges where table_schema='public'),
      'policies',(select jsonb_agg(to_jsonb(p) order by tablename,policyname) from pg_policies p where schemaname='public'),
      'tableGrants',(select jsonb_agg(jsonb_build_array(table_name,grantee,privilege_type,is_grantable) order by table_name,grantee,privilege_type) from information_schema.table_privileges where table_schema='public'),
      'schemas',(select jsonb_agg(jsonb_build_array(nspname,pg_get_userbyid(nspowner),coalesce(nspacl,acldefault('n',nspowner))) order by nspname) from pg_namespace where nspname in ('public','bprea_private')),
      'routines',(select jsonb_agg(jsonb_build_array(n.nspname,p.proname,pg_get_functiondef(p.oid),p.proacl) order by n.nspname,p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','bprea_private')),
      'indexes',(select jsonb_agg(jsonb_build_array(tablename,indexname,indexdef) order by tablename,indexname) from pg_indexes where schemaname='public'),
      'triggers',(select jsonb_agg(jsonb_build_array(c.relname,t.tgname,pg_get_triggerdef(t.oid,true)) order by c.relname,t.tgname) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal),
      'columnDefinitions',(select jsonb_agg(jsonb_build_array(c.relname,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attgenerated,pg_get_expr(d.adbin,d.adrelid,true)) order by c.relname,a.attnum) from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum where n.nspname='public' and c.relkind='r' and a.attnum>0 and not a.attisdropped),
      'constraints',(select jsonb_agg(jsonb_build_array(c.relname,k.conname,pg_get_constraintdef(k.oid,true)) order by c.relname,k.conname) from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'))`;
    const structure = JSON.parse(sql(source, structuralSql));
    const snapshotStartedAt = new Date().toISOString();
    tool('pg_dump', [...localPgTarget({ host: '127.0.0.1', port, database: source }), '--format=custom', '--schema=public', '--schema=bprea_private', '--strict-names', '--no-large-objects', '--no-publications', '--no-subscriptions', '--no-security-labels', '--file', join(directory, 'application.dump')]);
    const toc = tool('pg_restore', ['--list', join(directory, 'application.dump')]);
    writeFileSync(join(directory, 'archive-toc.txt'), toc, { flag: 'wx' });
    const manifest = makeManifest(directory, { projectRef: `synthetic-${id}`, sourceKind: 'synthetic', schemaHash, snapshotStartedAt, completedAt: new Date().toISOString(), toolVersion: tool('pg_dump', ['--version']).trim() }, toc);
    createPrivate(directory, 'manifest.json', manifest);
    // Suppression APRÈS snapshot sur la source factice : la restauration la réintroduirait.
    sql(source, `delete from auth.users where id=${quote(A)};`);
    assert.ok(Object.values(readRows(source, A)).every(rows => rows.length === 0));
    const ledger = [{ id: A, action: 'synthetic-deletion-after-snapshot' }], ledgerHash = digest(ledger);
    createPrivate(directory, 'deletions.json', ledger);
    sql(restore, bootstrap + `insert into auth.users(id) values (${quote(A)}),(${quote(B)});`);
    // Conserve le contexte initial de public, son propriétaire et ses ACL ; omet la seule création doublonnée.
    const restoreToc = toc.replace(/^(\d+; \d+ \d+ SCHEMA - public .*)$/m, ';$1');
    requireThat(restoreToc !== toc, 'public_schema_toc');
    writeFileSync(join(directory, 'restore-toc.txt'), restoreToc, { flag: 'wx' });
    tool('pg_restore', [...localPgTarget({ host: '127.0.0.1', port, database: restore }), '--exit-on-error', '--use-list', join(directory, 'restore-toc.txt'), join(directory, 'application.dump')]);
    assert.deepEqual(readRows(restore), before);
    assert.deepEqual(JSON.parse(sql(restore, structuralSql)), structure);
    // La copie restaurée contient encore A : une preuve ignorant le journal
    // postérieur au snapshot ne doit pas permettre de déclarer la reprise prête.
    const unreconciled = { version: 1, manifestHash: digest(manifest), archiveHash: manifest.files['application.dump'].sha256,
      projectRef: manifest.projectRef, schemaHash, testedAt: new Date().toISOString(), isolated: true,
      restoreSucceeded: true, dataCompared: true, schemaAndPrivilegesCompared: true, dependenciesCompatible: true,
      deletionLedgerHash: digest([]), deletionsReconciled: true };
    const refusal = verifyBackup(directory, manifest, unreconciled,
      { now: new Date().toISOString(), projectRef: manifest.projectRef, schemaHash, ledgerHash, protectionChecked: true });
    assert.ok(refusal.reasons.includes('deletions_not_reconciled'));
    createPrivate(directory, 'unreconciled-refusal.json', refusal);
    const bBefore = readRows(restore, B);
    // Seulement l'Auth factice de CET exercice ; aucune API/deleteUser réel.
    const deletions = JSON.parse(readFileSync(join(directory, 'deletions.json'), 'utf8'));
    assert.equal(deletions.length, 1); assert.equal(deletions[0].id, A);
    sql(restore, `delete from auth.users where id=${quote(deletions[0].id)};`);
    assert.ok(Object.values(readRows(restore, A)).every(rows => rows.length === 0));
    assert.deepEqual(readRows(restore, B), bBefore);
    const evidence = { version: 1, manifestHash: digest(manifest), archiveHash: manifest.files['application.dump'].sha256,
      projectRef: manifest.projectRef, schemaHash, testedAt: new Date().toISOString(), isolated: true,
      restoreSucceeded: true, dataCompared: true, schemaAndPrivilegesCompared: true, dependenciesCompatible: true,
      deletionLedgerHash: ledgerHash, deletionsReconciled: true, scope: 'synthetic-postgresql-auth-stub' };
    createPrivate(directory, 'restore-evidence.json', evidence);
    const status = verifyBackup(directory, manifest, evidence, { now: new Date().toISOString(), projectRef: manifest.projectRef, schemaHash, ledgerHash, protectionChecked: true });
    createPrivate(directory, 'backup-verification.json', status);
    assert.equal(status.reasons.length, 0);
    createPrivate(directory, 'result.json', { syntheticOnly: true, restoredTables: 10, rowsBeforeReconciliation: 20, deletedTargetRows: 10, otherRowsPreserved: 10, nativeAuthApiTested: false, realRlsTested: false, status });
    return { syntheticOnly: true, restoredTables: 10, rowsBeforeReconciliation: 20, deletedTargetRows: 10, otherRowsPreserved: 10,
      nativeAuthApiTested: false, realRlsTested: false, completeAuthRecovery: false };
  } catch (error) {
    createPrivate(directory, 'failure.json', { syntheticOnly: true, message: error.message, stack: error.stack });
    throw error;
  } finally {
    if (started) { tool('pg_ctl', ['--pgdata', cluster, '--wait', '--mode=fast', 'stop']); stopped = true; }
    delete env.PGPASSWORD;
    createPrivate(directory, 'closeout.json', { syntheticOnly: true, started, stopped, retained: true });
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { requireThat(process.argv.length === 3, 'pg_bin_required'); process.stdout.write(`${JSON.stringify(await exercise(resolve(process.argv[2])), null, 2)}\n`); }
  catch (error) { process.stderr.write(`Exercice local interrompu (${/^[a-z_]+$/.test(error.message) ? error.message : 'verification'}). Consulter uniquement ses preuves privées synthétiques.\n`); process.exitCode = 1; }
}
