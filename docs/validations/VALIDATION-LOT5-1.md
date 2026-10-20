# Validation — Architecture, qualité et tests (lot 5.1)

Réalisée le **20 octobre 2026** sur `feature/architecture-qualite-lot5-1`, créée après actualisation des références depuis `origin/main` au commit `8b958f4`. Ce commit fusionne la PR nº 5 : le lot 5 était bien intégré. Le dépôt était propre avant intervention.

## Audit et portée

Les frontières existantes Drill / stockage / statistiques permettent des tests directs sans réorganisation de `assets/`. Les risques prioritaires sont les dates Europe/Paris, le décompte des premières réponses, la préservation des historiques et les chemins du site publié. Les calculs QCM/ITK et leur orchestration dans `app.js` restent en place. Le diagnostic et les recommandations pour les comptes du lot 6 sont dans [ARCHITECTURE.md](../architecture/ARCHITECTURE.md).

Sept guides sont regroupés dans `docs/architecture/`, six validations historiques dans `docs/validations/`. Les liens du README et du guide des documents ont été actualisés. Les pages HTML restent toutes à la racine. `README.md`, `AGENTS.md` et `.nojekyll` y restent aussi.

Seule modification du code applicatif : extraction de `selectUpcomingExams(events, day)` dans `assets/calendar-data.js` et appel de cette fonction par `assets/exam-preparation.js`. Le filtre et le tri sont exactement ceux utilisés auparavant par le bandeau ; les événements invalides restent écartés par le lecteur existant. Aucun changement des formules, identifiants, clés locales, fichiers JSON, CSS ou URL publiques.

Les nouveaux outils sont `package.json` / `package-lock.json`, `vitest.config.js`, `playwright.config.js`, `scripts/test-server.mjs`, `tests/` et `.github/workflows/quality.yml`. Les seules dépendances directes sont **Vitest 5.0.5** et **Playwright Test 1.64.1**, en développement et verrouillées. Aucun module public ne les importe.

## Suites ajoutées et résultats locaux

Environnement réellement utilisé : Windows, **Node.js 24.22.0**, npm **10.4.0**, Python **3.15.0**, Chromium Playwright. Les horloges sont contrôlées ; Vitest et le navigateur utilisent explicitement Europe/Paris pour les conventions locales. Les scénarios n’utilisent aucune progression réelle.

| Commande exécutée | Résultat |
| --- | --- |
| `npm ci --fetch-retries=0 --fetch-timeout=20000` | Code 0 ; 38 paquets installés depuis le verrou ; audit npm : 0 vulnérabilité signalée. |
| `npm test` | Code 0 ; **37 tests**, 7 fichiers réussis. |
| `npm run test:unit` après `npm ci` | Code 0 ; **29 tests**, 5 fichiers réussis. |
| `npm run test:integration` après `npm ci` | Code 0 ; **8 tests**, 2 fichiers réussis. |
| `npx playwright install chromium` | Code 0 ; navigateur Chromium et composants requis installés. |
| `npm run test:e2e` après `npm ci` | Code 0 ; **6 parcours Chromium réussis en 4,5 s**. |
| `python scripts/prepare-pages.py --version lot5-1-verification --output .tmp/lot5-1-public` | Code 0 ; **60 fichiers publics et 139 références versionnées**. |
| `node --check` sur les trois configurations/scripts JavaScript ajoutés | Code 0. |
| `git diff --check` | Aucune erreur de contenu ; avertissements LF/CRLF habituels sous Windows. |

La première exécution E2E a permis de corriger deux sélecteurs du test vers les rôles accessibles des listes déroulantes, sans modifier le site. Dans le bac à sable Windows, les six parcours s’exécutaient mais Playwright restait bloqué à l’arrêt de son serveur via `taskkill`. La commande relancée avec les permissions système nécessaires a terminé normalement, code 0 ; aucune adaptation du code à ce blocage d’environnement. La CI Ubuntu utilise le cycle de vie normal de Playwright.

### Logique et intégration

- **Drill — 8 tests unitaires** : semaines ISO et lundi Paris, années ISO, transitions d’heure à 167/169 heures, sélection reproductible et banque insuffisante, résultats sans questions non réalisées, entraînement et dédoublonnage.
- **Dashboard — 6 tests unitaires** : totaux et taux pondérés, UC et semaines de validation, périodes sans données, échantillons insuffisants, données futures/inconnues et concordance avec le moteur Drill.
- **Calendrier/examens — 6 tests unitaires** : dates invalides et bissextiles, mois/années et journées de 23/25 heures, prochain examen et périodes concurrentes, absence de période réelle, exclusions par le lecteur JSON.
- **Apparence — 5 tests unitaires** : quatre saisons, seuils horaires, choix manuels, valeurs invalides, sauvegardes illisibles ou de version future archivées. Le véritable script précoce est exécuté dans `node:vm`, sans recopier ses calculs et sans ajouter de bibliothèque DOM.
- **Anecdote — 4 tests unitaires** : stabilité, minuit Paris, rotation et changements d’heure, collection vide et date invalide.
- **Stockage Drill / Dashboard — 5 tests d’intégration** : brouillons et réponses, reprise après relecture de modules, snapshots historiques, premières réponses et entraînements, données inconnues ou malformées préservées. Le stockage mémoire est neuf pour chaque cas.
- **Apparence — 3 tests d’intégration** : préférence appliquée au chargement et au rechargement, migration clair/sombre sans supprimer la clé historique, autre onglet et écriture refusée. Les autres clés restent intactes.

