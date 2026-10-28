# Dossier de préouverture — lot 6.4.4

**DOCUMENT DE TRAVAIL NON VALIDÉ — 28 octobre 2026. OUVERTURE BLOQUÉE.** Ce dossier prépare une décision, sans commencer 6.5, déployer, inviter ou certifier la conformité. Base technique : fusion #23 `1bddaece1ac26b21a132d0974d7692dec6e80245`. Les décisions [D01–D14](DECISIONS-A-VALIDER.md) restent non validées. Aucune identité de responsable ou coordonnée n'est inventée.

## États et pièces de décision

| État | Sens et preuve nécessaire |
| --- | --- |
| **VALIDÉ TECHNIQUEMENT** | Comportement observé dans une exécution identifiable, limitée à son environnement et son SHA ; aucune validation juridique implicite. |
| **PRÉPARÉ MAIS NON ACTIVÉ** | Code, test ou projet de procédure disponible ; pas de preuve d'activation ou d'autorisation hébergée. |
| **DÉCISION À VALIDER** | Choix de l'exploitant, juridique, organisationnel ou contractuel, avec valideur et justification à consigner. |
| **BLOQUANT** | Pièce/décision/exécution absente qui interdit de considérer l'ouverture prête. Une ligne P0 ouverte suffit. |

Ces états s'appliquent à un **objet précis** : une copie peut être validée techniquement en local tout en étant préparée mais non activée sur l'hébergement. La [matrice de preuves](MATRICE-CONFORMITE-ET-PREUVES.md) et la [validation](../validations/VALIDATION-LOT6-4-4.md) portent les résultats d'exécution ; les présentes cases ne sont pas cochées par un test vert.

Les fonctions citées ci-dessous sont toutes **à désigner** par l'exploitant. Les noms, habilitations détaillées, contrats et dossiers nominatifs seront conservés dans un espace interne restreint ; Git ne contient que des références et statuts autorisés. Pour lever une ligne, consigner : ID, version/périmètre, décision motivée, preuve interne contrôlée, fonction validatrice, date et éventuelle date de revue.

## P0 — avant toute invitation réelle

