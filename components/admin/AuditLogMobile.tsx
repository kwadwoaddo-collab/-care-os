'use client'

import React from 'react'

export interface AuditEntry {
  id:          string
  created_at:  string
  action:      string
  actor_id:    string | null
  entity_type: string | null
  entity_id:   string | null
  metadata:    Record<string, unknown> | null
}

interface AuditLogMobileProps {
  entries: AuditEntry[]
  loading: boolean
  hasMore: boolean
  onLoadMore: () => void
  activeFilter: string
  onFilterChange: (filter: string) => void
}

function formatTsMobile(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' · ' +
         d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

// Map technical action names to human-readable titles
function getEventTitle(entry: AuditEntry): string {
  const actor = entry.actor_id ?? 'System'
  const actionParts = entry.action.split('.')
  const actionType = actionParts[1] ?? 'updated'

  const entityStr = entry.entity_type ? entry.entity_type.replace('_', ' ') : 'record'

  // Attempt to build a nice title, e.g., "Sarah Jenkins added to RN Pool"
  // For now, construct a generic readable string:
  return `${actor} ${actionType.replace('_', ' ')} ${entityStr}`
}

function getIconColor(action: string): string {
  const domain = action.split('.')[0]
  switch (domain) {
    case 'staff': return 'bg-indigo-500'
    case 'shift': return 'bg-amber-500'
    case 'document': 
    case 'credentials': return 'bg-red-500'
    case 'incident': return 'bg-orange-500'
    case 'care_package': return 'bg-green-500'
    default: return 'bg-slate-400'
  }
}

function getBadgeCls(action: string): string {
  const domain = action.split('.')[0]
  switch (domain) {
    case 'staff': return 'bg-indigo-50 text-indigo-700 border-indigo-200'
    case 'shift': return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'document': 
    case 'credentials': return 'bg-red-50 text-red-700 border-red-200'
    case 'incident': return 'bg-orange-50 text-orange-700 border-orange-200'
    case 'care_package': return 'bg-green-50 text-green-700 border-green-200'
    default: return 'bg-slate-50 text-slate-600 border-slate-200'
  }
}

const FILTERS = [
  { id: 'all', label: 'All Events' },
  { id: 'today', label: 'Today' },
  { id: 'staff', label: 'Staff' },
  { id: 'shift', label: 'Shifts' },
  { id: 'document', label: 'Credentials' },
]

export default function AuditLogMobile({
  entries,
  loading,
  hasMore,
  onLoadMore,
  activeFilter,
  onFilterChange
}: AuditLogMobileProps) {
  return (
    <div className="flex flex-col h-full bg-background pb-8">
      
      {/* Global Controls: Filter Chips */}
      <div className="px-4 py-3 overflow-x-auto no-scrollbar border-b border-outline-variant/30 sticky top-0 bg-background z-10">
        <div className="flex gap-2 min-w-max">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => onFilterChange(f.id)}
              className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
                activeFilter === f.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-surface-container-lowest text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline Feed */}
      <div className="p-4 space-y-3 relative">
        {/* Continuous vertical line behind anchors */}
        <div className="absolute left-[27px] top-4 bottom-4 w-px bg-slate-200 z-0" />

        {entries.length === 0 && !loading && (
          <div className="text-center py-8 text-sm text-slate-500">
            No activity found for the selected filter.
          </div>
        )}

        {entries.map((entry) => {
          const title = getEventTitle(entry)
          const iconColor = getIconColor(entry.action)
          const badgeCls = getBadgeCls(entry.action)
          
          return (
            <div key={entry.id} className="relative z-10 flex gap-3 group">
              {/* Icon Anchor */}
              <div className="flex flex-col items-center pt-2">
                <div className={`w-3 h-3 rounded-full border-2 border-white shadow-sm shrink-0 ${iconColor}`} />
              </div>

              {/* Card */}
              <div className="flex-1 bg-surface-container-lowest rounded-lg border border-surface-container-highest p-4 shadow-sm">
                
                <div className="flex justify-between items-start gap-2 mb-2">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${badgeCls}`}>
                    {entry.action.replace('.', ' ')}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium shrink-0">
                    {formatTsMobile(entry.created_at)}
                  </span>
                </div>

                <p className="text-sm font-medium text-[#1e293b] leading-snug mb-1.5" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>
                  {title}
                </p>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px] text-slate-400">person</span>
                    <span className="text-xs text-slate-500 font-medium">{entry.actor_id ?? 'System'}</span>
                  </div>
                  {entry.entity_id && (
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px] text-slate-400">fingerprint</span>
                      <span className="text-xs text-slate-500 font-mono">{entry.entity_id.slice(0, 8)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      {(hasMore || loading) && (
        <div className="px-4 mt-2">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="w-full py-3 bg-surface-container-lowest border border-slate-200 text-slate-700 font-medium text-sm rounded-lg shadow-sm active:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Loading...' : 'Load Previous Activity'}
          </button>
        </div>
      )}

    </div>
  )
}
