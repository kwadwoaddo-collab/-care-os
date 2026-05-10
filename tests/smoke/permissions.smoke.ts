/**
 * tests/smoke/permissions.smoke.ts
 *
 * RBAC smoke tests.
 *
 * Local runs (npm run qa:smoke): Only page-access and API happy-path tests.
 * QA_BYPASS_AUTH=true in .env.local means requireAdmin() always succeeds
 * locally, so "unauth → 401" checks are meaningless here.
 *
 * Staging runs (npm run qa:smoke:staging): All tests, including the
 * unauthenticated-request 401 checks which use makeRequest.newContext()
 * to create a fresh cookie-free API context. No bypass active on Vercel.
 */

import { test, expect, request as makeRequest } from '@playwright/test'

// ── Admin page access (runs locally + staging) ────────────────────────────────
// admin (company_admin) must be able to reach every guarded page.

test('admin: audit log page loads', async ({ page }) => {
  await page.goto('/admin/audit-log')
  await expect(page).not.toHaveURL(/\/admin\/login/)
  await expect(page.getByText('Access restricted')).not.toBeVisible()
})

test('admin: system page loads', async ({ page }) => {
  await page.goto('/admin/system')
  await expect(page).not.toHaveURL(/\/admin\/login/)
  await expect(page.getByText('Access restricted')).not.toBeVisible()
  await expect(page.getByText('System Health')).toBeVisible()
})

test('admin: staff page loads', async ({ page }) => {
  await page.goto('/admin/staff')
  await expect(page).not.toHaveURL(/\/admin\/login/)
  await expect(page.getByText('Access restricted')).not.toBeVisible()
})

test('admin: applicants page loads', async ({ page }) => {
  await page.goto('/admin/applicants')
  await expect(page).not.toHaveURL(/\/admin\/login/)
  await expect(page.getByText('Access restricted')).not.toBeVisible()
})

test('admin: incidents page loads', async ({ page }) => {
  await page.goto('/admin/incidents')
  await expect(page).not.toHaveURL(/\/admin\/login/)
  await expect(page.getByText('Access restricted')).not.toBeVisible()
})

// ── Admin API happy path (runs locally + staging) ─────────────────────────────
// Verifies the admin session reaches newly-guarded API endpoints.

test('api: admin can read audit log', async ({ request }) => {
  const res = await request.get('/api/admin/audit-log')
  expect(res.status()).toBe(200)
})

test('api: admin can read system health', async ({ request }) => {
  const res = await request.get('/api/admin/system/health')
  expect(res.status()).toBe(200)
})

// ── API unauthenticated rejection (staging only — no QA_BYPASS_AUTH) ──────────
// makeRequest.newContext() creates a fresh, cookie-free context.
// In staging there is no bypass so requireAdmin() returns 401.
// Locally QA_BYPASS_AUTH=true makes these always return 200 — skip them.
//
// These tests run in qa:smoke:staging via the chromium project.
// They are intentionally placed here so they run in CI without a separate file.

test('api (staging): audit-log rejects unauthenticated requests', async () => {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL
  if (!baseURL) {
    test.skip(true, 'staging URL not set — skipping unauth test locally')
    return
  }
  // Explicit empty storageState ensures no inherited session cookies
  const ctx = await makeRequest.newContext({ baseURL, storageState: { cookies: [], origins: [] } })
  const res = await ctx.get('/api/admin/audit-log')
  expect(res.status()).toBe(401)
  await ctx.dispose()
})

test('api (staging): system health rejects unauthenticated requests', async () => {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL
  if (!baseURL) {
    test.skip(true, 'staging URL not set — skipping unauth test locally')
    return
  }
  const ctx = await makeRequest.newContext({ baseURL, storageState: { cookies: [], origins: [] } })
  const res = await ctx.get('/api/admin/system/health')
  expect(res.status()).toBe(401)
  await ctx.dispose()
})

test('api (staging): staff list rejects unauthenticated requests', async () => {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL
  if (!baseURL) {
    test.skip(true, 'staging URL not set — skipping unauth test locally')
    return
  }
  const ctx = await makeRequest.newContext({ baseURL, storageState: { cookies: [], origins: [] } })
  const res = await ctx.get('/api/admin/staff')
  expect(res.status()).toBe(401)
  await ctx.dispose()
})

test('api (staging): applicants list rejects unauthenticated requests', async () => {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL
  if (!baseURL) {
    test.skip(true, 'staging URL not set — skipping unauth test locally')
    return
  }
  const ctx = await makeRequest.newContext({ baseURL, storageState: { cookies: [], origins: [] } })
  const res = await ctx.get('/api/admin/applicants')
  expect(res.status()).toBe(401)
  await ctx.dispose()
})
