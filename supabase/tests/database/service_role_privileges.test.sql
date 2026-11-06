-- Contrat de moindre privilège après le lot 6.6.0.C.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(27);

select ok(not has_table_privilege('service_role', 'public.' || name,
    'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
  and not has_any_column_privilege('service_role', 'public.' || name,
    'SELECT,INSERT,UPDATE,REFERENCES'), 'Pas de droits de table ou de colonne : ' || name)
from (values ('profiles'), ('drill_series'), ('drill_answers'), ('drill_training_attempts'),
  ('course_states'), ('quiz_attempts'), ('botanical_sessions'), ('botanical_answers'),
  ('itk_settings'), ('appearance_preferences')) as tables(name);

select ok(not has_function_privilege('service_role', p.oid, 'EXECUTE'),
  'Pas de droit EXECUTE : ' || n.nspname || '.' || p.proname)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'bprea_private'
  or (n.nspname = 'public' and p.proname in (
    'drill_create_series', 'drill_record_answer', 'drill_record_training',
    'personal_save_course', 'personal_record_quiz', 'personal_save_botanical_session',
    'personal_record_botanical_answer', 'personal_save_itk', 'personal_save_appearance'))
order by n.nspname, p.proname;

select ok(not has_schema_privilege('service_role', 'bprea_private', 'USAGE,CREATE'),
  'Aucun droit sur le schéma privé');

set local role postgres;
create table public.bprea_acl_probe (id uuid);
reset role;
select ok(not has_table_privilege('service_role', 'public.bprea_acl_probe',
    'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
  and not has_any_column_privilege('service_role', 'public.bprea_acl_probe',
    'SELECT,INSERT,UPDATE,REFERENCES'), 'Les futures tables de postgres ne donnent pas de droit automatique');

select * from finish();
rollback;
