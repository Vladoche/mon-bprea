# Architecture de Mon BPREA

## Organisation et points d’entrée

Le frontend est statique : les dix-huit pages HTML publiques restent à la racine, avec leurs URL, paramètres et identifiants. Elles couvrent l’accueil, les rubriques, les cours et exercices, les outils, le calendrier, le Tableau de bord, les pages Auth/profil et le contact public. Les modules ES sont chargés directement par le navigateur, sans framework ni compilation applicative. Le SDK Supabase est préparé et versionné dans `assets/vendor/supabase.js`.

Supabase Auth/PostgreSQL fournit le backend des espaces personnels lorsque l’environnement est explicitement configuré. Le défaut `assets/auth-config.json` reste désactivé. Le [contrat Auth](AUTHENTIFICATION.md) et les contrats de synchronisation décrivent les comportements du compte ; la [fiche de reprise](../developpement/REPRISE-CODEX.md) porte l’état actuel de la livraison et ses prochaines actions.

`assets/` regroupe déjà les domaines par préfixes (`drill-`, `dashboard-`, `calendar-`, `daily-`, etc.). Préserver les imports, liens HTML et chemins JSON limite le risque sur le préfixe GitHub Pages et le versionnement des ressources. Les PDF publics restent dans `documents/` avec leurs adresses existantes.

Les sources éditables de navigation, événements, ressources, questions Drill, botanique et anecdotes sont en JSON versionné. `content.js` conserve les UC, cours, QCM et données ITK. Aucun identifiant pédagogique ne doit être changé pour faciliter un déplacement ou un test.

## Dépendances et frontières

| Domaine | Données et calcul | Interface et contrat |
| --- | --- | --- |
| Auth et profils | `supabase-client.js`, `auth-service.js`, privilèges SQL/RLS | `auth-header.js`, `auth-pages.js` · [Auth](AUTHENTIFICATION.md) |
| Cours et QCM | `course-quiz-service.js`, cache personnel et historique visiteur ; `exam-stats.js` | `app.js` · [Synchronisation cours/QCM](COURSE-QUIZ-SYNCHRONISATION-CLIENT.md) |
| Drill | `drill-bank.js`, `drill-engine.js`, stockage visiteur et service personnel | `drill.js` · [Moteur](MODE-DRILL.md), [client](DRILL-SYNCHRONISATION-CLIENT.md), [backend](DRILL-SYNCHRONISATION-BACKEND.md) |
| Tableau de bord | `dashboard-data.js`, `dashboard-stats.js` ; vue validée du visiteur ou du compte | `dashboard.js`, synthèse de `section-hubs.js` · [Dashboard](DASHBOARD.md) |
| Botanique | Banque, moteur et store visiteur ; synchronisation personnelle | `botanical.js` · [Reconnaissance](RECONNAISSANCE-PLANTES.md), [client](BOTANICAL-SYNCHRONISATION-CLIENT.md) |
| ITK et apparence | `content.js`, `settings-service.js`, `theme-init.js` | `app.js`, `appearance.js` · [Synchronisation](ITK-APPEARANCE-SYNCHRONISATION-CLIENT.md), [thèmes](THEMES.md) |
| Calendrier et examens | `calendar-data.js`, statistiques QCM et Drill distinctes | `calendar.js`, `exam-preparation.js` ; détails ci-dessous |
| Navigation | `navigation.json`, UC de `content.js` | `navigation.js`, `breadcrumbs.js`, `section-hubs.js` · [Navigation](NAVIGATION.md) |
| Ressources | `resources.json`, PDF publics ; `resources.js` | `resource-library.js` · [Ressources](RESSOURCES.md) |
| Anecdote | `daily-facts.json`, date Paris, rotation et masquage en mémoire de page | `daily-fact.js` · [Anecdotes](ANECDOTES.md) |
| Données personnelles | Services d’export, restauration et effacement local | [Export](EXPORT-DONNEES-PERSONNELLES.md), [restauration](RESTAURATION-DONNEES-PERSONNELLES.md), [suppression](SUPPRESSION-DONNEES-PERSONNELLES.md) |

`app.js` orchestre le rendu selon `data-page` et délègue aux modules de domaine. Il conserve aussi les rendus et calculs historiques des cours, QCM et ITK. Extraire seulement la logique utile au comportement modifié et la réutiliser dans le site ; ne pas importer un module d’interface uniquement pour calculer.

Les statistiques du Tableau de bord et la synthèse de S’exercer partagent les premières réponses Drill validées. Le taux global est pondéré par le nombre d’exercices réalisés. Les questions non réalisées, les tentatives QCM et les entraînements Drill ne doivent pas être mélangés. Les contrats de domaine précisent les dates et les limites d’interprétation.

## Stockage et conservation des données

