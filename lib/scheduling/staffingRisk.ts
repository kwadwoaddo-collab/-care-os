// lib/scheduling/staffingRisk.ts
//
// Detects structural staffing risks across the workforce:
// single points of failure, role shortages, weekend/night coverage gaps,
// and expiry clusters that could deplete a role.

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low'

export type StaffingRiskType =
  | 'single_point_of_failure'
  | 'role_shortage'
  | 'weekend_coverage_low'
  | 'night_coverage_low'
  | 'expiry_cluster'

export interface StaffingRisk {
  id:             string
  type:           StaffingRiskType
  level:          RiskLevel
  title:          string
  description:    string
  affectedRole?:  string
  count:          number
  threshold:      number
  recommendation: string
}

export interface RoleCounts {
  deployable:  number
  atRisk:      number
  blocked:     number
  onboarding:  number
  total:       number
}

export interface StaffingRiskInput {
  staffByRole:          Map<string, RoleCounts>
  totalDeployable:      number
  canWorkWeekends:      number
  canWorkNights:        number
  expiryClustersByRole: Array<{ role: string; count: number; days: number }>
}

const WEEKEND_MIN = 2
const NIGHT_MIN   = 2

export function detectStaffingRisks(input: StaffingRiskInput): StaffingRisk[] {
  const risks: StaffingRisk[] = []

  // ── Single points of failure ──────────────────────────────────────────────
  // Only 1 deployable for a role that has ≥ 2 total staff

  for (const [role, counts] of input.staffByRole.entries()) {
    if (counts.total < 2) continue

    if (counts.deployable === 1) {
      const inPipeline = counts.onboarding + counts.blocked
      risks.push({
        id:          `spof_${role}`,
        type:        'single_point_of_failure',
        level:       'critical',
        title:       `Single point of failure: ${role.replace(/_/g, ' ')}`,
        description: `Only 1 deployable worker for the "${role.replace(/_/g, ' ')}" role out of ${counts.total} total. If this worker is unavailable, the role is uncovered.`,
        affectedRole: role,
        count:        counts.deployable,
        threshold:    2,
        recommendation: inPipeline > 0
          ? `Resolve compliance or onboarding blocks for ${inPipeline} worker${inPipeline !== 1 ? 's' : ''} in this role to expand coverage.`
          : 'Recruit additional staff for this role as a priority.',
      })
    }
  }

  // ── Role shortage ─────────────────────────────────────────────────────────
  // < 2 deployable for a role with ≥ 3 total and no SPOF already flagged

  for (const [role, counts] of input.staffByRole.entries()) {
    if (counts.total < 3) continue
    if (counts.deployable === 1) continue // already flagged as SPOF
    if (counts.deployable > 1) continue   // has enough

    const inPipeline = counts.onboarding + counts.blocked
    const reason = counts.blocked > 0
      ? `${counts.blocked} worker${counts.blocked !== 1 ? 's' : ''} blocked by compliance issues`
      : `${counts.onboarding} worker${counts.onboarding !== 1 ? 's' : ''} still in onboarding`

    risks.push({
      id:          `shortage_${role}`,
      type:        'role_shortage',
      level:       'high',
      title:       `Insufficient deployable staff: ${role.replace(/_/g, ' ')}`,
      description: `0 of ${counts.total} "${role.replace(/_/g, ' ')}" staff are deployable (${reason}).`,
      affectedRole: role,
      count:        0,
      threshold:    2,
      recommendation: inPipeline > 0
        ? 'Resolve compliance or onboarding blocks immediately for this role.'
        : 'Review role assignments and recruit additional staff.',
    })
  }

  // ── Weekend coverage ──────────────────────────────────────────────────────

  if (input.totalDeployable > 0 && input.canWorkWeekends < WEEKEND_MIN) {
    risks.push({
      id:          'weekend_coverage',
      type:        'weekend_coverage_low',
      level:       input.canWorkWeekends === 0 ? 'critical' : 'high',
      title:       'Low weekend coverage',
      description: `Only ${input.canWorkWeekends} deployable staff ${input.canWorkWeekends === 1 ? 'is' : 'are'} available for weekend shifts. Weekend care continuity is at risk.`,
      count:        input.canWorkWeekends,
      threshold:    WEEKEND_MIN,
      recommendation: 'Review weekend availability with current staff. Update their availability profiles or recruit staff with weekend availability.',
    })
  }

  // ── Night staff ────────────────────────────────────────────────────────────

  if (input.totalDeployable > 0 && input.canWorkNights < NIGHT_MIN) {
    risks.push({
      id:          'night_coverage',
      type:        'night_coverage_low',
      level:       input.canWorkNights === 0 ? 'critical' : 'high',
      title:       'Insufficient night-shift coverage',
      description: `Only ${input.canWorkNights} deployable staff ${input.canWorkNights === 1 ? 'is' : 'are'} flagged as night-shift capable.`,
      count:        input.canWorkNights,
      threshold:    NIGHT_MIN,
      recommendation: 'Confirm night availability with current staff and update their profiles. Consider targeted recruitment for night-shift workers.',
    })
  }

  // ── Expiry clusters ────────────────────────────────────────────────────────

  for (const cluster of input.expiryClustersByRole) {
    if (cluster.count < 2) continue
    risks.push({
      id:          `expiry_cluster_${cluster.role}`,
      type:        'expiry_cluster',
      level:       cluster.count >= 4 ? 'critical' : cluster.count >= 3 ? 'high' : 'medium',
      title:       `Compliance expiry cluster: ${cluster.role.replace(/_/g, ' ')}`,
      description: `${cluster.count} workers in the "${cluster.role.replace(/_/g, ' ')}" role have compliance items expiring within ${cluster.days} days. This could simultaneously reduce deployable capacity for this role.`,
      affectedRole: cluster.role,
      count:        cluster.count,
      threshold:    1,
      recommendation: `Send compliance reminders to all affected workers in this role. Schedule renewals urgently to prevent simultaneous compliance failures.`,
    })
  }

  const ORDER: Record<RiskLevel, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  return risks.sort((a, b) => ORDER[a.level] - ORDER[b.level] || b.count - a.count)
}
