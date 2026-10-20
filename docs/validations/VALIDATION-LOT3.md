# Validation manuelle — Tableau de bord pédagogique

Réalisée le 18 octobre 2026 sur `feature/dashboard-uc`, créée après actualisation des références distantes depuis `origin/main` au commit `ff16b7c`. La fusion du lot 2 (`449fa23`) dans `main` a été vérifiée avant toute modification ; le dépôt était propre.

Vérification exploratoire dans Chromium, sur serveur HTTP local, avec le chemin `/mon-bprea/` pour exercer les URL relatives de GitHub Pages. Les parcours comportent des interactions souris et clavier, des inspections visuelles et des lectures ponctuelles des agrégats dans la console. Aucun fichier de test, suite automatisée ni dépendance n’a été ajouté.

Les jeux de données fictifs ont été limités à **un contexte navigateur distinct**, créé sans données locales ni cookies. Le stockage du contexte principal n’a pas été modifié. Les données fictives et interceptions réseau ne sont pas incluses dans les fichiers livrés. Le fuseau du contexte de vérification était `Pacific/Honolulu`, afin de vérifier que les semaines Drill restent calculées en Europe/Paris.

| Parcours | Résultat observé |
| --- | --- |
| Sans données | 0 réalisé, 0 bonne réponse, 0 erreur, 0 semaine active ; réussite « Aucune donnée ». État pédagogique, graphiques vides sans taux inventés et accès au Drill. |
| Première réponse réelle dans l’interface Drill | Démarrage d’une série UC 03, choix puis validation d’une réponse incorrecte : Dashboard à 1 réalisé, 0 correct, 1 incorrect, 0 %, 1 semaine active. Les neuf questions restantes ne sont pas des erreurs. |
| Revalidation et entraînement | Revalidation ordinaire du même exercice sans effet ; entraînement correct ajouté à son historique, tandis que le Dashboard reste à 1 réalisé et 0 %. Le moteur indique séparément un entraînement. |
| Rechargement / lecture seule | Après rechargement, mêmes résultats ; chaîne JSON Drill strictement identique avant et après consultation du Dashboard. |
| Plusieurs semaines et UC | Jeu isolé : cinq réponses, dont trois correctes et deux incorrectes sur trois semaines. Résultat : 5 réalisés, 60 %, 3 semaines actives. UC 03 : 3 réalisés, 2 corrects, 1 erreur, 67 % affichés ; UC 04 : 2 réalisés, 50 %. |
| Brouillons, séries incomplètes et répétitions | Brouillon et tentative supplémentaire exclus des cinq réponses. Une même question dans deux séries est comptée deux fois, une fois par série. Aucun résultat ajouté pour les questions non validées. |
| Date réelle d’activité | Une réponse enregistrée la semaine suivante dans une ancienne série alimente cette semaine de validation, tout en conservant la série source. Les agrégats complets concordent avec `getDrillUnitStats()`. |
| Faible volume | Avec une seule réponse, la notion indique « Données insuffisantes », même si le taux est calculable. Aucun jugement de maîtrise n’est déduit. |
| Historique long et pondération | Jeu isolé sur 26 semaines, dont trois vides : 151 réalisés, 95 corrects, 56 incorrects, 63 % affichés, 23 semaines actives. UC 03 : 96 réalisés / 88 % ; UC 04 : 55 / 20 %. Le global utilise 95/151, pas la moyenne des taux d’UC. |
| Semaines sans réponse | Volume zéro, taux `null` ; segments interrompus au niveau des trous, sans point à 0 % inventé. Le véritable 0 % d’une réponse incorrecte reste affiché. |
| Historique paginé | Fenêtres de 12 semaines au maximum : les 26 semaines restent parcourables dans les deux directions ; premières/dernières limites désactivées. Les totaux et le tableau portent sur toute la période, indépendamment de la fenêtre graphique. |
| Filtres | UC, fenêtres 4/8/12 semaines et historique complet fonctionnels. Fenêtre 12 semaines du jeu long : 73 réalisés, 47 corrects, 26 erreurs, 64 %, 11 semaines actives. La comparaison conserve les sept UC sur la période. |
| Navigation dans les filtres | URL actualisée ; rechargement et retour du navigateur restituent les filtres. Une ligne de comparaison sélectionne l’UC et garde le focus sur cette ligne. |
| Points forts / à retravailler | Avec assez de réponses, UC 03 apparaît à 88 % sur 96 exercices et UC 04 à 20 % sur 55. Les notions affichent leurs propres volumes, taux et observations. Seuils 5/80/60 explicités et configurables. |
| Chapitres et liens | Répartition par chapitre consultable ; liens issus des copies sauvegardées. Un identifiant de cours supprimé est écarté ; le lien Drill reste disponible. Des notions homonymes de deux UC restent séparées. |
| Banque indisponible | Interception réseau isolée : aucun chargement de la banque depuis le Dashboard, mêmes 151 résultats. Le Drill affiche encore la série sauvegardée (8/10, 7 correctes, 1 erreur, 88 %) et signale la banque indisponible. |
| Donnée partiellement invalide | Réponse rendue incohérente avec sa copie historique : exclue, bilan partiel signalé, autres réponses accessibles. Valeur brute inchangée après consultation. |
| Stockage illisible / bloqué | JSON malformé conservé tel quel, erreur explicite et absence de métriques interprétables comme des zéros. Simulation d’accès au stockage bloqué : état indisponible, sans réinitialisation. |
| Date future | Réponse postérieure à l’instant de calcul exclue avec avertissement ; aucun faux résultat ni suppression. |
| Semaines Paris | Frontières contrôlées : 29 mars 2026 21:59:59Z → W13, 22:00Z → W14 ; 18 octobre 21:59:59Z → W42, 22:00Z → W43 ; 25 octobre 22:59:59Z → W43, 23:00Z → W44 ; 3 janvier 2021 22:59:59Z → 2020-W53, 23:00Z → 2021-W01. |
| Graphiques au clavier | Focus sur une semaine, Tab vers la suivante : détails mis à jour avec volumes et taux. Entrée ouvre le tableau alternatif. Les erreurs sont hachurées ; les données ne reposent pas sur la seule couleur. |
| Clair, sombre, mobile | Inspection visuelle des états vides et remplis en clair/sombre sur ordinateur, puis des filtres, graphiques et tableaux sur mobile. Aucun débordement horizontal global à 320, 390, 760, 900, 1080, 1120, 1121, 1234, 1251 et 1440 px. Les graphiques/tableaux défilent localement. Les SVG gardent leur largeur intrinsèque et leurs textes ne sont pas comprimés sur mobile. |
| Navigation commune | Tableau de bord présent et actif dans l’en-tête. Inspection des seuils 1121/1251 px ; navigation défilante sur mobile, thème conservé entre pages. |
| Cours et QCM existants | Cours et état terminé accessibles ; QCM corrigé à 3/3. Le Dashboard reste à 151 réponses après cette tentative classique, sans double comptage. |
| Calendrier et bandeau | Octobre → novembre fonctionnel ; calendrier livré toujours vide. Examen UC 03 intercepté uniquement pour vérification : QCM de cours et Drill présentés séparément, indice toujours indicatif. |
| ITK et ressources | Génération ITK : sept opérations, commandes CSV/impression présentes. Recherche « sol » : 1 ressource sur 8, puis retour aux 8 après effacement. |

