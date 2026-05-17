'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import type {
  CapacityResponse,
  StaffReadinessRow,
  RoleCapacity,
  ExpiryCluster,
  UnderstaffedDay,
} from '@/app/api/admin/workforce/capacity/route'
import type { FeedAlert } from '@/lib/workforce/operationalFeed'
import {
  DEPLOYABILITY_LABEL,
  DEPLOYABILITY_CLS,
  type DeployabilityState,
} from '@/lib/workforce/readinessEngine'
import { scoreTier, SCORE_TIER_CLS } from '@/lib/workforce/deployabilityScore'

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'staff' | 'roles' | 'coverage' | 'onboarding'

// ── Shared primitives ─────────────────────────────────────────────────────────

function Badge({ label, cls }: { label: string; cls: string }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {label}
    </span>
  )
}

function ScorePill({ score }: { score: number }) {
  const tier = scoreTier(score)
  return (
    <span className={`tabular-nums font-semibold text-sm ${SCORE_TIER_CLS[tier]}`}>
      {score}
    </span>
  )
}

function StatCard({
  label, value, sub, urgent, href,
}: {
  label: string; value: number | string; sub?: string; urgent?: boolean; href?: string
}) {
  const inner = (
    <div className={[
      'rounded-xl border px-5 py-4 flex flex-col gap-1 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)]',
      urgent && Number(value) > 0
        ? 'bg-red-50 border-red-200'
        : 'bg-white border-gray-200',
    ].join(' ')}>
      <p className="text-xs font-medium text-on-surface-variant">{label}</p>
      <p className={`text-3xl font-bold tabular-nums ${urgent && Number(value) > 0 ? 'text-red-700' : 'text-primary'}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

// ── Feed alert item ───────────────────────────────────────────────────────────

const ALERT_CLS: Record<FeedAlert['level'], string> = {
  critical: 'border-l-4 border-red-500    bg-red-50   text-red-800',
  warning:  'border-l-4 border-yellow-500 bg-yellow-50 text-yellow-800',
  info:     'border-l-4 border-blue-400   bg-blue-50  text-blue-800',
}

const ALERT_ICON: Record<FeedAlert['level'], string> = {
  critical: 'error',
  warning:  'warning',
  info:     'info',
}

function AlertItem({ alert }: { alert: FeedAlert }) {
  const content = (
    <div className={`rounded-r-lg px-4 py-3 flex items-start gap-3 ${ALERT_CLS[alert.level]}`}>
      <span className="material-symbols-outlined mt-0.5 shrink-0" style={{ fontSize: '18px' }}>
        {ALERT_ICON[alert.level]}
      </span>
      <p className="text-sm">{alert.message}</p>
    </div>
  )
  return alert.href ? <Link href={alert.href}>{content}</Link> : content
}

// ── State distribution bar ────────────────────────────────────────────────────

const STATE_BAR_CLS: Record<string, string> = {
  deployable:            'bg-green-500',
  deployable_with_risk:  'bg-yellow-400',
  non_deployable:        'bg-red-500',
  onboarding_incomplete: 'bg-blue-400',
  suspended:             'bg-orange-400',
  inactive:              'bg-gray-300',
}

function DistributionBar({
  counts, total,
}: {
  counts: Partial<Record<DeployabilityState, number>>
  total:  number
}) {
  if (total === 0) return null
  return (
    <div className="w-full h-3 rounded-full overflow-hidden flex gap-px">
      {(Object.entries(counts) as [DeployabilityState, number][])
        .filter(([, v]) => v > 0)
        .map(([state, v]) => (
          <div
            key={state}
            className={`${STATE_BAR_CLS[state] ?? 'bg-gray-400'} transition-all`}
            style={{ width: `${(v / total) * 100}%` }}
            title={`${DEPLOYABILITY_LABEL[state]}: ${v}`}
          />
        ))}
    </div>
  )
}

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: CapacityResponse }) {
  const s = data.summary
  const total = s.total_active + s.suspended + s.inactive

  return (
    <div className="space-y-6">

      {/* Summary stat grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Deployable"   value={s.deployable}             sub="Fully ready"               href="/admin/workforce/capacity" />
        <StatCard label="At risk"      value={s.deployable_with_risk}   sub="Warnings present"          href="/admin/compliance" />
        <StatCard label="Blocked"      value={s.non_deployable}         sub="Cannot be assigned"        href="/admin/compliance"  urgent />
        <StatCard label="Onboarding"   value={s.onboarding_incomplete}  sub="Not yet deployable"        href="/admin/onboarding" />
        <StatCard label="Suspended"    value={s.suspended}              sub="Currently suspended"       urgent={s.suspended > 0} />
        <StatCard label="Open shifts"  value={data.coverage.uncoveredNext14d} sub="Unassigned (14 days)" href="/admin/shifts/open" urgent />
      </div>

      {/* Distribution bar */}
      <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] space-y-3">
        <h3 className="text-sm font-semibold text-primary">Workforce State Distribution</h3>
        <DistributionBar
          counts={{
            deployable:            s.deployable,
            deployable_with_risk:  s.deployable_with_risk,
            non_deployable:        s.non_deployable,
            onboarding_incomplete: s.onboarding_incomplete,
            suspended:             s.suspended,
            inactive:              s.inactive,
          }}
          total={total}
        />
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {([
            ['deployable',            s.deployable],
            ['deployable_with_risk',  s.deployable_with_risk],
            ['non_deployable',        s.non_deployable],
            ['onboarding_incomplete', s.onboarding_incomplete],
            ['suspended',             s.suspended],
            ['inactive',              s.inactive],
          ] as [DeployabilityState, number][]).map(([state, n]) => (
            <div key={state} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${STATE_BAR_CLS[state] ?? 'bg-gray-400'}`} />
              <span className="text-xs text-on-surface-variant">{DEPLOYABILITY_LABEL[state]} <strong>{n}</strong></span>
            </div>
          ))}
        </div>
      </div>

      {/* Operational feed */}
      <div>
        <h3 className="text-sm font-semibold text-primary mb-3">Operational Alerts</h3>
        {data.feed.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-green-50 px-5 py-4 text-sm text-green-700">
            No active alerts — workforce looks healthy.
          </div>
        ) : (
          <div className="space-y-2">
            {data.feed.map((alert) => <AlertItem key={alert.id} alert={alert} />)}
          </div>
        )}
      </div>

      {/* Expiry cluster table */}
      {data.expiryCluster.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)]">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-primary">Compliance Expiry Concentration</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">Items expiring per document / training type in next 30 days</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-right">≤7 days</th>
                  <th className="px-4 py-3 text-right">≤14 days</th>
                  <th className="px-4 py-3 text-right">≤30 days</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.expiryCluster.slice(0, 10).map((row) => (
                  <tr key={row.documentType} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-primary capitalize">
                      {row.documentType.replace(/_/g, ' ')}
                    </td>
                    <td className={`px-4 py-2.5 text-right tabular-nums ${row.count7d > 0 ? 'text-red-700 font-semibold' : 'text-gray-400'}`}>
                      {row.count7d}
                    </td>
                    <td className={`px-4 py-2.5 text-right tabular-nums ${row.count14d > 0 ? 'text-orange-600 font-semibold' : 'text-gray-400'}`}>
                      {row.count14d}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-on-surface-variant">
                      {row.count30d}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  )
}

