'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { can } from '@/lib/rbac/permissions'
import { ENABLE_TIMESHEETS } from '@/lib/features'
import Icon from '@/components/ui/Icon'
import {
  canViewCompliance,
  canViewAuditLogs,
  canViewNotifications,
  canViewShifts,
  canViewIncidents,
  canManageStaff,
  canViewSystemHealth,
  canManageTenants,
} from '@/lib/rbac/can'

interface AdminSidebarProps {
  userRole: string
  userFullName: string
  userInitials: string
}

export default function AdminSidebar({ userRole, userFullName, userInitials }: AdminSidebarProps) {
  const pathname = usePathname()

  const isAuthPage = pathname === '/admin/login' || pathname === '/admin/set-password'
  if (isAuthPage) return null

  const showAll = !userRole
  function navCan(check: (role: string) => boolean): boolean {
    return showAll || check(userRole)
  }

  const showWorkforce =
    navCan(canManageStaff) ||
    navCan((r) => can(r, 'applicants:read')) ||
    navCan(canViewCompliance)

  const navItems = [
    { label: 'Dashboard',     href: '/admin',               icon: 'dashboard',     show: true },
    { label: 'Shifts',        href: '/admin/shifts',         icon: 'event_repeat',  show: navCan(canViewShifts) },
    { label: 'Workforce',     href: '/admin/workforce',      icon: 'groups',        show: showWorkforce,
      activeMatch: (p: string) =>
        p === '/admin/workforce' ||
        p.startsWith('/admin/applicants') ||
        p.startsWith('/admin/staff') ||
        p.startsWith('/admin/compliance') ||
        p.startsWith('/admin/onboarding'),
    },
    { label: 'Clients',       href: '/admin/clients',        icon: 'contact_page',  show: navCan((r) => can(r, 'clients:read')) },
    { label: 'Packages',      href: '/admin/care-packages',  icon: 'payments',      show: navCan((r) => can(r, 'care_packages:read')) },
    { label: 'Incidents',     href: '/admin/incidents',      icon: 'warning',       show: navCan(canViewIncidents) },
    { label: 'Visits',        href: '/admin/visits',         icon: 'home_health',   show: navCan(canViewShifts) },
    { label: 'Operations',    href: '/admin/operations',     icon: 'hub',           show: navCan(canViewIncidents) },
    { label: 'Communications', href: '/admin/communications',  icon: 'forum',         show: navCan(canViewNotifications) },
    { label: 'Pipeline',      href: '/admin/onboarding/pipeline', icon: 'view_kanban', show: navCan(canViewCompliance),
      activeMatch: (p: string) => p.startsWith('/admin/onboarding/pipeline'),
    },
    { label: 'Documents',     href: '/admin/documents/verification', icon: 'fact_check', show: navCan(canViewCompliance),
      activeMatch: (p: string) => p.startsWith('/admin/documents'),
    },
    { label: 'Audit Log',     href: '/admin/audit-log',      icon: 'history',       show: navCan(canViewAuditLogs) },
    { label: 'Notifications', href: '/admin/notifications',  icon: 'notifications', show: navCan(canViewNotifications) },
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
    { label: 'Analytics', href: '/admin/analytics',        icon: 'analytics',      show: navCan(canViewCompliance) },
    { label: 'Tenants',   href: '/admin/system/tenants',   icon: 'corporate_fare', show: navCan(canManageTenants) },
    { label: 'Jobs',      href: '/admin/system/jobs',      icon: 'manufacturing',  show: navCan(canViewSystemHealth) },
    { label: 'System',    href: '/admin/system',            icon: 'settings',       show: navCan(canViewSystemHealth) },
  ]

  return (
    <aside className="hidden lg:flex flex-col h-screen w-64 min-w-[256px] max-w-[256px] fixed left-0 top-0 bg-surface-container border-r border-outline-variant z-50">
      <div className="flex flex-col h-full px-6 py-8 overflow-y-auto no-scrollbar">

        {/* ── Brand ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 shrink-0 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
            <Icon name="shield" size="md" fill className="text-on-primary" />
          </div>
          <div>
            <span
              className="block text-[22px] font-bold text-on-surface leading-none tracking-tight"
              style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}
            >
              Care OS
            </span>
            <span className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mt-1">
              Healthcare Admin
            </span>
          </div>
        </div>

        {/* ── Main Navigation ───────────────────────────────────────────────── */}
        <nav className="flex-1 flex flex-col space-y-1.5">
          {navItems.filter((i) => i.show).map((item) => {
            const isActive = 'activeMatch' in item && item.activeMatch
              ? item.activeMatch(pathname)
              : pathname === item.href ||
                (item.href !== '/admin' && pathname.startsWith(item.href))

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-200 overflow-hidden ${
                  isActive
                    ? 'bg-secondary text-white shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
                style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}
              >
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-white/20" />
                )}
                <Icon
                  name={item.icon}
                  size="md"
                  fill={isActive}
                  className="shrink-0"
                />
                <span className="text-sm font-medium normal-case truncate">
                  {item.label}
                </span>
              </Link>
            )
          })}
        </nav>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <div className="mt-auto shrink-0 flex flex-col pt-6 gap-2">
          {footerItems.filter((i) => i.show).map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-200 overflow-hidden ${
                  isActive
                    ? 'bg-secondary text-white shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
                style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}
              >
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-white/20" />
                )}
                <Icon
                  name={item.icon}
                  size="md"
                  fill={isActive}
                  className="shrink-0"
                />
                <span className="text-sm font-medium normal-case truncate">
                  {item.label}
                </span>
              </Link>
            )
          })}

          {/* User profile row */}
          <div className="mt-4 pt-4 border-t border-outline-variant/60 flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-full bg-surface-container-lowest shadow-sm border border-outline-variant/60 flex items-center justify-center text-on-surface font-bold text-sm shrink-0">
              {userInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-bold text-on-surface truncate"
                style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}
              >
                {userFullName}
              </p>
              <p className="text-[11px] text-on-surface-variant font-medium truncate capitalize">
                {userRole.replace(/_/g, ' ') || 'Admin'}
              </p>
            </div>
          </div>
        </div>

      </div>
    </aside>
  )
}
