'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface WorkerInfo {
  id:                   string
  first_name:           string | null
  last_name:            string | null
  email:                string | null
  status:               string
  job_role:             string | null
  start_date:           string | null
  onboarding_completed: boolean
}

interface Shift {
  id:                string
  title:             string
  shift_date:        string
  start_time:        string
  end_time:          string
  status:            string
  client_name:       string | null
  location:          string | null
  shift_type:        string | null
  visit_note_id:     string | null
  worker_ack_status: string | null
}

interface WorkerDocument {
  id:            string
  document_type: string
  expiry_date:   string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CLS: Record<string, string> = {
  pre_employment: 'bg-yellow-100 text-yellow-700',
  active:         'bg-green-100  text-green-700',
  suspended:      'bg-orange-100 text-orange-700',
  inactive:       'bg-gray-100   text-gray-600',
}

const ACK_CLS: Record<string, string> = {
  accepted:     'bg-green-50 text-green-700',
  declined:     'bg-red-50   text-red-700',
  running_late: 'bg-yellow-50 text-yellow-700',
}

function today() { return new Date().toISOString().slice(0, 10) }
function in30Days() {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d.toISOString().slice(0, 10)
}

function formatTime(t: string) { return t.slice(0, 5) }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ── Alert banner ──────────────────────────────────────────────────────────────

function Alert({ icon, text, variant }: { icon: string; text: string; variant: 'red' | 'amber' | 'blue' }) {
  const cls = {
    red:   'bg-red-50   border-red-200   text-red-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    blue:  'bg-blue-50  border-blue-200  text-blue-700',
  }[variant]
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-3.5 py-3 text-sm ${cls}`}>
      <span className="text-base flex-shrink-0">{icon}</span>
      <span>{text}</span>
    </div>
  )
}

// ── Shift card ────────────────────────────────────────────────────────────────

function ShiftCard({ s, isToday }: { s: Shift; isToday: boolean }) {
  const ackCls = s.worker_ack_status ? ACK_CLS[s.worker_ack_status] : 'bg-gray-100 text-gray-500'
  const ackLabel = s.worker_ack_status
    ? s.worker_ack_status.replace(/_/g, ' ')
    : 'Not responded'

  return (
    <Link
      href={`/worker/shifts/${s.id}`}
      className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-indigo-300 hover:bg-indigo-50/20 active:scale-[0.98] transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{s.title}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {isToday ? 'Today' : formatDate(s.shift_date)} · {formatTime(s.start_time)}–{formatTime(s.end_time)}
          </p>
          {s.client_name && <p className="text-xs text-gray-400 mt-0.5">Client: {s.client_name}</p>}
          {s.location && <p className="text-xs text-gray-400 truncate">{s.location}</p>}
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ackCls}`}>
            {ackLabel}
          </span>
          {isToday && (
            <span className="inline-flex rounded-full bg-indigo-100 text-indigo-700 px-2 py-0.5 text-xs font-semibold">
              Today
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

// ── Quick action button ───────────────────────────────────────────────────────

function QuickAction({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 rounded-xl bg-white border border-gray-200 px-3 py-4 hover:border-indigo-300 hover:bg-indigo-50/30 active:scale-95 transition-all"
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-xs font-medium text-gray-700 text-center leading-tight">{label}</span>
    </Link>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WorkerDashboard() {
  const [worker,     setWorker]     = useState<WorkerInfo | null>(null)
  const [shifts,     setShifts]     = useState<Shift[]>([])
  const [docs,       setDocs]       = useState<WorkerDocument[]>([])
  const [hoursWeek,  setHoursWeek]  = useState<number | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)

  useEffect(() => {
    const token = sessionStorage.getItem('worker_token')
    if (!token) {
      setError('Session expired. Please use your portal link again.')
      setLoading(false)
      return
    }

    const enc = encodeURIComponent(token)

    Promise.all([
      fetch(`/api/worker/validate?token=${enc}`).then((r) => r.json()),
      fetch(`/api/worker/shifts?token=${enc}`).then((r) => r.json()),
      fetch(`/api/worker/documents?token=${enc}`).then((r) => r.json()),
      fetch(`/api/worker/timesheets?token=${enc}`).then((r) => r.json()),
    ])
      .then(([workerData, shiftsData, docsData, timesheetData]) => {
        const w = workerData as WorkerInfo & { error?: string }
        if (w.error) { setError(w.error); return }
        setWorker(w)
        setShifts(Array.isArray(shiftsData) ? (shiftsData as Shift[]) : [])
        setDocs(Array.isArray(docsData) ? (docsData as WorkerDocument[]) : [])
        const ts = timesheetData as { total_hours?: number; error?: string }
        if (!ts.error && typeof ts.total_hours === 'number') {
          setHoursWeek(ts.total_hours)
        }
      })
      .catch(() => setError('Failed to load — please try again.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-20 bg-gray-100 rounded-2xl" />
        <div className="h-40 bg-gray-100 rounded-2xl" />
        <div className="h-32 bg-gray-100 rounded-2xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-red-50 border border-red-200 p-5 text-sm text-red-700">
        <p className="font-medium mb-1">Session error</p>
        <p>{error}</p>
      </div>
    )
  }

  if (!worker) return null

  const displayName = [worker.first_name, worker.last_name].filter(Boolean).join(' ') || 'Worker'
  const statusCls   = STATUS_CLS[worker.status] ?? 'bg-gray-100 text-gray-600'

  const td        = today()
  const in30      = in30Days()

  const todayShifts    = shifts.filter((s) => s.shift_date === td && s.status !== 'cancelled')
  const upcomingShifts = shifts.filter((s) => s.shift_date >  td && s.status !== 'cancelled').slice(0, 5)
  const pendingAck     = todayShifts.filter((s) => !s.worker_ack_status)
  const pendingNotes   = shifts.filter((s) => s.visit_note_id === null && (s.status === 'confirmed' || s.status === 'scheduled'))
  const expiringDocs   = docs.filter((d) => d.expiry_date && d.expiry_date <= in30 && d.expiry_date >= td)
  const expiredDocs    = docs.filter((d) => d.expiry_date && d.expiry_date < td)

  // ── Alerts ─────────────────────────────────────────────────────────────

  const alerts: Array<{ icon: string; text: string; variant: 'red' | 'amber' | 'blue' }> = []

  if (!worker.onboarding_completed) {
    alerts.push({
      icon: '📋',
      text: 'Your HR profile is incomplete. Contact your manager to update your payroll details.',
      variant: 'amber',
    })
  }
  if (pendingAck.length > 0) {
    alerts.push({
      icon: '📣',
      text: `You have ${pendingAck.length} shift${pendingAck.length > 1 ? 's' : ''} today that you haven\'t responded to.`,
      variant: 'red',
    })
  }
  if (pendingNotes.length > 0) {
    alerts.push({
      icon: '📝',
      text: `${pendingNotes.length} shift${pendingNotes.length > 1 ? 's' : ''} have no visit note started yet.`,
      variant: 'amber',
    })
  }
  if (expiredDocs.length > 0) {
    alerts.push({
      icon: '⚠',
      text: `${expiredDocs.length} document${expiredDocs.length > 1 ? 's have' : ' has'} expired. Please upload a new one.`,
      variant: 'red',
    })
  }
  if (expiringDocs.length > 0) {
    alerts.push({
      icon: '🗓',
      text: `${expiringDocs.length} document${expiringDocs.length > 1 ? 's' : ''} will expire within 30 days.`,
      variant: 'amber',
    })
  }

  return (
    <div className="space-y-5 pb-4">

      {/* Profile header */}
      <div className="bg-white rounded-2xl border border-gray-200 px-4 py-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-lg flex-shrink-0">
          {(worker.first_name?.[0] ?? '?').toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-gray-900 truncate">{displayName}</p>
          <p className="text-xs text-gray-500 truncate">{worker.job_role ?? '—'}</p>
        </div>
        <span className={`flex-shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusCls}`}>
          {worker.status.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs font-medium text-gray-500 mb-0.5">Hours this week</p>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">
            {hoursWeek !== null ? `${hoursWeek}h` : '—'}
          </p>
        </div>
        <div className={`rounded-xl border px-4 py-3 ${
          worker.onboarding_completed
            ? 'bg-green-50 border-green-200'
            : 'bg-amber-50 border-amber-200'
        }`}>
          <p className="text-xs font-medium text-gray-500 mb-0.5">Profile</p>
          <p className={`text-sm font-semibold ${worker.onboarding_completed ? 'text-green-700' : 'text-amber-700'}`}>
            {worker.onboarding_completed ? '✓ Complete' : 'Incomplete'}
          </p>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <Alert key={i} icon={a.icon} text={a.text} variant={a.variant} />
          ))}
        </div>
      )}

      {/* Today's shifts */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Today&apos;s Shifts</h2>
        {todayShifts.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-5 text-sm text-gray-400 text-center">
            No shifts today.
          </div>
        ) : (
          <div className="space-y-2">
            {todayShifts.map((s) => <ShiftCard key={s.id} s={s} isToday />)}
          </div>
        )}
      </section>

      {/* Upcoming shifts */}
      {upcomingShifts.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Upcoming Shifts</h2>
          <div className="space-y-2">
            {upcomingShifts.map((s) => <ShiftCard key={s.id} s={s} isToday={false} />)}
          </div>
          <Link href="/worker/shifts" className="block text-center text-xs text-indigo-600 font-medium mt-2 py-2">
            View all shifts →
          </Link>
        </section>
      )}

      {/* Quick actions */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Quick Actions</h2>
        <div className="grid grid-cols-4 gap-2">
          <QuickAction href="/worker/shifts"       icon="📅" label="My Shifts" />
          <QuickAction href="/worker/availability" icon="🗓" label="Availability" />
          <QuickAction href="/worker/documents"    icon="📤" label="Upload Doc" />
          <QuickAction href="/worker/shifts"       icon="📝" label="Visit Notes" />
        </div>
      </section>

      {/* Documents summary */}
      {(expiredDocs.length > 0 || expiringDocs.length > 0) && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-700">Documents</h2>
            <Link href="/worker/documents" className="text-xs text-indigo-600 font-medium">Manage →</Link>
          </div>
          <div className="space-y-2">
            {expiredDocs.map((d) => (
              <div key={d.id} className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <span className="text-sm text-red-700 font-medium">{d.document_type.replace(/_/g, ' ')}</span>
                <span className="text-xs text-red-500 font-medium">Expired</span>
              </div>
            ))}
            {expiringDocs.map((d) => (
              <div key={d.id} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <span className="text-sm text-amber-700 font-medium">{d.document_type.replace(/_/g, ' ')}</span>
                <span className="text-xs text-amber-500 font-medium">Expiring soon</span>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  )
}
