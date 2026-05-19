// lib/operations/orchestration.ts
//
// Unified Operational Intelligence Orchestration Engine
//
// Consumes signals from every Care OS intelligence system and produces
// one ranked, deduplicated, explainable priority stream for coordinators.
//
// Pure functions — no database access. The priorities API feeds this engine.

import type { QueueItem, QueuePriority } from './priorityQueue'

// ── Category taxonomy ─────────────────────────────────────────────────────────

export type PriorityCategory =
  | 'safeguarding'
  | 'compliance'
  | 'onboarding'
  | 'document_verification'
  | 'workforce_readiness'
  | 'shift_coverage'
  | 'visit_anomaly'
  | 'incident'
  | 'communication'
  | 'wellbeing'
  | 'queue_item'

export type PrioritySeverity = 'critical' | 'urgent' | 'warning' | 'informational'

export type PriorityStatus =
  | 'open'
  | 'acknowledged'
  | 'in_progress'
  | 'snoozed'
  | 'resolved'
  | 'escalated'
  | 'dismissed'

export type RecommendedAction =
  | 'assign_owner'
  | 'request_document'
  | 'approve_document'
  | 'schedule_replacement_worker'
  | 'escalate_safeguarding'
  | 'contact_worker'
  | 'resolve_queue_item'
  | 'review_client_risk'
  | 'trigger_communication'
  | 'renew_compliance'
  | 'review_incident'
  | 'complete_onboarding'
  | 'investigate_anomaly'

// ── Affected entity refs ──────────────────────────────────────────────────────

export interface AffectedWorker {
  id:     string
  name:   string
  role?:  string | null
  href?:  string
}

export interface AffectedClient {
  id:   string
  name: string
  href?: string
}

export interface AffectedShift {
  id:        string
  title:     string
  shiftDate: string
  href?:     string
}

export interface AffectedDocument {
  id:       string
  type:     string
  fileName: string
  href?:    string
}

// ── Explainability ────────────────────────────────────────────────────────────

export interface PriorityExplainability {
  why:          string   // why did this priority appear?
  triggeredBy:  string   // what data triggered it?
  consequence:  string   // what happens if ignored?
  action:       string   // what should be done?
}

// ── Operational impact ────────────────────────────────────────────────────────

export interface OperationalImpact {
  workerImpact?:      string
  clientImpact?:      string
  operationalImpact?: string
  complianceBreach?:  boolean
  safeguardingRisk?:  boolean
  shiftUncovered?:    boolean
}

// ── Scoring breakdown ─────────────────────────────────────────────────────────

export interface PriorityScoreBreakdown {
  safeguardingImpact: number   // 0-40
  clientSafetyImpact: number   // 0-30
  complianceImpact:   number   // 0-25
  staffingImpact:     number   // 0-20
  overdueFactor:      number   // 0-15
  escalationLevel:    number   // 0-10
  recurrenceFactor:   number   // 0-10
  urgencyFactor:      number   // 0-15
  total:              number   // 0-100 (normalised)
}

// ── Linked evidence ───────────────────────────────────────────────────────────

export interface LinkedEvidence {
  label:       string
  description: string
  href?:       string
  type:        'document' | 'incident' | 'compliance' | 'shift' | 'training' | 'queue'
}

// ── Unified priority item ─────────────────────────────────────────────────────

export interface UnifiedPriorityItem {
  id:             string
  priorityScore:  number             // 0-100
  severity:       PrioritySeverity
  category:       PriorityCategory
  title:          string
  description:    string

  // Affected entities (at most one of each)
  affectedWorker?:   AffectedWorker
  affectedClient?:   AffectedClient
  affectedShift?:    AffectedShift
  affectedDocument?: AffectedDocument

  // Recommended action
  recommendedAction:      RecommendedAction
  recommendedActionLabel: string
  actionHref?:            string

  // Timing
  dueDate?:   string   // ISO date
  overdueBy?: number   // days overdue (positive = overdue)
  createdAt:  string

  // Ownership (persisted in DB, merged at read time)
  owner?:        string
  ownerId?:      string
  status:        PriorityStatus
  snoozedUntil?: string
  acknowledgedBy?: string
  acknowledgedAt?: string

  // Source
  sourceSystem: string   // 'compliance' | 'incident' | 'shift' | etc.
  sourceId?:    string   // ID in the source system

  // Explainability
  explainability: PriorityExplainability

  // Impact
  impact: OperationalImpact

  // Score breakdown (for transparency)
  scoreBreakdown: PriorityScoreBreakdown

  // Deduplication / grouping
  groupKey?:     string    // items with same groupKey are grouped
  linkedItems?:  string[]  // IDs of related priority items
  isGroup?:      boolean   // this item represents a group
  groupedCount?: number    // number of items collapsed into this group
  evidence?:     LinkedEvidence[]  // supporting evidence for grouped items
}

// ── Input types ───────────────────────────────────────────────────────────────

export interface ComplianceRiskInput {
  staffId:        string
  staffName:      string
  jobRole:        string | null
  complianceState: 'compliant' | 'warning' | 'non_compliant' | 'blocked'
  missingDocuments: string[]
  expiredDocuments: string[]
  missingTraining:  string[]
  expiringSoon:     string[]
  riskScore:        number
  deployabilityState: string
  nonCompliantSince?: string | null
  hasActiveOverride?: boolean
}

export interface OnboardingReadinessInput {
  staffId:            string
  staffName:          string
  jobRole:            string | null
  stage:              string
  onboardingProgress: number
  blockers:           string[]
  daysSinceLastProgress?: number
  createdAt:          string
}

export interface DocumentVerificationInput {
  documentId:   string
  staffId:      string
  staffName:    string
  documentType: string
  fileName:     string
  uploadedAt:   string
  status:       string   // pending_verification | rejected | needs_original_seen
  daysWaiting:  number
}

export interface ShiftCoverageInput {
  shiftId:   string
  title:     string
  shiftDate: string
  startTime: string
  endTime:   string
  clientName: string | null
  daysUntil:  number   // negative = already started uncovered
}

export interface VisitAnomalyInput {
  visitId:       string
  anomalyType:   'missed_visit' | 'late_start' | 'early_departure' | 'no_check_in' | 'duration_anomaly'
  staffId?:      string
  staffName?:    string
  clientId?:     string
  clientName?:   string
  shiftId?:      string
  occurredAt:    string
  daysAgo:       number
  severity:      'low' | 'medium' | 'high'
}

export interface IncidentInput {
  incidentId:         string
  incidentType:       string
  severity:           string
  status:             string
  escalationRequired: boolean
  occurredAt:         string | null
  clientId?:          string
  clientName?:        string
  staffId?:           string
  staffName?:         string
  riskScore:          number | null
  daysOpen:           number
  repeatCount?:       number
}

