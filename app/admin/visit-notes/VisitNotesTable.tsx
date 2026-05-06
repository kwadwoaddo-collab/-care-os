'use client'

import { useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VisitNoteSummary {
  id:                string
  status:            string
  incident_reported: boolean
  submitted_at:      string | null
  created_at:        string
  shifts: {
    id:         string
    title:      string
    shift_date: string
    start_time: string
    end_time:   string
  } | null
  clients: {
    id:         string
    first_name: string
    last_name:  string
  } | null
  staff_profiles: {
    id:         string
    first_name: string | null
    last_name:  string | null
  } | null
}

type FilterKey = 'all' | 'draft' | 'submitted' | 'incidents'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function formatTime(t: string) { return t.slice(0, 5) }

const STATUS_CLS: Record<string, string> = {
  draft:     'bg-gray-50   text-gray-600   ring-gray-400/20',
  submitted: 'bg-green-50  text-green-700  ring-green-600/20',
  locked:    'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
}

function Badge({ value, map }: { value: string; map: Record<string, string> }) {
  const cls = map[value] ?? 'bg-gray-50 text-gray-600 ring-gray-500/20'
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {value}
    </span>
  )
}

function staffName(n: VisitNoteSummary['staff_profiles']): string {
  if (!n) return '—'
  return [n.first_name, n.last_name].filter(Boolean).join(' ') || '—'
}

function clientName(c: VisitNoteSummary['clients']): string {
  if (!c) return '—'
  return `${c.first_name} ${c.last_name}`
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function VisitNotesTable({ notes }: { notes: VisitNoteSummary[] }) {
  const [filter, setFilter] = useState<FilterKey>('all')

  const counts = {
    all:       notes.length,
    draft:     notes.filter((n) => n.status === 'draft').length,
    submitted: notes.filter((n) => n.status === 'submitted' || n.status === 'locked').length,
    incidents: notes.filter((n) => n.incident_reported).length,
  }

  const filtered = notes.filter((n) => {
    if (filter === 'draft')     return n.status === 'draft'
    if (filter === 'submitted') return n.status === 'submitted' || n.status === 'locked'
    if (filter === 'incidents') return n.incident_reported
    return true
  })

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: 'all',       label: `All (${counts.all})` },
    { key: 'draft',     label: `Draft (${counts.draft})` },
    { key: 'submitted', label: `Submitted (${counts.submitted})` },
    { key: 'incidents', label: `Incidents (${counts.incidents})` },
  ]

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
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-sm text-gray-400">
          No visit notes match this filter.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shift time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Incident</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((note) => (
                  <tr key={note.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {note.shifts ? formatDate(note.shifts.shift_date) : formatDate(note.created_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {note.clients ? (
                        <a
                          href={`/admin/clients/${note.clients.id}`}
                          className="text-indigo-700 hover:underline"
                        >
                          {clientName(note.clients)}
                        </a>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {staffName(note.staff_profiles)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap tabular-nums">
                      {note.shifts
                        ? `${formatTime(note.shifts.start_time)} – ${formatTime(note.shifts.end_time)}`
                        : '—'
                      }
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge value={note.status} map={STATUS_CLS} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {note.incident_reported ? (
                        <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset bg-red-50 text-red-700 ring-red-600/20">
                          Yes
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {note.submitted_at ? formatDate(note.submitted_at) : '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <a
                        href={`/admin/visit-notes/${note.id}`}
                        className="text-xs text-indigo-600 hover:underline font-medium"
                      >
                        View →
                      </a>
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
