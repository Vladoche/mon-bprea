# UX/UI 2027 — validation PR2

Qualification locale du 15 novembre 2026 sur `feat/ui-2027-home-hubs`.
Référence : `origin/main` à `67cad1c1a0112f567fece57fcd507c6195f5b035`,
contenant la [PR #59 fusionnée](https://github.com/Vladoche/mon-bprea/pull/59).
L’arbre de travail était propre avant création de la branche.

## Résultat et choix de présentation

Accueil, Mes cours, S’exercer et Outils utilisent les tokens, contrôles,
header et footer de PR1. Le hero utilise une serre en SVG original créé dans
le dépôt, sans ressource extérieure : `assets/revision-garden.svg`, 2 635 octets,
décoratif, dimensions réservées et cadrage mobile léger. Il remplace la photographie
évoquée dans la direction graphique pour conserver un chargement léger et une
provenance certaine.

L’accueil présente trois des quatre cours réellement disponibles dans l’UC 03,
et la progression de cette UC. Les sept UC/UCARE gardent leurs identifiants,
intitulés et destinations dans Mes cours ; six attendent encore leurs cours.
Les exercices et outils restent accessibles par leurs pages existantes.

La reprise désigne uniquement le cours associé au dernier QCM valide et daté
de la source vérifiée. Une complétion sans date ou un ancien score ne devient
pas une dernière activité. Sans cette information, le bouton indique
« Commencer à réviser » et mène aux exercices ; « Explorer les cours » ouvre
Mes cours. Aucun suivi comportemental ni nouvelle clé de stockage.

Les progressions inconnues restent indisponibles, avec données conservées ;
elles ne sont jamais remplacées par un zéro. Le calcul connu utilise les
complétions de cours, sans inférence depuis les scores ni confusion avec le Drill.

Le bandeau d’examen et son initialisation quittent l’accueil ; son moteur reste
conservé. L’anecdote quotidienne, son module et sa banque ne se chargent que dans
Mes cours, après les UC, avec sélection, sources, fermeture et renouvellement
existants. Les styles d’accueil inutilisés et les liens CSS devenus inutiles
sont retirés.

Les commandes détaillées cours/QCM réutilisent le panneau existant dans
`profil.html#parametres`, section `#donnees-synchronisation`. Les pages pédagogiques
gardent leurs abonnements et sauvegardes automatiques ; seuls les états demandant
une attention affichent une notice contextuelle. Import confirmé, conflits,
opérations conservées et actualisation restent disponibles. Les autres domaines
gardent leurs composants propres. Une petite correction CSS du fieldset d’effacement
existant empêche son débordement à 320 px avec texte doublé ; aucun contrat
d’effacement, export ou restauration n’est modifié.

## Vérifications réellement exécutées

- Node.js 24.22.0, `npm ci` réussi, aucune dépendance ajoutée.
- `npm test` : **623 tests réussis, 1 ignoré** sous Windows.
- Campagne E2E complète : **132 réussis**. Après les derniers ajustements CSS,
  **26 scénarios ciblés réussis** : PR2, navigation PR1 et effacement.
- Supabase local réel : **414 assertions pgTAP**, **12 groupes Auth** avec
  expirations réelles, **22 groupes Drill**, **26 groupes personnels**,
  **32 parcours navigateur complets**, puis **1 nouveau parcours réel des hubs**
  exécuté séparément et réussi (33 parcours distincts couverts).
- SDK Supabase navigateur reconstruit identique ; notice publique reproductible,
  SHA-256 LF `c2b2422b9c3d6b7ec25227f143080782842c4c077f5a1361d4cd36653ad9b8c1`.
- `git diff --check` réussi ; recherche ciblée des secrets et adresses personnelles
  dans les ajouts sans anomalie détectée.

Docker Desktop a été démarré pour la qualification locale. La stack dédiée
`mon-bprea-lot6-1-local` contenait zéro compte et avait M5 en attente : le premier
pgTAP échouait sur trois codes SQL `40001` attendus en `PT409`. La migration M5
déjà versionnée a été appliquée seulement à cette stack, sans reset. Les cinq
migrations sont ensuite concordantes et pgTAP passe. Les comptes fictifs sont
nettoyés par leurs fixtures ; stack et processus de recette arrêtés avec volumes
et autres stacks conservés. La configuration éphémère de clôture créée pour cette
recette est retirée après usage. Aucun accès ou changement Supabase hébergé.

Les interfaces ont été contrôlées à 320, 390, 768, 1024 et 1440 px, en clair/sombre,
au clavier, avec texte doublé, mouvement réduit et contraste forcé. Les liens
fonctionnent sous `/mon-bprea/`. Les nouveaux textes et contrôles sont soumis à
des assertions ciblées de contraste composé, noms, focus et reflow. Le profil
et ses commandes sont aussi vérifiés à 320 px avec texte à 200 %.

Le premier passage CI Linux a révélé un débordement de « Aucune donnée » dans
la synthèse hebdomadaire à 320 px avec texte doublé, absent du rendu Windows
initial. La ligne permet maintenant le repli sur plusieurs rangées ; le contrôle
local de texte agrandi impose aussi une police Verdana plus large. Les assertions
de reflow restent inchangées.

Ces contrôles ne constituent pas une certification WCAG, une recette lecteur
d’écran, un zoom natif ou un essai sur appareil physique. Les simulations HTTP
qualifient l’interface ; la preuve Auth/RLS vient de la stack locale et de la CI,
jamais d’un mock ni d’un accès administratif utilisé comme étudiant.

## Captures pour revue humaine

La campagne locale est regroupée dans `.tmp/ui-2027-pr2/` et reste conservée
jusqu’à la revue humaine de PR2. `revue-visuelle.html` compare les deux versions ;
les captures PR1 existantes sont conservées, avec six captures supplémentaires
des hubs obtenues depuis la référence archivée. Les quatorze captures PR2 sont
dans `pr2-captures/` :

| Sujet | Fichiers |
| --- | --- |
| Accueil ordinateur clair/sombre | `pr2-home-desktop-light.png`, `pr2-home-desktop-dark.png` |
| Accueil mobile clair/sombre | `pr2-home-mobile-light.png`, `pr2-home-mobile-dark.png` |
| Mes cours ordinateur/mobile | `pr2-courses-desktop-light.png`, `pr2-courses-mobile-light.png` |
| Anecdote dans Mes cours | `pr2-courses-fact.png` |
| S’exercer ordinateur/mobile | `pr2-practice-desktop.png`, `pr2-practice-mobile.png` |
| Outils ordinateur/mobile | `pr2-tools-desktop.png`, `pr2-tools-mobile.png` |
| Paramètres cours/QCM | `pr2-profile-data-sync.png` |
| Progression indisponible | `pr2-progress-unavailable.png` |
| Échec de sauvegarde QCM | `pr2-save-error.png` |

Captures Playwright non retouchées, date fixée au 15 novembre 2026 à 12 h CET,
automne, animations désactivées et données synthétiques. La CI conserve images
et rapports quatorze jours. **Aucune nouvelle référence pixel approuvée ou
renouvelée automatiquement.**

## Mesures comparatives PR1 → PR2

`scripts/measure-ui-foundations.mjs` est réutilisé et étendu aux quatre pages,
aux poids transférés/images et à la disponibilité des cartes. Le job
`ui-performance-lab` produit les quatre JSON avec les budgets PR1 existants.

Une baseline a été enregistrée avant développement dans
`.tmp/ui-2027-pr2/baseline-performance.json`. La comparaison finale ci-dessous
recharge alternativement l’archive de main contenant PR1 et la version PR2,
cinq fois chacune, dans des contextes froids, sur le même serveur local sans
compression/cache et sans trafic extérieur. Chromium 156.0.8078.4, 1440 × 1000 px,
CPU ×4, latence 20 ms, débit 1 250 000 octets/s, stabilisation 1 seconde,
automne/clair. Médianes Windows ; mesures de laboratoire, pas de garantie terrain.

| Page | LCP (ms) | CLS | Transféré, document inclus (Ko) | Requêtes |
| --- | ---: | ---: | ---: | ---: |
| Accueil | 1808 → 1664 | 0.08428 → 0.00000 | 911.25 → 898.97 | 80 → 78 |
| Mes cours | 1332 → 1320 | 0.08412 → 0.00000 | 913.50 → 906.70 | 79 → 79 |
| S’exercer | 1688 → 1396 | 0.12718 → 0.00041 | 913.51 → 890.08 | 79 → 76 |
| Outils | 1420 → 1404 | 0.08412 → 0.00000 | 913.50 → 890.07 | 79 → 76 |

Poids CSS/JS/images décompressés en octets ; cartes et interactions en ms.
L’interaction mesure le changement de luminosité et l’ouverture du menu Mes cours
jusqu’à deux images suivantes : **ce n’est pas l’INP de terrain**.

| Page | CSS | JavaScript | Images | Cartes disponibles | Interaction |
| --- | ---: | ---: | ---: | ---: | ---: |
| Accueil | 66686 → 70676 | 813002 → 799372 | 0 → 2635 | 1942.3 → 1668.7 | 65.3 → 42.0 |
| Mes cours | 69278 → 67242 | 813002 → 808263 | 0 → 0 | 1724.2 → 1635.6 | 40.0 → 42.1 |
| S’exercer | 69278 → 65063 | 813002 → 799372 | 0 → 0 | 1697.2 → 1537.6 | 41.8 → 40.0 |
| Outils | 69278 → 65063 | 813002 → 799372 | 0 → 0 | 1642.5 → 1510.5 | 38.8 → 33.4 |

Aucun budget diagnostique dépassé sur les quatre pages. Les mesures brutes
permettent de distinguer les écarts observés de la variabilité du laboratoire.
Aucun flou coûteux
n’est ajouté aux cartes ou au hero ; le header PR1 reste inchangé. Les fichiers
`performance-index.json`, `performance-mes-cours.json`,
`performance-s-exercer.json` et `performance-outils.json` conservent mesures
brutes, déplacements de mise en page et alertes dans le dossier de campagne.

## Limites de livraison

Les clés de stockage, schémas IndexedDB/Supabase, migrations versionnées, politiques
RLS, contrats de synchronisation/export/restauration et calculs pédagogiques
restent inchangés dans le dépôt. `assets/auth-config.json` reste désactivé.
Aucun déploiement Pages, aucune mutation PROD et aucune fusion automatique.
La PR et ses artefacts CI portent les résultats de la tête finale ; les contrôles
locaux et CI ne qualifient pas le comportement d’un compte PROD.
