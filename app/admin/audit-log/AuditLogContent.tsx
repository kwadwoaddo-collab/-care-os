'use client'

import { useState, useEffect, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuditEntry {
  id:          string
  created_at:  string
  action:      string
  actor_id:    string | null
  entity_type: string | null
  entity_id:   string | null
  metadata:    Record<string, unknown> | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTs(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', {
    day:    '2-digit',
    month:  'short',
    year:   'numeric',
  }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function formatTsMobile(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' ' +
    d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
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

const ACTION_CLS: Record<string, string> = {
  'staff':          'bg-indigo-50 text-indigo-700',
  'shift':          'bg-blue-50   text-blue-700',
  'care_package':   'bg-green-50  text-green-700',
  'applicant':      'bg-yellow-50 text-yellow-700',
  'document':       'bg-purple-50 text-purple-700',
  'visit_note':     'bg-pink-50   text-pink-700',
  'timesheet':      'bg-orange-50 text-orange-700',
}

function actionBadgeCls(action: string): string {
  const prefix = action.split('.')[0] ?? ''
  return ACTION_CLS[prefix] ?? 'bg-gray-50 text-gray-600'
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AuditLogContent() {
  const [entries,   setEntries]   = useState<AuditEntry[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [action,    setAction]    = useState('')
  const [entityId,  setEntityId]  = useState('')
  const [inputAction,   setInputAction]   = useState('')
  const [inputEntityId, setInputEntityId] = useState('')

  const fetchLogs = useCallback(async (filterAction: string, filterEntityId: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filterAction)   params.set('action',    filterAction)
      if (filterEntityId) params.set('entity_id', filterEntityId)
      const res = await fetch(`/api/admin/audit-log?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch')
      setEntries(await res.json() as AuditEntry[])
    } catch {
      setError('Failed to load audit log')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchLogs('', '')
  }, [fetchLogs])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setAction(inputAction.trim())
    setEntityId(inputEntityId.trim())
    void fetchLogs(inputAction.trim(), inputEntityId.trim())
  }

  function handleClear() {
    setInputAction('')
    setInputEntityId('')
    setAction('')
    setEntityId('')
    void fetchLogs('', '')
  }

  const hasFilter = action || entityId

  return (
    <div className="space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-primary">Audit Log</h1>
        <p className="text-sm text-on-surface-variant mt-0.5">
          Last 200 events{hasFilter && ' (filtered)'}
        </p>
      </div>

      {/* Filters */}
      <form onSubmit={handleSearch} className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Event type</label>
          <input
            type="text"
            value={inputAction}
            onChange={(e) => setInputAction(e.target.value)}
            placeholder="e.g. staff.status_updated"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary w-56 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Entity ID</label>
          <input
            type="text"
            value={inputEntityId}
            onChange={(e) => setInputEntityId(e.target.value)}
            placeholder="UUID"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary w-64 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
        >
          Search
        </button>
        {hasFilter && (
          <button
            type="button"
            onClick={handleClear}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            Clear
          </button>
        )}
      </form>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && <p className="text-sm text-gray-400">Loading…</p>}

      {/* Results */}
      {!loading && !error && (
        entries.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] p-8 text-center text-sm text-gray-400">
            No audit events found{hasFilter ? ' matching these filters' : ''}.
          </div>
        ) : (
          <div className="space-y-3">

            {/* ── Mobile timeline stream (lg:hidden) ───────────────────────── */}
            <div className="lg:hidden space-y-1">
              {entries.map((e, i) => (
                <div
                  key={e.id}
                  className="flex items-start gap-3 bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                >
                  {/* Timeline dot */}
                  <div className="flex flex-col items-center flex-shrink-0 pt-1">
                    <span className="w-2 h-2 rounded-full bg-indigo-300 flex-shrink-0" />
                    {i < entries.length - 1 && (
                      <span className="w-px bg-gray-100 mt-1" style={{ minHeight: 16 }} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-snug ${actionBadgeCls(e.action)}`}>
                        {e.action}
                      </span>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">
                        {formatTsMobile(e.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                      {e.entity_type && (
                        <span className="font-medium text-on-surface-variant">{e.entity_type}</span>
                      )}
                      {e.entity_id && (
                        <span className="font-mono truncate max-w-[120px]">
                          {e.entity_id.slice(0, 8)}…
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Desktop table (hidden on mobile) ───────────────────────────── */}
            <div className="hidden lg:block bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider whitespace-nowrap">Timestamp</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Event</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Entity</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Entity ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Actor</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {entries.map((e) => (
                      <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap tabular-nums text-xs">
                          {formatTs(e.created_at)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${actionBadgeCls(e.action)}`}>
                            {e.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                          {e.entity_type ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs font-mono max-w-[140px] truncate">
                          {e.entity_id ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-on-surface-variant text-xs whitespace-nowrap">
                          {e.actor_id ?? 'system'}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs max-w-[280px] truncate">
                          {metaSummary(e.metadata)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )
      )}
    </div>
  )
}
