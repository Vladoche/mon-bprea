# Générateur ITK 2027 · Validation du lot 2

Base `origin/main` du 18 novembre 2026, `d361184391ee4b70554a7eddaa620a1919893dae`
après fusion du [calendrier de formation #71](https://github.com/Vladoche/mon-bprea/pull/71).
Branche `codex/ui-2027-itk`.

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
persistée et ses rejeux réseau. Le passage ciblé final a réussi les
45 scénarios ITK, stockage, navigation et apparence, préfixe Pages compris.

## Captures, accessibilité et impression

La galerie locale est dans `.tmp/ui-2027-pr4-lot2/itk-review/index.html` et
la planche dans `.tmp/ui-2027-pr4-lot2/itk-review/boutons.html`.
Le job `ui-performance-lab` produit les mêmes fichiers de revue et les
deux impressions A4. Les captures utilisent des paramètres et comptes fictifs.
Les pages comparées utilisent 390, 768 et 1440 × 1000, avec contrôles à
320 et 1024 px, un zoom natif Chromium à 200 % et les palettes des quatre
saisons en clair et sombre. La planche montre le header et les actions
principales, secondaires et d’import dans les mêmes conditions de thème.

Le test de l’action d’impression vérifie l’appel à `window.print()`.
Chromium enregistre la feuille par son moteur d’impression, avec synthèse,
indicateurs, avertissements et jalons sur fond clair. Le PDF est une sortie
du navigateur. Le PDF A4 du scénario carotte, généré depuis le mode sombre,
tient sur une page après ajustement des espacements. Les sept points de
vigilance et les six interventions ont été contrôlés sur le rendu Poppler.
