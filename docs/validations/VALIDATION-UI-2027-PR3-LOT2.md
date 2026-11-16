# QCM de cours — PR3 lot 2

## Objectif et base

Moderniser uniquement la présentation des QCM classiques, sans changer notation,
contenus, historique ou synchronisation. Base vérifiée après `git fetch origin` :
`456e844152a5be65598e891c9c53b8fb619524f0` ; #63 fusionnée le 16/11/2026 à
14:38:57 UTC et #64 à 15:04:49 UTC. Branche `feat/ui-2027-course-quizzes`.
Ni fusion, ni publication Pages, ni opération hébergée autorisées dans ce lot.

## États définis avant implémentation

| État réel | Traitement graphique et accessible |
| --- | --- |
| Chargement/vérification | Message de statut existant, aucune progression supposée |
| Question vierge | Carte avec fieldset/legend, radios natifs, correction cachée |
| Réponse sélectionnée | Terracotta, radio coché et repère accentué ; aucun vert pédagogique |
| Toutes renseignées | Compteur textuel complet, bouton de correction disponible si source utilisable |
| Correction demandée | Radios verrouillés, double validation bloquée |
| Résultat calculé | Score réel dans un panneau distinct ; focus sans défilement imposé |
| Enregistrement en cours | Texte explicite et nouvelle tentative désactivée |
| Local confirmé | Confirmation seulement après retour réussi du service |
| Synchronisation en attente | Confirmation locale conservée, envoi au compte explicitement distinct |
| Distant confirmé | Uniquement état `synced` du service sans opération en attente |
| Échec local | Alerte et retry ; réponses, correction, score et date de tentative conservés |
| Nouvelle tentative | Remise à zéro visuelle, focus premier radio ; historique et meilleur score conservés |
| Progression indisponible | Contrôles bloqués, score inconnu et historique indisponible explicites |
| Changement de compte/portée | Reset et protections `progressEpoch` existantes ; retour tardif ignoré |

Le compteur de saisie n’est pas une région live. Le résultat reçoit le focus ;
seul son suivi de sauvegarde annonce les transitions, sans répéter le score.
Les explications proviennent de `q.why`, après validation uniquement.

## Architecture et contrats préservés

- `course-quiz-page.js` : rendu des cartes, du résultat et textes de sauvegarde.
- `course-quiz-page.css` : styles chargés uniquement par `exercices.html`, avec
  les tokens 2027 et les couleurs fonctionnelles des thèmes existants.
- `app.js` : orchestration QCM conservée ; même comparaison des réponses,
  calcul du score, objet tentative, `recordQuiz()`, filtrage `validAttempt()`,
  ordre et identifiants d’historique. Le DOM du résultat reste stable pendant
  la sauvegarde et le retry. Source/portée et époque protègent les retours tardifs.
- Aucun changement de `content.js`, `exam-stats.js`, modèle/service/store/transport,
  clés LocalStorage, schémas IndexedDB, SDK, migration, RLS, import/export.
- Toutes les questions restent sur une page. Aucun changement des interfaces
  Drill, statistiques ou outils ; aucune bibliothèque ou image supplémentaire.
- La correction affiche la proposition exacte attendue et l’explication `q.why`.
  Le score parfait n’annonce plus une terminaison de cours non vérifiée.

## Contrôles exécutés le 16 novembre 2026

Node **24.22.0**, `npm ci` : 50 paquets, zéro vulnérabilité signalée.
Chromium verrouillé **156.0.8078.4**, Playwright 1.64.1, contextes fictifs isolés.
Les lancements navigateur utilisent le serveur de test du dépôt hors sandbox
Windows pour permettre la connexion loopback et les sous-processus Chromium.

