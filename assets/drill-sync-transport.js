import { DrillSyncError } from './drill-sync-model.js';
import { uuidPattern } from './drill-personal-store.js';

const names = { series: 'drill_create_series', answer: 'drill_record_answer', training: 'drill_record_training' };
const tables = { series: 'drill_series', answers: 'drill_answers', training: 'drill_training_attempts' };
const fields = {
  series: 'id,user_id,unit,week,series_key,started_at,questions,schema_version,created_at',
  answers: 'user_id,operation_id,series_id,question_id,answer,correct,answered_at,created_at',
  training: 'user_id,operation_id,series_id,question_id,answer,correct,answered_at,created_at',
};

export function classifySyncError(error) {
  const code = error?.code;
  if (['invalid_session', 'session_changed', 'PGRST301', 'PGRST302', 'PGRST303'].includes(code) || error?.status === 401) return { kind: 'session', code: 'session', message: 'Reconnecte-toi au même compte pour synchroniser. Les réponses restent sur cet appareil.' };
  if (['42501', '23514', '23503', '23505', '23502', '22P02', 'protocol'].includes(code)) return { kind: 'permanent', code, message: 'Une opération ne peut pas être synchronisée. Ses données sont conservées ; vérifie les détails ou contacte la personne qui gère le site.' };
  return { kind: 'transient', code: code === '40001' ? '40001' : 'network', message: 'En attente de connexion. Les réponses sont enregistrées sur cet appareil.' };
}

/** Shared SDK, but a verified JWT pinned to EVERY request. A switch to B can
 * never cause an operation captured for A to be sent with B's new SDK session. */
export function createDrillTransport(client, auth, userId) {
  async function session(active) {
    const verified = await auth.verifiedSession(userId);
    if (!active() || verified.userId !== userId) throw new DrillSyncError('session_changed');
    return verified;
  }
  async function checked(query, token, signal, active) {
    if (!active()) throw new DrillSyncError('session_changed');
    const timeout = AbortSignal.timeout(15000);
    const bounded = signal ? AbortSignal.any([signal, timeout]) : timeout;
    const result = await query.setHeader('Authorization', `Bearer ${token}`).abortSignal(bounded);
    if (!active()) throw new DrillSyncError('session_changed');
    if (result.error) throw result.error;
    return result.data;
  }
  return {
    async send(operation, { signal, active }) {
      const verified = await session(active);
      return checked(client.rpc(names[operation.type], operation.rpcPayload), verified.accessToken, signal, active);
    },
    async readHistory({ signal, active }) {
      const verified = await session(active);
      const history = { series: [], answers: [], training: [] };
      for (const kind of Object.keys(tables)) {
        const column = kind === 'series' ? 'id' : 'operation_id';
        let cursor = null;
        // Full keyset scans: late historical answers are included on the next
        // scan. Continue to an EMPTY page, even if the server caps page size.
        for (let page = 0; ; page++) {
          if (page >= 10000) throw new DrillSyncError('protocol', 'L’historique dépasse la limite de lecture de cette version. Le cache précédent est conservé.');
          let query = client.from(tables[kind]).select(fields[kind]).eq('user_id', userId).order(column, { ascending: true }).limit(200);
          if (cursor) query = query.gt(column, cursor);
          const rows = await checked(query, verified.accessToken, signal, active);
          if (!Array.isArray(rows)) throw new DrillSyncError('protocol');
          if (!rows.length) break;
          for (const row of rows) {
            if (row.user_id !== userId || !uuidPattern.test(row[column]) || cursor && row[column] <= cursor) throw new DrillSyncError('protocol');
            cursor = row[column]; history[kind].push(row);
          }
        }
      }
      return history;
    },
  };
}
