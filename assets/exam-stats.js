/**
 * Statistiques locales des QCM. Ce module ne lit ni ne modifie localStorage.
 * Les cours marqués « terminés » ne constituent pas une preuve de QCM réalisé.
 */
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isScore = (score, total) => Number.isSafeInteger(score) && score >= 0 &&
  Number.isSafeInteger(total) && total > 0 && score <= total;
const isTimestamp = value => {
  if (typeof value !== 'string') return false;
  const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/);
  if (!parts) return false;
  const [year, month, day, hour, minute, second] = parts.slice(1).map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= monthDays[month - 1] &&
    hour <= 23 && minute <= 59 && second <= 59 && Number.isFinite(Date.parse(value));
};
const isAttempt = value => isRecord(value) && isScore(value.score, value.total) &&
  isTimestamp(value.completedAt);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

/**
 * Ajoute une tentative entière, sans modifier l'objet d'origine ni son historique.
 * completedAt doit être fourni par l'appelant (p. ex. new Date().toISOString()).
 * Les données incorrectes sont conservées, mais ne deviennent jamais des résultats.
 */
export function recordQuizAttempt(previous, { score, total, completedAt } = {}) {
  if (!isScore(score, total) || !isTimestamp(completedAt)) {
    throw new TypeError('Une tentative exige un score valide, un total positif et une date ISO avec fuseau.');
  }

  const source = isRecord(previous) ? previous : {};
  const result = { ...source };
  if (previous != null && !isRecord(previous)) result.progressArchive = [previous];

  let attempts = [];
  if (Array.isArray(source.quizAttempts)) {
    attempts = source.quizAttempts;
  } else if (hasOwn(source, 'quizAttempts')) {
    // Conserver intégralement une ancienne valeur illisible avant de la remplacer.
    const archive = Array.isArray(source.quizAttemptsArchive)
      ? source.quizAttemptsArchive
      : hasOwn(source, 'quizAttemptsArchive') ? [source.quizAttemptsArchive] : [];
    result.quizAttemptsArchive = [...archive, source.quizAttempts];
  }

  // Un meilleur score ancien ne permet pas de reconstituer les anciennes tentatives.
  if (!hasOwn(source, 'legacyQuizScore') && !attempts.some(isAttempt) && isScore(source.score, total)) {
    result.legacyQuizScore = { score: source.score, total };
  }
  result.quizAttempts = [...attempts, { score, total, completedAt }];
  const previousScoreValid = Number.isSafeInteger(source.score) && source.score >= 0;
  if (hasOwn(source, 'score') && !previousScoreValid) {
    const archive = Array.isArray(source.quizScoreArchive)
      ? source.quizScoreArchive
      : hasOwn(source, 'quizScoreArchive') ? [source.quizScoreArchive] : [];
    result.quizScoreArchive = [...archive, source.score];
  }
  const previousBest = previousScoreValid ? source.score : 0;
  result.score = Math.max(previousBest, score);
  result.done = source.done || score === total;
  return result;
}

/**
 * Valeurs non arrondies ; null signifie qu'aucun dénominateur fiable n'est disponible.
 * Complétion : questions des QCM réalisés au moins une fois / questions disponibles.
 * Réussite : bonnes réponses / questions de toutes les tentatives documentées.
 * Les anciens meilleurs scores contribuent uniquement à la complétion.
 * L'indice est un repère de révision sur 100, jamais une probabilité d'examen.
 */
export function getUnitExamStats(unitId, lessons, progress) {
  const source = isRecord(progress) ? progress : {};
  const unitLessons = Array.isArray(lessons)
    ? lessons.filter(lesson => isRecord(lesson) && lesson.unit === unitId && Array.isArray(lesson.quiz) && lesson.quiz.length)
    : [];
  let availableQuestions = 0;
  let completedQuestions = 0;
  let correctAnswers = 0;
  let answeredQuestions = 0;
  let attemptCount = 0;
  let hasInvalidHistory = (progress != null && !isRecord(progress)) || hasOwn(source, 'progressArchive');
  const legacyScores = [];
  const seen = new Set();

  for (const lesson of unitLessons) {
    if (typeof lesson.id !== 'string' || seen.has(lesson.id)) continue;
    seen.add(lesson.id);
    const total = lesson.quiz.length;
    availableQuestions += total;
    const saved = isRecord(source[lesson.id]) ? source[lesson.id] : {};
    if (hasOwn(source, lesson.id) && !isRecord(source[lesson.id])) hasInvalidHistory = true;
    if (hasOwn(saved, 'score') && !isScore(saved.score, total)) hasInvalidHistory = true;
    const attempts = Array.isArray(saved.quizAttempts) ? saved.quizAttempts : [];
    if (hasOwn(saved, 'quizAttempts') && !Array.isArray(saved.quizAttempts)) hasInvalidHistory = true;
    if (hasOwn(saved, 'quizAttemptsArchive') || hasOwn(saved, 'quizScoreArchive') || hasOwn(saved, 'progressArchive')) hasInvalidHistory = true;

    let completed = 0;
    let validAttempts = 0;
    for (const attempt of attempts) {
      if (!isAttempt(attempt)) { hasInvalidHistory = true; continue; }
      correctAnswers += attempt.score;
      answeredQuestions += attempt.total;
      attemptCount += 1;
      validAttempts += 1;
      // Les répétitions augmentent l'historique, jamais le nombre de questions uniques.
      completed = Math.max(completed, Math.min(total, attempt.total));
    }

    const legacy = hasOwn(saved, 'legacyQuizScore')
      ? saved.legacyQuizScore
      : !validAttempts && isScore(saved.score, total) ? { score: saved.score, total } : null;
    if (isRecord(legacy) && isScore(legacy.score, legacy.total)) {
      legacyScores.push({ lessonId: lesson.id, score: legacy.score, total: legacy.total });
      completed = Math.max(completed, Math.min(total, legacy.total));
    } else if (hasOwn(saved, 'legacyQuizScore')) {
      hasInvalidHistory = true;
    }
    completedQuestions += completed;
  }

  const completionPercent = availableQuestions ? completedQuestions / availableQuestions * 100 : null;
  const successRate = answeredQuestions ? correctAnswers / answeredQuestions * 100 : null;
  const preparationIndex = availableQuestions && answeredQuestions
    ? completedQuestions / availableQuestions * correctAnswers / answeredQuestions * 100
    : null;
  return {
    availableQuestions, completedQuestions, completionPercent,
    correctAnswers, answeredQuestions, attemptCount, successRate, preparationIndex,
    legacyScores, hasInvalidHistory,
    historyIncomplete: legacyScores.length > 0 || hasInvalidHistory,
  };
}
