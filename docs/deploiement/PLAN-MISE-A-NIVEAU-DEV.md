# Plan de mise à niveau Supabase DEV

**PROPOSITION NON EXÉCUTÉE — 28 octobre 2026, lot 6.5.2.** Cible exclusive future : **`wcckbyhrtroittbfophv`**. Le mandat actuel autorise l'audit en lecture seule et sa livraison GitHub. Il **n'autorise aucune étape d'écriture ci-dessous**, invitation, test de session, e-mail, suppression ou déploiement. PROD reste exclu.

Références : [audit daté et preuves R01–R16](../validations/AUDIT-SUPABASE-DEV-LOT6-5-2.md), [matrice des écarts](MATRICE-ECARTS-DEV.md), [recette future](PLAN-RECETTE-DEV.md). Base Git de l'audit : `5affd57ee6e3a92d53eb8bddafc029268554c522`. Les faits sont ceux de la lecture du 28 octobre ; les relire avant intervention, surtout après le changement de défauts Data API annoncé pour le 30 octobre. Une approbation de ce document n'est pas une autorisation générale d'exécuter ses étapes.

## Ordre et responsabilités

L'exploitant peut cumuler décision, opération et contrôle, avec une vérification distincte de cible/résultat à chaque passage. Les identités, adresses d'essai, habilitations, secrets et reçus sensibles restent dans un dossier privé. Aucun rôle formateur ni administration scolaire n'est ajouté.

Ordre proposé : **A préconditions → B base → C Auth → D messagerie → E frontend local → F recette dédiée → G décision de préparation**. Une phase ne commence qu'après preuve de sortie de la précédente. Une livraison d'e-mail, une création de compte et une clôture nécessitent chacune un périmètre explicitement autorisé, même pendant une recette.

## A — Préconditions bloquantes avant la première écriture

| Contrôle futur | Preuve / décision à réunir | Arrêt si |
| --- | --- | --- |
| Cible et version | Vérifier référence exacte dans Dashboard/outil, nom, région ; dernier main/PR retenu et trois checks verts sur cette tête ; préciser opérateur et fenêtre | Référence différente, ambiguïté, nouvel état non expliqué ou diff hors périmètre |
| Autorisation distincte | Mandat daté : DEV seul, migration exacte, réglages nommés, comptes fictifs/adresses et envois autorisés, exclusions et droits de nettoyage ; autorisations par phase | Une action n'est pas couverte ; aucun consentement déduit du silence ou de la CI |
| Historique/objets | Relire les trois versions et les catalogues, grants effectifs, policies, fonctions, dépendances ; comparer à l'audit | Version manquante supplémentaire, objet personnel déjà partiellement présent, dérive RLS ou fonction inexpliquée |
| Accès opérateur | Vérification privée du rôle minimal, MFA/récupération, accès support et disponibilité ; aucun secret de CLI dans logs ou commande partagée | Privilège excessif non maîtrisé, secret exposé ou récupération impossible |
| Protection des données existantes | Identifier en privé propriétaires/portées des données d'essai déjà présentes et l'impact ; ne pas les considérer jetables. La lecture du 6.5.2 n'en a inspecté ni identité ni contenu | Donnée réelle découverte, propriété incertaine, demande de nettoyage global |
| Sauvegarde / reprise | Free sans backup restaurable/PITR inclus : choisir une protection proportionnée, confirmer lieux/accès/rétention et perte acceptable. Autoriser séparément sa réalisation et un essai isolé si nécessaire ; vérifier qu'une copie retenue est utilisable | Aucune méthode de reprise évaluée et acceptée ; ne pas présenter un export frontend partiel comme sauvegarde intégrale Auth/DB |
| Retour sûr | Désigner version frontend sûre Auth off, mesure autorisée de suspension serveur si fuite, règles de réconciliation des effacements, assistance et critères de reprise | Simple retour de fichier proposé comme restauration de données ou suppression automatique de tables |
| Déclencheurs automatiques | Relire intégration DEV (off lors de R13), workflows et cible liée ; pas de déploiement Pages ni de migration automatique souhaités | Activation distante inattendue ou partage de cible avec un autre environnement |

