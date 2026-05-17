import { NextResponse }            from 'next/server'
import { adminClient }             from '@/lib/supabase/admin'
import { requireAdmin }            from '@/lib/auth/requireAdmin'
import { can }                     from '@/lib/auth/permissions'
import { forbidden }               from '@/lib/auth/responses'
import { buildComplianceSnapshot } from '@/lib/compliance/buildComplianceSnapshot'
import { getExpiryBand }           from '@/lib/compliance/expiryBands'
import { staffRiskScore, staffRiskLevel, calculateOrgRisk } from '@/lib/compliance/riskScore'
import { getEscalationLevel, daysNonCompliant } from '@/lib/compliance/escalation'
import type { ComplianceDocument }  from '@/lib/compliance/calculateCompliance'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RiskStaffRow {
  staffId:         string
  staffName:       string
  jobRole:         string | null
  status:          string
  complianceState: string
  percentage:      number
  riskScore:       number
  riskLevel:       string
  missingDocs:     string[]
  missingTraining: string[]
  escalationLevel: string
  nonCompliantDays: number
}

export interface RiskScoreResponse {
  orgHealthScore:  number   // 0-100 — higher is healthier
  orgRiskScore:    number   // 0-100 — higher is more risky
  orgRiskLevel:    string
  breakdown: {
    total:        number
    compliant:    number
    warning:      number
    nonCompliant: number
    blocked:      number
  }
  topRisk:         RiskStaffRow[]   // top 8 highest-risk staff
  lastUpdated:     string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sName(first: string | null, last: string | null, email: string | null): string {
  return [first, last].filter(Boolean).join(' ') || email || 'Unknown'
}

// ── GET /api/admin/compliance/risk-score ──────────────────────────────────────
//
// Returns org-wide risk score and top-risk staff.
// Used by the compliance dashboard for the risk overview section.

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'compliance:read')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  // Fetch all active staff
  const { data: staff, error: staffErr } = await adminClient
    .from('staff_profiles')
    .select('id, first_name, last_name, email, job_role, status, applicant_id, non_compliant_since')
    .eq('company_id', companyId)
    .in('status', ['active', 'pre_employment'])
    .order('first_name', { ascending: true })

  if (staffErr || !staff) {
    return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 })
  }

  if (staff.length === 0) {
    const empty: RiskScoreResponse = {
      orgHealthScore: 100,
      orgRiskScore:   0,
      orgRiskLevel:   'low',
      breakdown: { total: 0, compliant: 0, warning: 0, nonCompliant: 0, blocked: 0 },
      topRisk:    [],
      lastUpdated: new Date().toISOString(),
    }
    return NextResponse.json(empty)
  }

  const staffIds     = staff.map((s) => s.id)
  const applicantIds = staff.map((s) => s.applicant_id).filter((id): id is string => id !== null)

  // Batch-fetch documents
  const [sDocs, aDocs] = await Promise.all([
    adminClient
      .from('documents')
      .select('id, document_type, file_name, expiry_date, training_category, reviewed_status, issue_date, staff_profile_id')
      .in('staff_profile_id', staffIds),
    applicantIds.length > 0
      ? adminClient
          .from('documents')
          .select('id, document_type, file_name, expiry_date, training_category, reviewed_status, issue_date, applicant_id')
          .in('applicant_id', applicantIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  const docsByStaff: Record<string, ComplianceDocument[]> = {}
  for (const d of (sDocs.data ?? []) as Array<ComplianceDocument & { staff_profile_id: string }>) {
    if (!docsByStaff[d.staff_profile_id]) docsByStaff[d.staff_profile_id] = []
    docsByStaff[d.staff_profile_id].push(d)
  }
  const docsByApplicant: Record<string, ComplianceDocument[]> = {}
  for (const d of (aDocs.data ?? []) as Array<ComplianceDocument & { applicant_id: string }>) {
    if (!docsByApplicant[d.applicant_id]) docsByApplicant[d.applicant_id] = []
    docsByApplicant[d.applicant_id].push(d)
  }

  // Build per-staff compliance + risk rows
  const allRows: RiskStaffRow[] = []

  for (const s of staff) {
    const seen = new Set<string>()
    const docs: ComplianceDocument[] = []
    for (const d of docsByStaff[s.id] ?? []) {
      if (!seen.has(d.id)) { seen.add(d.id); docs.push(d) }
    }
    if (s.applicant_id) {
      for (const d of docsByApplicant[s.applicant_id] ?? []) {
        if (!seen.has(d.id)) { seen.add(d.id); docs.push(d) }
      }
    }

    const snap = buildComplianceSnapshot(docs, (s as { job_role?: string | null }).job_role ?? null)
    const { state, percentage, missingDocuments, missingTraining } = snap

    const expiringSoonItems = docs
      .filter((d) => d.expiry_date)
      .map((d) => ({ type: d.document_type, expiryDate: d.expiry_date!, band: getExpiryBand(d.expiry_date!) }))
      .filter((e) => e.band !== 'ok')

    const rScore        = staffRiskScore(state, missingDocuments, missingTraining, expiringSoonItems)
    const rLevel        = staffRiskLevel(rScore)
    const nonCompliantSince = (s as { non_compliant_since?: string | null }).non_compliant_since ?? null
    const days          = daysNonCompliant(nonCompliantSince)
    const escalation    = getEscalationLevel(days)

    allRows.push({
      staffId:          s.id,
      staffName:        sName(s.first_name, s.last_name, s.email),
      jobRole:          (s as { job_role?: string | null }).job_role ?? null,
      status:           s.status,
      complianceState:  state,
      percentage,
      riskScore:        rScore,
      riskLevel:        rLevel,
      missingDocs:      missingDocuments,
      missingTraining,
      escalationLevel:  escalation,
      nonCompliantDays: days,
    })
  }

  // Org-wide risk
  const orgRisk = calculateOrgRisk(
    allRows.map((r) => ({
      complianceState: r.complianceState as Parameters<typeof calculateOrgRisk>[0][number]['complianceState'],
      percentage:      r.percentage,
      missingDocs:     r.missingDocs,
      missingTraining: r.missingTraining,
      expiringSoon:    [],
    }))
  )

  // Top 8 highest risk
  const topRisk = [...allRows]
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 8)

  return NextResponse.json({
    orgHealthScore:  orgRisk.score,
    orgRiskScore:    orgRisk.riskScore,
    orgRiskLevel:    orgRisk.level,
    breakdown:       orgRisk.breakdown,
    topRisk,
    lastUpdated:     new Date().toISOString(),
  } satisfies RiskScoreResponse)
}
