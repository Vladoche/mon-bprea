# Reprise de la recette DEV — lot 6.5.4.C

**31 octobre 2026 — R/C/C1 exécutés, recette partielle conservée au choix de l'exploitant ; C2 non autorisée, D absent.** Le correctif JSON est vérifié localement et en CI ; aucun frontend corrigé exécuté sur DEV. La [validation](../validations/VALIDATION-LOT6-5-4C.md) distingue les résultats acquis des parcours restants. La matrice **T01–T12 et ses sous-cas** reste celle du [runbook B](RUNBOOK-RECETTE-DEV-6-5-4B.md). Les procédures ci-dessous ne donnent aucun accord de relance.

## Phase corrective après C1

R/C/C1 ont été approuvés et exécutés au frontend **f9bee0ca926e59bfb98c983d7e27b6ff74976624**, continuation **r654b-20261030-5353c94969bc**. Closeout : **3/3 générations, 22/60 Auth, 102/140 tentatives**, deux comptes et 34 lignes. La seconde copie JSON est refusée avant restauration après conflit résolu. Son fichier original et trois intentions absentes sont conservés ; la modification concurrente du cours est déjà acquittée, ne pas la rejouer.

Le correctif local compare exactement le contenu des références hors état transitoire contrôlé et accepte la référence résolue à une archive resolved-operation ; cette archive reste inactive. Avant une nouvelle exécution :

1. Conserver les anciens contextes fermés, closeouts, marqueurs, reçus, compteurs et artefacts. Arrêt C1 : 30/10 à 19:26 UTC ; aucune révocation distante déduite de cette fermeture.
2. Vérifier le correctif localement, le committer et contrôler les trois jobs CI sur la nouvelle tête. Préparer **un artefact distinct**, avec SHA/empreinte propres et filiation vers l'artefact f9bee0ca, dans la même continuation et avec le journal parent commun. Aucun réétiquetage de l'ancien manifeste, nouveau run, compte, lien ou reset.
3. Relever les compteurs restants et les mêmes UUID privés ; relire DEV/schéma/droits/Auth/Data API avant lancement. Aucune clé administrative, migration ou suppression hébergée nécessaire.
4. Présenter **C2** sur SHA/artefact exacts, identités, plan scellé et budgets hérités. Périmètre : T03/T08/T10–T12 restants, analyse des trois intentions du JSON intact mais envoi des **deux seules compatibles** (QCM/Drill) ; la réponse botanique reste bloquée par sa dépendance, sans la retirer ni la réécrire. Données concurrentes conservées, réimport/double clic, refus A sous B, bascule A→B→A avec intention en attente, barrière locale synthétique et expiration seulement si réellement observée.
5. Nouvelle session temporaire, connexions humaines sans mot de passe communiqué. Les intentions locales nécessaires à la bascule gardent UUID/payloads d'origine, préparés sous interruption contrôlée avant envoi. Pas de copie globale d'outbox, suppression d'historique ou nouvelle identité.
6. Autoriser uniquement les RPC/intention prévues, sous plafonds globaux et sous-plafonds conservés. Réserver durablement chaque retry et réconcilier les réponses incertaines avant la suite. Les retraits restent limités aux caches synthétiques sélectionnés, avec aperçu/confirmation ; aucun close-account/DELETE hébergé.
7. Relever les résultats, fermer la phase puis présenter **D distinctement**, avec UUID, lignes/cascades, sessions et objets hors SQL. Aucun nettoyage implicite.

Sans C2, le correctif reste **RÉUSSI EN LOCAL UNIQUEMENT**, restauration finale en attente. Sans D, conserver et documenter les résidus. Copie technique 6.5.3.B : réexamen du 5 novembre inchangé, sans lecture/prolongation automatique.

