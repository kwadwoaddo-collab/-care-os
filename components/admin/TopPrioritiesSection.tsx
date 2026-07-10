'use client'

import { useState, useCallback, useTransition } from 'react'
import Link from 'next/link'
import type {
  UnifiedPriorityItem,
  OrchestrationResult,
  PrioritySeverity,
  PriorityCategory,
} from '@/lib/operations/orchestration'
import { ACTION_LABELS } from '@/lib/operations/orchestration'

// ── Style maps ────────────────────────────────────────────────────────────────

const SEVERITY_BAR: Record<PrioritySeverity, string> = {
  critical:      'bg-red-500',
  urgent:        'bg-orange-400',
  warning:       'bg-yellow-400',
  informational: 'bg-slate-300',
}

const SEVERITY_BADGE: Record<PrioritySeverity, string> = {
  critical:      'bg-red-50    text-red-700    ring-1 ring-red-500/20',
  urgent:        'bg-orange-50 text-orange-700 ring-1 ring-orange-400/20',
  warning:       'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-400/20',
  informational: 'bg-slate-50  text-slate-500  ring-1 ring-slate-300/30',
}

const SEVERITY_LABEL: Record<PrioritySeverity, string> = {
  critical:      'Critical',
  urgent:        'Urgent',
  warning:       'Warning',
  informational: 'Info',
}

const CATEGORY_ICON: Record<PriorityCategory, string> = {
  safeguarding:          '🛡',
  compliance:            '📋',
  onboarding:            '📝',
  document_verification: '📄',
  workforce_readiness:   '👥',
  shift_coverage:        '📅',
  visit_anomaly:         '🏠',
  incident:              '⚠',
  communication:         '💬',
  wellbeing:             '❤',
  queue_item:            '✓',
}



// ── Subcomponents ─────────────────────────────────────────────────────────────

