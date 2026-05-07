import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for Care OS smoke tests.
 *
 * See: https://playwright.dev/docs/test-configuration
 *
 * Usage:
 *   npx playwright test tests/smoke/         # Run all smoke tests
 *   npx playwright test tests/smoke/auth.smoke.ts  # Run one file
 *   PLAYWRIGHT_BASE_URL=https://staging.example.com npx playwright test tests/smoke/
 */

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.smoke.ts',

  // Run tests in files sequentially (avoids race conditions on shared QA data)
  fullyParallel: false,

  // Retry once on CI to handle flakiness
  retries: process.env.CI ? 1 : 0,

  // Reporter
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  use: {
    // Populated from env or defaults to local dev
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',

    // Capture screenshot on failure
    screenshot: 'only-on-failure',

    // Trace on retry
    trace: 'on-first-retry',

    // Use a sensible timeout
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  // Start dev server automatically if not already running
  // Uncomment to use:
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120_000,
  // },
})
