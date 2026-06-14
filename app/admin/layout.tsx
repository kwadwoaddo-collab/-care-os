import { ENABLE_TIMESHEETS } from '@/lib/features'
import { createClient } from '@/lib/supabase/server'
import { normaliseRole } from '@/lib/rbac/roles'
import {
  canViewCompliance,
  canViewAuditLogs,
  canViewNotifications,
  canViewShifts,
  canViewIncidents,
  canManageStaff,
  canViewSystemHealth,
  canManageRoles,
} from '@/lib/rbac/can'
import { can, type Permission } from '@/lib/rbac/permissions'
import AdminHeader    from '@/components/admin/AdminHeader'
import AdminMobileNav from '@/components/admin/AdminMobileNav'
import AdminSidebar   from '@/components/admin/AdminSidebar'
import Link from 'next/link'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Fetch user profile once for: QA banner + nav permission filtering.
  // Non-blocking — layout never crashes on auth errors.
  let isQaEnvironment    = false
  let mustChangePassword = false
  let userRole = ''
  let userFullName = 'Admin User'
  let userInitials = 'A'

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id, role, first_name, last_name, companies(name)')
        .eq('id', user.id)
        .maybeSingle()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const companyName: string = (profile?.companies as any)?.name ?? ''
      isQaEnvironment = companyName.includes('QA')
      userRole = normaliseRole((profile?.role as string | null) ?? '')

      if (profile?.first_name || profile?.last_name) {
        userFullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ')
        userInitials = [profile.first_name?.[0], profile.last_name?.[0]].filter(Boolean).join('').toUpperCase() || 'A'
      }

      // Test/pilot accounts are provisioned with must_change_password: true in user_metadata
      mustChangePassword = user.user_metadata?.must_change_password === true
    }
  } catch {
    // Non-blocking — don't crash the layout
  }

  return (
    <div className="min-h-screen bg-background text-on-background flex">
      {/* Desktop Sidebar */}
      <AdminSidebar
        userRole={userRole}
        userFullName={userFullName}
        userInitials={userInitials}
      />

      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {isQaEnvironment && (
          <div
            id="qa-environment-banner"
            role="alert"
            className="bg-amber-900 text-amber-50 text-center px-4 py-1.5 text-xs font-semibold flex items-center justify-center gap-2"
          >
            <span>⚠️</span>
            <span>QA Environment — Test Data Only. Do not use real client or staff information.</span>
            <span>⚠️</span>
          </div>
        )}
        {mustChangePassword && (
          <div
            id="password-change-banner"
            role="alert"
            className="bg-yellow-500 text-yellow-950 text-center px-4 py-1.5 text-xs font-semibold flex items-center justify-center gap-2"
          >
            <span>🔑</span>
            <span>
              Your account was provisioned with a temporary password.{' '}
              <Link href="/admin/set-password" className="underline font-bold hover:text-yellow-900">
                Change it now →
              </Link>
            </span>
          </div>
        )}
        {!isQaEnvironment && userRole && (
          <div
            id="pilot-mode-banner"
            role="note"
            className="bg-indigo-50 border-b border-indigo-100 text-indigo-700 text-center px-4 py-1.5 text-[11px] font-medium flex items-center justify-center gap-2"
          >
            <span>🚀</span>
            <span>
              <strong>Pilot mode:</strong> Care OS is being used for onboarding & compliance only.
            </span>
          </div>
        )}
        
        <AdminHeader />

        {/* pb-24 on mobile clears the fixed bottom nav; removed on lg+ */}
        <main className="flex-1 p-4 lg:p-6 pb-24 lg:pb-8">
          <div className="max-w-container-max mx-auto">
            {children}
          </div>
        </main>
      </div>

      <AdminMobileNav userRole={userRole} />
    </div>
  )
}

