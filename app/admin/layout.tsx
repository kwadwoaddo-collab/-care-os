import { ENABLE_TIMESHEETS } from '@/lib/features'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
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
            <a href="/admin/clients" className="hover:text-gray-900 transition-colors">
              Clients
            </a>
            <a href="/admin/care-packages" className="hover:text-gray-900 transition-colors">
              Care Packages
            </a>
            <a href="/admin/shifts" className="hover:text-gray-900 transition-colors">
              Shifts
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
