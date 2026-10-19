# Validation manuelle — Navigation et ergonomie

Réalisée le **19 octobre 2026** sur `feature/navigation-4-5`, créée depuis `origin/main` au commit `74e6731` après actualisation des références distantes. L’intégration du lot 4 (`68c5d0c`, PR nº 3) a été vérifiée avant modification. Le dépôt était propre.

Vérification exploratoire dans Chromium avec serveur HTTP local sous **`/mon-bprea/`**, interactions souris/clavier, dimensions mobiles simulées et inspection de captures. Les réponses d’exercice, simulations de catalogue de navigation et d’examen sont limitées à un **contexte navigateur isolé**, créé sans stockage initial ni cookies, avec le fuseau `Pacific/Honolulu`. Aucun jeu fictif n’est livré ni ajouté à la progression réelle. Aucune suite ni fichier de tests automatisés ajouté.

## Résultats

| Parcours | Observation |
| --- | --- |
| Trois entrées principales | Accueil, Mes cours et Outils sont les trois seuls éléments de la liste principale. Vérifié sur les douze pages du site, anciennes et nouvelles. Le lien d’évitement et le réglage de thème restent hors de cette liste. |
| Hiérarchie Mes cours | Menu organisé en deux groupes : Cours par UC, avec les sept UC réelles, et S’exercer, avec son lien de rubrique et ses trois destinations. Aucun lien Outils imbriqué dans Mes cours. |
| Outils indépendant | Entrée principale avec lien vers `outils.html` et bouton distinct ; sous-menu limité au Générateur ITK et aux Ressources documentaires. |
| Ouverture sur ordinateur | Clic ou Entrée sur les boutons ouvre le panneau correspondant. Deux groupes côte à côte pour Mes cours, sans cascade de menus. Ouvrir Outils ferme le panneau Mes cours. |
| Fermeture et focus | Échap ferme et replace le focus sur le bouton d’origine. Clic extérieur et sortie du focus ferment les panneaux. Maj+Tab depuis le premier lien revient à son bouton ; Tab sur le bouton encore ouvert renvoie au premier lien. |
| Liens distincts des boutons | Les titres Mes cours et Outils ouvrent leurs pages de rubrique ; les chevrons déplient seulement les menus. Le titre S’exercer ouvre sa page dédiée. Les liens de sous-menu restent fonctionnels après fermeture du panneau. |
| Mobile | Mes cours et Outils se déplient indépendamment ; les deux peuvent rester ouverts sans superposition. Fermer Mes cours laisse Outils accessible. Accès à S’exercer puis ITK depuis les panneaux à 320 px. Aucun défilement horizontal de la navigation principale ; les panneaux longs défilent verticalement. |
| États actifs | Accueil actif sur `index.html`. Mes cours actif sur les UC, cours, QCM, exercices hebdomadaires, Dashboard et calendrier. Outils actif sur ses deux destinations. `aria-current="page"` identifie seulement une destination courante réelle, sans attribuer ce statut à son parent. |
| Page Mes cours | Sept cartes d’UC, quatre cours réellement disponibles pour UC 03, puis accès à S’exercer. Les autres UC indiquent leur absence de cours. Outils n’est pas présenté comme une sous-rubrique de cette page. |
| Page S’exercer vide | Description demandée, trois cartes d’activité, synthèse à 0 réalisé, 0 bonne réponse et « Aucune donnée » pour la réussite ; état vide explicite. |
| Première réponse | Première réponse correcte enregistrée par l’interface des exercices : synthèse à 1 réalisé, 1 bonne réponse et 100 %. |
| Ancienne série reprise | Une réponse incorrecte donnée cette semaine dans la série précédente : synthèse à 2 réalisés, 1 bonne réponse et 50 %. Un entraînement correct et un brouillon ajoutés dans cette série ne changent pas ces valeurs. |
| Concordance Dashboard | Dashboard filtré UC 03 / quatre semaines : 2 réalisés, 1 correcte, 1 erreur, 50 %, 1 semaine active, cohérent avec la synthèse et les premières réponses enregistrées. |
| Rechargement / stockage | Rechargement : mêmes valeurs. La consultation des hubs et l’ouverture/fermeture des menus ne modifient aucune chaîne des clés locales. La synthèse relit les règles existantes sans enregistrer ni migrer de progression. |
| Actualisation entre onglets | Réponse correcte à une autre question dans un second onglet : S’exercer passe automatiquement à 3 réalisés, 2 bonnes réponses et 67 % affichés, sans rechargement. |
| Stockage illisible | Simulation JSON malformé : synthèse indisponible, aucune métrique interprétable comme zéro ; texte brut conservé et bouton de nouvelle lecture. Les cartes d’activité restent accessibles. |
| Page Outils | Description demandée et deux cartes vers ITK / bibliothèque ; grille extensible sans modifier les trois rubriques principales. |
| Fils d’Ariane | Parcours cohérents sur les douze pages : UC/cours sous Mes cours, révisions sous Mes cours → S’exercer, ITK et ressources sous Outils. La page courante porte `aria-current="page"`. |
| Chapitre et leçons | UC 03 présente le chapitre « Le sol vivant » et ses quatre leçons. Le lien de chapitre depuis le cours pointe vers `uc.html?id=uc3#chapitre-le-sol-vivant`, dont la cible existe. Les liens des leçons et leurs identifiants sont inchangés. |
| URL historiques | Ouverture directe réussie de `cours.html?id=rapport-cn`, `exercices.html?id=rapport-cn`, `drill.html?unit=uc3&week=2026-W42`, `tableau-de-bord.html?unit=uc3&period=4`, `calendrier.html?month=2027-06` et `ressources.html?unit=uc3&type=pdf&lesson=matiere-organique`. Paramètres préservés et rubriques actives correctes. |
| JSON de navigation inaccessible | Simulation 404 : les trois liens principaux restent présents, sans boutons inutilisables ; les hubs et leurs cartes restent accessibles. |
| JSON de navigation invalide | Simulation de configuration incomplète : même repli sur trois liens directs, sans erreur de rendu. |
| Lien d’évitement | Premier Tab : lien « Aller au contenu » visible. Entrée place le focus sur `#app-main`. Le lien reste hors écran lorsqu’il n’a pas le focus. |
| Responsive / clair et sombre | S’exercer et menus inspectés en clair et sombre ; Mes cours et Outils inspectés en sombre sur ordinateur ; fil d’Ariane long inspecté à 320 px. Aucun débordement horizontal global à 320, 350, 390, 525, 760, 761, 900, 1080, 1121 et 1440 px. Préférence de thème conservée entre pages. |
| Cours et QCM | Ressource associée et lien direct vers les exercices conservés. Cours coché terminé puis rechargé : état conservé. QCM de matière organique corrigé à 3/3 ; la synthèse hebdomadaire reste à 2 / 1 / 50 % avant la réponse supplémentaire du second onglet, sans mélange des résultats. |
| Bibliothèque et PDF | Ancien filtre documentaire renvoie la fiche attendue. Téléchargement de `fiche-demo-matiere-organique.pdf` sans erreur. Le lecteur, les métadonnées et les fichiers PDF ne sont pas modifiés. |
| Bandeau et calendrier | Examen fictif intercepté uniquement pour vérification : lien vers `calendrier.html?month=2026-10`, calendrier octobre affiché avec le nouveau fil d’Ariane, lien vers `drill.html?unit=uc3` conservé. Libellé « Exercices hebdomadaires » dans le suivi séparé. |
| ITK | Génération de sept opérations et commandes CSV/impression présentes ; moteur et paramètres inchangés. |