export interface SafeguardingAlertInput {
  incidentId:  string
  description: string
  severity:    string
  status:      string
  occurredAt:  string | null
  clientName?: string
  staffName?:  string
  daysOpen:    number
  escalated:   boolean
}

export interface CommunicationInput {
  communicationId: string
  title:           string
  sentAt:          string
  targetType:      string
  unacknowledgedCount: number
  urgency:         'low' | 'medium' | 'high'
}

export interface WellbeingSignalInput {
  staffId:     string
  staffName:   string
  signalType:  'repeated_late' | 'declined_shifts' | 'missed_check_ins' | 'high_incident_rate'
  count:       number
  windowDays:  number
  lastOccurrence: string
}

export interface OrchestrationInput {
  complianceRisks:     ComplianceRiskInput[]
  onboardingReadiness: OnboardingReadinessInput[]
  documentBacklog:     DocumentVerificationInput[]
  shiftGaps:           ShiftCoverageInput[]
  visitAnomalies:      VisitAnomalyInput[]
  incidents:           IncidentInput[]
  safeguardingAlerts:  SafeguardingAlertInput[]
  communications:      CommunicationInput[]
  wellbeingSignals:    WellbeingSignalInput[]
  queueItems:          QueueItem[]
}

// ── DB-persisted state (merged at read time) ──────────────────────────────────

export interface PriorityStateOverride {
  priorityId:      string
  status:          PriorityStatus
  owner?:          string
  ownerId?:        string
  snoozedUntil?:   string
  acknowledgedBy?: string
  acknowledgedAt?: string
}

// ── Scoring engine ────────────────────────────────────────────────────────────

function scoreSafeguarding(input: {
  isSafeguarding:    boolean
  isEscalated:       boolean
  severity:          string
  repeatCount?:      number
}): number {
  if (!input.isSafeguarding) return 0
  let pts = 25
  if (input.severity === 'critical') pts += 10
  else if (input.severity === 'high') pts += 5
  if (input.isEscalated) pts += 5
  if ((input.repeatCount ?? 0) >= 2) pts += 5
  return Math.min(40, pts)
}

function scoreClientSafety(input: {
  hasClientImpact:   boolean
  incidentType?:     string
  severity?:         string
  missedCare?:       boolean
}): number {
  if (!input.hasClientImpact) return 0
  let pts = 10
  if (input.severity === 'critical') pts += 15
  else if (input.severity === 'high') pts += 10
  else if (input.severity === 'medium') pts += 5
  if (input.incidentType === 'safeguarding' || input.incidentType === 'medication_error') pts += 10
  if (input.missedCare) pts += 5
  return Math.min(30, pts)
}

function scoreCompliance(input: {
  complianceState?:  string
  missingCritical?:  boolean
  isExpired?:        boolean
  isMissingDbs?:     boolean
  isMissingRtw?:     boolean
}): number {
  let pts = 0
  switch (input.complianceState) {
    case 'blocked':      pts = 20; break
    case 'non_compliant': pts = 14; break
    case 'warning':      pts = 7;  break
  }
  if (input.isMissingDbs || input.isMissingRtw) pts += 5
  if (input.isExpired) pts += 3
  if (input.missingCritical) pts += 3
  return Math.min(25, pts)
}

function scoreStaffing(input: {
  workerBlocked?:    boolean
  shiftUncovered?:   boolean
  daysUntilShift?:   number
  onboardingStalled?: boolean
}): number {
  let pts = 0
  if (input.workerBlocked) pts += 10
  if (input.shiftUncovered) {
    pts += 10
    if ((input.daysUntilShift ?? 99) <= 2) pts += 10
    else if ((input.daysUntilShift ?? 99) <= 7) pts += 5
  }
  if (input.onboardingStalled) pts += 5
  return Math.min(20, pts)
}

function scoreOverdue(daysSinceCreated: number, dueDate?: string): number {
  if (!dueDate) return Math.min(10, Math.floor(daysSinceCreated / 3))
  const overdueDays = Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000)
  if (overdueDays <= 0) return 0
  return Math.min(15, overdueDays * 2)
}

function scoreEscalation(isEscalated: boolean, escalationLevel: number): number {
  if (!isEscalated) return 0
  return Math.min(10, 5 + escalationLevel * 2)
}

function scoreRecurrence(repeatCount: number): number {
  return Math.min(10, repeatCount * 3)
}

function scoreUrgency(input: {
  daysUntilShift?:   number
  daysWaiting?:      number
  severity?:         string
  isImminent?:       boolean
}): number {
  let pts = 0
  if (input.isImminent) pts += 10
  if ((input.daysUntilShift ?? 99) <= 1) pts += 10
  else if ((input.daysUntilShift ?? 99) <= 3) pts += 7
  if ((input.daysWaiting ?? 0) >= 7) pts += 5
  if (input.severity === 'critical') pts += 5
  return Math.min(15, pts)
}

function normalisedScore(breakdown: Omit<PriorityScoreBreakdown, 'total'>): PriorityScoreBreakdown {
  const raw = (
    breakdown.safeguardingImpact +
    breakdown.clientSafetyImpact +
    breakdown.complianceImpact +
    breakdown.staffingImpact +
    breakdown.overdueFactor +
    breakdown.escalationLevel +
    breakdown.recurrenceFactor +
    breakdown.urgencyFactor
  )
  // Max possible raw: 40+30+25+20+15+10+10+15 = 165
  const total = Math.round(Math.min(100, (raw / 165) * 100))
  return { ...breakdown, total }
}

function severityFromScore(score: number): PrioritySeverity {
  if (score >= 75) return 'critical'
  if (score >= 50) return 'urgent'
  if (score >= 25) return 'warning'
  return 'informational'
}

// ── ID generation ─────────────────────────────────────────────────────────────

function makeId(prefix: string, sourceId: string): string {
  return `${prefix}::${sourceId}`
}

// ── Individual signal converters ──────────────────────────────────────────────

