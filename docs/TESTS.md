# Développement et stratégie de tests

## Archives et pannes d’import — lot 6.5.5.F

`settings-model` et `settings-store` couvrent les reçus minimisés, les conflits récents complets, le chaînage incertain et les anciennes archives relues au-delà de l’ancienne borne de vingt. `restore-conflict-roundtrip` vérifie les références exactes des conflits dans les deux formats et garde les reçus hors rejeu. `export-model` vérifie l’exclusion des copies brutes et empreintes de refus du JSON du compte.

`import-provenance.test.js` exerce les deux services avec un `setItem` refusé, un vrai abort fake-indexeddb après le `put`, un rechargement, la mutation de la source pendant le scan, le rejeu exact, le retour réseau après A–B–A et le retrait gardé par `privacy`. Les tests botaniques couvrent la reconnaissance des refus historiques et minimisés, l’échec du calcul de l’empreinte et le refus qui reste un refus après une bascule de compte. Dans Chromium, `botanical-sync.spec.js` avorte une transaction après écriture du marqueur, recharge et confirme la même sauvegarde simultanément dans deux onglets. `notice-preview` et `privacy-artifact` vérifient respectivement le rendu local et le périmètre Pages. Les réponses HTTP synthétiques et la sécurité RLS sur stack éphémère sont vérifiées séparément. [Validation F](validations/VALIDATION-LOT6-5-5F.md).

## Accès au terminal et mémorisations locales — lot 6.5.5.E

`d12-storage.spec.js` enregistre les méthodes et noms de clés, sans consigner les valeurs Auth. Les tests utilisent l’artefact Pages et des contextes isolés. Ils distinguent la lecture avant CSS de la seule apparence mémorisée, les anciennes clés accessibles sur action, le masquage d’anecdote en mémoire de page et les commandes ITK de rappel et de retrait. Le calendrier et le CSV sont comparés pour des paramètres identiques. Le profil ne lit les sauvegardes locales qu’après la recherche demandée et peut exporter ou retirer séparément les mémorisations et les originaux hérités.

`appearance-preferences.spec.js` bloque les CSS pour vérifier le premier rendu, teste les seuils horaires et les anciennes valeurs, puis contrôle le clavier et le focus en clair/sombre à 320, 390 et 1280 px. `d12-storage.spec.js` vérifie aussi la palette du dialogue au moment de reprendre un ancien thème, à 320 × 690 px. Les erreurs de quota et d’accès au stockage couvrent des dégradations différentes. Les captures synthétiques et le rapport navigateur restent ignorés. `notice-preview.spec.js` applique la même matrice sans JavaScript à la V1.1 en préparation. `privacy-artifact.spec.js` vérifie séparément le réseau, les stockages créés et l’exclusion de la notice dans l’artefact réel.

Les tests d’import QCM et botanique couvrent l’annulation sans dépôt d’UUID, la confirmation, la mutation de la source pendant une relecture distante, la concurrence, le refus d’écriture, la bascule de compte et le rejeu après rechargement. Le retrait de la provenance invalide l’ancien aperçu. Les suites existantes de synchronisation et d’effacement vérifient les outboxes et la barrière `privacy`. Les réponses HTTP simulées ne valident pas RLS. Le job `supabase-security` vérifie la stack éphémère distincte. [Validation E](validations/VALIDATION-LOT6-5-5E.md).

## Notice et accès au terminal — lot 6.5.5.D

Au lot D, `d12-storage.spec.js` relevait les noms et les types d’accès. L’horloge contrôlée distinguait l’effet du masquage de l’anecdote de la présence de sa date. Les actions montraient les écritures visiteur, la migration du thème hérité et, via HTTP simulé, la session et l’outbox personnelle conservée après déconnexion. Le dépôt d’UUID dès l’aperçu d’import faisait partie des constats ensuite corrigés dans E. Les essais couvraient le navigateur, séparément de la RLS.

`notice-preview.spec.js` rend la même source que `npm run preopening:notice`. Six combinaisons sans JavaScript couvrent 320/390/1280 px, clair/sombre, sommaire et fragments relatifs, focus, contraste et absence de requête annexe. L’artefact Pages réel et les pages en contextes vierges vérifient séparément l’exclusion de la notice et de ses liens, la configuration Auth vide/désactivée et le contact. [Validation D](validations/VALIDATION-LOT6-5-5D.md).

## Capacité confirmée et contact public — lot 6.5.5.C

La politique JSON fixe définitivement **sept comptes, exploitant compris et six autres adultes**, contact officiel et droit de publication. Les fixtures synthétiques de `preopening.test.js` couvrent le septième/huitième, place exploitant réservée, attente, doublon, incertitude, comptes fictifs bloqués, récupération à capacité pleine et inscription libre/anonyme refusée. Le helper de décisions conserve identité/preuves/approbations et refuse de transférer des attestations depuis une autre adresse ; les vérifications opérationnelles, dont consultation régulière, restent exigées. Aucun compte créé pour prouver le plafond administratif.

`contact.spec.js` teste l'artefact Pages réel sous `/mon-bprea/` sans Auth : mailto exact, adresse sélectionnable, pas de formulaire/API ni requête tierce, navigation depuis accueil/connexion/récupération/callback/profil avec et sans JavaScript ; 320/390/1280 px clair/sombre, clavier/focus et absence de débordement, préférence saisonnière sombre conservée. Le test d'artefact prouve contact inclus, Auth off, notice complète et dossiers privés exclus. Vérification visuelle et limites lecteur d'écran : [validation C](validations/VALIDATION-LOT6-5-5C.md). Aucune ouverture du client mail et aucun courriel envoyé.

`npm run preopening:notice` crée désormais un nouveau dossier privé `preopening-notice-preview-*` à chaque exécution, sans écraser l'aperçu B. Le rendu accepte le lien mailto approuvé, sans script. `init preopening-operator` préremplit seulement les décisions reçues ; `contact` reste en échec tant que les preuves opérationnelles manquent. Aucun test de boîte ne peut être déduit des fixtures ou des vérifications navigateur.

## Résolution de préouverture — lot 6.5.5.B

`tests/integration/preopening.test.js` vérifie sur fixtures synthétiques : sept comptes exploitant compris (ou sa place réservée), refus du huitième, décompte non confirmé, comptes en attente/incertains/fictifs, absence d'inscription libre/anonyme, récupération inconnue/réinvitation, élévation de rôle, cible/callback/inventaire périmés, bilan sans e-mails/résultats, contact vide et clôture unitaire avec dépendances/sessions/caches/copies. Le plafond est **administratif**, pas un quota Supabase ni une nouvelle preuve RLS. Aucun transport n'est invoqué par les préflights.

Le contrôle de backup vérifie archive/TOC/manifeste/empreintes, couverture dix tables, preuve de restauration liée, dépendances, schéma et journal d'effacements courants ; à 168 h + 1 ms ou sans preuve, **OBJECTIF RPO NON SATISFAIT**. Échecs réseau/PC absent ne rajeunissent pas la copie. Scellement unique hors ligne sans écrasement ni succès implicite ; dumps hébergés refusés dans le dépôt, fichiers liés/hardlinks et cibles PostgreSQL distantes refusés. Le refus initial de hardlink Windows dans le bac à sable n'est pas une réussite ; son exécution autorisée hors restrictions est distincte. `auth-artifact.test.js` vérifie aussi l'exclusion des nouveaux outils et pièces privées de Pages.

