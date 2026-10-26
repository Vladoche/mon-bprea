import { classifySyncError } from './sync-runtime.js';

const rpcNames = { session: 'personal_save_botanical_session', completion: 'personal_save_botanical_session', answer: 'personal_record_botanical_answer' };
const columns = {
  sessions: 'user_id,session_id,category_id,mode,duration_seconds,is_revision,started_at,total_questions,completed_at,operation_id,base_revision,revision,schema_version,created_at,updated_at',
  answers: 'user_id,answer_id,session_id,question_id,category_id,species_id,photo_id,mode,is_revision,status,selected_species_id,correct,elapsed_ms,answered_at,schema_version,created_at',
};
const protocol = () => Object.assign(new Error('La réponse de synchronisation botanique est incohérente. Les données sont conservées.'), { code: 'protocol' });
const changed = () => Object.assign(new Error('Le compte a changé.'), { code: 'session_changed' });
const quoted = value => `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;

export function classifyBotanicalError(error) {
  if (error?.status === 403 || error?.code === '42501') return { kind: 'session', code: 'session', message: 'L’accès personnel est suspendu. Reconnecte-toi au même compte pour synchroniser ; les résultats sont conservés.' };
  if (['PGRST202', 'PGRST205', '42P01', '42883'].includes(error?.code)) return { kind: 'permanent', code: error.code,
    message: 'Le stockage du compte pour la botanique n’est pas disponible. Les résultats restent sur cet appareil ; contacte la personne qui gère le site.' };
  if (['22007', '22008'].includes(error?.code)) return classifySyncError({ code: '23514' });
  return classifySyncError(error);
}

// Keep the full PostgreSQL microsecond position rather than rounding a cursor.
function instant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(value)) throw protocol();
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw protocol();
  const fraction = value.match(/\.(\d+)/)?.[1] || '';
  return BigInt(milliseconds) * 1000n + BigInt(fraction.padEnd(6, '0').slice(3, 6));
}

/** Shared SDK, fixed verified JWT for each individual request, never a global
 * mutable Authorization header that might change while an account switches. */
export function createBotanicalTransport(client, auth, userId) {
  async function checked(build, { signal, active = () => true } = {}) {
    if (!active()) throw changed();
    const verified = await auth.verifiedSession(userId);
    if (!active() || verified.userId !== userId || !verified.accessToken) throw changed();
    const query = build();
    const timeout = AbortSignal.timeout(15000);
    const result = await query.retry(false).setHeader('Authorization', `Bearer ${verified.accessToken}`)
      .abortSignal(signal ? AbortSignal.any([signal, timeout]) : timeout);
    if (!active()) throw changed();
    if (result.error) throw result.error;
    return result.data;
  }
  return {
    async send(operation, options) {
      const name = rpcNames[operation.type];
      if (!name || !operation.rpcPayload) throw protocol();
      return checked(() => client.rpc(name, operation.rpcPayload), options);
    },
    async readHistory(options) {
      const history = { sessions: [], answers: [] };
      for (const kind of ['sessions', 'answers']) {
        let cursor = null; const seen = new Set();
        for (let page = 0; ; page++) {
          if (page >= 10000) throw protocol();
          const rows = await checked(() => {
            let query = client.from(kind === 'sessions' ? 'botanical_sessions' : 'botanical_answers')
              .select(columns[kind]).eq('user_id', userId).limit(100);
            if (kind === 'sessions') {
              query = query.order('session_id', { ascending: true });
              if (cursor) query = query.gt('session_id', cursor.session_id);
            } else {
              query = query.order('created_at', { ascending: true }).order('answer_id', { ascending: true });
              if (cursor) query = query.or(`created_at.gt.${quoted(cursor.created_at)},and(created_at.eq.${quoted(cursor.created_at)},answer_id.gt.${quoted(cursor.answer_id)})`);
            }
            return query;
          }, options);
          if (!Array.isArray(rows)) throw protocol();
          if (!rows.length) break;
          for (const row of rows) {
            const id = kind === 'sessions' ? row?.session_id : row?.answer_id;
            if (row?.user_id !== userId || typeof id !== 'string' || !id.length || seen.has(id)) throw protocol();
            if (kind === 'answers') {
              const time = instant(row.created_at);
              // SQL text collation determines ordering for equal timestamps.
              // Do not impose JavaScript UTF-16 order on historical text IDs.
              if (cursor && time < instant(cursor.created_at)) throw protocol();
            }
            seen.add(id); history[kind].push(row); cursor = row;
          }
        }
      }
      return history; // BOTH scans must succeed before any cache transaction.
    },
  };
}
