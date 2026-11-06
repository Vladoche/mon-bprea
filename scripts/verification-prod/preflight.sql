-- Mon BPREA PROD. Confirmer la cible hors SQL avant connexion.
-- Exécuter dans une session dédiée fermée à la fin de la requête. Le résultat
-- doit être le dernier ordre pour le connecteur de diagnostic Supabase.
-- Conserver le résultat dans le dossier opérateur privé.
begin transaction isolation level repeatable read read only;
set local statement_timeout = '15s';
set local lock_timeout = '2s';
set local search_path = pg_catalog;

with relevant_roles as (
  select oid, rolname, rolsuper, rolbypassrls, rolinherit, rolcanlogin
  from pg_roles
  where rolname in ('postgres', 'supabase_admin', 'supabase_auth_admin',
    'authenticator', 'anon', 'authenticated', 'service_role')
), relevant_namespaces as (
  select oid, nspname, nspowner, nspacl
  from pg_namespace where nspname in ('public', 'auth', 'bprea_private', 'supabase_migrations')
), default_acl as (
  select r.rolname as creator, coalesce(n.nspname, '(global)') as schema,
    d.defaclobjtype as kind, d.defaclacl as acl
  from pg_default_acl d
  join relevant_roles r on r.oid = d.defaclrole
  left join pg_namespace n on n.oid = d.defaclnamespace
  where r.rolname in ('postgres', 'supabase_admin', 'supabase_auth_admin')
), scope_relations as (
  select c.oid, n.nspname as schema, c.relname as name, c.relkind as kind,
    pg_get_userbyid(c.relowner) as owner, c.relrowsecurity as rls
  from pg_class c join relevant_namespaces n on n.oid = c.relnamespace
  where n.nspname in ('public', 'bprea_private', 'supabase_migrations')
    or c.oid = 'auth.users'::regclass
), scope_functions as (
  select n.nspname as schema, p.proname as name, oidvectortypes(p.proargtypes) as arguments,
    pg_get_userbyid(p.proowner) as owner, p.prosecdef as security_definer
  from pg_proc p join relevant_namespaces n on n.oid = p.pronamespace
  where n.nspname in ('public', 'bprea_private', 'supabase_migrations')
    or p.oid = to_regprocedure('auth.uid()')
), creation_paths as (
  select r.rolname as role,
    has_database_privilege(r.oid, current_database(), 'CREATE') as create_schema,
    has_schema_privilege(r.oid, 'public', 'CREATE') as create_public,
    has_schema_privilege(r.oid, 'public', 'USAGE') as usage_public,
    has_schema_privilege(r.oid, 'auth', 'USAGE') as usage_auth,
    has_table_privilege(r.oid, 'auth.users', 'SELECT') as select_users,
    has_column_privilege(r.oid, 'auth.users', 'id', 'REFERENCES') as references_users_id,
    has_table_privilege(r.oid, 'auth.users', 'TRIGGER') as trigger_users,
    has_function_privilege(r.oid, to_regprocedure('auth.uid()'), 'EXECUTE') as execute_uid
  from relevant_roles r
)
select jsonb_build_object(
  'connection', (select to_jsonb(c) from (select statement_timestamp() as observed_at,
    current_database() as database, session_user, current_user, inet_server_addr() as address,
    inet_server_port() as port, current_setting('server_version') as version,
    current_setting('transaction_read_only') as read_only, ssl, version as tls_version, cipher
    from pg_stat_ssl where pid = pg_backend_pid()) c),
  'schemas', (select jsonb_agg(nspname order by nspname) from pg_namespace),
  'schema_acl', (select jsonb_agg(jsonb_build_object('schema', nspname,
    'owner', pg_get_userbyid(nspowner), 'acl', coalesce(nspacl, acldefault('n', nspowner))) order by nspname)
    from relevant_namespaces),
  'default_acl', (select jsonb_agg(to_jsonb(d) order by creator, schema, kind) from default_acl d),
  'roles', (select jsonb_agg(to_jsonb(r) - 'oid' order by rolname) from relevant_roles r),
  'memberships', (select jsonb_agg(to_jsonb(m) order by member, granted_role) from (
    select pg_get_userbyid(a.member) as member, pg_get_userbyid(a.roleid) as granted_role,
      pg_get_userbyid(a.grantor) as grantor, a.inherit_option, a.set_option, a.admin_option
    from pg_auth_members a
    where a.member in (select oid from relevant_roles) or a.roleid in (select oid from relevant_roles)
      or pg_has_role('service_role', a.member, 'MEMBER')
  ) m),
  'service_role_paths', (select jsonb_agg(jsonb_build_object('role', rolname,
    'inherit', pg_has_role('service_role', oid, 'USAGE'), 'set', pg_has_role('service_role', oid, 'SET')) order by rolname)
    from pg_roles where oid <> 'service_role'::regrole and pg_has_role('service_role', oid, 'MEMBER')),
  'creation_paths', (select jsonb_agg(to_jsonb(p) order by role) from creation_paths p),
  'event_triggers', (select jsonb_agg(jsonb_build_object('name', e.evtname,
    'event', e.evtevent, 'enabled', e.evtenabled, 'tags', e.evttags, 'owner', pg_get_userbyid(e.evtowner),
    'function', format('%I.%I', n.nspname, p.proname), 'security_definer', p.prosecdef,
    'definition_sha256', encode(sha256(convert_to(pg_get_functiondef(p.oid), 'UTF8')), 'hex')) order by e.evtname)
    from pg_event_trigger e join pg_proc p on p.oid = e.evtfoid join pg_namespace n on n.oid = p.pronamespace),
  'relations', (select jsonb_agg(to_jsonb(r) - 'oid' order by schema, name) from scope_relations r),
  'types', (select jsonb_agg(jsonb_build_object('schema', n.nspname, 'name', t.typname, 'kind', t.typtype)
    order by n.nspname, t.typname) from pg_type t join relevant_namespaces n on n.oid = t.typnamespace
    where n.nspname in ('public', 'bprea_private', 'supabase_migrations')),
  'functions', (select jsonb_agg(to_jsonb(f) order by schema, name, arguments) from scope_functions f),
  'policies', (select jsonb_agg(jsonb_build_object('table', r.name, 'name', p.polname) order by r.schema, r.name, p.polname)
    from pg_policy p join scope_relations r on r.oid = p.polrelid),
  'triggers', (select jsonb_agg(jsonb_build_object('schema', r.schema, 'table', r.name, 'name', t.tgname,
    'enabled', t.tgenabled, 'function', format('%I.%I', n.nspname, p.proname)) order by r.schema, r.name, t.tgname)
    from pg_trigger t join scope_relations r on r.oid = t.tgrelid join pg_proc p on p.oid = t.tgfoid
    join pg_namespace n on n.oid = p.pronamespace where not t.tgisinternal),
  'ledger', to_regclass('supabase_migrations.schema_migrations')::text,
  'auth', jsonb_build_object('users', (select count(*) from auth.users),
    'identities', (select count(*) from auth.identities), 'sessions', (select count(*) from auth.sessions),
    'users_rls_applies_to_current_role', row_security_active('auth.users'),
    'users_id', (select jsonb_build_object('type', format_type(atttypid, atttypmod), 'not_null', attnotnull)
      from pg_attribute where attrelid = 'auth.users'::regclass and attname = 'id' and not attisdropped),
    'users_primary_key', (select pg_get_constraintdef(oid) from pg_constraint
      where conrelid = 'auth.users'::regclass and contype = 'p'),
    'users_owner', (select pg_get_userbyid(relowner) from pg_class where oid = 'auth.users'::regclass),
    'users_acl', (select coalesce(relacl, acldefault('r', relowner)) from pg_class where oid = 'auth.users'::regclass)),
  'dependencies', jsonb_build_object('gen_random_uuid', to_regprocedure('pg_catalog.gen_random_uuid()')::text,
    'plpgsql', (select lanpltrusted from pg_language where lanname = 'plpgsql'),
    'extensions', (select jsonb_object_agg(extname, extversion) from pg_extension)),
  'postgrest_db_settings', (select jsonb_agg(jsonb_build_object('database', coalesce(d.datname, '(all)'), 'setting', config))
    from pg_db_role_setting s left join pg_database d on d.oid = s.setdatabase
    cross join lateral unnest(s.setconfig) as settings(config)
    where s.setrole = to_regrole('authenticator') and (s.setdatabase = 0 or d.datname = current_database())
      and split_part(config, '=', 1) in ('pgrst.db_schemas', 'pgrst.db_extra_search_path', 'pgrst.db_anon_role', 'pgrst.db_pre_config')),
  'auth_locks', (select jsonb_object_agg(mode || '/' || granted, lock_count) from (
    select mode, granted, count(*) as lock_count from pg_locks
    where relation = 'auth.users'::regclass and pid is distinct from pg_backend_pid() group by mode, granted
  ) l)
) as preflight;