`npm run preopening:exercise -- <dossier-bin-PostgreSQL-17>` crée/arrête seulement son nouveau cluster **PostgreSQL synthétique**, 127.0.0.1/port éphémère, sans secret hérité ni service installé. Trois migrations, dix tables/vingt lignes, archive custom/manifeste, restauration et comparaison données/colonnes/contraintes/index/fonctions/triggers/RLS déclaré/droits ; suppression d'une racine Auth **factice** après snapshot, réapparition constatée dans la restauration, réapplication du journal d'effacements et autre compte préservé. La comparaison de contraintes utilise le déparseur PostgreSQL ; les ACL de schéma nulles sont comparées aux droits implicites du propriétaire, sans masquer un GRANT supplémentaire. Ce contrôle administratif de PostgreSQL ne valide ni `deleteUser`, ni JWT/RLS Supabase réels.

`npm run preopening -- init preopening-operator` prépare le contact privé vide ; `contact` reste bloqué sans adresse/preuves. `npm run preopening:notice` crée seulement un aperçu ignoré, hors Pages. Vérification visuelle dans des contextes Chromium neufs, sans JavaScript, 1280/390 px clair/sombre, clavier et absence de débordement/requête tierce. Résultats, échecs initiaux corrigés, suite locale complète et CI : [validation B](validations/VALIDATION-LOT6-5-5B.md). Aucun test sur DEV/PROD ; les runners réels restent exclusivement stack Supabase éphémère dédiée. CLI/Docker absents sur ce poste : suites Supabase locales réelles non exécutées, jamais compensées par une connexion DEV.

`tests/e2e-supabase/closure.spec.js` ajoute une recette distincte du prototype : inventaire Auth local complet/borné, préflight UUID, `auth.admin.deleteUser(UUID, false)` unique, postcontrôle Auth/dix tables, autre participant fictif intact, refresh/reconnexion refusés et écriture sous JWT encore non expiré empêchée par la FK réelle. Réponses et secrets ne sont pas journalisés ; aucun retry d'une suppression incertaine, traces/vidéos/captures désactivées. Cette recette a réussi en CI éphémère le 5 novembre sur la tête 268cbff de la PR #35 : 386 assertions pgTAP et 32 parcours réels, sans déploiement ni cible hébergée. Les contrôles des futurs SHA restent à observer séparément ; [preuves et liens](validations/VALIDATION-LOT6-5-5B.md).

## Maintenance locale — lot 6.5.5.A

`tests/integration/tmp-maintenance.test.js` utilise uniquement des répertoires synthétiques sous un nouveau dossier de test : simulation readonly, volume exact, ciblage/idempotence, chemins externes, jonctions/racine détournée, preuves et réservations, runs actifs, inconnus, manifeste altéré, verrou exclusif, échec de suppression, fichier Windows réellement verrouillé et cycle de vie du build serveur. Aucune fixture n'est extraite des journaux privés de recette. Le test de lien symbolique natif se marque ignoré si Windows refuse sa création ; ne pas l'annoncer réussi. Les tests de jonction restent distincts. La [validation du lot](validations/VALIDATION-LOT6-5-5A.md) indique les résultats exécutés et limites.

Le serveur marque/nettoie seulement son propre build inchangé ; après un arrêt brutal, `npm run maintenance:tmp` simule et `npm run maintenance:tmp -- --apply` retire uniquement les copies publiques prouvées, après fermeture des tests. Ne pas lancer le nettoyeur en parallèle des suites. [Politique, exclusions et restauration](developpement/MAINTENANCE-DOSSIER-TMP.md).

## Reprise corrective C2 — 4 novembre 2026

La [validation 6.5.4.C](validations/VALIDATION-LOT6-5-4C.md) distingue les preuves CI rapprochées, les tests locaux et les vrais scénarios DEV autorisés. Préparation locale sous Node **24.22.0** : `npm ci` hors ligne, **499 tests / 49 fichiers**, puis **85 E2E**, plus dix groupes hors ligne de gardes/filiation. Le premier démarrage E2E refusé sur localhost est consigné séparément ; l'exécution suivante autorisée a réussi. Aucun runner Supabase réel redirigé vers DEV ; CLI/Docker absents sur le poste, ces suites locales restent **NON EXÉCUTÉES**. La CI éphémère distincte vérifiée comporte **386 assertions pgTAP et 31 parcours réels**.

C2 utilise l'artefact frontend existant **5c910b7**, servi localement contre DEV, les deux comptes fictifs et le journal cumulatif : T03/T08/T10/T12 réussis, deux seules RPC QCM/Drill confirmées, JSON original intact, botanique bloquée et privacy conservée. **Expiration JWT T11 NON EXÉCUTÉE**, report choisi par l'exploitant ; ne pas déduire sa réussite des 3600 s configurées ou des mocks. Contrôleur/navigateur/serveur fermés ; compteurs finaux **3/3 liens, 29/60 Auth, 104/140 tentatives**. Garder les marqueurs consommés ; une future sonde exige un périmètre et des préconditions frais, sans répétition des tests acquis. Les limites historiques et la décision D restent distinctes.

## Régression export après conflit — lot 6.5.4.C

`npm test -- tests/unit/restore-conflict-roundtrip.test.js tests/unit/restore-model.test.js tests/integration/restore-service.test.js` : **54 tests**, dont sept régressions nouvelles. Les vrais modèles produisent un cliché pending puis une opération conflict, encore courante ou rangée après résolution ITK ; le véritable export v1 reste analysable sans rendre les archives exécutables. Références inconnues, archive non résolue/autre type, états inconnus et payload/RPC divergents restent refusés. Les trois scénarios valides échouaient avant le correctif. Suite complète : **499 tests/49 fichiers puis 85 E2E** ; réponse HTTP synthétique distincte de la [recette DEV partielle](validations/VALIDATION-LOT6-5-4C.md).

## Continuation du run DEV consommé — lot 6.5.4.C

`npm test -- tests/integration/dev-recipe-continuation.test.js tests/unit/dev-recipe.test.js tests/integration/dev-recipe.test.js` : 28 tests ciblés, dont 9 nouveaux scénarios de filiation, A existant, refus réinvitation A/troisième identité, compteurs historiques/bornes, SHA/artefact/fixture altérés, ancien token, concurrence, interruption et perte de remise. Fichiers/réponses synthétiques seulement, aucun DEV. Réservation exclusive et fsync avant envoi ; suppressions de marqueurs simulées uniquement dans les dossiers créés par ces tests.

`npm run dev-recipe:continue` prépare hors ligne un artefact distinct au HEAD propre, lié à la campagne historique ; mêmes identités/fixtures/journal parent, aucune réinitialisation ou import de session. Préparation/lancement uniques, sans forçage ; `dev-recipe:session` exige **R** pour ce plan v2. [Runbook de reprise](deploiement/RUNBOOK-REPRISE-DEV-6-5-4C.md), [validation factuelle](validations/VALIDATION-LOT6-5-4C.md). C/D distincts, aucun nettoyage automatique ; scripts/lineage exclus de Pages. CI et runners réels locaux inchangés, jamais redirigés DEV.