**Décision reçue le 31/10 : « Je préfère conserver la recette partielle ».** C2 préparée au SHA 5c910b748fae0b7747c8192424e7ecd49c86a520, puis non autorisée/non exécutée ; reçu négatif privé conservé. Aucun lancement, compteur ou marqueur historique réinitialisé. Le nouveau SHA de livraison documentaire ne réétiquette aucun frontend précédemment exécuté. A/B, 34 lignes et fichiers privés restent présents ; D non autorisé. La procédure corrective ci-dessus demeure une proposition, sans lancement automatique.

## État à reprendre

Campagne `r654b-20261030-302521a0f692`, frontend initial `18b0478daf2879c80b5fbb75b2e5bb67993ea112`. Invite A consommée et remise ; compte A confirmé, UUID réconcilié au reçu privé, profil présent. Son mot de passe utilisable reste **inconnu**. B absent, recovery A non tentée, neuf collections pédagogiques vides pour ces seules identités. Les contextes précédents ont été fermés ; aucune ancienne session n'est importée ou exploitée.

| Journal global conservé | Dépensé / plafond | Restant |
| --- | --- | --- |
| Créneaux generateLink | 1 / 3 : invite A | invite B et recovery A, une fois chacun |
| Requêtes Auth mutantes navigateur | 2 / 60 | 58 |
| Tentatives pédagogiques, retries et refus inclus | 0 / 140 | 140, soumises à C |
| Comptes principaux | 1 / 2 | B seulement |
| Lignes applicatives nouvelles | 1 profil constaté / 150 | Plafond global inchangé, jamais réalloué |

DEV exclusif : `wcckbyhrtroittbfophv`, `https://wcckbyhrtroittbfophv.supabase.co`, Mon BPREA DEV, Free, eu-west-1. PROD exclu de tout accès. Les runners locaux/CI restent sur `mon-bprea-lot6-1-local` ; aucun reset, migration, réglage Auth, GRANT/RLS, SMTP, Edge Function, ouverture Pages ou invitation camarade.

## Pourquoi un artefact distinct

La reprise du même manifeste est écartée : son SHA désigne le frontend effectivement utilisé avant le correctif. `artifact.json`, `plan.json`, invite A et tous les reçus historiques restent inchangés. Un nouveau dossier privé contient un artefact au HEAD propre réel et une **filiation**, sans nouvelles identités.

[prepare-continuation.mjs](../../scripts/dev-recipe/prepare-continuation.mjs), exposé par `npm run dev-recipe:continue`, est exclusivement hors ligne. Il refuse tout argument et une clé administrative présente, vérifie l'ancien frontend, les reçus et les compteurs, puis réserve exclusivement `continuation-reserved.json` dans le dossier parent. Il crée un autre dossier à ACL privées, un plan v2, `lineage.json` avec empreintes des preuves nécessaires, les mêmes fixtures/UUID d'intention et seulement la configuration publishable. Il ne copie ni liens, TokenHash, sessions, mots de passe, export ou clé administrative.

`identityRun` reste le run historique ; les adresses A/B sont donc inchangées. Les réservations administratives et compteurs restent **dans le journal parent** : la prochaine requête Auth porte le numéro 003. La session vérifie le plan fermé, SHA/empreintes des deux artefacts, sources de filiation et continuité des numéros. Elle reprend uniquement l'UUID A déjà reçu. Invite A est bloquée avant transport ; aucun quatrième slot ou troisième acteur n'existe.

Une seule préparation et une seule session de continuation sont possibles. `continuation-started.json` est créé exclusivement avant démarrage ; aucun verrou n'est supprimé après panne. Un second lancement concurrent ou après interruption est refusé. Une panne de préparation laisse sa réservation en place et exige diagnostic/mandat distinct : ne pas changer de run ou effacer les marqueurs. Ces empreintes sont des contrôles d'intégrité locaux, pas une signature contre un administrateur du poste capable de réécrire tous les fichiers.

## Préparation avant R

