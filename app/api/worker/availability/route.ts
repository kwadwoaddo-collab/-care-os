import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { validateWorkerToken } from '@/lib/worker/auth'
import { parseAvailabilityRecord, type StaffAvailability } from '@/lib/staff/types'

export async function GET(request: NextRequest) {
  const token  = request.nextUrl.searchParams.get('token')
  const result = await validateWorkerToken(token)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  const { id: staffProfileId } = result.worker

  const { data, error } = await adminClient
    .from('staff_availability')
    .select('*')
    .eq('staff_profile_id', staffProfileId)
    .maybeSingle()

  if (error) {
    console.error('[worker/availability] GET error:', error.message)
    return NextResponse.json({ error: 'Failed to fetch availability' }, { status: 500 })
  }

  return NextResponse.json(
    parseAvailabilityRecord(staffProfileId, data as Record<string, unknown> | null)
  )
}

export async function PATCH(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const token  = body.token as string | undefined
  const result = await validateWorkerToken(token)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  const { id: staffProfileId, company_id } = result.worker

  // Strip token from body before using as availability payload
  const { token: _t, ...availPayload } = body
  const typed = availPayload as Partial<StaffAvailability>

  const upsertPayload = {
    staff_profile_id:     staffProfileId,
    monday:               typed.monday               ?? {},
    tuesday:              typed.tuesday              ?? {},
    wednesday:            typed.wednesday            ?? {},
    thursday:             typed.thursday             ?? {},
    friday:               typed.friday               ?? {},
    saturday:             typed.saturday             ?? {},
    sunday:               typed.sunday               ?? {},
    max_weekly_hours:     typed.max_weekly_hours     ?? null,
    preferred_shift_type: typed.preferred_shift_type ?? null,
    can_work_nights:      typed.can_work_nights      ?? false,
    can_work_weekends:    typed.can_work_weekends     ?? false,
    is_driver:            typed.is_driver            ?? false,
    has_own_car:          typed.has_own_car          ?? false,
    work_areas:           typed.work_areas           ?? [],
    unavailable_dates:    typed.unavailable_dates    ?? [],
    notes:                typed.notes                ?? null,
    updated_at:           new Date().toISOString(),
  }

  const { data, error } = await adminClient
    .from('staff_availability')
    .upsert(upsertPayload, { onConflict: 'staff_profile_id' })
    .select()
    .maybeSingle()

  if (error) {
    console.error('[worker/availability] PATCH error:', error.message)
    return NextResponse.json({ error: 'Failed to save availability' }, { status: 500 })
  }

  void adminClient.from('audit_logs').insert({
    company_id,
    actor_id:    null,
    action:      'staff.availability_updated_by_worker',
    entity_type: 'staff_profile',
    entity_id:   staffProfileId,
    metadata:    { timestamp: new Date().toISOString() },
  })

  return NextResponse.json(
    parseAvailabilityRecord(staffProfileId, data as Record<string, unknown> | null)
  )
}
