import { it, expect } from 'vitest';
import { parseRestore, readRestoreFile, authorizeRestore } from '../../assets/restore-model.js';
import { planRestore } from '../../assets/restore-plan.js';
import { emptyPersonalDocument, enqueueImportedQuiz, mutateCourse } from '../../assets/course-quiz-model.js';
import { emptySettingsDocument, queueSettings } from '../../assets/settings-model.js';
import { emptyPersonalDocument as emptyBotanical, recordPersonalSession } from '../../assets/botanical-sync-model.js';
import { emptyPersonalDocument as emptyDrill, personalChange } from '../../assets/drill-personal-store.js';
import { archive, selectedFile, config, scope, A, B, stamp, uuid, emptyCurrent, restoreRows, questions, emptyServer } from '../fixtures/restore.js';
const parse = value => parseRestore(JSON.stringify(value));
const plan = (file, current = emptyCurrent()) => planRestore(parse(file), current, { scope, userId: A, at: stamp });

it('comprend le véritable format export v1 partiel sans changer le format', () => {
  const file = archive(); expect(parse(file)).toEqual(file); expect(file.status).toBe('partial');
  expect(authorizeRestore(file, config, { id: A })).toBe(scope);
});
it('borne le fichier AVANT sa lecture et refuse JSON invalide et profondeur excessive', async () => {
  let read = false;
  await expect(readRestoreFile({ size: 20 * 1024 * 1024 + 1, text() { read = true; } })).rejects.toMatchObject({ code: 'volume' }); expect(read).toBe(false);
  expect(() => parseRestore('{not-json')).toThrow('json');
  const file = archive(); let nested = file.data; for (let i = 0; i < 32; i++) nested = nested.child = {};
  expect(() => parse(file)).toThrow('volume');
});
for (const [label, change] of [
  ['version future', f => { f.exportFormatVersion = 2; }],
  ['racine incorrecte', f => { f.data = []; }],
  ['champ manquant', f => { delete f.generatedAt; }],
  ['tableau incorrect', f => { f.data.server.quiz_attempts = {}; }],
  ['type incorrect', f => { f.data.server.course_states[0].done = 'false'; }],
  ['date civile invalide', f => { f.data.server.quiz_attempts[0].completed_at = '2026-02-30T10:00:00Z'; }],
  ['date de génération nulle', f => { f.generatedAt = null; }],
  ['UUID invalide', f => { f.data.server.quiz_attempts[0].attempt_id = 'not-an-uuid'; }],
  ['doublon', f => { f.data.server.quiz_attempts[1] = structuredClone(f.data.server.quiz_attempts[0]); }],
  ['orphelin Drill', f => { f.data.server.drill_answers[0].series_id = uuid(900); }],
  ['orphelin botanique', f => { f.data.server.botanical_answers[0].session_id = 'absent'; }],
  ['valeur hors contrat', f => { f.data.server.appearance_preferences[0].season = 'computed-autumn'; }],
  ['tiers dans les lignes', f => { f.data.server.quiz_attempts[0].user_id = B; }],
  ['source absente annoncée récupérable', f => { f.coverage.find(c => c.source === 'quiz_attempts').status = 'absent'; }],
  ['compteur faux', f => { f.coverage[0].count = 300; }],
  ['secret hors contrat', f => { f.data.identity.access_token = 'synthetic-never-import'; }],
  ['archive inconnue', f => { f.data.personalLocal.futureArchive = {}; }],
]) it(`refuse sans parser permissif : ${label}`, () => { const file = archive(); change(file); expect(() => parse(file)).toThrow(); });

