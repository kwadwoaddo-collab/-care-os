'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus'
import { flushQueue, getQueue } from '@/lib/utils/offlineQueue'

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
  onboarding_progress?: number
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
  is_offer?:         boolean
  offer_status?:     string
}

interface WorkerDocument {
  id:            string
  document_type: string
  expiry_date:   string | null
}

interface ComplianceRequirements {
  requiredDocs:        string[]
  missingDocs:         string[]
  approvedCategories:  string[]
  pendingCategories:   string[]
  missingCategories:   string[]
  requiredTraining:    string[]
  complianceState:     string
  compliancePercentage: number
  primaryBlocker:      string | null
  stateExplanation:    string
  nextActions:         { label: string; action: string; status: string; impact: string }[]
}

interface WellbeingData {
  hours_this_week:  number
  consecutive_days: number
  any_concern:      boolean
  warnings:         string[]
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

// ── Action required banner ───────────────────────────────────────────────────

function ActionRequiredBanner({ count, href }: { count: number; href: string }) {
  return (
    <a
      href={href}
      className="block rounded-2xl bg-gradient-to-r from-red-600 to-red-500 p-4 text-white shadow-md hover:shadow-lg active:scale-[0.98] transition-all"
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl flex-shrink-0">⚠️</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold">Action Required</p>
          <p className="text-xs text-red-100 mt-0.5">
            You have {count} item{count !== 1 ? 's' : ''} that need your attention before your next shift.
          </p>
        </div>
        <span className="text-white/80 text-lg flex-shrink-0 font-semibold">Review Now →</span>
      </div>
    </a>
  )
}

// ── Compliance status widget ──────────────────────────────────────────────────

function ComplianceStatusWidget({
  compliance,
  expiringDocs,
  expiredDocs,
}: {
  compliance:   ComplianceRequirements
  expiringDocs: WorkerDocument[]
  expiredDocs:  WorkerDocument[]
}) {
  const missingCount  = compliance.missingDocs.length + compliance.missingCategories.length
  const expiringCount = expiringDocs.length
  const expiredCount  = expiredDocs.length
  const pendingAcks   = compliance.pendingCategories.length

  // Determine overall status colour
  let statusColor: 'green' | 'amber' | 'red' = 'green'
  if (expiredCount > 0 || missingCount > 0) statusColor = 'red'
  else if (expiringCount > 0 || pendingAcks > 0) statusColor = 'amber'

  const pct = compliance.compliancePercentage ?? 0

  const headerCls = {
    green: 'bg-green-50 border-green-200',
    amber: 'bg-amber-50 border-amber-200',
    red:   'bg-red-50   border-red-200',
  }[statusColor]

  const titleCls = {
    green: 'text-green-800',
    amber: 'text-amber-800',
    red:   'text-red-800',
  }[statusColor]

  const barCls = {
    green: 'bg-green-500',
    amber: 'bg-amber-500',
    red:   'bg-red-500',
  }[statusColor]

  const statusIcon = {
    green: '✅',
    amber: '🟡',
    red:   '🔴',
  }[statusColor]

  // Build compliance items total
  const totalItems     = (compliance.requiredDocs.length) + (compliance.requiredTraining.length) + 1 /* policy */
  const completeItems  = Math.round((pct / 100) * totalItems)

  return (
    <section>
      <div className={`rounded-2xl border p-4 space-y-3 ${headerCls}`}>
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{statusIcon}</span>
            <p className={`text-sm font-bold ${titleCls}`}>My Compliance Status</p>
          </div>
          <span className={`text-xs font-semibold ${titleCls}`}>{pct}%</span>
        </div>

        {/* Progress bar */}
        <div className="h-2 w-full rounded-full bg-gray-200/60 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${barCls}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className={`text-xs ${titleCls} opacity-80`}>
          {completeItems} of {totalItems} compliance items complete
        </p>

        {/* Missing documents */}
        {compliance.missingDocs.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-red-700 mb-1.5">Missing documents:</p>
            <div className="space-y-1">
              {compliance.missingDocs.map((doc) => (
                <a
                  key={doc}
                  href="/worker/documents"
                  className="flex items-center justify-between rounded-lg bg-white/80 border border-red-200 px-3 py-2 min-h-[44px] hover:bg-red-50 transition-colors"
                >
                  <span className="text-xs text-red-700 font-medium">{doc.replace(/_/g, ' ')}</span>
                  <span className="text-xs text-red-500 font-semibold ml-2">Upload →</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Expiring docs */}
        {expiringDocs.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-amber-700 mb-1.5">Expiring soon:</p>
            <div className="space-y-1">
              {expiringDocs.map((d) => (
                <a
                  key={d.id}
                  href="/worker/documents"
                  className="flex items-center justify-between rounded-lg bg-white/80 border border-amber-200 px-3 py-2 min-h-[44px] hover:bg-amber-50 transition-colors"
                >
                  <span className="text-xs text-amber-700 font-medium">{d.document_type.replace(/_/g, ' ')}</span>
                  <span className="text-xs text-amber-500">
                    {d.expiry_date ? `Expires ${new Date(d.expiry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : 'Expiring'}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Expired docs */}
        {expiredDocs.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-red-700 mb-1.5">Expired:</p>
            <div className="space-y-1">
              {expiredDocs.map((d) => (
                <a
                  key={d.id}
                  href="/worker/documents"
                  className="flex items-center justify-between rounded-lg bg-white/80 border border-red-200 px-3 py-2 min-h-[44px] hover:bg-red-50 transition-colors"
                >
                  <span className="text-xs text-red-700 font-medium">{d.document_type.replace(/_/g, ' ')}</span>
                  <span className="text-xs text-red-600 font-semibold">Renew →</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Pending acknowledgements */}
        {compliance.pendingCategories.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-amber-700 mb-1.5">Pending acknowledgements:</p>
            <a
              href="/worker/onboarding"
              className="flex items-center justify-between rounded-lg bg-white/80 border border-amber-200 px-3 py-2 min-h-[44px] hover:bg-amber-50 transition-colors"
            >
              <span className="text-xs text-amber-700 font-medium">
                {compliance.pendingCategories.length} training item{compliance.pendingCategories.length !== 1 ? 's' : ''} awaiting review
              </span>
              <span className="text-xs text-amber-500 font-semibold">View →</span>
            </a>
          </div>
        )}

        {/* All good state */}
        {statusColor === 'green' && (
          <p className="text-xs text-green-700 font-medium text-center py-1">
            🎉 You&apos;re fully compliant — great work!
          </p>
        )}
      </div>
    </section>
  )
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
      className="block bg-surface-container-lowest rounded-xl border border-gray-200 p-4 hover:border-indigo-300 hover:bg-indigo-50/20 active:scale-[0.98] transition-all"
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
      className="flex flex-col items-center gap-2 rounded-xl bg-surface-container-lowest border border-gray-200 px-3 py-4 hover:border-indigo-300 hover:bg-indigo-50/30 active:scale-95 transition-all"
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
  const [wellbeing,  setWellbeing]  = useState<WellbeingData | null>(null)
  const [unread,     setUnread]     = useState(0)
  const [taskCount,  setTaskCount]  = useState(0)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [queued,       setQueued]       = useState(0)
  const [syncing,      setSyncing]      = useState(false)
  const [compliance,   setCompliance]   = useState<ComplianceRequirements | null>(null)

  const online = useOnlineStatus()

  const syncOfflineQueue = useCallback(async () => {
    if (!online) return
    const q = getQueue()
    if (q.length === 0) return
    setSyncing(true)
    await flushQueue()
    setQueued(getQueue().length)
    setSyncing(false)
  }, [online])

  useEffect(() => {
    setQueued(getQueue().length)
  }, [])

  useEffect(() => {
    if (online) syncOfflineQueue()
  }, [online, syncOfflineQueue])

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
      fetch(`/api/worker/wellbeing?token=${enc}`).then((r) => r.json()).catch(() => null),
      fetch(`/api/worker/messages?token=${enc}`).then((r) => r.json()).catch(() => null),
      fetch(`/api/worker/tasks?token=${enc}`).then((r) => r.json()).catch(() => null),
      fetch(`/api/worker/onboarding/requirements?token=${enc}`).then((r) => r.json()).catch(() => null),
    ])
      .then(([workerData, shiftsData, docsData, timesheetData, wellbeingData, msgData, taskData, complianceData]) => {
        const w = workerData as WorkerInfo & { error?: string }
        if (w.error) { setError(w.error); return }
        setWorker(w)
        setShifts(Array.isArray(shiftsData) ? (shiftsData as Shift[]) : [])
        setDocs(Array.isArray(docsData) ? (docsData as WorkerDocument[]) : [])
        const ts = timesheetData as { total_hours?: number; error?: string }
        if (!ts.error && typeof ts.total_hours === 'number') setHoursWeek(ts.total_hours)
        if (wellbeingData && !wellbeingData.error) setWellbeing(wellbeingData as WellbeingData)
        if (msgData?.unread_count) setUnread(msgData.unread_count as number)
        if (taskData?.total_pending) setTaskCount(taskData.total_pending as number)
        if (complianceData && !complianceData.error) setCompliance(complianceData as ComplianceRequirements)
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

  const todayShifts    = shifts.filter((s) => !s.is_offer && s.shift_date === td && s.status !== 'cancelled')
  const upcomingShifts = shifts.filter((s) => !s.is_offer && s.shift_date >  td && s.status !== 'cancelled').slice(0, 5)
  const pendingAck     = todayShifts.filter((s) => !s.worker_ack_status)
  const pendingNotes   = shifts.filter((s) => !s.is_offer && s.visit_note_id === null && (s.status === 'in_progress' || s.status === 'accepted'))
  const expiringDocs   = docs.filter((d) => d.expiry_date && d.expiry_date <= in30 && d.expiry_date >= td)
  const expiredDocs    = docs.filter((d) => d.expiry_date && d.expiry_date < td)

  // ── Alerts ─────────────────────────────────────────────────────────────

  const alerts: Array<{ icon: string; text: string; variant: 'red' | 'amber' | 'blue' }> = []

  // Onboarding incomplete — show prominent CTA, NOT a vague alert
  // (handled separately below the header)
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

  // ── Compliance action count (for Action Required banner) ──────────────────
  const complianceActionCount = compliance
    ? compliance.missingDocs.length +
      compliance.missingCategories.length +
      expiredDocs.length
    : 0

  return (
    <div className="space-y-5 pb-4">

      {/* Action Required banner — shown at very top when there are compliance issues */}
      {complianceActionCount > 0 && (
        <ActionRequiredBanner
          count={complianceActionCount}
          href="/worker/documents"
        />
      )}

      {/* Compliance Status Widget — first content section */}
      {compliance && (
        <ComplianceStatusWidget
          compliance={compliance}
          expiringDocs={expiringDocs}
          expiredDocs={expiredDocs}
        />
      )}

      {/* Offline banner */}
      {!online && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3 text-sm text-amber-700">
          <span className="text-base shrink-0">📡</span>
          <span className="flex-1">You are offline. Some features are unavailable.</span>
        </div>
      )}

      {/* Sync banner — pending queued actions */}
      {online && queued > 0 && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3.5 py-3 text-sm text-blue-700">
          <span className="text-base shrink-0">{syncing ? '🔄' : '☁️'}</span>
          <span className="flex-1">{syncing ? 'Syncing offline actions…' : `${queued} action${queued !== 1 ? 's' : ''} queued to sync.`}</span>
        </div>
      )}

      {/* Profile header */}
      <div className="bg-surface-container-lowest rounded-2xl border border-gray-200 px-4 py-4 flex items-center gap-3">
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

      {/* Onboarding CTA — shown prominently above stats when incomplete */}
      {!worker.onboarding_completed && (
        <Link
          href="/worker/onboarding"
          className="block rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 p-4 text-white shadow-md hover:shadow-lg active:scale-[0.98] transition-all"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl flex-shrink-0">✅</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">Complete your onboarding</p>
              <p className="text-xs text-indigo-200 mt-0.5">
                Tap here to see what steps are left and finish setting up your profile.
              </p>
            </div>
            <span className="text-xl text-indigo-300 flex-shrink-0">→</span>
          </div>
          <div className="mt-3 h-1.5 w-full rounded-full bg-indigo-800/40 overflow-hidden">
            <div
              className="h-full rounded-full bg-white/70 transition-all"
              style={{ width: `${worker.onboarding_progress ?? 0}%` }}
            />
          </div>
          <p className="text-right text-xs text-indigo-200 mt-1">{worker.onboarding_progress ?? 0}% complete</p>
        </Link>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface-container-lowest rounded-xl border border-gray-200 px-4 py-3">
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
          <p className="text-xs font-medium text-gray-500 mb-0.5">Onboarding</p>
          <p className={`text-sm font-semibold ${worker.onboarding_completed ? 'text-green-700' : 'text-amber-700'}`}>
            {worker.onboarding_completed ? '✓ Complete' : `${worker.onboarding_progress ?? 0}% done`}
          </p>
        </div>
      </div>

      {/* Wellbeing alerts */}
      {wellbeing?.any_concern && wellbeing.warnings.length > 0 && (
        <section>
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3.5 space-y-2">
            <p className="text-sm font-semibold text-orange-800">Wellbeing notice</p>
            {wellbeing.warnings.map((w, i) => (
              <p key={i} className="text-xs text-orange-700 leading-relaxed">{w}</p>
            ))}
            <p className="text-xs text-orange-600 font-medium mt-1">If you need support, contact your manager or use the messaging tab.</p>
          </div>
        </section>
      )}

      {/* Task count callout */}
      {taskCount > 0 && (
        <Link href="/worker/tasks"
          className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 hover:border-indigo-300 active:scale-[0.98] transition-all">
          <span className="text-xl shrink-0">📋</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-indigo-900">
              {taskCount} pending task{taskCount !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-indigo-600">Tap to view and complete</p>
          </div>
          <span className="text-indigo-400 text-lg">→</span>
        </Link>
      )}

      {/* Unread messages callout */}
      {unread > 0 && (
        <Link href="/worker/messages"
          className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 hover:border-blue-300 active:scale-[0.98] transition-all">
          <span className="text-xl shrink-0">💬</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-900">
              {unread} unread message{unread !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-blue-600">Tap to read</p>
          </div>
          <span className="text-blue-400 text-lg">→</span>
        </Link>
      )}


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
          <div className="bg-surface-container-lowest rounded-xl border border-gray-200 px-4 py-5 text-sm text-gray-400 text-center">
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
          <QuickAction href="/worker/timeline"     icon="🗺️" label="Timeline" />
          <QuickAction href="/worker/availability" icon="🗓" label="Availability" />
          <QuickAction href="/worker/documents"    icon="📤" label="Upload Doc" />
          <QuickAction href="/worker/performance"  icon="📊" label="My Progress" />
        </div>
      </section>

      {/* Safety — emergency access */}
      <section>
        <div className="bg-surface-container-lowest border border-gray-200 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-gray-500 mb-2">Safety</p>
          <div className="flex gap-2">
            <Link
              href="/worker/safety"
              className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 active:scale-95 transition-all"
            >
              🚨 Emergency Alert
            </Link>
            <Link
              href="/worker/messages"
              className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 border border-gray-200 text-gray-700 text-xs font-medium rounded-xl hover:bg-gray-50 transition-all"
            >
              💬 Contact Coordinator
            </Link>
          </div>
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
