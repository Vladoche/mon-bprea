# Reprendre Mon BPREA avec Codex

**Point de situation du 7 novembre 2026.** Le backend Supabase PROD est installé : P puis M1–M5 ont été appliquées et contrôlées depuis `main` à `65119ca855eabe59070800ddbf31a4015aa28e7b`, qui contient les PR #42, #46 et #47 fusionnées. Les six fichiers SQL sont inchangés. La configuration Auth sur invitation et l’ouverture restent à autoriser.

**Cible du vendredi 13 novembre 2026.** Accès sur invitation uniquement, dans le cadre de la préouverture privée. Un invité doit pouvoir activer son compte, se connecter, suivre un cours, enregistrer sa progression et la retrouver après reconnexion. Vérifier l’isolation entre deux comptes de recette autorisés.

## Reprendre la livraison

1. **Qualification locale de M5 effectuée.** Le 7 novembre, P et M1–M5 ont réussi sur PostgREST 14.18, PostgreSQL 17.11 et Auth 2.197.0, en installation neuve et en mise à niveau avec données A/B. Les 26 groupes personnels et 22 groupes Drill ont réussi sous 14.18 et 16.4 avec de vrais JWT ; conflits HTTP 409, conservation des données et permissions sont vérifiés. Les 32 parcours E2E Supabase sous 14.18 ont réussi avec l’adaptation de banc décrite dans les [résultats et limites](../validations/VALIDATION-LOT6-6-0-DE.md#compatibilité-postgrest).
2. **Backend PROD installé et reprise conservée.** Après accord humain explicite, P puis M1–M5 ont été appliquées le 7 novembre avec contrôle de chaque palier. État final : 10 tables, 98 colonnes, 95 contraintes, 24 index, 24 politiques RLS, 15 fonctions, 11 triggers et cinq migrations ; définitions, propriétaires et permissions conformes, RLS active sur les dix tables et aucun accès direct applicatif pour `anon` ou `service_role`. L’archive `public` + `auth` du 7 novembre à 16:10:40 UTC, restaurée et vérifiée en PostgreSQL local, reste dans le stockage chiffré avec clé séparée ; intégrité et disponibilité revérifiées avant installation. Les limites de reprise SQL, RPO, absence de RTO hébergé garanti, différences ICU/locales et conservation jusqu’à validation puis au moins sept jours supplémentaires ont été acceptées, sans suppression automatique. [Résultat et limites de l’installation](../architecture/RUNBOOK-SUPABASE-PROD-6-6-0.md).
3. **Configurer Auth sur invitation sous accord distinct.** Aucun réglage Auth n’a changé : aucun compte créé, aucune invitation envoyée ni version Pages publiée. L’inscription publique reste activée, les connexions anonymes sont désactivées ; traiter ce réglage avant ouverture. L’installation ne prouve pas le parcours invité hébergé. Préparer les seuls réglages et contrôles autorisés selon le guide PROD.
4. **Décider l’ouverture.** Traiter les portes encore ouvertes dans la matrice de préouverture. Après autorisation, vérifier l’artefact publié et le parcours invité jusqu’à la récupération de la progression. [Matrice de préouverture et conditions d’ouverture](../deploiement/PLAN-PREOUVERTURE-PRIVEE.md) · [Invitation et récupération manuelles](../deploiement/INVITATIONS-ET-RECUPERATION-MANUELLES.md)

## Lire selon le chantier

| Chantier | Référence |
| --- | --- |
| Organisation du code | [Architecture actuelle](../architecture/ARCHITECTURE.md) |
| Code et vérifications | [Conventions de test](../TESTS.md) |
| Auth et parcours utilisateur | [Architecture Auth](../architecture/AUTHENTIFICATION.md) |
| Entretien du poste | [Maintenance de `.tmp`](MAINTENANCE-DOSSIER-TMP.md) |

Appliquer les [consignes du dépôt](../../AGENTS.md). Les preuves de la campagne 6.6 restent dans `docs/validations/` ; les rapports antérieurs sont conservés dans `docs/archives/validations/`. Ouvrir les rapports historiques à partir des liens utiles au chantier. Réutiliser les preuves existantes dans leur périmètre, puis vérifier le changement et les parcours qu’il affecte. Lorsqu’un défaut reproductible entre dans le périmètre, livrer le correctif et sa vérification dans la même PR.

Mettre à jour cette fiche quand un jalon ou la prochaine action change. Consigner les résultats dans la PR ou la référence du chantier. Le guide PROD porte la procédure et la matrice de préouverture porte le détail des décisions et des preuves.