## Préparation de recette DEV — lot 6.5.4.B

`npm test -- tests/unit/dev-recipe.test.js tests/integration/dev-recipe.test.js tests/integration/auth-artifact.test.js` vérifie sans accès hébergé les cibles fermées, accords séparés, préflight à horloge contrôlée, créneau durable avant appel, absence de retry sur résultat incertain, contrat du SDK installé et redirections refusées. Le serveur local est testé sous `/mon-bprea/`, avec refus des chemins privés ; le fingerprint d'artefact détecte une modification. Le proxy autorise les requêtes V jusqu'au serveur et bloque les liens/comptes historiques ; un refus de proxy n'est jamais une preuve RLS. Fixtures, clés et réponses entièrement synthétiques.

La régression `auth-manual.spec.js` traverse aussi ce garde avec le vrai SDK : définition du mot de passe avec ses deux champs PKCE nuls, sans autoriser e-mail, métadonnées ou challenge actif. Toutes les réponses Auth de cette régression sont synthétiques ; aucune requête DEV. La [validation 6.5.4.B](validations/VALIDATION-LOT6-5-4B.md) distingue ce correctif de l'activation DEV partielle réellement interrompue.

`npm run dev-recipe:prepare` produit seulement un run et un artefact local ignoré depuis un checkout propre, avec configuration publique DEV et ACL privées. **Aucun appel Supabase**. `npm run dev-recipe:session` est un outil opérateur privé distinct : ne jamais l'exécuter dans Actions ni avant les accords [A/B/C du runbook](deploiement/RUNBOOK-RECETTE-DEV-6-5-4B.md). Le nettoyage D n'est pas implémenté dans cet outil. Les variables `MON_BPREA_DEV_*` ne modifient aucun runner historique, toujours exclusivement `mon-bprea-lot6-1-local`. Les trois jobs CI conservent leurs cibles synthétiques et aucune clé DEV.

[Validation préparatoire](validations/VALIDATION-LOT6-5-4B.md) : distinguer catalogues DEV read-only, reconstruction PostgreSQL native avec Auth simulé, tests HTTP synthétiques, CI Supabase éphémère et futurs JWT hébergés. Sans Docker/stack, pgTAP et A/B Supabase local restent NON EXÉCUTÉS sur le poste. Aucun test hébergé déclaré réussi avant preuve réelle et autorisation. Les expirations configurées ou une pagination sous le seuil d'une page ne démontrent pas leurs cas limites.

## Restauration JSON volontaire — lot 6.5.4.A

`npm test -- tests/unit/restore-model.test.js tests/integration/restore-service.test.js` vérifie le véritable format exporté v1, fichiers hostiles/bornés, couverture/identité, relations/UUID et tentatives distinctes, préservation des valeurs/champs existants, analyse readonly, confirmation, répétition, CAS, outbox incertaine, retours tardifs, A→B→A et rollback/quota IndexedDB. Fixtures exclusivement synthétiques et instants pédagogiques explicites.

`npm run test:e2e -- tests/e2e/restore.spec.js --workers=2` utilise le vrai SDK et IndexedDB Chromium avec HTTP **simulé**, sous `/mon-bprea/` : aperçu/annulation sans écriture, confirmation clavier, reload/second import, compte/projet étrangers, visiteur, fichiers/réseau en erreur, session changée et vues 1280/390 clair/sombre. Traces/vidéos/captures d'échec désactivées ; captures visuelles synthétiques ignorées sous `.tmp/restore-visual/`. Ce n'est pas une preuve RLS.

`npm run test:e2e:supabase -- tests/e2e-supabase/restore.spec.js` est découvert par **supabase-security** existant, sans changer son orchestration. Deux scénarios avec les gardes de `mon-bprea-lot6-1-local` : dix tables A/B, export véritable et nouvel appareil, intentions absentes restaurées avec UUID d'origine, conflits, cache/JWT, répétition et refus ; puis premières créations cours/QCM/session botanique/ITK/apparence en base zéro. RPC normales et JWT étudiants, aucun DELETE d'historique pour simuler une perte ; nettoyage des seuls comptes fictifs créés. Contenus/jetons non journalisés. Docker absent : NON EXÉCUTÉ sur le poste, preuve réelle à contrôler en CI, jamais redirection vers DEV/PROD. [Résultats effectifs](validations/VALIDATION-LOT6-5-4A.md), [contrats et limites](architecture/RESTAURATION-DONNEES-PERSONNELLES.md).

## Installer les outils

Le site reste statique ; Node.js sert uniquement aux vérifications locales et à la CI. Installer **Node.js 24 LTS** et utiliser son npm, puis depuis la racine du dépôt :

```bash
npm ci
npx playwright install chromium
```

Le verrou `package-lock.json` est versionné. Utiliser `npm ci` pour reproduire l’installation ; lors d’un changement volontaire de dépendance de développement, mettre à jour le manifeste et le verrou ensemble. En CI, `node scripts/install-chromium.mjs` télécharge le Chromium de ce verrou, puis vérifie réellement son lancement, JavaScript et le rendu. Sous Linux, il utilise `playwright install-deps chromium` seulement si le lancement signale des bibliothèques manquantes, puis recommence la validation réelle. L’installation complète manuelle `npx playwright install --with-deps chromium` reste disponible pour préparer un poste Linux. Aucune clé secrète n’est nécessaire.

```bash
npm test
npm run test:watch
npm run test:e2e
```

`npm test` exécute les tests unitaires et d’intégration une fois ; `test:watch` utilise le mode interactif de Vitest ; `test:e2e` lance les parcours Playwright Test dans Chromium. Le serveur HTTP des E2E est démarré et arrêté par Playwright : il n’est pas nécessaire de lancer Python à la main. Le lancement manuel du site avec `python -m http.server 8000` reste possible sans installation npm.

`vitest.config.js` sélectionne les suites unitaires et d’intégration ; `playwright.config.js` configure Chromium, les artefacts d’échec et le serveur `scripts/test-server.mjs`. Celui-ci utilise `http://127.0.0.1:4173/` pour les sources et `/mon-bprea/` pour un artefact préparé avec la version `e2e-lot5-1`. Python 3.10 ou plus récent doit donc être disponible sous la commande `python` (ou via la variable d’environnement `PYTHON`). Le port 4173 doit être libre ; aucun serveur préexistant n’est réutilisé. Aucune URL distante de remplacement n’est prévue.

Les commandes doivent être exécutées réellement avant de déclarer la validation réussie. Les résultats, limites d’environnement et éventuelles mesures de couverture figurent dans [validations/VALIDATION-LOT5-1.md](validations/VALIDATION-LOT5-1.md), sans déduire une réussite de la présence d’un fichier de test.

Le lot 5.2 ajoute des tests du moteur botanique (sélection et distracteurs, banques courtes, réponses, statistiques et chrono avec horloge contrôlée), du store autonome (relecture, erreurs de stockage, conservation des clés existantes, révision) et des parcours navigateur dans `tests/e2e/botanical.spec.js`. Les E2E utilisent le catalogue et les JPEG locaux : ils n’appellent aucun service photographique externe. Les cas temporels avancent l’horloge Playwright, sans attente arbitraire. Résultats et limites : [VALIDATION-LOT5-2.md](validations/VALIDATION-LOT5-2.md).

