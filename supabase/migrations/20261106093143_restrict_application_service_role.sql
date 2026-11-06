-- Les migrations applicatives sont exécutées sous postgres.
-- Les ACL globales et celles de public sont additives.
alter default privileges for role postgres
  revoke all privileges on tables from service_role;
alter default privileges for role postgres in schema public
  revoke all privileges on tables from service_role;

-- Les six tables personnelles et les neuf RPC ont déjà leur REVOKE explicite.
revoke all privileges on table public.profiles, public.drill_series,
  public.drill_answers, public.drill_training_attempts from service_role;
revoke all privileges on schema bprea_private from service_role;

-- Un grant hérité ou provenant d'un autre rôle ne doit pas passer pour un retrait réussi.
do $$
declare
  relation regclass;
begin
  foreach relation in array array[
    'public.profiles'::regclass, 'public.drill_series'::regclass,
    'public.drill_answers'::regclass, 'public.drill_training_attempts'::regclass,
    'public.course_states'::regclass, 'public.quiz_attempts'::regclass,
    'public.botanical_sessions'::regclass, 'public.botanical_answers'::regclass,
    'public.itk_settings'::regclass, 'public.appearance_preferences'::regclass
  ] loop
    if pg_catalog.has_table_privilege('service_role', relation,
         'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
       or pg_catalog.has_any_column_privilege('service_role', relation,
         'SELECT,INSERT,UPDATE,REFERENCES') then
      raise exception 'service_role conserve des droits effectifs sur %', relation;
    end if;
  end loop;
  if pg_catalog.has_schema_privilege('service_role', 'bprea_private', 'USAGE,CREATE') then
    raise exception 'service_role conserve des droits effectifs sur bprea_private';
  end if;
end;
$$;
