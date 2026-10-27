# Mon BPREA — Démonstration fonctionnelle

Un site de révision **entièrement statique** (HTML, CSS, JavaScript), prêt pour GitHub Pages. Le site publié fonctionne sans Node.js ni installation npm à l’exécution. Le lot 6.1 prépare Supabase Auth et les profils privés, avec un SDK navigateur servi localement et une configuration désactivée par défaut. Les outils de développement utilisent Node.js pour les tests et la préparation de ce SDK.

## Fonctions incluses

- **Navigation** : trois rubriques principales, **Accueil**, **Mes cours** et **Outils**. Pages de rubrique dédiées, menus accessibles et fils d’Ariane cohérents.
- **Accueil et Mes cours** : 5 UC nationales et 2 UCARE, cours par UC et suivi de progression. **S’exercer** appartient à Mes cours et regroupe exercices, résultats et calendrier.
- **UC 03** : quatre cours d'exemple (cycle de la matière organique, C/N, pédofaune, pédoflore et indicateurs).
- **Exercices** : 3 QCM corrigés par cours, soit 12 questions, meilleur score conservé.
- **Suivi** : marquage réversible des cours terminés et historique des tentatives QCM ; sauvegarde visiteur locale ou espace personnel synchronisé dans un environnement configuré.
- **Générateur ITK** : tomate, laitue, carotte, courgette, choix de variété/type, abri/plein champ, surface, mois, sol et disponibilité en eau. Calendrier indicatif, alerte selon contraintes, export CSV et impression en PDF via le navigateur.
- **Bibliothèque documentaire** : 5 sites et 3 PDF conservés, recherche dans les métadonnées, filtres combinés par UC, cours, chapitre, thématique, type et organisme, tri et navigation entre cours et ressources. Les cours et UC présentent leurs ressources associées.
- **Apparence dynamique** : quatre saisons, quatre ambiances horaires et préférences indépendantes de saison/luminosité, conservées sur le navigateur ; accès rapide clair/sombre et migration de l’ancien choix.
- **« Tu savais que… ? »** : anecdote agronomique quotidienne sourcée, identique pour une même date Europe/Paris, masquable pour la journée.
- **Mises à jour** : ressources CSS, JavaScript et données JSON versionnées dans l’artefact GitHub Pages à partir du commit, sans toucher aux données locales.
- **Calendrier annuel** : navigation par mois, cours, stages, vacances, examens associés à une UC, agenda et détail des événements. Calendrier livré vide, sans dates de formation inventées.
- **Préparation aux examens** : prochaine période, compte à rebours et statistiques locales de l’UC, avec un indice indicatif expliqué et des états sans données.
- **Exercices hebdomadaires** (Mode Drill) : dix questions par UC chaque semaine ISO à partir du lundi 00 h Europe/Paris, corrections, brouillons, entraînements séparés et historique. Banque initiale de 12 questions pour l’UC 03 ; autres UC explicitement incomplètes.
- **Tableau de bord pédagogique** : résultats réels du Mode Drill, volumes et taux hebdomadaires, comparaison des UC et notions à retravailler ; filtres par UC et sur 4, 8, 12 semaines ou tout l’historique, graphiques et tableaux accessibles.
- **Reconnaissance des plantes** : photographies locales sourcées, modes Découverte et Chrono, corrections botaniques, historique visiteur ou personnel synchronisé, révision des erreurs et import volontaire. Prototype : 12 espèces et 12 photographies, trois catégories jouables de quatre questions ; légumineuses explicitement à compléter.
- **Compte sur invitation et Drill personnel** : connexion, activation, récupération du mot de passe et profil avec pseudo facultatif ; Supabase protège les données privées par RLS. Dans un environnement d’essai configuré, le Drill utilise un cache personnel atomique et synchronise les séries, premières réponses et entraînements. Le défaut public reste désactivé ; ouverture aux étudiants après validation du lot 6.5.
- Interface responsive (ordinateur et mobile).

## Se repérer dans le site

La navigation présente exactement trois entrées de premier niveau :

```text
Accueil — index.html
Mes cours — mes-cours.html
  Cours par UC — uc.html?id=…
    Chapitres
    Leçons — cours.html?id=…
  S’exercer — s-exercer.html
    Exercices hebdomadaires — drill.html
    Tableau de bord — tableau-de-bord.html
    Calendrier — calendrier.html
Outils — outils.html
  Générateur ITK — itk.html
  Ressources documentaires — ressources.html
  Reconnaissance des plantes — reconnaissance-plantes.html
```

**S’exercer** appartient exclusivement à **Mes cours**. **Outils** constitue une rubrique principale indépendante. Les liens des titres permettent d’ouvrir les pages de rubrique ; des boutons distincts déplient les destinations. Sur ordinateur, Mes cours regroupe les cours par UC et les trois activités de S’exercer. Le menu mobile conserve les mêmes rubriques et leurs accès directs.

La page **S’exercer** affiche les premières réponses réellement validées pendant la semaine ISO courante en Europe/Paris : exercices réalisés, bonnes réponses et taux calculé uniquement sur les réponses réalisées. Elle réutilise les calculs du Tableau de bord, y compris pour une ancienne série reprise cette semaine. Sans réponse, elle explique l’absence de données ; une erreur de lecture du stockage n’est pas présentée comme un résultat nul. Les entraînements supplémentaires et les QCM restent séparés.

Les anciennes URL, leurs paramètres et les liens contextuels restent valables : exercices d’un cours, ressources associées, calendrier depuis le bandeau d’examens et liens du Tableau de bord. « Exercices hebdomadaires » est le nouveau libellé du Mode Drill ; son fonctionnement, `drill.html` et ses sauvegardes restent identiques.

