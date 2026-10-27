import { describe, it, expect } from 'vitest';
import { projectRow, projectLocal, projectVisitor, envelope, serializeExport } from '../../assets/export-model.js';
import { emptyPersonalDocument, personalChange } from '../../assets/drill-personal-store.js';
import { emptyPersonalDocument as courses, mutateCourse } from '../../assets/course-quiz-model.js';
import { emptySettingsDocument, queueSettings } from '../../assets/settings-model.js';
import { emptyPersonalDocument as botanical } from '../../assets/botanical-sync-model.js';
import { A, B, uuid, questions, serverRows, stamp } from '../fixtures/export.js';
const scope = JSON.stringify(['development', 'https://export.invalid', A]);
describe('copie personnelle : projection de confidentialité', () => {
  it('conserve les dix tables, dates microsecondes, null, false, erreurs et tentatives distinctes', () => {
    const raw = serverRows(A, 2), server = {};
    for (const [table, rows] of Object.entries(raw)) server[table] = rows.map(row => projectRow(table, { ...row, access_token: 'NO_EXPORT' }, A));
    const file = envelope({ kind: 'account', userId: A }, { server }, [{ source: 'server', status: 'included' }], stamp);
    const parsed = JSON.parse(serializeExport(file));
    expect(Object.keys(parsed.data.server)).toHaveLength(10);
    expect(parsed.data.server.course_states[0]).toMatchObject({ done: false, legacy_score: 0 });
    expect(parsed.data.server.appearance_preferences[0]).toMatchObject({ season: 'auto', client_updated_at: null });
    expect(parsed.data.server.quiz_attempts).toHaveLength(2);
    expect(parsed.data.server.botanical_answers[0]).toMatchObject({ correct: false, elapsed_ms: 0, selected_species_id: null });
    expect(parsed.data.server.quiz_attempts[0].completed_at).toBe(stamp);
    expect(serializeExport(file)).not.toContain('NO_EXPORT');
  });
  it('refuse une ligne étrangère même si le serveur la renvoie', () => {
    expect(() => projectRow('quiz_attempts', serverRows(B).quiz_attempts[0], A)).toThrow('ownership');
  });
  it('lit le vrai format Drill, brouillons/entraînements, outbox et conflit sans secret arbitraire', () => {
    const doc = emptyPersonalDocument(scope);
    personalChange(doc, 'ensureSeries', ['uc3', '2026-W43', questions, stamp], () => uuid(1));
    // Source fixture uses the actual persistence model; drafts don't queue RPCs.
    personalChange(doc, 'saveDraft', ['uc3__2026-W43', questions[0].id, 'a']);
    doc.conflicts.push({ id: 'snapshot:1', kind: 'snapshot', seriesKey: 'uc3__2026-W43', local: doc.drill.series['uc3__2026-W43'], remoteSeries: doc.drill.series['uc3__2026-W43'], resolved: true, secret: 'NO_EXPORT' });
    const before = structuredClone(doc), result = projectLocal('drill', doc, scope);
    expect(result.data.drill.series['uc3__2026-W43'].drafts[questions[0].id]).toBe('a');
    expect(result.data.operations).toHaveLength(1);
    expect(result.data.conflicts[0].resolved).toBe(true);
    expect(JSON.stringify(result)).not.toContain('NO_EXPORT'); expect(doc).toEqual(before);
  });
  it('inclut les intentions de cours et leur provenance mais exclut raw, champs inconnus et diagnostics libres', () => {
    const doc = courses(scope); mutateCourse(doc, 'matiere-organique', false, () => uuid(5));
    doc.imports.push({ id: uuid(8), provenance: uuid(9), raw: JSON.stringify({ user_id: B, password: 'NO_EXPORT' }), attemptIds: { '[0]': uuid(10) }, operationIds: [uuid(5)], warnings: ['NO_EXPORT'] });
    const result = projectLocal('courses', doc, scope);
    expect(result.data.operations[0].payload.p_done).toBe(false);
    expect(result.data.imports[0]).toMatchObject({ provenance: uuid(9), attemptIds: { '[0]': uuid(10) } });
    expect(result.omitted).toBeGreaterThan(0); expect(JSON.stringify(result)).not.toContain('NO_EXPORT');
  });
  it('couvre archives de paramètres et refus botaniques sans diffuser une archive non attribuable', () => {
    const doc = emptySettingsDocument(scope); queueSettings(doc, 'appearance', { version: 1, season: 'auto', brightness: 'auto' }, () => uuid(7));
    doc.archives.push({ kind: 'confirmed', operation: doc.operations[0] });
    expect(projectLocal('settings', doc, scope).data.archives[0].operation.payload.p_preferences.season).toBe('auto');
    const plants = botanical(scope); plants.importArchives.push({ raw: 'NO_EXPORT' });
    expect(projectLocal('botanical', plants, scope).omitted).toBe(1);
  });
  it('refuse portée étrangère, formats futurs et lignes étrangères dans le cache', () => {
    const doc = courses(scope);
    expect(() => projectLocal('courses', doc, scope.replace(A, B))).toThrow('ownership');
    expect(() => projectLocal('courses', { ...doc, version: 2 }, scope)).toThrow('future');
    doc.remote.courses = serverRows(B).course_states;
    expect(() => projectLocal('courses', doc, scope)).toThrow('ownership');
  });
  it('sépare visiteur, archives exclues et formats inconnus sans altérer la source', () => {
    const doc = { lesson: { done: false, score: 0, quizAttempts: [{ score: 0, total: 2, completedAt: stamp }], quizScoreArchive: ['NO_EXPORT'] } };
    expect(projectVisitor('courses', doc).data.lesson).toMatchObject({ done: false, score: 0 });
    expect(projectVisitor('courses', doc).omitted).toBe(1);
    expect(() => projectVisitor('appearance', { version: 8 })).toThrow('future');
    expect(() => projectVisitor('legacyTheme', 'NO_EXPORT')).toThrow('invalid');
    expect(() => serializeExport({ exportFormatVersion: 2 })).toThrow('invalid');
  });
});
