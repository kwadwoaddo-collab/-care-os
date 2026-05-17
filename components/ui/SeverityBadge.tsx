/**
 * SeverityBadge — unified severity / priority / status badge.
 *
 * Replaces 48+ inline badge colour class patterns like:
 *   `bg-red-100 text-red-700`, `bg-amber-100 text-amber-700`, etc.
 *
 * Single source of truth for severity colour semantics across all modules:
 * incidents, compliance, anomalies, communications, operations queue.
 *
 * Usage:
 *   <SeverityBadge level="critical" />
 *   <SeverityBadge level="warning" label="Urgent" />
 *   <SeverityBadge level="info" label="Pilot" />
 *   <SeverityBadge level="success" label="Compliant" />
 *   <SeverityBadge level="neutral" label="Draft" />
 */

export type SeverityLevel =
  | 'critical'
  | 'high'
  | 'urgent'
  | 'warning'
  | 'medium'
  | 'success'
  | 'low'
  | 'info'
  | 'neutral'
  | 'pilot'
  | 'active'
  | 'inactive'

interface SeverityBadgeProps {
  level:       SeverityLevel
  label?:      string         // defaults to the level name
  size?:       'xs' | 'sm'
  className?:  string
  capitalize?: boolean
}

const LEVEL_CONFIG: Record<SeverityLevel, { cls: string; defaultLabel: string }> = {
  critical: { cls: 'bg-red-100 text-red-700',         defaultLabel: 'Critical' },
  high:     { cls: 'bg-orange-100 text-orange-700',   defaultLabel: 'High' },
  urgent:   { cls: 'bg-amber-100 text-amber-700',     defaultLabel: 'Urgent' },
  warning:  { cls: 'bg-amber-100 text-amber-700',     defaultLabel: 'Warning' },
  medium:   { cls: 'bg-amber-50 text-amber-600',      defaultLabel: 'Medium' },
  success:  { cls: 'bg-emerald-100 text-emerald-700', defaultLabel: 'Good' },
  low:      { cls: 'bg-slate-100 text-slate-600',     defaultLabel: 'Low' },
  info:     { cls: 'bg-blue-100 text-blue-700',       defaultLabel: 'Info' },
  neutral:  { cls: 'bg-slate-100 text-slate-500',     defaultLabel: 'None' },
  pilot:    { cls: 'bg-indigo-100 text-indigo-700',   defaultLabel: 'Pilot' },
  active:   { cls: 'bg-emerald-100 text-emerald-700', defaultLabel: 'Active' },
  inactive: { cls: 'bg-slate-100 text-slate-500',     defaultLabel: 'Inactive' },
}

const SIZE_CLS: Record<'xs' | 'sm', string> = {
  xs: 'px-2 py-0.5 text-[11px] font-semibold rounded-full',
  sm: 'px-2.5 py-1 text-xs font-semibold rounded-lg',
}

export default function SeverityBadge({
  level,
  label,
  size = 'xs',
  className = '',
  capitalize = true,
}: SeverityBadgeProps) {
  const { cls, defaultLabel } = LEVEL_CONFIG[level] ?? LEVEL_CONFIG.neutral
  const text = label ?? defaultLabel
  return (
    <span className={`inline-flex items-center ${SIZE_CLS[size]} ${cls} ${className}`}>
      {capitalize ? text.charAt(0).toUpperCase() + text.slice(1) : text}
    </span>
  )
}

// ── Convenience mappers ───────────────────────────────────────────────────────

export function incidentSeverityLevel(severity: string): SeverityLevel {
  switch (severity) {
    case 'critical': return 'critical'
    case 'high':     return 'high'
    case 'medium':   return 'medium'
    case 'low':      return 'low'
    default:         return 'neutral'
  }
}

export function priorityLevel(priority: string): SeverityLevel {
  switch (priority) {
    case 'critical':      return 'critical'
    case 'urgent':        return 'urgent'
    case 'warning':       return 'warning'
    case 'informational': return 'info'
    default:              return 'neutral'
  }
}

export function complianceLevel(status: string): SeverityLevel {
  switch (status) {
    case 'complete':    return 'success'
    case 'expiring':    return 'warning'
    case 'expired':     return 'critical'
    case 'missing':     return 'critical'
    case 'in_progress': return 'info'
    case 'rejected':    return 'high'
    default:            return 'neutral'
  }
}

export function shiftStatusLevel(status: string): SeverityLevel {
  switch (status) {
    case 'completed':   return 'success'
    case 'in_progress': return 'active'
    case 'accepted':    return 'success'
    case 'offered':     return 'info'
    case 'open':        return 'info'
    case 'declined':    return 'high'
    case 'missed':      return 'critical'
    case 'cancelled':   return 'neutral'
    default:            return 'neutral'
  }
}
