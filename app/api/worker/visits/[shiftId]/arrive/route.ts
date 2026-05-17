import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { validateWorkerToken } from '@/lib/worker/auth'

// POST — worker confirms arrival at a visit
export async function POST(req: NextRequest, { params }: { params: Promise<{ shiftId: string }> }) {
  const body = await req.json().catch(() => ({})) as { token?: string }
  const result = await validateWorkerToken(body.token)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  const { id: staffProfileId, company_id: companyId } = result.worker
  const { shiftId } = await params

  const { data: shift } = await adminClient
    .from('shifts')
    .select('id, assigned_staff_id, status, shift_date, start_time')
    .eq('id', shiftId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!shift || shift.assigned_staff_id !== staffProfileId) {
    return NextResponse.json({ error: 'Shift not found or not assigned to you' }, { status: 404 })
  }

  const now = new Date().toISOString()

  // Ensure visit note exists
  let { data: note } = await adminClient
    .from('visit_notes')
    .select('id, arrived_at')
    .eq('shift_id', shiftId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!note) {
    const { data: inserted } = await adminClient
      .from('visit_notes')
      .insert({
        company_id:       companyId,
        shift_id:         shiftId,
        staff_profile_id: staffProfileId,
        arrived_at:       now,
        status:           'draft',
      })
      .select()
      .single()
    note = inserted
  } else if (!note.arrived_at) {
    await adminClient.from('visit_notes').update({ arrived_at: now }).eq('id', note.id)
  }

  // Update shift to in_progress
  if (shift.status !== 'in_progress' && shift.status !== 'completed') {
    await adminClient.from('shifts').update({ status: 'in_progress', updated_at: now }).eq('id', shiftId)
  }

  // Compute lateness
  const scheduledStart = new Date(`${shift.shift_date}T${shift.start_time}`)
  const latenessMin = Math.max(0, Math.floor((new Date(now).getTime() - scheduledStart.getTime()) / 60_000))

  // Ensure timesheet clock-in
  const { data: existingTs } = await adminClient.from('timesheets').select('id, clock_in').eq('shift_id', shiftId).eq('staff_profile_id', staffProfileId).maybeSingle()
  if (!existingTs) {
    await adminClient.from('timesheets').insert({
      company_id:        companyId,
      staff_profile_id:  staffProfileId,
      shift_id:          shiftId,
      scheduled_start:   scheduledStart.toISOString(),
      clock_in:          now,
      status:            'clocked_in',
      break_minutes:     0,
      lateness_minutes:  latenessMin,
    })
  }

  void (async () => {
    try {
      await adminClient.from('audit_logs').insert({
        company_id: companyId, actor_id: staffProfileId, action: 'visit.arrived',
        entity_type: 'shift', entity_id: shiftId,
        metadata: { arrived_at: now, lateness_minutes: latenessMin },
      })
    } catch { /* non-blocking */ }
  })()

  return NextResponse.json({ ok: true, arrived_at: now, lateness_minutes: latenessMin, visit_note_id: note?.id ?? null })
}
