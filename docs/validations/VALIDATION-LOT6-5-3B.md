# Validation du lot 6.5.3.B — préparation du 28 octobre

**Clôture technique du 29 octobre 2026 : copie applicative et restauration PostgreSQL partielle vérifiées, migration unique installée et schéma DEV contrôlé.** Le [rapport d’exécution daté](EXECUTION-LOT6-5-3B-2026-10-29.md) porte les autorisations A/B, la méthode native retenue, les preuves et limites actuelles. Les constats ci-dessous sont la préparation historique ; leurs mentions de non-exécution décrivent le 28 octobre.

## Préparation du 28 octobre — historique

**28 octobre 2026, Europe/Paris. PHASE PRÉPARATOIRE. EN ATTENTE D'AUTORISATION A.** Métadonnées DEV relues ; aucune sauvegarde de données, restauration ou migration hébergée exécutée. B non demandé, faute de sauvegarde/décision de risque. Ce rapport ne vaut ni recette connectée, ni validation juridique, ni ouverture.

## Git, périmètre et livrables

AGENTS.md, TESTS, références du mandat, migrations et tests SQL, scripts pertinents, config.toml, configuration publique, ignore et trois workflows relus. Worktree initial unique et propre, sur `feature/lot6-5-3a-liens-auth-manuels`, tête afba679. `git fetch origin` a actualisé main de 96a1633 à **`51c1165cc976d20a9c1a834c93b0b96f22154acc`**. La [PR #27](https://github.com/Vladoche/mon-bprea/pull/27) est confirmée fusionnée par Git et le connecteur GitHub, commit identique. Branche **`feature/lot6-5-3b-backup-migration-dev`** créée depuis ce dernier origin/main. Aucun fichier préexistant supprimé/déplacé, aucun travail direct sur main.

Le [ruleset actif #25489814](https://github.com/Vladoche/mon-bprea/rules/25489814), relu en lecture seule via GitHub et son interface, cible main et exige PR, refus suppression/force-push et les trois checks **unit-integration, e2e, supabase-security**. Aucun changement de protection. Workflows conservés : Qualité et sécurité sur PR, stack Supabase synthétique isolée ; Pages uniquement sur push main/lancement manuel. Intégration automatique DEV relue off ; aucune consultation de celle de PROD.

| Livrable | Résultat préparé |
| --- | --- |
| [Sauvegarde Free](../deploiement/SAUVEGARDE-TECHNIQUE-SUPABASE-FREE.md) | Couverture A–G, copie applicative bornée, exclusions exactes CLI dont Auth, protections et commandes privées, manifest, trois niveaux, récupération isolée et limites, sept jours proposés à décider |
| [Runbook](../deploiement/RUNBOOK-MIGRATION-DEV-6-5-3B.md) | A puis B, seule migration et son SHA, relecture SQL/risques, commande candidate avec skip-vault, contrôles de chaque objet/droit et arrêt sûr |
| [Note JSON](../deploiement/PREPARATION-RESTAURATION-COMPTE-JSON.md) | Besoins des prochains lots seulement : propriétaire/portée, format, aperçu, historique/CAS/outboxes/conflits/idempotence et compte supprimé ; aucun import codé |
| [Catalogue](../../scripts/verification-dev/catalogue.sql) et [privilèges](../../scripts/verification-dev/privileges.sql) | Deux scripts de SELECT de métadonnées, transaction read only/rollback, aucun choix de connexion, données métier ou accès secrets ; exécutés en lecture seulement sur le DEV explicitement identifié |
| Plans, dossier, décisions, exploitation, TESTS et README | Liens et états actuels ciblés ; audits/validations historiques intacts, D07/D08/D13 et quinze P0 toujours ouverts |

## Journal des lectures réelles

Fenêtre des consultations de préparation : **21:15–21:33 UTC le 28/10/2026**, soit **22:15–22:33 à Paris**. Le journal indique les sources et leur périmètre, pas une garantie d'état continu jusqu'à une opération future. La référence exacte DEV a été vérifiée dans les arguments MCP et les URL de Dashboard ; aucun list_projects ou appel PROD.

| ID | Lecture / résultat constaté | Limite |
| --- | --- | --- |
| B01 | get_project(`wcckbyhrtroittbfophv`) : Mon BPREA DEV, eu-west-1, ACTIVE_HEALTHY, version 17.11.0.003, moteur 17, ga | Pas de test de disponibilité de l'application/Auth/PostgREST |
| B02 | get_organization de l'organisation associée : plan free, tier_free ; Free également affiché dans DEV | Métadonnées d'offre, pas de facturation ni lecture d'un autre projet |
| B03 | list_migrations DEV : exactement 20261022000100 profiles et 20261024083417 create_drill_sync_schema | Complété par les effets observés dans les catalogues |
| B04 | get_advisors security : un WARN auth_leaked_password_protection ; performance : deux INFO unused_index sur les index Drill attendus | Aucun correctif, suppression d'index ou alerte masquée ; pas de lecture de logs individuels |
| B05 | Première paire SELECT catalogue/ACL : 4 tables, 29 colonnes, 28 contraintes, 9 index, 5 triggers dont Auth, 8 policies, 7 fonctions ; privilèges effectifs et extensions | Aucune ligne Auth/profil/pédagogique, ni comptage utilisateur ; corps SQL lus comme texte |
| B06 | Deux paires de scripts versionnés, enrichies puis finales, réellement exécutées dans des transactions read only : mêmes objets ; historique version/nom ; inventaire exhaustif des routines hors extensions ; droits de colonnes SELECT/INSERT/UPDATE/REFERENCES et droits MAINTAIN | Pas de quatrième migration, routine supplémentaire, relation privée, séquence ou foreign table public observée ; pas de test JWT ou appel métier |
| B07 | Dashboard DEV Data API : public et graphql_public cochés ; bprea_private non coché ; auto-exposition on ; extra search path public/extensions ; max rows 1000, pool non renseigné | Menus seulement ouverts/fermés, aucune sélection changée ni Save ; pas de GET PostgREST |
| B08 | Dashboard DEV Settings/Integrations : Deploy to production off ; Automatic branching off et verrouillé Free ; working directory `.` | Aucun Save ni modification, aucune consultation PROD |
| B09 | Dossier parent hors dépôt choisi par l'exploitant : chemin résolu ordinaire, pas de lien de réanalyse ; ACL héritée donnant aussi lecture à la sandbox | Pas de sous-dossier de sauvegarde créé ni d'ACL modifiée. BitLocker : erreur CIM d'accès, chiffrement **non établi** ; synchronisation cloud **non vérifiée** |

Dans B07, les compteurs Dashboard « 0 of 4 tables / 0 of 7 functions exposed » ont été affichés malgré les droits SQL ciblés observés. Leur sémantique ne constitue pas une preuve de refus d'accès authenticated. Les schémas cochés sont confirmés visuellement ; les ACL effectives le sont par les fonctions intégrées has_*_privilege. Aucun bouton d'exposition n'a été actionné pour faire coïncider ces indicateurs. L'accès réel de l'étudiant reste à recetter ultérieurement.

Alertes conservées : [mots de passe compromis](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) et [index inutilisés](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index). Les deux index servent le modèle d'historique/FK/pagination ; aucun retrait justifié par ces INFO. Les réglages Auth détaillés du 6.5.2 restent **historiques, non relus intégralement ici**, non modifiés. Aucune disponibilité ou conformité globale déduite d'ACTIVE_HEALTHY.

## Comparaison SQL et état de DEV

Les deux migrations anciennes ont été lues intégralement et rapprochées des définitions actuelles. La comparaison locale de tous les champs du catalogue initial avec le relevé historique minimisé du 6.5.2 ne trouve **aucune différence** après tri des collections ; idem pour le périmètre commun des privilèges. Ce contrôle porte sur les définitions/ACL, pas sur les lignes. Il complète la comparaison aux migrations ; il ne certifie pas toutes les opérations administratives ayant pu avoir lieu.

Les **sept corps de fonctions actuels sont identiques à Git** après seule normalisation CRLF→LF et retrait des blancs externes ; signatures, retours, propriétaires postgres, langue plpgsql, volatilité, contexte et droits contrôlés. L'inventaire sans filtre de préfixe trouve exactement ces sept routines hors extensions. RLS on sur quatre tables, huit policies de propriétaire authenticated, FK/CHECK validées, neuf index valides/prêts et cinq triggers actifs. Pas de vue public, relation bprea_private, séquence/foreign table public ou objet personnel partiel observé.

Privilèges : anon sans accès table ni SELECT/INSERT/UPDATE/REFERENCES de colonne ; authenticated SELECT, UPDATE pseudo uniquement pour profiles, INSERT des seules colonnes métier Drill ; propriétaire/dates/correction serveur protégés, pas d'UPDATE/DELETE pédagogique. Privé sans USAGE/EXECUTE client, RPC Drill EXECUTE authenticated seul hors propriétaire. Les droits administratifs préexistants service_role des quatre tables correspondent aux anciennes migrations ; ils ne sont pas réutilisés pour représenter un étudiant. Défauts public encore larges pour les futurs objets postgres/supabase_admin ; aucun changement effectué.

| Fichier Git (octets du checkout CRLF) | SHA-256 constaté | DEV |
| --- | --- | --- |
| 20261022000100_profiles.sql | `4a05b8c2405821ebbe2ecad5f496761c051d71921285f9446d899efb05ab2c69` | Installé, effets cohérents dans le périmètre relu ; ne pas rejouer |
| 20261024083417_create_drill_sync_schema.sql | `b2c5bf77b94dbeade69bf321741e09068eb7f5dcab14dc5aa68a072272e315c7` | Installé, mêmes réserves ; ne pas rejouer |
| 20261025143831_create_personal_data_backend.sql | `e30acdeae62080380e5767600ccb78897537ff5369b48a4f3f2bb9f065bc96ec` | **ABSENT CONFIRMÉ** ; six tables et huit fonctions personnelles absentes |

Le candidat a été lu intégralement : BEGIN/COMMIT, six tables, deux guards, six RPC, seize policies et six triggers, FK/index/contraintes, grants de colonnes, révisions et idempotence. Aucun DROP/TRUNCATE/effacement ou réécriture des quatre anciennes tables. Pas de changement de moteur, de nouvelle extension ou fonction definer. Les dépendances Auth et privilèges, collisions, verrous/attentes et incertitude entre COMMIT SQL et ledger CLI sont traités dans le runbook. Aucun SQL versionné modifié.

Les cibles après application sont **10 tables / 11 triggers / 24 policies / 15 fonctions dont 9 RPC** ; calculées à partir des trois migrations, pas observées sur DEV. Le plan compare colonnes/types/defaults/nullabilité, PK/UNIQUE/FK/CHECK/CASCADE, index, signatures/corps/propriétaires, triggers, policies et privilèges effectifs, ainsi que schémas API. Aucun simple comptage ne sera suffisant. Aucun contrôle post-migration effectué puisque la migration n'a pas été exécutée.

## Documentation officielle et outils

Relus le 28/10/2026 : [backups](https://supabase.com/docs/guides/platform/backups), [backup/restauration CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [référence CLI](https://supabase.com/docs/reference/cli/introduction), [migrations](https://supabase.com/docs/guides/local-development/database-migrations), [sécurité Data API](https://supabase.com/docs/guides/api/securing-your-api) et [changelog](https://supabase.com/changelog). L'index .md est refusé par le lecteur web pour son content-type ; repli sur les pages HTML officielles et search_docs, sans extrapoler une consultation réussie de l'index.

La [notice du 30 octobre](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically) confirme les grants explicites pour les futures tables, distincts de RLS et des schémas exposés. Le SQL candidat comporte déjà ces droits minimaux. Aucun GRANT global, exposition anon, modification service_role ou suppression RLS ; 42501 à diagnostiquer dans la recette future.

La CLI **2.121.0** a été exécutée avec --version, db --help, db dump --help, db push --help et start --help, uniquement de l'aide. Premier essai npm bloqué ENOTFOUND en sandbox puis interrompu ; relance autorisée réussie, sans upgrade malgré l'avis 2.122.0. Sources officielles de cette version lues : [environnements/exclusions](https://github.com/supabase/cli/blob/v2.121.0/apps/cli/src/command-internal/pg-dump.env.ts), [scripts de dump](https://github.com/supabase/cli/blob/v2.121.0/apps/cli/src/command-internal/pg-dump.scripts.ts), [effets dump](https://github.com/supabase/cli/blob/v2.121.0/apps/cli/src/commands/db/dump/SIDE_EFFECTS.md) et [effets push](https://github.com/supabase/cli/blob/v2.121.0/apps/cli/src/commands/db/push/SIDE_EFFECTS.md).

Constats déterminants : les exclusions schéma/données diffèrent et un data-only non borné peut copier Auth/Storage ; --schema explicite change le périmètre ; rôles sans mots de passe et schémas gérés partiels ; dump dry-run imprime le mot de passe résolu ; sortie --file potentiellement écrasée ; push peut toucher Vault sauf --skip-vault. La commande candidate précise --linked et --project-ref DEV ; aucun push, dry-run distant, dump, pull, link ou repair exécuté.

## Sauvegarde, autorisations et risque résiduel

| Décision / opération | État réel |
| --- | --- |
| Racine de destination | Choisie explicitement par l'exploitant dans la conversation, hors dépôt ; chemin nominatif non publié dans Git. Sous-dossier neuf, ACL privées et chiffrement/cloud restent à établir. |
| Nature DEV | L'exploitant déclare un environnement réservé aux données fictives ; aucune inspection de contenu ni autorisation de perte déduite. |
| Accord A de copie | **NON OBTENU**. Choix du chemin et réponse sur le fictif ne valent pas autorisation. Dossier et fichiers de sauvegarde non créés. |
| Copie réelle / preuve | **NON RÉALISÉE**. Aucune taille, empreinte, fin de dump ou couverture effective annoncée ; pas de manifest de sauvegarde fictivement rempli. Les JSON locaux de catalogues ne sont pas une sauvegarde des données. |
| Intégrité/couverture/restauration | Trois niveaux documentés ; aucun niveau atteint pour une copie réelle inexistante. **Restauration synthétique et restauration issue de DEV NON EXÉCUTÉES** : Docker/psql/pg_dump absents. |
| Risque et alternative | Protection applicative limitée, Auth exclu, reconstruction synthétique possible seulement après décision de perte ; complément Auth séparé possible à réexaminer. **Aucun risque résiduel accepté par l'exploitant** à ce jour. |
| D07/D08/D13 | Sept jours proposés pour la seule copie avant intervention, reprise/effacements/accès à décider ; aucune durée active, purge ni validation globale. |
| Accord B / migration | **NON OBTENU / NON EXÉCUTÉE**. Aucune seconde autorisation demandée sans préconditions ; aucun objet DEV modifié. |

## Vérifications locales réellement exécutées

Node **24.22.0**, npm **10.4.0** ; npm ci réussi, aucune dépendance ajoutée/actualisée. Les tests restent sur boucle locale et profils Chromium temporaires, pas sur la production ou le navigateur personnel.

| Contrôle | Résultat / limite |
| --- | --- |
| npm test | **417 tests / 43 fichiers réussis** ; pas une validation RLS hébergée |
| npx playwright install chromium | Réussi ; aucune modification du verrou |
| npm run test:e2e -- --workers=2 | **79/79 réussis, 1,5 min**. Premier démarrage resté bloqué en sandbox puis interrompu code 1 ; relance autorisée réussie sans changement d'URL/test. |
| npm run build:auth-sdk | SDK **2.118.0** reconstruit, git diff --exit-code sur le bundle réussi ; licence/dépendances/configurations publiques préservées |
| SQL | Deux scripts de vérification réellement parsés/exécutés en lecture seule sur PostgreSQL DEV. Migration candidate : revue intégrale/statique, **pas d'application locale sur ce poste** faute de Docker ; syntaxe/exécution à vérifier via le job synthétique de cette PR. |
| Sécurité Supabase locale / récupération | **NON EXÉCUTÉES** sur le poste ; aucun remplacement par DEV ou PROD, pas de dump réel en CI |
| Liens / secrets / artefact / rendu | Revue locale exécutée ci-dessous ; aucune interface produit modifiée |

Les vérifications documentaires et les preuves CI finales sont détaillées ci-dessous ou dans la description de PR ; ne pas confondre état préparé et réussite d'une future exécution.

## Revue documentaire et artefact

Revue locale sous `.tmp/lot653b/review-checks.json` ignoré : **14 fichiers concernés, dont 12 Markdown et deux scripts SQL ; 199 liens locaux, 39 tableaux, 14 décisions et 15 P0**, zéro anomalie de liens/tableaux/encodage ou périmètre. Scans bornés de clés privilégiées, JWT, tokens GitHub, clés privées, URL PostgreSQL avec mot de passe et coordonnées : aucun signal dans ces fichiers ou les textes de l'artefact. Ce contrôle par motifs ne garantit pas l'absence de tout secret possible. Les fichiers non suivis sont limités aux quatre nouveaux documents et deux scripts ; aucun dump de données ni fichier Auth.

Préparateur Pages réel, version `lot6-5-3b-preparation` : **127 fichiers publics + .nojekyll, 292 références versionnées**. SHA-256 de l'inventaire ordonné chemins/contenus : `b64d2f80e35367989c5cbc719002709e412f2d8f40eec973c7e9e5bab58047f5`. Auth off, URL/clé/siteUrl vides ; aucun docs/scripts/supabase/tests/node_modules/.env, outil administratif, SQL ou sauvegarde inclus. Cet artefact est local, pas une publication ni une vérification du CDN.

**Sept rendus Markdown locaux inspectés** : sauvegarde desktop clair et mobile sombre, runbook desktop clair et mobile sombre, validation desktop, note JSON mobile sombre, dossier P0 desktop. Aucun débordement du document ; tableaux et blocs de commandes larges défilent horizontalement. Captures sous `.tmp/lot653b/` ignoré, sans donnée utilisateur. Contrôle git diff --check réussi ; code applicatif, migrations, workflows, dépendances, profils/RLS/grants et JSON de conservation inchangés. La racine choisie est également confirmée hors de tout dépôt Git parent après une lecture autorisée ; un premier essai sandbox de cette lecture avait été refusé, sans conclusion sur Git.

## CI sur la tête finale de PR

| Check obligatoire | Preuve finale requise |
| --- | --- |
| unit-integration | Résultat, SHA et URL du job dans la description de PR après terminaison |
| e2e | Même exigence sur cette tête ; pas le vert historique de #27 |
| supabase-security | Même exigence, trois migrations/pgTAP/Auth/JWT/RLS synthétiques et arrêt de stack vérifiés ; aucune copie réelle |

Au moment du commit de ce rapport, la CI de la future tête n'est pas présumée réussie. Vérifier les trois jobs sur la tête poussée puis consigner les preuves dans la description de PR, sans commit supplémentaire qui déplacerait sa propre tête pour la citer. Tout nouveau commit impose une nouvelle vérification. Aucun workflow/ruleset/nom de check/optimisation #20 modifié.

## Statut final et suite autorisable

**DEV reste à deux migrations, quatre tables applicatives, non prêt pour la recette personnelle complète.** Préparation à livrer en PR, sans fusion ni déploiement. Aucune sauvegarde/restauration ou migration ; aucune ligne Auth/profil/pédagogique lue, aucune donnée supprimée, compte/session créé ou supprimé, lien/e-mail généré, réglage Auth/SMTP/URL/clé/RLS/GRANT/plan/région modifié, fonction Edge déployée ou consultation PROD. Les seules écritures distantes prévues par cette livraison sont le push de branche et la PR GitHub.

Avant copie : A ciblé, outils locaux et protections établis. Avant migration : preuve de copie/niveau de restauration ou décision explicite sur leurs limites et pertes acceptables, nouvelle relecture de cible/Git/historique/objets, puis **B spécifique**. La recette connectée et les lots 6.5.4.A/B restent ultérieurs. Export JSON existant conservé, aucun import ajouté. Toutes les données/progressions, protections locales, défaut Auth off, quinze P0 et décisions de confidentialité sont préservés.
