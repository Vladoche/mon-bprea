# Validation du lot 6.3.1 — backend des données personnelles

Date : 25 octobre 2026. Le [guide d'architecture et contrat](../architecture/PERSONAL-DATA-BACKEND.md) contient l'audit préalable, les décisions SQL et les obligations des futurs clients. Ce rapport distingue les vérifications exécutées de celles attendant leur preuve.

## État initial et périmètre Git

- Répertoire initial propre, sans modification non commitée ; branche initiale `feature/lot6-2-3-dashboard-sync`, HEAD `adb6a148af168ec9a8b2f82c06be926b4e2121e5`.
- `git fetch origin main` réellement effectué ; `origin/main` initial du lot : **`5ab16dbb9dc0cfcd49eae6e7cb72149aae753332`**.
- PR #14 confirmée fusionnée, commit de fusion `858194ca492b61292fd511ca0c8cee8bf392d759` ; PR #15 confirmée fusionnée, commit de fusion `5ab16dbb9dc0cfcd49eae6e7cb72149aae753332`. Les fusions #9, #12 et #13 apparaissent également dans l'historique de `origin/main` (Auth, backend Drill, client Drill).
- Les deux workflows du head précédent `adb6a14` sont confirmés réussis via GitHub : [Qualité](https://github.com/Vladoche/mon-bprea/actions/runs/40184877766), [Sécurité Auth et RLS](https://github.com/Vladoche/mon-bprea/actions/runs/40184877763). Ce sont les preuves de la base fonctionnelle, pas celles de ce lot.
- Branche créée **avant modification** par `git switch -c feature/lot6-3-1-personal-data-backend origin/main`. Une nouvelle vérification après les écritures a confirmé cette branche et le même parent `5ab16db`. Aucune modification ou poussée sur `main`.
- Ruleset actif `Protection main - Qualité`, ID `25489814`, relu en lecture seule : exige `unit-integration`, `e2e`, `supabase-security`. Noms et protections conservés. Aucun merge automatique, déploiement ou modification du ruleset.

## Livraison préparée

| Fichier | Objet |
| --- | --- |
| `supabase/migrations/20261025143831_create_personal_data_backend.sql` | Six tables, relations, RLS, grants, triggers et six RPC invoker |
| `supabase/tests/database/personal_data_backend.test.sql` | Tests pgTAP complémentaires ; suites profils/Drill conservées |
| `scripts/test-personal-data-supabase.mjs` | Sessions Auth locales A/B réelles, PostgREST/RPC et concurrence |
| `tests/fixtures/personal-data.js` | Documents synthétiques représentant les formats audités |
| `package.json` | Commande `test:personal:supabase`, sans nouvelle dépendance |
| `.github/workflows/auth-security.yml` | Nouvelle étape dans le même job `supabase-security` |
| `docs/architecture/PERSONAL-DATA-BACKEND.md` | Audit réel, modèle, sécurité, contrats, compatibilité, pagination et préparation RGPD |
| `README.md`, `docs/TESTS.md`, ce rapport | Liens et procédure de vérification |

La CLI réellement utilisée est **Supabase 2.121.0**, identique à la CI. Son `--version` et `migration new --help` ont été consultés, puis `migration new create_personal_data_backend` a produit le chemin versionné. Aucun préfixe n'a été inventé. Les migrations `20261022000100_profiles.sql` et `20261024083417_create_drill_sync_schema.sql` sont inchangées.

Les modules `assets/`, pages HTML, feuilles de style, calculs pédagogiques et clés de stockage n'ont aucun diff par rapport à `origin/main`. La configuration publique reste `enabled:false`, URL et clé vides. Les singletons ITK/apparence n'introduisent ni bibliothèque de projets, ni historique de documents. Aucun client 6.3.2/6.3.3/6.3.4 n'est implémenté.

## Vérifications locales exécutées

| Vérification | Résultat réellement observé |
| --- | --- |
| Node.js | `v24.22.0` ; npm `10.4.0` |
| `npm ci` | Réussi ; 50 paquets, audit sans vulnérabilité signalée |
| `npx playwright install chromium` | Réussi |
| `npm test` | **159 tests réussis, 20 fichiers**, 2,70 s |
| `npm run test:e2e` | **21 parcours Chromium réussis**, 13,6 s ; serveur local, contextes isolés |
| `node --check scripts/test-personal-data-supabase.mjs` | Réussi |
| Préflight du runner personnel | Refus explicite, exit 1, configuration/stack locale indisponible ; aucun résultat RLS validé et aucun compte créé |
| Docker sur ce poste | Commande indisponible ; stack Supabase réelle non démarrée sur ce poste |
| `supabase test db --local` | Tentative réellement exécutée, exit 1 : connexion refusée à `127.0.0.1:54322` ; aucune cible distante |
| pgTAP et Auth/RLS réels | Non exécutés sur ce poste ; preuves réussies dans la stack Docker locale éphémère GitHub Actions, détaillées ci-dessous |
| Inspection visuelle de régression | Cours et ITK à 1 280 px clair, Dashboard et botanique à 390 px sombre ; captures locales isolées relues, aucun débordement horizontal |

Les E2E autonomes conservent les parcours Drill, Dashboard, botanique, Auth désactivée, ITK, apparence et progression. Leur réussite ne prouve pas RLS. Le SDK navigateur, les mécanismes Auth, le client Drill et le moteur Dashboard n'ont pas été modifiés. Les captures de contrôle restent ignorées dans `.tmp/lot631-*.png`, sans compte réel. Une première tentative visuelle séparée avait rencontré les restrictions réseau du sandbox ; le serveur et Chromium lancés ensemble ont permis le contrôle final réussi. Ce contrôle porte sur le rendu existant, aucun nouveau parcours frontend n'étant livré.

## Scénarios et revue avant CI

Les tests personnels couvrent les opérations effectivement exposées : création/lecture A et B, invisibilité réciproque même avec UUID connu, impossibilité de modifier/supprimer l'autre compte, refus du propriétaire explicite et des dates serveur, visiteur et JWT falsifié sur chaque table/RPC, métadonnées Auth sans valeur d'autorisation, FK botanique entre propriétaires, contraintes et données invalides.

Les courses HTTP utilisent des requêtes réellement simultanées (`Promise.all`) : création identique des quatre domaines modifiables, deux versions d'un cours, deux complétions de session, deux remplacements ITK, deux choix d'apparence, même tentative QCM et même réponse botanique. Les gagnantes sont relues, les révisions contrôlées et les doublons comptés. Une course de réponses distinctes à une session presque pleine vérifie sa capacité sous verrou parent.

Le décochage `true -> false` conserve meilleur score et base ancienne. Deux QCM de mêmes score/total/date avec deux IDs restent distincts. La botanique conserve quatre statuts, permet une fin partielle ou sans réponse, refuse la réécriture de métadonnées et d'une fin déjà établie ; une autre identité technique ne peut dupliquer une question. Les PATCH directs sont soumis aux guards CAS. Les retries exacts gardent révision/date ; les retries divergents ou supersédés ne réappliquent pas une ancienne valeur.

Revue indépendante effectuée sur schéma et tests. Corrections apportées avant livraison :

- Acceptation des surfaces ITK numériques entières en notation `1e2`/`100.0`, sans modification de la chaîne source.
- Conversion des nombres JSON entiers `4.0`/`2500.0` via numeric après contrôle d'intégralité.
- Refus des identifiants constitués seulement d'espaces, tabulations ou espaces insécables.
- Contrôles pgTAP des politiques traitant explicitement les expressions NULL.
- Index d'arrivée sur `created_at` pour les historiques ; contrat précisant qu'un watermark temporel ne garantit pas un ordre de commit et exige des réconciliations complètes.

## Preuves CI du lot

PR [#16](https://github.com/Vladoche/mon-bprea/pull/16), commit initial `8bee6949cacadcd4112802ec4a0a56f4181cf9e9` : [unit-integration et e2e réussis](https://github.com/Vladoche/mon-bprea/actions/runs/40204289581). La stack Supabase a démarré et les trois migrations se sont appliquées sur la base éphémère vierge. [Première exécution sécurité](https://github.com/Vladoche/mon-bprea/actions/runs/40204289616) : 350 assertions pgTAP exécutées, dont 242 personnelles ; deux attentes d'index personnelles restées sur `completed_at`/`started_at` au lieu de `created_at` ont échoué. Les 240 autres assertions personnelles et les 108 antérieures ont réussi. Les deux attentes ont été alignées sur le contrat de pagination sans modifier la migration. La stack a été arrêtée avec succès ; les étapes Auth/API/navigateur ont été ignorées après cet échec, elles ne sont donc pas validées par ce run.

Relance sur `2b201916aae30bece2e3bae95e646f0006491113` : [Qualité réussi](https://github.com/Vladoche/mon-bprea/actions/runs/40204508995). La [stack réelle de sécurité](https://github.com/Vladoche/mon-bprea/actions/runs/40204509022) valide les **350 assertions pgTAP**, les **11 groupes Auth/profils** et les **22 groupes Drill**. Les 22 premiers groupes personnels réussissent, notamment toutes les courses métier et l'isolation des six tables. Le groupe suivant s'arrête sur le code exact de refus d'un PATCH sans filtre. Les écritures directes du runner ont été rendues explicitement ciblées sur la PK ou le propriétaire, comme celles du runner Drill, pour exercer les droits de colonnes et CAS sans dépendre d'un refus préalable de requête globale. Les diagnostics affichent désormais le code et le statut HTTP sans payload ou token. Les refus CAS directs exigent aussi le code `40001`. Aucune politique ou permission n'a été assouplie.

La recette complète réussit sur **`277a76b48f2799bcfab3e8a2ef3855bfc079603c`** :

| Contrôle | Preuve exécutée |
| --- | --- |
| [unit-integration](https://github.com/Vladoche/mon-bprea/actions/runs/40204947126/job/121203779827) | Réussi : 159 tests, SDK navigateur reconstruit sans diff |
| [e2e](https://github.com/Vladoche/mon-bprea/actions/runs/40204947126/job/121203779620) | Réussi : 21 parcours Chromium autonomes |
| [supabase-security](https://github.com/Vladoche/mon-bprea/actions/runs/40204947085/job/121203779691) | Réussi sur la stack locale éphémère, arrêt final réussi |

Ce dernier job valide **350 assertions pgTAP** (242 nouvelles personnelles et 108 profils/Drill conservées), **11 groupes Auth/profils**, **22 groupes backend Drill**, les **26 groupes personnels PostgreSQL/Auth/PostgREST**, puis **6 parcours Chromium avec Supabase réel** (29,1 s). La création initiale sur base vierge, les accès A/B/visiteur/JWT falsifié, les refus des champs techniques et les courses CAS sont réellement exécutés, pas déduits de mocks. Les PATCH ciblés refusent les historiques avec `42501` et les bases de révision invalides avec `40001`, puis acceptent le remplacement légitime avec une seule révision supplémentaire.

Les six parcours réels conservés couvrent invitation/activation/profil/récupération, Dashboard multi-appareils avec cache/hors ligne et entraînements exclus, conflit Dashboard sans double comptage, reprise Auth de la PR #14 sans événement online, Drill multi-appareils avec perte d'acquittement et conflit de snapshots. Les nouveaux domaines n'ont pas de client à tester dans un navigateur au lot 6.3.1 : leurs écritures sont testées directement avec de vrais JWT et PostgREST.

Les preuves ci-dessus concernent exactement le commit fonctionnel indiqué. Le commit suivant ne modifie que ce rapport et un libellé du contrat (arguments RPC tous présents, null explicite autorisé). Les trois mêmes checks doivent aussi être contrôlés sur le head documentaire de la [PR #16](https://github.com/Vladoche/mon-bprea/pull/16) avant livraison ; une réussite sur un ancien commit ne remplace pas ce contrôle. Aucun résultat n'est déduit de la seule présence des tests.

Contrôles finaux locaux : 64 liens Markdown locaux vérifiés, aucune cible manquante ; `git diff --check` sans erreur ; recherche ciblée de clés/tokens privés dans les nouveaux fichiers sans correspondance. Le diff final reste limité aux dix fichiers listés et ne touche aucune ressource frontend ou migration antérieure.

## Limites et interventions suivantes

Les critères d'acceptation sont reliés aux preuves suivantes ; un statut de CI incomplet dans la section précédente reste incomplet pour les critères correspondants.

| Critères | Preuve et portée |
| --- | --- |
| 1–3 : audit réel, adéquation du modèle et quatre domaines | Inventaire des lecteurs/écritures dans le guide, six tables correspondant aux états/historiques/singletons, formats anciens et absences de dates explicités |
| 4–7 : RLS, visiteurs, A/B et relations | pgTAP des grants/policies/FK et requêtes avec JWT réels ; accès croisés testés même lorsque les comptes connaissent les mêmes IDs |
| 8–11 : immutabilité, concurrence, retry et décochage | Guards communs aux RPC/écritures directes, courses HTTP des quatre mutables et des historiques, reprise exacte/divergente/supersédée, `done:false` persistant |
| 12 : invalidités sans destruction locale | Refus serveur testés ; aucun importeur ou code local modifié, sources/archives à conserver selon contrat |
| 13 : contrats utilisables par 6.3.2–6.3.4 | Paramètres et champs JSON, retours dont conflits sans ligne, erreurs, pagination, manifestes QCM, outbox et isolation Auth documentés |
| 14–15 : pgTAP et sessions Auth réelles | Voir exécutions détaillées ci-dessus ; seules les étapes effectivement réussies font preuve |
| 16–17 : régressions et trois contrôles | Résultats Vitest/Chromium locaux et jobs du commit concerné ; preuve finale à vérifier sur le head de PR, sans réutiliser un check ancien |
| 18–20 : frontend et sources inchangés, DEV/PROD préservés | Diff limité aux dix fichiers listés, configuration Auth désactivée, aucune commande ou cible hébergée, aucune fusion/publication |

Les QCM anciens n'ont pas d'ID ni, pour le meilleur score ancien, de date. Le contrat impose un manifeste d'import durable sans déduplication incertaine de copies indépendantes. Les réponses botaniques orphelines et données invalides/futures restent dans la source, refusées sans session ou timestamp inventés. Les mutables ne gardent que le dernier reçu d'opération ; un retry supersédé retourne conflit. La pagination multi-requêtes n'est pas un snapshot global. Les résultats déclarés par le navigateur ne sont pas certifiés.

Les procédures complètes RGPD restent au lot 6.4 et l'ouverture aux étudiants au lot 6.5. Aucune donnée visiteur n'a été importée ou supprimée. Aucun secret ajouté aux fichiers suivis ; les fixtures n'emploient que des données fictives.

**DEV `wcckbyhrtroittbfophv` et PROD `oqoqrxwfbkhtpksqimgd` restent inchangés.** Aucune migration hébergée, création de projet, modification Auth/SMTP, invitation externe ou activation Pages. La fusion de la PR et toute application sur DEV nécessitent une intervention autorisée distincte. Avant DEV : revoir les preuves finales, confirmer référence/cible et historique des migrations, préparer sauvegarde et delta, vérifier les commandes avec la CLI puis obtenir l'autorisation explicite. Les runners destructifs restent réservés à la stack locale dédiée ; PROD reste exclu.
