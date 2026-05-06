import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'

// TODO: RESTORE AUTH — remove DEV_BYPASS_AUTH before deploying or merging to main.
const DEV_BYPASS_AUTH = process.env.NODE_ENV === 'development'

const ALLOWED_STATUSES = ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'] as const
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
  if (!DEV_BYPASS_AUTH) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
      action:      'shift.updated',
      entity_type: 'shift',
      entity_id:   id,
      actor:       'admin',
      metadata:    updates,
    })
  } catch { /* non-critical */ }

  return NextResponse.json(shift)
}
