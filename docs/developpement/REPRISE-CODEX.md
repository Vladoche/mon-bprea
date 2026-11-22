# Reprendre Mon BPREA avec Codex

Commencer par l’[état du projet](ETAT-DU-PROJET.md) pour connaître le code
fusionné, le site publié, les preuves disponibles et les prochaines actions.

## Reprendre un chantier

1. Lire [AGENTS.md](../../AGENTS.md), exécuter `npm run git:preflight` depuis
   une révision qui contient le script, actualiser les références distantes
   et vérifier les PR pertinentes.
2. Créer une branche dédiée depuis la référence vérifiée. Préserver les travaux
   en cours et lire les contrats et procédures indiqués ci-dessous.
3. Pour une livraison, contrôler ce qui a changé, actualiser les références
   concernées et consulter le [changelog](../../CHANGELOG.md). Pour une
   affirmation sur le site servi, vérifier le
   [registre Pages](../deploiement/EXPLOITATION-PRIVEE.md#registre-de-publication-pages)
   et ses preuves.

## Lire selon le chantier

| Besoin | Référence |
| --- | --- |
| Organisation et navigation | [Architecture](../architecture/ARCHITECTURE.md), [navigation](../architecture/NAVIGATION.md) |
| Apparence | [Thèmes](../architecture/THEMES.md) |
| Code et contrôles | [Conventions de test](../TESTS.md) |
| Auth et persistance | [Auth](../architecture/AUTHENTIFICATION.md), contrats de domaine liés depuis l’architecture |
| Exploitation, sauvegarde et clôture | [Procédures et registre Pages](../deploiement/EXPLOITATION-PRIVEE.md), [matrice préparatoire](../deploiement/PLAN-PREOUVERTURE-PRIVEE.md) |
| Installation PROD et reprise SQL | [Runbook et preuves](../architecture/RUNBOOK-SUPABASE-PROD-6-6-0.md) |
| Application Windows V2 et blocage de suppression PROD | [Guide utilisateur](../../tools/mon-bprea-admin/README.md), [architecture](../../tools/mon-bprea-admin/DEVELOPPEMENT.md) |
| Entretien du poste | [Maintenance de `.tmp`](MAINTENANCE-DOSSIER-TMP.md) |

La [fiche historique conservée](../archives/validations/REPRISE-CODEX-2026-11-14.md)
garde la traçabilité de l’installation, Auth, première utilisation, sauvegarde et
clôture, ainsi que les liens aux preuves originales. Les rapports restent dans
`docs/validations/` ou `docs/archives/validations/` selon leur campagne.
