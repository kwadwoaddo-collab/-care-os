'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

interface VisitNoteSummary {
  id:     string
  status: string
}

interface TimesheetSummary {
  id:            string
  clock_in:      string | null
  clock_out:     string | null
  worked_minutes?: number | null
  status?:       string | null
}

interface ShiftDetail {
  id:                  string
  title:               string
  shift_date:          string
  start_time:          string
  end_time:            string
  status:              string
  shift_type:          string | null
  location:            string | null
  client_name:         string | null
  care_package_id:     string | null
  notes:               string | null
  worker_ack_status:   string | null
  worker_ack_at:       string | null
  worker_ack_reason:   string | null
  visit_note:          VisitNoteSummary | null
  timesheet:           TimesheetSummary | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatTime(t: string) {
  return t.slice(0, 5)
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

const SHIFT_STATUS_CLS: Record<string, string> = {
  scheduled: 'bg-blue-50   text-blue-700   ring-blue-600/20',
  confirmed: 'bg-green-50  text-green-700  ring-green-600/20',
  completed: 'bg-gray-50   text-gray-600   ring-gray-500/20',
  cancelled: 'bg-red-50    text-red-700    ring-red-600/20',
  no_show:   'bg-orange-50 text-orange-700 ring-orange-600/20',
}

const ACK_CLS: Record<string, string> = {
  accepted:     'bg-green-50  text-green-700  ring-green-600/20',
  declined:     'bg-red-50    text-red-700    ring-red-600/20',
  running_late: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
}

function Badge({ text, cls }: { text: string; cls: string }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {text.replace(/_/g, ' ')}
    </span>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-gray-100 last:border-0">
      <span className="text-sm font-medium text-gray-500 flex-shrink-0 w-32">{label}</span>
      <span className="text-sm text-gray-900 text-right">{value || '—'}</span>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WorkerShiftDetailPage() {
  const params = useParams<{ id: string }>()
  const shiftId = params.id

  const [shift,   setShift]   = useState<ShiftDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [token,   setToken]   = useState('')

  // Ack state
  const [ackLoading, setAckLoading] = useState(false)
  const [ackError,   setAckError]   = useState<string | null>(null)
  const [showDeclineReason, setShowDeclineReason] = useState(false)
  const [declineReason, setDeclineReason] = useState('')

  // Clock state
  const [clockLoading, setClockLoading] = useState(false)
  const [clockError,   setClockError]   = useState<string | null>(null)

  const load = useCallback((t: string) => {
    setLoading(true)
    fetch(`/api/worker/shifts/${shiftId}?token=${encodeURIComponent(t)}`)
      .then(async (res) => {
        const data = await res.json() as ShiftDetail | { error: string }
        if (!res.ok) {
          setError((data as { error: string }).error ?? 'Failed to load shift.')
          return
        }
        setShift(data as ShiftDetail)
      })
      .catch(() => setError('Network error — please try again.'))
      .finally(() => setLoading(false))
  }, [shiftId])

  useEffect(() => {
    const t = sessionStorage.getItem('worker_token')
    if (!t) {
      setError('Session expired. Please use your portal link again.')
      setLoading(false)
      return
    }
    setToken(t)
    load(t)
  }, [load])

  // ── Acknowledge ──────────────────────────────────────────────────────────
  async function handleAck(action: 'accepted' | 'declined' | 'running_late', reason?: string) {
    setAckLoading(true)
    setAckError(null)
    try {
      const res = await fetch(`/api/worker/shifts/${shiftId}/acknowledge`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, action, reason }),
      })
      const json = await res.json() as { error?: string; worker_ack_status?: string }
      if (!res.ok) { setAckError(json.error ?? 'Failed to acknowledge shift'); return }
      setShift((prev) => prev ? { ...prev, worker_ack_status: json.worker_ack_status ?? action } : prev)
      setShowDeclineReason(false)
      setDeclineReason('')
    } catch {
      setAckError('Network error — please try again.')
    } finally {
      setAckLoading(false)
    }
  }

