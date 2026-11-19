# Validation de la bibliothèque documentaire 2027

PR4 lot 3 · 19 novembre 2026 · Base `1f86041bdb8eea7523f137845f27a22846de7bf3`, fusion de la [PR ITK #72](https://github.com/Vladoche/mon-bprea/pull/72).

## Audit et périmètre

La page `ressources.html` et les sections « Pour approfondir » et « Ressources de cette UC » sont les trois points d’entrée du rendu documentaire. `app.js` appelle respectivement `initResources()`, `initCourseResources()` et `initUnitResources()`. Les deux dernières reçoivent les éléments de page construits par `learning-pages.js`. Le rendu s’appuie sur un catalogue v1 de huit fiches (cinq sites et trois PDF locaux), un chapitre et les identifiants d’UC et de cours de `content.js`.

La référence combinait recherche sur cinq champs, six filtres, trois tris et lecture de huit paramètres d’URL. Les clics sur une thématique, une UC ou un cours utilisaient des liens relatifs. Les filtres et le tri ajoutaient une entrée d’historique, tandis que la frappe remplaçait les critères de l’entrée courante. Les fiches intégraient une notice bibliographique dépliable et les aperçus reprenaient les relations explicites, avec trois cartes au plus pour une UC. Les PDF locaux étaient vérifiés et la bibliothèque proposait des états d’attente, d’erreur et de reprise.

L’audit visuel a relevé des textes secondaires de 10 à 12 px, une icône de globe dans la recherche, des commandes de PDF peu saillantes et des filtres actifs difficiles à repérer lorsque leur panneau était replié. Le premier contrôle a aussi mis en évidence deux problèmes de rendu. La classe commune écrasait le positionnement de la réinitialisation et la place réservée aux liens PDF empilés pouvait déplacer le contenu sur mobile. Le sélecteur de positionnement a été précisé et l’espace des deux lignes réservé sur petit écran.

| Fichiers | Changement |
| --- | --- |
| `assets/resource-library.js`, `assets/resource-library.css` | Introduction compacte, recherche avec aide associée, filtres avancés comptés, résultats regroupés, fiches et actions plus lisibles, notices sémantiques et aperçus compacts. |
| `assets/style.css` | La primitive `.btn-surface` étend les mêmes états interactifs aux liens natifs. Les états de désactivation des boutons sont conservés. |
| `tests/unit/resources.test.js`, `tests/e2e/ui-2027-resources.spec.js`, `tests/fixtures/resource-library.js` | Contrats du lecteur, navigation, états PDF, interactions et accessibilité en contexte isolé. |
| `scripts/measure-ui-foundations.mjs`, `scripts/ui-resources-lab.mjs`, `.github/workflows/quality.yml` | Mesures et captures reproductibles, artefact de revue dans le workflow Qualité. |

Le diff du moteur `assets/resources.js`, du catalogue `assets/resources.json` et de `documents/` est vide. Les titres, destinations, relations, cinq catégories, dates et sources viennent du même catalogue. Recherche française sans casse ni accents, ligatures, correspondance de tous les mots sur les métadonnées, filtres en ET, tri sur `addedAt` et borne de 300 caractères à la lecture de `q` sont couverts. Une date de publication reste une donnée bibliographique. Les liens HTTP(S) et les chemins de PDF gardent les validations du lecteur. Les destinations externes restent en nouvel onglet sécurisé et aucun contrôle réseau automatique de leur disponibilité n’est lancé.

## PDF et liens pédagogiques

- Le résultat du contrôle est mutualisé par destination. Il actualise uniquement la fiche encore présente dans le DOM. Le rechargement d’une grille ne réémet pas de requête pour un PDF déjà vérifié. Une reprise au clavier restitue le focus dans la même fiche tant que l’utilisateur y travaille.
- La recette couvre HEAD 200 PDF, 404/410, HTML, HEAD 405/501, MIME ambigu, GET 200/206, signature absente, réseau indisponible, délai de 10 secondes, succès après reprise et résultat tardif après filtrage. Le test de flux vérifie la signature répartie sur deux blocs, l’annulation de la lecture et l’absence de correspondance au-delà de 1 024 octets. La référence comptait la taille du texte décodé dans sa boucle. Le calcul utilise désormais les octets inspectés.
- Un PDF disponible propose consultation et téléchargement. Un fichier absent garde sa fiche et une reprise sans lien actif vers ce fichier. Un PDF non vérifiable conserve les actions prévues et les accompagne d’un message d’incertitude. Le MIME et la signature donnent un contrôle de disponibilité et de type, avec une portée limitée aux réponses échantillonnées.
- Le PDF de démonstration est consulté en nouvel onglet et téléchargé depuis la bibliothèque sous `/mon-bprea/`. Le même chemin est rendu dans le cours « Le cycle de la matière organique ». L’UC 03 affiche trois cartes sur sept et son aperçu contient le PDF de l’annuaire. Les liens thème, UC, cours, retour filtré et les états vides de `rapport-cn` et `ucare1` sont recettés. La fixture de chapitre ne crée aucun lien de cours implicite.
- Les actions dans la bibliothèque visitée ne déclenchent ni écriture de stockage observée ni requête hors de l’origine locale. Les fichiers privés et les fixtures sont absents de l’artefact Pages testé. La configuration Auth versionnée reste désactivée.

## Recette visuelle et accessibilité

Les comparaisons sont disponibles dans la galerie `.tmp/ui-2027-pr4-lot3/review/index.html` et dans l’artefact de laboratoire du workflow Qualité. `boutons.html` réunit les commandes réellement rendues du header, de l’ITK et de la bibliothèque. `controles.json` conserve les styles calculés et les mesures de débordement.

Une même surface terracotta signale l’entrée active, la génération ITK et l’ouverture principale d’une fiche. Les commandes de réinitialisation, de téléchargement et de reprise partagent le dégradé neutre, le reflet, la bordure et l’ombre du header. La planche compare aussi le survol et le focus clavier en clair et sombre. Les filtres restent natifs ainsi que les liens de consultation et de téléchargement. Les notices dépliables gardent `details` et `summary`. Le compteur annonce ses changements et les cartes ne font pas partie de sa région dynamique.

La revue des 28 comparaisons avant/après couvre les cinq largeurs de 320 à 1 440 px, les états de recherche et de chargement, les types réellement présents dans le catalogue et une fiche technique synthétique. À 390 px, les actions PDF s’empilent sans se chevaucher et les métadonnées dépliées restent lisibles. Le zoom natif Chromium à 200 % transforme une fenêtre de 780 px en zone utile de 390 pixels CSS, sans débordement horizontal détecté. Les états de la planche ont été inspectés en clair et sombre. La comparaison des styles calculés confirme les dégradés, bordures, reflets et ombres au repos, le reflet au survol et le contour de focus des variantes correspondantes.

Les contrôles Chromium vérifient un contraste texte/fond d’au moins 4,5:1 sur les commandes et textes échantillonnés dans les huit combinaisons de saisons et de modes. Le scénario clavier couvre le repli des filtres, la lecture des métadonnées, les liens et le focus après réinitialisation ou reprise. Le mode de contraste forcé garde les liens repérables et un contour de focus. La préférence de mouvement réduit supprime les transitions des commandes.

## Contrôles et performance

- Installation par `npm ci` avec Node.js 24.22.0. `npm test` donne 680 réussites et un test ignoré (lien symbolique natif). Les 30 contrôles documentaires unitaires font partie de ce total.
- La reconstruction du SDK navigateur est identique au fichier versionné. Les différences ont été vérifiées sur le catalogue, le moteur, les PDF et les liens documentaires concernés.

- La suite complète `npm run test:e2e -- --workers=4` donne **235 réussites**, dont les 19 parcours de la bibliothèque. La notice publique correspond à son rendu versionné.
- Cinq passages alternés par version, Chromium 156, 1 440 × 1 000, contexte froid, CPU ×4, 20 ms de latence, débit de 1,25 Mo/s. Les temps d’action vont de l’événement à la deuxième image. Les déplacements après interaction incluent ceux provoqués par la modification de la grille. Les données brutes sont dans `performance.json` et `performance-600.json`, à côté de `review/`.

| Médiane, avant → après | Catalogue réel, 8 fiches | Catalogue synthétique, 600 fiches |
| --- | ---: | ---: |
| CSS chargé | 64 834 → 66 070 octets | 64 834 → 66 070 octets |
| JS chargé | 807 940 → 808 469 octets | 807 940 → 808 469 octets |
| Requêtes | 82 → 82 | 80 → 80 |
| LCP de laboratoire | 1 316 → 1 344 ms | 2 832 → 3 136 ms |
| CLS initial | 0 → 0 | 0 → 0 |
| Première fiche dans le DOM | 1 420 → 1 451 ms | 1 917 → 1 896 ms |
| Première action PDF affichée | 1 719 → 1 705 ms | 4 005 → 3 680 ms |
| Filtrage | 26 → 25 ms | 902 → 649 ms |
| Tri | 29 → 22 ms | 743 → 528 ms |
| Réinitialisation | 45 → 62 ms | 2 060 → 1 425 ms |
| Déplacements après interaction | 0,021 → 0,015 | 0,021 → 0,015 |
| Défilement net après réinitialisation | 0 → 0 px | 0 → 0 px |

La feuille apporte 1 236 octets et le script 529 octets au chargement. Sur le catalogue réel, la réinitialisation reconstruit des fiches plus structurées et rétablit le champ de recherche en 62 ms. Aucun budget de diagnostic n’est signalé sur ces huit fiches. À 600 fiches, les temps de filtrage, tri et réinitialisation baissent. Le LCP augmente de 304 ms et les interactions communes de thème et de menu passent de 452 à 516 ms, au-dessus du budget de 200 ms déjà dépassé par la référence. Le rendu de toutes les cartes en une fois demeure la limite de ce scénario sous ralentissement CPU. Ces valeurs de stress décrivent le catalogue fictif et le laboratoire. Elles ne mesurent pas l’INP réel.

## Limites et verdict

La recette porte sur Chromium en local et l’artefact de test sous `/mon-bprea/`. Les contrôles clavier et de structure accessible ont été effectués avec le navigateur. Une session avec un lecteur d’écran natif reste hors de cette recette. Les liens externes sont vérifiés par leurs attributs et leur destination dans le DOM. La joignabilité des sites tiers et la recette hébergée restent indépendantes.

**GO — PR4 lot 3 validé en recette locale et prêt pour revue.** Les mesures à 600 fiches restent un point de suivi P2. La livraison couvre la branche et sa PR, sans opération Supabase PROD, fusion ni déploiement GitHub Pages.
