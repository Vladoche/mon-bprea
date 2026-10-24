-- Lot 6.2.1 : stockage privé append-only. Aucun changement Auth ou frontend.
begin;

create table public.drill_series (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  unit text not null,
  week text not null,
  series_key text generated always as (unit || '__' || week) stored,
  started_at timestamptz not null,
  questions jsonb not null,
  schema_version integer not null default 1,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint drill_series_owner_id_key unique (user_id, id),
  constraint drill_series_business_key unique (user_id, unit, week),
  constraint drill_series_unit_check check (unit in ('uc1','uc2','uc3','uc4','uc5','ucare1','ucare2')),
  constraint drill_series_week_check check (week ~ '^[0-9]{4}-W(0[1-9]|[1-4][0-9]|5[0-3])$' and left(week,4) <> '0000'),
  constraint drill_series_schema_check check (schema_version = 1),
  constraint drill_series_started_check check (isfinite(started_at) and started_at >= '0001-01-01 UTC'::timestamptz and started_at < '10000-01-01 UTC'::timestamptz),
  constraint drill_series_created_check check (isfinite(created_at)),
  constraint drill_series_questions_check check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) = 10 and octet_length(questions::text) <= 524288)
);

create table public.drill_answers (
  user_id uuid not null default auth.uid(),
  operation_id uuid not null,
  series_id uuid not null,
  question_id text not null,
  answer text not null,
  correct boolean not null default false,
  answered_at timestamptz not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key (user_id, operation_id),
  constraint drill_answers_first_key unique (user_id, series_id, question_id),
  constraint drill_answers_series_fkey foreign key (user_id, series_id) references public.drill_series(user_id,id) on delete cascade,
  constraint drill_answers_operation_check check (operation_id <> '00000000-0000-0000-0000-000000000000'::uuid),
  constraint drill_answers_question_check check (question_id ~ '^[a-z0-9][a-z0-9-]{0,199}$'),
  constraint drill_answers_answer_check check (answer ~ '^[a-z0-9][a-z0-9-]{0,199}$'),
  constraint drill_answers_answered_check check (isfinite(answered_at) and answered_at >= '0001-01-01 UTC'::timestamptz and answered_at < '10000-01-01 UTC'::timestamptz),
  constraint drill_answers_created_check check (isfinite(created_at))
);

create table public.drill_training_attempts (
  user_id uuid not null default auth.uid(),
  operation_id uuid not null,
  series_id uuid not null,
  question_id text not null,
  answer text not null,
  correct boolean not null default false,
  answered_at timestamptz not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key (user_id, operation_id),
  constraint drill_training_answer_fkey foreign key (user_id,series_id,question_id) references public.drill_answers(user_id,series_id,question_id) on delete cascade,
  constraint drill_training_operation_check check (operation_id <> '00000000-0000-0000-0000-000000000000'::uuid),
  constraint drill_training_question_check check (question_id ~ '^[a-z0-9][a-z0-9-]{0,199}$'),
  constraint drill_training_answer_check check (answer ~ '^[a-z0-9][a-z0-9-]{0,199}$'),
  constraint drill_training_answered_check check (isfinite(answered_at) and answered_at >= '0001-01-01 UTC'::timestamptz and answered_at < '10000-01-01 UTC'::timestamptz),
  constraint drill_training_created_check check (isfinite(created_at))
);

-- Les clés existantes couvrent user_id/RLS et les FK, sauf l'historique training.
create index drill_training_history_idx on public.drill_training_attempts(user_id,series_id,question_id,created_at,operation_id);
create index drill_answers_activity_idx on public.drill_answers(user_id,answered_at,series_id,question_id);

alter table public.drill_series enable row level security;
alter table public.drill_answers enable row level security;
alter table public.drill_training_attempts enable row level security;
revoke all on public.drill_series, public.drill_answers, public.drill_training_attempts from public,anon,authenticated;
grant select on public.drill_series, public.drill_answers, public.drill_training_attempts to authenticated;
grant insert (unit,week,started_at,questions) on public.drill_series to authenticated;
grant insert (operation_id,series_id,question_id,answer,answered_at) on public.drill_answers, public.drill_training_attempts to authenticated;

