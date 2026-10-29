# Exécution du lot 6.5.3.B — sauvegarde et migration DEV

**29 octobre 2026, Europe/Paris. Migration installée, schéma vérifié, prêt pour une recette hébergée autorisée ultérieurement.** Copie applicative native et restauration PostgreSQL partielle vérifiées avant l’écriture. Aucune recette connectée, ouverture, restauration individuelle ou intervention PROD.

La [préparation du 28 octobre](VALIDATION-LOT6-5-3B.md) et les audits 6.5.2/6.5.3.A gardent leur portée historique. La PR #28 a été fusionnée par l’exploitant ; ce suivi documentaire décrit l’exécution ultérieure, sans fusion automatique.

## Cible et référence immuables de l’intervention

| Élément | Preuve observée |
| --- | --- |
| Projet | `wcckbyhrtroittbfophv`, Mon BPREA DEV, eu-west-1, ACTIVE_HEALTHY |
| Offre / moteur | Organisation relue Free / tier_free ; PostgreSQL 17.11.0.003, moteur majeur 17 ; aucun achat ni changement de moteur |
| Git | Fetch origin, `origin/main = HEAD = 65847b8819df5d685b48cffca0d20b675629ddf1` au lancement ; branche `feature/lot6-5-3b-backup-migration-dev`, worktree suivi propre |
| Avant | `20261022000100 profiles` puis `20261024083417 create_drill_sync_schema` ; quatre tables et sept fonctions, sans installation personnelle partielle |
| Fichier appliqué | [20261025143831_create_personal_data_backend.sql](../../supabase/migrations/20261025143831_create_personal_data_backend.sql), non modifié |
| SHA-256 du fichier CRLF | `e30acdeae62080380e5767600ccb78897537ff5369b48a4f3f2bb9f065bc96ec` |
| Après | Deux anciennes versions conservées + `20261025143831 create_personal_data_backend`, aucune quatrième version |
| Hors périmètre | PROD non consulté, aucune liaison/lecture/restauration PROD ; aucun compte, session, lien, e-mail, SMTP, réglage Auth, Edge Function ou déploiement Pages réalisé par l’agent |

## Décisions et protection des copies

L’exploitant a choisi une racine absolue hors dépôt, réservé DEV au fictif puis autorisé explicitement **la copie applicative et le dossier protégé**. Il a déclaré le dossier exclu de toute synchronisation cloud et dispensé cette copie de chiffrement du volume. Il a ensuite choisi `pg_dump` et donné B : **« Ok on va partir sur pg dump. J’autorise B »**.

Une première authentification PostgreSQL a été refusée avant copie. L’exploitant a déclaré avoir réinitialisé le mot de passe de la base DEV puis demandé la reprise. L’agent n’a effectué aucune réinitialisation. La tentative réussie utilise un autre sous-dossier ; le diagnostic initial est conservé, aucun dump précédent écrasé.

A et B restent deux décisions séparées. B avait déjà été reçu lors de la reprise ; l’opération a attendu la copie, la restauration, la présentation de leurs limites et les contrôles immédiats. Aucun nouvel accord n’a été déduit du silence, de la CI ou du seul fait que DEV est fictif.

| Protection | État réel / limite |
| --- | --- |
| Destination | Hors dépôt et hors dépôt parent englobant ; chemin nominatif et empreintes conservés uniquement en privé |
| ACL | Héritage retiré, trois destinataires : exploitant, SYSTEM, administrateurs locaux ; protections vérifiées avant copie |
| Chiffrement | Non exigé pour cette copie par décision explicite de l’exploitant ; aucune affirmation de chiffrement établi |
| Cloud | Exclusion déclarée par l’exploitant ; tous les synchroniseurs du poste ne sont pas certifiés techniquement |
| Secret DB | Champ local masqué, environnement du seul processus ; aucune valeur dans arguments, URL, Git, capture, rapport ou conversation ; libération en fin de processus |
| Conservation | Sept jours ; réexamen au **5 novembre 2026 à 17:51:03 UTC**, soit 18:51:03 à Paris ; pas de purge automatique ni prolongation implicite |
| Résidus | Archive, SQL dérivés, réexports de comparaison, journaux et clusters locaux arrêtés sous les mêmes protections/échéance |
| Diffusion | Aucune ligne Auth/profil/pédagogique transmise au modèle, Git, CI ou service de diagnostic ; seuls résultats minimisés et métadonnées sont publiés |

