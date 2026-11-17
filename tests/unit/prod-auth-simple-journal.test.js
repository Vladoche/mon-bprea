import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { inspectSimpleJournal } from '../../scripts/prod-auth/simple-journal.mjs';
import { PROD_PROJECT } from '../../scripts/prod-auth/environment.mjs';

const id = '22222222-2222-4222-8222-222222222222';
const email = 'participant@example.test';
const hash = createHash('sha256').update(`${PROD_PROJECT}\0${email}`).digest('hex');
function entries(kind = 1) {
  const envelope = Data => JSON.stringify({ Version: 4, Project: PROD_PROJECT, Data });
  return [
    { name: `admin-v2-${id}-reserved.json`, text: envelope({ Id: id, Kind: kind, TargetHash: hash, Status: 'reserved' }) },
    { name: `admin-v2-${id}-payload.bin`, text: null },
    { name: `admin-v2-${id}-complete.json`, text: envelope({ Id: id, Status: 'complete', PayloadHash: 'a'.repeat(64) }) },
  ];
}
describe('journal V2 partagé avec les outils Node historiques', () => {
  it('une intention sans résultat bloque toutes les nouvelles mutations', () => {
    expect(inspectSimpleJournal(entries().slice(0, 1), () => '', 'other@example.test')).toBe(true);
  });
  it('une génération connue bloque la même cible sans inventer une remise', () => {
    const items = entries(); const before = JSON.stringify(items);
    expect(inspectSimpleJournal(items, () => 'a'.repeat(64), email)).toBe(true);
    expect(inspectSimpleJournal(items, () => 'a'.repeat(64), 'other@example.test')).toBe(false);
    expect(JSON.stringify(items)).toBe(before);
    expect(before).not.toMatch(/consent|attestation|handed.over|token_hash/);
  });
  it('une intention de suppression reste bloquante après ses contrôles actifs', () => {
    expect(inspectSimpleJournal(entries(4), () => 'a'.repeat(64), 'other@example.test')).toBe(true);
  });
  it('un nouvel e-mail est lui aussi réservé', () => {
    const items = entries(2); const r = JSON.parse(items[0].text); r.Data.TargetHash = 'b'.repeat(64); r.Data.NextHash = hash;
    items[0].text = JSON.stringify(r); expect(inspectSimpleJournal(items, () => 'a'.repeat(64), email)).toBe(true);
  });
  it.each([
    items => items.shift(), items => items.splice(1, 1), items => items.push(items[0]),
    items => { items[0].text = items[0].text.replace(PROD_PROJECT, 'wrong-project'); },
    items => { items[2].text = items[2].text.replace('"complete"', '"unknown"'); },
    items => { items[0].name += '.new'; },
    items => { items[0].text = items[0].text.replace('"Version":4', '"Version":4,"Version":4'); },
    items => { items[0].text = items[0].text.replace('"Kind":1', '"Kind":99'); },
  ])('refuse un journal incomplet ou ambigu %#', mutate => {
    const items = entries(); mutate(items); expect(() => inspectSimpleJournal(items, () => 'a'.repeat(64), email)).toThrow();
  });
  it('refuse un payload modifié sans le déchiffrer', () => {
    expect(() => inspectSimpleJournal(entries(), () => 'b'.repeat(64), email)).toThrow();
  });
});
