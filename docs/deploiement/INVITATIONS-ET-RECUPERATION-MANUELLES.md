# Invitations et récupération manuelles, sans SMTP externe

**8 novembre 2026 — exécuteur PROD séparé préparé.** Les scripts locaux `admin-generate-auth-link.mjs` et `auth-link-local.mjs` gardent leur verrouillage sur la stack éphémère. Le nouvel exécuteur Node PROD est distinct ; sa préparation et ses tests n'autorisent aucune invitation réelle. Les opérations et validations datées ci-dessous gardent leur périmètre historique. Les réglages Auth réellement enregistrés et les contrôles hébergés figurent dans l'[architecture Auth](../architecture/AUTHENTIFICATION.md) ; la [matrice de préouverture](PLAN-PREOUVERTURE-PRIVEE.md) reste déterminante avant tout compte réel.

**Cadre courant 6.5.5.C, 5 novembre 2026 :** sept comptes confirmés : exploitant et six autres adultes, limite administrative. Le [préflight opérateur hors ligne distinct](EXPLOITATION-PRIVEE-SIX-ADULTES.md#invitation-et-récupération-individuelles) vérifie capacité, cible, état et prérequis sans génération. Ce guide et ses outils restent des références de stack locale/campagne ; leurs protections ne sont pas supprimées pour l'hébergement. Contact officiel vladimir.fouillade@hotmail.fr, publication publique autorisée ; [contact sans compte](../../contact.html), essais opérationnels à compléter. Aucun compte réel invité ni opération Supabase hébergée autorisée dans C.


**Suivi du 5 novembre 2026 :** les activations/récupérations fictives DEV et C2 sont consignées dans le [bilan du 4 novembre](../archives/validations/VALIDATION-LOT6-5-4C.md). Les mentions « aucun lien généré » ci-dessous décrivent leur préparation historique. L'outil générique de ce guide reste exclusivement local ; la campagne DEV fermée ne doit pas être recyclée pour des camarades. [Procédures pour sept comptes](EXPLOITATION-PRIVEE-SIX-ADULTES.md), [P0 et décisions](PLAN-PREOUVERTURE-PRIVEE.md) : aucune invitation réelle ni activation hébergée autorisée par 6.5.5.A.

**Complément 6.5.4.B, 30 octobre 2026 :** un [dispositif DEV séparé](RUNBOOK-RECETTE-DEV-6-5-4B.md) est préparé pour `wcckbyhrtroittbfophv` seulement. Les outils 6.5.3.A décrits ci-dessous gardent intégralement leur refus des projets hébergés. Le nouveau dispositif borne deux comptes de run et trois générations, exige A puis B par créneau, réserve durablement avant l'appel et transfère le seul callback en mémoire à Chromium isolé ; aucun lien dans le terminal. **Aucun vrai lien/compte DEV généré**, accords absents ; [preuve et limites](../archives/validations/VALIDATION-LOT6-5-4B.md). Ni pédagogie C ni suppression D ne sont couvertes par B ; SMTP externe, camarades et PROD restent exclus.

**Lot 6.5.3.A — 28 octobre 2026. Outil livré exclusivement pour la stack éphémère locale. Aucune utilisation DEV/PROD ni ouverture aux camarades autorisée.** Après le lot 6.5.2, l'exploitant a choisi définitivement pour la feuille de route actuelle la solution B : génération administrative et transmission privée individuelle. Supabase Free, aucun abonnement, domaine acheté, Brevo, fournisseur SMTP externe ou service transactionnel supplémentaire.

Ce choix remplace les étapes SMTP des plans futurs ; il ne change pas les faits de l'[audit historique](../archives/validations/AUDIT-SUPABASE-DEV-LOT6-5-2.md). La [validation du lot](../archives/validations/VALIDATION-LOT6-5-3A.md) distingue tests applicatifs et essais Auth/PostgreSQL réellement exécutés. Les quinze [P0](../rgpd/DOSSIER-PREOUVERTURE.md) restent bloquants.

## Avant toute opération

L'opérateur travaille depuis un ordinateur et un compte administrateur protégés, dans un terminal privé sans enregistrement, partage d'écran ou redirection de sortie. La clé privilégiée reste dans cet environnement de confiance. Aucun accès enseignant aux résultats, rôle administratif frontend ou consultation pédagogique privée n'est nécessaire.

Vérifier le projet exact, le destinataire autorisé, son accord de participation et l'adresse confirmée, l'information de confidentialité approuvée remise avant collecte/invitation, le canal privé de transmission et le callback exact. **Une invitation peut créer immédiatement l'utilisateur Auth et son profil**, avant son activation. Ne jamais générer pour un participant avant ces préconditions et la décision d’ouverture. Politique courante : sept comptes confirmés, exploitant compris, service personnel indépendant/facultatif jusqu’au 30 juin 2027 ; aucun nouveau contrôle serveur.

Le contact officiel est accessible sans compte et son fonctionnement est attesté en D04. Le calendrier et les durées résiduelles sont approuvés. [Reçu D](../rgpd/RECU-ARBITRAGES-2026-11-05.md). Les pages de récupération renvoient au contact officiel et au canal connu, sans annoncer une mise en service acquise ni générer de lien.

## Exécuteur PROD séparé

[`scripts/admin-generate-prod-auth-link.mjs`](../../scripts/admin-generate-prod-auth-link.mjs) utilise les modules distincts [`environment.mjs`](../../scripts/prod-auth/environment.mjs), [`generator.mjs`](../../scripts/prod-auth/generator.mjs) et [`private-store.mjs`](../../scripts/prod-auth/private-store.mjs). Ils restent hors de l'artefact Pages. Les deux outils locaux précédents ne sont pas à rediriger vers PROD.

**Préparation uniquement dans cette intervention : aucun lien PROD ni compte réel n'est autorisé par la présence de cet exécuteur.** Avant une future opération, obtenir l'accord spécifique au destinataire, satisfaire les portes de préouverture et effectuer le [préflight opérateur](EXPLOITATION-PRIVEE-SIX-ADULTES.md#invitation-et-récupération-individuelles). Vérifier identité, adresse, demande et canal déjà connu ; remettre la notice approuvée avant collecte. La confirmation dans le terminal atteste ces contrôles, elle ne les remplace pas.

Depuis un poste de confiance, Node.js 24 et `npm ci`, préparer les variables suivantes exclusivement dans l'environnement privé opérateur ou le fichier ignoré `.env.supabase-prod.local`, chargé par la commande npm. Ne pas écraser un fichier privé existant ; conserver ce fichier sous les protections du poste et ne jamais en afficher le contenu. Ne passer ni clé, adresse, identité, mot de passe ou lien comme argument de commande. Une clé administrative moderne est nécessaire ; une clé publishable, `anon` ou legacy `service_role` est refusée.

| Variable | Valeur ou contrôle |
| --- | --- |
| `SUPABASE_PROD_PROJECT_REF` | Exactement `oqoqrxwfbkhtpksqimgd` — Mon BPREA PROD, région `eu-central-1` |
| `SUPABASE_PROD_URL` | Exactement `https://oqoqrxwfbkhtpksqimgd.supabase.co`, sans slash final |
| `SUPABASE_PROD_SITE_URL` | Exactement `https://vladoche.github.io/mon-bprea/` |
| `SUPABASE_PROD_ADMIN_KEY` | Clé `sb_secret_…` du seul projet PROD, conservée côté opérateur ; sa validité est contrôlée par une lecture administrative authentifiée |
| `SUPABASE_PROD_OPERATOR_EMAIL` | Adresse vérifiée prévue pour le compte Auth de l'exploitant ; une place lui reste réservée tant que son compte est absent |
| `SUPABASE_PROD_PRIVATE_DIR` | Chemin absolu d'un dossier privé existant, hors dépôt et hors dossier parent du dépôt, sans lien ni jonction ; propriétaire courant et accès limités à lui et SYSTEM sous Windows, ou propriétaire courant et mode privé sous POSIX |

Le callback n'est pas paramétrable : seul `https://vladoche.github.io/mon-bprea/authentification.html` est accepté. Aucune clé n'est copiée dans `assets/`, `auth-config.local.json` ou les paramètres publics de Pages. Le dossier de remise contient des secrets temporaires et reste exclu de Git, sauvegardes partagées, synchronisations, captures et outils de journalisation.

```text
npm run admin:auth-link:prod -- check
```

`check` valide l'environnement, le chemin privé et l'accès administratif à l'inventaire Auth. Il vérifie aussi dans `/auth/v1/settings` la fermeture des inscriptions, l'anonyme désactivé, l'e-mail actif avec confirmation et l'absence d'autre fournisseur actif ; tout état absent ou divergent bloque la génération. Il ne génère aucun jeton et ne crée ni compte ni profil. Il affiche seulement le projet, le callback, le contrôle des réglages publics et le nombre de comptes, invitations en attente comprises. **Ce contrôle ne prouve pas les Site/Redirect URLs, le minimum de mot de passe ou la durée des liens du Dashboard ; il ne qualifie pas le parcours hébergé et ne lève aucune porte de préouverture.** Il exige le même terminal privé interactif que la génération.

Après autorisation individuelle ultérieure uniquement :

```text
npm run admin:auth-link:prod -- invite
npm run admin:auth-link:prod -- recovery
```

Une seule adresse est saisie par opération. CI, navigateur, pipes, redirections, instrumentation, proxy configuré, arguments supplémentaires, batch et confirmations automatiques sont refusés. Le transport accepte uniquement les réglages publics Auth, l'inventaire Auth borné et un seul `generateLink`, sur le projet exact, sans redirection HTTP ni nouvelle tentative. Aucun SMTP, envoi, ouverture de lien, presse-papiers, suppression, mot de passe administratif ou changement de rôle n'est proposé.

L'inventaire inclut tous les comptes, actifs ou en attente. `invite` refuse tout compte déjà présent et toute capacité insuffisante : sept comptes au total, place de l'exploitant réservée. `recovery` exige le compte existant confirmé et conserve son UUID. Une invitation expirée sur un compte en attente demande un diagnostic et une reprise spécifiquement autorisée ; ne pas supprimer ou recréer le compte.

Après relecture de la cible et de l'avertissement de création immédiate Auth/profil, saisir exactement `CONFIRMER PROD invite adresse` ou `CONFIRMER PROD recovery adresse`, avec l'adresse réellement saisie. Les réglages publics et l'inventaire sont relus après cette confirmation ; une dérive bloque l'opération. Un verrou exclusif protège les opérations de ce dossier et une réservation durable précède l'unique appel générateur. Ce verrou est local : l'unique opérateur doit suspendre toute autre création depuis un Dashboard, autre poste ou autre dossier pendant l'opération. La capacité reste administrative, sans quota serveur.

Le résultat doit désigner l'adresse, l'UUID attendu pour une récupération, le type et le callback exacts. L'outil analyse `action_link` sans l'ouvrir, puis construit le seul callback à partir de `hashed_token`. Il écrit ce lien dans un fichier privé individuel `auth-link-UUID.txt` et **n'affiche jamais le lien ni le jeton**. Le terminal indique le chemin ; saisir `RECU` seulement après avoir confirmé la présence du fichier privé. Cet acquittement confirme la remise locale du fichier, pas son envoi au titulaire. Transmettre manuellement au seul destinataire par le canal contrôlé, sans suivi de clic. Retirer la copie de remise après usage ou expiration suivant la procédure de conservation ; l'outil ne la supprime pas automatiquement.

Le journal privé conserve uniquement projet, empreinte de cible, identifiant d'opération, type, dates et état, sans adresse en clair, clé, jeton, lien ou réponse fournisseur. Une panne, réponse non conforme, remise non acquittée ou erreur après l'appel laisse une réservation non résolue qui bloque la répétition pour cette cible. **Arrêter les nouvelles opérations et diagnostiquer en lecture seule ; ne pas effacer le journal, retirer un verrou interrompu ou relancer pour essayer.** Aucun bouton de réinitialisation, retry ou suppression/recréation n'est fourni. Une récupération ultérieure reste possible après remise acquittée, compte confirmé et nouvelle vérification individuelle ; elle peut remplacer le lien précédent et exige un nouvel accord.

La validité PROD retenue doit être relue dans l'[architecture Auth](../architecture/AUTHENTIFICATION.md) avant remise ; les 60 secondes de la stack de tests ne constituent pas sa durée. Le titulaire active ou récupère depuis un navigateur neuf, confirme l'action puis choisit seul son mot de passe. L'exécuteur ne teste pas ce parcours sur PROD et aucun lien réel ne doit être généré pour le qualifier sans mandat de recette distinct.

## Préparer exclusivement la stack de tests

Node.js 24 LTS et `npm ci`, Docker démarré, CLI **2.121.0**, projet **`mon-bprea-lot6-1-local`**. Suivre [TESTS](../TESTS.md) pour démarrer la stack et ses migrations. Aucun runner n'est à rediriger vers un projet hébergé.

Copier le modèle sans valeurs [supabase/tests/.env.example](../../supabase/tests/.env.example) vers `.env.supabase-test.local` seulement si le fichier privé n'existe pas déjà. Ne jamais écraser une configuration existante. Depuis la sortie privée de `supabase status`, renseigner uniquement les clés **locales** ; ne pas partager cette sortie.

| Variable privée | Contrat du générateur |
| --- | --- |
| `SUPABASE_TEST_CONFIRM_LOCAL` | Exactement `mon-bprea-lot6-1-local`, également contrôlé dans config.toml |
| `SUPABASE_TEST_URL` | `http://127.0.0.1:54321`, éventuellement slash final ; aucune autre représentation d'hôte acceptée |
| `SUPABASE_TEST_ADMIN_KEY` | Clé moderne locale `sb_secret_…` non vide ; la syntaxe n'atteste pas sa validité serveur, vérifiée lors de la lecture administrative |
| `SUPABASE_TEST_SITE_URL` | Facultatif ; s'il est défini, exactement `http://127.0.0.1:4173/mon-bprea/` |
| `SUPABASE_TEST_PUBLISHABLE_KEY`, `SUPABASE_TEST_MAIL_URL` | Utilisées par les tests, jamais pour exposer la clé administrative au navigateur |

Le fichier privé est ignoré. La CLI charge ce fichier ou l'environnement du processus. **Aucun secret ni e-mail n'est un argument de commande.** Les clés legacy/service_role ne sont pas acceptées par le nouveau générateur ; la tolérance historique d'autres runners reste distincte.

Les seules commandes disponibles sont :

```text
npm run admin:auth-link -- invite
npm run admin:auth-link -- recovery
```

Une seule cible, saisie dans le terminal. Aucun mode batch, `--yes`, `--force`, `--prod`, `--allow-remote`, mot de passe administratif, suppression ou clipboard. Un terminal interactif privé est obligatoire ; pipes et CI sont refusés. Les tests injectent confirmation/remise en mémoire, sans imprimer de lien.

L'outil refuse tout projet inconnu, DEV **`wcckbyhrtroittbfophv`**, PROD **`oqoqrxwfbkhtpksqimgd`**, HTTPS Supabase, hôte distant, autre IP/alias/port, identifiants URL et chemin/query/fragment inattendus. Le transport revérifie l'origine et refuse les redirections HTTP, y compris après une première URL locale. Il ne propose aucun contournement. Le site et le callback ne sont pas des arguments libres.

## Invitation locale, une personne à la fois

1. Confirmer accord, information préalable, adresse et canal privé. Pour ce lot : identité **synthétique uniquement** sur la stack dédiée.
2. Lancer la commande `invite` et saisir l'adresse unique. Le terminal affiche projet/API, type et cible minimisée ; relire l'adresse saisie avant de continuer.
3. Confirmer explicitement avec `CONFIRMER invite`, après l'avertissement de création immédiate et d'historique du terminal. Sans confirmation, aucune requête administrative, même de lecture.
4. L'outil recherche le compte local de façon paginée et bornée. **Tout compte existant, confirmé ou en attente, bloque l'invitation** : pas de remplacement silencieux d'un lien déjà transmis. Puis un seul `generateLink({ type: 'invite', email, options: { redirectTo } })`, sans mot de passe ni métadonnée de rôle.
5. La réponse doit désigner la bonne adresse/UUID, le bon `verification_type`, un `hashed_token` de syntaxe compatible et le callback exact. `action_link` est analysé, jamais ouvert ni distribué : son endpoint `/auth/v1/verify` peut consommer le secret dès l'ouverture.
6. Le seul lien remis vise `http://127.0.0.1:4173/mon-bprea/authentification.html`, avec uniquement `token_hash` et `type=invite`. Le terminal le présente une fois. Aucun fichier, log de génération, presse-papiers automatique, service externe ou rapport ne le conserve. Le lien reste néanmoins dans l'historique éventuel du terminal : utiliser une session privée éphémère adaptée.
7. Transmettre individuellement par le canal vérifié ; en test, le navigateur local reçoit le lien directement en mémoire. **La boucle locale du lien n'est pas utilisable par un camarade sur un autre ordinateur.** La future version hébergée nécessitera adaptation et autorisation distinctes.
8. Le titulaire ouvre le lien, confirme « Continuer l'activation », choisit lui-même son mot de passe puis peut se connecter. L'opérateur vérifie seulement l'état Auth d'activation via un accès autorisé ; il ne consulte pas les résultats pédagogiques.

Validité locale : **60 secondes** (`auth.email.otp_expiry`), usage unique. Les JWT locaux durent 120 secondes. Ces durées de test ne sont pas une recommandation hébergée ; une durée future devra être décidée et effectivement vérifiée. En cas d'expiration, ne pas répéter aveuglément `invite` : le compte existe déjà. Diagnostiquer puis décider une reprise ciblée, sans supprimer/recréer le compte. Ce lot n'ajoute pas de commande de réinvitation d'un compte en attente ; une telle reprise exige une procédure de confiance séparément autorisée.

## Récupération assistée

Le titulaire contacte personnellement l'exploitant. **Une demande depuis un nouveau numéro ou une nouvelle adresse, affirmant seulement une perte d'accès, ne suffit pas.** Confirmer raisonnablement l'identité par un canal préalablement connu ou un complément proportionné. Ne pas demander une copie de pièce d'identité par défaut, ni mot de passe, JWT ou lien.

Après contrôle de l'identité et de l'adresse du compte, lancer `recovery`. Relire cible/type/environnement et saisir `CONFIRMER recovery`. L'avertissement indique qu'une récupération précédente peut être remplacée. La prélecture refuse un compte inexistant ; le comportement réel de l'API sans cette prélecture est aussi testé et ne doit pas créer de compte.

Le lien `type=recovery` est remis une fois puis transmis individuellement au titulaire par le canal déjà connu. Le titulaire confirme la récupération dans un navigateur neuf et choisit son mot de passe via `updateUser`. L'administrateur ne modifie ni ne connaît le mot de passe. Vérifier avec le titulaire que la connexion fonctionne, sans lui demander son secret, puis ne pas conserver le lien. Une ancienne invitation n'est pas un mécanisme de récupération d'un compte activé.

La page publique ne collecte plus d'adresse et n'appelle plus `resetPasswordForEmail`. La méthode applicative `requestPasswordReset`, devenue sans appelant, a été retirée ; les appels natifs conservés dans les runners sont seulement des régressions de capture SMTP locale. Le lien du profil indique explicitement « Récupération assistée du mot de passe ».

`Secure password change=true` reste dans la stack locale. La recette réelle vérifie qu'une session fraîche issue de l'invitation/récupération permet `updateUser({ password })` sans ancien mot de passe ni demande de nonce automatique. Aucune modification du réglage DEV constaté off en 6.5.2 ; toute décision hébergée reste séparée.

## Résultat incertain et diagnostic ciblé

Une erreur réseau, une réponse partielle ou une panne d'affichage **ne prouve pas l'absence de compte ou de lien**. Le programme n'effectue aucun retry, n'annonce aucun faux succès et ne sérialise jamais les erreurs fournisseur. Ne pas le relancer pour « voir » et ne pas supprimer de compte pour masquer l'incident.

Dans la stack dédiée, vérifier privativement le seul compte concerné via un moyen officiel de confiance, l'adresse, l'UUID, l'état confirmé/en attente et le profil créé par le trigger. Ne pas consommer un jeton pour diagnostiquer. Si aucun effet n'est établi, une nouvelle opération doit être explicitement décidée ; si un compte est présent, `invite` restera bloqué. Un compte activé peut suivre `recovery` après vérification du titulaire. Un compte en attente exige une reprise administrative ciblée distincte, avec avertissement sur tout lien précédent. Aucune suppression, modification de mot de passe ou réinvitation automatique n'est ajoutée à l'outil.

Pour les tests seulement, le helper mémorise les UUID synthétiques créés par son run, même lorsqu'il perd volontairement l'acquittement après le vrai commit. Il supprime uniquement ces UUID, puis vérifie leur absence Auth et celle des profils. Aucun nettoyage global ni compte historique.

## Incidents et arrêt

| Incident | Réponse proportionnée à préparer / limite |
| --- | --- |
| Mauvaise adresse ou mauvais destinataire | Arrêter la transmission, confirmer la cible par voie connue, qualifier le compte/lien effectivement créé. Suivre la procédure d'incident et de droits ; aucune suppression spontanée pour effacer une erreur. |
| Lien intercepté, transmis par erreur ou consommé par un tiers | Suspendre l'usage, vérifier le titulaire par canal connu, examiner les accès et sessions via un moyen autorisé. Décider un remplacement ciblé et traiter le compte compromis ; un nouveau lien seul ne démontre pas l'invalidation de toutes les sessions. |
| Lien expiré / compte déjà créé | Conserver le compte et les données, vérifier l'état et le lien précédent, décider récupération ou reprise ciblée. Aucun retry d'invitation ni suppression/recréation. |
| Résultat administratif incertain | Diagnostic précédent, aucune relance aveugle. Conserver seulement stade/date/type et état confirmé/non confirmé en privé ; jamais le lien, la clé ou une réponse complète. |
| Clé d'administration perdue ou exposée | Stopper l'outil, protéger le poste et demander une rotation ciblée depuis le compte fournisseur protégé, dans un mandat adapté à l'environnement. Une clé perdue ne justifie pas d'en copier une dans le navigateur. |
| Compte opérateur possiblement compromis | Suspendre opérations/transmissions, sécuriser compte/récupération/MFA et accès, qualifier l'incident et les obligations de notification via la procédure approuvée, puis recetter avant reprise. Ne pas promettre une révocation instantanée de tous les JWT. |
| Opérateur indisponible / demande d'usurpation | Ne pas transmettre à un nouveau canal sur simple affirmation ; organiser l'assistance/suppléance habilitée à valider. Ne pas inventer de contact public de secours. |

Le nettoyage navigateur et `no-referrer` réduisent la diffusion ; **la première requête HTTP contient le secret**. L'hébergeur ou le canal privé peut déjà en conserver une copie. Aucun analytics, suivi de clic, trace publique, commentaire PR ou capture du lien. Pour les copies résiduelles, durées et incidents : [procédure commune](../rgpd/PROCEDURE-DEMANDES-ET-INCIDENTS-PROJET.md), décisions D05–D08/D13.

## Fin du service et étapes suivantes

Invitations et récupération accompagnent un service temporaire jusqu'à **fin juin 2027**, selon le [calendrier à approuver](../rgpd/CALENDRIER-FERMETURE-PROJET.md). Prévoir information et fenêtre de récupération, puis arrêter génération et assistance selon cette décision ; ne pas maintenir une procédure administrative ouverte indéfiniment. Ni purge automatique ni nouvelle durée juridique n'est créée.

Après fusion, le lot **6.5.3.B** concernera la préparation et l'application séparément autorisée de la migration personnelle manquante sur DEV. Il n'est pas commencé ici. L'outil administratif hébergé, ses protections et la recette d'invitation/récupération hébergées nécessiteront ensuite des lots et autorisations distincts. Auth publique reste désactivée ; pas d'invitation des camarades, écriture DEV/PROD, déploiement, modification des protections ou fusion automatique.

## Contrats officiels vérifiés

Consultation du 28/10/2026 : [generateLink](https://supabase.com/docs/reference/javascript/auth-admin-generatelink), [verifyOtp](https://supabase.com/docs/reference/javascript/auth-verifyotp), [variables TokenHash et scanners](https://supabase.com/docs/guides/auth/auth-email-templates), [limites SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [utilisateurs et trigger](https://supabase.com/docs/guides/auth/managing-user-data), [changelog](https://supabase.com/changelog). L'index `.md` est refusé par le lecteur web (content-type) ; les changements pertinents sont relus sur la page HTML officielle, notamment la restriction des modèles Free avec SMTP intégré. Aucune mise à jour de SDK nécessaire.

Les types et l'implémentation installés de **supabase-js 2.118.0** (`@supabase/auth-js`, `GenerateInviteOrMagiclinkParams`, `GenerateRecoveryLinkParams`, `GenerateLinkProperties`, `VerifyTokenHashParams`, `GoTrueAdminApi.generateLink`) confirment invite/recovery, les propriétés de retour et `verifyOtp({ token_hash, type })`. Le [code serveur officiel relu](https://github.com/supabase/auth/blob/c3348e8f1cb31454e9783e4eb9eab1e71ad9652f/internal/api/mail.go) crée l'invité absent, refuse un compte confirmé avec `email_exists`, peut remplacer la confirmation d'un compte en attente et refuse recovery inconnu avec `user_not_found`. Il construit la réponse sans appeler l'envoi SMTP. Ces lectures n'attestent pas la version d'un projet hébergé : la compatibilité effective est éprouvée séparément dans la CI locale éphémère.