create policy drill_series_select_own on public.drill_series for select to authenticated using ((select auth.uid()) = user_id);
create policy drill_series_insert_own on public.drill_series for insert to authenticated with check ((select auth.uid()) = user_id);
create policy drill_answers_select_own on public.drill_answers for select to authenticated using ((select auth.uid()) = user_id);
create policy drill_answers_insert_own on public.drill_answers for insert to authenticated with check ((select auth.uid()) = user_id);
create policy drill_training_select_own on public.drill_training_attempts for select to authenticated using ((select auth.uid()) = user_id);
create policy drill_training_insert_own on public.drill_training_attempts for insert to authenticated with check ((select auth.uid()) = user_id);

-- Trigger invoker : pas de USAGE/EXECUTE étudiant sur le schéma privé.
-- Les INSERT directs sont validés autant que les RPC. Aucun helper definer.
create function bprea_private.guard_drill_series()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  q jsonb; o jsonb; field text; ids text[] := '{}'; option_ids text[];
  monday date; ref jsonb; port_match text[];
  trim_chars constant text := U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
begin
  if tg_op <> 'INSERT' then
    raise exception using errcode='42501', message='drill_series_immutable';
  end if;
  if auth.uid() is null or new.user_id is distinct from auth.uid() then
    raise exception using errcode='42501', message='drill_owner_forbidden';
  end if;
  if new.week is null or new.week !~ '^[0-9]{4}-W(0[1-9]|[1-4][0-9]|5[0-3])$' or left(new.week,4)='0000' then
    raise exception using errcode='23514', message='drill_week_invalid';
  end if;
  monday := pg_catalog.to_date(new.week || '-1', 'IYYY-"W"IW-ID');
  if pg_catalog.to_char(monday, 'IYYY-"W"IW') <> new.week then
    raise exception using errcode='23514', message='drill_week_invalid';
  end if;
  if jsonb_typeof(new.questions) is distinct from 'array' then
    raise exception using errcode='23514', message='drill_snapshot_invalid';
  end if;
  if jsonb_array_length(new.questions) <> 10 or octet_length(new.questions::text)>524288 then
    raise exception using errcode='23514', message='drill_snapshot_invalid';
  end if;
  for q in select value from pg_catalog.jsonb_array_elements(new.questions) loop
    if jsonb_typeof(q) is distinct from 'object' or jsonb_typeof(q->'id') is distinct from 'string'
       or (q->>'id') !~ '^[a-z0-9][a-z0-9-]{0,199}$' or (q->>'id') = any(ids)
       or jsonb_typeof(q->'unit') is distinct from 'string' or q->>'unit' is distinct from new.unit
       or q->>'type' is distinct from 'single-choice' or jsonb_typeof(q->'version') is distinct from 'number' then
      raise exception using errcode='23514', message='drill_question_invalid';
    end if;
    if (q->>'version')::numeric <> pg_catalog.trunc((q->>'version')::numeric)
       or (q->>'version')::numeric not between 1 and 9007199254740991 then
      raise exception using errcode='23514', message='drill_question_version_invalid';
    end if;
    ids := pg_catalog.array_append(ids,q->>'id');
    foreach field in array array['chapter','concept','prompt','explanation','difficulty'] loop
      if jsonb_typeof(q->field) is distinct from 'string' or char_length(q->>field) not between 1 and 10000
         or char_length(pg_catalog.btrim(q->>field,trim_chars))=0 then
        raise exception using errcode='23514', message='drill_question_text_invalid';
      end if;
    end loop;
    if jsonb_typeof(q->'options') is distinct from 'array' then
      raise exception using errcode='23514', message='drill_options_invalid';
    end if;
    if jsonb_array_length(q->'options') not between 2 and 20 then
      raise exception using errcode='23514', message='drill_options_invalid';
    end if;
    option_ids := '{}';
    for o in select value from pg_catalog.jsonb_array_elements(q->'options') loop
      if jsonb_typeof(o) is distinct from 'object' or jsonb_typeof(o->'id') is distinct from 'string'
         or (o->>'id') !~ '^[a-z0-9][a-z0-9-]{0,199}$' or (o->>'id') = any(option_ids)
         or jsonb_typeof(o->'text') is distinct from 'string' or char_length(o->>'text') not between 1 and 10000
         or char_length(pg_catalog.btrim(o->>'text',trim_chars))=0 then
        raise exception using errcode='23514', message='drill_option_invalid';
      end if;
      option_ids := pg_catalog.array_append(option_ids,o->>'id');
    end loop;
    if jsonb_typeof(q->'answer') is distinct from 'string' or not (q->>'answer' = any(option_ids)) then
      raise exception using errcode='23514', message='drill_correct_option_invalid';
    end if;
    if q ? 'sourceLesson' then
      if jsonb_typeof(q->'sourceLesson') is distinct from 'string' or (q->>'sourceLesson') !~ '^[a-z0-9][a-z0-9-]{0,199}$' then
        raise exception using errcode='23514', message='drill_source_invalid';
      end if;
    end if;
    if q ? 'sourceQuestionIndex' then
      if jsonb_typeof(q->'sourceQuestionIndex') is distinct from 'number' then
        raise exception using errcode='23514', message='drill_source_invalid';
      end if;
      if (q->>'sourceQuestionIndex')::numeric <> pg_catalog.trunc((q->>'sourceQuestionIndex')::numeric)
         or (q->>'sourceQuestionIndex')::numeric not between 0 and 9007199254740991 then
        raise exception using errcode='23514', message='drill_source_invalid';
      end if;
    end if;
    if q ? 'reference' then
      ref := q->'reference';
      if jsonb_typeof(ref) is distinct from 'object' or jsonb_typeof(ref->'title') is distinct from 'string'
         or char_length(ref->>'title') not between 1 and 10000 or char_length(pg_catalog.btrim(ref->>'title',trim_chars))=0
         or jsonb_typeof(ref->'url') is distinct from 'string' then
        raise exception using errcode='23514', message='drill_reference_invalid';
      end if;
      if (ref->>'url') !~ '^cours\.html\?id=[a-z0-9-]+(#[a-z0-9-]+)?$' then
        -- Sous-ensemble HTTP(S) documenté : domaines ASCII/localhost, aucun
        -- identifiant réseau ambigu ou credential. Les références ne décident
        -- jamais des droits ou du calcul correct.
        if (ref->>'url') !~ '^https?://(localhost|([A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]([A-Za-z0-9-]*[A-Za-z0-9])?)(:[0-9]{1,5})?([/?#][^[:space:]]*)?$' then
          raise exception using errcode='23514', message='drill_reference_invalid';
        end if;
        port_match := pg_catalog.regexp_match(ref->>'url','^https?://[^/?#]+:([0-9]{1,5})([/?#]|$)');
        if port_match is not null and port_match[1]::integer > 65535 then
          raise exception using errcode='23514', message='drill_reference_invalid';
        end if;
      end if;
    end if;
  end loop;
  new.created_at := pg_catalog.clock_timestamp();
  return new;
