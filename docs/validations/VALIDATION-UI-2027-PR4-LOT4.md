# Validation de la reconnaissance botanique 2027

PR4 lot 4 · [PR #74](https://github.com/Vladoche/mon-bprea/pull/74) · 19 novembre 2026 · Base `c7cd0c6828a02d52f88a1975b807022bff6436e0`, fusion de la [bibliothèque documentaire #73](https://github.com/Vladoche/mon-bprea/pull/73).

## Audit

| Surface | Contrat observé et point contrôlé |
| --- | --- |
| Sélection | La banque v1 contient douze taxons et douze JPEG. Petits fruits, Fleurs et Légumes maraîchers proposent chacun quatre questions. Légumineuses est visible et désactivée. La révision sélectionne les espèces ayant au moins une erreur ou une expiration. |
| Question | Le moteur mélange les espèces et quatre noms distincts de la catégorie. Une seule sélection précède la validation. La tentative de chargement invalide tout retour de photo obsolète. Les états couvrent le chargement, l’affichage, l’erreur, la reprise et le passage hors calcul. |
| Chrono | Le décompte est piloté par `createQuestionTimer()` et `performance.now()`. Il démarre au chargement de la photo. L’onglet masqué, la pause manuelle et la correction suspendent le temps. La validation consulte l’échéance même entre deux rafraîchissements. |
| Correction et résultats | Quatre statuts, une tentative immuable par question et des sessions complètes, partielles ou sans réponse. Le taux divise les réponses correctes par les tentatives comptées, temps écoulés compris. Les images passées et questions sans réponse restent hors calcul. L’historique déduplique par identifiant, conserve les erreurs après une réussite et agrège par espèce, thématique et jour UTC. |
| Persistance et identité | `monbprea.botanical.v1` pour le visiteur, cache IndexedDB cloisonné par environnement, origine et UUID Auth pour le compte. Enregistrement local puis confirmation distante. Création → réponses → fin, avec UUID et contenu stables lors d’un retry. Les divergences sont archivées et l’import exige un aperçu et une confirmation. |
| Risques de rendu | Le suivi au-dessus du jeu pouvait modifier la position de la question. Le chrono et le panneau de suivi utilisaient plusieurs régions interactives annoncées. Photo, options, chrono, focus, correction et reprise après erreur ont été vérifiés séparément lors des changements asynchrones. |

## Interface et périmètre

| Fichier | Intervention |
| --- | --- |
| `reconnaissance-plantes.html` | Introduction et structure présentes dès le chargement, fil d’Ariane de la navigation commune. |
| `assets/botanical.js`, `assets/botanical.css` | Cartes de catégorie, modes et révision, photographie prioritaire, progression par question, correction en deux parties, durée en mode Chrono et tableaux d’historique. Les boutons de suite et de fin restent près de la correction. |
| `assets/botanical-sync-ui.js` | Suivi du compte sous l’historique et message de stockage en cas de problème visiteur. Dialogue d’import natif avec actions accessibles. Une génération d’interface invalide un aperçu tardif quand l’identité change, même au retour à A. |
| `tests/e2e/botanical*.js`, `scripts/ui-botanical-*.mjs`, `scripts/measure-ui-foundations.mjs`, `.github/workflows/quality.yml` | Parcours navigateur, simulation de synchronisation, parité exacte, mesures et galerie publiées en artefact de recette de la PR. |

Le diff de `botanical-bank.json`, du moteur, des stores, du service, du modèle, du transport et du code d’import est vide. Les douze JPEG ont les mêmes SHA-256 que la référence. L’affichage vérifie les dimensions d’origine, `object-fit: contain`, l’absence de filtre et les chemins relatifs sous `/mon-bprea/`. Le cadre suit le format de l’image et reprend l’arrondi `--radius-md` et l’ombre `--shadow-raised` du site. Sa marge laisse visibles les quatre coins du JPEG. Le volet replié **Sources et licences des photographies** réunit titres, auteurs, licences, liens source et mentions de retouche. Luc Viatour et son adresse restent visibles sous la seule photo du groseillier. Les alternatives textuelles proviennent de la banque. [Registre des sources](../architecture/BOTANICAL-SOURCES.md).

## Galerie et accessibilité

La galerie locale est dans `.tmp/ui-2027-pr4-lot4/botanical-review/index.html` et la planche des commandes dans `boutons.html` au même emplacement. Le job `ui-performance-lab` fournit ces deux fichiers, les PNG, `controles.json`, `parite.json` et les mesures brutes. Les comparaisons utilisent le catalogue réel. Les écrans de synchronisation utilisent des comptes et réponses HTTP fictifs.

- 136 captures avant/après, incluant les vues à 390, 768 et 1 440 px. L’inspection a porté sur l’accueil, les deux modes, la disponibilité des catégories, les photos horizontale et verticale, les choix, les corrections, les résultats, l’historique, la révision, les licences, l’import, l’attente, le hors-ligne et le conflit. Les contrôles de débordement couvrent aussi 320 et 1 024 px. Les tableaux gardent leur sémantique et le défilement clavier dans leur cadre.
- Clair, sombre, quatre saisons, contraste forcé et zoom Chromium natif à 200 %. Le clavier vérifie la sélection, le focus après validation, le retour de focus à la relance d’une image, le défilement de l’aperçu d’import à 200 %, le retour au bouton d’import et le déplacement dans les tableaux. Le chrono rend le temps lisible avec `aria-live="off"`. Une annonce courte et le focus sur le nom de la plante orientent vers la correction.
- Les actions utilisent `.btn.btn-surface` et sa variante accent. Les commandes courantes mesurent 46 px de haut à 1 440 px avec un rayon de 999 px, comme les entrées du header. Les propositions mesurent au moins 52 px, avec le reflet et les ombres partagés et un rayon de 20 px pour les libellés longs. La planche compare repos, survol, focus, pression, sélection et désactivation. Le contraste de texte de l’accent atteint au minimum 6,13:1 en clair et 4,73:1 en sombre sur les extrémités du dégradé mesuré. Les choix validés ont un libellé en plus de leur couleur.

## Parité et synchronisation

Le scénario de référence a été exécuté avant modification de l’interface. La comparaison après refonte est exacte pour les choix, les photos, les identifiants, les huit tentatives, les six sessions persistées, leurs dates et leurs temps, les totaux et les agrégats. Elle couvre les trois catégories jouables, la catégorie vide, les quatre durées dont la valeur par défaut de 30 s, la pause manuelle et le retour d’onglet, le chargement tardif, le double échec d’image et le passage hors calcul. À l’échéance, la réponse tardive est enregistrée comme `timeout` à 15 000 ms. À 29 999 ms sur une question de 30 s, la réponse est validée. Une réussite en révision laisse l’erreur historique éligible. Le même identifiant relu deux fois conserve un seul décompte, et une session sans tentative calculable affiche « Non calculable ».

Le zéro signalé dans le compte rendu Chrono a été reproduit dans Chromium. Le navigateur avait enregistré 4 250 ms, tandis que « Temps écoulés » affichait le nombre d’expirations, zéro. Le nouveau libellé **Expirations du chrono** désigne ce nombre. **Durée chronométrée** cumule le temps sauvegardé pour les questions comptées. Le scénario de régression enregistre 4,25 s puis 7,38 s avec une pause de 20 s et affiche 11,63 s, zéro expiration. Une expiration à 15 s affiche 15 s et une session avec photo passée seulement affiche « Non mesurée ».

Les suites applicatives vérifient le visiteur local, le stockage refusé et le jeu en mémoire choisi, les comptes vides ou riches, la sauvegarde locale et différée, la confirmation distante, la perte d’acquittement, le retry, les réponses asynchrones invalidées, la déconnexion et la reconnexion. Les conflits de réponse, de session et de date, l’import annulé, la source modifiée, le rejeu d’import et les deux onglets sont couverts. Une actualisation du compte pendant un Chrono conserve la photo, le temps, le choix, le focus et la position de défilement. Un échec de sauvegarde maintient la correction disponible et reprend la même tentative.

La recette PostgreSQL locale utilise la CLI 2.121.0 et la stack `mon-bprea-lot6-1-local`. `supabase test db` a réussi ses 414 assertions. `npm run test:personal:supabase` a réussi ses 26 groupes avec Auth, PostgREST et PostgreSQL réels, dont l’idempotence, la concurrence et l’isolation A/B. `npm run test:e2e:supabase -- tests/e2e-supabase/botanical-sync.spec.js` a réussi six parcours, dont la perte HTTP après commit, l’import volontaire et le conflit explicite.

| Contrôle local | Résultat |
| --- | --- |
| `npm test` | 680 tests réussis, un ignoré par la suite sous Windows. |
| `npm run test:e2e -- --workers=3` | 238 parcours Chromium, dont 21 botaniques. |
| `npm run build:auth-sdk` puis `git diff --exit-code -- assets/vendor/supabase.js` | SDK 2.118.0 reproduit à l’identique selon Git. |
| `node scripts/build-privacy-notice.mjs --check` | Notice publique conforme. |

## Performance

Cinq passages alternés, Chromium 156 verrouillé, 1 440 × 1 000, cache froid, CPU ×4, latence de 20 ms et débit de 1,25 Mo/s. Les temps d’action vont de l’événement aux deux images suivant l’état attendu dans le DOM. Les poids sont les octets décodés servis en local. Les mesures avant interaction portent sur l’accueil du module.

| Médiane | Avant | Après |
| --- | ---: | ---: |
| CSS chargé | 65 192 octets | 76 302 octets |
| JavaScript chargé | 809 850 octets | 815 100 octets |
| Requêtes initiales | 79 | 79 |
| LCP de laboratoire | 1 300 ms | 280 ms |
| CLS initial | 0,365 | 0 |
| Sélection prête | 1 592 ms | 1 508 ms |
| Démarrage de session | 105 ms | 104 ms |
| Première photo affichée | 271 ms | 307 ms |
| Choix d’une réponse | 25 ms | 25 ms |
| Correction | 89 ms | 107 ms |
| Question suivante | 42 ms | 40 ms |
| Photo suivante affichée | 241 ms | 239 ms |
| Résultats | 75 ms | 89 ms |
| Photos demandées sur deux questions | 2 · 287 924 octets | 2 · 287 924 octets |

Le titre présent dans le HTML rend le premier contenu visible plus tôt. Le déplacement du suivi sous le jeu réduit le déplacement initial mesuré. Le CSS augmente de 11,1 ko décodés. Les médianes de première photo, de correction et de résultats augmentent de 36, 18 et 14 ms. Les actions de jeu restent sous le budget diagnostique de 200 ms hors chargement de photo. L’horloge déterministe vérifie indépendamment les pauses et l’échéance.

## Portée de la recette

Les contrôles visuels et clavier portent sur Chromium et son contraste forcé. Les annonces ont été vérifiées par le focus et les attributs accessibles. La recette de synchronisation s’est déroulée avec une stack locale et des comptes fictifs. La livraison passe par la PR, avec fusion et publication décidées après revue.

## Verdict

**GO — PR4 lot 4 validé.**
