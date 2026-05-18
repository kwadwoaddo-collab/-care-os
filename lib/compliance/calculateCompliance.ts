import {
  REQUIRED_DOCUMENTS,
  REQUIRED_TRAINING,
  EXPIRY_WARN_DAYS,
} from './requirements'
import { getRequiredTraining } from '@/lib/training/matrix'

// ── Compliance State ──────────────────────────────────────────────────────────
//
// A single operational status derived from the full compliance summary.
//
//   compliant     — all required items satisfied, nothing expiring imminently
//   warning       — all satisfied, but ≥1 item expires within EXPIRY_WARN_DAYS
//   non_compliant — ≥1 required item missing or expired
//   blocked       — non_compliant AND the missing items include required training
//                   (this triggers the onboarding hard gate — activation is blocked)

export type ComplianceState = 'compliant' | 'warning' | 'non_compliant' | 'blocked'

// ── Input types ───────────────────────────────────────────────────────────────

export interface ComplianceDocument {
  id:                string
  document_type:     string
  file_name:         string
  expiry_date:       string | null
  /** Populated from migration 029 — structured training classification */
  training_category: string | null
  /** Admin review status: 'pending' | 'approved' | 'rejected' | null */
  reviewed_status:    string | null
  /** Verification lifecycle status — primary compliance gate when present */
  verification_status?: string | null
  /** Optional certificate issue date */
  issue_date:         string | null
}

// ── Output type ───────────────────────────────────────────────────────────────

