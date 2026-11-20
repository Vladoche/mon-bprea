# Apparence dynamique

Le header commun propose une **icône clair/sombre** (`#theme-toggle`), sans bouton Apparence. Elle force la luminosité sans modifier la saison ni les couleurs. En visiteur, son clic mémorise ce choix sur l’appareil pour les prochaines pages ; l’infobulle l’explique et un statut accessible annonce le résultat. Les réglages complets sont dans **Mon profil → Paramètres → Régler l’apparence** (`profil.html#parametres`, bouton `#appearance-open`). Le dialogue `#appearance-dialog` conserve le clavier natif (Tab, Maj+Tab, Échap), la fermeture et le retour au contrôle d’ouverture. Les changements visuels sont immédiats ; sélectionner **Automatique** sous Luminosité rétablit les ambiances horaires.

| Contexte | Chemin et sauvegarde |
| --- | --- |
| Visiteur, Auth désactivée ou sans compte | Header : clair/sombre mémorisé au clic ; footer « Paramètres » vers `profil.html#parametres`, dont les réglages restent accessibles sans connexion. Dans le dialogue, choix temporaires puis mémorisation/retrait volontaires |
| Compte connecté | Mon profil → Paramètres ; préférences personnelles via `settings-service.js`, cache isolé et synchronisation existante |
| Compte reconnu hors ligne | Même menu Mon profil ; cache personnel utilisable si le service reconnaît la portée. Choix conservés localement, attente distante signalée ; aucune confirmation réseau inventée |
| Identité en vérification ou à revérifier, stockage personnel indisponible | Choix visuel temporaire ; pas d’écriture visiteur ni personnelle non vérifiée. Le dialogue indique la limite |

Le footer commun est rendu par `assets/footer.js`. Le profil crée ses paramètres avant la résolution Auth : l’absence de session ne les masque pas. La présentation du compte ne remplace pas les contrôles d’identité du service.

## Sélection automatique

La saison suit le **calendrier local du navigateur**, avec les conventions météorologiques de l’hémisphère nord : printemps du 1er mars au 31 mai, été du 1er juin au 31 août, automne du 1er septembre au 30 novembre, hiver du 1er décembre à fin février. Il ne s’agit pas d’équinoxes ou de solstices calculés.

La luminosité automatique suit l’heure locale du navigateur :

| Ambiance | Plage locale | Luminosité |
| --- | --- | --- |
| Matin | 06:00 à 09:59 | Claire, fond légèrement doré |
| Journée | 10:00 à 17:59 | Claire, neutre |
| Crépuscule | 18:00 à 21:59 | Claire, fond plus chaud |
| Nuit | 22:00 à 05:59 | Sombre |

Ce sont des plages conventionnelles, **sans calcul astronomique ni géolocalisation**. Un contrôle chaque minute et au retour sur la page actualise les ambiances sans rechargement. Un onglet suspendu retrouve l’apparence actuelle lorsqu’il redevient visible. Le mode clair manuel conserve l’ambiance de journée ; le mode sombre manuel conserve celle de nuit. La saison reste indépendante.

## Couleurs personnalisées

Le sélecteur **Palette de couleurs** propose **Saisonnière** ou
**Personnalisée**. Seul le réglage actif est affiché, saison ou roue
chromatique. La roue de `appearance-color.js` associe l’angle à la teinte et
la distance au centre à la saturation. On peut aussi la régler avec les trois
curseurs natifs ou le champ hexadécimal. Le glissement affiche un aperçu
immédiat. Relâcher la roue, valider le code ou terminer un réglage du curseur
enregistre le choix par le mécanisme courant.

La couleur sRGB fournit une teinte et une chroma OKLCH plafonnée. Les tokens
CSS fixent une clarté par rôle et une variante par luminosité. Le thème dérive
ses surfaces, textes, bordures de contrôle, accents et couleurs de graphique
de ces rôles. Les couleurs fonctionnelles de succès, erreur, avertissement et
focus restent liées à leur signification. Les curseurs et le code restent
utilisables en contraste forcé. Chaque mode conserve le dernier réglage
de l’autre pour une réactivation ultérieure.