Le lot 6.1 distingue les tests du compte dans l’application, avec dépendances simulées, des essais réels de Supabase Auth/PostgreSQL/RLS. Le guide [AUTHENTIFICATION.md](architecture/AUTHENTIFICATION.md) donne la configuration, les migrations, les modèles d’e-mails et les limites des sessions ; les résultats et opérations encore nécessaires figurent dans [VALIDATION-LOT6-1.md](validations/VALIDATION-LOT6-1.md). La création de tests ne doit jamais être présentée comme une preuve de sécurité exécutée.

## Liens manuels sans SMTP — lot 6.5.3.A

Le choix SMTP est abandonné après le 6.5.2 ; [guide opérateur](deploiement/INVITATIONS-ET-RECUPERATION-MANUELLES.md) et [validation](validations/VALIDATION-LOT6-5-3A.md). `npm test -- tests/unit/auth-link-local.test.js tests/unit/auth-service.test.js tests/integration/auth-artifact.test.js` vérifie les gardes exactes, refus DEV/PROD/distant, clé, cible/type, confirmation avant toute requête, construction/structure de réponse, absence de retry/fuite et exclusion de l’outil de Pages.

`npm run test:e2e -- tests/e2e/auth.spec.js tests/e2e/auth-manual.spec.js --workers=2` distingue défaut Auth désactivé et HTTP synthétique du vrai SDK/service/callback. La page de récupération n’a plus de formulaire, promesse d’envoi ou requête `/auth/v1/recover`, y compris avec Auth configurée et sans JavaScript. Callback : paramètres absents/dupliqués/supplémentaires, type invalide, nettoyage, clic volontaire, double clic, annulation/reload, erreurs réseau/Auth et sortie de session pendant réponse tardive. Aucun de ces mocks ne valide RLS.

`npm run test:e2e:supabase -- tests/e2e-supabase/auth-manual.spec.js` utilise la stack `mon-bprea-lot6-1-local` uniquement, les clés modernes locales et le générateur livré (transport inclus), avec confirmation/remise capturées en mémoire privée. Trois parcours : activation/récupération dans de nouveaux contextes, prévisualisation non consommatrice, trigger, connexion/ancien mot de passe refusé, A/B profils, aucun secret privilégié en requête et aucun message capturé ; récupération inconnue/compte existant/perte d’acquittement et réponse partielle après vrai commit sans réinvitation ; mauvais type/jeton altéré et expiration **réellement attendue** au-delà de 60 s. `secure_password_change=true` reste actif. Aucune horloge JS ne prouve l’expiration serveur.

Le job `supabase-security` découvre cette suite via l’orchestrateur existant, sans nouveau job ni perte des optimisations #20. Traces/vidéos/captures automatiques désactivées et erreurs réduites au stade ; aucun lien/session/mot de passe dans les rapports. Les seuls UUID synthétiques du run sont nettoyés, puis absence Auth/profils vérifiée. Les anciennes invitations natives/capture SMTP restent des régressions distinctes ; leur succès ne prouve pas le parcours manuel. Docker absent sur le poste : essais réels NON EXÉCUTÉS localement, preuve à contrôler en CI sur la dernière tête, jamais redirection vers DEV.

## Choisir le bon niveau

Le lot **6.5.3.B** documente une [copie native Free](deploiement/SAUVEGARDE-TECHNIQUE-SUPABASE-FREE.md) et un [runbook DEV](deploiement/RUNBOOK-MIGRATION-DEV-6-5-3B.md) sous A/B. Le [rapport du 29 octobre](validations/EXECUTION-LOT6-5-3B-2026-10-29.md) consigne la restauration applicative privée réellement exécutée avec PostgreSQL 17.11 et la migration unique hébergée. Les [catalogues](../scripts/verification-dev/catalogue.sql) et [privilèges](../scripts/verification-dev/privileges.sql) lisent seulement des métadonnées en transaction read only, sans choisir la connexion ; ils ne valident pas le comportement JWT/RLS. La dépendance Auth factice de l’essai natif ne remplace pas une stack Supabase. Docker absent sur ce poste : suites locales Auth/JWT/RLS complètes non exécutées ici, elles restent dans le job synthétique supabase-security. Aucun runner destructif redirigé vers DEV, aucune copie réelle dans CI ; les trois checks et leurs optimisations sont préservés. La recette connectée attend un mandat distinct.

Le lot **6.5.2** est un [audit DEV en lecture seule](validations/AUDIT-SUPABASE-DEV-LOT6-5-2.md), accompagné d'un [plan de recette hébergée futur](deploiement/PLAN-RECETTE-DEV.md). Ses lectures de catalogues/configuration ne prouvent pas les refus API ou la séparation A/B. Aucun runner existant ne doit être redirigé vers DEV : sa future recette demandera un mandat distinct, des comptes fictifs propres au run, des envois et nettoyages ciblés explicitement autorisés. Les trois jobs actuels, leurs noms et optimisations #20 restent inchangés ; `supabase-security` conserve exclusivement sa stack éphémère. [Validation et limites 6.5.2](validations/VALIDATION-LOT6-5-2.md).

Le lot **6.4.4** ajoute `privacy-recipe.spec.js` : A copie puis retrait ciblé, B retrait pendant copie, D changement de compte/ancien callback, E timeout HTTP natif de 15 s et réponse tardive. Le temps pédagogique utilise l'horloge contrôlée ; l'expiration réseau est observée réellement, sans délai arbitraire ajouté. `erasure-service.test.js` complète B avec un transport ignorant l'annulation et D avec un aperçu A→B→A différé. `retention-plan.test.js` refuse les pseudo-validations textuelles/numériques et les règles incomplètes, sans durée active ni effaceur.

`privacy-artifact.spec.js` parcourt tous les HTML racine du vrai artefact sous `/mon-bprea/` en contextes vierges séparés ; présence d'`index.html` exigée pour éviter une recette vide. Il inventorie requêtes externes, cookies/Set-Cookie, clés locales (sans valeurs), IndexedDB, Cache API, service workers et liens tiers sans les ouvrir. Deux callbacks synthétiques montrent la query initiale puis son retrait ; `q` ordinaire reste distinct. Rapport minimisé ignoré sous `.tmp/privacy-recipe/`, pas preuve du réseau/CDN hébergé ni exemption juridique. Captures du message de confirmation périmée uniquement synthétiques, 1280/390 clair/sombre. Les traces/vidéos/captures d'échec de ces recettes restent désactivées.

Commandes ciblées : `npm test -- tests/integration/erasure-service.test.js tests/unit/retention-plan.test.js`, puis `npm run test:e2e -- tests/e2e/privacy-recipe.spec.js tests/e2e/privacy-artifact.spec.js --workers=2`. Avant livraison : `npm test` puis `npm run test:e2e`, SDK reconstruit sans diff et trois checks sur la tête finale. [Validation 6.4.4](validations/VALIDATION-LOT6-4-4.md), [matrice des preuves](rgpd/MATRICE-CONFORMITE-ET-PREUVES.md).

