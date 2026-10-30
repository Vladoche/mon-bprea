# Validation du lot 6.5.4.C — reprise sécurisée de la recette DEV

**30 octobre 2026, Europe/Paris — PRÉPARATION VALIDÉE LOCALEMENT ; POINT R EN ATTENTE D'AUTORISATION.** A existant est préservé, B absent, mot de passe utilisable A **inconnu**. Aucun nouveau lien, session étudiante, mot de passe, écriture pédagogique ou nettoyage hébergé. Le correctif PKCE reste **non revérifié sur DEV**. La campagne n'est pas clôturée.

## Références et intégrité

| Élément | Observation |
| --- | --- |
| Date / dépôt | 30/10/2026 Paris ; Vladoche/mon-bprea |
| Fetch / base | git fetch origin réussi ; origin/main **3414fc09a245b86634ccf21f0ee083359c85fe10** |
| Fusion #31 | GitHub : merged=true, fusion 30/10 à 11:40:35Z ; même SHA, tête b92bcf32171df84628f0f13068dc6a6aab4a79ed |
| Branche | feature/lot6-5-4c-reprise-recette-dev, créée depuis origin/main ; worktree initial propre, aucune modification préexistante écrasée |
| SHA source testé | **6c91a042dfa0886c9d7431757743c4bf8f9e1df8** ; compléments documentaires ultérieurs sans modification du code testé |
| SHA artefact de continuation | HEAD propre effectivement préparé, conservé dans ses plan/artifact privés et la description de PR ; ne pas lui attribuer le SHA historique |
| DEV exclusif | wcckbyhrtroittbfophv, Mon BPREA DEV, https://wcckbyhrtroittbfophv.supabase.co, eu-west-1, ACTIVE_HEALTHY, Free/tier_free, PostgreSQL 17.11.0.003 |
| Run historique / frontend incident | **r654b-20261030-302521a0f692** / **18b0478daf2879c80b5fbb75b2e5bb67993ea112** |
| Méthode | Artefact distinct avec filiation et journal parent commun ; [procédure R/C/D](../deploiement/RUNBOOK-REPRISE-DEV-6-5-4C.md) |
| Exclus | Tout accès PROD, migration/GRANT/RLS/configuration hébergée, déploiement, ouverture Pages, SMTP/achat, camarades, close-account, suppression et fusion |

L'incident et les accords historiques demeurent dans la [validation B](VALIDATION-LOT6-5-4B.md) et la PR #31. Aucun constat passé réécrit. Quatorze fichiers historiques nécessaires sont liés par leurs empreintes privées ; plan/artifact et ancien frontend relus intègres. Invite A `presented`, deux réservations Auth, zéro pédagogique ; closeout cohérent, arrêt local, C/D absents et aucune révocation distante. Aucun secret, ancien lien ou session importé.

## État réel réconcilié en lecture seule

Lectures du **30/10/2026**, connecteur officiel Supabase (transactions READ ONLY et métadonnées), puis Dashboard DEV pour Auth/Data API. Après attente de R, refaire le préflight frais de cinq minutes : ces observations ne sont pas une attestation encore actuelle pour une future mutation.

| Objet / méthode ciblée | Résultat observé | Limite |
| --- | --- | --- |
| A, adresse exacte du run | Un compte ; UUID égal au reçu privé ; e-mail confirmé, connexion enregistrée | Aucun mot de passe/hash/session/token lu ; mot de passe utilisable inconnu |
| B, adresse exacte | Zéro compte | Relire avant invitation après R |
| Identités supplémentaires du run | Préfixe exact de ce seul run : une identité totale, zéro supplémentaire | Aucune liste de comptes ni adresse retournée |
| Profil du run | Un profil A | Pas de pseudo/contenu extrait |
| Neuf tables pédagogiques du run | Zéro ligne dans chacune | Aucune lecture de contenu ou mutation ; aucun état des historiques tiers déduit |
| Ledger | Exactement 20261022000100, 20261024083417, 20261025143831 | Aucune migration appliquée |
| Catalogue complet | 10 tables, 98 colonnes, 95 contraintes, 24 index, 11 triggers, 24 politiques, 15 fonctions/9 RPC ; définitions/corps/signatures/propriétaires/ACL concordants au relevé final précédent | Métadonnées, aucune preuve comportementale JWT/RLS |
| Privilèges effectifs | 30 relevés tables/rôles, 294 colonnes/rôles, 45 fonctions/rôles, 6 schémas/rôles ; défauts ACL et cinq extensions concordants ; aucune section divergente | Profil : pseudo seul modifiable ; droits anon/personnels et fonctions privées inchangés |
| Auth | Signup/anonyme/manual linking off ; e-mail/confirmation on ; autres providers standards off, aucun custom provider | Aucun signUp/signInAnonymously négatif envoyé : troisième compte potentiel non autorisé |
| Mot de passe | Secure password change off, require current password off, secure email change on ; OTP 3600 s/8 chiffres | Minimum masqué par le lecteur d'interface, composition non établie ; aucun réglage changé |
| Sessions / URLs | JWT 3600 s, rotation refresh on/réutilisation 10 s ; session unique off, durée/inactivité never dans Free ; Site et unique callback locaux exacts | Sessions historiques non extraites ; expiration/révocation réellement testée non revendiquée |
| Data API | public/graphql_public exposés, bprea_private non coché (contrôle visuel) ; search path public/extensions, max rows 1000, pool automatique, auto-exposition on | Compteurs UI 0/10 et 0/15 sans preuve de refus serveur ; aucun Save |
| Advisor sécurité | Même WARN leaked password protection désactivée, option Pro+ | [Limite fournisseur](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), aucun achat |

