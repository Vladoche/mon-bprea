# Validation manuelle — Calendrier et préparation aux examens

Réalisée le 17 octobre 2026, sur la branche `feature/calendrier-examens`, avec un serveur HTTP local. Aucun déploiement, aucune dépendance et aucune suite de tests automatisés ajoutés.

Les événements et résultats utilisés pour les scénarios ci-dessous sont des données fictives temporaires dans le navigateur de vérification. Le fichier livré `assets/calendar-events.json` reste vide. Les valeurs initiales des trois sauvegardes locales ont été restaurées après les vérifications.

Fichiers livrés :

- `calendrier.html`, `assets/calendar.js`, `assets/calendar-data.js`, `assets/calendar.css`, `assets/calendar-events.json` : calendrier et source JSON.
- `assets/exam-preparation.js`, `assets/exam-preparation.css`, `assets/exam-stats.js` : bandeau et calculs de préparation.
- `assets/app.js`, `assets/style.css`, `index.html` : navigation commune, montage du bandeau, historique des tentatives et préservation des sauvegardes.
- `assets/resources.js` : correction du chemin d’un PDF existant.
- `README.md`, `VALIDATION-LOT1.md` : format des événements, méthode des indicateurs, stockage et compte rendu de validation.

| Parcours | Résultat observé |
| --- | --- |
| Accueil et calendrier vides | États explicites, accueil et navigation existants utilisables. |
| Navigation mensuelle | Mois précédent/suivant, choix direct, retour à aujourd’hui et passage décembre/janvier corrects. |
| Cours, stage, vacances, examen | Libellés et couleurs distincts ; UC associée et lieu visibles. |
| Période à cheval sur deux mois | Visible dans les deux agendas ; premier et dernier jours inclus. |
| Détail d’un examen | Dates, UC avec lien, lieu et description multilignes affichés. Ouverture avec Entrée, fermeture avec Échap et retour du focus au bouton. |
| Examen à venir | Le bandeau affiche l’UC et le compte à rebours ; son lien ouvre le mois du calendrier. Les exemples sont exclus. |
| Examen aujourd’hui/en cours/terminé | « Début aujourd’hui », « En cours » jusqu’au dernier jour inclus ; examen passé exclu ensuite. |
| Examen sans UC ou UC sans exercices | Données manquantes explicites, aucune statistique inventée. |
| Aucun QCM réalisé | 0 % de complétion si des exercices sont disponibles ; réussite et indice non calculables. |
| Ancien meilleur score seul | QCM compté pour la complétion, score conservé ; taux de réussite et indice non calculables, historique partiel signalé. Cocher un cours terminé ne compte pas comme un QCM réalisé. |
| Corrections répétées | Tentatives 1/3 puis 3/3 : deux entrées datées conservées, meilleur score 3/3, 3/12 questions terminées (25 %), réussite 4/6 (67 % affiché), indice 17/100 affiché. |
| Sauvegarde dans deux onglets | Cocher un cours depuis un onglet ouvert avant les QCM conserve les deux tentatives, les autres cours et les propriétés inconnues. |
| Sauvegarde illisible | Racines chaîne, tableau et JSON invalide archivées intégralement avant ajout d’une tentative ; correction fonctionnelle. |
| Stockage saturé/indisponible | Résultat visible et message explicite de non-enregistrement, sans suppression de l’historique enregistré. |
| Événement invalide / UC inconnue | Date impossible écartée avec avertissement ; événement avec UC inconnue conservé sans lien d’UC. |
| Calendrier mal formé / chargement indisponible | États d’erreur dans le calendrier et le bandeau ; « Réessayer » récupère les données quand elles redeviennent disponibles. |
| Clair/sombre et responsive | Inspection des vues ordinateur et mobile : accueil, calendrier, agenda et dialogue. Pas de débordement horizontal global aux largeurs 320, 390, 760, 800, 930, 1024 et 1440 px. Navigation mobile défilante, titres complets dans l’agenda. |
| Cours et QCM existants | Accès à l’UC 03, quatre cours et corrections conservés. |
| Générateur ITK | Génération carotte sur 200 m², six opérations, export CSV téléchargé ; bouton d’impression présent. |
| Ressources | Recherche et filtres opérationnels. Un lien PDF déjà incorrect dans le catalogue a été corrigé vers le fichier existant d’annuaire des fournisseurs de semences. Les trois PDF du catalogue répondent HTTP 200 après correction. |

Vérifications complémentaires : syntaxe des modules JavaScript avec `node --check`, validité du JSON et `git diff --check`. Pas d’erreur console sur les pages finales consultées ; les erreurs HTTP provoquées pour les scénarios d’indisponibilité étaient attendues.

Limites de cette validation : navigateur Chromium de vérification avec dimensions mobiles simulées ; pas d’essai sur appareil physique, de lecteur d’écran ou de publication GitHub Pages. Les événements sont des journées entières, sans horaires ni récurrence. Les anciennes tentatives ne peuvent pas être reconstituées à partir d’un seul meilleur score. L’indice reste un repère limité aux QCM disponibles, jamais une probabilité de réussite à l’examen.
