# Validation manuelle — Mode Drill hebdomadaire

Réalisée le 17 octobre 2026 sur `feature/mode-drill-hebdomadaire`, créée depuis `main` au commit validé du lot 1 `a8e454c`. Le `main` distant a été vérifié au même commit avant développement. Le dépôt était propre avant création de la branche.

Vérification exploratoire dans Chromium avec serveur HTTP local, interactions à la souris et au clavier, dimensions mobiles simulées et horloge de navigateur simulée pour les transitions. Aucun fichier de tests automatisés, dépendance, compte utilisateur ou backend ajouté. Les valeurs initiales des quatre clés locales ont été restaurées après les scénarios ; les banques et dates fictives ont été interceptées uniquement dans le navigateur, sans modifier les fichiers livrés.

| Parcours | Résultat observé |
| --- | --- |
| Navigation commune | Mode Drill accessible depuis les pages existantes, état actif affiché ; sélecteur d’UC accessible et navigation mobile défilante. |
| Banque initiale | 12 identifiants permanents UC 03, reprenant les questions, options et corrections des quatre cours existants. Les autres UC affichent une banque incomplète. |
| Nouvelle série | Prévisualisation de 10 questions distinctes, puis copie complète enregistrée au démarrage avant toute réponse. |
| Aucune réponse | 0/10 réalisés, aucune bonne ou mauvaise réponse et réussite « Aucune donnée ». |
| Brouillon initial | Choix d’une option, rechargement : question, choix et bouton de validation conservés. |
| Corrections et score | Une réponse incorrecte puis une correcte : 2/10 réalisés, 1 bonne, 1 mauvaise, 50 % ; les huit questions non réalisées ne sont pas des erreurs. |
| Revalidation ordinaire | Nouvelle demande de validation du même exercice sans mode entraînement : aucun résultat ni tentative supplémentaire, premier résultat inchangé. |
| Entraînement | Nouvelle tentative correcte après un premier résultat incorrect : toujours 2/10 et 50 %, avec un entraînement supplémentaire conservé. |
| Brouillon d’entraînement | Option choisie dans une tentative supplémentaire, rechargement : formulaire et choix restaurés ; après validation, brouillon consommé et tentative historisée. |
| Reprise entre onglets | Réponses distinctes depuis deux onglets : les deux résultats restent présents, les autres réponses et la copie des questions sont conservées ; affichage actualisé. |
| Sélection reproductible | Même UC et semaine, JSON dans un ordre différent : mêmes dix identifiants dans le même ordre ; dix identifiants uniques. |
| Répétitions limitées | Entre 2026-W42 et 2026-W43 : huit questions communes sur une banque de douze, soit le minimum possible. |
| Lundi 00 h Paris | Horloge passée du dimanche 18 octobre à 23:59:59 Paris au lundi : 2026-W42 devient 2026-W43. La série ancienne garde ses résultats ; démarrage de la nouvelle possible sans finir l’ancienne. |
| Changement d’année ISO | Transition réelle de l’interface simulée entre le 3 et le 4 janvier 2021 : 2020-W53 devient 2021-W01. L’ancienne série reste accessible. 2021-W53 est rejetée. |
| Heure d’été et d’hiver | Frontières du 30 mars 2026 à 00 h Paris (29 mars 22 h UTC) et du 26 octobre à 00 h Paris (25 octobre 23 h UTC) correctes. |
| Anciennes séries | Sélecteur : semaine courante, huit semaines précédentes et toutes les séries sauvegardées. Réouverture d’une série commencée et résultats conservés. |
| Banque corrigée | Version 2 et énoncés modifiés temporairement dans la réponse réseau : une série commencée garde ses énoncés et versions 1 sauvegardés. |
| Banque indisponible | Une série déjà commencée reste affichée et répondable avec ses dix questions ; erreur explicite et possibilité de relancer le chargement. |
| Banque insuffisante | Simulation à neuf questions dans une semaine non commencée : message 9/10, aucun démarrage ni duplication. UC sans question : message 0/10. |
| Sauvegarde illisible | JSON local invalide : écritures bloquées, message explicite, valeur brute conservée sans réinitialisation. |
| Stockage saturé | Échec d’un brouillon puis d’une réponse : message de non-enregistrement, données précédemment enregistrées strictement inchangées. |
| Clavier | Sélection radio avec les flèches, Tab vers validation, Entrée pour corriger ; focus placé sur la correction. |
| Responsive et thèmes | Inspection des écrans de sélection, séance et correction en clair et sombre. Pas de débordement horizontal global à 320, 390, 760, 880, 900, 1080 et 1440 px. |
| Bandeau d’examen | Avec une période fictive UC 03, résultats Drill de la semaine et volume séparés. Les QCM de cours restent à leurs propres valeurs, sans copie ni cumul des réponses Drill. |
| Cours et QCM | Quatre cours UC 03 accessibles ; QCM existant corrigé à 3/3, mécanisme de progression préservé. |
| ITK | Génération de sept opérations avec les paramètres par défaut ; boutons CSV et impression disponibles. |
| Ressources et calendrier | Recherche documentaire fonctionnelle ; navigation calendrier octobre/novembre conservée, JSON d’événements livré inchangé. |

Vérifications complémentaires : syntaxe de tous les modules modifiés ou créés avec `node --check`, JSON valide, `git diff --check`, relecture croisée des calculs et du stockage. Aucune erreur console sur la page finale rechargée ; les erreurs HTTP provoquées pour simuler une banque indisponible étaient attendues.

## Fichiers livrés

- `drill.html`, `assets/drill.js`, `assets/drill.css` : interface et interactions.
- `assets/drill-bank.json`, `assets/drill-bank.js` : questions structurées et validation.
- `assets/drill-engine.js` : semaines Paris, sélection déterministe et agrégations.
- `assets/drill-store.js` : copies des questions, brouillons, premiers résultats et entraînements.
- `assets/app.js`, `assets/style.css` : intégration à la navigation et adaptation responsive.
- `assets/exam-preparation.js`, `assets/exam-preparation.css` : suivi Drill distinct dans le bandeau existant.
- `README.md`, `MODE-DRILL.md`, `VALIDATION-LOT2.md` : édition de la banque, règles de calcul, stockage et validation.

## Limites

- Banque disponible uniquement pour l’UC 03 : douze questions de démonstration, sans couverture complète du programme. Une banque plus vaste est nécessaire pour espacer davantage les répétitions.
- Série courante déterminée par l’horloge de l’appareil, interprétée en Europe/Paris. Un navigateur endormi actualise la semaine à son réveil.
- Séries anciennes non commencées composées à partir de la banque disponible au moment où elles sont démarrées ; aucune ancienne banque fictive n’est reconstituée.
- Stockage propre au navigateur et à l’origine, sans synchronisation ni interface d’export/import. Historique sans purge automatique ; espace local limité.
- Sérialisation entre onglets avec Web Locks. Le repli sans cette API limite les collisions mais ne garantit pas l’atomicité d’écritures exactement simultanées.
- Vérification dans Chromium avec dimensions mobiles simulées, sans appareil physique ni audit complet de lecteur d’écran. Aucune suite de tests automatisés ajoutée.
- Le taux de réussite et l’indice de préparation restent des repères pédagogiques sans valeur de probabilité de réussite à l’examen.

Livraison sur la branche dédiée avec pull request vers `main`, sans fusion automatique ni déploiement en production.
