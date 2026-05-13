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
    { label: 'Dashboard',   href: '/admin',              icon: 'dashboard',      show: true },
    { label: 'Shifts',      href: '/admin/shifts',       icon: 'event_repeat',   show: navCan(canViewShifts) },
    { label: 'Compliance',  href: '/admin/compliance',   icon: 'verified_user',  show: navCan(canViewCompliance) },
    { label: 'Staff',       href: '/admin/staff',        icon: 'groups',         show: navCan(canManageStaff) },
    { label: 'Applicants',  href: '/admin/applicants',   icon: 'person_add',     show: navCan((r) => can(r, 'applicants:read')) },
    { label: 'Onboarding',  href: '/admin/onboarding',   icon: 'how_to_reg',     show: navCan(canManageStaff) },
    { label: 'Clients',     href: '/admin/clients',      icon: 'contact_page',   show: navCan((r) => can(r, 'clients:read')) },
    { label: 'Packages',    href: '/admin/care-packages',icon: 'payments',       show: navCan((r) => can(r, 'care_packages:read')) },
    { label: 'Incidents',   href: '/admin/incidents',    icon: 'warning',        show: navCan(canViewIncidents) },
    { label: 'Audit Log',   href: '/admin/audit-log',    icon: 'history',        show: navCan(canViewAuditLogs) },
    { label: 'System',      href: '/admin/system',       icon: 'settings',       show: navCan(canViewSystemHealth) },
    { label: 'Notifications',href:'/admin/notifications',icon: 'notifications',  show: navCan(canViewNotifications) },
  ]

  if (ENABLE_TIMESHEETS) {
    navItems.splice(2, 0, { label: 'Timesheets', href: '/admin/timesheets', icon: 'schedule', show: navCan((r) => can(r, 'timesheets:read')) })
  }

  return (
    <aside className="hidden lg:flex flex-col h-screen w-64 fixed left-0 top-0 bg-surface-container dark:bg-inverse-surface border-r border-outline-variant dark:border-outline z-50">
      <div className="flex flex-col h-full p-4 space-y-2 overflow-y-auto no-scrollbar">
        
        {/* Brand */}
        <div className="mb-6 px-4 py-2 mt-2">
          <Link href="/admin" className="block">
            <span className="font-headline-lg text-headline-lg font-bold text-primary dark:text-inverse-primary">Care OS</span>
            <p className="font-label-md text-label-md text-on-surface-variant">Healthcare Admin</p>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1">
          {navItems.filter((i) => i.show).map((item) => {
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-secondary-container text-on-secondary-container font-bold'
                    : 'text-on-surface-variant dark:text-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]" data-icon={item.icon}>{item.icon}</span>
                <span className="font-label-md text-label-md">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Footer: User Info */}
        <div className="pt-4 border-t border-outline-variant dark:border-outline mt-auto shrink-0">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed font-bold text-sm shrink-0">
              {userInitials}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-on-surface truncate">{userFullName}</p>
              <p className="text-[10px] text-on-surface-variant truncate capitalize">{userRole.replace(/_/g, ' ') || 'Admin'}</p>
            </div>
          </div>
        </div>

      </div>
    </aside>
  )
}