function SeverityDot({ severity }: { severity: PrioritySeverity }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${SEVERITY_BAR[severity]}`}
      aria-hidden="true"
    />
  )
}

function ScoreBar({ score }: { score: number }) {
  const colour = score >= 75 ? 'bg-red-500' : score >= 50 ? 'bg-orange-400' : score >= 25 ? 'bg-yellow-400' : 'bg-slate-300'
  return (
    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden" title={`Priority score: ${score}/100`}>
      <div className={`h-full rounded-full ${colour}`} style={{ width: `${score}%` }} />
    </div>
  )
}

interface ExplainabilityPanelProps {
  item: UnifiedPriorityItem
}

function ExplainabilityPanel({ item }: ExplainabilityPanelProps) {
  const { explainability: ex, impact } = item
  return (
    <div className="mt-3 pt-3 border-t border-slate-100 space-y-3 text-xs">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <p className="font-semibold text-slate-600 uppercase tracking-wide" style={{ fontSize: 10 }}>Why this appeared</p>
          <p className="text-slate-700">{ex.why}</p>
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-slate-600 uppercase tracking-wide" style={{ fontSize: 10 }}>What triggered it</p>
          <p className="text-slate-500">{ex.triggeredBy}</p>
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-red-600 uppercase tracking-wide" style={{ fontSize: 10 }}>If ignored</p>
          <p className="text-slate-700">{ex.consequence}</p>
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-green-700 uppercase tracking-wide" style={{ fontSize: 10 }}>Recommended action</p>
          <p className="text-slate-700">{ex.action}</p>
        </div>
      </div>

      {/* Operational impact */}
      {(impact.workerImpact || impact.clientImpact || impact.operationalImpact) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {impact.complianceBreach && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">Compliance breach risk</span>
          )}
          {impact.safeguardingRisk && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">Safeguarding risk</span>
          )}
          {impact.shiftUncovered && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700">Shift uncovered</span>
          )}
          {impact.workerImpact && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">{impact.workerImpact}</span>
          )}
          {impact.clientImpact && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700">{impact.clientImpact}</span>
          )}
        </div>
      )}

      {/* Grouped evidence */}
      {item.evidence && item.evidence.length > 0 && (
        <div className="space-y-1">
          <p className="font-semibold text-slate-600 uppercase tracking-wide" style={{ fontSize: 10 }}>Linked issues</p>
          {item.evidence.map((ev, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-slate-400 shrink-0" />
              <span className="text-slate-600">{ev.label}</span>
              {ev.href && (
                <Link href={ev.href} className="text-indigo-600 hover:underline ml-auto">View →</Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Action menu ───────────────────────────────────────────────────────────────

interface ActionMenuProps {
  item:     UnifiedPriorityItem
  onAction: (id: string, action: string, note?: string, snoozedUntil?: string) => void
  loading:  boolean
}

function ActionMenu({ item, onAction, loading }: ActionMenuProps) {
  const [open, setOpen] = useState(false)
  const [snoozeHours, setSnoozeHours] = useState('24')

  const snoozeUntil = () => {
    const d = new Date()
    d.setHours(d.getHours() + parseInt(snoozeHours, 10))
    return d.toISOString()
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={loading}
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        aria-label="Priority actions"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 top-8 z-20 w-48 bg-surface-container-lowest rounded-xl border border-slate-200 shadow-lg py-1">
            <button
              onClick={() => { onAction(item.id, 'acknowledged'); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Acknowledge
            </button>
            <button
              onClick={() => { onAction(item.id, 'assigned'); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Assign to me
            </button>
            <button
              onClick={() => { onAction(item.id, 'resolved'); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Mark resolved
            </button>
            <button
              onClick={() => { onAction(item.id, 'escalated'); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Escalate
            </button>
            <div className="border-t border-slate-100 mt-1 pt-1">
              <div className="px-3 py-1.5 flex items-center gap-2">
                <span className="text-xs text-slate-500">Snooze for</span>
                <select
                  value={snoozeHours}
                  onChange={(e) => setSnoozeHours(e.target.value)}
                  className="text-xs border border-slate-200 rounded px-1"
                >
                  <option value="2">2h</option>
                  <option value="24">24h</option>
                  <option value="48">48h</option>
                  <option value="168">1 week</option>
                </select>
                <button
                  onClick={() => { onAction(item.id, 'snoozed', undefined, snoozeUntil()); setOpen(false) }}
                  className="text-xs text-indigo-600 font-medium hover:underline"
                >
                  Snooze
                </button>
              </div>
            </div>
            <button
              onClick={() => { onAction(item.id, 'dismissed'); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              Dismiss
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Priority card ─────────────────────────────────────────────────────────────

interface PriorityCardProps {
  item:     UnifiedPriorityItem
  onAction: (id: string, action: string, note?: string, snoozedUntil?: string) => void
  loading:  boolean
}

function PriorityCard({ item, onAction, loading }: PriorityCardProps) {
  const [expanded, setExpanded] = useState(false)

  const isOverdue = (item.overdueBy ?? 0) > 0
  const hasOwner  = !!item.owner

  return (
    <article className="bg-surface-container-lowest rounded-xl border border-slate-200 overflow-hidden transition-shadow hover:shadow-sm">
      {/* Severity bar */}
      <div className={`h-1 ${SEVERITY_BAR[item.severity]}`} role="presentation" />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start gap-3">
          {/* Category icon + severity dot */}
          <div className="flex flex-col items-center gap-1 pt-0.5 shrink-0">
            <span className="text-base" aria-hidden="true">{CATEGORY_ICON[item.category]}</span>
            <SeverityDot severity={item.severity} />
          </div>

          {/* Title + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${SEVERITY_BADGE[item.severity]}`}>
                {SEVERITY_LABEL[item.severity]}
              </span>
              {item.isGroup && item.groupedCount && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200/40">
                  {item.groupedCount} linked issues
                </span>
              )}
              {isOverdue && (
                <span className="text-[11px] font-medium text-red-600">Overdue {item.overdueBy}d</span>
              )}
              {hasOwner && (
                <span className="text-[11px] text-slate-400">Owned by {item.owner}</span>
              )}
            </div>

            <h3 className="mt-1 text-sm font-semibold text-slate-900 leading-snug">{item.title}</h3>
            <p className="mt-0.5 text-xs text-slate-500 truncate">{item.description}</p>
          </div>

          {/* Score + actions */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex flex-col items-end gap-1">
              <span className="text-xs font-bold text-slate-700">{item.priorityScore}</span>
              <ScoreBar score={item.priorityScore} />
            </div>
            <ActionMenu item={item} onAction={onAction} loading={loading} />
          </div>
        </div>

        {/* Affected entities */}
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          {item.affectedWorker && (
            <Link
              href={item.affectedWorker.href ?? '#'}
              className="flex items-center gap-1 text-slate-600 hover:text-indigo-700"
            >
              <span aria-hidden="true">👤</span>
              <span>{item.affectedWorker.name}</span>
              {item.affectedWorker.role && (
                <span className="text-slate-400">· {item.affectedWorker.role.replace(/_/g, ' ')}</span>
              )}
            </Link>
          )}
          {item.affectedClient && (
            <span className="flex items-center gap-1 text-slate-600">
              <span aria-hidden="true">🏠</span>
              <span>{item.affectedClient.name}</span>
            </span>
          )}
          {item.affectedShift && (
            <span className="flex items-center gap-1 text-slate-600">
              <span aria-hidden="true">📅</span>
              <span>{item.affectedShift.shiftDate}</span>
            </span>
          )}
          {item.dueDate && (
            <span className="flex items-center gap-1 text-slate-500">
              <span aria-hidden="true">⏰</span>
              <span>Due {item.dueDate}</span>
            </span>
          )}
        </div>

        {/* Action row */}
        <div className="mt-3 flex items-center gap-3">
          {item.actionHref ? (
            <Link
              href={item.actionHref}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              {ACTION_LABELS[item.recommendedAction]}
            </Link>
          ) : (
            <button
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
              onClick={() => onAction(item.id, item.recommendedAction)}
            >
              {ACTION_LABELS[item.recommendedAction]}
            </button>
          )}

          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
            aria-expanded={expanded}
          >
            {expanded ? 'Hide' : 'Why this matters'}
            <svg
              className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" strokeWidth={2}
              viewBox="0 0 24 24" aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <span className="ml-auto text-[10px] text-slate-400">{item.sourceSystem}</span>
        </div>

        {expanded && <ExplainabilityPanel item={item} />}
      </div>
    </article>
  )
}

