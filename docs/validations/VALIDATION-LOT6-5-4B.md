# Validation du lot 6.5.4.B — préparation de recette DEV

**29–30 octobre 2026, Europe/Paris — EN ATTENTE D'AUTORISATION. Phase 0 uniquement.** La recette hébergée T01–T12 n'est pas exécutée. Aucun compte, lien, session étudiante, écriture pédagogique, changement Auth/SQL ou nettoyage DEV. Le [runbook opérationnel](../deploiement/RUNBOOK-RECETTE-DEV-6-5-4B.md) porte les propositions exactes A/B/C/D, bornes, risques, protections, scénarios et critères d'arrêt.

## Git et périmètre réellement autorisé

| Élément | Observation |
| --- | --- |
| Dépôt / état initial | Vladoche/mon-bprea ; branche précédente 6.5.4.A, worktree suivi propre ; aucun fichier local existant écrasé |
| Fetch / base | `git fetch origin` réussi ; dernier origin/main au départ : **78971e13e0eed7079ee578a1cf4718482ecc8f4f** |
| PR #30 | GitHub : merged=true, closed, merged_at 2026-10-29T19:26:03Z, SHA de fusion identique ; les lots précédents sont dans son historique |
| Branche | `feature/lot6-5-4b-recette-hebergee-dev`, créée depuis origin/main ; pas de travail sur main |
| Mandat reçu | Phase 0 : revue, métadonnées DEV en lecture seule, scripts/artefact/fixtures/procédures/tests locaux |
| A / B / C / D | **Aucun accord reçu.** Les anciennes autorisations 6.5.3.B ne sont pas réutilisées |
| Exclus | Toute opération PROD, compte historique/camarade, SMTP externe, achat, Edge Function, migration/GRANT/RLS, déploiement Pages, fusion et modification de protection main |
| Secrets/copies | Aucune clé administrative demandée/lue, aucun contenu de la sauvegarde technique consulté/copié, aucune donnée Auth/pédagogique renvoyée au modèle ; seules métadonnées et booléens de présence |

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

Proposition à A : isoler la recette par deux UUID neufs, aucune suppression/modification globale, budgets stricts et arrêt sur anomalie ; faire accepter explicitement les limites de reprise et le risque résiduel. **Protection non encore acceptée.** Une nouvelle copie éventuelle et son stockage/conservation nécessitent un mandat propre ; aucune extraction dans Codex cloud ou CI. Pas de perte acceptable présumée au motif que DEV est fictif ou Free.

## Dispositif préparé et limites

[scripts/dev-recipe](../../scripts/dev-recipe/contract.mjs) : cible DEV codée et URL/ref indépendantes, callback exact, deux adresses synthétiques de run au domaine réservé, trois slots invite A/B et recovery A, préflight opérateur frais, accords A/B/C explicites, réservation durable avant appel, refus des redirections/listes/suppressions/retries. Clé administrative seulement dans l'environnement Node ; aucun lien affiché, enregistré ou retourné. Transfert ponctuel en mémoire vers Chromium isolé et serveur local silencieux prévu, **non exécuté avec un vrai lien**.

Quatre contextes A1/A2/B1/V, refus des comptes historiques et autres origines, budget 60 requêtes Auth mutantes/140 pédagogiques, pas de batch/DELETE. V et les tentatives A/B doivent atteindre le vrai serveur ; un refus local ne valide pas RLS. Une session consommée/crashée n'est pas relancée aveuglément ; diagnostic ciblé nécessaire. Les scripts historiques locaux, leurs politiques de cible et les trois jobs CI sont conservés.

Le préparateur utilise seulement la configuration publishable locale ignorée, un dossier neuf protégé et l'allowlist Pages existante. Les fixtures contiennent des dates contrôlées, snapshots publics, huit paramètres ITK et UUID stables ; aucun UUID Auth ou historique artificiel n'est injecté. Les scénarios de restauration préparent des intentions jamais envoyées au lieu d'effacer un historique immuable. Le CLI n'est pas une automatisation complète de T03–T12 : assertions et injections réseau/quota/CAS à exécuter séparément dans leurs groupes C autorisés.

## Matrice de recette hébergée

Champs communs de cette matrice préparatoire : **date 29/10/2026 Paris ; base SHA 78971e1 ; environnement DEV ; run hébergé aucun ; autorisations A/B/C absentes ; résultat réel aucun parcours exécuté ; méthode prévue JWT utilisateur + relecture réelle selon le runbook**. Lors d'une exécution, remplacer ces champs par heure précise/SHA/run/accord réellement reçus pour chaque sous-cas. Aucun succès local ci-dessous ne transforme un statut hébergé.

