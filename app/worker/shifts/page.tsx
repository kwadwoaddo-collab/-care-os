'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface WorkerShift {
  id:            string
  title:         string
  shift_date:    string
  start_time:    string
  end_time:      string
  status:        string
  location:      string | null
  client_name:   string | null
  shift_type:    string | null
  visit_note_id: string | null
}

const SHIFT_STATUS_CLS: Record<string, string> = {
  scheduled: 'bg-blue-50   text-blue-700   ring-blue-600/20',
  confirmed: 'bg-green-50  text-green-700  ring-green-600/20',
  completed: 'bg-gray-50   text-gray-600   ring-gray-500/20',
  cancelled: 'bg-red-50    text-red-700    ring-red-600/20',
  no_show:   'bg-orange-50 text-orange-700 ring-orange-600/20',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function WorkerShiftsPage() {
  const [shifts, setShifts] = useState<WorkerShift[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

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
        if (!res.ok) {
          setError((data as { error: string }).error ?? 'Failed to load shifts.')
          return
        }
        setShifts(data as WorkerShift[])
      })
      .catch(() => setError('Network error — please try again.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-sm text-gray-500">Loading shifts…</p>

  if (error) {
    return <div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">My Shifts</h1>

      {shifts.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-sm text-gray-400">
          No shifts assigned yet.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shifts.map((s) => {
                const cls = SHIFT_STATUS_CLS[s.status] ?? 'bg-gray-50 text-gray-600 ring-gray-500/20'
                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">{formatDate(s.shift_date)}</td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums text-gray-700">
                      {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                    </td>
                    <td className="px-4 py-3 text-gray-900 font-medium">{s.title}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{s.client_name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-[140px] truncate">{s.location ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{s.shift_type?.replace(/_/g, ' ') ?? '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
                        {s.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {s.visit_note_id ? (
                        <Link
                          href={`/admin/visit-notes/${s.visit_note_id}`}
                          className="text-xs text-indigo-600 hover:underline"
                        >
                          View →
                        </Link>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
