# Validation manuelle — Bibliothèque documentaire avancée

Réalisée le **19 octobre 2026** sur `feature/ressources-pedagogiques`, créée après actualisation des références distantes depuis `origin/main` au commit `5e9e8c1`. L’intégration du lot 3 (`a7f336c`, PR nº 2) a été vérifiée avant toute modification. Le dépôt était propre.

Vérification exploratoire dans Chromium avec serveur HTTP local et chemin **`/mon-bprea/`**, interactions souris/clavier, inspection des métadonnées et captures visuelles. Les simulations de ressources, de fichiers et d’erreurs sont limitées à un **contexte navigateur distinct**, sans données initiales ni cookies. Aucun jeu fictif n’a été ajouté aux fichiers livrés ou à la progression réelle. Aucune suite ni fichier de tests automatisés, dépendance, backend ou compte utilisateur ajouté.

## Résultats observés

| Parcours | Résultat |
| --- | --- |
| Catalogue existant | Les 8 fiches sont présentes : 5 sites et 3 PDF. Identifiants et destinations conservés ; les 11 PDF existants restent à leur emplacement. Les 8 PDF hors catalogue ne reçoivent aucune nouvelle fiche. |
| Recherche textuelle | « Chlorofil » retrouve son titre ; « ITK » et « GRAB » retrouvent GRAB ; « meteo correze » retrouve Météo-France sans accents. Seules les métadonnées éditoriales sont recherchées. |
| Filtres combinés | UC 03 + Sol et fertilité + PDF + cours `matiere-organique` + chapitre `uc3-sol-vivant` : une seule fiche, `fiche-demo`. Les critères se combinent par intersection. |
| Filtres avancés | Cours, chapitre et organisme accessibles dans un panneau dépliable. Filtre organisme GRAB : seule sa fiche est affichée. |
| Plusieurs UC | Les relations explicites d’une même fiche la rendent accessible depuis chacune de ses UC sans la dupliquer dans le catalogue. UC 03 : 7 ressources ; UC 03 + PDF : 2. |
| Tri et dates absentes | Titres triés de A à Z ou de Z à A en français. Les dates d’ajout étant inconnues dans le catalogue livré, le tri récent les laisse en fin et les départage par titre avec une explication. Aucune date inventée. |
| Réinitialisation et historique du navigateur | Retour aux 8 fiches et au tri A→Z, suppression des critères de l’URL et focus sur la recherche. Rechargement et bouton Retour restituent les filtres de l’URL. |
| Aucune correspondance | Filtre Vidéo : 0 ressource, état explicite avec proposition de réinitialiser. Aucun contenu fictif n’apparaît pour remplir la sélection. |
| Fiches documentaires | Type, description, organisme connu, UC, thèmes et liens vers les cours affichés. Les informations dépliables présentent chapitre, mots-clés, source et conditions de réutilisation disponibles. Organismes et droits inconnus signalés sans attribution inventée. |
| Association pédagogique réelle | Le contenu de la fiche PDF existante a été lu : apports organiques, transformations biologiques, minéralisation/stabilisation, K1/K2 et facteurs de décomposition. Elle est liée uniquement au cours `matiere-organique`, UC 03, chapitre du sol vivant. Aucun lien n’est déduit avec les autres cours. |
| Cours ↔ bibliothèque | Depuis la fiche : ouverture du cours sur la matière organique. Sa section « Pour approfondir » affiche la même fiche compacte, avec consultation/téléchargement. Retour vers la bibliothèque filtrée sur ce cours : 1 ressource. Lien vers toutes les ressources UC 03 présent. |
| Cours sans association | Le cours `pedoflore` indique qu’aucune ressource ne lui est directement associée, tout en proposant la bibliothèque de l’UC. Le chapitre commun ne lui attribue pas artificiellement la fiche de matière organique. |
| Page d’UC | Aperçu de 3 fiches parmi les 7 ressources UC 03, avec lien vers la liste complète. L’ajout n’altère pas la liste des cours ni la progression. |
| Plusieurs cours et UC — simulation isolée | Une fiche technique unique avec `units: [uc2, uc3]` et `lessons: [pedofaune, pedoflore]` apparaît une fois dans chaque sélection UC et dans chacun des deux cours. La bibliothèque propose les deux liens inverses. Aucun doublon de fichier ou de fiche nécessaire. |
| Références supprimées — simulation isolée | UC, chapitre et cours inconnus retirés des relations utilisables avec avertissements ; la fiche reste visible et les relations encore valides fonctionnent. Aucun lien de cours inconnu ne mène silencieusement au premier cours. |
| Ressource sans UC — simulation isolée | La fiche reste consultable dans la bibliothèque, avec la mention « Ressource transversale · sans UC associée ». |
| URL invalide — simulation isolée | Une URL `javascript:` conserve la fiche avec message explicite et sans lien d’action. Le lecteur neutralise aussi les destinations et références invalides sans réécrire le JSON. |
| Consultation PDF | Ouverture de la fiche existante dans un nouvel onglet à son URL relative. Réponse HTTP 200, type `application/pdf`, signature `%PDF-`. |
| Téléchargement PDF | Téléchargement déclenché depuis la fiche : nom `fiche-demo-matiere-organique.pdf`, aucune erreur de téléchargement. Les trois PDF réels affichent les actions attendues après vérification. |
| PDF introuvable — simulation isolée | HTTP 404 : fiche conservée, message « introuvable », actions de consultation/téléchargement retirées, nouvelle vérification proposée. Après rétablissement, le bouton restaure les liens. |
| Panne réseau — simulation isolée | Vérification impossible signalée ; consultation manuelle, téléchargement et nouvelle vérification restent possibles. La panne n’est pas présentée comme une suppression du fichier. |
| Repli HEAD/GET — simulation isolée | Serveur HEAD 405 : requête GET avec `Range: bytes=0-1023`, contrôle du début `%PDF-`, puis liens disponibles. Le flux est annulé après examen du préfixe, sans indexer le document. |
| Page HTML à la place du PDF — simulation isolée | HTTP 200 mais MIME `text/html` : message distinct, aucune action menant à un faux PDF. |
| Sous-dossier et espace — simulation isolée | `documents/sols/fiche essai.pdf` devient `documents/sols/fiche%20essai.pdf`, sous `/mon-bprea/`, dans la bibliothèque comme dans les cours. Aucun chemin `/documents/` absolu ni préfixe `assets/documents/`. |
| Chargement léger | Trois requêtes HEAD pour les trois PDF catalogués ; recherche et changement de sélection réutilisent les contrôles déjà effectués. Aucun parcours des huit PDF non catalogués ni chargement externe pour indexation. |
| Catalogue vide — simulation isolée | 0 ressource sur 0, état « Aucune ressource disponible pour le moment ». Les cours conservent leur contenu et un état sans association. |
| Catalogue inaccessible — simulation isolée | Erreur explicite et bouton de rechargement ; après rétablissement du catalogue, retour aux 8 fiches. |
| Ancien lien filtré | Une URL contenant une UC ou un cours supprimé affiche un avertissement et conserve les critères encore valides, notamment le type PDF. Aucun cours arbitraire n’est choisi pour ce filtre. |
| Clavier et sécurité des nouveaux onglets | Entrée ouvre les filtres avancés et les informations d’une fiche ; réinitialisation au clavier fonctionnelle. Les nouveaux liens en onglet séparé ont `noopener noreferrer` et un intitulé accessible précisant ce comportement. |
| Affichage visuel | Bibliothèque inspectée en clair et sombre ; extraits de cours inspectés en sombre sur ordinateur et mobile. Aucun débordement horizontal global à 320, 390, 430, 760, 1080, 1121 et 1440 px. La navigation mobile commune reste défilante. |
| Progression préservée | Après une réponse Drill réelle dans le contexte isolé, la chaîne de stockage est inchangée par la bibliothèque, ses filtres et le chargement d’un cours avec ressources. Aucun mécanisme d’écriture ou migration n’est ajouté. |
| Drill et dashboard | Première réponse correcte UC 03 : Drill à 1/10, 100 % ; dashboard à 1 réalisé, 1 correcte, 0 erreur, 100 %, 1 semaine active. Aucun fichier de ces fonctionnalités modifié. |
| QCM, calendrier et ITK | QCM classique corrigé à 3/3 ; calendrier octobre→novembre ; génération ITK à 7 opérations avec commandes CSV/impression présentes. Accueil : 7 UC et bandeau sans examen inchangés. |

