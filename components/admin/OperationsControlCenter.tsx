'use client'

import Link from 'next/link'
import type { OccSummary, FeedEvent, QueueItem } from '@/lib/operations/priorityQueue'

// ── Shared helpers ─────────────────────────────────────────────────────────────

const PRIORITY_CLS: Record<string, string> = {
  critical:      'bg-red-50    text-red-700    ring-red-600/20',
  urgent:        'bg-orange-50 text-orange-700 ring-orange-600/20',
  warning:       'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  informational: 'bg-gray-50   text-gray-600   ring-gray-400/20',
}

const SEVERITY_CLS: Record<string, string> = {
  critical: 'bg-red-50    text-red-700    ring-red-600/20',
  high:     'bg-orange-50 text-orange-700 ring-orange-600/20',
  medium:   'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  low:      'bg-gray-50   text-gray-600   ring-gray-400/20',
  info:     'bg-blue-50   text-blue-700   ring-blue-600/20',
}

const FEED_DOT: Record<string, string> = {
  critical:      'bg-red-500',
  high:          'bg-orange-500',
  medium:        'bg-yellow-500',
  low:           'bg-gray-300',
  info:          'bg-blue-400',
}

const CATEGORY_ICON: Record<string, string> = {
  safeguarding:  '🛡',
  compliance:    '📋',
  staffing:      '👥',
  onboarding:    '📝',
  incident:      '⚠️',
  medication:    '💊',
  shift_coverage: '📅',
  other:         '•',
}

const FEED_TYPE_ICON: Record<string, string> = {
  incident:     '⚠️',
  compliance:   '📋',
  staffing:     '👥',
  handover:     '🔄',
  queue:        '✓',
  override:     '🔓',
  onboarding:   '📝',
  safeguarding: '🛡',
}

function Badge({ label, cls }: { label: string; cls: string }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  )
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m    = Math.floor(diff / 60000)
  const h    = Math.floor(m / 60)
  const d    = Math.floor(h / 24)
  if (m < 2)  return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7)  return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

