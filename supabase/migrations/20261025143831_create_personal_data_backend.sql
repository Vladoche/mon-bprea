-- Lot 6.3.1 : domaines personnels indépendants du Drill. Aucun client activé.
begin;

create table public.course_states (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lesson_id text not null,
  done boolean not null,
  best_score bigint,
  legacy_score bigint,
  legacy_total bigint,
  operation_id uuid not null,
  base_revision bigint not null,
  revision bigint not null default 1,
  schema_version integer not null default 1,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key (user_id,lesson_id),
  unique (user_id,operation_id),
  check (char_length(lesson_id) between 1 and 200 and char_length(btrim(lesson_id,U&'\0009\000A\000B\000C\000D\0020\00A0')) > 0),
  check (best_score is null or best_score between 0 and 9007199254740991),
  check ((legacy_score is null and legacy_total is null) or
    (legacy_score is not null and legacy_total is not null and legacy_total between 1 and 9007199254740991 and legacy_score between 0 and legacy_total)),
  check (schema_version=1),
  check (base_revision between 0 and 9007199254740990 and revision=base_revision+1),
  check (operation_id <> '00000000-0000-0000-0000-000000000000'::uuid),
  check (isfinite(created_at) and isfinite(updated_at))
);

create table public.quiz_attempts (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  attempt_id uuid not null,
  lesson_id text not null,
  score bigint not null,
  total bigint not null,
  completed_at timestamptz not null,
  schema_version integer not null default 1,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key (user_id,attempt_id),
  check (attempt_id <> '00000000-0000-0000-0000-000000000000'::uuid),
  check (char_length(lesson_id) between 1 and 200 and char_length(btrim(lesson_id,U&'\0009\000A\000B\000C\000D\0020\00A0')) > 0),
  check (total between 1 and 9007199254740991 and score between 0 and total),
  check (isfinite(completed_at) and completed_at >= '0001-01-01 UTC'::timestamptz and completed_at < '10000-01-01 UTC'::timestamptz),
  check (schema_version=1 and isfinite(created_at))
);
create index quiz_attempts_history_idx on public.quiz_attempts(user_id,created_at,attempt_id);
create index quiz_attempts_lesson_idx on public.quiz_attempts(user_id,lesson_id,created_at,attempt_id);

create table public.botanical_sessions (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_id text not null,
  category_id text not null,
  mode text not null,
  duration_seconds numeric not null,
  is_revision boolean not null,
  started_at timestamptz not null,
  total_questions integer not null,
  completed_at timestamptz,
  operation_id uuid not null,
  base_revision bigint not null,
  revision bigint not null default 1,
  schema_version integer not null default 1,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key (user_id,session_id),
  unique (user_id,operation_id),
  check (char_length(session_id) between 1 and 200 and char_length(btrim(session_id,U&'\0009\000A\000B\000C\000D\0020\00A0')) > 0),
  check (char_length(category_id) between 1 and 200 and char_length(btrim(category_id,U&'\0009\000A\000B\000C\000D\0020\00A0')) > 0),
  check (mode in ('discovery','chrono')),
  check (duration_seconds between 1 and 300),
  check (total_questions between 1 and 10),
  check (isfinite(started_at) and started_at >= '0001-01-01 UTC'::timestamptz and started_at < '10000-01-01 UTC'::timestamptz),
  check (completed_at is null or (isfinite(completed_at) and completed_at >= started_at and completed_at < '10000-01-01 UTC'::timestamptz)),
  check (schema_version=1),
  check (base_revision between 0 and 9007199254740990 and revision=base_revision+1),
  check (operation_id <> '00000000-0000-0000-0000-000000000000'::uuid),
  check (isfinite(created_at) and isfinite(updated_at))
);
create index botanical_sessions_history_idx on public.botanical_sessions(user_id,created_at,session_id);

