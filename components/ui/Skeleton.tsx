/**
 * Skeleton — standardised loading placeholder.
 *
 * Replaces 39+ instances of ad-hoc `h-XX bg-slate-100 rounded-XX animate-pulse`
 * patterns scattered across the codebase.
 *
 * Usage:
 *   <Skeleton />                               // default: h-16 card row
 *   <Skeleton rows={4} />                      // 4 stacked rows
 *   <Skeleton variant="card" count={3} />      // 3 cards in a grid
 *   <Skeleton variant="kpi" count={6} />       // KPI bar
 *   <Skeleton variant="text" />                // inline text line
 *   <SkeletonTable rows={5} cols={4} />        // full table
 */

interface SkeletonProps {
  variant?: 'row' | 'card' | 'kpi' | 'text' | 'circle'
  count?:   number
  rows?:    number  // alias for count on row variant
  className?: string
}

function Pulse({ className }: { className: string }) {
  return <div className={`bg-slate-100 rounded animate-pulse ${className}`} aria-hidden="true" />
}

export default function Skeleton({ variant = 'row', count, rows, className = '' }: SkeletonProps) {
  const n = count ?? rows ?? 1

  if (variant === 'text') {
    return <Pulse className={`h-4 w-2/3 ${className}`} />
  }

  if (variant === 'circle') {
    return <Pulse className={`w-10 h-10 rounded-full ${className}`} />
  }

  if (variant === 'kpi') {
    return (
      <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 ${className}`} aria-label="Loading metrics">
        {Array.from({ length: n }).map((_, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
            <Pulse className="h-7 w-16" />
            <Pulse className="h-3 w-24" />
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'card') {
    return (
      <div className={`grid grid-cols-1 gap-4 ${className}`} aria-label="Loading content">
        {Array.from({ length: n }).map((_, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <Pulse className="h-5 w-1/3" />
            <Pulse className="h-4 w-full" />
            <Pulse className="h-4 w-4/5" />
          </div>
        ))}
      </div>
    )
  }

  // Default: row
  return (
    <div className={`space-y-2 ${className}`} aria-label="Loading">
      {Array.from({ length: n }).map((_, i) => (
        <Pulse key={i} className="h-14 w-full rounded-xl" />
      ))}
    </div>
  )
}

// ── Table skeleton ────────────────────────────────────────────────────────────

interface SkeletonTableProps {
  rows?: number
  cols?: number
}

export function SkeletonTable({ rows = 5, cols = 4 }: SkeletonTableProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden" aria-label="Loading table">
      {/* Header */}
      <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Pulse key={i} className="h-3 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, ri) => (
        <div key={ri} className="border-b border-slate-50 px-4 py-3.5 flex gap-4 items-center">
          {Array.from({ length: cols }).map((_, ci) => (
            <Pulse key={ci} className={`h-4 ${ci === 0 ? 'flex-[2]' : 'flex-1'}`} />
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Page-level loader ─────────────────────────────────────────────────────────

export function PageLoader() {
  return (
    <div className="flex items-center justify-center py-24" role="status" aria-label="Loading page">
      <span className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  )
}
