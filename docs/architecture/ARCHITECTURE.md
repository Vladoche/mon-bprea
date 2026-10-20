# Architecture et audit — Lot 5.1

## Organisation conservée

Les douze pages HTML restent à la racine : accueil, trois pages de rubrique, UC, cours, exercices, ITK, ressources, calendrier, Drill et Tableau de bord. Leurs URL, paramètres et identifiants restent stables. Les modules ES sont chargés directement par le navigateur ; il n’existe ni framework, ni compilation applicative, ni backend.

`assets/` reste plat. Ses préfixes (`drill-`, `dashboard-`, `calendar-`, `daily-`, etc.) regroupent déjà les domaines. Déplacer ces fichiers modifierait les imports, les liens HTML et les URL de JSON, tout en élargissant le risque sur le préfixe GitHub Pages et le cache busting. Ce lot range la documentation et ajoute les outils de vérification sans déplacer les ressources publiques.

Les données éditables de navigation, événements, ressources, questions Drill et anecdotes sont en JSON versionné. `content.js` conserve les UC, cours, QCM et données ITK existants ; migrer ces données demanderait un autre lot et une validation éditoriale. Aucun identifiant pédagogique n’est modifié pour les tests.

## Dépendances et frontières

| Domaine | Accès aux données | Calcul ou validation | Interface |
| --- | --- | --- | --- |
| Application et QCM | Lecture/écriture locale dans `app.js` | `exam-stats.js` ; calculs ITK existants dans `app.js` | `app.js` |
| Drill | `drill-bank.js`, `drill-store.js` | `drill-engine.js`, validation de banque | `drill.js` |
| Tableau de bord | `dashboard-data.js` → `readDrillState()` | `dashboard-stats.js` → moteur Drill | `dashboard.js`, synthèse de `section-hubs.js` |
| Calendrier et examens | `calendar-data.js`, progression QCM et Drill | Dates et sélection d’examen ; `exam-stats.js` | `calendar.js`, `exam-preparation.js` |
| Navigation | `navigation.json`, UC de `content.js` | Configuration et fils d’Ariane | `navigation.js`, `breadcrumbs.js`, `section-hubs.js` |
| Ressources | `resources.json`, PDF publics | `resources.js` | `resource-library.js` |
| Apparence | Préférences locales via `theme-init.js` | Saison, horaires et priorité des choix | `appearance.js`, variables CSS |
| Anecdote | `daily-facts.json`, masquage local | Date Paris, validation et rotation dans `daily-fact.js` | Bandeau de `daily-fact.js` |

`app.js` orchestre l’en-tête et le rendu selon `data-page`, puis délègue aux modules de domaine. Il contient aussi des rendus et calculs historiques de cours, QCM et ITK. Le scinder entièrement augmenterait la surface de changement sans être nécessaire à l’installation des tests. Les extractions de ce lot doivent rester limitées aux fonctions effectivement exercées, réutilisées par l’application et sans import d’un module d’interface uniquement pour calculer.

Les statistiques du Tableau de bord et la synthèse de S’exercer réutilisent les réponses validées du moteur Drill. Il faut préserver cette source commune : une seconde formule de réussite pourrait introduire une moyenne de pourcentages ou compter les questions non réalisées. Les tentatives QCM et les entraînements Drill ont des règles distinctes ; ils ne doivent pas être fusionnés pour simplifier le code.

## Stockage et risques prioritaires

| Clé locale | Données et invariants |
| --- | --- |
| `bprea-demo-progress-v1` | Cours terminés, meilleurs scores, tentatives QCM et archives compatibles. |
| `bprea-demo-drill-v1` | Séries, copies versionnées des questions, brouillons, premières réponses et entraînements séparés. |
| `bprea-demo-itk-v1` | Derniers paramètres du générateur. |
| `bprea-demo-theme-v1` | Ancien choix clair/sombre, préservé lors de la migration. |
| `bprea-demo-appearance-v1` | Préférences indépendantes de saison et luminosité. |
| `bprea-demo-daily-fact-dismissed-v1` | Date civile Paris du masquage du bandeau. |

