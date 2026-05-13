'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
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

export default function AdminSidebar({ userRole, userFullName, userInitials }: AdminSidebarProps) {
  const pathname = usePathname()

  // Hide sidebar on auth pages
  const isAuthPage = pathname === '/admin/login' || pathname === '/admin/set-password'
  if (isAuthPage) return null

  // If role is unknown, fallback to showing all
  const showAll = !userRole
  function navCan(check: (role: string) => boolean): boolean {
    return showAll || check(userRole)
  }

  const navItems = [
    { label: 'Dashboard',    href: '/admin',               icon: 'dashboard',     show: true },
    { label: 'Shifts',       href: '/admin/shifts',        icon: 'event_repeat',  show: navCan(canViewShifts) },
    { label: 'Compliance',   href: '/admin/compliance',    icon: 'verified_user', show: navCan(canViewCompliance) },
    { label: 'Staff',        href: '/admin/staff',         icon: 'groups',        show: navCan(canManageStaff) },
    { label: 'Applicants',   href: '/admin/applicants',    icon: 'person_add',    show: navCan((r) => can(r, 'applicants:read')) },
    { label: 'Onboarding',   href: '/admin/onboarding',    icon: 'how_to_reg',    show: navCan(canManageStaff) },
    { label: 'Clients',      href: '/admin/clients',       icon: 'contact_page',  show: navCan((r) => can(r, 'clients:read')) },
    { label: 'Packages',     href: '/admin/care-packages', icon: 'payments',      show: navCan((r) => can(r, 'care_packages:read')) },
    { label: 'Incidents',    href: '/admin/incidents',     icon: 'warning',       show: navCan(canViewIncidents) },
    { label: 'Audit Log',    href: '/admin/audit-log',     icon: 'history',       show: navCan(canViewAuditLogs) },
    { label: 'Notifications',href: '/admin/notifications', icon: 'notifications', show: navCan(canViewNotifications) },
  ]

  if (ENABLE_TIMESHEETS) {
    navItems.splice(2, 0, {
      label: 'Timesheets',
      href: '/admin/timesheets',
      icon: 'schedule',
      show: navCan((r) => can(r, 'timesheets:read')),
    })
  }

  const footerItems = [
    { label: 'System', href: '/admin/system', icon: 'settings', show: navCan(canViewSystemHealth) },
  ]

  return (
    <aside
      className="hidden lg:flex flex-col h-screen w-64 fixed left-0 top-0 z-50"
      style={{
        width: '256px',
        minWidth: '256px',
        maxWidth: '256px',
        backgroundColor: '#f8f9fa',
        borderRight: '1px solid #e2e8f0',
      }}
    >
      <div className="flex flex-col h-full overflow-y-auto" style={{ scrollbarWidth: 'none' }}>

        {/* ── Brand ─────────────────────────────────────────────────────────── */}
        <div
          className="shrink-0 flex items-center gap-2.5 px-6 py-5"
          style={{ borderBottom: '1px solid #e2e8f0' }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: '#1e293b' }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '18px', color: '#ffffff', fontVariationSettings: "'FILL' 1" }}
            >
              shield
            </span>
          </div>
          <Link href="/admin" className="block leading-none">
            <span
              className="block text-base font-bold"
              style={{
                fontFamily: 'var(--font-jakarta), sans-serif',
                color: '#1e293b',
                textTransform: 'none',
                fontSize: '16px',
                lineHeight: '1.2',
              }}
            >
              Care OS
            </span>
          </Link>
        </div>

        {/* ── Main Navigation ───────────────────────────────────────────────── */}
        <nav className="flex-1 py-3">
          {navItems.filter((i) => i.show).map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/admin' && pathname.startsWith(item.href))

            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex items-center gap-3 transition-colors duration-150"
                style={{
                  padding: '10px 24px',
                  fontFamily: 'var(--font-jakarta), sans-serif',
                  textDecoration: 'none',
                  backgroundColor: isActive ? '#eef2ff' : 'transparent',
                  color: isActive ? '#1e293b' : '#64748b',
                  textTransform: 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = '#f1f5f9'
                    e.currentTarget.style.color = '#1e293b'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color = '#64748b'
                  }
                }}
              >
                {/* Active left bar */}
                {isActive && (
                  <div
                    className="absolute left-0 top-0 bottom-0"
                    style={{ width: '3px', backgroundColor: '#1e293b', borderRadius: '0 2px 2px 0' }}
                  />
                )}

                {/* Icon */}
                <span
                  className="material-symbols-outlined shrink-0"
                  style={{
                    fontSize: '20px',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontVariationSettings: isActive ? "'FILL' 0, 'wght' 500" : "'FILL' 0, 'wght' 400",
                  }}
                >
                  {item.icon}
                </span>

                {/* Label */}
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: isActive ? 600 : 500,
                    textTransform: 'none',
                    letterSpacing: 'normal',
                    lineHeight: '1.4',
                  }}
                >
                  {item.label}
                </span>
              </Link>
            )
          })}
        </nav>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <div className="mt-auto shrink-0" style={{ borderTop: '1px solid #e2e8f0' }}>
          {/* Settings link */}
          {footerItems.filter((i) => i.show).map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex items-center gap-3 transition-colors duration-150"
                style={{
                  padding: '10px 24px',
                  fontFamily: 'var(--font-jakarta), sans-serif',
                  textDecoration: 'none',
                  backgroundColor: isActive ? '#eef2ff' : 'transparent',
                  color: isActive ? '#1e293b' : '#64748b',
                  textTransform: 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = '#f1f5f9'
                    e.currentTarget.style.color = '#1e293b'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color = '#64748b'
                  }
                }}
              >
                {isActive && (
                  <div
                    className="absolute left-0 top-0 bottom-0"
                    style={{ width: '3px', backgroundColor: '#1e293b', borderRadius: '0 2px 2px 0' }}
                  />
                )}
                <span
                  className="material-symbols-outlined shrink-0"
                  style={{ fontSize: '20px', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {item.icon}
                </span>
                <span style={{ fontSize: '14px', fontWeight: 500, textTransform: 'none' }}>
                  {item.label}
                </span>
              </Link>
            )
          })}

          {/* User profile row */}
          <div
            className="flex items-center gap-3 px-6 py-4"
            style={{ borderTop: '1px solid #e2e8f0' }}
          >
            <div
              className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
            >
              {userInitials}
            </div>
            <div className="overflow-hidden">
              <p
                className="truncate"
                style={{
                  fontFamily: 'var(--font-jakarta), sans-serif',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#1e293b',
                  textTransform: 'none',
                  lineHeight: '1.3',
                }}
              >
                {userFullName}
              </p>
              <p
                className="truncate capitalize"
                style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  color: '#94a3b8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  lineHeight: '1.3',
                }}
              >
                {userRole.replace(/_/g, ' ') || 'Admin'}
              </p>
            </div>
          </div>
        </div>

      </div>
    </aside>
  )
}
