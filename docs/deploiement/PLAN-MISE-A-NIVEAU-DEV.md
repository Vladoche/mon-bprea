# Plan de mise à niveau Supabase DEV

**Suivi 6.5.4.C, 31 octobre 2026 :** [bilan DEV](../validations/VALIDATION-LOT6-5-4C.md), [reprise corrective](RUNBOOK-REPRISE-DEV-6-5-4C.md). Catalogue et privilèges complets toujours concordants après C/C1 ; aucune migration/configuration. A/B opérationnels, recette partielle et défaut JSON corrigé localement, nouvel artefact à autoriser. Les compteurs restent 3/3 liens, 22/60 Auth, 102/140 tentatives ; D absent. Aucune autorisation de mise à niveau ou d'ouverture.

**Suivi 6.5.4.B, 30 octobre 2026 :** [préparation de la recette](RUNBOOK-RECETTE-DEV-6-5-4B.md), [preuves](../validations/VALIDATION-LOT6-5-4B.md). Identité, trois migrations et contrats des dix tables/neuf RPC revérifiés en lecture seule ; aucune mise à niveau supplémentaire exécutée. Un outil DEV distinct prépare deux identités et un frontend local, sans assouplir les runners éphémères. Les lettres A–G de ce plan historique ne sont pas les accords **A recette, B liens, C pédagogie, D nettoyage** du nouveau runbook. Ces quatre accords restent absents ; toute modification SQL/Auth/configuration et toute nouvelle copie technique nécessitent leurs propres décisions. Auth Pages reste off.

**Actualisation 6.5.3.B, 29 octobre 2026 : étape base achevée sous A/B.** DEV seul **`wcckbyhrtroittbfophv`** ; copie applicative native, restauration PostgreSQL partielle et seule migration personnelle réalisées. [Preuve d’exécution](../validations/EXECUTION-LOT6-5-3B-2026-10-29.md). PROD exclu ; recette connectée non exécutée.

Le [guide de sauvegarde Free](SAUVEGARDE-TECHNIQUE-SUPABASE-FREE.md) et le [runbook](RUNBOOK-MIGRATION-DEV-6-5-3B.md) décrivent le résultat et les limites sans Auth/Storage/Vault. Le schéma a désormais trois migrations, dix tables et quinze fonctions, comparés à Git sans dérive. Les autorisations A/B ne couvrent pas les étapes Auth/liens/frontend/recette ci-dessous, qui restent ultérieures.

Références : [audit daté et preuves R01–R16](../validations/AUDIT-SUPABASE-DEV-LOT6-5-2.md), [matrice des écarts](MATRICE-ECARTS-DEV.md), [recette future](PLAN-RECETTE-DEV.md). Base Git de l'audit : `5affd57ee6e3a92d53eb8bddafc029268554c522`. Les faits sont ceux de la lecture du 28 octobre ; les relire avant intervention, surtout après le changement de défauts Data API annoncé pour le 30 octobre. Une approbation de ce document n'est pas une autorisation générale d'exécuter ses étapes.

**Choix 6.5.3.A conservé : solution B, invitations et récupération manuelles sans SMTP externe.** Le choix SMTP est abandonné après le 6.5.2, dont les constats restent historiques. Aucun fournisseur, domaine, Brevo, abonnement ou envoi automatique à installer. Le [générateur et son guide](INVITATIONS-ET-RECUPERATION-MANUELLES.md) sont exclusivement locaux : leur usage hébergé nécessite adaptation, protections et autorisation séparées. La seule écriture hébergée réalisée en 6.5.3.B est la migration personnelle autorisée ; aucune génération de lien ni recette.

## Ordre et responsabilités

L'exploitant peut cumuler décision, opération et contrôle, avec une vérification distincte de cible/résultat à chaque passage. Les identités, adresses d'essai, habilitations, secrets et reçus sensibles restent dans un dossier privé. Aucun rôle formateur ni administration scolaire n'est ajouté.

Ordre proposé : **A préconditions → B base → C Auth → D liens manuels → E frontend local → F recette dédiée → G décision de préparation**. Une phase ne commence qu'après preuve de sortie de la précédente. Une génération de lien, une création de compte et une clôture nécessitent chacune un périmètre explicitement autorisé, même pendant une recette.

