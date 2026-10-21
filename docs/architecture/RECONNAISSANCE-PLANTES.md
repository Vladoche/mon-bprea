# Reconnaissance des plantes — lot 5.2

Le module statique `reconnaissance-plantes.html` appartient à **Accueil → Outils**. Le menu commun et la carte d’Outils conservent les autres destinations. Il utilise les tokens des thèmes existants et n’ajoute aucune dépendance de production.

## Fonctionnement

Choisir une catégorie, puis **Découverte** (sans limite) ou **Chrono** (15, 30, 45 ou 60 secondes, 30 par défaut). La photothèque initiale propose des sessions courtes ; l’interface affiche le nombre réellement disponible. Une catégorie sans quatre noms distincts compatibles et au moins une photographie jouable reste désactivée. L’objectif de dix questions est un maximum par session, pas une promesse de contenu absent.

Une session tire jusqu’à dix espèces sans répétition et mélange questions et propositions. Les trois distracteurs appartiennent à la catégorie ; les relations de confusion documentées sont prioritaires. Il y a exactement quatre noms distincts et une réponse correcte. Le prototype utilise le niveau facile. Le champ `difficulty` prépare `easy`, `intermediate`, `hard` ; aucun filtre de difficulté ni mode spécialisé « Confusions » n’est exposé avant un enrichissement fiable de la banque.

Chaque réponse validée affiche le nom commun, le nom scientifique, la famille, le stade, les caractères visibles sur **cette** photographie, les caractères généraux séparés et les sources. Les attributions et liens de licence sont visibles dès la question. Les alternatives textuelles indiquent organe et stade sans révéler le nom à reconnaître. Les boutons sont accessibles au clavier, leur sélection utilise `aria-pressed`, la correction est annoncée et reçoit le focus.

Le chrono utilise `performance.now()` dans le moteur, avec une horloge injectable en test. L’intervalle d’interface ne fait qu’actualiser l’affichage ; il ne détermine pas le temps écoulé. Le décompte commence après chargement de l’image. `visibilitychange` met automatiquement en pause à la disparition de l’onglet et reprend à son retour, sauf pause manuelle. La correction arrête le chrono. La validation vérifie aussi l’échéance pour éviter de valider tardivement entre deux rafraîchissements. L’expiration produit `timeout`, séparé d’`incorrect`.

Si une photographie échoue, le chrono est arrêté, les propositions restent indisponibles et deux actions permettent de réessayer ou de passer. `skipped_image` est conservé mais exclu des questions réalisées et du taux. Une session peut être terminée à tout moment ; les questions sans résultat restent hors calcul. Une nouvelle visite revient à la sélection : les réponses déjà validées et les métadonnées des sessions sont conservées, la partie en cours n’est pas reprise.

## Frontières du code

| Fichier | Responsabilité |
| --- | --- |
| `assets/botanical-bank.json` | Référentiel éditorial unique, catégories, espèces, photos et confusions |
| `assets/botanical-engine.js` | Sélection, correction, statistiques et chronomètre sans DOM |
| `assets/botanical-store.js` | Lecture et écriture du seul espace botanique |
| `assets/botanical.js` | Interface, chargement local, accessibilité et visibilité de l’onglet |
| `assets/botanical.css` | Mise en page responsive avec les couleurs sémantiques du site |
| `assets/botanical-photos/` | Copies locales des photographies autorisées |

Les calculs et la persistance sont importés par l’application et les tests. Le Dashboard et les règles du Mode Drill restent indépendants. La préparation Pages copie automatiquement la nouvelle page, les modules, le JSON et les JPEG ; les imports et le chargement du JSON utilisent les conventions de cache busting existantes.

## Référentiel et enrichissement

La racine du JSON contient `version: 1`, `categories`, `species`, `photos`, `confusions`. Les identifiants doivent rester stables : les résultats historiques les référencent. Ne pas réutiliser un ancien identifiant pour un autre taxon ou une autre image.

Pour ajouter une catégorie, ajouter `{ "id": "aromatiques", "name": "Plantes aromatiques", "icon": "🌿", "description": "Observer les plantes aromatiques cultivées." }` dans `categories`, puis associer les espèces par `categoryIds`. Les cartes et les effectifs en découlent automatiquement. Une catégorie vide est affichée comme incomplète.

Pour ajouter une espèce, renseigner `id`, `commonName`, `scientificName`, `family`, `categoryIds`, `description`, `criteria`, `difficulty` et `sources` (objets `title`, `url`). Vérifier la nomenclature et les critères dans une source botanique identifiable. Ne décrire que les caractères pertinents au niveau BPREA. Les critères généraux sont distincts de ceux visibles sur chaque photo. Vérifier les homonymes : le moteur élimine les noms communs dupliqués parmi les propositions.

