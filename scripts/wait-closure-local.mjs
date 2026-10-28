import { setTimeout as pause } from 'node:timers/promises';
import { getLocalSupabaseEnvironment } from '../tests/helpers/auth-local.js';
const environment = getLocalSupabaseEnvironment(), deadline = Date.now() + 45000;
let ready = false;
while (Date.now() < deadline) {
  try {
    const response = await fetch(`${environment.url}/functions/v1/close-account`, { method: 'OPTIONS',
      headers: { Origin: 'http://127.0.0.1:4173' }, signal: AbortSignal.timeout(2000) });
    if (response.status === 204) { ready = true; break; }
  } catch { /* Bounded startup polling, no sensitive output. */ }
  await pause(200);
}
if (!ready) throw new Error('Le prototype de clôture local n’est pas disponible ; aucune recette distante de remplacement.');
console.log('Edge Function locale disponible.');
