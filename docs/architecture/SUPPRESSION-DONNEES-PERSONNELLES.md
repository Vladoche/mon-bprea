# Suppression des données personnelles — lot 6.4.3

**Préparation technique ; activation hébergée bloquée.** Base `7b0bc77fbc3c8c3b341386a5cd681763ecdbc29e`, fusion #22 vérifiée. [Validation exécutée](../validations/VALIDATION-LOT6-4-3.md). Les décisions [D01–D14](../rgpd/DECISIONS-A-VALIDER.md) restent ouvertes. Cette architecture ne décide ni du bien-fondé d'une demande RGPD, ni des exceptions de conservation. Le prototype local ne doit pas être déployé tel quel : il refuse matériellement une URL Supabase hébergée.

## Périmètres indépendants

| Action | Autorisation et effet | Limites |
| --- | --- | --- |
| Déconnexion ordinaire | SDK Auth partagé, `signOut({scope:'local'})` | Retire la session et les vues ; conserve caches, progression et outboxes. Aucun effacement pédagogique ajouté. |
| Effacement personnel de cet appareil | UUID Auth fraîchement vérifié, génération et portée `[environment, origineSupabase, UUID]`, sélection puis confirmation | Aucun DELETE distant ; autres comptes/projets/environnements conservés. Barrière technique locale minimale conservée. |
| Effacement visiteur | Sélection explicite des clés de l'inventaire et confirmation d'autorisation sur appareil partagé | Aucun propriétaire Auth présumé ; aucun retrait automatique lors de la clôture. Pas de nettoyage SDK par motif ni de `localStorage.clear()`. |
| Clôture du compte | Service serveur, nouvelle connexion native avec mot de passe, capacité temporaire puis confirmation irréversible | Suppression Auth et données SQL actives confirmées séparément des caches. Prototype réservé à la stack éphémère. |
| Demande juridique d'effacement | Canal, vérification proportionnée, qualification de la demande et des exceptions par un opérateur habilité | D01/D04/D07/D08/D13/D14 non validées. Une fonction technique ne remplace pas cette procédure, notamment sans accès au compte. |

## Graphe audité et anti-résurrection

Les trois migrations existantes restent **inchangées**, avec leurs contraintes, grants, RLS, RPC invoker et guards des historiques. Aucune nouvelle habilitation DELETE, table sensible ou fonction definer n'est nécessaire.

| Racine / dépendance | Table et clé propriétaire | Cascade réelle à contrôler |
| --- | --- | --- |
| Auth → profil | `profiles.id` | FK directe `auth.users.id`, cascade |
| Auth → Drill | `drill_series.user_id` | FK directe Auth, cascade |
| Série → première réponse | `drill_answers.user_id,series_id` | FK composite vers série, cascade |
| Réponse → entraînements | `drill_training_attempts.user_id,series_id,question_id` | FK composite vers première réponse, cascade |
| Auth → cours | `course_states.user_id` | FK directe Auth, cascade |
| Auth → QCM | `quiz_attempts.user_id` | FK directe Auth, cascade |
| Auth → session botanique | `botanical_sessions.user_id` | FK directe Auth, cascade |
| Auth/session → réponses botaniques | `botanical_answers.user_id,session_id` | FK directe Auth **et** FK composite session, cascades |
| Auth → ITK | `itk_settings.user_id` | FK directe Auth, cascade |
| Auth → apparence | `appearance_preferences.user_id` | FK directe Auth, cascade |

Les guards pédagogiques s'exécutent sur INSERT/UPDATE, pas sur DELETE. L'appel administratif `deleteUser(id, false)` demande une suppression définitive. La suppression de la ligne Auth et ses cascades sont une transaction PostgreSQL : si une cascade échoue, la suppression Auth est annulée. Un INSERT concurrent dépendant d'Auth doit soit précéder le verrou de suppression et être inclus dans la cascade, soit échouer après disparition de sa référence. Un UPDATE déjà en cours doit être terminé avant la suppression de la ligne correspondante. Cette propriété n'est pas une transaction globale avec HTTP/IndexedDB.

