# Mon BPREA — instructions de travail

## Objectif du projet et priorité actuelle

Maintenir Mon BPREA utilisable dans le cadre de la préouverture privée sur invitation, avec conservation des données, et poursuivre la refonte UX/UI 2027 selon l’[état du projet](docs/developpement/ETAT-DU-PROJET.md). La cible initiale du **13 novembre 2026** est passée ; consulter les jalons vérifiés et les prochaines actions avant de reprendre.
Privilégier les corrections concrètes, les tests pertinents et la livraison. Ce contexte ne vaut pas autorisation d’ouvrir les inscriptions, de publier le site ou de modifier PROD.
Commencer par la [fiche de reprise Codex](docs/developpement/REPRISE-CODEX.md), puis ouvrir uniquement les références utiles au chantier demandé.

## Organisation essentielle du dépôt

- Site statique GitHub Pages, utilisable sans Node.js ; éviter les dépendances inutiles.
- Pages `*.html` et `assets/` : interface, logique partagée et données structurées JSON. Préserver fonctionnalités, URL, identifiants et clés locales.
- `scripts/` : outils locaux ; `tests/` : suites et configurations de test ; `supabase/` : migrations, fonctions et tests de sécurité.
- Guides dans `docs/architecture/`, procédures dans `docs/deploiement/` et `docs/developpement/`, validations en cours dans `docs/validations/`. Les preuves des campagnes antérieures restent dans `docs/archives/validations/` ; les consulter seulement si le chantier le nécessite et maintenir les liens lors d’un déplacement autorisé.
- Pédagogie : 10 nouveaux exercices par UC et semaine, séries précédentes non bloquantes, réussite calculée sur les exercices réalisés, historique statistique conservé, aucune gamification ni badge de récompense.
- Interface responsive et accessible ; préserver le mode sombre et les thèmes saisonniers et horaires.

## Les quatre principes de travail

### 1. Corriger avant de documenter

Identifier la cause probable, vérifier l’hypothèse et corriger immédiatement si cela relève du périmètre autorisé ; tester, puis documenter brièvement le résultat.
Chercher un résultat concret et vérifiable. Réserver l’analyse approfondie aux problèmes complexes, dangereux ou encore mal compris ; ne pas remplacer une correction réalisable par un rapport ou un nouveau lot.

### 2. Réutiliser les validations acquises

Consulter uniquement les décisions et preuves utiles à la tâche ; vérifier leur périmètre, leur validité et les changements matériels depuis leur exécution.
Ne pas relire tous les rapports ni répéter un audit validé sans changement pertinent. Une preuve manquante ou un test non exécuté reste une limite, jamais un succès déduit.

### 3. Maîtriser les fichiers temporaires

Réutiliser les ressources adaptées, éviter les copies complètes et sorties redondantes, regrouper chaque campagne dans un dossier identifié.
Tout artefact créé doit avoir une utilité et une règle de conservation ; appliquer la politique ci-dessous sans purge aveugle.

### 4. Prioriser selon l’impact réel

| Priorité | Critère et conduite |
| --- | --- |
| **P0 — Bloquant** | Faille exploitable, perte/corruption de données crédible, parcours essentiel inutilisable, migration incompatible ou autorisation sensible manquante : traiter avant la livraison concernée. |
| **P1 — Important** | Bug secondaire, performance non critique, dette à impact concret ou test complémentaire utile : traiter selon le temps disponible et le risque de régression. |
| **P2 — Facultatif** | Refactoring esthétique, réorganisation dispensable, optimisation prématurée, documentation ou tests redondants : ne pas bloquer une release. |

Justifier la priorité par un impact démontré ou un risque crédible pour l’utilisateur, les données, la sécurité ou la livraison.

## Workflow standard de développement

**Comprendre → Modifier → Tester → Livrer → Résumer.**

1. Comprendre le résultat attendu et les consignes applicables. Effectuer le contrôle Git de départ avant toute modification.
2. Effectuer la correction ciblée et autorisée ; préserver les changements préexistants. Demander des précisions seulement si une décision incorrecte ou dangereuse ne peut être évitée avec le contexte disponible.
3. Vérifier le comportement et la persistance concernés avec les contrôles proportionnés ci-dessous ; corriger les régressions observées avant de conclure.
4. Livrer un diff limité et vérifiable, puis appliquer la procédure Git de fin de livraison. Respecter les autorisations Git et PROD.
5. Résumer le résultat et les seules suites nécessaires, sans nouveau rapport permanent ni numéro de lot automatique.

