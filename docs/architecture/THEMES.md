# Apparence dynamique

Le header commun propose une **icône clair/sombre** (`#theme-toggle`), sans bouton Apparence. Elle force la luminosité choisie sans modifier la saison. En visiteur, son clic mémorise ce choix sur l’appareil pour les prochaines pages ; l’infobulle l’explique et un statut accessible annonce le résultat. Les réglages complets sont dans **Mon profil → Paramètres → Régler l’apparence** (`profil.html#parametres`, bouton `#appearance-open`). Le dialogue `#appearance-dialog` conserve le clavier natif (Tab, Maj+Tab, Échap), la fermeture et le retour au contrôle d’ouverture. Les changements visuels sont immédiats ; sélectionner **Automatique selon l’heure** rétablit les ambiances horaires.

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

## Modifier les palettes ou les horaires

`assets/style.css` définit les tokens `--color-*`, puis leurs alias historiques (`--bg`, `--white`, `--green`, etc.). Les blocs `data-season` modifient les palettes, les variantes `data-theme="dark"` les adaptent à la lecture nocturne. `data-time` ajuste discrètement les surfaces. Pour une nouvelle couleur, privilégier son rôle (texte, surface, accent, contrôle) plutôt que sa valeur littérale. Les tokens de succès, erreur et avertissement gardent leur signification dans toutes les saisons. Les graphiques utilisent ces tokens et les textes/tableaux existants restent accessibles.

Les limites horaires sont regroupées dans `timePeriods`, au début de `assets/theme-init.js`. Le fournisseur `getLocalTimePeriod(date)` est séparé de la résolution saison/luminosité : il pourra être remplacé ultérieurement par des horaires solaires. Adapter ensemble le code, le tableau ci-dessus et le texte d’aide de `assets/appearance.js`.

Éviter les transitions prolongées ; `prefers-reduced-motion` désactive les transitions et déplacements concernés. L’impression ITK conserve des surfaces claires.

## Stockage et compatibilité

Le script classique `assets/theme-init.js` s’exécute **avant les feuilles de style**, sur toutes les pages, pour appliquer les attributs HTML avant le premier rendu. Le navigateur doit naturellement avoir reçu la nouvelle page et le script pour bénéficier du nouveau thème.

La préférence d’appareil volontaire utilise **`bprea-demo-appearance-device-v1`**. Le format accepté a exactement trois champs :

```json
{"version":1,"season":"autumn","brightness":"dark"}
```

Les saisons sont `auto`, `spring`, `summer`, `autumn`, `winter` ; les luminosités `auto`, `light`, `dark`. Sans mémorisation valide, le modèle commence en `auto`/`auto`. Le clic lune/soleil du header appelle la mémorisation existante en visiteur : la navigation, le rechargement et les autres onglets retrouvent ce choix dès le script avant CSS, sans nouvelle clé. Les sélecteurs du dialogue restent des choix de page ; **Mémoriser mon apparence sur cet appareil** permet de les garder explicitement. **Retirer l’apparence mémorisée** retire cette seule clé, en gardant le rendu courant. Le choix tout automatique ne nécessite pas de mémorisation.

Les anciennes clés `bprea-demo-appearance-v1` et `bprea-demo-theme-v1` sont préservées, sans reprise silencieuse. **Reprendre une ancienne apparence** applique explicitement une valeur lisible à la page courante ; une mémorisation séparée est nécessaire pour les prochaines pages. Une valeur d’appareil illisible n’est pas écrasée par le bouton de mémorisation ; l’erreur est signalée. Si le stockage est bloqué, le rendu temporaire reste possible mais sa conservation n’est pas garantie.

Les événements `storage` sur la clé d’appareil relisent les choix mémorisés, sans remplacer un choix temporaire actif. `window.BpreaAppearance` expose résolution, lecture, mise à jour, mémorisation/retrait/reprise et sélection de source. Les événements `bprea:appearance-change` et `bprea:preferences-change` actualisent l’interface ; ils n’écrivent pas dans les clés pédagogiques.

## Préférences personnelles (lot 6.3.4)

Le stockage d’appareil décrit ci-dessus reste celui du visiteur. Dans un environnement Auth configuré, `settings-service.js` sélectionne le cache IndexedDB isolé par environnement, origine Supabase et UUID vérifié, puis consomme `personal_save_appearance`. Aucun choix visiteur ne remplit automatiquement un compte. Le fichier public versionné reste désactivé ; la configuration de l’artefact Pages est distincte, voir l’[état du projet](../developpement/ETAT-DU-PROJET.md).

Le script classique applique un rendu provisoire de l’appareil avant CSS, sans réseau. Un compte sans préférence garde provisoirement ce rendu ; son modèle personnel éditable reste automatique jusqu’à un choix explicite. L’adaptateur `appearance.js` vérifie ensuite la source et applique les préférences du bon compte. `window.BpreaAppearance` conserve ses méthodes historiques et ajoute `setSource`, `applyPreferences` et `getSource`. Appliquer une valeur reçue ne rappelle jamais le mécanisme de sauvegarde ; les événements visuels et les minuteurs ne produisent pas d’opérations réseau. Les changements de stockage visiteur sont ignorés pendant l’usage personnel.

Les préférences `auto` restent `auto` en cache et sur Supabase. Les attributs HTML restent dérivés localement, sans identifiant personnel. Le dialogue préserve une sélection active pendant la réconciliation et propose d’utiliser explicitement la version du compte. Les messages distinguent choix temporaire, transaction locale, attente, confirmation distante et erreur de stockage. Les conflits restent conservés et leur résolution exige une action volontaire. L’import v1 ou legacy reconnu possède son aperçu et sa confirmation séparés.

Le [contrat ITK/apparence](ITK-APPEARANCE-SYNCHRONISATION-CLIENT.md) précise CAS, retry exact, import et limites des caches non chiffrés. Les [preuves 6.3.4](../archives/validations/VALIDATION-LOT6-3-4.md) distinguent captures synthétiques et PostgreSQL réel.

Voir aussi [ANECDOTES.md](ANECDOTES.md), [CACHE.md](CACHE.md) et les vérifications historiques dans [VALIDATION-LOT5.md](../archives/validations/VALIDATION-LOT5.md).

Les parcours d’accès et la présentation 2027 sont qualifiés dans [PR1](../validations/VALIDATION-UI-2027-PR1.md) et [PR2](../validations/VALIDATION-UI-2027-PR2.md). Les contrats de préférences ne sont pas modifiés par cette maintenance documentaire.

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
