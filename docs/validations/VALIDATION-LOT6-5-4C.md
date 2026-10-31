# Validation du lot 6.5.4.C — reprise sécurisée de la recette DEV

**Bilan du 31 octobre 2026, Europe/Paris : Auth revérifiée sur DEV, recette pédagogique partielle, défaut JSON corrigé localement.** Sa vérification hébergée exige un accord sur le nouvel artefact exact. Aucun nettoyage D, fusion, déploiement ou ouverture publique. Les constats du [lot B](VALIDATION-LOT6-5-4B.md) restent inchangés.

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

**Suite :** artefact distinct au nouveau HEAD propre, lié à la même continuation et au journal parent ; accord correctif sur SHA exact, sans nouveau compte/lien/reset. Puis D distinct, avec UUID privés, lignes/cascades, sessions et résidus. Sans accord, conservation des données et bilan partiel. Aucun P0/D01–D14, ouverture aux camarades ou clôture DEV validé.

[Procédure de reprise](../deploiement/RUNBOOK-REPRISE-DEV-6-5-4C.md) · [contrat JSON](../architecture/RESTAURATION-DONNEES-PERSONNELLES.md) · [tests](../TESTS.md)
