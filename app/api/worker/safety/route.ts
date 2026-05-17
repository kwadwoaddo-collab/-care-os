import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { validateWorkerToken } from '@/lib/worker/auth'
import { createNotification } from '@/lib/notifications/createNotification'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as {
    token?:       string
    alert_type?:  string
    description?: string
    location?:    string
    shift_id?:    string
  }

  const result = await validateWorkerToken(body.token)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  const { id: staffProfileId, company_id: companyId, first_name, last_name } = result.worker
  const workerName = [first_name, last_name].filter(Boolean).join(' ') || 'A worker'

  const validTypes = ['emergency', 'unsafe_environment', 'welfare_check', 'request_support']
  const alertType  = body.alert_type && validTypes.includes(body.alert_type) ? body.alert_type : 'emergency'

  const now = new Date().toISOString()

  // Optionally link shift/client
  let clientId: string | null = null
  if (body.shift_id) {
    const { data: shift } = await adminClient
      .from('shifts')
      .select('client_id')
      .eq('id', body.shift_id)
      .eq('company_id', companyId)
      .maybeSingle()
    clientId = (shift?.client_id as string) ?? null
  }

  const { data: incident, error } = await adminClient.from('incidents').insert({
    company_id:             companyId,
    client_id:              clientId,
    staff_profile_id:       staffProfileId,
    shift_id:               body.shift_id ?? null,
    incident_type:          'other',
    severity:               'critical',
    status:                 'open',
    occurred_at:            now,
    description:            body.description ?? `Safety alert raised by ${workerName} via worker portal.`,
    immediate_action_taken: `Worker raised ${alertType.replace(/_/g, ' ')} alert from mobile portal.`,
    escalation_required:    true,
    follow_up_required:     true,
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const incidentId = (incident as { id: string }).id

  await createNotification({
    recipient: 'admin',
    companyId,
    eventType: 'incident_created',
    title:     `SAFETY ALERT — ${alertType.replace(/_/g, ' ').toUpperCase()}: ${workerName}`,
    message:   body.description
      ? `${workerName}: "${body.description}"`
      : `${workerName} has raised a ${alertType.replace(/_/g, ' ')} alert. Respond immediately.`,
    actionUrl: `/admin/incidents/${incidentId}`,
    entityId:  incidentId,
    actorId:   staffProfileId,
  })

  void (async () => {
    try {
      await adminClient.from('audit_logs').insert({
        company_id:  companyId,
        actor_id:    staffProfileId,
        action:      'worker.safety_alert_raised',
        entity_type: 'incident',
        entity_id:   incidentId,
        metadata:    { alert_type: alertType, description: body.description, location: body.location },
      })
    } catch { /* non-blocking */ }
  })()

  return NextResponse.json({ ok: true, incident_id: incidentId })
}