function complianceRiskToPriority(input: ComplianceRiskInput): UnifiedPriorityItem {
  const isSafeguarding = input.missingDocuments.includes('dbs') || input.expiredDocuments.includes('dbs')
  const isMissingDbs   = input.missingDocuments.includes('dbs') || input.expiredDocuments.includes('dbs')
  const isMissingRtw   = input.missingDocuments.includes('right_to_work') || input.expiredDocuments.includes('right_to_work')
  const isBlocked      = input.complianceState === 'blocked' || input.complianceState === 'non_compliant'
  const daysSince      = input.nonCompliantSince
    ? Math.floor((Date.now() - new Date(input.nonCompliantSince).getTime()) / 86400000)
    : 0

  const breakdown: Omit<PriorityScoreBreakdown, 'total'> = {
    safeguardingImpact: isSafeguarding ? scoreSafeguarding({ isSafeguarding: true, isEscalated: false, severity: 'high' }) : 0,
    clientSafetyImpact: isBlocked ? scoreClientSafety({ hasClientImpact: true, severity: input.complianceState === 'blocked' ? 'high' : 'medium' }) : 0,
    complianceImpact:   scoreCompliance({ complianceState: input.complianceState, isMissingDbs, isMissingRtw }),
    staffingImpact:     scoreStaffing({ workerBlocked: isBlocked }),
    overdueFactor:      scoreOverdue(daysSince),
    escalationLevel:    0,
    recurrenceFactor:   0,
    urgencyFactor:      scoreUrgency({ severity: input.complianceState === 'blocked' ? 'critical' : 'high' }),
  }

  const score    = normalisedScore(breakdown)
  const severity = severityFromScore(score.total)

  const missingAll = [...input.missingDocuments, ...input.expiredDocuments, ...input.missingTraining]
  const primaryIssue = isMissingDbs ? 'expired DBS'
    : isMissingRtw ? 'missing Right to Work'
    : missingAll[0]?.replace(/_/g, ' ') ?? 'compliance documents'

  const groupKey = `compliance::worker::${input.staffId}`

  const title = input.complianceState === 'blocked'
    ? `${input.staffName} blocked from deployment — ${primaryIssue}`
    : input.complianceState === 'non_compliant'
    ? `${input.staffName} non-compliant — ${missingAll.length} issue${missingAll.length !== 1 ? 's' : ''}`
    : `${input.staffName} — compliance expiring soon`

  return {
    id:            makeId('compliance', input.staffId),
    priorityScore: score.total,
    severity,
    category:      'compliance',
    title,
    description:   buildComplianceDescription(input),
    affectedWorker: { id: input.staffId, name: input.staffName, role: input.jobRole, href: `/admin/staff/${input.staffId}` },
    recommendedAction:      isBlocked ? 'request_document' : 'renew_compliance',
    recommendedActionLabel: isBlocked ? 'Request missing documents' : 'Review expiring items',
    actionHref:             `/admin/staff/${input.staffId}`,
    createdAt:     input.nonCompliantSince ?? new Date().toISOString(),
    overdueBy:     daysSince > 0 ? daysSince : undefined,
    status:        'open',
    sourceSystem:  'compliance',
    sourceId:      input.staffId,
    explainability: {
      why:         `${input.staffName}'s compliance record is ${input.complianceState}. The system detected ${missingAll.length} unresolved issue${missingAll.length !== 1 ? 's' : ''}.`,
      triggeredBy: `Compliance engine: ${missingAll.join(', ') || 'expiring items'}`,
      consequence: isBlocked
        ? 'This worker cannot be assigned to any shifts until compliance is resolved. Client care may be at risk.'
        : 'Compliance will lapse within 30 days, blocking deployment. Act now to avoid a gap.',
      action:      isBlocked
        ? `Upload or renew the following: ${missingAll.slice(0, 3).join(', ')}. Then request admin re-review.`
        : `Arrange renewal for expiring items: ${input.expiringSoon.slice(0, 3).join(', ')}.`,
    },
    impact: {
      workerImpact:       isBlocked ? 'Worker cannot be deployed' : 'Worker at risk of becoming non-deployable',
      complianceBreach:   isBlocked,
      safeguardingRisk:   isSafeguarding,
    },
    scoreBreakdown: score,
    groupKey,
  }
}

function buildComplianceDescription(input: ComplianceRiskInput): string {
  const parts: string[] = []
  if (input.missingDocuments.length > 0) {
    parts.push(`Missing: ${input.missingDocuments.map(d => d.replace(/_/g, ' ')).join(', ')}`)
  }
  if (input.expiredDocuments.length > 0) {
    parts.push(`Expired: ${input.expiredDocuments.map(d => d.replace(/_/g, ' ')).join(', ')}`)
  }
  if (input.missingTraining.length > 0) {
    parts.push(`Training gaps: ${input.missingTraining.map(d => d.replace(/_/g, ' ')).join(', ')}`)
  }
  if (input.expiringSoon.length > 0) {
    parts.push(`Expiring soon: ${input.expiringSoon.map(d => d.replace(/_/g, ' ')).join(', ')}`)
  }
  return parts.join(' · ') || 'Compliance review required'
}

function onboardingToPriority(input: OnboardingReadinessInput): UnifiedPriorityItem {
  const isStalled = (input.daysSinceLastProgress ?? 0) >= 7
  const daysSince = Math.floor((Date.now() - new Date(input.createdAt).getTime()) / 86400000)

  const breakdown: Omit<PriorityScoreBreakdown, 'total'> = {
    safeguardingImpact: 0,
    clientSafetyImpact: 0,
    complianceImpact:   scoreCompliance({ complianceState: 'non_compliant' }),
    staffingImpact:     scoreStaffing({ onboardingStalled: isStalled }),
    overdueFactor:      isStalled ? scoreOverdue(input.daysSinceLastProgress ?? 0) : 0,
    escalationLevel:    0,
    recurrenceFactor:   0,
    urgencyFactor:      isStalled ? scoreUrgency({ daysWaiting: input.daysSinceLastProgress }) : 5,
  }

  const score    = normalisedScore(breakdown)
  const severity = isStalled ? 'warning' : 'informational'

  const title = isStalled
    ? `${input.staffName} — onboarding stalled for ${input.daysSinceLastProgress} days`
    : `${input.staffName} — onboarding in progress (${input.onboardingProgress}%)`

  return {
    id:            makeId('onboarding', input.staffId),
    priorityScore: score.total,
    severity,
    category:      'onboarding',
    title,
    description:   input.blockers.slice(0, 3).join(' · ') || `Stage: ${input.stage}`,
    affectedWorker: { id: input.staffId, name: input.staffName, role: input.jobRole, href: `/admin/staff/${input.staffId}` },
    recommendedAction:      'complete_onboarding',
    recommendedActionLabel: 'Review onboarding status',
    actionHref:             `/admin/staff/${input.staffId}`,
    createdAt:     input.createdAt,
    overdueBy:     isStalled ? (input.daysSinceLastProgress ?? 0) : undefined,
    status:        'open',
    sourceSystem:  'onboarding',
    sourceId:      input.staffId,
    explainability: {
      why:         `${input.staffName} has been in the "${input.stage}" stage${isStalled ? ` with no progress for ${input.daysSinceLastProgress} days` : ''}.`,
      triggeredBy: `Onboarding engine: stage=${input.stage}, progress=${input.onboardingProgress}%`,
      consequence: 'Worker cannot be deployed until onboarding is complete. Prolonged stalls increase drop-off risk.',
      action:      `Contact ${input.staffName} to resolve blockers: ${input.blockers.slice(0, 2).join('; ') || 'check outstanding items'}.`,
    },
    impact: {
      workerImpact:       'Worker cannot be assigned shifts until onboarding completes',
      operationalImpact:  'Reduces deployable workforce',
    },
    scoreBreakdown: score,
    groupKey: `onboarding::worker::${input.staffId}`,
  }
}

