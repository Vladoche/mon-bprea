import { describe, expect, it } from 'vitest';
import { filterResources, normalizeResourceCatalog, RESOURCE_TYPES } from '../../assets/resources.js';
import { libraryCatalog, libraryPdf, librarySheet } from '../fixtures/resource-library.js';

describe('contrat du catalogue documentaire', () => {
  it.each([null, [], { ...libraryCatalog([]), version: 2 }, { version: 1 }])('signale un format non accepté (%j)', raw => {
    const result = normalizeResourceCatalog(raw);
    expect(result.error).toBeTruthy();
    expect(result.resources).toEqual([]);
  });

  it('accepte un catalogue vide et les cinq catégories', () => {
    expect(normalizeResourceCatalog(libraryCatalog([]))).toMatchObject({ error: null, resources: [], warnings: [] });
    expect(Object.keys(RESOURCE_TYPES)).toEqual(['website', 'pdf', 'technical-sheet', 'video', 'tool']);
    const raw = Object.keys(RESOURCE_TYPES).map(type => ({ ...librarySheet, id: type, type }));
    const result = normalizeResourceCatalog(libraryCatalog(raw));
    expect(result.resources.map(item => item.type)).toEqual(Object.keys(RESOURCE_TYPES));
    expect(result.warnings).toEqual([]);
  });

  it('ignore les doublons et les relations inconnues et conserve les fiches incomplètes', () => {
    const raw = [
      { title: 'Sans identifiant' },
      { ...libraryPdf, units: ['uc3', 'ailleurs'], lessons: ['matiere-organique', 'inconnu'], chapters: ['absent'], addedAt: '2026-02-30' },
      { ...libraryPdf, title: 'Doublon ignoré' },
      { id: 'incomplete', title: 'Sans destination', type: 'inconnu' },
    ];
    const result = normalizeResourceCatalog(libraryCatalog(raw));
    expect(result.resources).toMatchObject([
      { id: libraryPdf.id, title: libraryPdf.title, units: ['uc3'], lessons: ['matiere-organique'], chapters: [], addedAt: null },
      { id: 'incomplete', type: 'website', href: null, source: null, license: null },
    ]);
    for (const fragment of ['identifiant', 'doublon', 'ailleurs', 'inconnu', 'absent', 'date invalide', 'Aucune adresse', 'type']) {
      expect(result.warnings.join(' ')).toContain(fragment);
    }
  });

  it.each([
    { file: 'documents/%252e%252e/notes.pdf' },
    { file: 'documents/%2e%2e/notes.pdf' },
    { file: 'documents/notes.html' },
    { file: '/documents/notes.pdf' },
    { url: 'https://demo:secret@example.test/fiche' },
    { url: 'file:///documents/notes.pdf' },
    { url: 'https://example.test/fiche', file: 'documents/notes.pdf' },
  ])('garde la référence sans lien pour une destination invalide (%j)', destination => {
    const result = normalizeResourceCatalog(libraryCatalog([{ id: 'test', title: 'Référence', type: 'pdf', ...destination }]));
    expect(result.resources).toMatchObject([{ href: null }]);
    expect(result.resources[0].issue).toBeTruthy();
    expect(result.warnings).not.toHaveLength(0);
  });

  it('préserve le sous-dossier relatif, les dates et les informations de provenance connues', () => {
    const result = normalizeResourceCatalog(libraryCatalog([{ ...libraryPdf, file: 'documents/sols/Mémo sol.pdf' }, librarySheet]));
    expect(result.warnings).toEqual([]);
    expect(result.resources).toMatchObject([
      { href: 'documents/sols/M%C3%A9mo%20sol.pdf', isLocal: true, source: libraryPdf.source, license: libraryPdf.license, addedAt: libraryPdf.addedAt },
      { href: librarySheet.url, isLocal: false, source: null, license: null },
    ]);
  });
});

describe('recherche, filtres et tri', () => {
  const resources = normalizeResourceCatalog(libraryCatalog([
    { ...libraryPdf, description: 'Au cœur du sol, l’étude des organismes.' },
    { ...librarySheet, title: 'Écologie du compost', publishedAt: '2026-11-18' },
    { ...librarySheet, title: 'Zèbre et rotations', id: 'rotations', themes: ['Cultures'], addedAt: '2025-12-31' },
    { ...librarySheet, title: 'À propos des couverts', id: 'couverts' },
  ])).resources;
  const ids = filters => filterResources(resources, filters).map(item => item.id);

  it.each(['laboratoire', 'coeur', 'ATELIER', 'pedofaune', 'FERTILITE humus'])('cherche « %s » dans les seules métadonnées indexées', query => {
    expect(ids({ query })).toContain(libraryPdf.id);
  });

  it.each(['humus compost', 'réutilisation', 'référence absente', '2026-11-15'])('ne renvoie aucun résultat pour « %s »', query => {
    expect(ids({ query })).toEqual([]);
  });

  it.each([
    { unit: 'uc3' }, { type: 'pdf' }, { lesson: 'matiere-organique' },
    { chapter: 'uc3-sol-vivant' }, { organization: 'atelier fictif' },
  ])('applique le filtre %j', filters => {
    expect(ids(filters)).toEqual([libraryPdf.id]);
  });

  it('combine en ET sans déduire d’association avec les autres cours du chapitre', () => {
    const filters = { unit: 'uc3', theme: 'Sol et fertilite', type: 'pdf', chapter: 'uc3-sol-vivant', lesson: 'matiere-organique', organization: 'Atelier fictif', query: 'humus sol' };
    expect(ids({ theme: 'Cultures' })).toEqual(['rotations']);
    expect(ids(filters)).toEqual([libraryPdf.id]);
    expect(ids({ ...filters, lesson: 'rapport-cn' })).toEqual([]);
    expect(ids({ ...filters, type: 'technical-sheet' })).toEqual([]);
  });

  it('trie en français, par date d’ajout réelle ou en ordre inverse', () => {
    const ascending = ['couverts', librarySheet.id, libraryPdf.id, 'rotations'];
    expect(ids()).toEqual(ascending);
    expect(ids({ sort: 'title-desc' })).toEqual([...ascending].reverse());
    expect(ids({ sort: 'added-desc' })).toEqual([libraryPdf.id, 'rotations', 'couverts', librarySheet.id]);
  });
});
