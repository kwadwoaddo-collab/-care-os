'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  MetricCard,
  MetricGrid,
  Card,
  PageHeader,
  SectionHeader,
  OperationalBanner,
  Sparkline,
  Skeleton,
} from '@/components/ui'
import type { AnalyticsDashboard } from '@/app/api/admin/analytics/route'
import type { TrendsResponse }     from '@/app/api/admin/analytics/trends/route'
import type { Period }             from '@/lib/analytics/compute'

// ── Bar chart ─────────────────────────────────────────────────────────────────

function BarChart({ data, colour = '#4f46e5' }: { data: { label: string; value: number }[]; colour?: string }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="flex items-end gap-1 h-20 mt-2" aria-hidden="true">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
          {d.value > 0 && <span className="text-[9px] text-slate-400">{d.value}</span>}
          <div
            className="w-full rounded-t transition-all"
            style={{
              height: `${Math.max(2, (d.value / max) * 68)}px`,
              backgroundColor: colour,
            }}
          />
          <span className="text-[9px] text-slate-400 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

// ── Health gauge ──────────────────────────────────────────────────────────────

const HEALTH_COLOURS: Record<string, string> = {
  emerald: '#10b981',
  amber:   '#f59e0b',
  orange:  '#f97316',
  red:     '#ef4444',
}

function HealthGauge({ score, label, colour }: { score: number; label: string; colour: string }) {
  const c = HEALTH_COLOURS[colour] ?? '#4f46e5'
  return (
    <div className="flex items-center gap-5" role="meter" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100} aria-label={`Operational health: ${score}/100 — ${label}`}>
      <div className="relative w-24 h-24 shrink-0">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90" aria-hidden="true">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3" />
          <circle cx="18" cy="18" r="15.9" fill="none" stroke={c} strokeWidth="3"
            strokeDasharray={`${score} ${100 - score}`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black" style={{ color: c }}>{score}</span>
          <span className="text-[10px] text-slate-500 font-medium">/100</span>
        </div>
      </div>
      <div>
        <p className="text-lg font-bold text-slate-900">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">Operational Health Score</p>
      </div>
    </div>
  )
}

// ── Period picker ─────────────────────────────────────────────────────────────

const PERIOD_LABELS: Record<Period, string> = { '7d': '7 days', '30d': '30 days', '90d': '90 days', '12m': '12 months' }

function PeriodPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Time period">
      {(['7d','30d','90d','12m'] as Period[]).map(p => (
        <button
          key={p}
          onClick={() => onChange(p)}
          aria-pressed={value === p}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${value === p ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
        >
          {p === '12m' ? '12m' : p}
        </button>
      ))}
    </div>
  )
}

// ── Trend chart card ──────────────────────────────────────────────────────────

