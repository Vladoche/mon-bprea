# Validation du lot 6.5.4.C — reprise sécurisée de la recette DEV

**Bilan du 4 novembre 2026 : correctif JSON validé contre Supabase DEV ; T03/T08/T10/T12 C2 réussis. Expiration JWT T11 NON EXÉCUTÉE, report explicitement choisi par l'exploitant.** Banc fermé, deux comptes fictifs A/B et **36 lignes** conservés, D non autorisée et non exécutée. Aucun accès PROD, déploiement Pages ou invitation réelle. Les autres limites historiques restent explicites ; tous les sous-cas du lot ne sont pas déclarés acquis.

## Reprise du 4 novembre — provenance et accords

L'audit local, la consultation GitHub, la lecture DEV, la préparation locale puis C2 ont reçu leurs accords successifs. Campagne **r654b-20261030-302521a0f692**, continuation **r654b-20261030-5353c94969bc** : le dispositif privé **C2-reprise-20261104** n'est pas un nouveau run. Le refus C2 du 31 octobre est conservé, la nouvelle décision ajoutée séparément. Aucun compteur ni marqueur consommé n'a été réinitialisé.

| Référence distincte | SHA / observation vérifiée le 4 novembre |
| --- | --- |
| HEAD local avant/après le checkout temporaire ; tête finale de PR #32 | **fd7e41dff4cd022eeb93e08712b491fd78a28b09**, branche feature/lot6-5-4c-reprise-recette-dev |
| Commit du correctif JSON | **30333b4ecfffb0107b19ec7a018df774b618db1d** |
| Fusion distante [PR #32](https://github.com/Vladoche/mon-bprea/pull/32) et `main` observé | **04c1acab86dc3f013fa9ed76f82fced69a710f63**, fusion le 31/10 à 09:14:50 UTC ; arbre **4b75f38c160d6f95238122b7cc7b74cb15c327ad**, identique à fd7e41d |
| Frontend C2 préparé puis réellement exécuté en navigateur | **5c910b748fae0b7747c8192424e7ecd49c86a520** |
| Empreinte de cet artefact frontend conservé | **544a72e3adeab34b9cb5d09a2eb50ce106ae3199afdb16def38862a03a0cc7ef** |
| Dernier frontend exécuté contre DEV avant cette reprise | **f9bee0ca926e59bfb98c983d7e27b6ff74976624** |
| Plan de reprise scellé | **77075ff015c4e91796ef710452f953fdbb950bb704d7f94728cbc89674567949**, lié au plan original **9e7902c0b20ab9777397ae5f268a08292b85c44c35f416bbcf51889b47551416** |

Le frontend 5c910b7 a été servi **localement**, sous `http://127.0.0.1:4173/mon-bprea/`, avec l'API du seul projet DEV **wcckbyhrtroittbfophv**. Aucun déploiement sur un hébergement DEV ou Pages. Aucun fetch/pull/push, lancement de CI, nouvelle fusion ou accès PROD pendant la recette du 4 novembre ; sa livraison Git est distincte. Le checkout temporaire a été fermé puis la branche d'origine rétablie sans déplacer sa référence ; seules les actualisations documentaires sont ajoutées au worktree.

## CI distante rapprochée le 4 novembre

Les quatre runs, tentative 1, ont été consultés et sont réussis. Les checkout des jobs PR sont des fusions temporaires, distinctes des têtes de code.

| Code rapproché / checkout CI réel | Qualité : unit-integration / e2e | Sécurité : supabase-security |
| --- | --- | --- |
| C2 **5c910b7** ; checkout **6897d35a79d93636f58f4580f7bcd22b0547689b**, arbre identique **72e97eabf0079dc75b4405d1f99d7e8aecad567b** | [Run 41186409484](https://github.com/Vladoche/mon-bprea/actions/runs/41186409484) : [124494120733](https://github.com/Vladoche/mon-bprea/actions/runs/41186409484/job/124494120733) / [124494120593](https://github.com/Vladoche/mon-bprea/actions/runs/41186409484/job/124494120593) | [Run 41186409473, job 124494120489](https://github.com/Vladoche/mon-bprea/actions/runs/41186409473/job/124494120489) |
| Tête finale **fd7e41d** ; checkout **571c547fc5988e8bc4fe1b26f3deb344e4c1c213**, arbre identique **4b75f38c160d6f95238122b7cc7b74cb15c327ad** | [Run 41187268830](https://github.com/Vladoche/mon-bprea/actions/runs/41187268830) : [124496617980](https://github.com/Vladoche/mon-bprea/actions/runs/41187268830/job/124496617980) / [124496618266](https://github.com/Vladoche/mon-bprea/actions/runs/41187268830/job/124496618266) | [Run 41187268828, job 124496618087](https://github.com/Vladoche/mon-bprea/actions/runs/41187268828/job/124496618087) |

Résultats : **499 tests / 49 fichiers**, **85 E2E** ; sécurité **386 assertions pgTAP et 31 parcours Supabase éphémères**. Cette CI reste distincte de C2 et ne déploie pas le site.

## Préflight et exécution C2 observés

Avant le démarrage unique : DEV ACTIVE_HEALTHY, Free, eu-west-1 ; catalogue et privilèges complets identiques aux références après normalisation des ordres/fins de ligne. Trois migrations, dix tables, 98 colonnes, 95 contraintes, 24 index, 11 triggers, 24 politiques et 15 fonctions dont neuf RPC conservés. RLS et privilèges de colonnes de profiles inchangés. Auth et Data API relus sans Save : signup/anonyme/manual linking désactivés, JWT 3600 s, rotation activée/réutilisation 10 s, public/graphql_public exposés et bprea_private non exposé. Aucun réglage changé.

Lecture ciblée initiale du **04/11 à 18:10:36 UTC** : mêmes deux UUID/adresses confirmés, **24 lignes A et 10 B**, dix témoins B inchangés, trois intentions d'origine encore absentes et cours concurrent déjà confirmé à la révision 6. Préflight âgé de moins de cinq minutes au lancement. Les lectures administratives ne sont pas présentées comme des preuves RLS.

Les connexions ont finalement été automatisées à la demande de l'exploitant par collage aveugle du même mot de passe fourni dans son presse-papiers local. Aucun contenu du presse-papiers, mot de passe ou JWT lu, affiché ou enregistré par l'outil de saisie. Les gardes du contrôleur sont restés actifs. Les outils opérateurs complémentaires, privés et tracés, n'ont créé aucun contexte ni modifié aucune route ; les six sources scellées sont intactes.

Le contrôle natif des fenêtres Chrome échouait sur leur identification. Le premier outil de saisie a ensuite perdu son observation pendant une connexion B : le POST Auth **27 a répondu 200**, puis l'identité B a été vérifiée par le scénario suivant, sans répétition. Le contrôle automatique a refusé sa réouverture ; après l'accord supplémentaire **« Oui, connecter A et poursuivre les tests »**, la seule connexion A suivante a été soumise une fois. Les anciens reçus, l'arrêt et les versions de l'outil sont conservés. C2 n'a pas été redémarrée.

| Scénario restant | Résultat réellement observé le 4 novembre | Portée / limite |
| --- | --- | --- |
| T03, lectures après peuplement | **RÉUSSI SUR DEV** : 50 SELECT réels sur dix tables ; zéro ligne étrangère et zéro donnée personnelle visiteur, réponses visiteur 401 | Aucun nouveau négatif mutateur ; JWT distincts des catalogues administratifs |
| T08, A→B→A | **RÉUSSI SUR DEV** : ITK 300/100/300 ; deux intentions A en attente gardent les mêmes UUID/payloads ; aucun envoi A sous B ni écriture pédagogique par la bascule | Le blocage réseau local n'est pas un refus RLS ; aucune nouvelle preuve d'une réponse A déjà en vol pendant la bascule |
| T10, correctif et JSON original | **RÉUSSI SUR DEV** : analyse/annulation sans écriture ; confirmation/double clic produisent exactement deux RPC réelles, **personal_record_quiz** et **drill_record_answer**, HTTP 200 sous A ; mêmes identifiants/corps d'origine, une ligne chacun | Botanique toujours bloquée par sa dépendance ; cours révision 6 et UUID techniques des séries conservés, aucune archive réveillée |
| T10, répétition et identité | **RÉUSSI SUR DEV** : reload/réanalyse sans doublon ni nouvel envoi, application désactivée ; JSON A refusé sous B ; import/export désactivés en visiteur ; B inchangé | Refus du fichier applicatif ; aucune tentative d'écriture croisée n'en est déduite |
| T12, cache synthétique et privacy | **RÉUSSI** : aperçu/annulation sans perte puis seul ITK local A1 retiré, zéro opération non confirmée sélectionnée ; apparence/autres domaines/B/serveur conservés ; ancienne copie refusée avant/après reprise explicite des caches | Contexte temporaire seulement ; aucun DELETE hébergé ou close-account. Aperçu et confirmation automatisés à la demande de l'exploitant |
| T11, expiration JWT réelle | **NON EXÉCUTÉE** ; choix explicite **« Terminer avec l'expiration non exécutée »**, puis **« On finira ce dernier contrôle plus tard »** | Le contrôle automatique avait refusé la sonde anticipée ; aucune sonde d'expiration envoyée ni durée accélérée. Ne pas déclarer ce sous-cas acquis |

Captures de l'aperçu répété et du retrait ITK examinées visuellement ; preuves privées ignorées. Les interruptions/export annulé précédemment acquis n'ont pas été rejoués.

## Closeout C2, budgets et D

Serveur, navigateur temporaire, contrôleur et outil de saisie arrêtés. La relecture ciblée du **04/11 à 18:43:46 UTC** confirme **26 lignes A + 10 B = 36**, les dix témoins B identiques, QCM/Drill uniques, botanique absente et cours révision 6 conservé.

| Budget cumulatif | Final | Dépense C2 / reste global |
| --- | --- | --- |
| Comptes / liens administratifs | **2/2 ; 3/3** | Aucun compte/lien ajouté ; zéro lien disponible |
| Auth mutantes | **29/60** | **7** sur le plafond additionnel de 18 ; **31** restantes |
| Tentatives pédagogiques | **104/140** | **2** sur le plafond additionnel de 8 ; **36** restantes |
| Groupe JSON | **8/14** | 6 avant C2 ; autres groupes inchangés : RLS 49, Drill 8, cours 11, botanique 12, paramètres 12, appareils 0, interruptions/privacy 3, réserve 1 |
| Lignes applicatives | **36/150** | Deux créations : drill_answers (A 3/B 1) et quiz_attempts (A 6/B 1) ; autres comptages historiques inchangés |

**D NON AUTORISÉE / NON EXÉCUTÉE.** Inventaire privé daté : deux cibles exactes liées au run, lignes par table, onze FK/cascades, **sept lignes de sessions A et quatre B**, zéro objet Storage chacun, deux JSON originaux et archives/artefacts/preuves locaux. Un nombre de sessions ne prouve pas leur validité ; fermer le banc ne révoque pas immédiatement les JWT distants. Toute identité historique et PROD sont exclus. Les copies téléchargées et preuves locales survivraient au nettoyage hébergé ; aucune purge implicite. Copie technique 6.5.3.B non consultée/prolongée/purgée, réexamen du 5 novembre maintenu.

Après fermeture, **1 635 fichiers historiques**, les six sources scellées, l'artefact C2 et le JSON original ont été revérifiés intacts. Nouveaux reçus ajoutés au même journal cumulatif. Références privées : C2-closeout-review.json, postcheck-response-001.json, expiry-decision-001.json et D-preparation-private-20261104.json sous le dispositif ignoré ; aucun secret ou contenu individuel dans Git.

Tests locaux exécutés le 4 novembre pendant la préparation : Node **24.22.0**, **npm ci** hors ligne réussi, **npm test 499/499 (49 fichiers)** puis **npm run test:e2e 85/85**, dix groupes hors ligne de gardes réussis. Le premier démarrage E2E refusé sur localhost n'est pas compté comme réussi ; l'exécution autorisée suivante a passé les 85 cas. Suites Supabase locales réelles **NON EXÉCUTÉES** faute de CLI/Docker, aucun runner redirigé vers DEV. Code applicatif inchangé pendant cette reprise ; Auth publique désactivée.

**Décision : correctif JSON validé sur DEV, bilan C2 terminé avec T11 explicitement reporté.** Une future sonde aura son mandat ciblé, des compteurs/identités frais et un JWT signé gardé uniquement en mémoire jusqu'à expiration réelle ; ne pas relancer les marqueurs C2 consommés ni générer de lien. D reste séparée. Les négatifs Auth, autres limites historiques et P0/D01–D14 ne deviennent pas validés ; aucune ouverture ou mise en production autorisée.

## Historique arrêté au 31 octobre 2026

Les sections suivantes conservent les constats à cette date. C2 non autorisée, 22/60 Auth, 102/140 tentatives et 34 lignes y décrivent l'état historique, remplacé pour la reprise par les observations ci-dessus.

**Bilan du 31 octobre 2026, Europe/Paris : recette partielle conservée au choix explicite de l'exploitant ; C2 non autorisée et non lancée.** Auth revérifiée sur DEV, défaut JSON corrigé localement et vérifié en CI ; ses contrôles DEV restants ne sont pas exécutés. Aucun nettoyage D, fusion, déploiement ou ouverture publique. Les constats du [lot B](VALIDATION-LOT6-5-4B.md) restent inchangés.

## Provenance, cible et accords

| Élément | Référence conservée |
| --- | --- |
| Dépôt / branche | Vladoche/mon-bprea ; feature/lot6-5-4c-reprise-recette-dev ; PR #32 |
| Base vérifiée après fetch | origin/main **3414fc09a245b86634ccf21f0ee083359c85fe10**, fusion #31 ; tête précédente b92bcf32171df84628f0f13068dc6a6aab4a79ed |
| Campagne historique / frontend incident | **r654b-20261030-302521a0f692** / **18b0478daf2879c80b5fbb75b2e5bb67993ea112** |
| Continuation / frontend exécuté R, C et C1 | **r654b-20261030-5353c94969bc** / **f9bee0ca926e59bfb98c983d7e27b6ff74976624** |
| DEV exclusif | **wcckbyhrtroittbfophv**, Mon BPREA DEV, eu-west-1, Free ; https://wcckbyhrtroittbfophv.supabase.co |
| Filiation | Ancien artefact et 14 empreintes historiques conservés ; mêmes deux identités/fixtures ; réservations exclusives fsync dans le journal parent commun |
| R | Accord explicite reçu pour invitation B puis récupération A au SHA ci-dessus ; reprise unique du démarrage approuvée, sans nouvelle opération administrative |
| C | Accord explicite reçu avant T03–T12 : A/B existants, plafonds historiques, copies JSON privées et retraits locaux synthétiques inclus |
| C1 | Reprise unique approuvée : **17 tentatives et 13 Auth conservées**, 123/47 restantes ; une tentative de réserve réaffectée au négatif corrigé |
| C2 | Proposition au frontend **5c910b748fae0b7747c8192424e7ecd49c86a520** ; réponse du 31/10 : **« Je préfère conserver la recette partielle »**. Aucun lancement, appel Auth ou mutation C2 |
| D | **NON AUTORISÉ, NON EXÉCUTÉ** |

UUID, adresses, accords et empreintes détaillées restent privés et ignorés. Aucun mot de passe, clé administrative, lien personnel, TokenHash, JWT ou export personnel dans Git/Actions. Aucun accès PROD, compte historique ciblé, migration, RLS, GRANT, configuration Auth/Data API, SMTP, achat ou dépendance modifié.

## Auth et état initial

Au contrôle initial ciblé : A confirmé avec le même UUID, B absent, un profil A, zéro ligne dans les neuf tables pédagogiques. Mot de passe utilisable A **inconnu** : confirmation de l'adresse et connexion enregistrée ne prouvaient pas le succès du premier formulaire.

Le **30 octobre**, après R :

- **Invitation B** générée une seule fois à 12:56 UTC ; activation volontaire, vérification Auth 200, PUT de définition du mot de passe **réellement reçu par Auth, HTTP 200**. Les deux champs PKCE nuls du SDK 2.118.0 passent le garde. Déconnexion 204 puis nouvelle connexion 200 ; le titulaire confirme le profil accessible.
- **Récupération A** générée une seule fois à 16:28 UTC, même UUID ; vérification et PUT Auth 200. Le titulaire confirme « Ton mot de passe est modifié », puis déconnexion et nouvelle connexion réussies, profil accessible. Profil initial conservé, pédagogie encore vide.
- Aucun replay d'invitation A, quatrième lien ou jeton consommé. Cas négatifs de lien invalide/type/double clic/réutilisation/expiration OTP **NON EXÉCUTÉS sur DEV** ; tests locaux distincts. Ancien mot de passe A inconnu, aucun refus revendiqué. Récupération après progression non testée : le créneau a servi avant C.

Les difficultés d'ouverture de console et sa reprise restent tracées, sans nouvelle opération hébergée. Les mots de passe ont été saisis et soumis par le titulaire, sans collecte par le contrôleur.

## Contrôles DEV

Préflights avant R/C/C1 : catalogue et privilèges complets comparés, Auth/Data API relus dans le Dashboard sans Save. Le **31 octobre**, nouvelle comparaison READ ONLY : catalogue et privilèges **identiques**, ordres et fins de ligne normalisés.

| Contrôle | Observation |
| --- | --- |
| Migrations / structure | 20261022000100, 20261024083417, 20261025143831 ; 10 tables, 98 colonnes, 95 contraintes, 24 index, 11 triggers, 24 politiques, 15 fonctions dont 9 RPC |
| Privilèges | 30 relevés tables/rôles, 294 colonnes/rôles, 45 fonctions/rôles, 6 schémas/rôles ; définitions, propriétaires, ACL, cinq extensions et défauts concordants |
| Auth constatée le 30/10 | Signup, anonyme, manual linking off ; e-mail/confirmation on ; secure password change et require current password off ; aucun réglage changé |
| Sessions constatées | JWT 3600 s, rotation refresh on, réutilisation 10 s ; ces réglages ne prouvent aucune expiration réellement exécutée |
| Data API constatée | public/graphql_public exposés, bprea_private non exposé ; search path public/extensions, max rows 1000, auto-exposition on |
| B après les scénarios A | Les dix empreintes B prises après sa modification volontaire de pseudo sont **inchangées** au contrôle ciblé du 31/10 |

Un préflight frais reste nécessaire avant toute phase corrective. La protection contre les mots de passe compromis reste désactivée dans l'offre constatée ; aucun achat. Les lectures catalogue ne remplacent pas une preuve JWT/RLS.

## Résultats hébergés au frontend f9bee0ca

Exécutions du **30/10/2026** avec vrais comptes fictifs et JWT étudiants, SDK 2.118.0, frontend local sous `/mon-bprea/` et API DEV. Mises en attente réseau/quota IndexedDB limitées aux contextes éphémères. Aucun runner local ou CI redirigé vers DEV.

| ID | Résultat observé / statut | Limite ou suite |
| --- | --- | --- |
| T01 invitation | **RÉUSSI SUR DEV** pour activation B, PUT et reconnexion | Cas négatifs de lien NON EXÉCUTÉS ; ancien échec A conservé |
| T02 récupération | **RÉUSSI SUR DEV** pour récupération A et nouvelle connexion, même UUID/profil | Ancien mot de passe inconnu ; récupération après progression NON EXÉCUTÉE |
| T03 profils/RLS | Propres profils A/B et pseudo autorisé ; colonnes protégées/INSERT refusés 403/42501. 50 SELECT sur dix tables : voisin vide, scans propres, anon sans donnée. Neuf RPC anon 401/42501 ; parents étrangers/absents refusés 403/42501 par RPC | Première lecture B→A pédagogique lorsque A était vide : répéter après peuplement. PATCH étranger sur colonne autorisée : **200 et zéro ligne sous RLS** ; autres PATCH/INSERT refusés par privilège. Aucun accès croisé réussi |
| T04 Drill/Dashboard | **RÉUSSI SUR DEV** : séries W44/W43 de dix questions, une première correcte/une incorrecte, entraînements distincts même date/score, retry exact et conflit divergent ; A1/A2 après reload, Dashboard **2 réalisés, 1 correct, 50 %** | 8 tentatives ; entraînement exclu des premières réponses, anciennes semaines non bloquantes |
| T05 cours/QCM | **RÉUSSI SUR DEV** : done true puis false explicite, scores 0/3, tentatives distinctes même date/score, retry ; CAS périmé en conflit, données récentes conservées, choix du compte et reload A1/A2 | 11 tentatives ; aucun done déduit d'un ancien score |
| T06 botanique | **RÉUSSI SUR DEV** : Chrono réel 30 s, correcte/incorrecte/timeout, photo indisponible passée sans compter ; complétion/première fin conservée, révision pédagogique distincte, retry/conflit et historique A1/A2 | 12 tentatives ; statistiques 1/3 puis 2/4, cinq réponses immuables ; aucune horloge simulée pour le timeout |
| T07 ITK/apparence | **RÉUSSI SUR DEV** : huit paramètres, première création, CAS, quatre saisons et luminosités ; choix auto conservé ; conflit 150/200 sans écrasement et convergence A1/A2 | 12 tentatives ; valeurs 200 puis 300 au scénario offline |
| T08 appareils/offline | **RÉUSSI SUR DEV** pour outbox durable/reload/reconnexion : ITK 300 hors réseau, même intention après reload, commit à réponse perdue relu puis retry exact sans doublon | A→B→A avec intention A en attente NON EXÉCUTÉ dans cette phase |
| T09 export | **RÉUSSI SUR DEV** pour deux copies JSON v1 volontaires : identité fraîche, dix sources/deux passes, quatre compléments locaux, exclusions et absence de secret contrôlées | Copies privées ; pagination au-delà d'une page pleine non démontrée par ce petit volume |
| T10 restauration initiale | **RÉUSSI SUR DEV** : analyse/annulation sans écriture ; cinq intentions jamais envoyées réintégrées avec leurs UUID : cours/QCM/session/ITK/apparence, base 0/révision 1 ; reload et réimport sans doublon | Aucun DELETE d'historique pour simuler une perte ; limites UUID parents/anciennes révisions maintenues |
| T10 seconde copie après conflits | **ÉCHEC SUR DEV avant restauration** : analyse refuse l'export valide, code archive ; trois intentions enfants conservées dans le fichier intact, aucune restauration | Une mise à jour concurrente volontaire du cours a eu lieu (révision 6). Correctif local ; import correctif, double clic et fichier A sous B à revérifier |
| T11 interruptions | **RÉUSSI SUR DEV** pour commit à réponse perdue/relecture/retry, reload, quota IndexedDB contrôlé, annulation après vraie lecture tardive : aucun export/téléchargement réactivé | Expiration JWT NON EXÉCUTÉE : sonde retrouvant le navigateur fermé. Double clic de restauration NON EXÉCUTÉ |
| T12 confidentialité | Séparation serveur initiale et absence de clé administrative navigateur contrôlées ; pas de réactivation d'archive ni import automatique | Barrière d'effacement local, refus A sous B et bascule avec intention en attente NON EXÉCUTÉS SUR DEV ; close-account HORS PÉRIMÈTRE |

## Incidents et correctif JSON

1. Tentative **017** : colonne générée series_key copiée par erreur dans un INSERT négatif, **400/428C9**, sans écriture. Arrêt, fermeture, réconciliation ciblée puis C1 approuvée ; aucune des 17 réservations effacée.
2. C1 : PATCH étranger 200 avec zéro ligne, attendu sous RLS pour une colonne disposant d'UPDATE, mais assertion exigeant 403. Droits effectifs et dix empreintes B relus ; classification corrigée dans les mêmes contextes sans changement de droit/périmètre. Replay exact compté en réserve, reçus précédents conservés. Les rejets parents sont 42501 par RPC, et non FK 23503.
3. Export final : cliché d'opération avant conflit à l'état pending, opération courante devenue conflict ; après résolution ITK, opération rangée dans resolved-operation. L'analyse exigeait identité intégrale et présence dans les seules opérations courantes, refusant le véritable export.

Le correctif [restore-model.js](../../assets/restore-model.js) exclut **uniquement l'état transitoire** de la comparaison entre ces références ; les états restent contrôlés. UUID, payload/RPC, dépendances, révisions et métadonnées de livraison doivent correspondre exactement. Un conflit **résolu seulement** peut référencer son opération dans une archive resolved-operation. Référence inconnue, autre archive, état inconnu et payload divergent restent refusés. Aucun descripteur d'archive ne devient une intention exécutable ; format, portée/identité, privacy et SQL inchangés.

Sept régressions synthétiques utilisent les vrais modèles cours/ITK, l'export v1 et son analyse : les trois cas valides échouaient avant correction et passent ensuite ; altérations toujours refusées. Le JSON DEV original est accepté **hors ligne sans modification** après correction. Le plan conserve **deux intentions compatibles** (QCM et réponse Drill) avec leurs UUID. La troisième, botanique, garde une dépendance exportée non rétablissable par le contrat 6.5.4.A : elle reste **bloquée, sans envoi**, dans le fichier privé intact. Aucun retrait de dépendance pour la rendre artificiellement compatible. Ces constats hors ligne ne prouvent pas encore la restauration hébergée.

## Compteurs et résidus

Fermeture locale C1 : **30/10 à 19:26:04 UTC** (20:26 Paris), arrêt opérateur ; navigateur/serveur fermés, contrôleur déconnecté le 31/10. Journal parent et closeout concordants :

| Budget global | Consommé | Reste |
| --- | --- | --- |
| Comptes | **2/2**, A existant et B invité | Aucun troisième |
| generateLink | **3/3**, invitation A historique, B, recovery A | **0** |
| Auth mutantes | **22/60**, refresh compris | **38** |
| Tentatives pédagogiques | **102/140**, refus/replays compris | **38** |
| Groupes | RLS 49, Drill 8, cours 11, botanique 12, paramètres 12, appareils 0, JSON 6, interruptions/privacy 3, réserve 1 | Sous-plafonds C1 conservés, aucun nouveau budget |
| Lignes applicatives ciblées le 31/10 | **34 au total**, 24 A et 10 B, dont deux profils | Plafond global 150 |

| Table | A | B |
| --- | ---: | ---: |
| profiles | 1 | 1 |
| drill_series | 2 | 1 |
| drill_answers | 2 | 1 |
| drill_training_attempts | 2 | 1 |
| course_states | 2 | 1 |
| quiz_attempts | 5 | 1 |
| botanical_sessions | 3 | 1 |
| botanical_answers | 5 | 1 |
| itk_settings | 1 | 1 |
| appearance_preferences | 1 | 1 |

Comptages ciblés : **cinq lignes de sessions A, trois B** ; aucune validité JWT déduite, aucun contenu/token/hash fournisseur extrait. Refresh/JWT distants possibles : fermeture locale ≠ révocation immédiate. Dossiers privés et deux JSON téléchargés conservés ; aucune copie Auth complète. Copie technique 6.5.3.B non lue, prolongée ni purgée ; réexamen du **5 novembre 2026** maintenu.

## Tests locaux et livraison

Code corrigé : Node **24.22.0**, npm ci réussi sans vulnérabilité signalée ; npm test **499/499, 49 fichiers**, puis npm run test:e2e **85/85** ; SDK **2.118.0** reconstruit sans diff. Aucun ajout de dépendance. Les 28 tests ciblés de recette comprennent les neuf gardes de continuation. HTTP synthétique et mocks ne prouvent pas RLS.

Docker/CLI Supabase absents : suites réelles locales **NON EXÉCUTÉES** sur le poste, refus avant réseau ; aucune redirection DEV. Contrôler les trois jobs unit-integration, e2e et supabase-security sur la dernière tête de PR et lier les résultats dans sa description. Les verts f9bee0ca ne valident pas le correctif ultérieur. Pages garde Auth désactivée et exclut outils/configurations DEV, runs et JSON privés.

**Décision finale reçue le 31/10 : conserver la recette partielle.** L'artefact correctif distinct **5c910b748fae0b7747c8192424e7ecd49c86a520** a été préparé, avec filiation et plan scellé ; **38 contrôles hors ligne** passent, dont refus du démarrage sans accord, conservation des compteurs et des deux intentions compatibles, dépendance botanique bloquée. C2 est **NON AUTORISÉE / NON EXÉCUTÉE** : zéro appel Auth et zéro mutation supplémentaires. Ancien artefact, JSON et réservations intacts ; aucun nouveau frontend exécuté sur DEV après f9bee0ca.

**D reste distinct et non autorisé : A/B et leurs 34 lignes sont conservés.** Le dossier privé de résidus décrit UUID ciblés, cascades et sessions ; aucune suppression n'est proposée implicitement par le choix du bilan partiel. Toute reprise ultérieure ou nettoyage exige son accord applicable. Aucun P0/D01–D14, ouverture aux camarades ou clôture complète DEV validé. Le correctif reste **RÉUSSI EN LOCAL ET CI UNIQUEMENT**, avec limites DEV explicites ci-dessus.

[Procédure de reprise](../deploiement/RUNBOOK-REPRISE-DEV-6-5-4C.md) · [contrat JSON](../architecture/RESTAURATION-DONNEES-PERSONNELLES.md) · [tests](../TESTS.md)
