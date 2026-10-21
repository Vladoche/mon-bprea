import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  calculateStats, createQuestionTimer, createSession, evaluateAnswer,
  getCategoryAvailability, getRevisionSpeciesIds, normalizeAnswer,
} from '../../assets/botanical-engine.js';

const NOW = new Date('2026-10-21T12:00:00.000Z');
const options = { categoryId: 'fruit', id: 'test-session', now: NOW, rng: () => 0.3 };
function bank(count = 12) {
  return {
    categories: [{ id: 'fruit', name: 'Fruits' }, { id: 'flower', name: 'Fleurs' }],
    species: Array.from({ length: count }, (_, index) => ({
      id: `plant-${index}`, commonName: `Plante ${index}`, scientificName: `Planta ${index}`,
      categoryIds: [index === count - 1 ? 'flower' : 'fruit'], family: 'Famille témoin',
      description: 'Entrée synthétique réservée aux tests.', criteria: ['Caractère botanique synthétique distinctif.'],
      sources: [{ title: 'Documentation de fixture synthétique', url: `https://example.test/species/${index}` }],
    })),
    photos: Array.from({ length: count }, (_, index) => ({
      id: `photo-${index}`, speciesId: `plant-${index}`, path: `photos/${index}.jpg`,
      stage: 'floraison', organ: 'fleur', author: 'Fixture synthétique — aucune photographie réelle',
      sourceUrl: `https://example.test/photos/${index}`, license: 'CC0 1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      visibleCriteria: ['Caractère distinctif synthétique visible.'], identification: 'Explication synthétique de la fixture.',
    })),
    confusions: [{ speciesId: 'plant-0', otherSpeciesId: 'plant-1', explanation: 'Fruits proches' }],
  };
}
function answer(session, position, choice = 'correct', now = NOW) {
  const question = session.questions[position];
  return evaluateAnswer(session, question, choice === 'timeout' || choice === 'skipped_image'
    ? { status: choice, now }
    : { selectedSpeciesId: choice === 'correct' ? question.speciesId : question.choices.find(id => id !== question.speciesId), now });
}

afterEach(() => vi.useRealTimers());

