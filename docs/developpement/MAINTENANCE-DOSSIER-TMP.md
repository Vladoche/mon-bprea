# Maintenance du dossier local `.tmp`

## Procédure après livraison locale

Après une intervention terminée et vérifiée, arrêter ses tests et serveurs, puis exécuter **`npm run delivery:complete`** avant le compte rendu final, avec ou sans commit/PR. Cette commande réutilise le nettoyeur existant ; elle n’exécute ni test, ni commit, ni déploiement.

| Point d’entrée | Effet |
| --- | --- |
| `npm run maintenance:tmp` | Simulation en lecture seule, sans créer de fichier ni verrou. |
| `npm run maintenance:tmp -- --json` | Même simulation, rapport structuré minimisé. |
| `npm run maintenance:tmp:clean` | Nettoyage sécurisé explicite, équivalent à `npm run maintenance:tmp -- --apply`. |
| `npm run delivery:complete` | Même nettoyage, suivi de la mesure finale et du contrôle de capacité. Accepte `-- --json`. |

Le plafond est **500 Mo décimaux (500 000 000 octets)** ; les résumés affichent Mo et Go. Tout dépassement indique le volume excédentaire et les dix plus gros groupes conservés, avec leur catégorie et motif. Un dépassement protégé est un avertissement, pas une autorisation de purge ni un échec des tests. Un refus de sécurité ou une suppression incomplète renvoie un code non nul ; le signaler avant de conclure.

| Catégorie actuelle | Conservation et autorisation |
| --- | --- |
| **A — Supprimable** | Uniquement les builds E2E inactifs rapprochés du contenu public Git ; pour une ancienne copie non scellée avec du code inconnu, seulement ses médias publics strictement identiques. Simulation et recontrôle avant suppression. |
| **B — Temporaire** | Campagnes actives, dernier échec pertinent, diagnostic ouvert : conserver jusqu’à clôture. |
| **C — Protégée** | Sauvegardes/dumps, preuves, modifications non intégrées, données sensibles ou inconnues : conserver. |
| **D — Archivage possible** | Historique utile : conserver sur place tant qu’un archivage et sa restauration ne sont pas explicitement qualifiés. Aucun transfert automatique vers GitHub. |

Le nettoyage standard est autorisé pour A après chaque livraison. Les clusters, caches d’outils, copies de source et autres catégories ne deviennent pas supprimables par leur nom, leur âge ou un simple manifeste. Leur éventuel allègement exige une revue ciblée et l’autorisation du périmètre ; le nettoyeur automatique ne les efface pas. Les groupes peuvent combiner A/C ou B/C.

Préserver explicitement `.tmp/lot660e-source-71e3b2fa2c1d/cas-pt409.local.sql`, les préfixes D/E, les preuves de préparation du premier déploiement et `dev-recipe`. M5 est désormais versionnée dans `supabase/migrations/20261106174551_return_conflict_for_personal_revision.sql` ; cette intégration ne vaut pas autorisation de détruire les preuves associées.

Les contrôles de chemins, liens/jonctions, empreintes, PID et verrou exclusif restent obligatoires. La détection Windows utilise CIM et reconnaît tests, serveur, préparation Pages et répétitions natives ; si l’accès système est refusé, exécuter depuis un terminal autorisé, sans désactiver la garde. Ne pas arrêter les outils d’autrui.

Le serveur E2E nettoie déjà son propre build à la fermeture normale. La commande de fin de livraison traite les reliquats admissibles après arrêt des outils ; elle ne s’exécute pas dans un hook `posttest`, qui interviendrait avant la fin de la campagne. Les consignes versionnées dans `AGENTS.md` rendent cette étape obligatoire pour Codex. **Aucun déclencheur universel ne détecte les livraisons humaines sans commit/PR** : l’opérateur appelle ce point d’entrée. Aucun hook Git local ni changement CI n’est requis.

Dans le compte rendu : volume avant/après, espace réellement libéré, plafond respecté ou causes de dépassement, éventuel refus de nettoyage. Garder un diagnostic utile en cas d’échec et éviter les copies complètes supplémentaires.

## Nettoyage autorisé du 7 novembre 2026

| Mesure logique du contenu de `.tmp` | Avant | Après |
| --- | ---: | ---: |
| Octets | 3 505 247 493 | 1 540 051 254 |
| Mo / Go décimaux | 3 505,25 / 3,505 | 1 540,05 / 1,540 |
| Fichiers | 52 302 | 33 836 |
| Dossiers sous `.tmp` | 1 850 | 1 443 |

