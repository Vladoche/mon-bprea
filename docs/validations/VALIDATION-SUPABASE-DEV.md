# Supabase DEV — migration et recette du lot 6.1

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
