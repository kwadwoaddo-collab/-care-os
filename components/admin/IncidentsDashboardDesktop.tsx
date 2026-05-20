'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { PaginationMeta } from '@/lib/pagination'

// ── Types ──────────────────────────────────────────────────────────────────────

interface IncidentRow {
  id: string
  incident_type: string
  severity: string
  status: string
  occurred_at: string | null
  description: string
  escalation_required: boolean
  created_at: string
  clients: { id: string; first_name: string; last_name: string } | null
  staff_profiles: { id: string; first_name: string | null; last_name: string | null } | null
}

interface Props {
  incidents: IncidentRow[]
  meta: PaginationMeta
  searchParams: Record<string, string | string[] | undefined>
  openCount: number
  resolvedCount: number
  investigatingCount: number
  highCriticalCount: number
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function initials(first: string | null | undefined, last: string | null | undefined) {
  return [first?.[0], last?.[0]].filter(Boolean).join('').toUpperCase() || '?'
}

function clientInitials(c: { first_name: string; last_name: string } | null) {
  if (!c) return '?'
  return initials(c.first_name, c.last_name)
}

function staffName(s: { first_name: string | null; last_name: string | null } | null) {
  if (!s) return '—'
  return [s.first_name, s.last_name].filter(Boolean).join(' ') || '—'
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  const hrs = Math.floor(mins / 60)
  const days = Math.floor(hrs / 24)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hrs < 24) return `${hrs}h ago`
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

function incidentId(id: string) {
  return `#INC-${id.slice(0, 6).toUpperCase()}`
}

const SEVERITY_BORDER: Record<string, string> = {
  low:      'border-l-gray-300',
  medium:   'border-l-yellow-400',
  high:     'border-l-orange-500',
  critical: 'border-l-red-600',
}

const SEVERITY_BADGE: Record<string, string> = {
  low:      'bg-gray-50 text-gray-600 ring-gray-400/30',
  medium:   'bg-yellow-50 text-yellow-700 ring-yellow-500/30',
  high:     'bg-orange-50 text-orange-700 ring-orange-500/30',
  critical: 'bg-red-50 text-red-700 ring-red-500/30',
}

const STATUS_DOT: Record<string, string> = {
  open:          'bg-red-500 shadow-[0_0_6px_2px_rgba(239,68,68,0.4)] animate-pulse',
  investigating: 'bg-blue-500',
  resolved:      'bg-green-500',
  closed:        'bg-gray-400',
}

const STATUS_LABEL: Record<string, string> = {
  open:          'Active',
  investigating: 'In Review',
  resolved:      'Resolved',
  closed:        'Closed',
}

const STATUS_LABEL_CLS: Record<string, string> = {
  open:          'text-red-600',
  investigating: 'text-blue-600',
  resolved:      'text-green-600',
  closed:        'text-gray-500',
}

// Tab config
const TABS = [
  { label: 'All',       status: '' },
  { label: 'Pending',   status: 'open' },
  { label: 'In Review', status: 'investigating' },
]

// ── Sub-components ─────────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-surface-container-lowest rounded-lg border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] ${className}`}>
      {children}
    </div>
  )
}

function SeverityBadge({ value }: { value: string }) {
  const cls = SEVERITY_BADGE[value] ?? 'bg-gray-50 text-gray-600 ring-gray-400/30'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ring-1 ring-inset uppercase tracking-wide ${cls}`}>
      {value}
    </span>
  )
}

function StatusIndicator({ status }: { status: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[status] ?? 'bg-gray-400'}`} />
      <span className={`text-[11px] font-semibold ${STATUS_LABEL_CLS[status] ?? 'text-gray-500'}`}>
        {STATUS_LABEL[status] ?? status}
      </span>
    </div>
  )
}