function documentVerificationToPriority(input: DocumentVerificationInput): UnifiedPriorityItem {
  const isCriticalDoc = ['dbs', 'right_to_work', 'passport'].includes(input.documentType)
  const isRejected    = input.status === 'rejected'

  const breakdown: Omit<PriorityScoreBreakdown, 'total'> = {
    safeguardingImpact: isCriticalDoc ? 15 : 0,
    clientSafetyImpact: 0,
    complianceImpact:   scoreCompliance({ missingCritical: isCriticalDoc }),
    staffingImpact:     isCriticalDoc ? 10 : 5,
    overdueFactor:      scoreOverdue(input.daysWaiting),
    escalationLevel:    0,
    recurrenceFactor:   isRejected ? scoreRecurrence(1) : 0,
    urgencyFactor:      scoreUrgency({ daysWaiting: input.daysWaiting }),
  }

  const score    = normalisedScore(breakdown)
  const severity = isRejected ? 'urgent' : isCriticalDoc && input.daysWaiting >= 3 ? 'warning' : 'informational'

  const title = isRejected
    ? `Document rejected — ${input.staffName} (${input.documentType.replace(/_/g, ' ')})`
    : `Document awaiting verification — ${input.staffName} (${input.documentType.replace(/_/g, ' ')})`

  return {
    id:            makeId('docver', input.documentId),
    priorityScore: score.total,
    severity,
    category:      'document_verification',
    title,
    description:   `${input.fileName} · Waiting ${input.daysWaiting} day${input.daysWaiting !== 1 ? 's' : ''}`,
    affectedWorker:   { id: input.staffId, name: input.staffName, href: `/admin/staff/${input.staffId}` },
    affectedDocument: { id: input.documentId, type: input.documentType, fileName: input.fileName, href: `/admin/documents/verification` },
    recommendedAction:      isRejected ? 'request_document' : 'approve_document',
    recommendedActionLabel: isRejected ? 'Notify worker to resubmit' : 'Review and approve document',
    actionHref:             `/admin/documents/verification`,
    createdAt:     input.uploadedAt,
    status:        'open',
    sourceSystem:  'document_verification',
    sourceId:      input.documentId,
    explainability: {
      why:         isRejected
        ? `${input.staffName}'s ${input.documentType.replace(/_/g, ' ')} was rejected during verification.`
        : `${input.staffName}'s ${input.documentType.replace(/_/g, ' ')} has been waiting ${input.daysWaiting} days for verification.`,
      triggeredBy: `Document verification queue — uploaded ${input.uploadedAt.slice(0, 10)}`,
      consequence: isRejected
        ? 'Worker cannot progress onboarding or achieve compliance until a valid replacement is submitted.'
        : `Verification backlog delays compliance approval${isCriticalDoc ? ' — this is a critical document' : ''}.`,
      action:      isRejected
        ? `Contact ${input.staffName} and request resubmission of their ${input.documentType.replace(/_/g, ' ')}.`
        : `Open the verification queue and review ${input.staffName}'s ${input.documentType.replace(/_/g, ' ')}.`,
    },
    impact: {
      workerImpact:     isRejected ? 'Onboarding blocked until replacement document submitted' : 'Compliance approval delayed',
      complianceBreach: isRejected && isCriticalDoc,
    },
    scoreBreakdown: score,
    groupKey: `docver::worker::${input.staffId}`,
  }
}

function shiftGapToPriority(input: ShiftCoverageInput): UnifiedPriorityItem {
  const isImminent    = input.daysUntil <= 1
  const isUrgent      = input.daysUntil <= 3
  const isAlreadyPast = input.daysUntil < 0

  const breakdown: Omit<PriorityScoreBreakdown, 'total'> = {
    safeguardingImpact: 0,
    clientSafetyImpact: scoreClientSafety({ hasClientImpact: !!input.clientName, missedCare: isAlreadyPast }),
    complianceImpact:   0,
    staffingImpact:     scoreStaffing({ shiftUncovered: true, daysUntilShift: input.daysUntil }),
    overdueFactor:      isAlreadyPast ? scoreOverdue(Math.abs(input.daysUntil)) : 0,
    escalationLevel:    isImminent ? 5 : 0,
    recurrenceFactor:   0,
    urgencyFactor:      scoreUrgency({ daysUntilShift: input.daysUntil, isImminent }),
  }

  const score    = normalisedScore(breakdown)
  const severity = isImminent ? 'critical' : isUrgent ? 'urgent' : 'warning'

  const timeLabel = isAlreadyPast ? 'already passed uncovered'
    : isImminent ? 'tomorrow'
    : `in ${input.daysUntil} days`

  return {
    id:            makeId('shift', input.shiftId),
    priorityScore: score.total,
    severity,
    category:      'shift_coverage',
    title:         `Uncovered shift — ${input.title} (${timeLabel})`,
    description:   `${input.shiftDate} ${input.startTime}–${input.endTime}${input.clientName ? ` · Client: ${input.clientName}` : ''}`,
    affectedShift: { id: input.shiftId, title: input.title, shiftDate: input.shiftDate, href: `/admin/shifts` },
    affectedClient: input.clientName ? { id: '', name: input.clientName } : undefined,
    recommendedAction:      'schedule_replacement_worker',
    recommendedActionLabel: 'Assign a worker',
    actionHref:             `/admin/shifts/open`,
    dueDate:       input.shiftDate,
    overdueBy:     isAlreadyPast ? Math.abs(input.daysUntil) : undefined,
    createdAt:     new Date().toISOString(),
    status:        'open',
    sourceSystem:  'shift_coverage',
    sourceId:      input.shiftId,
    explainability: {
      why:         `Shift "${input.title}" on ${input.shiftDate} has no assigned worker.`,
      triggeredBy: `Shift scheduler: no assignment for shift ${input.shiftId}`,
      consequence: isImminent
        ? 'Client care will be disrupted if a worker is not assigned immediately.'
        : `Client care at risk if not covered before ${input.shiftDate}.`,
      action:      'Open the shift assignment screen and select an available, compliant worker.',
    },
    impact: {
      clientImpact:      input.clientName ? `${input.clientName}'s care may not be delivered` : 'Client care at risk',
      shiftUncovered:    true,
      operationalImpact: 'Rota gap must be resolved',
    },
    scoreBreakdown: score,
    groupKey: `shift::${input.shiftId}`,
  }
}

