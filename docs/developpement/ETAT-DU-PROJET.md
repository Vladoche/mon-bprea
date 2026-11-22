# État du projet Mon BPREA

## A — Identification et sources

Mon BPREA est un site personnel de révision BPREA, facultatif et non commercial.
Il associe un frontend statique sans Node.js à l’exécution, Supabase Auth et
PostgreSQL pour l’espace personnel et une application opérateur Windows .NET/WinForms.

- [Dépôt GitHub](https://github.com/Vladoche/mon-bprea) et [site Pages](https://vladoche.github.io/mon-bprea/).
- Git, PR, workflow Pages et réponses publiques vérifiés le **22 novembre 2026**.
- Le [changelog](../../CHANGELOG.md) conserve les changements et le
  [registre Pages](../deploiement/EXPLOITATION-PRIVEE.md#registre-de-publication-pages)
  les déploiements. Les validations conservent leurs dates, périmètres et limites.

## B — État du code

| Repère | État vérifié |
| --- | --- |
| Référence | `origin/main` à `50d422def1a5df33efc933a2b885fb4c38b3e921` |
| Dernière fusion | [#87, assainissement documentaire](https://github.com/Vladoche/mon-bprea/pull/87), 22/11/2026 à 09:18:07 UTC |
| Fusions antérieures depuis Pages #67 | [#83, hygiène Git](https://github.com/Vladoche/mon-bprea/pull/83), [#84, Admin 2.3](https://github.com/Vladoche/mon-bprea/pull/84), [#85, audit technique du lot B](https://github.com/Vladoche/mon-bprea/pull/85) et [#86, Mon parcours BPREA](https://github.com/Vladoche/mon-bprea/pull/86). |

## C — Fusion, validation et publication

| État | Périmètre vérifié le 22 novembre 2026 |
| --- | --- |
| **Déployé** | [Pages #67](https://github.com/Vladoche/mon-bprea/actions/runs/44763339527), succès du 20/11 à 15:27:11 UTC, SHA `47aff29763763fd3be0b16b60f90e5c8f1048508`. Refonte 2027, Profil simplifié, couleurs personnalisées et continuité de la palette. Notice V1.2 et configuration publique Auth PROD. |
| **Fusionné depuis ce déploiement** | 20 commits. Hygiène Git, Admin 2.3 et quota administratif, améliorations du lot B, préférences « Mon parcours BPREA », notice V1.4 et assainissement documentaire. La V1.3 appartenait au périmètre de #84. Admin Windows suit son propre circuit de distribution. |
| **En développement** | [#88, suppression de l’approbation documentaire manuelle](https://github.com/Vladoche/mon-bprea/pull/88) et renforcement des contrôles automatiques, en revue. [Décision et procédure](../rgpd/SPECIFICATION-INFORMATION-PUBLIQUE.md#versions-et-contrôles-automatiques). |
| **Planifié** | Validation et alimentation des référentiels UCARE/sessions, calendrier personnalisé. La consolidation des tests du lot C est reportée. [Matrice de couverture](../validations/VALIDATION-AUDIT-TECHNIQUE-LOT-B.md#couverture-existante-et-préparation-du-lot-c). |

La lecture HTTP du 22/11 a retrouvé le SHA publié dans les ressources de 15
pages, dont Profil, Confidentialité et les rubriques pédagogiques. Le module
`parcours-ui.js` répondait HTTP 404 sur Pages. Le [registre](../deploiement/EXPLOITATION-PRIVEE.md#registre-de-publication-pages)
conserve la portée de ce relevé public.

Les cinq checks de la [tête de #86](https://github.com/Vladoche/mon-bprea/pull/86/checks)
`fbd6f23230699dc11ce432ee94671e676b6bbf17` ont réussi. Ils couvrent Qualité,
Sécurité Auth/RLS sur stack éphémère et Admin Windows. La
[recette connectée du 08/11](../deploiement/PLAN-PREOUVERTURE-PRIVEE.md#recette-du-seul-compte-exploitant--8-novembre-2026)
sur Pages #64 reste la dernière preuve détaillée avec le compte exploitant.
Le [lot B](../validations/VALIDATION-AUDIT-TECHNIQUE-LOT-B.md) couvre le Profil #67
avec des fixtures Auth en boucle locale et des lectures publiques du site.

La [configuration versionnée](../../assets/auth-config.json) reste désactivée.
Le [workflow Pages](../../.github/workflows/deploy.yml) produit sa configuration
publique sur lancement manuel autorisé. Le [plan de publication](../deploiement/PLAN-PUBLICATION-2027.md)
fixe les vérifications avant lancement et la recette hébergée.

## D — Modules

Les rubriques pédagogiques de ce tableau sont servies par Pages #67. La colonne État précise aussi les évolutions restées sur main.

| Module | État / dernier jalon majeur | Limites importantes | Référence |
| --- | --- | --- | --- |
| Navigation et accueil | Header/footer 2027, accueil panoramique ; #59–#61 | Reprise seulement depuis une activité datée fiable | [Navigation](../architecture/NAVIGATION.md) |
| Mes cours | Sept UC/UCARE, progression réelle, anecdote après les UC ; #60 | Cours disponibles dans la seule UC 03 | [Architecture](../architecture/ARCHITECTURE.md) |
| Pages UC | Chapitres ouverts, cartes et unités vides modernisés (#63), chargement différé fusionné (#85) | Cours dans la seule UC 03 | [Validation PR3](../validations/VALIDATION-UI-2027-PR3-LOT1.md) |
| Lecture des cours | Sommaire interne et mise en page de lecture ; #63 | Quatre cours illustratifs UC 03, complétion et persistance conservées | [Validation PR3](../validations/VALIDATION-UI-2027-PR3-LOT1.md) |
| QCM | Présentation 2027 PR3 lot 2 fusionnée #65, contrats historiques conservés | La reprise datée repose sur les tentatives historisées | [Cours/QCM](../architecture/COURSE-QUIZ-SYNCHRONISATION-CLIENT.md) |
| Drill | Dix nouveaux exercices par UC/semaine, brouillons et entraînements séparés | Banque surtout UC 03 ; séries précédentes non bloquantes | [Mode Drill](../architecture/MODE-DRILL.md) |
| Tableau de bord | Présentation 2027 fusionnée en PR3 lot 4 (#69), statistiques Drill et synthèse partagée | Les indicateurs portent sur les premières réponses validées. [Validation du lot 4](../validations/VALIDATION-UI-2027-PR3-LOT4.md) | [Dashboard](../architecture/DASHBOARD.md) |
| Calendrier | Interface 2027 fusionnée dans #71, événements civils et liens directs | Banque de dates vide. Calendrier personnalisé planifié | [Validation du calendrier](../validations/VALIDATION-UI-2027-PR4-LOT1.md) |
| Générateur ITK | Interface 2027 fusionnée dans #72, génération, CSV, impression et réglages personnels | Repère pédagogique sans prescription | [Validation du générateur](../validations/VALIDATION-UI-2027-PR4-LOT2.md) |
| Ressources | Bibliothèque, filtres et aperçus (#73). Focus et recherche au tri corrigés sur main (#85) | Références éditoriales à entretenir | [Validation de la bibliothèque](../validations/VALIDATION-UI-2027-PR4-LOT3.md) |
| Reconnaissance botanique | Refonte 2027 fusionnée dans #74. Photothèque enrichie intégrée dans #76 | 24 plantes et série Légumineuses | [Botanique](../architecture/RECONNAISSANCE-PLANTES.md) |
| Mon profil | Compte, pseudo et paramètres d’apparence depuis #77 et #81 | Copie, effacement et clôture via le contact officiel | [Auth](../architecture/AUTHENTIFICATION.md) |
| Mon parcours BPREA | Paramètres du Profil sur main (#86) | Livraison dépendante de la migration et de la notice. Les référentiels UCARE et sessions sont vides | [Architecture](../architecture/ARCHITECTURE.md#mon-parcours-bprea) |
| Apparence | Luminosité, modes automatique et personnalisé, profils de couleur (#59, #81 et #82) | Mémorisation volontaire en visiteur ; préférences du compte synchronisables | [Thèmes](../architecture/THEMES.md) |
| Synchronisation | Cours/QCM, Drill, botanique, ITK/apparence | Import volontaire, conflits et opérations en attente conservés ; confirmation distante requise | [Architecture](../architecture/ARCHITECTURE.md#stockage-et-conservation-des-données) |
| Authentification | Activation sur invitation, connexion et récupération assistée ; #49–#51 | Inscription publique/anonyme fermées ; pas de récupération réelle ni isolation A/B PROD recettées | [Auth](../architecture/AUTHENTIFICATION.md) |
| Admin Windows | 2.3 fusionnée (#84), inventaire complet et contrôle du quota. Renouvellement des invitations expirées depuis 2.2 (#70) | Exécutable non signé. Suppression PROD bloquée | [Guide Admin](../../tools/mon-bprea-admin/README.md) |

## E — Sécurité et exploitation

- **Accès.** La [décision du 20 novembre](../rgpd/CADRAGE-MON-BPREA.md#périmètre-acté)
  fixe dix comptes au maximum, dont l’exploitant et neuf participants. Le
  [contrat Auth](../architecture/AUTHENTIFICATION.md) décrit l’accès sur invitation.
  Le [relevé du 18 novembre](../validations/VALIDATION-PREMIERE-INVITATION-PROD.md)
  confirme à sa date le refus des inscriptions publiques et anonymes et un compte confirmé.
- **Backend PROD.** Installation et contrôles datés dans le
  [runbook PROD](../architecture/RUNBOOK-SUPABASE-PROD-6-6-0.md).
  La migration de l’apparence a été appliquée le 20 novembre selon la
  [validation #81](../validations/VALIDATION-PROFIL-COULEURS-THEME.md).
  Le relevé PROD en lecture seule du 22 novembre 2026 confirme six migrations
  jusqu’à l’apparence, dix tables applicatives sous RLS et l’absence de la
  migration Parcours et de sa table. La procédure de mise en service prévoit
  un [point de reprise qualifié avant Parcours](../architecture/RUNBOOK-SUPABASE-PROD-6-6-0.md#mise-en-service-de-mon-parcours-bprea).
- **Sauvegarde et invitations.** Le GO technique du 18 novembre était lié à
  la génération alors restaurée. Le diagnostic `backup_drift` du 20 novembre
  impose une qualification au schéma courant avant de reprendre les invitations.
  [Routine, périmètre et limites](../deploiement/EXPLOITATION-PRIVEE.md#sauvegarde-hebdomadaire-et-rpo).
- **Admin Windows.** Le [guide courant](../../tools/mon-bprea-admin/README.md)
  décrit la version 2.3, l’inventaire complet et le renouvellement.
  La durée de 24 h et le renouvellement réel demandent encore leur
  [décision propre](../validations/VALIDATION-ADMIN-INVITATIONS-EXPIREES.md).
  La suppression dans le binaire PROD reste bloquée. Les preuves de clôture
  locale et de restauration isolée sont dans le
  [guide d’exploitation](../deploiement/EXPLOITATION-PRIVEE.md#clôture-assistée-native).
- **Ouverture.** La matrice préparatoire 15/15 du 08/11 conserve son périmètre.
  Les éléments consultés ne documentent aucune décision d’accueil des participants.
  [Matrice et étapes avant ouverture](../deploiement/PLAN-PREOUVERTURE-PRIVEE.md).

## F — Prochaines actions

1. Valider les référentiels UCARE et sessions avant de préparer le calendrier personnalisé.
2. Qualifier un point de reprise au schéma courant et traiter les décisions
   Auth et renouvellement. Pour publier le Parcours, qualifier sa migration,
   les contrôles automatiques de la V1.4 et les parcours de bout en bout,
   puis suivre la procédure d’autorisation du déploiement.
   [Prérequis de publication](../deploiement/PLAN-PUBLICATION-2027.md#phase-a--décision-préalable).
3. Obtenir les décisions d’ouverture et les autorisations individuelles de
   collecte et d’invitation. [Actions d’exploitation](../deploiement/ARBITRAGES-FINAUX-PREOUVERTURE.md).
