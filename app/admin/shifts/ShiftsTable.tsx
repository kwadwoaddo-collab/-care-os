'use client'

import { useState }    from 'react'
import { useRouter }   from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Shift {
  id:                string
  title:             string
  shift_date:        string
  start_time:        string
  end_time:          string
  location:          string | null
  client_name:       string | null
  client_id:         string | null
  shift_type:        string | null
  status:            string
  notes:             string | null
  assigned_staff_id:  string | null
  timesheet_status:   string | null
  worker_ack_status:  string | null
  staff_profiles:    {
    id:         string
    first_name: string | null
    last_name:  string | null
    email:      string | null
  } | null
  clients: {
    id:         string
    first_name: string
    last_name:  string
  } | null
  care_package_id: string | null
  care_packages: {
    id:    string
    title: string
  } | null
}

type FilterKey = 'all' | 'today' | 'upcoming' | 'completed' | 'cancelled'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function formatTime(t: string): string {
  return t.slice(0, 5)
}

function isToday(dateStr: string): boolean {
  const today = new Date().toISOString().slice(0, 10)
  return dateStr === today
}

function isUpcoming(dateStr: string): boolean {
  const today = new Date().toISOString().slice(0, 10)
  return dateStr > today
}

const STATUS_CLS: Record<string, string> = {
  scheduled: 'bg-blue-50   text-blue-700   ring-blue-600/20',
  confirmed: 'bg-green-50  text-green-700  ring-green-600/20',
  completed: 'bg-gray-50   text-gray-600   ring-gray-500/20',
  cancelled: 'bg-red-50    text-red-700    ring-red-600/20',
  no_show:   'bg-orange-50 text-orange-700 ring-orange-600/20',
}

const TIMESHEET_STATUS_CLS: Record<string, string> = {
  pending:    'bg-gray-50   text-on-surface-variant   ring-gray-400/20',
  clocked_in: 'bg-blue-50   text-blue-700   ring-blue-600/20',
  completed:  'bg-green-50  text-green-700  ring-green-600/20',
  missed:     'bg-red-50    text-red-700    ring-red-600/20',
  adjusted:   'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
}

const TYPE_CLS: Record<string, string> = {
  day:       'bg-sky-50    text-sky-700    ring-sky-600/20',
  night:     'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  sleep_in:  'bg-purple-50 text-purple-700 ring-purple-600/20',
  live_in:   'bg-pink-50   text-pink-700   ring-pink-600/20',
  emergency: 'bg-red-50    text-red-700    ring-red-600/20',
}

const ACK_CLS: Record<string, string> = {
  accepted:     'bg-green-50  text-green-700  ring-green-600/20',
  declined:     'bg-red-50    text-red-700    ring-red-600/20',
  running_late: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
}

function Badge({ value, map }: { value: string; map: Record<string, string> }) {
  const cls = map[value] ?? 'bg-gray-50 text-gray-600 ring-gray-500/20'
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {value.replace(/_/g, ' ')}
    </span>
  )
}

// ── Unassign button ───────────────────────────────────────────────────────────

