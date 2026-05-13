'use client'

import { useEffect, useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface NotificationLog {
  id:              string
  company_id:      string
  event_type:      string
  recipient_email: string | null
  subject:         string | null
  status:          'sent' | 'failed' | 'skipped'
  error_message:   string | null
  entity_type:     string | null
  entity_id:       string | null
  created_at:      string
}

type StatusFilter = 'all' | 'sent' | 'failed' | 'skipped'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) +
    ' ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  )
}

const STATUS_CLS: Record<string, string> = {
  sent:    'bg-green-50  text-green-700  ring-green-600/20',
  failed:  'bg-red-50    text-red-700    ring-red-600/20',
  skipped: 'bg-gray-50   text-gray-500   ring-gray-400/20',
}

const EVENT_CLS: Record<string, string> = {
  'shift.assigned':    'bg-indigo-50 text-indigo-700',
  'shift.declined':    'bg-red-50    text-red-700',
  'shift.running_late': 'bg-yellow-50 text-yellow-700',
  'incident.escalated': 'bg-orange-50 text-orange-700',
  'compliance.expiring': 'bg-amber-50 text-amber-700',
  'daily.digest':      'bg-blue-50   text-blue-700',
  'shift.reminder':    'bg-purple-50 text-purple-700',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [logs,       setLogs]       = useState<NotificationLog[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [typeFilter,   setTypeFilter]   = useState('')

  useEffect(() => {
    setLoading(true)
    setError(null)
    // Fetch directly from Supabase via the admin API proxy approach isn't set up,
    // so we fetch via a simple admin endpoint route that we'll call here.
    fetch('/api/admin/notifications/logs')
      .then(async (res) => {
        const data = await res.json() as NotificationLog[] | { error: string }
        if (!res.ok) { setError((data as { error: string }).error ?? 'Failed to load'); return }
        setLogs(data as NotificationLog[])
      })
      .catch(() => setError('Network error — please try again.'))
      .finally(() => setLoading(false))
  }, [])

  const eventTypes = [...new Set(logs.map((l) => l.event_type))].sort()

  const filtered = logs.filter((l) => {
    if (statusFilter !== 'all' && l.status !== statusFilter) return false
    if (typeFilter && l.event_type !== typeFilter) return false
    return true
  })

  const counts = {
    all:     logs.length,
    sent:    logs.filter((l) => l.status === 'sent').length,
    failed:  logs.filter((l) => l.status === 'failed').length,
    skipped: logs.filter((l) => l.status === 'skipped').length,
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Notification Log</h1>
          <p className="text-sm text-gray-500 mt-0.5">Recent email send attempts from Care OS.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              fetch('/api/admin/notifications/daily-digest', { method: 'POST' })
                .then((r) => r.json())
                .then((d) => alert(`Digest: ${JSON.stringify(d, null, 2)}`))
                .catch(console.error)
            }}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Send Daily Digest
          </button>
          <button
            onClick={() => {
              fetch('/api/admin/notifications/send-shift-reminders', { method: 'POST' })
                .then((r) => r.json())
                .then((d) => alert(`Reminders: ${JSON.stringify(d, null, 2)}`))
                .catch(console.error)
            }}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Send Reminders
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([ ['all', 'Total'], ['sent', 'Sent'], ['failed', 'Failed'], ['skipped', 'Skipped'] ] as [StatusFilter, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatusFilter(key)}
            className={[
              'rounded-lg border px-4 py-3 text-left transition-shadow hover:shadow-sm',
              statusFilter === key ? 'ring-2 ring-indigo-500 border-indigo-200 bg-indigo-50' : 'bg-white border-gray-200',
              key === 'failed' && counts.failed > 0 ? 'border-red-200 bg-red-50' : '',
            ].join(' ')}
          >
            <p className="text-xs font-medium text-gray-500">{label}</p>
            <p className={`text-2xl font-bold tabular-nums mt-0.5 ${key === 'failed' && counts.failed > 0 ? 'text-red-700' : 'text-gray-900'}`}>
              {counts[key]}
            </p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-700 focus:border-gray-600 focus:outline-none"
        >
          <option value="">All event types</option>
          {eventTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        {(statusFilter !== 'all' || typeFilter) && (
          <button
            onClick={() => { setStatusFilter('all'); setTypeFilter('') }}
            className="text-xs text-indigo-600 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}
        </div>
      ) : error ? (
        <div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-10 text-center text-sm text-gray-400">
          No notifications found for this filter.
        </div>
      ) : (
        <div className="space-y-3">

          {/* ── Mobile card list (lg:hidden) ──────────────────────── */}
          <div className="lg:hidden space-y-2">
            {filtered.map((log) => (
              <div
                key={log.id}
                className={`bg-white rounded-xl border overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${
                  log.status === 'failed' ? 'border-red-200' : 'border-gray-100'
                }`}
              >
                <div className={`flex items-center justify-between px-4 py-2.5 border-b ${
                  log.status === 'failed' ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'
                }`}>
                  <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                    EVENT_CLS[log.event_type] ?? 'bg-gray-50 text-gray-600'
                  }`}>
                    {log.event_type}
                  </span>
                  <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_CLS[log.status]}`}>
                    {log.status}
                  </span>
                </div>
                <div className="px-4 py-3">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {log.subject ?? 'No subject'}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span className="truncate">{log.recipient_email ?? '—'}</span>
                    <span className="ml-auto whitespace-nowrap">{formatDateTime(log.created_at)}</span>
                  </div>
                  {log.error_message && (
                    <p className="text-xs text-red-600 mt-1 truncate">{log.error_message}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* ── Desktop table (hidden on mobile) ──────────────────────── */}
          <div className="hidden lg:block bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recipient</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entity</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((log) => (
                    <tr key={log.id} className={log.status === 'failed' ? 'bg-red-50/30' : 'hover:bg-gray-50'}>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-500 text-xs tabular-nums">{formatDateTime(log.created_at)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${EVENT_CLS[log.event_type] ?? 'bg-gray-50 text-gray-600'}`}>
                          {log.event_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs max-w-[180px] truncate">{log.recipient_email ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-700 text-xs max-w-[240px] truncate" title={log.subject ?? ''}>{log.subject ?? '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_CLS[log.status]}`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{log.entity_type ?? '—'}</td>
                      <td className="px-4 py-3 text-red-600 text-xs max-w-[200px] truncate" title={log.error_message ?? ''}>{log.error_message ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2.5 border-t border-gray-100 text-xs text-gray-400">
              {filtered.length} of {logs.length} log entries
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
