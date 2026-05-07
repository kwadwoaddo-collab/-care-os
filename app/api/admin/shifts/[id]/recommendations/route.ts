import { NextRequest, NextResponse } from 'next/server'
import { adminClient }               from '@/lib/supabase/admin'
import {
  calculateCompliance,
  type ComplianceDocument,
} from '@/lib/compliance/calculateCompliance'
import { parseAvailabilityRecord }   from '@/lib/staff/types'
import { calculateReadiness }        from '@/lib/staff/calculateReadiness'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import {
  calculateAssignmentScore,
  type ExistingShiftInput,
} from '@/lib/shifts/calculateAssignmentScore'

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
    .select('id, first_name, last_name, email, status, applicant_id, company_id')
    .eq('company_id', companyId)
    .eq('status', 'active')

  if (staffErr) {
    console.error('[recommendations] staff fetch error:', staffErr.message)
    return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 })
  }

  const staff = staffList ?? []
  if (staff.length === 0) return NextResponse.json([])

  const staffIds      = staff.map((s) => s.id as string)
  const applicantIds  = staff.map((s) => s.applicant_id as string | null).filter((id): id is string => Boolean(id))

  // ── Batch fetch: availability, documents, nearby shifts, client history ────
  const shiftDate   = shift.shift_date as string
  const dateParts   = shiftDate.split('-').map(Number) as [number, number, number]
  const baseDay     = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]))
  const dayBefore   = new Date(baseDay); dayBefore.setUTCDate(baseDay.getUTCDate() - 1)
  const dayAfter    = new Date(baseDay); dayAfter.setUTCDate(baseDay.getUTCDate() + 1)
  const dayBeforeStr = dayBefore.toISOString().slice(0, 10)
  const dayAfterStr  = dayAfter.toISOString().slice(0, 10)

  const [availRes, applicantDocRes, staffDocRes, nearbyShiftsRes, clientHistoryRes] =
    await Promise.all([
      adminClient.from('staff_availability').select('*').in('staff_profile_id', staffIds),

      applicantIds.length > 0
        ? adminClient
            .from('documents')
            .select('id, document_type, file_name, expiry_date, applicant_id')
            .in('applicant_id', applicantIds)
        : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),

      adminClient
        .from('documents')
        .select('id, document_type, file_name, expiry_date, staff_profile_id')
        .in('staff_profile_id', staffIds),

      adminClient
        .from('shifts')
        .select('id, assigned_staff_id, shift_date, start_time, end_time')
        .in('assigned_staff_id', staffIds)
        .gte('shift_date', dayBeforeStr)
        .lte('shift_date', dayAfterStr)
        .neq('status', 'cancelled')
        .neq('id', shiftId),

      shift.client_id
        ? adminClient
            .from('shifts')
            .select('assigned_staff_id')
            .eq('client_id', shift.client_id as string)
            .eq('status', 'completed')
            .in('assigned_staff_id', staffIds)
        : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
    ])

  // ── Build lookup maps ──────────────────────────────────────────────────────

  // Applicant ID → staff ID
  const staffByApplicantId: Record<string, string> = {}
  for (const s of staff) {
    if (s.applicant_id) staffByApplicantId[s.applicant_id as string] = s.id as string
  }

  // Staff ID → documents
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

  // Staff ID → availability
  const availByStaff: Record<string, ReturnType<typeof parseAvailabilityRecord>> = {}
  for (const row of availRes.data ?? []) {
    const r       = row as Record<string, unknown>
    const staffId = r.staff_profile_id as string
    availByStaff[staffId] = parseAvailabilityRecord(staffId, r)
  }

  // Staff ID → nearby assigned shifts (for overlap + workload)
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

  // Staff IDs with client history
  const clientHistorySet = new Set<string>()
  for (const row of clientHistoryRes.data ?? []) {
    const r = row as Record<string, unknown>
    if (r.assigned_staff_id) clientHistorySet.add(r.assigned_staff_id as string)
  }

  // ── Score each staff member ────────────────────────────────────────────────
  const shiftInput = {
    id:          shift.id         as string,
    shift_date:  shift.shift_date as string,
    start_time:  shift.start_time as string,
    end_time:    shift.end_time   as string,
    shift_type:  shift.shift_type as string | null,
    client_id:   shift.client_id  as string | null,
  }

  const results = staff.map((s) => {
    const staffId    = s.id as string
    const docs       = docsByStaff[staffId] ?? []
    const avail      = availByStaff[staffId] ?? null
    const compliance = calculateCompliance(docs)
    const readiness  = calculateReadiness(s.status as string, compliance.compliant, avail)
    const existing   = shiftsByStaff[staffId] ?? []
    const hasCont    = clientHistorySet.has(staffId)

    const result = calculateAssignmentScore(
      { id: staffId, status: s.status as string },
      shiftInput,
      avail,
      readiness,
      existing,
      hasCont
    )

    const firstName = s.first_name as string | null
    const lastName  = s.last_name  as string | null
    const name = [firstName, lastName].filter(Boolean).join(' ') || (s.email as string) || 'Unknown'

    return {
      staff_profile_id: staffId,
      name,
      score:    result.score,
      eligible: result.eligible,
      reasons:  result.reasons,
      warnings: result.warnings,
    }
  })

  // Eligible first, then by score descending
  results.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1
    return b.score - a.score
  })

  return NextResponse.json(results)
}
