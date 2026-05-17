// GET /api/admin/scheduling/staffing-risk
//
// Returns current staffing risk profile:
// single points of failure, role shortages, weekend/night coverage gaps,
// and compliance expiry clusters that could deplete role capacity.

import { NextResponse }              from 'next/server'
import { adminClient }               from '@/lib/supabase/admin'
import { requireAdmin }              from '@/lib/auth/requireAdmin'
import { buildComplianceSnapshot }   from '@/lib/compliance/buildComplianceSnapshot'
import { classifyDeployability }     from '@/lib/workforce/readinessEngine'
import { detectStaffingRisks }       from '@/lib/scheduling/staffingRisk'
import type { RoleCounts }           from '@/lib/scheduling/staffingRisk'
import type { ComplianceDocument }   from '@/lib/compliance/calculateCompliance'

interface StaffRow {
  id:                    string
  first_name:            string | null
  last_name:             string | null
  job_role:              string | null
  status:                string
  onboarding_completed:  boolean | null
  right_to_work_checked: boolean | null
  dbs_checked:           boolean | null
}

interface AvailRow {
  staff_profile_id: string
  monday:    unknown; tuesday:   unknown; wednesday: unknown
  thursday:  unknown; friday:    unknown; saturday:  unknown; sunday: unknown
  can_work_weekends: boolean | null
  can_work_nights:   boolean | null
}

interface DocRow {
  staff_profile_id:  string
  document_type:     string
  file_name:         string
  expiry_date:       string | null
  training_category: string | null
  reviewed_status:   string | null
  issue_date:        string | null
}

function daysBetween(from: string, to: string): number {
  return Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000)
}

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const today    = new Date().toISOString().slice(0, 10)
  const in14days = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10)

  const [staffRes, docsRes, availRes] = await Promise.all([
    adminClient
      .from('staff_profiles')
      .select('id, first_name, last_name, job_role, status, onboarding_completed, right_to_work_checked, dbs_checked')
      .eq('company_id', companyId)
      .not('status', 'in', '("terminated","inactive")'),

    adminClient
      .from('documents')
      .select('staff_profile_id, document_type, file_name, expiry_date, training_category, reviewed_status, issue_date')
      .eq('company_id', companyId),

    adminClient
      .from('staff_availability')
      .select('staff_profile_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, can_work_weekends, can_work_nights')
      .eq('company_id', companyId),
  ])

  const allStaff = (staffRes.data ?? []) as unknown as StaffRow[]
  const allDocs  = (docsRes.data  ?? []) as unknown as DocRow[]
  const allAvail = (availRes.data ?? []) as unknown as AvailRow[]

  // Index documents by staff
  const docsByStaff = new Map<string, ComplianceDocument[]>()
  for (const d of allDocs) {
    const arr = docsByStaff.get(d.staff_profile_id) ?? []
    arr.push({
      id:                d.staff_profile_id + '_' + d.document_type,
      document_type:     d.document_type,
      file_name:         d.file_name,
      expiry_date:       d.expiry_date,
      training_category: d.training_category,
      reviewed_status:   d.reviewed_status,
      issue_date:        d.issue_date,
    })
    docsByStaff.set(d.staff_profile_id, arr)
  }

  // Index availability by staff
  const availByStaff = new Map<string, AvailRow>()
  for (const a of allAvail) availByStaff.set(a.staff_profile_id, a)

  // ── Classify each staff member ────────────────────────────────────────────

  const staffByRole = new Map<string, RoleCounts>()
  let totalDeployable  = 0
  let canWorkWeekends  = 0
  let canWorkNights    = 0

  // Expiry clusters by role: role → set of staff IDs with expiring items
  const expiryByRole = new Map<string, Set<string>>()

  for (const s of allStaff) {
    const docs  = docsByStaff.get(s.id) ?? []
    const snap  = buildComplianceSnapshot(docs, s.job_role)
    const avail = availByStaff.get(s.id)
    const hasAnyAvail = avail
      ? ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].some((d) => {
          const v = (avail as unknown as Record<string, unknown>)[d] as { available?: boolean } | null
          return v?.available === true
        })
      : false

    const result = classifyDeployability({
      status:             s.status,
      onboardingComplete: s.onboarding_completed === true,
      complianceState:    snap.state,
      compliancePercent:  snap.percentage,
      dbsChecked:         s.dbs_checked === true,
      rtwChecked:         s.right_to_work_checked === true,
      hasAvailability:    hasAnyAvail,
    })

    const role  = s.job_role ?? 'unspecified'
    const prev  = staffByRole.get(role) ?? { deployable: 0, atRisk: 0, blocked: 0, onboarding: 0, total: 0 }
    prev.total++

    const state = result.state
    if (state === 'deployable') {
      prev.deployable++
      totalDeployable++
      if (avail?.can_work_weekends) canWorkWeekends++
      if (avail?.can_work_nights)   canWorkNights++
    } else if (state === 'deployable_with_risk') {
      prev.atRisk++
      totalDeployable++
      if (avail?.can_work_weekends) canWorkWeekends++
      if (avail?.can_work_nights)   canWorkNights++
    } else if (state === 'non_deployable') {
      prev.blocked++
    } else if (state === 'onboarding_incomplete') {
      prev.onboarding++
    }

    staffByRole.set(role, prev)

    // Track expiry clusters (docs expiring in 14 days)
    const hasExpiringItem = docs.some((d) => {
      if (!d.expiry_date) return false
      const days = daysBetween(today, d.expiry_date)
      return days >= 0 && days <= 14
    })
    if (hasExpiringItem && (state === 'deployable' || state === 'deployable_with_risk')) {
      const roleSet = expiryByRole.get(role) ?? new Set()
      roleSet.add(s.id)
      expiryByRole.set(role, roleSet)
    }
  }

  const expiryClustersByRole = Array.from(expiryByRole.entries()).map(([role, staffSet]) => ({
    role,
    count: staffSet.size,
    days:  14,
  }))

  const risks = detectStaffingRisks({
    staffByRole,
    totalDeployable,
    canWorkWeekends,
    canWorkNights,
    expiryClustersByRole,
  })

  return NextResponse.json({
    risks,
    summary: {
      totalRisks:   risks.length,
      critical:     risks.filter((r) => r.level === 'critical').length,
      high:         risks.filter((r) => r.level === 'high').length,
      medium:       risks.filter((r) => r.level === 'medium').length,
      totalDeployable,
      canWorkWeekends,
      canWorkNights,
    },
    asOf: new Date().toISOString(),
  })
}
