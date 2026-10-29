# Sauvegarde technique Supabase Free — lot 6.5.3.B

**29 octobre 2026 : copie applicative réalisée et restauration PostgreSQL partielle vérifiée avant migration.** Cible exclusive : `wcckbyhrtroittbfophv`, Mon BPREA DEV, Free, eu-west-1, PostgreSQL 17.11.0.003. La [preuve d’exécution](../validations/EXECUTION-LOT6-5-3B-2026-10-29.md) distingue la préparation du 28 octobre, les autorisations A/B et les résultats réels. PROD est exclu.

L’exploitant a autorisé la copie applicative et le dossier protégé, choisi `pg_dump` natif puis autorisé B. Il réserve DEV au fictif, dispense cette copie de chiffrement du volume et déclare le dossier exclu de toute synchronisation cloud. Ces décisions concernent cette intervention ; elles ne valident ni une politique générale de conservation ni l’ouverture aux étudiants.

## Protection retenue et limites

Une **archive custom unique** contient structure et données de `public` et `bprea_private`. Les deux fichiers SQL sont dérivés hors ligne de cette archive : ils partagent le même snapshot de données, contrairement aux deux dumps CLI séparés envisagés initialement. Les catalogues et droits sont relevés avant/après ; aucune dérive constatée.

Ce dispositif ne constitue pas une sauvegarde complète Supabase. Les comptes et mécanismes Auth, Storage, Vault, secrets, rôles globaux, configuration hébergée et copies fournisseur sont exclus. La restauration de l’application avec ses comptes opérationnels n’est pas démontrée. L’export JSON individuel reste partiel et sa réimportation reste un lot ultérieur : [note de préparation](PREPARATION-RESTAURATION-COMPTE-JSON.md).

| Catégorie | Inclusion effective avant migration | Récupération et limite |
| --- | --- | --- |
| A — structure | Tables, colonnes, contraintes, index, fonctions, triggers applicatifs, RLS, ACL et défauts des schémas sélectionnés ; sources Git au commit retenu | Comparaison structurelle et des droits effectuée après restauration. Le trigger attaché à `auth.users` est hors archive ; sa définition reste dans Git et le catalogue. |
| B — pédagogie | Les trois tables Drill présentes au moment de la copie | Données restaurées puis réexportées localement et comparées en privé, sans affichage de lignes. Les six tables personnelles n’existaient pas encore. |
| C — profils | UUID, pseudo et dates de `profiles` | Valeurs conservées ; les UUID Auth correspondants restent une dépendance extérieure à la copie. |
| D — Auth | **Exclu** : aucune extraction de compte, identité, session ou token | Des lignes UUID minimales dans le seul cluster local servent à vérifier les FK ; aucun compte Auth, mot de passe ni fonctionnement de connexion restauré. |
| E — migrations | Version/nom des deux migrations observées et sources SQL Git | Point de reprise documenté ; ni sauvegarde des autres colonnes du ledger ni `migration repair` automatique. |
| F — hors base | Métadonnées non secrètes de cible, plan/région et réglages relus | Pas de sauvegarde de clés, signatures, SMTP, Storage, Edge ou réglages hébergés. |
| G — résidus | Manifeste, preuves, diagnostics et clusters locaux arrêtés dans le dossier privé | Sept jours pour réexaminer le sort de cette copie ; aucune purge automatique, copie secondaire ou publication de dump. |

## Dossier privé et secrets

Le chemin absolu choisi par l’exploitant reste dans la conversation et les preuves privées. Le dossier est hors dépôt, sans jonction observée ni dépôt parent englobant. Son héritage ACL est retiré : accès réservé à l’exploitant, SYSTEM et administrateurs locaux. Le sous-dossier de la tentative réussie a les mêmes protections ; la tentative initiale refusée avant copie est conservée séparément.