| Stockage | Données et invariants |
| --- | --- |
| `bprea-demo-progress-v1` | Cours terminés, meilleurs scores, tentatives QCM et archives visiteur compatibles |
| `bprea-demo-drill-v1` | Séries, copies versionnées des questions, brouillons, premières réponses et entraînements séparés |
| `monbprea.botanical.v1` | Historique botanique visiteur |
| Mémorisations ITK et apparence | Choix conservés sur demande ; anciens formats préservés et repris explicitement selon les guides de domaine |
| IndexedDB personnel | Caches, conflits et opérations en attente isolés par environnement/projet/UUID Auth |
| Supabase/PostgreSQL | Données personnelles distantes ; RLS, grants et privilèges de colonnes contrôlent l’accès réel |

L’import visiteur vers un compte est volontaire. Les copies historiques et les données illisibles restent conservées. Une déconnexion masque les vues privées et invalide les requêtes sans supprimer la progression ni les opérations en attente. Une confirmation distante est nécessaire avant de promettre qu’une opération existe sur un autre appareil. Le cache personnel n’est pas chiffré ; l’appareil partagé et les XSS restent des risques à prendre en compte.

Le lecteur Drill valide les données avant les calculs. L’adaptateur Dashboard reste en lecture seule. Le stockage peut être bloqué, saturé ou contenir un ancien format : les tests vérifient les états d’erreur, la relecture persistée et la conservation des chaînes inconnues. Le repli `localStorage` ne garantit pas une transaction parfaite entre onglets, même lorsque les verrous Web Locks sont utilisés quand ils sont disponibles.

Les semaines Drill et l’anecdote suivent Europe/Paris ; les saisons et ambiances suivent le calendrier et l’heure du navigateur ; les événements sont des dates civiles sans horaire. Les tests fixent l’instant et couvrent les transitions pertinentes sans changer ces conventions. L’expiration des JWT réels conserve le temps réel.

## Chemins, publication et outils

Les liens publics sont relatifs, sans `/` initial ni nom de dépôt codé en dur. Les JSON chargés par `new URL('./fichier.json', import.meta.url)` conservent leur relation au module. `scripts/prepare-pages.py` copie les HTML racine, les types publics autorisés dans `assets/` et les PDF de `documents/`, puis ajoute `.nojekyll`. Les versions CSS/JS/JSON s’appliquent à cette copie ; voir [CACHE.md](CACHE.md).

Le workflow `.github/workflows/deploy.yml` publie uniquement l’artefact `site-public/` via GitHub Actions après une poussée sur `main` ou un déclenchement manuel. Les outils npm, configurations de tests, documentation, caches et rapports sont exclus de cette liste publique. La publication et les opérations PROD restent soumises à autorisation explicite.

Les configurations des outils sont dans `tests/`, les scripts locaux dans `scripts/`, et la structure attendue par Supabase CLI reste dans `supabase/`. Les migrations historiques ne sont ni renommées ni réécrites. Consulter les [commandes de test](../TESTS.md), la [politique de maintenance](../developpement/MAINTENANCE-DOSSIER-TMP.md) et le [guide des PDF](../../documents/README.md).

Les contrats de domaine sont dans ce dossier ; les preuves 6.6 restent dans [les validations en cours](../validations/), les rapports antérieurs dans [les archives](../archives/validations/). Chaque preuve garde la portée de son exécution et ne certifie pas les commits suivants.

## Modifier les événements et les examens

Le fichier **`assets/calendar-events.json`** est la seule source des dates du calendrier et du bandeau d’accueil. Il est livré vide :

```json
{
  "version": 1,
  "events": []
}
```

Ajoute des objets dans `events`. Exemple **entièrement fictif**, qui ne représente aucune date réelle de formation :

```json
{
  "version": 1,
  "events": [
    {
      "id": "exemple-examen-uc3",
      "title": "Exemple fictif — période d’examen UC 03",
      "type": "examen",
      "start": "2027-06-14",
      "end": "2027-06-16",
      "unit": "uc3",
      "location": "Lieu fictif",
      "description": "Exemple de structure uniquement. Dates à remplacer par celles du centre.",
      "example": true
    }
  ]
}
```

| Champ | Règle |
| --- | --- |
| `id` | Texte obligatoire, unique et stable. |
| `title` | Intitulé obligatoire, affiché comme du texte (pas de HTML). |
| `type` | `cours`, `stage`, `vacances` ou `examen`. |
| `start` | Date obligatoire au format strict `YYYY-MM-DD`. |
| `end` | Facultatif ; même date que `start` si omis. Doit être postérieur ou égal au début. |
| `unit` | Facultatif : `uc1`, `uc2`, `uc3`, `uc4`, `uc5`, `ucare1` ou `ucare2`. Recommandé pour chaque examen afin d’afficher ses statistiques. |
| `location`, `description` | Textes facultatifs. Les retours à la ligne de la description sont conservés. |
| `example` | Booléen facultatif, `false` par défaut. `true` identifie visiblement un exemple fictif et l’exclut toujours du bandeau d’examen. |

Les journées de début **et** de fin sont incluses. Les périodes peuvent chevaucher des mois ou des années. Les dates sont des journées civiles dans le fuseau du navigateur, sans horaires ; le compte à rebours reste exact lors d’un changement d’heure. Pour enregistrer un véritable examen, utilise uniquement les dates communiquées par le centre et omets `example` ou mets-le à `false`.