Pour six adultes, rechercher d'abord les moyens déjà disponibles et la perte réellement acceptable. Aucun achat Pro/PITR/SMTP ou création de projet n'est approuvé. Si une copie DB/Auth est nécessaire, son contenu sensible, son stockage, sa durée et sa restauration doivent être autorisés dans un autre mandat : aucun dump n'est produit par cet audit.

## B — Base PostgreSQL

| Migration | Préconditions / dépendances | Effets et risques à expliquer avant autorisation | Méthode future et vérification | Échec / reprise |
| --- | --- | --- | --- | --- |
| `20261022000100_profiles.sql` | Déjà enregistrée et objets cohérents ; racine des identités existantes | Création non idempotente, trigger Auth et backfill ; la rejouer peut échouer/bloquer la création de comptes | **Aucune application** ; relire profil/privileges/triggers seulement | Si dérive, arrêter et ouvrir une analyse séparée ; pas de repair ni de backfill improvisé |
| `20261024083417_create_drill_sync_schema.sql` | Déjà enregistrée ; dépend des UUID Auth et du schéma privé | Tables historiques et premières réponses immuables ; pas de réapplication | **Aucune application** ; conserver 3 tables, 5 fonctions et grants | Même arrêt ; ne pas effacer des séries pour rétablir une migration |
| `20261025143831_create_personal_data_backend.sql` | Seule migration manquante observée ; profils/Drill conformes, schéma privé existant ; aucun objet personnel partiel ; A validée | 6 tables, 2 guards, 6 RPC, 16 policies et 6 triggers ; PK/FK/CHECK/index, cascades Auth, CAS, grants de colonnes. Création transactionnelle, aucune transformation des anciennes tables ni import visiteur. Risques : collision d'objet, manque de droits, verrou/timeout, permission Data API après changement fournisseur | CLI officielle **2.121.0 épinglée** : consulter `--help`, `db --help` puis `db push --help` et documentation courante ; choisir le ciblage explicite DEV réellement supporté et examiner tous les effets. Soumettre commande exacte/delta avant exécution autorisée. Ne lancer une simulation distante que si son absence d'effets est établie et autorisée. Exécuter le fichier versionné via mécanisme officiel d'historique, jamais copier du SQL modifié à la volée | Arrêter sur erreur et capturer seulement code/stade non sensibles ; relire historique et objets. Transaction annoncée ne prouve pas rollback complet ni absence d'acquittement perdu. Pas de relance avant diagnostic |

La méthode est volontairement conditionnée à l'aide de la version réellement utilisée : aucune commande distante, `--dry-run`, `db push`, `db pull`, dump, reset ou repair n'a été exécutée pour préparer ce lot. Ne pas inventer un flag ni pointer un runner local vers DEV. Aucun script automatique de mise à niveau n'est livré.

L'aide **2.121.0** a été lue localement via npm lors du 6.5.2 : `--project-ref`, `--skip-vault` et `--dry-run` existent. Elle indique une mise à jour Vault avant migrations par défaut. Proposition de commande **pour une intervention ultérieure expressément autorisée**, à revérifier avec la même aide, la référence, le SHA et le delta juste avant lancement :

```text
npx --yes supabase@2.121.0 db push --project-ref wcckbyhrtroittbfophv --skip-vault
```

**Cette commande n'a pas été exécutée.** Aucun `--include-all`, `--include-seed`, `--include-roles` ou `--yes` de CLI proposé. La simulation éventuelle ajouterait `--dry-run` **en conservant `--skip-vault`**, seulement après examen des effets et autorisation distincte ; ne pas la lancer dans l'audit. L'opérateur s'authentifie par moyen officiel déjà approuvé, sans saisir un secret dans les arguments journalisés. Le delta doit annoncer uniquement `20261025143831` ; toute autre migration ou demande inattendue impose l'arrêt avant confirmation.

Après application autorisée de la seule migration manquante, obtenir : historique à trois versions dans l'ordre ; dix tables ; colonnes/defaults/nullabilité et contraintes validées ; index valides/prêts ; onze triggers applicatifs en incluant Auth ; vingt-quatre policies ; quinze fonctions applicatives (six guards/profils privés et neuf RPC), signatures/attributs/corps comparés au fichier ; grants effectifs attendus. Les guards privés demeurent sans exécution cliente et la création de profils reste le seul definer applicatif attendu. Ne pas confondre `is_revision` pédagogique et révision CAS.

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

