import { units, lessons } from './content.js';
import { getCountedDrillResponses, getParisWeek, shiftWeek } from './drill-engine.js';

/** Descriptive teaching guidance, not a scientific assessment of proficiency. */
export const DASHBOARD_THRESHOLDS = Object.freeze({
  minimumResponses: 5,
  strongRate: 80,
  reworkRate: 60,
});

const periods = new Set(['4', '8', '12', 'all']);
const unitIds = new Set(units.map(unit => unit.id));
const lessonIds = new Set(lessons.map(lesson => lesson.id));

function emptyStats() {
  return { completed: 0, correct: 0, incorrect: 0, successRate: null };
}

function count(stats, answer) {
  stats.completed += 1;
  if (answer.correct) stats.correct += 1;
  else stats.incorrect += 1;
}

function finish(stats) {
  stats.successRate = stats.completed ? stats.correct / stats.completed * 100 : null;
  return stats;
}

function mastery(stats) {
  if (stats.completed < DASHBOARD_THRESHOLDS.minimumResponses) return 'insufficient';
  if (stats.successRate >= DASHBOARD_THRESHOLDS.strongRate) return 'strong';
  if (stats.successRate < DASHBOARD_THRESHOLDS.reworkRate) return 'rework';
  return 'developing';
}

function safeResource(reference) {
  if (!reference || typeof reference.title !== 'string' || !reference.title.trim() || typeof reference.url !== 'string') return null;
  if (/^cours\.html\?id=[a-z0-9-]+(?:#[a-z0-9-]+)?$/.test(reference.url)) {
    const lessonId = new URLSearchParams(reference.url.split('?')[1].split('#')[0]).get('id');
    return lessonIds.has(lessonId) ? { title: reference.title, url: reference.url } : null;
  }
  try {
    const url = new URL(reference.url);
    if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) {
      return { title: reference.title, url: reference.url };
    }
  } catch { /* An invalid historical link is not exposed to the renderer. */ }
  return null;
}

function appendResources(notion, question) {
  const reference = safeResource(question.reference);
  const resources = reference ? [reference] : [];
  if (lessonIds.has(question.sourceLesson)) {
    resources.push({ title: 'Revoir le cours associé', url: `cours.html?id=${encodeURIComponent(question.sourceLesson)}` });
  }
  for (const resource of resources) {
    if (!notion.resources.some(existing => existing.url === resource.url)) notion.resources.push(resource);
  }
}

/**
 * Pure aggregation of the normalized Drill state. No bank fetch, DOM or storage
 * access occurs here. Only immutable root answers count; their saved
 * answeredAt determines the Paris activity week. The saved series.week remains
 * provenance and is deliberately not used as the activity date.
 *
 * Periods include the current ISO week and N-1 preceding weeks. All history
 * starts at the earliest reliable activity across all UC, keeping comparison
 * bounds stable when the selected UC changes. Empty weeks have a null rate.
 */
export function createDashboardModel(state, { unit = 'all', period = 'all', now = new Date() } = {}) {
  const currentWeek = getParisWeek(now);
  const nowTime = (now instanceof Date ? now : new Date(now)).getTime();
  const selectedUnit = unitIds.has(unit) ? unit : 'all';
  const selectedPeriod = periods.has(String(period)) ? String(period) : 'all';
  const warnings = Array.isArray(state?.warnings) ? [...state.warnings] : [];
  const responses = [];
  let futureCount = 0;
  let unknownUnitCount = 0;
  for (const response of getCountedDrillResponses(state?.series ?? {})) {
    if (!unitIds.has(response.series.unit)) { unknownUnitCount += 1; continue; }
    if (Date.parse(response.answer.answeredAt) > nowTime) { futureCount += 1; continue; }
    responses.push({ ...response, activityWeek: getParisWeek(response.answer.answeredAt) });
  }
  if (futureCount) warnings.push(`${futureCount} réponse${futureCount > 1 ? 's' : ''} datée${futureCount > 1 ? 's' : ''} dans le futur ${futureCount > 1 ? 'sont exclues' : 'est exclue'} des statistiques. Vérifie l’horloge de ton appareil.`);
  if (unknownUnitCount) warnings.push('Certaines réponses ne peuvent pas être rattachées à une UC connue et sont exclues des statistiques.');

  const firstWeek = selectedPeriod === 'all'
    ? responses.reduce((earliest, response) => response.activityWeek.ordinal < earliest.ordinal ? response.activityWeek : earliest, currentWeek)
    : shiftWeek(currentWeek.id, -(Number(selectedPeriod) - 1));
  const weeks = [];
  // Civil ISO weeks, rather than millisecond intervals, preserve DST boundaries.
  for (let ordinal = firstWeek.ordinal; ordinal <= currentWeek.ordinal; ordinal += 1) {
    const week = shiftWeek(firstWeek.id, ordinal - firstWeek.ordinal);
    weeks.push({ id: week.id, start: week.start, end: week.end, ...emptyStats() });
  }
  const weeksById = new Map(weeks.map(week => [week.id, week]));
  const unitStats = units.map(({ id, code, title }) => ({ id, code, title, ...emptyStats() }));
  const unitsById = new Map(unitStats.map(item => [item.id, item]));
  const totals = emptyStats();
  const notions = new Map();
  const chapters = new Map();
  for (const { series, question, answer, activityWeek } of responses) {
    if (activityWeek.ordinal < firstWeek.ordinal || activityWeek.ordinal > currentWeek.ordinal) continue;
    // The comparison always covers all UC for the same chosen period.
    count(unitsById.get(series.unit), answer);
    if (selectedUnit !== 'all' && series.unit !== selectedUnit) continue;
    count(totals, answer);
    count(weeksById.get(activityWeek.id), answer);

    const chapter = typeof question.chapter === 'string' && question.chapter.trim() ? question.chapter.trim() : 'Chapitre non renseigné';
    const concept = typeof question.concept === 'string' && question.concept.trim() ? question.concept.trim() : 'Notion non renseignée';
    // JSON tuples keep homonyms in different UC or chapters distinct.
    const chapterKey = JSON.stringify([series.unit, chapter]);
    const notionKey = JSON.stringify([series.unit, chapter, concept]);
    if (!chapters.has(chapterKey)) chapters.set(chapterKey, { unit: series.unit, chapter, ...emptyStats() });
    if (!notions.has(notionKey)) notions.set(notionKey, { unit: series.unit, chapter, concept, ...emptyStats(), resources: [] });
    count(chapters.get(chapterKey), answer);
    const notion = notions.get(notionKey);
    count(notion, answer);
    appendResources(notion, question);
  }
  const completedWeeks = weeks.map(finish);
  return {
    totals: { ...finish(totals), activeWeeks: completedWeeks.filter(week => week.completed > 0).length },
    weeks: completedWeeks,
    units: unitStats.map(finish),
    notions: [...notions.values()].map(notion => { finish(notion); return { ...notion, mastery: mastery(notion) }; }),
    chapters: [...chapters.values()].map(finish),
    error: typeof state?.error === 'string' ? state.error : null,
    warnings: [...new Set(warnings)],
    periodStart: firstWeek.start,
    periodEnd: currentWeek.end,
  };
}
