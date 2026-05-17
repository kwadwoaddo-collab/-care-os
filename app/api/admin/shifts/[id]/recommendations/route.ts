import { NextRequest, NextResponse } from 'next/server'
import { adminClient }               from '@/lib/supabase/admin'
import {
  calculateCompliance,
  type ComplianceDocument,
} from '@/lib/compliance/calculateCompliance'
import { parseAvailabilityRecord }   from '@/lib/staff/types'
import { calculateReadiness }        from '@/lib/staff/calculateReadiness'
import { requireAdmin }              from '@/lib/auth/requireAdmin'
import {
  calculateAssignmentScore,
  type ExistingShiftInput,
} from '@/lib/shifts/calculateAssignmentScore'
import { evaluateAssignmentSafety }  from '@/lib/scheduling/assignmentSafety'
import type { SafetyInput, AssignmentOutcome } from '@/lib/scheduling/assignmentSafety'
import type { ShiftSpan }            from '@/lib/shifts/hasShiftOverlap'
import { getDaysUntilExpiry }        from '@/lib/compliance/expiryBands'

// ── GET /api/admin/shifts/[id]/recommendations ────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const { id: shiftId } = await params

  // ── Fetch target shift ─────────────────────────────────────────────────────
  const { data: shift, error: shiftErr } = await adminClient
    .from('shifts')
    .select('id, company_id, shift_date, start_time, end_time, shift_type, client_id')
    .eq('id', shiftId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (shiftErr || !shift) {
    return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
  }

  // ── Fetch all active staff in company ─────────────────────────────────────
  const { data: staffList, error: staffErr } = await adminClient
    .from('staff_profiles')
    .select('id, first_name, last_name, email, status, applicant_id, company_id, job_role, onboarding_completed')
    .eq('company_id', companyId)
    .not('status', 'in', '("terminated","inactive")')

  if (staffErr) {
    return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 })
  }

  const staff = staffList ?? []
  if (staff.length === 0) return NextResponse.json([])

  const staffIds      = staff.map((s) => s.id as string)
  const applicantIds  = staff.map((s) => s.applicant_id as string | null).filter((id): id is string => Boolean(id))

  const shiftDate  = shift.shift_date as string
  const dateParts  = shiftDate.split('-').map(Number) as [number, number, number]
  const baseDay    = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]))
  const dayBefore  = new Date(baseDay); dayBefore.setUTCDate(baseDay.getUTCDate() - 1)
  const dayAfter   = new Date(baseDay); dayAfter.setUTCDate(baseDay.getUTCDate() + 1)

  // Week bounds for hours risk
  const weekDow    = baseDay.getUTCDay()
  const weekStart  = new Date(baseDay); weekStart.setUTCDate(baseDay.getUTCDate() - weekDow)
  const weekEnd    = new Date(weekStart); weekEnd.setUTCDate(weekStart.getUTCDate() + 6)

  // Ack history window
  const agoStr = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)

  // ── Batch fetch ────────────────────────────────────────────────────────────
  const [availRes, applicantDocRes, staffDocRes, nearbyShiftsRes, weekShiftsRes, ackRes, clientHistoryRes, overrideRes] =
    await Promise.all([
      adminClient.from('staff_availability').select('*').in('staff_profile_id', staffIds),

      applicantIds.length > 0
        ? adminClient
            .from('documents')
            .select('id, document_type, file_name, expiry_date, training_category, reviewed_status, issue_date, applicant_id')
            .in('applicant_id', applicantIds)
        : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),

      adminClient
        .from('documents')
        .select('id, document_type, file_name, expiry_date, training_category, reviewed_status, issue_date, staff_profile_id')
        .in('staff_profile_id', staffIds),

      // ±1 day for overlap check
      adminClient
        .from('shifts')
        .select('id, assigned_staff_id, shift_date, start_time, end_time')
        .in('assigned_staff_id', staffIds)
        .gte('shift_date', dayBefore.toISOString().slice(0, 10))
        .lte('shift_date', dayAfter.toISOString().slice(0, 10))
        .neq('status', 'cancelled')
        .neq('id', shiftId),

      // Weekly hours
      adminClient
        .from('shifts')
        .select('assigned_staff_id, start_time, end_time')
        .in('assigned_staff_id', staffIds)
        .gte('shift_date', weekStart.toISOString().slice(0, 10))
        .lte('shift_date', weekEnd.toISOString().slice(0, 10))
        .neq('status', 'cancelled')
        .neq('id', shiftId),

      // Ack history
      adminClient
        .from('shifts')
        .select('assigned_staff_id, shift_date, start_time, worker_ack_status, worker_ack_at')
        .in('assigned_staff_id', staffIds)
        .gte('shift_date', agoStr)
        .lte('shift_date', shiftDate)
        .neq('status', 'cancelled'),

      shift.client_id
        ? adminClient
            .from('shifts')
            .select('assigned_staff_id')
            .eq('client_id', shift.client_id as string)
            .eq('status', 'completed')
            .in('assigned_staff_id', staffIds)
        : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),

      // Active compliance overrides (batch)
      adminClient
        .from('compliance_overrides')
        .select('staff_profile_id')
        .eq('company_id', companyId)
        .in('staff_profile_id', staffIds)
        .is('revoked_at', null)
        .gt('expires_at', new Date().toISOString()),
    ])

  // ── Build lookup maps ──────────────────────────────────────────────────────

  const staffByApplicantId: Record<string, string> = {}
  for (const s of staff) {
    if (s.applicant_id) staffByApplicantId[s.applicant_id as string] = s.id as string
  }

  const docsByStaff: Record<string, ComplianceDocument[]> = {}
  for (const s of staff) docsByStaff[s.id as string] = []

  for (const doc of applicantDocRes.data ?? []) {
    const d       = doc as Record<string, unknown>
    const staffId = staffByApplicantId[d.applicant_id as string]
    if (staffId) docsByStaff[staffId].push(d as unknown as ComplianceDocument)
  }
  for (const doc of staffDocRes.data ?? []) {
    const d       = doc as Record<string, unknown>
    const staffId = d.staff_profile_id as string
    if (docsByStaff[staffId]) docsByStaff[staffId].push(d as unknown as ComplianceDocument)
  }

  const availByStaff: Record<string, ReturnType<typeof parseAvailabilityRecord>> = {}
  for (const row of availRes.data ?? []) {
    const r       = row as Record<string, unknown>
    const staffId = r.staff_profile_id as string
    availByStaff[staffId] = parseAvailabilityRecord(staffId, r)
  }

  const shiftsByStaff: Record<string, ExistingShiftInput[]> = {}
  for (const s of staff) shiftsByStaff[s.id as string] = []
  for (const s of nearbyShiftsRes.data ?? []) {
    const r       = s as Record<string, unknown>
    const staffId = r.assigned_staff_id as string
    if (shiftsByStaff[staffId]) {
      shiftsByStaff[staffId].push({
        id:         r.id         as string,
        shift_date: r.shift_date as string,
        start_time: r.start_time as string,
        end_time:   r.end_time   as string,
      })
    }
  }

  const weeklyMinsByStaff: Record<string, number> = {}
  for (const s of staff) weeklyMinsByStaff[s.id as string] = 0
  for (const s of weekShiftsRes.data ?? []) {
    const r   = s as Record<string, unknown>
    const sid = r.assigned_staff_id as string
    if (weeklyMinsByStaff[sid] !== undefined) {
      const [sh = 0, sm = 0] = (r.start_time as string).split(':').map(Number)
      const [eh = 0, em = 0] = (r.end_time   as string).split(':').map(Number)
      const start = sh * 60 + sm, end = eh * 60 + em
      weeklyMinsByStaff[sid] += end > start ? end - start : 1440 - start + end
    }
  }

  const lateAckByStaff: Record<string, number> = {}
  for (const s of staff) lateAckByStaff[s.id as string] = 0
  for (const row of ackRes.data ?? []) {
    const r   = row as Record<string, unknown>
    const sid = r.assigned_staff_id as string
    if (!r.worker_ack_status) {
      const ts = new Date(`${r.shift_date as string}T${(r.start_time as string).slice(0, 5)}:00Z`)
      if (ts < new Date() && lateAckByStaff[sid] !== undefined) lateAckByStaff[sid]++
    }
  }

  const clientHistorySet = new Set<string>()
  for (const row of clientHistoryRes.data ?? []) {
    const r = row as Record<string, unknown>
    if (r.assigned_staff_id) clientHistorySet.add(r.assigned_staff_id as string)
  }

  const overrideStaffIds = new Set<string>(
    (overrideRes.data ?? []).map((o) => (o as Record<string, unknown>).staff_profile_id as string)
  )

  // ── Score and evaluate each staff member ──────────────────────────────────

  const shiftInput = {
    id:          shift.id         as string,
    shift_date:  shift.shift_date as string,
    start_time:  shift.start_time as string,
    end_time:    shift.end_time   as string,
    shift_type:  shift.shift_type as string | null,
    client_id:   shift.client_id  as string | null,
  }

  const targetShift: ShiftSpan = {
    shift_date: shift.shift_date as string,
    start_time: shift.start_time as string,
    end_time:   shift.end_time   as string,
  }

  const results = staff.map((s) => {
    const staffId       = s.id as string
    const docs          = docsByStaff[staffId] ?? []
    const avail         = availByStaff[staffId] ?? null
    const compliance    = calculateCompliance(docs, (s as { job_role?: string | null }).job_role ?? null)
    const activeOverride = overrideStaffIds.has(staffId)
    const effectivelyCompliant = compliance.compliant || activeOverride
    const readiness     = calculateReadiness(s.status as string, effectivelyCompliant, avail)
    const existing      = shiftsByStaff[staffId] ?? []
    const hasCont       = clientHistorySet.has(staffId)
    const weeklyMins    = weeklyMinsByStaff[staffId] ?? 0
    const lateAckCount  = lateAckByStaff[staffId] ?? 0

    const scoreResult = calculateAssignmentScore(
      { id: staffId, status: s.status as string },
      shiftInput,
      avail,
      readiness,
      existing,
      hasCont
    )

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

    const existingSpans: ShiftSpan[] = existing.map((e) => ({
      shift_date: e.shift_date,
      start_time: e.start_time,
      end_time:   e.end_time,
    }))

    const safetyInput: SafetyInput = {
      staffStatus:              s.status as string,
      jobRole:                  (s as { job_role?: string | null }).job_role ?? null,
      onboardingComplete:       (s as { onboarding_completed?: boolean | null }).onboarding_completed === true,
      targetShift,
      complianceState:          compliance.complianceState,
      compliancePercent:        compliance.percentage,
      expiredDocuments:         compliance.expiredDocuments,
      missingDocuments:         compliance.missingDocuments,
      expiredTraining:          compliance.expiredTraining,
      missingTraining:          compliance.missingTraining,
      expiringSoon,
      activeOverride,
      availability:             avail,
      existingShifts:           existingSpans,
      scheduledMinutesThisWeek: weeklyMins,
      lateAckCount,
    }

    const safety = evaluateAssignmentSafety(safetyInput)

    const firstName = s.first_name as string | null
    const lastName  = s.last_name  as string | null
    const name = [firstName, lastName].filter(Boolean).join(' ') || (s.email as string) || 'Unknown'

    return {
      staff_profile_id:  staffId,
      name,
      score:             scoreResult.score,
      eligible:          scoreResult.eligible,
      reasons:           scoreResult.reasons,
      warnings:          scoreResult.warnings,
      // Safety engine output
      safety_outcome:       safety.outcome as AssignmentOutcome,
      safety_summary:       safety.summary,
      safety_block_count:   safety.blocks.length,
      safety_warning_count: safety.warnings.length,
      top_block:            safety.blocks[0]?.message ?? null,
      top_warning:          safety.warnings[0]?.message ?? null,
    }
  })

  results.sort((a, b) => {
    // Blocked last
    const aBlocked = a.safety_outcome === 'blocked_assignment'
    const bBlocked = b.safety_outcome === 'blocked_assignment'
    if (aBlocked !== bBlocked) return aBlocked ? 1 : -1
    // Eligible before ineligible
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1
    // Higher score first
    return b.score - a.score
  })

  return NextResponse.json(results)
}