Le menu commun est configuré dans `assets/navigation.json`, avec rendu et interactions dans `assets/navigation.js` et styles dans `assets/navigation.css`. Le guide [NAVIGATION.md](docs/architecture/NAVIGATION.md) décrit cette configuration, les pages de rubrique et les fils d’Ariane. Le lot 5 ajoute l’apparence et le bandeau quotidien sans changer cette hiérarchie : voir [THEMES.md](docs/architecture/THEMES.md), [ANECDOTES.md](docs/architecture/ANECDOTES.md) et [VALIDATION-LOT5.md](docs/validations/VALIDATION-LOT5.md).

## Consulter la démo en local

Le JavaScript utilise des modules ES, qui ne sont pas chargés de façon fiable en ouvrant directement le fichier `index.html` en `file://` dans certains navigateurs. Démarre un mini-serveur local.

Si Python est disponible :

```bash
cd bprea-demo
python -m http.server 8000
```

Puis ouvre <http://localhost:8000>.

Tu peux aussi utiliser l'extension **Live Server** de VS Code.

## Développer et vérifier

Installe **Node.js 24 LTS**, puis exécute depuis la racine du dépôt :

```bash
npm ci
npx playwright install chromium
npm test
npm run test:e2e
```

`npm run test:watch` relance Vitest pendant le développement. Playwright Test démarre son serveur HTTP local et utilise des données isolées ; les tests ne doivent jamais viser le site de production. [docs/TESTS.md](docs/TESTS.md) décrit l’installation, les scénarios, les traces d’échec, le workflow **Qualité** et l’ajout de tests. Vitest exerce la logique métier et les interactions avec le stockage ; Playwright Test vérifie les parcours dans Chromium. Playwright MCP reste un outil de vérification visuelle manuelle.

Les pages et ressources publiques gardent leurs chemins. La documentation technique et les outils sont organisés ainsi :

```text
*.html                  Points d’entrée publics conservés à la racine
assets/                 Modules JavaScript, styles et données du site
documents/              PDF publics et guide de classement
docs/architecture/      Architecture et guides par domaine
docs/validations/       Comptes rendus historiques et validation du lot 5.1
docs/TESTS.md           Installation et stratégie de vérification
tests/unit/             Calculs et règles métier
tests/integration/      Persistance et cohérence entre modules
tests/e2e/              Parcours navigateur reproductibles
tests/fixtures/         Données de test maîtrisées
scripts/                Préparation Pages et outils locaux
supabase/               Configuration locale, migrations, modèles et tests RLS
.github/workflows/      Qualité des PR et publication Pages distinctes
```

L’[audit d’architecture](docs/architecture/ARCHITECTURE.md) explique les frontières conservées et les risques prioritaires. Les résultats réellement exécutés figurent dans les validations du [lot 5.1](docs/validations/VALIDATION-LOT5-1.md) et du [lot 5.2](docs/validations/VALIDATION-LOT5-2.md). Les dépendances de développement, tests, rapports et documentation ne sont pas copiés dans l’artefact Pages. Aucune fusion vers `main`, modification des protections ou mise en production ne doit être réalisée sans accord.

## Préparer l’authentification sur invitation

Les pages `connexion.html`, `authentification.html`, `mot-de-passe-oublie.html` et `profil.html` partagent un seul service Auth par document. Le header affiche Connexion ou Mon profil / Déconnexion. Les trois rubriques et les contenus publics restent accessibles sans compte. Supabase Auth conserve l’e-mail et gère les mots de passe ; `public.profiles` contient seulement UUID, pseudo facultatif et dates. Seul le pseudo personnel est modifiable. Les migrations et privilèges RLS sont décrits dans [AUTHENTIFICATION.md](docs/architecture/AUTHENTIFICATION.md).

`assets/auth-config.json` reste désactivé et sans identifiants. Pour un essai autorisé, créer une stack locale ou un projet Supabase DEV distinct de PROD ; copier `auth-config.example.json` vers `auth-config.local.json` ignoré, puis renseigner uniquement l’URL publique, la clé **publishable** et `siteUrl`. Ne jamais y mettre de clé `secret`/`service_role`, mot de passe de base ou identifiant SMTP. Préparer ensuite un artefact local neuf :

```bash
python scripts/prepare-pages.py --version auth-dev --auth-config auth-config.local.json --output .tmp/auth-dev/mon-bprea
python -m http.server 4173 --directory .tmp/auth-dev
```

Ouvrir `http://127.0.0.1:4173/mon-bprea/`, identique au `siteUrl` du modèle. Le guide donne les réglages d’inscription fermée, l’invitation native, les modèles d’e-mails, le callback exact, la configuration SMTP et les commandes de migration. Le workflow Pages actuel conserve le défaut désactivé ; activer un projet de production demandera une configuration et une validation distinctes.

Le SDK Supabase 2.118.0 est préparé avec `npm run build:auth-sdk` après `npm ci`, uniquement lors d’une reconstruction volontaire du fichier versionné. Les tests unitaires avec mocks et les E2E sans configuration ne prouvent pas RLS. `npm run test:supabase` et `npm run test:e2e:supabase` exigent une vraie stack locale isolée avec Docker, la CLI et les valeurs du modèle `supabase/tests/.env.example`. Les résultats réellement obtenus et les vérifications encore nécessaires sont consignés dans [VALIDATION-LOT6-1.md](docs/validations/VALIDATION-LOT6-1.md).

Avant toute ouverture réelle : appliquer et vérifier les migrations, prouver le refus d’inscription directe et l’isolation des comptes A/B, tester invitations et récupération avec e-mails contrôlés, confirmer les URL Pages et configurer SMTP. Finaliser les informations juridiques, la conservation et les procédures de droits au lot 6.4 ; l’ouverture de la promotion reste conditionnée au lot 6.5. La session navigateur est persistante et exposée aux risques XSS/appareil partagé ; la déconnexion préserve tous les historiques pédagogiques de l’appareil.

