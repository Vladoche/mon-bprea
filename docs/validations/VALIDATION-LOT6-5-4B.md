# Validation du lot 6.5.4.B — recette DEV partielle

**30 octobre 2026, Europe/Paris — RECETTE PARTIELLE, CORRECTIF OPÉRATEUR VALIDÉ LOCALEMENT.** A et les trois opérations B sont autorisés ; une reprise unique du bootstrap a été autorisée après diagnostic. C et D restent absents. Une invitation A a été générée et remise en mémoire à A1 ; Auth confirme le compte et une connexion. La définition du mot de passe est bloquée par le filtre de recette, reproduite hors ligne puis corrigée. Aucun succès de cette étape n'est revendiqué sur DEV après correction. Invitation B et récupération A non tentées ; aucune mutation pédagogique, migration, modification de configuration hébergée ou suppression. Le [runbook opérationnel](../deploiement/RUNBOOK-RECETTE-DEV-6-5-4B.md) conserve les bornes et critères d'arrêt.

## Exécution partielle et arrêt conservateur — 30 octobre

Frontend testé : **18b0478daf2879c80b5fbb75b2e5bb67993ea112** ; run **r654b-20261030-302521a0f692**, même artefact, mêmes deux adresses approuvées, aucune identité historique ciblée. B reçu : **« Oui j'autorise les trois opérations du point B »**. Les valeurs des clés, liens, JWT, mots de passe, e-mails synthétiques exacts et UUID restent exclus du présent rapport.

Le bootstrap initial s'arrête vers **08:02 Paris**, avant tout créneau ou requête Auth : Chromium est recherché dans le cache vide du sandbox ; `setRawMode EPERM` apparaît ensuite à la fermeture de console. Le même démarrage sans secret réussit hors sandbox, directement puis par le mécanisme imbriqué du formulaire. Réconciliation ciblée zéro/zéro, aucun appel distant antérieur. Plan privé et 27 contrôles synthétiques de reprise, puis accord humain **« Autoriser la reprise unique »**. Un adaptateur privé conserve le marqueur initial et ajoute un verrou exclusif ; aucun fichier de tentative supprimé, compteur réinitialisé ou artefact réétiqueté. La saisie masquée transmet une clé DEV existante au seul processus de confiance ; environnement Chromium filtré.

Préflight vers **08:23–08:26 Paris** : identité/Free/ledger corrects, catalogue et privilèges inchangés, Auth et Data API relus, public et graphql_public cochés, schéma privé exclu, signup/anonyme off, callback local unique. Les indicateurs Data API 0/10 et 0/15 restent une observation d'interface, sans déduction de résultat RLS.

Vers **08:26 Paris**, un seul `generateLink invite/A` est acquitté ; UUID reçu privé, lien remis à A1, URL nettoyée. Le titulaire confirme le lien puis signale **« Le service est injoignable. Vérifie ta connexion puis réessaie. »** après **« Définir le mot de passe »**. Lecture Auth ciblée : un compte A, e-mail confirmé et connexion enregistrée ; B absent. Ces booléens ne prouvent ni l'enregistrement du mot de passe choisi ni une politique RLS. Aucun lien régénéré.

Défaut démontré avec le vrai SDK 2.118.0 et HTTP entièrement synthétique : `updateUser({ password })` émet aussi `code_challenge:null` et `code_challenge_method:null`. Le filtre exigeait la seule clé `password`, bloquait le PUT avant le fournisseur et produisait le message réseau. Avant correction : zéro PUT transmis par la fixture ; après correction : un PUT et activation synthétique réussie. Le filtre accepte uniquement le mot de passe et ces champs **nuls** ; e-mail, métadonnées, nonce et valeurs PKCE actives restent refusés. Aucun changement de droits Auth/Supabase.

Arrêt explicite des quatre contextes et du serveur vers **12:18 Paris**, sans appel administratif de déconnexion ni suppression hébergée. État durable : **1/3 créneaux administratifs réservé, 2 requêtes Auth mutantes comptées, 0/140 mutations pédagogiques**. Les deux créneaux restants ne sont pas réattribués. Compte A et fichiers privés conservés ; sessions/refresh/JWT distants potentiellement résiduels. Toute reprise doit réconcilier ces objets et le lien déjà consommé ; ne pas relancer le run ou rejouer invite A. D reste nécessaire pour un nettoyage ciblé.

Correctif local : **483 tests unitaires/intégration et 85 E2E réussis**, SDK reconstruit identique, régression navigateur avec vrai SDK et garde de recette. Les trois CI de la nouvelle tête doivent être vérifiés séparément ; les verts de 18b0478 ne valent pas pour ce correctif. La recette DEV reste partielle et les scénarios non exécutés ci-dessous ne sont pas validés par les tests synthétiques.

