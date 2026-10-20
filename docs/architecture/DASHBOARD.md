# Tableau de bord pédagogique — Lot 3

## Périmètre et architecture

`tableau-de-bord.html` constitue le point d’entrée statique. La navigation et l’initialisation passent par `assets/app.js`, comme les autres pages. Tous les chemins restent relatifs pour fonctionner à la racine ou sous le chemin de dépôt GitHub Pages.

- `assets/drill-store.js` : `readDrillState()` lit et valide les copies historiques des séries, sans écriture.
- `assets/drill-engine.js` : règles existantes de comptabilisation et semaines ISO Europe/Paris, réutilisées par le Tableau de bord.
- `assets/dashboard-data.js` : `readDashboardData()` adapte en lecture seule l’état validé et normalisé par `readDrillState()` ; cette frontière pourra recevoir une autre source.
- `assets/dashboard-stats.js` : calculs purs des agrégats et préparation des séries temporelles à partir de cet état, séparés du DOM et du stockage ; la validation et la normalisation restent celles du lecteur Drill.
- `assets/dashboard.js` : filtres, rendu, interactions et alternatives tabulaires.
- `assets/dashboard.css` : graphiques et mise en page responsive en modes clair et sombre.

Cette séparation permet de remplacer ultérieurement la lecture locale par une source synchronisée, par exemple Supabase, en conservant les règles de calcul. Aucun service, compte, dépendance ou mécanisme de synchronisation n’est ajouté dans ce lot.

## Source des données et comptabilisation

La source exclusive est `bprea-demo-drill-v1`, lue par `readDrillState()` derrière l’adaptateur `readDashboardData()`. Les QCM classiques, les cours marqués comme terminés et l’indice du bandeau d’examen ne sont pas additionnés aux résultats du Tableau de bord.

Pour chaque série valide, la première réponse enregistrée dans `answers[questionId]` représente un exercice réalisé. Son identité est le couple **identifiant de série + identifiant de question**. Le Tableau de bord réutilise les résultats comptabilisés du moteur Drill ; les entrées `attempts`, les entraînements et les brouillons ne créent pas de réponses supplémentaires. La même question réutilisée dans une autre série représente une nouvelle occurrence hebdomadaire, sans être présentée comme une nouvelle question unique de la banque.

Une série incomplète contribue seulement à hauteur des réponses déjà validées. Commencer une série de dix questions et en valider une compte **un exercice**, sans attribuer neuf erreurs aux questions restantes. Les séries anciennes ne bloquent pas les nouvelles.

Le lecteur du Drill valide les réponses par rapport aux copies complètes des questions de chaque série. Il exclut les données illisibles et renvoie des avertissements ; la page les rend visibles sans effacer les valeurs originales. Si le stockage est bloqué ou illisible, un état explicite signale le problème. La banque courante n’est pas nécessaire pour consulter les résultats historiques.

Le calcul écarte aussi les réponses dont la date `answeredAt` est strictement postérieure à l’instant de calcul (`now`), y compris si leur semaine ISO est la semaine courante. Les réponses rattachées à une UC inconnue sont exclues. Ces exclusions et les avertissements de lecture apparaissent sous **« Bilan partiel »** ; aucune valeur source n’est modifiée. Une date future invite à vérifier l’horloge de l’appareil et ne devient comptabilisable qu’une fois l’instant correspondant atteint.

## Indicateurs et formules

| Indicateur | Calcul |
| --- | --- |
| Exercices réalisés | Nombre de premières réponses comptabilisées dans le périmètre. |
| Réponses correctes | Nombre de ces réponses dont `correct` vaut `true`. |
| Réponses incorrectes | Exercices réalisés − réponses correctes. |
| Taux de réussite | Réponses correctes / exercices réalisés × 100. |
| Semaines actives | Nombre de semaines ISO distinctes comportant au moins une réponse comptabilisée. |
| Résultats par UC ou notion | Mêmes calculs après regroupement des réponses correspondantes. |

Un taux sans réponse est **non calculable** (`null` dans les agrégats), et non égal à 0 %. Un taux de 0 % est un véritable résultat lorsque toutes les réponses réalisées sont incorrectes. Les volumes affichent zéro en l’absence de réponse, avec un état pédagogique. Aucun chiffre utilisateur n’est inventé.

Les calculs conservent leur précision ; seul l’affichage des pourcentages est arrondi. Les taux globaux sont pondérés par les volumes. Exemple fictif de calcul : 1 réussite sur 1 réponse dans une UC et 1 réussite sur 9 dans une autre donnent **2 / 10 = 20 %** au total, et non la moyenne de 100 % et de 11,1 %.

## Temps, périodes et historique

La date `answeredAt` de la première réponse détermine sa semaine d’activité. Le calcul réutilise la semaine ISO en **Europe/Paris** du moteur Drill, avec le lundi à 00 h comme frontière, y compris lors des changements d’heure et d’année ISO. Le fuseau configuré sur l’appareil ne change pas ce regroupement.