## A — Préconditions bloquantes avant la première écriture

| Contrôle futur | Preuve / décision à réunir | Arrêt si |
| --- | --- | --- |
| Cible et version | Vérifier référence exacte dans Dashboard/outil, nom, région ; dernier main/PR retenu et trois checks verts sur cette tête ; préciser opérateur et fenêtre | Référence différente, ambiguïté, nouvel état non expliqué ou diff hors périmètre |
| Autorisation distincte | Mandat daté : DEV seul, migration exacte, réglages nommés, comptes fictifs/adresses et générations/transmissions autorisées, exclusions et droits de nettoyage ; autorisations par phase | Une action n'est pas couverte ; aucun consentement déduit du silence ou de la CI |
| Historique/objets | Relire les trois versions et les catalogues, grants effectifs, policies, fonctions, dépendances ; comparer à l'audit | Version manquante supplémentaire, objet personnel déjà partiellement présent, dérive RLS ou fonction inexpliquée |
| Accès opérateur | Vérification privée du rôle minimal, MFA/récupération, accès support et disponibilité ; aucun secret de CLI dans logs ou commande partagée | Privilège excessif non maîtrisé, secret exposé ou récupération impossible |
| Protection des données existantes | Identifier en privé propriétaires/portées des données d'essai déjà présentes et l'impact ; ne pas les considérer jetables. La lecture du 6.5.2 n'en a inspecté ni identité ni contenu | Donnée réelle découverte, propriété incertaine, demande de nettoyage global |
| Sauvegarde / reprise | Free sans backup restaurable/PITR inclus : choisir une protection proportionnée, confirmer lieux/accès/rétention et perte acceptable. Autoriser séparément sa réalisation et un essai isolé si nécessaire ; vérifier qu'une copie retenue est utilisable | Aucune méthode de reprise évaluée et acceptée ; ne pas présenter un export frontend partiel comme sauvegarde intégrale Auth/DB |
| Retour sûr | Désigner version frontend sûre Auth off, mesure autorisée de suspension serveur si fuite, règles de réconciliation des effacements, assistance et critères de reprise | Simple retour de fichier proposé comme restauration de données ou suppression automatique de tables |
| Déclencheurs automatiques | Relire intégration DEV (off lors de R13), workflows et cible liée ; pas de déploiement Pages ni de migration automatique souhaités | Activation distante inattendue ou partage de cible avec un autre environnement |

Pour six adultes, conserver Supabase Free et les moyens existants. La [copie 6.5.3.B](SAUVEGARDE-TECHNIQUE-SUPABASE-FREE.md) et sa restauration partielle ont été vérifiées avant migration. Auth reste exclu ; le dossier est protégé, dispensé de chiffrement par l’exploitant et déclaré hors cloud. Sept jours jusqu’au réexamen du 5 novembre, sans purge automatique ni validation générale de D07/D08/D13.

## B — Base PostgreSQL

| Migration | Préconditions / dépendances | Effets et risques à expliquer avant autorisation | Méthode future et vérification | Échec / reprise |
| --- | --- | --- | --- | --- |
| `20261022000100_profiles.sql` | Déjà enregistrée et objets cohérents ; racine des identités existantes | Création non idempotente, trigger Auth et backfill ; la rejouer peut échouer/bloquer la création de comptes | **Aucune application** ; relire profil/privileges/triggers seulement | Si dérive, arrêter et ouvrir une analyse séparée ; pas de repair ni de backfill improvisé |
| `20261024083417_create_drill_sync_schema.sql` | Déjà enregistrée ; dépend des UUID Auth et du schéma privé | Tables historiques et premières réponses immuables ; pas de réapplication | **Aucune application** ; conserver 3 tables, 5 fonctions et grants | Même arrêt ; ne pas effacer des séries pour rétablir une migration |
| `20261025143831_create_personal_data_backend.sql` | A/B reçus, copie/restauration partielle vérifiées, Git 65847b8 et deux anciennes versions contrôlés | 6 tables, 2 guards, 6 RPC, 16 policies, 6 triggers ; aucune transformation des tables anciennes | **APPLIQUÉE le 29/10** par CLI 2.121.0, connexion directe explicite verify-full, skip-vault ; [commande et contrôles](RUNBOOK-MIGRATION-DEV-6-5-3B.md) | Code zéro, ledger/objets/droits concordants ; ne pas réappliquer. Tout défaut futur impose diagnostic et intervention distincte |

