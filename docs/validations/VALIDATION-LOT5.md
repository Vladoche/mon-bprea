# Validation — Lot 5

Réalisée le **20 octobre 2026** sur `feature/themes-dynamiques-lot5`, créée depuis `origin/main` au commit validé `742786b`, après `git fetch origin main`. Le dépôt était propre avant intervention. Aucun changement directement sur `main`.

Vérifications exploratoires dans **Chromium / Playwright**, interactions réelles avec les contrôles et inspection des captures, serveur HTTP sous `/mon-bprea/`. Les préférences, QCM et réponses Drill utilisés pour la vérification sont limités à des **contextes de navigateur isolés**. Les dates sont simulées avec l’horloge du navigateur ; les événements de calendrier de démonstration sont interceptés uniquement dans un contexte isolé, sans modifier le JSON livré ni les données réelles. Aucun fichier ni suite de tests automatisés ajouté au dépôt.

## Résultats observés

| Vérification | Résultat |
| --- | --- |
| Quatre saisons | Printemps, été, automne, hiver sélectionnés dans le dialogue ; captures claires inspectées. Variantes sombres inspectées sur accueil, Dashboard et calendrier. Le thème couvre cours, contrôles, QCM, ITK et graphiques. |
| Quatre ambiances | Horloge locale simulée : avant 6 h, à 6 h, à 10 h, à 18 h et à 22 h ; attributs et fonds correspondants. Matin, journée, crépuscule et nuit inspectés visuellement. Passage automatique matin → journée observé en avançant le minuteur d’une minute, sans rechargement. |
| Réglages indépendants | Saison fixe + clair/sombre, saison automatique + luminosité automatique, changement de saison sans modifier la luminosité. Le bouton rapide force uniquement la luminosité. |
| Persistance | Automne + sombre conservés après rechargement. Changement dans un onglet propagé à un second onglet. La fusion relit les champs enregistrés, y compris un champ supplémentaire inconnu. |
| Ancien thème | Anciennes valeurs `light` et `dark` vérifiées séparément ; migration vers une luminosité manuelle, ancienne clé intacte. Clés de progression, Drill et ITK de contrôle inchangées. |
| Stockage atypique | Version future conservée au chargement puis chaîne brute archivée lors d’un choix explicite. Stockage totalement refusé : les deux réglages restent indépendants en mémoire et l’interface signale l’absence de sauvegarde ; aucune exception JavaScript. |
| Clavier et mobile | Dialogue ouvert au bouton, navigation Tab, fermeture Échap et retour du focus au déclencheur. Menu mobile → S’exercer. Accueil et paramètres à 320 px, calendrier à 390 px, Dashboard à 320 px ; aucun débordement horizontal de page. |
| Réduction des mouvements | Transition de couleurs calculée à 180 ms en mode normal, 0 s avec `prefers-reduced-motion: reduce`. Le dialogue n’ajoute pas d’animation. |
| Contrastes | Calculs sur les huit palettes : texte secondaire ≥ 4,71:1, accent ≥ 4,73:1, texte des boutons ≥ 5,02:1, focus ≥ 5,33:1 ; bordures des contrôles de base ≥ 3:1. Les textes et états de correction ont été inspectés visuellement. Cela ne constitue pas un audit WCAG complet. |
| QCM | Trois réponses puis correction : 1/3 ; bonnes et mauvaises réponses gardent leurs couleurs vert/rouge, explications lisibles en sombre. Sauvegarde conservée lors des changements d’apparence. |
| Drill et Dashboard | Série de 10 questions démarrée ; une bonne réponse et une erreur validées par l’interface. Dashboard : 2 réalisés, 1 correcte, 1 incorrecte, 50 %, 1 semaine active. Graphiques clairs/sombres, couleurs des séries, axes, légendes et présentation mobile inspectés. |
| Calendrier / examens | Calendrier livré vide toujours explicite. Avec quatre événements interceptés (cours, stage, vacances, examen) : catégories lisibles, détail ouvert puis fermé par Échap, affichage mobile sans débordement. Sur l’accueil, la préparation aux examens reste la première section, avant l’anecdote. Aucun événement fictif ajouté aux sources. |
| Anecdote du jour | Même identifiant après rechargement le 20 octobre ; masquage puis rechargement : reste masquée. Passage à minuit Paris : nouveau fait le 21, bandeau de nouveau visible sans rechargement. |
| Fuseau de la rotation | Dans un navigateur `Pacific/Honolulu`, au 20 octobre local, le bandeau affiche le 21 octobre Paris après minuit français. Les fonctions de date/rotation ont aussi été vérifiées ponctuellement autour des changements d’heure et de la boucle de dix jours. |
| Sources et liens | Dix entrées JSON valides, sans avertissement, fondées sur des pages INRAE, Ephytia et FAO vérifiées. Clic « En savoir plus » : nouvel onglet vers l’URL INRAE attendue, sans modifier la page de révision. Les associations de cours utilisent des identifiants existants. |
| ITK et documents | Génération tomate avec sept jalons, avertissements lisibles en sombre, téléchargement `itk-tomate.csv`. Émulation CSS d’impression : fond et panneau blancs, en-tête masqué. Bibliothèque : liens consultation/téléchargement maintenus, téléchargement PDF effectué, PDF local servi en HTTP 200 avec `application/pdf`. |
| Douze pages / navigation | Accueil, Mes cours, S’exercer, Outils, UC, cours, QCM, Drill, Dashboard, calendrier, ITK et ressources chargés sous `/mon-bprea/` avec trois rubriques principales et un bandeau quotidien. Aucun `pageerror` ni réponse réseau en erreur pendant ce parcours. |
| Données locales | Comparaison des chaînes de **toutes** les clés avant/après la navigation des douze pages : identiques. Changements d’apparence : clés pédagogiques inchangées. Navigation vers l’artefact versionné sur la même origine : toutes les clés précédentes intactes. |
| Artefact Pages | Préparation finale : 60 fichiers publics, 139 références versionnées. Inspection réseau navigateur sur accueil, Drill, Dashboard, calendrier et bibliothèque : 35 URL CSS/JS/JSON observées portent toutes `v=lot5-final-check` et conservent le préfixe imbriqué ; les cinq JSON sont couverts. Aucun `pageerror`. |

