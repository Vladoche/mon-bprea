import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDrillUnitStats, getSeriesStats } from '../../assets/drill-engine.js';
import { answerFor, makeSeries } from '../fixtures/drill.js';
import { MemoryStorage } from '../helpers/memory-storage.js';

const now = new Date('2026-10-20T10:00:00Z');
let storage;
let store;

async function reloadModules() {
  vi.resetModules();
  const [drill, data, stats] = await Promise.all([
    import('../../assets/drill-store.js'),
    import('../../assets/dashboard-data.js'),
    import('../../assets/dashboard-stats.js'),
  ]);
  return { drill, data, stats };
}

beforeEach(async () => {
  storage = new MemoryStorage();
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('navigator', {});
  store = (await reloadModules()).drill;
});

afterEach(() => vi.unstubAllGlobals());

describe('persistance Drill et lecture du Dashboard', () => {
  it('crée une série sans réponse et retrouve le brouillon après rechargement des modules', async () => {
    storage.setItem('bprea-demo-progress', '{"cours-termine":true}');
    expect(store.readDrillState()).toEqual({ series: {}, error: null, warnings: [] });
    expect(storage.getItem(store.DRILL_STORAGE_KEY)).toBeNull();
    const fixture = makeSeries();
    const first = fixture.questions[0];
    const originalPrompt = first.prompt;
    const created = await store.ensureSeries(fixture.unit, fixture.week, fixture.questions, fixture.startedAt);
    expect(created.error).toBeNull();
    expect(await store.saveDraft(fixture.id, first.id, first.answer)).toMatchObject({ error: null });
    first.prompt = 'La banque a changé après le début de la série';

    const { drill, data, stats } = await reloadModules();
    const restored = drill.readDrillState().series[fixture.id];
    expect(restored.questions[0].prompt).toBe(originalPrompt);
    expect(restored.drafts[first.id]).toBe(first.answer);
    expect(Object.keys(restored.answers)).toEqual([]);
    expect(stats.createDashboardModel(data.readDashboardData(), { now }).totals.completed).toBe(0);
    expect(storage.getItem('bprea-demo-progress')).toBe('{"cours-termine":true}');
  });

  it('rend une première réponse visible dans le Dashboard après rechargement, sans compter les neuf autres', async () => {
    const fixture = makeSeries();
    const first = fixture.questions[0];
    await store.ensureSeries(fixture.unit, fixture.week, fixture.questions, fixture.startedAt);
    expect(await store.submitAnswer(fixture.id, first.id, first.answer, { nowISO: '2026-10-20T08:00:00Z' }))
      .toMatchObject({ error: null });

    const { drill, data, stats } = await reloadModules();
    const restored = drill.readDrillState();
    const model = stats.createDashboardModel(data.readDashboardData(), { now });
    expect(getDrillUnitStats(restored, 'uc3')).toMatchObject({ planned: 10, completed: 1, correct: 1, successRate: 100 });
    expect(model.totals).toEqual({ completed: 1, correct: 1, incorrect: 0, successRate: 100, activeWeeks: 1 });
    expect(model.units.find(unit => unit.id === 'uc3')).toMatchObject({ completed: 1, correct: 1 });
    expect(model.weeks.find(week => week.id === '2026-W43')).toMatchObject({ completed: 1, correct: 1 });
  });

  it('fige la première réponse, distingue l’entraînement et ignore un double événement de validation', async () => {
    const fixture = makeSeries();
    const first = fixture.questions[0];
    const wrong = first.options.find(option => option.id !== first.answer).id;
    await store.ensureSeries(fixture.unit, fixture.week, fixture.questions, fixture.startedAt);
    await store.submitAnswer(fixture.id, first.id, wrong, { nowISO: '2026-10-20T08:00:00Z' });
    await store.submitAnswer(fixture.id, first.id, first.answer, { nowISO: '2026-10-20T08:01:00Z' });
    await store.saveDraft(fixture.id, first.id, first.answer, { training: true });
    const training = { training: true, nowISO: '2026-10-20T08:02:00Z' };
    await store.submitAnswer(fixture.id, first.id, first.answer, training);
    await store.submitAnswer(fixture.id, first.id, first.answer, training);

    const { drill, data, stats } = await reloadModules();
    const restored = drill.readDrillState().series[fixture.id];
    expect(restored.answers[first.id]).toMatchObject({ answer: wrong, correct: false, answeredAt: '2026-10-20T08:00:00Z' });
    expect(restored.answers[first.id].attempts).toHaveLength(2);
    expect(restored.trainingDrafts[first.id]).toBeNull();
    expect(getSeriesStats(restored)).toMatchObject({ completed: 1, incorrect: 1, successRate: 0, trainingAttempts: 1 });
    expect(stats.createDashboardModel(data.readDashboardData(), { now }).totals)
      .toMatchObject({ completed: 1, correct: 0, incorrect: 1, successRate: 0 });
  });

  it('préserve les anciennes séries, leurs champs inconnus et les archives illisibles pendant une nouvelle écriture', async () => {
    const old = makeSeries({ week: '2026-W42', startedAt: '2026-10-12T08:00:00Z' });
    const [first, second] = old.questions;
    first.prompt = 'Énoncé historique conservé';
    old.answers[first.id] = answerFor(first, { correct: false, answeredAt: '2026-10-13T08:00:00Z' });
    old.answers[first.id].attempts = old.answers[first.id].attempts.map(({ training, ...attempt }) => attempt);
    delete old.trainingDrafts;
    old.futureMetadata = { source: 'ancienne-version' };
    const archive = { contenu: 'Ne pas effacer une archive non reconnue' };
    const document = { version: 1, futureField: ['conservé'], series: { [old.id]: old, archive } };
    storage.setItem(store.DRILL_STORAGE_KEY, JSON.stringify(document));
    storage.setItem('bprea-demo-quiz', '{"historique":[1,0,1]}');
    const beforeRead = storage.getItem(store.DRILL_STORAGE_KEY);
    expect(store.readDrillState().warnings).toHaveLength(1);
    expect(storage.getItem(store.DRILL_STORAGE_KEY)).toBe(beforeRead);

    const current = makeSeries();
    expect(await store.ensureSeries(current.unit, current.week, current.questions, current.startedAt)).toMatchObject({ error: null });
    expect(await store.saveDraft(old.id, first.id, first.answer, { training: true })).toMatchObject({ error: null });
    expect(await store.submitAnswer(old.id, second.id, second.answer, { nowISO: '2026-10-14T08:00:00Z' }))
      .toMatchObject({ error: null });
    const { drill, data, stats } = await reloadModules();
    const persisted = JSON.parse(storage.getItem(drill.DRILL_STORAGE_KEY));
    expect(persisted.series.archive).toEqual(archive);
    expect(persisted.futureField).toEqual(['conservé']);
    expect(persisted.series[old.id].questions).toEqual(old.questions);
    expect(persisted.series[old.id].answers[first.id]).toEqual(old.answers[first.id]);
    expect(persisted.series[old.id].futureMetadata).toEqual(old.futureMetadata);
    expect(persisted.series[old.id].trainingDrafts[first.id]).toBe(first.answer);
    expect(drill.listSavedSeries()).toHaveLength(2);
    expect(stats.createDashboardModel(data.readDashboardData(), { now }).totals)
      .toMatchObject({ completed: 2, correct: 1, incorrect: 1, successRate: 50 });
    expect(storage.getItem('bprea-demo-quiz')).toBe('{"historique":[1,0,1]}');
  });

  it('refuse de remplacer un document absent de format reconnu ou malformé, sans perdre son contenu', async () => {
    const fixture = makeSeries();
    storage.setItem('bprea-demo-progress', 'progression indépendante');
    const malformedDocuments = [
      '{contenu incomplet',
      JSON.stringify({ version: 2, series: {}, future: 'historique' }),
      JSON.stringify({ version: 1, series: ['ancienne-série'] }),
    ];
    for (const raw of malformedDocuments) {
      storage.setItem(store.DRILL_STORAGE_KEY, raw);
      const { drill, data, stats } = await reloadModules();
      expect(drill.readDrillState().error).toBeTruthy();
      expect(stats.createDashboardModel(data.readDashboardData(), { now }).totals)
        .toMatchObject({ completed: 0, successRate: null });
      const attempted = await drill.ensureSeries(fixture.unit, fixture.week, fixture.questions, fixture.startedAt);
      expect(attempted.error).toBeTruthy();
      expect(attempted.series).toBeNull();
      expect(storage.getItem(drill.DRILL_STORAGE_KEY)).toBe(raw);
      expect(storage.getItem('bprea-demo-progress')).toBe('progression indépendante');
    }
  });
});