Après commit, un JWT ancien peut encore être accepté cryptographiquement par PostgREST ; les prédicats de propriétaire seuls ne prouvent donc pas la fin du compte. Les FK validées vers la racine Auth, y compris les FK composites des dépendants, empêchent la recréation sous l'ancien UUID. L'étudiant ne possède aucun INSERT sur `profiles`, ni privilège permettant de recréer `auth.users`. Aucun transfert d'outbox/import d'A vers un nouveau compte B n'est ajouté. Pas de tombstone serveur identifiable ni de conservation perpétuelle introduite. Toute future modification du graphe, nouveau domaine ou ressource Storage impose une nouvelle recette.

**Preuves distinctes :** pgTAP contrôle le graphe et injecte une panne de cascade avec rollback/reprise sur deux UUID fictifs. Chromium Supabase peuple les dix tables par opérations autorisées, exécute le vrai service, vérifie les dix absences avec JWT étudiant résiduel, conserve B, tente les neuf RPC et INSERT profil, puis reconnecte l'appareil hors ligne. Les tests JavaScript simulés ne prouvent pas ces propriétés SQL.

## Effacement personnel transactionnel

Modules : [erasure-service](../../assets/erasure-service.js), [erasure-store](../../assets/erasure-store.js), [personal-idb](../../assets/personal-idb.js), [privacy-events](../../assets/privacy-events.js). Noms des quatre bases `mon-bprea-*-personal-v1` et store `accounts` conservés. Le schéma IndexedDB passe de **1 à 2**, par ajout non destructif du store `privacy`. Une simple lecture d'export continue à accepter 1/2 sans créer/migrer de base.

1. Sélection explicite ; aucun domaine précoché, visiteur distinct. Vérification Auth serveur fraîche ; ni ancien UUID ni identité `offline` ne suffisent.
2. Lecture du seul `accounts.get(scope)` dans chaque base choisie. Validation du format existant. Résumé des opérations non confirmées, avertissement sur brouillons/conflits/archives/imports et proposition d'export. Un format futur ou une archive non attribuable empêche l'aperçu destructif.
3. Confirmation dans un dialogue natif ; Annuler/Escape n'écrivent rien. Les instantanés bruts restent en mémoire du seul plan, jamais dans l'interface, les messages ou un journal.
4. Nouvelle vérification Auth, verrou Web Locks exclusif `mon-bprea-privacy-v1` avec refus immédiat si occupé/indisponible, message inter-onglets `suspend`. Les quatre services invalident leurs générations, annulent les requêtes, vident les projections privées ; l'export préparé ou en cours est invalidé.
5. Dans chaque base, transaction readwrite **accounts + privacy** : relire exactement la portée, comparer à l'aperçu, vérifier l'identité, retirer le record ou le domaine, écrire `{version,epoch,blocked:true}` sous cette portée. Confirmation seulement dans `transaction.oncomplete`. Pas de `deleteDatabase`, parcours des comptes ou purge d'outbox silencieuse.
6. Message `settled` sans UUID, JWT ou contenu ; chaque service se reconstruit depuis le stockage. La barrière bloque lecture/écriture ordinaire de ce cache, même après reload. Une réponse tardive ou un repository de génération précédente ne peut plus faire un `put` autorisé. Une reprise explicite, après vérification Auth, change l'époque et autorise un nouveau repository ; l'ancien reste refusé. Le serveur peut alors reconstruire les données conservées, sans récupérer le non synchronisé effacé.

Le changement de version ferme les connexions v1 coopérantes par `versionchange`. Un ancien script tentant de rouvrir explicitement v1 échoue avec `VersionError`. Une connexion ancienne qui ne ferme pas bloque l'upgrade : résultat bloqué, jamais succès ; l'upgrade reçu après abandon est annulé et ne supprime rien tardivement. Les scripts de même origine capables de contourner volontairement les stores restent hors de cette barrière applicative, comme pour toute donnée locale non chiffrée.

