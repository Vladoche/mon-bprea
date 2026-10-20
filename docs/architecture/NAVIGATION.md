# Navigation et pages de rubrique — Lot 4.5

## Hiérarchie commune

Le site conserve exactement **trois entrées principales** : Accueil, Mes cours et Outils. S’exercer est une sous-rubrique de Mes cours. Outils reste indépendant des cours et des activités de révision.

```text
Accueil — index.html
Mes cours — mes-cours.html
  Cours par UC — uc.html?id=…
    Chapitres
    Leçons — cours.html?id=…
  S’exercer — s-exercer.html
    Exercices hebdomadaires — drill.html
    Tableau de bord — tableau-de-bord.html
    Calendrier — calendrier.html
Outils — outils.html
  Générateur ITK — itk.html
  Ressources documentaires — ressources.html
```

Cette hiérarchie organise les accès. Elle n’oblige pas à repasser par le menu : les liens directs entre cours et exercices, les ressources associées, les liens du Tableau de bord et le calendrier depuis le bandeau d’examens restent disponibles.

## Fichiers responsables

| Fichier | Rôle |
| --- | --- |
| `assets/navigation.json` | Configuration centrale de la hiérarchie, des libellés et des destinations du menu. |
| `assets/navigation.js` | Chargement du menu commun et interactions au clavier, à la souris et sur écran tactile. |
| `assets/navigation.css` | Présentation commune des menus, états actifs et adaptation aux écrans. |
| `assets/breadcrumbs.js` | Construction des fils d’Ariane selon la hiérarchie. |
| `assets/section-hubs.js` | Rendu des pages Mes cours, S’exercer et Outils ; lecture de la synthèse hebdomadaire existante. |
| `assets/section-hubs.css` | Cartes, grilles et synthèse des pages de rubrique en modes clair et sombre. |
| `assets/app.js` | En-tête partagé et choix du rendu selon `data-page`. |

Les nouveaux points d’entrée sont `mes-cours.html` (`data-page="courses"`), `s-exercer.html` (`practice`) et `outils.html` (`tools`). Ils utilisent le même script d’application et `theme-init.js` que les pages existantes. Leurs feuilles de style sont chargées dans l’ordre `style.css`, `section-hubs.css`, puis `navigation.css`.

## Maintenir le menu

Modifie `assets/navigation.json` pour changer un libellé ou une destination commune. Le menu est généré depuis cette configuration ; il n’est pas recopié dans chaque page HTML. Conserve les trois rubriques de premier niveau et les identifiants utilisés pour déterminer la section active.

Le document porte `version: 1` et une liste `items` contenant les trois entrées `home`, `courses` et `tools`. Chaque entrée utilise les propriétés suivantes :

| Propriété | Utilisation |
| --- | --- |
| `id` | Identifiant stable de la rubrique ou destination. |
| `label` | Libellé visible. |
| `href` | Lien relatif vers la page de rubrique ou la destination. |
| `pages` | Liste des valeurs `data-page` appartenant à cette rubrique ou destination, pour les états actifs. |
| `groups` | Groupes du menu Mes cours : Cours par UC et S’exercer. |
| `children` | Destinations du groupe S’exercer ou du menu Outils. |
| `source: "units"` | Groupe Cours par UC rempli depuis `assets/content.js`, sans recopier les intitulés des sept unités dans le JSON. |

L’entrée `courses` contient `groups` : `course-units`, avec `source: "units"`, et `practice`, avec ses trois `children`. L’entrée `tools` possède ses deux `children`. Le lien `href` d’un groupe reste distinct du bouton qui le déplie.

`initNavigation(root, page)`, exporté par `assets/navigation.js`, charge cette configuration et utilise par défaut `document.body.dataset.page`. Si le JSON est inaccessible ou invalide, les trois liens principaux restent proposés pour accéder aux pages de rubrique. Le menu ne lit ni n’écrit la progression locale.

Dans Mes cours, le groupe Cours par UC donne accès aux unités. Le groupe S’exercer comporte son propre lien de rubrique et les trois destinations de révision. Le groupe Outils est une autre entrée principale, avec son lien vers `outils.html`, le générateur ITK et la bibliothèque documentaire. Ajouter une destination ne doit pas transformer S’exercer en entrée principale ou placer Outils dans Mes cours.

Les cours et UC restent définis dans `assets/content.js`, les ressources dans `assets/resources.json`. Changer la navigation ne demande pas de renommer ces objets, leurs pages ou leurs identifiants. Les nouveaux libellés pédagogiques sont indépendants des noms internes des modules et des clés de stockage.

Après une modification, vérifie les liens, les états actifs et les fils d’Ariane sur les pages concernées. Pour une nouvelle page, déclare son appartenance dans la configuration de navigation et complète le helper de fil d’Ariane si nécessaire. Les liens doivent rester relatifs, par exemple `drill.html`, sans `/` initial ni nom de dépôt codé en dur.

## Pages de rubrique

**Mes cours** présente les sept UC issues de `units`, avec le nombre réel de cours de `lessons` et un accès à `uc.html?id=…`. Une unité sans cours affiche « Cours à venir ». La page offre un accès à S’exercer sans y imbriquer les outils techniques.

