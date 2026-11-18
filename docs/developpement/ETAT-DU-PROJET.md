# État du projet Mon BPREA

## A — Identification et sources

Mon BPREA est un site personnel de révision BPREA, facultatif et non commercial,
prévu pour un exploitant et six autres adultes invités. Frontend statique HTML,
CSS et modules JavaScript, sans Node.js à l’exécution ; Supabase Auth/PostgreSQL
pour les espaces personnels ; application opérateur Windows .NET/WinForms.

- Dépôt : [Vladoche/mon-bprea](https://github.com/Vladoche/mon-bprea).
- Site public : [Mon BPREA](https://vladoche.github.io/mon-bprea/).
- Périmètre : cours, QCM, exercices hebdomadaires, statistiques, calendrier,
  outils ITK/documentaires/botaniques et données personnelles synchronisées.
- Dernière vérification Git/PR et chantier local le **18 novembre 2026**.
  Le registre Pages conserve le relevé du **16 novembre à 13:10 UTC**.
  Les lectures PROD et contrôles Windows du 18 novembre figurent dans la
  [qualification de la première invitation](../validations/VALIDATION-PREMIERE-INVITATION-PROD.md).
- Sources : `git fetch origin`, code de `origin/main`, [PR GitHub](https://github.com/Vladoche/mon-bprea/pulls?q=is%3Apr),
  [historique Pages](https://github.com/Vladoche/mon-bprea/actions/workflows/deploy.yml),
  checks des têtes finales #58–#61, registre Pages, contrôles Auth/SQL en lecture
  seule et qualification Windows datée.

Ce fichier porte l’état actuel ; le [changelog](../../CHANGELOG.md) porte les
changements fusionnés, les rapports gardent leurs preuves datées et le
[registre de publication](../deploiement/EXPLOITATION-PRIVEE-SIX-ADULTES.md#registre-de-publication-pages)
porte les publications effectives. Une vérification documentaire ne renouvelle
pas une preuve opérationnelle.

## B — État du code

| Repère | État vérifié |
| --- | --- |
| Branche de référence | `origin/main` |
| Dernier commit | `e5607415b6cc8409d7b7cd1c2957338a4fcacf7e` |
| Dernière PR fusionnée | [#67](https://github.com/Vladoche/mon-bprea/pull/67), 17/11/2026 à 19:54:22 UTC |
| Jalons récents | Admin V1–V1.2 (#56–#58), fondations 2027 (#59), accueil/hubs (#60), fidélité visuelle et navigation PR2b/PR2c (#61), suivi documentaire (#62), UC/lecture PR3 lot 1 (#63), persistance clair/sombre (#64), QCM PR3 lot 2 (#65), Drill PR3 lot 3 (#66) |
| Chantier courant, non fusionné | **Admin 2.1**, [PR #68](https://github.com/Vladoche/mon-bprea/pull/68). [Guide](../../tools/mon-bprea-admin/README.md), [qualification](../validations/VALIDATION-PREMIERE-INVITATION-PROD.md) |
| Prochaine action | Finaliser les accès de sauvegarde dans Admin 2.1 et obtenir un point PROD restauré vérifié |

Le lot 1 modernise uniquement les pages UC et la lecture ; il est désormais
fusionné sur main. Les contenus pédagogiques, données et contrats de
synchronisation restent identiques. Les preuves locales et limites sont dans la
[validation PR3 lot 1](../validations/VALIDATION-UI-2027-PR3-LOT1.md).
Les quatre checks de sa tête finale `3dae6b0` ont réussi ; cette validation
ne vaut pas une recette hébergée. Le correctif #64 est fusionné depuis le
16/11 à 15:04:49 UTC ; ses quatre
[checks](https://github.com/Vladoche/mon-bprea/pull/64/checks) sont réussis sur
`6187c7d719c63765e47d3470da5fd6e580c59a40`. Les QCM #65 sont fusionnés le
16/11 à 18:52:04 UTC ; leur tête finale est `2e626256ade23dd2cc5173f596e8a375647c85ae`.
Voir leur [validation datée](../validations/VALIDATION-UI-2027-PR3-LOT2.md).
Le Drill #66 est fusionné depuis le 16/11 à 20:39:05 UTC ; sa tête de PR est
`9046ea6c54e4630d22747bd483b5f9c763df34a5`, sa fusion `7115b72`.
Sa [validation et ses captures](../validations/VALIDATION-UI-2027-PR3-LOT3.md)
restent distinctes d’une publication du frontend.

## C — Fusion, validation et publication

**Code fusionné** : main inclut #59–#67. **Code testé** : les têtes finales #59–#61, #63, #64 et #65
ont les quatre checks `unit-integration`, `e2e`, `ui-performance-lab` et
`supabase-security` réussis ; ces résultats qualifient ces têtes de PR, sans
revendiquer une nouvelle campagne sur le commit de fusion. Pour #61 :
[`bcd137fff56a124dc20cae8e1d82e1ec6847a690`, Qualité](https://github.com/Vladoche/mon-bprea/actions/runs/43837925913)
et [sécurité sur stack éphémère](https://github.com/Vladoche/mon-bprea/actions/runs/43837926222).
Les [rapports PR1](../validations/VALIDATION-UI-2027-PR1.md),
[PR2](../validations/VALIDATION-UI-2027-PR2.md) et
[PR2b/PR2c](../validations/VALIDATION-UI-2027-PR2B.md) détaillent périmètres et limites.

**Code publié** et **production vérifiée** restent distincts :

| Information | Valeur |
| --- | --- |
| Dernier commit main | `e5607415b6cc8409d7b7cd1c2957338a4fcacf7e` |
| Dernier déploiement réussi | 08/11/2026, job terminé à **15:34:30 UTC** |
| Commit publié | `3952fd5a98705397bb341dc1fa54e0e8f92979d8` |
| Workflow de publication | [Pages #64, exécution 42495467393](https://github.com/Vladoche/mon-bprea/actions/runs/42495467393), `workflow_dispatch`, succès |
| Écart main/publication | **Présent**, dont la refonte UX/UI 2027 |
| Recette hébergée | 08/11 : parcours sans compte, puis cours/QCM/Drill et persistance de l’exploitant sur deux navigateurs ; [preuve](../deploiement/PLAN-PREOUVERTURE-PRIVEE.md#recette-du-seul-compte-exploitant--8-novembre-2026) |
| Lecture publique du 16/11 | Accueil : ressources `?v=3952fd5…` ; configuration servie : `enabled: true`, `environment: production`. Ce relevé HTTP limité ne constitue pas une recette connectée |
| Publication des PR UX/UI 2027 | **Non publiée selon le dernier workflow et le relevé HTTP** |

Le fichier `assets/auth-config.json` **versionné reste désactivé**. L’artefact
Pages utilise une configuration publique PROD générée et validée séparément.
Un build, un E2E local, un check de PR ou une fusion ne publie pas le site.
Le [workflow actuel](../../.github/workflows/deploy.yml) exige un lancement
manuel autorisé sur main ; voir le registre pour la procédure et la recette.

## D — Modules

État du code fusionné, sans présumer sa publication :

| Module | État / dernier jalon majeur | Limites importantes | Référence |
| --- | --- | --- | --- |
| Navigation et accueil | Header/footer 2027, accueil panoramique ; #59–#61 | Refonte non publiée ; reprise seulement depuis une activité datée fiable | [Navigation](../architecture/NAVIGATION.md) |
| Mes cours | Sept UC/UCARE, progression réelle, anecdote après les UC ; #60 | Cours disponibles dans la seule UC 03 | [Architecture](../architecture/ARCHITECTURE.md) |
| Pages UC | Chapitres ouverts, cartes et unités vides modernisés ; #63 | Refonte fusionnée ; cours dans la seule UC 03 | [Validation PR3](../validations/VALIDATION-UI-2027-PR3-LOT1.md) |
| Lecture des cours | Sommaire interne et mise en page de lecture ; #63 | Quatre cours illustratifs UC 03, complétion et persistance conservées | [Validation PR3](../validations/VALIDATION-UI-2027-PR3-LOT1.md) |
| QCM | Présentation 2027 PR3 lot 2 fusionnée #65, contrats historiques conservés | Refonte non publiée ; anciens scores sans date non transformés en activité récente | [Cours/QCM](../architecture/COURSE-QUIZ-SYNCHRONISATION-CLIENT.md) |
| Drill | Dix nouveaux exercices par UC/semaine, brouillons et entraînements séparés | Banque surtout UC 03 ; séries précédentes non bloquantes | [Mode Drill](../architecture/MODE-DRILL.md) |
| Tableau de bord | Statistiques des premières réponses Drill, synthèse partagée | Réussite calculée sur les seuls exercices réalisés, sans gamification | [Dashboard](../architecture/DASHBOARD.md) |
| Calendrier | Événements civils et liens directs | Banque de dates vide ; aucune date de formation inventée | [Événements](../architecture/ARCHITECTURE.md#modifier-les-événements-et-les-examens) |
| Générateur ITK | Génération, CSV, impression et réglages personnels | Repère pédagogique sans prescription | [ITK/apparence](../architecture/ITK-APPEARANCE-SYNCHRONISATION-CLIENT.md) |
| Ressources | Catalogue filtrable et PDF publics | Références éditoriales à entretenir | [Ressources](../architecture/RESSOURCES.md) |
| Reconnaissance botanique | Jeu et historique personnel/visiteur | Douze espèces ; entraînement illustratif | [Botanique](../architecture/RECONNAISSANCE-PLANTES.md) |
| Mon profil | Compte, paramètres, export/restauration et retrait local ; #59/#60 | Retrait local distinct d’une clôture serveur | [Auth](../architecture/AUTHENTIFICATION.md) |
| Apparence | Icône clair/sombre, dialogue dans Profil → Paramètres ; #59 | Mémorisation appareil volontaire ; anciennes clés conservées | [Thèmes](../architecture/THEMES.md) |
| Synchronisation | Cours/QCM, Drill, botanique, ITK/apparence | Import volontaire, conflits et opérations en attente conservés ; confirmation distante requise | [Architecture](../architecture/ARCHITECTURE.md#stockage-et-conservation-des-données) |
| Authentification | Activation sur invitation, connexion et récupération assistée ; #49–#51 | Inscription publique/anonyme fermées ; pas de récupération réelle ni isolation A/B PROD recettées | [Auth](../architecture/AUTHENTIFICATION.md) |
| Admin Windows | V1.2 fusionnée #58, quatre checks réussis dont `admin-windows` | Exécutable non signé ; suppression PROD techniquement bloquée | [Guide Admin](../../tools/mon-bprea-admin/README.md) |

## E — Sécurité et exploitation

- **Accès**. Le relevé PROD du 18 novembre confirme les inscriptions publiques et
  anonymes fermées et un compte confirmé. La limite de sept comptes repose sur
  le circuit administratif. [Contrôles et portée](../validations/VALIDATION-PREMIERE-INVITATION-PROD.md).
- **Backend PROD** : installation P puis M1–M5 documentée le 07/11 ; dix tables
  avec RLS et permissions contrôlées, premier compte et synchronisations vérifiés
  le 08/11. [Runbook et limites](../architecture/RUNBOOK-SUPABASE-PROD-6-6-0.md).
  Ces constats datés ne certifient pas l’état courant du service hébergé.
- **Admin V1.2** : consultation, invitation, récupération, préparation de clôture,
  journal et mémorisation Auth Windows facultative. La distribution ne peut pas
  supprimer en PROD, faute de canal PostgreSQL de confiance et de liaison complète
  aux preuves de sauvegarde/journal ; aucun paramètre ne contourne ce blocage.
- **Admin V2, fusionné (#67)** : trois actions graphiques, clé mémorisée automatiquement
  dans Windows, liens DPAPI et contrôles techniques intégrés, sans cases d’attestation
  ni consentement inventé. Le changement d’adresse est une confirmation administrative
  après vérification du titulaire par un canal connu ; il conserve l’UUID. La recette
  du binaire autonome sur stack locale fictive couvre création/activation, récupération
  combinée et suppression d’A, dix tables et sessions/refresh vides, B préservé et
  restauration réconciliée. **Suppression PROD toujours bloquée** : l’architecture
  proposée n’a créé aucun rôle, privilège ou service hébergé. La durée des liens PROD
  reste inconnue dans l’application faute de canal de configuration qualifié.
  [Validation et limites](../validations/VALIDATION-ADMIN-V2.md). Les 2 524 assertions
  C#, 33 contrôles WinForms et 640 tests Node réussis (un ignoré) concernent la
  qualification locale V2 du 17 novembre.
- **Admin 2.1**. Historique opérateur raccordé en place et relu sur le poste Windows.
  Le garde de création exige un point restauré frais. La saisie initiale des accès
  PROD et la qualification de la nouvelle sauvegarde restent nécessaires.
- **Sauvegarde** : dernier point applicatif documenté **08/11/2026 à 20:48:37 UTC**,
  restauré et vérifié en PostgreSQL isolé à 20:58 UTC. Objectif satisfait à cet
  instant seulement. Politique : intervalle entre points valides/restaurés ≤168 h,
  avertissement à 144 h, deux générations utiles, rétention ordinaire de 14 jours
  selon les décisions approuvées. Le point documenté dépasse désormais 168 h.
  La relecture du 18 novembre confirme son intégrité et l’échéance dépassée
  le 15 novembre à 21:48 CET. [Routine et preuve](../deploiement/EXPLOITATION-PRIVEE-SIX-ADULTES.md#sauvegarde-hebdomadaire-et-rpo).
- **Reprise et clôture** : restauration applicative partielle qualifiée ; Auth,
  Storage, configuration et données non synchronisées exclus. Reprise Auth/service
  hébergé et RTO non démontrés. Circuit de clôture qualifié sur données fictives
  isolées, aucune suppression réelle PROD revendiquée ; réconciliation du journal,
  copies et appareils à traiter pour chaque demande réelle.
- **Décisions humaines** : aucune décision d’ouverture aux six autres adultes
  retrouvée dans les sources consultées. La matrice préparatoire 15/15 du 08/11
  ne l’autorise pas. Publication, invitations et opérations sensibles exigent leurs
  accords propres ; voir le [plan et ses preuves](../deploiement/PLAN-PREOUVERTURE-PRIVEE.md).

## F — Prochaines actions

1. Finaliser la [qualification de la première invitation](../validations/VALIDATION-PREMIERE-INVITATION-PROD.md)
   dans **Admin 2.1**, puis revoir le verdict sur la preuve réelle.
   Le lot 4 tableau de bord/statistiques reste une décision distincte.
2. Prévoir **PR4, outils spécialisés**, puis **PR5, profil et harmonisation finale**.
   Ce sont des chantiers prévus, sans fusion ni livraison anticipée.
3. Décider séparément d’une publication du code fusionné, puis appliquer le
   workflow autorisé, consigner son SHA et effectuer une recette hébergée ciblée.
4. Obtenir les décisions individuelles et d’ouverture nécessaires après la
   qualification technique.

La cible initiale du 13 novembre 2026 est passée. Elle ne devient ni une nouvelle
échéance future ni une autorisation de publication ou d’ouverture.
