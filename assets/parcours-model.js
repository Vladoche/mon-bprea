import { units } from './content.js';

export const exams = units.map(({ id, code }) => ({ id, label: code.replace(' ', '') }));
const examIds = exams.map(({ id }) => id);
export const otherUnits = exams.slice(1, 5);
export const uc1Labels = {
  unknown: 'Non renseigné', attending: 'Je passe l’UC1', exempt: 'Je suis dispensé de l’UC1',
};
const idPattern = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const shape = (value, keys) => object(value) && Object.keys(value).length === keys.length &&
  keys.every(key => Object.hasOwn(value, key));
const id = value => typeof value === 'string' && idPattern.test(value);
const list = (value, valid, limit) => Array.isArray(value) && value.length <= limit &&
  new Set(value).size === value.length && value.every(valid);
export const emptyParcours = () => ({ version: 1, uc1: 'unknown', units: [], ucare: [], exams: [], assignments: {} });

export function validParcoursDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const timestamp = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

export function validateParcours(value) {
  if (!shape(value, ['version', 'uc1', 'units', 'ucare', 'exams', 'assignments']) || value.version !== 1 ||
      !Object.hasOwn(uc1Labels, value.uc1) || typeof value.uc1 !== 'string' ||
      !list(value.units, item => otherUnits.some(unit => unit.id === item), otherUnits.length) ||
      !list(value.ucare, id, 100) || !list(value.exams, item => examIds.includes(item), exams.length) ||
      !object(value.assignments) || !Object.entries(value.assignments).every(([key, assignment]) =>
        examIds.includes(key) && shape(assignment, ['sessionId', 'personalDate']) &&
        (assignment.sessionId === null || id(assignment.sessionId)) &&
        (assignment.personalDate === null || validParcoursDate(assignment.personalDate)))) {
    throw Object.assign(new Error('Vérifie les choix et les dates de ton parcours.'), { code: 'parcours_invalid' });
  }
  return {
    version: 1, uc1: value.uc1,
    units: otherUnits.map(unit => unit.id).filter(key => value.units.includes(key)),
    ucare: [...value.ucare].sort(),
    exams: examIds.filter(key => value.exams.includes(key)),
    assignments: Object.fromEntries(examIds.filter(key => {
      const assignment = value.assignments[key];
      return assignment && (assignment.sessionId || assignment.personalDate);
    }).map(key => [key, { sessionId: value.assignments[key].sessionId, personalDate: value.assignments[key].personalDate }])),
  };
}

const catalogueUrl = new URL('./parcours-catalogue.json', import.meta.url);
export const emptyCatalogue = { version: 1, ucareMinimum: null, ucare: [], sessions: [] };
const label = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 160;

export function validateParcoursCatalogue(value) {
  const invalid = () => { throw new Error('Référentiel du parcours indisponible.'); };
  const rows = (entries, valid) => Array.isArray(entries) && entries.every(entry => object(entry) &&
    id(entry.id) && label(entry.label) && typeof entry.active === 'boolean' && valid(entry)) &&
    new Set(entries.map(entry => entry.id)).size === entries.length;
  if (value?.version !== 1 ||
      !rows(value.ucare, entry => (entry.description === undefined ||
        typeof entry.description === 'string' && entry.description.length <= 500) &&
        (entry.group === undefined || label(entry.group))) ||
      !rows(value.sessions, entry => examIds.includes(entry.examId) && validParcoursDate(entry.date)) ||
      (value.ucareMinimum !== null && (!Number.isInteger(value.ucareMinimum) || value.ucareMinimum < 0 ||
        value.ucareMinimum > Math.min(100, value.ucare.filter(entry => entry.active).length)))) invalid();
  return value;
}

export async function loadParcoursCatalogue(signal) {
  const response = await fetch(catalogueUrl, { signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) });
  if (!response.ok) throw new Error('Référentiel du parcours indisponible.');
  return validateParcoursCatalogue(await response.json());
}

export function summariseParcours(value, catalogue) {
  const ucare = value.ucare.map(key => catalogue.ucare.find(entry => entry.id === key)?.label || `Choix indisponible (${key})`);
  const selectedExams = exams.filter(exam => value.exams.includes(exam.id));
  const dates = selectedExams.map(exam => {
    const assignment = value.assignments[exam.id];
    const official = catalogue.sessions.find(item => item.active && item.examId === exam.id && item.id === assignment?.sessionId);
    const personal = assignment?.personalDate;
    return { ...exam, official, personal, unavailable: Boolean(assignment?.sessionId && !official) };
  });
  const uc1Conflict = value.uc1 === 'exempt' && value.exams.includes('uc1');
  const toConfirm = dates.filter(item => !item.official && !item.personal).length;
  return { ucare, selectedExams, dates, uc1Conflict, toConfirm };
}

export function parcoursCompletion(value, catalogue) {
  if (!value || JSON.stringify(value) === JSON.stringify(emptyParcours())) return 'À configurer';
  const result = summariseParcours(value, catalogue);
  if (value.uc1 === 'unknown' || result.uc1Conflict || !result.selectedExams.length || result.toConfirm ||
      value.ucare.filter(key => catalogue.ucare.some(entry => entry.active && entry.id === key)).length < (catalogue.ucareMinimum ?? 0)) {
    return 'Configuration partielle';
  }
  return 'Parcours configuré';
}