**Paramètres partagés :** ITK/apparence sont deux choix, un même record. Le retrait d'un seul domaine enlève ses valeurs, remote, opérations, conflits, preuves d'import et archives attribuées ; l'autre domaine est préservé et le timestamp de réconciliation partagé invalidé. Une archive sans domaine ou un champ racine inconnu interdit ce retrait partiel, sans deviner sa propriété. Le service de paramètres entier reste suspendu jusqu'à reprise explicite, pour éviter qu'une ancienne projection réintroduise le domaine retiré.

Chaque base est une transaction distincte ; un échec sur une des quatre ne restaure pas celles déjà effacées. Résultats `complete/partial/failed`, détail par catégorie et plan détruit après exécution. Une modification après aperçu donne `changed` et impose un nouvel aperçu, en conservant la nouvelle opération. Un appel déjà envoyé au serveur peut y être appliqué malgré l'annulation réseau ; l'effacement local ne prétend pas supprimer ces lignes distantes.

### Métadonnée locale minimale et appareils

`privacy[scope]` conserve uniquement une époque aléatoire et le statut de suspension, sans réponses, pseudo, e-mail ou token. La portée contient toujours un UUID : **ce marqueur est une donnée personnelle technique**, pas une anonymisation. Son époque reste après reprise pour refuser les anciens writers. Durée fonctionnelle observée : jusqu'au retrait des données du site/profil navigateur ; durée nécessaire et modalité future de retrait à valider D07/D08, notamment fermeture vérifiée des anciens clients. Aucun TTL destructif improvisé. L'export 6.4.2 des données pédagogiques reste inchangé ; la nouvelle métadonnée de coordination n'est pas présentée comme couverte par ce fichier partiel et relève de la procédure complémentaire de droits.

Un appareil absent conserve ses propres caches et éventuellement une outbox. Au retour en ligne, `getUser` refuse le compte supprimé ; `user_not_found` est traité comme une identité invalide et les vues privées disparaissent. La synchronisation est suspendue, les anciennes opérations restent dans leur portée et ne sont pas rattachées à un nouveau compte. Le prototype propose l'effacement personnel **avant** la clôture ; après disparition de l'identité, il n'autorise pas un effacement arbitraire par ancien UUID. Le retrait complémentaire nécessite le contrôle légitime du profil navigateur et une procédure d'assistance à valider, sans suppression automatique des données visiteur/tiers. Aucune interface d'effacement non authentifié d'un cache personnel n'est introduite.

## Visiteur et provenance

Les neuf clés fermées de [export-sources](../../assets/export-sources.js) couvrent Drill, progression, botanique, ITK, apparence, ancien thème, anecdote et les deux provenances. Chaque clé est choisie séparément, relue avant retrait, retirée par `removeItem` puis contrôlée absente ; la sélection ne lit ni ne retire les clés SDK. Retirer la provenance ne retire pas les copies déjà importées. Garder une provenance après retrait de sa source est possible et annoncé ; un nouvel import reste soumis aux garde-fous existants.

localStorage ne donne pas de transaction multi-clés ; les erreurs sont partielles et explicites. Les services actuels relisent la source après coordination ; une **nouvelle action volontaire** en visiteur peut créer une nouvelle sauvegarde. Les anciens onglets doivent être fermés : contrairement à IndexedDB, localStorage n'a pas de version permettant d'interdire les anciens scripts non coopérants. Cette limite est affichée ; aucune promesse d'absence permanente de nouvelles sauvegardes visiteur.

## Protocole serveur local de confiance

Entrée [close-account/index.ts](../../supabase/functions/close-account/index.ts), contrat [closure-handler.js](../../supabase/functions/_shared/closure-handler.js). SDK `2.118.0` épinglé, CLI **2.121.0** effectivement interrogée avec `--version` et `functions serve --help`. Documentation actuelle consultée avant implémentation. Le wrapper récent `@supabase/server` est documenté ; le choix ici est une vérification **explicite avec `getUser(token)`**, en plus du contrôle gateway `verify_jwt=true`, sans ajouter de bibliothèque de production au site.

