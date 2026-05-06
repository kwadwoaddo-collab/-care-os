'use client'

import { useState }          from 'react'
import AssignShiftModal, {
  type AssignableShift,
}                            from '../AssignShiftModal'

// ── Types ─────────────────────────────────────────────────────────────────────

export type Urgency = 'critical' | 'high' | 'medium' | 'normal'

export interface OpenShiftRow {
  id:                 string
  title:              string
  shift_date:         string
  start_time:         string
  end_time:           string
  shift_type:         string | null
  location:           string | null
  client_name:        string | null
  client_id:          string | null
  care_package_title: string | null
  urgency:            Urgency
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function formatTime(t: string) { return t.slice(0, 5) }

const URGENCY_CLS: Record<Urgency, string> = {
  critical: 'bg-red-50    text-red-700    ring-red-600/20',
  high:     'bg-orange-50 text-orange-700 ring-orange-600/20',
  medium:   'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  normal:   'bg-gray-50   text-gray-500   ring-gray-400/20',
}

const URGENCY_LABEL: Record<Urgency, string> = {
  critical: 'Critical',
  high:     'Urgent',
  medium:   'Soon',
  normal:   'Normal',
}

const TYPE_CLS: Record<string, string> = {
  day:       'bg-sky-50    text-sky-700    ring-sky-600/20',
  night:     'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  sleep_in:  'bg-purple-50 text-purple-700 ring-purple-600/20',
  live_in:   'bg-pink-50   text-pink-700   ring-pink-600/20',
  emergency: 'bg-red-50    text-red-700    ring-red-600/20',
}

function Badge({ value, map }: { value: string; map: Record<string, string> }) {
  const cls = map[value] ?? 'bg-gray-50 text-gray-600 ring-gray-500/20'
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {value.replace(/_/g, ' ')}
    </span>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OpenShiftsTable({ shifts }: { shifts: OpenShiftRow[] }) {
  const [selected, setSelected] = useState<AssignableShift | null>(null)

  if (shifts.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-sm text-gray-400">
        No open shifts — all shifts are assigned.
      </div>
    )
  }

  return (
    <>
      {selected && (
        <AssignShiftModal
          shift={selected}
          onClose={() => setSelected(null)}
          onAssigned={() => setSelected(null)}
        />
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Package</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Urgency</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shifts.map((shift) => (
                <tr key={shift.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {shift.client_id ? (
                      <a
                        href={`/admin/clients/${shift.client_id}`}
                        className="text-indigo-700 hover:underline font-medium"
                      >
                        {shift.client_name ?? '—'}
                      </a>
                    ) : (
                      <span className="text-gray-500">{shift.client_name ?? '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {shift.care_package_title ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {formatDate(shift.shift_date)}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap tabular-nums">
                    {formatTime(shift.start_time)} – {formatTime(shift.end_time)}
                    {shift.end_time <= shift.start_time && (
                      <span className="ml-1.5 text-xs text-indigo-500">overnight</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 max-w-[160px] truncate">
                    {shift.location ?? '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {shift.shift_type
                      ? <Badge value={shift.shift_type} map={TYPE_CLS} />
                      : <span className="text-gray-400">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge value={URGENCY_LABEL[shift.urgency]} map={URGENCY_CLS} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button
                      onClick={() =>
                        setSelected({
                          id:          shift.id,
                          title:       shift.title,
                          shift_date:  shift.shift_date,
                          start_time:  shift.start_time,
                          end_time:    shift.end_time,
                          client_name: shift.client_name,
                          shift_type:  shift.shift_type,
                        })
                      }
                      className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                    >
                      Assign
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
