import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { validateWorkerToken } from '@/lib/worker/auth'

const ALLOWED_ACTIONS = ['accepted', 'declined', 'running_late'] as const
type AckAction = typeof ALLOWED_ACTIONS[number]

const AUDIT_ACTIONS: Record<AckAction, string> = {
  accepted:     'shift.accepted_by_worker',
  declined:     'shift.declined_by_worker',
  running_late: 'shift.running_late_reported',
}

interface AckBody {
  token?:   string
  action?:  string
  reason?:  string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let body: AckBody
  try {
    body = await request.json() as AckBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const token  = body.token
  const result = await validateWorkerToken(token)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  const { id: staffProfileId, company_id: companyId } = result.worker
  const { id: shiftId } = await params

  // Validate action
  const action = body.action
  if (!action || !ALLOWED_ACTIONS.includes(action as AckAction)) {
    return NextResponse.json(
      { error: `action must be one of: ${ALLOWED_ACTIONS.join(', ')}` },
      { status: 400 }
    )
  }

  // Fetch shift and enforce ownership
  const { data: shift, error: fetchErr } = await adminClient
    .from('shifts')
    .select('id, assigned_staff_id, status')
    .eq('id', shiftId)
    .maybeSingle()

  if (fetchErr) {
    console.error('[worker/shifts/[id]/acknowledge] fetch error:', fetchErr.message)
    return NextResponse.json({ error: 'Failed to fetch shift' }, { status: 500 })
  }

  if (!shift) return NextResponse.json({ error: 'Shift not found' }, { status: 404 })

  const s = shift as { id: string; assigned_staff_id: string | null; status: string }

  if (s.assigned_staff_id !== staffProfileId) {
    return NextResponse.json({ error: 'Shift not assigned to you' }, { status: 403 })
  }

  if (s.status === 'cancelled') {
    return NextResponse.json({ error: 'Cannot acknowledge a cancelled shift' }, { status: 409 })
  }

  const now = new Date().toISOString()

  // Update shift
  const { data: updated, error: updateErr } = await adminClient
    .from('shifts')
    .update({
      worker_ack_status: action as AckAction,
      worker_ack_at:     now,
      worker_ack_reason: body.reason?.trim() || null,
      updated_at:        now,
    })
    .eq('id', shiftId)
    .select('id, worker_ack_status, worker_ack_at, worker_ack_reason')
    .single()

  if (updateErr) {
    console.error('[worker/shifts/[id]/acknowledge] update error:', updateErr.message)
    return NextResponse.json({ error: 'Failed to update shift' }, { status: 500 })
  }

  // Audit log (fire-and-forget)
  void (async () => {
    try {
      await adminClient.from('audit_logs').insert({
        company_id:  companyId,
        actor_id:    staffProfileId,
        action:      AUDIT_ACTIONS[action as AckAction],
        entity_type: 'shift',
        entity_id:   shiftId,
        metadata: {
          ack_action: action,
          reason:     body.reason ?? null,
          timestamp:  now,
        },
      })
    } catch (err) {
      console.error('[worker/shifts/[id]/acknowledge] audit log error:', err)
    }
  })()

  return NextResponse.json(updated)
}
