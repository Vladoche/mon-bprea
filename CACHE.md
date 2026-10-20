# Ressources versionnées sur GitHub Pages

Le workflow `.github/workflows/deploy.yml` exécute `scripts/prepare-pages.py` avant de déposer l'artefact Pages. Ce petit script utilise uniquement Python 3.10 ou plus récent (bibliothèque standard) et le SHA complet du commit, transmis par `GITHUB_SHA`.

## Ce qui est publié

L'artefact `site-public/` contient les pages HTML à la racine, les fichiers publics de `assets/`, les PDF de `documents/` et `.nojekyll`. Les dossiers privés et cachés, Git, la documentation et le script de préparation ne sont pas copiés. Les types de fichiers autorisés sont explicites dans `ASSET_TYPES` : ajouter un type si un futur contenu public le nécessite. N'y placer aucune donnée privée ; le script n'analyse pas le contenu des fichiers autorisés pour y détecter des secrets.

Les sources restent inchangées et peuvent toujours être servies directement avec `python -m http.server 8000`. Aucun manifeste, installation npm ou compilation n'est nécessaire.

## Références réécrites dans l'artefact

- Attributs HTML `src` et `href` vers les fichiers CSS, JavaScript et JSON locaux.
- Imports JavaScript littéraux : `import … from`, `export … from`, `import './module.js'` et `import('./module.js')`, dans **tous** les modules copiés. Les dépendances transitives reçoivent donc la même version que le module d'entrée.
- URL littérales de ressources relatives au module : `new URL('./navigation.json', import.meta.url)`, et de même pour `calendar-events.json`, `resources.json`, `drill-bank.json`, `daily-facts.json` et tout autre fichier JSON chargé de cette manière.
- Imports CSS `@import 'autre.css'` et références `url(autre.css)`.

Exemple publié : `assets/app.js?v=SHA`, qui importe `./navigation.js?v=SHA`, lequel charge `./navigation.json?v=SHA`. Les URL gardent leurs autres paramètres et leur fragment ; une éventuelle ancienne valeur de `v` est remplacée. Les URL externes, liens de pages, images, polices et chemins des PDF restent inchangés. Les chemins restent relatifs, y compris sous `https://utilisateur.github.io/mon-bprea/`.

Le script est volontairement adapté aux formes littérales du site. Pour ajouter une ressource dynamique, utiliser `new URL('./fichier.json', import.meta.url)` plutôt qu'une chaîne construite ou interpolée ; pour un module, utiliser un import littéral. Il ne transforme pas les chemins assemblés à l'exécution ni un chargement `fetch(variable)`. Les ressources CSS/JS/JSON référencées doivent exister dans les fichiers publics, et un chemin commençant par `/` est refusé pour éviter de perdre le préfixe GitHub Pages. La sortie doit être un dossier neuf ou vide : aucun fichier existant n'est supprimé par la préparation.

## Garanties et limites de cache

Un **nouvel HTML chargé** référence les URL du nouveau commit ; ses CSS, modules transitifs et JSON utilisent cette version, ce qui distingue leurs entrées de cache de celles du déploiement précédent. Un même SHA produit des références stables. Les JSON gardent également leur politique de revalidation existante dans les appels `fetch`.

GitHub Pages ne permet pas de définir librement les en-têtes HTTP de cache depuis le dépôt. Un ancien HTML déjà en cache peut temporairement continuer à référencer l'ancienne version des ressources. Cette solution ne garantit donc ni invalidation immédiate de tous les caches, ni mise à jour d'un onglet déjà ouvert. Un rechargement de la page, éventuellement forcé, peut être nécessaire tant que l'HTML n'a pas été revalidé. Aucun service worker n'est ajouté. L'anecdote quotidienne tourne à partir des données déjà chargées sans nécessiter de déploiement ; un enrichissement de sa banque devient disponible avec le nouvel artefact.

La préparation ne touche pas à `localStorage`, aux résultats des exercices, aux statistiques ou aux préférences. Elle opère uniquement sur une copie de fichiers statiques.

## Vérifier avant une publication autorisée

Préparer un dossier temporaire neuf avec une version reconnaissable, depuis la racine du dépôt :

```powershell
python scripts/prepare-pages.py --version verification-locale --output .tmp/pages-verification
python -m http.server 8001 --directory .tmp
```

Ouvrir `http://localhost:8001/pages-verification/` : ce sous-dossier simule le préfixe de GitHub Pages. Dans l'onglet Réseau du navigateur, vérifier le chargement de `theme-init.js`, des styles, de `app.js`, de ses imports et des JSON avec `?v=verification-locale`, puis les pages de calendrier, bibliothèque, Drill et Tableau de bord. Les PDF doivent continuer à s'ouvrir avec leurs URL habituelles. Le script refuse de réutiliser une sortie non vide ; choisir un nouveau nom lors de la vérification suivante.

Après une publication **préalablement autorisée**, ouvrir la véritable adresse Pages avec son préfixe, vérifier que les URL réseau portent le SHA du commit publié et recharger une page déjà visitée. Les en-têtes HTTP effectifs restent ceux du service Pages : les examiner dans Réseau pour diagnostiquer un HTML ancien. Ne pas conclure à un déploiement instantanément visible depuis la seule réussite du workflow.
