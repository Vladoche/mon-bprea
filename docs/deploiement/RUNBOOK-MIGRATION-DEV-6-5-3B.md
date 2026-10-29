# Runbook de migration DEV — lot 6.5.3.B

**29 octobre 2026 : migration unique appliquée après A/B, copie et restauration applicative partielle vérifiées.** [Preuve d’exécution](../validations/EXECUTION-LOT6-5-3B-2026-10-29.md), [préparation historique](../validations/VALIDATION-LOT6-5-3B.md) et [récupération](SAUVEGARDE-TECHNIQUE-SUPABASE-FREE.md). Aucun changement de version du moteur PostgreSQL.

## Cible, source et résultat

| Élément | Contrôle effectué |
| --- | --- |
| Cible exclusive | `wcckbyhrtroittbfophv` — Mon BPREA DEV ; eu-west-1 ; Free ; ACTIVE_HEALTHY ; PostgreSQL 17.11.0.003 |
| Git source | `65847b8819df5d685b48cffca0d20b675629ddf1`, dernier origin/main après fetch ; fusion de la PR #28 observée, faite par l’exploitant |
| Branche de travail | `feature/lot6-5-3b-backup-migration-dev` ; aucun travail direct sur main |
| Historique avant | `20261022000100 profiles`, `20261024083417 create_drill_sync_schema` ; aucune installation personnelle partielle |
| Seul fichier appliqué | [20261025143831_create_personal_data_backend.sql](../../supabase/migrations/20261025143831_create_personal_data_backend.sql) |
| SHA-256 du checkout CRLF | `e30acdeae62080380e5767600ccb78897537ff5369b48a4f3f2bb9f065bc96ec` ; fichier versionné inchangé |
| Historique après | Les deux versions conservées + `20261025143831 create_personal_data_backend`, aucune quatrième version |
| Protection préalable | Archive native PostgreSQL 17.11, SQL dérivés du même snapshot, neuf fichiers intègres, copie privée ; restauration applicative partielle comparée |
| Résultat | Dix tables, 98 colonnes, 95 contraintes validées, 24 index valides/prêts, onze triggers, 24 policies, quinze fonctions dont neuf RPC ; objets et droits anciens conservés |

PROD `oqoqrxwfbkhtpksqimgd` est exclu de tout appel, navigation, liaison CLI, extraction et restauration. Le libellé Dashboard `main / PRODUCTION` dans DEV désigne la branche de ce projet DEV ; toujours contrôler la référence complète.

## Autorisations A et B

A a explicitement couvert la copie applicative et le dossier protégé hors dépôt. L’exploitant a déclaré DEV fictif, exclu le dossier du cloud et dispensé cette copie de chiffrement du volume. La conservation retenue est de sept jours pour réexamen, sans purge automatique. Les exclusions Auth/Storage/Vault et les limites de restauration sont maintenues.

B a ensuite été explicitement donné : **« Ok on va partir sur pg dump. J’autorise B »**. L’accès initial a échoué avant copie ; l’exploitant a déclaré avoir réinitialisé le mot de passe DB, puis demandé la reprise. La copie réussie, la restauration et les préconditions ont été vérifiées **avant** l’application. L’autorisation n’a pas été redemandée.

Les deux accords ne couvrent aucune recette connectée, invitation, récupération de compte, génération de lien, nettoyage d’un compte existant, réglage Auth, Edge Function, ouverture ou production. Ils ne rendent pas les comptes fictifs jetables.

## Préconditions et critères d’arrêt

