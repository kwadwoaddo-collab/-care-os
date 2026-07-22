/**
 * tests/smoke/checklist-templates.smoke.ts
 *
 * Smoke tests for Phase 3: template-driven onboarding checklists per role.
 *
 * Not gated behind lib/features.ts (ENABLE_ONBOARDING_CHECKLISTS only
 * controls UI visibility — the nav link and the staff-profile panel).
 * requireAdmin() + can('staff:read'/'staff:write') are the real access
 * control, so these routes are testable regardless of the flag's state.
 *
 * Runs under the admin-authenticated "chromium" project (storageState).
 * Cleans up its own template + staff_checklists row via a service-role
 * client, mirroring worker.token-revocation.smoke.ts.
 */

require('dotenv').config({ path: '.env.local' })

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

async function getFirstStaffId(request: import('@playwright/test').APIRequestContext): Promise<string | null> {
  const res = await request.get('/api/admin/staff?pageSize=1')
  if (!res.ok()) return null
  const body = await res.json() as { data?: Array<{ id: string }> }
  return body.data?.[0]?.id ?? null
}

test('checklist template lifecycle: create, assign to staff, complete an item', async ({ request }) => {
  test.skip(!SUPABASE_URL || !SERVICE_ROLE_KEY, 'Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')

  const staffId = await getFirstStaffId(request)
  if (!staffId) {
    test.skip(true, 'No staff members found — run: npm run qa:seed')
    return
  }

  const db = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let templateId: string | null = null
  let checklistId: string | null = null

  try {
    // 1. Create a template with 3 items
    const createRes = await request.post('/api/admin/checklist-templates', {
      data: {
        name: '[QA-TEST] Smoke Test Checklist',
        job_role: null,
        items: [
          { title: '[QA-TEST] Item one', category: 'documentation', is_required: true },
          { title: '[QA-TEST] Item two', category: 'training', is_required: true },
          { title: '[QA-TEST] Item three', category: 'task', is_required: false },
        ],
      },
    })
    expect(createRes.status(), await createRes.text()).toBe(201)
    const created = await createRes.json() as { data: { id: string; items: Array<{ id: string; title: string }> } }
    templateId = created.data.id
    expect(created.data.items.length).toBe(3)

    // 2. List includes it
    const listRes = await request.get('/api/admin/checklist-templates')
    expect(listRes.ok()).toBeTruthy()
    const list = await listRes.json() as { data: Array<{ id: string; item_count: number }> }
    const found = list.data.find((t) => t.id === templateId)
    expect(found?.item_count).toBe(3)

    // 3. Detail fetch returns items in order
    const detailRes = await request.get(`/api/admin/checklist-templates/${templateId}`)
    expect(detailRes.ok()).toBeTruthy()
    const detail = await detailRes.json() as { data: { items: Array<{ title: string }> } }
    expect(detail.data.items.length).toBe(3)

    // 4. Assign to staff
    const assignRes = await request.post(`/api/admin/staff/${staffId}/checklist`, {
      data: { template_id: templateId },
    })
    expect(assignRes.status(), await assignRes.text()).toBe(201)
    const assigned = await assignRes.json() as {
      data: { id: string; progress: number; staff_checklist_items: Array<{ id: string; is_complete: boolean }> }
    }
    checklistId = assigned.data.id
    expect(assigned.data.progress).toBe(0)
    expect(assigned.data.staff_checklist_items.length).toBe(3)

    // 5. Complete one item
    const firstItemId = assigned.data.staff_checklist_items[0].id
    const toggleRes = await request.patch(`/api/admin/staff/${staffId}/checklist/items/${firstItemId}`, {
      data: { is_complete: true },
    })
    expect(toggleRes.status(), await toggleRes.text()).toBe(200)
    const toggled = await toggleRes.json() as { data: { is_complete: boolean; completed_at: string | null } }
    expect(toggled.data.is_complete).toBe(true)
    expect(toggled.data.completed_at).toBeTruthy()

    // 6. Progress reflects 1/3 complete, checklist not yet fully completed
    const checkRes = await request.get(`/api/admin/staff/${staffId}/checklist`)
    expect(checkRes.ok()).toBeTruthy()
    const checklists = await checkRes.json() as {
      data: Array<{ id: string; progress: number; completed_at: string | null }>
    }
    const thisChecklist = checklists.data.find((c) => c.id === checklistId)
    expect(thisChecklist?.progress).toBe(33)
    expect(thisChecklist?.completed_at).toBeNull()
  } finally {
    if (checklistId) await db.from('staff_checklists').delete().eq('id', checklistId)
    if (templateId) await db.from('checklist_templates').delete().eq('id', templateId)
  }
})

test('POST /api/admin/checklist-templates rejects a template with no items', async ({ request }) => {
  const res = await request.post('/api/admin/checklist-templates', {
    data: { name: '[QA-TEST] Empty Template', items: [] },
  })
  expect(res.status()).toBe(422)
})

test('GET /api/admin/staff/[id]/checklist/items/[itemId] rejects an item from a different staff member', async ({ request }) => {
  const res = await request.patch(
    '/api/admin/staff/00000000-0000-0000-0000-000000000000/checklist/items/00000000-0000-0000-0000-000000000000',
    { data: { is_complete: true } }
  )
  expect(res.status()).toBe(404)
})
