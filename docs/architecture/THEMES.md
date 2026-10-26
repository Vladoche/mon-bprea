# Apparence dynamique — lots 5 et 6.3.4

Les douze pages partagent les mêmes préférences, palettes et contrôles. Le bouton **Apparence** dans l’en-tête ouvre un dialogue utilisable au clavier (Tab, Maj+Tab, Échap) et sur mobile. Les changements s’appliquent immédiatement. Le bouton clair/sombre voisin conserve son accès rapide : il force la luminosité choisie, sans modifier la saison. Pour retrouver les ambiances horaires, sélectionner de nouveau **Automatique selon l’heure**.

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

La clé `bprea-demo-appearance-v1` contient un objet JSON versionné :

```json
{"version":1,"season":"auto","brightness":"auto","updatedAt":"2026-10-20T12:00:00.000Z"}
```

`updatedAt` est renseigné à chaque choix explicite. Les identifiants des saisons sont `spring`, `summer`, `autumn`, `winter` ; ceux de luminosité sont `light`, `dark` et `auto`. Les champs supplémentaires d’un objet reconnu sont préservés. Ce format sépare les préférences de leur rendu. Le mode visiteur reste local ; le mode personnel décrit ci-dessous utilise le même modèle de choix.

En l’absence de nouvelle sauvegarde, une ancienne valeur `light` ou `dark` de `bprea-demo-theme-v1` est reprise comme choix **manuel** et copiée dans le nouveau format. L’ancienne clé reste intacte. Une nouvelle sauvegarde valide est prioritaire, y compris en automatique. Sans préférence antérieure, les deux réglages commencent en automatique. Un enregistrement existant illisible ou d’une version inconnue n’est pas réécrit silencieusement ; lors d’un choix explicite, sa chaîne brute est conservée dans `unrecognizedPreferencesArchive` de la nouvelle sauvegarde. Si le stockage est bloqué, les contrôles fonctionnent pour la page courante et signalent l’absence de sauvegarde.

Les changements se propagent entre onglets du même site par l’événement `storage`. L’API commune `window.BpreaAppearance` expose lecture, résolution et modification ; l’interface réagit aux événements `bprea:appearance-change` et `bprea:preferences-change`. Aucun accès en écriture aux clés de cours, QCM, Drill, statistiques ou ITK n’est nécessaire.

## Préférences personnelles (lot 6.3.4)

Le stockage décrit ci-dessus reste celui du visiteur. Dans un environnement Auth configuré, `settings-service.js` sélectionne le cache IndexedDB isolé par environnement, origine Supabase et UUID vérifié, puis consomme `personal_save_appearance`. Aucun choix visiteur ne remplit automatiquement un compte. La configuration publique reste désactivée.

Le script classique applique un rendu provisoire de l’appareil avant CSS, sans réseau. L’adaptateur `appearance.js` vérifie ensuite la source et applique les préférences du bon compte. `window.BpreaAppearance` conserve ses méthodes historiques et ajoute `setSource`, `applyPreferences` et `getSource`. Appliquer une valeur reçue ne rappelle jamais le mécanisme de sauvegarde ; les événements visuels et les minuteurs ne produisent pas d’opérations réseau. Les changements de stockage visiteur sont ignorés pendant l’usage personnel.

Les préférences `auto` restent `auto` en cache et sur Supabase. Les attributs HTML restent dérivés localement, sans identifiant personnel. Le dialogue préserve une sélection active pendant la réconciliation et propose d’utiliser explicitement la version du compte. Les messages distinguent choix temporaire, transaction locale, attente, confirmation distante et erreur de stockage. Les conflits restent conservés et leur résolution exige une action volontaire. L’import v1 ou legacy reconnu possède son aperçu et sa confirmation séparés.

Le [contrat ITK/apparence](ITK-APPEARANCE-SYNCHRONISATION-CLIENT.md) précise CAS, retry exact, import et limites des caches non chiffrés. Les [preuves 6.3.4](../validations/VALIDATION-LOT6-3-4.md) distinguent captures synthétiques et PostgreSQL réel.

Voir aussi [ANECDOTES.md](ANECDOTES.md), [CACHE.md](CACHE.md) et les vérifications historiques dans [VALIDATION-LOT5.md](../validations/VALIDATION-LOT5.md).