// ── KPI stat card ──────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, accent, href,
}: {
  label:   string
  value:   string | number
  sub?:    string
  accent?: 'red' | 'orange' | 'yellow' | 'default'
  href?:   string
}) {
  const valCls =
    accent === 'red'    ? 'text-red-600'
    : accent === 'orange' ? 'text-orange-600'
    : accent === 'yellow' ? 'text-yellow-700'
    : 'text-primary'

  const inner = (
    <>
      <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-extrabold tabular-nums mt-0.5 ${valCls}`} style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>
        {value}
      </p>
      {sub && <p className="text-[11px] text-on-surface-variant mt-0.5">{sub}</p>}
    </>
  )

  const base = 'bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] p-4 flex flex-col gap-0.5'

  if (href) {
    return (
      <Link href={href} className={`${base} hover:bg-gray-50/80 transition-colors`}>
        {inner}
      </Link>
    )
  }
  return <div className={base}>{inner}</div>
}

// ── Priority queue panel ───────────────────────────────────────────────────────

function PriorityQueuePanel({ data }: { data: OccSummary['queue'] }) {
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Priority Queue</h3>
          <div className="flex items-center gap-2 mt-1">
            {data.critical_count > 0 && (
              <span className="text-[10px] font-bold text-red-600 bg-red-50 rounded px-1.5 py-0.5">{data.critical_count} critical</span>
            )}
            {data.urgent_count > 0 && (
              <span className="text-[10px] font-bold text-orange-600 bg-orange-50 rounded px-1.5 py-0.5">{data.urgent_count} urgent</span>
            )}
            {data.warning_count > 0 && (
              <span className="text-[10px] font-bold text-yellow-700 bg-yellow-50 rounded px-1.5 py-0.5">{data.warning_count} warning</span>
            )}
          </div>
        </div>
        <Link href="/admin/operations/queue" className="text-xs text-indigo-600 hover:underline">
          View all →
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-outline-variant">
        {data.top_items.length === 0 ? (
          <div className="p-6 text-center text-sm text-on-surface-variant">
            No open queue items
          </div>
        ) : (
          data.top_items.map((item: QueueItem) => (
            <div key={item.id} className="px-5 py-3 hover:bg-gray-50/40 transition-colors">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 text-base leading-none">{CATEGORY_ICON[item.category] ?? '•'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Badge
                      label={item.priority}
                      cls={PRIORITY_CLS[item.priority] ?? PRIORITY_CLS.informational}
                    />
                    {item.assigned_to && (
                      <span className="text-[10px] text-on-surface-variant truncate">→ {item.assigned_to}</span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-primary leading-snug">{item.title}</p>
                  {item.description && (
                    <p className="text-[11px] text-on-surface-variant mt-0.5 line-clamp-1">{item.description}</p>
                  )}
                  {item.due_date && (
                    <p className="text-[10px] text-amber-700 mt-0.5">Due: {new Date(item.due_date).toLocaleDateString('en-GB')}</p>
                  )}
                </div>
                {item.entity_url && (
                  <Link href={item.entity_url} className="text-[10px] text-indigo-500 hover:underline whitespace-nowrap shrink-0 mt-0.5">
                    View →
                  </Link>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="px-5 py-3 border-t border-outline-variant">
        <Link
          href="/admin/operations/queue"
          className="block w-full text-center text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          Manage full queue ({data.total_open} open)
        </Link>
      </div>
    </div>
  )
}

// ── Live feed panel ────────────────────────────────────────────────────────────

function LiveFeedPanel({ events }: { events: FeedEvent[] }) {
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant">
        <h3 className="text-sm font-semibold text-gray-800">Live Operational Feed</h3>
        <Link href="/admin/operations/feed" className="text-xs text-indigo-600 hover:underline">
          Full feed →
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-outline-variant">
        {events.length === 0 ? (
          <div className="p-6 text-center text-sm text-on-surface-variant">No recent events</div>
        ) : (
          events.map((ev) => (
            <div key={ev.id} className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50/40 transition-colors">
              <div className="flex flex-col items-center gap-1 pt-1">
                <span className={`w-2 h-2 rounded-full shrink-0 ${FEED_DOT[ev.severity] ?? 'bg-gray-300'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-base leading-none">{FEED_TYPE_ICON[ev.type] ?? '•'}</span>
                  <p className="text-xs font-medium text-primary leading-snug flex-1">{ev.title}</p>
                  <span className="text-[10px] text-on-surface-variant shrink-0">{relTime(ev.occurred_at)}</span>
                </div>
                <p className="text-[11px] text-on-surface-variant mt-0.5 line-clamp-1">{ev.description}</p>
                {ev.actor && (
                  <p className="text-[10px] text-gray-400 mt-0.5">{ev.actor}</p>
                )}
                {ev.entity_url && (
                  <Link href={ev.entity_url} className="text-[10px] text-indigo-500 hover:underline">
                    View →
                  </Link>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── Shift coverage panel ───────────────────────────────────────────────────────

function ShiftCoveragePanel({ coverage }: { coverage: OccSummary['shift_coverage'] }) {
  const coveragePct = coverage.total_shifts > 0
    ? Math.round((coverage.covered / coverage.total_shifts) * 100)
    : 100

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800">Next 24h Shift Coverage</h3>
        <Link href="/admin/shifts" className="text-xs text-indigo-600 hover:underline">View shifts →</Link>
      </div>

      {coverage.total_shifts === 0 ? (
        <p className="text-sm text-on-surface-variant">No shifts in the next 24 hours.</p>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${coveragePct === 100 ? 'bg-green-500' : coveragePct >= 70 ? 'bg-yellow-400' : 'bg-red-500'}`}
                style={{ width: `${coveragePct}%` }}
              />
            </div>
            <span className="text-sm font-bold tabular-nums">{coveragePct}%</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-on-surface-variant mb-3">
            <span className="text-green-600 font-semibold">{coverage.covered} covered</span>
            {coverage.uncovered > 0 && (
              <span className="text-red-600 font-semibold">{coverage.uncovered} uncovered</span>
            )}
          </div>
          {coverage.uncovered_shifts.length > 0 && (
            <div className="space-y-1.5">
              {coverage.uncovered_shifts.map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-xs bg-red-50 rounded-lg px-3 py-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  <span className="font-medium text-red-800 truncate">{s.title}</span>
                  <span className="text-red-600 shrink-0">
                    {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Safeguarding queue panel ───────────────────────────────────────────────────

function SafeguardingPanel({ data }: { data: OccSummary['safeguarding'] }) {
  if (data.open_count === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-2">Safeguarding Queue</h3>
        <div className="flex items-center gap-2 text-sm text-green-600">
          <span>✓</span>
          <span>No unresolved safeguarding incidents</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-red-200 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-red-800">
          🛡 Safeguarding Queue
          <span className="ml-2 text-xs font-bold text-white bg-red-600 rounded-full px-2 py-0.5">{data.open_count}</span>
        </h3>
        <Link href="/admin/incidents?incident_type=safeguarding" className="text-xs text-indigo-600 hover:underline">
          View all →
        </Link>
      </div>
      <div className="space-y-2">
        {data.incidents.slice(0, 4).map((inc) => (
          <Link
            key={inc.id}
            href={`/admin/incidents/${inc.id}`}
            className="flex items-start gap-2.5 rounded-lg border border-red-100 bg-red-50/50 p-3 hover:bg-red-50 transition-colors"
          >
            <Badge label={inc.severity} cls={SEVERITY_CLS[inc.severity] ?? SEVERITY_CLS.medium} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-red-900 line-clamp-1">{inc.description}</p>
              <p className="text-[10px] text-red-700 mt-0.5">
                {inc.client_name && <span>{inc.client_name}</span>}
                {inc.occurred_at && (
                  <span className="ml-2">{new Date(inc.occurred_at).toLocaleDateString('en-GB')}</span>
                )}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ── Handover preview panel ─────────────────────────────────────────────────────

function HandoverPreview({ handover }: { handover: OccSummary['latest_handover'] }) {
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800">Handover</h3>
        <Link href="/admin/operations/handover" className="text-xs text-indigo-600 hover:underline">
          {handover ? 'View / add →' : 'Create →'}
        </Link>
      </div>
      {!handover ? (
        <p className="text-sm text-on-surface-variant">No handover notes yet today.</p>
      ) : (
        <>
          <div className="flex items-center gap-2 text-[11px] text-on-surface-variant mb-2">
            <span className="font-semibold text-primary">{handover.author_name}</span>
            <span>·</span>
            <span>{handover.shift_period}</span>
            <span>·</span>
            <span>{relTime(handover.created_at)}</span>
          </div>
          <p className="text-xs text-gray-700 line-clamp-3">{handover.summary}</p>
          {Array.isArray(handover.flagged_items) && handover.flagged_items.length > 0 && (
            <p className="text-[10px] text-amber-700 mt-1.5 font-medium">
              {handover.flagged_items.length} flagged item{handover.flagged_items.length > 1 ? 's' : ''} open
            </p>
          )}
        </>
      )}
    </div>
  )
}

// ── Compliance alerts panel ────────────────────────────────────────────────────

function ComplianceAlertsPanel({ alerts }: { alerts: OccSummary['compliance_alerts'] }) {
  if (alerts.length === 0) return null
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800">Critical Compliance</h3>
        <Link href="/admin/compliance" className="text-xs text-indigo-600 hover:underline">View all →</Link>
      </div>
      <div className="space-y-1.5">
        {alerts.slice(0, 5).map((a, i) => (
          <Link key={i} href={`/admin/staff/${a.staff_id}`} className="flex items-center gap-2.5 text-xs hover:bg-gray-50 rounded-lg px-2 py-1.5 -mx-2 transition-colors">
            <span className={`w-2 h-2 rounded-full shrink-0 ${a.is_expired ? 'bg-red-500' : a.days_left <= 7 ? 'bg-orange-500' : 'bg-yellow-400'}`} />
            <span className="flex-1 font-medium text-primary truncate">{a.staff_name}</span>
            <span className="text-[10px] text-on-surface-variant uppercase">{a.doc_type.replace(/_/g, ' ')}</span>
            <span className={`text-[10px] font-semibold ${a.is_expired ? 'text-red-600' : 'text-amber-700'}`}>
              {a.is_expired ? 'EXPIRED' : `${a.days_left}d`}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ── Critical alert banner ──────────────────────────────────────────────────────

function CriticalBanner({ summary }: { summary: OccSummary }) {
  const criticals = []
  if (summary.safeguarding_alerts > 0) {
    criticals.push(`${summary.safeguarding_alerts} unresolved safeguarding incident${summary.safeguarding_alerts > 1 ? 's' : ''}`)
  }
  if (summary.queue.critical_count > 0) {
    criticals.push(`${summary.queue.critical_count} critical queue item${summary.queue.critical_count > 1 ? 's' : ''}`)
  }
  if (summary.shift_coverage.uncovered > 0) {
    criticals.push(`${summary.shift_coverage.uncovered} uncovered shift${summary.shift_coverage.uncovered > 1 ? 's' : ''} in 24h`)
  }

  if (criticals.length === 0) return null

  return (
    <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-3.5 text-sm text-red-800">
      <span className="text-base mt-0.5">🔴</span>
      <div>
        <span className="font-bold">Operational alert: </span>
        {criticals.join(' · ')}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function OperationsControlCenter({
  summary,
}: {
  summary: OccSummary
}) {
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-primary" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>
            Operations Control Center
          </h1>
          <p className="text-sm text-on-surface-variant mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/operations/briefing"
            className="flex items-center gap-1.5 rounded-lg border border-outline-variant bg-white px-3.5 py-2 text-sm font-medium text-primary hover:bg-gray-50 transition-colors"
          >
            Daily Briefing
          </Link>
          <Link
            href="/admin/operations/handover"
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-bold text-white hover:bg-indigo-700 transition-colors"
          >
            + Handover Note
          </Link>
        </div>
      </div>

      {/* Critical banner */}
      <CriticalBanner summary={summary} />

      {/* KPI row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Open incidents"
          value={summary.open_incidents}
          sub={`${summary.overdue_follow_ups} overdue follow-ups`}
          accent={summary.open_incidents > 0 ? 'orange' : undefined}
          href="/admin/incidents"
        />
        <KpiCard
          label="Safeguarding alerts"
          value={summary.safeguarding_alerts}
          sub="Unresolved incidents"
          accent={summary.safeguarding_alerts > 0 ? 'red' : undefined}
          href="/admin/incidents?incident_type=safeguarding"
        />
        <KpiCard
          label="Uncovered shifts"
          value={summary.uncovered_shifts}
          sub="Next 7 days"
          accent={summary.uncovered_shifts > 3 ? 'red' : summary.uncovered_shifts > 0 ? 'orange' : undefined}
          href="/admin/shifts"
        />
        <KpiCard
          label="Onboarding stalls"
          value={summary.onboarding_stalls}
          sub=">14 days in pre-employment"
          accent={summary.onboarding_stalls > 2 ? 'orange' : undefined}
          href="/admin/onboarding"
        />
      </section>

      {/* Secondary KPIs */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Expiring critical docs"
          value={summary.expiring_critical_docs}
          sub="DBS / right to work (30d)"
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
          label="Queue critical"
          value={summary.queue.critical_count}
          sub={`${summary.queue.total_open} total open`}
          accent={summary.queue.critical_count > 0 ? 'red' : undefined}
          href="/admin/operations/queue"
        />
        <KpiCard
          label="Queue urgent"
          value={summary.queue.urgent_count}
          sub="Require action today"
          accent={summary.queue.urgent_count > 3 ? 'orange' : undefined}
          href="/admin/operations/queue"
        />
      </section>

      {/* Desktop 3-column layout */}
      <section className="hidden lg:grid grid-cols-[2fr_2fr_1.2fr] gap-5" style={{ minHeight: 600 }}>

        {/* Left: Priority Queue */}
        <PriorityQueuePanel data={summary.queue} />

        {/* Center: Live Feed */}
        <LiveFeedPanel events={summary.feed} />

        {/* Right: contextual panels */}
        <div className="flex flex-col gap-4">
          <ShiftCoveragePanel coverage={summary.shift_coverage} />
          <SafeguardingPanel data={summary.safeguarding} />
          <HandoverPreview handover={summary.latest_handover} />
          <ComplianceAlertsPanel alerts={summary.compliance_alerts} />
        </div>
      </section>

      {/* Mobile: stacked sections */}
      <section className="lg:hidden space-y-4">
        <ShiftCoveragePanel coverage={summary.shift_coverage} />
        <SafeguardingPanel data={summary.safeguarding} />
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Priority Queue ({summary.queue.total_open})</h3>
            <Link href="/admin/operations/queue" className="text-xs text-indigo-600 hover:underline">View all →</Link>
          </div>
          {summary.queue.top_items.slice(0, 3).map((item) => (
            <div key={item.id} className="flex items-center gap-2.5 py-2 border-b border-outline-variant last:border-0">
              <Badge label={item.priority} cls={PRIORITY_CLS[item.priority] ?? PRIORITY_CLS.informational} />
              <p className="text-xs text-primary flex-1 truncate">{item.title}</p>
            </div>
          ))}
        </div>
        <HandoverPreview handover={summary.latest_handover} />
        <ComplianceAlertsPanel alerts={summary.compliance_alerts} />
      </section>

      <p className="text-[10px] text-gray-400 text-right">
        Updated {relTime(summary.last_updated)}
      </p>
    </div>
  )
}
