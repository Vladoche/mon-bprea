# Validation de l’harmonisation Mon BPREA 2027 — PR5 lot 2

Campagne du 19 novembre 2026. Référence `origin/main` **`2dbe4336690a50684bc52e54b65081961e1b9482`**, fusion du profil #77. Code candidat **`07ae67166f7fda659d212737bb9b868ab3102483`** sur `codex/ui-2027-harmonisation`. Les comparaisons sur le poste utilisent Chromium 156, Windows, des contextes neufs et des données publiques ou fictives. [Profil #77](https://github.com/Vladoche/mon-bprea/pull/77) · [PR d’harmonisation #78](https://github.com/Vladoche/mon-bprea/pull/78).

## Pages et contrôles d’audit

Les 19 pages à la racine correspondent aux entrées de l’artefact Pages. Les gabarits de courriel Supabase, hors artefact, et l’application Windows suivent leurs propres validations. Pour chaque page, le relevé couvre header, état actif, footer, fil d’Ariane quand applicable, H1/H2/H3, introduction, cartes, contrôles et états visibles. Les vues de scénarios complètent le relevé d’entrée pour les dialogues, données, chargements et erreurs.

| Pages | Parcours et éléments examinés | Repères de revue |
| --- | --- | --- |
| `index`, `mes-cours`, `s-exercer`, `outils` | Accès directs, reprises, cartes de rubrique, menu ouvert et aperçu hebdomadaire | Accueil et rubriques, `menu-ouvert` et planche |
| `uc?id=uc3`, `cours?id=matiere-organique`, `exercices?id=matiere-organique` | Hiérarchie UC/chapitre/leçon, sommaire, tableau de cours et correction ; retour depuis une UC vide | Cours et QCM, contrôle UC 01 sur la planche |
| `drill`, `tableau-de-bord` | Semaine, réponses et historique, filtres, état vide et graphique avec données | Drill, `dashboard-history`, suites navigateur et laboratoire |
| `calendrier`, `itk` | Champ mois, grille, agenda et détail ; formulaire, synthèse, chronologie et exports | Scénarios `calendar-*` et `itk-results` |
| `ressources`, `reconnaissance-plantes` | Recherche, filtres, cartes, résultats, états d’indisponibilité ; catégories, modes, photos, correction et historique | Scénarios de bibliothèque et `botanical-*` |
| `connexion`, `mot-de-passe-oublie`, `authentification`, `profil` | Formulaires, aide et erreur, informations du compte, pseudo, apparence, synchronisation et états d’accès | `login-form`, `profile-*`, captures d’entrée et tests de compte |
| `contact`, `confidentialite` | Navigation autonome, liens, typographie, repli, pied de page, focus et accès sans JavaScript | Captures d’entrée, contrôles d’artefact et rendus sans JavaScript |

Les galeries historiques du calendrier, de l’ITK, des ressources, de la botanique et du profil étaient accessibles localement. La revue a comparé les surfaces du calendrier et de l’ITK, le contraste forcé des ressources, la sélection botanique et le profil connecté. Les références aux anciennes campagnes restent dans leurs rapports respectifs.

## Design system, inventaire et corrections

`assets/style.css` porte les palettes, arrondis, surfaces, ombres et le focus. `assets/navigation.css` applique le même ensemble de tokens `--control-pill-*` au header. L’ITK, les ressources, la botanique et le profil utilisaient déjà `.btn.btn-surface`. Les corrections réutilisent cette famille et ses variantes sémantiques.

