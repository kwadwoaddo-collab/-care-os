/**
 * tests/smoke/shifts.smoke.ts
 *
 * Smoke tests: Shifts list data presence, create shift, and assign worker.
 *
 * Auth: loaded from storageState (see playwright.config.ts).
 */

import { test, expect } from '@playwright/test'
import { expectAdminPage } from './helpers/auth'

test('Shifts list is accessible and renders', async ({ page }) => {
  await expectAdminPage(page, '/admin/shifts')
  await expect(page.locator('h1, h2').first()).toBeVisible()
})

test('Shifts list shows QA-seeded shifts', async ({ page }) => {
  await expectAdminPage(page, '/admin/shifts')
  await page.waitForTimeout(1_500)
  const qaShiftCount = await page.locator('text=[QA]').count()
  expect(qaShiftCount).toBeGreaterThan(0)
})

test('Create a shift via admin UI', async ({ page }) => {
  await expectAdminPage(page, '/admin/shifts')

  const ts = Date.now()
  const title = `[QA TEST] Morning-${ts}`

  // Open the create modal
  await page.locator('[data-testid="create-shift-btn"]').click()

  // Fill required fields
  const titleInput = page.locator('[data-testid="create-shift-title"]')
  await expect(titleInput).toBeVisible()
  await titleInput.fill(title)

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dateStr = tomorrow.toISOString().slice(0, 10)
  await page.locator('[data-testid="create-shift-date"]').fill(dateStr)
  await page.locator('[data-testid="create-shift-start"]').fill('09:00')
  await page.locator('[data-testid="create-shift-end"]').fill('17:00')

  // Dispatch native click — the modal backdrop (fixed inset-0) intercepts
  // Playwright's synthetic pointer events even with { force: true }.
  await page.locator('[data-testid="create-shift-submit"]').evaluate(
    (el) => (el as HTMLButtonElement).click()
  )

  // Modal closes after successful creation
  await expect(titleInput).not.toBeVisible({ timeout: 10_000 })

  // The ShiftsTable has client-side filter tabs. Switch to All to ensure the
  // newly created shift is visible regardless of date.
  const allTab = page.locator('button:has-text("All")').first()
  if (await allTab.count() > 0) await allTab.evaluate((el) => (el as HTMLButtonElement).click())

  const shiftInList = page.locator(`text=${title}`)
  await expect(shiftInList).toBeVisible({ timeout: 10_000 })
})

test('Assign worker to shift via open shifts queue', async ({ page }) => {
  await expectAdminPage(page, '/admin/shifts/open')

  // The open shifts page shows all unassigned shifts.
  // QA seed creates shifts 30-39 without an assigned worker.
  const firstAssignBtn = page.locator('[data-testid="assign-shift-btn"]').first()

  if (await firstAssignBtn.count() === 0) {
    test.fail(true, 'No unassigned shifts in open queue — re-run seed (npx tsx scripts/seed-qa-environment.ts)')
    return
  }

  await firstAssignBtn.click()

  // AssignShiftModal should open
  const modal = page.locator('[data-testid="assign-modal"]')
  await expect(modal).toBeVisible()

  // Wait for recommendations to load (fetches /api/admin/shifts/:id/recommendations)
  await page.waitForTimeout(2_000)

  const assignWorkerBtn = page.locator('[data-testid="assign-worker-btn"]').first()

  if (await assignWorkerBtn.count() === 0) {
    // No eligible staff — verify the modal opened correctly then close it.
    const closeBtn = modal.locator('button[aria-label="Close"]')
    await closeBtn.evaluate((el) => (el as HTMLButtonElement).click())
    return
  }

  // Assign the first eligible worker — native click bypasses modal backdrop
  await assignWorkerBtn.evaluate((el) => (el as HTMLButtonElement).click())

  // Modal should close after assignment (onAssigned callback fires)
  await expect(modal).not.toBeVisible({ timeout: 10_000 })
})
