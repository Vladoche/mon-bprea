# Runbook de migration DEV — lot 6.5.3.B

**28 octobre 2026. PRÉPARATION SEULE. EN ATTENTE D'AUTORISATION A ; B non demandé. Migration non exécutée.** La [validation datée](../validations/VALIDATION-LOT6-5-3B.md) porte les lectures réelles. Ce runbook prépare uniquement le schéma applicatif ; aucune montée de version du moteur PostgreSQL.

## Cible et version de départ

| Élément | Référence contrôlée |
| --- | --- |
| Projet unique | `wcckbyhrtroittbfophv` — Mon BPREA DEV ; eu-west-1 ; Free ; ACTIVE_HEALTHY ; PostgreSQL 17.11.0.003 |
| Base Git | `51c1165cc976d20a9c1a834c93b0b96f22154acc`, dernier origin/main après fetch, fusion PR #27 confirmée |
| Branche | `feature/lot6-5-3b-backup-migration-dev`, créée depuis cette base, worktree initial propre |
| Migrations observées | `20261022000100 profiles`, puis `20261024083417 create_drill_sync_schema` ; aucune autre version |
| Seul fichier candidat | [20261025143831_create_personal_data_backend.sql](../../supabase/migrations/20261025143831_create_personal_data_backend.sql) |
| SHA-256 du fichier local relu | `e30acdeae62080380e5767600ccb78897537ff5369b48a4f3f2bb9f065bc96ec` ; fins de lignes CRLF du checkout ; comparer de nouveau les octets exacts avant intervention |
| CLI / configuration | `supabase@2.121.0`, aides relues ; config.toml local `mon-bprea-lot6-1-local`, sans seed ; aucun secret à publier |

PROD `oqoqrxwfbkhtpksqimgd` ne doit faire l'objet d'aucun appel, navigation, lien CLI, extraction ou restauration. La mention `main / PRODUCTION` dans le Dashboard DEV désigne sa propre branche principale ; elle ne remplace pas le contrôle de référence.

Les SHA des fichiers peuvent dépendre de CRLF/LF ; ne pas prendre un écart d'octets pour une preuve de modification SQL ni le normaliser silencieusement. Comparer le blob Git et le contenu, qualifier l'écart, puis représenter la référence exacte à autoriser si nécessaire. Aucun SQL versionné n'est modifié par ce lot.

## Préconditions et arrêts

| Contrôle immédiatement avant intervention | Preuve nécessaire / arrêt |
| --- | --- |
| Identité, Git et état | Référence exacte dans chaque appel et URL, nom/plan/région/statut relus, SHA du checkout/fichier confirmé. Arrêt sur autre cible, nouveau commit/migration ou état inexpliqué. |
| Historique | Exactement les deux versions ci-dessus ; cible déjà installée ou quatrième version : arrêt. Ne pas réappliquer profils/Drill. |
| Absence d'installation partielle | Aucune des six tables personnelles, des deux guards ou six RPC ; aucune relation ou routine applicative inattendue dans public/bprea_private. Arrêt sur collision/objet partiel, même sans ligne d'historique. |
| Dérive existante | Comparer définitions, signatures/corps/propriétaires, ACL/RLS, contraintes/index/triggers aux deux migrations et au relevé avant opération. Tout écart non expliqué bloque ; aucune réparation automatique. |
| Données et comptes | DEV réservé au fictif selon l'exploitant ; confirmer le périmètre réel en privé avant copie. Donnée réelle imprévue : arrêter et revoir A. Ne pas consulter de réponses nominatives, compter ou effacer des comptes pour simplifier. |
| Sauvegarde et reprise | A obtenu, copie/manifest vérifiés au niveau consigné, ou décision explicite sur une alternative/limitation et les seules pertes acceptables. Dossier privé protégé, échéance et sort des copies décidés. À ce jour : aucune preuve de sauvegarde ou restauration. |
| Accès et confirmations | Opérateur de confiance, secret DB saisi localement sans argument/log, aucune auto-confirmation via SUPABASE_YES ou flag CLI. Arrêt sur rôle/secret/connexion inattendus. |
| Déclencheurs | Revoir workflows et intégration **DEV seulement**. Deploy to production et Automatic branching off observés ; Pages déclenché par push main/workflow_dispatch, pas par la branche de travail. Ne jamais pousser sur main ou utiliser Git comme déploiement SQL. |
| Fenêtre et périmètre | Une opération à la fois, pas d'activité d'essai concurrente ; aucun compte créé/supprimé, lien/e-mail généré, Auth/SMTP/URL/clé/plan/région modifié ou Edge/Pages déployé. Pas de recette connectée. |