**S’exercer** porte la description « Retrouve tes exercices, tes résultats et ton calendrier de révision. ». La carte principale ouvre les exercices hebdomadaires. Deux cartes secondaires ouvrent le Tableau de bord et le Calendrier. Le fonctionnement interne de ces trois activités reste celui des lots précédents.

**Outils** porte la description « Des ressources pour approfondir tes connaissances et préparer tes cultures. ». Ses cartes ouvrent le Générateur ITK et les Ressources documentaires. La grille peut accueillir de futurs outils sans modifier la hiérarchie principale.

### Synthèse hebdomadaire de S’exercer

La synthèse lit `readDashboardData()` puis utilise `createDashboardModel()` du Tableau de bord avec une fenêtre valide de quatre semaines. Elle affiche seulement l’élément de `model.weeks` correspondant à `getParisWeek(now).id`. Il n’existe pas de nouvelle formule ou d’autre règle de comptabilisation.

La semaine ISO suit **Europe/Paris**, indépendamment du fuseau de l’appareil. La date de première validation `answeredAt` détermine la semaine d’activité ; une ancienne série effectuée cette semaine contribue donc à la synthèse actuelle. Les brouillons, les entraînements supplémentaires et les QCM classiques restent séparés. Les réponses futures et données illisibles suivent les exclusions du Tableau de bord.

Les trois valeurs affichées sont les exercices réalisés, les bonnes réponses et le taux de réussite sur les exercices réalisés. Sans réponse, les volumes sont zéro et le taux « Aucune donnée », avec une explication. Une erreur de lecture masque les métriques et affiche un état indisponible avec une possibilité de réessayer. Les avertissements existants sont présentés comme un **bilan partiel** ; aucune donnée utilisateur n’est effacée.

La synthèse se rafraîchit à l’ouverture de la page, lors d’un changement du stockage Drill dans un autre onglet, au retour sur la page et chaque minute lorsque l’onglet est visible. Elle ne charge pas la banque de questions, ne crée pas de série et n’écrit pas dans le stockage.

## Fils d’Ariane et chapitres

`renderBreadcrumbs(page, { unit, lesson })`, exporté par `assets/breadcrumbs.js`, renvoie un fil d’Ariane en HTML. Le helper est partagé entre les pages afin de conserver la même organisation, y compris dans les états de chargement, d’erreur ou sans données.

Exemples :

- Accueil → Mes cours → UC → Chapitre → Cours.
- Accueil → Mes cours → S’exercer.
- Accueil → Mes cours → S’exercer → Exercices hebdomadaires.
- Accueil → Mes cours → S’exercer → Tableau de bord.
- Accueil → Mes cours → S’exercer → Calendrier.
- Accueil → Outils → Générateur ITK.
- Accueil → Outils → Ressources documentaires.

Les ancêtres sont des liens ; la page courante est identifiée avec `aria-current="page"`. Les chapitres pointent vers une ancre de la page UC existante, construite par `chapterAnchor(chapter)`. Aucun fichier de chapitre supplémentaire ni nouvel identifiant de cours n’est créé pour le fil d’Ariane. Pour un QCM classique, le parcours ajoute « Exercices du cours » après le cours associé.

## Utilisation et accessibilité

Les liens de titre ouvrent les pages de rubrique ; les boutons distincts servent à déplier les menus et exposent leur état avec `aria-expanded`. Les états actifs montrent la rubrique d’appartenance et la destination courante. Le menu est utilisable au clavier, avec focus visible et fermeture par Échap. Les sous-menus sont organisés en groupes pour éviter un déroulement imbriqué complexe sur ordinateur.

Sur mobile, les trois rubriques principales restent Accueil, Mes cours et Outils. Les destinations se déplient dans le menu, avec accès direct aux pages de rubrique et sans barre de navigation horizontale à parcourir. Les cartes des hubs et la synthèse s’adaptent à la largeur disponible. Le choix clair/sombre existant est conservé. Les thèmes horaires et saisonniers ne sont pas développés dans ce lot.

## Compatibilité et limites

Toutes les URL précédentes restent utilisables, dont `drill.html`, `tableau-de-bord.html`, `calendrier.html`, `uc.html?id=…`, `cours.html?id=…` et les paramètres de filtres documentaires. Le Mode Drill porte désormais le libellé visible **Exercices hebdomadaires** ; ses modules, questions, identifiants, statistiques et historique ne changent pas. Les clés locales des cours, QCM, Drill, ITK et du thème ne sont pas migrées.

Le site reste statique, sans backend ni dépendance supplémentaire. Le chargement des modules et du JSON nécessite un serveur HTTP en local. La synthèse décrit seulement les réponses enregistrées dans ce navigateur ; aucune synchronisation entre appareils n’est ajoutée. Il n’existe ni gamification ni récompense.

Les parcours réellement vérifiés et les limites du lot 4.5 sont consignés dans [VALIDATION-LOT4-5.md](../validations/VALIDATION-LOT4-5.md). Ce lot n’ajoutait pas de suite automatisée ; le lot 5.1 introduit les contrôles décrits dans [../TESTS.md](../TESTS.md). Les observations historiques correspondent à la branche `feature/navigation-4-5`. Fusion et déploiement en production nécessitent l’accord de l’utilisateur.
