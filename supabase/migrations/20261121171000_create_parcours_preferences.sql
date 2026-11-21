-- A single private snapshot per Auth identity. Reference catalogues stay outside this table.
create function bprea_private.valid_parcours(p jsonb)
returns boolean language plpgsql immutable strict set search_path = '' as $$
declare
  key text;
  item jsonb;
  iso text;
  parsed date;
begin
  if jsonb_typeof(p) <> 'object' or octet_length(p::text) > 16384
    or not (p ?& array['version','uc1','units','ucare','exams','assignments'])
    or (select count(*) from jsonb_object_keys(p)) <> 6
    or p->'version' is distinct from '1'::jsonb
    or p->>'uc1' is null or p->>'uc1' not in ('unknown','attending','exempt')
    or jsonb_typeof(p->'assignments') <> 'object' then
    return false;
  end if;
  foreach key in array array['units','ucare','exams'] loop
    if jsonb_typeof(p->key) <> 'array' then return false; end if;
    if jsonb_array_length(p->key) > 100 or exists (
      select from jsonb_array_elements(p->key) as row(value)
      group by value having count(*) > 1 or jsonb_typeof(value) <> 'string'
      or (key = 'units' and (value #>> '{}') !~ '^uc[2-5]$')
      or (key = 'exams' and (value #>> '{}') !~ '^(uc[1-5]|ucare[12])$')
      or (key = 'ucare' and (value #>> '{}') !~ '^[a-z0-9][a-z0-9_-]{0,63}$')
    ) then return false; end if;
  end loop;
  for key, item in select * from jsonb_each(p->'assignments') loop
    if key !~ '^(uc[1-5]|ucare[12])$' or jsonb_typeof(item) <> 'object'
      or not (item ?& array['sessionId','personalDate'])
      or (select count(*) from jsonb_object_keys(item)) <> 2
      or jsonb_typeof(item->'sessionId') not in ('string','null')
      or (item->>'sessionId' is not null and item->>'sessionId' !~ '^[a-z0-9][a-z0-9_-]{0,63}$')
      or jsonb_typeof(item->'personalDate') not in ('string','null') then return false; end if;
    iso := item->>'personalDate';
    if iso is not null then
      if iso !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return false; end if;
      parsed := make_date(substring(iso,1,4)::integer,substring(iso,6,2)::integer,substring(iso,9,2)::integer);
      if to_char(parsed,'YYYY-MM-DD') <> iso or substring(iso,1,4) = '0000' then return false; end if;
    end if;
  end loop;
  return true;
exception when datetime_field_overflow or invalid_datetime_format or invalid_parameter_value then
  return false;
end $$;

revoke all on function bprea_private.valid_parcours(jsonb) from public, anon, authenticated, service_role;

create table public.parcours_preferences (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  preferences jsonb not null check (bprea_private.valid_parcours(preferences)),
  operation_id uuid not null,
  base_revision bigint not null check (base_revision between 0 and 9007199254740990),
  revision bigint not null default 1 check (revision = base_revision + 1),
  schema_version integer not null default 1 check (schema_version = 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.parcours_preferences enable row level security;
revoke all on public.parcours_preferences from public, anon, authenticated, service_role;
grant select on public.parcours_preferences to authenticated;
grant insert (preferences,operation_id,base_revision), update (preferences,operation_id,base_revision)
  on public.parcours_preferences to authenticated;
-- Used by the CHECK expression by OID. The private schema remains inaccessible.
grant execute on function bprea_private.valid_parcours(jsonb) to authenticated;
create trigger parcours_preferences_guard before insert or update on public.parcours_preferences
  for each row execute function bprea_private.guard_personal_mutation();

create policy parcours_select_own on public.parcours_preferences for select to authenticated
  using (user_id = (select auth.uid()));
create policy parcours_insert_own on public.parcours_preferences for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy parcours_update_own on public.parcours_preferences for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Match the existing personal RPCs: invoker, owner-only RLS, protected columns
-- and a revision guard even for direct writes. The row lock serializes saves.
create function public.personal_save_parcours(p_user_id uuid, p_preferences jsonb,
  p_operation_id uuid, p_expected_revision bigint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  actor uuid := auth.uid();
  saved public.parcours_preferences;
begin
  if actor is null or actor is distinct from p_user_id or auth.role() is distinct from 'authenticated' then
    raise exception using errcode = '42501', message = 'parcours_owner_required';
  end if;
  if p_operation_id is null or p_expected_revision is null
    or p_expected_revision not between 0 and 9007199254740990 then
    raise exception using errcode = '23514', message = 'parcours_invalid';
  end if;

  if p_expected_revision = 0 then
    insert into public.parcours_preferences (preferences, operation_id, base_revision)
      values (p_preferences, p_operation_id, p_expected_revision)
      on conflict (user_id) do nothing returning * into saved;
    if found then return jsonb_build_object('status','saved','row',to_jsonb(saved)); end if;
  end if;

  select * into saved from public.parcours_preferences where user_id = actor for update;
  if found then
    if saved.operation_id = p_operation_id and saved.revision = p_expected_revision + 1
      and saved.preferences = p_preferences then
      return jsonb_build_object('status','saved','row',to_jsonb(saved));
    end if;
    if saved.revision = p_expected_revision and saved.operation_id <> p_operation_id then
      update public.parcours_preferences set preferences = p_preferences, operation_id = p_operation_id,
        base_revision = p_expected_revision
        where user_id = actor returning * into saved;
      return jsonb_build_object('status','saved','row',to_jsonb(saved));
    end if;
    return jsonb_build_object('status','conflict','row',to_jsonb(saved));
  end if;
  return jsonb_build_object('status','conflict','row',null);
end $$;

revoke all on function public.personal_save_parcours(uuid,jsonb,uuid,bigint) from public, anon, authenticated, service_role;
grant execute on function public.personal_save_parcours(uuid,jsonb,uuid,bigint) to authenticated;
comment on table public.parcours_preferences is 'Préférences individuelles de formation et d’examen, sans référentiel officiel.';
