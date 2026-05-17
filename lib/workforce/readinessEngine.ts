// ── Deployability classification engine ───────────────────────────────────────
//
// Classifies each staff member into one of six operational deployability states,
// then produces blockers and warnings that explain the classification.
//
// Priority order (highest wins):
//   1. inactive      — terminated or permanently inactive
//   2. suspended     — currently suspended
//   3. onboarding_incomplete — pre-employment or active with onboarding unfinished
//   4. non_deployable        — active + onboarding done + compliance blocked/non-compliant
//   5. deployable_with_risk  — active + onboarding done + compliance warning or partial gaps
//   6. deployable            — fully ready

export type DeployabilityState =
  | 'deployable'
  | 'deployable_with_risk'
  | 'non_deployable'
  | 'onboarding_incomplete'
  | 'suspended'
  | 'inactive'

export interface DeployabilityResult {
  state:    DeployabilityState
  blockers: string[]
  warnings: string[]
}

export interface ReadinessInput {
  status:             string
  onboardingComplete: boolean
  complianceState:    string   // compliant | warning | non_compliant | blocked
  compliancePercent:  number
  dbsChecked:         boolean
  rtwChecked:         boolean
  hasAvailability:    boolean
  activeOverride?:    boolean  // manual admin override — bypasses compliance gate
}

export function classifyDeployability(input: ReadinessInput): DeployabilityResult {
  const blockers: string[] = []
  const warnings: string[] = []

  if (input.status === 'terminated' || input.status === 'inactive') {
    return { state: 'inactive', blockers: ['Staff is no longer active'], warnings: [] }
  }

  if (input.status === 'suspended') {
    return { state: 'suspended', blockers: ['Staff is currently suspended'], warnings: [] }
  }

  if (input.status === 'pre_employment' || !input.onboardingComplete) {
    blockers.push('Onboarding not yet complete')
    return { state: 'onboarding_incomplete', blockers, warnings }
  }

  // Active + onboarding complete — evaluate compliance and readiness
  const isBlocked = input.complianceState === 'blocked' || input.complianceState === 'non_compliant'

  if (isBlocked && !input.activeOverride) {
    if (!input.dbsChecked)  blockers.push('DBS check not completed')
    if (!input.rtwChecked)  blockers.push('Right to work not verified')
    if (input.complianceState === 'blocked') blockers.push('Mandatory training missing or expired')
    else blockers.push('Compliance documents missing or expired')
    return { state: 'non_deployable', blockers, warnings }
  }

  // Compliance warning — still deployable but with flagged risk
  if (input.complianceState === 'warning') {
    warnings.push('One or more compliance items expiring soon')
  }

  if (!input.dbsChecked)  warnings.push('DBS check not recorded')
  if (!input.rtwChecked)  warnings.push('Right to work not recorded')
  if (!input.hasAvailability) warnings.push('No availability configured')
  if (input.activeOverride)   warnings.push('Compliance override active — manual admin approval')

  const state: DeployabilityState = warnings.length > 0 ? 'deployable_with_risk' : 'deployable'
  return { state, blockers, warnings }
}

// ── Display helpers ───────────────────────────────────────────────────────────

export const DEPLOYABILITY_LABEL: Record<DeployabilityState, string> = {
  deployable:           'Deployable',
  deployable_with_risk: 'At risk',
  non_deployable:       'Blocked',
  onboarding_incomplete: 'Onboarding',
  suspended:            'Suspended',
  inactive:             'Inactive',
}

export const DEPLOYABILITY_CLS: Record<DeployabilityState, string> = {
  deployable:            'bg-green-50  text-green-700  ring-green-600/20',
  deployable_with_risk:  'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  non_deployable:        'bg-red-50    text-red-700    ring-red-600/20',
  onboarding_incomplete: 'bg-blue-50   text-blue-700   ring-blue-600/20',
  suspended:             'bg-orange-50 text-orange-700 ring-orange-600/20',
  inactive:              'bg-gray-50   text-gray-500   ring-gray-400/20',
}
