import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { createPersonalRepository, personalChange, personalScope } from '../../assets/drill-personal-store.js';
import { makeSeries } from '../fixtures/drill.js';
import { MemoryStorage } from '../helpers/memory-storage.js';

const userId = '11111111-1111-4111-8111-111111111111';
const identity = { environment: 'development', url: 'https://fixture.invalid', userId };
const scope = personalScope(identity);
const series = makeSeries();
const start = saved => personalChange(saved, 'ensureSeries', [series.unit, series.week, series.questions, series.startedAt]);
let indexedDB;
beforeEach(() => { indexedDB = new IDBFactory(); });

describe('IndexedDB personnel — données et file dans une seule transaction', () => {
  it('isole comptes et environnements et ne touche jamais le JSON visiteur', async () => {
    const storage = new MemoryStorage(); storage.setItem('bprea-demo-drill-v1', '{"version":1,"series":{},"archive":"préserver"}');
    vi.stubGlobal('localStorage', storage);
    const a = createPersonalRepository(scope, { indexedDB });
    await a.change(start);
    const b = createPersonalRepository(personalScope({ ...identity, userId: '22222222-2222-4222-8222-222222222222' }), { indexedDB });
    const prod = createPersonalRepository(personalScope({ ...identity, environment: 'production' }), { indexedDB });
    expect(Object.keys((await a.read()).drill.series)).toEqual([series.id]);
    expect((await b.read()).operations).toEqual([]); expect((await prod.read()).drill.series).toEqual({});
    expect(storage.getItem('bprea-demo-drill-v1')).toContain('préserver');
  });

  it('conserve réponse, UUID et payload ensemble après fermeture et réouverture', async () => {
    const repo = createPersonalRepository(scope, { indexedDB }); await repo.change(start);
    const q = series.questions[0];
    await repo.change(saved => personalChange(saved, 'submitAnswer', [series.id, q.id, q.answer, { nowISO: '2026-10-20T10:00:00.000Z' }]));
    const before = await repo.read(); await repo.close();
    const after = await createPersonalRepository(scope, { indexedDB }).read();
    expect(after).toEqual(before); expect(after.operations).toHaveLength(2);
    expect(after.drill.series[series.id].answers[q.id].answer).toBe(q.answer);
    expect(after.operations[1].payload.p_operation_id).toBe(after.operations[1].id);
  });

  it('annule réponse ET opération si le put échoue par saturation', async () => {
    const repo = createPersonalRepository(scope, { indexedDB }); await repo.change(start);
    const before = await repo.read();
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => { throw new DOMException('fixture', 'QuotaExceededError'); });
    await expect(repo.change(saved => personalChange(saved, 'submitAnswer', [series.id, series.questions[0].id, 'a', {}]))).rejects.toMatchObject({ code: 'local_storage' });
    put.mockRestore(); expect(await repo.read()).toEqual(before);
  });

  it('sérialise les actions concurrentes sans perdre une réponse ou son opération', async () => {
    const left = createPersonalRepository(scope, { indexedDB }); const right = createPersonalRepository(scope, { indexedDB });
    await left.change(start);
    await Promise.all(series.questions.slice(0, 2).map((q, index) => (index ? right : left).change(saved => personalChange(saved, 'submitAnswer', [series.id, q.id, q.answer, {}]))));
    const saved = await left.read(); expect(Object.keys(saved.drill.series[series.id].answers)).toHaveLength(2); expect(saved.operations).toHaveLength(3);
  });

  it('garde deux entraînements identiques distincts et conserve les brouillons', async () => {
    const repo = createPersonalRepository(scope, { indexedDB }); await repo.change(start);
    const q = series.questions[0]; const args = [series.id, q.id, q.answer, { nowISO: '2026-10-20T10:00:00.000Z' }];
    await repo.change(saved => personalChange(saved, 'submitAnswer', args));
    await repo.change(saved => personalChange(saved, 'saveDraft', [series.id, series.questions[1].id, 'a']));
    for (let n = 0; n < 2; n++) await repo.change(saved => personalChange(saved, 'submitAnswer', [...args.slice(0, 3), { ...args[3], training: true }]));
    const saved = await repo.read(); const attempts = saved.operations.filter(item => item.type === 'training');
    expect(attempts).toHaveLength(2); expect(attempts[0].id).not.toBe(attempts[1].id);
    expect(saved.drill.series[series.id].answers[q.id].attempts).toHaveLength(3);
    expect(saved.drill.series[series.id].drafts[series.questions[1].id]).toBe('a');
  });

  it('refuse un stockage absent et une action invalidée avant le commit', async () => {
    await expect(createPersonalRepository(scope, { indexedDB: null }).read()).rejects.toMatchObject({ code: 'local_storage' });
    const repo = createPersonalRepository(scope, { indexedDB }); await repo.change(start);
    const before = await repo.read();
    await expect(repo.change(saved => { saved.operations = []; }, () => false)).rejects.toThrow();
    expect(await repo.read()).toEqual(before);
  });

  it('refuse un document personnel de version inconnue sans le réécrire', async () => {
    const repo = createPersonalRepository(scope, { indexedDB }); await repo.read();
    const request = indexedDB.open('mon-bprea-drill-personal-v1', 1);
    const db = await new Promise(resolve => { request.onsuccess = () => resolve(request.result); });
    const corrupt = { version: 999, scope, preserved: 'aucune perte' };
    await new Promise(resolve => { const tx = db.transaction('accounts', 'readwrite'); tx.objectStore('accounts').put(corrupt, scope); tx.oncomplete = resolve; });
    await expect(repo.read()).rejects.toThrow(/illisible/); await expect(repo.change(start)).rejects.toThrow();
    const saved = await new Promise(resolve => { const read = db.transaction('accounts').objectStore('accounts').get(scope); read.onsuccess = () => resolve(read.result); });
    expect(saved).toEqual(corrupt); db.close();
  });
});