La syntaxe des neuf modules JavaScript créés ou modifiés a été vérifiée avec `node --check`. Le JSON de navigation est valide et possède exactement trois entrées principales. `git diff --check` passe. Aucun événement `pageerror` observé dans les parcours ordinaires ; les erreurs réseau provoquées pour les simulations étaient attendues.

## Fichiers et portée

- **Navigation** : ajouts de `assets/navigation.json`, `assets/navigation.js`, `assets/navigation.css` et `assets/breadcrumbs.js` ; intégration dans `assets/app.js` et chargement des styles sur les neuf pages HTML précédentes.
- **Pages de rubrique** : `mes-cours.html`, `s-exercer.html`, `outils.html`, `assets/section-hubs.js` et `assets/section-hubs.css`.
- **Présentation des pages existantes** : adaptations des fils d’Ariane dans `assets/drill.js`, `assets/dashboard.js`, `assets/calendar.js`, `assets/resource-library.js` ; nouveaux libellés dans `assets/exam-preparation.js` et `drill.html` ; styles de chapitre dans `assets/style.css`.
- **Documentation** : README, `NAVIGATION.md` et ce compte rendu.

Les banques, identifiants de cours/UC/ressources, lecteurs de stockage, moteurs statistiques, données de calendrier, fichiers PDF et workflow de déploiement restent inchangés. Les modifications de modules existants se limitent au branchement des pages, à la présentation et aux accès.

La synthèse conserve les limites statistiques du Dashboard : premières réponses uniquement, activité datée en Europe/Paris, données futures/illisibles exclues avec avertissement, stockage propre à ce navigateur. Le JSON et les modules nécessitent HTTP en local ; le repli du menu conserve les pages de rubrique si sa configuration est indisponible. Vérification dans Chromium et dimensions mobiles simulées, sans appareil physique ni audit complet de lecteur d’écran. Les dialogues système d’export/impression ITK n’ont pas été ouverts. Aucun thème horaire ou saisonnier, backend, dépendance ou mécanisme de gamification ajouté.

Livraison par PR de `feature/navigation-4-5` vers `main`, sans fusion ni déploiement en production sans accord de l’utilisateur.
