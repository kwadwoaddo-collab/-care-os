'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import type { AnalyticsDashboard } from '@/app/api/admin/analytics/route'
import type { TrendsResponse } from '@/app/api/admin/analytics/trends/route'
import type { Period } from '@/lib/analytics/compute'

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ data, colour = '#4f46e5' }: { data: number[]; colour?: string }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const w = 80; const h = 32; const pad = 2
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2)
    const y = h - pad - ((v / max) * (h - pad * 2))
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <polyline points={pts} fill="none" stroke={colour} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Bar chart (simple inline SVG) ─────────────────────────────────────────────

function BarChart({ data, label }: { data: { label: string; value: number }[]; label: string }) {
  const max = Math.max(...data.map(d => d.value), 1)
  const w = 100 / data.length
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">{label}</p>
      <div className="flex items-end gap-1 h-24">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[10px] text-slate-400">{d.value > 0 ? d.value : ''}</span>
            <div
              className="w-full bg-indigo-500 rounded-t transition-all"
              style={{ height: `${Math.max(2, (d.value / max) * 80)}px` }}
            />
            <span className="text-[9px] text-slate-400 truncate w-full text-center">{d.label}</span>
          </div>
        ))}
      </div>
      <div className="sr-only">{w}</div>
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
    <div className="flex items-center gap-5">
      <div className="relative w-24 h-24 shrink-0">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
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

// ── Signal badge ──────────────────────────────────────────────────────────────

