# Recette hébergée DEV — lot 6.5.4.B

**Reprise 6.5.4.C, 30 octobre 2026 :** la [procédure de continuation](RUNBOOK-REPRISE-DEV-6-5-4C.md) conserve le run consommé, les identités A/B, preuves et budgets ; [réconciliation et résultats](../validations/VALIDATION-LOT6-5-4C.md). A présent/confirmé, B absent, mot de passe A inconnu ; **1/3 créneau, 2/60 Auth et 0/140 pédagogiques** hérités. Nouveau SHA/artefact avec filiation, **R requis avant toute nouvelle opération**, C/D distincts. Matrice T01–T12 conservée ; les mentions préparatoires A/B absents plus bas restent historiques et ne remplacent pas le bilan daté de l'exécution B.

**Suivi opérateur du 30 octobre, après préparation : A reçu avec la protection présentée, sans nouvelle copie technique.** [Reçu et contrôles](../validations/VALIDATION-LOT6-5-4B.md). B/C/D restent à obtenir. Les mentions de phase 0 ci-dessous décrivent le mandat initial, avant cet accord distinct ; A n'est plus à redemander. Le correctif d'environnement des sous-processus ne change ni la cible ni les bornes acceptées ; fixer le nouveau SHA testé et reconstruire l'artefact avant B.

**29–30 octobre 2026 — phase 0 préparée ; EN ATTENTE D'AUTORISATION.** Le mandat autorise les lectures de métadonnées et les préparations locales. Il ne donne aucun accord A/B/C/D. [Résultats réellement observés](../validations/VALIDATION-LOT6-5-4B.md). Aucun accès PROD, compte/lien créé, session étudiante, écriture pédagogique ou nettoyage DEV dans cette préparation.

## Cible, versions et conditions d'arrêt

Seul projet : **`wcckbyhrtroittbfophv`**, Mon BPREA DEV, Free, eu-west-1, ACTIVE_HEALTHY, PostgreSQL 17.11.0.003. Référence Git de départ : `78971e13e0eed7079ee578a1cf4718482ecc8f4f`, fusion #30 confirmée après fetch. Branche : `feature/lot6-5-4b-recette-hebergee-dev`. Le SHA effectivement recetté sera celui du `plan.json` privé, identique à HEAD et à l'artefact ; la description de PR consigne la dernière tête testée. Aucun push n'applique SQL ; aucun travail sur main.

Avant chaque phase, relire l'identité par le connecteur officiel ou Dashboard DEV et le catalogue/les [droits effectifs](../../scripts/verification-dev/privileges.sql). Attendre exactement les trois versions `20261022000100`, `20261024083417`, `20261025143831`, dix tables et neuf RPC. Comparer définitions, propriétaires, signatures, RLS et grants, pas seulement les nombres. Relire aussi le statut, Free, région/version, providers, confirmation, URLs, durées et Data API. La phase 0 ne donne aucune preuve d'accès JWT/PostgREST étudiant.

Arrêt immédiat : cible ambiguë, nouvelle migration inexpliquée, objet absent, RLS/grant/RPC divergent, domaine de retour inattendu, donnée réelle dans les fixtures, permission manquante, protection non acceptée, quota ou secret exposé. Ne modifier ni Auth, SQL, RLS, GRANT, trigger, migration ou configuration fournisseur. Toute réparation hébergée nécessite un mandat identifiant son delta.

PROD est exclu de tout accès. Les runners historiques et `close-account` restent exclusivement verrouillés sur **`mon-bprea-lot6-1-local`**. Les mots A/B du lot 6.5.3.B étaient d'autres autorisations ; ils ne s'appliquent pas ici.

## Point d'arrêt A — proposition exacte à approuver

