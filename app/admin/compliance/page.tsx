import { Suspense }  from 'react'
import MobilePageHeader from '@/components/admin/MobilePageHeader'
import ComplianceDashboardClient from './ComplianceDashboardClient'

// ── GET /admin/compliance ─────────────────────────────────────────────────────
//
// Thin server wrapper — all data fetching happens client-side in
// ComplianceDashboardClient so filters/search work without page reload.

export const metadata = {
  title: 'Compliance Command | Care OS',
  description: 'Staff compliance dashboard — monitor, filter, and act on compliance across your team.',
}

export default function CompliancePage() {
  return (
    <div className="space-y-4">
      {/* Mobile header */}
      <MobilePageHeader
        title="Compliance Command"
        subtitle="Active monitoring of credentials, onboarding, and training health."
      />

      {/* Desktop header */}
      <div className="hidden lg:flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-primary tracking-tight">Compliance Command</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Active monitoring of credentials, onboarding, and training health.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/admin/compliance/reminders/send"
            data-method="post"
            id="send-digest-btn"
            className="bg-secondary-container/10 text-secondary font-medium py-2 px-4 rounded-lg hover:bg-secondary-container/20 transition-colors flex items-center gap-2 text-sm"
          >
            <span className="material-symbols-outlined text-[18px]">cloud_download</span>
            Export Report
          </a>
          <a
            href="/api/admin/compliance/reminders/send"
            data-method="post"
            id="send-digest-btn"
            className="bg-primary text-on-primary font-medium py-2 px-4 rounded-lg hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2 text-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Upload Documents
          </a>
        </div>
      </div>

      {/* Client dashboard — handles filter chips, search, table, bulk actions */}
      <Suspense
        fallback={
          <div className="py-12 text-center text-sm text-gray-400 animate-pulse">
            Loading compliance dashboard…
          </div>
        }
      >
        <ComplianceDashboardClient />
      </Suspense>
    </div>
  )
}