La semaine d’origine de la série (`series.week`) reste son identifiant historique ; elle n’impose pas la semaine d’activité de la réponse. Une réponse donnée cette semaine dans une ancienne série compte cette semaine dans les graphiques. Le Mode Drill regroupe ses listes par semaine de série ; pour une concordance globale, comparer les mêmes UC sur tout l’historique.

Les fenêtres de **4, 8 ou 12 dernières semaines** incluent la semaine courante et les 3, 7 ou 11 semaines précédentes. Le filtre UC restreint les indicateurs et séries détaillées ; la comparaison des UC affiche les UC sur la même période avec leurs volumes. L’historique complet va de la première activité fiable, toutes UC confondues, jusqu’à la semaine courante incluse. Changer d’UC conserve ainsi les bornes de l’axe temporel, même si l’UC choisie ne comporte aucune activité sur certaines semaines. Sans activité fiable, l’historique complet présente la semaine courante sans données.

Chaque semaine de la période est présente, même sans réponse. Son volume est zéro et son taux non calculable. La courbe est interrompue aux semaines sans données : aucun segment ne doit transformer ce manque en échec ou suggérer une performance mesurée pendant ce trou. Les graphiques sont paginés par fenêtres d’au plus **12 semaines** ; les boutons permettent de parcourir les semaines précédentes et suivantes. Les totaux, catégories descriptives et tableaux portent toujours sur toute la période sélectionnée, indépendamment de la fenêtre visible.

## Graphiques et lecture accessible

Le Tableau de bord présente le volume hebdomadaire (réussites, erreurs, total), le taux de réussite hebdomadaire et la comparaison des UC. Les pourcentages sont accompagnés du nombre de réponses ; les légendes et textes permettent de comprendre les résultats sans dépendre des couleurs. Les graphiques donnent des détails au survol et au clavier. L’alternative tabulaire conserve toutes les semaines de la période, y compris celles hors de la fenêtre graphique visible, ainsi que les résultats de chaque UC.

La page reprend le mode sombre existant et les styles communs. La navigation passe sur deux lignes lorsque la largeur manque, avec défilement horizontal sur petits écrans pour garder toutes les destinations accessibles.

## Points forts et notions à retravailler

Les notions sont regroupées par **UC, chapitre et libellé de notion** des copies historiques des questions. Une même notion nommée dans deux UC ou chapitres différents ne doit pas être fusionnée par accident. Les taux sont calculés sur les premières réponses comptabilisées appartenant à chaque groupe.

Les seuils sont réunis dans `DASHBOARD_THRESHOLDS`, dans `assets/dashboard-stats.js` :

| Paramètre | Valeur par défaut | Description |
| --- | --- | --- |
| `minimumResponses` | `5` | En dessous : « Données insuffisantes », quelle que soit la réussite. |
| `strongRate` | `80` | À partir de 80 %, et avec assez de réponses : point fort observé. |
| `reworkRate` | `60` | Sous 60 %, et avec assez de réponses : à retravailler. |

À 60 % et jusqu’à moins de 80 %, avec assez de réponses, le repère est « À consolider ». Ces catégories décrivent uniquement les réponses observées. Ce ne sont ni une évaluation scientifique des acquis réels ni une probabilité de réussite à l’examen. Elles ne produisent aucun niveau, badge, classement, trophée ou récompense.

Lorsque les copies de questions comportent une association `sourceLesson` exploitable, la page peut proposer le cours ou ses exercices. Sans association fiable, elle propose le Mode Drill au lieu d’inventer une destination pédagogique.

## Limites et préservation des données

- Le nombre de réponses, la couverture de la banque et les questions répétées limitent l’interprétation. Cinq observations ne garantissent pas la maîtrise d’une notion.
- Les résultats reflètent uniquement les exercices réalisés ; les notions jamais rencontrées ne peuvent pas être évaluées. La pratique et l’oral ne sont pas mesurés.
- Les copies des questions conservent les corrections et libellés historiques. Une correction ultérieure de la banque ne recalcule pas les réponses anciennes. Un renommage de chapitre ou de notion peut produire des groupes séparés ; aucune fusion sémantique n’est inventée.
- Les données sont propres à l’origine du site et au navigateur. Il n’existe pas de synchronisation entre appareils ni de sauvegarde distante.
- La page ne migre, ne purge et n’écrit aucune progression. Les clés de cours, QCM, ITK et thème restent indépendantes.
- Aucun jeu de démonstration n’est injecté dans la progression réelle ou publié comme résultat utilisateur.

## Vérification et livraison

Les parcours vérifiés, les données de vérification isolées et les limites du lot 3 sont consignés dans [VALIDATION-LOT3.md](../validations/VALIDATION-LOT3.md). Ce lot n’ajoutait pas de suite automatisée ; le lot 5.1 introduit les contrôles décrits dans [../TESTS.md](../TESTS.md). Les observations historiques correspondent à la branche `feature/dashboard-uc`. Fusion et déploiement en production nécessitent la validation de l’utilisateur.