| ID | Prérequis / composant / attendu | Résultat réel et statut DEV | Limite / décision requise |
| --- | --- | --- | --- |
| T01 | A/B ; invitation, activation volontaire, profil, connexion/logout/reload, cas négatifs | Aucun compte/lien/session créé — **EN ATTENTE D'AUTORISATION** | B séparé, deux comptes maximum ; expiration réelle à attendre si revendiquée |
| T02 | A/B, progression C ; recovery A, nouveau mot de passe et progression préservée | Aucune récupération — **EN ATTENTE D'AUTORISATION** | Un créneau recovery A ; réglage secure password change actuel conservé |
| T03 | A/B/C ; profils/colonnes, dix tables/neuf RPC, A/B/V et témoins | Catalogue/droits seulement concordants ; JWT/REST **EN ATTENTE D'AUTORISATION** | Signup/anonyme négatifs NON EXÉCUTÉS : contingence de création à autoriser séparément ; pas de faux vert d'un refus avant serveur |
| T04 | C ; Drill dix snapshots, premières réponses, entraînements/idempotence, Dashboard | Aucune donnée écrite — **EN ATTENTE D'AUTORISATION** | Calcul sur exercices réalisés, historique conservé |
| T05 | C ; cours done:false, score zéro/meilleur, tentatives/UUID, CAS | Aucune donnée écrite — **EN ATTENTE D'AUTORISATION** | Version récente préservée, aucun dernier horodatage gagnant |
| T06 | C ; botanique, parents/terminaux/fin/révisions, retry et orphelines | Aucune donnée écrite — **EN ATTENTE D'AUTORISATION** | Statuts spéciaux seulement si effectivement exercés, aucun parent inventé |
| T07 | C ; ITK huit champs, apparence auto/clair/sombre/saisons, A2 et CAS | Aucune préférence envoyée — **EN ATTENTE D'AUTORISATION** | Deux domaines distincts, auto conservé |
| T08 | C ; A1/A2, hors ligne/reload/reprise, A→B→A | Aucun contexte connecté — **EN ATTENTE D'AUTORISATION** | Site intégral offline non promis ; cache fiable et outbox à vérifier |
| T09 | C ; export dix sources + caches, propriétaire, exclusions/deux passes/v1 | Aucun export DEV — **EN ATTENTE D'AUTORISATION** | Multi-page pleine non démontrée par petit volume ; extension de dispositif/budget distincte si nécessaire |
| T10 | C ; analyse/annulation, import compatible, répétition/conflits, JSON A refusé sous B, limites et A2 neuf | Aucun import DEV — **EN ATTENTE D'AUTORISATION** | Séries absentes, CAS avancé, session terminée absente, manifeste/privacy bloqués, Auth non restaurable |
| T11 | C ; réseau/timeout/réponse perdue après commit, quota/CAS/reprise | Aucune injection hébergée — **EN ATTENTE D'AUTORISATION** | Relecture et réconciliation, aucun retry aveugle ni faux acquittement |
| T12 | C + confirmations locales synthétiques ; barrières/cache/ancien JSON | Aucun retrait de cache de compte DEV — **EN ATTENTE D'AUTORISATION** | Clôture hébergée, close-account, purge, restauration PostgreSQL : **HORS PÉRIMÈTRE** |

## Contrôles locaux et livraison

Node **24.22.0**, `npm ci` et installation Chromium réussis. Aucune dépendance ajoutée ; seuls scripts npm dédiés supplémentaires.

| Vérification | Résultat exécuté / limite |
| --- | --- |
| Tests ciblés outils/artefact | **19 tests** inclus dans la passe finale : refus de cibles, préflight/accords, créneau durable, pannes de génération/remise, SDK réel avec transport synthétique, serveur silencieux/préfixe/traversée, fingerprint altéré, CLI fermée, vérification de liens du run et exclusion Pages ; aucune RLS déduite de ces mocks |
| npm test | **480 tests / 47 fichiers** réussis le 30/10 à 06:47 Paris ; réseau boucle locale exécuté hors sandbox après refus EACCES de la sandbox Windows lors de la première passe du 29 |
| npm run test:e2e -- --workers=2 | **84/84**, environ 1,5 minute ; passe finale du 30/10 après npm test ; profils temporaires, HTTP synthétique, aucun endpoint DEV/PROD |
| npm run build:auth-sdk | SDK 2.118.0 reconstruit ; diff bundle versionné nul |
| Métadonnées PostgreSQL natives | Trois migrations reconstruites ; comparaison catalogue et droits effectifs concordante, cluster arrêté ; Auth simulé seulement |
| Stack Supabase locale complète | Docker absent ; `npm run test:supabase` refuse avant réseau faute de stack/configuration dédiée. **NON EXÉCUTÉ localement**, pgTAP et vrais JWT A/B réservés au job éphémère supabase-security |
| Contrôles finaux | Diff/liens/secrets/artefact public et local, inspection visuelle et résultat des trois jobs sur dernière tête consignés après exécution dans la PR ; aucune réussite anticipée |

La présence des tests de sécurité ne prouve pas leur exécution. Les résultats des trois jobs **unit-integration, e2e, supabase-security** doivent être contrôlés sur la dernière tête, séparément des verts de #30. Aucun secret DEV, preuve sensible ou JSON utilisateur dans Actions. Les migrations, configuration publique désactivée, workflows et protections de main restent inchangés.

## Résidus, décisions et conclusion

Fixtures hébergées créées : **zéro** ; aucun UUID de nettoyage, aucune session utilisateur DEV, aucun résidu pédagogique attribuable à ce lot. Dossiers locaux préparatoires/synthétiques ignorés et clusters arrêtés conservés ; aucun fichier utilisateur/sauvegarde précédente supprimé. Le sort des futurs comptes, sessions et fichiers de recette se décidera au point D, sur liste privée exacte.

**Préparation disponible — recette hébergée non validée.** Présenter A avec SHA testé, choix de protection, bornes, risques, arrêt et nettoyage séparé. Attendre ensuite B avant Auth puis C avant pédagogie, et D avant toute suppression. Toute modification de configuration Auth, nouvelle migration/RPC/RLS/GRANT, copie technique, clôture fonctionnelle ou reprise complète exige un mandat propre.

Les quinze P0 et D01–D14 restent à examiner séparément. Aucun lancement public, validation juridique, camarade invité, abonnement, SMTP externe, fusion ou production. Un défaut démontré peut conduire à **RECETTE PARTIELLE — CORRECTIF REQUIS**, jamais à une modification hébergée pour verdir.