La recette Supabase existante est renforcée sans retirer de parcours ni d'assertion pgTAP : export réel puis effacement local/serveur inchangé dans `export.spec.js`, copie réelle avant clôture dans `closure.spec.js`. Ce dernier exige aussi que le JWT résiduel soit temporellement encore valide, que les SELECT soient acceptés vides et que les nouvelles écritures échouent avec des codes SQL/FK, plutôt qu'un simple refus de JWT expiré. Les 386 assertions pgTAP et 26 parcours réels restent dans la stack éphémère dédiée, avec les runners Auth/Drill/personnel antérieurs. Aucun runner ne doit viser DEV/PROD ; Docker absent sur le poste implique une preuve réelle exclusivement par CI éphémère, à consigner avec SHA/jobs.

Le lot **6.4.3** ajoute `erasure-service` (transactions fake-indexeddb isolées, A/B/projets/environnements, rollback après DELETE, verrou/version bloquée, ancien client v1, réponse tardive/export invalidé), `closure-handler` et `closure-client` (autorisation, schéma fermé, preuve native liée, reprise et échecs), `retention-plan` (projet JSON refusé, règles complètes et horloge fictive). `tests/e2e/erasure.spec.js` contrôle les vrais records Chromium, choix/annulation/focus, visiteur/provenance, sélection ITK, deux onglets, réseau simulé, session et état partiel. Traces/vidéos/captures automatiques d'échec désactivées ; captures visuelles seulement synthétiques sous `.tmp/erasure-visual/`.

Commandes ciblées : `npm test -- tests/integration/erasure-service.test.js tests/unit/closure-handler.test.js tests/unit/closure-client.test.js tests/unit/retention-plan.test.js`, puis `npm run test:e2e -- tests/e2e/erasure.spec.js --workers=2`. La version de **base** IndexedDB est désormais 2 (store `privacy` ajouté), le document `accounts` reste v1 : les helpers d'inspection ouvrent la version existante sans forcer v1. Aucun contenu ni assertion métier antérieurs retirés. Un parcours de régression dans `critical-paths.spec.js` retarde la sauvegarde d’un choix Drill et vérifie le maintien du focus du bouton, la validation clavier et la réponse réellement persistée.

Le job `supabase-security` garde ses branches d'exécution optimisées #20 et les 350 assertions SQL de référence, ajoute [closure.test.sql](../supabase/tests/database/closure.test.sql), puis sert l'Edge Function **localement**, sans `deploy`, avec une clé de capacité générée dans un fichier `.env` ignoré. `tests/e2e-supabase/closure.spec.js` peuple les dix tables, préserve B, tente les attaques croisées et une double soumission réelle, perd un acquittement réel puis vérifie la reprise, les anciennes RPC/JWT et l'outbox d'un appareil hors ligne. Le refus du JWT réellement expiré par la fonction est ajouté à l'attente d'expiration Auth existante, sans attente globale supplémentaire. La présence de ces tests n'est pas une preuve d'exécution : voir [VALIDATION-LOT6-4-3](validations/VALIDATION-LOT6-4-3.md).

Pour reproduire **uniquement dans la stack dédiée avec comptes fictifs**, après chargement des clés locales : `node --env-file-if-exists=.env.supabase-test.local scripts/prepare-closure-local.mjs`, puis, dans un terminal local, `npx --yes supabase@2.121.0 functions serve --env-file .env.closure-test.local`. Un second terminal peut lancer `npm run test:e2e:supabase -- tests/e2e-supabase/closure.spec.js`. Le service refuse les URLs hébergées, et les helpers refusent un autre projet/endpoint. Ne jamais copier une clé administrative dans le navigateur, publier les fichiers `.env` ou tester sur un compte étudiant. Pour le formulaire local, le helper ajoute seulement `accountClosureLocalTest:true` à la configuration publique simulée ; `prepare-pages.py` continue de refuser ce champ supplémentaire et le défaut publié reste désactivé.

Le lot 6.4.2 ajoute `export-model`, `export-transport` et `export-service` (projection de confidentialité, lecture readonly, pagination et générations), six parcours dans `tests/e2e/export.spec.js` et une recette `tests/e2e-supabase/export.spec.js`. Les JSON téléchargés sont réellement parsés ; le parcours pseudo conserve son assertion exacte dans la région Compte personnel, séparée des nouveaux statuts de copie. Les traces/vidéos et captures d'échec sont désactivées pour ces nouvelles copies afin de ne pas journaliser leur contenu ; seules les captures visuelles synthétiques sous `.tmp/export-visual/` servent à l'inspection locale. Aucun fichier exporté réel dans Git/Pages. La [validation 6.4.2](validations/VALIDATION-LOT6-4-2.md) distingue HTTP simulé et RLS réel. Commandes ciblées : `npm test -- tests/unit/export-model.test.js tests/unit/export-transport.test.js tests/integration/export-service.test.js`, puis `npm run test:e2e -- tests/e2e/export.spec.js --workers=2`.

Pendant le développement, lancer la suite liée au risque modifié ; la validation complète n’est pas nécessaire après chaque petite modification. Depuis la racine, après `npm ci` :

| Besoin | Commande ciblée |
| --- | --- |
| Vitest, fichier et cas précis | `npm test -- tests/unit/settings-model.test.js -t "apparence"` |
| Vitest Auth avec mocks (aucune preuve RLS) | `npm test -- tests/unit/auth-service.test.js tests/unit/auth-local-identity.test.js tests/integration/drill-auth-recovery.test.js` |
| Playwright classique, fichier | `npm run test:e2e -- tests/e2e/settings-sync.spec.js --workers=2` |
| Playwright classique, cas et répétitions | `npm run test:e2e -- tests/e2e/settings-sync.spec.js --grep "panne API" --repeat-each=3 --workers=2` |
| Playwright Auth sans stack (configuration désactivée) | `npm run test:e2e -- tests/e2e/auth.spec.js` |
| HTTP synthétique Auth/SDK/IndexedDB | `npm run test:e2e -- tests/e2e/settings-sync.spec.js --grep "comptes"` |
| Validation locale complète | `npm test` puis `npm run test:e2e` puis `npm run build:auth-sdk` et `git diff --exit-code -- assets/vendor/supabase.js` |
| Auth réel ciblé, stack locale préparée | `npm run test:supabase` |
| Navigateur Supabase réel ciblé | `npm run test:e2e:supabase -- tests/e2e-supabase/settings-sync.spec.js` |

La sélection Vitest par titre doit afficher au moins un test exécuté : adapter `-t` au nom réel du cas. Les tests classiques peuvent contrôler l’horloge et simuler HTTP. Les tests Auth réels conservent le temps réel et des JWT signés par Auth, y compris leur expiration après la tolérance PostgREST.

La recette réelle complète exige Docker, la CLI 2.121.0 et la configuration locale décrite plus bas. Après démarrage de la stack et chargement des seules clés locales :

```bash
npx --yes supabase@2.121.0 test db
npm run test:supabase
npm run test:drill:supabase
npm run test:personal:supabase
npm run test:e2e:supabase
```

