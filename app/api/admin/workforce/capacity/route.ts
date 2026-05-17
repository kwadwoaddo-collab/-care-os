// GET /api/admin/workforce/capacity
//
// Aggregates workforce deployability, shift coverage, onboarding bottlenecks,
// and compliance pressure into a single operational capacity snapshot.
//
// Used by the Workforce Capacity Dashboard.

import { NextResponse }                          from 'next/server'
import { adminClient }                           from '@/lib/supabase/admin'
import { requireAdmin }                          from '@/lib/auth/requireAdmin'
import { buildComplianceSnapshot }               from '@/lib/compliance/buildComplianceSnapshot'
import { classifyDeployability, type DeployabilityState } from '@/lib/workforce/readinessEngine'
import { calculateDeployabilityScore }           from '@/lib/workforce/deployabilityScore'
import { generateOperationalFeed }               from '@/lib/workforce/operationalFeed'
import type { ComplianceDocument }               from '@/lib/compliance/calculateCompliance'
import type { FeedAlert }                        from '@/lib/workforce/operationalFeed'

// ── Public types ──────────────────────────────────────────────────────────────

export interface StaffReadinessRow {
  id:                  string
  name:                string
  email:               string | null
  jobRole:             string | null
  status:              string
  deployabilityState:  DeployabilityState
  deployabilityScore:  number
  compliancePercent:   number
  onboardingProgress:  number
  blockers:            string[]
  warnings:            string[]
}

export interface RoleCapacity {
  role:         string
  deployable:   number
  atRisk:       number
  blocked:      number
  onboarding:   number
  total:        number
}

export interface ExpiryCluster {
  documentType: string
  count7d:      number
  count14d:     number
  count30d:     number
}

export interface UnderstaffedDay {
  date:           string
  uncoveredCount: number
}

export interface CapacitySummary {
  deployable:           number
  deployable_with_risk: number
  non_deployable:       number
  onboarding_incomplete: number
  suspended:            number
  inactive:             number
  total_active:         number
}

export interface OnboardingBottlenecks {
  stalledCount:        number
  missingDocs:         number
  missingCompliance:   number
  pendingApprovals:    number
  notStarted:          number
  awaitingReview:      number
  avgStalledDays:      number | null
}

