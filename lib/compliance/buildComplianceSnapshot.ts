import {
  calculateCompliance,
  complianceTier,
  type ComplianceDocument,
  type ComplianceSummary,
  type ComplianceTier,
} from './calculateCompliance'

export interface ComplianceSnapshot extends ComplianceSummary {
  tier:       ComplianceTier
  hasExpired: boolean
}

export function buildComplianceSnapshot(
  documents: ComplianceDocument[]
): ComplianceSnapshot {
  const summary = calculateCompliance(documents)
  return {
    ...summary,
    tier:       complianceTier(summary.percentage),
    hasExpired: summary.expiredDocuments.length > 0,
  }
}
