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
    // The test database has no staff passwords saved, and without any the
    // sign-in form only says it is not set up. This is a hash nobody knows the
    // password of: staff tests sign in with a cookie, not through the form.
    env: { STAFF_ADMIN_PASSWORD_HASH: 'scrypt:AAAAAAAAAAAAAAAAAAAAAA==:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' },
  },
  use: {
    baseURL: 'http://localhost:3000',
  },
});