| Phase | Contrôles et résultat |
| --- | --- |
| Activation | `BPREA_CLOSURE_MODE=ephemeral-local`, URL API interne locale strictement autorisée, origine exacte `http://127.0.0.1:4173`, clé AES-GCM 256 bits générée pour le run. Sinon 503. Aucun commutateur d'activation hébergée. |
| Transport | POST uniquement, origine exacte, Bearer, JSON borné à 8 Kio y compris sans Content-Length ; schéma de corps fermé. OPTIONS ne supprime rien ; GET refusé. CORS n'est pas utilisé comme preuve d'identité. |
| Préparation | Corps exact `{action:'prepare',password,confirmation:'SUPPRIMER'}`. `getUser` serveur vérifie le JWT ; adresse choisie depuis cet utilisateur, jamais depuis le client. Nouvelle `signInWithPassword` native sur client serveur sans persistance ; UUID retourné identique exigé. Pas d'OTP artisanal, pas de `user_metadata`. Compte anonyme ou MFA vérifié non pris en charge : refus. La session supplémentaire de réauthentification est fermée. |
| Preuve | Capacité chiffrée/authentifiée AES-GCM, liée à l'origine et à SHA-256 du JWT exact, UUID serveur, nonce, instants. Validité maximale cinq minutes, bornée par `exp` du JWT ; au moins 30 s restantes exigées à la préparation. **Fenêtre d'autorisation technique**, pas durée de conservation juridique. Aucun JWT/mot de passe dans cette capacité, aucun stockage persistant de demande serveur. |
| Exécution | Corps exact `{action:'execute',receipt,confirmation:'SUPPRIMER'}`. Déchiffrer/valider la capacité et le JWT exact. Inspecter l'état. Si Auth est présent, refaire `getUser` et comparer à la cible liée ; seuls ces contrôles permettent l'appel administratif hard-delete. Aucun UUID libre dans l'API. |
| Contrôle | `admin.getUserById` doit retourner l'absence Auth précise ; dix SELECT `head/count:exact`, owner explicite, sous le JWT étudiant original doivent tous renvoyer zéro. Les RLS de propriétaire et FK connues sont une condition de ce contrat, vérifiée par les tests SQL ; ce contrôle doit être revu si le schéma change. Une erreur, count null ou table manquante empêche la confirmation. Aucun nouveau grant SQL pour `service_role`. |
| Reprise | Même capacité et même JWT, pendant leur fenêtre. Si compte absent et dix comptes à zéro, retourner la confirmation **sans nouvelle suppression**, même après perte d'acquittement/getUser devenu impossible. Une course de doubles demandes refait l'inspection avant de refuser une identité disparue. Si identité présente/divergente, preuve fausse/expirée ou état incomplet : refus/non-confirmé. |
| Fin client | Confirmation serveur indépendante de `signOut`. Nettoyage SDK via service existant ; échec local de session signalé. **Aucun cache ni visiteur retiré automatiquement**. Résultat explicite « serveur confirmé, nettoyage local non effectué ». Le parcours local séparé peut être exécuté préalablement. |

La capacité est une autorisation de clôture déjà réauthentifiée, valable brièvement ; effacer une session locale ne la rappelle pas. Perte de la capacité, changement de clé, expiration ou fermeture de page : pas de nouvelle cible/reprise privilégiée improvisée, traitement manuel à valider. Le client garde la capacité seulement en mémoire, la retire au changement vers un autre UUID et à pagehide. Aucun résultat privé d'export ne peut être remis après invalidation. Un changement A→B→A ne restaure ni l'export ni une ancienne capacité.

**Atomicité bornée :** aucun état « clôture en cours » en table n'est requis avant la suppression Auth, car l'unique mutation serveur est la suppression transactionnelle de cette racine et ses cascades. Les états d'interface sont identité vérifiée, clôture en cours, serveur confirmé/non confirmé, nettoyage local non effectué/fin de session incomplète. Une panne avant Auth laisse les données actives ; une panne de cascade annule Auth ; une panne HTTP ou de vérification après commit reste non confirmée jusqu'à une inspection réussie. Aucun succès déduit d'une déconnexion. Pas de retries automatiques illimités.

