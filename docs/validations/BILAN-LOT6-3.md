# Bilan du lot 6.3 — espace personnel

Ce bilan couvre les sous-lots 6.3.1 à 6.3.4, avec les intégrations Auth, Drill et Dashboard nécessaires à leur recette commune. Il décrit un site statique dont le compte reste désactivé publiquement. Il ne constitue ni une ouverture aux étudiants, ni une validation RGPD, ni une application de migration hébergée.

## Fonctionnalités et contrats

| Domaine | Données disponibles et backend | Persistance et synchronisation | Import volontaire et conflits | Protection A/B et limites |
| --- | --- | --- | --- | --- |
| Auth et profil (6.1) | Supabase Auth sur invitation ; `profiles.id` = UUID Auth, pseudo facultatif | SDK pour session ; profil privé RLS et privilèges de colonne | Aucun import pédagogique par connexion ; pas d’inscription publique/anonyme | `getUser` vérifie l’identité ; génération/JWT capturés ; cache local non chiffré et token déjà émis valide jusqu’à expiration |
| Drill (6.2) | Séries avec snapshots, premières réponses et entraînements ; trois tables et RPC Drill | IndexedDB personnel isolé ; réponses/outbox atomiques, UUID durables et retries exacts | Import explicite ; première réponse serveur fait autorité, intention divergente archivée | Portée environnement/projet/UUID ; aucun historique A chez B ; pas de nouvelle banque inventée hors réseau |
| Dashboard (6.2.3) | Projection des premières réponses Drill personnelles | Même service Drill ; aucune table ou outbox parallèle | Résolution exclusivement dans Drill | Les entraînements, QCM et conflits archivés ne gonflent pas ses totaux ; source indisponible distincte d’un compte vide |
| Cours (6.3.1/6.3.2) | `course_states`, case terminée réversible, meilleur score et base ancienne partielle | IndexedDB cours/QCM ; états et opérations atomiques, chaînes CAS | Aperçu/import explicite ; compte actif ambigu refusé ; décochage préservé ; résolution volontaire sur base fraîche | Scopes et générations Auth ; une tentative parfaite historique ne recoche jamais automatiquement un cours |
| QCM (6.3.1/6.3.2) | `quiz_attempts`, scores/totaux et dates conservées ; meilleur score absolu | Historique immuable, UUID par tentative ; retries sans doublon | Manifeste source/positions/UUID ; anciens scores sans date restent des bases anciennes | A/B et RLS ; pas de réponses individuelles ou de dénominateurs anciens inventés ; copies sans provenance certaine refusées |
| Botanique (6.3.1/6.3.3) | `botanical_sessions`, `botanical_answers` ; sessions, quatre statuts, erreurs et révisions | IndexedDB ; création → réponses → fin, atomicité et identités durables | Aperçu/manifeste séparé ; orphelines conservées hors import ; serveur gagnant et archive divergente | FK composite propriétaire/session, RLS et générations ; pas de reprise de partie après fermeture ni de choix historiques reconstitués |
| ITK (6.3.1/6.3.4) | `itk_settings`, dernier ensemble des huit chaînes du formulaire | IndexedDB singletons partagé avec apparence ; CAS, outbox et retries exacts | Aperçu lisible, confirmation explicite et source inchangée ; ensemble conflictuel conservé sans fusion | A/B et génération ; pas de calendrier, PDF, CSV, projet, bibliothèque ou historique documentaire distant ; années 2026–2033 |
| Apparence (6.3.1/6.3.4) | `appearance_preferences`, saison/luminosité choisies et date facultative | Même cache singletons ; `auto` conservé, rendu local ; init avant CSS sans réseau | Import v1 ou legacy reconnu si v1 absent ; archives brutes conservées ; décision explicite après conflit | Préférences personnelles appliquées après identité vérifiée ; aucun identifiant dans CSS ; le rendu provisoire de l’appareil n’est pas une preuve personnelle |

Les services partagent Auth/client Supabase, `personal-idb.js` et `sync-runtime.js`. Chaque domaine conserve ses règles métier et ses opérations ; un conflit n’autorise aucune suppression d’un autre domaine. Le visiteur garde ses clés historiques et aucun import implicite ne remplit un compte. Les données locales ne sont jamais supprimées à la déconnexion.

