-- Lot 6.3.1 : vrai PostgreSQL local. Les JWT et courses HTTP sont exercés
-- séparément par scripts/test-personal-data-supabase.mjs, jamais par ces claims SQL.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select has_table('public'::name,name::name,'Table personnelle présente : '||name)
  from unnest(array['course_states','quiz_attempts','botanical_sessions','botanical_answers','itk_settings','appearance_preferences']) name;
select ok((select relrowsecurity from pg_class where oid=('public.'||name)::regclass), 'RLS active : '||name)
  from unnest(array['course_states','quiz_attempts','botanical_sessions','botanical_answers','itk_settings','appearance_preferences']) name;
select ok(has_table_privilege('authenticated','public.'||name,'SELECT'), 'Lecture personnelle disponible : '||name)
  from unnest(array['course_states','quiz_attempts','botanical_sessions','botanical_answers','itk_settings','appearance_preferences']) name;
select ok(not has_table_privilege('authenticated','public.'||name,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'), 'Aucun droit général d’écriture : '||name)
  from unnest(array['course_states','quiz_attempts','botanical_sessions','botanical_answers','itk_settings','appearance_preferences']) name;
select ok(not has_table_privilege('anon','public.'||name,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  and not has_any_column_privilege('anon','public.'||name,'SELECT,INSERT,UPDATE,REFERENCES'), 'Aucun privilège visiteur : '||name)
  from unnest(array['course_states','quiz_attempts','botanical_sessions','botanical_answers','itk_settings','appearance_preferences']) name;
select ok(not has_column_privilege('authenticated','public.'||name,'user_id','INSERT,UPDATE')
  and not has_column_privilege('authenticated','public.'||name,'created_at','INSERT,UPDATE'), 'Propriétaire et création serveur protégés : '||name)
  from unnest(array['course_states','quiz_attempts','botanical_sessions','botanical_answers','itk_settings','appearance_preferences']) name;
select ok(not has_any_column_privilege('authenticated','public.'||name,'UPDATE'), 'Historique append-only sans UPDATE : '||name)
  from unnest(array['quiz_attempts','botanical_answers']) name;
select ok(not has_column_privilege('authenticated','public.'||name,'revision','INSERT,UPDATE')
  and not has_column_privilege('authenticated','public.'||name,'updated_at','INSERT,UPDATE'), 'Révision et modification serveur protégées : '||name)
  from unnest(array['course_states','botanical_sessions','itk_settings','appearance_preferences']) name;
select ok(exists(select 1 from pg_constraint where conrelid=('public.'||name)::regclass and contype='p'
  and pg_get_constraintdef(oid) like 'PRIMARY KEY (user_id%'), 'Clé primaire inclut le propriétaire : '||name)
  from unnest(array['course_states','quiz_attempts','botanical_sessions','botanical_answers','itk_settings','appearance_preferences']) name;
select ok(exists(select 1 from pg_constraint where conrelid=('public.'||name)::regclass and confrelid='auth.users'::regclass
  and contype='f' and confdeltype='c' and convalidated), 'Racine Auth avec cascade ciblée : '||name)
  from unnest(array['course_states','quiz_attempts','botanical_sessions','botanical_answers','itk_settings','appearance_preferences']) name;
select ok(exists(select 1 from pg_constraint where conrelid='public.botanical_answers'::regclass and confrelid='public.botanical_sessions'::regclass
  and contype='f' and convalidated and pg_get_constraintdef(oid) like 'FOREIGN KEY (user_id, session_id)%'), 'Relation botanique composite incluant le propriétaire');
select is((select count(*)::integer from pg_policies where schemaname='public' and tablename=name),2,'Historique limité à SELECT/INSERT : '||name)
  from unnest(array['quiz_attempts','botanical_answers']) name;
select is((select count(*)::integer from pg_policies where schemaname='public' and tablename=name),3,'État modifiable limité à SELECT/INSERT/UPDATE : '||name)
  from unnest(array['course_states','botanical_sessions','itk_settings','appearance_preferences']) name;
select ok(not exists(select 1 from pg_policies where schemaname='public' and tablename=name
  and (roles<>array['authenticated']::name[] or (cmd in ('SELECT','UPDATE') and (qual is null or qual not like '%auth.uid()%user_id%'))
    or (cmd in ('INSERT','UPDATE') and (with_check is null or with_check not like '%auth.uid()%user_id%'))
    or cmd not in ('SELECT','INSERT','UPDATE'))), 'USING et WITH CHECK personnels : '||name)
  from unnest(array['course_states','quiz_attempts','botanical_sessions','botanical_answers','itk_settings','appearance_preferences']) name;

select is((select array_agg(attname::text order by attnum) from pg_attribute where attrelid='public.course_states'::regclass and attnum>0 and not attisdropped),
  array['user_id','lesson_id','done','best_score','legacy_score','legacy_total','operation_id','base_revision','revision','schema_version','created_at','updated_at'],'Colonnes cours sans date pédagogique inventée');
select is((select array_agg(attname::text order by attnum) from pg_attribute where attrelid='public.quiz_attempts'::regclass and attnum>0 and not attisdropped),
  array['user_id','attempt_id','lesson_id','score','total','completed_at','schema_version','created_at'],'Colonnes historique QCM classique');
select is((select array_agg(attname::text order by attnum) from pg_attribute where attrelid='public.botanical_sessions'::regclass and attnum>0 and not attisdropped),
  array['user_id','session_id','category_id','mode','duration_seconds','is_revision','started_at','total_questions','completed_at','operation_id','base_revision','revision','schema_version','created_at','updated_at'],'Colonnes métadonnées de session botanique');
select is((select array_agg(attname::text order by attnum) from pg_attribute where attrelid='public.botanical_answers'::regclass and attnum>0 and not attisdropped),
  array['user_id','answer_id','session_id','question_id','category_id','species_id','photo_id','mode','is_revision','status','selected_species_id','correct','elapsed_ms','answered_at','schema_version','created_at'],'Colonnes réponse botanique indépendante du Drill');
select is((select array_agg(attname::text order by attnum) from pg_attribute where attrelid='public.itk_settings'::regclass and attnum>0 and not attisdropped),
  array['user_id','parameters','operation_id','base_revision','revision','schema_version','created_at','updated_at'],'ITK singleton de paramètres');
select is((select array_agg(attname::text order by attnum) from pg_attribute where attrelid='public.appearance_preferences'::regclass and attnum>0 and not attisdropped),
  array['user_id','season','brightness','client_updated_at','operation_id','base_revision','revision','schema_version','created_at','updated_at'],'Préférences persistantes sans rendu instantané');
select is((select array_agg(format_type(atttypid,atttypmod) order by attnum) from pg_attribute
  where attrelid=('public.'||name)::regclass and attnum>0 and not attisdropped),types,'Types SQL exacts : '||name)
  from (values
    ('course_states',array['uuid','text','boolean','bigint','bigint','bigint','uuid','bigint','bigint','integer','timestamp with time zone','timestamp with time zone']),
    ('quiz_attempts',array['uuid','uuid','text','bigint','bigint','timestamp with time zone','integer','timestamp with time zone']),
    ('botanical_sessions',array['uuid','text','text','text','numeric','boolean','timestamp with time zone','integer','timestamp with time zone','uuid','bigint','bigint','integer','timestamp with time zone','timestamp with time zone']),
    ('botanical_answers',array['uuid','text','text','text','text','text','text','text','boolean','text','text','boolean','bigint','timestamp with time zone','integer','timestamp with time zone']),
    ('itk_settings',array['uuid','jsonb','uuid','bigint','bigint','integer','timestamp with time zone','timestamp with time zone']),
    ('appearance_preferences',array['uuid','text','text','timestamp with time zone','uuid','bigint','bigint','integer','timestamp with time zone','timestamp with time zone'])
  ) expected(name,types);
select ok(not exists(select 1 from pg_attribute where attrelid=('public.'||name)::regclass and attnum>0 and not attisdropped
  and attnotnull=(attname::text=any(nullable))),'Colonnes obligatoires et facultatives exactes : '||name)
  from (values
    ('course_states',array['best_score','legacy_score','legacy_total']),
    ('quiz_attempts',array[]::text[]),('botanical_sessions',array['completed_at']),
    ('botanical_answers',array['selected_species_id']),('itk_settings',array[]::text[]),
    ('appearance_preferences',array['client_updated_at'])
  ) expected(name,nullable);
select is((select pg_get_constraintdef(oid) from pg_constraint where conrelid=('public.'||name)::regclass and contype='p'),definition,
  'Clé primaire métier exacte : '||name)
  from (values
    ('course_states','PRIMARY KEY (user_id, lesson_id)'),('quiz_attempts','PRIMARY KEY (user_id, attempt_id)'),
    ('botanical_sessions','PRIMARY KEY (user_id, session_id)'),('botanical_answers','PRIMARY KEY (user_id, answer_id)'),
    ('itk_settings','PRIMARY KEY (user_id)'),('appearance_preferences','PRIMARY KEY (user_id)')
  ) expected(name,definition);
select is((select coalesce(array_agg(attname::text order by attnum),'{}'::text[]) from pg_attribute
  where attrelid=('public.'||name)::regclass and attnum>0 and not attisdropped and has_column_privilege('authenticated',attrelid,attnum,'INSERT')),
  writable,'INSERT limité aux colonnes du contrat : '||name)
  from (values
    ('course_states',array['lesson_id','done','best_score','legacy_score','legacy_total','operation_id','base_revision']),
    ('quiz_attempts',array['attempt_id','lesson_id','score','total','completed_at']),
    ('botanical_sessions',array['session_id','category_id','mode','duration_seconds','is_revision','started_at','total_questions','completed_at','operation_id','base_revision']),
    ('botanical_answers',array['answer_id','session_id','question_id','category_id','species_id','photo_id','mode','is_revision','status','selected_species_id','correct','elapsed_ms','answered_at']),
    ('itk_settings',array['parameters','operation_id','base_revision']),
    ('appearance_preferences',array['season','brightness','client_updated_at','operation_id','base_revision'])
  ) expected(name,writable);
select is((select coalesce(array_agg(attname::text order by attnum),'{}'::text[]) from pg_attribute
  where attrelid=('public.'||name)::regclass and attnum>0 and not attisdropped and has_column_privilege('authenticated',attrelid,attnum,'UPDATE')),
  writable,'UPDATE limité aux colonnes du contrat : '||name)
  from (values
    ('course_states',array['done','best_score','legacy_score','legacy_total','operation_id','base_revision']),
    ('quiz_attempts',array[]::text[]),('botanical_sessions',array['completed_at','operation_id','base_revision']),
    ('botanical_answers',array[]::text[]),('itk_settings',array['parameters','operation_id','base_revision']),
    ('appearance_preferences',array['season','brightness','client_updated_at','operation_id','base_revision'])
  ) expected(name,writable);
select ok(not has_table_privilege('service_role','public.'||name,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  and not has_any_column_privilege('service_role','public.'||name,'SELECT,INSERT,UPDATE,REFERENCES'),'Aucun privilège administratif applicatif ajouté : '||name)
  from unnest(array['course_states','quiz_attempts','botanical_sessions','botanical_answers','itk_settings','appearance_preferences']) name;
select ok(exists(select 1 from pg_constraint where conrelid=('public.'||name)::regclass and contype='c'
  and pg_get_constraintdef(oid) like '%schema_version = 1%'), 'Version serveur 1 contrainte : '||name)
  from unnest(array['course_states','quiz_attempts','botanical_sessions','botanical_answers','itk_settings','appearance_preferences']) name;
select ok(exists(select 1 from pg_constraint where conrelid=('public.'||name)::regclass and contype='u'
  and pg_get_constraintdef(oid)='UNIQUE (user_id, operation_id)'), 'Opération mutable unique par compte : '||name)
  from unnest(array['course_states','botanical_sessions','itk_settings','appearance_preferences']) name;
select ok(exists(select 1 from pg_constraint where conrelid='public.botanical_answers'::regclass and contype='u'
  and pg_get_constraintdef(oid)='UNIQUE (user_id, session_id, question_id)'), 'Un résultat par question/session/compte');
select ok(to_regclass('public.'||name) is not null,'Index historique disponible : '||name)
  from unnest(array['quiz_attempts_history_idx','quiz_attempts_lesson_idx','botanical_sessions_history_idx','botanical_answers_history_idx']) name;
select ok(exists(select 1 from pg_index i where i.indexrelid=to_regclass('public.'||name)
  and i.indrelid=('public.'||table_name)::regclass and i.indisvalid and i.indisready
  and (select array_agg(a.attname::text order by k.position) from unnest(i.indkey::smallint[]) with ordinality k(attnum,position)
    join pg_attribute a on a.attrelid=i.indrelid and a.attnum=k.attnum)=columns),
  'Index historique valide et colonnes exactes : '||name)
  from (values
    ('quiz_attempts_history_idx','quiz_attempts',array['user_id','created_at','attempt_id']),
    ('quiz_attempts_lesson_idx','quiz_attempts',array['user_id','lesson_id','created_at','attempt_id']),
    ('botanical_sessions_history_idx','botanical_sessions',array['user_id','created_at','session_id']),
    ('botanical_answers_history_idx','botanical_answers',array['user_id','created_at','answer_id'])
  ) expected(name,table_name,columns);
select is((select count(*)::integer from pg_trigger where not tgisinternal and tgenabled='O' and tgname in
  ('course_states_guard','quiz_attempts_guard','botanical_sessions_guard','botanical_answers_guard','itk_settings_guard','appearance_preferences_guard')),6,'Six guards actifs sur écritures directes et RPC');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'personal\_%' escape '\'),6,'Six RPC métier seulement');
select ok(to_regprocedure(signature) is not null,'Signature RPC exacte présente : '||signature)
  from unnest(array[
    'public.personal_save_course(text,boolean,bigint,bigint,bigint,uuid,bigint)',
    'public.personal_save_botanical_session(jsonb,uuid,bigint)','public.personal_save_itk(jsonb,uuid,bigint)',
    'public.personal_save_appearance(jsonb,uuid,bigint)','public.personal_record_quiz(uuid,text,bigint,bigint,timestamptz)',
    'public.personal_record_botanical_answer(jsonb)'
  ]) signature;
select ok(not p.prosecdef and p.provolatile='v' and p.proconfig=array['search_path=""'], 'RPC invoker à search_path vide : '||p.proname)
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'personal\_%' escape '\';
select is(pg_get_userbyid(p.proowner)::text,'postgres','Propriétaire DDL attendu, exécution invoker : '||p.proname)
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'personal\_%' escape '\';
select ok(has_function_privilege('authenticated',p.oid,'EXECUTE') and not has_function_privilege('anon',p.oid,'EXECUTE')
  and not has_function_privilege('service_role',p.oid,'EXECUTE')
  and not exists(select 1 from aclexplode(p.proacl) a where a.grantee=0 and a.privilege_type='EXECUTE'), 'RPC accessible au seul rôle étudiant : '||p.proname)
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'personal\_%' escape '\';
select ok(not p.prosecdef and p.proconfig=array['search_path=""'] and not has_function_privilege('authenticated',p.oid,'EXECUTE')
  and not has_function_privilege('anon',p.oid,'EXECUTE') and not has_function_privilege('service_role',p.oid,'EXECUTE'), 'Guard invoker privé : '||p.proname)
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='bprea_private' and p.proname in ('guard_personal_mutation','guard_personal_append');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='bprea_private' and p.proname in ('guard_personal_mutation','guard_personal_append')),2,'Les deux guards privés existent sans assertion vide');
select ok(not has_schema_privilege('authenticated','bprea_private','USAGE'),'Schéma privé existant toujours inaccessible');
select ok(has_column_privilege('authenticated','public.profiles','pseudo','UPDATE')
  and not has_column_privilege('authenticated','public.profiles','id','UPDATE')
  and not has_table_privilege('authenticated','public.profiles','INSERT,DELETE'),'Privilèges profiles conservés');
select ok(not has_any_column_privilege('authenticated','public.'||name,'UPDATE')
  and not has_table_privilege('anon','public.'||name,'SELECT,INSERT,UPDATE,DELETE'),'Historique Drill et accès visiteur inchangés : '||name)
  from unnest(array['drill_series','drill_answers','drill_training_attempts']) name;

-- Fixtures synthétiques transactionnelles. Aucun compte étudiant ni service distant.
insert into auth.users(id,email) values
  ('63100000-0000-4000-8000-000000000001','pgtap-personal-a@example.test'),
  ('63100000-0000-4000-8000-000000000002','pgtap-personal-b@example.test');
create temp table personal_test_payloads as select
  '{"id":"botanical-pgtap","categoryId":"petits-fruits","mode":"chrono","durationSeconds":30,"revision":false,"startedAt":"2026-10-21T12:00:00.000Z","totalQuestions":4,"completedAt":null}'::jsonb as session,
  '{"id":"botanical-pgtap-q1","sessionId":"botanical-pgtap","questionId":"botanical-pgtap-q1","categoryId":"petits-fruits","speciesId":"fraisier","photoId":"fraisier-test-photo","mode":"chrono","revision":false,"status":"correct","selectedSpeciesId":"fraisier","correct":true,"elapsedMs":2500,"answeredAt":"2026-10-21T12:00:00.000Z"}'::jsonb as answer,
  '{"crop":"tomate","variety":"Marmande","cover":"serre","area":"120","month":"4","year":"2028","soil":"limoneux","water":"standard"}'::jsonb as itk,
  '{"version":1,"season":"auto","brightness":"auto"}'::jsonb as appearance;
grant select on pg_temp.personal_test_payloads to authenticated;
select set_config('request.jwt.claims','{"sub":"63100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;

select is(public.personal_save_course('matiere-organique',true,3,2,3,'63100000-0000-4000-8000-000000000010',0)->>'status','inserted','Cours créé à révision 1');
select is(public.personal_save_course('matiere-organique',true,3,2,3,'63100000-0000-4000-8000-000000000010',0)->>'status','replayed','Retry cours exact sans nouvelle révision');
select is(public.personal_save_course('matiere-organique',false,3,2,3,'63100000-0000-4000-8000-000000000011',1)->>'status','updated','Cours volontairement décoché');
select is((select done from public.course_states),false,'False explicite conservé malgré meilleur score parfait');
select is(public.personal_save_course('matiere-organique',true,3,2,3,'63100000-0000-4000-8000-000000000012',1)->>'status','conflict','Révision obsolète ne rétablit pas le cours');
select is(public.personal_save_course('matiere-organique',false,3,2,3,'63100000-0000-4000-8000-000000000011',1)->>'status','replayed','Perte acquittement résolue par opération stable');
select is(public.personal_save_course('matiere-organique',true,3,2,3,'63100000-0000-4000-8000-000000000011',1)->>'status','conflict','Même opération avec autre état refusée');
select throws_ok($$update public.course_states set done=true$$,'40001',null,'PATCH direct sans CAS refusé');
select throws_ok($$update public.course_states set user_id='63100000-0000-4000-8000-000000000002'$$,'42501',null,'Propriétaire cours protégé');
select throws_ok($$update public.course_states set revision=10$$,'42501',null,'Révision serveur protégée');
select throws_ok($$select public.personal_save_course('matiere-organique',false,2,2,3,'63100000-0000-4000-8000-000000000013',2)$$,'23514',null,'Meilleur score ne baisse jamais');
select throws_ok($$select public.personal_save_course('matiere-organique',false,3,null,null,'63100000-0000-4000-8000-000000000013',2)$$,'23514',null,'Score historique sans date préservé');
select throws_ok($$select public.personal_save_course('invalid',true,-1,null,null,'63100000-0000-4000-8000-000000000013',0)$$,'23514',null,'Score négatif refusé');
select throws_ok($$select public.personal_save_course('',true,1,null,null,'63100000-0000-4000-8000-000000000013',0)$$,'23514',null,'Identifiant vide refusé');
select is((select count(*)::integer from public.quiz_attempts),0,'Ancien score ne produit aucune tentative datée');

select is(public.personal_record_quiz('63100000-0000-4000-8000-000000000020','matiere-organique',3,3,'2026-10-21T12:00:00Z')->>'status','inserted','Tentative QCM réelle ajoutée');
select is(public.personal_record_quiz('63100000-0000-4000-8000-000000000020','matiere-organique',3,3,'2026-10-21T12:00:00Z')->>'status','replayed','Retry QCM dédupliqué');
select is(public.personal_record_quiz('63100000-0000-4000-8000-000000000020','matiere-organique',2,3,'2026-10-21T12:00:00Z')->>'status','conflict','Retry QCM divergent sans réécriture');
select is(public.personal_record_quiz('63100000-0000-4000-8000-000000000021','matiere-organique',3,3,'2026-10-21T12:00:00Z')->>'status','inserted','Autre tentative identique reste distincte');
select is((select count(*)::integer from public.quiz_attempts),2,'Deux tentatives historiques conservées');
select is((select done from public.course_states),false,'QCM ajouté sans réactiver un état cours');
select throws_ok($$update public.quiz_attempts set score=0$$,'42501',null,'QCM append-only');
select throws_ok($$delete from public.quiz_attempts$$,'42501',null,'Suppression QCM interdite');
select throws_ok($$select public.personal_record_quiz('63100000-0000-4000-8000-000000000022','matiere-organique',4,3,'2026-10-21T12:00:00Z')$$,'23514',null,'Score supérieur au total refusé');
select throws_ok($$select public.personal_record_quiz('63100000-0000-4000-8000-000000000022','matiere-organique',0,0,'2026-10-21T12:00:00Z')$$,'23514',null,'Total nul refusé');
select throws_ok($$select public.personal_record_quiz('63100000-0000-4000-8000-000000000022','matiere-organique',1,3,'infinity')$$,'23514',null,'Date pédagogique infinie refusée');

select is(public.personal_save_botanical_session((select session from pg_temp.personal_test_payloads),'63100000-0000-4000-8000-000000000030',0)->>'status','inserted','Session botanique créée');
select is(public.personal_save_botanical_session((select session from pg_temp.personal_test_payloads),'63100000-0000-4000-8000-000000000030',0)->>'status','replayed','Session botanique rejouée');
select is(public.personal_save_botanical_session((select session||'{"totalQuestions":4.0}'::jsonb from pg_temp.personal_test_payloads),'63100000-0000-4000-8000-000000000030',0)->>'status','replayed','Entier JSON écrit 4.0 conserve sa valeur numérique');
select is(public.personal_record_botanical_answer((select answer from pg_temp.personal_test_payloads))->>'status','inserted','Réponse botanique append-only créée');
select is(public.personal_record_botanical_answer((select answer from pg_temp.personal_test_payloads))->>'status','replayed','Identité locale botanique stable au retry');
select is(public.personal_record_botanical_answer((select answer||'{"elapsedMs":2500.0}'::jsonb from pg_temp.personal_test_payloads))->>'status','replayed','Durée entière JSON écrite avec décimale acceptée');
select is(public.personal_record_botanical_answer((select answer||'{"status":"incorrect","correct":false,"selectedSpeciesId":"framboisier"}'::jsonb from pg_temp.personal_test_payloads))->>'status','conflict','Réponse botanique divergente préserve le résultat initial');
select throws_ok($$select public.personal_record_botanical_answer((select answer||'{"id":"autre-identite"}'::jsonb from pg_temp.personal_test_payloads))$$,'23514',null,'Deux identités techniques pour une question interdites');
select throws_ok($$select public.personal_record_botanical_answer((select answer||'{"correct":false}'::jsonb from pg_temp.personal_test_payloads))$$,'23514',null,'État et correct doivent être cohérents');
select throws_ok($$select public.personal_record_botanical_answer((select answer||'{"selectedSpeciesId":null}'::jsonb from pg_temp.personal_test_payloads))$$,'23514',null,'Réponse correcte exige une espèce sélectionnée');
select throws_ok($$update public.botanical_answers set correct=false$$,'42501',null,'Réponse botanique immuable');
select is(public.personal_save_botanical_session((select session||'{"completedAt":"2026-10-21T12:05:00.000Z"}'::jsonb from pg_temp.personal_test_payloads),'63100000-0000-4000-8000-000000000031',1)->>'status','updated','Session partiellement répondue peut être terminée');
select is((select revision from public.botanical_sessions),2::bigint,'Complétion incrémente la révision');
select is(public.personal_save_botanical_session((select session from pg_temp.personal_test_payloads),'63100000-0000-4000-8000-000000000032',2)->>'status','conflict','Complétion validée ne revient pas à null');
select throws_ok($$select public.personal_record_botanical_answer((select answer||'{"id":"botanical-pgtap-q2","questionId":"botanical-pgtap-q2","answeredAt":"2026-10-21T12:06:00.000Z"}'::jsonb from pg_temp.personal_test_payloads))$$,'23514',null,'Réponse après complétion refusée');
select throws_ok($$select public.personal_save_botanical_session((select session||'{"id":"invalid-date","startedAt":"2026-02-30T12:00:00.000Z"}'::jsonb from pg_temp.personal_test_payloads),'63100000-0000-4000-8000-000000000032',0)$$,'23514',null,'Date JSON civile invalide refusée');
select throws_ok($$select public.personal_save_botanical_session((select session||'{"id":"invalid-version","schemaVersion":2}'::jsonb from pg_temp.personal_test_payloads),'63100000-0000-4000-8000-000000000032',0)$$,'23514',null,'Format botanique inconnu non importé');

select is(public.personal_save_itk((select itk from pg_temp.personal_test_payloads),'63100000-0000-4000-8000-000000000040',0)->>'status','inserted','Derniers paramètres ITK créés');
select is(public.personal_save_itk((select itk from pg_temp.personal_test_payloads),'63100000-0000-4000-8000-000000000040',0)->>'status','replayed','Retry ITK exact');
select is(public.personal_save_itk((select itk||'{"area":"200"}'::jsonb from pg_temp.personal_test_payloads),'63100000-0000-4000-8000-000000000041',1)->>'status','updated','Remplacement ITK volontaire');
select is(public.personal_save_itk((select itk from pg_temp.personal_test_payloads),'63100000-0000-4000-8000-000000000042',1)->>'status','conflict','Ancienne révision ITK ne remplace pas le paramétrage');
select is((select parameters->>'area' from public.itk_settings),'200','Paramètres gagnants conservés');
select throws_ok($$select public.personal_save_itk((select itk||'{"area":120}'::jsonb from pg_temp.personal_test_payloads),'63100000-0000-4000-8000-000000000042',2)$$,'23514',null,'ITK attend les chaînes FormData');
select throws_ok($$select public.personal_save_itk((select itk||'{"variety":"Nantaise"}'::jsonb from pg_temp.personal_test_payloads),'63100000-0000-4000-8000-000000000042',2)$$,'23514',null,'Association culture/variété vérifiée');
select throws_ok($$select public.personal_save_itk((select itk||'{"extra":"unknown"}'::jsonb from pg_temp.personal_test_payloads),'63100000-0000-4000-8000-000000000042',2)$$,'23514',null,'Paramètre inconnu refusé sans perte de source');
select throws_ok($$update public.itk_settings set parameters='{}'$$,'40001',null,'CAS imposé aussi hors RPC');
select is(public.personal_save_itk((select itk||'{"area":"1e2"}'::jsonb from pg_temp.personal_test_payloads),'63100000-0000-4000-8000-000000000043',2)->>'status','updated','Surface HTML valide en notation exposant acceptée');
select is((select parameters->>'area' from public.itk_settings),'1e2','Chaîne FormData originale conservée');
select is(public.personal_save_itk((select itk||'{"area":"100.0"}'::jsonb from pg_temp.personal_test_payloads),'63100000-0000-4000-8000-000000000044',3)->>'status','updated','Surface HTML entière en notation décimale acceptée');
select throws_ok($$select public.personal_save_itk((select itk||'{"area":"100.5"}'::jsonb from pg_temp.personal_test_payloads),'63100000-0000-4000-8000-000000000045',4)$$,'23514',null,'Surface fractionnaire refusée selon step entier');

select is(public.personal_save_appearance((select appearance from pg_temp.personal_test_payloads),'63100000-0000-4000-8000-000000000050',0)->>'status','inserted','Préférences auto sans date ancienne créées');
select is((select client_updated_at from public.appearance_preferences),null::timestamptz,'Aucune date appareil inventée');
select is(public.personal_save_appearance((select appearance from pg_temp.personal_test_payloads),'63100000-0000-4000-8000-000000000050',0)->>'status','replayed','Retry apparence exact');
select is(public.personal_save_appearance('{"version":1,"season":"winter","brightness":"dark","updatedAt":"2026-10-21T12:00:00.000Z"}','63100000-0000-4000-8000-000000000051',1)->>'status','updated','Préférence explicite modifiable');
select is(public.personal_save_appearance((select appearance from pg_temp.personal_test_payloads),'63100000-0000-4000-8000-000000000052',1)->>'status','conflict','Conflit apparence préserve le choix gagnant');
select throws_ok($$select public.personal_save_appearance('{"version":2,"season":"auto","brightness":"auto"}','63100000-0000-4000-8000-000000000052',2)$$,'23514',null,'Version inconnue refusée');
select throws_ok($$select public.personal_save_appearance('{"version":1,"season":"auto","brightness":"night"}','63100000-0000-4000-8000-000000000052',2)$$,'23514',null,'Ambiance calculée ne remplace pas la luminosité');
select throws_ok($$select public.personal_save_appearance('{"version":1,"season":"auto","brightness":"auto","theme":"dark"}','63100000-0000-4000-8000-000000000052',2)$$,'23514',null,'Rendu instantané hors contrat');

-- Le même identifiant métier chez B ne révèle aucune ligne A.
reset role;
select set_config('request.jwt.claims','{"sub":"63100000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*)::integer from public.course_states),0,'B ne lit pas les cours de A');
select is((select count(*)::integer from public.quiz_attempts),0,'B ne lit pas les QCM de A');
select is((select count(*)::integer from public.botanical_sessions),0,'B ne lit pas les sessions de A');
select is((select count(*)::integer from public.botanical_answers),0,'B ne lit pas les réponses botaniques de A');
select is((select count(*)::integer from public.itk_settings),0,'B ne lit pas les paramètres de A');
select is((select count(*)::integer from public.appearance_preferences),0,'B ne lit pas les préférences de A');
select throws_ok($$select public.personal_record_botanical_answer((select answer from pg_temp.personal_test_payloads))$$,'42501',null,'Session A inutilisable par une réponse B');
select is(public.personal_save_course('matiere-organique',false,1,null,null,'63100000-0000-4000-8000-000000000010',0)->>'status','inserted','Même identifiant cours/opération possible dans un autre compte');
select throws_ok($$insert into public.course_states(user_id,lesson_id,done,operation_id,base_revision) values('63100000-0000-4000-8000-000000000001','forbidden',false,'63100000-0000-4000-8000-000000000060',0)$$,'42501',null,'Attribution directe à un autre propriétaire interdite');

reset role;
set local role anon;
select throws_ok('select * from public.'||name,'42501',null,'Aucun accès anonyme : '||name)
  from unnest(array['course_states','quiz_attempts','botanical_sessions','botanical_answers','itk_settings','appearance_preferences']) name;
select throws_ok($$select public.personal_save_itk('{}','63100000-0000-4000-8000-000000000070',0)$$,'42501',null,'RPC non appelable anonymement');
reset role;

select * from finish();
rollback;
