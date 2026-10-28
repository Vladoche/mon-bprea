# Calendrier de fermeture — horizon juin 2027

**PROJET NON VALIDÉ — 28 octobre 2026. Aucune suppression ni tâche programmée.** Méthode A–F du [cadrage](CADRAGE-MON-BPREA-SIX-ADULTES.md). B : fin de formation prévue en **juin 2027**. E : date effective de fin du service, fenêtre de récupération et purges encore non décidées (D07/D08/D14).

## Trois scénarios soumis à décision (D), aucun retenu

Les valeurs suivantes sont des **fenêtres candidates de service/export**, proposées pour concilier récupération et minimisation ; ce ne sont ni des délais légaux ni des durées actives de conservation. `T` représente le jour de fermeture que l'exploitant doit choisir ; aucun `30 juin` implicite. Confirmer disponibilité des participants et de l'exploitant avant de fixer T. Le temps exact entre arrêt et effacement doit faire l'objet d'une décision D07/D08 et d'une recette, pas d'une marge illimitée.

| Scénario | Proposition à valider | Avantages | Risques / contraintes |
| --- | --- | --- | --- |
| 1 — récupération avant fin | Choisir T en juin 2027 ; annoncer à T−30 jours et proposer les exports pendant ces 30 jours d'utilisation, puis arrêter et traiter les suppressions actives autorisées. | Fin de finalité proche de fin de formation, pas de service prolongé après T. | Une personne absente peut manquer la fenêtre ; assistance à prévoir, disponibilité en juin à confirmer. |
| 2 — récupération après révisions | Choisir la fin des révisions en juin ; annoncer 30 jours avant ; prolonger le service personnel pour une fenêtre d'export de 30 jours après cette fin, puis T. | Davantage de temps après les évaluations ; copie/assistance via capacités existantes. | Conservation et sécurité prolongées à justifier ; aucune lecture seule serveur n'est implémentée, donc ne pas la promettre. |
| 3 — échéance concertée courte | Choisir T en juin après recueil des besoins ; annoncer 14 jours avant et accompagner individuellement les six personnes dans ces 14 jours. | Peu de prolongation et faible charge à six si chacun est disponible. | Fenêtre plus courte, risque de résultats non récupérés ; à retenir seulement après confirmation des besoins et capacité d'assistance. |

E : garder les contenus publics après T ou fermer aussi Pages (D14). Dans les deux cas, retirer les accès personnels selon une intervention distinctement autorisée ; un site arrêté n'efface pas Auth/SQL, les caches ou les copies des fournisseurs. Aucun scénario ne dispense du traitement normal d'une demande avant T ou d'une exception motivée.

## Phases et preuves avant clôture (D/E/F)

| Phase | Opération proposée et sortie attendue | Décision / preuve nécessaire |
| --- | --- | --- |
| A — utilisation | De l'ouverture autorisée jusqu'à la fin effective choisie ; historique privé, support et état de synchronisation compréhensible. | D14 après les P0 ; aucune date d'ouverture présumée. |
| B — annonce | Communiquer T, périmètre fermé, fenêtre, limites des copies et canal restant joignable. Pas de liste collective d'e-mails. | D10/D14 : version et remise minimale attestées en privé, pas un consentement général. |
| C — récupération | Export JSON du compte et compléments via canal ; conseiller de vérifier le fichier et les autres appareils avant perte d'accès. Expliquer les données non synchronisées. | D04/D08 : assistance disponible, identité/remise vérifiées ; pas de copie complète conservée par l'exploitant comme preuve. |
| D — arrêt des accès et écritures | Intervention serveur autorisée pour empêcher les nouvelles écritures et connexions dans l'environnement ciblé, traiter sessions/requêtes en vol. Vérifier avec clients anciens et JWT résiduel. | D13/D14 : runbook futur et recette dédiée. Désactiver le client Pages ou les seules nouvelles connexions n'arrête pas une API sous JWT encore valide. Aucun changement RLS préparé ici. |
| E — effacement actif | Après export/choix et exceptions décidées, clôture administrative native contrôlée de chaque cible ; contrôler Auth et dix tables, comptes non concernés préservés, état non confirmé si panne. | D07/D08/P0-13 : méthode future autorisée/testée ; pas de DELETE SQL improvisé, pas de déploiement du prototype local. |
| F — copies résiduelles | Demander traitement fournisseur des logs/backups/mails selon contrat ; assister sur les appareils contrôlés, fermer anciens onglets, suivre les limites et échéances. | D05–D08/D13 : plan réel, délais et preuve de sortie de rétention (F). Le canal doit rester disponible pendant le suivi décidé ; sa fin est aussi à fixer. |

## Ancien appareil et restauration (A/D)

A : [architecture 6.4.3](../architecture/SUPPRESSION-DONNEES-PERSONNELLES.md), `assets/personal-idb.js`, `assets/privacy-events.js` et migrations : epochs/barrières IndexedDB v2 par portée, invalidations des services coopérants, FK Auth/cascades et refus de recréation sous UUID supprimé. Les tests réels se limitent à une stack éphémère ; aucune preuve DEV/PROD déduite.

D : proposer le retrait personnel local **avant** la clôture, tant que l'identité peut être fraîchement vérifiée, après récupération du non synchronisé choisi. Un appareil absent peut conserver physiquement ses caches. Après clôture, prévoir assistance avec contrôle légitime du profil, sans utiliser un ancien UUID comme autorisation ni effacer les données des tiers. Ne pas retirer les barrières UUID tant que des writers anciens peuvent encore agir ; leur durée/retrait sûr restent D07/D08/D12.

D : isoler une restauration, interdire reprise et synchronisation, réappliquer les décisions d'effacement postérieures au point restauré depuis une preuve minimale restreinte, contrôler Auth/dix tables et anciens clients avant toute remise en service autorisée. Un fichier téléchargé, une impression ou la boîte mail d'un destinataire n'est pas rappelable. Le plan doit distinguer effacement actif confirmé, copies en attente et limites, jamais « tout effacé partout ».

## Décisions à consigner

D07/D08 : scénario, T, fenêtre, ordre, délai motivé d'effacement actif, durées de chaque catégorie de la [politique](POLITIQUE-CONSERVATION-PROJET.md), exceptions individualisées et sort des barrières ; D05/D06 : délais/lieux fournisseurs ; D04/D13 : contact jusqu'au terme du suivi et disponibilité ; D10/D14 : communication, devenir du contenu public et autorisations séparées. La fin de formation donne un événement de réexamen, **pas une purge automatique**. Le [JSON](CONSERVATION-PROJET.json) conserve `validated:false`, `automaticPurgeAuthorized:false` et les durées nulles.
