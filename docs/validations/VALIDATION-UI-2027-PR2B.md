# UX/UI 2027 — fidélité visuelle PR2b

Base : PR #60 fusionnée, `c7025a5136f0b19275704a49cf41a888b122059a`.
Branche : `fix/ui-2027-visual-fidelity`. Référence prioritaire : maquette
fournie par le propriétaire le 16 novembre 2026. Les deux images sont conservées
dans `tests/fixtures/ui-2027-pr2b/` pour la galerie CI, et dans la campagne locale
`.tmp/ui-2027-pr2b/`, hors site publié. La liste blanche Pages exclut `tests/`.

## Comparaison avant modification et critères observables

| Élément | Maquette / écart PR2 | Composant et correction prévue | Critère observable |
| --- | --- | --- | --- |
| Composition | Grands panneaux cohérents / sections dispersées | `home.css`, structure `initHome` : quatre ensembles | Hero, carnets, bénéfices, bandeau final identifiables |
| Header | Surface vitrée large / surface opaque plus étroite que les panneaux souhaités | Conserver navigation PR1 ; harmoniser seulement les surfaces de l’accueil | Quatre rubriques et menus identiques, largeur alignée |
| Géométrie hero | Panoramique / deux colonnes et image carrée | Image intégrée sous une seule surface arrondie | Un seul panneau, aucune carte image autonome |
| Typographie | Titre sur deux lignes / titre sur trois lignes très haut | Largeur de lecture et corps ajustés | Titre compact, texte intégral sans troncature |
| Rapport texte/image | Lecture à gauche et paysage à droite / deux blocs égaux | Image de fond décorative et voile stable | Paysage visible à droite, contraste indépendant de l’image |
| Photographie | Serre réaliste douce / SVG schématique | WebP local original généré avec ImageGen | Serre et cultures reconnaissables, image chargée |
| Transparence | Surfaces vitrées / aplats opaques | Dégradés, bord lumineux, transparence progressive | Relief visible, fond solide sans filtre |
| Dégradés | Ivoire, sauge, terracotta / aplats uniformes | Tokens PR1 réutilisés, accents atmosphériques | Ensemble discret, thèmes conservés |
| Boutons | Actions très visibles / boutons plats | Dégradé terracotta, ombre diffuse, icône | Deux actions hero distinctes, focus visible |
| Carnets | Introduction et trois cartes dans un panneau / titre isolé et grandes cartes | Grille introduction + trois cours réels | Même surface, cartes compactes, destinations inchangées |
| Fond | Ivoire nuancé / ivoire uniforme | Atmosphère statique discrète sur accueil | Aucune animation permanente |
| Espacements | Sections rapprochées / longs vides verticaux | Espacements PR1 et proportions réduites | Composition complète moins haute à 1440 px |
| Enchaînement | Quatre bénéfices visuels puis un CTA / listes et séparateurs | Quatre cartes avec textes factuels | Un seul bouton dans le bandeau final |
| Footer | Paysage ample et surface douce / paysage très discret | CSS accueil seulement ; destinations PR1 conservées | Paysage visible, informations légales conservées |

## Fonctionnalité et rendu constatés

Seul le gabarit visuel de `initHome` change dans JavaScript. `updateLearningOverview`,
les calculs, sources de progression, destinations, stockage et synchronisations
restent inchangés. Une barre agrégée réutilise le binding de progression UC 03
existant : 0 % et 25 % réels testés, absence de jauge si la source est inconnue.
Les trois titres et descriptions réels sont conservés intégralement.

Le hero est un panneau panoramique unique, dont le paysage est intégré sous un
voile stable. Son titre tient sur deux lignes à 1440 px. La section des carnets
réunit introduction, progression et trois cartes ; les quatre bénéfices et le
bandeau final remplacent les listes et séparateurs de PR2. Les cartes des hubs
reçoivent uniquement dégradés, ombres et arrondis cohérents. Le footer garde son
SVG et tous ses liens réels ; son paysage est plus visible sur l’accueil.
Le code de navigation, les rubriques, les menus, les préférences et la notice
approuvée restent inchangés.

## Grille de fidélité après correction