create table public.botanical_answers (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  answer_id text not null,
  session_id text not null,
  question_id text not null,
  category_id text not null,
  species_id text not null,
  photo_id text not null,
  mode text not null,
  is_revision boolean not null,
  status text not null,
  selected_species_id text,
  correct boolean not null,
  elapsed_ms bigint not null,
  answered_at timestamptz not null,
  schema_version integer not null default 1,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key (user_id,answer_id),
  unique (user_id,session_id,question_id),
  foreign key (user_id,session_id) references public.botanical_sessions(user_id,session_id) on delete cascade,
  check (answer_id=question_id),
  check (char_length(answer_id) between 1 and 200 and char_length(btrim(answer_id,U&'\0009\000A\000B\000C\000D\0020\00A0')) > 0),
  check (char_length(question_id) between 1 and 200 and char_length(btrim(question_id,U&'\0009\000A\000B\000C\000D\0020\00A0')) > 0),
  check (char_length(category_id) between 1 and 200 and char_length(btrim(category_id,U&'\0009\000A\000B\000C\000D\0020\00A0')) > 0),
  check (char_length(species_id) between 1 and 200 and char_length(btrim(species_id,U&'\0009\000A\000B\000C\000D\0020\00A0')) > 0),
  check (char_length(photo_id) between 1 and 200 and char_length(btrim(photo_id,U&'\0009\000A\000B\000C\000D\0020\00A0')) > 0),
  check (mode in ('discovery','chrono')),
  check (status in ('correct','incorrect','timeout','skipped_image')),
  check (correct=(status='correct')),
  check ((status='correct' and selected_species_id is not null and selected_species_id=species_id)
    or (status='incorrect' and selected_species_id is not null and selected_species_id<>species_id
      and char_length(selected_species_id) between 1 and 200 and char_length(btrim(selected_species_id,U&'\0009\000A\000B\000C\000D\0020\00A0'))>0)
    or (status in ('timeout','skipped_image') and selected_species_id is null)),
  check (status<>'timeout' or mode='chrono'),
  check (elapsed_ms between 0 and 9007199254740991),
  check (isfinite(answered_at) and answered_at >= '0001-01-01 UTC'::timestamptz and answered_at < '10000-01-01 UTC'::timestamptz),
  check (schema_version=1 and isfinite(created_at))
);
create index botanical_answers_history_idx on public.botanical_answers(user_id,created_at,answer_id);

create table public.itk_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  parameters jsonb not null,
  operation_id uuid not null,
  base_revision bigint not null,
  revision bigint not null default 1,
  schema_version integer not null default 1,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  unique (user_id,operation_id),
  check (jsonb_typeof(parameters)='object' and octet_length(parameters::text)<=4096),
  check (schema_version=1),
  check (base_revision between 0 and 9007199254740990 and revision=base_revision+1),
  check (operation_id <> '00000000-0000-0000-0000-000000000000'::uuid),
  check (isfinite(created_at) and isfinite(updated_at))
);

create table public.appearance_preferences (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  season text not null,
  brightness text not null,
  client_updated_at timestamptz,
  operation_id uuid not null,
  base_revision bigint not null,
  revision bigint not null default 1,
  schema_version integer not null default 1,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  unique (user_id,operation_id),
  check (season in ('auto','spring','summer','autumn','winter')),
  check (brightness in ('auto','light','dark')),
  check (client_updated_at is null or (isfinite(client_updated_at) and client_updated_at >= '0001-01-01 UTC'::timestamptz and client_updated_at < '10000-01-01 UTC'::timestamptz)),
  check (schema_version=1),
  check (base_revision between 0 and 9007199254740990 and revision=base_revision+1),
  check (operation_id <> '00000000-0000-0000-0000-000000000000'::uuid),
  check (isfinite(created_at) and isfinite(updated_at))
);

-- Même garde pour les accès SQL directs et les RPC invoker : aucune capacité
-- d'écrire les colonnes serveur n'est nécessaire au rôle authenticated.
create function bprea_private.guard_personal_mutation()
returns trigger language plpgsql security invoker set search_path='' as $$
declare field text; p jsonb; area_value numeric;
begin
  if auth.uid() is null or new.user_id is distinct from auth.uid() then
    raise exception using errcode='42501',message='personal_owner_forbidden';
  end if;
  if tg_op='INSERT' then
    if new.base_revision is distinct from 0::bigint then
      raise exception using errcode='40001',message='personal_revision_conflict';
    end if;
    new.revision:=1;
    new.created_at:=pg_catalog.clock_timestamp();
  else
    if new.user_id is distinct from old.user_id or new.created_at is distinct from old.created_at
      or new.schema_version is distinct from old.schema_version or new.revision is distinct from old.revision then
      raise exception using errcode='42501',message='personal_server_fields_protected';
    end if;
    if new.base_revision is distinct from old.revision or new.operation_id=old.operation_id then
      raise exception using errcode='40001',message='personal_revision_conflict';
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

create function bprea_private.guard_personal_append()
returns trigger language plpgsql security invoker set search_path='' as $$
declare s public.botanical_sessions; n integer;
begin
  if tg_op<>'INSERT' then raise exception using errcode='42501',message='personal_history_immutable'; end if;
  if auth.uid() is null or new.user_id is distinct from auth.uid() then
    raise exception using errcode='42501',message='personal_owner_forbidden';
  end if;
  if tg_table_name='botanical_answers' then
    -- Le verrou parent sérialise les ajouts distincts et la complétion. Le test
    -- de capacité ne compte pas un retry de la même identité métier.
    select * into s from public.botanical_sessions where user_id=auth.uid() and session_id=new.session_id for update;
    if not found then raise exception using errcode='42501',message='personal_session_unavailable'; end if;
    if row(new.category_id,new.mode,new.is_revision) is distinct from row(s.category_id,s.mode,s.is_revision)
      or new.answered_at<s.started_at or (s.completed_at is not null and new.answered_at>s.completed_at) then
      raise exception using errcode='23514',message='personal_answer_session_mismatch';
    end if;
    select count(*) into n from public.botanical_answers where user_id=auth.uid() and session_id=new.session_id and answer_id<>new.answer_id;
    if n>=s.total_questions then raise exception using errcode='23514',message='personal_session_full'; end if;
  end if;
  new.created_at:=pg_catalog.clock_timestamp();
  return new;