Les projets DEV et PROD existent déjà. Le [rapport de vérification et finalisation Supabase DEV](docs/validations/VALIDATION-SUPABASE-DEV.md), actualisé le 24 octobre 2026, confronte les traces de la session précédente à l'état hébergé, aux réglages Auth et aux résultats CI. DEV est prêt pour développer le lot 6.2 ; l'installation des modèles et les parcours depuis un e-mail reçu restent à valider avec un SMTP adapté, conformément au choix actuel de n'envoyer aucun message. Aucun projet supplémentaire ni déploiement public n'est nécessaire.

Le lot **6.2.1** fournit le [backend PostgreSQL du Mode Drill](docs/architecture/DRILL-SYNCHRONISATION-BACKEND.md) : snapshots historiques, premières réponses immuables, entraînements dédupliqués et isolation par RLS. Les lots 6.2.2 et 6.2.3 réutilisent ce contrat pour synchroniser le Drill et alimenter le Dashboard personnel. Les exécutions et l'état d'application sur DEV sont consignés dans la [validation du lot 6.2.1](docs/validations/VALIDATION-LOT6-2-1.md).

Le lot **6.2.2** ajoute la [synchronisation personnelle du Drill](docs/architecture/DRILL-SYNCHRONISATION-CLIENT.md), disponible dans un environnement d'essai Auth configuré : cache IndexedDB distinct par compte/projet/environnement, réponses et file d'envoi atomiques, retries idempotents, récupération sur un autre appareil et conflits conservés avec reprise explicite. Le visiteur garde son historique local sans import automatique. Les brouillons restent locaux. Le défaut publié reste désactivé. Les [preuves du lot 6.2.2](docs/validations/VALIDATION-LOT6-2-2.md) précisent les tests réellement exécutés et les limites du hors ligne et du cache personnel sur appareil partagé.

Le lot **6.2.3** branche le [Tableau de bord](docs/architecture/DASHBOARD.md) sur la même vue personnelle réconciliée. Les résultats visiteurs restent locaux et séparés. Les réponses personnelles en attente comptent dans les données disponibles sur cet appareil avec un état de synchronisation explicite ; les entraînements et conflits ne doublent pas les premières réponses. Une identité incertaine masque les données privées, et une panne avec cache vide n'est pas présentée comme un compte sans activité. Les filtres, les calculs et les tableaux accessibles sont conservés. Les preuves et limites de la recette multi-appareils figurent dans [VALIDATION-LOT6-2-3.md](docs/validations/VALIDATION-LOT6-2-3.md).

Le lot **6.3.1** prépare le [backend des autres données personnelles](docs/architecture/PERSONAL-DATA-BACKEND.md) : états de cours réversibles, historiques QCM et botaniques, derniers paramètres ITK et choix d'apparence. Il fournit une migration, RLS, concurrence par révision et tests réels dédiés, sans synchronisation frontend nouvelle. Le [rapport de validation](docs/validations/VALIDATION-LOT6-3-1.md) distingue les exécutions locales des preuves de CI. Les clients restent réservés aux lots 6.3.2 à 6.3.4 ; aucune application DEV/PROD n'est autorisée par ce lot.

Le lot **6.3.2** ajoute la [synchronisation des cours et QCM](docs/architecture/COURSE-QUIZ-SYNCHRONISATION-CLIENT.md). Le compte dispose d’un cache IndexedDB séparé, d’une file persistante atomique, de cours réversibles avec conflits de révision et de tentatives QCM immuables identifiées par UUID. L’historique de cet appareil ne rejoint le compte qu’après prévisualisation et confirmation de l’import ; sa source et ses archives restent intactes. Le bandeau d’examen utilise aussi le Drill personnel pour éviter de mélanger les comptes et le visiteur. Les [preuves et limites](docs/validations/VALIDATION-LOT6-3-2.md) distinguent HTTP simulé et Supabase local réel. Le défaut public reste désactivé et aucune migration DEV/PROD n’est autorisée par cette livraison.

## Déployer sur GitHub Pages (préparation légère des fichiers publics)

1. Crée un dépôt GitHub, par exemple **`mon-bprea`**. Pour GitHub Pages sur un compte GitHub Free, le dépôt doit généralement être **public**.
2. Ajoute **tout le contenu du dossier `bprea-demo` à la racine du dépôt**, y compris le dossier caché `.github/workflows/` et le fichier `.nojekyll`.
3. Dans GitHub, va dans **Settings → Pages → Build and deployment → Source : GitHub Actions**.
4. Pousse les fichiers sur la branche `main` ; le workflow `Publier le site BPREA` publiera automatiquement le site.
5. Le site sera consultable à `https://TON-PSEUDO.github.io/mon-bprea/` (adapte le nom du dépôt).

> Tu n'as **pas** besoin de configurer un « base path ». Tous les liens internes sont relatifs. Aucun nom d'utilisateur ou de dépôt n'est codé en dur.

Le workflow prépare les fichiers publics avec `scripts/prepare-pages.py` (Python standard, aucune dépendance) et ajoute `?v=<SHA du commit>` aux ressources CSS/JS/JSON dans la copie publiée, y compris les imports JavaScript transitifs. Les sources restent directement utilisables en local. [CACHE.md](docs/architecture/CACHE.md) décrit la vérification de l’artefact et les limites du cache HTML de GitHub Pages : une ancienne page encore en cache peut temporairement continuer à demander ses anciennes ressources. **Ne pas fusionner vers `main` ni lancer la publication sans validation**, car une poussée sur `main` déclenche le workflow.

### Depuis Git en local (exemple)

```bash
cd bprea-demo
git init
git add .
git commit -m "Premiere demo BPREA"
git branch -M main
git remote add origin https://github.com/TON-PSEUDO/mon-bprea.git
git push -u origin main
```

Crée d'abord le dépôt vide depuis GitHub. La première publication GitHub Pages peut demander quelques minutes.

