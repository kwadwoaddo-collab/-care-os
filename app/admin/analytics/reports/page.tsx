'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface ExportData {
  generated_at:      string
  report_period:     string
  company_name:      string
  health_score:      { score: number; label: string; breakdown: string[] }
  signals:           { id?: string; type: string; headline: string; detail: string; area: string }[]
  kpis:              Record<string, number | string | null>
  incident_breakdown:{ type: string; count: number }[]
}

function Row({ label, value, highlight }: { label: string; value: string | number | null; highlight?: boolean }) {
  return (
    <tr className={highlight ? 'bg-amber-50' : 'hover:bg-slate-50'}>
      <td className="px-4 py-2.5 text-sm text-slate-600">{label}</td>
      <td className="px-4 py-2.5 text-sm font-semibold text-slate-900 text-right">{value ?? '—'}</td>
    </tr>
  )
}

export default function ReportsPage() {
  const [data,     setData]     = useState<ExportData | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    fetch('/api/admin/analytics/export')
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false))
  }, [])

  function printReport() {
    setPrinting(true)
    setTimeout(() => {
      window.print()
      setPrinting(false)
    }, 200)
  }

  function downloadJson() {
    if (!data) return
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `care-os-report-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div className="flex items-center justify-center py-24"><span className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
  if (!data)   return <div className="text-center py-24 text-slate-500">Failed to load report data.</div>

  const hs    = data.health_score
  const kpis  = data.kpis
  const genAt = new Date(data.generated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="space-y-6">
      {/* Screen-only header */}
      <div className="print:hidden flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Link href="/admin/analytics" className="hover:text-indigo-600">Analytics</Link>
            <span>/</span><span>Reports</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Executive Report</h1>
          <p className="text-sm text-slate-500 mt-1">Printable operational briefing for leadership. Data covers the last 30 days.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={downloadJson} className="px-4 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50">
            Download JSON
          </button>
          <button onClick={printReport} disabled={printing} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-2">
            {printing && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* ── Printable report ───────────────────────────────────────────────── */}
      <div id="report" className="bg-surface-container-lowest border border-slate-200 rounded-xl print:border-0 print:rounded-none print:shadow-none space-y-0">

        {/* Report header */}
        <div className="bg-slate-900 text-white px-8 py-6 print:bg-slate-900 rounded-t-xl print:rounded-none">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Care OS</p>
              <h1 className="text-2xl font-black mt-1">{data.company_name}</h1>
              <p className="text-slate-300 text-sm mt-0.5">Executive Operational Briefing — {data.report_period}</p>
            </div>
            <div className="text-right text-xs text-slate-400">
              <p>Generated</p>
              <p className="font-semibold text-white">{genAt}</p>
            </div>
          </div>
        </div>

        {/* Operational health score */}
        <div className="px-8 py-6 border-b border-slate-100">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className={`text-5xl font-black ${hs.label === 'Good' ? 'text-emerald-600' : hs.label === 'Moderate' ? 'text-amber-600' : 'text-red-600'}`}>{hs.score}</p>
              <p className="text-sm text-slate-500 mt-1">Health Score</p>
            </div>
            <div className="flex-1">
              <p className={`text-lg font-bold ${hs.label === 'Good' ? 'text-emerald-700' : hs.label === 'Moderate' ? 'text-amber-700' : 'text-red-700'}`}>
                {hs.label}
              </p>
              <p className="text-sm text-slate-600 mt-1">Composite score based on compliance, workforce readiness, incident rates, visit quality, and onboarding flow.</p>
              {hs.breakdown.length > 0 && (
                <div className="mt-2 space-y-0.5">
                  {hs.breakdown.map((b, i) => (
                    <p key={i} className="text-xs text-amber-700">⚠ {b}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* KPI table */}
        <div className="px-8 py-6 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">Key Performance Indicators</h2>
          <table className="w-full border border-slate-100 rounded-lg overflow-hidden text-sm">
            <tbody className="divide-y divide-slate-50">
              <Row label="Active Staff"                value={kpis.total_active_staff as number} />
              <Row label="Compliance Rate"             value={`${kpis.compliance_rate}%`}     highlight={(kpis.compliance_rate as number) < 85} />
              <Row label="Open Incidents"              value={kpis.open_incidents as number}   highlight={(kpis.open_incidents as number) > 3} />
              <Row label="Critical Incidents Open"     value={kpis.critical_incidents as number} highlight={(kpis.critical_incidents as number) > 0} />
              <Row label="Shift Fulfillment Rate"      value={`${kpis.shift_fulfillment_rate}%`} highlight={(kpis.shift_fulfillment_rate as number) < 90} />
              <Row label="Missed Visits (30d)"         value={kpis.missed_visits_30d as number} highlight={(kpis.missed_visits_30d as number) > 3} />
              <Row label="Visit Completion Rate"       value={`${kpis.visit_completion_rate}%`} />
              <Row label="Medication Incidents (30d)"  value={kpis.medication_incidents_30d as number} highlight={(kpis.medication_incidents_30d as number) > 0} />
              <Row label="Compliance Expiring (30d)"   value={kpis.expiring_compliance_30d as number} highlight={(kpis.expiring_compliance_30d as number) > 5} />
              <Row label="Onboarding Backlog"          value={kpis.onboarding_backlog as number} highlight={(kpis.onboarding_backlog as number) > 2} />
            </tbody>
          </table>
        </div>

        {/* Predictive signals */}
        {data.signals.length > 0 && (
          <div className="px-8 py-6 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">Predictive Signals</h2>
            <div className="space-y-3">
              {data.signals.map(sig => (
                <div key={sig.id ?? sig.headline} className={`rounded-lg p-3 border ${sig.type === 'critical' ? 'bg-red-50 border-red-200' : sig.type === 'warning' ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
                  <p className="text-sm font-bold text-slate-800">{sig.type === 'critical' ? '🚨' : '⚠️'} {sig.headline}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{sig.detail}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Incident breakdown */}
        {data.incident_breakdown.length > 0 && (
          <div className="px-8 py-6 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">Incident Breakdown (90 days)</h2>
            <table className="w-full border border-slate-100 rounded-lg overflow-hidden text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
                  <th className="px-4 py-2.5 text-left">Type</th>
                  <th className="px-4 py-2.5 text-right">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.incident_breakdown.sort((a, b) => b.count - a.count).map(i => (
                  <tr key={i.type} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 capitalize text-slate-700">{i.type.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-900">{i.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="px-8 py-5 bg-slate-50 rounded-b-xl print:rounded-none text-xs text-slate-400 flex items-center justify-between">
          <p>Care OS — Confidential operational report</p>
          <p>Generated {genAt}</p>
        </div>
      </div>

      {/* Report type links */}
      <div className="print:hidden grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Workforce Report',      href: '/admin/analytics/workforce', desc: 'Attendance, overtime, deployability' },
          { label: 'Safeguarding Report',   href: '/admin/analytics/safeguarding', desc: 'Incident trends, risk clusters' },
          { label: 'Compliance Summary',    href: '/admin/compliance', desc: 'Full compliance detail view' },
        ].map(({ label, href, desc }) => (
          <Link key={href} href={href} className="bg-surface-container-lowest border border-slate-200 rounded-xl p-4 hover:border-indigo-300 hover:bg-indigo-50 transition-colors">
            <p className="text-sm font-semibold text-slate-800">{label}</p>
            <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
          </Link>
        ))}
      </div>

      <Link href="/admin/analytics" className="print:hidden text-sm text-slate-500 hover:text-slate-700 inline-block">← Back to Analytics</Link>
    </div>
  )
}
