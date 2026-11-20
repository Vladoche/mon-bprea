# Reprendre Mon BPREA avec Codex

Commencer par l’[état du projet](ETAT-DU-PROJET.md) : il porte le SHA main
vérifié, les jalons fusionnés, les PR ouvertes, la version publiée et les limites
d’exploitation. Le [changelog](../../CHANGELOG.md) porte l’historique des changements.

## Reprendre un chantier

1. Lire `git status`, les consignes et les faits datés de l’état du projet ;
   refaire `git fetch origin` et vérifier les PR pertinentes avant toute modification.
2. Créer une branche dédiée depuis la référence autorisée, préserver les travaux
   existants et consulter seulement les contrats utiles. [PR #63, lot 1 UC et
   lecture](https://github.com/Vladoche/mon-bprea/pull/63) est fusionnée sur main
   depuis le 16/11. Le [correctif d’apparence #64](https://github.com/Vladoche/mon-bprea/pull/64)
   est fusionné depuis le 16/11 à 15:04:49 UTC (`456e844`).
3. Le [Drill PR3 lot 3, #66](https://github.com/Vladoche/mon-bprea/pull/66) est
   fusionné depuis le 16/11 à 20:39:05 UTC (`7115b72`), après les QCM #65.
   [Admin V2 #67](https://github.com/Vladoche/mon-bprea/pull/67) a fusionné le
   17/11 sur `e560741`. [Admin 2.1 #68](https://github.com/Vladoche/mon-bprea/pull/68)
   a fusionné après la [qualification de la première invitation](../validations/VALIDATION-PREMIERE-INVITATION-PROD.md).
   [Admin 2.2 #70](https://github.com/Vladoche/mon-bprea/pull/70) couvre le renouvellement des invitations expirées.
   Le [guide](../../tools/mon-bprea-admin/README.md) décrit l’assistant et la vérification Auth.
   La refonte graphique s’est achevée avec [#78](https://github.com/Vladoche/mon-bprea/pull/78).
   La [recette finale](../validations/VALIDATION-RECETTE-FINALE-2027.md) et le
   [plan de publication](../deploiement/PLAN-PUBLICATION-2027.md) portent les
   résultats et les décisions 2027 encore attendues.
4. Séparer code fusionné, code testé, code publié et recette hébergée. Consulter le
   [registre Pages](../deploiement/EXPLOITATION-PRIVEE-SIX-ADULTES.md#registre-de-publication-pages)
   avant d’affirmer une publication. L’écart de publication et la fraîcheur de
   sauvegarde sont suivis dans l’état central, sans les déduire de la CI.

## Règles essentielles

Appliquer [AGENTS.md](../../AGENTS.md). Pas de mutation PROD, invitation réelle,
fusion ou déploiement sans accord correspondant. Auth sur invitation, inscriptions
publiques/anonymes fermées ; configuration Auth versionnée désactivée, secrets et
liens Auth privés. Préserver données, outbox et clés ; import volontaire et
déconnexion sans effacement. Tests Auth/RLS réels uniquement sur stack locale
fictive. Aucun nettoyage des sauvegardes ou preuves protégées.

## Lire selon le chantier

| Besoin | Référence |
| --- | --- |
| Organisation et navigation | [Architecture](../architecture/ARCHITECTURE.md), [navigation](../architecture/NAVIGATION.md) |
| Apparence | [Thèmes](../architecture/THEMES.md) |
| Code et contrôles | [Conventions de test](../TESTS.md) |
| Auth et persistance | [Auth](../architecture/AUTHENTIFICATION.md), contrats de domaine liés depuis l’architecture |
| Exploitation, sauvegarde et clôture | [Procédures et registre Pages](../deploiement/EXPLOITATION-PRIVEE-SIX-ADULTES.md), [matrice préparatoire](../deploiement/PLAN-PREOUVERTURE-PRIVEE.md) |
| Installation PROD et reprise SQL | [Runbook et preuves](../architecture/RUNBOOK-SUPABASE-PROD-6-6-0.md) |
| Application Windows V2 et blocage de suppression PROD | [Guide utilisateur](../../tools/mon-bprea-admin/README.md), [architecture](../../tools/mon-bprea-admin/DEVELOPPEMENT.md) |
| Entretien du poste | [Maintenance de `.tmp`](MAINTENANCE-DOSSIER-TMP.md) |
| Refonte UX/UI 2027 — Drill, PR3 lot 3 | [Validation et revue](../validations/VALIDATION-UI-2027-PR3-LOT3.md) |
| Refonte UX/UI 2027 — QCM de cours, PR3 lot 2 | [Validation et revue](../validations/VALIDATION-UI-2027-PR3-LOT2.md) |
| Refonte UX/UI 2027 — UC et lecture, PR3 lot 1 | [Validation et composants](../validations/VALIDATION-UI-2027-PR3-LOT1.md) |

La [fiche historique conservée](../archives/validations/REPRISE-CODEX-2026-11-14.md)
garde la traçabilité de l’installation, Auth, première utilisation, sauvegarde et
clôture, ainsi que les liens aux preuves originales. Les rapports restent dans
`docs/validations/` ou `docs/archives/validations/` selon leur campagne.

Ne pas transformer cette fiche en journal cumulatif : actualiser les repères et
liens si nécessaire, inscrire les changements significatifs dans le changelog et
les faits actuels dans l’état central. Les preuves techniques restent dans les
rapports ou la PR, avec leurs limites.
