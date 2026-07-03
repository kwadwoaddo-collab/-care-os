// lib/onboarding/readiness.ts
//
// Unified worker lifecycle readiness engine.
//
// This is the SINGLE SOURCE OF TRUTH for:
//   - deployment readiness
//   - onboarding readiness
//   - compliance eligibility
//   - workforce readiness
//   - operational staffing intelligence
//
// Do NOT duplicate readiness logic elsewhere. Call this function and
// use its output. The sub-engines (calculateCompliance, classifyDeployability,
// calculateOnboardingStatus) remain as pure computational primitives;
// this module is the coordinator that assembles the authoritative view.

import { calculateCompliance, type ComplianceDocument } from '@/lib/compliance/calculateCompliance'
import { calculateOnboardingStatus, type OnboardingInput } from '@/lib/staff/calculateOnboardingStatus'
import { classifyDeployability }                          from '@/lib/workforce/readinessEngine'
import { calculateDeployabilityScore }                    from '@/lib/workforce/deployabilityScore'
import { getRequiredDocuments }                           from '@/lib/staff/getRequiredDocuments'
import { EXPIRY_WARN_DAYS }                               from '@/lib/compliance/requirements'

// ── Stage taxonomy ────────────────────────────────────────────────────────────
//
// Ordered from most-blocked to most-ready. The engine resolves to the
// highest applicable stage (most blocked wins).

export type WorkerReadinessStage =
  | 'blocked'               // suspended, terminated, or critical rejection
  | 'onboarding_not_started' // profile exists, nothing done
  | 'documents_pending'      // required docs missing or all still pending
  | 'verification_pending'   // docs uploaded, awaiting verify/approve
  | 'compliance_pending'     // docs approved, compliance calculation not passing
  | 'ready_for_shadowing'    // compliance passing, onboarding complete — supervised work
  | 'ready_for_deployment'   // fully clear — can be assigned independently

export const READINESS_STAGE_LABEL: Record<WorkerReadinessStage, string> = {
  blocked:               'Blocked',
  onboarding_not_started: 'Not started',
  documents_pending:     'Documents pending',
  verification_pending:  'Verification pending',
  compliance_pending:    'Compliance pending',
  ready_for_shadowing:   'Ready for shadowing',
  ready_for_deployment:  'Deployment ready',
}

export const READINESS_STAGE_CLS: Record<WorkerReadinessStage, string> = {
  blocked:               'bg-red-100   text-red-800   ring-red-600/20',
  onboarding_not_started: 'bg-gray-100 text-gray-600  ring-gray-400/20',
  documents_pending:     'bg-amber-100 text-amber-800  ring-amber-600/20',
  verification_pending:  'bg-blue-100  text-blue-800   ring-blue-600/20',
  compliance_pending:    'bg-orange-100 text-orange-800 ring-orange-600/20',
  ready_for_shadowing:   'bg-teal-100  text-teal-800   ring-teal-600/20',
  ready_for_deployment:  'bg-green-100 text-green-800  ring-green-600/20',
}

export const READINESS_STAGE_ICON: Record<WorkerReadinessStage, string> = {
  blocked:               'block',
  onboarding_not_started: 'pending',
  documents_pending:     'upload_file',
  verification_pending:  'hourglass_empty',
  compliance_pending:    'pending_actions',
  ready_for_shadowing:   'supervised_user_circle',
  ready_for_deployment:  'verified',
}

// ── Input types ───────────────────────────────────────────────────────────────

export interface ReadinessDocumentInput {
  id:                  string
  document_type:       string
  expiry_date:         string | null
  issue_date:          string | null
  training_category:   string | null
  reviewed_status:     string | null
  verification_status: string | null
  file_name:           string
}

export interface ReadinessStaffInput {
  id:                    string
  status:                string
  job_role:              string | null
  employment_type:       string | null
  visa_sponsored?:       boolean
  onboarding_completed?: boolean | null
  dbs_checked?:          boolean | null
  right_to_work_checked?: boolean | null
  // Onboarding fields
  date_of_birth?:        string | null
  address_line_1?:       string | null
  city?:                 string | null
  postcode?:             string | null
  emergency_contact_name?:  string | null
  emergency_contact_phone?: string | null
  ni_number?:            string | null
  employment_type_set?:  boolean
  starter_declaration?:  string | null
  bank_account_number?:  string | null
  bank_sort_code?:       string | null
  bank_account_name?:    string | null
  right_to_work_checked_bool?: boolean | null
  dbs_checked_bool?:     boolean | null
  policy_acknowledged?:  boolean | null
  non_compliant_since?:  string | null
}

