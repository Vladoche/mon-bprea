# Validation du lot 6.5.5.E — accès au terminal D12

**5 novembre 2026.** Base propre après `git fetch origin main`, à `a2cf6baa62c7a9c6228bc0fe97869c6955b87537`, fusion de la [PR #37](https://github.com/Vladoche/mon-bprea/pull/37). Branche `feature/lot6-5-5e-d12-stockages-navigateur`. Les résultats D, les décisions de l’exploitant et les preuves des campagnes précédentes restent datés et consultables. [Validation D](VALIDATION-LOT6-5-5D.md), [reçu du 5 novembre](../rgpd/RECU-ARBITRAGES-2026-11-05.md).

## A. Modifications fonctionnelles

| Parcours | Avant | Après | Fichiers principaux |
| --- | --- | --- | --- |
| Apparence | Lecture des anciennes clés avant CSS et copie automatique de l’ancien mode clair/sombre. Les changements étaient enregistrés d’office | Rendu automatique calculé. Changement de saison ou de luminosité pour la page. Commandes distinctes de reprise historique, mémorisation et retrait. Seule la clé de l’apparence expressément mémorisée est consultée avant CSS, y compris sur Contact | [Thème](../../assets/theme-init.js), [dialogue](../../assets/appearance.js) |
| Anecdote | Lecture à chaque rendu et date persistante après clic, avec effet jusqu’à minuit Paris | Bouton « Masquer l’anecdote sur cette page ». Effet en mémoire, qui prend fin au rechargement, en changeant de page ou au changement de jour | [Anecdote](../../assets/daily-fact.js) |
| ITK | Formulaire visiteur lu à l’initialisation du service des réglages et enregistré à chaque génération | Génération et exports en mémoire. En visiteur, commandes séparées pour mémoriser les huit paramètres du dernier calcul, les charger, les retirer et reprendre un ancien formulaire. La génération en compte alimente ses réglages synchronisés | [Générateur](../../assets/app.js), [interface ITK](../../assets/itk-personal-ui.js), [service des réglages](../../assets/settings-service.js) |
| Imports cours/QCM et botanique | L’aperçu pouvait créer un UUID même en cas d’annulation | L’aperçu lit la source et l’UUID éventuel. La confirmation revérifie le contenu, l’UUID et la génération, puis crée la provenance si le manifeste ou le refus botanique archivable l’exige | [Cours/QCM](../../assets/course-quiz-service.js), [botanique](../../assets/botanical-sync-service.js) |
| Gestion des sauvegardes locales | Inventaire de présence dès l’ouverture du profil | Recherche volontaire des sauvegardes. Sélection distincte des nouvelles mémorisations et des anciennes valeurs dans la copie appareil et le retrait par catégorie | [Interface](../../assets/export-ui.js), [catalogue des sources](../../assets/export-sources.js), [projection JSON](../../assets/export-model.js) |

## B. Conservation des données

- Les clés `bprea-demo-appearance-v1`, `bprea-demo-theme-v1`, `bprea-demo-itk-v1` et `bprea-demo-daily-fact-dismissed-v1` restent dans leur format d’origine. Les essais comparent les octets des valeurs héritées, y compris une apparence illisible ou d’une version future, une préférence valide avec un champ inconnu et une date de masquage périmée. Les deux nouveaux enregistrements utilisent des clés distinctes.
- Les commandes de reprise chargent l’apparence ou le formulaire historique en mémoire. Le retrait d’une nouvelle mémorisation cible sa seule clé. Le formulaire ou l’apparence de la page en cours reste utilisable. Les tests couvrent la nouvelle page, le rechargement, le retrait propagé vers un autre onglet et le retrait des deux nouvelles clés depuis le profil. Une ancienne préférence ne réapparaît qu’à la suite d’une nouvelle commande explicite de reprise ou d’import.
- L’aperçu annulé laisse l’UUID absent. L’UUID déjà présent est réutilisé et le rejeu après rechargement conserve les mêmes opérations. Une source modifiée, un identifiant retiré, un aperçu de A présenté après une bascule A–B–A ou un refus d’écriture empêche le commit concerné. Le scan distant avant un premier import et les refus de provenance ambiguë sont exercés. Les archives botaniques restent cloisonnées et le contenu brut est exclu de l’export normal.
- Les tests d’isolation et d’effacement exercent la conservation de la progression et des historiques visiteur, la fin de session et la conservation de l’outbox de A après déconnexion, le cache distinct de B et le blocage des retours réseau et onglets tardifs par `privacy[scope]`. Les schémas IndexedDB, les règles de synchronisation et les politiques RLS sont ceux de la base vérifiée.

## C. Analyse D12

**Corrections recettées, qualification des accès actifs motivée. D12 reste ouverte pour décision finale.** L’analyse distingue la base juridique RGPD de la nécessité de chaque accès au terminal. Elle associe à chaque clé ou support son déclencheur, ses données, sa finalité, son information, son retrait et la preuve technique. Les mémorisations locales sont des fonctions demandées séparément. La proposition d’exemption repose sur le rappel de l’apparence choisie et la reprise du formulaire demandé, limités aux données nécessaires à ces fonctions. [Inventaire et qualification D12](../rgpd/ANALYSE-STOCKAGES-NAVIGATEUR-D12.md), [article 82](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000037813978), [CNIL](https://www.cnil.fr/fr/cookies-et-autres-traceurs/que-dit-la-loi).

L’arbitrage restant porte sur les copies brutes et anciennes intentions après résolution. Pour les archives de réglages résolues et les refus d’import botanique dont l’ambiguïté est traitée, décider quelle preuve minimale reste utile au diagnostic ou à l’anti-doublon et à quel événement réexaminer la copie brute. Les données déjà présentes et les futures archives doivent être distinguées. Les opérations incertaines et les marqueurs de retrait ont leur justification active propre.

L’UUID de provenance est écrit dans `localStorage` avant le commit IndexedDB du manifeste. Le navigateur peut conserver l’UUID seul si le commit échoue après cette écriture. Un nouvel aperçu retrouve cet UUID. L’état du compte et sa file restent soumis à la transaction IndexedDB. Le refus d’écriture de l’UUID annule la transaction du manifeste. [QCM](../../tests/integration/course-quiz-service.test.js), [botanique](../../tests/integration/botanical-sync-service.test.js).

## D. Notice

La [V1.1 en préparation](../rgpd/POLITIQUE-CONFIDENTIALITE-PROJET.md) part de la V1.0 approuvée sur le fond le 5 novembre. La comparaison se limite aux rubriques concernées par D12 et à l’indication de version.

| Sujet | V1.0 approuvée sur le fond | V1.1 préparatoire et justification | Impact pour les participants | Revue attendue |
| --- | --- | --- | --- | --- |
| Apparence | Préférences lues à l’affichage | Mémorisation volontaire pour les prochaines pages, lecture avant rendu, reprise historique sur demande et retrait dans le dialogue | Choisir l’affichage seul ou le retrouver plus tard dans ce navigateur | Oui, description et qualification de la mémorisation |
| Anecdote | Masquage journalier et date susceptible de rester après l’effet | Masquage en mémoire de page, retour au rechargement ou au lendemain, date historique conservée pour la gestion des données | Le masquage s’arrête à la navigation ou au rechargement | Oui, périmètre de l’effet et information sur l’ancienne date |
| ITK | Derniers paramètres conservés dans le navigateur | Générer et exporter directement, puis mémoriser ou rappeler sur commande en visiteur. Explication distincte de la génération en compte | L’enregistrement local est facultatif et retirable depuis le générateur | Oui, distinction visiteur/compte et qualification du rappel |
| Import | Confirmation distincte de la connexion | Moment de création et rôle de la provenance explicités, vérification sur appareil partagé | L’aperçu annulé ne crée pas d’identifiant, le doublon reste contrôlé | Oui, information sur l’identifiant, les preuves et les résidus |
| Stockage et retrait | Conservation des copies et retrait dans le profil | Recherche locale à la demande, mémorisations et sources héritées sélectionnables. Exemptions fonctionnelles décrites pour les accès nécessaires aux services demandés | Repérer et retirer séparément les copies. Les éléments uniquement locaux peuvent être perdus après retrait | Oui, portée des exemptions, information et arbitrage D12 |

Les mentions déjà approuvées couvrent le responsable Vladimir Fouillade, le contact officiel, les sept comptes, R01–R05 et leurs bases, les durées, les prestataires, les droits, la fermeture et les limites de sauvegarde. P0-05 attend la décision D12, la revue de ces écarts, les preuves fournisseurs déterminantes, le mandat de publication et la vérification publique de la version finale. [Spécification de mise en ligne](../rgpd/SPECIFICATION-INFORMATION-PUBLIQUE.md).

## E. Qualité

| Contrôle | Résultat observé |
| --- | --- |
| Préparation | Node.js 24.22.0, `npm ci --offline`, puis `npx playwright install chromium` avec accès réseau autorisé. Le premier téléchargement sous réseau restreint a échoué. Le SDK Supabase 2.118.0 a été reconstruit avec `npm run build:auth-sdk`, sans écart Git du bundle |
| `npm test` | 542 réussis sur 51 fichiers. Un essai de lien symbolique de répertoire a été ignoré, faute du droit Windows requis. Les tests de concurrence, d’anciennes clés, de refus de stockage et de synchronisation font partie de la suite |
| `npm run test:e2e -- --workers=4` | 106 réussis sous Chromium isolé. La sélection initiale de 26 parcours D12, apparence, ITK et révision a aussi réussi. HTTP simulé pour les parcours de compte de cette suite |
| Rendu et accessibilité | Captures inspectées à 320, 390 et 1280 px en clair/sombre pour apparence et ITK. Focus visible, fermeture clavier, retrait et reprise des clés vérifiés. L’aperçu V1.1 et Contact sont testés dans les six combinaisons sans JavaScript. Test de premier rendu avec CSS retardées. La recette couvre Chromium et le clavier |
| Aperçu autonome | `npm run preopening:notice` produit `confidentialite.html` dans un nouveau dossier privé et ignoré. Version en préparation, sommaire, liens, contrastes et absence de requête annexe vérifiés |
| Artefact Pages local | Constructeur de publication utilisé avec configuration par défaut. 135 fichiers publics plus `.nojekyll`, 18 HTML, 332 références versionnées. Empreinte des chemins triés et empreintes des fichiers `c3ffaa5dcb55386cc0e06ae3bcfea740535ec8afbd4643537983c186ce4680e4` pour la version locale `verification-lot6-5-5e` |
| Frontière publique | Contact et mailto exact vérifiés. Auth désactivée, URL et clé vides. La notice complète, ses href, les dossiers privés et les scripts de préparation sont exclus. Aucun motif de secret détecté dans les ressources textuelles vérifiées. Les pages en contextes vierges n’ont émis aucune requête tierce ni créé de cookie, de service worker ou de donnée persistante. Capacité administrative et interdiction d’inscription libre vérifiées par les suites existantes |
| Git et liens | `git diff --check` et 295 liens relatifs et fragments contrôlés dans 11 documents |
| CI | Les contrôles attendus sont `unit-integration`, `e2e` et `supabase-security`. Les résultats sur le SHA livré sont consignés dans la PR et les [exécutions de la branche E](https://github.com/Vladoche/mon-bprea/actions?query=branch%3Afeature%2Flot6-5-5e-d12-stockages-navigateur). |
| Supabase réel | CLI et Docker absents sur ce poste, suite réelle locale non exécutée. La CI de sécurité utilise sa stack éphémère isolée. Les mocks et l’artefact local ne démontrent pas la RLS ou la configuration des projets hébergés |

Les captures, l’aperçu et les sorties de recette contiennent des données synthétiques ou publiques et restent dans les répertoires locaux ignorés. La validation n’inclut pas de lecteur d’écran ni d’observation des en-têtes de l’hébergeur en production.

## F. P0

| P0 | Avant le lot E | Après le lot E |
| --- | --- | --- |
| 01, 02, 03, 04, 06, 09, 10 | Résolus dans leur périmètre | Résolus, preuves datées conservées |
| 05 | V1.0 approuvée sur le fond, vérifications finales et publication restantes | V1.1 préparée avec les changements D12. Approbations, preuves fournisseurs et publication restent à obtenir |
| 07, 08 | Preuves fournisseurs partielles | Preuves fournisseurs partielles |
| 11, 14 | Autorisations et preuves hébergées requises | Autorisations et preuves hébergées requises |
| 12, 13 | Implémentation locale, recette opérationnelle requise | Recette opérationnelle requise |
| 15 | Circuit préparé, adaptations D12 et recette requises | Information navigateur actualisée. Validation du circuit et remise avant collecte encore requises |

**Sept résolus sur quinze.** Les preuves ajoutées concernent P0-05 et P0-15. [Matrice courante](../deploiement/PLAN-PREOUVERTURE-PRIVEE.md#matrice-de-résolution-p0-01-à-p0-15).

## G. Autorisations

Le lot a utilisé les sources du dépôt, des données synthétiques locales et GitHub G1. Le décompte est de zéro intervention Supabase hébergée, activation, invitation, génération de lien, exécution T11 DEV, publication de notice, sauvegarde connectée, purge ou nettoyage D. Les retraits testés concernent uniquement les contextes de test isolés.

La décision de fusion revient à l’exploitant. Fusionner cette branche dans `main` publiera automatiquement sur GitHub Pages les changements d’apparence, d’anecdote, d’ITK, d’import et de recherche des sauvegardes. L’artefact construit par ce workflow conserve la notice en dehors de ses racines publiques. [Workflow Pages](../../.github/workflows/deploy.yml).
