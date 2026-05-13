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

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Fetch user profile once for: QA banner + nav permission filtering.
  // Non-blocking — layout never crashes on auth errors.
  let isQaEnvironment = false
  let userRole = ''

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id, role, companies(name)')
        .eq('id', user.id)
        .maybeSingle()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const companyName: string = (profile?.companies as any)?.name ?? ''
      isQaEnvironment = companyName.includes('QA')
      userRole = normaliseRole((profile?.role as string | null) ?? '')
    }
  } catch {
    // Non-blocking — don't crash the layout
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
      {!isQaEnvironment && userRole && (
        <div
          id="pilot-mode-banner"
          role="note"
          className="bg-indigo-50 border-b border-indigo-100 text-indigo-700 text-center px-4 py-1.5 text-[11px] font-medium flex items-center justify-center gap-2"
        >
          <span>🚀</span>
          <span>
            <strong>Pilot mode:</strong> Care OS is being used for onboarding &amp; compliance only.
          </span>
        </div>
      )}
      
      <AdminHeader userRole={userRole} isQaEnvironment={isQaEnvironment} />

      {/* pb-20 on mobile clears the fixed bottom nav; removed on lg+ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 pb-24 lg:pb-8">
        {children}
      </main>

      <AdminMobileNav userRole={userRole} />
    </div>
  )
}

