# VÉRIFICATION ET FINALISATION — SUPABASE DEV LOT 6.1

Reprise auditée le **24 octobre 2026**. **Supabase DEV est prêt pour développer le lot 6.2**, avec la limite explicite des e-mails : aucun SMTP personnalisé actif, modèles versionnés non installés et aucun parcours depuis un message reçu validé. Cette conclusion n'autorise ni l'ouverture aux étudiants ni un déploiement en production.

## A. État retrouvé après interruption

La branche active est bien `chore/supabase-dev-setup`, au commit `159cc626c7e8aa0d7314040821c1f4bd71d097a6` du 23 octobre, identique au head de la [PR #10](https://github.com/Vladoche/mon-bprea/pull/10), ouverte en brouillon. L'arbre de travail était propre au début de la reprise. `main` est toujours `d782c6121d7dc7c1ee08a24a65a3b0660b1db164`. Les trois fichiers de la branche concernent uniquement le README, le guide Auth et ce rapport ; aucune modification applicative interrompue n'a été retrouvée.

Les journaux Codex du 23 octobre sont accessibles sous le répertoire local `sessions/2026/10/23` ; le journal principal est `rollout-2026-10-23T17-02-06-01a16948-939c-7ad3-aaee-2e3c3ed35a8a.jsonl`. Leur lecture ciblée retrouve les autorisations explicites de migration DEV, **« aucun envoi »**, puis **« Oui, comptes fictifs sans envoi »**. Ces choix sont conservés ; aucun identifiant ni journal brut n'est ajouté au dépôt.

Les traces, le reflog et les artefacts concordent : simulation puis application de la migration, préparation du frontend local, recette réelle sans e-mail réussie à 17 h 19, déconnexion des comptes, rapport, commit à 17 h 23 et création de la PR à 17 h 24. Le dernier message de suivi annonçait la finalisation documentaire. **L'interruption se situe donc après les opérations techniques réussies et autour de la livraison ; aucune migration ou recette encore en cours n'a été trouvée.** L'absence de réponse finale ne prouve pas un échec de ces opérations.

## B. État réel de Supabase DEV

Les statuts ci-dessous distinguent les lectures distantes du 24 octobre des parcours réellement exécutés le 23. Aucun succès historique n'est présenté comme une nouvelle exécution.

| Opération | État | Preuve | Action restante |
| --- | --- | --- | --- |
| Identification DEV / PROD | Terminé et vérifié | API projets du 24 : DEV `wcckbyhrtroittbfophv`, Ireland `eu-west-1` ; PROD `oqoqrxwfbkhtpksqimgd`, `eu-central-1` ; tous deux `ACTIVE_HEALTHY`, PostgreSQL 17.11 | Aucune |
| Migration PostgreSQL | Terminé et vérifié | Historique distant du 24 : seule version `20261022000100`, nom `profiles`, 21 instructions ; source cohérente avec le fichier versionné | Ne pas réexécuter |
| Table `profiles` | Terminé et vérifié | Catalogues PostgreSQL du 24 : UUID Auth, pseudo facultatif, dates serveur et contraintes conformes ; deux profils, aucun manquant | Aucune |
| Politiques RLS | Terminé et vérifié | Catalogues et privilèges du 24 conformes ; recette réelle A/B du 23 réussie | Aucune |
| Restrictions d'inscription | Terminé et vérifié | Refus réels du 23 ; Dashboard et GET `/auth/v1/settings` du 24 : inscriptions et anonymes désactivés | Aucune |
| Configuration Auth | Terminé et vérifié | E-mail seul fournisseur actif, confirmations actives ; minimum 12 caractères lu visuellement dans le Dashboard du 24 | Aucune |
| URL de redirection | Terminé et vérifié | Dashboard du 24 : Site URL exacte et unique callback exact, sans wildcard | Aucune |
| Modèles e-mails | Bloqué | Dashboard du 24 : sujets anglais par défaut et liens `ConfirmationURL`, édition désactivée faute de SMTP personnalisé | Après décision SMTP, installer les deux modèles versionnés puis relire les corps et sujets |
| SMTP personnalisé | Non réalisé | Dashboard du 24 : `Enable custom SMTP` désactivé | Aucune action nécessaire pour développer le lot 6.2 |
| Configuration locale | Terminé et vérifié | Cinq champs publics valides ; configuration et artefact ignorés ; GET DEV du 24 avec la clé locale : HTTP 200 | Aucune |
| Invitation de test | Partiellement terminé | Deux liens natifs générés et activés sans envoi le 23 ; résultat de recette `passed:true` | Livraison et parcours depuis un e-mail reçu non réalisés |
| Connexion et profil | Terminé et vérifié | Recette du 23 : connexion, pseudo, rechargement, déconnexion et historique local conservé ; résultat et captures retrouvés | Aucune répétition nécessaire |
| Isolation entre étudiants | Terminé et vérifié | Vrais JWT A/B et colonnes protégées vérifiés le 23 ; structure relue le 24 ; visiteur refusé de nouveau par HTTP 401 / `42501` | Aucune répétition nécessaire |
| Tests CI | Terminé et vérifié | Qualité de la PR #10 réussie ; dernier `supabase-security` du lot 6.1 réussi, avec SHAs distincts détaillés en D | Signaler que `supabase-security` n'est pas requis par le ruleset |

### SQL installé et cohérence de la migration

Le 24 octobre, lecture de `supabase_migrations.schema_migrations`, `pg_attribute`, `pg_constraint`, `pg_class`, `pg_policies`, `pg_trigger`, `pg_proc`, `pg_namespace` et des privilèges effectifs. La concaténation des 21 instructions enregistrées, terminée par un point-virgule, et le fichier local donnent le même MD5 après retrait des espaces : `9ff6408fb4959d22b796206267775db2`. Il s'agit d'un contrôle de cohérence du texte normalisé, complété par l'inspection des effets SQL, pas d'une signature cryptographique.

`public.profiles` appartient à `postgres`, avec RLS active. `id` est la PK UUID et référence `auth.users(id) ON DELETE CASCADE` ; les dates sont obligatoires avec défaut `now()` ; la contrainte du pseudo reste conforme. Seules les politiques personnelles `profiles_select_own` et `profiles_update_own` existent, avec `auth.uid() = id`, `USING` et `WITH CHECK` pour UPDATE. `authenticated` dispose de SELECT et d'UPDATE sur **`pseudo` seulement** ; aucun INSERT/DELETE ni modification d'UUID ou de dates. `anon` n'a aucun droit sur la table ou ses colonnes.

Les deux triggers applicatifs sont actifs. Les fonctions privées appartiennent à `postgres`, ont un `search_path` vide et les corps attendus ; seule la création du profil est `SECURITY DEFINER`. Aucun EXECUTE pour `anon`, `authenticated` ou `service_role` ; schéma privé réservé à `postgres`. Comptages actuels : **2 utilisateurs Auth, 2 profils, 0 profil manquant, 0 session, 0 refresh token**. Aucune donnée n'a été supprimée ou réinitialisée.

### Auth, e-mails et frontend

Le GET réel du 24 octobre à **09 h 44 min 59 s, Europe/Paris**, avec la clé publishable locale, confirme HTTP 200, `disable_signup:true`, `mailer_autoconfirm:false`, `external.email:true`, `external.anonymous_users:false` et aucun autre fournisseur actif. Le Dashboard confirme minimum **12 caractères**, OTP e-mail **3 600 secondes / 8 chiffres** et les deux URL exactes :

```text
Site URL : http://127.0.0.1:4173/mon-bprea/
Redirect : http://127.0.0.1:4173/mon-bprea/authentification.html
```

Les modèles effectivement affichés restent **`You've been invited`** et **`Reset your password`**, avec liens `{{ .ConfirmationURL }}`. Ils ne sont pas les modèles versionnés `TokenHash` attendus par le callback ; leur présence locale et le précédent `config diff` ne prouvent aucune installation. L'écran SMTP confirme qu'aucun SMTP personnalisé n'est actif. La [restriction officielle des nouveaux projets Free](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier) reste applicable. Aucun `config push`, changement de fournisseur, achat ou envoi n'a été tenté.

`auth-config.local.json` et la copie de l'artefact existant `.tmp/auth-dev-20261023/mon-bprea` sont identiques : `enabled:true`, `environment:development`, URL publique DEV exacte, clé de format publishable uniquement et Site URL ci-dessus. Ils sont ignorés par Git. L'artefact conserve **90 fichiers publics plus `.nojekyll` et 190 références versionnées**. `prepare-pages.py` refuse les champs supplémentaires, les clés administratives et une sortie non vide ; le cache busting est conservé.

Le callback local attend `token_hash` et `type=invite|recovery`, nettoie l'URL avant les modules, utilise `no-referrer` et `verifyOtp`, puis affiche le formulaire autorisé. Les preuves de communication du frontend connecté à DEV restent la recette et les captures du 23 octobre, relues pendant la reprise ; le GET du 24 confirme séparément que la clé locale est toujours acceptée. Aucun nouveau parcours connecté n'a été lancé. Un GET seul du [JSON public Pages](https://vladoche.github.io/mon-bprea/assets/auth-config.json) confirme HTTP 200, `enabled:false`, URL, clé et Site URL vides. Aucun E2E ne vise la production.

### Journaux et intégrations

Les journaux des 24 dernières heures ont été interrogés en lecture seule. Auth ne présente aucune entrée `error`, `fatal` ou `panic` ; les avertissements correspondent aux dépréciations GoTrue et aux refus attendus des essais (`signup_disabled`, `anonymous_provider_disabled`, `invalid_credentials`, `otp_expired`, refresh/session introuvables). PostgreSQL contient des erreurs historiques : objets Realtime absents et connexions interrompues au démarrage du projet, historique de migration absent avant application, une requête d'audit mal formée le 23 à 17 h 13, puis les refus `42501` de la recette et du GET visiteur du 24. Les objets attendus et l'état Healthy sont vérifiés actuellement ; aucun correctif SQL n'est justifié par ces seules traces. Le conseiller sécurité ne relève que `auth_leaked_password_protection` désactivé, décrit en E.

Les intégrations GitHub ont été relues dans les Dashboards DEV **et PROD**, sans enregistrement : répertoire `.`, **Deploy to production désactivé**, **Automatic branching désactivé**. Les workflows distants ont été lus : seuls Qualité, Sécurité Auth/RLS et Pages existent ; aucun n'applique de migration Supabase distante. Dans cette configuration observée, une fusion ne déclenche donc pas de migration GitHub/Supabase sur PROD. Cela ne préjuge pas d'un changement futur de ces réglages.

## C. Travail repris le 24 octobre

Reconstitution ciblée des journaux Codex, du reflog, du commit, de la PR et des résultats conservés ; audit SQL distant, réglages Dashboard, journaux, lectures HTTP publiques et état GitHub/CI. La migration et la recette déjà réussies n'ont pas été relancées. Aucun projet, compte, lien natif ou session supplémentaire n'a été créé ; aucune configuration hébergée n'a été modifiée.

Ce rapport et son lien README sont actualisés sur la branche existante, pour compléter **la PR #10 existante**, sans duplication de PR ni fusion. Le script ponctuel de GET se trouve seulement dans `.tmp/audit-local-get-20261024.mjs`, ignoré. Le refus réseau initial du bac à sable a été résolu par une relance explicitement autorisée ; les sorties ne contiennent ni clé ni jeton. Aucun changement applicatif ou de dépendance, aucune réinstallation.

## D. Résultats des tests et portée

| Vérification | Exécution et preuve | Résultat |
| --- | --- | --- |
| Vitest local | 23 octobre ; cache de 13 fichiers sans échec et rapport conservés | **107 réussis**, aucun échec déclaré dans le rapport |
| E2E locaux classiques | Rapport Playwright du 23, début 17 h 04 min 56 s Paris, relu | **17 réussis, 0 échec, 0 flaky, 0 ignoré** |
| Qualité PR #10 | SHA `159cc626…`, [run 39977973243](https://github.com/Vladoche/mon-bprea/actions/runs/39977973243), logs relus le 24 | [107 tests / 13 fichiers](https://github.com/Vladoche/mon-bprea/actions/runs/39977973243/job/120497476335) et [17 E2E](https://github.com/Vladoche/mon-bprea/actions/runs/39977973243/job/120497476750), succès |
| Supabase local sur ce poste | Non exécuté : Docker absent ; aucune redirection de runner vers DEV | **Non validé sur ce poste** |
| Dernier `supabase-security` CI | SHA `f3bade171534a5a59a7409897f2a112b2a74f759`, [job 120009863515](https://github.com/Vladoche/mon-bprea/actions/runs/39831883824/job/120009863515), logs relus | **19 pgTAP, 11 groupes Auth/RLS, 1 E2E réel réussis** dans une stack locale éphémère |
| Recette DEV hébergée | 23 octobre, résultat `.tmp/recipe-dev-no-mail-result.json` et script relus | **8 contrôles réussis**, `passed:true`, aucun e-mail, comptes conservés et sessions déconnectées |
| HTTP réel de reprise | 24 octobre, GET settings DEV, profiles visiteur DEV et JSON Pages | **3 lectures conformes** : HTTP 200, HTTP 401 / `42501`, HTTP 200 désactivé |
| Audit SQL et Dashboard de reprise | 24 octobre, lectures directes décrites en B | Migration, profils, privilèges, Auth, redirections et intégrations conformes ; blocage modèles confirmé |

La recette DEV du 23 couvre les refus d'inscription libre/anonyme, invitations natives sans livraison, activation et mots de passe via API, connexion, profil personnel, pseudo persistant, vrais JWT A/B, refus des colonnes techniques, frontend/rechargement, récupération native et révocation du refresh. L'administration n'y sert qu'à `generateLink`, jamais à représenter les droits d'un étudiant.

Les suites réussies ne sont pas réexécutées pendant cette reprise, conformément à la demande de ne pas répéter les opérations validées. Les mocks ne prouvent pas RLS et la CI locale ne prouve pas les réglages DEV : les preuves hébergées restent identifiées séparément. Les captures desktop 1 280 px et mobile 390 px du 23 ont été réinspectées : mode sombre et rendu sans débordement conservés. Aucun rendu applicatif n'est modifié ici.

**Non vérifiés :** livraison/réception d'e-mails, callback et formulaires complets depuis un message reçu, installation effective des modèles personnalisés et expiration hébergée après une heure. Aucun de ces scénarios n'est déclaré réussi.

## E. Sécurité

**PROD n'a pas été modifié.** L'identité et l'intégration y ont seulement été consultées. Aucun déploiement Pages, changement de ruleset, fusion, achat ou suppression de données. La configuration publiée reste désactivée ; aucun secret n'a été ajouté aux fichiers suivis ou au frontend. Le contrôle ciblé des fichiers suivis ne relève aucune clé administrative/private ; les faux formats des tests de rejet ne sont pas des credentials. Les deux comptes synthétiques restent conservés et sans session.

Le [ruleset actif #25489814](https://github.com/Vladoche/mon-bprea/rules/25489814) exige une PR, interdit suppression/force push et ne prévoit aucun bypass. Il impose **`unit-integration` et `e2e` seulement : `supabase-security` n'est pas obligatoire**. Aucun réglage modifié. Le dernier job sécurité est réussi ; l'absence d'un nouveau run sur la PR documentaire correspond au filtre de chemins du workflow. La protection classique de branche reste inaccessible au connecteur (403), tandis que le ruleset explicite est lisible.

Risque résiduel relevé par le conseiller : [protection contre les mots de passe divulgués désactivée](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), fonctionnalité réservée à Pro et offres supérieures dans le Dashboard actuel ; aucun achat effectué. Restent aussi les limites documentées des JWT après déconnexion, de la session persistante sur appareil partagé/XSS et des liens présents dans la première requête HTTP. Le SMTP et les parcours e-mails ne sont pas validés. Les préparatifs de confidentialité du lot 6.4 et l'ouverture du lot 6.5 demeurent distincts.

## F. Actions personnelles restantes

**Aucune intervention personnelle indispensable pour commencer le développement du lot 6.2.** Le choix « aucun envoi » reste respecté et aucune nouvelle autorisation n'est demandée pour rejouer un travail réussi.

Pour valider ultérieurement les parcours e-mails : choisir un SMTP adapté existant ou gratuit, fournir ses paramètres uniquement dans une interface sécurisée officielle, et désigner une adresse de réception avec autorisation d'envoi. L'installation des deux modèles et les essais complets pourront alors être repris sur DEV. Aucun service payant ne sera engagé sans accord.

## G. Conclusion

**Supabase DEV est prêt pour le lot 6.2 : migration, profils, RLS, Auth par API et frontend local disposent des preuves attendues.** La configuration e-mail reste partielle et ne permet pas de qualifier les invitations/récupérations reçues comme validées. Ce point devra être levé avant l'ouverture réelle, sans bloquer le développement du lot 6.2. La PR documentaire reste en brouillon, sans fusion ni publication.

## Historique conservé — intervention du 23 octobre 2026

Le compte rendu ci-dessous conserve les détails de l'intervention précédente. Ses mentions de serveur ou navigateur prêt décrivent le 23 octobre, sans garantir qu'un processus soit encore actif le 24. Pour l'état courant et les seules actions restantes, se reporter à A–G ci-dessus.

État final du **23 octobre 2026**, branche `chore/supabase-dev-setup`. **La migration, Auth par API, les profils, RLS et les parcours connectés du frontend local sont validés sur DEV avec deux comptes fictifs.** Les modèles d'e-mails restent ceux par défaut : aucun e-mail envoyé ou reçu, aucun parcours complet depuis un e-mail ni callback correspondant validé. DEV est utilisable pour développer le lot 6.2 avec cette limite explicite.

Références : [architecture de l'authentification](../architecture/AUTHENTIFICATION.md), [conventions de tests](../TESTS.md), [validation du lot 6.1](VALIDATION-LOT6-1.md).

## Périmètre et autorisations

| Environnement | Nom réel | Référence | Région | État et intervention |
| --- | --- | --- | --- | --- |
| DEV, seule cible des écritures autorisées | Mon BPREA DEV | `wcckbyhrtroittbfophv` | `eu-west-1` — Ireland | Healthy, PostgreSQL 17.11 ; migration et recette décrites ci-dessous |
| PROD, exclue des écritures | Mon BPREA PROD | `oqoqrxwfbkhtpksqimgd` | `eu-central-1` | Healthy ; identification et intégration GitHub consultées en lecture seule |

L'audit a précédé toute écriture distante. L'utilisateur a ensuite autorisé la connexion officielle de la CLI et la migration DEV, puis l'utilisation de **deux adresses fictives `example.invalid`** et la génération de liens natifs sans envoi. Aucun nouveau projet créé, aucun compte étudiant réel utilisé, aucune donnée utilisateur supprimée. **PROD n'a subi aucune modification.** Aucun achat ni abonnement engagé.

## Migration et protections SQL effectivement appliquées

État initial DEV : historique des migrations vide, zéro utilisateur Auth, aucun `public.profiles`, objet applicatif `bprea_private` ou trigger applicatif sur `auth.users`. Le message « No migrations » a été complété par l'audit SQL des objets existants.

Après authentification officielle de la **CLI 2.121.0**, la simulation ciblée a annoncé exactement la migration existante, sans seed, rôles supplémentaires ni écriture Vault :

```text
supabase db push --project-ref wcckbyhrtroittbfophv --dry-run --skip-vault
supabase db push --project-ref wcckbyhrtroittbfophv --skip-vault --yes
```

Les commandes ont été exécutées via `npm exec` avec `supabase@2.121.0`. L'application a réussi ; l'historique distant contient la version exacte **`20261022000100`**, nom **`profiles`**, correspondant à [20261022000100_profiles.sql](../../supabase/migrations/20261022000100_profiles.sql). Aucun SQL recollé arbitrairement dans l'éditeur, aucune modification de la migration validée, aucun `db reset`.

L'audit SQL après migration confirme :

| Élément | Résultat observé |
| --- | --- |
| `public.profiles` | RLS activée ; `id` UUID, clé primaire et référence `auth.users(id)` avec `ON DELETE CASCADE` |
| Pseudo et dates | Contrainte `profiles_pseudo_valid` présente ; pseudo facultatif ou 2–40 caractères sans espaces de bord ni contrôles ; dates serveur avec défaut `now()` |
| Lecture | Politique `profiles_select_own` pour `authenticated`, condition `(select auth.uid()) = id` |
| Modification | Politique `profiles_update_own`, `USING` et `WITH CHECK` sur le même UUID ; `authenticated` peut modifier **uniquement `pseudo`** |
| Privilèges | `authenticated` a `SELECT` ; aucun droit étudiant d'insertion/suppression ni de modification des colonnes techniques ; aucun droit de table pour `anon` ou `PUBLIC` |
| Fonctions privées | Propriétaire `postgres`, `search_path` vide ; `create_profile_for_auth_user` en `SECURITY DEFINER`, `touch_profile_updated_at` en `SECURITY INVOKER` ; aucun droit d'exécution accordé à `PUBLIC`, `anon`, `authenticated` ou `service_role` |
| Triggers | `bprea_auth_user_created` et `bprea_profile_updated` présents et actifs |
| État final des comptes | **Deux utilisateurs Auth synthétiques et deux profils conservés** ; **zéro session et zéro refresh token**, confirmés par audit SQL après déconnexion finale |

Le conseiller sécurité ne retournait aucun lint avant la recette. Le contrôle final relève **un avertissement Auth `auth_leaked_password_protection` désactivé**, sans problème SQL/RLS signalé. La protection contre les mots de passe divulgués est réservée à Pro et offres supérieures ; elle n'a pas été activée et aucun achat n'a été effectué. Le minimum serveur reste 12 caractères. Voir la [documentation de cette protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Les journaux initiaux contenaient des avertissements internes de dépréciation GoTrue ; la requête finale des logs Auth aux niveaux `error`, `fatal` et `panic` ne retourne aucune entrée.

## Auth, redirections et e-mails

Les valeurs Auth de base étaient déjà conformes ; elles n'ont pas été changées. Leur lecture Dashboard a été complétée par le GET public `/auth/v1/settings` avec la clé publishable DEV et par les refus réels décrits dans la recette.

| Réglage hébergé | Valeur vérifiée |
| --- | --- |
| Inscription publique | Désactivée, `disable_signup=true` |
| Connexions anonymes | Désactivées, `external.anonymous_users=false` |
| Fournisseurs | E-mail/mot de passe actif, seul fournisseur activé |
| Confirmation e-mail | Activée, `mailer_autoconfirm=false` |
| Mot de passe | Minimum 12 caractères, confirmé dans le fournisseur e-mail DEV |
| OTP e-mail | Expiration 3 600 secondes, longueur 8 ; durées locales courtes non reportées sur DEV |
| Site URL | `http://127.0.0.1:4173/mon-bprea/` |
| Redirect URL autorisée | `http://127.0.0.1:4173/mon-bprea/authentification.html`, exacte et sans wildcard |

**Les modèles Invite user et Reset password n'ont pas été installés.** Ils restent en anglais avec `ConfirmationURL`, alors que le callback du lot 6.1 attend les modèles versionnés utilisant `TokenHash`. Le Dashboard bloque leur édition avec le SMTP Supabase par défaut sur ce projet Free. Cette restriction des nouveaux projets Free est confirmée depuis le 3 juin 2026 par le [changelog officiel Supabase](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier) ; un SMTP personnalisé permet la personnalisation sans imposer un passage à Pro.

Une configuration CLI temporaire pointant vers les fichiers HTML a été préparée ; `config diff` n'a affiché que les deux sujets. Cela ne prouve aucune installation des corps. **Aucun `config push` n'a été exécuté**, afin de respecter la restriction constatée.

Quand un SMTP adapté sera disponible et autorisé, les valeurs à appliquer sont :

| Modèle Dashboard | Sujet exact | Corps intégral versionné |
| --- | --- | --- |
| Authentication → Emails → Invite user | `Activer votre compte Mon BPREA` | [supabase/templates/invite.html](../../supabase/templates/invite.html) |
| Authentication → Emails → Reset password | `Réinitialiser votre mot de passe Mon BPREA` | [supabase/templates/recovery.html](../../supabase/templates/recovery.html) |

Conserver les variables et le `/` final de Site URL. Les liens des corps sont respectivement :

```html
{{ .SiteURL }}authentification.html?token_hash={{ .TokenHash }}&amp;type=invite
{{ .SiteURL }}authentification.html?token_hash={{ .TokenHash }}&amp;type=recovery
```

Aucun envoi ou réception d'e-mail, aucun formulaire de demande de récupération déclenché et aucune délivrabilité SMTP validée pendant cette recette.

## Recette réelle DEV et frontend local

La recette ponctuelle `.tmp/recipe-dev-no-mail.mjs` est **distincte des runners réservés à la stack Supabase locale** : ceux-ci n'ont pas été modifiés ni redirigés. Elle utilise le SDK officiel et Chromium Playwright dans un contexte isolé, avec une garde imposant la référence DEV et une confirmation d'environnement exacte. Elle s'est terminée avec **code 0, huit contrôles réussis**, résultat sans secret dans `.tmp/recipe-dev-no-mail-result.json` (`passed=true`, `emailSent=false`, `sessionsSignedOut=true`, `accountsRetained=true`).

L'accès administratif, récupéré par la CLI et capturé uniquement en mémoire du processus, n'a servi qu'à `generateLink` pour les invitations et la récupération. Il n'a été placé ni dans le frontend ni dans les journaux. Tous les accès représentant un étudiant utilisent la clé publishable et de véritables JWT utilisateur. La garde interdit les endpoints d'envoi `/invite`, `/recover`, `/otp` et `/resend` ; les liens natifs générés ne livrent aucun message.

| Contrôle réel | Résultat |
| --- | --- |
| Inscriptions interdites | Tentative e-mail avec adresse fictive `.invalid` refusée : `signup_disabled` ; tentative anonyme refusée : `anonymous_provider_disabled` |
| Invitations natives sans e-mail | Deux liens `generateLink` de type invite, activés par `verifyOtp` ; mots de passe définis via API ; réutilisation d'un lien refusée |
| Création des profils et RLS A/B | Profils créés par trigger ; chaque session voit exactement son propre profil ; lecture voisine vide et mise à jour voisine sans ligne modifiée ; colonnes `id` et dates refusées avec `42501` ; accès anonyme refusé |
| Persistance du pseudo | Modification autorisée puis relecture identique dans une nouvelle session utilisateur |
| Frontend local connecté | Connexion, modification du pseudo, rechargement, thème hiver sombre et déconnexion réussis ; historique local conservé |
| Récupération native sans e-mail | Lien `generateLink` recovery, `verifyOtp`, changement effectif via API ; ancien mot de passe refusé, nouveau accepté, réutilisation du lien refusée |
| Déconnexion et renouvellement | Déconnexion réelle ; refresh révoqué ; déconnexion globale finale réussie pour les sessions créées |
| Inspection visuelle | Desktop 1 280 px et mobile 390 px, sans débordement ni `pageerror` ; captures `.tmp/dev-profile-desktop.png` et `.tmp/dev-profile-mobile.png` inspectées |

L'artefact local est préparé sous `.tmp/auth-dev-20261023/mon-bprea`, version `auth-dev-20261023` : **90 fichiers, 190 références**. `auth-config.local.json` est ignoré par Git et contient uniquement les cinq paramètres publics attendus, dont l'URL DEV et sa clé publishable. Le défaut versionné **`assets/auth-config.json` reste désactivé et intact**. Un simple GET du [JSON public GitHub Pages](https://vladoche.github.io/mon-bprea/assets/auth-config.json) confirme aussi `enabled:false`, `environment:development`, URL et clé vides, sans E2E sur la production ni publication. Aucun secret publié, aucune activation de l'authentification sur GitHub Pages. Le navigateur local et le serveur au port 4173 restent prêts pour inspection.

Ces résultats valident Auth par API, les sessions et RLS hébergées ainsi que les vues connectées du frontend. **Ils ne valident pas l'e-mail reçu, le callback depuis cet e-mail ni les formulaires d'activation/récupération de bout en bout.** Les expirations hébergées n'ont pas été attendues pendant une heure ; aucune validation de leur échéance réelle n'est revendiquée. Le refus du refresh après déconnexion ne signifie pas une révocation instantanée des access tokens déjà émis.

## Tests locaux, CI et intégration GitHub

| Vérification | Résultat et portée |
| --- | --- |
| `npm test` local | **107 tests réussis dans 13 fichiers** ; logique et intégration applicatives, sans preuve RLS à elles seules |
| `npm run test:e2e` local | **17 scénarios réussis** ; parcours autonomes locaux |
| Stack Supabase locale sur ce poste | Non exécutée : Docker absent ; CLI disponible |
| Sécurité réelle CI du lot 6.1 | Réussie dans une stack locale éphémère, avec pgTAP, Auth/PostgreSQL/RLS et expirations locales ; preuve distincte de la recette DEV ci-dessus |

Le Dashboard DEV lie `Vladoche/mon-bprea`, répertoire **`.`**. **Deploy to production et Branching sont désactivés** sur l'offre Free. La lecture des intégrations PROD confirme aussi **Deploy to production et Automatic branching désactivés**. Les mécanismes de migration automatique lors d'une fusion sont donc actuellement désactivés dans les deux projets ; aucun réglage d'intégration n'a été modifié.

Preuves GitHub auditées en lecture seule :

| Contrôle | Résultat et référence |
| --- | --- |
| Lot 6.1 fusionné | [PR #9](https://github.com/Vladoche/mon-bprea/pull/9), fusionnée le 22 octobre 2026 à 20:46:48, heure de Paris |
| SHA `main` audité | `d782c6121d7dc7c1ee08a24a65a3b0660b1db164`, commit de cette fusion |
| `unit-integration` | [Succès](https://github.com/Vladoche/mon-bprea/actions/runs/39831883482/job/120009863074) sur le head de PR `f3bade171534a5a59a7409897f2a112b2a74f759` |
| `e2e` | [Succès](https://github.com/Vladoche/mon-bprea/actions/runs/39831883482/job/120009863119) sur le même head |
| `supabase-security` | [Succès](https://github.com/Vladoche/mon-bprea/actions/runs/39831883824/job/120009863515) sur le même head ; stack locale de CI, sans secrets PROD |
| Protection `main` | [Ruleset actif #25489814](https://github.com/Vladoche/mon-bprea/rules/25489814) : PR requise, suppression et force push interdits, `unit-integration` et `e2e` obligatoires, aucun bypass ; inchangé |
| `supabase-security` obligatoire | **Non** : absent des contrôles obligatoires ; aucune modification demandée ou appliquée |
| Publication préexistante | [GitHub Pages réussi](https://github.com/Vladoche/mon-bprea/actions/runs/39842716392), lancement manuel du 22 octobre à 21:44:25 sur le SHA actuel de `main` ; aucun déploiement public déclenché pendant cette intervention |

Les trois workflows distants sont [quality.yml](https://github.com/Vladoche/mon-bprea/blob/main/.github/workflows/quality.yml), [auth-security.yml](https://github.com/Vladoche/mon-bprea/blob/main/.github/workflows/auth-security.yml) et [deploy.yml](https://github.com/Vladoche/mon-bprea/blob/main/.github/workflows/deploy.yml). Ils conservent leurs noms de jobs ; aucun n'applique de migration Supabase distante. Les checks observés sont ceux de GitHub Actions, sans check Supabase sur le SHA de `main` ni sur le dernier head de la PR. Limite du connecteur : protection classique de branche inaccessible avec `403 Resource not accessible by integration` ; le ruleset explicite est lisible et l'inventaire des workflows a été obtenu via l'API Contents.

## Interventions restantes

1. Décider d'un **SMTP personnalisé existant ou gratuit**, puis autoriser sa configuration sur DEV. Aucun achat engagé ; identifiants à transmettre uniquement par une voie sécurisée officielle.
2. Installer les deux modèles exacts par une voie officielle autorisée, sans contourner la restriction Free, puis vérifier les corps et sujets effectivement enregistrés.
3. Avec une adresse de réception d'essai explicitement autorisée et l'autorisation d'envoyer, vérifier la livraison réelle, les URL reçues, l'activation et la récupération depuis l'e-mail jusqu'au callback et au formulaire, notamment dans un navigateur neuf. Consigner les limites éventuelles du fournisseur SMTP.

Les deux comptes synthétiques et leurs profils sont conservés, sans session active. L'ouverture aux étudiants, les changements PROD, l'achat d'un service, la fusion et le déploiement public nécessitent des décisions distinctes et n'ont pas été réalisés.