La préparation du 28 octobre n’avait exécuté aucune commande distante d’écriture. L’intervention du 29 octobre a appliqué une seule fois le fichier, via le ciblage sans identifiants et le secret local décrits dans le runbook. La CLI a utilisé son mode machine sans confirmation interactive ; le contrôle préalable a imposé le delta unique autorisé et le résultat JSON a confirmé ce seul fichier, sans seed/rôles. Ne pas compter sur TTY seul pour une prochaine intervention.

Résultat observé après application de la seule migration manquante : historique à trois versions dans l'ordre ; dix tables ; colonnes/defaults/nullabilité et contraintes validées ; index valides/prêts ; onze triggers applicatifs en incluant Auth ; vingt-quatre policies ; quinze fonctions applicatives (six guards/profils privés et neuf RPC), signatures/attributs/corps comparés au fichier ; grants effectifs attendus. Les guards privés demeurent sans exécution cliente et la création de profils reste le seul definer applicatif attendu. Ne pas confondre `is_revision` pédagogique et révision CAS.

Vérifier les six FK Auth directes nouvelles, la FK botanique composite et toutes les cascades antérieures. Vérifier SELECT et seuls INSERT/UPDATE de colonnes nécessaires ; pas de DELETE étudiant, ni droits d'écrire propriétaire/dates/révision serveur/version. La migration personnelle retire aussi les droits service_role sur ses nouvelles tables : ne pas les réintroduire pour faciliter une inspection. Conserver les REVOKE/GRANT explicites malgré l'évolution Data API ; vérifier schémas exposés et permissions réelles PostgREST sans élargissement global. Les catalogues ne remplacent toujours pas la recette JWT.

La migration n'est pas accompagnée d'une migration inverse. **Aucun rollback automatique de schéma n'est proposé.** Après commit réussi, une panne fonctionnelle conduit à suspendre la recette et diagnostiquer ; suppression des nouvelles tables, restauration ou migration corrective exigent analyse de données et nouvelle autorisation. Ne jamais utiliser `db reset` sur DEV.

## C — Auth : décisions limitées et changements séparés

| Domaine | Proposition après autorisation | Preuve de sortie / garde |
| --- | --- | --- |
| Création de compte | Préserver signup global off, anonymes off, e-mail on, confirmation on et liaison manuelle off. Relire aussi Passkeys/OAuth Server off et vues tiers/hooks sans configuration constatés en R16 | Réglages relus et refus API dédié ultérieur, sans créer de session dans l'audit. Ne pas désactiver le provider e-mail |
| Mot de passe | Minimum 12 conservé. Décider `Secure password change` pour corriger l'écart au contrat local, vérifier les conséquences de réauthentification/nonce. Décision séparée pour exigence du mot de passe courant et composition | Tests invitation/activation/recovery/changement avec comptes autorisés ; ne pas rendre obligatoire un ancien mot de passe inexistant lors de l'invitation/récupération |
| Compromission | Consigner WARN et option Pro+ ; examiner mots de passe uniques/gestionnaire, risque résiduel et besoin réel d'une offre différente | Décision D13 explicite ; pas d'achat, de suppression d'alerte ou de dispense par l'effectif |
| Sessions | Garder 3600 s JWT, rotation on/reuse 10 s pendant préparation, sauf décision distincte. Examiner max/inactivité/session unique et limites Free | Durées motivées ; ne pas recopier 120/60 s ni quotas CI. Tester renouvellement et JWT résiduels dans la recette, aucune promesse de révocation instantanée |
| URLs | Conserver `http://127.0.0.1:4173/mon-bprea/` et l'unique callback exact ; pas de wildcard ou URL publique ajoutée | SiteURL avec slash final, préfixe et liens comparés ; ne remplacer localhost par Pages qu'à la suite d'une décision différente |

