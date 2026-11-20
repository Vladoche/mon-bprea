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
- Dernière vérification Git/PR et lecture publique Pages le **20 novembre 2026**.
  La recette de préproduction 2027 est consignée dans la [validation](../validations/VALIDATION-RECETTE-FINALE-2027.md).
  Les lectures PROD et contrôles Windows du 18 novembre figurent dans la
  [qualification de la première invitation](../validations/VALIDATION-PREMIERE-INVITATION-PROD.md).
- Sources : `git fetch origin`, code de `origin/main`, [PR GitHub](https://github.com/Vladoche/mon-bprea/pulls?q=is%3Apr),
  [historique Pages](https://github.com/Vladoche/mon-bprea/actions/workflows/deploy.yml),
  checks des têtes de PR, HTTP public Pages, contrôles Auth/SQL en lecture
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
| Dernier commit vérifié | `bb3514efecbc4edd85b7e3f3fde90bb5d69ed458` |
| Dernière PR fusionnée sur main | [#79, recette finale 2027](https://github.com/Vladoche/mon-bprea/pull/79), 20/11/2026 à 07:09:33 UTC. Quatre checks réussis à la tête de la PR. |
| Jalons récents | Admin V1–V1.2 (#56–#58), fondations 2027 (#59), accueil/hubs (#60), fidélité visuelle et navigation PR2b/PR2c (#61), suivi documentaire (#62), UC/lecture PR3 lot 1 (#63), persistance clair/sombre (#64), QCM PR3 lot 2 (#65), Drill PR3 lot 3 (#66) |
| Chantier en revue | [PR #80, approbation de la notice et préparation de la publication](https://github.com/Vladoche/mon-bprea/pull/80) · [Validation](../validations/VALIDATION-APPROBATION-NOTICE-V1-2.md) · [Checklist](../validations/CHECKLIST-RECETTE-FINALE-2027.md) |
| Prochaine action | Revoir et intégrer le dossier d’approbation, contrôler le SHA final et confirmer les prérequis du [plan de publication](../deploiement/PLAN-PUBLICATION-2027.md) avant décision. |

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

**Code fusionné.** Main inclut les lots graphiques jusqu’à #78 et la recette de préproduction #79, dont la notice V1.2 et son rendu.
**Code testé** : les têtes finales #59–#61, #63, #64 et #65
ont les quatre checks `unit-integration`, `e2e`, `ui-performance-lab` et
`supabase-security` réussis ; ces résultats qualifient ces têtes de PR, sans
revendiquer une nouvelle campagne sur le commit de fusion. Pour #61 :
[`bcd137fff56a124dc20cae8e1d82e1ec6847a690`, Qualité](https://github.com/Vladoche/mon-bprea/actions/runs/43837925913)
et [sécurité sur stack éphémère](https://github.com/Vladoche/mon-bprea/actions/runs/43837926222).
Les [rapports PR1](../validations/VALIDATION-UI-2027-PR1.md),
[PR2](../validations/VALIDATION-UI-2027-PR2.md) et
[PR2b/PR2c](../validations/VALIDATION-UI-2027-PR2B.md) détaillent périmètres et limites.
Les quatre checks de la [refonte botanique #74](https://github.com/Vladoche/mon-bprea/pull/74/checks)
ont réussi sur `daadf53`. La [validation du lot 4](../validations/VALIDATION-UI-2027-PR4-LOT4.md) conserve les résultats détaillés.
La tête `b4f0a4c` du [profil simplifié #77](https://github.com/Vladoche/mon-bprea/pull/77/checks)
a passé Qualité et Sécurité Auth/RLS. Les quatre checks de #78 ont réussi sur
`293e7645b15fc8f4e54577dcd5d1e39945352fa2`.
[Validation PR5 lot 2](../validations/VALIDATION-UI-2027-PR5-LOT2.md) ·
Les quatre [checks de la recette finale #79](https://github.com/Vladoche/mon-bprea/pull/79/checks)
ont réussi sur `a0074308aefebd146ce54f4d02646d18541df61b`.

**Code publié** et **production vérifiée** restent distincts :

| Information | Valeur |
| --- | --- |
| Dernier commit main relevé | `bb3514efecbc4edd85b7e3f3fde90bb5d69ed458` |
| Dernier déploiement réussi | 08/11/2026, job terminé à **15:34:30 UTC** |
| Commit publié | `3952fd5a98705397bb341dc1fa54e0e8f92979d8` |
| Workflow de publication | [Pages #64, exécution 42495467393](https://github.com/Vladoche/mon-bprea/actions/runs/42495467393), `workflow_dispatch`, succès |
| Écart main/publication | **100 commits**, dont la refonte UX/UI 2027, le profil simplifié et la notice V1.2 |
| Recette hébergée | 08/11 : parcours sans compte, puis cours/QCM/Drill et persistance de l’exploitant sur deux navigateurs ; [preuve](../deploiement/PLAN-PREOUVERTURE-PRIVEE.md#recette-du-seul-compte-exploitant--8-novembre-2026) |
| Lecture publique du 20/11 | Neuf routes HTTP 200 pendant la recette #79. Relecture pendant la qualification V1.2 : Contact et notice répondent en HTTP 200. La notice servie reste la V1.1 avec `?v=3952fd5…`. |
| Publication 2027 | **Publication non autorisée.** Notice V1.2 approuvée le 20/11/2026 à 08:27:51 CET, attestation privée `NOTICE-V12-20261120`. La recette hébergée authentifiée requiert son propre mandat. [Empreinte et décision](../validations/CORRECTIONS-PREPUBLICATION-2027.md#fiche-dapprobation). |

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
| Tableau de bord | Présentation 2027 fusionnée en PR3 lot 4 (#69), statistiques Drill et synthèse partagée | Les indicateurs portent sur les premières réponses validées. [Validation du lot 4](../validations/VALIDATION-UI-2027-PR3-LOT4.md) | [Dashboard](../architecture/DASHBOARD.md) |
| Calendrier | Interface 2027 fusionnée dans #71, événements civils et liens directs | Banque de dates vide ; aucune date de formation inventée | [Validation du calendrier](../validations/VALIDATION-UI-2027-PR4-LOT1.md) |
| Générateur ITK | Interface 2027 fusionnée dans #72, génération, CSV, impression et réglages personnels | Repère pédagogique sans prescription | [Validation du générateur](../validations/VALIDATION-UI-2027-PR4-LOT2.md) |
| Ressources | Bibliothèque, filtres et aperçus de cours et d’UC harmonisés dans #73 | Références éditoriales à entretenir | [Validation de la bibliothèque](../validations/VALIDATION-UI-2027-PR4-LOT3.md) |
| Reconnaissance botanique | Refonte 2027 fusionnée dans #74. Photothèque enrichie intégrée dans #76 | 24 plantes et série Légumineuses sur main | [Botanique](../architecture/RECONNAISSANCE-PLANTES.md) |
| Mon profil | Compte, paramètres et suivi des cours/QCM depuis #77 | Copie et effacement via le contact officiel dans le frontend 2027 | [Auth](../architecture/AUTHENTIFICATION.md) |
| Apparence | Icône clair/sombre, dialogue dans Profil → Paramètres ; #59 | Mémorisation appareil volontaire ; anciennes clés conservées | [Thèmes](../architecture/THEMES.md) |
| Synchronisation | Cours/QCM, Drill, botanique, ITK/apparence | Import volontaire, conflits et opérations en attente conservés ; confirmation distante requise | [Architecture](../architecture/ARCHITECTURE.md#stockage-et-conservation-des-données) |
| Authentification | Activation sur invitation, connexion et récupération assistée ; #49–#51 | Inscription publique/anonyme fermées ; pas de récupération réelle ni isolation A/B PROD recettées | [Auth](../architecture/AUTHENTIFICATION.md) |
| Admin Windows | 2.1 fusionnée (#68) avec reprise de l’historique et sauvegarde restaurée. Renouvellement des invitations expirées fusionné en 2.2 (#70) | Exécutable non signé. Suppression PROD bloquée | [Guide Admin](../../tools/mon-bprea-admin/README.md) |

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
- **Admin 2.1**. Historique opérateur raccordé en place et relu sur le poste
  Windows. Coffre et préflight réel validés. Le garde de création exige un
  point restauré frais. **GO technique pour la première invitation** au
  préflight du 18 novembre. [Qualification](../validations/VALIDATION-PREMIERE-INVITATION-PROD.md).
- **Admin 2.2**. L’expiration d’un lien signalée après ce préflight laisse le
  participant en attente sous Admin 2.1. Le renouvellement sur le même compte
  a été qualifié avec des comptes fictifs. La durée de 24 heures et le
  renouvellement réel restent à finaliser sur autorisation distincte. [Qualification 2.2](../validations/VALIDATION-ADMIN-INVITATIONS-EXPIREES.md).
- **Sauvegarde**. Le point PROD applicatif du **18/11/2026 à 13:09:16 CET**
  a été restauré et vérifié en PostgreSQL isolé à 13:09:41 CET. Échéance
  **25 novembre à 13:09:16 CET**. Le dépassement a commencé le 15 novembre
  à 21:48:37 CET, après le point du 8 novembre. L’alerte Admin 2.1 commence à
  132 h et le renouvellement à 144 h. Deux générations utiles et revue de
  rétention ordinaire à 14 jours. Archive et journal concordants au
  [contrôle local du 20/11](../validations/VALIDATION-APPROBATION-NOTICE-V1-2.md#prérequis-et-réserves).
  [Routine et preuve](../deploiement/EXPLOITATION-PRIVEE-SIX-ADULTES.md#sauvegarde-hebdomadaire-et-rpo).
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

1. Revoir et intégrer le [dossier d’approbation](../validations/VALIDATION-APPROBATION-NOTICE-V1-2.md).
   Statuer sur les réserves de performance du catalogue synthétique, de Safari
   et de lecteur d’écran natif avant la décision de publication.
2. Décider du réglage Auth PROD et de sa vérification, puis du renouvellement
   réel de l’invitation bloquée dans le cadre de la
   [validation Admin 2.2](../validations/VALIDATION-ADMIN-INVITATIONS-EXPIREES.md).
3. Recontrôler le point de reprise et les paramètres Auth, décider sur le SHA
   exact, puis suivre le [plan de publication 2027](../deploiement/PLAN-PUBLICATION-2027.md)
   si l’exploitant autorise la publication et sa recette hébergée.
4. Obtenir les décisions individuelles et d’ouverture nécessaires après la
   qualification technique.

La cible initiale du 13 novembre 2026 est passée. Elle ne devient ni une nouvelle
échéance future ni une autorisation de publication ou d’ouverture.
