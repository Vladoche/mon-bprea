# Invitations et récupération manuelles, sans SMTP externe

**Complément 6.5.4.B, 30 octobre 2026 :** un [dispositif DEV séparé](RUNBOOK-RECETTE-DEV-6-5-4B.md) est préparé pour `wcckbyhrtroittbfophv` seulement. Les outils 6.5.3.A décrits ci-dessous gardent intégralement leur refus des projets hébergés. Le nouveau dispositif borne deux comptes de run et trois générations, exige A puis B par créneau, réserve durablement avant l'appel et transfère le seul callback en mémoire à Chromium isolé ; aucun lien dans le terminal. **Aucun vrai lien/compte DEV généré**, accords absents ; [preuve et limites](../validations/VALIDATION-LOT6-5-4B.md). Ni pédagogie C ni suppression D ne sont couvertes par B ; SMTP externe, camarades et PROD restent exclus.

**Lot 6.5.3.A — 28 octobre 2026. Outil livré exclusivement pour la stack éphémère locale. Aucune utilisation DEV/PROD ni ouverture aux camarades autorisée.** Après le lot 6.5.2, l'exploitant a choisi définitivement pour la feuille de route actuelle la solution B : génération administrative et transmission privée individuelle. Supabase Free, aucun abonnement, domaine acheté, Brevo, fournisseur SMTP externe ou service transactionnel supplémentaire.

Ce choix remplace les étapes SMTP des plans futurs ; il ne change pas les faits de l'[audit historique](../validations/AUDIT-SUPABASE-DEV-LOT6-5-2.md). La [validation du lot](../validations/VALIDATION-LOT6-5-3A.md) distingue tests applicatifs et essais Auth/PostgreSQL réellement exécutés. Les quinze [P0](../rgpd/DOSSIER-PREOUVERTURE.md) restent bloquants.

## Avant toute opération

L'opérateur travaille depuis un ordinateur et un compte administrateur protégés, dans un terminal privé sans enregistrement, partage d'écran ou redirection de sortie. La clé privilégiée reste dans cet environnement de confiance. Aucun accès enseignant aux résultats, rôle administratif frontend ou consultation pédagogique privée n'est nécessaire.

Vérifier le projet exact, le destinataire autorisé, son accord de participation et l'adresse confirmée, l'information de confidentialité approuvée remise avant collecte/invitation, le canal privé de transmission et le callback exact. **Une invitation peut créer immédiatement l'utilisateur Auth et son profil**, avant son activation. Ne jamais générer pour les cinq camarades avant ces préconditions et la décision d'ouverture. Maximum opérationnel prévu : exploitant et cinq camarades majeurs, service personnel indépendant, facultatif, jusqu'en juin 2027 ; ce plafond n'est pas un nouveau contrôle serveur.

Le canal réel de droits, sa disponibilité/récupération et le calendrier de fermeture restent à valider. Aucun contact privé ou fictif n'est publié par ce lot. La page publique renvoie vers la personne qui a invité le titulaire, par leur moyen habituel ; elle n'annonce pas une mise en service hébergée acquise.

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
