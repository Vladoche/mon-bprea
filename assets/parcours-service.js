import { createScopedRepository } from './personal-idb.js';
import { personalScope } from './drill-personal-store.js';
import { emptyParcours, validateParcours } from './parcours-model.js';

import { PARCOURS_DB, PARCOURS_TABLE, parcoursColumns } from './export-sources.js';

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const revision = value => Number.isSafeInteger(value) && value >= 0;
const problem = code => Object.assign(new Error(code), { code });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const emptyParcoursDocument = scope => ({ version: 1, scope, observed: false, remote: null, draft: null });

export function parcoursRow(row, user) {
  if (!row || row.user_id !== user || !uuid.test(row.operation_id) ||
      !revision(row.revision) || row.revision === 0 || !Number.isFinite(Date.parse(row.updated_at))) throw problem('invalid');
  const { user_id, operation_id, revision: current, updated_at } = row;
  return { user_id, preferences: validateParcours(row.preferences), operation_id, revision: current, updated_at };
}

export function validateParcoursDocument(doc, scope) {
  if (doc?.version !== 1) throw problem('future');
  if (doc.scope !== scope) throw problem('ownership');
  if (typeof doc.observed !== 'boolean' || (!doc.observed && doc.remote !== null)) throw problem('invalid');
  const remote = doc.remote === null ? null : parcoursRow(doc.remote, JSON.parse(scope)[2]);
  let draft = null;
  if (doc.draft !== null) {
    const { token, base, requested, value } = doc.draft || {};
    if (typeof token !== 'string' || !uuid.test(token) || (base !== null && !revision(base)) ||
        typeof requested !== 'boolean') throw problem('invalid');
    draft = { token, base, requested, value: validateParcours(value) };
  }
  return { version: 1, scope, observed: doc.observed, remote, draft };
}

export function createParcoursRepository(scope, options) {
  return createScopedRepository(scope, { ...options, databaseName: PARCOURS_DB,
    empty: emptyParcoursDocument, validate: validateParcoursDocument });
}

// Reusable by the calendar, with the same ownership check as the editor.
export function createParcoursTransport(client, auth, userId, { signal, active }) {
  async function checked(build) {
    if (!active()) throw problem('session_changed');
    const verified = await auth.verifiedSession(userId);
    if (!active() || verified.userId !== userId || !verified.accessToken) throw problem('session_changed');
    const timeout = AbortSignal.timeout(15000);
    const result = await build().retry(false).setHeader('Authorization', `Bearer ${verified.accessToken}`)
      .abortSignal(signal ? AbortSignal.any([timeout, signal]) : timeout);
    if (!active()) throw problem('session_changed');
    if (result.error) throw result.error;
    return result.data;
  }
  return {
    async read() {
      const rows = await checked(() => client.from(PARCOURS_TABLE).select(parcoursColumns).eq('user_id', userId).limit(2));
      if (!Array.isArray(rows) || rows.length > 1) throw problem('invalid');
      return rows.length ? parcoursRow(rows[0], userId) : null;
    },
    async save(draft, base) {
      const data = await checked(() => client.rpc('personal_save_parcours', {
        p_user_id: userId, p_preferences: draft.value, p_operation_id: draft.token, p_expected_revision: base,
      }));
      if (!['saved', 'conflict'].includes(data?.status)) throw problem('invalid');
      const row = data.row === null ? null : parcoursRow(data.row, userId);
      if (data.status === 'saved' && (row?.operation_id !== draft.token || row.revision !== base + 1 ||
          !same(row.preferences, draft.value))) throw problem('invalid');
      return { status: data.status, row };
    },
  };
}

export function createParcoursSession(configuration, auth, userId, options) {
  const scope = personalScope({ ...configuration, userId });
  const repository = createParcoursRepository(scope);
  const transport = createParcoursTransport(configuration.client, auth, userId, options);
  const { active } = options;
  const read = () => repository.read();
  function change(edit) {
    return repository.change(doc => { edit(doc); return doc; }, active);
  }
  function expectDraft(doc, token) {
    if ((doc.draft?.token ?? null) !== token) throw problem('local_conflict');
  }
  function reconcile(doc, row) {
    if (doc.remote && (!row || row.revision < doc.remote.revision)) return;
    doc.observed = true;
    doc.remote = row;
    if (doc.draft?.requested && row?.operation_id === doc.draft.token && same(row.preferences, doc.draft.value)) doc.draft = null;
  }
  return {
    read,
    close: () => repository.close(),
    async refresh() {
      const remote = await transport.read();
      return change(doc => reconcile(doc, remote));
    },
    edit(token, base, value) {
      const preferences = validateParcours(value);
      return change(doc => {
        expectDraft(doc, token);
        const matchesSaved = same(doc.remote?.preferences ?? emptyParcours(), preferences);
        doc.draft = matchesSaved && (!doc.draft?.requested || same(doc.draft.value, preferences)) ? null
          : { token: crypto.randomUUID(), base, requested: false, value: preferences };
      });
    },
    reset(token) {
      return change(doc => { expectDraft(doc, token); doc.draft = null; });
    },
    async request(token, rebase = false) {
      return change(doc => {
        expectDraft(doc, token);
        if (!doc.draft) return;
        if (rebase || !doc.draft.requested) doc.draft.token = crypto.randomUUID();
        if (rebase) doc.draft.base = doc.remote?.revision ?? 0;
        doc.draft.requested = true;
      });
    },
    async sync(doc) {
      let pending = doc.draft;
      if (!pending?.requested) return { doc, status: 'idle' };
      // Read before the first write when the draft has no verified starting revision.
      if (!doc.observed) {
        doc = await this.refresh();
        if (doc.draft?.token !== pending.token) return { doc, status: 'idle' };
        pending = doc.draft;
      }
      if (pending.base === null && doc.remote) return { doc, status: 'conflict' };
      const response = await transport.save(pending, pending.base ?? 0);
      doc = await change(next => {
        // A response from one tab must never remove a newer draft from another.
        if (response.row || next.remote?.revision === pending.base) reconcile(next, response.row);
      });
      return { doc, status: response.status };
    },
  };
}

export function parcoursConflict(doc) {
  return Boolean(doc?.draft && doc.observed &&
    doc.draft.base !== (doc.remote?.revision ?? 0) &&
    (doc.draft.base !== null || doc.remote));
}
