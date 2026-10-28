# Validation du lot 6.5.2 — audit Supabase DEV et plans

**28 octobre 2026, Europe/Paris. Livraison documentaire, aucune écriture Supabase hébergée.** Les faits techniques observés et les propositions sont séparés. L'audit ne vaut ni validation fonctionnelle de DEV, ni conformité juridique, ni autorisation d'ouverture.

## Git et préparation

Worktree initial unique et propre, branche `feature/lot6-5-1-cadrage-six-etudiants`, tête `fd6421109c51f61e7521b66917932df2f734cfb4`. AGENTS.md et conventions tests/architecture/CI lus. `git fetch origin` a actualisé origin/main ; [PR #25](https://github.com/Vladoche/mon-bprea/pull/25) confirmée fusionnée le 28/10/2026 à **`5affd57ee6e3a92d53eb8bddafc029268554c522`**, dernier main lors de la création de **`feature/lot6-5-2-audit-supabase-dev`**. Aucun fichier utilisateur déplacé/effacé, aucune édition de main. L'actualisation initiale a nécessité les permissions Git adaptées après refus d'écriture FETCH_HEAD en sandbox.

Workflows `quality.yml`, `auth-security.yml`, `deploy.yml` et optimisations #20 conservés. Le [ruleset public actif #25489814](https://github.com/Vladoche/mon-bprea/rules/25489814), lu par GET le 28/10/2026, impose PR, absence de suppression/force-push et **unit-integration, e2e, supabase-security** ; aucune règle modifiée. Les deux premiers jobs sont autonomes ; le dernier conserve uniquement sa stack locale Docker éphémère, sans secret/projet hébergé. Pages reste sur push main ou lancement manuel ; aucune fusion/publication déclenchée.

Après interruption puis reprise à la demande de l'exploitant, un nouveau `git fetch origin` confirme le même origin/main `5affd57…` ; branche et modifications documentaires conservées. L'intégration GitHub de DEV a été relue : Deploy to production et Automatic branching off (R13), sans ouvrir l'intégration PROD.

## Sources, lectures et résultats

Lecture des quinze références du mandat : sept documents RGPD (cadrage, exploitation légère, dossier, décisions, flux, conservation, calendrier), validation 6.5.1, cinq contrats d'architecture (Auth, backend personnel, Drill, export, suppression), validation DEV historique et TESTS.md ; plus trois migrations, config.toml, templates, fonction/implémentation partagée, configurations publiques, ignore, scripts pertinents et workflows. Les rapports historiques ne sont pas présentés comme état courant.

| Livrable | Résultat |
| --- | --- |
| [Audit](AUDIT-SUPABASE-DEV-LOT6-5-2.md) | Journal daté R01–R16, projet DEV certain, catalogue et privilèges effectifs, Auth/URLs/SMTP/backups/alertes, annexes sans donnée privée, inconnues et absence d'écriture |
| [Matrice](../deploiement/MATRICE-ECARTS-DEV.md) | Statuts explicites par domaine, risques/priorités et actions futures ; aucune absence déduite d'une permission insuffisante |
| [Mise à niveau](../deploiement/PLAN-MISE-A-NIVEAU-DEV.md) | Étapes A–G : préconditions, seule migration manquante, Auth/SMTP, frontend local, recette et preuves ; arrêts/retour sûr sans reset ni rollback inventé |
| [Recette future](../deploiement/PLAN-RECETTE-DEV.md) | T01–T18, autorisations distinctes et comptes synthétiques propres au run, A/B/deux appareils/outbox, droits/clôture assistée/restauration isolée, preuve et nettoyage ciblé |
| Dossier et exploitation | Actualisation ciblée D05/D06/D08/D13/D14 et P0-07/08/11/12/14 ; quinze P0 toujours bloquants et D01–D14 non approuvées ; projet personnel volontaire de six adultes, horizon juin 2027 |

R01–R16 ciblent uniquement **`wcckbyhrtroittbfophv`**, vérifié avant chaque série MCP et dans les URLs/header du Dashboard. Les trois requêtes SQL lisent exclusivement les catalogues/métadonnées ; `has_*_privilege` sont des fonctions PostgreSQL intégrées. Aucun appel de RPC métier, aucune ligne de profil/Auth/pédagogie, aucun contenu de clé/token/session/log individuel lu. Le connecteur n'expose pas Auth/SMTP/backups : lecture complémentaire dans le Dashboard officiel avec session existante. Aucun test de connexion à Mon BPREA.

État : région Ireland/eu-west-1 et PostgreSQL 17.11.0.003 ; Free ; ACTIVE_HEALTHY et conseiller santé 0/0/0, sans conclusion de disponibilité applicative. Profils et Drill enregistrés, quatre tables/29 colonnes/28 contraintes/9 index/5 triggers/8 policies/sept fonctions conformes dans le périmètre relu ; corps comparés aux sources Git après normalisation des fins de lignes. Six tables, six RPC et deux guards personnels absents avec la migration `20261025143831`. RLS/GRANT structurels ne remplacent pas une recette A/B.

Auth signup/anonyme off, e-mail/confirmation on, minimum 12, JWT/OTP 3600 s, rotation/reuse 10 s ; `Secure password change` off constitue un écart au contrat local. Custom SMTP off, liens ConfirmationURL des modèles par défaut incompatibles avec callback TokenHash ; source intégrale verrouillée, pas de contournement. Fonctionnalités backups planifiés/PITR absentes du Free affiché ; copies fournisseur/rétention/restauration inconnues. Zéro Edge déployée, verrou du prototype local conservé. Accès admin/MFA/support/contrats effectifs non validés.

Complément R15/R16 : URL API officielle confirmée sans clé ; Passkeys et OAuth Server off, vues Third-Party Auth et Auth Hooks sans configuration ; quota projet e-mail 2/h constaté visuellement et quotas refresh/vérification/connexion lus. Le champ de composition garde un placeholder ; ouvrir sa liste sans sélectionner n'établit pas sa valeur API exacte, qui reste NON VÉRIFIÉE.

Sources officielles Supabase relues : guides CLI/Auth/SMTP/RLS/utilisateurs/URLs/sessions/mots de passe/backups/clés/templates, DPA public du 01/08/2026 et liste générale des sous-traitants du 12/10/2026 accessible en PDF. Applicabilité au contrat et aux flux effectifs non présumée ; aucune consultation PROD pour compléter. Changelog .md refusé par lecteur web puis GET officiel réussi, notices Data API du 30/10 et TLS au plus tôt 10/11 notamment prises en compte. Aucun SDK/CLI mis à jour vers une version plus récente.

## Vérifications locales réellement exécutées

Node **24.22.0**, npm **10.4.0**, `npm ci` et `npx playwright install chromium` réussis ; manifeste/verrou conservés. La reprise après interruption a conservé les résultats ci-dessous et les fichiers d'audit, sans refaire de recette distante.

| Contrôle | Résultat et portée |
| --- | --- |
| `npm test` | **380 tests dans 42 fichiers réussis** ; JS/stockage simulé, pas preuve RLS DEV |
| `npm run test:e2e -- --workers=2` | **73/73 parcours Chromium réussis (1,5 min)**, Python 3.15 système, serveur boucle locale/profils isolés. Premier lancement bloqué au démarrage dans la sandbox, interrompu code 1 ; relance avec permissions adaptées réussie, sans modification des tests ni URL distante |
| SDK | `npm run build:auth-sdk` et `git diff --exit-code -- assets/vendor/supabase.js` réussis ; bundle 2.118.0 identique |
| CLI locale / documentation | CLI absente du PATH. Tentatives npm épinglées en sandbox : ENOTFOUND, aucun résultat de version/aide supposé. Relance autorisée de `npx --yes supabase@2.121.0 db push --help` réussie : ciblage explicite et surtout `--skip-vault` documentés ; **aide seulement**, aucun push/simulation distante/link. Avis de version 2.122.0 ignoré |
| Sécurité Supabase réelle sur ce poste | **NON EXÉCUTÉE** : Docker absent ; aucune tentative de redirection de runner vers DEV/PROD. Preuve SQL/RLS fonctionnelle de cette tête attendue exclusivement de CI éphémère |
| Documentation / artefact / visuel | Contrôles détaillés et résultats de la revue de livraison ci-dessous ; aucune interface applicative modifiée |

Les contrôles documentaires portent sur liens locaux, syntaxe/tableaux/encodage, D01–D14, quinze P0 bloquants, statuts des matrices, couverture des trois migrations/dix tables/quinze fonctions, comparaison des sept corps présents, diff documentaire seulement, absence de secrets/coordonnées dans les ajouts. Les fichiers générés et données minimisées de catalogues restent sous `.tmp/lot652/` ignoré ; aucune sauvegarde de données utilisateur.

L'artefact public est préparé **sans** option auth-config : Auth désactivée, aucune URL/clé, config DEV/env/docs/outils/tests exclus, pas de nouvelle notice présentée comme validée. Le rendu Markdown local des rapports/plans est vérifié sur grand écran et mobile sombre ; captures synthétiques locales ignorées, aucune publication. Voir les mesures réelles de livraison ci-dessous ; le rendu ne certifie pas une accessibilité globale.

### Revue de livraison exécutée

Contrôle local sous `.tmp/lot652/review-checks.json` : **24 documents, 341 liens locaux, 82 tableaux, 37 lignes de matrice, 14 décisions et 15 P0 bloquants**, zéro anomalie. Dix fichiers ajoutés/modifiés, tous Markdown ; sept corps de fonctions présents comparés identiques et quinze fonctions attendues inventoriées. Recherche bornée de secrets/clés/JWT/coordonnées sans signal dans les dix fichiers et les fichiers texte de l'artefact ; ce contrôle par motifs n'est pas une garantie absolue.

Préparateur réel, version `lot6-5-2-audit` : **127 fichiers publics + `.nojekyll`, 292 références versionnées**. SHA-256 de l'inventaire ordonné chemins/contenus : `2cb6f1ac9138cf644463735a969108959b9aa5008d4a6b3676c4e222f45c8dc9`. Défaut Auth off et champs publics vides ; aucun document interne, configuration DEV, secret détecté ou page `confidentialite.html` livré. Aucune réponse du CDN hébergé déduite de ce contrôle local.

Six rendus locaux inspectés : audit clair 1280 px, annexe colonnes 1920 px, plan et recette mobile sombre 390 px, matrice et dossier P0 1600 px. Titres/avertissements présents, tableaux lisibles avec défilement horizontal lorsqu'ils sont larges, aucun débordement du document dans ces variantes. Captures sous `.tmp/lot652/` ignoré. Premier renderer impossible en sandbox (exécutable Chromium dans un autre emplacement) ; relance avec permissions adaptées réussie. `git diff --check` exécuté sans anomalie ; aucun code, SQL, workflow, dépendance, configuration Auth ou JSON de conservation modifié.

## CI sur la tête finale de PR

| Job obligatoire | Preuve de livraison à consigner |
| --- | --- |
| `unit-integration` | Résultat, URL job et SHA final dans la description de la PR de ce lot ; pas un vert historique de #25 |
| `e2e` | Même exigence sur la tête finale ; Chromium autonome local au runner |
| `supabase-security` | Même exigence, y compris arrêt de stack ; pgTAP/Auth/JWT/RLS réels exclusivement éphémères, jamais DEV |

Au moment du commit documentaire, ces exécutions sont **NON VÉRIFIÉES tant qu'elles ne sont pas terminées**. La livraison exige ensuite leurs trois succès sur la tête finale, attestés dans la description de PR avec SHA/URLs/résultats ; éviter un commit supplémentaire qui ne ferait que déplacer la tête pour citer sa propre CI. Tout changement ultérieur impose de contrôler de nouveau sa CI. Aucun échec ni impossibilité ne doit être annoncé comme réussite.

## Interdictions et décisions restantes

Aucune écriture hébergée Supabase, migration/repair/push/dry-run distant/reset/pull/dump, RPC métier, création de compte/session, invitation/e-mail, suppression/déconnexion administrative, changement Auth/SMTP/provider/URLs/secrets/RLS/GRANT/plan/région, Edge déployée, sauvegarde/restauration, consultation PROD, activation Pages, notice définitive, fusion ou règles GitHub modifiées. Le défaut Auth public off, les données/progressions, le JSON de conservation non validé sans purge et les verrous locaux sont préservés. Commit/push/PR sont les seules écritures distantes prévues par la livraison autorisée, dans GitHub.

Avant le lot suivant : autorisation de modification bornée, reprise évaluée sur Free et pièces privées D05/D06/D07/D08/D13 ; valider la seule migration manquante ; décisions de sécurité Auth/SMTP/URLs ; artefact local et boîte d'essai contrôlés ; recette A/B avec créations/envois/nettoyages explicitement autorisés. Clôture assistée et restauration demandent un accord supplémentaire et une méthode sûre. Aucun P0 levé, aucun camarade invité, aucune ouverture autorisée.