| Contrôle immédiatement avant intervention | Résultat / arrêt à respecter |
| --- | --- |
| Cible et Git | Référence dans l’hôte, nom/statut/plan/région relus ; checkout et SHA du fichier confirmés. Autre cible ou nouveau commit non expliqué : arrêt. |
| Historique et collisions | Exactement deux versions avant ; six tables et huit fonctions personnelles absentes. Version supplémentaire, objet partiel ou cible déjà installée : arrêt, aucune réapplication. |
| Dérive | Catalogue complet et droits comparés à la copie puis à la reconstruction Git ; aucun écart. Toute différence non expliquée bloque ; aucun repair ou GRANT global. |
| Copie et risque | Manifeste/intégrité/portée vérifiés ; restauration partielle réelle, Auth exclu. Une archive seule ne démontre pas la récupération des comptes. |
| Secret et TLS | Saisie locale masquée, environnement du seul processus, URL sans identifiant ; `verify-full` avec CA publique officielle. Échec de certificat ou rôle inattendu : arrêt sans contournement. |
| Delta appliqué | Uniquement le fichier cible, seed/rôles exclus, Vault désactivé par `--skip-vault`. Autre fichier ou effet inattendu : arrêt avant application. |
| Données et fenêtre | Copie et DDL séquentiels ; aucune ligne remontée au modèle, aucune RPC métier ni recette hébergée. Donnée réelle imprévue : arrêter et revoir le périmètre. |
| Automatisations | Workflows inchangés : PR = contrôles synthétiques, Pages = push main/lancement manuel ; pas de push main ou de mécanisme Git servant à appliquer SQL. |

Pour une autre intervention, obtenir les accords correspondant à son nouveau périmètre. Le fait que ce lot soit terminé ne permet aucune nouvelle migration ou reprise automatique.

## SQL relu et effet appliqué

Six tables : `course_states`, `quiz_attempts`, `botanical_sessions`, `botanical_answers`, `itk_settings`, `appearance_preferences`. Deux guards privés invoker, six RPC publiques invoker, seize policies, six triggers, PK/FK/CHECK/index et grants de colonnes sont ajoutés. Les quatre tables et sept fonctions antérieures restent identiques.

Le fichier commence par BEGIN et termine par NOTIFY pgrst puis COMMIT. Aucun DROP/TRUNCATE/effacement ni transformation des anciennes tables. Les INSERT/UPDATE dans les corps créés ne s’exécutent pas pendant CREATE FUNCTION. Aucune nouvelle extension, vue, fonction definer ou rôle ; aucun index concurrent.

Dépendances : `auth.users(id)`, `auth.uid()`, schéma privé existant et primitives PostgreSQL 17. Les six nouvelles FK Auth directes et la FK botanique composite sont CASCADE. Les droits `authenticated` portent sur SELECT et les seules colonnes métier nécessaires ; propriétaires/dates/révisions restent protégés. Les nouveaux objets retirent explicitement les droits `anon`, PUBLIC et `service_role` ; aucune réintroduction de ces droits pour les contrôler.

Le COMMIT interne ne démontre pas l’atomicité commune du DDL et de l’inscription du ledger CLI. Après toute réponse incertaine, contrôler les deux ; aucun retry ou `migration repair` pour masquer une divergence.

## Commande réellement exécutée

```text
npx --yes supabase@2.121.0 db push --db-url "postgresql://db.wcckbyhrtroittbfophv.supabase.co:5432/postgres?sslmode=verify-full" --skip-vault
```

La méthode liée avec `--linked --project-ref`, préparée le 28 octobre, a été remplacée par cette connexion directe explicite pour porter la vérification TLS via le parseur libpq de cette version. L’URL ne contient **ni utilisateur ni mot de passe**. `PGUSER=postgres`, `PGPASSWORD` saisi localement, `PGSSLROOTCERT` et `PGCONNECT_TIMEOUT=10` sont fournis au seul processus ; environnement hérité contrôlé. Aucune création de login temporaire ou connexion API d’administration n’est nécessaire à cette connexion.