## Point d'arrêt A — copie avant intervention

Présenter la [proposition de sauvegarde](SAUVEGARDE-TECHNIQUE-SUPABASE-FREE.md) : DEV seul ; structure public/bprea_private, profils et trois Drill, versions/ACL/configuration sans secret ; Auth/Storage/Vault et autres copies exclus ; deux dumps CLI bornés et manifest privé ; chemin exact hors dépôt choisi par l'exploitant ; ACL, chiffrement et absence de synchronisation à confirmer ; conservation proposée de sept jours ; dépendances UUID et restauration seulement applicative ; commandes et procédures du guide.

Demander : **« Autorisez-vous cette copie applicative limitée de DEV, dans le chemin privé et pour la durée précisés, avec ces exclusions et ce niveau de vérification ? »** Consigner la réponse et les conditions sans secret. Le choix d'un chemin ou la déclaration de données fictives ne répond pas à cette question. Une autorisation conditionnelle n'est utilisable qu'une fois toutes ses conditions établies. Sans accord, livrer la préparation et le statut EN ATTENTE D'AUTORISATION.

Sur ce poste, Docker/psql/pg_dump manquent ; chiffrement, cloud et ACL du futur sous-dossier ne sont pas confirmés. Aucune copie ne doit être lancée pour vérifier ces prérequis. Ne pas transmettre un dump au modèle ou à une API tierce. L'essai réel éventuel se fait sur le poste privé de l'opérateur, séparément des fixtures de CI.

## Relecture du SQL candidat

Le fichier a été lu intégralement, des tables au COMMIT : six CREATE TABLE, deux guards invoker, six RPC publiques invoker, seize policies, six triggers, index et contraintes. Il commence par BEGIN, termine par NOTIFY pgrst puis COMMIT. **Aucun DROP, TRUNCATE, DELETE de données existantes ou modification des quatre anciennes tables** ; les UPDATE/INSERT des corps de fonctions sont leur comportement futur, pas une exécution pendant CREATE FUNCTION. Aucune nouvelle fonction definer, vue, extension ou rôle. Pas de CREATE INDEX CONCURRENTLY ni d'autre instruction d'entretien imposant une sortie de transaction.

Dépendances : auth.users(id), auth.uid(), bprea_private existant et primitives PostgreSQL 17 ; propriétaire opérateur postgres requis pour créer les nouveaux objets/FK, révoquer les défauts et accorder les seuls droits prévus. Les six FK Auth directes nouvelles et la FK botanique composite sont CASCADE. Les références vers Auth peuvent nécessiter des verrous de métadonnées ; objets nouveaux limitent le besoin de verrouiller des données existantes, sans supprimer le risque d'attente, timeout, manque de droits ou collision. Aucune mesure de verrou en charge n'a été réalisée sur DEV.

Les quatre états modifiables protègent révisions CAS et champs serveur ; QCM/réponses botaniques restent append-only, avec identités stables et idempotence. La création seule ne peuple aucune table et ne synchronise aucun cache. Les accès sont SELECT et INSERT/UPDATE de colonnes explicites pour authenticated ; anon/PUBLIC refusés, droits service_role explicitement retirés sur ces nouveaux objets. Les grants administratifs antérieurs profils/Drill sont préservés.

Le BEGIN/COMMIT du fichier ne suffit pas à affirmer que le DDL et l'inscription de l'historique CLI sont atomiques ensemble : le fichier contient son propre COMMIT et le ledger est géré par la CLI. En cas d'acquittement perdu, contrôler **les deux**, même si l'un paraît complet. Ne pas masquer une divergence avec migration repair.

## Point d'arrêt B — migration, après A et décision de risque

B n'est présentable qu'après validation des préconditions. Remplir, puis soumettre :

