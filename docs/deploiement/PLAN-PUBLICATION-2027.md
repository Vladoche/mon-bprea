# Plan de publication Mon BPREA 2027

Ce plan prépare le prochain cycle sous autorisation de l’exploitant. Le
[registre Pages](EXPLOITATION-PRIVEE.md#registre-de-publication-pages) donne
la version effectivement servie. La
[recette de préproduction 2027](../validations/VALIDATION-RECETTE-FINALE-2027.md)
et la [validation de l’approbation V1.2](../validations/VALIDATION-APPROBATION-NOTICE-V1-2.md)
conservent les résultats de la campagne du 20 novembre.

## Phase A — Décision préalable

| Prérequis | État et preuve à obtenir avant lancement |
| --- | --- |
| Version et revue | Consulter le [SHA vérifié et les changements fusionnés](../developpement/ETAT-DU-PROJET.md). Retenir le **SHA complet effectivement sur main**, vérifier les checks et comparer avec le SHA publié dans le registre Pages. Rejouer les vérifications affectées. [Checklist](../validations/CHECKLIST-RECETTE-FINALE-2027.md). |
| Notice | Vérifier les [contrôles automatiques de la notice](../rgpd/SPECIFICATION-INFORMATION-PUBLIQUE.md#versions-et-contrôles-automatiques) au SHA de livraison. Informer les personnes concernées avant application des changements importants de l’usage de leurs données. |
| Schéma applicatif | Vérifier sur PROD les sept entrées du registre, les onze tables applicatives et leurs droits selon la [séquence Parcours](../architecture/RUNBOOK-SUPABASE-PROD-6-6-0.md#mise-en-service-de-mon-parcours-bprea). Qualifier la synchronisation avec des comptes fictifs sur Supabase local. Le workflow Pages contrôle Auth et la notice. |
| Sauvegarde et journal | Vérifier sur le poste opérateur que l’Admin reconnaît le [point restaurable du schéma Parcours](EXPLOITATION-PRIVEE.md#requalification-après-migration), ses empreintes, ses dépendances, son journal d’effacements et l’âge du snapshot. |
| Paramètres et accès | Relire le projet PROD autorisé et ses réglages dans le runbook, les deux variables publiques Actions, l’origine HTTPS et le callback exact. Le dernier contrôle opérateur daté du 18/11 reste une preuve historique. Vérifier le [plafond administratif](../rgpd/CADRAGE-MON-BPREA.md#périmètre-acté), invitations en attente comprises. [Contrat Auth](../architecture/AUTHENTIFICATION.md). |
| Liens individuels et droits | Admin 2.2 est qualifié pour le renouvellement local sur le même UUID. Le réglage PROD à 86 400 s et le renouvellement réel requièrent un mandat distinct. Confirmer le circuit de récupération et le traitement assisté des droits. La suppression depuis le binaire PROD reste bloquée. [Qualification Admin 2.2](../validations/VALIDATION-ADMIN-INVITATIONS-EXPIREES.md) · [Circuit droits](../rgpd/PROCEDURE-DEMANDES-ET-INCIDENTS-PROJET.md). |
| Canal de contact | L’accès public et le lien de messagerie ont été vérifiés. Relire les preuves opérateur de maîtrise, protection, récupération, consultation et réception/réponse qui manquent au relevé local du 20/11. [Dossier opérateur et contact](EXPLOITATION-PRIVEE.md#dossier-opérateur-et-contact). |
| Repli et réserves | Vérifier les conditions du repli ci-dessous, l’état du site réellement servi et le traitement des réserves. Préparer les parcours hébergés et le compte de l’exploitant si leur exercice est explicitement autorisé. |
| Accord de publication | L’exploitant date son autorisation de publication pour le SHA de `main` et la fenêtre de lancement. Consigner aussi le mandat de recette connectée et les décisions distinctes d’accueil et d’invitations. |

## Phase B — Exécution future sous autorisation

1. Vérifier que `refs/heads/main` correspond encore au SHA autorisé et que
   le [workflow Pages](../../.github/workflows/deploy.yml) est actif avec
   l’environnement `github-pages`. Contrôler le rendu avec
   `node scripts/build-privacy-notice.mjs --check`. Si `main` a bougé,
   comparer les changements à la version qualifiée et rejouer les contrôles
   affectés. Faire confirmer le SHA de déploiement avant tout lancement.
2. Dans **Actions → Publier le site BPREA → Run workflow**, choisir **main**
   et fournir `publish_auth_production=true`.
   `PAGES_SUPABASE_PROD_URL` et
   `PAGES_SUPABASE_PROD_PUBLISHABLE_KEY` sont les variables publiques
   du dépôt ou de l’environnement. Vérifier les surcharges éventuelles.
   L’origine attendue est `https://vladoche.github.io/mon-bprea/` et le
   callback est `https://vladoche.github.io/mon-bprea/authentification.html`.
3. Vérifier aussitôt le `head_sha` et
   le déclencheur `workflow_dispatch`. En cas d’écart, arrêter le run avant
   déploiement et vérifier ce qui est servi. Suivre le contrôle du rendu, le
   préflight `/auth/v1/settings` en GET, le build `--production` et le dépôt
   de `github-pages`. L’artefact ne contient que les cinq champs publics
   Auth attendus. Consigner l’ID, la tentative, l’artefact, le SHA et la fin
   UTC du job de déploiement. Après un échec, vérifier le site et diagnostiquer
   l’étape avant de décider d’une nouvelle tentative.
4. Vérifier sans session la notice correspondant au SHA publié, Contact, les routes directes,
   les menus, les cours, les ressources images/PDF et le callback sans
   preuve personnelle. Contrôler un navigateur neuf et un onglet existant
   après rechargement normal puis forcé, le SHA dans les CSS/JS/JSON et les
   en-têtes de cache. Comparer les cinq champs publics à la cible autorisée.
5. Pour la recette connectée autorisée, l’exploitant utilise son propre
   compte existant. Vérifier depuis le profil et un second navigateur la
   lecture des historiques et l’état des confirmations distantes. Faire les
   seules écritures expressément autorisées. Noter les résultats sans adresse,
   lien d’accès, identifiant personnel ni données pédagogiques. Consigner les
   limites dans le registre et l’état du projet.

## Candidat qualifié le 22 novembre 2026

Le build de `6e63090061cc80ae87d90cdbdeb78e160bcf137b` a contrôlé
169 fichiers finaux, 360 références versionnées, les cinq champs publics Auth,
la notice V1.4 et l’accès à Parcours depuis le Profil. Les cinq checks de la
PR #89 ont réussi. Les parcours critiques et l’isolation par compte ont été
vérifiés sur une stack Supabase locale avec des comptes fictifs. Le backend
Parcours et la sauvegarde restaurée ont été vérifiés sur PROD.

La notice passe les contrôles automatiques sans approbation documentaire
séparée. La publication attend l’autorisation de déclencher le workflow.
Vérifier le SHA effectivement sur `main` avant le lancement selon la phase B.
[Checks de la PR](https://github.com/Vladoche/mon-bprea/pull/89/checks) · [Qualification PROD](EXPLOITATION-PRIVEE.md#qualification-prod-du-22-novembre-2026).

## Retour arrière frontend

**Repli répété localement lors de la campagne du 20 novembre** — workflow [#64](https://github.com/Vladoche/mon-bprea/actions/runs/42495467393),
succès le **08/11/2026 à 15:34:30 UTC** sur
`3952fd5a98705397bb341dc1fa54e0e8f92979d8`. L’API de ce run renvoie zéro
artefact téléchargeable au relevé du 20/11. La recette a reconstruit le repli
depuis Git et s’appuie sur le relevé HTTP de la V1.1. L’empreinte approuvée
associée est `c2b2422b9c3d6b7ec25227f143080782842c4c077f5a1361d4cd36653ad9b8c1`.
La configuration servie active Auth PROD sur l’origine Pages et le callback
ci-dessus, avec clé publishable. Le fichier de configuration des sources
reste désactivé.

1. Stopper les nouvelles invitations en cas d’incident. Relever le SHA servi,
   les pages et les symptômes. Conserver les opérations locales en attente.
   Pour un incident Auth ou de données, traiter le confinement serveur sous
   mandat distinct. Le repli du frontend conserve la base, les sessions et
   leurs échéances.
2. Si le repli est nécessaire, créer depuis `main` une branche de correction
   dédiée. Préparer une PR qui restaure le **périmètre public vérifié** depuis
   le commit de repli choisi. Aligner la notice sur les traitements qui
   s’appliqueraient après le repli, puis régénérer le HTML. Conserver les
   contrôles automatiques du workflow actuel. Comparer les URL, les contrats
   de données, les clés et les migrations. Préserver les migrations et
   politiques appliquées. Qualifier les écarts entre la référence historique
   et le périmètre de repli.
3. Rejouer à partir de dossiers neufs. Pour chaque SHA, extraire les sources
   avec `git archive`, exécuter le contrôle de notice puis
   `python scripts/prepare-pages.py --version <SHA> --auth-config <fixture-locale> --output <dossier-neuf>`.
   Sur le même hôte local et au même préfixe `/mon-bprea/`, servir le repli,
   produire une progression fictive, servir le candidat puis revenir au
   repli en gardant le même contexte navigateur. Vérifier les routes, photos,
   PDF, versions et historiques à chaque étape. Avec Auth et une stack
   fictive, créer une opération en attente avant le passage et confirmer son
   écriture unique après retour réseau. [Résultats de la répétition](../validations/VALIDATION-RECETTE-FINALE-2027.md#artefact-cache-et-repli).
4. Faire revoir le repli, obtenir l’accord sur la fusion et une nouvelle
   autorisation de publication. Le workflow actuel accepte uniquement
   `main`. Il publiera le SHA du nouveau commit de repli, avec des URL
   `?v=` correspondant à ce SHA. Contrôler son artefact et refaire les
   vérifications de la phase B, puis tracer l’incident et la version servie.

Un ancien onglet peut continuer à utiliser le document et les ressources
déjà chargées. Une URL portant un ancien `v` ne réserve pas les anciens
octets si le fichier doit être relu sur l’hébergeur. Les mesures du cache
local bornent le scénario vérifié. La visibilité sur Pages dépend de la
revalidation chez l’hébergeur et dans chaque navigateur.
[Contrat de cache](../architecture/CACHE.md).
