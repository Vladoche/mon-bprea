# Drill hebdomadaire — PR3 lot 3

## Périmètre et référence

Refonte de la présentation du Drill, sans évolution pédagogique, statistique ou
du stockage. Branche `feat/ui-2027-weekly-drill`, créée après `git fetch origin`
depuis `2322aab6424961f2afdc78a4bfe49e608262c0ef`. #65 a été fusionnée le
16 novembre 2026 à **18:52:04 UTC**, avec ce SHA de merge. Aucune PR ouverte
au démarrage. Les workflows de sa tête `2e62625` sont réussis :
[Qualité](https://github.com/Vladoche/mon-bprea/actions/runs/43931763360) et
[Auth/RLS](https://github.com/Vladoche/mon-bprea/actions/runs/43931763364).

La [PR #66](https://github.com/Vladoche/mon-bprea/pull/66) est ouverte pour revue : aucune fusion, publication
Pages ou mutation Supabase hébergée. Tableau de bord/statistiques PR3 lot 4 hors
refonte. Le [registre Pages](../deploiement/EXPLOITATION-PRIVEE-SIX-ADULTES.md#registre-de-publication-pages)
reste la source de publication ; aucune recette hébergée n’est déduite des tests.

## Présentation et architecture

Avant : longue fiche, questions séparées par des traits, informations de série
et de sauvegarde en grands blocs ; reconstruction de `root.innerHTML` après les
brouillons et les mises à jour de données. Après : en-tête compact, cartes UC
dans leur panneau repliable, fiche UC/semaine avec quatre résultats et barre de
progression, cartes de questions, corrections et historique adaptés au mobile.
Tokens 2027, terracotta pour la sélection, couleurs fonctionnelles pour les
corrections, SVG en ligne cohérents ; aucune photo ou bibliothèque ajoutée.

- `assets/drill-page.js` contient uniquement les gabarits de présentation.
- `drill.js` garde l’orchestration et les mêmes signatures `ensureSeries()`,
  `saveDraft()`, `submitAnswer()`, `retry()` et `resolveConflict()`.
- Les régions inchangées et cartes identifiées par question restent dans le DOM.
  Les brouillons mettent à jour les radios et boutons existants. L’ouverture des
  détails, y compris ceux de plusieurs archives de conflits, reste indépendante.
  Les liens UC et historique focalisés sont retrouvés dans leur région lorsqu’une
  mise à jour de progression remplace leur contenu.
- Le focus rejoint la correction de la question après validation, sans appel de
  défilement. Retour de retry et résolution conservent un point de focus utile.
  Scope et époque de la vue invalident les retours asynchrones tardifs, y compris
  un aller-retour A → B → A. Les choix temporaires à l’écran ne sont pas des réponses.
- `drill-sync-ui.js` ajoute seulement les attributs de présentation d’état et de
  repérage des archives. Services, transports, RPC, RLS et migrations inchangés.
- `drill-engine.js`, la banque **`drill-bank.json`**, les stores et les calculs
  Dashboard restent identiques. Aucun changement de clé LocalStorage, schéma
  IndexedDB, dates de réponse, export, retrait ou contenu pédagogique.

## États et contrats conservés

| Source ou action | Présentation et garantie |
| --- | --- |
| Semaine courante | ISO et période civile, lundi 00 h Europe/Paris ; moteur partagé inchangé |
| Navigation | Semaine actuelle, huit précédentes et tout l’historique enregistré ; URL natives, rechargement et retour navigateur conservés ; aucune semaine future |
| UC sélectionnée | Code/titre réels, sélection textuelle et bordure ; série actuelle indépendante de la semaine consultée |
| Banque | Douze questions UC 03 ; autres UC incomplètes, banque indisponible distincte ; pas de doublons de remplissage |
| Série absente fiable | Non commencée, aperçu des dix questions et action directe ; aucun score supposé |
| Source illisible | Progression/historique indisponibles, aucune fabrication de 0/10 ; données brutes conservées |
| Démarrage réussi | Snapshot complet confirmé localement avant affichage des formulaires ; aucune substitution par une banque révisée ou indisponible |
| Brouillon | Choix radio local, reprise après navigation/reload ; aucune première réponse ni nouvelle opération réseau personnelle |
| Validation | Désactivée sans choix ; traitement visible, double soumission bloquée ; choix conservé et retry après échec |
| Première réponse | Racine définitive, explication/référence réelles et résultat comptabilisé distincts |
| Entraînement supplémentaire | Formulaire et `trainingDrafts` séparés ; dernier entraînement indiqué sans remplacer le résultat initial |
| Progression | Premières réponses validées / 10 ; réussite = bonnes premières réponses / réalisées ; sans validation : « Aucune donnée » |
| Exemple vérifié | 4 réalisées, 3 bonnes, 1 mauvaise, 2 entraînements : **4/10 et 75 %**, entraînements séparés |
| Historique | Série 2025-W02 terminée et séries incomplètes conservées, mêmes snapshots et dates ; liens reprendre/consulter |
| Enregistrement | Confirmation locale distincte d’attente, envoi et confirmation distante ; erreur visible aussi près de la question |
| Synchronisation | Vérification, visiteur, appareil, attente, en cours, synchronisé, hors ligne, session, erreur, conflit et cache inaccessible conservés |
| Conflit | Archives consultables, choix volontaire, aucune conversion automatique de première réponse en entraînement ; erreur permanente sans retry automatique |
| Identité | Visiteur/A/déconnexion/B, session à vérifier, identité hors ligne reconnue et retours tardifs ; aucune donnée de A sous B |

## Contrôles locaux du 16 novembre 2026

Node **24.22.0**, `npm ci` : 50 paquets, zéro vulnérabilité signalée.
Chromium verrouillé **156.0.8078.4**, Playwright **1.64.1**, navigateurs isolés.
Lancement local hors sandbox pour les sous-processus et le loopback Windows.

| Contrôle | Résultat exécuté |
| --- | --- |
| `npm test` | 624 réussis, 1 ignoré, 58 fichiers |
| Suite E2E générale | 192 réussis ; 5,1 min, dont 15 scénarios Drill regroupés |
| Drill et parcours critiques ciblés | 23 réussis ; puis 2 contrôles DOM/conflits et les 15 Drill rejoués après le correctif visuel à 200 % |
| SDK et notice | SDK reconstruit identique ; notice approuvée reproductible (`--check`) |
| Migrations locales | Cinq déjà appliquées, aucun reset ni nouvelle migration |
| pgTAP local | 414 assertions réussies, 5 fichiers |
| Runner Auth/RLS local | 12 groupes réussis, expirations réelles invitation/récupération/JWT comprises |
| Runner Drill local | 22 groupes PostgreSQL/Auth/API réussis, concurrence et RLS A/B comprises |
| Runner personnel local | 26 groupes réussis |
| E2E Supabase Drill | 3 réussis : deux appareils, acquittement perdu, hors ligne persistant, isolation A/B, reprise Auth et conflits ; brouillon rechargé sans RPC supplémentaire |
| E2E Supabase Dashboard | 2 réussis : entraînements exclus et conflit sans double comptage |
| Liens, syntaxe, secrets et diff | 98 liens locaux valides, syntaxe JS et diff contrôlés ; aucun secret trouvé par la recherche ciblée sur les changements |

La première suite générale avait 191 succès et une erreur du scénario de
contraste forcé : le test recherchait un radio déjà remplacé par sa correction.
Le scénario utilise maintenant une question non traitée. Le contrôle RPC de
brouillon attend la confirmation persistée de la création avant sa mesure : un
ancien libellé « Synchronisé » ne prouve pas la fin d’une création en cours.
Les premiers échecs de ces bancs ne sont pas comptés comme des validations.

Les simulations de service vérifient la présentation et les retours tardifs,
sans prouver RLS. Les preuves PostgreSQL/Auth ci-dessus utilisent uniquement
`mon-bprea-lot6-1-local`, de vrais JWT étudiants et des comptes fictifs nettoyés
individuellement. Aucune suite ne vise DEV, PROD ou un navigateur personnel.

## Accessibilité et inspection visuelle

320/390/768/1024/1440 px, propositions longues et identifiant sans espace, texte
à 200 %, corrections et entraînement ; aucun débordement global ou interne des
cartes contrôlées. Reflow à 1 024 px avec system-ui, Arial, sans-serif et Tahoma.
Fieldset/legend, radios et labels natifs, flèches/Tab/Entrée, focus après réponse
et boutons d’au moins 44 px. Sélection par tap du label et validation dans un
contexte tactile 390 px. Aucun appareil physique n’est revendiqué.

Clair/sombre et quatre saisons ; mouvement réduit, contraste forcé et absence
de `backdrop-filter`. Contrastes composés contrôlés : texte **≥ 4,94:1**,
correction **≥ 5,23:1**, bordure **≥ 5,17:1**, focus **≥ 5,38:1**. Les brouillons
ont un reçu visuel discret sans annonce live à chaque radio ; sauvegardes
significatives et erreurs sont annoncées séparément. La correction reçoit le
focus et ne répète pas son score dans une région live.

Captures effectivement inspectées : ordinateur initial et entraînement,
sélection/correction mobile, erreur de sauvegarde, conflit ouvert et hiver sombre.
L’inspection à 200 % a révélé une colonne de réponses trop étroite malgré
l’absence de débordement : paddings imbriqués plafonnés, propositions adaptables
sur une ligne complète et statistiques en une colonne lorsque nécessaire. Le
test exige maintenant au moins 120 px pour le texte des choix ; les 15 parcours
et la nouvelle capture ont été vérifiés après correction.
Revue esthétique humaine requise avant fusion. Aucun lecteur d’écran, zoom
natif ni audit WCAG complet ; l’agrandissement vérifié est celui du texte.

## Captures et performance

Campagne locale ignorée **`.tmp/ui-2027-pr3-lot3/`**, à conserver jusqu’à revue :

- `drill-review/comparaison-drill.html` : main #65 / branche, mêmes états et
  dimensions 1440×1000 et 390×1000 ; clair, sombre et hiver représentatif.
- `review/states/revue-drill.html` : galerie des états, questions, corrections,
  entraînements, historique, mobile et thèmes. Les captures d’erreur, cache,
  attente, conflit, contraste forcé, reflow et tactile sont dans le même dossier.
- `performance-drill.json` : cinq chargements froids alternés, métriques brutes,
  médianes et diagnostics. Les 56 captures comparatives ont les dimensions
  attendues ; `review/index.html` relie les deux galeries et les diagnostics.

Commande reproductible :

```text
node scripts/measure-ui-foundations.mjs --baseline .tmp/ui-2027-pr3-lot3/baseline --baseline-ref 2322aab6424961f2afdc78a4bfe49e608262c0ef --page "drill.html?unit=uc3&week=2026-W47" --output .tmp/ui-2027-pr3-lot3/performance-drill.json
```

Méthode existante étendue par `scripts/ui-drill-lab.mjs` : CPU ×4, 20 ms /
10 Mbit/s, trafic extérieur bloqué, automne clair, corps décodés sans compression
locale. Seule `Date` est figée pour le calendrier ; `Performance`, rAF et timers
restent natifs. Événement réel → deuxième frame après mutation du DOM, sans INP
terrain revendiqué. Chargement, correction, mise à jour des résultats/historique,
déplacements après interaction et ancrage du défilement restent distincts.

| Médiane Windows, cinq chargements par version | Main #65 | Drill lot 3 |
| --- | ---: | ---: |
| LCP | 1 676 ms | 1 416 ms |
| CLS de chargement | 0  | 0  |
| CSS décodé | 66 225 octets | 76 362 octets |
| JavaScript décodé | 816 182 octets | 829 340 octets |
| Requêtes statiques | 79  | 80  |
| Load event | 1 205,3 ms | 1 276,1 ms |
| Questions/aperçu prêts | 1 698,7 ms | 1 795,3 ms |
| Démarrage → deuxième frame | 231,3 ms | 218,8 ms |
| Sélection → deuxième frame | 16,6 ms | 16,9 ms |
| Correction → deuxième frame | 121,1 ms | 91,4 ms |
| Rafraîchissement des résultats | 145,2 ms | 119,8 ms |
| Affichage de l’historique | 152,7 ms | 127,5 ms |

Aucun budget diagnostique dépassé. +10 137 octets CSS, +13 158 octets JS et
une requête statique. Pas de service réseau, police, image ou dépendance ajouté.
Ces résultats de laboratoire varient avec la machine ; aucune mesure terrain.

Les diagnostics incluant les déplacements après entrée restent distincts du
CLS : médianes après refonte **0,00004/0,00005** pour les sélections,
**0,0022/0,0133** pour les deux premières corrections, **0,1863** à l’ouverture
et **0,1414** à la validation d’un entraînement. Les valeurs avant sont nulles
sur ces mêmes actions. L’expansion puis le retrait du formulaire d’entraînement
déplacent volontairement le contenu suivant ; cette différence est examinée et
soumise à revue humaine. Les détails bruts conservent le focus, `scrollY` et la
position visible de la question, séparément de ces scores.
Sur les 30 interactions de chaque version, déplacement maximal de `scrollY`
et de la question : **0 px**. Les cinq chargements commencent à `scrollY = 0` ;
chaque validation focalise sa correction. Le cas de synchronisation séparé
retire un bouton situé hors écran : ancrage natif de 68 px, question et focus
maintenus à la même place visible, sans correction de scroll par le site.

La CI Qualité conserve captures/rapport dans `playwright-review-*`, et mesures
avec comparaison dans `ui-performance-lab-*`. Elle mesure aussi les neuf pages
déjà couvertes, sans changer leurs interfaces. Liens des artefacts et résultat
des quatre checks de la tête finale à consulter dans la PR.

## Limites et clôture locale

Revue humaine des captures encore nécessaire. Aucun défaut P0 ouvert identifié
dans les contrôles terminés ; aucun résultat d’audit complet ou hébergé déduit.
L’UI peut révéler ou retirer volontairement du contenu (correction, entraînement,
retry) ; l’ancrage natif peut changer `scrollY` tout en conservant la question à
la même position visible. Aucun défilement correctif arbitraire n’est ajouté.

Stack locale arrêtée avec conservation par défaut. Après simulation et arrêt
des tests/laboratoire/aperçu, `npm run delivery:complete -- --json` a réussi :
processus inactifs, zéro échec, **0 octet supprimé**, **3 586,78 Mo conservés**
avant commit. Les builds contenant des sources non encore intégrées restent
non qualifiés ; sauvegardes et preuves sont protégées. Le passage après commit
a qualifié un build : **149 fichiers, 22,58 Mo libérés**, zéro échec ;
**3 564,36 Mo conservés** après nettoyage, au-delà du plafond dans les groupes
protégés/non qualifiés. Le plafond de 500 Mo n’autorise aucune purge supplémentaire.