La syntaxe de `assets/resources.js`, `assets/resource-library.js` et `assets/app.js` est valide avec `node --check`. `assets/resources.json` a été chargé et normalisé : 8 ressources, 1 chapitre, aucun avertissement sur les données livrées. `git diff --check` passe. Aucun événement `pageerror` pendant les parcours ordinaires ; les échecs réseau provoqués pour les simulations étaient attendus.

## Fichiers livrés et limites

- **Catalogue** : nouveau `assets/resources.json`, évolution de `assets/resources.js` en lecteur/validateur/recherche. Les données ne sont plus recopiées dans le rendu.
- **Interface** : `assets/resource-library.js` et `assets/resource-library.css` ; adaptation de `assets/app.js`, `ressources.html`, `cours.html` et `uc.html`.
- **Administration** : README actualisé, `RESSOURCES.md`, `documents/README.md` et cinq sous-dossiers préparés par `.gitkeep`, sans déplacer de PDF ni modifier leurs droits.
- **Validation** : ce compte rendu. Aucun nouveau PDF tiers ni fichier fictif livré.

Les destinations externes ne sont pas vérifiées automatiquement et peuvent évoluer. Le contrôle des PDF locaux vérifie leur présence et leur format apparent, pas l’intégrité complète du document ni ses droits. Les dates, auteurs et licences inconnus restent inconnus. Le rapprochement pédagogique dépend des identifiants explicitement renseignés ; il n’existe ni déduction sémantique, ni upload, ni recherche dans le contenu intégral des PDF.

Vérification dans Chromium et dimensions mobiles simulées, sans appareil physique ni audit complet de lecteur d’écran. Les commandes d’export/impression ITK ont été vérifiées présentes ; leur dialogue système n’a pas été ouvert. Les PDF hors catalogue restent des fichiers publics du dépôt et sont copiés par le workflow existant ; leur absence de fiche ne les rend pas privés.

Livraison par PR de `feature/ressources-pedagogiques` vers `main`. Aucune fusion ni mise en production sans validation de l’utilisateur.
