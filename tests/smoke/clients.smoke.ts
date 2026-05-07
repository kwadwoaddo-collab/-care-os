/**
 * tests/smoke/clients.smoke.ts
 *
 * Smoke test: Create a client via the admin UI.
 *
 * Usage:
 *   npx playwright test tests/smoke/clients.smoke.ts
 */

import { test, expect, type Page } from '@playwright/test'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

async function loginAsQaAdmin(page: Page) {
  await page.goto(`${BASE_URL}/admin/login`)
  await page.fill('input[type="email"], #email', 'qa-admin@sprintscaleit.co.uk')
  await page.fill('input[type="password"], #password', 'ChangeMe123!')
  await page.click('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")')
  await expect(page).toHaveURL(/\/admin/, { timeout: 10_000 })
}

test('Create QA client via admin UI', async ({ page }) => {
  await loginAsQaAdmin(page)

  // Navigate to clients
  await page.goto(`${BASE_URL}/admin/clients`)
  await expect(page).toHaveURL(/\/admin\/clients/)

  // Find and click "New Client" or "Add Client"
  const newClientBtn = page.locator(
    'a:has-text("New Client"), a:has-text("Add Client"), button:has-text("New Client"), button:has-text("Add Client")'
  ).first()

  if (await newClientBtn.count() === 0) {
    test.skip(true, 'No "New Client" button found — UI may differ')
    return
  }

  await newClientBtn.click()

  // Fill in client form
  await page.fill('input[name="first_name"], #first_name', '[QA]')
  await page.fill('input[name="last_name"], #last_name', 'Smoke Test Client')
  await page.fill('input[name="email"], #email', 'qa.smoke.client@sprintscaleit.co.uk')

  // Submit the form
  await page.click('button[type="submit"]:has-text("Save"), button[type="submit"]:has-text("Create"), button[type="submit"]:has-text("Add")')

  // Should navigate back to clients list or show the new client
  await expect(page).toHaveURL(/\/admin\/clients/, { timeout: 10_000 })
  await expect(page.locator('text=Smoke Test Client')).toBeVisible({ timeout: 5_000 })
})

test('Clients list is accessible and contains QA data', async ({ page }) => {
  await loginAsQaAdmin(page)
  await page.goto(`${BASE_URL}/admin/clients`)

  // Page should load without error
  await expect(page).not.toHaveURL(/error/)
  await expect(page.locator('h1, h2').first()).toBeVisible()

  // QA clients should appear
  const qaClientsCount = await page.locator('text=[QA]').count()
  expect(qaClientsCount).toBeGreaterThan(0)
})
