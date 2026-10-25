# Tableau de bord pédagogique — Lots 3 et 6.2.3

## Périmètre et architecture

`tableau-de-bord.html` constitue le point d’entrée statique. La navigation et l’initialisation passent par `assets/app.js`, comme les autres pages. Tous les chemins restent relatifs pour fonctionner à la racine ou sous le chemin de dépôt GitHub Pages.

- `assets/drill-store.js` : `readDrillState()` lit et valide les copies historiques des séries, sans écriture.
- `assets/drill-engine.js` : règles existantes de comptabilisation et semaines ISO Europe/Paris, réutilisées par le Tableau de bord.
- `assets/dashboard-data.js` : `readDashboardData(snapshot)` sélectionne en lecture seule la source visiteur ou la vue personnelle déjà normalisée par le service Drill. Son descripteur `source` distingue disponibilité, identité, chargement, attente et conflits.
- `assets/dashboard-stats.js` : calculs purs des agrégats et préparation des séries temporelles à partir de cet état, séparés du DOM et du stockage ; la validation et la normalisation restent celles du lecteur Drill.
- `assets/dashboard.js` : initialisation asynchrone, abonnement au service Drill, filtres, rendu, interactions et alternatives tabulaires.
- `assets/dashboard.css` : graphiques et mise en page responsive en modes clair et sombre.

Le lot 6.2.3 raccorde cette frontière au service du [lot 6.2.2](DRILL-SYNCHRONISATION-CLIENT.md), en conservant `createDashboardModel()` et les règles de calcul du lot 3. Un seul service Drill est créé pour la page ; le Dashboard ne crée ni client Supabase, ni transport, ni lecteur IndexedDB supplémentaire. Aucune dépendance de production n’est ajoutée.

## Source des données et comptabilisation

En visiteur, la source reste `bprea-demo-drill-v1`, lue par `readDrillState()` derrière l’adaptateur `readDashboardData()`. Cette clé et son contenu sont préservés ; aucune connexion n’est nécessaire et aucun historique visiteur n’est importé automatiquement dans un compte.

Pour un compte identifié, la source exclusive est `getDrillSyncService().getState().view`, qui contient `{series,error,warnings}` pour l’espace personnel courant. Le service reste responsable de la validation, de la réconciliation, du cache et des opérations en attente. Un appel sans snapshot conserve le contrat visiteur des autres lecteurs du site ; un snapshot explicitement inaccessible ne revient jamais aux statistiques visiteur.

Les QCM classiques, les cours marqués comme terminés et l’indice du bandeau d’examen ne sont pas additionnés aux résultats du Tableau de bord.

Pour chaque série valide, la première réponse enregistrée dans `answers[questionId]` représente un exercice réalisé. Son identité est le couple **identifiant de série + identifiant de question**. Le Tableau de bord réutilise les résultats comptabilisés du moteur Drill ; les entrées `attempts`, les entraînements et les brouillons ne créent pas de réponses supplémentaires. La même question réutilisée dans une autre série représente une nouvelle occurrence hebdomadaire, sans être présentée comme une nouvelle question unique de la banque.

Une série incomplète contribue seulement à hauteur des réponses déjà validées. Commencer une série de dix questions et en valider une compte **un exercice**, sans attribuer neuf erreurs aux questions restantes. Les séries anciennes ne bloquent pas les nouvelles.

Le lecteur du Drill valide les réponses par rapport aux copies complètes des questions de chaque série. Il exclut les données illisibles et renvoie des avertissements ; la page les rend visibles sans effacer les valeurs originales. Si le stockage est bloqué ou illisible, un état explicite signale le problème. La banque courante n’est pas nécessaire pour consulter les résultats historiques.

Le calcul écarte aussi les réponses dont la date `answeredAt` est strictement postérieure à l’instant de calcul (`now`), y compris si leur semaine ISO est la semaine courante. Les réponses rattachées à une UC inconnue sont exclues. Ces exclusions et les avertissements de lecture apparaissent sous **« Bilan partiel »** ; aucune valeur source n’est modifiée. Une date future invite à vérifier l’horloge de l’appareil et ne devient comptabilisable qu’une fois l’instant correspondant atteint.

## Synchronisation, attente et confidentialité

Le rendu attend d’abord la détermination de la source. Il s’abonne ensuite aux snapshots du service : une réponse locale validée, une confirmation distante ou une réconciliation recalcule les résultats disponibles. Les premières réponses personnelles en attente sont comptabilisées avec leur identité série/question ; leur confirmation ne crée pas un deuxième exercice. Les entraînements et les archives de conflits ne sont jamais additionnés aux premières réponses retenues.

