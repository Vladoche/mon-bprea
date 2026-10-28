-- Lot 6.5.3.B : métadonnées seulement, aucune ligne Auth/profil/pédagogique.
-- Sélectionner explicitement DEV wcckbyhrtroittbfophv dans l'outil officiel.
-- Ce fichier ne choisit pas de connexion. Ne jamais le brancher sur un runner de tests.
-- Les corps applicatifs sont lus comme texte, jamais exécutés.
-- Comparaison humaine au SQL versionné requise ; des nombres seuls ne valident pas le schéma.
begin transaction read only;

select jsonb_build_object(
'migrations',(select jsonb_agg(jsonb_build_object('version',version,
      'name',name) order by version) from supabase_migrations.schema_migrations),
'routine_inventory',(select jsonb_agg(jsonb_build_object('schema',n.nspname,
      'name',p.proname,
      'arguments',pg_catalog.pg_get_function_identity_arguments(p.oid),
      'owner',pg_catalog.pg_get_userbyid(p.proowner)) order by n.nspname,p.proname,p.oid)
  from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('public','bprea_private') and not exists(select 1
  from pg_catalog.pg_depend d
  where d.classid='pg_catalog.pg_proc'::regclass and d.objid=p.oid and d.deptype='e')),
'private_relations',(select jsonb_agg(jsonb_build_object('name',c.relname,
      'kind',c.relkind))
  from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='bprea_private' and c.relkind in ('r',
      'p',
      'v',
      'm','S','f')),
'other_relations',(select jsonb_agg(jsonb_build_object('schema',n.nspname,
      'name',c.relname,
      'kind',c.relkind))
  from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('S','f')),
 'tables',(select jsonb_agg(jsonb_build_object('schema',n.nspname,
      'name',c.relname,
      'kind',c.relkind,
      'rls',c.relrowsecurity,
      'force_rls',c.relforcerowsecurity,
      'owner',pg_catalog.pg_get_userbyid(c.relowner),
      'acl',c.relacl))
  from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r',
      'p',
      'v','m')),
'columns',(select jsonb_agg(jsonb_build_object('table',c.relname,
      'name',a.attname,
      'position',a.attnum,
      'type',pg_catalog.format_type(a.atttypid,a.atttypmod),
      'notnull',a.attnotnull,
      'generated',a.attgenerated,
      'default',pg_catalog.pg_get_expr(d.adbin,d.adrelid),
      'acl',a.attacl) order by c.relname,a.attnum)
  from pg_catalog.pg_attribute a
    join pg_catalog.pg_class c on c.oid=a.attrelid
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace left
    join pg_catalog.pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
  where n.nspname='public' and c.relkind in ('r','p') and a.attnum>0 and not a.attisdropped),
'constraints',(select jsonb_agg(jsonb_build_object('table',c.relname,
      'name',co.conname,
      'kind',co.contype,
      'validated',co.convalidated,
      'definition',pg_catalog.pg_get_constraintdef(co.oid,true)))
  from pg_catalog.pg_constraint co
    join pg_catalog.pg_class c on c.oid=co.conrelid
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'),
'indexes',(select jsonb_agg(jsonb_build_object('table',c.relname,
      'name',i.relname,
      'valid',ix.indisvalid,
      'ready',ix.indisready,
      'definition',pg_catalog.pg_get_indexdef(i.oid)))
  from pg_catalog.pg_index ix
    join pg_catalog.pg_class c on c.oid=ix.indrelid
    join pg_catalog.pg_class i on i.oid=ix.indexrelid
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'),
'triggers',(select jsonb_agg(jsonb_build_object('schema',n.nspname,
      'table',c.relname,
      'name',t.tgname,
      'enabled',t.tgenabled,
      'definition',pg_catalog.pg_get_triggerdef(t.oid,true)))
  from pg_catalog.pg_trigger t
    join pg_catalog.pg_class c on c.oid=t.tgrelid
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where not t.tgisinternal and (n.nspname='public' or (n.nspname='auth' and c.relname='users' and t.tgname like 'bprea%'))),
'policies',(select jsonb_agg(to_jsonb(p))
  from pg_catalog.pg_policies p
  where p.schemaname='public'),
'schemas',(select jsonb_agg(jsonb_build_object('name',nspname,
      'acl',nspacl))
  from pg_catalog.pg_namespace
  where nspname in ('public','bprea_private')),
'roles',(select jsonb_agg(jsonb_build_object('name',rolname,
      'superuser',rolsuper,
      'inherit',rolinherit,
      'bypassrls',rolbypassrls))
  from pg_catalog.pg_roles
  where rolname in ('anon',
      'authenticated','service_role')),
'memberships',(select jsonb_agg(jsonb_build_object('role',r.rolname,
      'member',m.rolname))
  from pg_catalog.pg_auth_members a
    join pg_catalog.pg_roles r on r.oid=a.roleid
    join pg_catalog.pg_roles m on m.oid=a.member
  where m.rolname in ('anon',
      'authenticated','service_role')),
'functions',(select jsonb_agg(jsonb_build_object('schema',n.nspname,
      'name',p.proname,
      'arguments',pg_catalog.pg_get_function_identity_arguments(p.oid),
      'returns',pg_catalog.pg_get_function_result(p.oid),
      'definer',p.prosecdef,
      'volatility',p.provolatile,
      'language',(select lanname
  from pg_catalog.pg_language
  where oid=p.prolang),
      'kind',p.prokind,
      'strict',p.proisstrict,
      'leakproof',p.proleakproof,
      'parallel',p.proparallel,
      'config',p.proconfig,
      'owner',pg_catalog.pg_get_userbyid(p.proowner),
      'acl',p.proacl,
      'source',p.prosrc))
  from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname='bprea_private' or (n.nspname='public' and (p.proname like 'drill_%' or p.proname like 'personal_%')))
) as audit_metadata;

rollback;
