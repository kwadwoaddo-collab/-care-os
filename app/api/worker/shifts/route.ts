import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { validateWorkerToken } from '@/lib/worker/auth'

export async function GET(request: NextRequest) {
  const token  = request.nextUrl.searchParams.get('token')
  const result = await validateWorkerToken(token)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  const { id: staffProfileId } = result.worker

  // 1. Fetch Assigned Shifts
  const { data: shifts, error } = await adminClient
    .from('shifts')
    .select('id, title, shift_date, start_time, end_time, status, location, client_name, shift_type, worker_ack_status')
    .eq('assigned_staff_id', staffProfileId)
    .neq('status', 'cancelled')
    .order('shift_date', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(60)

  if (error) {
    console.error('[worker/shifts] fetch error:', error.message)
    return NextResponse.json({ error: 'Failed to fetch shifts' }, { status: 500 })
  }

  // 2. Fetch Shift Offers
  const { data: offers, error: offersErr } = await adminClient
    .from('shift_offers')
    .select(`
      status,
      shifts!inner ( id, title, shift_date, start_time, end_time, status, location, client_name, shift_type, worker_ack_status )
    `)
    .eq('staff_profile_id', staffProfileId)
    .eq('status', 'pending')
    .eq('shifts.status', 'offered') // Only show offers for shifts that are still offered

  if (offersErr) {
    console.error('[worker/shifts] offers fetch error:', offersErr.message)
  }

  const assignedRows = shifts ?? []
  const offeredRows = (offers ?? []).map(o => ({
    ...(Array.isArray(o.shifts) ? o.shifts[0] : o.shifts),
    is_offer: true,
    offer_status: o.status
  }))

  const allRows = [...assignedRows, ...offeredRows]

  // Attach visit note id if one exists for each shift
  const visitNoteByShift: Record<string, string> = {}
  if (allRows.length > 0) {
    const shiftIds = allRows.map((s) => s.id)
    const { data: notes } = await adminClient
      .from('visit_notes')
      .select('id, shift_id')
      .in('shift_id', shiftIds)
    for (const n of notes ?? []) {
      const r = n as { id: string; shift_id: string }
      visitNoteByShift[r.shift_id] = r.id
    }
  }

  const result2 = allRows.map((s) => ({
    ...s,
    visit_note_id: visitNoteByShift[s.id] ?? null,
  })).sort((a, b) => {
    // Sort by date and time
    if (a.shift_date !== b.shift_date) return a.shift_date.localeCompare(b.shift_date)
    return a.start_time.localeCompare(b.start_time)
  })

  return NextResponse.json(result2)
}
