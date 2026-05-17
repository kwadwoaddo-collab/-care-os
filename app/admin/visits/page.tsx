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
  SeverityBadge,
  Skeleton,
  Button,
} from '@/components/ui'
import type { VisitsDashboard, LiveVisit } from '@/app/api/admin/visits/route'

function fmtTime(t: string) { return t.slice(0, 5) }
function fmtISO(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function VisitRow({ v, tag }: { v: LiveVisit; tag: 'live' | 'overdue' | 'missed' }) {
  const dotCls = tag === 'live' ? 'bg-emerald-500' : tag === 'overdue' ? 'bg-amber-500' : 'bg-red-500'
  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${dotCls}`} aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-slate-800 truncate max-w-[180px]">{v.title}</p>
            {v.client_name && <p className="text-xs text-slate-400">{v.client_name}</p>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-slate-600 hidden md:table-cell">
        {fmtTime(v.start_time)}–{fmtTime(v.end_time)}
      </td>
      <td className="px-4 py-3 text-sm text-slate-600 hidden lg:table-cell">{v.worker_name}</td>
      <td className="px-4 py-3 hidden md:table-cell">
        <SeverityBadge level={
          v.status === 'completed' ? 'success' :
          v.status === 'in_progress' ? 'active' :
          v.status === 'missed' ? 'critical' : 'info'
        } label={v.status.replace(/_/g, ' ')} />
      </td>
      <td className="px-4 py-3 hidden lg:table-cell text-sm">
        {v.clock_in ? (
          <span className="text-emerald-600">In {fmtISO(v.clock_in)}</span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
        {v.clock_out && <span className="text-slate-400 ml-2">Out {fmtISO(v.clock_out)}</span>}
      </td>
      <td className="px-4 py-3 hidden lg:table-cell text-xs">
        {v.lateness_minutes > 0 && (
          <SeverityBadge level={v.lateness_minutes >= 30 ? 'critical' : 'warning'} label={`+${v.lateness_minutes}m late`} />
        )}
        {v.escalation_raised && (
          <span className="ml-1 text-red-600 font-semibold text-xs">⚠</span>
        )}
      </td>
      <td className="px-4 py-3">
        <Link href="/admin/visit-notes" className="text-indigo-600 hover:text-indigo-800 text-xs font-medium">
          Notes →
        </Link>
      </td>
    </tr>
  )
}

function VisitSection({ title, visits, tag, emptyMsg }: { title: string; visits: LiveVisit[]; tag: 'live' | 'overdue' | 'missed'; emptyMsg: string }) {
  if (visits.length === 0) {
    return (
      <Card>
        <SectionHeader title={title} count={0} className="mb-3" />
        <p className="text-sm text-slate-400">{emptyMsg}</p>
      </Card>
    )
  }
  return (
    <Card padding="none">
      <div className="px-4 py-3 border-b border-slate-100">
        <SectionHeader title={title} count={visits.length} />
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">
            <th className="px-4 py-2.5">Visit</th>
            <th className="px-4 py-2.5 hidden md:table-cell">Time</th>
            <th className="px-4 py-2.5 hidden lg:table-cell">Worker</th>
            <th className="px-4 py-2.5 hidden md:table-cell">Status</th>
            <th className="px-4 py-2.5 hidden lg:table-cell">Clock</th>
            <th className="px-4 py-2.5 hidden lg:table-cell">Alerts</th>
            <th className="px-4 py-2.5 sr-only">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {visits.map(v => <VisitRow key={v.shift_id} v={v} tag={tag} />)}
        </tbody>
      </table>
    </Card>
  )
}

export default function VisitsDashboardPage() {
  const [data,        setData]        = useState<VisitsDashboard | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [scanning,    setScanning]    = useState(false)
  const [scanResult,  setScanResult]  = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/visits')
      .then(r => r.json())
      .then(d => { setData(d); setLastRefresh(new Date()) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 60_000)
    return () => clearInterval(interval)
  }, [load])

  async function runAnomalyScan() {
    setScanning(true)
    setScanResult(null)
    try {
      const res = await fetch('/api/admin/visits/anomalies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const d = await res.json()
      setScanResult(
        `Late arrivals: ${d.late_arrival} · Short visits: ${d.short_visit} · Medication: ${d.medication} · No-shows: ${d.no_show}`
      )
      load()
    } catch {
      setScanResult('Scan failed')
    } finally { setScanning(false) }
  }

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visit Operations"
        subtitle={`${dateStr} · Auto-refreshes every 60 seconds`}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={load} loading={loading}>
              Refresh
            </Button>
            <Button variant="warning" size="sm" onClick={runAnomalyScan} loading={scanning}>
              Detect Anomalies
            </Button>
          </>
        }
      />

      {scanResult && (
        <OperationalBanner type="info" message={`Scan complete: ${scanResult}`} dismissible />
      )}

      {data && data.unresolved_anomalies > 0 && (
        <OperationalBanner
          type="warning"
          message={`${data.unresolved_anomalies} unresolved visit anomal${data.unresolved_anomalies === 1 ? 'y' : 'ies'} detected`}
          detail="Including late arrivals, short visits, medication issues, and no-shows."
          action={{ label: 'Review →', href: '/admin/visits/anomalies' }}
        />
      )}

      {/* KPI bar */}
      {data && (
        <MetricGrid cols={8}>
          <MetricCard label="Live Now"       value={data.live.length}              colour={data.live.length > 0 ? 'emerald' : 'slate'} />
          <MetricCard label="Overdue"        value={data.overdue.length}           colour={data.overdue.length > 0 ? 'amber' : 'slate'} />
          <MetricCard label="Missed"         value={data.missed.length}            colour={data.missed.length > 0 ? 'red' : 'slate'} />
          <MetricCard label="Completed"      value={data.completed_today} />
          <MetricCard label="Med Alerts"     value={data.medication_alerts}        colour={data.medication_alerts > 0 ? 'red' : 'slate'} />
          <MetricCard label="Anomalies"      value={data.unresolved_anomalies}     colour={data.unresolved_anomalies > 0 ? 'amber' : 'slate'} />
          <MetricCard label="Task Rate"      value={`${data.task_completion_rate}%`} />
          <MetricCard label="Avg Lateness"   value={`${data.avg_lateness_minutes}m`} colour={data.avg_lateness_minutes > 15 ? 'amber' : 'slate'} />
        </MetricGrid>
      )}

      {loading && !data ? (
        <Skeleton rows={3} />
      ) : data ? (
        <>
          <VisitSection title="Live Visits"    visits={data.live}    tag="live"    emptyMsg="No visits currently in progress." />
          <VisitSection title="Overdue Visits" visits={data.overdue} tag="overdue" emptyMsg="No overdue visits. All visits started on time." />
          <VisitSection title="Missed Visits"  visits={data.missed}  tag="missed"  emptyMsg="No missed visits today." />
        </>
      ) : null}

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'All Shifts',  href: '/admin/shifts' },
          { label: 'Visit Notes', href: '/admin/visit-notes' },
          { label: 'Incidents',   href: '/admin/incidents' },
          { label: 'Operations',  href: '/admin/operations' },
        ].map(({ label, href }) => (
          <Link key={href} href={href} className="group block">
            <Card padding="sm" className="hover:border-indigo-200 hover:bg-indigo-50 transition-colors">
              <p className="text-sm font-medium text-slate-700 group-hover:text-indigo-700 transition-colors">{label} →</p>
            </Card>
          </Link>
        ))}
      </div>

      <p className="text-xs text-slate-400 text-right">
        Last refreshed {lastRefresh.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </p>
    </div>
  )
}
