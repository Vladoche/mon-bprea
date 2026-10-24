# Validation — synchronisation du Mode Drill (lot 6.2.2)

Après fusion de la PR #13, la [revue corrective de reprise Auth](VALIDATION-LOT6-2-2-REPRISE-AUTH.md) complète ce compte rendu historique : elle documente le cas `offline → authenticated` sans événement `online`, sa reproduction et sa correction ciblée.

Préparation du **24 octobre 2026**, branche `feature/lot6-2-2-sync-drill` créée depuis `origin/main` **`f7fc1b7b6da1d5b5fc6a6bc14c3b946777c25501`**. La fusion de la [PR #12](https://github.com/Vladoche/mon-bprea/pull/12) a été confirmée par GitHub et les références Git actualisées. L'arbre de travail initial était propre. Aucun autre lot n'est commencé.

## Fonctionnalités et fichiers

Le [guide client](../architecture/DRILL-SYNCHRONISATION-CLIENT.md) décrit le cache IndexedDB atomique, l'outbox persistante, la lecture paginée, les confirmations strictes, les conflits archivés, l'identité locale et les limites du hors ligne.

- Nouveaux modules : `auth-local-identity.js`, `drill-personal-store.js`, `drill-sync-model.js`, `drill-sync-service.js`, `drill-sync-transport.js`, `drill-sync-ui.js`.
- Adaptations : `drill-store.js` partage ses mutations et validations ; `drill.js` et `drill.css` intègrent les états et actions ; le client/service/header Auth partagés assurent identité, JWT et invalidation. Le Dashboard reçoit seulement une mention sur la source locale.
- Tests : persistance IndexedDB, modèle, service, transport et continuité Auth ; nouveaux helpers et parcours Playwright dans la stack locale réelle.
- `fake-indexeddb` **6.2.6** est ajouté uniquement aux dépendances de test, sans import dans le site publié. Les transactions sont également exercées par Chromium dans les parcours réels.
- Les noms `unit-integration`, `e2e` et `supabase-security` restent inchangés ; la suite navigateur Supabase existante inclut les nouveaux parcours Drill.

## Vérifications exécutées et limites du poste

| Vérification | Résultat pendant la préparation |
| --- | --- |
| Node.js 24.22.0, `npm ci` depuis le cache | Réussis après mise à jour du verrou |
| `npm test` | **141 tests réussis dans 18 fichiers**, aucun échec après la relecture |
| `npm run test:e2e` | **17 parcours Chromium réussis** avec Supabase désactivé ; serveur HTTP local et contextes isolés |
| Supabase réel sur ce poste | Docker absent ; aucune exécution locale réelle Supabase revendiquée |
| Qualité CI | [`unit-integration`](https://github.com/Vladoche/mon-bprea/actions/runs/40099513124/job/120888573925) et [`e2e`](https://github.com/Vladoche/mon-bprea/actions/runs/40099513124/job/120888574123) réussis sur le commit initial `e6282e707afc54e368711a7fd4d349569e9954d0` ; SDK verrouillé vérifié |
| Sécurité CI | [`supabase-security`](https://github.com/Vladoche/mon-bprea/actions/runs/40099513138/job/120888573844) réussi sur ce même commit : **108 assertions pgTAP**, **11 groupes Auth/profils/RLS**, **22 groupes backend Drill** et **3 parcours Chromium Supabase réels** |
| Inspection visuelle | Desktop 1 280 px clair et mobile 390 px sombre : panneaux de conflit avec données synthétiques inspectés, sans débordement ; parcours visiteur réellement manipulé et correction inspectée |

Les nouveaux tests Vitest couvrent la sauvegarde réponse + opération atomique, le rollback par saturation, les écritures concurrentes, l'isolation comptes/environnements, la fermeture/réouverture, les UUID stables, la perte d'acquittement après insertion, les erreurs permanentes et de session, les dépendances, la pagination plafonnée, les réponses anciennes arrivées tard, les brouillons et les trois types de conflits. Ils ne constituent pas une preuve RLS distante.

Les nouveaux E2E Supabase préparent exclusivement des comptes fictifs dans la stack `mon-bprea-lot6-1-local`. Les deux parcours Drill ont réellement réussi en CI (**9,0 s** et **2,5 s**) : création/réponses/entraînement, rechargement, second contexte du même compte, retry après `route.fetch()` réel suivi d'un abandon de réponse, panne API avec rechargement et cache identifié, reconnexion, B sans données A, visiteur conservé, mobile/clavier, conflits de première réponse et de snapshots. La suite complète a réussi **3 parcours en 17,8 s**, y compris l'activation/récupération du lot 6.1. La stack éphémère a été arrêtée avec succès. Ces résultats ne sont pas une recette sur un projet hébergé.

La relecture après cette première CI a ajouté trois régressions : absence de notifications interonglets sur une transaction sans changement, conservation d'un code de réconciliation `40001` à travers le rollback IndexedDB, et masquage de l'identité hors ligne après rejet explicite de session. Elle a aussi borné chaque requête PostgREST à 15 secondes, conservé le focus de correction lors d'une confirmation distante et remplacé les identifiants techniques des messages de conflit par l'UC, la semaine et les choix lisibles. La PR relance les mêmes trois checks sur le commit final ; leur état courant est disponible sur la [PR #13](https://github.com/Vladoche/mon-bprea/pull/13).

Captures locales ignorées inspectées : `.tmp/lot622-desktop-light.png`, `.tmp/lot622-mobile-dark.png` (composant de conflit synthétique, aucune simulation Auth/RLS), `.tmp/lot622-visitor-desktop.png` (vrai parcours visiteur). Le rendu connecté fonctionnel est prouvé par les E2E Supabase, distinctement de cette inspection de mise en page.

Les contrôles pgTAP, Auth/profils/RLS, expirations et concurrence du lot 6.2.1 restent exécutés par le workflow existant. Aucun runner destructif ne peut viser DEV ou PROD.

## Données et environnements

La clé `bprea-demo-drill-v1` reste réservée aux visiteurs et historiques préexistants ; aucun import ou effacement automatique. Les espaces personnels sont identifiés par environnement, origine Supabase et UUID Auth. Une déconnexion masque le cache personnel et invalide les requêtes, en conservant les opérations en attente. Le cache non chiffré sur appareil partagé est une limite explicite.

Aucune migration SQL ni RPC n'est modifiée ou réappliquée. Aucune écriture dans DEV hébergé ou PROD, aucun projet créé, aucun envoi d'e-mail externe ni changement SMTP. `assets/auth-config.json` reste désactivé, sans URL ni clé. Les tests utilisent uniquement des clés locales dans la stack éphémère ; les mots de passe et jetons ne sont pas journalisés.

Le Dashboard distant reste au lot 6.2.3. Le lot ne promet ni téléchargement de questions jamais chargées hors ligne ni chargement complet du site sans réseau ; les pages et la configuration doivent rester disponibles. Les opérations en erreur permanente ou en conflit d'UUID nécessitent une intervention explicite. Les archives locales de conflits sont conservées.

## Livraison

La [PR #13](https://github.com/Vladoche/mon-bprea/pull/13) est préparée vers `main`, en brouillon pour revue, avec les preuves et l'architecture. Les contrôles du commit final doivent rester verts avant toute décision de fusion distincte. Aucun critère non exécuté n'est déclaré réussi. Aucune fusion automatique, modification du ruleset ni activation Supabase sur GitHub Pages.
