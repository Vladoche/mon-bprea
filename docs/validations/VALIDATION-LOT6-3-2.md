# Validation du lot 6.3.2 — cours et QCM personnels

## État initial et portée

Audit du 25 octobre 2026 : arbre de travail propre, branche initiale `feature/lot6-3-1-personal-data-backend`, HEAD `2d5d195ff554214c757d96ac7ee324de2ba2222a`. Le fetch de `origin/main` a confirmé `6ff540aa53a10d82b09c945b9ee5abc26e2615b0`. La PR [#16](https://github.com/Vladoche/mon-bprea/pull/16), relue via GitHub, est fusionnée à ce commit. La branche `feature/lot6-3-2-sync-cours-qcm` a été créée depuis cette base, sans modification préexistante à déplacer.

AGENTS, contrat backend personnel intégral, guide Drill, Auth et conventions de tests lus. Node.js `v24.22.0`, `npm ci` exécuté avec succès ; Chromium installé par `npx playwright install chromium`. Aucune dépendance ajoutée, aucune migration/RPC/RLS modifiée. Aucun autre lot personnel commencé.

## Architecture et fichiers

Le [guide client](../architecture/COURSE-QUIZ-SYNCHRONISATION-CLIENT.md) décrit le document et ses limites. Les modules `course-quiz-model/store/import/transport/service/ui` séparent les intentions pédagogiques, la transaction locale, le manifeste, les requêtes et les vues. `personal-idb.js` et `sync-runtime.js` factorisent seulement la transaction et les utilitaires de reprise stables du Drill ; les tests Drill antérieurs sont conservés.

`app.js` branche accueil, UC, cours, QCM/résultats/historique et résumés sur la source active. `exam-preparation.js` associe QCM et Drill du même compte ou du même espace visiteur ; `section-hubs.js` utilise aussi la source Drill personnelle existante pour la synthèse. `style.css` reçoit les indications accessibles et le dialogue d’import. Le moteur `exam-stats.js`, les contenus, URL et clés historiques restent conservés.

Les suites ajoutées couvrent modèle, repository, import, service, transport et parcours Chromium avec HTTP simulé. La suite distincte `tests/e2e-supabase/course-quiz-sync.spec.js` ajoute quatre parcours avec Auth/PostgREST/PostgreSQL locaux réels ; les runners et tests SQL 6.3.1 restent inchangés. Le workflow de sécurité conserve son job et ses commandes ; seul le libellé de son étape navigateur mentionne les cours/QCM.

## Intégrité et scénarios

| Risque | Comportement livré et preuve ciblée |
| --- | --- |
| Mélange visiteur/compte | Source choisie par Auth vérifiée ; aucun import à la connexion ; tests service, E2E A/B et import |
| Mélange A/B/projets/environnements | Scope par environnement/origine/UUID, générations et JWT fixé ; repository isolé, retour A après B et réponse tardive d’A |
| QCM perdu sur panne/fermeture | Tentative + opérations dans une seule transaction `readwrite`, succès seulement après commit ; tests quota, rechargement et panne |
| Deux tentatives identiques | UUID distincts alloués avant envoi ; deux positions d’import distinctes ; aucune déduplication par tuple |
| Retry après commit incertain | Même UUID/payload/base ; confirmation par ligne correspondante ou replay ; tests de perte d’acquittement |
| Décochage annulé par ancienne donnée | Réconciliation par révision et `done:false` explicite ; ancien score parfait sans effet de complétion |
| Deux intentions concurrentes | Une seule base gagnante ; archive et dépendants suspendus ; résolution volontaire avec nouvel UUID et base actualisée |
| Plusieurs clics hors ligne | Chaîne persistante de dépendances, bases distinctes et contrôle de la révision du prédécesseur avant envoi |
| QCM parfait + conflit cours | Deux opérations indépendantes côté serveur, tentative conservée une fois même si cours en conflit |
| Historique paginé partiel | Scans jusqu’à page vide, curseur composite microseconde/UUID, union des passes complètes, aucun commit après erreur de page |
| Insertion visible tardivement | Relectures complètes au chargement/reprise/actualisation et périodiques ; réunion par identité sans effacement |
| Cache vide hors ligne | Indisponibilité explicite, aucune statistique nulle supposée fiable |
| Import interrompu | Instantané brut, provenance, positions→UUID et outbox commités ensemble ; reprise du même manifeste sans nouvel UUID |
| Import ambigu | Refus non destructif d’une source différente ou de tentatives sur compte déjà actif sans manifeste commun ; premier import après scan complet frais |
| Archives inconnues | Source visiteur inchangée et instantané intégral conservé ; seules les données validées vont dans les RPC |
| Calcul statistique divergent | Projection au format historique puis appel inchangé de `getUnitExamStats()` ; test de concordance pondérée |

La revue croisée a ajouté des contrôles sur les chaînes de dépendance corrompues, les identifiants backend ressemblant à des propriétés JavaScript, les réponses reçues après un changement de compte et l’attente de chargement initial du cache. Les corrections restent couvertes par des tests de régression.

## Exécutions locales et CI

Un premier passage pendant l’édition parallèle a échoué parce qu’un import JavaScript référençait un nouveau module pas encore écrit ; ce passage n’est pas compté comme validation. Les suites finales utilisent les fichiers complets après revue croisée.

| Contrôle | État observé |
| --- | --- |
| `npm ci` | Réussi sous Node.js 24.22.0 ; aucune vulnérabilité signalée par cette installation |
| `npx playwright install chromium` | Réussi |
| `npm test` | Réussi : 222 tests dans 24 fichiers, incluant toutes les suites antérieures |
| `npm run test:e2e` | Réussi : 28 parcours Chromium, dont 7 nouveaux cours/QCM et les 21 antérieurs |
| `npm run test:e2e:supabase` sur le poste | Non exécuté : garde de configuration locale déclenchée, stack dédiée absente ; Docker absent du PATH |
| PostgreSQL/Auth/RLS local sur le poste | Non validé localement ; aucun remplacement par des mocks |
| `unit-integration`, `e2e`, `supabase-security` | À vérifier sur le dernier commit de la PR ; résultats et liens consignés dans la description de PR après exécution |

Les tests Supabase sont gardés par l’identité du projet CLI, les ports loopback et les clés de la stack locale. Les nouveaux parcours utilisent les invitations fictives capturées localement, de vrais JWT étudiants pour les assertions et le nettoyage ciblé des seuls comptes de leur run. La perte HTTP intervient **après** `route.fetch()` réellement accepté par PostgreSQL. Aucune assertion pédagogique n’utilise de privilège administratif.

## Inspection visuelle et accessibilité

17 captures de recette générées dans `.tmp/course-quiz-visual/` (ignoré par Git), inspectées séparément des assertions. Matrice : visiteur, compte, conflit et import à 1280 et 390 px en clair et sombre ; panne personnelle à 1280 px. Les variantes de thème utilisent le bouton réel et désactivent les transitions uniquement pour la capture. Les dialogues et avertissements restent lisibles, les actions restent accessibles et aucune capture ne présente de débordement horizontal. Les états personnels ne sont pas présentés comme des résultats visiteurs.

Les formulaires cours/QCM gardent leurs nœuds pendant les publications asynchrones. Les réponses en cours et résultats privés sont retirés lors d’un changement d’espace ou d’une identité incertaine. Les messages sont annoncés par `role=status`/`aria-live`, le dialogue d’import possède un titre et une annulation, et le focus revient vers son bouton d’ouverture. Le choix de résolution conserve les archives et ramène le focus sur l’actualisation. Les tests vérifient les parcours clavier et l’absence de débordement.

## Limites et environnements

- Sans Docker sur ce poste, la preuve réelle dépend de la stack éphémère CI. Un test HTTP simulé réussi ne prouve jamais RLS.
- Le premier import exige le réseau et refuse les historiques ambigus. Le contrat backend ne transporte pas de manifeste d’import entre appareils : aucune déduplication certaine de copies indépendantes n’est annoncée. Une résolution de provenance extérieure à ce parcours est nécessaire pour un historique refusé.
- Le cache et les instantanés d’import ne sont pas chiffrés ; ils survivent à la déconnexion. Les procédures complètes d’export, suppression autorisée et conservation attendent le lot 6.4.
- Aucun service worker ni disponibilité intégrale du site hors connexion. Les pages et modules doivent déjà être accessibles ; seule la panne API avec cache fiable est couverte.
- Les singletons backend n’ont pas de reçus perpétuels : une intention supersédée après perte d’acquittement peut rester en conflit, sans réapplication automatique.
- Les résultats restent déclarés par le navigateur, sans réponses individuelles ni snapshots de QCM inventés.
- Une ancienne date de précision supérieure à six décimales est conservée dans l’instantané et signalée non importable sans arrondi supposé ; les dates générées par le site ont trois décimales.

DEV `wcckbyhrtroittbfophv` et PROD `oqoqrxwfbkhtpksqimgd` : aucune opération ni recette hébergée effectuée. L’application préalable de la migration 6.3.1 à DEV n’est pas présumée. `assets/auth-config.json` reste désactivé. Aucun secret, réglage SMTP/Auth, invitation réelle, ruleset GitHub, fusion ou déploiement modifié. L’ouverture étudiante attend les lots 6.4/6.5 et les autorisations distinctes.