function visitAnomalyToPriority(input: VisitAnomalyInput): UnifiedPriorityItem {
  const isMissed  = input.anomalyType === 'missed_visit'
  const isHigh    = input.severity === 'high'

  const breakdown: Omit<PriorityScoreBreakdown, 'total'> = {
    safeguardingImpact: isHigh && isMissed ? 15 : 0,
    clientSafetyImpact: scoreClientSafety({ hasClientImpact: !!input.clientName, missedCare: isMissed, severity: input.severity }),
    complianceImpact:   0,
    staffingImpact:     5,
    overdueFactor:      scoreOverdue(input.daysAgo),
    escalationLevel:    0,
    recurrenceFactor:   0,
    urgencyFactor:      isHigh ? 10 : 5,
  }

  const score    = normalisedScore(breakdown)
  const severity = isMissed && isHigh ? 'urgent' : isHigh ? 'warning' : 'informational'

  const anomalyLabel: Record<string, string> = {
    missed_visit:     'Missed visit',
    late_start:       'Late start',
    early_departure:  'Early departure',
    no_check_in:      'No check-in',
    duration_anomaly: 'Duration anomaly',
  }

  return {
    id:            makeId('visit', input.visitId),
    priorityScore: score.total,
    severity,
    category:      'visit_anomaly',
    title:         `${anomalyLabel[input.anomalyType] ?? 'Visit anomaly'} — ${input.clientName ?? input.staffName ?? 'Unknown'}`,
    description:   `${input.occurredAt.slice(0, 10)} · ${input.daysAgo === 0 ? 'Today' : `${input.daysAgo} day${input.daysAgo !== 1 ? 's' : ''} ago`}`,
    affectedWorker: input.staffId ? { id: input.staffId, name: input.staffName!, href: `/admin/staff/${input.staffId}` } : undefined,
    affectedClient: input.clientId ? { id: input.clientId, name: input.clientName!, href: `/admin/clients/${input.clientId}` } : undefined,
    recommendedAction:      'investigate_anomaly',
    recommendedActionLabel: 'Review visit',
    actionHref:             `/admin/visits/anomalies`,
    createdAt:     input.occurredAt,
    status:        'open',
    sourceSystem:  'visit_anomaly',
    sourceId:      input.visitId,
    explainability: {
      why:         `A ${anomalyLabel[input.anomalyType]} was detected${input.clientName ? ` for ${input.clientName}` : ''} on ${input.occurredAt.slice(0, 10)}.`,
      triggeredBy: `Visit monitoring: ${input.anomalyType} (severity: ${input.severity})`,
      consequence: isMissed
        ? `${input.clientName ?? 'A client'} may not have received their scheduled care. This requires immediate follow-up.`
        : 'Repeated anomalies suggest a pattern requiring investigation.',
      action:      `Review the visit log for ${input.occurredAt.slice(0, 10)} and contact ${input.staffName ?? 'the assigned worker'} for explanation.`,
    },
    impact: {
      clientImpact:    isMissed ? `${input.clientName ?? 'Client'} care may not have been delivered` : undefined,
      safeguardingRisk: isMissed && isHigh,
    },
    scoreBreakdown: score,
    groupKey: `visitanomaly::client::${input.clientId ?? input.visitId}`,
  }
}

function incidentToPriority(input: IncidentInput): UnifiedPriorityItem {
  const isSafeguarding = input.incidentType === 'safeguarding'
  const isCritical     = input.severity === 'critical'

  const breakdown: Omit<PriorityScoreBreakdown, 'total'> = {
    safeguardingImpact: scoreSafeguarding({ isSafeguarding, isEscalated: input.escalationRequired, severity: input.severity, repeatCount: input.repeatCount }),
    clientSafetyImpact: scoreClientSafety({ hasClientImpact: !!input.clientName, incidentType: input.incidentType, severity: input.severity }),
    complianceImpact:   0,
    staffingImpact:     0,
    overdueFactor:      scoreOverdue(input.daysOpen),
    escalationLevel:    scoreEscalation(input.escalationRequired, 1),
    recurrenceFactor:   scoreRecurrence(input.repeatCount ?? 0),
    urgencyFactor:      scoreUrgency({ severity: input.severity, isImminent: isCritical }),
  }

  const score    = normalisedScore(breakdown)
  const severity = isSafeguarding && isCritical ? 'critical'
    : isSafeguarding || input.escalationRequired ? 'urgent'
    : isCritical ? 'urgent'
    : 'warning'

  return {
    id:            makeId('incident', input.incidentId),
    priorityScore: score.total,
    severity,
    category:      isSafeguarding ? 'safeguarding' : 'incident',
    title:         `${isSafeguarding ? 'Safeguarding incident' : 'Incident'} — ${input.clientName ?? input.staffName ?? 'Unknown'} (${input.severity})`,
    description:   `${input.incidentType.replace(/_/g, ' ')} · Open ${input.daysOpen} day${input.daysOpen !== 1 ? 's' : ''}${input.escalationRequired ? ' · Escalation required' : ''}`,
    affectedWorker: input.staffId ? { id: input.staffId, name: input.staffName!, href: `/admin/staff/${input.staffId}` } : undefined,
    affectedClient: input.clientId ? { id: input.clientId, name: input.clientName!, href: `/admin/clients/${input.clientId}` } : undefined,
    recommendedAction:      isSafeguarding ? 'escalate_safeguarding' : 'review_incident',
    recommendedActionLabel: isSafeguarding ? 'Escalate safeguarding' : 'Review incident',
    actionHref:             `/admin/incidents/${input.incidentId}`,
    createdAt:     input.occurredAt ?? new Date().toISOString(),
    overdueBy:     input.daysOpen > 3 ? input.daysOpen : undefined,
    status:        'open',
    sourceSystem:  'incident',
    sourceId:      input.incidentId,
    explainability: {
      why:         `${isSafeguarding ? 'A safeguarding incident' : 'An incident'} involving ${input.clientName ?? input.staffName ?? 'unknown parties'} has been open for ${input.daysOpen} days.`,
      triggeredBy: `Incident system: type=${input.incidentType}, severity=${input.severity}, escalation=${input.escalationRequired}`,
      consequence: isSafeguarding
        ? 'Unresolved safeguarding incidents may breach regulatory obligations and put clients at risk.'
        : `An unresolved ${input.severity} incident may indicate systemic issues requiring action.`,
      action:      input.escalationRequired
        ? 'Acknowledge the escalation, notify the relevant authority, and update the incident record.'
        : `Review the incident log, assign an owner, and set a resolution target.`,
    },
    impact: {
      clientImpact:    input.clientName ? `${input.clientName} safety may be at risk` : undefined,
      safeguardingRisk: isSafeguarding,
      complianceBreach: isSafeguarding,
    },
    scoreBreakdown: score,
    groupKey: `incident::client::${input.clientId ?? input.incidentId}`,
  }
}

