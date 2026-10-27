import { TABLES, MAX_BYTES, MAX_ROWS, fail } from './export-sources.js';
import { projectRow } from './export-model.js';
const quoted = value => `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;

export function createExportTransport(client, auth, userId) {
  return async function read({ signal, active, progress = () => {} }) {
    const data = {}; let count = 0, bytes = 0;
    for (const [name, spec] of Object.entries(TABLES)) {
      const rows = [], seen = new Set(); let cursor = null;
      for (let page = 0; ; page++) {
        if (!active() || signal.aborted) fail('cancelled');
        if (page >= 1001) fail('volume');
        const verified = await auth.verifiedSession(userId);
        if (!active() || verified.userId !== userId) fail('identity');
        let query = client.from(name).select(spec.fields.join(',')).eq(spec.owner, userId).limit(100);
        if (spec.time) {
          query = query.order(spec.time, { ascending: true }).order(spec.key, { ascending: true });
          if (cursor) query = query.or(`${spec.time}.gt.${quoted(cursor[spec.time])},and(${spec.time}.eq.${quoted(cursor[spec.time])},${spec.key}.gt.${quoted(cursor[spec.key])})`);
        } else {
          query = query.order(spec.key, { ascending: true });
          if (cursor) query = query.gt(spec.key, cursor[spec.key]);
        }
        const result = await query.retry(false).setHeader('Authorization', `Bearer ${verified.accessToken}`)
          .abortSignal(AbortSignal.any([signal, AbortSignal.timeout(15000)]));
        if (!active() || signal.aborted) fail('cancelled');
        if (result.error) fail([401, 403].includes(result.status) || [401, 403].includes(result.error.status) || ['42501', 'PGRST301', 'PGRST303'].includes(result.error.code) ? 'identity' : 'api');
        if (!Array.isArray(result.data)) fail('invalid');
        if (!result.data.length) break; // Continue even after a short/capped page.
        for (const row of result.data) {
          const id = row?.[spec.key];
          if (typeof id !== 'string' || !id || seen.has(id)) fail('pagination');
          if (spec.time && (typeof row[spec.time] !== 'string' || !Number.isFinite(Date.parse(row[spec.time])))) fail('invalid');
          const safe = projectRow(name, row, userId);
          bytes += new TextEncoder().encode(JSON.stringify(safe)).length;
          if (++count > MAX_ROWS || bytes > MAX_BYTES) fail('volume');
          seen.add(id); rows.push(safe); cursor = row;
        }
        progress(name, rows.length);
      }
      data[name] = rows;
    }
    return data;
  };
}
