# Mon BPREA — Démonstration fonctionnelle

Un site de révision **entièrement statique** (HTML, CSS, JavaScript), prêt pour GitHub Pages. Aucun serveur, aucune installation de dépendances et aucun système de suivi de tests requis.

## Fonctions incluses

- **Accueil** : 5 UC nationales et 2 UCARE, navigation et suivi de progression.
- **UC 03** : quatre cours d'exemple (cycle de la matière organique, C/N, pédofaune, pédoflore et indicateurs).
- **Exercices** : 3 QCM corrigés par cours, soit 12 questions, meilleur score conservé.
- **Suivi** : marquage des cours terminés dans le stockage local du navigateur.
- **Générateur ITK** : tomate, laitue, carotte, courgette, choix de variété/type, abri/plein champ, surface, mois, sol et disponibilité en eau. Calendrier indicatif, alerte selon contraintes, export CSV et impression en PDF via le navigateur.
- **Bibliothèque documentaire** : 5 sites et 3 PDF conservés, recherche dans les métadonnées, filtres combinés par UC, cours, chapitre, thématique, type et organisme, tri et navigation entre cours et ressources. Les cours et UC présentent leurs ressources associées.
- **Mode sombre** : interrupteur présent sur toutes les pages, préférence conservée dans le navigateur.
- **Calendrier annuel** : navigation par mois, cours, stages, vacances, examens associés à une UC, agenda et détail des événements. Calendrier livré vide, sans dates de formation inventées.
- **Préparation aux examens** : prochaine période, compte à rebours et statistiques locales de l’UC, avec un indice indicatif expliqué et des états sans données.
- **Mode Drill** : dix questions par UC chaque semaine ISO à partir du lundi 00 h Europe/Paris, corrections, brouillons, entraînements séparés et historique. Banque initiale de 12 questions pour l’UC 03 ; autres UC explicitement incomplètes.
- **Tableau de bord pédagogique** : résultats réels du Mode Drill, volumes et taux hebdomadaires, comparaison des UC et notions à retravailler ; filtres par UC et sur 4, 8, 12 semaines ou tout l’historique, graphiques et tableaux accessibles.
- Interface responsive (ordinateur et mobile).

## Consulter la démo en local

Le JavaScript utilise des modules ES, qui ne sont pas chargés de façon fiable en ouvrant directement le fichier `index.html` en `file://` dans certains navigateurs. Démarre un mini-serveur local.

Si Python est disponible :

```bash
cd bprea-demo
python -m http.server 8000
```

Puis ouvre <http://localhost:8000>.

Tu peux aussi utiliser l'extension **Live Server** de VS Code.

## Déployer sur GitHub Pages (sans étape de compilation)

1. Crée un dépôt GitHub, par exemple **`mon-bprea`**. Pour GitHub Pages sur un compte GitHub Free, le dépôt doit généralement être **public**.
2. Ajoute **tout le contenu du dossier `bprea-demo` à la racine du dépôt**, y compris le dossier caché `.github/workflows/` et le fichier `.nojekyll`.
3. Dans GitHub, va dans **Settings → Pages → Build and deployment → Source : GitHub Actions**.
4. Pousse les fichiers sur la branche `main` ; le workflow `Publier le site BPREA` publiera automatiquement le site.
5. Le site sera consultable à `https://TON-PSEUDO.github.io/mon-bprea/` (adapte le nom du dépôt).

> Tu n'as **pas** besoin de configurer un « base path ». Tous les liens internes sont relatifs. Aucun nom d'utilisateur ou de dépôt n'est codé en dur.

### Depuis Git en local (exemple)

```bash
cd bprea-demo
git init
git add .
git commit -m "Premiere demo BPREA"
git branch -M main
git remote add origin https://github.com/TON-PSEUDO/mon-bprea.git
git push -u origin main
```

Crée d'abord le dépôt vide depuis GitHub. La première publication GitHub Pages peut demander quelques minutes.

## Modifier et enrichir le contenu