Le volume n’a pas été déclaré chiffré : l’exploitant a expressément dispensé cette copie de cette exigence. Une ACL ne chiffre pas les fichiers. L’exclusion cloud est **déclarée par l’exploitant**, sans certification technique de tous les synchroniseurs du poste. Les copies, réexports de comparaison, journaux et clusters locaux ont la même échéance de réexamen, le **5 novembre 2026**. Ne rien effacer sans décision, notamment en cas d’incident ou d’effacement utilisateur à réconcilier.

Le mot de passe PostgreSQL est saisi dans un champ local masqué et transmis au seul processus concerné par environnement. Il n’est écrit ni dans l’URL, ni dans les arguments, fichiers, Git, captures ou conversation. Il est libéré à la fin du processus. Ne pas utiliser `--debug`, `--create-ticket`, une transcription de terminal ou un dump CLI `--dry-run` avec accès réel : ce dernier peut imprimer le mot de passe résolu.

## Génération native exécutée

PostgreSQL **17.11**, obtenu depuis les [binaires Windows officiels](https://www.postgresql.org/download/windows/) distribués par EDB, fonctionne depuis un répertoire local ignoré. Aucun service Windows, PATH système, Docker Desktop, distribution WSL ou dépendance du site n’a été ajouté.

Les commandes suivantes décrivent la procédure opérateur ; elles ne sont pas un script autonome à lancer sans A. `$PgBin`, `$BackupDir` et `$SupabaseCa` désignent les chemins locaux vérifiés. Chaque destination doit être neuve. Les variables `PG*` héritées sont contrôlées, puis `PGPASSWORD` est alimenté par la saisie locale, `PGSSLMODE=verify-full`, `PGSSLROOTCERT=$SupabaseCa` et `PGCONNECT_TIMEOUT=10`. La CA publique est téléchargée depuis le lien certificat du panneau Connect/Database DEV, sans contourner la validation TLS.

```powershell
$Archive = Join-Path $BackupDir 'application.dump'
$SchemaSql = Join-Path $BackupDir 'application-schema.sql'
$DataSql = Join-Path $BackupDir 'application-data.sql'
$ArchiveToc = Join-Path $BackupDir 'archive-toc.txt'
& (Join-Path $PgBin 'pg_dump.exe') --host=db.wcckbyhrtroittbfophv.supabase.co --port=5432 --username=postgres --dbname=postgres --no-password --format=custom --schema=public --schema=bprea_private --strict-names --no-large-objects --no-publications --no-subscriptions --no-security-labels --quote-all-identifiers --lock-wait-timeout=10s --file $Archive
# Vérifier le code zéro avant chaque dérivation ; arrêt sans retry sur erreur.
& (Join-Path $PgBin 'pg_restore.exe') --schema-only --file $SchemaSql $Archive
& (Join-Path $PgBin 'pg_restore.exe') --data-only --file $DataSql $Archive
& (Join-Path $PgBin 'pg_restore.exe') --list --file $ArchiveToc $Archive
```

Les schémas explicitement sélectionnés sont essentiels : un dump Supabase CLI de données sans sélection peut inclure Auth/Storage. Les exclusions de la [CLI 2.121.0](https://github.com/supabase/cli/blob/v2.121.0/apps/cli/src/command-internal/pg-dump.env.ts) ne remplacent pas le périmètre explicite de `pg_dump` natif. Aucun dump de rôles globaux n’est ajouté par précaution.

Les [catalogues](../../scripts/verification-dev/catalogue.sql) et [privilèges](../../scripts/verification-dev/privileges.sql) sont capturés via `psql` en lecture seule avec la même cible explicite, puis comparés. Le manifeste privé conserve UTC début/fin, commit source, versions des outils, méthode, exclusions, neuf fichiers non vides, tailles/SHA-256, résultats et échéance. Les empreintes de copie, chemins nominatifs et données ne sont pas publiés dans Git ou Actions.

## Trois niveaux réellement vérifiés

| Niveau | Preuve obtenue le 29 octobre | Portée |
| --- | --- | --- |
| 1 — intégrité | Code zéro, archive lue par `pg_restore`, SQL dérivés, neuf fichiers non vides, tailles et SHA-256 recontrôlés | Fichiers intègres à l’instant vérifié |
| 2 — couverture | Quatre tables attendues, objets et ACL comparés aux catalogues ; absence d’Auth/Storage/Vault dans l’archive | Copie applicative bornée avant création des six tables personnelles |
| 3 — restauration | Import pre-data/data/post-data dans un cluster PostgreSQL natif neuf, FK validées, réexport des quatre tables et comparaison privée des blocs COPY triés ; structure/RLS/ACL effectives concordantes | Restauration PostgreSQL **applicative partielle**, avec dépendances Auth simulées seulement |

Les quinze fonctions du futur schéma ont aussi été reconstruites depuis les trois migrations sur une autre base vide. Cet essai synthétique est distinct de la restauration de la copie DEV et ne constitue pas une recette Auth/RLS sous JWT.

## Procédure de récupération isolée

1. Vérifier A, l’intégrité, la date et les suppressions intervenues depuis la copie. Ne jamais restaurer directement dans DEV ou PROD pour faire un essai.
2. Créer un cluster neuf privé `mon-bprea-lot6-1-local-…`, PostgreSQL 17.11, écoute uniquement `127.0.0.1` sur un port libre, authentification SCRAM et secret local éphémère. Aucun service, clé DEV, runner destructif existant, navigateur réel ou service Auth n’y est raccordé.
3. Créer les rôles sans connexion `anon`, `authenticated`, `service_role` et `supabase_admin` nécessaires aux propriétaires/ACL. Pour cet essai limité, préparer `auth.users(id uuid primary key)` et une fonction `auth.uid()` factice renvoyant NULL. Ne jamais appliquer cette simulation Auth à un projet hébergé.
4. Garder le schéma `public` initial d’initdb et son USAGE PUBLIC. Dans une copie privée du TOC, commenter **la seule entrée CREATE SCHEMA public déjà existante** ; conserver commentaire, propriétaire et ACL. L’omettre sans conserver le contexte initial change les droits.
5. Restaurer avec `pg_restore --exit-on-error --use-list=<liste-privee> --section=pre-data`, puis `--section=data`, vers le seul hôte/port locaux vérifiés. Avant post-data, construire les seules racines UUID locales à partir des données applicatives déjà importées ; elles ne créent aucune identité Supabase.
6. Restaurer `--section=post-data`, sans ignorer les erreurs ; reconstituer séparément version/nom du ledger pour la comparaison. Le trigger Auth, les comptes et les extensions gérées restent hors essai.
7. Relire structure et droits puis réexporter les quatre tables localement. Comparer chaque bloc COPY sans afficher les lignes. Une ACL nulle peut représenter les seuls droits implicites du propriétaire : qualifier ce cas après contrôle du propriétaire et des privilèges effectifs, sans ignorer un GRANT supplémentaire.
8. Arrêter le cluster et vérifier sa fermeture. Conserver preuves et copie dans le périmètre privé jusqu’à la décision de conservation ; ne pas réutiliser une ancienne instance ou supprimer un volume existant.

Une première restauration a révélé le contexte initial manquant de `public` ; son diagnostic est conservé. Le second essai, dans un autre cluster neuf, est celui validé. Aucun droit hébergé n’a été modifié pour faire réussir ce contrôle.

Une restauration de service réelle nécessiterait en plus Auth compatible, réglages/secrets, source Git, réconciliation des effacements et une autorisation distincte. Ne jamais recréer automatiquement un compte effacé ni substituer un nouvel UUID. Si ces dépendances manquent, conserver la copie et annoncer la limite.

Références : [backups Free](https://supabase.com/docs/guides/platform/backups), [restauration Supabase](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [pg_dump 17](https://www.postgresql.org/docs/17/app-pgdump.html), [pg_restore 17](https://www.postgresql.org/docs/17/app-pgrestore.html).
