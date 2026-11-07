# Validation du lot 6.5.5.D — arbitrages, D12 et notice

**5 novembre 2026.** Base vérifiée avec `git fetch origin main` à `26d18dbe036e782f7c3623aaa32df7894fa04e5a`, fusion de la [PR #36](https://github.com/Vladoche/mon-bprea/pull/36). Worktree initial propre. Branche `feature/lot6-5-5d-rgpd-notice-d12` issue de cette base. Les preuves historiques de C2, de reprise synthétique et de clôture native restent à leur périmètre.

## A. Décisions reçues

Le cadre RGPD, le responsable Vladimir Fouillade, les mentions autorisées dans la notice, l’intérêt légitime pour R01–R05, le calendrier et les durées résiduelles, ainsi que le screening AIPD sont approuvés. Le fond de la V1.0 est approuvé pour les thèmes du mandat. La copie historique du 29 octobre garde sa décision de conservation distincte.

**Attesté par l'exploitant le 05/11/2026.** MFA Microsoft, récupération, envoi/réception et réponse externe, routine de consultation et fonctionnement de la page Contact hébergée. Le lot D traite ces faits comme déclarations de l’exploitant. Le contrôle de la page dans l’artefact est une preuve séparée. [Reçu détaillé](../../rgpd/RECU-ARBITRAGES-2026-11-05.md).

## B. Résultats des quinze P0

| P0 | Avant (lot C) | Après (lot D) | Nouvelle preuve | Reste |
| --- | --- | --- | --- | --- |
| 01 | Prêt à approuver | **Résolu** | D01 et identité approuvées, périmètre de publication consigné | Mise en ligne de la notice en 05, rôles des prestataires en 07/08 |
| 02 | Résolu | **Résolu** | Décision d’indépendance déjà acquise | Revue au changement |
| 03 | Prêt à approuver | **Résolu** | D03 et mises en balance R01–R05 approuvées | Vérifier les garanties opérationnelles aux portes concernées |
| 04 | Contact intégré, messagerie à vérifier | **Résolu** | Attestations du 05/11 et tests du contact sans compte dans l’artefact | Preuves privées et contrôle de fraîcheur du préflight avant opération réelle |
| 05 | Implémenté localement, recette requise | **Contenu approuvé sur le fond — vérifications finales et publication restantes** | V1.0 consolidée et six variantes de l’aperçu vérifiées | D12, éléments fournisseur déterminants, revue des écarts substantiels, autorisation et contrôle public |
| 06 | Prêt à approuver | **Résolu** | D07 approuvée, dont les résidus et la conservation historique distincte | Exécution et preuves opérationnelles en 12/13. Délais fournisseur en 07/08 |
| 07 | Preuve fournisseur partielle | Preuve fournisseur partielle | Services et rôles par flux, DPA Supabase standard, conditions Outlook.com personnelles | Rattacher conditions à la cible et confirmer la couverture du canal de remise |
| 08 | Preuve fournisseur partielle | Preuve fournisseur partielle | Région primaire, accès hors région, chaîne et mécanismes de transfert documentés | Établir région cible et garanties applicables aux flux réels |
| 09 | Résolu | **Résolu** | Périmètre B/C conservé | Revue si élargissement |
| 10 | Prêt à approuver | **Résolu** | D11 approuvée, évaluation descriptive identifiée | Réexaminer au changement significatif ou si un risque élevé apparaît |
| 11 | Autorisation hébergée requise | Autorisation hébergée requise | Configuration publique et frontières de l’artefact vérifiées | Rôles, MFA et réglages cible sous mandat, preuves privées poste/secrets |
| 12 | Implémenté localement, recette requise | Implémenté localement, recette requise | Durées D07 fixées. Exercice de reprise synthétique historique | Copie actuelle autorisée, limites acceptées, reprise isolée, réconciliation et routine |
| 13 | Implémenté localement, recette requise | Implémenté localement, recette requise | Contact attesté, retrait local et barrière confirmés. Clôture native acquise en CI #35 | Chaîne opérateur réelle, identité, habilitation, cible, suivi des copies |
| 14 | Autorisation hébergée requise | Autorisation hébergée requise | Plafond sept et préflight existants préservés | Cible, réserves C2 et mandats T11/D séparés, exécuteur de liens et retour arrière |
| 15 | Implémenté localement, recette requise | Implémenté localement, recette requise | V1.0 et circuit volontaire documentés, qualification D12 motivée | Appliquer D12, valider le circuit, fournir la notice avant collecte et tracer version/remise |

**7 résolus sur 15, dont 5 clôtures nouvelles.** [Matrice de référence](../../deploiement/PLAN-PREOUVERTURE-PRIVEE.md).

## C. Fournisseurs

- **GitHub Pages.** GitHub documente la collecte d’IP de sécurité et ses mécanismes internationaux. Le délai Pages et la conservation de la query initiale restent inconnus. Cette requête contient la preuve d’accès quand le parcours utilise un lien. [Documentation Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection), [transferts GitHub](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement#international-data-transfers).
- **Supabase Free.** DPA intégré aux conditions standard et FAQ transferts avec clauses types, région principale distincte du support et des traitements techniques. Un jour annoncé pour les logs API/base de l’offre et absence de backup automatique Free, dans les limites documentées. Restent le rattachement à l’organisation choisie, la région et les garanties effectivement applicables. [DPA](https://supabase.com/legal/customer-resources/data-processing-addendum), [FAQ résidence et transferts](https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq).
- **Outlook.com personnel.** Conditions grand public et traitements propres documentés. La divergence des indications sur les messages supprimés et l’emplacement exact de la boîte sont des limites. La couverture du circuit réel de remise des liens reste déterminante. [Contrat de services](https://www.microsoft.com/fr-fr/servicesagreement), [déclaration Microsoft](https://www.microsoft.com/fr-fr/privacy/privacystatement).

La [fiche fournisseurs](../../rgpd/FLUX-ET-PRESTATAIRES.md) distingue les constats de code, déclarations, sources et inférences. Une future preuve administrative ciblée concerne l’offre, la région, les conditions et la chaîne effectivement utilisée. Les adresses des participants et le contenu des messages ne sont pas nécessaires à cette preuve.

## D. D12

L’[inventaire D12](../../rgpd/ANALYSE-STOCKAGES-NAVIGATEUR-D12.md) traite les clés, leurs déclencheurs, leur portée, la durée d’effet et la durée physique, les retraits et l’exemption par usage. Il propose l’issue **B** par prudence pour les accès facultatifs tels qu’ils existent, notamment le rappel de confort au chargement et la migration silencieuse du thème. Le masquage de l’anecdote cesse d’agir le lendemain et sa date reste stockée. Les provenances peuvent être créées dès l’aperçu d’import, même après annulation. L’authentification et la reprise demandées ont des justifications distinctes. Si un accès facultatif est conservé sans exemption, il doit être précédé d’un choix spécifique, informé et retirable.

Les essais confirment des lectures dès l’affichage même sur un navigateur sans clé persistée, l’écriture après les actions visiteur, la migration sur Contact, les caches personnels séparés, le retrait ciblé avec barrière et la conservation des données lors d’une déconnexion. Aucun chargement tiers inattendu, cookie, service worker, Cache API ou stockage de session navigateur observé dans l’artefact vierge. Avec Auth simulée, le seul autre hôte est la cible fictive interceptée. L’analyse et la proposition n’activent aucun mécanisme de consentement. La recette de la solution retenue et D12 restent ouvertes.

## E. Notice et accessibilité

La [source V1.0](../../rgpd/POLITIQUE-CONFIDENTIALITE-PROJET.md) et son rendu autonome sont préparés à partir du projet de notice et des décisions du mandat. Le verbatim de la notice présentée dans ChatGPT n’était pas fourni. La comparaison se fonde sur ses thèmes et les arbitrages explicites, avec ces limites.

- **Rédaction.** Les reformulations de lisibilité, les liens et les mentions déjà approuvées conservent les finalités, bases, catégories et durées du mandat.
- **Points substantiels à relire.** Les lectures locales et leur durée physique sont désormais explicitées. Les précisions sur les accès hors région, pays et garanties des fournisseurs sont documentées sans annoncer la chaîne exacte de la future cible. Toute modification du mécanisme de rappel ou de consentement, du destinataire de remise ou de la garantie de transfert exige d’actualiser le texte et de faire approuver la version résultante avant publication.
- **Aperçu.** `npm run preopening:notice` écrit un fichier privé `confidentialite.html` dans un nouveau dossier ignoré. Le signalement d’aperçu et `noindex` sont réservés au rendu de travail. Les six combinaisons 320, 390 et 1280 px en clair/sombre ont été testées sans JavaScript et inspectées visuellement depuis le fichier produit. Contrôles du sommaire, des fragments relatifs sous `/mon-bprea/`, du saut au contenu, du focus, de l’absence de débordement et du contraste du texte et des liens (au moins 4,5:1). Captures locales ignorées. Aucun test manuel de lecteur d’écran.
- **Mise en ligne.** La notice reste en attente de D12, des éléments fournisseur déterminants, de la validation des écarts substantiels et du mandat de publication. L’URL future est `https://vladoche.github.io/mon-bprea/confidentialite.html`. [Liens préparés et contrôles](../../rgpd/SPECIFICATION-INFORMATION-PUBLIQUE.md).

## F. Qualité, confidentialité et artefact

| Contrôle | Résultat et portée |
| --- | --- |
| Node et dépendances | Node 24.22.0, `npm ci` et `npx playwright install chromium` exécutés |
| `npm test` | 539 réussis, 1 essai de lien symbolique de répertoire ignoré faute de droit Windows. Premier passage limité par le bac à sable (boucle locale et liens NTFS synthétiques), suite réussie avec l’autorisation d’exécution correspondante |
| `npm run test:e2e -- --workers=4` | 103 réussis en Chromium isolé. Lot ciblé 25/25, incluant D12, l’aperçu, le retrait et la frontière Pages |
| `npm run build:auth-sdk` | SDK 2.118.0 reconstruit, diff Git vide |
| Artefact local exact du constructeur Pages | 135 fichiers sélectionnés et `.nojekyll`, dont 18 pages HTML, 329 références versionnées. Comparaison avec la base à version égale. Seule différence brute du checkout Windows, fins de ligne de `assets/favicon.svg`, neutralisée pour la comparaison. Manifeste SHA-256 normalisé `d08c1dbecec5388c81de7e603f3583a013d86146e22a9e97bb6c2bbda04406ab` |
| Frontière publique | Contact et mailto conservés, `confidentialite.html` absente (404 locale), aucun href actif, dossiers privés et source exclus, aucun motif de secret détecté, Auth désactivée avec URL et clé vides. Configurations Auth, migrations, fichiers publics et workflows sans diff |
| Liens Markdown et Git | 344 liens relatifs et ancres des documents modifiés contrôlés, `git diff --check` réussi |
| CI GitHub | Trois jobs attendus sur la tête de PR (`unit-integration`, `e2e`, `supabase-security`). Les résultats observés sur la tête livrée sont tracés dans les Checks GitHub et la description de la PR. [Exécutions de la branche D](https://github.com/Vladoche/mon-bprea/actions?query=branch%3Afeature%2Flot6-5-5d-rgpd-notice-d12) |
| RLS réel | CLI Supabase et Docker absents du poste. Suites Supabase réelles locales non exécutées ici. Les mocks HTTP servent aux preuves navigateur uniquement. La CI de sécurité utilise sa stack éphémère isolée |

`deploy.yml` est intact. Une fusion dans `main` relance la publication Pages normale avec des références versionnées par le nouveau SHA. Le contenu de la notice et ses liens restent hors artefact par construction.

## G. Autorisations et exécution

Aucun accès ni mutation Supabase hébergée, aucun lien d’accès généré, aucune invitation, aucun compte réel créé, aucune activation, aucune publication de la notice, aucun nettoyage D et aucun T11 DEV. Aucune connexion à Outlook. Aucune copie réelle, purge ni rotation, y compris pour la sauvegarde historique du 29 octobre. Livraison GitHub par branche et PR, sans fusion, sans changement de protection de `main` et sans déploiement déclenché manuellement.