- `assets/content.js` : intitulés des UC dans `units`, cours dans `lessons`, questions dans `quiz`, données ITK dans `crops`.
- `assets/resources.json` : **catalogue éditable unique** des ressources et registre de chapitres ; relations explicites vers les identifiants des UC et cours.
- `assets/resources.js` : lecture, validation et recherche du catalogue JSON ; aucun second catalogue à maintenir.
- `assets/resource-library.js` / `assets/resource-library.css` : bibliothèque documentaire, recherche, filtres et ressources associées aux pages de cours et d’UC.
- `documents/` : PDF accessibles aux visiteurs ; [documents/README.md](documents/README.md) explique leur classement et la préservation des chemins existants.
- `assets/theme-init.js` : application du thème sombre ou clair dès le chargement.
- `assets/style.css` : palette, mise en page, styles responsives et mode sombre.
- `assets/app.js` : navigation, progression, exercices, calcul ITK et export.
- `assets/calendar-events.json` : événements et dates d’examen, modifiables sans changer le JavaScript.
- `assets/calendar-data.js` et `assets/calendar.js` : lecture/validation des événements, navigation mensuelle, agenda et détail.
- `assets/exam-stats.js` et `assets/exam-preparation.js` : statistiques des QCM et bandeau d’accueil ; `assets/calendar.css` et `assets/exam-preparation.css` : leurs styles clair/sombre.
- `drill.html` et `assets/drill.js` / `assets/drill.css` : interface du Mode Drill ; `assets/drill-engine.js` : semaines, sélection et statistiques ; `assets/drill-store.js` : sauvegardes indépendantes.
- `assets/drill-bank.json` et `assets/drill-bank.js` : banque éditable et validation des questions.
- `tableau-de-bord.html` et `assets/dashboard.js` / `assets/dashboard.css` : interface du Tableau de bord ; `assets/dashboard-data.js` : adaptateur de lecture seul, fondé sur la validation/normalisation du stockage Drill ; `assets/dashboard-stats.js` : calculs purs et séries temporelles réutilisables.
- Les pages `index.html`, `uc.html`, `cours.html`, `exercices.html`, `itk.html`, `ressources.html`, `calendrier.html`, `drill.html` et `tableau-de-bord.html` sont les points d'entrée.

Chaque objet dans `lessons` comprend `id`, `unit`, `chapter`, `title`, `summary`, `body` (HTML pédagogique), `essentials` et `quiz`. On pourra par la suite passer à un générateur de documentation (Astro/Starlight) si la bibliothèque de cours devient volumineuse. Pour cette V1, la structure sans dépendance évite tout build et fonctionne directement sur GitHub Pages.

## Administrer la bibliothèque documentaire

Le fichier **`assets/resources.json`** réunit les fiches dans `resources` et le registre stable des chapitres dans `chapters`, avec `version: 1`. Aucune connaissance de JavaScript n’est nécessaire : modifie les valeurs JSON entre guillemets, conserve les virgules entre les objets et n’ajoute pas de commentaire dans le fichier.

La bibliothèque présente les filtres UC, thématique et type ; « Préciser par cours, chapitre ou organisme » ouvre les critères supplémentaires. Tous les critères se combinent. Le tri propose les titres de A à Z ou de Z à A selon l’ordre alphabétique français, ou la date d’ajout de la plus récente à la plus ancienne ; les fiches sans date connue restent à la fin, par titre. « Réinitialiser les filtres » revient à toute la bibliothèque avec le tri par titre de A à Z.