export interface CapacityResponse {
  summary:              CapacitySummary
  staff:                StaffReadinessRow[]
  byRole:               RoleCapacity[]
  expiryCluster:        ExpiryCluster[]
  coverage: {
    uncoveredNext14d:   number
    understaffedDays:   UnderstaffedDay[]
  }
  onboarding:           OnboardingBottlenecks
  feed:                 FeedAlert[]
  asOf:                 string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function staffName(first: string | null, last: string | null, email: string | null): string {
  return [first, last].filter(Boolean).join(' ') || email || 'Unknown'
}

function daysBetween(a: string, b: string): number {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000)
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const today     = new Date().toISOString().slice(0, 10)
  const in14days  = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10)
  const in30days  = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)
  const ago30days = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)

  // ── Parallel data fetches ─────────────────────────────────────────────────
  const [
    staffResult,
    docsResult,
    availResult,
    incidentResult,
    shiftsNext14dResult,
    declinedResult,
    pendingCertsResult,
    onboardingDocsResult,
  ] = await Promise.all([
    // All non-terminated staff with onboarding fields
    adminClient
      .from('staff_profiles')
      .select([
        'id', 'first_name', 'last_name', 'email', 'job_role', 'status',
        'onboarding_completed', 'created_at',
        'right_to_work_checked', 'dbs_checked', 'dbs_expiry_date',
        'date_of_birth', 'nationality', 'address_line_1', 'city', 'postcode',
        'emergency_contact_name', 'emergency_contact_phone',
        'ni_number', 'starter_declaration', 'employment_type',
        'bank_account_number', 'bank_sort_code', 'bank_account_name',
        'policy_acknowledged',
      ].join(', '))
      .eq('company_id', companyId)
      .not('status', 'eq', 'terminated'),

    // All documents for compliance calculation
    adminClient
      .from('documents')
      .select('id, staff_profile_id, document_type, file_name, expiry_date, training_category, reviewed_status, issue_date')
      .eq('company_id', companyId),

    // Availability — just presence check (has any day marked available)
    adminClient
      .from('staff_availability')
      .select('staff_profile_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday')
      .eq('company_id', companyId),

    // Open/investigating incidents per staff (last 90 days)
    adminClient
      .from('incidents')
      .select('staff_profile_id')
      .eq('company_id', companyId)
      .in('status', ['open', 'investigating']),

    // Shifts in next 14 days — find unassigned
    adminClient
      .from('shifts')
      .select('id, shift_date, assigned_staff_id, status')
      .eq('company_id', companyId)
      .gte('shift_date', today)
      .lte('shift_date', in14days)
      .in('status', ['scheduled', 'confirmed', 'open']),

    // Declined shifts per staff in last 30 days
    adminClient
      .from('shifts')
      .select('assigned_staff_id')
      .eq('company_id', companyId)
      .eq('worker_ack_status', 'declined')
      .gte('shift_date', ago30days),

    // Pending training cert approvals
    adminClient
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('document_type', 'training_certificate')
      .eq('reviewed_status', 'pending'),

    // Docs for onboarding completeness check (document_type only)
    adminClient
      .from('documents')
      .select('staff_profile_id, document_type')
      .eq('company_id', companyId),
  ])

  const allStaff        = (staffResult.data   ?? []) as unknown as StaffRow[]
  const allDocs         = (docsResult.data     ?? []) as unknown as DocRow[]
  const allAvail        = (availResult.data    ?? []) as unknown as AvailRow[]
  const allIncidents    = (incidentResult.data ?? []) as unknown as IncidentRow[]
  const shiftsNext14d   = (shiftsNext14dResult.data ?? []) as unknown as ShiftRow[]
  const declinedShifts  = (declinedResult.data ?? []) as unknown as DeclinedRow[]
  const pendingCerts    = pendingCertsResult.count ?? 0
  const onboardingDocs  = (onboardingDocsResult.data ?? []) as unknown as { staff_profile_id: string; document_type: string }[]

  // ── Index helpers ─────────────────────────────────────────────────────────

  // Documents by staff
  const docsByStaff = new Map<string, ComplianceDocument[]>()
  for (const d of allDocs) {
    const arr = docsByStaff.get(d.staff_profile_id) ?? []
    arr.push({
      id:                d.id,
      document_type:     d.document_type,
      file_name:         d.file_name,
      expiry_date:       d.expiry_date,
      training_category: d.training_category,
      reviewed_status:   d.reviewed_status,
      issue_date:        d.issue_date,
    })
    docsByStaff.set(d.staff_profile_id, arr)
  }

  // Onboarding docs by staff (type only)
  const obDocsByStaff = new Map<string, string[]>()
  for (const d of onboardingDocs) {
    const arr = obDocsByStaff.get(d.staff_profile_id) ?? []
    arr.push(d.document_type)
    obDocsByStaff.set(d.staff_profile_id, arr)
  }

  // Availability by staff (has at least one available day)
  const availByStaff = new Map<string, boolean>()
  for (const a of allAvail) {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
    const hasDay = days.some((d) => {
      const v = a[d] as unknown as { available?: boolean } | null
      return v?.available === true
    })
    availByStaff.set(a.staff_profile_id, hasDay)
  }

  // Open incidents per staff
  const incidentsByStaff = new Map<string, number>()
  for (const i of allIncidents) {
    if (i.staff_profile_id) {
      incidentsByStaff.set(i.staff_profile_id, (incidentsByStaff.get(i.staff_profile_id) ?? 0) + 1)
    }
  }

  // Declined shifts per staff (last 30d)
  const declinedByStaff = new Map<string, number>()
  for (const s of declinedShifts) {
    if (s.assigned_staff_id) {
      declinedByStaff.set(s.assigned_staff_id, (declinedByStaff.get(s.assigned_staff_id) ?? 0) + 1)
    }
  }

  // ── Per-staff classification ──────────────────────────────────────────────

  const staffRows: StaffReadinessRow[] = []

  for (const s of allStaff) {
    const docs    = docsByStaff.get(s.id) ?? []
    const snap    = buildComplianceSnapshot(docs, s.job_role)
    const hasAvail = availByStaff.get(s.id) ?? false

    const deployResult = classifyDeployability({
      status:             s.status,
      onboardingComplete: s.onboarding_completed === true,
      complianceState:    snap.state,
      compliancePercent:  snap.percentage,
      dbsChecked:         s.dbs_checked === true,
      rtwChecked:         s.right_to_work_checked === true,
      hasAvailability:    hasAvail,
    })

    // Simple onboarding progress proxy from uploaded doc types
    const uploadedTypes  = obDocsByStaff.get(s.id) ?? []
    const mandatoryTypes = ['dbs', 'right_to_work', 'id', 'proof_of_address'] as const
    const docScore       = mandatoryTypes.filter((t) => uploadedTypes.includes(t)).length
    const sectionChecks  = [
      Boolean(s.first_name && s.last_name && s.date_of_birth),
      Boolean(s.address_line_1 && s.city && s.postcode),
      Boolean(s.emergency_contact_name && s.emergency_contact_phone),
      Boolean(s.ni_number && s.starter_declaration),
      Boolean(s.bank_account_number && s.bank_sort_code && s.bank_account_name),
      Boolean(s.employment_type),
      s.right_to_work_checked === true && s.dbs_checked === true,
      docScore === mandatoryTypes.length,
      s.policy_acknowledged === true,
    ]
    const onboardingProgress = Math.round((sectionChecks.filter(Boolean).length / sectionChecks.length) * 100)

    const score = calculateDeployabilityScore({
      status:             s.status,
      compliancePercent:  snap.percentage,
      onboardingProgress,
      onboardingComplete: s.onboarding_completed === true,
      dbsChecked:         s.dbs_checked === true,
      rtwChecked:         s.right_to_work_checked === true,
      hasAvailability:    hasAvail,
      openIncidents:      incidentsByStaff.get(s.id) ?? 0,
      expiringSoonCount:  snap.expiringSoon.length,
      declinedLast30Days: declinedByStaff.get(s.id) ?? 0,
    })

    staffRows.push({
      id:                 s.id,
      name:               staffName(s.first_name, s.last_name, s.email),
      email:              s.email,
      jobRole:            s.job_role,
      status:             s.status,
      deployabilityState: deployResult.state,
      deployabilityScore: score,
      compliancePercent:  snap.percentage,
      onboardingProgress,
      blockers:           deployResult.blockers,
      warnings:           deployResult.warnings,
    })
  }

  // ── Aggregate summary ─────────────────────────────────────────────────────

  const summary: CapacitySummary = {
    deployable:            count(staffRows, 'deployable'),
    deployable_with_risk:  count(staffRows, 'deployable_with_risk'),
    non_deployable:        count(staffRows, 'non_deployable'),
    onboarding_incomplete: count(staffRows, 'onboarding_incomplete'),
    suspended:             count(staffRows, 'suspended'),
    inactive:              count(staffRows, 'inactive'),
    total_active:          staffRows.filter((r) => r.status === 'active').length,
  }

  // ── Role capacity breakdown ───────────────────────────────────────────────

  const roleMap = new Map<string, RoleCapacity>()
  for (const r of staffRows) {
    const role = r.jobRole ?? 'Unspecified'
    const prev = roleMap.get(role) ?? { role, deployable: 0, atRisk: 0, blocked: 0, onboarding: 0, total: 0 }
    prev.total++
    if (r.deployabilityState === 'deployable')            prev.deployable++
    if (r.deployabilityState === 'deployable_with_risk')  prev.atRisk++
    if (r.deployabilityState === 'non_deployable')        prev.blocked++
    if (r.deployabilityState === 'onboarding_incomplete') prev.onboarding++
    roleMap.set(role, prev)
  }
  const byRole = Array.from(roleMap.values()).sort((a, b) => b.total - a.total)

  // ── Expiry clusters ───────────────────────────────────────────────────────

  const expiryTypeMap = new Map<string, { c7: number; c14: number; c30: number }>()
  for (const d of allDocs) {
    if (!d.expiry_date) continue
    const daysUntil = daysBetween(today, d.expiry_date)
    if (daysUntil < 0 || daysUntil > 30) continue
    const key = d.training_category ?? d.document_type
    const prev = expiryTypeMap.get(key) ?? { c7: 0, c14: 0, c30: 0 }
    if (daysUntil <= 7)  prev.c7++
    if (daysUntil <= 14) prev.c14++
    prev.c30++
    expiryTypeMap.set(key, prev)
  }
  const expiryCluster: ExpiryCluster[] = Array.from(expiryTypeMap.entries())
    .map(([documentType, v]) => ({ documentType, count7d: v.c7, count14d: v.c14, count30d: v.c30 }))
    .sort((a, b) => b.count7d - a.count7d)

  // ── Shift coverage gaps ───────────────────────────────────────────────────

  const uncoveredShifts = shiftsNext14d.filter((s) => !s.assigned_staff_id)
  const uncoveredByDay  = new Map<string, number>()
  for (const s of uncoveredShifts) {
    uncoveredByDay.set(s.shift_date, (uncoveredByDay.get(s.shift_date) ?? 0) + 1)
  }
  const understaffedDays: UnderstaffedDay[] = Array.from(uncoveredByDay.entries())
    .map(([date, uncoveredCount]) => ({ date, uncoveredCount }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // ── Onboarding bottlenecks ────────────────────────────────────────────────

  const STALLED_THRESHOLD = 7  // days without change
  let stalledCount      = 0
  let notStarted        = 0
  let awaitingReview    = 0
  let missingDocs       = 0
  let missingCompliance = 0
  const stalledDaysList: number[] = []

  for (const s of allStaff) {
    if (s.onboarding_completed) continue
    if (s.status === 'terminated' || s.status === 'inactive') continue

    const ageInDays = daysBetween(s.created_at, new Date().toISOString().slice(0, 10))
    const uploadedTypes  = obDocsByStaff.get(s.id) ?? []
    const mandatoryTypes = ['dbs', 'right_to_work', 'id', 'proof_of_address']
    const hasDocs   = mandatoryTypes.every((t) => uploadedTypes.includes(t))
    const hasBasics = Boolean(s.first_name && s.last_name && s.address_line_1)

    if (!hasDocs) missingDocs++
    if (!s.dbs_checked || !s.right_to_work_checked) missingCompliance++
    if (!hasBasics && ageInDays < 2) notStarted++

    if (hasBasics && !hasDocs && ageInDays >= STALLED_THRESHOLD) {
      stalledCount++
      stalledDaysList.push(ageInDays)
    } else if (hasDocs && (!s.dbs_checked || !s.right_to_work_checked) && ageInDays >= STALLED_THRESHOLD) {
      stalledCount++
      stalledDaysList.push(ageInDays)
    } else if (hasDocs && s.dbs_checked && s.right_to_work_checked && ageInDays >= STALLED_THRESHOLD) {
      // Awaiting review
      awaitingReview++
    }
  }

  const avgStalledDays =
    stalledDaysList.length > 0
      ? Math.round(stalledDaysList.reduce((a, b) => a + b, 0) / stalledDaysList.length)
      : null

  const onboarding: OnboardingBottlenecks = {
    stalledCount,
    missingDocs,
    missingCompliance,
    pendingApprovals: pendingCerts,
    notStarted,
    awaitingReview,
    avgStalledDays,
  }

  // ── Expiring in 14/30 days — staff count ─────────────────────────────────

  const staffExpiringIn14d = new Set<string>()
  const staffExpiringIn30d = new Set<string>()
  for (const d of allDocs) {
    if (!d.expiry_date) continue
    const daysUntil = daysBetween(today, d.expiry_date)
    if (daysUntil >= 0 && daysUntil <= 14) staffExpiringIn14d.add(d.staff_profile_id)
    if (daysUntil >= 0 && daysUntil <= 30) staffExpiringIn30d.add(d.staff_profile_id)
  }

  // Expiry clusters by role (for feed)
  const expiryByRole = new Map<string, number>()
  for (const d of allDocs) {
    if (!d.expiry_date) continue
    const daysUntil = daysBetween(today, d.expiry_date)
    if (daysUntil < 0 || daysUntil > 30) continue
    const staffMember = allStaff.find((s) => s.id === d.staff_profile_id)
    if (!staffMember) continue
    const role = staffMember.job_role ?? 'Unspecified'
    expiryByRole.set(role, (expiryByRole.get(role) ?? 0) + 1)
  }

  // ── Operational feed ──────────────────────────────────────────────────────

  const feed = generateOperationalFeed({
    deployable:           summary.deployable,
    atRisk:               summary.deployable_with_risk,
    nonDeployable:        summary.non_deployable,
    onboardingIncomplete: summary.onboarding_incomplete,
    uncoveredNext14d:     uncoveredShifts.length,
    expiringIn14d:        staffExpiringIn14d.size,
    expiringIn30d:        staffExpiringIn30d.size,
    stalledInOnboarding:  stalledCount,
    pendingCertApprovals: pendingCerts,
    missingReferences:    0,  // placeholder — references tracked via applicant docs
    roleShortages:        byRole
      .filter((r) => r.total >= 2)
      .map((r) => ({ role: r.role, deployable: r.deployable, threshold: 2 })),
    expiryClustersByRole: Array.from(expiryByRole.entries()).map(([role, count]) => ({
      role, count, days: 30,
    })),
  })

  const response: CapacityResponse = {
    summary,
    staff:       staffRows.sort((a, b) => a.deployabilityScore - b.deployabilityScore),
    byRole,
    expiryCluster,
    coverage: {
      uncoveredNext14d: uncoveredShifts.length,
      understaffedDays,
    },
    onboarding,
    feed,
    asOf: new Date().toISOString(),
  }

  return NextResponse.json(response)
}

// ── Internal row shapes ───────────────────────────────────────────────────────

interface StaffRow {
  id:                    string
  first_name:            string | null
  last_name:             string | null
  email:                 string | null
  job_role:              string | null
  status:                string
  onboarding_completed:  boolean | null
  created_at:            string
  right_to_work_checked: boolean | null
  dbs_checked:           boolean | null
  dbs_expiry_date:       string | null
  date_of_birth:         string | null
  nationality:           string | null
  address_line_1:        string | null
  city:                  string | null
  postcode:              string | null
  emergency_contact_name:  string | null
  emergency_contact_phone: string | null
  ni_number:             string | null
  starter_declaration:   string | null
  employment_type:       string | null
  bank_account_number:   string | null
  bank_sort_code:        string | null
  bank_account_name:     string | null
  policy_acknowledged:   boolean | null
}

interface DocRow {
  id:                string
  staff_profile_id:  string
  document_type:     string
  file_name:         string
  expiry_date:       string | null
  training_category: string | null
  reviewed_status:   string | null
  issue_date:        string | null
}

interface AvailRow {
  staff_profile_id: string
  monday:    unknown
  tuesday:   unknown
  wednesday: unknown
  thursday:  unknown
  friday:    unknown
  saturday:  unknown
  sunday:    unknown
}

interface IncidentRow {
  staff_profile_id: string | null
}

interface ShiftRow {
  id:               string
  shift_date:       string
  assigned_staff_id: string | null
  status:           string
}

interface DeclinedRow {
  assigned_staff_id: string | null
}

// ── Count helper ──────────────────────────────────────────────────────────────

function count(rows: StaffReadinessRow[], state: DeployabilityState): number {
  return rows.filter((r) => r.deployabilityState === state).length
}
