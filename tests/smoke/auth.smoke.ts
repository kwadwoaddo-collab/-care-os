/**
 * tests/smoke/auth.smoke.ts
 *
 * Smoke test: Login flow for QA environment.
 *
 * Verifies that QA auth users can sign in successfully and are
 * redirected off the login page into an authenticated area.
 *
 * Usage:
 *   npx playwright test tests/smoke/auth.smoke.ts
 */

import { test, expect } from '@playwright/test'

const QA_USERS = [
  { email: 'qa-admin@sprintscaleit.co.uk',       password: 'ChangeMe123!', role: 'company_admin' },
  { email: 'qa-coordinator@sprintscaleit.co.uk', password: 'ChangeMe123!', role: 'coordinator'   },
  { email: 'qa-worker@sprintscaleit.co.uk',      password: 'ChangeMe123!', role: 'care_worker'   },
]

for (const user of QA_USERS) {
  test(`Login as ${user.role} (${user.email})`, async ({ page }) => {
    await page.goto('/admin/login')

    await page.fill('input[name="email"], input[type="email"], #email', user.email)
    await page.fill('input[name="password"], input[type="password"], #password', user.password)
    await page.click('button[type="submit"], #login-btn, button:has-text("Sign in"), button:has-text("Login")')

    // Must navigate away from /admin/login — /admin/login matching /\/admin/ is
    // a false-positive; use a predicate to catch silent login failures.
    await page.waitForURL(
      (url) => !new URL(url).pathname.startsWith('/admin/login'),
      { timeout: 15_000 },
    )

    // QA banner should be visible since this is the QA company
    const banner = page.locator('#qa-environment-banner')
    if (await banner.count() > 0) {
      await expect(banner).toBeVisible()
      await expect(banner).toContainText('QA Environment')
    }
  })
}

test('Login with invalid credentials shows error', async ({ page }) => {
  await page.goto('/admin/login')

  await page.fill('input[name="email"], input[type="email"], #email', 'notreal@example.com')
  await page.fill('input[name="password"], input[type="password"], #password', 'wrongpassword')
  await page.click('button[type="submit"], #login-btn, button:has-text("Sign in"), button:has-text("Login")')

  // Should NOT navigate away from the login page
  await page.waitForTimeout(2_000)
  const url = page.url()
  const isStillOnLogin = url.includes('/login')
  const hasErrorText   = (await page.locator('text=/invalid|incorrect|error/i').count()) > 0
  expect(isStillOnLogin || hasErrorText).toBeTruthy()
})
