import { requireAdmin }            from '@/lib/auth/requireAdmin'
import { canManageStaff }          from '@/lib/rbac/can'
import AccessDenied                from '@/components/admin/AccessDenied'
import { adminClient }             from '@/lib/supabase/admin'
import { buildComplianceSnapshot } from '@/lib/compliance/buildComplianceSnapshot'
import { classifyDeployability }   from '@/lib/workforce/readinessEngine'
import { calculateDeployabilityScore } from '@/lib/workforce/deployabilityScore'
import { generateOperationalFeed } from '@/lib/workforce/operationalFeed'
import WorkforceCapacityClient     from './WorkforceCapacityClient'
import type {
  CapacityResponse,
  StaffReadinessRow,
  RoleCapacity,
  ExpiryCluster,
  UnderstaffedDay,
  CapacitySummary,
  OnboardingBottlenecks,
} from '@/app/api/admin/workforce/capacity/route'
import type { DeployabilityState } from '@/lib/workforce/readinessEngine'
import type { ComplianceDocument } from '@/lib/compliance/calculateCompliance'

// ── Helpers ───────────────────────────────────────────────────────────────────

function staffName(first: string | null, last: string | null, email: string | null): string {
  return [first, last].filter(Boolean).join(' ') || email || 'Unknown'
}

function daysBetween(a: string, b: string): number {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000)
}