function AvatarCircle({ text, color = 'bg-indigo-100 text-indigo-700' }: { text: string; color?: string }) {
  return (
    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${color}`}>
      {text}
    </div>
  )
}

function KpiTile({
  label, value, sub, accent,
}: { label: string; value: string | number; sub: string; accent: string }) {
  return (
    <div className="flex-1 flex flex-col gap-1 p-4 rounded-lg bg-surface-container-low">
      <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-extrabold tabular-nums ${accent}`} style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>
        {value}
      </p>
      <p className="text-xs text-on-surface-variant">{sub}</p>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function IncidentsDashboardDesktop({
  incidents,
  meta,
  searchParams,
  openCount,
  resolvedCount,
  investigatingCount,
  highCriticalCount,
}: Props) {
  const [showFilters, setShowFilters] = useState(false)

  // Determine active tab from URL
  const activeStatus = typeof searchParams.status === 'string' ? searchParams.status : ''
  const activeTab = TABS.find((t) => t.status === activeStatus) ?? TABS[0]

  // Build severity counts for bar chart
  const severityCounts = {
    low:      incidents.filter((i) => i.severity === 'low').length,
    medium:   incidents.filter((i) => i.severity === 'medium').length,
    high:     incidents.filter((i) => i.severity === 'high').length,
    critical: incidents.filter((i) => i.severity === 'critical').length,
  }
  const maxBar = Math.max(...Object.values(severityCounts), 1)

  // Synthetic activity feed from incidents
  const feedItems = incidents.slice(0, 6).map((inc) => ({
    id: inc.id,
    icon: inc.status === 'resolved' ? 'check_circle' : inc.status === 'investigating' ? 'manage_search' : 'flag',
    iconBg: inc.status === 'resolved' ? 'bg-green-100 text-green-700' : inc.status === 'investigating' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-600',
    title: inc.status === 'resolved'
      ? `Incident resolved`
      : inc.status === 'investigating'
      ? `Investigation opened`
      : `New incident logged`,
    sub: inc.incident_type.replace(/_/g, ' ') + (inc.clients ? ` · ${inc.clients.first_name} ${inc.clients.last_name}` : ''),
    time: relativeTime(inc.occurred_at ?? inc.created_at),
  }))

  // Build tab href
  function tabHref(status: string) {
    const p = new URLSearchParams()
    if (status) p.set('status', status)
    const s = typeof searchParams.search === 'string' ? searchParams.search : ''
    if (s) p.set('search', s)
    const q = p.toString()
    return `/admin/incidents${q ? `?${q}` : ''}`
  }

  return (
    <div className="flex gap-5" style={{ maxWidth: 'var(--spacing-container-max)' }}>

      {/* ══ Primary Column (70%) ════════════════════════════════════════════════ */}
      <div className="flex-[7] min-w-0 flex flex-col gap-4">

        {/* Top Bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2.5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">search</span>
            <form className="flex-1" method="GET" action="/admin/incidents">
              <input
                name="search"
                defaultValue={typeof searchParams.search === 'string' ? searchParams.search : ''}
                placeholder="Search incidents, clients, descriptions…"
                className="w-full bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/60 outline-none"
              />
            </form>
          </div>
          <Link
            href="/admin/notifications"
            className="w-10 h-10 flex items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest hover:bg-surface-container transition-colors"
            title="Notifications"
          >
            <span className="material-symbols-outlined text-[20px] text-on-surface-variant">notifications</span>
          </Link>
          <Link
            href="/admin/system"
            className="w-10 h-10 flex items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest hover:bg-surface-container transition-colors"
            title="Help"
          >
            <span className="material-symbols-outlined text-[20px] text-on-surface-variant">help</span>
          </Link>
        </div>

        {/* List Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-on-surface" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>
              Incidents
            </h1>
            <p className="text-sm text-on-surface-variant mt-0.5">
              {meta.total} incident{meta.total !== 1 ? 's' : ''} recorded
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/incidents/intelligence"
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm font-semibold text-on-surface hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">insights</span>
              Intelligence
            </Link>
            <Link
              href="/admin/incidents/new"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4f46e5] text-white text-sm font-bold hover:bg-[#4338ca] transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Log New Incident
            </Link>
          </div>
        </div>

        {/* Tab Nav + Advanced Filters */}
        <div className="flex items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-surface-container rounded-lg p-1">
            {TABS.map((tab) => (
              <Link
                key={tab.label}
                href={tabHref(tab.status)}
                className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all duration-150 ${
                  activeTab.label === tab.label
                    ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>

          {/* Advanced Filters toggle */}
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-semibold transition-colors ${
              showFilters
                ? 'border-[#4f46e5] bg-indigo-50 text-[#4f46e5]'
                : 'border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">tune</span>
            Advanced Filters
            <span className="material-symbols-outlined text-[14px]">{showFilters ? 'expand_less' : 'expand_more'}</span>
          </button>
        </div>

        {/* Advanced Filters panel */}
        {showFilters && (
          <form method="GET" action="/admin/incidents" className="flex flex-wrap gap-3 items-end bg-surface-container-low rounded-lg p-4 border border-outline-variant">
            {typeof searchParams.search === 'string' && (
              <input type="hidden" name="search" value={searchParams.search} />
            )}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Severity</label>
              <select name="severity" defaultValue={typeof searchParams.severity === 'string' ? searchParams.severity : ''}
                className="px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm text-on-surface outline-none focus:ring-2 focus:ring-[#4f46e5]/30">
                <option value="">All severities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Type</label>
              <select name="incident_type" defaultValue={typeof searchParams.incident_type === 'string' ? searchParams.incident_type : ''}
                className="px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm text-on-surface outline-none focus:ring-2 focus:ring-[#4f46e5]/30">
                <option value="">All types</option>
                <option value="fall">Fall</option>
                <option value="medication_error">Medication Error</option>
                <option value="safeguarding">Safeguarding</option>
                <option value="injury">Injury</option>
                <option value="behaviour">Behaviour</option>
                <option value="missed_visit">Missed Visit</option>
                <option value="property_damage">Property Damage</option>
                <option value="complaint">Complaint</option>
                <option value="other">Other</option>
              </select>
            </div>
            <button type="submit"
              className="px-4 py-2 rounded-lg bg-[#4f46e5] text-white text-sm font-bold hover:bg-[#4338ca] transition-colors">
              Apply
            </button>
            <Link href="/admin/incidents" className="px-4 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">
              Clear
            </Link>
          </form>
        )}

        {/* Incident Cards */}
        {incidents.length === 0 ? (
          <Card className="p-10 text-center">
            <span className="material-symbols-outlined text-[40px] text-on-surface-variant/40 mb-3 block">inventory_2</span>
            <p className="text-sm font-semibold text-on-surface">No incidents found</p>
            <p className="text-xs text-on-surface-variant mt-1">Try adjusting your filters or log a new incident.</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {incidents.map((inc) => {
              const clientInits = clientInitials(inc.clients)
              const investigatorName = staffName(inc.staff_profiles)
              const investigatorInits = initials(inc.staff_profiles?.first_name, inc.staff_profiles?.last_name)

              return (
                <Link
                  key={inc.id}
                  href={`/admin/incidents/${inc.id}`}
                  className={`group flex items-stretch bg-surface-container-lowest rounded-lg border border-outline-variant shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] hover:border-[#4f46e5]/30 transition-all duration-200 overflow-hidden border-l-4 ${SEVERITY_BORDER[inc.severity] ?? 'border-l-gray-300'}`}
                >
                  {/* Content */}
                  <div className="flex-1 px-5 py-4 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {/* Incident ID */}
                      <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-md font-mono">
                        {incidentId(inc.id)}
                      </span>
                      {/* Client chip */}
                      {inc.clients && (
                        <div className="flex items-center gap-1.5">
                          <AvatarCircle text={clientInits} color="bg-indigo-100 text-indigo-700" />
                          <span className="text-xs font-medium text-on-surface-variant">
                            {inc.clients.first_name} {inc.clients.last_name}
                          </span>
                        </div>
                      )}
                      {/* Category chip */}
                      <span className="text-[10px] font-semibold text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded-full capitalize">
                        {inc.incident_type.replace(/_/g, ' ')}
                      </span>
                      {inc.escalation_required && (
                        <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full ring-1 ring-inset ring-red-500/20">
                          Escalation
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-medium text-on-surface line-clamp-2 leading-snug mb-2">
                      {inc.description}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-on-surface-variant">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                        {formatDateTime(inc.occurred_at ?? inc.created_at)}
                      </span>
                      {inc.staff_profiles && (
                        <div className="flex items-center gap-1.5 ml-auto">
                          <AvatarCircle text={investigatorInits} color="bg-violet-100 text-violet-700" />
                          <span className="text-xs text-on-surface-variant">{investigatorName}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right meta column */}
                  <div className="flex flex-col items-end justify-between px-4 py-4 gap-3 shrink-0 bg-surface-container-low/40">
                    <SeverityBadge value={inc.severity} />
                    <StatusIndicator status={inc.status} />
                    <span className="material-symbols-outlined text-[16px] text-on-surface-variant/40 group-hover:text-[#4f46e5] transition-colors">
                      chevron_right
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-on-surface-variant">
              Page {meta.page} of {meta.totalPages} · {meta.total} total
            </p>
            <div className="flex items-center gap-2">
              {meta.hasPrev && (
                <Link
                  href={`/admin/incidents?page=${meta.page - 1}${activeStatus ? `&status=${activeStatus}` : ''}`}
                  className="px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm font-semibold text-on-surface hover:bg-surface-container transition-colors"
                >
                  ← Previous
                </Link>
              )}
              {meta.hasNext && (
                <Link
                  href={`/admin/incidents?page=${meta.page + 1}${activeStatus ? `&status=${activeStatus}` : ''}`}
                  className="px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm font-semibold text-on-surface hover:bg-surface-container transition-colors"
                >
                  Next →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ══ Secondary Column (30%) ══════════════════════════════════════════════ */}
      <div className="flex-[3] min-w-[280px] max-w-[380px] flex flex-col gap-4">

        {/* Incident Insights */}
        <Card>
          <div className="px-5 py-4 border-b border-outline-variant flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-on-surface" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>
                Incident Insights
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">Last 7 days overview</p>
            </div>
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">insights</span>
          </div>
          <div className="p-4 flex gap-3">
            <KpiTile
              label="Open"
              value={openCount}
              sub={openCount > 0 ? 'Needs attention' : 'All clear'}
              accent={openCount > 0 ? 'text-red-600' : 'text-green-600'}
            />
            <KpiTile
              label="Resolved"
              value={resolvedCount}
              sub="This period"
              accent="text-green-600"
            />
          </div>
          <div className="px-4 pb-4 flex gap-3">
            <KpiTile
              label="In Review"
              value={investigatingCount}
              sub="Being investigated"
              accent="text-blue-600"
            />
            <KpiTile
              label="High / Critical"
              value={highCriticalCount}
              sub={highCriticalCount > 0 ? '⚠ Priority action' : 'None flagged'}
              accent={highCriticalCount > 0 ? 'text-orange-600' : 'text-on-surface'}
            />
          </div>
        </Card>

        {/* Severity Trend */}
        <Card>
          <div className="px-5 py-4 border-b border-outline-variant">
            <h2 className="text-sm font-bold text-on-surface" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>
              Severity Breakdown
            </h2>
            <p className="text-xs text-on-surface-variant mt-0.5">Current page snapshot</p>
          </div>
          <div className="p-5 space-y-3">
            {[
              { label: 'Critical', count: severityCounts.critical, bar: 'bg-red-500', text: 'text-red-600' },
              { label: 'High',     count: severityCounts.high,     bar: 'bg-orange-400', text: 'text-orange-600' },
              { label: 'Medium',   count: severityCounts.medium,   bar: 'bg-yellow-400', text: 'text-yellow-600' },
              { label: 'Low',      count: severityCounts.low,      bar: 'bg-gray-300',   text: 'text-gray-500' },
            ].map(({ label, count, bar, text }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-xs font-semibold text-on-surface-variant w-14 shrink-0">{label}</span>
                <div className="flex-1 h-2 bg-surface-container rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${bar}`}
                    style={{ width: `${(count / maxBar) * 100}%` }}
                  />
                </div>
                <span className={`text-xs font-bold tabular-nums w-5 text-right ${text}`}>{count}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Recent Actions Feed */}
        <Card className="flex-1">
          <div className="px-5 py-4 border-b border-outline-variant flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-on-surface" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>
                Recent Actions
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">Latest incident activity</p>
            </div>
            <Link href="/admin/audit-log" className="text-xs font-semibold text-[#4f46e5] hover:underline">
              View all
            </Link>
          </div>
          <div className="p-4">
            {feedItems.length === 0 ? (
              <p className="text-xs text-on-surface-variant text-center py-4">No recent activity</p>
            ) : (
              <ol className="space-y-0">
                {feedItems.map((item, idx) => (
                  <li key={item.id + idx} className="flex gap-3 relative">
                    {idx < feedItems.length - 1 && (
                      <div className="absolute left-[13px] top-8 bottom-0 w-[2px] bg-outline-variant/30" />
                    )}
                    {/* Icon avatar */}
                    <div className={`relative z-10 mt-1 w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${item.iconBg}`}>
                      <span className="material-symbols-outlined text-[14px]">{item.icon}</span>
                    </div>
                    <div className="flex-1 pb-4 min-w-0">
                      <p className="text-xs font-semibold text-on-surface leading-snug">{item.title}</p>
                      <p className="text-[11px] text-on-surface-variant mt-0.5 capitalize truncate">{item.sub}</p>
                      <p className="text-[10px] text-on-surface-variant/60 mt-0.5">{item.time}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </Card>

      </div>
    </div>
  )
}
