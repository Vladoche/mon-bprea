# Projet de procédure — demandes de droits et incidents

**DOCUMENT DE TRAVAIL NON VALIDÉ — 28 octobre 2026.** Aucun canal officiel, opérateur habilité, calendrier de conservation ou contrat n'est créé par ce texte. [D01/D04/D07/D08/D13](DECISIONS-A-VALIDER.md) doivent être résolues ; [portes de préouverture](DOSSIER-PREOUVERTURE.md). Les fonctions ci-dessous sont à désigner. Les dossiers réels doivent rester hors dépôt public, dans un espace restreint.

**Actualisation 6.5.1, méthode [A–F](CADRAGE-MON-BPREA-SIX-ADULTES.md).** B : projet personnel indépendant, six adultes maximum, usage facultatif, résultats privés, fin prévue juin 2027. D : l'exploitant peut cumuler réception, décision et opération habilitée ; une éventuelle aide doit être expressément autorisée, aucun rôle enseignant ou DPO présumé. Une adresse dédiée peut suffire ; E/F : canal réel, propriétaire, protection, disponibilité/fréquence de consultation, récupération et besoin de suppléance à confirmer et tester avant invitation. Ne pas publier de coordonnées privées. Le [plan léger](PLAN-EXPLOITATION-LEGERE.md) recommande une clôture assistée contrôlée avec export/retrait local autonome, sans décision acquise ni service hébergé activé. Les étapes ci-dessous sont des recommandations D ; les références légales sont C, sous réserve de l'[applicabilité](ANALYSE-EXCEPTION-PERSONNELLE-PROJET.md).

## Réception et qualification des demandes

| Étape proposée | Action, contrôle et trace minimale | Décision / fonction à désigner |
| --- | --- | --- |
| 1. Recevoir | Canal accessible sans compte et sans dépendre du bouton d'export. Accusé de réception, identifiant interne de demande, date de réception, nature et moyen de réponse autorisé. Ne pas recopier le contenu pédagogique. | D04 : référent droits et suppléant ; canal à tester avant ouverture |
| 2. Vérifier proportionnellement | Rechercher les doutes raisonnables sur l'identité, utiliser les éléments pertinents déjà disponibles et un canal sûr ; pas de pièce d'identité systématique. Ne demander ni mot de passe, ni JWT, ni lien de récupération. Conserver seulement le résultat nécessaire du contrôle. | Responsable/référent droits, critères et éventuelle escalade à valider |
| 3. Définir la portée | Identifier environnement/UUID après vérification, droit invoqué et données demandées. Distinguer compte, visiteur d'un appareil partagé, autres appareils, données détenues par prestataires et données tierces dans `raw`. Une personne sans compte actif doit pouvoir poursuivre sa demande. | D04/D08 ; ne pas choisir un UUID depuis une URL non fiable |
| 4. Qualifier | Vérifier conditions/éventuelles exceptions du droit avec le responsable, sans assimiler accès/copie et portabilité. Rectification, limitation et opposition ne se résument pas à supprimer le compte. Traiter les historiques immuables par intervention dédiée autorisée, sans falsifier un résultat. | Responsable, DPO/conseil si pertinent ; aucune base légale approuvée ici |
| 5. Rechercher | Utiliser l'inventaire A01–X10 et les dix tables ; compléter la copie technique par Auth interne, bruts exclus, marqueurs, logs et backups lorsque pertinents et accessibles. Limiter l'accès aux opérateurs nécessaires et demander les informations fournisseurs par canal de confiance. | Référent droits + opérateurs habilités, D05/D06 |
| 6. Exécuter avec preuve | Nouvelle vérification de cible, revue de l'action destructive, résultat par couche. Distinguer réalisé, non confirmé, impossible et en attente ; conserver références/stades/comptages minimaux, jamais l'export complet ou les réponses effacées comme preuve. | D08/D13 ; aucune exécution hébergée autorisée par ce projet |
| 7. Répondre | Remise sûre au destinataire vérifié, limites/exclusions et motifs explicités ; pas d'envoi d'un export à une adresse/URL fournie sans vérification. Confirmer séparément données actives et copies résiduelles. Informer les destinataires pertinents selon les conditions de l'art. 19. | Référent droits et responsable ; modalité de remise à valider |
| 8. Clore et revoir | Date/réponse, périmètre réalisé, exceptions motivées, reste à faire et échéance de suivi. Durée du dossier et des preuves d'identité à décider selon finalité, accès restreint et réexamen ; aucun registre perpétuel. | D07/D08 : responsable de conservation à désigner |

