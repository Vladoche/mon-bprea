# Validation du lot 6.5.4.A — restauration JSON personnelle

**29 octobre 2026, Europe/Paris. Restauration volontaire limitée, sans intervention hébergée.** Le résultat local/serveur est distingué ; aucune promesse de restauration intégrale d'Auth ou des dix tables. [Architecture, matrice préalable et besoins backend non implémentés](../architecture/RESTAURATION-DONNEES-PERSONNELLES.md).

## Base et périmètre

| Contrôle | Résultat observé |
| --- | --- |
| Worktree initial | Propre ; modifications existantes préservées, aucune donnée utilisateur supprimée |
| Git fetch origin | Réussi ; dernier origin/main au départ `2478032a38fb1f54c6e651409ba9ae32cec3597d` |
| PR #29 | Métadonnées GitHub : merged=true, même commit de fusion ; #28 déjà dans son historique |
| Branche | `feature/lot6-5-4a-restauration-json-personnelle`, créée depuis origin/main ; pas de travail sur main |
| Code réutilisé | Auth/client partagés, transport d'export, modèles/transactions/transports/acquittements des quatre domaines |
| SQL et hébergement | Trois migrations, RPC, RLS et grants inchangés ; **aucun appel de recette ni écriture DEV/PROD**, aucun compte/lien hébergé ou déploiement |
| Dépendances | Node 24.22.0, npm ci ; aucune nouvelle dépendance/verrou ou framework |

## Faisabilité et garanties revendiquées

| Domaine | Support livré | Blocages explicites |
| --- | --- | --- |
| Profil/Auth | Identité fraîche, même UUID/projet/environnement ; profil en consultation | Aucune création/réactivation Auth, restauration de mot de passe, session, secret, profil ou configuration |
| Drill | Cache depuis séries actuelles identiques ; réponses/entraînements manquants à UUID stables et parents vérifiés ; brouillons absents compatibles | Série exportée absente, UUID technique incompatible, snapshot divergent, parent manquant ou draft existant/consommé |
| Cours | Cache identique, création absente base zéro/révision 1 ; faux explicite conservé | État actuel différent ou révision historique avancée ; aucun OR des done ni base remise à zéro |
| QCM | Tentatives distinctes par UUID, mêmes score/date possibles ; insertion ciblée ou cache | Identité divergente, date/score invalide, aucune tentative inventée depuis un meilleur score |
| Botanique | Cache sessions/réponses, première création ouverte base zéro, réponse manquante à opération originale indépendante/parent confirmé | Session terminée absente, anciennes révisions, dépendances perdues, orphelins, réponse immuable divergente |
| ITK/apparence | Cache, première création base zéro/UUID original ; huit paramètres et auto conservés | Choix actuel différent ; pas d'historique documentaire ou révision antérieure gagnante |
| Compléments/privacy | Rapprochement des copies, quelques intentions ciblées et brouillons | Pas de réactivation de manifestes/conflits/archives incomplets ; toute trace privacy bloque la portée même rouverte |

Analyse/sélection/annulation sans mutation pédagogique ; confirmation obligatoire, Auth et état revérifiés. A→B→A invalide la génération. L'écriture locale utilise le CAS du record et la transaction `accounts+privacy`. Les éléments locaux actuels, champs inconnus, opérations et archives restent protégés, y compris contre une future reconstruction après acquittement. Les résultats distinguent déjà présentes, récupérées localement, confirmées serveur, en attente, conflits, ignorées et non restaurables.

## Vérifications locales exécutées