| Élément présenté | Périmètre proposé |
| --- | --- |
| Projet / Git | DEV exact ci-dessus ; dernier SHA testé de la PR et `plan.json`, à revérifier immédiatement avant la session |
| Scénarios | T01–T12 ci-dessous ; les cas non réalisables restent NON EXÉCUTÉ, sans résultat déduit d'un mock |
| Comptes | **Deux au maximum**, A/B neufs propres au run ; aucune identité historique ou camarade ; aucun rôle administratif |
| Adresses | Générées depuis le run aléatoire, suffixes a/b et domaine réservé `example.invalid` ; ni boîte réelle ni routage SMTP ; valeurs exactes conservées dans le dossier privé |
| Auth | **Trois generateLink maximum** : invite A, invite B, recovery A ; une relecture administrative du seul UUID A avant recovery ; au plus **60 requêtes Auth mutantes navigateur**, connexions/refresh/verify/password/logout compris |
| Accès applicatifs | Dix tables et neuf RPC listées dans `plan.json` ; JWT A/B pour les opérations étudiantes, publishable pour V ; aucun accès pédagogique administratif |
| Volume | **140 tentatives de mutation pédagogique maximum**, retries/refus inclus, réservées avant envoi ; **150 lignes applicatives nouvelles maximum**, profils inclus, avec contrats actuels à une ligne par requête. Plan nominal inférieur à 80 lignes ; aucun batch de lignes |
| Protection proposée | Isolation par deux nouveaux UUID et RLS/grants inchangés ; aucune opération de suppression, de configuration ou de remplacement global. Acceptation explicite du risque résiduel et de la couverture partielle de l'ancienne copie ; aucune perte d'historique acceptée tacitement |
| Sauvegarde | La copie 6.5.3.B précède la migration ; elle exclut Auth et données postérieures. Aucune nouvelle copie réalisée. Si l'exploitant juge une nouvelle protection nécessaire, suspendre A et demander un mandat de copie séparé avant toute mutation |
| Risques | L'invitation crée potentiellement Auth/profil avant activation ; lien sensible, résultat réseau incertain, JWT résiduel après logout, cache non chiffré, conflits et limites JSON, quotas Free ; risque d'erreur administrative jamais nul |
| Arrêt | Saisir `stop` ou interrompre le processus ; fermer les contextes/serveur. Conserver données/outboxes et créneaux incertains. Cela ne révoque pas immédiatement les JWT. Confinement serveur éventuel à autoriser séparément |
| Nettoyage | **Aucun automatique**. D distinct sur la liste privée des seuls UUID effectivement créés, effets de cascade et sessions ; comptes historiques intacts. Fermeture d'un navigateur ne vaut pas suppression Auth |
| Coût | Aucun achat, abonnement, domaine ou SMTP externe ; rester sur Free. Arrêter en cas de quota, sans augmenter l'offre |

Demander explicitement l'accord A sur cette proposition et le choix de protection. A n'autorise ni B, ni C, ni D. Un refus ou une absence d'accord laisse la recette **EN ATTENTE D'AUTORISATION**.

## Préparer le dispositif local sans appel hébergé

Node **24 LTS**, `npm ci`, `npx playwright install chromium`. Ne pas charger `.env.supabase-test.local` dans ces outils. Aucun nouveau paquet. Le générateur local `scripts/auth-link-local.mjs` n'est ni importé ni modifié.

Dans un processus privé, fournir seulement la clé publishable DEV par `MON_BPREA_DEV_PUBLISHABLE_KEY`, puis :

```text
npm run dev-recipe:prepare
```

Cette commande **ne fait aucun appel Supabase**. Elle crée un run aléatoire, un dossier neuf ignoré `.tmp/dev-recipe/<run>/`, son ACL privée Windows (exploitant, SYSTEM, administrateurs) ou mode 0700, puis :

