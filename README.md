# Mon BPREA — Démonstration fonctionnelle

Un site de révision **entièrement statique** (HTML, CSS, JavaScript), prêt pour GitHub Pages. Aucun serveur, aucune installation de dépendances et aucun système de suivi de tests requis.

## Fonctions incluses

- **Accueil** : 5 UC nationales et 2 UCARE, navigation et suivi de progression.
- **UC 03** : quatre cours d'exemple (cycle de la matière organique, C/N, pédofaune, pédoflore et indicateurs).
- **Exercices** : 3 QCM corrigés par cours, soit 12 questions, meilleur score conservé.
- **Suivi** : marquage des cours terminés dans le stockage local du navigateur.
- **Générateur ITK** : tomate, laitue, carotte, courgette, choix de variété/type, abri/plein champ, surface, mois, sol et disponibilité en eau. Calendrier indicatif, alerte selon contraintes, export CSV et impression en PDF via le navigateur.
- **Ressources documentaires** : 5 sites de référence, recherche et filtres, plus un PDF d’exemple téléchargeable.
- **Mode sombre** : interrupteur présent sur toutes les pages, préférence conservée dans le navigateur.
- **Calendrier annuel** : navigation par mois, cours, stages, vacances, examens associés à une UC, agenda et détail des événements. Calendrier livré vide, sans dates de formation inventées.
- **Préparation aux examens** : prochaine période, compte à rebours et statistiques locales de l’UC, avec un indice indicatif expliqué et des états sans données.
- **Mode Drill** : dix questions par UC chaque semaine ISO à partir du lundi 00 h Europe/Paris, corrections, brouillons, entraînements séparés et historique. Banque initiale de 12 questions pour l’UC 03 ; autres UC explicitement incomplètes.
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
- `assets/resources.js` : **catalogue éditable** des liens externes et des documents PDF (voir ci-dessous).
- `documents/` : fichiers PDF accessibles aux visiteurs.
- `assets/theme-init.js` : application du thème sombre ou clair dès le chargement.
- `assets/style.css` : palette, mise en page, styles responsives et mode sombre.
- `assets/app.js` : navigation, progression, exercices, calcul ITK et export.
- `assets/calendar-events.json` : événements et dates d’examen, modifiables sans changer le JavaScript.
- `assets/calendar-data.js` et `assets/calendar.js` : lecture/validation des événements, navigation mensuelle, agenda et détail.
- `assets/exam-stats.js` et `assets/exam-preparation.js` : statistiques des QCM et bandeau d’accueil ; `assets/calendar.css` et `assets/exam-preparation.css` : leurs styles clair/sombre.
- `drill.html` et `assets/drill.js` / `assets/drill.css` : interface du Mode Drill ; `assets/drill-engine.js` : semaines, sélection et statistiques ; `assets/drill-store.js` : sauvegardes indépendantes.
- `assets/drill-bank.json` et `assets/drill-bank.js` : banque éditable et validation des questions.
- Les pages `index.html`, `uc.html`, `cours.html`, `exercices.html`, `itk.html`, `ressources.html`, `calendrier.html` et `drill.html` sont les points d'entrée.

Chaque objet dans `lessons` comprend `id`, `unit`, `chapter`, `title`, `summary`, `body` (HTML pédagogique), `essentials` et `quiz`. On pourra par la suite passer à un générateur de documentation (Astro/Starlight) si la bibliothèque de cours devient volumineuse. Pour cette V1, la structure sans dépendance évite tout build et fonctionne directement sur GitHub Pages.

## Ajouter un lien documentaire

Ouvre `assets/resources.js` et ajoute un objet dans le tableau `resourceLinks` :

```js
{
  id: 'mon-site',
  title: 'Le nom du site',
  description: 'Une ou deux phrases pour expliquer ce qu’on y trouve.',
  category: 'Maraîchage',
  url: 'https://exemple.fr/',
  tags: ['ITK', 'Bio']
},
```

Chaque identifiant `id` doit être unique. Les adresses des liens externes doivent commencer par `https://` ou `http://`. Les visiteurs ouvrent ces sites dans un nouvel onglet.

## Ajouter un PDF à télécharger

1. Copie ton PDF dans **`documents/`**, par exemple `documents/guide-sols.pdf`.
2. Dans `assets/resources.js`, ajoute un objet dans `resourceFiles` :

```js
{
  id: 'guide-sols',
  title: 'Guide des sols - fiche de révision',
  description: 'Notes personnelles sur la structure et la biologie du sol.',
  category: 'Sol & fertilité',
  file: 'documents/guide-sols.pdf',
  tags: ['Sol', 'PDF', 'UC 03']
},
```

3. Valide les changements et pousse-les sur GitHub. GitHub Actions publiera la nouvelle page, les liens et le dossier `documents/` automatiquement. **Tu dois mettre à jour à la fois le tableau ET le fichier PDF** ; une simple adresse dans le catalogue sans fichier ne fonctionnera pas.

Le bouton « Télécharger le PDF » repose sur l'attribut HTML `download` : les navigateurs modernes proposent généralement un téléchargement, mais leur comportement peut varier selon les réglages. Le lien mène toujours au PDF original.

**Conseils :** utilise des noms de fichiers sans espaces ni accents (lettres, chiffres, tirets, underscores), compresse les PDF si possible et évite d'accumuler des scans très lourds. GitHub Pages publie des fichiers statiques avec une taille totale maximale de site de 1 Go ; pour quelques petites fiches, il n'y a aucun souci. Pour des fichiers volumineux, utilise un hébergement dédié. Les documents d'un site public sont accessibles à tout le monde : vérifie les droits de redistribution de chaque support avant de le publier.

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

Le schéma complet, un exemple JSON réel, les règles de sélection, les données préparées pour le futur Dashboard et les limites sont détaillés dans [MODE-DRILL.md](MODE-DRILL.md). Les vérifications de ce lot sont consignées dans [VALIDATION-LOT2.md](VALIDATION-LOT2.md). Aucune courbe de Dashboard ni gamification n’est ajoutée.

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