## Historique après accord A — 30 octobre, vers 07:23–07:31 Paris

Accord humain explicite : **« Oui j'autorise le point A avec la protection »**. L'isolation de deux nouveaux UUID et les droits existants, sans nouvelle copie technique, sont acceptés dans le périmètre présenté ; **A n'est plus à redemander**. B/C/D restent absents. Reçu privé rattaché au run et au SHA ; aucune création de compte, lien, session ou mutation pédagogique. Git/main, trois CI, identité/Free/ledger, catalogue complet et privilèges revérifiés : inchangés. Le comptage ciblé des deux adresses synthétiques initiales donne zéro/zéro, sans liste d'utilisateurs ni donnée Auth extraite.

Avant B, la revue a révélé que le lancement Chromium aurait hérité de l'environnement Node, donc d'une éventuelle clé administrative future. **Aucune clé administrative n'était présente et aucun navigateur n'a été lancé avec elle.** Correction préventive : liste fermée d'environnement public pour Chromium et les commandes Git/Python/ACL ; aucune variable privée ou de diagnostic héritée. Test avec un véritable sous-processus synthétique, puis suites rejouées. Le SHA corrigé et ses trois CI seront fixés dans la description de PR ; l'artefact sera reconstruit, sans réutiliser un manifeste d'ancien SHA. Les identités restent deux au maximum et A garde son périmètre ; B portera sur le nouveau run exact. La clé administrative reste à fournir uniquement dans le processus privé, jamais dans le chat.

## Git et périmètre réellement autorisé

| Élément | Observation |
| --- | --- |
| Dépôt / état initial | Vladoche/mon-bprea ; branche précédente 6.5.4.A, worktree suivi propre ; aucun fichier local existant écrasé |
| Fetch / base | `git fetch origin` réussi ; dernier origin/main au départ : **78971e13e0eed7079ee578a1cf4718482ecc8f4f** |
| PR #30 | GitHub : merged=true, closed, merged_at 2026-10-29T19:26:03Z, SHA de fusion identique ; les lots précédents sont dans son historique |
| Branche | `feature/lot6-5-4b-recette-hebergee-dev`, créée depuis origin/main ; pas de travail sur main |
| Mandat reçu | Phase 0 : revue, métadonnées DEV en lecture seule, scripts/artefact/fixtures/procédures/tests locaux |
| A / B / C / D | **A/B reçus le 30 octobre, protection et reprise unique acceptées ; C/D absents.** Les anciennes autorisations 6.5.3.B ne sont pas réutilisées |
| Exclus | Toute opération PROD, compte historique/camarade, SMTP externe, achat, Edge Function, migration/GRANT/RLS, déploiement Pages, fusion et modification de protection main |
| Secrets/copies | Clé administrative saisie localement et masquée, valeur jamais fournie au modèle, au navigateur, à Git ou aux logs ; aucun contenu de la sauvegarde technique consulté/copié ; seules métadonnées et booléens ciblés Auth relus |

La tête finale testée et les résultats CI sont consignés dans la description de PR, sans nouveau commit documentaire qui invaliderait leur référence. Le manifeste d'artefact privé porte le SHA effectivement préparé ; le SHA de base ci-dessus n'est pas une fausse preuve d'exécution de scripts encore non committés.

## État DEV revérifié en lecture seule

Lectures du **29 octobre 2026, environ 20:54–21:08 Paris** : connecteur officiel Supabase (`get_project`, organisation, ledger, catalogue et privilèges en transactions READ ONLY, advisors), puis Dashboard sur la référence DEV exacte. Relevé minimisé de présence à **21:03:41 Paris**. Aucune requête métier/RPC exécutée sur DEV.

Reprise le **30 octobre 2026, vers 06:42–06:47 Paris** : fetch confirme le même origin/main ; identité/ledger, catalogue complet, droits effectifs et défauts ACL relus **identiques** au 29, même WARN sécurité. Dashboard Data API : toujours deux schémas sur trois, auto-exposition on, max rows 1000 et chemins public/extensions ; aucun Save. Le changement de défauts annoncé pour ce jour ne vaut donc pas constat d'application à cette heure sur ce projet. Un nouveau préflight restera indispensable avant B.

