// lib/compliance/status.ts
//
// Central compliance status engine.
// Calculates item-level status from compliance_items rows.
// Pure functions — no server-only imports so this is testable without Next.js.
//
// SOURCE OF TRUTH: compliance_items table (status enum + expires_at field).
// Separate from calculateCompliance.ts which works with uploaded documents.
// Both systems coexist: items track structured workflow state; documents track
// file-based evidence. This module covers the item-level state machine.

// ── Expiry threshold constants ────────────────────────────────────────────────
// Single source of truth for all compliance date logic.

/** Items expiring within this many days are "expiring soon" (urgent). */
export const EXPIRY_WARN_DAYS = 7

/** Items expiring within this many days trigger an advance notice. */
export const EXPIRY_NOTICE_DAYS = 30

// ── Item status type ──────────────────────────────────────────────────────────

/**
 * Derived runtime status for a compliance item.
 * Calculated from (DB status enum) + (expires_at date).
 */
export type ItemStatus =
  | 'compliant'      // complete, not expired, not expiring soon
  | 'expiring_soon'  // complete but expires within EXPIRY_NOTICE_DAYS
  | 'expired'        // status=expired OR expires_at is in the past
  | 'missing'        // status=not_started (no evidence at all)
  | 'rejected'       // status=rejected by reviewer
  | 'in_review'      // status=in_progress

// ── Date helpers ──────────────────────────────────────────────────────────────

function daysUntil(isoDate: string): number {
  return (new Date(isoDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
}

export function isExpired(isoDate: string | null): boolean {
  return isoDate !== null && daysUntil(isoDate) < 0
}

export function isExpiringSoon(isoDate: string | null): boolean {
  if (!isoDate) return false
  const days = daysUntil(isoDate)
  return days >= 0 && days <= EXPIRY_NOTICE_DAYS
}

/**
 * Returns the urgency level of an expiry date, or null if not approaching.
 * Useful for badge colouring: warning > notice > null.
 */
export function expiryUrgency(
  isoDate: string | null,
): 'expired' | 'warning' | 'notice' | null {
  if (!isoDate) return null
  const days = daysUntil(isoDate)
  if (days < 0)                   return 'expired'
  if (days <= EXPIRY_WARN_DAYS)   return 'warning'
  if (days <= EXPIRY_NOTICE_DAYS) return 'notice'
  return null
}

// ── Item status calculator ────────────────────────────────────────────────────

export interface ComplianceItemInput {
  /** Raw value from compliance_status DB enum */
  status:     string
  expires_at: string | null
}

/**
 * Derive the runtime status for a single compliance_items row.
 *
 * Priority order (high → low):
 *   rejected  → always rejected, regardless of dates
 *   missing   → not started, no evidence submitted
 *   in_review → submitted, awaiting decision
 *   expired   → status=expired OR (complete but date is past)
 *   expiring_soon → complete but date is approaching
 *   compliant → complete with valid or no expiry
 */
export function getItemStatus(item: ComplianceItemInput): ItemStatus {
  if (item.status === 'rejected')    return 'rejected'
  if (item.status === 'not_started') return 'missing'
  if (item.status === 'in_progress') return 'in_review'

  // Both the DB enum value AND a past expires_at count as expired
  if (item.status === 'expired' || isExpired(item.expires_at)) return 'expired'

  // complete — check the date
  if (isExpiringSoon(item.expires_at)) return 'expiring_soon'
  return 'compliant'
}

// ── Aggregate counts ──────────────────────────────────────────────────────────

export interface StatusCounts {
  compliant:     number
  expiring_soon: number
  expired:       number
  missing:       number
  rejected:      number
  in_review:     number
  total:         number
}

/** Aggregate status counts across an array of compliance items. */
export function classifyItems(items: ComplianceItemInput[]): StatusCounts {
  const counts: StatusCounts = {
    compliant:     0,
    expiring_soon: 0,
    expired:       0,
    missing:       0,
    rejected:      0,
    in_review:     0,
    total:         items.length,
  }
  for (const item of items) {
    counts[getItemStatus(item)]++
  }
  return counts
}

// ── Badge colour helper ───────────────────────────────────────────────────────

export const STATUS_BADGE_CLS: Record<ItemStatus, string> = {
  compliant:     'bg-green-50  text-green-700  ring-green-600/20',
  expiring_soon: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  expired:       'bg-red-50    text-red-700    ring-red-600/20',
  missing:       'bg-gray-50   text-gray-600   ring-gray-500/20',
  rejected:      'bg-red-50    text-red-700    ring-red-600/20',
  in_review:     'bg-blue-50   text-blue-700   ring-blue-600/20',
}

export const STATUS_LABEL: Record<ItemStatus, string> = {
  compliant:     'Compliant',
  expiring_soon: 'Expiring soon',
  expired:       'Expired',
  missing:       'Missing',
  rejected:      'Rejected',
  in_review:     'In review',
}
