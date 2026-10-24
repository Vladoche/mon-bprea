-- PostgreSQL réel ; les requêtes Auth/JWT et la concurrence HTTP sont testées
-- séparément par scripts/test-drill-supabase.mjs. Aucun projet hébergé.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok((select relrowsecurity from pg_class where oid=('public.'||name)::regclass), 'RLS active : '||name)
  from unnest(array['drill_series','drill_answers','drill_training_attempts']) name;
select is((select count(*)::integer from pg_policies where schemaname='public' and tablename=name),2,'Seulement SELECT/INSERT : '||name)
  from unnest(array['drill_series','drill_answers','drill_training_attempts']) name;
select ok(not exists(select 1 from pg_policies where schemaname='public' and tablename=name
  and (roles<>array['authenticated']::name[] or (cmd='SELECT' and qual not like '%auth.uid()%user_id%')
    or (cmd='INSERT' and with_check not like '%auth.uid()%user_id%') or cmd not in ('SELECT','INSERT'))), 'Politiques liées à Auth : '||name)
  from unnest(array['drill_series','drill_answers','drill_training_attempts']) name;
select ok(has_table_privilege('authenticated','public.'||name,'SELECT')
  and not has_table_privilege('authenticated','public.'||name,'UPDATE,DELETE,TRUNCATE'), 'Lecture seule et ajout ciblé sans UPDATE/DELETE : '||name)
  from unnest(array['drill_series','drill_answers','drill_training_attempts']) name;
select ok(not has_column_privilege('authenticated','public.'||name,'user_id','INSERT')
  and not has_column_privilege('authenticated','public.'||name,'created_at','INSERT'), 'Propriétaire et horodatage serveur protégés : '||name)
  from unnest(array['drill_series','drill_answers','drill_training_attempts']) name;
select ok(not has_table_privilege('anon','public.'||name,'SELECT,INSERT,UPDATE,DELETE')
  and not has_any_column_privilege('anon','public.'||name,'SELECT,INSERT,UPDATE'), 'Aucun accès visiteur : '||name)
  from unnest(array['drill_series','drill_answers','drill_training_attempts']) name;

select ok(has_column_privilege('authenticated','public.drill_series','questions','INSERT')
  and not has_column_privilege('authenticated','public.drill_series','id','INSERT')
  and not has_column_privilege('authenticated','public.drill_series','schema_version','INSERT'), 'Payload série autorisé, UUID et version techniques protégés');
select ok(has_column_privilege('authenticated','public.'||name,'answer','INSERT')
  and not has_column_privilege('authenticated','public.'||name,'correct','INSERT'), 'Choix insérable mais correction serveur : '||name)
  from unnest(array['drill_answers','drill_training_attempts']) name;
select is((select array_agg(attname::text order by attnum) from pg_attribute where attrelid='public.drill_series'::regclass and attnum>0 and not attisdropped),
  array['id','user_id','unit','week','series_key','started_at','questions','schema_version','created_at'],'Colonnes du snapshot historique');
select is((select array_agg(attname::text order by attnum) from pg_attribute where attrelid='public.drill_answers'::regclass and attnum>0 and not attisdropped),
  array['user_id','operation_id','series_id','question_id','answer','correct','answered_at','created_at'],'Colonnes première réponse et dates distinctes');
select is((select array_agg(attname::text order by attnum) from pg_attribute where attrelid='public.drill_training_attempts'::regclass and attnum>0 and not attisdropped),
  array['user_id','operation_id','series_id','question_id','answer','correct','answered_at','created_at'],'Colonnes entraînement et identité d’opération');
select is((select format_type(atttypid,atttypmod) from pg_attribute where attrelid='public.drill_series'::regclass and attname='questions'),'jsonb','Snapshot en JSONB');
select is((select attgenerated::text from pg_attribute where attrelid='public.drill_series'::regclass and attname='series_key'),'s','Clé métier générée côté serveur');
select ok(exists(select 1 from pg_constraint where conrelid='public.drill_series'::regclass and conname='drill_series_business_key' and contype='u'
  and pg_get_constraintdef(oid)='UNIQUE (user_id, unit, week)'), 'Une série par propriétaire/UC/semaine');
