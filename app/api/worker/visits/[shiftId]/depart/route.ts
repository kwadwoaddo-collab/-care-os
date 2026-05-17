import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { validateWorkerToken } from '@/lib/worker/auth'
import { calculateWorkedMinutes } from '@/lib/timesheets/calculateWorkedMinutes'

// POST — worker confirms departure from a visit
export async function POST(req: NextRequest, { params }: { params: Promise<{ shiftId: string }> }) {
  const body = await req.json().catch(() => ({})) as { token?: string; notes?: string }
  const result = await validateWorkerToken(body.token)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  const { id: staffProfileId, company_id: companyId } = result.worker
  const { shiftId } = await params
  const now = new Date().toISOString()

  // Update visit note with departed_at + duration
  const { data: note } = await adminClient
    .from('visit_notes')
    .select('id, arrived_at, departed_at')
    .eq('shift_id', shiftId)
    .eq('company_id', companyId)
    .maybeSingle()

  let durationMin: number | null = null
  if (note) {
    if (note.arrived_at) {
      durationMin = Math.round((new Date(now).getTime() - new Date(note.arrived_at as string).getTime()) / 60_000)
    }
    if (!note.departed_at) {
      await adminClient.from('visit_notes').update({
        departed_at:              now,
        visit_duration_minutes:   durationMin,
        updated_at:               now,
      }).eq('id', note.id)
    }
  }

  // Clock out timesheet
  const { data: ts } = await adminClient.from('timesheets').select('id, clock_in, break_minutes').eq('shift_id', shiftId).eq('staff_profile_id', staffProfileId).maybeSingle()
  if (ts && !(ts as Record<string, unknown>).clock_out) {
    const workedMin = calculateWorkedMinutes((ts as {clock_in: string}).clock_in, new Date(), (ts as {break_minutes: number}).break_minutes ?? 0)
    await adminClient.from('timesheets').update({ clock_out: now, worked_minutes: workedMin, status: 'completed', updated_at: now }).eq('id', (ts as {id: string}).id)
  }

  // Complete the shift
  await adminClient.from('shifts').update({ status: 'completed', updated_at: now }).eq('id', shiftId).eq('company_id', companyId)

  void (async () => {
    try {
      await adminClient.from('audit_logs').insert({
        company_id: companyId, actor_id: staffProfileId, action: 'visit.departed',
        entity_type: 'shift', entity_id: shiftId,
        metadata: { departed_at: now, duration_minutes: durationMin },
      })
    } catch { /* non-blocking */ }
  })()

  return NextResponse.json({ ok: true, departed_at: now, duration_minutes: durationMin })
}