**Baisse nette : 1 965 196 239 octets (1 965,20 Mo, 56,1 %).** La revue ponctuelle autorisée a retiré une copie Chromium strictement identique au cache installé, les seuls répertoires de données de neuf clusters fictifs arrêtés et des médias publics dupliqués dans douze copies historiques. Le nettoyeur standard a ensuite retiré 17 builds E2E inactifs rapprochés de Git, sans échec. Dumps, journaux, sources et preuves ont été conservés ; les empreintes des fichiers hors de la sélection ponctuelle sont inchangées, ainsi que celle du prototype M5. Une carte de restauration Git des médias et une preuve compacte restent privées, hors Git/Pages.

**Le plafond de 500 Mo reste dépassé de 1 040,05 Mo.** Conserver les sept autres clusters dont la provenance n’a pas été confirmée par les contrôles retenus, un ancien cluster non proprement clôturé, les outils PostgreSQL, les copies et preuves de release, `dev-recipe` et les contenus inconnus/scellés. Leur suppression n’est pas autorisée par le plafond. Hors `.tmp`, le cache Playwright (752,85 Mo), `node_modules` (84,86 Mo) et Docker (au moins 7,28 Go de fichiers accessibles ; moteur arrêté et deux accès refusés) ont seulement été mesurés.

Validation Windows sous Node 24.22.0 : `npm ci`, puis `npm test -- tests/integration/tmp-maintenance.test.js` : **23 réussis, 1 ignoré** (création d’un lien symbolique natif non autorisée). Les jonctions, chemins extérieurs, processus réellement actifs, verrou Windows, inconnus, idempotence, volumes, plafond et point d’entrée de livraison sont couverts. Le premier essai restreint a échoué sur deux créations de jonctions ; l’exécution autorisée a réussi sans retirer les gardes. Contrôles syntaxiques Node, liens documentaires et `git diff --check` réussis. Pas de suite applicative complète locale pour ce changement d’outillage ; les checks obligatoires de la PR restent à examiner séparément.

## Historique du premier nettoyage

**Lot 6.5.5.A — 5 novembre 2026.** `.tmp/` est ignoré par Git, exclu de Pages et réservé au poste local. Il contient à la fois des fichiers jetables et des preuves privées. Ce n'est jamais une corbeille globale. [Mesures du nettoyage](../archives/validations/VALIDATION-LOT6-5-5A-TMP.md), [validation du lot](../archives/validations/VALIDATION-LOT6-5-5A.md).

## Inventaire initial et origine du volume

Mesure avant intervention : **5 350 130 964 octets, 31 552 fichiers, 1 480 dossiers**. L'API Windows `GetCompressedFileSizeW` renvoie également 5 350 130 964 octets pour ces fichiers, sans erreur ; ce n'est pas une mesure des clusters NTFS, des métadonnées ou de l'espace physique exclusif. L'espace libre du volume ne permet pas d'attribuer les écritures concurrentes d'autres applications au nettoyage. Les gains annoncés utilisent donc la différence mesurée du contenu de `.tmp`, avec les rapports ajoutés inclus dans l'état final.

L'inventaire complet, les vingt premiers fichiers, types, horodatages, empreintes et opérations restent sous ACL privées dans `.tmp/maintenance-local/`. Aucun de ces rapports bruts n'est à ajouter à Git. Fichiers datés du 30 septembre au 5 novembre ; les dates anciennes des binaires viennent de leur distribution et ne constituent pas une règle d'expiration. Aucun lien/jonction observé dans l'inventaire initial. Les processus ont été inspectés avant nettoyage sans afficher leurs arguments : aucun serveur de test/recette ni PostgreSQL en fonctionnement initialement ; un ancien outil de saisie privé et des workers restaient présents. Aucun processus inconnu arrêté, tout `dev-recipe` exclu.