Le Dashboard affiche un bandeau d'incident technique ; la page officielle de statut consultée affiche ses services opérationnels. Revérifier immédiatement avant mutation et arrêter sur réponse incohérente ou indéterminée. Le [changement Data API annoncé pour le 30 octobre](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically) ne prouve pas son application sur ce projet ; grants existants et réglage observé restent ceux relus. Aucun élargissement de droits.

## Compteurs et accords

| Budget global | Consommé | Disponible / accord nécessaire |
| --- | --- | --- |
| generateLink | **1 / 3**, invite A | Invite B et recovery A, une fois chacune, après R |
| Auth mutantes navigateur | **2 / 60** | **58** ; même journal parent, prochain numéro 003 |
| Tentatives pédagogiques | **0 / 140** | **140**, C absent |
| Comptes principaux | **1 / 2** | B seulement ; aucun second A |
| Lignes applicatives | **1 profil constaté**, plafond global **150** | Aucun plafond réinitialisé par le nouveau dossier |
| A/B historiques | Accordés pour le dispositif B présenté | Ne valent pas R au nouveau SHA/artefact |
| R / C / D | **Absents** | R avant nouvelle opération hébergée ; C avant pédagogie ; D avant nettoyage |

Le prompt autorise préparation/tests locaux et lectures DEV ciblées seulement. Protection proposée inchangée : isolation des deux UUID, aucune opération globale ; le nouvel artefact/dispositif reste à accepter au point R. Aucune nouvelle copie technique hébergée ; copie 6.5.3.B non lue, réexamen du **5 novembre 2026** maintenu, sans prolongation/purge.

## Dispositif et contrôles locaux

[continuation.mjs](../../scripts/dev-recipe/continuation.mjs) ferme parent/run/SHA, conserve A et les empreintes des anciens marqueurs. Préparation unique par continuation-reserved.json, session unique par continuation-started.json ; aucun marqueur supprimé après panne. Nouveau plan fermé, mêmes identités/fixtures/UUID d'intention, journal parent commun ; chaque réservation exclusive est fsync avant appel. Compteur troué/supprimé/diminué en session : refus. Une interruption exige diagnostic et nouvel accord, sans redémarrage automatique.

Les futurs reçus HTTP minimisés conservent méthode, chemin sans query, statut, contexte et date, séparément de la réservation globale avant envoi. Ni headers/corps ni secrets ; ils ne constituent encore aucune preuve DEV. Une empreinte locale ne protège pas contre un administrateur du poste capable de réécrire toutes les preuves.

| Contrôle exécuté | Résultat / portée |
| --- | --- |
| Node / npm ci / Chromium | Node 24.22.0 ; npm ci réussi, zéro vulnérabilité signalée ; installation Chromium réussie |
| Tests ciblés recette | **28 réussis**, dont **9 nouveaux tests de continuation** : A existant, filiation, altérations SHA/artefact/fixture, budgets/bornes, refus réinvite A/troisième acteur, verrous, interruption/perte de remise, ancien token |
| npm test | **492/492**, **48 fichiers**, passe finale après derniers changements code |
| npm run test:e2e | **85/85**, passe finale après npm test ; Chromium/HTTP synthétique, aucun DEV/PROD |
| build:auth-sdk | SDK 2.118.0 reconstruit identique ; bundle sans diff, aucune dépendance ajoutée |
| Visuel local | Vrai SDK, garde/journal synthétiques commençant à 2 ; PUT traité par transport synthétique, compteur final 4 ; succès UI inspecté à 1280/390 px ; navigateur/serveur arrêtés |
| Intégrité historique réelle hors ligne | 14 sources validées, ancien artefact intact, compteurs 1/2/0 ; aucun navigateur hébergé lancé |
| Incidents locaux de vérification | Première passe serveur sandbox : EACCES ; test de plafond trop long réduit aux frontières utiles. Nouvelle passe hors sandbox réussie, sans assimiler les échecs initiaux à des succès |
| Stack Supabase locale | Docker/CLI globale absents ; npm run test:supabase refuse avant réseau faute de stack/configuration dédiée. **NON EXÉCUTÉ localement**, aucune redirection DEV |
| CI finale | unit-integration, e2e, supabase-security à contrôler sur dernière tête, avec liens dans description de PR ; aucun vert précédent repris |
| Pages/secrets/liens/diff | 10 documents / 146 liens locaux valides ; Pages : 133 fichiers publics + .nojekyll, 326 références versionnées ; Auth off, aucun outil/fichier privé ni signal de secret réel ; git diff --check réussi. Contrôle de la tête finale dans la description de PR |

