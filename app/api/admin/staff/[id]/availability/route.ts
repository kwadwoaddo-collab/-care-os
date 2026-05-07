import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { parseAvailabilityRecord, type StaffAvailability } from '@/lib/staff/types'
import { requireAdmin } from '@/lib/auth/requireAdmin'

type RouteParams = { params: Promise<{ id: string }> }

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const { id } = await params

  // Verify staff profile belongs to this company before returning availability
  const { data: spCheck } = await adminClient
    .from('staff_profiles')
    .select('id')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!spCheck) {
    return NextResponse.json({ error: 'Staff profile not found' }, { status: 404 })
  }

  const { data, error } = await adminClient
    .from('staff_availability')
    .select('*')
    .eq('staff_profile_id', id)
    .maybeSingle()

  if (error) {
    console.error('[staff/availability] GET error:', error.message)
    return NextResponse.json(
      { error: 'Failed to fetch availability', supabase_message: error.message },
      { status: 500 }
    )
  }

  const availability = parseAvailabilityRecord(
    id,
    data as Record<string, unknown> | null
  )

  return NextResponse.json(availability)
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const { id } = await params

  let body: Partial<StaffAvailability>
  try {
    body = await request.json() as Partial<StaffAvailability>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Verify ownership and fetch company_id for audit log
  const { data: sp } = await adminClient
    .from('staff_profiles')
    .select('company_id')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!sp) {
    return NextResponse.json({ error: 'Staff profile not found' }, { status: 404 })
  }

  const upsertPayload = {
    staff_profile_id:     id,
    monday:               body.monday               ?? {},
    tuesday:              body.tuesday              ?? {},
    wednesday:            body.wednesday            ?? {},
    thursday:             body.thursday             ?? {},
    friday:               body.friday               ?? {},
    saturday:             body.saturday             ?? {},
    sunday:               body.sunday               ?? {},
    max_weekly_hours:     body.max_weekly_hours     ?? null,
    preferred_shift_type: body.preferred_shift_type ?? null,
    can_work_nights:      body.can_work_nights      ?? false,
    can_work_weekends:    body.can_work_weekends     ?? false,
    is_driver:            body.is_driver            ?? false,
    has_own_car:          body.has_own_car          ?? false,
    work_areas:           body.work_areas           ?? [],
    unavailable_dates:    body.unavailable_dates    ?? [],
    notes:                body.notes                ?? null,
    updated_at:           new Date().toISOString(),
  }

  const { data, error } = await adminClient
    .from('staff_availability')
    .upsert(upsertPayload, { onConflict: 'staff_profile_id' })
    .select()
    .maybeSingle()

  if (error) {
    console.error('[staff/availability] PATCH error:', error.message)
    return NextResponse.json(
      { error: 'Failed to save availability', supabase_message: error.message },
      { status: 500 }
    )
  }

  // Fire-and-forget audit log
  void (async () => {
    try {
      const { error: logErr } = await adminClient.from('audit_logs').insert({
        company_id:  sp?.company_id ?? null,
        actor_id:    null,
        action:      'staff.availability_updated',
        entity_type: 'staff_profile',
        entity_id:   id,
        metadata:    { timestamp: new Date().toISOString() },
      })
      if (logErr) console.error('[staff/availability] audit log failed:', logErr)
    } catch (err) {
      console.error('[staff/availability] audit log unexpected error:', err)
    }
  })()

  const result = parseAvailabilityRecord(id, data as Record<string, unknown> | null)
  return NextResponse.json(result)
}
