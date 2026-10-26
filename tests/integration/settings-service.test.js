import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createSettingsService, VISITOR_ITK_KEY, VISITOR_APPEARANCE_KEY, LEGACY_THEME_KEY } from '../../assets/settings-service.js';
import { createSettingsRepository, personalScope } from '../../assets/settings-store.js';
import { queueSettings, reconcileSettings } from '../../assets/settings-model.js';
import { MemoryStorage } from '../helpers/memory-storage.js';
const A = '11111111-1111-4111-8111-111111111111'; const B = '22222222-2222-4222-8222-222222222222';
const at = '2026-10-20T10:00:00.000Z'; const configuration = { client: {}, environment: 'development', url: 'https://fixture.invalid' };
const itk = { crop: 'tomate', variety: 'Roma', cover: 'serre', area: '100', month: '5', year: '2028', soil: 'limoneux', water: 'standard' };
const appearance = { version: 1, season: 'auto', brightness: 'auto' };
let indexedDB; let storage; const services = [];
beforeEach(() => { indexedDB = new IDBFactory(); storage = new MemoryStorage(); });
afterEach(() => services.splice(0).forEach(service => service.stop()));
function authFixture(id = A, status = id ? 'authenticated' : 'anonymous') {
  let state = { status, user: id ? { id } : null }; const listeners = new Set();
  return { getState: () => state, subscribe(fn) { listeners.add(fn); fn(state); return () => listeners.delete(fn); }, emit(status, id = null) { state = { status, user: id ? { id } : null }; listeners.forEach(fn => fn(state)); }, retry: vi.fn() };
}
function backend() {
  const histories = new Map(); const sent = []; const connections = new Map();
  const factory = (client, auth, userId) => {
    if (!histories.has(userId)) histories.set(userId, { itk: null, appearance: null }); const history = histories.get(userId);
    const connection = {
      readSettings: vi.fn(async () => structuredClone(history)),
      send: vi.fn(async op => {
        sent.push(structuredClone({ userId, ...op })); const previous = history[op.domain]; const p = op.rpcPayload;
        if (previous?.operation_id === op.id) return { status: 'replayed', row: structuredClone(previous) };
        if ((previous?.revision || 0) !== p.p_expected_revision) return { status: 'conflict', row: structuredClone(previous) };
        const row = { user_id: userId, operation_id: op.id, base_revision: p.p_expected_revision, revision: p.p_expected_revision + 1, schema_version: 1, created_at: at, updated_at: at,
          ...(op.domain === 'itk' ? { parameters: structuredClone(p.p_parameters) } : { season: p.p_preferences.season, brightness: p.p_preferences.brightness, client_updated_at: p.p_preferences.updatedAt || null }) };
        history[op.domain] = row; return { status: previous ? 'updated' : 'inserted', row: structuredClone(row) };
      }),
    }; connections.set(userId, connection); return connection;
  }; return { factory, histories, sent, connections };
}
function fixture({ auth = authFixture(), remote = backend(), idb = indexedDB, repositoryFactory, broadcast = null } = {}) {
  const repo = id => createSettingsRepository(personalScope({ ...configuration, userId: id }), { indexedDB: idb }); const callbacks = [];
  const service = createSettingsService({ auth, configuration, storage, repositoryFactory: repositoryFactory || (scope => createSettingsRepository(scope, { indexedDB: idb })), transportFactory: remote.factory, now: () => Date.parse(at), schedule: (fn, delay) => { callbacks.push({ fn, delay }); return callbacks.length; }, cancel: vi.fn(), broadcast });
  services.push(service); return { service, auth, remote, repo, callbacks };
}
async function initialized(options) { const f = fixture(options); await f.service.start(); await f.service.synchronize(); return f; }
describe('persistance et service des paramètres — réseau simulé, sans preuve RLS', () => {
  it('préserve visiteur et sources anciennes, sans import implicite dans A', async () => {
    const raw = JSON.stringify(itk); storage.setItem(VISITOR_ITK_KEY, raw); storage.setItem(LEGACY_THEME_KEY, 'dark');
    const visitor = await initialized({ auth: authFixture(null) }); expect(visitor.service.getState().view.itk).toEqual(itk); expect(visitor.service.getState().view.appearance).toEqual({ version: 1, season: 'auto', brightness: 'dark' });
    const personal = await initialized(); expect(personal.service.getState().view.itk).toBeNull(); expect(personal.remote.sent).toEqual([]); expect(storage.getItem(VISITOR_ITK_KEY)).toBe(raw); expect(storage.getItem(LEGACY_THEME_KEY)).toBe('dark');
  });
  it('refuse données historiques invalides et conserve original', async () => {
    const raw = JSON.stringify({ ...itk, variety: 'Touchon' }); storage.setItem(VISITOR_ITK_KEY, raw);
    const f = await initialized(); const preview = await f.service.previewImport('itk'); expect(preview.available).toBe(false); expect(preview.error).toMatch(/invalides/); expect(storage.getItem(VISITOR_ITK_KEY)).toBe(raw); expect((await f.repo(A).read()).operations).toEqual([]);
  });
  it('recharge une outbox atomique et retrouve les paramètres sur deuxième appareil', async () => {
    const remote = backend(); const f = await initialized({ remote }); const saved = await f.service.save('itk', itk); expect(saved).toMatchObject({ error: null, savedLocally: true });
    const before = await f.repo(A).read(); expect(before.values.itk).toEqual(itk); expect(before.operations).toHaveLength(1); expect(remote.sent).toHaveLength(0);
    f.service.stop(); const reload = await initialized({ remote }); expect(reload.service.getState().sync.state).toBe('synced'); expect(remote.sent[0].id).toBe(before.operations[0].id);
    const phone = await initialized({ remote, idb: new IDBFactory() }); expect(phone.service.getState().view.itk).toEqual(itk);
  });
  it('perte HTTP après commit : même UUID, payload et base au retry', async () => {
    const f = await initialized(); const connection = f.remote.connections.get(A); const send = connection.send.getMockImplementation(); let lost = true;
    connection.send.mockImplementation(async op => { const result = await send(op); if (lost) { lost = false; throw new TypeError('lost'); } return result; });
    await f.service.save('appearance', appearance); await f.service.synchronize(); expect(f.service.getState().sync.state).toBe('offline'); await f.service.retry();
    expect(f.remote.sent).toHaveLength(2); expect(f.remote.sent[1].rpcPayload).toEqual(f.remote.sent[0].rpcPayload); expect(f.remote.sent[1].id).toBe(f.remote.sent[0].id); expect(f.remote.histories.get(A).appearance.revision).toBe(1);
  });
  it('plusieurs changements hors ligne compactent seulement jamais envoyé et auto reste auto', async () => {
    const f = await initialized(); f.auth.emit('offline', A); await f.service.start();
    for (const season of ['summer', 'winter', 'auto']) await f.service.save('appearance', { ...appearance, season });
    expect((await f.repo(A).read()).operations).toHaveLength(1); f.auth.emit('authenticated', A); await f.service.start(); await f.service.synchronize(); expect(f.remote.sent).toHaveLength(1); expect(f.remote.histories.get(A).appearance.season).toBe('auto');
  });
  it('deux appareils conservent CAS et décision volontaire fondée sur révision actuelle', async () => {
    const remote = backend(); const first = await initialized({ remote }); const second = await initialized({ remote, idb: new IDBFactory() });
    await first.service.save('itk', itk); await second.service.save('itk', { ...itk, crop: 'carotte', variety: 'Touchon' }); await first.service.synchronize(); await second.service.synchronize();
    const conflict = second.service.getState().sync.conflicts.find(item => !item.resolved); expect(conflict.local.crop).toBe('carotte'); expect(second.service.getState().view.itk.crop).toBe('tomate');
    const before = remote.sent.length; expect((await second.service.resolve(conflict.id, 'local')).error).toBeNull(); expect(remote.sent).toHaveLength(before); await second.service.synchronize(); expect(remote.histories.get(A).itk.parameters.crop).toBe('carotte'); expect(remote.histories.get(A).itk.revision).toBe(2);
  });
  it('une opération refusée ne bloque pas autre domaine', async () => {
    const f = await initialized(); const connection = f.remote.connections.get(A); const send = connection.send.getMockImplementation(); connection.send.mockImplementation(op => op.domain === 'itk' ? Promise.reject({ code: '23514' }) : send(op));
    await f.service.save('itk', itk); await f.service.save('appearance', appearance); await f.service.synchronize();
    expect(f.service.getState().sync.domains.itk.state).toBe('error'); expect(f.service.getState().sync.domains.appearance.state).toBe('synced'); expect(f.remote.histories.get(A).appearance.season).toBe('auto');
  });
  it('sépare A/B, outbox et réponse tardive puis retrouve A', async () => {
    const f = await initialized(); let release; f.remote.connections.get(A).send.mockImplementation(() => new Promise(resolve => { release = resolve; }));
    await f.service.save('itk', itk); const running = f.service.synchronize(); await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    f.auth.emit('authenticated', B); await f.service.start(); await f.service.synchronize(); release({ status: 'inserted', row: {} }); await running;
    expect(f.service.getState().view.itk).toBeNull(); expect((await f.repo(B).read()).operations).toEqual([]); expect((await f.repo(A).read()).operations[0].state).toBe('pending');
    f.auth.emit('offline', A); await f.service.start(); expect(f.service.getState().view.itk).toEqual(itk);
  });
  it('session rejetée masque toutes données privées', async () => {
    const f = await initialized(); await f.service.save('itk', itk); f.remote.connections.get(A).send.mockRejectedValue({ code: 'PGRST303' }); await f.service.synchronize();
    expect(f.service.getState().sync.state).toBe('session'); expect(f.service.getState().view.itk).toBeNull(); expect((await f.repo(A).read()).operations).toHaveLength(1);
  });
  it('import volontaire par domaine, brut/archives préservés et répétition sans nouvel UUID', async () => {
    const raw = JSON.stringify({ ...appearance, unknown: ['keep'] }); storage.setItem(VISITOR_APPEARANCE_KEY, raw); storage.setItem(VISITOR_ITK_KEY, JSON.stringify(itk));
    const f = await initialized(); const preview = await f.service.previewImport('appearance'); expect(preview.value).toEqual(appearance); expect((await f.service.confirmImport(preview)).error).toBeNull();
    const before = await f.repo(A).read(); expect(before.imports[0].raw).toBe(raw); expect(before.operations).toHaveLength(1); expect(before.values.itk).toBeNull();
    const again = await f.service.confirmImport(preview); expect(again.replayed).toBe(true); expect((await f.repo(A).read()).operations).toHaveLength(1); expect(storage.getItem(VISITOR_APPEARANCE_KEY)).toBe(raw);
  });
  it('invalide aperçu si source change durant la récupération distante', async () => {
    storage.setItem(VISITOR_ITK_KEY, JSON.stringify(itk)); const f = await initialized(); const preview = await f.service.previewImport('itk'); const connection = f.remote.connections.get(A); const read = connection.readSettings.getMockImplementation();
    connection.readSettings.mockImplementation(async () => { storage.setItem(VISITOR_ITK_KEY, JSON.stringify({ ...itk, area: '2' })); return read(); });
    expect((await f.service.confirmImport(preview)).error).toMatch(/source locale a changé/); expect((await f.repo(A).read()).operations).toEqual([]);
  });
  it('annule toute transaction si stockage échoue, sans annoncer enregistré', async () => {
    let fail = false; const f = await initialized({ repositoryFactory: scope => { const repo = createSettingsRepository(scope, { indexedDB }); return { ...repo, change: (...args) => fail ? Promise.reject(Object.assign(new Error('stockage plein'), { code: 'local_storage' })) : repo.change(...args) }; } });
    fail = true; expect((await f.service.save('itk', itk)).error).toBe('stockage plein'); expect(f.service.getState().sync.state).toBe('storage-error'); expect((await f.repo(A).read()).operations).toEqual([]); expect(f.remote.sent).toHaveLength(0);
  });
  it('réconcilie plusieurs onglets par relecture de la portée annoncée', async () => {
    const broadcast = { postMessage: vi.fn(), close: vi.fn() }; const f = await initialized({ broadcast }); const repo = f.repo(A);
    await repo.change(saved => queueSettings(saved, 'itk', itk)); broadcast.onmessage({ data: repo.scope }); await vi.waitFor(() => expect(f.service.getState().view.itk).toEqual(itk));
    broadcast.onmessage({ data: personalScope({ ...configuration, userId: B }) }); expect(f.service.getState().view.itk).toEqual(itk);
  });
  it('deux transactions sur même scope ne perdent ni domaine ni outbox', async () => {
    const scope = personalScope({ ...configuration, userId: A }); const first = createSettingsRepository(scope, { indexedDB }); const second = createSettingsRepository(scope, { indexedDB });
    await Promise.all([first.change(saved => queueSettings(saved, 'itk', itk)), second.change(saved => queueSettings(saved, 'appearance', appearance))]);
    const saved = await first.read(); expect(saved.values).toEqual({ itk, appearance }); expect(saved.operations).toHaveLength(2);
  });
  it('une sauvegarde arrivée pendant la dernière relecture repart immédiatement sans vue périmée', async () => {
    let hold = false; let release; const idb = new IDBFactory();
    const f = await initialized({ idb, repositoryFactory: scope => {
      const repo = createSettingsRepository(scope, { indexedDB: idb });
      return { ...repo, read: async () => { const saved = await repo.read(); if (!hold) return saved; hold = false; await new Promise(resolve => { release = resolve; }); return saved; } };
    } });
    await f.service.save('appearance', { ...appearance, season: 'winter' }); hold = true;
    const running = f.service.synchronize(); await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    await f.service.save('appearance', appearance); release(); await running;
    expect(f.service.getState().view.appearance.season).toBe('auto'); expect(f.service.getState().sync.state).toBe('pending'); expect(f.callbacks.at(-1).delay).toBe(0);
    await f.service.synchronize(); expect(f.remote.histories.get(A).appearance.season).toBe('auto'); expect(f.remote.histories.get(A).appearance.revision).toBe(2);
  });
  it('saving reste visible pendant la transaction et aucun faux synced ne précède son commit', async () => {
    let hold = false; let release; const idb = new IDBFactory();
    const f = await initialized({ idb, repositoryFactory: scope => { const repo = createSettingsRepository(scope, { indexedDB: idb }); return { ...repo, change: (...args) => {
      if (!hold) return repo.change(...args); hold = false; return new Promise(resolve => { release = () => resolve(repo.change(...args)); });
    } }; } });
    hold = true; const saving = f.service.save('itk', itk); await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    expect(f.service.getState().sync.state).toBe('saving'); await f.service.synchronize(); expect(f.service.getState().sync.state).toBe('saving'); release(); expect((await saving).savedLocally).toBe(true); expect(f.service.getState().sync.state).toBe('pending');
  });  it('retry attend la panne en cours avant de réinitialiser son échéance et renvoyer le même UUID', async () => {
    const f = await initialized(); const connection = f.remote.connections.get(A); const send = connection.send.getMockImplementation(); let release;
    connection.send.mockImplementationOnce(op => new Promise((resolve, reject) => { release = () => reject(new TypeError('outage still in flight')); })).mockImplementation(send);
    await f.service.save('appearance', appearance); const oldRun = f.service.synchronize();
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    const retry = f.service.retry(); release(); await oldRun; await retry;
    expect(connection.send).toHaveBeenCalledTimes(2); expect(connection.send.mock.calls[1][0].rpcPayload).toEqual(connection.send.mock.calls[0][0].rpcPayload);
    expect(f.service.getState().sync.state).toBe('synced'); expect(f.remote.histories.get(A).appearance.revision).toBe(1);
  });});
