# Changelog

Historique synthétique du code et de sa documentation, sans versionnement SemVer
du frontend. Les dates ci-dessous sont les **dates de fusion UTC**, vérifiées sur
GitHub le 19 novembre 2026. Une fusion ne prouve pas une publication : consulter
l’[état actuel](docs/developpement/ETAT-DU-PROJET.md) et le
[registre Pages](docs/deploiement/EXPLOITATION-PRIVEE-SIX-ADULTES.md#registre-de-publication-pages).
La version de l’application Windows reste propre à cet outil.

## Non publié

- **Audit technique et chargement des rubriques**. Chargement des modules
  selon la page avec état de reprise, sauvegardes de cours isolées après un
  changement de compte, synthèse Drill relue au retour et après une panne,
  recherche et focus conservés dans la bibliothèque. [Mesures et matrice E2E](docs/validations/VALIDATION-AUDIT-TECHNIQUE-LOT-B.md).
- **Admin Windows 2.3 et capacité de dix comptes**. Décision du 20 novembre
  2026, avec une place exploitant et neuf places participantes. Inventaire Auth
  complet exigé dans les circuits de création et places restantes affichées dans
  Admin. Cadrage, registre et notice V1.3 candidate mis à jour. [PR #84](https://github.com/Vladoche/mon-bprea/pull/84) · [Décision](docs/rgpd/CADRAGE-MON-BPREA-SIX-ADULTES.md#périmètre-acté).
- **Hygiène Git après livraison**. Inventaire au démarrage, isolation des tâches
  et contrôle du distant avant le nettoyage des builds et worktrees de la tâche.
  [PR #83](https://github.com/Vladoche/mon-bprea/pull/83).

- **Continuité des palettes entre les pages**. La palette du compte reconnu
  s’applique avant les feuilles de style. Les modes saisonnier et personnalisé
  sont exclusifs, avec une luminosité indépendante. [PR #82](https://github.com/Vladoche/mon-bprea/pull/82).

- **Profil simplifié, couleurs personnalisées et continuité clair/sombre**.
  Retrait du panneau cours/QCM et des imports d’apparence du profil.
  Sauvegardes automatiques et reprises contextuelles, roue chromatique et
  préférences synchronisables après migration. La luminosité d’une session
  déjà vérifiée est reprise avant CSS. [PR #81](https://github.com/Vladoche/mon-bprea/pull/81) ·
  [Validation](docs/validations/VALIDATION-PROFIL-COULEURS-THEME.md).

- **Approbation de la notice V1.2**. Décision du 20 novembre 2026 enregistrée
  pour le texte exact, avec contrôles ciblés du profil et de l’artefact Pages.
  Publication non autorisée.
  [PR #80](https://github.com/Vladoche/mon-bprea/pull/80) ·
  [Validation](docs/validations/VALIDATION-APPROBATION-NOTICE-V1-2.md).

- **Recette finale de préproduction 2027**. Notice V1.2 candidate et parcours
  de copie, d’effacement et de clôture via le contact officiel. Vérification
  de la conservation des données et répétition locale de la mise à niveau et
  du repli Pages. Approbation de la notice en attente.
  [PR #79](https://github.com/Vladoche/mon-bprea/pull/79) ·
  [Recette](docs/validations/VALIDATION-RECETTE-FINALE-2027.md).

- **Harmonisation graphique 2027, PR5 lot 2**. Les commandes autonomes des
  parcours pédagogiques, du calendrier et du compte reprennent les surfaces
  du header. Les flèches du calendrier restent compactes et le champ mois
  natif adopte les repères communs des formulaires. [PR #78](https://github.com/Vladoche/mon-bprea/pull/78) ·
  [Validation](docs/validations/VALIDATION-UI-2027-PR5-LOT2.md).

- **Mon profil 2027, PR5 lot 1**. Compte, apparence et synchronisation des
  cours et QCM dans trois sections avec accès direct. Le profil affiche le
  pseudo confirmé et guide la sauvegarde. Export JSON, restauration JSON et
  effacement sortent du profil partagé. Le contact reste accessible pour les
  demandes de copie ou de suppression.
  [PR #77](https://github.com/Vladoche/mon-bprea/pull/77) ·
  [Validation](docs/validations/VALIDATION-UI-2027-PR5-LOT1.md).

- **Photothèque botanique enrichie**. 24 plantes à reconnaître, ouverture des
  Légumineuses et 11 comparaisons documentées qui favorisent les propositions
  proches. Les corrections distinguent bonnes et mauvaises réponses par une
  animation brève qui respecte la préférence de mouvement réduit.
  [PR #75](https://github.com/Vladoche/mon-bprea/pull/75) ·
  [Intégration à main #76](https://github.com/Vladoche/mon-bprea/pull/76).

- **Reconnaissance botanique 2027, PR4 lot 4**. Sélection des catégories et des
  modes accessible au clavier, photographies non recadrées avec des crédits dépliables,
  corrections structurées et résultats lisibles sur mobile. La durée mesurée
  figure à côté du nombre d’expirations du chrono. Les commandes de jeu et
  d’import reprennent les surfaces du header. Le suivi est réservé aux comptes
  et aux problèmes de stockage. [PR #74](https://github.com/Vladoche/mon-bprea/pull/74) ·
  [Validation](docs/validations/VALIDATION-UI-2027-PR4-LOT4.md).
- **Ressources documentaires 2027, PR4 lot 3**. Recherche et filtres plus
  lisibles, critères avancés actifs visibles, cartes et aperçus pédagogiques
  harmonisés avec les commandes du header et de l’ITK. La vérification des PDF
  applique sa limite de lecture en octets. [PR #73](https://github.com/Vladoche/mon-bprea/pull/73) ·
  [Validation](docs/validations/VALIDATION-UI-2027-PR4-LOT3.md).
- **Générateur ITK 2027, PR4 lot 2**. Paramètres de culture regroupés,
  synthèse et chronologie adaptées au mobile, boutons assortis au header,
  feuille imprimée allégée et actions de sauvegarde explicites. Les calculs,
  exports CSV et décisions de synchronisation suivent les contrats existants.
  [PR #72](https://github.com/Vladoche/mon-bprea/pull/72) et
  [validation](docs/validations/VALIDATION-UI-2027-PR4-LOT2.md).
- **Calendrier de formation 2027, PR4 lot 1**. Navigation mensuelle et grille
  modernisées, accès à l’agenda du jour depuis les compteurs, fiches détaillées
  adaptées au clavier et au mobile. Les dates de formation proviennent du même
  fichier JSON. [PR #71](https://github.com/Vladoche/mon-bprea/pull/71) et
  [validation](docs/validations/VALIDATION-UI-2027-PR4-LOT1.md).
- **Mon BPREA Admin 2.2 — invitations expirées**. Renouvellement depuis **Récupérer un compte** sur le même UUID Auth. La copie vérifie l’invitation en cours, le journal garde les générations protégées et le réglage de 24 heures est relu auprès de Supabase. [PR #70](https://github.com/Vladoche/mon-bprea/pull/70) · [Validation](docs/validations/VALIDATION-ADMIN-INVITATIONS-EXPIREES.md).
- **Tableau de bord 2027, clôture de PR3 (lot 4)**. Synthèse responsive,
  graphiques hebdomadaires consultables au clavier et au toucher, comparaison
  des UC et repères de révision par notion. Les mêmes données et calculs
  alimentent les indicateurs. [PR #69](https://github.com/Vladoche/mon-bprea/pull/69)
  et [validation](docs/validations/VALIDATION-UI-2027-PR3-LOT4.md).
- **Mon BPREA Admin 2.1**, fusionné le 18/11 à 12:27:27 UTC sur `fc5fcad`.
  Raccordement de l’historique protégé sur Windows,
  configuration et maintenance des sauvegardes depuis l’application. La création
  PROD dépend d’une archive récente restaurée et vérifiée, du journal et de
  l’inventaire courant. [PR #68](https://github.com/Vladoche/mon-bprea/pull/68)
  et [qualification de la première invitation](docs/validations/VALIDATION-PREMIERE-INVITATION-PROD.md).
- **Mon BPREA Admin V2 — administration simplifiée** : trois actions principales,
  configuration Windows intégrée et mémorisation automatique chiffrée de la clé,
  liens protégés par DPAPI, récupération du mot de passe, de l’adresse ou des deux
  sans cases d’attestation. Journaux et barrières de non-répétition conservés,
  sans preuve de consentement inventée. Exécutable autonome et recette locale
  réelle avec conservation des UUID/données, suppression d’A, témoin B préservé
  et restauration réconciliée. Suppression PROD toujours bloquée, aucun changement
  PROD ni publication Pages. [PR #67](https://github.com/Vladoche/mon-bprea/pull/67).
  [Guide](tools/mon-bprea-admin/README.md),
  [architecture et limites](tools/mon-bprea-admin/DEVELOPPEMENT.md),
  [validation](docs/validations/VALIDATION-ADMIN-V2.md).
- Drill hebdomadaire PR3 lot 3 #66 fusionné ; voir l’entrée datée ci-dessous.
- QCM de cours PR3 lot 2 #65 fusionné ; voir l’entrée datée ci-dessous.
- Correctif clair/sombre #64 fusionné ; voir l’entrée datée ci-dessous.
- PR3 lot 1 UC/lecture #63 fusionnée ; voir l’entrée datée ci-dessous.
- Maintenance documentaire #62 fusionnée ; voir l’entrée datée ci-dessous.
- Frontend fusionné après le dernier commit publié : refonte 2027 #59–#66
  détaillée ci-dessous. Les versions Windows sont distribuées par leur workflow
  propre ; les preuves documentaires #52–#55 ne constituent pas une publication Pages.

Pour une prochaine PR significative, ajouter ici un intitulé stable et son lien
dès que le numéro est connu. À la reprise après fusion, inscrire la date réelle
et conserver le statut de publication séparément ; ne jamais exiger le futur SHA
de merge dans la PR elle-même. Une correction de ponctuation n’impose pas d’entrée.

## 2026-11-16

### Modifié — [#66](https://github.com/Vladoche/mon-bprea/pull/66), Drill hebdomadaire PR3 lot 3

Sélection UC et semaines, cartes de questions, progression des premières réponses,
corrections, entraînements et historique modernisés. Brouillons, snapshots et
synchronisation conservés ; mises à jour ciblées pour préserver focus et lecture.
Fusion le 16/11 à 20:39:05 UTC,
`7115b722352ba5e951a1ae29bdc4e69f07938c02`, sans publication Pages.
[Validation](docs/validations/VALIDATION-UI-2027-PR3-LOT3.md).

### Modifié — [#65](https://github.com/Vladoche/mon-bprea/pull/65), QCM de cours PR3 lot 2

Cartes de questions/réponses, compteur de saisie, corrections explicites, résultat
et sauvegarde distincts, historique et retry conservés. Fusion le 16/11 à
18:52:04 UTC, `2322aab6424961f2afdc78a4bfe49e608262c0ef`, sans publication Pages.
[Validation](docs/validations/VALIDATION-UI-2027-PR3-LOT2.md).

### Corrigé — [#64](https://github.com/Vladoche/mon-bprea/pull/64), clair/sombre entre pages

Le clic lune/soleil conserve le choix visiteur via la clé existante ; préférences
personnelles et refus de stockage préservés. Fusion le 16/11 à 15:04:49 UTC,
`456e844152a5be65598e891c9c53b8fb619524f0`, sans publication Pages.

### Modifié — [#63](https://github.com/Vladoche/mon-bprea/pull/63), UC et lecture PR3 lot 1

Chapitres et cartes de cours délimités, unités vides, typographie de lecture,
sommaire interne, tableaux défilants et fin de cours. Contenus, ressources,
progression et synchronisation conservés ; interfaces QCM/Drill/statistiques
hors refonte. Fusion le 16/11 à 14:38:57 UTC,
`9de353168d5ddc9a9ecd02ac7fdaa6f0e1bc9d98`, sans publication Pages.
[Validation](docs/validations/VALIDATION-UI-2027-PR3-LOT1.md).

### Documenté — [#62](https://github.com/Vladoche/mon-bprea/pull/62), état et historique

État central du projet, changelog, registre Pages et guides synchronisés avec le
code. Fusion le 16/11 à 13:53:25 UTC, `ae1d66f8c98360928d64a395a155c52f8eb972f4`.
Cette maintenance ne publie pas le site et ne renouvelle pas les preuves PROD.

### Corrigé — [#61](https://github.com/Vladoche/mon-bprea/pull/61), PR2b/PR2c

Accueil panoramique avec visuel local, carnets et hubs harmonisés ; menus ancrés
à leurs contrôles, états actif/ouvert distincts et hover stable. URL, données et
calculs conservés. [Validation](docs/validations/VALIDATION-UI-2027-PR2B.md).

## 2026-11-15

### Modifié — [#60](https://github.com/Vladoche/mon-bprea/pull/60), accueil et hubs PR2

Refonte de l’accueil, Mes cours, S’exercer et Outils, avec progression et reprise
fiables. Anecdote réservée à Mes cours, bandeau d’examen retiré de l’accueil et
commandes détaillées cours/QCM déplacées dans Profil ; sauvegardes automatiques
conservées. [Validation](docs/validations/VALIDATION-UI-2027-PR2.md).

### Ajouté — [#59](https://github.com/Vladoche/mon-bprea/pull/59), fondations graphiques PR1

Tokens, header/footer communs, navigation, paramètres d’apparence dans Profil et
harmonisation de Contact/Confidentialité sans changement du texte approuvé.
[Validation](docs/validations/VALIDATION-UI-2027-PR1.md).

### Ajouté — [#58](https://github.com/Vladoche/mon-bprea/pull/58), Admin Windows V1.2

Préparation graphique de clôture, journal compatible et stockage Auth Windows
facultatif. **Suppression PROD bloquée** dans la distribution ; exécuteur testé
uniquement sur stack fictive locale. [Guide et limites](tools/mon-bprea-admin/README.md).

## 2026-11-14

### Ajouté — [#57](https://github.com/Vladoche/mon-bprea/pull/57), Admin Windows V1.1

Récupération assistée d’un compte confirmé sélectionné, contrôles d’identité,
lien privé et journal durable partagé avec le circuit Node.
[Guide](tools/mon-bprea-admin/README.md).

## 2026-11-12

### Ajouté — [#56](https://github.com/Vladoche/mon-bprea/pull/56), Admin Windows V1

Application autonome pour consulter les comptes Auth et inviter individuellement,
avec préflight, confirmation et conservation privée des opérations.
[Guide et distribution](tools/mon-bprea-admin/README.md).

## 2026-11-08

### Qualifié — [#55](https://github.com/Vladoche/mon-bprea/pull/55), circuit de clôture

Circuit opérateur droits/clôture, suppression native et réconciliation après
restauration qualifiés avec comptes fictifs isolés ; aucune suppression réelle
PROD. [Preuves](docs/deploiement/EXPLOITATION-PRIVEE-SIX-ADULTES.md#qualification-opérationnelle-de-p0-13--8-novembre-2026).

### Qualifié — [#54](https://github.com/Vladoche/mon-bprea/pull/54), sauvegarde applicative

Premier point applicatif des dix tables restauré et vérifié en PostgreSQL isolé.
RPO satisfait à cet instant ; Auth et reprise complète hébergée restent exclus.
[Preuve datée](docs/deploiement/EXPLOITATION-PRIVEE-SIX-ADULTES.md#point-de-reprise-applicatif-du-8-novembre-2026).

### Qualifié — [#53](https://github.com/Vladoche/mon-bprea/pull/53), premier compte réel

Activation de l’exploitant et persistance cours/QCM/Drill après reconnexion sur
deux navigateurs ; pas de second compte ni de récupération réelle qualifiés.
[Recette](docs/deploiement/PLAN-PREOUVERTURE-PRIVEE.md#recette-du-seul-compte-exploitant--8-novembre-2026).

### Corrigé / préparé — [#50](https://github.com/Vladoche/mon-bprea/pull/50), [#51](https://github.com/Vladoche/mon-bprea/pull/51), [#52](https://github.com/Vladoche/mon-bprea/pull/52)

Préparation du frontend Auth PROD et de la notice approuvée, verrouillage du
workflow sur lancement manuel autorisé, puis correction de la validation de
notice avant dépôt Pages. #52 consigne la première publication Auth réussie,
événement distinct tracé dans le [registre Pages](docs/deploiement/EXPLOITATION-PRIVEE-SIX-ADULTES.md#registre-de-publication-pages).

### Ajouté — [#49](https://github.com/Vladoche/mon-bprea/pull/49), Auth sur invitation

Configuration d’accès privé, inscriptions publiques et anonymat fermés, et
exécuteur administratif distinct de liens individuels. Aucun quota serveur
de sept comptes déduit du plafond administratif.
[Contrat et preuves Auth](docs/architecture/AUTHENTIFICATION.md).

## 2026-11-07

### Qualifié — [#48](https://github.com/Vladoche/mon-bprea/pull/48), installation initiale PROD

Installation autorisée P puis M1–M5 et contrôles de structure, permissions et RLS,
avec archive initiale préservée. La qualification locale préalable et les limites
de reprise restent distinctes des comportements hébergés.
[Runbook et résultat](docs/architecture/RUNBOOK-SUPABASE-PROD-6-6-0.md).