## Hygiène Git obligatoire

1. **Avant chaque tâche**, exécuter `npm run git:preflight`, lire les diffs indexés et non indexés pertinents, et examiner les fichiers non suivis, les commits locaux sans référence distante, les worktrees (y compris verrouillés ou résiduels) et les opérations Git en cours. Attribuer les restes d’après des preuves : livraison précédente confirmée, travail légitime en cours, changement ancien non intégré, temporaire régénérable ou origine inconnue. La présence d’un commit uniquement en local impose sa conservation. Ne jamais interrompre ou reprendre une opération d’une autre session.
2. **Isoler la tâche** sur une branche dédiée depuis le SHA d’une référence distante vérifiée (par défaut `origin/main` après `git fetch origin`, ou vérification de la tête distante). Si le répertoire principal est modifié ou occupé, créer un worktree propre dans `.tmp/worktrees/` ou utiliser un worktree géré par Codex. Réutiliser le worktree dédié à une tâche reprise si sa provenance est établie. Préserver le répertoire principal et exclure des commits et PR tous les changements étrangers.
3. **Confirmer la livraison** après revue du diff, vérifications applicables, commits identifiés et présence de ces commits sur le dépôt distant. Vérifier le statut de la PR et de sa fusion, ainsi que le déploiement (réussi, en attente, échoué ou sans objet selon le mandat). Une PR ouverte peut être livrée pour revue dès que sa tête distante et ses vérifications sont confirmées. Un commit uniquement local, une vérification échouée ou une étape requise bloquée restent à signaler avec le travail conservé.
4. **Clore la tâche** après arrêt de ses outils. Avant le compte rendu, lancer `npm run delivery:complete`. Si la livraison est confirmée, ajouter `-- --confirmed` et fournir les noms des seuls builds régénérables générés par la tâche avec `--build`. La commande vérifie la présence des commits sur le distant, l’écart à la base, l’état du checkout et le plafond de 500 Mo. Dans un worktree lié, contrôler aussi le volume du `.tmp` principal par simulation. Si un contrôle est bloqué, conserver et signaler la cause.
5. **Retirer les ressources devenues inutiles** de la tâche confirmée. Depuis un autre checkout stable, appeler `npm run delivery:complete -- --confirmed --retire <branche>` pour la branche locale et son worktree dédié, si leur état est vérifié et si la tâche n’en a plus besoin. Pour un worktree géré par Codex, utiliser son mécanisme d’archivage seulement après les mêmes vérifications et en présence des seules données prévues. Conserver les worktrees et branches des autres tâches, les commits exclusifs, ainsi que tous les fichiers non suivis ou ignorés de provenance incertaine, secrets, configurations locales, sauvegardes et preuves. Aucun nettoyage global, forcé ou déduit de l’âge.

## Maintenance documentaire à chaque livraison significative

À la création d’une PR, identifier les fichiers fonctionnels, guides et contrats concernés, les évolutions d’architecture ou de comportement et les limites connues. Avant livraison :

1. Vérifier les références concernées et corriger les passages devenus faux d’après le code et les preuves disponibles.
2. Ajouter les changements significatifs dans `CHANGELOG.md`, section `Non publié`, avec intitulé stable puis lien de PR dès que connu ; aucune entrée systématique pour une correction insignifiante.
3. Actualiser `docs/developpement/ETAT-DU-PROJET.md` si un jalon, une décision ou la prochaine action change ; garder `REPRISE-CODEX.md` courte et orientée vers ces sources.
4. Vérifier les liens locaux, références de fichiers et ancres importantes ; citer les résultats réellement exécutés et déclarer les contrôles non exécutés.
5. Distinguer fusion, validation, publication et recette hébergée. Après fusion, vérifier numéro/date/SHA réels lors de la reprise suivante, sans exiger le futur commit de merge dans sa propre PR. Après publication autorisée, actualiser le registre Pages du guide d’exploitation depuis le workflow réussi et sa recette, puis l’état central.
6. Préserver les rapports et preuves historiques avec leurs limites datées ; si un passage est déplacé, conserver sa trace et ses liens.

