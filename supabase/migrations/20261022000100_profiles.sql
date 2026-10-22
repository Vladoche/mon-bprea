-- Lot 6.1 : seule donnée applicative distante = profil personnel.
-- L'UUID Auth est la seule relation prévue pour les prochains lots.
begin;

create schema if not exists bprea_private;
revoke all on schema bprea_private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  pseudo text,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint profiles_pseudo_valid check (
    pseudo is null or (
      pseudo = pg_catalog.btrim(pseudo)
      and pg_catalog.char_length(pseudo) between 2 and 40
      -- Classes explicites : mêmes contrôles C0/C1 quel que soit le locale SQL.
      -- PostgreSQL interdit déjà U+0000 dans une valeur text.
      and pseudo !~ U&'[\0001-\001F\007F-\009F]'
    )
  )
);

comment on table public.profiles is
  'Profil minimal privé. Ni e-mail, ni mot de passe, ni résultat pédagogique.';
comment on column public.profiles.pseudo is
  'Nom facultatif : NULL ou 2 à 40 caractères, sans espaces en bordure ni contrôle.';

alter table public.profiles enable row level security;

-- Supabase peut accorder des droits par défaut : les retirer explicitement.
revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (pseudo) on table public.profiles to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Aucun INSERT/DELETE accessible aux étudiants. Les métadonnées Auth,
-- modifiables par l'utilisateur, ne décident jamais d'un rôle ou d'un pseudo.
create function bprea_private.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

alter function bprea_private.create_profile_for_auth_user() owner to postgres;
revoke all on function bprea_private.create_profile_for_auth_user()
  from public, anon, authenticated, service_role;

-- Mécanisme documenté Supabase : l'insertion Auth et le profil sont atomiques.
-- Une erreur remonte à l'invitation ; aucune exception n'est ignorée.
create trigger bprea_auth_user_created
  after insert on auth.users
  for each row execute function bprea_private.create_profile_for_auth_user();

create function bprea_private.touch_profile_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.clock_timestamp();
  return new;
end;
$$;

revoke all on function bprea_private.touch_profile_updated_at()
  from public, anon, authenticated, service_role;

create trigger bprea_profile_updated
  before update on public.profiles
  for each row execute function bprea_private.touch_profile_updated_at();

-- Première application sur un projet de développement contenant déjà Auth :
-- créer seulement les profils manquants, sans remplacer de donnée existante.
insert into public.profiles (id)
  select id from auth.users
  on conflict (id) do nothing;

commit;
