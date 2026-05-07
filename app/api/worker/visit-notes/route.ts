import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { validateWorkerToken } from '@/lib/worker/auth'

// ── GET /api/worker/visit-notes?shift_id=xxx ──────────────────────────────────
// Returns the visit note for a specific shift, enforcing worker ownership.

export async function GET(request: NextRequest) {
  const token   = request.nextUrl.searchParams.get('token')
  const shiftId = request.nextUrl.searchParams.get('shift_id')

  const result = await validateWorkerToken(token)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  const { id: staffProfileId } = result.worker

  if (!shiftId) {
    return NextResponse.json({ error: 'shift_id is required' }, { status: 400 })
  }

  // Verify the shift belongs to this worker
  const { data: shift } = await adminClient
    .from('shifts')
    .select('id, assigned_staff_id')
    .eq('id', shiftId)
    .maybeSingle()

  const s = shift as { id: string; assigned_staff_id: string | null } | null
  if (!s || s.assigned_staff_id !== staffProfileId) {
    return NextResponse.json({ error: 'Shift not assigned to you' }, { status: 403 })
  }

  const { data: note, error } = await adminClient
    .from('visit_notes')
    .select('*')
    .eq('shift_id', shiftId)
    .maybeSingle()

  if (error) {
    console.error('[worker/visit-notes] GET error:', error.message)
    return NextResponse.json({ error: 'Failed to fetch visit note' }, { status: 500 })
  }

  return NextResponse.json(note ?? null)
}

// ── POST /api/worker/visit-notes ──────────────────────────────────────────────
// Creates a draft visit note for a shift assigned to this worker.

interface CreateBody {
  token?:    string
  shift_id?: string
}

export async function POST(request: NextRequest) {
  let body: CreateBody
  try {
    body = await request.json() as CreateBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const result = await validateWorkerToken(body.token)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  const { id: staffProfileId, company_id: companyId } = result.worker

  const shiftId = body.shift_id
  if (!shiftId) {
    return NextResponse.json({ error: 'shift_id is required' }, { status: 400 })
  }

  // Verify shift ownership
  const { data: shift, error: shiftErr } = await adminClient
    .from('shifts')
    .select('id, assigned_staff_id, client_id')
    .eq('id', shiftId)
    .maybeSingle()

  if (shiftErr || !shift) return NextResponse.json({ error: 'Shift not found' }, { status: 404 })

  const s = shift as { id: string; assigned_staff_id: string | null; client_id: string | null }

  if (s.assigned_staff_id !== staffProfileId) {
    return NextResponse.json({ error: 'Shift not assigned to you' }, { status: 403 })
  }

  // Prevent duplicate
  const { data: existing } = await adminClient
    .from('visit_notes')
    .select('id')
    .eq('shift_id', shiftId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'Visit note already exists', note_id: (existing as { id: string }).id },
      { status: 409 }
    )
  }

  const { data: note, error: insertErr } = await adminClient
    .from('visit_notes')
    .insert({
      company_id:       companyId,
      shift_id:         shiftId,
      client_id:        s.client_id ?? null,
      staff_profile_id: staffProfileId,
      status:           'draft',
    })
    .select()
    .single()

  if (insertErr) {
    console.error('[worker/visit-notes] POST insert error:', insertErr.message)
    return NextResponse.json({ error: 'Failed to create visit note' }, { status: 500 })
  }

  void (async () => {
    try {
      await adminClient.from('audit_logs').insert({
        company_id:  companyId,
        actor_id:    staffProfileId,
        action:      'visit_note.created_by_worker',
        entity_type: 'visit_note',
        entity_id:   (note as { id: string }).id,
        metadata:    { shift_id: shiftId },
      })
    } catch (e) { console.error('[worker/visit-notes] audit log error:', e) }
  })()

  return NextResponse.json(note, { status: 201 })
}

// ── PATCH /api/worker/visit-notes?note_id=xxx ─────────────────────────────────
// Updates a draft visit note — worker can only edit their own.

const PATCH_ALLOWED = [
  'wellbeing_notes', 'care_tasks_completed', 'medication_prompted', 'medication_notes',
  'food_fluid_notes', 'incident_reported', 'incident_notes', 'missed_tasks',
  'general_notes', 'status',
] as const

interface PatchBody {
  token?:    string
  note_id?:  string
  [key: string]: unknown
}

export async function PATCH(request: NextRequest) {
  let body: PatchBody
  try {
    body = await request.json() as PatchBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const result = await validateWorkerToken(body.token)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  const { id: staffProfileId, company_id: companyId } = result.worker

  const noteId = body.note_id
  if (!noteId) {
    return NextResponse.json({ error: 'note_id is required' }, { status: 400 })
  }

  // Fetch note and verify ownership
  const { data: existing, error: fetchErr } = await adminClient
    .from('visit_notes')
    .select('id, status, staff_profile_id')
    .eq('id', noteId)
    .maybeSingle()

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Visit note not found' }, { status: 404 })
  }

  const note = existing as { id: string; status: string; staff_profile_id: string | null }

  if (note.staff_profile_id !== staffProfileId) {
    return NextResponse.json({ error: 'This visit note is not yours' }, { status: 403 })
  }

  if (note.status === 'submitted' || note.status === 'locked') {
    return NextResponse.json(
      { error: `Cannot edit a ${note.status} visit note` },
      { status: 409 }
    )
  }

  // Validate status transition
  if ('status' in body && body.status !== 'submitted' && body.status !== 'draft') {
    return NextResponse.json({ error: 'status must be draft or submitted' }, { status: 400 })
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of PATCH_ALLOWED) {
    if (key in body) updates[key] = body[key] ?? null
  }
  if ('status' in body && body.status === 'submitted') {
    updates.submitted_at = new Date().toISOString()
  }

  const { data: updated, error: updateErr } = await adminClient
    .from('visit_notes')
    .update(updates)
    .eq('id', noteId)
    .select()
    .single()

  if (updateErr) {
    console.error('[worker/visit-notes] PATCH error:', updateErr.message)
    return NextResponse.json({ error: 'Failed to update visit note' }, { status: 500 })
  }

  const action = body.status === 'submitted'
    ? 'visit_note.submitted_by_worker'
    : 'visit_note.updated_by_worker'

  void (async () => {
    try {
      await adminClient.from('audit_logs').insert({
        company_id:  companyId,
        actor_id:    staffProfileId,
        action,
        entity_type: 'visit_note',
        entity_id:   noteId,
        metadata:    updates,
      })
    } catch (e) { console.error('[worker/visit-notes] audit log error:', e) }
  })()

  return NextResponse.json(updated)
}
