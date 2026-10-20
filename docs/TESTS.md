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

## Choisir le bon niveau

| Outil | Rôle | Limite |
| --- | --- | --- |
| Vitest — `tests/unit/` | Fonctions de calcul, dates, sélection et normalisation, en important le vrai code du site. | Ne vérifie pas le rendu du navigateur. |
| Vitest — `tests/integration/` | Lecture/écriture du stockage et cohérence Drill/Tableau de bord ; environnement DOM simulé quand nécessaire. | Stockage et environnement isolés, sans progression personnelle. |
| Playwright Test — `tests/e2e/` | Parcours reproductibles dans Chromium, avec serveur local et contextes isolés. | Première suite ciblée ; tous les navigateurs et toutes les interactions ne sont pas couverts. |
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

## Avant une pull request

Exécuter les suites, vérifier visuellement les pages touchées sur ordinateur et mobile, conserver le mode sombre et les préférences, contrôler les chemins relatifs et l’artefact Pages. Vérifier que les clés locales et historiques restent intacts, que les fichiers générés sont ignorés et qu’aucun secret n’est suivi. Résumer les résultats réels et les limites dans la validation du lot ; ne pas présenter une vérification impossible comme réussie.

La priorité porte sur les calculs, la persistance et les transitions calendaires. Aucun seuil global de couverture n’est imposé ; une mesure éventuelle est informative et doit préciser son périmètre ainsi que les zones critiques non couvertes.

Références officielles : [installation et configuration de Vitest](https://vitest.dev/guide/), [serveur local Playwright Test](https://playwright.dev/docs/test-webserver), [configuration de Playwright en CI](https://playwright.dev/docs/ci-intro).
