# Développement et stratégie de tests

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

`tests/vitest.config.js` sélectionne les suites unitaires et d’intégration ; `tests/playwright.config.js` configure Chromium, les artefacts d’échec et le serveur `scripts/test-server.mjs`. Celui-ci utilise `http://127.0.0.1:4173/` pour les sources et `/mon-bprea/` pour un artefact préparé avec la version `e2e-lot5-1`. Python 3.10 ou plus récent doit donc être disponible sous la commande `python` (ou via la variable d’environnement `PYTHON`). Le port 4173 doit être libre ; aucun serveur préexistant n’est réutilisé. Aucune URL distante de remplacement n’est prévue.

## Choisir le bon niveau

Pendant le développement, exécuter la suite liée au risque modifié. Réserver les contrôles complets aux changements transversaux, de sécurité, de publication ou à la qualification finale d’une release. Une modification documentaire seule appelle une relecture, le contrôle des liens et `git diff --check`.

| Besoin | Commande |
| --- | --- |
| Unité ou intégration ciblée | `npm test -- tests/unit/settings-model.test.js -t "apparence"` |
| Parcours navigateur ciblé | `npm run test:e2e -- tests/e2e/critical-paths.spec.js --workers=2` |
| Répéter un scénario observé | `npm run test:e2e -- tests/e2e/settings-sync.spec.js --grep "panne API" --repeat-each=3 --workers=2` |
| Auth désactivée, sans stack | `npm run test:e2e -- tests/e2e/auth.spec.js` |
| Validation locale complète | `npm test`, puis `npm run test:e2e`, puis `npm run build:auth-sdk` et `git diff --exit-code -- assets/vendor/supabase.js` |
| Fin de livraison locale vérifiée, processus arrêtés | `npm run delivery:complete` |

La sélection par titre doit afficher au moins un test exécuté. Les tests Vitest vérifient calculs et persistance dans `tests/unit/` et `tests/integration/`. Les parcours Chromium autonomes sont dans `tests/e2e/`, les fixtures synthétiques dans `tests/fixtures/` et les helpers partagés dans `tests/helpers/`. Les suites utilisant HTTP simulé ou fake-indexeddb ne prouvent pas Auth/RLS. Playwright MCP reste une exploration et une vérification visuelle manuelle distincte de la suite CI.

