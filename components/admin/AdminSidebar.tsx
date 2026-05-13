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
    <aside className="hidden lg:flex flex-col h-screen w-64 min-w-[256px] max-w-[256px] fixed left-0 top-0 bg-surface-container-low border-r border-outline-variant z-50">
      <div className="flex flex-col h-full overflow-y-auto no-scrollbar">
        
        {/* Brand */}
        <div className="mb-6 px-6 py-6 shrink-0">
          <Link href="/admin" className="block">
            <span className="text-xl font-bold text-slate-800" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>Care OS</span>
            <p className="text-xs text-slate-500 font-medium">Healthcare Admin</p>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col space-y-1">
          {navItems.filter((i) => i.show).map((item) => {
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-3 px-6 py-3 transition-colors duration-200 ${
                  isActive
                    ? 'bg-slate-100 text-slate-800'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
                style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}
              >
                {/* Active Indicator Bar */}
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-800" />
                )}
                
                <span className="material-symbols-outlined text-[24px] w-[24px] h-[24px] shrink-0" style={{ fontSize: '24px' }}>
                  {item.icon}
                </span>
                
                <span className="text-sm font-medium normal-case truncate">
                  {item.label}
                </span>
              </Link>
            )
          })}
        </nav>

        {/* Footer: User Info */}
        <div className="mt-auto pt-8 shrink-0">
          <div className="flex items-center gap-3 px-6 py-4 bg-surface-container-low border-t border-outline-variant/50">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-800 font-bold text-sm shrink-0">
              {userInitials}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-slate-800 truncate" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>{userFullName}</p>
              <p className="text-[10px] text-slate-500 font-medium truncate capitalize">{userRole.replace(/_/g, ' ') || 'Admin'}</p>
            </div>
          </div>
        </div>

      </div>
    </aside>
  )
}
