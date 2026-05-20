'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface TimelineShift {
  id:                string
  title:             string
  shift_date:        string
  start_time:        string
  end_time:          string
  status:            string
  location:          string | null
  client_name:       string | null
  visit_note_id:     string | null
  worker_ack_status: string | null
  is_offer?:         boolean
}

function today() { return new Date().toISOString().slice(0, 10) }

function toMins(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function fmtTime(t: string) { return t.slice(0, 5) }

function formatDateHeading(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
}

const STATUS_DOT: Record<string, string> = {
  completed:   'bg-emerald-500',
  in_progress: 'bg-blue-500 animate-pulse',
  missed:      'bg-red-500',
  accepted:    'bg-indigo-400',
  open:        'bg-amber-400',
  offered:     'bg-purple-400',
}

const STATUS_BORDER: Record<string, string> = {
  completed:   'border-l-4 border-emerald-400',
  in_progress: 'border-l-4 border-blue-400',
  missed:      'border-l-4 border-red-400',
  accepted:    'border-l-4 border-indigo-300',
  open:        'border-l-4 border-amber-300',
}

type Period = 'today' | 'week' | 'month'

export default function WorkerTimelinePage() {
  const [shifts,  setShifts]  = useState<TimelineShift[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [period,  setPeriod]  = useState<Period>('week')

  useEffect(() => {
    const token = sessionStorage.getItem('worker_token')
    if (!token) { setError('Session expired.'); setLoading(false); return }
    fetch(`/api/worker/shifts?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(d => setShifts(Array.isArray(d) ? d : []))
      .catch(() => setError('Failed to load shifts.'))
      .finally(() => setLoading(false))
  }, [])

  const td = today()

  const now = new Date()
  const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)

  const filtered = shifts
    .filter(s => !s.is_offer && s.status !== 'cancelled')
    .filter(s => {
      if (period === 'today') return s.shift_date === td
      if (period === 'week')  return s.shift_date >= mon.toISOString().slice(0, 10) && s.shift_date <= sun.toISOString().slice(0, 10)
      return s.shift_date >= monthStart && s.shift_date <= monthEnd
    })
    .sort((a, b) => a.shift_date.localeCompare(b.shift_date) || a.start_time.localeCompare(b.start_time))

  const byDate: Record<string, TimelineShift[]> = {}
  for (const s of filtered) {
    if (!byDate[s.shift_date]) byDate[s.shift_date] = []
    byDate[s.shift_date].push(s)
  }
  const dates = Object.keys(byDate).sort()

  if (loading) return (
    <div className="space-y-3 animate-pulse">
      {[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}
    </div>
  )

  if (error) return (
    <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>
  )

  return (
    <div className="space-y-5 pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Timeline</h1>
        <Link href="/worker/shifts" className="text-xs text-indigo-600 font-medium">List view</Link>
      </div>

      {/* Period filter */}
      <div className="flex gap-2">
        {(['today', 'week', 'month'] as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={[
              'flex-1 py-2.5 rounded-xl text-xs font-semibold capitalize transition-colors',
              period === p ? 'bg-indigo-600 text-white' : 'bg-surface-container-lowest border border-gray-200 text-gray-600',
            ].join(' ')}
          >
            {p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'Today'}
          </button>
        ))}
      </div>

      {dates.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-400">
          No shifts for this period.
        </div>
      ) : dates.map(date => {
        const dayShifts = byDate[date]
        const isToday   = date === td
        const isPast    = date < td

        return (
          <div key={date}>
            {/* Day header */}
            <div className={`flex items-center gap-2 mb-3 ${isToday ? 'text-indigo-700' : isPast ? 'text-gray-400' : 'text-gray-700'}`}>
              <span className={`text-xs font-bold uppercase tracking-wide`}>
                {isToday ? 'Today — ' : ''}{formatDateHeading(date)}
              </span>
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">{dayShifts.length} visit{dayShifts.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Timeline spine */}
            <div className="relative pl-8">
              <div className="absolute left-3 top-2 bottom-2 w-px bg-gray-200" />

              <div className="space-y-2">
                {dayShifts.map((s, idx) => {
                  const prevEnd  = idx > 0 ? dayShifts[idx - 1].end_time : null
                  const gapMins  = prevEnd ? toMins(s.start_time) - toMins(prevEnd) : 0
                  const durMins  = toMins(s.end_time) - toMins(s.start_time)
                  const dot      = STATUS_DOT[s.status]   ?? 'bg-gray-300'
                  const border   = STATUS_BORDER[s.status] ?? ''

                  return (
                    <div key={s.id}>
                      {/* Travel gap indicator */}
                      {gapMins > 0 && (
                        <div className="flex items-center gap-2 py-1 pl-0 text-xs text-gray-400">
                          <div className="w-2 h-2 rounded-full bg-gray-300 -ml-4 shrink-0" />
                          <span>{gapMins} min travel gap</span>
                        </div>
                      )}

                      {/* Shift card */}
                      <div className="relative">
                        <div className={`absolute -left-4 top-4 w-3 h-3 rounded-full ${dot} ring-2 ring-white shrink-0`} />

                        <Link
                          href={`/worker/visits/${s.id}`}
                          className={`block bg-surface-container-lowest rounded-xl border border-gray-200 p-3.5 active:scale-[0.98] transition-all ${border}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">{s.title}</p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {fmtTime(s.start_time)}–{fmtTime(s.end_time)}
                                <span className="text-gray-400"> · {durMins}min</span>
                              </p>
                              {s.client_name && <p className="text-xs text-gray-400 mt-0.5">{s.client_name}</p>}
                              {s.location    && <p className="text-xs text-gray-400 truncate mt-0.5">{s.location}</p>}
                            </div>

                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className={[
                                'text-xs font-medium px-2 py-0.5 rounded-full capitalize',
                                s.status === 'completed'   ? 'bg-emerald-100 text-emerald-700' :
                                s.status === 'missed'      ? 'bg-red-100 text-red-700' :
                                s.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-600',
                              ].join(' ')}>
                                {s.status.replace(/_/g, ' ')}
                              </span>

                              {s.status === 'missed' && (
                                <span className="text-[10px] font-bold text-red-500">Overdue</span>
                              )}
                              {!s.worker_ack_status && s.shift_date >= td && (
                                <span className="text-[10px] font-medium text-amber-600">Unconfirmed</span>
                              )}
                              {s.visit_note_id && (
                                <span className="text-[10px] font-medium text-emerald-600">Note ✓</span>
                              )}
                            </div>
                          </div>
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
