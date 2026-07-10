// GET /api/admin/shifts/[id]/safety-check?staff_profile_id=...
//
// Full pre-assignment safety evaluation for a specific staff + shift pair.
// Returns a structured AssignmentSafetyResult with every check, its outcome,
// severity, rule, detail, and recommended action.

import { NextRequest, NextResponse }     from 'next/server'
import { adminClient }                   from '@/lib/supabase/admin'
import { requireAdmin }                  from '@/lib/auth/requireAdmin'
import { calculateCompliance }           from '@/lib/compliance/calculateCompliance'
import type { ComplianceDocument }       from '@/lib/compliance/calculateCompliance'
import { parseAvailabilityRecord }       from '@/lib/staff/types'
import { evaluateAssignmentSafety }      from '@/lib/scheduling/assignmentSafety'
import type { SafetyInput }              from '@/lib/scheduling/assignmentSafety'
import type { ShiftSpan }                from '@/lib/shifts/hasShiftOverlap'
import { getDaysUntilExpiry }            from '@/lib/compliance/expiryBands'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const { id: shiftId } = await params
  const staffId = request.nextUrl.searchParams.get('staff_profile_id')

  if (!staffId) {
    return NextResponse.json({ error: 'staff_profile_id is required' }, { status: 400 })
  }

  // ── Fetch shift ──────────────────────────────────────────────────────────

  const { data: shift, error: shiftErr } = await adminClient
    .from('shifts')
    .select('id, company_id, shift_date, start_time, end_time, shift_type, client_id')
    .eq('id', shiftId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (shiftErr || !shift) {
    return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
  }

  // ── Fetch staff ──────────────────────────────────────────────────────────

  const { data: staff, error: staffErr } = await adminClient
    .from('staff_profiles')
    .select('id, status, job_role, onboarding_completed, applicant_id, first_name, last_name')
    .eq('id', staffId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (staffErr || !staff) {
    return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
  }

  const shiftDate    = shift.shift_date as string
  const baseDateParts = shiftDate.split('-').map(Number) as [number, number, number]
  const baseDay      = new Date(Date.UTC(baseDateParts[0], baseDateParts[1] - 1, baseDateParts[2]))

  // Window for overlap/rest checks: ±2 days
  const windowStart = new Date(baseDay); windowStart.setUTCDate(baseDay.getUTCDate() - 2)
  const windowEnd   = new Date(baseDay); windowEnd.setUTCDate(baseDay.getUTCDate() + 2)

  // Week bounds for hours
  const weekDow   = baseDay.getUTCDay()
  const weekStart = new Date(baseDay); weekStart.setUTCDate(baseDay.getUTCDate() - weekDow)
  const weekEnd   = new Date(weekStart); weekEnd.setUTCDate(weekStart.getUTCDate() + 6)

  // 30-day window for consecutive days + ack history
  const thirtyDaysAgo = new Date(baseDay); thirtyDaysAgo.setUTCDate(baseDay.getUTCDate() - 30)

  const applicantId = staff.applicant_id as string | null

  // ── Batch fetch ──────────────────────────────────────────────────────────

  const [
    staffDocRes, appDocRes,
    availRes,
    _windowShiftsRes,
    weekShiftsRes,
    broadShiftsRes,
    ackHistoryRes,
    overrideRes,
  ] = await Promise.all([
    adminClient
      .from('documents')
      .select('id, document_type, file_name, expiry_date, training_category, reviewed_status, issue_date')
      .eq('staff_profile_id', staffId),

    applicantId
      ? adminClient
          .from('documents')
          .select('id, document_type, file_name, expiry_date, training_category, reviewed_status, issue_date')
          .eq('applicant_id', applicantId)
      : Promise.resolve({ data: [] }),

    adminClient
      .from('staff_availability')
      .select('*')
      .eq('staff_profile_id', staffId)
      .maybeSingle(),

    // ±2 days for overlap + rest period
    adminClient
      .from('shifts')
      .select('shift_date, start_time, end_time')
      .eq('assigned_staff_id', staffId)
      .gte('shift_date', windowStart.toISOString().slice(0, 10))
      .lte('shift_date', windowEnd.toISOString().slice(0, 10))
      .neq('status', 'cancelled')
      .neq('id', shiftId),

    // Weekly shifts for hours calculation
    adminClient
      .from('shifts')
      .select('start_time, end_time')
      .eq('assigned_staff_id', staffId)
      .gte('shift_date', weekStart.toISOString().slice(0, 10))
      .lte('shift_date', weekEnd.toISOString().slice(0, 10))
      .neq('status', 'cancelled')
      .neq('id', shiftId),

    // 30-day window for consecutive days
    adminClient
      .from('shifts')
      .select('shift_date, start_time, end_time')
      .eq('assigned_staff_id', staffId)
      .gte('shift_date', thirtyDaysAgo.toISOString().slice(0, 10))
      .lte('shift_date', windowEnd.toISOString().slice(0, 10))
      .neq('status', 'cancelled')
      .neq('id', shiftId),

    // Ack history
    adminClient
      .from('shifts')
      .select('shift_date, start_time, worker_ack_status, worker_ack_at')
      .eq('assigned_staff_id', staffId)
      .gte('shift_date', thirtyDaysAgo.toISOString().slice(0, 10))
      .lte('shift_date', shiftDate)
      .neq('status', 'cancelled'),

    // Active compliance override
    adminClient
      .from('compliance_overrides')
      .select('id')
      .eq('company_id', companyId)
      .eq('staff_profile_id', staffId)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .limit(1)
      .maybeSingle(),
  ])

  // ── Build compliance data ────────────────────────────────────────────────

  const docs: ComplianceDocument[] = [
    ...(staffDocRes.data ?? []),
    ...(appDocRes.data ?? []),
  ] as unknown as ComplianceDocument[]

  const compliance    = calculateCompliance(docs, (staff as { job_role?: string | null }).job_role ?? null)
  const activeOverride = !!overrideRes.data
  const expiringSoon = docs
    .filter((d) => {
      if (!d.expiry_date) return false
      const days = getDaysUntilExpiry(d.expiry_date)
      return days >= 0 && days <= 30
    })
    .map((d) => ({
      key:            d.training_category ?? d.document_type,
      label:          (d.training_category ?? d.document_type).replace(/_/g, ' '),
      daysUntilExpiry: Math.ceil(getDaysUntilExpiry(d.expiry_date!)),
    }))
    .filter((item, idx, arr) => arr.findIndex((x) => x.key === item.key) === idx)

  // ── Build schedule data ──────────────────────────────────────────────────



  const broadShifts: ShiftSpan[] = (broadShiftsRes.data ?? []).map((s) => ({
    shift_date: s.shift_date as string,
    start_time: s.start_time as string,
    end_time:   s.end_time   as string,
  }))

  let weeklyMins = 0
  for (const s of weekShiftsRes.data ?? []) {
    const [sh = 0, sm = 0] = (s.start_time as string).split(':').map(Number)
    const [eh = 0, em = 0] = (s.end_time   as string).split(':').map(Number)
    const start = sh * 60 + sm, end = eh * 60 + em
    weeklyMins += end > start ? end - start : 1440 - start + end
  }

  const ackHistory = ackHistoryRes.data ?? []
  const lateAckCount = ackHistory.filter((a) => {
    if (a.worker_ack_status) return false
    const ts = new Date(`${a.shift_date as string}T${(a.start_time as string).slice(0, 5)}:00Z`)
    return ts < new Date()
  }).length

  const availability = parseAvailabilityRecord(staffId, availRes.data as Record<string, unknown> ?? null)

  const targetShift: ShiftSpan = {
    shift_date: shift.shift_date as string,
    start_time: shift.start_time as string,
    end_time:   shift.end_time   as string,
  }

  const safetyInput: SafetyInput = {
    staffStatus:              staff.status as string,
    jobRole:                  (staff as { job_role?: string | null }).job_role ?? null,
    onboardingComplete:       (staff as { onboarding_completed?: boolean | null }).onboarding_completed === true,
    targetShift,
    complianceState:          compliance.complianceState,
    compliancePercent:        compliance.percentage,
    expiredDocuments:         compliance.expiredDocuments,
    missingDocuments:         compliance.missingDocuments,
    expiredTraining:          compliance.expiredTraining,
    missingTraining:          compliance.missingTraining,
    expiringSoon,
    activeOverride,
    availability,
    existingShifts:           broadShifts,  // use wide window for fatigue/consecutive days
    scheduledMinutesThisWeek: weeklyMins,
    lateAckCount,
  }

  const result = evaluateAssignmentSafety(safetyInput)

  return NextResponse.json({
    staffId,
    shiftId,
    staffName: [(staff.first_name as string | null), (staff.last_name as string | null)].filter(Boolean).join(' ') || 'Unknown',
    ...result,
  })
}
