import { requireAdmin }             from '@/lib/auth/requireAdmin'
import { adminClient }             from '@/lib/supabase/admin'
import { calculateWorkerReadiness } from '@/lib/onboarding/readiness'
import { getComplianceRiskForecast } from '@/lib/onboarding/expiryScheduler'
import OnboardingPipelineClient    from './OnboardingPipelineClient'
import Link from 'next/link'
import type {
  ReadinessStaffInput,
  ReadinessDocumentInput,
  WorkerReadinessStage,
} from '@/lib/onboarding/readiness'

export const dynamic = 'force-dynamic'

export interface PipelineRow {
  id:         string
  name:       string
  jobRole:    string | null
  status:     string
  createdAt:  string
  startDate:  string | null
  stage:      WorkerReadinessStage
  score:      number
  onboardingProgress:   number
  verificationProgress: number
  compliancePercentage: number
  pendingVerificationCount: number
  rejectedCount:        number
  criticalExpiryCount:  number
  blockers:   string[]
  warnings:   string[]
}

export interface PipelineSummary {
  total:               number
  byStage:             Record<WorkerReadinessStage, number>
  deploymentReady:     number
  blocked:             number
  verificationPending: number
  criticalExpiry:      number
  avgScore:            number
}

export default async function OnboardingPipelinePage() {
  const auth = await requireAdmin()
  if (!auth.ok) return null

  const { companyId } = auth.ctx

  // Fetch all active + pre-employment staff
  const { data: staffList } = await adminClient
    .from('staff_profiles')
    .select(`
      id, first_name, last_name, job_role, status, employment_type,
      date_of_birth, address_line_1, city, postcode,
      emergency_contact_name, emergency_contact_phone,
      ni_number, starter_declaration, bank_account_number,
      bank_sort_code, bank_account_name,
      right_to_work_checked, dbs_checked, policy_acknowledged,
      non_compliant_since, applicant_id, created_at, start_date
    `)
    .eq('company_id', companyId)
    .in('status', ['active', 'pre_employment'])
    .order('created_at', { ascending: false })
    .limit(150)

  const rows: PipelineRow[] = []

  for (const sp of staffList ?? []) {
    const conditions = [`staff_profile_id.eq.${sp.id}`]
    if (sp.applicant_id) conditions.push(`applicant_id.eq.${sp.applicant_id}`)

    const { data: docs } = await adminClient
      .from('documents')
      .select('id, document_type, file_name, expiry_date, issue_date, training_category, reviewed_status, verification_status')
      .eq('company_id', companyId)
      .is('archived_at', null)
      .or(conditions.join(','))

    const documents: ReadinessDocumentInput[] = (docs ?? []).map((d) => ({
      id: d.id, document_type: d.document_type, file_name: d.file_name,
      expiry_date: d.expiry_date, issue_date: d.issue_date,
      training_category: d.training_category, reviewed_status: d.reviewed_status,
      verification_status: d.verification_status,
    }))

    const staffInput: ReadinessStaffInput = {
      id: sp.id, status: sp.status, job_role: sp.job_role,
      employment_type: sp.employment_type, date_of_birth: sp.date_of_birth,
      address_line_1: sp.address_line_1, city: sp.city, postcode: sp.postcode,
      emergency_contact_name: sp.emergency_contact_name,
      emergency_contact_phone: sp.emergency_contact_phone,
      ni_number: sp.ni_number, starter_declaration: sp.starter_declaration,
      bank_account_number: sp.bank_account_number, bank_sort_code: sp.bank_sort_code,
      bank_account_name: sp.bank_account_name,
      right_to_work_checked: sp.right_to_work_checked, dbs_checked: sp.dbs_checked,
      policy_acknowledged: sp.policy_acknowledged, non_compliant_since: sp.non_compliant_since,
    }

    const readiness = calculateWorkerReadiness({
      staff: staffInput, documents,
      availability: { hasAvailability: true, maxWeeklyHours: null, workAreas: [] },
    })

    rows.push({
      id:         sp.id,
      name:       [sp.first_name, sp.last_name].filter(Boolean).join(' ') || sp.id,
      jobRole:    sp.job_role,
      status:     sp.status,
      createdAt:  sp.created_at,
      startDate:  sp.start_date,
      stage:      readiness.stage,
      score:      readiness.deployabilityScore,
      onboardingProgress:      readiness.onboardingProgress,
      verificationProgress:    readiness.verificationProgress,
      compliancePercentage:    readiness.compliancePercentage,
      pendingVerificationCount: readiness.pendingVerificationCount,
      rejectedCount:           readiness.rejectedCount,
      criticalExpiryCount:     readiness.criticalExpiryCount,
      blockers:    readiness.blockers.slice(0, 2),
      warnings:    readiness.warnings.slice(0, 2),
    })
  }

  // Summary
  const byStage = {} as Record<WorkerReadinessStage, number>
  for (const row of rows) byStage[row.stage] = (byStage[row.stage] ?? 0) + 1
  const summary: PipelineSummary = {
    total:               rows.length,
    byStage,
    deploymentReady:     byStage['ready_for_deployment'] ?? 0,
    blocked:             byStage['blocked'] ?? 0,
    verificationPending: byStage['verification_pending'] ?? 0,
    criticalExpiry:      rows.reduce((s, r) => s + r.criticalExpiryCount, 0),
    avgScore:            rows.length > 0
      ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length)
      : 0,
  }

  const riskForecast = await getComplianceRiskForecast(companyId, 30)

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Onboarding & Readiness Pipeline</h1>
          <p className="text-sm text-gray-500 mt-1">
            Deployment readiness across all active and pre-employment staff.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/documents/verification"
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 bg-surface-container-lowest border border-gray-200 rounded-lg px-3 py-1.5 transition-colors">
            <span className="material-symbols-outlined text-[13px]">fact_check</span>
            Verification queue
          </Link>
          <Link href="/admin/onboarding"
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors">
            <span className="material-symbols-outlined text-[13px]">arrow_back</span>
            Onboarding queue
          </Link>
        </div>
      </div>

      <OnboardingPipelineClient rows={rows} summary={summary} riskForecast={riskForecast} />
    </div>
  )
}
