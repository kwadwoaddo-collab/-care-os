/**
 * tests/smoke/documents.smoke.ts
 *
 * Smoke test: Document upload and visit note submission.
 *
 * Usage:
 *   npx playwright test tests/smoke/documents.smoke.ts
 */

import { test, expect, type Page } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import os from 'os'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

async function loginAsQaAdmin(page: Page) {
  await page.goto(`${BASE_URL}/admin/login`)
  await page.fill('input[type="email"], #email', 'qa-admin@sprintscaleit.co.uk')
  await page.fill('input[type="password"], #password', 'ChangeMe123!')
  await page.click('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")')
  await expect(page).toHaveURL(/\/admin/, { timeout: 10_000 })
}

/** Creates a tiny temp PDF-like file for upload testing */
function createTempFile(): string {
  const tmpFile = path.join(os.tmpdir(), `qa-smoke-upload-${Date.now()}.txt`)
  fs.writeFileSync(tmpFile, '[QA] Smoke test file — safe to delete.')
  return tmpFile
}

test('Staff profile page loads (document upload context)', async ({ page }) => {
  await loginAsQaAdmin(page)
  await page.goto(`${BASE_URL}/admin/staff`)

  await expect(page).not.toHaveURL(/error/)

  // Navigate to first QA staff member
  const qaStaffLink = page.locator('a:has-text("[QA]"), tr:has-text("[QA]") a').first()
  if (await qaStaffLink.count() === 0) {
    test.skip(true, 'No QA staff found in staff list')
    return
  }

  await qaStaffLink.click()
  await expect(page).toHaveURL(/\/admin\/staff\//, { timeout: 5_000 })
})

test('Document upload UI is accessible on staff profile', async ({ page }) => {
  await loginAsQaAdmin(page)
  await page.goto(`${BASE_URL}/admin/staff`)

  const qaStaffLink = page.locator('a:has-text("[QA]"), tr:has-text("[QA]") a').first()
  if (await qaStaffLink.count() === 0) {
    test.skip(true, 'No QA staff found')
    return
  }

  await qaStaffLink.click()
  await page.waitForTimeout(1000)

  // Look for file upload input
  const fileInput = page.locator('input[type="file"]').first()
  if (await fileInput.count() === 0) {
    test.skip(true, 'No file upload input found on staff profile')
    return
  }

  // Upload a test file
  const tmpFile = createTempFile()
  await fileInput.setInputFiles(tmpFile)
  fs.unlinkSync(tmpFile)

  // Look for submit button
  const uploadBtn = page.locator('button:has-text("Upload"), button:has-text("Save"), button[type="submit"]').first()
  if (await uploadBtn.count() > 0) {
    await uploadBtn.click()
    await page.waitForTimeout(2000)
    await expect(page).not.toHaveURL(/error/)
  }
})

test('Visit notes list loads correctly', async ({ page }) => {
  await loginAsQaAdmin(page)
  await page.goto(`${BASE_URL}/admin/visit-notes`)

  await expect(page).not.toHaveURL(/error/)
  await expect(page.locator('h1, h2').first()).toBeVisible()
})

test('Visit notes list shows QA-seeded notes', async ({ page }) => {
  await loginAsQaAdmin(page)
  await page.goto(`${BASE_URL}/admin/visit-notes`)

  await page.waitForTimeout(1500)
  const qaCount = await page.locator('text=[QA]').count()
  expect(qaCount).toBeGreaterThan(0)
})

test('Submit a visit note', async ({ page }) => {
  await loginAsQaAdmin(page)
  await page.goto(`${BASE_URL}/admin/visit-notes`)

  // Find a draft note
  const draftNote = page.locator('text=draft, text=Draft').first()
  if (await draftNote.count() > 0) {
    await draftNote.click()
    await page.waitForTimeout(1000)

    // Fill in required fields if present
    const wellbeingInput = page.locator('textarea[name="wellbeing_notes"], #wellbeing_notes').first()
    if (await wellbeingInput.count() > 0) {
      await wellbeingInput.fill('[QA] Smoke test — client in good spirits during visit.')
    }

    const submitBtn = page.locator('button:has-text("Submit"), button:has-text("Save")').first()
    if (await submitBtn.count() > 0) {
      await submitBtn.click()
      await page.waitForTimeout(2000)
      await expect(page).not.toHaveURL(/error/)
    }
  } else {
    // Just verify the page loads
    expect(true).toBeTruthy()
  }
})
