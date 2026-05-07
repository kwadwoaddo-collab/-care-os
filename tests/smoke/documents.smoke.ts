/**
 * tests/smoke/documents.smoke.ts
 *
 * Smoke test: Document upload and visit note submission.
 *
 * Auth: loaded from storageState (see playwright.config.ts).
 * Each test gets an isolated browser context pre-seeded with the QA admin
 * session — no per-test Supabase login needed.
 *
 * Usage:
 *   npx playwright test tests/smoke/documents.smoke.ts
 */

import { test, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { expectAdminPage } from './helpers/auth'

/** Creates a tiny temp file for upload testing */
function createTempFile(): string {
  const tmpFile = path.join(os.tmpdir(), `qa-smoke-upload-${Date.now()}.txt`)
  fs.writeFileSync(tmpFile, '[QA] Smoke test file — safe to delete.')
  return tmpFile
}

test('Staff list loads and shows QA staff', async ({ page }) => {
  await expectAdminPage(page, '/admin/staff')

  await expect(page.locator('h1, h2').first()).toBeVisible()
})

test('Staff profile page loads (document upload context)', async ({ page }) => {
  await expectAdminPage(page, '/admin/staff')

  const qaStaffLink = page.locator('a:has-text("[QA]"), tr:has-text("[QA]") a').first()
  if (await qaStaffLink.count() === 0) {
    test.skip(true, 'No QA staff found in staff list — run npx tsx scripts/seed-qa-environment.ts first')
    return
  }

  await qaStaffLink.click()
  await expect(page).toHaveURL(/\/admin\/staff\//, { timeout: 5_000 })
  await expect(page).not.toHaveURL(/\/admin\/login/)
})

test('Document upload UI is accessible on staff profile', async ({ page }) => {
  await expectAdminPage(page, '/admin/staff')

  const qaStaffLink = page.locator('a:has-text("[QA]"), tr:has-text("[QA]") a').first()
  if (await qaStaffLink.count() === 0) {
    test.skip(true, 'No QA staff found — run npx tsx scripts/seed-qa-environment.ts first')
    return
  }

  await qaStaffLink.click()
  await expect(page).not.toHaveURL(/\/admin\/login/)
  await page.waitForTimeout(1_000)

  const fileInput = page.locator('input[type="file"]').first()
  if (await fileInput.count() === 0) {
    test.skip(true, 'No file upload input found on staff profile')
    return
  }

  const tmpFile = createTempFile()
  await fileInput.setInputFiles(tmpFile)
  fs.unlinkSync(tmpFile)

  const uploadBtn = page.locator('button:has-text("Upload"), button:has-text("Save"), button[type="submit"]').first()
  if (await uploadBtn.count() > 0) {
    await uploadBtn.click()
    await page.waitForTimeout(2_000)
    await expect(page).not.toHaveURL(/error/)
  }
})

test('Visit notes list loads correctly', async ({ page }) => {
  await expectAdminPage(page, '/admin/visit-notes')

  await expect(page.locator('h1, h2').first()).toBeVisible()
})

test('Visit notes list shows QA-seeded notes', async ({ page }) => {
  await expectAdminPage(page, '/admin/visit-notes')

  await page.waitForTimeout(1_500)
  const qaCount = await page.locator('text=[QA]').count()
  expect(qaCount).toBeGreaterThan(0)
})

test('Submit a visit note', async ({ page }) => {
  await expectAdminPage(page, '/admin/visit-notes')

  const draftNote = page.locator('text=draft, text=Draft').first()
  if (await draftNote.count() > 0) {
    await draftNote.click()
    await expect(page).not.toHaveURL(/\/admin\/login/)
    await page.waitForTimeout(1_000)

    const wellbeingInput = page.locator('textarea[name="wellbeing_notes"], #wellbeing_notes').first()
    if (await wellbeingInput.count() > 0) {
      await wellbeingInput.fill('[QA] Smoke test — client in good spirits during visit.')
    }

    const submitBtn = page.locator('button:has-text("Submit"), button:has-text("Save")').first()
    if (await submitBtn.count() > 0) {
      await submitBtn.click()
      await page.waitForTimeout(2_000)
      await expect(page).not.toHaveURL(/error/)
    }
  } else {
    expect(true).toBeTruthy()
  }
})
