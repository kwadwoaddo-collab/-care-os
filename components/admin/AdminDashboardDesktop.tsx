'use client'

import Link from 'next/link'
import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import { fmt, fmtTime, staffName, fmtDateDisplay } from '@/lib/utils/formatters'
import { ReportExportModal } from './ReportExportModal'

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
  companyName: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const SHIFT_STATUS: Record<string, string> = {
  scheduled: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  confirmed:  'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300',
  completed:  'bg-surface-container-high text-on-surface-variant',
  cancelled:  'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300',
  no_show:    'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
}
const SEVERITY_BORDER: Record<string, string> = {
  low:      'border-l-gray-300 dark:border-l-gray-600',
  medium:   'border-l-yellow-400',
  high:     'border-l-orange-500',
  critical: 'border-l-red-600',
}
const SEVERITY_BADGE: Record<string, string> = {
  low:      'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  medium:   'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  high:     'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300',
  critical: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300',
}
const STATUS_BADGE: Record<string, string> = {
  open:          'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300',
  investigating: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
  resolved:      'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300',
  closed:        'bg-surface-container-high text-on-surface-variant',
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-surface-container-lowest/90 dark:backdrop-blur-sm rounded-xl border border-outline-variant/50 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_24px_-2px_rgba(0,0,0,0.3)] transition-all duration-300 hover:shadow-lg hover:scale-[1.003] hover:border-outline-variant ${className}`}>
      {children}
    </div>
  )
}

function CardHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/30">
      <h2 className="text-sm font-semibold text-on-surface tracking-tight">{title}</h2>
      {action}
    </div>
  )
}

function CommandMetric({
  title, count, sub, variant, href, icon
}: {
  title: string; count: number | string; sub: string;
  variant: 'urgent' | 'warning' | 'neutral' | 'success'; href: string; icon: string
}) {
  const borders = {
    urgent:  'border-l-red-500',
    warning: 'border-l-amber-500',
    neutral: 'border-l-outline-variant',
    success: 'border-l-indigo-500 dark:border-l-indigo-400',
  }
  const textColors = {
    urgent:  'text-red-600 dark:text-red-400',
    warning: 'text-amber-600 dark:text-amber-400',
    neutral: 'text-on-surface',
    success: 'text-indigo-600 dark:text-indigo-400',
  }
  const hoverBg = {
    urgent:  'hover:bg-red-500/5',
    warning: 'hover:bg-amber-500/5',
    neutral: 'hover:bg-surface-container-low',
    success: 'hover:bg-indigo-500/5',
  }
  const iconBg = {
    urgent:  'bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400',
    warning: 'bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',
    neutral: 'bg-surface-container-high text-on-surface-variant',
    success: 'bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400',
  }
  return (
    <Link
      href={href}
      className={`group block bg-surface-container-lowest/90 dark:backdrop-blur-sm p-6 rounded-xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_24px_-2px_rgba(0,0,0,0.3)] border-l-4 ${borders[variant]} border border-outline-variant/50 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] ${hoverBg[variant]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider pt-0.5">{title}</p>
        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110 ${iconBg[variant]}`}>
          <span className="material-symbols-outlined text-[18px]">{icon}</span>
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className={`text-4xl font-extrabold tabular-nums ${textColors[variant]} transition-transform duration-200 group-hover:scale-105 inline-block`}>{count}</span>
      </div>
      <p className="text-sm font-medium text-on-surface-variant mt-1">{sub}</p>
      <div className="mt-4 flex items-center gap-1 text-xs text-on-surface-variant/60 group-hover:text-on-surface-variant transition-colors">
        <span>View details</span>
        <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
      </div>
    </Link>
  )
}

function QuickAction({
  icon, title, subtitle, href, iconColor, bg
}: {
  icon: string; title: string; subtitle: string; href: string; iconColor: string; bg: string
}) {
  return (
    <Link
      href={href}
      className="w-full flex items-center gap-4 p-4 rounded-xl border border-outline-variant/50 hover:border-indigo-300/60 hover:bg-indigo-50/10 dark:hover:bg-indigo-950/10 hover:scale-[1.02] transition-all duration-200 text-left group"
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${bg} ${iconColor} transition-transform duration-200 group-hover:scale-110`}>
        <Icon name={icon} size="md" fill />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-on-surface">{title}</p>
        <p className="text-xs text-on-surface-variant truncate">{subtitle}</p>
      </div>
      <span className="text-on-surface-variant/40 group-hover:text-indigo-500 transition-colors text-sm shrink-0">→</span>
    </Link>
  )
}