La syntaxe des cinq modules JavaScript créés ou modifiés a été vérifiée avec `node --check`, et `git diff --check` passe. Aucun événement `pageerror` pendant les parcours ordinaires ; l’échec réseau provoqué pour la banque était attendu.

## Fichiers et limites

- Ajouts : `tableau-de-bord.html`, `assets/dashboard-data.js`, `assets/dashboard-stats.js`, `assets/dashboard.js`, `assets/dashboard.css`, `DASHBOARD.md`, ce compte rendu.
- Modifications : `assets/app.js`, `assets/style.css`, `assets/drill-engine.js`, `README.md`.
- Banque, stockage Drill, contenus des cours, calendrier, statistiques d’examen et workflow de déploiement inchangés.
- La banque réelle reste limitée aux douze questions UC 03. Les autres UC et volumes du scénario long servent exclusivement à la vérification isolée.
- Les libellés de notions ne sont pas des identifiants stables. Les répétitions et petits volumes limitent l’interprétation ; aucune couverture complète de l’UC ni maîtrise scientifique n’est inférée.
- Le stockage reste local, sans synchronisation ; l’horloge de l’appareil détermine l’instant courant. Les dates futures exclues peuvent expliquer un écart avec le total brut du Drill, qui les accepte.
- Vérification dans Chromium et dimensions mobiles simulées, sans appareil physique ni audit complet de lecteur d’écran. Les commandes d’export/impression ITK ont été vérifiées présentes ; leur dialogue système n’a pas été ouvert.

Livraison par pull request de `feature/dashboard-uc` vers `main`. Aucune fusion ni publication en production sans validation de l’utilisateur.