// ── Severity section ──────────────────────────────────────────────────────────

interface SeveritySectionProps {
  severity:  PrioritySeverity
  items:     UnifiedPriorityItem[]
  onAction:  (id: string, action: string, note?: string, snoozedUntil?: string) => void
  loading:   boolean
  collapsed: boolean
  onToggle:  () => void
}

function SeveritySection({ severity, items, onAction, loading, collapsed, onToggle }: SeveritySectionProps) {
  if (items.length === 0) return null

  const labels: Record<PrioritySeverity, string> = {
    critical:      'Critical',
    urgent:        'Urgent',
    warning:       'Warning',
    informational: 'Informational',
  }

  const headerCls: Record<PrioritySeverity, string> = {
    critical:      'text-red-700 bg-red-50 border-red-200',
    urgent:        'text-orange-700 bg-orange-50 border-orange-200',
    warning:       'text-yellow-700 bg-yellow-50 border-yellow-200',
    informational: 'text-slate-600 bg-slate-50 border-slate-200',
  }

  return (
    <section aria-label={`${labels[severity]} priorities`}>
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border font-semibold text-sm transition-colors ${headerCls[severity]}`}
        aria-expanded={!collapsed}
      >
        <span className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${SEVERITY_BAR[severity]}`} aria-hidden="true" />
          {labels[severity]}
          <span className="px-1.5 py-0.5 rounded-full text-[11px] bg-white/70 font-bold">
            {items.length}
          </span>
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${collapsed ? '-rotate-90' : ''}`}
          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {!collapsed && (
        <div className="mt-2 space-y-2">
          {items.map((item) => (
            <PriorityCard key={item.id} item={item} onAction={onAction} loading={loading} />
          ))}
        </div>
      )}
    </section>
  )
}

// ── Summary bar ───────────────────────────────────────────────────────────────

function SummaryBar({ summary }: { summary: OrchestrationResult['summary'] }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
      {summary.critical > 0 && (
        <span className="flex items-center gap-1.5 text-sm font-bold text-red-700">
          <span className="w-2 h-2 rounded-full bg-red-500" aria-hidden="true" />
          {summary.critical} Critical
        </span>
      )}
      {summary.urgent > 0 && (
        <span className="flex items-center gap-1.5 text-sm font-semibold text-orange-700">
          <span className="w-2 h-2 rounded-full bg-orange-400" aria-hidden="true" />
          {summary.urgent} Urgent
        </span>
      )}
      {summary.warning > 0 && (
        <span className="flex items-center gap-1.5 text-sm text-yellow-700">
          <span className="w-2 h-2 rounded-full bg-yellow-400" aria-hidden="true" />
          {summary.warning} Warning
        </span>
      )}
      {summary.informational > 0 && (
        <span className="flex items-center gap-1.5 text-sm text-slate-500">
          <span className="w-2 h-2 rounded-full bg-slate-300" aria-hidden="true" />
          {summary.informational} Info
        </span>
      )}
      <span className="ml-auto text-xs text-slate-400">{summary.total} total priorities</span>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface TopPrioritiesSectionProps {
  initialData?: OrchestrationResult | null
}

const SEVERITIES: PrioritySeverity[] = ['critical', 'urgent', 'warning', 'informational']

export default function TopPrioritiesSection({ initialData }: TopPrioritiesSectionProps) {
  const [data,        setData]        = useState<OrchestrationResult | null>(initialData ?? null)
  const [loading,     setLoading]     = useState(!initialData)
  const [error,       setError]       = useState<string | null>(null)
  const [focusMode,   setFocusMode]   = useState(false)
  const [collapsed,   setCollapsed]   = useState<Record<PrioritySeverity, boolean>>({
    critical:      false,
    urgent:        false,
    warning:       true,
    informational: true,
  })
  const [actionLoading, setActionLoading] = useState(false)
  const [, startTransition] = useTransition()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const url = `/api/admin/operations/priorities${focusMode ? '?focus=1' : ''}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to load priorities')
      const json: OrchestrationResult = await res.json()
      setData(json)
    } catch {
      setError('Could not load operational priorities. Please refresh.')
    } finally {
      setLoading(false)
    }
  }, [focusMode])

  // Initial load if no SSR data
  useState(() => {
    if (!initialData) { load() }
  })

  const handleAction = useCallback(async (
    priorityId: string,
    action: string,
    note?: string,
    snoozedUntil?: string,
  ) => {
    setActionLoading(true)
    try {
      await fetch('/api/admin/operations/priorities', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ priorityId, action, note, snoozedUntil }),
      })
      startTransition(() => { load() })
    } finally {
      setActionLoading(false)
    }
  }, [load])

  const toggleCollapsed = (sev: PrioritySeverity) => {
    setCollapsed((prev) => ({ ...prev, [sev]: !prev[sev] }))
  }

  const groupBySeverity = (priorities: UnifiedPriorityItem[]) => {
    const groups: Record<PrioritySeverity, UnifiedPriorityItem[]> = {
      critical: [], urgent: [], warning: [], informational: [],
    }
    for (const p of priorities) {
      groups[p.severity].push(p)
    }
    return groups
  }

  if (loading && !data) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 bg-slate-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
        <button onClick={load} className="ml-3 underline">Retry</button>
      </div>
    )
  }

  if (!data || data.priorities.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
        <p className="text-sm font-medium text-slate-600">No active priorities</p>
        <p className="text-xs text-slate-400 mt-1">All operational signals are within normal range.</p>
      </div>
    )
  }

  const groups = groupBySeverity(data.priorities)

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-slate-900">Top Priorities</h2>
          {loading && (
            <div className="w-3.5 h-3.5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              className="rounded"
              checked={focusMode}
              onChange={(e) => { setFocusMode(e.target.checked); setTimeout(load, 50) }}
            />
            Focus mode
          </label>
          <button
            onClick={load}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <SummaryBar summary={data.summary} />

      {/* Priority sections by severity */}
      <div className="space-y-3">
        {SEVERITIES.map((severity) => (
          <SeveritySection
            key={severity}
            severity={severity}
            items={groups[severity]}
            onAction={handleAction}
            loading={actionLoading}
            collapsed={collapsed[severity]}
            onToggle={() => toggleCollapsed(severity)}
          />
        ))}
      </div>

      <p className="text-[10px] text-slate-400 text-right">
        Generated {data.generatedAt ? new Date(data.generatedAt).toLocaleTimeString() : '—'}
      </p>
    </div>
  )
}
