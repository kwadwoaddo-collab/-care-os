import { NextRequest, NextResponse } from 'next/server'
import { adminClient }               from '@/lib/supabase/admin'

// TODO: RESTORE AUTH — remove DEV_BYPASS_AUTH before deploying or merging to main.
const DEV_BYPASS_AUTH = process.env.NODE_ENV === 'development'

// ── GET /api/admin/visit-notes ────────────────────────────────────────────────
// Supports ?client_id=xxx and ?staff_profile_id=xxx for filtering.

export async function GET(request: NextRequest) {
  if (!DEV_BYPASS_AUTH) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const clientId        = searchParams.get('client_id')
  const staffProfileId  = searchParams.get('staff_profile_id')

  let query = adminClient
    .from('visit_notes')
    .select(`
      id, status, incident_reported, submitted_at, created_at,
      shifts!shift_id ( id, title, shift_date, start_time, end_time ),
      clients!client_id ( id, first_name, last_name ),
      staff_profiles!staff_profile_id ( id, first_name, last_name )
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  if (clientId)       query = query.eq('client_id',       clientId)
  if (staffProfileId) query = query.eq('staff_profile_id', staffProfileId)

  const { data, error } = await query

  if (error) {
    console.error('[visit-notes] GET error:', error.message)
    return NextResponse.json({ error: 'Failed to fetch visit notes' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

// ── POST /api/admin/visit-notes ───────────────────────────────────────────────

interface CreateBody {
  shift_id: unknown
}

export async function POST(request: NextRequest) {
  if (!DEV_BYPASS_AUTH) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: CreateBody
  try {
    body = await request.json() as CreateBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const shiftId = body.shift_id
  if (typeof shiftId !== 'string' || !shiftId) {
    return NextResponse.json({ error: 'shift_id is required' }, { status: 400 })
  }

  // ── Fetch shift to prefill linked fields ───────────────────────────────────
  const { data: shift, error: shiftErr } = await adminClient
    .from('shifts')
    .select('id, company_id, client_id, assigned_staff_id')
    .eq('id', shiftId)
    .maybeSingle()

  if (shiftErr || !shift) {
    return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
  }

  // ── Prevent duplicate note for the same shift ──────────────────────────────
  const { data: existing } = await adminClient
    .from('visit_notes')
    .select('id')
    .eq('shift_id', shiftId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'A visit note already exists for this shift', note_id: existing.id as string },
      { status: 409 }
    )
  }

  // ── Insert note ────────────────────────────────────────────────────────────
  const { data: note, error: insertErr } = await adminClient
    .from('visit_notes')
    .insert({
      company_id:       shift.company_id,
      shift_id:         shiftId,
      client_id:        shift.client_id         ?? null,
      staff_profile_id: shift.assigned_staff_id ?? null,
      status:           'draft',
    })
    .select()
    .single()

  if (insertErr) {
    console.error('[visit-notes] insert error:', insertErr.message)
    return NextResponse.json(
      { error: 'Failed to create visit note', supabase_message: insertErr.message },
      { status: 500 }
    )
  }

  // ── Audit log ──────────────────────────────────────────────────────────────
  try {
    await adminClient.from('audit_logs').insert({
      action:      'visit_note.created',
      entity_type: 'visit_note',
      entity_id:   note.id,
      actor:       'admin',
      metadata:    { shift_id: shiftId },
    })
  } catch { /* non-critical */ }

  return NextResponse.json(note, { status: 201 })
}
