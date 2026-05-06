import {
  REQUIRED_DOCUMENTS,
  REQUIRED_TRAINING,
  TRAINING_KEYWORDS,
  EXPIRY_WARN_DAYS,
  type RequiredTraining,
} from './requirements'

// ── Input types ───────────────────────────────────────────────────────────────

export interface ComplianceDocument {
  id:            string
  document_type: string
  file_name:     string
  expiry_date:   string | null
}

// ── Output type ───────────────────────────────────────────────────────────────

export interface ComplianceSummary {
  percentage:        number
  missingDocuments:  string[]
  expiredDocuments:  string[]
  expiringSoon:      string[]  // document types expiring within EXPIRY_WARN_DAYS
  missingTraining:   string[]
  inferredTraining:  string[]  // training detected from file names
  compliant:         boolean
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

// ── Training inference (Task 7) ───────────────────────────────────────────────
// Looks at documents whose type is 'training_certificate' and matches the
// file_name (lower-cased) against each training's keyword list.

function inferTraining(documents: ComplianceDocument[]): RequiredTraining[] {
  const trainingDocs = documents.filter(
    (d) => d.document_type === 'training_certificate'
  )
  const found: RequiredTraining[] = []
  for (const training of REQUIRED_TRAINING) {
    const keywords = TRAINING_KEYWORDS[training]
    const matched  = trainingDocs.some((doc) => {
      const name = doc.file_name.toLowerCase()
      return keywords.some((kw) => name.includes(kw))
    })
    if (matched) found.push(training)
  }
  return found
}

// ── Main calculator ───────────────────────────────────────────────────────────

export function calculateCompliance(
  documents: ComplianceDocument[]
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

  // ── Training checks ────────────────────────────────────────────────────────
  const inferredTraining = inferTraining(documents)
  const missingTraining  = REQUIRED_TRAINING.filter(
    (t) => !inferredTraining.includes(t)
  )

  // ── Compliance percentage ──────────────────────────────────────────────────
  // Each required item is either compliant or not.
  // Missing + expired documents count as non-compliant.
  // Expiring-soon documents are still compliant (just warned).
  // Missing training counts as non-compliant.
  const totalRequired  = REQUIRED_DOCUMENTS.length + REQUIRED_TRAINING.length
  const totalIssues    = missingDocuments.length + expiredDocuments.length + missingTraining.length
  const compliantItems = Math.max(0, totalRequired - totalIssues)
  const percentage     = totalRequired === 0
    ? 100
    : Math.round((compliantItems / totalRequired) * 100)

  const compliant =
    missingDocuments.length  === 0 &&
    expiredDocuments.length  === 0 &&
    missingTraining.length   === 0

  return {
    percentage,
    missingDocuments,
    expiredDocuments,
    expiringSoon,
    missingTraining,
    inferredTraining,
    compliant,
  }
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