end;
$$;

revoke all on function bprea_private.guard_personal_mutation(),bprea_private.guard_personal_append() from public,anon,authenticated,service_role;

create trigger course_states_guard before insert or update on public.course_states for each row execute function bprea_private.guard_personal_mutation();
create trigger botanical_sessions_guard before insert or update on public.botanical_sessions for each row execute function bprea_private.guard_personal_mutation();
create trigger itk_settings_guard before insert or update on public.itk_settings for each row execute function bprea_private.guard_personal_mutation();
create trigger appearance_preferences_guard before insert or update on public.appearance_preferences for each row execute function bprea_private.guard_personal_mutation();
create trigger quiz_attempts_guard before insert or update on public.quiz_attempts for each row execute function bprea_private.guard_personal_append();
create trigger botanical_answers_guard before insert or update on public.botanical_answers for each row execute function bprea_private.guard_personal_append();

alter table public.course_states enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.botanical_sessions enable row level security;
alter table public.botanical_answers enable row level security;
alter table public.itk_settings enable row level security;
alter table public.appearance_preferences enable row level security;
revoke all on public.course_states,public.quiz_attempts,public.botanical_sessions,public.botanical_answers,public.itk_settings,public.appearance_preferences from public,anon,authenticated,service_role;
grant select on public.course_states,public.quiz_attempts,public.botanical_sessions,public.botanical_answers,public.itk_settings,public.appearance_preferences to authenticated;
grant insert (lesson_id,done,best_score,legacy_score,legacy_total,operation_id,base_revision) on public.course_states to authenticated;
grant update (done,best_score,legacy_score,legacy_total,operation_id,base_revision) on public.course_states to authenticated;
grant insert (attempt_id,lesson_id,score,total,completed_at) on public.quiz_attempts to authenticated;
grant insert (session_id,category_id,mode,duration_seconds,is_revision,started_at,total_questions,completed_at,operation_id,base_revision) on public.botanical_sessions to authenticated;
grant update (completed_at,operation_id,base_revision) on public.botanical_sessions to authenticated;
grant insert (answer_id,session_id,question_id,category_id,species_id,photo_id,mode,is_revision,status,selected_species_id,correct,elapsed_ms,answered_at) on public.botanical_answers to authenticated;
grant insert (parameters,operation_id,base_revision) on public.itk_settings to authenticated;
grant update (parameters,operation_id,base_revision) on public.itk_settings to authenticated;
grant insert (season,brightness,client_updated_at,operation_id,base_revision) on public.appearance_preferences to authenticated;
grant update (season,brightness,client_updated_at,operation_id,base_revision) on public.appearance_preferences to authenticated;

create policy course_states_select_own on public.course_states for select to authenticated using ((select auth.uid())=user_id);
create policy course_states_insert_own on public.course_states for insert to authenticated with check ((select auth.uid())=user_id);
create policy course_states_update_own on public.course_states for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy quiz_attempts_select_own on public.quiz_attempts for select to authenticated using ((select auth.uid())=user_id);
create policy quiz_attempts_insert_own on public.quiz_attempts for insert to authenticated with check ((select auth.uid())=user_id);
create policy botanical_sessions_select_own on public.botanical_sessions for select to authenticated using ((select auth.uid())=user_id);
create policy botanical_sessions_insert_own on public.botanical_sessions for insert to authenticated with check ((select auth.uid())=user_id);
create policy botanical_sessions_update_own on public.botanical_sessions for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy botanical_answers_select_own on public.botanical_answers for select to authenticated using ((select auth.uid())=user_id);
create policy botanical_answers_insert_own on public.botanical_answers for insert to authenticated with check ((select auth.uid())=user_id);
create policy itk_settings_select_own on public.itk_settings for select to authenticated using ((select auth.uid())=user_id);
create policy itk_settings_insert_own on public.itk_settings for insert to authenticated with check ((select auth.uid())=user_id);
create policy itk_settings_update_own on public.itk_settings for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy appearance_preferences_select_own on public.appearance_preferences for select to authenticated using ((select auth.uid())=user_id);
create policy appearance_preferences_insert_own on public.appearance_preferences for insert to authenticated with check ((select auth.uid())=user_id);
create policy appearance_preferences_update_own on public.appearance_preferences for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

