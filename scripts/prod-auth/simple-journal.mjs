// Shared V2 generation journal. No invented consent/handover evidence.
// A successful link generation and its private availability are distinct from
// participant activation. Any missing result remains globally blocking.
import { createHash } from 'node:crypto';
import { PROD_PROJECT, fail } from './environment.mjs';
import { parseRecoveryJson } from './recovery-journal.mjs';

const idPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const hashPattern = /^[a-f0-9]{64}$/;
export function inspectSimpleJournal(entries, payloadHash, email) {
  const operations = new Map();
  try {
    for (const { name, text } of entries) {
      const match = /^admin-v2-([a-f0-9-]{36})-(reserved\.json|complete\.json|step-email-modified\.json|payload\.bin)$/.exec(name);
      if (!match || !idPattern.test(match[1])) fail('private');
      const [, id, suffix] = match;
      const operation = operations.get(id) || new Map();
      if (operation.has(suffix)) fail('private');
      let data = null;
      if (suffix !== 'payload.bin') {
        const record = parseRecoveryJson(text);
        if (record?.Version !== 4 || record?.Project !== PROD_PROJECT || record?.Data?.Id !== id) fail('private');
        data = record.Data;
      }
      operation.set(suffix, data); operations.set(id, operation);
    }
    const target = createHash('sha256').update(`${PROD_PROJECT}\0${email}`).digest('hex');
    let blocked = false;
    for (const [id, records] of operations) {
      const reservation = records.get('reserved.json');
      if (!reservation || reservation.Status !== 'reserved' || !hashPattern.test(reservation.TargetHash || '')
          || !Number.isInteger(reservation.Kind) || reservation.Kind < 0 || reservation.Kind > 4
          || reservation.NextHash != null && !hashPattern.test(reservation.NextHash)) fail('private');
      const complete = records.get('complete.json');
      if (complete && (complete.Status !== 'complete' || !records.has('payload.bin')
          || !hashPattern.test(complete.PayloadHash || '') || complete.PayloadHash !== payloadHash(id))) fail('private');
      if (records.has('step-email-modified.json') && records.get('step-email-modified.json').Step !== 'email-modified') fail('private');
      // A deletion intention always requires residual/backup reconciliation.
      // Node does not decrypt or regenerate a V2 link: use the V2 app to view it.
      blocked ||= !complete || reservation.Kind === 4 || reservation.TargetHash === target || reservation.NextHash === target;
    }
    return blocked;
  } catch { fail('private'); }
}
