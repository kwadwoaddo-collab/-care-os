/**
 * tests/smoke/staff-audit-export.smoke.ts
 *
 * Smoke tests for Phase 2: CQC-ready audit export (GET /api/admin/staff/[id]/audit-export).
 *
 * Read-only — not gated behind lib/features.ts (ENABLE_STAFF_AUDIT_EXPORT only
 * controls the "Export Staff File" button's visibility). requireAdmin() +
 * can('compliance:read') are the real access control, so this route is
 * testable regardless of the flag's state.
 *
 * Runs under the admin-authenticated "chromium" project (storageState).
 */

import { test, expect } from '@playwright/test'

async function getFirstStaffId(request: import('@playwright/test').APIRequestContext): Promise<string | null> {
  const res = await request.get('/api/admin/staff?pageSize=1')
  if (!res.ok()) return null
  const body = await res.json() as { data?: Array<{ id: string }> }
  return body.data?.[0]?.id ?? null
}

test('GET /api/admin/staff/[id]/audit-export returns a PDF for a valid staff member', async ({ request }) => {
  const staffId = await getFirstStaffId(request)
  if (!staffId) {
    test.skip(true, 'No staff members found — run: npm run qa:seed')
    return
  }

  const res = await request.get(`/api/admin/staff/${staffId}/audit-export`)

  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toBe('application/pdf')
  expect(res.headers()['content-disposition']).toContain('attachment')

  const body = await res.body()
  expect(body.byteLength).toBeGreaterThan(0)
  // %PDF- magic bytes
  expect(body.subarray(0, 5).toString('latin1')).toBe('%PDF-')
})

test('GET /api/admin/staff/[id]/audit-export returns 404 for a non-existent staff member', async ({ request }) => {
  const res = await request.get('/api/admin/staff/00000000-0000-0000-0000-000000000000/audit-export')
  expect(res.status()).toBe(404)
  const body = await res.json() as { error?: string }
  expect(body.error).toBeTruthy()
})
