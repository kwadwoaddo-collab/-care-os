/**
 * StatusBadge — accessible, consistent status indicator
 *
 * Uses WCAG 2.1 AA contrast pairings (minimum 4.5:1 on white backgrounds):
 *   green-800 on green-100  ≈ 6.3:1
 *   red-800   on red-100    ≈ 6.1:1
 *   amber-800 on amber-100  ≈ 5.9:1
 *   blue-800  on blue-100   ≈ 5.8:1
 *   gray-700  on gray-100   ≈ 5.3:1
 */

// ── Variant config ────────────────────────────────────────────────────────────

export type BadgeVariant =
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'neutral'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'expiring'
  | 'missing'

interface VariantDef {
  base: string
  prefix?: string
  dot?: string
}

const VARIANTS: Record<BadgeVariant, VariantDef> = {
  success:  { base: 'bg-green-100 text-green-800 ring-green-700/20' },
  warning:  { base: 'bg-amber-100 text-amber-800 ring-amber-700/20' },
  error:    { base: 'bg-red-100   text-red-800   ring-red-700/20' },
  info:     { base: 'bg-blue-100  text-blue-800  ring-blue-700/20' },
  neutral:  { base: 'bg-gray-100  text-gray-700  ring-gray-500/20' },
  pending:  { base: 'bg-yellow-100 text-yellow-800 ring-yellow-700/20' },
  approved: { base: 'bg-green-100 text-green-800 ring-green-700/20', prefix: '✓' },
  rejected: { base: 'bg-red-100   text-red-800   ring-red-700/20',   prefix: '✕' },
  expired:  { base: 'bg-red-100   text-red-800   ring-red-700/20',   prefix: '⚠' },
  expiring: { base: 'bg-amber-100 text-amber-800 ring-amber-700/20', prefix: '⏰' },
  missing:  { base: 'bg-red-100   text-red-800   ring-red-700/20',   prefix: '✕' },
}

// ── Size config ───────────────────────────────────────────────────────────────

const SIZE_CLS: Record<'xs' | 'sm', string> = {
  xs: 'px-1.5 py-0.5 text-[10px] font-semibold tracking-wide',
  sm: 'px-2   py-0.5 text-xs    font-medium',
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  variant:    BadgeVariant
  label:      string
  size?:      'xs' | 'sm'
  ariaLabel?: string
  /** Show a small coloured status dot before the label */
  dot?:       boolean
  className?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StatusBadge({
  variant,
  label,
  size = 'xs',
  ariaLabel,
  dot = false,
  className = '',
}: StatusBadgeProps) {
  const def    = VARIANTS[variant]
  const sizeCls = SIZE_CLS[size]

  const DOT_COLOURS: Partial<Record<BadgeVariant, string>> = {
    success:  'bg-green-500',
    warning:  'bg-amber-500',
    error:    'bg-red-500',
    info:     'bg-blue-500',
    neutral:  'bg-gray-400',
    pending:  'bg-yellow-500',
    approved: 'bg-green-500',
    rejected: 'bg-red-500',
    expired:  'bg-red-500',
    expiring: 'bg-amber-500',
    missing:  'bg-red-500',
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md ring-1 ring-inset uppercase ${def.base} ${sizeCls} ${className}`}
      aria-label={ariaLabel ?? `Status: ${label}`}
      role="status"
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT_COLOURS[variant] ?? 'bg-gray-400'}`}
          aria-hidden="true"
        />
      )}
      {def.prefix && (
        <span className="shrink-0" aria-hidden="true">{def.prefix}</span>
      )}
      {label}
    </span>
  )
}

// ── Convenience helpers ───────────────────────────────────────────────────────

/**
 * Maps a document review status string to a StatusBadge variant.
 * Used by DocumentApprovalButton and DocumentComplianceHub.
 */
export function reviewStatusVariant(status: string | null | undefined): BadgeVariant {
  switch (status) {
    case 'approved':     return 'approved'
    case 'rejected':     return 'rejected'
    case 'under_review': return 'info'
    case 'pending':      return 'pending'
    default:             return 'neutral'
  }
}

/**
 * Maps a document expiry state to a StatusBadge variant.
 */
export function expiryVariant(expiryDate: string | null | undefined): BadgeVariant {
  if (!expiryDate) return 'neutral'
  const now    = new Date()
  const expiry = new Date(expiryDate)
  if (expiry < now) return 'expired'
  const diffDays = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  if (diffDays <= 30) return 'expiring'
  return 'success'
}

/**
 * Maps a staff/applicant status string to a StatusBadge variant.
 */
export function staffStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'active':        return 'success'
    case 'pre_employment': return 'warning'
    case 'suspended':     return 'warning'
    case 'terminated':    return 'error'
    case 'inactive':      return 'neutral'
    default:              return 'neutral'
  }
}

/**
 * Maps a compliance tier to a StatusBadge variant.
 */
export function complianceTierVariant(tier: 'green' | 'amber' | 'red'): BadgeVariant {
  switch (tier) {
    case 'green': return 'success'
    case 'amber': return 'warning'
    case 'red':   return 'error'
  }
}