## Modifier et enrichir le contenu

- `assets/content.js` : intitulés des UC dans `units`, cours dans `lessons`, questions dans `quiz`, données ITK dans `crops`.
- `assets/resources.json` : **catalogue éditable unique** des ressources et registre de chapitres ; relations explicites vers les identifiants des UC et cours.
- `assets/resources.js` : lecture, validation et recherche du catalogue JSON ; aucun second catalogue à maintenir.
- `assets/resource-library.js` / `assets/resource-library.css` : bibliothèque documentaire, recherche, filtres et ressources associées aux pages de cours et d’UC.
- `documents/` : PDF accessibles aux visiteurs ; [documents/README.md](documents/README.md) explique leur classement et la préservation des chemins existants.
- `assets/theme-init.js` : résolution de saison/luminosité avant le rendu, migration et sauvegarde des préférences.
- `assets/style.css` : tokens sémantiques, palettes saisonnières claires/sombres et styles communs.
- `assets/appearance.js` / `assets/appearance.css` : paramètres visuels et accès rapide clair/sombre.
- `assets/daily-facts.json` et `assets/daily-fact.js` / `assets/daily-fact.css` : banque sourcée, rotation et bandeau quotidien.
- `scripts/prepare-pages.py` : préparation des fichiers publics versionnés pour GitHub Pages.
- `assets/supabase-client.js`, `assets/auth-service.js`, `assets/auth-header.js`, `assets/auth-pages.js` et `assets/auth-validation.js` : configuration publique, session partagée, interface et validations du compte ; `assets/vendor/supabase.js` : SDK local reconstruit par `scripts/build-auth-sdk.mjs`.
- `supabase/` : migration du profil, RLS, configuration locale et modèles d’invitation/récupération ; [AUTHENTIFICATION.md](docs/architecture/AUTHENTIFICATION.md) : procédure d’installation et limites avant ouverture.
- `assets/app.js` : navigation, progression, exercices, calcul ITK et export.
- `assets/navigation.json` et `assets/navigation.js` / `assets/navigation.css` : arborescence commune, menu et interactions ordinateur/mobile ; `assets/breadcrumbs.js` : fils d’Ariane partagés.
- `mes-cours.html`, `s-exercer.html` et `outils.html` : pages de rubrique ; `assets/section-hubs.js` / `assets/section-hubs.css` : leurs cartes et la synthèse hebdomadaire de S’exercer.
- `assets/calendar-events.json` : événements et dates d’examen, modifiables sans changer le JavaScript.
- `assets/calendar-data.js` et `assets/calendar.js` : lecture/validation des événements, navigation mensuelle, agenda et détail.
- `assets/exam-stats.js` et `assets/exam-preparation.js` : statistiques des QCM et bandeau d’accueil ; `assets/calendar.css` et `assets/exam-preparation.css` : leurs styles clair/sombre.
- `drill.html` et `assets/drill.js` / `assets/drill.css` : interface du Mode Drill ; `assets/drill-engine.js` : semaines, sélection et statistiques ; `assets/drill-store.js` : sauvegardes indépendantes.
- `assets/drill-bank.json` et `assets/drill-bank.js` : banque éditable et validation des questions.
- `reconnaissance-plantes.html`, `assets/botanical.js` / `assets/botanical.css` : jeu botanique ; `assets/botanical-engine.js` et `assets/botanical-store.js` : calculs, chrono et stockage autonomes ; `assets/botanical-bank.json` et `assets/botanical-photos/` : référentiel et photothèque locale.
- `tableau-de-bord.html` et `assets/dashboard.js` / `assets/dashboard.css` : interface du Tableau de bord ; `assets/dashboard-data.js` : adaptateur de lecture seul, fondé sur la validation/normalisation du stockage Drill ; `assets/dashboard-stats.js` : calculs purs et séries temporelles réutilisables.
- Les pages `index.html`, `mes-cours.html`, `s-exercer.html`, `outils.html`, `uc.html`, `cours.html`, `exercices.html`, `itk.html`, `ressources.html`, `calendrier.html`, `drill.html` et `tableau-de-bord.html` sont les points d'entrée.

Chaque objet dans `lessons` comprend `id`, `unit`, `chapter`, `title`, `summary`, `body` (HTML pédagogique), `essentials` et `quiz`. La structure statique évite une compilation applicative et fonctionne directement sur GitHub Pages. Les dépendances npm servent aux outils de développement et à la préparation du SDK local ; Supabase constitue le service externe réservé aux comptes et profils, sans framework frontend.

## Administrer la bibliothèque documentaire

Le fichier **`assets/resources.json`** réunit les fiches dans `resources` et le registre stable des chapitres dans `chapters`, avec `version: 1`. Aucune connaissance de JavaScript n’est nécessaire : modifie les valeurs JSON entre guillemets, conserve les virgules entre les objets et n’ajoute pas de commentaire dans le fichier.

La bibliothèque présente les filtres UC, thématique et type ; « Préciser par cours, chapitre ou organisme » ouvre les critères supplémentaires. Tous les critères se combinent. Le tri propose les titres de A à Z ou de Z à A selon l’ordre alphabétique français, ou la date d’ajout de la plus récente à la plus ancienne ; les fiches sans date connue restent à la fin, par titre. « Réinitialiser les filtres » revient à toute la bibliothèque avec le tri par titre de A à Z.

