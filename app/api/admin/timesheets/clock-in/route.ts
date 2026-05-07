import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'

interface ClockInBody {
  shift_id:         string
  staff_profile_id: string
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  let body: ClockInBody
  try {
    body = await request.json() as ClockInBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { shift_id, staff_profile_id } = body
  if (!shift_id || !staff_profile_id) {
    return NextResponse.json(
      { error: 'shift_id and staff_profile_id are required' },
      { status: 400 }
    )
  }

  // ── Look up the shift for scheduled times and company_id ──────────────────
  const { data: shift, error: shiftErr } = await adminClient
    .from('shifts')
    .select('id, company_id, shift_date, start_time')
    .eq('id', shift_id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (shiftErr || !shift) {
    return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
  }

  const now = new Date()

  // Build scheduled_start from shift_date + start_time (treat as local midnight UTC for simplicity)
  const scheduledStart = new Date(`${shift.shift_date}T${shift.start_time}Z`)

  // lateness_minutes: how many minutes after scheduled start the clock-in happened
  const latenessMinutes = Math.max(
    0,
    Math.floor((now.getTime() - scheduledStart.getTime()) / 60_000)
  )

  // ── Upsert timesheet ───────────────────────────────────────────────────────
  const { data: existing } = await adminClient
    .from('timesheets')
    .select('id, status')
    .eq('shift_id', shift_id)
    .eq('staff_profile_id', staff_profile_id)
    .maybeSingle()

  let timesheet: Record<string, unknown>

  if (existing) {
    const { data: updated, error: updateErr } = await adminClient
      .from('timesheets')
      .update({
        clock_in:         now.toISOString(),
        status:           'clocked_in',
        lateness_minutes: latenessMinutes,
        updated_at:       now.toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (updateErr || !updated) {
      console.error('[timesheets/clock-in] update error:', updateErr?.message)
      return NextResponse.json({ error: 'Failed to record clock-in' }, { status: 500 })
    }
    timesheet = updated as Record<string, unknown>
  } else {
    const { data: inserted, error: insertErr } = await adminClient
      .from('timesheets')
      .insert({
        company_id:       shift.company_id,
        shift_id,
        staff_profile_id,
        scheduled_start:  scheduledStart.toISOString(),
        clock_in:         now.toISOString(),
        status:           'clocked_in',
        lateness_minutes: latenessMinutes,
        break_minutes:    0,
      })
      .select()
      .single()

    if (insertErr || !inserted) {
      console.error('[timesheets/clock-in] insert error:', insertErr?.message)
      return NextResponse.json({ error: 'Failed to record clock-in' }, { status: 500 })
    }
    timesheet = inserted as Record<string, unknown>
  }

  // ── Audit log ──────────────────────────────────────────────────────────────
  try {
    await adminClient.from('audit_logs').insert({
      company_id:  companyId,
      actor_id:    null,
      action:      'timesheet.clocked_in',
      entity_type: 'timesheet',
      entity_id:   timesheet.id,
      metadata:    { shift_id, staff_profile_id, lateness_minutes: latenessMinutes },
    })
  } catch { /* non-critical */ }

  return NextResponse.json(timesheet, { status: 200 })
}
