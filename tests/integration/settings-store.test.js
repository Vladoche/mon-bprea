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
