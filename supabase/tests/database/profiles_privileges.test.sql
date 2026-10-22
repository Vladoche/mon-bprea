-- Contrôles structurels réels PostgreSQL, complétés par les tests HTTP
-- avec sessions utilisateurs de scripts/test-supabase.mjs.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(19);

select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'RLS est activée sur profiles');
select is((select count(*)::integer from pg_policies
  where schemaname = 'public' and tablename = 'profiles'), 2,
  'Seulement les politiques SELECT et UPDATE personnelles');
select ok(has_table_privilege('authenticated', 'public.profiles', 'SELECT'),
  'L’étudiant peut lancer SELECT avec filtrage RLS');
select ok(has_column_privilege('authenticated', 'public.profiles', 'pseudo', 'UPDATE'),
  'Le pseudo est modifiable');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'id', 'UPDATE'),
  'Le propriétaire est immuable pour l’étudiant');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'created_at', 'UPDATE'),
  'La création est protégée');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'updated_at', 'UPDATE'),
  'La date de mise à jour est protégée');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'INSERT'),
  'L’étudiant ne peut pas créer un profil');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'DELETE'),
  'L’étudiant ne peut pas supprimer un profil');
select ok(not has_table_privilege('anon', 'public.profiles', 'SELECT'),
  'Le visiteur ne peut pas lire profiles');
select ok(not has_table_privilege('anon', 'public.profiles', 'INSERT'),
  'Le visiteur ne peut pas créer un profil');
select ok(not has_table_privilege('anon', 'public.profiles', 'UPDATE'),
  'Le visiteur ne peut pas modifier un profil');
select ok(not has_table_privilege('anon', 'public.profiles', 'DELETE'),
  'Le visiteur ne peut pas supprimer un profil');
select ok(not has_function_privilege('anon',
  'bprea_private.create_profile_for_auth_user()', 'EXECUTE'),
  'Le trigger definer n’est pas un RPC anonyme');
select ok(not has_function_privilege('authenticated',
  'bprea_private.create_profile_for_auth_user()', 'EXECUTE'),
  'Le trigger definer n’est pas un RPC étudiant');
select ok(not has_schema_privilege('authenticated', 'bprea_private', 'USAGE'),
  'Le schéma des triggers est privé');
select ok((select prosecdef from pg_proc
  where oid = 'bprea_private.create_profile_for_auth_user()'::regprocedure),
  'La création de profil utilise un definer');
select is((select array_to_string(proconfig, ',') from pg_proc
  where oid = 'bprea_private.create_profile_for_auth_user()'::regprocedure),
  'search_path=""', 'Le definer utilise un search_path vide');
select is((select pg_get_userbyid(proowner)::text from pg_proc
  where oid = 'bprea_private.create_profile_for_auth_user()'::regprocedure),
  'postgres', 'Le definer appartient au rôle de migration postgres');

select * from finish();
rollback;
