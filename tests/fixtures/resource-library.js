export const libraryPdf = {
  id: 'fiche-laboratoire',
  title: 'Fiche de laboratoire — Sol vivant',
  description: 'Une notice de test sur les organismes du sol.',
  type: 'pdf',
  file: 'documents/fiche-demo-matiere-organique.pdf',
  organization: 'Atelier fictif',
  units: ['uc3'],
  chapters: ['uc3-sol-vivant'],
  lessons: ['matiere-organique'],
  themes: ['Sol et fertilité'],
  keywords: ['Pédofaune', 'Humus'],
  publishedAt: '2024-09-20',
  addedAt: '2026-11-15',
  source: { title: 'Atelier fictif', url: 'https://example.test/source' },
  license: 'Donnée synthétique de recette.',
};

export const librarySheet = {
  id: 'fiche-technique',
  title: 'Fiche technique de recette — Compost',
  description: 'Notice de démonstration pour le compostage et le paillage.',
  type: 'technical-sheet',
  url: 'https://example.test/fiche',
  organization: 'Équipe de recette',
  themes: ['Sol et fertilité'],
  keywords: ['Compost'],
};

export function libraryCatalog(resources) {
  return {
    version: 1,
    chapters: [{ id: 'uc3-sol-vivant', unit: 'uc3', title: 'Le sol vivant', lessons: ['matiere-organique', 'rapport-cn'] }],
    resources,
  };
}