- `plan.json` : projet/SHA, bornes et statut sans autorisation ;
- `fixtures.json` : dates pédagogiques contrôlées, snapshots publics, valeurs synthétiques, 140 UUID d'intention préparés une fois ; aucun UUID Auth inventé ;
- `preflight-targets.sql` : comptages ciblés des **deux seules adresses du run**, jamais de liste des comptes ;
- `preflight.example.json` : attestation volontairement incomplète, donc inexécutable ;
- `auth-config.json` public seulement, puis `frontend/mon-bprea/`, via le préparateur Pages existant et versionné au SHA.

`artifact.json` conserve le SHA et l'empreinte des noms/contenus de tous les fichiers préparés. La session vérifie cette empreinte avant de démarrer ; une copie modifiée doit être reconstruite. Le checkout doit aussi être propre lors de la préparation.

Le défaut versionné `assets/auth-config.json` reste désactivé. Aucun script Node/admin, document, fixture, `.env`, export ou dump n'entre dans Pages. Ne pas publier le dossier d'essai. Ne pas écraser `auth-config.local.json` existant. Après tout changement de SHA/code, arrêter et préparer un autre artefact ; ne pas changer le SHA du manifeste pour réutiliser un run.

Le générateur/sélecteur DEV ne prend **aucun argument**, URL libre, `--project`, `--force`, `--yes` ou batch. Les variables obligatoires pour la future session sont :

| Variable | Valeur / provenance |
| --- | --- |
| `MON_BPREA_DEV_PROJECT` | `wcckbyhrtroittbfophv`, contrôlée indépendamment de l'URL |
| `MON_BPREA_DEV_URL` | `https://wcckbyhrtroittbfophv.supabase.co`, représentation exacte sans slash final/port/identifiant/query/fragment |
| `MON_BPREA_DEV_SITE` | `http://127.0.0.1:4173/mon-bprea/` |
| `MON_BPREA_DEV_RUN` | Run préparé, inchangé |
| `MON_BPREA_DEV_ADMIN_KEY` | Clé moderne `sb_secret_…` du seul processus Node privé, jamais dans un argument/fichier/navigateur/conversation ; ne pas copier une clé ici pour faire approuver |

L'opérateur habilité vérifie secrètement la provenance/permission de sa clé. Le format ne certifie pas son origine serveur. Aucun secret supplémentaire n'est demandé par le frontend. Chromium et les commandes Git/Python/ACL reçoivent une liste fermée de variables publiques, jamais l'environnement privé Node complet. CI, pipes, variables de diagnostic et historique de liens sont refusés. L'ACL ne chiffre pas le disque et ne certifie aucune exclusion de synchronisation cloud : vérifier le poste et décider la conservation avant les liens.

## Point d'arrêt B — une génération à la fois

Avant chaque opération, confirmer de nouveau cible, SHA, type/acteur, adresses exactes en privé, habilitation, bornes, callback et mode de remise. Exécuter en **lecture seule sur DEV** `preflight-targets.sql` ; n'extraire que deux comptages. Invite exige zéro pour sa cible ; recovery exige A présent, puis l'outil revalide son UUID/e-mail/activation par `getUserById`. Ne jamais lister tous les utilisateurs pour les traiter.

Renseigner `preflight.json` depuis les métadonnées effectivement relues : champs du modèle, `checkedAt` UTC réel, vérifications et protection acceptée ; `absent.A/B` selon comptages, `present.A:true` pour recovery. **Validité cinq minutes**, revérifiée après la confirmation B. C'est une attestation opérateur, pas une certification cryptographique ou un verrou transactionnel Auth. La très improbable collision concurrente d'une adresse impose l'arrêt ; ne pas réinviter un compte en attente.

Après accords humains A et B applicables, lancer dans un terminal privé interactif :

```text
npm run dev-recipe:session
```

Le checkout doit être propre et au SHA du plan. La session exige A explicitement, ouvre un serveur silencieux sur **127.0.0.1:4173**, puis les contextes Chromium temporaires **A1, A2, B1, V**. Aucun profil Brave/Chrome personnel, cookie historique, trace, vidéo, capture ou mot de passe automatique. Chaque commande `invite A`, `invite B`, `recovery A` demande B exact pour ce créneau. Une génération n'effectue qu'un appel et aucune suppression.

