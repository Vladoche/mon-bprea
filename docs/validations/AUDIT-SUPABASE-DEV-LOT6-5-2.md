# Audit Supabase DEV — lot 6.5.2

**28 octobre 2026, Europe/Paris. Lecture seule. Aucune autorisation de mise à niveau, de recette hébergée ou d'ouverture.** Référence Git : `5affd57ee6e3a92d53eb8bddafc029268554c522`, fusion [#25](https://github.com/Vladoche/mon-bprea/pull/25) confirmée. Projet exclusivement contrôlé : **`wcckbyhrtroittbfophv`**, `Mon BPREA DEV`. Le projet PROD nommé dans le mandat n'a fait l'objet d'aucun appel ni navigation. La branche Dashboard `main / PRODUCTION` est la branche principale **du projet DEV**, pas le projet PROD distinct.

## Conclusion et portée

Deux migrations sont enregistrées, profils et Drill ; leurs effets observables sont cohérents dans le périmètre ci-dessous. **La migration personnelle `20261025143831` et ses six tables sont absentes.** SMTP personnalisé désactivé, modèles par défaut incompatibles avec le contrat de callback du dépôt, changement sécurisé de mot de passe désactivé. Le plan Free affiché ne donne pas accès aux sauvegardes planifiées/PITR. DEV **n'est pas prêt pour la recette complète** des domaines personnels ou de la chaîne e-mail.

Les règles SQL observées ne constituent pas une recette A/B avec JWT. Aucun compte, session ou token n'a été lu ou créé ; aucune ligne pédagogique ni de profil n'a été consultée. Les deux comptes fictifs décrits en octobre dans l'ancien rapport ne sont **pas recomptés** ici. Les constats du [24 octobre](VALIDATION-SUPABASE-DEV.md) et du 26 octobre restent historiques. Région et restrictions de base concordent avec l'historique ; seul l'état relu ici fait foi pour le présent audit.

Statuts utilisés dans les matrices : **CONFORME OBSERVÉ**, **ÉCART CONFIRMÉ**, **ABSENT CONFIRMÉ**, **NON VÉRIFIÉ**, **NON APPLICABLE JUSTIFIÉ**, **À VALIDER PAR L'EXPLOITANT**. Un statut porte sur l'objet et la lecture précisés, jamais sur la sécurité globale ou la conformité juridique.

## Journal des lectures réellement effectuées

Toutes les heures suivantes sont celles du **28/10/2026 à Paris (UTC+1)**. La référence exacte DEV a été contrôlée dans les arguments MCP avant chaque série et dans l'URL/header du Dashboard avant chaque groupe de consultations. Les pages n'ont été qu'ouvertes/lues ; aucun Save, Refresh d'advisor, envoi, lien d'invitation ou bouton d'administration n'a été actionné. Les traces d'accès éventuelles du fournisseur ne sont pas des écritures applicatives volontaires.

| ID / heure | Cible / source officielle / lecture | Résultat non sensible | Limite |
| --- | --- | --- | --- |
| R01 17:11:02 | DEV ; connecteur Supabase `get_project(id)` | Référence et nom exacts, région/statut/version ci-dessous | Ni disponibilité fonctionnelle ni plan dans la réponse |
| R02 17:11:32–33 | DEV ; `list_migrations(project_id)` | `20261022000100 profiles`, `20261024083417 create_drill_sync_schema` | Le nom ne prouve pas les effets ; complété par R06/R07 |
| R03 17:11:32–33 | DEV ; `list_edge_functions(project_id)` | Liste vide | Aucune invocation, aucun secret demandé |
| R04 17:11:32–33 | DEV ; `get_advisors(type:security)` | Un WARN Auth, protection des mots de passe divulgués inactive | Instant de consultation, aucun correctif |
| R05 17:11:32–33 | DEV ; `get_advisors(type:performance)` | Deux INFO index inutilisés | Statistiques d'usage, aucune suppression justifiée |
| R06 17:12:06 | DEV ; `execute_sql`, SELECT de catalogues `pg_catalog`, `pg_policies` | 4 tables, 29 colonnes, 28 contraintes, 9 index, 5 triggers, 8 policies, 7 fonctions ; corps SQL lus sans exécution | Aucun SELECT sur une table métier ou ligne Auth ; pas de dump ni db pull |
| R07 17:14:01 | DEV ; `execute_sql`, SELECT de catalogues et fonctions **intégrées** `has_*_privilege` | Privilèges effectifs tables/colonnes/fonctions/schémas, rôles clients, ACL par défaut et extensions | Aucune fonction utilisateur appelée ; aucune lecture Vault |
| R08 17:11–13 | DEV ; Dashboard `/auth/providers`, panneau Email | Offre Free ; signup/anonyme off, e-mail on, confirmation on ; longueur 12 vérifiée visuellement, OTP 3600 s / 8 ; réglages ci-dessous | Aucun test de refus effectif, aucune création de session |
| R09 17:13–14 | DEV ; Dashboard `/auth/sessions`, `/auth/url-configuration` | JWT 3600 s, rotation on, réutilisation 10 s ; Site URL et unique callback exacts | Configuration seulement ; aucune session individuelle consultée |
| R10 17:14–16 | DEV ; Dashboard `/auth/templates`, `/invite-user`, `/reset-password`, `/auth/smtp` | SMTP custom off ; aperçus par défaut, liens littéraux `ConfirmationURL` | Source HTML complète verrouillée par l'interface ; pas de contournement, de rendu reçu ou de livraison |
| R11 17:16–17 | DEV ; Dashboard `/database/backups/scheduled`, `/pitr` | Sauvegardes non incluses dans Free ; PITR proposé comme add-on Pro | Copies internes/rétention/effacement fournisseur inconnus ; pas de sauvegarde/restauration |
| R12 17:17–18 | DEV ; Dashboard `/advisors/health` | 0 erreur, 0 warning, 0 suggestion affichés | Aucun engagement de disponibilité Auth/PostgREST |
| R13 20:40–41 | DEV ; Dashboard `/settings/integrations`, après reprise de la même tâche | Deploy to production off, Automatic branching off et verrouillé Free ; répertoire de travail `.` | Réglages DEV seulement ; aucune interrogation de l'intégration PROD, aucun enregistrement |
| R14 20:47:18 | DEV ; `execute_sql`, SELECT de `pg_proc`, `pg_namespace`, `pg_depend` sans filtre de préfixe, hors routines d'extensions | Sept routines au total dans public/bprea_private, mêmes signatures/ACL ; aucune routine applicative supplémentaire | Métadonnées seulement ; pas de source d'une fonction inconnue ni d'exécution |
| R15 20:55:16 | DEV ; connecteur `get_project_url(project_id)` | URL officielle `https://wcckbyhrtroittbfophv.supabase.co` | Aucune clé retournée/demandée ; pas de GET applicatif |
| R16 20:55–57 | DEV ; Dashboard providers/Email, third-party, passkeys, oauth-server, hooks, rate-limits | Passkeys/OAuth Server off, vues tiers/hooks vides ; limite e-mail 2/h vérifiée visuellement, autres quotas ci-dessous | Aucune sélection de composition modifiée, fermeture Cancel ; valeur API de composition non établie par le placeholder/l'option active |

