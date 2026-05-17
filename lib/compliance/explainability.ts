// lib/compliance/explainability.ts
//
// Human-readable compliance reason breakdown.
//
// Turns calculateCompliance() output into auditor-friendly explanations:
// • why the score changed
// • which items have penalties and how much
// • what action is required for each issue
// • what is blocking shift assignment
//
// Pure functions — no DB or server dependencies.

import type { ComplianceSummary, ComplianceState, ComplianceDocument } from './calculateCompliance'
import { getDaysUntilExpiry, getExpiryBand }                           from './expiryBands'
import { REQUIRED_DOCUMENTS }                                          from './requirements'

// ── Labels ────────────────────────────────────────────────────────────────────

const DOCUMENT_LABELS: Record<string, string> = {
  passport:                  'Passport',
  right_to_work:             'Right to Work',
  dbs:                       'DBS Certificate',
  training_certificate:      'Training Certificate',
  proof_of_address:          'Proof of Address',
  national_insurance:        'National Insurance',
  qualification:             'Qualification',
  nmc_pin:                   'NMC PIN Certificate',
  brp:                       'Biometric Residence Permit',
  other:                     'Other Document',
}

const TRAINING_LABELS: Record<string, string> = {
  manual_handling:    'Manual Handling',
  safeguarding:       'Safeguarding',
  basic_life_support: 'Basic Life Support',
  infection_control:  'Infection Control',
  health_safety:      'Health & Safety',
  medication:         'Medication Administration',
  fire_safety:        'Fire Safety',
}

function itemLabel(key: string): string {
  return DOCUMENT_LABELS[key] ?? TRAINING_LABELS[key] ?? key.replace(/_/g, ' ')
}

// ── Impact classification ─────────────────────────────────────────────────────

const CRITICAL_DOCS = new Set(['dbs', 'right_to_work', 'passport'])
const CRITICAL_TRAINING = new Set(['safeguarding', 'manual_handling'])

function docImpact(key: string, status: ComplianceReason['status']): ComplianceReason['impact'] {
  if (CRITICAL_DOCS.has(key))     return 'critical'
  if (status === 'expired')       return 'high'
  if (status === 'expiring_soon') return 'medium'
  return 'high'
}

function trainingImpact(key: string, status: ComplianceReason['status']): ComplianceReason['impact'] {
  if (CRITICAL_TRAINING.has(key)) return 'critical'
  if (status === 'expired')       return 'high'
  if (status === 'expiring_soon') return 'medium'
  return 'high'
}

// ── Actions ───────────────────────────────────────────────────────────────────

function docAction(key: string, status: ComplianceReason['status']): string {
  const label = itemLabel(key)
  switch (status) {
    case 'missing':
      return `Upload your ${label} immediately. This is required before you can be assigned to shifts.`
    case 'expired':
      return `Your ${label} has expired. Upload a current, valid copy immediately.`
    case 'expiring_soon':
      return `Your ${label} is expiring soon. Arrange a renewal and upload the updated document.`
    default:
      return `Check your ${label} is valid and up to date.`
  }
}

function trainingAction(key: string, status: ComplianceReason['status']): string {
  const label = itemLabel(key)
  switch (status) {
    case 'missing':
      return `Complete ${label} training and upload your certificate. This is mandatory.`
    case 'expired':
      return `Your ${label} certificate has expired. Complete a refresher course and upload the new certificate.`
    case 'expiring_soon':
      return `Your ${label} certificate expires soon. Book a refresher course and upload the renewed certificate.`
    default:
      return `Ensure your ${label} certificate is current.`
  }
}

// ── Explanation text ──────────────────────────────────────────────────────────

