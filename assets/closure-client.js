import { publishPrivacy } from './privacy-events.js';
export function closureAvailable(config, site = globalThis.location?.origin) {
  return config?.localAccountClosure === true && config.environment === 'development' &&
    config.url === 'http://127.0.0.1:54321' && site === 'http://127.0.0.1:4173';
}
export function createClosureClient({ auth, configuration, fetcher = globalThis.fetch, available = closureAvailable(configuration) }) {
  let ticket, running = false, disposed = false;
  const fail = () => { throw new Error('La suppression serveur n’est pas confirmée. Réessaie la même demande si la preuve reste valable ; sinon un traitement manuel sera nécessaire.'); };
  const unsubscribe = auth.subscribe(state => { if (ticket && state.user?.id && state.user.id !== ticket.id) ticket = null; });
  async function call(body, token) {
    try {
      const result = await fetcher(new URL('/functions/v1/close-account', configuration.url), { method: 'POST', cache: 'no-store',
        headers: { Authorization: `Bearer ${token}`, apikey: configuration.publishableKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
      const value = await result.json(); if (!result.ok) fail(); return value;
    } catch { fail(); }
  }
  return {
    async prepare(password, confirmation) {
      if (!available || running || disposed || confirmation !== 'SUPPRIMER') fail();
      ticket = null; running = true;
      try {
        const version = auth.getIdentityVersion(), id = auth.getState().user?.id;
        const session = await auth.verifiedSession(id);
        if (disposed || version !== auth.getIdentityVersion() || auth.getState().status !== 'authenticated' || session.userId !== id) fail();
        const result = await call({ action: 'prepare', password, confirmation }, session.accessToken);
        if (disposed || version !== auth.getIdentityVersion() || auth.getState().user?.id !== id || result.status !== 'identity_verified' || typeof result.receipt !== 'string') fail();
        ticket = { id, token: session.accessToken, receipt: result.receipt }; return true;
      } finally { password = ''; running = false; }
    },
    async execute() {
      if (!available || !ticket || running || disposed) fail();
      const proof = ticket; running = true; publishPrivacy('suspend');
      try {
        const result = await call({ action: 'execute', receipt: proof.receipt, confirmation: 'SUPPRIMER' }, proof.token);
        if (disposed || ticket !== proof || result.status !== 'server_confirmed') fail();
        ticket = null;
        try { await auth.signOut(); } catch { return { server: 'confirmed', local: 'not_cleaned', session: 'incomplete' }; }
        return { server: 'confirmed', local: 'not_cleaned', session: 'ended' };
      } finally { running = false; publishPrivacy('settled'); }
    },
    canRetry: () => !!ticket && !running,
    stop() { disposed = true; ticket = null; unsubscribe(); },
  };
}