export interface ReadinessAvailabilityInput {
  hasAvailability: boolean
  maxWeeklyHours:  number | null
  workAreas:       string[]
}

// ── Output types ──────────────────────────────────────────────────────────────

export interface DocumentGap {
  type:      string
  label:     string
  reason:    'missing' | 'expired' | 'rejected' | 'pending_verification' | 'verified_not_approved' | 'needs_original_seen'
  urgent:    boolean
}

export interface ExpiryAlert {
  documentType:  string
  fileName:      string
  expiryDate:    string
  daysRemaining: number
  reminderBand:  90 | 60 | 30 | 14 | 7 | 1
}

export interface WorkerReadiness {
  // Core stage (single source of truth for deployment/readiness state)
  stage:              WorkerReadinessStage
  deployabilityState: string   // from classifyDeployability — for backward compat
  deployabilityScore: number   // 0–100

  // Percentages
  onboardingProgress:      number  // 0–100
  verificationProgress:    number  // 0–100 (approved docs / required docs)
  compliancePercentage:    number  // 0–100 from compliance engine

  // Document gaps (prioritised by urgency)
  documentGaps:        DocumentGap[]
  missingDocuments:    string[]   // from compliance engine
  expiredDocuments:    string[]   // from compliance engine
  expiringSoon:        string[]   // from compliance engine

  // Verification layer
  pendingVerificationCount:   number
  rejectedCount:              number
  needsOriginalSeenCount:     number
  verificationComplete:       boolean

  // Expiry intelligence
  expiryAlerts:        ExpiryAlert[]
  criticalExpiryCount: number   // expiring within 30 days

  // Blockers and warnings (actionable, ordered by priority)
  blockers:   string[]
  warnings:   string[]

  // Onboarding section completeness
  onboardingSections: Record<string, boolean>
  onboardingStage:    string

  // Staffing intelligence
  isDeployable:         boolean
  isComplianceEligible: boolean
  isShadowingReady:     boolean

  // Timestamps for analytics
  lastAssessed: string
}

// ── Identity-sensitive document types ─────────────────────────────────────────
// These require original_seen before they can be fully compliance-approved.

const IDENTITY_DOCS = new Set([
  'passport', 'brp', 'visa', 'right_to_work',
  'share_code', 'share_code_confirmation', 'id',
])

// ── Helpers ───────────────────────────────────────────────────────────────────

function isExpired(iso: string | null): boolean {
  return !!iso && new Date(iso) < new Date()
}

function isExpiringSoon(iso: string | null, days = EXPIRY_WARN_DAYS): boolean {
  if (!iso) return false
  const e = new Date(iso); const w = new Date()
  w.setDate(w.getDate() + days)
  return e > new Date() && e <= w
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
}

function reminderBand(days: number): 90 | 60 | 30 | 14 | 7 | 1 {
  if (days <= 1)  return 1
  if (days <= 7)  return 7
  if (days <= 14) return 14
  if (days <= 30) return 30
  if (days <= 60) return 60
  return 90
}

function isDocApproved(d: ReadinessDocumentInput): boolean {
  if (d.verification_status) return d.verification_status === 'approved'
  return d.reviewed_status === 'approved'
}

// ── Verification progress calculator ─────────────────────────────────────────

function calculateVerificationProgress(
  documents:     ReadinessDocumentInput[],
  requiredTypes: string[],
): number {
  if (requiredTypes.length === 0) return 100
  const approvedTypes = new Set(
    documents
      .filter(isDocApproved)
      .map((d) => d.document_type)
  )
  // Passport satisfies passport + right_to_work + id
  if (approvedTypes.has('passport')) {
    approvedTypes.add('right_to_work')
    approvedTypes.add('id')
  }
  const satisfied = requiredTypes.filter((t) => approvedTypes.has(t)).length
  return Math.round((satisfied / requiredTypes.length) * 100)
}

// ── Document gap detector ─────────────────────────────────────────────────────

