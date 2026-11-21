# Mon BPREA — audit technique du lot B

Campagne du 21 novembre 2026. Référence `origin/main` `131d2f006e3b80c9f2580888a423af6c096c8e97`, vérifiée après `git fetch origin`. Site observé en HTTP 200 avec les ressources de `47aff29763763fd3be0b16b60f90e5c8f1048508`, huit commits derrière la référence auditée. Les PR #82, #83 et #84 sont fusionnées et avaient respectivement quatre, cinq et cinq checks réussis à leur dernière tête. [Publication Pages #67](https://github.com/Vladoche/mon-bprea/actions/runs/44763339527) · [#82](https://github.com/Vladoche/mon-bprea/pull/82/checks) · [#83](https://github.com/Vladoche/mon-bprea/pull/83/checks) · [#84](https://github.com/Vladoche/mon-bprea/pull/84/checks).

## Périmètre et constats

La revue couvre **12 domaines**, les 19 documents HTML, 76 fichiers JavaScript applicatifs hors SDK, 21 feuilles de style et 7 banques ou configurations JSON. L’inventaire des dépendances, des points d’entrée HTML et des appels différés a été complété par la lecture des services de domaine et de leurs scénarios de panne. Le graphe public examiné ne contient pas de cycle. Plusieurs implémentations de synchronisation suivent un cycle similaire et appliquent des règles de réconciliation distinctes. Aucun regroupement de ces services n’a été nécessaire pour les corrections.

| Domaine | Points contrôlés |
| --- | --- |
| Accueil, rubriques et navigation | Graphe de chargement, liens et préfixe Pages, intégration du header et du footer, clavier, reprises des pages et erreurs de module. |
| UC, cours et QCM | Identifiants et liens, validation des tentatives et dates, scores historiques, état visiteur et compte, sauvegarde réversible et réponses tardives. |
| Drill | Sélection hebdomadaire civile à Paris, premières réponses et entraînements, reprise des brouillons, outbox, conflit et acquittement. |
| Tableau de bord et synthèse S’exercer | Calcul pondéré sur les réponses validées, source identifiée, état vide ou indisponible, filtres, cache et fraîcheur après navigation. |
| Calendrier et examens | Dates civiles et bornes, navigation, liens directs et reprise des chargements. La banque officielle est vide. Le prototype d’examens reste conservé. |
| ITK | Validation et paramètres mémorisés, calcul, dates indicatives, CSV et demande d’impression. |
| Botanique | Banque et photos, progression, révision, chrono en arrière-plan, données de session et reprise après panne. |
| Bibliothèque | Recherche et filtres, parité entre l’adresse et l’état, contrôles PDF, focus, liens associés et coût de rendu du catalogue. |
| Profil et apparence | Formulaires et erreurs, vérification du pseudo, palettes saisonnières, mode sombre, couleurs personnalisées et rendu avant CSS. |
| Authentification et séparation public/privé | Configuration, version SDK, invitation et récupération, transition entre identités, rendu de données dynamiques et frontières de l’artefact Pages. |
| Synchronisation et RLS | Portée projet/environnement/UUID, transactions IndexedDB, erreurs réseau et réponses incomplètes, reprise des opérations, contrats des six migrations et privilèges de `profiles`. |
| Données personnelles et assistance | Export et restauration historiques, annulation et opérations partielles, contact/notice et parcours opérateur documenté. Les interfaces historiques restent exercées sur les bancs de test. |