| Page ou composant | Écart observé et type | Gravité | Référence | Correction proposée | Correction effectuée | Preuve | Test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Calendrier, barre de mois | Commandes anciennes, contour et remplissage différents des outils | P2 | Pilule neutre, `--control-height` | Utiliser la surface commune et conserver des flèches compactes | Précédent, Aujourd’hui et Suivant migrés. Flèches de 44 × 44 px | `calendrier-390`, planche calendrier | Surface calculée comparée au header, focus, bornes et tailles vérifiés |
| Calendrier, champ mois | Fond et métriques différents des champs ITK | P2 | `--color-surface-soft`, `--radius-sm`, `--color-control-border` | Aligner fond, contour et alignement | Mois natif avec hauteur de 44 px et texte de 16 px | `calendrier-768` | Saisie, mois longs, bornes et repli exercés |
| Calendrier, texte agrandi | Régression de la première version candidate sur Chromium Linux. À 390 px et texte à 200 %, la page s’étendait à 422 px | P1 corrigé | Reflow et contrôle natif | Borner les groupes à la place disponible | Les groupes de commandes peuvent se replier et le mois garde son champ natif | Test tactile dédié, `calendrier-390` | L’assertion de largeur est conservée et le champ doit tenir dans la barre. Les 10 scénarios calendrier passent sur Windows |
| Calendrier, agenda et erreur | Retour au mois, réessai et fermeture utilisent des variantes locales | P2 | Surface neutre et messages sémantiques | Migrer ces commandes secondaires | Les trois commandes adoptent la même surface. La fermeture garde son rôle natif | `calendar-agenda`, `calendar-error`, `calendar-forced` | Réessai, Échap et retour du focus, date et ordre de l’agenda comparés |
| Accueil et Mes cours | Dégradé d’accent et style secondaire propres à l’accueil | P2 | Surface accent et neutre du header | Réemployer les deux variantes | Parcours principaux en accent, reprise secondaire et réessai en neutre, styles redondants retirés | `index-390`, `mes-cours-390`, planche | Stabilité du survol et navigation |
| UC, cours, QCM et Drill | Actions équivalentes peintes en vert, terracotta uni ou contour historique | P2 | Surface commune, accent terracotta | Aligner les commandes et conserver les champs de réponse natifs | QCM et départ de série en accent, retours, entraînement et réessais en neutre | Planche UC, cours, QCM et Drill | Corrections, progression et historique, clavier et états désactivés |
| Tableau de bord | Fond local sur les commandes et état d’actualisation atténué par opacité | P2 | Surface neutre et état indisponible partagé | Harmoniser sans perdre le focus d’une actualisation | Navigation, pagination et réessai migrés. Indisponibilité annoncée par `aria-disabled`, sans réactivation pendant l’attente | `dashboard-history`, planche | Filtres, synchronisation, graphique au clavier et actualisation exercés |
| Connexion et callback | Accent autonome, labels et aides plus petits que les formulaires proches | P2 | Surface accent, tailles sémantiques, focus commun | Aligner les boutons et la lisibilité des champs | Panneaux et champs avec tokens communs. Lien vers la notice souligné | `login-form`, `connexion-dark`, `authentification-dark` | Formulaires, notices, lien invalide, activation et récupération en stack de test |
| Contact et confidentialité | Navigation sans JavaScript, avec pilules d’apparence différente | P2 | Surface neutre, liens HTML | Utiliser les commandes communes dans le header autonome | Liens natifs migrés dans les deux pages, dont le gabarit de la notice | `contact-390`, `confidentialite-390` | Navigation, contact, clavier et notice générée |
| Fils d’Ariane et titres ordinaires | Fil à 11 px sur petit écran et tailles différentes pour certains H1 de même niveau | P3 | `--font-size-meta` et `--font-size-page` | Aligner le socle de typographie | Taille du fil partagée, soulignement au survol, H1 des en-têtes ordinaires alignés | Hubs, compte et bibliothèque sur les trois largeurs | Vérification des titres complets, des destinations et d’`aria-current` |

### Variantes justifiées

Les jours, compteurs et événements du calendrier gardent leur rôle dans la grille. L’agenda présente les titres complets et distingue les exemples fictifs. Les radios du QCM et du Drill, les propositions botaniques, les filtres, les tableaux et les liens de lecture gardent leurs géométries. Les couvertures plus compactes du cours, du QCM et du Drill dégagent leurs contenus. Contact et Confidentialité gardent leur navigation autonome. Le profil garde ses trois sections, les accès à l’aide et à la notice, ainsi que le parcours de copie de données par contact.

## Galerie, thèmes, responsive et accessibilité