1. **Ajouter un site** : ajoute une fiche à `resources`, avec un `id` unique et stable, un titre, une description, `type: "website"` et son `url` en `https://` ou `http://`. Renseigne l’organisme, la source et les mots-clés disponibles.
2. **Ajouter un PDF** : copie d’abord un petit document que tu as le droit de republier dans un sous-dossier de `documents/`, puis ajoute une fiche avec `type: "pdf"` et `file`, par exemple `documents/sols/ma-fiche.pdf`. Le fichier et sa fiche doivent être livrés ensemble. L’interface permet de le consulter ou de le télécharger.
3. **Associer une UC** : renseigne `units`, par exemple `["uc2", "uc3"]` pour une ressource commune aux deux UC. Une seule fiche suffit. Une liste vide garde une ressource générale.
4. **Associer plusieurs cours** : renseigne leurs identifiants exacts dans `lessons`. Par exemple `["pedofaune", "pedoflore"]` pour une nouvelle fiche personnelle conçue pour ces deux cours. Les cartes « Pour approfondir » proviennent uniquement de ces relations explicites ; une UC, un chapitre ou un mot-clé commun ne crée pas de lien automatique vers un cours.
5. **Classer par chapitre et thématique** : `chapters` contient les identifiants du registre, par exemple `["uc3-sol-vivant"]`. `themes` contient des intitulés libres et réutilisables, par exemple `["Sol", "Biologie du sol"]`. Le chapitre sert au classement et au filtre ; les mots-clés servent à la recherche.
6. **Modifier ou retirer une fiche** : corrige l’objet existant en conservant son `id`, ou retire cet objet de `resources`. Supprimer une fiche ne supprime pas son PDF ; conserve les fichiers déjà liés tant que leur retrait n’a pas été décidé. Après un renommage de cours, corrige les relations par identifiant.
7. **Vérifier avant publication** : démarre le serveur HTTP local, ouvre la bibliothèque puis le cours associé, combine les filtres et vérifie consultation/téléchargement. Respecte la casse et le nom réel du fichier ; utilise des chemins relatifs sans `/` initial pour conserver le sous-dossier GitHub Pages. Évite espaces et accents pour les nouveaux fichiers et n’encode pas deux fois un nom existant. La mise en production nécessite une validation préalable.

Le guide [RESSOURCES.md](RESSOURCES.md) détaille tous les champs et donne deux exemples concrets : une **fiche personnelle de biologie du sol à créer**, associée à `pedofaune` et `pedoflore`, et le **site GRAB déjà présent**, commun aux UC 02 et UC 03. Ces exemples n’ajoutent aucun PDF tiers au dépôt.

La recherche porte sur les métadonnées des fiches, sans indexer le texte intégral des PDF. La disponibilité des PDF locaux est vérifiée automatiquement dès l’affichage de leur fiche, dans la bibliothèque, les cours et les UC. Un fichier introuvable ou ne correspondant pas à un PDF retire ses liens d’action et permet de réessayer la vérification. Une panne ou un délai dépassé de 10 secondes laisse un état « non vérifié », avec la possibilité d’essayer de consulter le document ou de relancer le contrôle. Les liens externes peuvent changer ou devenir indisponibles et ne sont pas vérifiés automatiquement depuis ce site statique. Les dates et organismes absents ne sont pas inventés. Les vérifications réellement réalisées et leurs limites sont consignées dans [VALIDATION-LOT4.md](VALIDATION-LOT4.md).

## Utiliser le mode sombre

Clique sur « Mode sombre » en haut du site. Le choix est conservé dans `localStorage` sous `bprea-demo-theme-v1` et appliqué à toutes les pages sur le même navigateur, jusqu'à ce que les données locales soient effacées. Sans préférence enregistrée, le site démarre en mode clair. L'impression d'un ITK conserve une présentation claire.

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

Les chemins sont relatifs et fonctionnent sous le sous-dossier GitHub Pages. Le workflow existant copie déjà les pages HTML et tout `assets/`, y compris ce JSON : aucune configuration de déploiement supplémentaire. La modification se prépare sur la branche dédiée ; **ne pas fusionner vers `main`, pousser vers `main` ou lancer le workflow de publication sans validation préalable**.

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

La clé existante `bprea-demo-progress-v1` reste utilisée. Les champs `done`, `score` (meilleur score) et les autres propriétés sont conservés ; chaque correction ajoute, sous l’identifiant du cours, une entrée à `quizAttempts` contenant `score`, `total` et `completedAt` (date ISO de correction). Les tentatives ne sont pas remplacées lors d’un nouveau QCM. `legacyQuizScore` conserve le meilleur score antérieur à cet historique, sans lui attribuer de date fictive. Les valeurs illisibles sont conservées dans des champs d’archive et exclues des calculs. Les écritures relisent la sauvegarde courante pour préserver les modifications réalisées dans un autre onglet avant l’enregistrement.