1. **Ajouter un site** : ajoute une fiche à `resources`, avec un `id` unique et stable, un titre, une description, `type: "website"` et son `url` en `https://` ou `http://`. Renseigne l’organisme, la source et les mots-clés disponibles.
2. **Ajouter un PDF** : copie d’abord un petit document que tu as le droit de republier dans un sous-dossier de `documents/`, puis ajoute une fiche avec `type: "pdf"` et `file`, par exemple `documents/sols/ma-fiche.pdf`. Le fichier et sa fiche doivent être livrés ensemble. L’interface permet de le consulter ou de le télécharger.
3. **Associer une UC** : renseigne `units`, par exemple `["uc2", "uc3"]` pour une ressource commune aux deux UC. Une seule fiche suffit. Une liste vide garde une ressource générale.
4. **Associer plusieurs cours** : renseigne leurs identifiants exacts dans `lessons`. Par exemple `["pedofaune", "pedoflore"]` pour une nouvelle fiche personnelle conçue pour ces deux cours. Les cartes « Pour approfondir » proviennent uniquement de ces relations explicites ; une UC, un chapitre ou un mot-clé commun ne crée pas de lien automatique vers un cours.
5. **Classer par chapitre et thématique** : `chapters` contient les identifiants du registre, par exemple `["uc3-sol-vivant"]`. `themes` contient des intitulés libres et réutilisables, par exemple `["Sol", "Biologie du sol"]`. Le chapitre sert au classement et au filtre ; les mots-clés servent à la recherche.
6. **Modifier ou retirer une fiche** : corrige l’objet existant en conservant son `id`, ou retire cet objet de `resources`. Supprimer une fiche ne supprime pas son PDF ; conserve les fichiers déjà liés tant que leur retrait n’a pas été décidé. Après un renommage de cours, corrige les relations par identifiant.
7. **Vérifier avant publication** : démarre le serveur HTTP local, ouvre la bibliothèque puis le cours associé, combine les filtres et vérifie consultation/téléchargement. Respecte la casse et le nom réel du fichier ; utilise des chemins relatifs sans `/` initial pour conserver le sous-dossier GitHub Pages. Évite espaces et accents pour les nouveaux fichiers et n’encode pas deux fois un nom existant. La mise en production nécessite une validation préalable.

Le guide [RESSOURCES.md](docs/architecture/RESSOURCES.md) détaille tous les champs et donne deux exemples concrets : une **fiche personnelle de biologie du sol à créer**, associée à `pedofaune` et `pedoflore`, et le **site GRAB déjà présent**, commun aux UC 02 et UC 03. Ces exemples n’ajoutent aucun PDF tiers au dépôt.

La recherche porte sur les métadonnées des fiches, sans indexer le texte intégral des PDF. La disponibilité des PDF locaux est vérifiée automatiquement dès l’affichage de leur fiche, dans la bibliothèque, les cours et les UC. Un fichier introuvable ou ne correspondant pas à un PDF retire ses liens d’action et permet de réessayer la vérification. Une panne ou un délai dépassé de 10 secondes laisse un état « non vérifié », avec la possibilité d’essayer de consulter le document ou de relancer le contrôle. Les liens externes peuvent changer ou devenir indisponibles et ne sont pas vérifiés automatiquement depuis ce site statique. Les dates et organismes absents ne sont pas inventés. Les vérifications réellement réalisées et leurs limites sont consignées dans [VALIDATION-LOT4.md](docs/validations/VALIDATION-LOT4.md).

## Personnaliser l’apparence

Ouvre **Apparence** dans l’en-tête et choisis une saison (automatique ou fixe) puis une luminosité (automatique selon l’heure, claire ou sombre). Les choix sont indépendants et s’appliquent sans rechargement. Le bouton clair/sombre conserve son accès rapide et fixe la luminosité ; le dialogue permet de revenir en automatique. Le réglage automatique suit les saisons météorologiques de l’hémisphère nord et quatre plages horaires locales conventionnelles (6–10 h, 10–18 h, 18–22 h, 22–6 h), actualisées chaque minute.

Les préférences sont enregistrées dans `bprea-demo-appearance-v1`. Une ancienne préférence `bprea-demo-theme-v1` est migrée en choix manuel, sans supprimer l’ancienne clé. Les cours, résultats et historiques restent intacts. L’impression d’un ITK conserve une présentation claire. [THEMES.md](docs/architecture/THEMES.md) explique palettes, horaires et format de sauvegarde.

Le bandeau **« Tu savais que… ? »** propose un fait sourcé par date civile Europe/Paris et revient le lendemain s’il a été masqué. Sur l’accueil, le bandeau d’examens conserve la première place. [ANECDOTES.md](docs/architecture/ANECDOTES.md) explique l’ajout d’un fait et son association à un cours ou à une ressource. Aucun service externe n’est requis à l’exécution.

## Modifier les événements et les examens

Le fichier **`assets/calendar-events.json`** est la seule source des dates du calendrier et du bandeau d’accueil. Il est livré vide :

```json
{
  "version": 1,
  "events": []
}
```

Ajoute des objets dans `events`. Exemple **entièrement fictif**, qui ne représente aucune date réelle de formation :

```json
{
  "version": 1,
  "events": [
    {
      "id": "exemple-examen-uc3",
      "title": "Exemple fictif — période d’examen UC 03",
      "type": "examen",
      "start": "2027-06-14",
      "end": "2027-06-16",
      "unit": "uc3",
      "location": "Lieu fictif",
      "description": "Exemple de structure uniquement. Dates à remplacer par celles du centre.",
      "example": true
    }
  ]
}
```

| Champ | Règle |
| --- | --- |
| `id` | Texte obligatoire, unique et stable. |
| `title` | Intitulé obligatoire, affiché comme du texte (pas de HTML). |
| `type` | `cours`, `stage`, `vacances` ou `examen`. |
| `start` | Date obligatoire au format strict `YYYY-MM-DD`. |
| `end` | Facultatif ; même date que `start` si omis. Doit être postérieur ou égal au début. |
| `unit` | Facultatif : `uc1`, `uc2`, `uc3`, `uc4`, `uc5`, `ucare1` ou `ucare2`. Recommandé pour chaque examen afin d’afficher ses statistiques. |
| `location`, `description` | Textes facultatifs. Les retours à la ligne de la description sont conservés. |
| `example` | Booléen facultatif, `false` par défaut. `true` identifie visiblement un exemple fictif et l’exclut toujours du bandeau d’examen. |

