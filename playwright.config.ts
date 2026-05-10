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

  // Tests within a file run sequentially; browser projects run in parallel.
  // With storageState auth (one Supabase login at setup time, shared across
  // tests), there is no per-test auth request to rate-limit. Using 3 workers
  // means chromium/firefox/mobile-chrome all run concurrently, completing in
  // ~60–90 s instead of the 5-minute sequential run that causes dev server
  // degradation and flaky navigation timeouts.
  fullyParallel: false,
  workers: 3,

  // Retry once on CI to handle flakiness
  retries: process.env.CI ? 1 : 0,

  // Generous test timeout: the full suite runs 50 tests sequentially against a
  // local dev server. After 30+ tests the server's response time can spike due
  // to GC pressure / connection pool churn. 90 s gives enough headroom without
  // masking genuine hangs.
  timeout: 90_000,

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

    // Generous timeouts — local dev server can respond slowly under sequential load
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
  },

  projects: [
    // ── Step 1a: admin login — saves .auth/admin.json ────────────────────────
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },

    // ── Step 1b: worker token validation ─────────────────────────────────────
    // Verifies that the QA worker portal token is seeded in the DB.
    // Runs before "worker" and "worker-mobile" projects.
    // If this fails, run: npm run qa:seed
    {
      name: 'worker-setup',
      testMatch: /worker\.setup\.ts/,
    },

    // ── Step 2: admin-authed browser tests ───────────────────────────────────
    // worker.smoke.ts is excluded here — it runs under the dedicated "worker"
    // and "worker-mobile" projects which inject the worker portal token.
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: adminAuthFile,
      },
      dependencies: ['setup'],
      testIgnore: ['**/auth.smoke.ts', '**/auth.setup.ts', '**/worker.setup.ts', '**/worker.smoke.ts'],
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: adminAuthFile,
      },
      dependencies: ['setup'],
      testIgnore: ['**/auth.smoke.ts', '**/auth.setup.ts', '**/worker.setup.ts', '**/worker.smoke.ts'],
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        storageState: adminAuthFile,
      },
      dependencies: ['setup'],
      testIgnore: ['**/auth.smoke.ts', '**/auth.setup.ts', '**/worker.setup.ts', '**/worker.smoke.ts'],
    },

    // ── Step 3: auth flow tests — explicit login, no storageState ────────────
    {
      name: 'auth-tests',
      use: { ...devices['Desktop Chrome'] },
      testMatch: ['**/auth.smoke.ts'],
    },

    // ── Step 4: authenticated worker portal tests ─────────────────────────────
    // Token injected via page.addInitScript (sessionStorage, not cookies).
    // "worker-setup" validates the token is in the DB before tests run.
    {
      name: 'worker',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['worker-setup'],
      testMatch: ['**/worker.smoke.ts'],
    },
    {
      name: 'worker-mobile',
      use: { ...devices['Pixel 5'] },
      dependencies: ['worker-setup'],
      testMatch: ['**/worker.smoke.ts'],
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