describe('sélection botanique', () => {
  it('compte les espèces et les questions réellement jouables sans inventer une catégorie incomplète', () => {
    const source = bank();
    expect(getCategoryAvailability(source)).toMatchObject([
      { id: 'fruit', speciesCount: 11, playableCount: 11, playable: true },
      { id: 'flower', speciesCount: 1, playableCount: 0, playable: false },
    ]);
    expect(() => createSession(source, { ...options, categoryId: 'flower' })).toThrow(RangeError);
    expect(getCategoryAvailability(null)).toEqual([]);
    expect(() => createSession({}, options)).toThrow(RangeError);
  });

  it('génère dix questions distinctes de la catégorie, sans modifier le catalogue', () => {
    const source = bank();
    const initial = structuredClone(source);
    const session = createSession(source, options);
    expect(session.questions).toHaveLength(10);
    expect(new Set(session.questions.map(question => question.speciesId)).size).toBe(10);
    expect(session.startedAt).toBe('2026-10-21T12:00:00.000Z');
    for (const question of session.questions) {
      expect(question.speciesId).not.toBe('plant-11');
      expect(question.choices).toHaveLength(4);
      expect(new Set(question.choices).size).toBe(4);
      expect(question.choices.filter(id => id === question.speciesId)).toHaveLength(1);
      expect(question.choices).not.toContain('plant-11');
    }
    expect(source).toEqual(initial);
  });

  it('permet une session courte avec quatre espèces et refuse moins de quatre réponses distinctes', () => {
    const source = bank(5);
    expect(createSession(source, options).questions).toHaveLength(4);
    expect(() => createSession(bank(4), options)).toThrow(RangeError);
    source.species[1].commonName = source.species[0].commonName;
    expect(getCategoryAvailability(source)[0]).toMatchObject({ speciesCount: 4, playableCount: 0, playable: false });
    expect(() => createSession(source, options)).toThrow(RangeError);
    const duplicateTaxon = bank(5);
    duplicateTaxon.species[1].scientificName = duplicateTaxon.species[0].scientificName;
    expect(() => createSession(duplicateTaxon, options)).toThrow(RangeError);
  });

  it('réduit les questions sans image, conserve les choix compatibles et privilégie une confusion documentée', () => {
    const source = bank(7);
    source.photos = source.photos.filter(photo => photo.speciesId !== 'plant-2');
    const session = createSession(source, options);
    expect(session.questions).toHaveLength(5);
    expect(session.questions.map(question => question.speciesId)).not.toContain('plant-2');
    expect(session.questions.find(question => question.speciesId === 'plant-0').choices).toContain('plant-1');
    expect(session.questions.find(question => question.speciesId === 'plant-1').choices).toContain('plant-0');
    const different = createSession(source, { ...options, rng: () => 0.9 });
    expect(different.questions).not.toEqual(session.questions);
  });

  it('ignore les entrées malformées et les identifiants dupliqués', () => {
    const source = bank(5);
    source.categories.push(null, source.categories[0]);
    source.species.push(null, {}, source.species[0]);
    source.photos.push(null, {}, source.photos[0]);
    expect(getCategoryAvailability(source)).toHaveLength(2);
    expect(createSession(source, options).questions).toHaveLength(4);
    for (const invalid of [{ mode: 'unknown' }, { durationSeconds: NaN }, { durationSeconds: 0 }, { durationSeconds: 301 }, { limit: 11 }]) {
      expect(() => createSession(source, { ...options, ...invalid })).toThrow(RangeError);
    }
  });

  it('exclut les photographies ou fiches incomplètes et les chemins non sûrs des questions jouables', () => {
    for (const missing of ['author', 'sourceUrl', 'license', 'licenseUrl', 'stage', 'organ', 'identification', 'visibleCriteria']) {
      const source = bank(5);
      delete source.photos[0][missing];
      expect(getCategoryAvailability(source)[0]).toMatchObject({ speciesCount: 4, playableCount: 3 });
      expect(createSession(source, options).questions.map(question => question.speciesId)).not.toContain('plant-0');
    }
    for (const path of ['javascript:alert(1)', '//example.test/photo.jpg', '/photos/0.jpg', '../0.jpg', 'photos/%2e%2e/0.jpg', 'photos\\0.jpg']) {
      const source = bank(5);
      source.photos[0].path = path;
      expect(getCategoryAvailability(source)[0].playableCount).toBe(3);
    }
    const unavailable = bank(5);
    unavailable.photos.forEach(photo => { photo.visibleCriteria = []; });
    expect(getCategoryAvailability(unavailable)[0]).toMatchObject({ playable: false, playableCount: 0 });
    expect(() => createSession(unavailable, options)).toThrow(RangeError);
    for (const missing of ['family', 'criteria', 'sources']) {
      const source = bank(5);
      delete source.species[0][missing];
      expect(() => createSession(source, options)).toThrow(RangeError);
    }
  });
});

describe('réponses et révision', () => {
  it('distingue bonne réponse, mauvais choix, expiration et photographie indisponible', () => {
    const session = createSession(bank(), { ...options, mode: 'chrono' });
    expect(answer(session, 0)).toMatchObject({ status: 'correct', correct: true });
    expect(answer(session, 1, 'incorrect')).toMatchObject({ status: 'incorrect', correct: false });
    expect(answer(session, 2, 'timeout')).toMatchObject({ status: 'timeout', selectedSpeciesId: null, correct: false });
    expect(answer(session, 3, 'skipped_image')).toMatchObject({ status: 'skipped_image', selectedSpeciesId: null });
    expect(() => evaluateAnswer(session, session.questions[0], { selectedSpeciesId: 'outside' })).toThrow(RangeError);
    expect(() => evaluateAnswer(session, session.questions[0], { status: 'incorrect' })).toThrow(RangeError);
    const discovery = createSession(bank(), options);
    expect(() => answer(discovery, 0, 'timeout')).toThrow(RangeError);
  });

  it('révise erreurs et expirations, change de photographie quand possible et conserve les erreurs anciennes', () => {
    const source = bank(6);
    const session = createSession(source, { ...options, mode: 'chrono' });
    const wrong = answer(session, 0, 'incorrect');
    const timeout = answer(session, 1, 'timeout');
    const history = [wrong, timeout, answer(session, 2, 'skipped_image'), answer(session, 3)];
    source.photos.push({ ...source.photos.find(photo => photo.speciesId === wrong.speciesId), id: 'alternate', path: 'photos/alternate.jpg' });
    const revision = createSession(source, { ...options, id: 'revision', history, revision: true });
    expect(revision.questions).toHaveLength(2);
    expect(new Set(revision.questions.map(question => question.speciesId))).toEqual(new Set([wrong.speciesId, timeout.speciesId]));
    expect(revision.questions.find(question => question.speciesId === wrong.speciesId).photoId).toBe('alternate');
    const revised = answer(revision, 0);
    expect(getRevisionSpeciesIds([...history, revised])).toContain(wrong.speciesId);
    expect(getCategoryAvailability(source, history)[0].revisionCount).toBe(2);
    expect(() => createSession(source, { ...options, revision: true, history: [] })).toThrow(RangeError);
    expect(history).toHaveLength(4);
  });
});