La CI exécute les mêmes suites avec `node scripts/test-supabase-ci.mjs` après pgTAP. Pour reproduire ce chevauchement localement, utiliser `node --env-file-if-exists=.env.supabase-test.local scripts/test-supabase-ci.mjs`. Auth tourne à côté de la chaîne Drill → données personnelles → installation/validation Chromium → E2E Supabase (un worker). Chaque processus crée ses propres UUID/adresses ; aucun compte n’est partagé. L’orchestrateur rejoint les deux branches, même en cas d’échec, pour laisser finir les nettoyages ciblés avant l’arrêt de la stack. Les durées et codes de sortie sont consignés sans sessions ni clés. Le workflow conserve son arrêt `always()`, y compris lors d’une annulation ou d’un timeout ; dans ces derniers cas, la CI ne revendique pas un nettoyage applicatif terminé.

Les helpers de `tests/helpers/personal-browser.js` attendent l’identité publiée par le vrai singleton versionné et les lectures IndexedDB jusqu’à `transaction.oncomplete`. `waitForPersistedOperation` vérifie le propriétaire du cache et les champs de l’opération attendue avant un reload/retry. `settingsCacheReady` attend le mode personnel, l’UUID et l’absence d’erreur de vue. Conserver les assertions métier, d’unicité et les relectures PostgreSQL après ces attentes ; un état « synchronisé » seul ne prouve pas le contenu serveur. Aucun `waitForTimeout`, retry global ou mock supplémentaire dans les suites réelles.

Les trois contrôles `unit-integration`, `e2e` et `supabase-security` restent requis sur la PR finale. Les mesures, risques et limites sont dans [VALIDATION-OPTIMISATION-CI.md](validations/VALIDATION-OPTIMISATION-CI.md).

Le lot 6.3.4 ajoute les suites `settings-*` pour les deux singletons ITK/apparence : validation du catalogue et des préférences, transactions et rechargement, chaînage CAS, retry exact, import par domaine et isolement Auth. `settings-appearance.test.js` exerce le vrai script classique avant CSS, la séparation choix/rendu, les saisons, seuils et changements d’heure. Les parcours `settings-sync.spec.js` et `personal-space.spec.js` complètent la recette dans Chromium ; ceux sous `tests/e2e-supabase/` utilisent exclusivement la stack éphémère et des assertions PostgreSQL avec JWT étudiant. Les mocks HTTP et captures autonomes restent distincts de la preuve Auth/RLS réelle. Consulter la [validation 6.3.4](validations/VALIDATION-LOT6-3-4.md) et le [bilan 6.3](validations/BILAN-LOT6-3.md) pour les résultats exécutés et les limites.

Le lot 6.3.3 ajoute les suites `botanical-sync-model`, `botanical-personal-store`, `botanical-sync-service`, `botanical-sync-transport` et les parcours `botanical-sync.spec.js` autonomes et Supabase réels. Elles vérifient transactions atomiques, dépendances création/réponses/fin, identités et CAS, pagination, provenance d’import, archives et isolation A/B. Les captures de `tests/e2e/` utilisent un transport HTTP synthétique et le vrai IndexedDB Chromium ; elles ne valident pas RLS. Les six parcours A–F de `tests/e2e-supabase/` utilisent exclusivement les comptes fictifs, JWT et PostgreSQL de la stack éphémère du job `supabase-security`. Les [preuves réellement exécutées](validations/VALIDATION-LOT6-3-3.md) et le [contrat client](architecture/BOTANICAL-SYNCHRONISATION-CLIENT.md) précisent les limites. Le moteur et les suites botaniques visiteur existants restent conservés.

Le lot 6.2.3 ajoute `tests/integration/dashboard-data.test.js` (projection du vrai service Drill dans les statistiques, identité et cache isolés), `tests/e2e/dashboard-sync.spec.js` (rendu et interactions avec un service synthétique, sans preuve Auth/RLS) et `tests/e2e-supabase/dashboard-sync.spec.js` (deux contextes du même compte, reprise réseau, conflits et isolation avec le vrai Supabase local). Cette dernière suite reste incluse dans `supabase-security`, sans utiliser DEV ni PROD. Les résultats exécutés figurent dans [VALIDATION-LOT6-2-3.md](validations/VALIDATION-LOT6-2-3.md).

| Outil | Rôle | Limite |
| --- | --- | --- |
| Vitest — `tests/unit/` | Fonctions de calcul, dates, sélection et normalisation, en important le vrai code du site. | Ne vérifie pas le rendu du navigateur. |
| Vitest — `tests/integration/` | Lecture/écriture du stockage et cohérence Drill/Tableau de bord ; environnement DOM simulé quand nécessaire. | Stockage et environnement isolés, sans progression personnelle. |
| Playwright Test — `tests/e2e/` | Parcours reproductibles dans Chromium, avec serveur local et contextes isolés. | Première suite ciblée ; tous les navigateurs et toutes les interactions ne sont pas couverts. |
| Supabase CLI — `supabase/tests/database/` | pgTAP sur un vrai PostgreSQL : RLS activée, grants et fonctions privées. | Les contrôles structurels ne remplacent pas les requêtes avec sessions A/B. |
| Node.js — `scripts/test-supabase.mjs` | Auth, capture SMTP, profils et RLS réels avec deux utilisateurs fictifs et un visiteur. | Exige Docker et la stack Supabase locale dédiée ; refuse les projets hébergés. |
| Playwright — `tests/e2e-supabase/` | Activation et récupération dans le navigateur avec Supabase local et mails capturés réels. | Suite séparée nécessitant la stack réelle, sans comptes étudiants. |
| Playwright MCP | Exploration et contrôle visuel manuel par Codex. | Une session manuelle n’est pas une suite Playwright Test exécutée en CI. |

Les fixtures de `tests/fixtures/` sont synthétiques ou issues de la banque publique. Elles doivent garder des identifiants stables, des dates explicites et des résultats prévisibles. Elles ne doivent contenir aucune donnée personnelle. Les dépendances restent des outils de développement, sans import depuis le code public.

## Déterminisme et isolation

Fixer l’instant dans chaque test dépendant du temps, puis restaurer l’horloge. Distinguer la date civile Europe/Paris (Drill, anecdote), l’heure locale du navigateur (apparence) et les dates civiles des événements. Couvrir les transitions pertinentes : lundi à minuit Paris, changement d’année ISO, passages heure d’été/hiver, mois et année du calendrier. Ne pas remplacer ces cas par la date réelle de la machine.

Les tests de stockage préparent leur propre état, vérifient les valeurs persistées et simulent une nouvelle lecture. Ils doivent préserver les données inconnues et les anciennes clés. Une série non réalisée ne crée pas d’erreur ; une nouvelle tentative d’entraînement ne remplace pas la première réponse. Les tests du Dashboard doivent vérifier la concordance avec les mêmes réponses Drill et un taux global pondéré par le nombre de réponses.

Chaque scénario E2E utilise un contexte de navigateur isolé. Préparer explicitement le stockage avant d’ouvrir l’application lorsque le scénario exige des résultats, et utiliser un contexte vide pour vérifier l’absence de statistiques inventées. Les tests ne doivent jamais viser GitHub Pages ni effacer le profil réel du navigateur de l’utilisateur. Les ressources externes ne doivent pas être nécessaires à la réussite des parcours ; vérifier les PDF déjà présents dans le dépôt.

