# Photothèque du jeu botanique — sources et contrôle

Révision effectuée le **21 octobre 2026**. La banque contient **12 taxons et 12 photographies**, répartis entre trois catégories jouables de quatre espèces. La catégorie Légumineuses reste vide et indisponible. Le fraisier cultivé est un taxon hybride et la carotte est renseignée au rang de sous-espèce. « Espèce » désigne un choix du jeu.

Chaque page de fichier Wikimedia Commons a été consultée individuellement : nom du taxon dans la description du photographe, auteur et licence propre à la photographie. Le pied de page général de Commons ne prouve jamais la licence d’une image. Les métadonnées `imageinfo/extmetadata` de Commons ont ensuite permis de récupérer les fichiers et les crédits ; tous les fichiers finaux ont été inspectés visuellement. Les sources taxonomiques et descriptives figurent aussi dans `species[].sources` de [la banque JSON](../../assets/botanical-bank.json). Les caractères propres à chaque photographie viennent de son observation, comparée à ces sources institutionnelles.

## Fichiers et licences

Les JPG sont servis localement, sans requête photographique externe pendant une partie. Ils ont été redimensionnés proportionnellement à un côté maximal de 960 pixels, puis recompressés en JPEG. Aucun recadrage, génération, ajout ou transformation botanique. Volume total : **2 092 902 octets**, soit environ 2.09 Mo.