end;
$$;

create function bprea_private.guard_drill_response()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare q jsonb;
begin
  if tg_op <> 'INSERT' then
    raise exception using errcode='42501', message='drill_response_immutable';
  end if;
  if auth.uid() is null or new.user_id is distinct from auth.uid() then
    raise exception using errcode='42501', message='drill_owner_forbidden';
  end if;
  -- SELECT conserve RLS et ne révèle pas l'existence d'une série voisine.
  perform 1 from public.drill_series s where s.id=new.series_id and s.user_id=auth.uid();
  if not found then
    raise exception using errcode='42501', message='drill_series_unavailable';
  end if;
  select item into q from public.drill_series s,
    lateral pg_catalog.jsonb_array_elements(s.questions) item
    where s.id=new.series_id and s.user_id=auth.uid() and item->>'id'=new.question_id;
  if not found then
    raise exception using errcode='23514', message='drill_question_unavailable';
  end if;
  if not exists(select 1 from pg_catalog.jsonb_array_elements(q->'options') o where o->>'id'=new.answer) then
    raise exception using errcode='23514', message='drill_option_unavailable';
  end if;
  if tg_table_name='drill_training_attempts' then
    perform 1 from public.drill_answers a where a.user_id=auth.uid() and a.series_id=new.series_id and a.question_id=new.question_id;
    if not found then
      raise exception using errcode='42501', message='drill_first_answer_unavailable';
    end if;
  end if;
  new.correct := new.answer = q->>'answer';
  new.created_at := pg_catalog.clock_timestamp();
  return new;
end;
$$;

revoke all on function bprea_private.guard_drill_series(), bprea_private.guard_drill_response() from public,anon,authenticated,service_role;
create trigger drill_series_guard before insert or update on public.drill_series for each row execute function bprea_private.guard_drill_series();
create trigger drill_answers_guard before insert or update on public.drill_answers for each row execute function bprea_private.guard_drill_response();
create trigger drill_training_guard before insert or update on public.drill_training_attempts for each row execute function bprea_private.guard_drill_response();

