# Documents PDF

Ce dossier conserve les PDF déjà présents et prépare un classement pour les nouveaux documents :

```text
documents/
  sols/
  fertilisation/
  cultures/
  gestion/
  autres/
```

Les fichiers `.gitkeep` servent uniquement à conserver les dossiers vides dans Git. Ne déplace pas les anciens PDF pour les reclasser : leurs adresses peuvent déjà être utilisées. Les chemins des trois PDF actuellement catalogués restent inchangés :

- `fiche-demo-matiere-organique.pdf`
- `Annuaire_fournisseurs-semences-couverts_vegetaux.pdf`
- `Guide_des_aides_2026.pdf`

Pour ajouter un document :

1. Vérifie que tu disposes du droit de le republier, y compris pour ses illustrations.
2. Place un petit PDF dans le sous-dossier approprié, avec un nom court sans espaces ni accents.
3. Ajoute sa fiche dans `assets/resources.json`, avec `file` commençant par `documents/` et ses relations explicites vers les UC ou cours.
4. Ouvre sa fiche par HTTP local et attends la vérification automatique, puis vérifie consultation et téléchargement ainsi que le fonctionnement sous le chemin de sous-dossier GitHub Pages.

Le nom et sa casse doivent correspondre exactement au fichier. Conserve les anciens noms tels quels. Une fiche retirée du catalogue ne supprime pas automatiquement son fichier, et un fichier présent n’est pas automatiquement ajouté à la bibliothèque. Aucun nouveau PDF tiers n’est livré dans ce lot.

Le contrôle démarre dès l’affichage de la fiche : requête `HEAD`, puis si nécessaire `GET` pour examiner au plus 1 024 octets et vérifier la signature PDF avant d’annuler la lecture. Un fichier absent (`404` ou `410`) ou invalide retire les actions de consultation et téléchargement. Une panne ou un délai dépassé de 10 secondes garde un état non vérifié, avec la possibilité d’essayer de consulter le fichier et de réessayer le contrôle. La fiche et le fichier d’origine restent conservés.

Le guide [RESSOURCES.md](../docs/architecture/RESSOURCES.md) décrit les champs, les relations et deux exemples d’ajout. L’exemple de fiche personnelle sur la biologie du sol n’est pas un document livré : ne l’ajoute au catalogue qu’après sa création et sa vérification.
