// Server only. No browser import, SQL mutation or retained deletion ledger.
export const CLOSURE_TABLES = Object.freeze(['profiles', 'drill_series', 'drill_answers', 'drill_training_attempts',
  'course_states', 'quiz_attempts', 'botanical_sessions', 'botanical_answers', 'itk_settings', 'appearance_preferences']);
const encoder = new TextEncoder(), decoder = new TextDecoder();
const denied = code => Object.assign(new Error(code), { code });
const base64 = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
const unbase64 = text => Uint8Array.from(atob(text.replaceAll('-', '+').replaceAll('_', '/')), char => char.charCodeAt(0));
const digest = async text => base64(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text))));
const exact = (value, fields) => value && !Array.isArray(value) && Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field));
export function createClosureHandler({ api, receiptKey, origin, enabled = false, now = Date.now }) {
  const key = receiptKey && /^[0-9a-f]{64}$/i.test(receiptKey)
    ? crypto.subtle.importKey('raw', Uint8Array.from(receiptKey.match(/../g), byte => parseInt(byte, 16)), 'AES-GCM', false, ['encrypt', 'decrypt']) : null;
  async function seal(value) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const bytes = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(origin) }, await key, encoder.encode(JSON.stringify(value)));
    return `${base64(iv)}.${base64(new Uint8Array(bytes))}`;
  }
  async function open(receipt, token) {
    if (typeof receipt !== 'string' || receipt.length > 2048 || !/^[\w-]+\.[\w-]+$/.test(receipt)) throw denied('proof');
    try {
      const [iv, encrypted] = receipt.split('.');
      const value = JSON.parse(decoder.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unbase64(iv), additionalData: encoder.encode(origin) }, await key, unbase64(encrypted))));
      if (value.version !== 1 || value.expires <= now() || value.issued > now() || value.tokenHash !== await digest(token)) throw denied('proof');
      return value;
    } catch { throw denied('proof'); }
  }
  const absent = value => value?.auth === 'absent' && exact(value.counts, CLOSURE_TABLES) && Object.values(value.counts).every(count => count === 0);
  return async request => {
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin',
      'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization,apikey,content-type', 'Access-Control-Allow-Methods': 'POST,OPTIONS' };
    const reply = (status, body) => new Response(JSON.stringify(body), { status, headers });
    if (!enabled || !key) return reply(503, { status: 'disabled' });
    if (request.headers.get('Origin') !== origin) return reply(403, { status: 'forbidden' });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply(405, { status: 'method' });
    const authorization = request.headers.get('Authorization') || '';
    if (!/^Bearer [A-Za-z0-9_.-]{20,8192}$/.test(authorization)) return reply(401, { status: 'identity' });
    const token = authorization.slice(7);
    try {
      if (!request.headers.get('Content-Type')?.startsWith('application/json') || Number(request.headers.get('Content-Length')) > 8192) throw denied('request');
      // Bound the stream before parsing, including requests without Content-Length.
      const reader = request.body?.getReader(); if (!reader) throw denied('request');
      let bytes = 0, text = '', timedOut = false;
      const bodyDecoder = new TextDecoder('utf-8', { fatal: true });
      const timer = setTimeout(() => { timedOut = true; reader.cancel().catch(() => {}); }, 5000);
      try {
        for (;;) { const next = await reader.read(); if (next.done) break; bytes += next.value.byteLength;
          if (bytes > 8192) { await reader.cancel(); throw denied('request'); } text += bodyDecoder.decode(next.value, { stream: true }); }
        text += bodyDecoder.decode(); if (timedOut) throw denied('request');
      } finally { clearTimeout(timer); }
      const body = JSON.parse(text);
      if (body.confirmation !== 'SUPPRIMER') throw denied('confirmation');
      if (body.action === 'prepare' && exact(body, ['action', 'password', 'confirmation'])) {
        if (typeof body.password !== 'string' || body.password.length < 1 || body.password.length > 1024) throw denied('request');
        const user = await api.getUser(token);
        if (!user?.id || !user.email || user.is_anonymous || user.factors?.some(factor => factor.status === 'verified')) throw denied('identity');
        let reauthenticated;
        try { reauthenticated = await api.reauthenticate(user.email, body.password); } finally { body.password = ''; }
        if (reauthenticated?.id !== user.id) throw denied('identity');
        // Auth has verified this exact token above. exp is not accepted alone as identity.
        const claims = JSON.parse(decoder.decode(unbase64(token.split('.')[1])));
        if (claims.sub !== user.id || !Number.isFinite(claims.exp) || claims.exp * 1000 < now() + 30000) throw denied('identity');
        const receipt = await seal({ version: 1, id: user.id, tokenHash: await digest(token), issued: now(),
          expires: Math.min(now() + 5 * 60000, claims.exp * 1000), nonce: crypto.randomUUID() });
        return reply(200, { status: 'identity_verified', receipt });
      }
      if (body.action !== 'execute' || !exact(body, ['action', 'receipt', 'confirmation'])) throw denied('request');
      const proof = await open(body.receipt, token);
      const before = await api.inspect(proof.id, token);
      // A lost acknowledgement can be checked with the original bound capability.
      // This branch never initiates another administrative operation.
      if (absent(before)) return reply(200, { status: 'server_confirmed' });
      if (before?.auth !== 'present') return reply(409, { status: 'server_unconfirmed', reason: 'inspection' });
      const user = await api.getUser(token);
      if (user?.id !== proof.id) {
        if (absent(await api.inspect(proof.id, token))) return reply(200, { status: 'server_confirmed' });
        throw denied('identity');
      }
      try { await api.deleteUser(user.id); } catch { /* Network failure may follow an actual commit. Inspect before claiming anything. */ }
      try {
        const after = await api.inspect(proof.id, token);
        return absent(after) ? reply(200, { status: 'server_confirmed' }) : reply(409, { status: 'server_unconfirmed', reason: 'verification' });
      } catch { return reply(409, { status: 'server_unconfirmed', reason: 'verification' }); }
    } catch (issue) {
      const status = ['identity', 'proof'].includes(issue.code) ? 401 : ['request', 'confirmation'].includes(issue.code) || issue instanceof SyntaxError ? 400 : 409;
      return reply(status, { status: status === 401 ? 'identity' : status === 400 ? 'request_rejected' : 'server_unconfirmed' });
    }
  };
}
