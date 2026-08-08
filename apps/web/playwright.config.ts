import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html'], ['list']],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 14'] } },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    // Always reuse whatever's already listening on 3000 instead of trying
    // to start a second server. This was `!process.env.CI` — backwards: CI's
    // own workflow already starts the built web server as its own step
    // *specifically* so tests can hit it, but that inverted flag forced
    // Playwright to spawn a second `pnpm dev` on the same port anyway,
    // which fails immediately with "port already used" — CI could never
    // get past this once the earlier startup/health-check bugs were fixed.
    reuseExistingServer: true,
    timeout: 120000,
  },
});
