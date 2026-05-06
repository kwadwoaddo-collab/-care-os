import { NextRequest, NextResponse } from 'next/server'
import { adminClient }               from '@/lib/supabase/admin'

// TODO: RESTORE AUTH — remove DEV_BYPASS_AUTH before deploying or merging to main.
const DEV_BYPASS_AUTH = process.env.NODE_ENV === 'development'

const PATCH_ALLOWED = [
  'wellbeing_notes', 'care_tasks_completed', 'medication_prompted', 'medication_notes',
  'food_fluid_notes', 'incident_reported', 'incident_notes', 'missed_tasks',
  'general_notes', 'client_signature', 'staff_signature',
] as const

type PatchField = typeof PATCH_ALLOWED[number]

// ── GET /api/admin/visit-notes/[id] ──────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!DEV_BYPASS_AUTH) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const { data, error } = await adminClient
    .from('visit_notes')
    .select(`
      *,
      shifts!shift_id ( id, title, shift_date, start_time, end_time ),
      clients!client_id ( id, first_name, last_name ),
      staff_profiles!staff_profile_id ( id, first_name, last_name )
    `)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[visit-notes/[id]] GET error:', error.message)
    return NextResponse.json({ error: 'Failed to fetch visit note' }, { status: 500 })
  }

  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(data)
}

// ── PATCH /api/admin/visit-notes/[id] ────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!DEV_BYPASS_AUTH) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // Check current status before allowing edit
  const { data: existing, error: fetchErr } = await adminClient
    .from('visit_notes')
    .select('id, status')
    .eq('id', id)
    .maybeSingle()

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Visit note not found' }, { status: 404 })
  }

  if (existing.status === 'submitted' || existing.status === 'locked') {
    return NextResponse.json(
      { error: `Cannot edit a ${existing.status as string} visit note` },
      { status: 409 }
    )
  }

  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of PATCH_ALLOWED) {
    if (key in body) updates[key as PatchField] = body[key] ?? null
  }

  const { data: note, error: updateErr } = await adminClient
    .from('visit_notes')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (updateErr) {
    console.error('[visit-notes/[id]] PATCH error:', updateErr.message)
    return NextResponse.json(
      { error: 'Failed to update visit note', supabase_message: updateErr.message },
      { status: 500 }
    )
  }

  // ── Audit log ──────────────────────────────────────────────────────────────
  try {
    await adminClient.from('audit_logs').insert({
      action:      'visit_note.updated',
      entity_type: 'visit_note',
      entity_id:   id,
      actor:       'admin',
      metadata:    updates,
    })
  } catch { /* non-critical */ }

  return NextResponse.json(note)
}