select ok(exists(select 1 from pg_constraint where conrelid='public.drill_answers'::regclass and conname='drill_answers_first_key' and contype='u'
  and pg_get_constraintdef(oid)='UNIQUE (user_id, series_id, question_id)'), 'Une première réponse par propriétaire/série/question');
select ok(exists(select 1 from pg_constraint where conrelid=('public.'||name)::regclass and contype='p'
  and pg_get_constraintdef(oid)='PRIMARY KEY (user_id, operation_id)'), 'Déduplication sans collision intercomptes : '||name)
  from unnest(array['drill_answers','drill_training_attempts']) name;
select ok(exists(select 1 from pg_constraint where conrelid='public.drill_answers'::regclass and conname='drill_answers_series_fkey' and convalidated
  and pg_get_constraintdef(oid) like 'FOREIGN KEY (user_id, series_id) REFERENCES drill_series(user_id, id)%'), 'FK composite série/propriétaire validée');
select ok(exists(select 1 from pg_constraint where conrelid='public.drill_training_attempts'::regclass and conname='drill_training_answer_fkey' and convalidated
  and pg_get_constraintdef(oid) like 'FOREIGN KEY (user_id, series_id, question_id) REFERENCES drill_answers(user_id, series_id, question_id)%'), 'FK composite vers la première réponse validée');
select ok(exists(select 1 from pg_constraint where conrelid='public.drill_series'::regclass and confrelid='auth.users'::regclass and contype='f' and confdeltype='c'), 'Compte Auth comme racine de propriété et nettoyage ciblé en cascade');
select ok(to_regclass('public.drill_training_history_idx') is not null and to_regclass('public.drill_answers_activity_idx') is not null,'Index d’historique et d’activité présents');
select is((select count(*)::integer from pg_trigger where not tgisinternal and tgenabled='O' and tgname in ('drill_series_guard','drill_answers_guard','drill_training_guard')),3,'Trois guards actifs pour INSERT/UPDATE');

select ok(not p.prosecdef and p.provolatile='v' and p.proconfig=array['search_path=""'], 'RPC invoker VOLATILE avec search_path vide : '||p.proname)
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('drill_create_series','drill_record_answer','drill_record_training');
select ok(has_function_privilege('authenticated',p.oid,'EXECUTE') and not has_function_privilege('anon',p.oid,'EXECUTE')
  and not exists(select 1 from aclexplode(p.proacl) a where a.grantee=0 and a.privilege_type='EXECUTE'), 'RPC seulement authentifié, aucun PUBLIC : '||p.proname)
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('drill_create_series','drill_record_answer','drill_record_training');
select ok(not p.prosecdef and p.proconfig=array['search_path=""'] and not has_function_privilege('authenticated',p.oid,'EXECUTE')
  and not has_function_privilege('anon',p.oid,'EXECUTE') and not has_function_privilege('service_role',p.oid,'EXECUTE'), 'Guard privé invoker non appelable : '||p.proname)
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='bprea_private' and p.proname in ('guard_drill_series','guard_drill_response');
select ok(not has_schema_privilege('authenticated','bprea_private','USAGE'),'Le schéma privé du lot 6.1 reste inaccessible');

-- Fixture transactionnelle uniquement. Les vrais comptes/JWT sont testés par API.
insert into auth.users(id,email) values ('62000000-0000-4000-8000-000000000001','pgtap-drill-a@example.test'),('62000000-0000-4000-8000-000000000002','pgtap-drill-b@example.test');
create temp table drill_test_snapshot as select jsonb_agg(jsonb_build_object(
  'id','sql-question-'||n,'version',1,'unit','uc3','chapter','Sol','concept','Test','type','single-choice',
  'prompt','Question '||n,'options',jsonb_build_array(jsonb_build_object('id','a','text','Oui'),jsonb_build_object('id','b','text','Non')),
  'answer','a','explanation','Explication','difficulty','Fondamentaux') order by n) questions from generate_series(1,10) n;