Le serveur de test sert le dépôt local et prépare automatiquement un artefact sous le préfixe représentatif `/mon-bprea/`. Un contrôle sous ce préfixe vérifie pages, imports, JSON, styles et PDF, avec les références `?v=e2e-lot5-1`. Pour une inspection manuelle distincte, la préparation d’un artefact versionné reste décrite dans [architecture/CACHE.md](architecture/CACHE.md) : utiliser un dossier temporaire neuf, car le script refuse d’écraser une sortie non vide. Les tests ne remplacent pas une inspection de l’artefact final.

## Ajouter un test utile

1. Identifier le risque fonctionnel et le résultat observable : calcul, donnée conservée ou parcours bloqué.
2. Importer la fonction réellement appelée par le site. Si elle dépend du DOM sans nécessité, extraire seulement la partie requise et faire utiliser cette fonction par l’interface. Ne pas recopier une formule dans le test.
3. Choisir `tests/unit/`, `tests/integration/` ou `tests/e2e/`, puis préparer un jeu de données minimal. Pour un défaut corrigé, faire porter le cas sur le comportement qui échouait.
4. Vérifier des attentes explicites : totaux, absence de résultat sans données, structure préservée ou correction visible. Éviter les assertions qui se limitent à confirmer la structure du code.
5. Exécuter la commande concernée puis les suites pertinentes avant la PR. Actualiser la documentation si une règle métier change dans un futur lot autorisé.

Pour les E2E, privilégier les rôles, noms accessibles, libellés et liens stables. Attendre un état visible ou une réponse réseau pertinente ; ne pas ajouter de délai arbitraire pour masquer une course. Garder la suite courte et stable. En cas d’échec, inspecter la capture et la trace avant de modifier le scénario : l’erreur peut provenir de l’application.

Les rapports et artefacts de Playwright sont placés dans `playwright-report/` et `test-results/`, ignorés par Git. Une trace disponible peut être ouverte avec `npx playwright show-trace chemin/vers/trace.zip` ; un rapport HTML avec `npx playwright show-report`. Ces éléments servent au diagnostic et ne sont pas publiés sur le site.

## Authentification : tests applicatifs et sécurité réelle

Les tests unitaires Auth importent les vrais modules de validation, de configuration et de service, avec un client Supabase simulé. Ils vérifient les champs, états, erreurs compréhensibles, restauration, réponses incohérentes et déconnexion sans modifier les préférences pédagogiques. Les mocks Auth restent réservés à ces unités. `tests/e2e/auth.spec.js` exerce le défaut réellement désactivé du dépôt, les pages publiques, l’absence de données privées et d’inscription libre, le nettoyage des liens, le mobile et les préférences, sans simuler de réponse Supabase. **Cette suite autonome ne fait tourner ni Supabase Auth ni PostgreSQL et ne prouve pas RLS.** Les parcours avec compte connecté, invitation et récupération utilisent la suite distincte reliée au vrai Supabase local.

Les commandes habituelles restent autonomes, sans clé ou service Supabase :

```bash
npm ci
npx playwright install chromium
npm test
npm run test:e2e
```

Le SDK versionné provient de `@supabase/supabase-js` 2.118.0, préparé avec esbuild 0.28.2 par `npm run build:auth-sdk`. Le reconstruire lors d’un changement volontaire du SDK, puis vérifier manifeste, verrou et fichier généré ensemble. Les ressources publiques n’exigent pas d’installation npm chez l’étudiant.

Pour exercer la sécurité réelle, démarrer **uniquement** la stack `mon-bprea-lot6-1-local`, avec Docker disponible et les ports locaux libres. Les commandes de référence utilisent la même CLI 2.121.0 que la CI :

```bash
npx --yes supabase@2.121.0 start
npx --yes supabase@2.121.0 migration up --local
npx --yes supabase@2.121.0 test db
```

Ne pas relancer `supabase init` : la configuration et les migrations sont déjà versionnées. Ne pas réinitialiser une base contenant des données à conserver. `supabase/config.toml` réserve les expirations JWT 120 secondes et OTP 60 secondes aux vérifications locales ; ces durées ne doivent pas être reportées telles quelles en production.

Copier `supabase/tests/.env.example` dans `.env.supabase-test.local` à la racine, puis remplir les clés **de cette stack locale** obtenues via `npx --yes supabase@2.121.0 status`. Le fichier privé est ignoré par Git. Garder la sortie des commandes et les clés hors des journaux partagés. Conserver la confirmation de projet et les endpoints locaux du modèle ; les clés d’un projet hébergé, même DEV, ne sont jamais admises par le runner. Une clé administrative locale n’est utilisée que pour créer les invitations natives et supprimer les seuls comptes fictifs créés pendant cette exécution.

```powershell
Copy-Item -LiteralPath supabase/tests/.env.example -Destination .env.supabase-test.local
```

Une fois les valeurs renseignées :

```bash
npm run test:supabase
npm run test:drill:supabase
npm run test:e2e:supabase
```

Le lot 6.2.1 ajoute `scripts/test-drill-supabase.mjs`, exécuté par `npm run test:drill:supabase` et dans le même job `supabase-security`. Il réutilise les gardes strictes de la stack locale et deux invitations Auth fictives ; ses requêtes étudiantes emploient de vrais JWT et la clé publishable. Il vérifie les snapshots, les privilèges, les opérations idempotentes, l'immutabilité, RLS A/B et les écritures réellement concurrentes par PostgREST, puis relit les lignes gagnantes. Les tests pgTAP complémentaires restent distincts de ceux des profils. Le [contrat backend](architecture/DRILL-SYNCHRONISATION-BACKEND.md) et la [validation du lot](validations/VALIDATION-LOT6-2-1.md) précisent le périmètre et les résultats exécutés. Aucun de ces runners ne peut viser un projet hébergé, même DEV.

Le runner de sécurité vérifie les lectures A/B, l’accès anonyme, les UUID arbitraires, le pseudo propre, le refus de modification des autres profils et colonnes techniques, les contraintes, les métadonnées falsifiées, un JWT falsifié et une session invalide. Il exerce aussi le refus d’inscription directe, les invitations natives, les mails capturés, l’activation depuis un contexte neuf, les liens invalides/réutilisés, la récupération et le refresh après déconnexion. L’expiration est réellement attendue avec les durées locales ; réserver plusieurs minutes et ne pas remplacer cette preuve par une horloge JavaScript simulée. Les requêtes étudiant utilisent leurs vrais jetons, jamais la clé administrative.

Les E2E dédiés utilisent `playwright.supabase.config.js` et la même stack locale. Ils complètent le runner par le parcours du navigateur et les e-mails capturés. Les journaux et captures d’un parcours réel peuvent contenir des liens sensibles : ne pas les publier ni conserver des traces contenant des jetons. Aucun test ne doit utiliser un navigateur personnel, une adresse étudiante, le site publié ou une base de production. Ne pas supprimer globalement les comptes ou les messages de la capture SMTP pour préparer un scénario.

Si Docker, la CLI, les clés locales ou les services requis manquent, la sécurité réelle reste **non exécutée / non validée** ; noter le blocage dans la validation. Des suites Vitest/Playwright simulées réussies ne changent pas cet état. Le critère d’acceptation exige les preuves réelles d’invitation, récupération, refus d’inscription et isolation A/B avant toute ouverture.

