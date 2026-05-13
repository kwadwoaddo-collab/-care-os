import Link from 'next/link'
import { adminClient } from '@/lib/supabase/admin'
import type { AlertsResponse, AlertItem } from '@/app/api/admin/compliance/alerts/route'
import type { OnboardingResponse } from '@/app/api/admin/onboarding/route'
import { adminFetch } from '@/lib/admin/serverFetch'

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TodayShift {
  id:                string
  title:             string
  start_time:        string
  end_time:          string
  status:            string
  assigned_staff_id: string | null
  client_name:       string | null
  staff_profiles:    { first_name: string | null; last_name: string | null } | null
  clients:           { id: string; first_name: string; last_name: string } | null
  care_packages:     { title: string } | null
  visit_notes:       { id: string; status: string }[]
}

interface Incident {
  id:              string
  incident_type:   string
  severity:        string
  status:          string
  occurred_at:     string | null
  created_at:      string
  description:     string
  clients:         { first_name: string; last_name: string } | null
  staff_profiles:  { first_name: string | null; last_name: string | null } | null
}

interface AuditEntry {
  id:          string
  created_at:  string
  action:      string
  actor_id:    string | null
  entity_type: string | null
  entity_id:   string | null
  metadata:    Record<string, unknown> | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtTs(iso: string) {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) +
    ' ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  )
}

function fmtTime(t: string) { return t.slice(0, 5) }

function staffName(p: { first_name: string | null; last_name: string | null } | null): string {
  if (!p) return '—'
  return [p.first_name, p.last_name].filter(Boolean).join(' ') || '—'
}

const SHIFT_STATUS_CLS: Record<string, string> = {
  scheduled: 'bg-blue-50   text-blue-700',
  confirmed: 'bg-green-50  text-green-700',
  completed: 'bg-gray-50   text-gray-500',
  cancelled: 'bg-red-50    text-red-600',
  no_show:   'bg-orange-50 text-orange-700',
}

const NOTE_STATUS_CLS: Record<string, string> = {
  draft:     'text-gray-400',
  submitted: 'text-green-600',
  locked:    'text-indigo-600',
}

const SEVERITY_CLS: Record<string, string> = {
  expired: 'bg-red-50    text-red-700    border-red-200',
  warning: 'bg-orange-50 text-orange-700 border-orange-200',
  notice:  'bg-yellow-50 text-yellow-700 border-yellow-200',
}

const AUDIT_ACTION_CLS: Record<string, string> = {
  staff:        'bg-indigo-50 text-indigo-700',
  shift:        'bg-blue-50   text-blue-700',
  care_package: 'bg-green-50  text-green-700',
  applicant:    'bg-yellow-50 text-yellow-700',
  document:     'bg-purple-50 text-purple-700',
  visit_note:   'bg-pink-50   text-pink-700',
  incident:     'bg-red-50    text-red-700',
}

const INCIDENT_SEVERITY_CLS: Record<string, string> = {
  low:      'bg-gray-50    text-gray-600',
  medium:   'bg-yellow-50  text-yellow-700',
  high:     'bg-orange-50  text-orange-700',
  critical: 'bg-red-50     text-red-700',
}

const INCIDENT_STATUS_CLS: Record<string, string> = {
  open:          'bg-red-50     text-red-700',
  investigating: 'bg-blue-50    text-blue-700',
  resolved:      'bg-green-50   text-green-700',
  closed:        'bg-gray-50    text-gray-500',
}

function auditActionCls(action: string) {
  const prefix = action.split('.')[0] ?? ''
  return AUDIT_ACTION_CLS[prefix] ?? 'bg-gray-50 text-gray-600'
}

function metaPreview(meta: Record<string, unknown> | null): string {
  if (!meta) return '—'
  const entries = Object.entries(meta).slice(0, 2)
  return entries.map(([k, v]) => `${k}: ${String(v).slice(0, 30)}`).join(' · ')
}

// ── Shared UI primitives ──────────────────────────────────────────────────────

function SectionBox({ title, children, action }: {
  title:    string
  children: React.ReactNode
  action?:  React.ReactNode
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  )
}

function Empty({ msg }: { msg: string }) {
  return <p className="px-4 py-6 text-center text-sm text-gray-400">{msg}</p>
}

// ── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({ label, count, sub, href, urgent }: {
  label:  string
  count:  number
  sub:    string
  href:   string
  urgent?: boolean
}) {
  return (
    <Link
      href={href}
      className={[
        'rounded-lg border px-4 py-3 block hover:shadow-sm transition-shadow',
        urgent && count > 0
          ? 'bg-red-50 border-red-200 text-red-900'
          : 'bg-white border-gray-200 text-gray-900',
      ].join(' ')}
    >
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`text-2xl font-bold tabular-nums mt-0.5 ${urgent && count > 0 ? 'text-red-700' : ''}`}>
        {count}
      </p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </Link>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminDashboard() {
  const today = new Date().toISOString().slice(0, 10)

  // All queries fire in parallel — no waterfalls
  const in14days = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const todayStart = `${today}T00:00:00.000Z`

  const [
    staffStatusResult,
    todayShiftsResult,
    openShiftsCountResult,
    clientCountResult,
    pkgCountResult,
    draftNotesCountResult,
    hrIncompleteResult,
    declinedShiftsResult,
    runningLateResult,
    unacknowledgedResult,
    notifFailedResult,
    notifTodayResult,
    incidentsResult,
    complianceRes,
    auditRes,
    onboardingRes,
    pendingCertsResult,
    recentlyApprovedResult,
    expiring7dResult,
  ] = await Promise.all([
    // Staff statuses (for active count + non-compliant from compliance)
    adminClient
      .from('staff_profiles')
      .select('status'),

    // Today's shifts with all joins including visit notes
    adminClient
      .from('shifts')
      .select(`
        id, title, start_time, end_time, status,
        assigned_staff_id, client_name,
        staff_profiles!assigned_staff_id ( first_name, last_name ),
        clients!client_id            ( id, first_name, last_name ),
        care_packages!care_package_id ( title ),
        visit_notes                  ( id, status )
      `)
      .eq('shift_date', today)
      .order('start_time', { ascending: true })
      .limit(10),

    // Open (unassigned) shift count
    adminClient
      .from('shifts')
      .select('id', { count: 'exact', head: true })
      .is('assigned_staff_id', null)
      .in('status', ['scheduled', 'confirmed']),

    // Active client count
    adminClient
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),

    // Active care package count
    adminClient
      .from('care_packages')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),

    // Draft visit note count
    adminClient
      .from('visit_notes')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'draft'),

    // HR incomplete: staff who have not finished onboarding
    adminClient
      .from('staff_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('onboarding_completed', false)
      .not('status', 'eq', 'terminated'),

    // Declined shifts (next 14 days)
    adminClient
      .from('shifts')
      .select('id', { count: 'exact', head: true })
      .gte('shift_date', today)
      .lte('shift_date', in14days)
      .eq('worker_ack_status', 'declined'),

    // Running late (today)
    adminClient
      .from('shifts')
      .select('id', { count: 'exact', head: true })
      .eq('shift_date', today)
      .eq('worker_ack_status', 'running_late'),

    // Unacknowledged assigned shifts (next 14 days)
    adminClient
      .from('shifts')
      .select('id', { count: 'exact', head: true })
      .gte('shift_date', today)
      .lte('shift_date', in14days)
      .not('assigned_staff_id', 'is', null)
      .is('worker_ack_status', null)
      .in('status', ['scheduled', 'confirmed']),

    // Failed notifications (last 7 days)
    adminClient
      .from('notification_logs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed'),

    // Notifications sent today
    adminClient
      .from('notification_logs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'sent')
      .gte('created_at', todayStart),

    // Recent incidents (from incidents table)
    adminClient
      .from('incidents')
      .select(`
        id, incident_type, severity, status, occurred_at, created_at, description,
        clients!client_id      ( first_name, last_name ),
        staff_profiles!staff_profile_id ( first_name, last_name )
      `)
      .in('status', ['open', 'investigating'])
      .order('created_at', { ascending: false })
      .limit(5),

    // Compliance alerts API (complex calculation, reuse existing)
    adminFetch(`${BASE}/api/admin/compliance/alerts`, { cache: 'no-store' }),

    // Audit log API (reuse existing, last 10)
    adminFetch(`${BASE}/api/admin/audit-log`, { cache: 'no-store' }),

    // Onboarding summary
    adminFetch(`${BASE}/api/admin/onboarding`, { cache: 'no-store' }),

    // Pending training certs awaiting review
    adminClient
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('document_type', 'training_certificate')
      .eq('reviewed_status', 'pending'),

    // Recently approved training certs (last 7 days)
    adminClient
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('document_type', 'training_certificate')
      .eq('reviewed_status', 'approved')
      .gte('reviewed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),

    // Documents expiring within 7 days (distinct staff count via expiry_date)
    adminClient
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .not('expiry_date', 'is', null)
      .gte('expiry_date', today)
      .lte('expiry_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
  ])

  // Parse HTTP responses
  const compliance: AlertsResponse | null = complianceRes.ok
    ? (await complianceRes.json() as AlertsResponse)
    : null

  const auditEntries: AuditEntry[] = auditRes.ok
    ? ((await auditRes.json() as AuditEntry[]).slice(0, 10))
    : []

  const onboarding: OnboardingResponse | null = onboardingRes.ok
    ? (await onboardingRes.json() as OnboardingResponse)
    : null

  // Derive summary numbers
  const allStaff      = staffStatusResult.data ?? []
  const activeStaff   = allStaff.filter((s) => s.status === 'active').length
  const openShifts    = openShiftsCountResult.count ?? 0
  const activeClients = clientCountResult.count     ?? 0
  const activePkgs    = pkgCountResult.count         ?? 0
  const draftNotes    = draftNotesCountResult.count  ?? 0
  const hrIncomplete      = hrIncompleteResult.count      ?? 0
  const declinedShifts    = declinedShiftsResult.count    ?? 0
  const runningLate       = runningLateResult.count       ?? 0
  const unacknowledged    = unacknowledgedResult.count    ?? 0
  const opsAlerts         = declinedShifts + runningLate
  const notifFailed       = notifFailedResult.count  ?? 0
  const notifToday        = notifTodayResult.count   ?? 0

  const nonCompliant    = compliance?.summary.nonCompliantCount ?? 0
  const expiredCount    = compliance?.summary.expiredCount      ?? 0
  const expiringSoon    = compliance?.summary.expiringWithin30  ?? 0
  const pendingCerts    = pendingCertsResult.count              ?? 0
  const recentlyApproved = recentlyApprovedResult.count         ?? 0
  const expiring7d      = expiring7dResult.count                ?? 0

  // Top 5 compliance alerts (expired first, then expiring soon)
  const topAlerts: AlertItem[] = [
    ...(compliance?.expired      ?? []),
    ...(compliance?.expiringSoon ?? []),
  ].slice(0, 5)

  const todayShifts  = (todayShiftsResult.data  ?? []) as unknown as TodayShift[]
  const incidents    = (incidentsResult.data     ?? []) as unknown as Incident[]

  const unassignedToday = todayShifts.filter((s) => !s.assigned_staff_id).length

  // ── Pilot analytics — separate lightweight parallel set ────────────────────
  const analyticsWindow = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const [
    pilotTotalStaffResult,
    pilotOnboardedResult,
    pilotInvitedResult,
    pilotInviteLoginResult,
    pilotAcceptedResult,
    pilotCompletedResult,
    pilotTotalAssignedResult,
  ] = await Promise.all([
    adminClient.from('staff_profiles').select('id', { count: 'exact', head: true }).not('status', 'eq', 'terminated'),
    adminClient.from('staff_profiles').select('id', { count: 'exact', head: true }).eq('onboarding_completed', true),
    adminClient.from('staff_profiles').select('id', { count: 'exact', head: true }).not('portal_invite_sent_at', 'is', null),
    adminClient.from('staff_profiles').select('id', { count: 'exact', head: true }).not('portal_last_login_at', 'is', null),
    adminClient.from('shifts').select('id', { count: 'exact', head: true }).eq('worker_ack_status', 'accepted').gte('shift_date', analyticsWindow),
    adminClient.from('shifts').select('id', { count: 'exact', head: true }).eq('status', 'completed').gte('shift_date', analyticsWindow),
    adminClient.from('shifts').select('id', { count: 'exact', head: true }).not('assigned_staff_id', 'is', null).gte('shift_date', analyticsWindow),
  ])

  const pilotTotalStaff     = pilotTotalStaffResult.count    ?? 0
  const pilotOnboarded      = pilotOnboardedResult.count     ?? 0
  const pilotInvited        = pilotInvitedResult.count       ?? 0
  const pilotInviteLogin    = pilotInviteLoginResult.count   ?? 0
  const pilotAccepted       = pilotAcceptedResult.count      ?? 0
  const pilotCompleted      = pilotCompletedResult.count     ?? 0
  const pilotTotalAssigned  = pilotTotalAssignedResult.count ?? 0

  const onboardingPct   = pilotTotalStaff     > 0 ? Math.round((pilotOnboarded  / pilotTotalStaff)      * 100) : 0
  const inviteSuccessPct = pilotInvited       > 0 ? Math.round((pilotInviteLogin / pilotInvited)        * 100) : 0
  const acceptancePct   = pilotTotalAssigned  > 0 ? Math.round((pilotAccepted   / pilotTotalAssigned)   * 100) : 0
  const completionPct   = pilotTotalAssigned  > 0 ? Math.round((pilotCompleted  / pilotTotalAssigned)   * 100) : 0

  return (
    <div className="space-y-5">

      {/* ── Mobile hero (lg:hidden) ────────────────────────────────────────── */}
      <div className="lg:hidden space-y-3">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Care OS · {fmt(today)}</p>
          <h1 className="text-lg font-bold text-gray-900 mt-0.5">Operations</h1>
        </div>

        {/* Hero triage card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden">
          <div className="grid grid-cols-3 divide-x divide-gray-100">
            <a href="/admin/shifts/open" className={`flex flex-col items-center py-4 ${openShifts > 0 ? 'bg-orange-50' : ''}`}>
              <span className={`text-3xl font-extrabold tabular-nums ${openShifts > 0 ? 'text-orange-600' : 'text-gray-800'}`}>{openShifts}</span>
              <span className={`text-[11px] font-medium mt-0.5 ${openShifts > 0 ? 'text-orange-600' : 'text-gray-400'}`}>Open shifts</span>
            </a>
            <a href="/admin/compliance" className={`flex flex-col items-center py-4 ${nonCompliant > 0 ? 'bg-red-50' : ''}`}>
              <span className={`text-3xl font-extrabold tabular-nums ${nonCompliant > 0 ? 'text-red-600' : 'text-gray-800'}`}>{nonCompliant}</span>
              <span className={`text-[11px] font-medium mt-0.5 ${nonCompliant > 0 ? 'text-red-600' : 'text-gray-400'}`}>Non-compliant</span>
            </a>
            <a href="/admin/incidents" className={`flex flex-col items-center py-4 ${incidents.length > 0 ? 'bg-amber-50' : ''}`}>
              <span className={`text-3xl font-extrabold tabular-nums ${incidents.length > 0 ? 'text-amber-700' : 'text-gray-800'}`}>{incidents.length}</span>
              <span className={`text-[11px] font-medium mt-0.5 ${incidents.length > 0 ? 'text-amber-700' : 'text-gray-400'}`}>Active incidents</span>
            </a>
          </div>
          {(opsAlerts > 0 || unacknowledged > 0) && (
            <a href="/admin/shifts/operations" className="flex items-center justify-between px-4 py-2.5 bg-amber-50 border-t border-amber-100">
              <p className="text-xs font-semibold text-amber-800">
                {declinedShifts > 0 && `${declinedShifts} declined`}
                {declinedShifts > 0 && runningLate > 0 && ' · '}
                {runningLate > 0 && `${runningLate} running late`}
                {unacknowledged > 0 && ` · ${unacknowledged} unacknowledged`}
              </p>
              <span className="text-xs text-amber-600 font-medium">Ops →</span>
            </a>
          )}
        </div>

        {/* Horizontal metrics strip */}
        <div className="-mx-4 px-4 overflow-x-auto flex gap-2 pb-1" style={{ scrollbarWidth: 'none' }}>
          {[
            { label: 'Staff',      value: activeStaff,    href: '/admin/staff',       tint: '' },
            { label: 'Clients',    value: activeClients,  href: '/admin/clients',     tint: '' },
            { label: 'Expiring',   value: expiring7d,     href: '/admin/compliance',  tint: expiring7d > 0 ? 'bg-orange-50 border-orange-200 text-orange-700' : '' },
            { label: 'HR gaps',    value: hrIncomplete,   href: '/admin/onboarding',  tint: hrIncomplete > 0 ? 'bg-red-50 border-red-200 text-red-700' : '' },
            { label: 'Certs',      value: pendingCerts,   href: '/admin/staff',       tint: pendingCerts > 0 ? 'bg-amber-50 border-amber-200 text-amber-700' : '' },
            { label: 'Draft notes',value: draftNotes,     href: '/admin/visit-notes', tint: draftNotes > 0 ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : '' },
          ].map(({ label, value, href, tint }) => (
            <a
              key={label}
              href={href}
              className={`flex-shrink-0 rounded-xl border px-4 py-3 min-w-[90px] text-center ${
                tint || 'bg-white border-gray-100'
              }`}
            >
              <p className="text-xl font-bold tabular-nums">{value}</p>
              <p className="text-[11px] font-medium text-gray-500 mt-0.5">{label}</p>
            </a>
          ))}
        </div>

        {/* Today’s shifts — mobile card list */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Today’s Shifts</p>
            <a href="/admin/shifts" className="text-xs text-indigo-600 hover:underline">View all →</a>
          </div>
          {todayShifts.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 px-4 py-6 text-center text-sm text-gray-400">
              No shifts today.
            </div>
          ) : (
            <div className="space-y-2">
              {todayShifts.map((shift) => {
                const isUnassigned = !shift.assigned_staff_id
                const note = shift.visit_notes?.[0] ?? null
                return (
                  <div
                    key={shift.id}
                    className={`bg-white rounded-xl border overflow-hidden ${
                      isUnassigned ? 'border-amber-200' : 'border-gray-100'
                    }`}
                  >
                    <div className={`flex items-center justify-between px-4 py-2 border-b ${
                      isUnassigned ? 'bg-amber-50 border-amber-100' : 'bg-gray-50 border-gray-50'
                    }`}>
                      <span className="text-xs font-semibold tabular-nums text-gray-700">
                        {fmtTime(shift.start_time)}–{fmtTime(shift.end_time)}
                      </span>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        SHIFT_STATUS_CLS[shift.status] ?? 'bg-gray-50 text-gray-500'
                      }`}>
                        {shift.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="px-4 py-2.5">
                      <p className="text-sm font-medium text-gray-900 truncate">{shift.title}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        <span className="truncate">
                          {shift.clients
                            ? `${shift.clients.first_name} ${shift.clients.last_name}`
                            : (shift.client_name ?? 'No client')}
                        </span>
                        <span className={`truncate ${
                          isUnassigned ? 'text-amber-700 font-semibold' : ''
                        }`}>
                          {isUnassigned ? '⚠️ Unassigned' : staffName(shift.staff_profiles)}
                        </span>
                        {note && (
                          <span className={`ml-auto ${ NOTE_STATUS_CLS[note.status] ?? 'text-gray-300'}`}>
                            {note.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Onboarding stall alert */}
        {onboarding && onboarding.summary.stalled_count > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between">
            <p className="text-xs font-semibold text-amber-800">
              {onboarding.summary.stalled_count} stalled in onboarding
            </p>
            <a href="/admin/onboarding?stage=in_progress" className="text-xs font-medium text-amber-700">Review →</a>
          </div>
        )}

        {/* Pilot analytics mini strip */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Pilot · 30 days</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              { label: 'Onboarding',   value: `${onboardingPct}%`,    colour: onboardingPct >= 80 ? 'text-green-600' : 'text-amber-600' },
              { label: 'Portal logins',value: `${inviteSuccessPct}%`, colour: inviteSuccessPct >= 80 ? 'text-green-600' : 'text-amber-600' },
              { label: 'Acceptance',   value: `${acceptancePct}%`,    colour: acceptancePct >= 80 ? 'text-green-600' : 'text-amber-600' },
              { label: 'Completion',   value: `${completionPct}%`,    colour: completionPct >= 80 ? 'text-green-600' : 'text-amber-600' },
            ] as { label: string; value: string; colour: string }[]).map(({ label, value, colour }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-100 px-3 py-3">
                <p className={`text-xl font-extrabold tabular-nums ${colour}`}>{value}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Desktop header (hidden on mobile) ─────────────────────────────── */}
      <div className="hidden lg:flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">{fmt(today)} · Care OS Operations</p>
        </div>
      </div>

      {/* ── Desktop-only summary grids (hidden on mobile) ─────────────────── */}
      <div className="hidden lg:block space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          label="Non-compliant staff"
          count={nonCompliant}
          sub="Missing or expired docs"
          href="/admin/compliance?filter=non_compliant"
          urgent
        />
        <SummaryCard
          label="Expired documents"
          count={expiredCount}
          sub="Require immediate action"
          href="/admin/compliance"
          urgent
        />
        <SummaryCard
          label="Expiring within 30 days"
          count={expiringSoon}
          sub="Needs renewal soon"
          href="/admin/compliance?filter=expiring30d"
          urgent={expiringSoon > 0}
        />
        <SummaryCard
          label="Active staff"
          count={activeStaff}
          sub="Currently employed"
          href="/admin/staff"
        />
      </div>

      {/* ── Compliance widgets row 2 ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          label="Expiring this week"
          count={expiring7d}
          sub="Documents expiring ≤7 days"
          href="/admin/compliance?filter=expiring7d"
          urgent={expiring7d > 0}
        />
        <SummaryCard
          label="Pending cert reviews"
          count={pendingCerts}
          sub="Training certs awaiting approval"
          href="/admin/staff"
          urgent={pendingCerts > 0}
        />
        <SummaryCard
          label="Approved this week"
          count={recentlyApproved}
          sub="Training certs approved last 7d"
          href="/admin/compliance"
        />
        <SummaryCard
          label="HR incomplete"
          count={hrIncomplete}
          sub="Missing payroll or personal info"
          href="/admin/onboarding"
          urgent={hrIncomplete > 0}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <SummaryCard
          label="Open shifts"
          count={openShifts}
          sub="Unassigned, need staff"
          href="/admin/shifts/open"
          urgent
        />
        <SummaryCard
          label="Active clients"
          count={activeClients}
          sub="Receiving care"
          href="/admin/clients"
        />
        <SummaryCard
          label="Active care packages"
          count={activePkgs}
          sub="In service"
          href="/admin/care-packages"
        />
        <SummaryCard
          label="Draft visit notes"
          count={draftNotes}
          sub="Awaiting submission"
          href="/admin/visit-notes"
          urgent={draftNotes > 0}
        />
        <SummaryCard
          label="Notifications today"
          count={notifToday}
          sub={notifFailed > 0 ? `${notifFailed} failed — check logs` : 'Sent successfully'}
          href="/admin/notifications"
          urgent={notifFailed > 0}
        />
      </div>
      </div>

      {/* ── Desktop: onboarding overview ──────────────────────────────────── */}
      <div className="hidden lg:block">
      {onboarding && (
        <>
          {onboarding.summary.stalled_count > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-base">⏰</span>
                <p className="text-sm font-semibold text-amber-800">
                  {onboarding.summary.stalled_count} worker{onboarding.summary.stalled_count !== 1 ? 's' : ''} stalled in onboarding — in progress for 7+ days
                </p>
              </div>
              <Link href="/admin/onboarding?stage=in_progress" className="text-xs font-medium text-amber-700 hover:text-amber-900 whitespace-nowrap">
                Review →
              </Link>
            </div>
          )}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-700">Onboarding Overview</h2>
              <Link href="/admin/onboarding" className="text-xs text-indigo-600 hover:underline">View queue →</Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <SummaryCard
                label="In progress"
                count={onboarding.summary.in_progress}
                sub="Actively onboarding"
                href="/admin/onboarding?stage=in_progress"
              />
              <SummaryCard
                label="Awaiting review"
                count={onboarding.summary.awaiting_review}
                sub="Docs need review"
                href="/admin/onboarding?stage=awaiting_review"
                urgent={onboarding.summary.awaiting_review > 0}
              />
              <SummaryCard
                label="Stalled"
                count={onboarding.summary.stalled_count}
                sub="No movement 7+ days"
                href="/admin/onboarding?stage=in_progress"
                urgent={onboarding.summary.stalled_count > 0}
              />
              <SummaryCard
                label="Payroll ready"
                count={onboarding.summary.payroll_ready}
                sub="All payroll info complete"
                href="/admin/onboarding"
              />
            </div>
          </div>
        </>
      )}
      </div>

      {/* ── Desktop: ops alerts ───────────────────────────────────────────── */}
      <div className="hidden lg:block">
      {(opsAlerts > 0 || unacknowledged > 0) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3.5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-base">⚠</span>
              <p className="text-sm font-semibold text-amber-800">Rota action required</p>
            </div>
            <a href="/admin/shifts/operations" className="text-xs text-amber-700 font-medium hover:underline whitespace-nowrap">
              View Shift Ops →
            </a>
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-amber-700">
            {declinedShifts > 0 && (
              <span>
                <strong className="font-semibold">{declinedShifts}</strong> shift{declinedShifts !== 1 ? 's' : ''} declined
              </span>
            )}
            {runningLate > 0 && (
              <span>
                <strong className="font-semibold">{runningLate}</strong> worker{runningLate !== 1 ? 's' : ''} running late today
              </span>
            )}
            {unacknowledged > 0 && (
              <span>
                <strong className="font-semibold">{unacknowledged}</strong> shift{unacknowledged !== 1 ? 's' : ''} without a worker response
              </span>
            )}
          </div>
        </div>
      )}
      </div>

      {/* ── Desktop: main content grid ────────────────────────────────────── */}
      <div className="hidden lg:block">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* LEFT — Today's shifts + Incidents */}
        <div className="lg:col-span-2 space-y-5">

          {/* Today's shifts */}
          <SectionBox
            title={`Today's Shifts${todayShifts.length > 0 ? ` · ${todayShifts.length} shown` : ''}`}
            action={
              <Link href="/admin/shifts" className="text-xs text-indigo-600 hover:underline">
                View all shifts →
              </Link>
            }
          >
            {todayShifts.length === 0 ? (
              <Empty msg="No shifts scheduled for today." />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm divide-y divide-gray-100">
                  <thead>
                    <tr className="text-xs text-gray-500 font-medium bg-gray-50">
                      <th className="px-4 py-2 text-left">Time</th>
                      <th className="px-4 py-2 text-left">Client</th>
                      <th className="px-4 py-2 text-left">Staff</th>
                      <th className="px-4 py-2 text-left">Care package</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-left">Visit note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {todayShifts.map((shift) => {
                      const isUnassigned = !shift.assigned_staff_id
                      const isCancelled  = shift.status === 'cancelled'
                      const note         = shift.visit_notes?.[0] ?? null
                      const rowCls = isCancelled
                        ? 'bg-red-50/40'
                        : isUnassigned
                        ? 'bg-amber-50/50'
                        : ''

                      return (
                        <tr key={shift.id} className={`${rowCls} hover:bg-gray-50 transition-colors`}>
                          <td className="px-4 py-2.5 whitespace-nowrap tabular-nums text-gray-700 text-xs font-medium">
                            {fmtTime(shift.start_time)}–{fmtTime(shift.end_time)}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            {shift.clients ? (
                              <Link
                                href={`/admin/clients/${shift.clients.id}`}
                                className="text-indigo-700 hover:underline text-xs font-medium"
                              >
                                {shift.clients.first_name} {shift.clients.last_name}
                              </Link>
                            ) : (
                              <span className="text-xs text-gray-400">{shift.client_name ?? '—'}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-xs">
                            {isUnassigned ? (
                              <span className="font-medium text-amber-700">Unassigned</span>
                            ) : (
                              <span className="text-gray-700">{staffName(shift.staff_profiles)}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-500 max-w-[120px] truncate">
                            {shift.care_packages?.title ?? '—'}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${SHIFT_STATUS_CLS[shift.status] ?? 'bg-gray-50 text-gray-600'}`}>
                              {shift.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-xs">
                            {note ? (
                              <Link
                                href={`/admin/visit-notes/${note.id}`}
                                className={`hover:underline font-medium ${NOTE_STATUS_CLS[note.status] ?? 'text-gray-400'}`}
                              >
                                {note.status}
                              </Link>
                            ) : (
                              <span className="text-gray-300">none</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {unassignedToday > 0 && (
                  <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 text-xs text-amber-700">
                    {unassignedToday} shift{unassignedToday !== 1 ? 's' : ''} still unassigned today —{' '}
                    <Link href="/admin/shifts/open" className="font-medium underline">
                      view open shifts
                    </Link>
                  </div>
                )}
              </div>
            )}
          </SectionBox>

          {/* Recent incidents */}
          <SectionBox
            title="Recent Incidents"
            action={
              <Link href="/admin/incidents" className="text-xs text-indigo-600 hover:underline">
                View all incidents →
              </Link>
            }
          >
            {incidents.length === 0 ? (
              <Empty msg="No open incidents." />
            ) : (
              <div className="divide-y divide-gray-50">
                {incidents.map((inc) => (
                  <div key={inc.id} className="px-4 py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className={`inline-flex rounded-md px-1.5 py-0.5 text-xs font-medium ${INCIDENT_SEVERITY_CLS[inc.severity] ?? 'bg-gray-50 text-gray-600'}`}>
                          {inc.severity}
                        </span>
                        <span>·</span>
                        <span>{inc.incident_type.replace(/_/g, ' ')}</span>
                        <span>·</span>
                        <span>{inc.occurred_at ? fmt(inc.occurred_at) : fmt(inc.created_at)}</span>
                      </div>
                      <p className="text-xs text-gray-700 mt-0.5 truncate">
                        Client: {inc.clients ? `${inc.clients.first_name} ${inc.clients.last_name}` : '—'}
                        {' · '}
                        Staff: {staffName(inc.staff_profiles)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${INCIDENT_STATUS_CLS[inc.status] ?? 'bg-gray-50 text-gray-500'}`}>
                        {inc.status.replace(/_/g, ' ')}
                      </span>
                      <Link href={`/admin/incidents/${inc.id}`} className="text-xs text-indigo-600 hover:underline">
                        View →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionBox>

        </div>

        {/* RIGHT — Quick actions + Compliance */}
        <div className="space-y-5">

          {/* Quick actions */}
          <SectionBox title="Quick Actions">
            <div className="p-3 grid grid-cols-2 gap-2">
              {[
                { label: 'Onboarding Queue',       href: '/admin/onboarding' },
                { label: 'Create Shift',           href: '/admin/shifts' },
                { label: 'Add Client',             href: '/admin/clients' },
                { label: 'Create Care Package',    href: '/admin/care-packages' },
                { label: 'Invite Applicant',       href: '/admin/applicants' },
                { label: 'Compliance Dashboard',   href: '/admin/compliance' },
              ].map((a) => (
                <Link
                  key={a.href + a.label}
                  href={a.href}
                  className="rounded-md bg-gray-50 border border-gray-200 px-3 py-2.5 text-xs font-medium text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition-colors text-center"
                >
                  {a.label}
                </Link>
              ))}
            </div>
          </SectionBox>

          {/* Compliance alerts top 5 */}
          <SectionBox
            title="Compliance Alerts"
            action={
              <Link href="/admin/compliance" className="text-xs text-indigo-600 hover:underline">
                Open dashboard →
              </Link>
            }
          >
            {topAlerts.length === 0 ? (
              <div className="px-4 py-5 text-center">
                <p className="text-sm text-green-600 font-medium">All staff compliant</p>
                <p className="text-xs text-gray-400 mt-0.5">No active alerts</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {topAlerts.map((alert, i) => (
                  <div
                    key={`alert-${i}`}
                    className={`px-3 py-2.5 flex items-center justify-between gap-2 border-l-2 ${
                      alert.severity === 'expired'
                        ? 'border-l-red-400 bg-red-50/30'
                        : alert.severity === 'warning'
                        ? 'border-l-orange-400 bg-orange-50/30'
                        : 'border-l-yellow-400 bg-yellow-50/20'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{alert.staffName}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {alert.documentType.replace(/_/g, ' ')}
                        {alert.expiryDate ? ` · ${fmt(alert.expiryDate)}` : ''}
                      </p>
                    </div>
                    <Link
                      href={`/admin/staff/${alert.staffId}`}
                      className="text-xs text-indigo-600 hover:underline flex-shrink-0"
                    >
                      View →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </SectionBox>

        </div>
      </div>
      </div>

      {/* ── Audit log + Pilot (desktop only) ─────────────────────────────── */}
      <div className="hidden lg:block space-y-5">
      <SectionBox
        title="Recent Activity"
        action={
          <Link href="/admin/audit-log" className="text-xs text-indigo-600 hover:underline">
            Full audit log →
          </Link>
        }
      >
        {auditEntries.length === 0 ? (
          <Empty msg="No audit events yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr className="text-gray-500 font-medium">
                  <th className="px-4 py-2 text-left whitespace-nowrap">Time</th>
                  <th className="px-4 py-2 text-left">Event</th>
                  <th className="px-4 py-2 text-left">Entity</th>
                  <th className="px-4 py-2 text-left hidden md:table-cell">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {auditEntries.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2 whitespace-nowrap tabular-nums text-gray-400">
                      {fmtTs(e.created_at)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className={`inline-flex rounded-md px-1.5 py-0.5 text-xs font-medium ${auditActionCls(e.action)}`}>
                        {e.action}
                      </span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-gray-500">
                      {e.entity_type ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-gray-400 max-w-[260px] truncate hidden md:table-cell">
                      {metaPreview(e.metadata)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionBox>

      {/* ── Pilot Analytics ─────────────────────────────────────────── */}
      <SectionBox
        title="Pilot Analytics · Last 30 days"
        action={
          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-600/20">
            PILOT
          </span>
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-100">
          {([
            { label: 'Onboarding completion', value: `${onboardingPct}%`,    sub: `${pilotOnboarded} / ${pilotTotalStaff} staff`,          colour: onboardingPct   === 100 ? 'text-green-600' : onboardingPct   > 50 ? 'text-amber-600' : 'text-red-600' },
            { label: 'Invite → portal login',  value: `${inviteSuccessPct}%`, sub: `${pilotInviteLogin} of ${pilotInvited} invited`,        colour: inviteSuccessPct === 100 ? 'text-green-600' : inviteSuccessPct > 50 ? 'text-amber-600' : 'text-red-600' },
            { label: 'Shift acceptance rate',  value: `${acceptancePct}%`,   sub: `${pilotAccepted} of ${pilotTotalAssigned} assigned`,      colour: acceptancePct   >=  80 ? 'text-green-600' : acceptancePct   > 50 ? 'text-amber-600' : 'text-red-600' },
            { label: 'Shift completion rate',  value: `${completionPct}%`,   sub: `${pilotCompleted} of ${pilotTotalAssigned} assigned`,     colour: completionPct   >=  80 ? 'text-green-600' : completionPct   > 50 ? 'text-amber-600' : 'text-red-600' },
          ] as { label: string; value: string; sub: string; colour: string }[]).map(({ label, value, sub, colour }) => (
            <div key={label} className="bg-white px-4 py-4">
              <p className="text-xs font-medium text-gray-500">{label}</p>
              <p className={`text-2xl font-bold tabular-nums mt-0.5 ${colour}`}>{value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      </SectionBox>

      </div>

    </div>
  )
}
