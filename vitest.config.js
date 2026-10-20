import { defineConfig } from 'vitest/config';

// Les dates civiles historiques du calendrier suivent le navigateur local.
// Une seule convention explicite rend aussi ces cas reproductibles en CI.
process.env.TZ = 'Europe/Paris';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.js', 'tests/integration/**/*.test.js'],
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
  },
});
