import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
  workers: 1,
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    // Always our own server: one that is already running was started with
    // .env.local and would write to the live database.
    reuseExistingServer: false,
  },
  use: {
    baseURL: 'http://localhost:3000',
  },
});
