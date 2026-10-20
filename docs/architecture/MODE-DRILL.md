# Mode Drill hebdomadaire — lot 2

Le [Mode Drill](../../drill.html) propose dix exercices distincts par UC et par semaine lorsque sa banque contient au moins dix questions valides. Une série inachevée ou peu réussie ne bloque jamais les suivantes. Chaque première réponse validée donne accès à une correction ; la série peut être interrompue puis reprise dans le même navigateur.

## Banque livrée et portée pédagogique

[assets/drill-bank.json](../../assets/drill-bank.json) contient **12 QCM UC3**, repris sans changement d’énoncé, d’options, de bonne réponse ou d’explication des quatre cours existants :

- [Le cycle de la matière organique](../../cours.html?id=matiere-organique) ;
- [Le rapport carbone / azote](../../cours.html?id=rapport-cn) ;
- [La pédofaune et les vers de terre](../../cours.html?id=pedofaune) ;
- [Pédoflore et indicateurs biologiques](../../cours.html?id=pedoflore).

Ces contenus de démonstration ne constituent pas un référentiel officiel ni une couverture complète de l’UC3. Les autres UC n’ont pas encore de banque ; leur interface indique explicitement « Banque incomplète ». Aucune question n’est dupliquée pour atteindre dix exercices.

## Ajouter ou corriger des questions

Modifier le JSON suffit pour ajouter un QCM compatible : aucun changement JavaScript n’est nécessaire. Le document racine comporte `version: 1` et un tableau `questions`. Exemple complet d’une question déjà présente dans la banque :

```json
{
  "version": 1,
  "questions": [
    {
      "id": "uc3-matiere-organique-k2",
      "version": 1,
      "unit": "uc3",
      "chapter": "Le sol vivant",
      "concept": "Coefficient K2",
      "type": "single-choice",
      "prompt": "Que décrit le coefficient K2 ?",
      "options": [
        { "id": "a", "text": "La proportion d’un apport immédiatement assimilable" },
        { "id": "b", "text": "La fraction du stock humique minéralisée annuellement" },
        { "id": "c", "text": "La densité de vers de terre" }
      ],
      "answer": "b",
      "explanation": "K2 correspond à une fraction annuelle du stock humique minéralisé dans les modèles de bilan.",
      "difficulty": "Fondamentaux",
      "reference": {
        "title": "Le cycle de la matière organique",
        "url": "cours.html?id=matiere-organique"
      },
      "sourceLesson": "matiere-organique",
      "sourceQuestionIndex": 0
    }
  ]
}
```

Ce fragment illustre le format ; il ne faut pas remplacer la banque complète par cette seule question.

| Champ | Règle d’édition |
| --- | --- |
| `id` | Identifiant permanent, unique dans la banque. Minuscules, chiffres et tirets uniquement ; commencer par une lettre ou un chiffre. Ne pas réutiliser l’identifiant d’une autre question. |
| `version` de question | Entier positif. Incrémenter lors d’une correction d’énoncé, d’options, de réponse ou d’explication. Conserver l’identifiant si la question reste la même ; attribuer un nouvel identifiant à une nouvelle question. |
| `unit` | Identifiant d’une UC existante dans `assets/content.js` : `uc1` à `uc5`, `ucare1` ou `ucare2`. |
| `chapter`, `concept` | Textes non vides précisant le chapitre et la notion évaluée. Employer des libellés cohérents : les agrégations par notion utilisent `concept`. |
| `type` | `single-choice` pour cette version. Un type différent est ignoré avec avertissement. |
| `prompt` | Énoncé en texte simple. |
| `options` | Au moins deux objets avec un `id` unique dans la question et un `text` non vide. Les identifiants suivent les mêmes règles que l’identifiant de question. |
| `answer` | Identifiant d’une seule des options, par exemple `"b"` ; ce n’est pas son index numérique. |
| `explanation` | Correction pédagogique non vide : expliquer le raisonnement et, si utile, la confusion à éviter. |
| `difficulty` | Libellé pédagogique non vide, par exemple les catégories existantes « Fondamentaux », « Compréhension » ou « Approfondissement ». Il décrit le contenu, sans progression de niveau ni récompense. |
| `reference` | Facultatif. Si présent : `title` non vide et `url` vers `cours.html?id=...` (ancre simple possible), ou une adresse explicite HTTP(S) sans identifiants de connexion. |
| `sourceLesson` | Facultatif. Identifiant du cours source ; utile pour tracer la réutilisation. |
| `sourceQuestionIndex` | Facultatif. Index entier positif ou nul du QCM source ; la première question porte l’index `0`. |

