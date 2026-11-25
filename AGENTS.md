# Mon BPREA — instructions de travail

Mon BPREA est un site statique GitHub Pages utilisable sans Node.js par les
participants. Préserver les URL, les identifiants, les clés locales, l’historique
et la synchronisation. Garder l’interface accessible, responsive et compatible
avec le mode sombre ainsi que les thèmes saisonniers et horaires.

Ouvrir uniquement les fichiers et preuves utiles au chantier. La
[fiche de reprise](docs/developpement/REPRISE-CODEX.md) oriente vers les contrats
et procédures quand le sujet l’exige. Consulter l’[état du projet](docs/developpement/ETAT-DU-PROJET.md)
si la tâche dépend d’un jalon, d’une décision ou d’une version en service.
Chercher dans les archives à partir d’une référence précise.

## Hygiène Git obligatoire

1. Avant chaque tâche, lancer `npm run git:preflight`. Examiner les diffs,
   fichiers non suivis, commits locaux, worktrees et opérations en cours.
   Préserver tout travail préexistant, les commits sans copie distante et les
   fichiers d’origine incertaine. Laisser les opérations d’autrui se terminer.
2. Créer ou réutiliser une branche dédiée depuis la référence distante vérifiée
   (par défaut `origin/main`). Si le checkout principal est occupé ou modifié,
   utiliser un worktree isolé. Limiter le diff au mandat.
3. Pour livrer une PR, vérifier son commit distant, ses contrôles et les états
   de fusion et de déploiement applicables. Respecter le mandat pour le commit et
   le push. La fusion et les changements de protection de `main` exigent un accord.
4. Arrêter les outils de la tâche et lancer `npm run delivery:complete` avant le
   compte rendu. Suivre la [procédure de clôture](docs/developpement/MAINTENANCE-DOSSIER-TMP.md#procédure-de-clôture)
   pour la confirmation, les builds de la tâche et le retrait ciblé.

## Sécurité, Git et limites d’intervention

- Toute opération hébergée suit son runbook et son autorisation. Une publication
  ou une opération PROD exige une autorisation explicite pour ce périmètre.
  Distinguer local, DEV et PROD. Garder l’accès privé sur invitation
  et les connexions anonymes désactivées. Tout changement du mode d’accès exige
  une décision explicite, une validation Auth/RLS et la préparation de
  l’information des personnes concernées.
- Garder `assets/auth-config.json` désactivé et la configuration de test dans
  `auth-config.local.json` ignoré. Protéger secrets et liens Auth dans le dépôt,
  les artefacts Pages, les journaux et les captures. Seuls les paramètres publics
  prévus entrent dans l’artefact.
- Pour Auth, données et migrations, ouvrir le
  [contrat applicable](docs/architecture/AUTHENTIFICATION.md) ou le runbook
  ciblé. Préserver UUID Auth, client et service partagés, RLS, grants et
  privilèges de colonnes. Préserver les données en attente lors d’une
  déconnexion. Tout import pédagogique requiert une action explicite. Vérifier la
  cible et versionner les évolutions dans de nouvelles migrations. Préserver les
  migrations déjà appliquées et les bases à conserver.
- Les essais de sécurité réels utilisent une stack locale dédiée et des comptes
  fictifs. Les mocks, le masquage d’interface et le rôle administratif ne
  démontrent pas l’isolation des participants. Signaler les contrôles manquants.
- Actualiser et vérifier les documents administratifs et notices dans le
  périmètre autorisé, sans approbation documentaire spécifique. Les modifications
  effectives des finalités, destinataires, accès ou comptes relèvent de leurs
  autorisations propres. Respecter l’information des personnes concernées.
- Garder `.tmp/` local et exclu de Pages. Préserver diagnostics utiles, preuves,
  sauvegardes et fichiers inconnus. Toute suppression hors de la liste blanche
  exige vérification et autorisation. Le plafond de 500 Mo sert au suivi.

## Correction et vérification

- Corriger les défauts établis dans le périmètre et valider le résultat.
  Traiter en priorité les risques de sécurité, de perte de données et de rupture
  d’un parcours essentiel. Réutiliser les preuves encore valides et indiquer
  les vérifications manquantes.
- Pour le développement, utiliser Node.js 24 LTS et `npm ci`. Choisir les
  [tests](docs/TESTS.md) selon le changement. Réserver la validation complète aux
  risques transversaux et aux livraisons majeures. Tester localement avec des
  données synthétiques et un navigateur isolé. Pour toute interface modifiée,
  vérifier ordinateur, mobile, clavier, mode sombre et préférences.
- Pour la documentation seule, vérifier les liens, ancres et commandes concernés
  et lancer `git diff --check`. En cas de livraison significative, suivre les
  [mises à jour documentaires](docs/developpement/REPRISE-CODEX.md#suivi-documentaire-dune-livraison).
- Pour Drill, suivre le [contrat pédagogique](docs/architecture/MODE-DRILL.md).
  Préserver les dix nouveaux exercices hebdomadaires par UC, les séries
  précédentes non bloquantes, le calcul sur les exercices réalisés et l’historique, sans
  gamification.

Dans le compte rendu, indiquer le résultat, les contrôles exécutés, leurs limites
et les suites indispensables. Réserver les rapports permanents aux preuves
durables ou demandées.
