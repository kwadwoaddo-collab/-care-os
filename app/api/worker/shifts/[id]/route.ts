import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { validateWorkerToken } from '@/lib/worker/auth'

interface ShiftRow {
  id:                  string
  title:               string
  shift_date:          string
  start_time:          string
  end_time:            string
  status:              string
  shift_type:          string | null
  location:            string | null
  client_name:         string | null
  client_id:           string | null
  care_package_id:     string | null
  notes:               string | null
  assigned_staff_id:   string | null
  worker_ack_status:   string | null
  worker_ack_at:       string | null
  worker_ack_reason:   string | null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token  = request.nextUrl.searchParams.get('token')
  const result = await validateWorkerToken(token)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  const { id: staffProfileId } = result.worker
  const { id: shiftId }        = await params

  const { data: shift, error } = await adminClient
    .from('shifts')
    .select('id, title, shift_date, start_time, end_time, status, shift_type, location, client_name, client_id, care_package_id, notes, assigned_staff_id, worker_ack_status, worker_ack_at, worker_ack_reason')
    .eq('id', shiftId)
    .maybeSingle()

  if (error) {
    console.error('[worker/shifts/[id]] fetch error:', error.message)
    return NextResponse.json({ error: 'Failed to fetch shift' }, { status: 500 })
  }

  if (!shift) return NextResponse.json({ error: 'Shift not found' }, { status: 404 })

  const row = shift as ShiftRow

  // Enforce: worker can only view their own assigned shift
  if (row.assigned_staff_id !== staffProfileId) {
    return NextResponse.json({ error: 'Shift not assigned to you' }, { status: 403 })
  }

  // Attach visit note id if exists
  const { data: note } = await adminClient
    .from('visit_notes')
    .select('id, status')
    .eq('shift_id', shiftId)
    .maybeSingle()

  // Attach timesheet clock-in/out
  const { data: ts } = await adminClient
    .from('timesheets')
    .select('id, clock_in, clock_out, worked_minutes, status')
    .eq('shift_id', shiftId)
    .eq('staff_profile_id', staffProfileId)
    .maybeSingle()

  return NextResponse.json({
    ...row,
    visit_note:  note ?? null,
    timesheet:   ts   ?? null,
  })
}
