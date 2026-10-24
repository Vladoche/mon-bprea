// Module partagé : une seule instance par page, restaurée par le SDK entre pages.
let clientPromise;
export async function getSupabaseClient() {
  if (!clientPromise) clientPromise = initialize();
  return clientPromise;
}

export function validateAuthConfiguration(config, pageUrl) {
  if (config?.enabled !== true) return 'unconfigured';
  try {
    if (!['development', 'production'].includes(config.environment)) return 'invalid';
    const endpoint = new URL(config.url);
    const site = new URL(config.siteUrl);
    const current = new URL('.', pageUrl);
    const local = url => ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
    if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== '/') return 'invalid';
    if (endpoint.protocol !== 'https:' && !(config.environment === 'development' && local(endpoint) && endpoint.protocol === 'http:')) return 'invalid';
    if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey || '')) return 'invalid';
    if (site.href !== current.href || site.search || site.hash || site.username || site.password) return 'invalid';
    if (config.environment === 'development' && !local(site)) return 'invalid';
    if (config.environment === 'production' && (local(site) || local(endpoint) || site.protocol !== 'https:')) return 'invalid';
    return null;
  } catch { return 'invalid'; }
}

async function initialize() {
  const response = await fetch(new URL('./auth-config.json', import.meta.url), { cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('configuration');
  const config = await response.json();
  const problem = validateAuthConfiguration(config, location.href);
  if (problem) return { client: null, configurationError: problem };
  const { createClient } = await import('./vendor/supabase.js');
  // Le SDK gère exclusivement cette clé ; aucune clé pédagogique n'est modifiée.
  const client = createClient(config.url, config.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false,
      flowType: 'pkce', storageKey: `bprea-auth-${new URL(config.url).hostname}-${new URL(config.siteUrl).pathname}` },
    global: { fetch: (url, options = {}) => fetch(url, { ...options, signal: options.signal || AbortSignal.timeout(15000) }) },
  });
  return { client, siteUrl: config.siteUrl, environment: config.environment, url: config.url };
}
