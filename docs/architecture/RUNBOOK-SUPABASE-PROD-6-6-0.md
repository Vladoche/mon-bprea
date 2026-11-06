# Installation Supabase PROD de Mon BPREA

Ce runbook prépare le lot 6.6.0.D. Son exécution attend une décision humaine distincte qui identifie le commit, la cible, l’opérateur et la fenêtre. Le [rapport 6.6.0.C](../validations/VALIDATION-LOT6-6-0-C.md) distingue les preuves locales des vérifications encore nécessaires.

## 1. Décision et cible

1. Confirmer dans le tableau de bord privé l’organisation et le projet **Mon BPREA PROD**, référence `oqoqrxwfbkhtpksqimgd`, région `eu-central-1`. Comparer le statut, la version PostgreSQL 17.11 et les réglages à l’audit 6.6.0.B. Vérifier la liaison exacte entre l’URL Data API, l’hôte SQL direct et la référence. Toute différence suspend l’intervention.
2. Fixer le SHA complet du commit approuvé et partir d’un checkout propre. Le SHA de référence pour les fichiers historiques est `ffa90fae28e780d6e01e19769b14bd4a910d7ab4`. Le futur commit approuvé doit contenir les quatre migrations et le script préparatoire ci-dessous. Comparer la liste **complète** des migrations, le diff et les SHA-256. Vérifier également les références temporaires de la CLI et l’absence d’un mécanisme de déploiement concurrent.
3. Utiliser Supabase CLI **2.121.0** et `psql`, `pg_dump`, `pg_restore` **17.11**. Consulter `supabase migration up --help`, `supabase migration repair --help`, `psql --version` et l’aide des outils de sauvegarde. Refaire la répétition si la CLI, le pilote, la voie de connexion ou les migrations changent. La CLI v3 change les cibles par défaut. [Version CLI épinglée](https://github.com/supabase/cli/releases/tag/v2.121.0) · [Changements de la CLI v3](https://supabase.com/changelog/supabase-cli-v3)
4. Dans un terminal opérateur privé, charger uniquement les identifiants temporaires nécessaires depuis le coffre. Exclure les variables de test et les variables de connexion héritées (`PGHOST`, `PGHOSTADDR`, `PGSERVICE`, `PGOPTIONS`, `DATABASE_URL`, `SUPABASE_*` et équivalents). Créer un dossier CLI isolé avec la configuration et les templates versionnés, sans lien Supabase, fichier d’environnement ni cache de projet. Désactiver la télémétrie pour la session. Le chemin de connexion est direct, chiffré et vérifié avec le certificat de confiance. La CLI épinglée a accepté la bonne CA et le bon nom et refusé les deux contre-exemples en laboratoire local. En D, confirmer l’hôte, la CA de confiance et la connexion réelle en lecture seule avant toute écriture. Si la connexion directe ou la vérification TLS échoue, suspendre. [Connexion PostgreSQL Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres) · [Vérification TLS libpq](https://www.postgresql.org/docs/17/libpq-ssl.html)

Empreintes des fichiers UTF-8 après normalisation CRLF vers LF. Copier les migrations octet pour octet depuis le checkout approuvé. Une divergence d’empreinte interrompt la procédure.

| Ordre | Fichier | SHA-256 LF |
| --- | --- | --- |
| P | `prepare-permissions.sql` | `baeda047347505989cdab7b00a00709771d59d76468c5c0498ba55611cc70cdc` |
| M1 | `20261022000100_profiles.sql` | `e9a9de3f5c3e4111a66da44b9858dc8b126cbf6c2b433f9abc72d91bb8e303d5` |
| M2 | `20261024083417_create_drill_sync_schema.sql` | `31c9b77580e91dc865af5bec2b4a2bee14d9bfea40dd8aa28f17468e9f88399c` |
| M3 | `20261025143831_create_personal_data_backend.sql` | `e9d453c747ba097b0efce3ee09ad3a2503e5adba6a7af3916c2a963ca39ec8e3` |
| M4 | `20261106093143_restrict_application_service_role.sql` | `904d2372a7f8d6ac848adfa5f0f259440d8e7b269859e9feaf9f4342e529b1a2` |

## 2. Précontrôles et sauvegarde

- **Permissions et dépendances.** Vérifier `session_user = current_user = postgres`, la capacité `CREATE` sur la base et `public`, et `USAGE` sur `auth`. Contrôler les droits nécessaires à M1 sur `auth.users` (`SELECT`, `REFERENCES`, `TRIGGER`) et le droit `EXECUTE` sur `auth.uid()` pour les rôles nécessaires. Vérifier l’UUID et la clé unique d’`auth.users.id`, les extensions utiles, `pg_catalog.gen_random_uuid()`, `plpgsql` et les propriétaires. Distinguer `postgres`, `supabase_admin` et le rôle d’Auth. Relever `rolbypassrls`, les memberships et options `INHERIT` et `SET`, notamment tout chemin de `service_role` vers un propriétaire ou un rôle global de lecture/écriture. Un droit de création dans `public` pour un rôle API, un héritage inattendu ou une capacité absente impose l’arrêt.
- **ACL et inventaire.** Lire les ACL de schéma, de table et de colonnes ainsi que les ACL globales et `public` de `pg_default_acl` pour les deux créateurs. Relire les event triggers DDL. Avant M1, confirmer l’absence des objets et conflits applicatifs et l’absence de migration enregistrée. Une table de suivi vide et une table de suivi absente sont deux états à consigner séparément. Le [catalogue](../../scripts/verification-dev/catalogue.sql) suppose la table de suivi existante. Pour le premier relevé, tester d’abord `to_regclass('supabase_migrations.schema_migrations')`. La [requête de privilèges](../../scripts/verification-dev/privileges.sql) lit aussi les ACL par défaut. Ces fichiers reçoivent uniquement la connexion explicitement vérifiée et s’exécutent en lecture seule.
- **Périmètre de P.** Vérifier que `postgres` est le créateur prévu pour les migrations applicatives. La révocation globale touche ses **futures tables dans la base**, dans tous les schémas. Si un autre workflow légitime dépend d’un droit direct automatique de `service_role` sur de futures tables de ce créateur, arrêter pour arbitrage. Capturer les grants initiaux avec grantee, grantor, schéma, type et grant option. Relever aussi les ACL de `supabase_admin`, les défauts des séquences et le défaut global `EXECUTE` des fonctions. [Règles PostgreSQL sur les privilèges par défaut](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html)
- **Auth et Data API.** Relever les schémas exposés et le mode d’exposition automatique des nouvelles tables, y compris `graphql_public` si présent. `public` doit être exposé pour le client et `bprea_private` exclu. Vérifier que l’inscription libre et les connexions anonymes sont désactivées. Relever les réglages nécessaires au retour arrière sans exporter leurs secrets. Prendre uniquement le nombre de lignes d’`auth.users` et, si utile, des agrégats approuvés. Éviter la liste d’UUID, d’e-mails et de métadonnées dans les preuves. [Configuration des grants et de l’exposition](https://supabase.com/docs/guides/api/securing-your-api)
- **Sauvegarde.** Confirmer le mécanisme de snapshot et de restauration réellement disponible sur l’offre, les droits et les objectifs RPO/RTO approuvés. Capturer le point de restauration juste avant P, les ACL initiales et l’état du registre. Si un export logique est retenu et que le rôle peut couvrir le périmètre approuvé, utiliser `pg_dump --format=custom --file <archive-privée>` sur la connexion directe. Vérifier la sortie et le TOC avec `pg_restore --list <archive-privée>`, sceller l’empreinte et la date. Conserver l’archive chiffrée hors dépôt, sous accès restreint. La couverture doit inclure les dépendances Auth, l’historique s’il existe et les droits pertinents. Un dump d’une base ne porte pas les rôles globaux ni les réglages du fournisseur. Documenter séparément leur restauration et les dépendances exclues, ou choisir un snapshot fournisseur dont la couverture est attestée. [Options de sauvegarde Supabase](https://supabase.com/docs/guides/platform/backups)
- **Répétition de restauration.** Restaurer le périmètre choisi dans une cible isolée compatible avant d’autoriser l’installation. Pour l’option logique, utiliser la procédure ci-dessous sur une cible Supabase vierge. Vérifier les comptes et profils par agrégats, les ACL et rôles, les définitions, la liste de migrations et les services Auth/PostgREST. Une restauration de données réelles, si indispensable, exige une cible, une rétention et un mandat distincts. Définir à l’avance le traitement des changements et effacements effectués depuis le snapshot.
- **Fenêtre.** Réserver une fenêtre avec un seul opérateur de schéma. Suspendre les invitations et autres opérations d’administration Auth, les migrations et la mise en ligne de l’artefact connecté. Vérifier `pg_stat_activity` et `pg_locks` sur `auth.users`, `public` et le registre s’il existe. Consigner les PID et types de verrous, sans corps de requêtes. Réserver le temps de vérifier le backfill M1 et de reprendre en cas d’échec. Définir la borne d’attente DDL et de durée par requête, proposée à 5 s et 120 s. Confirmer dans la répétition que le pilote applique les paramètres de session. Une attente excessive, une transaction bloquante, un écart d’inventaire, une sauvegarde douteuse ou un autre opérateur actif impose l’arrêt.

Exemples **préparés pour le lot D**. `$ProdUri` désigne la connexion prévalidée à l’hôte SQL direct de la cible, avec TLS `verify-full`, CA approuvée et paramètres de session dans la valeur encodée d’`options` (`-c lock_timeout=5s -c statement_timeout=120s`). Ces délais ont été observés via la CLI sur PostgreSQL natif. La CLI et libpq doivent être testés avec la méthode TLS et l’authentification privée retenues. Garder le mot de passe dans le processus privé et l’URI hors du journal.

```powershell
git status --porcelain
git rev-parse HEAD
& $Cli --version
$target = [uri]$ProdUri
if ($target.Scheme -ne 'postgresql' -or $target.Host -ne 'db.oqoqrxwfbkhtpksqimgd.supabase.co' -or
    $target.UserInfo -ne 'postgres' -or $target.Port -ne 5432 -or $target.AbsolutePath -ne '/postgres' -or
    $target.Query -notmatch '(^\?|&)sslmode=verify-full(&|$)') { throw 'Cible SQL inattendue' }
& $Psql -X -w -v ON_ERROR_STOP=1 -d $ProdUri -c "begin read only; select current_database(), session_user, current_user, inet_server_addr(), inet_server_port(), current_setting('server_version'); select ssl, version from pg_stat_ssl where pid = pg_backend_pid(); select to_regclass('supabase_migrations.schema_migrations'), to_regclass('auth.users'), to_regprocedure('auth.uid()'), to_regprocedure('pg_catalog.gen_random_uuid()'); select count(*) from auth.users; commit;"
```

Exécuter chaque commande séparément et contrôler son code de sortie. `pg_stat_ssl` confirme le chiffrement de la session, tandis que la vérification du certificat et du nom relève du client.

### Restauration logique sur une cible Supabase isolée

Inventorier les ACL de création **avant** de restaurer. Sur une cible Supabase préconfigurée, le premier essai a rendu des droits supplémentaires à des rôles API. Les ACL d’objet d’une archive logique supposent les défauts PostgreSQL à la création. Les grants Supabase supplémentaires de la cible peuvent donc subsister malgré le succès de `pg_restore`. Si le profil de la cible diffère, arrêter et établir la matrice de restauration pour ses créateurs, ses schémas et ses défauts globaux.

Dans le cas répété localement, la source et la cible avaient la même image et les mêmes migrations Auth. Le TOC sélectionne les objets, données et ACL des schémas applicatifs et du registre, les lignes `auth.users` puis `auth.identities` et le seul trigger applicatif sur `auth.users`. Les objets Auth gérés existent déjà sur la cible. Les nouvelles sessions sont émises par Auth après restauration. Un autre périmètre de données ou de services exige un TOC et une preuve propres.

Rendre le TOC en SQL dans un fichier privé. Pour les défauts observés en local, préparer le prélude ci-dessous et un fichier de contrôle qui lève une exception si les ACL de table, de colonne ou de fonction donnent un droit inattendu. L’archive conserve les entrées `DEFAULT ACL` à rejouer après les objets. Lancer le prélude, le SQL et le contrôle **dans une seule transaction**. Confirmer l’absence de `COMMIT` interne et de changement de connexion dans le SQL généré. Comparer les ACL par défaut et les ACL effectives, le schéma et les données après succès.

```sql
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, service_role;
```

```powershell
& $PgRestore --use-list $RestoreToc --file $RestoreSql $RestoreArchive
& $Psql -X -w -v ON_ERROR_STOP=1 --single-transaction -d $RestoreUri -f $RestorePrelude -f $RestoreSql -f $RestoreAclGuard
```

## 3. Installation par étapes

1. **P.** Dans la fenêtre, exécuter le [script de préparation](../../scripts/verification-prod/prepare-permissions.sql) sous `postgres`. Il modifie uniquement les ACL par défaut de table pour ce rôle et ce bénéficiaire. Sa transaction retire les grants globaux puis ceux de `public`, et crée puis retire une table témoin qui détecte les droits effectifs via d’autres rôles ou `PUBLIC`. À l’échec, vérifier que les ACL initiales sont intactes et que le témoin est absent. Après succès, comparer les ACL aux relevés et vérifier l’absence du témoin et de toute version ajoutée au registre.
2. **M1.** Dans `$Stage`, préparer `supabase/config.toml`, les templates référencés et `supabase/migrations` vide. Copier uniquement M1. Appliquer une seule migration via la commande ci-dessous. Vérifier l’unique entrée M1, les définitions de `profiles`, du trigger sur `auth.users` et des deux fonctions privées. Comparer le compte d’Auth initial, le nombre de profils et les deux résultats de jointure anti-jointe. Examiner les logs Auth au voisinage du commit. Vérifier les grants de colonne et l’absence de droit direct de `service_role` avant M2.
3. **M2.** Ajouter M2 au préfixe déjà validé de `$Stage`, puis répéter la même commande et les audits. Vérifier les trois tables Drill, les six politiques ajoutées, les clés composées et les RPC invoker. Confirmer que les profils et leur nombre sont préservés. Relever les droits effectifs de `service_role` sur les quatre tables.
4. **M3.** Ajouter M3 au préfixe. Vérifier les six tables, leurs contraintes, politiques, triggers et RPC, ainsi que l’intégralité des profils. Confirmer que les ACL des dix tables, neuf RPC et six fonctions privées sont conformes.
5. **M4.** Ajouter M4 au préfixe. Vérifier le quatrième enregistrement, l’identité du catalogue métier avant/après et l’absence de droits de `service_role`. Comparer les ACL par défaut au relevé pris après P. Conserver les quatre versions et leurs empreintes dans le dossier d’intervention. P est journalisée dans ce dossier comme opération préparatoire.

Commandes **préparées, jamais exécutées sur PROD dans le lot C**. Le préfixe contient les versions déjà validées plus exactement le prochain fichier. Contrôler les empreintes de la copie et le registre **avant chaque invocation**. Après chaque code de sortie 0, exécuter les deux audits et comparer les valeurs au tableau.

```powershell
& $Psql -X -w -v ON_ERROR_STOP=1 -d $ProdUri -f scripts/verification-prod/prepare-permissions.sql

# Pour chacun des quatre pas, attribuer $Next au prochain fichier vérifié, puis s'arrêter pour les contrôles.
Copy-Item -LiteralPath (Join-Path 'supabase/migrations' $Next) -Destination (Join-Path $Stage 'supabase/migrations')
& $Cli migration up --workdir $Stage --db-url $ProdUri --agent no --yes
& $Psql -X -w -v ON_ERROR_STOP=1 -d $ProdUri -f scripts/verification-dev/catalogue.sql
& $Psql -X -w -v ON_ERROR_STOP=1 -d $ProdUri -f scripts/verification-dev/privileges.sql
```

| Après | Tables | Colonnes | Contraintes | Index | RLS | Fonctions | Triggers | Versions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| M1 | 1 | 4 | 3 | 1 | 2 | 2 | 2 | M1 |
| M2 | 4 | 29 | 28 | 9 | 8 | 7 | 5 | M1 à M2 |
| M3 | 10 | 98 | 95 | 24 | 24 | 15 | 11 | M1 à M3 |
| M4 | 10 | 98 | 95 | 24 | 24 | 15 | 11 | M1 à M4 |

M1 à M3 ont chacune leur propre `BEGIN` et `COMMIT`. La CLI 2.121.0 enregistre la version après les instructions du fichier. La répétition a provoqué un échec de l’écriture du registre **après le COMMIT de M2** et retrouvé les objets M2. La CLI a annulé les modifications du correctif M4 lorsqu’une instruction injectée avant sa fin a échoué. La garantie de moindre privilège pour M1 à M3 repose sur P exécutée avant les créations, l’identité du propriétaire et le gel des DDL concurrents. Une migration corrective appliquée après les trois fichiers n’offre pas cette garantie sur une installation directe. [Source CLI épinglée et suivi de migration](https://github.com/supabase/cli/blob/v2.121.0/apps/cli-go/pkg/migration/file.go)

## 4. Contrôles de fin

1. Comparer les définitions réelles à la référence de répétition et au SQL approuvé. Trier les catalogues par identité logique et normaliser les fins de ligne. Vérifier types, défauts, colonne générée, CHECK, clés étrangères et cascades, unicités et index valides. Relever les 24 politiques avec leurs rôles, commandes, `USING` et `WITH CHECK`. Les dix tables doivent activer RLS. Le seul `SECURITY DEFINER` applicatif est le trigger de profil, propriétaire `postgres`, avec `search_path` vide. Les neuf RPC et les cinq autres fonctions privées sont invoker, avec le même `search_path` vide.
2. Vérifier la matrice des privilèges effectifs. `authenticated` lit ses données et écrit les seules colonnes prévues. `anon` et `service_role` ont zéro droit de table ou de colonne applicative et zéro `EXECUTE` sur les routines applicatives. Les rôles API n’ont ni `USAGE` ni `CREATE` dans `bprea_private`. Vérifier le registre, les noms et, si nécessaire, comparer les instructions enregistrées au fichier approuvé après normalisation de la CLI.
3. Confirmer par agrégats que chaque compte Auth a exactement son profil, qu’aucun profil n’est orphelin et que les données existantes sont préservées. Relire les erreurs Auth (profil, invitations), PostgreSQL (ACL, verrous, FK) et PostgREST (cache et permissions). Comparer la liste des schémas exposés et les réglages Auth/Data API aux relevés initiaux. Le lot backend n’active pas l’artefact Pages connecté.
4. Effectuer les tests non destructifs approuvés. Vérifier via la clé publique un GET anonyme refusé sur `profiles` et un GET avec JWT invalide rejeté. Consigner codes HTTP et SQLSTATE sans publier de clé, de jeton ni de ligne. Si des comptes de recette existent déjà et sont autorisés, utiliser leurs sessions pour comparer des lectures propres et croisées en lecture seule. À défaut, reporter cette preuve à la stack locale. Lancer les RPC d’écriture, les tests d’expiration avec sessions générées et les suppressions de compte uniquement dans la répétition isolée.
5. Lever les suspensions opérationnelles après validation des contrôles. Révoquer les accès de session temporaires et retirer les variables de connexion du terminal. Confirmer que les réglages et contrôles opératoires reviennent à leur état prévu. Joindre preuves, horodatages, anomalies et décision au dossier D.

## 5. Arrêt et reprise

1. À tout écart, stopper le préfixe en cours, garder le site connecté fermé et conserver le gel des opérations Auth. Relever dans une nouvelle session les objets, ACL effectives, comptes/profils agrégés, verrous et registre. Vérifier l’état réel même après une interruption qui a empêché de recevoir le résultat du `COMMIT`.
2. **Objets absents, version absente.** Une fois la cause corrigée et l’état précédent confirmé, rejouer uniquement le prochain fichier depuis le préfixe vérifié. Si l’échec concerne P, vérifier l’égalité des ACL, puis relancer P après résolution de la cause.
3. **Objets conformes, version absente.** Comparer le catalogue entier, les droits, la conservation des données et les empreintes avant toute intervention sur le registre. Après autorisation explicite pour ce cas, la commande préparée est `supabase migration repair --workdir <préfixe> --db-url <cible-vérifiée> --status applied <version-exacte>`. Elle ne réexécute pas le fichier. Relire l’état complet avant de poursuivre. Un écart partiel ou une version enregistrée sans objets correspondants impose un examen manuel et une décision distincte.
4. **Trigger Auth en erreur.** Suspendre les créations. Relire les contraintes, le rôle propriétaire, le corps et les ACL du trigger, puis les comptes/profils. Si un compte manque après une invitation déjà tentée, vérifier la transaction et l’état réel avant toute nouvelle invitation. Réparer par un delta revu ou restaurer selon le périmètre. Toute compensation doit préserver les données arrivées depuis le point de sauvegarde.
5. **Restauration.** La privilégier si l’état ne peut être réconcilié par une correction ciblée prouvée. Restaurer d’abord en cible isolée, comparer données et schéma, réconcilier le registre d’effacements et les changements depuis le snapshot. Un retour sur PROD exige une décision séparée après évaluation de l’impact Auth et des données écrites depuis le snapshot. Toute remise d’ACL pré-P se fait à partir du relevé exact, après vérification des objets présents et du risque d’accès que cette remise réintroduirait.