1. Fetch, confirmer #31 fusionnée et branche dédiée depuis main ; conserver le SHA exact testé. Node 24, npm ci, installation et lancement réel de Chromium **sans clé**, dans l'environnement qui sera utilisé.
2. Lire les seuls JSON historiques nécessaires, sans afficher leurs identités/valeurs sensibles ; contrôler invite A présentée, deux réservations Auth, zéro pédagogique et closeout cohérent. Vérifier l'ancien hash frontend.
3. Connecteur officiel DEV : identité/Free/ledger, [catalogue](../../scripts/verification-dev/catalogue.sql) et [droits effectifs](../../scripts/verification-dev/privileges.sql), transactions read only. Comparer définitions, corps, signatures, policies et privilèges, au-delà des nombres.
4. Lecture ciblée des deux adresses historiques : présence A, égalité UUID au reçu privé, confirmation et connexion par booléens, B absent, compte/profil et comptages pédagogiques du run seulement. Un comptage du préfixe exact de **ce run** peut vérifier l'absence d'identité supplémentaire sans retourner d'adresse. Aucun hash de mot de passe, session, JWT, mot de passe ou liste historique.
5. Dashboard DEV : providers/signup/anonyme, URLs exactes, paramètres mot de passe, OTP/JWT/refresh, schémas exposés et Data API ; aucune sauvegarde de réglage. Si un champ est masqué, le déclarer inconnu. Un bandeau d'incident fournisseur impose de réexaminer l'état opérationnel avant mutation.
6. Tests hors ligne puis commit propre ; exécuter `npm run dev-recipe:continue` sans secret administratif. Le nouveau SHA et run sont affichés sans clé/lien ; le plan privé et la description de PR gardent ces références exactes.

La commande ne donne aucun accord et ne lance aucun navigateur connecté. Ne pas lancer `dev-recipe:prepare` pour fabriquer une nouvelle campagne A/B. Ne pas recopier les anciens adaptateurs bootstrap : ils concernent l'ancien SHA.

## Point R — proposition explicite à l'exploitant

Présenter compte A existant/confirmé et mot de passe inconnu, B absent, run parent, nouveau run/SHA, filiation et journal global, 1/3 créneaux et 2/60 Auth consommés, 0/140 pédagogiques. Le changement soumis à R est le nouvel artefact/dispositif ; la cible, les deux identités et plafonds restent ceux d'origine.

Ordre proposé : **invite B → activation volontaire → mot de passe choisi par le titulaire → PUT Auth réel et statut serveur → déconnexion/reconnexion B → recovery A → mot de passe titulaire → connexion A**. B démontre séparément le correctif sur invitation ; A démontre le parcours recovery, éventuellement première définition effective. Aucun ancien mot de passe A connu/valide n'est inventé. Les profils et toute progression doivent être préservés.

R couvre les deux générations restantes, leur remise en mémoire et ces parcours Auth dans A1/A2/B1/V temporaires, sous les budgets globaux. Il ne couvre pas C, D, une nouvelle copie de données, une modification des réglages ou une régénération après incident. JWT/refresh distants antérieurs peuvent subsister ; fermeture locale et déconnexion ne garantissent pas révocation immédiate de tous les accès. Protection proposée : isolation par les deux UUID, aucun accès aux historiques, sans nouvelle copie technique ; sa couverture limitée reste à accepter pour ce changement de dispositif.

**Demander un accord R rattaché au run et au SHA proposés.** L'absence d'accord laisse les mutations hébergées en attente. Après accord seulement, fournir la clé DEV existante par le canal privé masqué de l'opérateur au processus Node ; jamais dans la conversation, argument, fichier ou navigateur. Ne pas prétendre qu'un reçu historique B autorise cette continuation.

## Session après accord R seulement

Les variables de cible et la clé du processus restent celles du runbook B ; `MON_BPREA_DEV_RUN` est le **nouveau** run. Terminal privé interactif, checkout propre au même SHA, aucun diagnostic/trace. Exécuter `npm run dev-recipe:session`, puis saisir `AUTORISER R <run> <sha>` seulement après l'accord humain reçu. Les confirmations de créneau B restent individuelles ; ne pas recopier automatiquement les reçus précédents.