Les [options](https://github.com/supabase/cli/blob/v2.121.0/apps/cli/src/commands/db/push/SIDE_EFFECTS.md), le [parseur des variables PG](https://github.com/supabase/cli/blob/v2.121.0/apps/cli/src/command-internal/db-config.parse.ts) et le [pilote TLS](https://github.com/supabase/cli/blob/v2.121.0/apps/cli/src/command-internal/db-connection.sql-pg.layer.ts) ont été relus. `--db-url` est exclusif de `--linked`/`--local` ; ne pas lui ajouter `--project-ref`. Le `--yes` avant le paquet appartient à npx. Aucun `--include-all`, `--include-seed`, `--include-roles`, `--yes` Supabase, dry-run, reset, repair ou SQL Editor.

**Particularité constatée :** malgré un terminal TTY et `SUPABASE_YES=false`, la CLI a utilisé son mode machine et n’a pas attendu de réponse interactive. Ne pas prétendre qu’un opérateur a relu puis confirmé son prompt. Le contrôle préalable avait imposé le Git exact, les trois fichiers locaux, les deux versions distantes et le seul delta attendu. Le résultat JSON a annoncé exactement le fichier cible, `seeds: []`, `roles: []`, `dryRun: false` et un code zéro. La protection d’une future exécution doit revalider le mode de sortie/agent et ses confirmations ; ne jamais compter sur la présence d’un TTY seule. Aucune seconde exécution n’a été lancée.

## Vérification structurelle après application

Les [scripts catalogue](../../scripts/verification-dev/catalogue.sql) et [privilèges](../../scripts/verification-dev/privileges.sql) ont été exécutés en lecture seule sur DEV. Leurs résultats ont été comparés à une base PostgreSQL 17.11 reconstruite depuis les trois fichiers Git, avec mêmes rôles et défauts ACL applicatifs. Les extensions gérées ne sont pas reproduites dans cette base ; leur inventaire DEV est comparé avant/après.

| Domaine | Résultat réel |
| --- | --- |
| Historique | Trois versions exactes, noms et ordre attendus, aucune autre version |
| Tables/colonnes | Dix tables ; types, ordre, nullabilité, DEFAULT, generated, propriétaires, ACL et FORCE RLS comparés |
| Contraintes/index | 95 contraintes validées, PK/UNIQUE/CHECK/FK et actions CASCADE comparées ; 24 index valides/prêts, définitions identiques |
| Triggers | Onze applicatifs, dont celui sur Auth conservé ; noms, événements, fonctions et activation comparés |
| Routines | Quinze hors extensions ; signatures/retours, langue, sécurité, volatilité, strict/leakproof/parallel, contexte et corps comparés ; six privées et neuf RPC publiques |
| RLS | On sur dix tables, FORCE RLS off comme dans Git ; 24 policies propriétaire `authenticated`, USING/WITH CHECK comparés |
| Droits | Tables/colonnes/schémas/fonctions/défauts comparés, y compris refus clients sur le privé et nouveaux REVOKE `service_role` ; aucun DELETE étudiant |
| Préservation | Tous les objets, droits, défauts et extensions antérieurs conservés ; aucun DML de données anciennes dans le fichier appliqué |
| Data API | Dashboard relu : public/graphql_public exposés, privé exclu, extra search path public/extensions, max rows 1000 ; auto-exposition on conservée. Indicateurs 0/10 tables et 0/15 fonctions ne remplacent pas les ACL SQL. Aucun essai JWT/REST hébergé. |

Le [changement annoncé du 30 octobre 2026](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically) ne dispense pas des droits explicites ni de RLS. Aucun réglage Dashboard changé, aucun Save, aucun GRANT global.

## Arrêt sûr et suite

| État constaté | Action |
| --- | --- |
| Erreur ou acquittement perdu | Relire ledger, catalogue et droits, préserver les données ; aucun retry/reset/repair automatique |
| Migration installée, défaut fonctionnel | Suspendre la recette, conserver tables et données ; correctif séparément relu et autorisé |
| Copie ancienne ou effacement intervenu | Isoler et réconcilier ; aucune restauration écrasant des données récentes ou recréant un compte effacé |
| Soupçon de fuite ou mauvaise cible | Arrêt de la chaîne, procédure d’incident privée et confinement autorisé, aucune consultation PROD |

Conclusion technique atteinte : **migration installée, schéma vérifié, prêt pour une recette hébergée autorisée ultérieurement**. Le [plan de recette](PLAN-RECETTE-DEV.md) n’est pas exécuté. Aucun fonctionnement connecté, accès A/B distant, invitation/récupération, restauration individuelle, validation juridique ou ouverture n’est déclaré acquis ; les quinze P0 restent bloquants.