## Preuves et recette commune

Les preuves historiques des lots [6.3.1](VALIDATION-LOT6-3-1.md), [6.3.2](VALIDATION-LOT6-3-2.md) et [6.3.3](VALIDATION-LOT6-3-3.md) sont distinctes de la [validation 6.3.4](VALIDATION-LOT6-3-4.md), qui consigne les commandes réellement exécutées et les trois contrôles sur le dernier commit livré.

**Clôture fonctionnelle en branche :** les six tables personnelles du 6.3.1 et les clients cours/QCM, botanique, ITK et apparence des 6.3.2 à 6.3.4 sont implémentés, avec imports volontaires, persistance locale et règles de conflit décrites ci-dessus. Drill, Dashboard, Auth et profils restent intégrés à la recette commune. La PR #19 est ouverte pour revue, sans fusion ni publication.

**Preuve CI du périmètre :** le commit fonctionnel `7d82340f37b25c53d2e1d23d9e9661b33b0f87bf` a réussi les trois jobs, avec 322 tests unitaires/intégration, 53 parcours autonomes, 350 assertions pgTAP, 59 groupes Auth/API et 24 parcours avec Supabase éphémère réel. Les quatre recettes transversales et les quatre ITK/apparence sont toutes vertes ; les données gagnantes et les historiques sont relus dans PostgreSQL. Le rapport 6.3.4 lie les exécutions exactes et distingue les relances d’environnement des preuves réussies. Les contrôles du dernier commit documentaire sont à vérifier sur la PR après chaque poussée.

| Niveau | Ce qu’il démontre | Ce qu’il ne démontre pas |
| --- | --- | --- |
| Vitest modèle/store/service/transport | Validation, transactions, UUID/payload, CAS, reprises, imports, comptes et retours tardifs avec données isolées | Auth distant, PostgreSQL ou RLS réels |
| Chromium autonome | Parcours UI, IndexedDB réel du navigateur, thèmes, clavier, formulaire actif, exports et scénarios HTTP synthétiques | Sécurité PostgreSQL ; les captures restent synthétiques |
| pgTAP et runners Auth/Drill/personnel | 350 assertions SQL de référence et sessions fictives avec JWT, privilèges et conflits réels | Configuration ou recette du DEV hébergé |
| Chromium avec Supabase local éphémère | Multi-appareils, SQL relu avec JWT étudiant, séparation A/B, panne/retry/conflits, recette commune des domaines | Disponibilité intégrale hors ligne, conformité juridique, ouverture en production |

Le statut du lot 6.3.4 et le détail de la recette transversale sont établis uniquement par son rapport de validation et les exécutions CI correspondantes. Une suite ajoutée ou un job configuré ne vaut jamais un résultat réussi. Les suites des lots précédents restent incluses ; aucune réduction des 350 assertions de référence n’est autorisée par ce bilan.

Les assertions propres à chaque domaine sont repérables dans les fichiers suivants. Leurs résultats exécutés restent ceux du rapport de validation ; les suites autonomes ne prouvent pas RLS.

