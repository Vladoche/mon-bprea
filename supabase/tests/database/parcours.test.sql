begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok((select relrowsecurity from pg_class where oid = 'public.parcours_preferences'::regclass), 'RLS parcours actif');
select ok(has_table_privilege('authenticated','public.parcours_preferences','SELECT'), 'Lecture authentifiée');
select ok(not has_any_column_privilege('authenticated','public.parcours_preferences','REFERENCES')
  and not has_column_privilege('authenticated','public.parcours_preferences','user_id','INSERT,UPDATE')
  and not has_column_privilege('authenticated','public.parcours_preferences','revision','UPDATE')
  and not has_table_privilege('authenticated','public.parcours_preferences','DELETE'), 'Colonnes serveur et suppression protégées');
select ok(not has_table_privilege('anon','public.parcours_preferences','SELECT'), 'Lecture anonyme interdite');
select ok(not has_function_privilege('anon','public.personal_save_parcours(uuid,jsonb,uuid,bigint)','EXECUTE'), 'RPC anonyme interdite');

insert into auth.users(id,email) values
  ('61121000-0000-4000-8000-000000000001','parcours-a@example.invalid'),
  ('61121000-0000-4000-8000-000000000002','parcours-b@example.invalid');

create function pg_temp.save_parcours(actor uuid, operation uuid, base bigint, patch jsonb default '{}')
returns jsonb language sql as $$
  select public.personal_save_parcours(actor,
    '{"version":1,"uc1":"attending","units":[],"ucare":[],"exams":["uc3"],"assignments":{}}'::jsonb || patch,operation,base);
$$;

set local role authenticated;
set local request.jwt.claim.sub = '61121000-0000-4000-8000-000000000001';
set local request.jwt.claim.role = 'authenticated';
select is(pg_temp.save_parcours('61121000-0000-4000-8000-000000000001','71121000-0000-4000-8000-000000000001',0)->>'status','saved','Première révision');
select is(pg_temp.save_parcours('61121000-0000-4000-8000-000000000001','71121000-0000-4000-8000-000000000001',0)->>'status','saved','Rejeu idempotent');
select is(pg_temp.save_parcours('61121000-0000-4000-8000-000000000001','71121000-0000-4000-8000-000000000002',0)->>'status','conflict','Révision obsolète');
select throws_ok($$select pg_temp.save_parcours('61121000-0000-4000-8000-000000000001','71121000-0000-4000-8000-000000000002',1,'{"assignments":{"uc3":{"sessionId":null,"personalDate":"2027-02-29"}}}')$$,
  '23514',null,'Date impossible refusée');
select throws_ok($$select pg_temp.save_parcours('61121000-0000-4000-8000-000000000001','71121000-0000-4000-8000-000000000002',1,'{"exams":["uc6"]}')$$,
  '23514',null,'Identifiant UC inconnu refusé');
select throws_ok($$select pg_temp.save_parcours('61121000-0000-4000-8000-000000000001','71121000-0000-4000-8000-000000000002',1,'{"ucare":["foo","foo"]}')$$,
  '23514',null,'Doublon UCARE refusé');

set local request.jwt.claim.sub = '61121000-0000-4000-8000-000000000002';
select is((select count(*) from public.parcours_preferences),0::bigint,'B ne peut lire A');
with changed as (update public.parcours_preferences set base_revision = 1
  where user_id = '61121000-0000-4000-8000-000000000001' returning 1)
select is((select count(*) from changed),0::bigint,'B ne peut modifier A via la table');
select throws_ok($$select pg_temp.save_parcours('61121000-0000-4000-8000-000000000001','71121000-0000-4000-8000-000000000002',1)$$,
  '42501','parcours_owner_required','B ne peut modifier A');
select is(pg_temp.save_parcours('61121000-0000-4000-8000-000000000002','71121000-0000-4000-8000-000000000002',0)->>'status','saved','B enregistre pour lui-même');

reset role;
delete from auth.users where id = '61121000-0000-4000-8000-000000000001';
select is((select user_id::text from public.parcours_preferences where user_id::text like '61121000-%'),
  '61121000-0000-4000-8000-000000000002', 'La cascade retire A et préserve B');

select * from finish();
rollback;
