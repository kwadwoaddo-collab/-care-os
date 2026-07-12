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
  success:  { base: 'bg-success/10 text-success-text border border-success/20' },
  warning:  { base: 'bg-warning/10 text-warning-text border border-warning/20' },
  error:    { base: 'bg-error/10 text-error-text border border-error/20' },
  info:     { base: 'bg-primary/10 text-primary border border-primary/20' },
  neutral:  { base: 'bg-foreground/5 text-foreground/60 border border-foreground/10' },
  pending:  { base: 'bg-warning/10 text-warning-text border border-warning/20' },
  approved: { base: 'bg-success/10 text-success-text border border-success/20', prefix: '✓' },
  rejected: { base: 'bg-error/10 text-error-text border border-error/20', prefix: '✕' },
  expired:  { base: 'bg-error/10 text-error-text border border-error/20', prefix: '!' },
  expiring: { base: 'bg-warning/10 text-warning-text border border-warning/20', prefix: 'exp' },
  missing:  { base: 'bg-error/10 text-error-text border border-error/20', prefix: '✕' },
}

// ── Size config ───────────────────────────────────────────────────────────────

const SIZE_CLS: Record<'xs' | 'sm', string> = {
  xs: 'px-2 py-0.5 text-[9px] font-bold tracking-wider',
  sm: 'px-2.5 py-0.5 text-[10px] font-semibold tracking-wide',
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
    success:  'bg-success',
    warning:  'bg-warning',
    error:    'bg-error',
    info:     'bg-primary',
    neutral:  'bg-foreground/40',
    pending:  'bg-warning',
    approved: 'bg-success',
    rejected: 'bg-error',
    expired:  'bg-error',
    expiring: 'bg-warning',
    missing:  'bg-error',
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full uppercase ${def.base} ${sizeCls} ${className}`}
      aria-label={ariaLabel ?? `Status: ${label}`}
      role="status"
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT_COLOURS[variant] ?? 'bg-foreground/40'}`}
          aria-hidden="true"
        />
      )}
      {def.prefix && (
        <span className="shrink-0 font-bold" aria-hidden="true">{def.prefix}</span>
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