create function public.personal_save_course(p_lesson_id text,p_done boolean,p_best_score bigint,p_legacy_score bigint,p_legacy_total bigint,p_operation_id uuid,p_expected_revision bigint)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare saved public.course_states;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='personal_auth_required'; end if;
  if p_operation_id is null or p_operation_id='00000000-0000-0000-0000-000000000000'::uuid
    or p_expected_revision is null or p_expected_revision not between 0 and 9007199254740990 then
    raise exception using errcode='23514',message='personal_operation_invalid';
  end if;

  select * into saved from public.course_states where user_id=auth.uid() and lesson_id=p_lesson_id for update;
  if found then
    if saved.operation_id=p_operation_id then
      return pg_catalog.jsonb_build_object('status',case when saved.base_revision=p_expected_revision and saved.done is not distinct from p_done and saved.best_score is not distinct from p_best_score and saved.legacy_score is not distinct from p_legacy_score and saved.legacy_total is not distinct from p_legacy_total then 'replayed' else 'conflict' end,'row',pg_catalog.to_jsonb(saved));
    end if;
    if saved.revision<>p_expected_revision then
      return pg_catalog.jsonb_build_object('status','conflict','row',pg_catalog.to_jsonb(saved));
    end if;

    begin
      update public.course_states set done=p_done,best_score=p_best_score,legacy_score=p_legacy_score,legacy_total=p_legacy_total,operation_id=p_operation_id,base_revision=p_expected_revision
        where user_id=auth.uid() and lesson_id=p_lesson_id returning * into saved;
    exception when unique_violation then
      return pg_catalog.jsonb_build_object('status','conflict','row',pg_catalog.to_jsonb(saved));
    end;
    return pg_catalog.jsonb_build_object('status','updated','row',pg_catalog.to_jsonb(saved));
  end if;
  if p_expected_revision<>0 then return pg_catalog.jsonb_build_object('status','conflict','row',null); end if;
  insert into public.course_states(lesson_id,done,best_score,legacy_score,legacy_total,operation_id,base_revision)
    values(p_lesson_id,p_done,p_best_score,p_legacy_score,p_legacy_total,p_operation_id,p_expected_revision) on conflict do nothing returning * into saved;
  if found then return pg_catalog.jsonb_build_object('status','inserted','row',pg_catalog.to_jsonb(saved)); end if;
  -- Une course de création peut attendre le gagnant ; nouvelle commande en
  -- READ COMMITTED pour voir son commit, sans UPDATE de contournement.
  select * into saved from public.course_states where user_id=auth.uid() and lesson_id=p_lesson_id for update;
  if not found then return pg_catalog.jsonb_build_object('status','conflict','row',null); end if;
  return pg_catalog.jsonb_build_object('status',case when saved.operation_id=p_operation_id and saved.base_revision=p_expected_revision and saved.done is not distinct from p_done and saved.best_score is not distinct from p_best_score and saved.legacy_score is not distinct from p_legacy_score and saved.legacy_total is not distinct from p_legacy_total
    then 'replayed' else 'conflict' end,'row',pg_catalog.to_jsonb(saved));
end;
$$;