Une information possède un emplacement principal, les autres guides y renvoient. Pour une petite correction, maintenir seulement les documents concernés ; aucun nouveau rapport ou changelog systématique. Pour une livraison majeure, la cohérence de ces suivis est un critère de livraison. Ce suivi documentaire n’autorise aucune fusion, publication ou opération PROD.

## Commandes utiles et validation proportionnée

Utiliser **Node.js 24 LTS** et `npm ci`. Les commandes se lancent depuis la racine ; Python 3.10+ et le port 4173 libre sont nécessaires aux E2E classiques.

| Besoin | Commande |
| --- | --- |
| Installer les outils et Chromium | `npm ci`, puis `npx playwright install chromium` |
| Tests unitaires et d’intégration | `npm test` ; ciblage : `npm test -- tests/unit/dashboard-stats.test.js` |
| Développement interactif | `npm run test:watch` |
| Début de tâche | `npm run git:preflight` puis revue des diffs |
| Fin de livraison confirmée | `npm run delivery:complete -- --confirmed` et options de [maintenance](docs/developpement/MAINTENANCE-DOSSIER-TMP.md) |
| Parcours navigateur | `npm run test:e2e` ; ciblage : `npm run test:e2e -- tests/e2e/critical-paths.spec.js` |
| Vérifier le SDK navigateur verrouillé | `npm run build:auth-sdk`, puis `git diff --exit-code -- assets/vendor/supabase.js` |
| Auth/RLS réels, stack locale dédiée préparée | `npm run test:supabase`, `npm run test:drill:supabase`, `npm run test:personal:supabase`, `npm run test:e2e:supabase` |

- Pour les conventions, consulter les sections pertinentes de [docs/TESTS.md](docs/TESTS.md). Cette section fixe la proportion des contrôles ; les historiques de lots ne créent pas d’obligation de nouveau rapport.
- En développement, tester le périmètre modifié. Réserver les validations complètes aux changements importants d’architecture, de sécurité, aux migrations majeures, aux régressions transversales et à la qualification finale d’une release.
- Pour cette validation complète, exécuter `npm test` puis `npm run test:e2e` et vérifier le SDK ; ajouter les contrôles Supabase réels si concernés.
- Documentation seule : relire, vérifier chemins/commandes et `git diff --check` ; ne pas lancer les suites applicatives sans problème concret.
- Maintenir une suite ciblée sur calculs, persistance et parcours critiques. Ajouter un test pour un risque ou une régression observable, sans recopier l’implémentation ; extraire uniquement la logique nécessaire et la réutiliser dans le site.
- Utiliser des données synthétiques et des contextes isolés ; contrôler l’horloge des tests temporels simulés, conserver le temps réel pour l’expiration des JWT réels. Aucun E2E sur PROD ni effacement du navigateur personnel.
- Pour toute interface modifiée, vérifier visuellement ordinateur/mobile, clavier, mode sombre et préférences. Déclarer toute vérification impossible ou non exécutée et sa cause.

## Sécurité, Git et limites d’intervention

