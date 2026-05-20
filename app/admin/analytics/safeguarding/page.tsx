'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { SafeguardingAnalytics } from '@/app/api/admin/analytics/safeguarding/route'
import type { Period } from '@/lib/analytics/compute'

function Sparkline({ data, colour = '#ef4444' }: { data: number[]; colour?: string }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const w = 80; const h = 28; const pad = 2
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

const SEV_COLOUR: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high:     'bg-orange-100 text-orange-700',
  medium:   'bg-amber-100 text-amber-700',
  low:      'bg-slate-100 text-slate-600',
}

const TYPE_LABELS: Record<string, string> = {
  safeguarding:    'Safeguarding',
  medication_error:'Medication Error',
  fall:            'Fall',
  injury:          'Injury',
  complaint:       'Complaint',
  other:           'Other',
}

export default function SafeguardingAnalyticsPage() {
  const [data,    setData]    = useState<SafeguardingAnalytics | null>(null)
  const [period,  setPeriod]  = useState<Period>('30d')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/analytics/safeguarding?period=${period}`)
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false))
  }, [period])

  if (loading) return <div className="flex items-center justify-center py-24"><span className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
  if (!data)   return <div className="text-center py-24 text-slate-500">Failed to load safeguarding analytics.</div>

  const s = data.summary

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Link href="/admin/analytics" className="hover:text-indigo-600">Analytics</Link>
            <span>/</span><span>Safeguarding</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Safeguarding Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">Incident frequency, escalation patterns, and risk clusters. 90-day base window.</p>
        </div>
        <div className="flex items-center gap-2">
          {(['7d','30d','90d','12m'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${period === p ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              {p === '12m' ? '12m' : p}
            </button>
          ))}
        </div>
      </div>

      {/* SLA alert */}
      {s.unresolved_beyond_sla > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-4 flex items-center gap-4">
          <span className="text-2xl">🚨</span>
          <div>
            <p className="text-sm font-bold text-red-800">{s.unresolved_beyond_sla} safeguarding escalation{s.unresolved_beyond_sla !== 1 ? 's' : ''} unresolved beyond 5-day SLA</p>
            <p className="text-xs text-red-700 mt-0.5">Immediate management attention required.</p>
          </div>
          <Link href="/admin/incidents" className="ml-auto px-3 py-2 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 shrink-0">
            Review Incidents →
          </Link>
        </div>
      )}

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total (90d)',         value: s.total_incidents_90d },
          { label: 'Open Now',            value: s.open_incidents,           colour: s.open_incidents > 3 ? 'text-red-600' : undefined },
          { label: 'Critical Open',       value: s.critical_open,            colour: s.critical_open > 0 ? 'text-red-600' : 'text-emerald-600' },
          { label: 'Escalation Rate',     value: `${s.escalation_rate_pct}%`, colour: s.escalation_rate_pct > 30 ? 'text-amber-600' : undefined },
          { label: 'Avg Resolution Days', value: s.avg_resolution_days ?? '—' },
          { label: 'Beyond SLA (5d)',     value: s.unresolved_beyond_sla,    colour: s.unresolved_beyond_sla > 0 ? 'text-red-600' : 'text-emerald-600' },
        ].map(({ label, value, colour }) => (
          <div key={label} className="bg-surface-container-lowest border border-slate-200 rounded-xl p-4">
            <p className={`text-2xl font-bold ${colour ?? 'text-slate-900'}`}>{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Incident type breakdown */}
        <div className="bg-surface-container-lowest border border-slate-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Incident Types</h2>
            <Sparkline data={data.trend.map(t => t.value)} />
          </div>
          {data.type_breakdown.length === 0 ? (
            <p className="text-sm text-slate-400">No incidents in this period.</p>
          ) : (
            data.type_breakdown.map(t => (
              <div key={t.type} className="flex items-center gap-3">
                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-600 capitalize">{TYPE_LABELS[t.type] ?? t.type}</span>
                    <span className="font-bold text-slate-800">{t.count} ({t.pct}%)</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-red-400 rounded-full" style={{ width: `${t.pct}%` }} />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Severity breakdown */}
        <div className="bg-surface-container-lowest border border-slate-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Severity Distribution</h2>
            <Sparkline data={data.escalation_trend.map(t => t.value)} colour="#f97316" />
          </div>
          {data.severity_breakdown.length === 0 ? (
            <p className="text-sm text-slate-400">No incidents in this period.</p>
          ) : (
            data.severity_breakdown.sort((a, b) => {
              const order = { critical: 0, high: 1, medium: 2, low: 3 }
              return ((order as Record<string, number>)[a.severity] ?? 9) - ((order as Record<string, number>)[b.severity] ?? 9)
            }).map(s => (
              <div key={s.severity} className="flex items-center justify-between">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${SEV_COLOUR[s.severity] ?? 'bg-slate-100 text-slate-500'}`}>
                  {s.severity}
                </span>
                <span className="text-lg font-bold text-slate-800">{s.count}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Risk clusters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.high_risk_clients.length > 0 && (
          <div className="bg-surface-container-lowest border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
              <span>👤</span>
              <h2 className="text-sm font-semibold text-slate-700">High-Risk Clients (≥2 incidents)</h2>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-50">
                {data.high_risk_clients.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-800">{c.name}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${SEV_COLOUR[c.last_severity] ?? 'bg-slate-100'}`}>
                        {c.last_severity}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-red-600">{c.incident_count} incidents</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data.high_risk_workers.length > 0 && (
          <div className="bg-surface-container-lowest border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
              <span>🧑‍⚕️</span>
              <h2 className="text-sm font-semibold text-slate-700">High-Risk Workers (≥2 incidents)</h2>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-50">
                {data.high_risk_workers.map(w => (
                  <tr key={w.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-800">{w.name}</td>
                    <td className="px-5 py-3 text-right font-bold text-amber-600">{w.incident_count} incidents</td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/admin/staff/${w.id}`} className="text-indigo-600 hover:underline text-xs">View →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Link href="/admin/analytics" className="text-sm text-slate-500 hover:text-slate-700 inline-block">← Back to Analytics</Link>
    </div>
  )
}
