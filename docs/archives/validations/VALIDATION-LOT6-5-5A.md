# Validation du lot 6.5.5.A — maintenance et préouverture privée

**5 novembre 2026, Europe/Paris. Livraison locale ; aucune ouverture ou opération Supabase hébergée dans ce lot.** Le mandat autorise le nettoyage ciblé démontré, les outils/tests/documents et commits locaux. Les décisions privées ou hébergées sont préparées, jamais déduites d'une absence de réponse.

**Complément autorisé le 5 novembre : livraison GitHub de la branche et conservation de la sauvegarde du 29 octobre.** La copie et ses résidus restent en place sous ACL privées. Un reçu `decision-conservation-20261105.json` est ajouté dans ce dossier privé après contrôle des neuf empreintes ; aucun dump ni manifeste historique modifié, aucune nouvelle échéance d'effacement fixée. Le 12 novembre est une revue proposée seulement. Cette décision ne valide pas la politique générale D07 ni l'ouverture. Les mentions d'absence de push/CI et de décision encore attendue dans le bilan initial ci-dessous décrivent sa clôture locale avant ce complément ; le résultat distant est à vérifier sur la PR, jamais déduit des tests locaux.

La lecture actualisée d'`origin/main` confirme la fusion du bilan du 4 novembre par la PR #33, commit `7729cdbe45e72b45cec783c3034d2b0fccf7025a`, arbre identique à `178eb68`. Les deux commits de ce lot sont conservés et le présent complément documentaire est ajouté avant publication de la branche. Aucun déploiement/fusion sur `main`, accès DEV/PROD ou nettoyage D autorisé par ce mandat.

## Reprise Git et protection de l'existant

Worktree initial propre, branche documentaire `docs/lot6-5-4c-validation-c2-20261104`, HEAD **178eb68dee02d605697c462929c10259d0fc5a7d**. Le bilan C2 du 4 novembre y est déjà committé, descendant de la fusion connue **04c1acab86dc3f013fa9ed76f82fced69a710f63** / PR #32. Aucune preuve nouvelle de sa fusion à `main` revendiquée. Nouvelle branche locale : **feature/lot6-5-5a-preouverture-maintenance-tmp**. Le rapport [6.5.4.C](VALIDATION-LOT6-5-4C.md) et son historique du 31 octobre restent inchangés.

Livraison par commits locaux distincts, code puis documents ; code **e1e5ac6b39110750dbe78d6cf75700d8a03649c4**, documents dans le commit portant ce rapport. Aucun push, PR créée, CI distante déclenchée, fusion, modification de protections ou déploiement. Les workflows locaux Qualité (`unit-integration`, `e2e`), sécurité (`supabase-security`) et Pages ont été lus et restent inchangés.

## Opérations locales exécutées

- Inventaire complet : volumes, fichiers/dossiers, types, vingt plus gros fichiers, dates, processus, liens et usages. Classification A–E et suppressions démontrées ; [mesures exactes et exceptions](VALIDATION-LOT6-5-5A-TMP.md).
- Nettoyage E2E complet ou limité aux médias publics, déduplication de 36 anciennes copies avec restauration Git testée, retrait du téléchargement ZIP après contrôle des outils extraits, retrait des seuls fichiers de données de trois clusters synthétiques vides arrêtés. Sources et journaux conservés ; aucun export utilisateur ou preuve de recette supprimé.
- Contrôles natifs limités à PostgreSQL portable sur **127.0.0.1:65435**, requêtes de comptage readonly, deux schémas applicatifs vides et un ancien essai sans tables applicatives/Auth. Aucun service Supabase ou preuve RLS obtenu par ces lectures administratives. Un premier `pg_ctl` avec flux hérités a dépassé le délai malgré démarrage : serveur de ce contrôle identifié puis arrêté, appels corrigés avec flux ignorés, reprise contrôlée et arrêts confirmés avant suppression. Aucun processus inconnu forcé.
- Conservation intégrale des 2 843 fichiers de recette, empreintes avant/après et quatre empreintes d'artefact conformes. Réservations, compteurs et filiation conservés ; aucun replay des créneaux.
- Copie du 29 octobre inspectée en lecture seule hors dépôt : 210 440 377 octets / 5 206 fichiers, ACL racine protégées, aucun point de réanalyse observé, neuf références/empreintes conformes. Aucune nouvelle restauration de cette sauvegarde, suppression, prolongation ou copie secondaire ; échéance du 5 novembre inchangée.

## Outil réutilisable

`npm run maintenance:tmp` simule sans écrire ; `--apply` est explicite ; `--json` détaille les candidats publics et minimise les autres noms. Aucun argument de cible libre. Les quatre modules sous `scripts/maintenance/` contrôlent racine/ancêtres, liens/jonctions/attributs Windows, processus, verrou exclusif, conformité aux sources Git et altérations entre inventaire/application. Les médias d'une copie inconnue ne sont retirés que s'ils correspondent exactement aux octets publics ; les paramètres de version inconnus restent inconnus. Manifeste fermé/PID/empreinte, aucune cible issue de son contenu. Échec de partage Windows minimisé, pas de retry forcé ni ACL relâchée.

Le serveur E2E marque son propre build et ne le nettoie normalement que si les octets et le marqueur correspondent à sa preuve en mémoire. Les arrêts brutaux Windows peuvent laisser une copie ; la maintenance la traite après arrêt vérifié. Toutes les preuves `dev-recipe`, sauvegardes, exports et autres fichiers inconnus restent hors de sa sélection. [Politique, commandes, rétention et restitution](../../developpement/MAINTENANCE-DOSSIER-TMP.md).

## Vérifications exécutées

