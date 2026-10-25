# Authentification et profils — lot 6.1

Le lot 6.3.2 réutilise cette même frontière Auth pour la [synchronisation personnelle des cours et QCM](COURSE-QUIZ-SYNCHRONISATION-CLIENT.md), en complément du Drill. Les comptes ont des caches distincts par environnement/projet/UUID ; la clé visiteur n’est importée qu’après confirmation explicite. Une déconnexion conserve les données et outboxes tout en masquant les vues privées. Les descriptions du périmètre initial 6.1 ci-dessous restent historiques ; les procédures d’invitation, les privilèges profils et le défaut public désactivé ne changent pas.

Le lot 6.2.2 réutilise ce service pour la [synchronisation personnelle du Drill](DRILL-SYNCHRONISATION-CLIENT.md), avec vérification de session avant chaque accès distant et JWT fixé par requête. Il ajoute un état `offline` limité à une identité locale déjà vérifiée (UUID/session_id correspondants), sans autorisation distante ; toute identité incertaine masque le cache. La déconnexion invalide immédiatement les vues et requêtes, puis appelle le SDK, sans effacer la progression. Les profils, RLS et flux d'invitation ci-dessous restent inchangés.

Le frontend reste un site statique servi par GitHub Pages. Supabase Auth gère les comptes invités et les sessions ; PostgreSQL protège les profils avec des privilèges de colonnes et des politiques RLS. Les cours et outils restent publics. Les exercices, le Tableau de bord, les ITK, les préférences et les historiques botaniques ne sont pas synchronisés dans ce lot.

La configuration versionnée est **désactivée**. Aucun projet, identifiant ou secret n’est fourni par le dépôt. La présence du code et des tests ne vaut pas validation de Supabase. Les opérations réellement exécutées et les blocages sont consignés dans [VALIDATION-LOT6-1.md](../validations/VALIDATION-LOT6-1.md). L’ouverture aux étudiants attend le lot 6.5 et une validation explicite ; la préparation juridique et les procédures de droits attendent notamment le lot 6.4.

## Modules et pages

| Fichier | Responsabilité |
| --- | --- |
| `assets/supabase-client.js` | Charge et valide la configuration publique, puis crée un seul client SDK par document. |
| `assets/auth-service.js` | Singleton partagé par le header et la page : états, restauration, validation serveur de l’utilisateur, connexion, récupération et profils. |
| `assets/auth-validation.js` | Validation française des e-mails, identifiants, mots de passe et pseudos. |
| `assets/auth-header.js` | Accès discret Connexion ou Mon profil / Déconnexion, sans changer les trois rubriques. |
| `assets/auth-pages.js`, `assets/auth.css` | Formulaires, messages accessibles, états de chargement et affichage privé. |
| `connexion.html` | E-mail et mot de passe, sans formulaire d’inscription. |
| `mot-de-passe-oublie.html` | Demande de réinitialisation avec confirmation générique. |
| `authentification.html` | Retour unique d’invitation et de récupération, puis définition du mot de passe. |
| `profil.html` | E-mail Auth, date du compte et pseudo facultatif. |
| `supabase/migrations/` | Définition versionnée du modèle, des contraintes et des droits. |

`@supabase/supabase-js` **2.118.0** est verrouillé dans les dépendances de développement ; `esbuild` **0.28.2** prépare `assets/vendor/supabase.js`. Le navigateur charge ce fichier local, sans CDN, import npm ni serveur Node.js. Après une mise à jour volontaire du SDK, conserver manifeste et verrou ensemble, reconstruire puis tester :

```bash
npm ci
npm run build:auth-sdk
npm test
npm run test:e2e
```

Utiliser Node.js 24 LTS pour ces outils. Le site publié reste utilisable sans Node.js. Le cache busting de [CACHE.md](CACHE.md) s’applique aussi aux nouveaux modules, styles, imports et JSON.

## Séparer développement et production

Deux projets hébergés existent déjà. La [validation Supabase DEV du 23 octobre 2026](../validations/VALIDATION-SUPABASE-DEV.md) consigne leur identification, la migration appliquée et les parcours réellement vérifiés avec deux comptes fictifs sans envoi d'e-mail. Ne pas créer de projet supplémentaire ; les modèles et la livraison des e-mails restent à configurer et à valider.

