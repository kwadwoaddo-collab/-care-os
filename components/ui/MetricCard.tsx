/**
 * MetricCard — standardised KPI / stat display card.
 *
 * Replaces the repeated pattern of:
 *   <div className="bg-surface-container-lowest border border-slate-200 rounded-xl p-4">
 *     <p className="text-2xl font-bold text-slate-900">{value}</p>
 *     <p className="text-xs text-slate-500">{label}</p>
 *   </div>
 *
 * Usage:
 *   <MetricCard label="Active Staff" value={42} />
 *   <MetricCard label="Compliance Rate" value="87%" colour="emerald" />
 *   <MetricCard label="Critical Incidents" value={3} colour="red" trend="+2" trendUp />
 *   <MetricCard label="Onboarding" value={7} sub="pre-employment" />
 */

interface MetricCardProps {
  label:      string
  value:      string | number
  sub?:       string
  colour?:    'slate' | 'emerald' | 'amber' | 'red' | 'orange' | 'indigo' | 'blue' | 'purple'
  trend?:     string            // e.g. "+12%"
  trendUp?:   boolean           // true = up is good (green), false = up is bad (red)
  compact?:   boolean
  className?: string
}

const COLOUR_CLS: Record<NonNullable<MetricCardProps['colour']>, string> = {
  slate:   'text-slate-900',
  emerald: 'text-emerald-600',
  amber:   'text-amber-600',
  red:     'text-red-600',
  orange:  'text-orange-600',
  indigo:  'text-indigo-600',
  blue:    'text-blue-600',
  purple:  'text-purple-600',
}

export default function MetricCard({
  label,
  value,
  sub,
  colour = 'slate',
  trend,
  trendUp,
  compact = false,
  className = '',
}: MetricCardProps) {
  const padding  = compact ? 'p-4' : 'p-5'
  const valueSize = compact ? 'text-xl' : 'text-2xl'

  return (
    <div className={`bg-surface-container-lowest border border-slate-200 rounded-xl ${padding} ${className}`}>
      <p className={`${valueSize} font-bold ${COLOUR_CLS[colour]}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5 leading-tight">{label}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
      {trend && (
        <p className={`text-[11px] font-semibold mt-1 ${
          trendUp === undefined
            ? 'text-slate-500'
            : trendUp
              ? 'text-emerald-600'
              : 'text-red-600'
        }`}>
          {trend}
        </p>
      )}
    </div>
  )
}

// ── Grid wrapper ─────────────────────────────────────────────────────────────

interface MetricGridProps {
  children:   React.ReactNode
  cols?:      2 | 3 | 4 | 5 | 6 | 8
  className?: string
}

const GRID_CLS: Record<NonNullable<MetricGridProps['cols']>, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 md:grid-cols-3',
  4: 'grid-cols-2 md:grid-cols-4',
  5: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
  6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
  8: 'grid-cols-2 md:grid-cols-4 lg:grid-cols-8',
}

export function MetricGrid({ children, cols = 4, className = '' }: MetricGridProps) {
  return (
    <div className={`grid ${GRID_CLS[cols]} gap-3 ${className}`}>
      {children}
    </div>
  )
}
