import { pathToFileURL } from 'node:url';
import { playwrightCLI, runNode } from './ci-command.mjs';

// One ephemeral stack, UUID/email fixtures private to each process. The browser
// remains at one worker; none of these suites reuses the Auth expiry accounts.
// Chromium découvre aussi auth-manual.spec.js : generateLink sans SMTP,
// activation/récupération, expiration serveur et nettoyages Auth/profils vérifiés.
export async function runSupabaseSuites(run = runNode) {
  const outcomes = await Promise.allSettled([
    run('Auth réel (expiration comprise)', ['scripts/test-supabase.mjs']),
    (async () => {
      await run('Backend Drill réel', ['scripts/test-drill-supabase.mjs']);
      await run('Backend personnel réel', ['scripts/test-personal-data-supabase.mjs']);
      await run('Préparation Chromium Supabase', ['scripts/install-chromium.mjs']);
      await run('Chromium Supabase réel', [playwrightCLI, 'test', '--config=playwright.supabase.config.js']);
    })(),
  ]);
  // Always join BOTH branches, including their targeted cleanup, before failure
  // reaches the workflow's always() stack shutdown. No fail-fast orphan process.
  if (outcomes.some(outcome => outcome.status === 'rejected')) throw new Error('Au moins une suite Supabase a échoué ; voir les codes et mesures ci-dessus.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await runSupabaseSuites(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