## Modifier les palettes ou les horaires

`assets/style.css` définit les tokens `--color-*` et leurs alias historiques
(`--bg`, `--white`, `--green`, etc.). Le mode saisonnier utilise `data-season`
et les teintes horaires de `data-time`. Le mode personnalisé utilise
`data-color-mode="custom"`, la teinte et la chroma choisies. Les variantes
`data-theme="dark"` adaptent chaque palette à la lecture nocturne. Les tokens
fonctionnels de succès, erreur et avertissement gardent leur signification
dans les deux modes.

Les limites horaires sont regroupées dans `timePeriods`, au début de `assets/theme-init.js`. Le fournisseur `getLocalTimePeriod(date)` est séparé de la résolution saison/luminosité : il pourra être remplacé ultérieurement par des horaires solaires. Adapter ensemble le code et le tableau ci-dessus.

La palette s’applique immédiatement à la page. `prefers-reduced-motion`
désactive les transitions et déplacements des composants concernés.
L’impression ITK conserve des surfaces claires.

Pour une commande autonome assortie aux entrées du header, utiliser
`.btn.btn-surface`. La variante `.btn-surface--accent` reprend la surface
terracotta de l’entrée active. `.btn-surface--danger` garde la surface neutre
avec les couleurs fonctionnelles du retrait. Le header et ces variantes
résolvent les mêmes tokens `--control-pill-*` pour les dégradés, reflets,
ombres et anneau de focus. Sur un bouton ou un lien natif, cette surface
conserve les interactions de l’élément et adapte l’affichage au contraste
forcé. L’état désactivé s’applique aux boutons natifs.
Les commandes temporairement indisponibles avec `aria-disabled="true"`
partagent ces couleurs et gardent leur focus. Le code du composant ignore
l’activation dans cet état, comme pour l’actualisation du tableau de bord.
Les commandes neutres du calendrier, de la navigation autonome des pages
publiques et des parcours pédagogiques utilisent la même surface.