function safeguardingAlertToPriority(input: SafeguardingAlertInput): UnifiedPriorityItem {
  const breakdown: Omit<PriorityScoreBreakdown, 'total'> = {
    safeguardingImpact: scoreSafeguarding({ isSafeguarding: true, isEscalated: input.escalated, severity: input.severity }),
    clientSafetyImpact: scoreClientSafety({ hasClientImpact: !!input.clientName, severity: input.severity }),
    complianceImpact:   10,
    staffingImpact:     0,
    overdueFactor:      scoreOverdue(input.daysOpen),
    escalationLevel:    scoreEscalation(input.escalated, 2),
    recurrenceFactor:   0,
    urgencyFactor:      15,
  }

  const score = normalisedScore(breakdown)

  return {
    id:            makeId('safeguarding', input.incidentId),
    priorityScore: score.total,
    severity:      'critical',
    category:      'safeguarding',
    title:         `Safeguarding alert — ${input.clientName ?? 'Unknown client'}`,
    description:   `${input.description.slice(0, 120)} · Open ${input.daysOpen} days`,
    affectedClient: input.clientName ? { id: '', name: input.clientName } : undefined,
    recommendedAction:      'escalate_safeguarding',
    recommendedActionLabel: 'Escalate to safeguarding lead',
    actionHref:             `/admin/incidents/${input.incidentId}`,
    createdAt:     input.occurredAt ?? new Date().toISOString(),
    overdueBy:     input.daysOpen,
    status:        'open',
    sourceSystem:  'safeguarding',
    sourceId:      input.incidentId,
    explainability: {
      why:         `A safeguarding alert${input.clientName ? ` for ${input.clientName}` : ''} has remained open for ${input.daysOpen} days.`,
      triggeredBy: `Safeguarding incident: severity=${input.severity}, escalated=${input.escalated}`,
      consequence: 'Unresolved safeguarding alerts breach CQC obligations and may result in regulatory action.',
      action:      'Notify the designated safeguarding lead immediately and document all actions taken.',
    },
    impact: {
      clientImpact:    input.clientName ? `${input.clientName} requires immediate safeguarding review` : 'Client safety at risk',
      safeguardingRisk: true,
      complianceBreach: true,
    },
    scoreBreakdown: score,
    groupKey: `safeguarding::${input.incidentId}`,
  }
}

function communicationToPriority(input: CommunicationInput): UnifiedPriorityItem {
  const breakdown: Omit<PriorityScoreBreakdown, 'total'> = {
    safeguardingImpact: 0,
    clientSafetyImpact: 0,
    complianceImpact:   input.urgency === 'high' ? 10 : 0,
    staffingImpact:     0,
    overdueFactor:      0,
    escalationLevel:    0,
    recurrenceFactor:   0,
    urgencyFactor:      input.urgency === 'high' ? 10 : input.urgency === 'medium' ? 5 : 2,
  }

  const score    = normalisedScore(breakdown)
  const severity = input.urgency === 'high' ? 'urgent' : 'informational'

  return {
    id:            makeId('comms', input.communicationId),
    priorityScore: score.total,
    severity,
    category:      'communication',
    title:         `Unacknowledged communication — ${input.title}`,
    description:   `${input.unacknowledgedCount} recipient${input.unacknowledgedCount !== 1 ? 's' : ''} yet to acknowledge`,
    recommendedAction:      'trigger_communication',
    recommendedActionLabel: 'Review acknowledgements',
    actionHref:             `/admin/communications/${input.communicationId}`,
    createdAt:     input.sentAt,
    status:        'open',
    sourceSystem:  'communications',
    sourceId:      input.communicationId,
    explainability: {
      why:         `"${input.title}" has ${input.unacknowledgedCount} unacknowledged recipient${input.unacknowledgedCount !== 1 ? 's' : ''}.`,
      triggeredBy: `Communications system: sent=${input.sentAt.slice(0, 10)}, urgency=${input.urgency}`,
      consequence: 'Staff may not be aware of important operational updates, policies, or safety information.',
      action:      `Review acknowledgement status and send a follow-up reminder to non-responders.`,
    },
    impact: {
      operationalImpact: 'Staff may be uninformed of key updates',
    },
    scoreBreakdown: score,
    groupKey: `comms::${input.communicationId}`,
  }
}

function wellbeingSignalToPriority(input: WellbeingSignalInput): UnifiedPriorityItem {
  const breakdown: Omit<PriorityScoreBreakdown, 'total'> = {
    safeguardingImpact: 0,
    clientSafetyImpact: 0,
    complianceImpact:   0,
    staffingImpact:     input.signalType === 'declined_shifts' ? 10 : 5,
    overdueFactor:      0,
    escalationLevel:    0,
    recurrenceFactor:   scoreRecurrence(input.count),
    urgencyFactor:      input.count >= 5 ? 8 : 4,
  }

  const score    = normalisedScore(breakdown)
  const severity = input.count >= 5 ? 'warning' : 'informational'

  const signalLabel: Record<string, string> = {
    repeated_late:        'Repeated lateness',
    declined_shifts:      'Multiple shift declines',
    missed_check_ins:     'Missed check-ins',
    high_incident_rate:   'High incident rate',
  }

  return {
    id:            makeId('wellbeing', `${input.staffId}_${input.signalType}`),
    priorityScore: score.total,
    severity,
    category:      'wellbeing',
    title:         `${signalLabel[input.signalType] ?? 'Wellbeing signal'} — ${input.staffName}`,
    description:   `${input.count} occurrence${input.count !== 1 ? 's' : ''} in last ${input.windowDays} days`,
    affectedWorker: { id: input.staffId, name: input.staffName, href: `/admin/staff/${input.staffId}` },
    recommendedAction:      'contact_worker',
    recommendedActionLabel: 'Contact worker',
    actionHref:             `/admin/staff/${input.staffId}`,
    createdAt:     input.lastOccurrence,
    status:        'open',
    sourceSystem:  'wellbeing',
    sourceId:      input.staffId,
    explainability: {
      why:         `${input.staffName} has shown a pattern of ${signalLabel[input.signalType] ?? input.signalType}: ${input.count} times in ${input.windowDays} days.`,
      triggeredBy: `Wellbeing monitoring: ${input.signalType} × ${input.count} in ${input.windowDays}d window`,
      consequence: 'Unaddressed patterns may indicate worker distress, increasing risk of dropout or incidents.',
      action:      `Schedule a 1:1 check-in with ${input.staffName} to understand and address the pattern.`,
    },
    impact: {
      workerImpact:      'Worker may need additional support',
      operationalImpact: 'Continued pattern could reduce workforce availability',
    },
    scoreBreakdown: score,
    groupKey: `wellbeing::worker::${input.staffId}`,
  }
}

