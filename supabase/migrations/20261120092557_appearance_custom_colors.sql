-- Additive defaults preserve existing rows, revisions and queued operations.
alter table public.appearance_preferences
  add column color_mode text not null default 'seasonal',
  add column custom_color text,
  add constraint appearance_color_valid check (
    color_mode in ('seasonal','custom')
    and (custom_color is null or custom_color ~ '^#[0-9a-f]{6}$')
    and (color_mode='seasonal' or custom_color is not null)
  );

grant insert (color_mode,custom_color) on public.appearance_preferences to authenticated;
grant update (color_mode,custom_color) on public.appearance_preferences to authenticated;

comment on table public.appearance_preferences is
  'Choix personnels de saison, luminosité et couleurs ; rendu calculé sur chaque appareil.';

create or replace function public.personal_save_appearance(p_preferences jsonb,p_operation_id uuid,p_expected_revision bigint)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare
  saved public.appearance_preferences;
  v_season text;
  v_brightness text;
  v_client_updated_at timestamptz;
  v_color_mode text;
  v_custom_color text;
  v_chromatic boolean;
  v_hidden_columns text[];
begin
  if auth.uid() is null then raise exception using errcode='42501',message='personal_auth_required'; end if;
  if p_operation_id is null or p_operation_id='00000000-0000-0000-0000-000000000000'::uuid
    or p_expected_revision is null or p_expected_revision not between 0 and 9007199254740990 then
    raise exception using errcode='23514',message='personal_operation_invalid';
  end if;
  if jsonb_typeof(p_preferences) is distinct from 'object' or octet_length(p_preferences::text)>4096 then
    raise exception using errcode='23514',message='personal_payload_invalid';
  end if;
  if not (p_preferences ?& array['version','season','brightness']) or
    exists(select 1 from pg_catalog.jsonb_object_keys(p_preferences) k where not (k=any(array['version','season','brightness','updatedAt','colorMode','customColor']))) then
    raise exception using errcode='23514',message='personal_payload_fields_invalid';
  end if;
  if jsonb_typeof(p_preferences->'season') is distinct from 'string' then
    raise exception using errcode='23514',message='personal_payload_type_invalid';
  end if;
  if jsonb_typeof(p_preferences->'brightness') is distinct from 'string' then
    raise exception using errcode='23514',message='personal_payload_type_invalid';
  end if;
  if p_preferences->'version' is distinct from '1'::jsonb then
    raise exception using errcode='23514',message='personal_schema_invalid';
  end if;
  if p_preferences ? 'updatedAt' and p_preferences->'updatedAt'<>'null'::jsonb then
    if jsonb_typeof(p_preferences->'updatedAt') is distinct from 'string' or p_preferences->>'updatedAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?Z$' then
      raise exception using errcode='23514',message='personal_timestamp_invalid';
    end if;
    begin
      if not isfinite((p_preferences->>'updatedAt')::timestamptz) or (p_preferences->>'updatedAt')::timestamptz < '0001-01-01 UTC'::timestamptz
        or (p_preferences->>'updatedAt')::timestamptz >= '10000-01-01 UTC'::timestamptz
        or pg_catalog.to_char((p_preferences->>'updatedAt')::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS')<>left(p_preferences->>'updatedAt',19) then
        raise exception using errcode='23514',message='personal_timestamp_invalid';
      end if;
    exception when datetime_field_overflow or invalid_datetime_format then
      raise exception using errcode='23514',message='personal_timestamp_invalid';
    end;
  end if;
  v_season:=p_preferences->>'season'; v_brightness:=p_preferences->>'brightness';
  v_client_updated_at:=(p_preferences->>'updatedAt')::timestamptz;

  v_chromatic:=p_preferences ?| array['colorMode','customColor'];
  v_color_mode:=p_preferences->>'colorMode';
  v_custom_color:=p_preferences->>'customColor';
  if v_chromatic and (
    not (p_preferences ?& array['colorMode','customColor']) or
    jsonb_typeof(p_preferences->'colorMode') is distinct from 'string' or
    v_color_mode not in ('seasonal','custom') or
    jsonb_typeof(p_preferences->'customColor') not in ('null','string') or
    (v_custom_color is null and v_color_mode='custom') or
    (v_custom_color is not null and v_custom_color !~ '^#[0-9a-f]{6}$')
  ) then
    raise exception using errcode='23514',message='personal_color_invalid';
  end if;
  -- Previously queued calls keep their original arguments and row shape.
  v_hidden_columns:=case when v_chromatic then array[]::text[] else array['color_mode','custom_color'] end;

  select * into saved from public.appearance_preferences where user_id=auth.uid() for update;
  if found then
    if saved.operation_id=p_operation_id then
      return pg_catalog.jsonb_build_object('status',case when saved.base_revision=p_expected_revision and saved.season is not distinct from v_season and saved.brightness is not distinct from v_brightness and saved.client_updated_at is not distinct from v_client_updated_at
        and (not v_chromatic or (saved.color_mode,saved.custom_color) is not distinct from (v_color_mode,v_custom_color)) then 'replayed' else 'conflict' end,'row',pg_catalog.to_jsonb(saved)-v_hidden_columns);
    end if;
    if saved.revision<>p_expected_revision then
      return pg_catalog.jsonb_build_object('status','conflict','row',pg_catalog.to_jsonb(saved)-v_hidden_columns);
    end if;

    begin
      update public.appearance_preferences set season=v_season,brightness=v_brightness,client_updated_at=v_client_updated_at,
        color_mode=case when v_chromatic then v_color_mode else saved.color_mode end,
        custom_color=case when v_chromatic then v_custom_color else saved.custom_color end,
        operation_id=p_operation_id,base_revision=p_expected_revision
        where user_id=auth.uid() returning * into saved;
    exception when unique_violation then
      return pg_catalog.jsonb_build_object('status','conflict','row',pg_catalog.to_jsonb(saved)-v_hidden_columns);
    end;
    return pg_catalog.jsonb_build_object('status','updated','row',pg_catalog.to_jsonb(saved)-v_hidden_columns);
  end if;
  if p_expected_revision<>0 then return pg_catalog.jsonb_build_object('status','conflict','row',null); end if;
  insert into public.appearance_preferences(season,brightness,client_updated_at,color_mode,custom_color,operation_id,base_revision)
    values(v_season,v_brightness,v_client_updated_at,coalesce(v_color_mode,'seasonal'),v_custom_color,p_operation_id,p_expected_revision) on conflict do nothing returning * into saved;
  if found then return pg_catalog.jsonb_build_object('status','inserted','row',pg_catalog.to_jsonb(saved)-v_hidden_columns); end if;
  -- Une course de création peut attendre le gagnant ; nouvelle commande en
  -- READ COMMITTED pour voir son commit, sans UPDATE de contournement.
  select * into saved from public.appearance_preferences where user_id=auth.uid() for update;
  if not found then return pg_catalog.jsonb_build_object('status','conflict','row',null); end if;
  return pg_catalog.jsonb_build_object('status',case when saved.operation_id=p_operation_id and saved.base_revision=p_expected_revision and saved.season is not distinct from v_season and saved.brightness is not distinct from v_brightness and saved.client_updated_at is not distinct from v_client_updated_at
        and (not v_chromatic or (saved.color_mode,saved.custom_color) is not distinct from (v_color_mode,v_custom_color))
    then 'replayed' else 'conflict' end,'row',pg_catalog.to_jsonb(saved)-v_hidden_columns);
end;
$$;