## Résultats hébergés T01–T12

Contexte commun : **30/10/2026, DEV exact, campagne historique ci-dessus ; aucune nouvelle mutation en C**. [Attendus détaillés et sous-cas inchangés](../deploiement/RUNBOOK-RECETTE-DEV-6-5-4B.md). Les succès locaux ne sont pas des réussites DEV.

| ID | Attendu | Observé / statut C | Suite / limite |
| --- | --- | --- | --- |
| T01 invitation | B activé, PUT réel, connexion/profil et cas négatifs | **EN ATTENTE D'AUTORISATION R** ; ancien échec A conservé | Correctif local uniquement ; B doit prouver invitation |
| T02 recovery A | Récupération unique, mot de passe/connexion, données préservées | **EN ATTENTE D'AUTORISATION R** | Ancien mot de passe A inconnu, aucun refus de celui-ci revendiqué |
| T03 profils/RLS | Propriétaires A/B, voisin invisible, colonnes, anon/dix tables/neuf RPC | **EN ATTENTE D'AUTORISATION C** | Catalogue/droits seulement, aucun JWT/PostgREST |
| T04 Drill/Dashboard | Snapshot, première réponse, entraînement, idempotence/statistiques | **EN ATTENTE D'AUTORISATION C** | Zéro mutation |
| T05 cours/QCM | done:false, tentatives distinctes, retry/CAS/A1/A2 | **EN ATTENTE D'AUTORISATION C** | Zéro mutation |
| T06 botanique | Parents/réponses, première fin, immutabilité/révisions/refus | **EN ATTENTE D'AUTORISATION C** | Zéro mutation |
| T07 ITK/apparence | Huit champs, auto, CAS/convergence/conflits | **EN ATTENTE D'AUTORISATION C** | Zéro mutation |
| T08 appareils/offline | Outbox durable, reconnexion/acquittement, séparation | **EN ATTENTE D'AUTORISATION C** | Aucun contexte hébergé repris |
| T09 export JSON | Identité fraîche, dix sources, passes/pagination/exclusions | **EN ATTENTE D'AUTORISATION C** | Aucun export DEV ; pagination pleine non démontrée |
| T10 restauration JSON | Analyse/annulation, import compatible/UUID/CAS, refus A sous B | **EN ATTENTE D'AUTORISATION C** | Aucun import DEV ; limites 6.5.4.A conservées |
| T11 interruptions | Réponse perdue après commit, relecture/retry exact, quota/CAS | **EN ATTENTE D'AUTORISATION C** | Interruptions outil testées hors ligne seulement |
| T12 confidentialité | A/B, barrières, refus de réactivation/import automatique | **EN ATTENTE D'AUTORISATION C** | close-account et clôture hébergée HORS PÉRIMÈTRE |

## Résidus, état final DEV et décisions restantes

**A et son profil existent ; B absent au dernier contrôle.** Neuf tables pédagogiques vides pour ces seules identités, historiques tiers préservés. Aucune nouvelle mutation hébergée/configuration ; aucun nettoyage autorisé ou réalisé. Ancienne invitation A consommée, fichiers privés/artefact/preuves conservés. Sessions/refresh/JWT distants résiduels possibles, révocation non déduite de la fermeture locale ; aucun token fournisseur ou navigateur personnel exploité.

Prochaine action après R : invitation B avec l'artefact corrigé, puis récupération A séparée. Incident : arrêt, conservation des réservations, fermeture locale, réconciliation ciblée et nouveau mandat. C/D à présenter séparément après preuves Auth. Aucun P0/D01–D14 levé, aucune ouverture publique. **Recette partielle en attente ; clôture DEV non acquise.**