Relever avant chaque changement l'ancienne valeur non sensible dans un dossier privé, modifier le seul paramètre autorisé, relire puis tester son effet prévu. Si blocage Auth, suspendre et restaurer uniquement cette ancienne configuration via moyen officiel autorisé ; ne pas ouvrir signup/anonyme pour dépanner.

## D — Liens manuels, sans SMTP externe

1. Valider d’abord l’outil administratif local et les preuves de [6.5.3.A](../validations/VALIDATION-LOT6-5-3A.md) : types fermés, cible, clé privée, confirmation, callback et résultat incertain sans retry. Le programme livré refuse techniquement DEV/PROD ; ne pas supprimer ses gardes pour cette phase.
2. Obtenir ensuite une autorisation propre à la génération de liens DEV, une adaptation dédiée et relue, des protections de cible/habilitation/secret et une liste privée de seules identités fictives. Cette génération peut créer réellement Auth/profil : ce n’est pas une lecture ni une simulation. Aucun camarade, inscription publique ou mot de passe opérateur.
3. Après cette autorisation, générer et transmettre individuellement les seuls liens fictifs par canal privé contrôlé ; remise unique, pas de fichier/trace publique, clipboard automatique ou service d’envoi. Vérifier `hashed_token`, type, callback exact, usage unique et expiration réellement attendue.
4. Recetter activation volontaire dans un navigateur vierge, prévisualisation sans consommation, mot de passe choisi par le titulaire et connexion. Recetter récupération assistée après vérification d’identité, ancien mot de passe refusé, nouveau accepté ; comportement Secure password change à décider séparément.
5. Préparer l’exploitation privée ultérieure et la fermeture juin 2027, après décisions de confidentialité et ouverture distinctes. Aucun SMTP, personnalisation d’e-mail hébergé, essai de délivrabilité Brevo ou envoi automatique aux camarades n’est requis.

En cas d’échec/compte déjà créé/résultat incertain, arrêter, conserver compte/historique et diagnostiquer la seule cible. Aucun remplacement silencieux de lien, retry aveugle, suppression/recréation ou envoi massif. Les templates/capture SMTP locaux restent des régressions historiques, sans modification hébergée.

## E — Frontend DEV local, distinct de Pages

Après B/C/D et autorisation d'artefact d'essai : créer un fichier public local ignoré au format fermé de [auth-config.example.json](../../auth-config.example.json), avec seulement enabled, environment=development, URL DEV vérifiée, **publishable** et SiteURL locale exacte. Obtenir la clé cliente par moyen officiel sans la publier dans la preuve. Ne pas modifier le défaut [assets/auth-config.json](../../assets/auth-config.json), qui reste off et vide.

Préparer un répertoire neuf avec le préparateur existant, versionné par SHA d'essai, sous `/mon-bprea/`, puis servir sur boucle locale. Contrôler allowed-list, absence de docs/env/tests/secrets, clé exclusivement publique, imports/assets/PDF/préfixe et concordance URL navigateur/siteUrl. Ne pas publier cet artefact sur GitHub Pages ni le réutiliser comme artefact public. Utiliser deux profils Chromium temporaires propres, pas le navigateur réel ; serveur arrêté avant E2E au même port. Les commandes locales peuvent être préparées dans le mandat futur après choix du fichier et du dossier, sans substitution d'environnement implicite.

Retour sûr : arrêter ce serveur, revenir à une copie publique Auth off et conserver séparément les caches/outboxes de l'essai. Cela n'arrête **pas** les requêtes d'un ancien client déjà connecté : toute suspension serveur doit être préautorisée et réellement couvrir les JWT encore valides.

## F — Recette hébergée dédiée, après accord distinct

Exécuter le [plan de recette](PLAN-RECETTE-DEV.md) avec comptes fictifs A/B propres à l'exécution, deux appareils A et un contexte anonyme. Ne modifier ni guards ni URLs des runners destructifs existants : ceux-ci restent exclusivement sur la stack locale éphémère. La création, la génération/transmission et le nettoyage sont bornés par autorisation explicite, pas autorisés globalement par le nom « test ».

