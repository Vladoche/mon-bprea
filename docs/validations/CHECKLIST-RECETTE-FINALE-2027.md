# Checklist de recette finale Mon BPREA 2027

Ouvrir une campagne après revue et fusion du [lot d’harmonisation](VALIDATION-UI-2027-PR5-LOT2.md). Renseigner le SHA de `main`, la date, l’environnement, les navigateurs et les personnes qui réalisent la recette. Utiliser des comptes fictifs et isolés pour les essais Auth et données. Conserver les captures et résultats utiles sans identifiants privés ni liens personnels.

Pour chaque ligne, choisir **Non commencé**, **Réussi**, **Échoué**, **Bloqué** ou **Sans objet justifié**. Renseigner la preuve, le SHA et la cause d’un échec, d’un blocage ou d’une exclusion. Consigner séparément les résultats sur l’artefact local et ceux du site hébergé.

## Artefact local candidat

| Contrôle | Résultat attendu | État | Preuve ou cause |
| --- | --- | --- | --- |
| Référence | SHA de fusion et quatre checks vérifiés sur la version retenue. Écarts avec la version servie et réserves du lot relus. | Non commencé | |
| Navigation | Accueil, Mes cours, S’exercer, Outils et Profil atteignables. Menus ouverts au clavier et au tactile, destinations actives, fil d’Ariane, retour navigateur et focus au retour. | Non commencé | |
| Responsive | 320, 390, 768, 1 024 et 1 440 px, puis zoom 200 % et 400 % sur les parcours représentatifs. Titres complets, tableaux lisibles et dialogues fermables. | Non commencé | |
| Apparence | Quatre saisons, clair, sombre et automatique aux seuils horaires. Persistance visiteur après navigation, puis sauvegarde du compte. Contraste forcé et mouvement réduit contrôlés. | Non commencé | |
| Accessibilité | Ordre de tabulation, focus visible, noms accessibles, libellés, messages et boutons désactivés. Vérifier aussi les états de chargement, les dialogues et le retour du focus avec les aides techniques retenues. | Non commencé | |
| UC et cours | Lecture, sommaire, tableaux, ressources associées et progression conservée après navigation et rechargement. | Non commencé | |
| QCM, Drill et statistiques | Répondre, consulter la correction et l’historique. Vérifier semaine, filtres, taux, valeurs graphiques et reprise sur un historique fictif connu. | Non commencé | |
| Calendrier | Tester mois précédent, suivant, aujourd’hui, saisie native et bornes. Sur fixture, vérifier agenda, détail, exemple fictif, lien UC et réessai. Sur données officielles, afficher l’état réellement disponible. | Non commencé | |
| ITK | Comparer un jeu d’entrées connu, chronologie, export CSV et aperçu d’impression. Vérifier les règles de validation et le réaffichage des réglages. | Non commencé | |
| Ressources | Recherche, filtres, état vide, PDF et retour. Vérifier les ressources indisponibles et le réessai. | Non commencé | |
| Botanique | Découverte, Chrono, choix, correction, historique et crédits. Vérifier le cadrage des photos portrait et paysage puis une photo indisponible. | Non commencé | |
| Activation et récupération | Avec deux identités fictives, exercice du lien valide, expiré et réutilisé, nettoyage de l’URL, mot de passe et récupération assistée. | Non commencé | |
| Compte et profil | Connexion, pseudo, préférences, suivi et déconnexion. Vérifier les liens Contact et Confidentialité et la cohérence de la notice approuvée avec les parcours affichés, notamment l’accès aux copies de données après PR5 lot 1. | Non commencé | |
| Deux navigateurs | Une progression et des historiques fictifs sauvegardés dans A se relisent dans le deuxième navigateur connecté à A. | Non commencé | |
| Hors ligne, retour réseau et conflits | Envoyer une modification hors ligne, vérifier le statut et la file d’attente, rétablir le réseau, contrôler une seule écriture et résoudre explicitement un conflit. Relire les données des deux côtés. | Non commencé | |
| Changement de compte A/B | Pendant une lecture ou une sauvegarde retardée, changer de compte puis revenir via l’historique navigateur. Vérifier cache, données visibles, opérations en attente et historiques isolés par compte. | Non commencé | |
| Artefact Pages | Tester sous `/mon-bprea/` les entrées directes, liens relatifs, ancres, imports, PDF, callback et rechargement. Vérifier la version des ressources, la notice générée et l’exclusion des fichiers privés. | Non commencé | |

## Décision, publication et vérification hébergée

Suivre le [registre Pages et la procédure de publication](../deploiement/EXPLOITATION-PRIVEE-SIX-ADULTES.md#registre-de-publication-pages) et le [contrat de versionnement du cache](../architecture/CACHE.md).

| Contrôle | Résultat attendu | État | Preuve ou cause |
| --- | --- | --- | --- |
| Décision de publication | Exploitant, date, SHA exact et empreinte LF du texte approuvé. Statut explicite des réserves de recette avant le lancement manuel. | Non commencé | |
| Paramètres publics Auth | La validation dédiée du workflow confirme la cible, les URL, la clé publishable, l’origine Pages et le callback exact. Contrôler l’inscription sur invitation et les connexions anonymes selon le runbook. | Non commencé | |
| Repli | Relever le dernier SHA publié et la procédure de retour, testée sur un artefact local. Identifier les paramètres publics/empreintes attendus et la décision nécessaire pour republier une version de repli. | Non commencé | |
| Workflow Pages | Enregistrer exécution, conclusion, artefact et SHA effectivement servis. | Non commencé | |
| Vérification hébergée | Contrôler les routes publiques, le préfixe Pages, le cache en contexte neuf et avec un ancien onglet, les ressources, le contact et la notice. Qualifier séparément l’Auth et les données avec le périmètre approuvé. | Non commencé | |
| Clôture de la campagne | Reporter les preuves, réserves et dates réelles dans le registre et l’état du projet. Inscrire la décision distincte concernant l’accueil des participants. | Non commencé | |