## Auth, Storage, journaux et sauvegardes

La suppression native Auth traite son utilisateur et les dépendances internes gérées par Supabase. Ce dépôt ne manipule ni mots de passe hachés, ni identités/refresh tokens par SQL direct. La disparition de sessions/identités internes et leurs journaux doit être qualifiée avec la version fournisseur ; on ne présente pas `getUserById` comme un audit de tous les objets internes. JWT déjà émis et logs restent distincts. Le site n'utilise pas Storage et la stack locale le désactive ; **aucun bucket ou objet fictif n'est inventé**. Supabase documente qu'un propriétaire d'objets Storage ne peut pas être supprimé ainsi : si de telles ressources apparaissent, le service doit échouer et demander une procédure revue.

Backups, PITR, logs Auth/PostgREST/Edge, sécurité et copies opérationnelles ne sont pas supprimés par le contrôle des dix tables. Obtenir du prestataire plan, contenu, lieux, délais, possibilité de restriction, sort d'une suppression dans les backups et preuve de sortie de rétention. Ne pas enregistrer JWT, mot de passe, capacité, UUID cible, contenu effacé ou corps d'erreur dans les logs du service. Les compteurs et stades de tests ne contiennent que des fixtures, pas une preuve nominative à conserver sans règle.

**Restauration à préparer avant activation :** isoler la restauration, désactiver accès et synchronisation, réconcilier avec les demandes de suppression autorisées postérieures au point restauré dans un dossier restreint, réappliquer les suppressions et contrôler les dix tables/Auth avant réouverture. D07/D08/D13 doivent définir source fiable, habilitations, minimisation, durée de ce suivi et preuve. Ce mécanisme opérationnel n'est pas développé ni réputé résolu ici ; sans lui, une restauration pourrait réactiver un ancien compte. Aucun registre perpétuel créé par commodité.

## Sources officielles, consultées le 27 octobre 2026

- [RGPD, chapitre III sur CNIL](https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre3) : articles 12 (modalités/délais/vérification), 17 (motifs et exceptions), 19 (information des destinataires selon conditions). [EUR-Lex](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679) a opposé une vérification antirobot ; lecture du texte sur CNIL.
- [CNIL, effacement](https://www.cnil.fr/fr/comprendre-mes-droits/le-droit-leffacement-supprimer-vos-donnees-en-ligne) et [conservation](https://www.cnil.fr/fr/passer-laction/les-durees-de-conservation-des-donnees) : portée conditionnelle, finalités et séparation des phases ; aucun délai de conservation Mon BPREA déduit automatiquement.
- [Supabase, suppression d'utilisateur](https://supabase.com/docs/guides/auth/managing-user-data), [API deleteUser](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser), [connexion native](https://supabase.com/docs/reference/javascript/auth-signinwithpassword), [sessions](https://supabase.com/docs/guides/auth/sessions) : privilège serveur, JWT résiduel et sessions distincts.
- [Edge Functions, sécurité](https://supabase.com/docs/guides/functions/auth), [secrets](https://supabase.com/docs/guides/functions/secrets), [CLI locale](https://supabase.com/docs/reference/cli/supabase-functions-serve). [Changelog](https://supabase.com/changelog) consulté après tentative `.md` ; changements de gateway auto-hébergée et Data API repérés, pas d'adaptation arbitraire d'un projet hébergé. Le résultat du runtime CLI local fait foi dans la recette.

Correspondance exhaustive avec les catégories A01–X09 : [matrice des droits](../rgpd/PREPARATION-DROITS.md). Conservation et responsabilités : [projet de politique](../rgpd/POLITIQUE-CONSERVATION-PROJET.md). L'activation reste bloquée, même si les tests techniques passent, jusqu'aux décisions opérationnelles/juridiques et validations ultérieures autorisées.
