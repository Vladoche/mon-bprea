# Reprendre Mon BPREA avec Codex

Utiliser cette fiche pour choisir la référence utile au chantier. Consulter
l’[état du projet](ETAT-DU-PROJET.md) si la décision dépend d’un jalon, d’une
version en service ou d’une preuve antérieure. Les règles communes sont dans
[AGENTS.md](../../AGENTS.md).

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

## Suivi documentaire d’une livraison

Pour une livraison significative, identifier les contrats, guides et preuves
touchés par le changement. Pour une petite correction, actualiser les seuls
documents concernés. Chaque information a une source principale vers laquelle
les autres guides renvoient.

1. Corriger les passages devenus inexacts à partir du code et des preuves.
   Après un changement de quota, version ou statut, rechercher l’ancienne
   valeur dans les guides actifs et les contrats. Lors d’un renommage, vérifier
   les liens Markdown, ancres et références utilisées par les scripts. Garder
   un renvoi pour les liens historiques qui en dépendent.
2. Consigner les changements significatifs sous `Non publié` dans le
   [changelog](../../CHANGELOG.md), avec un intitulé stable et le lien de PR
   dès qu’il est connu. Actualiser l’état central si un jalon, une décision ou
   la prochaine action change.
3. Distinguer les états planifié, en développement, fusionné et publié.
   Vérifier le numéro, la date et le SHA de fusion après celle-ci, lors de la
   reprise suivante. Dater les contrôles locaux et la recette hébergée
   séparément. Après une publication autorisée, actualiser le
   [registre Pages](../deploiement/EXPLOITATION-PRIVEE.md#registre-de-publication-pages)
   à partir du workflow réussi et de la recette, puis l’état central.
4. Conserver les preuves historiques avec leur date et leurs limites. Citer
   les contrôles réellement exécutés et signaler ceux qui manquent.

La [fiche historique conservée](../archives/validations/REPRISE-CODEX-2026-11-14.md)
garde les liens aux preuves d’installation, d’Auth, de première utilisation, de
sauvegarde et de clôture. Les rapports restent dans `docs/validations/` ou
`docs/archives/validations/` selon leur campagne.