| Contrôle | Résultat réel |
| --- | --- |
| `npm test` | 624 réussis, 1 ignoré ; 58 fichiers |
| `npm run test:e2e -- --workers=2` | 177 réussis ; parcours transversaux complets |
| Suite `ui-2027-quizzes.spec.js`, finalisation | 10 réussis après les derniers ajustements de contraste, focus et texte à 200 % |
| Suite existante `course-quiz-sync.spec.js` | 7 réussis, également inclus dans les 177 |
| `npm run build:auth-sdk` + diff SDK | Fichier reconstruit identique |
| `node scripts/build-privacy-notice.mjs --check` | Notice approuvée identique |
| Stack locale dédiée `mon-bprea-lot6-1-local` | Docker démarré avec accord utilisateur ; cinq migrations locales déjà appliquées, aucun reset |
| `supabase@2.121.0 test db` | 414 assertions pgTAP réussies, 5 fichiers |
| `npm run test:supabase` | 12 groupes Auth/RLS réussis, expiration réelle invitation/récupération/JWT comprise |
| `npm run test:drill:supabase` | 22 groupes PostgreSQL/Auth/API réussis |
| `npm run test:personal:supabase` | 26 groupes PostgreSQL/Auth/API réussis |
| E2E Supabase réel ciblé `course-quiz-sync.spec.js` | 5 réussis : deux appareils, isolation A/B, perte d’acquittement, conflits CAS, import et hubs |

Les 177 E2E ont précédé les derniers ajustements de présentation ; les 10 QCM
ont été rejoués ensuite. La CI relance la suite complète sur la tête finale.
La suite Supabase navigateur complète n’a pas été rejouée localement ; la CI
`supabase-security` la prend en charge sur sa stack éphémère. Les simulations
HTTP de la suite générale restent distinctes des preuves PostgreSQL/Auth réelles.
Aucun essai n’utilise DEV, PROD ou le navigateur personnel.

### États et régressions vérifiés

Radios natifs au clavier (flèches/Entrée), clic sur la surface du label,
changement de choix et exclusivité, compteur sans annonce live, correction
bloquée tant qu’incomplète, absence de correction prématurée, score 2/3 et 3/3
exacts, bons/mauvais choix textuels, explications exactes et focus résultat nommé.
Le reset remet le compteur et les choix à zéro, garde le meilleur score et
l’historique, ne produit aucune écriture et remet le focus au premier radio.

L’écriture locale retardée conserve le résultat affiché et désactive
Recommencer. Les refus LocalStorage/IndexedDB ne produisent aucun faux succès ;
les choix, corrections et date de correction survivent au retry. Une seule
tentative est ensuite enregistrée. L’attente réseau reste une confirmation locale,
et la confirmation distante suit le vrai état du service. Une réponse tardive
après A → B ne réaffiche ni score, ni choix, ni historique de A. Le stockage
inaccessible produit un score inconnu et une source indisponible, jamais zéro.
Les historiques identiques légitimes et leur ordre sont préservés ; aucune date
n’est attribuée au seul meilleur score hérité.

### Accessibilité et revue visuelle

320, 390, 768, 1024 et 1440 px, dont 12 questions et propositions longues
synthétiques ; absence de débordement horizontal du document à taille normale
et texte à 200 %. Résultat corrigé à 200 % vérifié aux cinq largeurs.
Clair/sombre et printemps/été/automne/hiver ; contraste forcé, mouvement réduit,
rendu sans `backdrop-filter`, cibles de réponse de 44 px au minimum et focus
visible contrôlés. Les couleurs de correction remplacent la sélection après
validation, y compris au survol ; ce point dispose d’une assertion de régression.

Contrastes calculés sur les couleurs composées des surfaces et états contrôlés :
**texte ≥ 4,94:1**, **bordure ≥ 5,17:1**, **focus ≥ 5,38:1**. Les boutons
désactivés sont compris dans le contrôle des textes ; ces mesures ciblées ne
constituent pas un audit WCAG complet. Fieldset/legend, radios et labels natifs
sont conservés. Le focus du résultat porte son score dans son nom accessible ;
la sauvegarde utilise un statut et les erreurs une alerte distincte. La notice
partagée reste lisible sans doubler les annonces de sauvegarde du QCM.

