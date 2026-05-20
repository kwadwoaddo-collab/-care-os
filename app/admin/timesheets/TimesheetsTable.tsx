'use client'

import { useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Timesheet {
  id:               string
  status:           string
  scheduled_start:  string | null
  scheduled_end:    string | null
  clock_in:         string | null
  clock_out:        string | null
  break_minutes:    number
  worked_minutes:   number | null
  lateness_minutes: number
  notes:            string | null
  staff_profiles: {
    id:         string
    first_name: string | null
    last_name:  string | null
    email:      string | null
  } | null
  shifts: {
    id:         string
    title:      string
    shift_date: string
    start_time: string
    end_time:   string
  } | null
}

type FilterKey = 'all' | 'pending' | 'completed' | 'missed'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function workedHours(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

const STATUS_CLS: Record<string, string> = {
  pending:    'bg-gray-50   text-on-surface-variant   ring-gray-400/20',
  clocked_in: 'bg-blue-50   text-blue-700   ring-blue-600/20',
  completed:  'bg-green-50  text-green-700  ring-green-600/20',
  missed:     'bg-red-50    text-red-700    ring-red-600/20',
  adjusted:   'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
}

function Badge({ value }: { value: string }) {
  const cls = STATUS_CLS[value] ?? 'bg-gray-50 text-gray-600 ring-gray-500/20'
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {value.replace(/_/g, ' ')}
    </span>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TimesheetsTable({ timesheets }: { timesheets: Timesheet[] }) {
  const [filter, setFilter] = useState<FilterKey>('all')

  const filtered = timesheets.filter((t) => {
    if (filter === 'pending')   return t.status === 'pending'
    if (filter === 'completed') return t.status === 'completed' || t.status === 'adjusted'
    if (filter === 'missed')    return t.status === 'missed'
    return true
  })

  const counts = {
    all:       timesheets.length,
    pending:   timesheets.filter((t) => t.status === 'pending').length,
    completed: timesheets.filter((t) => t.status === 'completed' || t.status === 'adjusted').length,
    missed:    timesheets.filter((t) => t.status === 'missed').length,
  }

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: 'all',       label: `All (${counts.all})` },
    { key: 'pending',   label: `Pending (${counts.pending})` },
    { key: 'completed', label: `Completed (${counts.completed})` },
    { key: 'missed',    label: `Missed (${counts.missed})` },
  ]

  const staffName = (t: Timesheet) => {
    if (!t.staff_profiles) return '—'
    return (
      [t.staff_profiles.first_name, t.staff_profiles.last_name].filter(Boolean).join(' ') ||
      t.staff_profiles.email ||
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
                : 'bg-surface-container-lowest text-gray-600 ring-gray-300 hover:bg-gray-50',
            ].join(' ')}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] p-8 text-center text-sm text-gray-400">
          No timesheets match this filter.
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Staff</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Shift</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Scheduled</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Clock in</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Clock out</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Worked</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Lateness</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {t.staff_profiles ? (
                        <a
                          href={`/admin/staff/${t.staff_profiles.id}`}
                          className="text-sm font-medium text-indigo-700 hover:underline"
                        >
                          {staffName(t)}
                        </a>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                      {t.shifts?.title ?? '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600 tabular-nums text-xs">
                      {formatDateTime(t.scheduled_start)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600 tabular-nums text-xs">
                      {formatDateTime(t.clock_in)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600 tabular-nums text-xs">
                      {formatDateTime(t.clock_out)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums text-gray-700">
                      {workedHours(t.worked_minutes)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums text-xs">
                      {t.lateness_minutes > 0 ? (
                        <span className="text-orange-600 font-medium">+{t.lateness_minutes}m</span>
                      ) : (
                        <span className="text-green-600">On time</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge value={t.status} />
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
