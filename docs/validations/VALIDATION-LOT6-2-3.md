# Validation — Dashboard synchronisé et recette finale du lot 6.2.3

Reprise du **25 octobre 2026**. Ce rapport distingue le travail retrouvé après interruption, les compléments de la reprise et les validations réellement exécutées. Le commit fonctionnel `bb6a156b365827a6a916c3211df4793af43ff231` a réussi les trois contrôles obligatoires, dont la recette Supabase réelle complète.

## État retrouvé avant modification

- Branche active : `feature/lot6-2-3-dashboard-sync`, déjà créée. Elle est conservée.
- Dernier commit : `858194c`, fusion de la [PR #14](https://github.com/Vladoche/mon-bprea/pull/14), identique aux références locales `main` et `origin/main` lors de l’audit. Aucun commit propre au lot n’a été retrouvé dans l’historique ou le reflog consultés.
- Aucun équivalent distant de cette branche ni PR correspondante retrouvé par les recherches GitHub au début de la reprise. Après un échec réseau dans le bac à sable, `git ls-remote` a confirmé l’absence de cette branche distante et le SHA `858194ca492b61292fd511ca0c8cee8bf392d759` de `main`.
- Six fichiers suivis modifiés, non commités : `README.md`, `assets/app.js`, `assets/dashboard-data.js`, `assets/dashboard.css`, `assets/dashboard.js`, `docs/architecture/DRILL-SYNCHRONISATION-CLIENT.md`.
- Un fichier non suivi : `tests/integration/dashboard-data.test.js`, contenant cinq tests de sélection de source. L’absence de commit n’a pas été interprétée comme une absence de travail.
- `assets/dashboard-stats.js` et `assets/drill-sync-service.js` étaient inchangés. Les lots 6.2.1 et 6.2.2 et la correction de reprise Auth étaient présents dans le socle.
- `docs/architecture/DASHBOARD.md` décrivait encore le lot 3 local ; ce rapport 6.2.3 n’existait pas. Des scripts préparatoires ignorés étaient présents dans `.tmp/`, sans capture ou compte rendu d’exécution retrouvé pour le lot 6.2.3.

Aucune réinitialisation, suppression de modification, nouvelle branche concurrente ou duplication de commit n’a été effectuée. Les modifications existantes sont reprises de façon incrémentale.

## Fonctionnalités déjà développées avant l’interruption

Le raccordement retrouvé sélectionnait `readDrillState()` en visiteur et la vue normalisée du service Drill dans l’espace personnel. Il comprenait l’initialisation asynchrone, l’abonnement aux publications du service, l’actualisation par `retry()`, les messages de source et de synchronisation, les réponses locales en attente et les conflits, le masquage du DOM lors d’un changement d’identité et la conservation des interactions dans la même identité.

Le traitement distinguait chargement, cache illisible, identité incertaine et historique personnel incomplet. La reprise n’a pas remplacé ces éléments par une autre implémentation. Les calculs pédagogiques existants demeurent ceux de `createDashboardModel()` : première réponse comptée une fois, entraînements et brouillons exclus, taux pondérés et `null` sans réponse, périodes et semaines ISO Europe/Paris, snapshots historiques et exclusion temporaire des dates futures.

Ces fonctionnalités étaient implémentées mais ne disposaient pas d’une preuve complète de régression ni d’une recette Dashboard personnelle exécutée retrouvée. Les preuves historiques des lots précédents restent distinctes des validations du présent lot.

## Compléments pendant la reprise

La reprise complète les régressions de la projection service Drill → adaptateur Dashboard → moteur statistique, les parcours du vrai renderer et la recette Supabase locale multi-contextes. Le [guide Dashboard](../architecture/DASHBOARD.md) décrit désormais les deux sources, les états d’attente, les limites du cache personnel, le réessai et la continuité des interactions.

L’inspection a révélé une mention de pied de page inadaptée au compte personnel : « Données pédagogiques conservées sur cet appareil ». Pour le Dashboard, elle renvoie désormais à la source des résultats explicitée dans la page. Un scénario de réponse réseau différée a aussi reproduit une perte de focus sur « Actualiser les données » : le passage natif à `disabled` pendant la requête faisait perdre le focus au navigateur. Pendant le réessai, `aria-disabled` et `aria-busy` indiquent désormais l’attente, tandis que la garde existante empêche les doubles requêtes. Le focus est conservé sans le déplacer après coup. Le test a échoué avant correction puis réussi après ; le raccordement préexistant reste conservé.

L’aide commune des pages compte affirmait encore que le compte ne synchronisait aucun exercice. Elle distingue maintenant le visiteur local de l’espace personnel activé, en précisant que les réponses en attente ne sont pas encore confirmées sur les autres appareils.

Fichiers de livraison concernés :

| Groupe | Fichiers |
| --- | --- |
| Raccordement préexistant conservé | `assets/dashboard-data.js`, `assets/dashboard.js`, `assets/dashboard.css`, `assets/app.js` |
| Mention de source des pages compte | `assets/auth-pages.js` |
| Documentation préexistante complétée | `README.md`, `docs/architecture/DRILL-SYNCHRONISATION-CLIENT.md`, `docs/architecture/DASHBOARD.md` |
| Validation et conventions | `docs/validations/VALIDATION-LOT6-2-3.md`, `docs/TESTS.md` |
| Régressions | `tests/integration/dashboard-data.test.js`, `tests/e2e/dashboard-sync.spec.js`, `tests/e2e-supabase/dashboard-sync.spec.js` |
| Navigation de recette réelle | `tests/helpers/drill-local.js` attend la fin de la redirection profil avant d’ouvrir le Drill. |

Ces quatorze fichiers constituent le diff de livraison. Aucune migration, RPC ou politique RLS n’est modifiée.

## Tests réellement exécutés

| Vérification | Résultat constaté |
| --- | --- |
| Node.js | **24.22.0**, conforme à Node.js 24 LTS |
| `npm ci` | **Réussi** : installation reproduite depuis le verrou, 50 paquets ajoutés, audit sans vulnérabilité signalée |
| `npx playwright install chromium` | **Réussi** |
| `npm test` au début de la reprise | **154 tests réussis dans 20 fichiers**, aucun échec ; comprend les cinq tests non commités retrouvés |
| Tests ciblés après compléments | **23 tests réussis dans 3 fichiers** : Dashboard data, reprise Auth et statistiques ; **4 E2E renderer réussis** |
| `npm test` après compléments | **159 tests réussis dans 20 fichiers**, aucun échec |
| `npm run test:e2e` après compléments | **21 parcours Chromium réussis**, aucun échec, en 10,0 s lors de la dernière exécution locale |
| `npm run build:auth-sdk` puis comparaison Git | **Réussi**, aucun changement du SDK versionné |
| `git diff --check` | **Réussi** |
| `npm run test:e2e:supabase` sur ce poste | **Arrêt avant collecte**, garde `SUPABASE_TEST_CONFIRM_LOCAL` absente ; Docker et fichier `.env.supabase-test.local` absents. Aucun test Supabase local exécuté et aucune stack hébergée utilisée en remplacement |

Les tests unitaires et d’intégration utilisent une horloge contrôlée et des données isolées. Les tests du renderer avec service synthétique vérifient le client et le DOM ; ils ne valident ni Auth ni PostgreSQL/RLS. Aucun test existant n’a été retiré ou affaibli.

## Recette multi-appareils et contrôles CI

Les scénarios réels ont été exécutés dans la stack éphémère `mon-bprea-lot6-1-local` du runner CI, avec comptes fictifs et capture SMTP locale. Deux contextes Chromium isolés représentent les appareils d’un même compte. Les réponses Auth, PostgREST et RPC proviennent du vrai Supabase local ; les interruptions de transport servent seulement à reproduire une panne.

La recette a vérifié la cohérence des totaux et taux entre les deux contextes, cinq entraînements sans nouveau comptage, une réponse ajoutée ailleurs puis visible après actualisation, le cache durant une panne API et après rechargement, la reprise réseau, l’isolation A/B/A, la déconnexion et un conflit conservé sans double comptage. Le visiteur est resté à **1 réponse incorrecte / 0 %**, sans import ; A est passé de **1/1/0/100 %** à **2/1/1/50 %**, puis **3/2/1/67 %** sur les deux appareils. PostgreSQL contient exactement **3 premières réponses et 5 entraînements**. B reste vide et ne peut lire les lignes A. Le conflit retient une seule réponse incorrecte, conserve le choix local en archive et garde le même total après résolution explicite.

| Check obligatoire | Preuve sur le commit fonctionnel `bb6a156` |
| --- | --- |
| `unit-integration` | **Réussi** — [job](https://github.com/Vladoche/mon-bprea/actions/runs/40184414034/job/121142050296), 159 tests et SDK verrouillé sans diff |
| `e2e` | **Réussi** — [job](https://github.com/Vladoche/mon-bprea/actions/runs/40184414034/job/121142050442), 21 parcours Chromium autonomes |
| `supabase-security` | **Réussi** — [job](https://github.com/Vladoche/mon-bprea/actions/runs/40184414014/job/121142050297), 108 assertions pgTAP, 11 groupes Auth/profils/RLS, 22 groupes backend Drill et 6 parcours navigateur réels |

Les **6 parcours réels ont réussi en 28,1 s** : Auth/profil/récupération (4,5 s), Dashboard multi-appareils et comptes isolés (7,1 s), Dashboard en conflit (2,4 s), reprise Auth sans `online` de la PR #14 (1,5 s), Drill multi-appareils (7,8 s) et conflits Drill (2,2 s). L’arrêt exclusif de la stack éphémère a réussi. Cette mise à jour documentaire relance les mêmes contrôles ; les [checks du dernier commit de la PR](https://github.com/Vladoche/mon-bprea/pull/15/checks) permettent de vérifier sa réexécution.

La première [recette réelle sur `facd689`](https://github.com/Vladoche/mon-bprea/actions/runs/40181831871/job/121134393297) avait échoué sur une erreur de sélecteur dans les deux nouveaux tests : `exact: true` cherchait « Commencer cette série » alors que le bouton accessible s’intitule « Commencer cette série → ». Les tests restaient en attente et atteignaient chacun 90 secondes ; aucune validation de leurs étapes suivantes n’est revendiquée sur ce run. Les libellés ont été corrigés et les attentes d’action bornées à 10 secondes, sans retrait de scénario ni modification de l’application.

Une deuxième [exécution réelle](https://github.com/Vladoche/mon-bprea/actions/runs/40182563041/job/121136515087), sur `8f83e34`, a atteint l’actualisation du deuxième appareil et la résolution du conflit, puis échoué dans ces étapes ; les quatre parcours antérieurs et les contrôles de sécurité restaient réussis. La recette partage désormais un même instant contrôlé entre les deux contextes (les dates HTTP arrondies indépendantes pouvaient placer une réponse dans le futur du lecteur) et attend le statut de conflit stable avant d’ouvrir le panneau remplacé par la synchronisation initiale. Ces ajustements ne changent ni l’exclusion métier des dates futures ni le service de synchronisation. Un diagnostic limité aux statuts UI et aux totaux fictifs précise toute nouvelle panne, sans DOM, requête Auth ou jeton.

Sur `f47f5eb`, la [recette réelle suivante](https://github.com/Vladoche/mon-bprea/actions/runs/40183265147/job/121138688260) avait réussi **5 parcours sur 6**, dont le conflit Dashboard. Le scénario multi-appareils avait confirmé les trois réponses, les cinq entraînements séparés, les totaux 3/2/1/67 %, le cache hors ligne et la reprise sur les deux contextes, avant un échec pendant les changements A/B/A. Le helper de connexion attendait le lien du header, publié avant la redirection asynchrone vers le profil ; il attend désormais la fin de cette navigation avant d’ouvrir le Drill. L’horloge commune est avancée au retour réseau pour rendre les `retryAt` éligibles sans altérer les dates des réponses. L’isolation complète a ensuite réussi sur `bb6a156`.

Le [run sur `0057eaf`](https://github.com/Vladoche/mon-bprea/actions/runs/40183865988/job/121140409881) a également réussi 5/6 parcours ; le diagnostic a situé l’attente sur le profil lors de la connexion de B. Le saut synthétique de 60 secondes entrait dans la marge de refresh de 90 secondes du SDK avec les JWT locaux de 120 secondes. La recette avance désormais l’horloge jusqu’au seul `retryAt` réellement persisté, au lieu d’imposer ce décalage. Les expirations du vrai serveur et les règles Auth applicatives restent inchangées.

Le workflow de sécurité existant inclut les tests Dashboard placés dans `tests/e2e-supabase/`, ainsi que les contrôles pgTAP, Auth/profils/RLS et backend Drill des lots précédents. Les résultats historiques de [6.2.1](VALIDATION-LOT6-2-1.md), [6.2.2](VALIDATION-LOT6-2-2.md) et de la [correction PR #14](VALIDATION-LOT6-2-2-REPRISE-AUTH.md) ne valident pas le dernier commit de ce lot.

## Inspection visuelle

Le script préparatoire retrouvé `.tmp/visual-dashboard623.mjs` a été exécuté, puis les captures ont été inspectées réellement. Dix états à **1 280 px ou 390 px**, en clair ou sombre : visiteur vide, personnel synchronisé desktop/mobile, attente desktop/mobile, hors ligne desktop, conflit desktop/mobile, session masquée mobile et cache personnel vide hors ligne. Bilan dans `.tmp/lot623-visual-results.json` : **aucun débordement de page ni erreur JavaScript**.

Captures inspectées : `.tmp/lot623-empty-light.png`, `lot623-history-light.png`, `lot623-history-dark-mobile.png`, `lot623-pending-light.png`, `lot623-pending-dark-mobile.png`, `lot623-offline-dark.png`, `lot623-conflict-light.png`, `lot623-conflict-dark-mobile.png`, `lot623-session-dark-mobile.png`, `lot623-empty-offline-light.png`, ainsi que les détails `lot623-weekly-table.png`, `lot623-charts-desktop.png` et `lot623-charts-mobile.png` dans le même dossier. Les filtres s’empilent sur mobile, les boutons restent contenus et les graphiques/tableaux défilent dans leur cadre. Les totaux synthétiques 9/6/3/67 % concordent avec les trois semaines actives ; l’état session ne montre aucune métrique, le cache hors ligne vide ne prétend pas un compte sans activité. Le focus et les tableaux ouverts sont aussi vérifiés par E2E. Les captures ont été régénérées après la correction du pied de page.

Les captures préparées avec un service synthétique servent à inspecter la mise en page, le contraste, les messages, les graphiques, les tableaux et le focus. Elles ne doivent pas être présentées comme preuve d’une synchronisation Supabase réelle. Les artefacts locaux de diagnostic restent ignorés par Git et ne contiennent pas de session réelle.

La mention des pages compte a aussi été inspectée réellement dans `.tmp/lot623-auth-light.png` (1 280 px) et `.tmp/lot623-auth-dark-mobile.png` (390 px), après exécution de `.tmp/visual-auth623.mjs`, avec Auth désactivée. Le texte reste lisible dans l’encadré sans débordement.

## Confidentialité et environnements

La clé visiteur `bprea-demo-drill-v1` est conservée, sans import automatique ni purge. Le Dashboard personnel consomme exclusivement la vue de l’identité courante. Une session incertaine ou rejetée masque les données privées ; un cache fiable du bon compte peut rester visible lors d’une panne réseau. Les réponses en attente, brouillons et archives de conflits sont préservés. La déconnexion ne supprime pas la progression.

Le cache personnel reste non chiffré et accessible à une personne contrôlant le profil du navigateur ; le masquage UI ne remplace pas RLS. Les espaces restent liés à l’environnement, au projet et à l’UUID Auth. Aucun JWT, mot de passe, identifiant SMTP ou clé administrative n’est ajouté aux fichiers publics.

Le défaut `assets/auth-config.json` reste **désactivé**, avec URL, clé et site vides. Aucun projet Supabase n’est créé. Aucun accès en écriture au DEV hébergé `wcckbyhrtroittbfophv`, aucun changement sur PROD `oqoqrxwfbkhtpksqimgd`, aucune migration, RPC, politique RLS ou configuration SMTP modifiée. Aucun e-mail externe ni invitation d’étudiant réel. La reprise n’établit pas un nouvel état opérationnel de DEV par des essais hébergés ; elle conserve les résultats historiques du projet et ses limites documentées.

## Bilan synthétique du lot 6.2

| Sous-lot | Résultat et preuve |
| --- | --- |
| 6.2.1 — backend Drill | Tables, snapshots et opérations idempotentes avec protections PostgreSQL/RLS ; [validation dédiée](VALIDATION-LOT6-2-1.md), contrôles réels repris par `supabase-security`. |
| 6.2.2 — client Drill | Cache personnel IndexedDB atomique, outbox, réconciliation, conflits conservés, isolation de l’identité et reprise réseau ; [validation dédiée](VALIDATION-LOT6-2-2.md). |
| Correction PR #14 | Reprise du même compte `offline → authenticated` sans événement `online`, avec invalidation des retours tardifs ; [preuves de reproduction et de correction](VALIDATION-LOT6-2-2-REPRISE-AUTH.md). |
| 6.2.3 — Dashboard | Raccordement préexistant conservé, régressions et mentions complétées, défaut de focus corrigé ; 159 tests, 21 E2E autonomes et 6 E2E Supabase réels réussis, trois contrôles CI verts sur `bb6a156`. PR #15 ouverte pour revue. |

Le lot ne crée aucune métrique, gamification ou classement. Il ne promet pas le chargement intégral du site hors connexion ni la disponibilité distante d’une réponse encore en attente. L’inscription publique et les connexions anonymes restent désactivées ; l’ouverture aux étudiants attend les lots 6.4 et 6.5.

## Livraison

Branche conservée : `feature/lot6-2-3-dashboard-sync`. [PR unique #15](https://github.com/Vladoche/mon-bprea/pull/15) vers `main`, ouverte, sans fusion automatique, sans modification des protections et sans déploiement public. Toute fusion et tout déploiement de production restent soumis à l’accord de l’utilisateur.
