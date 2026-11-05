# Plan de préouverture privée — lot 6.5.5.A

**État au 5 novembre 2026 : préparation locale terminée, ouverture non autorisée.** Ce plan actualise le [dossier de préouverture](../rgpd/DOSSIER-PREOUVERTURE.md) sans réécrire ses états historiques. Les [procédures courtes d'exploitation](EXPLOITATION-PRIVEE-SIX-ADULTES.md) regroupent l'assistance quotidienne. Les décisions ci-dessous sont des propositions ; aucune signature de l'exploitant n'est déduite d'un test.

**Instruction complémentaire du 5 novembre :** livraison de la branche sur GitHub autorisée et **conservation de la sauvegarde du 29 octobre expressément confirmée**. Un reçu local protégé est ajouté auprès de la copie ; dumps et manifeste historique inchangés, neuf empreintes conformes. Aucune nouvelle échéance de suppression choisie. Le 12 novembre reste une revue conseillée, pas un accord d'effacement. Cette décision ponctuelle ne valide pas D07 globalement ni les portes d'ouverture.

## Périmètre et provenance

Service personnel indépendant de l'établissement, facultatif, privé, sur invitation : l'exploitant et cinq camarades adultes au maximum. Résultats individuels privés, sans accès formateur ni notation officielle. Horizon de fermeture : juin 2027, jour non choisi. GitHub Pages et Supabase Free, aucun achat, domaine ou SMTP externe. La gratuité et l'absence d'abonnement sont réaffirmées par le mandat de ce lot ; aucun consentement individuel n'est présumé.

Le worktree initial était propre. La fusion connue `04c1aca` de la PR #32 est disponible localement. Le bilan du 4 novembre est **déjà committé dans `178eb68`**, descendant de cette fusion ; sa présence dans ce commit local ne prouve pas son intégration à `main`. La branche de ce lot part de `178eb68` et conserve intégralement la [validation 6.5.4.C](../validations/VALIDATION-LOT6-5-4C.md), y compris l'historique du 31 octobre. Aucun fetch/push ou nouveau contrôle GitHub distant dans ce lot.

Lors du complément de livraison autorisé, `git fetch origin` confirme **`origin/main` à `7729cdbe45e72b45cec783c3034d2b0fccf7025a`**, fusion de la [PR #33](https://github.com/Vladoche/mon-bprea/pull/33), contenant `178eb68` et de même arbre. Le bilan C2 est donc intégré à `main` à cette observation. La phrase précédente décrit la préparation locale initiale ; aucune fusion de ce nouveau lot n'est autorisée.

| Niveau de preuve | Résultat disponible | Limite à maintenir |
| --- | --- | --- |
| DEV, observations des 30 octobre et 4 novembre | Activation B, récupération A, isolation A/B, Drill/Dashboard, cours/QCM, botanique, ITK/apparence, appareils, hors ligne, export ; correctif JSON et T03/T08/T10/T12 C2 réussis dans leurs sous-cas documentés | Deux comptes fictifs seulement, frontend servi localement ; ni PROD ni ouverture étudiante. Sous-cas non acquis détaillés dans le bilan, dont négatifs de liens, récupération après progression et limites de restauration |
| Réserve T11 | Expiration réelle JWT **NON EXÉCUTÉE**, report choisi par l'exploitant | Aucun succès déduit de 3600 s configurées, des mocks ou des expirations de la stack éphémère |
| D | **NON AUTORISÉ / NON EXÉCUTÉ** | A/B et copies privées conservés ; fermeture du banc local sans révocation immédiate des JWT promise |
| Compteurs historiques du 4 novembre | 2/2 comptes fictifs, 3/3 liens consommés, 29/60 Auth mutantes, 104/140 tentatives pédagogiques, 36 lignes applicatives | Valeurs historiques, aucune relecture DEV dans ce lot ; réservations et filiation inchangées |
| Tests locaux et CI du lot précédent | 499 tests, 85 E2E locaux ; CI rapprochée le 4 novembre : 386 assertions pgTAP et 31 parcours Supabase éphémères | Ne valent pas nouvelle CI 6.5.5.A. [Résultats locaux de ce lot](../validations/VALIDATION-LOT6-5-5A.md) séparés |
| Sauvegarde du 29 octobre | Copie applicative limitée, restauration native partielle antérieure, intégrité relue localement le 5 novembre | Quatre tables d'avant migration personnelle ; pas une copie des 36 lignes C2 ni une sauvegarde Auth/projet complet |

## Matrice des quinze P0

Toutes les portes restent **bloquantes pour l'ouverture** tant que leur décision et leur preuve finale ne sont pas consignées. Les ID sont ceux du dossier existant. Une procédure écrite est une préparation ; elle n'atteste pas sa recette hébergée. « RGPD conditionnel » signifie obligation à qualifier si le règlement s'applique ; les autres exigences sont des conditions de prudence du projet.

| P0 | Objet / nature | État technique et preuve existante | Décision nécessaire / travail restant | Bloquant |
| --- | --- | --- | --- | --- |
| P0-01 | Responsable / RGPD conditionnel | Exploitant personne physique, indépendance déclarée ; [analyse des deux branches](../rgpd/ANALYSE-EXCEPTION-PERSONNELLE-PROJET.md) disponible | D01 : qualification motivée et, si applicable, identité/contact autorisés dans le dossier privé ; avis ciblé seulement si doute | Oui, décision |
| P0-02 | Établissement / qualification des rôles | Usage facultatif sans instruction, accès formateur ou remontée prévu ; mandat actuel cohérent | D02 : acter ces pratiques et réexaminer si elles changent ; aucune convention d'établissement inventée | Oui, décision |
| P0-03 | Licéité / RGPD conditionnel | Finalités R01–R05 et options dans le [registre préparatoire](../rgpd/REGISTRE-TRAITEMENTS.md) | D03 : retenir une base par finalité après D01/D09 ; nécessité et bilan si intérêt légitime, contrat seulement s'il existe réellement | Oui, décision |
| P0-04 | Canal de droits / RGPD conditionnel | Demandes et vérification d'identité décrites ; aucun contact réel confirmé | D04 : choisir un canal déjà utilisable, son responsable et disponibilité ; tester réception/remise avec et sans compte | Oui, canal et essai |
| P0-05 | Information / RGPD conditionnel et transparence volontaire | Projet de notice existant, mécanismes d'export/retrait décrits | D01–D08/D10/D12/D14 : compléter les mentions effectives, approuver une version accessible sans compte avant collecte | Oui, contenu et validation |
| P0-06 | Conservation / minimisation conditionnelle | Inventaires et trois scénarios de fermeture prêts ; copie du 29 octobre réexaminée sans modification | D07/D08 : jour T, fenêtre d'export, durées par catégorie, copies/logs, exceptions ; aucun délai de sept jours généralisé | Oui, durées et preuve |
| P0-07 | Fournisseurs / contrats si nécessaires | GitHub/Supabase et canal privé, aucun SMTP supplémentaire ; sources publiques disponibles | D05 : pièces contractuelles réellement applicables aux comptes utilisés, accès et traitement du canal privé ; une feuille interne suffit à les indexer | Oui, preuve externe |
| P0-08 | Lieux/transferts / RGPD conditionnel | Région DEV eu-west-1 constatée dans la recette précédente | D06 avec D05 : lieux et accès effectifs des logs, copies et support ; région UE insuffisante pour promettre « exclusivement UE » | Oui, preuve externe |
| P0-09 | Public/conséquences / périmètre choisi | Six adultes, volontariat, indépendance, gratuité, résultats privés et horizon juin réaffirmés | D09 : acter la note et les déclencheurs de revue ; pas de collecte supplémentaire de date de naissance | Oui, approbation finale |
| P0-10 | AIPD / obligation selon risque élevé | Screening existant ; faible effectif et absence d'effet officiel pris en compte, scores pédagogiques à examiner | D11 : conclusion motivée sur listes/critères/risques résiduels ; AIPD seulement si nécessaire, avis compétent si doute | Oui, conclusion |
| P0-11 | Administration/secrets / sécurité proportionnée | RLS, droits de colonnes et isolation DEV documentés ; aucun droit élargi par ce lot | D13 : vérifier privativement titulaires, MFA/récupération, clés et poste ; traiter les écarts Auth déjà connus sans achat imposé | Oui, accès effectifs |
| P0-12 | Incident/reprise / sécurité proportionnée | JSON personnel limité livré, C2 correctif réussi ; sauvegarde native partielle du 29 octobre, [procédure proposée](EXPLOITATION-PRIVEE-SIX-ADULTES.md) | D08/D13 : choisir niveau de reprise acceptable, copie utile et exercice isolé anti-résurrection ; aucune reprise totale Auth démontrée | Oui, décision et exercice ciblé |
| P0-13 | Clôture/droits / RGPD conditionnel | Export et retrait local disponibles ; clôture prototype strictement locale ; procédure assistée préparée | D04/D08/D13 : choisir et recetter l'alternative native de confiance, cascades, JWT, caches et copies ; pas de déploiement `close-account` implicite | Oui, méthode opérable |
| P0-14 | Cible/activation / condition du projet | Schéma DEV installé au lot précédent ; recette connectée partiellement acquise dont C2 ; Auth publique toujours désactivée | D14 : décider traitement des réserves, dont T11, puis préparer l'environnement retenu, outil manuel hors campagne et contrôles ciblés sous mandat séparé | Oui, technique et autorisation |
| P0-15 | Avant collecte/invitation / information applicable | Circuit volontaire proposé et plafond six ; aucun camarade invité | D10/D12/D14 : source directe volontaire, notice remise avant adresse, canal et preuve minimale de version ; acceptation du lien ≠ consentement global | Oui, circuit et validation |

## D01–D14 : faits, recommandations et décisions

Les catégories reprennent la méthode [A–F du cadrage](../rgpd/CADRAGE-MON-BPREA-SIX-ADULTES.md) : fait technique, déclaration de l'exploitant, source réglementaire, recommandation, choix humain, preuve externe. **Aucune D entière n'est approuvée par ce lot.** Les décisions ponctuelles déjà actées sont identifiées, sans les étendre.

| ID | Classement actualisé | Proposition proportionnée / pièce finale attendue |
| --- | --- | --- |
| D01 | Déclaration : projet personnel ; choix juridique ouvert | Note d'une page sur les deux branches. Si RGPD applicable, exploitant personne physique responsable ; identité/contact autorisés en privé. Aucun statut de société ou DPO créé |
| D02 | Déclaration cohérente, approbation finale absente | Acter indépendance et absence de remontée/formateur ; réexamen si établissement détermine finalités/moyens ou impose l'usage |
| D03 | Recommandations juridiques, choix restant | Pour R01–R05, documenter la base nécessaire. Examiner service demandé si engagement contractuel réel, intérêt légitime avec bilan pour sécurité/assistance ; aucun consentement omnibus ni mission publique présumée |
| D04 | Choix et preuve d'essai manquants | Un seul canal connu joignable sans compte, tenu par l'exploitant ; pas d'adresse inventée ni DPO imposé. Journal minimal d'assistance, test concret de réception/remise |
| D05 | Fait technique : Free, aucun SMTP ; preuve externe manquante | Une feuille privée des conditions GitHub/Supabase et du canal retenu, dates/versions/pièces applicables et accès. Pas de nouvel abonnement ni dossier institutionnel |
| D06 | Fait technique historique : région DEV UE ; preuve externe manquante | Compléter pays/accès/garanties des copies, logs et support sans transformer la région base en garantie universelle |
| D07 | Déclaration : juin 2027 ; décisions ponctuelles du 29 octobre déjà actées ; choix général ouvert | Préférer scénario 1 du calendrier : T à choisir en juin, annonce/export T−30 jours, durées résiduelles séparées. Réexamen de la copie traité ci-dessous ; aucune purge programmée ni JSON de rétention activé |
| D08 | Faits techniques partiels, recommandation, choix et essai restant | Export/retrait local et clôture native assistée pour six personnes. Accepter explicitement la limite de reprise Auth ; recetter une suppression fictive et la réapplication des effacements sur copie isolée |
| D09 | Déclarations réaffirmées : six adultes, volontaire, privé, gratuit, indépendant ; approbation finale absente | Acter ce périmètre sans audience commerciale/publicitaire, sans score officiel ; confirmer les lieux d'usage et besoins après formation avant changement de périmètre |
| D10 | Choix à prendre, aucune collecte réelle | Chaque personne remet volontairement son adresse après notice accessible. Tracer date/version remise et participation demandée, jamais une liste collective d'adresses publique |
| D11 | Screening préparé, conclusion humaine ouverte | Pas d'indice documenté de grande échelle, mineurs, données sensibles ou effet officiel ; examiner l'évaluation par scores et les risques d'exposition. Motiver la conclusion, sans déduire une exemption de l'effectif |
| D12 | Inventaire technique existant, analyse terminal à valider | Justifier par usage la nécessité/durée des sessions, caches, préférences, provenances et barrières. Aucun bandeau par réflexe ; consentement préalable si un usage non exempté est retenu |
| D13 | Faits DEV documentés, preuves privées et arbitrages ouverts | Exploitant seul administrateur prévu, MFA et récupération à vérifier ; secrets locaux restreints, aucun tableau de résultats. Sauvegarde minimale et guide incident, décisions Auth explicites ; ne pas contourner RLS |
| D14 | Décisions ponctuelles de recette antérieure approuvées, ouverture jamais approuvée | Garder le défaut Auth désactivé. Autorisations distinctes pour réserves/D, préparation cible, publication/activation, puis invitations individuelles après levée P0 |

Déjà actés dans leur périmètre : absence de SMTP externe et liens manuels ; pour la copie du 29 octobre, dossier privé hors dépôt, dispense de chiffrement du volume, exclusion cloud **déclarée**, réexamen au 5 novembre sans purge ; report T11 et absence d'autorisation D. Ce ne sont ni une validation juridique, ni une approbation de conservation générale.

## Sauvegarde du 29 octobre : conservation décidée

**Décision explicite de l'exploitant le 5 novembre : conserver en l'état la copie et ses résidus associés.** Le reçu privé `decision-conservation-20261105.json` trace l'accord et le contrôle des neuf empreintes sans modifier le manifeste d'origine. Aucun dépôt/cloud supplémentaire, nouvelle copie, modification d'ACL, suppression ou accès hébergé. Une future suppression nécessitera une nouvelle décision ; aucune date limite n'est inventée. Les constats et options préparatoires ci-dessous gardent leur portée historique.

Inspection **locale en lecture seule**, sans appel DEV : copie présente hors `.tmp`, **210 440 377 octets / 5 206 fichiers**, ACL de racine protégées, aucun point de réanalyse observé. Le manifeste conserve son échéance du **5 novembre 2026** et sept jours initiaux : **9 fichiers référencés, 9 empreintes conformes**. Sa restauration native partielle reste celle observée le 29 octobre, pas une nouvelle restauration de ce lot. L'exclusion cloud et la dispense de chiffrement restent des déclarations/décisions antérieures, pas de nouveaux contrôles techniques. Aucun chemin privé, manifeste ou export n'entre dans Git.

La copie contient l'état applicatif avant les six tables personnelles : elle ne protège pas les résultats C2 du 4 novembre. Les clusters, réexports et diagnostics qui l'accompagnent restent hors mandat de nettoyage. Aucun fichier ni champ de rétention n'a été modifié.

| Option à décider par l'exploitant | Conditions / conséquence |
| --- | --- |
| Conservation temporaire motivée, proposée jusqu'au 12 novembre | Fixer explicitement motif et prochaine revue, contrôler accès et besoin de diagnostic/reprise. **Proposition seulement**, aucune prolongation inscrite au manifeste |
| Remplacement puis retrait de l'ancienne copie | Autoriser séparément une nouvelle copie pertinente et son essai isolé ; réconcilier les effacements, puis décider du sort de chaque ancien résidu. Aucun remplacement lancé ici |
| Retrait sans remplacement | Accepter explicitement la perte de cette capacité limitée et l'absence d'autre copie utile ; décision ciblée sur son emplacement privé, jamais via le nettoyeur `.tmp` |

La conservation est maintenant autorisée pour cette copie. Réexamen conseillé le 12 novembre et lors de la clôture D/T11, afin de préciser sa valeur et la suite ; aucune purge ne découle de cette recommandation. Les durées générales D07 restent à décider et les preuves de campagne gardent leur politique distincte.

## Droit applicable et choix de prudence

Les sources officielles ont été relues le **5 novembre 2026**. La CNIL réserve l'exception personnelle à un cadre strictement familial/amical ; le nombre de participants ne tranche pas sa qualification. D01 reste ouvert. [CNIL — particuliers et RGPD](https://www.cnil.fr/fr/cnil-direct/question/1817).

Si le RGPD s'applique, qualifier les finalités/bases, l'information, la conservation, les droits, les sous-traitants/transferts et la sécurité. Une personne physique peut être responsable ; l'application des critères de désignation d'un DPO doit être examinée, sans créer une obligation à partir de six comptes. Articles 2, 4, 5–6, 12–17, 28, 32 et 37 : [texte et chapitres officiels](https://www.cnil.fr/fr/reglement-europeen-protection-donnees).

L'AIPD dépend du risque élevé, des listes et critères ; D11 doit conclure sur le cas réel. La séparation des décisions, les quinze portes et un exercice fictif de reprise sont des conditions prudentes du projet, pas quinze formalités légales universelles. [CNIL — AIPD](https://www.cnil.fr/fr/RGPD-analyse-impact-protection-des-donnees-aipd).

L'analyse des accès au terminal est distincte : certains usages strictement nécessaires peuvent être exemptés de consentement, d'autres nécessitent un accord préalable. Ne pas généraliser l'exemption à tous les caches ou à de futures mesures d'audience. [CNIL — traceurs](https://www.cnil.fr/fr/cookies-et-autres-traceurs/que-dit-la-loi).

Le fournisseur recommande des exports réguliers pour Free ; aucune sauvegarde/PITR accessible n'est présumée. La copie applicative retenue reste limitée. [Supabase — sauvegardes](https://supabase.com/docs/guides/platform/backups). La [rupture CLI v3 du 4 novembre](https://supabase.com/changelog/supabase-cli-v3) justifie de **conserver le verrou existant 2.121.0** pour les runners, sans installation latest ni migration de CLI dans ce lot. Cela ne change aucun projet hébergé.

## Chemin court jusqu'à une décision d'ouverture

1. **Copie du 29 octobre : conservation confirmée.** Garder la copie, ses résidus et le reçu protégé ; revue conseillée le 12 novembre, sans purge implicite. Les preuves `.tmp/dev-recipe` sont préservées et maîtrisées en volume.
2. **Clore les réserves de campagne si retenu.** Autorisation D distincte avec cibles fraîches et inventaire privé, sans toucher A/B ici ; T11 exige son mandat, des compteurs frais et une vraie expiration. Les autres sous-cas non acquis doivent être traités ou faire l'objet d'une acceptation motivée, jamais renommés « réussis ».
3. **Décider le petit dossier humain.** Note D01/D02/D09/D11 ; canal D04 ; finalités/notice/terminal D03/D10/D12 ; pièces fournisseurs D05/D06 ; durées et exploitation D07/D08/D13. Une même personne peut cumuler ces tâches. Conserver les pièces nominatives hors Git.
4. **Rendre les procédures opérables.** Outil manuel de confiance pour l'environnement futur, encore absent hors campagne ; clôture native et reprise/effacements sur données fictives isolées ; compléter seulement les preuves manquantes, sans rejouer toute C2.
5. **Choisir l'activation privée.** Revue du SHA/artefact, configuration publique et URL exactes, contrôles ciblés et retour sûr, puis autorisation datée de publication/activation. Aucun test destructif sur PROD. Site statique et Auth publique désactivée jusque-là.
6. **Inviter individuellement.** Après tous les P0 clos, notice remise avant adresse, accord et plafond six contrôlés par l'exploitant, avec critères d'arrêt et canal d'assistance disponibles.

L'ouverture reste refusée si une porte P0 manque, si l'outil vise une cible ambiguë, si le canal/notice ou la clôture/reprise sont indisponibles, si une réserve n'a ni traitement ni arbitrage motivé, ou si le secret administratif risque d'entrer dans le frontend. Une CI verte, une fusion ou ce plan ne vaut aucune autorisation d'ouverture.
