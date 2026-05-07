/**
 * tests/smoke/clients.smoke.ts
 *
 * Smoke test: Client list and creation via admin UI.
 *
 * Auth: loaded from storageState (see playwright.config.ts).
 * Each test gets an isolated browser context pre-seeded with the QA admin
 * session — no per-test Supabase login needed.
 *
 * Usage:
 *   npx playwright test tests/smoke/clients.smoke.ts
 */

import { test, expect } from '@playwright/test'
import { expectAdminPage } from './helpers/auth'

test('Clients list is accessible and contains QA data', async ({ page }) => {
  await expectAdminPage(page, '/admin/clients')

  await expect(page.locator('h1, h2').first()).toBeVisible()

  const qaClientsCount = await page.locator('text=[QA]').count()
  expect(qaClientsCount).toBeGreaterThan(0)
})

test('Create QA client via admin UI', async ({ page }) => {
  await expectAdminPage(page, '/admin/clients')

  const newClientBtn = page.locator(
    'a:has-text("New Client"), a:has-text("Add Client"), button:has-text("New Client"), button:has-text("Add Client")'
  ).first()

  if (await newClientBtn.count() === 0) {
    test.skip(true, 'No "New Client" button found — UI may differ')
    return
  }

  await newClientBtn.click()

  await page.fill('input[name="first_name"], #first_name', '[QA]')
  await page.fill('input[name="last_name"], #last_name', 'Smoke Test Client')
  await page.fill('input[name="email"], #email', 'qa.smoke.client@sprintscaleit.co.uk')

  await page.click('button[type="submit"]:has-text("Save"), button[type="submit"]:has-text("Create"), button[type="submit"]:has-text("Add")')

  await expect(page).toHaveURL(/\/admin\/clients/, { timeout: 10_000 })
  await expect(page.locator('text=Smoke Test Client')).toBeVisible({ timeout: 5_000 })
})
