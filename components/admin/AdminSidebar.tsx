'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { can } from '@/lib/rbac/permissions'
import { ENABLE_TIMESHEETS } from '@/lib/features'
import {
  canViewCompliance,
  canViewAuditLogs,
  canViewNotifications,
  canViewShifts,
  canViewIncidents,
  canManageStaff,
  canViewSystemHealth,
} from '@/lib/rbac/can'

interface AdminSidebarProps {
  userRole: string
  userFullName: string
  userInitials: string
}

function NavLink({ href, icon, label, active }: { href: string; icon: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`relative flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-200 overflow-hidden ${
        active
          ? 'bg-[#4f46e5] text-white shadow-sm'
          : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'
      }`}
      style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}
    >
      {active && <div className="absolute left-0 top-0 bottom-0 w-1 bg-white/20" />}
      <span
        className="material-symbols-outlined shrink-0 overflow-hidden flex items-center justify-center"
        style={{ fontSize: '24px', width: '24px', height: '24px', fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
      >
        {icon}
      </span>
      <span className="text-sm font-medium normal-case truncate">{label}</span>
    </Link>
  )
}

function SubNavLink({ href, icon, label, active }: { href: string; icon: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 pl-8 pr-4 py-2 rounded-lg transition-all duration-200 text-[13px] ${
        active
          ? 'bg-[#4f46e5]/10 text-[#4f46e5] font-semibold'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 font-medium'
      }`}
      style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}
    >
      <span
        className="material-symbols-outlined shrink-0"
        style={{ fontSize: '16px', width: '16px', height: '16px', fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
      >
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </Link>
  )
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="pl-8 pr-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">
      {label}
    </p>
  )
}

export default function AdminSidebar({ userRole, userFullName, userInitials }: AdminSidebarProps) {
  const pathname = usePathname()
  const [workforceOpen, setWorkforceOpen] = useState(
    () => pathname.startsWith('/admin/applicants') ||
          pathname.startsWith('/admin/staff') ||
          pathname.startsWith('/admin/compliance') ||
          pathname.startsWith('/admin/onboarding')
  )

  const isAuthPage = pathname === '/admin/login' || pathname === '/admin/set-password'
  if (isAuthPage) return null

  const showAll = !userRole
  function navCan(check: (role: string) => boolean): boolean {
    return showAll || check(userRole)
  }

  const canSeeApplicants  = navCan((r) => can(r, 'applicants:read'))
  const canSeeStaff       = navCan(canManageStaff)
  const canSeeCompliance  = navCan(canViewCompliance)
  const showWorkforce     = canSeeApplicants || canSeeStaff || canSeeCompliance

  const isWorkforceActive =
    pathname.startsWith('/admin/applicants') ||
    pathname.startsWith('/admin/staff') ||
    pathname.startsWith('/admin/compliance') ||
    pathname.startsWith('/admin/onboarding')

  const topItems = [
    { label: 'Dashboard', href: '/admin',           icon: 'dashboard',    show: true },
    { label: 'Shifts',    href: '/admin/shifts',     icon: 'event_repeat', show: navCan(canViewShifts) },
  ]

  if (ENABLE_TIMESHEETS) {
    topItems.push({
      label: 'Timesheets',
      href: '/admin/timesheets',
      icon: 'schedule',
      show: navCan((r) => can(r, 'timesheets:read')),
    })
  }

  const bottomItems = [
    { label: 'Clients',       href: '/admin/clients',       icon: 'contact_page',  show: navCan((r) => can(r, 'clients:read')) },
    { label: 'Packages',      href: '/admin/care-packages',  icon: 'payments',      show: navCan((r) => can(r, 'care_packages:read')) },
    { label: 'Incidents',     href: '/admin/incidents',      icon: 'warning',       show: navCan(canViewIncidents) },
    { label: 'Audit Log',     href: '/admin/audit-log',      icon: 'history',       show: navCan(canViewAuditLogs) },
    { label: 'Notifications', href: '/admin/notifications',  icon: 'notifications', show: navCan(canViewNotifications) },
  ]

  const footerItems = [
    { label: 'System', href: '/admin/system', icon: 'settings', show: navCan(canViewSystemHealth) },
  ]

  return (
    <aside className="hidden lg:flex flex-col h-screen w-64 min-w-[256px] max-w-[256px] fixed left-0 top-0 bg-[#fbf8fa] border-r border-outline-variant z-50">
      <div className="flex flex-col h-full px-6 py-8 overflow-y-auto no-scrollbar">

        {/* ── Brand ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 shrink-0 mb-8">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-white text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              shield
            </span>
          </div>
          <div>
            <span className="block text-[22px] font-bold text-slate-900 leading-none tracking-tight" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>
              Care OS
            </span>
            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
              Healthcare Admin
            </span>
          </div>
        </div>

        {/* ── Main Navigation ───────────────────────────────────────────────── */}
        <nav className="flex-1 flex flex-col space-y-1.5">

          {/* Top items: Dashboard, Shifts */}
          {topItems.filter((i) => i.show).map((item) => {
            const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
            return <NavLink key={item.href} href={item.href} icon={item.icon} label={item.label} active={active} />
          })}

          {/* ── Workforce Section ──────────────────────────────────────────── */}
          {showWorkforce && (
            <div>
              <button
                onClick={() => setWorkforceOpen((v) => !v)}
                className={`w-full relative flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isWorkforceActive && !workforceOpen
                    ? 'bg-[#4f46e5] text-white shadow-sm'
                    : isWorkforceActive
                    ? 'text-slate-900 bg-slate-100'
                    : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'
                }`}
                style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}
              >
                <span
                  className="material-symbols-outlined shrink-0"
                  style={{ fontSize: '24px', width: '24px', height: '24px', fontVariationSettings: "'FILL' 0" }}
                >
                  groups
                </span>
                <span className="text-sm font-medium flex-1 text-left">Workforce</span>
                <span
                  className="material-symbols-outlined text-sm transition-transform duration-200"
                  style={{ fontSize: '18px', transform: workforceOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                  expand_more
                </span>
              </button>

              {workforceOpen && (
                <div className="mt-1 space-y-0.5">

                  {/* Recruitment sub-section */}
                  {canSeeApplicants && (
                    <>
                      <SectionLabel label="Recruitment" />
                      <SubNavLink
                        href="/admin/applicants"
                        icon="person_add"
                        label="Talent Pipeline"
                        active={pathname === '/admin/applicants' || (pathname.startsWith('/admin/applicants') && !pathname.startsWith('/admin/applicants/archived'))}
                      />
                      <SubNavLink
                        href="/admin/applicants/archived"
                        icon="archive"
                        label="Archived Applicants"
                        active={pathname.startsWith('/admin/applicants/archived')}
                      />
                    </>
                  )}

                  {/* Staff sub-section */}
                  {canSeeStaff && (
                    <>
                      <SectionLabel label="Staff" />
                      <SubNavLink
                        href="/admin/staff"
                        icon="badge"
                        label="Active Staff"
                        active={pathname === '/admin/staff' || (pathname.startsWith('/admin/staff') && !pathname.startsWith('/admin/staff/archived'))}
                      />
                      <SubNavLink
                        href="/admin/staff/archived"
                        icon="person_off"
                        label="Archived Staff"
                        active={pathname.startsWith('/admin/staff/archived')}
                      />
                    </>
                  )}

                  {/* Compliance sub-section */}
                  {canSeeCompliance && (
                    <>
                      <SectionLabel label="Compliance" />
                      <SubNavLink
                        href="/admin/compliance"
                        icon="verified_user"
                        label="Compliance Dashboard"
                        active={pathname === '/admin/compliance' || pathname.startsWith('/admin/compliance')}
                      />
                    </>
                  )}

                  {/* Onboarding */}
                  {canSeeStaff && (
                    <>
                      <SectionLabel label="Onboarding" />
                      <SubNavLink
                        href="/admin/onboarding"
                        icon="how_to_reg"
                        label="Onboarding"
                        active={pathname.startsWith('/admin/onboarding')}
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Bottom items: Clients, Packages, Incidents, etc. */}
          {bottomItems.filter((i) => i.show).map((item) => {
            const active = pathname.startsWith(item.href)
            return <NavLink key={item.href} href={item.href} icon={item.icon} label={item.label} active={active} />
          })}
        </nav>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <div className="mt-auto shrink-0 flex flex-col pt-6 gap-2">
          {footerItems.filter((i) => i.show).map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-200 overflow-hidden ${
                  active
                    ? 'bg-[#4f46e5] text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'
                }`}
                style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}
              >
                {active && <div className="absolute left-0 top-0 bottom-0 w-1 bg-white/20" />}
                <span
                  className="material-symbols-outlined shrink-0 overflow-hidden flex items-center justify-center"
                  style={{ fontSize: '24px', width: '24px', height: '24px', fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
                >
                  {item.icon}
                </span>
                <span className="text-sm font-medium normal-case truncate">{item.label}</span>
              </Link>
            )
          })}

          {/* User profile row */}
          <div className="mt-4 pt-4 border-t border-outline-variant/60 flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-full bg-white shadow-sm border border-slate-200 flex items-center justify-center text-slate-800 font-bold text-sm shrink-0">
              {userInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>
                {userFullName}
              </p>
              <p className="text-[11px] text-slate-500 font-medium truncate capitalize">
                {userRole.replace(/_/g, ' ') || 'Admin'}
              </p>
            </div>
          </div>
        </div>

      </div>
    </aside>
  )
}
