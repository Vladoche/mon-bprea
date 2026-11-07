# Mon BPREA

Site de révision BPREA en HTML, CSS et JavaScript, publié sur [GitHub Pages](https://vladoche.github.io/mon-bprea/). Le site fonctionne sans Node.js à l’exécution. Les outils npm servent au développement et à la préparation du SDK navigateur.

**État de la livraison et prochaine action : [fiche de reprise Codex](docs/developpement/REPRISE-CODEX.md).** Cette fiche porte le suivi actuel ; les anciens comptes rendus sont conservés dans [les archives de validations](docs/archives/validations/). Le défaut Auth publié reste désactivé. L’accès personnel prévu est privé, sur invitation, après les validations et autorisations requises.

## Fonctionnalités

- **Mes cours** : 5 UC nationales et 2 UCARE, quatre cours d’exemple UC 03, QCM et progression.
- **S’exercer** : séries hebdomadaires de dix exercices par UC, brouillons, corrections, entraînements et historique ; Tableau de bord et calendrier.
- **Outils** : générateur ITK avec export CSV/impression, bibliothèque documentaire et reconnaissance des plantes.
- **Apparence** : saisons, ambiances horaires, modes clair/sombre et préférences ; navigation responsive et accessible.
- **Espace personnel configuré** : activation, connexion, récupération assistée, synchronisation des cours/QCM, Drill, botanique, paramètres ITK et apparence ; copie JSON, restauration limitée et gestion locale des données personnelles.

Les contenus restent illustratifs : la banque Drill couvre surtout l’UC 03, les autres UC signalent leur banque incomplète ; la botanique contient douze espèces et le calendrier ne contient aucune date de formation inventée. Les statistiques portent sur les exercices réalisés, sans badge ni récompense. L’ITK et les indices de préparation sont des repères pédagogiques, sans valeur de prescription ou de prédiction de réussite.

## Démarrer localement

Depuis la racine du dépôt, avec Python 3.10 ou plus récent :

```bash
python -m http.server 8000
```

Ouvrir [la démo locale](http://localhost:8000). Le serveur HTTP est nécessaire aux modules JavaScript ; l’ouverture directe en `file://` ne convient pas.

Pour développer, utiliser **Node.js 24 LTS** :

```bash
npm ci
npx playwright install chromium
npm test
npm run test:e2e
```

Consulter [les conventions de test](docs/TESTS.md) pour choisir les contrôles proportionnés. Les E2E utilisent des contextes isolés et un serveur local ; aucune suite ne doit viser PROD. Après une livraison locale vérifiée et l’arrêt des processus concernés, exécuter `npm run delivery:complete` selon la [politique de maintenance](docs/developpement/MAINTENANCE-DOSSIER-TMP.md).

## Trouver le bon fichier

| Zone | Contenu |
| --- | --- |
| `*.html`, `assets/` | Pages publiques, modules, styles et données ; URL et identifiants à préserver |
| `documents/` | PDF publics ; [règles d’ajout et de conservation des chemins](documents/README.md) |
| `docs/architecture/` | [Architecture actuelle](docs/architecture/ARCHITECTURE.md) et contrats par domaine |
| `docs/developpement/`, `docs/TESTS.md` | Reprise, maintenance et commandes de développement |
| `docs/deploiement/`, `docs/rgpd/` | Procédures d’exploitation et décisions de préouverture/confidentialité |
| `docs/validations/` | Preuves de la campagne 6.6 en cours |
| `docs/archives/validations/` | Rapports antérieurs conservés, à lire selon le besoin du chantier |
| `scripts/` | Préparation Pages, outils locaux, maintenance et runners |
| `tests/` | Configurations Vitest/Playwright, unités, intégration, parcours et fixtures synthétiques |
| `supabase/` | Configuration locale, migrations immuables, fonctions, modèles et tests SQL |
| `.github/workflows/` | Qualité, sécurité locale Auth/RLS et publication Pages distinctes |

## Modifier les contenus

| Besoin | Source et guide |
| --- | --- |
| Cours, UC, QCM, données ITK | `assets/content.js` ; conserver les identifiants existants |
| Navigation et pages de rubrique | `assets/navigation.json` · [Navigation](docs/architecture/NAVIGATION.md) |
| Exercices hebdomadaires | `assets/drill-bank.json` · [Mode Drill](docs/architecture/MODE-DRILL.md) |
| Statistiques | [Tableau de bord](docs/architecture/DASHBOARD.md) |
| Calendrier et bandeau d’examens | `assets/calendar-events.json` · [Événements et examens](docs/architecture/ARCHITECTURE.md#modifier-les-événements-et-les-examens) |
| Bibliothèque et PDF | `assets/resources.json` · [Ressources](docs/architecture/RESSOURCES.md) |
| Apparence et anecdotes | [Thèmes](docs/architecture/THEMES.md) · [Anecdotes](docs/architecture/ANECDOTES.md) |
| Botanique et crédits photographiques | [Reconnaissance des plantes](docs/architecture/RECONNAISSANCE-PLANTES.md) · [Sources](docs/architecture/BOTANICAL-SOURCES.md) |

## Authentification et publication

Le [contrat Auth](docs/architecture/AUTHENTIFICATION.md) décrit le client/service partagé, les profils UUID et les essais. Le modèle public est `docs/developpement/auth-config.example.json` ; sa copie locale `auth-config.local.json` reste ignorée. Aucun secret administratif ne doit entrer dans Git, le navigateur ou Pages. Les mocks applicatifs ne prouvent pas RLS ; les tests réels utilisent exclusivement la stack Supabase locale dédiée avec des comptes fictifs.

Les données visiteur restent distinctes des caches personnels isolés par environnement/projet/compte. L’import est volontaire et la déconnexion conserve la progression et les opérations non synchronisées. Voir [l’architecture des données](docs/architecture/ARCHITECTURE.md#stockage-et-conservation-des-données).

Le workflow [Publier le site BPREA](.github/workflows/deploy.yml) prépare `site-public/` avec `scripts/prepare-pages.py`, puis publie cet artefact via GitHub Actions. Les HTML racine, les ressources publiques autorisées et les PDF gardent leurs chemins ; documentation, tests, scripts et `.tmp/` sont exclus. Le [guide de versionnement des ressources](docs/architecture/CACHE.md) détaille le cache busting.

Une poussée sur `main` ou le lancement manuel du workflow peut publier. Fusion, déploiement et opération PROD exigent l’autorisation explicite prévue par les [consignes du dépôt](AGENTS.md). La [fiche de reprise](docs/developpement/REPRISE-CODEX.md), le [runbook PROD](docs/architecture/RUNBOOK-SUPABASE-PROD-6-6-0.md) et le [plan de préouverture](docs/deploiement/PLAN-PREOUVERTURE-PRIVEE.md) portent les conditions encore applicables.