## D — SMTP et modèles

1. Confirmer un fournisseur SMTP existant ou une offre gratuite adaptée à six, avant de recommander un achat : expéditeur/domaine autorisés, quotas réels invitation+récupération, limites de destinataires, SPF/DKIM/DMARC, lieux/transferts, logs/rétention, engagement applicable et récupération opérateur. Le service intégré réservé aux adresses de l'équipe ne convient pas à l'invitation des camarades ; ne pas leur donner un rôle d'administration pour contourner cette limite.
2. Autoriser séparément la configuration SMTP et le stockage des identifiants dans l'interface sécurisée officielle. Aucun secret dans Git, argument partagé, capture ou frontend. Désactiver suivi de clic/pixels/réécritures du fournisseur si applicable et autorisé. Relire les paramètres non sensibles, sans envoyer de message automatiquement.
3. Installer exactement [invite.html](../../supabase/templates/invite.html) et [recovery.html](../../supabase/templates/recovery.html), sujets `Activer votre compte Mon BPREA` et `Réinitialiser votre mot de passe Mon BPREA`. Conserver SiteURL, TokenHash, type correct et échappement HTML ; relire **corps et sujets effectivement enregistrés**, pas seulement un config diff de sujets.
4. Vérifier callback exact, OTP 8/expiration hébergée décidée, absence de fragment de session et de redirection libre. Les modifications de sécurité/notification éventuelles demandent leur propre décision ; aucun template supplémentaire activé par défaut.
5. Seulement après autorisation d'envoi vers une boîte d'essai contrôlée, réaliser invitation et récupération depuis le message reçu jusqu'au formulaire dans un navigateur neuf. Dater livraison/retards, scanner, usage unique et expiration, sans conserver lien/TokenHash ni adresse dans preuve publique. Un lien généré administrativement sans envoi ne prouve pas la livraison.

En cas d'échec, arrêter les invitations, conserver le compte et son historique, vérifier quota/configuration et délivrabilité auprès de l'opérateur. Restaurer un ancien template incompatible n'est pas un état prêt : laisser la recette fermée jusqu'au correctif. Aucun envoi massif, répétition sans borne ou invitation des cinq camarades.

## E — Frontend DEV local, distinct de Pages

Après B/C/D et autorisation d'artefact d'essai : créer un fichier public local ignoré au format fermé de [auth-config.example.json](../../auth-config.example.json), avec seulement enabled, environment=development, URL DEV vérifiée, **publishable** et SiteURL locale exacte. Obtenir la clé cliente par moyen officiel sans la publier dans la preuve. Ne pas modifier le défaut [assets/auth-config.json](../../assets/auth-config.json), qui reste off et vide.

Préparer un répertoire neuf avec le préparateur existant, versionné par SHA d'essai, sous `/mon-bprea/`, puis servir sur boucle locale. Contrôler allowed-list, absence de docs/env/tests/secrets, clé exclusivement publique, imports/assets/PDF/préfixe et concordance URL navigateur/siteUrl. Ne pas publier cet artefact sur GitHub Pages ni le réutiliser comme artefact public. Utiliser deux profils Chromium temporaires propres, pas le navigateur réel ; serveur arrêté avant E2E au même port. Les commandes locales peuvent être préparées dans le mandat futur après choix du fichier et du dossier, sans substitution d'environnement implicite.

Retour sûr : arrêter ce serveur, revenir à une copie publique Auth off et conserver séparément les caches/outboxes de l'essai. Cela n'arrête **pas** les requêtes d'un ancien client déjà connecté : toute suspension serveur doit être préautorisée et réellement couvrir les JWT encore valides.

## F — Recette hébergée dédiée, après accord distinct

Exécuter le [plan de recette](PLAN-RECETTE-DEV.md) avec comptes fictifs A/B propres à l'exécution, deux appareils A et un contexte anonyme. Ne modifier ni guards ni URLs des runners destructifs existants : ceux-ci restent exclusivement sur la stack locale éphémère. La création, l'envoi et le nettoyage sont bornés par autorisation explicite, pas autorisés globalement par le nom « test ».

