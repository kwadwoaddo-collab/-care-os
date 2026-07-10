'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, PageHeader, SeverityBadge, EmptyState, Skeleton, Button } from '@/components/ui'

interface Anomaly {
  id: string; anomaly_type: string; severity: string; description: string
  auto_detected: boolean; resolved: boolean; shift_id: string | null
  visit_note_id: string | null; created_at: string; detection_data: Record<string, unknown>
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
    await fetch('/api/admin/visits/anomalies', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setAnomalies(prev => prev.filter(a => a.id !== id))
    setResolving(null)
  }

  const criticalCount = anomalies.filter(a => a.severity === 'critical').length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visit Anomalies"
        subtitle="Auto-detected issues: late arrivals, short visits, medication problems, no-shows."
        breadcrumb={[
          { label: 'Visit Operations', href: '/admin/visits' },
          { label: 'Anomalies' },
        ]}
      />

      {criticalCount > 0 && !resolved && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-4 flex items-center gap-4">
          <span className="text-2xl" aria-hidden="true">🚨</span>
          <div className="flex-1">
            <p className="text-sm font-bold text-red-800">{criticalCount} critical anomal{criticalCount !== 1 ? 'ies' : 'y'} require immediate attention</p>
            <p className="text-xs text-red-700 mt-0.5">Review and resolve as soon as possible.</p>
          </div>
        </div>
      )}

      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex gap-1" role="group" aria-label="Resolution filter">
          <Button variant={!resolved ? 'primary' : 'secondary'} size="sm" onClick={() => setResolved(false)}>
            Unresolved
          </Button>
          <Button variant={resolved ? 'primary' : 'secondary'} size="sm" onClick={() => setResolved(true)}>
            Resolved
          </Button>
        </div>
        <select
          value={severity}
          onChange={e => setSeverity(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none bg-surface-container-lowest"
        >
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
      </div>

      {loading ? (
        <Skeleton rows={3} />
      ) : anomalies.length === 0 ? (
        <Card>
          <EmptyState
            message={resolved ? 'No resolved anomalies.' : 'No unresolved anomalies.'}
            submessage={!resolved ? 'Run a scan from the Visit Operations dashboard to detect issues.' : undefined}
            icon="✅"
          />
        </Card>
      ) : (
        <Card padding="none">
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
                      <span className="text-lg shrink-0 mt-0.5" aria-hidden="true">{TYPE_ICON[a.anomaly_type] ?? '⚠️'}</span>
                      <div>
                        <p className="font-medium text-slate-800 capitalize">{a.anomaly_type.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{a.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <SeverityBadge
                      level={a.severity === 'critical' ? 'critical' : a.severity === 'warning' ? 'warning' : 'info'}
                      label={a.severity}
                    />
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-slate-400">
                    {a.auto_detected ? 'Auto-detected' : 'Manual'}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-slate-400">
                    {fmtDate(a.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    {!a.resolved && (
                      <Button
                        variant="ghost"
                        size="xs"
                        loading={resolving === a.id}
                        onClick={() => resolve(a.id)}
                      >
                        Resolve
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