| ID / critère | État actuel | Preuve disponible et pièce manquante | Décision manquante | Responsable à désigner | Action requise / intervention |
| --- | --- | --- | --- | --- | --- |
| P0-01 Responsable du traitement | BLOQUANT | Registre préparatoire ; aucune désignation | D01 : entité qui décide finalités/moyens | Exploitant habilité / direction | Note de responsabilité, coordonnées autorisées et validation du registre ; décision hors code avant 6.5 |
| P0-02 Établissements et instructions | BLOQUANT | Aucun accès formateur déduit du code ; relations réelles inconnues | D02 : rôles distincts/conjoints/sous-traitance | Direction et référent établissement | Réunir accords/instructions et qualifier par activité ; pièces internes avant 6.5 |
| P0-03 Bases légales | BLOQUANT | Options R01–R05 documentées, aucune retenue | D03, dépend D01/D02/D09 | Responsable, conseil/DPO si pertinent | Examen par finalité et justification ; aucune case générique comme fondement |
| P0-04 Canal de droits fonctionnel | BLOQUANT | [Projet de procédure](PROCEDURE-DEMANDES-ET-INCIDENTS-PROJET.md), aucun contact opérationnel vérifié | D04 : canal, suppléance, authentification proportionnée | Référent droits / DPO si désigné | Désigner/tester réception et réponse, aussi sans compte ; exercice organisationnel avant invitation |
| P0-05 Notice validée | BLOQUANT | Projet corrigé et spécification, aucune page définitive | D10/D14 : mentions complètes et approbation | Responsable et valideur éditorial/juridique | Compléter puis approuver la version ; réalisation de page dans un lot distinct autorisé |
| P0-06 Conservation | BLOQUANT | JSON `validated:false`, toutes durées nulles, planificateur sans effaceur | D07/D08 : événements, durées, exceptions, retrait des barrières | Responsable, métiers, sécurité | Approuver règles motivées par catégorie ; traiter bruts, outboxes, demandes et backups avant activation |
| P0-07 Prestataires et contrats | BLOQUANT | Pages/Supabase documentés publiquement ; contrat/plan/SMTP réels inconnus | D05 : rôles, chaîne et obligations applicables | Responsable / achats ou fonction contractuelle | Dossier interne de contrats, sous-traitants et engagements de droits/incidents |
| P0-08 Transferts et lieux | BLOQUANT | Aucune région/support/réplication réelle inspectée | D06 : pays, accès, garanties et mesures | Responsable, fonction contractuelle/DPO | Matrice effective par fournisseur ; ne pas annoncer « UE exclusivement » sans preuve |
| P0-09 Public et conséquences | BLOQUANT | Aide pédagogique descriptive ; effectifs, âges et usages institutionnels inconnus | D09 : public, dépendance, alternatives et effets des résultats | Responsable / référent pédagogique | Fournir ces faits sans ajouter une collecte d'âge par réflexe ; conditionne D03/D11 |
| P0-10 Nécessité d'AIPD | BLOQUANT | Screening et risques préparés, conclusion suspendue | D11 : conclusion motivée ; éventuelle analyse à réaliser avant usage | Responsable, DPO/conseil et sécurité | Examiner listes/critères/public ; si nécessaire, préparer puis réaliser l'AIPD et traiter le risque résiduel |
| P0-11 Accès administratifs et secrets | BLOQUANT | CI sans secret PROD ; consoles/habilitations/MFA non vérifiés | D13 : accès minimaux, authentification forte, revues et suppléance | Référent sécurité / opérateurs habilités | Exécuter la checklist opérationnelle et conserver la preuve privée |
| P0-12 Incidents et restauration | BLOQUANT | Projet, exercice fictif et cascades testables ; pas d'équipe/procédure réelle validée | D08/D13 : qualification/notifications, reprise et suppression après restauration | Responsable et référent incidents | Attribuer l'alerte, tester le circuit, restaurer de façon isolée puis réappliquer les décisions d'effacement |
| P0-13 Service de suppression ou alternative de droits | BLOQUANT | Effacement local préparé ; Edge Function exclusivement éphémère, pas de service hébergé | D04/D08/D13 : procédure réellement disponible, reprise/pannes et assistance après clôture | Référent droits et opérateur serveur | Valider une alternative opérationnelle ou autoriser un service ciblé et sa recette distincte ; ne pas retirer la garde locale du prototype |
| P0-14 Configuration hébergée autorisée et testée | BLOQUANT | Git/CI locale ne prouvent pas DEV/PROD ; aucun accès hébergé dans 6.4.4 | D14 et autorisations d'interventions | Exploitant et responsable de mise en service | Autoriser séparément les contrôles/configurations ; tests fictifs avec clients étudiants, RLS et artefact réel |
| P0-15 Information avant invitation/collecte | BLOQUANT | [Spécification des points d'entrée](SPECIFICATION-INFORMATION-PUBLIQUE.md), aucun message réel envoyé | D10 : source de l'adresse, moment et version communiquée ; D12 terminal | Responsable / gestionnaire des invitations | Communiquer la version validée avant invitation et au moment pertinent de collecte ; tracer la version sans prétendre recueillir un consentement général |

**Aucune ligne P0 n'est levée par ce dossier.** D12 est instruit en préparation technique P1, mais sa conclusion conditionne P0-05/P0-15 ; ce classement n'en dispense pas avant ouverture. L'absence de service d'effacement self-service n'autorise pas l'absence de canal de droits réellement disponible.

## P1 — préparation du déploiement, après autorisations distinctes

| Critère | État | Preuve / manque et décision | Responsable à désigner | Action / lot concerné |
| --- | --- | --- | --- | --- |
| Historique des migrations DEV | PRÉPARÉ MAIS NON ACTIVÉ | Trois migrations versionnées ; état distant non relu | Opérateur base | Lecture autorisée puis plan de migrations, aucune écriture DEV dans 6.4.4 ; préparation 6.5 autorisée |
| Recette hébergée | PRÉPARÉ MAIS NON ACTIVÉ | Suites éphémères ≠ hébergé ; P0-14 non résolu | Sécurité / recette | Définir périmètre, comptes fictifs et autorisation ; ne jamais rediriger les runners destructifs |
| SMTP | DÉCISION À VALIDER | Fournisseur/contrat, SPF/DKIM/DMARC, rétention, absence de suivi non vérifiés | Opérateur messagerie | Configuration et essai contrôlé autorisés, aucun SMTP externe dans ce lot |
| URL/callback et artefact | PRÉPARÉ MAIS NON ACTIVÉ | Préfixe local Pages testé ; domaine, redirections et réglages réels à confirmer | Opérateur frontend/Auth | Vérifier URL exacte et callbacks sans wildcard non justifiée ; préparation distincte |
| Invitation et récupération | PRÉPARÉ MAIS NON ACTIVÉ | Modèles et capture SMTP éphémère, aucun destinataire réel | Opérateur comptes | Recette hébergée autorisée puis vérifier information préalable, usage unique et expiration |
| Paramètres Auth | PRÉPARÉ MAIS NON ACTIVÉ | Défaut public désactivé ; signup/anonyme refusables en stack locale | Opérateur Auth / sécurité | Vérifier réglages réels, durée sessions/liens, protection des consoles ; ne pas copier les 120 s de tests |
| Accès au terminal D12 | DÉCISION À VALIDER | Inventaire localStorage/IndexedDB/traceurs prêt, analyse d'exemption non approuvée | Responsable / conseil/DPO | Justifier nécessité par usage et durée ; si finalité non exemptée, concevoir son consentement préalable |
| Artefact Pages exact | VALIDÉ TECHNIQUEMENT en local | Préparation et audit sous `/mon-bprea/`, Auth off ; pas de réponse CDN réelle | Opérateur frontend | Revalider SHA/digest et notice approuvée dans la future recette autorisée, avant publication |
| Retour arrière | DÉCISION À VALIDER | Code versionné ; aucun runbook hébergé approuvé | Exploitant / sécurité | Version antérieure sûre, arrêt des accès/sync si incident ; ne pas restaurer des personnes effacées |
| Sauvegardes/restauration | BLOQUANT pour la mise en service | Plan réel, durées, accès et preuve de réapplication des effacements manquants | Opérateur base et référent droits | Essai isolé autorisé, inventaire des suppressions postérieures et contrôle avant réouverture |
| Mise en service progressive | DÉCISION À VALIDER | Aucun pilote étudiant lancé | Responsable et référent pédagogique | Définir périmètre/critères d'arrêt et support, après levée P0 et décision d'ouverture |

## P2 — améliorations possibles

| Critère | État / preuve | Décision et responsable à désigner | Action / intervention |
| --- | --- | --- | --- |
| Guides d'usage des droits | PRÉPARÉ MAIS NON ACTIVÉ : projets disponibles | Référent droits/éditorial, langage et besoins du public | Guide court et version accessible après approbation des mentions |
| Ergonomie des copies volumineuses | DÉCISION À VALIDER : limites 20 Mio/100 000 lignes connues | Produit/sécurité, procédure de confiance pour dépassements | Optimisation ciblée ou remise assistée, sans copie supplémentaire non justifiée |
| Observabilité minimisée | DÉCISION À VALIDER : pas de ledger nominatif serveur ajouté | Sécurité/droits, finalité et durée | Indicateurs sans réponses/JWT/capacités ; aucun outil tiers ajouté implicitement |
| Revue documentaire régulière | DÉCISION À VALIDER : matrices datées | Responsable et gardien du registre | Définir fréquence et déclencheurs ; aucune automatisation/purge créée ici |

## Règle de passage au lot 6.5

Préparer une décision datée après levée de **tous les P0**, attribution des P1 et revue des preuves techniques sur le SHA retenu. Faire préciser environnement, périmètre, acteurs, version d'information et conditions d'arrêt. Les autorisations de migration, déploiement, publication et invitation restent des actes distincts ; aucune n'est donnée par ce document ou par une PR verte. Le 6.4.4 peut clôturer sa préparation technique tout en laissant ce passage bloqué.