Les journées de début **et** de fin sont incluses. Les périodes peuvent chevaucher des mois ou des années. Les dates sont des journées civiles dans le fuseau du navigateur, sans horaires ; le compte à rebours reste exact lors d’un changement d’heure. Pour enregistrer un véritable examen, utilise uniquement les dates communiquées par le centre et omets `example` ou mets-le à `false`.

Le calendrier ouvre le mois courant et permet de revenir à aujourd’hui, d’avancer/reculer et de choisir directement un mois. Sur mobile, la grille présente le nombre d’événements par jour et l’agenda placé dessous conserve tous les titres et les accès au détail. Liens directs possibles : `calendrier.html?month=2027-06`, `?date=2027-06-14` ou `?event=exemple-examen-uc3`.

Un événement invalide (date impossible, fin avant début, catégorie inconnue, identifiant répété…) est écarté de l’affichage avec un avertissement, sans modifier le fichier. Une UC inconnue laisse l’événement visible, sans lien ni statistiques d’UC. Un fichier vide, manquant ou illisible a un état explicite et une erreur de chargement peut être relancée. Recharge la page après modification du JSON.

Les chemins sont relatifs et fonctionnent sous le sous-dossier GitHub Pages. Le workflow copie et versionne les pages et les ressources publiques, y compris ce JSON. La modification se prépare sur la branche dédiée ; **ne pas fusionner vers `main`, pousser vers `main` ou lancer le workflow de publication sans validation préalable**.

## Comprendre le bandeau de préparation

Le bandeau, directement sous l’en-tête de l’accueil, choisit l’examen non fictif en cours ou à venir dont le début est le plus ancien. Une période en cours est donc prioritaire ; après sa date de fin, elle disparaît de la sélection. Si plusieurs périodes commencent ensemble ou sont en cours, un message renvoie au calendrier pour consulter toutes les UC. Le lien du bandeau ouvre le mois du début. Le compte à rebours se met à jour au retour sur l’onglet et au changement de jour (vérification chaque minute).

Les statistiques concernent **les questions des QCM disponibles de l’UC**, et non les cours cochés comme terminés :

- **Exercices terminés** : questions des QCM corrigés au moins une fois / questions disponibles dans l’UC. Une répétition n’augmente pas ce nombre. Un ancien meilleur score, y compris zéro, prouve qu’un QCM a été corrigé.
- **Taux de réussite** : total des bonnes réponses / total des questions de toutes les tentatives historisées, y compris celles avec des erreurs et les répétitions. Les exercices non réalisés ne sont jamais comptés comme des erreurs.
- **Indice indicatif sur 100** : fraction des exercices terminés × fraction de bonnes réponses observées × 100. Exemple de calcul, sans résultat utilisateur : 50 % terminés et 80 % de bonnes réponses donnent 40/100. Les calculs gardent leurs valeurs exactes ; seul l’affichage est arrondi.

L’indice est un repère pour organiser les révisions, **jamais une probabilité de réussir l’examen**. Il ne mesure ni la pratique ni l’oral, et sa portée dépend des QCM disponibles. Aucun seuil, badge ou récompense n’est associé à cet indice.

Le suivi du **Mode Drill** apparaît désormais dans une ligne distincte pour l’UC de l’examen. Ses premières réponses comptabilisées et ses entraînements restent séparés des QCM de cours et de leur indice : les questions réutilisées ne sont pas additionnées comme des questions uniques.

Sans examen, sans UC associée, sans QCM disponible ou sans tentative historisée, le bandeau explique ce qui manque. Avec des QCM disponibles mais non réalisés, la complétion est 0 %, tandis que réussite et indice restent non calculables. Les seuls anciens meilleurs scores ne suffisent pas à inventer un taux de réussite historique : ils contribuent à la complétion et un avertissement précise la portée des données. Dès qu’une nouvelle tentative est enregistrée, réussite et indice utilisent les tentatives documentées.

### Sauvegardes préservées

En visiteur, la clé existante `bprea-demo-progress-v1` reste utilisée. Les champs `done`, `score` (meilleur score) et les autres propriétés sont conservés ; chaque correction ajoute, sous l’identifiant du cours, une entrée à `quizAttempts` contenant `score`, `total` et `completedAt` (date ISO de correction). Les tentatives ne sont pas remplacées lors d’un nouveau QCM. `legacyQuizScore` conserve le meilleur score antérieur à cet historique, sans lui attribuer de date fictive. Les valeurs illisibles sont conservées dans des champs d’archive et exclues des calculs. Les écritures relisent la sauvegarde courante pour préserver les modifications réalisées dans un autre onglet avant l’enregistrement. Le compte configuré utilise un cache personnel IndexedDB par environnement/projet/UUID et ne lit pas cette clé comme progression personnelle.

Les clés `bprea-demo-itk-v1` et `bprea-demo-theme-v1` restent indépendantes. Le calendrier ne modifie aucune donnée utilisateur. En visiteur, aucun résultat n’est envoyé au serveur et le stockage reste propre au navigateur et à l’adresse du site. Dans un compte configuré, cours et QCM sont disponibles sur un autre appareil après confirmation distante ; une panne conserve les opérations sur l’appareil en attente de reprise. Si l’espace local est indisponible ou saturé, le QCM signale que la tentative ne peut pas être conservée. L’historique grandit au fil des corrections, sans purge automatique.

Les parcours vérifiés et les limites de la vérification sont consignés dans [VALIDATION-LOT1.md](docs/validations/VALIDATION-LOT1.md).

## Utiliser et enrichir le Mode Drill

