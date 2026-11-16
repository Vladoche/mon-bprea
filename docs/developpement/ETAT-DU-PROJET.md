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
- Dernière vérification Git/PR et correctif local : **16 novembre 2026**.
  Les relevés Pages/HTTP ci-dessous restent ceux de **13:10 UTC** ; aucune
  nouvelle recette hébergée ni lecture de sauvegarde dans cette intervention.
- Sources : `git fetch origin`, code de `origin/main`, [PR GitHub](https://github.com/Vladoche/mon-bprea/pulls?q=is%3Apr),
  [historique Pages](https://github.com/Vladoche/mon-bprea/actions/workflows/deploy.yml),
  checks des têtes finales #58–#61, lectures HTTP publiques de l’accueil et de sa
  configuration Auth ; rapports et contrats liés ci-dessous. Aucun accès aux
  sauvegardes privées ni contrôle Supabase hébergé dans cette revue.

Ce fichier porte l’état actuel ; le [changelog](../../CHANGELOG.md) porte les
changements fusionnés, les rapports gardent leurs preuves datées et le
[registre de publication](../deploiement/EXPLOITATION-PRIVEE-SIX-ADULTES.md#registre-de-publication-pages)
porte les publications effectives. Une vérification documentaire ne renouvelle
pas une preuve opérationnelle.

## B — État du code

| Repère | État vérifié |
| --- | --- |
| Branche de référence | `origin/main` |
| Dernier commit | `ae1d66f8c98360928d64a395a155c52f8eb972f4` |
| Dernière PR fusionnée | [#62](https://github.com/Vladoche/mon-bprea/pull/62), 16/11/2026 à 13:53:25 UTC |
| Jalons récents | Admin V1–V1.2 (#56–#58), fondations 2027 (#59), accueil/hubs (#60), fidélité visuelle et navigation PR2b/PR2c (#61) |
| PR ouverte | [#63](https://github.com/Vladoche/mon-bprea/pull/63), PR3 lot 1 UC/lecture, non fusionnée |
| Correctif ouvert | [#64](https://github.com/Vladoche/mon-bprea/pull/64), mode clair/sombre conservé à la navigation ; `codex/fix-appearance-navigation`, branche distincte de PR3, non fusionnée |
| Prochain chantier | Revue du correctif d’apparence et de PR3 lot 1 ; lots pédagogiques suivants selon autorisation |

PR3 lot 1 est commitée et poussée en #63, tête `3dae6b0`, avec quatre checks
réussis ; elle reste ouverte sans publication. Le correctif d’apparence est
indépendant, issu de main après #62 : clic lune/soleil conservé en visiteur avec
la clé existante, sans modifier les contrats personnels. Voir les
[règles d’apparence et tests ciblés](../architecture/THEMES.md).

## C — Fusion, validation et publication

**Code fusionné** : main inclut #59–#62. **Code testé** : les têtes finales #59–#61
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
| Dernier commit main | `ae1d66f8c98360928d64a395a155c52f8eb972f4` |
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
| Pages UC | UC, chapitres et liens existants | Refonte PR3 en préparation locale | [Navigation](../architecture/NAVIGATION.md) |
| Lecture des cours | Quatre cours UC 03, complétion et persistance | Contenus illustratifs ; PR3 à poursuivre | [Cours/QCM](../architecture/COURSE-QUIZ-SYNCHRONISATION-CLIENT.md) |
| QCM | Corrections, meilleurs scores et tentatives historisées | Anciens scores sans date non transformés en activité récente | [Cours/QCM](../architecture/COURSE-QUIZ-SYNCHRONISATION-CLIENT.md) |
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

- **Accès** : invitation native depuis le circuit administratif de confiance ;
  inscriptions publiques et connexions anonymes désactivées selon les preuves du
  08/11. Sept comptes au plus par règle administrative, sans quota serveur.
  Aucun nouveau relevé des réglages ou de la population PROD dans cette revue.
- **Backend PROD** : installation P puis M1–M5 documentée le 07/11 ; dix tables
  avec RLS et permissions contrôlées, premier compte et synchronisations vérifiés
  le 08/11. [Runbook et limites](../architecture/RUNBOOK-SUPABASE-PROD-6-6-0.md).
  Ces constats datés ne certifient pas l’état courant du service hébergé.
- **Admin V1.2** : consultation, invitation, récupération, préparation de clôture,
  journal et mémorisation Auth Windows facultative. La distribution ne peut pas
  supprimer en PROD, faute de canal PostgreSQL de confiance et de liaison complète
  aux preuves de sauvegarde/journal ; aucun paramètre ne contourne ce blocage.
- **Sauvegarde** : dernier point applicatif documenté **08/11/2026 à 20:48:37 UTC**,
  restauré et vérifié en PostgreSQL isolé à 20:58 UTC. Objectif satisfait à cet
  instant seulement. Politique : intervalle entre points valides/restaurés ≤168 h,
  avertissement à 144 h, deux générations utiles, rétention ordinaire de 14 jours
  selon les décisions approuvées. Le point documenté dépasse désormais 168 h.
  **Fraîcheur actuelle non vérifiée — contrôle opérateur nécessaire.** Aucune
  conclusion sur l’existence de nouvelles copies privées ; aucune archive privée
  lue ici. [Routine et preuve](../deploiement/EXPLOITATION-PRIVEE-SIX-ADULTES.md#sauvegarde-hebdomadaire-et-rpo).
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

1. Examiner le correctif clair/sombre et **PR3 lot 1, UC/lecture**, avec leurs
   checks et captures, sans fusion automatique ; poursuivre ensuite les autres
   parcours pédagogiques selon le périmètre autorisé.
2. Prévoir **PR4, outils spécialisés**, puis **PR5, profil et harmonisation finale**.
   Ce sont des chantiers prévus, sans fusion ni livraison anticipée.
3. Décider séparément d’une publication du code fusionné, puis appliquer le
   workflow autorisé, consigner son SHA et effectuer une recette hébergée ciblée.
4. Faire contrôler par l’opérateur la fraîcheur des sauvegardes et les prérequis
   d’exploitation ; obtenir les décisions individuelles et d’ouverture nécessaires.

La cible initiale du 13 novembre 2026 est passée. Elle ne devient ni une nouvelle
échéance future ni une autorisation de publication ou d’ouverture.
