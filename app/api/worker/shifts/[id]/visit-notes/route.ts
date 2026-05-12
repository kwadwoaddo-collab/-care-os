import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { validateWorkerToken } from '@/lib/worker/auth'

interface VisitNotesBody {
  token: string
  wellbeing_notes?: string
  care_tasks_completed?: string[]
  medication_prompted?: boolean
  medication_notes?: string
  incident_reported?: boolean
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let body: VisitNotesBody
  try {
    body = await request.json() as VisitNotesBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { id: shiftId } = await params
  const result = await validateWorkerToken(body.token)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  const { id: staffProfileId, company_id: companyId } = result.worker

  const { data: shift, error: fetchErr } = await adminClient
    .from('shifts')
    .select('id, assigned_staff_id, status, client_id')
    .eq('id', shiftId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (fetchErr || !shift) {
    return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
  }

  if (shift.assigned_staff_id !== staffProfileId) {
    return NextResponse.json({ error: 'Not authorized for this shift' }, { status: 403 })
  }

  const { data: note, error: insertErr } = await adminClient
    .from('visit_notes')
    .insert({
      company_id: companyId,
      shift_id: shiftId,
      staff_profile_id: staffProfileId,
      client_id: shift.client_id,
      wellbeing_notes: body.wellbeing_notes ?? null,
      care_tasks_completed: body.care_tasks_completed ?? [],
      medication_prompted: body.medication_prompted ?? false,
      medication_notes: body.medication_notes ?? null,
      incident_reported: body.incident_reported ?? false,
    })
    .select()
    .single()

  if (insertErr) {
    console.error('[visit-notes] insert err:', insertErr)
    return NextResponse.json({ error: 'Failed to save visit notes' }, { status: 500 })
  }

  // Audit log
  try {
    await adminClient.from('audit_logs').insert({
      company_id:  companyId,
      actor_id:    staffProfileId,
      action:      'visit_notes.submitted',
      entity_type: 'shift',
      entity_id:   shiftId,
      metadata:    { has_incident: body.incident_reported }
    })
  } catch { /* ignore */ }

  return NextResponse.json(note, { status: 201 })
}