Les textes sont affichés comme du texte, sans interpréter de HTML. Le JSON doit rester strict : guillemets doubles, pas de commentaire ni de virgule finale. Ne renseigner une référence ou une correction que si elle est vérifiée. Au moins dix identifiants différents et exploitables sont nécessaires **dans chaque UC** pour ouvrir sa série.

Le chargeur [assets/drill-bank.js](../../assets/drill-bank.js) vérifie le format, les unités, les identifiants, les options et la réponse attendue. Les entrées invalides et les doublons sont ignorés avec un avertissement visible. Le document vide `{"version":1,"questions":[]}` est accepté ; une banque absente ou illisible produit un état explicite avec possibilité de réessayer. Le numéro `version` à la racine décrit le format du fichier : le conserver à `1` tant que ce schéma est utilisé.

L’architecture sépare la validation du type de question, la sélection, le stockage et le rendu. Ajouter un autre type exigera son validateur, son interface et son traitement de réponse ; changer seulement `type` dans le JSON ne suffit pas.

## Semaines et sélection des dix exercices

[assets/drill-engine.js](../../assets/drill-engine.js) utilise les semaines ISO 8601, au format `AAAA-Wnn`. L’année ISO peut différer de l’année civile autour du 1er janvier. La semaine courante dépend du jour en **Europe/Paris**, quel que soit le fuseau horaire de l’appareil. Le changement intervient le lundi à 00 h à Paris, heure d’été comprise, à partir de l’horloge de l’appareil.

