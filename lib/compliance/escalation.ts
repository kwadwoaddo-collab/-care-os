// lib/compliance/escalation.ts
//
// Escalation rules engine for compliance non-compliance.
//
// Escalation ladder (in days non-compliant):
//   0 → worker_notified     (immediate — day 0)
//   3 → coordinator_escalated
//   7 → manager_escalated
//
// Pure functions — no DB or network access. Callers own persistence.

export type EscalationLevel =
  | 'none'
  | 'worker_notified'
  | 'coordinator_escalated'
  | 'manager_escalated'

export const ESCALATION_THRESHOLDS: Record<Exclude<EscalationLevel, 'none'>, number> = {
  worker_notified:       0,
  coordinator_escalated: 3,
  manager_escalated:     7,
}

export const ESCALATION_LABELS: Record<EscalationLevel, string> = {
  none:                    'No action',
  worker_notified:         'Worker notified',
  coordinator_escalated:   'Escalated to coordinator',
  manager_escalated:       'Escalated to compliance manager',
}

/**
 * Returns the escalation level for a staff member based on how many days
 * they have been non-compliant (or blocked).
 */
export function getEscalationLevel(daysNonCompliant: number): EscalationLevel {
  if (daysNonCompliant >= ESCALATION_THRESHOLDS.manager_escalated)     return 'manager_escalated'
  if (daysNonCompliant >= ESCALATION_THRESHOLDS.coordinator_escalated) return 'coordinator_escalated'
  if (daysNonCompliant >= ESCALATION_THRESHOLDS.worker_notified)       return 'worker_notified'
  return 'none'
}

/**
 * Returns true if the next escalation level hasn't been triggered yet
 * compared to the previous level. Used to decide whether to send a new
 * escalation notification vs. skip (already actioned).
 */
export function shouldEscalate(
  currentLevel: EscalationLevel,
  lastSentLevel: EscalationLevel | null,
): boolean {
  const ORDER: EscalationLevel[] = [
    'none',
    'worker_notified',
    'coordinator_escalated',
    'manager_escalated',
  ]
  const current = ORDER.indexOf(currentLevel)
  const last    = ORDER.indexOf(lastSentLevel ?? 'none')
  return current > last
}

/**
 * Computes days since a staff member became non-compliant.
 * Returns 0 if the date is null (treat as "just became non-compliant").
 */
export function daysNonCompliant(nonCompliantSince: string | null): number {
  if (!nonCompliantSince) return 0
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(nonCompliantSince).getTime()) / (1000 * 60 * 60 * 24)),
  )
}
