# Installation Supabase PROD de Mon BPREA

**Installation suspendue.** La [synthèse des lots D et E](../validations/VALIDATION-LOT6-6-0-DE.md) consigne les résultats, le candidat M5 et les points d’arrêt. Les accords pour Auth, l’extraction, la restauration, l’installation de P et M1–M5 et l’ouverture sur invitation sont distincts. L’accord d’installation fixe le commit, la cible, l’opérateur et la fenêtre.

## 1. Préflight final en lecture seule

### Cible, fichiers et droits

- Confirmer dans le Dashboard privé la référence du projet Mon BPREA PROD, sa région et ses versions. Comparer l’hôte SQL direct, le nom du certificat et la référence du projet sélectionné. Une modification d’adresse ou de version impose de vérifier à nouveau la cible et la compatibilité.
- Partir d’un checkout propre du **commit approuvé**. Le lot D a contrôlé la branche `feature/lot6-6-0-c-supabase-permissions` à `9a21b6e3696c4f5778ae7b72689ee3c9ee74c72e`, dont la base immédiate est `79c27ca2305ad8274d4179ec8ad252e8706e0494`. Les trois fichiers historiques sont identiques aux blobs de `ffa90fae28e780d6e01e19769b14bd4a910d7ab4`. Comparer la liste exhaustive des migrations et les empreintes ci-dessous. Copier les fichiers octet pour octet du checkout vers le préfixe temporaire et comparer également les SHA-256 bruts des copies.
- Employer Supabase CLI **2.121.0** et `psql`, `pg_dump`, `pg_restore` **17.11**. Vérifier les versions et les aides de `migration up`, `migration repair` et des outils de sauvegarde. Préparer un répertoire CLI isolé avec `supabase/config.toml`, ses templates et uniquement les migrations du préfixe approuvé, sans lien ni cache de projet, et avec la télémétrie désactivée. La qualification est liée au pilote, à la version de CLI, au rôle et à la voie de connexion. [CLI 2.121.0](https://github.com/supabase/cli/releases/tag/v2.121.0) · [Changements CLI v3](https://supabase.com/changelog/supabase-cli-v3)
- Confirmer `session_user = current_user = postgres`. Relever `CREATE` sur la base et `public`, `USAGE` sur `auth`, `SELECT` et `TRIGGER` sur `auth.users`, `REFERENCES` sur son UUID `id`, et `auth.uid()` exécutable par `authenticated`. Contrôler la clé primaire, `gen_random_uuid()` et `plpgsql`. Distinguer le créateur de migration, le propriétaire d’Auth et le rôle administratif API. Relire les memberships `INHERIT`/`SET` et les droits de `PUBLIC`. Les rôles API doivent avoir `USAGE` et aucun `CREATE` dans `public`.
- Exécuter le [préflight SQL](../../scripts/verification-prod/preflight.sql) et consulter l’historique via le fournisseur. Avant P, attendre zéro objet Mon BPREA, zéro version et aucun conflit de nom dans `public`, `auth.users` et `bprea_private`. Le lot D a trouvé la table et le schéma de suivi absents. Si la table de suivi existe, lire uniquement `version, name` dans une transaction read-only. Qualifier un registre vide créé par une tentative antérieure avant tout lancement.
- Comparer les ACL de `public` et `auth`, les défauts globaux et par schéma pour `postgres` et `supabase_admin`, et les event triggers. En D, aucun défaut global de table ne conférait de droit à `service_role` et aucun héritage de rôle n’a été trouvé pour lui. Le retrait concret de P portait sur les futurs objets de type table de `postgres` dans `public`. Tout nouveau grant global, héritage ou dépendance métier demande un nouvel arbitrage avant P. Examiner la définition de tout nouvel event trigger pertinent. Archiver les ACL initiales avec créateur, schéma, type, bénéficiaire, grantor et grant option. [Privilèges de création PostgreSQL](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html)

| Ordre | Fichier | SHA-256 UTF-8 après normalisation CRLF vers LF |
| --- | --- | --- |
| P | `prepare-permissions.sql` | `baeda047347505989cdab7b00a00709771d59d76468c5c0498ba55611cc70cdc` |
| M1 | `20261022000100_profiles.sql` | `e9a9de3f5c3e4111a66da44b9858dc8b126cbf6c2b433f9abc72d91bb8e303d5` |
| M2 | `20261024083417_create_drill_sync_schema.sql` | `31c9b77580e91dc865af5bec2b4a2bee14d9bfea40dd8aa28f17468e9f88399c` |
| M3 | `20261025143831_create_personal_data_backend.sql` | `e9d453c747ba097b0efce3ee09ad3a2503e5adba6a7af3916c2a963ca39ec8e3` |
| M4 | `20261106093143_restrict_application_service_role.sql` | `904d2372a7f8d6ac848adfa5f0f259440d8e7b269859e9feaf9f4342e529b1a2` |
| M5 | `20261106174551_return_conflict_for_personal_revision.sql` | `2cb070120daf6262419127a2f296af3d840e0ed8dd44257ad351744816afdc20` |

### TLS et connexion d’exploitation

1. Depuis le Dashboard, relever l’hôte direct et obtenir la CA via **Database → Settings → SSL configuration**. Vérifier provenance, empreinte et validité. Depuis le poste qui réalisera l’intervention, répéter la résolution IPv6 et la poignée de main PostgreSQL avec vérification du nom. L’alternative affichée est le pooler de **session**. Un changement de voie exige une nouvelle qualification des identités TLS/SQL, du rôle, du pilote, des transactions, des options de session et de la sauvegarde.
2. Dans un terminal privé, écarter les configurations héritées de test ou de routage, notamment `PGHOSTADDR`, `PGSERVICE`, `PGOPTIONS`, `DATABASE_URL` et les variables Supabase de liaison. Charger le secret temporaire par le mécanisme opérateur validé pour chacun des deux clients. Utiliser une URI sans mot de passe et un mécanisme d’authentification hors ligne de commande. Écarter le mode debug et toute transcription des valeurs sensibles.
3. Construire `$ProdUri` comme ci-dessous. `$ProdReadUri` reprend les mêmes paramètres avec `default_transaction_read_only=on` et des délais courts dans `options`. Faire confirmer par une requête **SELECT** le rôle, l’hôte, le chiffrement et l’application des délais sur **chacun** des clients avec l’authentification opérateur. Pour la CLI, contrôler d’abord les options de `db query --help` et passer une requête inline strictement en lecture seule à la cible explicite. La poignée de main du lot D a réussi et libpq a atteint le défi d’authentification sans identifiant secret. La connexion opérateur authentifiée reste à qualifier. [TLS Supabase](https://supabase.com/docs/guides/platform/ssl-enforcement) · [TLS libpq](https://www.postgresql.org/docs/17/libpq-ssl.html)

Commandes de diagnostic **préparées**. `$ProdCa` est le chemin absolu de la CA vérifiée, `$Psql` l’exécutable approuvé et `$ApprovedProjectRef` la référence confirmée de PROD.

```powershell
$caArg = [uri]::EscapeDataString($ProdCa)
$writeOpts = [uri]::EscapeDataString('-c lock_timeout=5s -c statement_timeout=120s')
$readOpts = [uri]::EscapeDataString('-c default_transaction_read_only=on -c lock_timeout=2s -c statement_timeout=15s')
if ($ApprovedProjectRef -cnotmatch '^[a-z]{20}$') { throw 'Confirmer la référence approuvée dans le Dashboard privé' }
$direct = "postgresql://postgres@db.$ApprovedProjectRef.supabase.co:5432/postgres"
$ProdUri = "${direct}?sslmode=verify-full&sslrootcert=$caArg&options=$writeOpts"
$ProdReadUri = "${direct}?sslmode=verify-full&sslrootcert=$caArg&options=$readOpts"
$identity = "select current_database(), session_user, current_user, inet_server_addr(), inet_server_port(), current_setting('transaction_read_only'), current_setting('lock_timeout'), current_setting('statement_timeout'), (select ssl from pg_stat_ssl where pid = pg_backend_pid())"
& $Psql -X -w -v ON_ERROR_STOP=1 -d $ProdReadUri -c $identity
& $Cli db query --workdir $Stage --db-url $ProdReadUri --agent no $identity
& $Psql -X -w -v ON_ERROR_STOP=1 -d $ProdReadUri -f scripts/verification-prod/preflight.sql -c 'rollback'
```

### Auth, Data API et arrêt

- **Accès sur invitation uniquement.** Après accord Auth distinct, s’assurer que **Allow new users to sign up** est désactivé, que **Site URL** correspond à la racine HTTPS publiée et que **Redirect URLs** contient le seul callback `authentification.html` de cette racine. Le fournisseur e-mail et la confirmation e-mail restent actifs, les connexions anonymes restent désactivées. Relire les réglages après enregistrement et confirmer la politique de mot de passe. Le parcours d’invitation et de récupération manuelles utilise le callback commun. [Architecture Auth](AUTHENTIFICATION.md#url-de-retour-et-modèles-de-mails)
- Confirmer Data API activée, `public` exposé et `bprea_private` exclu. Vérifier les grants de `authenticated` sur les tables, colonnes et RPC. **Qualifier P et M1–M5 sur PostgREST 14.18 avant l’accord d’installation.** Vérifier le retour HTTP 409 des conflits de révision, l’absence de mutation, les permissions et les parcours réels. [Résultats et limites du lot E](../validations/VALIDATION-LOT6-6-0-DE.md#compatibilité-postgrest) · [Exposition Data API](https://supabase.com/docs/guides/api/securing-your-api)
- Confirmer le créneau, le rôle unique de migration et la suspension coordonnée des opérations d’écriture, invitations et DDL concurrents. Observer `pg_locks` et `pg_stat_activity` sur `auth.users`, `public` et le registre, avec types, durées et PID, sans texte de requête. M1 ajoute un trigger et une FK vers `auth.users`, prend notamment un verrou `SHARE ROW EXCLUSIVE` sur cette table et peut faire attendre ses écritures jusqu’au commit. Mesurer le backfill en répétition si le nombre de comptes change. [Verrous PostgreSQL 17](https://www.postgresql.org/docs/17/explicit-locking.html)
- **Arrêt obligatoire** si cible, empreintes, ACL, DDL, inventaire, Auth, API ou TLS divergent sans qualification. L’absence de point de restauration qualifié, un verrou prolongé ou une transaction concurrente suspendent également l’intervention.

### Sauvegarde préalable et restauration isolée

Confirmer la disponibilité et le périmètre des sauvegardes fournisseur. Pour un export logique, vérifier les droits avec le client opérateur et relever les agrégats Auth et Storage juste avant la capture. Un écart de périmètre requiert une nouvelle décision avant extraction. Faire accepter le RPO/RTO de l’intervention et le traitement des écritures et effacements postérieurs. Viser un point juste avant P dans une fenêtre sans écriture métier ni administration Auth. [Sauvegardes Supabase](https://supabase.com/docs/guides/platform/backups) · [Politique de préouverture](../deploiement/EXPLOITATION-PRIVEE-SIX-ADULTES.md#sauvegarde-hebdomadaire-et-rpo)

**Point d’arrêt humain avant extraction.** Confirmer le rôle et la capacité d’export, le stockage chiffré, l’accès restreint, la rétention et le périmètre exact. Employer une archive custom cohérente pour `public` et `auth`, avec `bprea_private` et `supabase_migrations` s’ils existent. Inclure uniquement les autres schémas et données expressément qualifiés. Une archive Auth peut contenir des empreintes de mots de passe, jetons ou données personnelles. Conserver séparément les propriétaires, ACL par défaut, rôles et memberships requis, versions/extensions, registre absent ou présent et réglages fournisseur non secrets. Prévoir dans le coffre les paramètres hors base, clés de signature, intégrations Auth, secrets et configuration de service à reconstituer. Traiter le contenu Storage et le Vault séparément si leur usage est constaté.

**PRÉPARÉES — NON EXÉCUTÉES** sur PROD. Les options ci-dessous illustrent l’état initial observé. `$Archive` et `$Toc` sont des destinations privées neuves hors dépôt.

```powershell
if ((Test-Path -LiteralPath $Archive) -or (Test-Path -LiteralPath $Toc)) { throw 'Choisir des destinations neuves' }
& $PgDump --dbname=$ProdReadUri --format=custom --lock-wait-timeout=5s --schema=public --schema=auth --file=$Archive
if ($LASTEXITCODE -ne 0) { throw 'Échec de pg_dump' }
$contents = & $PgRestore --list $Archive
if ($LASTEXITCODE -ne 0) { throw 'Archive illisible' }
$contents | Set-Content -LiteralPath $Toc -Encoding utf8 -ErrorAction Stop
Get-FileHash -LiteralPath $Archive, $Toc -Algorithm SHA256
```

Contrôler séparément le code de sortie de chaque outil. Consigner l’heure de début du snapshot, le TOC, les tailles et les empreintes et confirmer le périmètre. Un TOC lisible atteste la présence des objets listés. La reprise requiert une restauration et des contrôles effectifs. Les rôles globaux et la configuration de plateforme sont hors de l’archive PostgreSQL. L’option Supabase CLI filtre des schémas gérés par défaut, dont Auth et Storage. [pg_dump 17](https://www.postgresql.org/docs/17/app-pgdump.html) · [Périmètre Supabase CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)

**PRÉPARÉES — NON EXÉCUTÉES au lot D**, sur une cible **isolée** identifiée et compatible. Utiliser une image avec les objets Auth gérés et les rôles attendus déjà en place. Établir un TOC approuvé des objets propres au projet, des lignes Auth autorisées et de leurs dépendances dans le bon ordre, avec le registre et les ACL lorsqu’ils existent. Conserver les propriétaires et comparer les défauts de création de la cible. Le premier essai C a montré que des grants par défaut de la cible pouvaient survivre au rejeu des ACL d’objet. Le second essai a neutralisé ces défauts dans un prélude transactionnel, puis rejoué les `DEFAULT ACL` de la source et exécuté une garde d’ACL avant commit.

```powershell
& $PgRestore --use-list $RestoreToc --file $RestoreSql $Archive
& $Psql -X -w -v ON_ERROR_STOP=1 --single-transaction -d $RestoreUri -f $RestorePrelude -f $RestoreSql -f $RestoreAclGuard
```

Avant le second appel, vérifier la cible isolée, la matrice d’ACL, l’absence de changement de connexion ou de commit de niveau supérieur dans le SQL. Comparer les objets fournisseur préexistants, notamment `public.rls_auto_enable()`, avant de les omettre du TOC. Après import, comparer schéma, propriétaires, ACL explicites et effectives, registre, contraintes, données et agrégats Auth. Dans l’essai synthétique, tester connexion avec nouvelles sessions et isolation JWT A/B. Qualifier la portée sessions/MFA/identités selon le service utilisé. Chronométrer, valider le RPO/RTO et faire accepter le point de reprise avant P. Un essai utilisant des données PROD requiert une autorisation et un périmètre de conservation distincts. [Recette synthétique du lot C](../validations/VALIDATION-LOT6-6-0-C.md#f-recette-avec-docker-desktop)

## 2. Séquence d’installation sous accord distinct

| Étape | Cible et preuve de passage |
| --- | --- |
| 1. Préflight final | PROD en lecture seule. Contrôler l’ensemble de la section 1 et l’accord opérateur. |
| 2. Sauvegarde autorisée | PROD en lecture et stockage privé. Produire le snapshot avant P. |
| 3. Point de reprise | Validation humaine du TOC, des empreintes, de la couverture et de la répétition isolée. |
| 4. P | PROD sous `postgres`. La transaction révoque les défauts, crée un témoin puis le retire. |
| 5. ACL après P | PROD en lecture seule. Vérifier les seuls deltas attendus, la disparition du témoin et le registre inchangé. |
| 6. M1 | PROD. Préfixe limité à M1 et registre initial confirmé. |
| 7. Vérifications M1 | Une version et un profil par compte, zéro profil orphelin ni compte sans profil. Vérifier deux fonctions privées, le trigger Auth, les privilèges de colonne et le refus effectif de `service_role`. |
| 8. M2 | PROD. Préfixe M1–M2. |
| 9. Vérifications M2 | Trois tables Drill ajoutées, six politiques, clés composées et trois RPC invoker. Vérifier le maintien des profils et le refus direct sur les quatre tables. |
| 10. M3 | PROD. Préfixe M1–M3. |
| 11. Vérifications M3 | Six tables ajoutées, six RPC, gardes et politiques. Vérifier les droits sur les dix tables et quinze routines. |
| 12. M4 | PROD. Préfixe M1–M4. |
| 13. Vérifications M4 | Quatrième entrée, structure métier identique, défauts identiques à l’état post-P et aucun accès direct de `service_role`. |
| 14. M5 | PROD. Préfixe M1–M5. |
| 15. Vérifications M5 | Cinquième entrée et seuls deux codes de conflit modifiés dans la garde privée. Comparer propriétaire, ACL, triggers et catalogue au palier M4. |
| 16. Schéma complet | Comparer types, défauts, colonnes générées, contraintes validées, index, politiques, fonctions, triggers et propriétaires au catalogue de référence. |
| 17. Permissions | Comparer droits de table, colonne, routine et schéma. RLS active sur les dix tables, `authenticated` limité aux privilèges prévus. `anon` et `service_role` sans accès direct applicatif. Contrôler l’unique fonction métier definer et les chemins de recherche vides. |
| 18. Auth | Relever les paramètres, le backfill par agrégats et les erreurs au voisinage des commits sans collecter de données de compte. |
| 19. Historique | Confirmer les cinq versions/noms et, si nécessaire, les instructions enregistrées. Journaliser P séparément avec son empreinte. |
| 20. Fonctionnel | Avec clé publique privée du journal, GET anonyme sur `profiles` refusé et GET avec JWT invalide rejeté. Relever codes HTTP/SQLSTATE. Si des sessions de recette préexistantes sont spécifiquement autorisées, vérifier des lectures propres et croisées avec résultats agrégés. Les RPC d’écriture et flux Auth de recette restent locaux. |
| 21. Clôture | Faire valider les résultats avant de lever les suspensions opératoires. Ranger les preuves privées, retirer les secrets temporaires du terminal. L’activation Pages et les invitations suivent leur procédure distincte. |

Commandes d’écriture **PRÉPARÉES — NON EXÉCUTÉES**, exclusivement pour l’hôte direct PROD et sous autorisation distincte. Vérifier le code de sortie de chaque commande, ainsi que l’état et le hash du préfixe avant tout passage. Les scripts de catalogue et privilèges ont été écrits pour DEV et ne sélectionnent aucune connexion. Les exécuter uniquement comme SQL de lecture avec `$ProdReadUri`, après création confirmée du registre pour le catalogue. Comparer les définitions, et traiter séparément les objets préexistants du fournisseur.

```powershell
# P, une seule fois après le point de reprise.
& $Psql -X -w -v ON_ERROR_STOP=1 -d $ProdUri -f scripts/verification-prod/prepare-permissions.sql

# Un seul fichier supplémentaire par invocation. Contrôler son empreinte avant la CLI.
Copy-Item -LiteralPath (Join-Path 'supabase/migrations' $Next) -Destination (Join-Path $Stage 'supabase/migrations')
& $Cli migration up --workdir $Stage --db-url $ProdUri --agent no --yes

# Lectures après chaque frontière et nouveau point de décision avant de poursuivre.
& $Psql -X -w -v ON_ERROR_STOP=1 -d $ProdReadUri -f scripts/verification-dev/catalogue.sql
& $Psql -X -w -v ON_ERROR_STOP=1 -d $ProdReadUri -f scripts/verification-dev/privileges.sql
```

| Frontière | Tables | Colonnes | Contraintes | Index | Politiques | Fonctions | Triggers | Versions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| P | 0 | 0 | 0 | 0 | 0 | 0 | 0 | Aucune |
| M1 | 1 | 4 | 3 | 1 | 2 | 2 | 2 | M1 |
| M2 | 4 | 29 | 28 | 9 | 8 | 7 | 5 | M1–M2 |
| M3 | 10 | 98 | 95 | 24 | 24 | 15 | 11 | M1–M3 |
| M4 | 10 | 98 | 95 | 24 | 24 | 15 | 11 | M1–M4 |
| M5 | 10 | 98 | 95 | 24 | 24 | 15 | 11 | M1–M5 |

Les compteurs concernent Mon BPREA. P et M1–M3 ont des transactions explicites. M1–M3 peuvent être validées en base avant l’écriture au registre par la CLI. M4 est sans `COMMIT` explicite et son annulation sur erreur a été observée dans le batch de la CLI épinglée. Confirmer les deux états à chaque palier, surtout si le client a perdu le résultat. P applique `lock_timeout=5s` et `statement_timeout=30s` localement. Le pilote de migration doit appliquer 5 s et 120 s, respectivement. Ces valeurs bornent l’attente de verrou et la durée **par instruction**, tandis que l’opérateur borne la durée totale et les délais réseau. [Recette des incidents](../validations/VALIDATION-LOT6-6-0-C.md#e-pannes-reprise-et-sauvegarde) · [Traitement du registre par la CLI](https://github.com/supabase/cli/blob/v2.121.0/apps/cli-go/pkg/migration/file.go)

## 3. Incidents, arrêts et reprise

Arrêter l’enchaînement, maintenir le gel et capturer, dans une **nouvelle session vérifiée**, registre, catalogue, droits et agrégats. Vérifier d’abord si l’ancienne session ou des verrous sont encore actifs. La décision appartient à l’opérateur désigné après comparaison au dernier palier sain.

| Incident | Contrôle immédiat | Décision et reprise |
| --- | --- | --- |
| P échoue ou résultat perdu | Comparer défauts initiaux/post-P, absence du témoin et registre intact. | ACL initiales confirmées et cause levée, rejouer P sous le mandat de la fenêtre. ACL post-P exactes, journaliser le succès constaté. État mixte ou privilège hérité, suspendre pour une décision séparée. |
| M1 échoue | Attendre état post-P, aucun objet M1 ni version M1, Auth inchangé. Le registre technique peut exister vide. | Confirmer l’intégrité Auth et diagnostiquer l’échec ou le verrou. Reprendre M1 seule si le palier précédent est intact. Si les objets M1 sont visibles, traiter l’historique avant de poursuivre. |
| M2 échoue | Attendre profil, trigger Auth et seule version M1, ou constater les quatre tables avec M2 déjà validée. | Si l’état M1 est exact, reprendre M2 seule après résolution. Sinon rapprocher structure, données et registre. |
| M3 échoue | Attendre quatre tables et M1–M2, ou constater les dix tables avec M3 déjà validée. | Préserver les profils et données Drill. Reprendre M3 seule uniquement depuis un palier M2 vérifié. |
| M4 échoue | Vérifier registre M1–M3 et ACL post-M3, y compris droits hérités et de colonne. | Reprendre M4 seule après correction approuvée si les ACL post-M3 sont exactes. À tout accès direct inattendu, maintenir l’arrêt et identifier le chemin du grant. |
| M5 échoue | Vérifier la définition effective de la garde, son propriétaire et ses ACL, ainsi que le registre. | Reprendre M5 seule après correction approuvée si le palier M4 est intact. En cas de divergence entre le registre et la définition, suspendre. |
| Objets conformes, version manquante | Comparer catalogue entier, ACL, lignes, dépendances, empreinte et ordre. | Réparation de la seule version prouvée, sous accord distinct, puis relecture intégrale. Rejouer le fichier présente un risque de collision ou de modification. |
| Version présente, objets absents ou partiels | Relever instructions, propriétaires, définitions et dernier point sain. | Arbitrer un delta revu et répété ou une restauration. Toute réparation du registre attend un mandat distinct. |
| Verrou prolongé ou connexion interrompue | Examiner sessions/verrous et état du commit depuis une autre connexion. | Attendre ou reporter le créneau. Toute interruption d’une autre session exige une décision séparée. Reprendre seulement après classification certaine de l’état. |
| Trigger Auth ou flux de connexion en erreur | Suspendre les invitations, comparer agrégats et contraintes, vérifier droits/owner et réglages. | Vérifier l’issue de la transaction Auth avant toute nouvelle invitation. Décider d’un correctif ciblé ou d’une reprise isolée sous mandat. |
| Restauration requise | Sécuriser état actuel, preuves et sauvegarde, évaluer écritures/effacements depuis le snapshot. | Restaurer d’abord en cible isolée, vérifier et réconcilier, puis faire approuver le plan réel de retour. Une remise d’ACL pré-P doit considérer les objets déjà installés et l’exposition qui en découlerait. |

Commande de registre **PRÉPARÉE — NON EXÉCUTÉE**, cible PROD après autorisation explicite et vérification du préfixe. Le cas M2 ci-dessous a été répété uniquement sur une base fictive.

```powershell
& $Cli migration repair --workdir $Stage --db-url $ProdUri --status applied 20261024083417 --agent no --yes
```

Limiter les compensations aux deltas examinés et approuvés. Les opérations de remise à zéro, de suppression en cascade et les réparations automatiques du registre sont exclues du plan de reprise.
