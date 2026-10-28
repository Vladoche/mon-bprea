-- Lot 6.5.3.B : privilèges effectifs via fonctions PostgreSQL intégrées uniquement.
-- Vérifier la référence DEV wcckbyhrtroittbfophv avant usage ; aucun ciblage implicite.
-- Aucun SET ROLE, RPC métier, DDL/DML, pg_authid ni valeur de secret.
-- MAINTAIN requiert PostgreSQL 17, comme supabase/config.toml et DEV observé.
begin transaction read only;

select jsonb_build_object(
'table_privileges',(select jsonb_agg(jsonb_build_object('table',c.relname,
      'role',r.role,
      'select',pg_catalog.has_table_privilege(r.role,c.oid,'SELECT'),
      'insert_table',pg_catalog.has_table_privilege(r.role,c.oid,'INSERT'),
      'update_table',pg_catalog.has_table_privilege(r.role,c.oid,'UPDATE'),
      'delete',pg_catalog.has_table_privilege(r.role,c.oid,'DELETE'),
      'references',pg_catalog.has_table_privilege(r.role,c.oid,'REFERENCES'),
      'maintain',pg_catalog.has_table_privilege(r.role,c.oid,'MAINTAIN'),
      'truncate',pg_catalog.has_table_privilege(r.role,c.oid,'TRUNCATE'),
      'trigger',pg_catalog.has_table_privilege(r.role,c.oid,'TRIGGER')))
  from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace cross join (values ('anon'),('authenticated'),('service_role')) r(role)
  where n.nspname='public' and c.relkind='r'),
'column_privileges',(select jsonb_agg(jsonb_build_object('table',c.relname,
      'column',a.attname,
      'role',r.role,
      'select',pg_catalog.has_column_privilege(r.role,c.oid,a.attnum,'SELECT'),
      'references',pg_catalog.has_column_privilege(r.role,c.oid,a.attnum,'REFERENCES'),
      'insert',pg_catalog.has_column_privilege(r.role,c.oid,a.attnum,'INSERT'),
      'update',pg_catalog.has_column_privilege(r.role,c.oid,a.attnum,'UPDATE')))
  from pg_catalog.pg_attribute a
    join pg_catalog.pg_class c on c.oid=a.attrelid
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace cross join (values ('anon'),('authenticated'),('service_role')) r(role)
  where n.nspname='public' and c.relkind='r' and a.attnum>0 and not a.attisdropped),
'function_privileges',(select jsonb_agg(jsonb_build_object('schema',n.nspname,
      'name',p.proname,
      'arguments',pg_catalog.pg_get_function_identity_arguments(p.oid),
      'role',r.role,
      'execute',pg_catalog.has_function_privilege(r.role,p.oid,'EXECUTE')))
  from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid=p.pronamespace cross join (values ('anon'),('authenticated'),('service_role')) r(role)
  where n.nspname='bprea_private' or (n.nspname='public' and (p.proname like 'drill_%' or p.proname like 'personal_%'))),
'schema_privileges',(select jsonb_agg(jsonb_build_object('schema',n.nspname,
      'role',r.role,
      'usage',pg_catalog.has_schema_privilege(r.role,n.oid,'USAGE'),
      'create',pg_catalog.has_schema_privilege(r.role,n.oid,'CREATE')))
  from pg_catalog.pg_namespace n cross join (values ('anon'),('authenticated'),('service_role')) r(role)
  where n.nspname in ('public','bprea_private')),
'default_acl',(select jsonb_agg(jsonb_build_object('schema',n.nspname,
      'owner',pg_catalog.pg_get_userbyid(a.defaclrole),
      'type',a.defaclobjtype,
      'acl',a.defaclacl))
  from pg_catalog.pg_default_acl a left
    join pg_catalog.pg_namespace n on n.oid=a.defaclnamespace
  where n.nspname='public' or a.defaclnamespace=0),
'extensions',(select jsonb_agg(jsonb_build_object('name',extname,
      'version',extversion))
  from pg_catalog.pg_extension)
) as audit_privileges;

rollback;