Ces décisions ponctuelles ne valident pas globalement D07/D08/D13, la politique de conservation ou une perte future de comptes. Aucun compte fictif n’est effacé ou réputé jetable.

## Copie réalisée et niveau de récupération

Outils PostgreSQL **17.11** portables depuis la distribution officielle Windows/EDB : `pg_dump`, `pg_restore`, `psql`, `initdb`, `pg_ctl`. Aucun Docker Desktop, service Windows, PATH système ou paquet du site ajouté. Connexion distante `verify-full` avec CA publique issue du panneau DEV ; aucun contournement de certificat.

| Étape | Instant UTC / résultat |
| --- | --- |
| Copie | **17:51:03–17:51:08** : archive custom unique de `public`/`bprea_private`, schémas stricts, grands objets/publications/subscriptions/security labels exclus |
| Dérivations | Schéma SQL, données SQL et TOC obtenus hors ligne depuis cette même archive ; snapshot unique pour structure/données |
| Intégrité | Neuf fichiers non vides, archive lue, tailles et SHA-256 vérifiés ; manifeste privé complété |
| Couverture | `profiles`, `drill_series`, `drill_answers`, `drill_training_attempts`, objets/ACL et version/nom des deux migrations ; catalogues avant/après sans dérive |
| Reconstruction synthétique | Les trois fichiers Git exécutés sur une base native vide ; comparaison complète du schéma initial et de ses droits à DEV, puis construction du schéma attendu après migration ; quinze corps de fonctions identiques à Git |
| Restauration réelle limitée | **17:55:47** : import pre-data/data/post-data dans un autre cluster neuf privé, contraintes/FK validées, quatre tables réexportées et blocs COPY triés comparés en privé : identiques |
| Métadonnées restaurées | Structure, RLS, propriétaires et ACL effectives concordantes ; seul trigger attaché à Auth exclu de la comparaison de restauration |
| Fin d’essai | Clusters arrêtés ; aucune écoute résiduelle sur le port local dédié 65433 |

L’essai emploie seulement des dépendances Auth minimales dans le cluster natif : table UUID et `auth.uid()` factice. Les racines UUID proviennent des données applicatives restaurées, sans extraction Auth. Ce ne sont ni des identités Supabase ni des comptes connectables.

Le premier essai de restauration a révélé l’absence du contexte initial `public` d’initdb après sa suppression locale. Le diagnostic est conservé. Le second cluster neuf garde ce schéma et son USAGE PUBLIC, omet seulement son CREATE déjà présent dans la liste TOC puis restaure les ACL. L’ACL nulle du schéma privé a été rapprochée des seuls droits implicites de son propriétaire postgres, avec contrôle des droits effectifs. Aucune différence de droit hébergé ignorée ou corrigée pour obtenir un succès.

**Niveaux 1/2/3 applicatifs atteints. Restauration Supabase complète non démontrée.** Auth/comptes/identités/sessions, trigger attaché à Auth, Storage, Vault, rôles globaux, extensions gérées, réglages et secrets hébergés ne sont pas récupérés par cet essai. La sauvegarde des données postérieures à 17:51 et celle des six nouvelles tables ne sont pas couvertes par cette copie d’avant migration. Les instructions `restauration.md`, le manifeste et les preuves détaillées restent privés.

## Application sous autorisation B

Préflight immédiat : manifeste et neuf empreintes vérifiés ; restauration positive ; Git/fichier/liste locale exacts ; deux versions distantes et métadonnées/droits identiques à l’après-copie. Aucun dry-run distant ni réparation.