Le connecteur n'exposant pas Auth/SMTP/backups, le Dashboard officiel avec session existante a servi de complément. Aucune authentification d'essai au service Mon BPREA. Les trois requêtes SQL ne contiennent que SELECT et lectures de métadonnées ; les noms DDL dans les définitions retournées sont du texte, jamais exécuté. Les heures du journal sont celles des lectures, pas une garantie d'état continu jusqu'à la livraison après interruption.

## Métadonnées et disponibilité

| Objet | Observé / statut | Limite ou suite |
| --- | --- | --- |
| Identité | `wcckbyhrtroittbfophv`, `Mon BPREA DEV` — CONFORME OBSERVÉ | Cible unique ; ne pas se fier au seul nom |
| Région base | `eu-west-1`, West EU / Ireland — CONFORME OBSERVÉ | Pas de changement observé depuis le 24 ; pas de garantie « toutes les données en UE » |
| PostgreSQL | `17.11.0.003`, moteur 17, canal `ga` — CONFORME OBSERVÉ | Version fournie par métadonnées ; catalogues effectivement accessibles |
| Infrastructure | `ACTIVE_HEALTHY`, conseiller de santé sans alerte — CONFORME OBSERVÉ | Deux signaux de contrôle, pas de SLA ni de test applicatif |
| Plan | Free affiché dans le header et les rubriques sessions/backups — CONFORME OBSERVÉ | Pas d'inspection d'autres projets ou de facture privée |
| URL du projet | `https://wcckbyhrtroittbfophv.supabase.co` — CONFORME OBSERVÉ, R15 | Fournie par outil officiel ; ni domaine personnalisé ni GET applicatif vérifié ici |
| Disponibilité Auth / PostgREST | NON VÉRIFIÉ | Le Dashboard et les catalogues ne prouvent pas un appel étudiant réussi |
| Fonctionnement réel de Mon BPREA | NON VÉRIFIÉ | [Recette future dédiée](../deploiement/PLAN-RECETTE-DEV.md), après autorisations |

## Migrations : historique et effets

| Migration / ordre / nom | Présente dans Git | Présente dans DEV | Cohérence observée | Action future |
| --- | --- | --- | --- | --- |
| 1 — `20261022000100_profiles.sql`, `profiles` | Oui | Oui, R02 | CONFORME OBSERVÉ : table/4 colonnes, 3 contraintes, index PK, 2 policies, grants de colonne, 2 triggers dont Auth et 2 corps de fonction comparés | Conserver ; réapplication interdite, création de table non idempotente et backfill Auth à ne pas rejouer |
| 2 — `20261024083417_create_drill_sync_schema.sql`, `create_drill_sync_schema` | Oui | Oui, R02 | CONFORME OBSERVÉ : 3 tables/25 colonnes, 25 contraintes, 8 index, 6 policies, 3 triggers, 5 signatures/corps de fonction | Conserver ; ne pas rejouer, ne pas réparer l'historique |
| 3 — `20261025143831_create_personal_data_backend.sql`, `create_personal_data_backend` | Oui | Non, R02 | ABSENT CONFIRMÉ : aucune des 6 tables, 2 guards ni 6 RPC dans les catalogues lisibles R06 | **À APPLIQUER ULTÉRIEUREMENT APRÈS AUTORISATION**, selon [plan](../deploiement/PLAN-MISE-A-NIVEAU-DEV.md) |

Les comparaisons incluent types, défauts, nullabilité, clés, CHECK, cascades, index, triggers, RLS/ACL et signatures, pas seulement les versions. Les sept `prosrc` distants sont identiques aux corps Git après seule normalisation CRLF→LF et retrait des blancs aux extrémités (commentaires internes conservés). Aucun écart de logique constaté dans ces corps ; ce contrôle ne prouve ni l'historique exact des instructions appliquées ni l'absence de dérive ultérieure. Aucun hash d'une donnée utilisateur n'a été calculé.

## Tables et contraintes

Les quatre tables existantes sont `public`, propriétaire `postgres`, RLS activée, `FORCE RLS=false` ; aucune vue `public` renvoyée par R06. `anon` et `authenticated` ne sont ni superuser ni BYPASSRLS, sans appartenance de rôle enregistrée pour ces trois rôles API. `service_role` possède BYPASSRLS : il ne représente jamais un étudiant.