| Vérification | Résultat / portée |
| --- | --- |
| npm ci | Réussi, 0 vulnérabilité signalée par cette installation ; aucun changement de dépendance |
| npx playwright install chromium | Réussi après exécution autorisée hors sandbox réseau |
| Tests ciblés restore-model / restore-service | 47 réussis ; véritables exports synthétiques v1, JSON hostile/dupliqué, propriété/portée, relations et identités, aperçu readonly, CAS, IDB, quota, panne, confidentialité, payloads exacts et générations |
| npm test | **464 tests / 45 fichiers** ; résultat final contrôlé avant commit, dont la date de génération nulle refusée |
| npm run test:e2e -- --workers=2 | **84/84 réussis**, seconde passe complète en 1,6 min après revue du parseur/payloads ; SDK et stockage réels Chromium, HTTP simulé |
| npm run build:auth-sdk | SDK 2.118.0 reconstruit ; `git diff --exit-code -- assets/vendor/supabase.js` réussi |
| Vérification visuelle | Région restauration inspectée en 1280/390, clair/sombre ; tableau mobile défilant, confirmation et navigation clavier. Captures seulement synthétiques sous `.tmp/restore-visual/` |
| Docker / Supabase réel sur le poste | Docker absent (`docker` introuvable) ; runner dédié refusé avant accès réseau faute de configuration locale autorisée. **NON EXÉCUTÉ localement**, aucune redirection vers DEV/PROD |
| Liens, secrets, Pages et diff | Neuf Markdown et **181 liens locaux** contrôlés ; aucun signal de secret dans les changements. Artefact : **133 fichiers publics + .nojekyll**, 326 références versionnées ; Auth off, aucun test/document interne/export utilisateur. `git diff --check` réussi ; migrations, workflows, configuration publique et verrou sans diff |

Les premiers E2E ont correctement refusé une fixture appartenant à un UUID différent du compte HTTP simulé. La fixture a été corrigée, sans affaiblir le contrôle de propriété. L'essai initial dans la sandbox n'autorisait pas l'exécution locale du navigateur/serveur ; la suite a ensuite été réellement exécutée dans les profils temporaires autorisés. Aucun test impossible n'est déclaré réussi.

## Preuves réelles prévues dans la CI éphémère

[restore.spec.js](../../tests/e2e-supabase/restore.spec.js) est découvert par `scripts/test-supabase-ci.mjs` dans le job existant **supabase-security** ; aucun nouveau job, filtre de chemins ou retrait de scénario antérieur.

- Scénario 1 : comptes fictifs A/B, dix tables par JWT, export réel avec intentions non envoyées, concurrence après copie, nouvel appareil privé sans effacement, cache/SQL relus sous JWT, données manquantes insérées aux UUID originaux, répétition/reload sans doublon, B inchangé, refus sous B/visiteur et invalidation pendant lecture réelle.
- Scénario 2 : export réel de premières intentions cours/QCM/session ouverte/ITK/apparence dans une base initialement vide pour ces clés ; création via les RPC normales avec UUID/base zéro conservés, relecture SQL et répétition sans doublon.

Aucun historique n'est supprimé pour simuler une perte. Les clés administratives restent uniquement dans les helpers de création/nettoyage des seuls comptes fictifs du run ; aucune dans le navigateur. Traces/vidéos/captures réelles désactivées, erreurs réduites au stade, exports seulement synthétiques en mémoire/téléchargement temporaire ignoré. La sécurité RLS n'est jamais déduite des mocks.

**Contrôles requis de la dernière tête :** `unit-integration`, `e2e`, `supabase-security`. La présence des suites n'est pas une preuve d'exécution. Leurs résultats, liens de runs/jobs et tête effectivement vérifiée sont contrôlés séparément et consignés dans la description de PR après exécution, sans réutiliser le vert d'une ancienne tête. Cette description porte la preuve CI finale, sans nouveau commit documentaire qui la rendrait périmée.

## Limites conservées

Pas de transaction globale IDB/PostgreSQL, instantané global, signature du JSON ou restauration des dates techniques SQL. Un acquittement perdu reste en attente jusqu'à réconciliation ; une opération déjà partie peut être acceptée malgré annulation. Les outboxes actuelles restent propriétaires de leurs retries exacts ; aucun nouveau plan durable. Les caches sont non chiffrés et le v1 ne certifie pas l'origine d'un appareil ni les effacements administratifs hors contrats. Une perte totale avec autre UUID/projet et une restauration SQL globale demandent une autre procédure.

Auth publique reste désactivée ; ni fusion, protection main, ouverture aux camarades, notice juridique, SMTP, achat, Edge Function ou déploiement. Aucun P0 ou décision D01–D14 levé. Le lot 6.5.4.B n'est pas démarré et requiert une autorisation distincte.
