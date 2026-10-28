# Validation — lot 6.5.3.A

**28 octobre 2026, Europe/Paris. Génération manuelle sécurisée des liens, sans SMTP externe.** Base vérifiée après `git fetch origin` : **`96a1633552f28c2d2028611a8b8b170dbb43750b`**, dernier origin/main, fusion [#26](https://github.com/Vladoche/mon-bprea/pull/26) confirmée via Git et GitHub. Worktree initial propre ; branche **`feature/lot6-5-3a-liens-auth-manuels`** créée depuis cette base. Aucun travail sur main, fusion ou déploiement.

## Résultat et limites

La solution B est choisie par l'exploitant : invitations et récupérations manuelles, sans fournisseur SMTP externe, abonnement, domaine acheté, Brevo ou service transactionnel supplémentaire. L'[outil et son runbook](../deploiement/INVITATIONS-ET-RECUPERATION-MANUELLES.md) sont livrés **exclusivement pour la stack éphémère** `mon-bprea-lot6-1-local`. Aucun lien pour un camarade, appel Supabase DEV/PROD ou e-mail réel. La création de l'outil ne lève aucun des quinze P0, ne valide globalement aucune D01–D14 et n'ouvre pas le service.

Docker est **absent du poste** : `docker --version` échoue car la commande n'existe pas. La CLI n'est pas installée dans le PATH et aucune stack n'est démarrée ; aucun essai réel local n'est déclaré réussi. Les trois nouveaux parcours réels doivent être effectivement exécutés par **supabase-security**, exclusivement dans Docker éphémère CI. Aucun endpoint hébergé de remplacement. Les preuves CI sur la dernière tête sont consignées dans la description de PR après leur terminaison, sans commit de documentation qui déplacerait cette tête.

## Contrats et revue

Lecture des consignes AGENTS, TESTS, modules/pages Auth, helpers/runners, suites unitaires/E2E, config et templates locaux, workflows/orchestrateur, architecture, audit/validation 6.5.2, plans DEV et documents RGPD concernés. Les anciens mécanismes de sécurité et tests SMTP sont préservés ; seul leur appel depuis le formulaire public est retiré.

Documentation officielle relue : [generateLink](https://supabase.com/docs/reference/javascript/auth-admin-generatelink), [verifyOtp](https://supabase.com/docs/reference/javascript/auth-verifyotp), [templates/TokenHash](https://supabase.com/docs/guides/auth/auth-email-templates), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [gestion utilisateur/trigger](https://supabase.com/docs/guides/auth/managing-user-data), [changelog](https://supabase.com/changelog). L'index Markdown est refusé par le lecteur web, puis la page HTML officielle permet la revue des breaking changes pertinents, dont modèles Free/SMTP intégré. Les types et l'implémentation **installés et verrouillés en 2.118.0** confirment paramètres invite/recovery, propriétés de retour et `VerifyTokenHashParams`. Aucun SDK ni dépendance ajouté/mis à jour.

Le [serveur Auth officiel relu](https://github.com/supabase/auth/blob/c3348e8f1cb31454e9783e4eb9eab1e71ad9652f/internal/api/mail.go) confirme : invitation absente créant Auth, compte confirmé refusé `email_exists`, possibilité de remplacer le token d'un invité en attente, recovery inconnu refusé `user_not_found`, réponse générée sans appel d'envoi SMTP. Cela justifie la prélecture du compte et l'interdiction de réinviter silencieusement un compte en attente. La lecture de source ne remplace pas le test de compatibilité réellement exécuté.

## Changements livrés

| Domaine | Comportement / risque couvert |
| --- | --- |
| CLI Node | Un type invite/recovery et une adresse saisie ; terminal privé interactif obligatoire ; cible minimisée et confirmation exacte avant tout appel administratif. Pas de batch, force, mot de passe administrateur, suppression ou clipboard. |
| Environnement | Projet/env/config.toml identifiés, API exacte 127.0.0.1:54321, site exact 127.0.0.1:4173/mon-bprea/. Refus DEV/PROD, hôtes distants/alias/IP/ports/credentials/chemins/queries/fragments inattendus. Transport relocalisé par requête et redirections HTTP refusées. |
| Secrets | Clé moderne locale depuis environnement/fichier ignoré, jamais argument ou navigateur. Aucun objet SDK ou erreur brute sérialisé. Lien affiché une fois après confirmation, sans fichier par défaut ; historique éventuel du terminal expliqué. |
| Génération | Recherche paginée bornée, compte existant refusé en invite et inconnu refusé en recovery. Un seul generateLink sans metadata ni mot de passe. Réponse/cible/type/jeton/action_link/callback contrôlés. Échec partiel ou remise perdue : état incertain, aucun retry ni suppression. |
| Callback | Syntaxe 20–512 caractères conservée ; paramètres supplémentaires désormais refusés aussi. Nettoyage précoce/no-referrer/clic verifyOtp conservés. Lien d'annulation explicite, aucune consommation à la prévisualisation. |
| Session | Double vérification en vol refusée. Une sortie/bascule de compte pendant verifyOtp invalide le résultat tardif et son autorisation de mot de passe, y compris A→B→A. Aucun historique supprimé. |
| Récupération publique | Information assistée, lien retour et contenu sans JavaScript, pas d'adresse de support inventée ni collecte d'e-mail. requestPasswordReset supprimé car sans appelant ; lien profil et textes invitation/erreur cohérents. |
| Documentation | Guide opérateur, architecture, plans DEV sans prérequis SMTP, exploitation/dossier/décisions/projet de notice et TESTS actualisés. Audits/validations historiques non réécrits ; canal de droits, fermeture et P0 restent ouverts. |

## Vérifications réellement exécutées sur le poste

Node **24.22.0**, npm **10.4.0**, `npm ci` réussi. `npx playwright install chromium` : premier essai ENOTFOUND dans la sandbox, relance avec permissions adaptées réussie. Premier lancement E2E bloqué au démarrage serveur dans la sandbox, interrompu ; relance réussie sans mock ou URL distante supplémentaire.

| Contrôle | Résultat et portée |
| --- | --- |
| `npm test` | **417 tests / 43 fichiers réussis**, dont générateur, service Auth et préparation réelle de l'artefact ; aucune preuve RLS par mocks. |
| `npm run test:e2e -- --workers=2` | **79/79 parcours Chromium réussis (1,8 min)**, serveur local et profils temporaires isolés. |
| Ciblés Auth finaux | **11/11 réussis (8,3 s)** après ajustement de présentation sans JavaScript. Un premier test de texte `<noscript>` échouait car le lecteur Playwright ignore ce conteneur : assertion ciblant son paragraphe corrigée, contenu et lien visibles vérifiés. |
| `npm run build:auth-sdk` | SDK **2.118.0 reconstruit sans diff** sur assets/vendor/supabase.js ; manifeste de dépendances et verrou préservés. Seul un script npm est ajouté. |
| Visuel | Récupération desktop clair/mobile sombre, callback mobile sombre, profil synthétique desktop et récupération sans JavaScript : captures privées sous `.tmp/lot653a/`, inspectées, pas de débordement horizontal. Espacement sans JavaScript ajusté après inspection. |
| Artefact Pages | Préparateur réel : **127 fichiers publics + .nojekyll, 292 références versionnées** ; Auth off, URL/clé/siteUrl vides. Aucun scripts/tests/docs/supabase/node_modules/.env, outil administratif ou lien réel. Digest SHA-256 de l'inventaire ordonné chemins/contenus : `e2590a83d0b60bdb59e5210a685a9f270b4ee0e9806d655b60bf524950d0b267`. |
| Supabase réel sur ce poste | **NON EXÉCUTÉ** : Docker absent. Aucun appel ou session DEV/PROD, aucune tentative de redirection des runners. |

Revue finale locale : **27 fichiers concernés, dix documents, 100 liens locaux et 33 tableaux**, zéro anomalie ; recherche bornée de clés privilégiées, JWT, tokens GitHub et clés privées sans signal autre qu'une fixture explicitement synthétique dans un test unitaire. Aucun signal dans l'artefact. `git diff --check` réussi avec la configuration Git du dépôt ; un contrôle auxiliaire ayant désactivé la conversion CRLF signalait artificiellement les fins de lignes, sans défaut du diff normal. Les scans par motifs ne sont pas une garantie absolue contre tout secret possible. Captures et rapports locaux minimisés restent ignorés.

## Recette réelle intégrée à la CI, distincte des régressions SMTP

`tests/e2e-supabase/auth-manual.spec.js` est découvert par la configuration Supabase et l'orchestrateur existants, dans le même **supabase-security**, avec un worker. Aucun job ou attente globale supplémentaire, noms des trois jobs et optimisations #20 conservés. L'attente d'expiration des liens manuels est bornée dans son propre test et se déroule en temps réel ; l'orchestrateur conserve le chevauchement des branches Auth/backend/navigateur et rejoint leurs nettoyages.

| Parcours | Preuve exigée en exécution réelle |
| --- | --- |
| Manuel A/B et récupération | Générateur/transport livrés réellement utilisés ; création Auth/profil avant activation ; mailbox synthétique vide avant/après ; prévisualisation/annulation sans verify puis activation depuis autre contexte ; double soumission unique, vraie réponse Auth retenue puis libérée ; mot de passe titulaire, profil/reload, A/B lecture et UPDATE voisin vides ; recovery en nouveau contexte, ancien mot de passe refusé/nouveau connecté, liens réutilisés refusés et absence de clé privilégiée en requêtes frontend. |
| Erreur/reprise | Fournisseur recovery inconnu ne crée pas de compte ; préflight outil refuse inconnu/existant ; acquittement perdu ou réponse tronquée après vrai commit invite : compte/profil présents, nouvelle invite refusée sans remplacement. |
| Erreurs/expiration | Mauvais type et token altéré refusés ; attente serveur réelle au-delà de 60 s, puis refus navigateur invite/recovery, pas de formulaire de mot de passe ni message SMTP. |
| Nettoyage | Seulement UUID synthétiques propres au run, vérification d'absence Auth **et** profils après suppression. Résultat partiel connu enregistré avant simulation de perte. Pas de purge globale de comptes/mailboxes ni de compte historique. |

Le réglage local **secure_password_change=true** est conservé ; définition du mot de passe via session fraîche de lien, sans ancien mot de passe/nonce automatique. Le réglage DEV constaté off n'est pas modifié. Les traces, vidéos et captures automatiques de ces suites sont désactivées ; erreurs réduites au stade, aucune session/lien/mot de passe dans un rapport public. La présence de ces tests ne vaut pas succès : seul le résultat réel du dernier SHA en CI peut l'attester.

## Livraison et décisions suivantes

Les trois contrôles **unit-integration**, **e2e**, **supabase-security** doivent réussir sur la dernière tête de PR ; SHA, URLs, conclusions et arrêt de stack à vérifier dans la description de PR. À l'écriture de ce document, aucune réussite de CI future n'est présumée. Tout correctif poussé impose de vérifier sa nouvelle tête.

Aucune migration existante, politique RLS, grant de colonne, trigger, synchronisation, IndexedDB v2, protection imports/exports/effacement/anti-résurrection, prototype close-account, inscription/anonyme ou JSON public Auth modifié. Aucun appel Supabase hébergé, clé réelle publiée, compte historique ou donnée utilisateur effacé. Les seules écritures distantes du lot sont commit/push/PR GitHub autorisés.

Après fusion éventuelle, **6.5.3.B** portera sur la migration personnelle manquante DEV avec autorisation distincte ; il n'est pas commencé. L'outil hébergé et la recette des liens hébergés auront ensuite leur propre procédure/protections/autorisation. Canal de droits réel, confidentialité approuvée avant collecte, calendrier de fermeture juin 2027 et décision d'ouverture restent à valider. Aucune invitation des camarades ou mise en service réelle revendiquée.
