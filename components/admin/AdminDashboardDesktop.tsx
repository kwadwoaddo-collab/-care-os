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
function fmtTs(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
function fmtTime(t: string) { return t.slice(0, 5) }
function staffName(p: { first_name: string | null; last_name: string | null } | null) {
  if (!p) return '—'
  return [p.first_name, p.last_name].filter(Boolean).join(' ') || '—'
}

function formatAuditAction(e: AuditEntry): { title: string; subtitle: string } {
  const action = e.action || ''
  const entityType = e.entity_type || ''
  const entityId = e.entity_id || ''
  const metadata = e.metadata || {}

  const staffNameVal = (metadata.staff_name || metadata.staffName || metadata.name || '') as string
  const clientNameVal = (metadata.client_name || metadata.clientName || '') as string
  const docType = (metadata.document_type || metadata.documentType || metadata.type || '') as string
  const status = (metadata.status || metadata.new_status || '') as string

  let title = action
  let subtitle = entityId ? `${entityType} ID: ${entityId.slice(0, 8)}...` : 'System event'

  if (action === 'staff.create') {
    title = staffNameVal ? `Registered staff member ${staffNameVal}` : 'Registered a new staff member'
    subtitle = 'Profile created'
  } else if (action === 'staff.update') {
    title = staffNameVal ? `Updated profile for ${staffNameVal}` : 'Updated staff profile'
    subtitle = 'HR details updated'
  } else if (action === 'staff.status_change' || action === 'staff.suspend') {
    title = staffNameVal ? `Changed ${staffNameVal}'s status` : 'Changed staff status'
    subtitle = status ? `New status: ${status}` : 'Status modified'
  } else if (action === 'shift.create') {
    title = 'Scheduled a new shift'
    subtitle = clientNameVal ? `For client: ${clientNameVal}` : 'Shift scheduled'
  } else if (action === 'shift.assign') {
    const assignedStaff = (metadata.assigned_staff_name || metadata.staff_name || '') as string
    title = assignedStaff ? `Assigned shift to ${assignedStaff}` : 'Assigned staff to shift'
    subtitle = clientNameVal ? `Client: ${clientNameVal}` : 'Shift assigned'
  } else if (action === 'shift.update') {
    title = 'Updated shift details'
    subtitle = 'Schedule modified'
  } else if (action === 'shift.cancel') {
    title = 'Cancelled shift'
    subtitle = 'Shift cancelled'
  } else if (action.startsWith('document.')) {
    const verb = action.split('.')[1] || 'processed'
    const docLabel = (docType || entityType || 'document').replace(/_/g, ' ')
    title = `${verb.charAt(0).toUpperCase() + verb.slice(1)}ed ${docLabel}`
    subtitle = staffNameVal ? `For staff: ${staffNameVal}` : `Document ID: ${entityId.slice(0, 8)}...`
  } else if (action === 'incident.report') {
    title = 'Reported new incident'
    subtitle = clientNameVal ? `Involving client: ${clientNameVal}` : 'Incident flagged'
  } else if (action === 'incident.resolve') {
    title = 'Resolved incident'
    subtitle = 'Investigation closed'
  } else if (action === 'care_package.create') {
    const pkgTitle = (metadata.title || metadata.package_title || '') as string
    title = pkgTitle ? `Created care package: ${pkgTitle}` : 'Created new care package'
    subtitle = clientNameVal ? `For client: ${clientNameVal}` : 'Care package initialized'
  } else {
    const parts = action.split('.')
    const domain = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : ''
    const verb = parts[1] ? parts[1].replace(/_/g, ' ') : ''
    title = domain && verb ? `${domain}: ${verb}` : action
    subtitle = staffNameVal ? `Staff: ${staffNameVal}` : clientNameVal ? `Client: ${clientNameVal}` : entityId ? `${entityType || 'Entity'} ID: ${entityId.slice(0, 8)}...` : 'System event'
  }

  return { title, subtitle }
}

const SHIFT_STATUS: Record<string, string> = {
  scheduled: 'bg-blue-50 text-blue-700',
  confirmed:  'bg-green-50 text-green-700',
  completed:  'bg-gray-50 text-gray-500',
  cancelled:  'bg-red-50 text-red-600',
  no_show:    'bg-orange-50 text-orange-700',
}
const NOTE_STATUS: Record<string, string> = {
  draft:     'text-gray-400',
  submitted: 'text-green-600',
  locked:    'text-indigo-600',
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
const AUDIT_CLS: Record<string, string> = {
  staff: 'bg-indigo-100 text-indigo-800', shift: 'bg-blue-100 text-blue-800',
  care_package: 'bg-green-100 text-green-800', applicant: 'bg-amber-100 text-amber-800',
  document: 'bg-purple-100 text-purple-800', visit_note: 'bg-pink-100 text-pink-800',
  incident: 'bg-red-100 text-red-800',
}
function auditCls(action: string) {
  return AUDIT_CLS[action.split('.')[0] ?? ''] ?? 'bg-gray-50 text-gray-600'
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-100 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] transition-all duration-300 hover:shadow-md hover:scale-[1.005] hover:border-slate-200/60 ${className}`}>
      {children}
    </div>
  )
}

function CardHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
      <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      {action}
    </div>
  )
}

function CommandMetric({ title, count, sub, variant }: { title: string; count: number | string; sub: string; variant: 'urgent' | 'warning' | 'neutral' | 'success' }) {
  const borders = {
    urgent: 'border-l-red-600',
    warning: 'border-l-amber-500',
    neutral: 'border-l-slate-400',
    success: 'border-l-indigo-600',
  }
  const textColors = {
    urgent: 'text-red-600',
    warning: 'text-amber-600',
    neutral: 'text-slate-700',
    success: 'text-indigo-600',
  }
  return (
    <div className={`bg-white p-6 rounded-xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border-l-4 ${borders[variant]} transition-all duration-300 hover:shadow-md hover:scale-[1.01] hover:border-slate-200/40`}>
      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{title}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={`text-4xl font-extrabold ${textColors[variant]}`}>{count}</span>
        <span className="text-sm font-medium text-slate-500">{sub}</span>
      </div>
    </div>
  )
}

function QuickAction({ icon, title, subtitle, href, iconColor, bg }: { icon: string; title: string; subtitle: string; href: string; iconColor: string; bg: string }) {
  return (
    <Link href={href} className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 hover:scale-[1.02] transition-all duration-300 text-left group">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${bg} ${iconColor} transition-transform duration-300 group-hover:scale-110`}>
        <Icon name={icon} size="md" fill />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
    </Link>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AdminDashboardDesktop({
  openShifts, nonCompliant, activeIncidents, activeStaff, activeClients,
  declinedShifts, runningLate, unacknowledged, hrIncomplete, expiring7d, draftNotes,
  todayShifts, incidents, topAlerts, auditEntries,
  onboardingPct, inviteSuccessPct, acceptancePct, completionPct,
  pilotOnboarded, pilotTotalStaff, pilotInviteLogin, pilotInvited,
  pilotAccepted, pilotCompleted, pilotTotalAssigned,
  today, unassignedToday,
}: Props) {
  const opsAlerts = declinedShifts + runningLate

  return (
    <div className="space-y-6">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>
            Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-0.5 border-l-2 border-slate-200 pl-3">
            Care Center North
          </p>
        </div>
      </div>

      {/* ── Ops alert banner ─────────────────────────────────────────────── */}
      {(opsAlerts > 0 || unacknowledged > 0) && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span
              className="material-symbols-outlined text-red-600 overflow-hidden"
              style={{ fontSize: '20px', width: '20px', height: '20px', lineHeight: '20px', display: 'block', flexShrink: 0 }}
            >warning</span>
            <div>
              <p className="text-sm font-semibold text-red-800">Rota action required</p>
              <p className="text-xs text-red-600 mt-0.5">
                {declinedShifts > 0 && `${declinedShifts} declined`}
                {declinedShifts > 0 && runningLate > 0 && ' · '}
                {runningLate > 0 && `${runningLate} running late`}
                {unacknowledged > 0 && ` · ${unacknowledged} unacknowledged`}
              </p>
            </div>
          </div>
          <Link href="/admin/shifts/operations" className="text-xs font-semibold text-red-700 hover:underline whitespace-nowrap">
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
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
              <h3 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>Critical Shifts: Today</h3>
              <Link href="/admin/shifts" className="text-xs text-indigo-600 font-semibold hover:underline">
                View all shifts →
              </Link>
            </div>
            <div className="divide-y divide-slate-50">
              {todayShifts.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-8">No shifts scheduled for today.</p>
              ) : (
                todayShifts.map((shift) => {
                  const isUnassigned = !shift.assigned_staff_id
                  const dateObj = new Date(shift.start_time)
                  const day = dateObj.getDate()
                  const monthStr = dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase()
                  
                  return (
                    <div key={shift.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`w-12 h-12 shrink-0 rounded-lg flex flex-col items-center justify-center ${isUnassigned ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                          <span className="text-[10px] font-bold leading-none">{monthStr}</span>
                          <span className="font-bold text-lg leading-tight mt-0.5">{day}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {shift.care_packages?.title ?? 'General Care'}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {fmtTime(shift.start_time)} – {fmtTime(shift.end_time)} · {shift.clients ? `${shift.clients.first_name} ${shift.clients.last_name}` : shift.client_name ?? '—'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 sm:pl-4">
                        {isUnassigned ? (
                          <>
                            <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-[10px] font-bold uppercase tracking-wide">Unassigned</span>
                            <Link href="/admin/shifts/open" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors">Assign Staff</Link>
                          </>
                        ) : (
                          <>
                            <span className={`hidden sm:inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${SHIFT_STATUS[shift.status] ?? 'bg-slate-100 text-slate-600'}`}>
                              {shift.status.replace(/_/g, ' ')}
                            </span>
                            <Link href={`/admin/shifts/${shift.id}`} className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-colors">Review</Link>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
              {unassignedToday > 0 && (
                <div className="px-5 py-4 bg-red-50/50 flex justify-between items-center">
                  <p className="text-xs font-medium text-red-800">
                    {unassignedToday} shift{unassignedToday !== 1 ? 's' : ''} still unassigned today.
                  </p>
                  <Link href="/admin/shifts/open" className="text-xs font-semibold text-red-700 hover:underline">Resolve now →</Link>
                </div>
              )}
            </div>
          </Card>

          {/* Recent Incidents */}
          <Card>
            <CardHeader
              title="Recent Incidents"
              action={
                <Link href="/admin/incidents" className="text-xs text-indigo-600 font-medium hover:underline">
                  View all incidents →
                </Link>
              }
            />
            <div className="divide-y divide-slate-50">
              {incidents.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-8">No open incidents.</p>
              ) : incidents.map((inc) => (
                <div key={inc.id} className={`flex items-center gap-4 px-6 py-3.5 border-l-4 hover:bg-slate-50 transition-colors ${SEVERITY_BORDER[inc.severity] ?? 'border-l-gray-200'}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${SEVERITY_BADGE[inc.severity] ?? 'bg-gray-50 text-gray-600'}`}>
                        {inc.severity}
                      </span>
                      <span className="text-xs text-slate-400">{inc.incident_type.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-slate-300">·</span>
                      <span className="text-xs text-slate-400">{fmt(inc.occurred_at ?? inc.created_at)}</span>
                    </div>
                    <p className="text-xs text-slate-600 truncate">
                      {inc.clients ? `${inc.clients.first_name} ${inc.clients.last_name}` : '—'}
                      {' · '}
                      {staffName(inc.staff_profiles)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[inc.status] ?? 'bg-gray-50 text-gray-500'}`}>
                      {inc.status.replace(/_/g, ' ')}
                    </span>
                    <Link href={`/admin/incidents/${inc.id}`} className="text-xs text-indigo-600 hover:underline">View →</Link>
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
                <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-600/20">
                  PILOT
                </span>
              }
            />
            <div className="grid grid-cols-4 divide-x divide-slate-100 px-0">
              {([
                { label: 'Onboarding',    value: `${onboardingPct}%`,    sub: `${pilotOnboarded}/${pilotTotalStaff} staff`,     pct: onboardingPct },
                { label: 'Portal logins', value: `${inviteSuccessPct}%`, sub: `${pilotInviteLogin} of ${pilotInvited} invited`, pct: inviteSuccessPct },
                { label: 'Shift accepted',value: `${acceptancePct}%`,    sub: `${pilotAccepted} of ${pilotTotalAssigned}`,      pct: acceptancePct },
                { label: 'Shift complete',value: `${completionPct}%`,    sub: `${pilotCompleted} of ${pilotTotalAssigned}`,     pct: completionPct },
              ] as { label: string; value: string; sub: string; pct: number }[]).map(({ label, value, sub, pct }) => (
                <div key={label} className="px-6 py-5">
                  <p className="text-xs text-slate-400 font-medium">{label}</p>
                  <p className={`text-2xl font-bold tabular-nums mt-1 ${pct >= 80 ? 'text-green-600' : pct > 50 ? 'text-amber-600' : 'text-red-600'}`}>
                    {value}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
                  {/* Progress bar */}
                  <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
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
            <div className="px-6 py-5 border-b border-slate-50">
              <h3 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>Quick Actions</h3>
            </div>
            <div className="p-5 grid grid-cols-1 gap-3">
              <QuickAction
                icon="add_circle"
                title="Post New Shift"
                subtitle="Open urgent requirements"
                href="/admin/shifts/new"
                bg="bg-indigo-50"
                iconColor="text-indigo-600"
              />
              <QuickAction
                icon="description"
                title="Compliance Audit"
                subtitle="Generate report for CQC"
                href="/admin/compliance"
                bg="bg-amber-50"
                iconColor="text-amber-600"
              />
              <QuickAction
                icon="group_add"
                title="Onboard Staff"
                subtitle="Verify new applicant documents"
                href="/admin/onboarding"
                bg="bg-emerald-50"
                iconColor="text-emerald-600"
              />
            </div>
          </Card>

          {/* Compliance Alerts */}
          <Card>
            <CardHeader
              title="Compliance Alerts"
              action={
                <Link href="/admin/compliance" className="text-xs text-indigo-600 font-medium hover:underline">
                  Open dashboard →
                </Link>
              }
            />
            <div className="divide-y divide-slate-50">
              {topAlerts.length === 0 ? (
                <div className="px-6 py-6 text-center">
                <Icon name="check_circle" size="xl" fill className="text-green-500 mx-auto" aria-hidden />
                  <p className="text-sm text-green-600 font-semibold mt-1">All staff compliant</p>
                  <p className="text-xs text-slate-400 mt-0.5">No active alerts</p>
                </div>
              ) : topAlerts.map((alert, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between gap-3 px-5 py-3 border-l-2 ${
                    alert.severity === 'expired'  ? 'border-l-red-400 bg-red-50/20' :
                    alert.severity === 'warning'  ? 'border-l-orange-400 bg-orange-50/20' :
                    'border-l-yellow-400 bg-yellow-50/10'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{alert.staffName}</p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {alert.documentType.replace(/_/g, ' ')}
                      {alert.expiryDate ? ` · ${fmt(alert.expiryDate)}` : ''}
                    </p>
                  </div>
                  <Link href={`/admin/staff/${alert.staffId}`} className="text-xs text-indigo-600 hover:underline shrink-0">
                    View →
                  </Link>
                </div>
              ))}
            </div>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader
              title="Recent Activity"
              action={
                <Link href="/admin/audit-log" className="text-xs text-indigo-600 font-medium hover:underline">
                  Full log →
                </Link>
              }
            />
            <div className="divide-y divide-slate-50 p-2">
              {auditEntries.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-8">No audit events yet.</p>
              ) : auditEntries.slice(0, 8).map((e) => {
                const { title, subtitle } = formatAuditAction(e)
                return (
                  <div key={e.id} className="flex gap-4 px-4 py-3">
                    <div className="mt-1 w-2 h-2 rounded-full bg-slate-300 shrink-0"></div>
                    <div>
                      <p className="text-sm text-slate-900 font-semibold">{title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase font-semibold">{fmtTs(e.created_at)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

        </div>
      </div>
    </div>
  )
}