Depuis **Mes cours → S’exercer → Exercices hebdomadaires**, choisis une UC puis une semaine et clique sur « Commencer cette série ». Chaque choix est sauvegardé avant validation. Après validation, la correction explique la réponse ; « Revoir cette question » ajoute un entraînement séparé sans changer le résultat initial de la série. Tu peux reprendre une ancienne série sans avoir terminé les autres.

La semaine suit **Europe/Paris**, indépendamment du fuseau de l’appareil. Dix questions différentes sont sélectionnées de façon reproductible par UC et par semaine ISO. Avec la banque actuelle de 12 questions UC 03, huit questions communes entre deux semaines consécutives sont inévitables ; aucune question n’est dupliquée dans une série. Les UC avec moins de dix questions exploitables affichent « Banque incomplète ». Sans réponse validée, le taux affiche **« Aucune donnée »**.

Pour ajouter un exercice, modifie **`assets/drill-bank.json`** : un document `{"version":1,"questions":[...]}` contient des questions avec `id` permanent, `version` entière positive, `unit`, `chapter`, `concept`, `type: "single-choice"`, `prompt`, `options: [{"id":"a","text":"..."}, ...]`, `answer` (identifiant d’option), `explanation`, `difficulty` et une `reference` facultative `{title,url}`. Utilise au moins deux options aux identifiants distincts et une seule réponse attendue. Les champs facultatifs `sourceLesson` et `sourceQuestionIndex` conservent le lien avec les QCM existants. Lors d’une correction, garde l’identifiant et augmente la version ; les séries commencées gardent leur copie complète des questions.

La progression utilise **`bprea-demo-drill-v1`**, sans modifier les anciennes clés de cours, QCM, ITK ou thème. Chaque série conserve sa semaine, ses questions versionnées, ses brouillons et ses réponses datées ; la première réponse compte une fois, les entraînements sont historisés à part. Le taux est `bonnes premières réponses / exercices réalisés × 100` ; les questions non réalisées n’entrent pas au dénominateur.

Le schéma complet, un exemple JSON réel, les règles de sélection et les limites sont détaillés dans [MODE-DRILL.md](docs/architecture/MODE-DRILL.md). Les vérifications de ce lot sont consignées dans [VALIDATION-LOT2.md](docs/validations/VALIDATION-LOT2.md).

## Lire le Tableau de bord pédagogique

Ouvre **Mes cours → S’exercer → Tableau de bord**. Le filtre d’UC et la période s’appliquent aux résultats affichés ; la comparaison conserve les UC côte à côte sur cette période, avec leurs volumes. Les périodes de 4, 8 et 12 semaines comprennent la semaine courante. L’historique complet va de la première activité fiable, toutes UC confondues, à la semaine courante : changer d’UC garde le même axe temporel. Les graphiques proposent des détails interactifs et une pagination par fenêtre d’au plus 12 semaines ; le tableau conserve toute la période et les totaux ne changent pas en passant d’une fenêtre à l’autre. Une semaine sans réponse reste une absence de données et coupe la courbe de réussite.

Le Tableau de bord lit exclusivement les premières réponses validées des séries du Mode Drill. L’adaptateur `readDashboardData()` sélectionne `readDrillState()` pour le visiteur ou la vue normalisée du service Drill pour le compte vérifié ; le calcul statistique reste indépendant du stockage et du DOM. Une réponse est comptée une fois par couple série/question. Les brouillons, entraînements répétés et QCM de cours n’entrent pas dans ces totaux. Une question reprise dans une autre série hebdomadaire constitue un autre exercice réalisé. Le taux est **bonnes premières réponses / premières réponses réalisées × 100** ; les résultats globaux sont pondérés par le nombre de réponses, jamais par une moyenne des pourcentages. Seul l’affichage est arrondi. Dans un historique accessible sans réponse, les volumes valent zéro et le taux reste « Aucune donnée » ; une source inaccessible a un état d'erreur distinct.

L’activité d’une réponse appartient à la semaine ISO de sa date de validation `answeredAt`, dans **Europe/Paris**. Une ancienne série effectuée aujourd’hui contribue donc à la semaine actuelle, tandis que le Mode Drill continue à présenter ses séries par semaine d’origine. Cette différence de regroupement ne change pas les totaux sur l’historique complet.

Une date `answeredAt` postérieure à l’instant de calcul est exclue, même si elle appartient à la semaine courante. Les réponses futures, les UC inconnues et les données illisibles produisent un avertissement de **bilan partiel** ; leurs valeurs sources restent conservées. Vérifie l’horloge de l’appareil si des dates futures sont signalées.

Les catégories descriptives sont configurables dans `DASHBOARD_THRESHOLDS`, au début de `assets/dashboard-stats.js` : au moins **5 réponses** sont nécessaires ; à partir de **80 %**, un point fort est observé ; sous **60 %**, la notion est à retravailler ; entre les deux, elle est à consolider. Moins de 5 réponses donne « Données insuffisantes ». Ce sont des repères d’organisation sans validation scientifique, sans badge et sans prédiction de réussite à l’examen.

Les notions sont regroupées par **UC + chapitre + notion** à partir des copies de questions enregistrées dans chaque série. Les modifications ultérieures de la banque ne réécrivent pas les résultats historiques ; des changements de libellés peuvent séparer des groupes. Le faible volume de la banque, les répétitions de questions et les notions effectivement couvertes limitent l’interprétation. Les liens vers les cours et exercices reposent sur les associations réellement disponibles.

La page n'exige pas le chargement de la banque actuelle. En visiteur, elle consulte uniquement l'historique local. Dans l'espace personnel configuré, elle consomme la vue du service Drill et peut demander sa synchronisation : les données locales en attente sont signalées et ne sont pas promises sur les autres appareils avant confirmation. Le Dashboard ne modifie pas les réponses et ne résout pas les conflits. Les règles et limites figurent dans [DASHBOARD.md](docs/architecture/DASHBOARD.md), les preuves historiques dans [VALIDATION-LOT3.md](docs/validations/VALIDATION-LOT3.md), et la recette personnelle dans [VALIDATION-LOT6-2-3.md](docs/validations/VALIDATION-LOT6-2-3.md). Aucun déploiement en production ne doit être lancé sans validation.