| Élément | Référence | Implémentation PR2b | Conforme ? | Réserve |
| --- | --- | --- | --- | --- |
| Composition | Grands ensembles arrondis | Hero, carnets, bénéfices, appel final | Structure oui | Approbation esthétique humaine requise |
| Header | Grand bandeau, menus, profil | Header PR1 conservé et aligné avec les panneaux | Fonctionnel oui | Surface PR1 plus opaque ; visiteur affiche Connexion |
| Hero | Panorama unique, texte à gauche | 1360 px maximum, environ 410 px de haut | Structure oui | Se développe avec le texte et sur mobile |
| Texte/image | Zone de lecture stable, paysage à droite | Voile opaque à gauche et transition progressive | Oui | Photo originale, cadrage différent |
| Photographie | Serre et cultures douces | Serre maraîchère générée, WebP local | Direction oui | Ce n’est pas la photographie de la maquette |
| Typographie | Titre ample sur deux lignes | Deux lignes desktop, BPREA terracotta | Oui avec adaptation | Tokens et polices PR1 conservés |
| Boutons | Actions pleines et relief | Terracotta dégradé, action secondaire claire | Oui | Libellé dépend toujours de l’historique fiable |
| Carnets | Introduction + trois cartes horizontales | Un panneau commun, trois vrais cours UC 03 | Oui avec adaptation | Titres, descriptions et provenance demandent plus de hauteur |
| Progression | Pourcentages illustratifs par catégorie | Une barre agrégée et états de cours réels | Adaptation nécessaire | Aucun taux fictif par cours |
| Glass | Surfaces lumineuses translucides | Bords clairs, dégradés, ombres, flou de 8 px sur cinq surfaces | Oui, à apprécier | Repli solide sans backdrop-filter testé |
| Arrière-plan | Ivoire, nuances vertes, feuillage rare | Ivoire et halos statiques discrets | Partiel | Feuillage périphérique non reproduit |
| Bénéfices | Quatre cartes illustrées | Quatre cartes sobres avec fonctions réelles | Structure oui | Pictogrammes PR1, sans nouvelle illustration détaillée |
| Appel final | Un bandeau et un bouton | Bandeau végétal avec destination Mes cours | Oui | Libellé exact adapté aux UC disponibles |
| Footer | Relief et paysage végétal | Surface douce et paysage SVG plus visible | Partiel | Paysage PR1 géométrique ; aucun faux lien ajouté |
| Mobile | Adaptation accessible | Paysage intégré en bas du hero, cartes verticales | Oui | Pas de maquette mobile fournie ; jugement humain requis |

La fidélité se juge sur la composition et les captures normalisées, sans score
pixel artificiel. Les différences liées aux données fiables, aux liens légaux,
au compte visiteur et au reflow sont volontaires. Aucune fidélité parfaite ni
approbation esthétique définitive n’est revendiquée.

## Vérifications et limites

Node.js 24.22.0, Chromium 156.0.8078.4 (Playwright verrouillé 1.64.1), `npm ci`
réussi sans nouvelle dépendance. `npm test` : **623 réussis, 1 ignoré**.
Le premier passage dans le bac à sable échouait sur les permissions Windows ;
la suite complète passe dans le contexte système habituel. Le serveur E2E
orphelin de la veille a été identifié puis arrêté. Un essai sur port alternatif
n’était pas compatible avec les fixtures Auth fixées sur 4173 ; les résultats
retenus proviennent uniquement du port standard.

**23 contrôles ciblés PR1/PR2/PR2b réussis** avant la campagne générale. La recette
générale finale réussit ensuite : **136 E2E sur 136**, y compris les quatre
nouveaux scénarios PR2b, sans renouvellement de snapshot approuvé. Elle
vérifie cinq largeurs (320/390/768/1024/1440), texte doublé avec Verdana, clavier,
focus, menus, tactile simulé, clair/sombre, mouvement réduit, contraste forcé,
progression connue/inconnue, reprise datée et séparation des comptes fictifs.
Le débordement du titre de panneau à 320 px avec texte doublé a été corrigé.
L’inspection à 768 px a conduit à deux colonnes pour les bénéfices et au repli
du bandeau final. Les contrastes du hero sont mesurés sur la photographie et
le voile réellement rendus : capture diagnostique avec texte transparent,
échantillonnage sous les rectangles de texte puis calcul de luminance.
Les dix combinaisons largeur/thème doivent toutes atteindre 4,5:1, y compris
sans backdrop-filter. Ce diagnostic ne remplace pas un audit WCAG complet.
Pas de recette lecteur d’écran, appareil physique, zoom natif ou réseau mobile
réel revendiquée. Les captures de revue ne sont jamais retouchées.

