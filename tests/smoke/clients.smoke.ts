/**
 * tests/smoke/clients.smoke.ts
 *
 * Smoke test: Client list data presence and create-client action.
 *
 * Auth: loaded from storageState (see playwright.config.ts).
 */

import { test, expect } from '@playwright/test'
import { expectAdminPage } from './helpers/auth'

test('Clients list is accessible and contains QA data', async ({ page }) => {
  await expectAdminPage(page, '/admin/clients')
  await expect(page.locator('h1, h2').first()).toBeVisible()
  const qaCount = await page.locator('text=[QA]').count()
  expect(qaCount).toBeGreaterThan(0)
})

test('Create QA client via admin UI', async ({ page }) => {
  await expectAdminPage(page, '/admin/clients')

  // Unique label so multiple runs don't collide
  const ts       = Date.now()
  const lastName = `AutoTest-${ts}`

  // Open the modal
  await page.locator('[data-testid="create-client-btn"]').click()
  await expect(page.locator('[data-testid="create-client-form"]')).toBeVisible()

  // Fill required fields
  await page.locator('[data-testid="create-client-first-name"]').fill('[QA]')
  await page.locator('[data-testid="create-client-last-name"]').fill(lastName)

  // Dispatch native click — the modal backdrop (fixed inset-0) intercepts
  // Playwright's synthetic pointer events even with { force: true }. Calling
  // the DOM click() method bypasses pointer-event hit testing entirely.
  await page.locator('[data-testid="create-client-submit"]').evaluate(
    (el) => (el as HTMLButtonElement).click()
  )

  // Modal closes after success and router.refresh() fires
  await expect(page.locator('[data-testid="create-client-form"]')).not.toBeVisible({ timeout: 10_000 })

  // New client should appear at the top of the list (ordered by created_at desc)
  await expect(page.locator(`text=${lastName}`)).toBeVisible({ timeout: 10_000 })
})