Les clés `bprea-demo-itk-v1` et `bprea-demo-theme-v1` restent indépendantes. Le calendrier ne modifie aucune donnée utilisateur. Aucun résultat n’est envoyé au serveur. Le stockage reste propre au navigateur et à l’adresse du site ; il n’est pas synchronisé entre appareils. Si l’espace local est indisponible ou saturé, le QCM signale que la tentative ne peut pas être conservée. L’historique grandit au fil des corrections, sans purge automatique.

Les parcours vérifiés et les limites de la vérification sont consignés dans [VALIDATION-LOT1.md](VALIDATION-LOT1.md).

## Utiliser et enrichir le Mode Drill

Ouvre **Mode Drill** dans la navigation, choisis une UC puis une semaine et clique sur « Commencer cette série ». Chaque choix est sauvegardé avant validation. Après validation, la correction explique la réponse ; « Revoir cette question » ajoute un entraînement séparé sans changer le résultat initial de la série. Tu peux reprendre une ancienne série sans avoir terminé les autres.

La semaine suit **Europe/Paris**, indépendamment du fuseau de l’appareil. Dix questions différentes sont sélectionnées de façon reproductible par UC et par semaine ISO. Avec la banque actuelle de 12 questions UC 03, huit questions communes entre deux semaines consécutives sont inévitables ; aucune question n’est dupliquée dans une série. Les UC avec moins de dix questions exploitables affichent « Banque incomplète ». Sans réponse validée, le taux affiche **« Aucune donnée »**.

Pour ajouter un exercice, modifie **`assets/drill-bank.json`** : un document `{"version":1,"questions":[...]}` contient des questions avec `id` permanent, `version` entière positive, `unit`, `chapter`, `concept`, `type: "single-choice"`, `prompt`, `options: [{"id":"a","text":"..."}, ...]`, `answer` (identifiant d’option), `explanation`, `difficulty` et une `reference` facultative `{title,url}`. Utilise au moins deux options aux identifiants distincts et une seule réponse attendue. Les champs facultatifs `sourceLesson` et `sourceQuestionIndex` conservent le lien avec les QCM existants. Lors d’une correction, garde l’identifiant et augmente la version ; les séries commencées gardent leur copie complète des questions.

La progression utilise **`bprea-demo-drill-v1`**, sans modifier les anciennes clés de cours, QCM, ITK ou thème. Chaque série conserve sa semaine, ses questions versionnées, ses brouillons et ses réponses datées ; la première réponse compte une fois, les entraînements sont historisés à part. Le taux est `bonnes premières réponses / exercices réalisés × 100` ; les questions non réalisées n’entrent pas au dénominateur.

Le schéma complet, un exemple JSON réel, les règles de sélection et les limites sont détaillés dans [MODE-DRILL.md](MODE-DRILL.md). Les vérifications de ce lot sont consignées dans [VALIDATION-LOT2.md](VALIDATION-LOT2.md).

## Lire le Tableau de bord pédagogique

Ouvre **Tableau de bord** dans la navigation. Le filtre d’UC et la période s’appliquent aux résultats affichés ; la comparaison conserve les UC côte à côte sur cette période, avec leurs volumes. Les périodes de 4, 8 et 12 semaines comprennent la semaine courante. L’historique complet va de la première activité fiable, toutes UC confondues, à la semaine courante : changer d’UC garde le même axe temporel. Les graphiques proposent des détails interactifs et une pagination par fenêtre d’au plus 12 semaines ; le tableau conserve toute la période et les totaux ne changent pas en passant d’une fenêtre à l’autre. Une semaine sans réponse reste une absence de données et coupe la courbe de réussite.

Le Tableau de bord lit exclusivement les premières réponses validées des séries du Mode Drill. L’adaptateur `readDashboardData()` s’appuie sur `readDrillState()`, qui valide et normalise les données enregistrées ; le calcul statistique reste indépendant du stockage et du DOM. Une réponse est comptée une fois par couple série/question. Les brouillons, entraînements répétés et QCM de cours n’entrent pas dans ces totaux. Une question reprise dans une autre série hebdomadaire constitue un autre exercice réalisé. Le taux est **bonnes premières réponses / premières réponses réalisées × 100** ; les résultats globaux sont pondérés par le nombre de réponses, jamais par une moyenne des pourcentages. Seul l’affichage est arrondi. Sans réponse, les volumes valent zéro et le taux reste « Aucune donnée ».