Une réservation de créneau durable `*.attempt.json` est créée exclusivement **avant** l'appel. Après réponse, seuls UUID du run/stade/date sont conservés, jamais `properties`, lien, TokenHash ou réponse complète. Tout créneau existant, même incertain, bloque la répétition. Un seul démarrage de session est permis par run ; le crash impose diagnostic et reprise séparément autorisée, pas un nouveau run pour contourner le plafond.

Le transport Node autorise seulement POST `generate_link` avec type/adresse/callback fermés et, pour recovery, GET du seul UUID A créé. Redirections HTTP refusées ; aucune lecture de masse, clé frontend, mot de passe administratif, envoi SMTP ou mode de suppression. Le vrai SDK 2.118.0 envoie `redirect_to` dans la query et `redirectTo` dans le corps ; ce contrat est testé avec le SDK installé.

Le lien est contrôlé puis transféré **en mémoire uniquement** vers le callback dans A1/B1 ou un contexte neuf A2 pour recovery. `action_link` n'est jamais ouvert. Le proxy n'admet à verifyOtp que les tokens générés dans ce run, ainsi que le token volontairement invalide `invalid-token-<run>` pour le cas négatif ; aucun ancien lien. Le serveur local n'écrit aucun journal d'URL/query. La première requête locale contient cependant le token : ne pas activer de proxy, capture réseau, DevTools avec export HAR ou enregistrement. Le titulaire confirme volontairement puis choisit/saisit lui-même le mot de passe. Ne pas transmettre ces secrets au modèle. Le navigateur garde ses sessions uniquement dans ces contextes temporaires, étiquetés A1/A2/B1/V dans leur titre.

## Point d'arrêt C — groupes d'écritures à approuver

Présenter en privé les seuls UUID A/B effectivement créés, puis les groupes suivants et le budget restant : profil/isolement (T03), Drill/Dashboard (T04), cours/QCM (T05), botanique (T06), ITK/apparence (T07), convergence/reprise (T08/T11), export/analyse/import et barrières synthétiques (T09/T10/T12). Demander C explicitement avant tout envoi pédagogique ; l'autorisation B ne couvre pas ces écritures.

La commande `ecritures` exige C exact, les deux UUID du run et réserve chaque requête en fichier privé avant envoi, refus compris. Le proxy de contexte bloque les autres origines, administration/SMTP/signup/anonyme, identités historiques, DELETE et batch ; les accès publics du site restent locaux. Les seuls GET/POST/PATCH permis visent les dix tables/neuf RPC. Les requêtes A contre B et V doivent atteindre réellement Supabase ; un refus du proxy n'est jamais une preuve RLS.

Le proxy ne remplace ni RLS ni le contrôle des relations métier. Définir les parents/UUID des scénarios à partir des fixtures du run et vérifier les réponses réelles, sans exporter de token. Pour les requêtes forgées manuelles, employer le JWT du contexte isolé en mémoire et produire seulement statuts/comptages/égalité de témoins ; aucune copie dans le terminal, modèle ou rapport. Les 140 tentatives sont un plafond, pas une cible à atteindre. Aucun nouvel UUID n'est créé pour un retry ; toute opération volontaire distincte garde le sien. Ne pas injecter les données d'une sauvegarde avant le clic volontaire de restauration.

## Matrice actuelle T01–T12 et preuves attendues

Cette numérotation remplace la matrice préparatoire T01–T18 du plan général pour **ce lot uniquement**. Sous-cas : indiquer chacun séparément s'il n'est pas exercé.

