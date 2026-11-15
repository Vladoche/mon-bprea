import { describe, expect, test } from 'vitest';
import { learningOverview } from '../../assets/learning-overview.js';

const now = Date.parse('2026-11-15T12:00:00Z');
const state = (progress = {}, mode = 'visitor') => ({ mode, view: { progress, error: null, warnings: [] }, sync: { state: mode === 'visitor' ? 'visitor' : 'synced' } });
const unit = model => model.units.find(item => item.unit.id === 'uc3');

describe('Présentation fiable des cours, sans nouvelle collecte', () => {
  test('distingue un historique neuf, les cours terminés et les UC sans contenu', () => {
    expect(unit(learningOverview(state(), now))).toMatchObject({ count: 4, done: 0, percent: 0 });
    const model = learningOverview(state({ 'matiere-organique': { done: true }, 'rapport-cn': { done: false, score: 3 } }), now);
    expect(unit(model)).toMatchObject({ done: 1, percent: 25 });
    expect(model.units.find(item => item.unit.id === 'uc1')).toMatchObject({ count: 0, done: null, percent: null });
    expect(model.resume).toBeNull(); // no inferred activity date or completion from a best score
  });

  test.each(['blocked', 'personal'])('masque les valeurs pendant une vérification ou une perte de session (%s)', mode => {
    const snapshot = state({ 'matiere-organique': { done: true } }, mode);
    snapshot.sync.state = 'session';
    const model = learningOverview(snapshot, now);
    expect(unit(model).percent).toBeNull();
    expect(model.courses.every(item => !item.known)).toBe(true);
    expect(model.resume).toBeNull();
  });

  test('ne transforme pas un historique illisible en faux zéro et conserve la source', () => {
    const snapshot = state({ progressArchive: ['invalid'] });
    snapshot.view.warnings = ['Historique illisible conservé'];
    const raw = structuredClone(snapshot);
    expect(unit(learningOverview(snapshot, now)).percent).toBeNull();
    expect(snapshot).toEqual(raw);
    expect(unit(learningOverview(state({ 'rapport-cn': { done: 'oui' } }), now)).percent).toBeNull();
  });

  test('reprend seulement le dernier QCM valide, daté, connu et non futur de cette source', () => {
    const snapshot = state({
      'matiere-organique': { done: true, quizAttempts: [{ score: 2, total: 3, completedAt: '2026-11-14T12:00:00Z' }] },
      'rapport-cn': { score: 3, quizAttempts: [
        { score: 1, total: 3, completedAt: '2026-11-15T11:00:00Z' },
        { score: 3, total: 3, completedAt: '2027-01-01T12:00:00Z' },
        { score: 9, total: 3, completedAt: '2026-11-15T11:30:00Z' },
      ] },
      obsolete: { quizAttempts: [{ score: 1, total: 3, completedAt: '2026-11-15T11:55:00Z' }] },
    }, 'personal');
    expect(learningOverview(snapshot, now).resume.lesson.id).toBe('rapport-cn');
    snapshot.view.error = 'Cache non vérifié';
    expect(learningOverview(snapshot, now).resume).toBeNull();
    snapshot.view.error = null;
    snapshot.sync.state = 'offline';
    expect(learningOverview(snapshot, now).resume.lesson.id).toBe('rapport-cn');
  });
});