La maintenance utilise des répertoires synthétiques dans `tests/integration/tmp-maintenance.test.js`. `npm run maintenance:tmp` simule sans supprimer ; `maintenance:tmp:clean` et `delivery:complete` appliquent la liste blanche et les gardes de processus. Ne pas lancer le nettoyage pendant les tests. Un refus de garde, une preuve protégée ou un dépassement de plafond reste à signaler. Voir la [politique de maintenance](developpement/MAINTENANCE-DOSSIER-TMP.md).

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
npm run test:personal:supabase
npm run test:e2e:supabase
```

`scripts/test-drill-supabase.mjs` est exécuté par `npm run test:drill:supabase` et dans le même job `supabase-security`. Il réutilise les gardes strictes de la stack locale et deux invitations Auth fictives ; ses requêtes étudiantes emploient de vrais JWT et la clé publishable. Il vérifie les snapshots, les privilèges, les opérations idempotentes, l'immutabilité, RLS A/B et les écritures réellement concurrentes par PostgREST, puis relit les lignes gagnantes. Les tests pgTAP complémentaires restent distincts de ceux des profils. Le [contrat backend](architecture/DRILL-SYNCHRONISATION-BACKEND.md) et la [validation du lot](archives/validations/VALIDATION-LOT6-2-1.md) précisent le périmètre et les résultats exécutés. Aucun de ces runners ne peut viser un projet hébergé, même DEV.

Le runner de sécurité vérifie les lectures A/B, l’accès anonyme, les UUID arbitraires, le pseudo propre, le refus de modification des autres profils et colonnes techniques, les contraintes, les métadonnées falsifiées, un JWT falsifié et une session invalide. Il exerce aussi le refus d’inscription directe, les invitations natives, les mails capturés, l’activation depuis un contexte neuf, les liens invalides/réutilisés, la récupération et le refresh après déconnexion. L’expiration est réellement attendue avec les durées locales ; réserver plusieurs minutes et ne pas remplacer cette preuve par une horloge JavaScript simulée. Les requêtes étudiant utilisent leurs vrais jetons, jamais la clé administrative.

Les E2E dédiés utilisent `tests/playwright.supabase.config.js` et la même stack locale. Ils complètent le runner par le parcours du navigateur et les e-mails capturés. Les journaux et captures d’un parcours réel peuvent contenir des liens sensibles : ne pas les publier ni conserver des traces contenant des jetons. Aucun test ne doit utiliser un navigateur personnel, une adresse étudiante, le site publié ou une base de production. Ne pas supprimer globalement les comptes ou les messages de la capture SMTP pour préparer un scénario.

Si Docker, la CLI, les clés locales ou les services requis manquent, la sécurité réelle reste **non exécutée / non validée** ; noter le blocage dans la validation. Des suites Vitest/Playwright simulées réussies ne changent pas cet état. Le critère d’acceptation exige les preuves réelles d’invitation, récupération, refus d’inscription et isolation A/B avant toute ouverture.

Le runner personnel vérifie également les six tables du [contrat backend personnel](architecture/PERSONAL-DATA-BACKEND.md), les privilèges directs, les données invalides, l’idempotence, les historiques immuables et les conflits de révision. Les tests navigateur relisent les vrais enregistrements IndexedDB jusqu’à `transaction.oncomplete`, puis les données serveur avec les JWT étudiants : un simple statut « synchronisé » ne prouve pas le contenu persistant.

La clôture locale est préparée par `node --env-file-if-exists=.env.supabase-test.local scripts/prepare-closure-local.mjs`, puis `npx --yes supabase@2.121.0 functions serve --env-file .env.closure-test.local` dans un terminal dédié. Les tests concernés restent exclusivement locaux et les fichiers `.env` restent ignorés. La recette complète et l’ordre des branches sont exécutés en CI avec `node scripts/test-supabase-ci.mjs` après pgTAP. L’orchestrateur attend la fin des nettoyages de ses deux branches, même en cas d’échec, avant l’arrêt de la stack ; le workflow conserve sa garde `always()`.

## CI et protection de `main`

Le workflow [Qualité](../.github/workflows/quality.yml) exécute `unit-integration` et `e2e` sur les PR vers `main`. Le workflow distinct [Sécurité Auth et RLS](../.github/workflows/auth-security.yml) exécute `supabase-security`, y compris pour les PR documentaires : stack Docker éphémère, pgTAP, runners réels et parcours navigateur, puis arrêt de la stack. Ils utilisent Node.js 24 LTS et `npm ci`, sans secret de production ni déploiement.

Conserver les noms des trois checks. Vérifier leur résultat sur le dernier commit de la PR ; une réussite historique ne valide pas la tête courante. Le [registre des Actions](architecture/ACTIONS-NODE24.md) décrit les versions utilisées. Ne modifier ni protection de `main` ni fusion automatique sans autorisation.

Le workflow [Publier le site BPREA](../.github/workflows/deploy.yml) reste distinct : une poussée sur `main` ou son lancement manuel peut publier. Fusion et déploiement exigent l’accord applicable. La préparation Pages exclut documentation, outils, tests, rapports, caches et configurations locales.

## Avant une pull request

Vérifier les parcours affectés et les données réellement conservées, les chemins relatifs sous `/mon-bprea/`, les pages Auth/callback et l’artefact public si concernés. Pour une interface modifiée, contrôler ordinateur/mobile, clavier, mode sombre et préférences. Exécuter les contrôles proportionnés, `git diff --check`, puis `npm run delivery:complete` après l’arrêt des processus concernés.

Résumer les contrôles exécutés, leurs résultats et les limites dans la PR. Déclarer toute vérification impossible avec sa cause. Aucun seuil global de couverture ni nouveau rapport permanent n’est imposé pour une petite correction.

Les preuves anciennes restent dans [les archives de validations](archives/validations/) ; les preuves de la campagne en cours dans [validations/](validations/). Elles ne valent pas résultat pour une autre configuration ou un commit ultérieur. L’état de livraison et les seules prochaines actions sont dans la [fiche de reprise](developpement/REPRISE-CODEX.md).