-- VOLATILE : après ON CONFLICT DO NOTHING, la commande SELECT suivante voit
-- la ligne concurrente gagnante en READ COMMITTED. Aucun UPDATE d'une réponse.
create function public.drill_create_series(p_unit text,p_week text,p_started_at timestamptz,p_questions jsonb)
returns jsonb language plpgsql volatile security invoker set search_path = '' as $$
declare saved public.drill_series; inserted boolean;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='drill_auth_required'; end if;
  insert into public.drill_series(unit,week,started_at,questions)
    values(p_unit,p_week,p_started_at,p_questions) on conflict do nothing returning * into saved;
  inserted := found;
  if not inserted then
    select * into saved from public.drill_series where user_id=auth.uid() and unit=p_unit and week=p_week;
    if not found then raise exception using errcode='40001',message='drill_retry_transaction'; end if;
  end if;
  return pg_catalog.jsonb_build_object('status',case when inserted then 'inserted'
    when saved.started_at=p_started_at and saved.questions=p_questions then 'replayed' else 'conflict' end,
    'row',pg_catalog.to_jsonb(saved));
end;
$$;

create function public.drill_record_answer(p_series_id uuid,p_question_id text,p_answer text,p_answered_at timestamptz,p_operation_id uuid)
returns jsonb language plpgsql volatile security invoker set search_path = '' as $$
declare saved public.drill_answers; inserted boolean;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='drill_auth_required'; end if;
  insert into public.drill_answers(operation_id,series_id,question_id,answer,answered_at)
    values(p_operation_id,p_series_id,p_question_id,p_answer,p_answered_at) on conflict do nothing returning * into saved;
  inserted := found;
  if not inserted then
    select * into saved from public.drill_answers where user_id=auth.uid() and operation_id=p_operation_id;
    if not found then
      select * into saved from public.drill_answers where user_id=auth.uid() and series_id=p_series_id and question_id=p_question_id;
    end if;
    if not found then raise exception using errcode='40001',message='drill_retry_transaction'; end if;
  end if;
  return pg_catalog.jsonb_build_object('status',case when inserted then 'inserted'
    when saved.operation_id=p_operation_id and saved.series_id=p_series_id and saved.question_id=p_question_id
      and saved.answer=p_answer and saved.answered_at=p_answered_at then 'replayed' else 'conflict' end,
    'row',pg_catalog.to_jsonb(saved));
end;
$$;

create function public.drill_record_training(p_series_id uuid,p_question_id text,p_answer text,p_answered_at timestamptz,p_operation_id uuid)
returns jsonb language plpgsql volatile security invoker set search_path = '' as $$
declare saved public.drill_training_attempts; inserted boolean;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='drill_auth_required'; end if;
  insert into public.drill_training_attempts(operation_id,series_id,question_id,answer,answered_at)
    values(p_operation_id,p_series_id,p_question_id,p_answer,p_answered_at) on conflict do nothing returning * into saved;
  inserted := found;
  if not inserted then
    select * into saved from public.drill_training_attempts where user_id=auth.uid() and operation_id=p_operation_id;
    if not found then raise exception using errcode='40001',message='drill_retry_transaction'; end if;
  end if;
  return pg_catalog.jsonb_build_object('status',case when inserted then 'inserted'
    when saved.series_id=p_series_id and saved.question_id=p_question_id and saved.answer=p_answer
      and saved.answered_at=p_answered_at then 'replayed' else 'conflict' end,
    'row',pg_catalog.to_jsonb(saved));
end;
$$;

revoke all on function public.drill_create_series(text,text,timestamptz,jsonb),
  public.drill_record_answer(uuid,text,text,timestamptz,uuid),
  public.drill_record_training(uuid,text,text,timestamptz,uuid) from public,anon,authenticated,service_role;
grant execute on function public.drill_create_series(text,text,timestamptz,jsonb),
  public.drill_record_answer(uuid,text,text,timestamptz,uuid),
  public.drill_record_training(uuid,text,text,timestamptz,uuid) to authenticated;

comment on table public.drill_series is 'Snapshot historique privé v1, immuable ; la banque publique et les dates appareil ne constituent pas une preuve d’examen.';
comment on table public.drill_answers is 'Première réponse définitive : une ligne par propriétaire/série/question ; correct calculé depuis le snapshot.';
comment on table public.drill_training_attempts is 'Entraînements append-only : identifiant d’opération stable pour retries ; aucune réécriture de la première réponse.';
notify pgrst, 'reload schema';
commit;
