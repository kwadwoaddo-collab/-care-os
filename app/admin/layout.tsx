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
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  )
}
