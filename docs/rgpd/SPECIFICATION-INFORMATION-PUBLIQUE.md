# Information publique et publication de la notice

Le [plan de publication](../deploiement/PLAN-PUBLICATION-2027.md) décrit la
procédure opérateur. Le [registre Pages](../deploiement/EXPLOITATION-PRIVEE.md#registre-de-publication-pages)
porte les exécutions et la version effectivement servie.

## Versions et contrôles automatiques

La V1.2 a été approuvée le **20 novembre 2026 à 08:27:51 CET** pour l’empreinte
SHA-256 LF `097bf1e94fe869940d286f78b9900d28f02e13fecc9b08680068ef2a56d2dc57`.
La [validation de l’approbation](../validations/VALIDATION-APPROBATION-NOTICE-V1-2.md)
référence la preuve privée `NOTICE-V12-20261120`. La V1.2 est servie par Pages #67.

La **V1.4** reprend la capacité de la V1.3 intermédiaire et décrit les choix
de « Mon parcours BPREA ». Les contrôles de publication s’appliquent à la
V1.4 selon la même règle qu’à toute version. La V1.2 reste la version publiée
au dernier relevé du registre.

Depuis la décision du 22 novembre 2026, [la règle permanente](../../AGENTS.md#sécurité-git-et-limites-dintervention) s’applique à toute mise à jour documentaire. Git conserve la source, le HTML et leurs versions antérieures. Pour mettre à jour la notice, éditer [la source Markdown](POLITIQUE-CONFIDENTIALITE-PROJET.md), puis exécuter `npm run build:privacy-notice` et versionner les deux fichiers.

`node scripts/build-privacy-notice.mjs --check` contrôle le titre, la version, les rubriques requises, le quota administratif, le contact, les finalités du registre et les dates de conservation. Il vérifie les chemins et ancres du site, ainsi que la syntaxe et le rendu des liens externes. Il compare le HTML généré au HTML versionné et calcule le SHA-256 de la source en LF. La CI et le workflow Pages exécutent cette commande sans dépendance npm ni requête externe. La disponibilité des sites tiers peut être vérifiée en lecture séparément. L’empreinte sert à identifier le texte vérifié dans les journaux et Git.

La page publique est statique. Le sommaire, les liens et le contact fonctionnent sans JavaScript ni compte. La page réutilise les styles et la préférence d’apparence de l’appareil via `theme-init.js`. Sans JavaScript elle suit le mode système. `npm run preopening:notice` produit un aperçu privé autonome sans script. Les liens externes n’ouvrent leur destination qu’au clic.

## Liens préparés pour la mise en ligne

Ces liens sont intégrés dans les sources et la copie de publication locale. Les chemins relatifs fonctionnent sous `/mon-bprea/`. Le pied de page statique et son rendu dynamique offrent « Confidentialité » ; l’accueil et les pages Auth ont aussi des accès contextuels. Aucun lien de notice ne reprend une query ou une preuve temporaire.

| Emplacement | Valeur de href ou référence pour le message | Contrôle attendu |
| --- | --- | --- |
| Accueil `index.html` | `confidentialite.html` | Visible avant le premier usage de la sauvegarde locale |
| Pied de page de toutes les pages et pied de page dynamique | `confidentialite.html` | Présent en navigation clavier, avec et sans JavaScript |
| Connexion `connexion.html` | `confidentialite.html#compte-et-invitation` | Avant la saisie |
| Information individuelle avant l’invitation et message de remise | URL absolue `https://vladoche.github.io/mon-bprea/confidentialite.html` | Preuve privée minimale de version et de date avant collecte de l’adresse |
| Activation et récupération sur `authentification.html` | `confidentialite.html#compte-et-invitation` | Lien disponible aussi si la preuve est invalide ou expirée, sans propagation de la query |
| `mot-de-passe-oublie.html` | `confidentialite.html#compte-et-invitation` | Lisible avant de solliciter l’assistance |
| `profil.html` | `confidentialite.html#vos-droits-et-la-cloture` et `confidentialite.html#stockage-sur-votre-appareil` | À proximité des rubriques correspondantes, même sans session |

## Conditions avant publication

1. Aligner la notice sur les fonctionnalités, flux et décisions effectivement applicables. Actualiser le registre et expliquer les conditions de disponibilité des fonctions. Traiter les écarts d’information et conserver la preuve de l’information des personnes concernées lorsque leur usage des données change. [Preuves fournisseurs](FLUX-ET-PRESTATAIRES.md#preuves-matérielles-restantes).
2. Vérifier les résultats automatiques et l’artefact au SHA de livraison. Le constructeur `prepare-pages.py` prend les HTML racine, les types autorisés sous `assets/` et les PDF sous `documents/`. Appliquer les accords distincts de fusion et de publication, ainsi que les prérequis de mise en service du [plan de publication](../deploiement/PLAN-PUBLICATION-2027.md#phase-a--décision-préalable).
3. Contrôler publiquement le rendu, les liens et le contact depuis l’URL finale après publication autorisée, puis consigner version, date et preuve. Pour une collecte ultérieure, la notice doit déjà être disponible et remise avant de recevoir une adresse. L’activation et les invitations ont des autorisations distinctes.

## Publication Pages avec Auth PROD

Le [workflow](../../.github/workflows/deploy.yml) publie uniquement sur `workflow_dispatch` autorisé depuis `main` avec `publish_auth_production=true`. La valeur par défaut est `false`. Il exécute le contrôle automatique de la notice avant le préflight Auth et la préparation de l’artefact.

Paramètres publics à fournir dans les variables Actions du dépôt (ou dans `github-pages`, en vérifiant les éventuelles surcharges) :

| Paramètre | Valeur attendue |
| --- | --- |
| `PAGES_SUPABASE_PROD_URL` | `https://oqoqrxwfbkhtpksqimgd.supabase.co` |
| `PAGES_SUPABASE_PROD_PUBLISHABLE_KEY` | Clé moderne `sb_publishable_…` reconnue par ce projet ; aucune clé administrative |
| Champs fixés par le constructeur | `enabled: true`, `environment: "production"`, `siteUrl: "https://vladoche.github.io/mon-bprea/"` |

### Preuves historiques de la V1.1, 8 novembre 2026

Les deux variables Actions du dépôt ont été relues le 8 novembre, sans variable de surcharge dans `github-pages` ; cet environnement n’autorise que `main`. La clé publique réelle est reconnue par la cible en GET et aucun fournisseur autre que l’e-mail n’est actif. Les lectures du Dashboard confirment Site URL et unique callback exacts, inscriptions/anonyme fermés, confirmation e-mail active et SMTP personnalisé désactivé. La V1.1 du 08/11 a été présentée via son fichier immuable au commit `316a0773e1ba6e9c0b036ab790389fb16d77821a`, puis approuvée explicitement par l’exploitant. Empreinte SHA-256 LF recalculée avant lancement : `c2b2422b9c3d6b7ec25227f143080782842c4c077f5a1361d4cd36653ad9b8c1`.

**Tentative autorisée du 08/11 à 16:16 CET.** L’accord séparé couvrait un lancement sur `main` à `316a0773e1ba6e9c0b036ab790389fb16d77821a`, avec `publish_auth_production=true` et cette empreinte. Le [workflow #63](https://github.com/Vladoche/mon-bprea/actions/runs/42493926136), déclenché une seule fois, a échoué à « Vérifier le rendu exact de la notice » : l’import du moteur de rendu chargeait indirectement `@supabase/supabase-js` via les outils d’aperçu privé, sans installation npm dans le runner. Les étapes de préflight PROD, préparation, dépôt et publication ont toutes été ignorées. **Aucun commit n’a été publié par cette tentative.** La lecture HTTP après cet échec confirmait l’ancienne publication `d43db22608c8f84c4105060d76fa833dff64bdfd`, Auth désactivée et notice 404.

Le correctif charge les protections de l’aperçu privé uniquement à l’exécution de sa commande. Le rendu public et son contrôle deviennent indépendants des outils administratifs et des dépendances npm ; le workflow, la configuration et le texte approuvé restent inchangés. Un test exécute réellement contrôle et génération dans un dossier isolé sans ces dépendances. La [PR #51](https://github.com/Vladoche/mon-bprea/pull/51), tête `cd73cbbe2c41bcb3f60484b4e27a52bb7682494c`, a été fusionnée humainement le 08/11 à 16:31:56 CET. Son arbre est identique au nouveau `main`, relu avant le second accord ; l’empreinte de la notice est inchangée. Aucun retry automatique ni déploiement de branche.

Validation locale du correctif sous Node 24.22.0 après `npm ci` : **604 tests réussis, 1 ignoré sous Windows ; 113 E2E locaux réussis**, SDK reconstruit identique, contrôle de notice et 79 chemins documentaires valides. Le nouveau test a échoué avant la correction puis réussi. Sur la tête finale de #51, `unit-integration`, `e2e` et `supabase-security` ont réussi : [Qualité](https://github.com/Vladoche/mon-bprea/actions/runs/42494765044), [Auth/RLS sur stack éphémère](https://github.com/Vladoche/mon-bprea/actions/runs/42494764934). Aucun E2E sur PROD ni écriture Auth/SQL de cette mission.

**Publication effective du 08/11 à 16:34 CET.** Après le nouvel accord explicite visant `3952fd5a98705397bb341dc1fa54e0e8f92979d8`, le [workflow #64](https://github.com/Vladoche/mon-bprea/actions/runs/42495467393) a été déclenché une seule fois sur `main`, avec `publish_auth_production=true` et le SHA-256 approuvé ci-dessus. Toutes les étapes ont réussi, y compris préflight, artefact et déploiement. L’artefact contient 136 fichiers publics et 337 références versionnées. Aucun retour arrière nécessaire.

- **HTTP après déploiement :** 19 pages HTML et 94 ressources texte (JS, CSS, JSON, SVG), soit 113 réponses 200, comparées à l’artefact attendu de ce commit après normalisation LF du checkout Windows et du runner Linux ; aucune divergence ni secret détectable par le vérificateur existant. Le rendu servi de la notice correspond au texte approuvé.
- **Configuration réellement servie :** [auth-config.json](https://vladoche.github.io/mon-bprea/assets/auth-config.json), cinq champs prévus seulement, `enabled: true`, `environment: "production"`, URL `https://oqoqrxwfbkhtpksqimgd.supabase.co`, bonne clé `sb_publishable_…` et `siteUrl: "https://vladoche.github.io/mon-bprea/"`. GET `/auth/v1/settings` avec cette clé : inscriptions/anonyme fermés, e-mail avec confirmation. Les refus mutatifs antérieurs n’ont pas été répétés et aucun compte de test n’a été créé.
- **Navigateur hébergé sans compte :** accueil, connexion avec formulaire disponible, profil « Connexion nécessaire », activation sans preuve invalide, récupération assistée, Contact avec lien `mailto:`, notice V1.1, liste/cours pédagogiques, QCM et Drill chargé avec dix questions observés. Callbacks `type=invite` et `type=recovery` sans jeton : URL nettoyée vers le callback exact, état invalide, aucune preuve consommée. Aucune connexion, correction d’exercice ou remise de message effectuée.
- **Rendu et limites :** contrôle visuel ordinateur et mobile 390 px, connexion en sombre, tabulation e-mail → mot de passe, notice mobile sans débordement ; zéro erreur JavaScript observée sur ces navigations. Aucune session réelle, activation invitée, récupération ou persistance PROD démontrée. Les libellés historiques du profil qui annoncent encore le contact comme non validé sont un écart rédactionnel P1 ; les liens Contact et la notice fonctionnent et le parcours sans session reste utilisable.

**Retour arrière contrôlé.** Un échec avant déploiement conserve la version précédente, comme pour #63. Si un artefact incorrect était effectivement publié, suspendre son utilisation et préparer une republication de la version antérieure vérifiée avec Auth désactivée ; passer par revue/fusion humaine et autorisation adaptée, sans changement Auth, RLS ou PostgreSQL. Cette configuration frontend ne révoque aucune session serveur. Aucune opération de retour arrière n’a été nécessaire ni exécutée ici.

Le runner vérifie les cinq champs publics autorisés après les contrôles de la notice. Il lit seulement `/auth/v1/settings` pour établir que la clé est reconnue par la cible et que les inscriptions/anonyme restent fermés, seul l’e-mail actif avec confirmation. Une erreur réseau ou une divergence bloque avant dépôt de l’artefact. Les redirections de cette requête sont refusées. `scripts/pages_release.py` écrit ensuite un fichier neuf dans `$RUNNER_TEMP` pour l’artefact `prepare-pages.py --production --auth-config …`. Le défaut `assets/auth-config.json` reste désactivé. Le constructeur refuse aussi les clés administratives modernes, JWT `service_role`, URL SQL avec mot de passe et preuves Auth littérales détectables dans les fichiers texte publics.

**Effets constatés :** connexion PROD disponible sans session et notice V1.1 publique ; pages pédagogiques et mode visiteur accessibles. Aucun compte, lien ou inscription publique créé. Le callback reste `https://vladoche.github.io/mon-bprea/authentification.html`. La création du compte exploitant et la récupération demandent chacune un accord distinct ; remettre la notice publiée avant de collecter son adresse.