Pour les règles de numérotation (premier jeudi, année de semaine distincte de l’année civile), voir la [documentation technique du TC39 sur les semaines ISO](https://tc39.es/proposal-temporal/docs/plaindate.html#weekOfYear). Le site effectue ces calculs avec `Date` et `Intl`, sans ajouter de bibliothèque ou de dépendance à Temporal.

La page programme ce changement et le vérifie également lorsqu’elle redevient visible. Si une ancienne série est ouverte au changement de semaine, elle reste consultable ; la nouvelle semaine devient disponible sans clôturer la précédente. Aucun serveur ni tâche planifiée n’intervient.

La sélection est reproductible pour une même UC, une même semaine et le même ensemble d’identifiants :

1. Les questions de l’UC sont triées par identifiant, puis mélangées de manière déterministe en un paquet stable.
2. Le départ dans ce paquet avance de dix positions par semaine, avec retour au début si nécessaire.
3. Les dix questions sélectionnées sont remélangées selon l’UC et la semaine.

Une série ne contient jamais deux fois le même identifiant. Le chevauchement entre deux semaines consécutives est minimal pour la banque disponible : `max(0, 20 − nombre de questions)`. Avec les **12 questions actuelles**, huit questions réapparaissent nécessairement entre deux semaines voisines ; la composition se répète après six semaines, avec un ordre propre à la semaine. Une banque plus large réduit ce chevauchement. Avec exactement dix questions, la composition reste la même et l’ordre varie selon la semaine.

Changer l’ordre du JSON ou la version d’une question ne change pas les identifiants sélectionnés. Ajouter ou retirer des identifiants peut modifier les séries qui n’ont pas encore été commencées. Les séries commencées gardent leur composition et leur contenu sauvegardés.

Le sélecteur propose la semaine courante, les **huit semaines précédentes** et toutes les séries enregistrées de l’UC, sans limite d’ancienneté imposée par l’application. Une semaine ancienne non commencée est composée à partir de la banque disponible au moment de son démarrage ; elle ne reconstitue pas une ancienne version du JSON.

## Sauvegardes et résultats comptabilisés

Les données Drill utilisent la clé locale **`bprea-demo-drill-v1`**, distincte de **`bprea-demo-progress-v1`** pour la progression des cours et QCM. Elles n’effacent et ne migrent pas les anciens résultats.

Le document Drill comporte `version: 1` et une table `series`. Chaque série a l’identifiant `UC__SEMAINE`, par exemple `uc3__2026-W42`, et contient :

- `id`, `unit`, `week` et `startedAt` ;
- `questions` : copie complète des dix questions, de leurs versions, notions, difficultés, options, réponses attendues et références au démarrage ;
- `drafts` : choix non encore validés, sauvegardés à chaque sélection ;
- `trainingDrafts` : choix en cours des tentatives supplémentaires, également conservés pour la reprise ;
- `answers` : première réponse comptabilisée de chaque question et historique de ses tentatives.

La copie des questions est enregistrée en cliquant sur **« Commencer cette série »**, avant la première réponse. Elle préserve l’historique si la banque est ensuite corrigée ou indisponible. Une correction future du JSON ne réécrit pas rétroactivement une série commencée.

La première validation enregistre `answer`, `correct`, `answeredAt` et un tableau `attempts` incluant cette première réponse (`training: false`). Le bouton **« Revoir cette question »** permet des tentatives supplémentaires (`training: true`) datées dans le même historique. Ces entraînements ne modifient ni la première réponse, ni le nombre d’exercices réalisés, ni le taux de la série. Une seconde validation ordinaire de la même question n’ajoute aucun résultat comptabilisé.

```text
Réussite = bonnes premières réponses comptabilisées / exercices réalisés × 100
```

Sans réponse validée, `successRate` vaut **`null`**, affiché **« Aucune donnée »**. Les exercices laissés de côté et les brouillons ne sont pas des erreurs. Une question réapparue dans une autre semaine constitue un nouvel exercice planifié dans cette nouvelle série.

`getSeriesStats()` calcule les résultats d’une série. `getDrillUnitStats()` agrège les séries enregistrées d’une UC, le volume d’entraînement supplémentaire et les résultats par notion. Les semaines, horodatages, versions et difficultés restent accessibles dans les données pour le futur Dashboard ; aucune courbe ni estimation de réussite à l’examen n’est créée par ce lot.

Les réponses Drill restent distinctes des QCM de cours, même lorsque l’énoncé est repris de ceux-ci. Additionner ces deux ensembles comme des questions uniques doublerait certains exercices ; leurs taux et dénominateurs doivent donc rester explicitement séparés. Aucun de ces taux ne représente une probabilité de réussir l’examen.

Lorsqu’un examen est associé à une UC, le bandeau d’accueil présente son suivi Drill dans une ligne distincte : résultats de la semaine courante si la série est commencée, indication explicite sinon, et accès au Mode Drill. Un éventuel bilan de l’historique Drill porte également sur les premières réponses comptabilisées. Ce suivi n’est pas ajouté à la complétion, au taux ni à l’indice des QCM de cours existants.

## Limites du stockage local

La progression appartient à ce navigateur, à ce profil et à l’origine du site. Elle n’est pas synchronisée entre appareils, entre navigateurs ou entre un aperçu local et GitHub Pages. Effacer les données du navigateur entraîne leur perte. Le lot ne fournit pas d’interface d’export/import de la progression Drill.

Les écritures relisent les données locales les plus récentes et utilisent **Web Locks** lorsque le navigateur le permet pour sérialiser les modifications entre onglets. Sans Web Locks, une relecture avec contrôle de changement limite les collisions, sans garantir une transaction atomique contre deux écritures exactement simultanées. Les autres onglets ouverts actualisent leur affichage sur l’événement de stockage.

Si le stockage est bloqué ou plein, l’application indique que l’enregistrement a échoué. Les données existantes ne sont pas remplacées par un document vide. Un format local inconnu ou un JSON illisible bloque les écritures plutôt que de réinitialiser l’historique. Les séries ou réponses partiellement invalides sont signalées et exclues des statistiques lorsqu’elles ne peuvent pas être interprétées ; leur contenu brut reste conservé.

Le site reste statique, sans compte, backend ni dépendance supplémentaire. Les réponses attendues sont présentes dans le JSON chargé par le navigateur : ce mode est un outil d’entraînement, pas un dispositif d’examen surveillé.
