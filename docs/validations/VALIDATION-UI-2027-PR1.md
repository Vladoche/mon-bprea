# Fondations UX/UI 2027 — validation PR1

Qualification locale du 15 novembre 2026. Référence : `origin/main` à
`bba6cb07fafe5f58027eeb42aa61bf0a7bbe5fbf` (PR #58 fusionnée).
Les comptes, préférences et historiques des recettes sont fictifs ; aucun accès
à Supabase hébergé ni changement du site publié.

Validation finale locale : `npm ci` réussi, 618 tests unitaires/intégration
réussis et un test ignoré sous Windows, 123 parcours E2E réussis. Le SDK navigateur
reconstruit est identique. Le rendu public de la notice reste reproductible et
l'empreinte du texte approuvé est inchangée. `git diff --check` est sans erreur.

## Procédure reproductible

Avec Node.js 24, Python 3.10+ et le Chromium associé au verrou npm :

```text
npm ci
node scripts/install-chromium.mjs
npm run test:e2e -- tests/e2e/ui-2027.spec.js --workers=2
```

Le serveur E2E prépare aussi l'artefact sous `/mon-bprea/`. La suite vérifie cinq
largeurs (320, 390, 768, 1024 et 1440 px), clavier et retour du focus, Échap,
clic extérieur, changement de largeur, texte agrandi à 200 %, mouvement réduit
et contraste forcé. Un contexte `hasTouch`/`isMobile` effectue de vrais `tap`
Playwright : il s'agit d'une émulation, pas d'une recette sur appareil physique.
Les états compte vérifiés sont connecté, visiteur, vérification en cours,
identité locale hors ligne, succès et erreur de déconnexion. La recette
contrôle la conservation d'un historique local synthétique.

Pour comparer les performances, extraire `assets/` et les fichiers HTML de la
référence dans `.tmp/ui-2027-foundations/baseline`, puis :

```text
node scripts/measure-ui-foundations.mjs
```

La CI prépare cette référence depuis le SHA de base de la PR. Le script sert les
deux versions avec les mêmes en-têtes et alterne cinq chargements de chacune,
dans des contextes navigateur neufs sans cache. Il bloque les requêtes externes.
Conditions : 1440 × 1000 px, automne/clair, CPU ralenti ×4, latence réseau 20 ms,
débit 1 250 000 octets/s, stabilisation d'une seconde après chargement.
Les mesures utilisent l'horloge réelle ; les captures E2E fixent séparément la
date, les préférences, les dimensions et les animations.

## Performance avant/après

Médianes locales sous Windows, Node.js 24.22.0, Chromium 156.0.8078.4
(Playwright 1.64.1). Poids chargés décompressés, mesurés par Resource Timing.

| Mesure | Main | PR1 | Écart |
| --- | ---: | ---: | ---: |
| CSS chargés | 61 013 o | 66 360 o | +5 347 o |
| JavaScript chargé | 804 132 o | 812 383 o | +8 251 o |
| Requêtes, document inclus | 79 | 80 | +1 |
| LCP laboratoire | 1 476 ms | 1 528 ms | +52 ms |
| CLS | 0,2308 | 0,0843 | −0,1465 |
| Événement `load` | 1 179,1 ms | 1 160,2 ms | −18,9 ms |
| Titre et navigation disponibles | 1 555 ms | 1 531 ms | −24 ms |
| Interaction jusqu'à deux images suivantes | 26,8 ms | 34 ms | +7,2 ms |

L'interaction porte sur le changement de luminosité et l'ouverture de Mes cours.
Cette durée de laboratoire **n'est pas un INP de terrain**. Les résultats ne
prouvent pas les performances d'un téléphone réel ou du site hébergé.

Le nouveau footer avait initialement augmenté les déplacements de mise en page
pendant le chargement asynchrone. Les réserves de hauteur du header et du contenu,
ainsi que l'initialisation différée du footer, ramènent le CLS sous 0,1 sans
retirer les bandeaux d'accueil réservés à PR2. Le déplacement résiduel vient de
l'insertion existante des panneaux d'accueil.

Les budgets diagnostiques du script sont : +16 Kio de CSS, +16 Kio de JavaScript,
deux requêtes supplémentaires, hausse LCP maximale de 500 ms ou 50 % de la
référence, CLS ≤ 0,1 et interaction laboratoire ≤ 200 ms. Aucune alerte sur la
campagne finale. Le JSON conserve mesures brutes, sources des déplacements,
médianes et alertes ; la CI le publie dans `ui-performance-lab-<run_id>`.
Ces budgets signalent une investigation, sans bloquer sur une note globale.
Ce contrôle Playwright léger est l'équivalent retenu pour cette PR à la place
d'une nouvelle dépendance Lighthouse CI ; il compare les métriques utiles.

## Captures et approbation humaine

La suite fournit quinze images dans `test-results/` et dans l'artefact CI
`playwright-review-<run_id>`, conservé quatorze jours même en cas de succès :

| Sujet | Fichiers |
| --- | --- |
| Accueil ordinateur | `home-desktop-light.png`, `home-desktop-dark.png` |
| Accueil mobile | `home-mobile-light.png`, `home-mobile-dark.png` |
| Menus Mes cours et Outils | `header-courses.png`, `header-tools.png` |
| Menu Mon profil | `profile-desktop.png`, `profile-mobile.png` |
| Footer | `footer-desktop.png`, `footer-mobile.png` |
| Contact sans JavaScript | `contact-nojs.png`, `contact-nojs-dark.png` |
| Confidentialité sans JavaScript | `confidentialite-nojs.png`, `confidentialite-nojs-dark.png` |
| Cours représentatif | `course-desktop.png` |

Les captures des menus cadrent le header et le panneau par l'API native du
navigateur. Elles ne sont pas retouchées. Les autres captures de pages sont
complètes. Aucune nouvelle image n'est automatiquement considérée comme une
référence approuvée. Après approbation humaine seulement, créer et versionner
les références Playwright avec `--update-snapshots` dans l'environnement de
référence choisi ; la suite compare alors les références présentes par
`toHaveScreenshot`. Les systèmes Windows et Linux possèdent des références
distinctes : ne pas accepter leurs différences de rendu à l'aveugle.

Par rapport à la [maquette fournie](https://chatgpt.com/s/m_6af9857c7dc48191b4de1b9fd43c26f9), le header conserve logo, sous-titre, pilules,
icônes homogènes, accent terracotta et commande de luminosité. Les liens et
leurs chevrons restent deux contrôles explicites. Le verre est atténué pour la
lecture et le footer utilise un paysage SVG léger et uniquement des destinations
existantes. Le hero photographique et la recomposition des cartes ne sont pas
repris : les contenus d'accueil restent dans le périmètre de PR2.

## Accessibilité et limites

Les contrôles automatisés vérifient les noms accessibles, les cibles du header,
le focus clavier et le contraste du texte commun sur les couches CSS composées,
y compris les arrêts des dégradés simples. Les textes de navigation et du footer
doivent atteindre 4,5:1 en clair et sombre ; les deux pages autonomes sont aussi
contrôlées sans JavaScript. Le rapport `shared-accessibility.json` est joint au
résultat Playwright. Ces assertions ciblées ne constituent ni un audit WCAG
complet ni une recette avec lecteur d'écran. Le zoom natif du navigateur et un
appareil physique restent distincts des contrôles de reflow et de texte agrandi.

Les préférences saisonnières, la luminosité automatique, les imports et les
contrats de données restent ceux des services existants. Les tests Auth HTTP
simulés vérifient l'interface ; ils ne prouvent pas RLS. Aucun schéma, politique
SQL, permission ou réglage Auth hébergé n'est modifié par cette PR.