function count(rows: StaffReadinessRow[], state: DeployabilityState): number {
  return rows.filter((r) => r.deployabilityState === state).length
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function WorkforceCapacityPage() {
  const auth = await requireAdmin()
  if (!auth.ok) return <AccessDenied />

  const { role, companyId } = auth.ctx
  if (!canManageStaff(role)) return <AccessDenied />

  const today     = new Date().toISOString().slice(0, 10)
  // eslint-disable-next-line react-hooks/purity
  const ago30days = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
  // eslint-disable-next-line react-hooks/purity
  const in14days  = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10)

  const [
    staffResult,
    docsResult,
    availResult,
    incidentResult,
    shiftsResult,
    declinedResult,
    pendingCertsResult,
    obDocsResult,
  ] = await Promise.all([
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

    adminClient
      .from('documents')
      .select('id, staff_profile_id, document_type, file_name, expiry_date, training_category, reviewed_status, issue_date')
      .eq('company_id', companyId),

    adminClient
      .from('staff_availability')
      .select('staff_profile_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday')
      .eq('company_id', companyId),

    adminClient
      .from('incidents')
      .select('staff_profile_id')
      .eq('company_id', companyId)
      .in('status', ['open', 'investigating']),

    adminClient
      .from('shifts')
      .select('id, shift_date, assigned_staff_id, status')
      .eq('company_id', companyId)
      .gte('shift_date', today)
      .lte('shift_date', in14days)
      .in('status', ['scheduled', 'confirmed', 'open']),

    adminClient
      .from('shifts')
      .select('assigned_staff_id')
      .eq('company_id', companyId)
      .eq('worker_ack_status', 'declined')
      .gte('shift_date', ago30days),

    adminClient
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('document_type', 'training_certificate')
      .eq('reviewed_status', 'pending'),

    adminClient
      .from('documents')
      .select('staff_profile_id, document_type')
      .eq('company_id', companyId),
  ])

  // ── Type casts ────────────────────────────────────────────────────────────

  type StaffRow = {
    id: string; first_name: string | null; last_name: string | null; email: string | null
    job_role: string | null; status: string; onboarding_completed: boolean | null
    created_at: string; right_to_work_checked: boolean | null; dbs_checked: boolean | null
    dbs_expiry_date: string | null; date_of_birth: string | null; nationality: string | null
    address_line_1: string | null; city: string | null; postcode: string | null
    emergency_contact_name: string | null; emergency_contact_phone: string | null
    ni_number: string | null; starter_declaration: string | null; employment_type: string | null
    bank_account_number: string | null; bank_sort_code: string | null; bank_account_name: string | null
    policy_acknowledged: boolean | null
  }
  type DocRow = {
    id: string; staff_profile_id: string; document_type: string; file_name: string
    expiry_date: string | null; training_category: string | null; reviewed_status: string | null; issue_date: string | null
  }
  type AvailRow = { staff_profile_id: string; [day: string]: unknown }
  type ShiftRow = { id: string; shift_date: string; assigned_staff_id: string | null; status: string }

  const allStaff      = (staffResult.data   ?? []) as unknown as StaffRow[]
  const allDocs       = (docsResult.data     ?? []) as unknown as DocRow[]
  const allAvail      = (availResult.data    ?? []) as unknown as AvailRow[]
  const allIncidents  = (incidentResult.data ?? []) as unknown as { staff_profile_id: string | null }[]
  const shifts14d     = (shiftsResult.data   ?? []) as unknown as ShiftRow[]
  const declinedShifts = (declinedResult.data ?? []) as unknown as { assigned_staff_id: string | null }[]
  const pendingCerts  = pendingCertsResult.count ?? 0
  const obDocs        = (obDocsResult.data   ?? []) as unknown as { staff_profile_id: string; document_type: string }[]

  // ── Index maps ────────────────────────────────────────────────────────────

  const docsByStaff = new Map<string, ComplianceDocument[]>()
  for (const d of allDocs) {
    const arr = docsByStaff.get(d.staff_profile_id) ?? []
    arr.push({ id: d.id, document_type: d.document_type, file_name: d.file_name,
      expiry_date: d.expiry_date, training_category: d.training_category,
      reviewed_status: d.reviewed_status, issue_date: d.issue_date })
    docsByStaff.set(d.staff_profile_id, arr)
  }

  const obDocsByStaff = new Map<string, string[]>()
  for (const d of obDocs) {
    const arr = obDocsByStaff.get(d.staff_profile_id) ?? []
    arr.push(d.document_type)
    obDocsByStaff.set(d.staff_profile_id, arr)
  }

  const availByStaff = new Map<string, boolean>()
  for (const a of allAvail) {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    const hasDay = days.some((d) => {
      const v = a[d] as { available?: boolean } | null
      return v?.available === true
    })
    availByStaff.set(a.staff_profile_id as string, hasDay)
  }

  const incidentsByStaff = new Map<string, number>()
  for (const i of allIncidents) {
    if (i.staff_profile_id) {
      incidentsByStaff.set(i.staff_profile_id, (incidentsByStaff.get(i.staff_profile_id) ?? 0) + 1)
    }
  }

  const declinedByStaff = new Map<string, number>()
  for (const s of declinedShifts) {
    if (s.assigned_staff_id) {
      declinedByStaff.set(s.assigned_staff_id, (declinedByStaff.get(s.assigned_staff_id) ?? 0) + 1)
    }
  }

  // ── Per-staff classification ──────────────────────────────────────────────

  const staffRows: StaffReadinessRow[] = []
  const mandatoryTypes = ['dbs', 'right_to_work', 'id', 'proof_of_address']

  for (const s of allStaff) {
    const docs    = docsByStaff.get(s.id) ?? []
    const snap    = buildComplianceSnapshot(docs, s.job_role)
    const hasAvail = availByStaff.get(s.id) ?? false

    const uploadedTypes  = obDocsByStaff.get(s.id) ?? []
    const sectionChecks = [
      Boolean(s.first_name && s.last_name && s.date_of_birth),
      Boolean(s.address_line_1 && s.city && s.postcode),
      Boolean(s.emergency_contact_name && s.emergency_contact_phone),
      Boolean(s.ni_number && s.starter_declaration),
      Boolean(s.bank_account_number && s.bank_sort_code && s.bank_account_name),
      Boolean(s.employment_type),
      s.right_to_work_checked === true && s.dbs_checked === true,
      mandatoryTypes.every((t) => uploadedTypes.includes(t)),
      s.policy_acknowledged === true,
    ]
    const onboardingProgress = Math.round((sectionChecks.filter(Boolean).length / sectionChecks.length) * 100)

    const deployResult = classifyDeployability({
      status:             s.status,
      onboardingComplete: s.onboarding_completed === true,
      complianceState:    snap.state,
      compliancePercent:  snap.percentage,
      dbsChecked:         s.dbs_checked === true,
      rtwChecked:         s.right_to_work_checked === true,
      hasAvailability:    hasAvail,
    })

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

  // ── Aggregates ────────────────────────────────────────────────────────────

  const summary: CapacitySummary = {
    deployable:            count(staffRows, 'deployable'),
    deployable_with_risk:  count(staffRows, 'deployable_with_risk'),
    non_deployable:        count(staffRows, 'non_deployable'),
    onboarding_incomplete: count(staffRows, 'onboarding_incomplete'),
    suspended:             count(staffRows, 'suspended'),
    inactive:              count(staffRows, 'inactive'),
    total_active:          staffRows.filter((r) => r.status === 'active').length,
  }

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

  const expiryTypeMap = new Map<string, { c7: number; c14: number; c30: number }>()
  for (const d of allDocs) {
    if (!d.expiry_date) continue
    const daysUntil = daysBetween(today, d.expiry_date)
    if (daysUntil < 0 || daysUntil > 30) continue
    const key  = d.training_category ?? d.document_type
    const prev = expiryTypeMap.get(key) ?? { c7: 0, c14: 0, c30: 0 }
    if (daysUntil <= 7)  prev.c7++
    if (daysUntil <= 14) prev.c14++
    prev.c30++
    expiryTypeMap.set(key, prev)
  }
  const expiryCluster: ExpiryCluster[] = Array.from(expiryTypeMap.entries())
    .map(([documentType, v]) => ({ documentType, count7d: v.c7, count14d: v.c14, count30d: v.c30 }))
    .sort((a, b) => b.count7d - a.count7d)

  const uncoveredShifts = shifts14d.filter((s) => !s.assigned_staff_id)
  const uncoveredByDay  = new Map<string, number>()
  for (const s of uncoveredShifts) {
    uncoveredByDay.set(s.shift_date, (uncoveredByDay.get(s.shift_date) ?? 0) + 1)
  }
  const understaffedDays: UnderstaffedDay[] = Array.from(uncoveredByDay.entries())
    .map(([date, uncoveredCount]) => ({ date, uncoveredCount }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Onboarding bottlenecks
  const STALLED_DAYS = 7
  let stalledCount = 0; let notStarted = 0; let awaitingReview = 0
  let missingDocs = 0;  let missingCompliance = 0
  const stalledDaysList: number[] = []

  for (const s of allStaff) {
    if (s.onboarding_completed || s.status === 'terminated' || s.status === 'inactive') continue
    const age = daysBetween(s.created_at, today)
    const uploadedTypes = obDocsByStaff.get(s.id) ?? []
    const hasDocs   = mandatoryTypes.every((t) => uploadedTypes.includes(t))
    const hasBasics = Boolean(s.first_name && s.last_name && s.address_line_1)
    if (!hasDocs) missingDocs++
    if (!s.dbs_checked || !s.right_to_work_checked) missingCompliance++
    if (!hasBasics && age < 2) notStarted++
    if (hasBasics && !hasDocs && age >= STALLED_DAYS) { stalledCount++; stalledDaysList.push(age) }
    else if (hasDocs && (!s.dbs_checked || !s.right_to_work_checked) && age >= STALLED_DAYS) { stalledCount++; stalledDaysList.push(age) }
    else if (hasDocs && s.dbs_checked && s.right_to_work_checked && age >= STALLED_DAYS) awaitingReview++
  }

  const onboarding: OnboardingBottlenecks = {
    stalledCount, missingDocs, missingCompliance, pendingApprovals: pendingCerts,
    notStarted, awaitingReview,
    avgStalledDays: stalledDaysList.length > 0
      ? Math.round(stalledDaysList.reduce((a, b) => a + b, 0) / stalledDaysList.length)
      : null,
  }

  const staffExpiringIn14d = new Set<string>()
  const staffExpiringIn30d = new Set<string>()
  for (const d of allDocs) {
    if (!d.expiry_date) continue
    const du = daysBetween(today, d.expiry_date)
    if (du >= 0 && du <= 14) staffExpiringIn14d.add(d.staff_profile_id)
    if (du >= 0 && du <= 30) staffExpiringIn30d.add(d.staff_profile_id)
  }

  const expiryByRole = new Map<string, number>()
  for (const d of allDocs) {
    if (!d.expiry_date) continue
    const du = daysBetween(today, d.expiry_date)
    if (du < 0 || du > 30) continue
    const sm = allStaff.find((s) => s.id === d.staff_profile_id)
    if (!sm) continue
    const r = sm.job_role ?? 'Unspecified'
    expiryByRole.set(r, (expiryByRole.get(r) ?? 0) + 1)
  }

  const feed = generateOperationalFeed({
    deployable: summary.deployable, atRisk: summary.deployable_with_risk,
    nonDeployable: summary.non_deployable, onboardingIncomplete: summary.onboarding_incomplete,
    uncoveredNext14d: uncoveredShifts.length,
    expiringIn14d: staffExpiringIn14d.size, expiringIn30d: staffExpiringIn30d.size,
    stalledInOnboarding: stalledCount, pendingCertApprovals: pendingCerts, missingReferences: 0,
    roleShortages: byRole.filter((r) => r.total >= 2).map((r) => ({ role: r.role, deployable: r.deployable, threshold: 2 })),
    expiryClustersByRole: Array.from(expiryByRole.entries()).map(([role, c]) => ({ role, count: c, days: 30 })),
  })

  const data: CapacityResponse = {
    summary,
    staff:    staffRows.sort((a, b) => a.deployabilityScore - b.deployabilityScore),
    byRole,
    expiryCluster,
    coverage: { uncoveredNext14d: uncoveredShifts.length, understaffedDays },
    onboarding,
    feed,
    asOf: new Date().toISOString(),
  }

  return <WorkforceCapacityClient initial={data} />
}
