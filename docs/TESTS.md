# Développement et stratégie de tests

## Installer les outils

Le site reste statique ; Node.js sert uniquement aux vérifications locales et à la CI. Installer **Node.js 24 LTS** et utiliser son npm, puis depuis la racine du dépôt :

```bash
npm ci
npx playwright install chromium
```

Le verrou `package-lock.json` est versionné. Utiliser `npm ci` pour reproduire l’installation ; lors d’un changement volontaire de dépendance de développement, mettre à jour le manifeste et le verrou ensemble. Sous Linux, les bibliothèques système Chromium peuvent être installées avec `npx playwright install --with-deps chromium`, comme en CI. Aucune clé secrète n’est nécessaire.

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

## Choisir le bon niveau

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

Exécuter les suites, vérifier visuellement les pages touchées sur ordinateur et mobile, conserver le mode sombre et les préférences, contrôler les chemins relatifs et l’artefact Pages. Vérifier que les clés locales et historiques restent intacts, que les fichiers générés sont ignorés et qu’aucun secret n’est suivi. Résumer les résultats réels et les limites dans la validation du lot ; ne pas présenter une vérification impossible comme réussie.

La priorité porte sur les calculs, la persistance et les transitions calendaires. Aucun seuil global de couverture n’est imposé ; une mesure éventuelle est informative et doit préciser son périmètre ainsi que les zones critiques non couvertes.

Références officielles : [installation et configuration de Vitest](https://vitest.dev/guide/), [serveur local Playwright Test](https://playwright.dev/docs/test-webserver), [configuration de Playwright en CI](https://playwright.dev/docs/ci-intro).
