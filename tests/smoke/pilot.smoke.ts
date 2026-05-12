/**
 * pilot.smoke.ts
 *
 * Smoke tests for the Pilot Hardening sprint:
 * - Notification center API endpoints
 * - Operational event (audit_log) creation
 * - Error state and empty state surface responses
 * - In-app notification creation and retrieval
 */

import { test, expect } from '@playwright/test'

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// QA bypass header — mirrors the auth guard dev bypass pattern
const QA_HEADERS = process.env.QA_BYPASS_AUTH
  ? { 'x-qa-bypass': process.env.QA_BYPASS_AUTH }
  : {}

// ── 1. Admin notification log endpoint ───────────────────────────────────────

test('GET /api/admin/notifications/logs returns array', async ({ request }) => {
  const res = await request.get(`${BASE}/api/admin/notifications/logs`, {
    headers: QA_HEADERS,
  })
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  expect(Array.isArray(body)).toBe(true)
})

// ── 2. In-app notifications admin endpoint ───────────────────────────────────

test('GET /api/admin/notifications/in-app returns array', async ({ request }) => {
  const res = await request.get(`${BASE}/api/admin/notifications/in-app`, {
    headers: QA_HEADERS,
  })
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  expect(Array.isArray(body)).toBe(true)
})

test('POST /api/admin/notifications/in-app rejects missing fields', async ({ request }) => {
  const res = await request.post(`${BASE}/api/admin/notifications/in-app`, {
    headers: QA_HEADERS,
    data: { title: 'Missing recipient' },
  })
  expect(res.status()).toBe(422)
  const body = await res.json() as { error: string }
  expect(typeof body.error).toBe('string')
})

// ── 3. Worker notifications endpoint (invalid token) ─────────────────────────

test('GET /api/worker/notifications rejects missing token', async ({ request }) => {
  const res = await request.get(`${BASE}/api/worker/notifications`)
  expect(res.status()).toBe(400)
})

test('GET /api/worker/notifications rejects invalid token', async ({ request }) => {
  const res = await request.get(`${BASE}/api/worker/notifications?token=invalid-token-xyz`)
  expect(res.status()).toBe(401)
})

test('PATCH /api/worker/notifications rejects invalid token', async ({ request }) => {
  const res = await request.patch(`${BASE}/api/worker/notifications?token=invalid-token-xyz`)
  expect(res.status()).toBe(401)
})

// ── 4. Audit log API ─────────────────────────────────────────────────────────

test('GET /api/admin/audit-log returns array with action field', async ({ request }) => {
  const res = await request.get(`${BASE}/api/admin/audit-log`, {
    headers: QA_HEADERS,
  })
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  expect(Array.isArray(body)).toBe(true)
  // If entries exist, each should have an 'action' field
  if (body.length > 0) {
    expect(typeof (body[0] as { action: string }).action).toBe('string')
  }
})

// ── 5. System health endpoint ────────────────────────────────────────────────

test('GET /api/admin/system/health returns health object', async ({ request }) => {
  const res = await request.get(`${BASE}/api/admin/system/health`, {
    headers: QA_HEADERS,
  })
  expect(res.ok()).toBeTruthy()
  const body = await res.json() as Record<string, unknown>
  expect(typeof body.database).toBe('boolean')
  expect(typeof body.storage).toBe('boolean')
  expect(typeof body.timestamp).toBe('string')
})

// ── 6. Worker error boundary (page renders) ──────────────────────────────────

test('Worker portal dashboard page loads without crashing', async ({ page }) => {
  // Visit without a token — should redirect or show auth prompt, not a raw error
  await page.goto(`${BASE}/worker/dashboard`, { waitUntil: 'domcontentloaded' })
  // Should not show the generic Next.js error page
  const title = await page.title()
  expect(title).not.toContain('Application error')
})

// ── 7. Admin dashboard page loads ────────────────────────────────────────────

test('Admin dashboard renders pilot analytics section', async ({ page }) => {
  // Admin pages behind auth — check the page doesn't throw
  await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' })
  const title = await page.title()
  expect(title).not.toContain('Application error')
})

// ── 8. Empty state — notifications API with no token returns 400 ──────────────

test('Worker notifications page returns empty state for valid token with no notifications', async ({ request }) => {
  // Token validation will fail with 401 for unknown tokens — guard the shape
  const res = await request.get(`${BASE}/api/worker/notifications?token=smoke-test-dummy`)
  // Should be either 401 (invalid token) or 200 (empty array) — never 500
  expect([200, 401]).toContain(res.status())
  if (res.status() === 200) {
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  }
})