- Respecter le périmètre demandé ; préserver les données utilisateur, historiques et clés existantes. Une déconnexion ne supprime ni progression ni données en attente de synchronisation.
- Auth : suivre le contrat pertinent de [docs/architecture/AUTHENTIFICATION.md](docs/architecture/AUTHENTIFICATION.md), avec client/service Supabase partagés et profils identifiés par UUID Auth. Préserver les synchronisations existantes et l’isolation par environnement/projet/compte ; aucun import pédagogique silencieux.
- Garder `assets/auth-config.json` désactivé ; préparer les essais avec `auth-config.local.json` ignoré. Seuls les paramètres publics prévus, dont URL et clé publishable, peuvent entrer dans l’artefact public.
- Ne publier aucun secret dans Git, Pages, journaux ou captures : clés administratives/`service_role`, mots de passe, jetons, liens Auth et identifiants SMTP restent privés.
- Préserver RLS, grants et privilèges de colonnes de `profiles`. Le masquage d’une page ou d’un bouton ne protège pas les données ; ne pas utiliser un rôle administratif pour prouver l’isolation étudiante.
- Les mocks JavaScript et HTTP ne prouvent pas RLS. Exécuter les tests automatisés Auth/RLS réels uniquement sur la stack Supabase locale dédiée avec comptes fictifs ; jamais les rediriger vers DEV, PROD ou un compte étudiant. Sans CLI/Docker, déclarer la non-exécution.
- Distinguer stack locale, DEV et PROD. Toute opération hébergée suit le runbook applicable et son autorisation ; une autorisation DEV ne couvre pas PROD.
- Migrations versionnées dans `supabase/migrations/` : vérifier cible et historique, ajouter une nouvelle migration pour une évolution ; ne pas réécrire arbitrairement une migration appliquée ni réinitialiser une base contenant des données à conserver.
- Maintenir l’inscription publique et les connexions anonymes désactivées ; invitations natives depuis un service de confiance uniquement. Toute évolution du mode d’accès exige une décision explicite, la validation Auth/RLS et les préparatifs de confidentialité avant accueil de comptes réels.
- Ne modifier PROD et ne déployer en production qu’avec autorisation explicite. Préparer d’abord le résultat vérifiable ; réutiliser un accord déjà donné pour ce même périmètre.
- Ne pas modifier la protection de `main` ni fusionner une PR sans accord. Aucun commit, push ou déploiement hors du périmètre autorisé ; ne pas écraser le travail d’autrui.
- Les checks `unit-integration` et `e2e` du workflow Qualité ne déploient pas ; `supabase-security` reste distinct. Vérifier leurs résultats sur la tête finale d’une PR avant de revendiquer sa validation, sans modifier les protections.
- Aucune suppression destructrice non autorisée ; aucune suppression de données utilisateur dans une tâche de développement ou de nettoyage.

## Gestion des fichiers temporaires

`.tmp/` reste local, ignoré et exclu de Pages. Garder secrets, sauvegardes et données sensibles hors des artefacts publics.

| Catégorie | Rétention |
| --- | --- |
| Temporaires régénérables créés par la tâche | Nettoyer après usage terminé et reproductibilité établie, uniquement dans le périmètre connu et sans outil actif. |
| Diagnostics encore nécessaires | Conserver le dernier succès utile et les échecs pertinents ; réexaminer à la résolution du problème. |
| Preuves importantes et réservations de campagne | Conserver jusqu’à clôture des contrôles et dépendances ; ne pas réinitialiser un marqueur consommé pour rejouer une opération. |
| Sauvegardes, données sensibles ou origine inconnue | Conserver ; appliquer une décision spécifique et vérifier la restauration avant tout retrait autorisé d’une copie redondante. Aucun effacement fondé sur l’âge seul. |

- Ne pas supprimer les fichiers d’une autre intervention, d’un outil actif ou une preuve indispensable. Ne pas lancer de nettoyage en parallèle des tests.
- À la clôture, appliquer l’hygiène Git ci-dessus. Après livraison confirmée, le nettoyeur n’intervient que sur les builds de la tâche qui passent les contrôles existants. Mentionner brièvement l’espace libéré, le volume restant et les éventuels blocages.
- `npm run maintenance:tmp` simule ; `npm run maintenance:tmp:clean` nettoie selon la même liste blanche. Sans vérification des processus ou en présence de tests actifs, conserver et signaler le refus ; ne pas contourner la garde.
- Au-delà de 500 Mo, identifier les groupes protégés ; le plafond n’autorise aucune suppression supplémentaire. Préserver notamment le prototype M5 et les preuves de déploiement encore nécessaires.
- Pour un nettoyage important hors de cette liste blanche : inventaire, espace récupérable estimé et validation explicite si le périmètre n’est pas déjà autorisé ; contrôler les chemins résolus et exclure liens/jonctions.
- Suivre la [politique existante](docs/developpement/MAINTENANCE-DOSSIER-TMP.md). `npm run maintenance:tmp` simule sans supprimer ; examiner son résultat avant toute application autorisée. Ne pas étendre son périmètre par une purge manuelle.
- Ces consignes déclenchent la procédure à la fin des tâches Codex. Pour une livraison humaine, lancer le même point d’entrée après confirmation.

## Format attendu des comptes rendus

Répondre brièvement : ce qui a changé, contrôles réellement exécutés et résultats, problèmes restants avec impact/P0–P2, prochaines actions indispensables.
Ne créer un rapport Markdown permanent que si demandé ou nécessaire à une preuve durable ; utiliser alors `docs/validations/`, sans secrets ni sorties brutes redondantes.
