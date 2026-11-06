# Validation du lot 6.5.5.G

**6 novembre 2026. Livraison documentaire.** `git fetch origin main` avant modification a confirmé la fusion de la PR #39 à `92830bdbd201335f529a2e0884ea88e777f584aa`. Le worktree était propre. La branche `docs/lot6-5-5g-d12-preuves-fournisseurs` part de ce commit. [PR de référence](https://github.com/Vladoche/mon-bprea/pull/39).

## A. D12

**D12 — APPROUVÉE PAR L’EXPLOITANT LE 06/11/2026.** La décision humaine couvre les exemptions fonctionnelles par usage dans le périmètre vérifié en D/E/F, la minimisation des nouvelles archives, la conservation en l’état de l’historique, le retrait après vérification de l’attribution, des dépendances et du besoin, ainsi que la surveillance du volume des archives de réglages. Réexaminer en cas d’évolution significative des fonctions ou traitements. [Reçu et niveaux de preuve](../rgpd/RECU-ARBITRAGE-D12-2026-11-06.md), [analyse juridique et technique](../rgpd/ANALYSE-STOCKAGES-NAVIGATEUR-D12.md).

La décision figure dans le suivi D01–D14, le plan et le dossier de préouverture, les arbitrages, l’inventaire et la spécification de la notice. La politique de conservation précise la règle de nécessité sans changer les durées approuvées. Les validations D/E/F restent à leur date et les preuves de navigateur ou de CI gardent leur périmètre. Le reçu trace une décision humaine, sans signature électronique ni certification juridique. La décision n’autorise aucune purge, nouvelle échéance automatique, suppression rétroactive, intervention hébergée ou publication. [Décisions](../rgpd/DECISIONS-A-VALIDER.md), [dossier](../rgpd/DOSSIER-PREOUVERTURE.md), [conservation](../rgpd/POLITIQUE-CONSERVATION-PROJET.md).

## B. P0-07

