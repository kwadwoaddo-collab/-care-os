'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { OperationsShift, OperationsResponse } from '@/app/api/admin/shifts/operations/route'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short',
  })
}

function formatTime(t: string): string { return t.slice(0, 5) }

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().slice(0, 10)
}

function staffName(s: OperationsShift): string {
  if (!s.staff_profiles) return 'Unassigned'
  return [s.staff_profiles.first_name, s.staff_profiles.last_name].filter(Boolean).join(' ') || s.staff_profiles.email || '—'
}

const STATUS_CLS: Record<string, string> = {
  open:        'bg-blue-50   text-blue-700   ring-blue-600/20',
  offered:     'bg-purple-50 text-purple-700 ring-purple-600/20',
  accepted:    'bg-green-50  text-green-700  ring-green-600/20',
  in_progress: 'bg-green-100 text-green-800  ring-green-600/30',
  completed:   'bg-gray-50   text-gray-600   ring-gray-500/20',
  declined:    'bg-red-50    text-red-700    ring-red-600/20',
  cancelled:   'bg-red-50    text-red-700    ring-red-600/20',
  missed:      'bg-orange-50 text-orange-700 ring-orange-600/20',
}

const ACK_CLS: Record<string, string> = {
  accepted:     'bg-green-50  text-green-700  ring-green-600/20',
  declined:     'bg-red-50    text-red-700    ring-red-600/20',
  running_late: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
}

function Badge({ value, cls }: { value: string; cls: string }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {value.replace(/_/g, ' ')}
    </span>
  )
}

function AckBadge({ status }: { status: string | null }) {
  if (!status) {
    return (
      <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset bg-gray-50 text-on-surface-variant ring-gray-300">
        Not responded
      </span>
    )
  }
  const cls = ACK_CLS[status] ?? 'bg-gray-50 text-on-surface-variant ring-gray-300'
  return <Badge value={status} cls={cls} />
}

// ── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({
  label, count, sub, urgent, active, onClick,
}: {
  label:   string
  count:   number
  sub:     string
  urgent?: boolean
  active:  boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-lg border px-4 py-3 text-left w-full transition-shadow hover:shadow-sm',
        active
          ? 'ring-2 ring-indigo-500 border-indigo-200 bg-indigo-50'
          : urgent && count > 0
            ? 'bg-red-50 border-red-200'
            : 'bg-surface-container-lowest border-gray-200',
      ].join(' ')}
    >
      <p className="text-xs font-medium text-on-surface-variant">{label}</p>
      <p className={`text-2xl font-bold tabular-nums mt-0.5 ${urgent && count > 0 ? 'text-red-700' : 'text-primary'}`}>
        {count}
      </p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </button>
  )
}

// ── Unassign action ───────────────────────────────────────────────────────────

function UnassignButton({ shiftId, name, onDone }: { shiftId: string; name: string; onDone: () => void }) {
  const [busy,    setBusy]    = useState(false)
  const [confirm, setConfirm] = useState(false)

  if (confirm) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <button
          onClick={async () => {
            setBusy(true)
            await fetch(`/api/admin/shifts/${shiftId}/unassign`, { method: 'PATCH' })
            setConfirm(false)
            setBusy(false)
            onDone()
          }}
          disabled={busy}
          className="text-xs text-red-600 font-medium hover:underline disabled:opacity-40"
        >
          {busy ? '…' : 'Confirm'}
        </button>
        <button onClick={() => setConfirm(false)} className="text-xs text-gray-400 hover:text-gray-600">
          Cancel
        </button>
      </span>
    )
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      className="text-xs text-red-500 hover:text-red-700 hover:underline"
      title={`Unassign ${name}`}
    >
      Unassign
    </button>
  )
}

// ── Filter types ─────────────────────────────────────────────────────────────

type FilterKey = 'today' | 'upcoming' | 'unacknowledged' | 'declined' | 'running_late' | 'unassigned'

