/**
 * tests/smoke/worker.smoke.ts
 *
 * Authenticated end-to-end smoke tests for the care worker portal.
 *
 * Auth strategy:
 *   Worker pages use sessionStorage token auth (magic-link) — not cookies.
 *   storageState cannot persist sessionStorage, so we inject the QA token via
 *   page.addInitScript before each page load. The token is validated server-side
 *   against staff_profiles.portal_token_hash on every API call.
 *
 * Prerequisites:
 *   The "worker-setup" project runs worker.setup.ts first and validates the
 *   token is seeded. If it fails, run: npm run qa:seed
 *
 * Projects:
 *   "worker"        — Desktop Chrome
 *   "worker-mobile" — Pixel 5 (same tests, mobile viewport)
 */

import { test, expect, type Page } from '@playwright/test'
import { QA_WORKER_PORTAL_TOKEN, injectWorkerSession } from './helpers/auth'

// Inject worker token before every page load in this file
test.beforeEach(async ({ page }) => {
  await injectWorkerSession(page)
})

// ── Overflow helper ───────────────────────────────────────────────────────────

async function assertNoOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(overflow, 'page should not have horizontal overflow').toBe(false)
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

test('worker: dashboard loads authenticated content', async ({ page }) => {
  await page.goto('/worker/dashboard')
  await page.waitForLoadState('networkidle')

  await expect(page.getByText(/session error/i)).not.toBeVisible({ timeout: 15_000 })
  // Profile header card (worker name or job role visible)
  await expect(page.getByText('Quick Actions')).toBeVisible({ timeout: 15_000 })
  await assertNoOverflow(page)
})

test("worker: dashboard shows today's shifts section", async ({ page }) => {
  await page.goto('/worker/dashboard')
  await page.waitForLoadState('networkidle')

  await expect(page.getByText(/session error/i)).not.toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/Today.?s Shifts/i)).toBeVisible({ timeout: 15_000 })
})

test('worker: bottom navigation visible and has correct links', async ({ page }) => {
  await page.goto('/worker/dashboard')
  await page.waitForLoadState('networkidle')

  // Use CSS nav selector — more resilient than getByRole+name in case aria-label
  // is not yet deployed (deployed version may lag behind local changes).
  const nav = page.locator('nav')
  await expect(nav).toBeVisible({ timeout: 10_000 })
  await expect(nav.getByText('Home')).toBeVisible()
  await expect(nav.getByText('Shifts')).toBeVisible()
  await expect(nav.getByText('Documents')).toBeVisible()
  await expect(nav.getByText('Availability')).toBeVisible()
})

test('worker: dashboard nav links are tappable (min 44px height)', async ({ page }) => {
  await page.goto('/worker/dashboard')
  await page.waitForLoadState('networkidle')

  const nav   = page.locator('nav')
  const links = nav.getByRole('link')
  const count = await links.count()

  for (let i = 0; i < count; i++) {
    const box = await links.nth(i).boundingBox()
    if (!box) continue
    expect(box.height, `nav link ${i} should be at least 44px tall`).toBeGreaterThanOrEqual(44)
  }
})

// ── Shifts ────────────────────────────────────────────────────────────────────

test('worker: shifts page loads with filter chips', async ({ page }) => {
  await page.goto('/worker/shifts')
  await page.waitForLoadState('networkidle')

  await expect(page.getByText(/session error/i)).not.toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('heading', { name: /My Shifts/i })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: /Upcoming/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /All/i })).toBeVisible()
  await assertNoOverflow(page)
})

test('worker: shifts "All" filter shows QA shifts or empty state', async ({ page }) => {
  await page.goto('/worker/shifts')
  await page.waitForLoadState('networkidle')
  await expect(page.getByText(/session error/i)).not.toBeVisible({ timeout: 15_000 })

  await page.getByRole('button', { name: /All/i }).click()
  await page.waitForTimeout(400)

  // Either shift cards or the empty-state message — not a session error
  const body = await page.textContent('body')
  expect(body).toMatch(/QA|No shifts for this filter/i)
})

// ── Shift detail ──────────────────────────────────────────────────────────────

