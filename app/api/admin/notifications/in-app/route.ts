import { NextRequest, NextResponse } from 'next/server'
import { adminClient }  from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InAppNotification {
  id:         string
  profile_id: string
  title:      string
  message:    string | null
  action_url: string | null
  event_type: string
  read_at:    string | null
  created_at: string
}

// ── GET — list recent notifications for a profile ────────────────────────────
// Admin only (for the admin panel view). Workers access their own via the
// Supabase anon client (RLS policy allows owner-read).

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const profileId = request.nextUrl.searchParams.get('profile_id')
  const limit     = Math.min(parseInt(request.nextUrl.searchParams.get('limit') ?? '50'), 200)

  let query = adminClient
    .from('in_app_notifications')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (profileId) {
    query = query.eq('profile_id', profileId)
  }

  const { data, error } = await query

  if (error) {
    console.error('[in-app-notifications/GET]', error.message)
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

// ── POST — create a notification for a profile ───────────────────────────────

interface CreateBody {
  /** staff_profiles.id for worker notifications */
  staff_profile_id?: string
  /** profiles.id for admin notifications */
  profile_id?: string
  title:      string
  message?:   string
  action_url?: string
  event_type?: string
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  let body: CreateBody
  try {
    body = await request.json() as CreateBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.title || (!body.staff_profile_id && !body.profile_id)) {
    return NextResponse.json({ error: 'title and one of staff_profile_id or profile_id are required' }, { status: 422 })
  }

  const { data, error } = await adminClient
    .from('in_app_notifications')
    .insert({
      company_id:       companyId,
      staff_profile_id: body.staff_profile_id ?? null,
      profile_id:       body.profile_id ?? null,
      title:            body.title.slice(0, 200),
      message:          body.message?.slice(0, 1000) ?? null,
      action_url:       body.action_url ?? null,
      event_type:       body.event_type ?? 'info',
    })
    .select()
    .single()

  if (error) {
    console.error('[in-app-notifications/POST]', error.message)
    return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
