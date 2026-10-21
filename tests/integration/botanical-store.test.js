import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  calculateStats, createSession, evaluateAnswer, getCategoryAvailability,
} from '../../assets/botanical-engine.js';
import { BOTANICAL_STORAGE_KEY, createBotanicalStore } from '../../assets/botanical-store.js';

const bank = JSON.parse(readFileSync(new URL('../../assets/botanical-bank.json', import.meta.url), 'utf8'));
const NOW = new Date('2026-10-21T12:00:00.000Z');
const firstCategory = () => getCategoryAvailability(bank).find(category => category.playable)?.id;
const makeSession = (overrides = {}) => createSession(bank, {
  id: 'integration-session', categoryId: firstCategory(), mode: 'chrono', now: NOW, rng: () => 0.4, ...overrides,
});
function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    entries: () => Object.fromEntries(data),
  };
}
function makeAnswer(session, index = 0, status = 'correct') {
  const question = session.questions[index];
  return evaluateAnswer(session, question, ['timeout', 'skipped_image'].includes(status)
    ? { status, elapsedMs: status === 'timeout' ? 30000 : 0, now: NOW }
    : { selectedSpeciesId: status === 'correct' ? question.speciesId : question.choices.find(id => id !== question.speciesId), elapsedMs: 2500, now: NOW });
}

