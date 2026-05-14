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
    { label: 'Staff & Recruitment', href: '/admin/staff', icon: 'groups', show: navCan(canManageStaff) },
    { label: 'Talent Pipeline', href: '/admin/applicants', icon: 'person_add', show: navCan((r) => can(r, 'applicants:read')) },
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
          {navItems.filter((i) => i.show).map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/admin' && pathname.startsWith(item.href))

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-200 overflow-hidden ${
                  isActive
                    ? 'bg-[#4f46e5] text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'
                }`}
                style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}
              >
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-white/20" />
                )}
                
                <span 
                  className="material-symbols-outlined shrink-0 overflow-hidden flex items-center justify-center" 
                  style={{ 
                    fontSize: '24px', 
                    width: '24px', 
                    height: '24px',
                    fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0"
                  }}
                >
                  {item.icon}
                </span>
                
                <span className="text-sm font-medium normal-case truncate">
                  {item.label}
                </span>
              </Link>
            )
          })}
        </nav>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <div className="mt-auto shrink-0 flex flex-col pt-6 gap-2">
          {/* Settings link */}
          {footerItems.filter((i) => i.show).map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-200 overflow-hidden ${
                  isActive
                    ? 'bg-[#4f46e5] text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'
                }`}
                style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}
              >
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-white/20" />
                )}
                <span 
                  className="material-symbols-outlined shrink-0 overflow-hidden flex items-center justify-center" 
                  style={{ 
                    fontSize: '24px', 
                    width: '24px', 
                    height: '24px',
                    fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0"
                  }}
                >
                  {item.icon}
                </span>
                <span className="text-sm font-medium normal-case truncate">
                  {item.label}
                </span>
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