  // ── Clock in / out ───────────────────────────────────────────────────────
  async function handleClock(type: 'in' | 'out') {
    setClockLoading(true)
    setClockError(null)
    try {
      const res = await fetch(`/api/worker/timesheets/clock-${type}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, shift_id: shiftId }),
      })
      const json = await res.json() as { error?: string; id?: string; clock_in?: string; clock_out?: string }
      if (!res.ok) { setClockError(json.error ?? `Failed to clock ${type}`); return }
      setShift((prev) => prev ? {
        ...prev,
        timesheet: {
          id:        json.id       ?? prev.timesheet?.id ?? '',
          clock_in:  type === 'in'  ? (json.clock_in  ?? new Date().toISOString()) : (prev.timesheet?.clock_in  ?? null),
          clock_out: type === 'out' ? (json.clock_out ?? new Date().toISOString()) : null,
          status:    type === 'in' ? 'clocked_in' : 'completed',
        },
      } : prev)
    } catch {
      setClockError(`Network error — please try again.`)
    } finally {
      setClockLoading(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-100 rounded animate-pulse w-48" />
        <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
        {error}
        <div className="mt-3">
          <Link href="/worker/shifts" className="text-xs text-red-600 underline">← Back to shifts</Link>
        </div>
      </div>
    )
  }

  if (!shift) return null

  const statusCls    = SHIFT_STATUS_CLS[shift.status]    ?? 'bg-gray-50 text-gray-600 ring-gray-500/20'
  const ackCls       = shift.worker_ack_status ? ACK_CLS[shift.worker_ack_status] ?? '' : ''
  const hasClockedIn  = Boolean(shift.timesheet?.clock_in)
  const hasClockedOut = Boolean(shift.timesheet?.clock_out)

  const isToday = shift.shift_date === new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-5 pb-8">

      {/* Back */}
      <Link href="/worker/shifts" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 gap-1">
        ← My Shifts
      </Link>

      {/* Header */}
      <div>
        <div className="flex items-start gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900 flex-1">{shift.title}</h1>
          <Badge text={shift.status} cls={statusCls} />
        </div>
        <p className="text-base text-gray-600 mt-1">
          {formatDate(shift.shift_date)} · {formatTime(shift.start_time)}–{formatTime(shift.end_time)}
        </p>
        {isToday && (
          <span className="inline-flex mt-2 items-center rounded-full bg-indigo-100 text-indigo-700 px-3 py-0.5 text-xs font-semibold">
            Today
          </span>
        )}
      </div>

      {/* Shift details card */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        <InfoRow label="Date"          value={formatDate(shift.shift_date)} />
        <InfoRow label="Time"          value={`${formatTime(shift.start_time)} – ${formatTime(shift.end_time)}`} />
        <InfoRow label="Client"        value={shift.client_name} />
        <InfoRow label="Location"      value={shift.location} />
        <InfoRow label="Shift type"    value={shift.shift_type?.replace(/_/g, ' ')} />
        {shift.notes && (
          <InfoRow label="Notes" value={<span className="text-left whitespace-pre-wrap">{shift.notes}</span>} />
        )}
      </div>

      {/* Acknowledgement card */}
      {shift.status !== 'cancelled' && shift.status !== 'completed' && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Shift Response</h2>
            {shift.worker_ack_status && (
              <Badge text={shift.worker_ack_status} cls={ackCls} />
            )}
          </div>

          {shift.worker_ack_at && (
            <p className="text-xs text-gray-400">Responded {formatDateTime(shift.worker_ack_at)}</p>
          )}
          {shift.worker_ack_reason && (
            <p className="text-xs text-gray-500 bg-gray-50 rounded p-2">Reason: {shift.worker_ack_reason}</p>
          )}

          {ackError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{ackError}</div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <button
              data-testid="ack-accept-btn"
              onClick={() => handleAck('accepted')}
              disabled={ackLoading}
              className="flex flex-col items-center gap-1 rounded-xl border-2 border-green-200 bg-green-50 p-3 text-xs font-semibold text-green-700 hover:bg-green-100 active:scale-95 transition-all disabled:opacity-50"
            >
              <span className="text-xl">✓</span>
              Accept
            </button>
            <button
              data-testid="ack-decline-btn"
              onClick={() => { setShowDeclineReason(true); setAckError(null) }}
              disabled={ackLoading}
              className="flex flex-col items-center gap-1 rounded-xl border-2 border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 hover:bg-red-100 active:scale-95 transition-all disabled:opacity-50"
            >
              <span className="text-xl">✕</span>
              Decline
            </button>
            <button
              data-testid="ack-late-btn"
              onClick={() => handleAck('running_late')}
              disabled={ackLoading}
              className="flex flex-col items-center gap-1 rounded-xl border-2 border-yellow-200 bg-yellow-50 p-3 text-xs font-semibold text-yellow-700 hover:bg-yellow-100 active:scale-95 transition-all disabled:opacity-50"
            >
              <span className="text-xl">⏱</span>
              Late
            </button>
          </div>

          {showDeclineReason && (
            <div className="space-y-2 pt-1">
              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Reason for declining (optional)"
                rows={3}
                className="block w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-400/20 placeholder:text-gray-400"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleAck('declined', declineReason)}
                  disabled={ackLoading}
                  className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                >
                  {ackLoading ? 'Submitting…' : 'Confirm Decline'}
                </button>
                <button
                  onClick={() => { setShowDeclineReason(false); setDeclineReason('') }}
                  className="flex-1 rounded-lg bg-gray-100 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Clock in / out card */}
      {(shift.status === 'scheduled' || shift.status === 'confirmed' || shift.status === 'completed') && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Attendance</h2>

          <div className="grid grid-cols-2 gap-3 text-xs text-gray-600">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="font-medium text-gray-500 mb-0.5">Clocked in</p>
              <p className="text-sm font-semibold text-gray-900">
                {shift.timesheet?.clock_in ? formatDateTime(shift.timesheet.clock_in) : '—'}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="font-medium text-gray-500 mb-0.5">Clocked out</p>
              <p className="text-sm font-semibold text-gray-900">
                {shift.timesheet?.clock_out ? formatDateTime(shift.timesheet.clock_out) : '—'}
              </p>
            </div>
          </div>

          {clockError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{clockError}</div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              data-testid="clock-in-btn"
              onClick={() => handleClock('in')}
              disabled={clockLoading || hasClockedIn}
              className="rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-500 active:scale-95 transition-all disabled:opacity-40"
            >
              {hasClockedIn ? '✓ Clocked In' : '⏱ Clock In'}
            </button>
            <button
              data-testid="clock-out-btn"
              onClick={() => handleClock('out')}
              disabled={clockLoading || !hasClockedIn || hasClockedOut}
              className="rounded-xl bg-gray-800 py-3 text-sm font-semibold text-white hover:bg-gray-700 active:scale-95 transition-all disabled:opacity-40"
            >
              {hasClockedOut ? '✓ Clocked Out' : '⏹ Clock Out'}
            </button>
          </div>
        </div>
      )}

      {/* Visit note card */}
      {(shift.status === 'confirmed' || shift.status === 'scheduled' || shift.status === 'completed') && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Visit Note</h2>
            {shift.visit_note && (
              <Badge
                text={shift.visit_note.status}
                cls={
                  shift.visit_note.status === 'submitted'
                    ? 'bg-green-50 text-green-700 ring-green-600/20'
                    : 'bg-amber-50 text-amber-700 ring-amber-600/20'
                }
              />
            )}
          </div>

          {shift.visit_note ? (
            <Link
              href={`/worker/visit-notes/${shift.visit_note.id}`}
              className="block w-full text-center rounded-xl bg-indigo-50 border border-indigo-200 py-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 active:scale-95 transition-all"
            >
              {shift.visit_note.status === 'submitted' ? 'View Visit Note →' : 'Continue Visit Note →'}
            </Link>
          ) : (
            <StartVisitNoteButton token={token} shiftId={shiftId} onCreated={(id) => {
              setShift((prev) => prev ? { ...prev, visit_note: { id, status: 'draft' } } : prev)
            }} />
          )}
        </div>
      )}

    </div>
  )
}

// ── Start Visit Note button (inline) ─────────────────────────────────────────

function StartVisitNoteButton({
  token, shiftId, onCreated,
}: {
  token:     string
  shiftId:   string
  onCreated: (id: string) => void
}) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function handleStart() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/worker/visit-notes', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, shift_id: shiftId }),
      })
      const json = await res.json() as { error?: string; id?: string; note_id?: string }
      if (!res.ok) {
        // 409 = already exists — redirect anyway
        if (res.status === 409 && json.note_id) { onCreated(json.note_id); return }
        setError(json.error ?? 'Failed to start visit note')
        return
      }
      if (json.id) onCreated(json.id)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        onClick={handleStart}
        disabled={loading}
        className="block w-full text-center rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-500 active:scale-95 transition-all disabled:opacity-50"
      >
        {loading ? 'Starting…' : '+ Start Visit Note'}
      </button>
    </>
  )
}
