'use client'

import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import type {
  OccSummary, FeedEvent, QueueItem,
  ShiftSummary, SafeguardingIncident, ComplianceAlert,
} from '@/lib/operations/priorityQueue'
import {
  getFocusMode, setFocusMode,
  getSectionCollapsed, toggleSectionCollapsed,
} from '@/lib/operations/workspaceMemory'

// ── Style maps ────────────────────────────────────────────────────────────────

const PRIORITY_CLS: Record<string, string> = {
  critical:      'bg-red-50    text-red-700    ring-red-600/20',
  urgent:        'bg-orange-50 text-orange-700 ring-orange-600/20',
  warning:       'bg-yellow-50 text-yellow-700 ring-yellow-500/20',
  informational: 'bg-gray-50   text-gray-500   ring-gray-300/40',
}

const SEVERITY_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high:     'bg-orange-400',
  medium:   'bg-yellow-400',
  low:      'bg-gray-300',
  info:     'bg-blue-300',
}

const FEED_TYPE_ICON: Record<string, string> = {
  incident:     '⚠',
  safeguarding: '🛡',
  compliance:   '📋',
  staffing:     '👥',
  handover:     '↕',
  queue:        '✓',
  override:     '🔓',
  onboarding:   '📝',
}

// ── Micro helpers ─────────────────────────────────────────────────────────────

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2)  return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7)  return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function PriBadge({ level }: { level: string }) {
  const cls = PRIORITY_CLS[level] ?? PRIORITY_CLS.informational
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-px text-[10px] font-semibold ring-1 ring-inset ${cls}`}>
      {level}
    </span>
  )
}

// ── Focus Mode toggle ─────────────────────────────────────────────────────────

function FocusModeToggle({
  enabled,
  onToggle,
}: {
  enabled:  boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={enabled}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-all ${
        enabled
          ? 'border-indigo-300 bg-indigo-600 text-white shadow-sm'
          : 'border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-gray-50'
      }`}
      title={enabled ? 'Focus Mode on — showing critical items only' : 'Enable Focus Mode'}
    >
      <span className="text-sm leading-none">{enabled ? '⚡' : '○'}</span>
      {enabled ? 'Focus' : 'Focus Mode'}
    </button>
  )
}

// ── Section wrapper with collapse ────────────────────────────────────────────

