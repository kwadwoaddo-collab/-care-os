'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { WorkforceAnalytics } from '@/app/api/admin/analytics/workforce/route'

function StatCard({ label, value, colour, sub }: { label: string; value: string | number; colour?: string; sub?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <p className={`text-2xl font-bold ${colour ?? 'text-slate-900'}`}>{value}</p>
      <p className="text-sm font-medium text-slate-600 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function PctBar({ label, pct, colour }: { label: string; pct: number; colour: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="font-bold" style={{ color: colour }}>{pct}%</span>
      </div>
      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: colour }} />
      </div>
    </div>
  )
}

export default function WorkforceAnalyticsPage() {
  const [data,    setData]    = useState<WorkforceAnalytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/analytics/workforce')
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center py-24"><span className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
  if (!data)   return <div className="text-center py-24 text-slate-500">Failed to load workforce analytics.</div>

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/admin/analytics" className="hover:text-indigo-600">Analytics</Link>
          <span>/</span><span>Workforce</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Workforce Performance</h1>
        <p className="text-sm text-slate-500 mt-1">Attendance reliability, deployability trends, and onboarding efficiency. 30-day rolling window.</p>
      </div>

      {/* Headcount */}
      <div>
        <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">Headcount</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Active Staff"       value={data.headcount.active}         colour="text-emerald-600" />
          <StatCard label="In Onboarding"      value={data.headcount.pre_employment} colour={data.headcount.pre_employment > 5 ? 'text-amber-600' : undefined} />
          <StatCard label="Suspended"          value={data.headcount.suspended}      colour={data.headcount.suspended > 0 ? 'text-red-600' : undefined} />
          <StatCard label="Left (30d)"         value={data.headcount.terminated_30d} colour={data.headcount.terminated_30d > 2 ? 'text-red-600' : undefined} />
          <StatCard label="Total Workforce"    value={data.headcount.total} />
        </div>
      </div>

      {/* Attendance */}
      <div>
        <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">Attendance Reliability</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Shifts Completed"  value={data.attendance.shifts_completed_30d} colour="text-emerald-600" />
          <StatCard label="Shifts Missed"     value={data.attendance.shifts_missed_30d}    colour={data.attendance.shifts_missed_30d > 3 ? 'text-red-600' : undefined} />
          <StatCard label="Miss Rate"         value={`${data.attendance.miss_rate_pct}%`}   colour={data.attendance.miss_rate_pct > 10 ? 'text-red-600' : data.attendance.miss_rate_pct > 5 ? 'text-amber-600' : 'text-emerald-600'} />
          <StatCard label="Late Arrivals"     value={data.attendance.late_arrivals_30d}    colour={data.attendance.late_arrivals_30d > 5 ? 'text-amber-600' : undefined} />
          <StatCard label="Avg Lateness"      value={`${data.attendance.avg_lateness_minutes}m`} colour={data.attendance.avg_lateness_minutes > 20 ? 'text-amber-600' : undefined} sub="when late" />
        </div>
      </div>

      {/* Deployability + Overtime side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">Deployability Breakdown</h2>
          <PctBar label="Fully Deployable" pct={data.deployability.pct_deployable}                                   colour="#10b981" />
          <PctBar label="At Risk"          pct={data.headcount.total > 0 ? Math.round((data.deployability.at_risk / data.headcount.total) * 100) : 0} colour="#f59e0b" />
          <PctBar label="Blocked"          pct={data.headcount.total > 0 ? Math.round((data.deployability.blocked / data.headcount.total) * 100) : 0} colour="#ef4444" />
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
            <div className="text-center"><p className="text-xl font-bold text-emerald-600">{data.deployability.deployable}</p><p className="text-xs text-slate-500">Deployable</p></div>
            <div className="text-center"><p className="text-xl font-bold text-amber-600">{data.deployability.at_risk}</p><p className="text-xs text-slate-500">At Risk</p></div>
            <div className="text-center"><p className="text-xl font-bold text-red-600">{data.deployability.blocked}</p><p className="text-xs text-slate-500">Blocked</p></div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">Overtime & Hours</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-3xl font-bold text-slate-900">{data.overtime.staff_over_40h_count}</p>
              <p className="text-sm text-slate-500">Staff over 40h/week</p>
              {data.overtime.staff_over_40h_count > 0 && <p className="text-xs text-amber-600 mt-0.5">Burnout risk indicator</p>}
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-900">{data.overtime.avg_weekly_hours ?? '—'}</p>
              <p className="text-sm text-slate-500">Avg hours/week</p>
            </div>
          </div>
        </div>
      </div>

      {/* Onboarding efficiency */}
      <div>
        <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">Onboarding Efficiency</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="In Progress"            value={data.onboarding.in_progress} />
          <StatCard label="Backlog (>30 days)"     value={data.onboarding.backlog_over_30d} colour={data.onboarding.backlog_over_30d > 2 ? 'text-red-600' : undefined} sub="Pre-employment stalled" />
          <StatCard label="Completed (30d)"        value={data.onboarding.completed_30d} colour="text-emerald-600" />
          <StatCard label="Avg Days to Active"     value={data.onboarding.avg_days_to_active ?? '—'} sub="From pre-employment to active" />
        </div>
      </div>

      {/* Top missed staff */}
      {data.top_missed_staff.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Workers with Most Missed Shifts (30d)</h2>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-50">
              {data.top_missed_staff.map(s => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-800">{s.name}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={`font-bold ${s.missed_count >= 3 ? 'text-red-600' : 'text-amber-600'}`}>
                      {s.missed_count} missed
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/admin/staff/${s.id}`} className="text-indigo-600 hover:underline text-xs">View →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Link href="/admin/analytics" className="text-sm text-slate-500 hover:text-slate-700 inline-block">← Back to Analytics</Link>
    </div>
  )
}
