# Générateur ITK 2027 · Validation du lot 2

Base `origin/main` du 18 novembre 2026, `d361184391ee4b70554a7eddaa620a1919893dae`
après fusion du [calendrier de formation #71](https://github.com/Vladoche/mon-bprea/pull/71).
Branche `codex/ui-2027-itk`, [PR #72](https://github.com/Vladoche/mon-bprea/pull/72).

## Audit et mise en œuvre

- Le générateur associait dans [app.js](../../assets/app.js) le formulaire,
  le modèle de démonstration, le rendu et l’export. Il reconstruisait les
  mêmes jalons pour l’écran et le CSV. [itk.js](../../assets/itk.js) est chargé
  sur la seule page [ITK](../../itk.html) et transmet les mêmes jalons aux deux
  usages. `dateForMonth()`, `moveWeeks()`, `monthLabel()`, les densités,
  avertissements, semaines et arrondis mensuels suivent la référence.
- Le [catalogue de cultures](../../assets/content.js) et les huit champs
  existants alimentent trois groupes de contrôles natifs. Le formulaire indique
  l’erreur de surface auprès du champ. Le résultat regroupe la synthèse, les
  indicateurs, les avertissements et la chronologie. La génération place le
  focus sur la synthèse, qui donne accès aux paramètres et aux exports.
- Le [header](../../assets/navigation.css) fournit les surfaces de
  `.primary-nav__entry` et de l’entrée active, leurs ombres, le reflet
  `::before` et l’anneau de focus de `.primary-nav__top-link`. Les mêmes
  tokens `--control-pill-*` dans [style.css](../../assets/style.css)
  alimentent `.btn.btn-surface` et `.btn-surface--accent`. Le bouton de
  retrait emploie la variante `.btn-surface--danger` avec les couleurs
  fonctionnelles de retrait. [Styles ITK et impression](../../assets/itk.css).
- [L’interface de sauvegarde](../../assets/itk-personal-ui.js) conserve les
  rappels, messages, prévisualisations et décisions existantes. Le service
  partagé garde sa portée environnement/projet/UUID, ses clés, ses transactions
  IndexedDB et son CAS. L’aperçu d’import donne le premier focus à **Annuler**.
  [Guide et contrat](../architecture/ITK-APPEARANCE-SYNCHRONISATION-CLIENT.md).

## Parité et persistance

Les scénarios [capturés sur main](../../tests/fixtures/itk-reference.json)
couvrent la tomate Marmande sous abri, la tomate Cœur de bœuf en plein
champ, la laitue Feuille de chêne, la carotte de conservation en plein champ
et la courgette Ronde de Nice. Ils croisent les limites de 1 et 100 000 m²,
2026 et 2033, les trois textures, les deux niveaux d’eau et un départ dans et
hors fenêtre. Les noms, descriptions, périodes, décalages, ordre, densité,
population, nombre de jalons et avertissements sont comparés. L’empreinte
SHA-256 porte sur tous les octets téléchargés. Le test vérifie aussi le nom
du fichier, le BOM UTF-8, le séparateur, les trois en-têtes et les CRLF.
Le parcours clavier exerce les surfaces vide, nulle, fractionnaire et
supérieure à la borne, le changement d’espèce, le recalcul et le retour
aux paramètres. [E2E ITK](../../tests/e2e/ui-2027-itk.spec.js).

Les parcours [de synchronisation simulée](../../tests/e2e/settings-sync.spec.js)
exercent la reprise réseau, le quota, le conflit, l’import volontaire ou
refusé, Échap et le retour au déclencheur, la saisie active, le CSV stable,
le changement de compte et la réponse tardive de A. Deux onglets peuvent
livrer la même intention avec le même UUID et la même charge. La révision
distante n’avance qu’une fois, le second onglet récupère les champs et son
résultat reste à générer. Les scénarios D12 couvrent la mémorisation volontaire,
la reprise de l’ancienne clé et le retrait. Les scénarios HTTP simulés
complètent la recette réelle ci-dessous.

Sur la stack Supabase locale dédiée, `npm run test:personal:supabase` a
réussi 26 groupes SQL/Auth/API. `npm run test:e2e:supabase -- settings-sync.spec.js`
a réussi les quatre parcours Chromium réels avec comptes fictifs,
dont isolation A/B, perte d’acquittement, conflits CAS et imports.

Sous Node.js 24.22.0, Vitest a réussi 650 tests, avec un scénario ignoré.
La relance Windows a utilisé deux workers et un délai de 20 s après deux
expirations dans des contrôles de sous-processus. Le SDK verrouillé et
la notice publique ont été vérifiés. Le premier passage Chromium général
a compté 212 réussites sur 216. Les quatre assertions en échec portaient
sur la ponctuation du titre et la distinction entre une intention
persistée et ses rejeux réseau. La suite générale relancée a réussi
216 scénarios. Après l’ajustement du focus et de l’impression,
18 parcours ITK et synchronisation ont réussi sur le code livré.

## Captures, accessibilité et impression

La galerie locale est dans `.tmp/ui-2027-pr4-lot2/itk-review/index.html` et
la planche dans `.tmp/ui-2027-pr4-lot2/itk-review/boutons.html`.
Le job `ui-performance-lab` produit les mêmes fichiers de revue et les
deux impressions A4. Les captures utilisent des paramètres et comptes fictifs.
[Checks et artefacts GitHub](https://github.com/Vladoche/mon-bprea/pull/72/checks).
Les pages comparées utilisent 390, 768 et 1440 × 1000, avec contrôles à
320 et 1024 px, un zoom natif Chromium à 200 % et les palettes des quatre
saisons en clair et sombre. La planche montre le header et les actions
principales, secondaires et d’import dans les mêmes conditions de thème.
Les captures avant/après ont été inspectées pour le repli du formulaire,
la synthèse, la chronologie, les messages de sauvegarde et les dialogues.
Les planches incluent le repos, le survol, le focus clavier, l’appui,
la désactivation, le contraste forcé et le mouvement réduit. Les mesures
confirment les mêmes surfaces, bordures, reflets, ombres et proportions
que le header en clair et sombre. Les minima calculés sur les huit palettes
sont de 4,73:1 pour le texte du bouton principal, 10,56:1 pour le bouton
secondaire, 6,36:1 pour les avertissements et 6,49:1 pour le contour de focus.

Le test de l’action d’impression vérifie l’appel à `window.print()`.
Chromium enregistre la feuille par son moteur d’impression, avec synthèse,
indicateurs, avertissements et jalons sur fond clair. Le PDF est une sortie
du navigateur. Le PDF A4 du scénario carotte, généré depuis le mode sombre,
tient sur une page après ajustement des espacements. Les sept points de
vigilance et les six interventions ont été contrôlés sur le rendu Poppler.

La recette couvre Chromium et l’émulation tactile. L’ouverture du dialogue
est contrôlée par l’appel à `window.print()` et le rendu papier par
l’enregistrement Chromium. Un essai interactif de la boîte système ainsi
qu’un parcours avec un lecteur d’écran sur appareil physique restent hors
de cette recette.

## Performance en laboratoire

Cinq passages alternés par version sur Chromium, 1440 × 1000, cache froid,
CPU ×4, latence de 20 ms et débit de 1 250 000 octets/s. Le serveur local
sert les mêmes données fictives et ne compresse pas les ressources. Le
relevé porte sur le code `96ec662`. Le banc et ses données brutes sont
accessibles depuis les artefacts du check `ui-performance-lab`.

| Médiane | Référence | Refonte |
| --- | ---: | ---: |
| CSS chargé, octets | 58 479 | 67 797 |
| JavaScript chargé, octets | 1 059 441 | 1 063 118 |
| Requêtes, document inclus | 84 | 86 |
| LCP, ms | 1 568 | 1 688 |
| CLS au chargement | 0,00014 | 0,00014 |
| Premier affichage du formulaire, ms | 1 738,6 | 1 856,7 |
| Changement d’espèce jusqu’à la seconde image, ms | 20,3 | 22,1 |
| Génération jusqu’à l’insertion de la chronologie, ms | 13,7 | 13,1 |
| Chronologie jusqu’à la seconde image, ms | 310,3 | 263,5 |
| Ouverture de l’aperçu d’import, ms | 260,0 | 288,8 |
| Déplacements cumulés en interaction | 0,0156 | 0,0296 |

La feuille ITK et le chargement du module dédié ajoutent deux requêtes à
cette page. La génération et l’insertion restent autour de 13 ms. Le seuil
diagnostique de 200 ms reste dépassé pour l’affichage de la chronologie
et du dialogue dans les deux versions sous ralentissement. L’ouverture
de l’aperçu, qui vérifie les paramètres du compte dans le banc HTTP,
prend 28,8 ms de plus. Les déplacements en interaction incluent les
changements déclenchés par l’utilisateur. Ces chiffres sont des mesures
locales de laboratoire.

## Verdict

**GO — PR4 lot 2 validé.** La parité métier, les CSV, le rendu A4 et les
contrôles de persistance et de cohérence avec le header permettent la revue
de la PR. Le signal de performance au seuil de 200 ms relève du suivi P2.
Le périmètre d’intervention couvre la branche de revue et les environnements
de test isolés.
