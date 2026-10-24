import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAuthService } from '../../assets/auth-service.js';
import { authUser, mockAuthClient } from '../helpers/auth-mock.js';
import { MemoryStorage } from '../helpers/memory-storage.js';

const configuration = { environment: 'development', url: 'https://fixture.invalid', siteUrl: 'http://127.0.0.1:4173/mon-bprea/' };
const sessionId = '22222222-2222-4222-8222-222222222222';
const session = (user = authUser, id = sessionId) => ({ user, access_token: `synthetic.${btoa(JSON.stringify({ sub: user.id, session_id: id }))}.not-a-real-signature`, refresh_token: 'synthetic-unit-only' });
afterEach(() => vi.unstubAllGlobals());

describe('continuité locale Auth, sans autorisation distante', () => {
  it('restaure seulement l’identité locale déjà vérifiée et exige Auth pour envoyer', async () => {
    const storage = new MemoryStorage(); vi.stubGlobal('localStorage', storage);
    const first = mockAuthClient({ session: session() }); const online = createAuthService(first.client, configuration); await online.start();
    const next = mockAuthClient({ session: session() }); next.client.auth.getUser.mockRejectedValue(new TypeError('network'));
    const offline = createAuthService(next.client, configuration); await offline.start();
    expect(offline.getState()).toMatchObject({ status: 'offline', user: { id: authUser.id } });
    await expect(offline.verifiedSession(authUser.id)).rejects.toThrow();
    const values = Array.from({ length: storage.length }, (_, n) => storage.getItem(storage.key(n))).join('');
    expect(values).not.toContain('synthetic'); expect(values).not.toContain(authUser.email);
  });

  it('bloque le cache pour un autre compte, une autre session ou un autre environnement', async () => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    const first = mockAuthClient({ session: session() }); await createAuthService(first.client, configuration).start();
    for (const [nextSession, config] of [
      [session({ ...authUser, id: '33333333-3333-4333-8333-333333333333' }), configuration],
      [session(authUser, '44444444-4444-4444-8444-444444444444'), configuration],
      [session(), { ...configuration, environment: 'production' }],
    ]) {
      const next = mockAuthClient({ session: nextSession }); next.client.auth.getUser.mockRejectedValue(new TypeError('network'));
      const service = createAuthService(next.client, config); await service.start(); expect(service.getState().user).toBeNull();
    }
  });

  it('ne restaure jamais hors ligne une session explicitement rejetée ou déconnectée', async () => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    const first = mockAuthClient({ session: session() }); const service = createAuthService(first.client, configuration); await service.start();
    const rejected = mockAuthClient({ session: session() }); rejected.client.auth.getUser.mockResolvedValue({ data: { user: null }, error: { status: 401, code: 'bad_jwt' } });
    const invalid = createAuthService(rejected.client, configuration); await invalid.start(); expect(invalid.getState().user).toBeNull();
    await service.signOut();
    const next = mockAuthClient({ session: session() }); next.client.auth.getUser.mockRejectedValue(new TypeError('network'));
    const offline = createAuthService(next.client, configuration); await offline.start(); expect(offline.getState().user).toBeNull();
  });
});
