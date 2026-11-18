# Calendrier de formation — PR4 lot 1

Recette du **18 novembre 2026**. Référence Git synchronisée
`a17d6aa9016da3bab195b99a36bc9a9f22f8f5cd`, issue de la fusion de
[#70](https://github.com/Vladoche/mon-bprea/pull/70).
Branche `codex/ui-2027-calendar`, [PR #71](https://github.com/Vladoche/mon-bprea/pull/71).
Code mesuré sur `5148e5ab6b68055901c72f5da7449332edb1c75e`.

## Périmètre

| Fichiers | Changements |
| --- | --- |
| `calendrier.html`, `assets/calendar.js`, `assets/calendar.css` | Introduction compacte, commandes mensuelles natives, table à sept colonnes et surfaces partagées du design 2027. |
| `tests/unit/calendar-exams.test.js`, `tests/e2e/ui-2027-calendar.spec.js`, `tests/fixtures/calendar-2027.js` | Recette des contrats et parcours avec événements synthétiques fournis par interception de la source. |
| `scripts/measure-ui-foundations.mjs`, `scripts/ui-calendar-lab.mjs`, `.github/workflows/quality.yml` | Comparaison avant/après, mesures, contrastes et galerie dans l’artefact du job `ui-performance-lab`. |
| Documentation | Description du calendrier, statut de la refonte et changelog actualisés. |

La grille distingue aujourd’hui, les week-ends et les jours de remplissage.
Elle montre jusqu’à deux événements par case sur grand écran. La commande
de débordement et les compteurs tactiles ouvrent l’agenda du jour, dans
l’ordre chronologique. **Voir tout le mois** restaure l’ensemble des
événements. Les quatre catégories possèdent des libellés et les exemples
fictifs sont nommés ou signalés par un astérisque expliqué dans la grille.

L’agenda affiche titres complets, périodes, UC et lieux disponibles. Le
dialogue natif place le focus sur le titre, conserve un bouton de fermeture
visible pour les descriptions longues et restitue le focus au déclencheur.
La fiche de lien direct rend le focus au mois. Les textes et sauts de ligne
sont affichés littéralement. Le chargement et l’erreur apparaissent au-dessus
de la grille. **Réessayer** conserve le mois. Les avertissements se déplient
dans l’agenda, et son état vide distingue une source vide d’un mois sans date.

## Contrats

- `assets/calendar-events.json` reste la source unique, version 1 et liste vide.
  `calendar-data.js`, `parseDate()`, `dateKey()` et `daysBetween()` sont identiques
  à la référence.
- Les journées civiles locales, débuts et fins inclusifs, bornes 0001–9999,
  périodes entre mois ou années, rejets, avertissements et UC inconnues
  gardent leur traitement. Les liens `month`, `date` et `event` gardent leur
  syntaxe et leur priorité. Les liens relatifs fonctionnent sous `/mon-bprea/`.
- Le module d’examen conservé, son exclusion des exemples et les statistiques
  sont inchangés. Le bandeau reste désactivé sur l’accueil.
- La consultation et les interactions testées ne créent aucune écriture
  pédagogique ni opération de synchronisation. Le JSON est lu une fois pour
  la visite et de nouveau sur demande en cas d’erreur.

## Recette

Node.js 24.22.0, Playwright 1.64.1 et Chromium verrouillé 156.0.8078.4. Horloge civile
contrôlée dans les contextes navigateur, au fuseau Europe/Paris.

| Contrôle | Résultat |
| --- | --- |
| `npm ci` | Verrou installé. L’audit npm signale cinq avis élevés sur les dépendances préexistantes du verrou. |
| `npm test` | 650 réussis, 1 ignoré, 59 fichiers. Les 12 cas calendrier/examens couvrent notamment dates impossibles, année bissextile, deux changements d’heure, périodes, identifiants rejetés, UC inconnues, exemples, examens réels, source vide, format incorrect, JSON illisible et échecs HTTP/réseau. |
| E2E calendrier | Neuf scénarios dédiés. Hub, footer, préfixe Pages, mois précédent/suivant, aujourd’hui, saisie du mois, février à 28/29 jours, décembre/janvier et bornes. Tri, périodes, états, accès à tous les événements, avertissements, dialogue et lecture seule. |
| E2E globaux | 207 réussis à la relance. Au premier passage, un scénario Tableau de bord a expiré sur une page non initialisée (206 réussis). L’échec ne s’est pas reproduit et le code du Tableau de bord est identique à la référence. Les 16 parcours calendrier et critiques ont réussi après l’ajustement des états de chargement et d’erreur. |
| SDK navigateur et notice publique | Reconstruction du SDK sans diff Git. Rendu de la notice confirmé par le script de contrôle. |
| Auth et RLS | La suite sur stack éphémère est portée par le check `supabase-security` de la PR. Les résultats de la tête courante sont consultables dans les [checks GitHub](https://github.com/Vladoche/mon-bprea/pull/71/checks). Le test local de consultation en lecture seule utilise le frontend statique en visiteur. |

## Captures et accessibilité

La galerie locale se trouve dans
`.tmp/ui-2027-pr4-lot1/calendar-review/index.html`. L’artefact
`ui-performance-lab` dans les [checks de la PR](https://github.com/Vladoche/mon-bprea/pull/71/checks)
contient `calendar-review/index.html`,
`contrastes.json` et `performance-calendar.json`. Les **76 captures**,
regroupées en 38 paires, comparent des états identiques à 390, 768 et
1440 × 1000, avec des contrôles à 320 et 1024 px. Elles couvrent les
sources et mois vides, la grille remplie, la journée chargée, les périodes
chevauchantes, l’agenda, le détail de cours et d’examen, l’exemple fictif,
le chargement, l’erreur, les avertissements, le sombre, le contraste forcé
et le texte à 200 %. Les images originales sont accessibles depuis chaque paire.

La revue a porté sur la densité des cases, l’ordre des commandes, les textes
enveloppés, la hiérarchie de l’agenda et des fiches, le repère d’aujourd’hui
et la distinction des catégories. Contrôles Chromium à 320, 390, 768, 1024
et 1440 px sans débordement horizontal global. Saisie du mois, clavier,
tactile émulé, focus modal, Échap, contraste forcé et mouvement réduit
vérifiés. Le zoom natif Chromium à 200 % a aussi été exercé avec un profil
jetable, à 1440 et 780 px physiques (720 et 390 px CSS). Les compteurs,
l’agenda, le dialogue et son retour de focus sont utilisables à ce zoom.
Sur les quatre saisons claires et sombres, les minima mesurés sont
**5,12:1** pour les libellés de catégorie, **8,37:1** pour les titres en
grille, **5,86:1** pour le numéro d’aujourd’hui et **6,49:1** pour le
contour de focus sur la surface du calendrier.

La recette locale est limitée à Chromium. La structure sémantique, les noms
accessibles et le parcours clavier sont vérifiés. Aucun essai avec lecteur
d’écran sur appareil physique.

## Performance en laboratoire

Cinq passages alternés à cache froid par version, même source synthétique,
Chromium 1440 × 1000, CPU ralenti ×4, latence de 20 ms, débit de
1 250 000 octets/s et serveur local sans compression. Les interactions sont
mesurées jusqu’à la deuxième image rendue. Le relevé des déplacements après
clic inclut les changements déclenchés par l’utilisateur.

| Médiane | Référence | Refonte |
| --- | ---: | ---: |
| CSS chargé, octets | 68 408 | 71 726 |
| JavaScript chargé, octets | 831 041 | 834 541 |
| Requêtes avec le document | 80 | 80 |
| Lectures du JSON après navigation et ouverture d’une fiche | 1 | 1 |
| LCP, ms | 1 380 | 1 308 |
| CLS au chargement | 0 | 0,0520 |
| Premier événement de l’agenda rendu, ms | 1 394 | 1 433 |
| Changer de mois, ms | 42,1 | 42,0 |
| Ouvrir une fiche, ms | 25,2 | 26,6 |
| Déplacement de contenu après interaction | 0 | 0,0138 |
| Défilement vertical au changement de mois, px | 0 | 0 |

Les styles ajoutent 3 318 octets et le script 3 500 octets. Le premier
événement apparaît 39 ms plus tard. Le déplacement au chargement accompagne
la disparition du message d’attente et le remplissage de la grille. Lors
d’un changement de mois, la hauteur dépend du nombre de semaines et
d’événements affichés. Le banc relève ces déplacements et aucun de ses
seuils diagnostiques n’est franchi. Ces mesures sont locales.

## Verdict

**GO — PR4 lot 1 validé.** Les parcours, les contrastes et les captures
inspectées valident la refonte du calendrier dans le périmètre de la PR.
La livraison s’arrête à la revue GitHub. Les opérations effectuées portent
sur la branche dédiée et les environnements de test isolés.
