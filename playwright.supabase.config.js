import { defineConfig, devices } from '@playwright/test';
import { getLocalSupabaseEnvironment } from './tests/helpers/auth-local.js';

// Lancement explicite seulement : aucune dépendance Supabase dans test:e2e.
// Une configuration absente provoque un échec explicite, jamais un test ignoré.
getLocalSupabaseEnvironment();

export default defineConfig({
  testDir: './tests/e2e-supabase',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173/',
    timezoneId: 'Europe/Paris',
    locale: 'fr-FR',
    // Les traces réseau contiendraient des sessions réelles : aucun artefact.
    trace: 'off', screenshot: 'off', video: 'off',
  },
  projects: [{ name: 'chromium-supabase-local', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node scripts/test-server.mjs',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
