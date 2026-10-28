# Validation du lot 6.4.3 — suppression et conservation

Audit commencé le 27 octobre 2026 ; livraison préparée le **28 octobre 2026**, Europe/Paris. Les résultats techniques n'approuvent aucune décision juridique, n'activent pas Auth publiquement et n'autorisent aucun déploiement hébergé.

## Préparation et Git

État initial propre, branche `feature/lot6-4-2-export-donnees-personnelles` à `8e7fe4a`, un seul worktree. `git fetch origin main` a ramené **`7b0bc77fbc3c8c3b341386a5cd681763ecdbc29e`**, fusion #22 confirmée aussi par le connecteur GitHub (`merged:true`). Création de **`feature/lot6-4-3-suppression-conservation`** depuis ce SHA. Aucune modification préexistante à préserver ni édition directe de `main`.

Lecture des six documents RGPD, architecture/validation 6.4.2, contrats des synchronisations 6.2/6.3, migrations, services et workflow #20. Relecture par API publique de `rules/branches/main` : ruleset **25489814**, PR requise, refus de suppression/force-push et checks **unit-integration/e2e/supabase-security**. Aucune protection modifiée.

Sources officielles actuelles : RGPD art. 12/17/19 sur CNIL après blocage antirobot EUR-Lex ; CNIL effacement/conservation ; Supabase suppression, connexion native, sessions/JWT, sécurité/secrets Edge Functions, CLI, backups et changelog. Liens/limites dans [l'architecture](../architecture/SUPPRESSION-DONNEES-PERSONNELLES.md). Le skill Supabase a été appliqué ; aucune commande de déploiement, migration ou SQL sur un projet hébergé.

## Réalisation

| Ensemble | Changement et justification |
| --- | --- |
| Cache local | `erasure-store/service`, primitives partagées et IndexedDB v2 : ajout du store `privacy`, conservation des noms de bases/keys et documents pédagogiques v1. Retrait de la seule portée, instantané confirmé, barrière dans la même transaction, ancienne version v1 refusée après upgrade. Une base initialement absente reçoit seulement la barrière nécessaire pour ne pas se recréer au chargement suivant. |
| Domaines | Drill, cours/QCM, botanique, ITK et apparence sélectionnables ; ITK/apparence partagent un record, retrait partiel seulement si archives/champs attribuables. B, autres environnements/projets et visiteur conservés. Les compteurs d'archives sans attribution empêchent le retrait partiel. |
| Visiteur | Neuf clés explicites, provenance indépendante, consentement sur appareil partagé, comparaison avant retrait et contrôle après `removeItem`. Pas de clear global ni de sélection SDK par motif. |
| Concurrence | Verrou Web Locks et messages `suspend/settled` sans donnée sensible ; générations/AbortController et vues des quatre services invalidés ; export préparé/en cours et aperçu visiteur retirés. Époques persistées, reprise explicite, ancien repository refusé même après reprise. |
| Auth | `user_not_found` reconnu comme identité invalide. Déconnexion ordinaire conserve tous les historiques/outboxes comme avant. |
| Clôture | Edge Function versionnée, `verify_jwt=true`, vérification Auth explicite, nouvelle connexion native serveur avec mot de passe, preuve AES-GCM brève liée au JWT exact et origine, schéma fermé sans UUID cible. Hard-delete Auth et contrôle des dix tables. Aucun nouveau privilège étudiant ou SQL definer, aucune migration. |
| Reprise | Même capacité/JWT, inspection de la cible liée ; confirmation après compte absent et dix comptes zéro, sans nouvelle suppression. Panne/expiration/preuve perdue : résultat non confirmé ou procédure manuelle à valider. SDK signOut ne sert jamais de preuve d'effacement. |
| Interface | Profil : effacement local et clôture séparés, dialogue, avertissement non synchronisé, export facultatif, état partiel/échec. Clôture publiquement indisponible ; formulaire seulement sur l'origine et la stack locales explicitement activées par la recette. Nettoyage local après clôture annoncé **non effectué**, pas implicitement réalisé. |
| Conservation | [Projet](../rgpd/POLITIQUE-CONSERVATION-PROJET.md), [JSON](../rgpd/CONSERVATION-PROJET.json) non validés, durées nulles et aucune purge autorisée. Planificateur de revue pur sans exécuteur/scheduler, tests à horloge fictive. |
| CI | Optimisations et noms de jobs #20 conservés. Edge Runtime uniquement local et étape `functions serve` sans deploy, clé de run ignorée et logs non publiés ; mêmes branches d'orchestration et attente réelle Auth réutilisée pour le refus de JWT expiré. |

## Exécutions locales

Node **24.22.0**, npm **10.4.0**, `npm ci` réussi, dépendances/verrou inchangés. CLI **2.121.0** réellement exécutée avec `--version` et `functions serve --help` ; version plus récente annoncée par la CLI, verrou CI conservé. Docker demeure absent. Les premières tentatives CLI/Chromium en sandbox ont échoué en DNS ; leurs vérifications/installations ont ensuite réussi dans le contexte autorisé. Serveur/Chromium locaux lancés dans ce contexte avec le Python intégré, sans profil navigateur réel.

| Contrôle | Résultat observé / portée |
| --- | --- |
| `npm test` | **376 tests, 42 fichiers réussis** ; 352 tests antérieurs conservés. Mocks/fake-indexeddb ne sont pas une preuve RLS. |
| Nouveaux contrats | 24 tests : autorisation, A/B/environnements/projets, sélection, annulation, compteur non confirmé, record futur/inaccessible, upgrade bloqué et aucun effacement tardif, rollback après DELETE si barrière échoue, ancienne v1, epoch/reprise, réponse réseau tardive, export invalidé ; identité/proof/TTL/schéma fermé, doubles demandes et pannes serveur ; règles de conservation refusées sans validation et horloge contrôlée. |
| `npm run test:e2e` | **67 parcours réussis en 1,1 minute**, dont huit nouveaux ; 59 précédents conservés. Aucun test E2E exécuté sur Pages/DEV/PROD. |
| SDK | `npm run build:auth-sdk` puis `git diff --exit-code -- assets/vendor/supabase.js` réussis, bundle verrouillé identique. |
| SQL/Auth réels sur le poste | **Non exécutés : Docker absent**. Ne pas déduire une réussite SQL des tests simulés. La preuve attendue vient exclusivement de la stack éphémère CI sur la tête finale de PR. |

Les incidents intermédiaires sont conservés comme échecs, sans baisse d'assertion métier : ouverture forcée v1 des anciens helpers après évolution v2 (corrigée en lecture de la version existante), assertions sur fieldset au lieu d'un contrôle réellement désactivé, label visiteur comprenant son état, parcours à deux onglets n'ayant pas démarré le service visé. Une erreur réseau brute « Failed to fetch » a été remplacée par un état non confirmé compréhensible. La première suite complète a fait **65/66** : refus Auth affiché à tort comme erreur de stockage ; la frontière d'identité normalise désormais ce cas et conserve le record. La présence d'un cache initialement absent sans barrière a aussi été corrigée et couverte par un test de recréation.

Première CI sur `e92e8b8` : [Qualité](https://github.com/Vladoche/mon-bprea/actions/runs/40642570706) réussie ; [sécurité](https://github.com/Vladoche/mon-bprea/actions/runs/40642570743) en échec malgré **386 assertions pgTAP réussies**, service local disponible, suites Auth/backends réussies et **24/26 parcours réels**. La nouvelle recette atteint la confirmation serveur, les dix absences, les neuf RPC refusées et le retour de l'appareil, mais attendait à tort une erreur dans la vue visiteur. L'assertion contrôle désormais le mode visiteur, le cours décoché (aucun résultat privé réaffiché), l'outbox encore présente et les dix tables/B après retour réseau. L'autre échec est une perte de focus du bouton Drill lors du retour asynchrone d'une sauvegarde de choix ; une recette locale avec verrou retardé reproduit d'abord cet échec, puis passe après conservation du focus du bouton lors du rendu. Aucune assertion clavier historique retirée. Les résultats partiels nomment aussi explicitement « Cache personnel » et « Visiteur ». Ces corrections imposent de nouveaux checks sur la tête finale ; ce premier run reste déclaré en échec.

## Inspection visuelle et accessibilité

Captures **synthétiques uniquement** sous `.tmp/erasure-visual/`, ignorées : confirmation, état final, erreur, visiteur et état partiel, à **1280/390 px et clair/sombre**. Dialogue natif, Annuler focalisé à l'ouverture, Escape sans écriture, retour au bouton d'aperçu, statut focalisé après transaction, messages `status/alert`. Contrôles réels des records IndexedDB/localStorage, pas seulement texte de réussite. Débordement horizontal absent dans chaque variante automatisée ; inspection locale des captures pour textes, contraste, boutons et mise en page.

Les traces, vidéos et captures automatiques d'échec des nouvelles recettes sont désactivées. Aucun JWT, clé, mot de passe, capacité, vraie adresse ou contenu d'export dans les captures livrées. Les screenshots ne prouvent ni la sécurité PostgreSQL ni une conformité générale d'accessibilité.

## Recette SQL/Auth réelle et CI de livraison

Les trois anciens fichiers pgTAP et leurs **350 assertions** sont conservés. Le nouveau [closure.test.sql](../../supabase/tests/database/closure.test.sql) vérifie FK/cascades composites, absence de DELETE étudiant et de guard DELETE, puis injecte une erreur de cascade, vérifie rollback Auth/profil et reprise préservant B. Aucune fonction temporaire de test n'est conservée après rollback.

La [recette Chromium Supabase](../../tests/e2e-supabase/closure.spec.js) utilise uniquement deux comptes fictifs et endpoints gardés par `auth-local.js`, peuple toutes les tables par droits étudiants et vérifie :

- présence initiale des dix domaines et intégrité exacte de B ; anonyme, GET, JWT falsifié et UUID B dans le corps refusés ;
- seconde copie hors ligne avec intention persistée ; réauthentification native et confirmation par le profil ;
- double requête réelle concurrente, perte du premier acquittement après `route.fetch()` réel et reprise de la même capacité ;
- compte absent d'Auth, dix tables vides sous l'ancien JWT encore dans sa fenêtre, connexion refusée et neuf RPC/INSERT profil incapables de ressusciter A ;
- retour réseau de l'autre appareil, identité masquée, outbox conservée dans sa portée et aucune ligne A recréée ; B inchangé ;
- nettoyage ciblé des seuls comptes fictifs du run ; un compte déjà supprimé par la recette est traité idempotemment par le helper, sans nettoyage global.

Le refus d'un JWT **réellement expiré** par la fonction est ajouté au runner Auth existant, après son attente d'expiration native/PostgREST ; pas de nouvelle attente arbitraire ou d'horloge simulée pour cette preuve. Les suites historiques Auth, Drill, Dashboard, cours/QCM, botanique, ITK/apparence et export demeurent exécutées.

**À la création de la PR, aucun de ces résultats réels n'est déclaré acquis.** Les liens, conclusions et SHA exact des trois checks finaux seront reportés dans la description de PR après observation, comme au lot 6.4.2 ; un ancien commit vert ne suffit pas. Si CI échoue ou ne peut pas exécuter la stack, les critères SQL/anti-résurrection réels restent bloqués. Les échecs intermédiaires et corrections éventuelles doivent être relatés avant livraison.

## Acceptation et limites

Les critères 1–10, 16–20, 22–24 et 30 disposent d'une préparation technique et de tests locaux dans le périmètre décrit, **sans valider leurs dépendances juridiques**. Les critères 11–15, 25 et 26 exigent les résultats réels de stack éphémère et les trois jobs finaux ; la simple présence du code ne les satisfait pas. Les critères 21 et 27–29 correspondent aux actions effectivement limitées à GitHub/tests locaux : aucune opération hébergée.

Activation bloquée : D01/D04/D07/D08/D13/D14 et autres décisions restent non validées, aucun délai de conservation retenu, aucun service DEV/PROD déployé ou essai DEV autorisé. Les ressources Storage ne sont pas utilisées ; logs, backups/PITR, appareils absents et fichiers téléchargés ne sont pas prétendus effacés. Le rétablissement d'une sauvegarde exige une procédure opérationnelle supplémentaire pour ne pas réactiver d'anciennes suppressions. Une barrière technique personnelle locale subsiste et sa durée/retrait doivent être décidés. localStorage ne bloque pas des anciens scripts non coopérants ; cette limite est affichée et aucune absence permanente de nouvelle sauvegarde visiteur n'est promise.

**Aucun environnement hébergé modifié** : ni DEV `wcckbyhrtroittbfophv`, ni PROD `oqoqrxwfbkhtpksqimgd`, aucune migration/RPC/grant appliquée, aucun vrai compte supprimé, aucun e-mail externe, aucun réglage SMTP ou ruleset modifié. `assets/auth-config.json` reste exactement désactivé ; aucun secret publié, aucune purge automatique, fusion, auto-merge ou publication. Le lot 6.4.4 n'est pas commencé.
