// ── Operational Feed — proactive staffing alerts ──────────────────────────────
//
// Generates coordinator-facing alerts that surface pressure before it becomes a
// crisis. Inputs are aggregate counts derived from the capacity calculation.

export type AlertLevel    = 'critical' | 'warning' | 'info'
export type AlertCategory = 'staffing' | 'compliance' | 'onboarding' | 'capacity'

export interface FeedAlert {
  id:       string
  level:    AlertLevel
  category: AlertCategory
  message:  string
  count?:   number
  href?:    string
}

export interface OperationalFeedInput {
  // Staff deployability counts
  deployable:             number
  atRisk:                 number
  nonDeployable:          number
  onboardingIncomplete:   number
  // Shift coverage
  uncoveredNext14d:       number
  // Compliance pressure
  expiringIn14d:          number   // staff who will drop deployable status in 14 days
  expiringIn30d:          number
  // Onboarding pipeline
  stalledInOnboarding:    number   // in_progress for 7+ days with no change
  pendingCertApprovals:   number
  missingReferences:      number
  // Role capacity (optional enrichment)
  roleShortages:          Array<{ role: string; deployable: number; threshold: number }>
  // Expiry clusters by role
  expiryClustersByRole:   Array<{ role: string; count: number; days: number }>
}

export function generateOperationalFeed(input: OperationalFeedInput): FeedAlert[] {
  const alerts: FeedAlert[] = []

  // Uncovered shifts
  if (input.uncoveredNext14d > 0) {
    alerts.push({
      id:       'uncovered_shifts',
      level:    input.uncoveredNext14d > 5 ? 'critical' : 'warning',
      category: 'staffing',
      message:  `${input.uncoveredNext14d} shift${pl(input.uncoveredNext14d)} in the next 14 days have no assigned worker`,
      count:    input.uncoveredNext14d,
      href:     '/admin/shifts/open',
    })
  }

  // Staff blocked from deployment
  if (input.nonDeployable > 0) {
    alerts.push({
      id:       'non_deployable',
      level:    'critical',
      category: 'compliance',
      message:  `${input.nonDeployable} staff member${pl(input.nonDeployable)} are blocked from shifts due to compliance issues`,
      count:    input.nonDeployable,
      href:     '/admin/compliance',
    })
  }

  // Imminent compliance expiry (within 14 days)
  if (input.expiringIn14d > 0) {
    alerts.push({
      id:       'expiring_14d',
      level:    'warning',
      category: 'compliance',
      message:  `${input.expiringIn14d} staff member${pl(input.expiringIn14d)} will lose deployable status within 14 days`,
      count:    input.expiringIn14d,
      href:     '/admin/compliance',
    })
  }

  // Compliance expiry within 30 days (softer warning)
  if (input.expiringIn30d > input.expiringIn14d) {
    const additional = input.expiringIn30d - input.expiringIn14d
    alerts.push({
      id:       'expiring_30d',
      level:    'info',
      category: 'compliance',
      message:  `${additional} further staff member${pl(additional)} have compliance expiring within 30 days`,
      count:    additional,
      href:     '/admin/compliance',
    })
  }

  // Stalled onboarding
  if (input.stalledInOnboarding > 0) {
    alerts.push({
      id:       'stalled_onboarding',
      level:    'warning',
      category: 'onboarding',
      message:  `${input.stalledInOnboarding} applicant${pl(input.stalledInOnboarding)} stalled in onboarding — no progress for 7+ days`,
      count:    input.stalledInOnboarding,
      href:     '/admin/onboarding?stage=in_progress',
    })
  }

  // Pending certificate approvals
  if (input.pendingCertApprovals > 0) {
    alerts.push({
      id:       'pending_certs',
      level:    'info',
      category: 'onboarding',
      message:  `${input.pendingCertApprovals} training certificate${pl(input.pendingCertApprovals)} awaiting admin review`,
      count:    input.pendingCertApprovals,
      href:     '/admin/staff',
    })
  }

  // Missing references
  if (input.missingReferences > 0) {
    alerts.push({
      id:       'missing_references',
      level:    'info',
      category: 'onboarding',
      message:  `${input.missingReferences} applicant${pl(input.missingReferences)} awaiting references`,
      count:    input.missingReferences,
      href:     '/admin/applicants',
    })
  }

  // Role shortages
  for (const shortage of input.roleShortages) {
    if (shortage.deployable < shortage.threshold) {
      const label = fmtRole(shortage.role)
      alerts.push({
        id:       `shortage_${shortage.role}`,
        level:    shortage.deployable === 0 ? 'critical' : 'warning',
        category: 'capacity',
        message:  `Only ${shortage.deployable} deployable ${label}${pl(shortage.deployable)} — below minimum coverage threshold`,
        count:    shortage.deployable,
        href:     '/admin/staff',
      })
    }
  }

  // Expiry clusters by role
  for (const cluster of input.expiryClustersByRole) {
    if (cluster.count >= 3) {
      const label = fmtRole(cluster.role)
      alerts.push({
        id:       `expiry_cluster_${cluster.role}`,
        level:    'warning',
        category: 'compliance',
        message:  `${cluster.count} ${label}s have compliance expiring within ${cluster.days} days`,
        count:    cluster.count,
        href:     '/admin/compliance',
      })
    }
  }

  // Sort: critical → warning → info, then by count descending
  const ORDER: Record<AlertLevel, number> = { critical: 0, warning: 1, info: 2 }
  alerts.sort((a, b) => {
    if (a.level !== b.level) return ORDER[a.level] - ORDER[b.level]
    return (b.count ?? 0) - (a.count ?? 0)
  })

  return alerts
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pl(n: number): string { return n !== 1 ? 's' : '' }
function fmtRole(r: string): string { return r.replace(/_/g, ' ') }
