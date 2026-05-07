import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { validateWorkerToken } from '@/lib/worker/auth'

interface ClockInBody {
  token?:    string
  shift_id?: string
}

export async function POST(request: NextRequest) {
  let body: ClockInBody
  try {
    body = await request.json() as ClockInBody
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

  // Enforce shift ownership
  const { data: shift, error: shiftErr } = await adminClient
    .from('shifts')
    .select('id, assigned_staff_id, status, shift_date, start_time')
    .eq('id', shiftId)
    .maybeSingle()

  if (shiftErr || !shift) return NextResponse.json({ error: 'Shift not found' }, { status: 404 })

  const s = shift as {
    id: string
    assigned_staff_id: string | null
    status: string
    shift_date: string
    start_time: string
  }

  if (s.assigned_staff_id !== staffProfileId) {
    return NextResponse.json({ error: 'Shift not assigned to you' }, { status: 403 })
  }

  if (s.status === 'cancelled') {
    return NextResponse.json({ error: 'Cannot clock in to a cancelled shift' }, { status: 409 })
  }

  // Prevent double clock-in
  const { data: existing } = await adminClient
    .from('timesheets')
    .select('id, clock_in, clock_out')
    .eq('shift_id', shiftId)
    .eq('staff_profile_id', staffProfileId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'You have already clocked in to this shift', timesheet: existing },
      { status: 409 }
    )
  }

  const now             = new Date().toISOString()
  const scheduledStart  = new Date(`${s.shift_date}T${s.start_time}Z`)
  const latenessMinutes = Math.max(0, Math.floor((Date.now() - scheduledStart.getTime()) / 60_000))

  const { data: ts, error: insertErr } = await adminClient
    .from('timesheets')
    .insert({
      company_id:        companyId,
      staff_profile_id:  staffProfileId,
      shift_id:          shiftId,
      scheduled_start:   scheduledStart.toISOString(),
      clock_in:          now,
      status:            'clocked_in',
      break_minutes:     0,
      lateness_minutes:  latenessMinutes,
    })
    .select()
    .single()

  if (insertErr) {
    console.error('[worker/timesheets/clock-in] insert error:', insertErr.message)
    return NextResponse.json({ error: 'Failed to clock in', supabase_message: insertErr.message }, { status: 500 })
  }

  void (async () => {
    try {
      await adminClient.from('audit_logs').insert({
        company_id:  companyId,
        actor_id:    staffProfileId,
        action:      'timesheet.clock_in_by_worker',
        entity_type: 'timesheet',
        entity_id:   (ts as { id: string }).id,
        metadata:    { shift_id: shiftId, clock_in: now, lateness_minutes: latenessMinutes },
      })
    } catch (err) {
      console.error('[worker/timesheets/clock-in] audit log error:', err)
    }
  })()

  return NextResponse.json(ts, { status: 201 })
}