describe('banque botanique réelle et persistance isolée', () => {
  it('génère une session jouable pour chaque catégorie disponible avec des photographies locales', () => {
    const available = getCategoryAvailability(bank).filter(category => category.playable);
    expect(available.length).toBeGreaterThanOrEqual(2);
    for (const category of available) {
      const session = makeSession({ categoryId: category.id });
      expect(session.questions).toHaveLength(Math.min(10, category.playableCount));
      expect(new Set(session.questions.map(question => question.speciesId)).size).toBe(session.questions.length);
      for (const question of session.questions) {
        const photo = bank.photos.find(item => item.id === question.photoId);
        expect(photo.speciesId).toBe(question.speciesId);
        expect(existsSync(fileURLToPath(new URL(`../../${photo.path}`, import.meta.url)))).toBe(true);
        expect(question.choices).toHaveLength(4);
        expect(new Set(question.choices).size).toBe(4);
        for (const speciesId of question.choices) {
          expect(bank.species.find(plant => plant.id === speciesId).categoryIds).toContain(category.id);
        }
      }
    }
  });

  it('sauvegarde les réponses immédiatement, relit l’historique et préserve toutes les autres clés', () => {
    const legacy = {
      'bprea-demo-drill-v1': JSON.stringify({ version: 1, series: { preserved: true } }),
      'bprea-demo-progress': 'qcm-personnel',
      'bprea-appearance': 'dark',
      'unknown-future-feature': 'unrelated-data',
    };
    const storage = memoryStorage(legacy);
    const session = makeSession();
    const store = createBotanicalStore(storage);
    expect(store.load()).toEqual({ schemaVersion: 1, answers: [], sessions: [] });
    expect(store.recordSession(session)).toBe(true);
    const correct = makeAnswer(session);
    const timeout = makeAnswer(session, 1, 'timeout');
    expect(store.recordAnswer(correct)).toBe(true);
    expect(store.recordAnswer(timeout)).toBe(true);
    const reloaded = createBotanicalStore(storage).load();
    expect(reloaded.answers).toEqual([correct, timeout]);
    expect(reloaded.sessions).toMatchObject([{ id: session.id, totalQuestions: session.questions.length, completedAt: null }]);
    expect(reloaded.sessions[0]).not.toHaveProperty('questions');
    expect(calculateStats(reloaded.answers)).toMatchObject({ attempted: 2, correct: 1, timeouts: 1, recognitionRate: 50 });
    expect(storage.entries()).toMatchObject(legacy);
    expect(Object.keys(storage.entries()).sort()).toEqual([...Object.keys(legacy), BOTANICAL_STORAGE_KEY].sort());
    expect(store.recordSession({ ...session, completedAt: '2026-10-21T12:05:00.000Z' })).toBe(true);
    expect(store.load().sessions[0].completedAt).toBe('2026-10-21T12:05:00.000Z');
    expect(store.recordSession(session)).toBe(true);
    expect(store.load().sessions[0].completedAt).toBe('2026-10-21T12:05:00.000Z');
  });

  it('permet de commencer une nouvelle session et de réviser sans effacer les tentatives antérieures', () => {
    const storage = memoryStorage();
    const store = createBotanicalStore(storage);
    const initial = makeSession();
    const wrong = makeAnswer(initial, 0, 'incorrect');
    expect(store.recordSession(initial)).toBe(true);
    expect(store.recordAnswer(wrong)).toBe(true);
    const reloaded = createBotanicalStore(storage);
    const revision = makeSession({ id: 'revision-session', history: reloaded.load().answers, revision: true });
    expect(revision.questions).toHaveLength(1);
    expect(revision.questions[0].speciesId).toBe(wrong.speciesId);
    expect(reloaded.recordSession(revision)).toBe(true);
    expect(reloaded.recordAnswer(makeAnswer(revision))).toBe(true);
    const history = store.load();
    expect(history.answers[0]).toEqual(wrong);
    expect(history.sessions).toHaveLength(2);
    expect(calculateStats(history.answers)).toMatchObject({ attempted: 2, correct: 1, incorrect: 1, recognitionRate: 50 });
    expect(getCategoryAvailability(bank, history.answers).find(category => category.id === initial.categoryId).revisionCount).toBe(1);
  });

  it('ne remplace pas la première réponse et fusionne les écritures successives de plusieurs onglets', () => {
    const storage = memoryStorage();
    const firstTab = createBotanicalStore(storage);
    const secondTab = createBotanicalStore(storage);
    const session = makeSession();
    firstTab.load();
    secondTab.load();
    const initial = makeAnswer(session, 0, 'incorrect');
    expect(firstTab.recordAnswer(initial)).toBe(true);
    expect(secondTab.recordAnswer(makeAnswer(session, 1))).toBe(true);
    expect(firstTab.recordAnswer(initial)).toBe(true);
    expect(firstTab.recordAnswer(makeAnswer(session, 0))).toBe(false);
    expect(firstTab.status.state).toBe('invalid');
    expect(secondTab.load().answers).toEqual([initial, makeAnswer(session, 1)]);
  });

  it('conserve les champs inconnus et les lignes illisibles tout en les excluant des statistiques', () => {
    const session = makeSession();
    const valid = makeAnswer(session);
    const malformed = { id: 'unreadable', futureData: [1, 2, 3] };
    const document = { schemaVersion: 1, futureSync: { userId: 'future' }, answers: [valid, malformed], sessions: [malformed] };
    const storage = memoryStorage({ [BOTANICAL_STORAGE_KEY]: JSON.stringify(document) });
    const store = createBotanicalStore(storage);
    expect(store.load()).toMatchObject({ answers: [valid], sessions: [] });
    expect(store.status.message).toContain('illisibles');
    expect(store.recordAnswer(makeAnswer(session, 1, 'timeout'))).toBe(true);
    const persisted = JSON.parse(storage.getItem(BOTANICAL_STORAGE_KEY));
    expect(persisted).toMatchObject({ futureSync: document.futureSync, sessions: [malformed] });
    expect(persisted.answers[1]).toEqual(malformed);
    expect(calculateStats(store.load().answers)).toMatchObject({ attempted: 2, correct: 1, timeouts: 1 });
  });

  it.each([
    ['{invalid-json', 'corrupt'],
    ['null', 'corrupt'],
    [JSON.stringify({ schemaVersion: 1, answers: {}, sessions: [] }), 'corrupt'],
    [JSON.stringify({ schemaVersion: 2, answers: [], sessions: [], valuableFutureData: true }), 'future'],
  ])('préserve intégralement un document corrompu ou futur (%s)', (raw, expectedState) => {
    const storage = memoryStorage({ [BOTANICAL_STORAGE_KEY]: raw });
    const store = createBotanicalStore(storage);
    expect(store.load().answers).toEqual([]);
    expect(store.status).toMatchObject({ state: expectedState, writable: false });
    expect(store.recordAnswer(makeAnswer(makeSession()))).toBe(false);
    expect(storage.getItem(BOTANICAL_STORAGE_KEY)).toBe(raw);
  });

  it('signale un stockage bloqué ou plein sans modifier les données existantes', () => {
    const blocked = createBotanicalStore({ getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } });
    expect(blocked.load().answers).toEqual([]);
    expect(blocked.status).toMatchObject({ state: 'unavailable', writable: false });
    expect(blocked.recordAnswer(makeAnswer(makeSession()))).toBe(false);
    const storage = memoryStorage({ legacy: 'unchanged' });
    const full = createBotanicalStore({ getItem: storage.getItem, setItem() { throw new Error('quota exceeded'); } });
    expect(full.recordAnswer(makeAnswer(makeSession()))).toBe(false);
    expect(full.status.state).toBe('unavailable');
    expect(storage.entries()).toEqual({ legacy: 'unchanged' });
  });

  it('refuse les données invalides et les collisions de session sans écrire', () => {
    const storage = memoryStorage();
    const store = createBotanicalStore(storage);
    expect(store.recordAnswer({ status: 'correct' })).toBe(false);
    expect(store.recordSession({ id: 'invalid' })).toBe(false);
    expect(storage.entries()).toEqual({});
    const session = makeSession();
    expect(store.recordSession({ ...session, startedAt: '2026-02-30T12:00:00.000Z' })).toBe(false);
    expect(store.recordSession({ ...session, completedAt: '2026-10-20T12:00:00.000Z' })).toBe(false);
    expect(storage.entries()).toEqual({});
    expect(store.recordSession(session)).toBe(true);
    const original = storage.getItem(BOTANICAL_STORAGE_KEY);
    expect(store.recordSession({ ...session, mode: 'discovery' })).toBe(false);
    expect(storage.getItem(BOTANICAL_STORAGE_KEY)).toBe(original);
  });
});