function queueItemToPriority(item: QueueItem): UnifiedPriorityItem {
  const daysOpen = Math.floor((Date.now() - new Date(item.created_at).getTime()) / 86400000)
  const isOverdue = item.due_date ? new Date(item.due_date) < new Date() : false
  const overdueBy = isOverdue && item.due_date
    ? Math.floor((Date.now() - new Date(item.due_date).getTime()) / 86400000)
    : undefined

  const scoreMap: Record<string, number> = { critical: 80, urgent: 55, warning: 30, informational: 15 }
  const baseScore = scoreMap[item.priority] ?? 30

  const breakdown: Omit<PriorityScoreBreakdown, 'total'> = {
    safeguardingImpact: item.category === 'safeguarding' ? 25 : 0,
    clientSafetyImpact: 0,
    complianceImpact:   item.category === 'compliance' ? 15 : 0,
    staffingImpact:     item.category === 'staffing' || item.category === 'shift_coverage' ? 10 : 0,
    overdueFactor:      scoreOverdue(daysOpen, item.due_date ?? undefined),
    escalationLevel:    item.escalation_triggered_at ? 8 : 0,
    recurrenceFactor:   0,
    urgencyFactor:      item.priority === 'critical' ? 12 : item.priority === 'urgent' ? 8 : 4,
  }

  const score    = normalisedScore(breakdown)
  const adjustedScore = Math.max(score.total, Math.round(baseScore * 0.6))
  const severity = severityFromScore(adjustedScore)

  const actionMap: Record<string, RecommendedAction> = {
    safeguarding: 'escalate_safeguarding',
    compliance:   'renew_compliance',
    staffing:     'schedule_replacement_worker',
    onboarding:   'complete_onboarding',
    incident:     'review_incident',
    medication:   'review_incident',
    shift_coverage: 'schedule_replacement_worker',
    other:        'resolve_queue_item',
  }

  return {
    id:            makeId('queue', item.id),
    priorityScore: adjustedScore,
    severity,
    category:      'queue_item',
    title:         item.title,
    description:   item.description ?? '',
    recommendedAction:      actionMap[item.category] ?? 'resolve_queue_item',
    recommendedActionLabel: 'Resolve queue item',
    actionHref:             `/admin/operations/queue`,
    dueDate:       item.due_date ?? undefined,
    overdueBy,
    createdAt:     item.created_at,
    owner:         item.assigned_to ?? undefined,
    status:        item.status === 'open' ? 'open'
      : item.status === 'in_progress' ? 'in_progress'
      : item.status === 'resolved' ? 'resolved'
      : 'dismissed',
    sourceSystem:  'operations_queue',
    sourceId:      item.id,
    explainability: {
      why:         `Operations queue item: "${item.title}"${isOverdue ? ` — overdue by ${overdueBy} days` : ''}.`,
      triggeredBy: `Operations queue: category=${item.category}, priority=${item.priority}`,
      consequence: `Unresolved ${item.priority} queue items may indicate systemic operational failures.`,
      action:      item.assigned_to
        ? `Follow up with ${item.assigned_to} to confirm this item is being actioned.`
        : 'Assign an owner and set a resolution deadline.',
    },
    impact: {},
    scoreBreakdown: { ...breakdown, total: adjustedScore },
    groupKey: `queue::${item.id}`,
  }
}

// ── Deduplication & grouping ──────────────────────────────────────────────────

function deduplicateAndGroup(items: UnifiedPriorityItem[]): UnifiedPriorityItem[] {
  // Group by groupKey
  const groups = new Map<string, UnifiedPriorityItem[]>()
  const ungrouped: UnifiedPriorityItem[] = []

  for (const item of items) {
    if (!item.groupKey) {
      ungrouped.push(item)
      continue
    }
    const list = groups.get(item.groupKey) ?? []
    list.push(item)
    groups.set(item.groupKey, list)
  }

  const result: UnifiedPriorityItem[] = [...ungrouped]

  for (const [, group] of groups) {
    if (group.length === 1) {
      result.push(group[0])
      continue
    }

    // Sort by score descending, highest becomes the group representative
    group.sort((a, b) => b.priorityScore - a.priorityScore)
    const primary = group[0]

    // Merge: take highest score, collect evidence from others
    const evidence: LinkedEvidence[] = group.slice(1).map((item) => ({
      label:       item.title,
      description: item.description,
      href:        item.actionHref,
      type:        categoryToEvidenceType(item.category),
    }))

    // Escalate severity if multiple high-priority items share same worker
    const maxScore = Math.min(100, primary.priorityScore + Math.floor((group.length - 1) * 5))

    result.push({
      ...primary,
      priorityScore: maxScore,
      severity:      severityFromScore(maxScore),
      isGroup:       true,
      groupedCount:  group.length,
      linkedItems:   group.slice(1).map((i) => i.id),
      evidence,
    })
  }

  return result
}

function categoryToEvidenceType(category: PriorityCategory): LinkedEvidence['type'] {
  switch (category) {
    case 'document_verification': return 'document'
    case 'incident':
    case 'safeguarding':          return 'incident'
    case 'compliance':            return 'compliance'
    case 'shift_coverage':        return 'shift'
    case 'queue_item':            return 'queue'
    default:                      return 'compliance'
  }
}

// ── Suppression / focus mode ──────────────────────────────────────────────────

export interface SuppressionWindow {
  category?:  PriorityCategory
  sourceId?:  string
  until:      string  // ISO datetime
  reason?:    string
}

function isSuppressed(item: UnifiedPriorityItem, windows: SuppressionWindow[]): boolean {
  const now = new Date()
  for (const w of windows) {
    if (new Date(w.until) < now) continue
    if (w.sourceId && w.sourceId !== item.sourceId) continue
    if (w.category && w.category !== item.category) continue
    return true
  }
  return false
}

// ── State merging ─────────────────────────────────────────────────────────────

function mergeState(
  item:     UnifiedPriorityItem,
  overrides: PriorityStateOverride[],
): UnifiedPriorityItem {
  const override = overrides.find((o) => o.priorityId === item.id)
  if (!override) return item

  // If snoozed, check if still within snooze window
  if (override.status === 'snoozed' && override.snoozedUntil) {
    if (new Date(override.snoozedUntil) > new Date()) {
      return { ...item, ...override }
    }
    // Snooze expired — revert to open
    return { ...item, status: 'open', owner: override.owner, ownerId: override.ownerId }
  }

  return { ...item, ...override }
}

// ── Main orchestration function ───────────────────────────────────────────────

export interface OrchestrationResult {
  priorities:      UnifiedPriorityItem[]
  summary: {
    critical:        number
    urgent:          number
    warning:         number
    informational:   number
    total:           number
    topRisk:         UnifiedPriorityItem[]   // top 5 for executive summary
    trend:           'worsening' | 'stable' | 'improving'  // requires historical comparison
  }
  generatedAt: string
}