| Pièce à présenter à l'exploitant | État préparatoire actuel |
| --- | --- |
| Référence DEV, état, SHA Git/fichier et historique à l'instant du lancement | Références ci-dessus, à relire après A ; aucun accord déduit de ces lectures |
| Fichier unique / effet SQL | `20261025143831_create_personal_data_backend.sql`, six tables et objets décrits ; anciens profils/Drill préservés |
| Méthode et commande exacte | CLI épinglée, cible explicite et `--skip-vault`, ci-dessous ; aide/source vérifiées, commande non exécutée |
| Sauvegarde | **NON AUTORISÉE / NON RÉALISÉE** ; renseigner date privée, périmètre et manifest après A ; jamais inventer taille/empreinte |
| Restauration | **NON EXÉCUTÉE** ; indiquer niveau 1/2/3 réellement atteint, dépendances Auth et limites |
| Risques résiduels | Perte de fixtures et comptes Auth non couverts, restauration partielle/non éprouvée, snapshots distincts, copie locale, verrous/collision, résultat incertain et defaults Data API. Aucun risque accepté à ce jour. |
| Décision et arrêts | Accepter précisément ces limites/pertes, attendre les preuves manquantes ou revoir le périmètre ; arrêter sur tout écart de cible, historique, SQL, privilèges, données ou sauvegarde |

Demander ensuite **une nouvelle autorisation visant uniquement l'application de ce fichier sur ce DEV**, avec commande et conditions. L'autorisation A, une PR verte ou une acceptation de la feuille de route ne valent pas B. Aucune relance automatique. Sans B : EN ATTENTE D'AUTORISATION, aucune simulation distante ni application.

## Commande candidate, non approuvée et non exécutée