L’activité d’une réponse appartient à la semaine ISO de sa date de validation `answeredAt`, dans **Europe/Paris**. Une ancienne série effectuée aujourd’hui contribue donc à la semaine actuelle, tandis que le Mode Drill continue à présenter ses séries par semaine d’origine. Cette différence de regroupement ne change pas les totaux sur l’historique complet.

Une date `answeredAt` postérieure à l’instant de calcul est exclue, même si elle appartient à la semaine courante. Les réponses futures, les UC inconnues et les données illisibles produisent un avertissement de **bilan partiel** ; leurs valeurs sources restent conservées. Vérifie l’horloge de l’appareil si des dates futures sont signalées.

Les catégories descriptives sont configurables dans `DASHBOARD_THRESHOLDS`, au début de `assets/dashboard-stats.js` : au moins **5 réponses** sont nécessaires ; à partir de **80 %**, un point fort est observé ; sous **60 %**, la notion est à retravailler ; entre les deux, elle est à consolider. Moins de 5 réponses donne « Données insuffisantes ». Ce sont des repères d’organisation sans validation scientifique, sans badge et sans prédiction de réussite à l’examen.

Les notions sont regroupées par **UC + chapitre + notion** à partir des copies de questions enregistrées dans chaque série. Les modifications ultérieures de la banque ne réécrivent pas les résultats historiques ; des changements de libellés peuvent séparer des groupes. Le faible volume de la banque, les répétitions de questions et les notions effectivement couvertes limitent l’interprétation. Les liens vers les cours et exercices reposent sur les associations réellement disponibles.

La page ne modifie aucune donnée utilisateur et n’exige pas le chargement de la banque actuelle. Le stockage reste local, sans synchronisation ni backend ; la couche de calcul séparée pourra recevoir plus tard une source synchronisée après adaptation de la lecture. Les règles complètes et les limites figurent dans [DASHBOARD.md](DASHBOARD.md). Les vérifications réellement effectuées et leurs limites sont consignées dans [VALIDATION-LOT3.md](VALIDATION-LOT3.md). Aucun déploiement en production ne doit être lancé sans validation.

## Limites explicites

- **Contenus pédagogiques illustratifs** : les formulations des cours sont simplifiées pour la démonstration ; ne remplacent ni les supports des formateurs ni le référentiel de certification. Les intitulés des UC reprennent la structure nationale du BPREA ; leur affectation aux chapitres reste à valider avec le centre.
- **ITK simplifié et non prescriptif** : les densités, périodes et durées sont des ordres de grandeur pédagogiques, pas des recommandations agronomiques validées pour une parcelle donnée. Les paramètres sol/eau déclenchent des avertissements mais pas de calcul de fertilisation, d'irrigation ou de rendement. Aucune prise en compte automatique de la météo, de l'analyse de sol, de la région, des résistances variétales ou du marché.
- **Variétés** : exemples de noms et types, sans base variétale scientifique. Choisir une variété modifie les **points de vigilance**, mais **pas** les dates ni les densités faute de fiches variétales documentées. À développer avec un catalogue sourcé.
- **Stockage** : progression, score et dernière configuration ITK sont conservés dans `localStorage`, sur ce navigateur uniquement. Pas de synchronisation entre appareils. Effacer les données du navigateur supprime ce suivi.
- **Confidentialité** : GitHub Pages ne protège pas le site par mot de passe ; ne pas publier de supports sous droits ou de données privées.
- **Polices** : polices système (aucun appel à un service tiers).

## Références pour poursuivre

- [Référentiel BPREA et ressources ministérielles — Chlorofil](https://chlorofil.fr/diplomes/secondaire/bp/rea)
- [Présentation des UC nationales — AgriOrientation](https://www.agrorientation.com/trouver-ma-formation/trouver-une-formation/bp-rea-agriculture-biologique)
- [GitHub Pages — Documentation GitHub](https://docs.github.com/en/pages)

---

Projet de démonstration personnel, octobre 2026.
