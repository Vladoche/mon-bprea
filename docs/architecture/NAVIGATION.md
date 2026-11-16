# Navigation et pages de rubrique

## Hiérarchie commune

Le header présente **Accueil**, **Mes cours**, **Outils** et une destination de compte : **Mon profil** pour une identité authentifiée ou reconnue hors ligne, **Connexion** en contexte visiteur. Pendant la résolution Auth, le compte affiche « Vérification… ». Une identité hors ligne reste à vérifier ; ce menu ne constitue pas une autorisation d’accès aux données.

Accueil est un lien simple, **sans sous-menu**. Mes cours et Outils ont chacun un lien vers leur hub et un bouton chevron distinct pour ouvrir leurs destinations. Mon profil suit le même principe quand le compte est reconnu. S’exercer reste une sous-rubrique de Mes cours.

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
  Reconnaissance des plantes — reconnaissance-plantes.html
Mon profil — profil.html (compte reconnu)
  Informations du compte — profil.html#informations-compte
  Paramètres — profil.html#parametres
  Déconnexion — bouton, via le service Auth
Connexion — connexion.html (visiteur, à la place de Mon profil)
```

Cette hiérarchie organise les accès. Elle n’oblige pas à repasser par le menu : les liens directs entre cours et exercices, les ressources associées et les liens du Tableau de bord restent disponibles. Le calendrier (`calendrier.html`) est accessible depuis le sous-menu Mes cours → S’exercer → Calendrier, la carte Calendrier du hub S’exercer et le lien Calendrier du footer.

## Fichiers responsables

| Fichier | Rôle |
| --- | --- |
| `assets/navigation.json` | Configuration centrale de la hiérarchie, des libellés et des destinations du menu. |
| `assets/navigation.js` | Chargement du menu commun et interactions au clavier, à la souris et sur écran tactile. |
| `assets/auth-header.js` | Destination de compte dynamique, menu Profil et déconnexion ; identité fournie par le service Auth. |
| `assets/navigation.css` | Présentation commune des menus, états actifs et adaptation aux écrans. |
| `assets/breadcrumbs.js` | Construction des fils d’Ariane selon la hiérarchie. |
| `assets/learning-pages.js`, `assets/learning-pages.css` | Présentation UC/lecture, chapitres ouverts et sommaire dérivé des titres réels ; styles propres aux deux pages. |
| `assets/section-hubs.js` | Rendu des pages Mes cours, S’exercer et Outils ; lecture de la synthèse hebdomadaire existante. |
| `assets/section-hubs.css` | Cartes, grilles et synthèse des pages de rubrique en modes clair et sombre. |
| `assets/app.js` | En-tête partagé et choix du rendu selon `data-page`. |

Les nouveaux points d’entrée sont `mes-cours.html` (`data-page="courses"`), `s-exercer.html` (`practice`) et `outils.html` (`tools`). Ils utilisent le même script d’application et `theme-init.js` que les pages existantes. Leurs feuilles de style sont chargées dans l’ordre `style.css`, `section-hubs.css`, puis `navigation.css`.

## Maintenir le menu

Modifie `assets/navigation.json` pour changer un libellé ou une destination commune. Le menu est généré depuis cette configuration ; il n’est pas recopié dans chaque page HTML. Conserve les identifiants et les destinations existantes. La destination de compte est ajoutée par `auth-header.js`, pas par une quatrième entrée JSON.

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

L’entrée `courses` contient `groups` : `course-units`, avec `source: "units"`, et `practice`, avec ses trois `children`. L’entrée `tools` possède ses trois `children`. Le lien `href` d’un groupe reste distinct du bouton qui le déplie.

`initNavigation(root, page)`, exporté par `assets/navigation.js`, charge cette configuration et utilise par défaut `document.body.dataset.page`. Si le JSON est inaccessible ou invalide, les liens Accueil, Mes cours et Outils restent proposés par la configuration de repli ; le compte est ensuite rendu par Auth. Le menu ne lit ni n’écrit la progression locale.

Dans Mes cours, le groupe Cours par UC donne accès aux unités. Le groupe S’exercer comporte son propre lien de rubrique et les trois destinations de révision. Le groupe Outils est une autre entrée principale, avec son lien vers `outils.html`, le générateur ITK et la bibliothèque documentaire. Ajouter une destination ne doit pas transformer S’exercer en entrée principale ou placer Outils dans Mes cours.

Les cours et UC restent définis dans `assets/content.js`, les ressources dans `assets/resources.json`. Changer la navigation ne demande pas de renommer ces objets, leurs pages ou leurs identifiants. Les nouveaux libellés pédagogiques sont indépendants des noms internes des modules et des clés de stockage.

Après une modification, vérifie les liens, les états actifs et les fils d’Ariane sur les pages concernées. Pour une nouvelle page, déclare son appartenance dans la configuration de navigation et complète le helper de fil d’Ariane si nécessaire. Les liens doivent rester relatifs, par exemple `drill.html`, sans `/` initial ni nom de dépôt codé en dur.

## Pages de rubrique

### UC et lecture des cours — PR3 lot 1

`uc.html?id=…` présente le vrai titre, les chapitres ouverts, les cours et les
ressources associés. Les états « À découvrir », « Terminé » et « Progression
indisponible » viennent de la vue vérifiée existante. Une unité vide affiche
« Contenus à venir », sans cours fictif ni ratio 0/0.

`cours.html?id=…` conserve le corps pédagogique et les essentiels. Le sommaire
est dérivé des H2/H3 rendus, préserve les identifiants présents et évite les
collisions des nouvelles ancres ; les liens natifs conservent fragment et
historique, avec focus sur le titre. Sur petit écran, sommaire, article et
ressources, essentiel puis fin de cours suivent le flux. Les tableaux défilent
dans leur région nommée. La complétion reste manuelle via le service existant ;
le QCM garde son URL ; sa présentation 2027 utilise `course-quiz-page.js` et sa feuille ciblée, avec les radios natifs et toutes les questions sur une page. La suite suit `order` dans la seule UC
concernée ; le dernier cours revient à son unité. Voir la
[validation et ses limites](../validations/VALIDATION-UI-2027-PR3-LOT1.md).

### Hubs

**Mes cours** présente les sept UC issues de `units`, avec le nombre réel de cours de `lessons` et un accès à `uc.html?id=…`. Une unité sans cours affiche « À venir ». La progression des cours disponibles est issue de la source vérifiée ; inconnue, elle reste indisponible. L’anecdote est placée après les UC et la page offre un accès à S’exercer sans y imbriquer les outils techniques.

**S’exercer** porte la description « Retrouve tes exercices, tes résultats et ton calendrier de révision. ». La carte principale ouvre les exercices hebdomadaires. Deux cartes secondaires ouvrent le Tableau de bord et le Calendrier. Le fonctionnement interne de ces trois activités reste celui des lots précédents.

**Outils** porte la description « Des ressources pour approfondir tes connaissances et préparer tes cultures. ». Ses cartes ouvrent le Générateur ITK, les Ressources documentaires et la Reconnaissance des plantes (`reconnaissance-plantes.html`, page `botanical`). Le jeu possède aussi son entrée dans le sous-menu Outils et le fil **Accueil → Outils → Reconnaissance des plantes**. La grille peut accueillir de futurs outils sans modifier la hiérarchie principale.

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
- Accueil → Outils → Reconnaissance des plantes.

Les ancêtres sont des liens ; la page courante est identifiée avec `aria-current="page"`. Les chapitres pointent vers une ancre de la page UC existante, construite par `chapterAnchor(chapter)`. Aucun fichier de chapitre supplémentaire ni nouvel identifiant de cours n’est créé pour le fil d’Ariane. Pour un QCM classique, le parcours ajoute « Exercices du cours » après le cours associé.

## Menus, clavier et responsive

Les liens de titre ouvrent les pages de rubrique ; seuls les boutons chevrons déplient les panneaux. Ils exposent `aria-expanded` et `aria-controls`. Les contrôles restent des liens et boutons natifs, sans rôle `menu`/`menubar` ni navigation spéciale par flèches. Le survol ne commande pas l’ouverture.

- Clic, toucher ou activation native du bouton par Entrée/Espace : ouverture, avec focus sur la première destination ; second clic : fermeture. Un seul panneau est ouvert.
- Tab et Maj+Tab parcourent les contrôles. Depuis le bouton ouvert, Tab entre dans son panneau ; depuis la première destination, Maj+Tab revient au bouton.
- Échap ferme le panneau et rend le focus au bouton. Clic extérieur, focus quittant la navigation ou activation d’un lien ferment les panneaux.
- Une déconnexion utilise `auth-service.js` ; une erreur est affichée. Elle n’efface ni progression ni opérations non synchronisées.

Les rubriques actives suivent `pages` dans le JSON ; la destination exacte porte `aria-current="page"`. Profil est actif pour `data-page="profile"`, Connexion pour `auth-login`. L’état ouvert (`is-open`) reste distinct de l’état actif. Les liens Informations du compte et Paramètres sont des ancres réelles, suivies après le rendu asynchrone du profil ; le panneau n’ajoute pas d’autre destination.

À partir de **601 px**, Mes cours et Outils sont centrés sous leur pilule ; Profil est aligné sur son bord droit. Les panneaux sont bornés par la largeur du conteneur de navigation et la hauteur disponible dans la fenêtre. Le placement est mesuré à l’ouverture et recalculé après redimensionnement ou changement de disposition/identité, regroupé dans une frame ; aucune surveillance continue des coordonnées.

Jusqu’à **600 px**, les panneaux sont dans le flux, avec défilement intérieur pour garder les destinations accessibles. Le changement de breakpoint ferme le panneau et rend le focus au contrôle si nécessaire. Les cartes se replient selon la largeur disponible. Fermés, les panneaux deviennent immédiatement `hidden`, `inert` et `aria-hidden` ; leurs liens ne sont pas focusables.

L’icône clair/sombre du header est indépendante des menus. Elle reste accessible en contexte visiteur ou personnel ; les réglages complets sont dans Profil → Paramètres, également accessible aux visiteurs par le footer. Les saisons, ambiances, mouvement réduit, contraste forcé et repli sans filtre sont décrits dans [THEMES.md](THEMES.md).

## Compatibilité et validation

Les URL existantes, paramètres de cours/UC et filtres documentaires sont conservés. Le libellé **Exercices hebdomadaires** désigne `drill.html` sans changer les séries, calculs, identifiants ou clés. Les cours/QCM gardent leurs sauvegardes automatiques et abonnements ; leurs commandes détaillées se trouvent dans `profil.html#parametres`, section `#donnees-synchronisation`. Les autres domaines conservent leurs contrôles sur leurs pages.

Le frontend reste statique ; le mode personnel utilise le backend configuré et les services de synchronisation existants. Le menu ne lit ni n’écrit la progression. Les cartes et la synthèse utilisent les sources visiteur/personnelles vérifiées par leurs services, avec les limites et confirmations distantes décrites dans les contrats.

Sources actuelles : `navigation.json`, `navigation.js`, `auth-header.js`, `navigation.css`, `auth-pages.js` et `section-hubs.js`. Les [preuves PR1](../validations/VALIDATION-UI-2027-PR1.md), [PR2](../validations/VALIDATION-UI-2027-PR2.md) et [PR2b/PR2c](../validations/VALIDATION-UI-2027-PR2B.md) décrivent les contrôles et leurs limites. Les [preuves du lot 4.5](../archives/validations/VALIDATION-LOT4-5.md) restent historiques. Pour publication et prochaine action, consulter l’[état du projet](../developpement/ETAT-DU-PROJET.md).