Les aides `db push --help` de **2.121.0** et ses [effets documentés dans le code officiel](https://github.com/supabase/cli/blob/v2.121.0/apps/cli/src/commands/db/push/SIDE_EFFECTS.md) confirment --linked, --project-ref, --skip-vault et la confirmation interactive. Cette CLI peut synchroniser Vault par défaut ; `--skip-vault` est donc obligatoire. Un mot de passe DB fourni par environnement privé évite de demander une création de login temporaire ; ne jamais saisir ce secret dans la conversation ou avec --password/--db-url.

```text
npx --yes supabase@2.121.0 db push --linked --project-ref wcckbyhrtroittbfophv --skip-vault
```

Après B seulement, depuis le checkout exact, avec contrôle des variables d'environnement, connexion et secret privé selon le guide. Le `--yes` est celui de **npx** avant le paquet ; aucun --yes Supabase. Aucun --include-all, --include-seed, --include-roles, reset, repair, pull ou SQL Editor. Aucun remplacement du SQL versionné pour faire passer une erreur. Aucun dry-run distant exécuté dans cette préparation ; si une simulation est souhaitée, son périmètre et ses effets doivent être expressément couverts par B après relecture du code, avec --skip-vault conservé.

**Avant de répondre à la confirmation CLI**, vérifier que la liste contient uniquement :

```text
20261025143831_create_personal_data_backend.sql
```

Autre fichier, opération Vault/seed/rôle, historique à créer/transformer inattendu ou cible ambiguë : refuser et arrêter. La CLI est un outil générique de migrations, pas une allowlist intrinsèque pour ce seul fichier ; les contrôles humain/SQL/Git sont indispensables. Conserver seulement stade, code et résultat minimisé. Ne pas lancer deux commandes concurrentes ni réessayer après timeout.

## Vérification structurelle après application autorisée

Réutiliser, dans l'outil officiel explicitement réglé sur DEV, [catalogue.sql](../../scripts/verification-dev/catalogue.sql) et [privileges.sql](../../scripts/verification-dev/privileges.sql). Ces scripts encadrent des SELECT de métadonnées dans une transaction read only puis rollback ; aucune RPC métier ni donnée utilisateur. Le script SQL ne choisit pas lui-même une connexion. Ne pas le raccorder aux runners de sécurité ou déduire une identité DEV du seul nom de base postgres.

| Domaine | Attendu à comparer réellement, au SQL et au relevé avant opération |
| --- | --- |
| Historique | Trois versions exactes dans l'ordre, noms attendus, aucune quatrième version ; cible marquée installée et objets concordants |
| Tables | Dix tables public : profiles, drill_series, drill_answers, drill_training_attempts, course_states, quiz_attempts, botanical_sessions, botanical_answers, itk_settings, appearance_preferences ; aucune relation privée/supplémentaire inexpliquée |
| Colonnes | Ordre, nom, type/précision, nullabilité, DEFAULT, generated et ACL ; comparer chaque définition, pas seulement un nombre |
| Contraintes | PK, UNIQUE, CHECK validées, FK et actions CASCADE, colonnes composites dans le bon ordre ; six nouvelles racines Auth et dépendance botanique ; ne pas exécuter de suppression pour le démontrer |
| Index | Définition, ordre des colonnes, unicité, validité et readiness, y compris tous les anciens index ; les INFO unused_index ne justifient aucune suppression |
| Triggers | Onze applicatifs, dont le trigger Auth préservé ; noms, tables, événements, fonctions, état actif et non seulement présence |
| Routines | Quinze applicatives hors extensions : six privées et neuf RPC publiques ; signatures nommées, retours, langage, volatilité, propriétaire, config/search_path, sécurité et **corps complets** comparés à Git |
| RLS | On sur dix tables ; 24 policies explicites authenticated, propriétaire, USING/WITH CHECK adaptés ; aucune policy anon ou DELETE étudiante ; FORCE RLS à comparer au modèle |
| ACL effectives | Tables/colonnes/schémas/fonctions, PUBLIC et héritages ; authenticated SELECT et seules colonnes métier ; propriétaire/dates/version/révision protégés ; privés sans USAGE/EXECUTE client ; aucun droit anonyme ; service_role distinct, nouveaux REVOKE préservés |
| Préservation | Comparer les définitions et privilèges des quatre tables/sept fonctions préexistantes ; aucun reset/suppression dans l'opération. Aucun comptage de données n'est nécessaire à cette preuve structurelle ; si nécessaire, autoriser une mesure minimale en privé. |
| Data API | Schéma public exposé, privé non exposé ; chemin additionnel/configuration et ACL par défaut relus ; droits ci-dessus évalués sous chaque rôle sans l'exécuter. Reachability réelle sous JWT réservée à la recette suivante. |

Les nombres **10 / 11 / 24 / 15 dont 9 RPC** concordent avec les trois fichiers SQL : 4+6 tables, 5+6 triggers, 8+16 policies, 7+8 fonctions. Ils ne prouvent pas les propriétés. L'inventaire sans filtre de préfixe permet de repérer une routine inattendue ; ses corps ne sont pas exécutés pour l'inspecter. Tout écart : arrêter, conserver données et preuves minimisées, aucun GRANT global ou déverrouillage.

Le [changement fournisseur du 30 octobre 2026](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically), relu le 28/10, retire l'exposition implicite des nouvelles tables via les droits par défaut, sans remplacer RLS. Les GRANT explicites du fichier candidat couvrent le modèle déclaré. Un indicateur Dashboard n'est pas un test de privilèges effectifs ni un parcours PostgREST réussi : existence de la table, schéma exposé, droits SQL, RLS, rôle authenticated et refus anon sont à vérifier séparément. En cas de 42501, diagnostiquer le droit manquant ; ne jamais accorder ALL, ouvrir à anon, rétablir service_role sur les nouvelles tables ou supprimer RLS.

## Arrêt sûr et reprise conditionnelle

| État constaté | Action |
| --- | --- |
| Non commencé / autorisation absente | Ne rien exécuter sur DEV ; conserver l'état et livrer la préparation. |
| Erreur transactionnelle | Relire statut, historique et catalogues ; rollback annoncé ne suffit pas. Aucun deuxième essai avant diagnostic et décision ciblée. |
| Connexion perdue / réponse incertaine | Distinguer non commencé, annulé, committé avec ledger, objets sans ledger ou indéterminé. Aucune relance ni repair automatique. |
| Migration committée, défaut fonctionnel | Garder Auth public off, suspendre la recette ; préserver les six tables et données. Préparer correctif relu ou reprise supplémentaire autorisée. Aucun DROP, reset ou restauration sur DEV pour « revenir en arrière ». |
| Données plus récentes / effacement postérieur | Aucun écrasement depuis l'ancienne copie et aucune recréation d'un compte effacé. Isoler/réconcilier avant une éventuelle restauration séparément autorisée. |
| Suspicion d'exposition / mauvaise cible | Arrêter la chaîne ; procédure d'incident privée et confinement autorisé, sans nouvelle consultation de PROD. |

Après un résultat structurel positif, la seule conclusion admissible sera : **« Migration installée, schéma vérifié, prêt pour recette hébergée autorisée ultérieurement »**, avec limites. À ce jour cette conclusion n'est pas atteinte. Aucun compte connecté, invitation/récupération hébergée, A/B distant, fonctionnement pédagogique, restauration individuelle, validation juridique ou ouverture n'est déclaré validé. Les quinze P0 restent bloquants.
