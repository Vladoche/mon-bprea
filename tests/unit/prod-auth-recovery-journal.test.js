import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { inspectRecoveryJournal, parseRecoveryJson } from '../../scripts/prod-auth/recovery-journal.mjs';
import { PROD_PROJECT, PROD_CALLBACK } from '../../scripts/prod-auth/environment.mjs';
const id = '22222222-2222-4222-8222-222222222222';
const link = `${PROD_CALLBACK}?token_hash=synthetic_token_without_any_auth_capability&type=recovery\n`;
const event = status => ({ name: `recovery-${id}-${status}.json`, record: { version: 2, project: PROD_PROJECT, operationId: id,
  type: 'recovery', targetHash: 'a'.repeat(64), status, recordedAt: '2026-11-13T10:00:00.000Z' } });
function fixtures() {
  const reserved = event('reserved'), delivered = event('delivered-private'), handed = event('handed-over');
  Object.assign(reserved.record, { accountId: id, attestations: { requestedByHolder: true, identityCheckedViaKnownChannel: true,
    selectedAddressConfirmed: true, privateChannelAgreed: true, holderChoosesPassword: true } });
  delivered.record.linkSha256 = createHash('sha256').update(link).digest('hex');
  return [reserved, delivered, handed];
}
describe('journal de récupération V1.1 ajouté aux réservations V1', () => {
  it('distingue réservation, livraison locale et remise sans écraser l’historique', () => {
    const events = fixtures(); const before = JSON.stringify(events);
    expect(inspectRecoveryJournal(events.slice(0, 1), () => { throw new Error('no secret read'); })[0].status).toBe('reserved');
    expect(inspectRecoveryJournal(events.slice(0, 2), () => link)[0].status).toBe('delivered-private');
    expect(inspectRecoveryJournal(events, () => { throw new Error('link can be withdrawn after handover'); })[0].status).toBe('handed-over');
    expect(JSON.stringify(events)).toBe(before);
  });
  it('refuse les états ambigus, orphelins, falsifiés ou incomplets', () => {
    const mutations = [
      e => e.shift(), e => e.splice(1, 1), e => e.push(e[0]), e => { e[1].record.targetHash = 'b'.repeat(64); },
      e => { e[0].record.version = 1; }, e => { e[0].record.project = 'other'; }, e => { e[0].name += '.json'; },
      e => { e[0].record.accountId = 'invalid'; }, e => { e[0].record.type = 'invite'; },
      e => { e[0].record.recordedAt = '2026-11-13T10:00:00Z\n'; },
      e => { e[1].record.recordedAt = '2026-11-12T10:00:00Z'; }, e => { e[2].record.recordedAt = '2026-11-12T10:00:00Z'; },
      e => { e[1].record.linkSha256 = 'short'; },
      ...['requestedByHolder', 'identityCheckedViaKnownChannel', 'selectedAddressConfirmed', 'privateChannelAgreed', 'holderChoosesPassword']
        .map(name => e => { e[0].record.attestations[name] = false; }),
    ];
    for (const mutate of mutations) { const events = fixtures(); mutate(events); expect(() => inspectRecoveryJournal(events, () => link)).toThrow(); }
  });
  it('refuse les propriétés JSON répétées même avec échappement ou imbrication', () => {
    for (const text of ['{"status":"reserved","status":"handed-over"}', '{"x":{"a":1,"a":2}}', '{"a":1,"\\u0061":2}'])
      expect(() => parseRecoveryJson(text)).toThrow();
    const text = JSON.stringify({ a: [1, { a: 'escaped \\" } [ :', b: true }], b: { a: 2 } });
    expect(parseRecoveryJson(text)).toEqual(JSON.parse(text));
  });
  it('bloque une perte ou altération du fichier tant que sa remise n’est pas acquittée', () => {
    const events = fixtures().slice(0, 2);
    for (const value of [undefined, '', link.trim(), link.replace('type=recovery', 'type=invite'), link.replace('synthetic_token', 'changed_token')])
      expect(() => inspectRecoveryJournal(events, () => value)).toThrow();
  });
});
