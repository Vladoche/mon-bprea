# Validation du lot 6.4.2 — consultation et copie sécurisée

État de livraison : **27 octobre 2026**, Europe/Paris. La réussite technique de la copie ne vaut ni conformité RGPD acquise, ni validation des décisions D01–D14, ni ouverture aux étudiants.

## Git, périmètre et préparation

Arbre initial propre, branche `feature/lot6-4-1-rgpd-inventaire-transparence`. Après `git fetch origin main`, création de `feature/lot6-4-2-export-donnees-personnelles` depuis **`ceed63758a6810b9f56ba5eeb5981df087955bba`**. L'historique confirme les fusions [#19](https://github.com/Vladoche/mon-bprea/pull/19), [#20](https://github.com/Vladoche/mon-bprea/pull/20) et [#21](https://github.com/Vladoche/mon-bprea/pull/21). Les six documents 6.4.1 lus dans cette conversation sont inchangés entre leur commit `7d66c8f` et cette base ; la matrice et les architectures de synchronisation ont servi de contrats. `main` n'est pas modifié directement.

Fichiers livrés : six modules/styles `assets/export-*` et `export.css`, montage dans `auth-pages.js`/`profil.html`, deux ajouts ciblés au service Auth, lecteur readonly dans `personal-idb.js`. Tests : modèle, transport, service/IndexedDB, Auth, helpers/fixtures d'export, six E2E autonomes et une recette Supabase réelle ; sélecteur du statut de pseudo borné à sa région dans la recette Auth existante, assertion exacte conservée. Documentation : [architecture et dictionnaire](../architecture/EXPORT-DONNEES-PERSONNELLES.md), [préparation des droits](../rgpd/PREPARATION-DROITS.md), [TESTS](../TESTS.md), README et présent rapport.

Aucune migration, RPC, RLS/GRANT, workflow, optimisation Chromium #20, dépendance ou règle pédagogique modifiée. Aucun secret, fichier d'export personnel ou trace réseau réelle livré. Aucune action d'export vers un tiers, envoi SMTP, invitation réelle, suppression ou lot 6.4.3.

## Contrats et décisions de réalisation

- **Compte** : identité fraîche par `getUser`, génération/UUID figés ; JWT personnel fixé avant chaque page et vérification supplémentaire juste avant téléchargement. Données Auth limitées à six champs connus, jamais session/métadonnées arbitraires. Dix tables SQL, colonnes et filtres explicites.
- **Caches** : seul `accounts.get(scope)` de quatre bases, ouverture/migration absente annulée, readonly ; pas de parcours des autres utilisateurs. Projections connues, intentions et versions conflictuelles conservées dans le fichier ; bruts et champs hors contrat exclus et signalés, originaux intacts.
- **Appareil** : neuf clés visiteur/provenance sélectionnables, avertissement et autorisation explicites, aperçu `textContent` et JSON distinct, propriétaire `unverified`. Ni session ni clés Auth locales lues par ce parcours.
- **Cohérence** : pages de 100 jusqu'au vide, curseurs UUID/textes/composites et microsecondes ; deux passes concordantes, trois maximum. Erreur serveur ou jeu non stabilisé : aucun fichier. Exclusions/erreurs locales : copie déclarée partielle et catégories disponibles explicites. Pas de snapshot transactionnel global annoncé.
- **Bornes** : 100 000 lignes par passe, 20 Mio de JSON final et de serveur par passe, record local borné avant projection, annulation et timeouts. Pas de fichier tronqué. La copie compte reste globalement partielle du fait des données internes prestataires inaccessibles.
- **Remise** : seulement sur clic distinct, Blob/URL objet temporaire révoquée après remise/invalidation/pagehide ; préparation retirée de la mémoire du service après remise ou annulation. Une copie déjà remise au navigateur ne peut pas être rappelée.

## Tests exécutés localement

Node **24.22.0**, npm **10.4.0**. `npm ci` a d'abord échoué dans le bac à sable sur la résolution DNS npm ; l'installation verrouillée a ensuite réussi dans le contexte d'exécution autorisé. Aucun changement de dépendance. Chromium utilise l'installation du verrou existante ; pas de modification des workflows d'installation.

| Contrôle | Résultat réel / portée |
| --- | --- |
| `npm test` | **352 tests, 38 fichiers réussis** : les 329 antérieurs plus 23 contrôles ciblés. Auth/mocks ne sont pas une preuve RLS. |
| Tests nouveaux modèle/transport/service/Auth | Conservation des null/false/zéro/microsecondes, dix tables, absence de secrets/ligne B, DTO de caches, archives/provenances, source visiteur, formats futurs/corrompus, IDB refusé/futur/bloqué et annulation, volume, identité fraîche et génération. |
| Pagination | 0, 1, 100, 101 et 251 tentatives ; serveur plafonnant à 7 lignes ; dernière page vide, erreur tardive, page répétée, 401/403, propriétaire étranger, mutation entre passes et limite de trois passes. |
| `npm run test:e2e` | **59 parcours réussis en 35,4 s** : 53 antérieurs et six nouveaux, dont la non-régression du message pseudo. JSON réellement téléchargés puis parsés, pas seulement un bouton affiché. |
| Répétition ciblée | **15/15** : cinq parcours d'export répétés trois fois après correction de l'isolation de la fixture readonly. Aucun retry global ajouté. |
| SDK | `npm run build:auth-sdk` et `git diff --exit-code -- assets/vendor/supabase.js` : SDK verrouillé reconstruit sans changement. |
| Liens/Markdown/secrets/diff | **90 liens locaux** dans les guides/README concernés, tableaux, encodage, `git diff --check` et recherche ciblée de secrets : aucune valeur détectée ; pas une garantie absolue d'absence de tout secret. Artefact préparé : **121 fichiers publics, 272 références versionnées**, sans docs/tests/config locale/copie personnelle et avec Auth désactivée. |

