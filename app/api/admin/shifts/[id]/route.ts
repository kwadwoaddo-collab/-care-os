import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { createNotification } from '@/lib/notifications/createNotification'

// Statuses as defined by migration 031_operational_shifts.sql
const ALLOWED_STATUSES = ['open', 'offered', 'accepted', 'declined', 'in_progress', 'completed', 'missed', 'cancelled'] as const
const ALLOWED_TYPES    = ['day', 'night', 'sleep_in', 'live_in', 'emergency', null] as const

type ShiftStatus = typeof ALLOWED_STATUSES[number]
type ShiftType   = typeof ALLOWED_TYPES[number]

interface PatchBody {
  status?:           ShiftStatus
  shift_type?:       ShiftType
  title?:            string
  shift_date?:       string
  start_time?:       string
  end_time?:         string
  location?:         string
  client_name?:      string
  client_id?:        string | null
  care_package_id?:  string | null
  notes?:            string
}

// ── PATCH /api/admin/shifts/[id] ──────────────────────────────────────────────

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

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  const allowed: Array<keyof PatchBody> = [
    'status', 'shift_type', 'title', 'shift_date',
    'start_time', 'end_time', 'location', 'client_name', 'client_id', 'care_package_id', 'notes',
  ]
  for (const key of allowed) {
    if (key in body) updates[key] = body[key] ?? null
  }

  const { data: shift, error } = await adminClient
    .from('shifts')
    .update(updates)
    .eq('id', id)
    .eq('company_id', companyId)
    .select()
    .single()

  if (error) {
    console.error('[admin/shifts/[id]] patch error:', error.message)
    return NextResponse.json(
      { error: 'Failed to update shift', supabase_message: error.message },
      { status: 500 }
    )
  }

  // ── Audit log ──────────────────────────────────────────────────────────────
  try {
    await adminClient.from('audit_logs').insert({
      company_id:  companyId,
      actor_id:    null,
      action:      'shift.updated',
      entity_type: 'shift',
      entity_id:   id,
      metadata:    updates,
    })
  } catch { /* non-critical */ }

  // ── In-app notification: shift cancelled ───────────────────────────────────
  if (body.status === 'cancelled' && shift.assigned_staff_id) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    void createNotification({
      recipient:      'worker',
      staffProfileId: shift.assigned_staff_id as string,
      companyId,
      eventType:      'shift_cancelled',
      title:          `Shift cancelled: ${shift.title as string}`,
      message:        `Your shift on ${shift.shift_date as string} has been cancelled.`,
      actionUrl:      `${appUrl}/worker/shifts`,
      entityId:       id,
    })
  }

  return NextResponse.json(shift)
}

// ── DELETE /api/admin/shifts/[id] ─────────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const { id } = await params

  // Fetch shift before deletion for notification purposes
  const { data: shift } = await adminClient
    .from('shifts')
    .select('id, title, shift_date, assigned_staff_id')
    .eq('id', id)
    .eq('company_id', companyId)
    .single()

  if (!shift) {
    return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
  }

  const { error } = await adminClient
    .from('shifts')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId)

  if (error) {
    console.error('[admin/shifts/[id]] delete error:', error.message)
    return NextResponse.json(
      { error: 'Failed to delete shift', supabase_message: error.message },
      { status: 500 }
    )
  }

  // ── Audit log ──────────────────────────────────────────────────────────────
  try {
    await adminClient.from('audit_logs').insert({
      company_id:  companyId,
      actor_id:    null,
      action:      'shift.deleted',
      entity_type: 'shift',
      entity_id:   id,
      metadata:    { title: shift.title, shift_date: shift.shift_date },
    })
  } catch { /* non-critical */ }

  // ── In-app notification: shift deleted (if assigned) ───────────────────────
  if (shift.assigned_staff_id) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    void createNotification({
      recipient:      'worker',
      staffProfileId: shift.assigned_staff_id as string,
      companyId,
      eventType:      'shift_cancelled',
      title:          `Shift removed: ${shift.title as string}`,
      message:        `Your shift on ${shift.shift_date as string} has been removed by an administrator.`,
      actionUrl:      `${appUrl}/worker/shifts`,
      entityId:       id,
    })
  }

  return NextResponse.json({ success: true })
}
