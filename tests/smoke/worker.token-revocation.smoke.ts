/**
 * tests/smoke/worker.token-revocation.smoke.ts
 *
 * Verifies Workstream C: terminating/deactivating a staff member immediately
 * revokes their worker portal token (rather than leaving it valid until its
 * natural 7-day expiry).
 *
 * This test creates its own throwaway staff_profiles fixture rather than
 * reusing QA_WORKER_PORTAL_TOKEN — that token is shared by every other worker
 * smoke test and must stay valid for the whole suite run.
 *
 * DB access here mirrors scripts/seed-qa-environment.ts: a service-role
 * Supabase client is built directly with @supabase/supabase-js rather than
 * importing lib/supabase/admin.ts, which has a hard `import 'server-only'`
 * guard that throws when loaded outside the Next.js server runtime.
 *
 * Runs in the "chromium" project (admin-authenticated via storageState).
 */

require('dotenv').config({ path: '.env.local' })

import crypto from 'crypto'
import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const QA_COMPANY_SLUG  = 'sprintscale-qa'

test('worker: token is revoked immediately when staff member is terminated', async ({ request }) => {
  test.skip(!SUPABASE_URL || !SERVICE_ROLE_KEY, 'Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')

  const db = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: company } = await db
    .from('companies')
    .select('id')
    .eq('slug', QA_COMPANY_SLUG)
    .maybeSingle()

  if (!company) {
    test.skip(true, 'QA company not seeded — run: npm run qa:seed')
    return
  }

  const rawToken  = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')

  const { data: fixture, error: insertError } = await db
    .from('staff_profiles')
    .insert({
      company_id:              company.id,
      first_name:              '[QA-Revocation]',
      last_name:                'Fixture',
      email:                   `qa.token-revocation.${Date.now()}@sprintscaleit.co.uk`,
      job_role:                'Care Worker',
      status:                  'active',
      employment_type:         'full_time',
      contracted_hours:        37.5,
      start_date:               new Date().toISOString().slice(0, 10),
      onboarding_completed:    true,
      portal_token_hash:       tokenHash,
      portal_token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select('id')
    .single()

  expect(insertError, insertError?.message).toBeNull()
  const staffId = fixture!.id as string

  try {
    // Token works before termination
    const beforeRes = await request.get(`/api/worker/validate?token=${encodeURIComponent(rawToken)}`)
    expect(beforeRes.status()).toBe(200)

    // Terminate the fixture via the real admin status route
    const terminateRes = await request.patch(`/api/admin/staff/${staffId}/status`, {
      data: {
        status:              'terminated',
        force:               true,
        termination_date:    new Date().toISOString().slice(0, 10),
        termination_reason:  '[QA] smoke test — token revocation verification',
      },
    })
    expect(terminateRes.status(), await terminateRes.text()).toBe(200)

    // Token must now be rejected
    const afterRes = await request.get(`/api/worker/validate?token=${encodeURIComponent(rawToken)}`)
    expect(afterRes.status()).toBe(401)
  } finally {
    await db.from('staff_profiles').delete().eq('id', staffId)
  }
})
