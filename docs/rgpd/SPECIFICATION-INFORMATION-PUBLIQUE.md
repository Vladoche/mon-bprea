# Information publique et publication de la notice

**8 novembre 2026. V1.1 finale proposée, non approuvée et non publiée.** Le fond de la V1.0 a été approuvé le 5 novembre et D12 le 6 novembre. Le texte candidat précise maintenant la région PROD Francfort, le circuit administratif sans envoi automatique et les limites de sauvegarde. Le rattachement contractuel du DPA et des garanties de transfert à l’organisation cible reste une réserve substantielle (PF-01 et partie contractuelle de PF-02). La génération native et la remise individuelle sans nouveau relais sont le circuit demandé dans la mission du 8 novembre ; aucune remise effective n’est déduite. [Matrice courante](../deploiement/PLAN-PREOUVERTURE-PRIVEE.md).

## Aperçu de la version préparée

La [source V1.1 du 8 novembre](POLITIQUE-CONFIDENTIALITE-PROJET.md) produit [confidentialite.html](../../confidentialite.html) avec `npm run build:privacy-notice`. `node scripts/build-privacy-notice.mjs --check` compare le rendu versionné au texte et imprime son empreinte SHA-256 avec fins de ligne LF. Cette empreinte lie l’approbation humaine au texte exact ; un changement de texte exige une nouvelle approbation. Le statut d’approbation reste dans cette fiche et la matrice, sans présenter une notice « en préparation » comme une politique validée sur le site. La présence du fichier dans la PR n’autorise pas sa publication.

La page publique est statique et autonome : sommaire, liens et contact fonctionnent sans JavaScript ni compte. Elle réutilise les styles et la préférence d’apparence de l’appareil via `theme-init.js`, sans client Auth. Sans JavaScript elle suit le mode système. `npm run preopening:notice` conserve un aperçu privé autonome sans script, marqué comme aperçu non approuvé. Les liens externes n’ouvrent leur destination qu’au clic.

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

1. Confirmer les données, destinataires et garanties applicables à la cible et au circuit de remise. Faire approuver les changements substantiels de la V1.1 et le texte qui en résulte. [Preuves fournisseurs restantes](FLUX-ET-PRESTATAIRES.md#preuves-matérielles-restantes).
2. Vérifier la page finale et l’artefact exact avant fusion. Le constructeur `prepare-pages.py` prend les HTML racine, les types autorisés sous `assets/` et les PDF sous `documents/` ; les sources documentaires, outils et aperçus privés sont exclus. Soumettre la notice, ses réserves et la publication à l’exploitant. Aucune fusion ou publication n’est effectuée sans leurs accords.
3. Contrôler publiquement le rendu, les liens et le contact depuis l’URL finale après publication autorisée, puis consigner version, date et preuve. Pour une collecte ultérieure, la notice doit déjà être disponible et remise avant de recevoir une adresse. L’activation et les invitations ont des autorisations distinctes.

## Publication Pages avec Auth PROD

Le [workflow proposé](../../.github/workflows/deploy.yml) retire le déclenchement sur push : **après fusion de cette modification, une fusion ne publie plus Pages**. Seul un `workflow_dispatch` sur `main`, avec `publish_auth_production=true` et le SHA-256 LF de la notice expressément approuvée, peut publier. La confirmation est désactivée par défaut. Ne pas déclencher le workflow ni fusionner la PR au nom de l’exploitant. Les anciens workflows et anciennes versions restent à éviter ; ces contrôles s’appliquent au workflow modifié sur `main`.

Paramètres publics à fournir dans les variables Actions du dépôt (ou dans `github-pages`, en vérifiant les éventuelles surcharges) :

| Paramètre | Valeur attendue |
| --- | --- |
| `PAGES_SUPABASE_PROD_URL` | `https://oqoqrxwfbkhtpksqimgd.supabase.co` |
| `PAGES_SUPABASE_PROD_PUBLISHABLE_KEY` | Clé moderne `sb_publishable_…` reconnue par ce projet ; aucune clé administrative |
| Champs fixés par le constructeur | `enabled: true`, `environment: "production"`, `siteUrl: "https://vladoche.github.io/mon-bprea/"` |

Les deux variables Actions du dépôt ont été configurées et relues le 8 novembre, sans surcharge divergente dans `github-pages`. La clé publique réelle est reconnue par la cible ; une clé synthétique invalide est refusée lors du même contrôle GET. Aucun workflow n’a été déclenché. Empreinte du texte V1.1 soumis : `c2b2422b9c3d6b7ec25227f143080782842c4c077f5a1361d4cd36653ad9b8c1` ; ce relevé n’est pas une approbation.

Le runner vérifie le rendu de la notice, son approbation exacte et les cinq champs autorisés. Il lit seulement `/auth/v1/settings` pour établir que la clé est reconnue par la cible et que les inscriptions/anonyme restent fermés, seul l’e-mail actif avec confirmation. Une erreur réseau ou une divergence bloque avant dépôt de l’artefact. Les redirections de cette requête sont refusées. `scripts/pages_release.py` écrit ensuite un fichier neuf dans `$RUNNER_TEMP` ; `prepare-pages.py --production --auth-config …` le copie uniquement dans l’artefact. Aucun fichier local ignoré n’est attendu sur GitHub. Le défaut `assets/auth-config.json` reste désactivé. Le constructeur refuse aussi les clés administratives modernes, JWT `service_role` et URL SQL avec mot de passe ou preuves Auth littérales détectables dans les fichiers texte publics.

**Impact à approuver :** les visiteurs verront une connexion utilisable avec PROD et la notice V1.1. Les pages pédagogiques et leur mode visiteur restent accessibles. Aucun compte, lien ou inscription publique n’est créé par la publication. Le callback reste `https://vladoche.github.io/mon-bprea/authentification.html`. Après accord, fusion effectuée par l’exploitant et déclenchement autorisé, vérifier les fichiers réellement servis et leur version, pas seulement le statut Actions. La création du compte exploitant et la récupération demandent chacune un accord distinct ; ne pas collecter son adresse avant information approuvée.
