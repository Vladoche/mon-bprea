import { expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { emptyCatalogue, emptyParcours, validateParcours, validateParcoursCatalogue, validParcoursDate,
  summariseParcours, parcoursCompletion } from '../../assets/parcours-model.js';
import { createParcoursRepository, emptyParcoursDocument, validateParcoursDocument } from '../../assets/parcours-service.js';
import { projectLocal, projectRow } from '../../assets/export-model.js';
import { applyActions, planRestore } from '../../assets/restore-plan.js';
import { A, B, uuid, stamp } from '../fixtures/export.js';

const scope = user => JSON.stringify(['development', 'https://fixture.invalid', user]);
const catalogue = { ...emptyCatalogue, ucare: [{ id: 'atelier-a', label: 'Atelier fictif A', active: true },
  { id: 'atelier-b', label: 'Atelier fictif B', active: false }],
sessions: [{ id: 'session-3', examId: 'uc3', active: true, label: 'Session fictive', date: '2028-02-29' }] };
const assigned = { ...emptyParcours(), uc1: 'exempt', units: ['uc3'], ucare: ['retiree', 'atelier-b', 'atelier-a'],
  exams: ['uc3', 'uc1'], assignments: { uc3: { sessionId: 'session-3', personalDate: null },
    uc1: { sessionId: null, personalDate: '2028-02-28' } } };
const row = { user_id: A, preferences: emptyParcours(), operation_id: uuid(9), revision: 2, updated_at: stamp };

it('modèle fermé, dates civiles et identifiants pédagogiques', () => {
  for (const patch of [{ version: 2 }, { uc1: 'dispensed' }, { units: ['uc1'] }, { exams: ['uc6'] },
    { exams: ['uc1', 'uc1'] }, { ucare: ['UC06'] }, { assignments: { uc6: assigned.assignments.uc1 } },
    { assignments: { uc1: { sessionId: null, personalDate: '2027-02-29' } } }, { official: true }]) {
    expect(() => validateParcours({ ...emptyParcours(), ...patch })).toThrow();
  }
  expect(validParcoursDate('2028-02-29')).toBe(true);
  expect(validParcoursDate('0000-12-14')).toBe(false);
  expect(validParcoursDate('2028-04-31')).toBe(false);
  expect(validateParcours(assigned).ucare).toEqual(['atelier-a', 'atelier-b', 'retiree']);
  expect(validateParcours({ ...assigned, exams: [] }).assignments).toEqual(assigned.assignments);
});

it('aperçu issu des sélections, référentiels vides ou modifiés et compte partiellement configuré', () => {
  expect(validateParcoursCatalogue(emptyCatalogue)).toEqual(emptyCatalogue);
  expect(() => validateParcoursCatalogue({ ...catalogue, ucareMinimum: 2 })).toThrow();
  expect(() => validateParcoursCatalogue({ ...catalogue, sessions: [{ ...catalogue.sessions[0], examId: 'uc6' }] })).toThrow();
  expect(parcoursCompletion(null, catalogue)).toBe('À configurer');
  expect(summariseParcours(assigned, catalogue)).toMatchObject({
    ucare: ['Choix indisponible (retiree)', 'Atelier fictif B', 'Atelier fictif A'],
    uc1Conflict: true, toConfirm: 0,
  });
  expect(summariseParcours(assigned, emptyCatalogue).toConfirm).toBe(1);
  expect(parcoursCompletion(assigned, catalogue)).toBe('Configuration partielle');
  const coherent = { ...assigned, exams: ['uc3'] };
  expect(parcoursCompletion(coherent, catalogue)).toBe('Parcours configuré');
  expect(parcoursCompletion(coherent, emptyCatalogue)).toBe('Configuration partielle');
});

it('brouillon et export bornés au titulaire et au projet, version future refusée', async () => {
  const options = { indexedDB: new IDBFactory() };
  const a = createParcoursRepository(scope(A), options);
  const b = createParcoursRepository(scope(B), options);
  const otherProject = createParcoursRepository(scope(A).replace('fixture.invalid', 'other.invalid'), options);
  await a.change(doc => { doc.draft = { token: uuid(7), base: null, requested: false, value: assigned }; });
  expect((await a.read()).draft.value.uc1).toBe('exempt');
  expect((await b.read()).draft).toBeNull();
  expect((await otherProject.read()).draft).toBeNull();
  expect(() => validateParcoursDocument({ ...emptyParcoursDocument(scope(A)), version: 2 }, scope(A))).toThrow('future');
  expect(projectLocal('parcours', { ...await a.read(), secret: 'exclu' }, scope(A)).omitted).toBe(1);
  expect(() => projectRow('parcours_preferences', row, B)).toThrow('ownership');
  await Promise.all([a.close(), b.close(), otherProject.close()]);
});

it('restaure une copie de parcours sous forme de brouillon, refuse une divergence existante', () => {
  const at = stamp;
  const options = { scope: scope(A), userId: A, at };
  const file = { coverage: [], data: { server: { parcours_preferences: [{ ...row, preferences: validateParcours(assigned) }] }, personalLocal: {} } };
  const current = { local: { parcours: { status: 'available', document: null, privacy: null } }, server: { parcours_preferences: [] } };
  const plan = planRestore(file, current, options);
  const record = emptyParcoursDocument(scope(A));
  applyActions(record, plan.domains.parcours.actions, current.server, A, at);
  expect(record.draft).toMatchObject({ requested: false, base: 0, value: { uc1: 'exempt' } });
  current.server.parcours_preferences.push(row);
  expect(planRestore(file, current, options).summary.groups.parcours.conflict).toBe(1);
});
