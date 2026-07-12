'use client'

import Link from 'next/link'
import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import { fmt, staffName, fmtDateDisplay } from '@/lib/utils/formatters'
import { ReportExportModal } from './ReportExportModal'

// ── Types ──────────────────────────────────────────────────────────────────────

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
  openShifts: number       // kept for ops alert banner only
  nonCompliant: number
  activeIncidents: number
  activeStaff: number
  hrIncomplete: number
  expiring7d: number
  pendingApplications: number
  // Data
  incidents: Incident[]
  topAlerts: AlertItem[]
  // Onboarding
  onboardingPct: number
  pilotOnboarded: number
  pilotTotalStaff: number
  // Misc
  today: string
  companyName: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

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
    <div className={`bg-surface-container-lowest/80 dark:bg-surface-container-lowest/40 backdrop-blur-md border border-black/[0.04] dark:border-white/[0.06] shadow-apple-sm rounded-2xl transition-all duration-300 hover:shadow-apple-md hover:border-black/[0.08] dark:hover:border-white/[0.1] ${className}`}>
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
  const indicatorDot = {
    urgent:  'bg-error shadow-[0_0_8px_rgba(255,59,48,0.4)]',
    warning: 'bg-warning shadow-[0_0_8px_rgba(255,149,0,0.4)]',
    neutral: 'bg-outline',
    success: 'bg-success shadow-[0_0_8px_rgba(52,199,89,0.4)]',
  }
  const textColors = {
    urgent:  'text-error',
    warning: 'text-warning',
    neutral: 'text-on-surface',
    success: 'text-primary dark:text-primary',
  }
  const hoverBg = {
    urgent:  'hover:bg-error/5',
    warning: 'hover:bg-warning/5',
    neutral: 'hover:bg-surface-container-low',
    success: 'hover:bg-primary/5',
  }
  const iconBg = {
    urgent:  'bg-error/10 text-error',
    warning: 'bg-warning/10 text-warning',
    neutral: 'bg-surface-container-high text-on-surface-variant',
    success: 'bg-primary/10 text-primary',
  }
  return (
    <Link
      href={href}
      className={`group block bg-surface-container-lowest/80 dark:bg-surface-container-lowest/40 backdrop-blur-md p-6 rounded-2xl border border-black/[0.04] dark:border-white/[0.06] shadow-apple-sm transition-all duration-300 hover:shadow-apple-md hover:scale-[1.01] hover:border-black/[0.08] dark:hover:border-white/[0.1] ${hoverBg[variant]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full shrink-0 ${indicatorDot[variant]}`} />
          <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider pt-0.5">{title}</p>
        </div>
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
      className="w-full flex items-center gap-4 p-4 rounded-2xl border border-black/[0.04] dark:border-white/[0.06] hover:border-primary/20 hover:bg-primary/5 active:scale-[0.98] hover:scale-[1.01] shadow-apple-sm hover:shadow-apple-md transition-all duration-200 text-left group"
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
  openShifts, nonCompliant, activeIncidents: _activeIncidents, activeStaff,
  hrIncomplete, expiring7d, pendingApplications,
  incidents, topAlerts,
  onboardingPct, pilotOnboarded, pilotTotalStaff,
  today, companyName,
}: Props) {
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)

  const complianceGaps = nonCompliant + expiring7d

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

      {/* ── Ops alert banner (only when rota issues present) ──────────────── */}
      {openShifts > 0 && (
        <div className="rounded-xl bg-red-500/10 dark:bg-red-500/[0.08] border border-red-300/30 dark:border-red-800/40 px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600" />
            </span>
            <div>
              <p className="text-sm font-semibold text-red-800 dark:text-red-300">Rota action required</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                {openShifts} shift{openShifts !== 1 ? 's' : ''} unassigned
              </p>
            </div>
          </div>
          <Link href="/admin/shifts/operations" className="text-xs font-semibold text-red-700 dark:text-red-400 hover:underline whitespace-nowrap flex items-center gap-1">
            View Shift Ops <span>→</span>
          </Link>
        </div>
      )}

      {/* ── Phase 1 KPI metrics ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <CommandMetric
          title="Pending Applications"
          count={pendingApplications}
          sub={pendingApplications > 0 ? 'Awaiting review' : 'No pending applications'}
          variant={pendingApplications > 0 ? 'warning' : 'success'}
          href="/admin/applicants"
          icon="person_search"
        />
        <CommandMetric
          title="Onboarding in Progress"
          count={hrIncomplete}
          sub={hrIncomplete > 0 ? 'Not yet complete' : 'All staff onboarded'}
          variant={hrIncomplete > 0 ? 'warning' : 'success'}
          href="/admin/onboarding"
          icon="how_to_reg"
        />
        <CommandMetric
          title="Compliance Gaps"
          count={complianceGaps}
          sub={complianceGaps > 0 ? 'Docs expiring soon' : 'All staff compliant'}
          variant={complianceGaps > 0 ? 'warning' : 'success'}
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

          {/* Onboarding Pipeline summary */}
          <Card>
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/30">
              <div>
                <h3 className="text-base font-bold text-on-surface tracking-tight" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>
                  Onboarding Pipeline
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {pilotOnboarded} of {pilotTotalStaff} staff fully onboarded
                </p>
              </div>
              <Link href="/admin/onboarding" className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1">
                Manage onboarding <span>→</span>
              </Link>
            </div>
            <div className="px-6 py-5">
              {/* Progress bar */}
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1 h-3 bg-surface-container-low rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      onboardingPct >= 80 ? 'bg-green-500' : onboardingPct > 50 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(onboardingPct, 100)}%` }}
                  />
                </div>
                <span className={`text-2xl font-bold tabular-nums shrink-0 ${
                  onboardingPct >= 80 ? 'text-green-600 dark:text-green-400' :
                  onboardingPct > 50 ? 'text-amber-600 dark:text-amber-400' :
                  'text-red-600 dark:text-red-400'
                }`}>
                  {onboardingPct}%
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 rounded-lg bg-surface-container-low/60">
                  <p className="text-2xl font-bold text-on-surface tabular-nums">{pilotOnboarded}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">Completed</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-amber-50/60 dark:bg-amber-950/20">
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-400 tabular-nums">{hrIncomplete}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">In Progress</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-surface-container-low/60">
                  <p className="text-2xl font-bold text-on-surface tabular-nums">{pilotTotalStaff}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">Total Staff</p>
                </div>
              </div>
              {hrIncomplete > 0 && (
                <div className="mt-4">
                  <Link
                    href="/admin/onboarding"
                    className="inline-flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                    {hrIncomplete} staff still need onboarding action
                    <span>→</span>
                  </Link>
                </div>
              )}
            </div>
          </Card>

          {/* Open Incidents */}
          <Card>
            <CardHeader
              title="Open Incidents"
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
                icon="person_add"
                title="Invite Applicant"
                subtitle="Start recruiting"
                href="/admin/applicants"
                bg="bg-indigo-50/20 dark:bg-indigo-950/40"
                iconColor="text-indigo-600 dark:text-indigo-400"
              />
              <QuickAction
                icon="verified_user"
                title="Review Compliance"
                subtitle="Check staff files"
                href="/admin/compliance"
                bg="bg-amber-50/20 dark:bg-amber-950/40"
                iconColor="text-amber-600 dark:text-amber-400"
              />
              <QuickAction
                icon="how_to_reg"
                title="Onboard Staff"
                subtitle="Track progress"
                href="/admin/onboarding"
                bg="bg-emerald-50/20 dark:bg-emerald-950/40"
                iconColor="text-emerald-600 dark:text-emerald-400"
              />
              <QuickAction
                icon="upload_file"
                title="Upload Document"
                subtitle="Add to staff file"
                href="/admin/documents"
                bg="bg-violet-50/20 dark:bg-violet-950/40"
                iconColor="text-violet-600 dark:text-violet-400"
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