**Délais légaux à intégrer au circuit, sans les transformer en durée de conservation :** l'article 12 prévoit une réponse dans le mois de réception ; une prolongation pouvant aller jusqu'à deux mois supplémentaires dépend de la complexité/nombre, avec information motivée dans le premier mois. Un refus exige aussi une réponse motivée et l'indication des recours. Ces règles et la vérification en cas de doute raisonnable sont relues sur [CNIL — RGPD chapitre III](https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre3), le 28/10/2026. [Guide CNIL sur l'accès](https://www.cnil.fr/fr/repondre-une-demande-de-droit-dacces). Le référent devra calculer le calendrier applicable, surveiller les échéances et escalader ; aucun SLA opérationnel n'est réputé déjà tenu.

## Effacement, sauvegardes et appareils absents

Une copie téléchargée reste au destinataire. L'effacement local du profil n'efface pas le serveur ; la clôture éphémère ne nettoie pas automatiquement les caches. Un compte supprimé ne peut plus autoriser un nettoyage personnel par simple ancien UUID. Prévoir une assistance vérifiant le contrôle légitime du profil navigateur, les données des tiers et les autres comptes, sans effacement global improvisé. La barrière UUID reste une donnée personnelle technique et nécessite sa propre décision de durée/retrait.

Une restauration doit rester isolée, avec accès et synchronisation suspendus. Le responsable doit définir une source fiable et minimisée des décisions d'effacement postérieures au point restauré, leur réapplication et la vérification Auth/dix tables avant remise en service. Backups/PITR, logs et boîtes e-mail ont leurs propres responsables, contrats, délais et limites. Aucun de ces mécanismes opérationnels n'est implémenté ou validé par le prototype local.

## Checklist opérationnelle avant activation

Chaque ligne attend un opérateur autorisé, une décision et une vérification de cible/résultat, une preuve interne datée et une conclusion. L'exploitant peut accomplir ces étapes successives lui-même ; deux personnes ne sont pas exigées par principe à six utilisateurs. Si indisponible, prévoir une aide habilitée ou un arrêt sûr avec information, plutôt qu'un partage de secrets. Aucun nom d'administrateur, secret, détail de récupération ou liste d'habilitations n'est à publier dans Git.

| Objet | Vérifiable dans Git / recette éphémère | À vérifier dans les réglages/pratiques réels, actuellement non vérifié |
| --- | --- | --- |
| GitHub | PR requise et trois checks relus via ruleset ; workflows sans déploiement sur PR | Propriétaires/collaborateurs, moindre privilège, authentification forte, récupération et départ d'un opérateur |
| Supabase | RLS/grants/FK versionnés, clients publics/admin séparés | Membres par projet, rôles admin, authentification forte, accès support, revue périodique et journal d'accès |
| Comptes opérateurs | Aucun rôle admin étudiant introduit | Comptes nominatifs autorisés, absence de partage, suppléance et procédure d'accès d'urgence |
| Secrets | Ignore des `.env`, Pages limité aux clés publishable, aucun secret admin dans le frontend | Stockage en gestionnaire, rotation/révocation, accès minimaux et historique d'exposition ; ne pas ouvrir les secrets pour remplir ce dossier |
| Invitations | API native de confiance, signup/anonyme désactivés dans la stack dédiée | Qui décide/invite, source d'adresse, contrôle du destinataire, information préalable et traitement d'une erreur |
| SMTP | Capture locale seulement, modèles versionnés | Fournisseur/contrat, domaine, suivi de liens désactivé, habilitations, rétention, délivrabilité et incident |
| Revues d'habilitations | Aucun inventaire privé suivi dans Git | Fréquence motivée, entrée/sortie, revue après incident, preuve minimale et retrait effectif |
| Backups et restauration | Cascades SQL testables, pas d'exécuteur de purge | Plan/PITR/lieux, accès, délais, restauration isolée, réapplication d'effacements et décision de retour |
| Demandes de droits | Copie partielle et retrait local ; limites affichées | Canal fonctionnel, suppléance, vérification, remise sécurisée, suivi et exercice avec/sans compte |
| Incidents | Aucun log nominatif ajouté par la clôture, tests de panne | Canal d'alerte, décideur, qualification, fournisseurs, notifications et registre restreint |

## Gestion d'un incident ou d'une violation possible

1. Recevoir l'alerte par un canal à désigner, dater les faits et la prise de connaissance, préserver seulement les éléments nécessaires dans un espace restreint. Séparer panne, défaut de sécurité et éventuelle atteinte à la confidentialité/intégrité/disponibilité de données personnelles.
2. Contenir de façon proportionnée : arrêter la fonction ou l'accès concernés, protéger les sessions/secrets exposés, contacter les opérateurs/prestataires autorisés. Ne pas purger des logs ou réinitialiser une base comme réponse réflexe ; ne pas propager un lien sensible dans une PR.
3. Qualifier avec le responsable : nature, catégories/volume approximatif, personnes potentiellement concernées, conséquences et mesures. Documenter ce qui est connu/inconnu, l'évaluation des risques pour les personnes, l'auteur de la décision et sa justification.
4. Décider les notifications applicables. L'art. 33 prévoit, sauf absence de risque pour les droits/libertés, la notification à l'autorité compétente dans les meilleurs délais et si possible sous 72 h après connaissance, avec motifs d'un retard et possibilité de compléter. Le sous-traitant alerte le responsable sans délai indu. L'art. 34 concerne l'information des personnes si risque élevé, sous ses conditions/exceptions ; ne pas annoncer notification ou dispense automatique. Source relue le 28/10/2026 : [RGPD, art. 33–34 sur CNIL](https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre4).
5. Corriger, vérifier en contexte isolé, statuer sur la reprise et informer par canaux autorisés. Documenter les violations et mesures dans un registre interne proportionné, avec durée/accès à décider ; revoir habilitations, notice, risques et contrats si nécessaire. Aucun message ni notification réelle n'est envoyé par ce lot.

## Exercice fictif préparé — aucune sollicitation réelle

**Support de simulation uniquement.** Hypothèse : une invitation fictive serait adressée au mauvais destinataire, puis une URL synthétique apparaîtrait dans un journal fictif. Aucun compte, e-mail ou journal hébergé n'est créé/modifié. Le déroulé ci-dessous est une trame de réunion, pas la preuve qu'une équipe a été formée ou qu'un délai réel a été tenu.

| Temps fictif / injection | Décision attendue / preuve d'exercice à produire |
| --- | --- |
| T0 — alerte d'un mauvais destinataire | Ouvrir un dossier fictif, identifier le référent et sa suppléance, séparer détection et connaissance ; constater les fonctions encore non désignées |
| T+15 min — lien potentiellement consommé, information incomplète | Déterminer capacités du lien, compte et données accessibles, contenir par opérateur habilité ; ne pas demander au destinataire de renvoyer le lien |
| T+45 min — perte d'accès au prestataire | Activer le canal fournisseur et la suppléance ; conserver le risque en cours, sans transformer l'absence de preuve en absence d'incident |
| T+2 h — données pédagogiques potentiellement visibles | Préparer qualification, risque pour la personne, projet de notification/communication conditionnel et décision motivée ; aucun envoi |
| T+24 h — sauvegarde antérieure disponible | Décrire restauration isolée, réapplication des décisions d'effacement et critères de reprise ; vérifier qu'un retour arrière ne ressuscite pas de compte |
| Fin — revue | Lister les manques, responsables/actions/échéances, tester le canal sur données fictives lors d'une intervention autorisée ; validation D04/D08/D13 encore requise |

Critères de réussite future : alerte reçue par le bon rôle, cible vérifiée, mesures proportionnées, décision tracée dans les délais applicables, absence de fuite supplémentaire, reprise contrôlée et demande de droits traitable. Tant que rôles/canaux manquent, cette préparation reste **PRÉPARÉE MAIS NON ACTIVÉE**, avec blocage P0.