| ID / accords | Procédure et témoins attendus sur DEV réel | Limites / arrêt |
| --- | --- | --- |
| T01 — A/B | Invite A/B ; profils liés ; callback nettoyé avant sous-ressources ; aucune consommation au simple chargement/annulation ; clic volontaire unique, mot de passe titulaire, connexion/logout/reload/reconnexion ; jeton invalide, type erroné, réutilisation, double clic | Deux comptes maximum. Expiration OTP réellement attendue si revendiquée ; un lien consommé ne prouve pas l'expiration. Pas de génération supplémentaire sans nouveau mandat |
| T02 — A/B | Recovery A depuis contexte vierge après progression C ; comportement Secure password change actuel ; ancien mot de passe refusé, nouveau accepté, lien non réutilisable ; relecture comparative de progression et B | Une récupération au maximum. Ne pas changer le réglage pour passer ; dates d'expiration configurées seules insuffisantes |
| T03 — A/B/C | JWT A/B : profil propre, pseudo seul modifiable ; id/dates/administration/INSERT refusés ; SELECT sans filtre/filtre voisin sur dix tables ; INSERT propriétaire voisin, UPDATE voisin et références série/session B ; neuf RPC et visiteur : réponses serveur et témoins B inchangés | Sans DELETE de lignes. Signup/anonyme négatifs **différés** : un succès imprévu pourrait créer un troisième compte ; mandat de contingence distinct requis. Leur configuration reste relue |
| T04 — C | Séries uc3 2026-W44/W43, dix snapshots ; premières réponses immuables, entraînements distincts de même date/score avec UUID différents ; retry exact ; reload/A2 et Dashboard, taux sur réponses réalisées/historique conservé | Pas de badge ni série ancienne bloquante ; distinguer erreur pédagogique et sync, entraînements exclus du taux principal |
| T05 — C | Deux cours publics : validation puis done:false, score zéro et meilleur score, tentatives même date/score UUID différents ; retry/reload/A2, CAS concurrent et version récente préservée | Pas de fusion par score/date, remise à zéro de révision ou écrasement pour une assertion |
| T06 — C | Session préalable, quatre réponses terminales si effectivement exercées, première fin stable, révision pédagogique/SQL distinctes ; retry/contenu divergent, orpheline et parent B refusés ; statistiques reconstituées | Démontrer skipped_image par panne de sa photo locale, timeout réel dans ce contexte ; ne pas inventer un parent pour rendre une orpheline valide |
| T07 — C | Huit paramètres ITK exacts puis modification, CAS/relecture A2 ; apparence auto/light/dark et quatre saisons, auto conservé, reload et conflit ancien/nouveau visible | Ne pas arbitrer par l'horloge ni synchroniser un rendu CSS comme préférence |
| T08 — C | A1 écrit et A2 relit, puis inverse ; `hors-ligne A1`, action locale durable et outbox, `en-ligne A1`, relecture/acquittement sans doublon ; A→B→A et réponse tardive | Pas de service worker : recharger sans réseau total peut rendre les pages indisponibles. Pour tester reload avec API seule indisponible, bloquer DEV seulement dans le contexte et conserver le serveur local ; ne pas promettre un site entièrement offline |
| T09 — C | UI Mes données, identité fraîche, dix sources + compléments, deux passes concordantes, exclusions/secrets et propriétaire contrôlés localement ; téléchargement volontaire v1, conservation privée temporaire | Le téléchargement n'est pas un dump Auth ; pas d'addition SQL/cache/outbox. Pagination multi-page non revendiquée si volume < 100 par table ; voir décision complémentaire ci-dessous |
| T10 — C | Fichier v1 A, analyse/annulation sans nouvelle mutation, réintégration compatible (QCM absent, première création base 0, réponse avec parent confirmé) ; relecture SQL/IDB ; même import répété sans UUID nouveau ; conflit plus récent préservé ; JSON A refusé sous B ; A2 vierge | Produire les absences depuis des intentions jamais envoyées/exportées via les vrais modèles. Aucun DELETE pour simuler une perte. Drill absent, ancienne révision, session terminée absente, manifeste incomplet et trace privacy restent bloqués ; aucun Auth recréé |
| T11 — C | Couper la réponse après un commit réel autorisé, puis relire avant replay exact ; réponse tardive, double clic/reload, quota local isolé, CAS, annulation et reprise ; aucune réussite fictive | Ne pas renvoyer aveuglément une mutation incertaine ni réduire les temporisations pour une réussite. Quota manipulé exclusivement dans le contexte synthétique |
| T12 — C et confirmations locales | Sélections/annulations de retrait local synthétique, caches A/B isolés, domaine bloqué refusant l'ancien JSON même après reprise, autres domaines/serveur/B préservés | Aucun close-account, clôture, déploiement Edge ou effacement hébergé. Le retrait local doit être explicitement inclus dans C ; aucune donnée utilisateur réelle |