L’artefact **`harmonisation-ui-<ID du run>`** du job `ui-performance-lab` contient `index.html`, `boutons.html`, les captures et `controles.json`. La galerie du poste est dans `.tmp/ui-2027-pr5-lot2/review/`. Ouvrir une capture depuis la galerie pour la voir à sa taille réelle. Les données fictives du calendrier, du compte et des statistiques sont injectées pour le seul navigateur de test. [Checks et artefacts de la PR](https://github.com/Vladoche/mon-bprea/pull/78/checks).

- La galerie et la planche réunissent **532 images**. Les pages complètes sont comparées à **390, 768 et 1 440 × 1 000 px**, plus les 19 vues en sombre à 390 px. Les planches de pages, les dialogues, les profils et les photographies sélectionnées ont été inspectés visuellement. Les contrôles de largeur ajoutent 320, 601, 1 024 et 1 101 px. Les 19 entrées tiennent dans leur fenêtre.
- Les quatre saisons ont été évaluées en clair et sombre sur chaque route. L’automatique, la mémorisation entre pages et les préférences de compte sont exercés par la suite d’apparence. La variation saisonnière touche uniquement les surfaces et accents attendus.
- La planche compare header, Accueil, UC, cours, QCM, Drill, tableau de bord, calendrier, ITK, ressources, botanique, profil et navigation publique. Repos, survol, appui et focus sont visibles, ainsi que les états natifs désactivés du QCM et du calendrier. Les commandes retenues partagent le dégradé, le reflet, le rayon et l’ombre du header pour leur variante. Les flèches du calendrier sont compactes. Le test tactile active le compteur du jour, consulte l’agenda et ferme le détail.
- Zoom natif Chromium à **200 % et 400 %** pour le cours avec menu ouvert, le détail du calendrier et le dialogue d’apparence. À 400 %, 1 280 × 1 000 px physiques donnent 320 × 250 px CSS. Le menu et le détail se parcourent verticalement. Les dialogues restent fermables au clavier.
- Le contraste forcé conserve contours, focus et commandes sur le détail du calendrier. Les scénarios ITK, ressources, botanique et tableau de bord exercent aussi la sélection et les contrôles dans ce mode. La préférence de mouvement réduit coupe notamment les transitions des pilules et l’animation de correction botanique.
- Dans les huit palettes, le minimum relevé est **4,73:1** pour le texte des accents terracotta, **4,94:1** pour le texte secondaire sur surface douce, **4,99:1** pour le lien sur cette même surface et **3,06:1** pour le contour de champ sur la surface qui l’entoure. Les valeurs sont des mesures ciblées de couleurs calculées et des bornes des dégradés. Le seuil WCAG 2.2 AA est de 4,5:1 pour le texte courant et de 3:1 pour les indices graphiques nécessaires. [Critères WCAG 2.2](https://www.w3.org/TR/WCAG22/#contrast-minimum).

## Parité métier et tests

Les dates et intitulés de l’agenda (jour et mois), l’ordre des événements et le détail textuel ont donné les mêmes sorties avec la même fixture. Le JSON officiel du calendrier comporte toujours zéro événement. Les fichiers de données, médias botaniques et licences correspondent aux objets Git de référence. Les commandes migrées conservent les sélecteurs, destinations et écouteurs métier.

Les parcours joués couvrent lecture et progression, scores et historiques, données absentes ou incomplètes, paramètres/calculs/CSV/impression ITK, PDF, découverte et Chrono. Les suites de compte couvrent les états d’identité, pseudo, préférences, hors ligne, attente, erreurs de stockage, conflits et changement de compte. Les tests A/B vérifient l’absence de réaffichage tardif des données du premier compte. Les modules historiques export/restauration/effacement restent en dehors du profil partagé.

| Contrôle | Résultat de la campagne |
| --- | --- |
| SDK verrouillé et notice | SDK Supabase 2.118.0 reconstruit avec diff vide. Notice générée conforme, empreinte LF source `c2b2422b9c3d6b7ec25227f143080782842c4c077f5a1361d4cd36653ad9b8c1`. |
| Unité et intégration | 680 réussis, 1 ignoré sous Windows, 0 échec sur la première version `fdd165c`. `npm test -- --maxWorkers=2`, avec accès aux ACL, jonctions et connexions locales après une première exécution restreinte. |
| Playwright Chromium | Sur `fdd165c`, 249 réussites à la première passe. Le parcours des 24 photos a dépassé les 30 s pendant les contrôles concurrents et a réussi seul en 25,7 s. Les 10 scénarios calendrier passent après le correctif `07ae671`. [Échec Linux initial et trace](https://github.com/Vladoche/mon-bprea/actions/runs/44609850824/job/135863223655). |
| Supabase local CLI 2.121.0 | 414 assertions pgTAP, 12 groupes Auth, 22 Drill et 26 données personnelles réussis. Chromium local, 30 réussites avec le runner du dépôt, puis 3 réussites avec une copie de la fixture qui vérifie le nom et le label Docker du projet fictif dédié. L’adaptation locale conserve les assertions et permet de préserver les volumes du projet canonique déjà présents. La CI utilise le runner canonique. |
| CI de la PR | Les résultats de `unit-integration`, `e2e`, `ui-performance-lab` et `supabase-security` se lisent sur la tête de PR. Les mesures brutes et les galeries spécialisées sont dans `ui-performance-lab-<ID du run>`. [Résultats GitHub](https://github.com/Vladoche/mon-bprea/pull/78/checks). |

## Performance

Le job `ui-performance-lab` compare le SHA de référence et la branche sur le même runner. Les contextes Chromium partent d’un cache froid, en 1 440 × 1 000 px, avec CPU ralenti ×4 et réseau simulé à 20 ms et 1,25 Mo/s. Les métriques comprennent LCP, CLS, affichage utile, CSS, JavaScript, requêtes et temps entre le clic et la deuxième frame rendue pour les menus, mises à jour et dialogues exercés. Voir les médianes, écarts et budgets diagnostiques dans `performance*.json`.

Le total des huit CSS modifiés passe de 127 902 à 126 073 octets (−1 829). Les dix modules JavaScript contenant le marquage passent de 162 436 à 162 667 octets (+231). Les commandes utilisent les effets déjà chargés, avec zéro fichier, dépendance, requête ou image publique ajoutée.

Mesures locales sur Windows, cinq passages alternés par version. Les temps sont arrondis à la milliseconde et les octets correspondent aux ressources effectivement servies par le banc local.

| Médiane avant → après | Accueil | Calendrier |
| --- | ---: | ---: |
| LCP (ms) | 1 372 → 1 432 | 1 164 → 1 180 |
| CLS | 0 → 0 | 0,0520 → 0,0519 |
| Chargement (ms) | 1 048 → 1 046 | 1 011 → 1 022 |
| H1 et navigation visibles (ms) | 1 355 → 1 410 | 1 346 → 1 380 |
| Ouverture du menu (ms) | 37 → 39 | 36 → 38 |
| Changement de mois (ms) | — | 22 → 20 |
| Ouverture du détail (ms) | — | 34 → 30 |
| CSS (octets) | 78 812 → 77 659 | 69 825 → 69 307 |
| JavaScript (octets) | 682 837 → 681 983 | 682 837 → 681 983 |
| Requêtes | 67 → 67 | 66 → 66 |

Les deux mesures locales restent dans les budgets diagnostiques. Le LCP médian augmente de 60 ms à l’accueil et de 16 ms au calendrier dans cette série. Le nombre de requêtes est identique et l’ouverture du détail reste autour de 30 ms. Les preuves du poste sont conservées dans `.tmp/ui-2027-pr5-lot2/performance/`.

## Anomalies résiduelles et suite

- **P1 pour la recette de publication, préexistant**. La notice approuvée mentionne encore l’export JSON du profil retiré dans #77. Le contact demeure accessible. Examiner le texte avec l’exploitant et obtenir la décision applicable avant de préparer une nouvelle publication. La PR touche seulement le header du rendu généré.
- **P2, performance sur catalogue synthétique**. La première CI relève 445 → 443 ms pour les interactions thème/menu à 600 fiches, au-dessus du seuil diagnostique de 200 ms dans les deux versions. Le filtre passe de 498 à 526 ms et la réinitialisation de 1 137 à 1 198 ms sur trois passages. Le catalogue versionné reste dans les budgets. Les écarts du scénario de charge sont à relire si le volume réel augmente. [Mesures du premier passage CI](https://github.com/Vladoche/mon-bprea/actions/runs/44609850824/job/135863224285).
- **Limites de cette qualification**. Les contrôles portent sur Chromium, la navigation clavier, les médias simulés et les scénarios inspectés. Les lecteurs d’écran natifs, Safari et la recette sur hébergement restent à qualifier selon la [checklist de recette finale](CHECKLIST-RECETTE-FINALE-2027.md).

La PR est destinée à la revue. La recette indépendante suit une décision de fusion. GitHub Pages et Supabase PROD sont hors de cette campagne.

**GO PARTIEL — Réserves identifiées.**
