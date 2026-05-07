/**
 * tests/smoke/helpers/auth.ts
 *
 * Shared Playwright auth helpers for QA smoke tests.
 *
 * Each exported function performs a full Supabase email/password login and
 * waits for navigation away from /admin/login before returning. This means
 * the session cookie is set and the browser is on an authenticated page.
 *
 * Each test should call one of these helpers in a beforeEach or at the top of
 * the test — do NOT share sessions between tests.
 */

import { type Page, expect } from '@playwright/test'

// ── QA credentials (matches docs/qa-testing.md) ───────────────────────────────

const QA_ADMIN       = { email: 'qa-admin@sprintscaleit.co.uk',       password: 'ChangeMe123!' }
const QA_COORDINATOR = { email: 'qa-coordinator@sprintscaleit.co.uk', password: 'ChangeMe123!' }
const QA_WORKER      = { email: 'qa-worker@sprintscaleit.co.uk',      password: 'ChangeMe123!' }

// ── Core login implementation ─────────────────────────────────────────────────

async function performLogin(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/admin/login')

  // Fill credentials
  await page.fill(
    'input[name="email"], input[type="email"], #email',
    email,
  )
  await page.fill(
    'input[name="password"], input[type="password"], #password',
    password,
  )

  await page.click(
    'button[type="submit"], #login-btn, button:has-text("Sign in"), button:has-text("Login")',
  )

  // Wait until the browser leaves /admin/login.
  // NOTE: the regex /\/admin/ also matches /admin/login, which is why we must
  // use waitForURL with a predicate instead of toHaveURL — a false-positive on
  // the login page itself would hide auth failures.
  await page.waitForURL(
    (url) => !new URL(url).pathname.startsWith('/admin/login'),
    { timeout: 15_000 },
  )
}

// ── Public helpers ─────────────────────────────────────────────────────────────

export async function loginAsAdmin(page: Page): Promise<void> {
  await performLogin(page, QA_ADMIN.email, QA_ADMIN.password)
}

export async function loginAsCoordinator(page: Page): Promise<void> {
  await performLogin(page, QA_COORDINATOR.email, QA_COORDINATOR.password)
}

export async function loginAsWorker(page: Page): Promise<void> {
  await performLogin(page, QA_WORKER.email, QA_WORKER.password)
}

/**
 * Navigate to an admin path and assert the session is still valid.
 * Fails the test if middleware bounces the request back to /admin/login.
 */
export async function expectAdminPage(page: Page, path: string): Promise<void> {
  await page.goto(path)
  await expect(page).not.toHaveURL(/\/admin\/login/, { timeout: 10_000 })
  await expect(page).toHaveURL(new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), { timeout: 5_000 })
}
