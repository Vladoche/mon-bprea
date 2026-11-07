import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Les dates civiles historiques du calendrier suivent le navigateur local.
// Une seule convention explicite rend aussi ces cas reproductibles en CI.
process.env.TZ = 'Europe/Paris';

export default defineConfig({
  root: fileURLToPath(new URL('../', import.meta.url)),
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.js', 'tests/integration/**/*.test.js'],
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
  },
});
