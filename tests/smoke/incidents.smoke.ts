/**
 * tests/smoke/incidents.smoke.ts
 *
 * Smoke test: Incidents list data presence and create-incident action.
 *
 * Auth: loaded from storageState (see playwright.config.ts).
 */

import { test, expect } from '@playwright/test'
import { expectAdminPage } from './helpers/auth'

test('Incidents list loads correctly', async ({ page }) => {
  await expectAdminPage(page, '/admin/incidents')
  await expect(page.locator('h1, h2').first()).toBeVisible()
})

test('Incidents list shows QA-seeded incidents', async ({ page }) => {
  await expectAdminPage(page, '/admin/incidents')
  await page.waitForTimeout(1_500)
  const qaCount = await page.locator('text=[QA]').count()
  expect(qaCount).toBeGreaterThan(0)
})

test('Create an incident via admin UI', async ({ page }) => {
  await expectAdminPage(page, '/admin/incidents')

  const ts = Date.now()

  // Open the create form
  await page.locator('[data-testid="create-incident-btn"]').click()

  // Modal backdrop / form should appear
  const descField = page.locator('[data-testid="create-incident-description"]')
  await expect(descField).toBeVisible()

  // Fill description (the only required field)
  await descField.fill(`[QA TEST] Automated smoke test incident. Safe to delete. ts=${ts}`)

  // Dispatch native click — the modal backdrop (fixed inset-0) intercepts
  // Playwright's synthetic pointer events even with { force: true }.
  await page.locator('[data-testid="create-incident-submit"]').evaluate(
    (el) => (el as HTMLButtonElement).click()
  )

  // Expect success state
  await expect(page.locator('[data-testid="create-incident-success"]')).toBeVisible({ timeout: 10_000 })
})
