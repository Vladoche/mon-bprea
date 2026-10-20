# Administrer les ressources pédagogiques

La bibliothèque est définie dans **`assets/resources.json`**. Ce fichier constitue la source unique des fiches : une ressource commune à plusieurs UC ou cours reste un seul objet avec plusieurs relations. `assets/resources.js` charge, valide et interroge ce JSON ; il ne contient plus de second catalogue à modifier. Les contenus des cours, les QCM, le Drill et leurs identifiants restent dans leurs fichiers existants.

## Comprendre le fichier

Le document contient trois propriétés à sa racine :

```json
{
  "version": 1,
  "chapters": [],
  "resources": []
}
```

Ce schéma vide explique la structure ; **ne remplace pas le catalogue actuel par cet exemple**. Ajoute ou modifie un objet dans ses listes existantes. Le JSON demande des guillemets doubles, des virgules entre les éléments et aucune virgule après le dernier élément. Il n’accepte pas les commentaires.

| Champ d’une fiche | Utilisation |
| --- | --- |
| `id` | Identifiant unique et stable, par exemple `ma-fiche-biologie-sol`. Utilise des minuscules, chiffres et tirets. |
| `title`, `description` | Titre et courte présentation en texte, sans HTML. |
| `type` | `website` (site), `pdf`, `technical-sheet` (fiche technique), `video` ou `tool` (outil externe). |
| `url` | Adresse `https://` ou `http://` d’une ressource externe. |
| `file` | Chemin d’un PDF hébergé dans `documents/`, relatif à la racine du site. Choisis `file` pour un document local et `url` pour une destination externe. |
| `organization` | Organisme éditeur ou auteur, si connu. Utilisé dans la recherche et le classement. |
| `units` | Liste des identifiants d’UC associés. `[]` signifie ressource générale. |
| `chapters` | Liste des identifiants de chapitres définis dans le registre. |
| `lessons` | Liste des identifiants exacts des cours associés. C’est cette relation qui alimente « Pour approfondir ». |
| `themes` | Liste d’intitulés de thématiques libres, réutilisables comme filtres. |
| `keywords` | Liste de mots-clés pour la recherche. |
| `publishedAt`, `addedAt` | Dates facultatives connues, au format ISO `YYYY-MM-DD`. Omet un champ plutôt que d’inventer une date. |
| `source` | Source documentaire, par exemple `{"title":"Mon support personnel"}` ; une propriété `url` HTTP(S) est possible si elle est connue. |
| `license` | Licence ou conditions de réutilisation connues, facultatives. Ne déduis pas une autorisation de l’absence de licence. |

La recherche porte sur le titre, la description, les mots-clés, l’organisme et les thématiques. Elle ignore les accents et la casse et demande que tous les mots recherchés soient présents dans ces métadonnées. Elle ne lit pas le texte intégral des PDF. Les filtres UC, thématique et type sont visibles directement ; « Préciser par cours, chapitre ou organisme » ouvre les filtres avancés. Tous les filtres se combinent : une fiche doit satisfaire chaque critère sélectionné.

Le tri propose le titre de **A à Z**, de **Z à A**, ou la **date d’ajout, plus récents d’abord**. L’ordre des titres suit le français. Dans le tri par date, les fiches sans `addedAt` connue sont placées à la fin, par ordre alphabétique ; une date de publication ne remplace pas la date d’ajout. La réinitialisation enlève les critères et revient au tri par titre de A à Z. Les dates ou sources absentes ne sont pas inventées ; l’interface indique « Organisme non renseigné » ou que les conditions de réutilisation sont inconnues lorsque c’est nécessaire.

## Relier une ressource aux UC, chapitres et cours

Les UC utilisent les identifiants `uc1`, `uc2`, `uc3`, `uc4`, `uc5`, `ucare1`, `ucare2`. Une ressource commune aux UC 02 et UC 03 porte `"units": ["uc2", "uc3"]`.

Les quatre cours actuels de l’UC 03 ont les identifiants suivants :

| Identifiant de cours | Contenu |
| --- | --- |
| `matiere-organique` | Cycle de la matière organique. |
| `rapport-cn` | Rapport carbone/azote. |
| `pedofaune` | Faune du sol. |
| `pedoflore` | Pédoflore et indicateurs biologiques. |

Le registre `chapters` définit les chapitres sans changer ces identifiants ni le contenu des cours. Son entrée actuelle est :

```json
{
  "id": "uc3-sol-vivant",
  "unit": "uc3",
  "title": "Le sol vivant",
  "lessons": ["matiere-organique", "rapport-cn", "pedofaune", "pedoflore"]
}
```

Dans une fiche ressource, `"chapters": ["uc3-sol-vivant"]` permet de la classer et de la filtrer dans ce chapitre. Cela ne l’associe pas automatiquement à tous les cours du chapitre. Pour la montrer dans un cours, renseigne ce cours dans **`lessons`**. Le site ne crée jamais de relation sur la ressemblance des mots-clés, du titre ou du thème.