create function public.personal_save_botanical_session(p_session jsonb,p_operation_id uuid,p_expected_revision bigint)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare saved public.botanical_sessions; v_session_id text; v_category_id text; v_mode text; v_duration_seconds numeric; v_is_revision boolean; v_started_at timestamptz; v_total_questions integer; v_completed_at timestamptz;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='personal_auth_required'; end if;
  if p_operation_id is null or p_operation_id='00000000-0000-0000-0000-000000000000'::uuid
    or p_expected_revision is null or p_expected_revision not between 0 and 9007199254740990 then
    raise exception using errcode='23514',message='personal_operation_invalid';
  end if;
  if jsonb_typeof(p_session) is distinct from 'object' or octet_length(p_session::text)>8192 then
    raise exception using errcode='23514',message='personal_payload_invalid';
  end if;
  if not (p_session ?& array['id','categoryId','mode','durationSeconds','revision','startedAt','totalQuestions']) or
    exists(select 1 from pg_catalog.jsonb_object_keys(p_session) k where not (k=any(array['id','categoryId','mode','durationSeconds','revision','startedAt','totalQuestions','completedAt']))) then
    raise exception using errcode='23514',message='personal_payload_fields_invalid';
  end if;
  if jsonb_typeof(p_session->'id') is distinct from 'string' then
    raise exception using errcode='23514',message='personal_payload_type_invalid';
  end if;
  if jsonb_typeof(p_session->'categoryId') is distinct from 'string' then
    raise exception using errcode='23514',message='personal_payload_type_invalid';
  end if;
  if jsonb_typeof(p_session->'mode') is distinct from 'string' then
    raise exception using errcode='23514',message='personal_payload_type_invalid';
  end if;
  if jsonb_typeof(p_session->'durationSeconds') is distinct from 'number' then
    raise exception using errcode='23514',message='personal_payload_type_invalid';
  end if;
  if jsonb_typeof(p_session->'totalQuestions') is distinct from 'number' then
    raise exception using errcode='23514',message='personal_payload_type_invalid';
  end if;
  if jsonb_typeof(p_session->'revision') is distinct from 'boolean' then
    raise exception using errcode='23514',message='personal_payload_type_invalid';
  end if;
  if (p_session->>'durationSeconds')::numeric not between 1 and 300 or
    (p_session->>'totalQuestions')::numeric not between 1 and 10 or
    (p_session->>'totalQuestions')::numeric<>pg_catalog.trunc((p_session->>'totalQuestions')::numeric) then
    raise exception using errcode='23514',message='personal_session_numbers_invalid';
  end if;
  if jsonb_typeof(p_session->'startedAt') is distinct from 'string' or p_session->>'startedAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?Z$' then
    raise exception using errcode='23514',message='personal_timestamp_invalid';
  end if;
  begin
    if not isfinite((p_session->>'startedAt')::timestamptz) or (p_session->>'startedAt')::timestamptz < '0001-01-01 UTC'::timestamptz
      or (p_session->>'startedAt')::timestamptz >= '10000-01-01 UTC'::timestamptz
      or pg_catalog.to_char((p_session->>'startedAt')::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS')<>left(p_session->>'startedAt',19) then
      raise exception using errcode='23514',message='personal_timestamp_invalid';
    end if;
  exception when datetime_field_overflow or invalid_datetime_format then
    raise exception using errcode='23514',message='personal_timestamp_invalid';
  end;
  if p_session ? 'completedAt' and p_session->'completedAt'<>'null'::jsonb then
    if jsonb_typeof(p_session->'completedAt') is distinct from 'string' or p_session->>'completedAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?Z$' then
      raise exception using errcode='23514',message='personal_timestamp_invalid';
    end if;
    begin
      if not isfinite((p_session->>'completedAt')::timestamptz) or (p_session->>'completedAt')::timestamptz < '0001-01-01 UTC'::timestamptz
        or (p_session->>'completedAt')::timestamptz >= '10000-01-01 UTC'::timestamptz
        or pg_catalog.to_char((p_session->>'completedAt')::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS')<>left(p_session->>'completedAt',19) then
        raise exception using errcode='23514',message='personal_timestamp_invalid';
      end if;
    exception when datetime_field_overflow or invalid_datetime_format then
      raise exception using errcode='23514',message='personal_timestamp_invalid';
    end;
  end if;
  v_session_id:=p_session->>'id';
  v_category_id:=p_session->>'categoryId'; v_mode:=p_session->>'mode';
  v_duration_seconds:=(p_session->>'durationSeconds')::numeric; v_is_revision:=(p_session->>'revision')::boolean;
  v_started_at:=(p_session->>'startedAt')::timestamptz; v_total_questions:=(p_session->>'totalQuestions')::numeric::integer;
  v_completed_at:=(p_session->>'completedAt')::timestamptz;

  select * into saved from public.botanical_sessions where user_id=auth.uid() and session_id=v_session_id for update;
  if found then
    if saved.operation_id=p_operation_id then
      return pg_catalog.jsonb_build_object('status',case when saved.base_revision=p_expected_revision and saved.category_id is not distinct from v_category_id and saved.mode is not distinct from v_mode and saved.duration_seconds is not distinct from v_duration_seconds and saved.is_revision is not distinct from v_is_revision and saved.started_at is not distinct from v_started_at and saved.total_questions is not distinct from v_total_questions and saved.completed_at is not distinct from v_completed_at then 'replayed' else 'conflict' end,'row',pg_catalog.to_jsonb(saved));
    end if;
    if saved.revision<>p_expected_revision then
      return pg_catalog.jsonb_build_object('status','conflict','row',pg_catalog.to_jsonb(saved));
    end if;

    if not (saved.category_id is not distinct from v_category_id and saved.mode is not distinct from v_mode and saved.duration_seconds is not distinct from v_duration_seconds and saved.is_revision is not distinct from v_is_revision and saved.started_at is not distinct from v_started_at and saved.total_questions is not distinct from v_total_questions)
      or (saved.completed_at is not null and saved.completed_at is distinct from v_completed_at) then
      return pg_catalog.jsonb_build_object('status','conflict','row',pg_catalog.to_jsonb(saved));
    end if;

    begin
      update public.botanical_sessions set completed_at=v_completed_at,operation_id=p_operation_id,base_revision=p_expected_revision
        where user_id=auth.uid() and session_id=v_session_id returning * into saved;
    exception when unique_violation then
      return pg_catalog.jsonb_build_object('status','conflict','row',pg_catalog.to_jsonb(saved));
    end;
    return pg_catalog.jsonb_build_object('status','updated','row',pg_catalog.to_jsonb(saved));
  end if;
  if p_expected_revision<>0 then return pg_catalog.jsonb_build_object('status','conflict','row',null); end if;
  insert into public.botanical_sessions(session_id,category_id,mode,duration_seconds,is_revision,started_at,total_questions,completed_at,operation_id,base_revision)
    values(v_session_id,v_category_id,v_mode,v_duration_seconds,v_is_revision,v_started_at,v_total_questions,v_completed_at,p_operation_id,p_expected_revision) on conflict do nothing returning * into saved;
  if found then return pg_catalog.jsonb_build_object('status','inserted','row',pg_catalog.to_jsonb(saved)); end if;
  -- Une course de création peut attendre le gagnant ; nouvelle commande en
  -- READ COMMITTED pour voir son commit, sans UPDATE de contournement.
  select * into saved from public.botanical_sessions where user_id=auth.uid() and session_id=v_session_id for update;
  if not found then return pg_catalog.jsonb_build_object('status','conflict','row',null); end if;
  return pg_catalog.jsonb_build_object('status',case when saved.operation_id=p_operation_id and saved.base_revision=p_expected_revision and saved.category_id is not distinct from v_category_id and saved.mode is not distinct from v_mode and saved.duration_seconds is not distinct from v_duration_seconds and saved.is_revision is not distinct from v_is_revision and saved.started_at is not distinct from v_started_at and saved.total_questions is not distinct from v_total_questions and saved.completed_at is not distinct from v_completed_at
    then 'replayed' else 'conflict' end,'row',pg_catalog.to_jsonb(saved));
end;
$$;

create function public.personal_save_itk(p_parameters jsonb,p_operation_id uuid,p_expected_revision bigint)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare saved public.itk_settings;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='personal_auth_required'; end if;
  if p_operation_id is null or p_operation_id='00000000-0000-0000-0000-000000000000'::uuid
    or p_expected_revision is null or p_expected_revision not between 0 and 9007199254740990 then
    raise exception using errcode='23514',message='personal_operation_invalid';
  end if;

  select * into saved from public.itk_settings where user_id=auth.uid() for update;
  if found then
    if saved.operation_id=p_operation_id then
      return pg_catalog.jsonb_build_object('status',case when saved.base_revision=p_expected_revision and saved.parameters is not distinct from p_parameters then 'replayed' else 'conflict' end,'row',pg_catalog.to_jsonb(saved));
    end if;
    if saved.revision<>p_expected_revision then
      return pg_catalog.jsonb_build_object('status','conflict','row',pg_catalog.to_jsonb(saved));
    end if;

    begin
      update public.itk_settings set parameters=p_parameters,operation_id=p_operation_id,base_revision=p_expected_revision
        where user_id=auth.uid() returning * into saved;
    exception when unique_violation then
      return pg_catalog.jsonb_build_object('status','conflict','row',pg_catalog.to_jsonb(saved));
    end;
    return pg_catalog.jsonb_build_object('status','updated','row',pg_catalog.to_jsonb(saved));
  end if;
  if p_expected_revision<>0 then return pg_catalog.jsonb_build_object('status','conflict','row',null); end if;
  insert into public.itk_settings(parameters,operation_id,base_revision)
    values(p_parameters,p_operation_id,p_expected_revision) on conflict do nothing returning * into saved;
  if found then return pg_catalog.jsonb_build_object('status','inserted','row',pg_catalog.to_jsonb(saved)); end if;
  -- Une course de création peut attendre le gagnant ; nouvelle commande en
  -- READ COMMITTED pour voir son commit, sans UPDATE de contournement.
  select * into saved from public.itk_settings where user_id=auth.uid() for update;
  if not found then return pg_catalog.jsonb_build_object('status','conflict','row',null); end if;
  return pg_catalog.jsonb_build_object('status',case when saved.operation_id=p_operation_id and saved.base_revision=p_expected_revision and saved.parameters is not distinct from p_parameters
    then 'replayed' else 'conflict' end,'row',pg_catalog.to_jsonb(saved));
end;
$$;

create function public.personal_save_appearance(p_preferences jsonb,p_operation_id uuid,p_expected_revision bigint)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare saved public.appearance_preferences; v_season text; v_brightness text; v_client_updated_at timestamptz;
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
    exists(select 1 from pg_catalog.jsonb_object_keys(p_preferences) k where not (k=any(array['version','season','brightness','updatedAt']))) then
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

  select * into saved from public.appearance_preferences where user_id=auth.uid() for update;
  if found then
    if saved.operation_id=p_operation_id then
      return pg_catalog.jsonb_build_object('status',case when saved.base_revision=p_expected_revision and saved.season is not distinct from v_season and saved.brightness is not distinct from v_brightness and saved.client_updated_at is not distinct from v_client_updated_at then 'replayed' else 'conflict' end,'row',pg_catalog.to_jsonb(saved));
    end if;
    if saved.revision<>p_expected_revision then
      return pg_catalog.jsonb_build_object('status','conflict','row',pg_catalog.to_jsonb(saved));
    end if;

    begin
      update public.appearance_preferences set season=v_season,brightness=v_brightness,client_updated_at=v_client_updated_at,operation_id=p_operation_id,base_revision=p_expected_revision
        where user_id=auth.uid() returning * into saved;
    exception when unique_violation then
      return pg_catalog.jsonb_build_object('status','conflict','row',pg_catalog.to_jsonb(saved));
    end;
    return pg_catalog.jsonb_build_object('status','updated','row',pg_catalog.to_jsonb(saved));
  end if;
  if p_expected_revision<>0 then return pg_catalog.jsonb_build_object('status','conflict','row',null); end if;
  insert into public.appearance_preferences(season,brightness,client_updated_at,operation_id,base_revision)
    values(v_season,v_brightness,v_client_updated_at,p_operation_id,p_expected_revision) on conflict do nothing returning * into saved;
  if found then return pg_catalog.jsonb_build_object('status','inserted','row',pg_catalog.to_jsonb(saved)); end if;
  -- Une course de création peut attendre le gagnant ; nouvelle commande en
  -- READ COMMITTED pour voir son commit, sans UPDATE de contournement.
  select * into saved from public.appearance_preferences where user_id=auth.uid() for update;
  if not found then return pg_catalog.jsonb_build_object('status','conflict','row',null); end if;
  return pg_catalog.jsonb_build_object('status',case when saved.operation_id=p_operation_id and saved.base_revision=p_expected_revision and saved.season is not distinct from v_season and saved.brightness is not distinct from v_brightness and saved.client_updated_at is not distinct from v_client_updated_at
    then 'replayed' else 'conflict' end,'row',pg_catalog.to_jsonb(saved));
end;
$$;

create function public.personal_record_quiz(p_attempt_id uuid,p_lesson_id text,p_score bigint,p_total bigint,p_completed_at timestamptz)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare saved public.quiz_attempts;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='personal_auth_required'; end if;

  insert into public.quiz_attempts(attempt_id,lesson_id,score,total,completed_at) values(p_attempt_id,p_lesson_id,p_score,p_total,p_completed_at)
    on conflict do nothing returning * into saved;
  if found then return pg_catalog.jsonb_build_object('status','inserted','row',pg_catalog.to_jsonb(saved)); end if;
  select * into saved from public.quiz_attempts where user_id=auth.uid() and attempt_id=p_attempt_id;
  if not found then raise exception using errcode='40001',message='personal_retry_transaction'; end if;
  return pg_catalog.jsonb_build_object('status',case when saved.lesson_id is not distinct from p_lesson_id and saved.score is not distinct from p_score and saved.total is not distinct from p_total and saved.completed_at is not distinct from p_completed_at then 'replayed' else 'conflict' end,'row',pg_catalog.to_jsonb(saved));
end;
$$;

create function public.personal_record_botanical_answer(p_answer jsonb)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare saved public.botanical_answers;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='personal_auth_required'; end if;
  if jsonb_typeof(p_answer) is distinct from 'object' or octet_length(p_answer::text)>8192 then
    raise exception using errcode='23514',message='personal_payload_invalid';
  end if;
  if not (p_answer ?& array['id','sessionId','questionId','categoryId','speciesId','photoId','mode','revision','status','selectedSpeciesId','correct','elapsedMs','answeredAt']) or
    exists(select 1 from pg_catalog.jsonb_object_keys(p_answer) k where not (k=any(array['id','sessionId','questionId','categoryId','speciesId','photoId','mode','revision','status','selectedSpeciesId','correct','elapsedMs','answeredAt']))) then
    raise exception using errcode='23514',message='personal_payload_fields_invalid';
  end if;
  if jsonb_typeof(p_answer->'id') is distinct from 'string' then
    raise exception using errcode='23514',message='personal_payload_type_invalid';
  end if;
  if jsonb_typeof(p_answer->'sessionId') is distinct from 'string' then
    raise exception using errcode='23514',message='personal_payload_type_invalid';
  end if;
  if jsonb_typeof(p_answer->'questionId') is distinct from 'string' then
    raise exception using errcode='23514',message='personal_payload_type_invalid';
  end if;
  if jsonb_typeof(p_answer->'categoryId') is distinct from 'string' then
    raise exception using errcode='23514',message='personal_payload_type_invalid';
  end if;
  if jsonb_typeof(p_answer->'speciesId') is distinct from 'string' then
    raise exception using errcode='23514',message='personal_payload_type_invalid';
  end if;
  if jsonb_typeof(p_answer->'photoId') is distinct from 'string' then
    raise exception using errcode='23514',message='personal_payload_type_invalid';
  end if;
  if jsonb_typeof(p_answer->'mode') is distinct from 'string' then
    raise exception using errcode='23514',message='personal_payload_type_invalid';
  end if;
  if jsonb_typeof(p_answer->'status') is distinct from 'string' then
    raise exception using errcode='23514',message='personal_payload_type_invalid';
  end if;
  if jsonb_typeof(p_answer->'revision') is distinct from 'boolean' then
    raise exception using errcode='23514',message='personal_payload_type_invalid';
  end if;
  if jsonb_typeof(p_answer->'correct') is distinct from 'boolean' then
    raise exception using errcode='23514',message='personal_payload_type_invalid';
  end if;
  if jsonb_typeof(p_answer->'elapsedMs') is distinct from 'number' then
    raise exception using errcode='23514',message='personal_payload_type_invalid';
  end if;
  if jsonb_typeof(p_answer->'selectedSpeciesId') not in ('string','null') or
    (p_answer->>'elapsedMs')::numeric not between 0 and 9007199254740991 or
    (p_answer->>'elapsedMs')::numeric<>pg_catalog.trunc((p_answer->>'elapsedMs')::numeric) then
    raise exception using errcode='23514',message='personal_answer_invalid';
  end if;
  if jsonb_typeof(p_answer->'answeredAt') is distinct from 'string' or p_answer->>'answeredAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?Z$' then
    raise exception using errcode='23514',message='personal_timestamp_invalid';
  end if;
  begin
    if not isfinite((p_answer->>'answeredAt')::timestamptz) or (p_answer->>'answeredAt')::timestamptz < '0001-01-01 UTC'::timestamptz
      or (p_answer->>'answeredAt')::timestamptz >= '10000-01-01 UTC'::timestamptz
      or pg_catalog.to_char((p_answer->>'answeredAt')::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS')<>left(p_answer->>'answeredAt',19) then
      raise exception using errcode='23514',message='personal_timestamp_invalid';
    end if;
  exception when datetime_field_overflow or invalid_datetime_format then
    raise exception using errcode='23514',message='personal_timestamp_invalid';
  end;

  insert into public.botanical_answers(answer_id,session_id,question_id,category_id,species_id,photo_id,mode,is_revision,status,selected_species_id,correct,elapsed_ms,answered_at) values(p_answer->>'id',p_answer->>'sessionId',p_answer->>'questionId',p_answer->>'categoryId',p_answer->>'speciesId',p_answer->>'photoId',p_answer->>'mode',(p_answer->>'revision')::boolean,p_answer->>'status',p_answer->>'selectedSpeciesId',(p_answer->>'correct')::boolean,(p_answer->>'elapsedMs')::numeric::bigint,(p_answer->>'answeredAt')::timestamptz)
    on conflict do nothing returning * into saved;
  if found then return pg_catalog.jsonb_build_object('status','inserted','row',pg_catalog.to_jsonb(saved)); end if;
  select * into saved from public.botanical_answers where user_id=auth.uid() and answer_id=p_answer->>'id';
  if not found then raise exception using errcode='40001',message='personal_retry_transaction'; end if;
  return pg_catalog.jsonb_build_object('status',case when saved.session_id is not distinct from p_answer->>'sessionId' and saved.question_id is not distinct from p_answer->>'questionId' and saved.category_id is not distinct from p_answer->>'categoryId' and saved.species_id is not distinct from p_answer->>'speciesId' and saved.photo_id is not distinct from p_answer->>'photoId' and saved.mode is not distinct from p_answer->>'mode' and saved.is_revision is not distinct from (p_answer->>'revision')::boolean and saved.status is not distinct from p_answer->>'status' and saved.selected_species_id is not distinct from p_answer->>'selectedSpeciesId' and saved.correct is not distinct from (p_answer->>'correct')::boolean and saved.elapsed_ms is not distinct from (p_answer->>'elapsedMs')::numeric::bigint and saved.answered_at is not distinct from (p_answer->>'answeredAt')::timestamptz then 'replayed' else 'conflict' end,'row',pg_catalog.to_jsonb(saved));
end;
$$;

revoke all on function public.personal_save_course(text,boolean,bigint,bigint,bigint,uuid,bigint),
  public.personal_save_botanical_session(jsonb,uuid,bigint),public.personal_save_itk(jsonb,uuid,bigint),
  public.personal_save_appearance(jsonb,uuid,bigint),public.personal_record_quiz(uuid,text,bigint,bigint,timestamptz),
  public.personal_record_botanical_answer(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.personal_save_course(text,boolean,bigint,bigint,bigint,uuid,bigint),
  public.personal_save_botanical_session(jsonb,uuid,bigint),public.personal_save_itk(jsonb,uuid,bigint),
  public.personal_save_appearance(jsonb,uuid,bigint),public.personal_record_quiz(uuid,text,bigint,bigint,timestamptz),
  public.personal_record_botanical_answer(jsonb) to authenticated;

comment on table public.course_states is 'État explicite terminé/non terminé ; meilleur score et score ancien sans date inventée. Données déclaratives du navigateur.';
comment on table public.quiz_attempts is 'Historique QCM classique append-only, UUID durable attribué à chaque vraie tentative, distinct du Drill.';
comment on table public.botanical_sessions is 'Métadonnées botaniques historiques ; seule complétion null vers date est modifiable avec CAS.';
comment on table public.botanical_answers is 'Un résultat immuable par identité de question, indépendant du Drill ; aucun snapshot éditorial ni certification.';
comment on table public.itk_settings is 'Derniers huit paramètres du générateur existant, remplacement avec CAS ; aucune bibliothèque documentaire.';
comment on table public.appearance_preferences is 'Choix personnels de saison/luminosité y compris auto ; rendu calculé sur chaque appareil.';
notify pgrst, 'reload schema';
commit;