it('refuse la pollution structurelle, accepte constructor comme identité métier propre', () => {
  const text = JSON.stringify(archive()).replace('"application":"Mon BPREA"', '"application":"Mon BPREA","__proto__":{"polluted":true}');
  expect(() => parseRestore(text)).toThrow(); expect({}.polluted).toBeUndefined();
  const rows = emptyServer(); rows.course_states = [{ ...restoreRows().course_states[0], lesson_id: 'constructor' }];
  const p = plan(archive(rows)); expect(p.summary.total.recoverable).toBe(1);
  expect(Object.hasOwn(p.domains.courses.document.courses, 'constructor')).toBe(true); expect({}.done).toBeUndefined();
});
it('refuse aussi les clés JSON dupliquées avant que JSON.parse ne les masque', () => {
  expect(() => parseRestore(JSON.stringify(archive()).replace('"exportFormatVersion":1', '"exportFormatVersion":2,"exportFormatVersion":1'))).toThrow('duplicate');
  const f = archive(); f.warnings = ['Une chaîne avec {"id":1,"id":2} reste un simple texte.']; expect(parse(f)).toEqual(f);
});
it('refuse copie appareil, autre UUID/environnement/projet et identité supprimée', () => {
  const f = archive(); f.sourceScope = { kind: 'device', ownership: 'unverified' }; expect(() => parse(f)).toThrow('unattributed');
  for (const [configuration, identity] of [[config, { id: B }], [{ ...config, environment: 'production' }, { id: A }], [{ ...config, url: 'https://other.invalid' }, { id: A }], [config, null]]) {
    expect(() => authorizeRestore(archive(), configuration, identity)).toThrow();
  }
});
it('sources absentes, exclues et illisibles restent distinctes, partial reste analysable', () => {
  const f = archive(emptyServer()); delete f.data.server.quiz_attempts;
  f.coverage.find(c => c.source === 'quiz_attempts').status = 'unavailable';
  expect(parse(f).coverage.find(c => c.source === 'quiz_attempts').status).toBe('unavailable');
  expect(plan(f).summary.total.recoverable).toBe(0);
});
it('garde deux UUID de même score/date et planifie les créations sûres sans inventer les révisions', () => {
  const f = archive(); const p = plan(f);
  expect(p.domains.courses.actions.filter(a => a.type === 'queue' && a.candidate.name === 'quiz_attempts')).toHaveLength(2);
  expect(Object.keys(p.domains.courses.document.attempts)).toHaveLength(2);
  expect(p.items.some(item => item.reason === 'series_uuid')).toBe(true);
  expect(p.items.some(item => item.reason === 'parent')).toBe(true);
  const older = archive(); older.data.server.course_states[0].base_revision = 4; older.data.server.course_states[0].revision = 5;
  expect(plan(older).items.some(item => item.group === 'courses' && item.reason === 'revision')).toBe(true);
});
it('ne compte pas server, remote et outbox acquittée comme trois tentatives', () => {
  const server = emptyServer(); server.quiz_attempts = restoreRows().quiz_attempts;
  const doc = emptyPersonalDocument(scope); for (const row of server.quiz_attempts) enqueueImportedQuiz(doc, row.lesson_id, { score: row.score, total: row.total, completedAt: row.completed_at }, row.attempt_id);
  const f = archive(server, { courses: doc });
  expect(plan(f).summary.groups.quiz.recoverable).toBe(2);
  const current = emptyCurrent(server); expect(plan(f, current).summary.groups.quiz.recoverable).toBe(2); // cache recovery only
});
it('restaure une intention QCM non confirmée avec le même UUID, sans relancer les conflits', () => {
  const doc = emptyPersonalDocument(scope); enqueueImportedQuiz(doc, 'lesson', { score: 0, total: 3, completedAt: stamp }, uuid(810));
  mutateCourse(doc, 'other', false, () => uuid(811)); doc.operations[1].state = 'blocked';
  const p = plan(archive(emptyServer(), { courses: doc }));
  expect(p.domains.courses.actions.find(a => a.type === 'queue').id).toBe(uuid(810));
  expect(p.items.some(i => i.reason === 'suspended_operation')).toBe(true);
});
it('conserve done:false et les préférences actuelles divergentes, sans dernier fichier gagnant', () => {
  const live = restoreRows(), f = archive(); f.data.server.course_states[0].done = true; f.data.server.appearance_preferences[0].brightness = 'dark';
  const p = plan(f, emptyCurrent(live)); expect(p.summary.groups.courses.conflict).toBe(1); expect(p.summary.groups.appearance.conflict).toBe(1);
  expect(live.course_states[0].done).toBe(false); expect(live.appearance_preferences[0].brightness).toBe('auto');
});
it('trace privacy même rouverte : aucun complément ou historique réintroduit', () => {
  for (const blocked of [true, false]) {
    const c = emptyCurrent(restoreRows()); c.local.courses.privacy = { version: 1, epoch: uuid(800), blocked };
    const p = plan(archive(), c); expect(p.summary.groups.quiz.recoverable).toBe(0); expect(p.summary.groups.quiz.blocked).toBe(2);
  }
});
it('réseau absent ne devient pas serveur vide', () => {
  const p = plan(archive(), emptyCurrent(null)); expect(p.summary.total.recoverable).toBe(0); expect(p.items.some(i => i.reason === 'server_unavailable')).toBe(true);
});
it('brouillons compatibles seulement, aucun remplacement de choix ou de marqueur consommé', () => {
  const d = emptyDrill(scope); personalChange(d, 'ensureSeries', ['uc3', '2026-W43', questions, stamp], () => uuid(700));
  personalChange(d, 'saveDraft', ['uc3__2026-W43', questions[1].id, 'a']);
  const p = plan(archive(restoreRows(), { drill: d }), emptyCurrent(restoreRows()));
  expect(p.domains.drill.actions.some(a => a.type === 'draft')).toBe(true);
  expect(p.summary.groups.local.recoverable).toBe(1);
});
it('valide les huit paramètres, auto et les intentions sans dépendance de base zéro', () => {
  const d = emptySettingsDocument(scope); queueSettings(d, 'appearance', { version: 1, season: 'auto', brightness: 'auto' }, () => uuid(850));
  const p = plan(archive(emptyServer(), { settings: d }));
  expect(p.domains.settings.document.operations[0].id).toBe(uuid(850)); expect(p.domains.settings.document.values.appearance.season).toBe('auto');
  const invalid = archive(emptyServer(), { settings: d }); invalid.data.personalLocal.settings.operations[0].expectedRevision = 3; expect(() => parse(invalid)).toThrow();
});
it('les intentions exportées gardent exactement les dates et null de leurs payloads de retry', () => {
  const botanical = emptyBotanical(scope), settings = emptySettingsDocument(scope);
  recordPersonalSession(botanical, { id: 'session-payload', categoryId: 'petits-fruits', mode: 'chrono', durationSeconds: 30, revision: false,
    startedAt: '2026-10-21T12:00:00.000Z', totalQuestions: 4, completedAt: null }, () => uuid(860));
  queueSettings(settings, 'appearance', { version: 1, season: 'auto', brightness: 'auto', updatedAt: null }, () => uuid(861));
  const p = plan(archive(emptyServer(), { botanical, settings }));
  expect(p.domains.botanical.document.operations[0].rpcPayload).toEqual(botanical.operations[0].rpcPayload);
  expect(p.domains.settings.document.operations[0].rpcPayload).toEqual(settings.operations[0].rpcPayload);
});
it('une intention Drill ne peut pas être rattachée au snapshot SQL différent de son snapshot local', () => {
  const d = emptyDrill(scope); personalChange(d, 'ensureSeries', ['uc3', '2026-W43', questions, stamp], () => uuid(870));
  personalChange(d, 'submitAnswer', ['uc3__2026-W43', questions[1].id, questions[1].answer, { nowISO: stamp }], () => uuid(871));
  d.drill.series['uc3__2026-W43'].questions[1].prompt += ' ancien contexte'; d.operations[0].payload.p_questions[1].prompt += ' ancien contexte';
  const p = plan(archive(restoreRows(), { drill: d }), emptyCurrent(restoreRows()));
  expect(p.domains.drill.actions.some(action => action.id === uuid(871))).toBe(false);
  expect(p.items.some(item => item.group === 'drill' && item.reason === 'parent')).toBe(true);
});