Dans la bibliothèque, les cours explicitement associés offrent la navigation inverse. Sur un cours, « Pour approfondir » présente les ressources de `lessons` et un accès à celles de l’UC. Sur une page d’UC, le site présente un aperçu de trois ressources rattachées à cette UC et un lien vers leur liste complète. Une ressource sans cours ou sans UC reste consultable dans la bibliothèque. Aucun lien vers un cours n’est déduit des seules listes `units`, `chapters`, `themes` ou `keywords`.

Si un identifiant de cours ou de chapitre disparaît, le lecteur le signale et évite les liens cassés. Corrige la relation dans le catalogue ; n’en déduis pas une nouvelle automatiquement. Lors d’une modification de titre, conserve l’identifiant stable pour préserver les liens, exercices et historiques.

## Exemple 1 — Nouvelle fiche personnelle sur la biologie du sol

**Exemple à créer, non livré dans le dépôt.** Il suppose que tu rédiges toi-même une fiche sur les propriétés biologiques du sol, pertinente pour les cours `pedofaune` et `pedoflore`, et que tu disposes des droits sur tous ses textes et illustrations. Il ne désigne aucun PDF externe et ne réutilise pas la fiche de démonstration sur la matière organique.

1. Rédige ta fiche personnelle puis exporte-la en PDF.
2. Place-la dans `documents/sols/ma-fiche-biologie-sol.pdf`.
3. Ajoute cet objet dans la liste `resources`, après avoir adapté l’auteur et les conditions de réutilisation à ta situation réelle :

```json
{
  "id": "ma-fiche-biologie-sol",
  "title": "Ma fiche — Propriétés biologiques du sol",
  "description": "Fiche personnelle pour comparer les rôles de la faune et de la flore du sol et leurs indicateurs.",
  "type": "pdf",
  "file": "documents/sols/ma-fiche-biologie-sol.pdf",
  "organization": "Auteur personnel à renseigner",
  "units": ["uc3"],
  "chapters": ["uc3-sol-vivant"],
  "lessons": ["pedofaune", "pedoflore"],
  "themes": ["Sol", "Biologie du sol"],
  "keywords": ["pédofaune", "pédoflore", "indicateurs biologiques"],
  "source": {"title": "Création personnelle à rédiger"}
}
```

Les deux cours présentent alors la même fiche grâce à `lessons`, sans dupliquer le PDF ni l’objet. N’ajoute pas cet objet tant que le document n’existe pas et que son contenu n’a pas été vérifié. La fiche PDF existante `fiche-demo` traite du cycle de la matière organique ; son association à ce cours est conservée.

## Exemple 2 — Site GRAB commun à plusieurs UC

Le site GRAB figure déjà dans le catalogue. L’exemple ci-dessous illustre son association aux UC 02 et UC 03. **Modifie la fiche `grab` existante plutôt que d’en ajouter une deuxième.** Ce lien général ne comporte pas de relation de cours précise non vérifiée :

```json
{
  "id": "grab",
  "title": "GRAB — Techniques de maraîchage biologique",
  "description": "Synthèses et essais sur les systèmes, les variétés et les pratiques en maraîchage bio.",
  "type": "website",
  "url": "https://www.grab.fr/techniques-bio/maraichage/",
  "organization": "GRAB",
  "units": ["uc2", "uc3"],
  "chapters": [],
  "lessons": [],
  "themes": ["Maraîchage", "Agriculture biologique"],
  "keywords": ["Bio", "Essais", "ITK"],
  "source": {
    "title": "GRAB",
    "url": "https://www.grab.fr/techniques-bio/maraichage/"
  }
}
```

Pour ajouter un autre site, prends cette structure, donne-lui son propre `id`, vérifie son adresse et renseigne seulement les relations pédagogiques effectivement établies. Les types `video` et `tool` utilisent aussi une `url`. Une fiche technique peut pointer vers un PDF local ou une destination externe selon sa provenance.

## Choisir des thématiques et modifier une fiche

Les thématiques sont des libellés libres dans `themes`, sans fichier supplémentaire. Réutilise une orthographe cohérente, par exemple `Sol`, `Fertilisation`, `Irrigation`, `Gestion` ou `Commercialisation`, pour éviter plusieurs filtres portant presque le même nom. Un mot-clé peut être plus précis, tel que `rapport C/N` ou `couverts végétaux`.

Pour modifier une ressource, retrouve son `id` dans `assets/resources.json` puis corrige son titre, sa destination ou ses listes. Conserve cet `id` lors d’un simple changement de présentation. Une même fiche peut contenir plusieurs UC, chapitres, thèmes et cours.

Pour retirer une fiche, supprime seulement son objet de `resources` et vérifie les virgules autour. Cette action ne supprime pas le fichier PDF. Ne retire pas un document déjà publié sans examiner ses liens existants et décider explicitement de son retrait. Les autres PDF déjà présents dans `documents/` ne sont pas ajoutés automatiquement au catalogue.

## Ranger les PDF sans casser les liens

Les nouveaux documents peuvent être classés dans `documents/sols/`, `fertilisation/`, `cultures/`, `gestion/` ou `autres/`. Ces dossiers sont préparés sans déplacer les fichiers existants. Les trois chemins actuellement catalogués sont préservés :