## Backend des données personnelles (lot 6.3.1)

Le [contrat personnel](architecture/PERSONAL-DATA-BACKEND.md) et la [validation du lot](validations/VALIDATION-LOT6-3-1.md) couvrent les six nouvelles tables. `personal_data_backend.test.sql` complète les tests pgTAP profils/Drill. Sur la même stack locale dédiée seulement, exécuter aussi :

```bash
npm run test:personal:supabase
```

Ce runner réutilise les gardes `auth-local`, les invitations fictives capturées localement et de vrais JWT/PostgREST. Il vérifie l'isolation A/B, les privilèges directs, les données invalides, les retries, le décochage d'un cours, les historiques immuables, la complétion botanique et les courses de révision ITK/apparence/cours/sessions. Les fixtures `tests/fixtures/personal-data.js` représentent les formats audités et ne contiennent pas de donnée étudiante. Le job `supabase-security` l'exécute sans remplacer les tests antérieurs. L'absence de Docker ou de configuration locale reste une non-exécution, jamais une réussite déduite de tests frontend.

## Cours et QCM personnels (lot 6.3.2)

Les suites `course-quiz-*` vérifient le modèle réellement utilisé par le site, le cache IndexedDB transactionnel, les dépendances de cours, les UUID de tentatives, les manifestes d’import, le transport paginé et les générations Auth. `fake-indexeddb` isole les données et permet de vérifier l’annulation d’une transaction ; il ne démontre pas la sécurité RLS.

`tests/e2e/course-quiz-sync.spec.js` exerce les écrans avec HTTP simulé et des contextes Chromium isolés. `tests/e2e-supabase/course-quiz-sync.spec.js` utilise exclusivement les comptes fictifs et endpoints gardés par `auth-local.js`, les vrais JWT, les RPC et PostgreSQL de la stack éphémère. La perte d’acquittement y suit `route.fetch()` réel ; une assertion SELECT avec le JWT étudiant vérifie l’unicité après retry. Les scénarios couvrent deux appareils, décochage, meilleur score, isolation A/B, outbox rechargée, conflit CAS indépendant d’une tentative parfaite et import volontaire sans doublon.

Les runners SQL/Node des lots précédents restent présents et exécutés par `supabase-security`. L’absence de Docker ou de configuration locale interdit une validation locale réelle et doit être consignée. Voir [architecture client](architecture/COURSE-QUIZ-SYNCHRONISATION-CLIENT.md) et [validation](validations/VALIDATION-LOT6-3-2.md).

## CI et protection de `main`

Le workflow **Qualité**, défini dans `.github/workflows/quality.yml`, s’exécute sur les pull requests vers `main`, à l’ouverture et à chaque nouveau commit. Ses deux jobs sont `unit-integration` et `e2e`. Ils utilisent Node.js 24 LTS, `npm ci` et le cache npm ; le second installe Chromium et conserve les artefacts utiles en cas d’échec. Les permissions se limitent à la lecture du dépôt, sans secret de production. Ce workflow ne déploie pas.

Le workflow de publication `Publier le site BPREA` reste distinct. Une poussée vers `main` ou un lancement manuel de ce workflow peut publier : obtenir l’accord de l’utilisateur avant fusion ou déploiement. La préparation Pages ne doit pas inclure `node_modules/`, `tests/`, les rapports, les fichiers de configuration des outils ou `docs/`.

Pour rendre les vérifications obligatoires **après accord de l’utilisateur** :

1. Laisser le workflow Qualité s’exécuter sur une PR afin que les noms de checks soient disponibles dans GitHub.
2. Ouvrir **Settings → Rules → Rulesets** (ou la protection classique de branche) et cibler `main`.
3. Activer l’exigence d’une pull request et de checks réussis avant fusion ; sélectionner les checks `unit-integration` et `e2e` du workflow Qualité, avec leurs noms exacts affichés par GitHub.
4. Selon la politique choisie, exiger une branche à jour et une revue, puis vérifier la disponibilité de ces options pour le dépôt et son offre GitHub.
5. Enregistrer uniquement après validation explicite de la modification des protections. Ne pas configurer de fusion automatique.

Ce document prépare la procédure ; il ne modifie aucun réglage distant et ne prouve pas que les checks ont déjà été exécutés sur GitHub.

Le ruleset actif sur `main`, relu le 24 octobre 2026, exige les trois contrôles `unit-integration`, `e2e` et `supabase-security` : conserver leurs noms exacts. Cette lecture ne modifie aucune protection. Le registre [ACTIONS-NODE24.md](architecture/ACTIONS-NODE24.md) donne les versions vérifiées et la conservation explicite de `.nojekyll` dans l’artefact Pages.

Le workflow supplémentaire **Sécurité Auth et RLS**, `.github/workflows/auth-security.yml`, conserve le job distinct `supabase-security`. Il s’exécute sur toutes les PR vers `main`, y compris les PR documentaires, sans filtre de chemins. Il démarre une stack Docker éphémère, charge uniquement ses clés locales, exécute pgTAP, les tests réels de sécurité Auth et Drill ainsi que les parcours navigateur dédiés, puis arrête cette stack. Il n’exige aucun secret de production et ne publie pas les sorties CLI contenant des clés. La présence du workflow ne constitue pas un résultat d’exécution : contrôler son statut sur la PR et consigner ce qui a réellement été vérifié. Ce lot ne modifie ni le ruleset ni les noms des checks.

## Avant une pull request

Le lot 6.2.2 ajoute les suites Vitest `drill-personal-store`, `drill-sync-service`, `drill-sync-model`, `drill-sync-transport` et `auth-local-identity`. `fake-indexeddb` est réservé aux tests des transactions et de la concurrence locale. Les E2E `tests/e2e-supabase/drill-sync.spec.js` utilisent le vrai IndexedDB Chromium, les vrais JWT et PostgreSQL locaux pour les parcours multi-appareils, les conflits et les pannes. La perte d'acquittement est produite après `route.fetch()` réel, sans remplacer la réponse métier par un mock. Le [guide client](architecture/DRILL-SYNCHRONISATION-CLIENT.md) et la [validation du lot](validations/VALIDATION-LOT6-2-2.md) détaillent les frontières et preuves.

Exécuter les suites, vérifier visuellement les pages touchées sur ordinateur et mobile, conserver le mode sombre et les préférences, contrôler les chemins relatifs et l’artefact Pages. Vérifier que les clés locales et historiques restent intacts, que les fichiers générés sont ignorés et qu’aucun secret n’est suivi. Résumer les résultats réels et les limites dans la validation du lot ; ne pas présenter une vérification impossible comme réussie.

La priorité porte sur les calculs, la persistance et les transitions calendaires. Aucun seuil global de couverture n’est imposé ; une mesure éventuelle est informative et doit préciser son périmètre ainsi que les zones critiques non couvertes.

Références officielles : [installation et configuration de Vitest](https://vitest.dev/guide/), [serveur local Playwright Test](https://playwright.dev/docs/test-webserver), [configuration de Playwright en CI](https://playwright.dev/docs/ci-intro).
