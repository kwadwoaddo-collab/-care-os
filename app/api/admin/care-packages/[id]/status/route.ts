import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'

// TODO: RESTORE AUTH — remove DEV_BYPASS_AUTH before deploying or merging to main.
const DEV_BYPASS_AUTH = process.env.NODE_ENV === 'development'

const ALLOWED_STATUSES = new Set(['active', 'paused', 'ended', 'draft'])
const RESTRICTIVE      = new Set(['paused', 'ended'])

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!DEV_BYPASS_AUTH) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: packageId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const b                    = (body && typeof body === 'object') ? (body as Record<string, unknown>) : {}
  const status               = typeof b.status === 'string' ? b.status : ''
  const force                = b.force                  === true
  const cancelUnassigned     = b.cancel_unassigned_shifts === true

  if (!ALLOWED_STATUSES.has(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${[...ALLOWED_STATUSES].join(', ')}` },
      { status: 422 }
    )
  }

  // Fetch package for company_id + current status
  const { data: pkg, error: pkgErr } = await adminClient
    .from('care_packages')
    .select('id, company_id, status, title')
    .eq('id', packageId)
    .maybeSingle()

  if (pkgErr) {
    console.error('[care-packages/status] fetch error:', pkgErr.message)
    return NextResponse.json({ error: 'Failed to fetch care package' }, { status: 500 })
  }
  if (!pkg) {
    return NextResponse.json({ error: 'Care package not found' }, { status: 404 })
  }

  const companyId = pkg.company_id as string

  // Warn if changing to paused/ended and there are future unassigned scheduled shifts
  if (RESTRICTIVE.has(status) && !force) {
    const today = new Date().toISOString().slice(0, 10)
    const { data: futureShifts } = await adminClient
      .from('shifts')
      .select('id, shift_date')
      .eq('care_package_id', packageId)
      .gte('shift_date', today)
      .is('assigned_staff_id', null)
      .eq('status', 'scheduled')
      .order('shift_date', { ascending: true })

    if (futureShifts && futureShifts.length > 0) {
      const first = futureShifts[0] as { shift_date: string }
      return NextResponse.json({
        needs_confirmation:       true,
        unassigned_shift_count:   futureShifts.length,
        next_shift_date:          first.shift_date,
      })
    }
  }

  // Update package status
  const { data: updated, error: updateErr } = await adminClient
    .from('care_packages')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', packageId)
    .select()
    .single()

  if (updateErr || !updated) {
    console.error('[care-packages/status] update error:', updateErr?.message)
    return NextResponse.json({ error: 'Failed to update care package status' }, { status: 500 })
  }

  // Optionally cancel future unassigned shifts
  let cancelledCount = 0
  let skippedAssignedCount = 0

  if (cancelUnassigned) {
    const today = new Date().toISOString().slice(0, 10)
    const now   = new Date().toISOString()

    // Count assigned future shifts (skipped)
    const { count } = await adminClient
      .from('shifts')
      .select('id', { count: 'exact', head: true })
      .eq('care_package_id', packageId)
      .gte('shift_date', today)
      .not('assigned_staff_id', 'is', null)
      .in('status', ['scheduled', 'confirmed'])

    skippedAssignedCount = count ?? 0

    // Cancel unassigned scheduled shifts
    const { data: cancelled } = await adminClient
      .from('shifts')
      .update({ status: 'cancelled', updated_at: now })
      .eq('care_package_id', packageId)
      .gte('shift_date', today)
      .is('assigned_staff_id', null)
      .eq('status', 'scheduled')
      .select('id')

    cancelledCount = cancelled?.length ?? 0
  }

  // Audit log (fire-and-forget)
  void adminClient.from('audit_logs').insert({
    company_id:  companyId,
    actor_id:    null,
    action:      'care_package.status_updated',
    entity_type: 'care_package',
    entity_id:   packageId,
    metadata: {
      previous_status:       pkg.status,
      new_status:            status,
      cancelled_shifts:      cancelledCount,
      skipped_assigned:      skippedAssignedCount,
      timestamp:             new Date().toISOString(),
    },
  })

  return NextResponse.json({
    care_package:             updated,
    cancelled_shifts:         cancelledCount,
    skipped_assigned_shifts:  skippedAssignedCount,
  })
}
