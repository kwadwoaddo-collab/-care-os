'use client'

import Link from 'next/link'
import Icon from '@/components/ui/Icon'

// ── Types ──────────────────────────────────────────────────────────────────────

interface TodayShift {
  id: string
  title: string
  start_time: string
  end_time: string
  status: string
  assigned_staff_id: string | null
  client_name: string | null
  staff_profiles: { first_name: string | null; last_name: string | null } | null
  clients: { id: string; first_name: string; last_name: string } | null
  care_packages: { title: string } | null
  visit_notes: { id: string; status: string }[]
}

interface Incident {
  id: string
  incident_type: string
  severity: string
  status: string
  occurred_at: string | null
  created_at: string
  description: string
  clients: { first_name: string; last_name: string } | null
  staff_profiles: { first_name: string | null; last_name: string | null } | null
}

interface AlertItem {
  staffId: string
  staffName: string
  documentType: string
  expiryDate: string | null
  severity: string
}

interface AuditEntry {
  id: string
  created_at: string
  action: string
  actor_id: string | null
  entity_type: string | null
  entity_id: string | null
  metadata: Record<string, unknown> | null
}

interface Props {
  // KPI counts
  openShifts: number
  nonCompliant: number
  activeIncidents: number
  activeStaff: number
  activeClients: number
  declinedShifts: number
  runningLate: number
  unacknowledged: number
  hrIncomplete: number
  expiring7d: number
  draftNotes: number
  // Data
  todayShifts: TodayShift[]
  incidents: Incident[]
  topAlerts: AlertItem[]
  auditEntries: AuditEntry[]
  // Pilot
  onboardingPct: number
  inviteSuccessPct: number
  acceptancePct: number
  completionPct: number
  pilotOnboarded: number
  pilotTotalStaff: number
  pilotInviteLogin: number
  pilotInvited: number
  pilotAccepted: number
  pilotCompleted: number
  pilotTotalAssigned: number
  // Misc
  today: string
  unassignedToday: number
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtTime(t: string) { return t.slice(0, 5) }
function staffName(p: { first_name: string | null; last_name: string | null } | null) {
  if (!p) return '—'
  return [p.first_name, p.last_name].filter(Boolean).join(' ') || '—'
}

const SHIFT_STATUS: Record<string, string> = {
  scheduled: 'bg-blue-50 text-blue-700',
  confirmed:  'bg-green-50 text-green-700',
  completed:  'bg-gray-50 text-gray-500',
  cancelled:  'bg-red-50 text-red-600',
  no_show:    'bg-orange-50 text-orange-700',
}
const SEVERITY_BORDER: Record<string, string> = {
  low:      'border-l-gray-300',
  medium:   'border-l-yellow-400',
  high:     'border-l-orange-500',
  critical: 'border-l-red-600',
}
const SEVERITY_BADGE: Record<string, string> = {
  low:      'bg-gray-100 text-gray-700',
  medium:   'bg-amber-100 text-amber-800',
  high:     'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
}
const STATUS_BADGE: Record<string, string> = {
  open:          'bg-red-100 text-red-800',
  investigating: 'bg-blue-100 text-blue-800',
  resolved:      'bg-green-100 text-green-800',
  closed:        'bg-gray-100 text-gray-600',
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-surface-container-lowest rounded-xl border border-outline-variant/60 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] transition-all duration-300 hover:shadow-md hover:scale-[1.005] hover:border-outline-variant ${className}`}>
      {children}
    </div>
  )
}

function CardHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/30">
      <h2 className="text-sm font-semibold text-on-surface">{title}</h2>
      {action}
    </div>
  )
}

function CommandMetric({ title, count, sub, variant }: { title: string; count: number | string; sub: string; variant: 'urgent' | 'warning' | 'neutral' | 'success' }) {
  const borders = {
    urgent: 'border-l-red-600',
    warning: 'border-l-amber-500',
    neutral: 'border-l-outline-variant',
    success: 'border-l-indigo-600 dark:border-l-indigo-400',
  }
  const textColors = {
    urgent: 'text-red-600 dark:text-red-400',
    warning: 'text-amber-600 dark:text-amber-400',
    neutral: 'text-on-surface',
    success: 'text-indigo-600 dark:text-indigo-400',
  }
  return (
    <div className={`bg-surface-container-lowest p-6 rounded-xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border-l-4 ${borders[variant]} transition-all duration-300 hover:shadow-md hover:scale-[1.01] hover:border-outline-variant/40`}>
      <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">{title}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={`text-4xl font-extrabold ${textColors[variant]}`}>{count}</span>
        <span className="text-sm font-medium text-on-surface-variant">{sub}</span>
      </div>
    </div>
  )
}

function QuickAction({ icon, title, subtitle, href, iconColor, bg }: { icon: string; title: string; subtitle: string; href: string; iconColor: string; bg: string }) {
  return (
    <Link href={href} className="w-full flex items-center gap-4 p-4 rounded-xl border border-outline-variant/60 hover:border-indigo-300 hover:bg-indigo-50/10 dark:hover:bg-indigo-950/10 hover:scale-[1.02] transition-all duration-300 text-left group">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${bg} ${iconColor} transition-transform duration-300 group-hover:scale-110`}>
        <Icon name={icon} size="md" fill />
      </div>
      <div>
        <p className="text-sm font-semibold text-on-surface">{title}</p>
        <p className="text-xs text-on-surface-variant">{subtitle}</p>
      </div>
    </Link>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AdminDashboardDesktop({
  openShifts, nonCompliant, activeIncidents, activeStaff,
  declinedShifts, runningLate, unacknowledged, expiring7d,
  todayShifts, incidents, topAlerts,
  onboardingPct, inviteSuccessPct, acceptancePct, completionPct,
  pilotOnboarded, pilotTotalStaff, pilotInviteLogin, pilotInvited,
  pilotAccepted, pilotCompleted, pilotTotalAssigned,
  unassignedToday,
}: Props) {
  const opsAlerts = declinedShifts + runningLate

  return (
    <div className="space-y-6">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-on-surface" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>
            Dashboard
          </h1>
          <p className="text-sm text-on-surface-variant mt-0.5 border-l-2 border-outline-variant pl-3">
            Care Center North
          </p>
        </div>
      </div>

      {/* ── Ops alert banner ─────────────────────────────────────────────── */}
      {(opsAlerts > 0 || unacknowledged > 0) && (
        <div className="rounded-xl bg-red-500/10 border border-red-200/30 px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span
              className="material-symbols-outlined text-red-600 dark:text-red-400 overflow-hidden"
              style={{ fontSize: '20px', width: '20px', height: '20px', lineHeight: '20px', display: 'block', flexShrink: 0 }}
            >warning</span>
            <div>
              <p className="text-sm font-semibold text-red-800 dark:text-red-300">Rota action required</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                {declinedShifts > 0 && `${declinedShifts} declined`}
                {declinedShifts > 0 && runningLate > 0 && ' · '}
                {runningLate > 0 && `${runningLate} running late`}
                {unacknowledged > 0 && ` · ${unacknowledged} unacknowledged`}
              </p>
            </div>
          </div>
          <Link href="/admin/shifts/operations" className="text-xs font-semibold text-red-700 dark:text-red-400 hover:underline whitespace-nowrap">
            View Shift Ops →
          </Link>
        </div>
      )}

      {/* ── Command Center Header: High-level Metrics ─────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <CommandMetric
          title="Unassigned Shifts"
          count={openShifts}
          sub="Next 24h"
          variant={openShifts > 0 ? 'urgent' : 'success'}
        />
        <CommandMetric
          title="Urgent Incidents"
          count={activeIncidents}
          sub="Pending review"
          variant={activeIncidents > 0 ? 'urgent' : 'success'}
        />
        <CommandMetric
          title="Compliance Gaps"
          count={nonCompliant + expiring7d}
          sub="Expiring soon"
          variant={(nonCompliant + expiring7d) > 0 ? 'warning' : 'success'}
        />
        <CommandMetric
          title="Staff Coverage"
          count={`${activeStaff}`}
          sub="Active staff"
          variant="success"
        />
      </div>

      {/* ── Main 2+1 grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT col (spans 8) */}
        <div className="lg:col-span-8 space-y-6">

          {/* Today's Shifts */}
          <Card>
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/30">
              <h3 className="text-xl font-bold text-on-surface" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>Critical Shifts: Today</h3>
              <Link href="/admin/shifts" className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">
                View all shifts →
              </Link>
            </div>
            <div className="divide-y divide-outline-variant/30">
              {todayShifts.length === 0 ? (
                <p className="text-center text-sm text-on-surface-variant py-8">No shifts scheduled for today.</p>
              ) : (
                todayShifts.map((shift) => {
                  const isUnassigned = !shift.assigned_staff_id
                  const dateObj = new Date(shift.start_time)
                  const day = dateObj.getDate()
                  const monthStr = dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase()
                  
                  return (
                    <div key={shift.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-surface-container-low transition-colors">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`w-12 h-12 shrink-0 rounded-lg flex flex-col items-center justify-center ${isUnassigned ? 'bg-red-500/10 text-red-700 dark:text-red-400' : 'bg-surface-container-high text-on-surface-variant'}`}>
                          <span className="text-[10px] font-bold leading-none">{monthStr}</span>
                          <span className="font-bold text-lg leading-tight mt-0.5">{day}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-on-surface truncate">
                            {shift.care_packages?.title ?? 'General Care'}
                          </p>
                          <p className="text-xs text-on-surface-variant mt-0.5">
                            {fmtTime(shift.start_time)} – {fmtTime(shift.end_time)} · {shift.clients ? `${shift.clients.first_name} ${shift.clients.last_name}` : shift.client_name ?? '—'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 sm:pl-4">
                        {isUnassigned ? (
                          <>
                            <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 text-[10px] font-bold uppercase tracking-wide">Unassigned</span>
                            <Link href="/admin/shifts/open" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors">Assign Staff</Link>
                          </>
                        ) : (
                          <>
                            <span className={`hidden sm:inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${SHIFT_STATUS[shift.status] ?? 'bg-surface-container-high text-on-surface-variant'}`}>
                              {shift.status.replace(/_/g, ' ')}
                            </span>
                            <Link href={`/admin/shifts/${shift.id}`} className="bg-surface-container-high text-on-surface px-4 py-2 rounded-lg text-xs font-semibold hover:bg-surface-container-highest transition-colors">Review</Link>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
              {unassignedToday > 0 && (
                <div className="px-5 py-4 bg-red-500/10 flex justify-between items-center">
                  <p className="text-xs font-medium text-red-800 dark:text-red-300">
                    {unassignedToday} shift{unassignedToday !== 1 ? 's' : ''} still unassigned today.
                  </p>
                  <Link href="/admin/shifts/open" className="text-xs font-semibold text-red-700 dark:text-red-400 hover:underline">Resolve now →</Link>
                </div>
              )}
            </div>
          </Card>

          {/* Recent Incidents */}
          <Card>
            <CardHeader
              title="Recent Incidents"
              action={
                <Link href="/admin/incidents" className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
                  View all incidents →
                </Link>
              }
            />
            <div className="divide-y divide-outline-variant/30">
              {incidents.length === 0 ? (
                <p className="text-center text-sm text-on-surface-variant py-8">No open incidents.</p>
              ) : incidents.map((inc) => (
                <div key={inc.id} className={`flex items-center gap-4 px-6 py-3.5 border-l-4 hover:bg-surface-container-low transition-colors ${SEVERITY_BORDER[inc.severity] ?? 'border-l-outline-variant'}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${SEVERITY_BADGE[inc.severity] ?? 'bg-surface-container-high text-on-surface-variant'}`}>
                        {inc.severity}
                      </span>
                      <span className="text-xs text-on-surface-variant">{inc.incident_type.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-outline-variant/80">·</span>
                      <span className="text-xs text-on-surface-variant">{fmt(inc.occurred_at ?? inc.created_at)}</span>
                    </div>
                    <p className="text-xs text-on-surface-variant truncate">
                      {inc.clients ? `${inc.clients.first_name} ${inc.clients.last_name}` : '—'}
                      {' · '}
                      {staffName(inc.staff_profiles)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[inc.status] ?? 'bg-surface-container-high text-on-surface-variant'}`}>
                      {inc.status.replace(/_/g, ' ')}
                    </span>
                    <Link href={`/admin/incidents/${inc.id}`} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">View →</Link>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Pilot Analytics */}
          <Card>
            <CardHeader
              title="Pilot Analytics · Last 30 days"
              action={
                <span className="inline-flex items-center rounded-full bg-indigo-50/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:text-indigo-400 ring-1 ring-inset ring-indigo-600/20">
                  PILOT
                </span>
              }
            />
            <div className="grid grid-cols-4 divide-x divide-outline-variant/30 px-0">
              {([
                { label: 'Onboarding',    value: `${onboardingPct}%`,    sub: `${pilotOnboarded}/${pilotTotalStaff} staff`,     pct: onboardingPct },
                { label: 'Portal logins', value: `${inviteSuccessPct}%`, sub: `${pilotInviteLogin} of ${pilotInvited} invited`, pct: inviteSuccessPct },
                { label: 'Shift accepted',value: `${acceptancePct}%`,    sub: `${pilotAccepted} of ${pilotTotalAssigned}`,      pct: acceptancePct },
                { label: 'Shift complete',value: `${completionPct}%`,    sub: `${pilotCompleted} of ${pilotTotalAssigned}`,     pct: completionPct },
              ] as { label: string; value: string; sub: string; pct: number }[]).map(({ label, value, sub, pct }) => (
                <div key={label} className="px-6 py-5">
                  <p className="text-xs text-on-surface-variant font-medium">{label}</p>
                  <p className={`text-2xl font-bold tabular-nums mt-1 ${pct >= 80 ? 'text-green-600' : pct > 50 ? 'text-amber-600' : 'text-red-600'}`}>
                    {value}
                  </p>
                  <p className="text-[11px] text-on-surface-variant/80 mt-0.5">{sub}</p>
                  {/* Progress bar */}
                  <div className="mt-2 h-1 bg-surface-container-low rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct >= 80 ? 'bg-green-500' : pct > 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

        </div>

        {/* RIGHT col (4) */}
        <div className="lg:col-span-4 space-y-6">

          {/* Quick Actions */}
          <Card>
            <div className="px-6 py-5 border-b border-outline-variant/30">
              <h3 className="text-xl font-bold text-on-surface" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>Quick Actions</h3>
            </div>
            <div className="p-5 grid grid-cols-1 gap-3">
              <QuickAction
                icon="add_circle"
                title="Post New Shift"
                subtitle="Open urgent requirements"
                href="/admin/shifts/new"
                bg="bg-indigo-50/20 dark:bg-indigo-950/40"
                iconColor="text-indigo-600 dark:text-indigo-400"
              />
              <QuickAction
                icon="description"
                title="Compliance Audit"
                subtitle="Generate report for CQC"
                href="/admin/compliance"
                bg="bg-amber-50/20 dark:bg-amber-950/40"
                iconColor="text-amber-600 dark:text-amber-400"
              />
              <QuickAction
                icon="group_add"
                title="Onboard Staff"
                subtitle="Verify new applicant documents"
                href="/admin/onboarding"
                bg="bg-emerald-50/20 dark:bg-emerald-950/40"
                iconColor="text-emerald-600 dark:text-emerald-400"
              />
            </div>
          </Card>

          {/* Compliance Alerts */}
          <Card>
            <CardHeader
              title="Compliance Alerts"
              action={
                <Link href="/admin/compliance" className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
                  Open dashboard →
                </Link>
              }
            />
            <div className="divide-y divide-outline-variant/30">
              {topAlerts.length === 0 ? (
                <div className="px-6 py-6 text-center">
                  <Icon name="check_circle" size="xl" fill className="text-green-500 mx-auto" aria-hidden />
                  <p className="text-sm text-green-600 font-semibold mt-1">All staff compliant</p>
                  <p className="text-xs text-on-surface-variant/80 mt-0.5">No active alerts</p>
                </div>
              ) : topAlerts.map((alert, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between gap-3 px-5 py-3 border-l-2 ${
                    alert.severity === 'expired'  ? 'border-l-red-400 bg-red-500/10' :
                    alert.severity === 'warning'  ? 'border-l-orange-400 bg-orange-500/10' :
                    'border-l-yellow-400 bg-yellow-500/5'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-on-surface truncate">{alert.staffName}</p>
                    <p className="text-[11px] text-on-surface-variant/80 truncate">
                      {alert.documentType.replace(/_/g, ' ')}
                      {alert.expiryDate ? ` · ${fmt(alert.expiryDate)}` : ''}
                    </p>
                  </div>
                  <Link href={`/admin/staff/${alert.staffId}`} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline shrink-0">
                    View →
                  </Link>
                </div>
              ))}
            </div>
          </Card>

        </div>
      </div>
    </div>
  )
}
