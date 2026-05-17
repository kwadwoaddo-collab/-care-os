import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { validateWorkerToken } from '@/lib/worker/auth'

// POST — worker records a missed visit
export async function POST(req: NextRequest, { params }: { params: Promise<{ shiftId: string }> }) {
  const body = await req.json().catch(() => ({})) as { token?: string; reason?: string }
  const result = await validateWorkerToken(body.token)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  const { id: staffProfileId, company_id: companyId } = result.worker
  const { shiftId } = await params
  const now = new Date().toISOString()

  const { data: shift } = await adminClient
    .from('shifts')
    .select('id, assigned_staff_id, status')
    .eq('id', shiftId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!shift || shift.assigned_staff_id !== staffProfileId) {
    return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
  }

  // Upsert visit note as missed
  const { data: existing } = await adminClient.from('visit_notes').select('id').eq('shift_id', shiftId).eq('company_id', companyId).maybeSingle()

  if (existing) {
    await adminClient.from('visit_notes').update({ is_missed: true, missed_reason: body.reason ?? null, missed_at: now, updated_at: now }).eq('id', existing.id)
  } else {
    await adminClient.from('visit_notes').insert({
      company_id: companyId, shift_id: shiftId, staff_profile_id: staffProfileId,
      is_missed: true, missed_reason: body.reason ?? null, missed_at: now, status: 'submitted', submitted_at: now,
    })
  }

  // Mark shift as missed
  await adminClient.from('shifts').update({ status: 'missed', updated_at: now }).eq('id', shiftId)

  // Mark timesheet as missed
  const { data: ts } = await adminClient.from('timesheets').select('id').eq('shift_id', shiftId).eq('staff_profile_id', staffProfileId).maybeSingle()
  if (ts) {
    await adminClient.from('timesheets').update({ status: 'missed', updated_at: now }).eq('id', (ts as {id:string}).id)
  }

  // Create anomaly
  await adminClient.from('visit_anomalies').insert({
    company_id: companyId, shift_id: shiftId,
    anomaly_type: 'no_show', severity: 'critical',
    description: `Visit recorded as missed. Reason: ${body.reason ?? 'Not provided'}`,
    auto_detected: false,
    detection_data: { reason: body.reason, reported_by: staffProfileId },
  })

  void (async () => {
    try {
      await adminClient.from('audit_logs').insert({ company_id: companyId, actor_id: staffProfileId, action: 'visit.missed', entity_type: 'shift', entity_id: shiftId, metadata: { reason: body.reason, missed_at: now } })
    } catch { /* non-blocking */ }
  })()

  return NextResponse.json({ ok: true, missed_at: now })
}
