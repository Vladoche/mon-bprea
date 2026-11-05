# Assainissement local `.tmp` — 5 novembre 2026

## Mesures

| Mesure | Avant | Après |
| --- | ---: | ---: |
| Contenu des fichiers | 5 350 130 964 octets | 467 111 016 octets |
| Nombre de fichiers | 31 552 | 15 033 |
| Nombre de dossiers | 1 480 | 678 |

**Réduction nette mesurée : 4 883 019 948 octets (4,883 Go), soit 91,27 %.** Les nouveaux rapports privés et captures de contrôle sont inclus dans l'état final. **16 551 fichiers présents dans l'inventaire initial retirés**, comptés par comparaison des chemins avant/après. Les fichiers temporaires générés puis retirés pendant les vérifications et le cycle de restauration ne gonflent pas ce nombre.

## Éléments nettoyés et conservés

99 anciennes copies E2E supprimées entièrement après rapprochement avec Git ; médias publics seuls retirés dans 69 copies contenant du code non rapproché, ce code restant conservé. Dans 36 autres copies de contrôle, 828 médias identiques au commit de référence ont été restaurés à leur emplacement d'origine, vérifiés puis retirés ; code et carte de restitution conservés. Archive de téléchargement PostgreSQL retirée, outils extraits conservés. Trois clusters natifs contrôlés sans ligne Auth/applicative, arrêtés puis seuls dossiers de données synthétiques supprimés ; sources, journaux originaux et métadonnées conservés.

Conservés : **tous les 2 843 fichiers `dev-recipe`**, quatre frontends et leurs manifestes, réservations historiques, journaux parents/reçus/filiation, preuves C2, éléments D/T11, JSON privés et configurations locales. Autres captures, scripts et fichiers inconnus préservés. Sauvegarde technique hors `.tmp` laissée à son emplacement, sans suppression ni modification de rétention.

## Principaux volumes restants

| Groupe restant | Octets | Motif de conservation |
| --- | ---: | --- |
| Outils portables et diagnostics PostgreSQL | 141 640 124 | Procédures de sauvegarde/reprise et sources historiques |
| `dev-recipe` | 91 788 559 | Preuves, réservations et quatre frontends nécessaires à D/T11/filiation |
| Code des 69 copies E2E | 65 985 143 | Instantanés non rapprochés de Git, inconnus préservés |
| Code des 36 copies statiques allégées | 37 318 006 | Octets historiques conservés et médias restituables depuis Git |
| Ancien dossier de préparation manuelle | 44 991 247 | Frontends, scripts, diagnostics et captures historiques conservés |
| Frontend de contrôle visuel correctif | 22 428 665 | Exemplaire historique conservé intégralement |
| Ancien frontend DEV d'authentification | 21 815 127 | Exemplaire et configuration publique historiques conservés |
| Nouveaux rapports locaux de ce lot | 6 096 399 | Inventaire, empreintes, résultats et carte de restitution privés |

Les outils portables restent nécessaires aux procédures locales de sauvegarde/reprise et évitent un nouveau téléchargement. Les preuves de recette restent nécessaires aux contrôles ouverts et au nettoyage D futur. Les instantanés de code inconnus et anciennes captures restent faute de décision démontrant leur inutilité. Leur revue peut suivre la clôture applicable ; aucun objectif de volume n'autorise la perte de preuves.

## Contrôles et exceptions

Chemins canoniques sous `.tmp` du dépôt vérifiés, aucune jonction/lien initial observé, processus et absence de conflit contrôlés avant les groupes. Suppressions ciblées, aucune racine générale supprimée, aucune ACL relâchée. Aucun processus inconnu arrêté ; seuls serveurs de test et contrôle natif créés dans ce lot ont été fermés. Ancien outil opérateur privé conservé.

Les 2 843 SHA-256 avant/après sont conformes, **quatre manifestes d'artefact recomputés conformes** ; aucun marqueur de réservation modifié. Archive de distribution lue/CRC conforme, 1 563 fichiers extraits comparés et outils 17.11 exécutables ; référence de téléchargement publique contrôlée. Réouverture/restauration réelle des 828 médias effectuée. Aucun nouveau run hébergé ni effacement DEV. Cycle final de maintenance : **0 candidat, 0 fichier et 0 octet supprimés, aucun échec, contrôle des processus disponible et inactif**.

Contrôle d'ouverture exclusive en lecture sur **15 030 fichiers : aucun refus observé**. Les nouveaux artefacts de tests ont ensuite été fermés et nettoyés par la commande contrôlée ; le dernier passage est idempotent et les 2 843 fichiers de recette sont encore conformes. Les outils privés anciens restés présents n'ont pas été forcés à l'arrêt.

## Limites de mesure

La mesure porte sur la somme des longueurs des fichiers. `GetCompressedFileSizeW` a donné la même somme initiale sans erreur ; allocation NTFS, métadonnées, corbeille, SSD et espace physique exclusif non certifiés. L'espace libre global du disque peut évoluer sous l'effet d'autres applications. Aucune promesse d'effacement cryptographique. Les tailles supprimées brutes et la réduction nette diffèrent du fait des contrôles natifs et des nouveaux rapports. Les répertoires extérieurs à `.tmp`, dont cache Chromium et sauvegarde privée, ne sont pas inclus.
