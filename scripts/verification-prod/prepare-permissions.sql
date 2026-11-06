-- Étape avant M1 pour une première installation. Requiert psql -X -v ON_ERROR_STOP=1.
-- Le runbook impose une connexion contrôlée et un gel des autres migrations.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
begin
  if current_user <> 'postgres' then
    raise exception 'La préparation des ACL exige le rôle de création postgres';
  end if;
end;
$$;

-- Même contrat que la migration corrective. Seuls les futurs objets de type
-- TABLE de postgres sont concernés par ces deux instructions.
alter default privileges for role postgres
  revoke all privileges on tables from service_role;
alter default privileges for role postgres in schema public
  revoke all privileges on tables from service_role;

-- Une table créée sous le rôle réel révèle aussi les droits de PUBLIC et
-- les droits hérités. Le témoin n'est visible dans aucune autre transaction.
create table public.bprea_acl_probe (id uuid);
do $$
begin
  if pg_catalog.has_table_privilege('service_role', 'public.bprea_acl_probe',
       'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
     or pg_catalog.has_any_column_privilege('service_role', 'public.bprea_acl_probe',
       'SELECT,INSERT,UPDATE,REFERENCES') then
    raise exception 'service_role conserve des droits effectifs sur une nouvelle table public';
  end if;
end;
$$;
drop table public.bprea_acl_probe;
commit;
