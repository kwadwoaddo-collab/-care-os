import { NextRequest, NextResponse } from 'next/server'
import { adminClient }               from '@/lib/supabase/admin'
import {
  calculateCompliance,
  type ComplianceDocument,
} from '@/lib/compliance/calculateCompliance'
import { parseAvailabilityRecord } from '@/lib/staff/types'
import { calculateReadiness }      from '@/lib/staff/calculateReadiness'
import { hasShiftOverlap }         from '@/lib/shifts/hasShiftOverlap'
import { requireAdmin } from '@/lib/auth/requireAdmin'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

// ── PATCH /api/admin/shifts/[id]/assign ───────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const { id: shiftId } = await params

  let body: { staff_profile_id?: unknown }
  try {
    body = await request.json() as { staff_profile_id?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const staffProfileId = body.staff_profile_id
  if (typeof staffProfileId !== 'string' || !staffProfileId) {
    return NextResponse.json({ error: 'staff_profile_id is required' }, { status: 400 })
  }

  // ── Fetch the target shift ─────────────────────────────────────────────────
  const { data: shift, error: shiftErr } = await adminClient
    .from('shifts')
    .select('id, company_id, shift_date, start_time, end_time, shift_type, client_id, status, assigned_staff_id')
    .eq('id', shiftId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (shiftErr || !shift) {
    return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
  }

  const shiftStatus = shift.status as string
  if (shiftStatus === 'completed' || shiftStatus === 'cancelled') {
    return NextResponse.json(
      { error: `Cannot assign a ${shiftStatus} shift` },
      { status: 422 }
    )
  }

  // ── Fetch and validate staff ───────────────────────────────────────────────
  const { data: staffData, error: staffErr } = await adminClient
    .from('staff_profiles')
    .select('id, company_id, status, applicant_id')
    .eq('id', staffProfileId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (staffErr || !staffData) {
    return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })
  }

  if (staffData.status !== 'active') {
    return NextResponse.json(
      { error: 'Staff must be active to be assigned a shift' },
      { status: 422 }
    )
  }

  // ── Compliance check ───────────────────────────────────────────────────────
  let docs: ComplianceDocument[] = []
  if (staffData.applicant_id) {
    const { data: applicantDocs } = await adminClient
      .from('documents')
      .select('id, document_type, file_name, expiry_date')
      .eq('applicant_id', staffData.applicant_id)
    if (applicantDocs) docs = applicantDocs as ComplianceDocument[]
  }
  const { data: staffDocs } = await adminClient
    .from('documents')
    .select('id, document_type, file_name, expiry_date')
    .eq('staff_profile_id', staffProfileId)
  if (staffDocs) docs.push(...(staffDocs as ComplianceDocument[]))

  const compliance = calculateCompliance(docs)

  // ── Availability + readiness check ─────────────────────────────────────────
  const { data: availRaw } = await adminClient
    .from('staff_availability')
    .select('*')
    .eq('staff_profile_id', staffProfileId)
    .maybeSingle()

  const availability = availRaw
    ? parseAvailabilityRecord(staffProfileId, availRaw as Record<string, unknown>)
    : null

  const readiness = calculateReadiness(staffData.status as string, compliance.compliant, availability)

  if (!readiness.ready) {
    return NextResponse.json(
      {
        error:    'Staff is not ready to be assigned — resolve compliance or availability issues first',
        blockers: readiness.blockers,
        warnings: readiness.warnings,
      },
      { status: 422 }
    )
  }

  // ── Overlap check ──────────────────────────────────────────────────────────
  const shiftDate = shift.shift_date as string
  const dateParts = shiftDate.split('-').map(Number) as [number, number, number]
  const baseDay   = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]))
  const dayBefore = new Date(baseDay); dayBefore.setUTCDate(baseDay.getUTCDate() - 1)
  const dayAfter  = new Date(baseDay); dayAfter.setUTCDate(baseDay.getUTCDate() + 1)

  const { data: nearbyShifts } = await adminClient
    .from('shifts')
    .select('id, shift_date, start_time, end_time')
    .eq('assigned_staff_id', staffProfileId)
    .gte('shift_date', dayBefore.toISOString().slice(0, 10))
    .lte('shift_date', dayAfter.toISOString().slice(0, 10))
    .neq('status', 'cancelled')
    .neq('id', shiftId)

  const targetSpan = {
    shift_date: shift.shift_date as string,
    start_time: shift.start_time as string,
    end_time:   shift.end_time   as string,
  }

  const existingSpans = (nearbyShifts ?? []).map((s) => ({
    shift_date: s.shift_date as string,
    start_time: s.start_time as string,
    end_time:   s.end_time   as string,
  }))

  if (hasShiftOverlap(targetSpan, existingSpans)) {
    return NextResponse.json(
      { error: 'This staff member already has an overlapping shift at that time' },
      { status: 422 }
    )
  }

  // ── Assign the shift ───────────────────────────────────────────────────────
  const { data: updated, error: updateErr } = await adminClient
    .from('shifts')
    .update({
      assigned_staff_id: staffProfileId,
      status:            'confirmed',
      updated_at:        new Date().toISOString(),
    })
    .eq('id', shiftId)
    .eq('company_id', companyId)
    .select()
    .single()

  if (updateErr) {
    console.error('[assign] update error:', updateErr.message)
    return NextResponse.json(
      { error: 'Failed to assign shift', supabase_message: updateErr.message },
      { status: 500 }
    )
  }

  // ── Audit log ──────────────────────────────────────────────────────────────
  try {
    await adminClient.from('audit_logs').insert({
      company_id:  companyId,
      actor_id:    null,
      action:      'shift.assigned',
      entity_type: 'shift',
      entity_id:   shiftId,
      metadata:    {
        staff_profile_id: staffProfileId,
        shift_date:       shift.shift_date,
        previous_staff:   shift.assigned_staff_id,
      },
    })
  } catch { /* non-critical */ }

  // ── Compliance expiry warning (7-day window) ───────────────────────────────
  const now = Date.now()
  const expiringSoon = docs
    .filter((d) => {
      if (!d.expiry_date) return false
      const exp = new Date(d.expiry_date).getTime()
      return exp > now && exp - now <= SEVEN_DAYS_MS
    })
    .map((d) => d.document_type)
    .filter((v, i, arr) => arr.indexOf(v) === i)

  if (expiringSoon.length > 0) {
    return NextResponse.json({
      ...updated,
      compliance_warning: {
        message:      'One or more compliance documents expire within 7 days',
        expiringSoon,
      },
    })
  }

  return NextResponse.json(updated)
}
