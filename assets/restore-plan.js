import { TABLES, CACHES } from './export-sources.js';
import { adapters, tableDomain, tableGroup, rowKey, sameEntity, cachedRow, projection, hydrate, queueCandidate, rowFromOperation, ensurePreserved } from './restore-adapters.js';
import { canonical, failRestore } from './restore-model.js';
import { snapshotMatches } from './drill-sync-model.js';
import { sameSession, fromSessionRow } from './botanical-sync-model.js';

const localTables = {
  drill: { series: 'drill_series', answers: 'drill_answers', training: 'drill_training_attempts' },
  courses: { courses: 'course_states', attempts: 'quiz_attempts' }, botanical: { sessions: 'botanical_sessions', answers: 'botanical_answers' },
  settings: { itk: 'itk_settings', appearance: 'appearance_preferences' },
};
const mutable = name => ['course_states', 'botanical_sessions', 'itk_settings', 'appearance_preferences'].includes(name);
export const emptyCounts = () => ({ recoverable: 0, present: 0, local: 0, server: 0, pending: 0, conflict: 0, ignored: 0, blocked: 0 });
export function summarize(items) {
  const groups = Object.fromEntries(['drill', 'courses', 'quiz', 'botanical', 'itk', 'appearance', 'local', 'profile'].map(group => [group, emptyCounts()]));
  const total = emptyCounts();
  for (const item of items) { groups[item.group][item.state]++; total[item.state]++; }
  return { groups, total };
}

function candidates(file) {
  const all = new Map(), extra = [];
  function add(name, row, operation = null, intent = false) {
    const key = `${name}:${rowKey(name, row)}`, old = all.get(key);
    if (old && !sameEntity(name, old.row, row)) {
      if (intent) { extra.push({ name, row, operation }); return; }
      if (!mutable(name) || old.row.revision === row.revision) failRestore('coherence');
      if (old.row.revision > row.revision) return;
    }
    all.set(key, { name, row, operation: operation || old?.operation || null });
  }
  for (const [name, rows] of Object.entries(file.data.server)) for (const row of rows) add(name, row);
  for (const [domain, document] of Object.entries(file.data.personalLocal)) {
    for (const [kind, name] of Object.entries(localTables[domain])) {
      const values = document.remote[kind];
      for (const row of domain === 'settings' ? values ? [values] : [] : values) add(name, row);
    }
    for (const operation of document.operations) {
      if (!['pending', 'confirmed'].includes(operation.state)) continue;
      const item = rowFromOperation(domain, operation, file);
      if (item) add(item.name, item.row, operation, true);
    }
  }
  return [...all.values(), ...extra].sort((a, b) => Object.keys(TABLES).indexOf(a.name) - Object.keys(TABLES).indexOf(b.name));
}

function supplements(file, rows) {
  const items = [];
  const block = reason => items.push({ group: 'local', state: 'blocked', reason });
  for (const [domain, source] of Object.entries(file.data.personalLocal)) {
    for (const name of ['imports', 'conflicts', 'archives', 'excludedArchives']) for (const _ of source[name] || []) block('descriptor');
    for (const op of source.operations) if (!['pending', 'confirmed'].includes(op.state)) block('suspended_operation');
    if (domain === 'drill') for (const series of Object.values(source.drill.series)) {
      if (!rows.some(item => item.name === 'drill_series' && item.row.series_key === series.id)) block('missing_series_identity');
      for (const [questionId, answer] of Object.entries(series.answers)) {
        const matches = name => rows.filter(item => item.name === name && item.row.question_id === questionId &&
          (item.operation?.seriesKey === series.id || [...(file.data.server.drill_series || []), ...source.remote.series].some(row => row.id === item.row.series_id && row.series_key === series.id)));
        if (!matches('drill_answers').length) block('missing_operation');
        const count = answer.attempts.filter(item => item.training === true).length;
        for (let i = matches('drill_training_attempts').length; i < count; i++) block('missing_operation');
      }
    }
    if (domain === 'courses') for (const lessonId of Object.keys(source.courses)) {
      if (!rows.some(item => item.name === 'course_states' && item.row.lesson_id === lessonId)) block('missing_operation');
    }
    if (domain === 'settings') for (const name of ['itk', 'appearance']) if (source.values[name] !== null && !rows.some(item => item.name === `${name === 'itk' ? 'itk_settings' : 'appearance_preferences'}`)) block('missing_operation');
  }
  return items;
}