| Environnement | Usage | Données |
| --- | --- | --- |
| Stack CLI `mon-bprea-lot6-1-local` | Migrations, SMTP capturé, essais automatisés réels et RLS | Comptes fictifs isolés exclusivement |
| Projet Supabase DEV distinct | Vérification manuelle d’une configuration hébergée, avec frontend local | Comptes d’essai autorisés, jamais les camarades |
| Projet Supabase PROD distinct | Futur accueil des étudiants au lot 6.5 | Aucun compte étudiant à créer dans ce lot |

Dans le Dashboard Supabase, sélectionner le projet DEV existant et vérifier sa référence exacte à partir du rapport de validation. Conserver le mot de passe de base dans un gestionnaire de secrets. Relever l’URL publique et la clé **publishable** dans les réglages API. Ne pas créer une table à la main : utiliser les migrations versionnées et contrôler leur historique. La migration du lot 6.1 est déjà appliquée sur DEV ; ne pas la rejouer. Vérifier les réglages Auth et les URL, puis résoudre la configuration des modèles d’e-mails avec un SMTP adapté.

Le projet PROD existe séparément, avec ses propres clés, règles, SMTP, sauvegardes et réglages à préparer avant l’ouverture. Ne pas copier la base d’essai ni ses comptes. Toute opération nécessitant l’accès à un projet ou une modification distante doit être effectuée par une personne autorisée ; ne jamais confondre une préparation locale avec un déploiement. Aucune opération de préparation DEV ne doit modifier PROD.

## Configuration publique du frontend

`assets/auth-config.json` reste le défaut versionné avec `enabled: false`. Copier le modèle racine dans un fichier ignoré :

```powershell
Copy-Item -LiteralPath auth-config.example.json -Destination auth-config.local.json
```

Remplir uniquement les cinq champs du modèle avec les valeurs réellement fournies par DEV :

| Champ | Valeur attendue |
| --- | --- |
| `enabled` | `true` uniquement une fois l’environnement préparé |
| `environment` | `development` pour les essais ; `production` pour la future publication autorisée |
| `url` | URL publique du projet Supabase, sans identifiants ni chemin d’API |
| `publishableKey` | Clé cliente commençant par `sb_publishable_` |
| `siteUrl` | URL exacte du dossier servi, avec `/` final |

En développement, le frontend doit être servi sur `localhost`, `127.0.0.1` ou `::1`. Le projet Supabase peut être local ou hébergé ; HTTP n’est accepté pour Supabase que sur la boucle locale. En production, HTTPS et des hôtes non locaux sont exigés. L’URL configurée doit correspondre exactement à l’origine et au dossier de la page courante : un autre port, hôte ou préfixe produit un état indisponible.

Préparer une copie publique locale sous le même préfixe que Pages :

```bash
python scripts/prepare-pages.py --version auth-dev --auth-config auth-config.local.json --output .tmp/auth-dev/mon-bprea
python -m http.server 4173 --directory .tmp/auth-dev
```

Ouvrir `http://127.0.0.1:4173/mon-bprea/`, avec `siteUrl` identique dans le JSON. La préparation exige un dossier de sortie neuf ou vide ; pour une nouvelle copie, choisir un nouveau dossier. Arrêter ce serveur avant `npm run test:e2e`, qui utilise lui-même le port 4173.

