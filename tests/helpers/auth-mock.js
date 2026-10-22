import { vi } from 'vitest';

// Fixtures purement synthétiques ; aucun jeton ni compte Supabase réel.
export const authUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'eleve-a@example.invalid',
  created_at: '2026-10-20T08:00:00.000Z',
};
export const ownProfile = {
  id: authUser.id, pseudo: 'Camille',
  created_at: authUser.created_at, updated_at: authUser.created_at,
};
export const authSession = { user: authUser, access_token: 'fixture-unit-access', refresh_token: 'fixture-unit-refresh' };

export function mockAuthClient({ session = null, profile = ownProfile } = {}) {
  let notify;
  const profileResult = { data: structuredClone(profile), error: null };
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue(profileResult),
    maybeSingle: vi.fn().mockResolvedValue(profileResult),
  };
  const client = {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: session?.user ?? null }, error: null }),
      onAuthStateChange: vi.fn(callback => {
        notify = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { user: authUser, session: authSession }, error: null }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
      verifyOtp: vi.fn().mockResolvedValue({ data: { user: authUser, session: authSession }, error: null }),
      updateUser: vi.fn().mockResolvedValue({ data: { user: authUser }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn().mockReturnValue(query),
  };
  return { client, query, profileResult, emit: (event, nextSession) => notify(event, nextSession) };
}
