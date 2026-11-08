# Procédure — demandes de droits et incidents

**Actualisation du 8 novembre 2026 : circuit opérateur qualifié sur données fictives isolées ; aucune demande réelle reçue ou suppression PROD exécutée dans ce chantier.** Sept comptes adultes confirmés, exploitant et six autres participants, facultatif/indépendant/gratuit/non commercial, résultats privés. Fermeture 30/06/2027, préavis/export 31/05, suppression active au plus tard 30/07. [Suivi D01–D14](DECISIONS-A-VALIDER.md), [procédures opérateur courantes](../deploiement/EXPLOITATION-PRIVEE-SIX-ADULTES.md), [durées résiduelles approuvées](POLITIQUE-CONSERVATION-PROJET.md).

Vladimir Fouillade, responsable du traitement identifié dans la notice publiée, assure seul réception, décision et intervention autorisée ; aucun rôle institutionnel ni suppléant admin ajouté. En son absence, suspendre les nouvelles invitations/interventions, garder les données et reprendre par le contact connu ; une aide exceptionnelle exige une habilitation distincte, pas de partage de secrets. Le contact officiel est vladimir.fouillade@hotmail.fr, expressément autorisé pour publication ; la [page publique](../../contact.html) fonctionne sans compte ni JavaScript. Les attestations de propriété/protection/MFA/récupération, réception extérieure/réponse et consultation du 05/11 sont réutilisées dans leur périmètre P0-04 ; accès public relu le 08/11, aucun courriel supplémentaire envoyé. La [procédure courte](../deploiement/EXPLOITATION-PRIVEE-SIX-ADULTES.md#vérifier-la-boîte-microsoft--à-faire-par-lexploitant) sert à leur renouvellement, sans inventer de nouvelles dates dans un ancien dossier modèle. Dossiers réels privés hors Git. Ce texte n'autorise aucune opération hébergée.

## Circuit courant à suivre pour chaque demande

1. Recevoir par le contact public, même sans accès au compte. Créer une référence privée, dater la réception et inscrire l'échéance de réponse à un mois ; suivre quotidiennement les demandes en cours lors de la consultation de la boîte.
2. Accuser réception sur le canal approprié, sans données sensibles : « Demande reçue le DATE, référence RÉFÉRENCE. Je vais préciser sa portée et vous répondre dans le délai applicable. Ne transmettez aucun secret de connexion. » Aucun envoi dans l'exercice.
3. Vérifier l'identité proportionnellement selon la grille ci-dessous ; noter méthode, date, résultat et doute éventuel, sans conserver les secrets ni une copie de justificatif inutile.
4. Identifier le droit effectivement exercé et clarifier une demande ambiguë ; ne pas imposer la clôture pour obtenir assistance ou accès.
5. Fixer le périmètre : environnement/projet/UUID vérifiés, catégories, période, appareils et copies ; séparer tiers et visiteur. La référence du dossier relie l'identité privée à l'UUID, jamais une URL transmise seule.
6. Motiver la décision : conditions du droit, exceptions éventuelles, données minimales encore nécessaires, durée et réexamen. En cas de doute juridique non résolu, rechercher un conseil approprié et répondre dans les délais ; aucune exception générale présumée.
7. Rechercher les données avec l'[inventaire](INVENTAIRE-DONNEES.md) : dix tables, Auth, métadonnées de coordination, bruts exclus de l'export, échanges et copies fournisseurs pertinents. Ne consulter que la cible et les champs nécessaires sous habilitation adaptée.
8. Préparer l'action et proposer l'export si pertinent. Si demandé, vérifier disponibilité, couverture et remise sûre avant l'effacement ; `exportOffered:true` ne prouve pas que l'export demandé a été préparé/remis. Une copie technique JSON partielle ne satisfait pas seule le droit d'accès.
9. Pour une clôture, relire le journal d'effacements et les copies concernées, constituer l'inventaire de moins de cinq minutes et le préflight privé décrits au [guide opérateur](../deploiement/EXPLOITATION-PRIVEE-SIX-ADULTES.md#clôture-assistée--opération-future-autorisée).
10. Obtenir une confirmation individuelle de l'action irréversible et une autorisation explicite désignant projet, UUID et portée ; vérifier l'habilitation administrative actuelle. Un préflight réussi ne vaut pas autorisation.
11. Exécuter seulement l'action justifiée et autorisée. Clôture : suppression native définitive de ce seul utilisateur via Dashboard Auth ou API administrative qualifiée ; aucune suppression SQL improvisée, commande collective ou nouvelle fonction PROD.
12. Contrôler le résultat réel : Auth, dix comptages cibles, dépendances, témoin minimal non nominatif, refresh et fenêtre JWT ; distinguer confirmé, incertain et en attente. Réponse perdue ou échec ⇒ arrêt, lecture d'état et aucune répétition destructive aveugle.
13. Répondre au destinataire vérifié, avec mesures prises, limites, motifs d'un refus/exception et voies de recours applicables ; examiner l'information des destinataires selon l'article 19. Ne pas envoyer un export à une adresse nouvelle non vérifiée.
14. Suivre séparément caches/appareils absents, téléchargements et copies de sauvegarde/fournisseur, action restante, échéance et revue. Une clôture serveur ne signifie pas disparition instantanée de toutes les copies.
15. Clore le dossier quand les actions/réponse sont confirmées et le suivi résiduel confié au journal minimal ; dossier ordinaire conservé 30 jours après clôture, journal jusqu'au retrait vérifié de la dernière copie concernée puis 30 jours, selon la politique approuvée. Une exception exige motif, accès restreint et réexamen.

### Identifier le droit et vérifier l'identité

| Situation | Décision opérateur |
| --- | --- |
| A — Accès / export | Répondre sur les données et informations de l'article 15 ; compléter la couverture de l'export technique et protéger les droits des tiers. Distinguer une demande de portabilité, avec ses conditions propres. |
| B — Rectification | Identifier la donnée inexacte et la correction justifiée ; intervention ciblée autorisée si l'interface ne le permet pas. Ne pas falsifier les historiques pédagogiques immuables ni supprimer automatiquement le compte. |
| C — Effacement / clôture | Qualifier motifs et exceptions de l'article 17, offrir l'export puis suivre le préflight, la suppression native et les résidus. |
| D — Opposition / limitation | Examiner respectivement les conditions des articles 21/18 et la base du traitement ; restriction ciblée à définir et autoriser si justifiée. Le dépôt n'a pas de bouton général de limitation : ne pas promettre une restriction technique inexistante ni déclencher une suppression de substitution. |
| E — Compte inaccessible | Poursuivre le même circuit par contact public ; la récupération de connexion n'est pas un préalable obligatoire à l'exercice des droits. |

| Origine / niveau de confiance | Contrôle proportionné |
| --- | --- |
| Utilisateur connecté | Identité serveur fraîchement vérifiée et confirmation par le titulaire ; ne pas traiter une simple capture ou un UUID déclaré comme preuve. |
| Adresse déjà connue | Vérifier la concordance avec le dossier/compte par lecture habilitée ; confirmer l'intention sur ce canal si nécessaire, sans justificatif supplémentaire si l'identité est raisonnablement certaine. |
| Adresse nouvelle | Ne pas modifier le destinataire ni livrer de copie immédiatement ; confirmer par un canal connu et approprié. |
| Ancienne adresse / accès perdus | Chercher des éléments déjà détenus et un autre canal fiable avec la personne ; ne pas demander ses réponses pédagogiques complètes. Si doute raisonnable persistant, demander uniquement l'information supplémentaire nécessaire et justifier ce besoin. |
| Demande suspecte ou contradictoire | Suspendre l'action irréversible et la remise de données, tracer le doute, recontacter par un canal connu ; qualifier un incident si nécessaire et expliquer la suite dans le délai applicable. |

Ne jamais demander par défaut mot de passe, JWT, lien de récupération, code MFA ou pièce d'identité. Une pièce n'est envisageable qu'en cas de doute raisonnable et si nécessaire/proportionnée ; en minimiser les champs et la conservation, ne pas en créer de copie durable par commodité. Le dossier conserve le résultat et la méthode, pas un justificatif systématique.

## Délais de réponse

**Délais légaux à intégrer au circuit, sans les transformer en durée de conservation :** l'article 12 prévoit une réponse dans le mois de réception ; une prolongation pouvant aller jusqu'à deux mois supplémentaires dépend de la complexité/nombre, avec information motivée dans le premier mois. Un refus exige aussi une réponse motivée et l'indication des recours. Ces règles et la vérification en cas de doute raisonnable sont relues sur [CNIL — RGPD chapitre III](https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre3), le 08/11/2026. [Guide CNIL sur l'accès](https://www.cnil.fr/fr/repondre-une-demande-de-droit-dacces). Le référent devra calculer le calendrier applicable, surveiller les échéances et escalader ; aucun SLA opérationnel n'est réputé déjà tenu.

## Effacement, sauvegardes et appareils absents

Une copie téléchargée reste au destinataire. L'effacement local du profil n'efface pas le serveur ; la clôture éphémère ne nettoie pas automatiquement les caches. Un compte supprimé ne peut plus autoriser un nettoyage personnel par simple ancien UUID. Prévoir une assistance vérifiant le contrôle légitime du profil navigateur, les données des tiers et les autres comptes, sans effacement global improvisé. La barrière UUID reste une donnée personnelle technique ; sa durée et son retrait suivent la politique approuvée, sans TTL improvisé.

Une restauration doit rester isolée, avec accès et synchronisation suspendus. Le journal privé minimal `deletions.json`, tenu par l'exploitant et protégé comme les sauvegardes, est la source de réconciliation ; journal absent/incomplet ou empreinte non concordante ⇒ aucune remise en service. La réapplication après snapshot et la préservation du témoin sont exercées sur PostgreSQL synthétique ; cela ne prouve ni restauration Auth hébergée ni retrait des copies fournisseur. [Contrôles et limites datés](../deploiement/EXPLOITATION-PRIVEE-SIX-ADULTES.md#qualification-opérationnelle-de-p0-13--8-novembre-2026). Backups/PITR, logs et boîtes e-mail ont leurs propres responsables, contrats, délais et limites.

## Repères historiques de préparation du 5 novembre

Ce tableau conserve les repères de préparation du 05/11 ; ses mentions non vérifiées sont historiques, les statuts courants sont ceux de la matrice et du guide opérateur. Chaque intervention réelle attend un opérateur autorisé, une décision et une vérification de cible/résultat, une preuve interne datée et une conclusion. L'exploitant peut accomplir ces étapes successives lui-même ; deux personnes ne sont pas exigées par principe à sept comptes confirmés. Si indisponible, prévoir une aide habilitée ou un arrêt sûr avec information, plutôt qu'un partage de secrets. Aucun nom d'administrateur, secret, détail de récupération ou liste d'habilitations n'est à publier dans Git.

| Objet | Vérifiable dans Git / recette éphémère | Points à vérifier dans les réglages/pratiques réels (état historique du 05/11) |
| --- | --- | --- |
| GitHub | PR requise et trois checks relus via ruleset ; workflows sans déploiement sur PR | Propriétaires/collaborateurs, moindre privilège, MFA/récupération effectifs de l’exploitant, aucun accès administratif des camarades |
| Supabase | RLS/grants/FK versionnés, clients publics/admin séparés | Membres par projet, rôles admin, authentification forte, accès support, revue périodique et journal d'accès |
| Comptes opérateurs | Aucun rôle admin étudiant introduit | Comptes nominatifs autorisés, absence de partage, suppléance et procédure d'accès d'urgence |
| Secrets | Ignore des `.env`, Pages limité aux clés publishable, aucun secret admin dans le frontend | Stockage en gestionnaire, rotation/révocation, accès minimaux et historique d'exposition ; ne pas ouvrir les secrets pour remplir ce dossier |
| Invitations | API native de confiance, signup/anonyme désactivés dans la stack dédiée | Qui décide/invite, source d'adresse, contrôle du destinataire, information préalable et traitement d'une erreur |
| Messagerie existante / liens manuels | Génération sans envoi dans les outils fermés ; aucun nouveau SMTP | Adresse/fournisseur/conditions, réception et réponse sans compte, suivi/pixel désactivés, accès/récupération/rétention, remise unitaire |
| Revues d'habilitations | Aucun inventaire privé suivi dans Git | Fréquence motivée, entrée/sortie, revue après incident, preuve minimale et retrait effectif |
| Backups et restauration | Cascades SQL testables, pas d'exécuteur de purge | Plan/PITR/lieux, accès, délais, restauration isolée, réapplication d'effacements et décision de retour |
| Demandes de droits | Copie partielle et retrait local ; limites affichées | Canal fonctionnel, suppléance, vérification, remise sécurisée, suivi et exercice avec/sans compte |
| Incidents | Aucun log nominatif ajouté par la clôture, tests de panne | Canal d'alerte, décideur, qualification, fournisseurs, notifications et registre restreint |

## Gestion d'un incident ou d'une violation possible

1. Recevoir l'alerte par un canal existant à renseigner/tester, dater les faits et la prise de connaissance, préserver seulement les éléments nécessaires dans un espace restreint. Séparer panne, défaut de sécurité et éventuelle atteinte à la confidentialité/intégrité/disponibilité de données personnelles.
2. Contenir de façon proportionnée : arrêter la fonction ou l'accès concernés, protéger les sessions/secrets exposés, contacter les opérateurs/prestataires autorisés. Ne pas purger des logs ou réinitialiser une base comme réponse réflexe ; ne pas propager un lien sensible dans une PR.
3. Qualifier avec le responsable : nature, catégories/volume approximatif, personnes potentiellement concernées, conséquences et mesures. Documenter ce qui est connu/inconnu, l'évaluation des risques pour les personnes, l'auteur de la décision et sa justification.
4. Décider les notifications applicables. L'art. 33 prévoit, sauf absence de risque pour les droits/libertés, la notification à l'autorité compétente dans les meilleurs délais et si possible sous 72 h après connaissance, avec motifs d'un retard et possibilité de compléter. Le sous-traitant alerte le responsable sans délai indu. L'art. 34 concerne l'information des personnes si risque élevé, sous ses conditions/exceptions ; ne pas annoncer notification ou dispense automatique. Source relue le 05/11/2026 : [RGPD, art. 33–34 sur CNIL](https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre4).
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

Critères de réussite future : alerte reçue par le bon rôle, cible vérifiée, mesures proportionnées, décision tracée dans les délais applicables, absence de fuite supplémentaire, reprise contrôlée et demande de droits traitable. Cet exercice historique d’incident reste préparatoire ; il ne constitue ni une simulation exécutée ni le statut courant de P0-13, suivi dans la matrice.
