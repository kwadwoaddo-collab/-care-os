import { ENABLE_TIMESHEETS } from '@/lib/features'
import { createClient } from '@/lib/supabase/server'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // QA banner: show when the current company name contains "QA"
  let isQaEnvironment = false
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id, companies(name)')
        .eq('id', user.id)
        .maybeSingle()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const companyName: string = (profile?.companies as any)?.name ?? ''
      isQaEnvironment = companyName.includes('QA')
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
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-6">
          <span className="font-semibold text-gray-900 text-sm tracking-tight">Care OS — Admin</span>
          <nav className="flex items-center gap-4 text-sm text-gray-600">
            <a href="/admin/applicants" className="hover:text-gray-900 transition-colors">
              Applicants
            </a>
            <a href="/admin/staff" className="hover:text-gray-900 transition-colors">
              Staff
            </a>
            <a href="/admin/onboarding" className="hover:text-gray-900 transition-colors">
              Onboarding
            </a>
            <a href="/admin/compliance" className="hover:text-gray-900 transition-colors">
              Compliance
            </a>
            <a href="/admin/audit-log" className="hover:text-gray-900 transition-colors">
              Audit Log
            </a>
            <a href="/admin/notifications" className="hover:text-gray-900 transition-colors">
              Notifications
            </a>
            <a href="/admin/clients" className="hover:text-gray-900 transition-colors">
              Clients
            </a>
            <a href="/admin/care-packages" className="hover:text-gray-900 transition-colors">
              Care Packages
            </a>
            <a href="/admin/shifts" className="hover:text-gray-900 transition-colors">
              Shifts
            </a>
            <a href="/admin/shifts/operations" className="hover:text-gray-900 transition-colors">
              Shift Ops
            </a>
            <a href="/admin/visit-notes" className="hover:text-gray-900 transition-colors">
              Visit Notes
            </a>
            <a href="/admin/incidents" className="hover:text-gray-900 transition-colors">
              Incidents
            </a>
            <a href="/admin/system" className="hover:text-gray-900 transition-colors">
              System
            </a>
            {ENABLE_TIMESHEETS && (
              <a href="/admin/timesheets" className="hover:text-gray-900 transition-colors">
                Timesheets
              </a>
            )}
          </nav>
          <a
            href="/admin/logout"
            className="ml-auto text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            Logout
          </a>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  )
}