| Contrôle | Résultat observé |
| --- | --- |
| Runtime et dépendances | Node **24.22.0**, `npm ci --offline --no-audit --no-fund` réussi ; aucune dépendance ou modification du verrou ajoutée |
| Tests du nettoyeur | **17 réussis, 1 ignoré, 18 au total**, fixtures synthétiques uniquement ; simulation, ciblage, volumes, liens/jonctions, preuves/réservations, actifs/inconnus, racine absente, verrouillage réel Windows, idempotence, manifeste et contenu de version altérés, absence de secrets, cycle de vie serveur |
| `npm test`, état final | **516 réussis, 1 ignoré, 517 au total / 50 fichiers**, code final |
| `npx playwright install chromium` | Réussi, Chromium lancé réellement par les suites |
| `npm run test:e2e`, après tests finaux | **85/85**, 54,1 s, contextes Chromium et données isolés, HTTP local et simulations ; aucun navigateur personnel |
| `npm run build:auth-sdk` | Réussi, Supabase JS **2.118.0** ; `git diff --quiet` du bundle et de sa licence : code 0 |
| Artefact Pages | Régression réelle `auth-artifact.test.js` étendue aux outils/rapports privés ; E2E sous `/mon-bprea/` et 17 documents publics, Auth désactivée ; outil de maintenance en HTTP **404** |
| Contrôle visuel | Captures inspectées : accueil 1280 px clair et profil 390 px sombre, lisibilité/navigation préservées et aucun débordement horizontal ; contextes jetables fermés, captures privées ignorées |
| Relance du nettoyeur | Simulation et seconde application : **0 candidat, 0 suppression, aucun échec**, processus inactifs |
| Markdown | **740 liens locaux / 88 fichiers Markdown**, aucun fichier cible manquant ; queries/ancres ignorées pour ce contrôle de présence, liens web non vérifiés exhaustivement |
| Confidentialité/Git | Huit fichiers de code puis onze documents attendus ; scan des motifs de clés/JWT, UUID et chemins personnels : aucun risque détecté ; `.tmp`, configurations locales et rapports ignorés, défaut Auth désactivé |
| `git diff --check` | Réussi, aucune erreur d'espacement |

**Limite native :** création d'un lien symbolique Windows refusée par le privilège du poste, même hors bac à sable ; ce test est **IGNORÉ**, pas réussi. Les jonctions NTFS, détournement de racine et liens intérieurs par jonction ont réellement été créés/refusés sur fixtures. Un fichier réellement tenu avec `FileShare.None` a été conservé. Les premiers essais de fixtures refusés dans le bac à sable ne sont pas présentés comme des succès ; les contrôles de jonction ont été repris dans le contexte local autorisé.

**Supabase réel local NON EXÉCUTÉ :** Docker absent, CLI non disponible dans le PATH ; aucune stack dédiée opérationnelle. Pas de pgTAP/Auth/JWT/RLS local certifié par les mocks, E2E HTTP simulés ou comptes de lignes natifs. Aucun runner redirigé vers DEV. **Aucune nouvelle CI distante exécutée** pour ce lot ; les CI rapprochées le 4 novembre sont historiques et séparées.

## Documents et préouverture

[Plan des quinze P0 et D01–D14](../../deploiement/PLAN-PREOUVERTURE-PRIVEE.md), [procédures pour six adultes](../../deploiement/EXPLOITATION-PRIVEE-SIX-ADULTES.md), guide `.tmp`, deux validations et liens de suivi actualisés dans README/TESTS, dossier/décisions RGPD, guides manuels et sauvegarde. Sources publiques CNIL/RGPD et fournisseur relues ; aucun avis juridique définitif revendiqué. Le changement CLI v3 du 4 novembre est signalé ; les runners restent épinglés à 2.121.0, sans upgrade implicite.

Le plan conserve les résultats DEV acquis du 4 novembre et distingue leurs limites, les essais locaux et la CI historique. **Aucun P0 levé et aucune D entière approuvée.** Les faits déclarés du périmètre six adultes/gratuité/indépendance ne sont pas transformés en validation juridique. La qualification de l'exception domestique, bases, canal réel, contrats/lieux, notice, conservation/fermeture, analyse terminal/AIPD, accès et choix de reprise/clôture restent humains ou dépendent de preuves externes.

Procédures préparées : information avant adresse et invitation, récupération par lien manuel, sauvegarde/import JSON limité, copie technique proposée, clôture native assistée à recetter, incidents et fin de service. Aucun outil générique hébergé pour les camarades n'est livré/activé ; les gardes du générateur local et de la campagne fermée restent intactes. Un document ne remplace pas la preuve d'opérabilité de P0-12/13/14.

## Actions en attente, hors mandat hébergé

1. **Copie du 29 octobre : conservation confirmée.** Copie et résidus conservés, reçu privé de l'accord ajouté ; revue conseillée le 12 novembre, sans autorisation automatique de retrait et sans nouvelle date limite inventée.
2. **D sur DEV :** autorisation distincte et cibles fraîches ; A/B, 36 lignes historiques et leurs copies conservés. Aucune suppression exécutée.
3. **Réserves de recette :** décider T11 et autres sous-cas ; vraie expiration seulement avec mandat ciblé, sans rejouer C2 ni annoncer les mocks comme acquis.
4. **D01–D14/P0 :** finaliser les petites pièces privées et décisions, notice/canal, conservation, sécurité et reprise/clôture effectivement testées sur données fictives isolées.
5. **Activation privée éventuelle :** préparer environnement/outil/artefact et retour sûr, puis autorisations séparées de publication/activation/invitations après levée de tous les P0. Aucun accès PROD, SQL/RLS/RPC/configuration Auth hébergés modifiés, nouvelle identité ou invitation réelle, SMTP, dépense ou ouverture dans ce lot. Livraison distante des commits à faire séparément.