Les copies v1 synthétiques restent dans le navigateur/le dossier temporaire du run, jamais dans Actions/PR. Les téléchargements Playwright temporaires disparaissent à la fermeture du contexte : si une réutilisation pour T10 exige une copie de fichier, l'opérateur choisit un emplacement privé, la garde seulement pour le run et soumet son sort au point D. Ne pas présenter leur suppression comme déjà autorisée. Les blocages par le proxy sont à annoter **BLOQUÉ avant serveur**, sans les compter comme un refus RLS.

**Pagination :** le budget ordinaire teste les boucles jusqu'à page vide et la cohérence des sources ; il ne garantit pas plus de 100 lignes dans une même collection. Une démonstration DEV de plusieurs pages pleines exige une extension explicite du budget/fixtures, ou un dispositif dédié réduisant la taille de page sans modifier le backend. Les mocks/CI couvrant 205 tentatives restent distincts. Ne pas créer 200 lignes supplémentaires implicitement.

**Interruptions :** le CLI livré n'automatise pas toutes les injections réseau/CAS/quota ni les assertions T03–T12. Préparer la manipulation précise sur le contexte du run et faire approuver son groupe C avant exécution. L'injection doit laisser parvenir la requête à DEV pour prouver un commit ; aucune interception renvoyant un faux succès. Les expirations réelles peuvent dépasser une heure ; à défaut d'attente, sous-cas NON EXÉCUTÉ. Aucun changement d'expiration, de quota fournisseur ou de contrat JSON.

## Preuves minimisées et état de chaque scénario

Utiliser une ligne par scénario/sous-cas : ID, prérequis, accord A/B/C applicable réellement reçu, environnement, heure **Europe/Paris**, SHA testé, run non sensible, composant, attendu, observé, méthode (HTTP/SQL avec JWT réel ou lecture catalogue), statut, limite, décision. Statuts : **RÉUSSI, ÉCHEC, BLOQUÉ, NON EXÉCUTÉ, EN ATTENTE D'AUTORISATION, HORS PÉRIMÈTRE**.

Un statut RÉUSSI DEV exige la preuve DEV du sous-cas. Une lecture catalogue, un vert CI, une simulation HTTP ou une couleur « synchronisé » ne suffisent pas pour les parcours. Pas d'e-mail/UUID historique, mot de passe, clé, token, lien, TokenHash, payload, export complet, dump, trace/vidéo ou capture sensible dans Git/Actions. Rapports publics : comptages, codes non sensibles et conclusions seulement.

## Point d'arrêt D — nettoyage et fermeture

Présenter en privé les **UUID exacts effectivement reçus** depuis les créneaux invite A/B, leurs états éventuellement incertains, les objets des dix tables, les cascades Auth et les sessions/refresh/JWT résiduels. Inclure fichiers de copies, caches de contexte et autres objets réellement créés. Fixer ce qui est préservé et la décision de conservation ; la copie 6.5.3.B garde son échéance du **5 novembre 2026**, sans prolongation ou lecture de son contenu.