grant select on pg_temp.drill_test_snapshot to authenticated;
select set_config('request.jwt.claims','{"sub":"62000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;

select is((public.drill_create_series('uc3','2026-W42','2026-10-14T10:00:00Z',(select questions from pg_temp.drill_test_snapshot)))->>'status','inserted','Création réelle d’une série sous authenticated');
select is((public.drill_create_series('uc3','2026-W42','2026-10-14T10:00:00Z',(select questions from pg_temp.drill_test_snapshot)))->>'status','replayed','Retry de série sans doublon');
select is((public.drill_create_series('uc3','2026-W42','2026-10-14T11:00:00Z',(select questions from pg_temp.drill_test_snapshot)))->>'status','conflict','Autre date de début : conflit sans réécriture');
select is((select count(*)::integer from public.drill_series),1,'Une seule série conservée');
select throws_ok($$update public.drill_series set questions='[]'$$,'42501',null,'Snapshot immuable pour l’étudiant');
select throws_ok($$delete from public.drill_series$$,'42501',null,'Suppression de série interdite');
select throws_ok($$insert into public.drill_series(user_id,unit,week,started_at,questions) select '62000000-0000-4000-8000-000000000002','uc3','2026-W43','2026-10-14T10:00Z',questions from pg_temp.drill_test_snapshot$$,'42501',null,'Propriétaire de série non falsifiable');
select throws_ok($$select public.drill_create_series('uc3','2025-W53','2026-10-14T10:00Z',(select questions from pg_temp.drill_test_snapshot))$$,'23514',null,'Semaine 53 inexistante refusée');
select throws_ok($$select public.drill_create_series('uc9','2026-W42','2026-10-14T10:00Z',(select questions from pg_temp.drill_test_snapshot))$$,'23514',null,'UC inconnue refusée');
select throws_ok($$select public.drill_create_series('uc3','2026-W43','infinity',(select questions from pg_temp.drill_test_snapshot))$$,'23514',null,'Horodatage infini refusé');
select throws_ok($$select public.drill_create_series('uc3','2026-W43','2026-10-14T10:00Z','[]')$$,'23514',null,'Snapshot incomplet refusé');
select throws_ok($$select public.drill_create_series('uc3','2026-W43','2026-10-14T10:00Z',jsonb_set((select questions from pg_temp.drill_test_snapshot),'{1,id}','"sql-question-1"'))$$,'23514',null,'Questions dupliquées refusées');
select throws_ok($$select public.drill_create_series('uc3','2026-W43','2026-10-14T10:00Z',jsonb_set((select questions from pg_temp.drill_test_snapshot),'{0,version}','1.5'))$$,'23514',null,'Version de question non entière refusée');
select throws_ok($$select public.drill_create_series('uc3','2026-W43','2026-10-14T10:00Z',jsonb_set((select questions from pg_temp.drill_test_snapshot),'{0,prompt}',to_jsonb(E'\t'::text)))$$,'23514',null,'Texte composé de tabulation refusé comme en JavaScript');
select throws_ok($$select public.drill_create_series('uc3','2026-W43','2026-10-14T10:00Z',jsonb_set((select questions from pg_temp.drill_test_snapshot),'{0,options,0,text}',to_jsonb(U&'\00A0'::text)))$$,'23514',null,'Option composée de NBSP refusée comme en JavaScript');
select throws_ok($$select public.drill_create_series('uc3','2026-W43','2026-10-14T10:00Z',jsonb_set((select questions from pg_temp.drill_test_snapshot),'{0,reference}','{"title":"Source","url":"https://example.test:99999/"}'))$$,'23514',null,'Port URL invalide refusé');

select is((public.drill_record_answer((select id from public.drill_series),'sql-question-1','b','2026-10-14T10:05Z','62000000-0000-4000-8000-000000000010'))->>'status','inserted','Première réponse insérée atomiquement');
select is((select correct from public.drill_answers),false,'Correction calculée depuis le snapshot, pas par le client');
select is((public.drill_record_answer((select id from public.drill_series),'sql-question-1','b','2026-10-14T10:05Z','62000000-0000-4000-8000-000000000010'))->>'status','replayed','Retry strict de la première réponse dédupliqué');
select is((public.drill_record_answer((select id from public.drill_series),'sql-question-1','a','2026-10-14T10:05Z','62000000-0000-4000-8000-000000000011'))->>'status','conflict','Autre première réponse : conflit explicite');
select is((public.drill_record_answer((select id from public.drill_series),'sql-question-2','a','2026-10-14T10:05Z','62000000-0000-4000-8000-000000000010'))->>'status','conflict','Réutilisation d’une opération pour une autre question : conflit');
select is((select count(*)::integer from public.drill_answers),1,'Aucun doublon ou écrasement de la première réponse');
select throws_ok($$update public.drill_answers set answer='a'$$,'42501',null,'UPDATE première réponse refusé');
select throws_ok($$update public.drill_answers set correct=true$$,'42501',null,'Modification de correction refusée');
select throws_ok($$update public.drill_answers set user_id='62000000-0000-4000-8000-000000000002'$$,'42501',null,'Réattribution refusée');
select throws_ok($$delete from public.drill_answers$$,'42501',null,'DELETE première réponse refusé');
select throws_ok($$select public.drill_record_answer((select id from public.drill_series),'absente','a','2026-10-14T10:05Z','62000000-0000-4000-8000-000000000020')$$,'23514',null,'Question absente refusée');
select throws_ok($$select public.drill_record_answer((select id from public.drill_series),'sql-question-2','absente','2026-10-14T10:05Z','62000000-0000-4000-8000-000000000020')$$,'23514',null,'Option absente refusée');
select throws_ok($$insert into public.drill_answers(operation_id,series_id,question_id,answer,answered_at,correct) select '62000000-0000-4000-8000-000000000020',id,'sql-question-2','b','2026-10-14T10:05Z',true from public.drill_series$$,'42501',null,'INSERT direct de correct interdit');
select throws_ok($$select public.drill_record_training((select id from public.drill_series),'sql-question-2','a','2026-10-14T10:05Z','62000000-0000-4000-8000-000000000020')$$,'42501',null,'Entraînement sans première réponse refusé');

select is((public.drill_record_training((select id from public.drill_series),'sql-question-1','a','2026-10-14T10:06Z','62000000-0000-4000-8000-000000000030'))->>'status','inserted','Entraînement lié à la première réponse');
select is((public.drill_record_training((select id from public.drill_series),'sql-question-1','a','2026-10-14T10:06Z','62000000-0000-4000-8000-000000000030'))->>'status','replayed','Retry entraînement dédupliqué');
select is((public.drill_record_training((select id from public.drill_series),'sql-question-1','b','2026-10-14T10:06Z','62000000-0000-4000-8000-000000000030'))->>'status','conflict','Opération entraînement modifiée : conflit');
select is((public.drill_record_training((select id from public.drill_series),'sql-question-1','a','2026-10-14T10:06Z','62000000-0000-4000-8000-000000000031'))->>'status','inserted','Deux entraînements identiques restent distincts avec deux opérations');
select is((select count(*)::integer from public.drill_training_attempts),2,'Deux entraînements, sans doublon de retry');
select is((select correct from public.drill_answers),false,'Les entraînements ne modifient pas la correction initiale');
select ok((select bool_and(correct) from public.drill_training_attempts),'Corrections des entraînements calculées côté serveur');
select ok((select bool_and(created_at > answered_at) from public.drill_answers),'Date serveur distincte de la date pédagogique synthétique');

-- Autre identité SQL : zéro ligne visible et aucune collision d’opération
-- intercomptes. Les JWT signés et le transport PostgREST sont exercés à part.
reset role;
select set_config('request.jwt.claims','{"sub":"62000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*)::integer from public.drill_series),0,'B ne lit aucune série de A');
select is((select count(*)::integer from public.drill_answers),0,'B ne lit aucune réponse de A');
select is((select count(*)::integer from public.drill_training_attempts),0,'B ne lit aucun entraînement de A');
select is((public.drill_create_series('uc3','2026-W42','2026-10-14T10:00Z',(select questions from pg_temp.drill_test_snapshot)))->>'status','inserted','B possède sa propre série de même UC/semaine');
select is((public.drill_record_answer((select id from public.drill_series),'sql-question-1','a','2026-10-14T10:05Z','62000000-0000-4000-8000-000000000010'))->>'status','inserted','Une opération UUID voisine ne bloque pas B et ne révèle pas A');
reset role;
set local role anon;
select throws_ok($$select * from public.drill_series$$,'42501',null,'Visiteur : lecture directe refusée');
select throws_ok($$select public.drill_record_answer(null,'x','a',now(),gen_random_uuid())$$,'42501',null,'Visiteur : RPC refusé');
reset role;
select * from finish();
rollback;
