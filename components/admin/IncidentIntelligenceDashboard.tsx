'use client'

import Link from 'next/link'
import type { IntelligenceResponse } from '@/app/api/admin/incidents/intelligence/route'

// ── Shared badge helpers ───────────────────────────────────────────────────────

const RISK_CLS: Record<string, string> = {
  low:      'bg-gray-50    text-gray-600   ring-gray-400/20',
  medium:   'bg-yellow-50  text-yellow-700 ring-yellow-600/20',
  high:     'bg-orange-50  text-orange-700 ring-orange-600/20',
  critical: 'bg-red-50     text-red-700    ring-red-600/20',
}

const TREND_ICON: Record<string, string> = {
  improving: '↓',
  stable:    '→',
  worsening: '↑',
}

const TREND_CLS: Record<string, string> = {
  improving: 'text-green-600',
  stable:    'text-gray-500',
  worsening: 'text-red-600',
}

function RiskBadge({ level }: { level: string }) {
  const cls = RISK_CLS[level] ?? 'bg-gray-50 text-gray-600 ring-gray-400/20'
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {level}
    </span>
  )
}

function ScoreBar({ score }: { score: number }) {
  const col =
    score >= 75 ? 'bg-red-500'
    : score >= 50 ? 'bg-orange-500'
    : score >= 25 ? 'bg-yellow-400'
    : 'bg-green-400'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${col}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-mono text-gray-500 w-7 text-right">{score}</span>
    </div>
  )
}

