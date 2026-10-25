// Sauvegardes synthétiques conformes aux formats locaux, sans données étudiantes.
// Les UUID d'opération seront alloués par les tests, jamais inventés par le site.
export const PERSONAL_DATA_TIME = '2026-10-21T12:00:00.000Z';

export const learningDocument = {
  'matiere-organique': {
    done: false, score: 3,
    legacyQuizScore: { score: 2, total: 3 },
    // Deux vraies tentatives peuvent avoir exactement les mêmes valeurs.
    quizAttempts: [
      { score: 3, total: 3, completedAt: PERSONAL_DATA_TIME },
      { score: 3, total: 3, completedAt: PERSONAL_DATA_TIME },
    ],
    quizAttemptsArchive: [{ score: 'illisible', source: 'ancienne-sauvegarde' }],
    futureField: { preserve: true },
  },
  'rapport-cn': { score: 1, done: true },
  progressArchive: ['{ancienne-sauvegarde-illisible'],
};

export function botanicalSession(id = 'botanical-backend-test', patch = {}) {
  return {
    id, categoryId: 'petits-fruits', mode: 'chrono', durationSeconds: 30,
    revision: false, startedAt: PERSONAL_DATA_TIME, totalQuestions: 4,
    completedAt: null, ...patch,
  };
}

export function botanicalAnswer(session = botanicalSession(), number = 1, patch = {}) {
  const questionId = `${session.id}-q${number}`;
  return {
    id: questionId, sessionId: session.id, questionId,
    categoryId: session.categoryId, speciesId: 'fraisier', photoId: 'fraisier-test-photo',
    mode: session.mode, revision: session.revision, status: 'correct',
    selectedSpeciesId: 'fraisier', correct: true, elapsedMs: 2500,
    answeredAt: PERSONAL_DATA_TIME, ...patch,
  };
}

export const itkParameters = {
  crop: 'tomate', variety: 'Marmande', cover: 'serre', area: '120',
  month: '4', year: '2028', soil: 'limoneux', water: 'standard',
};

export const appearancePreferences = { version: 1, season: 'auto', brightness: 'auto' };
