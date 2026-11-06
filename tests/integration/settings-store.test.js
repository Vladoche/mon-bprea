import { describe, expect, it, vi } from 'vitest';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { createSettingsRepository, personalScope } from '../../assets/settings-store.js';
import { queueSettings } from '../../assets/settings-model.js';
const userId = '11111111-1111-4111-8111-111111111111';
const identity = { environment: 'development', url: 'https://fixture.invalid', userId };
const appearance = { version: 1, season: 'auto', brightness: 'dark' };
describe('repository paramètres transactionnel', () => {
  it('un put rejeté annule valeur ET opération et aucune notification de succès', async () => {
    const indexedDB = new IDBFactory(); const onCommit = vi.fn(); const repo = createSettingsRepository(personalScope(identity), { indexedDB, onCommit }); const before = await repo.read();
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => { throw new DOMException('plein', 'QuotaExceededError'); });
    try { await expect(repo.change(saved => queueSettings(saved, 'appearance', appearance))).rejects.toMatchObject({ code: 'local_storage' }); }
    finally { put.mockRestore(); }
    expect(await repo.read()).toEqual(before); expect(onCommit).not.toHaveBeenCalled();
  });
  it('réouverture retrouve même UUID payload valeur et révision attendue', async () => {
    const indexedDB = new IDBFactory(); const scope = personalScope(identity); const repo = createSettingsRepository(scope, { indexedDB });
    await repo.change(saved => queueSettings(saved, 'appearance', appearance)); const before = await repo.read(); await repo.close();
    expect(await createSettingsRepository(scope, { indexedDB }).read()).toEqual(before); expect(before.operations[0].rpcPayload.p_preferences).toEqual(appearance);
  });
  it('relit puis ajoute des reçus sans évincer les vingt archives historiques ni les champs inconnus', async () => {
    const indexedDB = new IDBFactory(); const scope = personalScope(identity);
    const repo = createSettingsRepository(scope, { indexedDB });
    await repo.change(saved => {
      queueSettings(saved, 'appearance', appearance);
      const op = structuredClone(saved.operations[0]); delete op.archiveVersion;
      saved.archives = Array.from({ length: 19 }, (_, index) => ({ kind: 'superseded-unsent', operation: { ...op, extension: { index } } }));
      saved.archives.push({ receiptVersion: 9, extension: { future: true } });
      saved.archivedCount = 2;
      saved.future = { preserve: true };
      saved.operations[0].extension = { unknown: ['keep'] };
    });
    const before = await repo.read(); await repo.close();
    const reopened = createSettingsRepository(scope, { indexedDB });
    expect(await reopened.read()).toEqual(before);
    await reopened.change(saved => queueSettings(saved, 'appearance', { ...appearance, season: 'spring' }));
    await reopened.change(saved => queueSettings(saved, 'appearance', { ...appearance, season: 'summer' }));
    const after = await reopened.read();
    expect(after.archives.slice(0, 20)).toEqual(before.archives);
    expect(after.archives[20]).toEqual({ kind: 'superseded-unsent', operation: before.operations[0] });
    expect(after.archives[21]).toMatchObject({ receiptVersion: 1, domain: 'appearance' });
    expect(after).toMatchObject({ archivedCount: 2, future: before.future });
  });
  it('isole environnement, origine Supabase et UUID Auth', async () => {
    const indexedDB = new IDBFactory(); const repo = createSettingsRepository(personalScope(identity), { indexedDB }); await repo.change(saved => queueSettings(saved, 'appearance', appearance));
    for (const other of [{ ...identity, environment: 'production' }, { ...identity, url: 'https://other.invalid' }, { ...identity, userId: '22222222-2222-4222-8222-222222222222' }]) {
      const saved = await createSettingsRepository(personalScope(other), { indexedDB }).read(); expect(saved.values.appearance).toBeNull(); expect(saved.operations).toEqual([]);
    }
  });
  it('stockage absent ou identité invalidée n’écrit rien', async () => {
    const scope = personalScope(identity); await expect(createSettingsRepository(scope, { indexedDB: null }).read()).rejects.toMatchObject({ code: 'local_storage' });
    const repo = createSettingsRepository(scope, { indexedDB: new IDBFactory() }); const before = await repo.read(); await expect(repo.change(saved => queueSettings(saved, 'appearance', appearance), () => false)).rejects.toMatchObject({ code: 'local_storage' }); expect(await repo.read()).toEqual(before);
  });
});