// ── Staff tab ─────────────────────────────────────────────────────────────────

function StaffTab({ staff }: { staff: StaffReadinessRow[] }) {
  const [filter, setFilter] = useState<DeployabilityState | ''>('')
  const [search, setSearch] = useState('')

  const filtered = staff.filter((s) => {
    if (filter && s.deployabilityState !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return s.name.toLowerCase().includes(q) || (s.jobRole ?? '').toLowerCase().includes(q)
    }
    return true
  })

  const STATES: Array<{ state: DeployabilityState | ''; label: string }> = [
    { state: '',                     label: 'All' },
    { state: 'deployable',           label: 'Deployable' },
    { state: 'deployable_with_risk', label: 'At risk' },
    { state: 'non_deployable',       label: 'Blocked' },
    { state: 'onboarding_incomplete',label: 'Onboarding' },
    { state: 'suspended',            label: 'Suspended' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search staff…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <div className="flex flex-wrap gap-1.5">
          {STATES.map(({ state, label }) => (
            <button
              key={state}
              onClick={() => setFilter(state)}
              className={[
                'rounded-md px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors',
                filter === state
                  ? 'bg-gray-900 text-white ring-gray-900'
                  : 'bg-white text-gray-600 ring-gray-300 hover:bg-gray-50',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs font-medium text-on-surface-variant uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">State</th>
                <th className="px-4 py-3 text-right">Score</th>
                <th className="px-4 py-3 text-right">Compliance</th>
                <th className="px-4 py-3 text-left">Issues</th>
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                    No staff match this filter.
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-primary">{s.name}</td>
                    <td className="px-4 py-3 text-on-surface-variant capitalize">
                      {s.jobRole?.replace(/_/g, ' ') ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        label={DEPLOYABILITY_LABEL[s.deployabilityState]}
                        cls={DEPLOYABILITY_CLS[s.deployabilityState]}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ScorePill score={s.deployabilityScore} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-on-surface-variant">
                      {s.compliancePercent}%
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      {s.blockers.length > 0 ? (
                        <span className="text-xs text-red-600">{s.blockers[0]}</span>
                      ) : s.warnings.length > 0 ? (
                        <span className="text-xs text-yellow-700">{s.warnings[0]}</span>
                      ) : (
                        <span className="text-xs text-green-600">Clear</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/staff/${s.id}`} className="text-xs text-indigo-600 hover:underline">
                        View →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 border-t border-gray-100 text-xs text-gray-400">
          {filtered.length} staff member{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  )
}

// ── Roles tab ─────────────────────────────────────────────────────────────────

function RolesTab({ byRole }: { byRole: RoleCapacity[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)]">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-primary">Deployable Staff by Role</h3>
        <p className="text-xs text-on-surface-variant mt-0.5">Breakdown of workforce capacity per job role</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs font-medium text-on-surface-variant uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-right">Deployable</th>
              <th className="px-4 py-3 text-right">At risk</th>
              <th className="px-4 py-3 text-right">Blocked</th>
              <th className="px-4 py-3 text-right">Onboarding</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-left">Capacity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {byRole.map((r) => {
              const deployPct = r.total > 0 ? Math.round((r.deployable / r.total) * 100) : 0
              const atRiskTotal = r.deployable + r.atRisk
              return (
                <tr key={r.role} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-primary capitalize">
                    {r.role.replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-green-700 font-semibold">{r.deployable}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-yellow-700">{r.atRisk}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${r.blocked > 0 ? 'text-red-700 font-semibold' : 'text-gray-400'}`}>{r.blocked}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-blue-700">{r.onboarding}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-on-surface-variant">{r.total}</td>
                  <td className="px-4 py-3 min-w-[120px]">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${deployPct >= 80 ? 'bg-green-500' : deployPct >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
                          style={{ width: `${deployPct}%` }}
                        />
                      </div>
                      <span className="text-xs text-on-surface-variant tabular-nums w-8 text-right">{deployPct}%</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Coverage tab ──────────────────────────────────────────────────────────────

function CoverageTab({ coverage }: { coverage: CapacityResponse['coverage'] }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          label="Unassigned shifts (next 14 days)"
          value={coverage.uncoveredNext14d}
          sub="Shifts with no worker assigned"
          href="/admin/shifts/open"
          urgent
        />
      </div>

      {coverage.understaffedDays.length === 0 ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-700">
          No understaffed days in the next 14 days.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)]">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-primary">Understaffed Days</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">Days with one or more unassigned shifts</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-right">Unassigned shifts</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {coverage.understaffedDays.map((day) => (
                  <tr key={day.date} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-primary">
                      {new Date(day.date + 'T00:00:00').toLocaleDateString('en-GB', {
                        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums font-semibold ${day.uncoveredCount > 2 ? 'text-red-700' : 'text-orange-600'}`}>
                      {day.uncoveredCount}
                    </td>
                    <td className="px-4 py-3">
                      <Link href="/admin/shifts/open" className="text-xs text-indigo-600 hover:underline">
                        Fill shifts →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Onboarding tab ────────────────────────────────────────────────────────────

function OnboardingTab({ onboarding }: { onboarding: CapacityResponse['onboarding'] }) {
  const metrics = [
    { label: 'Stalled in onboarding',   value: onboarding.stalledCount,      sub: '7+ days without progress',  urgent: true, href: '/admin/onboarding?stage=in_progress' },
    { label: 'Missing documents',        value: onboarding.missingDocs,        sub: 'DBS, RTW, ID, or proof of address', href: '/admin/onboarding' },
    { label: 'Missing compliance check', value: onboarding.missingCompliance,  sub: 'DBS or right to work not completed', href: '/admin/onboarding' },
    { label: 'Pending cert approvals',   value: onboarding.pendingApprovals,   sub: 'Training certs awaiting review', href: '/admin/staff' },
    { label: 'Awaiting admin review',    value: onboarding.awaitingReview,     sub: 'Worker done — admin review needed', href: '/admin/onboarding?stage=awaiting_review' },
    { label: 'Not yet started',          value: onboarding.notStarted,         sub: 'Recently created, no progress', href: '/admin/onboarding' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {metrics.map((m) => (
          <StatCard key={m.label} label={m.label} value={m.value} sub={m.sub} urgent={m.urgent} href={m.href} />
        ))}
      </div>

      {onboarding.avgStalledDays !== null && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-5 py-4 text-sm text-yellow-800">
          Average days stalled: <strong>{onboarding.avgStalledDays} days</strong> — consider automated reminders or admin follow-up.
        </div>
      )}

      <div className="flex gap-3">
        <Link
          href="/admin/onboarding"
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>how_to_reg</span>
          Open Onboarding Queue
        </Link>
        <Link
          href="/admin/applicants"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-primary hover:bg-gray-50 transition-colors"
        >
          View Applicants
        </Link>
      </div>
    </div>
  )
}

// ── Main client ───────────────────────────────────────────────────────────────

export default function WorkforceCapacityClient({ initial }: { initial: CapacityResponse }) {
  const [data,       setData]       = useState<CapacityResponse>(initial)
  const [loading,    setLoading]    = useState(false)
  const [activeTab,  setActiveTab]  = useState<Tab>('overview')
  const [lastUpdate, setLastUpdate] = useState(new Date(initial.asOf))

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/workforce/capacity', { cache: 'no-store' })
      if (res.ok) {
        const json = await res.json() as CapacityResponse
        setData(json)
        setLastUpdate(new Date(json.asOf))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const TABS: Array<{ id: Tab; label: string; icon: string; badge?: number }> = [
    { id: 'overview',   label: 'Overview',   icon: 'dashboard' },
    { id: 'staff',      label: 'Staff',      icon: 'badge',     badge: data.summary.non_deployable > 0 ? data.summary.non_deployable : undefined },
    { id: 'roles',      label: 'By Role',    icon: 'work' },
    { id: 'coverage',   label: 'Coverage',   icon: 'event_available', badge: data.coverage.uncoveredNext14d > 0 ? data.coverage.uncoveredNext14d : undefined },
    { id: 'onboarding', label: 'Onboarding', icon: 'how_to_reg',      badge: data.onboarding.stalledCount > 0 ? data.onboarding.stalledCount : undefined },
  ]

  return (
    <div className="space-y-5">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-primary tracking-tight">Workforce Capacity</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Deployability, coverage gaps, and operational pressure — in one view.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <p className="text-xs text-gray-400 hidden sm:block">
            Updated {lastUpdate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </p>
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-primary hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <span className={`material-symbols-outlined ${loading ? 'animate-spin' : ''}`} style={{ fontSize: '16px' }}>
              refresh
            </span>
            Refresh
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200 pb-px">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors rounded-t-lg border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-on-surface-variant hover:text-primary hover:border-gray-300',
            ].join(' ')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px', fontVariationSettings: "'FILL' 0" }}>
              {tab.icon}
            </span>
            {tab.label}
            {tab.badge !== undefined && (
              <span className="rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 min-w-[18px] text-center">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview'   && <OverviewTab  data={data} />}
      {activeTab === 'staff'      && <StaffTab     staff={data.staff} />}
      {activeTab === 'roles'      && <RolesTab     byRole={data.byRole} />}
      {activeTab === 'coverage'   && <CoverageTab  coverage={data.coverage} />}
      {activeTab === 'onboarding' && <OnboardingTab onboarding={data.onboarding} />}

    </div>
  )
}
