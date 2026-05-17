// lib/compliance/riskScore.ts
//
// Per-staff and org-wide compliance risk scoring.
//
// Risk score: 0 (no risk) → 100 (highest risk)
// Risk level: low | medium | high | critical
//
// Factors:
//   - Compliance state (blocked/non_compliant/warning/compliant)
//   - Number of expired documents
//   - Critical expiries (≤7 days)
//   - Whether required documents (DBS/RTW) are missing or expired

import type { ComplianceState } from './calculateCompliance'
import type { ExpiryBand }      from './expiryBands'

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export const RISK_LEVEL_CLS: Record<RiskLevel, string> = {
  low:      'bg-green-50  text-green-700  ring-green-600/20',
  medium:   'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  high:     'bg-orange-50 text-orange-700 ring-orange-600/20',
  critical: 'bg-red-50    text-red-700    ring-red-600/20',
}

export const RISK_LEVEL_LABEL: Record<RiskLevel, string> = {
  low:      'Low risk',
  medium:   'Medium risk',
  high:     'High risk',
  critical: 'Critical',
}

export interface ExpiringItemSummary {
  type:       string
  expiryDate: string
  band:       ExpiryBand
}

// ── Per-staff risk scoring ────────────────────────────────────────────────────

/**
 * Returns a risk score (0–100) and level for a single staff member.
 *
 * Score breakdown:
 *   blocked:       80–100 base
 *   non_compliant: 55–79  base
 *   warning:       20–54  based on band criticality
 *   compliant:     0–19
 */
export function staffRiskScore(
  state:         ComplianceState,
  missingDocs:   string[],
  missingTraining: string[],
  expiringSoon:  ExpiringItemSummary[],
): number {
  let score = 0

  switch (state) {
    case 'blocked':      score = 80; break
    case 'non_compliant': score = 55; break
    case 'warning':      score = 20; break
    case 'compliant':    score = 0;  break
  }

  // Missing critical docs (DBS, RTW) are especially serious
  const criticalMissing = missingDocs.filter((d) =>
    d === 'dbs' || d === 'right_to_work' || d === 'passport'
  ).length
  score += criticalMissing * 5

  // Missing training items
  score += Math.min(10, missingTraining.length * 2)

  // Critical expiries (≤7 days)
  const criticalExpiring = expiringSoon.filter((e) => e.band === 'critical').length
  score += criticalExpiring * 4

  // Expired items in the expiring list
  const expired = expiringSoon.filter((e) => e.band === 'expired').length
  score += expired * 3

  return Math.min(100, Math.max(0, score))
}

export function staffRiskLevel(score: number): RiskLevel {
  if (score >= 75) return 'critical'
  if (score >= 50) return 'high'
  if (score >= 20) return 'medium'
  return 'low'
}

// ── Org-wide risk score ───────────────────────────────────────────────────────

export interface OrgRiskInput {
  complianceState: ComplianceState
  percentage:      number
  missingDocs:     string[]
  missingTraining: string[]
  expiringSoon:    ExpiringItemSummary[]
}

export interface OrgRiskResult {
  score:       number   // 0-100 health score (100 = fully compliant)
  riskScore:   number   // 0-100 risk score (100 = highest risk)
  level:       RiskLevel
  breakdown: {
    total:        number
    compliant:    number
    warning:      number
    nonCompliant: number
    blocked:      number
  }
  topRisk: Array<{ index: number; score: number; level: RiskLevel }>
}

/**
 * Calculates an org-wide compliance health score and risk level from an
 * array of staff compliance inputs.
 */
export function calculateOrgRisk(rows: OrgRiskInput[]): OrgRiskResult {
  if (rows.length === 0) {
    return {
      score:     100,
      riskScore: 0,
      level:     'low',
      breakdown: { total: 0, compliant: 0, warning: 0, nonCompliant: 0, blocked: 0 },
      topRisk:   [],
    }
  }

  const breakdown = { total: rows.length, compliant: 0, warning: 0, nonCompliant: 0, blocked: 0 }
  for (const r of rows) {
    switch (r.complianceState) {
      case 'compliant':     breakdown.compliant++;     break
      case 'warning':       breakdown.warning++;       break
      case 'non_compliant': breakdown.nonCompliant++;  break
      case 'blocked':       breakdown.blocked++;       break
    }
  }

  // Health score: compliant + (warning * 0.7) + (non_compliant * 0.3) + (blocked * 0)
  const weightedCompliant =
    breakdown.compliant     * 1.0 +
    breakdown.warning       * 0.7 +
    breakdown.nonCompliant  * 0.3 +
    breakdown.blocked       * 0.0

  const score     = Math.round((weightedCompliant / rows.length) * 100)
  const riskScore = 100 - score

  let level: RiskLevel = 'low'
  if      (riskScore >= 75) level = 'critical'
  else if (riskScore >= 50) level = 'high'
  else if (riskScore >= 20) level = 'medium'

  // Identify top-risk staff (by index in input array)
  const scored = rows.map((r, i) => ({
    index: i,
    score: staffRiskScore(r.complianceState, r.missingDocs, r.missingTraining, r.expiringSoon),
    level: staffRiskLevel(staffRiskScore(r.complianceState, r.missingDocs, r.missingTraining, r.expiringSoon)),
  }))
  scored.sort((a, b) => b.score - a.score)

  return {
    score,
    riskScore,
    level,
    breakdown,
    topRisk: scored.slice(0, 10),
  }
}
