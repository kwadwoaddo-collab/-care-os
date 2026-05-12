'use client'

import { usePathname } from 'next/navigation'
import AdminNotificationBell from '@/components/shared/AdminNotificationBell'
import { ENABLE_TIMESHEETS } from '@/lib/features'
import { can } from '@/lib/rbac/permissions'
import {
  canViewCompliance,
  canViewAuditLogs,
  canViewNotifications,
  canViewShifts,
  canViewIncidents,
  canManageStaff,
  canViewSystemHealth,
} from '@/lib/rbac/can'

interface AdminHeaderProps {
  userRole: string
  isQaEnvironment: boolean
}

export default function AdminHeader({ userRole, isQaEnvironment }: AdminHeaderProps) {
  const pathname = usePathname()

  // Hide header on login and set-password pages
  const isAuthPage = pathname === '/admin/login' || pathname === '/admin/set-password'
  if (isAuthPage || !userRole) return null

  // If role is unknown (unauthenticated or error), show all nav links.
  const showAll = userRole === ''
  function navCan(check: (role: string) => boolean): boolean {
    return showAll || check(userRole)
  }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-6">
        <span className="font-semibold text-gray-900 text-sm tracking-tight whitespace-nowrap">Care OS — Admin</span>
        
        <nav className="hidden lg:flex items-center gap-4 text-sm text-gray-600 overflow-x-auto no-scrollbar">
          {navCan((r) => can(r, 'applicants:read')) && (
            <a href="/admin/applicants" className={`hover:text-gray-900 transition-colors ${pathname.startsWith('/admin/applicants') ? 'text-gray-900 font-medium' : ''}`}>
              Applicants
            </a>
          )}
          {navCan(canManageStaff) && (
            <a href="/admin/staff" className={`hover:text-gray-900 transition-colors ${pathname.startsWith('/admin/staff') ? 'text-gray-900 font-medium' : ''}`}>
              Staff
            </a>
          )}
          {navCan(canManageStaff) && (
            <a href="/admin/onboarding" className={`hover:text-gray-900 transition-colors ${pathname.startsWith('/admin/onboarding') ? 'text-gray-900 font-medium' : ''}`}>
              Onboarding
            </a>
          )}
          {navCan(canViewCompliance) && (
            <a href="/admin/compliance" className={`hover:text-gray-900 transition-colors ${pathname.startsWith('/admin/compliance') ? 'text-gray-900 font-medium' : ''}`}>
              Compliance
            </a>
          )}
          {navCan(canViewAuditLogs) && (
            <a href="/admin/audit-log" className={`hover:text-gray-900 transition-colors ${pathname.startsWith('/admin/audit-log') ? 'text-gray-900 font-medium' : ''}`}>
              Audit Log
            </a>
          )}
          {navCan(canViewNotifications) && (
            <a href="/admin/notifications" className={`hover:text-gray-900 transition-colors ${pathname.startsWith('/admin/notifications') ? 'text-gray-900 font-medium' : ''}`}>
              Notifications
            </a>
          )}
          {navCan((r) => can(r, 'clients:read')) && (
            <a href="/admin/clients" className={`hover:text-gray-900 transition-colors ${pathname.startsWith('/admin/clients') ? 'text-gray-900 font-medium' : ''}`}>
              Clients
            </a>
          )}
          {navCan((r) => can(r, 'care_packages:read')) && (
            <a href="/admin/care-packages" className={`hover:text-gray-900 transition-colors ${pathname.startsWith('/admin/care-packages') ? 'text-gray-900 font-medium' : ''}`}>
              Care Packages
            </a>
          )}
          {navCan(canViewShifts) && (
            <a href="/admin/shifts" className={`hover:text-gray-900 transition-colors ${pathname.startsWith('/admin/shifts') ? 'text-gray-900 font-medium' : ''}`}>
              Shifts
            </a>
          )}
          {navCan(canViewIncidents) && (
            <a href="/admin/incidents" className={`hover:text-gray-900 transition-colors ${pathname.startsWith('/admin/incidents') ? 'text-gray-900 font-medium' : ''}`}>
              Incidents
            </a>
          )}
          {navCan(canViewSystemHealth) && (
            <a href="/admin/system" className={`hover:text-gray-900 transition-colors ${pathname.startsWith('/admin/system') ? 'text-gray-900 font-medium' : ''}`}>
              System
            </a>
          )}
          {ENABLE_TIMESHEETS && navCan((r) => can(r, 'timesheets:read')) && (
            <a href="/admin/timesheets" className={`hover:text-gray-900 transition-colors ${pathname.startsWith('/admin/timesheets') ? 'text-gray-900 font-medium' : ''}`}>
              Timesheets
            </a>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <AdminNotificationBell />
          <a
            href="/admin/logout"
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            Logout
          </a>
        </div>
      </div>
    </header>
  )
}
