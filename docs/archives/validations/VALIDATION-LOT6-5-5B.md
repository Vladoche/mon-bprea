# Validation du lot 6.5.5.B — résolution des P0

**5 novembre 2026, Europe/Paris. Préparation et livraison GitHub G1 ; aucune ouverture ni intervention Supabase hébergée.** Ce rapport clôt le travail local, sans transformer ses préparations en approbation humaine. [Matrice complète des quinze P0](../../deploiement/PLAN-PREOUVERTURE-PRIVEE.md), [seuls arbitrages finaux](../../deploiement/ARBITRAGES-FINAUX-PREOUVERTURE.md), [D01–D14 réconciliées](../../rgpd/DECISIONS-A-VALIDER.md).

## Base et mandat

Worktree initial propre sur la branche A. `git fetch origin` confirme `main` à **d0bda92daf5cb40aa44a7fae694da9623188c2ba**, fusion de la PR #34. Branche dédiée créée depuis cette référence : `feature/lot6-5-5b-resolution-p0`. Aucun historique réécrit, protection de main modifiée, fusion ou workflow de déploiement lancé. Node **24.22.0**, npm **10.4.0**, `npm ci --offline --no-audit --no-fund` réussi, aucune dépendance ajoutée.

Le mandat reçoit six familles d'arbitrages : périmètre personnel indépendant/facultatif/gratuit/non commercial et privé ; e-mail existant comme contact (adresse inconnue) ; calendrier 31/05–30/06–30/07/2027 ; sauvegarde hebdomadaire gratuite et perte maximale visée sept jours ; clôture assistée native ; exploitant seul administrateur avec MFA/récupération et secrets protégés, sans ouverture avant prérequis. **Hypothèse seule pour le décompte : sept comptes au total exploitant compris, six autres places ; à confirmer avant invitation.** Aucun huitième compte implicite ni quota serveur annoncé.

Conservés intégralement : C2/T03/T08/T10/T12 et leurs limites, T11 réelle non exécutée, D non autorisée ; 2/2 comptes fictifs, 3/3 liens consommés, 29/60 Auth mutantes, 104/140 tentatives, 36 lignes historiques. Aucune relecture de ces données, modification de compte, preuve ou réservation. La sauvegarde partielle du 29 octobre reste conservée suivant l'accord du 5 novembre, sans nouvelle rétention, déplacement, contrôle de données ou purge ; revue du 12 novembre indicative. Outils/preuves de maintenance .tmp intacts, aucun nettoyage général dans B.

## Réduction des blocages et décisions

| Statut courant | P0 | Justification / reste réel |
| --- | --- | --- |
| RÉSOLU — PREUVES SUFFISANTES | 02, 09 | Le mandat explicite suffit à acter indépendance et finalités/public ; aucune validation d'établissement à inventer. Le décompte de capacité reste isolé dans 14 |
| PRÊT À APPROUVER | 01, 03, 06, 10 | Qualification prudente avec deux branches ; bases et mise en balance R01–R05 ; calendrier reçu et durées résiduelles chiffrées proposées ; screening AIPD motivé. Aucun avis juridique ou accord déjà présumé |
| IMPLÉMENTÉ LOCALEMENT — RECETTE REQUISE | 05, 12, 13, 15 | Notice/aperçu, chaîne de sauvegarde contrôlable, préflight de clôture, circuit/outil préalable à l'invitation. Contact, pièces, approbations et preuves réelles encore nécessaires ; détail par porte dans la matrice |
| BLOQUÉ — INFORMATION EXPLOITANT | 04 | Adresse réelle, publication autorisée et essais réception/réponse absents ; configuration privée vide effectivement créée |
| BLOQUÉ — PREUVE FOURNISSEUR | 07, 08 | Sources publiques relues ; applicabilité aux comptes, messagerie inconnue, lieux/accès/copies/délais effectifs non établis. Région DEV UE ne prouve pas « exclusivement UE » |
| BLOQUÉ — AUTORISATION HÉBERGÉE | 11, 14 | MFA/rôles/réglages réels non observés, cible définitive et réserves/activation sous mandats distincts. Aucun PROD prêt annoncé |

