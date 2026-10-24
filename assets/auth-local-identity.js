// Local continuity only. This marker is NOT a session or authorization proof.
// No token, password or e-mail is stored here; remote access still uses getUser.
export function createLocalIdentityMarker({ environment, url, siteUrl } = {}) {
  let key;
  try { key = `bprea-auth-local-identity-v1:${JSON.stringify([environment, new URL(url).origin, new URL(siteUrl).pathname])}`; }
  catch { return { remember() {}, clear() {}, restore: () => null }; }
  function identity(session) {
    try {
      const encoded = session.access_token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/');
      const claims = JSON.parse(atob(encoded));
      if (claims.sub !== session.user.id || !/^[0-9a-f-]{36}$/i.test(claims.session_id || '')) return null;
      return { version: 1, userId: claims.sub, sessionId: claims.session_id };
    } catch { return null; }
  }
  return {
    remember(session, verifiedId) {
      const value = identity(session);
      if (value?.userId === verifiedId) try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Offline restoration stays unavailable. */ }
    },
    clear() { try { localStorage.removeItem(key); } catch { /* No pedagogical data is touched. */ } },
    restore(session) {
      const value = identity(session);
      try {
        const saved = JSON.parse(localStorage.getItem(key));
        return value && saved?.version === 1 && saved.userId === value.userId && saved.sessionId === value.sessionId ? { id: value.userId } : null;
      } catch { return null; }
    },
  };
}
