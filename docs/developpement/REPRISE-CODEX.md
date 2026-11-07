# Reprendre Mon BPREA avec Codex

**Point de situation du 7 novembre 2026.** La [PR #42](https://github.com/Vladoche/mon-bprea/pull/42) est fusionnée dans `main` (`c0f2976`). Elle versionne M5 et le diagnostic de préparation. Les contrôles GitHub Qualité et Sécurité Auth/RLS de cette PR ont réussi. L’installation PROD et l’ouverture restent à valider.

**Cible du vendredi 13 novembre 2026.** Accès sur invitation uniquement, dans le cadre de la préouverture privée. Un invité doit pouvoir activer son compte, se connecter, suivre un cours, enregistrer sa progression et la retrouver après reconnexion. Vérifier l’isolation entre deux comptes de recette autorisés.

## Reprendre la livraison

1. **Qualification locale de M5 effectuée.** Le 7 novembre, P et M1–M5 ont réussi sur PostgREST 14.18, PostgreSQL 17.11 et Auth 2.197.0, en installation neuve et en mise à niveau avec données A/B. Les 26 groupes personnels et 22 groupes Drill ont réussi sous 14.18 et 16.4 avec de vrais JWT ; conflits HTTP 409, conservation des données et permissions sont vérifiés. Les 32 parcours E2E Supabase sous 14.18 ont réussi avec l’adaptation de banc décrite dans les [résultats et limites](../validations/VALIDATION-LOT6-6-0-DE.md#compatibilité-postgrest).
2. **Connexion opérateur et sauvegarde SQL PROD vérifiées.** Le 7 novembre, `psql` 17.11 et la CLI 2.121.0 ont qualifié l’accès direct en lecture seule. Une archive `public` + `auth` a ensuite été créée dans le dossier frère chiffré `mon-bprea-sauvegardes-prod`, avec clé de récupération protégée séparément. Sa restauration SQL complète sur PostgreSQL 17.11 local est vérifiée : schéma, données des vingt-sept tables Auth, séquence, propriétaires, ACL, rôles et memberships concordants ; serveurs de contrôle arrêtés. La cible PROD reste sans compte et sans objet applicatif. **Avant installation : faire accepter les limites de reprise et la conservation**, notamment l’écart de version ICU Windows/PROD et l’absence de recette du service Supabase hébergé complet. Aucune migration ni modification Auth PROD n’a été effectuée. Préparer les accords Auth et d’installation selon le [guide d’installation PROD](../architecture/RUNBOOK-SUPABASE-PROD-6-6-0.md).
3. **Décider l’ouverture.** Traiter les portes encore ouvertes dans la matrice de préouverture. Après autorisation, vérifier l’artefact publié et le parcours invité jusqu’à la récupération de la progression. [Matrice de préouverture et conditions d’ouverture](../deploiement/PLAN-PREOUVERTURE-PRIVEE.md) · [Invitation et récupération manuelles](../deploiement/INVITATIONS-ET-RECUPERATION-MANUELLES.md)

## Lire selon le chantier

| Chantier | Référence |
| --- | --- |
| Organisation du code | [Architecture actuelle](../architecture/ARCHITECTURE.md) |
| Code et vérifications | [Conventions de test](../TESTS.md) |
| Auth et parcours utilisateur | [Architecture Auth](../architecture/AUTHENTIFICATION.md) |
| Entretien du poste | [Maintenance de `.tmp`](MAINTENANCE-DOSSIER-TMP.md) |

Appliquer les [consignes du dépôt](../../AGENTS.md). Les preuves de la campagne 6.6 restent dans `docs/validations/` ; les rapports antérieurs sont conservés dans `docs/archives/validations/`. Ouvrir les rapports historiques à partir des liens utiles au chantier. Réutiliser les preuves existantes dans leur périmètre, puis vérifier le changement et les parcours qu’il affecte. Lorsqu’un défaut reproductible entre dans le périmètre, livrer le correctif et sa vérification dans la même PR.

Mettre à jour cette fiche quand un jalon ou la prochaine action change. Consigner les résultats dans la PR ou la référence du chantier. Le guide PROD porte la procédure et la matrice de préouverture porte le détail des décisions et des preuves.
