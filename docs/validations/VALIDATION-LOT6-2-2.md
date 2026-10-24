# Validation — synchronisation du Mode Drill (lot 6.2.2)

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
| `npm test` | **138 tests réussis dans 18 fichiers**, aucun échec |
| `npm run test:e2e` | **17 parcours Chromium réussis** avec Supabase désactivé ; serveur HTTP local et contextes isolés |
| Supabase réel sur ce poste | Docker absent ; aucune exécution locale réelle Supabase revendiquée |
| CI du lot 6.2.2 | En attente de la PR et de l'exécution effective des trois checks |
| Inspection visuelle | À terminer sur ordinateur et mobile, thèmes clair/sombre et états de synchronisation |

Les nouveaux tests Vitest couvrent la sauvegarde réponse + opération atomique, le rollback par saturation, les écritures concurrentes, l'isolation comptes/environnements, la fermeture/réouverture, les UUID stables, la perte d'acquittement après insertion, les erreurs permanentes et de session, les dépendances, la pagination plafonnée, les réponses anciennes arrivées tard, les brouillons et les trois types de conflits. Ils ne constituent pas une preuve RLS distante.

Les nouveaux E2E Supabase préparent exclusivement des comptes fictifs dans la stack `mon-bprea-lot6-1-local`. Les parcours prévus exercent création/réponses/entraînement, rechargement, second contexte du même compte, retry après `route.fetch()` réel suivi d'un abandon de réponse, panne API avec rechargement et cache identifié, reconnexion, B sans données A, visiteur conservé, mobile/clavier, conflits de première réponse et de snapshots. Leurs résultats restent **non validés** tant que la CI n'a pas été relue.

Les contrôles pgTAP, Auth/profils/RLS, expirations et concurrence du lot 6.2.1 restent exécutés par le workflow existant. Aucun runner destructif ne peut viser DEV ou PROD.

## Données et environnements

La clé `bprea-demo-drill-v1` reste réservée aux visiteurs et historiques préexistants ; aucun import ou effacement automatique. Les espaces personnels sont identifiés par environnement, origine Supabase et UUID Auth. Une déconnexion masque le cache personnel et invalide les requêtes, en conservant les opérations en attente. Le cache non chiffré sur appareil partagé est une limite explicite.

Aucune migration SQL ni RPC n'est modifiée ou réappliquée. Aucune écriture dans DEV hébergé ou PROD, aucun projet créé, aucun envoi d'e-mail externe ni changement SMTP. `assets/auth-config.json` reste désactivé, sans URL ni clé. Les tests utilisent uniquement des clés locales dans la stack éphémère ; les mots de passe et jetons ne sont pas journalisés.

Le Dashboard distant reste au lot 6.2.3. Le lot ne promet ni téléchargement de questions jamais chargées hors ligne ni chargement complet du site sans réseau ; les pages et la configuration doivent rester disponibles. Les opérations en erreur permanente ou en conflit d'UUID nécessitent une intervention explicite. Les archives locales de conflits sont conservées.

## Livraison

Préparer la PR vers `main`, relire les résultats des trois checks, consigner les preuves et terminer l'inspection visuelle. Aucun critère non exécuté n'est déclaré réussi. Aucune fusion automatique, modification du ruleset ni activation Supabase sur GitHub Pages.