Le SDK reconstruit est identique. Le rendu public de la notice est reproductible,
SHA-256 LF `c2b2422b9c3d6b7ec25227f143080782842c4c077f5a1361d4cd36653ad9b8c1`.
Aucune modification Auth/RLS/migration : les tests réels Supabase locaux ne sont
pas rejoués pour ce correctif graphique. Les scénarios HTTP vérifient l’interface,
pas la sécurité RLS ; le check CI dédié reste distinct.

## Captures et galerie

La nouvelle suite `tests/e2e/ui-2027-fidelity.spec.js` produit **25 captures PR2b** :
cinq pages complètes claires, deux sombres, douze cadrages header/hero/carnets/
bénéfices/appel/footer à 1440 et 390 px, et six captures des trois hubs desktop/mobile.
Elle copie aussi les deux références fournies dans son répertoire de résultat.
La galerie `revue-visuelle.html` compare maquette, PR2 et PR2b à largeurs visuelles
normalisées, sans déformer les proportions. Les cadrages sont capturés directement
par Playwright ; aucune image n’est intégrée au site public.

Revue locale conservée : `.tmp/ui-2027-pr2b/review/revue-visuelle.html`.
La CI publie la galerie et ses images avec `test-results/` dans l’artefact existant
`playwright-review-<run_id>`, quatorze jours. Les snapshots approuvés existants ne
sont ni remplacés ni renouvelés. Les nouvelles images sont des propositions.
La campagne locale, ses mesures et sa dernière revue utile restent conservées
jusqu’à la validation humaine et la clôture de la PR.

## Performance PR2 fusionnée → PR2b

Même `scripts/measure-ui-foundations.mjs`, archive publique de `origin/main`
contenant PR #60 : cinq chargements froids alternés par page, serveur sans
compression/cache, 1440 × 1000 px, CPU ×4, latence 20 ms, débit 1 250 000 o/s,
stabilisation une seconde, automne/clair. La photographie est chargée dans
les mesures. Aucun trafic extérieur ni compte réel. Les résultats historiques
PR2 ne sont pas réutilisés comme s’ils étaient mesurés sur cette machine.

Le premier passage détectait un CLS de 0,015 lié à l’effondrement de la marge
supérieure du hero pendant son insertion asynchrone. `display:flow-root` sur le
main d’accueil contient cette marge ; la nouvelle campagne revient à zéro.
Les mesures finales de l’accueil ont été rejouées après cette correction.


| Page | LCP (ms) | CLS | Transféré document inclus (Ko) | Requêtes |
| --- | ---: | ---: | ---: | ---: |
| Accueil | 1496 → 1548 | 0.00000 → 0.00000 | 899.58 → 1007.22 | 78 → 78 |
| Mes cours | 1260 → 1244 | 0.00000 → 0.00000 | 907.24 → 907.97 | 79 → 79 |
| S’exercer | 1328 → 1348 | 0.00041 → 0.00041 | 890.60 → 891.35 | 76 → 76 |
| Outils | 1276 → 1284 | 0.00000 → 0.00000 | 890.59 → 891.34 | 76 → 76 |

Accueil : images **2668 → 102764 octets**, CSS **70894 → 78029 octets**, JavaScript **799736 → 799898 octets**. Disponibilité utile **1491.3 → 1528.5 ms**, cartes **1499.3 → 1536.0 ms**, interaction **30.8 → 37.0 ms**.

Le paysage ajoute environ 100 Ko chargés sur ordinateur ; la variante mobile
pèse 37 084 octets. Deux fichiers sont versionnés, une seule variante demandée
par chargement. Le flou de verre est limité au panneau des carnets et aux quatre
bénéfices ; aucun flou permanent animé. Aucun budget diagnostique dépassé sur
les quatre pages. Le coût cumulé des effets et de l’image est inclus dans ces
mesures ; pas de profilage GPU isolé ni d’INP terrain revendiqué. Les poids CSS/JS
sont décompressés ; les octets transférés incluent les en-têtes du serveur local.
Les JSON bruts sont conservés dans la campagne et produits également par la CI.

[Provenance, conditions d’utilisation et prompt du paysage](UI-2027-PR2B-VISUEL.md).