/** Pure planning: clones only, no repository, network or notification. */
export function planRestore(file, current, { scope, userId, at }) {
  const rows = candidates(file), items = supplements(file, rows), domains = {};
  for (const [domain, adapter] of Object.entries(adapters)) {
    const snapshot = current.local[domain];
    let document, reason = snapshot?.status !== 'available' ? 'local_unavailable' : snapshot.privacy !== null ? 'privacy' : null;
    if (!reason) try { document = structuredClone(snapshot.document || adapter.empty(scope)); adapter.validate(document, scope); } catch { reason = 'local_invalid'; }
    domains[domain] = { document, reason, actions: [], hasCurrentIntents: document?.operations.some(op => op.state !== 'confirmed'), expected: canonical(snapshot?.document ?? null) };
  }
  for (const candidate of rows) {
    const { name, row } = candidate, domain = tableDomain(name), group = tableGroup(name);
    const item = { group, state: 'blocked', reason: 'backend' }; items.push(item);
    if (!domain) { item.state = 'ignored'; item.reason = 'identity_only'; continue; }
    const target = domains[domain];
    if (target.reason) { item.reason = target.reason; continue; }
    if (current.server === null) { item.reason = 'server_unavailable'; continue; }
    if (candidate.operation && domain === 'drill') {
      const savedSeries = file.data.personalLocal.drill?.drill.series[candidate.operation.seriesKey];
      const savedParent = rows.find(value => value.name === 'drill_series' && value.row.id === row.series_id)?.row;
      if (!savedSeries || !savedParent || !snapshotMatches(savedSeries, savedParent)) { item.reason = 'parent'; continue; }
    }
    if (candidate.operation && name === 'botanical_answers') {
      const savedSession = file.data.personalLocal.botanical?.sessions[row.session_id];
      const savedParent = rows.find(value => value.name === 'botanical_sessions' && value.row.session_id === row.session_id)?.row;
      if (!savedSession || !savedParent || !sameSession(savedSession, fromSessionRow(savedParent))) { item.reason = 'parent'; continue; }
    }
    const live = current.server[name].find(value => rowKey(name, value) === rowKey(name, row));
    const local = cachedRow(target.document, name, row), projected = projection(target.document, name, row);
    if (live && !sameEntity(name, live, row) || local && !sameEntity(name, local, row) || projected === 'conflict') {
      item.state = 'conflict'; item.reason = 'divergent'; continue;
    }
    if (live && local && projected === 'same') { item.state = 'present'; item.reason = 'present'; continue; }
    if (target.hasCurrentIntents) { item.reason = 'current_intents'; continue; }
    const before = structuredClone(target.document);
    const actionCount = target.actions.length;
    try {
      if (live) {
        hydrate(target.document, name, live, current.server, userId, at);
        target.actions.push({ type: 'hydrate', name, row: live, item });
        item.reason = 'cache';
      } else {
        if (local || projected !== 'absent') failRestore('current_local');
        if (name === 'drill_series') failRestore('series_uuid');
        if (mutable(name) && (row.base_revision !== 0 || row.revision !== 1 || name === 'botanical_sessions' && row.completed_at !== null)) failRestore('revision');
        if (candidate.operation?.dependsOn && (Array.isArray(candidate.operation.dependsOn) ? candidate.operation.dependsOn.length : true)) failRestore('dependency');
        if (name.startsWith('drill_')) {
          const parent = current.server.drill_series.find(value => value.id === row.series_id);
          const savedParent = rows.find(value => value.name === 'drill_series' && value.row.id === row.series_id);
          if (!parent || !savedParent || !sameEntity('drill_series', parent, savedParent.row)) failRestore('parent');
          hydrate(target.document, 'drill_series', parent, current.server, userId, at);
          if (name === 'drill_training_attempts') {
            const first = current.server.drill_answers.find(value => value.series_id === row.series_id && value.question_id === row.question_id);
            if (!first) failRestore('parent');
            hydrate(target.document, 'drill_answers', first, current.server, userId, at);
          }
        }
        if (name === 'botanical_answers') {
          const parent = current.server.botanical_sessions.find(value => value.session_id === row.session_id);
          const savedParent = rows.find(value => value.name === 'botanical_sessions' && value.row.session_id === row.session_id);
          if (!parent || !savedParent || !sameEntity('botanical_sessions', parent, savedParent.row)) failRestore('parent');
          hydrate(target.document, 'botanical_sessions', parent, current.server, userId, at);
        }
        const id = queueCandidate(target.document, candidate, current.server);
        target.actions.push({ type: 'queue', candidate, id, item });
        item.reason = 'insert';
      }
      adapters[domain].validate(target.document, scope);
      ensurePreserved(before, target.document, domain);
      item.state = 'recoverable';
    } catch (error) { target.document = before; target.actions.length = actionCount; item.reason = ['series_uuid', 'revision', 'parent', 'missing_operation', 'dependency', 'current_local'].includes(error.code) ? error.code : 'incompatible'; }
  }
  // Drafts never become operations; only absent keys on an identical, currently
  // existing SQL snapshot can be filled. A consumed draft stays consumed.
  const source = file.data.personalLocal.drill;
  if (source) for (const series of Object.values(source.drill.series)) for (const kind of ['drafts', 'trainingDrafts']) for (const [questionId, value] of Object.entries(series[kind] || {})) {
    const item = { group: 'local', state: 'blocked', reason: 'parent' }; items.push(item);
    const target = domains.drill;
    if (target.reason || current.server === null) { item.reason = target.reason || 'server_unavailable'; continue; }
    const parent = current.server.drill_series.find(row => row.series_key === series.id);
    const local = target.document.drill.series[series.id];
    if (!parent || !local || projection(target.document, 'drill_series', parent) !== 'same' ||
      canonical(series.questions) !== canonical(parent.questions) || series.startedAt !== parent.started_at && Date.parse(series.startedAt) !== Date.parse(parent.started_at)) continue;
    const drafts = local[kind] || {};
    if (Object.hasOwn(drafts, questionId)) { item.state = drafts[questionId] === value ? 'present' : 'conflict'; item.reason = item.state; continue; }
    const answered = current.server.drill_answers.some(row => row.series_id === parent.id && row.question_id === questionId);
    if (value === null || kind === 'drafts' && answered || kind === 'trainingDrafts' && !answered) { item.state = 'ignored'; item.reason = 'consumed'; continue; }
    Object.defineProperty(drafts, questionId, { value, enumerable: true, configurable: true, writable: true }); local[kind] = drafts;
    target.actions.push({ type: 'draft', seriesKey: series.id, kind, questionId, value, item }); item.state = 'recoverable'; item.reason = 'draft';
  }
  for (const [domain, target] of Object.entries(domains)) if (target.document) adapters[domain].validate(target.document, scope);
  return { items, domains, current, scope, userId, at, summary: summarize(items), coverage: file.coverage.map(item => ({ source: item.source, status: item.status })) };
}