**Deux P0 clos, treize non clos**, avec le travail manquant attribué dans la matrice ; aucune anomalie non résolue masquée sous un succès. L'approbation de D02/D09 ne valide pas D01/D03/D11. Recommandation juridique : socle RGPD applicable sans revendiquer l'exception, incertaine pour le cercle de camarades ; intérêt légitime proposé et motivé séparément pour R01–R05, sans contrat ou consentement fabriqué. Screening : AIPD non requise selon les éléments examinés, approbation humaine attendue et révision si autre critère/risque élevé. Sources officielles et dates dans les références existantes, EUR-Lex antirobot signalé.

## Travaux techniques terminés

Six fichiers `scripts/preopening/` et entrées npm, sans migration, endpoint, secret, nouvelle dépendance ou modification frontend : politique JSON (sept administratifs, dates, dix tables/exclusions), préflights hors ligne, CLI de dossier privé/contact/invitation/clôture/scellement/backup, vérification de sauvegarde et exercice PostgreSQL synthétique, aperçu local de notice. Les protections `admin:auth-link`, campagnes C2, prototype close-account, RLS/grants et configuration publique restent inchangées.

Invitation : inventaire complet récent, projet/callback/type/destinataire exacts, compte absent ou récupération active, états pending/uncertain/fictif, rôle participant et décompte exploitant contrôlés. Aucune génération ni réservation effective ; verrou/réservation durable et exécuteur de confiance restent à adapter après cible/mandat. Ce préflight n'est pas une limite serveur.

Sauvegarde : une archive custom native cohérente, manifeste/SHA-256/TOC, empreintes courantes de migrations et du journal d'effacements, preuve de restauration liée à cette archive ; âge depuis début du snapshot restaurable, avertissement à 144 h et échec au-delà de 168 h. Échec/manque de preuve ou copie corrompue n'est pas un succès. Scellement local unique, génération hébergée hors dépôt, droits et réconciliation obligatoires. Auth/projet/non synchronisé exclus ; aucune garantie de RPO ni copie actuelle DEV/PROD. PC absent, retard, perte matérielle et acceptation des limites restent explicites.

Clôture : méthode administrative native choisie et documentée, vérification d'identité/cible unitaire, onze dépendances/dix tables, résultats incertains sans répétition, JWT/refresh/caches/copies et réconciliation. Un scénario ajouté à la suite Supabase éphémère couvre `auth.admin.deleteUser(UUID, false)` distinct du prototype : il a réussi en CI, avec inventaire Auth complet/borné, dix cascades, autre participant préservé, refresh/reconnexion refusés et FK réelle sous JWT encore non expiré. Aucun succès sur projet hébergé n’en est déduit ; l’assistance réelle attend contact/identité/habilitation et cible vérifiée. Revue finale : le préflight refuse aussi un état cible incertain indépendamment du dernier résultat de mutation, avec régression ciblée et suite locale complète 535/1 revérifiée.

## Vérifications exécutées et limites

| Contrôle | Résultat observé |
| --- | --- |
| `npm test` final | **535 réussis, 1 ignoré, 51 fichiers** (536 cas). Le cas historique de lien symbolique natif Windows refusé faute de privilège reste ignoré ; les protections de jonction et hardlink sont distinctes |
| Nouveaux préflights/backup | Dix-neuf tests synthétiques inclus dans la suite : sept/huitième, place exploitant, inscription fermée, privilèges, identité/cible et confidentialité du bilan, RPO limite/échecs/intégrité/restauration/effacements, scellement et stockage hors dépôt |
| `npm run test:e2e` | **85/85** première passe, puis **85/85** seconde passe complète (52,1 s), après la suite unitaire correspondante ; le garde hors ligne complémentaire a ensuite été revérifié par la suite unitaire complète. Auth/signup fermé, invitations/récupération et isolation A/B inclus ; HTTP Supabase simulé, pas preuve RLS |
| SDK Auth | `npm run build:auth-sdk` réussi, `git diff --exit-code -- assets/vendor/supabase.js` sans différence ; version 2.118.0 conservée |
| Exercice PostgreSQL 17.11 natif | **Réussi** : trois migrations, dix tables/vingt lignes restaurées et comparées ; suppression factice post-snapshot, dix lignes réintroduites puis retirées sur restauration par journal, dix lignes de l'autre cible préservées. Structure/droits comparés, cluster arrêté ; pas d'Auth/JWT/Supabase réel |
| Contact et RPO par défaut | Dossier privé neuf initialisé sans adresse ; `contact` renvoie bloqué/code 2. Sans archive/preuve, `backup` renvoie **OBJECTIF RPO NON SATISFAIT**, code 2. Aucun envoi ou connexion |
| Protection locale | ACL du dossier opérateur protégées, zéro règle inattendue hors exploitant/SYSTEM/administrateurs ; fichiers privés effectivement ignorés. Poste/MFA/gestionnaire/chiffrement et comptes réels non attestés par ce contrôle |
| Aperçu de notice | Chromium neuf, sans JavaScript ni compte, 1280/390 px en clair/sombre : pas de débordement, lecture/focus clavier et lien de recours vérifiés ; quatre variantes et fins de page examinées visuellement. Une seule requête locale par page, zéro requête tierce |
| Supabase réel sur ce poste | **NON EXÉCUTÉ** : aucun Docker/stack dédiée disponible ; CLI non exposée sur PATH. Aucun runner redirigé vers DEV/PROD ; nouveau scénario natif contrôlé syntaxiquement puis exécuté avec succès par la stack éphémère CI ordinaire (preuve ci-dessous) |
| Liens internes / Pages / confidentialité / diff | **756 liens Markdown internes valides**, zéro fichier privé suivi, **133 fichiers publics dont 17 HTML**, aucun nouvel outil/brouillon/pièce privée dans Pages, défaut Auth off ; `git diff --check` réussi. Aucun fichier frontend, migration, workflow, outil de campagne/maintenance ou rapport historique A/C modifié |