Captures réellement inspectées : avant/après ordinateur, sélection/correction,
mobile 320/390, hiver sombre, erreur de sauvegarde et résultat à 200 %. Captures
complémentaires 768/1024 disponibles. Revue esthétique humaine requise avant
fusion ; aucune nouvelle référence visuelle n’est approuvée automatiquement.
Ni lecteur d’écran, ni zoom natif, ni appareil physique n’ont été utilisés.

### Captures et conservation

Campagne locale ignorée `.tmp/ui-2027-pr3-lot2/`, à conserver jusqu’à la revue :

- `quiz-review/comparaison-qcm.html` : main **456e844** / branche QCM, mêmes
  viewports 1440×1000 et 390×1000 ; vierge, sélection, prêt et corrigé.
- `review/states/revue-qcm.html` : galerie des états, résultats, historique,
  bonnes/mauvaises réponses, sombre et hiver sombre.
- `review/states/quiz-save-error-desktop.png`, `quiz-unavailable-desktop.png`,
  `quiz-forced-colors.png`, `quiz-result-200-dark.png` et `quiz-contrasts.json`.
- `performance-quiz.json` : mesures brutes, médianes, méthodologie et budgets.

La CI Qualité joint les galeries d’états à `playwright-review-*`, la comparaison
et les mesures à `ui-performance-lab-*`. Les liens de téléchargement et la
validité de rétention sont donnés dans la PR après la fin des workflows.
Les journaux de démarrage et clés de la stack locale restent privés, ignorés
et exclus des artefacts CI ainsi que du site.

## Performance locale reproductible

Commande depuis la racine après extraction publique de main **456e844** dans
le dossier baseline de la campagne :

```text
node scripts/measure-ui-foundations.mjs --baseline .tmp/ui-2027-pr3-lot2/baseline --baseline-ref 456e844152a5be65598e891c9c53b8fb619524f0 --page exercices.html?id=matiere-organique --output .tmp/ui-2027-pr3-lot2/performance-quiz.json
```

Cinq chargements froids alternés, 1440×1000, automne clair, CPU ×4, réseau
20 ms / 10 Mbit/s, trafic extérieur bloqué. Les octets sont les corps décodés,
sans compression locale. L’horloge de performance navigateur reste réelle.

| Médiane | Main #64 | QCM lot 2 |
| --- | ---: | ---: |
| LCP | 1 172 ms | 1 196 ms |
| CLS de chargement | 0 | 0 |
| CSS décodé | 58 479 octets | 67 282 octets |
| JavaScript décodé | 810 631 octets | 815 817 octets |
| Requêtes | 76 | 78 |
| Load event | 1 105,9 ms | 1 132,7 ms |
| Titre et navigation visibles | 1 340,8 ms | 1 424,7 ms |
| Questions prêtes | 1 353,6 ms | 1 435,9 ms |
| Sélection → seconde frame | 25,5 ms | 24,9 ms |
| Correction → seconde frame | 40,6 ms | 44,0 ms |
| Écriture DOM de l’historique | 0,2 ms | 0,3 ms |
| Présentation de l’historique | 14,7 ms | 12,6 ms |

Aucun budget diagnostique dépassé. +8 803 octets CSS, +5 186 octets JS et deux
requêtes statiques (feuille ciblée et module). Aucune requête vers un service
supplémentaire, dépendance ou image lourde. Ces latences de laboratoire ne sont
pas un INP de terrain.

Le diagnostic de déplacements incluant les entrées récentes passe de **0,128 à
0,429** pendant la sélection et l’ouverture du corrigé. Il comprend l’extension
verticale volontaire des cartes et du panneau de résultat, visible dans les
captures ; il ne doit pas être confondu avec le CLS de chargement nul. La page
ne défile pas explicitement lors de la correction (`preventScroll` conservé).
Le confort de cette extension fait partie de la revue humaine des captures.

## Limites et livraison

Aucun défaut P0 constaté dans les contrôles exécutés. La revue esthétique humaine
reste nécessaire avant fusion, notamment sur l’extension verticale du corrigé.
Les contrôles ciblés ne valent ni certification WCAG ni recette hébergée.
Ce lot reste une PR ouverte : ni fusion, ni publication Pages, ni mutation PROD.
