import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { validateWorkerToken } from '@/lib/worker/auth'

const ESCALATION_ACTIONS = ['refused', 'missed', 'unavailable']

// GET — fetch medication records for a shift
export async function GET(req: NextRequest, { params }: { params: Promise<{ shiftId: string }> }) {
  const token  = req.nextUrl.searchParams.get('token')
  const result = await validateWorkerToken(token)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  const { id: staffProfileId, company_id: companyId } = result.worker
  const { shiftId } = await params

  const { data: shift } = await adminClient.from('shifts').select('assigned_staff_id').eq('id', shiftId).eq('company_id', companyId).maybeSingle()
  if (!shift || shift.assigned_staff_id !== staffProfileId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: records } = await adminClient
    .from('visit_medication_records')
    .select('id, medication_name, dose, route, scheduled_time, action, administered_at, refused_reason, prn_reason, notes, requires_escalation, escalated')
    .eq('shift_id', shiftId)
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })

  return NextResponse.json({ records: records ?? [] })
}

// POST — record a medication administration
export async function POST(req: NextRequest, { params }: { params: Promise<{ shiftId: string }> }) {
  const body = await req.json().catch(() => ({})) as {
    token?: string
    medication_name?: string
    dose?: string
    route?: string
    scheduled_time?: string
    action?: string
    refused_reason?: string
    prn_reason?: string
    notes?: string
  }
  const result = await validateWorkerToken(body.token)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  const { id: staffProfileId, company_id: companyId } = result.worker
  const { shiftId } = await params

  if (!body.medication_name || !body.action) {
    return NextResponse.json({ error: 'medication_name and action are required' }, { status: 400 })
  }

  const validActions = ['administered', 'refused', 'unavailable', 'missed', 'prn']
  if (!validActions.includes(body.action)) {
    return NextResponse.json({ error: `action must be one of: ${validActions.join(', ')}` }, { status: 400 })
  }

  // Ensure visit note exists
  let { data: note } = await adminClient.from('visit_notes').select('id').eq('shift_id', shiftId).eq('company_id', companyId).maybeSingle()
  if (!note) {
    const { data: inserted } = await adminClient.from('visit_notes').insert({ company_id: companyId, shift_id: shiftId, staff_profile_id: staffProfileId, status: 'draft', arrived_at: new Date().toISOString() }).select('id').single()
    note = inserted
  }

  const requiresEscalation = ESCALATION_ACTIONS.includes(body.action)
  const now = new Date().toISOString()

  const { data: record, error } = await adminClient.from('visit_medication_records').insert({
    visit_note_id:      note!.id,
    company_id:         companyId,
    shift_id:           shiftId,
    staff_profile_id:   staffProfileId,
    medication_name:    body.medication_name.slice(0, 200),
    dose:               body.dose ?? null,
    route:              body.route ?? null,
    scheduled_time:     body.scheduled_time ?? null,
    action:             body.action,
    administered_at:    body.action === 'administered' || body.action === 'prn' ? now : null,
    refused_reason:     body.refused_reason ?? null,
    prn_reason:         body.prn_reason ?? null,
    notes:              body.notes ?? null,
    requires_escalation: requiresEscalation,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Flag escalation in visit note
  if (requiresEscalation) {
    await adminClient.from('visit_notes').update({ medication_prompted: true, medication_notes: body.notes ?? body.refused_reason ?? 'Medication issue recorded' }).eq('id', note!.id)
  }

  // Audit
  void (async () => {
    try {
      await adminClient.from('audit_logs').insert({ company_id: companyId, actor_id: staffProfileId, action: `medication.${body.action}`, entity_type: 'visit_medication_record', entity_id: (record as {id:string}).id, metadata: { medication_name: body.medication_name, action: body.action, requires_escalation: requiresEscalation } })
    } catch { /* non-blocking */ }
  })()

  return NextResponse.json({ record, requires_escalation: requiresEscalation }, { status: 201 })
}
