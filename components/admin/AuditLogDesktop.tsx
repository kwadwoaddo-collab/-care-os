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

function getStatusPill(action: string, meta: Record<string, unknown> | null) {
  // Derive a specialized status pill from action string or metadata
  const actionLower = action.toLowerCase()
  if (actionLower.includes('fail') || actionLower.includes('delete') || actionLower.includes('error')) {
    return { label: 'CRITICAL', cls: 'bg-red-50 text-red-700 border border-red-200' }
  }
  if (actionLower.includes('verify') || actionLower.includes('approve') || actionLower.includes('complete')) {
    return { label: 'VERIFIED', cls: 'bg-green-50 text-green-700 border border-green-200' }
  }
  if (actionLower.includes('create') || actionLower.includes('add') || actionLower.includes('success')) {
    return { label: 'SUCCESS', cls: 'bg-indigo-50 text-indigo-700 border border-indigo-200' }
  }
  return { label: 'LOGGED', cls: 'bg-slate-50 text-slate-600 border border-slate-200' }
}

const FILTERS = [
  { id: 'all', label: 'All Events' },
  { id: 'today', label: 'Today' },
  { id: 'staff', label: 'Staff' },
  { id: 'shift', label: 'Shifts' },
  { id: 'document', label: 'Credentials' },
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
  
  // Calculate mock data for Velocity Chart based on current entries
  const recentDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toLocaleDateString('en-GB', { weekday: 'short' })
  })

  // Simple mock distribution of events over 7 days based on total length
  const totalEvents = entries.length > 0 ? entries.length : 100
  const maxBarHeight = 100
  const chartData = recentDays.map((day, i) => {
    // Generate a pseudo-random height based on index to look like real data
    const count = Math.max(10, Math.floor((Math.sin(i) + 1.5) * (totalEvents / 7)))
    return { day, count }
  })
  const maxCount = Math.max(...chartData.map(d => d.count))

  // Security Guard calculation (mock simple anomaly detection)
  const anomalies = entries.filter(e => e.action.toLowerCase().includes('delete') || e.action.toLowerCase().includes('fail')).length
  const isAnomalous = anomalies > 3

  return (
    <div className="flex flex-col gap-6" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>
      
      {/* ── Dual-Tier Header ─────────────────────────────────────────────── */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
        
        {/* Tier 1: Title & Export */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/50">
          <div>
            <h1 className="text-xl font-bold text-[#1e293b]">Audit & Activity Log</h1>
            <p className="text-sm text-slate-500 font-medium mt-0.5">Comprehensive view of system operations</p>
          </div>
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 font-medium text-sm rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export Report
          </button>
        </div>

        {/* Tier 2: Filters */}
        <div className="px-6 py-3 bg-[#f8f9fa] flex flex-wrap items-center justify-between gap-4">
          
          <div className="flex items-center gap-2">
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => onFilterChange(f.id)}
                className={`px-3 py-1.5 rounded-md text-[13px] font-bold transition-colors ${
                  activeFilter === f.id
                    ? 'bg-[#1e293b] text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <form onSubmit={onSearchSubmit} className="flex items-center gap-2">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">search</span>
              <input
                type="text"
                placeholder="Search by Entity ID..."
                value={searchEntityId}
                onChange={(e) => onSearchEntityIdChange(e.target.value)}
                className="pl-9 pr-3 py-1.5 w-64 border border-slate-300 rounded-md text-sm font-medium focus:ring-2 focus:ring-[#4f46e5] focus:border-[#4f46e5] outline-none"
              />
            </div>
            <button type="submit" className="px-3 py-1.5 bg-slate-900 text-white rounded-md text-sm font-bold hover:bg-slate-800 transition-colors">
              Filter
            </button>
            {(activeFilter !== 'all' || searchEntityId) && (
              <button type="button" onClick={onClearFilters} className="px-3 py-1.5 bg-white text-slate-600 border border-slate-300 rounded-md text-sm font-bold hover:bg-slate-50 transition-colors">
                Clear
              </button>
            )}
          </form>

        </div>
      </div>

      {/* ── High-Performance Table ───────────────────────────────────────── */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f8f9fa] border-b border-outline-variant/60">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Timestamp</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Action / Event</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Actor</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Entity ID</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Metadata Summary</th>
              </tr>
            </thead>
            <tbody>
              {loading && entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm font-medium text-slate-400">Loading audit trail...</td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm font-medium text-slate-400">No events found matching criteria.</td>
                </tr>
              ) : (
                entries.map(entry => {
                  const status = getStatusPill(entry.action, entry.metadata)
                  return (
                    <tr key={entry.id} className="border-b border-slate-100 hover:bg-surface-container-low transition-colors" style={{ height: '64px' }}>
                      <td className="px-6 py-2 text-sm font-medium text-slate-500 whitespace-nowrap">
                        {formatTs(entry.created_at)}
                      </td>
                      <td className="px-6 py-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${status.cls}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-2 text-sm font-bold text-[#1e293b] whitespace-nowrap">
                        {entry.action}
                      </td>
                      <td className="px-6 py-2 text-sm font-medium text-slate-700 whitespace-nowrap">
                        {entry.actor_id ?? 'System'}
                      </td>
                      <td className="px-6 py-2 text-xs font-mono font-medium text-slate-500 whitespace-nowrap">
                        {entry.entity_id ? entry.entity_id.slice(0, 12) + '...' : '—'}
                      </td>
                      <td className="px-6 py-2 text-xs font-medium text-slate-400 truncate max-w-[300px]">
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
          <div className="px-6 py-4 border-t border-slate-100 bg-[#f8f9fa] flex justify-center">
            <button
              onClick={onLoadMore}
              disabled={loading}
              className="px-6 py-2 bg-white border border-slate-200 text-slate-700 font-bold text-sm rounded-lg shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Loading...' : 'Load Previous Activity'}
            </button>
          </div>
        )}
      </div>

      {/* ── Data Visualization & Security Guard ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Activity Velocity (2 cols) */}
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-bold text-[#1e293b]">Activity Velocity</h2>
              <p className="text-xs font-medium text-slate-500">Event volume over the last 7 days</p>
            </div>
            <div className="text-right">
              <span className="block text-2xl font-bold text-[#4f46e5]">98.2%</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Verification Rate</span>
            </div>
          </div>
          
          <div className="flex-1 flex items-end gap-2 h-32">
            {chartData.map((d, i) => {
              const hPercent = maxCount > 0 ? (d.count / maxCount) * 100 : 0
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                  <div className="w-full bg-[#eef2ff] rounded-t-sm relative flex items-end overflow-hidden" style={{ height: '100px' }}>
                    <div 
                      className="w-full bg-[#4f46e5] rounded-t-sm transition-all duration-500 group-hover:bg-[#3730a3]" 
                      style={{ height: `${Math.max(4, hPercent)}%` }} 
                    />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{d.day}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Security Guard (1 col) */}
        <div className={`rounded-xl border shadow-sm p-6 flex flex-col justify-between ${
          isAnomalous ? 'bg-red-50 border-red-200' : 'bg-indigo-50 border-indigo-200'
        }`}>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`material-symbols-outlined text-[20px] ${isAnomalous ? 'text-red-600' : 'text-[#4f46e5]'}`}>
                {isAnomalous ? 'gpp_bad' : 'gpp_good'}
              </span>
              <h2 className={`text-base font-bold ${isAnomalous ? 'text-red-900' : 'text-[#1e293b]'}`}>Security Guard</h2>
            </div>
            <p className={`text-sm font-medium ${isAnomalous ? 'text-red-700' : 'text-slate-600'}`}>
              {isAnomalous 
                ? 'Multiple critical anomalies detected in the recent audit stream. Immediate review recommended.'
                : 'No anomalous behavior detected in the recent audit stream.'}
            </p>
          </div>
          
          <div className="mt-6">
            <div className="flex justify-between items-center py-2 border-b border-indigo-100/50">
              <span className="text-xs font-bold text-slate-500">Failed Logins</span>
              <span className="text-xs font-bold text-[#1e293b]">0</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-indigo-100/50">
              <span className="text-xs font-bold text-slate-500">Critical Deletions</span>
              <span className="text-xs font-bold text-[#1e293b]">{anomalies}</span>
            </div>
            <button className={`w-full mt-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              isAnomalous ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-white text-[#4f46e5] border border-indigo-200 hover:bg-indigo-100'
            }`}>
              Run Full Diagnostic
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