| Table | Objets observés / statut | Propriété, contraintes et intégrité |
| --- | --- | --- |
| `profiles` | 4 colonnes, 3 contraintes, 1 index, trigger d'UPDATE — CONFORME OBSERVÉ | PK `id uuid`, FK `auth.users(id) ON DELETE CASCADE`, pseudo nullable 2–40 caractères contrôlé ; dates non nulles par défaut `now()` |
| `drill_series` | 9 colonnes, 10 contraintes, 3 index, guard INSERT/UPDATE — CONFORME OBSERVÉ | PK `id`, UNIQUE propriétaire/id et propriétaire/UC/semaine ; `user_id DEFAULT auth.uid()` FK Auth CASCADE ; `series_key` générée ; snapshot JSONB 10 éléments ≤512 Kio, version 1, UC/semaine/dates contrôlées |
| `drill_answers` | 8 colonnes, 8 contraintes, 3 index, guard INSERT/UPDATE — CONFORME OBSERVÉ | PK propriétaire/opération ; UNIQUE propriétaire/série/question ; FK composite série CASCADE ; UUID non zéro, identifiants/date bornés ; `correct DEFAULT false` recalculé par guard |
| `drill_training_attempts` | 8 colonnes, 7 contraintes, 2 index, guard INSERT/UPDATE — CONFORME OBSERVÉ | PK propriétaire/opération ; FK composite vers première réponse CASCADE ; mêmes bornes de forme/date ; entraînement distinct |
| `course_states` | ABSENT CONFIRMÉ | Attendu : PK propriétaire/cours, UUID opération UNIQUE, révisions CAS, `done:false` conservé, FK Auth CASCADE |
| `quiz_attempts` | ABSENT CONFIRMÉ | Attendu : PK propriétaire/tentative, scores/totaux/dates contrôlés, append-only, FK Auth CASCADE |
| `botanical_sessions` | ABSENT CONFIRMÉ | Attendu : PK propriétaire/session, UUID opération UNIQUE, CAS, métadonnées immuables et première fin seulement, FK Auth CASCADE |
| `botanical_answers` | ABSENT CONFIRMÉ | Attendu : PK propriétaire/réponse, UNIQUE propriétaire/session/question, identité réponse=question, FK Auth et session composite CASCADE |
| `itk_settings` | ABSENT CONFIRMÉ | Attendu : singleton propriétaire, paramètres 8 chaînes contrôlées ≤4 Kio, CAS, FK Auth CASCADE |
| `appearance_preferences` | ABSENT CONFIRMÉ | Attendu : singleton propriétaire, saison/luminosité dont auto, CAS, date client nullable, FK Auth CASCADE |

Les six absences correspondent à la migration manquante, sans indice de compromission déduit. Leurs defaults/types/triggers/policies ne sont **pas installés** du seul fait qu'ils existent dans Git. Le [contrat personnel](../architecture/PERSONAL-DATA-BACKEND.md) et la migration versionnée détaillent les effets futurs. Les annexes donnent les colonnes, contraintes/index et politiques réellement lus ; aucune ligne n'est comptée.

## RLS, GRANT et fonctions

`profiles_select_own` limite SELECT à `(select auth.uid())=id` ; `profiles_update_own` impose cette même condition en USING et WITH CHECK. `authenticated` possède SELECT et UPDATE de **pseudo seulement** ; ni INSERT, DELETE, UPDATE id/dates, TRUNCATE ni TRIGGER. `anon` n'a aucun privilège sur les quatre tables. Les politiques Drill SELECT/INSERT portent sur `user_id` propriétaire ; aucun UPDATE/DELETE étudiant. Les colonnes autorisées à INSERT sont `unit,week,started_at,questions` pour les séries et `operation_id,series_id,question_id,answer,answered_at` pour réponses/entraînements. `user_id`, résultat et champs serveur sont protégés.

Les droits ont été lus dans les ACL **et** évalués par les fonctions natives `has_table_privilege`, `has_column_privilege`, `has_function_privilege`, `has_schema_privilege`. Un INSERT de colonnes ne devient pas un INSERT global de table. Aucun grant à PUBLIC n'est présent sur ces tables/fonctions applicatives. `public` donne USAGE aux clients mais pas CREATE ; `bprea_private` ne donne ni USAGE ni CREATE aux rôles API.

Les quatre tables conservent des droits administratifs de table `service_role` issus des défauts fournisseur, non retirés par les deux migrations existantes. C'est compatible avec leur SQL ; aucune clé administrative n'a été demandée. La migration personnelle retire explicitement aussi les grants service_role sur ses nouvelles tables : respecter cette différence, ne pas ajouter de grant pour faciliter les contrôles.

| Fonction et signature | Retour / sécurité / exposition | Comparaison et statut |
| --- | --- | --- |
| `bprea_private.create_profile_for_auth_user()` | trigger, DEFINER `postgres`, chemin vide ; EXECUTE propriétaire seul ; trigger AFTER INSERT Auth | Corps et attributs conformes ; CONFORME OBSERVÉ. Privilège requis pour création atomique, aucune autorisation par user_metadata |
| `bprea_private.touch_profile_updated_at()` | trigger, INVOKER, chemin vide ; EXECUTE propriétaire seul ; BEFORE UPDATE profil | Corps conforme ; CONFORME OBSERVÉ |
| `bprea_private.guard_drill_series()` | trigger, INVOKER, chemin vide ; EXECUTE propriétaire seul | Corps conforme ; valide propriétaire/snapshot et refuse UPDATE ; CONFORME OBSERVÉ |
| `bprea_private.guard_drill_response()` | trigger, INVOKER, chemin vide ; EXECUTE propriétaire seul | Corps conforme ; vérifie série/option/1re réponse, calcule correction et date ; CONFORME OBSERVÉ |
| `public.drill_create_series(text,text,timestamptz,jsonb)` | jsonb, VOLATILE INVOKER, chemin vide ; EXECUTE `authenticated` et propriétaire | Noms de paramètres/types et corps conformes ; CONFORME OBSERVÉ |
| `public.drill_record_answer(uuid,text,text,timestamptz,uuid)` | Même contrat d'exécution | Corps/signature conformes ; CONFORME OBSERVÉ |
| `public.drill_record_training(uuid,text,text,timestamptz,uuid)` | Même contrat d'exécution | Corps/signature conformes ; CONFORME OBSERVÉ |
| `bprea_private.guard_personal_mutation()`, `guard_personal_append()` | Attendus trigger INVOKER, chemin vide, EXECUTE révoqué aux clients | ABSENT CONFIRMÉ |
| `public.personal_save_course(text,boolean,bigint,bigint,bigint,uuid,bigint)` | Attendu jsonb VOLATILE INVOKER, chemin vide, EXECUTE authenticated seul hors propriétaire | ABSENT CONFIRMÉ |
| `public.personal_record_quiz(uuid,text,bigint,bigint,timestamptz)` | Même exposition attendue | ABSENT CONFIRMÉ |
| `public.personal_save_botanical_session(jsonb,uuid,bigint)` | Même exposition attendue | ABSENT CONFIRMÉ |
| `public.personal_record_botanical_answer(jsonb)` | Même exposition attendue | ABSENT CONFIRMÉ |
| `public.personal_save_itk(jsonb,uuid,bigint)`, `personal_save_appearance(jsonb,uuid,bigint)` | Même exposition attendue | ABSENT CONFIRMÉ |

Toutes les fonctions présentes sont propriétaires `postgres`, PL/pgSQL dans Git ; aucun appel métier exécuté. La lecture des corps confirme les gardes/idempotence et les FK confirment les relations, **pas un test de séparation A/B ni de concurrence distante**. Six tables manquantes empêchent aujourd'hui d'éprouver l'ensemble du graphe d'anti-résurrection.

