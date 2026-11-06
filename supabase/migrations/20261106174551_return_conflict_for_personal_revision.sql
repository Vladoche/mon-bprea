-- Rendre HTTP 409 pour les deux refus de révision du trigger. PostgREST 14
-- relance les transactions qui lèvent 40001. Les protections CAS restent identiques.
create or replace function bprea_private.guard_personal_mutation()
returns trigger language plpgsql security invoker set search_path='' as $$
declare field text; p jsonb; area_value numeric;
begin
  if auth.uid() is null or new.user_id is distinct from auth.uid() then
    raise exception using errcode='42501',message='personal_owner_forbidden';
  end if;
  if tg_op='INSERT' then
    if new.base_revision is distinct from 0::bigint then
      raise exception using errcode='PT409',message='personal_revision_conflict';
    end if;
    new.revision:=1;
    new.created_at:=pg_catalog.clock_timestamp();
  else
    if new.user_id is distinct from old.user_id or new.created_at is distinct from old.created_at
      or new.schema_version is distinct from old.schema_version or new.revision is distinct from old.revision then
      raise exception using errcode='42501',message='personal_server_fields_protected';
    end if;
    if new.base_revision is distinct from old.revision or new.operation_id=old.operation_id then
      raise exception using errcode='PT409',message='personal_revision_conflict';
    end if;
    new.revision:=old.revision+1;
  end if;
  new.updated_at:=pg_catalog.clock_timestamp();
  if tg_table_name='course_states' and tg_op='UPDATE' then
    if new.lesson_id is distinct from old.lesson_id
      or (old.best_score is not null and (new.best_score is null or new.best_score<old.best_score))
      or (old.legacy_score is not null and (new.legacy_score is distinct from old.legacy_score or new.legacy_total is distinct from old.legacy_total)) then
      raise exception using errcode='23514',message='personal_course_history_protected';
    end if;
  elsif tg_table_name='botanical_sessions' and tg_op='UPDATE' then
    if row(new.session_id,new.category_id,new.mode,new.duration_seconds,new.is_revision,new.started_at,new.total_questions)
      is distinct from row(old.session_id,old.category_id,old.mode,old.duration_seconds,old.is_revision,old.started_at,old.total_questions)
      or (old.completed_at is not null and new.completed_at is distinct from old.completed_at) then
      raise exception using errcode='23514',message='personal_session_history_protected';
    end if;
    if new.completed_at is not null and exists(select 1 from public.botanical_answers
      where user_id=new.user_id and session_id=new.session_id and answered_at>new.completed_at) then
      raise exception using errcode='23514',message='personal_completion_before_answer';
    end if;
  elsif tg_table_name='itk_settings' then
    p:=new.parameters;
    if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>4096 then
      raise exception using errcode='23514',message='personal_itk_invalid';
    end if;
    if (select count(*) from pg_catalog.jsonb_object_keys(p))<>8 or
      not (p ?& array['crop','cover','variety','area','month','year','soil','water']) then
      raise exception using errcode='23514',message='personal_itk_invalid';
    end if;
    foreach field in array array['crop','cover','variety','area','month','year','soil','water'] loop
      if jsonb_typeof(p->field) is distinct from 'string' then
        raise exception using errcode='23514',message='personal_itk_invalid';
      end if;
    end loop;
    if p->>'crop' not in ('tomate','laitue','carotte','courgette') or p->>'cover' not in ('serre','plein')
      or p->>'soil' not in ('leger','limoneux','lourd') or p->>'water' not in ('standard','limitee')
      or char_length(p->>'area')>100 or p->>'area' !~ '^[+-]?([0-9]+(\.[0-9]*)?|\.[0-9]+)([eE][+-]?[0-9]+)?$'
      or p->>'month' !~ '^([1-9]|1[0-2])$' or p->>'year' !~ '^(202[6-9]|203[0-3])$' then
      raise exception using errcode='23514',message='personal_itk_invalid';
    end if;
    begin
      area_value:=(p->>'area')::numeric;
    exception when numeric_value_out_of_range or invalid_text_representation then
      raise exception using errcode='23514',message='personal_itk_invalid';
    end;
    if area_value not between 1 and 100000 or area_value<>pg_catalog.trunc(area_value) then
      raise exception using errcode='23514',message='personal_itk_invalid';
    end if;
    if not ((p->>'crop'='tomate' and p->>'variety' in ('Marmande','Roma','Cœur de bœuf','Autre / non précisée'))
      or (p->>'crop'='laitue' and p->>'variety' in ('Batavia','Feuille de chêne','Laitue pommée','Autre / non précisée'))
      or (p->>'crop'='carotte' and p->>'variety' in ('Nantaise','Touchon','Carotte de conservation','Autre / non précisée'))
      or (p->>'crop'='courgette' and p->>'variety' in ('Black Beauty','Ronde de Nice','Courgette verte (type)','Autre / non précisée'))) then
      raise exception using errcode='23514',message='personal_itk_variety_invalid';
    end if;
  end if;
  return new;
end;
$$;