- `documents/fiche-demo-matiere-organique.pdf`
- `documents/Annuaire_fournisseurs-semences-couverts_vegetaux.pdf`
- `documents/Guide_des_aides_2026.pdf`

Pour un nouveau fichier, utilise de préférence des noms courts en minuscules, sans espaces ni accents, avec tirets ou underscores. Ne renomme pas les anciens fichiers pour les uniformiser. GitHub Pages distingue les majuscules et minuscules, contrairement à certains usages locaux de Windows.

Un chemin de catalogue commence par `documents/`, sans slash initial, nom de lecteur Windows, `..` ou adresse propre à ton ordinateur. Il est relatif à la racine du site, même si le JSON réside dans `assets/`. Ainsi `documents/sols/ma-fiche-biologie-sol.pdf` fonctionne aussi sous `/mon-bprea/`. Pour un nom existant contenant des caractères spéciaux, utilise le nom réel et laisse l’interface encoder le lien ; n’ajoute pas un second encodage `%25` devant une séquence déjà encodée.

N’ajoute un PDF que si sa republication est autorisée. Renseigne la source et, si elle est connue, la licence ou l’autorisation correspondante. Une adresse consultable sur le Web ne suffit pas à établir un droit de redistribution : un lien vers le site éditeur permet de référencer une ressource sans recopier son document. Aucun nouveau PDF tiers n’est inclus dans ce lot.

## Comprendre la vérification des PDF

La vérification démarre **automatiquement à l’affichage d’une fiche de PDF local**, dans la bibliothèque comme dans les cours et les UC. Elle ne dépend pas d’un clic sur « Consulter ». Le résultat est partagé en mémoire pendant la consultation de la page ; « Réessayer la vérification » lance un nouveau contrôle.

Le site envoie d’abord une requête HTTP `HEAD`. Si le serveur indique un PDF disponible, les actions de consultation et de téléchargement apparaissent. Si `HEAD` n’est pas pris en charge ou que le type reçu reste ambigu, une requête `GET` demande le début du fichier : le contrôle examine au plus **1 024 octets** à la recherche de la signature `%PDF-`, puis annule la lecture du flux. Il ne charge pas le contenu complet pour l’indexer.

| Résultat du contrôle | Comportement de la fiche |
| --- | --- |
| PDF disponible | Consultation et téléchargement proposés. |
| HTTP `404` ou `410`, page HTML à la place du PDF ou signature PDF absente | Document considéré comme introuvable ou invalide ; liens de consultation et téléchargement retirés, avec possibilité de réessayer la vérification. |
| Panne réseau, autre erreur temporaire ou délai maximal de 10 secondes dépassé | État non vérifié signalé ; « Essayer de consulter le PDF », téléchargement et nouvelle vérification restent proposés. |

Ce contrôle ne supprime ni la fiche du catalogue ni le fichier d’origine. Il porte seulement sur les PDF locaux ; les destinations externes, y compris les PDF externes, ne sont pas vérifiées automatiquement.

## Vérifier avant une demande de publication

1. Enregistre le JSON et vérifie sa syntaxe dans l’éditeur. Recharge la page servie par HTTP local ; le catalogue n’est pas destiné à une ouverture en `file://`.
2. Vérifie que la fiche apparaît dans la bibliothèque et que les filtres UC, cours, chapitre, thématique et type correspondent aux relations saisies. Essaie une recherche par titre et mot-clé, puis la réinitialisation.
3. Ouvre les cours explicitement associés et vérifie « Pour approfondir », puis la navigation inverse depuis la ressource.
4. Pour un PDF, vérifie son nom exact sur disque et attends le contrôle automatique dès l’affichage de sa fiche. Vérifie ensuite consultation et téléchargement ; en cas d’erreur, distingue un fichier introuvable d’un contrôle temporairement impossible, puis essaie « Réessayer la vérification » après correction du chemin ou de la connexion.
5. Vérifie le chemin sous un sous-dossier de site, la casse, les caractères encodés et l’affichage mobile en modes clair et sombre.
6. Pour un lien externe, ouvre la destination et contrôle sa pertinence. Son accessibilité peut évoluer ; le site statique ne garantit pas une vérification automatique des destinations externes.

Les cartes dont la destination est absente ou invalide, les références inconnues et les erreurs de chargement ont un état explicite. Corrige les métadonnées ou le fichier concerné ; aucune correction automatique du contenu d’origine n’est appliquée. Les liens ouverts dans un nouvel onglet utilisent `rel="noopener noreferrer"`.

Il n’existe ni upload dans le navigateur, ni indexation intégrale des PDF, ni backend ou synchronisation. La bibliothèque ne modifie pas la progression locale, les résultats de QCM, le Mode Drill ou le Tableau de bord. Les vérifications historiques du lot 4, qui n’ajoutait pas de suite automatisée, figurent dans [VALIDATION-LOT4.md](../validations/VALIDATION-LOT4.md) ; elles correspondent à la branche `feature/ressources-pedagogiques`. Le lot 5.1 introduit les contrôles décrits dans [../TESTS.md](../TESTS.md). Fusion et déploiement demandent la validation de l’utilisateur.
