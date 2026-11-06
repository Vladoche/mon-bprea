# Validation du lot 6.5.5.F — D12 et fiabilité des imports

**6 novembre 2026.** Branche `feature/lot6-5-5f-d12-residus-archives` créée depuis `origin/main` vérifié après fetch, à `7b10aa6f26c55be750ed77bb8ff69310be13445f` (fusion de la PR #38). Le worktree était propre. La livraison est une pull request à examiner.

## A. Invariants existants

Le cache personnel est cloisonné par environnement, origine Supabase et UUID Auth. L’aperçu est distinct de la confirmation et l’identité est revérifiée. IndexedDB applique `privacy[scope]` et son époque avant la transaction du compte. Les imports acceptés écrivent ensemble le manifeste, les correspondances et les opérations. Le texte d’origine des imports acceptés est utilisé pour le rejeu exact et pour contrôler les correspondances avec les tentatives ou les sessions. Le marqueur `localStorage` sert à reconnaître une source de l’appareil. Sa frontière de transaction est distincte d’IndexedDB.

Une intention de réglage jamais envoyée peut être remplacée par un autre choix. Une intention envoyée dont l’acquittement est incertain conserve son UUID, sa charge RPC, ses tentatives, son diagnostic de livraison, son échéance de retry, sa révision et sa dépendance. Le prédécesseur confirmé reste disponible tant qu’un enfant l’attend. Un conflit ouvert conserve l’intention, le dernier choix local pertinent et la ligne distante pour la résolution. La révision distante est le point de départ d’une éventuelle nouvelle intention. Les deux singletons serveur gardent le reçu de leur dernière opération et le contrôle CAS continue de s’appliquer.

## B. Corrections

| Composant | Avant | Après | Justification | Test |
| --- | --- | --- | --- | --- |
| Réglages, intention remplacée ou opération confirmée sans dépendant | Copie complète archivée, dont les deux charges et le diagnostic | Reçu versionné dès que la nouvelle opération quitte la file. UUID, domaine, type, révision attendue et prédécesseur éventuel | Tracer le sort de l’intention. L’envoi et sa confirmation utilisent la file active, la révision et le serveur | [Modèle et retry exact](../../tests/unit/settings-model.test.js) |
| Réglages, dépendances bloquées et conflits résolus | Copies du choix et de l’opération dans plusieurs archives, même après fin d’affichage | Reçu pour un nouveau dépendant résolu. Versions et opération de référence complètes pour les huit derniers conflits résolus affichés. Reçu de résolution ensuite, pour les conflits de forme connue | Les écrans et l’export v1 utilisent les versions récentes et la référence exacte. Le choix, les révisions et les identifiants suffisent pour tracer une résolution sortie de l’interface | [Conflit et rangement](../../tests/unit/settings-model.test.js), [export v1](../../tests/unit/restore-conflict-roundtrip.test.js), [parcours réglages](../../tests/e2e/settings-sync.spec.js) |
| Archives des réglages | Éviction à la vingt-et-unième archive | Ajout sans éviction. Le compteur historique reste lisible | L’écriture d’un nouveau reçu doit préserver les anciennes preuves | [Record mixte relu et prolongé](../../tests/integration/settings-store.test.js) |
| Refus d’import botanique | Texte brut, provenance et message complet dans le cache. La reconnaissance servait au dédoublonnage du refus lorsqu’une collision était toujours visible | UUID du refus et de la provenance, code de motif et empreinte v1. Un refus de la même source bloque encore après changement de marqueur. Une identité déjà présente dans une opération reste ambiguë même si la projection a changé | Conserver le refus et son diagnostic, y compris si une ancienne opération n’est plus visible. Le manifeste exact d’un import accepté reste la seule preuve de rejeu | [Cache botanique](../../tests/integration/botanical-personal-store.test.js), [service](../../tests/integration/botanical-sync-service.test.js), [Chromium](../../tests/e2e/botanical-sync.spec.js) |
| Confirmation cours/QCM et botanique | La décision de rejeu s’appuyait d’abord sur le manifeste en mémoire | Source figée et recontrôlée dans la transaction. Le chemin de rejeu exige encore le manifeste exact dans le record durable. Un résultat arrivé après invalidation de l’aperçu est écarté dans l’interface | Un cache en mémoire ou un UUID seul ne doit pas créer un nouvel import hors ligne | [Pannes et rejeu](../../tests/integration/import-provenance.test.js), [cours et QCM Chromium](../../tests/e2e/course-quiz-sync.spec.js) |
| Refus botanique pendant une bascule | Un refus commis pouvait remonter un succès local générique après changement de compte | Le résultat reste un refus et le détail reste dans la portée d’origine | La preuve du refus dans A ne doit pas annoncer un import dans B | [Bascule après commit](../../tests/integration/botanical-sync-service.test.js) |

## C. Minimisation et consommateurs

| Producteur et état | Lecteur et contrat | Champs conservés et conséquence d’un retrait prématuré |
| --- | --- | --- |
| `queueSettings`, `prepareSettingsOperation` et `reconcileSettings` — intention active, en attente, envoyée incertaine ou en erreur | Validation, projection, transport, rapprochement et retry exact | UUID, domaine/type, `payload` et `rpcPayload`, état, révision, dépendance, tentatives, échecs, retry et erreur restent opérationnels. Leur retrait peut perdre un choix, modifier la requête ou rompre la chaîne |
| `conflict` — opération bloquée ou conflit ouvert | Rendu et résolution, reconstruction du dernier choix dépendant, vérification des références de l’export | Les deux versions, la ligne distante attribuée, l’état, l’opération et ses dépendances sont nécessaires. Retirer un champ peut fausser le choix ou la comparaison d’export |
| `prune` et `resolveSettingsConflict` — résolution explicite, confirmation certaine ou remplacement avant envoi | Les conflits récents sont affichés et relus par l’export. Les reçus minimaux servent à la revue et à écarter une réutilisation locale de l’UUID | Le type encode l’état final. Domaine, UUID, révision attendue, éventuel prédécesseur, choix et révision distante selon le type. La portée reste celle du record. Les charges, répliques de valeurs, dates et compteurs de livraison cessent d’être recopiés dans les reçus |
| `applyLegacyImport` — refus botanique | Recherche du refus, diagnostic d’interface et contrôle de non-fusion | `id`, `provenance`, `reason`, `cause`, `fingerprintVersion`, `sourceDigest`. Le message est rendu depuis le code. Retirer la preuve peut perdre la reconnaissance d’une copie déjà refusée. Le format historique garde `raw` et `message` |
| Import accepté — manifestes des trois services | Correspondance des positions et identités, validation de la source et rejeu exact | Le texte brut reste nécessaire au contrat actuel. Les imports cours/QCM et botanique gardent leurs correspondances et UUID d’opérations. Les réglages gardent domaine, source, valeur et opération. Une preuve de refus ou un UUID seul ne peut s’y substituer |

L’empreinte botanique v1 compare une source candidate au texte exact, avec un SHA-256 de `UTF-8(JSON.stringify(texteBrut))`. Le format est identifié séparément pour laisser évoluer l’algorithme ou l’encodage. Le refus connu demeure bloquant dans la portée du compte. Le modèle n’a pas d’action de résolution d’un refus d’import. Les conflits de synchronisation ont leur propre décision. [Règle D12 et limites de l’empreinte](../rgpd/ANALYSE-STOCKAGES-NAVIGATEUR-D12.md#provenance-et-ordre-de-confirmation).

## D. Compatibilité et conservation

- Les clés, les quatre bases IndexedDB v2, la portée et la racine des documents v1 restent compatibles. `archiveVersion: 1` identifie les nouvelles intentions de réglages éligibles à la minimisation. `receiptVersion: 1` distingue le descripteur compact de l’ancien format. Les opérations anciennes ou enrichies de champs inconnus restent complètes quand elles sont rangées. Un conflit ancien conserve sa copie complète, même au-delà des huit conflits présentés.
- Les archives historiques de réglages, leur compteur `archivedCount`, les champs additionnels et les anciens refus botaniques complets sont relus en l’état. Un format racine futur ou un refus dont la preuve est incompatible est refusé et conservé dans le stockage. L’export signale une version de reçu inconnue comme une limite de couverture. Les logiciels déjà chargés avant la livraison suivent leur ancien code jusqu’au rechargement. La barrière de retrait repose toujours sur l’époque IndexedDB.
- L’export JSON v1 lit les reçus de réglages et les anciennes archives. Les conflits récents gardent le contrôle de correspondance de l’UUID, des charges et des métadonnées. Les descripteurs de refus exportent seulement `id` et `provenance`. La restauration traite les archives et refus comme des descripteurs consultables.
- Le choix de conserver toutes les archives historiques retire la borne globale de vingt. Le volume des reçus minimaux peut croître avec l’usage. Une éventuelle réduction ciblée relève du retrait volontaire et des règles de revue proposées à l’exploitant.

## E. Pannes et concurrence

| Épreuve | Résultat observé |
| --- | --- |
| `setItem` refusé, puis `put` en file et transaction avortée après dépôt de l’UUID dans les deux modules | Ni manifeste ni opération durable. Le second cas laisse l’UUID seul. Les sources restent identiques et la confirmation renvoie une erreur |
| Rechargement, même UUID, texte modifié pendant le scan, nouvelle prévisualisation | L’aperçu devenu obsolète est refusé. Le nouvel aperçu demande une vérification et accepte seulement la source relue. Confirmation répétée sans autre opération |
| A puis B puis A et lecture réseau de A libérée ensuite | La génération écarte la réponse de A. Un UUID partagé ne permet aucun premier import hors ligne. B peut confirmer après vérification de son compte. A reste isolé |
| Rejeu hors ligne | Possible avec le manifeste exact commis. Le chemin est refusé si le manifeste manque dans le record durable, même avec un instantané positif en mémoire |
| Retrait préalable et réponse tardive | Retrait du marqueur invalide l’ancien aperçu. Barrière `privacy` maintenue malgré la réponse en vol. La source visiteur et les autres comptes restent distincts |
| Deux confirmations et deux onglets | Dans un service, un aperçu sans UUID devient caduc après l’écriture concurrente. Dans Chromium, le refus avorté laisse le marqueur. Après rechargement et double confirmation, un seul refus durable, aucun manifeste ni envoi |

[Pannes et intercomptes](../../tests/integration/import-provenance.test.js), [concurrence et retrait du marqueur](../../tests/integration/course-quiz-service.test.js), [parcours Chromium et refus](../../tests/e2e/botanical-sync.spec.js), [barrière inter-onglets](../../tests/e2e/erasure.spec.js).

## F. D12

**Prête à approbation finale de l’exploitant.** La matrice D12 relie les accès au terminal à la fonctionnalité demandée et aux preuves observées. La nécessité de chaque accès est examinée séparément de la base juridique du traitement. La proposition à consigner porte sur les qualifications et la règle de retrait par événement. Les preuves actives, les reçus minimaux et les archives historiques restent conservés selon leur usage. Tout retrait plus fin demande une décision explicite après vérification d’attribution et d’utilité. [Analyse et tableau des résidus](../rgpd/ANALYSE-STOCKAGES-NAVIGATEUR-D12.md).

## G. Notice V1.1 préparatoire

Les écarts soumis à revue décrivent le marqueur qui peut survivre à un échec, la vérification du manifeste dans le compte, les nouvelles preuves minimales et la conservation des anciennes copies. La notice distingue le retrait de la provenance de celui des originaux et du cache du compte, avec les exclusions de l’export. L’aperçu est produit par `npm run preopening:notice` sous `.tmp` et vérifié en clair/sombre à 320, 390 et 1280 px. [Source de la notice](../rgpd/POLITIQUE-CONFIDENTIALITE-PROJET.md), [test d’aperçu](../../tests/e2e/notice-preview.spec.js).

## H. Portes P0

Sept sur quinze avant et après le lot, **P0-01, 02, 03, 04, 06, 09 et 10**. Restent P0-05 pour la notice, P0-07/08 pour les preuves fournisseurs, P0-11/14 pour l’administration et l’activation de la cible, et P0-12/13/15 pour la sauvegarde/reprise, la clôture et la remise avant collecte. L’approbation de D12 couvre une partie de P0-15. [Matrice et critères de clôture](../deploiement/PLAN-PREOUVERTURE-PRIVEE.md).

## I. Qualité, artefact et CI

- Node.js 24.22.0, `npm ci --offline` et Chromium du verrou Playwright. `npm test` donne **558 réussites sur 52 fichiers et un test Windows ignoré**. `npm run test:e2e` donne **107 réussites** avec contextes neufs et horloges contrôlées. Le bac à sable Windows a refusé le loopback et certains liens de fixtures lors d’un essai. Les suites ont été rejouées hors de cette restriction. La validation E comptait 542 réussites, un test ignoré et 106 parcours navigateur.
- `build:auth-sdk` reproduit le bundle 2.118.0 sans diff. Les 44 liens locaux ajoutés ou modifiés et `git diff --check` passent. Construction avec `scripts/prepare-pages.py`, le mécanisme Pages. Les 135 fichiers publics et `.nojekyll` correspondent aux seules sources publiques suivies, avec 334 références versionnées. Le contact public, l’Auth désactivée et le réseau sont vérifiés. Les scripts opérateur, fixtures, notice et dossiers privés sont hors artefact. Le plafond de sept comptes est vérifié dans la politique et le préflight administratifs.
- `unit-integration`, `e2e` et `supabase-security` sont suivis sur la dernière tête de la PR. La stack de CI est éphémère. Sur le poste, Docker et la CLI Supabase sont indisponibles sur le chemin de commandes. Les suites SQL/RLS réelles sont réservées à la CI. [Exécutions GitHub Actions du lot F](https://github.com/Vladoche/mon-bprea/actions?query=branch%3Afeature%2Flot6-5-5f-d12-residus-archives), [niveaux de preuve](../TESTS.md).

## J. Périmètre des interventions

Les interventions ont porté exclusivement sur le dépôt, GitHub et les environnements de test synthétiques. Le bilan est de zéro opération Supabase hébergée, invitation, activation, publication Pages ou de la notice, purge historique et nettoyage D. Les preuves et dossiers privés préexistants sont restés hors recette.
