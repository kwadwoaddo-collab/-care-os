import {
  calculateCompliance,
  complianceTier,
  type ComplianceDocument,
  type ComplianceSummary,
  type ComplianceTier,
  type ComplianceState,
} from './calculateCompliance'

export type { ComplianceState }

export const COMPLIANCE_STATE_CLS: Record<ComplianceState, string> = {
  compliant:     'bg-green-50  text-green-700  ring-green-600/20',
  warning:       'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  non_compliant: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  blocked:       'bg-red-50    text-red-700    ring-red-600/20',
}

export const COMPLIANCE_STATE_LABEL: Record<ComplianceState, string> = {
  compliant:     'Compliant',
  warning:       'Warning',
  non_compliant: 'Non-compliant',
  blocked:       'Blocked',
}

export interface ComplianceSnapshot extends ComplianceSummary {
  tier:             ComplianceTier
  hasExpired:       boolean
  state:            ComplianceState
}

export function buildComplianceSnapshot(
  documents: ComplianceDocument[],
  jobRole?: string | null
): ComplianceSnapshot {
  const summary = calculateCompliance(documents, jobRole)
  return {
    ...summary,
    tier:             complianceTier(summary.percentage),
    hasExpired:       summary.expiredDocuments.length > 0 || summary.expiredTraining.length > 0,
    state:            summary.complianceState,
  }
}