Aucune mutation Supabase PROD, aucun déploiement Pages, aucune fusion automatique.

## Réserves de revue

Aucune régression fonctionnelle observée dans les suites exécutées. La seule
étape humaine indispensable avant fusion est la revue esthétique des captures,
en particulier la nouvelle serre, la densité des cartes réelles et le footer
plus sobre que la maquette. Les décorations périphériques omises restent P2.

`git diff --check` réussi. Après arrêt des processus de recette et simulation,
`npm run delivery:complete -- --json` a retiré un build E2E inactif reconnu :
**22,36 Mo libérés**, 142 fichiers, zéro échec. **2 767,24 Mo** restent dans
`.tmp`, au-delà du plafond de 500 Mo, dans les groupes conservés/protégés et
les campagnes de preuve ; aucune purge supplémentaire. La galerie PR2b et les
sauvegardes historiques sont préservées.

## Lot complémentaire PR2c — Navigation et menus

Qualification du 16 novembre 2026, sur la même branche et la PR #61 ouverte.
Référence de cette comparaison : **PR2b avant PR2c**,
`7757fb3980c67a818795103c29845891e41f85e2`. Les sections précédentes décrivent
la qualification initiale de PR2b ; ce complément actualise la navigation.

- **Défauts corrigés.** Suppression de la règle globale de soulignement
  `[aria-current="page"]`, sans surcharge `!important` et sans retirer l’attribut.
  Les quatre destinations sont contrôlées par leur style calculé au repos,
  au survol et au focus. Le point du logo utilise désormais le token terracotta
  de texte : l’ancienne couleur échouait à 2,78:1 en sombre dans le nouveau test.
- **États visuels.** Pilules communes avec dégradé crème, bord fin, reflet,
  ombre douce ; voile terracotta progressif au hover, élévation de 1 px sans
  déplacement des voisins. La page active garde une surface terracotta et un
  texte clair. Le panneau ouvert possède un bord/relief et un chevron distincts,
  sans prétendre devenir la page courante. Focus avec contour dédié de 3 px.
- **Panneaux.** Sections, codes UC et pictogrammes homogènes, destinations
  intégralement conservées. Profil reste limité à Informations du compte,
  Paramètres et Déconnexion, sans titre redondant. La surface est presque
  opaque, avec un flou limité à 10 px sur l’unique panneau ouvert. Le flou du
  conteneur de header est retiré pour éviter qu’il enferme celui des panneaux
  dans une racine de composition produisant des textes fantômes du hero.
- **Ancrage.** Structure native conservée hors des entrées. Au-dessus de 600 px,
  Mes cours et Outils se centrent sous leur pilule ; Profil s’aligne sur son bord
  droit. Position et hauteur disponible sont bornées au conteneur/viewport.
  Mesures à l’ouverture, au resize et aux changements de taille des entrées
  (identité tardive, texte/préférences), regroupées dans une seule frame.
  Aucun suivi continu de coordonnées quand les panneaux sont fermés.
  Les observateurs et écouteurs sont libérés avec l’AbortController existant.
  Le défilement suit naturellement l’ancrage absolu sans écouteur de scroll.
- **Mobile et fermeture.** Un seul panneau est ouvert à la fois, également sur
  smartphone : ce changement intentionnel évite l’empilement de plusieurs
  longs menus. Panneau dans le flux, hauteur bornée et défilement intérieur ;
  codes UC au-dessus des intitulés pour le texte agrandi. `hidden`, `inert`
  et `aria-hidden` ferment immédiatement l’accès clavier/lecteur d’écran.
  Opacité/déplacement de 5 px pendant 140 ms et chevron pendant 160 ms,
  sans attente avant le focus. Les moteurs compatibles assurent la transition
  de fermeture discrète ; repli immédiat et utilisable sinon. Mouvement réduit
  sans transition, contraste forcé et absence de backdrop-filter contrôlés.

**Contrôles réellement exécutés.** `npm test` : **623 réussis, 1 ignoré**.
Les suites PR1/PR2/PR2b et navigation passent ensemble ; campagne générale finale :
**144 E2E réussis**, dont **8 nouveaux scénarios PR2c**. Entrée, Espace, Tab,
Shift+Tab, Échap et retour du focus, second clic, clic extérieur, changement de
menu, routes exactes et éléments fermés non focusables sont vérifiés. L’ancrage
est contrôlé à 320/390/768/1024/1440 px, avec texte à 200 %, pendant un resize
sur la même disposition, un passage sur deux rangées, un changement mobile,
un défilement et l’arrivée tardive de l’identité. Le panneau reste devant le
hero sans modifier la hauteur desktop du header. Toucher Playwright émulé,
y compris Profil et changement de menu, sans appareil physique revendiqué.

