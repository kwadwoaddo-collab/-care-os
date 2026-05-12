/**
 * POST /api/worker/onboarding/acknowledge-policy
 *
 * Marks the worker's policy_acknowledged field as true.
 *
 * FIXED (2026-05-12):
 *   Previously used portal_invitations token lookup (legacy).
 *   Now uses validateWorkerToken() — identical to every other worker API route.
 *   Token is sent in the JSON body for backwards compatibility with the page.
 */

import { NextResponse }        from 'next/server'
import { adminClient }         from '@/lib/supabase/admin'
import { validateWorkerToken } from '@/lib/worker/auth'

export async function POST(request: Request) {
  let body: { token?: string }
  try {
    body = await request.json() as { token?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // ── Auth: same validateWorkerToken as every other worker route ────────────
  const auth = await validateWorkerToken(body.token)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { error } = await adminClient
    .from('staff_profiles')
    .update({
      policy_acknowledged:    true,
      policy_acknowledged_at: new Date().toISOString(),
    })
    .eq('id', auth.worker.id)

  if (error) {
    console.error('[acknowledge-policy]', error.message)
    return NextResponse.json({ error: 'Failed to save acknowledgement' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
