import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import type { AlertsResponse, AlertItem } from '@/app/api/admin/compliance/alerts/route'
import type { OnboardingResponse } from '@/app/api/admin/onboarding/route'
import { adminFetch } from '@/lib/admin/serverFetch'
import AdminDashboardDesktop from '@/components/admin/AdminDashboardDesktop'
import { fmtTime, staffName, settle } from '@/lib/utils/formatters'

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





const SHIFT_STATUS_CLS: Record<string, string> = {
  scheduled: 'bg-blue-50   text-blue-700',
  confirmed: 'bg-green-50  text-green-700',
  completed: 'bg-gray-50   text-on-surface-variant',
  cancelled: 'bg-red-50    text-red-600',
  no_show:   'bg-orange-50 text-orange-700',
}

const NOTE_STATUS_CLS: Record<string, string> = {
  draft:     'text-gray-400',
  submitted: 'text-green-600',
  locked:    'text-indigo-600',
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
  closed:        'bg-gray-50    text-on-surface-variant',
}



// ── Shared UI primitives ──────────────────────────────────────────────────────

function SectionBox({ title, children, action }: {
  title:    string
  children: React.ReactNode
  action?:  React.ReactNode
}) {
  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-sm dark:shadow-none overflow-hidden">
      <div className="px-6 py-5 flex items-center justify-between">
        <h2 className="text-base font-semibold text-on-surface tracking-tight">{title}</h2>
        {action}
      </div>
      <div className="px-6 pb-6">
        {children}
      </div>
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
          : 'bg-surface-container-lowest border-gray-200 text-primary',
      ].join(' ')}
    >
      <p className="text-xs font-medium text-on-surface-variant">{label}</p>
      <p className={`text-2xl font-bold tabular-nums mt-0.5 ${urgent && count > 0 ? 'text-red-700' : ''}`}>
        {count}
      </p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </Link>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let companyName = 'Care OS'
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('companies(name)')
      .eq('id', user.id)
      .maybeSingle()
    companyName = (profile?.companies as any)?.name ?? 'Care OS'
  }

  const today = new Date().toISOString().slice(0, 10)

  // All queries fire in parallel — no waterfalls
  const in14days = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const todayStart = `${today}T00:00:00.000Z`

  const results1 = await Promise.allSettled([
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

  const getValue = <T,>(idx: number, fallback: T): T =>
    results1[idx].status === 'fulfilled' ? (results1[idx] as PromiseFulfilledResult<any>).value : fallback

  const staffStatusResult      = getValue(0, { data: [] })
  const todayShiftsResult      = getValue(1, { data: [] })
  const openShiftsCountResult  = getValue(2, { count: 0 })
  const clientCountResult      = getValue(3, { count: 0 })
  const pkgCountResult         = getValue(4, { count: 0 })
  const draftNotesCountResult  = getValue(5, { count: 0 })
  const hrIncompleteResult     = getValue(6, { count: 0 })
  const declinedShiftsResult   = getValue(7, { count: 0 })
  const runningLateResult      = getValue(8, { count: 0 })
  const unacknowledgedResult   = getValue(9, { count: 0 })
  const notifFailedResult      = getValue(10, { count: 0 })
  const notifTodayResult       = getValue(11, { count: 0 })
  const incidentsResult        = getValue(12, { data: [] })
  const complianceRes          = getValue(13, { ok: false, json: async () => null }) as any
  const onboardingRes          = getValue(14, { ok: false, json: async () => null }) as any
  const pendingCertsResult     = getValue(15, { count: 0 })
  const recentlyApprovedResult = getValue(16, { count: 0 })
  const expiring7dResult       = getValue(17, { count: 0 })

  // Parse HTTP responses
  const compliance: AlertsResponse | null = complianceRes.ok
    ? (await complianceRes.json() as AlertsResponse)
    : null

  const onboarding: OnboardingResponse | null = onboardingRes.ok
    ? (await onboardingRes.json() as OnboardingResponse)
    : null

  // Derive summary numbers
  const allStaff      = staffStatusResult.data ?? []
  const activeStaff   = allStaff.filter((s: any) => s.status === 'active').length
  const openShifts    = openShiftsCountResult.count ?? 0
  const activeClients = clientCountResult.count     ?? 0
  const draftNotes    = draftNotesCountResult.count  ?? 0
  const hrIncomplete      = hrIncompleteResult.count      ?? 0
  const declinedShifts    = declinedShiftsResult.count    ?? 0
  const runningLate       = runningLateResult.count       ?? 0
  const unacknowledged    = unacknowledgedResult.count    ?? 0
  const opsAlerts         = declinedShifts + runningLate

  const nonCompliant    = compliance?.summary.nonCompliantCount ?? 0
  const pendingCerts    = pendingCertsResult.count              ?? 0
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
  const results2 = await Promise.allSettled([
    adminClient.from('staff_profiles').select('id', { count: 'exact', head: true }).not('status', 'eq', 'terminated'),
    adminClient.from('staff_profiles').select('id', { count: 'exact', head: true }).eq('onboarding_completed', true),
    adminClient.from('staff_profiles').select('id', { count: 'exact', head: true }).not('portal_invite_sent_at', 'is', null),
    adminClient.from('staff_profiles').select('id', { count: 'exact', head: true }).not('portal_last_login_at', 'is', null),
    adminClient.from('shifts').select('id', { count: 'exact', head: true }).eq('worker_ack_status', 'accepted').gte('shift_date', analyticsWindow),
    adminClient.from('shifts').select('id', { count: 'exact', head: true }).eq('status', 'completed').gte('shift_date', analyticsWindow),
    adminClient.from('shifts').select('id', { count: 'exact', head: true }).not('assigned_staff_id', 'is', null).gte('shift_date', analyticsWindow),
  ])

  const getValue2 = <T,>(idx: number, fallback: T): T =>
    results2[idx].status === 'fulfilled' ? (results2[idx] as PromiseFulfilledResult<any>).value : fallback

  const pilotTotalStaff     = getValue2(0, { count: 0 }).count ?? 0
  const pilotOnboarded      = getValue2(1, { count: 0 }).count ?? 0
  const pilotInvited        = getValue2(2, { count: 0 }).count ?? 0
  const pilotInviteLogin    = getValue2(3, { count: 0 }).count ?? 0
  const pilotAccepted       = getValue2(4, { count: 0 }).count ?? 0
  const pilotCompleted      = getValue2(5, { count: 0 }).count ?? 0
  const pilotTotalAssigned  = getValue2(6, { count: 0 }).count ?? 0

  const onboardingPct   = pilotTotalStaff     > 0 ? Math.round((pilotOnboarded  / pilotTotalStaff)      * 100) : 0
  const inviteSuccessPct = pilotInvited       > 0 ? Math.round((pilotInviteLogin / pilotInvited)        * 100) : 0
  const acceptancePct   = pilotTotalAssigned  > 0 ? Math.round((pilotAccepted   / pilotTotalAssigned)   * 100) : 0
  const completionPct   = pilotTotalAssigned  > 0 ? Math.round((pilotCompleted  / pilotTotalAssigned)   * 100) : 0

  return (
    <div className="space-y-6">

      {/* ── Mobile hero (lg:hidden) ────────────────────────────────────────── */}
      <div className="lg:hidden space-y-6">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-secondary">grid_view</span>
          <h3 className="font-headline-lg text-headline-lg text-primary">The Hub</h3>
        </div>

        {/* Hero triage card */}
        <div className="bg-surface-container-lowest rounded-lg p-0 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border border-outline-variant overflow-hidden flex flex-col gap-0">
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
            <a href="/admin/shifts/operations" className="flex items-center justify-between px-4 py-2.5 bg-error-container">
              <p className="text-xs font-semibold text-on-error-container">
                {declinedShifts > 0 && `${declinedShifts} declined`}
                {declinedShifts > 0 && runningLate > 0 && ' · '}
                {runningLate > 0 && `${runningLate} running late`}
                {unacknowledged > 0 && ` · ${unacknowledged} unacknowledged`}
              </p>
              <span className="text-xs text-on-error-container font-medium">Ops →</span>
            </a>
          )}
        </div>

        {/* Horizontal metrics strip */}
        <div className="-mx-4 px-4 overflow-x-auto flex gap-3 pb-2" style={{ scrollbarWidth: 'none' }}>
          {[
            { label: 'Staff',      value: activeStaff,    href: '/admin/staff',       tint: '' },
            { label: 'Clients',    value: activeClients,  href: '/admin/clients',     tint: '' },
            { label: 'Expiring',   value: expiring7d,     href: '/admin/compliance',  tint: expiring7d > 0 ? 'bg-orange-50 border-orange-200 text-orange-700' : '' },
            { label: 'HR gaps',    value: hrIncomplete,   href: '/admin/onboarding',  tint: hrIncomplete > 0 ? 'bg-error-container border-red-200 text-on-error-container' : '' },
            { label: 'Certs',      value: pendingCerts,   href: '/admin/staff',       tint: pendingCerts > 0 ? 'bg-tertiary-fixed border-amber-200 text-on-tertiary-fixed' : '' },
            { label: 'Draft notes',value: draftNotes,     href: '/admin/visit-notes', tint: draftNotes > 0 ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : '' },
          ].map(({ label, value, href, tint }) => (
            <a
              key={label}
              href={href}
              className={`flex-shrink-0 rounded-lg border p-card-padding min-w-[120px] text-center shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] ${
                tint || 'bg-surface-container-lowest border-outline-variant text-primary'
              }`}
            >
              <p className="font-display-lg text-display-lg tabular-nums">{value}</p>
              <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">{label}</p>
            </a>
          ))}
        </div>

        {/* Today’s shifts — mobile card list */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-headline-md text-headline-md text-primary">Today’s Shifts</h4>
            <a href="/admin/shifts" className="text-body-md font-body-md text-secondary hover:underline">View all →</a>
          </div>
          {todayShifts.length === 0 ? (
            <div className="bg-surface-container-lowest rounded-lg border border-outline-variant p-card-padding text-center text-body-md text-on-surface-variant">
              No shifts today.
            </div>
          ) : (
            <div className="space-y-4">
              {todayShifts.map((shift) => {
                const isUnassigned = !shift.assigned_staff_id
                const note = shift.visit_notes?.[0] ?? null
                return (
                  <div
                    key={shift.id}
                    className={`bg-surface-container-lowest rounded-lg shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border overflow-hidden ${
                      isUnassigned ? 'border-amber-300' : 'border-outline-variant'
                    }`}
                  >
                    <div className={`flex items-center justify-between px-4 py-2 border-b ${
                      isUnassigned ? 'bg-amber-50 border-amber-100' : 'bg-gray-50 border-gray-50'
                    }`}>
                      <span className="text-xs font-semibold tabular-nums text-gray-700">
                        {fmtTime(shift.start_time)}–{fmtTime(shift.end_time)}
                      </span>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        SHIFT_STATUS_CLS[shift.status] ?? 'bg-gray-50 text-on-surface-variant'
                      }`}>
                        {shift.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="px-4 py-2.5">
                      <p className="text-sm font-medium text-primary truncate">{shift.title}</p>
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
          <div className="rounded-lg bg-error-container px-4 py-3 flex items-center justify-between">
            <p className="text-xs font-semibold text-on-error-container">
              {onboarding.summary.stalled_count} stalled in onboarding
            </p>
            <a href="/admin/onboarding?stage=in_progress" className="text-xs font-medium text-on-error-container hover:underline">Review →</a>
          </div>
        )}

        {/* Pilot analytics mini strip */}
        <details className="group mt-8 bg-surface-container-low rounded-lg">
          <summary className="flex items-center justify-between px-4 py-4 cursor-pointer list-none">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-secondary">analytics</span>
              <h4 className="font-headline-md text-headline-md text-primary">Pilot · 30 days</h4>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant group-open:rotate-180 transition-transform">expand_more</span>
          </summary>
          <div className="grid grid-cols-2 gap-4 px-4 pb-4 pt-2">
            {([
              { label: 'Onboarding',   value: `${onboardingPct}%`,    colour: onboardingPct >= 80 ? 'text-green-600' : 'text-amber-600' },
              { label: 'Portal logins',value: `${inviteSuccessPct}%`, colour: inviteSuccessPct >= 80 ? 'text-green-600' : 'text-amber-600' },
              { label: 'Acceptance',   value: `${acceptancePct}%`,    colour: acceptancePct >= 80 ? 'text-green-600' : 'text-amber-600' },
              { label: 'Completion',   value: `${completionPct}%`,    colour: completionPct >= 80 ? 'text-green-600' : 'text-amber-600' },
            ] as { label: string; value: string; colour: string }[]).map(({ label, value, colour }) => (
              <div key={label} className="bg-surface-container-lowest rounded-lg shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] p-card-padding">
                <p className={`font-headline-lg text-headline-lg tabular-nums ${colour}`}>{value}</p>
                <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </details>
      </div>

      {/* ── Desktop command center (lg+) ─────────────────────────────────── */}
      <div className="hidden lg:block">
        <AdminDashboardDesktop
          openShifts={openShifts}
          nonCompliant={nonCompliant}
          activeIncidents={incidents.length}
          activeStaff={activeStaff}
          activeClients={activeClients}
          declinedShifts={declinedShifts}
          runningLate={runningLate}
          unacknowledged={unacknowledged}
          hrIncomplete={hrIncomplete}
          expiring7d={expiring7d}
          draftNotes={draftNotes}
          todayShifts={todayShifts}
          incidents={incidents}
          topAlerts={topAlerts}

          onboardingPct={onboardingPct}
          inviteSuccessPct={inviteSuccessPct}
          acceptancePct={acceptancePct}
          completionPct={completionPct}
          pilotOnboarded={pilotOnboarded}
          pilotTotalStaff={pilotTotalStaff}
          pilotInviteLogin={pilotInviteLogin}
          pilotInvited={pilotInvited}
          pilotAccepted={pilotAccepted}
          pilotCompleted={pilotCompleted}
          pilotTotalAssigned={pilotTotalAssigned}
          today={today}
          unassignedToday={unassignedToday}
          companyName={companyName}
        />
      </div>

    </div>
  )
}