Pour ajouter une photographie, fournir `id`, `speciesId`, `path` relatif au site, `stage`, `organ`, `author`, `sourceTitle` (titre original fourni, consultable dans « Crédit complet »), `sourceUrl`, `license`, `licenseUrl`, `attribution`, `alt` descriptif sans nom à deviner, `visibleCriteria` et `identification`. Plusieurs objets peuvent référencer une même espèce avec des photographies différentes. Une photographie n’existe qu’une fois dans le référentiel, même si l’espèce appartient à plusieurs catégories. Choisir une image où la bonne proposition est identifiable face aux trois autres espèces compatibles. Une image trop générale ou ambiguë doit être exclue.

Télécharger uniquement après vérification individuelle de l’identification et des droits sur la page d’origine. Conserver auteur, URL du fichier source, version de la licence et attribution exacte. Optimiser en JPEG ou WebP, indiquer les transformations dans l’attribution et conserver la licence requise pour la copie dérivée. Remplacer une image par un nouveau nom de fichier : les photographies ne reçoivent pas de paramètre de version automatique. Le registre [BOTANICAL-SOURCES.md](BOTANICAL-SOURCES.md) documente les ressources initiales et leurs limites. Aucun service photo externe n’est nécessaire au jeu ou à sa CI.

Ajouter une confusion seulement si elle est documentée : `{ "speciesId": "…", "otherSpeciesId": "…", "explanation": "Caractères permettant la distinction…" }`. Ne pas inventer de relation pour remplir la base. Le moteur privilégie les relations dans les deux sens, l’interface affiche les explications explicitement enregistrées dans le sens concerné.

## Résultats et statistiques

Une tentative contient les identifiants de session, question, catégorie, espèce et photo ; le mode, le statut de révision, la réponse choisie, `status`, `correct`, `elapsedMs`, `answeredAt`. Les statuts sont `correct`, `incorrect`, `timeout`, `skipped_image`. Le modèle garde des identifiants et dates ISO exploitables ultérieurement, sans Supabase ni synchronisation dans ce lot.

**Taux de reconnaissance = correctes ÷ (correctes + incorrectes + temps écoulés) × 100.** Sans question réalisée, le taux est absent. Les photographies indisponibles et questions non tentées ne font pas baisser le taux. Les agrégats sont pondérés par le nombre de tentatives, pas par la moyenne de taux de sessions. Les doublons d’identifiant de réponse sont exclus. Les vues par espèce, thématique et jour UTC montrent volumes et résultats descriptifs. Les confusions observées associent espèce attendue et réponse effectivement choisie ; aucun score artificiel de maîtrise n’est calculé.

La révision sélectionne les espèces ayant au moins une erreur ou expiration dans l’historique. Les distracteurs restent issus de la catégorie entière, ce qui autorise de réviser une seule espèce. Une photo différente de la dernière erreur est privilégiée si elle existe. Une réussite ultérieure n’efface pas les tentatives initiales et ne retire pas automatiquement l’espèce de la révision.

## Persistance et limites

La clé dédiée est `monbprea.botanical.v1`, avec `schemaVersion: 1`, `answers` et `sessions`. Le store ne lit ni n’écrit aucune clé Drill, QCM, Dashboard, ITK ou apparence. Une réponse est enregistrée immédiatement et ne peut pas être remplacée par une seconde issue de la même question. Les métadonnées de session contiennent notamment dates de début/fin et nombre proposé.

Une sauvegarde illisible ou provenant d’un schéma futur reste intacte et en lecture seule, avec un avertissement. Les lignes invalides sont exclues des statistiques mais conservées dans le document lors des écritures suivantes, ainsi que les champs inconnus. Un stockage bloqué ou saturé laisse l’entraînement utilisable en mémoire et signale la non-persistance. Aucune purge automatique n’est prévue. Le store relit avant chaque écriture pour fusionner les réponses déjà écrites depuis un autre onglet ; `localStorage` n’offre toutefois pas de transaction atomique entre processus. Il n’y a ni compte, ni sauvegarde distante ni export dans ce prototype.

Le catalogue initial est petit, avec une seule photographie par espèce. Les sessions se limitent donc à quatre questions par catégorie jouable. Il reste à réunir des photos à différents stades, des légumineuses et des confusions documentées avant d’élargir les niveaux. L’entraînement ne constitue pas une clé de détermination exhaustive sur le terrain.

Les vérifications réellement exécutées sont consignées dans [VALIDATION-LOT5-2.md](../validations/VALIDATION-LOT5-2.md). Les mises à jour d’actions sont décrites dans [ACTIONS-NODE24.md](ACTIONS-NODE24.md).
