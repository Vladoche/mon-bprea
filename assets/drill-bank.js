import { units } from './content.js';

const unitIds = new Set(units.map(unit => unit.id));
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = value => typeof value === 'string' && value.trim().length > 0;
const isId = value => typeof value === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(value);

function validReference(reference) {
  if (!isRecord(reference) || !isText(reference.title) || !isText(reference.url)) return false;
  // Local course links and explicit web references are supported. Never accept executable URLs.
  if (/^cours\.html\?id=[a-z0-9-]+(?:#[a-z0-9-]+)?$/.test(reference.url)) return true;
  try {
    const url = new URL(reference.url);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

// Add a validator and a corresponding renderer before introducing another question type.
export const QUESTION_TYPES = Object.freeze({
  'single-choice': Object.freeze({
    validate(question) {
      if (!Array.isArray(question.options) || question.options.length < 2) return false;
      const optionIds = new Set();
      for (const option of question.options) {
        if (!isRecord(option) || !isId(option.id) || !isText(option.text) || optionIds.has(option.id)) return false;
        optionIds.add(option.id);
      }
      return typeof question.answer === 'string' && optionIds.has(question.answer);
    },
  }),
});

/** Validate both bank entries and saved historical snapshots without changing their contents. */
export function validateDrillQuestion(question) {
  if (!isRecord(question) || !isId(question.id) || !Number.isSafeInteger(question.version) || question.version < 1) return false;
  if (!unitIds.has(question.unit) || !isText(question.chapter) || !isText(question.concept)) return false;
  if (!isText(question.prompt) || !isText(question.explanation) || !isText(question.difficulty)) return false;
  if (question.reference !== undefined && !validReference(question.reference)) return false;
  if (question.sourceLesson !== undefined && !isId(question.sourceLesson)) return false;
  if (question.sourceQuestionIndex !== undefined && (!Number.isInteger(question.sourceQuestionIndex) || question.sourceQuestionIndex < 0)) return false;
  return typeof question.type === 'string' && Object.hasOwn(QUESTION_TYPES, question.type) && QUESTION_TYPES[question.type].validate(question);
}

/** Load editable JSON; an unavailable or malformed bank never changes local learning history. */
export async function loadDrillBank() {
  let data;
  try {
    const response = await fetch(new URL('./drill-bank.json', import.meta.url), { cache: 'no-cache' });
    if (!response.ok) throw new Error('http');
    data = await response.json();
  } catch {
    return { questions: [], error: 'La banque d’exercices est indisponible. Réessaie après avoir vérifié ta connexion.', warnings: [] };
  }
  if (!isRecord(data) || data.version !== 1 || !Array.isArray(data.questions)) {
    return { questions: [], error: 'Le format de la banque d’exercices n’est pas reconnu. Les données doivent être corrigées.', warnings: [] };
  }
  const questions = [];
  const warnings = [];
  const ids = new Set();
  data.questions.forEach((question, index) => {
    if (!validateDrillQuestion(question)) {
      warnings.push(`L’exercice n° ${index + 1} est incomplet ou utilise un format non pris en charge ; il a été ignoré.`);
      return;
    }
    if (ids.has(question.id)) {
      warnings.push(`L’identifiant « ${question.id} » est présent plusieurs fois ; son doublon a été ignoré.`);
      return;
    }
    ids.add(question.id);
    questions.push(question);
  });
  return { questions, error: null, warnings };
}
