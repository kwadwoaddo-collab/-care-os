import { NextRequest, NextResponse } from 'next/server'
import { adminClient }         from '@/lib/supabase/admin'
import { validateWorkerToken } from '@/lib/worker/auth'

// ── GET /api/worker/notifications?token=xxx ───────────────────────────────────
// Returns in-app notifications for the authenticated worker.

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')

  const result = await validateWorkerToken(token)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  const staffProfileId = result.worker.id
  const companyId      = result.worker.company_id

  const { data, error } = await adminClient
    .from('in_app_notifications')
    .select('id, title, message, action_url, event_type, read_at, created_at')
    .eq('staff_profile_id', staffProfileId)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) {
    console.error('[worker/notifications/GET]', error.message)
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

// ── PATCH /api/worker/notifications?token=xxx — mark notifications as read ────

export async function PATCH(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')

  const result = await validateWorkerToken(token)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  const staffProfileId = result.worker.id
  const companyId      = result.worker.company_id

  // Optional: mark specific id or all unread
  let body: { id?: string } = {}
  try { body = await request.json() as { id?: string } } catch { /* body is optional */ }

  let q = adminClient
    .from('in_app_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('staff_profile_id', staffProfileId)
    .eq('company_id', companyId)
    .is('read_at', null)

  if (body.id) {
    q = q.eq('id', body.id)
  }

  const { error } = await q

  if (error) {
    console.error('[worker/notifications/PATCH]', error.message)
    return NextResponse.json({ error: 'Failed to mark as read' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