function docExplanation(key: string, status: ComplianceReason['status']): string {
  const label = itemLabel(key)
  switch (status) {
    case 'missing':
      if (CRITICAL_DOCS.has(key)) {
        return `${label} is a legal requirement. Staff cannot be deployed without it.`
      }
      return `${label} is required before you can work. Upload this document to unlock your profile.`
    case 'expired':
      if (key === 'dbs') {
        return 'An expired DBS check creates a safeguarding risk. This is a hard blocker for all care roles.'
      }
      if (key === 'right_to_work') {
        return 'An expired Right to Work document means the employer cannot legally continue employment. This requires immediate action.'
      }
      return `Your ${label} has passed its expiry date and is no longer valid.`
    case 'expiring_soon':
      return `Your ${label} expires within 30 days. Once expired, it will block compliance and shift assignment.`
    default:
      return `${label} requires attention.`
  }
}

function trainingExplanation(key: string, status: ComplianceReason['status']): string {
  const label = itemLabel(key)
  switch (status) {
    case 'missing':
      if (CRITICAL_TRAINING.has(key)) {
        return `${label} is a mandatory regulatory training requirement for all care staff. Missing this training blocks activation.`
      }
      return `${label} is mandatory for your role. This training must be completed and approved before you are fully compliant.`
    case 'expired':
      return `Your ${label} certificate has expired. Expired training certificates do not count towards compliance.`
    case 'expiring_soon':
      return `Your ${label} certificate expires within 30 days. Once expired it will no longer count towards compliance.`
    default:
      return `${label} requires attention.`
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ComplianceReason {
  item:           string
  label:          string
  category:       'document' | 'training'
  status:         'missing' | 'expired' | 'expiring_soon' | 'ok'
  impact:         'critical' | 'high' | 'medium' | 'low'
  /** Negative value = penalty contribution to score loss */
  scorePenalty:   number
  explanation:    string
  action:         string
  expiryDate:     string | null
  daysUntilExpiry: number | null
}

export interface ComplianceScoreBreakdown {
  totalRequired:  number
  compliantItems: number
  issueItems:     number
  penaltyPerItem: number     // how much each issue costs (percentage points)
  percentage:     number
  state:          ComplianceState
  primaryBlocker: string | null    // label of the single most critical issue
  stateExplanation: string         // why the compliance state is what it is
  issues:         ComplianceReason[]  // only items with problems
  ok:             ComplianceReason[]  // satisfied items (for audit transparency)
}

// ── Expiry lookup helper ──────────────────────────────────────────────────────

function findExpiryForType(
  documents: ComplianceDocument[],
  docType: string,
): { expiryDate: string | null; daysUntilExpiry: number | null } {
  const matches = documents
    .filter((d) => d.document_type === docType || d.training_category === docType)
    .sort((a, b) => (b.expiry_date ?? '').localeCompare(a.expiry_date ?? ''))

  const best = matches[0]
  if (!best?.expiry_date) return { expiryDate: null, daysUntilExpiry: null }
  return {
    expiryDate:     best.expiry_date,
    daysUntilExpiry: Math.ceil(getDaysUntilExpiry(best.expiry_date)),
  }
}

function findExpiryForCategory(
  documents: ComplianceDocument[],
  category: string,
): { expiryDate: string | null; daysUntilExpiry: number | null } {
  const matches = documents
    .filter((d) => d.training_category === category && d.reviewed_status === 'approved')
    .sort((a, b) => (b.expiry_date ?? '').localeCompare(a.expiry_date ?? ''))

  const best = matches[0]
  if (!best?.expiry_date) return { expiryDate: null, daysUntilExpiry: null }
  return {
    expiryDate:     best.expiry_date,
    daysUntilExpiry: Math.ceil(getDaysUntilExpiry(best.expiry_date)),
  }
}

// ── State explanation ─────────────────────────────────────────────────────────

function stateExplanation(state: ComplianceState, summary: ComplianceSummary): string {
  switch (state) {
    case 'blocked':
      return `This staff member is blocked from shift assignment. Critical training is missing or expired (${
        summary.missingTraining.length
      } training gap${summary.missingTraining.length !== 1 ? 's' : ''}). All training gaps must be resolved before activation.`
    case 'non_compliant':
      return `${summary.missingDocuments.length + summary.expiredDocuments.length} required document${
        summary.missingDocuments.length + summary.expiredDocuments.length !== 1 ? 's are' : ' is'
      } missing or expired. This must be resolved before this staff member can be deployed.`
    case 'warning':
      return `All required items are present but ${summary.expiringSoon.length} item${
        summary.expiringSoon.length !== 1 ? 's expire' : ' expires'
      } within 30 days. Action is needed to prevent expiry violations.`
    case 'compliant':
      return 'All required compliance items are satisfied and no credentials are expiring within 30 days.'
  }
}

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Produces a human-readable compliance score breakdown for a staff member.
 *
 * Takes the output of calculateCompliance() plus the raw documents array
 * (for expiry date lookups) and returns structured reasons auditors can read.
 */
export function explainCompliance(
  summary:   ComplianceSummary,
  documents: ComplianceDocument[],
  requiredTrainingCategories: string[],
): ComplianceScoreBreakdown {
  const totalRequired  = REQUIRED_DOCUMENTS.length + requiredTrainingCategories.length
  const issueItems     = summary.missingDocuments.length + summary.expiredDocuments.length
                       + summary.missingTraining.length  // includes expired training
  const compliantItems = Math.max(0, totalRequired - issueItems)
  const penaltyPerItem = totalRequired > 0 ? Math.round(100 / totalRequired) : 0

  const issues: ComplianceReason[] = []
  const ok:     ComplianceReason[] = []

  // ── Document issues ───────────────────────────────────────────────────────

  for (const key of summary.missingDocuments) {
    const expiry = findExpiryForType(documents, key)
    issues.push({
      item:           key,
      label:          itemLabel(key),
      category:       'document',
      status:         'missing',
      impact:         docImpact(key, 'missing'),
      scorePenalty:   -penaltyPerItem,
      explanation:    docExplanation(key, 'missing'),
      action:         docAction(key, 'missing'),
      expiryDate:     null,
      daysUntilExpiry: null,
    })
  }

  for (const key of summary.expiredDocuments) {
    const expiry = findExpiryForType(documents, key)
    issues.push({
      item:           key,
      label:          itemLabel(key),
      category:       'document',
      status:         'expired',
      impact:         docImpact(key, 'expired'),
      scorePenalty:   -penaltyPerItem,
      explanation:    docExplanation(key, 'expired'),
      action:         docAction(key, 'expired'),
      expiryDate:     expiry.expiryDate,
      daysUntilExpiry: expiry.daysUntilExpiry,
    })
  }

  for (const key of summary.expiringSoon) {
    // expiringSoon items don't reduce the score — still warn
    const expiry = findExpiryForType(documents, key)
    issues.push({
      item:           key,
      label:          itemLabel(key),
      category:       'document',
      status:         'expiring_soon',
      impact:         docImpact(key, 'expiring_soon'),
      scorePenalty:   0,       // warning only, no score penalty
      explanation:    docExplanation(key, 'expiring_soon'),
      action:         docAction(key, 'expiring_soon'),
      expiryDate:     expiry.expiryDate,
      daysUntilExpiry: expiry.daysUntilExpiry,
    })
  }

  // ── Training issues ───────────────────────────────────────────────────────

  // missingTraining includes both genuinely missing AND expired training
  for (const cat of summary.missingTraining) {
    const isExpiredTraining = summary.expiredTraining.includes(cat)
    const status: ComplianceReason['status'] = isExpiredTraining ? 'expired' : 'missing'
    const expiry = findExpiryForCategory(documents, cat)

    issues.push({
      item:           cat,
      label:          itemLabel(cat),
      category:       'training',
      status,
      impact:         trainingImpact(cat, status),
      scorePenalty:   -penaltyPerItem,
      explanation:    trainingExplanation(cat, status),
      action:         trainingAction(cat, status),
      expiryDate:     expiry.expiryDate,
      daysUntilExpiry: expiry.daysUntilExpiry,
    })
  }

  // ── Satisfied items (transparency) ────────────────────────────────────────

  for (const key of REQUIRED_DOCUMENTS) {
    if (!summary.missingDocuments.includes(key) && !summary.expiredDocuments.includes(key)) {
      const expiry = findExpiryForType(documents, key)
      const isExpiringSoon = summary.expiringSoon.includes(key)
      if (!isExpiringSoon) {
        ok.push({
          item:           key,
          label:          itemLabel(key),
          category:       'document',
          status:         'ok',
          impact:         'low',
          scorePenalty:   0,
          explanation:    `${itemLabel(key)} is valid and up to date.`,
          action:         '',
          expiryDate:     expiry.expiryDate,
          daysUntilExpiry: expiry.daysUntilExpiry,
        })
      }
    }
  }

  for (const cat of summary.satisfiedTraining) {
    const expiry = findExpiryForCategory(documents, cat)
    ok.push({
      item:           cat,
      label:          itemLabel(cat),
      category:       'training',
      status:         'ok',
      impact:         'low',
      scorePenalty:   0,
      explanation:    `${itemLabel(cat)} training is approved and current.`,
      action:         '',
      expiryDate:     expiry.expiryDate,
      daysUntilExpiry: expiry.daysUntilExpiry,
    })
  }

  // Sort issues: critical first, then high, medium, low
  const IMPACT_ORDER = { critical: 0, high: 1, medium: 2, low: 3 }
  issues.sort((a, b) => IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact])

  // Primary blocker: the most critical single issue
  const primaryBlocker = issues[0]?.label ?? null

  return {
    totalRequired,
    compliantItems,
    issueItems,
    penaltyPerItem,
    percentage: summary.percentage,
    state:      summary.complianceState,
    primaryBlocker,
    stateExplanation: stateExplanation(summary.complianceState, summary),
    issues,
    ok,
  }
}

// ── Shift blocking explanation ────────────────────────────────────────────────

export interface ShiftBlockReason {
  blocked:   boolean
  reasons:   string[]
  details:   Array<{
    item:         string
    label:        string
    status:       'missing' | 'expired' | 'expiring_soon'
    overridePath: string | null   // what action bypasses this, if any
  }>
  overrideable: boolean   // can a privileged user override this block?
}

/**
 * Explains exactly why a staff member is blocked from shift assignment.
 */
export function explainShiftBlock(
  complianceState: ComplianceState,
  missingDocs:     string[],
  expiredDocs:     string[],
  missingTraining: string[],
  expiredTraining: string[],
  staffStatus:     string,
): ShiftBlockReason {
  if (staffStatus !== 'active') {
    return {
      blocked:      true,
      reasons:      [`Staff status is "${staffStatus}" — only active staff can be assigned to shifts.`],
      details:      [],
      overrideable: false,
    }
  }

  if (complianceState === 'compliant' || complianceState === 'warning') {
    return {
      blocked:      false,
      reasons:      [],
      details:      [],
      overrideable: false,
    }
  }

  const reasons: string[] = []
  const details: ShiftBlockReason['details'] = []

  for (const key of missingDocs) {
    const label = itemLabel(key)
    reasons.push(`${label} is missing`)
    details.push({
      item:         key,
      label,
      status:       'missing',
      overridePath: CRITICAL_DOCS.has(key)
        ? 'A compliance_manager or company_admin can grant a temporary override if exceptional circumstances apply.'
        : null,
    })
  }

  for (const key of expiredDocs) {
    const label = itemLabel(key)
    reasons.push(`${label} has expired`)
    details.push({
      item:         key,
      label,
      status:       'expired',
      overridePath: CRITICAL_DOCS.has(key)
        ? 'A compliance_manager or company_admin can grant a temporary override.'
        : null,
    })
  }

  for (const cat of missingTraining) {
    const label = itemLabel(cat)
    const isExpired = expiredTraining.includes(cat)
    reasons.push(isExpired ? `${label} training has expired` : `${label} training is missing`)
    details.push({
      item:         cat,
      label,
      status:       isExpired ? 'expired' : 'missing',
      overridePath: 'A compliance_manager or company_admin can grant a temporary compliance override.',
    })
  }

  return {
    blocked:      true,
    reasons,
    details,
    overrideable: true,
  }
}
