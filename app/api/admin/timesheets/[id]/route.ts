import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { calculateWorkedMinutes } from '@/lib/timesheets/calculateWorkedMinutes'
import { requireAdmin } from '@/lib/auth/requireAdmin'

const ALLOWED_STATUSES = ['pending', 'clocked_in', 'completed', 'missed', 'adjusted'] as const
type TimesheetStatus = typeof ALLOWED_STATUSES[number]

interface PatchBody {
  notes?:         string | null
  break_minutes?: number
  status?:        TimesheetStatus
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const { id } = await params

  let body: PatchBody
  try {
    body = await request.json() as PatchBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (body.status && !ALLOWED_STATUSES.includes(body.status)) {
    return NextResponse.json(
      { error: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}` },
      { status: 400 }
    )
  }

  // ── Fetch current timesheet to recalculate worked_minutes if break changes ──
  const { data: current, error: fetchErr } = await adminClient
    .from('timesheets')
    .select('clock_in, clock_out, break_minutes')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (fetchErr || !current) {
    return NextResponse.json({ error: 'Timesheet not found' }, { status: 404 })
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if ('notes' in body)         updates.notes         = body.notes ?? null
  if ('status' in body)        updates.status        = body.status
  if ('break_minutes' in body) updates.break_minutes = body.break_minutes

  // Recalculate worked_minutes if break_minutes changed and both timestamps exist
  const newBreak = ('break_minutes' in body ? body.break_minutes : current.break_minutes) ?? 0
  if ('break_minutes' in body && current.clock_in && current.clock_out) {
    updates.worked_minutes = calculateWorkedMinutes(
      current.clock_in as string,
      current.clock_out as string,
      newBreak
    )
  }

  // Mark as adjusted if not explicitly setting status
  if (!('status' in body)) {
    updates.status = 'adjusted'
  }

  const { data: updated, error: updateErr } = await adminClient
    .from('timesheets')
    .update(updates)
    .eq('id', id)
    .eq('company_id', companyId)
    .select()
    .single()

  if (updateErr || !updated) {
    console.error('[timesheets/[id]] patch error:', updateErr?.message)
    return NextResponse.json({ error: 'Failed to update timesheet' }, { status: 500 })
  }

  // ── Audit log ──────────────────────────────────────────────────────────────
  try {
    await adminClient.from('audit_logs').insert({
      company_id:  companyId,
      actor_id:    null,
      action:      'timesheet.adjusted',
      entity_type: 'timesheet',
      entity_id:   id,
      metadata:    updates,
    })
  } catch { /* non-critical */ }

  return NextResponse.json(updated)
}