function CollapsibleSection({
  id, title, badge, children, _defaultOpen = true, focusModeForce,
}: {
  id:              string
  title:           string
  badge?:          React.ReactNode
  children:        React.ReactNode
  _defaultOpen?:    boolean
  focusModeForce?: boolean   // when focus mode is on, force-open critical sections
}) {
  const [collapsed, setCollapsed] = useState(() => {
    const stored = getSectionCollapsed(id)
    return stored
  })

  // Focus mode overrides: critical sections stay open
  const effectivelyCollapsed = focusModeForce ? false : collapsed

  function toggle() {
    const next = toggleSectionCollapsed(id)
    setCollapsed(next)
  }

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)]">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-gray-50/60 transition-colors rounded-xl"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">{title}</span>
          {badge}
        </div>
        <span className={`text-gray-400 text-xs transition-transform duration-200 ${effectivelyCollapsed ? '' : 'rotate-180'}`}>▼</span>
      </button>
      {!effectivelyCollapsed && (
        <div className="border-t border-outline-variant">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Smart empty state ─────────────────────────────────────────────────────────

function ClearState({ message, sub }: { message: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2.5 px-5 py-4">
      <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 text-xs flex items-center justify-center shrink-0 font-bold">✓</span>
      <div>
        <p className="text-sm text-gray-700 font-medium">{message}</p>
        {sub && <p className="text-xs text-on-surface-variant mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Contextual quick-action button ───────────────────────────────────────────

function QuickAction({
  label, href, variant = 'default', onClick,
}: {
  label:    string
  href?:    string
  variant?: 'default' | 'primary' | 'danger'
  onClick?: () => void
}) {
  const cls =
    variant === 'primary' ? 'bg-indigo-600 text-white hover:bg-indigo-700 border-indigo-600'
    : variant === 'danger'  ? 'bg-red-50 text-red-700 hover:bg-red-100 border-red-200'
    : 'bg-surface-container-lowest text-on-surface-variant hover:bg-gray-50 border-outline-variant'

  const base = `inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors min-h-[32px] ${cls}`

  if (href) {
    return <Link href={href} className={base}>{label}</Link>
  }
  return (
    <button onClick={onClick} className={base}>{label}</button>
  )
}

// ── KPI card (quieter version) ────────────────────────────────────────────────

function KpiCard({
  label, value, sub, accent, href, action,
}: {
  label:   string
  value:   string | number
  sub?:    string
  accent?: 'red' | 'orange' | 'yellow'
  href?:   string
  action?: { label: string; href: string }
}) {
  const valCls =
    accent === 'red'    ? 'text-red-600'
    : accent === 'orange' ? 'text-orange-600'
    : accent === 'yellow' ? 'text-yellow-700'
    : 'text-gray-800'

  const content = (
    <div className="flex flex-col gap-0.5 h-full">
      <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider leading-tight">{label}</p>
      <p className={`text-2xl font-bold tabular-nums leading-tight mt-0.5 ${valCls}`} style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>
        {value}
      </p>
      {sub && <p className="text-[11px] text-on-surface-variant leading-snug">{sub}</p>}
      {action && (
        <div className="mt-auto pt-2">
          <Link href={action.href} className="text-[10px] font-semibold text-indigo-600 hover:underline">{action.label} →</Link>
        </div>
      )}
    </div>
  )

  const base = 'bg-surface-container-lowest rounded-xl border border-outline-variant p-3.5 flex flex-col'
  const border = accent === 'red' ? 'border-l-4 border-l-red-400' : accent === 'orange' ? 'border-l-4 border-l-orange-400' : ''

  if (href) {
    return <Link href={href} className={`${base} ${border} hover:bg-gray-50/60 transition-colors`}>{content}</Link>
  }
  return <div className={`${base} ${border}`}>{content}</div>
}

// ── Shift coverage panel ──────────────────────────────────────────────────────

function ShiftCoverageSection({
  coverage, focusMode,
}: {
  coverage:  OccSummary['shift_coverage']
  focusMode: boolean
}) {
  const { total_shifts, covered, uncovered, uncovered_shifts } = coverage
  const pct = total_shifts > 0 ? Math.round((covered / total_shifts) * 100) : 100
  const isGood = uncovered === 0

  // In focus mode, hide this section if all shifts are covered
  if (focusMode && isGood && total_shifts > 0) return null

  return (
    <CollapsibleSection
      id="shift-coverage"
      title="Next 24h Coverage"
      badge={
        uncovered > 0 ? (
          <span className="text-[10px] font-bold text-red-600 bg-red-50 rounded px-1.5 py-0.5 ring-1 ring-red-200">{uncovered} uncovered</span>
        ) : total_shifts > 0 ? (
          <span className="text-[10px] font-bold text-green-600 bg-green-50 rounded px-1.5 py-0.5">100%</span>
        ) : null
      }
      focusModeForce={uncovered > 0}
    >
      <div className="px-5 py-4">
        {total_shifts === 0 ? (
          <ClearState message="No shifts scheduled in the next 24 hours." />
        ) : isGood ? (
          <ClearState message={`All ${total_shifts} shifts are covered.`} sub="Coverage is stable for the next 24 hours." />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${pct < 70 ? 'bg-red-500' : 'bg-yellow-400'}`} style={{ width: `${pct}%` }} />
              </div>
              <span className="text-sm font-bold tabular-nums text-gray-700">{pct}%</span>
              <Link href="/admin/shifts" className="text-xs text-indigo-600 hover:underline shrink-0">View →</Link>
            </div>
            <div className="space-y-1.5">
              {uncovered_shifts.map((s) => (
                <UncoveredShiftRow key={s.id} shift={s} />
              ))}
            </div>
          </div>
        )}
      </div>
    </CollapsibleSection>
  )
}

function UncoveredShiftRow({ shift }: { shift: ShiftSummary }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2.5">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-red-900 truncate">{shift.title}</p>
        {shift.client_name && <p className="text-[10px] text-red-700">{shift.client_name}</p>}
      </div>
      <span className="text-[10px] text-red-600 shrink-0 font-medium">{shift.start_time.slice(0, 5)}–{shift.end_time.slice(0, 5)}</span>
      <QuickAction label="Assign" href="/admin/shifts" variant="primary" />
    </div>
  )
}

// ── Safeguarding section ──────────────────────────────────────────────────────

function SafeguardingSection({
  data, focusMode,
}: {
  data:      OccSummary['safeguarding']
  focusMode: boolean
}) {
  if (data.open_count === 0) {
    if (focusMode) return null  // Fully hide in focus mode when clear
    return (
      <CollapsibleSection id="safeguarding" title="Safeguarding">
        <ClearState message="No active safeguarding escalations." sub="No unresolved safeguarding incidents at this time." />
      </CollapsibleSection>
    )
  }

  return (
    <CollapsibleSection
      id="safeguarding"
      title="Safeguarding"
      badge={<span className="text-[10px] font-bold text-white bg-red-600 rounded-full px-2 py-0.5">{data.open_count}</span>}
      focusModeForce
    >
      <div className="divide-y divide-outline-variant">
        {data.incidents.slice(0, 5).map((inc) => (
          <SafeguardingRow key={inc.id} inc={inc} />
        ))}
        {data.open_count > 5 && (
          <div className="px-5 py-3">
            <Link href="/admin/incidents?incident_type=safeguarding" className="text-xs text-indigo-600 hover:underline">
              View all {data.open_count} safeguarding incidents →
            </Link>
          </div>
        )}
      </div>
    </CollapsibleSection>
  )
}

function SafeguardingRow({ inc }: { inc: SafeguardingIncident }) {
  const sev = inc.severity
  const dotCls = sev === 'critical' ? 'bg-red-500' : sev === 'high' ? 'bg-orange-400' : 'bg-yellow-400'

  return (
    <div className="flex items-start gap-3 px-5 py-3">
      <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotCls}`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-800 line-clamp-1">{inc.description}</p>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-on-surface-variant">
          {inc.client_name && <span>{inc.client_name}</span>}
          {inc.occurred_at && (
            <span>{new Date(inc.occurred_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
          )}
          <PriBadge level={inc.severity} />
        </div>
      </div>
      <QuickAction label="Review" href={`/admin/incidents/${inc.id}`} variant="danger" />
    </div>
  )
}

// ── Priority queue section ────────────────────────────────────────────────────

function PriorityQueueSection({
  data, focusMode,
}: {
  data:      OccSummary['queue']
  focusMode: boolean
}) {
  const items = focusMode
    ? data.top_items.filter((i) => i.priority === 'critical' || i.priority === 'urgent')
    : data.top_items

  return (
    <CollapsibleSection
      id="priority-queue"
      title="Priority Queue"
      badge={
        data.total_open > 0 ? (
          <div className="flex items-center gap-1.5">
            {data.critical_count > 0 && (
              <span className="text-[10px] font-bold text-red-600 bg-red-50 rounded px-1.5 py-0.5 ring-1 ring-red-200">{data.critical_count} critical</span>
            )}
            {data.urgent_count > 0 && (
              <span className="text-[10px] font-bold text-orange-600 bg-orange-50 rounded px-1.5 py-0.5 ring-1 ring-orange-200">{data.urgent_count} urgent</span>
            )}
          </div>
        ) : null
      }
      focusModeForce={data.critical_count > 0 || data.urgent_count > 0}
    >
      {items.length === 0 ? (
        <ClearState
          message={focusMode ? 'No critical or urgent items right now.' : 'All operational queue items are resolved.'}
          sub={focusMode ? 'No high-priority actions are outstanding.' : undefined}
        />
      ) : (
        <div>
          <div className="divide-y divide-outline-variant">
            {items.map((item) => (
              <QueueRow key={item.id} item={item} />
            ))}
          </div>
          <div className="px-5 py-3 border-t border-outline-variant">
            <Link href="/admin/operations/queue" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
              Full queue — {data.total_open} open item{data.total_open !== 1 ? 's' : ''} →
            </Link>
          </div>
        </div>
      )}
    </CollapsibleSection>
  )
}

function QueueRow({ item }: { item: QueueItem }) {
  const [resolved, setResolved] = useState(false)
  const [, startT] = useTransition()

  function quickResolve() {
    startT(async () => {
      await fetch(`/api/admin/operations/queue/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved', resolved_by: 'Coordinator (quick resolve)' }),
      })
      setResolved(true)
    })
  }

  if (resolved) return null

  return (
    <div className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50/40 transition-colors">
      <PriBadge level={item.priority} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-800 leading-snug">{item.title}</p>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-on-surface-variant">
          <span className="capitalize">{item.category.replace(/_/g, ' ')}</span>
          {item.assigned_to && <span>→ {item.assigned_to}</span>}
          {item.due_date && (
            <span className="text-amber-700 font-medium">
              due {new Date(item.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {item.entity_url && (
          <QuickAction label="View" href={item.entity_url} />
        )}
        <QuickAction label="✓" onClick={quickResolve} variant="default" />
      </div>
    </div>
  )
}

// ── Live feed section ─────────────────────────────────────────────────────────

function LiveFeedSection({
  events, focusMode,
}: {
  events:    FeedEvent[]
  focusMode: boolean
}) {
  const filtered = focusMode
    ? events.filter((e) => e.severity === 'critical' || e.severity === 'high')
    : events

  // Deduplicate similar events (same type + entity within 10 min)
  const seen = new Set<string>()
  const deduped = filtered.filter((e) => {
    const key = `${e.type}:${e.entity_id ?? e.title.slice(0, 20)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return (
    <CollapsibleSection id="live-feed" title="Operational Feed">
      {deduped.length === 0 ? (
        <ClearState
          message={focusMode ? 'No critical or high-severity events recently.' : 'No recent operational events.'}
        />
      ) : (
        <div className="divide-y divide-outline-variant">
          {deduped.slice(0, focusMode ? 8 : 15).map((ev) => (
            <FeedRow key={ev.id} event={ev} />
          ))}
          {!focusMode && events.length > 15 && (
            <div className="px-5 py-3">
              <Link href="/admin/operations/feed" className="text-xs text-indigo-600 hover:underline">
                View full feed →
              </Link>
            </div>
          )}
        </div>
      )}
    </CollapsibleSection>
  )
}

function FeedRow({ event: ev }: { event: FeedEvent }) {
  const dotCls = SEVERITY_DOT[ev.severity] ?? 'bg-gray-300'
  const icon   = FEED_TYPE_ICON[ev.type] ?? '•'

  return (
    <div className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50/30 transition-colors">
      <div className="flex items-center gap-2 pt-0.5 shrink-0">
        <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
        <span className="text-sm leading-none w-4 text-center">{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-800 leading-snug">{ev.title}</p>
        <p className="text-[11px] text-on-surface-variant mt-0.5 line-clamp-1">{ev.description}</p>
        {ev.actor && <p className="text-[10px] text-gray-400">{ev.actor}</p>}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[10px] text-gray-400 whitespace-nowrap">{relTime(ev.occurred_at)}</span>
        {ev.entity_url && (
          <Link href={ev.entity_url} className="text-[10px] text-indigo-500 hover:underline whitespace-nowrap">→</Link>
        )}
      </div>
    </div>
  )
}

// ── Compliance alerts section ─────────────────────────────────────────────────

function ComplianceSection({
  alerts, focusMode,
}: {
  alerts:    ComplianceAlert[]
  focusMode: boolean
}) {
  // In focus mode only show expired or expiring ≤ 7 days
  const shown = focusMode
    ? alerts.filter((a) => a.is_expired || a.days_left <= 7)
    : alerts

  if (shown.length === 0) {
    if (focusMode) return null
    return (
      <CollapsibleSection id="compliance" title="Critical Compliance">
        <ClearState message="No critical compliance documents expiring soon." sub="DBS and right to work checks are up to date." />
      </CollapsibleSection>
    )
  }

  return (
    <CollapsibleSection
      id="compliance"
      title="Critical Compliance"
      badge={<span className="text-[10px] font-bold text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 ring-1 ring-amber-200">{shown.length}</span>}
      focusModeForce={shown.some((a) => a.is_expired)}
    >
      <div className="divide-y divide-outline-variant">
        {shown.slice(0, 6).map((a, i) => (
          <ComplianceRow key={i} alert={a} />
        ))}
        {shown.length > 6 && (
          <div className="px-5 py-3">
            <Link href="/admin/compliance" className="text-xs text-indigo-600 hover:underline">
              View all {shown.length} alerts →
            </Link>
          </div>
        )}
      </div>
    </CollapsibleSection>
  )
}

function ComplianceRow({ alert: a }: { alert: ComplianceAlert }) {
  const dotCls = a.is_expired ? 'bg-red-500' : a.days_left <= 7 ? 'bg-orange-400' : 'bg-yellow-400'
  const valCls = a.is_expired ? 'text-red-600 font-bold' : 'text-amber-700 font-semibold'

  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <span className={`w-2 h-2 rounded-full shrink-0 ${dotCls}`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-800 truncate">{a.staff_name}</p>
        <p className="text-[10px] text-on-surface-variant uppercase">{a.doc_type.replace(/_/g, ' ')}</p>
      </div>
      <span className={`text-xs ${valCls}`}>
        {a.is_expired ? 'Expired' : `${a.days_left}d`}
      </span>
      <QuickAction
        label={a.is_expired ? 'Urgent' : 'Renew'}
        href={`/admin/staff/${a.staff_id}`}
        variant={a.is_expired ? 'danger' : 'default'}
      />
    </div>
  )
}

// ── Handover section ──────────────────────────────────────────────────────────

function HandoverSection({
  handover, focusMode,
}: {
  handover:  OccSummary['latest_handover']
  focusMode: boolean
}) {
  // In focus mode, only show if there are flagged items
  const hasFlagged = Array.isArray(handover?.flagged_items) && handover!.flagged_items.length > 0
  if (focusMode && !hasFlagged) return null

  return (
    <CollapsibleSection id="handover" title="Handover">
      {!handover ? (
        <div className="px-5 py-4">
          <p className="text-xs text-on-surface-variant mb-2">No handover note for today's shift yet.</p>
          <QuickAction label="+ Create handover note" href="/admin/operations/handover" variant="primary" />
        </div>
      ) : (
        <div className="px-5 py-4">
          <div className="flex items-center gap-2 text-[11px] text-on-surface-variant mb-2">
            <span className="font-semibold text-gray-800">{handover.author_name}</span>
            <span>·</span>
            <span>{handover.shift_period}</span>
            <span>·</span>
            <span>{relTime(handover.created_at)}</span>
          </div>
          <p className="text-xs text-gray-700 leading-relaxed line-clamp-3">{handover.summary}</p>
          {Array.isArray(handover.flagged_items) && handover.flagged_items.length > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 rounded px-1.5 py-0.5">
                {handover.flagged_items.length} flagged
              </span>
              <QuickAction label="View all →" href="/admin/operations/handover" />
            </div>
          )}
        </div>
      )}
    </CollapsibleSection>
  )
}

// ── Critical banner ───────────────────────────────────────────────────────────

function CriticalBanner({ summary }: { summary: OccSummary }) {
  const items: string[] = []
  if (summary.safeguarding_alerts > 0)   items.push(`${summary.safeguarding_alerts} safeguarding`)
  if (summary.queue.critical_count > 0)  items.push(`${summary.queue.critical_count} critical queue`)
  if (summary.shift_coverage.uncovered > 0) items.push(`${summary.shift_coverage.uncovered} uncovered shifts`)

  if (items.length === 0) return null

  return (
    <div role="alert" className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm">
      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
      <p className="text-red-800 font-medium flex-1">
        {items.join(' · ')} {items.length > 1 ? 'require' : 'requires'} attention
      </p>
      <Link href="/admin/operations/queue" className="text-xs font-semibold text-red-700 hover:underline shrink-0">
        View queue →
      </Link>
    </div>
  )
}

// ── Focus Mode banner ─────────────────────────────────────────────────────────

function FocusModeBanner() {
  return (
    <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5 text-xs text-indigo-700">
      <span className="font-bold">⚡ Focus Mode</span>
      <span className="text-indigo-500">·</span>
      <span>Showing critical and urgent items only. Low-priority content is hidden.</span>
    </div>
  )
}

// ── Mobile quick-triage view ──────────────────────────────────────────────────

function MobileTriageView({
  summary,
  focusMode: _focusMode,
}: {
  summary:   OccSummary
  focusMode: boolean
}) {
  const criticalItems = [
    ...summary.safeguarding.incidents.map((i) => ({
      id:      `sg-${i.id}`,
      label:   `🛡 Safeguarding — ${i.severity}`,
      sub:     i.client_name ?? i.description.slice(0, 50),
      href:    `/admin/incidents/${i.id}`,
      urgent:  true,
    })),
    ...summary.shift_coverage.uncovered_shifts.map((s) => ({
      id:    `sh-${s.id}`,
      label: `👥 Uncovered shift`,
      sub:   `${s.title} · ${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}`,
      href:  '/admin/shifts',
      urgent: true,
    })),
    ...summary.compliance_alerts.filter((a) => a.is_expired || a.days_left <= 7).map((a, i) => ({
      id:    `ca-${i}`,
      label: `📋 ${a.doc_type.replace(/_/g, ' ').toUpperCase()} ${a.is_expired ? 'expired' : 'expiring'}`,
      sub:   `${a.staff_name} · ${a.is_expired ? 'now expired' : `${a.days_left}d left`}`,
      href:  `/admin/staff/${a.staff_id}`,
      urgent: a.is_expired,
    })),
    ...summary.queue.top_items.filter((i) => i.priority === 'critical' || i.priority === 'urgent').map((i) => ({
      id:    `q-${i.id}`,
      label: `⚠ ${i.title}`,
      sub:   `${i.priority} · ${i.category.replace(/_/g, ' ')}`,
      href:  i.entity_url ?? '/admin/operations/queue',
      urgent: i.priority === 'critical',
    })),
  ]

  if (criticalItems.length === 0) {
    return (
      <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3.5">
        <span className="w-5 h-5 rounded-full bg-green-200 flex items-center justify-center text-green-700 text-xs font-bold shrink-0">✓</span>
        <div>
          <p className="text-sm font-semibold text-green-800">Operations look clear</p>
          <p className="text-xs text-green-700 mt-0.5">No critical items require attention right now.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {criticalItems.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 active:scale-[0.99] transition-all ${
            item.urgent
              ? 'bg-red-50 border-red-200'
              : 'bg-amber-50 border-amber-200'
          }`}
        >
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold leading-snug ${item.urgent ? 'text-red-900' : 'text-amber-900'}`}>
              {item.label}
            </p>
            <p className={`text-xs mt-0.5 ${item.urgent ? 'text-red-700' : 'text-amber-700'}`}>{item.sub}</p>
          </div>
          <span className={`text-sm ${item.urgent ? 'text-red-400' : 'text-amber-400'}`}>›</span>
        </Link>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OperationsControlCenter({
  summary,
}: {
  summary: OccSummary
}) {
  const [focusMode, setFocusModeState] = useState(false)

  // Hydrate from localStorage after mount
  useEffect(() => {
    setFocusModeState(getFocusMode())
  }, [])

  function toggleFocus() {
    const next = !focusMode
    setFocusModeState(next)
    setFocusMode(next)
  }

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  const hasCritical =
    summary.safeguarding_alerts > 0 ||
    summary.queue.critical_count > 0 ||
    summary.shift_coverage.uncovered > 0

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-primary truncate" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>
            Operations
          </h1>
          <p className="text-xs text-on-surface-variant mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <FocusModeToggle enabled={focusMode} onToggle={toggleFocus} />
          <Link
            href="/admin/operations/handover"
            className="hidden lg:flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition-colors"
          >
            + Handover
          </Link>
          <Link
            href="/admin/operations/briefing"
            className="hidden lg:flex items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-xs font-medium text-primary hover:bg-gray-50 transition-colors"
          >
            Briefing
          </Link>
        </div>
      </div>

      {/* Focus mode banner */}
      {focusMode && <FocusModeBanner />}

      {/* Critical alert banner */}
      {hasCritical && <CriticalBanner summary={summary} />}

      {/* KPI row — primary metrics */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <KpiCard
          label="Open incidents"
          value={summary.open_incidents}
          sub={summary.overdue_follow_ups > 0 ? `${summary.overdue_follow_ups} overdue` : 'none overdue'}
          accent={summary.open_incidents > 0 ? 'orange' : undefined}
          href="/admin/incidents"
          action={summary.overdue_follow_ups > 0 ? { label: 'Review', href: '/admin/incidents' } : undefined}
        />
        <KpiCard
          label="Safeguarding"
          value={summary.safeguarding_alerts}
          sub={summary.safeguarding_alerts === 0 ? 'All clear' : 'Unresolved'}
          accent={summary.safeguarding_alerts > 0 ? 'red' : undefined}
          href="/admin/incidents?incident_type=safeguarding"
        />
        <KpiCard
          label="Uncovered shifts"
          value={summary.uncovered_shifts}
          sub="Next 7 days"
          accent={summary.uncovered_shifts > 3 ? 'red' : summary.uncovered_shifts > 0 ? 'orange' : undefined}
          href="/admin/shifts"
          action={summary.uncovered_shifts > 0 ? { label: 'Assign', href: '/admin/shifts' } : undefined}
        />
        <KpiCard
          label="Queue items"
          value={summary.queue.total_open}
          sub={summary.queue.critical_count > 0 ? `${summary.queue.critical_count} critical` : summary.queue.urgent_count > 0 ? `${summary.queue.urgent_count} urgent` : 'all clear'}
          accent={summary.queue.critical_count > 0 ? 'red' : summary.queue.urgent_count > 0 ? 'orange' : undefined}
          href="/admin/operations/queue"
        />
      </section>

      {/* Secondary KPIs — hidden in focus mode unless they have values */}
      {!focusMode && (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <KpiCard
            label="Onboarding stalls"
            value={summary.onboarding_stalls}
            sub=">14 days pending"
            accent={summary.onboarding_stalls > 2 ? 'orange' : undefined}
            href="/admin/onboarding"
          />
          <KpiCard
            label="Expiring docs"
            value={summary.expiring_critical_docs}
            sub="DBS / RTW (30d)"
            accent={summary.expiring_critical_docs > 0 ? 'yellow' : undefined}
            href="/admin/compliance"
          />
          <KpiCard
            label="Active overrides"
            value={summary.active_overrides}
            sub="Compliance bypasses"
            href="/admin/compliance"
          />
          <KpiCard
            label="Overdue follow-ups"
            value={summary.overdue_follow_ups}
            sub="Open incidents"
            accent={summary.overdue_follow_ups > 0 ? 'orange' : undefined}
            href="/admin/incidents"
          />
        </section>
      )}

      {/* Mobile triage list (lg:hidden) */}
      <div className="lg:hidden space-y-4">
        <MobileTriageView summary={summary} focusMode={focusMode} />

        {/* Mobile quick links */}
        <div className="grid grid-cols-2 gap-2">
          <Link href="/admin/operations/handover" className="flex items-center justify-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm font-semibold text-primary active:scale-[0.98] transition-all min-h-[48px]">
            ↕ Handover
          </Link>
          <Link href="/admin/operations/briefing" className="flex items-center justify-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm font-semibold text-primary active:scale-[0.98] transition-all min-h-[48px]">
            📋 Briefing
          </Link>
          <Link href="/admin/operations/queue" className="flex items-center justify-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm font-semibold text-primary active:scale-[0.98] transition-all min-h-[48px]">
            ⚡ Queue
          </Link>
          <Link href="/admin/incidents" className="flex items-center justify-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm font-semibold text-primary active:scale-[0.98] transition-all min-h-[48px]">
            ⚠ Incidents
          </Link>
        </div>
      </div>

      {/* Desktop 3-column layout */}
      <div className="hidden lg:grid grid-cols-[2fr_2fr_1.3fr] gap-4" style={{ minHeight: 560 }}>

        {/* Left col: queue + safeguarding */}
        <div className="flex flex-col gap-3">
          <PriorityQueueSection data={summary.queue} focusMode={focusMode} />
          <SafeguardingSection  data={summary.safeguarding} focusMode={focusMode} />
        </div>

        {/* Center col: feed */}
        <div className="flex flex-col gap-3">
          <LiveFeedSection events={summary.feed} focusMode={focusMode} />
          <ShiftCoverageSection coverage={summary.shift_coverage} focusMode={focusMode} />
        </div>

        {/* Right col: compliance + handover */}
        <div className="flex flex-col gap-3">
          <ComplianceSection   alerts={summary.compliance_alerts} focusMode={focusMode} />
          <HandoverSection     handover={summary.latest_handover} focusMode={focusMode} />
        </div>
      </div>

      <p className="text-[10px] text-gray-400 text-right tabular-nums">
        Updated {relTime(summary.last_updated)}
      </p>
    </div>
  )
}
