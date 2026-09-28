import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // the app's `@/…` imports (tsconfig paths), so tests can load modules that use them
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  // tsconfig leaves JSX to Next ("preserve"); tests that render components need it compiled
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    // Each Neon HTTP query takes ~200 ms (the first ~750 ms), so DB tests can
    // exceed vitest's 5 s default on a cold start.
    testTimeout: 30000,
    hookTimeout: 30000,
    exclude: ['**/node_modules/**', '**/tests/e2e/**'],
  },
});