| Domaine | Constat effectif / portée |
| --- | --- |
| Identité | `wcckbyhrtroittbfophv`, Mon BPREA DEV, eu-west-1, ACTIVE_HEALTHY ; organisation Free/tier_free ; PostgreSQL 17.11.0.003, moteur 17, canal ga |
| Ledger | Exactement `20261022000100 profiles`, `20261024083417 create_drill_sync_schema`, `20261025143831 create_personal_data_backend` |
| Catalogue | Dix tables public, 98 colonnes, 95 contraintes validées, 24 index valides/prêts, onze triggers, 24 politiques, quinze fonctions applicatives dont neuf RPC ; aucune relation applicative privée/inattendue |
| Comparaison Git | Reconstruction native PostgreSQL 17.11 synthétique depuis les trois fichiers inchangés, puis comparaison exhaustive tables/colonnes/contraintes/index/triggers/policies/routines/corps/signatures/ledger : concordants. Définitions temporelles comparées en UTC ; CRLF normalisés, tableaux d'inventaire triés |
| RLS | Active sur les dix tables ; policies propriétaire authenticated avec USING/WITH CHECK attendus ; aucun DELETE étudiant ou ouverture anon |
| Fonctions | Neuf RPC public invoker, search_path vide, EXECUTE authenticated seulement ; six fonctions privées non exécutables par les trois rôles API ; seul trigger de création profil definer privé attendu |
| Privilèges | Comparaison native : 30 relevés table, 294 colonne, 45 fonction, six schéma concordants. Profils : SELECT propre, UPDATE pseudo seul ; id/dates/INSERT/DELETE refusés structurellement. Aucun élargissement des six tables personnelles à service_role |
| Data API | Dashboard : public et graphql_public cochés, bprea_private non coché ; extra search path public/extensions, max rows 1000, pool automatique, auto-exposition encore on. Indicateurs 0/10 et 0/15 ne prouvent pas le refus d'accès : les ACL ciblées existent ; test JWT/PostgREST réel encore absent |
| Auth | Signup off, anonymous off, manual linking off, confirmation e-mail on, provider e-mail on ; autres providers standards off, aucun custom provider visible |
| URLs | Site local exact `http://127.0.0.1:4173/mon-bprea/` ; unique callback exact `authentification.html`, sans wildcard ni domaine inattendu |
| Liens / sessions | OTP 3600 s ; JWT 3600 s ; rotation refresh on, réutilisation 10 s ; session unique off, maximum/inactivité à never dans Free. Ce sont des valeurs configurées, aucune expiration réellement éprouvée |
| Mot de passe | Secure password change off, require current password off, secure email change on ; aucun paramètre modifié. Composition/minimum exact à relire au préflight privé si leur valeur n'est pas lisible ; aucune extrapolation depuis le local |
| Advisors | Même WARN leaked password protection (option Pro+), six INFO unused_index ; aucune nouvelle alerte RLS. Aucun achat ni index supprimé |

La reconstruction utilise un **nouveau cluster natif uniquement synthétique**, `auth.users(id)` et `auth.uid()` simulés, sans copie de DEV ni accès à l'ancienne sauvegarde. Ce n'est pas Supabase Auth/PostgREST ni pgTAP. Les premiers pipes pg_ctl Windows retenaient le processus ; le cluster a été arrêté puis la commande corrigée en sorties détachées. La comparaison initiale des CHECK affichait le fuseau Paris ; une nouvelle lecture/reconstruction UTC les rend identiques. Aucun écart DEV corrigé ou ignoré. Tous les clusters de cette vérification ont été arrêtés, sans suppression de fichiers ni écoute résiduelle sur le port dédié 65434.

## Risques et protection avant une future recette

Les seuls booléens hébergés lus indiquent : profils historiques présents ; **aucune activité profils/Drill postérieure à 2026-10-29T17:51:03Z** ; **aucune ligne dans les six tables personnelles**. Ni identités ni contenu ni exhaustivité d'une restauration Auth n'en sont déduits. Les comptes historiques restent à préserver.

La [copie 6.5.3.B](EXECUTION-LOT6-5-3B-2026-10-29.md) protège quatre tables avant migration ; elle exclut Auth et les écritures nouvelles. Elle ne devient pas une sauvegarde complète par la présente comparaison. Son contenu n'a pas été lu ; échéance de réexamen le **5 novembre 2026**, sans purge/prolongation implicite.

Protection **acceptée par A** : isoler la recette par deux UUID neufs, aucune suppression/modification globale, budgets stricts et arrêt sur anomalie, limites de reprise et risque résiduel présentés. Une nouvelle copie éventuelle et son stockage/conservation nécessitent un mandat propre ; aucune extraction dans Codex cloud ou CI. Pas de perte d'historique autorisée au motif que DEV est fictif ou Free.