Scénarios : invitation/activation/connexion/récupération, profil et colonnes protégées, Drill/Dashboard, cours/QCM, botanique, ITK/apparence auto et sombre, outbox/retry hors ligne/deux appareils, A/B et requêtes forgées, export, effacement local. La clôture assistée et la restauration sont des sous-recettes avec autorisation supplémentaire, jamais une dépendance à résoudre en déployant le prototype local.

## G — Preuves de préparation et arrêt final

DEV peut être déclaré **prêt pour la recette suivante**, dans le seul périmètre autorisé, après : identité datée ; historique/définitions/grants vérifiés ; sauvegarde et reprise acceptées ; Auth/URLs relus ; modèles effectivement installés et SMTP prêt avec périmètre d'envoi décidé ; artefact local exact sans secret ; accès opérateur maîtrisés ; plan de tests et nettoyages autorisés ; inconnues/alertes assorties d'une décision. Avant ces preuves, le statut reste non prêt pour le périmètre concerné. Un frontend qui démarre ou la CI éphémère verte ne suffit pas.

Après F, chaque résultat doit indiquer environnement, SHA, date, méthode, preuve minimisée et limite. Les échecs et tests impossibles restent visibles. Une recette hébergée réussie ne lève pas automatiquement D01–D14 ni les quinze P0, et n'autorise ni invitation réelle, fusion, production ni publication de notice.

## Arrêt sûr et retour arrière par incident

| Situation | Action immédiate future | Reprise admissible / limite |
| --- | --- | --- |
| Migration non appliquée | Ne rien lancer si précondition manque ; consigner l'écart et conserver schéma/données | Nouveau créneau/mandat après levée du manque |
| Migration en erreur ou résultat HTTP perdu | Stopper toute chaîne suivante ; relire historique/catalogues et statut de transaction ; pas de retry aveugle | Identifier rollback effectif, commit réussi ou objets partiels ; correction soumise à autorisation, jamais repair pour masquer l'échec |
| Migration appliquée, fonctionnalité en panne | Suspendre recette/sync selon mécanisme préautorisé, préserver données et version d'essai | Diagnostic puis correctif ciblé ou restauration isolée autorisée ; pas de DROP/DELETE automatique |
| Mauvaise configuration Auth | Stopper nouvelles connexions/invitations d'essai ; rétablir seulement valeur antérieure autorisée et relire | Ne pas ouvrir signup/anonyme ni baisser les protections pour obtenir un succès |
| E-mail/callback mal configuré | Suspendre envoi et consommation de liens, ne pas les journaliser ; garder comptes existants | Réparer paramètres/templates après accord, nouvel essai contrôlé ; pas de suppression/recréation de compte pour contourner l'erreur |
| Soupçon RLS, exposition ou réponse étrangère | Arrêt immédiat de la recette ; fermeture de l'artefact local et mesure serveur de confinement préautorisée, incident privé D13 | Analyse privilèges/policies/JWT, correction autorisée, nouvelle recette A/B complète avant reprise ; cacher un bouton ne confine pas l'API |
| Compte fictif inaccessible | Conserver UUID en dossier privé, stopper actions ciblées ; récupération native seulement si autorisée | Vérifier identité/cible puis récupération ; aucune suppression globale ni réutilisation d'un compte historique |
| Futur service déployé en erreur | Aucun déploiement dans ce plan actuel ; si un autre mandat en crée un, stopper l'accès via procédure de ce service | Version sûre/secrets/habilitations et recette revus ; ne pas déverrouiller close-account local |
| Restauration envisagée | Isoler la cible, suspendre accès et synchronisation ; ne pas restaurer dans DEV en guise de test | Réconcilier suppressions depuis preuve minimale privée, réappliquer, contrôler Auth/dix tables/JWT/appareils et B, puis décider reprise. Copies résiduelles explicitement séparées |

Arrêts communs : identité/cible douteuse, secret exposé, données réelles, résultat voisin, historique inattendu, copie/reprise non maîtrisée, succès partiel non expliqué, quota fournisseur bloquant ou opération non autorisée. Dans ces cas, préserver les données et demander une décision portant sur le constat concret. Aucun reset, effacement réel, restauration ou rollback n'est exécuté dans le 6.5.2.