Les textes du header et des trois panneaux atteignent **4,5:1** dans les
**32 combinaisons surface/saison/luminosité** testées par échantillonnage de la
surface réellement rendue, y compris le paysage derrière le verre. Le repli
sans filtre est aussi vérifié. Les préférences et la luminosité automatique
restent couvertes par les scénarios existants. Ces contrôles ciblés ne
constituent ni un audit WCAG complet, ni une recette lecteur d’écran/zoom natif.

**Captures.** La suite `tests/e2e/ui-2027-navigation.spec.js` fournit **16 vues**
(repos, actif, hover, trois menus desktop, sombre, tablette, mobile, focus et texte
à 200 %) et une galerie `revue-navigation.html`. Quatre captures avant changement
PR1/PR2 et PR2b, avec SHA documentés dans `tests/fixtures/ui-2027-pr2c/`, permettent
une comparaison à dimensions équivalentes. Elles sont exclues de Pages.
Les **25 captures globales PR2b** et leur galerie sont également régénérées.
Revue locale : `.tmp/ui-2027-pr2c/review/revue-navigation.html` et
`.tmp/ui-2027-pr2c/global-review/revue-visuelle.html`. Galerie et images sont
publiées par l’artefact Playwright CI existant, conservé quatorze jours.
Aucune référence visuelle approuvée n’est renouvelée automatiquement.

Le seul ajustement du scénario de clic extérieur concerne le nouveau test :
le panneau Mes cours recouvre maintenant volontairement le centre du h1 ;
le clic se fait sur la partie visible du hero, sans `force`. Aucune assertion
existante de non-régression n’a été affaiblie.

**Performance PR2b avant PR2c → après PR2c.** Même protocole de laboratoire,
cinq chargements froids alternés par page, CPU ×4, 1440 × 1000, réseau 20 ms /
10 Mbit/s, aucun test concurrent. La CI conserve en parallèle la comparaison
de l’ensemble de la PR #61 avec sa base PR2 fusionnée.

| Page | LCP (ms) | CLS | Requêtes | Interaction de laboratoire (ms) |
| --- | ---: | ---: | ---: | ---: |
| index | 1536 → 1536 | 0.00000 → 0.00000 | 78 → 78 | 37.5 → 38.8 |
| mes-cours | 1236 → 1252 | 0.00000 → 0.00000 | 79 → 79 | 35.9 → 36.2 |
| s-exercer | 1348 → 1308 | 0.00041 → 0.00041 | 76 → 76 | 32.0 → 32.4 |
| outils | 1288 → 1344 | 0.00000 → 0.00000 | 76 → 76 | 28.8 → 36.3 |

Accueil : CSS **78 231 → 81 078 octets**, JS **800 263 → 802 863 octets** ;
images inchangées (**102 764 octets**), transfert total **1 007,79 → 1 013,23 Ko**.
Aucun budget diagnostique dépassé. Mesures Windows, pas d’INP terrain ni de
profilage GPU isolé revendiqués. SDK reconstruit identique ; notice approuvée
reproductible avec son empreinte inchangée. Vérification du diff et recherche
des secrets/données personnelles dans les ajouts sans anomalie détectée.

**Réserves.** Validation esthétique humaine toujours nécessaire avant fusion.
Le reflow à 200 % et les menus mobiles privilégient le texte intégral et peuvent
nécessiter le défilement du panneau. Aucun changement des données, routes,
services, stockage, règles Auth, RLS ou migrations. Aucune mutation PROD,
aucun déploiement Pages et aucune nouvelle branche/PR.

`git diff --check` est sans erreur. Après simulation et arrêt des processus,
`npm run delivery:complete -- --json` a libéré **22,51 Mo** (144 fichiers),
sans échec. `.tmp` conserve **2 903,75 Mo** de groupes protégés/non qualifiés
et de preuves utiles, au-delà du plafond de 500 Mo ; aucune purge supplémentaire.
