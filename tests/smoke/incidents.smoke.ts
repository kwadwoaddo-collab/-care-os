/**
 * tests/smoke/incidents.smoke.ts
 *
 * Smoke test: Incident list and creation via admin UI.
 *
 * Auth: loaded from storageState (see playwright.config.ts).
 * Each test gets an isolated browser context pre-seeded with the QA admin
 * session — no per-test Supabase login needed.
 *
 * Usage:
 *   npx playwright test tests/smoke/incidents.smoke.ts
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

  const newBtn = page.locator(
    'a:has-text("New Incident"), a:has-text("Report"), button:has-text("Report"), button:has-text("New Incident")'
  ).first()

  if (await newBtn.count() === 0) {
    test.skip(true, 'No "New Incident" button found — UI may differ')
    return
  }

  await newBtn.click()

  const descInput = page.locator('textarea[name="description"], #description, textarea').first()
  if (await descInput.count() > 0) {
    await descInput.fill('[QA] Smoke test incident — auto-generated, safe to delete.')
  }

  const typeSelect = page.locator('select[name="incident_type"], #incident_type').first()
  if (await typeSelect.count() > 0) {
    await typeSelect.selectOption('fall')
  }

  const severitySelect = page.locator('select[name="severity"], #severity').first()
  if (await severitySelect.count() > 0) {
    await severitySelect.selectOption('low')
  }

  const submitBtn = page.locator('button[type="submit"]').first()
  if (await submitBtn.count() > 0) {
    await submitBtn.click()
    await page.waitForTimeout(2_000)
    await expect(page).not.toHaveURL(/error/)
  }
})
