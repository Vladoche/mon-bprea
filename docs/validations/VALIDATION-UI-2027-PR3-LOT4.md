# Tableau de bord et statistiques — PR3 lot 4

Recette du **18 novembre 2026**. Ce lot clôt la refonte PR3 de l’expérience
pédagogique, après les pages UC, les cours, les QCM et les exercices
hebdomadaires. Il améliore la lecture de l’activité et l’accès aux révisions.
[PR #69](https://github.com/Vladoche/mon-bprea/pull/69).

## Périmètre et référence

- Base synchronisée avec GitHub avant intervention
  `fc5fcadfd9103f81fabdffee3025b3282fbb113c`, fusion de [#68](https://github.com/Vladoche/mon-bprea/pull/68)
  le 18 novembre à 12:27:27 UTC.
- Branche `codex/ui-2027-dashboard` dans un espace de travail Git dédié. Code
  mesuré et testé localement sur `955b886b5ac81e2bd2c3a0d3fe85672037d15bfd`.
- Présentation dans `assets/dashboard.js` et `assets/dashboard.css`. L’entrée
  `tableau-de-bord.html`, les liens de navigation et les préférences d’apparence
  réutilisent les points d’entrée existants.
- Recette dans `tests/fixtures/dashboard.js`, `tests/e2e/ui-2027-dashboard.spec.js`,
  `tests/e2e/dashboard-sync.spec.js` et `tests/unit/dashboard-stats.test.js`.
  Comparaison et galerie dans `scripts/ui-dashboard-lab.mjs`, raccordées à
  `scripts/measure-ui-foundations.mjs` et au [workflow Qualité](../../.github/workflows/quality.yml).
- Contrat, projet et historique actualisés dans [DASHBOARD.md](../architecture/DASHBOARD.md),
  [ETAT-DU-PROJET.md](../developpement/ETAT-DU-PROJET.md) et [CHANGELOG.md](../../CHANGELOG.md).

## Rendu et contrats

| Zone | Présentation |
| --- | --- |
| En-tête et filtres | Fil d’Ariane, lien direct aux exercices, filtres natifs, nom complet de l’UC et dates de la sélection. |
| Bilan | Cinq cartes en grille adaptative. Le taux est associé aux premières réponses réalisées. |
| Évolution | Barres empilées avec hachures, chiffres de volume, ligne interrompue et tiret pour une semaine vide. Chaque fenêtre montre jusqu’à 12 semaines et le tableau couvre la période entière. |
| Comparaison | Une ligne par UC, avec code, intitulé, volumes, taux, repère facultatif et sélection textuelle. Le tableau reste disponible. |
| Révisions | Quatre groupes repliables par observation, avec cartes nommées par notion, UC et chapitre. Les destinations de cours proviennent des copies historiques validées. Le Drill reste accessible pour chaque UC. |
| Source et méthode | Portée visiteur ou compte, états de disponibilité et action d’actualisation. Bilan partiel et méthode accessibles à la demande. |

`createDashboardModel()`, `DASHBOARD_THRESHOLDS`, l’adaptateur de données, le moteur,
les stores et le service Drill sont identiques à la base Git. Les seuils de
5 réponses, 80 % et 60 % conservent leur sens. Une première réponse validée compte
une fois par série et question, d’après `answeredAt` en semaine ISO Europe/Paris.
Les taux restent pondérés et les brouillons, entraînements et QCM restent exclus.
Les instantanés conservés déterminent les résultats anciens.

Le composant lit le service existant et appelle `service.retry()` pour actualiser.
Il conserve les régions dont le contenu est identique. Si une région change, elle
retrouve les sections ouvertes ou fermées, les défilements, la semaine et le focus
applicables. Le changement d’identité efface le contenu privé avant de calculer
la nouvelle vue. Les retours tardifs d’une actualisation sont invalidés par le
changement d’identité.

## Contrôles et résultats locaux

Node.js **24.22.0**, Playwright **1.64.1**, Chromium verrouillé **156.0.8078.4**.
Le navigateur et le serveur de test utilisent des contextes isolés.

| Contrôle | Résultat |
| --- | --- |
| `npm ci` | Installation des 50 paquets du verrou. L’audit npm a signalé 5 avis de sévérité élevée avec ce verrou préexistant. |
| `npm test` | **643 réussis**, 1 ignoré, 59 fichiers. Inclut Dashboard, Drill, stockage, snapshots, service et intégrations de synchronisation. |
| `npm run test:e2e -- --workers=3` | **198 réussis**, dont 10 scénarios Dashboard dédiés et les parcours critiques. Inclut le site source et l’artefact local au préfixe `/mon-bprea/`. |
| SDK et build statique | `npm run build:auth-sdk` et comparaison Git sans différence normalisée sur le SDK. Notice reproductible avec `node scripts/build-privacy-notice.mjs --check`. L’artefact Pages est généré et visité en local par la suite navigateur. |
| Parité avec `main` | **12 sélections et états** comparés à heure et données égales. Identité stricte des cinq valeurs et cellules numériques des tableaux semaine/UC/chapitre. Le jeu long commun couvre 46 semaines et 35 exercices, dont 21 corrects, soit **60 %**. |
| Lecture seule | Parcours Accueil → S’exercer → Tableau de bord → cours puis Drill. Les valeurs de stockage Drill et progression restent identiques, y compris après filtres et actualisation. L’observation des appels au stockage ne relève aucune écriture pédagogique. |
| Identité et contexte | Scénarios simulés avec cache en chargement, attente, hors ligne, conflit, cache inaccessible, session rejetée et retour d’actualisation après passage à B. Un changement de statut conserve le graphique dans le DOM. Une nouvelle réponse conserve la semaine, le focus et les défilements du graphique et du tableau. |

Les tests existants couvrent les séries incomplètes, les entraînements, les
références historiques et les exclusions. Les nouveaux contrôles vérifient
aussi un vrai 0 %, un taux de 100 %, les semaines vides successives, les
périodes 4/8/12 et l’historique complet, le filtre depuis la comparaison, deux
notions homonymes et le lien de repli sans cours. Les trois nouveaux cas de
frontière vérifient le passage de l’année ISO ainsi que les deux changements
d’heure à Paris.

## Captures et accessibilité

La galerie locale `.tmp/ui-2027-pr3-lot4/dashboard-review/comparaison-dashboard.html`
contient **70 captures**, aux mêmes dimensions et avec les mêmes données de test
pour chaque paire. Elle compare les états vide, une réponse, historique riche
et UC sélectionnée, les graphiques avec trous et vrai 0 %, la comparaison,
les notions à retravailler et données insuffisantes, les exclusions, le
chargement, le hors ligne, les conflits, la session à vérifier et les thèmes.
Les paires principales sont à 1440 et 390 px, avec une paire d’historique à
768 px. Les captures des états personnels utilisent des snapshots simulés.
Le job `ui-performance-lab` produit aussi cette galerie et le JSON comparatif
dans son [artefact GitHub Actions](https://github.com/Vladoche/mon-bprea/pull/69/checks).

Inspection visuelle des cartes, dates, graphes, états et inversions de couleurs.
Le contrôle navigateur passe à **320, 390, 640, 768, 1024 et 1440 px** et à 200 %
de taille de texte sur 390 px. Les graphiques et tableaux larges défilent dans
leur région. Survol, tap émulé, Tab et flèches ont été vérifiés. Les points SVG
ont un nom et un détail accessibles, avec un seul point par graphique dans
l’ordre de tabulation. La lecture des valeurs ne déclenche pas d’annonce live
supplémentaire. Le focus est visible en contraste forcé et les transitions
s’effacent en mouvement réduit.

Contrastes de paires de tokens mesurés dans Chromium sur les quatre saisons
claires et sombres. Minimum **4,71:1** pour les paires de texte relevées,
**4,37:1** pour les marques pleines et lignes sur surface, **5,32:1** pour le
focus sur les fonds testés. Les hachures, tirets, légendes et libellés conservent
le sens en contraste forcé.

## Performance en laboratoire

Cinq passages à cache froid par version, référence et refonte alternées.
Chromium 1440 × 1000, ralentissement processeur ×4, latence 20 ms,
débit 1 250 000 octets/s, serveur local sans compression. L’instant civil des
données est fixé au 18 novembre, l’horloge de mesure reste native. Les
interactions sont mesurées jusqu’à la deuxième image rendue. L’actualisation
relit un historique visiteur enrichi d’une réponse.

| Médiane | Référence | Refonte |
| --- | ---: | ---: |
| CSS chargé, octets | 71 495 | 77 942 |
| JavaScript chargé, octets | 829 993 | 830 390 |
| Requêtes avec le document | 79 | 79 |
| LCP, ms | 1 368 | 1 576 |
| CLS au chargement | 0,1420 | 0,0515 |
| Première valeur disponible, ms | 1 470 | 1 442 |
| Filtrer par UC, ms | 140 | 119 |
| Changer de fenêtre, ms | 77 | 33 |
| Examiner une semaine au clavier, ms | 10,9 | 9,1 |
| Actualiser, ms | 106 | 63 |
| Déplacement de contenu à l’actualisation | 0,00629 | 0,00030 |

Le LCP augmente de **208 ms** sur ce banc. Le CSS ajoute **6 447 octets** pour
les dispositions, les états et les styles des graphiques. Le JavaScript ajoute
397 octets et le total de requêtes reste stable. Le banc ne signale aucun
dépassement de ses budgets diagnostiques et la première valeur apparaît 28 ms
plus tôt. Le changement de filtre ajoute un déplacement de **0,00009** au
relevé qui inclut les interactions. Les défilements verticaux médians sont de
0 px pendant les quatre interactions mesurées. Le JSON brut se trouve dans
`.tmp/ui-2027-pr3-lot4/performance-dashboard.json`. Les mesures décrivent le
laboratoire local.

Pour reproduire depuis la racine, préparer la référence publique depuis Git.
Ces commandes utilisent Bash ou Git Bash.

```bash
mkdir -p .tmp/ui-2027-pr3-lot4/reference
base=fc5fcadfd9103f81fabdffee3025b3282fbb113c
git archive "$base" assets documents ':(top,glob)*.html' | tar -xf - -C .tmp/ui-2027-pr3-lot4/reference
node scripts/measure-ui-foundations.mjs --page 'tableau-de-bord.html?period=all' \
  --baseline .tmp/ui-2027-pr3-lot4/reference --baseline-ref "$base" \
  --output .tmp/ui-2027-pr3-lot4/performance-dashboard.json
```

## Anomalies corrigées et limites

- Le tableau ouvert déterminait initialement la largeur de la grille à
  320 px. Les colonnes du contenu se contractent et les tableaux conservent
  leur défilement dédié. Le nom de l’UC s’affiche intégralement dans la
  sélection, y compris lorsque le contrôle natif abrège son option.
- Le premier essai du laboratoire utilisait l’horloge Playwright, qui
  remplaçait les entrées de performance. Le banc gèle maintenant uniquement
  la date civile. Les chiffres publiés viennent de la campagne corrigée.
- Les contrôles visuels et tactiles portent sur Chromium, sans appareil
  physique ni lecteur d’écran manuel. La CI réelle utilise une stack Supabase
  éphémère. Les anciens volumes de la stack Windows sont restés en place.
- Cette recette concerne la branche et les environnements de test. La PR
  reste ouverte pour revue. Pages et PROD n’ont fait l’objet d’aucune opération.


## CI et conservation des preuves

Les quatre checks passent sur le commit de la refonte `955b886`. La Qualité
confirme les tests applicatifs, le rendu statique et le banc de performance.
Sur son runner, le Dashboard passe de **1 144 à 1 116 ms** de LCP médian et
de **0,1420 à 0,0621** de CLS. Les mesures complètes et la galerie sont
jointes au workflow. [Qualité et artefacts](https://github.com/Vladoche/mon-bprea/actions/runs/44317845924#artifacts).

La CI Supabase exécute pgTAP, les tests Auth et RLS et les parcours Chromium
avec de vrais comptes fictifs. Les scénarios Dashboard couvrent deux appareils,
les réponses en attente, le cache hors ligne, le conflit sans double comptage
et l’isolement de deux comptes. La stack locale éphémère est arrêtée à la fin.
Les checks de chaque révision de la PR sont accessibles sur GitHub.
[Supabase Auth/RLS](https://github.com/Vladoche/mon-bprea/actions/runs/44317845786),
[checks de la PR](https://github.com/Vladoche/mon-bprea/pull/69/checks).

Après l’arrêt des tests, `npm run delivery:complete` a retiré **22,58 Mo**
de builds E2E qualifiés. Il reste **125,49 Mo** dans le `.tmp` de cet espace,
sous le plafond de 500 Mo. L’archive intermédiaire recréable de la base a été
retirée séparément (22,72 Mo). Galerie, référence extraite et relevés restent
dans le dossier de recette.

**GO — PR3 lot 4 validé**
