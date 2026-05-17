import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { validateWorkerToken } from '@/lib/worker/auth'
import { createNotification } from '@/lib/notifications/createNotification'

// POST — worker raises an in-field escalation
export async function POST(req: NextRequest, { params }: { params: Promise<{ shiftId: string }> }) {
  const body = await req.json().catch(() => ({})) as {
    token?: string
    escalation_type?: string
    notes?: string
    severity?: string
  }
  const result = await validateWorkerToken(body.token)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  const { id: staffProfileId, company_id: companyId } = result.worker
  const { shiftId } = await params

  const { data: shift } = await adminClient
    .from('shifts')
    .select('id, assigned_staff_id, client_name, client_id, title')
    .eq('id', shiftId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!shift || shift.assigned_staff_id !== staffProfileId) {
    return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
  }

  const validTypes = ['safeguarding', 'medical', 'medication', 'operational', 'client_refusal', 'other']
  const escType = body.escalation_type && validTypes.includes(body.escalation_type)
    ? body.escalation_type
    : 'other'

  const severity = body.severity === 'critical' ? 'critical' : body.severity === 'high' ? 'high' : 'medium'
  const now = new Date().toISOString()

  // Update visit note with escalation
  const { data: note } = await adminClient.from('visit_notes').select('id').eq('shift_id', shiftId).eq('company_id', companyId).maybeSingle()
  if (note) {
    await adminClient.from('visit_notes').update({
      escalation_raised:    true,
      escalation_type:      escType,
      escalation_notes:     body.notes ?? null,
      escalation_raised_at: now,
      updated_at:           now,
    }).eq('id', note.id)
  }

  // Create incident record
  const { data: incident } = await adminClient.from('incidents').insert({
    company_id:             companyId,
    client_id:              shift.client_id ?? null,
    staff_profile_id:       staffProfileId,
    shift_id:               shiftId,
    incident_type:          escType === 'safeguarding' ? 'safeguarding' : escType === 'medication' ? 'medication_error' : 'other',
    severity,
    status:                 'open',
    occurred_at:            now,
    description:            body.notes ?? `Field escalation raised during visit: ${shift.title}`,
    immediate_action_taken: 'Escalation raised by care worker during visit',
    escalation_required:    true,
    follow_up_required:     true,
  }).select('id').single()

  // Add visit anomaly
  await adminClient.from('visit_anomalies').insert({
    company_id:   companyId,
    shift_id:     shiftId,
    visit_note_id: note?.id ?? null,
    anomaly_type: 'escalation_raised',
    severity:     severity === 'critical' ? 'critical' : 'warning',
    description:  `Field escalation raised: ${escType}. ${body.notes ?? ''}`.trim(),
    auto_detected: false,
    detection_data: { escalation_type: escType, raised_by: staffProfileId },
  })

  // Fan-out in-app notification to all admins/coordinators
  await createNotification({
    recipient:  'admin',
    companyId,
    eventType:  'incident_created',
    title:      `Field escalation: ${escType.replace(/_/g, ' ')} — ${shift.client_name ?? shift.title}`,
    message:    body.notes?.slice(0, 200) ?? 'Worker has raised a field escalation. Review immediately.',
    actionUrl:  incident ? `/admin/incidents/${(incident as {id:string}).id}` : '/admin/incidents',
    entityId:   incident ? (incident as {id:string}).id : shiftId,
    actorId:    staffProfileId,
  })

  void (async () => {
    try {
      await adminClient.from('audit_logs').insert({ company_id: companyId, actor_id: staffProfileId, action: 'visit.escalation_raised', entity_type: 'shift', entity_id: shiftId, metadata: { escalation_type: escType, severity, notes: body.notes } })
    } catch { /* non-blocking */ }
  })()

  return NextResponse.json({ ok: true, escalation_type: escType, incident_id: incident ? (incident as {id:string}).id : null })
}