Scénarios : invitation/activation/connexion/récupération, profil et colonnes protégées, Drill/Dashboard, cours/QCM, botanique, ITK/apparence auto et sombre, outbox/retry hors ligne/deux appareils, A/B et requêtes forgées, export, effacement local. La clôture assistée et la restauration sont des sous-recettes avec autorisation supplémentaire, jamais une dépendance à résoudre en déployant le prototype local.

## G — Preuves de préparation et arrêt final

DEV peut être déclaré **prêt pour la recette suivante**, dans le seul périmètre autorisé, après : identité datée ; historique/définitions/grants vérifiés ; sauvegarde et reprise acceptées ; Auth/URLs relus ; outil administratif hébergé séparément autorisé et validé, périmètre de génération/transmission décidé ; artefact local exact sans secret ; accès opérateur maîtrisés ; plan de tests et nettoyages autorisés ; inconnues/alertes assorties d'une décision. Avant ces preuves, le statut reste non prêt pour le périmètre concerné. Un frontend qui démarre ou la CI éphémère verte ne suffit pas.

Après F, chaque résultat doit indiquer environnement, SHA, date, méthode, preuve minimisée et limite. Les échecs et tests impossibles restent visibles. Une recette hébergée réussie ne lève pas automatiquement D01–D14 ni les quinze P0, et n'autorise ni invitation réelle, fusion, production ni publication de notice.

## Arrêt sûr et retour arrière par incident

| Situation | Action immédiate future | Reprise admissible / limite |
| --- | --- | --- |
| Migration non appliquée | Ne rien lancer si précondition manque ; consigner l'écart et conserver schéma/données | Nouveau créneau/mandat après levée du manque |
| Migration en erreur ou résultat HTTP perdu | Stopper toute chaîne suivante ; relire historique/catalogues et statut de transaction ; pas de retry aveugle | Identifier rollback effectif, commit réussi ou objets partiels ; correction soumise à autorisation, jamais repair pour masquer l'échec |
| Migration appliquée, fonctionnalité en panne | Suspendre recette/sync selon mécanisme préautorisé, préserver données et version d'essai | Diagnostic puis correctif ciblé ou restauration isolée autorisée ; pas de DROP/DELETE automatique |
| Mauvaise configuration Auth | Stopper nouvelles connexions/invitations d'essai ; rétablir seulement valeur antérieure autorisée et relire | Ne pas ouvrir signup/anonyme ni baisser les protections pour obtenir un succès |
| Lien/callback mal configuré | Suspendre génération/transmission et consommation de liens, ne pas les journaliser ; garder comptes existants | Réparer paramètres/générateur après accord, nouvel essai contrôlé ; pas de suppression/recréation de compte pour contourner l'erreur |
| Soupçon RLS, exposition ou réponse étrangère | Arrêt immédiat de la recette ; fermeture de l'artefact local et mesure serveur de confinement préautorisée, incident privé D13 | Analyse privilèges/policies/JWT, correction autorisée, nouvelle recette A/B complète avant reprise ; cacher un bouton ne confine pas l'API |
| Compte fictif inaccessible | Conserver UUID en dossier privé, stopper actions ciblées ; récupération manuelle seulement si autorisée | Vérifier identité/cible puis récupération ; aucune suppression globale ni réutilisation d'un compte historique |
| Futur service déployé en erreur | Aucun déploiement dans ce plan actuel ; si un autre mandat en crée un, stopper l'accès via procédure de ce service | Version sûre/secrets/habilitations et recette revus ; ne pas déverrouiller close-account local |
| Restauration envisagée | Isoler la cible, suspendre accès et synchronisation ; ne pas restaurer dans DEV en guise de test | Réconcilier suppressions depuis preuve minimale privée, réappliquer, contrôler Auth/dix tables/JWT/appareils et B, puis décider reprise. Copies résiduelles explicitement séparées |

Arrêts communs : identité/cible douteuse, secret exposé, données réelles, résultat voisin, historique inattendu, copie/reprise non maîtrisée, succès partiel non expliqué, quota fournisseur bloquant ou opération non autorisée. Dans ces cas, préserver les données et demander une décision portant sur le constat concret. Aucun reset, effacement réel, restauration ou rollback n'est exécuté dans le 6.5.2.
