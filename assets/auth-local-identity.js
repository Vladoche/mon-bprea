// Local continuity only. This marker is NOT a session or authorization proof.
// No token, password or e-mail is stored here; remote access still uses getUser.
export function createLocalIdentityMarker({ environment, url, siteUrl } = {}) {
  let key, storageKey;
  try {
    const project = new URL(url);
    const path = new URL(siteUrl).pathname;
    key = `bprea-auth-local-identity-v1:${JSON.stringify([environment, project.origin, path])}`;
    storageKey = `bprea-auth-${project.hostname}-${path}`;
  } catch { return { remember() {}, clear() {}, restore: () => null, rememberBrightness() {} }; }
  function identity(session) {
    try {
      const encoded = session.access_token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/');
      const claims = JSON.parse(atob(encoded));
      if (claims.sub !== session.user.id || !/^[0-9a-f-]{36}$/i.test(claims.session_id || '')) return null;
      return { version: 1, userId: claims.sub, sessionId: claims.session_id };
    } catch { return null; }
  }
  const matches = (saved, value) => value && saved?.version === 1 && saved.userId === value.userId && saved.sessionId === value.sessionId;
  const read = name => JSON.parse(localStorage.getItem(name));
  return {
    remember(session, verifiedId) {
      const value = identity(session);
      if (value?.userId === verifiedId) try {
        if (!matches(read(key), value)) localStorage.setItem(key, JSON.stringify(value));
      } catch { /* Offline restoration stays unavailable. */ }
    },
    rememberBrightness(session, verifiedId, brightness) {
      const value = identity(session);
      if (value?.userId !== verifiedId || !['auto', 'light', 'dark'].includes(brightness)) return;
      try {
        const saved = read(key);
        // A tab may learn about sign-out or a new session after its latest save.
        if (matches(saved, value) && matches(saved, identity(read(storageKey))) && saved.brightness !== brightness)
          localStorage.setItem(key, JSON.stringify({ ...value, brightness }));
      } catch { /* The hint is optional. */ }
    },
    clear() { try { localStorage.removeItem(key); } catch { /* No pedagogical data is touched. */ } },
    restore(session) {
      const value = identity(session);
      try {
        const saved = JSON.parse(localStorage.getItem(key));
        return matches(saved, value) ? { id: value.userId } : null;
      } catch { return null; }
    },
  };
}