export interface ComplianceSummary {
  percentage:          number
  missingDocuments:    string[]
  expiredDocuments:    string[]
  expiringSoon:        string[]   // document types expiring within EXPIRY_WARN_DAYS
  missingTraining:     string[]   // required training not yet satisfied
  satisfiedTraining:   string[]   // approved + valid training categories
  expiredTraining:     string[]   // approved but expired training categories
  /** @deprecated Use satisfiedTraining. Kept for backwards compat. */
  inferredTraining:    string[]
  compliant:           boolean
  /** Operational compliance state — drives dashboard, blocks, and reminders */
  complianceState:     ComplianceState
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isExpired(expiryDate: string | null): boolean {
  if (!expiryDate) return false
  return new Date(expiryDate) < new Date()
}

function isExpiringSoon(expiryDate: string | null): boolean {
  if (!expiryDate) return false
  const expiry  = new Date(expiryDate)
  const now     = new Date()
  const warnAt  = new Date()
  warnAt.setDate(now.getDate() + EXPIRY_WARN_DAYS)
  return expiry > now && expiry <= warnAt
}

// ── Training resolution (category-based + approval-aware) ─────────────────────
//
// Replaces the old inferTraining() which matched file_name against keyword lists.
//
// Rules:
//   1. Document must be of type 'training_certificate'
//   2. Document must have reviewed_status = 'approved'
//   3. Document must have a matching training_category
//   4. If expiry_date is set, it must not be expired
//
// For each required training category we look at ALL matching approved certs
// and pick the most recent (latest expiry_date, or latest created_at when no
// expiry is set). An approved cert with NO expiry_date is treated as perpetually
// valid (the admin chose not to set one).

interface TrainingResolution {
  satisfied: string[]
  expired:   string[]
  missing:   string[]
}

function isDocApproved(d: ComplianceDocument): boolean {
  // verification_status is the primary gate when present
  if (d.verification_status != null) return d.verification_status === 'approved'
  return d.reviewed_status === 'approved'
}

function resolveTraining(documents: ComplianceDocument[], requiredCategories: string[]): TrainingResolution {
  const approvedCerts = documents.filter(
    (d) =>
      d.document_type     === 'training_certificate' &&
      isDocApproved(d)                               &&
      d.training_category !== null
  )

  const satisfied: string[] = []
  const expired:   string[] = []
  const missing:   string[] = []

  for (const category of requiredCategories) {
    // All approved certs for this category
    const matching = approvedCerts
      .filter((d) => d.training_category === category)
      // Sort: most-recently-expiring first, then nulls last
      .sort((a, b) => {
        if (!a.expiry_date && !b.expiry_date) return 0
        if (!a.expiry_date) return -1  // no expiry = perpetually valid → comes first
        if (!b.expiry_date) return 1
        return b.expiry_date.localeCompare(a.expiry_date)
      })

    if (matching.length === 0) {
      missing.push(category)
      continue
    }

    // Use the best available cert (most-recently-expiring / no expiry)
    const best = matching[0]

    if (isExpired(best.expiry_date)) {
      // Check if there's a non-expired cert further down the list
      const valid = matching.find((d) => !isExpired(d.expiry_date))
      if (valid) {
        satisfied.push(category)
      } else {
        expired.push(category)
      }
    } else {
      satisfied.push(category)
    }
  }

  return { satisfied, expired, missing }
}

// ── Main calculator ───────────────────────────────────────────────────────────

export function calculateCompliance(
  documents: ComplianceDocument[],
  jobRole?: string | null
): ComplianceSummary {
  const missingDocuments:  string[] = []
  const expiredDocuments:  string[] = []
  const expiringSoon:      string[] = []

  // ── Document checks ────────────────────────────────────────────────────────
  for (const required of REQUIRED_DOCUMENTS) {
    // Use the most recently uploaded document of this type
    const matches = documents
      .filter((d) => d.document_type === required)
      .sort((a, b) => (b.expiry_date ?? '').localeCompare(a.expiry_date ?? ''))

    if (matches.length === 0) {
      missingDocuments.push(required)
    } else {
      const latest = matches[0]
      if (isExpired(latest.expiry_date)) {
        expiredDocuments.push(required)
      } else if (isExpiringSoon(latest.expiry_date)) {
        expiringSoon.push(required)
      }
    }
  }

  // ── Training checks (category-based, approval-aware) ───────────────────────
  // Use role-specific training requirements when jobRole is provided
  const requiredTrainingCategories: string[] = jobRole
    ? getRequiredTraining(jobRole)
    : [...REQUIRED_TRAINING]
  const { satisfied, expired: expiredT, missing: missingT } = resolveTraining(documents, requiredTrainingCategories)

  // ── Compliance percentage ──────────────────────────────────────────────────
  // Each required item is either compliant or not.
  // Missing + expired documents count as non-compliant.
  // Expiring-soon documents are still compliant (just warned).
  // Missing + expired training counts as non-compliant.
  const totalRequired  = REQUIRED_DOCUMENTS.length + requiredTrainingCategories.length
  const totalIssues    = missingDocuments.length + expiredDocuments.length + missingT.length + expiredT.length
  const compliantItems = Math.max(0, totalRequired - totalIssues)
  const percentage     = totalRequired === 0
    ? 100
    : Math.round((compliantItems / totalRequired) * 100)

  const compliant =
    missingDocuments.length  === 0 &&
    expiredDocuments.length  === 0 &&
    missingT.length          === 0 &&
    expiredT.length          === 0

  const complianceState: ComplianceState = getComplianceState(
    compliant,
    expiringSoon.length > 0,
    missingT.length > 0 || expiredT.length > 0
  )

  return {
    percentage,
    missingDocuments,
    expiredDocuments,
    expiringSoon,
    missingTraining:   [...missingT, ...expiredT],  // both need attention
    satisfiedTraining: satisfied,
    expiredTraining:   expiredT,
    inferredTraining:  satisfied,                   // backwards compat alias
    compliant,
    complianceState,
  }
}

// ── Compliance state derivation ───────────────────────────────────────────────

/**
 * Derives the operational ComplianceState from summary booleans.
 * Exported so callers can reuse it without rerunning the full calculation.
 */
export function getComplianceState(
  compliant: boolean,
  hasExpiringSoon: boolean,
  hasTrainingGap: boolean,  // missing or expired mandatory training
): ComplianceState {
  if (!compliant && hasTrainingGap) return 'blocked'
  if (!compliant)                   return 'non_compliant'
  if (hasExpiringSoon)              return 'warning'
  return 'compliant'
}

// ── Badge colour helper (shared by UI) ────────────────────────────────────────

export type ComplianceTier = 'green' | 'amber' | 'red'

export function complianceTier(percentage: number): ComplianceTier {
  if (percentage >= 100) return 'green'
  if (percentage >= 70)  return 'amber'
  return 'red'
}

export const TIER_CLS: Record<ComplianceTier, string> = {
  green: 'bg-green-50  text-green-700  ring-green-600/20',
  amber: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  red:   'bg-red-50    text-red-700    ring-red-600/20',
}