L’option `--auth-config` copie exclusivement ces paramètres publics dans l’artefact, sans modifier le défaut des sources. Le script refuse les champs supplémentaires et les clés autres que publishable ; la validation navigateur complète ce contrôle. La clé publique est lisible par chacun : **RLS constitue la protection des données**, comme l’explique la [documentation des clés Supabase](https://supabase.com/docs/guides/getting-started/api-keys).

Ne placer dans aucun fichier public une clé `secret`, `service_role`, un mot de passe de base, un jeton d’administration ou des identifiants SMTP. `.gitignore` exclut `auth-config.local.json`, les `.env*` privés et les répertoires temporaires Supabase ; les `.env.example` sans valeurs restent versionnés. Le mécanisme Pages ne copie ni les fichiers racine de configuration locale, ni `supabase/`, `scripts/`, `tests/`, `docs/` ou `node_modules/`.

## Réglages Auth et invitations

Dans le projet DEV, désactiver **Allow new users to sign up** et **Allow anonymous sign-ins**. Conserver le fournisseur e-mail/mot de passe nécessaire à la connexion et vérifier ses réglages de confirmation. Ne pas activer un autre fournisseur permettant de créer librement des comptes. Régler le minimum serveur à 12 caractères ; le formulaire de nouveau mot de passe impose 12 à 128 caractères et une confirmation identique. La connexion accepte les mots de passe existants non vides.

La stack locale fixe `auth.enable_signup=false`, `auth.sms.enable_signup=false` et `auth.enable_anonymous_sign_ins=false`. **`auth.email.enable_signup=true` conserve le fournisseur e-mail actif** : malgré son nom dans la CLI, ce réglage pilote `GOTRUE_EXTERNAL_EMAIL_ENABLED`. Le désactiver empêcherait aussi les comptes invités de se connecter par mot de passe. L’interdiction de création libre repose sur le réglage global `auth.enable_signup=false` et doit être vérifiée par un appel API réel. Ce fichier ne configure pas automatiquement un projet hébergé : reporter et contrôler les réglages dans son Dashboard. Voir les [options générales Auth](https://supabase.com/docs/guides/auth/general-configuration) et le [mappage officiel de la CLI 2.121.0](https://github.com/supabase/cli/blob/v2.121.0/apps/cli/src/commands/start/services/gotrue.service.ts).

Une personne autorisée utilise **Authentication → Users → Invite user** dans le Dashboard. L’invitation native crée l’utilisateur Auth ; le trigger crée son profil dans la même transaction. Le destinataire ouvre le lien, confirme explicitement son traitement, définit son mot de passe puis consulte son profil. Aucun envoi administratif n’existe dans le frontend. L’[API administrative native](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail) est réservée au service de confiance ou au runner local isolé.

Vérifier réellement, avec un client public non connecté, que l’appel direct `auth.signUp()` est refusé avec `signup_disabled` et que `signInAnonymously()` est refusé. Un bouton absent et une configuration écrite ne démontrent pas ce refus. Tester ensuite invitation valide, expirée, déjà consommée, invalide, compte déjà existant et ouverture dans un navigateur neuf. Pour une personne déjà activée, utiliser le parcours de récupération plutôt que créer un second compte. Ne pas envoyer d’invitation réelle aux étudiants pendant ce lot.

## URL de retour et modèles d’e-mails

Le remote Git pointe vers `https://github.com/Vladoche/mon-bprea.git` et `.github/workflows/deploy.yml` utilise GitHub Pages. L’adresse `https://vladoche.github.io/mon-bprea/` a également répondu HTTP 200 à une requête HEAD le 22 octobre 2026, sans changement d’URL finale. Ce contrôle confirme l’adresse publique ; il ne teste aucune authentification en production. Vérifier à nouveau l’adresse avant de configurer PROD si le domaine ou le dépôt change.

| Configuration | DEV local | PROD future, à confirmer |
| --- | --- | --- |
| Site URL | `http://127.0.0.1:4173/mon-bprea/` | `https://vladoche.github.io/mon-bprea/` |
| Redirect URL autorisée | `http://127.0.0.1:4173/mon-bprea/authentification.html` | `https://vladoche.github.io/mon-bprea/authentification.html` |

Entrer les URL exactes, sans wildcard, dans **Authentication → URL Configuration**. Garder le `/` final de Site URL : les modèles construisent le lien en lui ajoutant `authentification.html`. Retirer les anciennes URL de démonstration avant ouverture. Les règles Supabase de [redirection](https://supabase.com/docs/guides/auth/redirect-urls) restent nécessaires, même lorsque le modèle vise directement le site.

Copier le contenu versionné de `supabase/templates/invite.html` dans **Invite user**, et celui de `recovery.html` dans **Reset password**. Le premier utilise :

```html
{{ .SiteURL }}authentification.html?token_hash={{ .TokenHash }}&amp;type=invite
```

Le second remplace `invite` par `recovery`. Les variables sont celles des [modèles officiels Supabase](https://supabase.com/docs/guides/auth/auth-email-templates). Le service transmet aussi le callback exact à `resetPasswordForEmail()` ; ne pas remplacer ces modèles par un lien implicite renvoyant une session dans le fragment.

Au chargement du callback, le premier script du document extrait seulement `token_hash` et `type`, refuse les paramètres dupliqués, types inconnus et fragments, puis retire immédiatement query et fragment avec `history.replaceState`, avant les ressources et modules. Les pages de compte déclarent `Referrer-Policy: no-referrer` via leur balise meta. La valeur transitoire passe en mémoire à l’interface puis disparaît de `window` ; aucun jeton n’est affiché ou journalisé par le code.

Le bouton **Continuer l’activation** ou **Continuer la réinitialisation** déclenche `verifyOtp({ token_hash, type })`. Ce clic réduit les consommations involontaires par les scanners d’e-mails qui ouvrent les liens. Le formulaire apparaît seulement après réponse Auth valide ; le mot de passe est enregistré avec `updateUser`. Le parcours ne dépend pas d’un vérificateur créé dans le navigateur d’envoi, ce qui permet l’ouverture d’une invitation ailleurs. Une URL `next`, `redirect` ou un chemin fourni par l’utilisateur n’est jamais utilisé pour naviguer.

Le `token_hash` permet de consommer le lien et reste sensible. **La première requête HTTP vers le callback contient sa query** : l’hébergeur, un proxy ou le fournisseur de messagerie peut déjà l’avoir enregistrée avant que JavaScript nettoie l’URL. Le nettoyage et `no-referrer` ne suppriment pas ces journaux. Garder une durée de validité limitée, aucun outil d’analytics sur ce parcours, aucun suivi de clic et aucun partage de lien. Après consommation, un rechargement ne restaure pas l’autorisation de définition du mot de passe : recommencer avec un nouveau lien si nécessaire.

## Livraison des e-mails

La documentation SMTP consultée le 22 octobre 2026 indique que le service Supabase par défaut vise les adresses préautorisées de l’équipe du projet, limite actuellement les envois à deux messages par heure et ne garantit ni livraison ni disponibilité. Ces limites peuvent changer ; elles ne conviennent pas à l’ouverture d’une promotion. Configurer un SMTP propre avant cette ouverture, avec domaine d’expédition vérifié, SPF/DKIM/DMARC adaptés et essais contrôlés. Conserver ses identifiants uniquement dans la configuration sécurisée du fournisseur. Voir le [guide SMTP officiel](https://supabase.com/docs/guides/auth/auth-smtp).

En local, `[local_smtp]` active la capture à `http://127.0.0.1:54324` ; aucun e-mail d’essai n’a à être livré à un destinataire réel. Selon la version CLI, l’interface de capture est Mailpit ou Inbucket ; le runner sait lire les deux API. Désactiver les réécritures de liens et le suivi des clics du fournisseur SMTP. Vérifier le contenu réel reçu, l’URL complète et le parcours dans un autre navigateur. Les confirmations de changement d’adresse devront être configurées et testées avant d’introduire cette fonction ; l’interface du lot 6.1 ne propose pas cette modification.

## Table `public.profiles` et migration

La migration [`20261022000100_profiles.sql`](../../supabase/migrations/20261022000100_profiles.sql) s’applique par l’historique de migrations, dans une transaction. Elle ne se rejoue pas manuellement sur une base déjà migrée.

| Colonne | Définition et responsabilité |
| --- | --- |
| `id` | UUID primaire, référence `auth.users(id)` avec `ON DELETE CASCADE` ; propriétaire technique pour les futurs lots |
| `pseudo` | Facultatif : `NULL`, sinon 2–40 caractères Unicode, sans espace de bord ni contrôles C0/C1 |
| `created_at` | Date serveur initiale, non modifiable par l’étudiant |
| `updated_at` | Date serveur de modification, actualisée par trigger |

Le frontend transforme un pseudo vide en `NULL` et retire les espaces de bord avant envoi. PostgreSQL applique ses propres contraintes même si le navigateur est falsifié. L’e-mail reste dans Supabase Auth ; aucun mot de passe, rôle administrateur ou résultat pédagogique n’est ajouté à `profiles`. Les relations futures doivent utiliser l’UUID, jamais l’e-mail.

Le trigger `bprea_auth_user_created` utilise `bprea_private.create_profile_for_auth_user()`. Cette fonction `SECURITY DEFINER` appartient à `postgres`, fixe `search_path=''`, qualifie les objets et insère uniquement `new.id`. Elle ignore les métadonnées libres de l’utilisateur. Le schéma privé et l’exécution directe sont retirés aux rôles publics, étudiants et administratifs API. Une erreur n’est pas absorbée : l’insertion Auth et le profil échouent ensemble, évitant un compte créé sans profil. Ce risque de blocage d’invitation doit être vérifié avant ouverture, conformément aux précautions de [gestion des données utilisateur](https://supabase.com/docs/guides/auth/managing-user-data).

Le trigger `bprea_profile_updated` utilise une fonction `SECURITY INVOKER` avec chemin vide pour dater `updated_at`. La migration crée aussi les profils manquants d’éventuels comptes DEV existants, avec `ON CONFLICT DO NOTHING`, sans remplacer les profils présents. Aucun mécanisme de suppression de compte étudiant n’est ajouté : la cascade prépare uniquement la cohérence lors d’une suppression Auth autorisée ultérieurement.

## Privilèges et politiques RLS

RLS est activée sur `public.profiles`. Les privilèges de table préexistants sont explicitement retirés à `public`, `anon` et `authenticated`.

| Accès | Protection appliquée |
| --- | --- |
| Lecture étudiante | `GRANT SELECT` à `authenticated`, politique `profiles_select_own` : `(select auth.uid()) = id` |
| Modification étudiante | `GRANT UPDATE (pseudo)` uniquement, politique `profiles_update_own` avec `USING` et `WITH CHECK` sur le même UUID |
| `id`, dates, privilèges | Aucun droit étudiant de modification des colonnes techniques ; aucune colonne administrateur |
| Insertion / suppression | Aucun privilège ni politique étudiante |
| Visiteur `anon` | Aucun privilège sur la table, aucune politique applicable |

Changer le filtre vers l’UUID d’un voisin renvoie zéro ligne ; modifier son profil ne modifie aucune ligne. Changer le propriétaire ou les dates doit être refusé par les privilèges de colonnes. Les claims signés du JWT, vérifiés par Supabase/PostgREST, déterminent `auth.uid()` ; un pseudo, des métadonnées Auth ou un objet local ne donnent aucun privilège. Les clés administratives contournent RLS et ne doivent jamais servir à démontrer les restrictions d’un étudiant. Voir les principes [RLS officiels](https://supabase.com/docs/guides/database/postgres/row-level-security).

Le client filtre et vérifie aussi l’UUID pour limiter les erreurs d’interface ; ces contrôles complètent la sécurité PostgreSQL. Le SQL editor du Dashboard et son rôle privilégié ne représentent pas une session étudiante.

## Sessions et limites du navigateur

Le SDK conserve la session dans son stockage navigateur avec la clé dédiée `bprea-auth-<hôte Supabase>-<chemin du site>`. Il gère access token, refresh token, rotation et renouvellement automatique. `detectSessionInUrl` est désactivé ; aucun JWT artisanal n’est créé par l’application. Le service restaure via `getSession()`, confirme l’identité par `getUser()` puis publie `loading`, `anonymous`, `authenticated`, `unavailable` ou `error`. Avant de lire ou modifier un profil, il vérifie à nouveau l’utilisateur côté Auth. Des révisions d’état empêchent une réponse d’un ancien compte de réapparaître après changement de session.

La déconnexion appelle `signOut({ scope: 'local' })`, invalide la session concernée et met immédiatement à jour l’interface lorsque l’appel réussit. Elle ne déconnecte pas intentionnellement tous les appareils. **Un access token déjà émis peut rester utilisable jusqu’à son expiration**, même après révocation du refresh token. PostgREST applique en outre une tolérance d’horloge de 30 secondes sur `exp`, `iat` et `nbf` : le test réel attend cette marge avant d’exiger son refus. Aucune révocation instantanée des JWT n’est revendiquée. Voir [signOut](https://supabase.com/docs/reference/javascript/auth-signout), le [fonctionnement des sessions](https://supabase.com/docs/guides/auth/sessions) et la [validation temporelle PostgREST](https://docs.postgrest.org/en/stable/references/auth.html#jwt-claims-validation).

Le stockage persistant facilite le rechargement mais reste accessible au JavaScript de l’origine : une faille XSS, une extension malveillante ou l’accès à un appareil partagé peut compromettre la session. Ce site statique n’a pas de serveur posant un cookie HttpOnly. Les données privées sont insérées avec `textContent` ou `value`, jamais comme HTML ; ne pas introduire de scripts tiers sur les pages Auth. Se déconnecter après usage sur un appareil partagé. Le navigateur conserve aussi les exercices locaux sur cet appareil : la déconnexion ne les supprime pas et ne constitue pas une séparation des historiques par compte.

Le code ne mémorise pas les mots de passe, ne journalise pas les réponses Auth ni les jetons et efface les champs lors des transitions. Une sortie de page efface les vues privées ; un retour depuis le cache navigateur réinitialise leur contrôle. Les clés pédagogiques et d’apparence restent intactes. Une erreur de lecture du profil est affichée explicitement, sans statistiques fictives ni création silencieuse d’un profil côté client.

## Stack locale, migrations et tests réels

Installer Docker avec moteur démarré et une CLI Supabase compatible. Le workflow de sécurité fixe **2.121.0** ; utiliser la même version pour reproduire ses essais. Depuis la racine :

```bash
npx --yes supabase@2.121.0 start
npx --yes supabase@2.121.0 migration up --local
npx --yes supabase@2.121.0 test db
```

La configuration locale dédiée utilise PostgreSQL 17, l’API `54321`, PostgreSQL `54322`, Studio `54323` et la capture e-mail `54324`. Les durées JWT **120 secondes** et OTP **60 secondes** servent à tester de vraies expirations. Elles ne sont pas une recommandation de réglage pour un projet hébergé. Ne pas exécuter `db reset` sur une base avec des données à conserver ; les migrations en attente s’appliquent avec `migration up --local`. L’installation et les migrations suivent les guides [CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) et [migrations](https://supabase.com/docs/guides/local-development/database-migrations).

Copier `supabase/tests/.env.example` vers `.env.supabase-test.local` à la racine. Consulter les valeurs de la stack avec `npx --yes supabase@2.121.0 status` dans une session privée, puis renseigner le fichier sans publier cette sortie. Les champs `SUPABASE_TEST_CONFIRM_LOCAL`, `SUPABASE_TEST_URL` et `SUPABASE_TEST_MAIL_URL` doivent garder le projet et les adresses locales du modèle. Fournir la clé publique locale et la clé administrative locale ; le runner accepte aussi les anciennes clés locales `anon`/`service_role` si la CLI les fournit. Cette tolérance du runner ne s’applique pas à la configuration publique du frontend.

```powershell
Copy-Item -LiteralPath supabase/tests/.env.example -Destination .env.supabase-test.local
```

Une fois les valeurs renseignées :

```bash
npm run test:supabase
npm run test:e2e:supabase
```

Le runner refuse les endpoints hébergés et les ports non prévus. La clé administrative locale sert uniquement aux invitations et au nettoyage des seuls UUID fictifs créés par cette exécution. Les accès aux profils utilisent réellement les sessions A, B et anonyme, sans privilège administratif. Il teste Auth, mails capturés, activation depuis un contexte neuf, connexion/restauration, RLS en lecture et écriture, colonnes protégées, contraintes, métadonnées et JWT falsifiés, récupération, usage unique, refresh après déconnexion et expiration réelle. L’attente des expirations prend environ deux minutes et demie, tolérance PostgREST comprise. Aucun navigateur personnel ni donnée pédagogique n’est utilisé. Un nettoyage incomplet est signalé en échec ; ne jamais remplacer ce nettoyage ciblé par une suppression globale de comptes.

Les tests SQL `supabase/tests/database/profiles_privileges.test.sql` inspectent réellement PostgreSQL, RLS, grants et fonctions avec pgTAP, dans une transaction annulée. Les tests HTTP complètent ces contrôles structurels ; l’un ne remplace pas l’autre.

La suite distincte `tests/e2e-supabase/`, configurée par `playwright.supabase.config.js`, complète ces essais par l’activation et la récupération dans le navigateur avec Auth et e-mails capturés réels. Elle requiert la même stack et les mêmes variables locales ; elle ne doit jamais viser un projet distant. Ne pas publier de traces ou captures susceptibles de contenir un lien d’authentification.

Pour appliquer les migrations au **projet DEV hébergé choisi et vérifié**, une personne disposant de l’accès peut utiliser :

```bash
npx --yes supabase@2.121.0 login
npx --yes supabase@2.121.0 link --project-ref REFERENCE_DEV_REELLE
npx --yes supabase@2.121.0 db push --dry-run
npx --yes supabase@2.121.0 db push
```

Remplacer la référence par celle du projet DEV ; vérifier l’environnement lié avant l’écriture et garder les secrets hors des commandes enregistrées. `config.toml` et les modèles ne sont pas automatiquement appliqués par `db push` : configurer Auth séparément. Le runner automatisé refuse DEV hébergé par conception ; contrôler manuellement son déploiement avec comptes fictifs et clients publics. PROD nécessite une procédure et une validation ultérieures distinctes.

## Niveaux de vérification et CI

`npm test` valide la logique applicative avec mocks réservés aux unités et contrôle la préparation réelle des artefacts. `npm run test:e2e` exerce les pages avec la configuration désactivée du dépôt, sans simuler de réponse Supabase, y compris le préfixe `/mon-bprea/`, l’absence d’accès privé, les liens et le mobile. Ces suites n’exercent pas PostgreSQL et ne démontrent pas RLS. `npm run test:e2e:supabase` utilise un vrai service Auth, PostgreSQL et les e-mails capturés pour les parcours connectés. Les détails figurent dans [TESTS.md](../TESTS.md).

Le workflow **Qualité** conserve les jobs obligatoires `unit-integration` et `e2e`, sans secrets Supabase ni déploiement. Le workflow distinct `auth-security.yml`, job `supabase-security`, prépare une stack locale jetable et exécute les vérifications réelles. Il ne modifie pas le ruleset de `main` et n’utilise aucun compte étudiant ou projet distant. Sa configuration ne prouve pas qu’une exécution a réussi : contrôler le résultat de la PR et le consigner dans la validation.

Sans Docker/CLI ou stack accessible, déclarer les tests Supabase **non exécutés / non validés**, même si toutes les suites JavaScript réussissent. Sur le poste de préparation, la CLI 2.121.0 a été téléchargée et sa version exécutée ; Docker reste absent, donc la stack et les tests réels n’ont pas pu y être validés. Se reporter à la validation et aux résultats CI pour l’état final. L’activation réelle, la récupération, le refus d’inscription et l’isolation A/B restent bloquants avant de qualifier l’authentification comme sûre.

## Données personnelles et étapes avant ouverture

| Données | Emplacement | Finalité |
| --- | --- | --- |
| UUID, e-mail, informations Auth et empreinte du mot de passe | Supabase Auth | Invitation, connexion, récupération et contrôle des sessions |
| UUID, pseudo facultatif, dates de création/modification | `public.profiles` | Identification technique et affichage personnel |
| Session persistante | Stockage du navigateur géré par SDK | Restauration et renouvellement de connexion |
| Exercices, ITK, préférences et historiques actuels | Stockage local existant | Fonctionnement pédagogique sur cet appareil, sans synchronisation |

Ne collecter ni nom complet, adresse, date de naissance, téléphone ou établissement. Le mot de passe n’est jamais stocké dans une table applicative. Définir au lot 6.4 les bases et finalités documentées, durées de conservation par type de donnée, comptes inactifs, journaux Auth/SMTP/hébergement, sauvegardes et purge, export/suppression, responsable et contact, sous-traitants, région et éventuels transferts. La cascade SQL ne constitue ni une procédure juridique ni l’effacement complet des sauvegardes et journaux.

Prévoir des pages et liens distincts de mentions légales et d’information sur la confidentialité dans le footer au lot 6.4, après rédaction validée. Le lot 6.1 n’affiche pas une politique définitive ni un consentement générique. Avant un compte réel, finaliser ces informations et les mesures de conformité, confirmer la configuration PROD, SMTP, redirections, durées de session et de liens, sauvegardes, contrôles RLS effectifs et traitement des incidents. Ne pas ouvrir la promotion avant validation du lot 6.5, ni fusionner ou déclencher une publication sans accord.
