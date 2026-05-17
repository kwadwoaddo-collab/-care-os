// ── Deployability Score (0–100) ───────────────────────────────────────────────
//
// Measures how operationally ready a staff member is.
// 100 = fully ready, 0 = cannot be deployed.
//
// Deductions:
//   Compliance gap   up to -40  (scales with compliance percentage)
//   Onboarding gap   up to -30  (scales with onboarding progress)
//   DBS missing           -10
//   RTW missing           -10
//   No availability        -5
//   Open incidents    up to -15  (-5 per open/investigating incident)
//   Expiring soon     up to -10  (-3 per expiring item)
//   Declined shifts   up to -10  (-3 per 3 declines in last 30 days)

export interface DeployabilityScoreInput {
  status:               string
  compliancePercent:    number   // 0-100
  onboardingProgress:   number   // 0-100
  onboardingComplete:   boolean
  dbsChecked:           boolean
  rtwChecked:           boolean
  hasAvailability:      boolean
  openIncidents:        number   // count of open/investigating incidents
  expiringSoonCount:    number   // items expiring within 14 days
  declinedLast30Days:   number   // shift declines in last 30 days
}

export function calculateDeployabilityScore(input: DeployabilityScoreInput): number {
  if (input.status === 'terminated' || input.status === 'inactive') return 0
  if (input.status === 'suspended') return 5
  if (input.status === 'pre_employment') return Math.round(input.onboardingProgress * 0.3)

  let score = 100

  // Compliance gap: penalise proportionally to how far below 100% they are
  const complianceGap = 100 - input.compliancePercent
  score -= Math.round(complianceGap * 0.4)

  // Onboarding incomplete: penalise remaining gap
  if (!input.onboardingComplete) {
    const onboardingGap = 100 - input.onboardingProgress
    score -= Math.round(onboardingGap * 0.3)
  }

  if (!input.dbsChecked)      score -= 10
  if (!input.rtwChecked)      score -= 10
  if (!input.hasAvailability) score -= 5

  score -= Math.min(15, input.openIncidents * 5)
  score -= Math.min(10, input.expiringSoonCount * 3)
  score -= Math.min(10, Math.floor(input.declinedLast30Days / 3) * 3)

  return Math.max(0, Math.min(100, Math.round(score)))
}

// Score tier labels for UI display
export type ScoreTier = 'high' | 'medium' | 'low' | 'critical'

export function scoreTier(score: number): ScoreTier {
  if (score >= 80) return 'high'
  if (score >= 60) return 'medium'
  if (score >= 30) return 'low'
  return 'critical'
}

export const SCORE_TIER_CLS: Record<ScoreTier, string> = {
  high:     'text-green-700',
  medium:   'text-yellow-700',
  low:      'text-orange-700',
  critical: 'text-red-700',
}
