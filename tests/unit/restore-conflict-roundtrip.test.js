import { it, expect } from 'vitest';
import { parseRestore } from '../../assets/restore-model.js';
import { planRestore } from '../../assets/restore-plan.js';
import { emptyPersonalDocument, mutateCourse, reconcileHistory, resolveConflict } from '../../assets/course-quiz-model.js';
import { emptySettingsDocument, queueSettings, prepareSettingsOperation, acknowledgeSettings, resolveSettingsConflict, reconcileSettings } from '../../assets/settings-model.js';
import { archive, scope, A, stamp, uuid, restoreRows, emptyCurrent } from '../fixtures/restore.js';

const parse = file => parseRestore(JSON.stringify(file));

function courseConflict(resolved) {
  const rows = restoreRows(), document = emptyPersonalDocument(scope);
  mutateCourse(document, rows.course_states[0].lesson_id, true, () => uuid(920));
  reconcileHistory(document, { courses: rows.course_states, attempts: [] }, A, stamp);
  if (resolved) resolveConflict(document, document.conflicts[0].id, 'remote');
  return archive(rows, { courses: document });
}

function archivedSettingsConflict() {
  const rows = restoreRows(), document = emptySettingsDocument(scope);
  queueSettings(document, 'itk', rows.itk_settings[0].parameters, () => uuid(921));
  const operation = prepareSettingsOperation(document);
  const row = { ...rows.itk_settings[0], parameters: { ...rows.itk_settings[0].parameters, area: '200' } };
  acknowledgeSettings(document, operation.id, { status: 'conflict', row }, A);
  resolveSettingsConflict(document, operation.id, 'remote');
  reconcileSettings(document, { itk: row, appearance: null }, A, stamp);
  rows.itk_settings = [row];
  return archive(rows, { settings: document });
}

for (const resolved of [false, true]) it(`relit un vrai export de conflit cours ${resolved ? 'résolu' : 'en attente'} sans rejouer son cliché`, () => {
  const file = courseConflict(resolved), source = file.data.personalLocal.courses;
  expect(source.conflicts[0].operation.state).toBe('pending');
  expect(source.operations[0].state).toBe('conflict');
  expect(parse(file)).toEqual(file);
  const plan = planRestore(parse(file), emptyCurrent(), { scope, userId: A, at: stamp });
  expect(plan.domains.courses.actions.some(action => action.type === 'queue' && action.id === uuid(920))).toBe(false);
});

it('relit le conflit ITK résolu après rangement naturel de son opération dans les archives', () => {
  const file = archivedSettingsConflict(), source = file.data.personalLocal.settings;
  expect(source.operations).toHaveLength(0);
  expect(source.conflicts[0]).toMatchObject({ resolved: true, operation: { state: 'pending' } });
  expect(source.archives[0]).toMatchObject({ kind: 'resolved-operation', operation: { state: 'conflict' } });
  expect(parse(file)).toEqual(file);
  const plan = planRestore(parse(file), emptyCurrent(), { scope, userId: A, at: stamp });
  expect(plan.domains.settings.actions.some(action => action.type === 'queue' && action.id === uuid(921))).toBe(false);
});

for (const field of ['payload', 'rpcPayload']) it(`refuse un cliché de conflit dont le ${field} diffère de l'opération conservée`, () => {
  const file = archivedSettingsConflict();
  file.data.personalLocal.settings.conflicts[0].operation[field].p_parameters.area = '300';
  expect(() => parse(file)).toThrow('archive');
});

it('refuse un conflit sans opération correspondante et une référence archivée encore non résolue', () => {
  const unknown = courseConflict(true);
  unknown.data.personalLocal.courses.conflicts[0].operation.id = uuid(922);
  expect(() => parse(unknown)).toThrow('archive');
  const unresolved = archivedSettingsConflict();
  unresolved.data.personalLocal.settings.conflicts[0].resolved = false;
  expect(() => parse(unresolved)).toThrow('archive');
  const invalid = archivedSettingsConflict(), source = invalid.data.personalLocal.settings;
  source.conflicts[0].operation.id = source.archives[0].operation.id = 'not-an-uuid';
  expect(() => parse(invalid)).toThrow('archive');
});

it('refuse un autre type d’archive et un état inconnu dans les deux références', () => {
  const wrongKind = archivedSettingsConflict();
  wrongKind.data.personalLocal.settings.archives[0].kind = 'confirmed';
  expect(() => parse(wrongKind)).toThrow('archive');
  for (const target of ['snapshot', 'archived']) {
    const file = archivedSettingsConflict(), source = file.data.personalLocal.settings;
    (target === 'snapshot' ? source.conflicts[0].operation : source.archives[0].operation).state = 'future';
    expect(() => parse(file)).toThrow('archive');
  }
});