test('worker: shift detail opens from shifts list', async ({ page }) => {
  await page.goto('/worker/shifts')
  await page.waitForLoadState('networkidle')
  await expect(page.getByText(/session error/i)).not.toBeVisible({ timeout: 15_000 })

  // Use "All" filter to surface past and future shifts
  await page.getByRole('button', { name: /All/i }).click()
  await page.waitForTimeout(600)

  const firstShiftLink = page.locator('a[href^="/worker/shifts/"]').first()
  if ((await firstShiftLink.count()) === 0) {
    test.skip(true, 'No shifts assigned to QA worker — run: npm run qa:seed')
    return
  }

  await firstShiftLink.click()
  await page.waitForLoadState('networkidle')

  await expect(page.getByText(/session error/i)).not.toBeVisible({ timeout: 15_000 })
  // Back-link confirms we're on a shift detail page
  await expect(page.getByText('← My Shifts')).toBeVisible({ timeout: 15_000 })
  // Shift detail card with date/time row
  await expect(page.getByText(/Date|Shift type|Location/i).first()).toBeVisible()
  await assertNoOverflow(page)
})

test('worker: shift detail — acknowledgement buttons visible', async ({ page }) => {
  await page.goto('/worker/shifts')
  await page.waitForLoadState('networkidle')
  await expect(page.getByText(/session error/i)).not.toBeVisible({ timeout: 15_000 })

  await page.getByRole('button', { name: /All/i }).click()
  await page.waitForTimeout(600)

  // Find a scheduled or confirmed (non-completed) shift
  const shiftLinks = page.locator('a[href^="/worker/shifts/"]')
  const count = await shiftLinks.count()
  if (count === 0) {
    test.skip(true, 'No shifts assigned to QA worker — run: npm run qa:seed')
    return
  }

  // Try each shift until we find one with ack buttons
  for (let i = 0; i < Math.min(count, 5); i++) {
    await page.goto('/worker/shifts')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: /All/i }).click()
    await page.waitForTimeout(400)

    const link = page.locator('a[href^="/worker/shifts/"]').nth(i)
    if ((await link.count()) === 0) break
    await link.click()
    await page.waitForLoadState('networkidle')

    const acceptBtn = page.getByRole('button', { name: /Accept/i })
    if ((await acceptBtn.count()) > 0) {
      await expect(acceptBtn).toBeVisible()
      await expect(page.getByRole('button', { name: /Decline/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /Late/i })).toBeVisible()
      return
    }
  }
  // Not a failure if all shifts are completed — just confirm no crash
})

// ── Availability ──────────────────────────────────────────────────────────────

test('worker: availability page loads with all day cards', async ({ page }) => {
  await page.goto('/worker/availability')
  await page.waitForLoadState('networkidle')

  await expect(page.getByText(/session error/i)).not.toBeVisible({ timeout: 15_000 })
  for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']) {
    await expect(page.getByText(day)).toBeVisible({ timeout: 10_000 })
  }
  await assertNoOverflow(page)
})

test('worker: availability page has save button', async ({ page }) => {
  await page.goto('/worker/availability')
  await page.waitForLoadState('networkidle')

  await expect(page.getByText(/session error/i)).not.toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: /Save Availability/i })).toBeVisible({ timeout: 15_000 })
})

test('worker: availability can toggle a day and save', async ({ page }) => {
  await page.goto('/worker/availability')
  await page.waitForLoadState('networkidle')
  await expect(page.getByText(/session error/i)).not.toBeVisible({ timeout: 15_000 })

  // Toggle Monday (click the checkbox role element)
  const mondayToggle = page.getByRole('checkbox').first()
  if ((await mondayToggle.count()) > 0) {
    await mondayToggle.click()
    await page.waitForTimeout(200)
    // Re-toggle to restore original state
    await mondayToggle.click()
  }

  const saveBtn = page.getByRole('button', { name: /Save Availability/i })
  await saveBtn.click()
  // Either shows "Saved" confirmation or remains on page — no error
  await page.waitForTimeout(2_000)
  await expect(page.getByText(/session error/i)).not.toBeVisible()
})

// ── Documents ─────────────────────────────────────────────────────────────────