describe('statistiques descriptives', () => {
  it('calcule le taux sur les réponses réalisées, y compris les expirations et sans pénalité pour une image absente', () => {
    const session = createSession(bank(), { ...options, mode: 'chrono' });
    const history = [answer(session, 0), answer(session, 1, 'incorrect'), answer(session, 2, 'timeout'), answer(session, 3, 'skipped_image')];
    const result = calculateStats([...history, history[0], null, { status: 'correct' }]);
    expect(result).toMatchObject({ attempted: 3, correct: 1, incorrect: 1, timeouts: 1, skipped: 1 });
    expect(result.recognitionRate).toBeCloseTo(100 / 3);
    expect(result.byCategory).toMatchObject([{ id: 'fruit', attempted: 3, correct: 1 }]);
    expect(result.bySpecies).toHaveLength(4);
    expect(result.bySpecies.find(item => item.id === history[3].speciesId)).toMatchObject({ attempted: 0, skipped: 1, recognitionRate: null });
    expect(result.timeline).toMatchObject([{ date: '2026-10-21', attempted: 3 }]);
  });

  it('ne crée aucun taux sans réponse et conserve l’évolution chronologique', () => {
    expect(calculateStats(null)).toEqual({ attempted: 0, correct: 0, incorrect: 0, timeouts: 0, skipped: 0, recognitionRate: null, bySpecies: [], byCategory: [], timeline: [] });
    const session = createSession(bank(), options);
    const earlier = answer(session, 0, 'incorrect', new Date('2026-10-20T20:00:00.000Z'));
    const later = answer(session, 1);
    expect(calculateStats([later, earlier]).timeline.map(day => day.date)).toEqual(['2026-10-20', '2026-10-21']);
    for (const patch of [{ correct: false }, { elapsedMs: -1 }, { elapsedMs: NaN }, { answeredAt: '2026-02-30T12:00:00.000Z' }, { selectedSpeciesId: null }]) {
      expect(normalizeAnswer({ ...later, ...patch })).toBeNull();
    }
  });
});

describe('chronomètre fondé sur le temps écoulé', () => {
  it('expire à l’échéance même si aucun intervalle n’a été exécuté', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const timer = createQuestionTimer({ durationMs: 30000, now: () => Date.now() });
    expect(timer.remainingMs()).toBe(30000);
    timer.start();
    vi.setSystemTime(new Date(NOW.getTime() + 29999));
    expect(timer.isExpired()).toBe(false);
    vi.setSystemTime(new Date(NOW.getTime() + 90000));
    expect(timer.isExpired()).toBe(true);
    expect(timer.remainingMs()).toBe(0);
    expect(timer.elapsedMs()).toBe(30000);
  });

  it('exclut la durée de consultation d’une correction ou d’un onglet masqué', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const timer = createQuestionTimer({ durationMs: 30000, now: () => Date.now() });
    timer.start();
    vi.setSystemTime(new Date(NOW.getTime() + 5000));
    timer.pause();
    vi.setSystemTime(new Date(NOW.getTime() + 65000));
    expect(timer.remainingMs()).toBe(25000);
    timer.pause();
    timer.resume();
    timer.resume();
    vi.setSystemTime(new Date(NOW.getTime() + 89999));
    expect(timer.remainingMs()).toBe(1);
    vi.setSystemTime(new Date(NOW.getTime() + 90000));
    expect(timer.isExpired()).toBe(true);
    timer.pause();
    timer.resume();
    expect(timer.isPaused()).toBe(true);
    timer.start();
    expect(timer.remainingMs()).toBe(30000);
  });
});
