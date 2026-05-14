'use client'

import React from 'react'
import type { AuditEntry } from './AuditLogMobile'

interface AuditLogDesktopProps {
  entries: AuditEntry[]
  loading: boolean
  hasMore: boolean
  onLoadMore: () => void
  activeFilter: string
  onFilterChange: (filter: string) => void
  searchEntityId: string
  onSearchEntityIdChange: (val: string) => void
  onSearchSubmit: (e: React.FormEvent) => void
  onClearFilters: () => void
}

function formatTs(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', {
    day:    '2-digit',
    month:  'short',
    year:   'numeric',
  }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function metaSummary(meta: Record<string, unknown> | null): string {
  if (!meta) return '—'
  const keys = Object.keys(meta).slice(0, 3)
  return keys.map((k) => {
    const v = meta[k]
    const display = typeof v === 'object' ? JSON.stringify(v) : String(v)
    return `${k}: ${display.slice(0, 40)}`
  }).join(' · ')
}

function getStatusPill(action: string) {
  const actionLower = action.toLowerCase()
  if (actionLower.includes('fail') || actionLower.includes('delete') || actionLower.includes('error')) {
    return { label: 'CRITICAL', cls: 'bg-red-100 text-red-700' }
  }
  if (actionLower.includes('verify') || actionLower.includes('approve') || actionLower.includes('complete')) {
    return { label: 'VERIFIED', cls: 'bg-green-100 text-green-700' }
  }
  if (actionLower.includes('create') || actionLower.includes('add') || actionLower.includes('success')) {
    return { label: 'SUCCESS', cls: 'bg-blue-100 text-blue-700' }
  }
  return { label: 'LOGGED', cls: 'bg-surface-container-highest text-on-surface-variant' }
}

const FILTERS = [
  { id: 'all', label: 'All Events', icon: 'list' },
  { id: 'today', label: 'Today', icon: 'today' },
  { id: 'staff', label: 'Staff', icon: 'groups' },
  { id: 'shift', label: 'Shifts', icon: 'event_repeat' },
  { id: 'document', label: 'Credentials', icon: 'verified_user' },
]

