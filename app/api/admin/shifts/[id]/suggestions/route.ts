import { NextRequest, NextResponse } from 'next/server'
import { adminClient }               from '@/lib/supabase/admin'
import { requireAdmin }              from '@/lib/auth/requireAdmin'
import {
  calculateCompliance,
  type ComplianceDocument,
}                                    from '@/lib/compliance/calculateCompliance'
import { parseAvailabilityRecord }   from '@/lib/staff/types'
import {
  detectConflicts,
  type ConflictDetail,
}                                    from '@/lib/scheduling/detectConflicts'
import { type ShiftSpan }            from '@/lib/shifts/hasShiftOverlap'
import { type DayKey }               from '@/lib/staff/types'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ShiftSuggestion {
  staff_profile_id:   string
  name:               string
  eligible:           boolean
  availability_match: boolean
  compliance_warnings: string[]
  conflict_reasons:   string[]
  assignment_conflicts: string[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_NAMES: DayKey[] = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
]

function dayKeyFromDate(shiftDate: string): DayKey {
  const idx = new Date(shiftDate + 'T12:00:00Z').getUTCDay()
  return DAY_NAMES[idx]!
}

// ── GET /api/admin/shifts/[id]/suggestions ────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const { id: shiftId } = await params

  // ── Fetch target shift ────────────────────────────────────────────────────
  const { data: shift, error: shiftErr } = await adminClient
    .from('shifts')
    .select('id, company_id, shift_date, start_time, end_time, shift_type, client_id, assigned_staff_id, status')
    .eq('id', shiftId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (shiftErr || !shift) {
    return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
  }

  // ── Fetch all active staff ────────────────────────────────────────────────
  const { data: staffList, error: staffErr } = await adminClient
    .from('staff_profiles')
    .select('id, first_name, last_name, email, status, applicant_id')
    .eq('company_id', companyId)
    .eq('status', 'active')

  if (staffErr) {
    return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 })
  }

  const staff = staffList ?? []
  if (staff.length === 0) return NextResponse.json([])

  const staffIds     = staff.map((s) => s.id as string)
  const applicantIds = staff
    .map((s) => s.applicant_id as string | null)
    .filter((id): id is string => Boolean(id))

  const shiftDate  = shift.shift_date as string
  const dateParts  = shiftDate.split('-').map(Number) as [number, number, number]
  const baseDay    = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]))
  const dayBefore  = new Date(baseDay); dayBefore.setUTCDate(baseDay.getUTCDate() - 1)
  const dayAfter   = new Date(baseDay); dayAfter.setUTCDate(baseDay.getUTCDate() + 1)

  // ── Week bounds for hours risk ────────────────────────────────────────────
  const weekStart = new Date(baseDay)
  const dow       = weekStart.getUTCDay()
  weekStart.setUTCDate(baseDay.getUTCDate() - dow)
  const weekEnd   = new Date(weekStart)
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6)

  // ── Batch fetch ───────────────────────────────────────────────────────────
  const [availRes, applicantDocRes, staffDocRes, nearbyShiftsRes, weeklyShiftsRes, ackHistoryRes] =
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
        .gte('shift_date', dayBefore.toISOString().slice(0, 10))
        .lte('shift_date', dayAfter.toISOString().slice(0, 10))
        .neq('status', 'cancelled')
        .neq('id', shiftId),

      adminClient
        .from('shifts')
        .select('assigned_staff_id, start_time, end_time')
        .in('assigned_staff_id', staffIds)
        .gte('shift_date', weekStart.toISOString().slice(0, 10))
        .lte('shift_date', weekEnd.toISOString().slice(0, 10))
        .neq('status', 'cancelled')
        .neq('id', shiftId),

      adminClient
        .from('shifts')
        .select('assigned_staff_id, shift_date, start_time, worker_ack_status, worker_ack_at')
        .in('assigned_staff_id', staffIds)
        .gte('shift_date', new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10))
        .lte('shift_date', shiftDate),
    ])

  // ── Build lookup maps ─────────────────────────────────────────────────────
  const staffByApplicantId: Record<string, string> = {}
  for (const s of staff) {
    if (s.applicant_id) staffByApplicantId[s.applicant_id as string] = s.id as string
  }

  const docsByStaff: Record<string, ComplianceDocument[]> = {}
  for (const s of staff) docsByStaff[s.id as string] = []

  for (const doc of applicantDocRes.data ?? []) {
    const d = doc as Record<string, unknown>
    const sid = staffByApplicantId[d.applicant_id as string]
    if (sid) docsByStaff[sid].push(d as unknown as ComplianceDocument)
  }
  for (const doc of staffDocRes.data ?? []) {
    const d   = doc as Record<string, unknown>
    const sid = d.staff_profile_id as string
    if (docsByStaff[sid]) docsByStaff[sid].push(d as unknown as ComplianceDocument)
  }

  const availByStaff: Record<string, ReturnType<typeof parseAvailabilityRecord>> = {}
  for (const row of availRes.data ?? []) {
    const r   = row as Record<string, unknown>
    const sid = r.staff_profile_id as string
    availByStaff[sid] = parseAvailabilityRecord(sid, r)
  }

  const nearbyByStaff: Record<string, ShiftSpan[]> = {}
  for (const s of staff) nearbyByStaff[s.id as string] = []
  for (const s of nearbyShiftsRes.data ?? []) {
    const r   = s as Record<string, unknown>
    const sid = r.assigned_staff_id as string
    if (nearbyByStaff[sid]) {
      nearbyByStaff[sid].push({
        shift_date: r.shift_date as string,
        start_time: r.start_time as string,
        end_time:   r.end_time   as string,
      })
    }
  }

  // Weekly scheduled minutes per staff
  const weeklyMinsByStaff: Record<string, number> = {}
  for (const s of staff) weeklyMinsByStaff[s.id as string] = 0
  for (const s of weeklyShiftsRes.data ?? []) {
    const r   = s as Record<string, unknown>
    const sid = r.assigned_staff_id as string
    if (weeklyMinsByStaff[sid] !== undefined) {
      const [sh = 0, sm = 0] = (r.start_time as string).split(':').map(Number)
      const [eh = 0, em = 0] = (r.end_time   as string).split(':').map(Number)
      const startM = sh * 60 + sm
      const endM   = eh * 60 + em
      weeklyMinsByStaff[sid] += endM > startM ? endM - startM : 1440 - startM + endM
    }
  }

  // Ack history per staff
  const ackHistoryByStaff: Record<string, { shift_date: string; start_time: string; worker_ack_status: string | null; worker_ack_at: string | null }[]> = {}
  for (const s of staff) ackHistoryByStaff[s.id as string] = []
  for (const row of ackHistoryRes.data ?? []) {
    const r   = row as Record<string, unknown>
    const sid = r.assigned_staff_id as string
    if (ackHistoryByStaff[sid]) {
      ackHistoryByStaff[sid].push({
        shift_date:        r.shift_date        as string,
        start_time:        r.start_time        as string,
        worker_ack_status: r.worker_ack_status as string | null,
        worker_ack_at:     r.worker_ack_at     as string | null,
      })
    }
  }

  // ── Score and detect conflicts for each staff ─────────────────────────────
  const targetShift: ShiftSpan = {
    shift_date: shift.shift_date as string,
    start_time: shift.start_time as string,
    end_time:   shift.end_time   as string,
  }

  const results: ShiftSuggestion[] = staff.map((s) => {
    const staffId     = s.id as string
    const docs        = docsByStaff[staffId]  ?? []
    const avail       = availByStaff[staffId] ?? null
    const compliance  = calculateCompliance(docs)
    const nearby      = nearbyByStaff[staffId]  ?? []
    const weeklyMins  = weeklyMinsByStaff[staffId] ?? 0

    // Late ack count (simple count of no-response past shifts in window)
    const ackHistory  = ackHistoryByStaff[staffId] ?? []
    const lateAckCount = ackHistory.filter(
      (a) => !a.worker_ack_status && new Date(`${a.shift_date}T${a.start_time.slice(0, 5)}:00Z`) < new Date()
    ).length

    const detection = detectConflicts({
      targetShift,
      staffStatus:               s.status as string,
      availability:              avail,
      existingShifts:            nearby,
      complianceExpired:         compliance.expiredDocuments,
      complianceExpiringSoon:    compliance.expiringSoon,
      scheduledMinutesThisWeek:  weeklyMins,
      lateAckCount,
    })

    // Availability match: day available and shift times fit within window
    const dayKey   = dayKeyFromDate(targetShift.shift_date)
    const dayAvail = avail ? avail[dayKey] : undefined
    let availabilityMatch = dayAvail?.available === true
    if (availabilityMatch && dayAvail?.start_time && dayAvail?.end_time) {
      const toMins   = (t: string) => { const [h = 0, m = 0] = t.split(':').map(Number); return h * 60 + m }
      const sStart   = toMins(targetShift.start_time)
      const sEnd     = toMins(targetShift.end_time)
      const aStart   = toMins(dayAvail.start_time)
      const aEnd     = toMins(dayAvail.end_time)
      const overnight = targetShift.end_time <= targetShift.start_time
      availabilityMatch = overnight ? sStart >= aStart : sStart >= aStart && sEnd <= aEnd
    }

    const name = [s.first_name as string | null, s.last_name as string | null]
      .filter(Boolean).join(' ') || (s.email as string) || 'Unknown'

    return {
      staff_profile_id:    staffId,
      name,
      eligible:            !detection.hasBlock,
      availability_match:  availabilityMatch,
      compliance_warnings: detection.warnings
        .filter((w: ConflictDetail) => w.type === 'compliance_expiring')
        .map((w: ConflictDetail) => w.message),
      conflict_reasons:    detection.conflicts.map((c: ConflictDetail) => c.message),
      assignment_conflicts: detection.warnings
        .filter((w: ConflictDetail) => w.type !== 'compliance_expiring')
        .map((w: ConflictDetail) => w.message),
    }
  })

  // Eligible first, then alphabetically
  results.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return NextResponse.json(results)
}
