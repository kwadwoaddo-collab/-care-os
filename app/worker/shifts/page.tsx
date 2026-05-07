'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface WorkerShift {
  id:                string
  title:             string
  shift_date:        string
  start_time:        string
  end_time:          string
  status:            string
  location:          string | null
  client_name:       string | null
  shift_type:        string | null
  visit_note_id:     string | null
  worker_ack_status: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

function formatTime(t: string) { return t.slice(0, 5) }

function today() { return new Date().toISOString().slice(0, 10) }

const SHIFT_STATUS_CLS: Record<string, string> = {
  scheduled: 'bg-blue-100   text-blue-700',
  confirmed: 'bg-green-100  text-green-700',
  completed: 'bg-gray-100   text-gray-600',
  cancelled: 'bg-red-100    text-red-700',
  no_show:   'bg-orange-100 text-orange-700',
}

const ACK_CLS: Record<string, string> = {
  accepted:     'bg-green-100 text-green-700',
  declined:     'bg-red-100   text-red-700',
  running_late: 'bg-yellow-100 text-yellow-700',
}

type FilterKey = 'all' | 'upcoming' | 'today' | 'completed' | 'not_acknowledged'

// ── Component ─────────────────────────────────────────────────────────────────

export default function WorkerShiftsPage() {
  const [shifts,  setShifts]  = useState<WorkerShift[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [filter,  setFilter]  = useState<FilterKey>('upcoming')

  useEffect(() => {
    const token = sessionStorage.getItem('worker_token')
    if (!token) {
      setError('Session expired. Please use your portal link again.')
      setLoading(false)
      return
    }

    fetch(`/api/worker/shifts?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json() as WorkerShift[] | { error: string }
        if (!res.ok) { setError((data as { error: string }).error ?? 'Failed to load shifts.'); return }
        setShifts(data as WorkerShift[])
      })
      .catch(() => setError('Network error — please try again.'))
      .finally(() => setLoading(false))
  }, [])

  const td = today()

  const filtered = shifts.filter((s) => {
    if (filter === 'today')           return s.shift_date === td
    if (filter === 'upcoming')        return s.shift_date >= td && s.status !== 'cancelled'
    if (filter === 'completed')       return s.status === 'completed'
    if (filter === 'not_acknowledged') return !s.worker_ack_status && s.shift_date >= td && s.status !== 'cancelled'
    return true
  })

  const counts = {
    all:              shifts.length,
    today:            shifts.filter((s) => s.shift_date === td).length,
    upcoming:         shifts.filter((s) => s.shift_date >= td && s.status !== 'cancelled').length,
    completed:        shifts.filter((s) => s.status === 'completed').length,
    not_acknowledged: shifts.filter((s) => !s.worker_ack_status && s.shift_date >= td && s.status !== 'cancelled').length,
  }

  const FILTERS: Array<{ key: FilterKey; label: string }> = [
    { key: 'upcoming',        label: `Upcoming (${counts.upcoming})`           },
    { key: 'today',           label: `Today (${counts.today})`                 },
    { key: 'not_acknowledged', label: `Not responded (${counts.not_acknowledged})` },
    { key: 'completed',       label: `Completed (${counts.completed})`          },
    { key: 'all',             label: `All (${counts.all})`                     },
  ]

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl" />)}
      </div>
    )
  }

  if (error) {
    return <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>
  }

  return (
    <div className="space-y-4 pb-4">
      <h1 className="text-xl font-bold text-gray-900">My Shifts</h1>

      {/* Filter chips — horizontally scrollable */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={[
              'flex-shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors',
              filter === f.key
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300',
            ].join(' ')}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Shifts list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 px-4 py-10 text-center text-sm text-gray-400">
          No shifts for this filter.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => {
            const statusCls = SHIFT_STATUS_CLS[s.status] ?? 'bg-gray-100 text-gray-600'
            const ackCls    = s.worker_ack_status ? ACK_CLS[s.worker_ack_status] : 'bg-gray-100 text-gray-400'
            const ackLabel  = s.worker_ack_status ? s.worker_ack_status.replace(/_/g, ' ') : 'Not responded'
            const isToday   = s.shift_date === td

            return (
              <Link
                key={s.id}
                href={`/worker/shifts/${s.id}`}
                className="block bg-white rounded-2xl border border-gray-200 p-4 hover:border-indigo-300 hover:bg-indigo-50/20 active:scale-[0.98] transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-semibold text-gray-900">{s.title}</p>
                      {isToday && (
                        <span className="inline-flex rounded-full bg-indigo-100 text-indigo-700 px-2 py-0.5 text-xs font-semibold">
                          Today
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {formatDate(s.shift_date)} · {formatTime(s.start_time)}–{formatTime(s.end_time)}
                    </p>
                    {s.client_name && (
                      <p className="text-xs text-gray-400 mt-0.5">Client: {s.client_name}</p>
                    )}
                    {s.location && (
                      <p className="text-xs text-gray-400 truncate">{s.location}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusCls}`}>
                      {s.status.replace(/_/g, ' ')}
                    </span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ackCls}`}>
                      {ackLabel}
                    </span>
                    {s.visit_note_id && (
                      <span className="inline-flex rounded-full bg-green-50 text-green-700 px-2 py-0.5 text-xs font-medium">
                        Note ✓
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-indigo-500 font-medium mt-2 text-right">View shift →</p>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