function detectDocumentGaps(
  documents:     ReadinessDocumentInput[],
  requiredTypes: string[],
  _jobRole:       string | null,
): DocumentGap[] {
  const gaps: DocumentGap[] = []
  const docsByType = new Map<string, ReadinessDocumentInput[]>()

  for (const doc of documents) {
    const list = docsByType.get(doc.document_type) ?? []
    list.push(doc)
    docsByType.set(doc.document_type, list)
  }

  // Passport satisfies multiple types
  const passportDocs = docsByType.get('passport') ?? []
  const hasApprovedPassport = passportDocs.some(isDocApproved)

  for (const docType of requiredTypes) {
    const docs = docsByType.get(docType) ?? []

    // Passport covers RTW and ID
    if ((docType === 'right_to_work' || docType === 'id') && hasApprovedPassport) {
      continue
    }

    if (docs.length === 0) {
      gaps.push({ type: docType, label: docType.replace(/_/g, ' '), reason: 'missing', urgent: true })
      continue
    }

    // Find the best (most recent approved/verified) doc
    const best = docs.sort((a, b) => (b.expiry_date ?? '').localeCompare(a.expiry_date ?? ''))[0]

    if (best.verification_status === 'rejected' || best.reviewed_status === 'rejected') {
      gaps.push({ type: docType, label: docType.replace(/_/g, ' '), reason: 'rejected', urgent: true })
    } else if (best.verification_status === 'verified') {
      gaps.push({ type: docType, label: docType.replace(/_/g, ' '), reason: 'verified_not_approved', urgent: false })
    } else if (best.verification_status === 'pending_verification' || (!best.verification_status && best.reviewed_status === 'pending')) {
      gaps.push({ type: docType, label: docType.replace(/_/g, ' '), reason: 'pending_verification', urgent: false })
    } else if (isDocApproved(best)) {
      if (isExpired(best.expiry_date)) {
        gaps.push({ type: docType, label: docType.replace(/_/g, ' '), reason: 'expired', urgent: true })
      }
      // Approved and not expired — no gap
    }
  }

  return gaps
}

// ── Expiry alerts ─────────────────────────────────────────────────────────────

function buildExpiryAlerts(documents: ReadinessDocumentInput[]): ExpiryAlert[] {
  const alerts: ExpiryAlert[] = []

  for (const doc of documents) {
    if (!doc.expiry_date) continue
    if (isExpired(doc.expiry_date)) continue
    if (!isExpiringSoon(doc.expiry_date, 90)) continue

    const days = daysUntil(doc.expiry_date)
    alerts.push({
      documentType:  doc.document_type,
      fileName:      doc.file_name,
      expiryDate:    doc.expiry_date,
      daysRemaining: days,
      reminderBand:  reminderBand(days),
    })
  }

  return alerts.sort((a, b) => a.daysRemaining - b.daysRemaining)
}

// ── Stage resolver ────────────────────────────────────────────────────────────