export function orchestrate(
  input:      OrchestrationInput,
  overrides?:  PriorityStateOverride[],
  suppressions?: SuppressionWindow[],
  focusMode?:  boolean,  // hide informational when true
): OrchestrationResult {
  const raw: UnifiedPriorityItem[] = []

  // 1. Compliance risks
  for (const c of input.complianceRisks) {
    if (c.complianceState !== 'compliant') {
      raw.push(complianceRiskToPriority(c))
    }
  }

  // 2. Onboarding
  for (const o of input.onboardingReadiness) {
    if (o.stage !== 'ready_for_deployment' && o.stage !== 'ready_for_shadowing') {
      raw.push(onboardingToPriority(o))
    }
  }

  // 3. Document verification backlog
  for (const d of input.documentBacklog) {
    raw.push(documentVerificationToPriority(d))
  }

  // 4. Shift coverage gaps
  for (const s of input.shiftGaps) {
    raw.push(shiftGapToPriority(s))
  }

  // 5. Visit anomalies
  for (const v of input.visitAnomalies) {
    raw.push(visitAnomalyToPriority(v))
  }

  // 6. Incidents
  for (const i of input.incidents) {
    raw.push(incidentToPriority(i))
  }

  // 7. Safeguarding (separate high-priority path)
  for (const s of input.safeguardingAlerts) {
    raw.push(safeguardingAlertToPriority(s))
  }

  // 8. Communications
  for (const c of input.communications) {
    if (c.unacknowledgedCount > 0) {
      raw.push(communicationToPriority(c))
    }
  }

  // 9. Wellbeing signals
  for (const w of input.wellbeingSignals) {
    raw.push(wellbeingSignalToPriority(w))
  }

  // 10. Operations queue items (open only, not already represented above)
  for (const q of input.queueItems) {
    if (q.status !== 'open' && q.status !== 'in_progress') continue
    // Skip if already represented by a more specific signal
    const alreadyCovered = raw.some((r) => r.sourceId === q.entity_id?.toString())
    if (!alreadyCovered) {
      raw.push(queueItemToPriority(q))
    }
  }

  // Dedup + group
  let priorities = deduplicateAndGroup(raw)

  // Apply suppression windows
  if (suppressions?.length) {
    priorities = priorities.filter((p) => !isSuppressed(p, suppressions))
  }

  // Apply stored state overrides (snooze, assignment, acknowledgement)
  if (overrides?.length) {
    priorities = priorities.map((p) => mergeState(p, overrides))
  }

  // Filter snoozed and dismissed
  priorities = priorities.filter((p) => p.status !== 'dismissed')
  const activePriorities = priorities.filter((p) => p.status !== 'snoozed')

  // Focus mode: hide informational
  const displayed = focusMode
    ? activePriorities.filter((p) => p.severity !== 'informational')
    : activePriorities

  // Sort: severity desc, then score desc, then overdue desc
  displayed.sort((a, b) => {
    const sevOrd: Record<PrioritySeverity, number> = { critical: 4, urgent: 3, warning: 2, informational: 1 }
    const sd = sevOrd[b.severity] - sevOrd[a.severity]
    if (sd !== 0) return sd
    const pd = b.priorityScore - a.priorityScore
    if (pd !== 0) return pd
    return (b.overdueBy ?? 0) - (a.overdueBy ?? 0)
  })

  const counts = {
    critical:      displayed.filter((p) => p.severity === 'critical').length,
    urgent:        displayed.filter((p) => p.severity === 'urgent').length,
    warning:       displayed.filter((p) => p.severity === 'warning').length,
    informational: displayed.filter((p) => p.severity === 'informational').length,
    total:         displayed.length,
    topRisk:       displayed.slice(0, 5),
    trend:         'stable' as const,
  }

  return {
    priorities: displayed,
    summary:    counts,
    generatedAt: new Date().toISOString(),
  }
}

// ── Executive summary helpers ─────────────────────────────────────────────────

export interface ExecutiveSummary {
  criticalCount:       number
  urgentCount:         number
  unresolvedCritical:  UnifiedPriorityItem[]
  topRisks:            UnifiedPriorityItem[]
  riskTrend:           'improving' | 'stable' | 'worsening'
  priorityAging: {
    over24h:  number
    over48h:  number
    over7d:   number
  }
}

export function buildExecutiveSummary(result: OrchestrationResult): ExecutiveSummary {
  const now = Date.now()

  const aging = {
    over24h: result.priorities.filter((p) => {
      const h = (now - new Date(p.createdAt).getTime()) / 3600000
      return h >= 24 && p.status !== 'resolved'
    }).length,
    over48h: result.priorities.filter((p) => {
      const h = (now - new Date(p.createdAt).getTime()) / 3600000
      return h >= 48 && p.status !== 'resolved'
    }).length,
    over7d: result.priorities.filter((p) => {
      const d = (now - new Date(p.createdAt).getTime()) / 86400000
      return d >= 7 && p.status !== 'resolved'
    }).length,
  }

  return {
    criticalCount:      result.summary.critical,
    urgentCount:        result.summary.urgent,
    unresolvedCritical: result.priorities.filter((p) => p.severity === 'critical' && p.status !== 'resolved'),
    topRisks:           result.summary.topRisk,
    riskTrend:          result.summary.trend,
    priorityAging:      aging,
  }
}

// ── Audit log entry builder ───────────────────────────────────────────────────

export type AuditAction =
  | 'priority_generated'
  | 'priority_grouped'
  | 'acknowledged'
  | 'assigned'
  | 'snoozed'
  | 'resolved'
  | 'escalated'
  | 'dismissed'

export interface PriorityAuditEntry {
  priorityId:  string
  action:      AuditAction
  actorId:     string
  actorName:   string
  note?:       string
  metadata?:   Record<string, unknown>
  occurredAt:  string
}

export function buildAuditEntry(
  priorityId: string,
  action:     AuditAction,
  actor:      { id: string; name: string },
  note?:      string,
  metadata?:  Record<string, unknown>,
): PriorityAuditEntry {
  return {
    priorityId,
    action,
    actorId:   actor.id,
    actorName: actor.name,
    note,
    metadata,
    occurredAt: new Date().toISOString(),
  }
}

// ── Recommended action labels ─────────────────────────────────────────────────

export const ACTION_LABELS: Record<RecommendedAction, string> = {
  assign_owner:               'Assign owner',
  request_document:           'Request document',
  approve_document:           'Approve document',
  schedule_replacement_worker: 'Schedule worker',
  escalate_safeguarding:      'Escalate',
  contact_worker:             'Contact worker',
  resolve_queue_item:         'Resolve',
  review_client_risk:         'Review client',
  trigger_communication:      'Send reminder',
  renew_compliance:           'Renew compliance',
  review_incident:            'Review incident',
  complete_onboarding:        'Complete onboarding',
  investigate_anomaly:        'Investigate',
}
