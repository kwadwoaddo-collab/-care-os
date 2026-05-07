import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { calculateCompliance } from '@/lib/compliance/calculateCompliance'
import { getStaffDocuments } from '@/lib/staff/getStaffDocuments'

// TODO: RESTORE AUTH — remove DEV_BYPASS_AUTH before deploying or merging to main.
const DEV_BYPASS_AUTH = process.env.NODE_ENV === 'development'

const ALLOWED_STATUSES = new Set(['pre_employment', 'active', 'suspended', 'inactive', 'terminated'])

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!DEV_BYPASS_AUTH) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: staffProfileId } = await params

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const b = (body && typeof body === 'object') ? (body as Record<string, unknown>) : {}

  const status         = b.status
  const force          = b.force           === true
  const unassignShifts = b.unassign_shifts === true

  if (typeof status !== 'string' || !ALLOWED_STATUSES.has(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${[...ALLOWED_STATUSES].join(', ')}` },
      { status: 422 }
    )
  }

  // ── Fetch staff profile ─────────────────────────────────────────────────────
  const { data: staffProfile, error: spError } = await adminClient
    .from('staff_profiles')
    .select('id, company_id, applicant_id, status')
    .eq('id', staffProfileId)
    .maybeSingle()

  if (spError) {
    console.error('[staff/status] fetch error:', spError.message)
    return NextResponse.json({ error: 'Failed to fetch staff profile' }, { status: 500 })
  }
  if (!staffProfile) {
    return NextResponse.json({ error: 'Staff profile not found' }, { status: 404 })
  }

  const companyId = staffProfile.company_id as string

  // ── Future shift warning for restrictive status changes ─────────────────────
  const RESTRICTIVE = new Set(['suspended', 'inactive', 'terminated'])
  if (RESTRICTIVE.has(status) && !force) {
    const today = new Date().toISOString().slice(0, 10)
    const { data: futureShifts } = await adminClient
      .from('shifts')
      .select('id, shift_date')
      .eq('assigned_staff_id', staffProfileId)
      .gte('shift_date', today)
      .in('status', ['scheduled', 'confirmed'])
      .order('shift_date', { ascending: true })

    if (futureShifts && futureShifts.length > 0) {
      const first = futureShifts[0] as { shift_date: string }
      return NextResponse.json({
        needs_confirmation:  true,
        future_shift_count:  futureShifts.length,
        next_shift_date:     first.shift_date,
      })
    }
  }

  // ── Compliance gate for "active" ────────────────────────────────────────────
  if (status === 'active') {
    const documents = await getStaffDocuments(staffProfileId, staffProfile.applicant_id as string | null)
    const compliance = calculateCompliance(documents)

    if (!compliance.compliant) {
      // Audit log — activation blocked (fire-and-forget)
      void (async () => {
        try {
          await adminClient.from('audit_logs').insert({
            company_id:  companyId,
            actor_id:    null,
            action:      'staff.activation_blocked',
            entity_type: 'staff_profile',
            entity_id:   staffProfileId,
            metadata: {
              missing_documents: compliance.missingDocuments,
              expired_documents: compliance.expiredDocuments,
              missing_training:  compliance.missingTraining,
              timestamp:         new Date().toISOString(),
            },
          })
        } catch (err) {
          console.error('[staff/status] activation_blocked audit log error:', err)
        }
      })()

      return NextResponse.json(
        {
          error: 'Staff cannot be activated until mandatory compliance is complete.',
          compliance: {
            percentage:        compliance.percentage,
            missingDocuments:  compliance.missingDocuments,
            expiredDocuments:  compliance.expiredDocuments,
            missingTraining:   compliance.missingTraining,
          },
        },
        { status: 422 }
      )
    }
  }

  // ── Update status ───────────────────────────────────────────────────────────
  const { data: updated, error: updateError } = await adminClient
    .from('staff_profiles')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', staffProfileId)
    .select('id, status, updated_at')
    .single()

  if (updateError || !updated) {
    console.error('[staff/status] update error:', updateError?.message)
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
  }

  // ── Optionally unassign future shifts ──────────────────────────────────────
  let unassignedCount = 0
  if (unassignShifts) {
    const today = new Date().toISOString().slice(0, 10)
    const now   = new Date().toISOString()

    // Revert confirmed → scheduled and clear assignment
    await adminClient
      .from('shifts')
      .update({ assigned_staff_id: null, status: 'scheduled', updated_at: now })
      .eq('assigned_staff_id', staffProfileId)
      .gte('shift_date', today)
      .eq('status', 'confirmed')

    // Clear scheduled shifts
    const { data: clearedScheduled } = await adminClient
      .from('shifts')
      .update({ assigned_staff_id: null, updated_at: now })
      .eq('assigned_staff_id', staffProfileId)
      .gte('shift_date', today)
      .eq('status', 'scheduled')
      .select('id')

    unassignedCount = clearedScheduled?.length ?? 0

    void adminClient.from('audit_logs').insert({
      company_id:  companyId,
      actor_id:    null,
      action:      'staff.future_shifts_unassigned_due_to_status_change',
      entity_type: 'staff_profile',
      entity_id:   staffProfileId,
      metadata: {
        new_status:       status,
        unassigned_count: unassignedCount,
        timestamp:        new Date().toISOString(),
      },
    })
  }

  // ── Audit log — status updated (fire-and-forget) ────────────────────────────
  void (async () => {
    try {
      const { error } = await adminClient.from('audit_logs').insert({
        company_id:  companyId,
        actor_id:    null,
        action:      'staff.status_updated',
        entity_type: 'staff_profile',
        entity_id:   staffProfileId,
        metadata: {
          previous_status:  staffProfile.status,
          new_status:       status,
          unassigned_count: unassignedCount,
          timestamp:        new Date().toISOString(),
        },
      })
      if (error) console.error('[staff/status] audit log failed:', error)
    } catch (err) {
      console.error('[staff/status] audit log unexpected error:', err)
    }
  })()

  return NextResponse.json({ staff_profile: updated, unassigned_shifts: unassignedCount })
}