export function applyActions(document, actions, server, userId, at) {
  const before = structuredClone(document);
  for (const action of actions) {
    if (action.type === 'hydrate') hydrate(document, action.name, action.row, server, userId, at);
    else if (action.type === 'queue') {
      // Dependencies hydrated while planning must be read from the same live
      // snapshot here; no whole planned document is ever assigned over a record.
      const { name, row } = action.candidate;
      if (name.startsWith('drill_')) {
        const parent = server.drill_series.find(value => value.id === row.series_id);
        hydrate(document, 'drill_series', parent, server, userId, at);
        if (name === 'drill_training_attempts') hydrate(document, 'drill_answers', server.drill_answers.find(value => value.series_id === row.series_id && value.question_id === row.question_id), server, userId, at);
      }
      if (name === 'botanical_answers') hydrate(document, 'botanical_sessions', server.botanical_sessions.find(value => value.session_id === row.session_id), server, userId, at);
      if (queueCandidate(document, action.candidate, server) !== action.id) failRestore('changed');
    } else {
      const drafts = document.drill.series[action.seriesKey][action.kind] ||= {};
      if (Object.hasOwn(drafts, action.questionId)) failRestore('changed');
      Object.defineProperty(drafts, action.questionId, { value: action.value, enumerable: true, configurable: true, writable: true });
    }
  }
  const first = actions.find(action => action.name || action.candidate);
  if (actions.length) ensurePreserved(before, document, first ? tableDomain(first.name || first.candidate.name) : 'drill');
}