const FILTER_LABELS: Record<FilterKey, string> = {
  today:          'Today',
  upcoming:       'Next 14 days',
  unacknowledged: 'No response',
  declined:       'Declined',
  running_late:   'Running late',
  unassigned:     'Unassigned',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ShiftOperationsPage() {
  const router  = useRouter()
  const [filter,  setFilter]  = useState<FilterKey>('today')
  const [data,    setData]    = useState<OperationsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback((f: FilterKey) => {
    setLoading(true)
    setError(null)
    fetch(`/api/admin/shifts/operations?filter=${f}`)
      .then(async (res) => {
        const json = await res.json() as OperationsResponse | { error: string }
        if (!res.ok) { setError((json as { error: string }).error ?? 'Failed to load'); return }
        setData(json as OperationsResponse)
      })
      .catch(() => setError('Network error — please try again.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load('today') }, [load])

  function changeFilter(f: FilterKey) {
    setFilter(f)
    load(f)
  }

  const summary = data?.summary
  const shifts  = data?.shifts ?? []

  // Summary card click maps to a filter
  const CARD_FILTERS: { label: string; count: number; sub: string; filter: FilterKey; urgent?: boolean }[] = summary
    ? [
        { label: 'Today\'s shifts',    count: summary.total_today,      sub: 'Total scheduled today',        filter: 'today' },
        { label: 'Unassigned today',   count: summary.unassigned_today, sub: 'Need staff urgently',          filter: 'unassigned', urgent: true },
        { label: 'Declined',           count: summary.declined,         sub: 'Workers declined shift',       filter: 'declined',   urgent: true },
        { label: 'Running late',       count: summary.running_late,     sub: 'Workers reported running late',filter: 'running_late', urgent: true },
        { label: 'No response',        count: summary.unacknowledged,   sub: 'Assigned, awaiting response',  filter: 'unacknowledged', urgent: true },
      ]
    : []

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-primary">Shift Operations</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Monitor worker responses and rota issues across upcoming shifts.
          </p>
        </div>
        <Link
          href="/admin/shifts"
          className="text-sm text-indigo-600 hover:underline"
        >
          All shifts →
        </Link>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {CARD_FILTERS.map((c) => (
            <SummaryCard
              key={c.filter}
              label={c.label}
              count={c.count}
              sub={c.sub}
              urgent={c.urgent}
              active={filter === c.filter}
              onClick={() => changeFilter(c.filter)}
            />
          ))}
        </div>
      )}

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(FILTER_LABELS) as FilterKey[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => changeFilter(f)}
            className={[
              'rounded-md px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors',
              filter === f
                ? 'bg-gray-900 text-white ring-gray-900'
                : 'bg-surface-container-lowest text-gray-600 ring-gray-300 hover:bg-gray-50',
            ].join(' ')}
          >
            {FILTER_LABELS[f]}
            {summary && f === 'declined'       && summary.declined       > 0 && (
              <span className="ml-1.5 rounded-full bg-red-500 text-white text-[10px] px-1.5 py-0.5">{summary.declined}</span>
            )}
            {summary && f === 'running_late'   && summary.running_late   > 0 && (
              <span className="ml-1.5 rounded-full bg-yellow-500 text-white text-[10px] px-1.5 py-0.5">{summary.running_late}</span>
            )}
            {summary && f === 'unacknowledged' && summary.unacknowledged > 0 && (
              <span className="ml-1.5 rounded-full bg-gray-500 text-white text-[10px] px-1.5 py-0.5">{summary.unacknowledged}</span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : shifts.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] p-10 text-center text-sm text-gray-400">
          {filter === 'declined'       && 'No declined shifts in the next 14 days. 👍'}
          {filter === 'running_late'   && 'No workers have reported running late.'}
          {filter === 'unacknowledged' && 'All assigned workers have responded to their shifts.'}
          {filter === 'unassigned'     && 'No unassigned shifts in the next 14 days.'}
          {(filter === 'today' || filter === 'upcoming') && 'No shifts found for this period.'}
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Staff</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Response</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Shift status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Reason</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shifts.map((shift) => {
                  const isDeclined    = shift.status === 'declined'
                  const isLate        = shift.worker_ack_status === 'running_late'
                  const noAck         = !shift.worker_ack_status && shift.assigned_staff_id
                  const rowCls        = isDeclined ? 'bg-red-50/50' : isLate ? 'bg-yellow-50/50' : ''

                  return (
                    <tr key={shift.id} className={`hover:bg-gray-50 transition-colors ${rowCls}`}>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                        {formatDate(shift.shift_date)}
                        {isToday(shift.shift_date) && (
                          <span className="ml-1.5 text-xs text-blue-600 font-medium">Today</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600 tabular-nums">
                        {formatTime(shift.start_time)}–{formatTime(shift.end_time)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {shift.clients ? (
                          <Link
                            href={`/admin/clients/${shift.clients.id}`}
                            className="text-indigo-700 hover:underline"
                          >
                            {shift.clients.first_name} {shift.clients.last_name}
                          </Link>
                        ) : (
                          <span className="text-gray-400">{shift.client_name ?? '—'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {shift.staff_profiles ? (
                          <Link
                            href={`/admin/staff/${shift.staff_profiles.id}`}
                            className="text-indigo-700 hover:underline font-medium"
                          >
                            {staffName(shift)}
                          </Link>
                        ) : (
                          <span className="text-amber-600 text-xs font-medium">⚠ Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <AckBadge status={shift.worker_ack_status} />
                        {noAck && (
                          <span className="ml-1 text-xs text-gray-400">
                            {/* nudge indicator */}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge
                          value={shift.status}
                          cls={STATUS_CLS[shift.status] ?? 'bg-gray-50 text-gray-600 ring-gray-500/20'}
                        />
                        {shift.visit_notes?.[0] && (shift.visit_notes[0].status === 'submitted' || shift.visit_notes[0].status === 'locked') && (
                          <div className="mt-1.5">
                            <Link href={`/admin/visit-notes/${shift.visit_notes[0].id}`} className="inline-flex items-center rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-600/20 hover:bg-indigo-100 transition-colors">
                              📝 Note submitted
                            </Link>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        {shift.worker_ack_reason ? (
                          <span className="text-xs text-gray-600 italic truncate block" title={shift.worker_ack_reason}>
                            &ldquo;{shift.worker_ack_reason}&rdquo;
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant max-w-[160px] truncate">
                        {shift.location ?? '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/admin/shifts`}
                            className="text-xs text-indigo-600 hover:underline"
                            title="Open in shifts"
                          >
                            Shifts
                          </Link>
                          {shift.staff_profiles &&
                            shift.status !== 'completed' &&
                            shift.status !== 'cancelled' && (
                            <UnassignButton
                              shiftId={shift.id}
                              name={staffName(shift)}
                              onDone={() => { router.refresh(); load(filter) }}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 border-t border-gray-100 text-xs text-gray-400">
            {shifts.length} shift{shifts.length !== 1 ? 's' : ''} · {FILTER_LABELS[filter]}
          </div>
        </div>
      )}

    </div>
  )
}
