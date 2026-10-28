-- Stack éphémère exclusivement. Aucune migration ou nouvelle habilitation.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok(exists(select 1 from pg_constraint where conrelid=('public.'||name)::regclass and confrelid='auth.users'::regclass
  and contype='f' and confdeltype='c' and convalidated), 'Cascade Auth validée : '||name)
  from unnest(array['profiles','drill_series','course_states','quiz_attempts','botanical_sessions','botanical_answers','itk_settings','appearance_preferences']) name;
select ok(exists(select 1 from pg_constraint where conrelid=('public.'||child)::regclass and confrelid=('public.'||parent)::regclass
  and contype='f' and confdeltype='c' and convalidated and array_length(conkey,1)>1), 'Cascade composite : '||child)
  from (values ('drill_answers','drill_series'),('drill_training_attempts','drill_answers'),('botanical_answers','botanical_sessions')) edges(child,parent);
select ok(not has_table_privilege('authenticated','public.'||name,'DELETE'), 'Aucun DELETE étudiant : '||name)
  from unnest(array['profiles','drill_series','drill_answers','drill_training_attempts','course_states','quiz_attempts','botanical_sessions','botanical_answers','itk_settings','appearance_preferences']) name;
select ok(not exists(select 1 from pg_trigger where not tgisinternal and tgrelid=('public.'||name)::regclass and (tgtype::integer & 8)=8), 'Aucun guard ne bloque la cascade : '||name)
  from unnest(array['profiles','drill_series','drill_answers','drill_training_attempts','course_states','quiz_attempts','botanical_sessions','botanical_answers','itk_settings','appearance_preferences']) name;

insert into auth.users (id,email) values
  ('64030000-0000-4000-8000-000000000001','closure-a@example.invalid'),
  ('64030000-0000-4000-8000-000000000002','closure-b@example.invalid');
create function pg_temp.refuse_closure() returns trigger language plpgsql as $$
begin
  if old.id='64030000-0000-4000-8000-000000000001' then raise exception 'closure_injected_failure'; end if;
  return old;
end;
$$;
create trigger closure_test_failure before delete on public.profiles for each row execute function pg_temp.refuse_closure();
select throws_ok($$delete from auth.users where id='64030000-0000-4000-8000-000000000001'$$,
  'P0001','closure_injected_failure','Un échec de cascade annule la suppression Auth entière');
select is((select count(*)::integer from auth.users where id='64030000-0000-4000-8000-000000000001'),1,'Auth A reste présent après rollback');
select is((select count(*)::integer from public.profiles where id='64030000-0000-4000-8000-000000000001'),1,'Profil A reste présent après rollback');
drop trigger closure_test_failure on public.profiles;
delete from auth.users where id='64030000-0000-4000-8000-000000000001';
select is((select count(*)::integer from public.profiles where id='64030000-0000-4000-8000-000000000001'),0,'La reprise retire le profil A');
select is((select count(*)::integer from public.profiles where id='64030000-0000-4000-8000-000000000002'),1,'Le profil B reste intact');
select * from finish();
rollback;