| Domaine | Modèle, persistance ou interface | Navigateur avec Auth/PostgreSQL locaux réels |
| --- | --- | --- |
| Auth et profils | [Service Auth](../../tests/unit/auth-service.test.js), [identité locale](../../tests/unit/auth-local-identity.test.js), [interface](../../tests/e2e/auth.spec.js) | [Parcours Auth](../../tests/e2e-supabase/auth.spec.js), [runner Auth/RLS](../../scripts/test-supabase.mjs) |
| Drill | [Modèle](../../tests/unit/drill-sync-model.test.js), [service](../../tests/integration/drill-sync-service.test.js), [persistance](../../tests/integration/drill-personal-store.test.js) | [Synchronisation](../../tests/e2e-supabase/drill-sync.spec.js), [reprise Auth](../../tests/e2e-supabase/drill-auth-recovery.spec.js) |
| Dashboard | [Calculs](../../tests/unit/dashboard-stats.test.js), [source personnelle](../../tests/integration/dashboard-data.test.js), [interface](../../tests/e2e/dashboard-sync.spec.js) | [Dashboard personnel](../../tests/e2e-supabase/dashboard-sync.spec.js) |
| Cours et QCM | [Modèle](../../tests/unit/course-quiz-model.test.js), [service](../../tests/integration/course-quiz-service.test.js), [interface](../../tests/e2e/course-quiz-sync.spec.js) | [Cours/QCM multi-appareils](../../tests/e2e-supabase/course-quiz-sync.spec.js) |
| Botanique | [Modèle](../../tests/unit/botanical-sync-model.test.js), [service](../../tests/integration/botanical-sync-service.test.js), [interface](../../tests/e2e/botanical-sync.spec.js) | [Botanique personnelle](../../tests/e2e-supabase/botanical-sync.spec.js) |
| ITK et apparence | [Modèle](../../tests/unit/settings-model.test.js), [service](../../tests/integration/settings-service.test.js), [thème initial](../../tests/integration/settings-appearance.test.js), [interface](../../tests/e2e/settings-sync.spec.js) | [Singletons, conflits et imports](../../tests/e2e-supabase/settings-sync.spec.js) |
| Transversal | [Helper de démarrage/reprise Drill](../../tests/e2e/personal-recipe-helpers.spec.js) : contrôle de recette uniquement | [Tous les domaines](../../tests/e2e-supabase/personal-space.spec.js) : historiques, A/B, panne API, conflits isolés |

Le [socle pgTAP personnel](../../supabase/tests/database/personal_data_backend.test.sql) et le [runner personnel](../../scripts/test-personal-data-supabase.mjs) vérifient les tables et RPC partagées par cours/QCM, botanique, ITK et apparence. Les suites profils et Drill restent exécutées avec eux.

## DEV hébergé restant à préparer

Le 26 octobre 2026, l’outil Supabase `list_migrations` a été appelé en lecture seule pour DEV `wcckbyhrtroittbfophv`. Il retourne seulement `20261022000100 profiles` et `20261024083417 create_drill_sync_schema`. **La migration personnelle 6.3.1 `20261025143831` n’y est pas présente.** Aucun parcours hébergé des nouveaux domaines n’est donc déclaré validé. Aucune migration n’est appliquée dans cette mission.

Une intervention DEV distincte devra obtenir l’autorisation, vérifier cible/historique/sauvegardes et appliquer le delta revu avant toute recette hébergée avec comptes fictifs. Les runners destructifs locaux ne doivent jamais être redirigés vers DEV. PROD `oqoqrxwfbkhtpksqimgd` reste exclu ; aucun réglage SMTP/Auth ou invitation externe n’est modifié. Le fichier public `assets/auth-config.json` reste `enabled:false` avec URL/clé vides.

## Obligations du lot 6.4 et ouverture 6.5

Le lot 6.4 devra couvrir finalités et information, responsable/contact, sous-traitants/région/transferts, durées de conservation, comptes inactifs, journaux Auth/SMTP/hébergement, sauvegardes, caches/outboxes/conflits/imports, export et suppression autorisée. La cascade SQL, RLS et la déconnexion ne constituent pas une procédure complète de suppression ou de conformité. Aucune purge automatique ni politique juridique définitive n’est introduite ici.

Le lot 6.5 devra valider la configuration hébergée, les migrations approuvées, SMTP et redirections, invitations contrôlées, parcours réels, mesures de confidentialité et préparation des personnes responsables avant ouverture aux étudiants. Aucun feu vert d’ouverture ne découle des tests locaux ou de ce bilan. Le générateur ITK avancé reste réservé au lot 7.

La continuité hors ligne suppose un cache fiable de la bonne identité et des ressources déjà disponibles. Sans service worker, le chargement intégral du site n’est pas garanti sans réseau. Les résultats pédagogiques déclarés par le navigateur ne sont pas des examens certifiés. Une personne contrôlant le profil du navigateur peut accéder aux caches non chiffrés : utiliser un profil adapté sur un appareil partagé.
