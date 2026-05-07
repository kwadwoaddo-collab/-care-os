/**
 * tests/smoke/auth.smoke.ts
 *
 * Smoke test: Login flow for QA environment.
 *
 * Verifies that QA auth users can sign in successfully and are
 * redirected to the admin dashboard.
 *
 * Usage:
 *   npx playwright test tests/smoke/auth.smoke.ts
 */

import { test, expect } from '@playwright/test'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

const QA_USERS = [
  { email: 'qa-admin@sprintscaleit.co.uk',       password: 'ChangeMe123!', role: 'company_admin' },
  { email: 'qa-coordinator@sprintscaleit.co.uk', password: 'ChangeMe123!', role: 'coordinator'   },
  { email: 'qa-worker@sprintscaleit.co.uk',      password: 'ChangeMe123!', role: 'care_worker'   },
]

for (const user of QA_USERS) {
  test(`Login as ${user.role} (${user.email})`, async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/login`)

    // Fill login form
    await page.fill('input[type="email"], input[name="email"], #email', user.email)
    await page.fill('input[type="password"], input[name="password"], #password', user.password)
    await page.click('button[type="submit"], #login-btn, button:has-text("Sign in"), button:has-text("Login")')

    // Should be redirected to admin area or show authenticated state
    await expect(page).toHaveURL(/\/(admin|worker)/, { timeout: 10_000 })

    // QA banner should be visible since this is the QA company
    const banner = page.locator('#qa-environment-banner')
    if (await banner.count() > 0) {
      await expect(banner).toBeVisible()
      await expect(banner).toContainText('QA Environment')
    }
  })
}

test('Login with invalid credentials shows error', async ({ page }) => {
  await page.goto(`${BASE_URL}/admin/login`)

  await page.fill('input[type="email"], input[name="email"], #email', 'notreal@example.com')
  await page.fill('input[type="password"], input[name="password"], #password', 'wrongpassword')
  await page.click('button[type="submit"], #login-btn, button:has-text("Sign in"), button:has-text("Login")')

  // Should NOT navigate away — still on login page or show error
  await page.waitForTimeout(2000)
  const url = page.url()
  const isStillOnLogin = url.includes('login') || url.includes('error')
  expect(isStillOnLogin || (await page.locator('text=/invalid|incorrect|error/i').count()) > 0).toBeTruthy()
})
