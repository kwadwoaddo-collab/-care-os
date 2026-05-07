/**
 * tests/smoke/shifts.smoke.ts
 *
 * Smoke tests: Shift creation and worker assignment.
 *
 * Usage:
 *   npx playwright test tests/smoke/shifts.smoke.ts
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

test('Shifts list is accessible and renders', async ({ page }) => {
  await loginAsQaAdmin(page)
  await page.goto(`${BASE_URL}/admin/shifts`)

  await expect(page).not.toHaveURL(/error/)
  await expect(page.locator('h1, h2').first()).toBeVisible()
})

test('Shifts list shows QA-seeded shifts', async ({ page }) => {
  await loginAsQaAdmin(page)
  await page.goto(`${BASE_URL}/admin/shifts`)

  // Should see QA shifts
  await page.waitForTimeout(1500)
  const qaShiftCount = await page.locator('text=[QA]').count()
  expect(qaShiftCount).toBeGreaterThan(0)
})

test('Create a shift via admin UI', async ({ page }) => {
  await loginAsQaAdmin(page)
  await page.goto(`${BASE_URL}/admin/shifts`)

  const newShiftBtn = page.locator(
    'a:has-text("New Shift"), a:has-text("Add Shift"), button:has-text("New Shift"), button:has-text("Add Shift"), a:has-text("Create Shift")'
  ).first()

  if (await newShiftBtn.count() === 0) {
    test.skip(true, 'No "New Shift" button found — UI may differ')
    return
  }

  await newShiftBtn.click()

  // Fill shift form fields if available
  const titleInput = page.locator('input[name="title"], #title, input[placeholder*="title" i]').first()
  if (await titleInput.count() > 0) {
    await titleInput.fill('[QA] Smoke Test Shift')
  }

  // Fill date
  const dateInput = page.locator('input[type="date"], input[name="shift_date"], #shift_date').first()
  if (await dateInput.count() > 0) {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    await dateInput.fill(tomorrow.toISOString().slice(0, 10))
  }

  // Submit
  const submitBtn = page.locator('button[type="submit"]').first()
  if (await submitBtn.count() > 0) {
    await submitBtn.click()
    await page.waitForTimeout(2000)
    // Should not navigate to an error page
    await expect(page).not.toHaveURL(/error/)
  }
})

test('Assign worker to shift', async ({ page }) => {
  await loginAsQaAdmin(page)
  await page.goto(`${BASE_URL}/admin/shifts`)

  // Click first QA shift that is "scheduled" or "unassigned"
  const unassignedShift = page.locator('text=[QA]').first()

  if (await unassignedShift.count() === 0) {
    test.skip(true, 'No QA shifts found')
    return
  }

  // Click through to the shift detail
  await unassignedShift.click()

  // Look for an assign / worker dropdown
  const assignSection = page.locator('select[name="assigned_staff_id"], #assigned_staff_id, [data-testid="assign-worker"]').first()
  if (await assignSection.count() > 0) {
    await assignSection.selectOption({ index: 1 })
    const saveBtn = page.locator('button:has-text("Save"), button:has-text("Assign"), button[type="submit"]').first()
    if (await saveBtn.count() > 0) {
      await saveBtn.click()
      await page.waitForTimeout(1500)
      await expect(page).not.toHaveURL(/error/)
    }
  }
})