| Taxon du jeu | Fichier source et auteur | Licence retenue | JPG livré |
| --- | --- | --- | --- |
| Fraisier cultivé — *Fragaria × ananassa* | [Fragaria × ananassa.JPG](https://commons.wikimedia.org/wiki/File:Fragaria_%C3%97_ananassa.JPG) — Alpsdake | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) | 960 × 800, 175 ko |
| Framboisier — *Rubus idaeus* | [20130714Rubus idaeus2.jpg](https://commons.wikimedia.org/wiki/File:20130714Rubus_idaeus2.jpg) — AnRo0002 | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 960 × 720, 143 ko |
| Groseillier à grappes — *Ribes rubrum* | [Ribes rubrum fruit Luc Viatour.JPG](https://commons.wikimedia.org/wiki/File:Ribes_rubrum_fruit_Luc_Viatour.JPG) — Luc Viatour | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | 960 × 720, 145 ko |
| Myrtillier en corymbe — *Vaccinium corymbosum* | [Vaccinium corymbosum a2.jpg](https://commons.wikimedia.org/wiki/File:Vaccinium_corymbosum_a2.jpg) — Opioła Jerzy (Poland) | [CC BY 2.5](https://creativecommons.org/licenses/by/2.5) | 960 × 718, 137 ko |
| Tournesol — *Helianthus annuus* | [Sunflowers public domain helianthus annuus IMG 0815.jpg](https://commons.wikimedia.org/wiki/File:Sunflowers_public_domain_helianthus_annuus_IMG_0815.jpg) — S.G.S. | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 960 × 960, 191 ko |
| Souci officinal — *Calendula officinalis* | [20141003Calendula officinalis5.jpg](https://commons.wikimedia.org/wiki/File:20141003Calendula_officinalis5.jpg) — AnRo0002 | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 960 × 720, 117 ko |
| Grande capucine — *Tropaeolum majus* | [20160813Tropaeolum majus1.jpg](https://commons.wikimedia.org/wiki/File:20160813Tropaeolum_majus1.jpg) — AnRo0002 | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 960 × 720, 110 ko |
| Coquelicot — *Papaver rhoeas* | [20180518Papaver rhoeas1.jpg](https://commons.wikimedia.org/wiki/File:20180518Papaver_rhoeas1.jpg) — AnRo0002 | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 960 × 720, 135 ko |
| Tomate — *Solanum lycopersicum* | [20240906Solanum lycopersicum.jpg](https://commons.wikimedia.org/wiki/File:20240906Solanum_lycopersicum.jpg) — AnRo0002 | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 960 × 720, 114 ko |
| Carotte cultivée — *Daucus carota subsp. sativus* | [Daucus carota subsp. sativus,Karotten.JPG](https://commons.wikimedia.org/wiki/File:Daucus_carota_subsp._sativus,Karotten.JPG) — Böhringer Friedrich | [CC BY-SA 2.5](https://creativecommons.org/licenses/by-sa/2.5) | 720 × 960, 234 ko |
| Oignon — *Allium cepa* | [Allium cepa 004.JPG](https://commons.wikimedia.org/wiki/File:Allium_cepa_004.JPG) — H. Zell | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) | 720 × 960, 330 ko |
| Laitue cultivée — *Lactuca sativa* | [Lactuca sativa 01.JPG](https://commons.wikimedia.org/wiki/File:Lactuca_sativa_01.JPG) — Sanja565658 | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) | 960 × 638, 262 ko |

Les **6 CC0** sont créditées volontairement. Les **4 CC BY-SA 3.0**, **1 CC BY-SA 2.5** et **1 CC BY 2.5** exigent de conserver l’attribution, le lien de licence et la mention des modifications. Les fichiers BY-SA et leurs éventuelles adaptations restent sous la licence indiquée. Pour le groseillier, conserver le crédit demandé **Luc Viatour / https://Lucnix.be** au voisinage immédiat de l’image. Le champ `attribution` contient ce crédit ; le jeu doit afficher ce champ ainsi que les liens source/licence près de la photo. L’auteur du tournesol est bien **S.G.S.**, tel qu’indiqué dans la page source ; `Macdon` est son compte d’import, pas un crédit substitué. Le choix de licence pour la myrtille est **CC BY 2.5**, proposée en plus d’autres licences sur sa page.

## Limites pédagogiques

- Quatre questions distinctes par catégorie jouable ; aucune série de dix espèces n’est artificiellement annoncée. Une photo par taxon pour ce lot : la structure accepte plusieurs photos, mais la révision ne peut pas encore proposer un autre angle.
- Les trois catégories possèdent des choix compatibles, visuellement différenciés. Toutes les fiches sont au niveau facile. Il ne s’agit pas d’une clé exhaustive permettant de séparer toutes les espèces apparentées.
- Pour le fraisier, seuls le réceptacle, les akènes et le calice sont utilisés ; le détail d’une feuille entière n’est pas visible. Pour la myrtille, le taxon exact est celui de la description photographique, sans prétendre le distinguer de tous les autres Vaccinium à partir du fruit seul.
- La capucine est photographiée de face : l’éperon n’est pas visible. La photo de tomate montre les fleurs, et aucun fruit. La carotte montre le feuillage et le haut des racines, pas la racine entière. L’oignon ne montre pas de coupe permettant de vérifier le caractère creux des feuilles. La laitue représente une forme frisée et ne généralise pas ce caractère à toutes les variétés.
- Aucune relation de confusion à l’intérieur de ce petit catalogue n’a été inventée : `confusions` est vide. Enrichir d’abord les couples de taxons, les critères discriminants sourcés et les photos adéquates avant d’ouvrir un mode dédié aux confusions.
- Avant d’ouvrir Légumineuses, réunir au moins quatre espèces identifiables, quatre choix distincts par question, des sources documentaires et des photos dont les droits ont été contrôlés. Pour les futurs niveaux intermédiaire/difficile, privilégier des gros plans des caractères discriminants, pas seulement des images plus difficiles à lire.

## Ajouter ou remplacer une photographie

1. Ouvrir sa page source, vérifier le taxon dans la description et la licence du fichier ; relever l’auteur exact, l’URL et l’attribution demandée. Une licence des métadonnées du site ne suffit pas.
2. Télécharger et examiner la photo : retenir un organe identifiable parmi les choix prévus, sans texte donnant la réponse. Ne pas attribuer à la photo un caractère absent.
3. Préparer un JPEG/WebP léger et ajouter un identifiant stable dans `photos`, avec `speciesId`, chemin relatif, stade, organe, crédit, licence et lien de licence, source, date de contrôle, dimensions et explication limitée aux éléments visibles. Ne jamais dupliquer le fichier pour une autre catégorie.
4. Conserver la licence d’une image BY-SA ; indiquer les modifications. Actualiser ce tableau et vérifier visuellement l’image à la taille de jeu sur ordinateur et mobile.
5. Les descriptions de NC State Extension et de Kew sont reformulées, sans copie de leurs photographies ni de longs extraits de texte. Les noms et familles suivent les sources citées ; l’ancienne mention Alliaceae de la page photographique d’oignon n’a pas été reprise : la source botanique actuelle classe Allium cepa dans Amaryllidaceae.