const SIGNAL_CLS: Record<string, string> = {
  critical: 'bg-red-50 border-red-300 text-red-800',
  warning:  'bg-amber-50 border-amber-200 text-amber-800',
  info:     'bg-blue-50 border-blue-200 text-blue-800',
}
const SIGNAL_ICON: Record<string, string> = { critical: '🚨', warning: '⚠️', info: 'ℹ️' }

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AnalyticsDashboardPage() {
  const [data,    setData]    = useState<AnalyticsDashboard | null>(null)
  const [trends,  setTrends]  = useState<TrendsResponse | null>(null)
  const [period,  setPeriod]  = useState<Period>('30d')
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/admin/analytics').then(r => r.json()),
      fetch(`/api/admin/analytics/trends?period=${period}`).then(r => r.json()),
    ]).then(([dash, tr]) => {
      setData(dash)
      setTrends(tr)
    }).finally(() => setLoading(false))
  }, [period])

  useEffect(() => { loadData() }, [loadData])

  const kpis = data?.kpis
  const hs   = data?.health_score

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Executive Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">Operational intelligence for leadership and directors.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(['7d','30d','90d','12m'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${period === p ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              {p === '12m' ? '12 months' : p}
            </button>
          ))}
          <Link href="/admin/analytics/reports" className="px-3 py-1.5 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50">
            Export Report
          </Link>
        </div>
      </div>

      {loading && !data ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-28 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* Health score + signals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              {hs && <HealthGauge score={hs.score} label={hs.label} colour={hs.colour} />}
              {hs && hs.breakdown.length > 0 && (
                <div className="mt-4 space-y-1.5">
                  {hs.breakdown.map((b, i) => (
                    <p key={i} className="text-xs text-slate-500 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                      {b}
                    </p>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 overflow-y-auto max-h-64">
              <p className="text-sm font-semibold text-slate-700">Predictive Signals</p>
              {data?.signals.length === 0 && (
                <p className="text-sm text-slate-400">No signals detected. All metrics within normal range.</p>
              )}
              {data?.signals.map(sig => (
                <div key={sig.id} className={`rounded-lg border p-3 ${SIGNAL_CLS[sig.type] ?? 'bg-slate-50 border-slate-200'}`}>
                  <p className="text-xs font-bold flex items-center gap-1.5">
                    <span>{SIGNAL_ICON[sig.type]}</span>
                    {sig.headline}
                  </p>
                  <p className="text-xs mt-0.5 opacity-80">{sig.detail}</p>
                </div>
              ))}
            </div>
          </div>

          {/* KPI bar */}
          {kpis && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {[
                { label: 'Active Staff',        value: kpis.total_active_staff,       colour: '' },
                { label: 'Compliance Rate',     value: `${kpis.compliance_rate}%`,     colour: kpis.compliance_rate < 70 ? 'text-red-600' : kpis.compliance_rate < 85 ? 'text-amber-600' : 'text-emerald-600' },
                { label: 'Open Incidents',      value: kpis.open_incidents,            colour: kpis.open_incidents > 5 ? 'text-red-600' : '' },
                { label: 'Critical Incidents',  value: kpis.critical_incidents,        colour: kpis.critical_incidents > 0 ? 'text-red-600' : 'text-emerald-600' },
                { label: 'Missed Visits (30d)', value: kpis.missed_visits_30d,         colour: kpis.missed_visits_30d > 3 ? 'text-red-600' : '' },
                { label: 'Shift Fulfillment',   value: `${kpis.shift_fulfillment_rate}%`, colour: kpis.shift_fulfillment_rate < 90 ? 'text-amber-600' : 'text-emerald-600' },
                { label: 'Med Incidents (30d)', value: kpis.medication_incidents_30d,  colour: kpis.medication_incidents_30d > 0 ? 'text-red-600' : 'text-emerald-600' },
                { label: 'Expiring Compliance', value: kpis.expiring_compliance_30d,   colour: kpis.expiring_compliance_30d > 5 ? 'text-amber-600' : '' },
                { label: 'Onboarding Backlog',  value: kpis.onboarding_backlog,        colour: kpis.onboarding_backlog > 2 ? 'text-amber-600' : '' },
                { label: 'Applicants Active',   value: kpis.total_applicants },
                { label: 'Avg Onboarding Days', value: kpis.avg_onboarding_days ?? '—' },
                { label: 'Deployable Staff',    value: kpis.deployable_staff,          colour: 'text-emerald-600' },
              ].map(({ label, value, colour }) => (
                <div key={label} className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className={`text-xl font-bold ${colour ?? 'text-slate-900'}`}>{value}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-tight">{label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Health score breakdown */}
          {hs && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-sm font-semibold text-slate-700 mb-4">Score Breakdown</p>
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
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(pts/max)*100}%`, backgroundColor: colour }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trend charts */}
          {trends && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: 'Incident Trend',        data: trends.incidents,            colour: '#ef4444' },
                { label: 'Missed Visits',          data: trends.missed_visits,        colour: '#f97316' },
                { label: 'New Staff',              data: trends.new_staff,            colour: '#10b981' },
                { label: 'New Applicants',         data: trends.new_applicants,       colour: '#4f46e5' },
                { label: 'Compliance Issues',      data: trends.compliance_issues,    colour: '#f59e0b' },
                { label: 'Medication Incidents',   data: trends.medication_incidents, colour: '#8b5cf6' },
              ].map(({ label, data: tData, colour }) => (
                <div key={label} className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <p className="text-sm font-semibold text-slate-700">{label}</p>
                    <Sparkline data={tData.map(p => p.value)} colour={colour} />
                  </div>
                  <BarChart data={tData.map(p => ({ label: p.label, value: p.value }))} label="" />
                </div>
              ))}
            </div>
          )}

          {/* Navigation to sub-analytics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Workforce Performance',   href: '/admin/analytics/workforce',    desc: 'Attendance, overtime, deployability, onboarding throughput' },
              { label: 'Safeguarding Analytics',  href: '/admin/analytics/safeguarding', desc: 'Incident trends, risk profiles, escalation patterns' },
              { label: 'Executive Reports',       href: '/admin/analytics/reports',      desc: 'Exportable briefings, compliance summaries, workforce reports' },
            ].map(({ label, href, desc }) => (
              <Link key={href} href={href} className="bg-white border border-slate-200 rounded-xl p-5 hover:border-indigo-300 hover:bg-indigo-50 transition-colors group">
                <p className="text-sm font-semibold text-slate-800 group-hover:text-indigo-700">{label}</p>
                <p className="text-xs text-slate-500 mt-1">{desc}</p>
                <p className="text-xs text-indigo-600 font-medium mt-2">View →</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
