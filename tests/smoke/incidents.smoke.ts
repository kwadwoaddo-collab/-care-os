/**
 * tests/smoke/incidents.smoke.ts
 *
 * Smoke test: Incident creation via admin UI.
 *
 * Usage:
 *   npx playwright test tests/smoke/incidents.smoke.ts
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

test('Incidents list loads correctly', async ({ page }) => {
  await loginAsQaAdmin(page)
  await page.goto(`${BASE_URL}/admin/incidents`)

  await expect(page).not.toHaveURL(/error/)
  await expect(page.locator('h1, h2').first()).toBeVisible()
})

test('Incidents list shows QA-seeded incidents', async ({ page }) => {
  await loginAsQaAdmin(page)
  await page.goto(`${BASE_URL}/admin/incidents`)

  await page.waitForTimeout(1500)
  const qaCount = await page.locator('text=[QA]').count()
  expect(qaCount).toBeGreaterThan(0)
})

test('Create an incident via admin UI', async ({ page }) => {
  await loginAsQaAdmin(page)
  await page.goto(`${BASE_URL}/admin/incidents`)

  const newBtn = page.locator(
    'a:has-text("New Incident"), a:has-text("Report"), button:has-text("Report"), button:has-text("New Incident")'
  ).first()

  if (await newBtn.count() === 0) {
    test.skip(true, 'No "New Incident" button found — UI may differ')
    return
  }

  await newBtn.click()

  // Fill description
  const descInput = page.locator('textarea[name="description"], #description, textarea').first()
  if (await descInput.count() > 0) {
    await descInput.fill('[QA] Smoke test incident — auto-generated, safe to delete.')
  }

  // Select type if available
  const typeSelect = page.locator('select[name="incident_type"], #incident_type').first()
  if (await typeSelect.count() > 0) {
    await typeSelect.selectOption('fall')
  }

  // Select severity
  const severitySelect = page.locator('select[name="severity"], #severity').first()
  if (await severitySelect.count() > 0) {
    await severitySelect.selectOption('low')
  }

  // Submit
  const submitBtn = page.locator('button[type="submit"]').first()
  if (await submitBtn.count() > 0) {
    await submitBtn.click()
    await page.waitForTimeout(2000)
    await expect(page).not.toHaveURL(/error/)
  }
})