Les cartes de catégorie et les réponses botaniques adaptent la géométrie de
`.btn.btn-surface` à leurs libellés. La sélection reprend le contour terracotta,
le reflet et l’ombre pressée du header, avec un libellé visible et `aria-pressed`.
Les couleurs de succès et d’erreur s’appliquent après validation. Les cadres
photo reprennent l’arrondi `--radius-md` et l’ombre `--shadow-raised` des cartes.
Les JPEG s’affichent en entier avec leurs couleurs d’origine dans chaque palette.
La [planche du lot botanique](../validations/VALIDATION-UI-2027-PR4-LOT4.md#galerie-et-accessibilité)
compare les surfaces et les états interactifs en clair et sombre.

## Stockage et compatibilité

Le script classique `assets/theme-init.js` s’exécute **avant les feuilles de style**, sur toutes les pages, pour appliquer les attributs HTML avant le premier rendu. Le navigateur doit naturellement avoir reçu la nouvelle page et le script pour bénéficier du nouveau thème.

La préférence volontaire utilise `bprea-demo-appearance-device-v1`.
Les anciens documents à trois champs restent des palettes saisonnières.
Un choix chromatique enregistre les deux champs complémentaires.

```json
{"version":1,"season":"autumn","brightness":"dark","colorMode":"custom","customColor":"#6052ce"}
```

Le clic lune/soleil mémorise en visiteur. Dans le dialogue, l’aperçu est
temporaire jusqu’à **Mémoriser mon apparence sur cet appareil**.
**Retirer l’apparence mémorisée** retire cette seule copie et conserve le rendu
de la page. Les anciennes clés `bprea-demo-appearance-v1` et
`bprea-demo-theme-v1` restent conservées. Les commandes de reprise d’ancienne
apparence et d’import ont quitté le dialogue. Une mémorisation inconnue ou
illisible est conservée et son remplacement est refusé.

## Premier rendu et préférences personnelles

Le script pré-CSS vérifie le montage, le projet, l’identifiant de compte et
l’identifiant de session SDK à partir du repère local de continuité Auth.
Ce repère contient seulement les paramètres nécessaires au rendu actif
(luminosité, mode, saison active ou couleur active). `appearance.js` l’alimente
depuis le cache personnel ou la préférence synchronisée. Le repère sert
uniquement au rendu. Appliquer la palette ne provoque aucune écriture réseau.

Une session sans repère concordant et un stockage indisponible commencent avec
une palette neutre sombre. Un repère historique réutilise sa luminosité le temps
de retrouver la palette. Sur un navigateur sans session, le site applique les
préférences visiteur mémorisées ou l’heure locale. Sur les pages avec le service
Auth, une fois l’identité reconnue, `appearance.js` applique le cache personnel
cloisonné puis la valeur reçue.
Un compte dont l’absence de préférences est établie peut reprendre la saison
et la luminosité du navigateur dans son rendu, avec un modèle éditable
automatique. Les pages autonomes Contact et Confidentialité restent accessibles
indépendamment du service de compte. Elles utilisent le réglage visiteur ou
la palette pré-CSS d’une session reconnue localement.

`pageshow`, `visibilitychange` et `storage` réévaluent l’heure et la continuité.
Une session remplacée retire les couleurs précédentes et relance la vérification.
Sur retour BFCache, le rechargement de sécurité relit le repère de session.
La vérification Auth, l’accès IndexedDB et RLS
continuent d’isoler les préférences par compte. Aucun choix visiteur ne remplit
automatiquement le compte. Le dialogue protège la saisie en cours et montre
les problèmes d’enregistrement, la reprise hors ligne et les conflits.

Le [contrat ITK/apparence](ITK-APPEARANCE-SYNCHRONISATION-CLIENT.md) précise les
révisions, les formats, les imports et l’ordre de mise en service. Les tests
Playwright lisent les pixels du compositeur pendant la vérification Auth et
la lecture des préférences. Le parcours Supabase local vérifie aussi l’écriture
de la couleur et les premières images claires et sombres des pages principales.

Voir aussi [ANECDOTES.md](ANECDOTES.md), [CACHE.md](CACHE.md) et les vérifications historiques dans [VALIDATION-LOT5.md](../archives/validations/VALIDATION-LOT5.md).

Les parcours d’accès et la présentation 2027 sont qualifiés dans [PR1](../validations/VALIDATION-UI-2027-PR1.md) et [PR2](../validations/VALIDATION-UI-2027-PR2.md).

Correction de navigation du 16/11/2026 : le bouton du header ne gardait auparavant
le choix que sur la page. La régression est reproduite avant correction puis
couverte par `tests/e2e/appearance-navigation.spec.js` : Accueil → Outils → Mes
cours, clair/sombre, rechargement, second onglet et retrait, à 390 et 1440 px.
Le compte continue à utiliser le service personnel ; une identité bloquée ne
permet aucune écriture visiteur et les erreurs/quota/valeurs inconnues ne sont
pas annoncés comme une mémorisation réussie. La notice approuvée reste intacte.

Validation locale : régression Accueil → Outils reproduite avant le correctif ;
15 tests unitaires/intégration d’apparence et 43 scénarios E2E distincts réussis
(apparence, D12, paramètres personnels et navigation commune). Captures
ordinateur/mobile conservées dans `.tmp/fix-appearance-navigation/` pour revue,
avec le constat avant correction ; les nouveaux parcours produisent aussi leurs
captures dans l’artefact Playwright CI. Pas de recette PROD revendiquée.
