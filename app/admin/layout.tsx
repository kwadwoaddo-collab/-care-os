import { ENABLE_TIMESHEETS } from '@/lib/features'
import { createClient } from '@/lib/supabase/server'
import { normaliseRole } from '@/lib/auth/roles'
import { can, type Permission } from '@/lib/auth/permissions'
import AdminNotificationBell from '@/components/shared/AdminNotificationBell'

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

  // If role is unknown (unauthenticated or error), default to showing all links.
  // Individual API routes and page guards enforce the real restrictions.
  const showAll = userRole === ''
  function navCan(permission: Permission): boolean {
    return showAll || can(userRole, permission)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {isQaEnvironment && (
        <div
          id="qa-environment-banner"
          role="alert"
          style={{
            background: 'linear-gradient(90deg, #78350f 0%, #92400e 50%, #78350f 100%)',
            color: '#fef3c7',
            textAlign: 'center',
            padding: '6px 16px',
            fontSize: '13px',
            fontWeight: 600,
            letterSpacing: '0.03em',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <span>⚠️</span>
          <span>QA Environment — Test Data Only. Do not use real client or staff information.</span>
          <span>⚠️</span>
        </div>
      )}
      {!isQaEnvironment && (
        <div
          id="pilot-mode-banner"
          role="note"
          style={{
            background: '#eef2ff',
            borderBottom: '1px solid #c7d2fe',
            color: '#3730a3',
            textAlign: 'center',
            padding: '5px 16px',
            fontSize: '12px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <span>🚀</span>
          <span>
            <strong>Pilot mode:</strong> Care OS is being used for onboarding &amp; compliance only.
            BrightHR remains the sign-in system for shifts, attendance &amp; payroll.
          </span>
        </div>
      )}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-6">
          <span className="font-semibold text-gray-900 text-sm tracking-tight">Care OS — Admin</span>
          <nav className="flex items-center gap-4 text-sm text-gray-600">
            {navCan('applicants:read') && (
              <a href="/admin/applicants" className="hover:text-gray-900 transition-colors">
                Applicants
              </a>
            )}
            {navCan('staff:read') && (
              <a href="/admin/staff" className="hover:text-gray-900 transition-colors">
                Staff
              </a>
            )}
            {navCan('staff:read') && (
              <a href="/admin/onboarding" className="hover:text-gray-900 transition-colors">
                Onboarding
              </a>
            )}
            {navCan('compliance:read') && (
              <a href="/admin/compliance" className="hover:text-gray-900 transition-colors">
                Compliance
              </a>
            )}
            {navCan('audit_log:read') && (
              <a href="/admin/audit-log" className="hover:text-gray-900 transition-colors">
                Audit Log
              </a>
            )}
            {navCan('notifications:read') && (
              <a href="/admin/notifications" className="hover:text-gray-900 transition-colors">
                Notifications
              </a>
            )}
            {navCan('clients:read') && (
              <a href="/admin/clients" className="hover:text-gray-900 transition-colors">
                Clients
              </a>
            )}
            {navCan('care_packages:read') && (
              <a href="/admin/care-packages" className="hover:text-gray-900 transition-colors">
                Care Packages
              </a>
            )}
            {navCan('shifts:read') && (
              <a href="/admin/shifts" className="hover:text-gray-900 transition-colors">
                Shifts
              </a>
            )}
            {navCan('shifts:read') && (
              <a href="/admin/shifts/operations" className="hover:text-gray-900 transition-colors">
                Shift Ops
              </a>
            )}
            {navCan('visit_notes:read') && (
              <a href="/admin/visit-notes" className="hover:text-gray-900 transition-colors">
                Visit Notes
              </a>
            )}
            {navCan('incidents:read') && (
              <a href="/admin/incidents" className="hover:text-gray-900 transition-colors">
                Incidents
              </a>
            )}
            {navCan('system:read') && (
              <a href="/admin/system" className="hover:text-gray-900 transition-colors">
                System
              </a>
            )}
            {ENABLE_TIMESHEETS && navCan('timesheets:read') && (
              <a href="/admin/timesheets" className="hover:text-gray-900 transition-colors">
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  )
}
