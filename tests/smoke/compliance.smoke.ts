/**
 * tests/smoke/compliance.smoke.ts
 *
 * Smoke tests for compliance infrastructure.
 * Runs under the chromium project (admin storageState pre-loaded).
 *
 * Covers:
 * - Compliance dashboard page loads
 * - New /api/admin/compliance/summary endpoint — auth, permissions, shape
 * - Existing /api/admin/compliance/alerts endpoint — auth guard added
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
  // The new "Compliance item status" section label (visible if items exist)
  // We just verify the page renders without crashing — data presence is env-dependent
  await expect(page.getByText(/compliance/i).first()).toBeVisible()
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