## Dispositif préparé et limites

[scripts/dev-recipe](../../scripts/dev-recipe/contract.mjs) : cible DEV codée et URL/ref indépendantes, callback exact, deux adresses synthétiques de run au domaine réservé, trois slots invite A/B et recovery A, préflight opérateur frais, accords A/B/C explicites, réservation durable avant appel, refus des redirections/listes/suppressions/retries. Clé administrative seulement dans le processus de confiance ; aucun lien affiché dans un rapport, enregistré ou retourné au modèle. Le transfert ponctuel en mémoire vers Chromium isolé et le serveur silencieux ont été exécutés pour le seul lien invite A.

Quatre contextes A1/A2/B1/V, refus des comptes historiques et autres origines, budget 60 requêtes Auth mutantes/140 pédagogiques, pas de batch/DELETE. V et les tentatives A/B doivent atteindre le vrai serveur ; un refus local ne valide pas RLS. Une session consommée/crashée n'est pas relancée aveuglément ; diagnostic ciblé nécessaire. Les scripts historiques locaux, leurs politiques de cible et les trois jobs CI sont conservés.

Le préparateur utilise seulement la configuration publishable locale ignorée, un dossier neuf protégé et l'allowlist Pages existante. Les fixtures contiennent des dates contrôlées, snapshots publics, huit paramètres ITK et UUID stables ; aucun UUID Auth ou historique artificiel n'est injecté. Les scénarios de restauration préparent des intentions jamais envoyées au lieu d'effacer un historique immuable. Le CLI n'est pas une automatisation complète de T03–T12 : assertions et injections réseau/quota/CAS à exécuter séparément dans leurs groupes C autorisés.

## Matrice de recette hébergée

Champs communs actualisés : **30/10/2026 Paris ; frontend SHA 18b0478 ; DEV ; run r654b-20261030-302521a0f692 ; A/B et reprise unique reçus, C/D absents**. T01 n'est exécuté que partiellement ; aucun autre scénario complet. La correction du filtre et les tests locaux ne valent pas résultat DEV.

| ID | Prérequis / composant / attendu | Résultat réel et statut DEV | Limite / décision requise |
| --- | --- | --- | --- |
| T01 | A/B ; invitation, activation volontaire, profil, connexion/logout/reload, cas négatifs | Invite A acquittée, confirmation/connexion Auth relues ; mot de passe bloqué par le garde — **ÉCHEC** du parcours partiel | Correctif local vérifié, non rejoué sur DEV ; B non tenté, autres sous-cas NON EXÉCUTÉS |
| T02 | A/B, progression C ; recovery A, nouveau mot de passe et progression préservée | Aucune récupération — **NON EXÉCUTÉ** | B reçu ; progression C absente, créneau recovery A conservé |
| T03 | A/B/C ; profils/colonnes, dix tables/neuf RPC, A/B/V et témoins | Catalogue/droits seulement concordants ; JWT/REST **EN ATTENTE D'AUTORISATION** | Signup/anonyme négatifs NON EXÉCUTÉS : contingence de création à autoriser séparément ; pas de faux vert d'un refus avant serveur |
| T04 | C ; Drill dix snapshots, premières réponses, entraînements/idempotence, Dashboard | Aucune donnée écrite — **EN ATTENTE D'AUTORISATION** | Calcul sur exercices réalisés, historique conservé |
| T05 | C ; cours done:false, score zéro/meilleur, tentatives/UUID, CAS | Aucune donnée écrite — **EN ATTENTE D'AUTORISATION** | Version récente préservée, aucun dernier horodatage gagnant |
| T06 | C ; botanique, parents/terminaux/fin/révisions, retry et orphelines | Aucune donnée écrite — **EN ATTENTE D'AUTORISATION** | Statuts spéciaux seulement si effectivement exercés, aucun parent inventé |
| T07 | C ; ITK huit champs, apparence auto/clair/sombre/saisons, A2 et CAS | Aucune préférence envoyée — **EN ATTENTE D'AUTORISATION** | Deux domaines distincts, auto conservé |
| T08 | C ; A1/A2, hors ligne/reload/reprise, A→B→A | Seul A1 a confirmé un lien ; convergence/offline non exercés — **EN ATTENTE D'AUTORISATION C** | Contextes fermés sans nettoyage hébergé ; cache et outbox à vérifier |
| T09 | C ; export dix sources + caches, propriétaire, exclusions/deux passes/v1 | Aucun export DEV — **EN ATTENTE D'AUTORISATION** | Multi-page pleine non démontrée par petit volume ; extension de dispositif/budget distincte si nécessaire |
| T10 | C ; analyse/annulation, import compatible, répétition/conflits, JSON A refusé sous B, limites et A2 neuf | Aucun import DEV — **EN ATTENTE D'AUTORISATION** | Séries absentes, CAS avancé, session terminée absente, manifeste/privacy bloqués, Auth non restaurable |
| T11 | C ; réseau/timeout/réponse perdue après commit, quota/CAS/reprise | Aucune injection hébergée — **EN ATTENTE D'AUTORISATION** | Relecture et réconciliation, aucun retry aveugle ni faux acquittement |
| T12 | C + confirmations locales synthétiques ; barrières/cache/ancien JSON | Aucun retrait de cache de compte DEV — **EN ATTENTE D'AUTORISATION** | Clôture hébergée, close-account, purge, restauration PostgreSQL : **HORS PÉRIMÈTRE** |