```text
npx --yes supabase@2.121.0 db push --db-url "postgresql://db.wcckbyhrtroittbfophv.supabase.co:5432/postgres?sslmode=verify-full" --skip-vault
```

Cette variante remplace la commande liée envisagée le 28 octobre : URL publique sans utilisateur/mot de passe, hôte DEV explicite ; `PGUSER=postgres`, `PGPASSWORD` issu de la saisie locale, `PGSSLROOTCERT` et timeout fournis au processus. La source du [parseur PG](https://github.com/supabase/cli/blob/v2.121.0/apps/cli/src/command-internal/db-config.parse.ts) et du [pilote TLS](https://github.com/supabase/cli/blob/v2.121.0/apps/cli/src/command-internal/db-connection.sql-pg.layer.ts) confirme cette configuration, sans besoin de rôle de login temporaire. `--skip-vault` est maintenu ; aucun include-all/seed/roles.

**Écart de confirmation documenté :** le terminal était réellement TTY et `SUPABASE_YES=false`. La CLI a néanmoins émis un résultat machine JSON et appliqué directement, sans attendre de réponse interactive ; aucune réponse « y » n’a été envoyée. B couvrait déjà cette seule application, et les contrôles précédents imposaient son delta unique. Ne pas présenter cet événement comme une confirmation manuelle de prompt. La raison exacte du choix du mode machine n’a pas été isolée ; toute future procédure doit contrôler le mode agent/sortie et la confirmation effective, sans compter uniquement sur TTY.

Résultat observé : code **0**, `dryRun: false`, liste contenant seulement `20261025143831_create_personal_data_backend.sql`, `seeds: []`, `roles: []`. Une seule exécution ; ni retry, ni reset, ni repair. Les fichiers SQL versionnés et les réglages Supabase n’ont pas été ajustés pour faire passer l’opération.

## Vérification structurelle hébergée

Les [catalogues](../../scripts/verification-dev/catalogue.sql) et [privilèges](../../scripts/verification-dev/privileges.sql) ont été exécutés en transactions lecture seule sur le DEV explicitement identifié. Comparaison finale à **18:03:57 UTC**, soit 19:03:57 à Paris, avec la reconstruction native depuis Git et le relevé pré-intervention : **aucune différence inexpliquée**, aucun objet/droit antérieur perdu.

| Domaine | Constat effectif, au-delà des nombres |
| --- | --- |
| Tables | Dix, propriétaire postgres, RLS on et FORCE RLS off ; aucune relation applicative inattendue |
| Colonnes | 98 ; ordre, noms, types, précision, nullabilité, DEFAULT, generated et ACL comparés |
| Contraintes | 95 validées ; PK/UNIQUE/CHECK/FK, ordres composites et CASCADE comparés, dont les six nouvelles racines Auth |
| Index | 24 valides/prêts ; définitions, ordre et unicité comparés |
| Triggers | Onze actifs, dont le trigger Auth antérieur ; événements et fonctions comparés |
| Policies | 24 `authenticated` propriétaire ; USING/WITH CHECK concordants ; aucun DELETE étudiant ni ouverture anon |
| Routines | Quinze hors extensions, six privées et neuf RPC ; signatures/retours/langue/sécurité/volatilité/strict/leakproof/parallel/contexte/propriétaires/ACL et corps comparés |
| Droits effectifs | 30 relevés de table, 294 de colonne, six de schéma et 45 de fonction ; seuls droits métier attendus, privé refusé aux clients, nouveaux REVOKE service_role conservés |
| Préservation | Tous les objets et droits profils/Drill, défauts ACL et cinq extensions antérieurs conservés ; absence de DML ancien dans le fichier appliqué |
| Ledger | Trois versions exactes, noms attendus, aucune quatrième ; effets et inscription concordants |

Data API relue dans Dashboard DEV le 29/10 après application : public et graphql_public cochés, bprea_private non coché ; auto-exposition on, extra search path public/extensions, max rows 1000, pool automatique. Menus seulement consultés, aucun changement/Save. Les indicateurs « 0 of 10 tables / 0 of 15 functions exposed » ne constituent pas un refus ou succès d’accès JWT : les droits SQL ciblés sont la preuve structurelle ; l’accès PostgREST réel attend la recette.

Conseiller sécurité : même WARN [protection des mots de passe compromis](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), aucune nouvelle alerte de RLS. Performance : six INFO [unused_index](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index), les deux index Drill et quatre nouveaux index d’historique personnels ; aucun index supprimé.

## Dépôt, contrôles et livraison

Le suivi ne modifie que des documents. Les scripts de catalogue existants, migrations, application, dépendances/verrou, SDK, configuration publique Auth off, workflows et protections restent inchangés. Les preuves opérationnelles, chemins, empreintes et fichiers de copie restent hors Git/Actions. Aucun runner de sécurité n’est redirigé vers DEV.

Contrôles locaux du 29 octobre, Node **24.22.0**, données et profils Chromium temporaires isolés :

| Contrôle | Résultat |
| --- | --- |
| npm ci | Réussi, aucun changement de dépendance ou verrou |
| npx playwright install chromium | Réussi |
| npm test | **417 tests / 43 fichiers réussis**, 4,10 s ; ne valide pas RLS hébergé |
| npm run test:e2e -- --workers=2 | **79/79 réussis**, 1,6 min ; aucun navigateur réel ni endpoint DEV/PROD |
| npm run build:auth-sdk | SDK 2.118.0 reconstruit, bundle versionné identique |
| PostgreSQL natif | Reconstruction vide des trois migrations et restauration privée partielle réellement exécutées, distinctes de tests JWT/Auth |
| Sécurité Supabase locale complète | Non exécutée sur ce poste sans Docker ; réservée à la stack synthétique du job supabase-security, jamais remplacée par DEV |

Revue documentaire : **12 Markdown, 204 liens locaux, 41 tableaux, 14 décisions et 15 P0**, zéro anomalie de lien/tableau/encodage/périmètre ou signal de secret dans les documents modifiés. Sept rendus ordinateur/mobile, clair/sombre, ont été inspectés. L’artefact local conserve 127 fichiers publics plus `.nojekyll`, 292 références versionnées et Auth off ; aucune documentation, copie SQL, configuration privée ou preuve opérationnelle incluse. Son empreinte est identique à celle de la préparation du 28 octobre.

La CI de la nouvelle tête est vérifiée séparément et consignée dans la description de PR. Les verts de la PR #28 ne valent pas résultat de cette nouvelle tête. Aucune donnée de la copie ne rejoint les jobs.

## Limites et suite

La recette connectée, les tests JWT/RLS A/B hébergés, invitations/récupération manuelles, réglages Auth et clôture restent à autoriser et tester dans le [plan dédié](../deploiement/PLAN-RECETTE-DEV.md). Aucune fonction de réimport JSON individuelle n’est développée.

Aucun P0 de préouverture n’est levé par cette intervention ; D07/D08/D13 gardent leurs décisions générales ouvertes. Auth public reste fermé, la configuration statique publique reste désactivée, PROD est exclu. Avant toute restauration future : autorisation distincte, comparaison des données récentes et réapplication des effacements ; aucune recréation automatique de compte supprimé.

Guides actuels : [sauvegarde/récupération](../deploiement/SAUVEGARDE-TECHNIQUE-SUPABASE-FREE.md), [runbook](../deploiement/RUNBOOK-MIGRATION-DEV-6-5-3B.md), [matrice](../deploiement/MATRICE-ECARTS-DEV.md), [préparation JSON](../deploiement/PREPARATION-RESTAURATION-COMPTE-JSON.md). Références : [backups Supabase](https://supabase.com/docs/guides/platform/backups), [effets CLI 2.121.0](https://github.com/supabase/cli/blob/v2.121.0/apps/cli/src/commands/db/push/SIDE_EFFECTS.md), [changement Data API du 30 octobre](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).