Le calendrier ouvre le mois courant et permet de revenir à aujourd’hui, d’avancer/reculer et de choisir directement un mois. Sur mobile, la grille présente le nombre d’événements par jour et l’agenda placé dessous conserve tous les titres et les accès au détail. Liens directs possibles : `calendrier.html?month=2027-06`, `?date=2027-06-14` ou `?event=exemple-examen-uc3`.

Un événement invalide (date impossible, fin avant début, catégorie inconnue, identifiant répété…) est écarté de l’affichage avec un avertissement, sans modifier le fichier. Une UC inconnue laisse l’événement visible, sans lien ni statistiques d’UC. Un fichier vide, manquant ou illisible a un état explicite et une erreur de chargement peut être relancée. Recharge la page après modification du JSON.

Les chemins sont relatifs et fonctionnent sous le sous-dossier GitHub Pages. Le workflow copie et versionne les pages et les ressources publiques, y compris ce JSON. La modification se prépare sur la branche dédiée ; **ne pas fusionner vers `main`, pousser vers `main` ou lancer le workflow de publication sans validation préalable**.

## Comprendre le bandeau de préparation

Le bandeau, directement sous l’en-tête de l’accueil, choisit l’examen non fictif en cours ou à venir dont le début est le plus ancien. Une période en cours est donc prioritaire ; après sa date de fin, elle disparaît de la sélection. Si plusieurs périodes commencent ensemble ou sont en cours, un message renvoie au calendrier pour consulter toutes les UC. Le lien du bandeau ouvre le mois du début. Le compte à rebours se met à jour au retour sur l’onglet et au changement de jour (vérification chaque minute).

Les statistiques concernent **les questions des QCM disponibles de l’UC**, et non les cours cochés comme terminés :

- **Exercices terminés** : questions des QCM corrigés au moins une fois / questions disponibles dans l’UC. Une répétition n’augmente pas ce nombre. Un ancien meilleur score, y compris zéro, prouve qu’un QCM a été corrigé.
- **Taux de réussite** : total des bonnes réponses / total des questions de toutes les tentatives historisées, y compris celles avec des erreurs et les répétitions. Les exercices non réalisés ne sont jamais comptés comme des erreurs.
- **Indice indicatif sur 100** : fraction des exercices terminés × fraction de bonnes réponses observées × 100. Exemple de calcul, sans résultat utilisateur : 50 % terminés et 80 % de bonnes réponses donnent 40/100. Les calculs gardent leurs valeurs exactes ; seul l’affichage est arrondi.

L’indice est un repère pour organiser les révisions, **jamais une probabilité de réussir l’examen**. Il ne mesure ni la pratique ni l’oral, et sa portée dépend des QCM disponibles. Aucun seuil, badge ou récompense n’est associé à cet indice.

Le suivi du **Mode Drill** apparaît désormais dans une ligne distincte pour l’UC de l’examen. Ses premières réponses comptabilisées et ses entraînements restent séparés des QCM de cours et de leur indice : les questions réutilisées ne sont pas additionnées comme des questions uniques.

Sans examen, sans UC associée, sans QCM disponible ou sans tentative historisée, le bandeau explique ce qui manque. Avec des QCM disponibles mais non réalisés, la complétion est 0 %, tandis que réussite et indice restent non calculables. Les seuls anciens meilleurs scores ne suffisent pas à inventer un taux de réussite historique : ils contribuent à la complétion et un avertissement précise la portée des données. Dès qu’une nouvelle tentative est enregistrée, réussite et indice utilisent les tentatives documentées.

### Sauvegardes préservées

En visiteur, la clé existante `bprea-demo-progress-v1` reste utilisée. Les champs `done`, `score` (meilleur score) et les autres propriétés sont conservés ; chaque correction ajoute, sous l’identifiant du cours, une entrée à `quizAttempts` contenant `score`, `total` et `completedAt` (date ISO de correction). Les tentatives ne sont pas remplacées lors d’un nouveau QCM. `legacyQuizScore` conserve le meilleur score antérieur à cet historique, sans lui attribuer de date fictive. Les valeurs illisibles sont conservées dans des champs d’archive et exclues des calculs. Les écritures relisent la sauvegarde courante pour préserver les modifications réalisées dans un autre onglet avant l’enregistrement. Le compte configuré utilise un cache personnel IndexedDB par environnement/projet/UUID et ne lit pas cette clé comme progression personnelle.

Les clés `bprea-demo-itk-v1` et `bprea-demo-theme-v1` restent indépendantes. Le calendrier ne modifie aucune donnée utilisateur. En visiteur, aucun résultat n’est envoyé au serveur et le stockage reste propre au navigateur et à l’adresse du site. Dans un compte configuré, cours et QCM sont disponibles sur un autre appareil après confirmation distante ; une panne conserve les opérations sur l’appareil en attente de reprise. Si l’espace local est indisponible ou saturé, le QCM signale que la tentative ne peut pas être conservée. L’historique grandit au fil des corrections, sans purge automatique.

Les parcours vérifiés et les limites de la vérification sont consignés dans [VALIDATION-LOT1.md](../archives/validations/VALIDATION-LOT1.md).