La préparation a également été vérifiée ponctuellement sur les imports transitifs, imports dynamiques, exports, références CSS, autres paramètres et fragments ; les URL externes et PDF restent inchangées. Les références absentes sont refusées avant écriture et une sortie non vide n’est pas écrasée. Tous les modules passent `node --check` et `git diff --check` ne signale aucune erreur de contenu (avertissements habituels de conversion LF/CRLF sous Windows).

## Fichiers et choix techniques

- **Apparence** : `assets/theme-init.js` devient le moteur précoce ; ajouts `assets/appearance.js` et `assets/appearance.css` pour le dialogue et le raccourci. Tokens et composants historiques harmonisés dans `assets/style.css`, `assets/dashboard.css`, `assets/calendar.css`.
- **Anecdote** : ajouts `assets/daily-facts.json`, `assets/daily-fact.js`, `assets/daily-fact.css`. Rotation civile Europe/Paris, stockage de masquage indépendant, aucune API externe à l’exécution.
- **Intégration** : `assets/app.js` et les douze pages HTML. La navigation garde son architecture et les moteurs métier ne changent pas.
- **Publication** : `.github/workflows/deploy.yml` utilise `scripts/prepare-pages.py`, uniquement dans l’artefact ; `.gitignore` exclut les sorties temporaires et locales.
- **Documentation** : README, `THEMES.md`, `ANECDOTES.md`, `CACHE.md` et ce compte rendu.

## Limites et livraison

Vérification dans Chromium, avec dimensions mobiles simulées ; pas d’appareil physique, de revue complète avec lecteur d’écran ou de comparaison Safari/Firefox. L’impression a été vérifiée par les styles d’impression, sans ouvrir le dialogue système ni valider un PDF imprimé. Le calendrier réel reste vide et la banque Drill initiale conserve ses limites existantes.

L’heure provient de l’appareil. Les horaires ne sont pas astronomiques. Les fonds horaires utilisent `color-mix` avec repli vers la palette normale lorsque cette fonction n’est pas prise en charge. Un ancien HTML en cache peut continuer temporairement à référencer une ancienne version des ressources : aucune invalidation instantanée n’est promise. La publication réelle et ses en-têtes HTTP ne peuvent être validés qu’après un déploiement autorisé ; aucun déploiement n’a été lancé pour cette vérification.

Livraison prévue par pull request de `feature/themes-dynamiques-lot5` vers `main`, sans fusion automatique ni publication en production sans accord.
