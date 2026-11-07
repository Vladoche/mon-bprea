import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('../', import.meta.url));

export default defineConfig({
  testDir: './e2e',
  outputDir: fileURLToPath(new URL('../test-results/', import.meta.url)),
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never', outputFolder: fileURLToPath(new URL('../playwright-report/', import.meta.url)) }]],
  use: {
    baseURL: 'http://127.0.0.1:4173/',
    timezoneId: 'Europe/Paris',
    locale: 'fr-FR',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    cwd: repository,
    command: 'node scripts/test-server.mjs',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: false,
    timeout: 30000,
  },
});
