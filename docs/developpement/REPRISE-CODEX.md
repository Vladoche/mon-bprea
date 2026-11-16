# Reprendre Mon BPREA avec Codex

Commencer par l’[état du projet](ETAT-DU-PROJET.md) : il porte le SHA main
vérifié, les jalons fusionnés, les PR ouvertes, la version publiée et les limites
d’exploitation. Le [changelog](../../CHANGELOG.md) porte l’historique des changements.

## Reprendre un chantier

1. Lire `git status`, les consignes et les faits datés de l’état du projet ;
   refaire `git fetch origin` et vérifier les PR pertinentes avant toute modification.
2. Créer une branche dédiée depuis la référence autorisée, préserver les travaux
   existants et consulter seulement les contrats utiles. [PR #63, lot 1 UC et
   lecture](https://github.com/Vladoche/mon-bprea/pull/63)
   est suivi sur `feat/ui-2027-learning-experience`, mise à jour après la fusion
   documentaire #62 ; consulter sa validation et l’état central avant de continuer.
3. Prochain chantier fonctionnel : revue de **PR3 lot 1**, puis suites QCM/Drill/
   statistiques sur la même branche selon le périmètre autorisé ; PR4 outils
   spécialisés et PR5 profil/harmonisation suivent. La cible initiale du
   13 novembre 2026 est passée.
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
| Application Windows V1.2 et blocage de suppression PROD | [Guide Admin](../../tools/mon-bprea-admin/README.md) |
| Entretien du poste | [Maintenance de `.tmp`](MAINTENANCE-DOSSIER-TMP.md) |
| Refonte UX/UI 2027 — UC et lecture, PR3 lot 1 | [Validation, composants et suite sur la même branche](../validations/VALIDATION-UI-2027-PR3-LOT1.md) |

La [fiche historique conservée](../archives/validations/REPRISE-CODEX-2026-11-14.md)
garde la traçabilité de l’installation, Auth, première utilisation, sauvegarde et
clôture, ainsi que les liens aux preuves originales. Les rapports restent dans
`docs/validations/` ou `docs/archives/validations/` selon leur campagne.

Ne pas transformer cette fiche en journal cumulatif : actualiser les repères et
liens si nécessaire, inscrire les changements significatifs dans le changelog et
les faits actuels dans l’état central. Les preuves techniques restent dans les
rapports ou la PR, avec leurs limites.