| Sous-dossier / groupe initial | Taille initiale | Usage / reproductible | Sensible | Nécessaire / catégorie | Action exécutée ou conservation |
| --- | ---: | --- | --- | --- | --- |
| `e2e-*` : 168 copies | 3 695 137 902 octets | Site préparé par `scripts/test-server.mjs` ; PDF/images recopiés à chaque lancement | Configurations publiques ; code non committé possible | B pour les octets prouvés, E pour les instantanés inconnus | 99 copies entièrement conformes aux sources Git retirées ; dans 69 autres, seuls médias publics exacts retirés, code inconnu conservé |
| `lot653b-native` | 523 171 988 octets | Outils PostgreSQL portables, archive téléchargée, scripts et diagnostics | Diagnostics techniques potentiellement privés | B pour le téléchargement ; B/C/D/E pour le reste | Archive ZIP de 381 531 864 octets retirée après CRC et comparaison de 1 563 fichiers extraits ; outils 17.11, scripts et preuves conservés |
| `dev-recipe` | 91 788 559 octets | Trois dossiers de run, quatre frontends, C2, journaux et réservations | Oui | C/D, indispensable pour D/T11/filiation | **Intégralement conservé en place**, 2 843 empreintes comparées après intervention |
| `recipe-native-*` : trois essais | 125 714 189 octets | Reconstruction native synthétique depuis migrations ; deux schémas vides et un essai avorté | Technique, à prouver avant suppression | A/B pour les seules données synthétiques vides ; C pour sources/logs | Contrôle SQL readonly sur loopback : aucune donnée Auth/applicative et aucune autre base utilisateur ; arrêt confirmé, seuls `data/` retirés. `init.sql`, anciens logs et relevés de métadonnées conservés |
| 36 anciennes copies statiques de contrôle | Plusieurs versions de 19 à 22 Mo chacune | Préparations Pages, tests d'artefact/publication et copies d'intégration | Code historique inconnu possible | B pour les médias identiques à Git, C/E pour le reste | 828 doublons de médias, **752 835 942 octets**, retirés avec carte de provenance Git ; restauration intégrale réellement vérifiée avant retrait final |
| Autres anciens frontends et captures | Selon inventaire privé | Vérifications visuelles/historiques, notamment versions DEV antérieures | Potentiellement | C/E | Conservés ; aucun frontend scellé de recette amputé |
| Racine, configurations, scripts locaux, exports/JSON, rapports | Selon inventaire privé | Diagnostics, réglages publics locaux, preuves et données non classées | Potentiellement | C/D/E | Conservés et signalés ; aucune purge fondée sur l'âge |
| Sauvegarde du 29 octobre | **Hors `.tmp`** | Snapshot applicatif privé limité et essais de restauration | Oui | D, décision indépendante | Lecture d'intégrité seulement ; jamais ciblée par ce nettoyage |

Le volume provenait surtout de **2 332 PDF (4 026 585 112 octets)** recopiés dans les frontends, puis **2 460 JPEG (429 044 910 octets)** et du téléchargement PostgreSQL. Les 11 141 JavaScript occupaient 167 562 531 octets. Aucun build Chromium n'était stocké dans `.tmp` ; le cache navigateur externe n'a pas été nettoyé. Les rapports Playwright habituels vivent dans `test-results/` et `playwright-report/`, également ignorés mais hors périmètre du nettoyeur.

Les vingt plus gros fichiers initiaux sont minimisés ci-dessous ; les exemplaires de PDF de même taille sont distingués sans identifiant de run.

| Rang | Fichier ou exemplaire minimisé | Octets |
| --- | --- | ---: |
| 1 | Archive Windows PostgreSQL 17.11 | 381 531 864 |
| 2 | Bibliothèque ICU des outils portables | 28 399 104 |
| 3 | WAL synthétique, essai natif 1 | 16 777 216 |
| 4 | WAL synthétique, essai natif 2 | 16 777 216 |
| 5 | WAL synthétique, essai natif 3 | 16 777 216 |
| 6 | Exécutable PostgreSQL portable | 9 939 456 |
| 7 | Bibliothèque graphique de distribution | 8 352 768 |
| 8 | Bibliothèque de liaison graphique | 7 578 300 |
| 9 | Bibliothèque cryptographique portable | 5 486 592 |
| 10 | Guide PDF public, copie frontend 1 | 4 641 261 |
| 11 | Guide PDF public, copie frontend 2 | 4 641 261 |
| 12 | Guide PDF public, copie frontend 3 | 4 641 261 |
| 13 | Guide PDF public, copie frontend 4 | 4 641 261 |
| 14 | Guide PDF public, copie frontend 5 | 4 641 261 |
| 15 | Guide PDF public, copie frontend 6 | 4 641 261 |
| 16 | Guide PDF public, copie frontend 7 | 4 641 261 |
| 17 | Guide PDF public, copie frontend 8 | 4 641 261 |
| 18 | Guide PDF public, copie frontend 9 | 4 641 261 |
| 19 | Guide PDF public, copie frontend 10 | 4 641 261 |
| 20 | Guide PDF public, copie frontend 11 | 4 641 261 |

