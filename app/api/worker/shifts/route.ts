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

  const { data: shifts, error } = await adminClient
    .from('shifts')
    .select('id, title, shift_date, start_time, end_time, status, location, client_name, shift_type')
    .eq('assigned_staff_id', staffProfileId)
    .order('shift_date', { ascending: false })
    .order('start_time', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[worker/shifts] fetch error:', error.message)
    return NextResponse.json({ error: 'Failed to fetch shifts' }, { status: 500 })
  }

  const rows = shifts ?? []

  // Attach visit note id if one exists for each shift
  let visitNoteByShift: Record<string, string> = {}
  if (rows.length > 0) {
    const shiftIds = rows.map((s) => s.id)
    const { data: notes } = await adminClient
      .from('visit_notes')
      .select('id, shift_id')
      .in('shift_id', shiftIds)
    for (const n of notes ?? []) {
      const r = n as { id: string; shift_id: string }
      visitNoteByShift[r.shift_id] = r.id
    }
  }

  const result2 = rows.map((s) => ({
    ...s,
    visit_note_id: visitNoteByShift[s.id] ?? null,
  }))

  return NextResponse.json(result2)
}
