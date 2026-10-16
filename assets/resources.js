/**
 * Catalogue documentaire : édite ce fichier pour ajouter tes liens et PDF.
 * - Liens : { id, title, description, category, url, tags: [...] }
 * - Fichiers : { id, title, description, category, file, tags: [...] }
 * Les PDF sont placés dans documents/ et leur chemin reste relatif au site.
 */
export const resourceLinks = [
  {
    id: 'chlorofil',
    title: 'Chlorofil — Référentiel BPREA',
    description: 'Référentiel national, organisation du diplôme et documents institutionnels.',
    category: 'Formation',
    url: 'https://chlorofil.fr/diplomes/secondaire/bp/rea',
    tags: ['BPREA', 'Diplôme', 'UC']
  },
  {
    id: 'grab',
    title: 'GRAB — Techniques de maraîchage biologique',
    description: 'Synthèses et essais sur les systèmes, les variétés et les pratiques en maraîchage bio.',
    category: 'Maraîchage',
    url: 'https://www.grab.fr/techniques-bio/maraichage/',
    tags: ['Bio', 'Essais', 'ITK']
  },
  {
    id: 'ctifl',
    title: 'CTIFL — Fruits et légumes',
    description: 'Recherches, publications et références techniques de la filière fruits et légumes.',
    category: 'Maraîchage',
    url: 'https://www.ctifl.fr/',
    tags: ['Cultures', 'Technique', 'Références']
  },
  {
    id: 'dephy-correze',
    title: 'DEPHY — Maraîchers en circuits courts de Corrèze',
    description: 'Réseau local : démarches de réduction des produits phytosanitaires et retours de pratiques.',
    category: 'Territoire',
    url: 'https://ecophytopic.fr/dephy/reseau-maraichers-en-circuits-courts-de-correze',
    tags: ['Corrèze', 'Agroécologie', 'DEPHY']
  },
  {
    id: 'meteo-open-data',
    title: 'Météo-France — Données climatiques ouvertes',
    description: 'Portail de données climatiques pour documenter les contraintes météorologiques locales.',
    category: 'Climat',
    url: 'https://meteo.data.gouv.fr/',
    tags: ['Météo', 'Climat', 'Corrèze']
  }
];

export const resourceFiles = [
  {
    id: 'fiche-demo',
    title: 'Fiche mémo — Le cycle de la matière organique',
    description: 'Exemple de PDF téléchargeable, créé pour illustrer la bibliothèque documentaire.',
    category: 'Sol & fertilité',
    file: 'documents/fiche-demo-matiere-organique.pdf',
    tags: ['PDF', 'Matière organique', 'UC 03']
  }
];