function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
      <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center mb-1">
        <Icon name={icon} size="xl" fill className="text-on-surface-variant/50" />
      </div>
      <p className="text-sm font-semibold text-on-surface-variant">{title}</p>
      <p className="text-xs text-on-surface-variant/60 max-w-[180px]">{sub}</p>
    </div>
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
  today, unassignedToday, companyName
}: Props) {
  const opsAlerts = declinedShifts + runningLate
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)

  return (
    <div className="space-y-6">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>
            Dashboard
          </h1>
          <p className="text-sm text-on-surface-variant mt-0.5 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block shrink-0" />
            <span>{companyName}</span>
            <span className="text-outline-variant/60">·</span>
            <span className="text-xs tabular-nums">{fmtDateDisplay(today + 'T00:00:00')}</span>
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold shadow-sm hover:shadow-md hover:from-indigo-500 hover:to-violet-500 transition-all duration-200"
          >
            <Icon name="file_download" size="sm" fill />
            Generate Report
          </button>
        </div>
      </div>

      <ReportExportModal 
        isOpen={isExportModalOpen} 
        onClose={() => setIsExportModalOpen(false)} 
      />

      {/* ── Ops alert banner ─────────────────────────────────────────────── */}
      {(opsAlerts > 0 || unacknowledged > 0) && (
        <div className="rounded-xl bg-red-500/10 dark:bg-red-500/[0.08] border border-red-300/30 dark:border-red-800/40 px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Pulsing urgency indicator */}
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600" />
            </span>
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
          <Link href="/admin/shifts/operations" className="text-xs font-semibold text-red-700 dark:text-red-400 hover:underline whitespace-nowrap flex items-center gap-1">
            View Shift Ops <span>→</span>
          </Link>
        </div>
      )}

      {/* ── Command Center Header: High-level Metrics ─────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <CommandMetric
          title="Unassigned Shifts"
          count={openShifts}
          sub={openShifts > 0 ? 'Need coverage now' : 'All shifts covered'}
          variant={openShifts > 0 ? 'urgent' : 'success'}
          href="/admin/shifts?assigned=unassigned"
          icon="event_busy"
        />
        <CommandMetric
          title="Urgent Incidents"
          count={activeIncidents}
          sub={activeIncidents > 0 ? 'Pending review' : 'No open incidents'}
          variant={activeIncidents > 0 ? 'urgent' : 'success'}
          href="/admin/incidents"
          icon="warning"
        />
        <CommandMetric
          title="Compliance Gaps"
          count={nonCompliant + expiring7d}
          sub={(nonCompliant + expiring7d) > 0 ? 'Docs expiring soon' : 'All staff compliant'}
          variant={(nonCompliant + expiring7d) > 0 ? 'warning' : 'success'}
          href="/admin/compliance"
          icon="verified_user"
        />
        <CommandMetric
          title="Active Staff"
          count={activeStaff}
          sub="View all profiles"
          variant="success"
          href="/admin/staff"
          icon="group"
        />
      </div>

      {/* ── Main 2+1 grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT col (spans 8) */}
        <div className="lg:col-span-8 space-y-6">

          {/* Today's Shifts */}
          <Card>
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/30">
              <div>
                <h3 className="text-base font-bold text-on-surface tracking-tight" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>
                  Critical Shifts: Today
                </h3>
                {unassignedToday > 0 && (
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium mt-0.5">
                    {unassignedToday} shift{unassignedToday !== 1 ? 's' : ''} unassigned
                  </p>
                )}
              </div>
              <Link href="/admin/shifts" className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1">
                View all shifts <span>→</span>
              </Link>
            </div>
            <div className="divide-y divide-outline-variant/20">
              {todayShifts.length === 0 ? (
                <EmptyState
                  icon="event_available"
                  title="All clear for today"
                  sub="No shifts are currently scheduled"
                />
              ) : (
                todayShifts.map((shift) => {
                  const isUnassigned = !shift.assigned_staff_id
                  const dateObj = new Date(shift.start_time)
                  const day = dateObj.getDate()
                  const monthStr = dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase()

                  return (
                    <div key={shift.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-surface-container-low/60 transition-colors">
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
                            <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 text-[10px] font-bold uppercase tracking-wide">
                              Unassigned
                            </span>
                            <Link
                              href="/admin/shifts/open"
                              className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-2 rounded-lg text-xs font-semibold hover:from-indigo-500 hover:to-violet-500 transition-all shadow-sm hover:shadow-md"
                            >
                              Assign Staff
                            </Link>
                          </>
                        ) : (
                          <>
                            <span className={`hidden sm:inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${SHIFT_STATUS[shift.status] ?? 'bg-surface-container-high text-on-surface-variant'}`}>
                              {shift.status.replace(/_/g, ' ')}
                            </span>
                            <Link
                              href={`/admin/shifts/${shift.id}`}
                              className="bg-surface-container-high text-on-surface px-4 py-2 rounded-lg text-xs font-semibold hover:bg-surface-container-highest transition-colors border border-outline-variant/40"
                            >
                              Review
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
              {unassignedToday > 0 && (
                <div className="px-5 py-4 bg-red-500/[0.06] dark:bg-red-500/[0.04] flex justify-between items-center border-t border-red-200/30">
                  <p className="text-xs font-medium text-red-800 dark:text-red-300">
                    {unassignedToday} shift{unassignedToday !== 1 ? 's' : ''} still unassigned today
                  </p>
                  <Link href="/admin/shifts/open" className="text-xs font-semibold text-red-700 dark:text-red-400 hover:underline flex items-center gap-1">
                    Resolve now <span>→</span>
                  </Link>
                </div>
              )}
            </div>
          </Card>

          {/* Recent Incidents */}
          <Card>
            <CardHeader
              title="Recent Incidents"
              action={
                <Link href="/admin/incidents" className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1">
                  View all <span>→</span>
                </Link>
              }
            />
            <div className="divide-y divide-outline-variant/20">
              {incidents.length === 0 ? (
                <EmptyState
                  icon="health_and_safety"
                  title="No open incidents"
                  sub="All incidents are resolved or closed"
                />
              ) : incidents.map((inc) => (
                <div key={inc.id} className={`flex items-center gap-4 px-6 py-3.5 border-l-4 hover:bg-surface-container-low/60 transition-colors ${SEVERITY_BORDER[inc.severity] ?? 'border-l-outline-variant'}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${SEVERITY_BADGE[inc.severity] ?? 'bg-surface-container-high text-on-surface-variant'}`}>
                        {inc.severity}
                      </span>
                      <span className="text-xs text-on-surface font-medium capitalize">{inc.incident_type.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-outline-variant/60">·</span>
                      <span className="text-xs text-on-surface-variant">{fmt(inc.occurred_at ?? inc.created_at)}</span>
                    </div>
                    <p className="text-xs text-on-surface-variant truncate">
                      {inc.clients ? `${inc.clients.first_name} ${inc.clients.last_name}` : '—'}
                      {' · '}
                      {staffName(inc.staff_profiles)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_BADGE[inc.status] ?? 'bg-surface-container-high text-on-surface-variant'}`}>
                      {inc.status.replace(/_/g, ' ')}
                    </span>
                    <Link href={`/admin/incidents/${inc.id}`} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5">
                      View <span>→</span>
                    </Link>
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
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center rounded-full bg-indigo-50/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:text-indigo-400 ring-1 ring-inset ring-indigo-600/20">
                    PILOT
                  </span>
                  <Link href="/admin/analytics" className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1">
                    Full analytics <span>→</span>
                  </Link>
                </div>
              }
            />
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-outline-variant/30 px-0">
              {([
                { label: 'Onboarding',    value: `${onboardingPct}%`,    sub: `${pilotOnboarded}/${pilotTotalStaff} staff`,     pct: onboardingPct },
                { label: 'Portal logins', value: `${inviteSuccessPct}%`, sub: `${pilotInviteLogin} of ${pilotInvited} invited`, pct: inviteSuccessPct },
                { label: 'Shift accepted',value: `${acceptancePct}%`,    sub: `${pilotAccepted} of ${pilotTotalAssigned}`,      pct: acceptancePct },
                { label: 'Shift complete',value: `${completionPct}%`,    sub: `${pilotCompleted} of ${pilotTotalAssigned}`,     pct: completionPct },
              ] as { label: string; value: string; sub: string; pct: number }[]).map(({ label, value, sub, pct }) => (
                <div key={label} className="px-6 py-5">
                  <p className="text-xs text-on-surface-variant font-medium tracking-wide">{label}</p>
                  <p className={`text-2xl font-bold tabular-nums mt-1 ${pct >= 80 ? 'text-green-600 dark:text-green-400' : pct > 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                    {value}
                  </p>
                  <p className="text-[11px] text-on-surface-variant/70 mt-0.5">{sub}</p>
                  {/* Progress bar */}
                  <div className="mt-3 h-1.5 bg-surface-container-low rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${pct >= 80 ? 'bg-green-500' : pct > 50 ? 'bg-amber-500' : 'bg-red-500'}`}
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
            <div className="px-6 py-4 border-b border-outline-variant/30">
              <h3 className="text-base font-bold text-on-surface tracking-tight" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>Quick Actions</h3>
              <p className="text-xs text-on-surface-variant mt-0.5">Jump to common tasks</p>
            </div>
            <div className="p-5 grid grid-cols-1 gap-3">
              <QuickAction
                icon="add_circle"
                title="Post New Shift"
                subtitle="Open urgent requirements"
                href="/admin/shifts"
                bg="bg-indigo-50/20 dark:bg-indigo-950/40"
                iconColor="text-indigo-600 dark:text-indigo-400"
              />
              <QuickAction
                icon="fact_check"
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
              <QuickAction
                icon="warning"
                title="Incident Report"
                subtitle="Log a new clinical incident"
                href="/admin/incidents"
                bg="bg-red-50/20 dark:bg-red-950/40"
                iconColor="text-red-600 dark:text-red-400"
              />
            </div>
          </Card>

          {/* Compliance Alerts */}
          <Card>
            <CardHeader
              title="Compliance Alerts"
              action={
                <Link href="/admin/compliance" className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1">
                  Dashboard <span>→</span>
                </Link>
              }
            />
            <div className="divide-y divide-outline-variant/20">
              {topAlerts.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-2">
                    <Icon name="check_circle" size="xl" fill className="text-green-500" aria-hidden />
                  </div>
                  <p className="text-sm text-green-600 dark:text-green-400 font-semibold">All staff compliant</p>
                  <p className="text-xs text-on-surface-variant/70 mt-0.5">No active alerts</p>
                </div>
              ) : topAlerts.map((alert, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between gap-3 px-5 py-3.5 border-l-2 hover:bg-surface-container-low/60 transition-colors ${
                    alert.severity === 'expired'  ? 'border-l-red-500 bg-red-500/[0.04]' :
                    alert.severity === 'warning'  ? 'border-l-orange-400 bg-orange-500/[0.04]' :
                    'border-l-yellow-400 bg-yellow-500/[0.03]'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-on-surface truncate">{alert.staffName}</p>
                    <p className="text-[11px] text-on-surface-variant/70 truncate">
                      {alert.documentType.replace(/_/g, ' ')}
                      {alert.expiryDate ? ` · ${fmt(alert.expiryDate)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      alert.severity === 'expired' ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300' :
                      alert.severity === 'warning' ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300' :
                      'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300'
                    }`}>
                      {alert.severity}
                    </span>
                    <Link href={`/admin/staff/${alert.staffId}`} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5">
                      View <span>→</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </Card>

        </div>
      </div>
    </div>
  )
}
