# Information publique et intégration future de la notice V1.0

**5 novembre 2026 · lot 6.5.5.D.** Contenu approuvé sur le fond. Les points déterminants D12 et fournisseurs, la revue des modifications substantielles et l’autorisation de publication restent ouverts. La page [Contact et assistance](../../contact.html) sert déjà de canal public sans compte.

## Aperçu de la version préparée

`npm run preopening:notice` génère `confidentialite.html` dans un nouveau dossier privé et ignoré `.tmp/preopening-notice-preview-*`. Ouvrir le fichier dans un navigateur. Le texte a une source unique, [la V1.0](POLITIQUE-CONFIDENTIALITE-PROJET.md). Le bandeau d’aperçu et la directive d’indexation sont propres à ce rendu. Le rendu destiné à une future intégration utilise `noticeHtml(markdown, { preview: false })` et le même texte, après validation de la version exacte. Le script de prévisualisation écrit uniquement dans le dossier privé.

La page est statique et autonome. Sommaire, accès direct à l’essentiel, liens et contact fonctionnent sans JavaScript ni compte. La palette reprend les couleurs de Mon BPREA et suit le mode clair/sombre du système, sans lecture de préférence locale. L’aperçu peut être consulté hors connexion. Les liens externes ouvrent la destination au clic.

## Liens préparés pour la mise en ligne

Ces cibles sont des exemples prêts à intégrer dans le lot de publication. Les chemins relatifs partent d’une page à la racine du site et fonctionnent sous `/mon-bprea/`. Garder le libellé « Confidentialité et données personnelles » et un accès dans le HTML, y compris après le rendu du pied de page par l’application. N’ajouter aucune query, adresse personnelle de participant ni donnée de lien temporaire.

| Emplacement | Valeur de href ou référence pour le message | Contrôle attendu |
| --- | --- | --- |
| Accueil `index.html` | `confidentialite.html` | Visible avant le premier usage de la sauvegarde locale |
| Pied de page de toutes les pages et pied de page dynamique | `confidentialite.html` | Présent en navigation clavier, avec et sans JavaScript |
| Connexion `connexion.html` | `confidentialite.html#compte-et-invitation` | Avant la saisie |
| Information individuelle avant l’invitation et message de remise | URL absolue `https://vladoche.github.io/mon-bprea/confidentialite.html` | Preuve privée minimale de version et de date avant collecte de l’adresse |
| Activation et récupération sur `authentification.html` | `confidentialite.html#compte-et-invitation` | Lien disponible aussi si la preuve est invalide ou expirée, sans propagation de la query |
| `mot-de-passe-oublie.html` | `confidentialite.html#compte-et-invitation` | Lisible avant de solliciter l’assistance |
| `profil.html` | `confidentialite.html#vos-droits-et-la-cloture` et `confidentialite.html#stockage-sur-votre-appareil` | À proximité des rubriques correspondantes, même sans session |

## Conditions avant publication

1. Mettre en œuvre et recetter les choix D12. Adapter le texte aux accès réellement observés. Confirmer les données, destinataires et garanties applicables à la cible et au circuit de remise. Faire approuver explicitement les éventuels changements substantiels.
2. Sous autorisation distincte, générer la page finale, activer les liens et vérifier l’artefact exact avant fusion. Le constructeur `prepare-pages.py` prend les HTML racine, les types autorisés sous `assets/` et les PDF sous `documents/`. Dans D, source, outil et aperçus restent hors de ces racines, et les valeurs de href ci-dessus ne sont pas activées.
3. Contrôler publiquement le rendu, les liens et le contact depuis l’URL finale après publication autorisée, puis consigner version, date et preuve. Pour une collecte ultérieure, la notice doit déjà être disponible et remise avant de recevoir une adresse. L’activation et les invitations ont des autorisations distinctes.

L’aperçu, la recette locale et l’approbation du fond ont chacun une portée distincte. La fusion vers `main` déclenche automatiquement la construction et le déploiement Pages. [Workflow](../../.github/workflows/deploy.yml), [validation D](../validations/VALIDATION-LOT6-5-5D.md).