- **GitHub Pages** distribue les fichiers publics. GitHub est retenu comme responsable distinct pour les journaux de sécurité selon la finalité publiée. Son DPA client ne peut pas être présumé pour ces visites. La preuve temporaire du parcours préparé peut parvenir à l’hébergeur avec la requête initiale. Le traitement de cette preuve et les limites d’usage Pages restent à prendre en compte avant la remise réelle (P0-14/15). [Pages, rôles et limites](../rgpd/FLUX-ET-PRESTATAIRES.md#conditions-et-rôles-par-flux--p0-07).
- **Supabase** est qualifié de sous-traitant pour Auth et données applicatives selon le DPA standard, sous réserve du rattachement au contrat de l’organisation. La gestion du compte client relève de ses traitements propres. L’offre gratuite n’exclut pas le DPA standard et ses capacités d’assistance, de sauvegarde et de journaux diffèrent des offres payantes. [Sources S1–S7](../rgpd/FLUX-ET-PRESTATAIRES.md#registre-des-sources-publiques).
- **Outlook.com personnel** couvre la correspondance grand public. La déclaration et le contrat documentent les traitements propres de Microsoft, dont les contrôles de sécurité des messages. Aucun obstacle contractuel n’a été relevé pour le contact et la correspondance individuelle non commerciale prévus. Le canal est acquis et le futur circuit doit confirmer l’absence de relais ou d’autre destinataire technique ajouté. [Sources M1–M3](../rgpd/FLUX-ET-PRESTATAIRES.md#registre-des-sources-publiques).

**Statut proposé.** P0-07 reste ouvert sur le rattachement du contrat et du DPA, et la confirmation du circuit cible. [PF-01 et PF-03](../rgpd/FLUX-ET-PRESTATAIRES.md#preuves-matérielles-restantes).

## C. P0-08

Les lieux de stockage principal, de support, d’accès technique, de journaux et de copies sont séparés dans la matrice. GitHub et Microsoft documentent des traitements aux États-Unis et ailleurs, des clauses types et le DPF pour les flux couverts. Supabase décrit une région AWS primaire, des traitements hors région, l’ingestion et le stockage de journaux dans l’UE et des clauses types vers Singapour et les États-Unis. La région de DEV connue historiquement ne renseigne pas celle de la cible. [Matrice et preuves A–E](../rgpd/FLUX-ET-PRESTATAIRES.md#matrice-des-lieux-transferts-et-conservations).

La fenêtre d’un jour annoncée pour les logs API/base Free et la règle de fin de contrat du DPA concernent des périmètres différents. L’offre Free ne garantit pas de sauvegarde quotidienne gérée. Les durées publiques de récupération Outlook divergent selon la source. La notice décrit le maintien possible de copies fournisseur. Les durées exhaustives et le datacenter exact du webmail restent des limites documentées. **P0-08 reste ouvert** sur l’offre, la région et les garanties applicables à la chaîne réelle. [PF-01 à PF-03](../rgpd/FLUX-ET-PRESTATAIRES.md#preuves-matérielles-restantes).

## D. Preuves administratives restantes

| ID | Vérification nécessaire | Résultat attendu |
| --- | --- | --- |
| PF-01 | Rapprocher la cible, son organisation et son titulaire des conditions acceptées et du DPA | Entité contractante, version ou référence datée et DPA opposable identifiés |
| PF-02 | Relever offre, région AWS et services pertinents | Lieux, accès, sous-traitants et garanties rattachés à ces seuls flux, limites de rétention explicites |
| PF-03 | Confirmer sur fiche opérateur et métadonnées utiles la remise native et individuelle, sans autre relais | Destinataires et garanties de la chaîne effectivement retenue établis. La boîte et P0-04 restent hors du relevé |

Le projet de mandat limite le contrôle à une cible désignée et aux pièces et métadonnées utiles. Les résultats détaillés restent privés. [Méthodes et caractère bloquant](../rgpd/FLUX-ET-PRESTATAIRES.md#preuves-matérielles-restantes), [mandat de lecture à soumettre](../deploiement/ARBITRAGES-FINAUX-PREOUVERTURE.md#projet-de-mandat-de-lecture-fournisseur).

## E. Notice V1.1

Comparaison avec la V1.0 du 5 novembre (`0c2aef3`) et la V1.1 issue de F (`92830bd`). La V1.1 ajoute les usages locaux et mémorisations volontaires, les contrôles de provenance, les résidus et les possibilités de retrait recettées dans D/E/F. G précise le suivi du volume et les conditions de retrait ciblé, la réception de la preuve par Pages, l’étendue des accès Supabase, le contenu traité par la messagerie et la différence entre délais de l’exploitant et copies fournisseur. Ces précisions sont substantielles. Les finalités, bases, coordonnées autorisées, durées et droits de la V1.0 restent valables dans leur périmètre. [Notice préparatoire](../rgpd/POLITIQUE-CONFIDENTIALITE-PROJET.md).

Les mentions publiques sur les rôles, les transferts possibles et les critères de conservation peuvent être maintenues avec leur périmètre. Il reste à compléter les mentions Supabase et les garanties de la chaîne réelle après PF-01 à PF-03. Les formulations sur l’exposition du lien devront suivre le parcours finalement retenu. L’exploitant pourra alors approuver le texte résultant. Un mandat distinct doit précéder la publication, puis la page et ses liens devront être vérifiés publiquement avant collecte. [Conditions](../rgpd/SPECIFICATION-INFORMATION-PUBLIQUE.md#conditions-avant-publication).

| Décision | État |
| --- | --- |
| D12 | Approuvée le 06/11/2026 |
| V1.0 sur le fond | Approuvée le 05/11/2026 |
| V1.1 finale | En préparation, approbation à venir |
| Publication | Non autorisée. Aperçu local disponible via `npm run preopening:notice` |

## F. Matrice P0

| Porte | Avant (F) | Après (G) |
| --- | --- | --- |
| P0-01 Cadre | Résolue | Résolue |
| P0-02 Établissement | Résolue | Résolue |
| P0-03 Bases | Résolue | Résolue |
| P0-04 Contact | Résolue | Résolue |
| P0-05 Notice | V1.1 en préparation, D12, preuves et publication restantes | V1.1 en préparation, preuves fournisseurs, revue et approbation finale, mandat et contrôle public avant collecte |
| P0-06 Conservation | Résolue | Résolue |
| P0-07 Prestataires | Bloquée, preuve fournisseur partielle | Bloquée, rattachement et circuit cible |
| P0-08 Transferts | Bloquée, preuve fournisseur partielle | Bloquée, région et garanties de la cible |
| P0-09 Public et finalités | Résolue | Résolue |
| P0-10 AIPD | Résolue | Résolue |
| P0-11 Administration | Bloquée, autorisation hébergée | Bloquée, autorisation hébergée |
| P0-12 Reprise | Implémentée localement, recette requise | Implémentée localement, recette requise |
| P0-13 Clôture et droits | Implémentée localement, recette requise | Implémentée localement, recette requise |
| P0-14 Activation | Bloquée, autorisation hébergée | Bloquée, autorisation hébergée |
| P0-15 Information avant collecte | Implémentée localement, recette de remise requise | Implémentée localement, recette de remise requise. D12 acquise |

**7/15 résolues avant et après.** D12 approuvée fait progresser P0-05 et P0-15. Le fond de la notice, son approbation finale, sa publication et sa remise effective restent des preuves distinctes. [Matrice courante](../deploiement/PLAN-PREOUVERTURE-PRIVEE.md#matrice-de-résolution-p0-01-à-p0-15).

## G. Qualité

- Node.js 24.22.0, `npm ci --offline --no-audit --no-fund`, puis `npm test` **558 réussites sur 52 fichiers et un cas de lien symbolique Windows ignoré**. Le premier accès au CDN Chromium depuis le bac à sable a échoué. `npx --no-install playwright install chromium` a réussi avec l’accès autorisé.
- `npm run test:e2e -- --workers=2` **107 réussites** avec Chromium verrouillé et contextes isolés. Le premier lancement dans le bac à sable n’a exécuté aucun test. Le passage avec accès au loopback et au cache Chromium a réussi, dont contact sous `/mon-bprea/`, test de la requête initiale synthétique, exclusion de la notice et aperçu sans JavaScript à 320, 390 et 1280 px en clair et sombre.
- Artefact local préparé avec `scripts/prepare-pages.py` et la configuration par défaut. **135 fichiers publics et `.nojekyll`**, 334 références versionnées. Contact et lien `mailto` présents. Configuration Auth identique au défaut désactivé, URL et clé vides. Notice, liens vers elle, aperçus et dossiers privés absents des racines publiques. Les workflows et les entrées du build sont identiques à `origin/main`. [Constructeur Pages](../../scripts/prepare-pages.py), [workflow](../../.github/workflows/deploy.yml).
- L’aperçu généré par `npm run preopening:notice` reste dans un répertoire ignoré `.tmp/preopening-notice-preview-*`. Relecture visuelle de la rubrique fournisseurs à 390 px en sombre et 1280 px en clair, sans débordement. Les vérifications fournisseur portent sur les liens, versions affichées et limites de chaque source publique. [Registre](../rgpd/FLUX-ET-PRESTATAIRES.md#registre-des-sources-publiques).
- `git diff --check`, contrôle des liens locaux et ancres des douze Markdown, revue D01–D14 et comptage des quinze portes avant/après. Les validations D/E/F, le JSON de conservation et les fichiers fonctionnels sont inchangés. Revue du diff et recherche de motifs de secrets et de pièces privées sans occurrence sensible dans les ajouts.
- Les contrôles `unit-integration`, `e2e` et `supabase-security` sont à rattacher à la tête effective de la PR. Le bilan de livraison de la PR consigne les liens des jobs et le SHA observé. Docker et la CLI Supabase sont indisponibles sur ce poste. Les essais réels SQL/RLS relèvent du workflow ordinaire sur stack éphémère, distinct des E2E à réponses HTTP synthétiques. [Exécutions du lot G](https://github.com/Vladoche/mon-bprea/actions?query=branch%3Adocs%2Flot6-5-5g-d12-preuves-fournisseurs), [conventions de tests](../TESTS.md).

## H. Autorisations absentes

Aucun accès à un projet Supabase hébergé ni lecture administrative, SQL, mutation, migration, sauvegarde connectée, génération de lien, invitation ou activation. Aucun T11 DEV, nettoyage D, suppression de données utilisateur ou purge. Aucune consultation de boîte Microsoft, collecte d’adresses, publication de notice, opération Pages hébergée ni fusion. Le mandat de lecture est préparé pour une décision ultérieure de l’exploitant.