Avant chaque génération, revérifier DEV et renseigner `preflight.json` depuis des lectures effectives de moins de cinq minutes : `absent.B:true` pour invite B, `present.A:true` pour recovery A, identité/schéma/privilèges/configuration/protection relus. La récupération revalide aussi l'UUID/e-mail/confirmation A par une lecture administrative ciblée, après réservation durable et avant generateLink. Un état différent impose l'arrêt.

Le garde conserve exactement `password` et les deux champs PKCE **nuls** ajoutés par SDK 2.118.0. E-mail, métadonnées, nonce inattendu, PKCE actif et champs supplémentaires restent bloqués. Ne modifier ni filtre ni fournisseur pour contourner une erreur. Liens nouveaux uniquement en mémoire, callback exact et serveur silencieux ; ancienne invitation A jamais rejouée.

Le titulaire effectue lui-même les clics d'activation puis la saisie, confirmation et soumission des mots de passe. Aucune capture de ces saisies. Les fichiers `response-auth-NNN.json` du nouveau dossier ne conservent que date, contexte, méthode, chemin sans query et code HTTP. Ils sont rattachés à la réservation globale avant envoi. Un PUT 2xx reçu d'Auth, la cohérence d'identité et une reconnexion réussie sont des preuves distinctes ; le message UI seul ne suffit pas. Une perte de réponse reste incertaine, jamais convertie en réussite.

## C, D et arrêt

Après Auth réussie, demander **C distinctement** sur les UUID privés, groupes/scénarios T03–T12, tables/RPC, fixtures, budget restant, négatifs pouvant écrire, conflits, retraits locaux synthétiques et conditions d'arrêt. Sans C, aucune pédagogie ni test négatif mutateur ; T03–T12 restent EN ATTENTE D'AUTORISATION. Les lectures catalogue ne prouvent pas RLS ; chaque refus doit être attribué à proxy/Auth/PostgREST/RLS/contrainte/RPC selon l'observation réelle.

**D reste absent**. Aucun nettoyage n'est implémenté par ces outils. Présenter séparément les seuls UUID effectivement reçus, lignes/cascades, fichiers locaux et sessions possibles avant toute demande D. Sans accord, conserver et documenter les résidus. La copie technique antérieure n'est ni relue, ni prolongée, ni purgée ; réexamen le **5 novembre 2026**.

Arrêter sur cible/identité divergente, secret, quota, données historiques, configuration/migration inattendue, preuve non persistée, réponse incertaine, RLS suspecte ou accès croisé. Cesser les mutations, fermer contextes et serveur, conserver marqueurs, relire seulement les objets du run puis présenter une nouvelle stratégie à approuver. Aucun retry administratif, reset, suppression ou nouvelle identité de secours.

## Contrats fournisseur relus le 30 octobre

[updateUser](https://supabase.com/docs/reference/javascript/auth-updateuser), [generateLink](https://supabase.com/docs/reference/javascript/auth-admin-generatelink), [verifyOtp](https://supabase.com/docs/reference/javascript/auth-verifyotp), [sécurité des mots de passe](https://supabase.com/docs/guides/auth/password-security), [gestion utilisateur](https://supabase.com/docs/guides/auth/managing-user-data), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Data API](https://supabase.com/docs/guides/api/securing-your-api), [changelog](https://supabase.com/changelog).

Les sources installées `GoTrueClient._updateUser` confirment le PUT avec session et les deux champs initialisés à null ; `GoTrueAdminApi.generateLink` confirme `redirectTo` et la query. La documentation prévoit recovery pour un compte existant et le nonce selon les réglages de réauthentification (session récente : 24 h). Ces contrats ne prouvent aucune réussite DEV. OTP configuré 3600 s ne prouve pas une expiration réellement testée ; un compte confirmé ne justifie aucune nouvelle invitation. Aucune mise à jour SDK ni modification Auth n'est nécessaire pour préparer la continuation.