### Six parcours navigateur

| Parcours | Contrôles réussis |
| --- | --- |
| Navigation et Pages | Accueil, Mes cours, UC 03, S’exercer, Outils et sous-menus. Les **douze pages** sont ensuite ouvertes sous `/mon-bprea/` ; ressources CSS/JS/JSON en HTTP 200 avec la version `e2e-lot5-1`, cinq JSON couverts. |
| Drill | Série de dix questions, réponse correcte, correction, sauvegarde identique après rechargement, résultat visible dans le Dashboard. |
| Dashboard | Contexte vide : 0 réalisé et aucune donnée de réussite. Fixture maîtrisée : 2 réalisés, 1 correcte, 1 erreur, 50 %, représentation graphique et sauvegarde inchangée. |
| Calendrier | Événements interceptés uniquement dans le contexte de test ; examen à J − 3 depuis l’accueil, lien vers le bon mois, détail, navigation octobre/novembre. Le JSON livré reste vide. |
| Outils | Navigation ITK sous préfixe, génération tomate, téléchargement CSV, filtre documentaire et téléchargement d’un PDF existant dont la signature `%PDF-` est contrôlée. |
| Apparence | Mobile 390 px, hiver sombre et persistance ; cours, QCM, Dashboard et calendrier sans débordement global. Anecdote stable, masquée après rechargement puis renouvelée à minuit Paris sans rechargement. Progression de contrôle intacte. |

## Vérifications complémentaires

Inspection visuelle via Playwright MCP dans un contexte isolé : accueil avec examen à venir et anecdote, version claire sur ordinateur, hiver sombre sur mobile et calendrier avec agenda. Le bandeau d’examens reste prioritaire, les contrôles et textes sont lisibles, aucune exception JavaScript observée. Lancement avec le serveur Python standard vérifié sous `/mon-bprea/`, sans utiliser Node pour servir les sources.

L’artefact a été inspecté sur disque : seulement les douze HTML, `assets/`, les PDF de `documents/` et `.nojekyll`. Les outils, dépendances, fixtures, rapports et `docs/` en sont absents. Le script de préparation et le workflow de publication sont **inchangés**. La navigation E2E et le téléchargement PDF utilisent le préfixe réel simulé ; le cache busting des imports transitifs et JSON reste actif.

`.playwright-mcp/` était déjà ignoré et non suivi. `node_modules/`, `test-results/`, `playwright-report/`, `coverage/` et `.vitest/` sont aussi ignorés. Le fichier `download` supprimé était vide (0 octet), sans référence au fichier dans le code et déjà exclu de l’artefact ; les preuves sont consignées dans l’audit. Aucun autre fichier au rôle incertain ni aucune donnée utilisateur supprimé.

Le workflow **Qualité** est limité aux PR vers `main`, avec deux jobs `unit-integration` et `e2e`, `npm ci`, Node 24, Chromium et traces/captures en cas d’échec. Son YAML a été analysé et sa structure contrôlée localement. L’[exécution GitHub Actions nº 1](https://github.com/Vladoche/mon-bprea/actions/runs/39456012212), déclenchée par la [PR nº 6](https://github.com/Vladoche/mon-bprea/pull/6) sur le commit applicatif `0e8d0ef`, a terminé avec **les deux jobs réussis** sur Ubuntu : installation reproductible, Vitest, installation Chromium et parcours navigateur. L’étape de dépôt des artefacts d’échec a été ignorée comme prévu. Les 19 documents et leurs 45 liens locaux ont aussi été contrôlés après réorganisation, sans lien manquant.

## Limites

Pas de mesure de couverture instrumentée ni de seuil artificiel ; les nombres ci-dessus comptent les tests réellement exécutés. Les QCM, calculs ITK, indexation documentaire, concurrence réelle entre onglets et tous les cas d’indisponibilité réseau ne sont pas intégralement couverts. Le prochain effort utile concerne la persistance QCM et les conflits de synchronisation avant le lot 6.

Chromium uniquement, mobile simulé ; pas d’appareil physique, audit complet d’accessibilité ou comparaison Firefox/Safari. Le mode interactif Vitest est configuré mais n’a pas été laissé tourner comme validation. Aucun E2E ne vise la production. La préservation du déploiement est vérifiée par son workflow inchangé et son artefact local ; aucune publication réelle n’est lancée pour le confirmer. Les limites de cache HTML de GitHub Pages du lot 5 restent applicables.

Les règles de protection de `main` et la fusion automatique n’ont pas été modifiées. La procédure pour rendre les deux checks obligatoires après accord est documentée dans [TESTS.md](../TESTS.md). Livraison par PR vers `main`, sans fusion ni mise en production sans validation.