Le lecteur Drill valide les données avant de les fournir aux calculs et ses écritures préservent les historiques. L’adaptateur Dashboard ne doit pas écrire. Les lectures du QCM/ITK et des préférences restent spécifiques à leur format ; une abstraction générale de stockage serait prématurée. Le stockage peut être bloqué, saturé ou contenir un ancien format : les tests doivent contrôler les états d’erreur et la conservation des chaînes inconnues, sans supprimer de clé.

Les principaux risques sont la double comptabilisation d’une réponse, la perte d’une série ancienne, une modification de sauvegarde malformée, les écritures concurrentes et les transitions calendaires. La transaction Drill utilise les verrous Web Locks quand ils existent ; le repli `localStorage` ne garantit pas une transaction inter-onglets parfaite. Les tests isolés ne peuvent pas démontrer l’absence de toute course entre onglets.

Les dates n’ont pas toutes la même convention. Les semaines Drill et l’anecdote suivent Europe/Paris ; les saisons et ambiances suivent le calendrier et l’heure du navigateur ; les événements sont des dates civiles sans horaire, affichées dans le calendrier local. Des utilitaires de date proches ne doivent pas être regroupés si cela modifie ces règles. Les tests doivent fixer l’instant et couvrir minuit, lundi, année ISO et changements d’heure.

## Chemins, publication et nettoyage

Les liens publics restent relatifs, sans `/` initial ni nom de dépôt codé en dur. Les JSON chargés par `new URL('./fichier.json', import.meta.url)` conservent leur relation au module. `scripts/prepare-pages.py` copie seulement les HTML racine, les types publics autorisés dans `assets/` et les PDF de `documents/`, puis ajoute `.nojekyll`. Les versions CSS/JS/JSON sont appliquées à cette copie. Les outils npm, tests, documentation, caches et rapports ne font pas partie de cette liste publique. Voir [CACHE.md](CACHE.md).

La documentation de domaine est regroupée ici ; les validations historiques sont dans [../validations/](../validations/). Leurs observations restent celles des lots concernés : elles ne valent pas exécution des tests du lot 5.1. Le guide des PDF reste dans [../../documents/README.md](../../documents/README.md).

Le dossier `.playwright-mcp/` contient des journaux, captures et instantanés générés par les vérifications visuelles. Il était déjà ignoré et `git ls-files -- .playwright-mcp` ne listait aucun fichier. Il reste ignoré, de même que `.tmp/`, `site-public/`, les caches Python, `node_modules/`, `test-results/`, `playwright-report/` et `coverage/`.

Le fichier racine `download` était suivi par Git et faisait exactement **0 octet**, sans contenu ni signature de format. La recherche dans les HTML, modules, styles, JSON et scripts ne trouvait aucun chemin vers ce fichier : les occurrences du mot concernent l’attribut de téléchargement, l’icône et le CSV créé comme Blob par l’ITK. La liste publique de `prepare-pages.py` l’excluait déjà, car il n’était ni HTML racine, ni ressource d’un répertoire public. Il a été supprimé comme artefact vide, sans toucher aux PDF, à l’export ITK ni aux données utilisateur. Aucun autre fichier au rôle incertain n’est supprimé.

## Points à préparer pour le lot 6

Conserver les fonctions de calcul indépendantes des accès au stockage permettra d’introduire un adaptateur distant sans changer les formules. Le futur modèle devra associer chaque progression à un utilisateur authentifié et isoler les données par utilisateur, y compris les séries, copies historiques et préférences. La migration du stockage local devra être explicite et préserver les sauvegardes antérieures.

Les tests des politiques RLS devront essayer un utilisateur propriétaire, un autre utilisateur et un accès non authentifié pour chaque lecture et écriture. Ils devront couvrir les relations entre séries et réponses ; un identifiant de série connu ne doit pas permettre d’atteindre les données d’un autre compte.

La synchronisation devra définir la résolution des conflits, les reprises hors ligne, l’idempotence d’une réponse et la conservation des historiques. Il faudra vérifier la cohérence des statistiques après import et après synchronisation entre appareils. Les tests d’export et de suppression RGPD devront couvrir tous les objets liés, la portée d’un seul utilisateur et le sort des données locales. Ce lot ajoute uniquement ces recommandations : aucun SDK Supabase, compte, schéma distant ou code backend.