// ── Summary stat cards ─────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: 'red' | 'orange' | 'default'
}) {
  const valCls =
    accent === 'red' ? 'text-red-600'
    : accent === 'orange' ? 'text-orange-600'
    : 'text-primary'
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] p-4">
      <p className="text-xs text-on-surface-variant mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${valCls}`}>{value}</p>
      {sub && <p className="text-xs text-on-surface-variant mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Weekly trend sparkline ─────────────────────────────────────────────────────

function TrendBar({ data }: { data: IntelligenceResponse['weekly_trend'] }) {
  const max = Math.max(...data.map((d) => d.count), 1)
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] p-5">
      <h3 className="text-sm font-semibold text-gray-800 mb-4">Incident Trend — last 8 weeks</h3>
      <div className="flex items-end gap-1.5 h-24">
        {data.map((pt) => {
          const heightPct = max > 0 ? Math.round((pt.count / max) * 100) : 0
          const highPct   = pt.count > 0 ? Math.round((pt.high_critical / pt.count) * 100) : 0
          return (
            <div key={pt.week_start} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[9px] text-gray-400 tabular-nums">{pt.count}</span>
              <div
                className="w-full relative rounded-sm overflow-hidden bg-indigo-100"
                style={{ height: `${Math.max(heightPct, 4)}%` }}
                title={`${pt.week_start}: ${pt.count} total, ${pt.high_critical} high/critical`}
              >
                {highPct > 0 && (
                  <div
                    className="absolute bottom-0 w-full bg-red-400"
                    style={{ height: `${highPct}%` }}
                  />
                )}
              </div>
              <span className="text-[9px] text-gray-400">
                {pt.week_start.slice(5)}
              </span>
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-3 mt-3 text-[10px] text-gray-400">
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-indigo-100" /> All incidents</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-red-400" /> High / critical</span>
      </div>
    </div>
  )
}

// ── Pattern alerts ─────────────────────────────────────────────────────────────

function PatternAlerts({ alerts }: { alerts: IntelligenceResponse['pattern_alerts'] }) {
  if (alerts.length === 0) return null
  return (
    <div className="space-y-2">
      {alerts.map((a, i) => (
        <div
          key={i}
          className={`flex items-start gap-3 rounded-lg px-4 py-3 text-sm ${
            a.severity === 'danger'
              ? 'bg-red-50 border border-red-200 text-red-800'
              : 'bg-amber-50 border border-amber-200 text-amber-800'
          }`}
        >
          <span className="mt-0.5 text-base leading-none">{a.severity === 'danger' ? '🔴' : '⚠️'}</span>
          <span>{a.message}</span>
        </div>
      ))}
    </div>
  )
}

// ── Type breakdown table ───────────────────────────────────────────────────────

function TypeBreakdown({ data }: { data: IntelligenceResponse['type_breakdown'] }) {
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] p-5">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">Incident Types</h3>
      <div className="space-y-2">
        {data.map((row) => (
          <div key={row.incident_type} className="flex items-center gap-3">
            <span className="w-32 text-xs text-gray-600 capitalize truncate">
              {row.incident_type.replace(/_/g, ' ')}
            </span>
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-400 rounded-full"
                style={{ width: `${row.percentage}%` }}
              />
            </div>
            <span className="text-xs font-mono text-gray-500 w-7 text-right">{row.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Staff risk table ───────────────────────────────────────────────────────────

function StaffRiskTable({ profiles }: { profiles: IntelligenceResponse['staff_risk_profiles'] }) {
  if (profiles.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] p-8 text-center">
        <p className="text-sm text-on-surface-variant">No staff incident data in the last 90 days</p>
      </div>
    )
  }

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
      <div className="p-5 border-b border-outline-variant">
        <h3 className="text-sm font-semibold text-gray-800">Staff Operational Risk</h3>
        <p className="text-xs text-on-surface-variant mt-0.5">Based on incidents in the last 90 days</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-outline-variant bg-gray-50/50">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-on-surface-variant">Worker</th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-on-surface-variant">Incidents</th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-on-surface-variant">Safeguarding</th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-on-surface-variant">Medication</th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-on-surface-variant">Escalations</th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-on-surface-variant">Trend</th>
              <th className="px-4 py-2.5 text-xs font-medium text-on-surface-variant">Risk Score</th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-on-surface-variant">Level</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {profiles.map((p) => (
              <tr
                key={p.staff_profile_id}
                className="hover:bg-gray-50/50 transition-colors"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/staff/${p.staff_profile_id}`}
                    className="font-medium text-indigo-700 hover:underline"
                  >
                    {p.staff_name}
                  </Link>
                  {p.job_role && (
                    <p className="text-xs text-on-surface-variant">{p.job_role}</p>
                  )}
                  {p.intervention_recommendation && (
                    <p className="text-[10px] text-amber-700 mt-0.5 max-w-xs leading-tight">
                      {p.intervention_recommendation}
                    </p>
                  )}
                </td>
                <td className="px-3 py-3 text-center">
                  <span className="text-sm font-semibold tabular-nums">{p.incident_count}</span>
                </td>
                <td className="px-3 py-3 text-center">
                  {p.safeguarding_count > 0 ? (
                    <span className="text-xs font-semibold text-red-600">{p.safeguarding_count}</span>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>
                <td className="px-3 py-3 text-center">
                  {p.medication_errors > 0 ? (
                    <span className="text-xs font-semibold text-orange-600">{p.medication_errors}</span>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>
                <td className="px-3 py-3 text-center">
                  {p.escalation_count > 0 ? (
                    <span className="text-xs font-semibold text-amber-700">{p.escalation_count}</span>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>
                <td className="px-3 py-3 text-center">
                  <span className={`text-sm font-bold ${TREND_CLS[p.trend] ?? 'text-gray-500'}`}>
                    {TREND_ICON[p.trend]}
                  </span>
                </td>
                <td className="px-4 py-3 min-w-[120px]">
                  <ScoreBar score={p.risk_score} />
                </td>
                <td className="px-3 py-3 text-center">
                  <RiskBadge level={p.risk_level} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Client risk table ──────────────────────────────────────────────────────────

function ClientRiskTable({ profiles }: { profiles: IntelligenceResponse['client_risk_profiles'] }) {
  if (profiles.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] p-8 text-center">
        <p className="text-sm text-on-surface-variant">No client incident data in the last 90 days</p>
      </div>
    )
  }

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
      <div className="p-5 border-b border-outline-variant">
        <h3 className="text-sm font-semibold text-gray-800">Client Support Risk</h3>
        <p className="text-xs text-on-surface-variant mt-0.5">Based on incidents in the last 90 days</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-outline-variant bg-gray-50/50">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-on-surface-variant">Client</th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-on-surface-variant">Incidents</th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-on-surface-variant">Falls</th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-on-surface-variant">Medication</th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-on-surface-variant">Behaviour</th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-on-surface-variant">Safeguarding</th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-on-surface-variant">Missed care</th>
              <th className="px-4 py-2.5 text-xs font-medium text-on-surface-variant">Risk Score</th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-on-surface-variant">Level</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {profiles.map((p) => (
              <tr
                key={p.client_id}
                className="hover:bg-gray-50/50 transition-colors"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/clients/${p.client_id}`}
                    className="font-medium text-indigo-700 hover:underline"
                  >
                    {p.client_name}
                  </Link>
                  {p.review_recommendation && (
                    <p className="text-[10px] text-amber-700 mt-0.5 max-w-xs leading-tight">
                      {p.review_recommendation}
                    </p>
                  )}
                </td>
                <td className="px-3 py-3 text-center">
                  <span className="text-sm font-semibold tabular-nums">{p.incident_count}</span>
                </td>
                <td className="px-3 py-3 text-center">
                  {p.falls_count > 0 ? (
                    <span className="text-xs font-semibold text-orange-600">{p.falls_count}</span>
                  ) : <span className="text-xs text-gray-300">—</span>}
                </td>
                <td className="px-3 py-3 text-center">
                  {p.medication_issues > 0 ? (
                    <span className="text-xs font-semibold text-orange-600">{p.medication_issues}</span>
                  ) : <span className="text-xs text-gray-300">—</span>}
                </td>
                <td className="px-3 py-3 text-center">
                  {p.behaviour_escalations > 0 ? (
                    <span className="text-xs font-semibold text-amber-600">{p.behaviour_escalations}</span>
                  ) : <span className="text-xs text-gray-300">—</span>}
                </td>
                <td className="px-3 py-3 text-center">
                  {p.safeguarding_alerts > 0 ? (
                    <span className="text-xs font-semibold text-red-600">{p.safeguarding_alerts}</span>
                  ) : <span className="text-xs text-gray-300">—</span>}
                </td>
                <td className="px-3 py-3 text-center">
                  {p.missed_care > 0 ? (
                    <span className="text-xs font-semibold text-amber-600">{p.missed_care}</span>
                  ) : <span className="text-xs text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 min-w-[120px]">
                  <ScoreBar score={p.risk_score} />
                </td>
                <td className="px-3 py-3 text-center">
                  <RiskBadge level={p.risk_level} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function IncidentIntelligenceDashboard({
  data,
}: {
  data: IntelligenceResponse
}) {
  const { summary, weekly_trend, staff_risk_profiles, client_risk_profiles, type_breakdown, pattern_alerts } = data

  return (
    <div className="space-y-6">

      {/* Pattern alerts */}
      {pattern_alerts.length > 0 && (
        <section>
          <PatternAlerts alerts={pattern_alerts} />
        </section>
      )}

      {/* Summary stats */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total incidents (90 days)"
          value={summary.total_incidents}
          sub={`${summary.open_incidents} open / investigating`}
        />
        <StatCard
          label="Critical incidents"
          value={summary.critical_incidents}
          sub={`${summary.high_incidents} high severity`}
          accent={summary.critical_incidents > 0 ? 'red' : undefined}
        />
        <StatCard
          label="Workers flagged"
          value={summary.workers_flagged}
          sub="High or critical risk level"
          accent={summary.workers_flagged > 0 ? 'orange' : undefined}
        />
        <StatCard
          label="Clients flagged"
          value={summary.clients_flagged}
          sub="High or critical risk level"
          accent={summary.clients_flagged > 0 ? 'orange' : undefined}
        />
      </section>

      {/* Secondary stats */}
      <section className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard
          label="Escalation rate"
          value={`${summary.escalation_rate}%`}
          sub="Of incidents requiring escalation"
          accent={summary.escalation_rate > 30 ? 'orange' : undefined}
        />
        <div className="col-span-2 lg:col-span-2 grid grid-cols-2 gap-3">
          {type_breakdown.slice(0, 2).map((t) => (
            <StatCard
              key={t.incident_type}
              label={t.incident_type.replace(/_/g, ' ')}
              value={t.count}
              sub={`${t.percentage}% of all incidents`}
            />
          ))}
        </div>
      </section>

      {/* Trend + type breakdown */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <TrendBar data={weekly_trend} />
        </div>
        <TypeBreakdown data={type_breakdown} />
      </section>

      {/* Staff risk profiles */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-primary">Staff Risk Profiles</h2>
          <Link
            href="/admin/incidents?sort=risk_score"
            className="text-xs text-indigo-600 hover:underline"
          >
            View all incidents →
          </Link>
        </div>
        <StaffRiskTable profiles={staff_risk_profiles} />
      </section>

      {/* Client risk profiles */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-primary">Client Risk Profiles</h2>
        </div>
        <ClientRiskTable profiles={client_risk_profiles} />
      </section>

      <p className="text-[10px] text-gray-400 text-right">
        Intelligence computed at {new Date(data.last_updated).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        {' · '}90-day rolling window
      </p>
    </div>
  )
}