function resolveStage(opts: {
  staffStatus:           string
  rejectedCount:         number
  onboardingProgress:    number
  onboardingStage:       string
  pendingVerificationCount: number
  complianceState:       string
  compliancePercentage:  number
  deployabilityState:    string
  documentGaps:          DocumentGap[]
}): WorkerReadinessStage {
  const { staffStatus, rejectedCount, onboardingProgress, onboardingStage,
    pendingVerificationCount, complianceState, deployabilityState } = opts

  // Blocked: status-level blocks
  if (staffStatus === 'terminated' || staffStatus === 'inactive' || staffStatus === 'suspended') {
    return 'blocked'
  }

  // Blocked: rejected documents that haven't been replaced
  if (rejectedCount > 0) return 'blocked'

  // Onboarding not started
  if (onboardingProgress === 0 || onboardingStage === 'not_started') {
    return 'onboarding_not_started'
  }

  // Documents pending: missing required docs (not yet uploaded)
  const missingDocs = opts.documentGaps.filter((g) => g.reason === 'missing' || g.reason === 'expired')
  if (missingDocs.length > 0) return 'documents_pending'

  // Verification pending: docs uploaded but not yet approved
  if (pendingVerificationCount > 0) return 'verification_pending'

  // Compliance pending: docs approved but compliance calculation not passing
  if (complianceState === 'non_compliant' || complianceState === 'blocked') {
    return 'compliance_pending'
  }

  // At this point compliance passes — evaluate deployment readiness
  if (deployabilityState === 'deployable') return 'ready_for_deployment'

  // warning or deployable_with_risk → shadowing ready
  if (deployabilityState === 'deployable_with_risk') return 'ready_for_shadowing'

  // onboarding_incomplete (from classifyDeployability)
  if (deployabilityState === 'onboarding_incomplete') return 'documents_pending'

  // non_deployable but compliance-ish → shadowing
  if (deployabilityState === 'non_deployable') return 'compliance_pending'

  return 'documents_pending'
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────

export function calculateWorkerReadiness(opts: {
  staff:        ReadinessStaffInput
  documents:    ReadinessDocumentInput[]
  availability: ReadinessAvailabilityInput
}): WorkerReadiness {
  const { staff, documents, availability } = opts

  // ── 1. Compliance engine (existing) ─────────────────────────────────────────
  const complianceDocs: ComplianceDocument[] = documents.map((d) => ({
    id:                 d.id,
    document_type:      d.document_type,
    file_name:          d.file_name,
    expiry_date:        d.expiry_date,
    training_category:  d.training_category,
    reviewed_status:    d.reviewed_status,
    verification_status: d.verification_status,
    issue_date:         d.issue_date,
  }))

  const compliance = calculateCompliance(complianceDocs, staff.job_role ?? null)

  // ── 2. Onboarding status (existing) ─────────────────────────────────────────
  const onboardingInput: OnboardingInput = {
    first_name:            staff.id ? 'set' : null,  // presence is enough for name gate
    date_of_birth:         staff.date_of_birth,
    address_line_1:        staff.address_line_1,
    city:                  staff.city,
    postcode:              staff.postcode,
    emergency_contact_name:  staff.emergency_contact_name,
    emergency_contact_phone: staff.emergency_contact_phone,
    ni_number:             staff.ni_number,
    employment_type:       staff.employment_type,
    starter_declaration:   staff.starter_declaration,
    bank_account_number:   staff.bank_account_number,
    bank_sort_code:        staff.bank_sort_code,
    bank_account_name:     staff.bank_account_name,
    right_to_work_checked: staff.right_to_work_checked ?? staff.right_to_work_checked_bool,
    dbs_checked:           staff.dbs_checked ?? staff.dbs_checked_bool,
    policy_acknowledged:   staff.policy_acknowledged,
    status:                staff.status,
    uploadedDocumentTypes: documents.map((d) => d.document_type),
    approvedTrainingCategories: documents
      .filter(isDocApproved)
      .map((d) => d.training_category)
      .filter((c): c is string => !!c),
    job_role: staff.job_role,
  }

  const onboarding = calculateOnboardingStatus(onboardingInput)

  // ── 3. Required documents for this role ─────────────────────────────────────
  const requiredDocList = getRequiredDocuments({
    employment_type:  staff.employment_type,
    visa_sponsored:   staff.visa_sponsored ?? false,
    job_role:         staff.job_role,
  })
  const requiredDocTypes = requiredDocList.filter((d) => d.mandatory).map((d) => d.type)

  // ── 4. Verification gap analysis ────────────────────────────────────────────
  const pendingDocs = documents.filter(
    (d) => d.verification_status === 'pending_verification' ||
           (!d.verification_status && d.reviewed_status === 'pending')
  )
  const rejectedDocs = documents.filter(
    (d) => d.verification_status === 'rejected' || d.reviewed_status === 'rejected'
  )
  const needsOriginalSeen = documents.filter(
    (d) => IDENTITY_DOCS.has(d.document_type) &&
           isDocApproved(d) &&
           // Would need original_seen field — check via extended type
           (d as unknown as { original_seen?: boolean }).original_seen === false
  )

  const pendingVerificationCount = pendingDocs.length
  const rejectedCount            = rejectedDocs.length
  const needsOriginalSeenCount   = needsOriginalSeen.length

  const verificationProgress = calculateVerificationProgress(documents, requiredDocTypes)
  const verificationComplete = verificationProgress === 100 && pendingVerificationCount === 0

  // ── 5. Document gaps ─────────────────────────────────────────────────────────
  const documentGaps = detectDocumentGaps(documents, requiredDocTypes, staff.job_role)

  // ── 6. Expiry alerts ─────────────────────────────────────────────────────────
  const expiryAlerts    = buildExpiryAlerts(documents)
  const criticalExpiry  = expiryAlerts.filter((a) => a.daysRemaining <= 30).length

  // ── 7. Deployability (existing engine) ───────────────────────────────────────
  const deployResult = classifyDeployability({
    status:             staff.status,
    onboardingComplete: onboarding.ready,
    complianceState:    compliance.complianceState,
    compliancePercent:  compliance.percentage,
    dbsChecked:         !!(staff.dbs_checked ?? staff.dbs_checked_bool),
    rtwChecked:         !!(staff.right_to_work_checked ?? staff.right_to_work_checked_bool),
    hasAvailability:    availability.hasAvailability,
  })

  const deployScore = calculateDeployabilityScore({
    status:             staff.status,
    compliancePercent:  compliance.percentage,
    onboardingProgress: onboarding.progress,
    onboardingComplete: onboarding.ready,
    dbsChecked:         !!(staff.dbs_checked ?? staff.dbs_checked_bool),
    rtwChecked:         !!(staff.right_to_work_checked ?? staff.right_to_work_checked_bool),
    hasAvailability:    availability.hasAvailability,
    openIncidents:      0,
    expiringSoonCount:  expiryAlerts.filter((a) => a.daysRemaining <= 14).length,
    declinedLast30Days: 0,
  })

  // ── 8. Resolve unified stage ─────────────────────────────────────────────────
  const stage = resolveStage({
    staffStatus:              staff.status,
    rejectedCount,
    onboardingProgress:       onboarding.progress,
    onboardingStage:          onboarding.stage,
    pendingVerificationCount,
    complianceState:          compliance.complianceState,
    compliancePercentage:     compliance.percentage,
    deployabilityState:       deployResult.state,
    documentGaps,
  })

  // ── 9. Build blockers / warnings ─────────────────────────────────────────────
  const blockers: string[] = []
  const warnings: string[] = []

  // Merge from deployability engine (already authoritative for status-level blocks)
  blockers.push(...deployResult.blockers)

  // Verification gaps
  if (rejectedCount > 0)            blockers.push(`${rejectedCount} document${rejectedCount > 1 ? 's' : ''} rejected — resubmission required`)
  if (pendingVerificationCount > 0) warnings.push(`${pendingVerificationCount} document${pendingVerificationCount > 1 ? 's' : ''} awaiting verification`)
  if (needsOriginalSeenCount > 0)   warnings.push(`${needsOriginalSeenCount} identity document${needsOriginalSeenCount > 1 ? 's' : ''} require original seen confirmation`)

  // Compliance
  if (compliance.missingDocuments.length > 0) {
    blockers.push(`Missing documents: ${compliance.missingDocuments.join(', ')}`)
  }
  if (compliance.expiredDocuments.length > 0) {
    blockers.push(`Expired documents: ${compliance.expiredDocuments.join(', ')}`)
  }
  if (compliance.missingTraining.length > 0) {
    blockers.push(`Missing training: ${compliance.missingTraining.join(', ')}`)
  }
  if (compliance.expiringSoon.length > 0) {
    warnings.push(`Expiring soon: ${compliance.expiringSoon.join(', ')}`)
  }

  // Expiry
  if (criticalExpiry > 0) {
    warnings.push(`${criticalExpiry} certification${criticalExpiry > 1 ? 's' : ''} expiring within 30 days`)
  }

  // Warnings from deployability
  warnings.push(...deployResult.warnings.filter((w) => !warnings.includes(w)))

  return {
    stage,
    deployabilityState:  deployResult.state,
    deployabilityScore:  deployScore,

    onboardingProgress:      onboarding.progress,
    verificationProgress,
    compliancePercentage:    compliance.percentage,

    documentGaps,
    missingDocuments:    compliance.missingDocuments,
    expiredDocuments:    compliance.expiredDocuments,
    expiringSoon:        compliance.expiringSoon,

    pendingVerificationCount,
    rejectedCount,
    needsOriginalSeenCount,
    verificationComplete,

    expiryAlerts,
    criticalExpiryCount: criticalExpiry,

    blockers,
    warnings,

    onboardingSections: onboarding.sections as unknown as Record<string, boolean>,
    onboardingStage:    onboarding.stage,

    isDeployable:         deployResult.state === 'deployable',
    isComplianceEligible: compliance.complianceState === 'compliant' || compliance.complianceState === 'warning',
    isShadowingReady:     stage === 'ready_for_shadowing' || stage === 'ready_for_deployment',

    lastAssessed: new Date().toISOString(),
  }
}

// ── Batch readiness for workforce dashboard ───────────────────────────────────

export interface StaffReadinessSummary {
  staffId:   string
  staffName: string
  jobRole:   string | null
  status:    string
  stage:     WorkerReadinessStage
  score:     number
  blockers:  string[]
  warnings:  string[]
}

export function summariseReadiness(
  staffId:   string,
  staffName: string,
  readiness: WorkerReadiness,
  jobRole:   string | null,
  status:    string,
): StaffReadinessSummary {
  return {
    staffId,
    staffName,
    jobRole,
    status,
    stage:    readiness.stage,
    score:    readiness.deployabilityScore,
    blockers: readiness.blockers.slice(0, 3),  // top 3 for dashboard
    warnings: readiness.warnings.slice(0, 3),
  }
}

// ── Stage ordering (for sort/comparison) ─────────────────────────────────────

const STAGE_ORDER: Record<WorkerReadinessStage, number> = {
  blocked:               0,
  onboarding_not_started: 1,
  documents_pending:     2,
  verification_pending:  3,
  compliance_pending:    4,
  ready_for_shadowing:   5,
  ready_for_deployment:  6,
}

export function compareStages(a: WorkerReadinessStage, b: WorkerReadinessStage): number {
  return STAGE_ORDER[a] - STAGE_ORDER[b]
}
