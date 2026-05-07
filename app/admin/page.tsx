import Link from 'next/link'
import { adminClient } from '@/lib/supabase/admin'
import type { AlertsResponse, AlertItem } from '@/app/api/admin/compliance/alerts/route'

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
  const [
    staffStatusResult,
    todayShiftsResult,
    openShiftsCountResult,
    clientCountResult,
    pkgCountResult,
    draftNotesCountResult,
    hrIncompleteResult,
    incidentsResult,
    complianceRes,
    auditRes,
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
    fetch(`${BASE}/api/admin/compliance/alerts`, { cache: 'no-store' }),

    // Audit log API (reuse existing, last 10)
    fetch(`${BASE}/api/admin/audit-log`, { cache: 'no-store' }),
  ])

  // Parse HTTP responses
  const compliance: AlertsResponse | null = complianceRes.ok
    ? (await complianceRes.json() as AlertsResponse)
    : null

  const auditEntries: AuditEntry[] = auditRes.ok
    ? ((await auditRes.json() as AuditEntry[]).slice(0, 10))
    : []

  // Derive summary numbers
  const allStaff      = staffStatusResult.data ?? []
  const activeStaff   = allStaff.filter((s) => s.status === 'active').length
  const openShifts    = openShiftsCountResult.count ?? 0
  const activeClients = clientCountResult.count     ?? 0
  const activePkgs    = pkgCountResult.count         ?? 0
  const draftNotes    = draftNotesCountResult.count  ?? 0
  const hrIncomplete  = hrIncompleteResult.count     ?? 0

  const nonCompliant    = compliance?.summary.nonCompliantCount ?? 0
  const expiredCount    = compliance?.summary.expiredCount      ?? 0
  const expiringSoon    = compliance?.summary.expiringWithin30  ?? 0

  // Top 5 compliance alerts (expired first, then expiring soon)
  const topAlerts: AlertItem[] = [
    ...(compliance?.expired      ?? []),
    ...(compliance?.expiringSoon ?? []),
  ].slice(0, 5)

  const todayShifts  = (todayShiftsResult.data  ?? []) as unknown as TodayShift[]
  const incidents    = (incidentsResult.data     ?? []) as unknown as Incident[]

  const unassignedToday = todayShifts.filter((s) => !s.assigned_staff_id).length

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">{fmt(today)} · Care OS Operations</p>
        </div>
      </div>

      {/* ── Summary cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          label="Active staff"
          count={activeStaff}
          sub="Currently employed"
          href="/admin/staff"
        />
        <SummaryCard
          label="Non-compliant staff"
          count={nonCompliant}
          sub="Missing or expired docs"
          href="/admin/compliance"
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
          href="/admin/compliance"
          urgent={expiringSoon > 0}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
          label="HR incomplete"
          count={hrIncomplete}
          sub="Missing payroll or personal info"
          href="/admin/staff"
          urgent={hrIncomplete > 0}
        />
      </div>

      {/* ── Main content: 2/3 + 1/3 ────────────────────────────────────────── */}
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
                { label: 'Create Shift',           href: '/admin/shifts' },
                { label: 'Add Client',             href: '/admin/clients' },
                { label: 'Create Care Package',    href: '/admin/care-packages' },
                { label: 'Invite Applicant',       href: '/admin/applicants' },
                { label: 'Add Existing Staff',     href: '/admin/staff' },
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

      {/* ── Audit log ───────────────────────────────────────────────────────── */}
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

    </div>
  )
}
