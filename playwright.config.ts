import path from 'path'
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
 *
 * Auth strategy
 * ─────────────
 * Logging in via Supabase signInWithPassword on every test would quickly hit
 * the per-email rate limit when tests run in parallel or in rapid succession.
 *
 * Instead we use Playwright's recommended storageState pattern:
 *   1. The "setup" project runs auth.setup.ts once, logs in as the QA admin,
 *      and saves the browser's storage state (cookies + localStorage) to
 *      .auth/admin.json.
 *   2. Browser projects (chromium, firefox, mobile-chrome) depend on "setup"
 *      and load .auth/admin.json as their initial storageState. Each TEST gets
 *      its own isolated browser context initialised from that state, so tests
 *      are independent and no live session is shared.
 *   3. The "auth-tests" project runs auth.smoke.ts WITHOUT storageState, so
 *      those tests exercise the real login flow end-to-end.
 */

const adminAuthFile = path.join(__dirname, '.auth', 'admin.json')

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.smoke.ts',

  // Tests within a file run sequentially; across files can run in parallel
  // (capped by workers). Keep a modest worker count since the dev server is
  // local and Supabase has per-IP rate limits on auth endpoints.
  fullyParallel: false,
  workers: 1,

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
    // ── Step 1: login once, save auth state ──────────────────────────────────
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },

    // ── Step 2: browser projects — load pre-saved auth state ─────────────────
    // Each test gets an isolated browser context initialised from the saved
    // storageState. Tests never share live sessions; no per-test Supabase login.
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: adminAuthFile,
      },
      dependencies: ['setup'],
      testIgnore: ['**/auth.smoke.ts', '**/auth.setup.ts'],
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: adminAuthFile,
      },
      dependencies: ['setup'],
      testIgnore: ['**/auth.smoke.ts', '**/auth.setup.ts'],
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        storageState: adminAuthFile,
      },
      dependencies: ['setup'],
      testIgnore: ['**/auth.smoke.ts', '**/auth.setup.ts'],
    },

    // ── Step 3: auth tests — NO storageState, explicit login per test ─────────
    // auth.smoke.ts tests the login flow itself; it must start unauthenticated.
    {
      name: 'auth-tests',
      use: { ...devices['Desktop Chrome'] },
      testMatch: ['**/auth.smoke.ts'],
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
