'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import type { VisitsDashboard, LiveVisit } from '@/app/api/admin/visits/route'

function fmtTime(t: string) { return t.slice(0, 5) }
function fmtISO(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

const STATUS_CLS: Record<string, string> = {
  accepted:    'bg-green-100 text-green-700',
  in_progress: 'bg-emerald-100 text-emerald-800',
  completed:   'bg-slate-100 text-slate-600',
  missed:      'bg-red-100 text-red-700',
  open:        'bg-blue-100 text-blue-700',
}

function VisitRow({ v, tag }: { v: LiveVisit; tag: 'live' | 'overdue' | 'missed' }) {
  const tagCls = tag === 'live' ? 'bg-emerald-500' : tag === 'overdue' ? 'bg-amber-500' : 'bg-red-500'
  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${tagCls}`} />
          <div>
            <p className="text-sm font-medium text-slate-800 truncate max-w-[180px]">{v.title}</p>
            {v.client_name && <p className="text-xs text-slate-400">{v.client_name}</p>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-slate-600 hidden md:table-cell">
        {fmtTime(v.start_time)}–{fmtTime(v.end_time)}
      </td>
      <td className="px-4 py-3 text-sm text-slate-600 hidden lg:table-cell">
        {v.worker_name}
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_CLS[v.status] ?? 'bg-slate-100 text-slate-500'}`}>
          {v.status.replace(/_/g, ' ')}
        </span>
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
          <span className={`font-medium ${v.lateness_minutes >= 30 ? 'text-red-600' : 'text-amber-600'}`}>
            +{v.lateness_minutes}m late
          </span>
        )}
        {v.escalation_raised && (
          <span className="ml-1 text-red-600 font-semibold">⚠ Escalation</span>
        )}
      </td>
      <td className="px-4 py-3">
        <Link href={`/admin/visit-notes`} className="text-indigo-600 hover:text-indigo-800 text-xs font-medium">
          Notes →
        </Link>
      </td>
    </tr>
  )
}

function Section({ title, visits, tag, emptyMsg }: { title: string; visits: LiveVisit[]; tag: 'live' | 'overdue' | 'missed'; emptyMsg: string }) {
  if (visits.length === 0) return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-slate-700 mb-2">{title} <span className="text-slate-400 font-normal">(0)</span></h2>
      <p className="text-sm text-slate-400">{emptyMsg}</p>
    </div>
  )
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        <span className="text-xs font-bold text-slate-500">{visits.length}</span>
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
    </div>
  )
}

export default function VisitsDashboardPage() {
  const [data,      setData]      = useState<VisitsDashboard | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [scanning,  setScanning]  = useState(false)
  const [scanResult, setScanResult] = useState<string | null>(null)
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
    const interval = setInterval(load, 60_000) // auto-refresh every 60s
    return () => clearInterval(interval)
  }, [load])

  async function runAnomalyScan() {
    setScanning(true)
    setScanResult(null)
    try {
      const res = await fetch('/api/admin/visits/anomalies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      const d = await res.json()
      setScanResult(`Late arrivals: ${d.late_arrival} | Short visits: ${d.short_visit} | Medication: ${d.medication} | No-shows: ${d.no_show}`)
      load()
    } catch {
      setScanResult('Scan failed — check console')
    } finally { setScanning(false) }
  }

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Visit Operations</h1>
          <p className="text-sm text-slate-500 mt-1">{dateStr} · Auto-refreshes every 60s</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="px-3 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 disabled:opacity-60"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <button
            onClick={runAnomalyScan}
            disabled={scanning}
            className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-60 flex items-center gap-2"
          >
            {scanning && <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />}
            Detect Anomalies
          </button>
        </div>
      </div>

      {scanResult && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 font-medium">
          Scan complete: {scanResult}
        </div>
      )}

      {/* KPI bar */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            { label: 'Live Now',       value: data.live.length,             colour: data.live.length > 0 ? 'text-emerald-600' : 'text-slate-900' },
            { label: 'Overdue',        value: data.overdue.length,           colour: data.overdue.length > 0 ? 'text-amber-600' : 'text-slate-900' },
            { label: 'Missed',         value: data.missed.length,            colour: data.missed.length > 0 ? 'text-red-600' : 'text-slate-900' },
            { label: 'Completed',      value: data.completed_today },
            { label: 'Med Alerts',     value: data.medication_alerts,        colour: data.medication_alerts > 0 ? 'text-red-600' : 'text-slate-900' },
            { label: 'Anomalies',      value: data.unresolved_anomalies,     colour: data.unresolved_anomalies > 0 ? 'text-amber-600' : 'text-slate-900' },
            { label: 'Task Rate',      value: `${data.task_completion_rate}%` },
            { label: 'Avg Lateness',   value: `${data.avg_lateness_minutes}m`, colour: data.avg_lateness_minutes > 15 ? 'text-amber-600' : 'text-slate-900' },
          ].map(({ label, value, colour }) => (
            <div key={label} className="bg-white border border-slate-200 rounded-xl p-4">
              <p className={`text-xl font-bold ${colour ?? 'text-slate-900'}`}>{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Anomaly alert banner */}
      {data && data.unresolved_anomalies > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-amber-800">{data.unresolved_anomalies} unresolved visit anomal{data.unresolved_anomalies === 1 ? 'y' : 'ies'} detected</p>
            <p className="text-xs text-amber-700 mt-0.5">Including late arrivals, short visits, medication issues, and no-shows.</p>
          </div>
          <Link href="/admin/visits/anomalies" className="px-3 py-2 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 shrink-0">
            Review →
          </Link>
        </div>
      )}

      {loading && !data ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : data ? (
        <>
          <Section title="Live Visits" visits={data.live} tag="live" emptyMsg="No visits currently in progress." />
          <Section title="Overdue Visits" visits={data.overdue} tag="overdue" emptyMsg="No overdue visits. All visits started on time." />
          <Section title="Missed Visits" visits={data.missed} tag="missed" emptyMsg="No missed visits today." />
        </>
      ) : null}

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'All Shifts',    href: '/admin/shifts' },
          { label: 'Visit Notes',   href: '/admin/visit-notes' },
          { label: 'Incidents',     href: '/admin/incidents' },
          { label: 'Operations',    href: '/admin/operations' },
        ].map(({ label, href }) => (
          <Link key={href} href={href} className="bg-white border border-slate-200 rounded-xl p-4 text-sm font-medium text-slate-700 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-colors">
            {label} →
          </Link>
        ))}
      </div>

      <p className="text-xs text-slate-400 text-right">
        Last refreshed {lastRefresh.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </p>
    </div>
  )
}