Les ACL par défaut `public` accordent encore de larges droits aux rôles API pour les futures tables/fonctions de `postgres`/`supabase_admin` ; les deux migrations installées les retirent explicitement sur leurs objets. Ne pas modifier ces défauts ici ; surveiller le changement fournisseur du 30 octobre et relire après application future. Extensions installées : plpgsql 1.0, pg_stat_statements 1.11, uuid-ossp 1.1, pgcrypto 1.3, supabase_vault 0.3.1. Présence de Vault ≠ lecture de secrets ; pas de ltree/btree_gist observé.

## Matrice Auth et URLs

`supabase/config.toml` est un contrat de stack éphémère, **pas une configuration automatiquement appliquée à DEV**. Ses JWT 120 s, OTP 60 s et quotas élevés ne sont pas des cibles hébergées.

| Paramètre | Attendu dans le dépôt | Observé sur DEV | Écart / statut | Correction future |
| --- | --- | --- | --- | --- |
| Inscription libre | Global `enable_signup=false` | Allow new users to sign up off | CONFORME OBSERVÉ, configuration seule | Préserver ; refus API à éprouver plus tard |
| Anonymes | false | off | CONFORME OBSERVÉ | Préserver |
| Provider e-mail | `auth.email.enable_signup=true` active le provider distinct du verrou global | on | CONFORME OBSERVÉ | Ne pas le désactiver |
| Confirmation e-mail | true | on | CONFORME OBSERVÉ | Préserver |
| Autres providers | Aucun ajouté | Phone/SAML/Web3 et sociaux off, aucun custom provider ; Passkeys/OAuth Server off ; vues Third-Party Auth/Auth Hooks sans configuration | CONFORME OBSERVÉ pour configuration, R08/R16 | Préserver ; pas de test API ni conclusion sur toutes les possibilités fournisseur |
| Liaison manuelle | Aucun parcours ajouté | off | CONFORME OBSERVÉ | Préserver |
| Minimum mot de passe | 12, nouveau formulaire 12–128 | 12, constat visuel | CONFORME OBSERVÉ | Pas de mot de passe testé |
| Composition obligatoire | Pas d'exigence additionnelle explicite | « Select an option » ; liste ouverte sans changement, « No required characters (default) » active mais pas explicitement sélectionnée | NON VÉRIFIÉ pour la valeur API exacte | Clarifier si décision de robustesse ; ne pas déduire une valeur API du focus de liste |
| Secure email change | true | on | CONFORME OBSERVÉ | Préserver ; pas de parcours de changement d'adresse actuellement |
| Secure password change | true | off | ÉCART CONFIRMÉ | Décider et tester activation/récupération/réauthentification avant changement autorisé |
| Require current password | Pas de contrat dédié | off | À VALIDER PAR L'EXPLOITANT | Ne pas activer mécaniquement : invitation/récupération sans ancien mot de passe à recetter |
| Mots de passe compromis | Option fournisseur, achat non imposé | off, option Pro+, WARN R04 | ÉCART CONFIRMÉ avec recommandation sécurité | Évaluer risque/gestionnaire/mots de passe uniques, sans achat automatique |
| OTP e-mail | 8 ; 60 s réservées aux tests | 8 ; 3600 s | CONFORME OBSERVÉ pour longueur ; durée hébergée À VALIDER PAR L'EXPLOITANT | Usage unique/expiration réelle à tester séparément |
| JWT | 120 s local seulement | 3600 s | À VALIDER PAR L'EXPLOITANT, pas défaut déduit de la CI | Conserver pendant préparation ; valider durée et JWT résiduel |
| Rotation refresh / réutilisation | true / 10 s | on / 10 s | CONFORME OBSERVÉ | Essai ultérieur, aucun token lu |
| Durée max/inactivité/session unique | Non imposées par le dépôt | 0/never, 0/never, off ; réglages Pro+ verrouillés | À VALIDER PAR L'EXPLOITANT | Aucun paiement ni réduction arbitraire |
| Site URL | `http://127.0.0.1:4173/mon-bprea/` | Même valeur, slash final | CONFORME OBSERVÉ | Ne pas remplacer par Pages public |
| Redirect URLs | Callback local exact | Une entrée : `http://127.0.0.1:4173/mon-bprea/authentification.html` | CONFORME OBSERVÉ ; aucune wildcard ni ancienne entrée affichée | Préserver ; vérifier retour réel futur |
| URL Pages | `https://vladoche.github.io/mon-bprea/` pour une future décision PROD | Absente de la liste DEV | NON APPLICABLE JUSTIFIÉ pour cet essai local | Pas d'autorisation publique déduite de l'URL |

R16 : quota projet e-mail **2/h** ; par IP, refresh **150/5 min**, vérification tokens **30/5 min**, signup/signin **30/5 min**. L'intervalle e-mail par utilisateur affiche **60 s**, mais le Dashboard précise qu'il ne s'applique qu'avec SMTP personnalisé ; ne pas le considérer actif ici. Les limites affichées SMS/anonyme/Web3 ne les activent pas : leurs providers restent désactivés. IP forwarding par clés secrètes off. Ces quotas ne sont ni testés en charge ni remplacés par les valeurs de CI.

## E-mails et SMTP

Le Dashboard affiche **custom SMTP off** et avertit que les messages utilisent les modèles par défaut. Invitation : sujet anglais observé visuellement ; récupération : sujet anglais. Les deux aperçus contiennent un lien littéral **`{{ .ConfirmationURL }}`**. La source intégrale est désactivée par le plan/configuration : **NON VÉRIFIÉ** pour l'égalité complète des corps enregistrés, sans contourner le verrou.

Les fichiers [invite](../../supabase/templates/invite.html) et [recovery](../../supabase/templates/recovery.html) construisent `{{ .SiteURL }}authentification.html?token_hash={{ .TokenHash }}&amp;type=invite` (ou recovery), avec sujets français définis dans config.toml. Le callback refuse les fragments, attend token_hash/type et ne consomme qu'après clic explicite. **ÉCART CONFIRMÉ** du contrat de lien et de langue ; présence dans Git ≠ installation. Aucun e-mail n'a été demandé, envoyé ou reçu pour cet audit.

