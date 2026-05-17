/**
 * TrendIndicator — standardised trend arrow with percentage change.
 *
 * Used in analytics pages to show period-over-period change.
 * Green = improvement (configurable via `upIsGood`).
 *
 * Usage:
 *   <TrendIndicator pct={34} upIsGood={false} />   // red up arrow (bad)
 *   <TrendIndicator pct={-12} upIsGood={true} />   // red down arrow (bad)
 *   <TrendIndicator pct={0} />                     // neutral
 */

interface TrendIndicatorProps {
  pct:        number       // percentage change (positive or negative)
  upIsGood?:  boolean      // true = rising is green, false = rising is red
  showAbs?:   boolean      // show absolute number instead of %
  value?:     number       // for showAbs
  className?: string
}

export default function TrendIndicator({
  pct,
  upIsGood = true,
  showAbs = false,
  value,
  className = '',
}: TrendIndicatorProps) {
  const isPositive = pct > 0
  const isNeutral  = pct === 0

  const isGood = isNeutral ? null : (upIsGood ? isPositive : !isPositive)
  const colour = isNeutral ? 'text-slate-400' : isGood ? 'text-emerald-600' : 'text-red-600'
  const arrow  = isNeutral ? '→' : isPositive ? '↑' : '↓'
  const label  = showAbs && value !== undefined
    ? `${arrow} ${Math.abs(value)}`
    : `${arrow} ${Math.abs(pct)}%`

  return (
    <span className={`text-[11px] font-semibold ${colour} ${className}`} aria-label={`${pct > 0 ? 'increased' : pct < 0 ? 'decreased' : 'unchanged'} by ${Math.abs(pct)}%`}>
      {label}
    </span>
  )
}

// ── Inline Sparkline ──────────────────────────────────────────────────────────

interface SparklineProps {
  data:       number[]
  colour?:    string
  width?:     number
  height?:    number
}

export function Sparkline({ data, colour = '#4f46e5', width = 80, height = 32 }: SparklineProps) {
  if (data.length < 2) return null
  const max  = Math.max(...data, 1)
  const pad  = 2
  const pts  = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2)
    const y = height - pad - ((v / max) * (height - pad * 2))
    return `${x},${y}`
  }).join(' ')
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0"
      aria-hidden="true"
    >
      <polyline
        points={pts}
        fill="none"
        stroke={colour}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