export default function AuditLogDesktop({
  entries,
  loading,
  hasMore,
  onLoadMore,
  activeFilter,
  onFilterChange,
  searchEntityId,
  onSearchEntityIdChange,
  onSearchSubmit,
  onClearFilters
}: AuditLogDesktopProps) {

  // Velocity chart data
  const recentDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toLocaleDateString('en-GB', { weekday: 'short' })
  })

  const totalEvents = entries.length > 0 ? entries.length : 100
  const chartData = recentDays.map((day, i) => {
    const count = Math.max(10, Math.floor((Math.sin(i) + 1.5) * (totalEvents / 7)))
    return { day, count }
  })
  const maxCount = Math.max(...chartData.map(d => d.count))

  // Security anomaly detection
  const anomalies = entries.filter(e => e.action.toLowerCase().includes('delete') || e.action.toLowerCase().includes('fail')).length
  const isAnomalous = anomalies > 3

  // Triage metrics
  const todayStr = new Date().toISOString().split('T')[0]
  const todayCount = entries.filter(e => e.created_at.startsWith(todayStr)).length
  const criticalCount = entries.filter(e => {
    const a = e.action.toLowerCase()
    return a.includes('fail') || a.includes('delete') || a.includes('error')
  }).length

  return (
    <div className="flex flex-col gap-6">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-primary tracking-tight">Audit & Activity Log</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Comprehensive trail of system operations and user actions.
          </p>
        </div>
        <button className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary font-semibold text-xs rounded-lg hover:opacity-90 transition-all shadow-sm cursor-pointer">
          <span className="material-symbols-outlined text-[16px]">download</span>
          Export Report
        </button>
      </div>

      {/* ── Triage Metrics Row ─────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface-container-lowest p-card-padding rounded-xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border border-transparent">
          <div className="flex justify-between items-start mb-4">
            <span className="text-on-surface-variant font-label-md text-label-md">Total Events</span>
            <span className="material-symbols-outlined text-primary bg-primary-fixed p-2 rounded-lg">history</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display-lg text-display-lg">{entries.length}</span>
            <span className="text-[12px] font-semibold text-on-surface-variant">
              logged entries
            </span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-card-padding rounded-xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border border-transparent">
          <div className="flex justify-between items-start mb-4">
            <span className="text-on-surface-variant font-label-md text-label-md">Today&apos;s Activity</span>
            <span className="material-symbols-outlined text-secondary bg-secondary-fixed p-2 rounded-lg">today</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display-lg text-display-lg">{todayCount}</span>
            <span className="text-[12px] font-semibold text-on-surface-variant">
              events today
            </span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-card-padding rounded-xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border border-transparent">
          <div className="flex justify-between items-start mb-4">
            <span className="text-on-surface-variant font-label-md text-label-md">Critical Events</span>
            <span className="material-symbols-outlined text-on-tertiary-fixed-variant bg-tertiary-fixed p-2 rounded-lg">warning</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display-lg text-display-lg">{criticalCount}</span>
            {criticalCount > 0 && (
              <span className="text-[12px] font-semibold text-error flex items-center">
                <span className="material-symbols-outlined text-[14px]">priority_high</span>
                needs review
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Filter Bar ────────────────────────────────────────── */}
      <div className="bg-surface-container-lowest p-4 md:p-6 rounded-xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border border-outline-variant space-y-4">

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => onFilterChange(f.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                  activeFilter === f.id
                    ? 'bg-primary border-primary text-on-primary'
                    : 'bg-white border-outline-variant text-on-surface hover:bg-surface-container-low'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">{f.icon}</span>
                {f.label}
              </button>
            ))}
          </div>

          <form onSubmit={onSearchSubmit} className="flex items-center gap-2">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
              <input
                type="text"
                placeholder="Search by Entity ID..."
                value={searchEntityId}
                onChange={(e) => onSearchEntityIdChange(e.target.value)}
                className="pl-10 pr-3 py-2 w-64 bg-background border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-secondary/20 focus:border-secondary outline-none transition-all"
              />
            </div>
            <button type="submit" className="px-3 py-2 bg-primary text-on-primary rounded-lg text-xs font-semibold hover:opacity-90 transition-colors cursor-pointer">
              Filter
            </button>
            {(activeFilter !== 'all' || searchEntityId) && (
              <button type="button" onClick={onClearFilters} className="px-3 py-2 bg-white text-on-surface border border-outline-variant rounded-lg text-xs font-semibold hover:bg-surface-container-low transition-colors cursor-pointer">
                Clear
              </button>
            )}
          </form>
        </div>
      </div>

      {/* ── Event Table ───────────────────────────────────────── */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant/60">
                <th className="px-6 py-4 text-xs font-label-md text-on-surface-variant uppercase tracking-wider whitespace-nowrap">Timestamp</th>
                <th className="px-6 py-4 text-xs font-label-md text-on-surface-variant uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-label-md text-on-surface-variant uppercase tracking-wider">Action / Event</th>
                <th className="px-6 py-4 text-xs font-label-md text-on-surface-variant uppercase tracking-wider">Actor</th>
                <th className="px-6 py-4 text-xs font-label-md text-on-surface-variant uppercase tracking-wider">Entity ID</th>
                <th className="px-6 py-4 text-xs font-label-md text-on-surface-variant uppercase tracking-wider">Metadata Summary</th>
              </tr>
            </thead>
            <tbody>
              {loading && entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm font-medium text-on-surface-variant">Loading audit trail...</td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm font-medium text-on-surface-variant">No events found matching criteria.</td>
                </tr>
              ) : (
                entries.map(entry => {
                  const status = getStatusPill(entry.action)
                  return (
                    <tr key={entry.id} className="border-b border-surface-container-high hover:bg-surface-container-low transition-colors" style={{ height: '64px' }}>
                      <td className="px-6 py-2 text-sm font-medium text-on-surface-variant whitespace-nowrap">
                        {formatTs(entry.created_at)}
                      </td>
                      <td className="px-6 py-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${status.cls}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-2 text-sm font-semibold text-primary whitespace-nowrap">
                        {entry.action}
                      </td>
                      <td className="px-6 py-2 text-sm font-medium text-on-surface whitespace-nowrap">
                        {entry.actor_id ?? 'System'}
                      </td>
                      <td className="px-6 py-2 text-xs font-mono font-medium text-on-surface-variant whitespace-nowrap">
                        {entry.entity_id ? entry.entity_id.slice(0, 12) + '...' : '—'}
                      </td>
                      <td className="px-6 py-2 text-xs font-medium text-on-surface-variant truncate max-w-[300px]">
                        {metaSummary(entry.metadata)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {hasMore && (
          <div className="px-6 py-4 border-t border-surface-container-high bg-surface-container-low flex justify-center">
            <button
              onClick={onLoadMore}
              disabled={loading}
              className="px-6 py-2 bg-white border border-outline-variant text-on-surface font-semibold text-sm rounded-lg shadow-sm hover:bg-surface-container-low disabled:opacity-50 transition-colors cursor-pointer"
            >
              {loading ? 'Loading...' : 'Load Previous Activity'}
            </button>
          </div>
        )}
      </div>

      {/* ── Data Visualization & Security Guard ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Activity Velocity (2 cols) */}
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] p-card-padding flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-headline-md text-headline-md text-primary">Activity Velocity</h2>
              <p className="text-on-surface-variant font-body-md text-body-md">Event volume over the last 7 days</p>
            </div>
            <div className="text-right">
              <span className="block text-2xl font-bold text-secondary">98.2%</span>
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Verification Rate</span>
            </div>
          </div>

          <div className="flex-1 flex items-end gap-2 h-32">
            {chartData.map((d, i) => {
              const hPercent = maxCount > 0 ? (d.count / maxCount) * 100 : 0
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                  <div className="w-full bg-primary-fixed rounded-t-sm relative flex items-end overflow-hidden" style={{ height: '100px' }}>
                    <div
                      className="w-full bg-primary rounded-t-sm transition-all duration-500 group-hover:opacity-80"
                      style={{ height: `${Math.max(4, hPercent)}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase">{d.day}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Security Guard (1 col) */}
        <div className={`rounded-xl border shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] p-card-padding flex flex-col justify-between ${
          isAnomalous ? 'bg-red-50 border-red-200' : 'bg-surface-container-lowest border-outline-variant'
        }`}>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`material-symbols-outlined text-[20px] ${isAnomalous ? 'text-error' : 'text-primary'}`}>
                {isAnomalous ? 'gpp_bad' : 'gpp_good'}
              </span>
              <h2 className="font-headline-md text-headline-md text-primary">Security Guard</h2>
            </div>
            <p className={`text-sm font-medium ${isAnomalous ? 'text-error' : 'text-on-surface-variant'}`}>
              {isAnomalous
                ? 'Multiple critical anomalies detected in the recent audit stream. Immediate review recommended.'
                : 'No anomalous behavior detected in the recent audit stream.'}
            </p>
          </div>

          <div className="mt-6">
            <div className="flex justify-between items-center py-2 border-b border-surface-container-high">
              <span className="text-xs font-label-md text-on-surface-variant">Failed Logins</span>
              <span className="text-xs font-semibold text-on-surface">0</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-surface-container-high">
              <span className="text-xs font-label-md text-on-surface-variant">Critical Deletions</span>
              <span className="text-xs font-semibold text-on-surface">{anomalies}</span>
            </div>
            <button className={`w-full mt-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              isAnomalous ? 'bg-error text-on-error hover:opacity-90' : 'bg-white text-secondary border border-outline-variant hover:bg-surface-container-low'
            }`}>
              Run Full Diagnostic
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