| État | Comportement du Dashboard |
| --- | --- |
| Visiteur | Historique local et mention explicite de sa portée ; aucun envoi ni import automatique. |
| Chargement | Message d’attente, sans statistiques personnelles provisoires. |
| Personnel local, en attente ou en cours de synchronisation | Vue personnelle disponible et nombre d’éléments en attente ; aucune promesse de disponibilité sur un autre appareil avant confirmation. |
| Synchronisé | Vue confirmée à la dernière synchronisation ; invitation à actualiser pour rechercher une activité d’un autre appareil. |
| Hors ligne ou erreur de synchronisation | Cache du compte reconnu conservé à l’écran lorsqu’il est lisible ; indication que l’historique peut être incomplet. |
| Conflit | Une seule vue réconciliée alimente les statistiques ; avertissement et lien vers la résolution dans les exercices hebdomadaires. |
| Cache inaccessible | Erreur explicite, sans remplacer l’échec par des totaux nuls. |
| Identité incertaine, session rejetée ou vérification requise | Historique personnel masqué et lien de connexion ; aucune donnée d’une identité précédente affichée. |

Un cache personnel vide pendant une récupération incomplète affiche **« Historique personnel encore incomplet »**. Il n’est pas assimilé à un compte sans activité. Seule une vue accessible et synchronisée sans réponse donne l’état pédagogique vide avec taux non calculable.

La consultation hors ligne repose sur les garanties d’identité du service Auth partagé : session locale correspondant au marqueur d’un compte déjà vérifié et au bon espace environnement/projet/UUID. Un échec réseau ne vérifie pas à lui seul une identité. Un rejet explicite masque les données ; une déconnexion préserve le cache et l’outbox, sans afficher les résultats du compte déconnecté. Les requêtes tardives sont invalidées par les générations du service. Le renderer efface immédiatement le DOM privé lors d’un changement d’identité et ignore les retours d’actualisation devenus obsolètes.

Le cache IndexedDB n’est pas chiffré. Le masquage de l’interface ne protège pas contre une personne contrôlant le profil du navigateur, une extension ou une faille XSS ; les garanties d’accès distant restent celles de JWT/RLS. Le Dashboard n’affiche pas les identifiants techniques du cache. Les limites d’appareil partagé et d’accès hors ligne restent celles du [guide client](DRILL-SYNCHRONISATION-CLIENT.md#identité-déconnexion-et-cache-hors-ligne).

## Actualisation et continuité des interactions

**« Actualiser les données »** appelle réellement `service.retry()`, qui force une relecture distante et permet la reprise des opérations éligibles déjà enregistrées. Le Dashboard ne modifie aucune réponse et ne résout aucun conflit ; le service peut confirmer et réconcilier les opérations existantes. Une erreur laisse un message et permet un nouvel essai sans effacer le cache.

Le service relit à l’ouverture, au retour réseau, au retry manuel et au retour sur la page lorsque le dernier scan date d’au moins une minute. Il n’ajoute pas de diffusion temps réel Supabase. L’activité d’un deuxième appareil devient visible après cette relecture. Les filtres et le recalcul statistique par minute ne déclenchent pas de scan supplémentaire.

Dans la même identité, les mises à jour conservent les filtres et leurs paramètres d’URL, la fenêtre graphique consultée, les tableaux dépliés, le défilement horizontal et le focus encore applicable. Un changement de statut seul ne remplace pas les graphiques. Un changement d’identité retire les anciennes vues avant de calculer les nouvelles ; le retour par le cache de navigation recharge la page pour revérifier le compte.

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
- L’historique visiteur est propre à l’origine du site et au navigateur. Seul l’espace personnel configuré utilise la synchronisation existante ; les opérations en attente ne sont pas garanties sur un autre appareil.
- La page ne migre ni ne purge la progression et ne crée aucune nouvelle réponse. Les clés de cours, QCM, ITK et thème restent indépendantes.
- Les pages, modules et configuration doivent rester accessibles pour ouvrir le site ; aucun service worker ou cache intégral du site n’est ajouté.
- Aucun jeu de démonstration n’est injecté dans la progression réelle ou publié comme résultat utilisateur.

## Vérification et livraison

Les parcours vérifiés, les données de vérification isolées et les limites historiques du lot 3 sont consignés dans [VALIDATION-LOT3.md](../validations/VALIDATION-LOT3.md). Ce lot n’ajoutait pas de suite automatisée ; le lot 5.1 introduit les contrôles décrits dans [../TESTS.md](../TESTS.md). Les observations historiques correspondent à la branche `feature/dashboard-uc`.

La reprise du lot 6.2.3, ses tests de sélection et d’isolation, ses parcours navigateur et les résultats effectivement exécutés figurent dans [VALIDATION-LOT6-2-3.md](../validations/VALIDATION-LOT6-2-3.md). Les tests simulés du client et l’inspection visuelle ne constituent pas une preuve Auth/PostgreSQL/RLS ; cette dernière exige la stack Supabase locale dédiée. Le défaut `assets/auth-config.json` reste désactivé. Fusion et déploiement en production nécessitent la validation de l’utilisateur.
