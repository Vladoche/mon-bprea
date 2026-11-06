// Répétition PostgreSQL natif et Auth SQL synthétique. Aucune URL en entrée.
import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { publicProcessEnvironment } from '../dev-recipe/contract.mjs';
import { checkDirectory } from '../preopening/backup.mjs';
import { POLICY } from '../preopening/preflight.mjs';
import { A, B } from '../../tests/fixtures/export.js';
import { checkStudentPaths, sqlLiteral, student } from './rehearsal-data.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const extension = process.platform === 'win32' ? '.exe' : '';
const [binArg, cliArg] = process.argv.slice(2);
assert.ok(binArg && cliArg && process.argv.length === 4, 'Arguments : dossier bin PostgreSQL 17, exécutable CLI 2.121.0');
const bin = checkDirectory(binArg);
const cli = resolve(cliArg);
const temporary = join(root, '.tmp');
mkdirSync(temporary, { recursive: true });
const directory = mkdtempSync(join(checkDirectory(temporary), 'lot660c-native-'));
const cluster = join(directory, 'cluster');
const stage = join(directory, 'stage');
const stageMigrations = join(stage, 'supabase/migrations');
mkdirSync(stageMigrations, { recursive: true });
const config = readFileSync(join(root, 'supabase/config.toml'), 'utf8');
writeFileSync(join(stage, 'supabase/config.toml'), config.replace('mon-bprea-lot6-1-local', 'mon-bprea-lot660c-local'));
cpSync(join(root, 'supabase/templates'), join(stage, 'supabase/templates'), { recursive: true });
const migrations = [
  '20261022000100_profiles.sql',
  '20261024083417_create_drill_sync_schema.sql',
  '20261025143831_create_personal_data_backend.sql',
  '20261106093143_restrict_application_service_role.sql',
  '20261106174551_return_conflict_for_personal_revision.sql',
];
const versions = migrations.map(name => name.split('_')[0]);
const original = migrations.map(name => readFileSync(join(root, 'supabase/migrations', name)));
const prep = readFileSync(join(root, 'scripts/verification-prod/prepare-permissions.sql'), 'utf8');
const sqlFile = name => readFileSync(join(root, 'scripts/verification-dev', name), 'utf8');
const sha = value => createHash('sha256').update(value).digest('hex');
const password = randomBytes(32).toString('base64url');
const env = {
  ...publicProcessEnvironment(process.env),
  PGCLIENTENCODING: 'UTF8', PGCONNECT_TIMEOUT: '5', PGPASSWORD: password,
  PGPASSFILE: join(directory, 'absent-pgpass'), PGSERVICEFILE: join(directory, 'absent-pgservice'),
  SUPABASE_HOME: directory, SUPABASE_TELEMETRY_DISABLED: '1', DO_NOT_TRACK: '1',
};
const sessionOptions = '-c lock_timeout=5s -c statement_timeout=120s';
const options = { cwd: stage, env, encoding: 'utf8', windowsHide: true, timeout: 60_000, maxBuffer: 8 * 1024 * 1024 };
const admin = 'bprea660c_bootstrap';
const databaseNames = ['postgres', 'bprea660c_install', 'bprea660c_legacy', 'bprea660c_restore'];
const [, install, legacy, restored] = databaseNames;
const server = createServer();
await new Promise((done, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', done); });
const { port } = server.address();
await new Promise(done => server.close(done));

function run(exe, args, input, errorMatch) {
  const result = spawnSync(exe, args, { ...options, input,
    stdio: exe === join(bin, `pg_ctl${extension}`) ? 'ignore' : 'pipe' });
  const diagnostic = (result.stderr || result.error?.message || '').replaceAll(password, '[secret local]');
  if (errorMatch) {
    assert.ok(result.status > 0 && errorMatch.test(diagnostic), `Échec attendu ${errorMatch}, reçu ${result.status} ${diagnostic}`);
  } else {
    assert.equal(result.status, 0, `${exe} : ${diagnostic}`);
  }
  return (result.stdout || '').trim();
}
const tool = (name, args, input, errorMatch) => run(join(bin, name + extension), args, input, errorMatch);
function connection(database, user) {
  assert.ok(databaseNames.includes(database));
  return ['-h', '127.0.0.1', '-p', String(port), '-U', user, '-d', database, '-w'];
}
const psqlFlags = ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'];
const sql = (database, input, { user = 'postgres', error } = {}) =>
  tool('psql', [...connection(database, user), ...psqlFlags], input, error);
const sqlAsync = async (database, input) => {
  const task = promisify(execFile)(join(bin, 'psql' + extension), [...connection(database, 'postgres'), ...psqlFlags], options);
  task.child.stdin.end(input);
  return (await task).stdout.trim();
};
function cliCommand(database, command, flags = [], errorMatch) {
  assert.ok([install, legacy].includes(database));
  // PGPASSWORD reste dans l'environnement du processus enfant.
  return run(cli, [...command, '--db-url',
    `postgresql://postgres@127.0.0.1:${port}/${database}?sslmode=disable&options=${encodeURIComponent(sessionOptions)}`,
    '--workdir', stage, '--agent', 'no', '--yes', ...flags], undefined, errorMatch);
}
function stageMigration(index, content = original[index]) {
  writeFileSync(join(stageMigrations, migrations[index]), content);
}
const migrationUp = (database, errorMatch) => cliCommand(database, ['migration', 'up'], [], errorMatch);
const ledger = database => {
  if (!sql(database, "select to_regclass('supabase_migrations.schema_migrations');")) return [];
  return JSON.parse(sql(database, "select coalesce(jsonb_agg(to_jsonb(m) order by version),'[]') from supabase_migrations.schema_migrations m;"));
};
const record = (database, expected) => {
  const rows = ledger(database);
  assert.deepEqual(rows.map(row => row.version), versions.slice(0, expected));
  assert.deepEqual(rows.map(row => row.name), migrations.slice(0, expected).map(name => name.slice(15, -4)));
};
const defaults = database => JSON.parse(sql(database, `
  select coalesce(jsonb_agg(to_jsonb(d) order by creator, schema, kind, grantee, privilege),'[]')
  from (select pg_get_userbyid(a.defaclrole) creator, n.nspname schema, a.defaclobjtype kind,
    pg_get_userbyid(x.grantee) grantee, x.privilege_type privilege, x.is_grantable,
    pg_get_userbyid(x.grantor) grantor
    from pg_default_acl a left join pg_namespace n on n.oid=a.defaclnamespace
    cross join lateral aclexplode(a.defaclacl) x) d;`));
const tableNames = database => sql(database, "select relname from pg_class where relnamespace='public'::regnamespace and relkind='r' order by 1;").split(/\r?\n/).filter(Boolean);
const catalog = database => JSON.parse(sql(database, sqlFile('catalogue.sql')));
const privilege = database => JSON.parse(sql(database, sqlFile('privileges.sql')));
const sortedJson = values => [...(values || [])].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
function structure(database) {
  const { migrations: _ledger, ...definitions } = catalog(database);
  // pg_dump peut omettre une ACL de schéma identique à celle du propriétaire.
  definitions.schemas = JSON.parse(sql(database, `
    select jsonb_agg(jsonb_build_object('name',nspname,'owner',pg_get_userbyid(nspowner),
      'acl',coalesce(nspacl,acldefault('n',nspowner))))
    from pg_namespace where nspname in ('public','bprea_private');`));
  return Object.fromEntries(Object.entries(definitions).map(([name, value]) => [name, sortedJson(value)]));
}
function rows(database, names = tableNames(database)) {
  const entries = names.map(name => {
    assert.ok(POLICY.tables.includes(name));
    const data = sql(database, `select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from public.${name} t;`);
    return [name, JSON.parse(data)];
  });
  return Object.fromEntries(entries);
}
function state(database) {
  const tables = tableNames(database);
  return { tables, history: ledger(database).map(row => row.version), defaults: defaults(database),
    structureHash: ledger(database).length || sql(database, "select to_regclass('supabase_migrations.schema_migrations');") ? sha(JSON.stringify(structure(database))) : null,
    dataHash: sha(JSON.stringify(rows(database, tables))),
    authCount: Number(sql(database, 'select count(*) from auth.users;', { user: admin })) };
}
const service = 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN';
const publicDefault = database => sql(database, `
  begin;
  create table public.bprea_acl_probe (id uuid);
  select has_table_privilege('service_role','public.bprea_acl_probe','${service}');
  rollback;`);
function checkBoundary(database, count) {
  record(database, count);
  const metadata = catalog(database);
  const counts = ['tables', 'columns', 'constraints', 'indexes', 'policies', 'functions', 'triggers']
    .map(key => (metadata[key] || []).length);
  assert.deepEqual(counts, count === 1 ? [1, 4, 3, 1, 2, 2, 2] : count === 2 ? [4, 29, 28, 9, 8, 7, 5] : [10, 98, 95, 24, 24, 15, 11]);
  const access = privilege(database);
  for (const key of ['table_privileges', 'column_privileges', 'function_privileges']) {
    for (const item of access[key]) {
      if (item.role !== 'service_role' && item.role !== 'anon') continue;
      assert.ok(!Object.values(item).includes(true), JSON.stringify(item));
    }
  }
  assert.ok(access.schema_privileges.every(item => !item.create
    && (item.schema !== 'bprea_private' || !item.usage)));
  assert.equal(publicDefault(database), 'f');
  return { versions: versions.slice(0, count), counts };
}
function save(name, value) {
  writeFileSync(join(directory, name + '.json'), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
}
const events = [];
function note(event, details = {}) {
  events.push({ event, ...details });
  console.log(event, JSON.stringify(details));
}

const bootstrap = `
  create schema auth authorization supabase_auth_admin;
  create schema extensions authorization postgres;
  set role supabase_auth_admin;
  create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable set search_path='' as $$
    select (nullif(pg_catalog.current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid;
  $$;
  reset role;
  grant usage on schema auth to postgres,anon,authenticated,service_role;
  grant select,references,trigger on auth.users to postgres;
  grant execute on function auth.uid() to postgres,anon,authenticated,service_role;
  grant usage on schema extensions to anon,authenticated,service_role;
  grant usage on schema public to anon,authenticated,service_role;
  grant create on schema public to supabase_admin;
  alter default privileges for role postgres grant select on tables to service_role;
  alter default privileges for role postgres,supabase_admin in schema public
    grant all on tables to anon,authenticated,service_role;
  alter default privileges for role postgres,supabase_admin in schema public
    grant execute on functions to anon,authenticated,service_role;
  alter default privileges for role postgres,supabase_admin in schema public
    grant all on sequences to anon,authenticated,service_role;`;
const createAuth = (database, id, error) => sql(database, `set role supabase_auth_admin;
  insert into auth.users (id,email,raw_user_meta_data) values
  ('${id}','${id.slice(0, 8)}@example.invalid','{"pseudo":"Forgé","role":"service_role"}');`, { user: admin, error });

let started = false;
try {
  console.log(`Preuves synthétiques dans ${directory}`);
  assert.equal(run(cli, ['--version']), '2.121.0');
  assert.match(tool('psql', ['--version']), /PostgreSQL\) 17\./);
  const pwFile = join(directory, 'init-password');
  writeFileSync(pwFile, password + '\n', { mode: 0o600, flag: 'wx' });
  try {
    tool('initdb', ['-D', cluster, '-U', admin, '--auth=scram-sha-256', '--encoding=UTF8', '--no-locale', `--pwfile=${pwFile}`]);
  } finally {
    unlinkSync(pwFile);
  }
  writeFileSync(join(cluster, 'postgresql.conf'), `
listen_addresses='127.0.0.1'
port=${port}
timezone='UTC'
logging_collector=off
log_statement='none'
log_min_error_statement=panic
`, { flag: 'a' });
  tool('pg_ctl', ['-D', cluster, '-l', join(directory, 'postgres.log'), '-w', 'start']);
  started = true;
  const pidFile = readFileSync(join(cluster, 'postmaster.pid'), 'utf8').split(/\r?\n/);
  assert.equal(resolve(pidFile[1]), resolve(cluster));
  assert.equal(Number(pidFile[3]), port);
  assert.equal(sql('postgres', "select host(inet_server_addr()) || '/' || inet_server_port() || '/' || current_user;",
    { user: admin }), `127.0.0.1/${port}/${admin}`);
  sql('postgres', `create role postgres login password ${sqlLiteral(password)};
    create role anon nologin; create role authenticated nologin;
    create role service_role nologin noinherit bypassrls;
    create role supabase_admin nologin; create role supabase_auth_admin nologin;
    create role bprea660c_extra nologin;
    grant anon,authenticated,service_role to postgres with inherit false;
    ${[install, legacy, restored].map(db => `create database ${db} owner postgres;`).join('\n')}`, { user: admin });
  for (const db of [install, legacy]) sql(db, bootstrap, { user: admin });
  createAuth(install, A);
  assert.deepEqual(tableNames(install), []);
  record(install, 0);
  note('Cible et état initial', { port, postgres: sql(install, 'show server_version;'), role: 'postgres', tables: 0, history: [], authCount: 1 });
  const initialAcl = defaults(install);
  save('initial-acl', initialAcl);
  assert.equal(publicDefault(install), 't');
  assert.equal(sql(install, `begin;
    alter default privileges for role postgres in schema public revoke all on tables from service_role;
    create table public.bprea_acl_probe (id uuid);
    select has_table_privilege('service_role','public.bprea_acl_probe','SELECT');
    rollback;`), 't');
  assert.deepEqual(defaults(install), initialAcl);
  note('Le REVOKE limité à public laisse le SELECT global');

  sql(install, 'grant bprea660c_extra to service_role with inherit true;', { user: admin });
  sql(install, 'alter default privileges for role postgres in schema public grant select on tables to bprea660c_extra;');
  const inheritedAcl = defaults(install);
  sql(install, prep, { error: /P0001.*droits effectifs/ });
  assert.deepEqual(defaults(install), inheritedAcl);
  assert.deepEqual(tableNames(install), []);
  record(install, 0);
  sql(install, 'alter default privileges for role postgres in schema public revoke select on tables from bprea660c_extra;');
  sql(install, 'revoke bprea660c_extra from service_role;', { user: admin });
  assert.deepEqual(defaults(install), initialAcl);
  note('Préparation interrompue par droit hérité : rollback complet');
  sql(install, prep);
  const managedDefaults = item => !(item.creator === 'postgres' && item.kind === 'r'
    && (item.grantee === 'service_role' || (item.schema === null && item.grantee === 'postgres')));
  assert.deepEqual(defaults(install).filter(managedDefaults), initialAcl.filter(managedDefaults));
  assert.ok(!defaults(install).some(item => item.creator === 'postgres' && item.kind === 'r' && item.grantee === 'service_role'));
  assert.equal(publicDefault(install), 'f');

  for (const i of [0, 1, 2]) {
    const fault = `do $$ begin
      if (select setting from pg_settings where name='lock_timeout') <> '5000'
        or (select setting from pg_settings where name='statement_timeout') <> '120000' then
        raise exception 'bprea_cli_timeouts_missing';
      end if;
      end $$;
      select 1/0;
      commit;\n`;
    stageMigration(i, original[i].toString('utf8').replace(/commit;\s*$/i, () => fault));
    const before = state(install);
    migrationUp(install, /22012|division by zero/i);
    const after = state(install);
    // La CLI peut initialiser une table de suivi vide avant M1.
    assert.deepEqual({ ...after, structureHash: before.structureHash === null ? null : after.structureHash }, before);
    note(`Échec avant COMMIT de M${i + 1}`, { tables: after.tables.length, history: after.history, authCount: after.authCount });
    stageMigration(i);
    if (i === 1) {
      sql(install, `create function supabase_migrations.bprea_refuse_ledger() returns trigger language plpgsql as $$
        begin if new.version='${versions[1]}' then raise exception 'bprea_ledger_failure'; end if; return new; end;
        $$;
        create trigger bprea_refuse_ledger before insert on supabase_migrations.schema_migrations
        for each row execute function supabase_migrations.bprea_refuse_ledger();`);
      migrationUp(install, /bprea_ledger_failure/);
      assert.deepEqual(tableNames(install), ['drill_answers', 'drill_series', 'drill_training_attempts', 'profiles']);
      record(install, 1);
      const prior = state(install);
      // Vérifie les définitions du M2 appliqué avant la correction du seul registre.
      const committedPrivileges = privilege(install);
      assert.ok(committedPrivileges.table_privileges.every(item => item.role !== 'service_role' || !item.select));
      save('m2-without-ledger', { state: prior, catalogue: structure(install), privileges: committedPrivileges });
      sql(install, 'drop trigger bprea_refuse_ledger on supabase_migrations.schema_migrations; drop function supabase_migrations.bprea_refuse_ledger();');
      cliCommand(install, ['migration', 'repair'], ['--status', 'applied', versions[1]]);
      assert.deepEqual(state(install), { ...prior, history: versions.slice(0, 2) });
      assert.ok(ledger(install)[1].statements.length > 0);
      note('COMMIT de M2 malgré l’échec du registre ; repair local vérifié', { history: versions.slice(0, 2) });
    } else {
      migrationUp(install);
    }
    note(`Frontière M${i + 1}`, checkBoundary(install, i + 1));
    if (i === 0) {
      assert.equal(sql(install, `select count(*) from public.profiles where id='${A}' and pseudo is null;`), '1');
      createAuth(install, B);
      assert.equal(sql(install, student(A, "update public.profiles set pseudo='Fictif A' returning pseudo;")), 'Fictif A');
      note('Arrêt entre M1 et M2 ; profil antérieur et création postérieure vérifiés');
    }
  }

  // Base témoin avec les anciens grants. La correction doit y être atomique et
  // converger vers les mêmes objets que l'installation préparée.
  migrationUp(legacy);
  record(legacy, 3);
  createAuth(legacy, A);
  createAuth(legacy, B);
  assert.equal(sql(legacy, 'set role service_role; select count(*) from public.profiles;'), '2');
  const oldSelect = privilege(legacy).table_privileges
    .filter(item => item.role === 'service_role' && item.select).map(item => item.table).sort();
  assert.deepEqual(oldSelect, ['drill_answers', 'drill_series', 'drill_training_attempts', 'profiles']);
  const legacyBefore = state(legacy);
  stageMigration(3, original[3].toString('utf8') + '\nselect 1/0;\n');
  migrationUp(legacy, /22012|division by zero/i);
  assert.deepEqual(state(legacy), legacyBefore);
  note('Échec de M4 : ACL historiques et registre préservés', { oldSelect, profilesReadAsService: 2, history: legacyBefore.history });
  stageMigration(3);
  sql(legacy, 'grant bprea660c_extra to service_role with inherit true;', { user: admin });
  sql(legacy, 'grant select (pseudo) on public.profiles to bprea660c_extra;');
  const beforeInherited = state(legacy);
  migrationUp(legacy, /service_role conserve des droits effectifs sur (public\.)?profiles/);
  assert.deepEqual(state(legacy), beforeInherited);
  sql(legacy, 'revoke select (pseudo) on public.profiles from bprea660c_extra;');
  sql(legacy, 'revoke bprea660c_extra from service_role;', { user: admin });
  assert.deepEqual(state(legacy), legacyBefore);
  note('M4 refuse un droit de colonne hérité et reste rejouable');
  migrationUp(legacy);
  migrationUp(install);
  note('Frontière M4', checkBoundary(install, 4));
  checkBoundary(legacy, 4);
  sql(legacy, 'set role service_role; select count(*) from public.profiles;', { error: /42501/ });
  assert.equal(state(legacy).dataHash, legacyBefore.dataHash);
  assert.deepEqual(structure(legacy), structure(install));
  assert.deepEqual(defaults(legacy), defaults(install));
  const beforeM5 = privilege(install);
  const dataBeforeM5 = state(install).dataHash;
  stageMigration(4);
  migrationUp(legacy);
  migrationUp(install);
  note('Frontière M5', checkBoundary(install, versions.length));
  checkBoundary(legacy, versions.length);
  for (const [group, records] of Object.entries(privilege(install))) {
    assert.deepEqual(sortedJson(records), sortedJson(beforeM5[group]), group);
  }
  assert.equal(state(install).dataHash, dataBeforeM5);
  assert.deepEqual(structure(legacy), structure(install));
  save('final-catalogue', structure(install));
  save('final-acl', privilege(install));
  save('ledger', ledger(install).map(row => ({ version: row.version, name: row.name,
    statements: row.statements.length, statementsHash: sha(JSON.stringify(row.statements)) })));

  const data = await checkStudentPaths({
    sql: (input, opts) => sql(install, input, opts),
    sqlAsync: input => sqlAsync(install, input),
    snapshot: () => rows(install),
    structure: structure(install),
  });
  note('Parcours applicatifs SQL', data);
  const testsDirectory = join(root, 'supabase/tests/database');
  if (sql(install, "select count(*) from pg_available_extensions where name='pgtap';") === '1') {
    for (const file of readdirSync(testsDirectory).filter(name => name.endsWith('.test.sql')).sort()) {
      const tap = sql(install, readFileSync(join(testsDirectory, file)), { user: admin });
      writeFileSync(join(directory, file + '.tap'), tap + '\n', { flag: 'wx' });
      assert.doesNotMatch(tap, /^(not ok|# Looks like)/m);
      const cases = [...tap.matchAll(/^ok \d+/gm)].length;
      assert.match(tap, new RegExp(`^1\\.\\.${cases}$`, 'm'));
      assert.ok(cases > 0);
      note('pgTAP', { file, cases });
    }
  } else {
    note('pgTAP non exécuté : extension absente du PostgreSQL natif');
  }
  const beforeReplay = state(install);
  migrationUp(install);
  assert.deepEqual(state(install), beforeReplay);
  sql(install, original[1], { error: /42P07/ });
  assert.deepEqual(state(install), beforeReplay);
  note('Rejeu ignoré par la CLI ; rejeu SQL brut arrêté sans changement');

  const failedId = '33333333-3333-4333-8333-333333333333';
  sql(install, `alter table public.profiles add constraint bprea_test_fail_profile check (id <> '${failedId}');`);
  const preTrigger = state(install);
  createAuth(install, failedId, /23514.*bprea_test_fail_profile/);
  assert.deepEqual(state(install), preTrigger);
  assert.equal(sql(install, `select count(*) from auth.users where id='${failedId}';`, { user: admin }), '0');
  sql(install, 'alter table public.profiles drop constraint bprea_test_fail_profile;');
  createAuth(install, failedId);
  assert.equal(sql(install, `select count(*) from public.profiles where id='${failedId}';`), '1');
  sql(install, `set role supabase_auth_admin; delete from auth.users where id='${failedId}';`, { user: admin });
  assert.deepEqual(state(install), beforeReplay);
  note('Échec du trigger Auth SQL : aucune racine orpheline, reprise vérifiée');

  const sourceRows = rows(install);
  const dump = join(directory, 'synthetic.dump');
  tool('pg_dump', [...connection(install, admin), '--format=custom', '--file', dump]);
  const toc = tool('pg_restore', ['--list', dump]);
  const restoreToc = join(directory, 'restore-toc.txt');
  // public existe déjà dans la cible vierge de même propriétaire.
  writeFileSync(restoreToc, toc.replace(/^(\d+; \d+ \d+ SCHEMA - public .*)$/m, ';$1') + '\n');
  tool('pg_restore', [...connection(restored, admin), '--exit-on-error', '--single-transaction', '--use-list', restoreToc, dump]);
  assert.deepEqual(rows(restored), sourceRows);
  const restoredStructure = structure(restored);
  save('restored-catalogue', restoredStructure);
  assert.equal(sha(JSON.stringify(restoredStructure)), sha(JSON.stringify(structure(install))), 'Catalogue restauré divergent');
  assert.deepEqual(defaults(restored), defaults(install));
  assert.deepEqual(ledger(restored), ledger(install));
  assert.equal(sql(restored, 'select jsonb_agg(to_jsonb(u) order by id) from auth.users u;', { user: admin }),
    sql(install, 'select jsonb_agg(to_jsonb(u) order by id) from auth.users u;', { user: admin }));
  checkBoundary(restored, versions.length);
  note('Restauration de l’archive synthétique', { tables: 10, rows: 20, authRows: 2, history: versions, sha256: sha(readFileSync(dump)) });
  sql(install, `set role supabase_auth_admin; delete from auth.users where id='${A}';`, { user: admin });
  const survivors = Object.fromEntries(Object.entries(sourceRows).map(([table, entries]) =>
    [table, entries.filter(row => (row.user_id || row.id) === B)]));
  assert.deepEqual(rows(install), survivors);
  assert.deepEqual(rows(restored), sourceRows);
  note('Cascade Auth SQL', { removed: 10, preserved: 10 });
} finally {
  if (started || existsSync(join(cluster, 'postmaster.pid'))) {
    tool('pg_ctl', ['-D', cluster, '-w', '-m', 'fast', 'stop']);
    note('Cluster isolé arrêté');
  }
  save('events', { migrations: migrations.map((name, index) => ({ name, sha256: sha(original[index]) })), events });
}
