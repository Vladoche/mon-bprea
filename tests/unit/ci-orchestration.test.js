import { describe, expect, it } from 'vitest';
import { runSupabaseSuites } from '../../scripts/test-supabase-ci.mjs';

const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

describe('Orchestration CI Supabase', () => {
  it('exécute les suites indépendantes pendant Auth et attend son nettoyage avant de terminer', async () => {
    const auth = deferred(), browser = deferred(), browserStarted = deferred();
    const labels = []; let finished = false;
    const result = runSupabaseSuites(async label => {
      labels.push(label);
      if (label.startsWith('Auth')) await auth.promise;
      if (label === 'Chromium Supabase réel') { browserStarted.resolve(); await browser.promise; }
    }).then(() => { finished = true; });
    await browserStarted.promise;
    expect(labels).toEqual(['Auth réel (expiration comprise)', 'Backend Drill réel', 'Backend personnel réel', 'Préparation Chromium Supabase', 'Chromium Supabase réel']);
    browser.resolve(); await Promise.resolve();
    expect(finished).toBe(false);
    auth.resolve(); await result;
    expect(finished).toBe(true);
  });

  it.each(['Auth', 'Backend Drill', 'Backend personnel', 'Préparation Chromium', 'Chromium Supabase'])('conserve un échec %s et rejoint l’autre branche', async failing => {
    const auth = deferred(), independent = deferred(); let joined = false;
    const result = runSupabaseSuites(async label => {
      if (label.startsWith('Auth')) await auth.promise;
      else { independent.resolve(); }
      if (label.startsWith(failing)) throw new Error('Échec contrôlé');
    }).catch(() => { joined = true; });
    await independent.promise;
    expect(joined).toBe(false);
    auth.resolve(); await result;
    expect(joined).toBe(true);
  });
});
