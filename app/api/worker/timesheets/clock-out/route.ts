import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { validateWorkerToken } from '@/lib/worker/auth'
import { calculateWorkedMinutes } from '@/lib/timesheets/calculateWorkedMinutes'

interface ClockOutBody {
  token?:    string
  shift_id?: string
}

export async function POST(request: NextRequest) {
  let body: ClockOutBody
  try {
    body = await request.json() as ClockOutBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const result = await validateWorkerToken(body.token)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  const { id: staffProfileId, company_id: companyId } = result.worker

  const shiftId = body.shift_id
  if (!shiftId || typeof shiftId !== 'string') {
    return NextResponse.json({ error: 'shift_id is required' }, { status: 400 })
  }

  // Find existing timesheet
  const { data: ts, error: fetchErr } = await adminClient
    .from('timesheets')
    .select('id, clock_in, clock_out, break_minutes, status')
    .eq('shift_id', shiftId)
    .eq('staff_profile_id', staffProfileId)
    .maybeSingle()

  if (fetchErr) {
    console.error('[worker/timesheets/clock-out] fetch error:', fetchErr.message)
    return NextResponse.json({ error: 'Failed to fetch timesheet' }, { status: 500 })
  }

  if (!ts) {
    return NextResponse.json({ error: 'You have not clocked in to this shift yet' }, { status: 409 })
  }

  const timesheet = ts as { id: string; clock_in: string; clock_out: string | null; break_minutes: number; status: string }

  if (timesheet.clock_out) {
    return NextResponse.json(
      { error: 'You have already clocked out of this shift', timesheet },
      { status: 409 }
    )
  }

  const now           = new Date()
  const workedMinutes = calculateWorkedMinutes(timesheet.clock_in, now, timesheet.break_minutes ?? 0)

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

  if (updateErr) {
    console.error('[worker/timesheets/clock-out] update error:', updateErr.message)
    return NextResponse.json({ error: 'Failed to clock out', supabase_message: updateErr.message }, { status: 500 })
  }

  void (async () => {
    try {
      await adminClient.from('audit_logs').insert({
        company_id:  companyId,
        actor_id:    staffProfileId,
        action:      'timesheet.clock_out_by_worker',
        entity_type: 'timesheet',
        entity_id:   timesheet.id,
        metadata:    { shift_id: shiftId, clock_out: now.toISOString(), worked_minutes: workedMinutes },
      })
    } catch (err) {
      console.error('[worker/timesheets/clock-out] audit log error:', err)
    }
  })()

  return NextResponse.json(updated)
}