function UnassignButton({ shiftId, staffName }: { shiftId: string; staffName: string }) {
  const router  = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleUnassign() {
    if (!window.confirm(`Remove ${staffName} from this shift?`)) return
    setBusy(true)
    try {
      await fetch(`/api/admin/shifts/${shiftId}/unassign`, { method: 'PATCH' })
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={handleUnassign}
      disabled={busy}
      className="text-xs text-red-600 hover:underline disabled:opacity-40 whitespace-nowrap"
    >
      {busy ? '…' : 'Unassign'}
    </button>
  )
}

// ── Visit Note button ─────────────────────────────────────────────────────────

function VisitNoteButton({ shiftId }: { shiftId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    const res = await fetch('/api/admin/visit-notes', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ shift_id: shiftId }),
    })
    const data = await res.json() as { id?: string; note_id?: string }
    const noteId = res.status === 201 ? data.id : data.note_id
    if (noteId) {
      router.push(`/admin/visit-notes/${noteId}`)
    } else {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="text-xs text-indigo-600 hover:underline disabled:opacity-40"
    >
      {loading ? '…' : 'Visit Note'}
    </button>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ShiftsTable({ shifts }: { shifts: Shift[] }) {
  const [filter, setFilter] = useState<FilterKey>('all')

  const today = new Date().toISOString().slice(0, 10)

  const filtered = shifts.filter((s) => {
    if (filter === 'today')     return isToday(s.shift_date)
    if (filter === 'upcoming')  return isUpcoming(s.shift_date)
    if (filter === 'completed') return s.status === 'completed'
    if (filter === 'cancelled') return s.status === 'cancelled'
    return true
  })

  const counts = {
    all:       shifts.length,
    today:     shifts.filter((s) => isToday(s.shift_date)).length,
    upcoming:  shifts.filter((s) => isUpcoming(s.shift_date)).length,
    completed: shifts.filter((s) => s.status === 'completed').length,
    cancelled: shifts.filter((s) => s.status === 'cancelled').length,
  }

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: 'all',       label: `All (${counts.all})` },
    { key: 'today',     label: `Today (${counts.today})` },
    { key: 'upcoming',  label: `Upcoming (${counts.upcoming})` },
    { key: 'completed', label: `Completed (${counts.completed})` },
    { key: 'cancelled', label: `Cancelled (${counts.cancelled})` },
  ]

  const staffName = (s: Shift) => {
    if (!s.staff_profiles) return '—'
    return (
      [s.staff_profiles.first_name, s.staff_profiles.last_name].filter(Boolean).join(' ') ||
      s.staff_profiles.email ||
      '—'
    )
  }

  return (
    <div className="space-y-3">

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={[
              'rounded-md px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors cursor-pointer',
              filter === f.key
                ? 'bg-gray-900 text-white ring-gray-900'
                : 'bg-white text-gray-600 ring-gray-300 hover:bg-gray-50',
            ].join(' ')}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] p-8 text-center text-sm text-gray-400">
          No shifts match this filter.
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Staff</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Worker Ack</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Note</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((shift) => (
                  <tr
                    key={shift.id}
                    className={[
                      'hover:bg-gray-50 transition-colors',
                      isToday(shift.shift_date) ? 'bg-blue-50/40' : '',
                    ].join(' ')}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      {shift.staff_profiles ? (
                        <a
                          href={`/admin/staff/${shift.assigned_staff_id}`}
                          className="text-sm font-medium text-indigo-700 hover:underline"
                        >
                          {staffName(shift)}
                        </a>
                      ) : (
                        <span className="text-sm text-gray-400">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-primary">{shift.title}</span>
                      {shift.care_packages && (
                        <span className="ml-1.5 text-xs text-indigo-500">
                          {shift.care_packages.title}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {formatDate(shift.shift_date)}
                      {isToday(shift.shift_date) && (
                        <span className="ml-1.5 text-xs text-blue-600 font-medium">Today</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap tabular-nums">
                      {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {shift.clients ? (
                        <a
                          href={`/admin/clients/${shift.clients.id}`}
                          className="text-indigo-700 hover:underline"
                        >
                          {shift.clients.first_name} {shift.clients.last_name}
                        </a>
                      ) : (
                        <span className="text-gray-400">{shift.client_name ?? '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate">
                      {shift.location ?? '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {shift.shift_type
                        ? <Badge value={shift.shift_type} map={TYPE_CLS} />
                        : <span className="text-gray-400">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Badge value={shift.status} map={STATUS_CLS} />
                        {shift.timesheet_status && (
                          <Badge value={shift.timesheet_status} map={TIMESHEET_STATUS_CLS} />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {shift.worker_ack_status ? (
                        <Badge value={shift.worker_ack_status} map={ACK_CLS} />
                      ) : shift.assigned_staff_id &&
                          shift.status !== 'completed' &&
                          shift.status !== 'cancelled' ? (
                        <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset bg-gray-50 text-on-surface-variant ring-gray-300">
                          not responded
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <VisitNoteButton shiftId={shift.id} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {shift.assigned_staff_id &&
                        shift.status !== 'completed' &&
                        shift.status !== 'cancelled' && (
                        <UnassignButton
                          shiftId={shift.id}
                          staffName={staffName(shift)}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