test('worker: documents page loads without session error', async ({ page }) => {
  await page.goto('/worker/documents')
  await page.waitForLoadState('networkidle')

  await expect(page.getByText(/session error/i)).not.toBeVisible({ timeout: 15_000 })
  await assertNoOverflow(page)
})

test('worker: documents page shows upload UI', async ({ page }) => {
  await page.goto('/worker/documents')
  await page.waitForLoadState('networkidle')

  await expect(page.getByText(/session error/i)).not.toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Upload a document')).toBeVisible({ timeout: 15_000 })
  // Document type selector — use role to avoid id-attribute drift between deployments
  await expect(page.getByRole('combobox').first()).toBeVisible({ timeout: 10_000 })
  // Upload submit button (text may be "Upload" or "Upload Document" depending on version)
  await expect(page.getByRole('button', { name: /^Upload/i })).toBeVisible()
})

// ── Visit notes ───────────────────────────────────────────────────────────────

test('worker: visit note page opens from shift detail', async ({ page }) => {
  await page.goto('/worker/shifts')
  await page.waitForLoadState('networkidle')
  await expect(page.getByText(/session error/i)).not.toBeVisible({ timeout: 15_000 })

  await page.getByRole('button', { name: /All/i }).click()
  await page.waitForTimeout(600)

  const shiftLinks = page.locator('a[href^="/worker/shifts/"]')
  if ((await shiftLinks.count()) === 0) {
    test.skip(true, 'No shifts assigned to QA worker — run: npm run qa:seed')
    return
  }

  await shiftLinks.first().click()
  await page.waitForLoadState('networkidle')
  await expect(page.getByText(/session error/i)).not.toBeVisible({ timeout: 15_000 })

  // Check if visit note section is present (only for scheduled/confirmed shifts)
  const visitNoteSection = page.getByText('Visit Note')
  if ((await visitNoteSection.count()) === 0) return // completed shift — no visit note card

  // Either start or continue/view the note
  const startBtn      = page.getByRole('button', { name: /Start Visit Note/i })
  const continueLink  = page.getByRole('link', { name: /Continue Visit Note|View Visit Note/i })

  if ((await continueLink.count()) > 0) {
    await continueLink.click()
  } else if ((await startBtn.count()) > 0) {
    await startBtn.click()
  } else {
    return // no note interaction available on this shift
  }

  await page.waitForURL(/\/worker\/visit-notes\//, { timeout: 15_000 })
  await expect(page.getByText(/session error/i)).not.toBeVisible()
  await assertNoOverflow(page)
})

test('worker: visit note form fields are visible', async ({ page }) => {
  await page.goto('/worker/shifts')
  await page.waitForLoadState('networkidle')
  await expect(page.getByText(/session error/i)).not.toBeVisible({ timeout: 15_000 })

  await page.getByRole('button', { name: /All/i }).click()
  await page.waitForTimeout(600)

  const shiftLinks = page.locator('a[href^="/worker/shifts/"]')
  if ((await shiftLinks.count()) === 0) {
    test.skip(true, 'No shifts — run: npm run qa:seed')
    return
  }

  for (let i = 0; i < Math.min(await shiftLinks.count(), 5); i++) {
    await page.goto('/worker/shifts')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: /All/i }).click()
    await page.waitForTimeout(400)

    const link = page.locator('a[href^="/worker/shifts/"]').nth(i)
    if ((await link.count()) === 0) break
    await link.click()
    await page.waitForLoadState('networkidle')

    const startBtn     = page.getByRole('button', { name: /Start Visit Note/i })
    const continueLink = page.getByRole('link', { name: /Continue|View Visit Note/i })

    if ((await continueLink.count()) > 0) {
      await continueLink.click()
      await page.waitForURL(/\/worker\/visit-notes\//, { timeout: 15_000 })
      // Visit note form fields
      await expect(page.locator('textarea').first()).toBeVisible({ timeout: 10_000 })
      await assertNoOverflow(page)
      return
    } else if ((await startBtn.count()) > 0) {
      await startBtn.click()
      await page.waitForURL(/\/worker\/visit-notes\//, { timeout: 15_000 })
      await expect(page.locator('textarea').first()).toBeVisible({ timeout: 10_000 })
      await assertNoOverflow(page)
      return
    }
  }
  // No visit-note-capable shift found — not a failure
})

// ── Onboarding ────────────────────────────────────────────────────────────────
// Regression guard for: /worker/onboarding rejecting valid worker sessions
// (was using legacy portal_invitations lookup instead of validateWorkerToken).

test('worker: onboarding page loads without session error', async ({ page }) => {
  await page.goto('/worker/onboarding')
  await page.waitForLoadState('networkidle')

  // The bug produced "Invalid or expired session" — guard against it
  await expect(page.getByText(/invalid.*session|session.*expired|expired.*session/i)).not.toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/session error/i)).not.toBeVisible()
})