function TrendChartCard({ label, data, colour }: { label: string; data: { label: string; value: number }[]; colour: string }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <Card padding="sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-700">{label}</p>
          <p className="text-xs text-slate-400 mt-0.5">{total} total</p>
        </div>
        <Sparkline data={data.map(p => p.value)} colour={colour} />
      </div>
      <BarChart data={data} colour={colour} />
    </Card>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AnalyticsDashboardPage() {
  const [data,    setData]    = useState<AnalyticsDashboard | null>(null)
  const [trends,  setTrends]  = useState<TrendsResponse | null>(null)
  const [period,  setPeriod]  = useState<Period>('30d')
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const loadData = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      fetch('/api/admin/analytics').then(r => r.json()),
      fetch(`/api/admin/analytics/trends?period=${period}`).then(r => r.json()),
    ]).then(([dash, tr]) => {
      setData(dash)
      setTrends(tr)
    }).catch(() => setError('Failed to load analytics data.'))
     .finally(() => setLoading(false))
  }, [period])

  useEffect(() => { loadData() }, [loadData])

  const kpis = data?.kpis
  const hs   = data?.health_score
  const criticalSignals = data?.signals.filter(s => s.type === 'critical') ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Executive Analytics"
        subtitle="Operational intelligence for leadership and directors."
        actions={
          <>
            <PeriodPicker value={period} onChange={setPeriod} />
            <Link href="/admin/analytics/reports" className="px-3 py-1.5 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
              Export Report
            </Link>
          </>
        }
      />

      {/* Critical signal alert */}
      {criticalSignals.length > 0 && (
        <OperationalBanner
          type="critical"
          message={`${criticalSignals.length} critical operational signal${criticalSignals.length !== 1 ? 's' : ''} require leadership attention`}
          detail={criticalSignals[0]?.headline}
          action={{ label: 'Review signals →', href: '#signals' }}
        />
      )}

      {error && (
        <OperationalBanner type="warning" message={error} detail="Try refreshing the page." dismissible />
      )}

      {loading && !data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="w-24 h-24 rounded-full bg-slate-100 animate-pulse" />
              <Skeleton variant="text" />
            </div>
            <Skeleton variant="card" count={1} />
          </div>
          <Skeleton variant="kpi" count={12} />
        </div>
      ) : (
        <>
          {/* Health score + signals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              {hs && <HealthGauge score={hs.score} label={hs.label} colour={hs.colour} />}
              {hs && hs.breakdown.length > 0 && (
                <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-4">
                  {hs.breakdown.map((b, i) => (
                    <p key={i} className="text-xs text-slate-500 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" aria-hidden="true" />
                      {b}
                    </p>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <SectionHeader title="Predictive Signals" className="mb-3" />
              <div className="space-y-2.5 overflow-y-auto max-h-60">
                {data?.signals.length === 0 && (
                  <p className="text-sm text-slate-400 py-4 text-center">
                    No signals detected — all metrics within normal range.
                  </p>
                )}
                {data?.signals.map(sig => (
                  <OperationalBanner
                    key={sig.id}
                    type={sig.type === 'critical' ? 'critical' : sig.type === 'warning' ? 'warning' : 'info'}
                    message={sig.headline}
                    detail={sig.detail}
                  />
                ))}
              </div>
            </Card>
          </div>

          {/* KPI grid */}
          {kpis && (
            <MetricGrid cols={6}>
              <MetricCard label="Active Staff"        value={kpis.total_active_staff}          colour="slate" />
              <MetricCard label="Compliance Rate"     value={`${kpis.compliance_rate}%`}        colour={kpis.compliance_rate < 70 ? 'red' : kpis.compliance_rate < 85 ? 'amber' : 'emerald'} />
              <MetricCard label="Open Incidents"      value={kpis.open_incidents}               colour={kpis.open_incidents > 5 ? 'red' : 'slate'} />
              <MetricCard label="Critical Incidents"  value={kpis.critical_incidents}           colour={kpis.critical_incidents > 0 ? 'red' : 'emerald'} />
              <MetricCard label="Missed Visits (30d)" value={kpis.missed_visits_30d}            colour={kpis.missed_visits_30d > 3 ? 'red' : 'slate'} />
              <MetricCard label="Shift Fulfillment"   value={`${kpis.shift_fulfillment_rate}%`} colour={kpis.shift_fulfillment_rate < 90 ? 'amber' : 'emerald'} />
              <MetricCard label="Med Incidents (30d)" value={kpis.medication_incidents_30d}     colour={kpis.medication_incidents_30d > 0 ? 'red' : 'emerald'} />
              <MetricCard label="Expiring Compliance" value={kpis.expiring_compliance_30d}      colour={kpis.expiring_compliance_30d > 5 ? 'amber' : 'slate'} />
              <MetricCard label="Onboarding Backlog"  value={kpis.onboarding_backlog}           colour={kpis.onboarding_backlog > 2 ? 'amber' : 'slate'} />
              <MetricCard label="Active Applicants"   value={kpis.total_applicants} />
              <MetricCard label="Avg Onboarding Days" value={kpis.avg_onboarding_days ?? '—'} />
              <MetricCard label="Deployable Staff"    value={kpis.deployable_staff}             colour="emerald" />
            </MetricGrid>
          )}

          {/* Health score breakdown */}
          {hs && (
            <Card>
              <SectionHeader title="Score Breakdown" className="mb-4" />
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  { label: 'Compliance',    pts: hs.compliance_pts,  max: 25, colour: '#f59e0b' },
                  { label: 'Workforce',     pts: hs.workforce_pts,   max: 25, colour: '#4f46e5' },
                  { label: 'Incidents',     pts: hs.incident_pts,    max: 20, colour: '#ef4444' },
                  { label: 'Visit Quality', pts: hs.visit_pts,       max: 20, colour: '#10b981' },
                  { label: 'Onboarding',    pts: hs.onboarding_pts,  max: 10, colour: '#8b5cf6' },
                ].map(({ label, pts, max, colour }) => (
                  <div key={label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-600">{label}</span>
                      <span className="font-bold" style={{ color: colour }}>{pts}/{max}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden" role="progressbar" aria-valuenow={pts} aria-valuemax={max}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${(pts/max)*100}%`, backgroundColor: colour }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Trend charts */}
          {trends && (
            <>
              <SectionHeader title={`Trend Analysis — ${PERIOD_LABELS[period]}`} />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <TrendChartCard label="Incident Trend"      data={trends.incidents}            colour="#ef4444" />
                <TrendChartCard label="Missed Visits"       data={trends.missed_visits}        colour="#f97316" />
                <TrendChartCard label="New Staff"           data={trends.new_staff}            colour="#10b981" />
                <TrendChartCard label="New Applicants"      data={trends.new_applicants}       colour="#4f46e5" />
                <TrendChartCard label="Compliance Issues"   data={trends.compliance_issues}    colour="#f59e0b" />
                <TrendChartCard label="Medication Incidents" data={trends.medication_incidents} colour="#8b5cf6" />
              </div>
            </>
          )}

          {/* Navigation to sub-analytics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Workforce Performance',   href: '/admin/analytics/workforce',    desc: 'Attendance, overtime, deployability, onboarding throughput', icon: '👥' },
              { label: 'Safeguarding Analytics',  href: '/admin/analytics/safeguarding', desc: 'Incident trends, risk profiles, escalation patterns',         icon: '🛡' },
              { label: 'Executive Reports',       href: '/admin/analytics/reports',      desc: 'Exportable briefings, compliance summaries, workforce reports', icon: '📊' },
            ].map(({ label, href, desc, icon }) => (
              <Link key={href} href={href} className="group block">
                <Card className="hover:border-indigo-300 hover:bg-indigo-50 transition-colors">
                  <p className="text-lg mb-1" aria-hidden="true">{icon}</p>
                  <p className="text-sm font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors">{label}</p>
                  <p className="text-xs text-slate-500 mt-1">{desc}</p>
                  <p className="text-xs text-indigo-600 font-medium mt-2">View →</p>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