## Contrôles locaux et livraison

Node **24.22.0**, `npm ci` et installation Chromium réussis. Aucune dépendance ajoutée ; seuls scripts npm dédiés supplémentaires.

| Vérification | Résultat exécuté / limite |
| --- | --- |
| Tests ciblés outils/artefact | **22 tests** inclus dans la passe finale : refus de cibles, préflight/accords, créneau durable, pannes de génération/remise, SDK réel avec transport synthétique, serveur silencieux/préfixe/traversée, fingerprint altéré, CLI fermée, isolation des secrets dans un vrai sous-processus, liens du run, exclusion Pages et PUT natif du mot de passe ; aucune RLS déduite de ces mocks |
| npm test | **483 tests / 47 fichiers** réussis le 30/10 vers 12:18 Paris après correction du filtre SDK ; passe précédente 481 avant recette conservée comme historique seulement |
| npm run test:e2e | **85/85**, environ une minute, huit workers ; passe du 30/10 après npm test ; profils temporaires, HTTP synthétique, aucun appel DEV/PROD |
| npm run build:auth-sdk | SDK 2.118.0 reconstruit ; diff bundle versionné nul |
| Métadonnées PostgreSQL natives | Trois migrations reconstruites ; comparaison catalogue et droits effectifs concordante, cluster arrêté ; Auth simulé seulement |
| Stack Supabase locale complète | Docker absent ; `npm run test:supabase` refuse avant réseau faute de stack/configuration dédiée. **NON EXÉCUTÉ localement**, pgTAP et vrais JWT A/B réservés au job éphémère supabase-security |
| Contrôles finaux | Diff/liens/secrets/artefact public et local, inspection visuelle et résultat des trois jobs sur dernière tête consignés après exécution dans la PR ; aucune réussite anticipée |

La présence des tests de sécurité ne prouve pas leur exécution. Les résultats des trois jobs **unit-integration, e2e, supabase-security** doivent être contrôlés sur la dernière tête, séparément des verts de #30. Aucun secret DEV, preuve sensible ou JSON utilisateur dans Actions. Les migrations, configuration publique désactivée, workflows et protections de main restent inchangés.

## Résidus, décisions et conclusion

Fixtures hébergées créées : **un compte A**, UUID effectivement reçu et conservé en privé ; compte confirmé et connexion Auth observée. Invitation B et récupération A non tentées. Aucune mutation pédagogique envoyée ; aucune donnée hébergée supprimée. Contextes temporaires fermés, dossiers préparatoires/preuves minimisées et clusters arrêtés conservés ; aucune sauvegarde précédente supprimée. Sessions/refresh/JWT distants potentiellement résiduels. Le sort du seul compte A, de ses objets associés et des fichiers privés se décidera au point D sur liste exacte, après relecture ; aucun nettoyage autorisé à ce jour.

**Recette partielle, A/B acquis — activation complète non validée sur DEV.** Le correctif du filtre est vérifié localement ; le run arrêté n'est pas relancé automatiquement et invite A n'est pas rejoué. Préparer une reprise ciblée tenant compte du compte déjà confirmé et du lien consommé, sans changer les bornes ou réattribuer un créneau par défaut. C reste nécessaire avant pédagogie, D avant toute suppression. Toute modification de configuration Auth, nouvelle migration/RPC/RLS/GRANT, copie technique, clôture fonctionnelle ou reprise complète exige un mandat propre.

Les quinze P0 et D01–D14 restent à examiner séparément. Aucun lancement public, validation juridique, camarade invité, abonnement, SMTP externe, fusion ou production. Un défaut démontré peut conduire à **RECETTE PARTIELLE — CORRECTIF REQUIS**, jamais à une modification hébergée pour verdir.