Les contrôles statiques portent sur le code et l’artefact. Ils couvrent l’échappement des textes dynamiques, la validation des destinations, la copie de fichiers publics, les privilèges de colonnes et les prédicats de propriété. Le scan des fichiers publics n’a relevé aucune valeur correspondant aux motifs de clé secrète, clé privée ou JWT examinés. Le SDK verrouillé, le mode invitation et la limite administrative **1 exploitant + 9 participants** restent régis par les contrats existants. Les limitations relatives aux jetons encore valides et au cache local accessible depuis le profil navigateur sont documentées. [Contrat Auth](../architecture/AUTHENTIFICATION.md#privilèges-et-politiques-rls) · [Documentation Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Anomalies et corrections

Sept constats retenus, **0 P0, 5 P1 et 2 P2**. Les cinq P1 et un P2 sont corrigés. Le dépassement du budget pour 600 fiches garde une mesure et une justification séparées.

| ID | Gravité | Reproduction et impact | Cause et correction | Vérification |
| --- | --- | --- | --- | --- |
| B-01 · Démarrage | P1 | Ouvrir l’accueil à froid et relever les scripts. Simuler ensuite l’échec réseau du module Calendrier lors de l’ouverture de cette rubrique. La référence transfère les modules d’autres pages et l’échec peut empêcher le rendu de la navigation. | `app.js` importait statiquement les modules spécialisés. Chargement selon la rubrique et état d’erreur avec rechargement possible. Les ressources de cours sont chargées à part et le suivi du profil conserve son démarrage. | Test des requêtes de l’accueil, module Calendrier indisponible puis rétabli, mesures ci-dessous et suite Chromium. |
| B-02 · Cours | P1 | Retenir deux réponses de sauvegarde sur des comptes fictifs A et B, terminer celle de A et déclencher une actualisation de B. Le contrôle B peut redevenir actif pendant son enregistrement. | `app.js` effaçait l’état d’enregistrement avant de rejeter le résultat d’une ancienne identité. Le résultat tardif ne modifie plus le contrôle. | Le contrôle reste désactivé jusqu’au résultat de B, puis la valeur enregistrée est relue. |
| B-03 · Synthèse Drill | P1 | Ouvrir S’exercer en visiteur, valider une réponse Drill puis revenir avec le retour arrière de Chromium. La page restaurée depuis son cache affichait zéro exercice réalisé. | `section-hubs.js` supprimait son propre abonnement à `pageshow` lors de l’arrêt du service. La page revalide la source à la restauration. La synthèse personnelle est vidée du DOM à la mise en cache de la page. | Retour arrière natif confirmé par `pageshow.persisted`, compteur de zéro à un après relecture. |
| B-04 · Reprise Drill | P1 | Simuler une lecture personnelle indisponible, rétablir le service et actionner « Réessayer la lecture ». La synthèse restait indisponible. | Le bouton recalculait le rendu à partir du même état. `section-hubs.js` demande une vraie relance au service personnel, bloque les doubles clics et rétablit le focus. | Le fixture reçoit une relance et affiche deux réponses. Le focus revient au titre de la synthèse. |
| B-05 · Bibliothèque | P1 | Ouvrir une fiche au clavier après un tri, puis revenir au tri antérieur. Le document reste ouvert et perd le focus. Le rendu intégral pénalise les grands catalogues. | `resource-library.js` recréait toutes les cartes. Les résultats conservés réutilisent leur nœud et récupèrent le focus. `resources.js` évite la normalisation de la description sans mots recherchés. | Tri et retour clavier avec deux fiches, suite PDF, comparaison sur 600 fiches. |
| B-06 · Recherche documentaire | P2 | Coller plus de 300 caractères dont la fin change la recherche, puis recharger l’adresse. La fin était utilisée immédiatement et coupée à la relecture. | La limite existait uniquement à la lecture de l’adresse. `resource-library.js` l’applique aussi à la saisie et à son traitement. | Même valeur et même nombre de résultats avant et après rechargement. |
| B-07 · Catalogue synthétique | P2 résiduel | Trier 600 fiches fictives sous CPU ralenti. Le résultat dépasse encore la cible de 200 ms. | Des cartes restent toutes présentes dans la grille et le navigateur les repositionne. La recette précédente signalait déjà ce dépassement sur le catalogue synthétique. Le catalogue officiel est beaucoup plus petit. | Tri mesuré de 939 à 858 ms. Garder la mesure pour arbitrer un éventuel chantier de rendu sur gros catalogue. [Recette précédente](VALIDATION-RECETTE-FINALE-2027.md#performance). |

## Mesures de laboratoire

Chromium 156.0.8078.4 verrouillé par Playwright, Node 24.22.0, Windows, 1440 × 1000, Europe/Paris, visiteur avec palette automne claire. Trois chargements par scène et par version, contexte neuf, cache froid, serveur statique en boucle locale sans compression, sans trafic externe. CDP ralentit le CPU ×4 et règle la latence à 20 ms et le débit à 1,25 Mo/s. Les lignes donnent les médianes. Le contenu est prêt lorsque le premier contrôle ou contenu caractéristique de la scène et la navigation sont visibles. `load` vient de Navigation Timing, le LCP et le CLS des observateurs Chromium. Les appels HEAD des PDF comptent dans les requêtes. Les données de 600 fiches viennent du générateur du laboratoire du dépôt.

| Scène | JS transféré (ko) | Requêtes | `load` (ms) | Contenu prêt (ms) | LCP (ms) | CLS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Accueil | 691 → 355 | 68 → 47 | 1 147 → 759 | 1 496 → 1 066 | 1 432 → 1 068 | 0 → 0 |
| Mes cours | 700 → 376 | 69 → 49 | 1 038 → 687 | 1 635 → 1 007 | 1 252 → 760 | 0 → 0 |
| Lecture | 691 → 393 | 69 → 50 | 1 092 → 699 | 1 531 → 1 052 | 1 352 → 1 032 | 0 → 0 |
| QCM | 691 → 355 | 66 → 45 | 1 047 → 648 | 1 462 → 985 | 1 304 → 720 | 0 → 0 |
| Drill | 691 → 384 | 67 → 48 | 1 047 → 652 | 1 672 → 1 086 | 1 320 → 1 068 | 0 → 0 |
| Tableau de bord | 691 → 381 | 66 → 45 | 1 184 → 661 | 1 712 → 1 075 | 1 184 → 1 048 | 0,051 → 0 |
| Calendrier | 691 → 337 | 67 → 44 | 1 083 → 656 | 1 288 → 986 | 1 216 → 912 | 0,022 → 0,022 |
| ITK | 724 → 347 | 68 → 43 | 1 075 → 680 | 1 484 → 973 | 1 304 → 908 | 0 → 0 |
| Botanique | 691 → 465 | 67 → 51 | 1 081 → 673 | 1 634 → 1 503 | 292 → 296 | 0 → 0 |
| Ressources officielles | 691 → 352 | 70 → 47 | 1 063 → 648 | 1 696 → 1 064 | 1 368 → 1 028 | 0 → 0 |
| Ressources, 600 fiches | 691 → 352 | 68 → 45 | 1 058 → 649 | 2 518 → 2 170 | 2 156 → 1 844 | 0 → 0 |
| Profil visiteur | 691 → 376 | 67 → 47 | 1 126 → 663 | 1 240 → 1 052 | 296 → 308 | 0 → 0 |

L’HTML reste compris entre 1,07 et 2,93 ko et le CSS entre 68 et 85 ko sur ces scènes. Le transfert total de l’accueil passe de 901 à 559 ko. Le temps de script CDP y passe de 127 à 88 ms et les plages JavaScript exécutées relevées par V8 de 127 194 à 106 015 unités UTF-16. Le tas JavaScript mesuré ponctuellement passe de 3,32 à 3,16 Mo à l’accueil et de 2,30 à 2,84 Mo au Calendrier. Une lecture du tas sans GC forcé montre la variabilité locale et ne permet pas de conclure à une évolution générale de la mémoire ou à une fuite.

Le clic sur la luminosité jusqu’à la deuxième frame reste entre 21 et 32 ms sur les scènes normales. Le tri descendant du catalogue synthétique passe de 939 à 858 ms avec le même chronométrage. Ces valeurs sont des mesures locales de présentation. L’INP en conditions réelles reste hors de cette campagne. La charge d’un nouvel import peut se poursuivre après `load`, d’où la mesure séparée du contenu prêt. Le LCP de Botanique et de Profil peut porter sur le contenu statique affiché avant l’initialisation. Pour une comparaison ultérieure par paires, utiliser le [laboratoire du dépôt](../../scripts/measure-ui-foundations.mjs) avec une archive publique du SHA de base et `--baseline`, `--baseline-ref`, `--page` et `--runs 3`. Le scénario Ressources utilise aussi `--large-catalog`.

## Validation exécutée

| Contrôle | Référence | Candidat |
| --- | --- | --- |
| `npm test` | 686 réussis, 0 échec, 1 ignoré | 686 réussis, 0 échec, 1 ignoré |
| `npm run test:e2e -- --workers=2` | 262 réussis, 0 échec, 0 ignoré | 267 réussis, 0 échec, 0 ignoré |
| Scénarios ciblés de régression | Sept assertions en échec sur le comportement de référence | Sept scénarios inclus dans les 267 succès |
| SDK, notice et artefact | SDK et scripts de CI vérifiés à la tête de #84 | SDK 2.118.0 reconstruit à l’identique, rendu de notice vérifié, 19 pages et 164 fichiers dans l’artefact local, imports différés versionnés et Auth désactivée dans le build de test. Les tests de l’artefact de production utilisent des paramètres fictifs. |

La vérification locale a couvert clavier, clair/sombre, saisons, contrastes et comptes synthétiques. Les captures de l’accueil à 1440 px, du QCM à 768 px, du menu connecté à 390 px et de l’apparence sombre à 320 px ont été relues. Les tests de première image ont rejoué la couleur personnalisée et la navigation entre rubriques, rechargement, retour et onglet neuf. Ils n’ont pas reproduit le clignotement sur Chromium. Le contrôle d’artefact inventorie les 19 pages et vérifie l’absence d’erreur JavaScript inattendue dans les contextes testés.

Les vérifications sur un moteur Safari natif, un lecteur d’écran natif et le dialogue d’impression système restent ouvertes. Le moteur Docker local était arrêté et aucune stack Supabase dédiée n’était disponible sur le poste. L’exécution Auth/RLS réelle relève du check `supabase-security` de la PR, avec sa stack éphémère et ses comptes fictifs. Les contrôles hébergés de ce lot portaient sur les réponses Pages publiques.

## Couverture existante et préparation du lot C

La matrice décrit des parcours observés dans les suites. Aucun pourcentage de couverture du site n’a été extrapolé. Les parcours connectés relèvent soit de doubles synthétiques dans `tests/e2e/`, soit de la suite locale réelle `tests/e2e-supabase/` exécutée par le job de sécurité.

| Domaine | Couverture actuelle | Risque résiduel | Tests recommandés |
| --- | --- | --- | --- |
| Authentification | Invitation et récupération, expiration, sessions, erreurs réseau, formulaires, changement d’identité et retour navigateur. | Enchaînement des états après interruption réseau et rechargement sur un autre moteur. | Un parcours reprise Auth après veille dans un moteur supplémentaire. Garder la validation des entrées et le triage des erreurs en unitaire. |
| Cours et QCM | Cours, ancres, complétion réversible, correction, perte d’acquittement, séparation A/B. | Croisement de deux onglets avec une tentative et une modification de complétion concurrentes. | Un E2E avec deux onglets et stockage conservé après rechargement. Ratios et formats historiques en unitaire. |
| Drill | Premières réponses, brouillons, entraînements, reprise, conflit et synchronisation réelle. | Semaine qui bascule pendant un brouillon et connexion interrompue. | Un parcours daté avec sauvegarde, réveil et passage à la semaine suivante. Calcul ISO et DST en unitaire. |
| Tableau de bord | Filtres, graphiques, cache hors ligne, premier comptage, bascule de compte et retour synthèse Drill. | Reprise d’une sélection et de sa période depuis une URL après modification dans un autre onglet. | Un trajet Drill → Dashboard filtré → retour, avec contrôle des premières réponses. Agrégations en unitaire. |
| Calendrier | Date civile, période multimois, liens directs, erreur/reprise, dialogue et clavier. | Contrôle mois et focus sur WebKit réel. | Une recette web mobile du champ mois et du retour de focus. Fuseaux, années bissextiles et dates invalides en unitaire. |
| ITK | Saisie native, génération, résultats, mémoire, CSV, conflits et demande d’impression. | Dialogue système d’impression et CSV relu hors Chromium. | Un contrôle du flux tactile Safari et une relecture de contenu CSV. Conserver les calculs et validations de paramètres en unitaire. |
| Botanique | Photos, réponses, chrono/pause et page restaurée, révision, erreurs de stockage et synchronisation réelle. | Transition simultanée hors ligne, changement d’onglet et résultat en cours d’enregistrement. | Rejouer la scène de course critique sur un moteur supplémentaire. Variété des questions en unitaire avec hasard contrôlé. |
| Profil et préférences | Pseudo, focus, erreurs, clair/sombre, couleurs à la première image, retour et nouvel onglet, synchronisation réelle. | Premier rendu sur Safari et lecteur d’écran natif. | Recette réelle WebKit et échantillon de navigation assistée du profil. Conserver les assertions de première image des tests spécialisés. |
| Synchronisation | Deux identités et deux appareils, pannes, réconciliation, restauration des caches et conflits dans chaque domaine. | Interactions entre une unique opération d’apparence et une reprise Drill lors de la même interruption. | Un seul E2E transversal d’interruption et reprise. Garder les détails de traitement des outboxes dans les tests d’intégration. |
| Export et restauration | Banc historique isolé, export paginé, annulation, fichiers invalides, conflits, restauration et limites. | Parcours actuel d’assistance depuis le site et confirmation du passage vers le circuit opérateur. | Tracer le parcours Contact/profil/notice dans un test public et garder les tests historiques de mécanisme sur le banc dédié. |
| Bibliothèque | Recherche combinée, PDF, retour, clavier, couleurs et petits écrans. | Catalogue artificiel volumineux et changement de filtre pendant la vérification d’un PDF. | Garder une mesure de laboratoire sur 600 fiches. Vérifier l’état final du PDF et le focus par un E2E ciblé. |

Les tests de première image par screencast et les tests screenshots sont sensibles à la cadence du navigateur, aux polices et à la disponibilité du cache retour. Garder les assertions sur les états et horodatages observés. Les scénarios de parcours critique, galerie et navigation couvrent parfois les mêmes liens. Le lot C peut partager leur préparation et réserver la galerie à la parité visuelle. La concurrence cours A/B, la synthèse après retour et le focus lors d’un tri sont désormais des régressions explicites.