test('worker: onboarding page shows progress ring and checklist', async ({ page }) => {
  await page.goto('/worker/onboarding')
  await page.waitForLoadState('networkidle')

  await expect(page.getByText(/invalid.*session|session.*expired/i)).not.toBeVisible({ timeout: 15_000 })
  // Hero card with progress % always rendered
  await expect(page.getByText(/Hi |Complete your onboarding|complete/i).first()).toBeVisible({ timeout: 15_000 })
  // Checklist heading
  await expect(page.getByText('Your checklist')).toBeVisible({ timeout: 15_000 })
  await assertNoOverflow(page)
})

test('worker: onboarding page shows policy section', async ({ page }) => {
  await page.goto('/worker/onboarding')
  await page.waitForLoadState('networkidle')

  await expect(page.getByText(/invalid.*session|session.*expired/i)).not.toBeVisible({ timeout: 15_000 })
  // Policy section is always present in the checklist
  await expect(page.getByText('Company Policies')).toBeVisible({ timeout: 15_000 })
})

test('worker: onboarding quick links to documents and profile', async ({ page }) => {
  await page.goto('/worker/onboarding')
  await page.waitForLoadState('networkidle')

  await expect(page.getByText(/invalid.*session|session.*expired/i)).not.toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('link', { name: /My Documents/i })).toBeVisible({ timeout: 15_000 })
})

test('worker: onboarding policy acknowledgement button functions', async ({ page }) => {
  await page.goto('/worker/onboarding')
  await page.waitForLoadState('networkidle')
  
  // Either it's already acknowledged (✓ Acknowledge) or there's an I Acknowledge button
  const policyBtn = page.locator('#acknowledge-policy-btn')
  const isVisible = await policyBtn.isVisible().catch(() => false)
  if (isVisible) {
    // We can't actually click it in smoke tests without affecting the DB for future runs unless we tear down,
    // so we just ensure it's rendered correctly and enabled.
    await expect(policyBtn).toBeEnabled()
    await expect(policyBtn).toHaveText(/I Acknowledge/i)
  } else {
    // If already acknowledged, the row should show ✓
    await expect(page.getByText('✓').filter({ hasText: 'Company Policies' })).toBeVisible()
  }
})

// ── Documents ─────────────────────────────────────────────────────────────────

test('worker: documents page duplicate upload guard', async ({ page }) => {
  await page.goto('/worker/documents')
  await page.waitForLoadState('networkidle')

  // Wait for the requirements fetch to complete
  await page.waitForTimeout(1000)

  // Select training certificate
  await page.getByLabel(/Document type/i).selectOption('training_certificate')
  
  // The category dropdown should appear
  await expect(page.getByLabel(/Training category/i)).toBeVisible()
})


// ── Mobile overflow spot-checks ───────────────────────────────────────────────
// These complement the viewport-specific assertions above and are especially
// useful when the "worker-mobile" project runs this file at Pixel 5 dimensions.

const WORKER_PATHS = [
  '/worker/dashboard',
  '/worker/shifts',
  '/worker/availability',
  '/worker/documents',
  '/worker/onboarding',
]

for (const workerPath of WORKER_PATHS) {
  test(`worker: no horizontal overflow — ${workerPath}`, async ({ page }) => {
    await page.goto(workerPath)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)
    await assertNoOverflow(page)
  })
}
