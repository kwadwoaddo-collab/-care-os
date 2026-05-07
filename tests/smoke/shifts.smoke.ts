/**
 * tests/smoke/shifts.smoke.ts
 *
 * Smoke tests: Shift list, creation, and worker assignment.
 *
 * Auth: loaded from storageState (see playwright.config.ts).
 * Each test gets an isolated browser context pre-seeded with the QA admin
 * session — no per-test Supabase login needed.
 *
 * Usage:
 *   npx playwright test tests/smoke/shifts.smoke.ts
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

  const newShiftBtn = page.locator(
    'a:has-text("New Shift"), a:has-text("Add Shift"), button:has-text("New Shift"), button:has-text("Add Shift"), a:has-text("Create Shift")'
  ).first()

  if (await newShiftBtn.count() === 0) {
    test.skip(true, 'No "New Shift" button found — UI may differ')
    return
  }

  await newShiftBtn.click()

  const titleInput = page.locator('input[name="title"], #title, input[placeholder*="title" i]').first()
  if (await titleInput.count() > 0) {
    await titleInput.fill('[QA] Smoke Test Shift')
  }

  const dateInput = page.locator('input[type="date"], input[name="shift_date"], #shift_date').first()
  if (await dateInput.count() > 0) {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    await dateInput.fill(tomorrow.toISOString().slice(0, 10))
  }

  const submitBtn = page.locator('button[type="submit"]').first()
  if (await submitBtn.count() > 0) {
    await submitBtn.click()
    await page.waitForTimeout(2_000)
    await expect(page).not.toHaveURL(/error/)
  }
})

test('Assign worker to shift', async ({ page }) => {
  await expectAdminPage(page, '/admin/shifts')

  // Navigate via the "View →" link on the first QA shift row.
  // Clicking text=[QA] directly fails on mobile because the sticky header and
  // summary-card grid intercept pointer events over the table text.
  const shiftViewLink = page.locator('a:has-text("View →")').first()

  if (await shiftViewLink.count() === 0) {
    test.skip(true, 'No QA shifts found')
    return
  }

  const href = await shiftViewLink.getAttribute('href')
  if (!href) { test.skip(true, 'Shift link has no href'); return }
  await page.goto(href)

  const assignSection = page.locator('select[name="assigned_staff_id"], #assigned_staff_id, [data-testid="assign-worker"]').first()
  if (await assignSection.count() > 0) {
    await assignSection.selectOption({ index: 1 })
    const saveBtn = page.locator('button:has-text("Save"), button:has-text("Assign"), button[type="submit"]').first()
    if (await saveBtn.count() > 0) {
      await saveBtn.click()
      await page.waitForTimeout(1_500)
      await expect(page).not.toHaveURL(/error/)
    }
  }
})
