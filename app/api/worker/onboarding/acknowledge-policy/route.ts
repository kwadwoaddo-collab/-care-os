/**
 * POST /api/worker/onboarding/acknowledge-policy
 *
 * Marks the worker's policy_acknowledged field as true.
 * Authentication: worker session token in request body.
 */

import { NextResponse } from 'next/server'
import { adminClient }  from '@/lib/supabase/admin'

export async function POST(request: Request) {
  let body: { token?: string }
  try {
    body = await request.json() as { token?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { token } = body
  if (!token) {
    return NextResponse.json({ error: 'token required' }, { status: 400 })
  }

  // Resolve token
  const { data: inv } = await adminClient
    .from('portal_invitations')
    .select('staff_profile_id, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (!inv) {
    return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 })
  }

  if (new Date(inv.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Session has expired' }, { status: 401 })
  }

  const { error } = await adminClient
    .from('staff_profiles')
    .update({
      policy_acknowledged:    true,
      policy_acknowledged_at: new Date().toISOString(),
    })
    .eq('id', inv.staff_profile_id)

  if (error) {
    console.error('[acknowledge-policy]', error.message)
    return NextResponse.json({ error: 'Failed to save acknowledgement' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
