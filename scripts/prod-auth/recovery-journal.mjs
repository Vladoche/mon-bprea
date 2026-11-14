// Shared V1.1 append-only journal contract. Pure validation, no network or mutation.
import { createHash } from 'node:crypto';
import { PROD_PROJECT, UUID, validateProdCallback, fail } from './environment.mjs';
const hashPattern = /^[a-f0-9]{64}$/;
const date = value => {
  if (typeof value !== 'string' || /[\x00-\x1f\x7f]/.test(value) || !Number.isFinite(Date.parse(value))) fail('private');
  return Date.parse(value);
};
// JSON.parse alone accepts repeated properties. Reject them before interpreting state.
export function parseRecoveryJson(text) {
  let value;
  try { value = JSON.parse(text); } catch { fail('private'); }
  const stack = [];
  for (const token of text.matchAll(/"(?:[^"\\]|\\[\s\S])*"|[{}[\]]/g)) {
    if (token[0] === '{') stack.push(new Set());
    else if (token[0] === '[') stack.push(null);
    else if (token[0] === '}' || token[0] === ']') stack.pop();
    else if (/^\s*:/.test(text.slice(token.index + token[0].length))) {
      const name = JSON.parse(token[0]), names = stack.at(-1);
      if (!names || names.has(name)) fail('private');
      names.add(name);
    }
  }
  return value;
}
export function inspectRecoveryJournal(entries, readLink) {
  const groups = new Map();
  for (const { name, record: r } of entries) {
    if (r?.version !== 2 || r.project !== PROD_PROJECT || r.type !== 'recovery' || !UUID.test(r.operationId || '')
        || !hashPattern.test(r.targetHash || '') || !['reserved', 'delivered-private', 'handed-over'].includes(r.status)
        || name !== `recovery-${r.operationId}-${r.status}.json`) fail('private');
    date(r.recordedAt);
    if (!groups.has(r.operationId)) groups.set(r.operationId, new Map());
    const events = groups.get(r.operationId);
    if (events.has(r.status)) fail('private');
    events.set(r.status, r);
  }
  return [...groups].map(([operationId, events]) => {
    const reservation = events.get('reserved'), receipt = events.get('delivered-private'), handover = events.get('handed-over');
    if (!reservation || !UUID.test(reservation.accountId || '')
        || [...events.values()].some(r => r.targetHash !== reservation.targetHash)
        || ['requestedByHolder', 'identityCheckedViaKnownChannel', 'selectedAddressConfirmed', 'privateChannelAgreed', 'holderChoosesPassword']
          .some(name => reservation.attestations?.[name] !== true)) fail('private');
    let status = 'reserved';
    if (receipt) {
      if (date(receipt.recordedAt) < date(reservation.recordedAt) || !hashPattern.test(receipt.linkSha256 || '')) fail('private');
      status = 'delivered-private';
      if (handover) {
        if (date(handover.recordedAt) < date(receipt.recordedAt)) fail('private');
        status = 'handed-over';
      } else {
        const link = readLink(operationId);
        if (typeof link !== 'string' || !link.endsWith('\n') || createHash('sha256').update(link).digest('hex') !== receipt.linkSha256) fail('private');
        try { validateProdCallback(link.slice(0, -1), 'recovery'); } catch { fail('private'); }
      }
    } else if (handover) fail('private');
    return { operationId, targetHash: reservation.targetHash, status };
  });
}