La [documentation SMTP](https://supabase.com/docs/guides/auth/auth-smtp) limite le service intégré aux adresses autorisées de l'équipe, indique actuellement 2 messages/heure, sans garantie de livraison. Cela ne justifie pas d'ajouter les cinq camarades comme administrateurs. L'identité technique du relais, l'expéditeur réel, les en-têtes, SPF/DKIM/DMARC, journaux/rétention et la délivrabilité restent **NON VÉRIFIÉS**. Le [changement du 3 juin 2026](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier) explique le verrou des nouveaux projets Free avec SMTP intégré ; un SMTP personnalisé permet la personnalisation sans achat Pro imposé. Pour six, examiner d'abord un SMTP existant ou une offre gratuite adaptée, son domaine et ses conditions ; aucun fournisseur ni coût n'est choisi. [Procédure future](../deploiement/PLAN-MISE-A-NIVEAU-DEV.md).

## Clés, accès, sauvegardes et fournisseurs

| Catégorie / état | Fait et limite | Intervention future |
| --- | --- | --- |
| Navigateur — CONFORME OBSERVÉ dans Git | `assets/auth-config.json` off, URL/clé/siteUrl vides ; exemple off ; fichiers locaux/env ignorés | Artefact DEV distinct, uniquement URL et publishable, après autorisation ; aucune valeur de clé lue ici |
| Clés actives DEV — NON VÉRIFIÉ | Aucun endpoint de clés, secret JWT/SMTP, mot de passe DB, session ni Vault consulté | Inventaire catégories/rotation par opérateur, jamais valeurs dans Git/Pages |
| Modèle de clés — CONFORME OBSERVÉ dans le code | Publishable navigateur ; clé admin serveur uniquement dans prototype ; token personnel séparé des caches | [Guide officiel](https://supabase.com/docs/guides/getting-started/api-keys) ; RLS/grants restent nécessaires |
| Administrateurs/MFA/support — NON VÉRIFIÉ | Aucune liste nominative, console d'organisation partagée, secret ou méthode de récupération inspecté | Preuve privée minimale des accès, MFA/récupération, droits du connecteur et support ; D13 |
| Backups planifiés — ABSENT CONFIRMÉ pour la fonction incluse dans Free | Dashboard dit que Free n'inclut pas les project backups ; pas de liste de points restaurables disponible | Décider une protection proportionnée et autoriser séparément toute copie ; aucun dump dans l'audit |
| PITR — ABSENT CONFIRMÉ pour l'accès actuel | Pro add-on proposé, pas d'option active accessible | Pas d'achat recommandé par défaut ; évaluer besoin/perte acceptable |
| Copies internes/logs/rétention — NON VÉRIFIÉ | L'absence de fonction de backup utilisateur ne prouve pas l'absence de copies opérationnelles fournisseur | Demander périmètre, lieux, durées, sortie de rétention, habilitations et restrictions ; D05–D08/D13 |
| Région principale — CONFORME OBSERVÉ | Base Ireland ; pas de preuve de lieux des logs/backups/support | Compléter matrice pays/accès/garanties, sans « exclusivement UE » |
| Contrats — À VALIDER PAR L'EXPLOITANT | [DPA public](https://supabase.com/legal/customer-resources/data-processing-addendum), version 1 du 01/08/2026, consulté ; pas de pièce de souscription/acceptation propre à l'exploitant | Conserver les pièces privées applicables, qualifier activités et transferts ; aucun P0 levé |
| Sous-traitants — NON VÉRIFIÉ pour la chaîne effective DEV | [Liste officielle du 12/10/2026](https://supabase.com/legal/subprocessor-list/October-12-2026.pdf) accessible cette fois : hébergement/CDN, support, surveillance et autres services, dont entités hors UE ; liste générale, pas preuve de chaque flux Mon BPREA | Faire correspondre services réellement utilisés, pays d'accès et engagements ; ne pas attribuer tous les destinataires aux résultats pédagogiques |

Le [guide backups](https://supabase.com/docs/guides/platform/backups) décrit des capacités selon le plan ; il ne garantit aucune durée des copies résiduelles de ce Free. Aucun objectif de reprise ni délai d'effacement fournisseur n'est inventé. Toute restauration future doit être isolée, accès/sync suspendus, suppressions postérieures réconciliées et réappliquées, puis contrôlée avant reprise. Aucune restauration ni sauvegarde manuelle lancée.

## Edge Functions et clôture

R03 retourne **zéro fonction déployée** : `close-account` est **ABSENT CONFIRMÉ** dans DEV et son déploiement **NON APPLICABLE JUSTIFIÉ** pour la stratégie recommandée actuelle. Aucun endpoint invoqué. Dans Git, le prototype exige URL API HTTP strictement locale (`127.0.0.1:54321`, localhost ou kong:8000), `BPREA_CLOSURE_MODE=ephemeral-local`, origine exacte locale, clé de capacité 256 bits, `verify_jwt=true` et SDK 2.118.0. Une URL hébergée reste refusée ; protections intactes.

Variables serveur : URL et clés Supabase publique/administrative, `BPREA_CLOSURE_ORIGIN`, `BPREA_CLOSURE_MODE`, `BPREA_CLOSURE_RECEIPT_KEY`. Aucun secret lu. Le contrat vérifie le JWT via getUser, réauthentifie par mot de passe avec UUID identique, ferme la session supplémentaire, puis scelle une preuve liée au JWT exact/origine/cible, valable ≤5 min et bornée par exp. Confirmation `SUPPRIMER` aux deux phases ; hard-delete Auth natif et cascades, puis absence Auth/dix tables sous JWT résiduel. Reprise seulement avec même preuve/JWT valides ; pas de ledger permanent, pas de succès sur déconnexion seule, erreurs/expiration nécessitant assistance. Le prototype refuse les facteurs MFA vérifiés/non pris en charge. Ces appels écrivent et **n'ont pas été exécutés** ici.

À six adultes et jusqu'à juin 2027, conserver la recommandation 6.5.1 : export/retrait local autonomes + clôture assistée, avec [runbook et recette futurs](../deploiement/PLAN-RECETTE-DEV.md). Le canal et la méthode restent à choisir et éprouver. Déployer du libre-service exigerait un nouveau service revu, des secrets/protections/recettes et une autorisation distincte ; pas de retrait du verrou de ce prototype.

## Alertes, priorités et documentation actuelle

| Alerte / preuve | Portée / risque | Relation avec le dépôt / action future |
| --- | --- | --- |
| `auth_leaked_password_protection`, WARN EXTERNAL, R04 | Auth : mot de passe compromis potentiellement accepté ; priorité P1 de décision avant ouverture | Minimum 12 ne remplace pas cette protection ; option Pro+ affichée. Évaluer sans achat automatique. [Remédiation officielle](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) |
| `unused_index`, INFO, deux occurrences R05 | `drill_training_history_idx`, `drill_answers_activity_idx` non utilisés dans les statistiques ; priorité P2 | Index attendus pour historique/pagination/FK ; faible activité d'essai possible, pas motif de retrait. [Explication](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) |
| Santé R12 | 0/0/0 affichés | Pas de correction ni preuve d'absence générale de vulnérabilité |

Les écarts fonctionnels (migration/SMTP/modèles) sont P1 **pour préparer DEV**, tandis que leurs preuves manquantes alimentent P0-14 **avant ouverture**. Aucun incident P0 de compromission n'est établi par cet audit.

Documentation officielle consultée le 28/10/2026 : [CLI](https://supabase.com/docs/reference/cli/introduction), [configuration Auth](https://supabase.com/docs/guides/auth/general-configuration), [redirections](https://supabase.com/docs/guides/auth/redirect-urls), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [gestion utilisateur](https://supabase.com/docs/guides/auth/managing-user-data), [sessions](https://supabase.com/docs/guides/auth/sessions), [mots de passe](https://supabase.com/docs/guides/auth/password-security), [templates](https://supabase.com/docs/guides/auth/auth-email-templates), SMTP/backups/clés/DPA cités ci-dessus. Index [changelog Markdown](https://supabase.com/changelog.md) d'abord refusé par le lecteur web (type text/markdown), puis récupéré par GET officiel ; aucun outil ou SDK mis à jour.

| Notice officielle / date | Conséquence pour Mon BPREA |
| --- | --- |
| [Exposition Data API](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically), 28/04/2026 ; généralisation annoncée 30/10/2026 | Relire ACL par défaut avant intervention ; conserver GRANT explicites, RLS et grants de colonnes dans la migration manquante. Les objets existants gardent leurs droits selon la notice. Ne pas modifier les defaults ni attribuer des droits globaux ici |
| [Templates Free](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier), 03/06/2026 | Verrou confirmé dans DEV ; SMTP custom à préparer, pas mise à niveau Pro obligatoire |
| [PAT à portée limitée](https://supabase.com/changelog/scoped-personal-access-tokens-ga), 06/10/2026 | Possibilité future d'accès limité au seul DEV/en lecture, expiration ; aucune création/rotation de token ni droit supplémentaire accordé |
| [TLS HTTP API](https://supabase.com/changelog/cbc-tls-ciphers-deprecated), 12/10/2026, retrait au plus tôt 10/11/2026 | Vérifier navigateurs/OS maintenus pendant la recette future ; aucun besoin établi de modifier le SDK verrouillé |
| [PostgreSQL 17.11](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes), 25/09/2026 | Version déjà annoncée par DEV ; ltree/btree_gist absents, aucune cryptographie métier pgcrypto repérée dans les migrations. Pas d'action destructive/reindex déduite de la seule présence de pgcrypto |
| [Logs Management API](https://supabase.com/changelog/48235-migration-of-supabase-management-api-logs-all-analytics-endpoint-to-logs-endpoint), 23/07/2026 | Aucun runner métier du dépôt ne dépend de cet endpoint ; aucun log individuel lu pour l'audit |

Les nouveautés Edge auto-hébergées ne constituent pas une consigne de changer la gateway DEV hébergée. Les notices CLI/migrations n'autorisent ni db push/dry-run/pull, ni migration repair : aucune commande Supabase distante exécutée. CLI absente du PATH sur ce poste ; aide du paquet npm épinglé 2.121.0 consultée avec succès après échec DNS en sandbox. Cette aide précise que Vault est mis à jour avant migrations sauf `--skip-vault` : le nom dry-run seul ne suffit donc pas à autoriser une simulation. Version verrouillée de CI 2.121.0 et SDK 2.118.0 conservés ; avis 2.122.0 sans mise à jour.

## Inconnues et décisions avant intervention

Restent NON VÉRIFIÉS : disponibilité Auth/PostgREST en session étudiante, comportements d'invitation/récupération/JWT, A/B, synchro et effacement hébergés ; valeur API précise des exigences de composition ; inventaire/rotation réelle des clés ; administrateurs/MFA/récupération/support ; relais et expéditeur e-mail ; logs et copies résiduelles ; rétention/localisation/effacement/restauration contractuels effectifs. Ces inconnues ont des raisons précises ci-dessus et des actions dans la [matrice](../deploiement/MATRICE-ECARTS-DEV.md), sans absence distante présumée. Les réglages alternatifs passkeys/OAuth/tiers/hooks sont désormais relus en R16 ; leur configuration observée ne remplace pas un test de refus API.

D01–D14 et les quinze P0 restent ouverts ; P0-07/08/11/12/14 reçoivent des preuves techniques partielles, aucune levée. Projet personnel volontaire, exploitant + cinq camarades majeurs maximum, indépendant de l'établissement, résultats privés et horizon juin 2027 conservés. Ce rapport prépare un plan et n'approuve ni exemption juridique ni ouverture.

**Absence d'écriture hébergée :** aucune migration, DDL/DML, RPC métier, réparation d'historique, compte/session de test, invitation/envoi, suppression, sauvegarde/restauration, réglage Auth/SMTP/provider/URL/clé/RLS/GRANT/plan/région, déploiement Edge/Pages ni appel PROD. Aucune donnée utilisateur supprimée, aucun secret copié dans les livrables. Seules des modifications documentaires locales et la livraison GitHub autorisée sont prévues.

## Annexes de métadonnées — preuves R06/R07

Ces objets sont des définitions techniques, sans ligne utilisateur. Les caractères de contrôle de la contrainte pseudo sont représentés en notation U+ pour ne pas les insérer dans le document. Les expressions sont décompilées par PostgreSQL : qualification implicite, casts et parenthèses peuvent différer du texte Git sans différence de sens.

### Colonnes, types, défauts et droits de colonne

| Table / colonne (ordre) | Type | Nullable | Défaut / génération | INSERT authenticated | UPDATE authenticated |
| --- | --- | --- | --- | --- | --- |
| `drill_answers.user_id` (1) | uuid | non | auth.uid() | non | non |
| `drill_answers.operation_id` (2) | uuid | non | null | oui | non |
| `drill_answers.series_id` (3) | uuid | non | null | oui | non |
| `drill_answers.question_id` (4) | text | non | null | oui | non |
| `drill_answers.answer` (5) | text | non | null | oui | non |
| `drill_answers.correct` (6) | boolean | non | false | non | non |
| `drill_answers.answered_at` (7) | timestamp with time zone | non | null | oui | non |
| `drill_answers.created_at` (8) | timestamp with time zone | non | clock_timestamp() | non | non |
| `drill_series.id` (1) | uuid | non | gen_random_uuid() | non | non |
| `drill_series.user_id` (2) | uuid | non | auth.uid() | non | non |
| `drill_series.unit` (3) | text | non | null | oui | non |
| `drill_series.week` (4) | text | non | null | oui | non |
| `drill_series.series_key` (5) | text | oui | ((unit \|\| '__'::text) \|\| week) ; génération stockée | non | non |
| `drill_series.started_at` (6) | timestamp with time zone | non | null | oui | non |
| `drill_series.questions` (7) | jsonb | non | null | oui | non |
| `drill_series.schema_version` (8) | integer | non | 1 | non | non |
| `drill_series.created_at` (9) | timestamp with time zone | non | clock_timestamp() | non | non |
| `drill_training_attempts.user_id` (1) | uuid | non | auth.uid() | non | non |
| `drill_training_attempts.operation_id` (2) | uuid | non | null | oui | non |
| `drill_training_attempts.series_id` (3) | uuid | non | null | oui | non |
| `drill_training_attempts.question_id` (4) | text | non | null | oui | non |
| `drill_training_attempts.answer` (5) | text | non | null | oui | non |
| `drill_training_attempts.correct` (6) | boolean | non | false | non | non |
| `drill_training_attempts.answered_at` (7) | timestamp with time zone | non | null | oui | non |
| `drill_training_attempts.created_at` (8) | timestamp with time zone | non | clock_timestamp() | non | non |
| `profiles.id` (1) | uuid | non | null | non | non |
| `profiles.pseudo` (2) | text | oui | null | non | oui |
| `profiles.created_at` (3) | timestamp with time zone | non | now() | non | non |
| `profiles.updated_at` (4) | timestamp with time zone | non | now() | non | non |

Toutes les colonnes sont SELECT pour authenticated via le grant de table. Aucun INSERT/UPDATE de colonne accordé à anon selon R07. Un défaut null dans le catalogue signifie absence de DEFAULT, pas une valeur imposée.

### Contraintes présentes et validées

| Table | Contrainte | Définition décompilée | Validée |
| --- | --- | --- | --- |
| drill_answers | drill_answers_answer_check | CHECK (answer ~ '^[a-z0-9][a-z0-9-]{0,199}$'::text) | oui |
| drill_answers | drill_answers_answered_check | CHECK (isfinite(answered_at) AND answered_at >= '0001-01-01 00:00:00+00'::timestamp with time zone AND answered_at < '10000-01-01 00:00:00+00'::timestamp with time zone) | oui |
| drill_answers | drill_answers_created_check | CHECK (isfinite(created_at)) | oui |
| drill_answers | drill_answers_first_key | UNIQUE (user_id, series_id, question_id) | oui |
| drill_answers | drill_answers_operation_check | CHECK (operation_id <> '00000000-0000-0000-0000-000000000000'::uuid) | oui |
| drill_answers | drill_answers_pkey | PRIMARY KEY (user_id, operation_id) | oui |
| drill_answers | drill_answers_question_check | CHECK (question_id ~ '^[a-z0-9][a-z0-9-]{0,199}$'::text) | oui |
| drill_answers | drill_answers_series_fkey | FOREIGN KEY (user_id, series_id) REFERENCES drill_series(user_id, id) ON DELETE CASCADE | oui |
| drill_series | drill_series_business_key | UNIQUE (user_id, unit, week) | oui |
| drill_series | drill_series_created_check | CHECK (isfinite(created_at)) | oui |
| drill_series | drill_series_owner_id_key | UNIQUE (user_id, id) | oui |
| drill_series | drill_series_pkey | PRIMARY KEY (id) | oui |
| drill_series | drill_series_questions_check | CHECK (jsonb_typeof(questions) = 'array'::text AND jsonb_array_length(questions) = 10 AND octet_length(questions::text) <= 524288) | oui |
| drill_series | drill_series_schema_check | CHECK (schema_version = 1) | oui |
| drill_series | drill_series_started_check | CHECK (isfinite(started_at) AND started_at >= '0001-01-01 00:00:00+00'::timestamp with time zone AND started_at < '10000-01-01 00:00:00+00'::timestamp with time zone) | oui |
| drill_series | drill_series_unit_check | CHECK (unit = ANY (ARRAY['uc1'::text, 'uc2'::text, 'uc3'::text, 'uc4'::text, 'uc5'::text, 'ucare1'::text, 'ucare2'::text])) | oui |
| drill_series | drill_series_user_id_fkey | FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE | oui |
| drill_series | drill_series_week_check | CHECK (week ~ '^[0-9]{4}-W(0[1-9]\|[1-4][0-9]\|5[0-3])$'::text AND "left"(week, 4) <> '0000'::text) | oui |
| drill_training_attempts | drill_training_answer_check | CHECK (answer ~ '^[a-z0-9][a-z0-9-]{0,199}$'::text) | oui |
| drill_training_attempts | drill_training_answer_fkey | FOREIGN KEY (user_id, series_id, question_id) REFERENCES drill_answers(user_id, series_id, question_id) ON DELETE CASCADE | oui |
| drill_training_attempts | drill_training_answered_check | CHECK (isfinite(answered_at) AND answered_at >= '0001-01-01 00:00:00+00'::timestamp with time zone AND answered_at < '10000-01-01 00:00:00+00'::timestamp with time zone) | oui |
| drill_training_attempts | drill_training_attempts_pkey | PRIMARY KEY (user_id, operation_id) | oui |
| drill_training_attempts | drill_training_created_check | CHECK (isfinite(created_at)) | oui |
| drill_training_attempts | drill_training_operation_check | CHECK (operation_id <> '00000000-0000-0000-0000-000000000000'::uuid) | oui |
| drill_training_attempts | drill_training_question_check | CHECK (question_id ~ '^[a-z0-9][a-z0-9-]{0,199}$'::text) | oui |
| profiles | profiles_id_fkey | FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE | oui |
| profiles | profiles_pkey | PRIMARY KEY (id) | oui |
| profiles | profiles_pseudo_valid | CHECK (pseudo IS NULL OR pseudo = btrim(pseudo) AND char_length(pseudo) >= 2 AND char_length(pseudo) <= 40 AND pseudo !~ '[U+0001-U+001FU+007F-U+009F]'::text) | oui |

### Index présents

| Table | Index | Définition | Valide / prêt |
| --- | --- | --- | --- |
| profiles | profiles_pkey | CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id) | oui / oui |
| drill_series | drill_series_pkey | CREATE UNIQUE INDEX drill_series_pkey ON public.drill_series USING btree (id) | oui / oui |
| drill_series | drill_series_owner_id_key | CREATE UNIQUE INDEX drill_series_owner_id_key ON public.drill_series USING btree (user_id, id) | oui / oui |
| drill_series | drill_series_business_key | CREATE UNIQUE INDEX drill_series_business_key ON public.drill_series USING btree (user_id, unit, week) | oui / oui |
| drill_answers | drill_answers_pkey | CREATE UNIQUE INDEX drill_answers_pkey ON public.drill_answers USING btree (user_id, operation_id) | oui / oui |
| drill_answers | drill_answers_first_key | CREATE UNIQUE INDEX drill_answers_first_key ON public.drill_answers USING btree (user_id, series_id, question_id) | oui / oui |
| drill_training_attempts | drill_training_attempts_pkey | CREATE UNIQUE INDEX drill_training_attempts_pkey ON public.drill_training_attempts USING btree (user_id, operation_id) | oui / oui |
| drill_training_attempts | drill_training_history_idx | CREATE INDEX drill_training_history_idx ON public.drill_training_attempts USING btree (user_id, series_id, question_id, created_at, operation_id) | oui / oui |
| drill_answers | drill_answers_activity_idx | CREATE INDEX drill_answers_activity_idx ON public.drill_answers USING btree (user_id, answered_at, series_id, question_id) | oui / oui |

### Triggers actifs

| Schéma / table | Trigger | Définition | État |
| --- | --- | --- | --- |
| auth.users | bprea_auth_user_created | CREATE TRIGGER bprea_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION bprea_private.create_profile_for_auth_user() | O |
| public.profiles | bprea_profile_updated | CREATE TRIGGER bprea_profile_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION bprea_private.touch_profile_updated_at() | O |
| public.drill_series | drill_series_guard | CREATE TRIGGER drill_series_guard BEFORE INSERT OR UPDATE ON drill_series FOR EACH ROW EXECUTE FUNCTION bprea_private.guard_drill_series() | O |
| public.drill_answers | drill_answers_guard | CREATE TRIGGER drill_answers_guard BEFORE INSERT OR UPDATE ON drill_answers FOR EACH ROW EXECUTE FUNCTION bprea_private.guard_drill_response() | O |
| public.drill_training_attempts | drill_training_guard | CREATE TRIGGER drill_training_guard BEFORE INSERT OR UPDATE ON drill_training_attempts FOR EACH ROW EXECUTE FUNCTION bprea_private.guard_drill_response() | O |

`O` = actif en mode normal. Les triggers internes PostgreSQL ne sont pas listés ; les FK sont vérifiées séparément ci-dessus.

### Politiques présentes

| Table / politique | Commande / rôle | USING | WITH CHECK |
| --- | --- | --- | --- |
| profiles / profiles_update_own | UPDATE / authenticated | (( SELECT auth.uid() AS uid) = id) | (( SELECT auth.uid() AS uid) = id) |
| profiles / profiles_select_own | SELECT / authenticated | (( SELECT auth.uid() AS uid) = id) | — |
| drill_series / drill_series_insert_own | INSERT / authenticated | — | (( SELECT auth.uid() AS uid) = user_id) |
| drill_series / drill_series_select_own | SELECT / authenticated | (( SELECT auth.uid() AS uid) = user_id) | — |
| drill_answers / drill_answers_insert_own | INSERT / authenticated | — | (( SELECT auth.uid() AS uid) = user_id) |
| drill_answers / drill_answers_select_own | SELECT / authenticated | (( SELECT auth.uid() AS uid) = user_id) | — |
| drill_training_attempts / drill_training_insert_own | INSERT / authenticated | — | (( SELECT auth.uid() AS uid) = user_id) |
| drill_training_attempts / drill_training_select_own | SELECT / authenticated | (( SELECT auth.uid() AS uid) = user_id) | — |

Toutes sont PERMISSIVE et limitées à authenticated ; aucun droit étudiant DELETE ne résulte de ces politiques.

### Corps de fonction comparés

| Fonction | Corps Git / DEV après normalisation | SHA-256 du corps normalisé |
| --- | --- | --- |
| bprea_private.create_profile_for_auth_user | identiques | 33c002276a30f158693d8bc5cf72c352157c1ad99cc536e2c3e3950b20070281 |
| bprea_private.touch_profile_updated_at | identiques | ac57c7fde23ca01357a7ead72d2646dcbd5fc41c7f347b2419506b99002b68af |
| bprea_private.guard_drill_series | identiques | e8d8ea5bb4eeb4e2b1dcc583c23d698d133060ee0dff2027b42da97f5a454d7e |
| bprea_private.guard_drill_response | identiques | aedb3312132ac7f28388978d43c00f4f745ad8ca7d6b6f802defaaa60a9fb3e9 |
| public.drill_create_series | identiques | 23d8c583904f725c3b1052f19f93f487b117341ab4ec56629edda960f7aea8c6 |
| public.drill_record_answer | identiques | dfffa211316c2df9ba7d4656d4a17ac03dadffbf5d6a1a22159a9c25bdface63 |
| public.drill_record_training | identiques | 875569ce3fd08999dff468f6ad6017b24acb2297302e0c86568d58e3f59e4a8c |

R06 lit pg_class/namespace/attribute/attrdef/constraint/index/trigger/proc/policies/roles/auth_members et utilise uniquement les fonctions intégrées de décompilation/agrégation. R07 complète par ACL par défaut/extensions et fonctions natives has_*_privilege. R14 retire le filtre de préfixe pour inventorier toutes les routines non membres d’extension de public/bprea_private : aucune routine supplémentaire. Les requêtes ne lisent pas les lignes auth.users/profiles ou les historiques. Défs, JSON minimisés et comparateur locaux sous .tmp/lot652, ignorés ; aucun runner ou migration livré.