## Reconnaissance des plantes

Dans **Outils**, choisis Petits fruits, Fleurs ou Légumes maraîchers, puis Découverte sans limite ou Chrono (30 secondes par défaut, durée configurable). Le nombre de questions disponible est annoncé avant de commencer : quatre par catégorie dans ce prototype. Légumineuses reste désactivée en attendant des photographies vérifiées. Le chrono s’arrête pendant les corrections, se met en pause quand l’onglet est masqué et reprend au retour ; une pause manuelle est aussi disponible. Une image indisponible peut être passée sans compter comme erreur.

En visiteur, les résultats utilisent `monbprea.botanical.v1`, séparément du Drill et du Dashboard. Un compte configuré utilise son historique botanique personnel synchronisé, avec import visiteur uniquement volontaire. Le taux porte sur les questions réalisées, dont les expirations du chrono, sans inclure les images indisponibles. Chaque validation est enregistrée ; après rechargement, une nouvelle session peut commencer et l’historique reste consultable. « Revoir mes erreurs » rejoue les espèces déjà mal reconnues sans effacer les tentatives précédentes.

Les 12 photographies sont conservées localement avec leurs crédits : 6 CC0, 4 CC BY-SA 3.0, 1 CC BY-SA 2.5 et 1 CC BY 2.5. Le registre [BOTANICAL-SOURCES.md](docs/architecture/BOTANICAL-SOURCES.md) donne chaque auteur, fichier d’origine et licence. Le guide [RECONNAISSANCE-PLANTES.md](docs/architecture/RECONNAISSANCE-PLANTES.md) décrit le modèle, les statistiques et l’ajout de contenus. Une seule photo par espèce et aucun mode de confusion avancé pour l’instant. Les actions GitHub ont aussi été vérifiées et mises à jour pour Node.js 24 : [ACTIONS-NODE24.md](docs/architecture/ACTIONS-NODE24.md).

## Limites explicites

Le [dossier préparatoire RGPD 6.4.1](docs/rgpd/INVENTAIRE-DONNEES.md) recense les données et stockages, les [flux et prestataires](docs/rgpd/FLUX-ET-PRESTATAIRES.md), le [projet de registre](docs/rgpd/REGISTRE-TRAITEMENTS.md), les [décisions encore à valider](docs/rgpd/DECISIONS-A-VALIDER.md) et les [prérequis des droits](docs/rgpd/PREPARATION-DROITS.md). La [politique de confidentialité](docs/rgpd/POLITIQUE-CONFIDENTIALITE-PROJET.md) est un **projet non validé, non destiné à publication en l'état**. Ce dossier ne prouve pas une conformité acquise et n'ouvre pas les comptes étudiants. Les preuves et limites figurent dans la [validation 6.4.1](docs/validations/VALIDATION-LOT6-4-1.md).

Le [contrat client ITK/apparence](docs/architecture/ITK-APPEARANCE-SYNCHRONISATION-CLIENT.md), la [validation 6.3.4](docs/validations/VALIDATION-LOT6-3-4.md) et le [bilan global 6.3](docs/validations/BILAN-LOT6-3.md) précisent garanties, preuves et étapes avant ouverture. La sauvegarde personnelle des huit paramètres ITK et des choix saison/luminosité suit une confirmation distante, sans génération automatique ni import implicite.

- **Contenus pédagogiques illustratifs** : les formulations des cours sont simplifiées pour la démonstration ; ne remplacent ni les supports des formateurs ni le référentiel de certification. Les intitulés des UC reprennent la structure nationale du BPREA ; leur affectation aux chapitres reste à valider avec le centre.
- **ITK simplifié et non prescriptif** : les densités, périodes et durées sont des ordres de grandeur pédagogiques, pas des recommandations agronomiques validées pour une parcelle donnée. Les paramètres sol/eau déclenchent des avertissements mais pas de calcul de fertilisation, d'irrigation ou de rendement. Aucune prise en compte automatique de la météo, de l'analyse de sol, de la région, des résistances variétales ou du marché.
- **Variétés** : exemples de noms et types, sans base variétale scientifique. Choisir une variété modifie les **points de vigilance**, mais **pas** les dates ni les densités faute de fiches variétales documentées. À développer avec un catalogue sourcé.
- **Stockage** : en visiteur, progression, score, dernière configuration ITK et apparence restent locaux. Les comptes configurés synchronisent Drill, cours/QCM, botanique, derniers paramètres ITK et préférences d’apparence dans des caches IndexedDB isolés par compte, environnement et projet. Les choix automatiques sont interprétés localement sur chaque appareil ; aucun document ITK complet n’est sauvegardé. Effacer les données du navigateur peut perdre des opérations non synchronisées ; la déconnexion ne les efface pas. Le cache personnel n’est pas chiffré.
- **Confidentialité** : les fichiers GitHub Pages sont publics, même lorsque leurs liens sont masqués. Les profils privés doivent être protégés par Supabase/RLS ; ne jamais placer de données privées dans le HTML, les assets ou les PDF publiés. Le service de compte reste désactivé par défaut et l’ouverture à la promotion attend les validations prévues.
- **Polices** : polices système (aucun appel à un service tiers).

## Références pour poursuivre

- [Référentiel BPREA et ressources ministérielles — Chlorofil](https://chlorofil.fr/diplomes/secondaire/bp/rea)
- [Présentation des UC nationales — AgriOrientation](https://www.agrorientation.com/trouver-ma-formation/trouver-une-formation/bp-rea-agriculture-biologique)
- [GitHub Pages — Documentation GitHub](https://docs.github.com/en/pages)

---

Projet de démonstration personnel, octobre 2026.
