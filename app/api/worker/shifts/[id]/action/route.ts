import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { validateWorkerToken } from '@/lib/worker/auth'
import { sendNotification } from '@/lib/notifications/sendNotification'
import { createNotification } from '@/lib/notifications/createNotification'

const ALLOWED_ACTIONS = ['accept', 'decline', 'start', 'complete', 'running_late'] as const
type WorkerAction = typeof ALLOWED_ACTIONS[number]

const AUDIT_ACTIONS: Record<WorkerAction, string> = {
  accept:       'shift.accepted_by_worker',
  decline:      'shift.declined_by_worker',
  start:        'shift.started_by_worker',
  complete:     'shift.completed_by_worker',
  running_late: 'shift.running_late_reported',
}

interface ActionBody {
  token?:   string
  action?:  string
  reason?:  string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let body: ActionBody
  try {
    body = await request.json() as ActionBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const token  = body.token
  const result = await validateWorkerToken(token)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  const { id: staffProfileId, company_id: companyId } = result.worker
  const { id: shiftId } = await params

  const action = body.action as WorkerAction
  if (!action || !ALLOWED_ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: `action must be one of: ${ALLOWED_ACTIONS.join(', ')}` },
      { status: 400 }
    )
  }

  // ── Fetch Shift & Offers ──────────────────────────────────────────────────
  const { data: shift, error: fetchErr } = await adminClient
    .from('shifts')
    .select('id, assigned_staff_id, status, title, shift_date, start_time, client_name, worker_ack_status')
    .eq('id', shiftId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (fetchErr || !shift) {
    return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
  }

  const { data: offer } = await adminClient
    .from('shift_offers')
    .select('id, status')
    .eq('shift_id', shiftId)
    .eq('staff_profile_id', staffProfileId)
    .maybeSingle()

  const s = shift as {
    id: string; assigned_staff_id: string | null; status: string;
    title: string; shift_date: string; start_time: string; client_name: string | null; worker_ack_status: string | null;
  }

  // ── Validate Action against State ─────────────────────────────────────────
  if (s.status === 'cancelled' || s.status === 'missed') {
    return NextResponse.json({ error: `Cannot interact with a ${s.status} shift` }, { status: 409 })
  }

  const isAssignedToMe = s.assigned_staff_id === staffProfileId
  const hasPendingOffer = offer && offer.status === 'pending'
  const now = new Date().toISOString()

  let updatePayload: Record<string, any> = { updated_at: now }
  let offerUpdatePayload: Record<string, any> | null = null

  if (action === 'accept') {
    if (s.status !== 'open' && s.status !== 'offered') {
      return NextResponse.json({ error: 'Shift is no longer available' }, { status: 409 })
    }
    if (!isAssignedToMe && !hasPendingOffer) {
      return NextResponse.json({ error: 'Not authorized to accept this shift' }, { status: 403 })
    }

    updatePayload.status = 'accepted'
    updatePayload.assigned_staff_id = staffProfileId
    if (hasPendingOffer) {
      offerUpdatePayload = { status: 'accepted', updated_at: now }
    }
  } 
  else if (action === 'decline') {
    if (s.status !== 'open' && s.status !== 'offered') {
      return NextResponse.json({ error: `Cannot decline a ${s.status} shift` }, { status: 409 })
    }
    if (!isAssignedToMe && !hasPendingOffer) {
      return NextResponse.json({ error: 'Not authorized to decline this shift' }, { status: 403 })
    }

    if (hasPendingOffer) {
      offerUpdatePayload = { status: 'declined', updated_at: now }
      // We don't update shift.status to declined unless I was the ONLY person assigned.
      if (isAssignedToMe) updatePayload.status = 'declined'
    } else if (isAssignedToMe) {
      updatePayload.status = 'declined'
    }
  }
  else if (action === 'start') {
    if (!isAssignedToMe) return NextResponse.json({ error: 'Shift not assigned to you' }, { status: 403 })
    if (s.status !== 'accepted') return NextResponse.json({ error: 'Shift must be accepted before starting' }, { status: 409 })
    updatePayload.status = 'in_progress'
  }
  else if (action === 'complete') {
    if (!isAssignedToMe) return NextResponse.json({ error: 'Shift not assigned to you' }, { status: 403 })
    if (s.status !== 'in_progress') return NextResponse.json({ error: 'Shift must be in progress to complete' }, { status: 409 })
    updatePayload.status = 'completed'
  }
  else if (action === 'running_late') {
    if (!isAssignedToMe) return NextResponse.json({ error: 'Shift not assigned to you' }, { status: 403 })
    updatePayload.worker_ack_status = 'running_late'
    updatePayload.worker_ack_at = now
    updatePayload.worker_ack_reason = body.reason?.trim() || null
  }

  // ── Apply Updates ─────────────────────────────────────────────────────────
  const { data: updated, error: updateErr } = await adminClient
    .from('shifts')
    .update(updatePayload)
    .eq('id', shiftId)
    .select()
    .single()

  if (updateErr) return NextResponse.json({ error: 'Failed to update shift' }, { status: 500 })

  if (offerUpdatePayload) {
    if (offer) {
      await adminClient.from('shift_offers').update(offerUpdatePayload).eq('id', offer.id)
    }
    if (action === 'accept') {
      // Expire other pending offers
      await adminClient.from('shift_offers').update({ status: 'expired' }).eq('shift_id', shiftId).eq('status', 'pending')
    }
  }

  const workerName = [result.worker.first_name, result.worker.last_name].filter(Boolean).join(' ') || 'Worker'
  const adminLink  = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/admin/shifts/operations`

  // ── Audit Logs & Notifications ────────────────────────────────────────────
  void (async () => {
    try {
      await adminClient.from('audit_logs').insert({
        company_id:  companyId,
        actor_id:    staffProfileId,
        action:      AUDIT_ACTIONS[action],
        entity_type: 'shift',
        entity_id:   shiftId,
        metadata: {
          reason:    body.reason ?? null,
          timestamp: now,
        },
      })
    } catch { /* ignore */ }

    // Admin in-app notifications
    if (action === 'accept') {
      void createNotification({
        recipient:  'admin',
        companyId,
        eventType:  'shift_accepted',
        title:      `${workerName} accepted a shift`,
        message:    `${s.title} on ${s.shift_date}`,
        actionUrl:  adminLink,
        entityId:   shiftId,
        actorId:    staffProfileId,
      })
    } else if (action === 'decline') {
      void createNotification({
        recipient:  'admin',
        companyId,
        eventType:  'shift_declined',
        title:      `${workerName} declined a shift`,
        message:    `${s.title} on ${s.shift_date}${body.reason ? ` — ${body.reason.trim()}` : ''}`,
        actionUrl:  adminLink,
        entityId:   shiftId,
        actorId:    staffProfileId,
      })
    } else if (action === 'running_late') {
      void createNotification({
        recipient:  'admin',
        companyId,
        eventType:  'running_late',
        title:      `${workerName} is running late`,
        message:    `${s.title} on ${s.shift_date}${body.reason ? ` — ${body.reason.trim()}` : ''}`,
        actionUrl:  adminLink,
        entityId:   shiftId,
        actorId:    staffProfileId,
      })
    } else if (action === 'complete') {
      void createNotification({
        recipient:  'admin',
        companyId,
        eventType:  'shift_completed',
        title:      `${workerName} completed a shift`,
        message:    `${s.title} on ${s.shift_date}`,
        actionUrl:  adminLink,
        entityId:   shiftId,
        actorId:    staffProfileId,
      })
    }

    // Email notifications (existing behaviour for decline / running_late)
    if (action === 'decline' || action === 'running_late') {
      const type = action === 'decline' ? 'shift.declined' : 'shift.running_late'
      await sendNotification({
        type,
        companyId,
        entityId:         shiftId,
        recipientEmails:  [],
        data: {
          companyName: '',
          workerName,
          shiftTitle:  s.title,
          shiftDate:   s.shift_date,
          startTime:   s.start_time.slice(0, 5),
          clientName:  s.client_name,
          reason:      body.reason?.trim() ?? null,
          adminLink,
        },
      }).catch(() => {})
    }
  })()

  return NextResponse.json(updated)
}
