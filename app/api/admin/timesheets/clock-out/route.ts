import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { calculateWorkedMinutes } from '@/lib/timesheets/calculateWorkedMinutes'

// TODO: RESTORE AUTH — remove DEV_BYPASS_AUTH before deploying or merging to main.
const DEV_BYPASS_AUTH = process.env.NODE_ENV === 'development'

interface ClockOutBody {
  shift_id:         string
  staff_profile_id: string
}

export async function POST(request: NextRequest) {
  if (!DEV_BYPASS_AUTH) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: ClockOutBody
  try {
    body = await request.json() as ClockOutBody
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

  // ── Find the timesheet ─────────────────────────────────────────────────────
  const { data: timesheet, error: fetchErr } = await adminClient
    .from('timesheets')
    .select('id, clock_in, break_minutes, status')
    .eq('shift_id', shift_id)
    .eq('staff_profile_id', staff_profile_id)
    .maybeSingle()

  if (fetchErr || !timesheet) {
    return NextResponse.json(
      { error: 'No timesheet found for this shift and staff. Clock in first.' },
      { status: 404 }
    )
  }

  if (timesheet.status === 'completed') {
    return NextResponse.json(
      { error: 'This shift has already been clocked out.' },
      { status: 409 }
    )
  }

  const now = new Date()

  const workedMinutes = timesheet.clock_in
    ? calculateWorkedMinutes(timesheet.clock_in as string, now, (timesheet.break_minutes as number) ?? 0)
    : 0

  const { data: updated, error: updateErr } = await adminClient
    .from('timesheets')
    .update({
      clock_out:      now.toISOString(),
      worked_minutes: workedMinutes,
      status:         'completed',
      updated_at:     now.toISOString(),
    })
    .eq('id', timesheet.id)
    .select()
    .single()

  if (updateErr || !updated) {
    console.error('[timesheets/clock-out] update error:', updateErr?.message)
    return NextResponse.json({ error: 'Failed to record clock-out' }, { status: 500 })
  }

  // ── Audit log ──────────────────────────────────────────────────────────────
  try {
    await adminClient.from('audit_logs').insert({
      action:      'timesheet.clocked_out',
      entity_type: 'timesheet',
      entity_id:   timesheet.id,
      actor:       'admin',
      metadata:    { shift_id, staff_profile_id, worked_minutes: workedMinutes },
    })
  } catch { /* non-critical */ }

  return NextResponse.json(updated)
}
