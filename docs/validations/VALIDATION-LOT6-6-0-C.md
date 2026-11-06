# Lot 6.6.0.C · Permissions Supabase et répétition

6 novembre 2026 · Base Git `ffa90fae28e780d6e01e19769b14bd4a910d7ab4` · Projet hébergé de référence `oqoqrxwfbkhtpksqimgd` · [Runbook pour le lot D](../architecture/RUNBOOK-SUPABASE-PROD-6-6-0.md)

La première répétition s’est arrêtée au statut `BLOCKED`, faute de moteur de conteneurs. La recette a repris après l’installation de Docker Desktop. Le [verdict du lot](#g-verdict-et-conditions-de-déploiement) repose sur les deux passages.

## A. Diagnostic et arbitrage

Le signal 6.6.0.B révèle un **excès de privilèges applicatifs conditionnel**, en défense en profondeur. Le rôle Supabase `service_role` a normalement `BYPASSRLS`. L’accès à une relation exige encore les privilèges SQL sur cette relation. L’état PROD transmis pour B comporte zéro table applicative et zéro migration. L’inspection du code et de l’artefact local n’a révélé aucune clé administrative côté navigateur. Le scénario reproduit est un accès direct excessif après installation avec des grants par défaut. Dans la base témoin, `service_role` a pu lire les **deux** profils fictifs sans identité étudiante, et disposait de `SELECT` sur les trois tables Drill. Une clé administrative compromise peut toujours permettre des opérations sensibles sur Auth, y compris une suppression avec cascade. [Clés Supabase et rôles](https://supabase.com/docs/guides/getting-started/api-keys) · [Grants et RLS](https://supabase.com/docs/guides/api/securing-your-api)

| Surface | Chemin et privilège utilisé |
| --- | --- |
| Auth dans Pages | Client et service partagés. Configuration publique désactivée dans le dépôt. En mode connecté, clé `sb_publishable_` et JWT étudiant pour les sessions. Invitation et récupération sur le flux Auth prévu. |
| Data API du navigateur | Lecture de `profiles` et mise à jour du pseudo. Lecture du Drill, des six tables personnelles et de l’export sous la session utilisateur. Trois RPC Drill et six RPC personnels pour les écritures. |
| Publication et variables | Artefact local de 135 fichiers, dont 112 fichiers texte analysés. Zéro jeton JWT de rôle `service_role`, zéro chaîne de clé `sb_secret_` détectée, zéro référence `process.env`, `import.meta.env` ou `Deno.env` dans ce périmètre. `auth-config.local.json` a été classé « publishable » sans afficher sa valeur. La configuration locale, les scripts, la stack et les tests sont exclus de l’artefact. |
| Exploitation | Invitations natives et récupération via service de confiance et API Auth Admin. Le générateur de liens et les runners emploient la clé administrative dans le processus opérateur. La sauvegarde passe par une connexion SQL autorisée. |
| Prototype `close-account` | Actif uniquement avec garde éphémère locale. `auth.admin.getUserById` et `deleteUser` côté serveur. Les lectures de confirmation des dix tables utilisent le JWT de l’utilisateur. La suppression des lignes métier repose sur les FK en cascade. |

[Architecture Auth](../architecture/AUTHENTIFICATION.md) · [Validation publique de la configuration](../../scripts/prepare-pages.py) · [Prototype de clôture](../../supabase/functions/close-account/index.ts)

| Stratégie | Sécurité et compatibilité | Maintenance, migrations et exploitation |
| --- | --- | --- |
| A · Grants Supabase standard | Compatible avec des backends qui doivent lire plusieurs comptes. Avec les anciens défauts, une clé administrative permet les accès directs sans RLS sur les quatre tables historiques. Les six tables personnelles appliquent déjà une exception. | Aucun correctif immédiat. Il faut maintenir deux comportements et documenter les accès par table. Pas de consommateur métier identifié pour ces quatre grants. |
| **B · Restreindre l’accès direct aux objets Mon BPREA** | Réduit les droits sur les dix tables et maintient le modèle Supabase pour Auth. Les RPC restent sous la session et les grants de l’étudiant. Le rôle de migration SQL et les cascades Auth restent disponibles. | P avant une première installation et M4 pour converger sur un schéma existant. Faible changement applicatif. L’API Auth Admin et le prototype doivent encore passer la recette Supabase réelle. Un futur traitement multi-comptes devra faire l’objet d’un grant dédié et d’une revue. |
| C · Rôles ou interfaces dédiées | Intéressant si un futur traitement de confiance a un périmètre métier précis. Un rôle propriétaire dédié pourrait aussi isoler les défauts DDL par créateur. | Nouvel acteur SQL ou RPC, exploitation et validation supplémentaires. Risque lié aux transferts de propriété, à la FK et au trigger sur `auth.users`. Pas de besoin métier actuel qui justifie ce changement. |

**B est retenue.** Sur les objets applicatifs, `service_role` n’obtient ni accès direct aux données ni exécution des RPC. La stratégie laisse en place le rôle Supabase et ses usages Auth Admin. La clé de confiance reste un secret d’exploitation.

## B. Correctif et suivi

M1 et M2 retirent les privilèges de table à `PUBLIC`, `anon` et `authenticated`, puis accordent à ce dernier la lecture et les seules colonnes requises. Elles omettent `service_role` pour ces quatre tables. M3 révoque déjà ses privilèges de table sur les six autres. Les trois migrations retirent `EXECUTE` à `PUBLIC`, `anon` et `service_role` sur leurs routines. Les neuf RPC publiques ont `EXECUTE` pour `authenticated`. Les six fonctions privées servent aux triggers. Seule `create_profile_for_auth_user()` est definer. Son propriétaire est `postgres`, son `search_path` est vide et son écriture utilise uniquement `NEW.id`. Les autres fonctions sont invoker avec le même `search_path` vide.

| Option | Décision et conséquence |
| --- | --- |
| Modifier M1 à M3 | Écartée. Les versions sont déjà utilisées dans DEV et leurs empreintes font partie des preuves. Réécrire leurs fichiers créerait deux historiques sous les mêmes versions. |
| Insérer une migration numérotée avant M1 | Écartée. Elle placerait une version inédite avant le dernier enregistrement dans les bases déjà installées et compliquerait le rapprochement du registre. |
| M4 seule après M3 | Adaptée au rattrapage d’un schéma existant. Dans le modèle historique testé, elle laisserait les quatre tables accessibles entre les commits de M1/M2 et M4 sur une première installation. |
| Transaction enveloppant les trois migrations | Écartée sous leur forme actuelle. Leurs `COMMIT` ferment leur transaction. Un simple `psql --single-transaction` ne rend pas le lot atomique. Réécrire les scripts à la volée créerait un chemin SQL et de suivi supplémentaire. |
| **P transactionnelle, puis préfixes M1 à M4** | Retenue pour la première installation. P normalise les défauts de création avant M1 et vérifie une table témoin dans la même transaction. Chaque version est appliquée avec la CLI. Le registre contient quatre entrées. Le journal d’intervention et l’empreinte de P attestent sa réalisation séparément. |

P et M4 révoquent les défauts de table pour le créateur `postgres` au niveau global **et** dans `public`. Le retrait limité à `public` a laissé le `SELECT` global dans l’expérience. Les défauts de `supabase_admin`, de fonction et de séquence restent hors du correctif. Le défaut PostgreSQL `EXECUTE` à `PUBLIC` sur de nouvelles fonctions requiert des révocations explicites au moment de créer chaque future routine métier. Le runbook fixe `postgres` comme rôle de création. Il prévoit un arrêt si un workflow légitime dépend du défaut global de table pour ce créateur ou si les défauts, les grants hérités ou les event triggers réels divergent. [Sémantique de `ALTER DEFAULT PRIVILEGES`](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html)

M4 retire les grants sur les quatre tables et sur `bprea_private`, puis vérifie les droits de table et de colonne effectifs sur les dix tables ainsi que les droits de schéma. Une ACL héritée par `service_role` bloque l’étape. Le même ensemble de migrations converge avec P avant M1 et avec les ACL historiques avant M4. Les catalogues séparés ont été comparés en totalité. La protection des frontières M1/M2 a été constatée sur le modèle local préparé. Elle dépend en PROD du créateur effectif, du résultat de P, des réglages vérifiés et de l’absence de DDL concurrent.

| Fichier | Justification |
| --- | --- |
| [P](../../scripts/verification-prod/prepare-permissions.sql) | Préparer les ACL et tester le résultat effectif avant le premier objet métier. |
| [M4](../../supabase/migrations/20261106093143_restrict_application_service_role.sql) | Corriger les ACL des bases historiques et des créations futures de `postgres`, avec vérification dans la migration. |
| [pgTAP](../../supabase/tests/database/service_role_privileges.test.sql) et [runner Auth](../../scripts/test-supabase.mjs) | Cibler les dix tables, quinze fonctions et défauts de création. Vérifier en HTTP que la même clé locale conserve Auth Admin et reçoit `42501` pour les tables. |
| [Fixture de liens manuels](../../tests/helpers/auth-manual-local.js) | Observer le profil avant activation et après suppression depuis le conteneur PostgreSQL de test. La lecture est bornée à l’UUID fictif, dans une transaction read-only. La fixture Auth Admin utilise désormais l’API Auth pour l’administration des comptes. |
| [Répétition](../../scripts/verification-prod/rehearsal-local.mjs) et [scénarios SQL](../../scripts/verification-prod/rehearsal-data.mjs) | Prouver installation, ACL, tests métier, pannes et restauration sur des données fictives, avec un exécutable CLI épinglé. |
| [Runbook](../architecture/RUNBOOK-SUPABASE-PROD-6-6-0.md) | Encadrer l’identification, les empreintes, la sauvegarde, l’ordre, les arrêts et la reprise sous mandat distinct. |

## C. Répétition PostgreSQL

CLI 2.121.0, Node.js 24.22.0, npm 10.4.0, PostgreSQL et outils 17.11. Au premier passage, l’essai `supabase start --workdir <copie-isolée> --agent no` est parti d’une configuration neuve sans lien ni migration. Le contrôle des conteneurs a échoué avec `docker: command not found (podman also not found)`. Les runners HTTP ont attendu le second passage.

Le repli initialise un cluster neuf sur `127.0.0.1`, port éphémère, authentification SCRAM et bases isolées d’installation, de comparaison et de restauration. Il utilise une liste blanche d’environnement, un `SUPABASE_HOME` neuf et une identité de serveur contrôlée avant d’écrire. `postgres` est un rôle de migration non-superutilisateur. Le bootstrap distinct crée les rôles, `auth.users` et la fonction `auth.uid()` de simulation, ainsi que les défauts larges sur `public` pour les deux créateurs et un `SELECT` global de `postgres` pour `service_role`. La condition globale est un cas de test volontaire. Les ACL brutes exactes de PROD et ses éventuels event triggers n’ont pas été importés. Le second passage vérifie l’exposition effective des schémas avec PostgREST.

L’installation part de zéro table et zéro version applicative. A existe dans `auth.users` avant M1, B est créé après M1 et un troisième compte fictif sert au test du trigger après M4. A et B ont chacun une ligne par table, issues des parcours SQL. Les objets utilisent les primitives PostgreSQL 17 et les rôles locaux simulés. `plpgsql`, `pg_catalog.gen_random_uuid()` et la dépendance `auth.uid()` ont été exercés. Les extensions et schémas gérés du fournisseur restent hors de cette reproduction.

| Frontière | Tables | Colonnes | Contraintes | Index | Politiques | Fonctions | Triggers | Registre |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Après M1 | 1 | 4 | 3 | 1 | 2 | 2 | 2 | `20261022000100` |
| Après M2 | 4 | 29 | 28 | 9 | 8 | 7 | 5 | M1, `20261024083417` |
| Après M3 | 10 | 98 | 95 | 24 | 24 | 15 | 11 | M1–M2, `20261025143831` |
| Après M4 | 10 | 98 | 95 | 24 | 24 | 15 | 11 | M1–M3, `20261106093143` |

Le catalogue contient les définitions et non les seuls compteurs. Contrôles sur la colonne générée `series_key`, les défauts `auth.uid()`, onze FK avec cascade, CHECK validés, index et unicités, propriétaires, corps et signatures des fonctions, modes de sécurité, `search_path`, ACL et triggers. Les 24 politiques sont vérifiées individuellement pour commande, rôle et prédicats. Les dix tables activent RLS. Les définitions et privilèges sont comparés à une deuxième installation des fichiers versionnés. La CLI a appliqué les délais de session de 5 s pour les verrous et 120 s par instruction dans le test natif.

## D. QA et commandes exécutées

| Commande | Résultat et portée |
| --- | --- |
| `npm ci` | Installation verrouillée, code 0. |
| `npm test` | 52 suites, 558 tests réussis et 1 ignoré. Windows a refusé la création du lien symbolique de test (`EPERM`). Le passage hors bac à sable et le passage après correction de la fixture donnent les mêmes totaux. |
| `npx playwright install chromium` | Téléchargement initial bloqué par DNS, puis réussi via l’autorisation réseau. Chromium 156.0.8078.4 dans un répertoire dédié. |
| `npm run test:e2e -- --workers=2 --output <dossier-neuf>/results` | **107 réussis**, également au dernier passage après correction de la fixture. Rapport HTML séparé. Pages desktop et mobile sombre, données locales conservées à la déconnexion en HTTP simulé, parcours Drill et personnels. |
| `python scripts/prepare-pages.py --version ffa90fae28e7 --output <dossier-neuf>` | Artefact local généré et inventorié sans activation Auth. |
| `node scripts/verification-prod/rehearsal-local.mjs <bin-PG17> <exe-CLI-2.121.0>` | **Code 0** pour la répétition PostgreSQL finale. Le runner invoque `psql -X -qAt -v ON_ERROR_STOP=1 -v VERBOSITY=verbose`, `migration up --db-url <boucle-locale> --workdir <préfixe> --agent no --yes`, `migration repair --status applied 20261024083417` sur la même cible locale, `pg_dump --format=custom` et `pg_restore --exit-on-error --single-transaction --use-list <TOC>`. |
| Cinq fichiers `supabase/tests/database/*.test.sql` via ce runner | **413 assertions pgTAP** sur PostgreSQL 17.11, réparties en clôture 36, Drill 89, personnel 242, profils 19, moindre privilège 27. Extension pgTAP 1.3.4 assemblée à partir de sa source publiée dans une copie dédiée de PostgreSQL. [Source pgTAP](https://api.pgxn.org/src/pgtap/pgtap-1.3.4/) |
| Suites de la stack Supabase | Exécutées après installation de Docker Desktop. Voir [la recette complète](#f-recette-avec-docker-desktop). |

- **RLS SQL A/B.** Chaque rôle `authenticated` lit ses dix lignes et obtient zéro ligne pour l’autre compte. Les mises à jour croisées des cinq tables modifiables touchent zéro ligne. L’injection d’un propriétaire B et l’écriture des champs serveur échouent. Les rattachements Drill et botaniques à un objet de B sont refusés. Un contexte sans claim `sub` voit zéro ligne. Les métadonnées fictives de rôle et d’identité ne changent pas la décision.
- **Privilèges SQL.** DELETE étudiant refusé sur les dix tables. `anon` et `service_role` refusés sur les dix lectures et les neuf RPC. Fonctions privées refusées pour les trois rôles API. Les ACL effectives incluent les colonnes et les droits de schéma. La table témoin créée par `postgres` après la migration ne reçoit aucun droit automatique de table ni de colonne pour `service_role`.
- **Fonctions.** Création du profil automatique, backfill du compte antérieur, pseudo valide et contrainte de longueur. Drill créé, réponse correcte et entraînement incorrect calculés par les guards, replay reconnu et doublon divergent sans nouvelle ligne. Cours coché puis décoché, QCM et réponse botanique idempotents, session complétée, préférence d’apparence modifiée. Deux sessions soumettent la même révision ITK, avec un gagnant, un conflit et une seule révision finale.
- **Périmètre du premier passage.** Les claims sont injectés dans la session PostgreSQL. Les vérifications JWT, invitations, récupérations, fermeture Auth et transports HTTP font partie du second passage.

Le premier lancement Playwright a utilisé le dossier de sortie par défaut et a nettoyé le répertoire ignoré préexistant `test-results`. Son contenu précédent n’a pas été récupéré. Le passage réussi a isolé les résultats et le rapport dans `.tmp/lot660c-e2e-9b562ee904c44b01a93c72d6ef5a1bff`. Le navigateur employé est le Chromium de test avec des contextes isolés.

Le premier accès TCP PostgreSQL a été refusé dans le bac à sable. La répétition en boucle locale a été relancée sous autorisation. Le premier essai de pgTAP a relevé l’absence d’`USAGE` sur `extensions` dans le modèle Auth. Cette habilitation a été ajoutée au bootstrap fictif et les cinq suites ont réussi. Le premier comparateur de restauration a signalé l’ACL de schéma implicite après restauration. Le comparateur final résout cette ACL via `acldefault` et compare aussi le propriétaire et les ACL effectives.

## E. Pannes, reprise et sauvegarde

Les fautes injectées se trouvent dans des copies de test des migrations. Les fichiers historiques du dépôt ont gardé leurs octets. L’état est relu avec une nouvelle connexion après chaque échec. Les empreintes du catalogue et des lignes, les ACL par défaut et le registre sont comparés. La table de suivi vide créée par la CLI avant un premier échec M1 est consignée séparément.

| Incident | État observé | Reprise démontrée et décision |
| --- | --- | --- |
| Échec pendant M1 | Division par zéro avant `COMMIT`. Zéro objet métier, zéro version, compte A conservé. La CLI peut avoir créé son registre vide. | Fichier original réappliqué. Backfill de A et profil de B vérifiés. Reprendre après correction de la cause. |
| Échec pendant M2 | État M1 intact, une table, un enregistrement et deux comptes. | Retrait de la faute puis poursuite ciblée de M2. L’incident séparé de registre décrit ci-dessous requiert un contrôle manuel. |
| Échec pendant M3 | État M2 intact, quatre tables, deux versions. Profils et ACL conservés. | Reprise avec le fichier original et validation des dix tables. |
| Interruption entre migrations | Arrêt volontaire entre M1 et M2, lecture de l’état et création de B par la dépendance Auth locale. | Reprise du préfixe depuis le registre M1, profil antérieur préservé. |
| Schéma validé, historique en retard | Le trigger d’injection fait échouer l’écriture de M2 dans le registre. Quatre tables déjà visibles, seulement M1 au registre, `service_role` sans lecture même pendant cet écart. | Intervention manuelle locale sur **M2 seule** après inventaire, avec `migration repair --status applied 20261024083417`. Le catalogue et les données restent identiques, les instructions M2 sont présentes au registre. |
| Rejeu involontaire | La CLI ignore les quatre versions présentes. Le rejeu SQL direct de M2 échoue sur `42P07`. Les deux essais conservent l’état. | Reprendre via le registre vérifié. Aucun nettoyage d’objets requis. |
| Trigger de profil en erreur | Une contrainte de test produit `23514`. Le nouvel utilisateur Auth fictif et le profil sont absents. A et B restent intacts. | Retrait de la faute injectée, création réussie du même compte fictif, puis retrait ciblé de ce compte. |
| Correction de permissions interrompue | P rencontre un droit hérité et annule ses modifications. M4 échoue avec une faute en fin de fichier et conserve les ACL et trois versions précédentes. M4 refuse également un SELECT de colonne hérité. | Relire les ACL globales et locales, diagnostiquer l’origine de l’héritage. Dans le modèle, retrait du seul grant fictif, reprise de P/M4 et vérification du résultat. En exploitation, toute correction de rôle héritée exige une décision de périmètre. |

Pour un état partiel ou incertain, la procédure du runbook suspend le lot, compare les objets et le registre dans une nouvelle session et choisit une correction ciblée ou une restauration.

**Restauration exécutée.** `pg_restore` a restauré une base distincte du cluster isolé, avec les rôles fictifs déjà en place. Les vingt lignes des dix tables, les deux racines Auth, le catalogue normalisé, les ACL par défaut et le registre des quatre migrations correspondent à la source. Après le snapshot, une suppression SQL de A a retiré exactement ses dix lignes, préservé les dix de B et laissé la copie restaurée intacte. Le cluster a été arrêté. L’archive `synthetic.dump` a le SHA-256 `3c4aae8911abcb642125af12be491ee5774579586c879607f82280a99eda86c8`.

Les preuves PostgreSQL natif sont dans `.tmp/lot660c-native-iJrUK5`, avec `events.json`, `initial-acl.json`, `m2-without-ledger.json`, `final-catalogue.json`, `final-acl.json`, `ledger.json`, les cinq fichiers TAP et `restored-catalogue.json`. Ces artefacts restent hors de Git et de Pages.

## F. Recette avec Docker Desktop

La reprise utilise Docker 29.9.2 en mode Linux via le socket local `desktop-linux` et la CLI 2.121.0. La copie du projet a été créée sans fichier de liaison ni migration initiale. Les variables de connexion ambiantes sont exclues. PostgreSQL utilise l’image `17.11.0.004`. Auth `v2.197.0`, PostgREST `v16.4`, Mailpit `v1.31.3`, Kong `2.8.1` et Edge Runtime `v1.77.4` ont été démarrés. L’inscription publique et la connexion anonyme étaient désactivées. La capture SMTP restait interne. PostgREST exposait `public` et `graphql_public`, avec `public,extensions` dans le chemin de recherche et `bprea_private` rejeté par HTTP 406.

Sous Docker Desktop, le réseau dédié avec `host_binding_ipv4=127.0.0.1` a tout de même donné des ports publiés sur toutes les interfaces au premier démarrage. L’instance a été arrêtée avant la création des comptes de test et avant P. Pour les essais suivants, un adaptateur local de la commande Docker a ajouté explicitement `127.0.0.1` aux publications de la CLI. L’inspection Docker a confirmé les trois ports source `54321`, `54322`, `54324` et les ports de restauration `45321`, `45322`, `45324`, exclusivement sur la boucle locale. Studio et postgres-meta étaient exclus. Le premier port tenté pour le PostgreSQL de restauration, `55322`, a été refusé par Windows. [Paramètre de liaison des ports Docker](https://docs.docker.com/engine/network/drivers/bridge/#default-host-binding-address)

Dans l’image Supabase, `postgres` et `supabase_admin` avaient initialement des défauts larges de table et de séquence et le droit `EXECUTE` de fonction dans `public` pour les rôles API. Le `SELECT` global injecté au premier passage ne figurait pas dans cette image. Les event triggers PostgREST étaient présents. Les quatre étapes de migration ont retrouvé les chiffres du tableau. Les tables, colonnes, contraintes, index, politiques, fonctions et triggers correspondent exactement aux définitions du catalogue de répétition natif. Les ACL effectives à chaque frontière et les défauts des deux propriétaires ont été archivés.

| Commande ou scénario | Résultat |
| --- | --- |
| `supabase start --workdir <copie-isolée> --network-id <réseau-dédié> --exclude studio,postgres-meta --agent no` | Services requis démarrés. Ports vérifiés avant toute fixture. |
| `psql -X -v ON_ERROR_STOP=1 -f prepare-permissions.sql`, puis `supabase migration up --workdir <préfixe> --db-url <boucle-locale> --agent no --yes` pour chaque étape | P puis M1–M4 réussies. Un compte préexistant a reçu son profil et le trigger a créé celui d’un compte ultérieur. Deux comptes et vingt lignes fictives ont exercé les dix tables avec de vrais JWT. A et B n’ont lu aucune ligne de l’autre compte. Le rôle de service a reçu `42501` sur les dix tables. |
| Panne du trigger pendant `auth.admin.createUser` | HTTP 500 attendu. Aucun compte ni profil orphelin. La même opération a réussi après retrait de la faute de test. Suppression Auth Admin d’un compte fictif et cascade de dix lignes confirmées, avec les dix lignes de l’autre compte préservées. |
| `supabase test db --local --workdir <copie-isolée> --network-id <réseau-dédié> --agent no` | **413 assertions pgTAP, cinq fichiers, PASS.** |
| `supabase functions serve --env-file <env-local> --workdir <copie-isolée> --network-id <réseau-dédié> --agent no` | Prototype de clôture disponible sur la stack locale. |
| `npm run test:supabase` | **12 groupes réussis**, dont administration Auth préservée, rôle de service refusé par la Data API, invitation SMTP locale, récupération, refus d’inscription libre et de session anonyme, métadonnées et JWT falsifiés, refresh révoqué et JWT authentique expiré. |
| `npm run test:drill:supabase` et `npm run test:personal:supabase` | **22 et 26 groupes réussis**. Écritures concurrentes et relectures via PostgREST réel, permissions de colonne, idempotence et isolement A/B. |
| `npm run test:e2e:supabase -- --output <dossier-neuf>` | Premier passage de 29 réussites et 3 échecs. Les trois tests de liens manuels utilisaient une lecture administrative de `profiles` dans leur fixture. La lecture a été remplacée par une requête SQL dans le conteneur local identifié. Le rejeu complet donne **32 réussites**, dont la clôture réelle et la conservation des données locales à la déconnexion. |
| Laboratoire TLS local, `supabase migration up --db-url <boucle-locale>?sslmode=verify-full&sslrootcert=<CA-fictive>` | La CLI a appliqué une migration sur un cluster exigeant TLS, puis a refusé une CA étrangère et un certificat de nom différent signé par la bonne CA. Les certificats et l’endpoint réels de PROD restent à confirmer au lot D. |

Le premier essai de restauration Supabase a révélé un écart effectif malgré un `pg_restore` réussi. Les ACL de table héritées à la création par `anon` et `authenticated`, ainsi que des droits `EXECUTE` de RPC, restaient plus larges sur la cible préconfigurée. Les ACL d’objet générées par la restauration n’annulaient pas tous les grants issus de ces défauts locaux. La cible fictive a été arrêtée. Le second essai neutralise les défauts de table et de fonction de `postgres` pour les rôles API dans `public` avant la création des objets, dans la même transaction. Les entrées `DEFAULT ACL` de l’archive rétablissent les défauts de la source et une assertion SQL vérifie les droits effectifs avant le commit.

**Second essai réussi.** Les commandes exécutées sont `pg_dump --format=custom --schema=public --schema=bprea_private --schema=supabase_migrations --schema=auth`, `pg_restore --use-list <TOC> --file <SQL>` et `psql -X -v ON_ERROR_STOP=1 --single-transaction -f <prélude> -f <SQL> -f <garde-ACL>`. L’archive et le TOC sélectionnés ont restauré les vingt lignes métier, les deux comptes fictifs et leurs deux identités, les quatre entrées de registre et le trigger applicatif Auth. Les rôles et objets Auth gérés provenaient de la même image. Les deux comptes se sont reconnectés, ont retrouvé chacun leurs dix lignes et n’ont lu aucune ligne de l’autre compte. Les ACL par défaut, de table, de colonne, de fonction et de schéma correspondent à la source. Les sessions ont été réémises. Les réglages et sauvegardes gérés par le fournisseur restent à qualifier sur le périmètre réel au lot D.

L’archive synthétique restaurée a le SHA-256 `f4bf2356e883c8c021fdb27fd5cfb7381fa3225427969a8df33a3e39e8e4516a`. Les preuves se trouvent dans `.tmp/lot660c-stack-docker-a20d6d67aa9d` (précontrôles, ACL et catalogue par étape, suites), `.tmp/lot660c-stack-restore-ab3cb51dd3a6` (TOC, garde, catalogue et résultat), `.tmp/lot660c-tls-himkAe/tls-results.json` et `.tmp/lot660c-e2e-19e2bf83aa4d43a88c219f6f495e443a/report` (dernier E2E autonome). Les deux stacks ont été arrêtées par `docker stop` après vérification de l’absence de comptes et de lignes fictives. Leurs volumes et les preuves restent locaux. Le diff final est dans `.tmp/lot660c-livraison-finale/lot660c.diff`.

## G. Verdict et conditions de déploiement

**`READY_FOR_PROD_APPROVAL`.** Le dossier de déploiement peut être soumis à validation humaine au lot 6.6.0.D. Les migrations, les permissions effectives, l’isolation SQL et HTTP, les parcours navigateur, les reprises et la restauration logique ont passé la recette locale. L’installation PROD requiert l’autorisation distincte prévue pour le lot D.

Suivre [les conventions de test du dépôt](../TESTS.md) pour reproduire les contrôles. Utiliser l’identifiant `mon-bprea-lot6-1-local` uniquement sur le moteur dédié, avec les ports vérifiés, pour les runners existants. Le [runbook D](../architecture/RUNBOOK-SUPABASE-PROD-6-6-0.md) garde comme points d’arrêt l’identification du commit et de la cible réelle, l’écart d’ACL ou de paramètres, l’absence d’une sauvegarde appropriée et l’échec de vérification TLS du certificat réel.

Le travail est livré dans le dépôt local. L’intervention n’a touché aucun projet Supabase hébergé et n’a produit ni commit, ni push, ni déploiement.
