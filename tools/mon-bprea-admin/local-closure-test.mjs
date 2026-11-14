// Windows-only qualification bridge. Never used or distributed by the app.
// Secrets remain in this process; the C# test transport knows only localhost.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { createDrillStudent } from '../../tests/helpers/drill-local.js';
import { seedPersonalTables, readPersonalTables } from '../../tests/helpers/personal-data-local.js';
import { POLICY, digest } from '../../scripts/preopening/preflight.mjs';
import { makeManifest, verifyBackup, currentSchemaHash } from '../../scripts/preopening/backup.mjs';
import { protectDirectory } from '../../scripts/dev-recipe/private-files.mjs';

const [dotnet, container] = process.argv.slice(2);
assert.equal(process.platform, 'win32');
assert.ok(dotnet && /^(supabase_db_mon-bprea-admin12-local|supabase_db_mon-bprea-lot6-1-local)$/.test(container));
const sql = text => {
  const r = spawnSync('docker', ['--context','desktop-linux','exec','-i',container,'psql','-X','-qAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],
    { input: text, encoding:'utf8', windowsHide:true, timeout:20000 });
  assert.equal(r.status, 0, 'Local metadata/count query must succeed'); return r.stdout.trim();
};
const read = text => sql(`begin transaction isolation level repeatable read read only; set local statement_timeout='10s'; ${text}; rollback;`);
const quote = id => { assert.match(id, /^[a-f0-9-]{36}$/); return `'${id}'`; };
const counts = id => Object.fromEntries(POLICY.tables.map(t => [t, Number(read(`select count(*) from public.${t} where ${t === 'profiles' ? 'id' : 'user_id'}=${quote(id)}`))]));
let a, b, server, restore, attempted = false, absent = false, deletes = 0;
let stage = 'fixture creation';
try {
  assert.equal(read('select count(*) from auth.users'), '0', 'Dedicated stack must be empty');
  stage='activate two fictitious accounts';
  a = await createDrillStudent(); b = await createDrillStudent();
  const environment = a.environment;
  assert.equal(environment.url, 'http://127.0.0.1:54321');
  stage='populate ten tables'; await seedPersonalTables(a,1); await seedPersonalTables(b,1);
  const beforeB = await readPersonalTables(b);
  const oldSession = (await a.client.auth.getSession()).data.session;
  const snapshotStartedAt = new Date().toISOString();
  stage='dump application snapshot';
  const directory = mkdtempSync(resolve('.tmp/admin12-native-')); protectDirectory(directory);
  // Real application snapshot. Historical personal archives are never fixtures.
  const dump = spawnSync('docker',['--context','desktop-linux','exec',container,'pg_dump','-U','postgres','-d','postgres','-Fc','-n','public','-n','bprea_private'], {windowsHide:true,maxBuffer:32*1024*1024,timeout:20000});
  assert.equal(dump.status,0); writeFileSync(join(directory,'application.dump'),dump.stdout,{flag:'wx'});
  const toc = spawnSync('docker',['--context','desktop-linux','exec','-i',container,'pg_restore','--list'], {input:dump.stdout,encoding:'utf8',windowsHide:true,timeout:20000});
  assert.equal(toc.status,0); writeFileSync(join(directory,'archive-toc.txt'),toc.stdout,{flag:'wx'});
  const manifest = makeManifest(directory,{version:1,projectRef:'synthetic-admin12-native',sourceKind:'synthetic',snapshotStartedAt,completedAt:new Date().toISOString(),schemaHash:currentSchemaHash()},toc.stdout);
  // The pre-existing exercise performs isolated restore, schema/data comparison
  // and post-snapshot reconciliation. This bridge's snapshot is checked below
  // in its own isolated database before evidence can authorize the local test.
  restore = 'admin12_restore_' + randomUUID().replaceAll('-','');
  stage='restore application snapshot';
  sql(`create database ${restore}`);
  const sqlRestore = text => {
    const r=spawnSync('docker',['--context','desktop-linux','exec','-i',container,'psql','-X','-qAt','-U','postgres','-d',restore,'-v','ON_ERROR_STOP=1'],{input:text,encoding:'utf8',windowsHide:true,timeout:20000}); assert.equal(r.status,0); return r.stdout.trim();
  };
  sqlRestore(`create schema auth; create table auth.users(id uuid primary key, raw_user_meta_data jsonb); create function auth.uid() returns uuid language sql as $$select null::uuid$$; insert into auth.users(id) values(${quote(a.userId)}),(${quote(b.userId)});`);
  // Supabase's postgres role cannot ALTER DEFAULT PRIVILEGES FOR
  // supabase_admin. These platform defaults are outside application restore;
  // keep every application object/ACL and compare its actual privileges below.
  const restoreToc=toc.stdout.split('\n').map(line=>/ DEFAULT ACL .*supabase_admin| SCHEMA - public /.test(line)?';'+line:line).join('\n');
  const listPath='/tmp/admin12-qualified-toc.list';
  const listWrite=spawnSync('docker',['--context','desktop-linux','exec','-i',container,'tee',listPath],{input:restoreToc,encoding:'utf8',windowsHide:true,timeout:20000});assert.equal(listWrite.status,0);
  const restored=spawnSync('docker',['--context','desktop-linux','exec','-i',container,'pg_restore','-U','postgres','-d',restore,'--use-list',listPath,'--exit-on-error'],{input:dump.stdout,encoding:'utf8',windowsHide:true,timeout:20000});
  if(restored.status!==0)writeFileSync(join(directory,'restore-failure.synthetic.log'),restored.stderr,{flag:'wx'});
  assert.equal(restored.status,0,'Restore application snapshot into isolated database');
  stage='compare restored data and privileges';
  const restoredCounts = id => Object.fromEntries(POLICY.tables.map(t => [t,Number(sqlRestore(`select count(*) from public.${t} where ${t==='profiles'?'id':'user_id'}=${quote(id)}`))]));
  assert.deepEqual(restoredCounts(a.userId),counts(a.userId)); assert.deepEqual(restoredCounts(b.userId),counts(b.userId));
  const structureSql = readFileSync(new URL('./Tests/closure-metadata.sql',import.meta.url),'utf8');
  const sourceStructure=JSON.parse(read(structureSql)),restoredStructure=JSON.parse(sqlRestore(structureSql));
  writeFileSync(join(directory,'source-metadata.synthetic.json'),JSON.stringify(sourceStructure),{flag:'wx'});
  writeFileSync(join(directory,'restored-metadata.synthetic.json'),JSON.stringify(restoredStructure),{flag:'wx'});
  for(const key of Object.keys(sourceStructure)){stage='compare restored metadata '+key;assert.deepEqual(restoredStructure[key],sourceStructure[key]);}
  stage='compare restored synthetic row values';
  const allRows = query => Object.fromEntries(POLICY.tables.map(t => [t,JSON.parse(query(`select coalesce(jsonb_agg(to_jsonb(d) order by to_jsonb(d)::text),'[]') from public.${t} d`))]));
  assert.deepEqual(allRows(sqlRestore),allRows(read)); // Synthetic fixture data only, never displayed.
  const restoreEvidence = {version:1,manifestHash:digest(manifest),archiveHash:manifest.files['application.dump'].sha256,projectRef:manifest.projectRef,schemaHash:manifest.schemaHash,
    testedAt:new Date().toISOString(),isolated:true,restoreSucceeded:true,dataCompared:true,schemaAndPrivilegesCompared:true,dependenciesCompatible:true,deletionLedgerHash:digest([]),deletionsReconciled:true};
  const verified=verifyBackup(directory,manifest,restoreEvidence,{now:new Date().toISOString(),projectRef:manifest.projectRef,schemaHash:manifest.schemaHash,ledgerHash:digest([]),protectionChecked:true});
  assert.equal(verified.reasons.length,0);
  const json = (response,value) => { response.setHeader('Content-Type','application/json'); response.end(JSON.stringify(value)); };
  const authClient = createClient(environment.url,environment.adminKey,{auth:{persistSession:false,autoRefreshToken:false}}).auth.admin;
  stage='C# bridge and real metadata/count evidence';
  server=createServer(async (request,response)=>{
    try {
      if(request.url==='/target'){response.end(a.userId);return;}
      const chunks=[];for await(const chunk of request)chunks.push(chunk); const body=Buffer.concat(chunks).toString();
      if(request.url==='/evidence'){
        const input=JSON.parse(body);assert.equal(input.target,a.userId);
        const fks=JSON.parse(read(`select coalesce(json_agg(signature order by signature),'[]') from (
          select c.relname||'('||(select string_agg(a.attname,',' order by x.ord) from unnest(k.conkey) with ordinality x(num,ord) join pg_attribute a on a.attrelid=k.conrelid and a.attnum=x.num)||')->'||rn.nspname||'.'||rc.relname||'('||(select string_agg(a.attname,',' order by x.ord) from unnest(k.confkey) with ordinality x(num,ord) join pg_attribute a on a.attrelid=k.confrelid and a.attnum=x.num)||'):'||case when k.confdeltype='c' then 'cascade' else 'unexpected' end||':'||case when k.convalidated then 'valid' else 'invalid' end as signature
          from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace join pg_class rc on rc.oid=k.confrelid join pg_namespace rn on rn.oid=rc.relnamespace
          where k.contype='f' and (n.nspname='public' or rn.nspname='public' or rn.nspname='auth' and rc.relname='users' and n.nspname not in ('auth','storage'))
        ) s`));
        const permissions=read(`select count(*)=10 and bool_and(c.relrowsecurity and not has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') and not has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'`)==='t'
          && read(`select not has_column_privilege('authenticated','public.profiles','id','UPDATE') and not has_table_privilege('authenticated','public.profiles','INSERT,DELETE') and has_column_privilege('authenticated','public.profiles','pseudo','UPDATE')`)==='t'
          && read(`select count(*) from pg_policies where schemaname='public'`)==='24';
        const storage = read(`select to_regclass('storage.objects') is not null`)==='t' ? Number(read(`select count(*) from storage.objects where owner_id=${quote(a.userId)}`)) : 0;
        const orphans=POLICY.tables.reduce((sum,t)=>sum+Number(read(`select count(*) from public.${t} d left join auth.users u on u.id=d.${t==='profiles'?'id':'user_id'} where u.id is null`)),0);
        writeFileSync(join(directory,`technical-evidence-${input.ledgerHash==='postcheck'?'after':'before'}.synthetic.json`),JSON.stringify({fks,permissions,storage,orphans,rows:counts(a.userId)}));
        json(response,{Project:'oqoqrxwfbkhtpksqimgd',TargetId:a.userId,OperatorId:b.userId,InventorySnapshot:input.snapshot,ObservedAt:new Date().toISOString(),Rows:counts(a.userId),ForeignKeys:fks,
          PermissionsVerified:permissions,ParticipantVerified:true,StorageObjects:storage,Orphans:orphans,Sessions:Number(read(`select count(*) from auth.sessions where user_id=${quote(a.userId)}`)),RefreshTokens:Number(read(`select count(*) from auth.refresh_tokens where user_id=${quote(a.userId)}::text`)),
          WitnessDigest:digest(counts(b.userId)),BackupVerified:verified.reasons.length===0,SnapshotStartedAt:snapshotStartedAt,BackupReference:digest(manifest),BackupLedgerHash:restoreEvidence.deletionLedgerHash});return;
      }
      assert.ok(request.url==='/auth/v1/settings'||request.url==='/auth/v1/admin/users?page=1&per_page=8'||request.url===`/auth/v1/admin/users/${a.userId}`);
      if(request.method==='DELETE') {assert.equal(request.url,`/auth/v1/admin/users/${a.userId}`);assert.equal(body,'{"should_soft_delete":false}'); assert.equal(++deletes,1); attempted=true;}
      const r=await fetch(environment.url+request.url,{method:request.method,headers:{apikey:environment.adminKey,Authorization:`Bearer ${environment.adminKey}`,'Content-Type':'application/json'},...(body?{body}:{}),redirect:'error',signal:AbortSignal.timeout(10000)});
      response.statusCode=r.status;response.setHeader('Content-Type','application/json');response.end(await r.text());
    }catch {response.statusCode=500;response.end('{}');}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const port=server.address().port; assert.ok(port>=49152);
  const child=spawn(resolve(dotnet),['run','--project','tools/mon-bprea-admin/Tests/MonBprea.Admin.Tests.csproj','-c','Release','--no-build','--','--local-closure',`http://127.0.0.1:${port}/`],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='',errors='';child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>errors+=c);
  const code=await new Promise(r=>child.once('exit',r));
  if(code!==0){
    writeFileSync(join(directory,'csharp-test.synthetic.log'),output+'\n'+errors,{flag:'wx'});
    const diagnostic=errors.match(/FAIL: [a-zA-Z0-9 ;=:_.,-]+/);
    if(diagnostic)console.error(diagnostic[0]);
  }
  assert.equal(code,0,'C# local native workflow must pass');assert.match(output,/PASS \d+ C# checks/);assert.equal(deletes,1);
  absent=(await authClient.getUserById(a.userId)).error?.status===404;assert.equal(absent,true);
  assert.ok(Object.values(counts(a.userId)).every(n=>n===0));assert.deepEqual(await readPersonalTables(b),beforeB);
  const detached=createClient(environment.url,environment.publishableKey,{auth:{persistSession:false,autoRefreshToken:false}});
  assert.ok((await detached.auth.refreshSession({refresh_token:oldSession.refresh_token})).error);
  assert.ok((await detached.auth.signInWithPassword({email:a.email,password:a.password})).error);
  const old=createClient(environment.url,environment.publishableKey,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${oldSession.access_token}`}}});
  assert.ok(JSON.parse(Buffer.from(oldSession.access_token.split('.')[1],'base64url')).exp*1000>Date.now());
  assert.equal((await old.rpc('personal_record_quiz',{p_attempt_id:randomUUID(),p_lesson_id:'matiere-organique',p_score:1,p_total:1,p_completed_at:new Date().toISOString()})).error?.code,'23503');
  // Snapshot still contains A: old restoration proof MUST become invalid when
  // current deletions change; replay only on this isolated synthetic database.
  const ledger=[{projectRef:manifest.projectRef,userId:a.userId,status:'pending/uncertain'}];
  assert.ok(verifyBackup(directory,manifest,restoreEvidence,{now:new Date().toISOString(),projectRef:manifest.projectRef,schemaHash:manifest.schemaHash,ledgerHash:digest(ledger),protectionChecked:true}).reasons.includes('deletions_not_reconciled'));
  const restoredB=restoredCounts(b.userId);sqlRestore(`delete from auth.users where id=${quote(a.userId)}`);
  assert.ok(Object.values(restoredCounts(a.userId)).every(n=>n===0));assert.deepEqual(restoredCounts(b.userId),restoredB);
  const reconciled={...restoreEvidence,testedAt:new Date().toISOString(),deletionLedgerHash:digest(ledger)};
  assert.equal(verifyBackup(directory,manifest,reconciled,{now:new Date().toISOString(),projectRef:manifest.projectRef,schemaHash:manifest.schemaHash,ledgerHash:digest(ledger),protectionChecked:true}).reasons.length,0);
  sql(`drop database ${restore}`);
  restore=null;
  writeFileSync(join(directory,'result.json'),JSON.stringify({syntheticOnly:true,nativeCSharp:true,deleteAttempts:deletes,tenTables:true,witnessPreserved:true,refreshRejected:true,oldJwtWriteRejected:true,restorationReconciled:true})+'\n',{flag:'wx'});
  console.log('PASS C# native local deletion, ten real tables, eleven FK signatures, permissions, Storage absence, sessions/refresh, B preserved, JWT barrier, isolated snapshot restore/reconciliation. No PROD request.');
}catch {console.error(`FAIL local C# closure qualification (${stage}); no secret or participant content logged.`);process.exitCode=1;}
finally {if(server)await new Promise(r=>server.close(r));if(restore){assert.match(restore,/^admin12_restore_[a-f0-9]{32}$/);sql(`drop database ${restore}`);}if(b)await b.cleanup();if(a&&!attempted)await a.cleanup();if(attempted&&!absent)process.exitCode=1;}