## Commandes et portée permanente

Node.js **24 LTS**, outils installés par `npm ci`, aucune dépendance nouvelle :

```text
npm run maintenance:tmp
npm run maintenance:tmp -- --json
npm run maintenance:tmp -- --apply
```

Sans `--apply` ni `--delivery`, lecture seule : aucune suppression, aucun dossier ou verrou créé. La sortie donne volumes, nombres, candidats, règle et exclusions ; `--json` détaille les noms publics des seuls fichiers candidats et masque les autres noms. Aucun contenu de fichier ou erreur fournisseur n'est journalisé. Aucun argument de racine, cible, manifeste, glob, âge ou forçage n'est accepté. La racine vient de l'emplacement du module dans ce dépôt, jamais du répertoire courant de l'opérateur.

Le mode application ne cible que les dossiers **immédiats** `.tmp/e2e-` suivis de six caractères alphanumériques, créés par le serveur de tests. Le nom seul n'autorise rien : chaque fichier doit appartenir au jeu public historique Git. Contenu et chemin publics sont vérifiés dans les objets Git locaux ; seuls les fins de ligne de texte et paramètres de version de cache sont normalisés. Une configuration Auth activée est refusée. Un fichier ou sous-dossier inconnu, une preuve/réservation ou un lien exclut le groupe.

Si seul le code historique n'est pas rapproché de Git, la copie **sans manifeste** peut être allégée de ses seuls médias publics correspondant exactement à des objets Git. Les JavaScript, JSON, HTML et autres octets inconnus restent. Un manifeste présent ajoute schéma fermé, PID et empreinte brute complète : altération ou PID vivant exclut le dossier ; aucune cible contenue dans un manifeste n'est suivie. Un manifeste n'est ni une preuve signée ni une autorité de suppression : la validation indépendante contre Git reste obligatoire.

Les préparations courantes sont recréables avec :

```text
python scripts/prepare-pages.py --version e2e-lot5-1 --output .tmp/reconstruction-locale/public
```

Cette commande prépare le checkout courant, pas la reproduction automatique d'un ancien code inconnu. Pour un ancien frontend, conserver son commit, sa configuration publique et ses octets uniques. Les frontends et configurations scellés de `dev-recipe` restent intacts, même si certains octets sont identiques au site courant.

Le serveur marque désormais son propre build et le nettoie à la fermeture normale uniquement si son empreinte conservée **en mémoire** et le marqueur sont inchangés. Un ajout inconnu le fait conserver. Un arrêt brutal Windows peut empêcher le hook de sortie : après fermeture de ses outils, relancer la maintenance. Elle conserve tout PID vivant, y compris en cas de réutilisation prudente d'un PID.

## Sécurité et limites

Chemins canoniques et chaque ancêtre contrôlés ; refus de lien/jonction, contrôle des attributs de réanalyse Windows avant suppression, aucune traversée de lien. Verrou exclusif `.tmp/.maintenance.lock`, nouvelle vérification des processus et des octets avant chaque groupe, suppressions fichier par fichier puis dossiers vides : aucun `rm` récursif ou glob destructeur. Aucune ACL modifiée pour forcer une suppression. Ne pas manipuler l'arborescence simultanément.

Le contrôle des processus Windows utilise CIM. S'il est indisponible, ou si tests/serveur/préparation sont actifs, aucun candidat n'est supprimé et `--apply` signale le blocage. Dans un environnement restreint, exécuter depuis un terminal local autorisé, sans désactiver la garde. Les processus inconnus ne sont jamais arrêtés. Un verrou de maintenance abandonné n'est pas retiré automatiquement : vérifier privativement son PID et l'absence d'opération avant de retirer **ce seul fichier**.

Un partage Windows interdisant la lecture écarte le groupe ; une interdiction de suppression produit une erreur minimisée, sans retry forcé. Le compteur ne comprend que les suppressions réellement accomplies. Un groupe peut rester partiel après erreur : son marqueur est retiré en dernier et les autres données sont conservées. Examiner le rapport avant une reprise. Aucun effacement cryptographique, aucune récupération de clusters NTFS précise ou révocation de données cloud n'est promis.

## Rétention et entretien historiques (catégories du 5 novembre)

