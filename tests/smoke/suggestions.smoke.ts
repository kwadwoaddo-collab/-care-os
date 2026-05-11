/**
 * tests/smoke/suggestions.smoke.ts
 *
 * Smoke tests for the shift suggestions API and scheduling metrics API.
 *
 * Uses QA-seeded shifts. Unauthenticated 401 checks only run on staging
 * where QA_BYPASS_AUTH is inactive.
 */

import { test, expect, request as makeRequest } from '@playwright/test'
import { expectAdminPage }                       from './helpers/auth'

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

// ── Metrics API ───────────────────────────────────────────────────────────────

test('scheduling metrics API returns valid shape', async ({ page }) => {
  await expectAdminPage(page, '/admin/shifts/open')

  const res = await page.request.get('/api/admin/shifts/metrics')
  expect(res.status()).toBe(200)

  const body = await res.json() as Record<string, unknown>
  expect(typeof body.open_shifts).toBe('number')
  expect(typeof body.unassigned_shifts).toBe('number')
  expect(typeof body.conflict_count).toBe('number')
  expect(typeof body.overdue_acknowledgements).toBe('number')
  expect(typeof body.workers_available_today).toBe('number')
  expect(typeof body.workers_booked_today).toBe('number')
})

test('scheduling metrics API: unauthenticated returns 401', async () => {
  const ctx = await makeRequest.newContext({ baseURL: BASE })
  const res  = await ctx.get('/api/admin/shifts/metrics')
  expect(res.status()).toBe(401)
  await ctx.dispose()
})

// ── Suggestions API ───────────────────────────────────────────────────────────

test('shift suggestions API returns array for QA shift', async ({ page }) => {
  await expectAdminPage(page, '/admin/shifts')

  // Find any shift ID from the shifts list API
  const listRes = await page.request.get('/api/admin/shifts?pageSize=10')
  expect(listRes.status()).toBe(200)

  const listBody = await listRes.json() as { data: { id: string }[] }
  if (!listBody.data || listBody.data.length === 0) {
    test.fail(true, 'No shifts found in QA environment — run seed (npx tsx scripts/seed-qa-environment.ts)')
    return
  }

  const shiftId = listBody.data[0]!.id
  const res     = await page.request.get(`/api/admin/shifts/${shiftId}/suggestions`)
  expect(res.status()).toBe(200)

  const body = await res.json() as unknown[]
  expect(Array.isArray(body)).toBe(true)
})

test('shift suggestions API: each suggestion has expected fields', async ({ page }) => {
  await expectAdminPage(page, '/admin/shifts')

  const listRes  = await page.request.get('/api/admin/shifts?pageSize=10')
  const listBody = await listRes.json() as { data: { id: string }[] }
  if (!listBody.data?.length) return

  const shiftId = listBody.data[0]!.id
  const res     = await page.request.get(`/api/admin/shifts/${shiftId}/suggestions`)
  const body    = await res.json() as Record<string, unknown>[]

  if (body.length === 0) return

  const first = body[0]!
  expect(typeof first.staff_profile_id).toBe('string')
  expect(typeof first.name).toBe('string')
  expect(typeof first.eligible).toBe('boolean')
  expect(typeof first.availability_match).toBe('boolean')
  expect(Array.isArray(first.compliance_warnings)).toBe(true)
  expect(Array.isArray(first.conflict_reasons)).toBe(true)
  expect(Array.isArray(first.assignment_conflicts)).toBe(true)
})

test('shift suggestions API: eligible workers appear before ineligible', async ({ page }) => {
  await expectAdminPage(page, '/admin/shifts')

  const listRes  = await page.request.get('/api/admin/shifts?pageSize=20')
  const listBody = await listRes.json() as { data: { id: string }[] }
  if (!listBody.data?.length) return

  // Find a shift with at least one eligible and one ineligible candidate
  for (const shift of listBody.data) {
    const res  = await page.request.get(`/api/admin/shifts/${shift.id}/suggestions`)
    const body = await res.json() as { eligible: boolean }[]
    if (body.length < 2) continue

    const firstIneligibleIdx = body.findIndex((s) => !s.eligible)
    if (firstIneligibleIdx === -1) continue

    const firstEligibleIdx = body.findIndex((s) => s.eligible)
    if (firstEligibleIdx === -1) continue

    expect(firstEligibleIdx).toBeLessThan(firstIneligibleIdx)
    break
  }
})

test('shift suggestions API: unauthenticated returns 401', async () => {
  const ctx = await makeRequest.newContext({ baseURL: BASE })
  const res  = await ctx.get('/api/admin/shifts/00000000-0000-0000-0000-000000000000/suggestions')
  expect(res.status()).toBe(401)
  await ctx.dispose()
})

// ── Open shifts page intelligence panel ──────────────────────────────────────

test('open shifts page loads scheduling intelligence panel', async ({ page }) => {
  await expectAdminPage(page, '/admin/shifts/open')
  // The scheduling intelligence section appears if metrics loaded
  // It shows "workers available today" text
  await page.waitForTimeout(1_000)
  const body = await page.content()
  expect(body).toMatch(/workers available today|open shifts/i)
})