Une exécution intermédiaire a fait **57 succès / 1 échec** : comparaison des quatre caches pendant qu'un service de synchronisation ordinaire terminait sa propre mise à jour. La fixture de conservation stoppe désormais les services ordinaires avant de poser ses données synthétiques, puis conserve les assertions de non-écriture. Le code d'export en production ne les arrête pas : les mutations concurrentes sont traitées par les passes bornées. Le transport et l'orchestrateur sont testés séparément avec modifications/insertion et réponses tardives. La suite complète et les quinze répétitions suivantes ont réussi.

Essai complémentaire sans écriture ni réseau : projection/sérialisation des dix tables fictives, **10 000 QCM / 10 009 lignes**, JSON UTF-8 de **3 778 539 octets**, **62 ms** sur Node 24 de ce poste. Il mesure seulement ce traitement en mémoire, pas la pagination réseau, le pic mémoire ou les performances de tous les navigateurs.

## Recette Chromium et inspection

Les six parcours vérifient : dix tables et 205 QCM ; A→B→A avec réponse A retenue puis libérée ; échec tardif suivi d'un nouvel essai ; annulation au clavier et focus rendu au bouton de préparation ; refus d'identité avant remise ; sélection et consultation visiteur avec archives étrangères exclues ; quatre caches et record étranger laissés intacts ; message de modification du pseudo indépendant des statuts de copie. Les données ne sont jamais insérées comme HTML.

Matrice synthétique : compte prêt, préparation, export incomplet, annulation, session refusée et visiteur, chacun en **1280/390 px, clair/sombre**. Vingt-quatre captures de la section sous `.tmp/export-visual/`, inspection des catégories, boutons et aperçus ; absence de débordement global vérifiée dans chaque variante. Les captures ne contiennent que des fixtures et aucun token. Les traces, vidéos et captures automatiques d'échec sont désactivées pour les nouvelles copies ; les JSON ne sont pas déposés comme artefacts CI ou dans Pages.

## Auth/RLS réel et CI

**Docker absent sur ce poste** (`Get-Command docker` ne trouve aucune commande). Aucune stack réelle locale n'a pu être lancée ; aucun accès DEV/PROD utilisé comme remplacement. La nouvelle recette [tests/e2e-supabase/export.spec.js](../../tests/e2e-supabase/export.spec.js) reste incluse automatiquement dans le job `supabase-security`, sans modifier sa configuration, les 350 assertions pgTAP ni les suites précédentes.

Elle crée deux comptes fictifs dans la stack éphémère autorisée, peuple les dix tables sous JWT étudiant via RPC/INSERT permis, dont **205 tentatives A et deux B**, vérifie SELECT propre/étranger et refus anonyme, télécharge et parse A puis B, conserve un cache personnel en attente, compare les tables avant/après sous JWT étudiant, puis déconnecte pendant une lecture retenue. Les seules opérations d'administration sont celles du helper local gardé de création/nettoyage des fixtures. Aucun rôle administratif pour les assertions de propriété, ni réponse Auth/SELECT synthétique. Seuls les envois RPC de l'interface sont interrompus pour garder une intention locale non livrée ; les lectures réelles, RLS, Auth et fichier exporté restent réels. Erreurs rapportées par étape sans données, clé, session ou contenu de fichier.

La preuve d'exécution de cette recette et des trois contrôles **`unit-integration`, `e2e`, `supabase-security`** sera celle du **dernier SHA de la PR**. Les résultats finaux, SHA exact et liens des jobs sont consignés dans sa description après observation, sans créer un nouveau commit seulement pour citer son propre résultat CI. Une CI non terminée ou un résultat d'un ancien commit ne vaut pas validation ; aucune réussite Supabase réelle n'est déduite ici des mocks ou de la seule présence du fichier de test.

Premier run réel sur `da7f34c` : [job sécurité](https://github.com/Vladoche/mon-bprea/actions/runs/40554754068/job/122367701701), pgTAP réussi, nouvelle recette d'export réelle réussie en 4,3 s, **24 parcours réussis / 1 échec** et arrêt de stack réussi. Le sélecteur historique `main.getByRole('status')` était devenu ambigu après ajout des deux messages de copie sur le profil ; il est désormais limité à la région « Compte personnel », sans changer le texte attendu. Un parcours synthétique reproduit cette coexistence et a aussi révélé un message initial de copie non rafraîchi après restauration Auth : l'interface le rétablit maintenant lorsque le compte est vérifié. Les contrôles doivent tous être rejoués sur le commit corrigé ; ce premier run n'est pas déclaré vert.

## Acceptation et restrictions

Les contrats/test locaux couvrent les critères 1–24 et 30 dans leur périmètre documenté ; 25 et 27 exigent les preuves CI réelles sur la tête finale, 26 exige les suites complètes conservées. Les références de ces preuves figurent dans la PR à livraison. Aucun critère d'exhaustivité ne s'étend aux données Auth internes, logs, backups, archives non attribuables ou autres appareils.

DEV et PROD : aucune commande ni appel de cette session sur ces projets, aucune migration appliquée, aucun compte réel créé, aucune configuration SMTP/Auth modifiée. `assets/auth-config.json` reste désactivé ; il n'y a ni ouverture étudiante, ni fusion, ni déploiement. D01–D14 et la politique de confidentialité restent non validées ; la suppression/conservation et la recette juridique finale attendent 6.4.3/6.4.4.
