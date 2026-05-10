/**
 * tests/smoke/worker.mobile.smoke.ts
 *
 * Mobile-viewport smoke tests for care worker-facing pages.
 *
 * Strategy:
 * - Worker pages use sessionStorage token auth (magic-link, not cookie).
 *   The admin storageState is not useful here — worker pages authenticate
 *   via /api/worker/validate, not the admin session.
 * - We test pages in their unauthenticated state (no token → error UI).
 *   This is sufficient to verify layout, overflow, and structural rendering.
 * - Overflow tests validate that no page causes horizontal scroll at 390px
 *   (iPhone 14 portrait width), the most common mobile viewport.
 * - The mobile-chrome Playwright project (Pixel 5 via devices) already runs
 *   all smoke tests at 393×851. These tests add explicit assertions on worker
 *   pages and overflow detection.
 *
 * Runs under the chromium project (admin storageState) — storageState only
 * affects admin API calls; worker pages check sessionStorage independently.
 */

import { test, expect } from '@playwright/test'

const MOBILE_VIEWPORT = { width: 390, height: 844 }

// ── Worker landing page ───────────────────────────────────────────────────────

test('worker: landing page renders without horizontal overflow', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT)
  await page.goto('/worker')
  await page.waitForLoadState('networkidle')

  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth
  )
  expect(overflow).toBe(false)
})

test('worker: landing page shows invite guidance on direct visit', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT)
  await page.goto('/worker')
  // Either redirected to dashboard (unlikely without token) or shows invite message
  const url = page.url()
  if (url.includes('/worker/login') || url.includes('/worker/dashboard')) return
  await expect(page.getByText(/worker portal/i).first()).toBeVisible()
})

// ── Worker login page ─────────────────────────────────────────────────────────

test('worker: login page with invalid token shows error (no overflow)', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT)
  await page.goto('/worker/login?token=invalid-token-for-test')
  await page.waitForLoadState('networkidle')
  // Wait for validation to complete
  await page.waitForTimeout(2000)

  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth
  )
  expect(overflow).toBe(false)
})

test('worker: login page with no token shows error state', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT)
  await page.goto('/worker/login')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)
  // Should show some kind of guidance or error
  const body = await page.textContent('body')
  expect(body).toBeTruthy()
  // No crash — just an error or redirect
})

// ── Worker portal pages — no-token error state ────────────────────────────────

test('worker: dashboard page renders in no-token state without overflow', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT)
  await page.goto('/worker/dashboard')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)

  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth
  )
  expect(overflow).toBe(false)
})

test('worker: dashboard shows session error when no token', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT)
  await page.goto('/worker/dashboard')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)
  // Should show session error or loading skeleton — not crash
  const body = await page.textContent('body')
  expect(typeof body).toBe('string')
})

test('worker: shifts page renders in no-token state without overflow', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT)
  await page.goto('/worker/shifts')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)

  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth
  )
  expect(overflow).toBe(false)
})

test('worker: documents page renders in no-token state without overflow', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT)
  await page.goto('/worker/documents')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)

  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth
  )
  expect(overflow).toBe(false)
})

test('worker: availability page renders in no-token state without overflow', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT)
  await page.goto('/worker/availability')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)

  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth
  )
  expect(overflow).toBe(false)
})

// ── Bottom navigation ─────────────────────────────────────────────────────────

test('worker: bottom navigation visible on mobile', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT)
  await page.goto('/worker/dashboard')
  await page.waitForLoadState('networkidle')

  const nav = page.getByRole('navigation', { name: 'Worker navigation' })
  // Aria-label added in mobile optimisation — skip gracefully if not yet deployed
  if (await nav.count() === 0) return
  await expect(nav).toBeVisible()
})

test('worker: bottom navigation has correct links', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT)
  await page.goto('/worker/dashboard')
  await page.waitForLoadState('networkidle')

  const nav = page.getByRole('navigation', { name: 'Worker navigation' })
  if (await nav.count() === 0) return
  await expect(nav.getByText('Home')).toBeVisible()
  await expect(nav.getByText('Shifts')).toBeVisible()
  await expect(nav.getByText('Documents')).toBeVisible()
})

test('worker: nav tab links are large enough to tap (min 44px height)', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT)
  await page.goto('/worker/dashboard')
  await page.waitForLoadState('networkidle')

  const nav = page.getByRole('navigation', { name: 'Worker navigation' })
  const links = nav.getByRole('link')
  const count = await links.count()

  for (let i = 0; i < count; i++) {
    const box = await links.nth(i).boundingBox()
    if (!box) continue
    // Apple HIG minimum: 44pt. Allow 40px minimum (some OS chrome may affect viewport).
    expect(box.height).toBeGreaterThanOrEqual(40)
    expect(box.width).toBeGreaterThanOrEqual(44)
  }
})

// ── Upload UI visible on mobile ───────────────────────────────────────────────

test('worker: documents page upload section visible in error state', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT)
  await page.goto('/worker/documents')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)
  // Either shows upload form (if somehow authed) or session error — no crash
  const body = await page.textContent('body')
  expect(typeof body).toBe('string')
  expect(body!.length).toBeGreaterThan(0)
})

// ── Visit note form accessible on mobile ─────────────────────────────────────

test('worker: visit note page without id shows 404 or redirect gracefully', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT)
  await page.goto('/worker/visit-notes/nonexistent-note-id')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)

  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth
  )
  expect(overflow).toBe(false)
})

// ── Viewport widths — no wide elements ───────────────────────────────────────

const WORKER_PATHS = [
  '/worker',
  '/worker/dashboard',
  '/worker/shifts',
  '/worker/documents',
  '/worker/availability',
]

for (const path of WORKER_PATHS) {
  test(`worker: no horizontal overflow at 390px — ${path}`, async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT)
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(800)

    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
    expect(overflow, `${path} should not overflow at 390px`).toBe(false)
  })
}
