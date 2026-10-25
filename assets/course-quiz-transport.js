import { classifySyncError } from './sync-runtime.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const rpcNames = { course: 'personal_save_course', quiz: 'personal_record_quiz' };
const columns = {
  courses: 'user_id,lesson_id,done,best_score,legacy_score,legacy_total,operation_id,base_revision,revision,schema_version,created_at,updated_at',
  attempts: 'user_id,attempt_id,lesson_id,score,total,completed_at,schema_version,created_at',
};
const protocol = () => Object.assign(new Error('La réponse de synchronisation est incohérente. Le cache et les opérations sont conservés.'), { code: 'protocol' });
const changed = () => Object.assign(new Error('Le compte a changé.'), { code: 'session_changed' });

export function classifyCourseQuizError(error) {
  if (error?.status === 403 || error?.code === '42501') return { kind: 'session', code: 'session', message: 'L’accès personnel est suspendu. Reconnecte-toi au même compte pour synchroniser ; les données sont conservées.' };
  if (['PGRST202', 'PGRST205', '42P01', '42883'].includes(error?.code)) return { kind: 'permanent', code: error.code,
    message: 'Le stockage du compte pour les cours et QCM n’est pas disponible. Les données restent sur cet appareil ; contacte la personne qui gère le site.' };
  if (['22007', '22008'].includes(error?.code)) return classifySyncError({ code: '23514' });
  return classifySyncError(error);
}

// PostgreSQL can return microseconds: Date.parse alone would collapse distinct
// cursor positions that happen within the same JavaScript millisecond.
function instant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(value)) throw protocol();
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw protocol();
  const fraction = value.match(/\.(\d+)/)?.[1] || '';
  return BigInt(milliseconds) * 1000n + BigInt(fraction.padEnd(6, '0').slice(3, 6));
}
const quoted = value => `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;

/** Uses the shared SDK, with the verified account JWT fixed on every query. */
export function createCourseQuizTransport(client, auth, userId) {
  async function checked(build, { signal, active = () => true } = {}) {
    if (!active()) throw changed();
    const verified = await auth.verifiedSession(userId);
    if (!active() || verified.userId !== userId || !verified.accessToken) throw changed();
    const query = build();
    const timeout = AbortSignal.timeout(15000);
    // The persistent service owns retries; disable the SDK's nested GET retry.
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
      const history = { courses: [], attempts: [] };
      for (const kind of ['courses', 'attempts']) {
        let cursor = null; const seen = new Set();
        for (let page = 0; ; page++) {
          if (page >= 10000) throw protocol();
          const rows = await checked(() => {
            let query = client.from(kind === 'courses' ? 'course_states' : 'quiz_attempts')
              .select(columns[kind]).eq('user_id', userId).limit(100);
            if (kind === 'courses') {
              query = query.order('lesson_id', { ascending: true });
              if (cursor) query = query.gt('lesson_id', cursor.lesson_id);
            } else {
              query = query.order('created_at', { ascending: true }).order('attempt_id', { ascending: true });
              if (cursor) query = query.or(`created_at.gt.${quoted(cursor.created_at)},and(created_at.eq.${quoted(cursor.created_at)},attempt_id.gt.${cursor.attempt_id})`);
            }
            return query;
          }, options);
          if (!Array.isArray(rows)) throw protocol();
          if (!rows.length) break;
          for (const row of rows) {
            const id = kind === 'courses' ? row?.lesson_id : row?.attempt_id;
            if (row?.user_id !== userId || typeof id !== 'string' || !id.length || seen.has(id)) throw protocol();
            // Text order belongs to PostgreSQL's collation, not JavaScript's
            // UTF-16 comparison. The key cursor, seen set and page bound guard
            // progress without rejecting valid historical Unicode lesson IDs.
            if (kind === 'attempts') {
              if (!uuid.test(id)) throw protocol();
              const time = instant(row.created_at);
              if (cursor) {
                const previous = instant(cursor.created_at);
                if (time < previous || time === previous && id <= cursor.attempt_id) throw protocol();
              }
            }
            seen.add(id); history[kind].push(row); cursor = row;
          }
        }
      }
      // Nothing is committed until BOTH complete scans have succeeded.
      return history;
    },
  };
}