| Catégorie | Règle |
| --- | --- |
| A, caches et données synthétiques | Après usage terminé et reproductibilité établie ; le script permanent n'étend pas son périmètre aux clusters ou téléchargements |
| B, builds de test | Nettoyage à la fermeture normale ; maintenance après une campagne et avant livraison, après arrêt des outils. Garder les échecs pertinents hors du jeu jetable |
| Rapports de tests | Garder le dernier succès utile et les anomalies ouvertes ; revue après résolution. Aucune purge automatique de `test-results/`, captures ou traces |
| Frontends de recette | Garder toutes les versions requises par plan/filiation/contrôle encore ouvert ; jamais supprimées par la commande |
| C, preuves et réservations | Conserver tant que D/T11 et clôture applicable ne sont pas traités ; revue à leur clôture, sans réinitialiser ni rejouer les marqueurs |
| D, sauvegardes/exports privés | Décision propre par copie, accès et restauration ; aucune expiration automatique ni déplacement vers un stockage moins protégé |
| E, inconnus | Conserver, signaler et examiner seulement si le volume le justifie ; l'âge ne suffit jamais |

Les plus gros restes sont expliqués dans le rapport de mesure. Réexamen proposé **le 12 novembre 2026** pour la dette locale et à la décision D/T11 pour les preuves ; ce sont des rappels documentaires, aucune tâche planifiée ni autorisation de purge. La sauvegarde hors dépôt a sa décision urgente du 5 novembre séparée.

## Retrouver les éléments régénérables allégés dans ce lot

Le nettoyage exceptionnel des 36 anciens builds n'est pas une règle permanente sur tous les dossiers Pages. Une carte privée conserve commit source, chemin relatif fixe et SHA-256 de chaque média. Tout leur code est encore en place. La commande locale de restauration **testée sur les 828 fichiers**, sans accès réseau, est :

```text
node .tmp/maintenance-local/legacy-static-media.mjs --restore
```

Elle refuse les cibles hors de sa liste fixe, les chemins non publics, les liens et un fichier existant différent ; lit uniquement les objets Git du commit conservé et vérifie l'empreinte. Elle restaure à l'emplacement d'origine. Garder la carte et ce script tant que les squelettes existent ; ils sont ignorés et protégés par ACL, pas distribués dans Pages. Après restauration, aucun retrait ne doit être improvisé hors de la procédure auditée. Les sources exactes restent dans l'ascendance Git de cette branche.

Les binaires PostgreSQL 17.11 extraits sont conservés pour les opérations de sauvegarde. Si le téléchargement complet redevient nécessaire : [archive publique EDB](https://get.enterprisedb.com/postgresql/postgresql-17.11-5-windows-x64-binaries.zip), HTTP HEAD 200 et longueur contrôlés le 5 novembre ; vérifier son SHA conservé dans le rapport privé avant extraction ciblée. Aucune URL de téléchargement fournie par un manifeste non fiable n'est exécutée.

Les trois anciens clusters supprimés étaient synthétiques et vides, indépendants de la sauvegarde privée : les sources d'initialisation, le script local `dev654b-native-check.mjs`, les trois migrations versionnées, les relevés de métadonnées et les outils portables restent disponibles. Pour refaire un contrôle natif, adapter une **copie** de ce script vers un nouveau dossier à ACL protégées et de nouveaux relevés ; ne pas écraser les relevés historiques et ne pas le rediriger vers DEV. Cela ne recrée pas un service Auth ni une preuve RLS.

## Archivage futur d'une preuve

Aucune preuve de recette n'a été compressée, déplacée ou supprimée dans ce lot. Avant tout archivage futur : identifier campagne terminée, références et dépendances ; choisir une destination locale au moins aussi protégée ; conserver provenance et empreintes de tous les fichiers ainsi que les ACL à réappliquer. Produire une archive sans perte, puis l'ouvrir et l'extraire dans un dossier privé neuf ; comparer liste, tailles et SHA de **chaque fichier**. Refuser toute entrée absolue, `..`, lien ou jonction à l'extraction.

Documenter la restauration à l'emplacement original, tester les outils hors ligne qui le référencent et vérifier qu'aucun outil actif/contrôle ouvert ne dépend du dossier décompressé. Conserver l'original tant que ces contrôles ne sont pas tous satisfaits ; supprimer seulement la copie devenue redondante. Restaurer dans un emplacement neuf contrôlé, réappliquer les ACL avant données privées et ne jamais écraser un run existant. Une archive simplement créée n'est pas une preuve relisible.
