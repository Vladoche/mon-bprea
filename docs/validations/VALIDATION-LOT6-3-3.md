# Validation du lot 6.3.3 — synchronisation botanique

Date : 26 octobre 2026. Le [guide client](../architecture/BOTANICAL-SYNCHRONISATION-CLIENT.md) décrit le contrat et les limites. Les résultats ci-dessous distinguent les tests effectivement exécutés, les simulations HTTP et les essais PostgreSQL réels.

## Base et périmètre

- Répertoire initial propre, branche `feature/lot6-3-2-sync-cours-qcm`, HEAD `254aebbec1d0b33f0fe4334b5f0f08e0bc51356a`.
- PR [#17](https://github.com/Vladoche/mon-bprea/pull/17) vérifiée fusionnée par l’API GitHub. `git fetch origin main` effectué ; dernier `origin/main` initial : **`b647a71609b82cdb2dfcfa415def246b4f6400cb`**, exactement le commit de fusion annoncé.
- Branche créée avant modification : **`feature/lot6-3-3-sync-botanique`**, depuis cet `origin/main`. Aucune modification directe de `main` ni donnée utilisateur préexistante touchée.
- `AGENTS.md`, conventions de tests, validations 6.3.1/6.3.2 et contrats client/backend relus. Audit des modules botaniques, catalogue, styles, sources, Auth et infrastructures cours/QCM/Drill effectué ; primitives réutilisées décrites dans le guide.
- Ruleset **Protection main - Qualité**, ID `25489814`, relu en lecture seule le 26 octobre : actif, exige exactement `unit-integration`, `e2e`, `supabase-security`. Aucune protection modifiée.

## Fichiers livrés

| Fichiers | Objet |
| --- | --- |
| `assets/botanical-sync-model.js` | Normalisation, outbox, dépendances, idempotence, CAS, projection et archives |
| `assets/botanical-personal-store.js` | Repository IndexedDB utilisant la primitive transactionnelle existante |
| `assets/botanical-import.js` | Prévisualisation, manifeste durable et refus non destructifs |
| `assets/botanical-sync-service.js`, `assets/botanical-sync-transport.js` | Identité active, JWT fixé, retry, scans complets et deux RPC |
| `assets/botanical-sync-ui.js`, `assets/botanical.js`, `assets/botanical.css` | Source active, suivi accessible, import/conflits, erreurs de sauvegarde et jeu préservé |
| `tests/unit/botanical-sync-model.test.js`, `botanical-sync-transport.test.js` | Contrat, ordre, révisions, idempotence, pagination et confirmations |
| `tests/integration/botanical-personal-store.test.js`, `botanical-sync-service.test.js` | Atomicité, rechargement, concurrence, import et identité |
| `tests/e2e/botanical-sync.spec.js`, `botanical-api.js`, `tests/helpers/botanical-browser.js` | Chromium avec vrai IndexedDB et HTTP synthétique isolé |
| `tests/e2e-supabase/botanical-sync.spec.js` | Six recettes A–F avec Auth/PostgREST/PostgreSQL locaux réels |
| `.github/workflows/auth-security.yml` | Libellé de l’étape navigateur actualisé ; même job et même stack éphémère |
| Guides botanique/client, README, `docs/TESTS.md`, ce rapport | Architecture et preuves |

Moteur, `calculateStats()`, catalogue, photos, crédits, store visiteur, modules partagés, dépendances/verrou, migrations/RPC/RLS et `assets/auth-config.json` inchangés. La configuration publique reste `enabled:false`, URL et clé vides.

## Vérifications locales

| Vérification | Résultat observé |
| --- | --- |
| Node / npm | Node **24.22.0**, npm **10.4.0** |
| `npm ci` | Réussi, 50 paquets, audit sans vulnérabilité signalée |
| `npx playwright install chromium` | Réussi |
| `npm test` | **279 tests réussis, 28 fichiers**, dont les 222 antérieurs conservés |
| `npm run build:auth-sdk` puis comparaison Git | Réussi, aucun diff du SDK verrouillé |
| `npm run test:e2e` | **39 parcours Chromium réussis**, 23,4 s ; les 28 antérieurs sont conservés |
| Docker / stack réelle sur ce poste | Docker absent ; aucune stack Supabase démarrée ici |
| Préflight `npm run test:e2e:supabase -- --list` | Refus explicite : confirmation/configuration locale dédiée absente ; aucun essai distant substitué |
| Supabase réel | Validation réservée à la stack locale éphémère de CI, preuves ci-dessous |

Une première passe complète a réussi 35 parcours. Après extension, une passe a réussi 36/37 et révélé une fin de session dépendant indéfiniment d’une réponse conflictuelle déjà résolue. La correction distingue les dépendances actives des archives explicitement acceptées ; les anciennes opérations restent immuables. Les régressions modèle/service vérifient une nouvelle fin à révision 2, sans double réponse ni réapplication de l’ancienne intention.

La revue a également corrigé le résumé de session après réconciliation distante, les réglages pendant la transaction initiale, les retours d’écriture après masquage du cache et la sortie explicite d’une correction immédiatement conflictuelle. Un retry de la même intention conflictuelle réutilise son opération et son archive.

Contrôles finaux avant la première poussée : `git diff --check` sans erreur, 62 liens Markdown locaux vérifiés, recherche ciblée de clés privées/tokens dans les 22 fichiers modifiés sans correspondance. Le SDK a été reconstruit sans diff ; les fichiers pédagogiques, partagés, de configuration et SQL listés plus haut ont été comparés à `origin/main` sans changement.

## Scénarios et intégrité

- Persistance : création, réponse, fin et import atomiques ; rollback de `put`, UUID/payload stables après réouverture, deux onglets sérialisés, cache futur conservé physiquement et dépendances corrompues refusées.
- Historique : quatre statuts ; sessions partielles, sans réponse et non automatiquement terminées ; questions distinctes d’une même plante ; erreurs disponibles après révision réussie. Le taux réutilise exclusivement le moteur existant.
- Synchronisation : création avant réponse, toutes les réponses avant fin ; perte d’acquittement, retry exact, CAS, ancien reçu supplanté, collisions de sessions/questions, parents absents et dates impossibles conservés sans correction silencieuse.
- Lecture : pages bornées, microsecondes, erreur de page sans remplacement du cache, passes complètes retrouvant les insertions tardives. Les statistiques dédupliquent par question.
- Confidentialité : scopes environnement/projet/UUID, visiteur→A, A→déconnexion/B, B→A, panne avec identité locale fiable, rejet/expiration, reprise Auth et retour tardif d’A. Aucun token dans l’outbox.
- Import : aperçu/annulation sans opérations, confirmation, scan frais obligatoire, manifeste brut+provenance+identités, reprise sans doublon, orphelines exclues sans parent inventé, formats futurs/corrompus conservés, copies ambiguës refusées et archivées durablement.
- Visiteur sans Supabase : parcours initiaux conservés, sources futures/corrompues intactes ; choix explicite de jouer en mémoire avec messages de non-sauvegarde, sans transfert au compte.

Ces tests applicatifs n’établissent pas RLS. La présence des recettes réelles ne signifie pas qu’elles ont réussi.

## Inspection visuelle réellement effectuée

Les **28 captures** de `.tmp/botanical-visual/` ont été ouvertes et inspectées : états `visitor`, `personal`, `chrono`, `offline`, `import`, `conflict`, `storage-error`, chacun à **1280 px et 390 px**, en clair et sombre. Elles viennent de données synthétiques, du vrai IndexedDB Chromium et du catalogue/JPEG local, avec un transport HTTP simulé ; aucune capture n’est présentée comme un essai Supabase réel.

Choix et photo lisibles, correction et crédits visibles, messages et boutons adaptés, dialogue d’import défilable, absence de débordement horizontal global contrôlée. Les tables conservent leur défilement horizontal interne sur mobile. Les tests vérifient focus de correction, navigation clavier, conservation du choix/photo/focus/chrono pendant une synchronisation et retrait du jeu privé au changement de compte. Les captures restent ignorées, sans historique réel.

## CI et Supabase réel

Les liens des trois jobs et leurs résultats sur le commit fonctionnel puis le dernier commit de la PR seront consignés après leur exécution. Aucun succès n’est déduit d’une ancienne PR ou d’un mock.

Les six nouvelles recettes utilisent uniquement les fixtures gardées de la stack `mon-bprea-lot6-1-local` :

| Recette | Assertions prévues dans le navigateur et PostgreSQL |
| --- | --- |
| A | Deux appareils, deux réponses puis révision distincte, historique et taux identiques |
| B | Session complète hors réseau, reload, UUID durables, perte HTTP après commit réel, fin CAS et zéro doublon |
| C | Correct/incorrect/timeout/image indisponible, dénominateurs exacts, révision partielle et session sans réponse |
| D | A/B/visiteur sur le même navigateur, masque de partie, SELECT croisés RLS et refus de réécriture |
| E | Deux sessions importées volontairement, orpheline/brut conservés, interruption/reprise et second appareil |
| F | Réponse gagnante réellement inscrite sous la même identité, archive divergente, décision explicite et résultats réconciliés |

Les suites antérieures pgTAP, Auth/profils, backend Drill/personnel et les dix recettes Supabase navigateur sont conservées. Leur résultat effectif est à relever dans le même job `supabase-security`.

## Limites et environnements

Le cache n’est pas chiffré et reste accessible à une personne contrôlant le profil du navigateur, une extension ou un XSS. Sans service worker, pages/modules/photos doivent être disponibles pendant une panne API. Pas de reprise de partie après fermeture ou sur un autre appareil ; pas de choix de questions reconstitués. Les conflits ne sont pas fusionnés automatiquement ; la version écartée reste archivée. Le visiteur en mémoire perd ses résultats non sauvegardés à la fermeture, avec avertissement explicite.

**Aucune migration ni modification des projets DEV `wcckbyhrtroittbfophv` ou PROD `oqoqrxwfbkhtpksqimgd`.** Aucun runner contre ces projets, nouveau projet, Auth/SMTP hébergé modifié, mail externe, étudiant invité, authentification publique activée, protection modifiée, fusion ou déploiement. Le lot 6.3.4 n’est pas commencé. Les préparatifs de confidentialité et l’ouverture étudiante restent soumis aux lots 6.4/6.5.