Arrêts de mise au point corrigés, sans les comptabiliser comme réussites : hardlink Windows interdit dans le bac à sable puis test réussi hors restrictions ; flux hérités de pg_ctl empêchant la fin du processus (corrigés par flux ignorés), déparse de contraintes/ACL explicites versus implicites et parseur de TOC corrigés avant l'exercice final ; premier téléchargement Chromium bloqué par DNS puis installation autorisée réussie ; attente erronée de huit rubriques au premier contrôle visuel corrigée à sept. Le premier cluster synthétique a été contrôlé séparément par `pg_ctl status` : aucun serveur actif ; les suivants ont des clôtures privées avec arrêt confirmé. Aucun de ces arrêts n'a touché une donnée utilisateur ou une cible hébergée.

## Livraison GitHub et prochaine étape

[PR #35 ouverte, non fusionnée](https://github.com/Vladoche/mon-bprea/pull/35), branche `feature/lot6-5-5b-resolution-p0`. Code/tests : **e73a352886cdc77689a3ab24a0c40ed7c28b84dd** ; réconciliation documentaire : **268cbff73f83b6f8ec77990e8d5e016c3123a8f1**. Le commit portant ce reçu ajoute le refus d'un état de clôture incertain et consigne les preuves ci-dessous ; aucune réécriture d'historique.

Première CI de la PR, **tête 268cbff**, checkout de fusion temporaire **1f5e63c** avec main d0bda92, observée le 05/11/2026 :

| Job | Preuve observée |
| --- | --- |
| [unit-integration](https://github.com/Vladoche/mon-bprea/actions/runs/42034594445/job/127269323535) | **SUCCÈS**, 51 fichiers, 535 tests réussis et 1 ignoré ; SDK sans différence |
| [e2e](https://github.com/Vladoche/mon-bprea/actions/runs/42034594445/job/127269323911) | **SUCCÈS**, 85 parcours |
| [supabase-security](https://github.com/Vladoche/mon-bprea/actions/runs/42034594308/job/127269323397) | **SUCCÈS**, 386 assertions pgTAP et 32 parcours Supabase réels ; nouveau scénario de clôture native réussi ; arrêt de la seule stack éphémère confirmé |

Ces liens attestent précisément cette tête, pas un commit futur. Les contrôles déclenchés normalement par le reçu final doivent être relus et leur dernier état figure dans la PR. Aucune exécution manuelle de workflow, publication Pages, opération Supabase hébergée, fusion ou modification de protection. Le contrôle réel d'expiration **local CI** ne lève pas la réserve **T11 DEV**, toujours non exécutée.


Il reste uniquement à compléter/approuver les [six lignes courtes d'arbitrages](../../deploiement/ARBITRAGES-FINAUX-PREOUVERTURE.md), les preuves fournisseurs et les recettes ciblées nécessaires. Les mandats futurs y bornent lecture administrative, snapshot actuel/restauration isolée, réserves T11 et D séparées, préparation de la cible/outil puis publication/activation/invitations. Aucune opération Supabase hébergée, suppression réelle, génération de lien, invitation de participant, activation, dépense ou preuve privée publiée dans B.
