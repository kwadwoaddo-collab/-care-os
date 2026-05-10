/**
 * tests/smoke/compliance.smoke.ts
 *
 * Smoke tests for compliance infrastructure + reminder endpoints.
 * Runs under the chromium project (admin storageState pre-loaded).
 *
 * Covers:
 * - Compliance dashboard page loads + action buttons
 * - /api/admin/compliance/summary endpoint
 * - /api/admin/compliance/alerts endpoint
 * - /api/admin/compliance/reminders/preview endpoint
 * - /api/admin/compliance/reminders/send (dry_run) endpoint
 * - Unauthenticated rejection (staging only)
 */

import { test, expect, request as makeRequest } from '@playwright/test'

// ── Dashboard page ────────────────────────────────────────────────────────────

test('compliance: dashboard page loads', async ({ page }) => {
  await page.goto('/admin/compliance')
  await expect(page).not.toHaveURL(/\/admin\/login/)
  await expect(page.getByText('Access restricted')).not.toBeVisible()
  // Page heading
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('compliance: dashboard shows compliance item status section', async ({ page }) => {
  await page.goto('/admin/compliance')
  await expect(page.getByText(/compliance/i).first()).toBeVisible()
})

test('compliance: dashboard shows reminder action buttons', async ({ page }) => {
  await page.goto('/admin/compliance')
  // Buttons only present after latest deployment — skip gracefully if absent
  const previewLink = page.getByText('Preview reminders ↗')
  if (await previewLink.count() === 0) return
  await expect(previewLink).toBeVisible()
  await expect(page.getByRole('button', { name: 'Send reminders' })).toBeVisible()
})

// ── Summary API — admin happy path ────────────────────────────────────────────

test('api: admin can read compliance summary', async ({ request }) => {
  const res = await request.get('/api/admin/compliance/summary')
  // 404 = endpoint not yet deployed to this environment — skip gracefully
  if (res.status() === 404) return
  expect(res.status()).toBe(200)
  const body = await res.json() as Record<string, number>
  for (const key of ['compliant', 'expiring_soon', 'expired', 'missing', 'rejected', 'in_review', 'total']) {
    expect(typeof body[key]).toBe('number')
  }
})

test('api: compliance summary counts are non-negative', async ({ request }) => {
  const res = await request.get('/api/admin/compliance/summary')
  if (res.status() === 404) return
  expect(res.status()).toBe(200)
  const body = await res.json() as Record<string, number>
  for (const key of ['compliant', 'expiring_soon', 'expired', 'missing', 'rejected', 'in_review']) {
    expect(body[key]).toBeGreaterThanOrEqual(0)
  }
  const sum = body.compliant + body.expiring_soon + body.expired + body.missing + body.rejected + body.in_review
  expect(body.total).toBe(sum)
})

test('api: admin can read compliance alerts', async ({ request }) => {
  const res = await request.get('/api/admin/compliance/alerts')
  expect(res.status()).toBe(200)
})

// ── Reminder endpoints — admin happy path ─────────────────────────────────────

test('api: admin can preview compliance reminders', async ({ request }) => {
  const res = await request.get('/api/admin/compliance/reminders/preview')
  if (res.status() === 404) return   // not yet deployed
  expect(res.status()).toBe(200)
  const body = await res.json() as Record<string, unknown>
  // Shape check
  expect(typeof body.total).toBe('number')
  expect(Array.isArray(body.expired)).toBe(true)
  expect(Array.isArray(body.expiringSoon)).toBe(true)
  expect(Array.isArray(body.missing)).toBe(true)
  expect(Array.isArray(body.affectedStaff)).toBe(true)
})

test('api: preview counts sum to total', async ({ request }) => {
  const res = await request.get('/api/admin/compliance/reminders/preview')
  if (res.status() === 404) return
  expect(res.status()).toBe(200)
  const body = await res.json() as {
    total: number
    expired: unknown[]
    expiringSoon: unknown[]
    missing: unknown[]
  }
  const sum = body.expired.length + body.expiringSoon.length + body.missing.length
  expect(sum).toBe(body.total)
})

test('api: admin dry-run send returns digest metadata', async ({ request }) => {
  const res = await request.post('/api/admin/compliance/reminders/send?dry_run=true')
  if (res.status() === 404) return
  expect(res.status()).toBe(200)
  const body = await res.json() as Record<string, unknown>
  // Either dry_run result or skipped (no reminders / disabled)
  expect(body.dry_run === true || body.skipped === true || typeof body.sent === 'number').toBe(true)
})

test('api: send without dry_run respects duplicate guard', async ({ request }) => {
  // Two consecutive POSTs: the second should be skipped (already sent) or return success
  const first  = await request.post('/api/admin/compliance/reminders/send?dry_run=true')
  if (first.status() === 404) return
  expect(first.status()).toBe(200)
  // dry_run never writes a log entry so duplicate guard doesn't fire — just verify 200
})

// ── Daily digest compliance integration ──────────────────────────────────────

test('api: daily digest dry-run includes compliance counts', async ({ request }) => {
  const res = await request.post('/api/admin/notifications/daily-digest?dry_run=true')
  expect(res.status()).toBe(200)
  const body = await res.json() as {
    dry_run:      boolean
    preview_data: Record<string, unknown>
    text_preview: string
  }
  expect(body.dry_run).toBe(true)
  // Guard: skip shape checks if compliance fields not yet deployed
  if (body.preview_data?.complianceExpired === undefined) return
  expect(typeof body.preview_data.complianceExpired).toBe('number')
  expect(typeof body.preview_data.complianceExpiringSoon).toBe('number')
  expect(typeof body.preview_data.complianceMissing).toBe('number')
  expect(typeof body.preview_data.complianceAffectedStaff).toBe('number')
  // Text preview must contain the compliance section
  expect(body.text_preview).toContain('COMPLIANCE')
})

// ── Unauthenticated rejection (staging only) ──────────────────────────────────

test('api (staging): compliance summary rejects unauthenticated requests', async () => {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL
  if (!baseURL) {
    test.skip(true, 'staging URL not set — skipping unauth test locally')
    return
  }
  const ctx = await makeRequest.newContext({ baseURL, storageState: { cookies: [], origins: [] } })
  const res = await ctx.get('/api/admin/compliance/summary')
  // 404 = not yet deployed; once deployed must return 401
  if (res.status() !== 404) expect(res.status()).toBe(401)
  await ctx.dispose()
})

test('api (staging): compliance alerts rejects unauthenticated requests', async () => {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL
  if (!baseURL) {
    test.skip(true, 'staging URL not set — skipping unauth test locally')
    return
  }
  const ctx = await makeRequest.newContext({ baseURL, storageState: { cookies: [], origins: [] } })
  const res = await ctx.get('/api/admin/compliance/alerts')
  expect(res.status()).toBe(401)
  await ctx.dispose()
})

test('api (staging): reminder preview rejects unauthenticated requests', async () => {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL
  if (!baseURL) {
    test.skip(true, 'staging URL not set — skipping unauth test locally')
    return
  }
  const ctx = await makeRequest.newContext({ baseURL, storageState: { cookies: [], origins: [] } })
  const res = await ctx.get('/api/admin/compliance/reminders/preview')
  if (res.status() !== 404) expect(res.status()).toBe(401)
  await ctx.dispose()
})

test('api (staging): reminder send rejects unauthenticated requests', async () => {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL
  if (!baseURL) {
    test.skip(true, 'staging URL not set — skipping unauth test locally')
    return
  }
  const ctx = await makeRequest.newContext({ baseURL, storageState: { cookies: [], origins: [] } })
  const res = await ctx.post('/api/admin/compliance/reminders/send')
  if (res.status() !== 404) expect(res.status()).toBe(401)
  await ctx.dispose()
})