Demander D visant uniquement cette liste. Le dispositif livré ne contient **aucune fonction/commande DELETE** : une suppression native Auth et les contrôles de cascade exigent un moyen distinct relu et autorisé à ce point. Ne supprimer ni par domaine/préfixe, ni par liste globale. Aucune suppression des comptes historiques. Un UUID non enregistré ou un résultat ambigu impose l'arrêt, pas une recherche/purge plus large. La clôture fonctionnelle T12 reste hors périmètre, même si D autorise le nettoyage de fixtures.

Avant D, `stop` ferme le serveur et les navigateurs, sans appel administratif logout/suppression ni effacement des fichiers du run. Documenter les résidus ; ne pas effacer la progression pour « fermer proprement ». La fermeture des contextes est prévue pour ces profils éphémères ; elle ne démontre pas révocation distante, effacement des copies OS ou sortie de rétention fournisseur.

## Reprise, corrections et livraison

Avant toute saisie de clé sous Windows, vérifier le lancement réel de Chromium dans **le même environnement d'exécution** que la session opérateur, ainsi que la console interactive. Le cache du sandbox et celui du compte Windows peuvent différer ; une installation réussie hors sandbox ne prouve pas le lancement dans le sandbox. Ces contrôles restent sans clé ni appel distant et précèdent la réservation d'un run de recette.

Le vrai SDK ajoute `code_challenge:null` et `code_challenge_method:null` à un PUT de mot de passe. Le garde les accepte seulement lorsqu'ils sont nuls, avec `password` de type chaîne ; tout autre champ reste refusé. L'échec réseau d'un filtre local n'est ni un refus serveur ni une preuve RLS. Un lien déjà vérifié reste consommé même si la définition du mot de passe échoue ensuite : conserver le créneau et l'UUID, réconcilier l'état et préparer une reprise distincte, sans générer spontanément un nouveau lien.

Résultat incertain : arrêter ; relire de façon ciblée l'UUID reçu ou les comptages des deux seules adresses si aucun UUID n'a été acquitté. Ne pas supprimer un fichier `attempt`/`session-started`, recréer un run ou relancer pour contourner cette garde. Toute reprise ou génération supplémentaire doit être explicitement définie et autorisée après diagnostic.

Défaut applicatif démontré : reproduire localement, correctif Git minimal et tests rejoués. Dérive SQL/Auth/configuration : consigner et demander mandat distinct ; ne pas modifier DEV pour verdir. Une livraison **RECETTE PARTIELLE — CORRECTIF REQUIS** est possible. Sans A/B/C, livrer la préparation avec **EN ATTENTE D'AUTORISATION**.

Avant PR : npm test, npm run test:e2e, build SDK identique, garde-fous ciblés, contrôle Pages/Auth off/secrets/liens et diff. Les trois jobs `unit-integration`, `e2e`, `supabase-security` restent requis sur la dernière tête ; le dernier utilise exclusivement sa stack éphémère. Aucune clé DEV dans Actions. Pas de fusion, ouverture, camarade, production, validation juridique ou levée de P0/D01–D14.

## Références officielles relues le 29 octobre 2026

[generateLink](https://supabase.com/docs/reference/javascript/auth-admin-generatelink), [verifyOtp](https://supabase.com/docs/reference/javascript/auth-verifyotp), [gestion utilisateur/trigger](https://supabase.com/docs/guides/auth/managing-user-data), [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [sécurité Data API](https://supabase.com/docs/guides/api/securing-your-api), [changelog](https://supabase.com/changelog).

Le [changement annoncé pour le 30 octobre](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically) concerne les grants par défaut des nouveaux objets ; les tables existantes gardent leurs grants. Il ne remplace ni schéma exposé, privilèges de table/colonnes, RLS, JWT ou EXECUTE des RPC. Relire l'état réel après cette date ; ne pas ajouter de droits globaux. L'index changelog.md est refusé par le lecteur web pour son content-type ; la page HTML et l'annonce précise ont été consultées.
