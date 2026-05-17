'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

interface Anomaly {
  id: string; anomaly_type: string; severity: string; description: string
  auto_detected: boolean; resolved: boolean; shift_id: string | null
  visit_note_id: string | null; created_at: string; detection_data: Record<string, unknown>
}

const SEV_CLS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  warning:  'bg-amber-100 text-amber-700',
  info:     'bg-blue-100 text-blue-700',
}

const TYPE_ICON: Record<string, string> = {
  late_arrival:     '⏰',
  early_departure:  '🚪',
  short_visit:      '⚡',
  no_show:          '❌',
  medication_anomaly: '💊',
  task_skip_pattern: '📋',
  repeated_missed:  '🔁',
  escalation_raised:'🚨',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function AnomaliesPage() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [loading,   setLoading]   = useState(true)
  const [resolved,  setResolved]  = useState(false)
  const [severity,  setSeverity]  = useState('')
  const [resolving, setResolving] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    const sp = new URLSearchParams({ resolved: String(resolved) })
    if (severity) sp.set('severity', severity)
    fetch(`/api/admin/visits/anomalies?${sp}`)
      .then(r => r.json())
      .then(d => setAnomalies(d.anomalies ?? []))
      .finally(() => setLoading(false))
  }, [resolved, severity])

  useEffect(() => { load() }, [load])

  async function resolve(id: string) {
    setResolving(id)
    await fetch('/api/admin/visits/anomalies', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setAnomalies(prev => prev.filter(a => a.id !== id))
    setResolving(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Link href="/admin/visits" className="hover:text-indigo-600">Visit Operations</Link>
            <span>/</span><span>Anomalies</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Visit Anomalies</h1>
          <p className="text-sm text-slate-500 mt-1">Auto-detected issues: late arrivals, short visits, medication problems, no-shows.</p>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <button
          onClick={() => setResolved(false)}
          className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${!resolved ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
        >
          Unresolved
        </button>
        <button
          onClick={() => setResolved(true)}
          className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${resolved ? 'bg-slate-700 text-white border-slate-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
        >
          Resolved
        </button>
        <select value={severity} onChange={e => setSeverity(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700">
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : anomalies.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-slate-500 text-sm">{resolved ? 'No resolved anomalies.' : 'No unresolved anomalies. Run a scan from the Visit Operations dashboard.'}</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">
                <th className="px-4 py-3">Anomaly</th>
                <th className="px-4 py-3 hidden md:table-cell">Severity</th>
                <th className="px-4 py-3 hidden lg:table-cell">Source</th>
                <th className="px-4 py-3 hidden lg:table-cell">Detected</th>
                <th className="px-4 py-3 sr-only">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {anomalies.map(a => (
                <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <span className="text-lg shrink-0 mt-0.5">{TYPE_ICON[a.anomaly_type] ?? '⚠️'}</span>
                      <div>
                        <p className="font-medium text-slate-800 capitalize">{a.anomaly_type.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{a.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${SEV_CLS[a.severity] ?? 'bg-slate-100 text-slate-500'}`}>
                      {a.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-slate-400">
                    {a.auto_detected ? 'Auto-detected' : 'Manual'}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-slate-400">
                    {fmtDate(a.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    {!a.resolved && (
                      <button
                        onClick={() => resolve(a.id)}
                        disabled={resolving === a.id}
                        className="text-indigo-600 hover:text-indigo-800 text-xs font-medium disabled:opacity-60"
                      >
                        {resolving === a.id ? 'Resolving…' : 'Resolve'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
